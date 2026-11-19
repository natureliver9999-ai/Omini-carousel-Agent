import { describe, expect, it } from 'vitest';
import {
  ANTHROPIC_MCP_BETA,
  TOOL_NAMES,
  anthropicMcpServer,
  anthropicTools,
  mcpServerConfig,
  openaiChatTools,
  openaiMcpTool,
  openaiTools,
  vercelTools,
} from '../src/index.js';

/**
 * The SDK's job is translation: Zod → each provider's tool dialect → the engine.
 * These tests assert the dialects are right, because a wrong shape is only
 * discovered by the provider at runtime.
 */
describe('tool dialects', () => {
  it('exposes nine tools everywhere', () => {
    expect(TOOL_NAMES).toHaveLength(9);
    expect(anthropicTools()).toHaveLength(9);
    expect(openaiTools()).toHaveLength(9);
    expect(Object.keys(vercelTools())).toHaveLength(9);
  });

  it('emits Anthropic input_schema objects, not $refs', () => {
    for (const tool of anthropicTools()) {
      expect(tool.input_schema.type).toBe('object');
      expect(JSON.stringify(tool.input_schema)).not.toContain('$ref');
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });

  it('emits the flat Responses API shape and the nested chat shape', () => {
    const responses = openaiTools();
    expect(responses[0]).toHaveProperty('name');
    expect(responses[0]).not.toHaveProperty('function');
    const chat = openaiChatTools();
    expect(chat[0].function.name).toBe(responses[0].name);
  });

  it('marks required fields for strict mode', () => {
    const render = openaiTools({ strict: true }).find((tool) => tool.name === 'render_carousel');
    expect(render?.strict).toBe(true);
    expect(render?.parameters.required).toContain('spec');
  });

  it('returns Zod schemas to the Vercel AI SDK', () => {
    const tools = vercelTools();
    expect(tools.render_carousel.inputSchema).toBeTruthy();
    expect(typeof tools.render_carousel.execute).toBe('function');
  });
});

describe('native MCP fragments', () => {
  it('pairs mcp_servers with the required mcp_toolset', () => {
    const fragment = anthropicMcpServer({ url: 'https://example.com/mcp', authorizationToken: 't' });
    expect(fragment.betas).toEqual([ANTHROPIC_MCP_BETA]);
    expect(fragment.mcp_servers[0]).toMatchObject({ type: 'url', url: 'https://example.com/mcp' });
    expect(fragment.tools[0]).toMatchObject({ type: 'mcp_toolset', mcp_server_name: 'omni-carousel' });
  });

  it('builds the Responses API mcp tool', () => {
    const tool = openaiMcpTool({ url: 'https://example.com/mcp', authorizationToken: 't' });
    expect(tool).toMatchObject({ type: 'mcp', server_url: 'https://example.com/mcp', require_approval: 'never' });
    expect((tool.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('writes host config for stdio and http', () => {
    expect(mcpServerConfig().mcpServers['omni-carousel']).toHaveProperty('command', 'npx');
    const http = mcpServerConfig({ mode: 'http', url: 'https://x/mcp', token: 'abc' });
    expect((http.mcpServers['omni-carousel'] as Record<string, unknown>).url).toBe('https://x/mcp');
  });
});
