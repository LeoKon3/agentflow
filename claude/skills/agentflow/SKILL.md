---
name: agentflow
description: Run configurable multi-role Claude Code workflows with templates, handoffs, test gates, review gates, failure routing, and final reports.
---

# agentflow

`agentflow` turns one Claude Code session into a disciplined workflow runner:

```txt
Investigate → Implement → Test → Review → Finish
```

Use this skill when the user invokes `/agentflow` or asks to run an agentflow workflow.

## Command forms

Supported commands:

```txt
/agentflow list
/agentflow show <template>
/agentflow validate <template.yaml>
/agentflow run <template> "<task>"
/agentflow run <template.yaml> "<task>"
```

Built-in templates:

- `bugfix`: Investigator → Developer → Tester → Reviewer
- `feature`: Architect → Developer → Tester → Reviewer
- `refactor`: Architect → Developer → Regression Tester → Reviewer
- `security`: Developer → Security Reviewer → Tester → Senior Reviewer
- `quick`: Developer → Tester

Built-in role prompts live in `roles/` and built-in templates live in `templates/`.

If the command is invalid, show the supported command forms and stop.

## `/agentflow list`

Show built-in templates in this format:

```txt
Built-in templates:
- bugfix      Investigator → Developer → Tester → Reviewer
- feature     Architect → Developer → Tester → Reviewer
- refactor    Architect → Developer → Regression Tester → Reviewer
- security    Developer → Security Reviewer → Tester → Senior Reviewer
- quick       Developer → Tester
```

Do not invent remote or marketplace templates.

## `/agentflow show <template>`

Load the named built-in template from `templates/`.

Show:

- Template name.
- Description.
- Flow.
- Rules.
- Roles.
- Failure routes.

If the template is unknown, list the built-in template names and stop.

## `/agentflow validate <template.yaml>`

Validate only an explicit YAML file path supplied by the user. Do not search arbitrary directories for custom template names.

Validation checklist:

- `name` exists.
- `roles` exists and is non-empty.
- `flow.start` exists.
- `flow.start` names an existing role.
- Every role has either `uses` or `prompt`.
- Every `uses` value is one of:
  - `builtin/investigator`
  - `builtin/architect`
  - `builtin/developer`
  - `builtin/tester`
  - `builtin/regression-tester`
  - `builtin/reviewer`
  - `builtin/security-reviewer`
  - `builtin/senior-reviewer`
- Every role has `can_edit` and `can_run_commands` booleans.
- Every role has `pass_to` pointing to an existing role or `done`.
- Every `fail_to`, when present, points to an existing role.
- `rules.max_loops` exists and is a positive number.
- `rules.require_tests` exists and is a boolean.
- `rules.require_final_review` exists and is a boolean.
- Every success route reachable from `flow.start` must terminate at `done`.
- Reject `pass_to` cycles because successful workflows must not loop forever.
- If `rules.require_tests: true`, every terminating successful path to `done` passes through a role using `builtin/tester` or `builtin/regression-tester`.
- If `rules.require_final_review: true`, every terminating successful path to `done` passes through a role using `builtin/reviewer`, `builtin/security-reviewer`, or `builtin/senior-reviewer`.
- A Developer role may route directly to `done` only when required test and review gates are disabled.

Report validation results with concrete field paths when possible. If validation fails, do not run the workflow.

## `/agentflow run <template> "<task>"`

Run a built-in template by name or a custom template by explicit YAML path.

Execution rules:

1. Load the template.
2. Validate the template using the validation checklist.
3. Initialize workflow state.
4. Display conversation-first progress.
5. Run exactly one role at a time.
6. Wait for that role's handoff before routing.
7. Never dispatch roles in parallel in v0.1.
8. Parse the role's `Decision:` line.
9. Normalize the decision.
10. Route using `pass_to` or `fail_to`.
11. Enforce `rules.max_loops`.
12. Stop as `blocked` when the next safe action requires user intervention, preserving a resume point for the blocked role.
13. After user input resolves a blocker, resume from the blocked role by default unless the new information changes requirements, design, or implementation direction.
14. End with a final report.

## Workflow controller responsibilities

The runner acts as the workflow controller.

The runner must:

- Select the next role only from the template's `pass_to` and `fail_to` routes.
- Normalize role decisions without changing their meaning.
- Enforce required gates, failure routing, blocked stops, and max loops.
- Preserve each role's handoff as context for downstream roles.
- Stop rather than override a failed, blocked, or changes-requested gate.

The runner must not:

- Investigate root cause.
- Implement code.
- Write or change tests.
- Approve code quality or security.
- Override Tester, Reviewer, Security Reviewer, or Senior Reviewer failure decisions.

## Testing ownership

Developer owns implementation and test-code changes. Developer should add or update tests when the task requires new behavior, regression coverage, or a bug reproduction test, then recommend focused verification commands and describe the verification boundary: what can be verified in the current code environment, what requires external or runtime environment access, and what is not required for the change.

Tester or Regression Tester owns independent verification. They may add or adjust verification-only tests when permitted by `can_edit: true`, but must not modify production code to make tests pass. They must assess the Developer's verification boundary against the user task, prior handoffs, changed files, and project test structure. If core behavior can be verified in the current environment, they should run the strongest available checks instead of blocking only because external or end-to-end coverage is unavailable. If missing external or runtime access prevents core behavior verification, they should return `blocked`. If they discover missing tests, broken behavior, or insufficient core coverage that Developer can fix, they should return `failed` with a required fix for Developer unless the situation is blocked by missing information or environment access.

Reviewer owns assessment of whether the test evidence is sufficient. Reviewer must not approve when Tester or Regression Tester failed, blocked, or provided missing or too-weak test evidence.

## Workflow state

Maintain state in the conversation:

```yaml
workflow: bugfix
task: "fix login redirect bug"
status: running
current_role: tester
loop_count: 0
max_loops: 3

roles:
  investigator: passed
  developer: passed
  tester: running
  reviewer: pending

timeline:
  - role: investigator
    decision: passed
  - role: developer
    decision: implemented
    normalized_decision: passed
```

Role status values:

- `pending`
- `running`
- `implemented`
- `passed`
- `failed`
- `approved`
- `changes_requested`
- `blocked`

Workflow status values:

- `running`
- `passed`
- `failed`
- `blocked`

Progress display:

```txt
agentflow: <workflow>
Task: <task>
Status: <status>
Loop: <loop_count>/<max_loops>

[1/N] <Role Title>: <status>
[2/N] <Role Title>: <status>
```

When failure routes backward, show:

```txt
Routing:
<Failing Role> → <Next Role>
```

## Role prompt composition

For each role, compose the role subagent prompt from:

1. Built-in role prompt referenced by `uses`, if present.
2. Custom role `prompt`, if present.
3. Original user task.
4. Template name and rules.
5. Current workflow state.
6. Prior role handoffs.
7. Latest failure or blocker, if any.
8. Permission constraints from `can_edit` and `can_run_commands`.
9. Workflow-provided next role for success from `pass_to`.
10. Workflow-provided next role for failure from `fail_to`, when present.
11. The “Use of other skills” constraint: supporting skills may be used only as tools and must not override role permissions, handoff contract, decision vocabulary, routing, required gates, or final completion rules.
12. The testing ownership rule: Developer owns implementation and test-code changes; Tester or Regression Tester owns independent verification and may only add or adjust verification-only tests when permitted.
13. The verification boundary rule: Developer must state core verification, external/runtime verification needs, and non-required checks; Tester or Regression Tester must assess that boundary before deciding whether missing environment access is passable risk or a blocker.
14. The blocked resume rule: if resuming after user input, include the blocked role's prior handoff, blocker reason, user-provided resolution, and whether the workflow should continue from the blocked role or route backward.

The workflow-provided next role overrides any generic handoff placeholder in the built-in role prompt. A role with neither `uses` nor `prompt` is invalid.

## Use of other skills

Role subagents may use other installed skills only as supporting tools. They must still follow the current agentflow role prompt, permission constraints, handoff contract, decision vocabulary, routing rules, and final-report rules. They must not use another skill to bypass required gates, self-approve, or mark the workflow complete outside the configured route.

## Role permissions

`can_edit` and `can_run_commands` are v0.1 prompt-level constraints, not OS-level sandboxes.

Still enforce them in the prompt:

- If `can_edit: false`, tell the role not to modify files.
- If `can_run_commands: false`, tell the role not to run shell commands.
- If a role cannot complete without a forbidden action, it must return `Decision: blocked`.

The Developer role can directly finish only when required test and review gates are disabled and the template explicitly routes Developer to `done`. Built-in workflows do not allow Developer to self-approve.

## Sequential subagents

Use a separate subagent for each role execution. Each subagent prompt must include the composed role prompt and ask for exactly the role's handoff contract.

Run roles sequentially:

```txt
Run current role → receive handoff → parse decision → route → run next role
```

Do not launch multiple role subagents at once.

## Decision parsing

Read the role handoff and find a `Decision:` line.

Accepted raw decisions:

- `implemented`
- `passed`
- `failed`
- `blocked`
- `approved`
- `changes_requested`

Normalize decisions:

- `implemented` → `passed`
- `passed` → `passed`
- `approved` → `passed`
- `failed` → `failed`
- `changes_requested` → `failed`
- `blocked` → `blocked`

The Developer decision `implemented` means implementation handoff completed, not workflow approval.

If the decision is missing, malformed, or ambiguous, mark the workflow `blocked` and ask the user how to proceed.

## Routing

- On normalized `passed`, route to `pass_to`.
- On normalized `failed`, route to `fail_to`.
- If `failed` has no `fail_to`, stop with workflow status `failed`.
- On `blocked`, stop with workflow status `blocked` and preserve a resume point for the blocked role.
- If route is `done`, finish with workflow status `passed`.

Increment `loop_count` when a failure route sends work from a later role back to an earlier role. If `loop_count` reaches `max_loops`, stop as `failed` instead of running another repair loop.

## Blocked resume

When a role returns `Decision: blocked`, record:

- Blocked role.
- Blocker reason.
- Required user input or external action.
- Recommended resume action: `resume_current_role`, `route_to_configured_fail_to`, `rerun_workflow`, or `abort`.

After the user provides missing information, environment details, command output, credentials status, screenshots, or runtime constraints, resume from the blocked role by default. Route backward only when the new information changes requirements, design, or implementation direction. Rerun the workflow from the start only when the user explicitly asks or the prior workflow state is no longer reliable.

## Final report

Every run must end with:

```markdown
## agentflow result

Workflow: <name>
Status: passed | failed | blocked
Loops: <loop_count>/<max_loops>

### Roles completed
- ...

### Timeline
1. ...

### Tests run
- ...

### Final review
...

### Changed files
- ...
```

For failed or blocked workflows, include:

```markdown
### Reason
...

### Last failing or blocked role
...

### Last failure or blocker
...

### Suggested next action
...
```

For blocked workflows, also include:

```markdown
### Blocked resume point
Role: <blocked role>
Reason: <why blocked>
Required user input:
- ...
Recommended resume action: resume_current_role | route_to_configured_fail_to | rerun_workflow | abort

### Possible resume actions
- Continue current role after user input
- Route to the configured failure route when backward routing is required
- Rerun workflow from start
- Stop workflow
```

Do not claim completion unless required test and review gates have passed or the selected template legitimately ends without final review.
