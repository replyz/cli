#!/usr/bin/env node
// Program entry for the `replyz` command (package.json "bin"). All logic is in index.ts.
import { main } from "./index.js";

main(process.argv.slice(2), process.env, {
  out: (s) => process.stdout.write(`${s}\n`),
  err: (s) => process.stderr.write(`${s}\n`),
  // Only when something is piped in: a terminal would wait forever.
  ...(process.stdin.isTTY
    ? {}
    : {
        readStdin: async () => {
          const chunks: Buffer[] = [];
          for await (const c of process.stdin) chunks.push(c as Buffer);
          return Buffer.concat(chunks).toString("utf8");
        },
      }),
}).then((code) => {
  process.exitCode = code;
});
