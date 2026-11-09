// (10/11) Publicação automática — etapa 2 (Bling e estoque) na retomada (F5 / "Tentar de novo").
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { executarPiloto } from "../../src/services/pilotoPublicacao.js";
import { leituraComCadastroRegistrado, blingIdDaPublicacao } from "../../src/services/blingRegistrado.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const L = { passo: 150, intervalo: 5, estavel: 3 };

// Tela falsa do bloco do Bling. `bling` = estado atual; clicar muda o estado como a tela real.
function tela(inicial, { aoConsultar = ["lendo", "encontrado"], aoReler = ["lendo", "encontrado"] } = {}) {
  const s = { bling: inicial, fila: [], cliques: [], quantidade: false };
  const el = (attrs = {}, texto = "") => ({ disabled: false, checked: false, attrs, texto, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null });
  const p = {
    achar(sel) {
      if (s.fila.length) s.bling = s.fila.shift(); // a leitura avança a cada olhada
      const b = s.bling;
      if (sel === "[data-paiia-revisao-ml]") return el();
      if (sel === "[data-paiia-bling-lendo]") return b === "lendo" ? el({ "data-paiia-bling-lendo": "" }) : null;
      if (sel === "[data-paiia-consultar-bling]") return b === "consultar" ? el({ "data-paiia-consultar-bling": "" }) : null;
      if (sel === "[data-paiia-usar-bling]") return b === "pendente" ? el({ "data-paiia-usar-bling": "" }) : null;
      if (sel === '[data-paiia-bling-escolha="sem"]') return b === "sem" ? el() : null;
      if (sel === "[data-paiia-reler-bling]") return ["erro", "encontrado"].includes(b) ? el({ "data-paiia-reler-bling": "" }) : null;
      if (sel === "[data-paiia-bling-estado]") return ["encontrado", "erro", "ambiguo", "nao-encontrado"].includes(b) ? el({ "data-paiia-bling-estado": b }) : null;
      if (sel === '[data-paiia-bling-estado="erro"]') return b === "erro" ? el({}, "⚠ Não foi possível consultar o Bling agora: o Bling não respondeu em 40 s") : null;
      if (sel === '[data-paiia-bling-estado="ambiguo"]') return b === "ambiguo" ? el({}, "❌ Mais de um produto no Bling com o SKU 5X3998134A: 5X3998134A (ID 1), 5X3998134A (ID 2).") : null;
      if (sel === "[data-paiia-bling-estoque]") return b === "encontrado" ? el({ "data-paiia-bling-estoque": "" }) : null;
      if (sel === "[data-paiia-confirmar-quantidade]") return s.quantidade ? null : el({ "data-paiia-confirmar-quantidade": "" });
      if (sel === "[data-paiia-publicar-ml]") return { ...el({ "data-paiia-publicar-ml": "" }), disabled: true };
      if (sel === "[data-paiia-bloqueios-detalhe]") return el({}, "Teste: parar antes de publicar.");
      return null;
    },
    clicar(e) {
      const a = Object.keys(e.attrs)[0]; s.cliques.push(a);
      if (a === "data-paiia-consultar-bling" || a === "data-paiia-usar-bling") s.fila.push(...aoConsultar);
      if (a === "data-paiia-reler-bling") s.fila.push(...aoReler);
      if (a === "data-paiia-confirmar-quantidade") s.quantidade = true;
    },
    texto: (e) => e?.texto || "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: (etapa) => { s.etapas = [...(s.etapas || []), etapa]; },
    consultarItem: async () => null,
    relerIntegracao: async () => "",
  };
  return { p, s };
}
const CRIAR = ["data-paiia-abrir-criar-bling", "data-paiia-confirmar-criar-bling"];

test("retomada (F5): 'Consultar o SKU no Bling' é reconhecido, produto já cadastrado é reutilizado e segue para Quantidade", async () => {
  const { p, s } = tela("consultar");
  const r = await executarPiloto(p, { limites: L });
  assert.notEqual(r.etapa, "bling", r.texto);
  assert.deepEqual(s.cliques.slice(0, 2), ["data-paiia-consultar-bling", "data-paiia-confirmar-quantidade"]);
  assert.ok(!s.cliques.some((c) => CRIAR.includes(c)), "nada criado no Bling");
  assert.ok(s.etapas.includes("quantidade") && s.etapas.includes("publicar"));
  assert.ok(!s.cliques.includes("data-paiia-publicar-ml"), "nada enviado ao ML");
});

test("'Tentar de novo' com o Bling já lido: não consulta nem cria de novo", async () => {
  const { p, s } = tela("encontrado");
  const r = await executarPiloto(p, { limites: L });
  assert.notEqual(r.etapa, "bling");
  assert.ok(!s.cliques.some((c) => /bling/.test(c)), "nenhum toque no Bling");
});

test("primeira vez (escolha pendente): usa o Bling como antes", async () => {
  const { p, s } = tela("pendente");
  const r = await executarPiloto(p, { limites: L });
  assert.notEqual(r.etapa, "bling");
  assert.equal(s.cliques[0], "data-paiia-usar-bling");
});

test("consulta lenta: espera o Bling responder (não pausa enquanto lê)", async () => {
  const { p } = tela("consultar", { aoConsultar: [...Array(8).fill("lendo"), "encontrado"] });
  const r = await executarPiloto(p, { limites: L });
  assert.notEqual(r.etapa, "bling", r.texto);
});

test("Bling sem resposta: pausa com o motivo, nada criado", async () => {
  const { p, s } = tela("lendo");
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "bling");
  assert.match(r.texto, /não respondeu à consulta do SKU/);
  assert.equal(r.antesDoEnvio, true);
  assert.ok(!s.cliques.some((c) => CRIAR.includes(c)));
});

test("erro na consulta: relê UMA vez; se responder, segue", async () => {
  const { p, s } = tela("erro");
  const r = await executarPiloto(p, { limites: L });
  assert.notEqual(r.etapa, "bling");
  assert.equal(s.cliques.filter((c) => c === "data-paiia-reler-bling").length, 1);
});

test("erro que continua: pausa com a mensagem do Bling, sem criar e sem seguir para Quantidade", async () => {
  const { p, s } = tela("erro", { aoReler: ["lendo", "erro"] });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "bling");
  assert.match(r.texto, /^Não foi possível consultar o Bling agora: o Bling não respondeu em 40 s\. Nada foi criado/);
  assert.ok(!s.cliques.includes("data-paiia-confirmar-quantidade"));
  assert.ok(!s.cliques.some((c) => CRIAR.includes(c)));
});

test("SKU duplicado no Bling: pausa e não escolhe nem cria", async () => {
  const { p, s } = tela("ambiguo");
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "bling");
  assert.match(r.texto, /^Mais de um produto no Bling com o SKU 5X3998134A/);
  assert.ok(!s.cliques.some((c) => CRIAR.includes(c)));
});

test("sem conta Bling conectada: pausa explicando (não publica sem conferir o SKU)", async () => {
  const { p } = tela("sem");
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "bling");
  assert.match(r.texto, /Nenhuma conta Bling conectada/);
});

test("ID do Bling gravado na ficha: busca vazia vira 'encontrado' (nunca oferece criar de novo)", () => {
  const id = blingIdDaPublicacao([{ marketplace: "mercado_livre", bling_produto_id: 16612345678 }]);
  const l = leituraComCadastroRegistrado({ ok: true, encontrado: false }, { blingProdutoId: id, sku: "5X3998134A" });
  assert.equal(l.encontrado, true);
  assert.equal(l.produto.id, 16612345678);
});

test("tela: marcas da leitura, do SKU duplicado e limite de espera do Bling", () => {
  const r = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(r.includes("<p data-paiia-bling-lendo style={info}>⏳ Consultando o Bling pelo SKU"));
  assert.ok(r.includes('<div data-paiia-bling-estado="ambiguo" style={erro}>'));
  assert.ok(r.includes("o Bling não respondeu em 40 s"));
  assert.equal((r.match(/finally \{ setLendoBlingPub\(false\); \}/g) || []).length, 2, "nunca fica Consultando preso");
  assert.ok(ler("src/components/PilotoAutomaticoPublicacao.jsx").includes("Criar Próximo Anúncio"), "botão preservado");
  const m = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(m.includes('document.getElementById(etapa === "bling" ? "pub-etapa-bling" : "pub-etapa-publicar")'), "Corrigir leva ao bloco do Bling");
});
