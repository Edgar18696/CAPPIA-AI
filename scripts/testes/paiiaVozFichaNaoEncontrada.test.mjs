// PAIIA Voz — Passo 7: ficha do rascunho não encontrada na conta; "Ler de novo" com resultado claro.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { diagnosticarFichaVoz, textoDiagnostico } from "../../src/modules/paiiaVoz/servicos/localizarFichaVoz.js";

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const OUTRA = "bbbbbbbb-0000-4000-8000-000000000002";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const U = { id: "u1", email: "comercial@exemplo.com" };
const deps = (o = {}) => ({ usuarioAtual: async () => U, lerFicha: async () => ({ ok: false, naoEncontrada: true }), listarPorCodigo: async () => ({ ok: true, anuncios: [] }), ...o });

test("1) sem login ativo: diz que é a sessão (a leitura sem login parecia 'não encontrada')", async () => {
  const d = await diagnosticarFichaVoz({ fichaId: ID, codigo: "173373897R" }, deps({ usuarioAtual: async () => null }));
  assert.equal(d.estado, "sessao");
  assert.match(textoDiagnostico(d), /login ativo.*rascunho e as fotos continuam/);
});

test("2) ficha existe: encontrada", async () => {
  const d = await diagnosticarFichaVoz({ fichaId: ID }, deps({ lerFicha: async () => ({ ok: true, ficha: { id: ID } }) }));
  assert.equal(d.estado, "encontrada");
});

test("3) não encontrada: mostra a conta, a ficha e as fichas DESTA conta com o mesmo código (sem publicadas)", async () => {
  const anuncios = [
    { id: OUTRA, titulo: "Sensor", status_fluxo: "rascunho", updated_at: "2026-11-07" },
    { id: "cccccccc-0000-4000-8000-000000000003", status_fluxo: "publicado", publicacao: { mlb_id: "MLB1" } },
    { id: ID, status_fluxo: "rascunho" },
  ];
  const d = await diagnosticarFichaVoz({ fichaId: ID, codigo: "173373897R" }, deps({ listarPorCodigo: async (c) => { assert.equal(c, "173373897R"); return { ok: true, anuncios }; } }));
  assert.equal(d.estado, "nao-encontrada");
  assert.deepEqual(d.candidatas.map((c) => c.id), [OUTRA], "só a ficha não publicada e diferente da procurada");
  const t = textoDiagnostico(d);
  assert.ok(t.includes("aaaaaaaa") && t.includes("comercial@exemplo.com") && t.includes("1 ficha(s) com o mesmo código"), t);
});

test("4) falha na consulta: erro com a mensagem, nada alterado", async () => {
  const d = await diagnosticarFichaVoz({ fichaId: ID }, deps({ lerFicha: async () => ({ ok: false, erro: "JWT expired" }) }));
  assert.equal(d.estado, "erro");
  assert.match(textoDiagnostico(d), /JWT expired.*Nada foi alterado/);
});

test("5) tela: 'Ler de novo' mostra o resultado; reaproveita ficha do mesmo código antes de oferecer criar; criar pede confirmação", () => {
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(f.includes("onClick={lerDeNovo}") && f.includes('data-pv-diagnostico={diag.d.estado}') && f.includes("⏳ Lendo a conta…"));
  assert.ok(f.indexOf("diag.d.candidatas.map") < f.indexOf("data-pv-criar-ficha-conta") && f.includes("{!diag.d.candidatas.length && ("), "criar só quando não há ficha com o mesmo código");
  assert.ok(f.includes("window.confirm(`Criar a ficha nesta conta"));
  const r = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  const fn = r.slice(r.indexOf("function trocarFichaDaConta(id)"), r.indexOf("// (Passo 7) Abre a Publicação da MESMA ficha"));
  assert.ok(fn.includes("guardarFichaVoz(nova)") && fn.includes("sincronizar()") && !/guarda\.remover|faxina|removerFicha|localStorage\.removeItem/.test(fn), "rascunho e fotos preservados");
});
