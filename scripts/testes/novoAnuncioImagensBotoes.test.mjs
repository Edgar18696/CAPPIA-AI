// (24/10/2026 - E12, publicação) Correção P-01 — Novo Anúncio › Imagens do Anúncio.
// A seção tem SÓ dois botões: "Escolher Foto" e "Buscar foto pronta no computador".
// "Escolher Banner" e "Tirar foto" NÃO podem aparecer no Novo Anúncio.
// O PAIIA Voz continua com "Tirar foto" e a escolha de fotos.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Código sem comentários (os comentários podem citar os nomes antigos).
const semComentarios = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const NOVO = semComentarios(ler("src/components/NovoAnuncio.jsx"));

function secaoImagens() {
  const ini = NOVO.indexOf("③ 🖼 Imagens do Anúncio");
  const fim = NOVO.indexOf("{(envioFotosPC.texto", ini);
  assert.ok(ini > 0 && fim > ini, "seção Imagens do Anúncio encontrada");
  return NOVO.slice(ini, fim);
}

test("Novo Anúncio › Imagens: exatamente 2 botões — Escolher Foto e Buscar foto pronta no computador", () => {
  const s = secaoImagens();
  assert.equal(s.split("<button").length - 1, 2, "a seção deve ter 2 botões");
  assert.ok(s.includes("🖼 Escolher Foto"));
  assert.ok(s.includes("📁 Buscar foto pronta no computador"));
  assert.ok(s.indexOf("🖼 Escolher Foto") < s.indexOf("📁 Buscar foto pronta no computador"), "ordem mantida");
});

test("Novo Anúncio: 'Escolher Banner' e 'Tirar foto' não aparecem", () => {
  for (const proibido of [/Escolher Banner/, /Tirar foto/i, /onClick=\{escolherBannerGaleria\}/, /data-paiia-tirar-foto/, /CameraCaptura/]) {
    assert.ok(!proibido.test(NOVO), `não pode aparecer no Novo Anúncio: ${proibido}`);
  }
  const s = secaoImagens();
  for (const icone of ["🎨", "📷"]) assert.ok(!s.includes(icone), `ícone ${icone} não pode voltar à seção Imagens`);
});

test("Novo Anúncio: os dois botões continuam ligados como antes", () => {
  const s = secaoImagens();
  assert.ok(s.includes("onClick={escolherFotosGaleria}"), "Escolher Foto abre a Galeria como antes");
  assert.ok(s.includes("onClick={() => inputFotosComputadorRef.current?.click()}"), "Buscar foto abre o seletor de arquivos");
  assert.ok(s.includes("buscarFotosNoComputador(lista);"), "o arquivo escolhido segue o envio de sempre");
  assert.ok(NOVO.includes("function escolherFotosGaleria()"), "função da Galeria preservada");
});

test("PAIIA Voz: 'Tirar foto' e a escolha de fotos continuam", () => {
  const voz = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(voz.includes("📷 Tirar foto") && voz.includes("data-pv-foto-botao"), "botão Tirar foto do PAIIA Voz");
  assert.ok(voz.includes('capture="environment"') && voz.includes("data-pv-foto-input"), "câmera do celular pelo seletor de fotos");
});
