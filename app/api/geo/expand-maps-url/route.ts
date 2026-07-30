import { NextRequest, NextResponse } from 'next/server'

function extractCoords(url: string): { lat: number; lng: number } | null {
  // @lat,lng (standard maps URL)
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // q=lat,lng
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // !3dlat!4dlng (place URLs)
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // ll=lat,lng
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // query=lat,lng (api=1 search links)
  m = url.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // /maps/search/lat,lng — dropped-pin "share location" links (mobile app)
  m = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url requerido' }, { status: 400 })

  // Try coords directly first (long-form URL)
  const direct = extractCoords(url)
  if (direct) return NextResponse.json({ ...direct, expandedUrl: url })

  // Follow redirects for short URLs (maps.app.goo.gl, goo.gl/maps)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    })
    const expanded = res.url
    const coords = extractCoords(expanded)
    if (coords) return NextResponse.json({ ...coords, expandedUrl: expanded })

    // HEAD sometimes strips fragment/params — try GET with manual redirect tracking
    const res2 = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(6000),
    })
    const location = res2.headers.get('location')
    if (location) {
      const coords2 = extractCoords(location)
      if (coords2) return NextResponse.json({ ...coords2, expandedUrl: location })
    }

    return NextResponse.json({ error: 'No se pudieron extraer coordenadas del enlace' }, { status: 422 })
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder al enlace de Maps' }, { status: 502 })
  }
}
