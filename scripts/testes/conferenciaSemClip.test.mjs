// (P-09) Conferência do Mercado Livre: sem a seção "Clip do anúncio" (título, aviso
// "Opcional…" e botão Escolher/Trocar Clip). Só a interface: fotos, capa, ordem,
// validações, características e as etapas seguintes continuam iguais.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const CONF = semComentarios(ler("src/components/MercadoLivreTeste.jsx"));

function bloco(inicio, fim) {
  const i = CONF.indexOf(inicio); const j = CONF.indexOf(fim, i);
  assert.ok(i > 0 && j > i, `bloco ${inicio} encontrado`);
  return CONF.slice(i, j);
}

test("Conferência: a seção Clip do anúncio não aparece (título, aviso e botão)", () => {
  for (const proibido of ["🎬 Clip do anúncio", "Opcional. Adicione um vídeo ao anúncio quando quiser.", "🎬 Escolher Clip", "🎬 Trocar Clip", "🗑 Remover clip", 'id="secao-midias-publicacao"']) {
    assert.equal(CONF.includes(proibido), false, `não pode aparecer na Conferência: ${proibido}`);
  }
  const fotos = bloco("④ Fotos do anúncio", "⑤ Características principais");
  assert.equal(/<video\b/.test(fotos), false, "nenhum vídeo no bloco ④");
  assert.equal(/clipsSelecionados/.test(fotos), false, "o bloco ④ não usa mais os clips");
});

test("Conferência: fotos, capa, ordem e avisos das imagens continuam no bloco ④", () => {
  const fotos = bloco("④ Fotos do anúncio", "⑤ Características principais");
  assert.match(fotos, /\{fotos\.map\(/, "lista de fotos");
  assert.match(fotos, /⭐ CAPA/, "selo da capa");
  assert.match(fotos, /\(capa\)/, "indicação da capa");
  assert.match(fotos, /A primeira imagem é a capa\. Use ⬅ ➡ para mudar a ordem/, "ordem das fotos");
  assert.match(fotos, /Imagens que não abriram/, "conferência das imagens");
  assert.match(CONF, /function moverFoto\(/, "função de mudar a ordem");
});

test("Conferência: validações, características e etapas seguintes continuam", () => {
  assert.match(CONF, /async function validarAnuncio\(\)/);
  assert.match(CONF, /faltando\.push\(`Fotos desta ficha — \$\{situacaoFotos\.motivo\}`\)/, "validação das fotos");
  assert.match(CONF, /Remova as duplicadas no bloco ④ Fotos\./, "validação de fotos repetidas");
  for (const etapa of ["⑤ Características principais", "⑥ Peso e Embalagem", "⑦ Características secundárias", "⑧ Informação regulatória", 'id="conf-bloco-9"', 'id="conf-bloco-16"']) {
    assert.ok(CONF.includes(etapa), `etapa continua: ${etapa}`);
  }
  // Dados do clip já guardados não são apagados (só deixam de aparecer aqui).
  assert.match(CONF, /"clipsSelecionadosPublicacao"/);
  assert.match(CONF, /videos:\s*videosPublicacao,/);
});
