import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const data = await req.json()

  const tipoDev: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical (torre/edificio)',
    'residencial-horizontal': 'Residencial horizontal (casas/fraccionamiento)',
    comercial: 'Comercial (local/plaza)',
    mixto: 'Uso mixto (residencial + comercial)',
    industrial: 'Industrial / Nave',
    'no-definido': 'Sin definir (Scout sugiere el mejor uso)',
  }
  const superficie: Record<string, string> = {
    'menos-500': 'Menos de 500 m²', '500-1000': '500–1,000 m²',
    '1000-3000': '1,000–3,000 m²', '3000-10000': '3,000–10,000 m²',
    'mas-10000': 'Más de 10,000 m²', flexible: 'Flexible',
  }
  const presupuesto: Record<string, string> = {
    'menos-5m': 'Menos de $5 MDP', '5-15m': '$5–$15 MDP', '15-50m': '$15–$50 MDP',
    '50-150m': '$50–$150 MDP', 'mas-150m': 'Más de $150 MDP', 'por-definir': 'Por definir',
  }
  const prioridadLabel: Record<string, string> = {
    rentabilidad: 'Máxima rentabilidad', velocidad: 'Velocidad de venta',
    riesgo: 'Menor riesgo', plusvalia: 'Zona con plusvalía',
  }

  const zonaGeo = data.zonaGeo as { lat: number; lng: number; nombre: string; municipio: string } | null

  const prompt = `Eres el Agente Scout de SMT Developer, especialista en prospección de terrenos en el mercado inmobiliario mexicano.

El cliente busca un terreno con los siguientes criterios:
- Proyecto: ${data.nombreProyecto}
- Estado: ${data.estado || 'No especificado'}
- Ciudad / Municipio: ${data.ciudad}
- Zona/colonia requerida: ${data.zona ? `OBLIGATORIO — los 3 candidatos deben estar dentro de "${data.zona}", ${data.ciudad}, ${data.estado}` : 'Sin restricción de zona (explorar toda la ciudad)'}
${zonaGeo ? `- Coordenadas GPS verificadas: lat ${zonaGeo.lat}, lng ${zonaGeo.lng} — CRÍTICO: los 3 candidatos deben estar dentro de un radio de 1.5 km de este punto` : ''}
- Tipo de desarrollo: ${data.tipoDev === 'otro' ? (data.tipoOtroTexto || 'Otro') : (tipoDev[data.tipoDev] || data.tipoDev)}
- Superficie requerida: ${superficie[data.superficie] || data.superficie}
- Presupuesto de adquisición: ${presupuesto[data.presupuesto] || data.presupuesto}
- Prioridades del inversionista: ${(data.prioridades as string[]).map((p: string) => prioridadLabel[p] || p).join(', ')}
${data.notas ? `- Contexto adicional: ${data.notas}` : ''}

Genera 3 candidatos de terreno reales y distintos${data.zona ? ` DENTRO de la zona "${data.zona}" en ${data.ciudad}, ${data.estado}` : ` en ${data.ciudad}, ${data.estado}`} que cumplan los criterios. Retorna ÚNICAMENTE este JSON (sin texto extra, sin markdown):

{
  "candidatos": [
    {
      "id": 1,
      "nombre": "Nombre descriptivo del terreno",
      "zona": "Colonia o zona específica",
      "ubicacion": "Dirección aproximada con nombre de calle real",
      "lat": 25.6714,
      "lng": -100.3094,
      "precio": "$X,XXX,XXX",
      "superficie": "X,XXX m²",
      "preciom2": "$X,XXX/m²",
      "uso": "Uso de suelo actual",
      "mercadoColor": "green",
      "score": 88,
      "tir": "22.4%",
      "pros": [
        "Fortaleza concreta 1",
        "Fortaleza concreta 2",
        "Fortaleza concreta 3"
      ],
      "contras": [
        "Riesgo específico 1",
        "Riesgo específico 2"
      ],
      "recomendado": true,
      "legal": {
        "usoSuelo": "Uso de suelo aprobado",
        "cos": "X%",
        "cus": "X.X",
        "altura": "X niveles",
        "cajones": "X.X por unidad",
        "restriccion": "Restricción principal del predio",
        "municipio": "Municipio exacto"
      },
      "mercado": {
        "label": "Demanda Alta",
        "precioZona": "$X,XXX/m²",
        "absorcion": "X unidades/mes",
        "competencia": "X proyectos en radio 500 m",
        "perfilNSE": "A/B · XX–XX años",
        "plusvalia": "+X% últimos 3 años",
        "producto": "Tipología de producto recomendada"
      }
    },
    {
      "id": 2,
      "nombre": "...",
      "zona": "...",
      "ubicacion": "...",
      "lat": 25.6800,
      "lng": -100.3200,
      "precio": "$X,XXX,XXX",
      "superficie": "X,XXX m²",
      "preciom2": "$X,XXX/m²",
      "uso": "...",
      "mercadoColor": "blue",
      "score": 74,
      "tir": "16.8%",
      "pros": ["...", "...", "..."],
      "contras": ["...", "..."],
      "recomendado": false,
      "legal": { "usoSuelo": "...", "cos": "...", "cus": "...", "altura": "...", "cajones": "...", "restriccion": "...", "municipio": "..." },
      "mercado": { "label": "...", "precioZona": "...", "absorcion": "...", "competencia": "...", "perfilNSE": "...", "plusvalia": "...", "producto": "..." }
    },
    {
      "id": 3,
      "nombre": "...",
      "zona": "...",
      "ubicacion": "...",
      "lat": 25.6600,
      "lng": -100.3500,
      "precio": "$X,XXX,XXX",
      "superficie": "X,XXX m²",
      "preciom2": "$X,XXX/m²",
      "uso": "...",
      "mercadoColor": "purple",
      "score": 79,
      "tir": "19.1%",
      "pros": ["...", "...", "..."],
      "contras": ["...", "..."],
      "recomendado": false,
      "legal": { "usoSuelo": "...", "cos": "...", "cus": "...", "altura": "...", "cajones": "...", "restriccion": "...", "municipio": "..." },
      "mercado": { "label": "...", "precioZona": "...", "absorcion": "...", "competencia": "...", "perfilNSE": "...", "plusvalia": "...", "producto": "..." }
    }
  ],
  "fuentes": {
    "scout": [
      { "nombre": "Nombre exacto del portal o base de datos consultada", "tipo": "Portal inmobiliario / Catastro / Registro público" },
      { "nombre": "...", "tipo": "..." },
      { "nombre": "...", "tipo": "..." }
    ],
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
  },
  "recomendacion": {
    "candidatoId": 1,
    "scoreResiliencia": 81,
    "texto": "Justificación en 3-4 oraciones de por qué este terreno lidera el comparativo, mencionando sus ventajas en normativa, mercado y rentabilidad.",
    "stressTest": [
      {
        "titulo": "Shock de Costos +15%",
        "escenario": "Descripción concreta del escenario adverso de costos.",
        "impacto": "TIR: X% → Y% · Margen: X% → Y% · Proyecto sigue viable",
        "status": "amber"
      },
      {
        "titulo": "Freno de Ventas −50%",
        "escenario": "Descripción concreta del escenario de freno de ventas.",
        "impacto": "TIR: X% → Y% · Plazo: X → Y meses",
        "status": "amber"
      },
      {
        "titulo": "Ajuste de Precio −10%",
        "escenario": "Descripción concreta del escenario de caída de precios.",
        "impacto": "TIR: X% → Y% · Margen: X% → Y% · Al límite — revisar supuestos",
        "status": "red"
      }
    ],
    "financiero": {
      "costoTerreno": "$X,XXX,XXX MXN",
      "notaTerreno": "$X,XXX/m² · X,XXX m²",
      "costoConstruccion": "$XX,XXX,XXX MXN",
      "notaConstruccion": "Acabados según tipología · clase objetivo",
      "indirectos": "$X,XXX,XXX MXN",
      "notaIndirectos": "8% sobre costo de obra",
      "honorarios": "$X,XXX,XXX MXN",
      "notaHonorarios": "4.5% sobre costo de obra",
      "permisos": "$XXX,XXX MXN",
      "notaPermisos": "Municipio correspondiente",
      "imprevistos": "$X,XXX,XXX MXN",
      "notaImprevistos": "5% reserva de contingencia",
      "inversion": "$XX,XXX,XXX MXN",
      "precioVenta": "$XX,XXX/m²",
      "notaPrecioVenta": "Mercado zona · NSE objetivo",
      "ingresos": "$XX,XXX,XXX MXN",
      "notaIngresos": "X,XXX m² vendibles",
      "utilidad": "$XX,XXX,XXX MXN",
      "margen": "XX.X%",
      "horizonte": "XX meses"
    }
  }
}

REGLAS:
${zonaGeo ? `- CRÍTICO: los 3 candidatos deben estar dentro de un radio MÁXIMO de 1.5 km del punto GPS (lat: ${zonaGeo.lat}, lng: ${zonaGeo.lng}) — zona "${data.zona || zonaGeo.nombre}", ${data.ciudad}` : data.zona ? `- CRÍTICO: los 3 candidatos deben estar físicamente ubicados dentro de "${data.zona}", ${data.ciudad} — NO en otras colonias o municipios` : `- Los 3 candidatos deben estar dentro de ${data.ciudad}`}
- Los candidatos deben tener características distintas entre sí (precio, superficie, perfil de mercado)
- mercadoColor: candidato 1 = "green", candidato 2 = "blue", candidato 3 = "purple"
- lat/lng deben ser coordenadas GPS reales y precisas ${zonaGeo ? `dentro de 1.5 km de (${zonaGeo.lat}, ${zonaGeo.lng})` : data.zona ? `dentro de "${data.zona}"` : `dentro de ${data.ciudad}`}
- Diferencia los candidatos en precio, superficie y perfil de mercado
- score: 0-100, el candidato con recomendado=true debe tener el mayor score
- tir: TIR anual estimada realista según tipo de desarrollo, superficie y precio
- pros: exactamente 3 fortalezas concretas y específicas por candidato
- contras: exactamente 2 riesgos específicos por candidato
- recomendado=true en exactamente un candidato (el de mayor score)
- stressTest: 3 escenarios con status "amber", "amber", "red" específicos para el terreno recomendado
- financiero: cifras realistas para el terreno recomendado considerando el tipo de desarrollo solicitado
- fuentes.scout: 3 portales o bases de datos reales usados para identificar los terrenos (ej. Inmuebles24, Lamudi, Catastro, DENUE)
- fuentes.legal: 4 documentos normativos reales y específicos del municipio/estado (reglamentos, planes, leyes, DOF)
- fuentes.mercado: 3 fuentes reales de análisis de mercado (BBVA, INEGI, CANADEVI, SHF, CONAVI u otras)
- En fuentes, usa nombres específicos con año cuando aplique — NO nombres genéricos
- Retorna ÚNICAMENTE el JSON, sin texto adicional`

  const callClaude = async () => {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    return JSON.parse(match[0])
  }

  try {
    let result
    try {
      result = await callClaude()
    } catch (firstErr) {
      console.warn('Scout first attempt failed, retrying:', firstErr instanceof Error ? firstErr.message : firstErr)
      result = await callClaude()
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in /api/scout:', error)
    return NextResponse.json({ error: 'Error al buscar candidatos' }, { status: 500 })
  }
}
