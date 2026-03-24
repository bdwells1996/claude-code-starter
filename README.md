# Claude Code Starter

A base repository to clone when starting new projects, pre-configured with a robust set of Claude Code commands, skills, and agents to supercharge development workflows.

## What's Included

### Commands (`/.claude/commands`)
Slash commands available in every Claude Code session:

| Command | Purpose |
|---|---|
| `/plan` | Create a step-by-step implementation plan before touching code |
| `/tdd` | Enforce test-driven development — tests first, then implementation |
| `/code-review` | Review code for quality, security, and maintainability |
| `/refactor-clean` | Safely remove dead code and consolidate duplication |
| `/test-coverage` | Audit and improve test coverage |
| `/e2e` | Generate and run Playwright end-to-end tests |
| `/docs` | Look up current library documentation via Context7 |
| `/learn` | Extract reusable patterns from the codebase |
| `/context-budget` | Audit context window usage across agents and skills |

### Skills (`/.claude/skills`)
Deeper workflow skills with specialised patterns:

- **api-design** — REST API design patterns, status codes, pagination, error responses
- **backend-patterns** — Node.js/Express/Next.js API architecture patterns
- **frontend-patterns** — React, Next.js, state management, performance
- **design-system** — Generate and audit visual design systems
- **postgres-patterns** — PostgreSQL query optimisation, schema design, indexing
- **tdd-workflow** — Full TDD cycle with 80%+ coverage enforcement
- **e2e-testing** — Playwright Page Object Model, CI/CD integration, flaky test strategies
- **context-budget** — Token usage analysis and optimisation

### Agents (`/.claude/agents`)
Specialised sub-agents that Claude delegates to automatically:

- **typescript-reviewer** — TypeScript/JavaScript type safety and async correctness
- **code-reviewer** — General code quality, security, and maintainability review
- **tdd-guide** — TDD specialist enforcing write-tests-first methodology
- **refactor-cleaner** — Dead code removal using knip, depcheck, ts-prune
- **planner** — Architecture and implementation planning
- **e2e-runner** — End-to-end test execution with Playwright

## Usage

Clone this repo as the starting point for any new project:

```bash
git clone https://github.com/your-username/claude-code-starter my-new-project
cd my-new-project
rm -rf .git
git init
```

All Claude Code commands, skills, and agents will be available immediately.

## Credits

Inspired by [everything-claude-code](https://github.com/affaan-m/everything-claude-code) by Affaan M — a fantastic resource for getting the most out of Claude Code.
