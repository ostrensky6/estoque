import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  APP_VERSION_PATTERN,
  formatVersion,
  nextVersion,
  parseVersion,
} from "./app-version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appConfigPath = join(__dirname, "..", "src", "config", "app.ts");
const source = readFileSync(appConfigPath, "utf8");

const next = formatVersion(
  nextVersion(parseVersion(source, appConfigPath)),
);
writeFileSync(
  appConfigPath,
  source.replace(
    APP_VERSION_PATTERN,
    `export const APP_VERSION = "${next}";`,
  ),
);
console.log(next);
