import { type ChildHost, type ModelRef, runChild } from "./child.ts"

export function librarianPrompt(question: string, context?: string): string {
  return `You are the librarian: you research code and documentation outside this project to answer a question for another coding agent. You cannot edit files.

Question: ${question}
${context ? `\nContext from the asking agent: ${context}\n` : ""}
How to work:
- Go to primary sources: the library's own repository and official docs, at the version the project uses when that matters (check the project's lockfile or manifest).
- For GitHub, use the gh CLI: \`gh search code\`, \`gh search repos\`, \`gh api repos/OWNER/REPO/contents/PATH\` (add \`?ref=TAG\` for a version), \`gh release list\`, \`gh issue list --search\`. For GitLab, \`glab\`. For docs, the web search or fetch tools you have.
- Read the actual implementation when the docs are vague, and quote the relevant lines.
- Stop when the question is answered; don't survey everything.

Answer in Markdown: the direct answer first, then the evidence with links (repository URL with path and line, or doc URL) and short code excerpts. Say plainly what you could not confirm.`
}

export async function askLibrarian(
  host: ChildHost,
  options: { parentID: string; question: string; context?: string; agent?: string; model?: ModelRef; keep?: boolean; onCreate?: (id: string) => void },
): Promise<string> {
  const answer = await runChild(host, {
    parentID: options.parentID,
    title: `librarian: ${options.question.slice(0, 60)}`,
    prompt: librarianPrompt(options.question, options.context),
    agent: options.agent,
    model: options.model,
    keep: options.keep,
    onCreate: options.onCreate,
  })
  return answer || "The librarian finished without an answer."
}
