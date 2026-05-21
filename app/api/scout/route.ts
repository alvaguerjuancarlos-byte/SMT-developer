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
      "pros": ["Fortaleza concreta 1", "Fortaleza concreta 2", "Fortaleza concreta 3"],
      "contras": ["Riesgo específico 1", "Riesgo específico 2"],
      "recomendado": true,
      "legal": {
        "usoSueloActual": "Uso de suelo actual registrado del predio",
        "usoSueloPermitido": "Uso de suelo autorizado por normativa municipal",
        "compatible": true,
        "cos": "60%",
        "cus": "2.4",
        "altura": "12 niveles",
        "cajones": "1.2 por unidad",
        "restriccion": "Restricción principal del predio",
        "municipio": "Municipio exacto",
        "factibilidades": {
          "agua": { "status": "Disponible", "nota": "Red municipal disponible en calle frente al predio" },
          "drenaje": { "status": "Con condicionante", "nota": "Requiere ampliación de red en 60 m lineales" },
          "cfe": { "status": "Disponible", "nota": "Subestación con capacidad suficiente a 200 m" }
        },
        "nivelRiesgo": "Bajo",
        "alertasLegales": [
          { "tipo": "Restricción", "descripcion": "Descripción concreta del riesgo legal más relevante", "impacto": "Impacto en costo o plazo del proyecto", "status": "amber" }
        ]
      },
      "mercado": {
        "label": "Demanda Alta",
        "precioZona": "$X,XXX/m²",
        "absorcion": "X unidades/mes",
        "competencia": "X proyectos en radio 500 m",
        "perfilNSE": "A/B · XX–XX años",
        "plusvalia": "+X% últimos 3 años",
        "producto": "Tipología de producto recomendada",
        "comparables": [
          { "nombre": "Nombre real del proyecto competidor 1", "precioM2": 38500, "avanceObra": "En preventa", "absorcion": "7 u/mes" },
          { "nombre": "Nombre real del proyecto competidor 2", "precioM2": 41000, "avanceObra": "80% construido", "absorcion": "5 u/mes" }
        ],
        "segmentacion": [
          { "tipo": "2 rec 80–100 m²", "participacion": "60%", "precioM2": 38000, "absorcionMensual": "5 u/mes" },
          { "tipo": "3 rec 110–130 m²", "participacion": "40%", "precioM2": 41500, "absorcionMensual": "3 u/mes" }
        ]
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
      "legal": {
        "usoSueloActual": "...",
        "usoSueloPermitido": "...",
        "compatible": false,
        "cos": "...", "cus": "...", "altura": "...", "cajones": "...", "restriccion": "...", "municipio": "...",
        "factibilidades": {
          "agua": { "status": "Disponible", "nota": "..." },
          "drenaje": { "status": "Disponible", "nota": "..." },
          "cfe": { "status": "Con condicionante", "nota": "..." }
        },
        "nivelRiesgo": "Medio",
        "alertasLegales": [
          { "tipo": "Uso de suelo", "descripcion": "...", "impacto": "...", "status": "red" }
        ]
      },
      "mercado": {
        "label": "...", "precioZona": "...", "absorcion": "...", "competencia": "...", "perfilNSE": "...", "plusvalia": "...", "producto": "...",
        "comparables": [
          { "nombre": "...", "precioM2": 22000, "avanceObra": "...", "absorcion": "..." },
          { "nombre": "...", "precioM2": 24000, "avanceObra": "...", "absorcion": "..." }
        ],
        "segmentacion": [
          { "tipo": "...", "participacion": "...", "precioM2": 22000, "absorcionMensual": "..." },
          { "tipo": "...", "participacion": "...", "precioM2": 24000, "absorcionMensual": "..." }
        ]
      }
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
      "legal": {
        "usoSueloActual": "...",
        "usoSueloPermitido": "...",
        "compatible": true,
        "cos": "...", "cus": "...", "altura": "...", "cajones": "...", "restriccion": "...", "municipio": "...",
        "factibilidades": {
          "agua": { "status": "Disponible", "nota": "..." },
          "drenaje": { "status": "Disponible", "nota": "..." },
          "cfe": { "status": "Disponible", "nota": "..." }
        },
        "nivelRiesgo": "Bajo",
        "alertasLegales": [
          { "tipo": "Normativa", "descripcion": "...", "impacto": "...", "status": "amber" }
        ]
      },
      "mercado": {
        "label": "...", "precioZona": "...", "absorcion": "...", "competencia": "...", "perfilNSE": "...", "plusvalia": "...", "producto": "...",
        "comparables": [
          { "nombre": "...", "precioM2": 35000, "avanceObra": "...", "absorcion": "..." },
          { "nombre": "...", "precioM2": 37000, "avanceObra": "...", "absorcion": "..." }
        ],
        "segmentacion": [
          { "tipo": "...", "participacion": "...", "precioM2": 35000, "absorcionMensual": "..." },
          { "tipo": "...", "participacion": "...", "precioM2": 37000, "absorcionMensual": "..." }
        ]
      }
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
      { "titulo": "Shock de Costos +15%", "escenario": "Descripción concreta del escenario adverso de costos.", "impacto": "TIR: X% → Y% · Margen: X% → Y% · Proyecto sigue viable", "status": "amber" },
      { "titulo": "Freno de Ventas −50%", "escenario": "Descripción concreta del escenario de freno de ventas.", "impacto": "TIR: X% → Y% · Plazo: X → Y meses", "status": "amber" },
      { "titulo": "Ajuste de Precio −10%", "escenario": "Descripción concreta del escenario de caída de precios.", "impacto": "TIR: X% → Y% · Margen: X% → Y% · Al límite — revisar supuestos", "status": "red" }
    ],
    "financiero": {
      "costoTerreno": "$X,XXX,XXX MXN", "notaTerreno": "$X,XXX/m² · X,XXX m²",
      "costoConstruccion": "$XX,XXX,XXX MXN", "notaConstruccion": "Acabados según tipología · clase objetivo",
      "indirectos": "$X,XXX,XXX MXN", "notaIndirectos": "8% sobre costo de obra",
      "honorarios": "$X,XXX,XXX MXN", "notaHonorarios": "4.5% sobre costo de obra",
      "permisos": "$XXX,XXX MXN", "notaPermisos": "Municipio correspondiente",
      "imprevistos": "$X,XXX,XXX MXN", "notaImprevistos": "5% reserva de contingencia",
      "inversion": "$XX,XXX,XXX MXN",
      "precioVenta": "$XX,XXX/m²", "notaPrecioVenta": "Mercado zona · NSE objetivo",
      "ingresos": "$XX,XXX,XXX MXN", "notaIngresos": "X,XXX m² vendibles",
      "utilidad": "$XX,XXX,XXX MXN", "margen": "XX.X%", "horizonte": "XX meses"
    },
    "estructuraCapital": {
      "equity": 35,
      "deuda": 65,
      "montoEquity": 15820000,
      "montoDeuda": 29380000,
      "tipoDeuda": "Crédito puente bancario",
      "tasaDeuda": "TIIE + 3.5%",
      "costoFinanciero": 2938000,
      "preventa": {
        "unidadesMinimas": 12,
        "porcentajeMinimo": "30%",
        "montoMinimo": 18000000,
        "condicion": "Condición mínima de preventa para activar el crédito puente"
      },
      "tasaDescuento": "18%",
      "isrEstimado": 3244500,
      "utilidadNeta": 12921000,
      "descripcion": "Justificación de la mezcla financiera para el candidato recomendado"
    },
    "flujoMensual": [
      { "mes": 1, "fase": "Preventa", "egresos": 2000000, "ingresos": 5000000, "acumulado": 3000000, "nota": "Apertura preventas — X unidades" },
      { "mes": 2, "fase": "Preventa", "egresos": 3000000, "ingresos": 8000000, "acumulado": 8000000, "nota": "Cierre preventas mínimas" },
      { "mes": 3, "fase": "Inicio obra", "egresos": 8000000, "ingresos": 4000000, "acumulado": 4000000, "nota": "Activación crédito puente" },
      { "mes": 4, "fase": "Construcción", "egresos": 9000000, "ingresos": 6000000, "acumulado": 1000000, "nota": "Avance estructura" },
      { "mes": 5, "fase": "Construcción", "egresos": 7000000, "ingresos": 10000000, "acumulado": 4000000, "nota": "Acabados y ventas activas" },
      { "mes": 6, "fase": "Entrega", "egresos": 3000000, "ingresos": 20000000, "acumulado": 21000000, "nota": "Entrega final — cierre de cartera" }
    ],
    "puntoQuiebre": {
      "desviacionMaxCostos": "+X%",
      "absorcionMinViable": "X u/mes",
      "precioVentaMinimo": "$XX,XXX/m²",
      "resumen": "El proyecto sigue viable si los costos no superan X% de desviación y el precio de venta no cae por debajo de $XX,XXX/m²"
    },
    "metodologiaScore": {
      "descripcion": "El score comparativo se calcula sobre 4 dimensiones ponderadas: Normativa y Legal (30%), Fortaleza de Mercado (30%), Viabilidad Financiera (25%) y Riesgo de Ejecución (15%). El candidato con mayor score ponderado recibe la recomendación.",
      "dimensiones": [
        {
          "nombre": "Normativa y Legal",
          "peso": "30%",
          "scores": [
            { "candidatoId": 1, "score": 85, "razon": "Uso de suelo compatible sin trámite de cambio — normativa directamente aplicable" },
            { "candidatoId": 2, "score": 60, "razon": "Requiere cambio de uso de suelo — 4–6 meses adicionales y riesgo de negativa" },
            { "candidatoId": 3, "score": 78, "razon": "Uso vigente pero restricción en cajones requiere sótano — costo adicional estimado" }
          ],
          "interpretacion": "El candidato A lidera esta dimensión por contar con normativa directamente aplicable, eliminando el riesgo de un cambio de uso."
        },
        {
          "nombre": "Fortaleza de Mercado",
          "peso": "30%",
          "scores": [
            { "candidatoId": 1, "score": 90, "razon": "Demanda alta, absorción de X u/mes, NSE A/B con mayor poder adquisitivo" },
            { "candidatoId": 2, "score": 65, "razon": "Demanda media, zona en crecimiento pero absorción más lenta" },
            { "candidatoId": 3, "score": 82, "razon": "Demanda alta pero alta competencia activa — diferenciación necesaria" }
          ],
          "interpretacion": "El candidato A tiene la demanda más consolidada y la mayor absorción del comparativo, con menor riesgo de inventario acumulado."
        },
        {
          "nombre": "Viabilidad Financiera",
          "peso": "25%",
          "scores": [
            { "candidatoId": 1, "score": 88, "razon": "TIR X% con margen bruto X% — estructura financiera sólida y retorno superior" },
            { "candidatoId": 2, "score": 72, "razon": "TIR X% — menor rentabilidad por precio de venta más bajo en la zona" },
            { "candidatoId": 3, "score": 80, "razon": "TIR X% — buena rentabilidad pero superficie limitada reduce ingresos totales" }
          ],
          "interpretacion": "El candidato A ofrece la mejor rentabilidad ajustada al riesgo, con TIR superior al costo de capital."
        },
        {
          "nombre": "Riesgo de Ejecución",
          "peso": "15%",
          "scores": [
            { "candidatoId": 1, "score": 82, "razon": "Terreno regular, sin afectaciones — riesgo de ejecución controlado" },
            { "candidatoId": 2, "score": 68, "razon": "Cambio de uso de suelo pendiente — dependencia de autorización municipal" },
            { "candidatoId": 3, "score": 75, "razon": "Alta competencia activa exige velocidad de ejecución y diferenciación de producto" }
          ],
          "interpretacion": "El candidato A tiene el perfil de riesgo de ejecución más bajo del comparativo, sin pendientes normativos críticos."
        }
      ]
    }
  }
}

REGLAS:
${zonaGeo ? `- CRÍTICO: los 3 candidatos deben estar dentro de un radio MÁXIMO de 1.5 km del punto GPS (lat: ${zonaGeo.lat}, lng: ${zonaGeo.lng}) — zona "${data.zona || zonaGeo.nombre}", ${data.ciudad}` : data.zona ? `- CRÍTICO: los 3 candidatos deben estar físicamente ubicados dentro de "${data.zona}", ${data.ciudad} — NO en otras colonias o municipios` : `- Los 3 candidatos deben estar dentro de ${data.ciudad}`}
- Los candidatos deben tener características distintas entre sí (precio, superficie, perfil de mercado)
- mercadoColor: candidato 1 = "green", candidato 2 = "blue", candidato 3 = "purple"
- lat/lng deben ser coordenadas GPS reales y precisas ${zonaGeo ? `dentro de 1.5 km de (${zonaGeo.lat}, ${zonaGeo.lng})` : data.zona ? `dentro de "${data.zona}"` : `dentro de ${data.ciudad}`}
- score: 0-100, el candidato con recomendado=true debe tener el mayor score
- tir: TIR anual estimada realista según tipo de desarrollo, superficie y precio
- pros: exactamente 3 fortalezas concretas y específicas por candidato
- contras: exactamente 2 riesgos específicos por candidato
- recomendado=true en exactamente un candidato (el de mayor score)
- usoSueloActual: uso de suelo actual real del predio (puede diferir del permitido)
- usoSueloPermitido: uso de suelo autorizado por normativa para ese tipo de desarrollo
- compatible: true si el desarrollo deseado es compatible con el uso permitido sin cambio de uso; false si requiere trámite
- factibilidades.status: exactamente "Disponible", "Con condicionante" o "No disponible"
- nivelRiesgo: "Bajo" (sin alertas críticas), "Medio" (condicionantes manejables), "Alto" (restricciones graves)
- alertasLegales: máximo 2 alertas por candidato — solo las más relevantes para la decisión de inversión
- alertasLegales[].status: "green" (informativo), "amber" (revisar antes de comprar), "red" (bloqueante)
- comparables: exactamente 2 proyectos competidores reales con precios actuales de mercado
- segmentacion: exactamente 2 segmentos de producto que dominan la demanda en esa zona
- stressTest: 3 escenarios con status "amber", "amber", "red" específicos para el terreno recomendado
- financiero: cifras realistas para el terreno recomendado considerando el tipo de desarrollo solicitado
- estructuraCapital: cifras en pesos MXN sin formato ($), todos numéricos excepto tipoDeuda, tasaDeuda, porcentajeMinimo, tasaDescuento, condicion y descripcion
- flujoMensual: exactamente 6 meses cubriendo el ciclo preventa → inicio obra → construcción → entrega
- puntoQuiebre: umbrales reales que hacen inviable el proyecto del candidato recomendado
- metodologiaScore: exactamente 4 dimensiones con pesos 30%, 30%, 25%, 15% — los scores por dimensión deben ser coherentes con el score total de cada candidato
- scores por dimensión × su peso ≈ score total del candidato (verificar consistencia matemática)
- fuentes.scout: 3 portales o bases de datos reales (ej. Inmuebles24, Lamudi, Catastro, DENUE)
- fuentes.legal: 4 documentos normativos reales y específicos del municipio/estado
- fuentes.mercado: 3 fuentes reales de análisis de mercado (BBVA, INEGI, CANADEVI, SHF, CONAVI u otras)
- En fuentes, usa nombres específicos con año cuando aplique — NO nombres genéricos
- Retorna ÚNICAMENTE el JSON, sin texto adicional`

  const callClaude = async () => {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[scout] No JSON found in response. stop_reason:', message.stop_reason, 'text length:', text.length)
      throw new Error('No JSON in response')
    }
    try {
      return JSON.parse(match[0])
    } catch (parseErr) {
      console.error('[scout] JSON parse failed. stop_reason:', message.stop_reason, 'matched length:', match[0].length)
      throw parseErr
    }
  }

  try {
    let result
    try {
      result = await callClaude()
    } catch (firstErr) {
      console.warn('[scout] First attempt failed, retrying:', firstErr instanceof Error ? firstErr.message : firstErr)
      result = await callClaude()
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[scout] Both attempts failed:', error)
    return NextResponse.json({ error: 'Error al buscar candidatos' }, { status: 500 })
  }
}
