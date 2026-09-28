# Development and release checks

All package source, tests, and the E2E example are TypeScript. Install from the
repository root.

```bash
npm install
npm run check
npm test
npm run build
```

The workspace layout is enforced by `scripts/verify-structure.mjs`. Package
archives are built and tested in a fresh temporary consumer by
`scripts/verify-packages.mjs`:

```bash
npm run verify:structure
npm run verify:packages
```

Build output goes to each package's ignored `dist/` directory. Archive checks
are validation only; they do not publish packages.

Public release package is:

- `@xq/test`

Publish only after the version, changelog, package contents, and release tag
have been reviewed.
