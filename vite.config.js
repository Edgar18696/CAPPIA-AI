import { defineConfig } from "vite";

import { criarMiddlewareBannerOpenAI } from "./scripts/dev/bannerOpenAIDev.mjs";
import { paizinhoPesquisaLocal } from "./scripts/paizinho/vitePluginPesquisaLocal.mjs";
import { criarMiddlewarePhotoroom, contadorArquivo, registroArquivo } from "./scripts/dev/photoroomDev.mjs";

// Única configuração extra do projeto: servidor local da IA do Banner
// Express, ativo SOMENTE no "npm run dev" (localhost). O build de produção
// não muda.
export default defineConfig({
  // (13/11) Teste pelo CELULAR (PAIIA_TESTE_CELULAR=1): sem a conexão de recarga
  // automática do servidor de teste. Ao abrir a câmera o celular derruba essa
  // conexão e, na volta, o Vite recarregava a página inteira (voltava à Home e a
  // foto tirada se perdia). Não afeta o build do site.
  ...(globalThis.process?.env?.PAIIA_TESTE_CELULAR === "1" ? { server: { ws: false } } : {}),
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
        // Contador de fotos pagas e registro (sem chave) ficam fora do projeto.
        const pasta = "C:\\PAIIA\\testes-foto-ia\\photoroom-local";
        server.middlewares.use(criarMiddlewarePhotoroom({
          contador: contadorArquivo(`${pasta}\\uso-pago.json`),
          registrar: registroArquivo(pasta),
          // (14/11) PAIIA_FOTO_GRATIS=1: testa só o recorte grátis, como no site hoje.
          desligado: globalThis.process?.env?.PAIIA_FOTO_GRATIS === "1",
        }));
      },
    },
  ],
});
