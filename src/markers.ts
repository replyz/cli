// The two lines that fence the message for the human in the CLI's output (signup and the agent reminder).
// The text between them is the only thing the agent copies to its human; nothing is ever added after it.
export const TEXT_START_MARKER = "--- tell_your_human (copy word for word; nothing before or after) ---";
export const TEXT_END_MARKER = "--- end ---";
