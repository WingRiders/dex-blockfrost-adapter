module.exports = {
  roots: ["<rootDir>/test"],
  testMatch: ["**/__tests__/**/*.+(ts|tsx|js)", "**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "./config/tsconfig.test.json",
      },
    ],
  },
  moduleNameMapper: {
    // mock out the browser version of WASM bindings with the nodejs bindings
    "@dcspark/cardano-multiplatform-lib-browser": "@dcspark/cardano-multiplatform-lib-nodejs",
  },
};
