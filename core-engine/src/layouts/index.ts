import type { Node } from '../svg.js';
import type { SlideContext } from '../scene.js';
import type { SlideLayout } from '../schema.js';
import { coverHookLayout } from './cover_hook.js';
import { contrastSplitLayout } from './contrast_split.js';
import { layerStackLayout } from './layer_stack.js';
import { bentoGridLayout } from './bento_grid.js';
import { revealHoldLayout } from './reveal_hold.js';
import { scrapbookLayout } from './scrapbook.js';
import { dataChartLayout } from './data_chart.js';
import { stepsLayout } from './steps.js';
import { proofLayout } from './proof.js';
import { summaryLayout } from './summary.js';
import { ctaLayout } from './cta.js';
import { generativeLayout } from './generative.js';

export type LayoutFn = (ctx: SlideContext) => Node[];

export const LAYOUTS: Record<SlideLayout, LayoutFn> = {
  cover_hook: coverHookLayout,
  contrast_split: contrastSplitLayout,
  layer_stack: layerStackLayout,
  bento_grid: bentoGridLayout,
  reveal_hold: revealHoldLayout,
  scrapbook: scrapbookLayout,
  data_chart: dataChartLayout,
  steps: stepsLayout,
  proof: proofLayout,
  summary: summaryLayout,
  cta: ctaLayout,
  generative: generativeLayout,
};

export { layerSequencePosition } from './layer_stack.js';

export function drawSlide(ctx: SlideContext): Node[] {
  const layout = LAYOUTS[ctx.slide.layout];
  if (!layout) throw new Error(`Unknown layout "${ctx.slide.layout}"`);
  return layout(ctx);
}
