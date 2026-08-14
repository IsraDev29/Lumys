/* ==========================================================================
   Lumys* — Gemelo digital comunitario y red de confianza
   ========================================================================== */

/** Radar SVG comparando la semana actual con el promedio propio del centro. */
function graficoRadar({ ejes, promedio, actual }) {
  const size = 380;
  const c = size / 2;
  const r = c - 54;
  const n = ejes.length;

  const punto = (valor, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const d = (valor / 100) * r;
    return [c + Math.cos(ang) * d, c + Math.sin(ang) * d];
  };

  const poligono = (datos) => datos.map((v, i) => punto(v, i).join(',')).join(' ');

  const anillos = [0.25, 0.5, 0.75, 1]
    .map((p) => `<circle class="ring" cx="${c}" cy="${c}" r="${r * p}"/>`)
    .join('');

  const radios = ejes.map((_, i) => {
    const [x, y] = punto(100, i);
    return `<line class="spoke" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
  }).join('');

  const etiquetas = ejes.map((eje, i) => {
    const [x, y] = punto(122, i);
    const anclaje = Math.abs(x - c) < 12 ? 'middle' : (x > c ? 'start' : 'end');
    return `<text class="axis-label" x="${x}" y="${y + 4}" text-anchor="${anclaje}">${eje}</text>`;
  }).join('');

  return `
    <svg class="lm-radar" viewBox="0 0 ${size} ${size}" role="img"
         aria-label="Radar del centro comparado con su propio promedio">
      ${anillos}${radios}
      <polygon class="shape-avg" points="${poligono(promedio)}"/>
      <polygon class="shape-now" points="${poligono(actual)}"/>
      ${etiquetas}
    </svg>`;
}

App.controladores.comunitario = async (raiz) => {
  const { qs, el } = LM;
  const datos = await API.comunitario();

  const clima = LM.CLIMAS[datos.clima] || LM.CLIMAS.parcial;
  qs('#gemelo-titular', raiz).textContent = datos.titular;
  qs('#gemelo-estado', raiz).innerHTML = `<i class="bi bi-cloud-sun"></i> ${clima.titulo}`;

  qs('#radar', raiz).innerHTML = graficoRadar(datos.radar);

  const cont = qs('#grupos', raiz);
  cont.innerHTML = '';
  datos.grupos.forEach((g) => {
    const oculto = g.clima === 'oculto';
    cont.append(el('div', { class: `lm-grupo${oculto ? ' lm-grupo--oculto' : ''}` }, [
      el('span', { class: 'lm-grupo__dot', 'data-clima': oculto ? 'nublado' : g.clima }),
      el('div', {}, [
        el('p', { class: 'lm-grupo__name mb-0', text: g.nombre }),
        el('p', { class: 'lm-grupo__meta mb-0', text: g.nota }),
      ]),
      el('div', { class: 'lm-grupo__side' }, [
        oculto
          ? el('span', { class: 'lm-chip lm-chip--neutral', text: 'sin datos' })
          : el('span', { class: 'lm-chip', text: `${g.registros} registros` }),
      ]),
    ]));
  });
};

/* ==========================================================================
   Mi red de confianza
   ========================================================================== */
App.controladores.red = async (raiz) => {
  const { qs, el } = LM;
  let contactos = await API.redApoyo();

  const lista = qs('#red-lista', raiz);

  function guardar() {
    contactos = contactos
      .sort((a, b) => a.orden - b.orden)
      .map((c, i) => ({ ...c, orden: i + 1 }));
    API.guardarRedApoyo(contactos);
    pintar();
  }

  function pintar() {
    lista.innerHTML = '';

    contactos.forEach((c, i) => {
      lista.append(el('div', { class: `lm-contacto${c.excluido ? ' is-excluido' : ''}` }, [
        el('span', { class: c.excluido ? 'lm-orden' : 'lm-orden', style: c.excluido ? 'background:var(--lm-line-strong)' : '', text: c.excluido ? '—' : String(i + 1) }),
        el('span', { class: `lm-avatar${c.excluido ? '' : ' lm-avatar--warm'}`, text: LM.iniciales(c.nombre) }),
        el('div', { class: 'lm-contacto__info' }, [
          el('p', { class: 'lm-contacto__name mb-0', text: c.nombre }),
          el('p', { class: 'lm-contacto__rel mb-0', text: `${c.relacion} · ${c.excluido ? 'no recibe avisos' : c.canal}` }),
        ]),
        el('div', { class: 'lm-contacto__actions' }, [
          el('label', { class: 'lm-switch', title: c.excluido ? 'Volver a incluir' : 'Excluir de los avisos' }, [
            el('input', {
              type: 'checkbox',
              checked: !c.excluido,
              'aria-label': `${c.excluido ? 'Incluir a' : 'Excluir a'} ${c.nombre}`,
              onchange: (e) => {
                c.excluido = !e.target.checked;
                LM.toast(c.excluido
                  ? `${c.nombre.split(' ')[0]} ya no va a recibir avisos.`
                  : `${c.nombre.split(' ')[0]} vuelve a tu red.`, { tipo: 'ok' });
                guardar();
              },
            }),
            el('span', { class: 'lm-switch__track' }),
          ]),
        ]),
      ]));
    });

    if (!contactos.length) {
      lista.innerHTML = `<div class="lm-empty"><img src="img/lumys-mascota.svg" alt="">
        <h3>Todavía no armaste tu red</h3>
        <p class="lm-muted">Agregá al menos a una persona con la que te sientas tranquilo hablando.</p></div>`;
    }
  }

  pintar();

  /* --- Agregar contacto ---------------------------------------------------- */
  const modalNodo = qs('#modal-contacto', raiz);
  const modal = window.bootstrap ? new bootstrap.Modal(modalNodo) : null;

  qs('#red-agregar', raiz).addEventListener('click', () => modal?.show());

  qs('#contacto-guardar', raiz).addEventListener('click', () => {
    const nombre = qs('#contacto-nombre', raiz).value.trim();
    const relacion = qs('#contacto-relacion', raiz).value.trim();

    if (nombre.length < 2) {
      LM.toast('Escribí al menos el nombre.', { tipo: 'aviso' });
      return;
    }

    contactos.push({
      id: `c${Date.now()}`,
      nombre,
      relacion: relacion || 'Persona de confianza',
      orden: contactos.length + 1,
      excluido: false,
      canal: 'WhatsApp',
    });

    qs('#contacto-nombre', raiz).value = '';
    qs('#contacto-relacion', raiz).value = '';
    modal?.hide();
    guardar();
    LM.toast(`${nombre.split(' ')[0]} está en tu red.`, { tipo: 'logro' });
  });
};
