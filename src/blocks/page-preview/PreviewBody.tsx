import { useEffect, useState } from 'react'
import { File, Image, Music, Play, Link as LinkIcon } from 'lucide-react'
import type { BlobStore } from '../../editor/core'
import { isSafeMediaSrc } from '../../plugins/media/sources'
import { isBlobRef } from '../../plugins/media/host'
import type { PreviewNode } from './model'
import { calloutBlock } from '../callout'
import { equationBlock } from '../equation'
import { mermaidBlock } from '../mermaid'
import { tabsBlock } from '../tabs'
import { toggleBlock } from '../toggle'
import { breadcrumbBlock } from '../breadcrumb'

const supported = [calloutBlock, equationBlock, mermaidBlock, tabsBlock, toggleBlock, breadcrumbBlock]

function PreviewImage({ node, blobs }: { readonly node: PreviewNode; readonly blobs?: BlobStore }) {
  const [stored, setStored] = useState<{ ref: string; url: string } | null>(null)
  const ref = node.attrs?.blob
  useEffect(() => {
    if (!blobs || !isBlobRef(ref)) return
    let cancelled = false
    let url: string | null = null
    void blobs
      .get(ref.slice(5))
      .then((file) => {
        if (cancelled || !file || !/^image\/(png|jpeg|gif|webp|avif)$/.test(file.type)) return
        url = URL.createObjectURL(file.blob)
        setStored({ ref, url })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [blobs, ref])
  // Preview remote media only as a labelled placeholder: opening a parent must not contact a third-party host.
  const raw = node.attrs?.src
  const src =
    stored?.ref === ref
      ? stored?.url
      : typeof raw === 'string' && raw.startsWith('data:image/') && isSafeMediaSrc('image', raw)
        ? raw
        : null
  return src ? (
    <img src={src} alt={String(node.attrs?.alt ?? '')} />
  ) : (
    <span className="page-preview__media">
      <Image size={20} />
      {String(node.attrs?.alt || node.attrs?.name || 'Image')}
    </span>
  )
}

function RenderNode({ node, blobs }: { readonly node: PreviewNode; readonly blobs?: BlobStore }) {
  const children = node.content?.map((child, i) => <RenderNode key={i} node={child} blobs={blobs} />)
  switch (node.type) {
    case 'text': {
      let text = <>{node.text}</>
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') text = <strong>{text}</strong>
        if (mark.type === 'italic') text = <em>{text}</em>
        if (mark.type === 'code') text = <code>{text}</code>
        if (mark.type === 'strike') text = <s>{text}</s>
      }
      return text
    }
    case 'hardBreak':
      return <br />
    case 'heading':
      return (
        <div className="page-preview__heading" data-level={node.attrs?.level}>
          {children}
        </div>
      )
    case 'paragraph':
      return <p>{children ?? <br />}</p>
    case 'bulletList':
    case 'taskList':
      return <ul>{children}</ul>
    case 'orderedList':
      return <ol>{children}</ol>
    case 'listItem':
    case 'taskItem':
      return (
        <li>
          {node.type === 'taskItem' ? (node.attrs?.checked ? '☑ ' : '☐ ') : null}
          {children}
        </li>
      )
    case 'blockquote':
      return <blockquote>{children}</blockquote>
    case 'codeBlock':
      return (
        <pre>
          <code>{children}</code>
        </pre>
      )
    case 'horizontalRule':
      return <hr />
    case 'table':
      return (
        <table>
          <tbody>{children}</tbody>
        </table>
      )
    case 'tableRow':
      return <tr>{children}</tr>
    case 'tableHeader':
      return <th>{children}</th>
    case 'tableCell':
      return <td>{children}</td>
    case 'card':
      return <div className="page-preview__callout">{children}</div>
    case 'columnList':
      return <div className="page-preview__columns">{children}</div>
    case 'column':
      return <div>{children}</div>
    case 'media': {
      const kind = node.attrs?.kind
      if (!kind || kind === 'image')
        return (
          <figure>
            <PreviewImage node={node} blobs={blobs} />
            {children && <figcaption>{children}</figcaption>}
          </figure>
        )
      const Icon =
        kind === 'audio' ? Music : kind === 'video' || kind === 'embed' ? Play : kind === 'bookmark' ? LinkIcon : File
      return (
        <div className="page-preview__media">
          <Icon size={20} />
          {String(node.attrs?.name || kind)}
          {children}
        </div>
      )
    }
    case 'embedBlock':
    case 'embed': {
      const props = node.attrs?.props as Record<string, unknown> | undefined
      const type = String(node.attrs?.blockType || 'Block')
      const module = supported.find((block) => block.type === type)
      // Excessive embedded payloads are represented as a label rather than mounting costly renderers.
      if (module && JSON.stringify(props ?? {}).length < 8000) {
        const validated = module.validate(props)
        if (validated.ok)
          return validated.render({ editable: false, updateProps: () => undefined, selectBlock: () => undefined })
      }
      return (
        <div className="page-preview__media">
          <File size={20} />
          {type}
          {typeof props?.body === 'string' ? `: ${String(props?.body).slice(0, 500)}` : ''}
        </div>
      )
    }
    default:
      return children ? <div>{children}</div> : <span className="page-preview__media">{node.type} block</span>
  }
}

/** Passive React rendering only: no raw HTML, active links, iframe, scripts, inputs or nested editors. */
export function PreviewBody({ nodes, blobs }: { readonly nodes: readonly PreviewNode[]; readonly blobs?: BlobStore }) {
  return (
    <div className="page-preview__body" aria-hidden="true" inert>
      {nodes.map((node, i) => (
        <RenderNode key={i} node={node} blobs={blobs} />
      ))}
    </div>
  )
}
