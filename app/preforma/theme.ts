// Paleta/tokens visuales de PREFORMA — extraído de page.tsx para que componentes
// nuevos (DataField, etc.) puedan importarlo sin duplicarlo.
export const T = {
  bg: '#040705', panel: '#080D0B', panel2: '#0B1310',
  line: 'rgba(126,217,174,.11)', line2: 'rgba(126,217,174,.22)',
  ink: '#E8F3ED', ink2: '#9CB3A8', ink3: '#627A70', ink4: '#3E524A',
  accent: '#7ED9AE', accent2: '#4FC08D',
  s1: '#12A98D', s2: '#C4842A', s3: '#7A6FE0', bad: '#C05A3E',
  // Bloque 1 (1.2): color de semáforo para "corriendo" — separado de los colores
  // decorativos por agente (s1/s2/s3/accent/accent2/bad) a propósito: el documento pide que
  // el color de los indicadores de estado signifique SOLO estado (verde/ámbar/rojo), no agente.
  warn: '#D9A62E',
}
