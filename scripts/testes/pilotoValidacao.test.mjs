// Piloto (13/11): validação que demora, que falha uma vez e que falha de verdade — sem esperar à toa.
import test from "node:test";
import assert from "node:assert/strict";
import { executarPiloto } from "../../src/services/pilotoPublicacao.js";

// Tela simulada: elementos por seletor, com estado mutável.
function tela({ validarApos = 0, falhas = 0, erroFixo = "" } = {}) {
  const st = { cliques: [], validacoes: 0, validando: false, resultado: null, agora: 0 };
  const el = (attrs = {}) => ({ disabled: false, checked: false, attrs, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null, querySelector: () => null });
  const validar = el({ "data-paiia-validar-ml": "" });
  const p = {
    achar(sel) {
      if (sel.includes("data-paiia-revisao-ml")) return el();
      if (sel.includes("data-paiia-bling-estoque")) return el({ "data-paiia-bling-estoque": "" });
      if (sel === '[data-paiia-validacao="ok"]') return st.resultado === "ok" ? el() : null;
      if (sel === '[data-paiia-validacao="erro"]') return st.resultado === "erro" ? el({ t: erroFixo || "❌ Tempo esgotado" }) : null;
      if (sel.includes("data-paiia-validando")) return st.validando ? el() : null;
      if (sel.includes("data-paiia-validar-ml")) { validar.disabled = st.validando; return validar; }
      if (sel.includes("data-paiia-autorizo-ml")) return st.resultado === "ok" ? el() : null;
      return null;
    },
    clicar(e) {
      st.cliques.push(e.attrs);
      if ("data-paiia-validar-ml" in e.attrs) { st.validacoes += 1; st.validando = true; st.resultado = null; st.fimValidacao = Date.now() + validarApos; st.falhaAgora = st.validacoes <= falhas; }
    },
    texto: (e) => e?.attrs?.t || "",
    esperar: async (ms) => { await new Promise((ok) => setTimeout(ok, ms)); if (st.validando && Date.now() >= st.fimValidacao) { st.validando = false; st.resultado = st.falhaAgora ? "erro" : "ok"; } },
    progresso: () => {}, consultarItem: async () => ({ status: "active" }), relerIntegracao: async () => "integrado",
  };
  return { st, p };
}
// Tempos reais em escala reduzida: passo 400 ms, validação até 1,5 s.
const L = { passo: 400, intervalo: 20, validacao: 1_500, estavel: 4, ativo: 500, vinculo: 500, intervaloML: 20 };

test("1) validação mais demorada que um passo comum: espera e segue (não pausa à toa)", async () => {
  const { st, p } = tela({ validarApos: 1_000 });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(st.validacoes, 1);
  assert.notEqual(r.etapa, "validar", JSON.stringify(r));
});

test("2) falha passageira: valida de novo UMA vez (só leitura) e segue", async () => {
  const { st, p } = tela({ validarApos: 50, falhas: 1 });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(st.validacoes, 2);
  assert.notEqual(r.etapa, "validar", JSON.stringify(r));
});

test("3) falha persistente: pausa com o motivo do Mercado Livre e 'nada foi enviado'", async () => {
  const { st, p } = tela({ validarApos: 50, falhas: 9, erroFixo: "❌ Conta sem autorização (token vencido)" });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "validar");
  assert.match(r.texto, /token vencido.*Nada foi enviado/);
  assert.equal(st.validacoes, 2);
});

test("4) validação que não termina no limite: pausa com o tempo, sem envio", async () => {
  const { p } = tela({ validarApos: 60_000 });
  const r = await executarPiloto(p, { limites: L });
  assert.equal(r.etapa, "validar");
  assert.match(r.texto, /não terminou a validação em 3 minutos/);
});
