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

The internal release packages are:

- `@xq/rest-client`
- `@xq/db`
- `@xq/stub`
- `@xq/core`
- `@xq/test`

The root workspace and showcase remain private. Release all five internal
packages at the same version so exact dependencies resolve correctly. Packages
are published to the company GitHub Packages npm registry, not the public npm
registry. The release workflow uses the repository `GITHUB_TOKEN`; push a
`vMAJOR.MINOR.PATCH` tag from `main` after the release PR is merged.
