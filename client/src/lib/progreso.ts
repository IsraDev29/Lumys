/* ===========================================================================
 * Lumys* — lo que el estudiante hizo, contado en su propio teléfono
 * ---------------------------------------------------------------------------
 * Dos insignias —"Respiro" y "Cápsulas"— se ganan haciendo cosas que el backend
 * no registra: abrir un ejercicio de respiración y terminarlo, ver una cápsula.
 * Hasta ahora aparecían como obtenidas o no según una lista fija de `demo.ts`,
 * lo que significa que la insignia se mostraba ganada sin haber hecho nada.
 *
 * Estos contadores no viajan a ningún lado. Son actividad, no estado emocional:
 * cuántas veces respiraste no le dice nada a nadie sobre cómo estás, y mandarlo
 * al servidor solo agregaría un dato personal más que custodiar sin ganar nada.
 * Si el día de mañana la constancia tiene que sobrevivir a un cambio de
 * teléfono, entonces sí hay endpoint; hoy no lo hay y esto es real igual.
 * =========================================================================== */

import * as almacen from './almacen.ts';

export type Progreso = { respiraciones: number; capsulas: number };

const VACIO: Progreso = { respiraciones: 0, capsulas: 0 };

export const leer = (): Progreso => almacen.leer<Progreso>('progreso', VACIO);

/** Suma uno y devuelve el total. Se llama al COMPLETAR, nunca al abrir. */
export function sumar(que: keyof Progreso): Progreso {
  const actual = leer();
  return almacen.guardar('progreso', { ...actual, [que]: (actual[que] ?? 0) + 1 });
}
