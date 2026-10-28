// @vitest-environment jsdom
import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { SaveStatus } from './SaveStatus'
import { dismissToast, getToast } from './toast'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const editorWith = (status: string): Editor =>
  ({ storage: { docPersistence: { status, message: '', subscribe: () => () => undefined } } }) as unknown as Editor

const mount = (node: ReactElement) => {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(node))
  const text = getToast()?.text ?? ''
  act(() => root.unmount())
  return text
}

afterEach(() => {
  dismissToast()
})

describe('SaveStatus', () => {
  it('says Saved when the body is saved and nothing else failed', () => {
    expect(mount(<SaveStatus editor={editorWith('saved')} errorHost={null} />)).toBe('Saved on this device')
  })
  it('does not claim a plain Saved while the page lock could not be saved', () => {
    expect(mount(<SaveStatus editor={editorWith('saved')} errorHost={null} settingsFailed />)).toBe(
      'Text saved on this device. Page lock not saved.',
    )
  })
})
