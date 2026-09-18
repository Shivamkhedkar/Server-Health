module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react/react-in-jsx-scope': 'off', // Vite's React 18 JSX transform doesn't require the React import in scope
    'react/prop-types': 'off', // project doesn't use PropTypes anywhere - not worth introducing just for lint
    'react-refresh/only-export-components': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['dist', 'node_modules', 'vite.config.js'],
};
