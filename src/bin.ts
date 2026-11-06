#!/usr/bin/env node
// Program entry for the `replyz` command (package.json "bin"). All logic is in index.ts.
import { main } from "./index.js";

main(process.argv.slice(2), process.env, {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
}).then((code) => {
  process.exitCode = code;
});
