import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appConfigPath = join(__dirname, "..", "src", "config", "app.ts");
const source = readFileSync(appConfigPath, "utf8");

const versionPattern = /export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)";/;
const match = source.match(versionPattern);

if (!match) {
  throw new Error("APP_VERSION nao encontrado em src/config/app.ts.");
}

const [, majorText, minorText, patchText] = match;
let major = Number(majorText);
let minor = Number(minorText);
let patch = Number(patchText);

if (![major, minor, patch].every(Number.isInteger)) {
  throw new Error(`APP_VERSION invalido: ${match[0]}`);
}

patch += 1;
if (patch > 9) {
  patch = 0;
  minor += 1;
}
if (minor > 9) {
  minor = 0;
  major += 1;
}

const nextVersion = `${major}.${minor}.${patch}`;
writeFileSync(appConfigPath, source.replace(versionPattern, `export const APP_VERSION = "${nextVersion}";`));
console.log(nextVersion);
