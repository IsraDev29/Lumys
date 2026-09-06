/* ===========================================================================
 * Lumys* — guardia de rutas
 * ---------------------------------------------------------------------------
 * Las dos comprobaciones que hacía `enrutar()` antes de pintar nada:
 *
 *   1. Vista privada sin sesión  → al acceso.
 *   2. Vista fuera del perfil    → al inicio del perfil que sí tiene.
 *
 * La segunda importa más de lo que parece en esta app: un orientador no debe
 * poder abrir la vista de un estudiante ni por accidente ni escribiendo la URL
 * a mano. Que sea una redirección y no un 403 es deliberado — el orientador no
 * hizo nada malo, se equivocó de puerta.
 * =========================================================================== */

import { Navigate, useLocation } from 'react-router-dom';

import { rutaInicial, useSesion } from '../lib/sesion.tsx';
import { RUTAS } from './navegacion.ts';

export function Protegida({ children }: { children: React.ReactElement }) {
  const { usuario } = useSesion();
  const { pathname } = useLocation();

  const ruta = pathname.replace(/^\//, '').split('/')[0] ?? '';
  const def = RUTAS[ruta];

  if (!usuario) return <Navigate to="/acceso" replace state={{ desde: pathname }} />;

  if (def?.perfiles && !def.perfiles.includes(usuario.perfil)) {
    return <Navigate to={rutaInicial(usuario.perfil)} replace />;
  }

  return children;
}
