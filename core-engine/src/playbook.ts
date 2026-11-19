/**
 * The playbook is the agent's craft knowledge, shipped as Markdown so it can be
 * read by a human, pasted into a prompt, or served as an MCP resource.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const PLAYBOOK_TOPICS = ['instagram', 'linkedin', 'hooks', 'patterns', 'layouts', 'index'] as const;
export type PlaybookTopic = (typeof PLAYBOOK_TOPICS)[number];

function playbookDirs(): string[] {
  return [
    path.resolve(HERE, '../playbook'),
    path.resolve(HERE, '../../playbook'),
    path.resolve(HERE, '../../spec/playbook'),
    path.resolve(HERE, '../../../spec/playbook'),
    path.resolve(process.cwd(), 'spec/playbook'),
  ];
}

export function playbookPath(topic: PlaybookTopic): string | null {
  for (const dir of playbookDirs()) {
    const candidate = path.join(dir, `${topic}.md`);
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

const FALLBACK: Record<PlaybookTopic, string> = {
  index: '# Carousel playbook\n\nInstagram: 7-10 slides, 4:5, hook <= 12 words. LinkedIn: 5-10 PDF pages, no in-slide links, named sources.',
  instagram: '# Instagram\n\n7-10 slides at 1080x1350. Slide 2 must survive resurfacing. End with one save/comment action.',
  linkedin: '# LinkedIn\n\nExport as a 1080x1350 multi-page PDF, 5-10 pages, dwell-time copy, named sources, no URLs in the art.',
  hooks: '# Hooks\n\nContrarian, specific-number, mistake, before/after, question, receipt. <= 12 words, no setup.',
  patterns: '# Patterns\n\nPanorama, contrast, layer stack, reveal & hold, bento, scrapbook.',
  layouts: '# Layouts\n\ncover_hook, contrast_split, layer_stack, bento_grid, reveal_hold, scrapbook, data_chart, steps, proof, summary, cta.',
};

export function buildPlaybook(topic: PlaybookTopic = 'index'): string {
  const file = playbookPath(topic);
  if (file) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      /* fall through */
    }
  }
  return FALLBACK[topic] ?? FALLBACK.index;
}

/** Concatenated playbook, used for `carousel://playbook` style resources. */
export function buildFullPlaybook(): string {
  return PLAYBOOK_TOPICS.filter((t) => t !== 'index').map((topic) => buildPlaybook(topic)).join('\n\n---\n\n');
}
