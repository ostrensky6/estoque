import { formatCurrency as brl } from "@/lib/formatters";
import {
  ValorEntrada,
  ValorCalculado,
} from "@/components/common/ValorFinanceiro";

/**
 * Etapa "Parâmetros Econômicos" dentro do fluxo do orçamento (plano §6.5).
 *
 * Layout denso de 3 blocos (§8.1): base de custos → parâmetros aplicados →
 * resultado final, na mesma tela. Convenção visual §8.2:
 *   - percentuais (escolhidos pelo usuário) em AZUL (ValorEntrada);
 *   - subtotais, valores em R$ e total (calculados) em NEUTRO (ValorCalculado).
 *
 * Componente de apresentação puro — recebe os números já consolidados pela
 * engine (consolidarEconomiaOrcamento / consolidarOrcamentoFinal) no servidor.
 */

export type ParametroAplicadoView = {
  key: string;
  label: string;
  nominalRate: number;
  amount: number;
  effectiveRate?: number;
};

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Linha({
  rotulo,
  children,
  forte,
}: {
  rotulo: string;
  children: React.ReactNode;
  forte?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${forte ? "border-t border-zinc-200 pt-2 dark:border-zinc-700" : ""}`}>
      <span className={`text-xs ${forte ? "font-medium text-zinc-700 dark:text-zinc-200" : "text-muted-foreground"}`}>
        {rotulo}
      </span>
      <span className="tabular-nums text-sm">{children}</span>
    </div>
  );
}

export function PainelParametrosEconomicos({
  exigeProjeto,
  metodo = "GROSS_UP",
  custoLaboratorio,
  precoLaboratorio,
  custoProjeto,
  projetoFinal,
  totalFinal,
  parametros,
  markupNominal,
  fatorGrossUp,
  alertas = [],
}: {
  exigeProjeto: boolean;
  metodo?: string;
  custoLaboratorio: number;
  precoLaboratorio: number;
  custoProjeto: number;
  projetoFinal: number;
  totalFinal: number;
  parametros: ParametroAplicadoView[];
  markupNominal?: number;
  fatorGrossUp?: number;
  alertas?: string[];
}) {
  const subtotalCustos = custoLaboratorio + custoProjeto;
  const totalParametros = parametros.reduce((acc, p) => acc + p.amount, 0);
  const markup = markupNominal ?? parametros.reduce((acc, p) => acc + p.nominalRate, 0);
  const fator = fatorGrossUp ?? (markup >= 100 ? 0 : 1 / (1 - markup / 100));

  return (
    <div className="mt-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Bloco 1 — base de custos recebidos (tudo calculado → neutro) */}
        <Bloco titulo="Base de cálculo">
          <Linha rotulo="Custo laboratório">
            <ValorCalculado>{brl(custoLaboratorio)}</ValorCalculado>
          </Linha>
          <Linha rotulo="Preço laboratório histórico">
            <ValorCalculado estado="snapshot">{brl(precoLaboratorio)}</ValorCalculado>
          </Linha>
          <Linha rotulo="Custo projeto">
            <ValorCalculado>{brl(custoProjeto)}</ValorCalculado>
          </Linha>
          <Linha rotulo="Subtotal de custos" forte>
            <ValorCalculado estado="bloqueado">{brl(subtotalCustos)}</ValorCalculado>
          </Linha>
        </Bloco>

        {/* Bloco 2 — parâmetros aplicados (percentual = entrada/azul, R$ = calculado) */}
        <Bloco titulo={`Parâmetros aplicados · ${metodo === "GROSS_UP" ? "gross-up" : "markup"}`}>
          {!exigeProjeto ? (
            <p className="text-xs text-muted-foreground">
              Parâmetros econômicos de projeto não se aplicam a esta modalidade.
            </p>
          ) : parametros.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum parâmetro aplicado.</p>
          ) : (
            parametros.map((p) => (
              <Linha key={p.key} rotulo={p.label}>
                <ValorEntrada>{pct(p.nominalRate)}</ValorEntrada>{" "}
                <span className="text-zinc-400">·</span>{" "}
                <ValorCalculado>{brl(p.amount)}</ValorCalculado>
              </Linha>
            ))
          )}
          {exigeProjeto && parametros.length > 0 && (
            <>
              {parametros.map((p) => (
                <Linha key={`${p.key}-efetivo`} rotulo={`${p.label} efetivo`}>
                  <ValorCalculado>{pct(p.effectiveRate ?? 0)}</ValorCalculado>
                </Linha>
              ))}
              <Linha rotulo="Markup nominal">
                <ValorEntrada>{pct(markup)}</ValorEntrada>
              </Linha>
              <Linha rotulo="Fator gross-up">
                <ValorCalculado>{fator.toFixed(4).replace(".", ",")}x</ValorCalculado>
              </Linha>
              <Linha rotulo="Total de parâmetros" forte>
                <ValorCalculado estado="bloqueado">{brl(totalParametros)}</ValorCalculado>
              </Linha>
            </>
          )}
        </Bloco>

        {/* Bloco 3 — resultado final (calculado → neutro, total em destaque) */}
        <Bloco titulo="Resultado final">
          <Linha rotulo="Projeto após parâmetros">
            <ValorCalculado>{brl(projetoFinal)}</ValorCalculado>
          </Linha>
          <Linha rotulo="Custo direto técnico">
            <ValorCalculado estado="snapshot">{brl(subtotalCustos)}</ValorCalculado>
          </Linha>
          <Linha rotulo="Total final" forte>
            <ValorCalculado estado="bloqueado" className="text-base">
              {brl(totalFinal)}
            </ValorCalculado>
          </Linha>
        </Bloco>
      </div>

      {alertas.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {alertas.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-400">
        Total = custo técnico do laboratório + custos próprios do projeto, com
        gross-up único aplicado no servidor. O preço laboratorial histórico é
        exibido apenas para compatibilidade.
      </p>
    </div>
  );
}
