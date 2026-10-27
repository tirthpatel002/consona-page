import {
  ANY_BLOCK_SOURCE,
  convertBlocksToSpec,
  nodesForShape,
  turnIntoAction,
  type BlockTarget,
  type TurnIntoDefinition,
  type TurnIntoShape,
  type TurnIntoSpec,
} from '../../editor/core'

/** Heading level of a heading target, else null. */
const headingLevel = (target: BlockTarget): number | null =>
  target.nodeType === 'heading' && typeof target.node.attrs.level === 'number' ? target.node.attrs.level : null

const inList = (target: BlockTarget, list: string): boolean =>
  target.nodeType === list || (target.nodeType === 'listItem' && target.parentType === list)

/** A conversion of any content block into `shape`, keeping its text (and marks, when the source has them). */
const chainConversion = (
  id: string,
  label: string,
  target: string,
  shape: TurnIntoShape,
  isCurrent: (target: BlockTarget) => boolean = () => false,
): TurnIntoDefinition => {
  const spec: TurnIntoSpec = {
    kind: 'chain',
    blocks: (schema, source) => nodesForShape(schema, shape, source),
  }
  return {
    id: `text:turn-into-${id}`,
    label,
    target,
    from: [ANY_BLOCK_SOURCE],
    isCurrent,
    convert: ({ editor, pos }) => {
      convertBlocksToSpec.run(editor, [pos], spec)
    },
    spec,
  }
}

/** "Turn into" conversions the text plugin registers. They apply to every content block, not only paragraphs. */
export const turnIntoConversions: readonly TurnIntoDefinition[] = [
  chainConversion('text', 'Text', 'paragraph', { type: 'paragraph' }, (t) => t.nodeType === 'paragraph'),
  ...([1, 2, 3] as const).map((level) =>
    chainConversion(
      `h${level}`,
      `Heading ${level}`,
      'heading',
      { type: 'heading', level },
      (t) => headingLevel(t) === level,
    ),
  ),
  chainConversion('bullet-list', 'Bulleted list', 'bulletList', { type: 'bulletList' }, (t) => inList(t, 'bulletList')),
  chainConversion('ordered-list', 'Numbered list', 'orderedList', { type: 'orderedList' }, (t) =>
    inList(t, 'orderedList'),
  ),
  chainConversion('quote', 'Quote', 'blockquote', { type: 'blockquote' }, (t) => t.nodeType === 'blockquote'),
  chainConversion('code', 'Code', 'codeBlock', { type: 'codeBlock' }, (t) => t.nodeType === 'codeBlock'),
]

/** Menu-action form of the conversions (the registry adapts `turnInto` the same way). */
export const turnIntoActions: readonly ReturnType<typeof turnIntoAction>[] = turnIntoConversions.map(turnIntoAction)
