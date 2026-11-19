/**
 * `fetch_asset`: the only place the engine talks to the network.
 *
 * Every response carries its license and attribution metadata so a rendered
 * bundle can prove where each pixel came from. Without API keys the engine still
 * answers, with generated theme-native art instead of stock photography — a
 * carousel never fails to render because a key is missing.
 */
import { guardedFetch, MAX_BYTES } from './guard.js';
import type { AttributionRecord } from '../bundle.js';

export type AssetProvider = 'unsplash' | 'pexels' | 'pattern' | 'icon' | 'none';

export interface FetchAssetRequest {
  provider?: AssetProvider;
  query?: string;
  /** Unsplash/pexels photo id, when the agent already knows the asset. */
  id?: string;
  width?: number;
  height?: number;
  /** Theme accent, used by the offline `pattern` generator. */
  accent?: string;
  background?: string;
  /** Deterministic seed for generated art (defaults to the query). */
  seed?: string;
}

export interface AssetResult {
  provider: AssetProvider;
  kind: 'photo' | 'generated';
  /** base64 data URI ready to drop into an SVG <image href>. */
  data_uri?: string;
  width: number;
  height: number;
  alt: string;
  attribution: AttributionRecord;
  note?: string;
}

function keyFor(provider: 'unsplash' | 'pexels'): string | undefined {
  return provider === 'unsplash' ? process.env.UNSPLASH_ACCESS_KEY : process.env.PEXELS_API_KEY;
}

export async function fetchAsset(request: FetchAssetRequest): Promise<AssetResult> {
  const width = Math.min(2400, Math.max(200, request.width ?? 1080));
  const height = Math.min(2400, Math.max(200, request.height ?? 1350));
  const query = (request.query ?? 'abstract texture').slice(0, 120);

  switch (request.provider) {
    case 'unsplash': {
      const key = keyFor('unsplash');
      if (!key) return generatedPattern(request, width, height, 'UNSPLASH_ACCESS_KEY is not set');
      return unsplashSearch(key, query, width, height);
    }
    case 'pexels': {
      const key = keyFor('pexels');
      if (!key) return generatedPattern(request, width, height, 'PEXELS_API_KEY is not set');
      return pexelsSearch(key, query, width, height);
    }
    case 'icon':
    case 'pattern':
    case 'none':
    case undefined:
      return generatedPattern(request, width, height);
    default:
      throw new Error(`Unknown provider "${String(request.provider)}". Use unsplash | pexels | pattern | icon.`);
  }
}

async function unsplashSearch(key: string, query: string, width: number, height: number): Promise<AssetResult> {
  const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait&content_filter=high`;
  const response = await guardedFetch(searchUrl, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  const json = JSON.parse(response.bytes.toString('utf8')) as {
    results?: Array<{
      id: string;
      alt_description?: string;
      description?: string;
      urls: { regular: string; raw: string };
      user: { name: string; username: string; links: { html: string } };
      links: { html: string; download_location: string };
    }>;
  };
  const photo = json.results?.[0];
  if (!photo) throw new Error(`Unsplash returned no results for "${query}"`);
  const imageUrl = `${photo.urls.raw}&w=${width}&h=${height}&fit=crop&fm=jpg&q=82`;
  const image = await guardedFetch(imageUrl, {}, { maxBytes: MAX_BYTES });
  // Unsplash's API guidelines require pinging the download endpoint when an image is used.
  await guardedFetch(photo.links.download_location, {
    headers: { Authorization: `Client-ID ${key}` },
  }).catch(() => undefined);
  return {
    provider: 'unsplash',
    kind: 'photo',
    data_uri: `data:${image.contentType.split(';')[0]};base64,${image.bytes.toString('base64')}`,
    width,
    height,
    alt: photo.alt_description ?? photo.description ?? query,
    attribution: {
      provider: 'unsplash',
      asset: photo.id,
      photographer: photo.user.name,
      photographer_url: photo.user.links.html,
      source_url: photo.links.html,
      license: 'Unsplash License — attribution required by API guidelines',
    },
  };
}

async function pexelsSearch(key: string, query: string, width: number, height: number): Promise<AssetResult> {
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const response = await guardedFetch(searchUrl, { headers: { Authorization: key } });
  const json = JSON.parse(response.bytes.toString('utf8')) as {
    photos?: Array<{
      id: number;
      alt?: string;
      photographer: string;
      photographer_url: string;
      url: string;
      src: { original: string; large2x: string };
    }>;
  };
  const photo = json.photos?.[0];
  if (!photo) throw new Error(`Pexels returned no results for "${query}"`);
  const image = await guardedFetch(photo.src.large2x, {}, { maxBytes: MAX_BYTES });
  return {
    provider: 'pexels',
    kind: 'photo',
    data_uri: `data:${image.contentType.split(';')[0]};base64,${image.bytes.toString('base64')}`,
    width,
    height,
    alt: photo.alt ?? query,
    attribution: {
      provider: 'pexels',
      asset: String(photo.id),
      photographer: photo.photographer,
      photographer_url: photo.photographer_url,
      source_url: photo.url,
      license: 'Pexels License — attribution appreciated',
    },
  };
}

/** Offline, deterministic abstract art: gradients + geometry in the deck's palette. */
export function generatedPattern(request: FetchAssetRequest, width: number, height: number, note?: string): AssetResult {
  const accent = request.accent ?? '#B8331A';
  const background = request.background ?? '#FAF7F2';
  const seed = request.seed ?? request.query ?? 'omni';
  const svg = patternSvg(seed, width, height, accent, background);
  return {
    provider: 'pattern',
    kind: 'generated',
    data_uri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    width,
    height,
    alt: `Generated abstract pattern (${seed})`,
    attribution: {
      provider: 'engine',
      asset: `pattern:${seed}`,
      license: 'MIT (generated by omni-carousel-agent)',
    },
    note,
  };
}

function patternSvg(seed: string, width: number, height: number, accent: string, background: string): string {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rand = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shapes: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const r = 80 + rand() * Math.min(width, height) * 0.45;
    shapes.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${accent}" opacity="${(0.05 + rand() * 0.12).toFixed(2)}"/>`);
  }
  shapes.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="2"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${background}"/><stop offset="1" stop-color="${accent}" stop-opacity="0.22"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>${shapes.join('')}</svg>`;
}
