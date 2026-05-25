<p align="center">
  <img src="assets/agentflow-banner.svg" alt="AGENTFLOW banner" width="100%" />
</p>

<h1 align="center">agentflow</h1>

<p align="center">
  A Claude Code skill for running disciplined, role-based coding workflows inside one Claude Code session.
</p>

<p align="center">
  <a href="README.md"><kbd>English</kbd></a>
  <a href="README.zh-CN.md"><kbd>中文</kbd></a>
</p>

```txt
Developer writes. Tester verifies. Reviewer approves. You define the flow.
```

> [!NOTE]
> `agentflow` is a Claude Code skill, not an external CLI. Role permissions such as `can_edit` and `can_run_commands` are workflow constraints in the prompt; Claude Code's normal tool confirmation settings still apply.

## Why agentflow?

Claude Code can handle complex work, but larger tasks benefit from explicit handoffs, verification gates, and review gates. `agentflow` keeps each role's responsibility visible so implementation, testing, review, failure routing, and final reporting do not get skipped silently.

<p align="center">
  <img src="assets/agentflow-workflow.svg" alt="AgentFlow role-based workflow diagram" width="100%" />
</p>

Use it when you want:

- built-in workflows for bug fixes, features, refactors, security work, and quick changes;
- sequential role execution instead of one assistant doing every step at once;
- required test and review gates;
- failure routes back to the right role;
- blocked-state reporting with a resumable role;
- custom YAML workflows and custom role prompts.

## Install locally

Copy the skill into your Claude Code skills directory:

```bash
cp -R claude/skills/agentflow ~/.claude/skills/
```

Then start Claude Code in any project and run:

```txt
/agentflow list
```

## Quick start

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

## Commands

| Command | Purpose |
| --- | --- |
| `/agentflow list` | Show built-in workflow templates. |
| `/agentflow show <template>` | Show a built-in template's flow, roles, rules, and failure routes. |
| `/agentflow validate <template.yaml>` | Validate a custom workflow YAML file without running it. |
| `/agentflow run <template> "<task>"` | Run a built-in workflow for a task. |
| `/agentflow run <template.yaml> "<task>"` | Run a custom workflow file for a task. |

Built-in templates are addressed by name. Custom templates are currently addressed by explicit YAML file path.

## Built-in workflows

| Template | Flow | Best for |
| --- | --- | --- |
| `bugfix` | Investigator → Developer → Tester → Reviewer | Debugging and fixing defects with final review. |
| `feature` | Architect → Developer → Tester → Reviewer | Adding behavior with design, implementation, verification, and review. |
| `refactor` | Architect → Developer → Regression Tester → Reviewer | Behavior-preserving changes with regression focus. |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | Security-sensitive changes with senior approval. |
| `quick` | Developer → Tester | Small changes that still need independent verification. |

## Workflow decisions

Roles return structured decisions that the workflow runner normalizes for routing.

| Role type | Decisions |
| --- | --- |
| Developer | `implemented`, `blocked` |
| Tester / Regression Tester | `passed`, `failed`, `blocked` |
| Reviewer roles | `approved`, `changes_requested`, `blocked` |

`failed` and `changes_requested` route through the template's `fail_to` path when configured. `blocked` stops the workflow with a resume point so the user can provide missing information and continue from the blocked role by default.

## Custom workflows

Custom workflows are YAML files with roles, routes, a start role, and workflow rules.

```yaml
name: strict-bugfix
description: Debug and fix a defect with investigation, testing, and final review gates.

roles:
  investigator:
    title: Investigator
    uses: builtin/investigator
    can_edit: false
    can_run_commands: true
    pass_to: developer

  developer:
    title: Developer
    uses: builtin/developer
    can_edit: true
    can_run_commands: true
    pass_to: tester

  tester:
    title: Tester
    uses: builtin/tester
    can_edit: true
    can_run_commands: true
    pass_to: reviewer
    fail_to: developer

  reviewer:
    title: Reviewer
    uses: builtin/reviewer
    can_edit: false
    can_run_commands: true
    pass_to: done
    fail_to: developer

flow:
  start: investigator

rules:
  max_loops: 2
  require_tests: true
  require_final_review: true
```

Copyable examples live in:

```txt
claude/skills/agentflow/examples/workflow-templates/
claude/skills/agentflow/examples/role-templates/
```

## Custom role prompts

A role can use a built-in prompt:

```yaml
developer:
  title: Developer
  uses: builtin/developer
  can_edit: true
  can_run_commands: true
  pass_to: tester
```

A role can also combine a built-in prompt with extra instructions:

```yaml
docs-writer:
  title: Docs Writer
  uses: builtin/developer
  prompt: |
    Focus only on documentation changes.
    Keep edits concise, accurate, and scoped to the user's request.
  can_edit: true
  can_run_commands: true
  pass_to: docs-reviewer
```

If you write a fully custom role prompt without `uses`, include the role responsibility, allowed actions, decision vocabulary, output structure, handoff destination, pass/fail/block conditions, and how the role respects test and review gates.

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
