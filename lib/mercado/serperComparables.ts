// Búsqueda de comparables con Serper + verificación de lo que extrae Haiku. Lo comparten
// app/api/agentes/comparables (terreno) y comparables-venta (vivienda terminada).
//
// Serper solo regresa el título y el snippet que muestra Google — si el snippet no trae precio
// o superficie no hay de dónde sacarlos. Visto en producción (Valle Alto, Culiacán, 2-nov-2026):
// Haiku "completaba" datos que no estaban (le puso $600,000 a una casa de $14,500) y tomaba
// "pagos de $90,000" o "desde $1,150,000" como precio total. Por eso Haiku debe citar el texto
// exacto de cada número y aquí se comprueba que la cita exista en el resultado y contenga ese
// número; lo que no se puede comprobar se descarta.

export interface ResultadoSerper {
  id: number
  url: string
  titulo: string
  texto: string // título + snippet + atributos/fecha que Google haya mostrado
}

export async function buscarSerper(queries: string[], serperKey: string, num = 10): Promise<ResultadoSerper[]> {
  const respuestas = await Promise.all(queries.map(async (q) => {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, gl: 'mx', hl: 'es', num }),
      })
      if (!res.ok) return []
      const json = await res.json()
      return (json.organic ?? []) as any[]
    } catch {
      return []
    }
  }))

  const vistos = new Set<string>()
  const resultados: ResultadoSerper[] = []
  for (const r of respuestas.flat()) {
    const url = String(r.link ?? '').split('#')[0]
    if (!url || vistos.has(url)) continue
    vistos.add(url)
    const atributos = r.attributes
      ? Object.entries(r.attributes).map(([k, v]) => `${k}: ${v}`).join('; ')
      : ''
    const texto = [r.title, r.snippet, atributos, r.date].filter(Boolean).join(' | ')
    resultados.push({ id: resultados.length + 1, url, titulo: String(r.title ?? ''), texto })
  }
  return resultados
}

export function formatearResultados(resultados: ResultadoSerper[]): string {
  return resultados.map(r => `[${r.id}] URL: ${r.url}\nTEXTO: ${r.texto}`).join('\n---\n')
}

export function portalDeUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const conocidos: Record<string, string> = {
      'lamudi.com.mx': 'Lamudi', 'inmuebles24.com': 'Inmuebles24', 'propiedades.com': 'Propiedades.com',
      'vivanuncios.com.mx': 'Vivanuncios', 'icasas.mx': 'iCasas', 'facebook.com': 'Facebook',
      'casasyterrenos.com': 'Casas y Terrenos', 'metroscubicos.com': 'Metros Cúbicos',
    }
    for (const [dominio, nombre] of Object.entries(conocidos)) if (host.endsWith(dominio)) return nombre
    if (host.includes('mercadolibre')) return 'Mercado Libre'
    return host
  } catch {
    return 'Web'
  }
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// "$1,150,000", "1.2 millones", "2.5 mdp", "120 m²", "$3,500/m2" → números de la cita (el 2 de "m2" no cuenta).
export function numerosDeCita(cita: string): number[] {
  // "$8, 000" / "1, 000 m2": separador de miles con espacio (visto en Inmuebles24).
  const t = normalizar(cita).replace(/(\d)([,.]) (\d{3})(?!\d)/g, '$1$2$3')
  const out: number[] = []
  const re = /(?<![a-z\d])(\d{1,3}(?:[,.]\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millon|mdp|mill|mil|k)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const crudo = m[1]
    // 1,150,000 / 1.150.000 son miles; 1.2 / 2,5 son decimales.
    const n = /[,.]\d{3}([,.]|$)/.test(crudo) ? Number(crudo.replace(/[,.]/g, '')) : Number(crudo.replace(',', '.'))
    if (!Number.isFinite(n)) continue
    const suf = m[2]
    if (suf && /^mill|^mdp/.test(suf)) out.push(n * 1_000_000)
    else if (suf === 'mil' || suf === 'k') out.push(n * 1_000)
    else out.push(n)
  }
  return out
}

// Precios que no son el precio de venta del inmueble.
const PRECIO_NO_TOTAL = /\b(pagos?|mensualidad|mensual|enganche|apartado|renta|al mes|\/mes)\b/
// Resúmenes de muchos anuncios: "desde $1,150,000", "a partir de", "de 76 a 136 m²".
const RANGO = /\b(desde|a partir|hasta)\b|\d\s*(a|al|-)\s*\$?\s*\d/

export type MotivoDescarte = 'sin_evidencia' | 'varios_anuncios' | 'no_aplica' | 'sin_precio' | 'fuera_de_rango' | 'repetido'

// Verifica un campo numérico contra su cita: la cita debe estar en el texto del resultado y
// contener el número (±2%), y ni la cita ni lo que la rodea pueden ser un rango o, si es
// precio, una mensualidad (Haiku a veces cita "$1,150,000" sin el "desde" que va antes).
export function verificarCampo(
  valor: number | null | undefined,
  cita: string | null | undefined,
  textoFuente: string,
  opciones: { esPrecio?: boolean } = {},
): number | null {
  if (valor == null || !Number.isFinite(Number(valor)) || Number(valor) <= 0 || !cita) return null
  const v = Number(valor)
  const citaN = normalizar(cita)
  const textoN = normalizar(textoFuente)
  const pos = citaN.length < 2 ? -1 : textoN.indexOf(citaN)
  if (pos < 0) return null
  const antes = textoN.slice(Math.max(0, pos - 20), pos)
  const despues = textoN.slice(pos + citaN.length, pos + citaN.length + 8)
  if (RANGO.test(antes + citaN + despues)) return null
  if (opciones.esPrecio && PRECIO_NO_TOTAL.test(antes + citaN)) return null
  const coincide = numerosDeCita(cita).some(n => Math.abs(n - v) / v <= 0.02)
  return coincide ? v : null
}

// Haiku a veces regresa la fuente como "[3]" o "3" en lugar de 3.
export function numeroDeFuente(v: unknown): number | null {
  const m = String(v ?? '').match(/\d+/)
  return m ? Number(m[0]) : null
}
