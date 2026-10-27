# Export / import plugin

Pure converters between the page's TipTap JSON and Markdown, HTML, Word (.docx) and a print/PDF
route, plus a toolbar menu ("Export") with file download and Markdown/HTML import.

- `toMarkdown` / `fromMarkdown` — `markdown.ts`
- `toHtml` / `fromHtml` — `html.ts` (standalone documents embed `printStyles`; the same
  data attributes as the editor schema, so exported HTML re-imports losslessly and pastes cleanly)
- `toDocx` — `docx.ts` + `zip.ts` (dependency-free: stored ZIP + WordprocessingML)
- PDF — the print dialog over the standalone HTML (`download.ts`)
- `fromMarkdown` / `fromHtml` return TipTap JSON; the toolbar import inserts it at the cursor.

No new npm dependencies.

## Pasted content

Every paste, including a copy from this editor, is cleaned at the DOM level before the editor reads it: script, iframe, svg and similar elements, `on*` attributes, inline styles that load resources, and URLs outside the allowlist (`isSafeUrl`) are removed. Editor data attributes are kept. Media sources, link targets and breadcrumb links are also checked by their schemas, so JSON entered another way is not rendered with an unsafe URL. Checked once in desktop headless Chrome with real copy and paste handlers (synthetic clipboard events): copying the whole demo page and pasting it back doubled the tables, columns, media, list items and top-level blocks exactly, and a hostile payload with a marker, handlers, `javascript:` URLs and a script left nothing executable in the page. Not covered: other browsers, real OS clipboard, the contents of other blocks' `data-props` beyond their own schema validation, and typing/input rules.

HTML export writes text colour and highlight into inline styles only when the value is a plain colour (hex, a colour name, or `rgb()`/`hsl()`). Any other value is left out, so a stored value cannot add attributes or markup to the exported file.

## Lossy conversions (all tested)

| Feature                                      | Markdown                                                       | Word (.docx)                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Text colour / highlight                      | dropped (marks lost)                                           | kept as run color / shading                                                                              |
| Bullet/number marker styles (square, alpha…) | dropped (`-` / `1.`)                                           | dropped (literal `•` / `1.`)                                                                             |
| Lists                                        | round-trip                                                     | literal bullet characters, not Word auto-numbering                                                       |
| Columns / grid layout                        | flattened to a top-to-bottom sequence (text kept)              | flattened like Markdown                                                                                  |
| Toggle (details)                             | bold `▸ summary` line + content (not a toggle)                 | same as Markdown                                                                                         |
| Callout variant colour                       | dropped (title + body kept as quote)                           | fixed blue styling (title + body kept)                                                                   |
| Non-callout embed blocks                     | `[type block]` placeholder                                     | `[type block]` placeholder                                                                               |
| Table colspan/rowspan                        | dropped (GFM tables are flat)                                  | kept (gridSpan / vMerge)                                                                                 |
| Image width / align                          | dropped (`![caption](src)`)                                    | width kept (capped at 600px), align dropped; aspect ratio read from PNG/GIF/JPEG headers (0.75 fallback) |
| Video                                        | `<video>` tag + caption (not playable in all Markdown viewers) | `[Video: src]` link                                                                                      |
| Remote images                                | `![caption](src)`                                              | `[Image: src]` link (only data-URL images are embedded)                                                  |
| Heading levels 5–6                           | round-trip                                                     | exported as Heading 4                                                                                    |

HTML export/import is the lossless route for everything above; `fromHtml(toHtml(doc))`
round-trips the full fixture exactly (see `html.test.ts`).

## Import subset

`fromMarkdown` covers headings, paragraphs, hard breaks, bold/italic/underline/strike/code/links,
bullet/ordered/task lists (nested), blockquotes, fenced code, horizontal rules, GFM tables and
whole-line `![alt](src)` images. `fromHtml` covers the tags the exporter emits plus common foreign
HTML (headings, paragraphs, lists including checkbox lists, quotes, pre/code, tables with spans,
details, figures, standalone img/video, styled spans); unknown containers are flattened, never dropped.

## Media source policy

`isSafeUrl` stays the check for links. Media sources use `isSafeMediaSource(kind, url)` from the core index:
http(s) and relative paths for every kind, plus inline `data:` URLs of exact types only, per kind (image: png,
jpeg, gif, webp, avif; video: mp4, webm, ogg; audio: mpeg, mp3, wav, ogg, webm, mp4, aac; file: pdf, plain
text, csv, zip). No wildcards, no SVG or HTML. A data URL of one kind is refused for another, and audio or file
data URLs are refused by `isSafeUrl`, so they cannot become links or images. Embeds use a host allowlist in the
media plugin. Block specs can set `bubbleless` to keep the text bubble toolbar off their node selection.

## Stored files in exports

Exports first call `prepareForExport` (src/plugins/export/host.ts). A host sets `setExportHost({ prepare, onOmitted })`;
the demo passes the media plugin's `inlineStoredFiles` (stored files become data URLs when allowed and within 8 MB)
and shows a notice listing how many files were left out and why, while the exported file carries its own
"not included" note. Without a host nothing changes. If preparing fails the original document is exported and the
notice says so. Checked in desktop Chrome for one stored PNG in HTML export only; the omission notice, Markdown,
Word and print paths with stored files were not browser-checked.
