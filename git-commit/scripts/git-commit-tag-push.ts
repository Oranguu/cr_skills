#!/usr/bin/env bun
/**
 * git-commit-tag-push.ts
 * 高性能版本：Bun + 并行优化 + 锁文件处理
 */

import { $ } from "bun";
import { existsSync, unlinkSync, statSync } from "fs";
import { join } from "path";

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
};

function log(msg: string) { console.log(msg); }
function step(n: number, msg: string) { log(`${C.yellow}[${n}/5]${C.reset} ${msg}`); }
function ok(msg: string) { log(`${C.green}✓ ${msg}${C.reset}`); }
function err(msg: string) { log(`${C.red}✗ ${msg}${C.reset}`); }
function warn(msg: string) { log(`${C.yellow}⚠ ${msg}${C.reset}`); }

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  return output.trim();
}

async function runQuiet(cmd: string[]): Promise<boolean> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  const code = await proc.exited;
  return code === 0;
}

// 分析变更文件生成有意义的提交信息
async function generateCommitMessage(diffLines: string[]): Promise<string> {
  // 提取文件路径
  const files = diffLines.map(line => line.split("\t")[2]).filter(Boolean);

  if (files.length === 0) {
    return "chore: 更新代码";
  }

  // 分析 scope（模块）
  const scopes = new Set<string>();
  const types = new Set<string>();

  for (const file of files) {
    // 检测模块
    if (file.includes("42plugin-webapp")) scopes.add("webapp");
    else if (file.includes("42plugin-api")) scopes.add("api");
    else if (file.includes("42plugin-database")) scopes.add("database");
    else if (file.includes("42plugin-pipeline")) scopes.add("pipeline");
    else if (file.includes(".claude")) scopes.add("claude");

    // 检测类型
    if (file.endsWith(".md") || file.includes("/docs/")) types.add("docs");
    else if (file.includes("test") || file.includes("spec")) types.add("test");
    else if (file.includes("config") || file.endsWith(".toml") || file.endsWith(".json")) types.add("config");
    else if (file.includes("route.ts") || file.includes("/api/")) types.add("api");
    else if (file.includes("component") || file.includes("/ui/")) types.add("ui");
  }

  // 获取更详细的变更信息
  const diffSummary = await run(["git", "diff", "--cached", "--stat"]);
  const nameStatus = await run(["git", "diff", "--cached", "--name-status"]);

  // 分析变更类型
  const statusLines = nameStatus.split("\n").filter(Boolean);
  let addCount = 0, modifyCount = 0, deleteCount = 0;

  for (const line of statusLines) {
    const status = line[0];
    if (status === "A") addCount++;
    else if (status === "M") modifyCount++;
    else if (status === "D") deleteCount++;
  }

  // 决定提交类型
  let type = "chore";
  if (types.has("docs")) type = "docs";
  else if (types.has("test")) type = "test";
  else if (addCount > 0 && modifyCount === 0 && deleteCount === 0) type = "feat";
  else if (deleteCount > addCount) type = "refactor";
  else if (modifyCount > 0) type = "fix";

  // 如果只有配置文件变更
  if (types.size === 1 && types.has("config")) type = "config";

  // 构建 scope
  const scopeStr = scopes.size > 0 ? `(${[...scopes].join(",")})` : "";

  // 生成描述
  let description = "";

  // 尝试从文件路径提取有意义的描述
  if (files.length === 1) {
    const file = files[0];
    const parts = file.split("/");
    const filename = parts[parts.length - 1].replace(/\.[^.]+$/, "");
    description = `更新 ${filename}`;
  } else if (files.length <= 3) {
    const names = files.map(f => {
      const parts = f.split("/");
      return parts[parts.length - 1].replace(/\.[^.]+$/, "");
    });
    description = `更新 ${names.join(", ")}`;
  } else {
    // 尝试找出共同的目录
    const dirs = files.map(f => {
      const parts = f.split("/");
      return parts.length > 1 ? parts[parts.length - 2] : parts[0];
    });
    const commonDir = [...new Set(dirs)];
    if (commonDir.length === 1) {
      description = `更新 ${commonDir[0]} (${files.length} 个文件)`;
    } else if (commonDir.length <= 3) {
      description = `更新 ${commonDir.join(", ")}`;
    } else {
      description = `更新 ${files.length} 个文件`;
    }
  }

  // 如果有新增文件，优先描述新增
  if (addCount > 0) {
    const newFiles = statusLines
      .filter(l => l[0] === "A")
      .map(l => l.substring(1).trim().split("/").pop()?.replace(/\.[^.]+$/, ""))
      .filter(Boolean);

    if (newFiles.length === 1) {
      type = "feat";
      description = `添加 ${newFiles[0]}`;
    } else if (newFiles.length <= 3) {
      type = "feat";
      description = `添加 ${newFiles.join(", ")}`;
    }
  }

  return `${type}${scopeStr}: ${description}`;
}

// 检查并清理过期的锁文件（超过 30 秒视为过期）
function checkAndCleanLockFile(): boolean {
  const lockFile = join(process.cwd(), ".git", "index.lock");

  if (existsSync(lockFile)) {
    try {
      const stat = statSync(lockFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs > 30000) { // 超过 30 秒
        warn(`发现过期锁文件 (${Math.round(ageMs/1000)}s)，正在清理...`);
        unlinkSync(lockFile);
        ok("锁文件已清理");
        return true;
      } else {
        err(`Git 操作正在进行中，请稍后重试 (锁文件存在 ${Math.round(ageMs/1000)}s)`);
        return false;
      }
    } catch (e) {
      err(`无法处理锁文件: ${e}`);
      return false;
    }
  }
  return true;
}

async function main() {
  const startTime = performance.now();
  log(`${C.blue}=== Git Commit + Tag + Push (Bun) ===${C.reset}\n`);

  // 0. 检查锁文件
  if (!checkAndCleanLockFile()) {
    process.exit(1);
  }

  // 1. 检查状态和远程（并行）
  step(1, "检查状态和远程...");
  const [status, remote] = await Promise.all([
    run(["git", "status", "--porcelain"]),
    run(["git", "remote"]).catch(() => ""),
  ]);

  if (!status) {
    ok("没有需要提交的更改");
    return;
  }

  const statusLines = status.split("\n");
  log(statusLines.slice(0, 5).join("\n"));
  if (statusLines.length > 5) log(`... 还有 ${statusLines.length - 5} 个文件`);

  const remoteNames = remote.split("\n").filter(Boolean);
  const remoteName = remoteNames[0] || "";

  // 2. 同步远程 tags
  if (remoteName) {
    step(2, `同步远程 tags (${remoteName})...`);
    await runQuiet(["git", "fetch", "--tags", "--force"]);
  }

  // 3. 暂存并提交
  step(3, "暂存并提交...");
  await runQuiet(["git", "add", "."]);

  const diffStats = await run(["git", "diff", "--cached", "--numstat"]);
  const diffLines = diffStats.split("\n").filter(Boolean);
  const fileCount = diffLines.length;
  const lineCount = diffLines.reduce((sum, line) => {
    const [add, del] = line.split("\t");
    return sum + (parseInt(add) || 0) + (parseInt(del) || 0);
  }, 0);

  // 分析变更生成有意义的提交信息
  const commitMsg = await generateCommitMessage(diffLines);

  const commitOk = await runQuiet(["git", "commit", "-m", commitMsg]);
  if (!commitOk) {
    err("提交失败");
    process.exit(1);
  }

  const commitHash = await run(["git", "rev-parse", "--short", "HEAD"]);
  ok(`提交: ${commitHash}`);

  // 4. 创建 tag
  step(4, "创建版本 tag...");
  const allTags = await run(["git", "tag", "--sort=-v:refname"]);
  const tagList = allTags.split("\n");
  const latestTag = tagList.find(t => /^v\d+\.\d+\.\d+$/.test(t)) || "";

  // 42 进制版本号递增规则
  let newTag: string;
  if (!latestTag) {
    newTag = "v0.0.1";
  } else {
    const match = latestTag.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      let major = parseInt(match[1]);
      let minor = parseInt(match[2]);
      let patch = parseInt(match[3]) + 1;

      // 42 进制进位规则
      if (patch > 42) {
        patch = 0;
        minor += 1;
      }
      if (minor > 42) {
        minor = 0;
        major += 1;
      }

      newTag = `v${major}.${minor}.${patch}`;

      // 防止重复 tag
      const existingTags = new Set(tagList);
      while (existingTags.has(newTag)) {
        patch++;
        if (patch > 42) {
          patch = 0;
          minor += 1;
        }
        if (minor > 42) {
          minor = 0;
          major += 1;
        }
        newTag = `v${major}.${minor}.${patch}`;
      }
    } else {
      newTag = "v0.0.1";
    }
  }

  await runQuiet(["git", "tag", newTag]);
  ok(`Tag: ${newTag}${latestTag ? ` (上一个: ${latestTag})` : ""}`);

  // 5. 推送（并行）
  if (remoteName) {
    step(5, "推送到远程...");
    const branch = await run(["git", "branch", "--show-current"]);

    // 并行推送代码和 tag
    await Promise.all([
      runQuiet(["git", "push", "--set-upstream", remoteName, branch]),
      runQuiet(["git", "push", remoteName, newTag]),
    ]);

    ok(`推送完成 → ${remoteName}`);
  }

  // 完成
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
  log(`\n${C.green}=== 完成 (${elapsed}s) ===${C.reset}`);
  log(`提交: ${C.blue}${commitHash}${C.reset}`);
  log(`Tag:  ${C.blue}${newTag}${C.reset}`);
  if (remoteName) log(`远程: ${C.blue}${remoteName}${C.reset}`);
}

main().catch((e) => {
  err(`错误: ${e.message}`);
  process.exit(1);
});
