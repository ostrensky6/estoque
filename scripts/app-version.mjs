export const APP_VERSION_PATTERN =
  /export const APP_VERSION = "(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)";/;

function assertVersion(version, label) {
  if (
    !Array.isArray(version) ||
    version.length !== 3 ||
    !version.every((part) => Number.isSafeInteger(part) && part >= 0) ||
    version[1] > 9 ||
    version[2] > 9
  ) {
    throw new Error(`${label} invalido.`);
  }

  return version;
}

export function parseVersion(source, label) {
  const match = source.match(APP_VERSION_PATTERN);
  if (!match) {
    throw new Error(`APP_VERSION ausente ou invalido em ${label}.`);
  }

  return assertVersion(match.slice(1).map(Number), `APP_VERSION em ${label}`);
}

export function formatVersion(version) {
  return assertVersion(version, "APP_VERSION").join(".");
}

export function nextVersion(version) {
  let [major, minor, patch] = assertVersion(version, "APP_VERSION");

  patch += 1;
  if (patch > 9) {
    patch = 0;
    minor += 1;
  }
  if (minor > 9) {
    minor = 0;
    major += 1;
  }

  return assertVersion([major, minor, patch], "Proxima APP_VERSION");
}
