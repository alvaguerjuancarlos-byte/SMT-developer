import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
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

ANÁLISIS REQUERIDO:
1. Buscar proyectos comparables activos y recientes (radio 500 m primero, ampliar a 1 km si hay menos de 3)
2. Precio promedio de venta por m² en la zona para este tipo de desarrollo y nivel de calidad
3. Velocidad de absorción mensual del mercado
4. Perfil del comprador (NSE, rango de edad, financiamiento)
5. Segmentación de unidades (tipos, tamaños, participación de mercado)
6. Oferta activa en el corredor (en preventa, en obra, entregados en 24 meses)
7. Estrategia de pricing por fases (preventa, construcción, entrega)
8. Niveles de inventario y saturación del corredor
9. Plusvalía de la zona (últimos 3 años)

PORTALES A CONSULTAR: Inmuebles24, Vivanuncios, Lamudi, CBRE/JLL reportes de mercado, BBVA Situación Inmobiliaria, CANADEVI.

OUTPUT — JSON EXACTO (sin texto adicional):
{
  "mercado": {
    "demanda": "Alta",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "8 unidades/mes",
    "proyectosActivos": "4 proyectos en radio 500 m",
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
    console.error('Agente Mercado error:', error)
    return NextResponse.json({ error: 'Error en Agente Mercado' }, { status: 500 })
  }
}
