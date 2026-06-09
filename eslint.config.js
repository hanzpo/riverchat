import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'functions/**', 'e2e/**'],
  },

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  // Disable formatting/stylistic rules that conflict with Prettier
  eslintConfigPrettier,

  {
    name: 'app/language-options',
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    name: 'app/rules',
    rules: {
      // --- Correctness rules: keep as errors for future code ---
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'vue/no-mutating-props': 'error',
      'vue/require-v-for-key': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',

      // --- Rules the existing codebase doesn't satisfy yet: warn only ---
      // Re-promote these to 'error' once the codebase has been cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'vue/require-default-prop': 'warn',
      'vue/multi-word-component-names': 'warn',

      // --- Style noise: warn, never block ---
      'vue/attributes-order': 'warn',
      'vue/order-in-components': 'warn',
      'vue/attribute-hyphenation': 'warn',
      'vue/v-on-event-hyphenation': 'warn',
      'vue/prop-name-casing': 'warn',
    },
  }
)
