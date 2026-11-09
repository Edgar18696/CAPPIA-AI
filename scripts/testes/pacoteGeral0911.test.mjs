// (09/11) Pacote geral: Galeria só com Fotos, Dashboard sem "Banner IA" e motivo ESPECÍFICO
// quando a Publicação automática pausa antes do envio (SKU 5X3998134A).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ABAS_GALERIA, ABAS_FORA_DA_GALERIA, filtroDaGaleriaNormal, mostrarBarraDeAbas } from "../../src/config/galeriaPaiia.js";
import { executarPiloto, motivoDoBloqueio } from "../../src/services/pilotoPublicacao.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("Galeria: só a aba Fotos; Mascotes, Banners e Vídeos fora da vista; filtro antigo volta para Fotos", () => {
  assert.deepEqual(ABAS_GALERIA.map((a) => a.valor), ["foto"]);
  assert.deepEqual([...ABAS_FORA_DA_GALERIA].sort(), ["banner", "mascote", "video"]);
  for (const f of ["banner", "video", "mascote", "", undefined]) assert.equal(filtroDaGaleriaNormal(f), "foto");
  assert.equal(filtroDaGaleriaNormal("foto"), "foto");
  assert.equal(mostrarBarraDeAbas(), false, "uma aba só: sem barra");
  const g = ler("src/components/Galeria.jsx");
  assert.ok(!/label: "🎭 Mascotes"|label: "🎨 Banners"|label: "🎬 Vídeos"/.test(g), "abas fora do código da barra");
  assert.equal((g.match(/🖼️ Usar no Banner/g) || []).length, 0, "Usar no Banner saiu das fotos (cartão e foto aberta)");
  assert.match(g, /Selecionar tudo/);
  assert.match(g, /Desmarcar tudo/);
  assert.match(g, /Excluir selecionadas/);
  assert.match(g, /⬇️ Baixar/);
  assert.match(g, /buscaGaleria/);
  assert.match(ler("src/App.jsx"), /confirm\(`Excluir \$\{selecionadas\.length\} imagem\(ns\) selecionada\(s\)\?`\)/, "exclusão continua com confirmação");
  assert.equal(/supabase/i.test(ler("src/config/galeriaPaiia.js")), false, "a lista não mexe na base");
});

test("Dashboard (Central de Inteligência): sem o cartão Banner IA; os outros atalhos continuam", () => {
  const c = ler("src/components/CentralInteligencia.jsx");
  const acoes = [...c.matchAll(/^\s*\["[^"]+", "([^"]+)", "([^"]+)"\],/gm)].map((m) => m[1]);
  assert.ok(!acoes.includes("Banner IA"));
  for (const n of ["Novo Anúncio", "Meus Anúncios", "Precificação", "Publicar", "Foto IA", "Catálogos"]) assert.ok(acoes.includes(n), n);
  assert.match(ler("src/App.jsx"), /screen === "banner"|screen === "bannerStudio"/, "a tela do Banner continua existindo");
});

test("motivoDoBloqueio: pendência real primeiro; conferência travada com o nome; motivo do botão; nunca genérico mudo", () => {
  const a = motivoDoBloqueio("Categoria: MLB431130 rejeitada para este SKU. · Fotos: falta 1 foto.");
  assert.equal(a.item, "Categoria");
  assert.match(a.texto, /^Corrija antes de publicar — Categoria: MLB431130 rejeitada/);
  const b = motivoDoBloqueio("Categoria: Conferindo a categoria no Mercado Livre…");
  assert.equal(b.item, "Categoria");
  assert.match(b.texto, /A conferência de Categoria não terminou em 45 s/);
  assert.match(b.texto, /Nada foi enviado/);
  const c = motivoDoBloqueio("", "ainda preparando os dados do anúncio no Mercado Livre.");
  assert.match(c.texto, /O botão Publicar não foi liberado: ainda preparando/);
  const d = motivoDoBloqueio("", "");
  assert.match(d.texto, /Corrigir nesta ficha/);
  const e = motivoDoBloqueio("Ficha salva na base: conflito de versões. · Categoria: Conferindo…");
  assert.equal(e.item, "Ficha salva na base");
  assert.match(e.texto, /ainda sem resposta: Categoria/);
});

function telaBloqueada({ bloqueio = "", motivo = "" } = {}) {
  const cliques = [];
  const el = (attrs = {}, texto = "") => ({ disabled: false, checked: false, attrs, texto, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null });
  const p = {
    achar(sel) {
      if (sel.includes("data-paiia-revisao-ml")) return el();
      if (sel.includes("data-paiia-bling-estoque")) return el({ "data-paiia-bling-estoque": "" });
      if (sel.includes("data-paiia-quantidade-estado")) return el();
      if (sel === "[data-paiia-publicar-ml]") return { ...el({ "data-paiia-publicar-ml": "" }), disabled: true };
      if (sel === "[data-paiia-bloqueios-detalhe]") return bloqueio ? el({}, bloqueio) : null;
      if (sel === "[data-paiia-publicar-motivo]") return motivo ? el({}, motivo) : null;
      return null;
    },
    clicar(e) { cliques.push(Object.keys(e.attrs)[0]); },
    texto: (e) => e?.texto || "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: () => {},
    consultarItem: async () => null,
    relerIntegracao: async () => "",
  };
  return { p, cliques };
}
const L = { passo: 200, intervalo: 10, estavel: 3 };

test("piloto: conferência que não termina → pausa com o NOME da pendência, antes do envio, sem tocar em Publicar", async () => {
  const { p, cliques } = telaBloqueada({ bloqueio: "Categoria: Conferindo a categoria no Mercado Livre…" });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, false);
  assert.equal(r.etapa, "publicar");
  assert.equal(r.item, "Categoria");
  assert.equal(r.antesDoEnvio, true);
  assert.match(r.texto, /Categoria/);
  assert.ok(!/não foi liberada pela conferência\.$/.test(r.texto));
  assert.ok(!cliques.includes("data-paiia-publicar-ml"), "nada enviado");
});

test("piloto: botão desligado sem pendência na lista → motivo do botão (ex.: conta)", async () => {
  const { p } = telaBloqueada({ motivo: "a conta do Mercado Livre escolhida não está conectada ou não é sua (token expirado)." });
  const r = await executarPiloto(p, { limites: L });
  assert.match(r.texto, /O botão Publicar não foi liberado: a conta do Mercado Livre/);
  assert.equal(r.antesDoEnvio, true);
});

test("piloto: pendência estável continua pausando com o motivo e o item", async () => {
  const { p } = telaBloqueada({ bloqueio: "Fotos: o anúncio precisa de pelo menos 1 foto." });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.item, "Fotos");
  assert.match(r.texto, /^Corrija antes de publicar — Fotos/);
});

test("tela: pausa oferece Corrigir nesta ficha e Tentar de novo só antes do envio; Publicação expõe o motivo do botão", () => {
  const pil = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.match(pil, /data-paiia-piloto-corrigir/);
  assert.match(pil, /data-paiia-piloto-tentar/);
  assert.match(pil, /st\.fim\.antesDoEnvio/);
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /data-paiia-publicar-motivo/);
  assert.match(rev, /try \{ r = await conferirCategoriaAgora\(\); \} catch/);
  assert.match(rev, /try \{ r = await conferirFretePublicacao\(\); \} catch/);
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(mlt, /onCorrigir=\{\(\{ item, etapa \}\) => \{/);
  assert.match(mlt, /setPublicacaoManual\(true\);/);
});

// ---------------- PAIIA Voz: navegação de cima para baixo ----------------
import { posicaoInicioEtapa, campoEscondido, seletorDoCampo, rolarParaInicioDaEtapa, mostrarCampo } from "../../src/modules/paiiaVoz/servicos/rolagemEtapaVoz.js";

function paginaFalsa({ scrollY = 1500, blocoTopo = -900, sku = 40, assistente = 180, campoTopo = 100, alturaTela = 800 } = {}) {
  const rolagens = [];
  const caixa = (top, height) => ({ getBoundingClientRect: () => ({ top, bottom: top + height, height }) });
  const elementos = {
    "[data-pv-sku-fixo]": caixa(0, sku),
    ".pr-assistente": caixa(sku, assistente),
    '[data-pr-bloco="preco"]': caixa(blocoTopo, 600),
    '[data-pv-campo-direto="estoque"]': caixa(campoTopo, 50),
  };
  return {
    rolagens,
    win: { scrollY, innerHeight: alturaTela, scrollTo: (o) => rolagens.push(o.top) },
    doc: { querySelector: (s) => elementos[s] || null },
  };
}

test("Voz: Próximo abre a etapa no INÍCIO, logo abaixo do SKU + assistente fixos (não na rolagem anterior)", () => {
  assert.equal(posicaoInicioEtapa({ topoBloco: -900, scrollAtual: 1500, alturaFixa: 220 }), 1500 - 900 - 220 - 8);
  assert.equal(posicaoInicioEtapa({ topoBloco: 50, scrollAtual: 0, alturaFixa: 220 }), 0, "nunca negativo");
  const pg = paginaFalsa();
  assert.equal(rolarParaInicioDaEtapa("preco", pg), true);
  assert.deepEqual(pg.rolagens, [1500 - 900 - 220 - 8]);
  assert.equal(rolarParaInicioDaEtapa("inexistente", pg), false, "sem bloco: não mexe");
});

test("Voz: campo atrás do cabeçalho fixo é trazido para baixo dele; campo visível não sai do lugar", () => {
  assert.equal(campoEscondido({ topo: 100, base: 150, alturaFixa: 220, alturaTela: 800 }), true);
  assert.equal(campoEscondido({ topo: 300, base: 350, alturaFixa: 220, alturaTela: 800 }), false);
  assert.equal(campoEscondido({ topo: 780, base: 830, alturaFixa: 220, alturaTela: 800 }), true, "abaixo da tela");
  const pg = paginaFalsa({ campoTopo: 100 });
  assert.equal(mostrarCampo('[data-pv-campo-direto="estoque"]', pg), true);
  assert.deepEqual(pg.rolagens, [1500 + 100 - 220 - 8]);
  const pg2 = paginaFalsa({ campoTopo: 400 });
  assert.equal(mostrarCampo('[data-pv-campo-direto="estoque"]', pg2), false);
  assert.equal(mostrarCampo('[data-pv-campo-direto="estoque"]', { ...pg2, sempre: true }), true, "erro: vai ao campo sempre");
  assert.equal(seletorDoCampo("titulo"), "#pr-titulo");
  assert.equal(seletorDoCampo("veic:modelo"), '[data-pv-campo-direto="veic:modelo"]');
  assert.equal(seletorDoCampo("", "compat"), '[data-pr-bloco="compat"] .pr-campo');
});

test("Voz: irPara rola ao início de TODA etapa, mantém o microfone (opção ligada) e não mexe em Voltar/salvamento", () => {
  const v = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const ir = v.slice(v.indexOf("const irPara = useCallback"), v.indexOf("}, [mudarFicha]);", v.indexOf("const irPara = useCallback")));
  assert.match(ir, /rolarParaInicioDaEtapa\(e\)/);
  assert.ok(!/if \(e === "finalizar"\) setTimeout/.test(ir), "não é mais só para Finalizar");
  assert.match(ir, /ouviaAntes && manterMicRef\.current/);
  assert.match(ir, /mudarFicha\(irParaEtapa\(fichaRef\.current, e\)\)/, "mesma gravação da ficha");
  assert.match(v, /\.pr-assistente \{ position: sticky; top: var\(--pr-sku-h, 0px\)/, "assistente abaixo do SKU, sem se sobrepor");
  assert.match(v, /raiz\.style\.scrollPaddingTop = /, "foco/teclado param abaixo dos cabeçalhos");
  assert.match(v, /raiz\.style\.scrollPaddingTop = anterior/, "ao sair do Voz, volta como era");
  assert.match(v, /startsWith\("⚠️"\)[\s\S]{0,120}mostrarCampo\(seletorDoCampo\(campoVozRef\.current, etapa\), \{ sempre: true \}\)/, "erro leva ao campo");
  assert.match(v, /← \{ROTULOS_ETAPAS\[antes\]\}/, "botão Voltar preservado");
});
