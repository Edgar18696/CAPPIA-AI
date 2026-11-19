// =============================================================
// PAIIA — TESTES (18/11/2026): Ranqueamento simplificado e "Correção inteligente".
//   - classificação: prejuízo SÓ com custo cadastrado; custo ausente = não verificado;
//   - título sugerido ≤ 60 caracteres e sem inventar; custo pela última compra;
//   - tela: "Relatório completo" fechado, "Corrigir", "Próximo anúncio", "Marcar como resolvido".
// Sem rede.
//   node --test scripts/testes/rankingCorrecao.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const C = await import("../../src/services/paizinhoAuditoria/correcao.js");
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");

const base = (extra = {}) => ({ item_id: "MLB123456789", vendedor_id: "2412238242", sku: "SKU1", titulo: "Bobina De Ignição Clio", preco: 100, custo: 40, custo_a_confirmar: false, margem_pct: 12, lucro: 12, link: "https://x/1", palavras: [], achados: [], ...extra });
const PREJ = { area: "margem", severidade: "alta", problema: "PREJUÍZO de R$ 5,00 por venda: preço ...", sugestao: "Revisar preço ou frete deste anúncio." };

test("prejuízo financeiro só com custo CADASTRADO e margem calculada negativa", () => {
  const a = base({ margem_pct: -5, lucro: -5, achados: [PREJ] });
  assert.equal(C.prejuizoConfirmado(a), true);
  const c = C.classificarAnuncio(a);
  assert.ok(c.categorias.includes(C.CATEGORIA.PREJUIZO));
  assert.equal(c.problemas[0].categoria, C.CATEGORIA.PREJUIZO);
  assert.equal(c.prejuizo, true);
});

test("custo ausente / a confirmar / margem não calculada → não verificado, NUNCA prejuízo", () => {
  const semCusto = base({ custo: null, margem_pct: null, lucro: null, achados: [{ area: "margem", severidade: "baixa", problema: "Sem custo para a margem: sem fornecedor. Margem não calculada.", sugestao: "Cadastrar o preço de custo no Bling." }] });
  const c1 = C.classificarAnuncio(semCusto);
  assert.equal(C.prejuizoConfirmado(semCusto), false);
  assert.ok(!c1.categorias.includes(C.CATEGORIA.PREJUIZO));
  assert.ok(c1.categorias.includes(C.CATEGORIA.NAO_VERIFICADO));
  assert.equal(c1.problemas[0].categoria, C.CATEGORIA.NAO_VERIFICADO);

  // Custo a confirmar com margem negativa = "possível prejuízo": continua não verificado.
  const aConfirmar = base({ custo_a_confirmar: true, margem_pct: -8, lucro: -8, achados: [{ ...PREJ, severidade: "media", problema: "Possível prejuízo de R$ 8,00 por venda" }] });
  assert.equal(C.prejuizoConfirmado(aConfirmar), false);
  assert.deepEqual(C.classificarAnuncio(aConfirmar).categorias, [C.CATEGORIA.NAO_VERIFICADO]);

  // Só margem estimada pela última compra (sem custo cadastrado): não verificado.
  const estimada = base({ custo: null, margem_pct: null, lucro: null, margem_estimada_pct: -3 });
  assert.equal(C.prejuizoConfirmado(estimada), false);
  assert.ok(C.classificarAnuncio(estimada).categorias.includes(C.CATEGORIA.NAO_VERIFICADO));

  // Custo cadastrado mas margem não calculada (tarifa/frete não lidos): não verificado.
  assert.ok(C.custoNaoVerificado(base({ margem_pct: null, lucro: null })));
});

test("margem baixa com custo cadastrado não é prejuízo; título/fotos/compat = qualidade", () => {
  const a = base({ margem_pct: 4, lucro: 4, achados: [
    { area: "margem", severidade: "media", problema: "Margem de 4% abaixo do mínimo", sugestao: "Avaliar" },
    { area: "conteudo", severidade: "media", problema: "Só 1 foto(s).", sugestao: "Usar 4 fotos" },
    { area: "compatibilidade", severidade: "media", problema: "Nenhum veículo compatível cadastrado.", sugestao: "Cadastrar" },
    { area: "frete", severidade: "baixa", problema: "Medidas ausentes", sugestao: "Conferir" },
    { area: "conteudo", positivo: true, problema: "Boas fotos" },
  ] });
  const c = C.classificarAnuncio(a);
  assert.deepEqual(c.categorias, [C.CATEGORIA.MARGEM_BAIXA, C.CATEGORIA.QUALIDADE]);
  assert.equal(c.problemas.length, 4, "positivos ficam fora");
  assert.ok(c.problemas.filter((x) => x.area !== "margem").every((x) => x.categoria === C.CATEGORIA.QUALIDADE));
  assert.equal(C.ROTULO_CATEGORIA.prejuizo, "💸 Prejuízo estimado (custo cadastrado no Bling)");
  assert.equal(C.ROTULO_CATEGORIA.nao_verificado, "❔ Custo / margem não verificados");
  assert.equal(C.ROTULO_CATEGORIA.qualidade, "🛠️ Qualidade do anúncio");
});

test("título sugerido: só o código principal citado no problema (marca NUNCA), ≤ 60 caracteres, sem inventar", () => {
  const a = base({ titulo: "Bobina De Ignição Clio", achados: [
    { area: "conteudo", severidade: "media", problema: "O código 7700274008 não está no título.", sugestao: "Incluir o código" },
    { area: "conteudo", severidade: "baixa", problema: "A marca Bosch não está no título.", sugestao: "Incluir a marca" },
  ] });
  const t = C.sugestaoTitulo(a);
  assert.equal(t.titulo, "Bobina De Ignição Clio 7700274008", "(19/11) marca não é acrescentada");
  assert.ok(t.titulo.length <= C.LIMITE_TITULO_ML);
  assert.deepEqual(t.adicionados, ["7700274008"]);
  // Alerta antigo de marca (relatório anterior) não vira problema nem sugestão.
  assert.ok(!C.classificarAnuncio(a).problemas.some((x) => /A marca/.test(x.problema)));
  assert.equal(C.sugestaoTitulo(base({ titulo: "Bobina", achados: [{ area: "conteudo", severidade: "baixa", problema: "A marca Torken não está no título.", sugestao: "x" }] })), null);

  // Sem problema de código/marca → nenhuma sugestão (não inventa).
  assert.equal(C.sugestaoTitulo(base({ achados: [{ area: "conteudo", severidade: "media", problema: "Título curto (20 de 60 caracteres).", sugestao: "Usar o espaço" }] })), null);
  // Já está no título (com separadores diferentes) → nada a sugerir.
  assert.equal(C.sugestaoTitulo(base({ titulo: "Bobina 77 0027 4008 Clio", achados: [{ area: "conteudo", severidade: "media", problema: "O código 7700274008 não está no título.", sugestao: "x" }] })), null);

  // Não cabe: nunca passa de 60 nem corta palavras por conta própria.
  const longo = "Bobina De Ignição Renault Clio Kangoo Logan Sandero 1.0 16v";
  const n = C.sugestaoTitulo(base({ titulo: longo, achados: [{ area: "conteudo", severidade: "media", problema: "O código 7700274008 não está no título.", sugestao: "x" }] }));
  assert.equal(n.titulo, null);
  assert.match(n.aviso, /limite do Mercado Livre: 60/);

  // Código cabe; a marca (alerta antigo) é ignorada, sem aviso de marca.
  const medio = "Bobina De Ignição Renault Clio Kangoo Logan 1.6"; // 46
  const p = C.sugestaoTitulo(base({ titulo: medio, achados: [
    { area: "conteudo", severidade: "media", problema: "O código 7700274008 não está no título.", sugestao: "x" },
    { area: "conteudo", severidade: "baixa", problema: "A marca Magneti Marelli não está no título.", sugestao: "x" },
  ] }));
  assert.equal(p.titulo, `${medio} 7700274008`);
  assert.ok(p.titulo.length <= 60);
  assert.doesNotMatch(p.aviso, /Magneti/);

  // (19/11) Vários códigos no mesmo campo (relatório anterior): só o principal = o do SKU.
  const v = C.sugestaoTitulo(base({ titulo: "Sensor Rotação Clio", sku: "H8201443067", achados: [
    { area: "conteudo", severidade: "media", problema: "O código H8201443067, 025803002U, 025803002T, 0258030172/173 não está no título.", sugestao: "x" },
  ] }));
  assert.equal(v.titulo, "Sensor Rotação Clio H8201443067");
  assert.deepEqual(v.adicionados, ["H8201443067"], "outros códigos não entram no título");
});

test("palavras-chave: só as da concorrência (palavras) que faltam no título", () => {
  assert.deepEqual(C.sugestaoPalavras(base({ titulo: "Bobina De Ignição Clio", palavras: ["bobina", "Clio 1.0", "ignição", "Kangoo", "kangoo"] })), ["Clio 1.0", "Kangoo"]);
  assert.deepEqual(C.sugestaoPalavras(base({ palavras: undefined })), []);
});

test("custo a cadastrar no Bling: pela última compra (sugestão), nunca com custo já cadastrado", () => {
  const s = C.sugestaoCusto(base({ custo: null, margem_pct: null, ultima_compra: { valor: 1234.5, data: "2025-12-22", pedido: "306", fonte: "Pedido de compra no Bling (atendido)", quantidade: 10 } }));
  assert.equal(s.valor, 1234.5);
  assert.equal(s.valor_texto, "1.234,50");
  assert.equal(s.frase, "Custo a cadastrar no Bling: R$ 1.234,50 (última compra nº 306, 22/12/2025)");
  assert.equal(C.sugestaoCusto(base({ ultima_compra: { valor: 30, data: "2025-01-01", pedido: "1" } })), null, "custo cadastrado: não sugere");
  assert.equal(C.sugestaoCusto(base({ custo: null, ultima_compra: null })), null, "sem compra: não inventa");
  assert.equal(C.sugestaoCusto(base({ custo: 0, ultima_compra: { valor: 0 } })), null);
});

test("resolvido vai para a fila por assunto (sem oportunidade) e 'próximo' segue a lista filtrada", () => {
  const a = base({ achados: [
    { area: "conteudo", severidade: "media", problema: "Só 1 foto(s).", sugestao: "x" },
    { area: "conteudo", severidade: "baixa", problema: "A marca X não está no título.", sugestao: "y" },
    { area: "oportunidade", severidade: "baixa", problema: "Palavras", sugestao: "z" },
    { area: "margem", severidade: "alta", problema: "PREJUÍZO", sugestao: "w" },
  ] });
  const areas = C.areasParaFila(a);
  assert.deepEqual(areas.map((x) => x.area), ["margem", "conteudo"]);
  assert.equal(areas[1].problema, "Só 1 foto(s).", "a mais grave de cada assunto");
  assert.ok(areas.every((x) => x.item_id === "MLB123456789"));
  const lista = [{ item_id: "A" }, { item_id: "B" }, { item_id: "C" }];
  assert.equal(C.proximoDaLista(lista, "A").item_id, "B");
  assert.equal(C.proximoDaLista(lista, "C"), null);
  assert.equal(C.proximoDaLista(lista, "Z"), null);
});

test("o helper é puro: sem rede, sem Bling/ML, sem banco", () => {
  const s = ler("src/services/paizinhoAuditoria/correcao.js");
  assert.doesNotMatch(s, /\bfetch\(|supabase|functions\.invoke|localStorage|bling-integracao|method\s*:/i);
});

test("tela: topo simples + 'Relatório completo' fechado; Corrigir / Próximo anúncio / Marcar como resolvido", () => {
  const rank = ler("src/components/RelatorioManhaPaizinho.jsx");
  assert.match(rank, /<details style=\{S\.completo\} data-paizinho-relatorio-completo>\s*<summary[^>]*>📊 Relatório completo<\/summary>/);
  assert.doesNotMatch(rank, /data-paizinho-relatorio-completo open/, "começa fechado");
  for (const r of ["Analisados / restantes", "Pendências abertas", "Urgentes", "Buscar SKU, MLB ou produto"]) assert.ok(rank.includes(r), r);
  // Tudo o que existia continua dentro do relatório completo.
  const completo = rank.slice(rank.indexOf("data-paizinho-relatorio-completo>"));
  assert.match(completo, /data-paizinho-opcoes-avancadas/);
  assert.match(completo, /<Relatorio key=/);
  for (const r of ["Prioridades de hoje", "Oportunidades comerciais", "<FretesMedidas", "Peças Renault", "Detalhes por assunto", "Limitações desta execução", "Faturamento (30 dias)", "Pontuação média"]) assert.ok(rank.includes(r), r);
  // Histórico / Revisar pendências / Reanalisar continuam (secundários).
  for (const r of ["data-paizinho-fila-historico", "data-paizinho-fila-pendencias", "data-paizinho-reanalisar"]) assert.ok(rank.includes(r), r);
  assert.match(rank, /<AuditoriaAnuncios [^>]*busca=\{busca\}[^>]*aoAgir=\{agir\}/, "busca do topo e fila (Resolvido) chegam à lista");

  const lista = ler("src/components/AuditoriaAnuncios.jsx");
  assert.match(lista, /\{estaAberto \? "Fechar" : "Corrigir"\}/);
  assert.match(lista, /Próximo anúncio →/);
  assert.match(lista, /✅ Marcar como resolvido/);
  assert.match(lista, /Correção inteligente/);
  assert.match(lista, /Abrir anúncio no Mercado Livre/);
  assert.match(lista, /scrollIntoView\?\.\(\{ block: "nearest"/);
  assert.match(lista, /const \[aberto, setAberto\] = useState\(null\)/, "um painel por vez");
  assert.match(lista, /<summary[^>]*>Dados do anúncio<\/summary>/);
  assert.match(lista, /aoAgir\(acao, achado, ""\)/, "resolvido usa a mesma fila das Prioridades");
  assert.match(lista, /Mostrar mais/);
  assert.doesNotMatch(lista, /functions\.invoke|\.from\(|fetch\(|method:/, "nada é gravado no ML/Bling");
});

test("(18/11) prejuízo pequeno com margem arredondada para 0% continua prejuízo (caso real k2-708550: −R$ 0,07)", () => {
  assert.equal(C.prejuizoConfirmado(base({ custo: 138, margem_pct: 0, lucro: -0.07 })), true);
  assert.equal(C.prejuizoConfirmado(base({ custo: 138, margem_pct: 0, lucro: 0 })), false);
  assert.equal(C.prejuizoConfirmado(base({ custo: 138, custo_a_confirmar: true, margem_pct: -5, lucro: -5 })), false, "custo a confirmar nunca é prejuízo confirmado");
});
