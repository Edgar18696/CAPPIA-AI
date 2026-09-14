import { emailEhContaInternaTeste } from "../config/contasInternasPaiia";

export function usuarioEhContaInternaTeste(usuario) {
  if (!usuario) return false;
  return emailEhContaInternaTeste(usuario.email);
}
