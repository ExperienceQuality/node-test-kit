#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  scaffold-cy-platform.sh greenfield <directory> [options]
  scaffold-cy-platform.sh brownfield <directory> [options]

Options:
  --dry-run       Print actions without changing files or running npm.
  --force         Replace generated files that already exist.
  --install       Install Cypress and cy-platform after scaffolding.
  -h, --help      Show this help.

Environment:
  CY_PLATFORM_SPEC  npm install spec for cy-platform.
                     Default: cy-platform@^0.1.0
                     Example: CY_PLATFORM_SPEC=/path/cy-platform.tgz
EOF
}

die() {
  printf 'scaffold: %s\n' "$1" >&2
  exit 1
}

MODE=${1:-}
TARGET=${2:-}
DRY_RUN=false
FORCE=false
INSTALL=false
PLATFORM_SPEC=${CY_PLATFORM_SPEC:-cy-platform@^0.1.0}
PLATFORM_VERSION=$PLATFORM_SPEC
if [[ "$PLATFORM_SPEC" == cy-platform@* ]]; then
  PLATFORM_VERSION=${PLATFORM_SPEC#cy-platform@}
elif [[ "$PLATFORM_SPEC" == /* || "$PLATFORM_SPEC" == *.tgz ]]; then
  PLATFORM_VERSION="file:$PLATFORM_SPEC"
fi

if [[ -z "$MODE" || -z "$TARGET" ]]; then
  usage
  exit 2
fi
shift 2

while (($# > 0)); do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --force) FORCE=true ;;
    --install) INSTALL=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done

case "$MODE" in
  greenfield|brownfield) ;;
  *) die "mode must be greenfield or brownfield" ;;
esac

command -v npm >/dev/null 2>&1 || die 'npm is required'

TARGET=$(cd "$(dirname "$TARGET")" 2>/dev/null && printf '%s/%s' "$(pwd -P)" "$(basename "$TARGET")") || die "cannot resolve target: $TARGET"

run() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '+ %q' "$1"
    shift
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_in_target() {
  if [[ "$DRY_RUN" == true ]]; then
    printf '+ (cd %q &&' "$TARGET"
    printf ' %q' "$@"
    printf ')\n'
  else
    (cd "$TARGET" && "$@")
  fi
}

ensure_directory() {
  local directory=$1
  if [[ "$DRY_RUN" == true ]]; then
    printf 'would create directory %s\n' "$directory"
  else
    mkdir -p "$directory"
  fi
}

write_file() {
  local path=$1
  local content
  content=$(cat)

  if [[ -f "$path" && "$FORCE" != true ]]; then
    if [[ "$(cat "$path")" == "$content" ]]; then
      printf 'unchanged %s\n' "$path"
      return
    fi
    die "refusing to overwrite existing file: $path (use --force)"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    printf 'would write %s\n' "$path"
    return
  fi

  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" > "$path"
  printf 'wrote %s\n' "$path"
}

if [[ "$MODE" == greenfield ]]; then
  if [[ -e "$TARGET" && -n "$(find "$TARGET" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    die "greenfield target must not contain files: $TARGET"
  fi
  ensure_directory "$TARGET"
  run_in_target npm init -y
  run_in_target npm pkg set type=module
  run_in_target npm pkg set private=true --json
else
  [[ -f "$TARGET/package.json" ]] || die "brownfield target needs package.json: $TARGET"
fi

run_in_target npm pkg set \
  'scripts.cypress:open=cypress open' \
  'scripts.cypress:run=cypress run' \
  "devDependencies.cypress=^16.1.0" \
  "devDependencies.cy-platform=$PLATFORM_VERSION"

write_file "$TARGET/cypress.config.ts" <<'EOF'
import { defineConfig } from 'cypress';
import { setupPlatform } from 'cy-platform/node';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return setupPlatform(on, config);
    },
  },
});
EOF

write_file "$TARGET/cypress/support/e2e.ts" <<'EOF'
import 'cy-platform';
EOF

write_file "$TARGET/cypress/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["cypress"],
    "noEmit": true,
    "strict": true
  },
  "include": ["**/*.ts"]
}
EOF

if [[ ! -e "$TARGET/.gitignore" ]]; then
  write_file "$TARGET/.gitignore" <<'EOF'
node_modules/
cypress/screenshots/
cypress/videos/
cypress/downloads/
EOF
fi

if [[ "$INSTALL" == true ]]; then
  run_in_target npm install --save-dev cypress@^16.1.0 "$PLATFORM_SPEC"
fi

printf 'scaffolded %s Cypress project at %s\n' "$MODE" "$TARGET"
if [[ "$INSTALL" != true ]]; then
  printf 'next: npm install --prefix %q --save-dev cypress@^16.1.0 %q\n' "$TARGET" "$PLATFORM_SPEC"
fi
