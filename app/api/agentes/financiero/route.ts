import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser, unauthorized } from '@/lib/api-auth'
import { DESCUENTOS_CANCELACIONES, PORCENTAJE_COMERCIALIZACION, RANGOS_HONORARIOS_POR_BANDA } from '@/lib/mastermind/catalogo'
import { calcularFlujoFinanciero } from '@/lib/analisis/flujoFinanciero'
import { validarIndirectos, escalarCostoPorMix } from '@/lib/analisis/validacionFinanciera'
import { evaluarPlausibilidadBanda } from '@/lib/mercado/validarComparableVenta'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const user = await requireUser(req)
  if (!user) return unauthorized()

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

  // Honorarios de proyecto (arquitecto, ingenierías, DRO) varían mucho más que indirectos según
  // la complejidad/segmento — un desarrollo sencillo en banda popular solo necesita un diseño
  // básico, uno complejo o de lujo suma especialistas (interiorismo, paisajismo, gerencia de
  // proyecto). Mismo catálogo que usa Mastermind (lib/mastermind/catalogo.ts) para que el rango
  // sugerido no diverja entre los dos motores. Default a banda 2 si no viene banda todavía.
  const rangoHonorarios = RANGOS_HONORARIOS_POR_BANDA[Number(data.bandaConstruccion)] ?? RANGOS_HONORARIOS_POR_BANDA[2]

  // Approved values (possibly overridden by user)
  const costoTerrenoM2 = data.costoTerrenoM2
  const costoTerreno = data.costoTerreno
  const construccionM2 = data.construccionM2
  const superficieConstruida = data.superficieConstruida
  // Fallback a superficieConstruida por si un caller viejo no manda superficieVendible —
  // no debería pasar (el pipeline actual siempre la manda, ver analizando/page.tsx), pero
  // es mejor que interpolar "undefined" literal en el prompt.
  const superficieVendible = data.superficieVendible ?? superficieConstruida

  // costoTotalConstruccion que llega del Agente Construcción está costeado sobre TODA el área
  // vendible del envolvente legal (Zona 1) — pero superficieVendible (arriba) es la que
  // realmente resulta de sumar el mix de unidades propuesto, que puede ser mucho menor si el
  // mix no llena el envolvente (ej. por un tope de densidad de unidades). Financiero debe
  // costear lo que realmente se va a construir y vender, no el máximo legal — se escala el
  // costo hacia abajo proporcionalmente cuando el mix aprovecha menos área vendible de la que
  // se costeó (nunca hacia arriba, ver escalarCostoPorMix). Fallback a superficieVendible (sin
  // dato nuevo → factor 1, sin cambio de comportamiento) para no romper callers viejos.
  const costoTotalConstruccionSinEscalar = data.costoTotalConstruccion
  const superficieVendibleConstruccion = Number(data.superficieVendibleConstruccion) || superficieVendible
  const escaladoMix = escalarCostoPorMix(costoTotalConstruccionSinEscalar, superficieVendible, superficieVendibleConstruccion)
  const costoTotalConstruccion = escaladoMix.costoTotalConstruccionEscalado

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
- Superficie vendible: ${superficieVendible} m² — YA fue calculada por el Agente Construcción (m² de zona vendible, descontando áreas comunes/circulación). NO la recalcules a partir de COS/CUS ni de la superficie del terreno — las unidades que propongas deben sumar aproximadamente esta cifra, no más.

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
${data.precioVentaObjetivo ? `- PRECIO DE VENTA OBJETIVO calibrado en Mastermind 1 por el desarrollador: $${Number(data.precioVentaObjetivo).toLocaleString('es-MX')}/m² — úsalo EXACTAMENTE como precioVentaM2, no lo recalcules ni lo ajustes contra la zona/comparables. Ya es una decisión tomada, no una sugerencia.` : ''}
${data.unidadesObjetivo ? `- NÚMERO DE UNIDADES calibrado en Mastermind 1 por el desarrollador: ${Number(data.unidadesObjetivo)} — úsalo EXACTAMENTE (en recomendacion.tipologia y en la narrativa), no lo recalcules dividiendo superficie vendible entre m² promedio. Ajusta el m² promedio implícito para que unidades × m² promedio siga aproximando la superficie vendible aprobada.` : ''}

INSTRUCCIONES FINANCIERAS:
1. Calcula indirectos (15–18% de costoTotalConstruccion), honorarios de proyecto (${rangoHonorarios.min}–${rangoHonorarios.max}% — el rango de tu banda de construcción, más alto cuanto más complejo/lujo sea el proyecto dentro de ese rango, no siempre el punto medio), imprevistos (5%). Ningún rubro puede quedar en 0 — todo proyecto real paga overhead. Desglosa cada uno por concepto (el desglose debe sumar aproximadamente el total del rubro, ±5%):
   - indirectosDesglose: supervisión de obra, permisos y licencias de construcción, estudios técnicos (mecánica de suelos, topografía), seguros de obra, administración de obra (caseta/luz/agua provisional/vigilancia), IMSS/INFONAVIT de nómina de construcción
   - honorariosDesglose: arquitecto (diseño arquitectónico), ingeniero estructural, ingenierías especiales (hidrosanitaria/eléctrica/aire acondicionado), Director Responsable de Obra (DRO), gerencia de proyecto (si aplica)
   - imprevistosDesglose: contingencia por incremento de materiales, ajustes de diseño en obra, condiciones de suelo no previstas, costos por retrasos, requerimientos municipales adicionales
   No inventes rubros que no apliquen a la escala del proyecto (ej. un desarrollo unifamiliar pequeño no necesita gerencia de proyecto como línea separada) — usa 3-6 conceptos por desglose, los que realmente apliquen.
2. inversionTotal = costoTerreno + costoTotalConstruccion + indirectos + honorarios + imprevistos + comercialización. El proyecto también paga descuentos y cancelaciones (5% del ingreso bruto) y comercialización/comisión de venta (3% del ingreso neto tras descuentos) — estos dos y el resto de la aritmética financiera (ingresosProyectados, inversionTotal, utilidadBruta, margenBruto) se recalculan automáticamente en código después de tu respuesta, así que NO necesitas calcularlos tú con precisión — concéntrate en elegir bien precioVentaM2 y los porcentajes de indirectos/honorarios/imprevistos; usa cifras aproximadas razonables para estos campos en tu respuesta y para que tu narrativa (descripción, stress test, punto de quiebre) sea coherente con que estos costos existen.
3. Reparte la superficie vendible aprobada (${superficieVendible} m²) en unidades según la tipología — el número de unidades sale de dividir esa superficie entre el m² promedio por unidad típico de la tipología, NO de recalcular el envolvente con COS/CUS (eso ya lo hizo el Agente Construcción).${data.unidadesObjetivo ? ` Excepto si arriba viene NÚMERO DE UNIDADES calibrado en Mastermind 1 — en ese caso usa ese número exacto, no lo derives de la superficie.` : ''}
   REGLA CRÍTICA: Si el tipo de desarrollo incluye "unifamiliar" o "Unifamiliar", el número de unidades es EXACTAMENTE 1 — una sola vivienda. No importa la superficie. NUNCA recomiendes 2 o más casas para un desarrollo unifamiliar.
4. ingresosProyectados = unidades × precio promedio ponderado de las fases de venta
5. utilidadBruta = ingresosProyectados − inversionTotal
6. margenBruto = (utilidadBruta / inversionTotal) × 100
7. financiero.tir y financiero.tirProyecto se calculan automáticamente en código a partir de un flujo de caja mensual determinista (no los calcules tú) — deja cualquier valor razonable en el JSON, será sobrescrito. Lo que SÍ debes cuidar es que las narrativas (stress test, punto de quiebre, interpretaciones del score) sean coherentes con que el margenBruto ya calculado (ver punto 2) es la fuente de verdad de si el proyecto es viable o no.
8. Estructura de capital: propón equity/deuda óptimo según presupuesto del inversionista y perfil del proyecto. tasaDeudaAnual es el número limpio (ej. 14.5) que corresponde a tasaDeuda — se usa para calcular financiero.tir/tirProyecto en código, así que debe ser un valor numérico realista de mercado (TIIE + spread), no un string.
9. Preventa mínima: 30% de unidades para apertura de crédito puente
10. Duraciones del proyecto — calcúlalas, NO uses siempre 18 meses fijos:
    - plazoObraMeses: según superficieConstruida (${superficieConstruida} m²) — <1,500 m²: 8-12 meses · 1,500-4,000 m²: 12-18 meses · 4,000-8,000 m²: 18-24 meses · >8,000 m²: 24-36 meses
    - inicioVentasMes: normalmente 2-4 (apertura de preventa, alineado con el hito "Preventa" del flujo mensual)
    - velocidad de absorción mensual (unidades/mes) según Absorción: "Baja"≈1-2, "Media"≈2-3, "Alta"≈4-6
    - plazoVentaMeses = inicioVentasMes + ceil(unidades totales / velocidad de absorción), con mínimo plazoObraMeses + 2 (no se puede terminar de vender antes de terminar de construir, más margen de entrega)
11. Flujo mensual: 9 hitos clave (no mes a mes, sino eventos relevantes: adquisición, permisos, preventa, crédito, inicio obra, avance 50%, fin obra, entregas, cierre) — los "mes" de cada hito deben ser consistentes con plazoObraMeses/plazoVentaMeses/inicioVentasMes calculados en el punto 10, NO la plantilla genérica de ejemplo de abajo
12. Score de Resiliencia: 3 dimensiones (Solidez Financiera 40%, Riesgo Regulatorio 35%, Exposición Mercado 25%)
13. Stress test: 3 escenarios adversos (costos +15%, ventas -50%, precio -10%)
14. Punto de quiebre: máxima desviación sostenible en cada variable
15. Recomendación Mastermind: tipología óptima y justificación en 2-3 oraciones

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
    "indirectosDesglose": [{ "concepto": "Supervisión de obra", "monto": 0 }],
    "honorarios": 0,
    "honorariosDesglose": [{ "concepto": "Arquitecto", "monto": 0 }],
    "imprevistos": 0,
    "imprevistosDesglose": [{ "concepto": "Incremento de materiales", "monto": 0 }],
    "inversionTotal": 0,
    "precioVentaM2": 0,
    "ingresosProyectados": 0,
    "descuentos": 0,
    "ingresosNetos": 0,
    "comercializacion": 0,
    "utilidadBruta": 0,
    "margenBruto": 0,
    "tir": 0,
    "tirProyecto": 0,
    "plazoObraMeses": 0,
    "plazoVentaMeses": 0,
    "inicioVentasMes": 0
  },
  "estructuraCapital": {
    "equity": 40,
    "deuda": 60,
    "montoEquity": 0,
    "montoDeuda": 0,
    "tipoDeuda": "Crédito puente bancario",
    "tasaDeuda": "TIIE + 3.5% anual (aprox. 14.5%)",
    "tasaDeudaAnual": 14.5,
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
- Las unidades que propongas en recomendacion.tipologia, sumadas por su m² típico, NO deben exceder ${superficieVendible} m² de superficie vendible aprobada (±10% de tolerancia) — ingresosProyectados debe ser consistente con esa superficie, no con un envolvente propio recalculado
- UNIFAMILIAR: si tiposDesarrollo incluye "unifamiliar", recomendacion.tipologia DEBE decir "Casa Unifamiliar · 1 vivienda" (nunca más de 1). Los ingresos son el precio de venta de 1 sola vivienda.
- Todos los valores financieros son números sin formato (sin $, sin comas)
- tir y margenBruto son números decimales (ej: 22.4, no "22.4%")
- scores son números enteros 0–100
- score.total = promedio ponderado (solidez×0.4 + regulatorio×0.35 + mercado×0.25)
- stressTest status: "green" (TIR > 18%), "amber" (TIR 12–18%), "red" (TIR < 12%)
- flujoMensual: exactamente 9 hitos, todos los montos ajustados a los números reales del proyecto
- Los "mes" del ejemplo de flujoMensual arriba (1,2,3,4,6,10,14,16,18) son solo ilustrativos de un proyecto típico de ~18 meses — NO los copies tal cual. Recalcúlalos para que "Inicio obra" = inicioVentasMes o después, "Construcción finaliza" = "Inicio obra" + plazoObraMeses, y "Cierre" = plazoVentaMeses, todos consistentes con las duraciones que calculaste en el punto 10
- financiero.plazoObraMeses, financiero.plazoVentaMeses y financiero.inicioVentasMes son obligatorios y deben ser consistentes entre sí y con flujoMensual (no pueden quedar en 0)
- La suma de indirectosDesglose[*].monto debe aproximar financiero.indirectos (±5%); igual honorariosDesglose con honorarios e imprevistosDesglose con imprevistos — el desglose documenta el total, no lo reemplaza
- estructuraCapital: equity + deuda = 100; tasaDeudaAnual es un número (ej. 14.5), nunca un string — montoEquity/montoDeuda se recalculan en código, no hace falta que cuadren exactamente con inversionTotal en tu respuesta
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
    const parsed = JSON.parse(match[0])

    // ingresosProyectados/inversionTotal/utilidadBruta/margenBruto son multiplicaciones y
    // sumas simples (ver instrucciones 2-6 arriba) que el modelo debería calcular bien, pero
    // en la práctica hemos visto ingresosProyectados salir hasta 2.5x más alto de lo que
    // superficieVendible × precioVentaM2 da — el modelo no siempre sigue el ancla al pie de
    // la letra pese a la instrucción. Estos 4 valores dependen solo de números que ya
    // conocemos con certeza (superficieVendible, y lo que el modelo eligió para precioVentaM2/
    // indirectos/honorarios/imprevistos), así que se recalculan aquí en código en vez de
    // confiar en la aritmética del modelo — no requiere que el modelo "razone" nada, solo que
    // haya elegido bien el precio y los porcentajes, que sí es su trabajo.
    if (parsed.financiero) {
      // costoTerreno/costoTerrenoM2/construccionM2/costoTotalConstruccion son "valores
      // aprobados" que el prompt le pide usar exactamente (ver REGLAS más abajo), pero nada
      // garantizaba que el modelo los copiara bien — mismo bug ya encontrado y corregido una
      // vez en app/api/agentes/construccion/route.ts (raíz vs bitácora: la raíz decía "100"
      // mientras el cálculo real daba ~$95.4M). Se ancla aquí en vez de confiar en el copy-paste
      // del modelo, para que lo que se MUESTRA coincida siempre con lo que se SUMA abajo.
      parsed.financiero.costoTerreno = costoTerreno
      parsed.financiero.costoTerrenoM2 = costoTerrenoM2
      parsed.financiero.construccionM2 = construccionM2
      parsed.financiero.costoTotalConstruccion = costoTotalConstruccion
      parsed.financiero.escaladoPorMix = escaladoMix

      // El precio de venta es una elección libre del modelo — el aviso "sospechosoPorBanda" que
      // ya le pasamos a Mercado (ver comparablesPrecargados en mercado/route.ts) es un empujón
      // suave que puede ignorar, y en producción lo ignoró: ancló precioPromedioZona en un
      // comparable de zona premium ($68,000/m²) para un proyecto banda 2, dando 109.6% de margen.
      // Igual que con costoTotalConstruccion, un aviso en el prompt no es suficiente — aquí se
      // limita en código al techo plausible de la banda de construcción (mismo criterio y mismo
      // multiplicador ×3 que ya usa evaluarPlausibilidadBanda para marcar comparables).
      const precioVentaObjetivo = Number(data.precioVentaObjetivo) || 0
      const precioVentaM2Modelo = Number(parsed.financiero.precioVentaM2) || 0
      // Si el precio viene calibrado explícitamente en Mastermind 1, es una decisión del
      // desarrollador, no una elección libre del modelo — se ancla directo y se salta el tope
      // de plausibilidad de banda (ese tope existe para corregir al modelo cuando alucina un
      // precio de zona premium, no para segundo-adivinar una decisión humana explícita).
      let precioVentaM2Real: number
      if (precioVentaObjetivo > 0) {
        precioVentaM2Real = precioVentaObjetivo
      } else {
        const evaluacionPrecio = evaluarPlausibilidadBanda(precioVentaM2Modelo, data.bandaConstruccion)
        precioVentaM2Real = evaluacionPrecio?.sospechosoPorBanda ? evaluacionPrecio.precioVentaMaxPlausible : precioVentaM2Modelo
        if (evaluacionPrecio?.sospechosoPorBanda) {
          parsed.financiero.precioVentaAjustadoPorBanda = {
            precioVentaM2Modelo,
            precioVentaM2Ajustado: precioVentaM2Real,
            techoBandaConstruccion: evaluacionPrecio.techoBandaConstruccion,
          }
        }
      }
      parsed.financiero.precioVentaM2 = precioVentaM2Real

      let indirectosReal = Number(parsed.financiero.indirectos) || 0
      let honorariosReal = Number(parsed.financiero.honorarios) || 0
      let imprevistosReal = Number(parsed.financiero.imprevistos) || 0

      // Indirectos/honorarios/imprevistos son montos que el modelo elige libremente (se le pide
      // 15-18%/rango de honorarios por banda/5% de costoTotalConstruccion, ver prompt) — a
      // diferencia de ingresosProyectados/inversionTotal, aquí no se recalculan si el modelo
      // eligió un valor razonable (cambiar el dinero que "decidió" es más riesgoso que solo
      // señalarlo), solo se anota si se salió del rango esperado.
      //
      // Pero 0 nunca es una elección razonable — ningún proyecto real se construye sin overhead,
      // así que un 0 no es "el modelo decidió un valor bajo", es el campo vacío/omitido o
      // copiado del placeholder del schema del prompt (bug real reportado en producción:
      // "Honorarios y diseño" en $0 en la propuesta final, sin ninguna señal de que algo falló).
      // Para estos tres, y solo cuando vienen en 0, sí se reemplaza por el punto medio del rango
      // que el propio prompt pidió — mismo criterio que ya usa el tope de banda de
      // precioVentaM2Real arriba (corregir un valor imposible, no adivinar uno plausible).
      if (indirectosReal <= 0) indirectosReal = Math.round(costoTotalConstruccion * 0.165)
      if (honorariosReal <= 0) honorariosReal = Math.round(costoTotalConstruccion * ((rangoHonorarios.min + rangoHonorarios.max) / 2 / 100))
      if (imprevistosReal <= 0) imprevistosReal = Math.round(costoTotalConstruccion * 0.05)
      parsed.financiero.indirectos = indirectosReal
      parsed.financiero.honorarios = honorariosReal
      parsed.financiero.imprevistos = imprevistosReal

      parsed.financiero.validacionIndirectos = validarIndirectos(indirectosReal, honorariosReal, imprevistosReal, costoTotalConstruccion, rangoHonorarios)

      // ingresosProyectados se queda como el ingreso BRUTO (mismo significado de siempre).
      // descuentos/comercializacion son costos reales que Mastermind ya cobraba desde el
      // principio pero el análisis nunca modeló — mismas constantes, para que ambos lados
      // dejen de divergir por esto. No son estimación del modelo, son aritmética fija.
      //
      // Bug real encontrado en producción: aquí se aplicaba precioVentaM2Real a TODA
      // superficieVendible por igual, aunque el proyecto tuviera un componente comercial con su
      // propio precio (data.mercado.segmentacion) — Mastermind (lib/mastermind/contexto.ts,
      // extractMercadoContext) sí diferencia precioLocalesM2 del habitacional, así que el
      // ingreso reconstruido ahí nunca coincidía con el de Financiero. Se replica el mismo
      // criterio aquí: si hay área comercial real (data.superficieVendibleComercial, calculada
      // en analizando/page.tsx desde el mix de Arquitectura) y un precio de segmento comercial
      // en Mercado, se cobra cada área a su propio precio — mismo tope de plausibilidad de
      // banda que ya usa precioVentaM2Real arriba.
      const superficieVendibleComercial = Math.min(Number(data.superficieVendibleComercial) || 0, superficieVendible)
      const superficieVendibleHabitacional = superficieVendible - superficieVendibleComercial
      let precioLocalesReal = precioVentaM2Real
      if (superficieVendibleComercial > 0) {
        const segmentoLocal = data.mercado?.segmentacion?.find((s: any) => /local|comercial/i.test(s.tipo))
        if (segmentoLocal?.precioM2) {
          const evaluacionLocal = evaluarPlausibilidadBanda(segmentoLocal.precioM2, data.bandaConstruccion)
          precioLocalesReal = evaluacionLocal?.sospechosoPorBanda ? evaluacionLocal.precioVentaMaxPlausible : segmentoLocal.precioM2
        }
      }
      const ingresosProyectadosReal = superficieVendibleComercial > 0
        ? Math.round(superficieVendibleHabitacional * precioVentaM2Real + superficieVendibleComercial * precioLocalesReal)
        : Math.round(superficieVendible * precioVentaM2Real)
      const descuentosReal = Math.round(ingresosProyectadosReal * DESCUENTOS_CANCELACIONES)
      const ingresosNetosReal = ingresosProyectadosReal - descuentosReal
      const comercializacionReal = Math.round(ingresosNetosReal * PORCENTAJE_COMERCIALIZACION)
      const inversionTotalReal = Math.round(costoTerreno + costoTotalConstruccion + indirectosReal + honorariosReal + imprevistosReal + comercializacionReal)
      const utilidadBrutaReal = ingresosNetosReal - inversionTotalReal
      const margenBrutoReal = inversionTotalReal > 0 ? Math.round((utilidadBrutaReal / inversionTotalReal) * 1000) / 10 : 0

      parsed.financiero.ingresosProyectados = ingresosProyectadosReal
      parsed.financiero.descuentos = descuentosReal
      parsed.financiero.ingresosNetos = ingresosNetosReal
      parsed.financiero.comercializacion = comercializacionReal
      parsed.financiero.inversionTotal = inversionTotalReal
      parsed.financiero.utilidadBruta = utilidadBrutaReal
      parsed.financiero.margenBruto = margenBrutoReal

      // TIR Proyecto (sin apalancar) y TIR Socio (con la deuda propuesta en estructuraCapital)
      // se calculan aquí en código, con un flujo de caja mensual determinista — ver
      // lib/analisis/flujoFinanciero.ts. Reemplaza el intento anterior de que el modelo
      // "razonara" un solo número de TIR (evaluado y descartado en esta misma sesión: usar
      // flujoMensual del propio modelo produce raíces espurias porque mezcla movimientos
      // brutos de crédito con el flujo real). El análisis es ahora el origen de la verdad
      // para ambas TIR — Mastermind las recalcula por separado para simular escenarios, pero
      // ya no debería partir de una cifra adivinada por el LLM.
      const plazoObraMeses = Number(parsed.financiero.plazoObraMeses) || 0
      const inicioVentasMes = Number(parsed.financiero.inicioVentasMes) || 0
      // El prompt (punto 10) ya le pide al modelo plazoVentaMeses ≥ plazoObraMeses + 2 ("no se
      // puede terminar de vender antes de terminar de construir") pero en la práctica no
      // siempre lo respeta — visto en producción con 26 vs 30. Si el flujo de ventas termina
      // antes que la obra, el flujo de caja nunca tiene un mes positivo (siempre está pagando
      // construcción) y la TIR sale "no calculable" aunque el proyecto no sea tan malo. Se
      // aplica el mismo mínimo aquí en código, no se confía en que el modelo lo haya cumplido.
      const plazoVentaMeses = Math.max(Number(parsed.financiero.plazoVentaMeses) || 0, plazoObraMeses + 2)
      parsed.financiero.plazoVentaMeses = plazoVentaMeses
      const porcentajeEquity = Number(parsed.estructuraCapital?.equity) || 0
      const tasaAnualCredito = Number(parsed.estructuraCapital?.tasaDeudaAnual) || 14.5

      const flujo = calcularFlujoFinanciero({
        costoTerreno,
        costoTotalConstruccion,
        indirectos: indirectosReal,
        honorarios: honorariosReal,
        imprevistos: imprevistosReal,
        ingresosNetos: ingresosNetosReal,
        comercializacion: comercializacionReal,
        plazoObraMeses,
        plazoVentaMeses,
        inicioVentasMes,
        porcentajeEquity,
        tasaAnualCredito,
      })

      // calcularTIR devuelve el % con muchos decimales (ej. -96.10642816572748) — se redondea
      // a 1 decimal, mismo criterio que ya usa margenBruto, para que no se desborde en la UI.
      const redondear1 = (n: number | null) => n === null ? null : Math.round(n * 10) / 10
      parsed.financiero.tir = redondear1(flujo.tirSocioAnual)
      parsed.financiero.tirConverge = flujo.tirSocioConverge
      parsed.financiero.tirProyecto = redondear1(flujo.tirProyectoAnual)
      parsed.financiero.tirProyectoConverge = flujo.tirProyectoConverge

      if (parsed.estructuraCapital) {
        parsed.estructuraCapital.montoEquity = Math.round(flujo.montoEquity)
        parsed.estructuraCapital.montoDeuda = Math.round(flujo.montoDeuda)
        parsed.estructuraCapital.costoFinanciero = Math.round(flujo.costoFinanciero)
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Financiero error:', error)
    return NextResponse.json({ error: 'Error en Agente Financiero' }, { status: 500 })
  }
}
