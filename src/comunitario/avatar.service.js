// ---------------------------------------------------------------------------
// Avatar y clima
//
// Traduce un ICVE (0-100, más alto = más vulnerabilidad) a la metáfora
// meteorológica que usa toda la interfaz. Es la única capa del sistema donde un
// número se convierte en algo que un adolescente lee sobre sí mismo, y por eso
// tiene reglas propias:
//
// - El titular es el clima, nunca el número. Un "78" invita a compararse con el
//   "60" de un compañero, y el ICVE solo significa algo contra el propio
//   historial. El clima no se presta a esa comparación.
//   (La serie del gemelo sí lleva los puntajes: los necesita el gráfico de la
//   Huella Emocional, donde lo que se lee es la forma de la curva. Lo que no
//   ocurre es presentarle un número suelto como veredicto del día.)
// - El lenguaje describe el día, no a la persona. "Día nublado", nunca
//   "estás mal". La diferencia importa cuando quien lee tiene quince años.
// - Ningún estado es un fracaso. La tormenta no dice "andás pésimo": dice que
//   hoy pesó, que quedó registrado y que alguien lo va a mirar.
// ---------------------------------------------------------------------------

// Los cortes son los mismos que usa icve.service para decidir señales, para que
// lo que el estudiante ve y lo que el orientador recibe no se contradigan.
const CLIMAS = [
  {
    id: 'despejado',
    hasta: 25,
    titulo: 'Día despejado',
    mensaje: 'Venís bien. No hace falta hacer nada con esto: solo queda registrado.',
    mascota: 'contenta',
  },
  {
    id: 'parcial',
    hasta: 50,
    titulo: 'Parcialmente nublado',
    mensaje: 'Un día normal, con sus altibajos. Así es la mayoría de los días.',
    mascota: 'tranquila',
  },
  {
    id: 'nublado',
    hasta: 75,
    titulo: 'Día nublado',
    mensaje: 'Se nota que viene pesando. Gracias por registrarlo igual.',
    mascota: 'atenta',
  },
  {
    id: 'tormenta',
    hasta: 100,
    titulo: 'Día de tormenta',
    mensaje: 'Hoy pesó. Que lo hayas escrito ya es algo, y no te toca resolverlo solo.',
    mascota: 'acompanando',
  },
];

// Estado para cuando no hay datos suficientes. No es un clima: es la ausencia
// de uno, y decirlo así evita que un estudiante nuevo vea "despejado" y crea
// que el sistema ya sabe algo sobre él.
const SIN_DATOS = {
  id: 'sin_datos',
  titulo: 'Todavía sin datos',
  mensaje: 'Hacé tu primer check-in y de a poco vas a ver tu propio patrón.',
  mascota: 'saludando',
};

function climaDeIcve(icve) {
  if (icve === null || icve === undefined || !Number.isFinite(icve)) return { ...SIN_DATOS };

  const clima = CLIMAS.find((c) => icve <= c.hasta) || CLIMAS[CLIMAS.length - 1];
  return { ...clima };
}

/**
 * Titular comparando contra la propia línea base.
 *
 * Toda la redacción evita el juicio y ancla en el propio historial: la promesa
 * de Lumys es que a un estudiante se lo compara consigo mismo y con nadie más.
 */
function titularIpsativo(icve, lineaBase) {
  if (icve === null) return 'Todavía no hay registros suficientes para ver tu patrón.';
  if (lineaBase === null) return 'Estos son tus primeros días. Todavía estoy aprendiendo cómo venís normalmente.';

  const delta = Math.round(icve - lineaBase);

  // Diez puntos es el mismo umbral con el que icve.service decide si algo se
  // salió de lo habitual. Por debajo de eso es variación normal, y nombrarla
  // sería inventar un cambio donde no lo hay.
  if (Math.abs(delta) < 10) return 'Hoy venís parecido a tu propio promedio.';
  if (delta > 0) return 'Hoy pesa un poco más que tu promedio de las últimas semanas.';
  return 'Hoy venís más liviano que tu propio promedio.';
}

module.exports = { CLIMAS, SIN_DATOS, climaDeIcve, titularIpsativo };
