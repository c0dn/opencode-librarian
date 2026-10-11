import { Plugin } from "@opencode/plugin"

import { CHILD_RULES, type ChildHost, parseModel } from "./src/child.ts"
import { askLibrarian } from "./src/librarian.ts"

/**
 * librarian: a read-only research subagent for code and docs outside the
 * project (other repositories, library internals, upstream issues), run as a
 * child session so its searching stays out of the caller's context.
 */
export default Plugin.define({
  id: "opencode-librarian",
  async setup(context) {
    const options = context.options as { agent?: string; model?: string; keep?: boolean }
    const model = options.model ? parseModel(options.model) : undefined
    const children = new Set<string>()

    const host: ChildHost = {
      async create(input) {
        const session = await context.session.create({
          parentID: input.parentID,
          title: input.title,
          agent: input.agent,
          // Without a configured model, use the caller's, as native subagents do.
          model: input.model ?? (await context.session.get({ sessionID: input.parentID })).model,
          location: { directory: context.location.directory },
          permissions: [...CHILD_RULES],
        })
        return session.id
      },
      prompt: async (sessionID, text) => void (await context.session.prompt({ sessionID, text })),
      wait: (sessionID) => context.session.wait({ sessionID }),
      context: (sessionID) => context.session.context({ sessionID }),
      async remove(sessionID) {
        children.delete(sessionID)
        await context.session.remove({ sessionID })
      },
    }

    // Nobody watches the librarian's session, so a permission prompt there would hang it.
    const permissions = await context.permission.hook("evaluate", (event) => {
      if (event.effect === "ask" && children.has(event.sessionID)) {
        event.effect = "deny"
        event.message = "Unattended librarian: this needs approval, so it is not available. Work with read-only tools."
      }
    })

    const tools = await context.tool.transform((draft) => {
      draft.add({
        name: "librarian",
        description:
          "Ask the librarian, a read-only research subagent, about code or docs outside this project: how a library or API really behaves, what changed between versions, how another repository implements something, or whether an upstream issue exists. It searches GitHub/GitLab and the web in its own session and returns a cited answer, keeping that search out of your context. Takes a minute or two.",
        input: {
          type: "object",
          properties: {
            question: { type: "string", minLength: 1, description: "One specific question, naming the library, repository or API and the version if it matters." },
            context: { type: "string", description: "What you are trying to do and what you already know, so it doesn't repeat your work." },
          },
          required: ["question"],
          additionalProperties: false,
        },
        options: { codemode: false as const },
        async execute(input, toolContext) {
          const args = input as { question: string; context?: string }
          void toolContext.progress({ title: "Asking the librarian", status: args.question.slice(0, 80) })
          const answer = await askLibrarian(host, {
            parentID: toolContext.sessionID,
            question: args.question,
            context: args.context,
            agent: options.agent,
            model,
            keep: options.keep,
            onCreate: (id) => children.add(id),
          })
          return { content: answer }
        },
      })
    })

    return async () => {
      await tools.dispose()
      await permissions.dispose()
    }
  },
})
