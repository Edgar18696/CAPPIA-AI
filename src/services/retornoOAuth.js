/*
 * Detecta a volta da autorização oficial (Mercado Livre / Bling):
 * a URL traz ?code=...&state=ml.xxx ou state=bling.xxx.
 */
export function retornoOAuthPendente() {
  try {
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state") || "";
    return Boolean(params.get("code")) && /^(ml|bling)\./.test(state);
  } catch {
    return false;
  }
}
