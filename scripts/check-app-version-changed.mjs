import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  formatVersion,
  nextVersion,
  parseVersion,
} from "./app-version.mjs";

const appConfigPath = "src/config/app.ts";
const baseRef = process.argv[2] ?? process.env.APP_VERSION_BASE_REF ?? "origin/main";

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
let baseVersion;
try {
  baseVersion = parseVersion(baseSource, `${baseRef}:${appConfigPath}`);
} catch (error) {
  throw new Error(
    `A base ${baseRef} nao possui APP_VERSION canonico; incremento exato nao pode ser comprovado.`,
    { cause: error },
  );
}

const expectedVersion = formatVersion(nextVersion(baseVersion));
const actualVersion = formatVersion(currentVersion);
if (actualVersion !== expectedVersion) {
  throw new Error(
    `APP_VERSION deve avancar exatamente uma unidade. Base: ${formatVersion(baseVersion)}; esperado: ${expectedVersion}; atual: ${actualVersion}.`,
  );
}

let changedPaths;
try {
  changedPaths = execFileSync(
    "git",
    ["diff", "--name-only", baseRef, "HEAD", "--"],
    { encoding: "utf8" },
  )
    .split(/\r?\n/)
    .filter(Boolean);
} catch (error) {
  throw new Error(`Nao foi possivel comparar os arquivos alterados com ${baseRef}.`, {
    cause: error,
  });
}

if (!changedPaths.some((path) => path !== appConfigPath)) {
  throw new Error(
    `APP_VERSION foi alterado sem nenhuma mudanca funcional alem de ${appConfigPath}.`,
  );
}

console.log(
  `APP_VERSION OK: ${formatVersion(baseVersion)} -> ${actualVersion}`,
);
