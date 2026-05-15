import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const data = await req.json()

  const usoSueloLabels: Record<string, string> = {
    habitacional: 'Habitacional', comercial: 'Comercial', mixto: 'Mixto',
    industrial: 'Industrial', agricola: 'Agrícola', 'sin-uso': 'Sin uso definido',
  }
  const estadoLabels: Record<string, string> = {
    'baldio-limpio': 'Baldío limpio', 'baldio-escombro': 'Baldío con escombro',
    construccion: 'Construcción existente', vegetacion: 'Vegetación densa',
  }
  const presupuestoLabels: Record<string, string> = {
    'menos-5m': 'Menos de $5 MDP', '5-15m': '$5–$15 MDP', '15-50m': '$15–$50 MDP',
    '50-150m': '$50–$150 MDP', 'mas-150m': 'Más de $150 MDP', 'por-definir': 'Por definir con socios',
  }
  const desarrolloLabels: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical', 'residencial-horizontal': 'Residencial horizontal',
    comercial: 'Comercial', mixto: 'Uso mixto', industrial: 'Industrial / Nave', 'no-definido': 'Sin definir',
  }

  const prompt = `Eres el Agente Mastermind de SMT Developer, especialista en análisis de inversión inmobiliaria en México.

Con base en los siguientes datos del terreno, genera un análisis de inversión completo y profesional.

DATOS DEL TERRENO:
- Nombre del proyecto: ${data.nombreProyecto}
- Dirección: ${data.direccion}
- Colonia: ${data.colonia}
- Ciudad: ${data.ciudad}
- Superficie: ${data.superficie} m²
- Uso de suelo actual: ${usoSueloLabels[data.usoSuelo] || data.usoSuelo}
- Estado del terreno: ${estadoLabels[data.estadoTerreno] || data.estadoTerreno}
- Presupuesto del inversionista: ${presupuestoLabels[data.presupuesto] || data.presupuesto}
- Tipo(s) de desarrollo deseado: ${(data.tiposDesarrollo as string[]).map((t: string) => t === 'otro' ? (data.tipoOtroTexto || 'Otro') : (desarrolloLabels[t] || t)).join(', ')}
${data.lat && data.lng ? `- Coordenadas: ${data.lat}, ${data.lng}` : ''}

Genera el análisis en formato JSON con esta estructura exacta (sin texto adicional antes o después del JSON):

{
  "recomendacion": {
    "tipologia": "Tipología recomendada corta (ej: Residencial Vertical · 48 departamentos)",
    "descripcion": "Párrafo de 2-3 oraciones explicando por qué esta tipología es la óptima, incluyendo normativa, demanda y métricas clave"
  },
  "fichaLegal": {
    "usoSuelo": "Uso de suelo aprobado para el municipio (ej: Habitacional Plurifamiliar)",
    "cos": "COS permitido en % (ej: 60%)",
    "cus": "CUS (ej: 2.4)",
    "altura": "Altura máxima en niveles (ej: 12 niveles)",
    "cajones": "Cajones requeridos (ej: 1.2 por unidad)",
    "municipio": "Municipio exacto",
    "restriccion": "La restricción urbana más importante del predio"
  },
  "financiero": {
    "costoTerreno": 8500000,
    "costoTerrenoM2": 7083,
    "construccionM2": 16500,
    "costoTotalConstruccion": 23760000,
    "indirectos": 3240000,
    "honorarios": 1800000,
    "imprevistos": 1188000,
    "inversionTotal": 45200000,
    "precioVentaM2": 38500,
    "ingresosProyectados": 66780000,
    "utilidadBruta": 21580000,
    "margenBruto": 47.7,
    "tir": 22.4
  },
  "mercado": {
    "demanda": "Alta",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "8 unidades/mes",
    "proyectosActivos": "4 proyectos en radio 500 m",
    "precioPromedioZona": "$9,200/m²",
    "perfilNSE": "A/B · 28–45 años",
    "plusvalia": "+18%",
    "inventario": "14 meses",
    "productoRecomendado": "Descripción del producto ideal (tipología y dimensiones)"
  },
  "score": {
    "total": 78,
    "solidezFinanciera": 82,
    "riesgoRegulatorio": 75,
    "exposicionMercado": 71
  },
  "stressTest": [
    {
      "titulo": "Shock de Costos +15%",
      "escenario": "Descripción del escenario de shock de costos con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Freno de Ventas −50%",
      "escenario": "Descripción del escenario de freno de ventas con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Plazo: N → M meses · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Ajuste de Mercado −10% en Precio",
      "escenario": "Descripción del escenario de caída de precio con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "red"
    }
  ],
  "puntoQuiebre": {
    "desviacionMaxCostos": "+28.4%",
    "absorcionMinViable": "38%",
    "precioVentaMinimo": "$29,800/m²",
    "resumen": "El proyecto mantiene viabilidad en el X% de los escenarios simulados. La principal vulnerabilidad es..."
  },
  "fuentes": {
    "legal": [
      { "nombre": "Reglamento de Construcción de [municipio exacto]", "tipo": "Normativa municipal" },
      { "nombre": "Plan de Desarrollo Urbano Municipal [año]", "tipo": "Planeación urbana" },
      { "nombre": "Nombre de ley estatal o federal aplicable", "tipo": "Ley estatal / Ley federal / DOF" },
      { "nombre": "...", "tipo": "..." }
    ],
    "mercado": [
      { "nombre": "BBVA Situación Inmobiliaria México [trimestre/año]", "tipo": "Reporte sectorial" },
      { "nombre": "Nombre de fuente INEGI, CANADEVI, SHF u otra", "tipo": "Estadística oficial / Organismo" },
      { "nombre": "...", "tipo": "..." }
    ]
  }
}

REGLAS:
- Todos los valores financieros son números sin formato (sin $, sin comas)
- tir y margenBruto son números decimales (ej: 22.4, no "22.4%")
- Los scores son números enteros de 0 a 100
- status del stressTest: "green" (TIR > 18%), "amber" (TIR 12-18%), "red" (TIR < 12%)
- Ajusta TODOS los números según la superficie real del terreno y la ciudad indicada
- fuentes.legal: 4 documentos normativos reales y específicos del municipio/estado (reglamentos, planes, leyes, DOF) con año cuando aplique
- fuentes.mercado: 3 fuentes reales de análisis de mercado (BBVA, INEGI, CANADEVI, SHF, CONAVI u otras) con año cuando aplique
- En fuentes, usa nombres específicos reales — NO nombres genéricos con placeholders
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in /api/analizar:', error)
    return NextResponse.json({ error: 'Error al generar el análisis' }, { status: 500 })
  }
}
