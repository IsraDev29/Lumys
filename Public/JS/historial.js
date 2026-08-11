/* ==========================================================================
   Lumys* — Huella emocional del estudiante

   Todo el gráfico es ipsativo: la referencia es el promedio del propio
   estudiante, nunca un corte clínico poblacional.
   ========================================================================== */

/** Dibuja un gráfico de líneas en SVG con la banda del promedio propio. */
function graficoLinea(datos, promedio) {
  const W = 720;
  const H = 240;
  const M = { top: 18, right: 16, bottom: 30, left: 16 };
  const ancho = W - M.left - M.right;
  const alto = H - M.top - M.bottom;

  const max = Math.max(...datos.map((d) => d.valor), promedio) * 1.15;
  const x = (i) => M.left + (datos.length === 1 ? ancho / 2 : (i * ancho) / (datos.length - 1));
  const y = (v) => M.top + alto - (v / max) * alto;

  const puntos = datos.map((d, i) => `${x(i)},${y(d.valor)}`).join(' ');
  const area = `M ${x(0)},${M.top + alto} L ${puntos.split(' ').join(' L ')} L ${x(datos.length - 1)},${M.top + alto} Z`;

  const rejilla = [0.25, 0.5, 0.75, 1]
    .map((p) => `<line class="grid" x1="${M.left}" y1="${M.top + alto * p}" x2="${W - M.right}" y2="${M.top + alto * p}"/>`)
    .join('');

  const marcas = datos.map((d, i) => {
    const mostrar = datos.length <= 10 || i % Math.ceil(datos.length / 8) === 0;
    return mostrar
      ? `<text class="label" x="${x(i)}" y="${H - 8}" text-anchor="middle">${LM.diaCorto(d.fecha)}</text>`
      : '';
  }).join('');

  const circulos = datos.map((d, i) =>
    `<circle class="dot${i === datos.length - 1 ? ' dot--hoy' : ''}" cx="${x(i)}" cy="${y(d.valor)}" r="${datos.length > 12 ? 3.5 : 5.5}">
       <title>${LM.fechaCorta(d.fecha)}</title>
     </circle>`).join('');

  return `
    <svg class="lm-linechart" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="Evolución de los últimos ${datos.length} días comparada con tu propio promedio">
      ${rejilla}
      <path class="area" d="${area}"/>
      <polyline class="line" points="${puntos}"/>
      <line class="avg" x1="${M.left}" y1="${y(promedio)}" x2="${W - M.right}" y2="${y(promedio)}"/>
      <text class="label" x="${W - M.right}" y="${y(promedio) - 8}" text-anchor="end"
            style="fill:var(--lm-terracotta); font-weight:600">tu promedio</text>
      ${circulos}
      ${marcas}
    </svg>`;
}

App.controladores.historial = async (raiz) => {
  const { qs, el } = LM;

  const [gemelo, ipsativa, entradas, constancia] = await Promise.all([
    API.gemelo(), API.ipsativa(), API.entradas(), API.constancia(),
  ]);

  /* --- Gráfico con rango seleccionable ------------------------------------ */
  // Para 30 días se reconstruye la serie a partir del registro de constancia,
  // manteniendo los 7 días reales al final.
  const serie30 = constancia.slice(-30).map((d, i) => ({
    fecha: d.fecha,
    valor: Math.round(38 + d.nivel * 13 + Math.abs(Math.sin(i * 0.9)) * 22),
  }));
  serie30.splice(-7, 7, ...gemelo.lineaBase);

  const pintarGrafico = (dias) => {
    const datos = dias === 7 ? gemelo.lineaBase : serie30;
    qs('#grafico', raiz).innerHTML = graficoLinea(datos, gemelo.promedioPropio);
  };

  pintarGrafico(7);

  LM.qsa('#rango .lm-segmented__btn', raiz).forEach((btn) => {
    btn.addEventListener('click', () => {
      LM.qsa('#rango .lm-segmented__btn', raiz).forEach((b) => b.classList.toggle('is-active', b === btn));
      pintarGrafico(Number(btn.dataset.rango));
    });
  });

  /* --- Constancia del mes -------------------------------------------------- */
  const cal = qs('#constancia-mes', raiz);
  cal.innerHTML = '';
  constancia.forEach((d, i) => {
    cal.append(el('div', {
      class: `lm-heatmap__cell${i === constancia.length - 1 ? ' is-hoy' : ''}`,
      'data-nivel': String(d.nivel),
      title: `${LM.fechaCorta(d.fecha)} · ${d.nivel ? 'registraste' : 'sin registro'}`,
      text: String(new Date(d.fecha).getDate()),
    }));
  });

  /* --- Comparativa ipsativa ------------------------------------------------- */
  const cont = qs('#ipsativa-historial', raiz);
  cont.innerHTML = '';
  ipsativa.forEach((item) => {
    cont.append(el('div', { class: 'lm-ipsativa__item' }, [
      el('i', { class: `bi ${item.icono} lm-ipsativa__icon` }),
      el('p', { class: 'lm-ipsativa__value mb-0 mt-2', text: item.valor }),
      el('p', { class: 'lm-caption mb-1', text: item.etiqueta }),
      el('p', { class: 'lm-ipsativa__delta mb-0', text: item.delta }),
    ]));
  });

  /* --- Diario ---------------------------------------------------------------- */
  // Se muestran primero los check-ins hechos en esta sesión.
  const propios = LM.store.get('checkins', [])
    .filter((c) => c.texto_usuario)
    .map((c) => ({ fecha: c.fecha, animo: c.emocion, texto: c.texto_usuario, etiquetas: ['tuyo'] }));

  const lista = [...propios, ...entradas];
  const contEntradas = qs('#entradas', raiz);
  contEntradas.innerHTML = '';

  if (!lista.length) {
    contEntradas.innerHTML = `<div class="lm-empty"><img src="img/lumys-mascota.svg" alt="">
      <h3>Todavía no escribiste nada</h3>
      <p class="lm-muted">Cuando quieras contar algo, va a quedar acá — solo para vos.</p>
      <a class="lm-btn mt-3" href="#/checkin">Hacer mi check-in</a></div>`;
    return;
  }

  const ANIMOS = { bien: '🙂', normal: '😐', pesado: '😮‍💨', nose: '🤷' };

  lista.forEach((e) => {
    contEntradas.append(el('article', { class: 'lm-entry' }, [
      el('div', { class: 'lm-entry__head' }, [
        el('span', { class: 'lm-avatar', text: ANIMOS[e.animo] || '·' }),
        el('div', {}, [
          el('p', { class: 'lm-entry__date mb-0', text: LM.fechaLarga(e.fecha) }),
          el('p', { class: 'lm-caption mb-0', text: LM.haceCuanto(e.fecha) }),
        ]),
      ]),
      el('p', { class: 'lm-entry__text', text: e.texto }),
      el('div', { class: 'lm-entry__tags' },
        (e.etiquetas || []).map((t) => el('span', { class: 'lm-chip lm-chip--neutral', text: t }))),
    ]));
  });
};
