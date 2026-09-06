/* ===========================================================================
 * Lumys* — cartel de "sin conexión"
 * ---------------------------------------------------------------------------
 * Era el único trozo de interfaz que vivía dentro de pwa.js, creando un div a
 * mano y escribiéndole 300 caracteres de estilos en línea. Acá es un
 * componente y los estilos son una clase (`lm-offline` en components.css).
 *
 * Lo que dice sigue siendo lo importante: no anuncia que no hay internet,
 * anuncia que el check-in se puede hacer igual. Es la diferencia entre
 * informar de una falla y decirle a un estudiante que su parte ya cuenta.
 * =========================================================================== */

import { useEffect, useState } from 'react';

export function AvisoConexion() {
  const [enLinea, setEnLinea] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const conectado = () => setEnLinea(true);
    const desconectado = () => setEnLinea(false);
    window.addEventListener('online', conectado);
    window.addEventListener('offline', desconectado);
    return () => {
      window.removeEventListener('online', conectado);
      window.removeEventListener('offline', desconectado);
    };
  }, []);

  if (enLinea) return null;

  return (
    <div className="lm-offline" role="status">
      <i className="bi bi-wifi-off" aria-hidden="true" />
      <span>Sin conexión · tu check-in se guarda y se envía solo</span>
    </div>
  );
}
