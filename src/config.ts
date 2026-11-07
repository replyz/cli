// Where the CLI keeps the account it signed up for: an owner-only file in an owner-only folder.
//
// File: $REPLYZ_CONFIG_DIR/credentials.json, else $XDG_CONFIG_HOME/replyz/credentials.json, else
// ~/.config/replyz/credentials.json. The folder is created 0700 and the file 0600 (owner only),
// written to a temporary file first and then renamed, so a crash never leaves half a key behind.
// REPLYZ_API_KEY (environment) wins over the file, so agents with a secret store can skip the file.
import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Credentials {
  api_key: string;
  org_id?: string;
  /** The inbox created at signup: the default inbox for messages / wait. */
  inbox_id?: string;
  address?: string;
  /** The API the key belongs to (local dev keys must not be sent to production). */
  api_base?: string;
  /** The link the human opens to claim the account (shown by `status` until it is claimed; the file is owner-only). */
  claim_url?: string;
  created_at?: string;
}

export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.REPLYZ_CONFIG_DIR) return env.REPLYZ_CONFIG_DIR;
  const base = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "replyz");
}

export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "credentials.json");
}

/** The saved credentials, or null when there is no (readable, valid) file. */
export async function loadCredentials(env: NodeJS.ProcessEnv = process.env): Promise<Credentials | null> {
  try {
    const data = JSON.parse(await readFile(credentialsPath(env), "utf8")) as Partial<Credentials>;
    return typeof data.api_key === "string" ? (data as Credentials) : null;
  } catch {
    return null;
  }
}

export async function saveCredentials(c: Credentials, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const dir = configDir(env);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // mkdir leaves a folder that already exists as it was (for example 0755). Tighten it, never loosen it.
  try {
    if (((await stat(dir)).mode & 0o077) !== 0) await chmod(dir, 0o700);
  } catch {
    // Not ours to change (another owner, or a platform without POSIX modes): the file itself stays 0600.
  }
  const file = credentialsPath(env);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(c, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
  await chmod(file, 0o600); // in case an older file with wider permissions was replaced
  return file;
}
