// Minimal HTTP client for the Replyz REST API (openapi/openapi.yaml). Uses Node's built-in fetch.
// Every API error is an RFC 9457 problem with a stable `code` and a `fix` for the agent; we keep
// both unchanged so agents can branch on `code` exactly as the docs say.
import { VERSION } from "./version.js";

export const DEFAULT_API = "https://api.replyz.io";

/** An error with the API's (or, for local failures, the CLI's) code and fix. */
export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fix: string,
    readonly status: number | null = null,
    /** Seconds from the Retry-After header, when the API sent one (429 and some 503 answers). */
    readonly retryAfterS: number | null = null,
  ) {
    super(message);
  }
  toJSON() {
    return {
      code: this.code,
      status: this.status,
      message: this.message,
      fix: this.fix,
      ...(this.retryAfterS !== null ? { retry_after_s: this.retryAfterS } : {}),
    };
  }
}

export interface ApiOptions {
  base: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined>;

export class Api {
  readonly base: string;
  private readonly apiKey: string | undefined;
  private readonly doFetch: typeof fetch;

  constructor(opts: ApiOptions) {
    this.base = opts.base.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.doFetch = opts.fetch ?? fetch;
  }

  get<T>(path: string, query: Query = {}, timeoutMs = 30_000): Promise<T> {
    return this.request<T>("GET", path, query, undefined, timeoutMs);
  }

  post<T>(path: string, body: unknown = {}, timeoutMs = 30_000): Promise<T> {
    return this.request<T>("POST", path, {}, body, timeoutMs);
  }

  private async request<T>(method: string, path: string, query: Query, body: unknown, timeoutMs: number) {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": `replyz-cli/${VERSION} node/${process.versions.node}`,
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await this.doFetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new CliError(
        "network_error",
        `Could not reach ${this.base} (${(err as Error).name === "TimeoutError" ? "timed out" : (err as Error).message}).`,
        "Check the network and retry. REPLYZ_API overrides the API address.",
      );
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // not JSON: handled below
    }
    if (res.ok) return data as T;
    const p = (data ?? {}) as { code?: unknown; message?: unknown; fix?: unknown };
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new CliError(
      typeof p.code === "string" ? p.code : "http_error",
      typeof p.message === "string" ? p.message : `HTTP ${res.status} from ${url.pathname}.`,
      typeof p.fix === "string" ? p.fix : "Retry in a few seconds.",
      res.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : null,
    );
  }
}
