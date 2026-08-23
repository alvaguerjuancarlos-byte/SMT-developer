import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectStore, type FieldKey, type FieldState } from '../useProjectStore'

const CAMPO_VACIO: FieldState = { value: null, source: 'empty', agentValue: null }

beforeEach(() => {
  // Reconstruye todos los fields en blanco a partir de las keys que el store ya conoce
  // (en vez de hardcodear la lista aquí) — así el test no se desactualiza cada vez que se
  // agrega un FieldKey nuevo (Bloque 4 sumó 18 de TERRENO/NORMATIVA a los 7 originales).
  const keys = Object.keys(useProjectStore.getState().fields) as FieldKey[]
  useProjectStore.setState({
    fields: Object.fromEntries(keys.map((k) => [k, { ...CAMPO_VACIO }])) as Record<FieldKey, FieldState>,
    escenarios: [],
  })
})

describe('setFieldFromAgent', () => {
  it('llena un campo vacío con el valor del agente', () => {
    useProjectStore.getState().setFieldFromAgent('costoTerrenoM2', 12000, { confidence: 0.8 })
    const f = useProjectStore.getState().fields.costoTerrenoM2
    expect(f.value).toBe(12000)
    expect(f.source).toBe('agent')
    expect(f.confidence).toBe(0.8)
  })

  it('no sobrescribe un campo en manual con un valor distinto — lo marca en conflicto', () => {
    useProjectStore.getState().setFieldManual('costoConstruccionM2', 19000)
    useProjectStore.getState().setFieldFromAgent('costoConstruccionM2', 24000)
    const f = useProjectStore.getState().fields.costoConstruccionM2
    expect(f.value).toBe(19000)
    expect(f.source).toBe('user')
    expect(f.conflicto).toBe(true)
    expect(f.agentValue).toBe(24000)
  })

  it('no marca conflicto si el agente trae el mismo valor que ya está en manual', () => {
    useProjectStore.getState().setFieldManual('costoConstruccionM2', 19000)
    useProjectStore.getState().setFieldFromAgent('costoConstruccionM2', 19000)
    const f = useProjectStore.getState().fields.costoConstruccionM2
    expect(f.conflicto).toBe(false)
    expect(f.value).toBe(19000)
  })

  it('Bloque 4: también funciona con valores de texto (campos de TERRENO/NORMATIVA)', () => {
    useProjectStore.getState().setFieldFromAgent('usoSueloTerreno', 'habitacional')
    let f = useProjectStore.getState().fields.usoSueloTerreno
    expect(f.value).toBe('habitacional')
    expect(f.source).toBe('agent')

    useProjectStore.getState().setFieldManual('usoSueloTerreno', 'comercial')
    useProjectStore.getState().setFieldFromAgent('usoSueloTerreno', 'mixto')
    f = useProjectStore.getState().fields.usoSueloTerreno
    expect(f.value).toBe('comercial')
    expect(f.source).toBe('user')
    expect(f.conflicto).toBe(true)
    expect(f.agentValue).toBe('mixto')
  })
})

describe('resolverConflicto', () => {
  it('aceptar promueve el valor del agente y limpia el conflicto', () => {
    useProjectStore.getState().setFieldManual('precioVentaM2', 40000)
    useProjectStore.getState().setFieldFromAgent('precioVentaM2', 45000)
    useProjectStore.getState().resolverConflicto('precioVentaM2', true)
    const f = useProjectStore.getState().fields.precioVentaM2
    expect(f.value).toBe(45000)
    expect(f.source).toBe('agent')
    expect(f.conflicto).toBe(false)
  })

  it('mantener conserva el valor manual y solo limpia el conflicto', () => {
    useProjectStore.getState().setFieldManual('precioVentaM2', 40000)
    useProjectStore.getState().setFieldFromAgent('precioVentaM2', 45000)
    useProjectStore.getState().resolverConflicto('precioVentaM2', false)
    const f = useProjectStore.getState().fields.precioVentaM2
    expect(f.value).toBe(40000)
    expect(f.source).toBe('user')
    expect(f.conflicto).toBe(false)
  })
})

describe('resetField / resetAllFields', () => {
  it('resetField vuelve a Auto usando el último valor del agente', () => {
    useProjectStore.getState().setFieldFromAgent('unidadesObjetivo', 18)
    useProjectStore.getState().setFieldManual('unidadesObjetivo', 22)
    useProjectStore.getState().resetField('unidadesObjetivo')
    const f = useProjectStore.getState().fields.unidadesObjetivo
    expect(f.source).toBe('agent')
    expect(f.value).toBe(18)
  })

  it('resetAllFields regresa todos los campos manuales a su valor de agente', () => {
    useProjectStore.getState().setFieldFromAgent('costoTerrenoM2', 12000)
    useProjectStore.getState().setFieldManual('costoTerrenoM2', 15000)
    useProjectStore.getState().setFieldManual('unidadesObjetivo', 30)
    useProjectStore.getState().resetAllFields()
    const { costoTerrenoM2, unidadesObjetivo } = useProjectStore.getState().fields
    expect(costoTerrenoM2.value).toBe(12000)
    expect(costoTerrenoM2.source).toBe('agent')
    expect(unidadesObjetivo.value).toBeNull()
    expect(unidadesObjetivo.source).toBe('empty')
  })
})

describe('escenarios (Bloque 3)', () => {
  it('agregarEscenario agrega un ScenarioSnapshot con id propio', () => {
    useProjectStore.getState().agregarEscenario('B · Conservador', { mercado: {} }, 18.4)
    const [e] = useProjectStore.getState().escenarios
    expect(e.nombre).toBe('B · Conservador')
    expect(e.tir).toBe(18.4)
    expect(typeof e.id).toBe('string')
    expect(e.id.length).toBeGreaterThan(0)
  })

  it('eliminarEscenario quita solo el escenario indicado', () => {
    useProjectStore.getState().agregarEscenario('B', {}, 10)
    useProjectStore.getState().agregarEscenario('C', {}, 20)
    const idB = useProjectStore.getState().escenarios[0].id
    useProjectStore.getState().eliminarEscenario(idB)
    const restantes = useProjectStore.getState().escenarios
    expect(restantes).toHaveLength(1)
    expect(restantes[0].nombre).toBe('C')
  })

  it('resetProyecto limpia los escenarios guardados', () => {
    useProjectStore.getState().agregarEscenario('B', {}, 10)
    useProjectStore.getState().resetProyecto()
    expect(useProjectStore.getState().escenarios).toEqual([])
  })
})
