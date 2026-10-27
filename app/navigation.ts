/** Lets plugins (built once, outside React) open a page. The App registers the real handler while it is mounted. */
let handler: (id: string) => void = () => undefined

export const setOpenPageHandler = (next: (id: string) => void): (() => void) => {
  handler = next
  return () => {
    if (handler === next) handler = () => undefined
  }
}

export const openPageById = (id: string): void => handler(id)
