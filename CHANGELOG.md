# Changelog

All notable changes to AgentFlow will be documented in this file.

## Unreleased

## 0.0.3 - 2026-05-25

### Added

- Documented `/agentflow role <role> "<task>"` in the English and Chinese READMEs.
- Listed supported built-in single-role slugs:
  - `investigator`
  - `architect`
  - `developer`
  - `tester`
  - `regression-tester`
  - `reviewer`
  - `security-reviewer`
  - `senior-reviewer`

### Changed

- Condensed README custom role prompt guidance into a compact checklist.
- Clarified that single-role mode reports only one role's decision and does not complete a workflow or bypass test/review gates.
- Tightened built-in role prompt permission wording while preserving each role's decision contract and output structure.
- Consolidated Security Reviewer scope wording while keeping coverage for authentication, authorization, sessions, tokens, secrets, injection, SSRF, webhooks, payments, permissions, file upload/download, admin features, and multi-tenant data access.

## 0.0.2 - 2026-05-25

### Added

- Added npm package metadata for `@leokon3/agentflow`.
- Added `agentflow` CLI installer entry point.
- Added interactive install flow for Claude Code project or global skill installation.
- Added MIT license metadata and `LICENSE` file.
- Added single-role command support in the skill contract:
  - `/agentflow role <role> "<task>"`

### Changed

- Updated install instructions to use:
  - `npx @leokon3/agentflow@latest install`
- Moved publishable skill source to `skills/agentflow/`.
- Clarified project workflow template location:
  - `.agentflow/templates/<name>.yaml`
- Clarified the difference between project templates and Claude Code skill installation directories.
- Updated README and Chinese README with npm installation and single-role usage.

### Fixed

- Clarified that `can_edit` and `can_run_commands` are workflow prompt constraints, not permission bypasses.
- Clarified that single-role mode does not initialize workflow state, route to another role, or mark gates as passed.

## 0.0.1 - 2026-05-25

### Added

- Initial published package for installing the AgentFlow Claude Code skill.
- Built-in role-based workflow templates:
  - `bugfix`
  - `feature`
  - `refactor`
  - `security`
  - `quick`
- Built-in role prompts for investigation, architecture, development, testing, regression testing, review, security review, and senior review.
- Workflow support for handoffs, test gates, review gates, failure routing, blocked recovery, and final reports.
- English and Chinese README documentation.
- README banner and workflow SVG assets.
