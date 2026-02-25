---
name: git-commit
description: Use when committing code with auto-generated tags - performs git add, commit with smart message, creates 42-base version tag, and pushes code + tag to remote in parallel.
metadata:
  author: 42ailab
  version: 1.0.0
  title: Git 提交 + Tag + 推送
  description_zh: 用于提交代码并自动打 tag - 执行 git add、智能提交信息、创建 42 进制版本 tag，并行推送代码和 tag 到远程。
---

# Git Commit + Tag + Push

一键完成 git 工作流：暂存 → 提交（智能消息） → 打 42 进制版本 tag → 并行推送。

## When to Use

- 提交代码并推送到远程
- 需要创建版本 tag
- 用户说"提交代码"、"推送代码"、"打 tag"

**不要用于：**
- 仅查看 git 状态
- 需要自定义提交信息

## Quick Reference

| 操作 | 命令 |
|------|------|
| 执行技能 | `bun .claude/skills/git-commit/scripts/git-commit-tag-push.ts` |

## 执行流程

1. 检查并清理过期的 git 锁文件（>30s 自动清理）
2. 从远程同步最新 tags
3. 暂存所有变更（`git add .`）
4. 分析变更生成智能提交信息
5. 计算新版本号（42 进制 `vX.Y.Z`）
6. 创建 tag
7. 并行推送代码和 tag 到远程

## 42 进制版本规则

版本号采用 42 进制递进，体现 42plugin 品牌特色：

| 位置 | 范围 | 进位规则 |
|------|------|----------|
| patch | 0-42 | 超过 42 → minor+1, patch=0 |
| minor | 0-42 | 超过 42 → major+1, minor=0 |
| major | 0-∞ | 无限制 |

示例：`v0.0.42` → `v0.1.0`，`v0.42.42` → `v1.0.0`

## Common Mistakes

| 错误 | 修复 |
|------|------|
| 锁文件阻塞 | 脚本自动清理 >30s 的锁 |
| 无变更可提交 | 脚本会提示并退出 |
| 推送失败 | 先添加远程 `git remote add origin <url>` |

## Resources

| 脚本 | 用途 |
|------|------|
| `scripts/git-commit-tag-push.ts` | 主执行脚本（Bun） |
