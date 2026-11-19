# Claude Code

Two surfaces: **MCP tools** (deterministic rendering) and a **skill** (craft knowledge). Install both — the skill is what stops the agent from writing a 14-word hook.

## Install

```bash
# project scope: writes .mcp.json and links .claude/skills/carousel-architect
npx omni-carousel-setup --client claude-code --scope project

# or user scope: writes ~/.claude.json
npx omni-carousel-setup --client claude-code --scope user
```

Already in this folder: a ready-made [`.mcp.json`](./.mcp.json) and plugin manifest at [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json).

## Manual equivalent

```bash
claude mcp add --transport stdio omni-carousel -- npx -y omni-carousel-mcp
# remote:
claude mcp add --transport http omni-carousel https://your-host/mcp --header "Authorization: Bearer $OMNI_AUTH_TOKEN"
```

```json
{
  "mcpServers": {
    "omni-carousel": {
      "command": "npx",
      "args": ["-y", "omni-carousel-mcp"],
      "env": { "OMNI_OUTPUT_DIR": "./carousels" }
    }
  }
}
```

## Skill

`.claude/skills/carousel-architect/SKILL.md` is auto-discovered. It carries the hook formulas, layout map, platform specs and caption templates so the model plans like a designer before it calls a single tool.

## Verify

```bash
claude mcp list           # omni-carousel: connected
```

Then ask: *"Use the carousel-architect skill to make a 9-slide Instagram carousel about retrieval-augmented generation. Validate, then render."*

## Notes

- Scope precedence is `local > project > user`; a winning entry **replaces the whole object**, which is why the installer merges instead of overwriting.
- Keep `OMNI_OUTPUT_DIR` relative for project scope so renders land in the repo, and absolute for user scope.
