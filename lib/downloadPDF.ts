async function buildPDF(filename: string) {
  const { toCanvas } = await import('html-to-image')
  const { jsPDF } = await import('jspdf')

  const source = document.getElementById('propuesta-print')
  if (!source) return null

  // Work on a hidden clone so the user's view is never disturbed
  const clone = source.cloneNode(true) as HTMLElement
  clone.style.cssText =
    'position:absolute;top:-9999px;left:-9999px;width:900px;max-width:none;margin:0;'
  document.body.appendChild(clone)

  const proto = CSSStyleSheet.prototype
  const originalDescriptor = Object.getOwnPropertyDescriptor(proto, 'cssRules')
  if (originalDescriptor?.get) {
    const originalGet = originalDescriptor.get
    Object.defineProperty(proto, 'cssRules', {
      get() {
        try { return originalGet.call(this) } catch { return [] }
      },
      configurable: true,
    })
  }

  try {
    await new Promise(r => setTimeout(r, 150))

    const canvas = await toCanvas(clone, {
      pixelRatio: 2,
      backgroundColor: '#F7F8F6',
      skipFonts: true,
    })

    const A4_W_MM = 210
    const imgH_MM = (canvas.height / canvas.width) * A4_W_MM

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [A4_W_MM, imgH_MM],
    })

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, imgH_MM)
    return { pdf, filename }
  } catch (err) {
    console.warn('[buildPDF] generation failed:', err)
    return null
  } finally {
    document.body.removeChild(clone)
    if (originalDescriptor) {
      Object.defineProperty(proto, 'cssRules', originalDescriptor)
    }
  }
}

function uploadPDF(pdf: import('jspdf').jsPDF, proyectoId: string) {
  const base64 = pdf.output('datauristring')
  const pdfBase64 = base64.split(',')[1]
  return fetch('/api/upload-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proyectoId, pdfBase64 }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        localStorage.setItem(`smt_pdf_saved_${proyectoId}`, 'true')
        window.dispatchEvent(new CustomEvent('pdf-uploaded', { detail: { proyectoId, pdfUrl: data.pdfUrl } }))
      }
      return data
    })
    .catch(err => console.warn('[uploadPDF] Failed:', err))
}

/** Descarga el PDF localmente y lo sube a Mis Proyectos */
export async function downloadPDF(filename = 'propuesta-smt.pdf', proyectoId?: string) {
  const result = await buildPDF(filename)
  if (!result) return
  result.pdf.save(filename)
  if (proyectoId) uploadPDF(result.pdf, proyectoId)
}

/** Solo sube el PDF a Mis Proyectos sin descargarlo localmente */
export async function autoSavePDF(filename = 'propuesta-smt.pdf', proyectoId?: string) {
  if (!proyectoId) return
  if (localStorage.getItem(`smt_pdf_saved_${proyectoId}`)) return
  const result = await buildPDF(filename)
  if (!result) return
  uploadPDF(result.pdf, proyectoId)
}
