<p align="center">
  <img src="assets/agentflow-banner.svg" alt="AGENTFLOW banner" width="100%" />
</p>

<h1 align="center">agentflow</h1>

<p align="center">
  一个 Claude Code skill，用于在同一个 Claude Code 会话中运行有纪律的多角色 coding workflow。
</p>

<p align="center">
  <a href="README.md"><kbd>English</kbd></a>
  <a href="README.zh-CN.md"><kbd>中文</kbd></a>
</p>

```txt
Developer writes. Tester verifies. Reviewer approves. You define the flow.
```

> [!NOTE]
> `agentflow` 是 Claude Code skill，不是独立 CLI。`can_edit` 和 `can_run_commands` 这类角色权限是 prompt 层面的 workflow 约束；Claude Code 原本的工具确认和权限设置仍然生效。

## 为什么需要 agentflow？

Claude Code 可以处理复杂任务，但大一点的改动更需要明确的角色分工、测试门禁和评审门禁。`agentflow` 会把每一步的职责、交接、验证、失败路由和最终报告显式化，避免实现、测试或 review 被悄悄跳过。

<p align="center">
  <img src="assets/agentflow-workflow.svg" alt="AgentFlow 多角色 workflow 图" width="100%" />
</p>

适合在这些场景使用：

- 使用内置 workflow 处理 bugfix、feature、refactor、security 和 quick change；
- 希望按角色顺序执行，而不是让一个 assistant 一次性做完所有事情；
- 需要强制测试和 review gate；
- 需要失败后回到正确角色返工；
- 需要 blocked 状态报告，并能从 blocked 角色继续；
- 需要自定义 YAML workflow 和自定义角色 prompt。

## 本地安装

把 skill 复制到 Claude Code skills 目录：

```bash
cp -R claude/skills/agentflow ~/.claude/skills/
```

然后在任意项目中启动 Claude Code，运行：

```txt
/agentflow list
```

## 快速开始

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

## 命令

| 命令 | 作用 |
| --- | --- |
| `/agentflow list` | 查看内置 workflow 模板。 |
| `/agentflow show <template>` | 查看内置模板的流程、角色、规则和失败路由。 |
| `/agentflow validate <template.yaml>` | 校验自定义 workflow YAML 文件，不运行。 |
| `/agentflow run <template> "<task>"` | 使用内置 workflow 执行任务。 |
| `/agentflow run <template.yaml> "<task>"` | 使用自定义 workflow 文件执行任务。 |

内置模板通过名称调用。当前自定义模板通过显式 YAML 文件路径调用。

## 内置 workflows

| 模板 | 流程 | 适合场景 |
| --- | --- | --- |
| `bugfix` | Investigator → Developer → Tester → Reviewer | 调查并修复缺陷，最后 review。 |
| `feature` | Architect → Developer → Tester → Reviewer | 新增行为，包含设计、实现、验证和 review。 |
| `refactor` | Architect → Developer → Regression Tester → Reviewer | 保持行为不变的重构，重点关注回归风险。 |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | 安全敏感改动，需要高级别确认。 |
| `quick` | Developer → Tester | 小改动，但仍需要独立验证。 |

## Workflow 决策

角色会返回结构化 decision，workflow runner 根据 decision 做路由。

| 角色类型 | 决策 |
| --- | --- |
| Developer | `implemented`, `blocked` |
| Tester / Regression Tester | `passed`, `failed`, `blocked` |
| Reviewer roles | `approved`, `changes_requested`, `blocked` |

`failed` 和 `changes_requested` 会在模板配置了 `fail_to` 时走失败路由。`blocked` 会停止 workflow 并保留 resume point，用户补充信息后默认从 blocked 角色继续。

## 自定义 workflows

自定义 workflow 是 YAML 文件，包含 roles、routes、start role 和 rules。

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

可复制示例在：

```txt
claude/skills/agentflow/examples/workflow-templates/
claude/skills/agentflow/examples/role-templates/
```

## 自定义角色 prompts

角色可以直接使用内置 prompt：

```yaml
developer:
  title: Developer
  uses: builtin/developer
  can_edit: true
  can_run_commands: true
  pass_to: tester
```

也可以在内置 prompt 上追加额外说明：

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

如果不使用 `uses`、完全自定义角色 prompt，需要写清楚角色职责、允许做什么、decision vocabulary、输出结构、交接目标、pass/fail/block 条件，以及如何遵守测试和 review gate。

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
