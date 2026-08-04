export type InsumoRow = Record<string, unknown>;

export type LoteInsumo = {
  insumo_id: number | string | null;
  status: string | null;
  quantidade_atual: number | string | null;
  validade: string | null;
  validade_apos_abertura: string | null;
  data_abertura: string | null;
};

function dataValida(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [ano, mes, dia] = value.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? value : null;
}

function hojeEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function menorValidade(lote: LoteInsumo) {
  const datas = [dataValida(lote.validade), dataValida(lote.validade_apos_abertura)].filter(Boolean) as string[];
  return datas.sort()[0] ?? null;
}

function elegivel(lote: LoteInsumo, hoje: string) {
  const validade = menorValidade(lote);
  return (lote.status === "aceito" || lote.status === "em_uso")
    && Number(lote.quantidade_atual) > 0
    && (validade == null || validade >= hoje);
}

export function projetarTotaisInsumos(insumos: InsumoRow[], lotes: LoteInsumo[], hoje = hojeEmSaoPaulo()): InsumoRow[] {
  const totais = new Map<string, { fechadas: number; abertas: number }>();
  for (const lote of lotes) {
    if (!elegivel(lote, hoje) || lote.insumo_id == null) continue;
    const total = totais.get(String(lote.insumo_id)) ?? { fechadas: 0, abertas: 0 };
    if (lote.data_abertura == null) total.fechadas += Number(lote.quantidade_atual);
    else total.abertas += Number(lote.quantidade_atual);
    totais.set(String(lote.insumo_id), total);
  }
  return insumos.map((insumo) => {
    const total = totais.get(String(insumo.id)) ?? { fechadas: 0, abertas: 0 };
    return { ...insumo, unidades_fechadas: total.fechadas, unidades_abertas: total.abertas };
  });
}
