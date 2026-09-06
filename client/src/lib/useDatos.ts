/* ===========================================================================
 * Lumys* — carga de datos
 * ---------------------------------------------------------------------------
 * Cada controlador de la versión anterior repetía el mismo bloque: pintar el
 * cargador, pedir, pintar el resultado, y atrapar el error para que un fallo
 * no dejara la vista en blanco. Acá está una sola vez.
 *
 * El indicador `activo` no es decorativo: sin él, un estudiante que abre una
 * vista y navega antes de que responda el servidor provocaría un `setState`
 * sobre un componente ya desmontado.
 * =========================================================================== */

import { useEffect, useState } from 'react';

export type EstadoDatos<T> = {
  datos: T | null;
  cargando: boolean;
  error: Error | null;
};

export function useDatos<T>(
  cargar: () => Promise<T>,
  deps: readonly unknown[] = [],
): EstadoDatos<T> {
  const [estado, setEstado] = useState<EstadoDatos<T>>({
    datos: null, cargando: true, error: null,
  });

  useEffect(() => {
    let activo = true;
    setEstado({ datos: null, cargando: true, error: null });

    cargar().then(
      (datos) => { if (activo) setEstado({ datos, cargando: false, error: null }); },
      (error: Error) => { if (activo) setEstado({ datos: null, cargando: false, error }); },
    );

    return () => { activo = false; };
    // La función `cargar` se redefine en cada render de la vista que la usa;
    // meterla en las dependencias dispararía un bucle. Lo que gobierna la
    // recarga es `deps`, que la vista declara explícitamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return estado;
}
