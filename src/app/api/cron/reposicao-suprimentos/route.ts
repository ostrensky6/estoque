import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { dispatchPendingNotificationEmails } from "@/lib/notifications/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Missing Supabase environment variables" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.rpc("gerar_reposicao_automatica");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const email = await dispatchPendingNotificationEmails(
    supabase as unknown as Parameters<typeof dispatchPendingNotificationEmails>[0],
  );

  revalidatePath("/");
  revalidatePath("/suprimentos");
  revalidatePath("/compras");
  revalidatePath("/estoque");
  revalidatePath("/estoque/controle");
  revalidatePath("/notificacoes");

  return Response.json({
    ok: true,
    job: "reposicao-suprimentos",
    executed_at: new Date().toISOString(),
    result: data ?? null,
    email,
  });
}
