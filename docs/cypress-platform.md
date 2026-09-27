# Cypress platform

`cy-platform` centralizes Cypress plugins, commands, and Node lifecycle hooks.
Package internals and source-module ownership are documented in
[packages/cy-platform/README.md](../packages/cy-platform/README.md).

## npm CLI

Recommended distribution:

```bash
npx @experiencequality/create-cy-platform@0.1.0 brownfield .
npx @experiencequality/create-cy-platform@0.1.0 greenfield ../orders-cypress --install
```

Use `--dry-run` before changing a project. Use `--force` only to replace
conflicting generated files. Set `CY_PLATFORM_SPEC` for a private registry or
local archive.

## Shell fallback

The shell script is a dependency-free Unix fallback. Download a pinned release
version, inspect it, then execute it:

```bash
SCRIPT_URL='https://raw.githubusercontent.com/ExperienceQuality/xq-test-platform/v0.1.0/scripts/scaffold-cy-platform.sh'
curl --fail --silent --show-error --location "$SCRIPT_URL" \
  -o scaffold-cy-platform.sh
bash scaffold-cy-platform.sh brownfield . --dry-run
```

Avoid tracking `main` in automation. The script supports `greenfield`,
`brownfield`, `--dry-run`, `--force`, and `--install`.

## Generated project

The CLI and shell script create:

- `cypress.config.ts`, wired to `cy-platform/node`
- `cypress/support/e2e.ts`, importing `cy-platform`
- `cypress/tsconfig.json`
- Cypress npm scripts and `cy-platform`/`cypress` dev dependencies
