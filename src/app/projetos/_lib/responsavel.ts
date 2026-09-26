/**
 * Nome exibido como responsável do projeto.
 *
 * O cadastro (Cadastros → Projetos) edita `responsavel`; `coordenador` e
 * `coordenador_nome` vêm de importações antigas e ficam só como reserva.
 */
export function responsavelDoProjeto(projeto: {
  responsavel?: string | null;
  coordenador_nome?: string | null;
  coordenador?: string | null;
}): string | null {
  for (const valor of [projeto.responsavel, projeto.coordenador_nome, projeto.coordenador]) {
    const texto = valor?.trim();
    if (texto) return texto;
  }
  return null;
}
