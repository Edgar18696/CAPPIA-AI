// =============================================================
// (09/11) Liberar o próximo anúncio: (1) produto JÁ cadastrado no Bling pela ficha é
// reconhecido (sem oferecer criar de novo) e o piloto segue; (2) publicação pausada ou
// pendente → "Salvar e Criar Próximo Anúncio": a ficha fica salva (conta + aparelho),
// NÃO é marcada publicada e nada é enviado ao Mercado Livre sem nova autorização.
//   Cenário A: publicação concluída → ficha salva → PAIIA Voz limpo.
//   Cenário B: publicação pausada → ficha salva → outra peça sem perder a anterior.
//   node --test scripts/testes/liberarProximoAnuncio.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const B = await import("../../src/services/blingRegistrado.js");
const { executarPiloto } = await import("../../src/services/pilotoPublicacao.js");
const V = await import("../../src/modules/paiiaVoz/servicos/limpezaPosPublicacaoVoz.js");
const FV = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const P = await import("../../src/services/posPublicacao.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const ID_CONTA = "11111111-2222-4333-8444-000000000093";
function fichaCompleta(extra = {}) {
  const f = FV.criarFichaVoz({ agora: 1 });
  return {
    ...f,
    codigos: [{ codigo: "93226612", normalizado: "93226612", principal: true }],
    aplicacoes: [{ montadora: "GM", modelo: "Corsa", ano: "2005" }],
    campos: { ...(f.campos || {}), preco: { valor: 149.9 }, descricao: { valor: "Descrição da peça" } },
    fichaIdPAIIA: ID_CONTA,
    enviadaEm: 2,
    enviadaPara: "publicacao",
    ...extra,
  };
}

test("1) Bling: produto já cadastrado pela ficha é reconhecido mesmo se a busca do Bling ainda não o devolve", () => {
  const naoAchou = { ok: true, encontrado: false };
  const r = B.leituraComCadastroRegistrado(naoAchou, { blingProdutoId: 16609912345, sku: "93226612" });
  assert.equal(r.encontrado, true);
  assert.equal(r.registradoNaFicha, true);
  assert.equal(r.produto.id, 16609912345);
  assert.equal(r.produto.codigo, "93226612");
  assert.match(r.mensagem, /nada será criado de novo/);
  // achou de verdade: usa a leitura real
  const achou = { ok: true, encontrado: true, produto: { id: 9, codigo: "93226612", nome: "X" }, saldoFisicoTotal: 2 };
  assert.equal(B.leituraComCadastroRegistrado(achou, { blingProdutoId: 1 }), achou);
  // erro de leitura, mais de um produto, ou ficha sem cadastro registrado: nada muda
  const erro = { ok: false, erro: "Bling fora" };
  assert.equal(B.leituraComCadastroRegistrado(erro, { blingProdutoId: 1 }), erro);
  const amb = { ok: true, ambiguo: true };
  assert.equal(B.leituraComCadastroRegistrado(amb, { blingProdutoId: 1 }), amb);
  assert.equal(B.leituraComCadastroRegistrado(naoAchou, {}), naoAchou);
  // registro da publicação (objeto ou lista)
  assert.equal(B.blingIdDaPublicacao({ bling_produto_id: 5 }), 5);
  assert.equal(B.blingIdDaPublicacao([{ marketplace: "shopee", bling_produto_id: 7 }, { marketplace: "mercado_livre", bling_produto_id: 6 }]), 6);
  assert.equal(B.blingIdDaPublicacao(null), null);
});

test("2) Bling: depois de criar, relê algumas vezes até o Bling devolver o produto (sem criar de novo)", async () => {
  let n = 0;
  const ler2 = async () => { n += 1; return n < 3 ? { ok: true, encontrado: false } : { ok: true, encontrado: true, produto: { id: 1 } }; };
  const r = await B.lerAteEncontrar(ler2, { tentativas: 4, esperar: async () => {} });
  assert.equal(r.encontrado, true);
  assert.equal(n, 3);
  n = 0;
  const nunca = async () => { n += 1; return { ok: true, encontrado: false }; };
  const r2 = await B.lerAteEncontrar(nunca, { tentativas: 3, esperar: async () => {} });
  assert.equal(r2.encontrado, false);
  assert.equal(n, 3, "para depois das tentativas");
});

// ---- Piloto com tela falsa ----
const el = (attrs = {}, texto = "") => ({ disabled: false, checked: false, attrs, texto, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null, querySelector: () => null });
function telaFalsa({ blingRegistrado = true, liberarEm = "", publicarFalha = false } = {}) {
  const st = { cliques: [], resultado: null, encerrado: false, etapas: [] };
  const p = {
    achar(sel) {
      if (sel.includes("data-paiia-revisao-ml")) return el();
      // produto JÁ cadastrado (registrado na ficha): bloco "encontrado", sem o botão de criar
      if (sel.includes("data-paiia-bling-estoque")) return blingRegistrado ? el({ "data-paiia-bling-estoque": "" }) : null;
      if (sel === "[data-paiia-bling-estado]") return el({ "data-paiia-bling-estado": blingRegistrado ? "encontrado" : "nao-encontrado" });
      if (sel === "[data-paiia-abrir-criar-bling]") return blingRegistrado ? null : el({ "data-paiia-abrir-criar-bling": "" });
      if (sel === "[data-paiia-confirmar-quantidade]") return el({ "data-paiia-confirmar-quantidade": "" });
      if (sel === "[data-paiia-publicar-ml]") return st.resultado ? null : el({ "data-paiia-publicar-ml": "" });
      if (sel === "[data-paiia-resultado-publicacao]") return st.resultado;
      return null;
    },
    clicar(e) {
      const k = Object.keys(e.attrs)[0];
      st.cliques.push(k);
      if (k === "data-paiia-publicar-ml" && st.cliques.filter((c) => c === k).length === 2) {
        if (liberarEm === "publicando") st.encerrado = true; // toque no meio do envio: NÃO pode interromper
        st.resultado = publicarFalha ? el({ "data-paiia-resultado-publicacao": "erro" }, "❌ O ML recusou") : el({ "data-paiia-resultado-publicacao": "publicado" }, "✅ PUBLICADO: MLB5599001122");
      }
    },
    texto: (e) => e?.texto || "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: (etapa) => { st.etapas.push(etapa); if (etapa === liberarEm) st.encerrado = true; },
    publicado: async () => {},
    encerrado: () => st.encerrado,
    consultarItem: async () => ({ status: "active" }),
    relerIntegracao: async () => "integrado",
  };
  return { p, st };
}
const LIM = { limites: { passo: 200, intervalo: 5, estavel: 3, ativo: 2000, vinculo: 2000, intervaloML: 5 } };

test("3) Retomada: produto já no Bling → piloto NÃO cria de novo, segue e publica UMA vez", async () => {
  const { p, st } = telaFalsa({ blingRegistrado: true });
  const r = await executarPiloto(p, LIM);
  assert.equal(r.ok, true);
  assert.equal(r.mlb, "MLB5599001122");
  assert.ok(!st.cliques.includes("data-paiia-abrir-criar-bling"), "não abriu o cadastro no Bling");
  assert.equal(st.cliques.filter((c) => c === "data-paiia-publicar-ml").length, 2, "1 publicação (autorizar + confirmar)");
});

test("4) 'Salvar e Criar Próximo' ANTES do envio: o piloto para na hora e nada vai ao Mercado Livre", async () => {
  for (const etapa of ["bling", "quantidade", "validar"]) {
    const { p, st } = telaFalsa({ liberarEm: etapa });
    const r = await executarPiloto(p, LIM);
    assert.equal(r.ok, false, etapa);
    assert.equal(r.liberado, true, etapa);
    assert.match(r.texto, /nada foi enviado ao Mercado Livre/);
    assert.ok(!st.cliques.includes("data-paiia-publicar-ml"), `${etapa}: não tocou em Publicar`);
  }
  // no MEIO do envio (toques já dados) não interrompe: espera o resultado do ML
  const { p, st } = telaFalsa({ liberarEm: "publicando" });
  const r = await executarPiloto(p, LIM);
  assert.equal(r.ok, true);
  assert.equal(r.mlb, "MLB5599001122");
  assert.equal(st.cliques.filter((c) => c === "data-paiia-publicar-ml").length, 2);
});

test("5) Cenário B: publicação pausada → ficha salva → outra peça, sem perder a anterior e SEM marcar publicada", () => {
  const s = memoria();
  const anterior = fichaCompleta();
  FV.guardarFichaVoz(anterior, s);
  s.setItem(FV.CHAVE_COMPLEMENTO_VOZ, JSON.stringify({ temporario: true }));
  // o botão da Publicação marca a ficha da conta como liberada; o Voz abre limpo
  assert.equal(V.marcarFichaLiberada(ID_CONTA, { storage: s }), true);
  const ab = V.abrirFichaVoz({ storage: s, agora: 10 });
  assert.equal(ab.limpou, true);
  assert.equal(ab.liberou, true);
  assert.notEqual(ab.ficha.id, anterior.id);
  assert.equal(ab.ficha.codigos.length, 0, "ficha nova vazia");
  assert.match(ab.aviso, /93226612/);
  assert.match(ab.aviso, /publicação pendente/);
  assert.match(ab.aviso, /Central de Publicação/);
  // a anterior continua inteira em "Fichas guardadas" (pode ser reaberta)
  const g = FV.listarFichasGuardadas(s).find((f) => f.id === anterior.id);
  assert.ok(g, "anterior guardada");
  assert.equal(g.codigos[0].codigo, "93226612");
  assert.equal(g.aplicacoes.length, 1);
  assert.equal(g.campos.descricao.valor, "Descrição da peça");
  assert.equal(g.fichaIdPAIIA, ID_CONTA);
  // NÃO marcada como publicada; temporário limpo; marca consumida (reabrir a guardada não limpa de novo)
  assert.equal(P.publicacaoDaFicha(ID_CONTA, { storage: s }), null);
  assert.equal(s.getItem(FV.CHAVE_COMPLEMENTO_VOZ), null);
  assert.equal(V.fichaLiberada(ID_CONTA, { storage: s }), false);
  FV.guardarFichaVoz(FV.retirarDaListaVoz(anterior.id, s), s);
  assert.equal(V.abrirFichaVoz({ storage: s }).ficha.id, anterior.id, "reaberta continua aberta");
});

test("6) Botão do Voz 'Salvar e Criar Próximo Anúncio': só com a ficha SALVA na conta; não salva = não troca", () => {
  const s = memoria();
  const r = V.liberarFichaPendente(fichaCompleta(), { storage: s, agora: 5 });
  assert.equal(r.ok, true);
  assert.equal(r.nova.codigos.length, 0);
  assert.equal(FV.lerFichaVoz(s).id, r.nova.id);
  assert.equal(FV.listarFichasGuardadas(s).length, 1);
  const naoSalva = V.liberarFichaPendente(fichaCompleta({ fichaIdPAIIA: "", enviadaEm: null }), { storage: memoria() });
  assert.equal(naoSalva.ok, false);
  assert.match(naoSalva.motivo, /ainda não está salva/);
  // marcada liberada mas sem estar salva na conta: o Voz NÃO troca (nada se perde)
  const s2 = memoria();
  FV.guardarFichaVoz(fichaCompleta({ enviadaEm: null }), s2);
  V.marcarFichaLiberada(ID_CONTA, { storage: s2 });
  assert.equal(V.abrirFichaVoz({ storage: s2 }).limpou, undefined);
});

test("7) Cenário A: publicação concluída → ficha salva → Voz limpo (continua como antes)", () => {
  const s = memoria();
  const anterior = fichaCompleta();
  FV.guardarFichaVoz(anterior, s);
  P.marcarFichaPublicada(ID_CONTA, "MLB5599001122", { storage: s });
  const ab = V.abrirFichaVoz({ storage: s });
  assert.equal(ab.limpou, true);
  assert.match(ab.aviso, /foi publicada \(MLB5599001122\)/);
  const hist = JSON.parse(s.getItem(P.CHAVE_VOZ_HISTORICO));
  assert.equal(hist[0].codigos[0].codigo, "93226612");
});

test("8) Telas: botão na pausa e antes do envio (nunca no envio); Voz com o botão na ficha enviada; Bling usa o cadastro registrado", () => {
  const t = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.match(t, /data-paiia-salvar-proximo/);
  assert.match(t, /💾 Salvar e Criar Próximo Anúncio/);
  assert.match(t, /marcarFichaLiberada\(/);
  assert.match(t, /st\.etapa !== "publicar"/);
  const voz = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.match(voz, /data-pv-salvar-proximo/);
  assert.match(voz, /liberarFichaPendente\(/);
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /leituraComCadastroRegistrado\(/);
  assert.match(rev, /lerAteEncontrar\(/);
  assert.match(rev, /data-paiia-bling-registrado/);
});
