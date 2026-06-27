import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const workbook = process.argv[2] ?? "D:\\Dropbox\\ATGC\\Custos\\1-Laboratorio\\Laboratorio1.xlsm";
const script = resolve("scripts", "extract_xlsm.py");

if (!existsSync(workbook)) {
  console.error(`Arquivo não encontrado: ${workbook}`);
  process.exit(1);
}

let lastStatus = 1;

const candidates = process.platform === "win32" ? ["py", "python"] : ["python", "python3"];

for (const python of candidates) {
  const result = spawnSync(python, [script, workbook], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status === 0) process.exit(0);
  lastStatus = result.status ?? 1;
  if (result.error && result.error.code === "ENOENT") continue;
}

console.error("Não foi possível executar scripts/extract_xlsm.py com python ou py.");
process.exit(lastStatus);
