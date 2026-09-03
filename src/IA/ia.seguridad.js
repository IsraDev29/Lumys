// ---------------------------------------------------------------------------
// Capa de seguridad determinista
//
// La detección de riesgo NO puede depender solo del modelo. Un modelo puede
// fallar, la API puede estar caída, la respuesta puede llegar mal formada o
// alguien puede intentar manipular el prompt desde el texto libre. Cualquiera
// de esas tres cosas, en una plataforma de salud mental con menores, significa
// una señal perdida.
//
// Por eso el nivel de riesgo final es siempre `max(léxico, modelo)`: el modelo
// puede SUBIR el nivel (detecta matices que un léxico no ve) pero nunca puede
// bajarlo. El error aceptable acá es el falso positivo — que un orientador
// revise un caso que no lo necesitaba — no el falso negativo.
//
// El léxico es de arranque, no de llegada: se afina con los casos reales que
// el orientador marque como mal clasificados.
// ---------------------------------------------------------------------------

const NIVELES = {
  ninguno: 0,
  malestar: 1,
  riesgo_posible: 2,
  riesgo_explicito: 3,
};

const NOMBRE_DE_NIVEL = ['ninguno', 'malestar', 'riesgo_posible', 'riesgo_explicito'];

// Español de Nicaragua, sin tildes (el texto se normaliza antes de comparar) y
// con las variantes de escritura de chat que efectivamente aparecen.
const PATRONES = [
  // --- Riesgo explícito ---------------------------------------------------
  { nivel: 3, re: /\b(me\s+quiero|quiero|me\s+voy\s+a|voy\s+a)\s+(matar|morir|suicidar)/ },
  { nivel: 3, re: /\bsuicid(arme|io|arse|a)\b/ },
  { nivel: 3, re: /\bquitarme\s+la\s+vida\b/ },
  { nivel: 3, re: /\bno\s+quiero\s+(seguir\s+)?(vivir|viviendo|existir)\b/ },
  { nivel: 3, re: /\bhacerme\s+da(n|ñ)o\b/ },
  { nivel: 3, re: /\b(me\s+)?cort(o|arme|e)\b.{0,20}\b(brazo|brazos|mu(n|ñ)eca|piel)\b/ },
  { nivel: 3, re: /\bmejor\s+(estar(i|í)a\s+)?muerto\b/ },
  { nivel: 3, re: /\bacabar\s+con\s+todo\b/ },
  { nivel: 3, re: /\b(le\s+voy\s+a|voy\s+a)\s+hacer\s+da(n|ñ)o\s+a\b/ },

  // --- Riesgo posible -----------------------------------------------------
  { nivel: 2, re: /\bdesaparecer\b/ },
  { nivel: 2, re: /\bno\s+despertar\b/ },
  { nivel: 2, re: /\b(soy|ser(i|í)a|me\s+siento(\s+como)?)\s+(una\s+)?carga\b/ },
  { nivel: 2, re: /\bestar(i|í)an\s+mejor\s+sin\s+m(i|í)\b/ },
  { nivel: 2, re: /\bno\s+le\s+importo\s+a\s+nadie\b/ },
  { nivel: 2, re: /\bnada\s+(tiene\s+sentido|vale\s+la\s+pena)\b/ },
  { nivel: 2, re: /\bya\s+no\s+aguanto\b/ },
  { nivel: 2, re: /\bno\s+le\s+veo\s+salida\b/ },
  { nivel: 2, re: /\bme\s+(pegan|golpean)\b/ },
  { nivel: 2, re: /\bme\s+toc(o|a|aron)\b.{0,15}\b(sin\s+permiso|a\s+la\s+fuerza)\b/ },

  // --- Malestar -----------------------------------------------------------
  { nivel: 1, re: /\bno\s+puedo\s+m(a|á)s\b/ },
  { nivel: 1, re: /\bme\s+siento\s+(solo|sola|vac(i|í)o|vac(i|í)a)\b/ },
  { nivel: 1, re: /\bllor(o|e|ando)\b/ },
  { nivel: 1, re: /\bnadie\s+me\s+(entiende|escucha)\b/ },
  { nivel: 1, re: /\bodio\s+mi\s+vida\b/ },
];

// Frases que niegan lo que viene después. Solo neutralizan el nivel 1 y 2: si
// alguien escribe "no me quiero matar" queremos que un humano lo lea igual.
const NEGACIONES = /\b(nunca|jamas|ya\s+no|no\s+es\s+que|dej(e|é)\s+de)\s*$/;

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    // Quita los diacríticos que NFD acaba de separar: "morí" y "mori" son lo
    // mismo acá, y "daño" queda como "dano".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evalúa texto libre contra el léxico. Devuelve el nivel más alto encontrado y
 * qué patrones lo dispararon, para que el orientador vea por qué se activó.
 */
function evaluarTexto(texto) {
  const limpio = normalizar(texto);
  if (!limpio) return { nivel: 0, etiqueta: 'ninguno', coincidencias: [] };

  const coincidencias = [];
  let nivel = 0;

  for (const patron of PATRONES) {
    const match = limpio.match(patron.re);
    if (!match) continue;

    // Un nivel 3 se registra aunque venga negado: "ya no quiero morirme" habla
    // igual de algo que pasó y merece una conversación.
    if (patron.nivel < 3) {
      const antes = limpio.slice(Math.max(0, match.index - 20), match.index);
      if (NEGACIONES.test(antes)) continue;
    }

    coincidencias.push(match[0]);
    nivel = Math.max(nivel, patron.nivel);
  }

  return { nivel, etiqueta: NOMBRE_DE_NIVEL[nivel], coincidencias };
}

/**
 * Nivel final. El modelo suma sensibilidad; el léxico pone el piso.
 * Ninguna respuesta del modelo puede bajar lo que el léxico ya detectó.
 */
function combinar(etiquetaLexico, etiquetaModelo) {
  const nivel = Math.max(NIVELES[etiquetaLexico] ?? 0, NIVELES[etiquetaModelo] ?? 0);
  return { nivel, etiqueta: NOMBRE_DE_NIVEL[nivel] };
}

/**
 * A qué nivel de respuesta institucional corresponde. Coincide con
 * `SenalDetectada.nivelRespuesta`: 1 conversar, 2 acompañar, 3 derivar.
 */
function nivelDeRespuesta(nivelRiesgo) {
  if (nivelRiesgo >= 3) return 3;
  if (nivelRiesgo === 2) return 2;
  return 1;
}

/**
 * Mensaje de contención. Es texto fijo, no generado: en el único momento en que
 * de verdad importa lo que el estudiante lee, nadie quiere depender de que el
 * modelo esté teniendo un buen día.
 *
 * No incluye números de emergencia escritos a mano a propósito. Los contactos
 * salen del catálogo `ServicioExterno` de la base, que es el que la institución
 * mantiene: un teléfono equivocado es peor que ninguno.
 */
function mensajeDeContencion({ servicios = [], personaDeApoyo = null } = {}) {
  const partes = [
    'Gracias por escribir eso. No es poca cosa decirlo, y no lo voy a dejar pasar.',
    'No estás solo con esto y no hace falta que lo resuelvas hoy ni vos solo.',
  ];

  if (personaDeApoyo) {
    partes.push(`Si podés, buscá hoy a ${personaDeApoyo}. Que sepa cómo venís.`);
  }

  if (servicios.length) {
    partes.push(
      'Estos contactos están disponibles ahora:',
      ...servicios.map((s) => `· ${s.nombre}${s.telefono ? ` — ${s.telefono}` : ''}`),
    );
  }

  partes.push('Ya avisamos a tu orientador para que te busque. No es un castigo: es que te acompañen.');

  return partes.join('\n');
}

module.exports = {
  NIVELES,
  NOMBRE_DE_NIVEL,
  normalizar,
  evaluarTexto,
  combinar,
  nivelDeRespuesta,
  mensajeDeContencion,
};
