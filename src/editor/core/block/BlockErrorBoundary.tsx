import { Component, type ErrorInfo, type ReactNode } from 'react'
import { BlockProblem } from './BlockProblem'

interface Props {
  readonly blockType: string
  /** Changing this (e.g. serialized props) clears a previous error. */
  readonly resetKey: string
  readonly children: ReactNode
}

interface State {
  readonly error: Error | null
  readonly resetKey: string
}

/** Isolates render failures to a single block so the rest of the page keeps working. */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[page] block "${this.props.blockType}" failed to render`, error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return <BlockProblem title={`${this.props.blockType} failed to render`} details={[this.state.error.message]} />
    }
    return this.props.children
  }
}
