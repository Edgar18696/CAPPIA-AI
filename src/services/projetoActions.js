import {
  inserirProjeto,
  editarProjeto,
  removerProjeto,
} from "./projetosService";

export async function criarProjetoAction({
  supabase,
  usuario,
  nomeProjeto,
  descricaoProjeto,
  statusProjeto,
  imagem,
}) {
  if (!usuario) {
    throw new Error("Faça login primeiro.");
  }

  if (!String(nomeProjeto || "").trim()) {
    throw new Error(
      "Digite o nome do projeto."
    );
  }

  return inserirProjeto(
    supabase,
    usuario,
    {
      nome: nomeProjeto,
      descricao:
        descricaoProjeto || "",
      imagem: imagem || null,
      status:
        statusProjeto ||
        "Em andamento",
    }
  );
}

export async function atualizarProjetoAction({
  supabase,
  projetoId,
  nomeProjeto,
  descricaoProjeto,
  statusProjeto,
}) {
  if (!projetoId) {
    throw new Error(
      "Nenhum projeto selecionado."
    );
  }

  return editarProjeto(
    supabase,
    projetoId,
    {
      nome: nomeProjeto,
      descricao:
        descricaoProjeto || "",
      status:
        statusProjeto ||
        "Em andamento",
    }
  );
}

export async function excluirProjetoAction({
  supabase,
  projetoId,
}) {
  if (!projetoId) {
    throw new Error(
      "Projeto não informado."
    );
  }

  return removerProjeto(
    supabase,
    projetoId
  );
}