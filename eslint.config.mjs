import { config } from '@n8n/node-cli/eslint';

// 扩展基础配置，允许使用any类型
export default [
  ...config,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 允许使用any类型，但设置为警告级别
      '@typescript-eslint/no-explicit-any': 'off',
      'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
    },
  },
];
