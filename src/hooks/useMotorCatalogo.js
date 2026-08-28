import { consultarCatalogo } from "../inteligenciaCatalogo/centralCatalogo";

export function useMotorCatalogo({
  setCodigo,
  setOem,
  setTitulo,
  setDescricao,
  setDiagnostico,
  setAuditoria,
  setPecaEncontrada,
}) {
  async function buscarAnuncio(codigoDigitado) {
    const resultado = await consultarCatalogo(codigoDigitado);

    if (!resultado.sucesso) {
      alert(resultado.mensagem);
      return false;
    }

    setCodigo(resultado.codigo || "");
    setOem(resultado.oem || "");
    setTitulo(resultado.titulo || "");
    setDescricao(resultado.descricao || "");
    setDiagnostico(resultado.diagnostico || null);
    setAuditoria(resultado.auditoria || null);
    setPecaEncontrada(resultado.pecaEncontrada || null);

    return true;
  }

  return {
    buscarAnuncio,
  };
}
