import globals from "globals";
import pluginJs from "@eslint/js";
import prettier from "eslint-config-prettier";
import jest from "eslint-plugin-jest";

export default [
  // Global ignores
  {
    ignores: [
        "node_modules/**", 
        "dist/**", 
        "coverage/**", 
    ],
  },
  // Base configuration for all JS files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  // Node.js backend configuration
  {
    files: ["src/**/*.js", "tools/**/*.js", "migrate-config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
  },
  // Config files
  {
    files: ["*.config.js"],
    languageOptions: {
        globals: {
            ...globals.node,
        },
        sourceType: "module",
    }
  },
  // Frontend browser configuration
  {
    files: ["public_html/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      sourceType: "module",
    },
  },
  // performance.js configuration
  {
    files: ["public_html/scripts/performance.js"],
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
        },
        sourceType: "module",
    }
  },
  // ztd-demo.js configuration
  {
    files: ["public_html/scripts/ztd-demo.js"],
    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.node,
        },
        sourceType: "module",
    }
  },
  // Jest configuration
  {
    files: ["__tests__/**/*.js"],
    ...jest.configs['flat/recommended'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  // Cypress configuration
  {
    files: ["cypress/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.cypress,
      },
    },
  },
  // Recommended ESLint rules
  pluginJs.configs.recommended,
  // Prettier configuration
  prettier,
];