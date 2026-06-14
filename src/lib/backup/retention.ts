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

export function deveManterBackupBanco(
  createdAt: Date,
  agora = new Date(),
) {
  const idadeMs = agora.getTime() - createdAt.getTime();
  const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;

  if (idadeMs <= trintaDiasMs) return true;

  const dia = createdAt.getDate();
  return dia === 1 || dia === 15;
}
