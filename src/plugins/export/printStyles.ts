/** Stylesheet embedded in standalone HTML exports and the print/PDF view. */
export const printStyles = `
  :root { color-scheme: light; }
  body.page-export {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.55;
    color: #1f2328;
    max-width: 46rem;
    margin: 2rem auto;
    padding: 0 1.25rem;
  }
  .page-export h1 { font-size: 1.9rem; } .page-export h2 { font-size: 1.5rem; } .page-export h3 { font-size: 1.25rem; }
  .page-export code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f3f4f6; border-radius: 4px; padding: 0.1em 0.3em; }
  .page-export pre { background: #f6f8fa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; }
  .page-export pre code { background: none; padding: 0; }
  .page-export blockquote { border-left: 3px solid #d1d5db; margin: 0; padding: 0.1rem 0 0.1rem 1rem; color: #4b5563; }
  .page-export table { border-collapse: collapse; width: 100%; }
  .page-export th, .page-export td { border: 1px solid #d1d5db; padding: 0.35rem 0.6rem; text-align: left; vertical-align: top; }
  .page-export th { background: #f3f4f6; }
  .page-export ul[data-type='taskList'] { list-style: none; padding-left: 1.2rem; }
  .page-export li[data-type='taskItem']::before { content: '\\2610\\00a0'; }
  .page-export li[data-type='taskItem'][data-checked='true']::before { content: '\\2611\\00a0'; }
  .page-columns { display: flex; gap: 1.25rem; align-items: flex-start; }
  .page-columns[data-layout='grid'] { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); }
  .page-column { min-width: 0; }
  .page-callout { border-radius: 8px; padding: 0.75rem 1rem; margin: 0.5rem 0; background: #eff6ff; }
  .page-callout--success { background: #ecfdf5; } .page-callout--warning { background: #fffbeb; }
  .page-callout--danger { background: #fef2f2; } .page-callout--neutral { background: #f3f4f6; }
  figure.page-media { margin: 0.75rem 0; }
  figure.page-media img, figure.page-media video { max-width: 100%; border-radius: 6px; }
  figure.page-media[data-align='center'] { margin-left: auto; margin-right: auto; text-align: center; }
  figure.page-media[data-align='right'] { margin-left: auto; text-align: right; }
  figure.page-media figcaption { color: #6b7280; font-size: 0.85rem; margin-top: 0.25rem; }
  .page-embed-fallback { border: 1px dashed #d1d5db; border-radius: 8px; padding: 0.5rem 1rem; color: #6b7280; }
  @page { margin: 2cm; }
  @media print {
    body.page-export { margin: 0; max-width: none; }
    .page-export a { color: inherit; text-decoration: none; }
  }
`
