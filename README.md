<p align="center">
  <img src="assets/agentflow-banner.svg" alt="AgentFlow banner" width="100%" />
</p>

<h1 align="center">agentflow</h1>

<p align="center">
  <img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-skill-6366f1">
  <img alt="workflow" src="https://img.shields.io/badge/workflow-role--based-0ea5e9">
  <img alt="gates" src="https://img.shields.io/badge/gates-test%20%7C%20review-f59e0b">
  <img alt="recovery" src="https://img.shields.io/badge/recovery-blocked%20%2B%20repair-10b981">
</p>

<p align="center">
  A Claude Code skill that turns one coding session into a disciplined role-based workflow with handoffs, gates, and recovery loops.
</p>

<p align="center">
  <a href="README.md"><kbd>English</kbd></a>
  <a href="README.zh-CN.md"><kbd>中文</kbd></a>
</p>

## Why agentflow?

Claude Code can handle complex work, but larger tasks often need explicit role boundaries, verification gates, and review gates.

`agentflow` makes those boundaries visible:

- Developer implements.
- Tester verifies.
- Reviewer approves.
- Failed checks route back to the right role.
- Blocked roles report what is missing and where to resume.

<p align="center">
  <img src="assets/agentflow-workflow.svg" alt="AgentFlow role-based workflow diagram" width="100%" />
</p>

## Quick start

Requires Claude Code with skill support.

Copy the skill into your Claude Code skills directory:

```bash
cp -R claude/skills/agentflow ~/.claude/skills/
```

Then start Claude Code in any project:

```txt
/agentflow list
/agentflow show bugfix
/agentflow run bugfix "fix login redirect bug"
```

Run a custom workflow YAML file:

```txt
/agentflow validate ./claude/skills/agentflow/examples/workflow-templates/strict-bugfix.yaml
/agentflow run ./claude/skills/agentflow/examples/workflow-templates/strict-bugfix.yaml "fix login redirect bug"
```

## Built-in workflows

| Template | Flow | Use when |
| --- | --- | --- |
| `bugfix` | Investigator → Developer → Tester → Reviewer | You need root cause, fix, tests, and review. |
| `feature` | Architect → Developer → Tester → Reviewer | You need a small plan before implementation. |
| `refactor` | Architect → Developer → Regression Tester → Reviewer | Behavior should stay unchanged. |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | Auth, tokens, permissions, webhooks, or payment boundaries are involved. |
| `quick` | Developer → Tester | The change is small but still needs verification. |

## Commands

| Command | Purpose |
| --- | --- |
| `/agentflow list` | Show built-in workflows. |
| `/agentflow show <template>` | Inspect a workflow. |
| `/agentflow validate <template.yaml>` | Validate a custom workflow file. |
| `/agentflow run <template> "<task>"` | Run a built-in workflow. |
| `/agentflow run <template.yaml> "<task>"` | Run a custom workflow file. |

Built-in templates are addressed by name. Custom templates are currently addressed by explicit YAML file path.

## Workflow decisions

Each role returns a structured decision used for routing.

| Role type | Decisions |
| --- | --- |
| Developer | `implemented`, `blocked` |
| Tester / Regression Tester | `passed`, `failed`, `blocked` |
| Reviewer roles | `approved`, `changes_requested`, `blocked` |

`failed` and `changes_requested` route to the configured `fail_to` role.

`blocked` stops with a resume point so the user can provide missing information and continue from the blocked role.

## Custom workflows

Custom workflows are YAML files with roles, routes, a start role, and workflow rules.

```yaml
name: strict-bugfix

roles:
  developer:
    uses: builtin/developer
    can_edit: true
    can_run_commands: true
    pass_to: tester

  tester:
    uses: builtin/tester
    can_edit: true
    can_run_commands: true
    pass_to: reviewer
    fail_to: developer

  reviewer:
    uses: builtin/reviewer
    can_edit: false
    can_run_commands: true
    pass_to: done
    fail_to: developer

flow:
  start: developer

rules:
  max_loops: 2
  require_tests: true
  require_final_review: true
```

More examples:

```txt
claude/skills/agentflow/examples/workflow-templates/
claude/skills/agentflow/examples/role-templates/
```

Role permissions such as `can_edit` and `can_run_commands` are workflow constraints in the prompt. Claude Code's normal tool confirmation settings still apply.

## Custom role prompts

Use `uses: builtin/<role>` to reuse a built-in role prompt. Add `prompt:` when the role needs extra instructions.

```yaml
docs-reviewer:
  title: Docs Reviewer
  uses: builtin/reviewer
  prompt: |
    Review only documentation changes.
    Check clarity, accuracy, broken links, and whether examples still match the workflow.
  can_edit: false
  can_run_commands: true
  pass_to: done
  fail_to: docs-writer
```

For a fully custom role prompt without `uses`, write the role like a small contract:

- responsibility;
- what the role may and must not do;
- decision vocabulary;
- required output structure;
- pass, fail, and block conditions;
- handoff destination.

Role prompt examples live in:

```txt
claude/skills/agentflow/examples/role-templates/
```

Included examples:

- `product-reviewer.md`
- `api-reviewer.md`
- `docs-reviewer.md`
- `migration-reviewer.md`

## Verification boundaries

Developer handoffs describe what can be verified in the current code environment, what requires runtime or external access, and what is not required for the change. Tester and Regression Tester then decide whether the available evidence is enough to pass, fail, or block.

## Repository layout

```txt
claude/skills/agentflow/                 # publishable Claude Code skill source
  SKILL.md                               # command behavior and workflow runner rules
  templates/                             # built-in workflow templates
  roles/                                 # built-in role prompts
  examples/                              # copyable workflow and role examples
```

The local `.claude/` directory is for machine-specific Claude Code settings and local testing. It is not the product source.
