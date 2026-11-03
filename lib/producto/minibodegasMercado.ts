// Agente Mercado para minibodegas en RENTA — el análisis de venta (absorción en unidades/mes,
// preventa, NSE del comprador) no aplica: una minibodega se renta por mes. Se conservan las
// llaves del JSON de venta para que la pantalla y Mastermind sigan funcionando, con significado
// de renta, y se agrega mercado.renta, que es lo que usa el Agente Financiero.

import { SUPUESTOS_MINIBODEGAS } from './minibodegas'

const S = SUPUESTOS_MINIBODEGAS

export function promptMercadoMinibodegas(data: any, comparables: any[]): string {
  const lineas = comparables.map((c: any) =>
    `- ${c.nombre} | ${c.direccion} | renta $${c.precioM2}/m²/mes | ${c.tipologia ?? '?'} | ${c.url}`).join('\n')
  return `Eres el Agente de Análisis de Mercado de SMT Land.
El proyecto es de MINIBODEGAS (self storage) PARA RENTA — no se venden unidades. Analiza el mercado de renta de
bodegas chicas (3 a 30 m²) en la zona del predio: competidores, renta por m² al mes, ocupación y demanda.
No calculas valor del terreno, costos de construcción ni análisis legal.

DATOS DEL PROYECTO:
- Colonia: ${data.colonia}, ${data.ciudad}, ${data.estado}
- Código postal: ${data.codigoPostal || 'No proporcionado'}
- Superficie del terreno: ${data.superficie} m²
${data.mixUnidadesResumen ? `- MEZCLA DE BODEGAS definida por el Agente de Arquitectura: ${data.mixUnidadesResumen}` : ''}

${comparables.length > 0
    ? `RENTAS REALES VERIFICADAS (Google, en tiempo real — cada número se comprobó en el texto del anuncio):
${lineas}
Usa estas rentas como ancla de renta.rentaM2MesPromedio y ponlas en "comparables".`
    : 'No se encontraron rentas verificadas en Google para esta ciudad. Estima con prudencia y dilo en renta.notas (fuente "estimación").'}

ANÁLISIS:
OFERTA: competidores de minibodegas en ~5 km (cadenas y locales), su renta por m² al mes y tamaños.
DEMANDA: quién renta (mudanzas, departamentos chicos, comercio y e-commerce, archivo de empresas), densidad de
vivienda y comercio alrededor, y qué tan rápido se llena una minibodega nueva.
CRUCE: renta promedio por m² al mes para este producto, ocupación estabilizada esperada, meses para llegar a ella y
tamaños con más demanda.

Referencias de la industria si no hay datos locales (márcalas como estimación): ocupación estabilizada
${Math.round(S.ocupacionEstabilizada * 100)}%, ${S.mesesEstabilizacion} meses para estabilizar. Las bodegas chicas rentan más caro por m² que las grandes.

OUTPUT — JSON EXACTO (sin texto adicional), mismas llaves que el análisis de venta con significado de RENTA:
{
  "mercado": {
    "demanda": "Alta | Media | Baja",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "Ocupación esperada, ej. 88% en 30 meses",
    "proyectosActivos": "ej. 3 minibodegas en radio 5 km",
    "precioPromedioZona": "ej. $280/m²/mes",
    "perfilNSE": "Quién renta (hogares, comercio, empresas)",
    "plusvalia": "Tendencia de la zona (crecimiento de vivienda y comercio)",
    "inventario": "Lectura de saturación de minibodegas en la zona",
    "productoRecomendado": "Tamaños, niveles, acceso vehicular, seguridad y renta objetivo",
    "comparables": [
      { "nombre": "Competidor", "direccion": "Dirección aproximada", "fechaReferencia": "Q4 2026", "precioM2": 280, "avanceObra": "Entregado", "unidades": 0, "tipologia": "Bodega 6 m² · $1,680/mes" }
    ],
    "ofertaActiva": {
      "proyectosEnPreventa": 0, "proyectosEnObra": 0, "proyectosEntregados24m": 0,
      "unidadesDisponibles": 0,
      "rangoPrecios": "ej. $200–$380/m²/mes",
      "saturacion": "Competencia y huecos de oferta"
    },
    "segmentacion": [
      { "tipo": "Bodega 3–6 m²", "absorcionMensual": "Demanda alta", "precioM2": 320, "participacion": "40%", "perfilComprador": "Hogares en departamento, mudanzas" },
      { "tipo": "Bodega 9–15 m²", "absorcionMensual": "Demanda media", "precioM2": 270, "participacion": "40%", "perfilComprador": "Comercio, e-commerce" },
      { "tipo": "Bodega 30 m²", "absorcionMensual": "Demanda baja", "precioM2": 220, "participacion": "20%", "perfilComprador": "Empresas, inventario" }
    ],
    "pricingFases": [
      { "fase": "Apertura", "precioM2": 240, "descuento": "15%", "meta": "Promoción de lanzamiento (ej. primer mes gratis)" },
      { "fase": "Llenado", "precioM2": 270, "descuento": "5%", "meta": "Subir la ocupación hasta ~70%" },
      { "fase": "Estabilizada", "precioM2": 280, "descuento": "0%", "meta": "Renta de lista con ocupación estabilizada" }
    ],
    "renta": {
      "rentaM2MesPromedio": 280,
      "rangoRentaM2Mes": "$200–$380",
      "ocupacionEstabilizadaPct": 88,
      "mesesEstabilizacion": 30,
      "competidores": 3,
      "fuente": "comparables web | estimación",
      "notas": "1-2 oraciones de cómo se llegó a la renta y la ocupación"
    }
  },
  "fuentes": { "mercado": [ { "nombre": "Fuente específica", "tipo": "Portal / sitio del competidor / reporte" } ] }
}

REGLAS:
- precioM2 en comparables, segmentacion y pricingFases es RENTA MENSUAL POR m² (número sin formato), nunca precio de venta
- renta.rentaM2MesPromedio es la renta de lista estabilizada, promedio ponderado por m² rentable (número)
- renta.ocupacionEstabilizadaPct entero 50–95; renta.mesesEstabilizacion entero 12–48
- avanceObra: "Entregado" para competidores operando, "En obra" o "Preventa" si se están construyendo
- segmentacion: 2 o 3 segmentos, participacion suma 100%; pricingFases exactamente 3 fases
- Los números de ejemplo del JSON son ilustrativos, no los copies
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`
}

// La renta es lo que más mueve el modelo de renta: si hay rentas verificadas en Google y el
// modelo se sale de su rango, se usa la mediana; y siempre se limita a un rango plausible (un
// precio de venta/m² colado aquí multiplicaría el ingreso por 100).
export function anclarRentaMercado(renta: any, comparables: any[]) {
  const r = { ...(renta || {}) }
  const valores = comparables.map((c: any) => Number(c.precioM2)).filter(n => n > 0).sort((a, b) => a - b)
  const mediana = valores.length ? valores[Math.floor(valores.length / 2)] : null
  let rentaM2 = Number(r.rentaM2MesPromedio) || 0
  if (mediana && (rentaM2 < valores[0] * 0.8 || rentaM2 > valores[valores.length - 1] * 1.2)) {
    r.rentaAjustada = { rentaModelo: rentaM2, motivo: 'fuera del rango de rentas verificadas', mediana }
    rentaM2 = mediana
  }
  if (rentaM2 < S.rentaM2MesMin || rentaM2 > S.rentaM2MesMax) {
    r.rentaAjustada = { rentaModelo: rentaM2, motivo: 'fuera del rango plausible de renta/m²/mes' }
    rentaM2 = mediana ?? 0
  }
  r.rentaM2MesPromedio = rentaM2
  r.comparablesVerificados = valores.length
  const ocup = Number(r.ocupacionEstabilizadaPct)
  r.ocupacionEstabilizadaPct = ocup >= 50 && ocup <= 95 ? ocup : Math.round(S.ocupacionEstabilizada * 100)
  const meses = Number(r.mesesEstabilizacion)
  r.mesesEstabilizacion = meses >= 12 && meses <= 48 ? meses : S.mesesEstabilizacion
  return r
}
