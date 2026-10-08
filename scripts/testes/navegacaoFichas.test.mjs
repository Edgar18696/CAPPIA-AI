// =============================================================
// PAIIA — TESTES: navegação "Voltar" e fichas na Central de Publicação
//   node --test scripts/testes/navegacaoFichas.test.mjs
// Sem rede. Regra: VOLTAR é só navegar — nunca apaga, zera, recria,
// abandona ou perde a ficha; nunca publica de novo.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// localStorage de mentira (o módulo de limpeza usa o global).
class Armazenamento {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
globalThis.localStorage = new Armazenamento();

const {
  ESTADO_CENTRAL, TEXTO_ESTADO_CENTRAL, estadoFichaCentral, resumoFichaCentral, ordenarFichasCentral,
  guardarAnuncioEmAndamento, lerAnuncioEmAndamento, restaurarAnuncioEmAndamento, rascunhoLocalJaNaBase,
  telaInicialDoEndereco, enderecoComTela, enderecoDaFicha, CHAVE_ANUNCIO_EM_ANDAMENTO,
} = await import("../../src/services/fichasCentral.js");
const { prepararNovaCriacaoMidia, deveIniciarNovaCriacaoMidia, consumirNovaCriacaoMidia } = await import("../../src/services/limparEstadoTemporarioMidia.js");
const { montarRecuperacaoDaFicha, diferencasAssinatura, mesmaAprovacao } = await import("../../src/services/fichaConferencia.js");
const { registroDaFicha, registroPublicado, precisaConferir, ESTADO: ESTADO_BLING } = await import("../../src/services/vinculoBlingPublicacao.js");

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (rel) => fs.readFileSync(path.join(RAIZ, rel), "utf8").replace(/\r\n/g, "\n");

const ID = "0f6a1c2e-1111-4222-8333-944455556666";
const ANUNCIO = { codigo: "0280158276", titulo: "Bico Injetor March Versa 0280158276", descricao: "Bico injetor...", preco: "189.90", fotos: ["https://x/1.png", "https://x/2.png"] };

// ---------------------------------------------------------------
test("1) preencher anúncio → avançar (Central) → Home → voltar → retomar: nada se perde", () => {
  const ls = new Armazenamento();
  globalThis.localStorage = ls;
  // Novo Anúncio grava o rascunho; "Continuar" leva à Central.
  ls.setItem("rascunhoNovoAnuncioTemp", JSON.stringify(ANUNCIO));
  ls.setItem("novoAnuncioTemporario", JSON.stringify(ANUNCIO));
  ls.setItem("anuncioProntoPublicacao", JSON.stringify(ANUNCIO));
  // Ir para a Home: o App GUARDA antes de limpar (criação nova).
  assert.equal(guardarAnuncioEmAndamento(ls, "2026-10-07T18:00:00Z"), true);
  prepararNovaCriacaoMidia();
  assert.equal(ls.getItem("anuncioProntoPublicacao"), null, "a Home continua iniciando uma criação nova");
  assert.equal(deveIniciarNovaCriacaoMidia(), true);
  // A Central mostra a ficha "Em andamento" e oferece Retomar.
  const guardado = lerAnuncioEmAndamento(ls);
  assert.equal(guardado.resumo.codigo, "0280158276");
  assert.equal(rascunhoLocalJaNaBase(guardado, []), false);
  // Retomar: devolve EXATAMENTE os dados e não é criação nova.
  assert.equal(restaurarAnuncioEmAndamento(ls), true);
  consumirNovaCriacaoMidia();
  assert.equal(deveIniciarNovaCriacaoMidia(), false);
  assert.deepEqual(JSON.parse(ls.getItem("anuncioProntoPublicacao")), ANUNCIO);
  assert.deepEqual(JSON.parse(ls.getItem("rascunhoNovoAnuncioTemp")), ANUNCIO);
  // Avançar de novo e voltar de novo: o guardado continua lá (não é apagado ao retomar).
  assert.ok(ls.getItem(CHAVE_ANUNCIO_EM_ANDAMENTO));
  // Um estado vazio nunca apaga o que foi guardado.
  const vazio = new Armazenamento();
  vazio.setItem(CHAVE_ANUNCIO_EM_ANDAMENTO, ls.getItem(CHAVE_ANUNCIO_EM_ANDAMENTO));
  assert.equal(guardarAnuncioEmAndamento(vazio), false);
  assert.equal(lerAnuncioEmAndamento(vazio).resumo.codigo, "0280158276");
  // Quando a ficha já está na base (mesmo código, gravada depois), a Central mostra só a da base.
  assert.equal(rascunhoLocalJaNaBase(guardado, [{ codigo: "0280-158-276", atualizado: "2026-10-07T18:05:00Z" }]), true);
});

test("1b) Central → Voltar ao Anúncio: grava os dados e não inicia criação nova", () => {
  const c = ler("src/components/CentralPublicacao.jsx");
  const fn = c.slice(c.indexOf("function voltarAnuncio()"), c.indexOf("async function enviarCasaDaInjecao"));
  assert.ok(fn.includes('"novoAnuncioTemporario"') && fn.includes('"rascunhoNovoAnuncioTemp"'));
  assert.ok(fn.includes("consumirNovaCriacaoMidia()"));
  assert.ok(c.includes("<PainelFichasCentral setScreen={setScreen} />"), "a Central lista as fichas");
  assert.equal((c.match(/<PainelFichasCentral/g) || []).length, 2, "com ou sem anúncio novo na tela");
  assert.equal(/⬅ Voltar/.test(c), false);
  assert.ok(c.includes("← Voltar ao Anúncio"));
});

// ---------------------------------------------------------------
test("2) Conferência aprovada → alterar Tipo de veículo → fica pendente, a ficha continua inteira", () => {
  const base = ["Bico", "189.90", "desc", ["https://x/1.png"], "Bicos", "MLB1234", "Bosch", "0280158276", "NISSAN\n• March", 100, 10, 10, 10, { peso_g: 100 }, 2];
  const aprovada = JSON.stringify([...base, "Carro/Caminhonete", "", "classico", "novo", false]);
  const atual = JSON.stringify([...base, "Linha Pesada", "", "classico", "novo", false]);
  assert.deepEqual(diferencasAssinatura(aprovada, atual), ["tipo de veículo"]);
  assert.equal(mesmaAprovacao(aprovada, atual), false, "Conferência volta a ficar pendente");
  // A ficha gravada na base guarda TODOS os campos (só a aprovação deixa de valer).
  const campos = { titulo: "Bico", preco: "189.90", marca: "Bosch", tipoVeiculo: "Linha Pesada", tipoVeiculoOrigem: "manual", compatibilidades: "NISSAN\n• March", fotos: ["https://x/1.png", "https://x/2.png"], categoriaML: { id: "MLB1234" }, logistica: { medida: { peso_g: 100 } }, quantidadeEstoque: "2" };
  const r = montarRecuperacaoDaFicha({ id: ID, codigo: "0280158276", dados_conferencia: { salvo_em: "2026-10-07T18:00:00Z", anuncio: ANUNCIO, ficha: { campos, etapa: "conferencia", assinaturaAprovada: "" } } });
  assert.equal(r.ok, true);
  for (const [k, v] of Object.entries(campos)) assert.deepEqual(r.fichaConferencia.campos[k], v, `campo ${k} preservado`);
  assert.equal(r.fichaConferencia.etapa, "conferencia");
  assert.equal(r.fichaConferencia.campos.anuncioIdPAIIA, ID, "mesma ficha, mesmo ID");
});

// ---------------------------------------------------------------
test("3) F5 em cada etapa principal volta para a MESMA etapa (não para a Home)", () => {
  assert.equal(telaInicialDoEndereco("?tela=novoAnuncio"), "novoAnuncio");
  assert.equal(telaInicialDoEndereco("?tela=centralPublicacao"), "centralPublicacao");
  assert.equal(telaInicialDoEndereco("?tela=mercadoLivreTeste"), "mercadoLivreTeste");
  assert.equal(telaInicialDoEndereco(`?ficha=${ID}`), "mercadoLivreTeste", "Conferência/Publicação/publicado pela ficha");
  assert.equal(telaInicialDoEndereco(`?tela=centralPublicacao&ficha=${ID}`), "mercadoLivreTeste");
  assert.equal(telaInicialDoEndereco("?tela=admin"), "home", "fora do fluxo do anúncio não vale");
  assert.equal(telaInicialDoEndereco(""), "home");
  const a = enderecoComTela(`https://www.paiia.com.br/?ficha=${ID}`, "mercadoLivreTeste");
  assert.ok(a.includes(`ficha=${ID}`) && a.includes("tela=mercadoLivreTeste"), "não mexe na ficha");
  assert.equal(enderecoComTela("https://www.paiia.com.br/?tela=centralPublicacao", "home"), "https://www.paiia.com.br/");
  const app = ler("src/App.jsx");
  assert.ok(app.includes('telaInicialDoEndereco(window.location.search, "home", { fichaNovoAnuncioLocal: fichaDoRascunhoLocal() })'));
  assert.ok(app.includes("enderecoComTela(window.location.href, screen)"));
  // A Home guarda o anúncio em andamento ANTES de limpar.
  const i = app.indexOf('if (screen === "home") {');
  assert.ok(app.indexOf("guardarAnuncioEmAndamento(localStorage)", i) < app.indexOf("prepararNovaCriacaoMidia();", i));
});

// ---------------------------------------------------------------
test("4) sair e recuperar por ?ficha=<id> (também em outro navegador)", () => {
  const url = enderecoDaFicha("https://www.paiia.com.br/?tela=centralPublicacao", ID);
  assert.equal(new URL(url).searchParams.get("ficha"), ID);
  assert.equal(telaInicialDoEndereco(new URL(url).search), "mercadoLivreTeste");
  assert.equal(new URL(enderecoDaFicha("https://www.paiia.com.br/", "../x")).searchParams.get("ficha"), null, "só ID válido");
  const campos = { titulo: "Bico", preco: "189.90", contaDestinoML: "1729335019" };
  const conferido = { codigo: "0280158276", titulo: "Bico", fotos: ["https://x/1.png"] };
  const r = montarRecuperacaoDaFicha({ id: ID, codigo: "0280158276", conta_destino_ml_user_id: "1729335019", dados_conferencia: { salvo_em: "s1", anuncio: ANUNCIO, ficha: { campos, anuncioConferido: conferido, assinaturaAprovada: "[x]", etapa: "publicacao" } } });
  assert.equal(r.fichaConferencia.etapa, "publicacao", "volta exatamente para a Publicação");
  assert.equal(r.fichaConferencia.campos.contaDestinoML, "1729335019");
});

// ---------------------------------------------------------------
const PUB = { mlb_id: "MLB7755979208", status_publicacao: "publicado", conta_nome: "LOJA ONLINE" };
const REG = registroPublicado({ mlb: "MLB7755979208", contaId: "1729335019", skuOficial: "0280158276", produtoBlingId: "16715641958", preco: 31.51, agora: "2026-10-07T18:00:00Z" });

test("5) publicação concluída → F5 → NÃO republica: abre a ficha publicada", () => {
  const row = { id: ID, status_fluxo: "publicado", publicacao: PUB };
  assert.equal(estadoFichaCentral(row), ESTADO_CENTRAL.PUBLICADO);
  assert.equal(resumoFichaCentral(row).publicado, true);
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  const w = mlt.slice(mlt.indexOf("export default function MercadoLivreTeste"));
  assert.ok(/publicacaoExiste\(r\.anuncio\.publicacao\)\) \{[\s\S]{0,300}publicada: r\.anuncio/.test(w), "publicada → tela da ficha publicada");
  assert.ok(w.indexOf("if (estado.publicada)") < w.indexOf("<ConferenciaPAIIA"), "nunca chega à Publicação");
  const fp = ler("src/components/FichaPublicadaPAIIA.jsx");
  assert.equal(/mercadolivre-publicacao|"publicar"|registrarResultadoPublicacao|registrarMLBPublicado/.test(fp), false, "sem caminho de publicação");
});

test("6) MLB recebido → F5 → o MLB permanece", () => {
  const r = resumoFichaCentral({ id: ID, status_fluxo: "publicado", publicacao: PUB, integracao_bling: REG });
  assert.equal(r.mlb, "MLB7755979208");
  // Mesmo se a linha de publicação ainda não chegou, o registro do fluxo novo guarda o MLB.
  assert.equal(resumoFichaCentral({ id: ID, status_fluxo: "publicado", publicacao: null, integracao_bling: REG }).mlb, "MLB7755979208");
  const fp = ler("src/components/FichaPublicadaPAIIA.jsx");
  // registro da ficha OU refeito da publicação gravada (MLB nunca some da tela)
  assert.ok(fp.includes("registroDaFichaOuPublicacao(ficha?.dados_conferencia, pub)"));
  assert.ok(fp.includes("pub.mlb_id || registro?.mlb"));
});

test("7) aguardando Bling → sair/voltar/F5 → estado permanece (MLB, produto, SKU, conta, loja)", () => {
  const dados = { integracao_bling: REG };
  const reg = registroDaFicha(dados);
  assert.equal(reg.estado, ESTADO_BLING.AGUARDANDO);
  for (const k of ["mlb", "bling_produto_id", "sku_oficial", "ml_user_id", "bling_loja_id"]) assert.ok(reg[k], `${k} preservado`);
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: PUB, integracao_bling: REG }), ESTADO_CENTRAL.AGUARDANDO_BLING);
  assert.equal(precisaConferir(reg), true);
});

test("8) integrado ao Bling → sair/voltar → continua integrado (sem nova consulta)", () => {
  const integrado = { ...REG, estado: ESTADO_BLING.INTEGRADO, bling_anuncio_id: 64134421 };
  assert.equal(estadoFichaCentral({ status_fluxo: "publicado", publicacao: PUB, integracao_bling: integrado }), ESTADO_CENTRAL.INTEGRADO_BLING);
  assert.equal(registroDaFicha({ integracao_bling: integrado }).estado, "integrado");
  assert.equal(precisaConferir(integrado), false);
});

// ---------------------------------------------------------------
test("9) Central diferencia os 7 estados e não esconde ficha que não está pronta", () => {
  const casos = [
    [{ status_fluxo: "qualquer" }, ESTADO_CENTRAL.EM_ANDAMENTO],
    [{ status_fluxo: "rascunho" }, ESTADO_CENTRAL.AGUARDANDO_CONFERENCIA],
    [{ status_fluxo: "conferencia_aprovada" }, ESTADO_CENTRAL.CONFERENCIA_APROVADA],
    [{ status_fluxo: "conferencia_aprovada", conta_destino_ml_user_id: "1729335019" }, ESTADO_CENTRAL.PRONTO_PUBLICAR],
    [{ status_fluxo: "erro_publicacao", conta_destino_ml_user_id: "1" }, ESTADO_CENTRAL.PRONTO_PUBLICAR],
    [{ status_fluxo: "publicado", publicacao: PUB }, ESTADO_CENTRAL.PUBLICADO],
    [{ status_fluxo: "publicado_com_pendencia", publicacao: { mlb_id: "MLB1234567" } }, ESTADO_CENTRAL.PUBLICADO],
    [{ status_fluxo: "publicado", publicacao: PUB, integracao_bling: REG }, ESTADO_CENTRAL.AGUARDANDO_BLING],
    [{ status_fluxo: "publicado", publicacao: PUB, integracao_bling: { ...REG, estado: "integrado" } }, ESTADO_CENTRAL.INTEGRADO_BLING],
  ];
  for (const [row, esp] of casos) assert.equal(estadoFichaCentral(row), esp, JSON.stringify(row));
  assert.deepEqual(Object.values(TEXTO_ESTADO_CENTRAL), ["Em andamento", "Aguardando Conferência", "Conferência aprovada", "Pronto para publicar", "Publicado no Mercado Livre", "Aguardando Bling", "Integrado ao Bling · Fluxo concluído"]);
  const lista = ordenarFichasCentral([
    resumoFichaCentral({ id: "a", status_fluxo: "publicado", publicacao: PUB, updated_at: "3" }),
    resumoFichaCentral({ id: "b", status_fluxo: "rascunho", updated_at: "1" }),
    resumoFichaCentral({ id: "c", status_fluxo: "rascunho", updated_at: "2" }),
  ]);
  assert.deepEqual(lista.map((f) => f.id), ["c", "b", "a"], "as que precisam de ação primeiro, mais recente antes");
  // A leitura da Central não filtra por "pronto": só tira as canceladas.
  const svc = ler("src/services/fichasCentralService.js");
  assert.ok(svc.includes('.neq("status_fluxo", "cancelado")'));
  assert.equal(/\.(insert|update|upsert|delete)\(/.test(svc), false, "Central só lê");
});

// ---------------------------------------------------------------
test("10) Voltar da Conferência/Publicação grava ANTES de sair; falha = avisa e fica", () => {
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  const sair = mlt.slice(mlt.indexOf("async function sairPara("), mlt.indexOf("const NOME_TELA"));
  assert.ok(/await salvarFichaAntesDeSair\(\)/.test(sair));
  assert.ok(/if \(!r\.ok\) \{[\s\S]*?return;\s*\}/.test(sair), "erro: não navega");
  assert.ok(sair.indexOf("setScreen?.(tela)") > sair.indexOf("if (!r.ok)"));
  const antes = mlt.slice(mlt.indexOf("async function salvarFichaAntesDeSair()"), mlt.indexOf("async function sairPara("));
  assert.ok(antes.includes("await gravarRascunhoRef.current()"));
  assert.ok(antes.includes("st.gravando"), "espera gravação em andamento");
  // Os botões de voltar usam sairPara e dizem o destino.
  const voltas = mlt.match(/data-paiia-voltar-central[\s\S]{0,200}?← Voltar à Central de Publicação/g) || [];
  assert.equal(voltas.length, 3, "Conferência (topo e rodapé) e Publicação");
  for (const v of voltas) assert.ok(v.includes('sairPara("centralPublicacao")'));
  assert.ok(mlt.includes("← Voltar à Conferência (editar)"));
  assert.ok(mlt.includes("↑ Voltar ao início da Conferência"));
  assert.equal(/⬅ Voltar\s*\n/.test(mlt), false, "sem 'Voltar' genérico");
  assert.equal(/⬅ Central de Publicação/.test(mlt), false);
  // gravarRascunhoNaBase devolve o resultado (ok/erro) para quem vai sair.
  const g = mlt.slice(mlt.indexOf("async function gravarRascunhoNaBase()"), mlt.indexOf("const gravarRascunhoRef"));
  assert.ok(g.includes('return { ok: false, erro: r.erro || "Não foi possível gravar o rascunho na base PAIIA." }'));
  // Voltar não cria outra ficha: a gravação usa o ID da ficha atual.
  assert.ok(g.includes("let id = idFichaRef.current"));
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(rev.includes("← Voltar à Conferência</button>"));
});

test("11) Voltar nunca limpa campos confirmados", () => {
  const mlt = ler("src/components/MercadoLivreTeste.jsx");
  const trecho = mlt.slice(mlt.indexOf("async function salvarFichaAntesDeSair()"), mlt.indexOf("const NOME_TELA"));
  assert.equal(/set(Fotos|Compatibilidades|Preco|QuantidadeEstoque|Marca|Categoria|CategoriaId|TipoVeiculo|LogisticaConferencia)\(/.test(trecho), false);
  assert.equal(/removeItem|cancelarFichaSemConta/.test(trecho), false);
  const painel = ler("src/components/PainelFichasCentral.jsx");
  assert.equal(/removeItem|cancelarFichaSemConta|\.delete\(/.test(painel), false);
});
