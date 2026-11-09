// (09/11) Bloco 15 — Categoria Mercado Livre: busca livre + regra permanente dos relés automotivos.
// Respostas no formato da API pública do ML (lidas em 09/11/2026), sem rede.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { preferenciaDaPeca, ehReleAutomotivo, resolverCategoriaPreferida, caminhoDaPreferencia, CHAVE_CATEGORIAS_PREFERIDAS } from "../../src/services/categoriaPreferidaML.js";
import { PREFERENCIAS_CATEGORIA_ML } from "../../src/config/preferenciasCategoriaML.js";
import { avaliarUmaCategoria, avaliarCategorias, conferirCategoriaParaPublicar } from "../../src/services/categoriaML.js";
import { conferirSoCategoriaVoz, buscarCategoriasVoz, confirmarCategoriaEscolhida, atributosDaCategoria } from "../../src/modules/paiiaVoz/servicos/preparoConferenciaVoz.js";
import { atributoNoPreparo } from "../../src/modules/paiiaVoz/servicos/preparoFicha.js";
import { lerDetalheCategoria } from "../../src/services/categoriaMLBusca.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const RELES = PREFERENCIAS_CATEGORIA_ML.find((p) => p.id === "reles_automotivos");

// ---------- API falsa (formato real) ----------
const CATS = {
  MLB212929: { path: [["MLB1000", "Eletrônicos, Áudio e Vídeo"], ["MLB6999", "Componentes Eletrônicos"], ["MLB455488", "Semicondutores"], ["MLB212929", "Relés"]], dominio: "MLB-HOME_APPLIANCE_CONTACTORS_AND_RELAYS",
    attrs: [
      { id: "BRAND", name: "Marca", tags: { required: true } },
      { id: "MODEL", name: "Modelo", tags: { required: true }, value_type: "string" },
      { id: "CONTACTOR_AND_RELAY_TYPE", name: "Tipo de produto", tags: { required: true }, values: [{ id: "1", name: "Contator" }, { id: "2", name: "Relé" }, { id: "3", name: "Relé térmico" }] },
      { id: "GTIN", name: "Código universal de produto", tags: { conditional_required: true } },
    ] },
  MLB431130: { path: [["MLB5672", "Acessórios para Veículos"], ["MLB22693", "Peças de Carros e Caminhonetes"], ["MLB440216", "Sistema Elétrico"], ["MLB431130", "Instalações Elétricas"]], dominio: "MLB-VEHICLE_WIRE_HARNESSES",
    attrs: [{ id: "BRAND", name: "Marca", tags: { required: true } }, { id: "MODEL", name: "Modelo", tags: { required: true } }, { id: "PART_NUMBER", name: "Número de peça", tags: { required: true } }] },
  MLB456944: { path: [["MLB5672", "Acessórios para Veículos"], ["MLB22693", "Peças de Carros e Caminhonetes"], ["MLB1", "Sistema Elétrico"], ["MLB456944", "Instalações Elétricas"]], dominio: "MLB-VEHICLE_WIRE_HARNESSES", attrs: [] },
  MLB38249: { path: [["MLB1000", "Eletrônicos, Áudio e Vídeo"], ["MLB6999", "Componentes Eletrônicos"], ["MLB38249", "Circuitos Integrados"]], dominio: "MLB-INTEGRATED_CIRCUITS", attrs: [] },
};
const PREDITOR = {
  "rele 12v": ["MLB212929", "MLB456944", "MLB431130"],
  "rele": ["MLB212929", "MLB431130"],
  "reles": ["MLB212929"],
  "rele automotivo": ["MLB431130", "MLB456944"],
  "componentes eletronicos": ["MLB38249"],
  "semicondutores": [],
};
const chave = (q) => decodeURIComponent(q).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function apiFalsa({ listing = {}, caminhoTrocado = {} } = {}) {
  const urls = [];
  const lerJson = async (url) => {
    urls.push(url);
    let m = url.match(/domain_discovery\/search\?q=([^&]+)/);
    if (m) {
      const k = chave(m[1]);
      const ids = PREDITOR[k] ?? (k.startsWith("rele") ? ["MLB431130"] : ["MLB431130", "MLB456944"]);
      return ids.map((id) => ({ category_id: id, category_name: CATS[id].path.at(-1)[1], domain_id: CATS[id].dominio }));
    }
    m = url.match(/categories\/(MLB\d+)\/attributes$/);
    if (m) return CATS[m[1]]?.attrs ?? null;
    m = url.match(/categories\/(MLB\d+)$/);
    if (m) {
      const c = CATS[m[1]];
      if (!c) return null;
      const path = caminhoTrocado[m[1]] || c.path;
      return { id: m[1], name: path.at(-1)[1], path_from_root: path.map(([id, name]) => ({ id, name })), children_categories: [], settings: { listing_allowed: listing[m[1]] ?? true, catalog_domain: c.dominio } };
    }
    return null;
  };
  return { lerJson, urls };
}
const deps = (api, extra = {}) => ({ lerJson: api.lerJson, listarFichas: async () => ({ ok: true, anuncios: [] }), chamarPublicacao: async () => ({ ok: false }), ...extra });
function memoria() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }

// Ficha SKU 93226612 (forma da paiia_anuncios) — dados que NÃO podem mudar.
function ficha93226612(decisao = null) {
  return {
    id: "ficha-93226612",
    codigo: "93226612",
    titulo: "Relé Auxiliar 12V 4 Terminais Ventoinha Gm",
    dados_conferencia: {
      novo_anuncio: { codigo: "93226612", titulo: "Relé Auxiliar 12V 4 Terminais Ventoinha Gm", descricao: "Relé auxiliar original…", preco: "47,92", tipoVeiculo: "Carro/Caminhonete", fotos: ["f1", "f2", "f3", "f4", "f5"] },
      paiia_voz: {
        complemento: { marca: "GM", quantidadeEstoque: "3" },
        aplicacoes: [{ montadora: "Chevrolet", modelo: "Onix", anoInicio: 2013, anoFim: 2019, confirmada: true }],
        preparo: { conta: "", categoria: { decisao } },
      },
      publicacao: { bling_produto_id: "16500000001" },
    },
  };
}

test("1) relé automotivo reconhecido; módulo, temporizador, pisca, soquete e chicote NÃO", () => {
  for (const t of ["Relé Auxiliar 12V 4 Terminais", "Relé de Ventoinha Gol", "Relé da Bomba de Combustível Palio", "Relé 12V 40A", "Mini relé universal 5 pinos", "Relé automotivo 12v"]) assert.equal(ehReleAutomotivo(t), true, t);
  for (const t of ["Módulo de relé da ventoinha", "Relé temporizador do limpador", "Relé pisca seta 3 terminais", "Soquete de relé 5 pinos", "Chicote do relé da ventoinha", "Bomba de combustível Gol", "Sensor de rotação"]) assert.equal(preferenciaDaPeca(t), null, t);
});

test("2) a configuração guarda só o CAMINHO oficial (nenhum ID escrito à mão)", () => {
  assert.deepEqual([...RELES.niveis], ["Eletrônicos, Áudio e Vídeo", "Componentes Eletrônicos", "Semicondutores", "Relés"]);
  assert.ok(!/MLB\d/.test(ler("src/config/preferenciasCategoriaML.js")), "nenhum código MLB na configuração");
  assert.ok(!/MLB212929/.test(ler("src/services/categoriaPreferidaML.js")));
});

test("3) ID consultado na API pelo caminho; guarda o aprendido e confere de novo; inativa = motivo", async () => {
  const api = apiFalsa();
  const s = memoria();
  const r = await resolverCategoriaPreferida(RELES, { consultar: async (t) => t.map((termo) => ({ termo, sugestoes: (PREDITOR[chave(termo)] || []).map((id) => ({ category_id: id })) })), lerDetalhe: (id) => lerDetalheCategoria(id, api.lerJson, {}), storage: s });
  assert.equal(r.ok, true);
  assert.equal(r.id, "MLB212929");
  assert.ok(caminhoDaPreferencia(r.detalhe.niveis, RELES));
  assert.equal(JSON.parse(s.getItem(CHAVE_CATEGORIAS_PREFERIDAS)).reles_automotivos.id, "MLB212929");
  // O ID aprendido mudou de caminho no ML → não vale; volta ao preditor (que não devolve outra) → motivo.
  const api2 = apiFalsa({ caminhoTrocado: { MLB212929: [["MLB1000", "Eletrônicos, Áudio e Vídeo"], ["MLB9", "Outros"]] } });
  const r2 = await resolverCategoriaPreferida(RELES, { consultar: async () => [], lerDetalhe: (id) => lerDetalheCategoria(id, api2.lerJson, {}), storage: s });
  assert.equal(r2.ok, false);
  assert.match(r2.motivo, /não devolveu/);
  // Caminho certo, mas o ML não aceita anúncio nela → informa o motivo.
  const api3 = apiFalsa({ listing: { MLB212929: false } });
  const r3 = await resolverCategoriaPreferida(RELES, { consultar: async () => [], lerDetalhe: (id) => lerDetalheCategoria(id, api3.lerJson, {}), storage: s });
  assert.equal(r3.ok, false);
  assert.match(r3.motivo, /listing_allowed = false/);
});

test("4) exceção só para a peça certa: Relés vale para relé; continua bloqueada para outras peças; outra categoria de eletrônicos continua bloqueada", async () => {
  const api = apiFalsa();
  const reles = await lerDetalheCategoria("MLB212929", api.lerJson, {});
  const ci = await lerDetalheCategoria("MLB38249", api.lerJson, {});
  assert.equal(avaliarUmaCategoria(reles, { textoPeca: "Relé Auxiliar 12V" }).compativel, true);
  assert.equal(avaliarUmaCategoria(reles, { textoPeca: "Módulo de relé da ventoinha" }).compativel, false);
  assert.equal(avaliarUmaCategoria(ci, { textoPeca: "Relé Auxiliar 12V" }).compativel, false);
  // Publicação: a categoria confirmada Relés passa na conferência para o relé.
  const dec = { confirmada: { id: "MLB212929" } };
  assert.equal(conferirCategoriaParaPublicar({ categoriaId: "MLB212929", decisao: dec, detalhe: reles, textoPeca: "Relé Auxiliar 12V" }).ok, true);
  assert.equal(conferirCategoriaParaPublicar({ categoriaId: "MLB212929", decisao: dec, detalhe: reles, textoPeca: "Amortecedor dianteiro" }).ok, false);
});

test("5) ficha de relé sem categoria: Relés já vem SELECIONADA (regra permanente), Tipo de produto = Relé, Modelo pendente", async () => {
  const api = apiFalsa();
  const r = await conferirSoCategoriaVoz(ficha93226612(), { deps: deps(api, { storage: memoria() }) });
  assert.equal(r.estado, "ok", r.texto);
  assert.equal(r.id, "MLB212929");
  assert.equal(r.automatica, true);
  assert.equal(r.preferencia, "reles_automotivos");
  assert.equal(r.caminho, "Eletrônicos, Áudio e Vídeo > Componentes Eletrônicos > Semicondutores > Relés");
  assert.equal(r.decisao.confirmada.id, "MLB212929");
  assert.equal(r.decisao.atributos.valores.CONTACTOR_AND_RELAY_TYPE.value_name, "Relé");
  assert.equal(r.atributos.exigir, true);
  assert.equal(r.atributos.completo, false);
  assert.deepEqual(r.atributos.pendentes.map((p) => p.id), ["MODEL"]);
  assert.ok(r.avaliacao.alertas.some((a) => /regra permanente/.test(a)), "o preditor indicou outra; vira aviso");
});

test("6) categoria já confirmada por você NUNCA é trocada pela regra dos relés", async () => {
  const api = apiFalsa();
  const decisao = { confirmada: { id: "MLB431130", caminho: "Acessórios para Veículos > Peças de Carros e Caminhonetes > Sistema Elétrico > Instalações Elétricas", manual: true } };
  const r = await conferirSoCategoriaVoz(ficha93226612(decisao), { deps: deps(api) });
  assert.equal(r.estado, "ok");
  assert.equal(r.id, "MLB431130");
  assert.ok(!api.urls.some((u) => /q=Rel%C3%A9%2012V|q=Rel%C3%A9s/.test(u)), "nem consulta a categoria preferida");
});

test("7) busca livre: o termo digitado vale sozinho e a escolha mostrada é a do termo (não volta para MLB431130)", async () => {
  const api = apiFalsa();
  const row = ficha93226612();
  for (const termo of ["Relé 12V", "Componentes Eletrônicos", "Semicondutores"]) {
    const r = await buscarCategoriasVoz(row, termo, { deps: deps(api) });
    assert.equal(r.ok, true, termo);
    assert.equal(r.buscada, "MLB212929", termo);
    const c = r.avaliacao.candidatas.find((x) => x.id === "MLB212929");
    assert.equal(c.compativel, true, termo);
    assert.equal(c.caminho, "Eletrônicos, Áudio e Vídeo > Componentes Eletrônicos > Semicondutores > Relés");
  }
  const urlsTitulo = api.urls.filter((u) => /domain_discovery/.test(u) && /Auxiliar/.test(decodeURIComponent(u)));
  assert.equal(urlsTitulo.length, 0, "a busca digitada não mistura o título da ficha");
  // Alternativas continuam na lista para escolha manual.
  const r = await buscarCategoriasVoz(row, "Relé 12V", { deps: deps(api) });
  assert.ok(r.avaliacao.candidatas.some((c) => c.id === "MLB431130" && c.compativel));
  // Código MLB digitado: lido direto.
  const porId = await buscarCategoriasVoz(row, "mlb431130", { deps: deps(api) });
  assert.equal(porId.buscada, "MLB431130");
});

test("8) escolher Relés manualmente → grava; ao conferir de novo continua Relés (não volta para a sugestão anterior)", async () => {
  const api = apiFalsa();
  const row = ficha93226612();
  const b = await buscarCategoriasVoz(row, "Semicondutores", { deps: deps(api) });
  const candidata = b.avaliacao.candidatas.find((c) => c.id === "MLB212929");
  const c = confirmarCategoriaEscolhida(row.dados_conferencia.paiia_voz.preparo, { candidata, avaliacao: b.avaliacao });
  assert.equal(c.ok, true);
  const depois = await conferirSoCategoriaVoz(ficha93226612(c.decisao), { deps: deps(api) });
  assert.equal(depois.estado, "ok", depois.texto);
  assert.equal(depois.id, "MLB212929");
  assert.equal(depois.decisao.atributos.valores.CONTACTOR_AND_RELAY_TYPE.value_name, "Relé", "Tipo de produto gravado também na escolha manual");
});

test("9) Modelo salvo na ficha → atributos completos; só muda a decisão da categoria (título, descrição, 5 fotos, R$ 47,92, estoque, Bling e compatibilidades intactos)", async () => {
  const api = apiFalsa();
  const auto = await conferirSoCategoriaVoz(ficha93226612(), { deps: deps(api) });
  const row = ficha93226612(auto.decisao);
  const antes = structuredClone(row.dados_conferencia);
  const dados = atributoNoPreparo(row.dados_conferencia, { atributo: { id: "MODEL", nome: "Modelo" }, valueName: "93226612", agora: "2026-11-09T12:00:00Z" });
  assert.equal(dados.paiia_voz.preparo.categoria.decisao.atributos.valores.MODEL.value_name, "93226612");
  assert.equal(dados.paiia_voz.preparo.categoria.decisao.atributos.valores.CONTACTOR_AND_RELAY_TYPE.value_name, "Relé");
  assert.deepEqual(dados.novo_anuncio, antes.novo_anuncio);
  assert.equal(dados.novo_anuncio.fotos.length, 5);
  assert.equal(dados.novo_anuncio.preco, "47,92");
  assert.deepEqual(dados.paiia_voz.complemento, antes.paiia_voz.complemento);
  assert.deepEqual(dados.paiia_voz.aplicacoes, antes.paiia_voz.aplicacoes);
  assert.deepEqual(dados.publicacao, antes.publicacao);
  const det = await lerDetalheCategoria("MLB212929", api.lerJson, {});
  const atr = atributosDaCategoria(det, { marca: "GM", codigo: "93226612", tipoVeiculo: "Carro/Caminhonete", titulo: row.titulo }, dados.paiia_voz.preparo.categoria.decisao.atributos);
  assert.equal(atr.completo, true);
  // Recarregar (nova leitura da ficha) mantém a categoria e os atributos.
  const recarregada = await conferirSoCategoriaVoz({ ...row, dados_conferencia: dados }, { deps: deps(api) });
  assert.equal(recarregada.id, "MLB212929");
  assert.equal(recarregada.atributos.completo, true);
  // Sem categoria confirmada não grava nada.
  assert.ok(atributoNoPreparo(ficha93226612().dados_conferencia, { atributo: { id: "MODEL", nome: "Modelo" }, valueName: "x" }).erro);
});

test("10) Relés REJEITADA pelo ML para o SKU: não é selecionada; diz o motivo e oferece as alternativas", () => {
  const det = { id: "MLB212929", lido: true, niveis: [...RELES.niveis], caminho: RELES.niveis.join(" > "), listingAllowed: true, filhos: [] };
  const av = avaliarCategorias({
    textoPeca: "Relé Auxiliar 12V", textoProduto: "Relé Auxiliar 12V",
    consultas: [{ termo: "Relé Auxiliar 12V", sugestoes: [{ category_id: "MLB212929" }, { category_id: "MLB431130" }] }],
    detalhes: { MLB212929: det, MLB431130: { id: "MLB431130", lido: true, niveis: ["Acessórios para Veículos", "Peças de Carros e Caminhonetes", "Sistema Elétrico", "Instalações Elétricas"], filhos: [] } },
    rejeicoes: [{ categoria_id: "MLB212929", mlb: "MLB1", motivo: "Finalizado: categoria incorreta" }],
    preferencia: { id: "MLB212929", rotulo: "Relés automotivos" },
  });
  assert.equal(av.preferida, null);
  assert.notEqual(av.sugerida, "MLB212929");
  assert.ok(av.alertas.some((a) => /MLB212929.*não serve agora.*REJEITADA/.test(a)));
  assert.ok(av.candidatas.some((c) => c.id === "MLB431130" && c.compativel));
});

test("11) tela do Voz: atributos obrigatórios, bloqueio mostra a SUA escolha, busca abre as alternativas; nada publica", () => {
  const c = ler("src/modules/paiiaVoz/CategoriaVoz.jsx");
  for (const x of ["data-pv-categoria-atributos", "data-pv-atributo-valor", "data-pv-atributo-salvar", "data-pv-categoria-bloqueio", "gravarAtributoCategoriaVoz", "preferida={busca.aberta ? busca.buscada", "avancadoAberto=", "faltaAtributo", "regra permanente do PAIIA"]) assert.ok(c.includes(x), x);
  assert.ok(!/publicar\(|bling_criar|executarFinalizacao/.test(c));
  assert.ok(ler("src/components/PainelCategoriaML.jsx").includes("open={avancadoAberto || undefined}"));
});
