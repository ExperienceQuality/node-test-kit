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

The public release packages are:

- `@xq/rest-client`
- `@xq/db`
- `@xq/stub`
- `@xq/core`
- `@xq/test`

The root workspace and showcase remain private. Release all five public
packages at the same version so exact internal dependencies resolve correctly.
Configure the repository `NPM_TOKEN` secret and push a `vMAJOR.MINOR.PATCH`
tag from `main`; the release workflow runs build, test, publish, and GitHub
Release stages in order.
