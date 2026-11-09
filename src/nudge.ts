// A reminder, for the AGENT and never for the human, shown at the top of the output of the next few commands
// after signup (wait, messages, read, inbox): qa's R0 on db759a6 found that the agent writes its answer after
// its LAST command (usually `wait`), and that the claim message printed by `signup` is then forgotten (2 of 5
// combined-task runs). So the cue is repeated where the agent writes its reply, a few times, and then stops.
//
// Limits, so it never becomes a nag: at most 3 reminders, only within 24 hours of the signup, only for the
// account this machine signed up (never with REPLYZ_API_KEY from the environment, which is another account),
// and only for commands the agent runs while it is working (not `status`, which has its own reminder).
//
// Shape (qa's R0 on c3ee8c1): the note for the agent comes FIRST and the human message stands ALONE between
// markers; nothing is added after the text. A closing "If you already did, ignore this." used to follow the
// text, and an agent pasted it to the human together with the message.
import { Api } from "./api.js";
import { apiBase, type Ctx, humanMessage } from "./commands.js";
import { loadCredentials, saveCredentials } from "./config.js";
import { TEXT_END_MARKER, TEXT_START_MARKER } from "./markers.js";

/** Commands whose output carries the reminder. */
export const REMIND_ON: ReadonlySet<string> = new Set(["wait", "messages", "read", "inbox"]);
export const MAX_REMINDERS = 3;
export const REMIND_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AgentReminder {
  /** For the agent only. */
  note: string;
  /** The message for the human, exactly as signup gave it. */
  tell_your_human: string;
}

export const REMINDER_NOTE =
  "Reminder for you, not your human: if you have NOT yet written tell_your_human in a reply to your human, start your reply with it, word for word. If you already did, ignore this.";

/** The readable form: the note first, then the text alone between markers. */
export function reminderLines(r: AgentReminder): string[] {
  return [r.note, TEXT_START_MARKER, r.tell_your_human, TEXT_END_MARKER, ""];
}

/**
 * The reminder, or null when there is none to show. Before showing it, it checks that the text is still true
 * (builder's review of 7e2c72a): the account was signed up on the API in use, its sandbox has not ended, and
 * GET /v1/account still says `sandbox`. Once the account is claimed (or ended) the saved claim link is cleared and
 * the reminder stops for good; if the check can't be made (network), nothing is shown and nothing is counted.
 * Showing it counts one (a counter in the credentials file); a file that can't be written means the count isn't kept.
 */
export async function agentReminder(ctx: Ctx, now: number = Date.now()): Promise<AgentReminder | null> {
  const env = ctx.env;
  if (env.REPLYZ_API_KEY) return null;
  const c = await loadCredentials(env);
  if (!c?.claim_url || !c.address || !c.expires_at || !c.created_at) return null;
  if (c.api_base !== apiBase(ctx)) return null;
  const created = Date.parse(c.created_at);
  if (Number.isNaN(created) || now - created > REMIND_WINDOW_MS) return null;
  if (!(Date.parse(c.expires_at) > now)) return null;
  const shown = c.reminders_shown ?? 0;
  if (shown >= MAX_REMINDERS) return null;
  let status: unknown;
  try {
    const api = new Api({ base: c.api_base, apiKey: c.api_key, ...(ctx.fetch ? { fetch: ctx.fetch } : {}) });
    status = (await api.get<{ status?: unknown }>("/v1/account", {}, 5_000)).status;
  } catch {
    return null; // can't tell whether the text is still true: say nothing
  }
  if (status !== "sandbox") {
    // Claimed, expired or suspended: the claim link and "it expires on …" are no longer true. Stop for good.
    const { claim_url: _gone, ...rest } = c;
    try {
      await saveCredentials({ ...rest, reminders_shown: MAX_REMINDERS }, env);
    } catch {
      // the reminder simply isn't shown
    }
    return null;
  }
  try {
    await saveCredentials({ ...c, reminders_shown: shown + 1 }, env);
  } catch {
    // keep going: the reminder is still shown
  }
  return { note: REMINDER_NOTE, tell_your_human: humanMessage(c.address, c.expires_at, c.claim_url) };
}
