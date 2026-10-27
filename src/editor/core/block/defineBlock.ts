import { parse, safeParse, type $ZodError } from 'zod/v4/core'
import { toJsonObject } from '../json'
import { resolveBlockPresentation } from './blockPresentation'
import type { BlockDefinition, BlockModule } from './types'

const BLOCK_TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/

export function formatIssues(error: $ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)'
    return `${path}: ${issue.message}`
  })
}

/** Turns a typed block definition into a type-erased module for the registry. */
export function defineBlock<P>(definition: BlockDefinition<P>): BlockModule {
  if (!BLOCK_TYPE_PATTERN.test(definition.type)) {
    throw new Error(`Invalid block type "${definition.type}": use letters, digits, "-" or "_"`)
  }
  const { schema, template, render, actions = [] } = definition

  return {
    type: definition.type,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    keywords: definition.keywords,
    presentation: resolveBlockPresentation(definition.presentation),
    createProps: () => toJsonObject(parse(schema, template())),
    validate(rawProps) {
      const result = safeParse(schema, rawProps)
      if (!result.success) return { ok: false, issues: formatIssues(result.error) }
      const props = result.data
      return {
        ok: true,
        render: (host) =>
          render(props, {
            editable: host.editable,
            selectBlock: host.selectBlock,
            update: (next) => {
              const parsed = safeParse(schema, next)
              if (!parsed.success) {
                console.warn(`[page] rejected invalid update for "${definition.type}"`, formatIssues(parsed.error))
                return false
              }
              host.updateProps(toJsonObject(parsed.data))
              return true
            },
          }),
      }
    },
    actionsFor(rawProps) {
      const result = safeParse(schema, rawProps)
      if (!result.success) return []
      const props = result.data
      return actions.map((action) => ({
        id: action.id,
        label: typeof action.label === 'function' ? action.label(props) : action.label,
        apply: () => toJsonObject(parse(schema, action.apply(props))),
        ...(action.style ? { style: true as const } : {}),
      }))
    },
  }
}
