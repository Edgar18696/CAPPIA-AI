import { usuarioEhAdministrador } from "./usuarioEhAdministrador";
import { usuarioEhContaInternaTeste } from "./usuarioEhContaInternaTeste";

export const SALDO_INTERNO_TESTE = 999999;

export function usuarioPodeUsarSemPagamento(usuario) {
  return (
    usuarioEhContaInternaTeste(usuario) || usuarioEhAdministrador(usuario)
  );
}
