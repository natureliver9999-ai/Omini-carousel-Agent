# Hook Library

A hook is the first 12 words a reader sees. These are the six formulas that survive contact with a mobile feed, with fill-in-the-blank patterns and the failure mode of each.

## 1. Contrarian claim

> "Half of what you know about carousels is backwards."

- **Why it works:** creates an identity threat ("am I wrong?") that only reading resolves.
- **Fails when:** the deck does not actually disagree with anything.
- **Agent rule:** the deck must name the mainstream belief in slide 2 and refute it with evidence, not vibes.

## 2. Specific number + outcome + timeframe

> "We cut render time from 40 seconds to 0.4 with one contract."

- **Why it works:** specificity is the cheapest credibility signal available.
- **Fails when:** the number is invented. The linter requires a `source` on any `proof` slide, and the playbook forbids fabricated stats anywhere.
- **Agent rule:** if you cannot cite it, use a mechanism hook instead.

## 3. Mistake callout

> "Your carousel dies on slide two. Here's why."

- **Why it works:** names a cost the reader has already paid.
- **Fails when:** the mistake is trivial or the fix arrives four slides later.
- **Agent rule:** the fix must land by slide 3.

## 4. Before / after

> "Same audience, same offer, 3× the saves."

- **Why it works:** the delta is the story; the reader fills in the gap themselves.
- **Fails when:** the "before" is a strawman nobody actually does.
- **Agent rule:** use `contrast_split` with identical geometry so the flip is visible, not described.

## 5. Question that indicts

> "If your best post is five slides long, why are you posting fifteen?"

- **Why it works:** a question the reader must answer internally to continue.
- **Fails when:** it is a rhetorical question with an obvious answer.
- **Agent rule:** the question must be answerable only by swiping.

## 6. Receipt / primary source

> "67.5 million posts later, carousels still lead Instagram engagement."

- **Why it works:** borrowed authority with a checkable trail.
- **Fails when:** the source is a blog quoting another blog.
- **Agent rule:** cite the study, the sample size and the date on the slide.

---

## Anti-patterns (auto-flagged by the linter)

| Pattern | Example | Why it fails |
|---|---|---|
| Throat-clearing | "In today's fast-paced world…" | Wastes the only frame everyone sees |
| Self-introduction | "Hi, I'm Alex and I help…" | Nobody has agreed to care yet |
| Vague promise | "Unlock the power of…" | No verifiable outcome |
| Adjective stack | "A cutting-edge, seamless, game-changing…" | Unfalsifiable and forgettable |
| Topic label | "Social media strategy tips" | A label is not a hook; there is nothing to resolve |

## Scoring a hook before publishing

Answer yes to at least four:

1. Is it ≤ 12 words?
2. Does it name a cost, a number, or a belief?
3. Could someone disagree with it?
4. Does it work with no caption and no context?
5. Does it create a question the next slide answers?
