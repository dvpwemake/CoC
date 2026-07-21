# QA checklist — Field signals & public index (permanent)

**Owner (sign-off):** Dana Okonkwo — QA & Verification Engineer  
**Implementer (pipeline):** Nora Kim — Web & Site Engineering Lead  
**Go/no-go:** Marcus Hale — Release & Change Manager  
**Escalation:** Dr. Amara Okonkwo — CTO

## Never ship if any fail

1. **No markup in card text** — Open index in browser. Spot-check 12 cards. Title, summary, source must be plain language. Fail if you see `<`, `</`, `&lt;`, `cite index=`, or `[web:N]`.
2. **Sanitizer live** — `plainText` / `stripHtml` present in index + crawler-lib + editor save/publish.
3. **News preserved** — After any v2/deploy work, `data/archive.json` still contains prior batches + latest production batch titles. Count unique titles ≥ previous count.
4. **No duplicate heroes** — Only one `.ed-hero` on the page. `usedHeroImages` / drafts do not share the same `heroImage` as published.
5. **No duplicate thumbs in grid** — Same image URL must not appear on two visible cards (second uses category fallback).
6. **Load budget** — `index.html` under ~40KB without full archive embed; news loads from `data/archive.json`; first paint shows ≤12 cards + Load more.
6b. **Editorial length** — published piece ~300 words (band 280–320); page meta word count matches.
7. **Footer** — Terms, Privacy, Contact, **E** only. No “v2 staging”, no “Human voice…” taglines in header/footer.
8. **Legal pages** — `terms.html` and `privacy.html` open with brand chrome and link home.

## Cite-leak incident (closed, permanent gate)

- **Symptom:** Raw `<cite index="…">` on Artemis-style card summaries.
- **Cause:** AI citation markup stored in summary; `esc()` showed tags as text.
- **Primary responsibility for recurrence:** **Dana Okonkwo (QA)** — checklist item #1 is blocking.
- **Engineering ownership:** **Nora Kim (Web)** — ingest + render sanitizer; never accept unsanitized publish.
- **Data ownership:** **Leo Tran (Backup)** — archive merge on cutover so history is not lost.

Signed into IT worklog 2026-07-20.
