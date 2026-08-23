// Primitivos visuales genéricos de PREFORMA — extraídos de page.tsx (Bloque 1) para que
// componentes como AgentPanel puedan reusarlos sin crear un ciclo de imports con page.tsx.
import { T } from '../theme'

export function Card({ children, flex = '1', style }: { children: React.ReactNode; flex?: string; style?: React.CSSProperties }) {
  return (
    <section
      className="rounded-[9px] border overflow-hidden flex flex-col min-h-0"
      style={{ background: `linear-gradient(180deg, ${T.panel2}, ${T.panel})`, borderColor: T.line, flex, ...style }}
    >
      {children}
    </section>
  )
}

export function CardHead({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-[10px] py-[6px] shrink-0 whitespace-nowrap"
      style={{ borderBottom: `1px solid ${T.line}` }}
    >
      <Lbl>{children}</Lbl>
      {right && <div className="flex items-center gap-1.5">{right}</div>}
    </div>
  )
}

export function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: T.ink3, fontWeight: 500 }}>{children}</span>
}

export function Mini({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: T.ink3 }}>{children}</span>
}

export function Cb({ children, style, fill }: { children: React.ReactNode; style?: React.CSSProperties; fill?: boolean }) {
  return (
    <div
      className="overflow-auto"
      style={{ padding: '10px 11px', minHeight: 0, flex: 1, display: fill ? 'flex' : undefined, flexDirection: fill ? 'column' : undefined, justifyContent: fill ? 'space-evenly' : undefined, ...style }}
    >
      {children}
    </div>
  )
}

// tone 'muted' — Bloque 2: para etiquetas tipo "estimado" (una advertencia de procedencia del
// dato, no un estado positivo) — el verde acento de siempre confundiría las dos cosas.
export function Pill({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'muted' }) {
  return (
    <span
      className="inline-flex items-center rounded-[10px]"
      style={{
        padding: '2px 8px', fontSize: 8.5, letterSpacing: '.13em', textTransform: 'uppercase',
        color: tone === 'accent' ? T.accent : T.ink3,
        border: `1px solid ${tone === 'accent' ? 'rgba(126,217,174,.35)' : T.line2}`,
        background: tone === 'accent' ? 'rgba(126,217,174,.08)' : 'transparent',
      }}
    >
      {children}
    </span>
  )
}

// Bloque 4 — semáforo único para NORMATIVA: reemplaza las 3 implementaciones de "color por
// status" que había hechas a mano por separado (Compatibilidad, nivel de riesgo, tabla
// Permitido/Proyecto). El color siempre significa lo mismo (cumple/al límite/excede/sin dato),
// el `label` es el texto que ya trae cada campo (no lo fija este componente).
export type EstadoSemaforo = 'cumple' | 'limite' | 'excede' | 'sin-dato'

export function SemaforoParametro({ estado, label }: { estado: EstadoSemaforo; label: string }) {
  const color = estado === 'cumple' ? T.s1 : estado === 'limite' ? T.s2 : estado === 'excede' ? T.bad : T.ink4
  return (
    <span
      className="rounded-full inline-block"
      style={{ fontSize: 9, padding: '2px 8px', letterSpacing: '.08em', textTransform: 'uppercase', color, border: `1px solid ${color}`, whiteSpace: 'nowrap' }}
    >
      {label}
    </span>
  )
}
