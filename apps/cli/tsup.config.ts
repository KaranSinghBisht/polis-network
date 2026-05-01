import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  dts: false,
  splitting: false,
  treeshake: true,
  minify: false,
  shims: false,
  noExternal: [
    "@polis/axl-client",
    "@polis/newsletter",
    "@polis/runtime",
    "@polis/storage",
  ],
});
