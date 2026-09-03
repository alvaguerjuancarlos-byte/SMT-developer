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
        className="text-[12px] font-medium px-4 py-2 rounded-xl border border-[#c9a227]/40 bg-[#c9a227]/10 text-[#ddc06a] hover:bg-[#c9a227]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {exportando === 'pdf' ? 'Generando…' : 'Descargar PDF'}
      </button>
      <button
        onClick={handleExcel}
        disabled={exportando !== null}
        className="text-[12px] font-medium px-4 py-2 rounded-xl border border-[#2a3f5c] bg-[#132a4d] text-[#f4f0e6] hover:bg-[#1c304b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {exportando === 'excel' ? 'Generando…' : 'Descargar Excel'}
      </button>
    </div>
  )
}
