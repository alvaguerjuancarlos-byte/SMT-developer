'use client'

// <DataField/> — Bloque 0 (numérico) + Bloque 4 (texto/select para TERRENO/NORMATIVA).
// Campo dual manual/automático: el usuario puede capturar a mano o dejar que el agente
// sugiera, siempre se ve cuál de las dos originó el dato, y manual siempre gana
// (setFieldFromAgent en el store nunca pisa un valor con source:'user').
//
// El wrapper (header Auto/Manual, pie de fuente/conflicto) es agnóstico al tipo de dato —
// lo único que cambia entre variantes es el bloque central.
import { useEffect, useRef, useState } from 'react'
import { T } from '../theme'
import { useProjectStore, type FieldKey } from '../store/useProjectStore'

const DEBOUNCE_MS = 150

export function DataField({
  fieldKey,
  label,
  type = 'number',
  unit = '',
  step = 500,
  min = 0,
  format,
  rangoSugerido,
  opciones,
}: {
  fieldKey: FieldKey
  label: string
  // Bloque 4: 'text' es un input libre (ej. "60%", "12 niveles" — strings ya formateados
  // que trae el agente); 'select' es un set fijo de opciones (ej. sí/no, categorías).
  type?: 'number' | 'text' | 'select'
  unit?: string
  step?: number
  min?: number
  format?: (v: number | string) => string
  // Bloque 3 (3.3): rango real que ya trae el agente (bitacoraTerreno.rangoValoracion,
  // bitacoraConstruccion.rangoReferencia) — solo aplica a type='number'. Sin rango real no
  // se inventa uno — el campo se queda solo con el stepper, como antes.
  rangoSugerido?: [number, number]
  // Bloque 4: opciones fijas para type='select'.
  opciones?: { id: string; label: string }[]
}) {
  const field = useProjectStore((s) => s.fields[fieldKey])
  const setFieldManual = useProjectStore((s) => s.setFieldManual)
  const resetField = useProjectStore((s) => s.resetField)
  const resolverConflicto = useProjectStore((s) => s.resolverConflicto)

  const efectivo = field.value ?? field.agentValue
  const esManual = field.source === 'user'
  const vacio = efectivo == null || efectivo === ''
  const fmt = format ?? ((v: number | string) => (typeof v === 'number' ? Math.round(v).toLocaleString('es-MX') : String(v)))

  const inputRef = useRef<HTMLInputElement | null>(null)
  const [texto, setTexto] = useState(efectivo != null ? (type === 'number' ? String(Math.round(Number(efectivo))) : String(efectivo)) : '')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Sincroniza el input local si el valor efectivo cambia desde fuera (nuevo dato del
    // agente, Auto/reset) — pero no mientras el usuario está tecleando ahí mismo.
    if (type === 'select') return
    if (document.activeElement !== inputRef.current) {
      setTexto(efectivo != null ? (type === 'number' ? String(Math.round(Number(efectivo))) : String(efectivo)) : '')
    }
  }, [efectivo, type])

  function commitNumero(nuevoTexto: string) {
    setTexto(nuevoTexto)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      const n = Number(nuevoTexto)
      if (!Number.isNaN(n) && nuevoTexto.trim() !== '') setFieldManual(fieldKey, Math.max(min, n))
    }, DEBOUNCE_MS)
  }

  function commitTexto(nuevoTexto: string) {
    setTexto(nuevoTexto)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      if (nuevoTexto.trim() !== '') setFieldManual(fieldKey, nuevoTexto)
    }, DEBOUNCE_MS)
  }

  function ajustar(delta: number) {
    const base = typeof efectivo === 'number' ? efectivo : 0
    const n = Math.max(min, base + delta)
    setTexto(String(n))
    setFieldManual(fieldKey, n)
  }

  return (
    <div style={{ padding: '7px 10px', background: T.panel2 }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 10, color: vacio ? T.ink4 : T.ink2 }}>{label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => resetField(fieldKey)}
            className="cursor-pointer"
            style={{
              fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 8,
              color: !esManual ? T.accent : T.ink4,
              background: !esManual ? 'rgba(126,217,174,.12)' : 'transparent',
              border: `1px solid ${!esManual ? 'rgba(126,217,174,.35)' : T.line}`,
            }}
          >
            Auto
          </button>
          <button
            onClick={() => { if (!esManual && efectivo != null) setFieldManual(fieldKey, efectivo) }}
            className="cursor-pointer"
            style={{
              fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 8,
              color: esManual ? T.accent : T.ink4,
              background: esManual ? 'rgba(126,217,174,.12)' : 'transparent',
              border: `1px solid ${esManual ? 'rgba(126,217,174,.35)' : T.line}`,
            }}
          >
            Manual
          </button>
        </div>
      </div>

      {type === 'select' ? (
        <div className="flex flex-wrap gap-1" style={{ marginTop: 4, justifyContent: 'flex-end' }}>
          {opciones?.map((o) => (
            <button
              key={o.id}
              onClick={() => setFieldManual(fieldKey, o.id)}
              className="cursor-pointer"
              style={{
                fontSize: 9.5, padding: '3px 8px', borderRadius: 10,
                border: `1px solid ${efectivo === o.id ? 'rgba(126,217,174,.45)' : T.line2}`,
                background: efectivo === o.id ? 'rgba(126,217,174,.12)' : 'transparent',
                color: efectivo === o.id ? T.accent : T.ink2,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : vacio ? (
        <div style={{ fontSize: 11, color: T.ink4, marginTop: 4 }}>— esperando agente</div>
      ) : type === 'text' ? (
        <div style={{ marginTop: 4 }}>
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => commitTexto(e.target.value)}
            className="w-full outline-none"
            style={{ fontSize: 11, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 6, padding: '5px 8px', color: T.ink }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 justify-end" style={{ marginTop: 4 }}>
          <div className="flex items-center gap-0.5 rounded-full" style={{ border: `1px solid ${T.line}`, padding: 1 }}>
            <button onClick={() => ajustar(-step)} className="rounded-full flex items-center justify-center cursor-pointer" style={{ width: 19, height: 19, color: T.ink3, fontSize: 12, lineHeight: 1 }}>−</button>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={texto}
              onChange={(e) => commitNumero(e.target.value)}
              style={{ width: 62, fontSize: 11, textAlign: 'center', background: 'transparent', color: T.ink, border: 'none', outline: 'none' }}
            />
            <button onClick={() => ajustar(step)} className="rounded-full flex items-center justify-center cursor-pointer" style={{ width: 19, height: 19, color: T.ink3, fontSize: 12, lineHeight: 1 }}>+</button>
          </div>
          {unit && <span style={{ fontSize: 9, color: T.ink4 }}>{unit}</span>}
        </div>
      )}

      {type === 'number' && rangoSugerido && !vacio && (() => {
        const [rMin, rMax] = rangoSugerido
        const valorNum = typeof efectivo === 'number' ? efectivo : rMin
        const clamp = (n: number) => Math.min(rMax, Math.max(rMin, n))
        const agentNum = typeof field.agentValue === 'number' ? field.agentValue : null
        const marcaPct = agentNum != null ? ((clamp(agentNum) - rMin) / (rMax - rMin || 1)) * 100 : null
        return (
          <div style={{ marginTop: 7 }}>
            <div className="relative">
              <input
                type="range"
                min={rMin} max={rMax} step={step}
                value={clamp(valorNum)}
                onChange={(e) => commitNumero(e.target.value)}
                className="w-full cursor-pointer"
                style={{ accentColor: T.accent, height: 14 }}
              />
              {marcaPct != null && (
                <div
                  title="Referencia del agente"
                  style={{ position: 'absolute', left: `${marcaPct}%`, top: 0, width: 2, height: 14, background: T.s2, pointerEvents: 'none' }}
                />
              )}
            </div>
            <div className="flex justify-between" style={{ fontSize: 7.5, color: T.ink4 }}>
              <span>{fmt(rMin)}</span>
              <span>{fmt(rMax)}</span>
            </div>
          </div>
        )
      })()}

      {!esManual && field.source === 'agent' && (
        <div style={{ fontSize: 8.5, color: T.ink4, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>◆ sugerido por agente{field.confidence != null ? ` · ${Math.round(field.confidence * 100)}%` : ''}</span>
          {field.sourceUrl && <a href={field.sourceUrl} target="_blank" rel="noreferrer" style={{ color: T.accent2 }}>fuente</a>}
        </div>
      )}

      {field.conflicto && (
        <div style={{ fontSize: 9, color: T.s2, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>agente sugiere {field.agentValue != null ? fmt(field.agentValue) : '—'}{unit}</span>
          <button onClick={() => resolverConflicto(fieldKey, true)} className="cursor-pointer" style={{ color: T.accent, textDecoration: 'underline' }}>actualizar</button>
          <button onClick={() => resolverConflicto(fieldKey, false)} className="cursor-pointer" style={{ color: T.ink3, textDecoration: 'underline' }}>mantener</button>
        </div>
      )}
    </div>
  )
}
