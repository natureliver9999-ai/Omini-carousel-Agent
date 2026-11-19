/**
 * OpenAI integration: Responses API + Chat Completions function tools,
 * plus the native `type: "mcp"` remote tool.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import { runTool, type RunOptions, type ToolResult } from './runner.js';
import { TOOL_DESCRIPTIONS, TOOL_NAMES, ToolInputs, type ToolName } from './schemas.js';

export interface OpenAIFunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

/** Responses API function tools (flat shape). */
export function openaiTools(options: { strict?: boolean } = {}): OpenAIFunctionTool[] {
  return TOOL_NAMES.map((name) => ({
    type: 'function' as const,
    name,
    description: TOOL_DESCRIPTIONS[name],
    parameters: zodToJsonSchema(ToolInputs[name], { $refStrategy: 'none', target: 'jsonSchema7' }) as Record<string, unknown>,
    ...(options.strict ? { strict: true } : {}),
  }));
}

/** Chat Completions shape (nested under `function`). */
export function openaiChatTools(options: { strict?: boolean } = {}): Array<Record<string, unknown>> {
  return openaiTools(options).map(({ type, name, description, parameters, strict }) => ({
    type,
    function: { name, description, parameters, ...(strict ? { strict } : {}) },
  }));
}

export async function handleOpenAIToolCall(
  call: { id: string; function: { name: string; arguments: string } },
  options: RunOptions = {},
): Promise<{ role: 'tool'; tool_call_id: string; content: string }> {
  let args: unknown = {};
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch (error) {
    return { role: 'tool', tool_call_id: call.id, content: `Invalid JSON arguments: ${(error as Error).message}` };
  }
  const result: ToolResult = await runTool(call.function.name as ToolName, args, options);
  return { role: 'tool', tool_call_id: call.id, content: result.text };
}

export interface OpenAIMcpOptions {
  url: string;
  label?: string;
  authorizationToken?: string;
  requireApproval?: 'never' | 'always';
  allowedTools?: string[];
}

/** Responses API native remote MCP tool. */
export function openaiMcpTool(options: OpenAIMcpOptions): Record<string, unknown> {
  return {
    type: 'mcp',
    server_label: options.label ?? 'omni_carousel',
    server_url: options.url,
    ...(options.authorizationToken ? { headers: { Authorization: `Bearer ${options.authorizationToken}` } } : {}),
    require_approval: options.requireApproval ?? 'never',
    ...(options.allowedTools?.length ? { allowed_tools: options.allowedTools } : {}),
  };
}
