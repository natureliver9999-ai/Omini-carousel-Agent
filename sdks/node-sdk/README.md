# omni-carousel (Node SDK)

Typed tool definitions plus a local runner, so a Node agent can plan, validate and
render carousels without speaking MCP.

```bash
npm install omni-carousel
```

## Anthropic Messages API

```ts
import Anthropic from '@anthropic-ai/sdk';
import { anthropicTools, handleAnthropicToolUse } from 'omni-carousel';

const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [{ role: 'user', content: 'Carousel: why carousels beat Reels' }];

let response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  tools: anthropicTools() as Anthropic.Tool[],
  messages,
});

while (response.stop_reason === 'tool_use') {
  const toolUses = response.content.filter((block) => block.type === 'tool_use');
  const results = await Promise.all(toolUses.map((block) => handleAnthropicToolUse(block)));
  messages.push({ role: 'assistant', content: response.content });
  messages.push({ role: 'user', content: results as Anthropic.ToolResultBlockParam[] });
  response = await client.messages.create({ model: 'claude-sonnet-4-5-20250929', max_tokens: 4096, tools: anthropicTools() as Anthropic.Tool[], messages });
}
```

Want the hosted server instead of local execution? Anthropic's native MCP connector
needs **both** an `mcp_servers` entry and a matching `mcp_toolset` in `tools` — that
pairing is what `anthropicMcpServer()` returns:

```ts
const mcp = anthropicMcpServer({ url: 'https://your-host/mcp', authorizationToken: process.env.OMNI_TOKEN });
await client.beta.messages.create({ ...mcp, model: '...', max_tokens: 4096, messages });
```

## OpenAI Responses API

```ts
import { openaiTools, openaiMcpTool, handleOpenAIToolCall } from 'omni-carousel';

const tools = openaiTools({ strict: true });          // local function calling
const remote = openaiMcpTool('https://your-host/mcp'); // native remote MCP
```

## Vercel AI SDK v5+

v5 replaced `parameters` with Zod `inputSchema`, which is why the tools are
returned pre-wrapped:

```ts
import { generateText, stepCountIs } from 'ai';
import { vercelTools } from 'omni-carousel';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  tools: vercelTools({ outputDir: './carousels' }),
  stopWhen: stepCountIs(8),
  prompt: 'Make a 9-slide Instagram carousel on retention loops and render it.',
});
```

## Host config

```ts
import { mcpServerConfig } from 'omni-carousel';
console.log(JSON.stringify(mcpServerConfig({ mode: 'http', url: 'https://your-host/mcp' }), null, 2));
```

## What `runTool` actually does

`runTool(name, input, options)` calls the engine in-process — no subprocess, no
network. The one exception is `fetch_asset`, which goes through the same
SSRF-guarded fetcher the MCP server uses. Rendered artifacts land in
`options.outputDir` (default `./carousels`), or are referenced by signed URL when
`options.publicUrl` is set.

Requires the engine's bundled fonts, so run from a directory where
`@omni-carousel/engine` is installed (it ships `fonts/` in its tarball).
