import { gerarAnuncioInteligente } from "./gerarAnuncio";

export async function consultarCatalogo(codigo) {
  const resultado = await gerarAnuncioInteligente(codigo);

  if (!resultado || !resultado.sucesso) {
    return {
      sucesso: false,
      mensagem: resultado?.mensagem || "Peça não encontrada.",
    };
  }

  return {
    sucesso: true,

    codigo: resultado.codigo,
    oem: resultado.oem,

    titulo: resultado.titulo,
    descricao: resultado.descricao,

    diagnostico: resultado.diagnostico,
    auditoria: resultado.auditoria,

    registros: resultado.registros,
    equivalentes: resultado.equivalentes,

    pecaEncontrada: resultado.pecaEncontrada,
  };
}