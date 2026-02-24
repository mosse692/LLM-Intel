import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvFile(filePath = ".env") {
  const absPath = resolve(process.cwd(), filePath);
  if (!existsSync(absPath)) return;

  const raw = readFileSync(absPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    const value = stripQuotes(trimmed.slice(idx + 1));

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
