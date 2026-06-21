import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  classesValor,
  type EstadoCalculado,
} from "@/lib/orcamento/tom-valor";

/**
 * Primitivos da convenção visual global §8.2 do plano de redesenho:
 *   Azul  = dado que o usuário insere, escolhe ou edita.
 *   Neutro = dado que o sistema calcula, deriva, bloqueia ou snapshota.
 *
 * Use estes componentes (e não classes ad-hoc) para que a regra fique idêntica
 * em todo o app. A lógica de cor vive em `@/lib/orcamento/tom-valor`.
 */

/** Valor inserido/escolhido/editável pelo usuário — renderizado em azul. */
export function ValorEntrada({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(classesValor("entrada"), className)}>{children}</span>;
}

/** Valor calculado/derivado/bloqueado/snapshotado — renderizado em neutro. */
export function ValorCalculado({
  children,
  estado,
  className,
}: {
  children: ReactNode;
  estado?: EstadoCalculado;
  className?: string;
}) {
  return (
    <span className={cn(classesValor("calculado", estado), className)}>{children}</span>
  );
}

/**
 * Campo rotulado para painéis densos (§8.1): rótulo discreto + valor já tonalizado
 * conforme a convenção. `tipo` controla a cor; `estado` ajusta a ênfase do valor
 * calculado (derivado/bloqueado/snapshot).
 */
export function CampoValor({
  rotulo,
  children,
  tipo,
  estado,
  className,
}: {
  rotulo: string;
  children: ReactNode;
  tipo: "entrada" | "calculado";
  estado?: EstadoCalculado;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5", className)}>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      {tipo === "entrada" ? (
        <ValorEntrada>{children}</ValorEntrada>
      ) : (
        <ValorCalculado estado={estado}>{children}</ValorCalculado>
      )}
    </div>
  );
}
