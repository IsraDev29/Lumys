/* ===========================================================================
 * Lumys* — Tailwind (v3)
 * ---------------------------------------------------------------------------
 * Este archivo NO es una configuración escrita a mano: es el `tailwind.config`
 * que venía embebido en los exports de Stitch, fusionado en uno solo. Se
 * mantiene deliberadamente idéntico —los mismos hex, los mismos rem— porque las
 * pantallas se portan clase por clase y cualquier retoque "de buen gusto" aquí
 * desalinea las 21 a la vez.
 *
 * Por qué v3 y no v4: los mockups se renderizaron con el Play CDN
 * (cdn.tailwindcss.com), que es v3. Entre v3 y v4 cambian la escala de sombras
 * (`shadow-sm` pasa a ser `shadow-xs`), el grosor por defecto de `ring`, el
 * color de borde por defecto y los nombres de degradado. Con v4 habría que
 * reinterpretar 1.125 clases y el resultado ya no sería el de la captura.
 *
 * Preflight va desactivado: la app todavía carga Bootstrap 5.3 y ~3.400 líneas
 * de CSS propio, y el reset global de Tailwind les pasaría por encima. En su
 * lugar, estilos/stitch.css lleva un reset equivalente con alcance `.stitch`,
 * que es la raíz que envuelve cada vista portada.
 * =========================================================================== */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  corePlugins: {
    // Ver la nota de cabecera. El reset equivalente vive en estilos/stitch.css.
    preflight: false,
  },

  theme: {
    extend: {
      colors: {
        // --- Material 3 tal como lo emitió Stitch ---------------------------
        background: '#faf8ff',
        'on-background': '#041845',
        surface: '#faf8ff',
        'surface-dim': '#cfd9ff',
        'surface-bright': '#faf8ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f3ff',
        'surface-container': '#eaedff',
        'surface-container-high': '#e3e7ff',
        'surface-container-highest': '#dbe1ff',
        'surface-variant': '#dbe1ff',
        'surface-tint': '#68529a',
        'on-surface': '#041845',
        'on-surface-variant': '#494550',
        'inverse-surface': '#1d2e5b',
        'inverse-on-surface': '#eef0ff',
        outline: '#7a7581',
        'outline-variant': '#cbc4d1',

        primary: '#68529a',
        'on-primary': '#ffffff',
        'primary-container': '#bda4f3',
        'on-primary-container': '#4d367d',
        'inverse-primary': '#d2bcff',
        'primary-fixed': '#eaddff',
        'primary-fixed-dim': '#d2bcff',
        'on-primary-fixed': '#230752',
        'on-primary-fixed-variant': '#503a80',

        secondary: '#326577',
        'on-secondary': '#ffffff',
        'secondary-container': '#b5e7fd',
        'on-secondary-container': '#37697c',
        'secondary-fixed': '#baeaff',
        'secondary-fixed-dim': '#9ccee3',
        'on-secondary-fixed': '#001f29',
        'on-secondary-fixed-variant': '#154d5f',

        tertiary: '#775a03',
        'on-tertiary': '#ffffff',
        'on-tertiary-container': '#564000',
        'tertiary-fixed': '#ffdf99',
        'tertiary-fixed-dim': '#e8c267',
        'on-tertiary-fixed': '#251a00',
        'on-tertiary-fixed-variant': '#5a4300',

        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // --- Alias de marca que usa la landing ------------------------------
        'brand-violet': '#bda4f3',
        'brand-yellow': '#ffd77a',
        'secondary-sky': '#aee0f6',

        /* `primary-tint` aparece dos veces en el panel profesional pero ningún
           export de Stitch lo declara: en el mockup se renderizó sin color. Se
           fija aquí al lavanda más claro de la paleta, que es lo que el resto
           de la pantalla usa para ese mismo papel. */
        'primary-tint': '#f2ecfe',

        /* Único token en el que los exports se contradicen: la landing lo pinta
           con el amarillo sol (#ffd77a) y las otras veinte con el oro apagado
           (#d1ac54). En vez de elegir uno y romper la mitad, viaja por variable
           CSS —ver estilos/stitch.css— para que `.stitch-landing` lo cambie sin
           duplicar la paleta. El formato `rgb(... / <alpha-value>)` es lo que
           mantiene vivos los modificadores de opacidad (`/40`, `/60`). */
        'tertiary-container': 'rgb(var(--stitch-tertiary-container) / <alpha-value>)',
      },

      // Todas las familias de Stitch apuntan a la misma fuente; los nombres
      // distinguen el papel, no el tipo.
      fontFamily: {
        'headline-xl': ['"Plus Jakarta Sans"', 'sans-serif'],
        'headline-xl-mobile': ['"Plus Jakarta Sans"', 'sans-serif'],
        'headline-lg': ['"Plus Jakarta Sans"', 'sans-serif'],
        'headline-md': ['"Plus Jakarta Sans"', 'sans-serif'],
        'headline-sm': ['"Plus Jakarta Sans"', 'sans-serif'],
        'body-lg': ['"Plus Jakarta Sans"', 'sans-serif'],
        'body-md': ['"Plus Jakarta Sans"', 'sans-serif'],
        'body-sm': ['"Plus Jakarta Sans"', 'sans-serif'],
        'label-lg': ['"Plus Jakarta Sans"', 'sans-serif'],
        'label-md': ['"Plus Jakarta Sans"', 'sans-serif'],
        'label-sm': ['"Plus Jakarta Sans"', 'sans-serif'],
      },

      fontSize: {
        'headline-xl': ['38px', { lineHeight: '46px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['22px', { lineHeight: '30px', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'label-sm': ['11px', { lineHeight: '14px', fontWeight: '500' }],
      },

      // `extend` conserva la escala numérica de Tailwind; esto solo añade los
      // pasos con nombre (`p-space-lg`, `gap-gutter`).
      spacing: {
        'space-2xs': '0.25rem',
        'space-xs': '0.5rem',
        'space-sm': '0.75rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
        'space-2xl': '3rem',
        'space-3xl': '4rem',
        gutter: '1rem',
        'margin-mobile': '1.25rem',
        'margin-desktop': '2.5rem',
      },

      /* Ojo: esto redefine `rounded-lg` (0.5rem → 2rem) y `rounded-xl`
         (0.75rem → 3rem) respecto a Tailwind por defecto. Es lo que hacía
         Stitch y de ahí sale la morfología mullida de las tarjetas. `rounded-2xl`
         y `rounded-3xl`, que son las más usadas, siguen siendo las de fábrica. */
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
    },
  },

  plugins: [],
};
