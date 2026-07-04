import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_XLSM = "D:\\Dropbox\\ATGC\\Custos\\1-Laboratorio\\Laboratorio1.xlsm";
const TABLES = [
  "parametros",
  "analises",
  "etapas",
  "equipamentos",
  "equipamento_analise",
  "tecnicos",
  "overhead",
  "insumos",
  "insumo_analise",
];

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const raw of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[key] ||= value;
    }
  }
}

function runPythonExtract(xlsmPath) {
  const script = path.join(ROOT, "scripts", "import_laboratorio1.py");
  const candidates = [
    process.env.PYTHON,
    "py",
    "python",
    "python3",
    "C:\\Users\\AntonioOstrenskyNeto\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
  ].filter(Boolean);

  const errors = [];
  for (const exe of candidates) {
    const args = exe === "py" ? ["-3", script, "--extract-json", xlsmPath] : [script, "--extract-json", xlsmPath];
    const result = spawnSync(exe, args, {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 50 * 1024 * 1024,
    });
    if (result.status === 0 && result.stdout.trim()) return JSON.parse(result.stdout);
    errors.push(`${exe}: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  throw new Error(`Nao foi possivel extrair a planilha com Python/openpyxl.\n${errors.join("\n")}`);
}

function clean(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

class SupabaseRest {
  constructor(url, key) {
    this.base = `${url.replace(/\/$/, "")}/rest/v1`;
    this.headers = {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json",
    };
  }

  async request(method, target, body, prefer) {
    const headers = { ...this.headers };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${this.base}/${target}`, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${target} falhou: HTTP ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async get(table, query = "select=*") {
    const data = await this.request("GET", `${table}?${query}`);
    return Array.isArray(data) ? data : [];
  }

  async insert(table, row) {
    const data = await this.request("POST", table, clean(row), "return=representation");
    return Array.isArray(data) && data.length ? data[0] : {};
  }

  async updateById(table, id, row) {
    const query = new URLSearchParams({ id: `eq.${id}` });
    await this.request("PATCH", `${table}?${query}`, clean(row), "return=minimal");
  }

  async upsert(table, rows, conflict) {
    if (!rows.length) return;
    const query = new URLSearchParams({ on_conflict: conflict });
    await this.request(
      "POST",
      `${table}?${query}`,
      rows.map(clean),
      "resolution=merge-duplicates,return=minimal",
    );
  }
}

function keyOf(row, fields) {
  return JSON.stringify(fields.map((field) => row[field] ?? null));
}

async function snapshot(db, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const data = { createdAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) data.tables[table] = await db.get(table);
  fs.writeFileSync(path.join(outputDir, "pre-import-snapshot.json"), JSON.stringify(data, null, 2));
  return Object.fromEntries(TABLES.map((table) => [table, data.tables[table].length]));
}

async function syncByKey(db, table, source, fields) {
  const existing = await db.get(table);
  const byKey = new Map(existing.map((row) => [keyOf(row, fields), row]));
  let inserted = 0;
  let updated = 0;
  for (const row of source) {
    const key = keyOf(row, fields);
    const current = byKey.get(key);
    if (current?.id) {
      await db.updateById(table, current.id, row);
      updated += 1;
    } else {
      const created = await db.insert(table, row);
      byKey.set(key, created);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

async function syncInsumoAnalise(db, source, insumoIds, etapaIds) {
  const fields = [
    "codigo_analise",
    "nome_etapa",
    "nome_atividade",
    "especificacao_insumo",
    "unidade",
    "grupo_escolha",
    "quantidade_por_amostra",
    "modo_cobranca",
  ];
  const existing = await db.get("insumo_analise");
  const buckets = new Map();
  for (const row of existing) {
    const key = keyOf(row, fields);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  const used = new Map();
  let inserted = 0;
  let updated = 0;
  let unresolvedInsumo = 0;
  let unresolvedEtapa = 0;

  for (const original of source) {
    const { _insumo_lookup: lookup, ...row } = original;
    row.insumo_id = lookup ? (insumoIds.get(lookup) ?? null) : null;
    row.etapa_id = etapaIds.get(keyOf(row, ["codigo_analise", "nome_etapa", "nome_atividade"])) ?? null;
    if (row.especificacao_insumo && !row.insumo_id) unresolvedInsumo += 1;
    if (!row.etapa_id) unresolvedEtapa += 1;

    const key = keyOf(row, fields);
    const rows = buckets.get(key) ?? [];
    const index = used.get(key) ?? 0;
    if (index < rows.length) {
      await db.updateById("insumo_analise", rows[index].id, row);
      used.set(key, index + 1);
      updated += 1;
    } else {
      const created = await db.insert("insumo_analise", row);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(created);
      used.set(key, index + 1);
      inserted += 1;
    }
  }

  return { inserted, updated, unresolved_insumo: unresolvedInsumo, unresolved_etapa: unresolvedEtapa };
}

async function main() {
  loadEnv();
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const xlsmPath = process.argv[2] || DEFAULT_XLSM;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL e chave Supabase precisam existir no .env.local.");

  const data = runPythonExtract(xlsmPath);
  const db = new SupabaseRest(url, key);
  const outputDir = path.join(ROOT, "output", "laboratorio-import");
  const before = await snapshot(db, outputDir);
  const summary = {
    before,
    source: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length])),
    operations: {},
  };

  await db.upsert("parametros", data.parametros, "chave");

  const existingAnalises = new Set((await db.get("analises")).map((row) => row.codigo));
  const analisesToInsert = data.analises.filter((row) => !existingAnalises.has(row.codigo));
  await db.upsert("analises", analisesToInsert, "codigo");
  summary.operations.analises = {
    inserted: analisesToInsert.length,
    preserved_existing: data.analises.length - analisesToInsert.length,
  };

  await db.upsert("equipamentos", data.equipamentos, "nome");
  await db.upsert("insumos", data.insumos, "especificacao");

  summary.operations.etapas = await syncByKey(db, "etapas", data.etapas, ["codigo_analise", "ordem"]);
  summary.operations.tecnicos = await syncByKey(db, "tecnicos", data.tecnicos, ["nome", "processo"]);
  summary.operations.overhead = await syncByKey(db, "overhead", data.overhead, ["item"]);

  const equipamentos = await db.get("equipamentos", "select=id,nome");
  const equipamentoIds = new Map(equipamentos.map((row) => [row.nome, row.id]));
  const equipAlloc = data.equipamento_analise
    .filter((row) => equipamentoIds.has(row.equipamento_nome))
    .map((row) => ({
      equipamento_id: equipamentoIds.get(row.equipamento_nome),
      codigo_analise: row.codigo_analise,
      peso_alocacao: row.peso_alocacao,
    }));
  await db.upsert("equipamento_analise", equipAlloc, "equipamento_id,codigo_analise");

  const insumos = await db.get("insumos", "select=id,especificacao");
  const insumoIds = new Map(insumos.map((row) => [row.especificacao, row.id]));
  const etapas = await db.get("etapas", "select=id,codigo_analise,nome_etapa,nome_atividade");
  const etapaCount = new Map();
  for (const row of etapas) {
    const key = keyOf(row, ["codigo_analise", "nome_etapa", "nome_atividade"]);
    etapaCount.set(key, (etapaCount.get(key) ?? 0) + 1);
  }
  const etapaIds = new Map(
    etapas
      .filter((row) => etapaCount.get(keyOf(row, ["codigo_analise", "nome_etapa", "nome_atividade"])) === 1)
      .map((row) => [keyOf(row, ["codigo_analise", "nome_etapa", "nome_atividade"]), row.id]),
  );
  summary.operations.insumo_analise = await syncInsumoAnalise(db, data.insumo_analise, insumoIds, etapaIds);

  summary.after = Object.fromEntries(await Promise.all(TABLES.map(async (table) => [table, (await db.get(table)).length])));
  const pendencias = await db.get(
    "v_insumo_analise_pendencias",
    "select=id,codigo_analise,nome_etapa,nome_atividade,especificacao_insumo,status_vinculo",
  );
  summary.pendencias = {
    total: pendencias.length,
    por_status: pendencias.reduce((acc, row) => {
      acc[row.status_vinculo] = (acc[row.status_vinculo] ?? 0) + 1;
      return acc;
    }, {}),
    amostra: pendencias.slice(0, 20),
  };

  fs.writeFileSync(path.join(outputDir, "import-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
