// eslint-config-next ya exporta configuración plana (flat config) — nada de
// FlatCompat aquí. Intentarlo por ese puente rompe con un JSON circular,
// porque el bridge de compatibilidad está pensado para configs viejas de
// .eslintrc, no para las que ya vienen en formato plano.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react 7.37.5 detecta la versión de React llamando a
    // context.getFilename(), un método que ESLint 10 ya no expone. Fijar la
    // versión explícita evita esa detección (y el error) por completo.
    settings: { react: { version: "19.2.8" } },
  },
  { ignores: [".next/**", "node_modules/**", "diseno/**"] },
];

export default eslintConfig;
