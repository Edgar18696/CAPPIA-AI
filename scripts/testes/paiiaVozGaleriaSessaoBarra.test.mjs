// =============================================================
// PAIIA Voz — (08/11) Galeria PAIIA na etapa Fotos:
//  1) Sessão: a Galeria usa o login do PAIIA (nunca a conta do Mercado Livre). Se a tela ainda
//     não recebeu o usuário mas há sessão válida no navegador, carrega as fotos normalmente.
//     Sem login de verdade: oferece "Entrar na conta PAIIA" e volta para a MESMA etapa (rascunho intacto).
//  2) Barra fixa embaixo: "X de Y fotos" + "Usar X Fotos Selecionadas", sempre visível.
//   node --test scripts/testes/paiiaVozGaleriaSessaoBarra.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const G = await import("../../src/modules/paiiaVoz/servicos/galeriaVoz.js");
const RL = await import("../../src/modules/paiiaVoz/servicos/retornoLoginVoz.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

function sbFalso({ sessao = null, linhas = [], falharSessao = false } = {}) {
  const chamadas = [];
  const q = {
    select() { return q; }, eq(c, v) { chamadas.push(["eq", c, v]); return q; }, not() { return q; }, order() { return q; },
    range() { return Promise.resolve({ data: linhas, error: null }); },
  };
  return {
    chamadas,
    auth: { getSession: async () => { if (falharSessao) throw new Error("offline"); return { data: { session: sessao }, error: null }; } },
    from(t) { chamadas.push(["from", t]); return q; },
  };
}
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test("1) usuário da Galeria: o da tela; sem ele, a sessão válida do navegador; sem sessão, 'sem login'", async () => {
  assert.deepEqual(await G.usuarioDaGaleria(sbFalso(), "u-tela"), { id: "u-tela", origem: "tela" });
  assert.deepEqual(await G.usuarioDaGaleria(sbFalso({ sessao: { user: { id: "u-sessao" } } }), ""), { id: "u-sessao", origem: "sessao" });
  assert.deepEqual(await G.usuarioDaGaleria(sbFalso(), ""), { id: "", origem: "sem-login" });
  assert.deepEqual(await G.usuarioDaGaleria(sbFalso({ falharSessao: true }), undefined), { id: "", origem: "sem-login" });
});

test("2) com sessão válida, as fotos carregam normalmente (mesma consulta só leitura, filtrada pelo usuário)", async () => {
  const sb = sbFalso({ sessao: { user: { id: "u9" } }, linhas: [{ id: 1, status: "processado", imagem_processada: "https://x/p1.png", imagem_original: "https://x/o1.jpg" }] });
  const u = await G.usuarioDaGaleria(sb, null);
  const r = await G.listarFotosGaleria(sb, u.id);
  assert.equal(r.erro, "");
  assert.equal(r.fotos.length, 1);
  assert.ok(sb.chamadas.some(([k, c, v]) => k === "eq" && c === "user_id" && v === "u9"));
});

test("3) sem login de verdade: aviso claro do PAIIA (não da conta do Mercado Livre) e nada é consultado", async () => {
  const sb = sbFalso();
  const r = await G.listarFotosGaleria(sb, "");
  assert.equal(r.semLogin, true);
  assert.match(r.erro, /conta PAIIA/);
  assert.match(r.erro, /Mercado Livre/, "explica que a conta do Mercado Livre conectada não é o login do PAIIA");
  assert.ok(!sb.chamadas.some(([k]) => k === "from"), "proteção mantida: sem login nada é lido");
});

test("4) entrar e voltar: depois do login volta ao PAIIA Voz (mesma etapa do rascunho) e reabre a Galeria uma vez", () => {
  const ss = memoria();
  RL.marcarRetornoAposLogin({ tela: "paiiaVoz", abrirGaleria: true }, { armazenamento: ss, agora: 1000 });
  assert.equal(RL.telaAposLogin({ armazenamento: ss, agora: 2000 }), "paiiaVoz");
  assert.equal(RL.consumirAbrirGaleria({ armazenamento: ss, agora: 2000 }), true);
  assert.equal(RL.consumirAbrirGaleria({ armazenamento: ss, agora: 2000 }), false, "só uma vez");
  assert.equal(RL.telaAposLogin({ armazenamento: ss, agora: 2000 }), "home", "pedido já usado");
  // pedido antigo (mais de 30 min) não sequestra um login futuro
  RL.marcarRetornoAposLogin({ tela: "paiiaVoz" }, { armazenamento: ss, agora: 0 });
  assert.equal(RL.telaAposLogin({ armazenamento: ss, agora: 31 * 60 * 1000 }), "home");
  // armazenamento indisponível: segue para a Home sem erro
  assert.equal(RL.telaAposLogin({ armazenamento: null }), "home");
});

test("5) App: o login devolve à tela pedida (não sempre a Home); a proteção de acesso continua", () => {
  const app = ler("src/App.jsx");
  assert.ok(app.includes('import { telaAposLogin } from "./modules/paiiaVoz/servicos/retornoLoginVoz";'));
  const entrar = app.slice(app.indexOf("async function entrarUsuario()"), app.indexOf("async function cadastrarUsuario("));
  assert.ok(entrar.includes("setScreen(telaAposLogin())") && !entrar.includes('setScreen("home")'), entrar);
  const gal = ler("src/modules/paiiaVoz/servicos/galeriaVoz.js");
  assert.ok(gal.includes('.eq("user_id", userId)'), "as fotos continuam filtradas pelo usuário");
});

test("6) GaleriaSeletor: usa a sessão quando a tela não tem o usuário e oferece 'Entrar na conta PAIIA'", () => {
  const t = ler("src/components/fotos/GaleriaSeletor.jsx");
  assert.ok(t.includes("usuarioDaGaleria(supabase, userId)"));
  assert.ok(t.includes("data-pr-galeria-entrar") && t.includes("Entrar na conta PAIIA") && t.includes("onEntrar"));
});

test("7) barra fixa: contador 'X de Y fotos' e 'Usar X Fotos Selecionadas', sempre visível, sem cobrir as fotos", () => {
  const t = ler("src/components/fotos/GaleriaSeletor.jsx");
  assert.ok(t.includes("data-pr-galeria-barra"));
  assert.ok(t.includes("data-pr-galeria-contador") && t.includes("de ${vagas} foto"), "contador");
  assert.ok(t.includes("Usar ${n} Foto${n === 1 ? \"\" : \"s\"} Selecionada${n === 1 ? \"\" : \"s\"}"), "texto do botão");
  assert.ok(t.includes("fecharAoUsar"), "fecha depois de confirmar para seguir o anúncio");
  // painel: só o meio rola; a barra fica fora da rolagem (sempre visível, sem cobrir fotos)
  assert.match(t, /\.pg-painel \{[^}]*display: flex; flex-direction: column; overflow: hidden/);
  assert.match(t, /\.pg-meio \{[^}]*overflow-y: auto/);
  assert.match(t, /\.pg-barra \{ flex: none;/);
  const painel = t.slice(t.indexOf('className="pg-painel"'));
  assert.ok(painel.indexOf("data-pr-galeria-rolagem") < painel.indexOf("barra FORA da rolagem") && painel.indexOf("barra FORA da rolagem") < painel.indexOf("data-pr-galeria-barra"), "barra depois e fora da área que rola");
  // grade de verdade também no celular (a regra global que vira 1 coluna não pega classes)
  assert.match(t, /\.pg-grade \{ display: grid; grid-template-columns: repeat\(auto-fill, minmax\(104px, 1fr\)\) !important/);
  assert.match(t, /@media \(max-width: 420px\) \{ \.pg-grade \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important/);
  assert.match(t, /background: linear-gradient\(160deg,#0b1f4d 0%,#123a8a 100%\); border: 1px solid #2f5fd0/, "azul premium");
});

test("8) PAIIA Voz liga a Galeria com barra fixa, login simples e volta à etapa; fotos ficam na ficha", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const bloco = t.slice(t.indexOf("<GaleriaSeletor"), t.indexOf("/>", t.indexOf("<GaleriaSeletor")));
  for (const p of ["barraFixa", "fecharAoUsar", "onEntrar={entrarParaGaleria}", "userId={usuario?.id}"]) assert.ok(bloco.includes(p), p);
  assert.ok(t.includes('marcarRetornoAposLogin({ tela: "paiiaVoz", abrirGaleria: true })') && t.includes('setScreen?.("login")'));
  assert.ok(t.includes("consumirAbrirGaleria()"), "reabre a Galeria ao voltar logado");
  assert.ok(t.includes("guarda.adicionar(fichaRef.current.id"), "as fotos escolhidas vão para a ficha (guardadas neste aparelho)");
});

test("9) Novo Anúncio continua igual (sem barra fixa nem login novo)", () => {
  const t = ler("src/components/NovoAnuncio.jsx");
  const bloco = t.slice(t.indexOf("<GaleriaSeletor"), t.indexOf("/>", t.indexOf("<GaleriaSeletor")));
  assert.ok(!bloco.includes("barraFixa") && !bloco.includes("onEntrar"));
});
