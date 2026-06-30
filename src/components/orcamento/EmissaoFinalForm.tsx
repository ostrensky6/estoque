/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, Printer, Save, Info } from "lucide-react";
import { formatCurrency as brl } from "@/lib/formatters";
import { emitirPropostaCliente } from "@/lib/actions/demandas";
import { exportPropostaConfiguradaDocx } from "@/lib/orcamento/final-exporters";

type Signer = {
  id: string;
  nome: string;
  cargo: string;
  instituicao: string;
  email: string;
  telefone: string;
  bloco: string;
  assinaturaUrl?: string | null;
};

const SIGNERS: Signer[] = [
  {
    id: "antonio_ostrensky",
    nome: "Antonio Ostrensky Neto",
    cargo: "Coordenador Geral",
    instituicao: "Grupo Integrado de Aquicultura e Estudos Ambientais",
    email: "ostrensky@ufpr.br",
    telefone: "+55 (41) 3360-1234",
    bloco: "Antonio Ostrensky Neto\nCoordenador Geral — Grupo Integrado de Aquicultura e Estudos Ambientais",
  },
  {
    id: "coordenador_adjunto",
    nome: "Coordenador Adjunto GIA",
    cargo: "Coordenador Técnico",
    instituicao: "Grupo Integrado de Aquicultura e Estudos Ambientais",
    email: "gia@ufpr.br",
    telefone: "+55 (41) 3360-1234",
    bloco: "Coordenador Técnico\nGrupo Integrado de Aquicultura e Estudos Ambientais",
  },
  {
    id: "diretor_atgc",
    nome: "Diretor Executivo ATGC",
    cargo: "Diretor de Operações",
    instituicao: "ATGC Genética Ambiental Limitada",
    email: "contato@atgc.com.br",
    telefone: "+55 (41) 3360-5678",
    bloco: "Diretor Executivo\nATGC Genética Ambiental Limitada",
  },
];

type EmissaoFinalFormProps = {
  demanda: any;
  orcamentosAnalises: any[];
  orcamentosProjeto: any[];
  orcamentoFinal: any;
  versoesFinais: any[];
  analisesProposta: any[];
  rubricasProposta: any[];
  signatarios: Array<{
    id: string;
    nome: string | null;
    email: string | null;
    papel: string | null;
    assinatura_url?: string | null;
  }>;
};

export function EmissaoFinalForm({
  demanda,
  orcamentoFinal,
  versoesFinais,
  analisesProposta,
  rubricasProposta,
  signatarios,
}: EmissaoFinalFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const signers = useMemo(
    () => [
      ...signatarios
        .filter((signatario) => signatario.nome || signatario.email)
        .map((signatario) => ({
          id: signatario.id,
          nome: signatario.nome ?? signatario.email ?? "Assinante",
          cargo:
            signatario.papel === "admin"
              ? "Administrador"
              : signatario.papel === "gestor"
                ? "Gestor"
                : signatario.papel === "coordenador"
                  ? "Coordenador"
                  : "Técnico",
          instituicao: "Grupo Integrado de Aquicultura e Estudos Ambientais",
          email: signatario.email ?? "",
          telefone: "",
          bloco: `${signatario.nome ?? signatario.email ?? "Assinante"}\n${signatario.email ?? ""}`.trim(),
          assinaturaUrl: signatario.assinatura_url ?? null,
        })),
      ...SIGNERS,
    ],
    [signatarios],
  );
  const defaultSigner = signers[0] ?? SIGNERS[0];

  // 1. Tipo de Emissão
  const [tipoEmissao, setTipoEmissao] = useState<"GIA / UFPR" | "ATGC">("GIA / UFPR");

  // 2. Assinante/Emissor
  const [selectedSignerId, setSelectedSignerId] = useState<string>(defaultSigner.id);
  const [signerNome, setSignerNome] = useState(defaultSigner.nome);
  const [signerCargo, setSignerCargo] = useState(defaultSigner.cargo);
  const [signerInstituicao, setSignerInstituicao] = useState(defaultSigner.instituicao);
  const [signerEmail, setSignerEmail] = useState(defaultSigner.email);
  const [signerTelefone, setSignerTelefone] = useState(defaultSigner.telefone);
  const [signerBloco, setSignerBloco] = useState(defaultSigner.bloco);
  const [signerAssinaturaUrl, setSignerAssinaturaUrl] = useState(defaultSigner.assinaturaUrl ?? "");

  // 3. Dados da Proposta
  const nextVersao = (versoesFinais?.length ?? 0) + 1;
  const defaultCodigo = `OF-${new Date().getFullYear()}-${String(demanda.id).padStart(4, "0")}-v${nextVersao}`;

  const [dadosCodigo, setDadosCodigo] = useState(defaultCodigo);
  const [dadosDataEmissao, setDadosDataEmissao] = useState(new Date().toISOString().slice(0, 10));
  const [dadosValidade, setDadosValidade] = useState(() => {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + 30);
    return hoje.toISOString().slice(0, 10);
  });

  const [dadosCliente, setDadosCliente] = useState(demanda.cliente_nome ?? "");
  const [dadosClienteContato, setDadosClienteContato] = useState(demanda.cliente_contato ?? "");
  const [dadosDemandaTitulo, setDadosDemandaTitulo] = useState(demanda.titulo ?? "");
  const [dadosObjeto, setDadosObjeto] = useState(demanda.descricao ?? demanda.escopo_preliminar ?? "");
  const [dadosCondicoes, setDadosCondicoes] = useState(
    "Os valores apresentados nesta proposta comercial consideram as premissas técnicas listadas e a quantidade informada de amostras. Alterações de escopo podem demandar revisão de valores."
  );
  const [dadosPrazo, setDadosPrazo] = useState("30 dias úteis após recebimento das amostras");
  const [dadosFormaPagamento, setDadosFormaPagamento] = useState("Faturamento em 30 dias após entrega do relatório final");
  const [dadosObservacoes, setDadosObservacoes] = useState(demanda.observacoes ?? "");

  // 4. Opções de Visibilidade
  const [opcoes, setOpcoes] = useState<Record<string, boolean>>({
    resumo_demanda: true,
    analises_incluidas: true,
    qtd_amostras: true,
    condicoes_comerciais: true,
    prazo_validade: true,
    prazo_execucao: true,
    dados_emissor: true,
    // Custos internos desmarcados por padrão
    custos_laboratoriais: false,
    custos_projeto: false,
    subtotais_modulo: false,
    custos_rubrica: false,
    parametros_economicos: false,
    taxas: false,
    impostos: false,
    margem_lucro: false,
    fundos_investimento: false,
    fundos_equipamentos: false,
  });

  // Atualiza os campos do assinante ao selecionar
  useEffect(() => {
    if (selectedSignerId === "custom") {
      setSignerAssinaturaUrl("");
      return;
    }
    const usuario = signers.find((x) => x.id === selectedSignerId);
    if (usuario) {
      setSignerNome(usuario.nome);
      setSignerCargo(usuario.cargo);
      setSignerInstituicao(usuario.instituicao);
      setSignerEmail(usuario.email);
      setSignerTelefone(usuario.telefone);
      setSignerBloco(usuario.bloco);
      setSignerAssinaturaUrl(usuario.assinaturaUrl ?? "");
      return;
    }
  }, [selectedSignerId, signers]);

  const toggleOpcao = (key: string) => {
    setOpcoes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper para ratear proporcionalmente o valor final da proposta entre as análises laboratoriais
  const getAdjustedAnalises = () => {
    const totalFinal = orcamentoFinal.totalFinal;
    const visibleProjectTotal = opcoes.custos_projeto
      ? rubricasProposta.reduce((acc, r) => acc + ((r.preco_unitario && r.quantidade) ? (r.preco_unitario * r.quantidade) : (r.custo ?? 0)), 0)
      : 0;

    const targetLabTotal = totalFinal - visibleProjectTotal;

    const baseLabPrices = analisesProposta.map(a => {
      const amostras = a.amostras ?? a.n_amostras ?? 0;
      const precoUnitario = a.precoUnitarioMedio ?? a.preco_unitario ?? 0;
      return amostras * precoUnitario;
    });

    const totalBaseLab = baseLabPrices.reduce((acc, val) => acc + val, 0);

    return analisesProposta.map((a, idx) => {
      const amostras = a.amostras ?? a.n_amostras ?? 0;
      const basePrice = baseLabPrices[idx];
      const prop = totalBaseLab > 0 ? basePrice / totalBaseLab : 1 / analisesProposta.length;
      const subtotal = prop * targetLabTotal;
      const precoUnitario = amostras > 0 ? subtotal / amostras : 0;
      return {
        ...a,
        precoUnitarioMedio: precoUnitario,
        preco: subtotal,
      };
    });
  };

  const adjustedAnalises = getAdjustedAnalises();

  const handleSalvarEmissao = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (pendenciasEmissao.length > 0) {
      const msg = `Existem os seguintes avisos/campos pendentes no orçamento:\n\n` +
        pendenciasEmissao.map(p => `• ${p}`).join("\n") +
        `\n\nDeseja salvar e emitir a proposta comercial mesmo assim?`;
      if (!window.confirm(msg)) {
        return;
      }
    }

    const formData = new FormData(e.currentTarget);

    // Adiciona as opções marcadas
    Object.entries(opcoes).forEach(([key, value]) => {
      if (value) {
        formData.append("opcoes_conteudo", key);
      }
    });

    startTransition(async () => {
      try {
        const res = await emitirPropostaCliente({ ok: false }, formData);
        if (res.ok) {
          toast.success(res.message);
          router.push(`/orcamento/demandas/${demanda.id}?etapa=historico`);
          router.refresh();
        } else {
          toast.error(res.message || "Erro desconhecido ao salvar emissão.");
        }
      } catch (err: any) {
        toast.error(err.message || "Erro no processamento.");
      }
    });
  };

  const handleExportDocx = () => {
    toast.info("Gerando documento Word...");
    const info = {
      numero: dadosCodigo,
      versao: nextVersao,
      status: "emitido",
      emitido_em: new Date(dadosDataEmissao).toLocaleDateString("pt-BR"),
      cliente_nome: dadosCliente,
      cliente_cnpj: null,
      cliente_contato: dadosClienteContato,
      demanda_titulo: dadosDemandaTitulo,
      modalidade: demanda.modalidade,
      validade: new Date(dadosValidade).toLocaleDateString("pt-BR"),
      escopo: dadosObjeto,
      condicoes: dadosCondicoes,
      responsavel: signerNome,
    };

    const resumo = {
      total_laboratorio_custo: orcamentoFinal.totalLaboratorioCusto,
      total_laboratorio_preco: orcamentoFinal.totalLaboratorioPreco,
      total_projeto_custo: orcamentoFinal.totalProjetoCusto,
      total_projeto_final: orcamentoFinal.totalProjetoFinal,
      total_final: orcamentoFinal.totalFinal,
    };

    exportPropostaConfiguradaDocx(info, resumo, adjustedAnalises, rubricasProposta, opcoes, tipoEmissao, {
      nome: signerNome,
      cargo: signerCargo,
      instituicao: signerInstituicao,
      email: signerEmail,
      telefone: signerTelefone,
      bloco: signerBloco,
      assinaturaUrl: signerAssinaturaUrl,
      prazo: dadosPrazo,
      formaPagamento: dadosFormaPagamento,
      observacoes: dadosObservacoes,
    });
  };

  const labelSection = "block text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1.5";
  const inp = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-brand-500";
  const selectStyle = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

  const pendenciasEmissao: string[] = [];
  if (!demanda.cliente_id && !demanda.cliente_nome) {
    pendenciasEmissao.push("Definir o Cliente (etapa Demandas)");
  }
  if (!(orcamentoFinal.totalFinal > 0)) {
    pendenciasEmissao.push("Calcular o Valor Final do orçamento (adicione análises/amostras ou custos de projeto)");
  }
  if (!demanda.descricao && !demanda.escopo_preliminar) {
    pendenciasEmissao.push("Preencher a descrição ou o escopo preliminar do orçamento (etapa Demandas)");
  }
  if (!orcamentoFinal.pronto) {
    pendenciasEmissao.push("Calcular os Parâmetros econômicos (etapa Orçamento final)");
  }

  const isGia = tipoEmissao === "GIA / UFPR";
  const legalName = isGia ? "Grupo Integrado de Aquicultura e Estudos Ambientais" : "ATGC Genética Ambiental Limitada";
  const primaryColor = isGia ? "text-[#1A5292] dark:text-[#5B92D4]" : "text-[#0B8793] dark:text-[#38B2AC]";
  const borderCol = isGia ? "border-[#1A5292]" : "border-[#0B8793]";
  const borderColTable = isGia ? "border-blue-100 dark:border-blue-900/50" : "border-teal-100 dark:border-teal-900/50";
  const tableHeaderBg = isGia ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-teal-50/30 dark:bg-teal-950/10";
  const finalBoxBg = isGia ? "bg-[#1A5292]" : "bg-[#0B8793]";
  const addressText = "Universidade Federal do Paraná, Rua dos Funcionários, 1540, Juvevê, Curitiba - PR, CEP 80035-050";

  return (
    <div className="min-h-screen bg-transparent">
      {/* Grid lateral */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Painel Esquerdo: Configurações */}
        <form onSubmit={handleSalvarEmissao} className="no-print lg:col-span-5 space-y-6">
          <input type="hidden" name="demanda_id" value={demanda.id} />
          <input type="hidden" name="assinante_assinatura_url" value={signerAssinaturaUrl} />

          {/* Cabeçalho de Ações de Retorno */}
          <div className="flex items-center gap-2">
            <Link
              href={`/orcamento/demandas/${demanda.id}?etapa=final`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Orçamento Final
            </Link>
          </div>

          {/* Aviso de Itens Pendentes */}
          {pendenciasEmissao.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                Aviso: Campos pendentes identificados
              </div>
              <p className="leading-relaxed">
                Os itens abaixo ainda não foram preenchidos. Você pode emitir a proposta mesmo assim — ao clicar em &quot;Emitir e salvar&quot;, o sistema perguntará se deseja prosseguir.
              </p>
              <ul className="list-disc pl-4 space-y-1 font-medium">
                {pendenciasEmissao.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bloco 1: Identidade da Emissão */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">1. Identidade Institucional</h3>
            <div className="mt-3 flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="tipo_emissao"
                  value="GIA / UFPR"
                  checked={tipoEmissao === "GIA / UFPR"}
                  onChange={() => setTipoEmissao("GIA / UFPR")}
                  className="accent-brand-600"
                />
                GIA / UFPR (Universidade)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="tipo_emissao"
                  value="ATGC"
                  checked={tipoEmissao === "ATGC"}
                  onChange={() => setTipoEmissao("ATGC")}
                  className="accent-brand-600"
                />
                ATGC (Empresa/Parceira)
              </label>
            </div>
          </div>

          {/* Bloco 2: Assinante */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">2. Assinante Responsável</h3>

            <div>
              <label className={labelSection}>Escolher Assinante</label>
              <select
                value={selectedSignerId}
                onChange={(e) => setSelectedSignerId(e.target.value)}
                className={selectStyle}
              >
                {signers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.instituicao}) — {s.cargo}
                  </option>
                ))}
                <option value="custom">Outro (Personalizado)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelSection}>Nome do Assinante</label>
                <input
                  type="text"
                  name="assinante_nome"
                  value={signerNome}
                  onChange={(e) => setSignerNome(e.target.value)}
                  className={inp}
                  disabled={selectedSignerId !== "custom"}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Cargo/Função</label>
                <input
                  type="text"
                  name="assinante_cargo"
                  value={signerCargo}
                  onChange={(e) => setSignerCargo(e.target.value)}
                  className={inp}
                  disabled={selectedSignerId !== "custom"}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={labelSection}>Instituição / Vínculo</label>
                <input
                  type="text"
                  name="assinante_instituicao"
                  value={signerInstituicao}
                  onChange={(e) => setSignerInstituicao(e.target.value)}
                  className={inp}
                  disabled={selectedSignerId !== "custom"}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Telefone</label>
                <input
                  type="text"
                  name="assinante_telefone"
                  value={signerTelefone}
                  onChange={(e) => setSignerTelefone(e.target.value)}
                  className={inp}
                  disabled={selectedSignerId !== "custom"}
                />
              </div>
            </div>

            <div>
              <label className={labelSection}>E-mail</label>
              <input
                type="email"
                name="assinante_email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                className={inp}
                disabled={selectedSignerId !== "custom"}
              />
            </div>

            <div>
              <label className={labelSection}>Bloco de Assinatura (Texto Final)</label>
              <textarea
                name="assinante_bloco"
                value={signerBloco}
                onChange={(e) => setSignerBloco(e.target.value)}
                className={`${inp} min-h-[60px]`}
                disabled={selectedSignerId !== "custom"}
                required
              />
            </div>
            {signerAssinaturaUrl && (
              <div className="rounded-md border border-dashed border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                <img src={signerAssinaturaUrl} alt="Assinatura selecionada" className="h-14 max-w-40 object-contain" />
              </div>
            )}
          </div>

          {/* Bloco 3: Dados da Proposta */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">3. Dados da Proposta</h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelSection}>Número / Código</label>
                <input
                  type="text"
                  name="dados_codigo"
                  value={dadosCodigo}
                  onChange={(e) => setDadosCodigo(e.target.value)}
                  className={inp}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Data de Emissão</label>
                <input
                  type="date"
                  name="dados_data_emissao"
                  value={dadosDataEmissao}
                  onChange={(e) => setDadosDataEmissao(e.target.value)}
                  className={inp}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Validade</label>
                <input
                  type="date"
                  name="dados_validade"
                  value={dadosValidade}
                  onChange={(e) => setDadosValidade(e.target.value)}
                  className={inp}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelSection}>Cliente</label>
                <input
                  type="text"
                  name="dados_cliente"
                  value={dadosCliente}
                  onChange={(e) => setDadosCliente(e.target.value)}
                  className={inp}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Contato do Cliente</label>
                <input
                  type="text"
                  name="dados_cliente_contato"
                  value={dadosClienteContato}
                  onChange={(e) => setDadosClienteContato(e.target.value)}
                  className={inp}
                />
              </div>
            </div>

            <div>
              <label className={labelSection}>Título da Demanda</label>
              <input
                type="text"
                name="dados_demanda_titulo"
                value={dadosDemandaTitulo}
                onChange={(e) => setDadosDemandaTitulo(e.target.value)}
                className={inp}
                required
              />
            </div>

            <div>
              <label className={labelSection}>Objeto / Descrição da Proposta</label>
              <textarea
                name="dados_objeto"
                value={dadosObjeto}
                onChange={(e) => setDadosObjeto(e.target.value)}
                className={`${inp} min-h-[80px]`}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelSection}>Prazo de Execução</label>
                <input
                  type="text"
                  name="dados_prazo"
                  value={dadosPrazo}
                  onChange={(e) => setDadosPrazo(e.target.value)}
                  className={inp}
                  required
                />
              </div>
              <div>
                <label className={labelSection}>Forma de Pagamento</label>
                <input
                  type="text"
                  name="dados_forma_pagamento"
                  value={dadosFormaPagamento}
                  onChange={(e) => setDadosFormaPagamento(e.target.value)}
                  className={inp}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelSection}>Condições Comerciais</label>
              <textarea
                name="dados_condicoes"
                value={dadosCondicoes}
                onChange={(e) => setDadosCondicoes(e.target.value)}
                className={`${inp} min-h-[60px]`}
              />
            </div>

            <div>
              <label className={labelSection}>Observações Gerais</label>
              <textarea
                name="dados_observacoes"
                value={dadosObservacoes}
                onChange={(e) => setDadosObservacoes(e.target.value)}
                className={`${inp} min-h-[60px]`}
              />
            </div>
          </div>

          {/* Bloco 4: Opções de Visibilidade */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">4. Opções de Visibilidade no Documento</h3>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Informações Institucionais e Gerais</span>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked disabled className="accent-brand-600" />
                <span className="font-semibold text-brand-600">Valor Final Consolidado (Obrigatório)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.resumo_demanda} onChange={() => toggleOpcao("resumo_demanda")} className="accent-brand-600" />
                Resumo da demanda / escopo
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.analises_incluidas} onChange={() => toggleOpcao("analises_incluidas")} className="accent-brand-600" />
                Lista de análises laboratoriais e kits inclusos
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.qtd_amostras} onChange={() => toggleOpcao("qtd_amostras")} className="accent-brand-600" />
                Quantidades de amostras e frascos
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.condicoes_comerciais} onChange={() => toggleOpcao("condicoes_comerciais")} className="accent-brand-600" />
                Condições comerciais
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.prazo_validade} onChange={() => toggleOpcao("prazo_validade")} className="accent-brand-600" />
                Validade e prazos da proposta
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.dados_emissor} onChange={() => toggleOpcao("dados_emissor")} className="accent-brand-600" />
                Dados do emissor / assinatura
              </label>

              <div className="flex items-center justify-between text-xs border-b border-zinc-200 pt-3 pb-1.5 dark:border-zinc-800">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  Custos Internos e Detalhamento Econômico
                  <span className="group relative cursor-pointer text-amber-500">
                    <Info className="h-3.5 w-3.5" />
                    <span className="pointer-events-none absolute bottom-full left-1/2 w-48 -translate-x-1/2 rounded bg-zinc-950 p-2 text-[10px] text-white opacity-0 transition group-hover:opacity-100 z-10">
                      Desmarcados por padrão. Marque apenas se desejar abrir os custos internos ao cliente.
                    </span>
                  </span>
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.custos_laboratoriais} onChange={() => toggleOpcao("custos_laboratoriais")} className="accent-brand-600" />
                Custo de análises laboratoriais parciais
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.custos_projeto} onChange={() => toggleOpcao("custos_projeto")} className="accent-brand-600" />
                Custos diretos do projeto
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.subtotais_modulo} onChange={() => toggleOpcao("subtotais_modulo")} className="accent-brand-600" />
                Subtotais por módulo de trabalho
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.custos_rubrica} onChange={() => toggleOpcao("custos_rubrica")} className="accent-brand-600" />
                Detalhamento por rubrica operacional
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.parametros_economicos} onChange={() => toggleOpcao("parametros_economicos")} className="accent-brand-600" />
                Parâmetros econômicos aplicados (Margem, Taxas...)
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.taxas} onChange={() => toggleOpcao("taxas")} className="accent-brand-600" />
                Exibir taxas parciais aplicadas
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.impostos} onChange={() => toggleOpcao("impostos")} className="accent-brand-600" />
                Exibir alíquota e valor de impostos
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.margem_lucro} onChange={() => toggleOpcao("margem_lucro")} className="accent-brand-600" />
                Exibir margem operacional / lucro
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.fundos_investimento} onChange={() => toggleOpcao("fundos_investimento")} className="accent-brand-600" />
                Fundo de Investimento Institucional
              </label>

              <label className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 cursor-pointer">
                <input type="checkbox" checked={opcoes.fundos_equipamentos} onChange={() => toggleOpcao("fundos_equipamentos")} className="accent-brand-600" />
                Fundo para Reposição de Equipamentos
              </label>
            </div>
          </div>

          {/* Ações Esquerda */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
            >
              <Save className="h-4 w-4" />
              {isPending ? "Salvando versão..." : "Emitir e salvar versão final no histórico"}
            </button>
            <p className="text-[10px] text-zinc-400 text-center">
              Ao emitir e salvar, uma versão histórica imutável será arquivada no sistema.
            </p>
          </div>
        </form>

        {/* Painel Direito: Pré-visualização Reativa */}
        <div className="lg:col-span-7 space-y-4">
          <div className="no-print flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Pré-visualização do Documento</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportDocx}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                Gerar Word (.docx)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <Printer className="h-3.5 w-3.5 text-zinc-500" />
                Imprimir / PDF
              </button>
            </div>
          </div>

          {/* Área da Proposta do Cliente */}
          <div className="print-only bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 p-8 shadow-md border border-zinc-200 dark:border-zinc-800 rounded min-h-[842px] max-w-[800px] mx-auto text-xs font-sans space-y-6">

            {/* Header da Proposta */}
            <div className={`flex justify-between items-center border-b pb-6 ${borderCol} page-break-inside-avoid`}>
              <div className="flex items-center gap-4">
                <img
                  src={isGia ? "/logos/gia.svg" : "/logos/atgc.svg"}
                  alt={tipoEmissao}
                  className="h-20 w-auto object-contain"
                />
                <div className="border-l border-zinc-200 pl-4 py-1 dark:border-zinc-800">
                  <h2 className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Emissor</h2>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] leading-tight">{legalName}</p>
                </div>
              </div>
              <div className="text-right text-[10px] text-zinc-500 space-y-1">
                <p className={`font-extrabold text-sm uppercase tracking-wider ${primaryColor}`}>PROPOSTA COMERCIAL</p>
                <p className="font-mono text-zinc-700 dark:text-zinc-300">Nº: <span className="font-bold">{dadosCodigo}</span></p>
                <div className="flex flex-col gap-0.5 text-zinc-400">
                  <p>Emissão: <span className="text-zinc-600 dark:text-zinc-350">{new Date(dadosDataEmissao).toLocaleDateString("pt-BR")}</span></p>
                  <p>Validade: <span className="text-zinc-600 dark:text-zinc-350">{new Date(dadosValidade).toLocaleDateString("pt-BR")}</span></p>
                </div>
              </div>
            </div>

            {/* Bloco de identificação */}
            <div className="bg-zinc-50/50 dark:bg-zinc-950/20 p-4 rounded-lg border border-zinc-100 dark:border-zinc-850/50 grid grid-cols-2 md:grid-cols-3 gap-4 text-[10px] leading-relaxed page-break-inside-avoid">
              <div>
                <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Destinatário / Cliente</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs block mt-0.5">{dadosCliente}</span>
                {dadosClienteContato && <span className="text-zinc-500 block mt-0.5">Contato: {dadosClienteContato}</span>}
              </div>
              <div>
                <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Título do Orçamento</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs block mt-0.5">{dadosDemandaTitulo}</span>
              </div>
              <div>
                <span className="font-bold text-zinc-400 uppercase tracking-wider text-[8px] block">Modalidade & Enquadramento</span>
                <span className="font-medium text-zinc-600 dark:text-zinc-400 text-xs block mt-0.5">{demanda.modalidade}</span>
              </div>
            </div>

            {/* Seção: Objeto e Escopo */}
            {opcoes.resumo_demanda && (
              <div className="space-y-2 page-break-inside-avoid">
                <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                  1. Objeto e Escopo
                </h3>
                <p className="text-zinc-600 dark:text-zinc-350 leading-relaxed text-[10px] whitespace-pre-wrap">
                  {dadosObjeto}
                </p>
              </div>
            )}

            {/* Seção: Análises laboratoriais */}
            {opcoes.analises_incluidas && adjustedAnalises.length > 0 && (
              <div className="space-y-2 page-break-inside-avoid">
                <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                  2. Análises e Componentes Laboratoriais
                </h3>
                <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-850">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className={`border-b font-bold text-zinc-500 ${tableHeaderBg} ${borderColTable}`}>
                        <th className="py-2 px-3 font-mono">Código</th>
                        <th className="py-2 px-3">Análise / Descrição</th>
                        {opcoes.qtd_amostras && <th className="py-2 px-3 text-center">Amostras</th>}
                        {opcoes.custos_laboratoriais && <th className="py-2 px-3 text-right">Valor Unitário</th>}
                        {opcoes.custos_laboratoriais && <th className="py-2 px-3 text-right">Subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/50">
                      {adjustedAnalises.map((a, idx) => {
                        const codigo = a.codigo ?? a.codigo_analise;
                        const nome = a.nome ?? a.analises?.nome ?? "Análise Técnica";
                        const amostras = a.amostras ?? a.n_amostras ?? 0;
                        const precoUnitario = a.precoUnitarioMedio ?? a.preco_unitario ?? 0;
                        const precoSubtotal = a.preco ?? (amostras * precoUnitario);

                        return (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                            <td className="py-2 px-3 font-mono font-medium">{codigo}</td>
                            <td className="py-2 px-3">{nome}</td>
                            {opcoes.qtd_amostras && <td className="py-2 px-3 text-center font-semibold tabular-nums">{amostras}</td>}
                            {opcoes.custos_laboratoriais && <td className="py-2 px-3 text-right tabular-nums">{brl(precoUnitario)}</td>}
                            {opcoes.custos_laboratoriais && <td className="py-2 px-3 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(precoSubtotal)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Seção: Custos de Projeto */}
            {opcoes.custos_projeto && rubricasProposta.length > 0 && (
              <div className="space-y-2 page-break-inside-avoid">
                <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                  3. Custos Diretos de Projeto
                </h3>
                <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-850">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className={`border-b font-bold text-zinc-500 ${tableHeaderBg} ${borderColTable}`}>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 text-center">Rubrica</th>
                        {opcoes.qtd_amostras && <th className="py-2 px-3 text-center">Qtd.</th>}
                        {opcoes.custos_projeto && <th className="py-2 px-3 text-right">Unitário</th>}
                        {opcoes.custos_projeto && <th className="py-2 px-3 text-right">Subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850/50">
                      {rubricasProposta.map((r, idx) => {
                        const descricao = r.descricao ?? r.nome ?? "Item Operacional";
                        const rubrica = r.rubrica ?? r.codigo ?? "OU";
                        const quantidade = r.quantidade ?? r.itens ?? 0;
                        const unitario = r.preco_unitario ?? (r.custo ? r.custo / (quantidade || 1) : 0);
                        const subtotal = (r.preco_unitario && r.quantidade) ? (r.preco_unitario * r.quantidade) : (r.custo ?? 0);

                        return (
                          <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 text-zinc-600 dark:text-zinc-300">
                            <td className="py-2 px-3">{descricao}</td>
                            <td className="py-2 px-3 text-center font-semibold text-[9px] tabular-nums text-zinc-500">{rubrica}</td>
                            {opcoes.qtd_amostras && <td className="py-2 px-3 text-center font-semibold tabular-nums">{quantidade}</td>}
                            {opcoes.custos_projeto && <td className="py-2 px-3 text-right tabular-nums">{brl(unitario)}</td>}
                            {opcoes.custos_projeto && <td className="py-2 px-3 text-right font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{brl(subtotal)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}



            {/* Subtotais e Destaque Financeiro */}
            <div className="space-y-3 page-break-inside-avoid">
              <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                Valor e Condições Financeiras
              </h3>

              {(opcoes.subtotais_modulo || opcoes.taxas || opcoes.impostos) && (
                <div className="space-y-1 text-right text-[10px] text-zinc-600 dark:text-zinc-350 pr-2">
                  {opcoes.subtotais_modulo && (
                    <>
                      <p>Subtotal Análises Laboratoriais: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalLaboratorioPreco)}</span></p>
                      <p>Subtotal Custos de Projeto: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalProjetoFinal)}</span></p>
                    </>
                  )}
                  {opcoes.impostos && orcamentoFinal.parametrosAplicados && (
                    <p>Impostos e Encargos Fiscais: <span className="font-bold text-zinc-800 dark:text-zinc-100">{brl(orcamentoFinal.totalFinal - (orcamentoFinal.totalLaboratorioPreco + orcamentoFinal.totalProjetoFinal))}</span></p>
                  )}
                </div>
              )}

              {/* VALOR FINAL DA PROPOSTA (Sempre exibido e destacado) */}
              <div className={`text-white p-4 rounded-lg flex justify-between items-center shadow-sm ${finalBoxBg}`}>
                <span className="font-bold text-xs uppercase tracking-wider">Valor Total da Proposta</span>
                <span className="text-lg font-bold tabular-nums">{brl(orcamentoFinal.totalFinal)}</span>
              </div>
            </div>

            {/* Detalhes Comerciais e Prazos */}
            <div className="space-y-4 page-break-inside-avoid">
              <h3 className={`text-xs font-bold border-b pb-1 ${primaryColor} ${borderCol} uppercase tracking-wider`}>
                Condições de Execução e Pagamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-zinc-600 dark:text-zinc-350 bg-zinc-50/50 dark:bg-zinc-950/20 p-3 rounded-lg border border-zinc-100 dark:border-zinc-850/50">
                {opcoes.prazo_execucao && (
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Prazo de Execução:</p>
                    <p className="mt-0.5">{dadosPrazo}</p>
                  </div>
                )}
                {opcoes.prazo_validade && (
                  <div>
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">Forma de Pagamento:</p>
                    <p className="mt-0.5">{dadosFormaPagamento}</p>
                  </div>
                )}
              </div>

              {opcoes.condicoes_comerciais && (
                <div className="text-[10px] text-zinc-500 leading-normal">
                  <p className="font-bold text-zinc-700 dark:text-zinc-300">Condições Comerciais:</p>
                  <p className="italic bg-zinc-50/30 p-2.5 rounded border border-dashed border-zinc-200 mt-1 dark:border-zinc-800 dark:bg-zinc-900/10">{dadosCondicoes}</p>
                </div>
              )}

              {dadosObservacoes && (
                <div className="text-[10px] text-zinc-500 leading-normal">
                  <p className="font-bold text-zinc-700 dark:text-zinc-300">Observações Gerais:</p>
                  <p className="whitespace-pre-wrap bg-zinc-50/30 p-2.5 rounded border border-dashed border-zinc-200 mt-1 dark:border-zinc-800 dark:bg-zinc-900/10">{dadosObservacoes}</p>
                </div>
              )}
            </div>

            {/* Assinatura */}
            {opcoes.dados_emissor && (
              <div className="pt-8 flex flex-col items-center text-center text-[10px] text-zinc-600 dark:text-zinc-400 page-break-inside-avoid">
                {signerAssinaturaUrl && (
                  <img src={signerAssinaturaUrl} alt="" className="relative z-10 mb-[-0.55rem] h-14 max-w-44 translate-y-3 object-contain" />
                )}
                <div className="w-48 border-t border-zinc-300 pb-2 dark:border-zinc-700"></div>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">{signerNome}</p>
                <p className="text-zinc-500">{signerCargo} — {signerInstituicao}</p>
                <p className="text-[9px] text-zinc-400 mt-0.5">{signerEmail} | {signerTelefone}</p>
              </div>
            )}

            {/* Rodapé / Endereço */}
            <div className={`pt-4 mt-6 border-t ${borderColTable} text-center text-[9px] text-zinc-400 leading-relaxed page-break-inside-avoid`}>
              <p className="font-semibold text-zinc-500">
                {legalName}
              </p>
              <p>{addressText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
