/*
 * Garante que o navegador use a versão PUBLICADA mais recente do PAIIA.
 *
 * O servidor não envia "Cache-Control" para a página inicial, então o
 * navegador pode reutilizar por horas um index.html antigo (que aponta para
 * o JavaScript da publicação anterior). Ao abrir o site, comparamos o arquivo
 * JS em uso com o que o servidor está publicando agora; se forem diferentes,
 * recarregamos a página uma vez (o recarregamento revalida o index.html).
 */
const CHAVE_RECARGA = "paiia_recarga_versao";

function bundleEmUso() {
  const src = Array.from(document.scripts)
    .map((s) => s.src || "")
    .find((s) => /\/assets\/index-[\w-]+\.js/.test(s));
  const achado = src && src.match(/index-[\w-]+\.js/);
  return achado ? achado[0] : "";
}

export async function garantirVersaoPublicada() {
  if (import.meta.env.DEV) return;
  const atual = bundleEmUso();
  if (!atual) return;

  try {
    const resposta = await fetch(`/?versao=${Date.now()}`, {
      cache: "no-store",
    });
    if (!resposta.ok) return;
    const html = await resposta.text();
    const publicado = (html.match(/\/assets\/(index-[\w-]+\.js)/) || [])[1];
    if (!publicado) return;

    if (publicado === atual) {
      sessionStorage.removeItem(CHAVE_RECARGA);
      return;
    }

    // Evita recarregar em laço se, por algum motivo, a versão não mudar.
    if (sessionStorage.getItem(CHAVE_RECARGA) === publicado) return;
    sessionStorage.setItem(CHAVE_RECARGA, publicado);
    console.info(`[PAIIA] Nova versão publicada (${publicado}); atualizando a página.`);
    window.location.reload();
  } catch {
    /* sem rede: segue com a versão atual */
  }
}
