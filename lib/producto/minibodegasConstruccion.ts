// Agente de Construcción para minibodegas — bloque que se inserta antes del PASO 1 del prompt
// residencial y tiene prioridad sobre sus benchmarks (edificio de departamentos en Monterrey).
// Los rangos son referencias orientativas de prefactibilidad, a validar con cotización.

export const BLOQUE_CONSTRUCCION_MINIBODEGAS = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCTO: MINIBODEGAS PARA RENTA (self storage) — ESTE BLOQUE TIENE PRIORIDAD SOBRE LOS BENCHMARKS RESIDENCIALES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No es vivienda: NO uses los benchmarks de residencial vertical ni de San Pedro de abajo, ni acabados residenciales.
Es una nave o edificio de almacenamiento:
- Estructura: 1 nivel = nave de estructura metálica con cubierta de lámina; 2–4 niveles = estructura metálica o
  concreto con losas para carga de almacenamiento y montacargas.
- Bodegas: sistema de divisiones de lámina galvanizada con puertas enrollables (es la partida característica).
- Instalaciones: eléctrica e iluminación LED por pasillo, contra incendio, CCTV, control de acceso y alarma por bodega.
- Sin cocinas, baños por unidad, recubrimientos residenciales ni amenidades.

Referencia orientativa de COSTO DIRECTO por m² CONSTRUIDO (prefactibilidad 2026, validar con cotización):
- 1 nivel, nave metálica con divisiones: $7,500–$10,500 MXN/m²
- 2–4 niveles con losas y montacargas: $10,000–$14,000 MXN/m²
Úsala como benchmark de VALIDACIÓN en bitacoraConstruccion.rangoReferencia (y fuenteReferencia = "Referencia
paramétrica SMT para minibodegas — validar con cotización"). La banda de construcción solo modula el nivel de
fachada, oficina y clima: banda 1–2 es lo normal en este producto.

Zonas (mismos m² que fijó Arquitectura):
- Zona 1 ÁREA RENTABLE (bodegas): costo base del producto — incluye divisiones y puertas enrollables.
- Zona 2 Patio / bahías de carga techadas: 40–55% de Zona 1.
- Zona 3 Pasillos y montacargas: 70–85% de Zona 1 (montacargas como equipamiento si hay más de 1 nivel).
- Zona 4 Oficina de atención: 100–120% de Zona 1 (acabados de oficina).
- Zona 5 Servicios (eléctrico, contra incendio, CCTV): 60–70% de Zona 1.
Partidas (PASO 3): Estructura y cimentación, Cubierta y fachada, Divisiones y puertas enrollables, Instalaciones
eléctricas e iluminación, Seguridad (CCTV, acceso, alarmas) y contra incendio, Equipamiento (montacargas), Obra
exterior y pavimentos. No uses "Acabados" residenciales como partida principal.
F_ALTURA: usa 1.00 para 1–2 niveles y 1.05 para 3–4 (no los factores de torre residencial).

`

export function aplicarBloqueConstruccionMinibodegas(prompt: string): string {
  const separador = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  const i = prompt.lastIndexOf(separador, prompt.indexOf('PASO 1 —'))
  if (i < 0) return BLOQUE_CONSTRUCCION_MINIBODEGAS + prompt
  return prompt.slice(0, i) + BLOQUE_CONSTRUCCION_MINIBODEGAS + prompt.slice(i)
}
