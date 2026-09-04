// Primer punto de entrada real a lib/market/ — encadena los motores puros construidos en la
// ronda de Fase 1-16 sobre comparables YA extraídos por comparables-venta/route.ts. No vuelve a
// buscar en Serper ni llama al LLM: es puro orquestador de motores + una lectura opcional de
// historial (obtenerSnapshotsHistoricos) para Appreciation Engine.
//
// Nunca fabrica lo que no tiene: Product Fit y Opportunity Score completos requieren un
// envolvente normativo real (COS/CUS/niveles ya resueltos) que hoy nadie manda todavía — sin él,
// se documentan como warning en vez de inventar un envolvente por default.

import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import type { ComparableVenta } from '@/lib/mercado/validarComparableVenta'
import type { MarketEvidence, MarketMaster, ObjetivoComparable, TipoProductoMercado } from '@/lib/market/tipos'
import type { EnvolventeParaFit, ProductFitInput } from '@/lib/market/productFitEngine'

import { deduplicarComparables } from '@/lib/market/dedupEngine'
import { construirComparablesConScore } from '@/lib/market/comparableEngine'
import { calcularPriceEngine } from '@/lib/market/priceEngine'
import { construirGeographyContext } from '@/lib/market/geographyEngine'
import { categorizarInventario } from '@/lib/market/inventoryEngine'
import { construirCompetitorProfiles } from '@/lib/market/competitorEngine'
import { calcularAppreciationEngine } from '@/lib/market/appreciationEngine'
import { calcularProductFit } from '@/lib/market/productFitEngine'
import { calcularOpportunityScore } from '@/lib/market/opportunityEngine'
import { evidenciaDePrecio, evidenciaDePlusvalia } from '@/lib/market/evidenceEngine'
import { obtenerSnapshotsHistoricos, obtenerColoniasConHistorial } from '@/lib/market/persistencia'
import { resolverAbsorcionSNIIV } from '@/lib/market/sniivAbsorcion'
import { estimarPlusvaliaTramoAlto } from '@/lib/market/betaTramoEngine'

interface BodyProductFit {
  unidadesObjetivo: number
  precioM2Objetivo?: number | null
  areaM2Objetivo?: number | null
  recamarasObjetivo?: number | null
  envolvente: EnvolventeParaFit
}

const DIEZ_ANIOS_MS = 10 * 365 * 86_400_000 // cubre la ventana más larga del Appreciation Engine

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const body = await req.json()
  const comparables: ComparableVenta[] = body.comparables ?? []
  if (comparables.length === 0) {
    return NextResponse.json({ error: 'Se requiere al menos un comparable en comparables[].' }, { status: 400 })
  }

  const objetivo: ObjetivoComparable = body.objetivo ?? {}
  const tipoProducto: TipoProductoMercado = body.tipoProducto ?? 'residencial'
  const sitio = { ciudad: body.ciudad ?? null, colonia: body.colonia ?? null }
  const productFitInput: BodyProductFit | null = body.productFit ?? null

  const warnings: string[] = []

  // 1. Dedup primero — todo lo demás trabaja sobre el set ya limpio (§13).
  const dedup = deduplicarComparables(comparables)
  if (dedup.descartados.length > 0) {
    warnings.push(`${dedup.descartados.length} comparable(s) descartado(s) por duplicado.`)
  }
  const limpios = dedup.originales

  const comparablesConScore = construirComparablesConScore(limpios, objetivo)
  const prices = calcularPriceEngine(limpios)
  const geography = construirGeographyContext(sitio, tipoProducto)
  const inventory = categorizarInventario(limpios)
  const competitors = construirCompetitorProfiles(limpios, objetivo)

  // Plusvalía — necesita historial real segmentado por colonia (§26/27); sin colonia no hay
  // forma honesta de calcularla.
  let appreciation: MarketMaster['appreciation'] = null
  if (sitio.colonia) {
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - DIEZ_ANIOS_MS).toISOString().slice(0, 10)
      const historico = await obtenerSnapshotsHistoricos(sitio.colonia, desde, hasta)
      const observaciones = historico
        .filter((h): h is typeof h & { precio_m2: number } => h.precio_m2 != null)
        .map((h) => ({ precioM2: h.precio_m2, observadoEn: h.observed_at }))
      appreciation = calcularAppreciationEngine(observaciones)
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e)
      warnings.push(`No se pudo leer el historial de plusvalía: ${mensaje}`)
    }
  } else {
    warnings.push('Sin colonia — no se calculó plusvalía (Appreciation Engine necesita segmentar por zona).')
  }

  // Estimación heurística de plusvalía premium (banda 3-4) — lib/market/betaTramoEngine.ts,
  // beta calibrado con datos reales de FRED (Case-Shiller tiered index). Solo se intenta cuando
  // la colonia del predio NO tiene plusvalía real propia (ventana "anual" salió null — típico en
  // zonas premium con poco historial acumulado, ver appreciationEngine.ts) y hay ciudad para
  // buscar una colonia de referencia real. Nunca reemplaza una plusvalía real ya calculada.
  let plusvaliaPremiumEstimada: MarketMaster['plusvaliaPremiumEstimada'] = null
  const anualPropia = appreciation?.find((a) => a.ventana === 'anual') ?? null
  if (anualPropia?.tasaAnualizada == null && sitio.ciudad) {
    try {
      const hasta = new Date().toISOString().slice(0, 10)
      const desde = new Date(Date.now() - DIEZ_ANIOS_MS).toISOString().slice(0, 10)
      const colonias = await obtenerColoniasConHistorial(sitio.ciudad, desde, hasta)
      // Más barata primero (obtenerColoniasConHistorial ya ordena así) = mejor proxy de banda
      // económica/media; se salta la colonia del propio predio si por algún motivo aparece ahí.
      const referencia = colonias.find((c) => c.colonia !== sitio.colonia && c.n >= 3)
      if (referencia) {
        const historicoRef = await obtenerSnapshotsHistoricos(referencia.colonia, desde, hasta)
        const observacionesRef = historicoRef
          .filter((h): h is typeof h & { precio_m2: number } => h.precio_m2 != null)
          .map((h) => ({ precioM2: h.precio_m2, observadoEn: h.observed_at }))
        const anualRef = calcularAppreciationEngine(observacionesRef).find((a) => a.ventana === 'anual')
        if (anualRef?.tasaAnualizada != null) {
          plusvaliaPremiumEstimada = estimarPlusvaliaTramoAlto(anualRef.tasaAnualizada, referencia.colonia, referencia.n)
        } else {
          warnings.push(`Colonia de referencia (${referencia.colonia}) tampoco tiene suficiente historial propio — no se pudo estimar plusvalía premium.`)
        }
      } else {
        warnings.push(`Sin colonia de referencia con historial suficiente en ${sitio.ciudad} para estimar plusvalía premium (heurístico banda alta).`)
      }
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e)
      warnings.push(`No se pudo calcular la estimación heurística de plusvalía premium: ${mensaje}`)
    }
  }

  // Absorción real — SNIIV/SEDATU ("Días de inventario"). Cobertura acotada (solo vivienda con
  // financiamiento formal, solo Nuevo León hoy) — resolverAbsorcionSNIIV() nunca fabrica un
  // número, declara disponible=false con motivo explícito cuando el municipio no está cubierto
  // (ver lib/market/sniivAbsorcion.ts).
  let absorcionSNIIV: MarketMaster['absorcionSNIIV'] = null
  if (body.ciudad && body.estado) {
    try {
      absorcionSNIIV = await resolverAbsorcionSNIIV(body.ciudad, body.estado)
      if (!absorcionSNIIV.disponible) warnings.push(`Absorción real (SNIIV): ${absorcionSNIIV.motivo}`)
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e)
      warnings.push(`No se pudo consultar SNIIV para absorción: ${mensaje}`)
    }
  }

  // Product Fit — solo con un envolvente normativo real (COS/CUS/niveles ya resueltos por otro
  // agente). Nunca se fabrica uno por default (§120: nunca recomendar más de lo que permite la
  // normativa, y menos aún inventar si la cumple).
  let productFit: MarketMaster['productFit'] = null
  if (productFitInput) {
    const input: ProductFitInput = {
      unidadesObjetivo: productFitInput.unidadesObjetivo,
      precioM2Objetivo: productFitInput.precioM2Objetivo ?? objetivo.precioM2Objetivo ?? null,
      areaM2Objetivo: productFitInput.areaM2Objetivo ?? objetivo.areaM2Objetivo ?? null,
      recamarasObjetivo: productFitInput.recamarasObjetivo ?? objetivo.recamarasObjetivo ?? null,
      envolvente: productFitInput.envolvente,
      priceEngine: prices,
      comparables: limpios,
      competitors,
    }
    productFit = calcularProductFit(input)
  } else {
    warnings.push('Sin envolvente normativo — no se calculó Product Fit.')
  }

  // Opportunity Score — sus 4 componentes ya se auto-excluyen si faltan (opportunityEngine.ts),
  // por eso se puede llamar siempre; si todo falta, finalScore sale null, nunca 0.
  const ventanaAnual = appreciation?.find((a) => a.ventana === 'anual') ?? null
  const opportunityScore = calcularOpportunityScore({
    appreciationAnual: ventanaAnual,
    productFit,
    priceConfidenceScore: prices.askingPricePerM2?.confidenceScore ?? null,
  })

  // Evidencia — envuelve solo los números que sí tienen respaldo real detrás.
  const evidence: MarketEvidence[] = []
  if (prices.askingPricePerM2) {
    evidence.push(evidenciaDePrecio(prices.askingPricePerM2, { geography: sitio.colonia }))
  }
  if (appreciation) {
    for (const ventana of appreciation) {
      const ev = evidenciaDePlusvalia(ventana, { geography: sitio.colonia })
      if (ev) evidence.push(ev)
    }
  }

  // Confianza global acotada (§56): promedio simple de finalScore entre los comparables DIRECT.
  const directos = comparablesConScore.filter((c) => c.tipo === 'DIRECT' && c.score.finalScore != null)
  const dataConfidence = directos.length > 0
    ? Math.round(directos.reduce((s, c) => s + c.score.finalScore!, 0) / directos.length)
    : null

  const marketMaster: MarketMaster = {
    siteId: body.siteId ?? null,
    geography: { ...geography, lat: body.lat ?? null, lng: body.lng ?? null, estado: body.estado ?? null },
    comparables: comparablesConScore,
    prices,
    inventory,
    competitors,
    appreciation,
    productFit,
    opportunityScore,
    pipeline: null,
    demand: null,
    absorption: null,
    absorcionSNIIV,
    plusvaliaPremiumEstimada,
    dataConfidence,
    evidence,
    // Vacío a propósito: los comparables ya llegan extraídos por comparables-venta/route.ts
    // (que registra su propia fuente en market_sources al persistir) — esta ruta no vuelve a
    // buscar nada, no tiene una fuente propia que declarar.
    sources: [],
    warnings,
    version: '0.3.0-fase2-16-acotado',
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(marketMaster)
}
