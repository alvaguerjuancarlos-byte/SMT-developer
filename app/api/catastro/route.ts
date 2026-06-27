import { NextRequest, NextResponse } from 'next/server'

// ── Municipios NL: nombre normalizado → código interno del portal egobierno ──
// Código verificado: San Pedro = 31 (del URL de ejemplo del portal)
// Resto derivado de secuencia INEGI NL (municipio 001-051)
const NL_MUNICIPIOS: Record<string, { code: number; name: string }> = {
  'apodaca':                  { code: 6,  name: 'APODACA' },
  'cadereyta jimenez':        { code: 9,  name: 'CADEREYTA JIMENEZ' },
  'cadereyta':                { code: 9,  name: 'CADEREYTA JIMENEZ' },
  'garcia':                   { code: 17, name: 'GARCIA' },
  'general escobedo':         { code: 18, name: 'GENERAL ESCOBEDO' },
  'escobedo':                 { code: 18, name: 'GENERAL ESCOBEDO' },
  'guadalupe':                { code: 19, name: 'GUADALUPE' },
  'juarez':                   { code: 21, name: 'JUAREZ' },
  'juárez':                   { code: 21, name: 'JUAREZ' },
  'linares':                  { code: 26, name: 'LINARES' },
  'monterrey':                { code: 39, name: 'MONTERREY' },
  'san nicolas de los garza': { code: 37, name: 'SAN NICOLAS DE LOS GARZA' },
  'san nicolas':              { code: 37, name: 'SAN NICOLAS DE LOS GARZA' },
  'san pedro garza garcia':   { code: 31, name: 'SAN PEDRO GARZA GARCIA' },
  'san pedro':                { code: 31, name: 'SAN PEDRO GARZA GARCIA' },
  'santa catarina':           { code: 46, name: 'SANTA CATARINA' },
  'santiago':                 { code: 48, name: 'SANTIAGO' },
}

// ── Normaliza texto: minúsculas, sin acentos ─────────────────────────────────
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ── Extrae un número monetario después de un label ───────────────────────────
function extractMoney(html: string, ...labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(label + '[^\\d$]{0,60}\\$?\\s*([\\d,\\.]+)', 'i')
    const m = html.match(re)
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(n) && n > 100) return n
    }
  }
  return null
}

// ── Extrae un número (superficie) después de un label ────────────────────────
function extractNumber(html: string, ...labels: string[]): number | null {
  for (const label of labels) {
    const re = new RegExp(label + '[^\\d]{0,40}([\\d,\\.]+)', 'i')
    const m = html.match(re)
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(n) && n > 0) return n
    }
  }
  return null
}

// ── Extrae texto de un tag <strong> que sigue a un label ────────────────────
function extractStrong(html: string, label: string): string | null {
  const re = new RegExp(label + '[^<]*<strong[^>]*>([^<]+)<\\/strong>', 'i')
  const m = html.match(re)
  return m ? m[1].trim() : null
}

// ── Suma de adeudos de la tabla predial ──────────────────────────────────────
function extractAdeudoTotal(html: string): number {
  const re = /Importe Total del Adeudo[^<]*<\/td>[^<]*<td[^>]*>\$?\s*([\d,\.]+)/i
  const m = html.match(re)
  if (m) return parseFloat(m[1].replace(/,/g, ''))
  return 0
}

// ── Scraper Nuevo León ────────────────────────────────────────────────────────
// Portal: egobierno.nl.gob.mx — muestra Estado de Cuenta predial (adeudos)
// Nota: el valor catastral (suelo/construcción) requiere portal IRCNL separado
async function scrapeNL(cuentaPredial: string, ciudad: string) {
  const clean = cuentaPredial.replace(/[-\s]/g, '')
  const key   = norm(ciudad)
  const muni  = NL_MUNICIPIOS[key]
    ?? NL_MUNICIPIOS[Object.keys(NL_MUNICIPIOS).find(k => k.includes(key) || key.includes(k)) ?? '']

  if (!muni) {
    return {
      found: false as const,
      error: `Municipio "${ciudad}" no disponible — soportados: Monterrey, San Pedro, San Nicolás, Guadalupe, Apodaca, Escobedo, Santa Catarina, García, Juárez, Linares, Santiago, Cadereyta`,
    }
  }

  const raw = `${clean}|${muni.code}|${muni.name}`
  const exp = Buffer.from(raw).toString('base64')
  const url = `https://egobierno.nl.gob.mx/egob/expediente-catastral/?exp=${encodeURIComponent(exp)}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return { found: false as const, error: `Portal NL respondió ${res.status}`, source: url }
    }

    const html = await res.text()

    if (!html.includes('Expediente Catastral') || html.includes('No se encontr')) {
      return { found: false as const, error: 'Expediente no encontrado — verifica que el número sea correcto.', source: url }
    }

    const municipioHtml  = extractStrong(html, 'Municipio:')
    const expedienteHtml = extractStrong(html, 'Expediente Catastral:')
    const ubicacion      = extractStrong(html, 'Ubicaci[oó]n:')
    const adeudoTotal    = extractAdeudoTotal(html)

    return {
      found: true as const,
      estado: 'Nuevo León',
      municipio: municipioHtml ?? muni.name,
      expediente: expedienteHtml ?? cuentaPredial,
      ubicacion,
      sinAdeudo: adeudoTotal === 0,
      adeudoTotal,
      source: url,
    }
  } catch (e: any) {
    return {
      found: false as const,
      error: e?.name === 'TimeoutError' ? 'El portal de NL tardó demasiado — intenta de nuevo' : 'Error de conexión',
      source: url,
    }
  }
}

// ── Scraper IRCNL vía Playwright + Browserless ───────────────────────────────
// Portal: tramites.ircnl.gob.mx/tramites/ModernizacionCatastral.aspx
// Requiere BROWSERLESS_TOKEN en env vars
async function scrapeIRCNL(cuentaPredial: string, municipio: string) {
  const token = process.env.BROWSERLESS_TOKEN
  if (!token) throw new Error('BROWSERLESS_TOKEN no configurado')

  const clean = cuentaPredial.replace(/[-\s]/g, '')
  const url   = 'https://tramites.ircnl.gob.mx/tramites/ModernizacionCatastral.aspx'

  const { chromium } = await import('playwright-core')
  const browser = await chromium.connectOverCDP(
    `wss://chrome.browserless.io?token=${token}&timeout=30000`
  )

  try {
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })

    // Selecciona municipio en el dropdown (ASP.NET WebForms)
    const selectSelector = 'select[id*="Municipio"], select[id*="municipio"], select[name*="Municipio"]'
    await page.waitForSelector(selectSelector, { timeout: 8000 })
    await page.selectOption(selectSelector, { label: municipio })

    // Llena el expediente
    const inputSelector = 'input[id*="Expediente"], input[id*="expediente"], input[name*="Expediente"]'
    await page.waitForSelector(inputSelector, { timeout: 5000 })
    await page.fill(inputSelector, clean)

    // Click buscar / consultar
    const btnSelector = 'input[type="submit"][id*="Buscar"], input[type="submit"][id*="buscar"], input[type="button"][id*="Buscar"]'
    await page.click(btnSelector)

    // Espera resultados
    await page.waitForTimeout(3000)

    // Extrae todo el texto de la página para parsear
    const html = await page.content()
    const bodyText = await page.evaluate(() => document.body.innerText)

    // Parsea valores del texto extraído
    const valorSuelo        = extractMoney(html, 'Valor.*?[Ss]uelo', 'Suelo.*?\\$')
      ?? extractMoneyFromText(bodyText, 'Suelo')
    const valorConstruccion = extractMoney(html, 'Valor.*?[Cc]onstrucci', 'Construcci.*?\\$')
      ?? extractMoneyFromText(bodyText, 'Construcci')
    const valorCatastral    = extractMoney(html, 'Valor.*?[Cc]atastral', 'Total.*?[Cc]atastral')
      ?? extractMoneyFromText(bodyText, 'Catastral')
    const superficieTerreno = extractNumber(html, 'Superficie.*?[Tt]erreno', 'Sup.*?[Tt]erreno')
      ?? extractNumberFromText(bodyText, 'Terreno')

    await page.close()

    if (!valorCatastral && !valorSuelo) {
      return { found: false, error: 'Expediente no encontrado en IRCNL o portal sin datos', rawText: bodyText.slice(0, 500) }
    }

    return {
      found: true,
      fuente: 'IRCNL Modernización Catastral',
      valorSuelo,
      valorConstruccion,
      valorCatastral: valorCatastral ?? (((valorSuelo ?? 0) + (valorConstruccion ?? 0)) || null),
      superficieTerreno,
      source: url,
    }
  } finally {
    await browser.close()
  }
}

function extractMoneyFromText(text: string, label: string): number | null {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(label, 'i').test(lines[i])) {
      const nearby = lines.slice(i, i + 3).join(' ')
      const m = nearby.match(/\$?\s*([\d,]+(?:\.\d+)?)/)
      if (m) {
        const n = parseFloat(m[1].replace(/,/g, ''))
        if (!isNaN(n) && n > 100) return n
      }
    }
  }
  return null
}

function extractNumberFromText(text: string, label: string): number | null {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(label, 'i').test(lines[i])) {
      const nearby = lines.slice(i, i + 3).join(' ')
      const m = nearby.match(/([\d,]+(?:\.\d+)?)/)
      if (m) {
        const n = parseFloat(m[1].replace(/,/g, ''))
        if (!isNaN(n) && n > 0) return n
      }
    }
  }
  return null
}

// ── Scraper Sinaloa ───────────────────────────────────────────────────────────
// Portal: pagoscatastro.sinaloa.gob.mx/InformacionCatastral
// Acepta clave catastral de 18 (urbana) u 11 (rústica) dígitos, solo números
async function scrapeSinaloa(cuentaPredial: string) {
  // Solo dígitos; Sinaloa requiere 18 (urbano) u 11 (rural)
  const clean = cuentaPredial.replace(/\D/g, '')

  if (clean.length !== 18 && clean.length !== 11) {
    return {
      found: false as const,
      error: `La clave catastral de Sinaloa debe tener 18 dígitos (urbana) u 11 (rústica). Se recibió: ${clean.length} dígitos.`,
    }
  }

  const url = 'https://pagoscatastro.sinaloa.gob.mx/InformacionCatastral/AgregarItem'

  const params = new URLSearchParams({
    Nombre: 'CONSULTA',
    Rfc: '',
    ClaveCatastral1: clean,
    ClaveCatastral2: clean,
    Claves: '',
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-MX,es;q=0.9',
        'Referer': 'https://pagoscatastro.sinaloa.gob.mx/InformacionCatastral',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return { found: false as const, error: `Portal Sinaloa respondió ${res.status}`, source: url }
    }

    const html = await res.text()

    // El portal inserta alert() cuando la clave no existe o tiene estado legal activo
    const alertMatch = html.match(/alert\("([^"]+)"\)/)
    if (alertMatch) {
      const msg = alertMatch[1]
      if (msg.includes('no se encuentra') || msg.includes('estado legal')) {
        return { found: false as const, error: 'Clave catastral no encontrada — verifica que sea correcta.', source: url }
      }
      if (msg.includes('dígitos')) {
        return { found: false as const, error: msg, source: url }
      }
      return { found: false as const, error: msg, source: url }
    }

    // Detectar si Items > 0 (clave encontrada en el catastro)
    const itemsMatch = html.match(/name="Items"[^>]*value="(\d+)"/)
    const items = itemsMatch ? parseInt(itemsMatch[1]) : 0

    if (items === 0) {
      return { found: false as const, error: 'Clave catastral no encontrada en el catastro de Sinaloa.', source: url }
    }

    // El portal solo expone: confirmación de existencia + costo del certificado ($293 approx)
    // La info catastral completa (valor, superficie, ubicación) requiere pagar el certificado
    const totalMatch = html.match(/name="Total"[^>]*value="([^"]+)"/)
    const totalCertificado = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) || 0 : 0

    // Extraer la clave tal como la confirmó el servidor
    const claveConfirmada = html.match(/name="ClavesPagar\[0\]"[^>]*value="([^"]+)"/)
    const claveOk = claveConfirmada ? claveConfirmada[1] : clean

    return {
      found: true as const,
      estado: 'Sinaloa',
      claveCatastral: claveOk,
      costoCertificado: totalCertificado > 0 ? totalCertificado : undefined,
      valorCatastral: null,
      fuente: 'Catastro Digital Sinaloa',
      nota: 'Clave registrada. El valor catastral y ubicación están en el certificado oficial ($' + (totalCertificado || 293) + ' pesos).',
      source: url,
    }
  } catch (e: any) {
    return {
      found: false as const,
      error: e?.name === 'TimeoutError' ? 'El portal de Sinaloa tardó demasiado — intenta de nuevo' : 'Error de conexión con portal Sinaloa',
      source: url,
    }
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cuentaPredial, ciudad, estado } = body

  if (!cuentaPredial?.trim()) {
    return NextResponse.json({ found: false, error: 'Proporciona la cuenta predial o clave catastral' })
  }
  if (!estado?.trim()) {
    return NextResponse.json({ found: false, error: 'Proporciona el estado del predio' })
  }

  const estadoNorm = norm(estado)

  if (estadoNorm.includes('nuevo leon') || estadoNorm.includes('nuevo le')) {
    // Paso 1: egobierno — confirma existencia + adeudos (fetch simple)
    const baseData = await scrapeNL(cuentaPredial.trim(), ciudad || '')
    if (!baseData.found) return NextResponse.json(baseData)

    // Paso 2: IRCNL — intenta obtener valor catastral vía Playwright
    try {
      const ircnl = await scrapeIRCNL(cuentaPredial.trim(), baseData.municipio)
      if (ircnl.found) return NextResponse.json({ ...baseData, ...ircnl })
    } catch {
      // IRCNL no disponible — devuelve lo que ya tenemos de egobierno
    }

    return NextResponse.json(baseData)
  }

  if (estadoNorm.includes('sinaloa')) {
    const data = await scrapeSinaloa(cuentaPredial.trim())
    return NextResponse.json(data)
  }

  // Estados futuros
  if (estadoNorm.includes('jalisco')) {
    return NextResponse.json({ found: false, error: 'Jalisco en desarrollo — disponible próximamente' })
  }
  if (estadoNorm.includes('ciudad de mexico') || estadoNorm.includes('cdmx') || estadoNorm.includes('distrito federal')) {
    return NextResponse.json({ found: false, error: 'CDMX en desarrollo — disponible próximamente' })
  }

  return NextResponse.json({ found: false, error: `Estado "${estado}" no disponible aún. Actualmente: Nuevo León y Sinaloa` })
}
