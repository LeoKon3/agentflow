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
  <a href="README.md"><img alt="English current" src="https://img.shields.io/badge/English-current-6b7280?style=for-the-badge"></a>
  <a href="README.zh-CN.md"><img alt="Read in Chinese" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-read-2563eb?style=for-the-badge"></a>
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

Requires Claude Code with skill support. `agentflow` works best inside a git repository, especially for workflows that edit code or use Claude Code worktree isolation. Non-git projects can use custom Claude Code `WorktreeCreate` / `WorktreeRemove` hooks, but git is the recommended path.

Install the skill:

```bash
npx @leokon3/agentflow@latest install
```

Choose Claude Code, then choose project or global installation.

If npm is unavailable, install manually from a checkout of this repository:

```bash
mkdir -p ~/.claude/skills
cp -R skills/agentflow ~/.claude/skills/
```

Then start Claude Code in any project:

```txt
/agentflow list
/agentflow show bugfix
/agentflow run bugfix "fix login redirect bug"
/agentflow role reviewer "review the current diff"
```

Run a custom workflow YAML file:

```txt
/agentflow validate ./skills/agentflow/examples/workflow-templates/strict-bugfix.yaml
/agentflow run ./skills/agentflow/examples/workflow-templates/strict-bugfix.yaml "fix login redirect bug"
```

Or place a project template at `.agentflow/templates/strict-bugfix.yaml` and run it by name:

```txt
/agentflow run strict-bugfix "fix login redirect bug"
```

## Built-in workflows

| Template   | Flow                                                     | Use when                                                |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `bugfix`   | Investigator → Developer → Tester → Reviewer             | Diagnose, fix, verify, and review a defect.             |
| `feature`  | Architect → Developer → Tester → Reviewer                | Design, build, verify, and review new behavior.         |
| `refactor` | Architect → Developer → Regression Tester → Reviewer     | Change structure while proving behavior stays the same. |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | Change security-sensitive code with extra review.       |
| `quick`    | Developer → Tester                                       | Make a small implementation with focused verification.  |

## Commands

| Command                                   | Purpose                              |
| ----------------------------------------- | ------------------------------------ |
| `/agentflow list`                         | Show built-in and project workflows. |
| `/agentflow show <template>`              | Inspect a workflow.                  |
| `/agentflow validate <template>`          | Validate a workflow template.        |
| `/agentflow role <role> "<task>"`         | Run one built-in role only.          |
| `/agentflow run <template> "<task>"`      | Run a workflow by name.              |
| `/agentflow run <template.yaml> "<task>"` | Run a workflow file by path.         |

Single-role mode is for focused investigation, design, implementation, testing, or review. It reports only that role's decision; it does not mark a workflow passed or bypass test/review gates.

Valid built-in role slugs: `investigator`, `architect`, `developer`, `tester`, `regression-tester`, `reviewer`, `security-reviewer`, `senior-reviewer`. Custom/project role templates are not resolved by `/agentflow role` in v0.1.

Template resolution order:

1. Explicit YAML paths are loaded as written.
2. Project templates are loaded from `.agentflow/templates/<name>.yaml`.
3. Built-in templates are loaded from the installed skill's `templates/<name>.yaml`.

Project templates take precedence over built-in templates with the same name.

`.agentflow/templates/` is project configuration for reusable workflow templates and can be committed for team use. It is separate from `.claude/skills/agentflow/`, which is the Claude Code skill installation directory and should not hold user custom templates.

## Workflow decisions

Each role returns a structured decision used for routing.

| Role type                  | Decisions                                  |
| -------------------------- | ------------------------------------------ |
| Developer                  | `implemented`, `blocked`                   |
| Tester / Regression Tester | `passed`, `failed`, `blocked`              |
| Reviewer roles             | `approved`, `changes_requested`, `blocked` |

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

Save reusable project templates in:

```txt
.agentflow/templates/<name>.yaml
```

Then run them by name:

```txt
/agentflow run <name> "<task>"
```

More workflow examples:

```txt
skills/agentflow/examples/workflow-templates/
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

The YAML above configures a role inside a workflow. A reusable role template is a Markdown prompt contract. For a fully custom role without `uses`, include:

- role responsibility
- allowed actions and limits
- decision vocabulary
- required output structure
- pass/fail/block conditions
- handoff destination

Keep role prompts small and explicit: the workflow should make it clear what the role may do, how it decides, and where it hands off next.

Role prompt examples live in:

```txt
skills/agentflow/examples/role-templates/
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
package.json                             # npm package metadata for npx installation
bin/agentflow.js                         # interactive installer CLI
skills/agentflow/                        # publishable skill source
  SKILL.md                               # command behavior and workflow runner rules
  templates/                             # built-in workflow templates
  roles/                                 # built-in role prompts
  examples/                              # copyable workflow and role examples
```
