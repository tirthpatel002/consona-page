/** Browser UI and plugin authoring API. Import the package stylesheet once in the host app. */
export * from '../editor/core'
// Hosts constructing detached editors need the same extension composition as the UI.
export { createExtensions } from '../editor/core/registry/createExtensions'
export { PanelStore } from '../editor/core/plugin/panelStore'
export { SlashStore } from '../editor/core/slash/slashStore'
