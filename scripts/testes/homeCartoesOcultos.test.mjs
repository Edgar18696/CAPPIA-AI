// (P-08) Página inicial: só 3 cartões saem da VISTA (Mídias PAIIA, Banner Express IA,
// Paizinho — Criar meu Mascote). Telas, arquivos, rotas e dados continuam existindo.
// Os outros cartões continuam; Novo Anúncio (E12, P-06, P-07) sem alteração.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TELAS_FORA_DA_HOME, cartaoVisivelNaHome } from "../../src/config/homePaiia.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const HOME = ler("src/components/Home.jsx");
const telasDoCodigo = [...HOME.matchAll(/^\s*tela: "([^"]+)",/gm)].map((m) => m[1]);

test("Home: exatamente Mídias PAIIA, Banner Express IA e Criar meu Mascote ficam fora da vista", () => {
  assert.deepEqual([...TELAS_FORA_DA_HOME].sort(), ["bannerStudio", "criarMascotePaizinho", "midiasAppia"]);
  assert.match(HOME, /\{cards\.filter\(\(card\) => cartaoVisivelNaHome\(card\.tela\)\)\.map\(\(card\) => \(/);
  assert.equal((HOME.match(/cards\.map\(/g) || []).length, 0, "nenhuma lista de cartões sem o filtro");
});

test("Home: todos os outros cartões continuam visíveis (e os 3 continuam no código)", () => {
  const esperadas = ["centralPaizinho", "novoAnuncio", "paiiaVoz", "importadorUniversal", "foto", "midiasAppia", "bannerStudio", "criarMascotePaizinho", "catalogos", "galeria", "dashboardAppia", "planosPagamentos", "contasMarketplace"];
  assert.deepEqual(telasDoCodigo, esperadas, "lista de cartões do código igual à de produção");
  const visiveis = telasDoCodigo.filter(cartaoVisivelNaHome);
  assert.deepEqual(visiveis, ["centralPaizinho", "novoAnuncio", "paiiaVoz", "importadorUniversal", "foto", "catalogos", "galeria", "dashboardAppia", "planosPagamentos", "contasMarketplace"]);
  for (const [t, nome] of [["midiasAppia", "Mídias PAIIA"], ["bannerStudio", "Banner Express IA"], ["criarMascotePaizinho", "Paizinho — Criar meu Mascote"]]) {
    assert.equal(cartaoVisivelNaHome(t), false, `${nome} fora da vista`);
    assert.ok(HOME.includes(nome), `${nome} continua no código (volta tirando o nome da lista)`);
  }
});

test("telas, rotas e arquivos das 3 ferramentas continuam existindo (nada apagado)", () => {
  const app = ler("src/App.jsx");
  assert.match(app, /screen === "bannerStudio"/);
  assert.match(app, /\{screen === "midiasAppia" && \(/);
  assert.match(app, /\{screen === "criarMascotePaizinho" && \(/);
  for (const f of ["src/components/CriarMascotePaizinho.jsx", "src/components/Galeria.jsx"]) assert.ok(fs.existsSync(new URL(`../../${f}`, import.meta.url)), f);
  assert.match(ler("src/components/Galeria.jsx"), /setScreen\("bannerStudio"\)/, "Banner continua acessível pela Galeria");
  assert.equal(/supabase/i.test(ler("src/config/homePaiia.js")), false, "a lista não usa a base");
});
