/* ==========================================================================
   Lumys* — Check-in conversacional

   El registro breve es el único punto de entrada de datos del estudiante.
   Micro-historias en vez de preguntas directas, botones rápidos y un espacio
   libre para escribir. Nunca se pregunta por síntomas ni se usa lenguaje clínico.
   ========================================================================== */

App.controladores.checkin = (raiz, { usuario }) => {
  const { qs, el } = LM;

  const cuerpo = qs('#chat-body', raiz);
  const pie = qs('#chat-foot', raiz);
  const progreso = qs('#chat-progress', raiz);

  const PASOS = [
    {
      clave: 'animo',
      pregunta: `Hola ${usuario.nombre.split(' ')[0]}. ¿Cómo venís hoy?`,
      tipo: 'rapido',
      opciones: [
        { emoji: '🙂', texto: 'Bien', valor: 'bien' },
        { emoji: '😐', texto: 'Normal', valor: 'normal' },
        { emoji: '😮‍💨', texto: 'Pesado', valor: 'pesado' },
        { emoji: '🤷', texto: 'No sé', valor: 'nose' },
      ],
      respuesta: (v) => ({
        bien: 'Qué bueno. Guardo eso.',
        normal: 'Vale, un día normal también cuenta.',
        pesado: 'Gracias por decirlo. Está bien nombrarlo.',
        nose: 'Está bien no saber. A veces es así.',
      }[v]),
    },
    {
      clave: 'sueno',
      pregunta: '¿Y anoche? ¿Cómo dormiste?',
      tipo: 'rapido',
      opciones: [
        { emoji: '😴', texto: 'De un tirón', valor: 'bien' },
        { emoji: '🌙', texto: 'Más o menos', valor: 'regular' },
        { emoji: '👀', texto: 'Poco', valor: 'poco' },
      ],
      respuesta: (v) => (v === 'poco'
        ? 'Dormir poco te cambia el día entero. No es flojera.'
        : 'Anotado.'),
    },
    {
      clave: 'gente',
      pregunta: 'Contame de ayer: ¿estuviste con alguien o te quedaste más en lo tuyo?',
      tipo: 'rapido',
      opciones: [
        { emoji: '👥', texto: 'Con gente', valor: 'gente' },
        { emoji: '🎧', texto: 'En lo mío', valor: 'solo' },
        { emoji: '🔀', texto: 'Un poco de cada', valor: 'mixto' },
      ],
      respuesta: () => 'Listo. Ninguna de las dos está mal, solo me sirve saberlo.',
    },
    {
      clave: 'energia',
      pregunta: 'Del 1 al 5, ¿cuánta energía sentís hoy comparado con tu semana normal?',
      tipo: 'escala',
      respuesta: (v) => (Number(v) <= 2
        ? 'Ok. Vamos a ver si eso se mantiene o fue solo hoy.'
        : 'Perfecto, gracias.'),
    },
    {
      clave: 'texto',
      pregunta: '¿Querés contarme algo más? Escribí lo que sea — o saltá esta parte, no pasa nada.',
      tipo: 'texto',
      respuesta: (v) => (v ? 'Gracias por escribirlo. Queda guardado solo para vos.' : 'Todo bien, seguimos.'),
    },
  ];

  const respuestas = {};
  let paso = 0;

  /* --- Pintado de mensajes ------------------------------------------------- */
  const bajar = () => { cuerpo.scrollTop = cuerpo.scrollHeight; };

  function mensaje(texto, quien = 'bot') {
    const nodo = el('div', { class: `lm-msg lm-msg--${quien}`, text: texto });
    cuerpo.append(nodo);
    bajar();
    return nodo;
  }

  async function mensajeBot(texto) {
    const escribiendo = el('div', { class: 'lm-msg lm-msg--bot lm-typing' }, [
      el('span'), el('span'), el('span'),
    ]);
    cuerpo.append(escribiendo);
    bajar();
    await LM.espera(520 + Math.min(texto.length * 9, 700));
    escribiendo.remove();
    return mensaje(texto, 'bot');
  }

  function pintarProgreso() {
    progreso.innerHTML = '';
    PASOS.forEach((_, i) => progreso.append(el('span', { class: i < paso ? 'is-done' : '' })));
  }

  /* --- Controles según el tipo de paso -------------------------------------- */
  function pintarControles(def) {
    pie.innerHTML = '';

    if (def.tipo === 'rapido') {
      const cont = el('div', { class: 'lm-quick' });
      def.opciones.forEach((op) => {
        cont.append(el('button', {
          class: 'lm-quick__btn',
          type: 'button',
          onclick: () => responder(def, op.valor, `${op.emoji} ${op.texto}`),
        }, [
          el('span', { class: 'lm-quick__emoji', text: op.emoji }),
          el('span', { text: op.texto }),
        ]));
      });
      pie.append(cont);
      return;
    }

    if (def.tipo === 'escala') {
      const cont = el('div', { class: 'lm-scale' });
      [1, 2, 3, 4, 5].forEach((n) => {
        cont.append(el('button', {
          class: 'lm-scale__btn',
          type: 'button',
          'aria-label': `${n} de 5`,
          onclick: (e) => {
            e.currentTarget.classList.add('is-selected');
            responder(def, n, `${n} de 5`);
          },
        }, [String(n)]));
      });
      pie.append(
        cont,
        el('p', { class: 'lm-caption mt-2 mb-0', text: '1 es mucho menos que tu normal, 5 es mucho más.' }),
      );
      return;
    }

    if (def.tipo === 'texto') {
      const area = el('textarea', {
        class: 'lm-textarea',
        rows: '2',
        placeholder: 'Escribí lo que quieras…',
        'aria-label': 'Contame algo más',
      });
      const enviar = () => responder(def, area.value.trim(), area.value.trim() || null);

      area.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
      });

      pie.append(
        el('div', { class: 'lm-chat__composer' }, [
          el('button', {
            class: 'lm-chat__voice', type: 'button', 'aria-label': 'Grabar nota de voz',
            onclick: (e) => {
              const btn = e.currentTarget;
              btn.classList.toggle('is-recording');
              LM.toast(btn.classList.contains('is-recording')
                ? 'Grabando… (el análisis de voz llega en la Fase 3)'
                : 'Nota de voz descartada.', { tipo: 'info' });
            },
          }, [el('i', { class: 'bi bi-mic' })]),
          area,
          el('button', { class: 'lm-chat__send', type: 'button', 'aria-label': 'Enviar', onclick: enviar },
            [el('i', { class: 'bi bi-send' })]),
        ]),
        el('button', {
          class: 'lm-btn lm-btn--ghost lm-btn--sm mt-3', type: 'button',
          onclick: () => responder(def, '', null),
        }, ['Saltar esta parte']),
      );
      area.focus();
    }
  }

  /* --- Flujo ----------------------------------------------------------------- */
  async function responder(def, valor, textoUsuario) {
    pie.innerHTML = '';
    respuestas[def.clave] = valor;
    if (textoUsuario) mensaje(textoUsuario, 'user');

    paso += 1;
    pintarProgreso();

    await mensajeBot(def.respuesta(valor));
    siguiente();
  }

  async function siguiente() {
    if (paso >= PASOS.length) return cerrar();
    const def = PASOS[paso];
    await mensajeBot(def.pregunta);
    pintarControles(def);
  }

  /* --- Cierre ---------------------------------------------------------------- */
  async function cerrar() {
    await mensajeBot('Listo. Eso es todo por hoy.');

    const guardado = await API.enviarCheckin({
      emocion: respuestas.animo,
      sueno: respuestas.sueno,
      contacto_social: respuestas.gente,
      energia: Number(respuestas.energia) || null,
      texto_usuario: respuestas.texto || null,
    });

    const racha = 12 + (guardado.guardado ? 1 : 0);

    cuerpo.append(el('div', { class: 'lm-msg lm-msg--sistema', text: 'Check-in guardado · solo vos ves el detalle' }));
    bajar();

    pie.innerHTML = '';
    pie.append(
      el('div', { class: 'lm-racha mb-4' }, [
        el('span', { class: 'lm-racha__flame' }, [el('i', { class: 'bi bi-fire' })]),
        el('div', {}, [
          el('p', { class: 'lm-racha__num mb-0', text: `${racha} días` }),
          el('p', { class: 'lm-caption mb-0', text: 'seguidos apareciendo. Se premia la constancia, no el ánimo.' }),
        ]),
      ]),
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

    LM.toast('Check-in guardado. Nos vemos mañana.', { tipo: 'logro' });
  }

  /* --- Arranque ---------------------------------------------------------------- */
  qs('#checkin-reiniciar', raiz).addEventListener('click', () => {
    cuerpo.innerHTML = '';
    pie.innerHTML = '';
    paso = 0;
    Object.keys(respuestas).forEach((k) => delete respuestas[k]);
    pintarProgreso();
    siguiente();
  });

  pintarProgreso();
  siguiente();
};
