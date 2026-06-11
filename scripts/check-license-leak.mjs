import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultTargets = [
  new URL("../dist/offerdesk-release/", import.meta.url),
  new URL("../dist/offerdesk-release.zip", import.meta.url)
];

export async function scanTargetsForLicenseCode(targets, licenseCode) {
  const cleanLicenseCode = String(licenseCode || "").trim();
  if (cleanLicenseCode.length < 8) {
    throw new Error("授权码至少 8 位。");
  }

  const leaks = [];
  for (const target of targets) {
    leaks.push(...await scanTargetForLicenseCode(target, cleanLicenseCode));
  }
  return leaks;
}

export async function scanTargetForLicenseCode(target, licenseCode) {
  const targetPath = typeof target === "string" ? target : fileURLToPath(target);
  const targetStats = await stat(targetPath);

  if (targetStats.isDirectory()) {
    return scanDirectory(targetPath, licenseCode);
  }
  if (targetPath.endsWith(".zip")) {
    return scanZip(targetPath, licenseCode);
  }

  return scanFile(targetPath, licenseCode);
}

async function scanDirectory(directory, licenseCode) {
  const leaks = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      leaks.push(...await scanDirectory(fullPath, licenseCode));
    } else if (entry.isFile()) {
      leaks.push(...await scanFile(fullPath, licenseCode));
    }
  }

  return leaks;
}

async function scanFile(filePath, licenseCode) {
  const content = await readFile(filePath);
  return content.includes(Buffer.from(licenseCode)) ? [filePath] : [];
}

function scanZip(zipPath, licenseCode) {
  const listing = spawnSync("/usr/bin/unzip", ["-Z1", zipPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (listing.status !== 0) {
    throw new Error(listing.stderr || "读取压缩包失败。");
  }

  const leaks = [];
  const entries = listing.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (entry.endsWith("/")) {
      continue;
    }
    const content = spawnSync("/usr/bin/unzip", ["-p", zipPath, entry], {
      encoding: "buffer",
      maxBuffer: 50 * 1024 * 1024
    });

    if (content.status !== 0) {
      throw new Error(content.stderr?.toString("utf8") || `读取压缩包文件失败：${entry}`);
    }
    if (content.stdout.includes(Buffer.from(licenseCode))) {
      leaks.push(`${zipPath}:${entry}`);
    }
  }

  return leaks;
}

export function parseArgs(args) {
  const values = { targets: [] };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];

    if (!key.startsWith("--")) {
      throw new Error(`无法识别参数：${key}`);
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`缺少参数值：${key}`);
    }

    if (key === "--target") {
      values.targets.push(value);
    } else {
      values[key.slice(2)] = value;
    }
    index += 1;
  }

  return {
    licenseCode: values["license-code"],
    targets: values.targets.length > 0 ? values.targets : defaultTargets
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const leaks = await scanTargetsForLicenseCode(options.targets, options.licenseCode);

    if (leaks.length > 0) {
      console.log("授权码泄漏检查失败");
      console.log(`发现：${leaks.length}`);
      for (const leak of leaks) {
        console.log(`FAIL ${leak}`);
      }
      process.exit(1);
    }

    console.log("授权码泄漏检查通过");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
