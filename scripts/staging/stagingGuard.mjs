export const PRODUCTION_PROJECT_REF = "arqzpqkkpwikyecdbopf";

export function obterProjectRef(url) {
  const host = new URL(url).hostname;
  return host.endsWith(".supabase.co") ? host.split(".")[0] : "";
}

export function validarAmbienteStaging(env = process.env, opcoes = {}) {
  const url = String(env.SUPABASE_STAGING_URL || "").trim();
  const refInformado = String(env.PAIIA_STAGING_PROJECT_REF || "").trim();
  const confirmacao = String(env.PAIIA_ALLOW_STAGING_TESTS || "").trim();
  const exigirConfirmacaoTestes = opcoes.exigirConfirmacaoTestes !== false;

  if (exigirConfirmacaoTestes && confirmacao !== "SIM") {
    throw new Error("Defina PAIIA_ALLOW_STAGING_TESTS=SIM para habilitar testes no staging.");
  }
  if (!url || !refInformado) {
    throw new Error("SUPABASE_STAGING_URL e PAIIA_STAGING_PROJECT_REF são obrigatórios.");
  }

  const refUrl = obterProjectRef(url);
  if (!refUrl || refUrl !== refInformado) {
    throw new Error("A URL não corresponde ao PAIIA_STAGING_PROJECT_REF informado.");
  }
  if (refUrl === PRODUCTION_PROJECT_REF || url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error("BLOQUEADO: o projeto de produção nunca pode ser usado por este executor.");
  }

  return { url, projectRef: refUrl };
}

export function exigir(env, nome) {
  const valor = String(env[nome] || "").trim();
  if (!valor) throw new Error(`${nome} é obrigatório.`);
  return valor;
}
