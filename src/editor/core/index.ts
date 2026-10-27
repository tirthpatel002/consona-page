// Public API of the editor core. Plugins and the app import from here only.
export type { JsonObject, JsonPrimitive, JsonValue } from './json'
export { isJsonObject, toJsonObject } from './json'
export type {
  BlockAction,
  BlockActionContext,
  BlockDefinition,
  BlockHost,
  BlockMeta,
  BlockModule,
  BlockPropsAction,
  BlockRenderContext,
  BlockTarget,
  BlockValidation,
  ResolvedPropsAction,
} from './block/types'
export { defineBlock, formatIssues } from './block/defineBlock'
export {
  DEFAULT_BLOCK_PRESENTATION,
  NATIVE_SHELL_FEEDBACK,
  PAGE_BLOCK_SHELL_CLASS,
  resolveBlockPresentation,
  type BlockFeedbackTarget,
  type BlockPresentation,
} from './block/blockPresentation'
export { BLOCK_NODE_NAME } from './block/blockNodeOptions'
export { getBlockModule } from './block/getBlockModule'
export type { OverlayDefinition, PagePlugin, PanelDefinition } from './plugin/types'
export { blockPlugin } from './plugin/blockPlugin'
export type { SlashItem } from './slash/types'
export { filterSlashItems } from './slash/filterSlashItems'
export type { ToolbarItem, ToolbarItemContext } from './toolbar/types'
export type {
  BlockToolbarAction,
  BlockToolbarDefinition,
  BlockToolbarGroup,
  BlockToolbarMenu,
  MenuRequest,
} from './toolbar/blockToolbarDefinition'
export type { Operation } from './operations/defineOperation'
export { defineOperation, operationOf, OPERATION_META } from './operations/defineOperation'
export {
  deleteRange,
  insertBlock,
  insertContentAt,
  updateBlockProps,
  setLink,
  setMark,
  toggleMark,
  unsetLink,
  unsetMark,
} from './operations/operations'
export {
  DRAG_RANGE_STORAGE,
  DROP_TARGET_STORAGE,
  type DragRangeStorage,
  type DropProposal,
  type DropTargetStorage,
} from './gutter/pointerDrag'
export {
  blockEntries,
  nestedConfig,
  nestedContainers,
  NESTED_BLOCKS_STORAGE,
  type BlockEntry,
  type NestedBlocksStorage,
} from './gutter/blockEntries'
export { documentIdentityExtension } from './identity'
export type { EditorUiStores } from './registry/createExtensions'
export { KEEP_PLUGIN_SELECTION_META } from './gutter/BlockGutter'
export { BLOCK_REMOVAL_META, moveBlocksTo, restoreVersion } from './operations/operations'
export { autoScrollDelta } from './gutter/dropTarget'
export { Icon, lucideStrokeForSize, type IconName } from './ui/Icon'
export { Popover, type PopoverProps } from './ui/Popover'
export { Menu, type MenuEntry } from './ui/Menu'
export { ColorPicker, type ColorChoice, type ColorPickerProps } from './ui/ColorPicker'
export { createTestEditor, typeText, type TestEditor } from './testing/createTestEditor'
export type { PageRegistry } from './registry/composePlugins'
export { composePlugins, PluginConflictError, BLOCK_SLASH_GROUP } from './registry/composePlugins'
export { PageEditor, usePageController, type PageController, type PageControllerOptions } from './PageEditor'
export { Toolbar } from './toolbar/Toolbar'
export { historyToolbarItems, pageToolbarItems } from './toolbar/coreItems'
export { VersionsModal } from './versions/VersionsModal'
export { isMenuNavKey, moveActiveIndex, type MenuNavKey } from './menu/menuNavigation'
export { placeFloating, useFloatingPlacement } from './ui/placement'
export type { AnchorRect, FloatingPlacement, PlacementOptions } from './ui/placement'
export {
  TURN_INTO_SECTION,
  TURN_INTO_UNSUPPORTED,
  TEXT_SOURCE_TYPES,
  ANY_BLOCK_SOURCE,
  sourceMatches,
  definitionFitsTargets,
  turnIntoAction,
  turnIntoEmbed,
} from './block/turnInto'
export type { TurnIntoContext, TurnIntoDefinition } from './block/turnInto'
export { nodesForShape } from './block/turnIntoContent'
export type { TurnIntoShape } from './block/turnIntoContent'
export {
  BLOCK_SELECTION_PLUGIN_KEY,
  adaptBlockSelectionTurnInto,
  blockSelectionPluginKey,
  selectedBlockPositions,
  turnIntoSelectionContext,
  turnIntoOptionsForSelection,
  runTurnIntoOnSelection,
} from './block/turnIntoSelection'
export type { TurnIntoSelectionContext } from './block/turnIntoSelection'
export { turnIntoBubbleItem } from './block/turnIntoToolbar'
export { VersionStore, AUTO_IDLE_MS, AUTO_MIN_INTERVAL_MS } from './versions/versionStore'
export { classifyTransaction, summarizeChanges } from './versions/classify'
export { diffDocs, diffWords } from './versions/diff'
export type { VersionChange, VersionEntry, ChangeKind } from './versions/types'
export type { BlockDiff, WordDiff } from './versions/diff'
export { convertBlocksToSpec, convertPartialSelectionToSpec } from './operations/operations'
export type { TurnIntoSpec } from './operations/operations'
