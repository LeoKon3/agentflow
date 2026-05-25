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
  一个 Claude Code skill，把单个 coding session 变成带交接、门禁和恢复循环的多角色 workflow。
</p>

<p align="center">
  <a href="README.md"><img alt="Read in English" src="https://img.shields.io/badge/English-read-2563eb?style=for-the-badge"></a>
  <a href="README.zh-CN.md"><img alt="Chinese current" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87-current-6b7280?style=for-the-badge"></a>
</p>

## 为什么需要 agentflow？

Claude Code 可以处理复杂任务，但更大的改动通常需要清晰的角色边界、验证门禁和评审门禁。

`agentflow` 会把这些边界显式化：

- Developer 负责实现。
- Tester 负责验证。
- Reviewer 负责批准。
- 失败检查会路由回正确角色。
- Blocked 角色会报告缺少什么，以及应该从哪里继续。

<p align="center">
  <img src="assets/agentflow-workflow.svg" alt="AgentFlow 多角色 workflow 图" width="100%" />
</p>

## 快速开始

需要支持 skill 的 Claude Code。

把 skill 复制到 Claude Code skills 目录：

```bash
cp -R claude/skills/agentflow ~/.claude/skills/
```

然后在任意项目中启动 Claude Code：

```txt
/agentflow list
/agentflow show bugfix
/agentflow run bugfix "fix login redirect bug"
```

运行自定义 workflow YAML 文件：

```txt
/agentflow validate ./claude/skills/agentflow/examples/workflow-templates/strict-bugfix.yaml
/agentflow run ./claude/skills/agentflow/examples/workflow-templates/strict-bugfix.yaml "fix login redirect bug"
```

## 内置 workflows

| 模板 | 流程 | 适合场景 |
| --- | --- | --- |
| `bugfix` | Investigator → Developer → Tester → Reviewer | 需要 root cause、修复、测试和 review。 |
| `feature` | Architect → Developer → Tester → Reviewer | 实现前需要一个小计划。 |
| `refactor` | Architect → Developer → Regression Tester → Reviewer | 行为应该保持不变。 |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | 涉及 auth、tokens、permissions、webhooks 或 payment 边界。 |
| `quick` | Developer → Tester | 改动很小，但仍需要验证。 |

## 命令

| 命令 | 作用 |
| --- | --- |
| `/agentflow list` | 查看内置 workflows。 |
| `/agentflow show <template>` | 查看 workflow 细节。 |
| `/agentflow validate <template.yaml>` | 校验自定义 workflow 文件。 |
| `/agentflow run <template> "<task>"` | 运行内置 workflow。 |
| `/agentflow run <template.yaml> "<task>"` | 运行自定义 workflow 文件。 |

内置模板通过名称调用。当前自定义模板通过显式 YAML 文件路径调用。

## Workflow 决策

每个角色都会返回用于路由的结构化 decision。

| 角色类型 | 决策 |
| --- | --- |
| Developer | `implemented`, `blocked` |
| Tester / Regression Tester | `passed`, `failed`, `blocked` |
| Reviewer roles | `approved`, `changes_requested`, `blocked` |

`failed` 和 `changes_requested` 会路由到配置的 `fail_to` 角色。

`blocked` 会带着 resume point 停止，用户补充缺失信息后可以从 blocked 角色继续。

## 自定义 workflows

自定义 workflow 是 YAML 文件，包含 roles、routes、start role 和 rules。

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

更多示例：

```txt
claude/skills/agentflow/examples/workflow-templates/
claude/skills/agentflow/examples/role-templates/
```

`can_edit` 和 `can_run_commands` 这类角色权限是 prompt 层面的 workflow 约束。Claude Code 原本的工具确认和权限设置仍然生效。

## 自定义角色 prompts

使用 `uses: builtin/<role>` 可以复用内置角色 prompt。角色需要额外说明时，可以添加 `prompt:`。

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

上面的 YAML 是在 workflow 里配置 role。可复用的 role template 本身是一个 Markdown prompt contract。下面是一个缩短版示例：

````markdown
# Docs Reviewer

You are a documentation reviewer responsible for checking clarity, accuracy, and usefulness.

You must:
- Review changed documentation, workflow context, handoffs, and verification evidence.
- Check examples, command names, file paths, links, terminology, and repo consistency.
- Request changes when docs are misleading, incomplete, unsupported, or too vague.

You must not:
- Edit files unless the workflow role explicitly allows editing.
- Approve documentation that contradicts current code or project structure.

Return a structured result such as:

```markdown
## Docs Review Result

Decision: approved | changes_requested | blocked

### Documentation reviewed
...

### Issues
...

### Required changes
...

### Approval notes
...

### Handoff to
<workflow-provided next role>
```

Use `Decision: approved` only when the docs are accurate, clear, and scoped.
````

如果不使用 `uses`、完全自定义 role prompt，请把它写成一个小契约，包含角色职责、允许做什么、decision vocabulary、必须输出的结构、pass/fail/block 条件和交接目标。

角色 prompt 示例在：

```txt
claude/skills/agentflow/examples/role-templates/
```

包含示例：

- `product-reviewer.md`
- `api-reviewer.md`
- `docs-reviewer.md`
- `migration-reviewer.md`

## 验证边界

Developer handoff 会说明哪些内容能在当前代码环境验证、哪些需要运行时或外部环境、哪些不属于本次改动范围。Tester 和 Regression Tester 会基于这些边界判断当前证据是否足够 pass、fail 或 block。

## 仓库结构

```txt
claude/skills/agentflow/                 # 可发布的 Claude Code skill 源码
  SKILL.md                               # 命令行为和 workflow runner 规则
  templates/                             # 内置 workflow 模板
  roles/                                 # 内置角色 prompts
  examples/                              # 可复制的 workflow 和 role 示例
```

本地 `.claude/` 目录只用于本机 Claude Code 设置和本地测试，不是产品源码。
