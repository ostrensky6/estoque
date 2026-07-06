-- Notificacoes externas: controle aditivo de envio por e-mail.
alter table notificacoes
  add column if not exists email_enviado_em timestamptz,
  add column if not exists email_erro text,
  add column if not exists email_tentativas int not null default 0;

create index if not exists notificacoes_email_pendentes_idx
  on notificacoes (email_enviado_em, status, criado_em desc)
  where email_enviado_em is null and status <> 'arquivada';
