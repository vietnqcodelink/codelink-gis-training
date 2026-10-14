import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const commit = process.env.APP_COMMIT_SHA
  || process.env.GITHUB_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || gitCommit();
const builtAt = process.env.BUILD_TIME || new Date().toISOString();
const publicDir = join(projectDir, "public");

await mkdir(publicDir, { recursive: true });
await writeFile(join(publicDir, "build-info.json"), `${JSON.stringify({ commit, builtAt }, null, 2)}\n`);
