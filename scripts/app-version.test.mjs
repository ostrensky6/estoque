import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  formatVersion,
  nextVersion,
  parseVersion,
} from "./app-version.mjs";

const checkerPath = fileURLToPath(
  new URL("./check-app-version-changed.mjs", import.meta.url),
);

function appSource(version) {
  return `export const APP_VERSION = "${version}";\n`;
}

function parsed(version) {
  return parseVersion(appSource(version), version);
}

function assertExactNext(base, current) {
  assert.equal(
    formatVersion(parsed(current)),
    formatVersion(nextVersion(parsed(base))),
  );
}

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createFixture(t, currentVersion, { functionalChange = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "kontrol-app-version-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const configPath = join(root, "src", "config", "app.ts");
  const featurePath = join(root, "src", "feature.txt");
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, appSource("1.0.2"));
  writeFileSync(featurePath, "base\n");

  git(root, "init", "--quiet");
  git(root, "config", "user.email", "version-test@localhost");
  git(root, "config", "user.name", "Kontrol Version Test");
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "base");
  const baseRef = git(root, "rev-parse", "HEAD");

  writeFileSync(configPath, appSource(currentVersion));
  if (functionalChange) {
    writeFileSync(featurePath, "changed\n");
  }
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "current");

  return { root, baseRef };
}

function runChecker({ root, baseRef }) {
  return execFileSync(process.execPath, [checkerPath, baseRef], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("nextVersion aplica os carries decimais", () => {
  for (const [base, expected] of [
    ["1.0.8", "1.0.9"],
    ["1.0.9", "1.1.0"],
    ["1.9.9", "2.0.0"],
    ["9.9.9", "10.0.0"],
  ]) {
    assert.equal(formatVersion(nextVersion(parsed(base))), expected);
  }
});

test("parseVersion rejeita formatos nao canonicos", () => {
  for (const version of [
    "01.0.0",
    "1.00.0",
    "1.0.00",
    "-1.0.0",
    "1.-1.0",
    "1.0.-1",
    "1.0.0-beta",
    "1.10.0",
    "1.0.10",
    `${Number.MAX_SAFE_INTEGER + 1}.0.0`,
  ]) {
    assert.throws(() => parsed(version), version);
  }
});

test("comparacao exata rejeita salto e reducao", () => {
  assert.doesNotThrow(() => assertExactNext("1.0.8", "1.0.9"));
  assert.throws(() => assertExactNext("1.0.8", "1.1.0"));
  assert.throws(() => assertExactNext("1.0.8", "1.0.7"));
});

test("checker exige incremento exato e mudanca funcional", (t) => {
  assert.doesNotThrow(() => runChecker(createFixture(t, "1.0.3")));
  assert.throws(() => runChecker(createFixture(t, "1.0.4")));
  assert.throws(() => runChecker(createFixture(t, "1.0.1")));
  assert.throws(() =>
    runChecker(createFixture(t, "1.0.3", { functionalChange: false })),
  );
});
