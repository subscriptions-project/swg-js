import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import googleCamelcase from "eslint-plugin-google-camelcase";
if (typeof googleCamelcase.rules["google-camelcase"] === "function") {
    // ESLint 9 requires rules to be objects with a `create` method,
    // but the plugin currently exports a raw function, so we wrap it here.
    googleCamelcase.rules["google-camelcase"] = { create: googleCamelcase.rules["google-camelcase"] };
}
import prettier from "eslint-plugin-prettier";
import sortImportsEs6Autofix from "eslint-plugin-sort-imports-es6-autofix";
import sortRequires from "eslint-plugin-sort-requires";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import localRules from "./build-system/eslint-rules/index.js";
export default defineConfig([{
    files: ["**/*.js", "**/*.ts", "**/*.cjs", "**/*.mjs"],
    plugins: {
        "@typescript-eslint": typescriptEslint,
        "google-camelcase": googleCamelcase,
        prettier,
        "sort-imports-es6-autofix": sortImportsEs6Autofix,
        "sort-requires": sortRequires,
        "local": localRules,
    },

    languageOptions: {
        globals: {
            ...globals.amd,
            ...globals.browser,
            it: false,
            chai: false,
            expect: false,
            describe: false,
            beforeEach: false,
            afterEach: false,
            before: false,
            after: false,
            SUBSCRIPTIONS: false,
            SWG: false,
            assert: false,
            sinon: true,
            sandbox: true,
            context: false,
            global: false,
            describes: true,
        },

        parser: tsParser,
        ecmaVersion: 6,
        sourceType: "module",

        parserOptions: {
            requireConfigFile: false,
        },
    },

    rules: {
        "local/enforce-private-props": 2,
        "local/no-export-side-effect": 2,
        curly: 2,
        "google-camelcase/google-camelcase": 2,
        "no-alert": 2,
        "no-cond-assign": 2,
        "no-console": 2,
        "no-debugger": 2,
        "no-div-regex": 2,
        "no-dupe-keys": 2,
        "no-eval": 2,
        "no-extend-native": 2,
        "no-extra-bind": 2,

        "no-implicit-coercion": [2, {
            boolean: false,
        }],

        "no-implied-eval": 2,
        "no-iterator": 2,
        "no-lone-blocks": 2,
        "no-native-reassign": 2,
        "no-redeclare": 2,
        "no-restricted-globals": [2, "error", "event"],
        "no-script-url": 2,
        "no-self-compare": 2,
        "no-sequences": 2,
        "no-throw-literal": 2,
        "no-unused-expressions": 0,
        "no-unused-vars": "off",

        "@typescript-eslint/no-unused-vars": [2, {
            argsIgnorePattern: "^var_|unused|^_",
            varsIgnorePattern: "Def|Interface$",
        }],

        "@typescript-eslint/no-explicit-any": 2,
        "no-useless-call": 2,
        "no-useless-concat": 2,
        "no-var": 2,

        "no-warning-comments": [2, {
            terms: ["do not submit"],
            location: "anywhere",
        }],

        "object-curly-spacing": [2, "never", {
            objectsInObjects: false,
            arraysInObjects: false,
        }],

        "object-shorthand": [2, "properties", {
            avoidQuotes: true,
        }],

        "prefer-const": 2,
        "prettier/prettier": 2,
        radix: 2,

        "sort-imports-es6-autofix/sort-imports-es6": [2, {
            ignoreCase: false,
            ignoreMemberSort: false,
            memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
        }],

        "sort-requires/sort-requires": 2,
    },
}, {
    files: ["src/**/*-test.js"],

    rules: {
        "no-restricted-syntax": [2, {
            selector: "TryStatement",
            message: "Within unit tests, try/catch can hide silent failures. Explicitly expect errors/rejects instead. Ex: `expect(fn).to.throw` or `await expect(promise).to.eventually.be.rejected`",
        }],
    },
}, {
    files: ["assets/i18n/strings/*.js"],

    languageOptions: {
        globals: {
            __dirname: false,
            require: false,
        },
    },
}, {
    files: ["test/e2e/*.js", "test/e2e/**/*.js"],

    languageOptions: {
        globals: {
            module: false,
            require: false,
        },
    },
}, {
    files: ["demos/**/*.js"],

    languageOptions: {
        globals: {
            __dirname: true,
            process: true,
        },
    },

    rules: {
        "no-console": 0,
    },
}, {
    files: ["src/stories/**/*"],

    rules: {
        "local/no-export-side-effect": 0,
    },
}, {
    files: ["src/constants.js"],

    languageOptions: {
        globals: {
            goog: false,
        },
    },
}, {
    files: ["build-system/**/*.js", "build-system/*.js"],
    rules: {
        "no-console": 0,
    },
}]);