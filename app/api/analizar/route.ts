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
    "usoSueloActual": "Uso de suelo actual del predio (ej: Baldío / Habitacional unifamiliar)",
    "usoSueloPermitido": "Uso de suelo permitido según PDU vigente (ej: Habitacional Plurifamiliar)",
    "compatible": true,
    "densidadAutorizada": "Densidad máxima permitida (ej: 150 hab/ha · 48 unidades máx)",
    "cos": "COS permitido en % (ej: 60%)",
    "cus": "CUS (ej: 2.4)",
    "altura": "Altura máxima en niveles (ej: 12 niveles)",
    "cajones": "Cajones requeridos (ej: 1.2 por unidad)",
    "retiros": "Retiros reglamentarios (ej: Frente 3 m · Laterales 2 m · Fondo 3 m)",
    "municipio": "Municipio exacto",
    "restriccion": "La restricción urbana más importante del predio",
    "factibilidades": {
      "agua": { "status": "Disponible", "nota": "Red municipal frente al predio — SADM / organismo local" },
      "drenaje": { "status": "Disponible", "nota": "Drenaje sanitario y pluvial disponibles en la vialidad" },
      "cfe": { "status": "Disponible", "nota": "Subestación a X m — potencia suficiente para el programa" }
    },
    "regimenCondominio": "Descripción del régimen de condominio recomendado y su estado (ej: Condominio vertical · Escrituración individual por unidad · Requiere constitución ante notario previo a preventa)",
    "restriccionesAmbientales": "Restricciones por barrancas, pendiente, zonas de riesgo SEDESOL/INEGI, ANP o servidumbres ambientales aplicables al predio",
    "nivelRiesgo": "Bajo",
    "alertasLegales": [
      {
        "tipo": "Tipo de alerta (ej: Restricción ambiental)",
        "descripcion": "Descripción concreta del riesgo legal o normativo",
        "impacto": "Impacto en el proyecto: CUS, costos, plazos, viabilidad",
        "status": "amber"
      }
    ]
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
  "estructuraCapital": {
    "equity": 40,
    "deuda": 60,
    "montoEquity": 18080000,
    "montoDeuda": 27120000,
    "tipoDeuda": "Crédito puente bancario",
    "tasaDeuda": "TIIE + 3.5% anual (aprox. 14.5%)",
    "costoFinanciero": 2800000,
    "preventa": {
      "unidadesMinimas": 14,
      "porcentajeMinimo": "30%",
      "montoMinimo": 16170000,
      "condicion": "30% de unidades vendidas en preventa para apertura de crédito puente bancario"
    },
    "tasaDescuento": "Nominal · Antes de ISR",
    "isrEstimado": 3870000,
    "utilidadNeta": 17710000,
    "descripcion": "El proyecto se estructura con 40% capital propio y 60% crédito puente. La TIR del 22.4% es nominal antes de ISR. Impuesto estimado sobre utilidad: 30% ISR de persona moral."
  },
  "flujoMensual": [
    { "mes": 1, "fase": "Adquisición", "egresos": 8500000, "ingresos": 0, "acumulado": -8500000, "nota": "Escrituración y pago del terreno" },
    { "mes": 2, "fase": "Permisos", "egresos": 1200000, "ingresos": 0, "acumulado": -9700000, "nota": "Gestión licencias, proyecto ejecutivo, estudio de suelo" },
    { "mes": 3, "fase": "Preventa", "egresos": 800000, "ingresos": 5390000, "acumulado": -5110000, "nota": "Apertura preventa — 14 unidades mínimas para crédito puente" },
    { "mes": 4, "fase": "Apertura crédito", "egresos": 0, "ingresos": 27120000, "acumulado": 22010000, "nota": "Dispersión crédito puente — preventa mínima cumplida" },
    { "mes": 6, "fase": "Inicio obra", "egresos": 7920000, "ingresos": 3465000, "acumulado": 17555000, "nota": "Arranque de construcción — ventas en obra continúan" },
    { "mes": 10, "fase": "Construcción avanzada", "egresos": 6930000, "ingresos": 6930000, "acumulado": 17555000, "nota": "50% de avance — absorción en ritmo de crucero" },
    { "mes": 14, "fase": "Construcción finaliza", "egresos": 4950000, "ingresos": 5390000, "acumulado": 17995000, "nota": "Entrega de permisos de habitabilidad" },
    { "mes": 16, "fase": "Entrega unidades", "egresos": 1500000, "ingresos": 13475000, "acumulado": 29970000, "nota": "Escrituración y liquidación — pago crédito puente" },
    { "mes": 18, "fase": "Cierre", "egresos": 27120000, "ingresos": 5390000, "acumulado": 8240000, "nota": "Liquidación crédito puente + últimas escrituraciones" }
  ],
  "mercado": {
    "demanda": "Alta",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "8 unidades/mes",
    "proyectosActivos": "4 proyectos en radio 500 m",
    "precioPromedioZona": "$9,200/m²",
    "perfilNSE": "A/B · 28–45 años",
    "plusvalia": "+18%",
    "inventario": "14 meses",
    "productoRecomendado": "Descripción del producto ideal (tipología y dimensiones)",
    "comparables": [
      {
        "nombre": "Nombre real del proyecto comparable",
        "direccion": "Dirección aproximada real en la misma zona",
        "fechaReferencia": "Q1 2024",
        "precioM2": 38500,
        "avanceObra": "Entregado | En obra | Preventa",
        "unidades": 24,
        "tipologia": "2 rec · 85 m²"
      },
      {
        "nombre": "Segundo comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q3 2023",
        "precioM2": 36000,
        "avanceObra": "En obra",
        "unidades": 18,
        "tipologia": "3 rec · 110 m²"
      },
      {
        "nombre": "Tercer comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q2 2024",
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
      "saturacion": "Descripción del nivel de saturación del corredor y tendencia"
    },
    "segmentacion": [
      {
        "tipo": "2 recámaras · 75–90 m²",
        "absorcionMensual": "5 unidades/mes",
        "precioM2": 39500,
        "participacion": "55%",
        "perfilComprador": "Perfil del comprador típico de este segmento"
      },
      {
        "tipo": "3 recámaras · 100–130 m²",
        "absorcionMensual": "3 unidades/mes",
        "precioM2": 41000,
        "participacion": "35%",
        "perfilComprador": "Perfil del comprador típico de este segmento"
      },
      {
        "tipo": "1 recámara / studio · 45–65 m²",
        "absorcionMensual": "1 unidad/mes",
        "precioM2": 43000,
        "participacion": "10%",
        "perfilComprador": "Inversionistas, renta"
      }
    ],
    "pricingFases": [
      {
        "fase": "Preventa",
        "precioM2": 35000,
        "descuento": "8%",
        "meta": "30% de unidades — activa crédito puente"
      },
      {
        "fase": "Construcción",
        "precioM2": 37500,
        "descuento": "3%",
        "meta": "50% de unidades"
      },
      {
        "fase": "Entrega",
        "precioM2": 38500,
        "descuento": "0%",
        "meta": "20% restante — precio lista"
      }
    ]
  },
  "score": {
    "total": 78,
    "solidezFinanciera": 82,
    "riesgoRegulatorio": 75,
    "exposicionMercado": 71
  },
  "metodologiaScore": {
    "descripcion": "El Score de Resiliencia es un índice compuesto de 0–100 que pondera tres dimensiones de riesgo del proyecto inmobiliario. Evalúa la capacidad del proyecto de mantener viabilidad ante desviaciones adversas en costos, mercado y entorno regulatorio.",
    "dimensiones": [
      {
        "nombre": "Solidez Financiera",
        "peso": "40%",
        "score": 82,
        "factores": [
          { "factor": "TIR vs benchmark sector (18% mínimo)", "contribucion": "Describe si supera o está por debajo del umbral y en cuánto" },
          { "factor": "Margen bruto sobre inversión vs promedio sectorial (30%)", "contribucion": "Describe la diferencia con el promedio" },
          { "factor": "Cobertura de servicio de deuda (relación equity/deuda)", "contribucion": "Describe si la estructura es conservadora, estándar o agresiva" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando el score de esta dimensión para este proyecto específico"
      },
      {
        "nombre": "Riesgo Regulatorio",
        "peso": "35%",
        "score": 75,
        "factores": [
          { "factor": "Compatibilidad uso de suelo actual vs permitido", "contribucion": "Describe el impacto de la compatibilidad o incompatibilidad" },
          { "factor": "Alertas legales y restricciones ambientales", "contribucion": "Describe el nivel de riesgo acumulado de las alertas" },
          { "factor": "Complejidad del municipio y tiempos de permiso estimados", "contribucion": "Describe si el municipio es ágil o complejo para permisos" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando el score regulatorio para este municipio y predio"
      },
      {
        "nombre": "Exposición de Mercado",
        "peso": "25%",
        "score": 71,
        "factores": [
          { "factor": "Velocidad de absorción vs inventario disponible", "contribucion": "Describe si la absorción cubre el inventario en tiempo razonable" },
          { "factor": "Nivel de competencia activa en el corredor", "contribucion": "Describe si hay saturación o espacio para el proyecto" },
          { "factor": "Plusvalía de la zona y tendencia de demanda NSE objetivo", "contribucion": "Describe la solidez de la demanda subyacente" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando la exposición de mercado para este proyecto"
      }
    ]
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
- mercado.comparables: 3 proyectos reales o representativos de la zona con dirección aproximada real, fecha de referencia trimestral (Q1-Q4 + año), precio/m2 numérico sin formato, avanceObra debe ser exactamente "Entregado", "En obra" o "Preventa"
- mercado.ofertaActiva: datos coherentes con la zona y ciudad indicada — proyectosEnPreventa, proyectosEnObra y proyectosEntregados24m son números enteros; rangoPrecios en formato "$X,XXX–$X,XXX/m²"
- mercado.segmentacion: 2 o 3 segmentos según el mercado local — precioM2 es número sin formato; participacion suma 100%
- mercado.pricingFases: exactamente 3 fases (Preventa, Construcción, Entrega) — precioM2 es número sin formato, descuento en formato "X%"
- fichaLegal.compatible: true si el uso actual es compatible con el permitido, false si requiere cambio de uso
- fichaLegal.factibilidades: status debe ser exactamente "Disponible", "Con condicionante" o "No disponible"; nota con detalle del organismo y condición real
- fichaLegal.nivelRiesgo: "Bajo" (sin restricciones mayores), "Medio" (restricciones manejables) o "Alto" (restricciones críticas que pueden inviabilizar o encarecer significativamente)
- fichaLegal.alertasLegales: 1 a 3 alertas reales y específicas para el predio/municipio — status "green" (sin impacto), "amber" (manejable con gestión), "red" (crítico, puede inviabilizar)
- fichaLegal.restriccionesAmbientales: si no hay restricciones conocidas, indica "Sin restricciones ambientales identificadas para esta zona"
- estructuraCapital: montoEquity y montoDeuda son números (sin $); equity + deuda = 100; costoFinanciero, isrEstimado y utilidadNeta son números; tasaDeuda con formato "TIIE + X% anual (aprox. XX%)"
- estructuraCapital.preventa.unidadesMinimas es número entero; montoMinimo es número; porcentajeMinimo en formato "XX%"
- flujoMensual: exactamente 9 hitos clave del proyecto (no todos los meses) — egresos e ingresos son números sin formato; acumulado refleja el saldo neto real acumulado en ese mes; ajusta TODOS los montos a la superficie y mercado del terreno analizado
- metodologiaScore.dimensiones: exactamente 3 dimensiones (Solidez Financiera 40%, Riesgo Regulatorio 35%, Exposición de Mercado 25%); score de cada dimensión = el mismo valor del objeto score; factores: exactamente 3 por dimensión; contribucion debe ser específica para este proyecto (no genérica); interpretacion: 1-2 oraciones concretas
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
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
