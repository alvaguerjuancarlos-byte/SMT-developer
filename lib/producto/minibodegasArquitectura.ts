// Agente de Arquitectura para minibodegas — reemplaza los PASOS 2 y 3 del prompt residencial
// (zonas de departamentos y mix de recámaras) por zonas y mix de bodegas. Las bodegas viajan en
// tipologiaPropuesta.habitacional (totalDepartamentos = total de bodegas, mix = tamaños) para que
// Construcción, Financiero, la pantalla y Mastermind las lean sin cambios; producto lo distingue.

import { SUPUESTOS_MINIBODEGAS } from './minibodegas'

const S = SUPUESTOS_MINIBODEGAS
const pct = (n: number) => `${Math.round(n * 100)}%`

export function pasosArquitecturaMinibodegas(envolvente: { eficienciaVendiblePct: { base: number } } | null): string {
  const mix = S.mix.map(m => `${m.tipo} (~${pct(m.participacionArea)} del área rentable)`).join(', ')
  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — PRODUCTO: MINIBODEGAS PARA RENTA (self storage) — DESGLOSE DE ÁREAS (m², no costo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NO es vivienda: no hay departamentos, recámaras, amenidades residenciales ni cajones por unidad. Es un edificio o
nave de almacenamiento con bodegas chicas de lámina, pasillos interiores, oficina de atención y acceso vehicular
para carga y descarga. "Área vendible" significa aquí ÁREA RENTABLE de bodegas.

ZONA 1 — ÁREA RENTABLE (bodegas)
  Participación: ${envolvente ? `FIJADA en ${envolvente.eficienciaVendiblePct.base}% de la superficie construida` : `${pct(S.eficienciaRentable.piso)}–${pct(S.eficienciaRentable.techo)} de la superficie construida (más alta en 1 nivel con acceso directo en auto, más baja en varios niveles con pasillos interiores)`}
ZONA 2 — PATIO DE MANIOBRAS Y ESTACIONAMIENTO DE CARGA (usa la zona "Estacionamiento")
  Andén o bahías de carga techadas junto a montacargas/accesos y cajones para clientes y personal. Si es descubierto
  va en área libre, no en superficie construida. Sin cajones por unidad.
ZONA 3 — CIRCULACIONES (usa la zona "Circulaciones")
  Pasillos interiores entre bodegas (1.5–2 m), escaleras y montacargas si hay más de 1 nivel.
ZONA 4 — OFICINA Y ATENCIÓN (usa la zona "Áreas comunes")
  Recepción, venta de cajas/candados, sanitarios y cuarto de monitoreo — chica, 1–3% de la construida.
ZONA 5 — SERVICIOS (usa la zona "Cuartos de servicio")
  Cuarto eléctrico, cisterna y contra incendio, cuarto de CCTV/control de acceso.

Niveles: 1 nivel (acceso directo en auto a cada bodega) si el lote es amplio y barato; 2–4 niveles con montacargas si
el lote es caro o chico. No subas niveles solo porque el CUS lo permite si el lote alcanza en 1–2 niveles: en
minibodegas la renta por m² no sube con la altura y cada nivel suma montacargas y estructura.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 3 — MIX DE BODEGAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Propón el número TOTAL de bodegas y su mix por tamaño. Referencia típica: ${mix}.
La suma de (unidades × m² promedio) debe aproximar el área rentable de la Zona 1 (±10%).

CÓMO VA EN EL JSON (mismas llaves del formato de abajo):
- tipologiaPropuesta.producto = "minibodegas"
- tipologiaPropuesta.habitacional.totalDepartamentos = TOTAL DE BODEGAS
- tipologiaPropuesta.habitacional.mix = tamaños de bodega: { "tipo": "Bodega 6 m²", "unidades": 120, "m2Promedio": 6 }
- tipologiaPropuesta.comercial = null; tipologiaPropuesta.tamanoAmenidades = 1
- desgloseZonas: mismas 5 zonas con conceptos de minibodegas (ej. "Bodegas de lámina con puerta enrollable", "Patio y bahías de carga", "Pasillos interiores y montacargas", "Oficina de atención", "Cuarto eléctrico y CCTV")
- Ignora del ejemplo de abajo los conceptos residenciales (departamentos, recámaras, lobby, roof garden)

`
}

// Reemplaza en el prompt residencial el bloque desde "PASO 2" hasta antes de "OUTPUT".
export function aplicarPasosMinibodegas(prompt: string, envolvente: { eficienciaVendiblePct: { base: number } } | null): string {
  const separador = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const iPaso2 = prompt.lastIndexOf(separador, prompt.indexOf('PASO 2 —'))
  const iOutput = prompt.lastIndexOf(separador, prompt.indexOf('OUTPUT — JSON EXACTO'))
  if (iPaso2 < 0 || iOutput <= iPaso2) return prompt
  return prompt.slice(0, iPaso2) + pasosArquitecturaMinibodegas(envolvente) + prompt.slice(iOutput)
}
