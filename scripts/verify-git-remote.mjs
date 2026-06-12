import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const defaultRemoteName = "origin";
const defaultExpectedRepoPath = "8npyvz5bd8-lang/offerdesk";
const forbiddenRepoFragments = ["graphics-debug"];

export function verifyGitRemote(options = {}) {
  const remoteName = options.remoteName || defaultRemoteName;
  const expectedRepoPath = options.expectedRepoPath || defaultExpectedRepoPath;
  const remotesText = options.remotesText ?? runGit(["remote", "-v"]);
  const entries = parseGitRemotes(remotesText);
  const remoteEntries = entries.filter((item) => item.name === remoteName);
  const fetchEntry = remoteEntries.find((item) => item.type === "fetch");
  const pushEntry = remoteEntries.find((item) => item.type === "push");
  const expectedFix = `运行 git remote set-url ${remoteName} https://github.com/${expectedRepoPath}.git`;
  const checks = [
    {
      name: `${remoteName} fetch 地址`,
      pass: Boolean(fetchEntry && isExpectedRepoUrl(fetchEntry.url, expectedRepoPath)),
      fix: expectedFix
    },
    {
      name: `${remoteName} push 地址`,
      pass: Boolean(pushEntry && isExpectedRepoUrl(pushEntry.url, expectedRepoPath)),
      fix: expectedFix
    },
    {
      name: "没有错误仓库地址",
      pass: entries.every((item) => !forbiddenRepoFragments.some((fragment) => item.url.includes(fragment))),
      fix: "删除或改正指向错误仓库的 remote，避免发布到错误项目。"
    }
  ];

  return {
    remoteName,
    expectedRepoPath,
    entries,
    checks,
    ok: checks.every((item) => item.pass)
  };
}

export function parseGitRemotes(text) {
  return String(text || "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/u);
      if (!match) {
        throw new Error(`无法解析 Git remote：${line}`);
      }
      return {
        name: match[1],
        url: match[2],
        type: match[3]
      };
    });
}

export function renderGitRemoteReport(report) {
  const passed = report.checks.filter((item) => item.pass).length;
  const failed = report.checks.length - passed;
  const lines = [
    "OfferDesk Git 发布远端检查",
    `目标：${report.remoteName} -> ${report.expectedRepoPath}`,
    `通过：${passed}`,
    `失败：${failed}`,
    ""
  ];

  for (const check of report.checks) {
    lines.push(`${check.pass ? "OK" : "FAIL"} ${check.name}`);
    if (!check.pass) {
      lines.push(`  处理：${check.fix}`);
    }
  }

  return lines.join("\n");
}

export function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--no-fail") {
      values.noFail = true;
      continue;
    }
    const value = args[index + 1];
    if (!key.startsWith("--")) {
      throw new Error(`无法识别参数：${key}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：${key}`);
    }
    values[key.slice(2)] = value;
    index += 1;
  }

  return {
    remoteName: values.remote,
    expectedRepoPath: values.expected,
    noFail: values.noFail === true
  };
}

function isExpectedRepoUrl(url, expectedRepoPath) {
  return repoPathFromUrl(url) === expectedRepoPath;
}

function repoPathFromUrl(url) {
  const text = String(url || "").trim().replace(/\.git$/u, "");
  return text.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/u)?.[1] ||
    text.match(/^git@github\.com:([^/]+\/[^/]+)$/u)?.[1] ||
    text.match(/^ssh:\/\/git@ssh\.github\.com:\d+\/([^/]+\/[^/]+)$/u)?.[1] ||
    "";
}

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Git remote 检查失败。");
  }
  return result.stdout;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const report = verifyGitRemote(args);
    console.log(renderGitRemoteReport(report));
    if (!report.ok && !args.noFail) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
