module.exports = {
    preset: 'ts-jest',
    globals: {
        'ts-jest': {
            tsConfig: '<rootDir>/tsconfig.test.json',
        },
    },
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    transform: {'^.+\\.tsx?$': 'ts-jest'},
    testMatch: ["**/*.(spec|test).ts"],
    moduleFileExtensions: ['ts', 'js'],
    testTimeout: 12000,
};
