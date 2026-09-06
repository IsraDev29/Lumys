/* ===========================================================================
 * Lumys* — sonido de ambiente para la respiración
 * ---------------------------------------------------------------------------
 * La pantalla de Stitch trae un selector con cuatro ambientes: lluvia, fuego,
 * ondas cósmicas y silencio. No hay archivos de audio en el proyecto y no se
 * van a inventar cuatro botones que no hacen nada, así que acá se sintetiza el
 * único que se puede sintetizar bien: ruido blanco filtrado, que es lo que
 * suena a lluvia. Los otros dos se quedan fuera hasta que haya audio de verdad.
 *
 * Sin archivos también significa sin descarga: son unos 40 bytes de código
 * contra los cientos de kilobytes de un loop en mp3, y a un estudiante con
 * datos contados eso le importa.
 *
 * El contexto se crea perezosamente y sólo dentro de un gesto del usuario: los
 * navegadores arrancan el AudioContext en estado 'suspended' si se construye al
 * cargar la página, y después no hay forma de reanudarlo sin otro gesto.
 * =========================================================================== */

let contexto: AudioContext | null = null;
let fuente: AudioBufferSourceNode | null = null;
let volumen: GainNode | null = null;

/** Dos segundos de ruido rosa aproximado, en bucle. */
function bufferDeLluvia(ctx: AudioContext): AudioBuffer {
  const muestras = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
  const canal = buffer.getChannelData(0);

  // Filtro de Voss simplificado: el ruido blanco puro suena a estática de
  // televisor. Acumular con memoria le baja las frecuencias altas y ahí es
  // donde empieza a parecerse a la lluvia.
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < muestras; i += 1) {
    const blanco = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + blanco * 0.0990460;
    b1 = 0.96300 * b1 + blanco * 0.2965164;
    b2 = 0.57000 * b2 + blanco * 1.0526913;
    canal[i] = (b0 + b1 + b2 + blanco * 0.1848) * 0.12;
  }
  return buffer;
}

export const soportado = (): boolean =>
  typeof window !== 'undefined' && 'AudioContext' in window;

/** Arranca la lluvia con una entrada suave. Idempotente. */
export function iniciar(): void {
  if (!soportado() || fuente) return;

  contexto ??= new AudioContext();
  void contexto.resume();

  const paso = contexto.createBiquadFilter();
  paso.type = 'lowpass';
  paso.frequency.value = 1_400;

  volumen = contexto.createGain();
  // Entra en dos segundos. Un ambiente que aparece de golpe sobresalta, que es
  // lo contrario de lo que hace falta en un ejercicio de respiración.
  volumen.gain.setValueAtTime(0, contexto.currentTime);
  volumen.gain.linearRampToValueAtTime(0.35, contexto.currentTime + 2);

  fuente = contexto.createBufferSource();
  fuente.buffer = bufferDeLluvia(contexto);
  fuente.loop = true;
  fuente.connect(paso).connect(volumen).connect(contexto.destination);
  fuente.start();
}

/** Corta la lluvia con una salida suave. */
export function detener(): void {
  if (!contexto || !fuente || !volumen) return;

  const fin = contexto.currentTime + 0.6;
  volumen.gain.cancelScheduledValues(contexto.currentTime);
  volumen.gain.setValueAtTime(volumen.gain.value, contexto.currentTime);
  volumen.gain.linearRampToValueAtTime(0, fin);

  const saliente = fuente;
  fuente = null;
  volumen = null;
  // Se para DESPUÉS del desvanecido: cortar el nodo en seco produce un chasquido
  // porque la onda queda truncada a mitad de ciclo.
  saliente.stop(fin);
}
