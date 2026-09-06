/* ===========================================================================
 * Lumys* — mapa de rutas y navegación
 * ---------------------------------------------------------------------------
 * Es el `RUTAS` / `NAV` del antiguo app.js, sin la parte de
 * enrutado: de eso ahora se encarga React Router. Lo que queda es lo que sigue
 * siendo datos — qué título lleva cada vista, qué perfiles pueden verla y en
 * qué orden aparece en cada barra.
 * =========================================================================== */

import type { Perfil } from '../lib/tipos.ts';

export type DefinicionRuta = {
  titulo: string;
  sub?: string;
  /** Fuera de la cáscara, sin dock: portada, acceso y manual de marca. */
  publica?: boolean;
  /** Quiénes pueden verla. Ausente en las públicas. */
  perfiles?: Perfil[];
};

export const RUTAS: Record<string, DefinicionRuta> = {
  // Públicas (fuera de la cáscara)
  bienvenida: { publica: true, titulo: 'Lumys*' },
  acceso: { publica: true, titulo: 'Entrar a Lumys*' },
  marca: { publica: true, titulo: 'Mini manual de marca' },

  // Estudiante
  inicio: { perfiles: ['estudiante'], titulo: 'Tu espacio', sub: 'Gemelo digital · clima de hoy' },
  checkin: { perfiles: ['estudiante'], titulo: 'Check-in de hoy', sub: 'Menos de un minuto' },
  historial: { perfiles: ['estudiante'], titulo: 'Tu huella', sub: 'Comparada contigo mismo' },
  red: { perfiles: ['estudiante'], titulo: 'Mi red de confianza', sub: 'Vos decidís quién y cuándo' },
  logros: { perfiles: ['estudiante'], titulo: 'Constancia', sub: 'Se premia aparecer, no el ánimo' },
  respirar: { perfiles: ['estudiante'], titulo: 'Respirar', sub: 'Un minuto, sin apuro' },
  capsulas: { perfiles: ['estudiante'], titulo: 'Cápsulas', sub: 'Cosas cortas que sirven' },

  // Acompañamiento
  orientador: { perfiles: ['orientador'], titulo: 'Casos activos', sub: 'Señales, no diagnósticos' },
  psicologo: { perfiles: ['psicologo'], titulo: 'Supervisión', sub: 'Decidir junto al orientador' },

  // Institución y auditoría
  institucional: { perfiles: ['admin', 'psicologo'], titulo: 'Panel de bienestar', sub: 'Métricas agregadas y anónimas' },
  comunitario: { perfiles: ['admin', 'psicologo', 'orientador'], titulo: 'Gemelo comunitario', sub: 'Nunca una persona: siempre un grupo' },

  // Transversales
  perfil: { perfiles: ['estudiante', 'orientador', 'psicologo', 'admin'], titulo: 'Tu cuenta', sub: 'Qué se comparte y con quién' },
  lab: { perfiles: ['admin'], titulo: 'Banco de emociones', sub: 'Los 33 estados del rig de Lumy' },
};

export type ItemNav = {
  ruta: string;
  /** Icono de Bootstrap Icons. Lo usan las vistas todavía sin portar. */
  icono: string;
  /** Ligadura de Material Symbols: es la iconografía de las pantallas de
   *  Stitch y la que usa el dock inferior. Convive con `icono` mientras queden
   *  vistas heredadas. */
  simbolo: string;
  texto: string;
  /** Etiqueta para la barra inferior. En un teléfono de 360 px cada pestaña
   *  dispone de unos 66 px: "Red de confianza" no entra y se corta a mitad de
   *  palabra. Cuando existe, la barra usa esta; el resto de la navegación sigue
   *  usando `texto`, que es el nombre completo de la vista. */
  corto?: string;
  destacado?: boolean;
  badge?: number;
};

export type GrupoNav = { grupo: string; items: ItemNav[] };

export const NAV: Record<Perfil, GrupoNav[]> = {
  estudiante: [
    { grupo: 'Tu día', items: [
      { ruta: 'inicio', simbolo: 'cottage', icono: 'bi-house-heart', texto: 'Inicio' },
      { ruta: 'checkin', simbolo: 'mood', icono: 'bi-chat-heart', texto: 'Check-in', destacado: true },
      { ruta: 'historial', simbolo: 'auto_graph', icono: 'bi-graph-up', texto: 'Tu huella' },
    ] },
    { grupo: 'Tu gente', items: [
      { ruta: 'red', simbolo: 'group', icono: 'bi-diagram-3', texto: 'Red de confianza', corto: 'Tu red' },
      { ruta: 'capsulas', simbolo: 'collections_bookmark', icono: 'bi-collection-play', texto: 'Cápsulas' },
    ] },
    { grupo: 'Para vos', items: [
      { ruta: 'logros', simbolo: 'military_tech', icono: 'bi-stars', texto: 'Constancia' },
      { ruta: 'respirar', simbolo: 'mindfulness', icono: 'bi-wind', texto: 'Respirar' },
      { ruta: 'perfil', simbolo: 'account_circle', icono: 'bi-person-gear', texto: 'Tu cuenta' },
    ] },
  ],
  orientador: [
    { grupo: 'Acompañamiento', items: [
      { ruta: 'orientador', simbolo: 'clinical_notes', icono: 'bi-clipboard-heart', texto: 'Casos activos', corto: 'Casos', badge: 3 },
      { ruta: 'comunitario', simbolo: 'groups', icono: 'bi-people', texto: 'Clima del centro', corto: 'Clima' },
    ] },
    { grupo: 'Cuenta', items: [
      { ruta: 'perfil', simbolo: 'account_circle', icono: 'bi-person-gear', texto: 'Tu cuenta' },
    ] },
  ],
  psicologo: [
    { grupo: 'Supervisión', items: [
      { ruta: 'psicologo', simbolo: 'shield_person', icono: 'bi-shield-check', texto: 'Casos a revisar', corto: 'Revisar', badge: 2 },
      { ruta: 'comunitario', simbolo: 'groups', icono: 'bi-people', texto: 'Clima del centro', corto: 'Clima' },
      { ruta: 'institucional', simbolo: 'bar_chart', icono: 'bi-bar-chart', texto: 'Panel del centro', corto: 'Panel' },
    ] },
    { grupo: 'Cuenta', items: [
      { ruta: 'perfil', simbolo: 'account_circle', icono: 'bi-person-gear', texto: 'Tu cuenta' },
    ] },
  ],
  admin: [
    { grupo: 'Sistema', items: [
      { ruta: 'institucional', simbolo: 'bar_chart', icono: 'bi-bar-chart', texto: 'Panel institucional', corto: 'Panel' },
      { ruta: 'comunitario', simbolo: 'groups', icono: 'bi-people', texto: 'Gemelo comunitario', corto: 'Comunidad' },
      { ruta: 'lab', simbolo: 'palette', icono: 'bi-palette2', texto: 'Banco de emociones', corto: 'Emociones' },
    ] },
    { grupo: 'Cuenta', items: [
      { ruta: 'perfil', simbolo: 'account_circle', icono: 'bi-person-gear', texto: 'Tu cuenta' },
    ] },
  ],
};

/** Índice ruta → item, para que el dock reuse icono y texto sin declararlos
 *  por segunda vez. */
export const ICONO_RUTA: Record<string, ItemNav> = Object.fromEntries(
  Object.values(NAV).flat().flatMap((g) => g.items).map((i) => [i.ruta, i]),
);
