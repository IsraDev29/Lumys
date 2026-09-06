/* ===========================================================================
 * Lumys* — sesión
 * ---------------------------------------------------------------------------
 * Antes esto era `App.sesion`, un objeto suelto que leía y escribía
 * localStorage y del que cualquier controlador tiraba cuando le hacía falta.
 * Como contexto, el árbol entero ve el mismo usuario y las vistas se
 * re-renderizan solas cuando cambia — que es justo lo que en la versión de
 * antes había que provocar a mano volviendo a llamar al enrutador.
 * =========================================================================== */

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import * as almacen from './almacen.ts';
import * as api from './api.ts';
import type { Perfil, Usuario } from './tipos.ts';

export type ContextoSesion = {
  usuario: Usuario | null;
  entrar(usuario: Usuario): void;
  /** Cambio rápido de perfil, solo para la demostración del hackathon. */
  entrarComo(perfil: Perfil): Usuario | null;
  salir(): void;
};

const Sesion = createContext<ContextoSesion | null>(null);

/** A dónde va cada perfil al entrar. */
export const rutaInicial = (perfil: Perfil | undefined): string => ({
  estudiante: '/inicio',
  orientador: '/orientador',
  psicologo: '/psicologo',
  admin: '/institucional',
}[perfil ?? 'estudiante'] ?? '/inicio');

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(
    () => almacen.leer<Usuario | null>('sesion', null),
  );

  const entrar = useCallback((u: Usuario) => {
    almacen.guardar('sesion', u);
    setUsuario(u);
  }, []);

  const entrarComo = useCallback((perfil: Perfil) => {
    const u = api.perfilesDemo()[perfil];
    if (!u) return null;
    almacen.guardar('sesion', u);
    setUsuario(u);
    return u;
  }, []);

  const salir = useCallback(() => {
    almacen.borrar('sesion');
    api.token.clear();
    setUsuario(null);
  }, []);

  const valor = useMemo<ContextoSesion>(
    () => ({ usuario, entrar, entrarComo, salir }),
    [usuario, entrar, entrarComo, salir],
  );

  return <Sesion value={valor}>{children}</Sesion>;
}

export function useSesion(): ContextoSesion {
  const ctx = use(Sesion);
  if (!ctx) throw new Error('useSesion se usó fuera de <ProveedorSesion>');
  return ctx;
}
