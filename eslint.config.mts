import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  // Base ESLint recommended rules
  eslint.configs.recommended,
  
  // TypeScript ESLint recommended rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        // Add other globals if needed:
        process: "readonly",
        __dirname: "readonly",
        setTimeout: "readonly",
        // __filename: "readonly",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-unused-vars": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-console": "warn",
    },
  },
  
  // Global ignore patterns
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];