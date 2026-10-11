import { expect, test } from "bun:test"

import type { ChildHost } from "../src/child.ts"
import { askLibrarian, librarianPrompt } from "../src/librarian.ts"

function fakeHost(answer: string) {
  const created: { parentID: string; title: string; agent?: string }[] = []
  let prompt = ""
  const host: ChildHost = {
    create: async (input) => (created.push(input), "child"),
    prompt: async (_id, text) => void (prompt = text),
    wait: async () => {},
    context: async () => [{ type: "assistant", content: [{ type: "text", text: answer }] }],
    remove: async () => {},
  }
  return { host, created, prompt: () => prompt }
}

test("asks in a child session of the caller and returns its answer", async () => {
  const t = fakeHost("Use `retry: 0`. Source: https://github.com/x/y/blob/v2/src/a.ts#L10")
  const answer = await askLibrarian(t.host, { parentID: "s1", question: "How do I disable retries in y v2?", agent: "researcher" })
  expect(answer).toContain("retry: 0")
  expect(t.created[0]).toMatchObject({ parentID: "s1", agent: "researcher" })
  expect(t.created[0]!.title).toStartWith("librarian: How do I disable")
  expect(t.prompt()).toContain("How do I disable retries in y v2?")
})

test("an empty answer is reported, not returned blank", async () => {
  expect(await askLibrarian(fakeHost("").host, { parentID: "s1", question: "q" })).toBe("The librarian finished without an answer.")
})

test("the prompt includes the caller's context only when given", () => {
  expect(librarianPrompt("q", "using bun")).toContain("Context from the asking agent: using bun")
  expect(librarianPrompt("q")).not.toContain("Context from the asking agent")
})
