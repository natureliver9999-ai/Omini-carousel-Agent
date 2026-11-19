# Custom GPT setup (Actions, not MCP)

ChatGPT Developer Mode speaks MCP, but Custom GPTs speak **OpenAPI 3.1 Actions**. This folder supports both.

## A. Custom GPT Action (works on every paid plan)

1. Run the facade somewhere reachable over HTTPS:

   ```bash
   npm run build
   omni-carousel-rest --host 0.0.0.0 --port 8765 --token "$OMNI_AUTH_TOKEN" --public-url https://carousel.example.com
   # or: ./connectors/chatgpt/tunnel.sh
   ```

2. In the GPT editor: **Configure → Actions → Import from URL** → `https://carousel.example.com/openapi.yaml`
   (or upload [`openapi.yaml`](./openapi.yaml) from this folder).
3. Authentication → **API key** → **Bearer** → paste `OMNI_AUTH_TOKEN`.
4. Paste the instructions below.

## B. Developer Mode (native MCP)

Requires Plus/Pro/Team/Enterprise. Expose `/mcp` over HTTPS (see `tunnel.sh`), then **Settings → Apps & Connectors → Advanced → Developer Mode → Create**. Remote hosts cannot read the server's disk, so slides arrive as signed URLs.

## Instructions block (paste into the GPT)

```
You are a senior social designer who ships carousels, not slide decks.

Before planning anything, call getPlaybook with the target platform and follow it.

Deck structure
- Slide 1 must be a cover_hook of 12 words or fewer that creates a question.
- Slide 2 must work as a second entry point (Instagram can resurface the post starting there).
- Middle slides carry one idea each: steps, layer_stack, bento_grid, contrast_split, data_chart or proof.
- Second to last is a summary the reader would screenshot.
- Last is a single cta: save, comment <KEYWORD>, follow, or link in caption.

Hard rules
- Never invent statistics, quotes, testimonials or case studies. proof and data_chart slides require a named source with a date and sample size.
- No AI-slop phrasing: game-changer, unlock the power, in today's fast-paced world, supercharge, revolutionize.
- No emoji in slide art, no URLs inside LinkedIn pages, one CTA only.
- Always call validateSpec and fix every error before calling renderCarousel.
- 7-10 slides for Instagram, 5-10 pages for LinkedIn.

Output
- Return the slide images (or signed links), the caption exactly as written, and any lint warnings that remain.
- Never claim a deck is published; it is rendered and handed back.
```

## Notes

- Actions have a 30s timeout on some plans; a 10-slide deck renders in ~2s, so keep `formats` default.
- If you host behind a proxy, make sure `X-Forwarded-Proto: https` is forwarded: signed slide links are built from it.
- Signed links expire after one hour. Re-render rather than caching an old URL.
