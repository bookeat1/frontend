/* eslint-env node */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "react-native"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: {
    react: { version: "detect" },
  },
  env: {
    "react-native/react-native": true,
    es2021: true,
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "react-native/no-inline-styles": "off",
  },
  overrides: [
    {
      // Config-плагины Expo грузит обычным require() из Node ещё до всякой
      // транспиляции, поэтому они обязаны быть CommonJS. Это не поблажка
      // общему правилу, а другая среда исполнения — здесь нет модулей ESM.
      files: ["plugins/**/*.js"],
      env: { node: true, es2021: true },
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
  ignorePatterns: [".expo/", "node_modules/", "dist/", "*.config.js"],
};
