async function buildPDF(filename: string) {
  const { toCanvas } = await import('html-to-image')
  const { jsPDF } = await import('jspdf')

  const source = document.getElementById('propuesta-print')
  if (!source) return null

  // Suppress cross-origin stylesheet access errors
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

  // Render a clone in a fixed full-screen overlay so the browser paints it
  // at a known position (0,0) with an explicit width — avoids blank canvas
  // and viewport-offset issues.
  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#F7F8F6;overflow:auto;pointer-events:none;'

  const clone = source.cloneNode(true) as HTMLElement
  clone.style.cssText = 'width:800px;max-width:none;margin:0;'

  overlay.appendChild(clone)
  document.body.appendChild(overlay)

  try {
    await new Promise(r => setTimeout(r, 300))

    const W = clone.offsetWidth       // 800
    const H = clone.scrollHeight      // full content height

    const canvas = await toCanvas(clone, {
      pixelRatio: 2,
      backgroundColor: '#F7F8F6',
      skipFonts: true,
      width: W,
      height: H,
    })

    const A4_W_MM = 210
    const imgH_MM = (H / W) * A4_W_MM

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
    document.body.removeChild(overlay)
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
