// (03/11/2026) Ajustes depois da validação da Etapa 4 do PAIIA Voz:
//  2) texto do Bling: "vinculado automaticamente" só na conta com vínculo automático (LojaOnlineSP);
//  3) seletor de conta da revisão no celular mostra a conta gravada na ficha.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lojaBlingDaConta, LOJAS_ML_BLING } from "../../src/services/vinculoBlingPublicacao.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("vínculo automático: só LojaOnlineSP (inalterado); CIEBR e REVELAÇÃO não", () => {
  assert.equal(LOJAS_ML_BLING.length, 1);
  assert.equal(lojaBlingDaConta("1729335019")?.vinculo_automatico, true);
  assert.equal(lojaBlingDaConta("1729335019")?.bling_loja_nome, "LojaOnlineSP");
  assert.equal(lojaBlingDaConta("824312524"), null);
  assert.equal(lojaBlingDaConta("2412238242"), null);
  assert.equal(lojaBlingDaConta(""), null);
});

test("Publicação: texto do Bling depende da conta; nenhuma outra regra muda", () => {
  const f = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(f.includes("lojaBlingDaConta(contaEscolhida)?.vinculo_automatico ? ("), "texto condicionado à conta");
  assert.ok(f.includes('data-paiia-bling-vinculo="automatico"') && f.includes('data-paiia-bling-vinculo="manual"'));
  assert.ok(f.includes("Nesta conta o vínculo com o Bling NÃO é automático: depois de publicar, confira ou faça o vínculo no Bling separadamente."));
  // a frase antiga (sem condição) não existe mais solta
  assert.equal(f.split("Na publicação o anúncio é VINCULADO a este produto").length - 1, 1);
});

test("Revisão no celular: enquanto as contas carregam, o seletor mostra a conta gravada e a marca", () => {
  const f = ler("src/modules/paiiaVoz/PreparoPublicacaoVoz.jsx");
  assert.ok(f.includes("conta && !contas.some((c) => String(c.ml_user_id) === conta) && <option value={conta} data-pv-conta-carregando>"));
  assert.ok(f.includes("data-pv-conta-gravada"));
  assert.ok(f.includes("paiia_voz?.preparo?.conta"));
  // fluxo das 4 etapas preservado
  for (const t of ["data-pv-preparo-conferir", "data-pv-revisao-aprovar", "data-pv-publicar", "<RevisaoPublicacaoML", "modoSimples"]) assert.ok(f.includes(t), t);
});
