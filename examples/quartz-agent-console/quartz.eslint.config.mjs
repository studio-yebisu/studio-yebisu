import parser from '@typescript-eslint/parser';
import quartz from './vendor/quartz/lint/plugin.mjs';

export default [{
  files: ['src/**/*.{js,jsx,ts,tsx}'],
  languageOptions: {parser, parserOptions: {ecmaFeatures: {jsx: true}}},
  plugins: {quartz},
  processor: 'quartz/standalone',
  rules: quartz.configs.app.rules
}];
