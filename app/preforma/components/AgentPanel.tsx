'use client'

// Panel del Agente PREFORMA — Bloque 1 (1.1). Antes vivía inline en el <aside> derecho de
// page.tsx, siempre "docked". Ahora page.tsx decide DÓNDE se monta (columna del grid para
// 'docked', overlay fixed para 'centered') y este componente solo decide CÓMO se ve según
// `variant` — tipografía más grande en 'centered' (modo captura) que en 'docked' (consulta
// rápida), tal como pide el documento: mensajes ≥15px / input ≥16px en overlay.
import { T } from '../theme'
import { Card, CardHead } from './ui'
import type { ChatMsg, IntakeQuestion } from '../types'

function MsgA({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <div style={{ fontSize: big ? 15.5 : 11, lineHeight: 1.55, color: T.ink2, paddingLeft: big ? 14 : 10, borderLeft: '1px solid rgba(126,217,174,.4)' }}>
      {children}
    </div>
  )
}

function MsgU({ children, big }: { children: React.ReactNode; big?: boolean }) {
  return (
    <div
      className="self-end"
      style={{ background: 'rgba(255,255,255,.05)', borderRadius: '8px 8px 2px 8px', padding: big ? '9px 14px' : '6px 10px', maxWidth: '88%', color: T.ink, fontSize: big ? 15.5 : 11 }}
    >
      {children}
    </div>
  )
}

export function AgentPanel({
  variant,
  chat,
  chatEndRef,
  intakeDone,
  preguntaActual,
  tipoSel,
  texto,
  setTexto,
  enviarTexto,
  elegirChipUnico,
  toggleChipMulti,
  confirmarTipos,
}: {
  variant: 'docked' | 'centered'
  chat: ChatMsg[]
  chatEndRef: React.RefObject<HTMLDivElement | null>
  intakeDone: boolean
  preguntaActual: IntakeQuestion | null
  tipoSel: string[]
  texto: string
  setTexto: (v: string) => void
  enviarTexto: () => void
  elegirChipUnico: (id: string, label: string) => void
  toggleChipMulti: (id: string) => void
  confirmarTipos: () => void
}) {
  const big = variant === 'centered'

  return (
    <Card style={big ? { width: 680, maxHeight: '80vh' } : undefined}>
      <CardHead right={<span style={{ color: T.accent, fontSize: big ? 12 : undefined }}>● en línea</span>}>Agente PREFORMA</CardHead>

      <div className="overflow-y-auto flex flex-col gap-2.5" style={{ padding: big ? '16px 18px' : '10px 11px', flex: 1, minHeight: 0, gap: big ? 14 : undefined }}>
        {chat.map((m, i) => m.who === 'a' ? <MsgA key={i} big={big}>{m.text}</MsgA> : <MsgU key={i} big={big}>{m.text}</MsgU>)}
        <div ref={chatEndRef} />
      </div>

      {!intakeDone && preguntaActual && (
        <div style={{ borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
          {preguntaActual.kind === 'chips-single' && (
            <div className="flex flex-wrap gap-1.5" style={{ padding: big ? '14px 18px' : '10px 11px', gap: big ? 10 : undefined }}>
              {preguntaActual.opciones!.map(o => (
                <button
                  key={o.id}
                  onClick={() => elegirChipUnico(o.id, o.label)}
                  className="cursor-pointer"
                  style={{ fontSize: big ? 14 : 10.5, padding: big ? '9px 16px' : '5px 10px', border: `1px solid ${T.line2}`, borderRadius: big ? 16 : 12, color: T.ink2 }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {preguntaActual.kind === 'chips-multi' && (
            <div style={{ padding: big ? '14px 18px' : '10px 11px' }}>
              <div className="flex flex-wrap gap-1.5" style={{ marginBottom: big ? 12 : 8, gap: big ? 10 : undefined }}>
                {preguntaActual.opciones!.map(o => (
                  <button
                    key={o.id}
                    onClick={() => toggleChipMulti(o.id)}
                    className="cursor-pointer"
                    style={{
                      fontSize: big ? 14 : 10.5, padding: big ? '9px 16px' : '5px 10px', borderRadius: big ? 16 : 12,
                      border: tipoSel.includes(o.id) ? `1px solid ${T.accent}` : `1px solid ${T.line2}`,
                      background: tipoSel.includes(o.id) ? 'rgba(126,217,174,.12)' : 'transparent',
                      color: tipoSel.includes(o.id) ? T.accent : T.ink2,
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                onClick={confirmarTipos}
                disabled={tipoSel.length === 0}
                className="cursor-pointer"
                style={{
                  height: big ? 36 : 26, padding: big ? '0 18px' : '0 12px', borderRadius: big ? 18 : 13, fontSize: big ? 13 : 10, fontWeight: 600,
                  background: tipoSel.length ? 'rgba(126,217,174,.15)' : 'transparent',
                  border: `1px solid ${tipoSel.length ? 'rgba(126,217,174,.45)' : T.line2}`,
                  color: tipoSel.length ? T.accent : T.ink4,
                }}
              >
                Continuar →
              </button>
            </div>
          )}

          {(preguntaActual.kind === 'texto' || preguntaActual.kind === 'numero') && (
            <div className="flex items-center gap-1.5" style={{ padding: big ? '12px 18px' : '8px 11px', gap: big ? 10 : undefined }}>
              <input
                autoFocus
                type={preguntaActual.kind === 'numero' ? 'number' : 'text'}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') enviarTexto() }}
                placeholder={preguntaActual.kind === 'numero' ? '0' : 'Escribe aquí…'}
                className="flex-1 bg-transparent outline-none"
                style={{ color: T.ink, fontSize: big ? 16 : 11, fontFamily: 'inherit' }}
              />
              <button
                onClick={enviarTexto}
                className="cursor-pointer"
                style={{ height: big ? 34 : 24, padding: big ? '0 16px' : '0 11px', borderRadius: big ? 17 : 12, fontSize: big ? 12 : 9.5, letterSpacing: '.1em', textTransform: 'uppercase', background: 'rgba(126,217,174,.15)', border: '1px solid rgba(126,217,174,.45)', color: T.accent }}
              >
                Enviar
              </button>
            </div>
          )}

          {preguntaActual.kind === 'mapa' && (
            <div style={{ padding: big ? '14px 18px' : '9px 11px' }}>
              <p style={{ fontSize: big ? 14 : 10.5, color: T.ink3 }}>Captúralo en la pestaña <b style={{ color: T.accent, fontWeight: 600 }}>Terreno</b> →</p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
