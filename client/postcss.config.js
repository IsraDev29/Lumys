/* Vite recoge este archivo solo. Autoprefixer va detrás de Tailwind porque
   trabaja sobre el CSS ya generado, no sobre las directivas. */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
