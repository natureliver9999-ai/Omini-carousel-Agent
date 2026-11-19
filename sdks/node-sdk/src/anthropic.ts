/**
 * Anthropic integration.
 *
 * Two shapes:
 *   1. `anthropicTools()` — local function calling; you run the tools yourself.
 *   2. `anthropicMcpServer()` — native remote MCP. Beta `mcp-client-2025-11-20`
 *      requires BOTH `mcp_servers` and a matching `mcp_toolset` entry in `tools`;
 *      declaring only the server is rejected by the API.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { runTool, type RunOptions, type ToolResult } from './runner.js';
import { TOOL_DESCRIPTIONS, TOOL_NAMES, ToolInputs, type ToolName } from './schemas.js';

export const ANTHROPIC_MCP_BETA = 'mcp-client-2025-11-20';

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function anthropicTools(): AnthropicTool[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    input_schema: zodToJsonSchema(ToolInputs[name], { $refStrategy: 'none', target: 'jsonSchema7' }) as Record<string, unknown>,
  }));
}

/** Executes an Anthropic `tool_use` block and returns a `tool_result` content block. */
export async function handleAnthropicToolUse(
  block: { name: string; input: unknown },
  options: RunOptions = {},
): Promise<{ type: 'tool_result'; tool_use_id?: string; content: unknown[]; is_error?: boolean }> {
  const result: ToolResult = await runTool(block.name as ToolName, block.input, options);
  const content: unknown[] = [{ type: 'text', text: result.text }];
  for (const image of result.images ?? []) {
    content.push({ type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } });
  }
  return { type: 'tool_result', content, is_error: result.isError === true };
}

export interface AnthropicMcpOptions {
  url: string;
  name?: string;
  authorizationToken?: string;
  /** Restrict which tools the model may call on that server. */
  allowedTools?: string[];
}

/** Request fragment for a native remote MCP connector (Messages API). */
export function anthropicMcpServer(options: AnthropicMcpOptions): {
  betas: string[];
  mcp_servers: Array<Record<string, unknown>>;
  tools: Array<Record<string, unknown>>;
} {
  const name = options.name ?? 'omni-carousel';
  const toolset: Record<string, unknown> = { type: 'mcp_toolset', mcp_server_name: name };
  if (options.allowedTools?.length) toolset.default_config = { enabled: false, allowed_tools: options.allowedTools };
  return {
    betas: [ANTHROPIC_MCP_BETA],
    mcp_servers: [{
      type: 'url',
      url: options.url,
      name,
      ...(options.authorizationToken ? { authorization_token: options.authorizationToken } : {}),
    }],
    tools: [toolset],
  };
}
