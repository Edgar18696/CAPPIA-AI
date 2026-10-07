// Gancho de resolução (node:module register) só para os testes:
//  - todo import de src/supabase.js vira o Supabase FALSO em memória
//    (nada sai da máquina);
//  - imports relativos sem extensão (padrão do Vite) ganham ".js".
const FALSO = new URL("./supabaseFalso.mjs", import.meta.url).href;

export async function resolve(especificador, contexto, proximo) {
  let r;
  try {
    r = await proximo(especificador, contexto);
  } catch (erro) {
    if (/^\.\.?\//.test(especificador) && !/\.[cm]?jsx?$/.test(especificador)) {
      r = await proximo(`${especificador}.js`, contexto);
    } else {
      throw erro;
    }
  }
  if (/\/src\/supabase\.js$/.test(r.url)) return { ...r, url: FALSO, shortCircuit: true };
  return r;
}
