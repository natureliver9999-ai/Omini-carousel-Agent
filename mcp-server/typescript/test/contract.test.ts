import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createOmniServer, SERVER_NAME } from '../src/server.js';

/**
 * MCP conformance: the surface is the contract. A host that trusts our tool list
 * must find the same nine tools, three resources and one prompt on every release.
 */
const EXPECTED_TOOLS = [
  'fetch_asset',
  'get_playbook',
  'list_layouts',
  'list_themes',
  'make_chart',
  'make_diagram',
  'preview_slide',
  'render_carousel',
  'validate_spec',
].sort();

let client: Client;
let close: () => Promise<void>;

beforeEach(async () => {
  const server = createOmniServer({ quiet: true });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: 'conformance', version: '1.0.0' }, { capabilities: {} });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  close = async () => {
    await client.close();
  };
});

afterEach(async () => {
  await close();
});

describe('MCP surface', () => {
  it('identifies itself', () => {
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
  });

  it('exposes exactly the documented tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);
  });

  it('gives every tool a description and an object input schema', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('exposes the playbook and schema resources', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((resource) => resource.uri);
    expect(uris).toContain('carousel://playbook');
    expect(uris).toContain('carousel://schema.json');
  });

  it('exposes a themed resource template', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((template) => template.uriTemplate)).toContain('carousel://themes/{id}');
  });

  it('exposes the create_carousel prompt with its arguments', async () => {
    const { prompts } = await client.listPrompts();
    const prompt = prompts.find((entry) => entry.name === 'create_carousel');
    expect(prompt).toBeTruthy();
    expect(prompt?.arguments?.map((argument) => argument.name)).toEqual(
      expect.arrayContaining(['topic', 'platform', 'goal']),
    );
  });
});

describe('MCP tool behaviour', () => {
  it('lists the twelve layouts, including the generative plot', async () => {
    const result = await client.callTool({ name: 'list_layouts', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const parsed = JSON.parse(text);
    const layouts = parsed.layouts ?? parsed;
    expect(layouts).toHaveLength(12);
    expect(layouts.map((layout: { id: string }) => layout.id)).toContain('generative');
  });

  it('lists themes with contrast audits', async () => {
    const result = await client.callTool({ name: 'list_themes', arguments: {} });
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    const ids = (parsed.themes ?? parsed).map((theme: { id: string }) => theme.id);
    expect(ids).toEqual(expect.arrayContaining(['editorial', 'brutal-bento', 'scrapbook', 'linkedin-executive']));
  });

  it('reports a validation failure as an error result, not a crash', async () => {
    const result = await client.callTool({
      name: 'validate_spec',
      arguments: {
        spec: {
          version: '1.0',
          platform: 'instagram',
          theme: 'editorial',
          slides: [
            { layout: 'steps', headline: 'Start with process', steps: [{ title: 'One' }, { title: 'Two' }] },
            { layout: 'cta', headline: 'Save it', action: 'save', text: 'Save this deck.' },
          ],
        },
      },
    });
    // validate_spec is a *reporting* tool: the call succeeds and the report says no.
    // render_carousel is where an invalid deck becomes a hard error.
    expect(result.isError ?? false).toBe(false);
    const blocks = result.content as Array<{ text: string }>;
    expect(blocks[0].text).toContain('FIRST_SLIDE_NOT_COVER');
    const report = JSON.parse(blocks[1].text);
    expect(report.ok).toBe(false);
    expect(report.errors.map((issue: { code: string }) => issue.code)).toContain('FIRST_SLIDE_NOT_COVER');
  });

  it('rejects a structurally invalid spec at the protocol layer', async () => {
    await expect(
      client.callTool({ name: 'validate_spec', arguments: { spec: { version: '1.0' } } }),
    ).rejects.toThrow(/Invalid arguments|-32602/);
  });

  it('rejects an unknown tool name', async () => {
    await expect(client.callTool({ name: 'delete_everything', arguments: {} })).rejects.toThrow();
  });

  it('reads the playbook resource as markdown', async () => {
    const result = await client.readResource({ uri: 'carousel://playbook' });
    const first = result.contents[0] as { text?: string; mimeType?: string };
    expect(first.text?.length ?? 0).toBeGreaterThan(200);
  });
});
