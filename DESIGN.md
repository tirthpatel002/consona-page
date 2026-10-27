# Design principles

These principles apply to everything in this editor: blocks, plugins, menus, toolbars and any surface added later. They describe intent, not recipes. When a case isn't covered, choose the option that best honours them.

## 1. Content first, chrome second

The page is the product. Controls appear when they're relevant, step back when they aren't, and never cover the content being worked on. If a control competes with the content for attention, it is too loud.

## 2. One system, no exceptions

Every visual decision (colour, spacing, size, radius, type, shadow, motion) comes from the shared design tokens in `src/editor/core/styles/tokens.css`. If a value you need doesn't exist, add a token rather than a one-off. Two things that do the same job look and behave the same, wherever they live.

## 3. Geometric precision

Alignment, rhythm and proportion are correctness, not polish. Things that sit together share a baseline or centre line, spacing follows a consistent scale, and icons share one style and weight. Misalignment is a bug.

## 4. Quiet by default

Prefer neutral surfaces, restrained colour and soft depth. Colour carries meaning (selection, focus, status, user-chosen colour) rather than decoration. Every option, border and shadow has to earn its place.

## 5. One owner per behaviour

Shared concerns such as selection feedback, focus, hover, floating positioning, menus and drag feedback are owned by the core and reused by plugins. A plugin never reimplements or layers on top of them, so you never get two rings, two menus or two ways of doing one thing.

## 6. Progressive disclosure

Show the common action and reveal the rest on demand: group related actions, and show contextual options only when they apply. The interface should feel smaller than its capabilities.

## 7. Direct and predictable

What you see is what you edit. Text is selectable and editable wherever it appears, selection is continuous, and every user action is one understandable, undoable operation. Nothing surprising happens on drag, click or paste.

## 8. Everyone can use it

Everything works with the keyboard and has visible focus, sufficient contrast and accessible names. Motion is brief, purposeful and respects reduced-motion preferences. Design every colour so it can live in light and dark themes.

## 9. Extensible by construction

New blocks and features are self-contained plugins that inherit the system automatically. If adding something requires editing the core or copying styles, improve the shared layer instead.

## Working agreement

Build in small, self-contained increments, keep the quick checks green (typecheck, lint, tests, build), and hand each increment back for review in the browser rather than iterating endlessly on self-verification.
