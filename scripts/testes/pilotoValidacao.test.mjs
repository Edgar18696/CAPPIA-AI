// Piloto (13/11 — "publicar primeiro, conferir depois"): sem pré-validação repetida; "publicado" só com o
// MLB confirmado pelo ML; ativação e vínculo seguem depois como avisos (nunca como falso sucesso).
import test from "node:test";
import assert from "node:assert/strict";
import { executarPiloto } from "../../src/services/pilotoPublicacao.js";

function tela({ publicar = "ok", ativo = true, vinculo = true } = {}) {
  const st = { cliques: [], publicadoAvisadoAntesDoAtivo: null, consultas: 0, resultado: null };
  const el = (attrs = {}, texto = "") => ({ disabled: false, checked: false, attrs, texto, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null, querySelector: () => (attrs.link ? { href: attrs.link } : null) });
  const p = {
    achar(sel) {
      if (sel.includes("data-paiia-revisao-ml")) return el();
      if (sel.includes("data-paiia-bling-estoque")) return el({ "data-paiia-bling-estoque": "" });
      if (sel.includes("data-paiia-quantidade-estado")) return el();
      if (sel === "[data-paiia-publicar-ml]") return st.resultado ? null : el({ "data-paiia-publicar-ml": "" });
      if (sel === "[data-paiia-resultado-publicacao]") return st.resultado;
      return null;
    },
    clicar(e) {
      st.cliques.push(Object.keys(e.attrs)[0]);
      if ("data-paiia-publicar-ml" in e.attrs) st.resultado = publicar === "ok"
        ? el({ "data-paiia-resultado-publicacao": "publicado", link: "https://ml/MLB123456789" }, "✅ PUBLICADO: MLB123456789")
        : el({ "data-paiia-resultado-publicacao": "erro" }, "❌ O Mercado Livre não aceitou os dados do anúncio. Motivo do Mercado Livre: título longo.");
    },
    texto: (e) => e?.texto || "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: () => {},
    publicado: () => { st.publicadoAvisadoAntesDoAtivo = st.consultas === 0; },
    consultarItem: async () => { st.consultas += 1; return { status: ativo ? "active" : "paused", sub_status: ["picture_download_pending"] }; },
    relerIntegracao: async () => (vinculo ? "integrado" : "aguardando_importacao"),
  };
  return { st, p };
}
const L = { passo: 300, intervalo: 10, estavel: 3, ativo: 300, vinculo: 300, intervaloML: 20 };

test("1) sem validação separada: nunca toca em 'Validar'; publica UMA vez; 'publicado' avisado ANTES de conferir a ativação", async () => {
  const { st, p } = tela();
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.mlb, "MLB123456789");
  assert.ok(!st.cliques.includes("data-paiia-validar-ml"));
  assert.equal(st.cliques.filter((c) => c === "data-paiia-publicar-ml").length >= 1, true);
  assert.equal(st.publicadoAvisadoAntesDoAtivo, true);
  assert.equal(r.pendencia, "");
});

test("2) fotos demorando / não ativou no prazo: continua PUBLICADO com aviso para conferir (não pausa, não esconde)", async () => {
  const { p } = tela({ ativo: false });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, true);
  assert.equal(r.ativo, false);
  assert.match(r.pendencia, /ainda não ativou o MLB123456789/);
});

test("3) vínculo do Bling não confirmado: publicado com aviso claro", async () => {
  const { p } = tela({ vinculo: false });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, true);
  assert.equal(r.vinculo, false);
  assert.match(r.pendencia, /vínculo no Bling ainda não confirmado/);
});

test("4) o ML recusa: pausa com o motivo do ML e NUNCA diz 'publicado'", async () => {
  const { p } = tela({ publicar: "erro" });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.ok, false);
  assert.equal(r.etapa, "publicar");
  assert.match(r.texto, /título longo/);
  assert.equal(r.mlb, undefined);
});
