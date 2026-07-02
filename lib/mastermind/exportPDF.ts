// Exportación a PDF de Mastermind — reusa el patrón de renderizado de lib/downloadPDF.ts
// (html-to-image + jsPDF sobre un nodo DOM clonado), sin subir a Supabase (no aplica aquí).

import { downloadPDF } from '@/lib/downloadPDF'

export async function exportarMastermindPDF(nombreProyecto = 'proyecto') {
  const filename = `mastermind-${nombreProyecto.replace(/\s+/g, '-').toLowerCase()}.pdf`
  await downloadPDF(filename, undefined, 'mastermind-print')
}
