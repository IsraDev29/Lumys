/* ==========================================================================
   Lumys* — Paneles de acompañamiento y auditoría

   El panel del orientador muestra conducta observable + ventana temporal.
   El panel institucional solo ve agregados: nunca un caso, nunca un nombre.
   ========================================================================== */

const COLUMNAS = [
  { estado: 'abierto', titulo: 'Señal nueva', icono: 'bi-bell' },
  { estado: 'seguimiento', titulo: 'En seguimiento', icono: 'bi-arrow-repeat' },
  { estado: 'derivado', titulo: 'Derivado', icono: 'bi-box-arrow-up-right' },
  { estado: 'cerrado', titulo: 'Cerrado con alta', icono: 'bi-check2-circle' },
];

/* ==========================================================================
   Orientador
   ========================================================================== */
App.controladores.orientador = async (raiz) => {
  const { qs, qsa, el } = LM;
  const casos = await API.casos();

  /* --- Indicadores del propio orientador ---------------------------------- */
  const activos = casos.filter((c) => c.estado !== 'cerrado');
  const kpis = [
    { valor: activos.length, etiqueta: 'casos activos', delta: 'de 214 estudiantes' },
    { valor: casos.filter((c) => c.nivel === 1).length, etiqueta: 'en Nivel 1 · conversar', delta: 'el nivel más barato de equivocarse' },
    { valor: casos.filter((c) => c.estado === 'cerrado').length, etiqueta: 'cerrados con alta', delta: 'este semestre' },
    { valor: 3, etiqueta: 'días de la señal a la conversación', delta: 'antes eran 11', logro: true },
  ];

  const contKpis = qs('#orientador-kpis', raiz);
  contKpis.innerHTML = '';
  kpis.forEach((k) => {
    const valor = el('span', { class: 'lm-stat__value', text: '0' });
    contKpis.append(el('div', { class: `lm-stat${k.logro ? ' lm-stat--logro' : ''}` }, [
      valor,
      el('span', { class: 'lm-stat__label', text: k.etiqueta }),
      el('span', { class: `lm-stat__delta ${k.logro ? 'lm-stat__delta--warm' : 'lm-stat__delta--up'}`, text: k.delta }),
    ]));
    LM.contar(valor, k.valor);
  });

  /* --- Ficha lateral -------------------------------------------------------- */
  const ficha = qs('#ficha-caso', raiz);
  const offcanvas = window.bootstrap ? new bootstrap.Offcanvas(ficha) : null;

  function abrirFicha(caso) {
    qs('#ficha-caso-titulo', raiz).textContent = caso.alias;
    qs('#ficha-caso-sub', raiz).textContent = `${caso.id} · abierto ${LM.haceCuanto(caso.desde)}`;

    const cuerpo = qs('#ficha-caso-cuerpo', raiz);
    cuerpo.innerHTML = '';
    cuerpo.append(
      el('div', { class: 'd-flex flex-wrap gap-2 mb-4' }, [
        el('span', { class: `lm-nivel lm-nivel--${caso.nivel}`, text: `Nivel ${caso.nivel} · ${LM.NIVELES[caso.nivel].nombre}` }),
        el('span', { class: 'lm-chip lm-chip--neutral', text: `${caso.semanas} semanas sostenidas` }),
      ]),
      el('div', { class: 'lm-note lm-note--teal mb-4' }, [
        el('i', { class: 'bi bi-translate' }),
        el('div', {}, [
          el('strong', { text: 'Lo que se le dice a un adulto' }),
          el('p', {
            class: 'lm-caption mb-0',
            text: `“En las últimas ${caso.semanas} semanas ${caso.señales[0].toLowerCase()}. No sabemos la causa. Sería bueno conversar esta semana, sin presionarlo.”`,
          }),
        ]),
      ]),
      el('p', { class: 'lm-eyebrow', text: 'Conducta observable' }),
      el('div', { class: 'lm-caso__señales mb-4' },
        caso.señales.map((s) => el('span', { class: 'lm-caso__señal', text: s }))),
      el('p', { class: 'lm-eyebrow', text: 'Historia del caso' }),
      el('div', { class: 'lm-timeline mb-4' },
        caso.linea.map((p) => el('div', {
          class: `lm-timeline__item${p.tipo === 'alerta' ? ' lm-timeline__item--warm' : ''}${p.tipo === 'accion' ? ' lm-timeline__item--done' : ''}`,
        }, [
          el('p', { class: 'lm-timeline__time mb-1', text: `${LM.capitalizar(LM.haceCuanto(p.t))} · ${LM.fechaLarga(p.t)}` }),
          el('p', { class: 'lm-timeline__text mb-0', text: p.texto }),
        ]))),
      el('div', { class: 'd-grid gap-2' }, [
        el('button', {
          class: 'lm-btn', type: 'button',
          onclick: () => LM.toast('Conversación registrada. El caso sigue abierto.', { tipo: 'ok' }),
        }, [el('i', { class: 'bi bi-chat-heart' }), ' Registrar conversación']),
        el('button', {
          class: 'lm-btn lm-btn--ghost', type: 'button',
          onclick: () => LM.toast('Enviado al psicólogo para revisión.', { tipo: 'info' }),
        }, [el('i', { class: 'bi bi-shield-check' }), ' Pedir revisión al psicólogo']),
        el('button', {
          class: 'lm-btn lm-btn--ghost', type: 'button',
          onclick: () => LM.toast('Caso cerrado con alta explícita.', { tipo: 'logro' }),
        }, [el('i', { class: 'bi bi-check2-circle' }), ' Cerrar con alta']),
      ]),
      el('p', { class: 'lm-caption mt-4 mb-0', text: 'Este panel nunca muestra el texto libre del estudiante.' }),
    );

    offcanvas?.show();
  }

  /* --- Tablero -------------------------------------------------------------- */
  const tablero = qs('#tablero', raiz);

  function pintar(filtro = 'todos') {
    const visibles = filtro === 'todos' ? casos : casos.filter((c) => String(c.nivel) === filtro);
    tablero.innerHTML = '';

    COLUMNAS.forEach((col) => {
      const items = visibles.filter((c) => c.estado === col.estado);
      const lista = el('div', { class: 'lm-board__list' });

      if (!items.length) {
        lista.append(el('p', { class: 'lm-caption text-center py-3 mb-0', text: 'Nada por acá' }));
      }

      items.forEach((caso) => {
        lista.append(el('article', {
          class: 'lm-caso', 'data-nivel': String(caso.nivel), tabindex: '0', role: 'button',
          onclick: () => abrirFicha(caso),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirFicha(caso); } },
        }, [
          el('div', { class: 'lm-caso__head' }, [
            el('span', { class: `lm-avatar${caso.nivel === 3 ? ' lm-avatar--warm' : ''}`, text: caso.id.slice(-3) }),
            el('div', {}, [
              el('p', { class: 'lm-caso__name mb-0', text: caso.alias }),
              el('p', { class: 'lm-caso__meta mb-0', text: `${caso.id} · ${LM.haceCuanto(caso.desde)}` }),
            ]),
          ]),
          el('div', { class: 'lm-caso__señales' },
            caso.señales.slice(0, 2).map((s) => el('span', { class: 'lm-caso__señal', text: s }))),
          el('div', { class: 'lm-caso__foot' }, [
            el('span', { class: `lm-nivel lm-nivel--${caso.nivel}`, text: LM.NIVELES[caso.nivel].nombre }),
            el('span', { class: 'lm-caption', text: `${caso.semanas} sem.` }),
          ]),
        ]));
      });

      tablero.append(el('section', { class: 'lm-board__col' }, [
        el('div', { class: 'lm-board__col-head' }, [
          el('i', { class: `bi ${col.icono}`, style: 'color:var(--lm-teal)' }),
          el('h2', { class: 'lm-board__col-title', text: col.titulo }),
          el('span', { class: 'lm-board__count', text: String(items.length) }),
        ]),
        lista,
      ]));
    });
  }

  pintar();

  qsa('#filtro-nivel .lm-segmented__btn', raiz).forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('#filtro-nivel .lm-segmented__btn', raiz).forEach((b) => b.classList.toggle('is-active', b === btn));
      pintar(btn.dataset.nivel);
    });
  });
};

/* ==========================================================================
   Psicólogo
   ========================================================================== */
App.controladores.psicologo = async (raiz) => {
  const { qs, el } = LM;
  const [pendientes, casos] = await Promise.all([API.supervision(), API.casos()]);

  const cont = qs('#supervision-lista', raiz);
  cont.innerHTML = '';

  pendientes.forEach((p) => {
    const caso = casos.find((c) => c.id === p.caso);
    cont.append(el('article', { class: 'lm-caso', 'data-nivel': String(caso?.nivel || 2) }, [
      el('div', { class: 'lm-caso__head' }, [
        el('span', { class: 'lm-avatar', text: p.caso.slice(-3) }),
        el('div', {}, [
          el('p', { class: 'lm-caso__name mb-0', text: caso?.alias || p.caso }),
          el('p', { class: 'lm-caso__meta mb-0', text: `${p.caso} · esperando desde ${LM.haceCuanto(p.desde)}` }),
        ]),
        caso ? el('span', { class: `lm-nivel lm-nivel--${caso.nivel} ms-auto`, text: `Nivel ${caso.nivel}` }) : null,
      ]),
      el('p', { class: 'mb-0', style: 'font-size:.95rem', text: p.pregunta }),
      el('div', { class: 'lm-caso__señales' },
        (caso?.señales || []).map((s) => el('span', { class: 'lm-caso__señal', text: s }))),
      el('div', { class: 'lm-caso__foot' }, [
        el('span', { class: 'lm-caption', text: `Orientadora: ${p.orientador}` }),
        el('button', {
          class: 'lm-btn lm-btn--sm', type: 'button',
          onclick: () => LM.toast('Criterio registrado. El orientador recibe tu decisión.', { tipo: 'ok' }),
        }, ['Registrar criterio']),
      ]),
    ]));
  });

  if (!pendientes.length) {
    cont.innerHTML = `<div class="lm-empty"><img src="img/lumys-mascota.svg" alt="">
      <h3>Nada pendiente de revisión</h3>
      <p class="lm-muted">Los casos activos siguen con el orientador.</p></div>`;
  }
};

/* ==========================================================================
   Panel institucional
   ========================================================================== */
App.controladores.institucional = async (raiz) => {
  const { qs, el } = LM;
  const [datos, comunidad] = await Promise.all([API.institucional(), API.comunitario()]);

  /* --- Indicadores --------------------------------------------------------- */
  const cont = qs('#kpis', raiz);
  cont.innerHTML = '';
  datos.kpis.forEach((k) => {
    const valor = el('span', { class: 'lm-stat__value', text: '0' });
    cont.append(el('div', { class: 'lm-stat' }, [
      valor,
      el('span', { class: 'lm-stat__label', text: k.etiqueta }),
      el('span', { class: 'lm-stat__delta lm-stat__delta--up', text: k.delta }),
    ]));
    LM.contar(valor, k.valor, { sufijo: k.sufijo || '' });
  });

  /* --- Distribución por nivel ---------------------------------------------- */
  const niveles = qs('#niveles', raiz);
  niveles.innerHTML = '';
  datos.niveles.forEach((n, i) => {
    niveles.append(el('div', { class: 'lm-bar-row' }, [
      el('span', { class: 'lm-bar-row__label', text: n.etiqueta }),
      el('span', { class: 'lm-bar-row__track' }, [
        el('span', {
          class: `lm-bar-row__fill${i === 2 ? ' lm-bar-row__fill--warm' : ''}`,
          'data-ancho': `${(n.valor / n.max) * 100}%`,
        }),
      ]),
      el('span', { class: 'lm-bar-row__value', text: String(n.valor) }),
    ]));
  });

  /* --- Participación por grado ---------------------------------------------- */
  const grados = qs('#grados', raiz);
  grados.innerHTML = '';
  datos.grados.forEach((g) => {
    grados.append(el('div', { class: 'lm-bar-row' }, [
      el('span', { class: 'lm-bar-row__label', text: g.etiqueta }),
      el('span', { class: 'lm-bar-row__track' }, [
        el('span', { class: 'lm-bar-row__fill', 'data-ancho': `${g.participacion}%` }),
      ]),
      el('span', { class: 'lm-bar-row__value', text: `${g.participacion}%` }),
    ]));
  });

  /* --- Aprendizaje federado -------------------------------------------------- */
  const tabla = qs('#federado', raiz);
  tabla.innerHTML = '';
  comunidad.federado.forEach((f) => {
    tabla.append(el('tr', {}, [
      el('td', { text: f.centro }),
      el('td', {}, [el('span', { class: 'lm-chip lm-chip--neutral', text: f.icve })]),
      el('td', { text: String(f.registros) }),
    ]));
  });

  LM.animarBarras(raiz);
};
