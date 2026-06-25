import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
  const [key, ...rest] = trimmed.split("=");
  process.env[key] ??= rest.join("=");
}

const workbookPath = process.argv[2] ?? "D:/Dropbox/ATGC/Custos/1-Laboratorio/Laboratorio1.xlsm";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

const api = async (table, { method = "GET", query = "", body, prefer } = {}) => {
  const response = await fetch(`${restUrl}/${table}${query}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table} ${method}: ${response.status} ${await response.text()}`);
  }
  if (response.status === 204) return null;
  const textBody = await response.text();
  return textBody ? JSON.parse(textBody) : null;
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(workbookPath);

const sheet = (name) => {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Aba obrigatoria nao encontrada: ${name}`);
  return ws;
};

const value = (cell) => {
  if (cell == null) return null;
  if (typeof cell === "object" && "result" in cell) return cell.result ?? null;
  if (typeof cell === "object" && "text" in cell) return cell.text ?? null;
  return cell;
};

const text = (cell) => {
  const v = value(cell);
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
};

const number = (cell) => {
  const v = value(cell);
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const date = (cell) => {
  const v = value(cell);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = text(v);
  if (!s) return null;
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const yes = (cell) => text(cell)?.toLowerCase().startsWith("s") ?? false;

const rows = (name) => {
  const ws = sheet(name);
  const data = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber > 1) data.push(row.values.slice(1));
  });
  return data;
};

const canon = new Map();
for (const row of rows("Tempo")) {
  const code = text(row[1]);
  if (code && !canon.has(code.toLowerCase())) canon.set(code.toLowerCase(), code);
}

const codeNorm = (cell) => {
  const code = text(cell);
  return code ? canon.get(code.toLowerCase()) ?? code : null;
};

const requiredCodes = [
  "Eletrof_vir_hem",
  "Eletrof_vir_tec",
  "Illumina_Sh",
  "Illumina_Sh_qPCR",
  "Illumina_16S_AC",
  "Illumina_16S_BC",
  "Illumina_DNA_P_AC",
  "Illumina_DNA_P_BC",
  "qPCR_F",
  "qPCR_SF",
  "RTqPCR_RNA_virus_H",
  "RTqPCR_RNA_virus_T",
  "Sanger",
];

const codigoSet = new Set([...canon.values()].filter((code) => requiredCodes.includes(code)));

const analises = [...codigoSet].sort().map((codigo) => ({
  codigo,
  nome: codigo,
  nome_simplificado: codigo,
  descricao: "Importado da aba Sintese do Laboratorio1.xlsm; nome amigavel pendente de revisao.",
  status: "Ativo",
  ativo: true,
  origem_dados: "Laboratorio1.xlsm/Sintese",
}));

const etapas = rows("Tempo")
  .map((row, index) => ({
    codigo_analise: codeNorm(row[1]),
    nome_etapa: text(row[2]),
    nome_atividade: text(row[3]),
    execucoes_por_dia: number(row[4]),
    amostras_por_execucao: number(row[5]),
    tempo_maquina_h: number(row[7]),
    tempo_bancada_h: number(row[8]),
    atividade_opcional: yes(row[10]),
    tipo_limitacao: text(row[11]),
    dia_inicio: text(row[12]),
    dia_fim_max: number(row[13]),
    ordem: index + 1,
  }))
  .filter((row) => row.codigo_analise && codigoSet.has(row.codigo_analise) && row.nome_etapa && row.nome_atividade);

const equipamentos = rows("Equipamentos")
  .map((row) => ({
    nome: text(row[0]),
    quantidade: number(row[1]) ?? 1,
    custo_unitario: number(row[2]) ?? 0,
    data_aquisicao: date(row[3]),
    possui: yes(row[5]),
    vida_util_anos: number(row[6]),
    percentual_manutencao_anual: number(row[7]) ?? 0,
  }))
  .filter((row) => row.nome);

const equipamentoAnaliseRaw = rows("Equipamento_Analise")
  .map((row) => ({
    equipamento: text(row[0]),
    codigo_analise: codeNorm(row[1]),
    peso_alocacao: number(row[2]) ?? 0,
  }))
  .filter((row) => row.equipamento && row.codigo_analise && codigoSet.has(row.codigo_analise));

const tecnicos = rows("Tecnicos")
  .map((row) => ({
    processo: text(row[0]),
    nome: text(row[1]),
    valor_mes: number(row[2]) ?? 0,
    horas_mes_base: number(row[3]) ?? 170,
    percentual_dedicado: number(row[5]) ?? 0,
  }))
  .filter((row) => row.nome);

const overhead = rows("Overhead")
  .map((row) => ({
    item: text(row[0]),
    custo_mensal: number(row[1]) ?? 0,
    percentual_compensada: number(row[2]) ?? 100,
    horas_bancada_mes: number(row[3]) ?? 450,
  }))
  .filter((row) => row.item);

const seenSpecs = new Set();
const insumos = rows("MC")
  .map((row) => ({
    nome_item: text(row[0]),
    especificacao: text(row[1]),
    custo_total_embalagem: number(row[8]),
    quantidade_embalagem: number(row[4]),
    unidade: text(row[6]),
    custo_unitario: number(row[2]),
    data_aquisicao: date(row[10]),
    ativo: true,
  }))
  .filter((row) => {
    if (!row.especificacao || seenSpecs.has(row.especificacao)) return false;
    seenSpecs.add(row.especificacao);
    return true;
  });

const insumoAnaliseRaw = rows("MCA")
  .map((row) => ({
    codigo_analise: codeNorm(row[1]),
    nome_etapa: text(row[2]),
    nome_atividade: text(row[3]),
    especificacao_insumo: text(row[5]),
    unidade: text(row[7]),
    grupo_escolha: text(row[8]),
    quantidade_por_amostra: number(row[9]),
    modo_cobranca: text(row[11]) === "por_execucao" ? "por_execucao" : "por_amostra",
  }))
  .filter((row) => row.codigo_analise && codigoSet.has(row.codigo_analise) && row.nome_etapa && row.nome_atividade);

const chunk = async (table, records, options = {}) => {
  for (let i = 0; i < records.length; i += 500) {
    const slice = records.slice(i, i + 500);
    const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
    await api(table, {
      method: "POST",
      query,
      body: slice,
      prefer: "resolution=merge-duplicates",
    });
  }
};

const removeByCodes = async (table) => {
  await api(table, {
    method: "DELETE",
    query: `?codigo_analise=in.(${[...codigoSet].map(encodeURIComponent).join(",")})`,
  });
};

await chunk("analises", analises, { onConflict: "codigo" });
await chunk("equipamentos", equipamentos, { onConflict: "nome" });
await chunk("insumos", insumos, { onConflict: "especificacao" });

await removeByCodes("etapas");
await removeByCodes("equipamento_analise");
await removeByCodes("insumo_analise");

if (etapas.length) {
  await api("etapas", { method: "POST", body: etapas });
}

const equipamentosDb = await api("equipamentos", { query: "?select=id,nome" });
const equipamentoId = new Map(equipamentosDb.map((row) => [row.nome, row.id]));
const equipamentoAnalise = equipamentoAnaliseRaw
  .map((row) => ({
    equipamento_id: equipamentoId.get(row.equipamento),
    codigo_analise: row.codigo_analise,
    peso_alocacao: row.peso_alocacao,
  }))
  .filter((row) => row.equipamento_id);
if (equipamentoAnalise.length) {
  await api("equipamento_analise", { method: "POST", body: equipamentoAnalise });
}

const insumosDb = await api("insumos", { query: "?select=id,especificacao,custo_unitario" });
const insumoInfo = new Map(insumosDb.map((row) => [row.especificacao, row]));
const insumoAnalise = insumoAnaliseRaw.map((row) => {
  const insumo = row.especificacao_insumo ? insumoInfo.get(row.especificacao_insumo) : null;
  const custoUnitario = insumo?.custo_unitario ?? null;
  const quantidade = row.quantidade_por_amostra ?? 0;
  return {
    ...row,
    insumo_id: insumo?.id ?? null,
    status_vinculo_insumo: insumo ? "ok" : "insumo_sem_cadastro_correspondente",
    custo_unitario_snapshot: custoUnitario,
    custo_por_amostra: row.modo_cobranca === "por_execucao" || custoUnitario == null ? null : quantidade * Number(custoUnitario),
    custo_por_execucao: row.modo_cobranca === "por_execucao" && custoUnitario != null ? quantidade * Number(custoUnitario) : null,
  };
});
if (insumoAnalise.length) {
  await api("insumo_analise", { method: "POST", body: insumoAnalise });
}

await api("tecnicos", { method: "DELETE", query: "?id=not.is.null" });
await api("overhead", { method: "DELETE", query: "?id=not.is.null" });
if (tecnicos.length) await api("tecnicos", { method: "POST", body: tecnicos });
if (overhead.length) await api("overhead", { method: "POST", body: overhead });

const missing = [...new Set(insumoAnalise.filter((row) => !row.insumo_id).map((row) => row.especificacao_insumo).filter(Boolean))].sort();

console.log(JSON.stringify({
  arquivo: workbookPath,
  analises: analises.length,
  etapas: etapas.length,
  insumos: insumos.length,
  vinculos_analise_insumo: insumoAnalise.length,
  equipamentos: equipamentos.length,
  vinculos_analise_equipamento: equipamentoAnalise.length,
  tecnicos: tecnicos.length,
  overhead: overhead.length,
  insumos_sem_correspondencia: missing,
}, null, 2));
