/**
 * Runs a task in a child session and returns its final answer. Children are
 * read-only and unattended: edits and subagents are denied by session rules,
 * and the plugin's permission hook turns any "ask" into "deny" so a child can
 * never stall on a prompt nobody is looking at.
 */

export interface ModelRef {
  providerID: string
  id: string
  variant?: string
}

export interface ChildHost {
  /** Creates a child session of `parentID`; returns its ID. */
  create(input: { parentID: string; title: string; agent?: string; model?: ModelRef }): Promise<string>
  prompt(sessionID: string, text: string): Promise<void>
  wait(sessionID: string): Promise<void>
  context(sessionID: string): Promise<readonly unknown[]>
  remove(sessionID: string): Promise<void>
}

export const CHILD_RULES = [
  { action: "edit", resource: "*", effect: "deny" },
  { action: "task", resource: "*", effect: "deny" },
] as const

/** The text of the last assistant message, or "" when there is none. */
export function lastAnswer(messages: readonly unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { type?: string; content?: { type?: string; text?: string }[] }
    if (message.type !== "assistant") continue
    const text = (message.content ?? [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim()
    if (text) return text
  }
  return ""
}

/** `provider/model` or `provider/model#variant`. */
export function parseModel(spec: string): ModelRef {
  const slash = spec.indexOf("/")
  if (slash <= 0 || slash === spec.length - 1) throw new Error(`Expected provider/model[#variant], got "${spec}"`)
  const [id, variant] = spec.slice(slash + 1).split("#", 2) as [string, string | undefined]
  return variant ? { providerID: spec.slice(0, slash), id, variant } : { providerID: spec.slice(0, slash), id }
}

export interface ChildOptions {
  parentID: string
  title: string
  prompt: string
  agent?: string
  model?: ModelRef
  /** Keep the child session afterwards instead of removing it. */
  keep?: boolean
  /** Called with the child's ID as soon as it exists, so the caller can track it. */
  onCreate?: (sessionID: string) => void
}

export async function runChild(host: ChildHost, options: ChildOptions): Promise<string> {
  const sessionID = await host.create({ parentID: options.parentID, title: options.title, agent: options.agent, model: options.model })
  options.onCreate?.(sessionID)
  try {
    await host.prompt(sessionID, options.prompt)
    await host.wait(sessionID)
    return lastAnswer(await host.context(sessionID))
  } finally {
    if (!options.keep) await host.remove(sessionID).catch(() => {})
  }
}
