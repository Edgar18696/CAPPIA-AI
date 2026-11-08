// =============================================================
// PAIIA Voz — Passo 7 (Finalizar) no celular: "Completar ficha" (vai direto à
// 1ª etapa pendente) ou "Continuar para Publicação" (mesma ficha da conta).
//   node --test scripts/testes/paiiaVozPassoFinal.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as C from "../../src/modules/paiiaVoz/servicos/completarVoz.js";
import * as V from "../../src/modules/paiiaVoz/servicos/fichaVoz.js";
import * as R from "../../src/modules/paiiaVoz/servicos/rascunhoRapido.js";
import { decidirPassoFinal, enderecoPublicacaoDaFicha, ETAPAS_OBRIGATORIAS } from "../../src/modules/paiiaVoz/servicos/passoFinalVoz.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ID = "73ebf08c-93e0-44d4-84fe-1acd1c5fac5f";

/** Ficha do BCK001 preenchida etapa por etapa; `ate` = última etapa preenchida. */
function fichaAte(ate) {
  const ordem = ["codigo", "descricao", "envio", "preco", "compat", "categoria"]; // (08/11) Envio antes do Preço
  let f = V.criarFichaVoz({ agora: 1, id: "pf" });
  for (const e of ordem.slice(0, ordem.indexOf(ate) + 1)) {
    if (e === "codigo") f = { ...f, codigos: [{ codigo: "BCK001", normalizado: "BCK001", principal: true, conferido: true, origem: "digitado" }] };
    if (e === "descricao") { f = R.definirTitulo(f, "Kit Refil Bomba De Combustivel Sistema Bosch", { origem: "digitado" }); f = R.definirDescricaoFinal(f, "Kit refil da bomba de combustível."); }
    if (e === "preco") for (const [c, v] of [["marca", "Torken"], ["preco", "27,92"], ["quantidade", "2"]]) f = C.definirCampoDireto(f, c, v).ficha;
    if (e === "envio") for (const [c, v] of [["peso", "300"], ["comprimento", "20"], ["largura", "10"], ["altura", "8"]]) f = C.definirCampoDireto(f, c, v).ficha;
    if (e === "categoria") f = { ...f, categoriaVoz: { ok: true, id: "MLB191833", caminho: "Acessórios > Injeção" } };
    if (e === "compat") { f = { ...f, aplicacoes: [{ id: "ap1", chave: "fiat|uno|2010|2014", montadora: "Fiat", modelos: ["Uno"], motores: [], versoes: [], anoInicio: 2010, anoFim: 2014, confirmada: true, origem: "usuario", fontes: [] }] }; f = C.definirTipoVeiculoVoz(f, "Carro/Caminhonete"); }
  }
  return f;
}

test("1) ficha incompleta: 'Completar ficha' leva à PRIMEIRA etapa pendente, na ordem das 7 etapas", () => {
  assert.deepEqual(ETAPAS_OBRIGATORIAS, ["fotos", "codigo", "descricao", "envio", "preco", "compat", "categoria"]); // (08/11) Envio antes do Preço
  assert.equal(decidirPassoFinal(fichaAte("categoria"), { fotos: 0 }).etapa, "fotos", "sem foto → Fotos");
  const casos = [["", "codigo"], ["codigo", "descricao"], ["descricao", "envio"], ["envio", "preco"], ["preco", "compat"], ["compat", "categoria"]];
  for (const [ate, espera] of casos) {
    const d = decidirPassoFinal(ate ? fichaAte(ate) : V.criarFichaVoz({ agora: 1, id: "v" }), { fotos: 2 });
    assert.equal(d.acao, "completar", ate);
    assert.equal(d.etapa, espera, `preenchido até ${ate || "nada"} → ${espera}`);
  }
  const d = decidirPassoFinal(fichaAte("descricao"), { fotos: 2 });
  assert.deepEqual(d.faltam, ["Envio", "Preço", "Compat.", "Categoria"]);
});

test("2) ficha completa: 'Continuar para Publicação'", () => {
  assert.deepEqual(decidirPassoFinal(fichaAte("categoria"), { fotos: 2 }), { acao: "publicacao", faltam: [] });
});

test("3) endereço da Publicação: SEMPRE a ficha informada (?ficha=<ID>&tela=mercadoLivreTeste), sem outra", () => {
  assert.equal(enderecoPublicacaoDaFicha("https://www.paiia.com.br/?tela=paiiaVoz#x", ID), `https://www.paiia.com.br/?tela=mercadoLivreTeste&ficha=${ID}`);
  const u = new URL(enderecoPublicacaoDaFicha("https://www.paiia.com.br/?tela=paiiaVoz&ficha=11111111-1111-4111-8111-111111111111", ID));
  assert.equal(u.searchParams.get("ficha"), ID, "troca a ficha antiga do endereço pela ficha DESTE rascunho");
  assert.equal(u.searchParams.get("tela"), "mercadoLivreTeste");
  assert.equal(enderecoPublicacaoDaFicha("https://www.paiia.com.br/", ""), "", "sem ficha da conta, não navega");
  assert.equal(enderecoPublicacaoDaFicha("https://www.paiia.com.br/", "nao-e-id"), "");
});

test("4) tela: 'Completar ficha' grande; Finalizar mostra UMA decisão ou 'Continuar para Publicação'; não publica nem cria ficha", () => {
  const t = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(t.includes("data-pv-completar-ficha={pf.etapa}") && t.includes("onClick={() => irPara(pf.etapa)}") && t.includes('className="pr-botao pr-grande"'));
  assert.ok(t.includes("aoIrEtapa={irPara} aoAbrirPublicacao={abrirPublicacaoDaFicha}"));
  const ab = t.slice(t.indexOf("function abrirPublicacaoDaFicha(id"), t.indexOf("// (04/11) Remover ficha de teste"));
  assert.ok(ab.includes("id !== fichaRef.current.fichaIdPAIIA") && ab.includes("let destino = enderecoPublicacaoDaFicha(window.location.href, id);") && ab.includes('setScreen?.("mercadoLivreTeste")'), "só abre a MESMA ficha");
  const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  const seg = f.slice(f.indexOf("const seguirParaPublicacao"), f.indexOf("const decisao = faltaRev[0]"));
  assert.ok(seg.indexOf("aprovarRevisaoEGravar") < seg.indexOf("prepararPublicacaoVoz") && seg.indexOf("prepararPublicacaoVoz") < seg.lastIndexOf("abrirPublicacao(fichaId)"), "aprova → entrega à Publicação existente → abre");
  assert.ok(seg.includes("p.fichaId !== fichaId"), "nunca abre outra ficha");
  assert.ok(!/publicar_item|ml_publicar|criar_produto/.test(seg), "não publica");
  // (Etapa 3, decisão D1/D4) o Bling só é cadastrado pelo executor existente E com a autorização marcada
  assert.ok(!seg.includes("executarFinalizacao") || (seg.includes("if (!autorizoCadastro) return") && seg.includes('marcadas: ["bling_criar"]')), "Bling só com autorização");
  assert.ok(f.includes("const decisao = faltaRev[0] || null;") && f.includes("data-pv-seguir="), "uma decisão por vez");
  assert.ok(f.includes('data-pv-resolver="categoria"') && f.includes('data-pv-resolver="modalidade"') && f.includes('p.id === "compatibilidade" ? "compat"'));
});
