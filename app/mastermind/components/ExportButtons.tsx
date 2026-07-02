'use client'

import { useState } from 'react'
import { useMastermind } from '../state'
import { exportarMastermindPDF } from '@/lib/mastermind/exportPDF'
import { exportarMastermindExcel } from '@/lib/mastermind/exportExcel'

export default function ExportButtons({ nombreProyecto }: { nombreProyecto: string }) {
  const { inputs, outputs } = useMastermind()
  const [exportando, setExportando] = useState<'pdf' | 'excel' | null>(null)

  async function handlePDF() {
    setExportando('pdf')
    try {
      await exportarMastermindPDF(nombreProyecto)
    } finally {
      setExportando(null)
    }
  }

  function handleExcel() {
    setExportando('excel')
    try {
      exportarMastermindExcel(inputs, outputs, nombreProyecto)
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePDF}
        disabled={exportando !== null}
        className="text-[12px] font-medium px-4 py-2 rounded-xl border border-[#9FE1CB] bg-[#F0FBF6] text-[#1D9E75] hover:bg-[#E1F5EE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {exportando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
      </button>
      <button
        onClick={handleExcel}
        disabled={exportando !== null}
        className="text-[12px] font-medium px-4 py-2 rounded-xl border border-[#E2E8E4] bg-white text-[#111d17] hover:bg-[#FAFBFA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {exportando === 'excel' ? 'Generando…' : 'Descargar Excel'}
      </button>
    </div>
  )
}
