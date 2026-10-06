import globals from "globals";

/**
 * Lint rules approximating the Foundry VTT core code style.
 */
export default [
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        foundry: "readonly",
        game: "readonly",
        canvas: "readonly",
        ui: "readonly",
        CONFIG: "readonly",
        CONST: "readonly",
        Hooks: "readonly",
        PIXI: "readonly"
      }
    },
    rules: {
      "indent": ["error", 2, {SwitchCase: 1}],
      "quotes": ["error", "double", {avoidEscape: true}],
      "semi": ["error", "always"],
      "no-unused-vars": ["warn", {args: "none"}],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "smart"]
    }
  }
];
