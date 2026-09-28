/*
 * Detecta quando a página deve abrir direto em Contas Marketplace:
 * - volta da autorização oficial (Mercado Livre / Bling): ?code=...&state=ml.xxx
 * - volta com erro/cancelamento: ?error=access_denied&state=ml.xxx
 * - QR Code "Conectar pelo celular": ?conectar=mercadolivre
 */
export function retornoOAuthPendente() {
  try {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state") || "";
    const volta =
      (Boolean(params.get("code")) || Boolean(params.get("error"))) &&
      /^(ml|bling)\./.test(state);
    const conectarPeloCelular = params.get("conectar") === "mercadolivre";
    return volta || conectarPeloCelular;
  } catch {
    return false;
  }
}
