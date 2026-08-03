module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/test/**/*.test.ts'],
    // Live tests are opt-in: the default suite must remain credential-free and offline.
    testPathIgnorePatterns: ['/test/(car|integration|kilometric|user)\\.test\\.ts$'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
};
