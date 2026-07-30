import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const data = await req.json()

  // Diseño ya resuelto por el Agente de Arquitectura — dato fijo, este agente solo costea.
  const arq = data.arquitectura || {}
  const tip = arq.tipologiaPropuesta || {}
  const zonasFijas: Array<{ zona: string; concepto?: string; m2: number; participacion: string; cajonesEstimados?: number; m2PorCajon?: number }> = arq.desgloseZonas || []
  const areaLibre = arq.areaLibreYVerde || null
  const superficieConstruida = Number(arq.superficieConstruida) || 0
  const superficieVendible = Number(arq.superficieVendible) || 0

  const bandaLabels: Record<string, string> = {
    '1': 'Banda 1 — Económica / Interés Social (acabados básicos, $7,000–$10,500/m²)',
    '2': 'Banda 2 — Media Estándar (concreto armado, acabados medios, $10,500–$16,000/m²)',
    '3': 'Banda 3 — Media Alta / Residencial (acabados premium, amenidades, $16,000–$24,000/m²)',
    '4': 'Banda 4 — Premium / Lujo (materiales importados, domótica, $24,000–$45,000+/m²)',
  }
  const desarrolloLabels: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical', 'residencial-horizontal': 'Residencial horizontal',
    unifamiliar: 'Unifamiliar', comercial: 'Comercial', mixto: 'Uso mixto',
    industrial: 'Industrial / Nave', 'no-definido': 'Sin definir',
  }

  const tiposLabels = (data.tiposDesarrollo as string[] || [])
    .map((t: string) => t === 'otro' ? (data.tipoOtroTexto || 'Otro') : (desarrolloLabels[t] || t))
    .join(', ')

  const zonasTexto = zonasFijas.length > 0
    ? zonasFijas.map(z => `- ${z.zona} (${z.concepto || ''}): ${z.m2} m² — participación ${z.participacion}${z.cajonesEstimados ? `, ${z.cajonesEstimados} cajones a ~${z.m2PorCajon} m²/cajón` : ''}`).join('\n')
    : '- No llegó desglose de zonas del Agente de Arquitectura — distribuye tú mismo la superficie construida en las 5 zonas estándar (vendible/estacionamiento/circulaciones/áreas comunes/cuartos de servicio) con proporciones típicas.'

  const tipologiaTexto = `${tip.niveles ? `${tip.niveles} niveles` : 'niveles no especificados'}${tip.habitacional ? `, ${tip.habitacional.totalDepartamentos} departamentos` : ''}${tip.comercial ? `, ${tip.comercial.totalLocales} locales comerciales en ${tip.comercial.niveles} niveles` : ''}${tip.tamanoAmenidades ? `, amenidades nivel ${tip.tamanoAmenidades}/3` : ''}`

  const prompt = `Eres el Agente de Costos de Construcción de SMT Developer.
Tu única tarea es costear el diseño que ya aprobó el Agente de Arquitectura, usando la metodología CMIC y los índices de costos residenciales en México.
No cambias m², niveles, tipología ni número de unidades — eso ya quedó resuelto. Tu trabajo es asignar costo/m² por zona y calcular el total.

DATOS DEL PROYECTO:
- Ciudad: ${data.ciudad}, ${data.estado}
- Tipo(s) de desarrollo: ${tiposLabels}
- Banda de construcción elegida por el inversionista: ${bandaLabels[data.bandaConstruccion] || 'No especificada'}
- Pendiente del terreno: ${data.pendiente || 'No proporcionada'}

DISEÑO YA APROBADO POR EL AGENTE DE ARQUITECTURA — NO LO CUESTIONES, NO CAMBIES M² NI TIPOLOGÍA:
- Superficie construida: ${superficieConstruida} m²
- Superficie vendible (Zona 1): ${superficieVendible} m²
- Tipología: ${tipologiaTexto}
- Desglose de zonas (m² ya fijados, cópialos tal cual):
${zonasTexto}
${areaLibre ? `- Área libre y verde (fuera de la superficie construida): ${areaLibre.m2} m² (${areaLibre.porcentajeLote} del lote)` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — COSTO POR ZONA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para cada zona de arriba (mismos m², NO los cambies), asigna costo/m² y calcula el total:

ZONA 1 — ÁREA VENDIBLE
  Costo/m²: 100% del costo de banda (el más alto — acabados completos)
  Qué incluye: muros, losa, cancelería, instalaciones completas, acabados de banda

ZONA 2 — ESTACIONAMIENTO
  Costo/m²: 40–55% del costo de banda (solo estructura + losa + señalización, sin acabados residenciales)
  Qué incluye: losa de concreto, estructura, drenaje pluvial, señalización, iluminación básica
  NOTA: si el estacionamiento es en sótano, agrega 20–35% al costo de esa zona por excavación y muros milán

ZONA 3 — CIRCULACIONES Y NÚCLEOS VERTICALES
  Costo/m²: 65–75% del costo de banda

ZONA 4 — ÁREAS COMUNES Y AMENIDADES
  Costo/m²: 80–115% del costo de banda (acabados diferenciados, piezas especiales)
  NOTA: para Banda 1 usa 70% del costo; para Banda 4 puede llegar al tope del rango

ZONA 5 — CUARTOS DE SERVICIO E INSTALACIONES ESPECIALES
  Costo/m²: 50–65% del costo de banda

URBANIZACIÓN Y EXTERIORES (sobre el área libre y verde, NO es superficie construida)
  Costo estimado: $800–$2,500/m² de área libre según banda (jardines, accesos, alumbrado, banqueta)
  Se suma al costo total pero no se cuenta como m² construido

Si el terreno tiene pendiente moderada o pronunciada, suma sobrecosto de cimentación especial ($800k–$1.5M según grado) reflejado en la zona "Cuartos de servicio / obra especial".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — COSTO POR PARTIDAS (sobre área vendible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Desglosa el costo/m² de la zona vendible en 8 partidas estándar (suman 100%).

PASO 3 — MATERIALES PRINCIPALES (sobre área vendible)
Lista 6 materiales con cantidad y precio unitario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 4 — CÁLCULO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
costoTotalConstruccion = suma(m² zona × costo/m² zona para zonas 1–5) + costo urbanización
construccionM2 = costoTotalConstruccion / superficieConstruida (promedio ponderado)

FUENTES A CONSULTAR Y DOCUMENTAR:
1. CMIC — Índice de costos de construcción residencial (fuente principal)
2. Construdata México — costos paramétricos
3. CONASAMI — tabulador de salarios de construcción
4. CANADEVI delegación estatal (si disponible)
5. INFONAVIT / SHF — tablas de valor de reposición nueva

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — JSON EXACTO (sin texto adicional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "construccionM2": 14200,
  "costoTotalConstruccion": 23760000,
  "bitacoraConstruccion": {
    "bandaElegida": 2,
    "nombreBanda": "Media Estándar",
    "descripcionBanda": "1-2 oraciones de qué incluye esta banda en estructura, acabados y equipamiento",
    "costoPorM2Base": 13000,
    "ciudadAjuste": "Descripción del ajuste por ciudad",
    "ajustes": [
      {
        "concepto": "Ajuste por ciudad (ej: Culiacán — ciudad media del norte)",
        "descripcion": "Explicación del factor ciudad sobre el costo CMIC base",
        "factorAjuste": "-3%",
        "impactoM2": -390
      }
    ],
    "costoPorM2VendibleFinal": 13000,
    "costoPorM2Final": 14200,
    "superficieConstruccionM2": 1440,
    "costoTotalConstruccion": 23760000,
    "formula": "Suma ponderada por zona: $X (vendible) + $Y (estac.) + $Z (circ.) + ... = $23,760,000",
    "fuenteReferencia": "CMIC/CEICO — Índice de Costos de Construcción Residencial, 2025",
    "razonamiento": "3-5 oraciones: cómo se costeó cada zona y qué ajustes se aplicaron",
    "supuestos": [
      "Costo directo — no incluye indirectos, honorarios ni imprevistos",
      "Estacionamiento cubierto en planta baja / semisótano",
      "Verificar COS/CUS con PDU municipal antes del cierre"
    ],
    "rangoReferencia": {
      "minimo": 11000,
      "maximo": 16000,
      "interpretacion": "Rango del costo ponderado total para esta banda en esta ciudad"
    },
    "fuentesConstruccion": [
      { "fuente": "CMIC", "dato": "13000", "fecha": "2025", "disponible": true },
      { "fuente": "Construdata México", "dato": "13500", "fecha": "2025", "disponible": true },
      { "fuente": "CONASAMI", "dato": "tabulador $380/jornal", "fecha": "2025", "disponible": true },
      { "fuente": "CANADEVI estatal", "dato": "No disponible", "fecha": "", "disponible": false },
      { "fuente": "INFONAVIT / SHF", "dato": "No disponible", "fecha": "", "disponible": false }
    ],
    "dispersionFuentes": "8.5%",
    "indiceConfiabilidad": {
      "score": 55,
      "semaforo": "AMARILLO",
      "componenteA": 20,
      "componenteB": 15,
      "componenteC": 15,
      "componenteD": 8,
      "interpretacion": "1-2 oraciones sobre la confiabilidad del costo estimado",
      "accionRecomendada": "Acción concreta si IC < 75"
    },
    "desgloseConstruccion": {
      "areaVerdeYLibre": {
        "m2": 320,
        "porcentajeLote": "40%",
        "costoUrbanizacion": 480000,
        "costoUrbanizacionM2": 1500,
        "descripcion": "Área sin construir: jardines, accesos peatonales, estacionamiento descubierto, área libre normativa"
      },
      "zonas": [
        {
          "zona": "Área vendible",
          "concepto": "Departamentos / unidades habitacionales",
          "m2": 921,
          "participacion": "64%",
          "costoM2": 13000,
          "factorRespectoBanda": "100%",
          "costoTotal": 11973000,
          "nota": "Acabados completos de banda elegida — área de mayor valor"
        },
        {
          "zona": "Estacionamiento",
          "concepto": "Cajones cubiertos con circulación vehicular",
          "m2": 288,
          "participacion": "20%",
          "costoM2": 6240,
          "factorRespectoBanda": "48%",
          "costoTotal": 1797120,
          "nota": "Estructura, losa, señalización y drenaje — sin acabados residenciales"
        },
        {
          "zona": "Circulaciones",
          "concepto": "Pasillos, escaleras, núcleo de elevadores",
          "m2": 144,
          "participacion": "10%",
          "costoM2": 9100,
          "factorRespectoBanda": "70%",
          "costoTotal": 1310400,
          "nota": "Acabados básicos, barandal, iluminación de emergencia"
        },
        {
          "zona": "Áreas comunes",
          "concepto": "Lobby, amenidades, roof garden",
          "m2": 72,
          "participacion": "5%",
          "costoM2": 11700,
          "factorRespectoBanda": "90%",
          "costoTotal": 842400,
          "nota": "Acabados diferenciados — lobby representativo de la banda"
        },
        {
          "zona": "Cuartos de servicio",
          "concepto": "Cisterna, cuarto de máquinas, subestación, basura",
          "m2": 15,
          "participacion": "1%",
          "costoM2": 7150,
          "factorRespectoBanda": "55%",
          "costoTotal": 107250,
          "nota": "Obra civil básica, impermeabilización, instalaciones de servicio"
        }
      ]
    },
    "desglosePorPartidas": [
      { "partida": "Preliminares y preparación", "porcentaje": 4, "costoPorM2": 520, "descripcion": "Limpieza, nivelación, trazo, instalaciones provisionales" },
      { "partida": "Cimentación", "porcentaje": 10, "costoPorM2": 1300, "descripcion": "Tipo según tipología y mecánica de suelos; incluye excavación" },
      { "partida": "Estructura / Obra negra", "porcentaje": 28, "costoPorM2": 3640, "descripcion": "Columnas, trabes, losas, muros — principal consumidor de cemento y acero" },
      { "partida": "Instalaciones", "porcentaje": 18, "costoPorM2": 2340, "descripcion": "Hidráulica, sanitaria, eléctrica, gas, voz y datos" },
      { "partida": "Acabados", "porcentaje": 24, "costoPorM2": 3120, "descripcion": "Pisos, azulejos, aplanados, pintura, plafones — mayor variación entre bandas" },
      { "partida": "Carpintería, herrería y cancelería", "porcentaje": 8, "costoPorM2": 1040, "descripcion": "Puertas, ventanas, cancel de baño, closets, muebles de cocina" },
      { "partida": "Equipamiento especial", "porcentaje": 5, "costoPorM2": 650, "descripcion": "Elevador, contra incendios, CCTV, amenidades — varía por banda" },
      { "partida": "Exteriores y urbanización", "porcentaje": 3, "costoPorM2": 390, "descripcion": "Estacionamiento, jardines, accesos, alumbrado exterior" }
    ],
    "materialesPrincipales": [
      { "material": "Cemento Portland CPC 30", "unidad": "ton", "cantidadPorM2": 0.38, "precioUnitario": 2900, "costoPorM2": 1102, "nota": "Consumo en estructura + cimentación" },
      { "material": "Acero / Varilla corrugada Grado 42", "unidad": "kg", "cantidadPorM2": 35, "precioUnitario": 22, "costoPorM2": 770, "nota": "Edificios verticales: 30–60 kg/m² según altura" },
      { "material": "Block de concreto 15×20×40 cm", "unidad": "pza", "cantidadPorM2": 12, "precioUnitario": 18, "costoPorM2": 216, "nota": "Muros divisorios no estructurales" },
      { "material": "Grava y arena", "unidad": "m³", "cantidadPorM2": 0.25, "precioUnitario": 480, "costoPorM2": 120, "nota": "Agregados para concreto; precio varía por distancia a banco" },
      { "material": "Mano de obra (promedio ponderado)", "unidad": "jornal/m²", "cantidadPorM2": 1.8, "precioUnitario": 320, "costoPorM2": 576, "nota": "Oficial, ayudante, especialista — fuente: CMIC 2025" },
      { "material": "Cable eléctrico (THW varios calibres)", "unidad": "ml", "cantidadPorM2": 8, "precioUnitario": 28, "costoPorM2": 224, "nota": "Estimado para circuitos de iluminación, contactos y fuerza" }
    ]
  }
}

REGLAS:
- desgloseConstruccion.zonas[*].m2 y participacion DEBEN copiarse EXACTAMENTE de "Desglose de zonas" arriba — no los recalcules ni redistribuyas
- construccionM2 es el costo PONDERADO total (costoTotalConstruccion / superficieConstruida)
- bitacoraConstruccion.costoPorM2Final debe coincidir exactamente con construccionM2
- bitacoraConstruccion.costoPorM2VendibleFinal es el costo/m² SOLO del área vendible (Zona 1)
- bitacoraConstruccion.costoTotalConstruccion debe coincidir con la variable raíz costoTotalConstruccion
- costoTotalConstruccion = suma de costoTotal de todas las zonas + costoUrbanizacion del área verde/libre
- desglosePorPartidas: exactamente 8 partidas, porcentajes suman 100, costoPorM2 = round(costoPorM2VendibleFinal × porcentaje / 100)
- materialesPrincipales: exactamente 6 materiales
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    const parsed = JSON.parse(match[0])

    // El modelo a veces no logra mantener consistencia entre los campos raíz (resumen que lee
    // el resto del pipeline) y su propia bitácora (donde hace el cálculo zona por zona) — visto
    // en producción: costoTotalConstruccion en la raíz salió "100" mientras
    // bitacoraConstruccion.costoTotalConstruccion (el que sí usó para calcular indirectos/
    // honorarios, verificado contra esos montos) tenía el valor real (~$95.4M). El prompt exige
    // que coincidan (ver REGLAS), pero nada lo garantizaba — se sobrescribe la raíz con la
    // bitácora en vez de confiar en que el modelo cumplió su propia regla de consistencia.
    if (parsed.bitacoraConstruccion) {
      const bc = parsed.bitacoraConstruccion
      if (typeof bc.costoTotalConstruccion === 'number') parsed.costoTotalConstruccion = bc.costoTotalConstruccion
      if (typeof bc.costoPorM2Final === 'number') parsed.construccionM2 = bc.costoPorM2Final
      // superficieConstruccionM2 aquí es solo un eco del dato que ya fijó Arquitectura — se
      // sobrescribe siempre con el valor real, nunca se confía en que el modelo lo copió bien.
      bc.superficieConstruccionM2 = superficieConstruida
    }

    // Blindaje contra deriva: los m²/participación por zona ya los fijó el Agente de
    // Arquitectura (ver "Desglose de zonas" en el prompt) — el LLM de Construcción solo debe
    // asignarles costo/m², nunca redistribuir área. Se sobrescriben aquí en vez de confiar en
    // que el modelo copió los valores fijos tal cual, y se recalcula costoTotal de la zona con
    // el m² correcto y el costo/m² que sí decidió el modelo.
    const zonasRespuesta = parsed.bitacoraConstruccion?.desgloseConstruccion?.zonas
    if (Array.isArray(zonasRespuesta) && zonasFijas.length > 0) {
      for (const z of zonasRespuesta) {
        const fija = zonasFijas.find(zf => (zf.zona || '').toLowerCase() === (z.zona || '').toLowerCase())
        if (fija) {
          z.m2 = fija.m2
          z.participacion = fija.participacion
          if (typeof z.costoM2 === 'number') z.costoTotal = Math.round(fija.m2 * z.costoM2)
        }
      }
    }

    // costoTotalConstruccion/construccionM2 (arriba) se tomaron de bc.costoTotalConstruccion /
    // bc.costoPorM2Final tal como los declaró el modelo — pero eso es aritmética libre del LLM
    // sobre sus propias zonas, y no siempre cuadra con la suma real de esas zonas (visto en
    // pruebas: el modelo escribió su propia "CORRECCIÓN CÁLCULO" en bitacoraConstruccion.formula
    // porque su primera suma no le cuadraba, y aun así el costoTotalConstruccion que devolvió no
    // coincidía con NINGUNA de sus dos sumas). Se recalcula aquí desde los montos por zona ya
    // fijados arriba (siempre exactos, ya que costoTotal = m² fijo × costoM2 que sí decidió el
    // modelo) en vez de confiar en que el total declarado reconcilia.
    if (Array.isArray(zonasRespuesta) && zonasRespuesta.length > 0) {
      const sumaZonas = zonasRespuesta.reduce((s: number, z: { costoTotal?: number }) => s + (Number(z.costoTotal) || 0), 0)
      const costoUrbanizacion = Number(parsed.bitacoraConstruccion?.desgloseConstruccion?.areaVerdeYLibre?.costoUrbanizacion) || 0
      const totalRecalculado = sumaZonas + costoUrbanizacion
      parsed.costoTotalConstruccion = totalRecalculado
      if (parsed.bitacoraConstruccion) {
        parsed.bitacoraConstruccion.costoTotalConstruccion = totalRecalculado
        if (superficieConstruida > 0) {
          parsed.construccionM2 = Math.round(totalRecalculado / superficieConstruida)
          parsed.bitacoraConstruccion.costoPorM2Final = parsed.construccionM2
        }
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Construcción error:', error)
    return NextResponse.json({ error: 'Error en Agente Construcción' }, { status: 500 })
  }
}
