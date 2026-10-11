# opencode-librarian

An [OpenCode](https://opencode.ai) V2 plugin that adds a `librarian` tool: a read-only research subagent for code and docs outside your project. Ask it how a library really behaves, what changed between versions, how another repository implements something, or whether an upstream issue already exists.

The librarian works in its own child session. It reads primary sources (repositories through `gh` or `glab`, official docs, the web tools you have) and returns a direct answer with links and code excerpts. All of that searching stays out of the asking agent's context.

## Install

```sh
opencode plugin add github:c0dn/opencode-librarian
```

Requires OpenCode 2.0.26 or later.

## Tool

`librarian({ question, context? })`: `question` is one specific question that names the library or repository, plus the version if it matters. `context` says what you're trying to do and what you already know.

## Safety

The child session can't edit files or start subagents. Any action that would need your approval is denied rather than left waiting, and the session is removed afterwards.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "github:c0dn/opencode-librarian",
      "options": {
        "agent": "researcher",      // agent the librarian runs as (default: OpenCode's default agent)
        "model": "provider/model",  // default: the model of the session asking
        "keep": false               // keep the librarian's session afterwards
      }
    }
  ]
}
```

## Development

```sh
bun install
bun test
bun run typecheck
```
