export type BackupSnapshot = {
  name: string;
  createdAt: Date;
};

export function selecionarBackupsAppParaRemover(
  backups: BackupSnapshot[],
  maxVersoes = 5,
) {
  return [...backups]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(maxVersoes);
}

// Retencao mensal: mantem tudo do mes corrente. Ao virar o mes, os backups do
// mes anterior sao descartados, preservando para sempre apenas os dias 1 e 15.
export function deveManterBackupBanco(
  createdAt: Date,
  agora = new Date(),
) {
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);

  if (createdAt.getTime() >= inicioMesAtual.getTime()) return true;

  const dia = createdAt.getDate();
  return dia === 1 || dia === 15;
}
