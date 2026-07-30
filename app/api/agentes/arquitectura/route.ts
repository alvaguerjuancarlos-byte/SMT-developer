import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { calcularEnvolvente, validarMix, validarSuperficieConstruida } from '@/lib/analisis/envolventeYAreas'
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

  const prompt = `Eres el Agente de Arquitectura de SMT Developer.
Tu única tarea es proponer el diseño del proyecto — envolvente legal, desglose de áreas por zona (m², no costo) y tipología de unidades — maximizando la capacidad que permite la normativa del predio.
No calculas costos de construcción, valor de terreno ni mercado. El Agente de Construcción tomará tu diseño como dato ya aprobado y solo lo costeará; el Agente de Mercado evalúa después si ese tamaño de proyecto tiene demanda, pero esa evaluación no te corresponde a ti ni debe achicar tu propuesta.

DATOS DEL PROYECTO:
- Ciudad: ${data.ciudad}, ${data.estado}
- Superficie del terreno: ${data.superficie} m²
- Tipo(s) de desarrollo: ${tiposLabels}
- Banda de acabados elegida por el inversionista: ${bandaLabels[data.bandaConstruccion] || 'No especificada'} (solo para calibrar el nivel de amenidades del PASO 3, el costeo por banda lo hace Construcción)
- Pendiente del terreno: ${data.pendiente || 'No proporcionada'}
${data.nivelesOverride ? `- Niveles FIJADOS por el usuario: ${data.nivelesOverride} — no los cambies` : ''}
${data.totalDeptosOverride ? `- Total de departamentos FIJADO por el usuario: ${data.totalDeptosOverride} — no lo cambies` : ''}
${data.totalLocalesOverride ? `- Total de locales comerciales FIJADO por el usuario: ${data.totalLocalesOverride} — no lo cambies` : ''}
${data.amenidadesNivelOverride ? `- Tamaño de amenidades FIJADO por el usuario: nivel ${data.amenidadesNivelOverride} de 3 — no lo cambies` : ''}

CONTEXTO DE VALUACIÓN DEL TERRENO:
- Uso de suelo: ${data.usoSuelo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — ENVOLVENTE Y ÁREAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${envolvente ? `VALORES APROBADOS — YA CALCULADOS EN CÓDIGO A PARTIR DEL COS/CUS DE LA FICHA LEGAL. NO RECALCULES COS/CUS NI INVENTES UN % DE EFICIENCIA VENDIBLE DISTINTO — úsalos exactamente:
- areaMaxConstruible (techo normativo COS/CUS, el límite duro): ${envolvente.areaMaxConstruible} m²
- areaConstruida — rango piso/base/techo según aprovechamiento real del lote: ${envolvente.areaConstruida.piso} / ${envolvente.areaConstruida.base} / ${envolvente.areaConstruida.techo} m²
- areaVendible — rango piso/base/techo (ya neto de estacionamiento, circulaciones, amenidades y cuartos de servicio): ${envolvente.areaVendible.piso} / ${envolvente.areaVendible.base} / ${envolvente.areaVendible.techo} m²
- eficienciaVendiblePct: ${envolvente.eficienciaVendiblePct.base}% (rango ${envolvente.eficienciaVendiblePct.piso}–${envolvente.eficienciaVendiblePct.techo}%) — este es el % que debe dar Zona 1 / superficieConstruida, no un valor distinto

Usa superficieConstruida = ${envolvente.areaConstruida.techo} m² (el valor "techo") — diseña siempre a la máxima capacidad legal, no dejes m² sin aprovechar. NUNCA subas por encima de ${envolvente.areaMaxConstruible} m² (areaMaxConstruible).
superficieVendible debe ser exactamente ${envolvente.eficienciaVendiblePct.base}% (±2 puntos) de la superficieConstruida que elijas — no una eficiencia distinta a la ya calculada.` : `No llegó ficha legal con valores numéricos de COS/CUS para este predio — estima tú mismo:

Estima COS y CUS típicos para el uso de suelo, tipología y municipio indicados.

COS (Coeficiente de Ocupación del Suelo): porcentaje del terreno que puede cubrirse con construcción (huella).
  huella_maxima = superficie_lote × COS
  area_libre_y_verde = superficie_lote − huella_maxima
  (jardines, accesos, estacionamiento descubierto, área libre normativa)

CUS (Coeficiente de Utilización del Suelo): múltiplo del lote que puede construirse en total de niveles.
  superficie_construida_bruta = superficie_lote × CUS — diseña al máximo que permite este techo normativo.`}

Siempre diseña a la MÁXIMA capacidad que permite la normativa — no reduzcas el proyecto por absorción de mercado, demanda ni ninguna otra razón comercial; esa evaluación la hace otro agente después, sobre tu diseño ya resuelto.

Si el terreno tiene pendiente moderada o pronunciada:
  - Reduce superficie construible efectiva 10–20% y documenta el ajuste en tu razonamiento (el sobrecosto de cimentación especial que esto implica lo calcula el Agente de Construcción, aquí solo documenta la reducción de área).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — DESGLOSE DE ÁREAS POR ZONA (m², no costo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
La superficie construida bruta NO es toda vendible. Divídela en las siguientes zonas con su participación típica — el costo por zona lo calcula el Agente de Construcción después, aquí solo defines m² y participación:

ZONA 1 — ÁREA VENDIBLE (casa habitación / departamentos / locales según tipología)
  IMPORTANTE: Para desarrollo UNIFAMILIAR, esta zona es la vivienda completa (1 sola unidad). No estimes múltiples unidades.
  Participación: ${envolvente ? `FIJADA en ${envolvente.eficienciaVendiblePct.base}% de la superficie construida (ver VALORES APROBADOS del PASO 1) — no uses un % distinto.` : '60–72% de superficie bruta (residencial vertical); para unifamiliar puede llegar a 80–85% sin circulaciones de edificio.'}

${envolvente ? `Las zonas 2–5 (estacionamiento, circulaciones, áreas comunes, cuartos de servicio) juntas deben sumar EXACTAMENTE el área no vendible (superficieConstruida − superficieVendible). Repártela entre ellas usando estas proporciones relativas entre sí:` : ''}
ZONA 2 — ESTACIONAMIENTO
  Participación: ${envolvente ? '~55% del área NO vendible (ver arriba)' : '15–25% de superficie bruta (cajones cubiertos o semienterrados)'}
  Cajones requeridos: estima 1.0–1.5 cajones/unidad; área 25–30 m²/cajón incluyendo circulación vehicular

ZONA 3 — CIRCULACIONES Y NÚCLEOS VERTICALES
  Participación: ${envolvente ? '~25% del área NO vendible (ver arriba)' : '8–12% de superficie bruta'}
  Qué incluye: pasillos, lobbies de piso, escaleras de emergencia, shaft de elevadores, vestíbulos

ZONA 4 — ÁREAS COMUNES Y AMENIDADES
  Participación: ${envolvente ? '~15% del área NO vendible (ver arriba; varía por banda)' : '4–8% de superficie bruta (varía mucho por banda)'}
  Qué incluye: lobby principal, gimnasio, roof garden, salón de eventos, alberca (banda 3–4), coworking
  NOTA: para Banda 1 usa el mínimo del rango; para Banda 4 puede llegar a 20–25% del área no vendible

ZONA 5 — CUARTOS DE SERVICIO E INSTALACIONES ESPECIALES
  Participación: ${envolvente ? '~5% del área NO vendible (ver arriba)' : '2–4% de superficie bruta'}
  Qué incluye: cisterna, cuarto de bombas, cuarto eléctrico/subestación, cuarto de basura, cuarto de gas, bodegas de mantenimiento

ÁREA LIBRE Y VERDE (fuera de la superficie construida — jardines, accesos, estacionamiento descubierto, área libre normativa)

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
OUTPUT — JSON EXACTO (sin texto adicional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "superficieConstruida": 1440,
  "superficieVendible": 921,
  "bitacoraArquitectura": {
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
    "superficieConstruida": 1440,
    "superficieVendible": 921,
    "desgloseZonas": [
      { "zona": "Área vendible", "concepto": "Departamentos / unidades habitacionales", "m2": 921, "participacion": "64%" },
      { "zona": "Estacionamiento", "concepto": "Cajones cubiertos con circulación vehicular", "m2": 288, "participacion": "20%", "cajonesEstimados": 12, "m2PorCajon": 24 },
      { "zona": "Circulaciones", "concepto": "Pasillos, escaleras, núcleo de elevadores", "m2": 144, "participacion": "10%" },
      { "zona": "Áreas comunes", "concepto": "Lobby, amenidades, roof garden", "m2": 72, "participacion": "5%" },
      { "zona": "Cuartos de servicio", "concepto": "Cisterna, cuarto de máquinas, subestación, basura", "m2": 15, "participacion": "1%" }
    ],
    "areaLibreYVerde": {
      "m2": 320,
      "porcentajeLote": "40%",
      "descripcion": "Área sin construir: jardines, accesos peatonales, estacionamiento descubierto, área libre normativa"
    },
    "razonamiento": "3-5 oraciones: cómo se determinó la superficie construible, las zonas y la tipología",
    "supuestos": [
      "Estacionamiento cubierto en planta baja / semisótano",
      "Verificar COS/CUS con PDU municipal antes del cierre"
    ]
  }
}

REGLAS:
${envolvente ? `- superficieConstruida DEBE estar entre ${envolvente.areaConstruida.piso} y ${envolvente.areaMaxConstruible} m² — apunta al techo, nunca fuera de ese rango
- superficieVendible DEBE ser ${envolvente.eficienciaVendiblePct.base}% (±2 pts) de la superficieConstruida elegida — no la calcules con un % distinto al ya fijado
${densidadMaxUnidades ? `- El total de unidades habitacionales propuestas debe aproximarse a ${densidadMaxUnidades} (densidad máxima autorizada) sin excederla — es un techo legal duro que debes buscar alcanzar, no solo respetar; si el área vendible calculada permitiría más unidades a tu m² promedio típico, ajusta el m² promedio en vez de quedarte corto de unidades` : ''}` : ''}
- tipologiaPropuesta.habitacional solo aplica si hay tipología habitacional; tipologiaPropuesta.comercial solo si el desarrollo incluye locales (si no aplica, usa null)
- tipologiaPropuesta.habitacional.mix: unidades × m2Promedio sumado debe aproximar el área vendible de Zona 1 (±10%)
- tipologiaPropuesta.fijadoManualmente: array con los nombres de los campos que el usuario fijó manualmente (ej. ["niveles", "totalDepartamentos"]), vacío si ninguno
- desgloseZonas[*].m2 deben sumar exactamente superficieConstruida
- desgloseZonas[*].participacion debe reflejar el % real de cada zona sobre superficieConstruida
- bitacoraArquitectura.superficieConstruida/superficieVendible deben coincidir exactamente con las variables raíz del mismo nombre
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
    const parsed = JSON.parse(match[0])

    // Mismo patrón que ya usaba el Agente de Construcción: el modelo a veces no mantiene
    // consistencia entre los campos raíz y su propia bitácora — se sobrescribe la raíz con
    // la bitácora en vez de confiar en que el modelo cumplió su propia regla.
    if (parsed.bitacoraArquitectura) {
      const ba = parsed.bitacoraArquitectura
      if (typeof ba.superficieConstruida === 'number') parsed.superficieConstruida = ba.superficieConstruida
      if (typeof ba.superficieVendible === 'number') parsed.superficieVendible = ba.superficieVendible
    }

    // Validación de mix contra el envolvente determinístico (lib/analisis/envolventeYAreas.ts)
    // — se anota en la bitácora para que el usuario vea si el modelo se desvió del área
    // vendible/densidad ya aprobados, sin bloquear la respuesta.
    if (envolvente && parsed.bitacoraArquitectura) {
      const mix = parsed.bitacoraArquitectura?.tipologiaPropuesta?.habitacional?.mix
      if (Array.isArray(mix) && mix.length > 0) {
        parsed.bitacoraArquitectura.validacionEnvolvente = validarMix(mix, envolvente.areaVendible.base, densidadMaxUnidades)
      }
      const superficiePropuesta = Number(parsed.superficieConstruida) || 0
      if (superficiePropuesta > 0) {
        parsed.bitacoraArquitectura.validacionSuperficieConstruida = validarSuperficieConstruida(superficiePropuesta, envolvente)
      }
      // Se expone el rango completo del envolvente (piso/base/techo) para que el frontend
      // transparente de dónde sale el m² a construir, en vez de mostrar solo el número final
      // que eligió el modelo.
      parsed.bitacoraArquitectura.envolventeCalculada = {
        areaMaxConstruible: envolvente.areaMaxConstruible,
        areaConstruida: envolvente.areaConstruida,
        areaVendible: envolvente.areaVendible,
        eficienciaVendiblePct: envolvente.eficienciaVendiblePct,
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Agente Arquitectura error:', error)
    return NextResponse.json({ error: 'Error en Agente Arquitectura' }, { status: 500 })
  }
}
