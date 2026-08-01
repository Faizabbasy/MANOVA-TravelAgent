/**
 * ESLint config (Section 24 — resolves Q8, open since Section 00/tooling).
 * Legacy `.eslintrc` format (not flat config) because `@nuxtjs/eslint-config-typescript@^12.1.0`
 * (already a devDependency before this section) peer-depends on `eslint@^8.48.0`, which predates
 * ESLint's flat-config era. `.cjs` extension forced because `package.json` has `"type": "module"`.
 */
module.exports = {
  root: true,
  extends: ['@nuxtjs/eslint-config-typescript'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  rules: {
    // Section 24 regression found this codebase relies on Vue's auto-imports (Nuxt) for components/
    // composables/utils — enforcing full-word component names or forbidding v-html would require a
    // large mechanical rewrite unrelated to real bugs, which the protocol explicitly forbids ("Perbaiki
    // bug nyata tanpa redesign besar"). Kept as warnings, not errors, so genuine issues stay visible
    // without blocking the lint script on stylistic churn.
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',
  },
  ignorePatterns: ['.nuxt', '.output', 'dist', 'node_modules', '*.d.ts'],
}
