import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/auth", "/aprovar"];

/** Atualiza a sessão e protege rotas (redireciona não autenticados ao /login). */
export async function updateSession(request: NextRequest) {
  if (process.env.PLAYWRIGHT_MOCK_SUPABASE === "1") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => path.startsWith(p));

  if (!user && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Usuário com senha provisória: bloqueia tudo até definir a senha
  // definitiva (exceto a própria página de troca).
  if (user && user.user_metadata?.senha_provisoria === true && !path.startsWith("/trocar-senha")) {
    const url = request.nextUrl.clone();
    url.pathname = "/trocar-senha";
    return NextResponse.redirect(url);
  }
  // Já trocou a senha mas ainda tenta acessar a página de troca → home.
  if (user && user.user_metadata?.senha_provisoria !== true && path.startsWith("/trocar-senha")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
