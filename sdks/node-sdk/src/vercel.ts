/**
 * Vercel AI SDK v5+ integration.
 *
 * v5 replaced `parameters` with `inputSchema` (Zod) and added `outputSchema`.
 * `vercelTools()` returns ready-to-spread tools whose `execute` runs locally.
 */
import { z } from 'zod';
import { runTool, type RunOptions } from './runner.js';
import { TOOL_DESCRIPTIONS, TOOL_NAMES, ToolInputs, type ToolName } from './schemas.js';

export interface VercelToolDefinition {
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (input: unknown, options?: unknown) => Promise<unknown>;
}

/** Tools keyed by name, ready for `generateText({ tools })` / `streamText`. */
export function vercelTools(options: RunOptions = {}): Record<string, VercelToolDefinition> {
  const tools: Record<string, VercelToolDefinition> = {};
  for (const name of TOOL_NAMES) {
    tools[name] = {
      description: TOOL_DESCRIPTIONS[name],
      inputSchema: ToolInputs[name],
      execute: async (input: unknown) => {
        const result = await runTool(name as ToolName, input, options);
        return result.images?.length
          ? { text: result.text, images: result.images.map((image) => `data:${image.mimeType};base64,${image.base64}`) }
          : result.text;
      },
    };
  }
  return tools;
}

/** `mcpServerConfig` snippet for hosts that read a JSON config file. */
export function mcpServerConfig(
  options: { mode?: 'stdio' | 'http'; url?: string; token?: string; outputDir?: string } = {},
): Record<string, unknown> {
  const mode = options.mode ?? 'stdio';
  if (mode === 'http') {
    return {
      mcpServers: {
        'omni-carousel': {
          url: options.url ?? 'http://127.0.0.1:8765/mcp',
          ...(options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : {}),
        },
      },
    };
  }
  return {
    mcpServers: {
      'omni-carousel': {
        command: 'npx',
        args: ['-y', 'omni-carousel-mcp'],
        ...(options.outputDir ? { env: { OMNI_OUTPUT_DIR: options.outputDir } } : {}),
      },
    },
  };
}
