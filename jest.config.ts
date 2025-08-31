export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  modulePathIgnorePatterns: ['<rootDir>/rust/pkg', '<rootDir>/dist'],
  watchPathIgnorePatterns: ['<rootDir>/rust/pkg', '<rootDir>/dist'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^\\.\\./src$': '<rootDir>/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        target: 'ES2020',
        esModuleInterop: true,
        moduleResolution: 'Node',
      },
    },
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
};