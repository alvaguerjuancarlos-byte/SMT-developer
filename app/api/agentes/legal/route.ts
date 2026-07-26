import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
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
- fichaLegal.compatible: true si uso actual es compatible con permitido, false si requiere cambio
- factibilidades.status: exactamente "Disponible", "Con condicionante" o "No disponible"
- nivelRiesgo: "Bajo", "Medio" o "Alto"
- alertasLegales: 1 a 3 alertas REALES y específicas; status "green", "amber" o "red"
- fuentes.legal: 4 documentos normativos reales con año cuando aplique
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    return NextResponse.json(JSON.parse(match[0]))
  } catch (error) {
    console.error('Agente Legal error:', error)
    return NextResponse.json({ error: 'Error en Agente Legal' }, { status: 500 })
  }
}
