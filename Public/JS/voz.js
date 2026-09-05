/* ==========================================================================
   Lumys* — Nota de voz del check-in

   El estudiante graba como grabaría un audio de WhatsApp. Lo que pasa después
   es la diferencia importante: el audio NUNCA sale del teléfono, ni siquiera se
   guarda en memoria como archivo. Se analiza mientras se habla y lo único que
   viaja al servidor son números — cuánto duró, cuánto silencio hubo, cuánto
   varió el tono, a qué ritmo habló.

   Por qué así y no transcribiendo: la grabación de un adolescente contando cómo
   está no tiene por qué existir en ningún servidor para que el sistema note que
   hoy habla más lento que ayer. Y si nunca se guarda, no hay nada que filtrar,
   que pedir por orden judicial ni que borrar cuando el estudiante lo pida.

   La contrapartida, que va dicha en el prompt del backend y también acá: la
   prosodia es una señal DÉBIL. Un resfrío, el ruido del recreo o hablar apurado
   producen los mismos números que el cansancio. Por eso esto nunca mueve el
   ICVE por sí solo: suma un factor que una persona lee junto con el resto.
   ========================================================================== */

const Voz = (() => {
  // Ventana de análisis. 2048 muestras a 44.1 kHz son ~46 ms: suficiente para
  // estimar el tono de una voz humana y lo bastante corto para no promediar
  // dos sílabas distintas en una sola medición.
  const VENTANA = 2048;

  // Umbral de energía por encima del cual se considera que hay habla. Es un
  // valor conservador: el ruido de fondo de un aula queda por debajo.
  const UMBRAL_HABLA = 0.012;

  // Rango de tono fundamental que se busca. Cubre voces adolescentes de ambos
  // sexos con margen; fuera de esto casi siempre es un armónico mal detectado.
  const F0_MIN = 75;
  const F0_MAX = 400;

  let contexto = null;
  let stream = null;
  let analizador = null;
  let temporizador = null;

  let muestras = [];
  let arrancadoEn = 0;

  /**
   * Tono fundamental por autocorrelación.
   *
   * Se busca el desfase que mejor se parece a la señal original: ese desfase es
   * el período, y su inversa la frecuencia. Devuelve null cuando la señal no es
   * suficientemente periódica, que es lo que pasa con las consonantes sordas y
   * con el silencio — forzar un número ahí ensuciaría la variación de tono.
   */
  function estimarTono(buffer, frecuenciaMuestreo) {
    const n = buffer.length;

    let energia = 0;
    for (let i = 0; i < n; i += 1) energia += buffer[i] * buffer[i];
    const rms = Math.sqrt(energia / n);

    if (rms < UMBRAL_HABLA) return { tono: null, rms };

    const desfaseMin = Math.floor(frecuenciaMuestreo / F0_MAX);
    const desfaseMax = Math.floor(frecuenciaMuestreo / F0_MIN);

    let mejorDesfase = -1;
    let mejorCorrelacion = 0;

    for (let desfase = desfaseMin; desfase <= desfaseMax; desfase += 1) {
      let correlacion = 0;
      for (let i = 0; i < n - desfase; i += 1) {
        correlacion += buffer[i] * buffer[i + desfase];
      }
      correlacion /= n - desfase;

      if (correlacion > mejorCorrelacion) {
        mejorCorrelacion = correlacion;
        mejorDesfase = desfase;
      }
    }

    // Correlación baja = la señal no es periódica. Es habla no sonora o ruido.
    if (mejorDesfase < 0 || mejorCorrelacion < rms * rms * 0.3) return { tono: null, rms };

    return { tono: frecuenciaMuestreo / mejorDesfase, rms };
  }

  /** Toma una medición de la ventana actual. */
  function medir() {
    const buffer = new Float32Array(VENTANA);
    analizador.getFloatTimeDomainData(buffer);

    const { tono, rms } = estimarTono(buffer, contexto.sampleRate);
    muestras.push({ tono, rms, hablando: rms >= UMBRAL_HABLA });
  }

  /**
   * Convierte las mediciones en las características que espera el backend.
   *
   * Los nombres coinciden con REFERENCIA en src/IA/ia.voz.service.js. Si se
   * renombra uno acá hay que renombrarlo allá: el servicio compara por clave y
   * una clave desconocida se ignora en silencio.
   */
  function resumir() {
    const total = muestras.length;
    if (!total) return null;

    const conHabla = muestras.filter((m) => m.hablando);
    const tonos = muestras.map((m) => m.tono).filter((t) => t !== null);

    const duracionSegundos = (Date.now() - arrancadoEn) / 1000;

    // Variación de tono como desviación estándar en Hz. Una voz plana da un
    // número bajo; una voz con inflexión, uno alto.
    let variacionTono = 0;
    if (tonos.length > 1) {
      const media = tonos.reduce((s, t) => s + t, 0) / tonos.length;
      const varianza = tonos.reduce((s, t) => s + (t - media) ** 2, 0) / tonos.length;
      variacionTono = Math.sqrt(varianza);
    }

    // Ritmo aproximado. Se cuentan los arranques de habla tras un silencio como
    // proxy de sílabas y se asume ~2.5 sílabas por palabra, que es lo típico en
    // español hablado. Es una estimación gruesa a propósito: lo que importa no
    // es el número absoluto sino cómo se compara con el propio historial del
    // estudiante, y para eso un sesgo constante no molesta.
    let arranques = 0;
    for (let i = 1; i < total; i += 1) {
      if (muestras[i].hablando && !muestras[i - 1].hablando) arranques += 1;
    }
    const segundosHablando = (conHabla.length / total) * duracionSegundos;
    const palabrasPorMinuto = segundosHablando > 0
      ? Math.round((arranques / 2.5) * (60 / segundosHablando))
      : 0;

    const energiaMedia = conHabla.length
      ? conHabla.reduce((s, m) => s + m.rms, 0) / conHabla.length
      : 0;

    return {
      duracionSegundos: Number(duracionSegundos.toFixed(1)),
      proporcionPausas: Number(((total - conHabla.length) / total).toFixed(3)),
      variacionTono: Number(variacionTono.toFixed(1)),
      palabrasPorMinuto,
      energiaMedia: Number(energiaMedia.toFixed(4)),
      tonoMedio: tonos.length
        ? Number((tonos.reduce((s, t) => s + t, 0) / tonos.length).toFixed(1))
        : 0,
    };
  }

  const soportado = () =>
    Boolean(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));

  /**
   * Empieza a escuchar. Pide permiso de micrófono: el navegador muestra su
   * propio aviso, que es la garantía visible de que no grabamos a escondidas.
   */
  async function grabar() {
    if (!soportado()) throw new Error('Este navegador no permite grabar notas de voz');

    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    contexto = new (window.AudioContext || window.webkitAudioContext)();
    const fuente = contexto.createMediaStreamSource(stream);

    analizador = contexto.createAnalyser();
    analizador.fftSize = VENTANA;
    fuente.connect(analizador);

    // No se conecta el analizador al destino: si lo hiciéramos, el estudiante se
    // escucharía a sí mismo por el altavoz con retardo.

    muestras = [];
    arrancadoEn = Date.now();

    // Se mide cada 50 ms en vez de por cada cuadro de audio. Alcanza para el
    // ritmo del habla y no calienta el teléfono.
    temporizador = setInterval(medir, 50);
  }

  /**
   * Corta la grabación y devuelve solo los números.
   *
   * El orden importa: se sueltan las pistas del micrófono ANTES de resumir, para
   * que el indicador de grabación del navegador se apague en cuanto el
   * estudiante suelta el botón y no mientras se calcula.
   */
  function detener() {
    clearInterval(temporizador);
    temporizador = null;

    stream?.getTracks().forEach((pista) => pista.stop());
    contexto?.close();

    stream = null;
    contexto = null;
    analizador = null;

    const caracteristicas = resumir();
    muestras = [];

    // Menos de dos segundos no da para nada: un botón apretado sin querer.
    if (!caracteristicas || caracteristicas.duracionSegundos < 2) return null;

    return caracteristicas;
  }

  /** Descarta lo grabado sin devolver nada. */
  function cancelar() {
    clearInterval(temporizador);
    temporizador = null;
    stream?.getTracks().forEach((pista) => pista.stop());
    contexto?.close();
    stream = null;
    contexto = null;
    analizador = null;
    muestras = [];
  }

  const grabando = () => temporizador !== null;

  return { soportado, grabar, detener, cancelar, grabando };
})();

window.Voz = Voz;
