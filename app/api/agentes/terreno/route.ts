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
  const pendienteLabels: Record<string, string> = {
    plano: 'Plano (< 5%)', suave: 'Suave (5–10%)',
    moderada: 'Moderada (10–20%)', pronunciada: 'Pronunciada (> 20%)',
  }
  const formaLabels: Record<string, string> = { regular: 'Regular', irregular: 'Irregular' }
  const vistaLabels: Record<string, string> = {
    ninguna: 'Sin vista especial', sierra: 'Sierra / montaña',
    valle: 'Valle', lago: 'Lago / presa', canon: 'Cañón',
  }
  const aguaLabels: Record<string, string> = {
    'red-municipal': 'Red municipal', pozo: 'Pozo', pipa: 'Pipa', 'sin-servicio': 'Sin servicio',
  }
  const drenajeLabels: Record<string, string> = {
    'red-municipal': 'Red municipal', 'fosa-septica': 'Fosa séptica', 'sin-servicio': 'Sin servicio',
  }
  const electricidadLabels: Record<string, string> = {
    'cfe-frente': 'CFE frente al predio', extension: 'Extensión requerida', 'sin-servicio': 'Sin servicio',
  }
  const clasificacionVialLabels: Record<string, string> = {
    arterial:   'Arterial / Primaria — avenida principal o boulevard (factor +20% a +28%)',
    colectora:  'Colectora — conecta arteriales con calles locales (factor +10% a +15%)',
    secundaria: 'Secundaria — calle secundaria consolidada (factor +5% a +8%)',
    local:      'Local / Habitacional — calle interior de colonia (valor base, sin ajuste)',
    privada:    'Privada / Andador — acceso cerrado o sin salida (factor -5% a -10%)',
  }

  const prompt = `Eres el Agente de Valuación de Terrenos de SMT Developer.
Tu única tarea es estimar el valor del suelo con la máxima precisión posible usando metodología formal de avalúos urbanos en México.
No calculas construcción, mercado, ni finanzas — solo el valor del terreno.

DATOS DEL PREDIO:
- Dirección: ${data.direccion}, ${data.colonia}, ${data.ciudad}, ${data.estado}
- Código postal: ${data.codigoPostal || 'No proporcionado'}
- Superficie: ${data.superficie} m²
- Uso de suelo actual: ${usoSueloLabels[data.usoSuelo] || data.usoSuelo}
- Estado del terreno: ${estadoLabels[data.estadoTerreno] || data.estadoTerreno}
${data.lat && data.lng ? `- Coordenadas: ${data.lat}, ${data.lng}` : ''}

CARACTERÍSTICAS FÍSICAS (pistas de valuación proporcionadas por el usuario):
- Frente: ${data.frente ? `${data.frente} m` : 'No proporcionado'}
- Clasificación vial: ${data.clasificacionVial ? clasificacionVialLabels[data.clasificacionVial] : 'No proporcionada — inferir de la dirección'}
- Forma del terreno: ${data.formaTerreno ? formaLabels[data.formaTerreno] : 'No proporcionada'}
- Pendiente: ${data.pendiente ? pendienteLabels[data.pendiente] : 'No proporcionada'}
- ¿Es esquina?: ${data.esEsquina === 'si' ? 'Sí' : data.esEsquina === 'no' ? 'No' : 'No proporcionado'}
- Vista destacada: ${data.vistaDestacada ? vistaLabels[data.vistaDestacada] : 'No proporcionada'}
- Agua: ${data.agua ? aguaLabels[data.agua] : 'No proporcionado'}
- Drenaje: ${data.drenaje ? drenajeLabels[data.drenaje] : 'No proporcionado'}
- Electricidad: ${data.electricidad ? electricidadLabels[data.electricidad] : 'No proporcionado'}
- Pavimento frente al predio: ${data.pavimento === 'si' ? 'Sí' : data.pavimento === 'no' ? 'No' : 'No proporcionado'}
- Precio solicitado: ${data.precioSolicitado ? `$${Number(data.precioSolicitado).toLocaleString('es-MX')} MXN` : 'No proporcionado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — CLASIFICAR LA COLONIA EN BANDA DE VALOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Asigna la colonia a UNA de estas 4 bandas. La banda determina qué referencias de precio puedes usar — NUNCA mezcles bandas.

BANDA 1 — Popular / Periférica
Colonias populares o periféricas con urbanización incompleta. Calles sin pavimentar o en mal estado, servicios irregulares, sin equipamiento urbano de calidad, comercio informal predominante, rezago social visible.
Plusvalía: 0–2% anual · NSE: D, D+, E

BANDA 2 — Media Popular / Consolidada
Colonias de clase trabajadora con más de 15 años de consolidación. Urbanización completa (pavimento, alumbrado, drenaje funcional), servicios estables, comercio de barrio establecido, transporte público funcional.
Plusvalía: 3–5% anual · NSE: C-, D+

BANDA 3 — Media Residencial
Colonias residenciales de clase media con infraestructura completa y bien mantenida. Plazas comerciales, escuelas privadas, parques, seguridad aceptable, imagen urbana cuidada.
Plusvalía: 6–9% anual · NSE: C, C+

BANDA 4 — Residencial Premium
Alto valor con plusvalía comprobable. Hospitales privados de primer nivel, colegios de élite, clubes deportivos, fraccionamientos cerrados, atributos diferenciales (vista, lago, golf, corredor financiero).
Plusvalía: 10%+ anual · NSE: A, B

REGLA: Usa ÚNICAMENTE referencias de terrenos de LA MISMA BANDA en la misma ciudad.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — BUSCAR COMPARABLES EN PORTALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Busca terrenos en venta en la misma zona. Prioridad: Lamudi → Inmuebles24 → Mercado Libre → Propiedades.com → Vivanuncios
Criterios: mismo CP + colonias adyacentes (radio ≤ 3 km), superficie ±30%, últimos 12 meses.
Si hay menos de 3 en radio primario, ampliar a 3–5 km y señalarlo.

Para cada comparable: portal, superficie, precio total, precio/m², colonia, distancia estimada, fecha.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — APLICAR FACTORES DE AJUSTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Aplica SOLO los factores para los que tienes dato del usuario. Si no hay dato, omite y documenta.

FACTOR DE CLASIFICACIÓN VIAL (aplicar primero, antes de otros ajustes):
- Arterial/Primaria: +20% a +28% (extremo superior si alto flujo + comercio formal + corredor reconocido)
- Colectora: +10% a +15%
- Secundaria: +5% a +8%
- Local/Habitacional: 0% (base — documenta la confirmación)
- Privada/Andador: -5% a -10%
Si no fue proporcionada, infiere de la dirección y señala como "inferida".

Otros factores (aplicar sobre el precio ya ajustado por vialidad):
- Terreno esquina: +8% a +12%
- Forma irregular: -5% a -8%
- Pendiente moderada: -6% a -8%
- Pendiente pronunciada: -12% a -18%
- Vista destacada (sierra/lago/valle): +5% a +15% según magnitud
- Servicios incompletos (sin agua o drenaje municipal): -8% a -12%
- Sin pavimento: -3% a -5%
- Baldío con escombro: -3% a -5%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 4 — ÍNDICE DE CONFIABILIDAD (IC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IC = A + B + C + D (0–100 pts)
A — Cobertura de fuentes (0–30): 3+ fuentes=30, 2=20, 1=10, inferencia=0
B — Proximidad geográfica (0–30): mismo CP/fraccionamiento=30, ≤3km=20, 3–5km=10, solo zona=0; si no hay superficie: -5
C — Vigencia (0–20): ≤6m=20, 6–12m=15, 12–24m=10, >24m=5
D — Consistencia (0–20): dispersión <10%=20, 10–20%=12, 20–30%=6, >30%=2, muestra única=8

Semáforo: VERDE (75–100) · AMARILLO (45–74) · ROJO (0–44)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — JSON EXACTO (sin texto adicional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "costoTerrenoM2": 7083,
  "costoTerreno": 8500000,
  "bitacoraTerreno": {
    "metodologia": "Comparación de mercado con ajustes por características físicas",
    "bandaTerreno": 2,
    "nombreBanda": "Media Popular / Consolidada",
    "justificacionBanda": "2-3 oraciones explicando por qué esta colonia es Banda N y no la adyacente",
    "nseReferencias": "Confirmación de que referencias son solo de la misma banda",
    "precioM2Referencia": 7500,
    "fuenteReferencia": "Fuente principal usada",
    "ajustes": [
      {
        "concepto": "Clasificación vial — [tipo]",
        "descripcion": "Descripción del ajuste aplicado",
        "factorAjuste": "+20%",
        "impactoM2": 1500
      }
    ],
    "precioM2Final": 7083,
    "superficieM2": 1200,
    "costoTotalTerreno": 8500000,
    "formula": "1,200 m² × $7,083/m² = $8,500,000",
    "razonamiento": "3-5 oraciones: qué datos de zona se usaron, qué comparables soportan el precio base, cómo se aplicaron los ajustes",
    "supuestos": [
      "Precio basado en transacciones de los últimos 12 meses",
      "No incluye ISAI estimado (2% adicional)",
      "Precio refleja condición actual sin mejoras"
    ],
    "rangoValoracion": {
      "minimo": 6500,
      "maximo": 8200,
      "interpretacion": "Rango de negociación: mínimo sin urgencia, máximo con comprador estratégico"
    },
    "fuentesComparables": [
      {
        "portal": "Lamudi",
        "superficie": 350,
        "precioTotal": 875000,
        "precioM2": 2500,
        "colonia": "nombre de colonia comparable",
        "distanciaKm": 1.2,
        "fechaPublicacion": "Mayo 2026",
        "valido": true
      }
    ],
    "indiceConfiabilidad": {
      "score": 65,
      "semaforo": "AMARILLO",
      "componenteA": 20,
      "componenteB": 20,
      "componenteC": 15,
      "componenteD": 10,
      "interpretacion": "1-2 oraciones sobre nivel de confiabilidad y qué mejoraría el IC",
      "accionRecomendada": ""
    },
    "validacionPrecioSolicitado": {
      "aplica": false,
      "precioSolicitado": 0,
      "precioCalculado": 0,
      "diferenciaPorcentaje": 0,
      "semaforo": "VERDE",
      "interpretacion": ""
    }
  }
}

REGLAS:
- costoTerrenoM2 y costoTerreno son números sin formato
- bitacoraTerreno.precioM2Final debe coincidir exactamente con costoTerrenoM2
- bitacoraTerreno.costoTotalTerreno debe coincidir exactamente con costoTerreno
- bitacoraTerreno.superficieM2 debe coincidir con la superficie del input
- ajustes: 2 a 4 ajustes reales y específicos; factorAjuste en formato "+X%" o "-X%"; impactoM2 es número
- fuentesComparables: lista real de comparables encontrados (mínima 1, máxima 5); vacía [] si no se encontraron
- validacionPrecioSolicitado.aplica: true SOLO si el usuario proporcionó precio solicitado
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
    return NextResponse.json(JSON.parse(match[0]))
  } catch (error) {
    console.error('Agente Terreno error:', error)
    return NextResponse.json({ error: 'Error en Agente Terreno' }, { status: 500 })
  }
}
