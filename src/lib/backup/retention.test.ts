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

  it("mantem backups de banco por 30 dias", () => {
    expect(
      deveManterBackupBanco(new Date(2026, 4, 20), new Date(2026, 5, 14)),
    ).toBe(true);
  });

  it("mantem dia 1 e dia 15 indefinidamente apos 30 dias", () => {
    const agora = new Date(2026, 5, 14);

    expect(deveManterBackupBanco(new Date(2026, 0, 1), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 0, 15), agora)).toBe(true);
    expect(deveManterBackupBanco(new Date(2026, 0, 2), agora)).toBe(false);
  });
});
