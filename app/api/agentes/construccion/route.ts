import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { calcularEnvolvente, validarMix } from '@/lib/analisis/envolventeYAreas'
import type { EntradaEnvolvente, SalidaEnvolvente } from '@/lib/analisis/envolventeYAreas'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Mapeo pragmático de tiposDesarrollo (intake) a la tipología de eficiencia vendible del
// módulo determinístico — no hay categoría 1:1 para "industrial"/"no-definido"/"otro", se
// tratan como 'vertical' (el fallback más conservador de los tres perfiles definidos).
function tipologiaEnvolvente(tiposDesarrollo: string[] | undefined): EntradaEnvolvente['tipologia'] {
  const tipos = tiposDesarrollo || []
  if (tipos.includes('mixto') || tipos.includes('comercial')) return 'mixto'
  if (tipos.includes('residencial-horizontal') || tipos.includes('unifamiliar')) return 'horizontal'
  return 'vertical'
}

export async function POST(req: NextRequest) {
  const data = await req.json()

  // Envolvente determinístico (lib/analisis/envolventeYAreas.ts) — solo se puede calcular si
  // Legal ya devolvió los campos numéricos (cosNum/cusNum/nivelesMax). Si falta cualquiera
  // (análisis viejo, Legal no llegó a tiempo, o Legal falló), degradamos al comportamiento
  // anterior: el LLM estima su propio COS/CUS/eficiencia en el PASO 1 de abajo.
  const fl = data.fichaLegal
  const superficieTerreno = Number(data.superficie) || 0
  const cos = Number(fl?.cosNum) || 0
  const cus = Number(fl?.cusNum) || 0
  const nivelesMax = Number(fl?.nivelesMax) || 0
  const densidadMaxUnidades = Number(fl?.densidadMaxUnidades) || undefined
  const envolvente: SalidaEnvolvente | null = (superficieTerreno > 0 && cos > 0 && cus > 0 && nivelesMax > 0)
    ? calcularEnvolvente({
        superficieTerreno, cos, cus, nivelesMax, densidadMaxUnidades,
        tipologia: tipologiaEnvolvente(data.tiposDesarrollo),
      })
    : null

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

  const prompt = `Eres el Agente de Costos de Construcción de SMT Developer.
Tu única tarea es estimar el costo de construcción desglosado por tipo de área, usando la metodología CMIC y los índices de costos residenciales en México.
No calculas valor de terreno, normativa ni mercado — solo costos de construcción con desglose detallado de zonas.

DATOS DEL PROYECTO:
- Ciudad: ${data.ciudad}, ${data.estado}
- Superficie del terreno: ${data.superficie} m²
- Tipo(s) de desarrollo: ${tiposLabels}
- Banda de construcción elegida por el inversionista: ${bandaLabels[data.bandaConstruccion] || 'No especificada'}
- Pendiente del terreno: ${data.pendiente || 'No proporcionada'}
${data.nivelesOverride ? `- Niveles FIJADOS por el usuario: ${data.nivelesOverride} — no los cambies` : ''}
${data.totalDeptosOverride ? `- Total de departamentos FIJADO por el usuario: ${data.totalDeptosOverride} — no lo cambies` : ''}
${data.totalLocalesOverride ? `- Total de locales comerciales FIJADO por el usuario: ${data.totalLocalesOverride} — no lo cambies` : ''}
${data.amenidadesNivelOverride ? `- Tamaño de amenidades FIJADO por el usuario: nivel ${data.amenidadesNivelOverride} de 3 — no lo cambies` : ''}

CONTEXTO DE VALUACIÓN DEL TERRENO:
- Uso de suelo: ${data.usoSuelo}
- Costo del terreno aprobado: $${Number(data.costoTerrenoM2 || 0).toLocaleString('es-MX')}/m²

MERCADO (Agente Mercado, ya calculado — úsalo para no sobredimensionar el proyecto):
${data.mercado ? `- Demanda: ${data.mercado.demanda || 'No especificada'}
- Absorción de la zona: ${data.mercado.absorcion || 'No especificada'}
- Inventario activo: ${data.mercado.inventario || 'No especificado'}
- Producto recomendado por el mercado: ${data.mercado.productoRecomendado || 'No especificado'}
- Absorción por segmento: ${(data.mercado.segmentacion || []).map((s: any) => `${s.tipo}: ${s.absorcionMensual ?? '?'} unidades/mes (${s.participacion ?? '?'} de participación)`).join('; ') || 'No especificada'}` : '- No disponible — procede con el envolvente legal como única referencia de tamaño'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — ENVOLVENTE Y ÁREAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${envolvente ? `VALORES APROBADOS — YA CALCULADOS EN CÓDIGO A PARTIR DEL COS/CUS DE LA FICHA LEGAL. NO RECALCULES COS/CUS NI INVENTES UN % DE EFICIENCIA VENDIBLE DISTINTO — úsalos exactamente:
- areaMaxConstruible (techo normativo COS/CUS, el límite duro): ${envolvente.areaMaxConstruible} m²
- areaConstruida — rango piso/base/techo según aprovechamiento real del lote: ${envolvente.areaConstruida.piso} / ${envolvente.areaConstruida.base} / ${envolvente.areaConstruida.techo} m²
- areaVendible — rango piso/base/techo (ya neto de estacionamiento, circulaciones, amenidades y cuartos de servicio): ${envolvente.areaVendible.piso} / ${envolvente.areaVendible.base} / ${envolvente.areaVendible.techo} m²
- eficienciaVendiblePct: ${envolvente.eficienciaVendiblePct.base}% (rango ${envolvente.eficienciaVendiblePct.piso}–${envolvente.eficienciaVendiblePct.techo}%) — este es el % que debe dar Zona 1 / superficieConstruida, no un valor distinto

Usa superficieConstruida = ${envolvente.areaConstruida.base} m² (el valor "base") por default.
${data.mercado ? `Si la absorción de mercado de abajo sugiere un proyecto más chico, puedes bajar hasta superficieConstruida = ${envolvente.areaConstruida.piso} m² (el "piso") — pero NUNCA subas por encima de ${envolvente.areaConstruida.techo} m² (el "techo") ni de ${envolvente.areaMaxConstruible} m² (areaMaxConstruible).` : `NUNCA subas por encima de ${envolvente.areaConstruida.techo} m² (el "techo") ni de ${envolvente.areaMaxConstruible} m² (areaMaxConstruible).`}
superficieVendible debe ser exactamente ${envolvente.eficienciaVendiblePct.base}% (±2 puntos) de la superficieConstruida que elijas — no una eficiencia distinta a la ya calculada.` : `No llegó ficha legal con valores numéricos de COS/CUS para este predio — estima tú mismo:

Estima COS y CUS típicos para el uso de suelo, tipología y municipio indicados.

COS (Coeficiente de Ocupación del Suelo): porcentaje del terreno que puede cubrirse con construcción (huella).
  huella_maxima = superficie_lote × COS
  area_libre_y_verde = superficie_lote − huella_maxima
  (jardines, accesos, estacionamiento descubierto, área libre normativa)

CUS (Coeficiente de Utilización del Suelo): múltiplo del lote que puede construirse en total de niveles.
  superficie_construida_bruta_MAXIMA = superficie_lote × CUS
  (este es el TECHO NORMATIVO — lo máximo que la ley permite, NO necesariamente el tamaño del proyecto)`}

TAMAÑO REAL DEL PROYECTO — no siempre uses el máximo legal:
  El tamaño real a construir es el MENOR entre el techo normativo (arriba) y lo que el mercado puede
  absorber en un horizonte comercial razonable de 18-36 meses. Si hay datos de MERCADO arriba, suma la
  absorción mensual de los segmentos relevantes × 24 meses (horizonte típico) como techo de unidades —
  si el envolvente legal permite más unidades que ese techo de absorción, propón un proyecto MÁS CHICO
  (documenta en tu razonamiento que el envolvente legal permitiría más, pero el mercado no lo justifica;
  no hace falta agotar el envolvente legal solo porque la normativa lo permite). Si no hay datos de
  mercado disponibles, usa el envolvente legal completo como hoy.

Si el terreno tiene pendiente moderada o pronunciada:
  - Reduce superficie construible efectiva 10–20%
  - Suma sobrecosto de cimentación especial ($800k–$1.5M según grado, reflejado en zona "Cuartos de servicio / obra especial")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — DESGLOSE POR ZONAS DE CONSTRUCCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La superficie construida bruta NO es toda vendible. Divídela en las siguientes zonas con su participación típica y costo diferenciado:

ZONA 1 — ÁREA VENDIBLE (casa habitación / departamentos / locales según tipología)
  IMPORTANTE: Para desarrollo UNIFAMILIAR, esta zona es la vivienda completa (1 sola unidad). No estimes múltiples unidades.
  Participación: ${envolvente ? `FIJADA en ${envolvente.eficienciaVendiblePct.base}% de la superficie construida (ver VALORES APROBADOS del PASO 1) — no uses un % distinto.` : '60–72% de superficie bruta (residencial vertical); para unifamiliar puede llegar a 80–85% sin circulaciones de edificio.'}
  Costo/m²: 100% del costo de banda (el más alto — acabados completos)
  Qué incluye: muros, losa, cancelería, instalaciones completas, acabados de banda

${envolvente ? `Las zonas 2–5 (estacionamiento, circulaciones, áreas comunes, cuartos de servicio) juntas deben sumar EXACTAMENTE el área no vendible (superficieConstruida − superficieVendible). Repártela entre ellas usando estas proporciones relativas entre sí:` : ''}
ZONA 2 — ESTACIONAMIENTO
  Participación: ${envolvente ? '~55% del área NO vendible (ver arriba)' : '15–25% de superficie bruta (cajones cubiertos o semienterrados)'}
  Cajones requeridos: estima 1.0–1.5 cajones/unidad; área 25–30 m²/cajón incluyendo circulación vehicular
  Costo/m²: 40–55% del costo de banda (solo estructura + losa + señalización, sin acabados residenciales)
  Qué incluye: losa de concreto, estructura, drenaje pluvial, señalización, iluminación básica
  NOTA: si el estacionamiento es en sótano, agrega 20–35% al costo de esa zona por excavación y muros milán

ZONA 3 — CIRCULACIONES Y NÚCLEOS VERTICALES
  Participación: ${envolvente ? '~25% del área NO vendible (ver arriba)' : '8–12% de superficie bruta'}
  Costo/m²: 65–75% del costo de banda
  Qué incluye: pasillos, lobbies de piso, escaleras de emergencia, shaft de elevadores, vestíbulos

ZONA 4 — ÁREAS COMUNES Y AMENIDADES
  Participación: ${envolvente ? '~15% del área NO vendible (ver arriba; varía por banda)' : '4–8% de superficie bruta (varía mucho por banda)'}
  Costo/m²: 80–115% del costo de banda (acabados diferenciados, piezas especiales)
  Qué incluye: lobby principal, gimnasio, roof garden, salón de eventos, alberca (banda 3–4), coworking
  NOTA: para Banda 1 reduce y usa 70% del costo; para Banda 4 puede llegar a 20–25% del área no vendible

ZONA 5 — CUARTOS DE SERVICIO E INSTALACIONES ESPECIALES
  Participación: ${envolvente ? '~5% del área NO vendible (ver arriba)' : '2–4% de superficie bruta'}
  Costo/m²: 50–65% del costo de banda
  Qué incluye: cisterna, cuarto de bombas, cuarto eléctrico/subestación, cuarto de basura, cuarto de gas, bodegas de mantenimiento

URBANIZACIÓN Y EXTERIORES (aplica al área libre/verde del lote — NO es superficie construida)
  Costo estimado: $800–$2,500/m² de área libre según banda (jardines, accesos, alumbrado, banqueta)
  Se suma al costo total pero no se cuenta como m² construido

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — ${(data.nivelesOverride || data.totalDeptosOverride || data.totalLocalesOverride || data.amenidadesNivelOverride) ? 'TIPOLOGÍA FIJADA MANUALMENTE POR EL USUARIO' : 'PROPONER TIPOLOGÍA DE LA CONSTRUCCIÓN'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(data.nivelesOverride || data.totalDeptosOverride || data.totalLocalesOverride || data.amenidadesNivelOverride)
  ? `El usuario revisó tu propuesta de una corrida anterior y fijó algunos valores manualmente — úsalos EXACTAMENTE como se indican arriba y ajusta el resto de la tipología (mix de recámaras, m² promedio) para que sea consistente con ellos y con el área vendible de Zona 1. En "tipologiaPropuesta" documenta cuáles valores fueron fijados manualmente.`
  : `Con base en la superficie construida bruta y el área vendible (Zona 1), propón una tipología concreta y realista — no dejes esto solo en porcentajes de zona.`}

Para HABITACIONAL (residencial vertical/horizontal/unifamiliar):
- Determina el número de NIVELES (pisos) del edificio, coherente con el CUS estimado.
- Para UNIFAMILIAR: 1 sola unidad — documenta los niveles de la vivienda (1-3 típico), no el total de deptos.
- Para vertical/horizontal: propón el número TOTAL de departamentos y su mix por número de recámaras (1, 2 y 3 recámaras) con unidades y m² promedio de cada tipo. La suma de (unidades × m² promedio) del mix debe ser consistente con el área vendible de Zona 1.

Para COMERCIAL/MIXTO (si el tipo de desarrollo lo incluye):
- Propón el número de locales y en cuántos niveles se distribuyen.

Para AMENIDADES (Zona 4 — Áreas comunes):
- Clasifica el tamaño en escala 1-3: 1 = mínimas (solo lobby + área de paquetería), 2 = intermedias (lobby + gimnasio + roof garden básico), 3 = top (alberca, salón de eventos, coworking, spa). Debe ser consistente con la banda de acabados (banda 1-2 → nivel 1, banda 3 → nivel 2, banda 4 → nivel 3), salvo que el usuario haya fijado el nivel manualmente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 4 — COSTO POR PARTIDAS (sobre área vendible)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Desglosa el costo/m² de la zona vendible en 8 partidas estándar (suman 100%).

PASO 5 — MATERIALES PRINCIPALES (sobre área vendible)
Lista 6 materiales con cantidad y precio unitario.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 6 — CÁLCULO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
costoTotalConstruccion = suma(m² zona × costo/m² zona para zonas 1–5) + costo urbanización
construccionM2 = costoTotalConstruccion / superficieConstruida (promedio ponderado)
superficieVendible = m² de Zona 1
superficieConstruida = suma de m² zonas 1–5

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
  "superficieConstruida": 1440,
  "superficieVendible": 921,
  "bitacoraConstruccion": {
    "bandaElegida": 2,
    "nombreBanda": "Media Estándar",
    "descripcionBanda": "1-2 oraciones de qué incluye esta banda en estructura, acabados y equipamiento",
    "costoPorM2Base": 13000,
    "ciudadAjuste": "Descripción del ajuste por ciudad",
    "tipologiaAjuste": "Descripción del ajuste por tipología y niveles estimados",
    "cosEstimado": "60%",
    "cusEstimado": "1.8",
    "tipologiaPropuesta": {
      "niveles": 8,
      "habitacional": {
        "totalDepartamentos": 36,
        "mix": [
          { "tipo": "1 recámara", "unidades": 18, "m2Promedio": 55 },
          { "tipo": "2 recámaras", "unidades": 12, "m2Promedio": 75 },
          { "tipo": "3 recámaras", "unidades": 6, "m2Promedio": 100 }
        ]
      },
      "comercial": null,
      "tamanoAmenidades": 2,
      "fijadoManualmente": []
    },
    "ajustes": [
      {
        "concepto": "Ajuste por ciudad (ej: Culiacán — ciudad media del norte)",
        "descripcion": "Explicación del factor ciudad sobre el costo CMIC base",
        "factorAjuste": "-3%",
        "impactoM2": -390
      },
      {
        "concepto": "Ajuste por tipología (ej: Residencial vertical 8 niveles)",
        "descripcion": "Cómo la tipología afecta el costo por m²",
        "factorAjuste": "+5%",
        "impactoM2": 650
      }
    ],
    "costoPorM2VendibleFinal": 13000,
    "costoPorM2Final": 14200,
    "superficieConstruccionM2": 1440,
    "costoTotalConstruccion": 23760000,
    "formula": "Suma ponderada por zona: $X (vendible) + $Y (estac.) + $Z (circ.) + ... = $23,760,000",
    "fuenteReferencia": "CMIC/CEICO — Índice de Costos de Construcción Residencial, 2025",
    "razonamiento": "3-5 oraciones: cómo se determinó la superficie construible, zonas, ajustes aplicados y por qué",
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
      "superficieLote": 800,
      "cosEstimado": "60%",
      "cusEstimado": "1.8",
      "huellaMaximaCOS": 480,
      "superficieTotalBruta": 1440,
      "eficiencia": "64%",
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
          "cajonesEstimados": 12,
          "m2PorCajon": 24,
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
${envolvente ? `- superficieConstruida DEBE estar entre ${envolvente.areaConstruida.piso} y ${envolvente.areaConstruida.techo} m² (rango piso–techo del VALORES APROBADOS del PASO 1) — nunca fuera de ese rango
- superficieVendible DEBE ser ${envolvente.eficienciaVendiblePct.base}% (±2 pts) de la superficieConstruida elegida — no la calcules con un % distinto al ya fijado
${densidadMaxUnidades ? `- El total de unidades habitacionales propuestas NO debe ser menor al ${Math.round(0.70 * 100)}% de ${densidadMaxUnidades} (densidad máxima autorizada) salvo que la absorción de mercado justifique explícitamente un proyecto más chico — documenta esa decisión en el razonamiento si aplica
- El total de unidades habitacionales propuestas NUNCA debe superar ${densidadMaxUnidades} (densidad máxima autorizada) — es un techo legal duro, no una meta; si el área vendible calculada permitiría más unidades a tu m² promedio típico, usa un m² promedio más grande en vez de agregar más unidades` : ''}` : ''}
- tipologiaPropuesta.habitacional solo aplica si hay tipología habitacional; tipologiaPropuesta.comercial solo si el desarrollo incluye locales (si no aplica, usa null)
- tipologiaPropuesta.habitacional.mix: unidades × m2Promedio sumado debe aproximar el área vendible de Zona 1 (±10%)
- tipologiaPropuesta.fijadoManualmente: array con los nombres de los campos que el usuario fijó manualmente (ej. ["niveles", "totalDepartamentos"]), vacío si ninguno
- construccionM2 es el costo PONDERADO total (costoTotalConstruccion / superficieConstruida)
- bitacoraConstruccion.costoPorM2Final debe coincidir exactamente con construccionM2
- bitacoraConstruccion.costoPorM2VendibleFinal es el costo/m² SOLO del área vendible (Zona 1)
- bitacoraConstruccion.costoTotalConstruccion debe coincidir con la variable raíz costoTotalConstruccion
- costoTotalConstruccion = suma de costoTotal de todas las zonas + costoUrbanizacion del área verde/libre
- desgloseConstruccion.zonas[*].m2 deben sumar exactamente superficieConstruida
- desgloseConstruccion.zonas[*].participacion debe reflejar el % real de cada zona sobre superficieConstruida
- eficiencia = m2 de zona vendible / superficieConstruida × 100
- desglosePorPartidas: exactamente 8 partidas, porcentajes suman 100, costoPorM2 = round(costoPorM2VendibleFinal × porcentaje / 100)
- materialesPrincipales: exactamente 6 materiales
- Si pendiente pronunciada: suma el sobrecosto en el total y documenta en cuartos de servicio / ajustes
- superficieVendible en raíz = m2 de Zona 1 (área vendible)
- Si hay datos de MERCADO disponibles: el número total de unidades propuestas (tipologiaPropuesta) no debe exceder significativamente lo que la absorción de mercado sugiere vender en 18-36 meses, aunque el envolvente legal (COS/CUS) permita más — el máximo legal es un TECHO, no una meta a alcanzar siempre
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
      if (typeof bc.superficieConstruccionM2 === 'number') parsed.superficieConstruida = bc.superficieConstruccionM2
      const zonaVendible = bc.desgloseConstruccion?.zonas?.find((z: { zona?: string }) => /vendible/i.test(z.zona || ''))
      if (zonaVendible && typeof zonaVendible.m2 === 'number') parsed.superficieVendible = zonaVendible.m2
    }

    // Validación de mix contra el envolvente determinístico (lib/analisis/envolventeYAreas.ts)
    // — se anota en la bitácora para que el usuario vea si el modelo se desvió del área
    // vendible/densidad ya aprobados, sin bloquear la respuesta.
    if (envolvente && parsed.bitacoraConstruccion) {
      const mix = parsed.bitacoraConstruccion?.tipologiaPropuesta?.habitacional?.mix
      if (Array.isArray(mix) && mix.length > 0) {
        parsed.bitacoraConstruccion.validacionEnvolvente = validarMix(mix, envolvente.areaVendible.base, densidadMaxUnidades)
      }
    }

    // Litmus de viabilidad — spread entre precio de venta/m² vendible (Agente Mercado) y
    // costo de construcción/m² vendible (este agente). Un spread < 1.6 es señal temprana de
    // proyecto probablemente inviable, antes de correr todo el pipeline financiero. Usa los
    // números REALES que devolvió el modelo (no el envolvente teórico), para detectar si el
    // propio cálculo del modelo ya viene comprometido.
    const precioVentaM2Litmus = data.mercado?.pricingFases?.[2]?.precioM2
      || Number((data.mercado?.precioPromedioZona ?? '').toString().replace(/[^0-9]/g, '')) || 0
    const superficieVendibleReal = Number(parsed.superficieVendible) || 0
    const costoTotalConstruccionReal = Number(parsed.costoTotalConstruccion) || 0
    if (precioVentaM2Litmus > 0 && superficieVendibleReal > 0 && costoTotalConstruccionReal > 0 && parsed.bitacoraConstruccion) {
      const costoConstruccionPorM2Vendible = costoTotalConstruccionReal / superficieVendibleReal
      const spreadVentaConstruccion = costoConstruccionPorM2Vendible > 0 ? precioVentaM2Litmus / costoConstruccionPorM2Vendible : null
      parsed.bitacoraConstruccion.litmusViabilidad = {
        precioVentaM2: precioVentaM2Litmus,
        costoConstruccionPorM2Vendible: Math.round(costoConstruccionPorM2Vendible),
        spreadVentaConstruccion: spreadVentaConstruccion !== null ? Math.round(spreadVentaConstruccion * 100) / 100 : null,
        alerta: spreadVentaConstruccion !== null && spreadVentaConstruccion < 1.6,
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Construcción error:', error)
    return NextResponse.json({ error: 'Error en Agente Construcción' }, { status: 500 })
  }
}
