// Tiny argument parser (no dependencies): positionals, `--flag value`, `--flag=value` and booleans.
// Each command declares which flags take a value; anything unknown is a usage error, so a typo
// never silently changes what a command does.
import { CliError } from "./api.js";

export interface Parsed {
  positionals: string[];
  flags: Record<string, string | true>;
}

/**
 * @param valueFlags flags that take a value (e.g. ["name", "from"])
 * @param boolFlags  flags without a value (e.g. ["json", "otp"])
 */
export function parseArgs(argv: string[], valueFlags: string[], boolFlags: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--") || arg === "--") {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq === -1 ? undefined : eq);
    if (boolFlags.includes(name)) {
      if (eq !== -1) throw usage(`--${name} does not take a value.`);
      flags[name] = true;
    } else if (valueFlags.includes(name)) {
      const value = eq !== -1 ? arg.slice(eq + 1) : argv[++i];
      if (value === undefined || (eq === -1 && value.startsWith("--"))) {
        throw usage(`--${name} needs a value.`);
      }
      flags[name] = value;
    } else {
      throw usage(`Unknown option --${name}.`);
    }
  }
  return { positionals, flags };
}

export function usage(message: string): CliError {
  return new CliError("usage", message, "Run `replyz help` to see the commands and their options.");
}

/** An integer flag within [min, max], or the fallback when absent. */
export function intFlag(p: Parsed, name: string, min: number, max: number, fallback: number): number {
  const v = p.flags[name];
  if (v === undefined) return fallback;
  const n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : Number.NaN;
  if (!Number.isInteger(n) || n < min || n > max)
    throw usage(`--${name} must be an integer from ${min} to ${max}.`);
  return n;
}

export function strFlag(p: Parsed, name: string): string | undefined {
  const v = p.flags[name];
  return typeof v === "string" ? v : undefined;
}
