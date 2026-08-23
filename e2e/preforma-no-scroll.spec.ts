import { test, expect, type Page, type Route } from '@playwright/test'

// Bloque 0 (0.3) + Bloque 1 (1.2/1.3) — ninguna de las 7 pestañas de PREFORMA debe requerir
// scroll a 1280×800 ni 1920×1080 una vez el dashboard está lleno, ni en el Stage central
// (<main>) ni en el rail izquierdo (<aside>, antes la excepción documentada del Bloque 0 —
// el Bloque 1 quitó el <footer> de 150px y el overflow-y-auto que lo dejaba pendiente).
//
// Las llamadas a los 6 agentes + inferir-predio se mockean con page.route para no depender
// del backend/LLM real; las formas de los fixtures siguen el "OUTPUT — JSON EXACTO" de cada
// prompt (ver app/api/agentes/*/route.ts).

const TABS = ['Resumen', 'Terreno', 'Normativa', 'Mercado', 'Arquitectura', 'Costos', 'Financiero']
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

const zonas = [
  { zona: 'Habitacional', concepto: 'Torres', m2: 4200, participacion: '48%' },
  { zona: 'Comercial', concepto: 'Planta baja', m2: 600, participacion: '7%' },
  { zona: 'Estacionamiento', concepto: 'Sótano -1/-2', m2: 2600, participacion: '30%', cajonesEstimados: 65, m2PorCajon: 40 },
  { zona: 'Amenidades', concepto: 'Alberca/gym/roof', m2: 700, participacion: '8%' },
  { zona: 'Áreas comunes', concepto: 'Circulaciones/núcleo', m2: 600, participacion: '7%' },
]

const FIXTURES = {
  inferirPredio: {
    ok: true,
    inferred: {
      clasificacionVial: 'secundaria', pavimento: 'si', esEsquina: 'no', usoSuelo: 'habitacional',
      agua: 'red-municipal', electricidad: 'cfe-frente', pendiente: 'moderada', elevacionDelta: 8,
      direccion: 'Av. Real de Tampiquito 123', colonia: 'Tampiquito', ciudad: 'San Pedro Garza García',
      estado: 'Nuevo León', codigoPostal: '66220',
    },
  },
  comparables: { comparables: [{ precioM2: 11800, superficie: 210, colonia: 'Tampiquito' }, { precioM2: 12600, superficie: 180, colonia: 'Del Valle' }] },
  comparablesVenta: { comparables: [{ precioM2: 42000, superficie: 85, tipologia: 'Depa 2 rec' }, { precioM2: 45500, superficie: 95, tipologia: 'Depa 3 rec' }] },
  terreno: {
    costoTerrenoM2: 12200, costoTerreno: 2440000,
    bitacoraTerreno: {
      metodologia: 'Comparables ajustados', bandaTerreno: 3, nombreBanda: 'Media-alta',
      justificacionBanda: 'Zona consolidada de San Pedro', nseReferencias: 'A/B',
      precioM2Referencia: 12000, fuenteReferencia: 'Portales inmobiliarios locales',
      ajustes: [{ concepto: 'Esquina', descripcion: 'Sin ajuste', factorAjuste: '0%', impactoM2: 0 }],
      precioM2Final: 12200, superficieM2: 200, costoTotalTerreno: 2440000,
      formula: 'precioM2Referencia × factoresAjuste', razonamiento: 'Comparables directos en la zona.',
      supuestos: ['Sin gravámenes'],
      rangoValoracion: { minimo: 11000, maximo: 13500, interpretacion: 'Dentro de rango de mercado' },
      fuentesComparables: [
        { portal: 'Vivanuncios', superficie: 210, precioTotal: 2478000, precioM2: 11800, colonia: 'Tampiquito', distanciaKm: 0.6, fechaPublicacion: '2026-06', valido: true, origen: 'web_search' },
      ],
      indiceConfiabilidad: { score: 78, semaforo: 'VERDE', componenteA: 80, componenteB: 75, componenteC: 78, componenteD: 79, interpretacion: 'Confiable', accionRecomendada: 'Ninguna' },
      validacionPrecioSolicitado: { aplica: false, precioSolicitado: 0, precioCalculado: 12200, diferenciaPorcentaje: 0, semaforo: 'VERDE', interpretacion: 'N/A' },
    },
  },
  legal: {
    fichaLegal: {
      usoSueloActual: 'Habitacional', usoSueloPermitido: 'Habitacional vertical', compatible: true,
      densidadAutorizada: '200 hab/ha', densidadMaxUnidades: 60, cos: '60%', cosNum: 0.6, cus: '3.0', cusNum: 3.0,
      altura: '12 niveles', nivelesMax: 12, cajones: '1 por depa', retiros: '3m frontal',
      municipio: 'San Pedro Garza García', restriccion: 'Ninguna relevante',
      factibilidades: {
        agua: { status: 'Disponible', nota: 'Red municipal en frente' },
        drenaje: { status: 'Disponible', nota: 'Colector a 50m' },
        cfe: { status: 'Con condicionante', nota: 'Requiere ampliación de acometida' },
      },
      regimenCondominio: 'Aplica', restriccionesAmbientales: 'Ninguna', nivelRiesgo: 'Bajo',
      alertasLegales: [{ tipo: 'Normativa', descripcion: 'Verificar remetimientos', impacto: 'Bajo', status: 'amber' }],
    },
    fuentes: { legal: [{ nombre: 'Reglamento de Zonificación SPGG', tipo: 'oficial' }] },
  },
  mercado: {
    mercado: {
      demanda: 'Alta', zona: 'Tampiquito / San Pedro', absorcion: '8 unidades/mes', proyectosActivos: '5',
      precioPromedioZona: '$42,000/m²', perfilNSE: 'A/B', plusvalia: '6% anual', inventario: '35 unidades',
      productoRecomendado: 'Departamento 2-3 recámaras',
      comparables: [
        { nombre: 'Torre Alta', direccion: 'Río Missouri 200', fechaReferencia: '2026-05', precioM2: 43000, avanceObra: 'En obra', unidades: 40, tipologia: '2 rec', colonia: 'Tampiquito', lat: 25.6470, lng: -100.3870, distanciaKm: 0.6 },
        { nombre: 'Vive Tampiquito', direccion: 'Gómez Morín 500', fechaReferencia: '2026-03', precioM2: 41000, avanceObra: 'Preventa', unidades: 30, tipologia: '3 rec', colonia: 'Valle Oriente', lat: 25.6390, lng: -100.3620, distanciaKm: 2.4 },
        { nombre: 'Residencial Sur', direccion: 'Real San Agustín 80', fechaReferencia: '2025-11', precioM2: 44500, avanceObra: 'Entregado', unidades: 25, tipologia: '2 rec', colonia: 'Del Valle', lat: 25.6510, lng: -100.3990, distanciaKm: 1.3 },
      ],
      ofertaActiva: { proyectosEnPreventa: 2, proyectosEnObra: 2, proyectosEntregados24m: 1, unidadesDisponibles: 35, rangoPrecios: '$41,000–$44,500/m²', saturacion: 'Media' },
      segmentacion: [
        { tipo: 'Vertical', absorcionMensual: '6', precioM2: 42000, participacion: '70%', perfilComprador: 'Profesionista joven' },
        { tipo: 'Horizontal', absorcionMensual: '2', precioM2: 38000, participacion: '30%', perfilComprador: 'Familia' },
      ],
      pricingFases: [
        { fase: 'Preventa', precioM2: 39000, descuento: '10%', meta: '30% de unidades' },
        { fase: 'Obra', precioM2: 42000, descuento: '4%', meta: '50% de unidades' },
        { fase: 'Entrega', precioM2: 45000, descuento: '0%', meta: '20% de unidades' },
      ],
    },
    fuentes: { mercado: [{ nombre: 'Portales inmobiliarios', tipo: 'web' }] },
  },
  arquitectura: {
    superficieConstruida: 8700, superficieVendible: 4200,
    bitacoraArquitectura: {
      cosEstimado: '58%', cusEstimado: '2.9',
      tipologiaPropuesta: {
        niveles: 10,
        habitacional: { totalDepartamentos: 48, mix: [{ tipo: '2 rec', unidades: 30, m2Promedio: 78 }, { tipo: '3 rec', unidades: 18, m2Promedio: 98 }] },
        comercial: { totalLocales: 3, niveles: 1 },
        tamanoAmenidades: 2, fijadoManualmente: [],
      },
      superficieConstruida: 8700, superficieVendible: 4200,
      desgloseZonas: zonas,
      areaLibreYVerde: { m2: 350, porcentajeLote: '17%', descripcion: 'Jardín frontal y áreas verdes' },
      razonamiento: 'Volumetría compacta con sótano de dos niveles para estacionamiento.',
      supuestos: ['Altura de entrepiso 2.8m'],
      tipoEstacionamientoFijado: 'subterraneo',
    },
  },
  construccion: {
    construccionM2: 19400, costoTotalConstruccion: 168780000,
    bitacoraConstruccion: {
      bandaElegida: 3, nombreBanda: 'Media-alta', descripcionBanda: 'Acabados de gama media-alta',
      costoPorM2Base: 18500, ciudadAjuste: '+5% San Pedro', ajustes: [{ concepto: 'Zona', descripcion: 'San Pedro', factorAjuste: '5%', impactoM2: 900 }],
      costoPorM2VendibleFinal: 40185, costoPorM2Final: 19400, superficieConstruccionM2: 8700, costoTotalConstruccion: 168780000,
      formula: 'costoPorM2Base × ajustes', fuenteReferencia: 'BENCHMARKS_CONSTRUCCION_MXN_M2',
      razonamiento: 'Costo alineado a proyectos residenciales verticales recientes en la zona.',
      supuestos: ['Cimentación estándar'],
      rangoReferencia: { minimo: 17500, maximo: 21000, interpretacion: 'Dentro de rango' },
      fuentesConstruccion: [
        { fuente: 'CMIC Nuevo León', dato: '$19,000–$21,000/m²', fecha: '2026-04', disponible: true },
        { fuente: 'Construdata México', dato: '$18,500–$20,800/m²', fecha: '2026-05', disponible: true },
        { fuente: 'CANADEVI Nuevo León', dato: '$19,200/m² promedio', fecha: '2024-01', disponible: true },
      ],
      dispersionFuentes: '6.2%',
      indiceConfiabilidad: { score: 74, semaforo: 'VERDE', componenteA: 75, componenteB: 74, componenteC: 73, componenteD: 74, interpretacion: 'Confiable', accionRecomendada: 'Ninguna' },
      desgloseConstruccion: {
        areaVerdeYLibre: { m2: 350, porcentajeLote: '17%', costoUrbanizacion: 1750000, costoUrbanizacionM2: 5000, descripcion: 'Jardines y andadores' },
        zonas: zonas.map((z) => ({ ...z, costoM2: 19400, factorRespectoBanda: '100%', costoTotal: z.m2 * 19400, nota: '' })),
      },
      desglosePorPartidas: [
        { partida: 'Cimentación', porcentaje: 12, costoPorM2: 2328, descripcion: 'Losa y zapatas' },
        { partida: 'Estructura', porcentaje: 22, costoPorM2: 4268, descripcion: 'Concreto y acero' },
        { partida: 'Albañilería', porcentaje: 14, costoPorM2: 2716, descripcion: 'Muros y aplanados' },
        { partida: 'Acabados', porcentaje: 18, costoPorM2: 3492, descripcion: 'Pisos y recubrimientos' },
        { partida: 'Instalación eléctrica', porcentaje: 8, costoPorM2: 1552, descripcion: 'Media y baja tensión' },
        { partida: 'Instalación hidrosanitaria', porcentaje: 8, costoPorM2: 1552, descripcion: 'Agua y drenaje' },
        { partida: 'Herrería y cancelería', porcentaje: 10, costoPorM2: 1940, descripcion: 'Ventanería y barandales' },
        { partida: 'Elevadores', porcentaje: 8, costoPorM2: 1552, descripcion: '2 elevadores' },
      ],
      materialesPrincipales: [
        { material: 'Concreto', unidad: 'm³', cantidadPorM2: 0.45, precioUnitario: 2800, costoPorM2: 1260, nota: 'f\'c 250' },
        { material: 'Acero de refuerzo', unidad: 'kg', cantidadPorM2: 28, precioUnitario: 24, costoPorM2: 672, nota: '' },
        { material: 'Block', unidad: 'pza', cantidadPorM2: 12, precioUnitario: 14, costoPorM2: 168, nota: '' },
        { material: 'Piso porcelanato', unidad: 'm²', cantidadPorM2: 0.9, precioUnitario: 450, costoPorM2: 405, nota: '' },
        { material: 'Cable eléctrico', unidad: 'm', cantidadPorM2: 3, precioUnitario: 35, costoPorM2: 105, nota: '' },
        { material: 'Tubería PVC', unidad: 'm', cantidadPorM2: 2, precioUnitario: 60, costoPorM2: 120, nota: '' },
      ],
    },
  },
  financiero: {
    recomendacion: { tipologia: 'Vertical residencial', descripcion: 'Mezcla 2-3 recámaras' },
    financiero: {
      costoTerreno: 2440000, costoTerrenoM2: 12200, construccionM2: 19400, costoTotalConstruccion: 168780000,
      indirectos: 25317000, indirectosDesglose: [{ concepto: 'Supervisión', monto: 12000000 }],
      honorarios: 8439000, honorariosDesglose: [{ concepto: 'Proyecto ejecutivo', monto: 8439000 }],
      imprevistos: 8439000, imprevistosDesglose: [{ concepto: 'Contingencia', monto: 8439000 }],
      inversionTotal: 213415000, precioVentaM2: 42000, ingresosProyectados: 176400000,
      descuentos: 8820000, ingresosNetos: 167580000, comercializacion: 6703200,
      utilidadBruta: 38165000, margenBruto: 22.4,
      tir: 23.8, tirConverge: true, tirProyecto: 17.1, tirProyectoConverge: true,
      plazoObraMeses: 18, plazoVentaMeses: 22, inicioVentasMes: 4,
      escaladoPorMix: { factor: 1.0 },
      validacionIndirectos: { fueraDeRango: false },
    },
    estructuraCapital: {
      equity: 45, deuda: 55, montoEquity: 96037000, montoDeuda: 117378000,
      tipoDeuda: 'Puente', tasaDeuda: 'TIIE + 3.5% anual (aprox. 14.5%)', tasaDeudaAnual: 14.5,
      costoFinanciero: 12600000,
      preventa: { unidadesMinimas: 20, porcentajeMinimo: '42%', montoMinimo: 74088000, condicion: 'Antes de disponer del crédito puente' },
      tasaDescuento: '12%', isrEstimado: 9541000, utilidadNeta: 28624000,
      descripcion: 'Estructura balanceada 45/55.',
    },
    // Bloque 8 (criterio #2): notas de hito reales en algunos periodos — el resto vacío, como
    // realmente devuelve el agente (no todos los meses son un evento).
    flujoMensual: Array.from({ length: 9 }, (_, i) => ({
      mes: i * 3, fase: i < 6 ? 'Obra' : 'Venta', egresos: 20000000 - i * 500000, ingresos: i * 5000000, acumulado: i * 2000000 - 20000000,
      nota: i === 0 ? 'Escrituración y pago del terreno' : i === 2 ? 'Apertura de crédito puente e inicio de obra' : i === 7 ? 'Entrega de unidades y escrituración' : '',
    })),
    score: { total: 78, solidezFinanciera: 80, riesgoRegulatorio: 75, exposicionMercado: 79 },
    metodologiaScore: {
      descripcion: 'Ponderación de 3 dimensiones',
      dimensiones: [
        { nombre: 'Solidez financiera', peso: '40%', score: 80, factores: [{ factor: 'TIR', contribucion: '20%' }], interpretacion: 'Sólido' },
        { nombre: 'Riesgo regulatorio', peso: '30%', score: 75, factores: [{ factor: 'Compatibilidad', contribucion: '15%' }], interpretacion: 'Bajo riesgo' },
        { nombre: 'Exposición de mercado', peso: '30%', score: 79, factores: [{ factor: 'Absorción', contribucion: '15%' }], interpretacion: 'Favorable' },
      ],
    },
    stressTest: [
      { titulo: 'Caída de precio 10%', escenario: 'Precio −10%', impacto: 'TIR baja a 15%', status: 'amber' },
      { titulo: 'Sobrecosto 10%', escenario: 'Costo +10%', impacto: 'TIR baja a 16%', status: 'amber' },
      { titulo: 'Escenario base', escenario: 'Sin cambios', impacto: 'TIR 23.8%', status: 'green' },
    ],
    puntoQuiebre: { desviacionMaxCostos: '14%', absorcionMinViable: '4 unidades/mes', precioVentaMinimo: '$36,500/m²', resumen: 'Proyecto resiste desviaciones moderadas.' },
  },
}

async function mockAgentes(page: Page) {
  await page.route('**/api/inferir-predio*', (r) => json(r, FIXTURES.inferirPredio))
  await page.route('**/api/agentes/comparables', (r) => json(r, FIXTURES.comparables))
  await page.route('**/api/agentes/comparables-venta', (r) => json(r, FIXTURES.comparablesVenta))
  await page.route('**/api/agentes/terreno', (r) => json(r, FIXTURES.terreno))
  await page.route('**/api/agentes/legal', (r) => json(r, FIXTURES.legal))
  await page.route('**/api/agentes/mercado', (r) => json(r, FIXTURES.mercado))
  await page.route('**/api/agentes/arquitectura', (r) => json(r, FIXTURES.arquitectura))
  await page.route('**/api/agentes/construccion', (r) => json(r, FIXTURES.construccion))
  await page.route('**/api/agentes/financiero', (r) => json(r, FIXTURES.financiero))
}

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('Faltan E2E_TEST_EMAIL / E2E_TEST_PASSWORD (ver .env.local) — /preforma exige sesión real (app/providers.tsx).')
  }
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

async function completarIntake(page: Page) {
  await login(page)
  await page.goto('/preforma')

  // 1. nombre (texto)
  await page.locator('input[placeholder="Escribe aquí…"]').fill('Torre Tampiquito')
  await page.getByRole('button', { name: 'Enviar' }).click()

  // 2. ubicación — la Stage salta sola a Terreno; coordenadas del proyecto de prueba
  // "tampiquito" citado en el propio documento de mejoras.
  await page.locator('input[placeholder*="maps.app.goo.gl"]').fill('25.64485, -100.38506')
  await page.getByRole('button', { name: 'Confirmar ubicación' }).click()

  // 3. superficie (numero)
  await page.locator('input[placeholder="0"]').fill('200')
  await page.getByRole('button', { name: 'Enviar' }).click()

  // 4. tipo (chips-multi)
  await page.getByRole('button', { name: 'Residencial vertical' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  // 5. presupuesto (chips-single, auto-avanza)
  await page.getByRole('button', { name: '$50–$150 MDP' }).click()

  // 6. banda (chips-single, auto-avanza) — dispara el arranque del pipeline
  await page.getByRole('button', { name: 'Media Alta' }).click()

  // El intake deja `tab` en 'terreno' (saltó ahí al capturar ubicación) — hay que volver a
  // Resumen a mano para ver los KPIs.
  await page.locator('nav button', { hasText: 'Resumen' }).click()

  // El pipeline mockeado resuelve casi instantáneo, pero esperamos a que el KPI de
  // Financiero deje de mostrar "—" como señal de que ya terminó toda la cadena.
  await expect(page.getByText('TIR Socio')).toBeVisible()
  await page.waitForFunction(() => {
    const el = [...document.querySelectorAll('*')].find((n) => n.textContent?.trim() === 'TIR Socio')
    const value = el?.parentElement?.querySelector('div')?.textContent ?? ''
    return /%/.test(value)
  }, { timeout: 30_000 })
}

async function medirOverflow(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((el) => ({ v: el.scrollHeight - el.clientHeight, h: el.scrollWidth - el.clientWidth }))
}

async function assertSinScroll(page: Page, tab: string) {
  await page.locator('nav button', { hasText: tab }).click()
  await page.waitForTimeout(150)
  // hay un <main> externo (layout) y el Stage central de PREFORMA anidado adentro —
  // el que nos interesa es el interno, identificado por su overflow-hidden (Bloque 0, 0.3).
  const main = await medirOverflow(page.locator('main main'))
  expect(main.v, `${tab}: overflow vertical de ${main.v}px en <main>`).toBeLessThanOrEqual(1)
  expect(main.h, `${tab}: overflow horizontal de ${main.h}px en <main>`).toBeLessThanOrEqual(1)

  // Rail izquierdo (ficha del proyecto + potencial + escenarios) — Bloque 1, 1.3.
  const aside = await medirOverflow(page.locator('aside').first())
  expect(aside.v, `${tab}: overflow vertical de ${aside.v}px en el rail izquierdo`).toBeLessThanOrEqual(1)
  expect(aside.h, `${tab}: overflow horizontal de ${aside.h}px en el rail izquierdo`).toBeLessThanOrEqual(1)
}

for (const viewport of VIEWPORTS) {
  test.describe(`sin scroll — ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport })

    test('las 7 pestañas caben sin scroll vertical/horizontal, en <main> y en el rail izquierdo', async ({ page }) => {
      await mockAgentes(page)
      await completarIntake(page)
      await expect(page.locator('footer')).toHaveCount(0)
      for (const tab of TABS) {
        await assertSinScroll(page, tab)
      }
    })
  })
}

// Bloque 1 (1.1) — los 3 modos del panel del Agente PREFORMA cambian el grid del Stage.
test.describe('panel del Agente PREFORMA — 3 modos', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  async function columnas(page: Page) {
    const value = await page.getByTestId('stage-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    return value.trim().split(/\s+/).length
  }

  test('centered al iniciar el intake, hidden al terminarlo, docked al reabrir', async ({ page }) => {
    await mockAgentes(page)
    await login(page)
    await page.goto('/preforma')

    // Arranca centrado (overlay) — la 3ª columna del grid no existe todavía.
    await expect(page.getByText('Agente PREFORMA')).toBeVisible()
    expect(await columnas(page)).toBe(2)

    await completarIntake(page)

    // Al terminar el intake se guarda solo: sin 3ª columna, botón flotante visible.
    expect(await columnas(page)).toBe(2)
    const reabrir = page.locator('button[title="Agente PREFORMA"]')
    await expect(reabrir).toBeVisible()

    // Reabrir → 'docked', 3ª columna de vuelta con Riesgos + Agente PREFORMA.
    await reabrir.click()
    expect(await columnas(page)).toBe(3)
    await expect(page.getByText('Riesgos críticos')).toBeVisible()
    await expect(page.getByText('Agente PREFORMA')).toBeVisible()
  })
})

// Bloque 3 (3.1/3.2) — matriz de sensibilidad accionable: click en una celda reconfigura el
// modelo completo, guardar una celda crea un escenario real, y hay al menos una variable de
// tiempo elegible como eje.
test.describe('matriz de sensibilidad accionable', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  async function tirSocioTexto(page: Page) {
    return page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((n) => n.textContent?.trim() === 'TIR Socio')
      return el?.parentElement?.querySelector('div')?.textContent ?? ''
    })
  }

  test('click en una celda mueve el KPI, guardar crea un escenario, y hay eje de tiempo', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    const tirInicial = await tirSocioTexto(page)
    expect(tirInicial).toMatch(/%/)

    // La matriz vive en la tarjeta "Sensibilidad · TIR" (<Card/> se renderiza como <section>).
    // Ejes por default: fila = costo de construcción, columna = precio de venta — la celda de
    // índice 4 (fila 0, última columna) es "costo mínimo · precio máximo", la combinación más
    // favorable de las 25 y la que con más seguridad se aleja del centro (no la esquina [0][0]:
    // ahí bajar costo Y precio a la vez puede casi cancelarse en un caso base muy negativo).
    const card = page.locator('section', { has: page.getByText('Sensibilidad · TIR', { exact: true }) })
    const celdas = card.locator('table button')
    await expect(celdas.nth(4)).toBeVisible()
    await celdas.nth(4).click()

    await expect.poll(() => tirSocioTexto(page), { timeout: 5000 }).not.toBe(tirInicial)

    // Guardar la celda activa como escenario — debe aparecer en la lista del rail izquierdo.
    await page.getByText('+ Guardar celda activa como escenario').click()
    await expect(page.getByText('B · Guardado')).toBeVisible()

    // Al menos una variable de tiempo elegible como eje (criterio de aceptación #3).
    const selects = card.locator('select')
    await expect(selects.first().locator('option', { hasText: 'Plazo de venta' })).toHaveCount(1)
    await selects.first().selectOption('plazoVenta')
    await expect(card.locator('table th').first()).toBeVisible()
  })
})

// Bloque 4 — TERRENO/NORMATIVA: captura dual (manual se distingue visualmente de auto) y
// agua/drenaje/electricidad son el mismo campo compartido entre las dos pestañas.
test.describe('TERRENO/NORMATIVA — captura dual', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('poner "Uso de suelo" en Manual se distingue de Auto, y "Agua" es el mismo dato en las 2 pestañas', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    await page.locator('nav button', { hasText: 'Terreno' }).click()
    const fichaFisica = page.locator('section', { has: page.getByText('Características físicas', { exact: true }) })
    const usoSuelo = fichaFisica.locator('div', { has: page.getByText('Uso de suelo', { exact: true }) }).nth(1)

    // Auto es el default — el botón "Auto" está resaltado (por eso el chip del valor actual
    // ya se ve elegido) y "Manual" todavía no.
    const botonManual = usoSuelo.getByRole('button', { name: 'Manual', exact: true })
    await botonManual.click()
    const chipComercial = usoSuelo.getByRole('button', { name: 'Comercial', exact: true })
    await chipComercial.click()

    // El chip elegido queda resaltado (mismo mecanismo visual de "seleccionado" que ya usan
    // los chips del intake) — así se distingue un dato manual de uno sugerido (criterio #2).
    await expect(chipComercial).toHaveCSS('color', 'rgb(126, 217, 174)') // T.accent

    // "Agua" es un solo FieldKey compartido — leerlo en Normativa y cambiarlo en Terreno debe
    // reflejarse en ambos lados.
    const accesibilidad = page.locator('section', { has: page.getByText('Accesibilidad y servicios', { exact: true }) })
    const aguaTerreno = accesibilidad.locator('div', { has: page.getByText('Agua potable', { exact: true }) }).nth(1)
    await aguaTerreno.getByRole('button', { name: 'Manual', exact: true }).click()
    await aguaTerreno.getByRole('button', { name: 'Con condicionante', exact: true }).click()

    await page.locator('nav button', { hasText: 'Normativa' }).click()
    const factibilidades = page.locator('section', { has: page.getByText('Factibilidades', { exact: true }) })
    const aguaNormativa = factibilidades.locator('div', { has: page.getByText('Agua', { exact: true }) }).nth(1)
    await expect(aguaNormativa.getByRole('button', { name: 'Con condicionante', exact: true })).toHaveCSS('color', 'rgb(126, 217, 174)')
  })
})

test.describe('MERCADO — selector Oferta/Demanda y radio de comparables', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('el toggle Oferta/Demanda cambia el panel visible; comparables muestran colonia/distancia real', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    await page.locator('nav button', { hasText: 'Mercado' }).click()

    // Colonia y distancia (criterio de radio 5km) llegan en la tabla de comparables.
    const cardComparables = page.locator('section', { has: page.getByText('Comparables de la zona') })
    await expect(cardComparables.getByText('Tampiquito', { exact: true })).toBeVisible()
    await expect(cardComparables.getByText('0.6', { exact: true })).toBeVisible()

    // Default es la vista "Oferta" — muestra ofertaActiva/pricingFases, no la segmentación de demanda.
    await expect(page.getByText('Rango de precios', { exact: true })).toBeVisible()
    await expect(page.getByText('Perfil NSE', { exact: true })).not.toBeVisible()

    await page.getByRole('button', { name: 'demanda', exact: true }).click()

    await expect(page.getByText('Perfil NSE', { exact: true })).toBeVisible()
    await expect(page.getByText('Rango de precios', { exact: true })).not.toBeVisible()
  })
})

test.describe('ARQUITECTURA — niveles en vivo y alerta de CUS', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('la fixture (10 niveles, COS 60%) excede el CUS permitido (3.0) al cargar; aplicar la sugerencia lo resuelve', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    await page.locator('nav button', { hasText: 'Arquitectura' }).click()

    const cardVolumetria = page.locator('section', { has: page.getByText('Volumetría y niveles') })
    await expect(cardVolumetria.getByText('Te pasas 600 m² del CUS permitido (3.0 → 6.0)')).toBeVisible()

    await cardVolumetria.getByRole('button', { name: 'Aplicar 5 niveles', exact: true }).click()

    await expect(cardVolumetria.getByText('Te pasas', { exact: false })).not.toBeVisible()

    const cardCumplimiento = page.locator('section', { has: page.getByText('Cumplimiento normativo') })
    const filaCUS = cardCumplimiento.locator('tr', { has: page.getByText('CUS', { exact: true }) })
    await expect(filaCUS.getByText('Cumple', { exact: true })).toBeVisible()
  })
})

test.describe('COSTOS — fuentes, overhead fuera de rango y alerta de $/m²', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('muestra las 3 fuentes citadas (una no confiable), honorarios fuera de rango por default, y la alerta de $/m² al editar', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    await page.locator('nav button', { hasText: 'Costos' }).click()

    const cardFuentes = page.locator('section', { has: page.getByText('Fuentes citadas', { exact: false }) })
    await expect(cardFuentes.getByText('CMIC Nuevo León', { exact: true })).toBeVisible()
    await expect(cardFuentes.getByText('Construdata México', { exact: true })).toBeVisible()
    await expect(cardFuentes.getByText('CANADEVI Nuevo León', { exact: true })).toBeVisible()
    await expect(cardFuentes.getByText('no confiable', { exact: false })).toBeVisible()

    // Fixture: honorarios = $8,439,000 sobre $168,780,000 de construcción ≈ 5% — muy por debajo
    // del rango de banda 3 (13-20%) — debe salir "Fuera de rango" sin tocar nada.
    const cardOverhead = page.locator('section', { has: page.getByText('Indirectos, honorarios e imprevistos') })
    const filaHonorarios = cardOverhead.locator('div', { has: page.getByText('Honorarios', { exact: true }) }).first()
    await expect(filaHonorarios.getByText('Fuera de rango', { exact: true })).toBeVisible()

    // Editar el costo de construcción a un valor bien por debajo de la banda 3 ($16,000-$24,000)
    // dispara la alerta de $/m² fuera de rango de mercado.
    const cardCosto = page.locator('section', { has: page.getByText('Costo de construcción', { exact: true }) })
    const campoCosto = cardCosto.locator('div', { has: page.getByText('Costo construcción $/m²', { exact: true }) }).nth(1)
    await campoCosto.getByRole('button', { name: 'Manual', exact: true }).click()
    const input = campoCosto.locator('input[inputmode="numeric"]')
    await input.fill('12000')
    await input.blur()
    await page.waitForTimeout(250) // debounce de 150ms del commit numérico en DataField

    await expect(cardCosto.getByText('debajo del promedio de la zona', { exact: false })).toBeVisible()

    await cardCosto.getByRole('button', { name: 'Usar $20,000/m²', exact: true }).click()
    await expect(cardCosto.getByText('debajo del promedio de la zona', { exact: false })).not.toBeVisible()
  })
})

test.describe('FINANCIERO — mezcla equity/deuda en vivo y detalle por periodo', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('mover la mezcla de deuda cambia costo financiero/TIR, y click en una barra abre su detalle', async ({ page }) => {
    await mockAgentes(page)
    await completarIntake(page)

    await page.locator('nav button', { hasText: 'Financiero' }).click()

    const cardCapital = page.locator('section', { has: page.getByText('Estructura de capital', { exact: true }) })
    const filaTir = cardCapital.locator('div', { has: page.getByText('TIR Socio', { exact: true }) }).last()
    const tirInicial = await filaTir.locator('b').textContent()

    const campoDeuda = cardCapital.locator('div', { has: page.getByText('Mezcla — % deuda', { exact: true }) }).nth(1)
    await campoDeuda.getByRole('button', { name: 'Manual', exact: true }).click()
    const input = campoDeuda.locator('input[inputmode="numeric"]')
    await input.fill('80')
    await input.blur()
    await page.waitForTimeout(250) // debounce de 150ms del commit numérico en DataField

    await expect(cardCapital.getByText('Deuda 80%', { exact: true })).toBeVisible()
    await expect.poll(() => filaTir.locator('b').textContent()).not.toBe(tirInicial)

    // Click en la primera barra del flujo (mes 0, fixture con nota "Escrituración y pago del
    // terreno") abre el panel de detalle con esa nota (criterio #2).
    const cardFlujo = page.locator('section', { has: page.getByText('Flujo de caja proyectado', { exact: true }) })
    await cardFlujo.locator('svg g').first().click()
    await expect(cardFlujo.getByText('Escrituración y pago del terreno', { exact: true })).toBeVisible()
  })
})
