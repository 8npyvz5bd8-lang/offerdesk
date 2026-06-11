import { rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const releaseDir = new URL("../dist/offerdesk-release/", import.meta.url);
const zipFile = new URL("../dist/offerdesk-release.zip", import.meta.url);

export async function createZipPackage({ sourceDir, outputFile }) {
  const sourcePath = fileURLToPath(sourceDir);
  const outputPath = fileURLToPath(outputFile);

  await assertDirectory(sourceDir);
  await rm(outputFile, { force: true });

  const result = spawnSync("/usr/bin/zip", ["-qr", outputPath, "."], {
    cwd: sourcePath,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "生成压缩包失败。");
  }

  const outputStats = await stat(outputFile);
  if (outputStats.size <= 0) {
    throw new Error("压缩包为空。");
  }

  return outputPath;
}

async function assertDirectory(path) {
  const stats = await stat(path);
  if (!stats.isDirectory()) {
    throw new Error("发布目录不存在。");
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run(process.execPath, ["scripts/build-release.mjs"]);
    const outputPath = await createZipPackage({
      sourceDir: releaseDir,
      outputFile: zipFile
    });
    console.log(`upload package ready: ${outputPath}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
