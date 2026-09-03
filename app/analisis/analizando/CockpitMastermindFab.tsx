'use client'

// Barra de Mastermind — vive en el header, entre el logo y el badge de proyecto. Crece
// conforme se van integrando agentes al análisis (agentesListos/6) y muestra el dato más
// honesto disponible en cada momento, nunca un margen fabricado: antes de Costos de
// Construcción, calcularMastermindCore() usaría un benchmark genérico como costo real (ver
// motor.ts), así que aquí solo se muestra el ingreso potencial (calcularIngresos, no depende
// del costo de construcción — ver MastermindOverlay.tsx). El margen real solo se muestra una
// vez que Construcción corrió de verdad. Al hacer click abre MastermindOverlay (mismo
// componente, pantalla completa, sin navegar).
export default function CockpitMastermindFab({
  agentesListos, construccionLista, ingresoPotencial, margenBruto, scoreFinanciero, onOpen,
}: {
  agentesListos: number
  construccionLista: boolean
  ingresoPotencial: number | null
  margenBruto: number | null
  scoreFinanciero: number | null
  onOpen: () => void
}) {
  const tieneVeredictoReal = scoreFinanciero != null
  const tieneMargenReal = !tieneVeredictoReal && construccionLista && margenBruto != null
  const activo = tieneVeredictoReal || tieneMargenReal
  const pct = Math.min(100, Math.round((agentesListos / 6) * 100))

  const valor = tieneVeredictoReal ? `Score ${scoreFinanciero}`
    : tieneMargenReal ? `Margen ${margenBruto!.toFixed(1)}%`
    : ingresoPotencial != null ? `Ingreso pot. $${Math.round(ingresoPotencial / 1_000_000)}M`
    : 'Esperando datos'

  return (
    <button
      onClick={onOpen}
      className="relative w-full max-w-[420px] h-[50px] rounded-full overflow-hidden cursor-pointer shrink-0 transition-transform hover:scale-[1.02]"
      style={{ border: tieneVeredictoReal ? '1px solid #c9a227' : tieneMargenReal ? '1px solid #a68f52' : '1px dashed #2a3f5c' }}
      title="Abrir Mastermind"
    >
      {/* Track */}
      <div className="absolute inset-0" style={{ backgroundColor: '#132a4d' }} />
      {/* Fill — crece con agentesListos/6, conforme se integra información al análisis */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: tieneVeredictoReal
            ? 'linear-gradient(90deg, #8a6c1f, #c9a227)'
            : tieneMargenReal
              ? 'linear-gradient(90deg, #2a3f5c, #a68f52)'
              : 'linear-gradient(90deg, #2a3f5c, #3f5a85)',
        }}
      />
      {/* Contenido */}
      <div className="relative h-full flex items-center gap-3 px-5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activo ? '#ddc06a' : '#8b96ab'} strokeWidth="1.5" className="shrink-0">
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="4.5"/>
          <circle cx="12" cy="12" r="1" fill={activo ? '#ddc06a' : '#8b96ab'}/>
        </svg>
        <span
          className="text-[16px] font-semibold truncate"
          style={{ fontFamily: 'var(--font-fraunces)', color: activo ? '#f4f0e6' : '#c9c9c9' }}
        >
          Mastermind
        </span>
        <span className="text-[14.5px] text-[#8b96ab] truncate ml-auto">{valor}</span>
      </div>
    </button>
  )
}
