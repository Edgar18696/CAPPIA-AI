// =============================================================
// (08/11) Publicação: tela liberada assim que o ML confirma o MLB; conferências (ativo,
// estoque, vínculo no Bling) em segundo plano pela FICHA; pendências na Central;
// PAIIA Voz abre limpo depois de publicar (a ficha anterior fica salva).
//   node --test scripts/testes/publicacaoSegundoPlano.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";

register("./simulacao/ganchoSupabaseFalso.mjs", import.meta.url);

const F = await import("./simulacao/supabaseFalso.mjs");
const P = await import("../../src/services/posPublicacao.js");
const S = await import("../../src/services/posPublicacaoService.js");
const C = await import("../../src/services/fichasCentral.js");
const V = await import("../../src/modules/paiiaVoz/servicos/limpezaPosPublicacaoVoz.js");
const FV = await import("../../src/modules/paiiaVoz/servicos/fichaVoz.js");
const { executarPiloto } = await import("../../src/services/pilotoPublicacao.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// ---- Supabase falso: filtro por caminho JSON e update que devolve as linhas (trava por updated_at) ----
function caminho(l, expr) {
  const partes = expr.split(/(->>|->)/);
  let v = l?.[partes[0]];
  for (let i = 1; i < partes.length; i += 2) { v = v == null ? null : v[partes[i + 1]]; if (partes[i] === "->>" && v != null) v = typeof v === "object" ? JSON.stringify(v) : String(v); }
  return v;
}
const fromOriginal = F.supabase.from;
F.supabase.from = (t) => {
  const q = fromOriginal(t);
  const eq0 = q.eq.bind(q);
  q.eq = (k, v) => { if (k.includes("->")) { q.filtros.push((l) => String(caminho(l, k)) === String(v)); return q; } return eq0(k, v); };
  const ex0 = q.executar.bind(q);
  q.executar = async () => {
    if (q.op === "update" && q.retornar) {
      const alvo = F.banco.tabelas[q.tabela].filter((l) => q.filtros.every((f) => f(l))).map((l) => ({ id: l.id }));
      const r = await ex0();
      return { data: r.error ? null : alvo, error: r.error };
    }
    return ex0();
  };
  return q;
};
// Funções do servidor (ML/Bling) simuladas, com registro de TUDO o que foi chamado.
let respostas = {};
F.supabase.functions.invoke = async (nome, op) => {
  F.banco.funcoes.push({ nome, corpo: op?.body });
  const r = respostas[nome];
  if (typeof r === "function") return r(op?.body);
  return { data: r ?? { ok: false, erro: "sem resposta" }, error: null };
};

const MLB = "MLB5530013453";
const CONTA = "1729335019"; // LOJA ONLINE (vínculo automático com o Bling)
function fichaPublicada({ id = "a1", quantidade = 3 } = {}) {
  F.banco.tabelas.paiia_anuncios.push({ id, codigo: "IWP211", status_fluxo: "publicado", updated_at: "2026-11-08T10:00:00.000Z", dados_conferencia: { paiia_voz: { campos: { preco: 10 } } } });
  F.banco.tabelas.paiia_anuncios_publicacoes.push({ anuncio_id: id, mlb_id: MLB, ml_user_id: CONTA, bling_produto_id: "999", status_publicacao: "publicado", sku: "IWP211" });
  return { id, quantidade };
}
const linha = (id = "a1") => F.banco.tabelas.paiia_anuncios.find((l) => l.id === id);
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const blingIntegrado = () => ({ ok: true, id_loja: "204883484", anuncios: [{ mlb: MLB, produto_id: "999", id_anuncio: "77" }] });
const proibidas = (f) => /publicar|criar|cadastr|vincular|alterar|estoque_|atualizar/i.test(`${f.corpo?.acao || ""}`);

test("1) conferência só marca OK com a confirmação real: ML ativo + estoque igual + Bling integrado → concluído", async () => {
  const reg = P.iniciarRegistroPos({ mlb: MLB, conta: CONTA, quantidade: 3, agora: 0 });
  assert.equal(reg.concluido, false);
  assert.deepEqual(P.CONFERENCIAS.map((c) => reg[c].estado), ["pendente", "pendente", "pendente"]);
  const r = await P.rodadaPosPublicacao(reg, { agora: 1000, consultarItem: async () => ({ status: "active", available_quantity: 3 }), conferirVinculo: async () => ({ estado: "ok", texto: "Integrado." }) });
  assert.equal(r.registro.concluido, true);
  assert.equal(P.pendenciaPos(r.registro), "");
  // ML ainda processando fotos: continua pendente (não vira "ok" antes da hora)
  const r2 = await P.rodadaPosPublicacao(reg, { agora: 1000, consultarItem: async () => ({ status: "paused", sub_status: ["picture_download_pending"], available_quantity: 3 }), conferirVinculo: async () => ({ estado: "pendente", texto: "Ainda não apareceu no Bling." }) });
  assert.equal(r2.registro.concluido, false);
  assert.equal(r2.registro.ativo.estado, "pendente");
  assert.equal(r2.registro.vinculo.estado, "pendente");
  assert.ok(Date.parse(r2.registro.proxima_em) > 1000, "nova tentativa agendada");
});

test("2) falha no Bling: pendência registrada, nova tentativa automática com intervalo crescente; depois de 48 h para (pendência fica)", async () => {
  let reg = P.iniciarRegistroPos({ mlb: MLB, conta: CONTA, quantidade: 3, agora: 0 });
  const falhaBling = { consultarItem: async () => ({ status: "active", available_quantity: 3 }), conferirVinculo: async () => { throw new Error("Bling fora do ar"); } };
  const r = await P.rodadaPosPublicacao(reg, { ...falhaBling, agora: 0 });
  reg = r.registro;
  assert.equal(reg.vinculo.estado, "erro");
  assert.match(P.pendenciaPos(reg), /Vínculo no Bling: Não consegui consultar o Bling \(Bling fora do ar\)/);
  assert.equal(reg.ativo.estado, "ok", "o que foi confirmado fica confirmado");
  const i1 = Date.parse(reg.proxima_em);
  const r2 = await P.rodadaPosPublicacao(reg, { ...falhaBling, agora: i1 });
  assert.ok(Date.parse(r2.registro.proxima_em) - i1 > i1 - 0, "intervalo cresce");
  // passa do limite de 48 h: para de tentar sozinho, mas a pendência continua visível
  const r3 = await P.rodadaPosPublicacao({ ...r2.registro, iniciado_em: new Date(0).toISOString() }, { ...falhaBling, agora: 48 * 3600_000 });
  assert.equal(r3.registro.desistiu, true);
  assert.equal(P.devidaAgora(r3.registro, Date.now()), false);
  assert.match(P.pendenciaPos(r3.registro), /confira manualmente/);
  // estoque diferente da ficha: erro (nunca "ok")
  assert.equal(P.avaliarEstoque({ available_quantity: 1 }, 3).estado, "erro");
});

test("3) em segundo plano pela FICHA (fechou a tela / outro aparelho): registra, confere no servidor do ML/Bling, grava e conclui — só leitura, nada duplicado", async () => {
  F.zerarBanco();
  const { id } = fichaPublicada();
  const reg = await S.registrarPosPublicacao({ anuncioId: id, mlb: MLB, conta: CONTA, sku: "IWP211", quantidade: 3 });
  assert.equal(reg.ok, true, JSON.stringify(reg));
  assert.equal((await S.registrarPosPublicacao({ anuncioId: id, mlb: MLB, conta: CONTA })).jaExistia, true, "registrar de novo não duplica");
  assert.equal(linha(id).dados_conferencia.pos_publicacao.concluido, false);
  assert.ok(linha(id).dados_conferencia.paiia_voz, "o resto da ficha fica intacto");

  // 1ª rodada: Bling ainda não trouxe → pendente (Central mostra)
  respostas = { "mercadolivre-publicacao": { ok: true, status: "active", available_quantity: 3 }, "bling-integracao": { ok: true, id_loja: "204883484", anuncios: [] } };
  const r1 = await S.processarPosPendentes({ agora: Date.now() + 1000 });
  assert.equal(r1.feitas.length, 1, JSON.stringify(r1));
  const pos1 = linha(id).dados_conferencia.pos_publicacao;
  assert.equal(pos1.ativo.estado, "ok");
  assert.equal(pos1.estoque.estado, "ok");
  assert.equal(pos1.vinculo.estado, "pendente");
  assert.equal(linha(id).dados_conferencia.integracao_bling.estado, "aguardando_importacao");
  // antes da hora: não roda de novo
  assert.equal((await S.processarPosPendentes({ agora: Date.now() + 2000 })).feitas.length, 0);
  // 2ª rodada (na hora): Bling integrado → concluído
  respostas["bling-integracao"] = blingIntegrado();
  await S.processarPosPendentes({ agora: Date.parse(pos1.proxima_em) + 1 });
  const pos2 = linha(id).dados_conferencia.pos_publicacao;
  assert.equal(pos2.concluido, true, JSON.stringify(pos2));
  assert.equal(linha(id).dados_conferencia.integracao_bling.estado, "integrado");
  // concluída: sai da lista
  assert.equal((await S.listarPosPendentes()).fichas.length, 0);
  // SÓ LEITURA: nenhuma publicação, cadastro ou vínculo foi pedido ao ML/Bling
  assert.ok(F.banco.funcoes.length >= 3);
  assert.deepEqual(F.banco.funcoes.filter(proibidas), [], JSON.stringify(F.banco.funcoes));
  assert.ok(F.banco.funcoes.every((f) => (f.nome === "mercadolivre-publicacao" && f.corpo.acao === "consultar_item") || (f.nome === "bling-integracao" && /^anuncios_(consultar|buscar_mlb)$/.test(f.corpo.acao))));
  assert.ok(!F.banco.chamadas.some((c) => c.op === "insert" || c.op === "delete"), "nenhuma ficha ou publicação criada/apagada");
});

test("4) falha simulada no Bling (servidor): pendência na ficha e na Central de Publicação; tenta de novo depois", async () => {
  F.zerarBanco();
  const { id } = fichaPublicada();
  await S.registrarPosPublicacao({ anuncioId: id, mlb: MLB, conta: CONTA, quantidade: 3 });
  respostas = { "mercadolivre-publicacao": { ok: true, status: "active", available_quantity: 3 }, "bling-integracao": () => ({ data: null, error: { message: "Bling 503" } }) };
  await S.processarPosPendentes({ agora: Date.now() + 1000 });
  const pos = linha(id).dados_conferencia.pos_publicacao;
  assert.equal(pos.vinculo.estado, "erro");
  assert.equal(pos.concluido, false);
  assert.ok(pos.proxima_em, "nova tentativa agendada");
  // Central: lê pos_publicacao e mostra a pendência
  assert.ok(ler("src/services/fichasCentralService.js").includes("pos_publicacao:dados_conferencia->pos_publicacao"));
  const resumo = C.resumoFichaCentral({ id, codigo: "IWP211", status_fluxo: "publicado", publicacao: { mlb_id: MLB, ml_user_id: CONTA, bling_produto_id: "999" }, integracao_bling: linha(id).dados_conferencia.integracao_bling, pos_publicacao: pos });
  assert.equal(resumo.estado, "aguardando_bling");
  assert.match(resumo.pendencia, /Vínculo no Bling/);
  // ficha não publicada nunca mostra pendência de pós-publicação
  assert.equal(C.resumoFichaCentral({ id: "x", status_fluxo: "rascunho", pos_publicacao: pos }).pendencia, "");
});

test("5) piloto: publica UMA vez, avisa 'publicado' e, liberada a tela (Criar Próximo/Fechar), para de esperar sem repetir nada", async () => {
  const st = { cliques: [], consultas: 0, resultado: null, encerrado: false, registrou: 0 };
  const el = (attrs = {}, texto = "") => ({ disabled: false, checked: false, attrs, texto, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a] ?? null, querySelector: () => null });
  const p = {
    achar(sel) {
      if (sel.includes("data-paiia-revisao-ml")) return el();
      if (sel.includes("data-paiia-bling-estoque")) return el({ "data-paiia-bling-estoque": "" });
      if (sel === "[data-paiia-publicar-ml]") return st.resultado ? null : el({ "data-paiia-publicar-ml": "" });
      if (sel === "[data-paiia-resultado-publicacao]") return st.resultado;
      return null;
    },
    clicar(e) { st.cliques.push(Object.keys(e.attrs)[0]); if ("data-paiia-publicar-ml" in e.attrs) st.resultado = el({ "data-paiia-resultado-publicacao": "publicado" }, `✅ PUBLICADO: ${MLB}`); },
    texto: (e) => e?.texto || "",
    esperar: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    progresso: () => {},
    publicado: async () => { st.registrou += 1; st.encerrado = true; }, // usuário toca em "Criar Próximo Anúncio" logo após
    encerrado: () => st.encerrado,
    consultarItem: async () => { st.consultas += 1; return { status: "paused" }; },
    relerIntegracao: async () => "aguardando_importacao",
  };
  const r = await executarPiloto(p, { limites: { passo: 300, intervalo: 10, estavel: 3, ativo: 60_000, vinculo: 60_000, intervaloML: 20 } });
  assert.equal(r.ok, true);
  assert.equal(r.segundoPlano, true);
  assert.equal(r.mlb, MLB);
  assert.equal(st.registrou, 1);
  assert.equal(st.consultas, 0, "não ficou esperando o ML ativar nesta tela");
  assert.equal(st.cliques.filter((c) => c === "data-paiia-publicar-ml").length, 1, "publicou UMA vez");
  // encerrado ANTES do MLB não interrompe a publicação (só vale depois do MLB)
  const piloto = ler("src/services/pilotoPublicacao.js");
  // (09/11) no MEIO do envio (entre o toque em Publicar e a resposta do ML) nunca interrompe
  assert.ok(piloto.includes("const encerrado = () => !enviando && Boolean(p.encerrado?.());"));
});

test("6) tela da publicação: 'Anúncio Publicado Com Sucesso' + Criar Próximo Anúncio + Fechar; registra as conferências na ficha", () => {
  const t = ler("src/components/PilotoAutomaticoPublicacao.jsx");
  assert.ok(t.includes("✅ Anúncio Publicado Com Sucesso"));
  assert.ok(t.includes("data-paiia-criar-proximo") && t.includes("＋ Criar Próximo Anúncio") && t.includes("data-paiia-fechar-piloto") && t.includes(">Fechar<"));
  assert.ok(t.includes("registrarPosPublicacao({ anuncioId: d.anuncioId, mlb: pub.mlb"));
  assert.ok(t.includes("marcarFichaPublicada(d.anuncioId, pub.mlb)"));
  assert.ok(!t.includes("✅ ESTOQUE CONFERIDO</div>"), "estoque não aparece conferido sem conferência real");
  const ml = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(ml.includes("anuncioId={anuncioIdPAIIA}") && ml.includes('setScreen?.("paiiaVoz")'));
  const app = ler("src/App.jsx");
  assert.ok(app.includes("<ConferenciasSegundoPlano userId={usuario?.id} />"), "roda em qualquer tela do PAIIA");
  const runner = ler("src/components/ConferenciasSegundoPlano.jsx");
  assert.ok(runner.includes("processarPosPendentes") && runner.includes("visibilitychange"));
});

test("7) PAIIA Voz: publicou → abre limpo; a ficha anterior fica salva (histórico) e nada é apagado; não publicada continua", () => {
  const s = memoria();
  const antiga = { ...FV.criarFichaVoz({ agora: 1 }), fichaIdPAIIA: "a1", enviadaEm: 5, codigos: [{ codigo: "IWP211", principal: true }], aplicacoes: [{ id: "x" }], campos: { preco: { valor: 10 } } };
  FV.guardarFichaVoz(antiga, s);
  s.setItem(FV.CHAVE_COMPLEMENTO_VOZ, JSON.stringify({ codigo: "IWP211" }));
  // sem confirmação de publicação: nada muda (rascunho preservado)
  let a = V.abrirFichaVoz({ storage: s });
  assert.equal(a.ficha.id, antiga.id);
  assert.equal(a.aviso, "");
  // publicação confirmada (marca gravada só depois do MLB): abre limpo
  P.marcarFichaPublicada("a1", MLB, { storage: s });
  a = V.abrirFichaVoz({ storage: s, agora: 9 });
  assert.equal(a.limpou, true);
  assert.notEqual(a.ficha.id, antiga.id);
  assert.ok(FV.fichaVazia(a.ficha) && !a.ficha.fichaIdPAIIA && !a.ficha.enviadaEm, "ficha nova e vazia");
  assert.match(a.aviso, /IWP211.*MLB5530013453.*salva/);
  assert.equal(FV.lerFichaVoz(s).id, a.ficha.id, "a nova já fica guardada");
  assert.equal(s.getItem(FV.CHAVE_COMPLEMENTO_VOZ), null, "dados temporários da peça anterior limpos");
  const hist = JSON.parse(s.getItem(P.CHAVE_VOZ_HISTORICO));
  assert.equal(hist[0].id, antiga.id);
  assert.equal(hist[0].mlb, MLB);
  assert.deepEqual(hist[0].codigos, antiga.codigos, "códigos, aplicações e preço preservados");
  // reabrir de novo: continua a nova (não limpa o que está em andamento)
  assert.equal(V.abrirFichaVoz({ storage: s }).ficha.id, a.ficha.id);
  // o Voz não apaga fotos nem a ficha da conta na limpeza
  const voz = ler("src/modules/paiiaVoz/servicos/limpezaPosPublicacaoVoz.js");
  assert.ok(!/limparFicha|excluir|delete\(/.test(voz));
});

test("8) PAIIA Voz: publicada em OUTRO aparelho → confere na conta (só leitura) e limpa; erro de leitura ou não publicada → mantém", async () => {
  const s = memoria();
  const f = { ...FV.criarFichaVoz(), fichaIdPAIIA: "a2", enviadaEm: 5 };
  assert.equal(await V.conferirPublicadaNaConta(f, { storage: s, lerFicha: async () => ({ ok: true, ficha: { publicacao: { mlb_id: MLB } } }) }), MLB);
  assert.ok(P.publicacaoDaFicha("a2", { storage: s }));
  assert.equal(await V.conferirPublicadaNaConta({ ...f, fichaIdPAIIA: "a3" }, { storage: s, lerFicha: async () => { throw new Error("offline"); } }), "");
  assert.equal(await V.conferirPublicadaNaConta({ ...f, fichaIdPAIIA: "a4" }, { storage: s, lerFicha: async () => ({ ok: true, ficha: { publicacao: null } }) }), "");
  assert.equal(await V.conferirPublicadaNaConta({ ...f, enviadaEm: undefined, fichaIdPAIIA: "a5" }, { storage: s, lerFicha: async () => assert.fail("não deve ler ficha não enviada") }), "");
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes("useState(() => abrirFichaVoz())"));
  assert.ok(t.includes("conferirPublicadaNaConta(atual, { lerFicha: lerFichaNovoAnuncio })"));
  assert.ok(t.includes('data-pv-nova-limpa'), "o botão continua para quem quiser");
});
