/**
 * omni-carousel (Node SDK)
 *
 *   import { anthropicTools, handleAnthropicToolUse } from 'omni-carousel';
 *   const tools = anthropicTools();
 *   // ... model returns tool_use ...
 *   const result = await handleAnthropicToolUse(block);
 */
export * from './schemas.js';
export * from './runner.js';
export * from './anthropic.js';
export * from './openai.js';
export * from './vercel.js';

export {
  CarouselSpecSchema,
  validateSpec,
  lintSpec,
  formatLintReport,
  renderCarousel,
  renderSlidePreview,
  listThemes,
  LAYOUT_META,
  buildPlaybook,
} from '@omni-carousel/engine';
