/* ==========================================================================
   Lumys* — Check-in conversacional

   Antes esta pantalla recorría un array PASOS con cinco preguntas fijas y sus
   respuestas ya escritas. Funcionaba, pero al tercer día el estudiante ya se
   sabía el guion y el check-in se sentía un trámite — que es justamente lo que
   hace que la gente deje de aparecer.

   Ahora cada intercambio lo genera el modelo en /ia/checkin/turno, con lo que
   se dijo en esta sesión y una paráfrasis de los días anteriores como contexto.
   La pantalla no sabe cuántas preguntas van a venir ni cuáles: solo pinta lo
   que llega y devuelve lo que el estudiante contesta.

   Lo único que sigue siendo fijo es la aritmética. Cada opción trae un `valor`
   de 1 a 5 que viaja al backend y alimenta el ICVE ahí, con una fórmula. La
   conversación cambia todos los días; la forma de medirla, no.
   ========================================================================== */

App.controladores.checkin = (raiz) => {
  const { qs, el } = LM;

  const cuerpo = qs('#chat-body', raiz);
  const pie = qs('#chat-foot', raiz);
  const progreso = qs('#chat-progress', raiz);

  // Tope superior de intercambios. El backend también lo aplica; acá sirve solo
  // para dibujar la barra de progreso, que necesita un total aunque la
  // conversación sea de largo variable.
  const MAX_TURNOS = 6;

  /** Lo respondido en esta sesión. Se manda entero en cada turno: el backend
   *  no guarda estado conversacional, así que recargar no deja nada colgado. */
  let sesion = [];
  let textoLibre = null;
  let cerrado = false;

  // Características prosódicas de la nota de voz, si el estudiante grabó una.
  // Nunca el audio: ver JS/voz.js.
  let caracteristicasVoz = null;
  // La racha llega con cada turno, calculada en el servidor sobre los check-ins
  // guardados. No se cuenta acá para que no dependa del reloj del teléfono.
  let racha = 0;

  /* --- Pintado de mensajes ------------------------------------------------- */
  const bajar = () => { cuerpo.scrollTop = cuerpo.scrollHeight; };

  function mensaje(texto, quien = 'bot') {
    const nodo = el('div', { class: `lm-msg lm-msg--${quien}`, text: texto });
    cuerpo.append(nodo);
    bajar();
    return nodo;
  }

  /** Indicador de escritura. Ahora cumple dos funciones: dar ritmo humano a la
   *  conversación y cubrir la latencia real de la llamada al modelo. */
  function escribiendo() {
    const nodo = el('div', { class: 'lm-msg lm-msg--bot lm-typing' }, [
      el('span'), el('span'), el('span'),
    ]);
    cuerpo.append(nodo);
    bajar();
    return nodo;
  }

  async function mensajeBot(texto) {
    const puntos = escribiendo();
    await LM.espera(420 + Math.min(texto.length * 8, 600));
    puntos.remove();
    return mensaje(texto, 'bot');
  }

  function pintarProgreso() {
    progreso.innerHTML = '';
    for (let i = 0; i < MAX_TURNOS; i += 1) {
      progreso.append(el('span', { class: i < sesion.length ? 'is-done' : '' }));
    }
  }

  /* --- Controles según el formato que pidió el modelo ----------------------- */
  function pintarControles(turno) {
    pie.innerHTML = '';

    if (turno.formato === 'opciones') {
      const cont = el('div', { class: 'lm-quick' });
      turno.opciones.forEach((op) => {
        cont.append(el('button', {
          class: 'lm-quick__btn',
          type: 'button',
          onclick: () => responder(turno, `${op.emoji} ${op.etiqueta}`, op.valor),
        }, [
          el('span', { class: 'lm-quick__emoji', text: op.emoji }),
          el('span', { text: op.etiqueta }),
        ]));
      });
      pie.append(cont);
      return;
    }

    if (turno.formato === 'escala') {
      const cont = el('div', { class: 'lm-scale' });
      [1, 2, 3, 4, 5].forEach((n) => {
        cont.append(el('button', {
          class: 'lm-scale__btn',
          type: 'button',
          'aria-label': `${n} de 5`,
          onclick: (e) => {
            e.currentTarget.classList.add('is-selected');
            responder(turno, `${n} de 5`, n);
          },
        }, [String(n)]));
      });
      pie.append(
        cont,
        el('p', { class: 'lm-caption mt-2 mb-0', text: '1 es mucho menos que tu normal, 5 es mucho más.' }),
      );
      return;
    }

    // formato 'texto'
    const area = el('textarea', {
      class: 'lm-textarea',
      rows: '2',
      placeholder: 'Escribí lo que quieras…',
      'aria-label': 'Escribí tu respuesta',
    });

    const enviar = () => {
      const valor = area.value.trim();
      if (!valor) return saltar(turno);
      textoLibre = valor;
      responder(turno, valor, null);
    };

    area.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
    });

    pie.append(
      el('div', { class: 'lm-chat__composer' }, [
        el('button', {
          class: 'lm-chat__voice', type: 'button', 'aria-label': 'Grabar nota de voz',
          onclick: (e) => alternarGrabacion(e.currentTarget),
        }, [el('i', { class: 'bi bi-mic' })]),
        area,
        el('button', { class: 'lm-chat__send', type: 'button', 'aria-label': 'Enviar', onclick: enviar },
          [el('i', { class: 'bi bi-send' })]),
      ]),
      el('button', {
        class: 'lm-btn lm-btn--ghost lm-btn--sm mt-3', type: 'button',
        onclick: () => saltar(turno),
      }, ['Saltar esta parte']),
    );
    area.focus();
  }

  /* --- Nota de voz ---------------------------------------------------------- */

  /**
   * Graba y para, como el botón de audio de cualquier app de mensajería.
   *
   * Lo que se guarda al soltar son seis números — duración, pausas, variación de
   * tono, ritmo, energía —, nunca el audio. Se le dice al estudiante de forma
   * explícita: es lo que hace que apretar el micrófono no sea una decisión a
   * ciegas sobre sus propios datos.
   */
  async function alternarGrabacion(boton) {
    if (!Voz.soportado()) {
      LM.toast('Este navegador no permite grabar notas de voz.', { tipo: 'info' });
      return;
    }

    if (Voz.grabando()) {
      boton.classList.remove('is-recording');

      caracteristicasVoz = Voz.detener();

      LM.toast(
        caracteristicasVoz
          ? 'Listo. Solo guardé el ritmo de tu voz, no el audio.'
          : 'Muy corto, no alcancé a escuchar. Probá de nuevo.',
        { tipo: caracteristicasVoz ? 'ok' : 'info' },
      );
      return;
    }

    try {
      await Voz.grabar();
      boton.classList.add('is-recording');
      LM.toast('Te escucho. El audio no sale de tu teléfono.', { tipo: 'info' });
    } catch (error) {
      // El caso normal acá es que el estudiante haya dicho que no al permiso del
      // micrófono. No es un error que haya que arreglar: es una respuesta.
      boton.classList.remove('is-recording');
      LM.toast('No se pudo usar el micrófono. Podés escribir igual.', { tipo: 'info' });
    }
  }

  /* --- Flujo ---------------------------------------------------------------- */

  /** Saltar no registra el turno: un componente sin respuesta se excluye del
   *  ICVE y los pesos se renormalizan. Guardar un valor neutro inventado
   *  ensuciaría la serie histórica con la que se compara al estudiante. */
  function saltar(turno) {
    pie.innerHTML = '';
    if (turno.cierre) return cerrar();
    return siguiente();
  }

  async function responder(turno, textoRespuesta, valor) {
    pie.innerHTML = '';
    mensaje(textoRespuesta, 'user');

    sesion.push({
      pregunta: turno.pregunta,
      respuesta: textoRespuesta,
      componente: turno.componente,
      valor: valor ?? null,
    });
    pintarProgreso();

    if (turno.cierre || sesion.length >= MAX_TURNOS) return cerrar();
    return siguiente();
  }

  async function siguiente() {
    const puntos = escribiendo();
    let turno;
    try {
      turno = await API.turnoCheckin(sesion);
    } finally {
      puntos.remove();
    }

    if (typeof turno.racha === 'number') racha = turno.racha;

    if (turno.reaccion) await mensajeBot(turno.reaccion);
    await mensajeBot(turno.pregunta);

    // Cuando la IA no estuvo disponible se dice, en vez de disimularlo. El
    // estudiante tiene derecho a saber si le está escribiendo un modelo o una
    // lista local, sobre todo en una app que le pide que cuente cómo está.
    if (turno.generado === false && !qs('.lm-msg--sistema', cuerpo)) {
      cuerpo.append(el('div', {
        class: 'lm-msg lm-msg--sistema',
        text: 'Hoy ando con preguntas de repuesto — la conexión no está fina.',
      }));
      bajar();
    }

    pintarControles(turno);
  }

  /* --- Cierre ---------------------------------------------------------------- */
  async function cerrar() {
    if (cerrado) return;
    cerrado = true;

    await mensajeBot('Listo. Eso es todo por hoy.');

    const puntos = escribiendo();
    let resultado;
    try {
      resultado = await API.enviarCheckin({
        turnos: sesion,
        texto_usuario: textoLibre,
        // Solo se manda si el estudiante grabó algo. Son números, nunca audio:
        // el consentimiento va explícito porque el backend lo exige y rechaza
        // el análisis sin él. Ver JS/voz.js y src/IA/ia.voz.service.js.
        voz: caracteristicasVoz ? { caracteristicas: caracteristicasVoz, consentimiento: true } : null,
      });
    } finally {
      puntos.remove();
    }

    // Riesgo explícito: el mensaje de contención lo escribe el backend con
    // texto fijo y los contactos que mantiene la institución, no el modelo.
    if (resultado.contencion) {
      resultado.contencion.split('\n').forEach((linea) => mensaje(linea, 'bot'));
    } else if (resultado.coach) {
      await mensajeBot(resultado.coach);
    }

    cuerpo.append(el('div', {
      class: 'lm-msg lm-msg--sistema',
      text: 'Check-in guardado · solo vos ves el detalle',
    }));
    bajar();

    pintarCierre(resultado);
    LM.toast('Check-in guardado. Nos vemos mañana.', { tipo: 'logro' });
  }

  function pintarCierre(resultado) {
    pie.innerHTML = '';

    const bloques = [];

    // El check-in de hoy ya suma: la racha que trajo el turno es la de antes
    // de guardar este registro.
    const rachaFinal = racha + 1;
    if (rachaFinal > 1) {
      bloques.push(el('div', { class: 'lm-racha mb-4' }, [
        el('span', { class: 'lm-racha__flame' }, [el('i', { class: 'bi bi-fire' })]),
        el('div', {}, [
          el('p', { class: 'lm-racha__num mb-0', text: `${rachaFinal} días` }),
          el('p', { class: 'lm-caption mb-0', text: 'seguidos apareciendo. Se premia la constancia, no el ánimo.' }),
        ]),
      ]));
    }

    // Los factores son la parte explicable: por qué el sistema leyó el día así.
    // Sin esto el estudiante ve un número que sube y baja sin motivo.
    const factores = resultado.factores || [];
    if (factores.length) {
      bloques.push(el('div', { class: 'lm-note lm-note--teal mb-3' }, [
        el('i', { class: 'bi bi-lightbulb' }),
        el('div', {}, [
          el('strong', { text: 'Qué se tomó en cuenta' }),
          el('ul', { class: 'lm-caption mb-0', style: 'padding-left:1.1rem' },
            factores.map((f) => el('li', {
              text: `${f.factor} — ${f.direccion === 'protege' ? 'a favor' : 'en contra'}`,
            }))),
        ]),
      ]));
    }

    bloques.push(
      el('div', { class: 'lm-resumen-privacidad mb-4' }, [
        el('div', { class: 'lm-note lm-note--teal' }, [
          el('i', { class: 'bi bi-eye' }),
          el('div', {}, [
            el('strong', { text: 'Qué se guarda' }),
            el('p', { class: 'lm-caption mb-0', text: 'Tus respuestas y tu texto, en tu cuenta.' }),
          ]),
        ]),
        el('div', { class: 'lm-note' }, [
          el('i', { class: 'bi bi-eye-slash' }),
          el('div', {}, [
            el('strong', { text: 'Qué no se comparte' }),
            el('p', { class: 'lm-caption mb-0', text: 'Nadie lee lo que escribiste palabra por palabra.' }),
          ]),
        ]),
      ]),
      el('div', { class: 'd-flex flex-wrap gap-2' }, [
        el('a', { class: 'lm-btn', href: '#/inicio' }, [el('i', { class: 'bi bi-house-heart' }), ' Volver al inicio']),
        el('a', { class: 'lm-btn lm-btn--ghost', href: '#/respirar' }, [el('i', { class: 'bi bi-wind' }), ' Respirar un minuto']),
      ]),
    );

    pie.append(...bloques);
  }

  /* --- Arranque ---------------------------------------------------------------- */
  function reiniciar() {
    cuerpo.innerHTML = '';
    pie.innerHTML = '';
    sesion = [];
    textoLibre = null;
    cerrado = false;
    pintarProgreso();
    siguiente();
  }

  qs('#checkin-reiniciar', raiz).addEventListener('click', reiniciar);
  reiniciar();
};
