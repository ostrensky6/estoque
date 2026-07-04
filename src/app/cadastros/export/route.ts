import { buildCadastrosWorkbook, safeFileName } from "@/lib/cadastros/xlsx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const workbook = await buildCadastrosWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${safeFileName("todos-os-cadastros")}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao exportar cadastros.";
    return new Response(message, { status: 500 });
  }
}
