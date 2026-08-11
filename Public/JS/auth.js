/* ==========================================================================
   Lumys* — Controlador de la vista de acceso
   ========================================================================== */

App.controladores.acceso = (raiz) => {
  const { qs, qsa } = LM;

  /* --- Pestañas Entrar / Crear cuenta ------------------------------------- */
  const formularios = {
    login: qs('#form-login', raiz),
    registro: qs('#form-registro', raiz),
  };

  qsa('.lm-segmented__btn', raiz).forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('.lm-segmented__btn', raiz).forEach((b) => {
        const activo = b === btn;
        b.classList.toggle('is-active', activo);
        b.setAttribute('aria-selected', String(activo));
      });
      Object.entries(formularios).forEach(([nombre, form]) => {
        form.classList.toggle('d-none', nombre !== btn.dataset.panel);
      });
    });
  });

  /* --- Mostrar / ocultar contraseña --------------------------------------- */
  qsa('[data-ver-clave]', raiz).forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = qs(`#${btn.dataset.verClave}`, raiz);
      const oculto = input.type === 'password';
      input.type = oculto ? 'text' : 'password';
      btn.querySelector('i').className = oculto ? 'bi bi-eye-slash' : 'bi bi-eye';
      btn.setAttribute('aria-label', oculto ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  /* --- Validación ---------------------------------------------------------- */
  function marcarError(id, mensaje) {
    const nodo = qs(`[data-error-de="${id}"]`, raiz);
    if (!nodo) return;
    nodo.textContent = mensaje || '';
    nodo.classList.toggle('d-none', !mensaje);
    const campo = qs(`#${id}`, raiz);
    if (campo) campo.style.borderColor = mensaje ? 'var(--lm-nivel-3)' : '';
  }

  const limpiarErrores = (form) =>
    qsa('.lm-error', form).forEach((n) => { n.classList.add('d-none'); n.textContent = ''; });

  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

  function ocupado(boton, activo, textoOriginal) {
    boton.disabled = activo;
    boton.innerHTML = activo
      ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Un segundo…'
      : textoOriginal;
  }

  /* --- Entrar --------------------------------------------------------------- */
  formularios.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formularios.login);

    const email = qs('#login-email', raiz).value.trim();
    const password = qs('#login-password', raiz).value;
    let ok = true;

    if (!emailValido(email)) { marcarError('login-email', 'Escribí un correo válido.'); ok = false; }
    if (password.length < 1) { marcarError('login-password', 'Falta tu contraseña.'); ok = false; }
    if (!ok) return;

    const boton = formularios.login.querySelector('button[type="submit"]');
    const original = boton.innerHTML;
    ocupado(boton, true, original);

    try {
      const res = await API.login(email, password);
      if (res.token) API.token.set(res.token);

      // El backend todavía no devuelve el perfil en todos los casos:
      // se deduce del correo para que la demostración siga siendo navegable.
      const perfil = res.usuario?.tipoUsuario?.toLowerCase?.()
        || (/orienta/.test(email) ? 'orientador'
          : /psico/.test(email) ? 'psicologo'
            : /admin|lumys/.test(email) ? 'admin' : 'estudiante');

      const base = API.perfilesDemo()[perfil] || API.perfilesDemo().estudiante;
      App.sesion.set({ ...base, email });
      location.hash = `#/${App.rutaInicial(perfil)}`;
      LM.toast(`Hola de nuevo, ${base.nombre.split(' ')[0]}`, { tipo: 'ok' });
    } catch (err) {
      marcarError('login-password', err.message || 'No pudimos entrar. Probá de nuevo.');
      ocupado(boton, false, original);
    }
  });

  /* --- Crear cuenta ---------------------------------------------------------- */
  formularios.registro.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formularios.registro);

    const nombre = qs('#reg-nombre', raiz).value.trim();
    const email = qs('#reg-email', raiz).value.trim();
    const edad = qs('#reg-edad', raiz).value;
    const password = qs('#reg-password', raiz).value;
    const consentimiento = qs('#reg-consentimiento', raiz).checked;
    const perfil = qs('input[name="perfil"]:checked', raiz).value;

    let ok = true;
    if (nombre.length < 2) { marcarError('reg-nombre', 'Escribí cómo querés que te llamemos.'); ok = false; }
    if (!emailValido(email)) { marcarError('reg-email', 'Escribí un correo válido.'); ok = false; }
    if (edad && (Number(edad) < 12 || Number(edad) > 80)) { marcarError('reg-edad', 'Poné una edad entre 12 y 80.'); ok = false; }
    if (password.length < 8) { marcarError('reg-password', 'La contraseña necesita al menos 8 caracteres.'); ok = false; }
    if (!consentimiento) { marcarError('reg-consentimiento', 'Necesitamos que confirmes esto para seguir.'); ok = false; }
    if (!ok) return;

    const boton = formularios.registro.querySelector('button[type="submit"]');
    const original = boton.innerHTML;
    ocupado(boton, true, original);

    try {
      await API.registrar({
        email,
        nombre,
        password,
        edad: edad ? Number(edad) : undefined,
        tipoUsuario: perfil === 'estudiante' ? 'Estudiante' : 'Docente',
        consentimiento: true,
      });

      const base = API.perfilesDemo()[perfil] || API.perfilesDemo().estudiante;
      App.sesion.set({ ...base, nombre, email });
      location.hash = `#/${App.rutaInicial(perfil)}`;
      LM.toast('Tu cuenta está lista. Empezá cuando querás.', { tipo: 'logro' });
    } catch (err) {
      marcarError('reg-email', err.message || 'No pudimos crear la cuenta.');
      ocupado(boton, false, original);
    }
  });
};
