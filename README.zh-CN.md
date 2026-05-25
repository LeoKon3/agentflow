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

需要支持 skill 的 Claude Code。`agentflow` 最适合在 git 仓库中使用，尤其是涉及代码修改或 Claude Code worktree isolation 的 workflow。非 git 项目也可以通过 Claude Code 的 `WorktreeCreate` / `WorktreeRemove` hooks 自定义隔离方式，但推荐路径仍然是 git。

安装 skill：

```bash
npx @leokon3/agentflow@latest install
```

选择 Claude Code，然后选择安装到当前项目或全局目录。

如果不能使用 npm，也可以在本仓库 checkout 中手动安装：

```bash
mkdir -p ~/.claude/skills
cp -R skills/agentflow ~/.claude/skills/
```

然后在任意项目中启动 Claude Code：

```txt
/agentflow list
/agentflow show bugfix
/agentflow run bugfix "fix login redirect bug"
/agentflow role reviewer "review the current diff"
```

运行自定义 workflow YAML 文件：

```txt
/agentflow validate ./skills/agentflow/examples/workflow-templates/strict-bugfix.yaml
/agentflow run ./skills/agentflow/examples/workflow-templates/strict-bugfix.yaml "fix login redirect bug"
```

或者把项目模板放到 `.agentflow/templates/strict-bugfix.yaml`，然后按名字运行：

```txt
/agentflow run strict-bugfix "fix login redirect bug"
```

## 内置 workflows

| 模板       | 流程                                                     | 适合场景                               |
| ---------- | -------------------------------------------------------- | -------------------------------------- |
| `bugfix`   | Investigator → Developer → Tester → Reviewer             | 诊断、修复、验证并 review 一个缺陷。   |
| `feature`  | Architect → Developer → Tester → Reviewer                | 设计、实现、验证并 review 一个新行为。 |
| `refactor` | Architect → Developer → Regression Tester → Reviewer     | 调整结构，同时证明行为保持不变。       |
| `security` | Developer → Security Reviewer → Tester → Senior Reviewer | 修改安全敏感代码，并进行额外 review。  |
| `quick`    | Developer → Tester                                       | 完成一个小实现，并做聚焦验证。         |

## 命令

| 命令                                      | 作用                       |
| ----------------------------------------- | -------------------------- |
| `/agentflow list`                         | 查看内置和项目 workflows。 |
| `/agentflow show <template>`              | 查看 workflow 细节。       |
| `/agentflow validate <template>`          | 校验 workflow 模板。       |
| `/agentflow role <role> "<task>"`         | 只运行一个内置角色。       |
| `/agentflow run <template> "<task>"`      | 按名称运行 workflow。      |
| `/agentflow run <template.yaml> "<task>"` | 按路径运行 workflow 文件。 |

Single-role mode 适合单独做调查、设计、实现、测试或 review。它只返回该角色的 decision，不会把整个 workflow 标记为 passed，也不会绕过测试或 review gates。

可用的内置 role slugs：`investigator`、`architect`、`developer`、`tester`、`regression-tester`、`reviewer`、`security-reviewer`、`senior-reviewer`。v0.1 的 `/agentflow role` 不解析自定义或项目 role templates。

模板解析顺序：

1. 显式 YAML 路径会按原路径加载。
2. 项目模板从 `.agentflow/templates/<name>.yaml` 加载。
3. 内置模板从已安装 skill 的 `templates/<name>.yaml` 加载。

同名时，项目模板优先于内置模板。

`.agentflow/templates/` 是项目里的 agentflow workflow 配置目录，适合提交到仓库共享；`.claude/skills/agentflow/` 是 Claude Code skill 的安装目录，不建议放用户自定义模板。

## Workflow 决策

每个角色都会返回用于路由的结构化 decision。

| 角色类型                   | 决策                                       |
| -------------------------- | ------------------------------------------ |
| Developer                  | `implemented`, `blocked`                   |
| Tester / Regression Tester | `passed`, `failed`, `blocked`              |
| Reviewer roles             | `approved`, `changes_requested`, `blocked` |

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

可复用的项目模板可以保存到：

```txt
.agentflow/templates/<name>.yaml
```

然后按名称运行：

```txt
/agentflow run <name> "<task>"
```

更多 workflow 示例：

```txt
skills/agentflow/examples/workflow-templates/
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

上面的 YAML 是在 workflow 里配置 role。可复用的 role template 本身是一个 Markdown prompt contract。如果不使用 `uses`、完全自定义 role prompt，请包含：

- 角色职责
- 允许的动作和限制
- decision vocabulary
- 必须输出的结构
- pass/fail/block 条件
- 交接目标

保持 role prompt 小而明确：workflow 应该清楚说明这个角色能做什么、如何判断、下一步交给谁。

角色 prompt 示例在：

```txt
skills/agentflow/examples/role-templates/
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
package.json                             # npx 安装用的 npm package 元数据
bin/agentflow.js                         # 交互式安装 CLI
skills/agentflow/                        # 可发布的 skill 源码
  SKILL.md                               # 命令行为和 workflow runner 规则
  templates/                             # 内置 workflow 模板
  roles/                                 # 内置角色 prompts
  examples/                              # 可复制的 workflow 和 role 示例
```
