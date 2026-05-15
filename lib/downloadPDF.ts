export async function downloadPDF(filename = 'propuesta-smt.pdf') {
  const { toCanvas } = await import('html-to-image')
  const { jsPDF } = await import('jspdf')

  const element = document.getElementById('propuesta-print')
  if (!element) return

  const prevStyle = element.getAttribute('style') || ''

  // mx-auto resolves to a computed margin-left (e.g. 254px) that html-to-image
  // inlines into the SVG clone, shifting the content right inside the canvas.
  // Zeroing margin and removing max-width before capture fixes the left offset.
  element.setAttribute(
    'style',
    `${prevStyle}; width: 900px !important; max-width: none !important; margin: 0 !important;`,
  )

  // Allow layout to reflow at the new width
  await new Promise(r => setTimeout(r, 150))

  try {
    const canvas = await toCanvas(element, {
      pixelRatio: 2,
      backgroundColor: '#F7F8F6',
    })

    const A4_W_MM = 210
    const imgH_MM = (canvas.height / canvas.width) * A4_W_MM

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [A4_W_MM, imgH_MM],
    })

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, imgH_MM)
    pdf.save(filename)
  } finally {
    element.setAttribute('style', prevStyle)
  }
}
