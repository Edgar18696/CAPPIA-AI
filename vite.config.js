import { defineConfig } from "vite";

import { criarMiddlewareBannerOpenAI } from "./scripts/dev/bannerOpenAIDev.mjs";
import { paizinhoPesquisaLocal } from "./scripts/paizinho/vitePluginPesquisaLocal.mjs";
import { criarMiddlewarePhotoroom } from "./scripts/dev/photoroomDev.mjs";

// Única configuração extra do projeto: servidor local da IA do Banner
// Express, ativo SOMENTE no "npm run dev" (localhost). O build de produção
// não muda.
export default defineConfig({
  plugins: [
    {
      name: "paiia-banner-openai-local",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(
          criarMiddlewareBannerOpenAI(server.config.root)
        );
      },
    },
    // Pesquisa do Paizinho em fontes originais (Criar Anúncio) — também
    // SOMENTE no "npm run dev"; usa a mesma OPENAI_API_KEY do .env.local.
    paizinhoPesquisaLocal(),
    // (13/11) Photoroom Sandbox para a câmera da Foto IA — SOMENTE no "npm run dev";
    // a chave fica em C:\PAIIA\photoroom-teste.env, nunca no navegador.
    {
      name: "paiia-photoroom-local",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(criarMiddlewarePhotoroom());
      },
    },
  ],
});
