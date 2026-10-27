// Block plugins. Each folder is self-contained.
// - `callout`: example embed block — a plain React component bound with defineBlock (model.ts: schema,
//   template, actions — pure; Callout.tsx: the component; index.tsx: binding + plugin).
// - `table`: editor-native node (Tiptap table extensions) styled with the editor tokens.
export { breadcrumbPlugin } from './breadcrumb'
export { calloutPlugin } from './callout'
export { equationPlugin } from './equation'
export { mermaidPlugin } from './mermaid'
export { cardPlugin } from './card'
export { tablePlugin } from './table'
export { tabsPlugin } from './tabs'
export { togglePlugin, insertToggleFromSelection, setToggleHeadingOnEmbed } from './toggle'
