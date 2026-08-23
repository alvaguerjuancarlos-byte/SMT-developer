'use client'

// Tarjeta "Sitio y contexto" — Bloque 2 (2.3). Antes se repetía inline en Resumen y Terreno
// (mismo <MapaSimbolico/>, sin botones); ahora vive aquí una sola vez con los 2 puntos de
// entrada al flujo de polígono real que pide el documento de mejoras.
//
// "+ Agregar terreno" abre un modal informativo (catastro/trazo manual/KML) — ninguna de las
// 3 vías tiene hoy una base real que reusar sin construir un editor de polígonos desde cero
// (confirmado: app/api/catastro/route.ts no devuelve geometría, y no hay leaflet-draw/turf en
// el repo), así que ese trabajo queda para cuando se aborde el "objetivo final" del documento
// (§2.2) — aquí solo se entrega el punto de entrada, honesto sobre lo que falta.
//
// "Cargar PDF" sí sube el archivo de verdad (mismo patrón de Storage que ya usa
// app/api/upload-pdf/route.ts) — no intenta extraer el polígono, solo lo guarda.
import { useState } from 'react'
import { authedFetch } from '@/lib/apiClient'
import { T } from '../theme'
import { Card, CardHead, Cb, Lbl, Pill } from './ui'

export const PENDIENTE_LABEL: Record<string, string> = {
  plano: 'Plano (< 5%)', suave: 'Suave (5–10%)', moderada: 'Moderada (10–20%)', pronunciada: 'Pronunciada (> 20%)',
}

function MapaSimbolico({ pendiente }: { pendiente?: string }) {
  const contornos = Array.from({ length: 26 }, (_, i) =>
    `M${-50 + i * 4},${300 - i * 9 * 1.1} Q${250 + i * 6},${210 - i * 9} 520,${190 - i * 8.1} T1050,${150 - i * 10.8}`
  )
  const vialidades = [
    ...Array.from({ length: 7 }, (_, i) => `M${-20 + i * 160},300 L${120 + i * 150},${40 + i * 18}`),
    'M0,208 Q300,190 520,214 T1000,178',
    'M0,120 Q380,150 700,96 T1000,120',
  ]
  return (
    <div className="relative" style={{ flex: 1, minHeight: 0, background: '#040706' }}>
      <svg viewBox="0 0 1000 430" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="preformaGlow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#4FC08D" stopOpacity=".2" /><stop offset="100%" stopColor="#4FC08D" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="preformaLot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ED9AE" stopOpacity=".26" /><stop offset="100%" stopColor="#7ED9AE" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <rect width={1000} height={430} fill="#040706" />
        <rect width={1000} height={430} fill="url(#preformaGlow)" />
        <g transform="translate(500,215) scale(1.55) translate(-520,-168)">
          <g stroke="#2E8F72" fill="none" strokeWidth={0.7} opacity={0.45}>
            {contornos.map((d, i) => <path key={i} d={d} />)}
          </g>
          <g stroke="#9CB3A8" fill="none" strokeWidth={0.8} opacity={0.2}>
            {vialidades.map((d, i) => <path key={i} d={d} />)}
          </g>
          <polygon points="430,155 545,122 616,178 505,214" fill="url(#preformaLot)" stroke="#7ED9AE" strokeWidth={1.6} />
          <polygon points="430,155 545,122 616,178 505,214" fill="none" stroke="#7ED9AE" strokeWidth={6} opacity={0.08} />
          <path d="M250 250 Q520 40 800 250" stroke="#C4842A" strokeWidth={0.9} fill="none" opacity={0.6} strokeDasharray="2 5" />
          <circle cx={520} cy={103} r={7} fill="#C4842A" opacity={0.9} /><circle cx={520} cy={103} r={15} fill="#C4842A" opacity={0.12} />
          <circle cx={520} cy={168} r={3} fill="#7ED9AE" />
          <text x={252} y={240} fill="#627A70" fontSize={9}>06:00</text>
          <text x={508} y={88} fill="#C4842A" fontSize={9}>12:00</text>
          <text x={778} y={240} fill="#627A70" fontSize={9}>18:00</text>
        </g>
      </svg>
      <div className="absolute flex flex-col overflow-hidden rounded-md" style={{ top: 9, right: 9, border: `1px solid ${T.line}`, background: 'rgba(4,7,6,.75)' }}>
        {['◈', '△', '☀', '♧', '◇', '⚠'].map((ic, i) => (
          <button
            key={i}
            className="flex items-center justify-center cursor-pointer"
            style={{ width: 27, height: 25, fontSize: 10, color: i === 0 ? T.accent : T.ink3, background: i === 0 ? 'rgba(126,217,174,.15)' : 'transparent' }}
          >
            {ic}
          </button>
        ))}
      </div>
      <div className="absolute" style={{ left: 11, bottom: 9 }}>
        <div className="flex items-center gap-1.5">
          <Lbl>Pendiente</Lbl>
          {pendiente && <Pill tone="muted">estimado</Pill>}
        </div>
        <b className="block" style={{ fontSize: 12.5, marginTop: 1, color: T.ink }}>{pendiente ? (PENDIENTE_LABEL[pendiente] ?? pendiente) : '—'}</b>
      </div>
      <div className="absolute flex gap-3" style={{ right: 11, bottom: 9, fontSize: 9, color: T.ink3 }}>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#7ED9AE', marginRight: 4, verticalAlign: 'middle' }} />Terreno</span>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#2E8F72', marginRight: 4, verticalAlign: 'middle' }} />Curvas</span>
        <span><i style={{ display: 'inline-block', width: 11, height: 2, background: '#C4842A', marginRight: 4, verticalAlign: 'middle' }} />Trayectoria solar</span>
      </div>
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'rgba(2,4,3,.7)', zIndex: 50 }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="rounded-[10px] overflow-hidden flex flex-col"
        style={{ width: 420, background: T.panel, border: `1px solid ${T.line}` }}
      >
        {children}
      </div>
    </div>
  )
}

function ModalHead({ titulo, onClose }: { titulo: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{titulo}</span>
      <button onClick={onClose} className="cursor-pointer" style={{ fontSize: 14, color: T.ink3 }}>✕</button>
    </div>
  )
}

function ModalAgregarTerreno({ onClose }: { onClose: () => void }) {
  const vias = [
    { titulo: 'Catastro', desc: 'Consultar el polígono oficial por clave catastral o dirección.' },
    { titulo: 'Trazo manual', desc: 'Dibujar el polígono directo sobre el mapa.' },
    { titulo: 'Importar KML / GeoJSON', desc: 'Subir el polígono ya trazado desde otro sistema.' },
  ]
  return (
    <ModalOverlay onClose={onClose}>
      <ModalHead titulo="Agregar terreno" onClose={onClose} />
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 11, color: T.ink2, marginBottom: 12 }}>
          Mientras no haya un polígono real capturado, la superficie y la pendiente se muestran como estimadas.
        </p>
        {vias.map(v => (
          <div key={v.titulo} className="flex items-center justify-between" style={{ padding: '9px 0', borderTop: `1px solid ${T.line}` }}>
            <div>
              <p style={{ fontSize: 11.5, color: T.ink, fontWeight: 600 }}>{v.titulo}</p>
              <p style={{ fontSize: 10, color: T.ink3, marginTop: 2 }}>{v.desc}</p>
            </div>
            <Pill tone="muted">Próximamente</Pill>
          </div>
        ))}
      </div>
    </ModalOverlay>
  )
}

function ModalCargarPdf({ proyectoId, planoUrl, onSubido, onClose }: { proyectoId: string | null; planoUrl: string | null; onSubido: (url: string) => void; onClose: () => void }) {
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function subir(file: File) {
    if (!proyectoId) return
    setSubiendo(true); setError('')
    try {
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await authedFetch('/api/upload-plano', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId, pdfBase64 }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'No se pudo subir el archivo')
      onSubido(json.planoUrl)
    } catch (e: any) {
      setError(e?.message || 'No se pudo subir el archivo')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHead titulo="Cargar plano del terreno" onClose={onClose} />
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 11, color: T.ink2, marginBottom: 12 }}>
          Sube el plano o predial del terreno en PDF. Por ahora se guarda junto al proyecto — la extracción automática del polígono es un siguiente paso.
        </p>
        {planoUrl && (
          <p style={{ fontSize: 10.5, color: T.accent, marginBottom: 10 }}>
            Ya hay un plano cargado — subir uno nuevo lo reemplaza.
          </p>
        )}
        <input
          type="file"
          accept="application/pdf"
          disabled={subiendo}
          onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }}
          style={{ fontSize: 11, color: T.ink2 }}
        />
        {subiendo && <p style={{ fontSize: 11, color: T.accent, marginTop: 8 }}>Subiendo…</p>}
        {error && <p style={{ fontSize: 11, color: T.bad, marginTop: 8 }}>{error}</p>}
      </div>
    </ModalOverlay>
  )
}

export function SitioYContexto({
  lat, lng, pendiente, flex, emptyText, planoUrl, proyectoId, onPlanoSubido,
}: {
  lat: number | null
  lng: number | null
  pendiente?: string
  flex?: string
  emptyText: string
  planoUrl: string | null
  proyectoId: string | null
  onPlanoSubido: (url: string) => void
}) {
  const [modal, setModal] = useState<'terreno' | 'pdf' | null>(null)

  return (
    <Card flex={flex}>
      <CardHead
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setModal('terreno')}
              className="cursor-pointer"
              style={{ fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: T.ink3 }}
            >
              + Agregar terreno
            </button>
            <button
              onClick={() => setModal('pdf')}
              className="cursor-pointer"
              style={{ fontSize: 9.5, letterSpacing: '.08em', textTransform: 'uppercase', color: planoUrl ? T.accent : T.ink3 }}
              title={!proyectoId ? 'Se habilita en cuanto el proyecto se guarde' : undefined}
            >
              {planoUrl ? 'Plano cargado ✓' : 'Cargar PDF'}
            </button>
          </div>
        }
      >
        Sitio y contexto
      </CardHead>
      {lat != null && lng != null ? (
        <MapaSimbolico pendiente={pendiente} />
      ) : (
        <Cb><div className="h-full flex items-center justify-center py-10"><p style={{ fontSize: 11, color: T.ink4 }}>{emptyText}</p></div></Cb>
      )}

      {modal === 'terreno' && <ModalAgregarTerreno onClose={() => setModal(null)} />}
      {modal === 'pdf' && (
        <ModalCargarPdf
          proyectoId={proyectoId}
          planoUrl={planoUrl}
          onSubido={url => { onPlanoSubido(url); setModal(null) }}
          onClose={() => setModal(null)}
        />
      )}
    </Card>
  )
}
