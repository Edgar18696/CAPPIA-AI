// =============================================================
// PLUGIN VITE — pesquisa do Paizinho em fontes originais (SÓ LOCAL)
// -------------------------------------------------------------
// Atende POST /api/paizinho-fontes-originais durante `npm run dev`.
// Não entra no build de produção (apply: "serve") e não publica nada.
//
// Precisa de OPENAI_API_KEY no arquivo .env.local da raiz do projeto
// (arquivo ignorado pelo git; a chave fica só no seu computador e
//  nunca é enviada ao navegador). Cada pesquisa é uma chamada paga
//  à OpenAI (busca na web).
// =============================================================

import process from "node:process";
import { loadEnv } from "vite";

const ROTA = "/api/paizinho-fontes-originais";

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = "";
    req.on("data", (p) => {
      dados += p;
      if (dados.length > 10000) reject(new Error("Corpo grande demais."));
    });
    req.on("end", () => resolve(dados));
    req.on("error", reject);
  });
}

function ehLocal(req) {
  const ip = req.socket?.remoteAddress || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function paizinhoPesquisaLocal() {
  return {
    name: "paiia-paizinho-pesquisa-local",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(ROTA, async (req, res) => {
        if (req.method !== "POST") return responder(res, 405, { ok: false, erro: "Use POST." });
        if (!ehLocal(req)) return responder(res, 403, { ok: false, erro: "Somente no computador local." });

        // Lê .env.local/.env a cada pesquisa (a mesma chave usada pelo
        // servidor local do Banner; ver ATIVAR_OPENAI_LOCAL.ps1).
        const env = loadEnv(server.config.mode, server.config.envDir || server.config.root, "");
        const chave = String(process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || "").trim();
        if (!chave) {
          return responder(res, 200, {
            ok: false,
            codigoErro: "SEM_CHAVE",
            erro: "Pesquisa em fontes originais não configurada: falta a chave OPENAI_API_KEY no arquivo .env.local do PAIIA (use o ATIVAR_OPENAI_LOCAL.ps1 da pasta do projeto).",
          });
        }

        let codigo = "";
        try {
          codigo = String(JSON.parse((await lerCorpo(req)) || "{}")?.codigo || "").trim();
        } catch {
          return responder(res, 400, { ok: false, erro: "JSON inválido." });
        }

        const inicio = Date.now();
        try {
          const [{ default: OpenAI }, { pesquisarFontesOriginaisServidor }] = await Promise.all([
            import("openai"),
            import("./pesquisaFontesOriginaisServidor.mjs"),
          ]);
          const openai = new OpenAI({
            apiKey: chave,
            ...(env.PAIZINHO_OPENAI_BASE_URL ? { baseURL: env.PAIZINHO_OPENAI_BASE_URL } : {}),
          });
          const resultado = await pesquisarFontesOriginaisServidor({
            codigo,
            openai,
            modelo: env.PAIZINHO_PESQUISA_MODELO || undefined,
            verificarPagina: env.PAIZINHO_VERIFICAR_PAGINA !== "0",
          });
          server.config.logger.info(
            `[Paizinho] pesquisa "${codigo}": ${resultado?.fontes?.length || 0} fonte(s) oficial(is) aceita(s), ` +
              `${resultado?.fontesDescartadasServidor?.length || 0} descartada(s) — ${Date.now() - inicio} ms`
          );
          return responder(res, 200, resultado);
        } catch (erro) {
          server.config.logger.error(`[Paizinho] falha na pesquisa "${codigo}": ${erro?.message || erro}`);
          return responder(res, 502, { ok: false, erro: `Falha na pesquisa externa: ${erro?.message || erro}` });
        }
      });
    },
  };
}
