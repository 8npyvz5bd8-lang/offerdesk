import assert from "node:assert/strict";
import {
  parseArgs,
  parseGitRemotes,
  renderGitRemoteReport,
  verifyGitRemote
} from "../scripts/verify-git-remote.mjs";

const okRemotes = [
  "origin\thttps://github.com/8npyvz5bd8-lang/offerdesk.git (fetch)",
  "origin\thttps://github.com/8npyvz5bd8-lang/offerdesk.git (push)",
  "offerdesk\tssh://git@ssh.github.com:443/8npyvz5bd8-lang/offerdesk.git (fetch)",
  "offerdesk\tssh://git@ssh.github.com:443/8npyvz5bd8-lang/offerdesk.git (push)"
].join("\n");

const entries = parseGitRemotes(okRemotes);
assert.equal(entries.length, 4);
assert.equal(entries[0].name, "origin");
assert.equal(entries[0].type, "fetch");

const okReport = verifyGitRemote({ remotesText: okRemotes });
assert.equal(okReport.ok, true);
assert.ok(renderGitRemoteReport(okReport).includes("失败：0"));

const wrongReport = verifyGitRemote({
  remotesText: [
    "origin\thttps://github.com/8npyvz5bd8-lang/graphics-debug.git (fetch)",
    "origin\thttps://github.com/8npyvz5bd8-lang/graphics-debug.git (push)"
  ].join("\n")
});
assert.equal(wrongReport.ok, false);
assert.equal(wrongReport.checks.filter((item) => item.pass).length, 0);
assert.ok(renderGitRemoteReport(wrongReport).includes("git remote set-url origin"));

const missingReport = verifyGitRemote({
  remotesText: "upstream\thttps://github.com/8npyvz5bd8-lang/offerdesk.git (fetch)\n"
});
assert.equal(missingReport.ok, false);
assert.equal(missingReport.checks.find((item) => item.name === "origin fetch 地址").pass, false);

assert.deepEqual(parseArgs([
  "--remote",
  "deploy",
  "--expected",
  "8npyvz5bd8-lang/offerdesk",
  "--no-fail"
]), {
  remoteName: "deploy",
  expectedRepoPath: "8npyvz5bd8-lang/offerdesk",
  noFail: true
});

console.log("verify git remote tests passed");
