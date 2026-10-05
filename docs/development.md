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

- `@experiencequality/rest-client`
- `@experiencequality/db`
- `@experiencequality/stub`
- `@experiencequality/core`
- `@experiencequality/test`

The root workspace and showcase remain private. The five publishable packages
currently use version `1.0.3`; release all five internal packages at the same
`MAJOR.MINOR.PATCH` version, and keep their internal dependency versions exact
and aligned. Packages are published to the company GitHub Packages npm
registry, not the public npm registry. The release workflow uses the
repository `GITHUB_TOKEN`; push a `vMAJOR.MINOR.PATCH` tag from `main` after
the release PR is merged. The current package contract requires Node.js 24 or
newer, Vitest 4 or newer, and `@cucumber/cucumber` 13.2.x when the optional
Cucumber integration is used.

## Cucumber report and CI publication

The supported report contract is implemented by the consumer-facing
`defineCucumberConfig` helper. It keeps `progress` output enabled and always
configures an HTML report. The default is the consumer-relative path
`artifacts/index.html`; a nonblank `reportPath` can select another
consumer-relative path. Blank or missing values use the default. Absolute
paths and `..` traversal that escapes the consumer workspace are rejected.
This guarantee applies at the helper boundary only; a hand-written
`cucumber-js` configuration or direct CLI formatter selection is outside the
platform's enforcement boundary.

The Test workflow uploads `artifacts/index.html` as the `cucumber-report`
artifact with `if: always()` and seven-day retention, so a failed run remains
diagnosable through its downloadable artifact. The GitHub Pages workflow is
main-only: it publishes the latest successful Test report from `main` as the
site-root `index.html`. Failed, pull-request, and release-tag runs do not
replace the last successful Pages deployment.
