type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      is: (column: string, value: null) => {
        neq: (column: string, value: string) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => {
            limit: (count: number) => PromiseLike<{ data: NotificationEmailRow[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: number) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

type NotificationEmailRow = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string | null;
  entidade_tipo: string | null;
  entidade_id: number | null;
  criado_em: string;
  email_tentativas: number | null;
};

type EmailDispatchResult = {
  enabled: boolean;
  sent: number;
  failed: number;
  skippedReason?: string;
};

function recipientsFromEnv() {
  return (process.env.NOTIFICATION_EMAIL_TO ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function notificationUrl(row: NotificationEmailRow) {
  const base = appBaseUrl();
  if (row.entidade_tipo === "pedido_compra" && row.entidade_id) return `${base}/compras/${row.entidade_id}`;
  if (row.entidade_tipo === "planejamento" && row.entidade_id) return `${base}/planejamento/${row.entidade_id}`;
  if (row.entidade_tipo === "insumo") return `${base}/cadastros/insumos`;
  return `${base}/notificacoes`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function emailHtml(row: NotificationEmailRow) {
  const url = notificationUrl(row);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#18181b">
      <p style="font-size:12px;text-transform:uppercase;color:#71717a;margin:0 0 8px">Kontrol · ${escapeHtml(row.tipo.replace("_", " "))}</p>
      <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(row.titulo)}</h1>
      ${row.corpo ? `<p style="font-size:14px;margin:0 0 16px">${escapeHtml(row.corpo)}</p>` : ""}
      <p style="font-size:14px;margin:0 0 16px">
        <a href="${url}" style="color:#047857;font-weight:700">Abrir no Kontrol</a>
      </p>
      <p style="font-size:12px;color:#71717a;margin:0">Gerada em ${escapeHtml(row.criado_em)}.</p>
    </div>
  `;
}

async function sendWithResend(row: NotificationEmailRow, to: string[]) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Kontrol <onboarding@resend.dev>",
      to,
      subject: `[Kontrol] ${row.titulo}`,
      html: emailHtml(row),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Resend HTTP ${response.status}`);
  }
}

export async function dispatchPendingNotificationEmails(
  supabase: SupabaseLike,
): Promise<EmailDispatchResult> {
  const to = recipientsFromEnv();
  if (!process.env.RESEND_API_KEY) {
    return { enabled: false, sent: 0, failed: 0, skippedReason: "RESEND_API_KEY ausente" };
  }
  if (to.length === 0) {
    return { enabled: false, sent: 0, failed: 0, skippedReason: "NOTIFICATION_EMAIL_TO ausente" };
  }

  const { data, error } = await supabase
    .from("notificacoes")
    .select("id,tipo,titulo,corpo,entidade_tipo,entidade_id,criado_em,email_tentativas")
    .is("email_enviado_em", null)
    .neq("status", "arquivada")
    .order("criado_em", { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await sendWithResend(row, to);
      const { error: updateError } = await supabase
        .from("notificacoes")
        .update({
          email_enviado_em: new Date().toISOString(),
          email_erro: null,
          email_tentativas: Number(row.email_tentativas ?? 0) + 1,
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      await supabase
        .from("notificacoes")
        .update({
          email_erro: message.slice(0, 500),
          email_tentativas: Number(row.email_tentativas ?? 0) + 1,
        })
        .eq("id", row.id);
    }
  }

  return { enabled: true, sent, failed };
}
