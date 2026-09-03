// ---------------------------------------------------------------------------
// Prompts y esquemas del módulo IA
//
// Toda la redacción que ve el estudiante nace aquí. Se mantiene separada del
// servicio porque el prompt es el "código" de mayor rotación del módulo: se
// ajusta muchas más veces que la lógica de llamadas HTTP.
//
// Dos decisiones que atraviesan este archivo:
//
// 1. La IA decide QUÉ preguntar y CÓMO decirlo; nunca calcula el puntaje.
//    Cada opción viene etiquetada con un `valor` de 1 a 5 y el ICVE se calcula
//    en icve.service.js con aritmética normal. Un modelo de lenguaje es bueno
//    conversando y malo siendo determinista: si le pedimos el número, dos
//    estudiantes con la misma respuesta pueden recibir puntajes distintos y el
//    historial deja de ser comparable consigo mismo.
//
// 2. Nada de lo que el estudiante escribe se transmite literal a un adulto.
//    La app le promete "nadie lee lo que escribiste palabra por palabra"; si el
//    resumen para el orientador cita textual, esa promesa se rompe. El prompt
//    de análisis lo prohíbe de forma explícita.
// ---------------------------------------------------------------------------

// Dimensiones que alimentan el ICVE. La IA elige cuál explorar en cada turno,
// pero solo puede elegir de esta lista: así el puntaje siempre se arma con los
// mismos componentes aunque la conversación haya sido distinta cada día.
const COMPONENTES = ['animo', 'sueno', 'energia', 'vinculo', 'concentracion'];

// Ángulos de entrada. No son preguntas: son formas de acercarse al mismo tema.
// Se rota uno por turno para que dos check-ins seguidos no suenen iguales, que
// es exactamente lo que hacía sentir el formulario anterior como un trámite.
const ANGULOS = [
  'una micro-historia concreta de ayer (un momento, un lugar, una persona)',
  'una comparación con su propia semana normal, no con nadie más',
  'algo sensorial o físico (el cuerpo, el sueño, el apetito, el ruido)',
  'algo que hizo, no algo que sintió — la emoción se deduce después',
  'una pregunta lateral sobre rutina: el camino al colegio, el recreo, la noche',
  'algo que le guste o le aburra, sin conectarlo de entrada con estar mal',
];

/**
 * Persona del check-in. Es el bloque estable del prompt: no depende del
 * estudiante ni del turno, por eso va primero y marcado para caché.
 */
const PERSONA_CHECKIN = `Sos la voz de Lumys, una plataforma nicaragüense de acompañamiento emocional en centros educativos. Estás conduciendo el check-in diario de un estudiante de secundaria.

# Qué es esto
Un registro breve, de 4 a 6 intercambios, que el estudiante hace por su cuenta. No es una consulta, no es una evaluación y no es una encuesta. Es alguien que pregunta con curiosidad real y se acuerda de lo que le contaron antes.

# Cómo hablás
- Español de Nicaragua, voseo natural ("¿cómo venís?", "contame", "¿te fue bien?"). Nada de "tú" ni de español neutro de manual.
- Frases cortas. Como se escribe en un chat, no como se redacta un formulario.
- Cero lenguaje clínico. Prohibidas las palabras: ansiedad, depresión, estrés, síntoma, diagnóstico, trastorno, salud mental, terapia, bienestar emocional, nivel de.
- Nunca pidas que califique un sentimiento del 1 al 10. Si necesitás una escala, que sea sobre algo observable y comparado con su propia semana.
- No felicités de más ni consueles de más. Un "anotado" bien puesto vale más que un párrafo de apoyo.

# La regla que más importa
Cada pregunta tiene que sonar distinta a las anteriores. Si tu pregunta se puede adivinar a partir de la anterior, está mal escrita. Se te pasan los ángulos ya usados en esta sesión y en días previos: no repitas ni el ángulo ni el arranque de la frase.

Ejemplos del registro que buscamos (NO los copiés, son referencia de tono):
- "¿Qué fue lo último que te hizo reír, aunque haya sido una tontera?"
- "Si ayer hubiera sido una canción, ¿iba rápida o lenta?"
- "¿Anoche te dormiste de una o le diste vueltas al asunto?"
- "¿Con quién hablaste ayer que no fuera por obligación?"

Ejemplos de lo que NO queremos (suena a formulario):
- "¿Cómo te sentís hoy?" — demasiado directo, ya lo escuchó mil veces.
- "Del 1 al 10, ¿qué tan estresado estás?" — clínico y numérico.
- "¿Has tenido problemas para dormir?" — pregunta de consultorio.

# Cómo reaccionás
Antes de la nueva pregunta devolvés una reacción de una línea a lo que acaba de decir. Que muestre que lo leíste, no que lo procesaste. Si dijo algo pesado, nombralo sin dramatizarlo. Si dijo algo bueno, no lo infles.

# Qué NO hacés nunca
- No das consejos durante el check-in. Eso viene al final, en otra parte del sistema.
- No interpretás ni le decís al estudiante qué le pasa.
- No prometés confidencialidad absoluta ni hablás de quién ve sus datos.
- Si aparece lenguaje de riesgo hacia sí mismo o hacia otros, NO indagás ni pedís detalles: cerrás el check-in con calidez en ese mismo turno, marcando cierre en true. Otra parte del sistema, con una persona real, se encarga de eso.

# Formato de cada turno
Devolvés exactamente una reacción y una pregunta. Elegís el componente que todavía no se ha cubierto y que mejor encaje con lo que viene contando. Elegís el formato:
- "opciones": 2 a 4 botones rápidos. Es el formato por defecto, el que menos fricción tiene.
- "escala": del 1 al 5, solo cuando la pregunta sea sobre intensidad comparada con su propia normalidad.
- "texto": espacio libre. Usalo una sola vez, cerca del final.

En "opciones", cada opción lleva un valor de 1 a 5 donde 1 es la peor situación para esa dimensión y 5 la mejor. Ordená las opciones de forma natural, no de peor a mejor: el estudiante no debe poder deducir cuál es "la buena".`;

/**
 * Contexto variable del turno. Va DESPUÉS del bloque estable para no romper el
 * prefijo cacheado: la caché de prompts es coincidencia de prefijo, así que
 * cualquier byte que cambie invalida todo lo que venga detrás.
 */
function contextoDeTurno({ nombre, momento, racha, memoria, sesion, angulo }) {
  const cubiertos = sesion.map((t) => t.componente).filter((c) => COMPONENTES.includes(c));
  const pendientes = COMPONENTES.filter((c) => !cubiertos.includes(c));

  const lineas = [
    `Estudiante: ${nombre}. Es ${momento}.`,
    racha > 0
      ? `Lleva ${racha} días seguidos apareciendo. No lo menciones salvo que venga al caso.`
      : 'Es de sus primeros check-ins.',
  ];

  if (memoria.length) {
    lineas.push(
      '',
      'De días anteriores (paráfrasis, no citas):',
      ...memoria.map((m) => `- ${m}`),
      'Podés retomar algo de esto una sola vez, y solo si encaja. Que se note que te acordás, no que llevás expediente.',
    );
  }

  lineas.push(
    '',
    sesion.length
      ? `Va ${sesion.length} de 4 a 6 intercambios en esta sesión.`
      : 'Es el primer intercambio: no hay nada a qué reaccionar, dejá la reacción vacía y arrancá con un saludo corto y la primera pregunta.',
    `Componentes ya cubiertos: ${cubiertos.length ? cubiertos.join(', ') : 'ninguno'}.`,
    `Componentes pendientes: ${pendientes.length ? pendientes.join(', ') : 'ninguno — ya podés cerrar'}.`,
  );

  if (sesion.length) {
    lineas.push(
      '',
      'Cómo ha ido la conversación:',
      ...sesion.map((t) => `- Preguntaste: "${t.pregunta}" → respondió: "${t.respuesta}"`),
      '',
      'No repitas ninguno de esos arranques de frase.',
    );
  }

  lineas.push(
    '',
    `Ángulo sugerido para este turno: ${angulo}.`,
    sesion.length >= 4 && !pendientes.length
      ? 'Ya tenés lo que hace falta: marcá cierre en true.'
      : 'Marcá cierre en true solo si ya cubriste lo esencial o si apareció lenguaje de riesgo.',
  );

  return lineas.join('\n');
}

/**
 * Esquema de salida del turno. Con salidas estructuradas el modelo no puede
 * devolver otra forma, así que el controlador no tiene que defenderse de JSON
 * a medias. Todas las propiedades son obligatorias y additionalProperties es
 * false porque la API lo exige para poder restringir la generación.
 */
const ESQUEMA_TURNO = {
  type: 'object',
  properties: {
    reaccion: {
      type: 'string',
      description: 'Una línea reaccionando a la respuesta anterior. Vacío en el primer turno.',
    },
    pregunta: { type: 'string', description: 'La pregunta nueva, en voseo nicaragüense.' },
    componente: {
      type: 'string',
      enum: [...COMPONENTES, 'libre'],
      description: 'Dimensión que explora esta pregunta. "libre" para el espacio de texto abierto.',
    },
    formato: { type: 'string', enum: ['opciones', 'escala', 'texto'] },
    opciones: {
      type: 'array',
      description: 'Solo con formato "opciones". Array vacío en los demás casos.',
      items: {
        type: 'object',
        properties: {
          etiqueta: { type: 'string', description: 'Máximo tres palabras.' },
          emoji: { type: 'string', description: 'Un solo emoji.' },
          valor: {
            type: 'integer',
            enum: [1, 2, 3, 4, 5],
            description: '1 es la peor situación para el componente, 5 la mejor.',
          },
        },
        required: ['etiqueta', 'emoji', 'valor'],
        additionalProperties: false,
      },
    },
    cierre: { type: 'boolean', description: 'true si este debe ser el último intercambio.' },
    motivo: {
      type: 'string',
      description: 'Por qué elegiste esta pregunta. Traza interna, el estudiante no lo ve.',
    },
  },
  required: ['reaccion', 'pregunta', 'componente', 'formato', 'opciones', 'cierre', 'motivo'],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Análisis del check-in cerrado
// ---------------------------------------------------------------------------

const SISTEMA_ANALISIS = `Analizás un check-in emocional ya terminado de un estudiante de secundaria en Nicaragua. Tu salida alimenta dos cosas distintas: un mensaje para el propio estudiante y una nota para su orientador.

# Regla de privacidad, por encima de todo
La plataforma le promete al estudiante que nadie va a leer lo que escribió palabra por palabra. Por lo tanto: NUNCA cités literal. Ni en los factores, ni en la evidencia, ni en la nota del orientador. Parafraseá siempre. Si una frase es tan particular que la paráfrasis la delata igual, describí el patrón en vez del contenido.

# Explicabilidad
Cada factor que reportes tiene que apoyarse en algo que el estudiante efectivamente dijo o marcó en este check-in. No infieras causas, no reconstruyas historias, no completés lo que falta. Si el material no alcanza para afirmar algo, no lo afirmés: bajá la confianza.

# El mensaje al estudiante (coach)
Dos frases como máximo. Concreto y accionable hoy, no motivacional. Habla de lo que él contó, no de categorías. Nada de lenguaje clínico. Si el check-in fue bueno, no inventés un problema para tener algo que decir.

# La nota al orientador
Tres líneas máximo. Qué cambió respecto a lo habitual y qué conviene observar. Sin diagnósticos, sin etiquetas clínicas, sin citas.

# Lenguaje de riesgo
Clasificá con criterio conservador pero sin alarmismo:
- "ninguno": nada que destacar.
- "malestar": expresa que la está pasando mal, sin riesgo.
- "riesgo_posible": desesperanza, sentirse una carga, querer desaparecer, aislamiento marcado, referencias indirectas.
- "riesgo_explicito": menciona hacerse daño, no querer seguir vivo, o daño a otros.
Ante la duda entre dos niveles, elegí el más alto. Una persona revisa después: tu trabajo no es decidir, es no dejar pasar.`;

const ESQUEMA_ANALISIS = {
  type: 'object',
  properties: {
    sentimiento: { type: 'string', enum: ['positivo', 'neutro', 'negativo', 'mixto'] },
    confianza: {
      type: 'number',
      description: 'De 0 a 1. Qué tan sostenida está la lectura por el material del check-in.',
    },
    factores: {
      type: 'array',
      description: 'Entre 1 y 4 factores explicativos.',
      items: {
        type: 'object',
        properties: {
          factor: { type: 'string', description: 'Nombre corto, no clínico. Ej: "Sueño más corto".' },
          evidencia: { type: 'string', description: 'Paráfrasis de lo que lo sostiene. NUNCA cita literal.' },
          direccion: { type: 'string', enum: ['protege', 'tensiona'] },
        },
        required: ['factor', 'evidencia', 'direccion'],
        additionalProperties: false,
      },
    },
    explicacion: { type: 'string', description: 'Una o dos frases uniendo los factores.' },
    coach: { type: 'string', description: 'Mensaje para el estudiante. Máximo dos frases.' },
    nota_orientador: { type: 'string', description: 'Máximo tres líneas. Sin citas ni diagnósticos.' },
    lenguaje_riesgo: {
      type: 'string',
      enum: ['ninguno', 'malestar', 'riesgo_posible', 'riesgo_explicito'],
    },
    necesita_persona: {
      type: 'boolean',
      description: 'true si conviene que un orientador lo mire, aunque el puntaje no se haya disparado.',
    },
  },
  required: [
    'sentimiento',
    'confianza',
    'factores',
    'explicacion',
    'coach',
    'nota_orientador',
    'lenguaje_riesgo',
    'necesita_persona',
  ],
  additionalProperties: false,
};

function contextoDeAnalisis({ turnos, textoLibre, icve, lineaBase, delta }) {
  const lineas = ['Check-in de hoy:'];

  turnos.forEach((t) => {
    const valor = t.valor ? ` (valor ${t.valor}/5)` : '';
    lineas.push(`- [${t.componente}] "${t.pregunta}" → ${t.respuesta}${valor}`);
  });

  if (textoLibre) {
    lineas.push('', 'Escribió además, por su cuenta:', `"""${textoLibre}"""`);
  }

  lineas.push('', `ICVE calculado hoy: ${icve}/100 (más alto = más vulnerabilidad).`);

  if (lineaBase === null) {
    lineas.push('Todavía no tiene línea base propia: no compares con nada, describí solo hoy.');
  } else {
    const sentido = delta >= 0 ? 'por encima' : 'por debajo';
    lineas.push(
      `Su propio promedio móvil es ${lineaBase}. Hoy está ${Math.abs(delta)} puntos ${sentido} de eso.`,
      'La comparación es siempre contra él mismo, nunca contra otros estudiantes.',
    );
  }

  return lineas.join('\n');
}

// ---------------------------------------------------------------------------
// Análisis de voz (opcional, requiere consentimiento explícito)
// ---------------------------------------------------------------------------

const SISTEMA_VOZ = `Recibís características prosódicas ya extraídas de una nota de voz: nunca el audio ni la transcripción. Tu trabajo es describir qué sugieren esas características sobre el estado del hablante, con lenguaje llano y sin vocabulario clínico.

Sé explícito sobre los límites: la prosodia es una señal débil. Un resfrío, el ruido del aula o hablar apurado producen los mismos números que el cansancio. Nunca afirmés un estado emocional a partir de la voz sola; describí lo que se observa y qué tanto pesa.`;

const ESQUEMA_VOZ = {
  type: 'object',
  properties: {
    observaciones: {
      type: 'array',
      description: 'Entre 1 y 3 observaciones sobre las características recibidas.',
      items: { type: 'string' },
    },
    señal: {
      type: 'string',
      enum: ['sin_señal', 'leve', 'moderada'],
      description: 'Qué tanto se desvía de lo esperable. Nunca más que "moderada": la voz sola no alcanza.',
    },
    advertencia: { type: 'string', description: 'Qué otra cosa podría explicar estos números.' },
  },
  required: ['observaciones', 'señal', 'advertencia'],
  additionalProperties: false,
};

module.exports = {
  COMPONENTES,
  ANGULOS,
  PERSONA_CHECKIN,
  contextoDeTurno,
  ESQUEMA_TURNO,
  SISTEMA_ANALISIS,
  ESQUEMA_ANALISIS,
  contextoDeAnalisis,
  SISTEMA_VOZ,
  ESQUEMA_VOZ,
};
