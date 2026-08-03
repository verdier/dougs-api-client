const base = require('./jest.config');

module.exports = {
    ...base,
    testMatch: ['**/test/{car,integration,kilometric,user}.test.ts'],
    testPathIgnorePatterns: [],
};
