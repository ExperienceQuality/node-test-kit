# @experiencequality/create-cy-platform

Cross-platform CLI that adds platform Cypress setup to a greenfield or existing Node project.

```bash
npx @experiencequality/create-cy-platform@0.1.0 brownfield .
npx @experiencequality/create-cy-platform@0.1.0 greenfield ./orders-cypress --install
```

Use `--dry-run` to preview changes, `--force` to replace generated files, and `--install` to install Cypress and `cy-platform`. Set `CY_PLATFORM_SPEC` to override the platform package spec (for example, a local `.tgz`).
