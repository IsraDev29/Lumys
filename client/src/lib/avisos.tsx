/* ===========================================================================
 * Lumys* — avisos emergentes
 * ---------------------------------------------------------------------------
 * El `LM.toast()` de antes creaba el contenedor en el `body` la primera vez que
 * se lo llamaba y se colgaba de `animationend` para quitarse. Acá es una lista
 * en estado: el aviso entra, a los N milisegundos se marca como saliente, y se
 * borra de verdad cuando termina la animación de salida.
 *
 * La región tiene `aria-live="polite"`: los avisos se anuncian sin interrumpir
 * lo que el lector de pantalla esté leyendo.
 * =========================================================================== */

import {
  createContext, use, useCallback, useMemo, useRef, useState, type ReactNode,
} from 'react';

export type TipoAviso = 'info' | 'ok' | 'logro' | 'aviso';

const ICONOS: Record<TipoAviso, string> = {
  info: 'bi-info-circle',
  ok: 'bi-check-circle',
  logro: 'bi-stars',
  aviso: 'bi-bell',
};

type Aviso = {
  id: number;
  mensaje: string;
  tipo: TipoAviso;
  icono: string;
  saliendo: boolean;
};

export type OpcionesAviso = { tipo?: TipoAviso; icono?: string; duracion?: number };

type ContextoAvisos = (mensaje: string, opciones?: OpcionesAviso) => void;

const Avisos = createContext<ContextoAvisos | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const siguienteId = useRef(0);

  const mostrar = useCallback<ContextoAvisos>((mensaje, opciones = {}) => {
    const { tipo = 'info', icono, duracion = 3600 } = opciones;
    const id = siguienteId.current++;

    setAvisos((previos) => [...previos, {
      id, mensaje, tipo, icono: icono ?? ICONOS[tipo], saliendo: false,
    }]);

    setTimeout(() => {
      setAvisos((previos) => previos.map((a) => (a.id === id ? { ...a, saliendo: true } : a)));
    }, duracion);
  }, []);

  const quitar = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((a) => a.id !== id));
  }, []);

  const valor = useMemo(() => mostrar, [mostrar]);

  return (
    <Avisos value={valor}>
      {children}
      <div className="lm-toasts" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`lm-toast${a.tipo === 'logro' ? ' lm-toast--logro' : ''}${a.saliendo ? ' is-out' : ''}`}
            onAnimationEnd={() => { if (a.saliendo) quitar(a.id); }}
          >
            <i className={`bi ${a.icono}`} aria-hidden="true" />
            <span>{a.mensaje}</span>
          </div>
        ))}
      </div>
    </Avisos>
  );
}

export function useAvisos(): ContextoAvisos {
  const ctx = use(Avisos);
  if (!ctx) throw new Error('useAvisos se usó fuera de <ProveedorAvisos>');
  return ctx;
}
