# Google Antigravity

Antigravity is the most opinionated host in the matrix, and it fails silently if you get one key wrong.

## The three quirks that bite

| Quirk | Symptom | Fix |
|---|---|---|
| Remote entries must use **`serverUrl`** | Server appears but never connects | `url` and `httpUrl` are rejected — use [`mcp_config.remote.json`](./mcp_config.remote.json) |
| Several 2026 builds ignore **project-level** MCP files | Tools work in one workspace, vanish in the next | Register in `~/.gemini/config/mcp_config.json` (`--scope user`) |
| **Strict JSON parser** | Whole file ignored, no error | No comments, no trailing commas, no top-level `timeout` key |

## Install

```bash
npx omni-carousel-setup --client antigravity --scope user
# or, for a project that definitely reads it:
npx omni-carousel-setup --client antigravity --scope project
```

Files written:

| Scope | Path |
|---|---|
| user | `~/.gemini/config/mcp_config.json` |
| project | `.agents/mcp_config.json` |
| skills | `~/.gemini/config/skills/` (user) · `.agents/skills/` (project) |

## Skills

Antigravity reads `SKILL.md` packages from `~/.gemini/config/skills` and `.agents/skills` (plural — singular `.agent/skills` is not read). Legacy preview builds used `.agent`, so the repository ships both via symlink:

```bash
mkdir -p .agents/skills && ln -sfn ../../skills/carousel-architect .agents/skills/carousel-architect
ln -sfn .agents .agent        # legacy preview builds
```

## Verify

Ask the agent: *"List your MCP tools."* You should see the nine `omni-carousel` tools. If not, validate the JSON first:

```bash
node -e "JSON.parse(require('fs').readFileSync(process.env.HOME + '/.gemini/config/mcp_config.json','utf8')); console.log('valid json')"
```
