import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const data = await req.json()

  const usoSueloLabels: Record<string, string> = {
    habitacional: 'Habitacional', comercial: 'Comercial', mixto: 'Mixto',
    industrial: 'Industrial', agricola: 'Agrícola', 'sin-uso': 'Sin uso definido',
  }
  const estadoLabels: Record<string, string> = {
    'baldio-limpio': 'Baldío limpio', 'baldio-escombro': 'Baldío con escombro',
    construccion: 'Construcción existente', vegetacion: 'Vegetación densa',
  }
  const presupuestoLabels: Record<string, string> = {
    'menos-5m': 'Menos de $5 MDP', '5-15m': '$5–$15 MDP', '15-50m': '$15–$50 MDP',
    '50-150m': '$50–$150 MDP', 'mas-150m': 'Más de $150 MDP', 'por-definir': 'Por definir con socios',
  }
  const bandaConstruccionLabels: Record<string, string> = {
    '1': 'Banda 1 — Económica / Interés Social (acabados básicos, $7,000–$10,500/m²)',
    '2': 'Banda 2 — Media Estándar (concreto armado, acabados medios, $10,500–$16,000/m²)',
    '3': 'Banda 3 — Media Alta / Residencial (acabados premium, amenidades, $16,000–$24,000/m²)',
    '4': 'Banda 4 — Premium / Lujo (materiales importados, domótica, $24,000–$45,000+/m²)',
  }

  const desarrolloLabels: Record<string, string> = {
    'residencial-vertical': 'Residencial vertical', 'residencial-horizontal': 'Residencial horizontal',
    comercial: 'Comercial', mixto: 'Uso mixto', industrial: 'Industrial / Nave', 'no-definido': 'Sin definir',
  }

  const pendienteLabels: Record<string, string> = {
    'plano': 'Plano (< 5%)',
    'suave': 'Suave (5–10%)',
    'moderada': 'Moderada (10–20%)',
    'pronunciada': 'Pronunciada (> 20%)',
  }
  const formaLabels: Record<string, string> = { regular: 'Regular', irregular: 'Irregular' }
  const vistaLabels: Record<string, string> = {
    ninguna: 'Sin vista especial', sierra: 'Sierra / montaña',
    valle: 'Valle', lago: 'Lago / presa', canon: 'Cañón',
  }
  const aguaLabels: Record<string, string> = {
    'red-municipal': 'Red municipal', pozo: 'Pozo', pipa: 'Pipa', 'sin-servicio': 'Sin servicio',
  }
  const drenajeLabels: Record<string, string> = {
    'red-municipal': 'Red municipal', 'fosa-septica': 'Fosa séptica', 'sin-servicio': 'Sin servicio',
  }
  const electricidadLabels: Record<string, string> = {
    'cfe-frente': 'CFE frente al predio', extension: 'Extensión requerida', 'sin-servicio': 'Sin servicio',
  }
  const distanciaLabels: Record<string, string> = {
    'menos-20': 'Menos de 20 km', '20-40': '20–40 km', 'mas-40': 'Más de 40 km',
  }
  const clasificacionVialLabels: Record<string, string> = {
    arterial:   'Arterial / Primaria — avenida principal o boulevard (factor +20% a +28%)',
    colectora:  'Colectora — conecta arteriales con calles locales (factor +10% a +15%)',
    secundaria: 'Secundaria — calle secundaria consolidada (factor +5% a +8%)',
    local:      'Local / Habitacional — calle interior de colonia (valor base, sin ajuste)',
    privada:    'Privada / Andador — acceso cerrado o sin salida (factor -5% a -10%)',
  }

  const prompt = `Eres el Agente Mastermind de SMT Developer, especialista en análisis de inversión inmobiliaria en México.

Con base en los siguientes datos del terreno, genera un análisis de inversión completo y profesional.

DATOS DEL TERRENO:
- Nombre del proyecto: ${data.nombreProyecto}
- Dirección: ${data.direccion}
- Colonia: ${data.colonia}
- Ciudad: ${data.ciudad}
- Código postal: ${data.codigoPostal || 'No proporcionado'}
- Superficie: ${data.superficie} m²
- Uso de suelo actual: ${usoSueloLabels[data.usoSuelo] || data.usoSuelo}
- Estado del terreno: ${estadoLabels[data.estadoTerreno] || data.estadoTerreno}
- Presupuesto del inversionista: ${presupuestoLabels[data.presupuesto] || data.presupuesto}
- Tipo(s) de desarrollo deseado: ${(data.tiposDesarrollo as string[]).map((t: string) => t === 'otro' ? (data.tipoOtroTexto || 'Otro') : (desarrolloLabels[t] || t)).join(', ')}
- Nivel de construcción elegido por el inversionista: ${bandaConstruccionLabels[data.bandaConstruccion] || 'No especificado — usar Banda 2 por defecto'}
${data.lat && data.lng ? `- Coordenadas: ${data.lat}, ${data.lng}` : ''}

DATOS ADICIONALES DEL PREDIO (proporcionados por el usuario — mejoran precisión):
- Frente: ${data.frente ? `${data.frente} m` : 'No proporcionado'}
- Pendiente: ${data.pendiente ? pendienteLabels[data.pendiente] : 'No proporcionada'}
- Forma del terreno: ${data.formaTerreno ? formaLabels[data.formaTerreno] : 'No proporcionada'}
- Vista destacada: ${data.vistaDestacada ? vistaLabels[data.vistaDestacada] : 'No proporcionada'}
- Clasificación vial de la calle frente al predio: ${data.clasificacionVial ? clasificacionVialLabels[data.clasificacionVial] : 'No proporcionada'}
- ¿Es esquina?: ${data.esEsquina === 'si' ? 'Sí' : data.esEsquina === 'no' ? 'No' : 'No proporcionado'}
- Agua: ${data.agua ? aguaLabels[data.agua] : 'No proporcionado'}
- Drenaje: ${data.drenaje ? drenajeLabels[data.drenaje] : 'No proporcionado'}
- Electricidad: ${data.electricidad ? electricidadLabels[data.electricidad] : 'No proporcionado'}
- Pavimento frente al predio: ${data.pavimento === 'si' ? 'Sí' : data.pavimento === 'no' ? 'No' : 'No proporcionado'}
- Distancia a ciudad de abasto: ${data.distanciaAbasto ? distanciaLabels[data.distanciaAbasto] : 'No proporcionada'}
- Precio solicitado por el terreno: ${data.precioSolicitado ? `$${Number(data.precioSolicitado).toLocaleString('es-MX')} MXN` : 'No proporcionado'}

INSTRUCCIÓN SOBRE DATOS ADICIONALES:
- Aplica los ajustes de valor de suelo SOLO para los campos que están proporcionados.
- Para los campos "No proporcionado", omite ese ajuste y regístralo como "ajuste no aplicado — dato faltante".
- Si hay precio solicitado, compáralo contra el valor calculado e indica si está por encima, dentro o por debajo del rango de mercado.
- FACTOR DE CLASIFICACIÓN VIAL (aplicar si fue proporcionado): La clasificación vial determina un ajuste directo sobre el precio base del terreno. Aplica el factor ANTES de otros ajustes secundarios y documéntalo en bitacoraTerreno.ajustes como concepto "Clasificación vial — [tipo de vía]". Rangos metodología INDAABIN/SHF:
  * Arterial/Primaria: +20% a +28% (usa el extremo superior solo si la vía tiene alto flujo vehicular, comercio formal y es un corredor reconocido; usa el inferior si el flujo es menor o la vía está en desarrollo)
  * Colectora: +10% a +15%
  * Secundaria: +5% a +8%
  * Local/Habitacional: 0% (es la referencia base — no aplica ajuste, pero documenta que se confirmó esta clasificación)
  * Privada/Andador: -5% a -10% (penaliza por acceso limitado y menor liquidez comercial)
  Si la clasificación vial NO fue proporcionada, el agente puede inferirla a partir de la dirección y señalarlo en bitacoraTerreno como "clasificación vial inferida — no confirmada por el usuario".
${data.pendiente === 'moderada' || data.pendiente === 'pronunciada' ? `- ⚠️ ALERTA PENDIENTE ACTIVADA: El terreno tiene pendiente ${pendienteLabels[data.pendiente || '']}. Cuantifica el sobrecosto de cimentación estimado ($800k–$1.2M según grado) y refléjalo en costoTotalConstruccion y bitacoraConstruccion.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA DE BANDAS DE VALOR DE TERRENO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de calcular CUALQUIER valor financiero, clasifica la colonia del proyecto en una de estas 4 bandas. Esta clasificación determina qué referencias de precio puedes usar — NUNCA mezcles bandas distintas.

BANDA 1 — Popular / Periférica
Perfil: Colonias populares o periféricas con urbanización incompleta o en desarrollo. Calles sin pavimentar o en mal estado, servicios básicos irregulares (agua intermitente, drenaje deficiente), sin equipamiento urbano de calidad, comercio informal predominante, transporte público básico o escaso, lotificaciones recientes sin consolidar, rezago social visible. Colonias trabajadoras de reciente creación o en proceso de regularización.
Plusvalía histórica: 0–2% anual.
NSE AMAI equivalente: D, D+, E.
Ejemplos reales Culiacán: Colonia Flores Magón, colonias periféricas de nueva creación al sur/norte de la ciudad, fraccionamientos de interés social recientes.
Ejemplos otras ciudades: colonias periféricas de interés social en expansión urbana reciente, polígonos SEDATU de atención prioritaria.

BANDA 2 — Media Popular / Consolidada
Perfil: Colonias de clase trabajadora con más de 15 años de consolidación. Urbanización completa (pavimento, alumbrado, drenaje funcional), servicios básicos estables, comercio de barrio establecido, transporte público funcional, escuelas públicas y centros de salud IMSS/ISSSTE cercanos. Imagen urbana modesta pero consolidada.
Plusvalía histórica: 3–5% anual.
NSE AMAI equivalente: C-, D+.
Ejemplos reales: colonias obreras consolidadas, fraccionamientos INFONAVIT de generaciones anteriores (15-25 años), colonias trabajadoras en municipios conurbados.

BANDA 3 — Media Residencial
Perfil: Colonias residenciales de clase media con infraestructura completa y bien mantenida. Calles pavimentadas con banquetas en buen estado, buena conectividad vial, comercio formal (plazas comerciales, supermercados de cadena), escuelas privadas, parques y áreas verdes, seguridad aceptable, acceso a corredores comerciales establecidos, imagen urbana cuidada.
Plusvalía histórica: 6–9% anual.
NSE AMAI equivalente: C, C+.
Ejemplos reales Culiacán: Colonia Guadalupe (sectores residenciales), Colonia Chapultepec, Las Quintas, fraccionamientos residenciales medios establecidos de 15+ años.
Ejemplos otras ciudades: Del Valle (CDMX), Colonia Obispado (Monterrey), Colonia Americana (Guadalajara), Colonia Reforma en ciudades medias.

BANDA 4 — Residencial Premium
Perfil: Colonias de alto valor con alta plusvalía histórica comprobable. Proximidad a servicios premium (centros comerciales de lujo, hospitales privados de primer nivel, colegios de élite, clubes deportivos), infraestructura de primera calidad, seguridad privada o fraccionamientos cerrados, baja densidad o desarrollo controlado, atributos diferenciales (vista, lago, campo de golf, corredor financiero). Ubicación con valor aspiracional reconocido en el mercado local.
Plusvalía histórica: 10%+ anual.
NSE AMAI equivalente: A, B.
Ejemplos reales Culiacán: Country Club, Tres Ríos, fraccionamientos cerrados premium al poniente.
Ejemplos otras ciudades: San Pedro Garza García (Monterrey), Valle Oriente (Monterrey), Polanco (CDMX), Lomas de Chapultepec (CDMX), Providencia (Guadalajara), Santa Fe (CDMX).

REGLA DE BANDA — OBLIGATORIA SIN EXCEPCIONES:
1. Clasifica la colonia del input en Banda 1, 2, 3 o 4 usando los criterios anteriores.
2. Para estimar costoTerrenoM2 usa ÚNICAMENTE transacciones y referencias de colonias de LA MISMA BANDA en la misma ciudad o ciudades de tamaño y mercado comparable.
3. Si no hay suficientes referencias en la misma banda, expande a ciudades similares del mismo estado — NUNCA subas de banda para compensar falta de datos.
4. Documenta la banda asignada y las referencias usadas en bitacoraTerreno.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA DE BANDAS DE COSTO DE CONSTRUCCIÓN
Fuente de referencia: CMIC/CEICO — Índice de Costos de Construcción Residencial por Ciudad 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
El inversionista ya eligió la banda. Usa EXACTAMENTE esa banda para calcular construccionM2 y costoTotalConstruccion. No la ignores ni la sustituyas.

BANDA 1 — Económica / Interés Social
Estructura: Muros de tabique o block, losa de vigueta y bovedilla, cimentación corrida o losa de cimentación simple.
Acabados: Yeso en muros, pintura vinílica, piso de cerámica económica, carpintería metálica básica, muebles de baño y cocina de línea estándar.
Instalaciones: Hidráulica y sanitaria básica, eléctrica sin automatización (110V), sin aire acondicionado.
Equipamiento: Sin elevador, sin amenidades, estacionamiento en superficie sin cubierta.
Referencia CMIC 2025 costo directo: $7,000–$10,500/m² (varía por ciudad — ajusta a la ciudad del proyecto).
Ciudades con costo en límite inferior: Culiacán, Hermosillo, Torreón, Mérida (mano de obra más económica).
Ciudades con costo en límite superior: CDMX, Monterrey, Guadalajara, Los Cabos (insumos y mano de obra más caros).

BANDA 2 — Media Estándar
Estructura: Concreto armado convencional (columnas, trabes, losa maciza o vigueta), diseño sencillo, fachada de aplanado o recubrimiento simple.
Acabados: Porcelanato nacional básico, carpintería de aluminio, muebles de cocina y baño de línea media, pintura de alta resistencia.
Instalaciones: Hidráulica con hidroneumático, eléctrica con tablero y cableado estructurado básico, gas natural o LP, sin A/C central.
Equipamiento: Elevador en edificios de 4+ niveles, lobby básico funcional, estacionamiento techado.
Referencia CMIC 2025 costo directo: $10,500–$16,000/m².

BANDA 3 — Media Alta / Residencial
Estructura: Concreto armado con diseño arquitectónico diferenciado, dobles alturas opcionales, terrazas privadas, fachada con elementos especiales (recubrimiento de piedra, aluminio compuesto, ventanal de piso a techo).
Acabados: Porcelanato importado o nacional premium, carpintería de madera o aluminio de alta línea, cocinas equipadas con muebles a medida, baños con cancel de vidrio templado y accesorios de diseño.
Instalaciones: Mini split por unidad, calentador de paso a gas, sistema contra incendios, CCTV, intercomunicador, pre-instalación domótica.
Equipamiento: Elevador de alta gama, amenidades (roof garden equipado, gimnasio, alberca, salón de usos múltiples).
Referencia CMIC 2025 costo directo: $16,000–$24,000/m².

BANDA 4 — Premium / Lujo
Estructura: Sistemas constructivos de alta tecnología, diseño arquitectónico de firma, fachada con materiales importados (vidrio estructural, aluminio anodizado, piedra natural, madera teca).
Acabados: Mármol o piedra natural en pisos y baños, carpintería de madera fina o lacada, cocinas europeas (Poggenpohl, Boffi, Molteni), baños con accesorios Grohe o Hansgrohe, closets a medida.
Instalaciones: Domótica completa (KNX/Crestron), A/C central VRF, generador de emergencia, cisterna con tratamiento, sistema de seguridad perimetral.
Equipamiento: Concierge 24h, spa, salón privado, cuarto de servicio por unidad, estacionamiento valet o mecanizado.
Referencia CMIC 2025 costo directo: $24,000–$45,000+/m².

REGLA DE BANDA DE CONSTRUCCIÓN — OBLIGATORIA:
1. El inversionista ya eligió la banda. Respétala. No uses una banda distinta aunque consideres que el mercado "pide" otra.
2. Usa el costo por m² del rango de la banda elegida ajustado a la ciudad del proyecto (ciudades del norte/frontera y turísticas tienden al límite superior; ciudades medias del interior al inferior).
3. En bitacoraConstruccion documenta la banda usada, el costo base por m², los ajustes por ciudad y tipología, y las fuentes CMIC.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BÚSQUEDA ACTIVA DE COMPARABLES DE TERRENO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Antes de calcular el valor del terreno, realiza una búsqueda activa de comparables en los portales inmobiliarios. Busca terrenos en venta en la misma zona usando el CP y la colonia del predio.

PORTALES A CONSULTAR (en orden de prioridad):
1. Lamudi México — terrenos en venta, filtrar por CP y colonia
2. Inmuebles24 — terrenos en venta, mismo filtro
3. Mercado Libre Inmuebles — sección terrenos
4. Propiedades.com — si los anteriores tienen menos de 3 resultados
5. Vivanuncios — como fuente de respaldo

CRITERIOS DE FILTRO:
- Tipo: terreno / lote en venta
- Ubicación: CP del predio + colonias adyacentes (radio ≤ 3 km)
- Superficie: ±30% de la superficie del predio analizado (si está disponible)
- Preferir publicaciones de los últimos 12 meses

Para cada comparable encontrado registrar: portal, superficie, precio total, precio/m², colonia, distancia estimada, fecha de publicación.
Si el radio primario tiene menos de 3 comparables, ampliar a radio secundario (3–5 km) y señalarlo.
Si no se encuentran comparables en ningún radio, usar estimación paramétrica por banda y señalarlo en el IC.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUENTES PARAMÉTRICAS DE COSTO DE CONSTRUCCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Para el costo de construcción, consulta y cruza TODAS las fuentes disponibles:

FUENTES PRIMARIAS:
1. CMIC — Índice de costos de construcción residencial vigente para el estado
2. Construdata México — costos paramétricos por tipo y nivel constructivo
3. CONASAMI — tabulador de salarios mínimos profesionales de construcción

FUENTES SECUNDARIAS:
4. CANADEVI delegación estatal — si tiene publicación de costos de referencia
5. INFONAVIT / SHF — tablas de valor de reposición nueva por m²

Para cada fuente, registrar: nombre, dato obtenido o "No disponible", fecha del dato.
Calcular la dispersión entre fuentes: (máximo - mínimo) / promedio × 100. Documentar en bitacoraConstruccion.fuentesConstruccion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÍNDICE DE CONFIABILIDAD (IC) — CALCULAR PARA TERRENO Y CONSTRUCCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Calcula el IC de 0 a 100 para CADA dato (terreno y construcción) sumando 4 componentes:

COMPONENTE A — Cobertura de fuentes (0–30 pts):
- 3+ fuentes con dato válido: 30 pts
- 2 fuentes: 20 pts
- 1 fuente: 10 pts
- Solo inferencia: 0 pts

COMPONENTE B — Proximidad geográfica (0–30 pts):
- Mismo fraccionamiento / CP exacto: 30 pts
- Colonia colindante / radio ≤ 3 km: 20 pts
- Radio ampliado 3–5 km: 10 pts
- Solo referencia de zona o inferencia: 0 pts
- Si superficie del predio no fue proporcionada: -5 pts adicionales

COMPONENTE C — Vigencia de los datos (0–20 pts):
- Datos ≤ 6 meses: 20 pts
- Datos 6–12 meses: 15 pts
- Datos 12–24 meses: 10 pts
- Datos > 24 meses: 5 pts

COMPONENTE D — Consistencia entre fuentes (0–20 pts):
- Dispersión < 10%: 20 pts
- Dispersión 10–20%: 12 pts
- Dispersión 20–30%: 6 pts
- Dispersión > 30%: 2 pts
- Una sola fuente: 8 pts (penalización muestra única)

IC TOTAL = A + B + C + D
Semáforo: 🟢 VERDE (75–100) · 🟡 AMARILLO (45–74) · 🔴 ROJO (0–44)

Incluir el IC en bitacoraTerreno.indiceConfiabilidad y bitacoraConstruccion.indiceConfiabilidad.

Genera el análisis en formato JSON con esta estructura exacta (sin texto adicional antes o después del JSON):

{
  "recomendacion": {
    "tipologia": "Tipología recomendada corta (ej: Residencial Vertical · 48 departamentos)",
    "descripcion": "Párrafo de 2-3 oraciones explicando por qué esta tipología es la óptima, incluyendo normativa, demanda y métricas clave"
  },
  "fichaLegal": {
    "usoSueloActual": "Uso de suelo actual del predio (ej: Baldío / Habitacional unifamiliar)",
    "usoSueloPermitido": "Uso de suelo permitido según PDU vigente (ej: Habitacional Plurifamiliar)",
    "compatible": true,
    "densidadAutorizada": "Densidad máxima permitida (ej: 150 hab/ha · 48 unidades máx)",
    "cos": "COS permitido en % (ej: 60%)",
    "cus": "CUS (ej: 2.4)",
    "altura": "Altura máxima en niveles (ej: 12 niveles)",
    "cajones": "Cajones requeridos (ej: 1.2 por unidad)",
    "retiros": "Retiros reglamentarios (ej: Frente 3 m · Laterales 2 m · Fondo 3 m)",
    "municipio": "Municipio exacto",
    "restriccion": "La restricción urbana más importante del predio",
    "factibilidades": {
      "agua": { "status": "Disponible", "nota": "Red municipal frente al predio — SADM / organismo local" },
      "drenaje": { "status": "Disponible", "nota": "Drenaje sanitario y pluvial disponibles en la vialidad" },
      "cfe": { "status": "Disponible", "nota": "Subestación a X m — potencia suficiente para el programa" }
    },
    "regimenCondominio": "Descripción del régimen de condominio recomendado y su estado (ej: Condominio vertical · Escrituración individual por unidad · Requiere constitución ante notario previo a preventa)",
    "restriccionesAmbientales": "Restricciones por barrancas, pendiente, zonas de riesgo SEDESOL/INEGI, ANP o servidumbres ambientales aplicables al predio",
    "nivelRiesgo": "Bajo",
    "alertasLegales": [
      {
        "tipo": "Tipo de alerta (ej: Restricción ambiental)",
        "descripcion": "Descripción concreta del riesgo legal o normativo",
        "impacto": "Impacto en el proyecto: CUS, costos, plazos, viabilidad",
        "status": "amber"
      }
    ]
  },
  "financiero": {
    "costoTerreno": 8500000,
    "costoTerrenoM2": 7083,
    "construccionM2": 16500,
    "costoTotalConstruccion": 23760000,
    "indirectos": 3240000,
    "honorarios": 1800000,
    "imprevistos": 1188000,
    "inversionTotal": 45200000,
    "precioVentaM2": 38500,
    "ingresosProyectados": 66780000,
    "utilidadBruta": 21580000,
    "margenBruto": 47.7,
    "tir": 22.4
  },
  "estructuraCapital": {
    "equity": 40,
    "deuda": 60,
    "montoEquity": 18080000,
    "montoDeuda": 27120000,
    "tipoDeuda": "Crédito puente bancario",
    "tasaDeuda": "TIIE + 3.5% anual (aprox. 14.5%)",
    "costoFinanciero": 2800000,
    "preventa": {
      "unidadesMinimas": 14,
      "porcentajeMinimo": "30%",
      "montoMinimo": 16170000,
      "condicion": "30% de unidades vendidas en preventa para apertura de crédito puente bancario"
    },
    "tasaDescuento": "Nominal · Antes de ISR",
    "isrEstimado": 3870000,
    "utilidadNeta": 17710000,
    "descripcion": "El proyecto se estructura con 40% capital propio y 60% crédito puente. La TIR del 22.4% es nominal antes de ISR. Impuesto estimado sobre utilidad: 30% ISR de persona moral."
  },
  "flujoMensual": [
    { "mes": 1, "fase": "Adquisición", "egresos": 8500000, "ingresos": 0, "acumulado": -8500000, "nota": "Escrituración y pago del terreno" },
    { "mes": 2, "fase": "Permisos", "egresos": 1200000, "ingresos": 0, "acumulado": -9700000, "nota": "Gestión licencias, proyecto ejecutivo, estudio de suelo" },
    { "mes": 3, "fase": "Preventa", "egresos": 800000, "ingresos": 5390000, "acumulado": -5110000, "nota": "Apertura preventa — 14 unidades mínimas para crédito puente" },
    { "mes": 4, "fase": "Apertura crédito", "egresos": 0, "ingresos": 27120000, "acumulado": 22010000, "nota": "Dispersión crédito puente — preventa mínima cumplida" },
    { "mes": 6, "fase": "Inicio obra", "egresos": 7920000, "ingresos": 3465000, "acumulado": 17555000, "nota": "Arranque de construcción — ventas en obra continúan" },
    { "mes": 10, "fase": "Construcción avanzada", "egresos": 6930000, "ingresos": 6930000, "acumulado": 17555000, "nota": "50% de avance — absorción en ritmo de crucero" },
    { "mes": 14, "fase": "Construcción finaliza", "egresos": 4950000, "ingresos": 5390000, "acumulado": 17995000, "nota": "Entrega de permisos de habitabilidad" },
    { "mes": 16, "fase": "Entrega unidades", "egresos": 1500000, "ingresos": 13475000, "acumulado": 29970000, "nota": "Escrituración y liquidación — pago crédito puente" },
    { "mes": 18, "fase": "Cierre", "egresos": 27120000, "ingresos": 5390000, "acumulado": 8240000, "nota": "Liquidación crédito puente + últimas escrituraciones" }
  ],
  "mercado": {
    "demanda": "Alta",
    "zona": "Nombre de la zona de mercado",
    "absorcion": "8 unidades/mes",
    "proyectosActivos": "4 proyectos en radio 500 m",
    "precioPromedioZona": "$9,200/m²",
    "perfilNSE": "A/B · 28–45 años",
    "plusvalia": "+18%",
    "inventario": "14 meses",
    "productoRecomendado": "Descripción del producto ideal (tipología y dimensiones)",
    "comparables": [
      {
        "nombre": "Nombre real del proyecto comparable",
        "direccion": "Dirección aproximada real en la misma zona",
        "fechaReferencia": "Q1 2024",
        "precioM2": 38500,
        "avanceObra": "Entregado | En obra | Preventa",
        "unidades": 24,
        "tipologia": "2 rec · 85 m²"
      },
      {
        "nombre": "Segundo comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q3 2023",
        "precioM2": 36000,
        "avanceObra": "En obra",
        "unidades": 18,
        "tipologia": "3 rec · 110 m²"
      },
      {
        "nombre": "Tercer comparable real",
        "direccion": "Dirección aproximada real",
        "fechaReferencia": "Q2 2024",
        "precioM2": 41000,
        "avanceObra": "Preventa",
        "unidades": 32,
        "tipologia": "2 rec · 80 m²"
      }
    ],
    "ofertaActiva": {
      "proyectosEnPreventa": 3,
      "proyectosEnObra": 2,
      "proyectosEntregados24m": 4,
      "unidadesDisponibles": 87,
      "rangoPrecios": "$32,000–$42,000/m²",
      "saturacion": "Descripción del nivel de saturación del corredor y tendencia"
    },
    "segmentacion": [
      {
        "tipo": "2 recámaras · 75–90 m²",
        "absorcionMensual": "5 unidades/mes",
        "precioM2": 39500,
        "participacion": "55%",
        "perfilComprador": "Perfil del comprador típico de este segmento"
      },
      {
        "tipo": "3 recámaras · 100–130 m²",
        "absorcionMensual": "3 unidades/mes",
        "precioM2": 41000,
        "participacion": "35%",
        "perfilComprador": "Perfil del comprador típico de este segmento"
      },
      {
        "tipo": "1 recámara / studio · 45–65 m²",
        "absorcionMensual": "1 unidad/mes",
        "precioM2": 43000,
        "participacion": "10%",
        "perfilComprador": "Inversionistas, renta"
      }
    ],
    "pricingFases": [
      {
        "fase": "Preventa",
        "precioM2": 35000,
        "descuento": "8%",
        "meta": "30% de unidades — activa crédito puente"
      },
      {
        "fase": "Construcción",
        "precioM2": 37500,
        "descuento": "3%",
        "meta": "50% de unidades"
      },
      {
        "fase": "Entrega",
        "precioM2": 38500,
        "descuento": "0%",
        "meta": "20% restante — precio lista"
      }
    ]
  },
  "score": {
    "total": 78,
    "solidezFinanciera": 82,
    "riesgoRegulatorio": 75,
    "exposicionMercado": 71
  },
  "metodologiaScore": {
    "descripcion": "El Score de Resiliencia es un índice compuesto de 0–100 que pondera tres dimensiones de riesgo del proyecto inmobiliario. Evalúa la capacidad del proyecto de mantener viabilidad ante desviaciones adversas en costos, mercado y entorno regulatorio.",
    "dimensiones": [
      {
        "nombre": "Solidez Financiera",
        "peso": "40%",
        "score": 82,
        "factores": [
          { "factor": "TIR vs benchmark sector (18% mínimo)", "contribucion": "Describe si supera o está por debajo del umbral y en cuánto" },
          { "factor": "Margen bruto sobre inversión vs promedio sectorial (30%)", "contribucion": "Describe la diferencia con el promedio" },
          { "factor": "Cobertura de servicio de deuda (relación equity/deuda)", "contribucion": "Describe si la estructura es conservadora, estándar o agresiva" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando el score de esta dimensión para este proyecto específico"
      },
      {
        "nombre": "Riesgo Regulatorio",
        "peso": "35%",
        "score": 75,
        "factores": [
          { "factor": "Compatibilidad uso de suelo actual vs permitido", "contribucion": "Describe el impacto de la compatibilidad o incompatibilidad" },
          { "factor": "Alertas legales y restricciones ambientales", "contribucion": "Describe el nivel de riesgo acumulado de las alertas" },
          { "factor": "Complejidad del municipio y tiempos de permiso estimados", "contribucion": "Describe si el municipio es ágil o complejo para permisos" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando el score regulatorio para este municipio y predio"
      },
      {
        "nombre": "Exposición de Mercado",
        "peso": "25%",
        "score": 71,
        "factores": [
          { "factor": "Velocidad de absorción vs inventario disponible", "contribucion": "Describe si la absorción cubre el inventario en tiempo razonable" },
          { "factor": "Nivel de competencia activa en el corredor", "contribucion": "Describe si hay saturación o espacio para el proyecto" },
          { "factor": "Plusvalía de la zona y tendencia de demanda NSE objetivo", "contribucion": "Describe la solidez de la demanda subyacente" }
        ],
        "interpretacion": "Párrafo de 1-2 oraciones interpretando la exposición de mercado para este proyecto"
      }
    ]
  },
  "stressTest": [
    {
      "titulo": "Shock de Costos +15%",
      "escenario": "Descripción del escenario de shock de costos con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Freno de Ventas −50%",
      "escenario": "Descripción del escenario de freno de ventas con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Plazo: N → M meses · Conclusión",
      "status": "amber"
    },
    {
      "titulo": "Ajuste de Mercado −10% en Precio",
      "escenario": "Descripción del escenario de caída de precio con cifras específicas",
      "impacto": "TIR baja de X% → Y% · Margen: A% → B% · Conclusión",
      "status": "red"
    }
  ],
  "puntoQuiebre": {
    "desviacionMaxCostos": "+28.4%",
    "absorcionMinViable": "38%",
    "precioVentaMinimo": "$29,800/m²",
    "resumen": "El proyecto mantiene viabilidad en el X% de los escenarios simulados. La principal vulnerabilidad es..."
  },
  "fuentes": {
    "legal": [
      { "nombre": "Reglamento de Construcción de [municipio exacto]", "tipo": "Normativa municipal" },
      { "nombre": "Plan de Desarrollo Urbano Municipal [año]", "tipo": "Planeación urbana" },
      { "nombre": "Nombre de ley estatal o federal aplicable", "tipo": "Ley estatal / Ley federal / DOF" },
      { "nombre": "...", "tipo": "..." }
    ],
    "mercado": [
      { "nombre": "BBVA Situación Inmobiliaria México [trimestre/año]", "tipo": "Reporte sectorial" },
      { "nombre": "Nombre de fuente INEGI, CANADEVI, SHF u otra", "tipo": "Estadística oficial / Organismo" },
      { "nombre": "...", "tipo": "..." }
    ]
  },
  "bitacoraTerreno": {
    "metodologia": "Nombre del método de valuación usado (ej: Comparación de mercado / Método residual)",
    "bandaTerreno": 2,
    "nombreBanda": "Nombre de la banda asignada (ej: Media Popular / Consolidada)",
    "justificacionBanda": "2-3 oraciones explicando por qué esta colonia fue clasificada en esa banda: qué características urbanas observadas la ubican ahí y no en la banda superior o inferior",
    "nseReferencias": "Confirmación explícita de que TODAS las referencias de precio usadas son de colonias de la misma banda en la misma ciudad. Ej: 'Referencias restringidas a colonias Banda 2 (Media Popular) de Culiacán: [colonia A], [colonia B]'",
    "precioM2Referencia": 7500,
    "fuenteReferencia": "Nombre de la fuente o base de datos de referencia usada (ej: SEDUVI, BBVA, transacciones Inmuebles24, SHF)",
    "ajustes": [
      {
        "concepto": "Nombre del factor de ajuste (ej: Estado del terreno — baldío sin escombro)",
        "descripcion": "Breve explicación de por qué aplica este ajuste al predio específico",
        "factorAjuste": "-5%",
        "impactoM2": -375
      },
      {
        "concepto": "Segundo factor de ajuste (ej: Frente a vialidad primaria)",
        "descripcion": "Explicación del impacto en valor",
        "factorAjuste": "+8%",
        "impactoM2": 600
      },
      {
        "concepto": "Tercer factor (ej: Uso de suelo compatible — sin cambio requerido)",
        "descripcion": "Explicación del impacto",
        "factorAjuste": "+3%",
        "impactoM2": 225
      }
    ],
    "precioM2Final": 7083,
    "superficieM2": 1200,
    "costoTotalTerreno": 8500000,
    "formula": "Superficie (m²) × Precio final/m² = Costo del terreno",
    "razonamiento": "Párrafo de 3-5 oraciones explicando el razonamiento completo: qué datos de zona se usaron, qué comparables soportan el precio base, cómo se aplicaron los ajustes y por qué el precio final es representativo del mercado actual para este predio específico",
    "supuestos": [
      "Supuesto clave 1 (ej: Precio basado en transacciones del corredor en los últimos 18 meses)",
      "Supuesto clave 2 (ej: No incluye impuestos de adquisición — ISAI estimado 2% adicional)",
      "Supuesto clave 3 (ej: Precio refleja condición actual del terreno sin mejoras)"
    ],
    "rangoValoracion": {
      "minimo": 6500,
      "maximo": 8200,
      "interpretacion": "Rango probable de negociación: precio mínimo (condición actual sin urgencia) y máximo (con mejoras o comprador estratégico)"
    },
    "fuentesComparables": [
      {
        "portal": "Lamudi",
        "superficie": 350,
        "precioTotal": 875000,
        "precioM2": 2500,
        "colonia": "nombre de la colonia del comparable",
        "distanciaKm": 1.2,
        "fechaPublicacion": "Mayo 2026",
        "valido": true
      }
    ],
    "indiceConfiabilidad": {
      "score": 65,
      "semaforo": "AMARILLO",
      "componenteA": 20,
      "componenteB": 20,
      "componenteC": 15,
      "componenteD": 10,
      "interpretacion": "Descripción de 1-2 oraciones sobre el nivel de confiabilidad del valor de terreno calculado y qué dato faltante tendría mayor impacto en mejorarlo",
      "accionRecomendada": "Solo si IC < 75: acción concreta para mejorar la confiabilidad antes del cierre"
    },
    "validacionPrecioSolicitado": {
      "aplica": false,
      "precioSolicitado": 0,
      "precioCalculado": 0,
      "diferenciaPorcentaje": 0,
      "semaforo": "VERDE",
      "interpretacion": "Si aplica: si está por encima, dentro o por debajo del rango de mercado y en qué porcentaje"
    }
  }
}

  "bitacoraConstruccion": {
    "bandaElegida": 2,
    "nombreBanda": "Nombre de la banda (ej: Media Estándar)",
    "descripcionBanda": "Resumen de 1-2 oraciones de qué incluye esta banda en términos de estructura, acabados y equipamiento",
    "costoPorM2Base": 13000,
    "ciudadAjuste": "Descripción del ajuste por ciudad: si está en límite superior o inferior del rango y por qué (mano de obra, insumos locales)",
    "tipologiaAjuste": "Descripción del ajuste por tipología: ej. edificio vertical vs horizontal, número de niveles, eficiencia estructural",
    "ajustes": [
      {
        "concepto": "Ajuste por ciudad (ej: Culiacán — ciudad media del norte, mano de obra moderada)",
        "descripcion": "Explicación del factor ciudad sobre el costo base CMIC nacional",
        "factorAjuste": "-3%",
        "impactoM2": -390
      },
      {
        "concepto": "Ajuste por tipología (ej: Edificio vertical 8 niveles — eficiencia estructural alta)",
        "descripcion": "Explicación de cómo la tipología afecta el costo por m²",
        "factorAjuste": "+5%",
        "impactoM2": 650
      }
    ],
    "costoPorM2Final": 13260,
    "superficieConstruccionM2": 1440,
    "costoTotalConstruccion": 19094400,
    "formula": "Superficie construible (m²) × Costo final/m² = Costo total construcción",
    "fuenteReferencia": "CMIC/CEICO — Índice de Costos de Construcción Residencial por Ciudad, [mes/año]",
    "razonamiento": "Párrafo de 3-5 oraciones explicando: cómo se determinó la superficie construible a partir del terreno y normativa (COS/CUS), qué ajustes se aplicaron sobre el costo CMIC base y por qué, y cómo el costo final se compara con el mercado local para esta tipología y banda",
    "supuestos": [
      "Supuesto 1 (ej: Costo directo — no incluye indirectos, honorarios ni imprevistos que se calculan por separado)",
      "Supuesto 2 (ej: Superficie construible calculada con CUS X sobre terreno de Y m²)",
      "Supuesto 3 (ej: Costo CMIC ajustado a condiciones de mercado local — revisión recomendada con contratista local)"
    ],
    "rangoReferencia": {
      "minimo": 11000,
      "maximo": 16000,
      "interpretacion": "Rango para esta banda en esta ciudad: límite inferior con concurso competitivo, límite superior con contratista especializado o condiciones de mercado ajustadas"
    },
    "fuentesConstruccion": [
      { "fuente": "CMIC", "dato": "13000", "fecha": "2025", "disponible": true },
      { "fuente": "Construdata México", "dato": "13500", "fecha": "2025", "disponible": true },
      { "fuente": "CONASAMI", "dato": "tabulador $380/jornal", "fecha": "2025", "disponible": true },
      { "fuente": "CANADEVI estatal", "dato": "No disponible", "fecha": "", "disponible": false },
      { "fuente": "INFONAVIT / SHF", "dato": "No disponible", "fecha": "", "disponible": false }
    ],
    "dispersionFuentes": "Porcentaje de dispersión entre fuentes disponibles (ej: 8.5%)",
    "indiceConfiabilidad": {
      "score": 55,
      "semaforo": "AMARILLO",
      "componenteA": 20,
      "componenteB": 15,
      "componenteC": 15,
      "componenteD": 8,
      "interpretacion": "Descripción de 1-2 oraciones sobre la confiabilidad del costo de construcción estimado",
      "accionRecomendada": "Solo si IC < 75: acción concreta (ej: verificar con contratista local antes del cierre)"
    },
    "desglosePorPartidas": [
      {
        "partida": "Preliminares y preparación del terreno",
        "porcentaje": 4,
        "costoPorM2": 530,
        "descripcion": "Limpieza, nivelación, trazo y replanteo. Instalaciones provisionales de obra (agua, luz, barda perimetral)."
      },
      {
        "partida": "Cimentación",
        "porcentaje": 10,
        "costoPorM2": 1326,
        "descripcion": "Tipo de cimentación según tipología y mecánica de suelos: zapatas aisladas, corridas o losa de cimentación. Incluye excavación y relleno."
      },
      {
        "partida": "Estructura / Obra negra",
        "porcentaje": 28,
        "costoPorM2": 3713,
        "descripcion": "Columnas, trabes, losas, muros de carga o sistema de marcos. Principal consumidor de cemento y acero."
      },
      {
        "partida": "Instalaciones",
        "porcentaje": 18,
        "costoPorM2": 2387,
        "descripcion": "Hidráulica (agua fría/caliente), sanitaria (drenaje), eléctrica (media tensión + distribución), gas natural o LP, voz y datos."
      },
      {
        "partida": "Acabados",
        "porcentaje": 24,
        "costoPorM2": 3182,
        "descripcion": "Pisos, azulejos, aplanados, pintura, plafones, yeso. El rubro con mayor variación entre bandas."
      },
      {
        "partida": "Carpintería, herrería y cancelería",
        "porcentaje": 8,
        "costoPorM2": 1061,
        "descripcion": "Puertas, ventanas, cancel de baño, closets, muebles de cocina y baño fijos."
      },
      {
        "partida": "Equipamiento especial",
        "porcentaje": 5,
        "costoPorM2": 663,
        "descripcion": "Elevador, sistema contra incendios, CCTV, intercomunicador, amenidades. Varía significativamente por banda y tipología."
      },
      {
        "partida": "Exteriores y urbanización",
        "porcentaje": 3,
        "costoPorM2": 398,
        "descripcion": "Estacionamiento, jardines, banquetas, accesos, alumbrado exterior, barda."
      }
    ],
    "materialesPrincipales": [
      {
        "material": "Cemento Portland CPC 30",
        "unidad": "ton",
        "cantidadPorM2": 0.38,
        "precioUnitario": 2900,
        "costoPorM2": 1102,
        "nota": "Consumo promedio en estructura + cimentación. Varía por diseño estructural y tipología."
      },
      {
        "material": "Acero / Varilla corrugada Grado 42",
        "unidad": "kg",
        "cantidadPorM2": 35,
        "precioUnitario": 22,
        "costoPorM2": 770,
        "nota": "Consumo en columnas, trabes y losas. Edificios verticales usan 30–60 kg/m² según altura."
      },
      {
        "material": "Block de concreto 15×20×40 cm",
        "unidad": "pza",
        "cantidadPorM2": 12,
        "precioUnitario": 18,
        "costoPorM2": 216,
        "nota": "Para muros divisorios y de fachada no estructurales. Si es sistema de marcos, varía."
      },
      {
        "material": "Grava y arena (concreto)",
        "unidad": "m³",
        "cantidadPorM2": 0.25,
        "precioUnitario": 480,
        "costoPorM2": 120,
        "nota": "Agregados para concreto hecho en obra o premezclado. Precio varía por distancia a banco."
      },
      {
        "material": "Mano de obra (costo promedio diario)",
        "unidad": "jornal/m²",
        "cantidadPorM2": 1.8,
        "precioUnitario": 320,
        "costoPorM2": 576,
        "nota": "Salario promedio ponderado por especialidad (oficial, ayudante, especialista). Fuente: tabulador CMIC 2025."
      },
      {
        "material": "Cable eléctrico (THW + calibres varios)",
        "unidad": "ml",
        "cantidadPorM2": 8,
        "precioUnitario": 28,
        "costoPorM2": 224,
        "nota": "Estimado para circuitos de iluminación, contactos y fuerza. Varía por densidad de circuitos."
      }
    ]
  }
}

REGLAS:
- Todos los valores financieros son números sin formato (sin $, sin comas)
- tir y margenBruto son números decimales (ej: 22.4, no "22.4%")
- Los scores son números enteros de 0 a 100
- status del stressTest: "green" (TIR > 18%), "amber" (TIR 12-18%), "red" (TIR < 12%)
- Ajusta TODOS los números según la superficie real del terreno y la ciudad indicada
- fuentes.legal: 4 documentos normativos reales y específicos del municipio/estado (reglamentos, planes, leyes, DOF) con año cuando aplique
- fuentes.mercado: 3 fuentes reales de análisis de mercado (BBVA, INEGI, CANADEVI, SHF, CONAVI u otras) con año cuando aplique
- En fuentes, usa nombres específicos reales — NO nombres genéricos con placeholders
- mercado.comparables: 3 proyectos reales o representativos de la zona con dirección aproximada real, fecha de referencia trimestral (Q1-Q4 + año), precio/m2 numérico sin formato, avanceObra debe ser exactamente "Entregado", "En obra" o "Preventa"
- mercado.ofertaActiva: datos coherentes con la zona y ciudad indicada — proyectosEnPreventa, proyectosEnObra y proyectosEntregados24m son números enteros; rangoPrecios en formato "$X,XXX–$X,XXX/m²"
- mercado.segmentacion: 2 o 3 segmentos según el mercado local — precioM2 es número sin formato; participacion suma 100%
- mercado.pricingFases: exactamente 3 fases (Preventa, Construcción, Entrega) — precioM2 es número sin formato, descuento en formato "X%"
- fichaLegal.compatible: true si el uso actual es compatible con el permitido, false si requiere cambio de uso
- fichaLegal.factibilidades: status debe ser exactamente "Disponible", "Con condicionante" o "No disponible"; nota con detalle del organismo y condición real
- fichaLegal.nivelRiesgo: "Bajo" (sin restricciones mayores), "Medio" (restricciones manejables) o "Alto" (restricciones críticas que pueden inviabilizar o encarecer significativamente)
- fichaLegal.alertasLegales: 1 a 3 alertas reales y específicas para el predio/municipio — status "green" (sin impacto), "amber" (manejable con gestión), "red" (crítico, puede inviabilizar)
- fichaLegal.restriccionesAmbientales: si no hay restricciones conocidas, indica "Sin restricciones ambientales identificadas para esta zona"
- estructuraCapital: montoEquity y montoDeuda son números (sin $); equity + deuda = 100; costoFinanciero, isrEstimado y utilidadNeta son números; tasaDeuda con formato "TIIE + X% anual (aprox. XX%)"
- estructuraCapital.preventa.unidadesMinimas es número entero; montoMinimo es número; porcentajeMinimo en formato "XX%"
- flujoMensual: exactamente 9 hitos clave del proyecto (no todos los meses) — egresos e ingresos son números sin formato; acumulado refleja el saldo neto real acumulado en ese mes; ajusta TODOS los montos a la superficie y mercado del terreno analizado
- metodologiaScore.dimensiones: exactamente 3 dimensiones (Solidez Financiera 40%, Riesgo Regulatorio 35%, Exposición de Mercado 25%); score de cada dimensión = el mismo valor del objeto score; factores: exactamente 3 por dimensión; contribucion debe ser específica para este proyecto (no genérica); interpretacion: 1-2 oraciones concretas
- CRITERIO NSE OBLIGATORIO: Para estimar costoTerreno y costoTerrenoM2, determina primero el NSE de la colonia del proyecto (A, B, C+, C, C-, D+, D) según la combinación colonia + ciudad. Usa EXCLUSIVAMENTE referencias de terrenos en colonias del mismo NSE o máximo 1 nivel adyacente. NUNCA promedies ni mezcles precios de colonias con NSE 2 o más niveles por encima — esto infla artificialmente el costo del terreno. Si la colonia es NSE C, usa solo referencias NSE C y C+. Si es NSE B, usa B y A-. Etc.
- bitacoraTerreno.bandaTerreno: número entero 1, 2, 3 o 4 según la clasificación de banda
- bitacoraTerreno.nombreBanda: nombre descriptivo de la banda asignada
- bitacoraTerreno.justificacionBanda: por qué esta colonia pertenece a esa banda y no a la adyacente
- bitacoraTerreno.nseReferencias: confirmación de que solo se usaron referencias de la misma banda
- bitacoraTerreno.precioM2Referencia, precioM2Final, impactoM2 son números sin formato
- bitacoraTerreno.superficieM2 debe coincidir con la superficie del terreno del input
- bitacoraTerreno.costoTotalTerreno debe coincidir exactamente con financiero.costoTerreno
- bitacoraTerreno.precioM2Final debe coincidir exactamente con financiero.costoTerrenoM2
- bitacoraTerreno.ajustes: 2 a 4 ajustes reales y específicos para este predio; factorAjuste en formato "+X%" o "-X%"
- bitacoraTerreno.rangoValoracion.minimo y .maximo son números enteros (precio/m²)
- bitacoraConstruccion.bandaElegida: número entero 1, 2, 3 o 4 — debe coincidir con la banda elegida por el inversionista en el input
- bitacoraConstruccion.costoPorM2Final debe coincidir exactamente con financiero.construccionM2
- bitacoraConstruccion.costoTotalConstruccion debe coincidir exactamente con financiero.costoTotalConstruccion
- bitacoraConstruccion.ajustes: 2 a 3 ajustes reales (ciudad, tipología, condiciones de mercado); factorAjuste en formato "+X%" o "-X%", impactoM2 es número
- bitacoraConstruccion.rangoReferencia.minimo y .maximo son números enteros (precio/m² directo)
- bitacoraConstruccion.desglosePorPartidas: exactamente 8 partidas en el orden indicado; porcentaje suma exactamente 100; costoPorM2 de cada partida = round(costoPorM2Final × porcentaje / 100); ajusta porcentajes por banda (banda 4: más acabados+equipamiento; banda 1: más estructura, menos equipamiento); descripcion específica para tipología y banda
- bitacoraConstruccion.materialesPrincipales: exactamente 6 materiales clave; cantidadPorM2 y precioUnitario son números; costoPorM2 = round(cantidadPorM2 × precioUnitario); ajusta cantidades y precios unitarios a la ciudad del proyecto y banda elegida; nota con observación técnica específica para este proyecto
- bitacoraTerreno.fuentesComparables: lista de comparables encontrados en portales (mínimo 1, máximo 5); si no se encontraron, lista vacía [] y refleja IC bajo
- bitacoraTerreno.indiceConfiabilidad.score es número entero 0–100; semaforo es "VERDE", "AMARILLO" o "ROJO"; componentes son números enteros; accionRecomendada es string vacío "" si IC >= 75
- bitacoraTerreno.validacionPrecioSolicitado.aplica es true SOLO si el usuario proporcionó precio solicitado; si aplica=false, los demás campos de ese objeto son 0 o ""
- bitacoraConstruccion.fuentesConstruccion: exactamente 5 registros en el orden indicado; disponible es boolean; dato es string (el valor o "No disponible")
- bitacoraConstruccion.dispersionFuentes: string con el porcentaje calculado solo entre fuentes disponibles (ej: "8.5%"); si solo hay 1 fuente disponible, escribir "Muestra única — dispersión no calculable"
- bitacoraConstruccion.indiceConfiabilidad: mismas reglas que bitacoraTerreno.indiceConfiabilidad
- Aplica los ajustes de valor de suelo (frente, pendiente, esquina, vista, servicios) SOLO para los datos que el usuario proporcionó. Si el dato es "No proporcionado", omite ese ajuste y documéntalo
- Si pendiente es moderada o pronunciada: agrega un ajuste de cimentación específico en bitacoraConstruccion.ajustes con el sobrecosto estimado ($800k–$1.2M según grado)
- Retorna ÚNICAMENTE el JSON, sin markdown, sin texto extra`

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 24000,
      messages: [{ role: 'user', content: prompt }],
    })

    const message = await stream.finalMessage()
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in /api/analizar:', error)
    return NextResponse.json({ error: 'Error al generar el análisis' }, { status: 500 })
  }
}
