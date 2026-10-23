export default {
  ignoreFiles: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**'],
  rules: {
    'rule-empty-line-before': ['always', { except: ['first-nested'] }],
    'at-rule-empty-line-before': ['always', { except: ['first-nested'] }],
  },
};
