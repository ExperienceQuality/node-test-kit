# Node Test Kit Squad

Persistent role definitions for a repository-scoped Agile + BDD squad.

Engineering Manager owns requirements, priority, scope, and acceptance. Agents inspect first, report evidence, and wait for slice assignment before editing. Every implementation slice needs Given/When/Then acceptance criteria, tests, and validation commands.

Roles:

- `researcher.md` — discovery, domain mapping, risks, backlog slices
- `nodejs-engineer.md` — Node.js design and implementation
- `testing-specialist.md` — test strategy, BDD scenarios, quality gates
- `github-actions-specialist.md` — CI/CD workflows and release safety

Operating agreement:

1. Manager assigns one bounded slice.
2. Researcher supplies context and evidence when needed.
3. Node.js Engineer implements with tests.
4. Testing Specialist reviews acceptance coverage and regression risk.
5. GitHub Actions Specialist wires required checks and release gates.
6. Agent reports changed files, tests, risks, and follow-up work.

Current execution backlog and locked Manager decisions: `docs/agent-workplan.md`.
