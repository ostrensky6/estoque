import { describe, expect, it } from "vitest";
import {
  deveManterBackupBanco,
  selecionarBackupsAppParaRemover,
} from "./retention";

describe("retencao de backups", () => {
  it("mantem somente as cinco versoes mais recentes do aplicativo", () => {
    const backups = Array.from({ length: 7 }, (_, index) => ({
      name: `backup-${index}`,
      createdAt: new Date(2026, 0, index + 1),
    }));

    expect(selecionarBackupsAppParaRemover(backups).map((b) => b.name)).toEqual([
      "backup-1",
      "backup-0",
    ]);
  });

  it("mantem todos os backups do mes corrente", () => {
    const agora = new Date(2026, 5, 25);

    expect(deveManterBackupBanco(new Date(2026, 5, 1), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 5, 20), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 5, 24), agora)).toBe(true);
  });

  it("apaga backups do mes anterior, exceto dias 1 e 15", () => {
    const agora = new Date(2026, 5, 1); // 1 de junho: mes anterior = maio

    expect(deveManterBackupBanco(new Date(2026, 4, 1), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 4, 15), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 4, 2), agora)).toBe(false);
    expect(deveManterBackupBanco(new Date(2026, 4, 20), agora)).toBe(false);
  });

  it("preserva dias 1 e 15 de meses bem antigos", () => {
    const agora = new Date(2026, 5, 14);

    expect(deveManterBackupBanco(new Date(2026, 0, 1), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 0, 15), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 0, 2), agora)).toBe(false);
  });
});
