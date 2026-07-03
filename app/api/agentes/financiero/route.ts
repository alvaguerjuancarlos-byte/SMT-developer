import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const data = await req.json()

  const bandaLabels: Record<string, string> = {
    '1': 'Banda 1 — Económica ($7,000–$10,500/m²)',
    '2': 'Banda 2 — Media Estándar ($10,500–$16,000/m²)',
    '3': 'Banda 3 — Media Alta ($16,000–$24,000/m²)',
    '4': 'Banda 4 — Premium ($24,000–$45,000+/m²)',
  }
  const presupuestoLabels: Record<string, string> = {
    'menos-5m': 'Menos de $5 MDP', '5-15m': '$5–$15 MDP', '15-50m': '$15–$50 MDP',
    '50-150m': '$50–$150 MDP', 'mas-150m': 'Más de $150 MDP', 'por-definir': 'Por definir',
  }

  // Approved values (possibly overridden by user)
  const costoTerrenoM2 = data.costoTerrenoM2
  const costoTerreno = data.costoTerreno
  const construccionM2 = data.construccionM2
  const costoTotalConstruccion = data.costoTotalConstruccion
  const superficieConstruida = data.superficieConstruida

  const prompt = `Eres el Agente Financiero y Mastermind de SMT Developer.
Tu tarea es construir el modelo financiero completo del proyecto inmobiliario, usando los valores ya validados de terreno, construcción, normativa y mercado.
Los valores de terreno y construcción ya fueron calculados y aprobados — NO los recalcules, úsalos exactamente.

DATOS DEL PROYECTO:
- Nombre: ${data.nombreProyecto}
- Ciudad: ${data.ciudad}, ${data.estado}
- Superficie terreno: ${data.superficie} m²
- Superficie construida estimada: ${superficieConstruida} m²
- Tipo(s) de desarrollo: ${data.tiposLabels || data.tiposDesarrollo?.join(', ')}
- Banda de construcción: ${bandaLabels[data.bandaConstruccion] || 'Banda 2'}
- Presupuesto del inversionista: ${presupuestoLabels[data.presupuesto] || 'No especificado'}

VALORES APROBADOS — USA EXACTAMENTE ESTOS NÚMEROS:
- Costo terreno: $${Number(costoTerreno).toLocaleString('es-MX')} MXN (${costoTerrenoM2}/m²)
- Costo construcción: $${Number(costoTotalConstruccion).toLocaleString('es-MX')} MXN (${construccionM2}/m²)

NORMATIVA (Agente Legal):
- Uso de suelo compatible: ${data.fichaLegal?.compatible ? 'Sí' : 'Requiere cambio'}
- COS: ${data.fichaLegal?.cos || 'estimado 60%'}
- CUS: ${data.fichaLegal?.cus || 'estimado 1.2'}
- Altura: ${data.fichaLegal?.altura || 'por normativa'}
- Cajones: ${data.fichaLegal?.cajones || 'por normativa'}
- Nivel de riesgo: ${data.fichaLegal?.nivelRiesgo || 'Bajo'}
- Restricción principal: ${data.fichaLegal?.restriccion || 'Sin restricciones críticas'}

MERCADO (Agente Mercado):
- Precio venta promedio zona: ${data.mercado?.precioPromedioZona || 'por determinar'}
- Absorción: ${data.mercado?.absorcion || 'por determinar'}
- Demanda: ${data.mercado?.demanda || 'Media'}
- Precio preventa objetivo: $${data.mercado?.pricingFases?.[0]?.precioM2 || 'por determinar'}/m²
- Precio entrega objetivo: $${data.mercado?.pricingFases?.[2]?.precioM2 || 'por determinar'}/m²
- Segmentación: ${JSON.stringify(data.mercado?.segmentacion?.map((s: any) => s.tipo) || [])}

INSTRUCCIONES FINANCIERAS:
1. Calcula indirectos (15–18% de costoTotalConstruccion), honorarios de proyecto (8–10%), imprevistos (5%)
2. inversionTotal = costoTerreno + costoTotalConstruccion + indirectos + honorarios + imprevistos
3. Estima el número de unidades vendibles según superficieConstruida, COS/CUS y tipología.
   REGLA CRÍTICA: Si el tipo de desarrollo incluye "unifamiliar" o "Unifamiliar", el número de unidades es EXACTAMENTE 1 — una sola vivienda. No importa la superficie. NUNCA recomiendes 2 o más casas para un desarrollo unifamiliar.
4. ingresosProyectados = unidades × precio promedio ponderado de las fases de venta
5. utilidadBruta = ingresosProyectados − inversionTotal
6. margenBruto = (utilidadBruta / inversionTotal) × 100
7. TIR: calcula la tasa interna de retorno basándote en el flujo de caja proyectado (meses de inversión vs. recuperación)
8. Estructura de capital: propón equity/deuda óptimo según presupuesto del inversionista y perfil del proyecto
9. Preventa mínima: 30% de unidades para apertura de crédito puente
10. Flujo mensual: 9 hitos clave (no mes a mes, sino eventos relevantes: adquisición, permisos, preventa, crédito, inicio obra, avance 50%, fin obra, entregas, cierre)
11. Score de Resiliencia: 3 dimensiones (Solidez Financiera 40%, Riesgo Regulatorio 35%, Exposición Mercado 25%)
12. Stress test: 3 escenarios adversos (costos +15%, ventas -50%, precio -10%)
13. Punto de quiebre: máxima desviación sostenible en cada variable
14. Recomendación Mastermind: tipología óptima y justificación en 2-3 oraciones

OUTPUT — JSON EXACTO (sin texto adicional):
{
  "recomendacion": {
    "tipologia": "Tipología corta (ej: Residencial Vertical · 48 departamentos)",
    "descripcion": "2-3 oraciones: por qué esta tipología es óptima, normativa, demanda y métricas clave"
  },
  "financiero": {
    "costoTerreno": ${costoTerreno},
    "costoTerrenoM2": ${costoTerrenoM2},
    "construccionM2": ${construccionM2},
    "costoTotalConstruccion": ${costoTotalConstruccion},
    "indirectos": 0,
    "honorarios": 0,
    "imprevistos": 0,
    "inversionTotal": 0,
    "precioVentaM2": 0,
    "ingresosProyectados": 0,
    "utilidadBruta": 0,
    "margenBruto": 0,
    "tir": 0
  },
  "estructuraCapital": {
    "equity": 40,
    "deuda": 60,
    "montoEquity": 0,
    "montoDeuda": 0,
    "tipoDeuda": "Crédito puente bancario",
    "tasaDeuda": "TIIE + 3.5% anual (aprox. 14.5%)",
    "costoFinanciero": 0,
    "preventa": {
      "unidadesMinimas": 0,
      "porcentajeMinimo": "30%",
      "montoMinimo": 0,
      "condicion": "30% de unidades vendidas en preventa para apertura de crédito puente"
    },
    "tasaDescuento": "Nominal · Antes de ISR",
    "isrEstimado": 0,
    "utilidadNeta": 0,
    "descripcion": "Descripción de la estructura de capital propuesta"
  },
  "flujoMensual": [
    { "mes": 1, "fase": "Adquisición", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Escrituración y pago del terreno" },
    { "mes": 2, "fase": "Permisos", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Licencias, proyecto ejecutivo, estudio de suelo" },
    { "mes": 3, "fase": "Preventa", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Apertura preventa — unidades mínimas para crédito" },
    { "mes": 4, "fase": "Apertura crédito", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Dispersión crédito puente" },
    { "mes": 6, "fase": "Inicio obra", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Arranque construcción" },
    { "mes": 10, "fase": "Construcción avanzada", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "50% de avance" },
    { "mes": 14, "fase": "Construcción finaliza", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Permisos de habitabilidad" },
    { "mes": 16, "fase": "Entrega unidades", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Escrituración y liquidación" },
    { "mes": 18, "fase": "Cierre", "egresos": 0, "ingresos": 0, "acumulado": 0, "nota": "Liquidación crédito + últimas escrituras" }
  ],
  "score": {
    "total": 0,
    "solidezFinanciera": 0,
    "riesgoRegulatorio": 0,
    "exposicionMercado": 0
  },
  "metodologiaScore": {
    "descripcion": "El Score de Resiliencia es un índice compuesto de 0–100 que pondera tres dimensiones de riesgo del proyecto inmobiliario.",
    "dimensiones": [
      {
        "nombre": "Solidez Financiera",
        "peso": "40%",
        "score": 0,
        "factores": [
          { "factor": "TIR vs benchmark sector (18% mínimo)", "contribucion": "Descripción específica para este proyecto" },
          { "factor": "Margen bruto sobre inversión vs promedio sectorial (30%)", "contribucion": "Descripción específica" },
          { "factor": "Cobertura de servicio de deuda (equity/deuda)", "contribucion": "Descripción específica" }
        ],
        "interpretacion": "1-2 oraciones concretas sobre solidez financiera de este proyecto"
      },
      {
        "nombre": "Riesgo Regulatorio",
        "peso": "35%",
        "score": 0,
        "factores": [
          { "factor": "Compatibilidad uso de suelo", "contribucion": "Descripción específica" },
          { "factor": "Alertas legales y restricciones ambientales", "contribucion": "Descripción específica" },
          { "factor": "Complejidad del municipio y tiempos de permiso", "contribucion": "Descripción específica" }
        ],
        "interpretacion": "1-2 oraciones sobre riesgo regulatorio para este municipio"
      },
      {
        "nombre": "Exposición de Mercado",
        "peso": "25%",
        "score": 0,
        "factores": [
          { "factor": "Velocidad de absorción vs inventario", "contribucion": "Descripción específica" },
          { "factor": "Competencia activa en el corredor", "contribucion": "Descripción específica" },
          { "factor": "Plusvalía de la zona y tendencia NSE", "contribucion": "Descripción específica" }
        ],
        "interpretacion": "1-2 oraciones sobre exposición de mercado"
      }
    ]
  },
  "stressTest": [
    {
      "titulo": "Shock de Costos +15%",
      "escenario": "Descripción con cifras específicas de este proyecto",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Freno de Ventas −50%",
      "escenario": "Descripción con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Plazo: N → M meses · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Ajuste de Mercado −10% en Precio",
      "escenario": "Descripción con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "red"
    }
  ],
  "puntoQuiebre": {
    "desviacionMaxCostos": "+X%",
    "absorcionMinViable": "X%",
    "precioVentaMinimo": "$XX,XXX/m²",
    "resumen": "El proyecto mantiene viabilidad en el X% de los escenarios. La principal vulnerabilidad es..."
  }
}

REGLAS:
- financiero.costoTerreno DEBE ser exactamente ${costoTerreno} (no lo cambies)
- financiero.costoTerrenoM2 DEBE ser exactamente ${costoTerrenoM2} (no lo cambies)
- financiero.construccionM2 DEBE ser exactamente ${construccionM2} (no lo cambies)
- financiero.costoTotalConstruccion DEBE ser exactamente ${costoTotalConstruccion} (no lo cambies)
- UNIFAMILIAR: si tiposDesarrollo incluye "unifamiliar", recomendacion.tipologia DEBE decir "Casa Unifamiliar · 1 vivienda" (nunca más de 1). Los ingresos son el precio de venta de 1 sola vivienda.
- Todos los valores financieros son números sin formato (sin $, sin comas)
- tir y margenBruto son números decimales (ej: 22.4, no "22.4%")
- scores son números enteros 0–100
- score.total = promedio ponderado (solidez×0.4 + regulatorio×0.35 + mercado×0.25)
- stressTest status: "green" (TIR > 18%), "amber" (TIR 12–18%), "red" (TIR < 12%)
- flujoMensual: exactamente 9 hitos, todos los montos ajustados a los números reales del proyecto
- estructuraCapital: montoEquity + montoDeuda = inversionTotal; equity + deuda = 100
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    return NextResponse.json(JSON.parse(match[0]))
  } catch (error) {
    console.error('Agente Financiero error:', error)
    return NextResponse.json({ error: 'Error en Agente Financiero' }, { status: 500 })
  }
}
