# Editorial body typography — plain text only

Shared by public `/articles/[id]` and admin saved preview, across all sections.
No content rewrite, schema change, HTML input, Markdown engine or new dependency.

Rules:

- Blank lines separate paragraphs; repeated blank lines do not increase spacing.
- Single newlines within a paragraph stay visible as line breaks.
- Lines starting with `1. ` through `99. ` and nonblank text become h2 headings.
  Numbers remain visible. These are section headings, not an ordered-list syntax.
- Lines starting exactly with `## ` and nonblank text become h2 headings with
  the marker removed. No arbitrary short sentence is inferred to be a heading.
- Consecutive `• ` or `- ` lines with nonblank text form a ul/li list. Blank lines
  or other blocks end the list. No nested-list or inline formatting syntax.
- CRLF/CR line endings normalize to LF. Other Markdown and all HTML stay escaped
  literal text. URLs are not automatically converted into links.
- Use unindented marker lines. Empty markers, 0/100+ numbering and decimal values
  do not become headings. Start with normal prose if a numbered line is not
  intended as a section heading.

Typography: h2 20px mobile / 24px larger screens; body 16px with 28px line height;
paragraph/list bottom gap 16px, heading top gap 32px / bottom 12px; readable 65ch
measure; list indentation and long-token wrapping. Theme and card style retained.

## Seongsu draft operator step

No Production draft was read or modified by this implementation. The exact draft
ID/authenticated administrator access was not provided. Do not use elevated keys
or select a draft by an assumed title. No factual content should be changed.

In the confirmed draft's Body ONLY, prefix these three intended heading lines:

```text
## A better way to experience Seongsu
## Planning a Seongsu visit?
## Already visited a Seongsu pop-up?
```

Leave their text and all other content unchanged. Existing numbered headings
need no edits. Save draft (not Publish), then inspect the saved preview once this
renderer is available. Local original manuscripts/content pack remain unchanged.

Regression tests: `tests/editorial-body-security.mjs` covers the grammar, actual
React escaping and existing manuscripts. `tests/discovery-browser.mjs` checks
Guides public/admin rendering, legacy paragraphs, malicious literal text,
headings/lists/spacing and mobile overflow using localhost fixtures only.
