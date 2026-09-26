import { startTransition, type FormEvent } from "react";

/**
 * `onSubmit` que despacha a action de `useActionState` sem o reset automático
 * que o React aplica a `<form action>`: em caso de erro, o que o usuário
 * digitou continua no formulário. A validação nativa roda antes do submit.
 */
export function enviarSemReset(dispatch: (dados: FormData) => void) {
  return (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    startTransition(() => dispatch(dados));
  };
}
