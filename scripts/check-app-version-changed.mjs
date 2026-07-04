import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const appConfigPath = "src/config/app.ts";
const baseRef = process.argv[2] ?? process.env.APP_VERSION_BASE_REF ?? "origin/main";
const versionPattern = /export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)";/;

function parseVersion(source, label, { required = true } = {}) {
  const match = source.match(versionPattern);
  if (!match) {
    if (!required) {
      return null;
    }

    throw new Error(`APP_VERSION nao encontrado em ${label}.`);
  }

  const version = match.slice(1).map(Number);
  if (!version.every(Number.isInteger)) {
    throw new Error(`APP_VERSION invalido em ${label}: ${match[0]}`);
  }

  return version;
}

function formatVersion([major, minor, patch]) {
  return `${major}.${minor}.${patch}`;
}

function compareVersions(current, base) {
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== base[index]) {
      return current[index] - base[index];
    }
  }

  return 0;
}

let baseSource;
try {
  baseSource = execFileSync("git", ["show", `${baseRef}:${appConfigPath}`], {
    encoding: "utf8",
  });
} catch (error) {
  throw new Error(
    `Nao foi possivel ler ${appConfigPath} em ${baseRef}. Informe a ref base: npm run version:check -- origin/main`,
    { cause: error },
  );
}

const currentSource = readFileSync(appConfigPath, "utf8");
const currentVersion = parseVersion(currentSource, appConfigPath);
const baseVersion = parseVersion(baseSource, `${baseRef}:${appConfigPath}`, {
  required: false,
});

if (!baseVersion) {
  console.log(
    `APP_VERSION OK: ${formatVersion(currentVersion)} introduzido em ${appConfigPath}; a base ${baseRef} ainda nao possui APP_VERSION.`,
  );
  process.exit(0);
}

const comparison = compareVersions(currentVersion, baseVersion);

if (comparison <= 0) {
  throw new Error(
    `APP_VERSION precisa ser incrementado para PRs de producao. Base: ${formatVersion(
      baseVersion,
    )}; atual: ${formatVersion(currentVersion)}.`,
  );
}

console.log(
  `APP_VERSION OK: ${formatVersion(baseVersion)} -> ${formatVersion(currentVersion)}`,
);
