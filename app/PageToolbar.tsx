import { useState } from 'react'
import {
  pageToolbarItems,
  historyToolbarItems,
  Toolbar,
  VersionsModal,
  type PageController,
  type ToolbarItem,
} from '../src/editor/core'

/** Formatting chrome under the banner. Title lives on the banner, not here. */
export function PageToolbar({ page }: { readonly page: PageController }) {
  const [versionsOpen, setVersionsOpen] = useState(false)
  const { editor, versionStore } = page
  if (!editor) return null

  const versionsItem: ToolbarItem | null = versionStore
    ? {
        id: 'core:versions',
        group: 'history',
        label: 'Version history',
        title: 'Version history',
        icon: 'history',
        isEnabled: () => true,
        run: () => setVersionsOpen(true),
      }
    : null

  const items = [
    ...historyToolbarItems,
    ...(versionsItem ? [versionsItem] : []),
    ...page.registry.toolbarItems,
    ...pageToolbarItems,
  ].filter((item) => item.placement !== 'bubble')

  return (
    <>
      <Toolbar
        editor={editor}
        items={items}
        blocks={page.registry.blocks}
        panels={page.registry.panels}
        openPanels={page.openPanels}
        onTogglePanel={page.togglePanel}
      />
      {versionsOpen && versionStore && (
        <VersionsModal editor={editor} store={versionStore} close={() => setVersionsOpen(false)} />
      )}
    </>
  )
}
