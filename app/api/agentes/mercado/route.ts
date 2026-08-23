import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import { callClaudeJson } from '@/lib/llmJson'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const data = await req.json()

  const bandaLabels: Record<string, string> = {
    '1': 'Banda 1 — Económica / Interés Social',
    '2': 'Banda 2 — Media Estándar',
    '3': 'Banda 3 — Media Alta / Residencial',
    '4': 'Banda 4 — Premium / Lujo',
  }
  const desarrolloLabels: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical', 'residencial-horizontal': 'Residencial horizontal',
    unifamiliar: 'Unifamiliar', comercial: 'Comercial', mixto: 'Uso mixto',
    industrial: 'Industrial / Nave', 'no-definido': 'Sin definir',
  }

  const tiposLabels = (data.tiposDesarrollo as string[] || [])
    .map((t: string) => t === 'otro' ? (data.tipoOtroTexto || 'Otro') : (desarrolloLabels[t] || t))
    .join(', ')

  // Comparables reales de venta (Serper, ver app/api/agentes/comparables-venta/route.ts) —
  // antes este agente no tenía ningún grounding y "comparables reales" eran invención del
  // modelo. Mismo patrón ya usado en app/api/agentes/terreno/route.ts con sus comparables de
  // suelo: se anota como texto de contexto fuerte, no se fuerza en código (el mercado es un
  // rango/guía, no un valor único determinable).
  const comparablesPrecargados: any[] = data.comparablesPrecargados ?? []
  let serperContext = ''
  if (comparablesPrecargados.length > 0) {
    const lines = comparablesPrecargados.map((c: any) =>
      `- ${c.nombre} | ${c.direccion} | $${c.precioM2 ?? '?'}/m² | ${c.tipologia ?? '?'} | ${c.avanceObra ?? '?'} | ${c.fechaReferencia} | ${c.url}` +
      (c.sospechosoPorBanda ? ' — ⚠ precio muy por encima de la banda de construcción declarada, evalúa si es representativo' : '')
    ).join('\n')
    const hayMarcados = comparablesPrecargados.some((c: any) => c.sospechosoPorBanda)
    serperContext = `\n\nCOMPARABLES REALES VERIFICADOS (obtenidos de Google en tiempo real antes de este análisis):\n${lines}\n\nUSA estos comparables directamente en "comparables" (marca origen="web_search" para todos), y ajusta precioPromedioZona/segmentacion/pricingFases para que sean consistentes con estos precios reales — no inventes proyectos "reales" nuevos si ya tienes estos disponibles.` +
      (hayMarcados ? ` Los comparables marcados con ⚠ están muy por encima de la banda de construcción de este proyecto — no los descartes automáticamente (podría ser plusvalía real de ubicación), pero no ancles precioPromedioZona solo en ellos si el resto de comparables sin marcar sugiere algo más modesto.` : '')
  }

  const prompt = `Eres el Agente de Análisis de Mercado de SMT Developer.
Tu única tarea es analizar el mercado inmobiliario de la zona del predio: comparables de venta, absorción, precios, segmentación y oferta activa.
No calculas valor del terreno, costos de construcción ni análisis legal — solo mercado.

DATOS DEL PROYECTO:
- Colonia: ${data.colonia}, ${data.ciudad}, ${data.estado}
- Código postal: ${data.codigoPostal || 'No proporcionado'}
- Tipo(s) de desarrollo: ${tiposLabels}
- Nivel de construcción: ${bandaLabels[data.bandaConstruccion] || 'No especificado'}
- Superficie del terreno: ${data.superficie} m²
- Costo terreno aprobado: $${Number(data.costoTerrenoM2 || 0).toLocaleString('es-MX')}/m²
- Costo construcción aprobado: $${Number(data.construccionM2 || 0).toLocaleString('es-MX')}/m²
${data.mixUnidadesResumen ? `- MEZCLA DE UNIDADES ya definida por el Agente Construcción: ${data.mixUnidadesResumen}` : ''}
${data.precioVentaObjetivo ? `- PRECIO DE VENTA OBJETIVO definido por el desarrollador: $${Number(data.precioVentaObjetivo).toLocaleString('es-MX')}/m² — es un PROMEDIO PONDERADO por m² vendible de TODA la mezcla, no un precio único por tipología. Repártelo en "segmentacion" usando la mezcla de unidades de arriba (si no hay mezcla, usa proporciones típicas del mercado): unidades más chicas (estudios/1 rec) suelen pagar un premium de $/m², unidades grandes (3 rec+) y locales comerciales suelen tener un $/m² distinto al residencial. El promedio ponderado de "segmentacion" por participación de mercado debe coincidir con este objetivo. Usa el mismo criterio para "precioPromedioZona" y "pricingFases". Valida contra tus comparables si es razonable y menciónalo en la interpretación.` : ''}
${data.absorcionObjetivoManual ? `- ABSORCIÓN REAL observada por el desarrollador (dato de campo): ${data.absorcionObjetivoManual} — úsala en "absorcion", inventario y segmentacion en vez de estimarla desde cero.` : ''}

ANÁLISIS REQUERIDO — trátalo como DOS análisis distintos que luego se cruzan, no una sola lista mezclada:

OFERTA (qué ya existe o se está construyendo en la zona):
1. Buscar proyectos comparables activos y recientes dentro de un radio de 5 km del predio
2. Oferta activa en el corredor (en preventa, en obra, entregados en 24 meses)
3. Estrategia de pricing por fases (preventa, construcción, entrega)
4. Niveles de inventario y saturación del corredor

DEMANDA (quién compra y qué tan rápido):
5. Velocidad de absorción mensual del mercado
6. Perfil del comprador (NSE, rango de edad, financiamiento)
7. Segmentación de unidades que la demanda está absorbiendo (tipos, tamaños, participación de mercado)

CRUCE (lectura conjunta de oferta y demanda):
8. Precio promedio de venta por m² en la zona para este tipo de desarrollo y nivel de calidad
9. Plusvalía de la zona (últimos 3 años)
10. Producto recomendado — el que mejor cruza lo que la oferta actual no está cubriendo con lo que la demanda pide

PORTALES A CONSULTAR: Inmuebles24, Vivanuncios, Lamudi, CBRE/JLL reportes de mercado, BBVA Situación Inmobiliaria, CANADEVI.

OUTPUT — JSON EXACTO (sin texto adicional):
{
  "mercado": {
    "demanda": "Alta",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "8 unidades/mes",
    "proyectosActivos": "4 proyectos en radio 5 km",
    "precioPromedioZona": "$9,200/m²",
    "perfilNSE": "C+ · 28–45 años",
    "plusvalia": "+18% en 3 años",
    "inventario": "14 meses",
    "productoRecomendado": "Descripción del producto ideal (tipología, dimensiones, precio objetivo)",
    "comparables": [
      {
        "nombre": "Nombre real del proyecto comparable",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q1 2025",
        "precioM2": 38500,
        "avanceObra": "En obra",
        "unidades": 24,
        "tipologia": "2 rec · 85 m²"
      },
      {
        "nombre": "Segundo comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q3 2024",
        "precioM2": 36000,
        "avanceObra": "Entregado",
        "unidades": 18,
        "tipologia": "3 rec · 110 m²"
      },
      {
        "nombre": "Tercer comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q2 2025",
        "precioM2": 41000,
        "avanceObra": "Preventa",
        "unidades": 32,
        "tipologia": "2 rec · 80 m²"
      }
    ],
    "ofertaActiva": {
      "proyectosEnPreventa": 3,
      "proyectosEnObra": 2,
      "proyectosEntregados24m": 4,
      "unidadesDisponibles": 87,
      "rangoPrecios": "$32,000–$42,000/m²",
      "saturacion": "Descripción del nivel de saturación y tendencia"
    },
    "segmentacion": [
      {
        "tipo": "2 recámaras · 75–90 m²",
        "absorcionMensual": "5 unidades/mes",
        "precioM2": 39500,
        "participacion": "55%",
        "perfilComprador": "Perfil del comprador típico"
      },
      {
        "tipo": "3 recámaras · 100–130 m²",
        "absorcionMensual": "3 unidades/mes",
        "precioM2": 41000,
        "participacion": "35%",
        "perfilComprador": "Perfil del comprador típico"
      },
      {
        "tipo": "1 recámara / studio · 45–65 m²",
        "absorcionMensual": "1 unidad/mes",
        "precioM2": 43000,
        "participacion": "10%",
        "perfilComprador": "Inversionistas, renta corta"
      }
    ],
    "pricingFases": [
      { "fase": "Preventa", "precioM2": 35000, "descuento": "8%", "meta": "30% de unidades — activa crédito puente" },
      { "fase": "Construcción", "precioM2": 37500, "descuento": "3%", "meta": "50% de unidades" },
      { "fase": "Entrega", "precioM2": 38500, "descuento": "0%", "meta": "20% restante — precio lista" }
    ]
  },
  "fuentes": {
    "mercado": [
      { "nombre": "BBVA Situación Inmobiliaria México [trimestre/año]", "tipo": "Reporte sectorial" },
      { "nombre": "Fuente INEGI, CANADEVI, SHF u otra específica", "tipo": "Estadística oficial" },
      { "nombre": "Tercera fuente específica del mercado local", "tipo": "Reporte / portal" }
    ]
  }
}

REGLAS:
- comparables: 3 proyectos reales o representativos con dirección aproximada real y fecha trimestral (Q1-Q4 + año)
- avanceObra: exactamente "Entregado", "En obra" o "Preventa"
- precioM2 en comparables y segmentacion: número sin formato
- segmentacion: 2 o 3 segmentos, participacion suma 100%
- pricingFases: exactamente 3 fases, precioM2 es número sin formato
- ofertaActiva.proyectosEnPreventa, proyectosEnObra, proyectosEntregados24m: números enteros
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const parsed = await callClaudeJson(client, {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt + serperContext }],
    })
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Mercado error:', error)
    return NextResponse.json({ error: 'Error en Agente Mercado' }, { status: 500 })
  }
}
