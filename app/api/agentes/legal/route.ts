import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import { callClaudeJson } from '@/lib/llmJson'
import { calcularDensidad, type UnidadDensidad } from '@/lib/normativa/calculos'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

  const data = await req.json()

  const usoSueloLabels: Record<string, string> = {
    habitacional: 'Habitacional', comercial: 'Comercial', mixto: 'Mixto',
    industrial: 'Industrial', agricola: 'Agrícola', 'sin-uso': 'Sin uso definido',
  }
  const desarrolloLabels: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical', 'residencial-horizontal': 'Residencial horizontal',
    unifamiliar: 'Unifamiliar', comercial: 'Comercial', mixto: 'Uso mixto',
    industrial: 'Industrial / Nave', 'no-definido': 'Sin definir',
  }

  const tiposLabels = (data.tiposDesarrollo as string[] || [])
    .map((t: string) => t === 'otro' ? (data.tipoOtroTexto || 'Otro') : (desarrolloLabels[t] || t))
    .join(', ')

  // ── Grounding real vía Serper — mismo patrón que comparables-venta/route.ts ──────────────
  // Hallazgo de la inspección Fase 1 (PREFORMA_PROMPT_MAESTRO_AGENTE_NORMATIVA.md): este agente
  // no hacía NINGUNA búsqueda real, le pedía a Claude "recordar" COS/CUS/altura de su memoria de
  // entrenamiento y los presentaba como si fueran normativa verificada. Esto NO resuelve el
  // RuleEngine completo (lib/normativa/ruleEngine.ts sigue sin ninguna regla real cargada) — es
  // un parche mínimo: buscar en fuentes reales antes de preguntarle al modelo, y marcar
  // explícitamente cuándo no se encontró nada en vez de dejar que rellene con memoria.
  const snippets: string[] = []
  const fuentesConsultadas: { url: string; titulo: string }[] = []
  const serperKey = process.env.SERPER_API_KEY?.trim()
  if (serperKey) {
    const queries = [
      `reglamento zonificación usos del suelo "${data.ciudad}" "${data.estado}" COS CUS site:gob.mx`,
      `plan desarrollo urbano "${data.ciudad}" "${data.colonia}" zonificación densidad altura`,
    ]
    for (const q of queries) {
      try {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q, gl: 'mx', hl: 'es', num: 8 }),
        })
        if (!res.ok) continue
        const json = await res.json()
        ;(json.organic ?? []).forEach((r: any) => {
          snippets.push(`URL: ${r.link}\nTÍTULO: ${r.title}\nSNIPPET: ${r.snippet ?? ''}`)
          fuentesConsultadas.push({ url: r.link, titulo: r.title })
        })
      } catch { /* una búsqueda fallida no debe tumbar la ruta completa */ }
    }
  }
  const grounded = snippets.length > 0
  const groundingBlock = grounded
    ? `\n\nRESULTADOS DE BÚSQUEDA REAL (Google, vía Serper) — ÚNICA fuente permitida para respaldar COS/CUS/altura/retiros/factibilidades:\n${snippets.join('\n---\n')}\n\nUsa ÚNICAMENTE estos resultados para fundamentar valores normativos. Si no confirman un dato específico, NO lo completes de memoria — dilo explícitamente en la alerta correspondiente y baja nivelRiesgo/confianza de ese punto.`
    : `\n\nNO se encontraron resultados de búsqueda real para este municipio/colonia (SERPER_API_KEY ausente o sin resultados). NO tienes ninguna fuente verificada para COS/CUS/altura — cualquier valor que devuelvas es una ESTIMACIÓN basada en tu conocimiento general, no en una fuente consultada. Debes decirlo explícitamente.`

  const prompt = `Eres el Agente Legal y Normativo de SMT Developer.
Tu única tarea es analizar la normativa urbana y legal aplicable al predio: uso de suelo, Plan de Desarrollo Urbano, restricciones, factibilidades y alertas legales.
No calculas valores, costos ni mercado — solo normativa.

DATOS DEL PREDIO:
- Dirección: ${data.direccion}, ${data.colonia}, ${data.ciudad}, ${data.estado}
- Código postal: ${data.codigoPostal || 'No proporcionado'}
- Uso de suelo actual: ${usoSueloLabels[data.usoSuelo] || data.usoSuelo}
- Superficie: ${data.superficie} m²
- Tipo(s) de desarrollo deseado: ${tiposLabels}
${data.lat && data.lng ? `- Coordenadas: ${data.lat}, ${data.lng}` : ''}
${groundingBlock}

ANÁLISIS REQUERIDO:
1. Uso de suelo actual vs. permitido en el PDU vigente del municipio
2. Compatibilidad del desarrollo deseado con la zonificación
3. COS, CUS y altura máxima según normativa
4. Cajones de estacionamiento requeridos
5. Retiros reglamentarios (frente, laterales, fondo)
6. Factibilidades de servicios (agua/SADM, drenaje, CFE)
7. Restricciones ambientales (barrancas, ANP, riesgo SEDESOL/CENAPRED, aguas nacionales)
8. Régimen de condominio recomendado
9. Alertas legales específicas del predio y municipio (1 a 3 alertas reales)
10. Nivel de riesgo general

OUTPUT — JSON EXACTO (sin texto adicional):
{
  "fichaLegal": {
    "usoSueloActual": "Descripción del uso actual",
    "usoSueloPermitido": "Uso permitido según PDU vigente",
    "compatible": true,
    "densidadAutorizada": "Densidad máxima permitida (ej: 150 hab/ha · 48 unidades máx)",
    "densidadMaxUnidades": 48,
    "densidadValor": 100,
    "densidadUnidad": "m2_por_vivienda",
    "cos": "60%",
    "cosNum": 0.60,
    "cus": "2.4",
    "cusNum": 2.4,
    "altura": "12 niveles",
    "nivelesMax": 12,
    "cajones": "1.2 por unidad",
    "retiros": "Frente 3 m · Laterales 2 m · Fondo 3 m",
    "municipio": "Municipio exacto",
    "restriccion": "La restricción urbana más importante del predio",
    "factibilidades": {
      "agua": { "status": "Disponible", "nota": "Red municipal frente al predio — organismo operador local" },
      "drenaje": { "status": "Disponible", "nota": "Drenaje sanitario y pluvial disponibles en la vialidad" },
      "cfe": { "status": "Disponible", "nota": "Subestación en la zona — potencia disponible para el programa" }
    },
    "regimenCondominio": "Descripción del régimen de condominio recomendado y estado legal",
    "restriccionesAmbientales": "Restricciones por barrancas, pendiente, zonas de riesgo, ANP o servidumbres. Si no hay: 'Sin restricciones ambientales identificadas para esta zona'",
    "nivelRiesgo": "Bajo",
    "grounded": ${grounded},
    "alertasLegales": [
      {
        "tipo": "Tipo de alerta",
        "descripcion": "Descripción concreta del riesgo legal o normativo",
        "impacto": "Impacto en CUS, costos, plazos o viabilidad",
        "status": "amber"
      }
    ]
  },
  "fuentes": {
    "legal": [
      { "nombre": "Reglamento de Construcción de [municipio] [año]", "tipo": "Normativa municipal" },
      { "nombre": "Plan de Desarrollo Urbano Municipal [año]", "tipo": "Planeación urbana" },
      { "nombre": "Ley estatal o federal aplicable", "tipo": "Ley estatal / federal / DOF" },
      { "nombre": "Cuarta fuente específica", "tipo": "Tipo" }
    ]
  }
}

REGLAS:
- cosNum/cusNum/nivelesMax/densidadMaxUnidades son números sin formato, para que el resto del
  pipeline calcule el envolvente (COS × terreno, CUS × terreno × niveles) sin tener que parsear
  texto — deben coincidir exactamente con lo que dicen cos/cus/altura/densidadAutorizada
  (ej. si cos="60%", cosNum=0.60; si altura="12 niveles", nivelesMax=12)
- densidadValor/densidadUnidad: la densidad SIN CONVERTIR a unidades, tal como la expresa el
  instrumento normativo — densidadUnidad debe ser EXACTAMENTE "viviendas_por_ha" o
  "m2_por_vivienda" (nunca otro texto). Si el instrumento la expresa en una unidad distinta que
  no se puede convertir de forma válida a estas dos (ej. solo "hab/ha" sin tamaño de hogar
  conocido), omite ambos campos (null) en vez de forzar una conversión inventada — el servidor
  recalcula densidadMaxUnidades de forma independiente a partir de estos dos campos, así que si
  van vacíos no se verifica ese número
- fichaLegal.compatible: true si uso actual es compatible con permitido, false si requiere cambio
- factibilidades.status: exactamente "Disponible", "Con condicionante" o "No disponible"
- nivelRiesgo: "Bajo", "Medio" o "Alto" — si grounded=false, NUNCA "Bajo" (sin fuente verificada no
  hay base para decir que el riesgo es bajo; usa al menos "Medio")
- fichaLegal.grounded: usa EXACTAMENTE el valor ${grounded} que ya está en el JSON de arriba, no lo cambies
- alertasLegales: 1 a 3 alertas REALES y específicas; status "green", "amber" o "red". Si
  grounded=false, la PRIMERA alerta debe ser tipo "Fuente no verificada" explicando que COS/CUS/
  altura son estimación sin búsqueda real confirmada, status "amber" como mínimo
- fuentes.legal: si grounded=true, usa SOLO documentos que aparezcan en los resultados de
  búsqueda de arriba (nombre real + URL si la tienes); si grounded=false, cada entrada debe decir
  "(no verificado)" en el nombre en vez de aparentar ser una fuente consultada
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const parsed = await callClaudeJson(client, {
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    // No confiar en que el modelo copió bien el valor de `grounded` que ya le dimos, ni en que
    // liste las fuentes reales con exactitud — se sobrescribe con lo que de verdad devolvió
    // Serper (mismo patrón que costoTerreno/costoTerrenoM2 en el Agente Terreno).
    if (parsed.fichaLegal) {
      parsed.fichaLegal.grounded = grounded

      // Primer enganche real de lib/normativa/calculos.ts: el modelo hace su propia aritmética
      // para densidadMaxUnidades (§20 del documento pide EXACTAMENTE este cálculo: densidad ×
      // superficie, redondeando siempre hacia abajo) — un LLM puede fallar esa cuenta. Si mandó
      // el valor sin convertir (densidadValor/densidadUnidad) y la superficie del predio es un
      // número real, se recalcula con el motor puro y se sobrescribe densidadMaxUnidades con el
      // valor verificado en vez de confiar en la aritmética del modelo.
      const fl = parsed.fichaLegal
      const unidadValida = fl.densidadUnidad === 'viviendas_por_ha' || fl.densidadUnidad === 'm2_por_vivienda'
      if (typeof fl.densidadValor === 'number' && unidadValida && typeof data.superficie === 'number') {
        const r = calcularDensidad(fl.densidadValor, fl.densidadUnidad as UnidadDensidad, data.superficie)
        fl.densidadMaxUnidades = r.unidadesMax
        fl.densidadVerificada = true
      } else {
        fl.densidadVerificada = false
      }
    }
    parsed.fuentesConsultadas = fuentesConsultadas

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Legal error:', error)
    return NextResponse.json({ error: 'Error en Agente Legal' }, { status: 500 })
  }
}
