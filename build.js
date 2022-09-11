const { build } = require("esbuild");
const { Generator } = require("npm-dts");
const resolve = require("esbuild-plugin-resolve");
const { peerDependencies } = require("./package.json");

const esbuildPlugin = require("node-stdlib-browser/helpers/esbuild/plugin");
const stdLibBrowser = require("node-stdlib-browser");

const entryFile = "src/index.ts";
const shared = {
  entryPoints: [entryFile],
  bundle: true,
  external: Object.keys(peerDependencies),
  inject: [require.resolve("node-stdlib-browser/helpers/esbuild/shim")],
  define: {
    Buffer: "Buffer",
  },
  plugins: [esbuildPlugin(stdLibBrowser)],
};

build({
  ...shared,
  format: "cjs",
  outfile: "dist/index.js",
  plugins: [
    ...shared.plugins,
    resolve({
      "@dcspark/cardano-multiplatform-lib-browser": "@dcspark/cardano-multiplatform-lib-nodejs",
    }),
  ],
});

build({
  ...shared,
  outfile: "dist/index.esm.js",
  format: "esm",
});

new Generator({
  tsc: "-p config/tsconfig.declarations.json",
  output: "dist/index.d.ts",
}).generate();
