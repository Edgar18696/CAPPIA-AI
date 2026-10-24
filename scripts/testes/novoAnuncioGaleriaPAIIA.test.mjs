// (P-06) Novo Anúncio: a Galeria PAIIA abre DENTRO da ficha (quadro), igual ao localhost.
// Fotos da Galeria entram como endereços (sem baixar nem enviar), sem repetir, até 6,
// na ordem escolhida, mantendo as que já estavam; voltam no F5 pelo rascunho.
// A Galeria completa continua acessível pelo link do quadro. Galeria: só leitura.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const G = await import("../../src/modules/paiiaVoz/servicos/galeriaVoz.js");

test("juntar fotos da Galeria: sem repetir, até 6, ordem e capa; fotos existentes preservadas", () => {
  const atuais = [{ imagem_processada: "https://x/a.png" }, { imagem_processada: "https://x/b.png", origem: "computador" }];
  const itens = ["a", "c", "c", "d", "e", "f", "g"].map((n, i) => ({ id: String(i), url: `https://x/${n}.png` }));
  const r = G.juntarFotosGaleriaAnuncio(atuais, itens, 6);
  assert.deepEqual(r.map((f) => f.imagem_processada), ["a", "b", "c", "d", "e", "f"].map((n) => `https://x/${n}.png`));
  assert.deepEqual(r.map((f) => f.ordem), [0, 1, 2, 3, 4, 5]);
  assert.equal(r[0].capa, true);
  assert.equal(r[1].origem, "computador");
  const sete = Array.from({ length: 7 }, (_, i) => ({ imagem_processada: `https://x/${i}.png` }));
  assert.equal(G.juntarFotosGaleriaAnuncio(sete, itens, 6).length, 7, "acima do limite: nada é tirado nem acrescentado");
  assert.equal(G.vagasFotos(4, 6), 2);
  assert.equal(G.vagasFotos(9, 6), 0);
});

test("F5: as fotos da Galeria vão para o rascunho como endereços", async () => {
  // Só as funções puras do rascunho (o hook importa React e serviços do navegador).
  const h = ler("src/hooks/useNovoAnuncio.js");
  const trecho = h.slice(h.indexOf("const CHAVES_TEXTO_RASCUNHO"), h.indexOf("export function rascunhoTemTexto"));
  assert.ok(trecho.includes("export function fotosParaRascunho(fotos)"), "função do rascunho encontrada");
  const U = await import("data:text/javascript;base64," + Buffer.from(trecho).toString("base64"));
  const fotos = G.juntarFotosGaleriaAnuncio([], [{ id: "1", url: "https://x/g1.png" }, { id: "2", url: "https://x/g2.png" }], 6);
  const { referencias, soNaMemoria } = U.fotosParaRascunho(fotos);
  assert.equal(soNaMemoria, 0);
  assert.deepEqual(referencias.map((f) => [f.imagem_processada, f.ordem, f.capa]), [["https://x/g1.png", 0, true], ["https://x/g2.png", 1, false]]);
});

test("Galeria PAIIA: só leitura (nenhuma gravação no banco ou no armazenamento)", () => {
  const codigo = (ler("src/modules/paiiaVoz/servicos/galeriaVoz.js") + ler("src/components/fotos/GaleriaSeletor.jsx")).replace(/\/\/.*$/gm, "");
  assert.ok(!/\.(insert|update|delete|upsert|rpc)\(|storage\.from|\.upload\(/.test(codigo));
});

test("Novo Anúncio: quadro da Galeria ligado à ficha (limite 6, sem repetir, Galeria completa preservada)", () => {
  const t = ler("src/components/NovoAnuncio.jsx");
  assert.ok(t.includes('import GaleriaSeletor from "./fotos/GaleriaSeletor";'));
  assert.ok(t.includes("export const LIMITE_FOTOS_NOVO_ANUNCIO = 6;"));
  assert.ok(t.includes("{galeriaNA && (") && t.includes("<GaleriaSeletor"));
  assert.ok(t.includes("vagas={vagasFotos(fotosUnicas.length, LIMITE_FOTOS_NOVO_ANUNCIO)}"));
  assert.ok(t.includes("urlsExistentes={fotosUnicas.map((f) => f?.imagem_processada || f?.imagem_original)}"), "não repete fotos já escolhidas");
  assert.ok(t.includes("onEscolher={usarGaleriaNovoAnuncio}") && t.includes("setFotosAnuncio((atuais) => juntarFotosGaleriaAnuncio(atuais, itens, LIMITE_FOTOS_NOVO_ANUNCIO));"));
  assert.ok(t.includes("onGaleriaCompleta={escolherFotosGaleria}") && t.includes("function escolherFotosGaleria()"), "Galeria completa (tela antiga) continua pelo link");
  assert.ok(t.includes("<PainelFotosAnuncio"), "painel de fotos (ordem, capa, remover) preservado");
});
