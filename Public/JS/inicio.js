/* ==========================================================================
   Lumys* — Vistas del estudiante: inicio, constancia, respirar, cápsulas y cuenta
   ========================================================================== */

const Estudiante = (() => {
  const { el, qs } = LM;

  /** Barras de la línea base con la línea punteada del promedio propio. */
  function pintarLineaBase(cont, datos, promedio) {
    const max = Math.max(...datos.map((d) => d.valor), promedio) * 1.12;

    const dibujar = () => {
      cont.innerHTML = '';
      datos.forEach((d, i) => {
        const esHoy = i === datos.length - 1;
        const bajo = d.valor < promedio * 0.7;
        cont.append(el('div', { class: 'lm-baseline__col' }, [
          el('div', {
            class: `lm-baseline__bar${esHoy ? ' lm-baseline__bar--hoy' : ''}${bajo && !esHoy ? ' lm-baseline__bar--bajo' : ''}`,
            title: `${LM.fechaCorta(d.fecha)} · ${esHoy ? 'hoy' : LM.haceCuanto(d.fecha)}`,
            tabindex: '0',
            role: 'img',
            'aria-label': `${LM.fechaCorta(d.fecha)}: ${d.valor > promedio ? 'por encima' : 'por debajo'} de tu propio promedio`,
          }),
          el('span', { class: 'lm-baseline__day', text: LM.diaCorto(d.fecha) }),
        ]));
      });

      // El alto se calcula en píxeles para que la línea del promedio caiga
      // exactamente sobre las barras, sin depender del alto de las etiquetas.
      const etiqueta = cont.querySelector('.lm-baseline__day');
      const reserva = (etiqueta?.offsetHeight || 16) + 8;
      const util = Math.max(cont.clientHeight - reserva - 12, 40);

      cont.querySelectorAll('.lm-baseline__bar').forEach((barra, i) => {
        barra.dataset.alto = `${Math.max((datos[i].valor / max) * util, 8)}px`;
      });

      // La referencia es siempre el propio estudiante
      cont.append(el('div', {
        class: 'lm-baseline__avg',
        style: `bottom:${reserva + (promedio / max) * util}px`,
      }, [el('span', { text: 'tu promedio' })]));

      LM.animarBarras(cont);
    };

    dibujar();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(LM.debounce(() => {
        if (!cont.isConnected) { ro.disconnect(); return; }
        dibujar();
      }, 200));
      ro.observe(cont);
    }
  }

  function pintarCapsulas(cont, capsulas) {
    cont.innerHTML = '';
    capsulas.forEach((c) => {
      cont.append(el('article', {
        class: `lm-capsula${c.tono === 'calido' ? ' lm-capsula--warm' : ''}`,
        tabindex: '0',
        role: 'button',
        onclick: () => LM.toast('Las cápsulas en video llegan en la Fase 3 del roadmap.', { tipo: 'info' }),
      }, [
        el('span', { class: 'lm-capsula__tag', text: c.tag }),
        el('h3', { class: 'lm-capsula__title', text: c.titulo }),
        el('span', { class: 'lm-capsula__meta', text: `${c.duracion} · sin sermón` }),
      ]));
    });
  }

  return { pintarLineaBase, pintarCapsulas };
})();

/* ==========================================================================
   Inicio
   ========================================================================== */
App.controladores.inicio = async (raiz, { usuario }) => {
  const { qs } = LM;

  qs('#saludo-nombre', raiz).textContent = `${LM.saludo()}, ${usuario.nombre.split(' ')[0]}`;
  qs('#saludo-fecha', raiz).textContent = LM.fechaLarga();

  const [gemelo, ipsativa, capsulas] = await Promise.all([
    API.gemelo(), API.ipsativa(), API.capsulas(),
  ]);

  const clima = LM.CLIMAS[gemelo.clima] || LM.CLIMAS.parcial;
  qs('#clima-orb', raiz).dataset.clima = gemelo.clima;
  qs('#clima-titulo', raiz).textContent = clima.titulo;
  qs('#clima-sub', raiz).textContent = clima.sub;

  LM.contar(qs('#stat-racha', raiz), gemelo.racha);
  LM.contar(qs('#stat-insignias', raiz), gemelo.insignias);
  qs('#lumy-mensaje', raiz).textContent = gemelo.mensaje;

  Estudiante.pintarLineaBase(qs('#baseline', raiz), gemelo.lineaBase, gemelo.promedioPropio);

  // Comparativa ipsativa
  const contIps = qs('#ipsativa', raiz);
  contIps.innerHTML = '';
  ipsativa.forEach((item) => {
    contIps.append(LM.el('div', { class: 'lm-ipsativa__item' }, [
      LM.el('i', { class: `bi ${item.icono} lm-ipsativa__icon` }),
      LM.el('p', { class: 'lm-ipsativa__value mb-0 mt-2', text: item.valor }),
      LM.el('p', { class: 'lm-caption mb-1', text: item.etiqueta }),
      LM.el('p', { class: 'lm-ipsativa__delta mb-0', text: item.delta }),
    ]));
  });

  Estudiante.pintarCapsulas(qs('#capsulas-inicio', raiz), capsulas.slice(0, 4));

  // Si ya hizo el check-in de hoy, la tarjeta cambia de tono
  const hechoHoy = (LM.store.get('checkins', [])[0]?.fecha || '').slice(0, 10) === new Date().toISOString().slice(0, 10);
  if (hechoHoy) {
    qs('#lumy-mensaje', raiz).textContent = 'Ya apareciste hoy. Con eso basta — nos vemos mañana.';
    const btn = qs('#btn-checkin', raiz);
    btn.classList.add('lm-btn--ghost');
    btn.innerHTML = '<i class="bi bi-check2-circle"></i> Check-in de hoy completado';
  }
};

/* ==========================================================================
   Constancia (rachas e insignias)
   ========================================================================== */
App.controladores.logros = async (raiz) => {
  const { qs, el } = LM;

  const [gemelo, insignias, constancia] = await Promise.all([
    API.gemelo(), API.insignias(), API.constancia(),
  ]);

  qs('#racha-num', raiz).textContent = gemelo.racha;
  LM.contar(qs('#logros-total', raiz), insignias.filter((i) => i.obtenida).length);

  const grid = qs('#insignias', raiz);
  grid.innerHTML = '';
  insignias.forEach((ins) => {
    grid.append(el('div', { class: `lm-badge-logro${ins.obtenida ? '' : ' lm-badge-logro--locked'}` }, [
      el('span', { class: 'lm-badge-logro__ring' }, [el('i', { class: `bi ${ins.obtenida ? ins.icono : 'bi-lock'}` })]),
      el('span', { class: 'lm-badge-logro__name', text: ins.nombre }),
      el('span', { class: 'lm-caption', text: ins.detalle }),
    ]));
  });

  // Calendario de constancia: mide aparecer, nunca el ánimo
  const cal = qs('#constancia', raiz);
  cal.innerHTML = '';
  constancia.forEach((d, i) => {
    const fecha = new Date(d.fecha);
    cal.append(el('div', {
      class: `lm-heatmap__cell${i === constancia.length - 1 ? ' is-hoy' : ''}`,
      'data-nivel': String(d.nivel),
      title: `${LM.fechaCorta(d.fecha)} · ${d.nivel ? 'registraste' : 'sin registro'}`,
      text: String(fecha.getDate()),
    }));
  });
};

/* ==========================================================================
   Respiración guiada
   ========================================================================== */
App.controladores.respirar = (raiz) => {
  const { qs } = LM;
  const orbe = qs('#orbe', raiz);
  const etiqueta = qs('#respiro-label', raiz);
  const cuenta = qs('#respiro-count', raiz);
  const boton = qs('#respiro-btn', raiz);
  const ciclosNodo = qs('#respiro-ciclos', raiz);

  // Ritmo 4-4-6: inhalar, sostener, exhalar
  const FASES = [
    { clase: 'is-inhale', texto: 'Inhalá', segundos: 4 },
    { clase: 'is-hold', texto: 'Sostené', segundos: 4 },
    { clase: 'is-exhale', texto: 'Exhalá', segundos: 6 },
  ];

  let intervalo = null;
  let corriendo = false;
  let ciclos = 0;

  function detener() {
    clearInterval(intervalo);
    corriendo = false;
    orbe.className = 'lm-breath__orb';
    etiqueta.textContent = 'Listo cuando vos querás';
    cuenta.textContent = '';
    boton.innerHTML = '<i class="bi bi-play-fill"></i> Empezar';
    boton.classList.remove('lm-btn--ghost');
  }

  function correr() {
    corriendo = true;
    boton.innerHTML = '<i class="bi bi-pause-fill"></i> Parar';
    boton.classList.add('lm-btn--ghost');

    let fase = 0;
    let restante = FASES[0].segundos;

    const aplicar = () => {
      const f = FASES[fase];
      orbe.className = `lm-breath__orb ${f.clase}`;
      etiqueta.textContent = f.texto;
      cuenta.textContent = restante;
    };

    aplicar();
    intervalo = setInterval(() => {
      restante -= 1;
      if (restante <= 0) {
        fase = (fase + 1) % FASES.length;
        if (fase === 0) {
          ciclos += 1;
          ciclosNodo.textContent = ciclos;
          if (ciclos === 4) LM.toast('Cuatro rondas completas. Eso ya cuenta.', { tipo: 'logro' });
        }
        restante = FASES[fase].segundos;
      }
      aplicar();
    }, 1000);
  }

  boton.addEventListener('click', () => (corriendo ? detener() : correr()));
  detener();

  // Al cambiar de vista se corta el temporizador
  window.addEventListener('hashchange', () => clearInterval(intervalo), { once: true });
};

/* ==========================================================================
   Cápsulas
   ========================================================================== */
App.controladores.capsulas = async (raiz) => {
  const capsulas = await API.capsulas();
  Estudiante.pintarCapsulas(LM.qs('#capsulas-todas', raiz), [...capsulas, ...capsulas]);
};

/* ==========================================================================
   Cuenta y privacidad
   ========================================================================== */
App.controladores.perfil = async (raiz, { usuario }) => {
  const { qs, qsa } = LM;

  qs('#perfil-nombre', raiz).textContent = usuario.nombre;
  qs('#perfil-rol', raiz).textContent = `${LM.capitalizar(usuario.perfil)}${usuario.grado ? ` · ${usuario.grado}` : ''}`;
  qs('#perfil-centro', raiz).textContent = usuario.centro || '—';
  qs('#perfil-avatar', raiz).textContent = LM.iniciales(usuario.nombre);

  // Preferencias de privacidad: se guardan localmente hasta que el módulo exista
  const prefs = LM.store.get('privacidad', { resumen: true, familia: false, recordatorio: true });
  qsa('[data-pref]', raiz).forEach((input) => {
    input.checked = Boolean(prefs[input.dataset.pref]);
    input.addEventListener('change', () => {
      prefs[input.dataset.pref] = input.checked;
      LM.store.set('privacidad', prefs);
      LM.toast('Guardado. Podés cambiarlo cuando querás.', { tipo: 'ok' });
    });
  });

  qs('#perfil-borrar', raiz)?.addEventListener('click', () => {
    LM.store.remove('checkins');
    LM.toast('Borramos tus check-ins de este dispositivo.', { tipo: 'ok' });
  });
};
