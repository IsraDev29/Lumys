/* ===========================================================================
 * Lumys* — almacenamiento local
 * ---------------------------------------------------------------------------
 * Todo va bajo el prefijo `lumys:` para no chocar con nada más del origen, y
 * todo va envuelto en try/catch: en modo privado de Safari `localStorage`
 * existe pero lanza al escribir. Que la app se caiga por no poder guardar una
 * preferencia sería peor que perder la preferencia.
 * =========================================================================== */

const PREFIJO = 'lumys:';

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const crudo = localStorage.getItem(PREFIJO + clave);
    return crudo ? (JSON.parse(crudo) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

export function guardar<T>(clave: string, valor: T): T {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* modo privado: se pierde la escritura, no la sesión */
  }
  return valor;
}

export function borrar(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch {
    /* modo privado */
  }
}
