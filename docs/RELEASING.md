# Compatibility and release gates

## Development status

This is an installable library candidate, not a published package or a production certification. `private: true`
intentionally prevents accidental npm publication. There is no selected license. Do not remove that guard until
the owner chooses the public package identity, license and release version and approves publication. No CI or
deployment was enabled by the packaging work.

## Reproduce the gates

```sh
npm ci
npm run check
npm run build
npm run test:package
npm pack --dry-run
```

`test:package` builds the library, creates a tarball and installs it into a separate temporary directory using
only the packed package plus explicit test tools. It checks every export target is packed, excludes application
and source trees, imports store/engine/compact/Markdown without window/document, exercises revision-checked
storage and settings, constructs a packed editor in jsdom, applies formatted engine edits, replays and undoes
them, compiles public consumer types under both NodeNext and Bundler (`strict`, no `skipLibCheck`), and builds a
browser consumer. It removes temporary files unless `KEEP_PACKAGE_CONSUMER=1` is set.

`npm run build` is the demo build. `npm run build:library` is the package build; do not substitute one for the
other. `npm pack` builds the library through prepack. Declaration post-processing resolves relative specifiers
including inline import types for NodeNext consumers. Only documented exports are supported; internal
`.d.ts` files are shipped for type resolution, not public deep imports.

The tested baseline is Node 22.23, TypeScript 5.9, React 19 and Tiptap 3 as locked in this checkout. The tested
package is ESM; no CJS or broad version matrix has been run. The browser consumer build may warn about a chunk
over 500 kB and third-party client directives; neither is proof of server-rendering compatibility. Bundle and
load budgets must be set and measured for the actual host.

## Storage and document compatibility

- Page bodies use the versioned stored-page format. Missing format is legacy format 0; current format is 1.
  Future unknown versions reject rather than rewriting the record. Keep fixtures for every supported version.
- IndexedDB schema upgrades are additive; old open tabs can block upgrades. Surface that error and retry after
  closing old tabs. Never delete a database as automatic recovery.
- Existing localStorage documents are imported with their old copy retained. Missing IndexedDB data must not
  silently revive older localStorage content. Keep recovery explicit.
- Blocks missing ids receive them on first open/save; closed-page writes refuse them. Existing block type names
  and attribute meanings are persistence contracts. Renames/removals need explicit migrations and fixtures.
- Media migration is explicit and must keep unreadable/refused items inline. Orphan cleanup must include the
  current page, all retained versions and cross-page references; never delete from the current body alone.
- Page settings and sidecars are separate stores with independent failure states. Body persistence is not an
  atomic backup of the whole workspace. Export and restore must account for bodies, registry, blobs, history,
  comments and settings according to the host's policy.

## Remaining release decisions and checks

- Owner chooses license and registry/package identity. Check dependency license obligations and included assets;
  no license grant is implied by the absence of a license file.
- Final combined-branch package checks after AI/preview integration, clean install and full regression tests.
- Real Chrome integration evidence plus Firefox/Safari, mobile/touch and assistive-technology coverage. jsdom,
  synthetic clipboard/drag events and viewport emulation are not native clipboard or real-device tests.
- Two-real-editor conflict/race checks, crash/upgrade failure paths, real browser quota exhaustion and restore
  integrity. Simulated storage failures do not replace browser evidence.
- Security review of URL-bearing props, HTML import/export, custom renderer boundaries, file limits, provider
  disclosure scope and dependencies. `npm audit` output alone is not a security assessment.
- Performance measurements on large documents, many pages, large media, low-memory devices and production hosts.
- Module-scoped media/export/sidecar hosts limit independent multi-workspace instances. Do not advertise that
  isolation until it is implemented and tested.

A release summary must separate completed checks from limits. Keep the branch unmerged until the owner reviews
and merges the single final PR. Publishing, deployments, paid providers and remote CI runs are separate actions.
