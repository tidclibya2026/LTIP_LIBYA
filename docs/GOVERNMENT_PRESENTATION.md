# Government presentation and public release

The existing landing page, map, administration, editor, workspace and administrative presentation routes remain intact. `#/government` is an additional route. The shared map uses the original GIS polygons and existing GIS-to-media associations.

The public home and `#/portfolio` now display independently approved aggregate counts only. See [public aggregate management](PUBLIC_PORTFOLIO_DATA_MANAGEMENT.md). Public counts never activate membership filters or map classification; private changes never update the public summary automatically.

The default production build is public. Its government view displays publicly available tourism-development sites, search, original polygons, site cards and photographs. It neither requests a target-site selection nor embeds selection records. A URL query or hash cannot enable private mode.

The `government` build mode enables a private runtime service. The target count is calculated from its working record and is not fixed in application code. The working record and every revision must stay outside this repository, including ignored folders, tests, fixtures and build output. Never commit private records, private screenshots or private test receipts. Hiding controls is not a data-security boundary.

## Local private operation

Build into an explicitly selected directory outside the repository:

```text
node node_modules/vite/bin/vite.js build --mode government --outDir <external-build-directory>
node scripts/release-policy.mjs <external-build-directory>
# Start the separately maintained private service outside this repository.
```

The external JSON configuration references `selectionFile`, `sourcePortfolio` and `contextFile`. All configuration and data paths are resolved and rejected if they point into the repository. No record or real selection example is supplied here. The source portfolio keeps its local-review flag. The service binds only to 127.0.0.1 and does not enable CORS. Mutations require matching Origin, a runtime session token and an expected revision.

`#/government/manage` in private mode supports adding/removing sites, recording a review, recording the competent administration's decision after review, and recording a literal assessment from a documented qualified source. Changing membership resets both review and decision. Recorded review/decision fingerprints must match the selected identities. Recording a decision never changes the private publication scope. Assessments start empty, and a source reference, reviewer and date are required. No score is computed or inferred. The private working mechanism is not an institutional identity, authorization or publication-clearance system; a shared deployment needs its own authenticated service and access controls.

## Checks and publication

`npm run build` builds the public application and validates the artifact and selection boundary. `npm run test:government` checks neutral public data, dynamic selection and validated synthetic membership without bundling the private service. `npm run test:selection-boundary` scans source and generated output for private record paths and literal selection values.

The release allowlist and exact GIS/media byte checks remain in force. Existing source park files are not emitted. CI retains manual dispatch and the main-branch publication approval input; creating a branch does not authorize publication. Owner approval is required before push, merge or deployment for this delivery.
