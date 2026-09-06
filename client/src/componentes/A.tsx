/* ===========================================================================
 * Lumys* — enlace
 * ---------------------------------------------------------------------------
 * Un solo componente que decide qué clase de enlace hace falta:
 *
 *   href="#/acceso"        → navegación de la app  (<Link to="/acceso">)
 *   href="/acceso"         → ídem
 *   href="#como-funciona"  → ancla dentro de la página (<a>, la resuelve el
 *                            navegador y hace su desplazamiento suave)
 *   href="https://…"       → externo (<a> con rel de seguridad)
 *
 * Existe porque las vistas venían del HTML anterior con enlaces `#/ruta`, y
 * reescribir cada uno a mano durante la migración era la forma más fácil de
 * romper uno sin notarlo. Con esto los `href` originales siguen siendo válidos
 * y aun así navegan por el enrutador, sin recargar la página.
 * =========================================================================== */

import { Link } from 'react-router-dom';
import type { AnchorHTMLAttributes } from 'react';

export function A({ href = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith('#/')) return <Link to={href.slice(1)} {...props} />;
  if (href.startsWith('/') && !href.startsWith('//')) return <Link to={href} {...props} />;

  const externo = /^https?:/i.test(href);
  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      {...props}
    />
  );
}
