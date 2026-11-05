// Publicação automática (LOJA ONLINE): o piloto executa os passos da Publicação sozinho, uma autorização.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { situacaoAnuncioML, autorizacaoDaUrl, novaAutorizacaoId } from "../../src/services/pilotoPublicacao.js";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("1) nº da autorização: UUID novo, lido só da URL e só se válido", () => {
  const id = novaAutorizacaoId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(autorizacaoDaUrl(`https://x/?tela=mercadoLivreTeste&auto=${id}`), id);
  assert.equal(autorizacaoDaUrl("https://x/?auto=qualquer"), "");
});

test("2) anúncio pausado processando fotos = continua esperando; ativo = sucesso; encerrado = pausa", () => {
  assert.equal(situacaoAnuncioML({ status: "active" }).ok, true);
  assert.equal(situacaoAnuncioML({ status: "paused", sub_status: ["picture_download_pending"] }).fim, false);
  const r = situacaoAnuncioML({ status: "closed" });
  assert.equal(r.fim, true); assert.equal(r.ok, false);
});

test("3) a autorização vai ao servidor; outros anúncios do SKU não bloqueiam SÓ no modo automático", () => {
  const r = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.ok(r.includes("...(autoPublicacao ? { autorizacao_id: autoPublicacao } : {}),"));
  assert.ok(r.includes('nivel: autoPublicacaoDaUrl() ? "aviso" : "erro"'), "tela normal continua bloqueando");
  const v = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
  assert.ok(v.includes('const contaAutomatica = nomeDaLoja(conta) === "LOJA ONLINE";') && v.includes("id = atual?.id && !atual.concluida ? atual.id : novaAutorizacaoId();"), "mesmo número em toque repetido");
  assert.equal((v.match(/data-pv-autorizo-bling-cadastro/g) || []).length, 1, "UMA autorização");
});

test("4) Novo Anúncio: a MESMA autorização única abre o MESMO piloto (só LOJA ONLINE), com nº reaproveitado", () => {
  const a = ler("src/components/AutorizacaoUnicaPublicacao.jsx");
  assert.ok(a.includes('nomeDaLoja(c.ml_user_id, c.nickname) === "LOJA ONLINE"') && a.includes("sessionStorage.getItem(CHAVE(anuncioId))") && a.includes("disabled={!marcado}"));
  const m = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(m.includes("<AutorizacaoUnicaPublicacao") && m.includes("autoId={autoPiloto}"));
  const p = ler("src/services/pilotoPublicacao.js");
  assert.ok(p.includes('visivel("[data-paiia-confirmar-criar-bling]")'), "cadastro no Bling pelo mesmo botão protegido da Publicação");
});

test("5) ficha certa: a cópia do anúncio ANTERIOR é apagada antes de gravar a nova; a memória decide a ficha", () => {
  const c = ler("src/components/CentralPublicacao.jsx");
  assert.ok(c.indexOf('localStorage.removeItem("mlAnuncioTeste")') > 0 && c.indexOf('localStorage.removeItem("mlAnuncioTeste")') < c.indexOf('"mlAnuncioTeste",\n        JSON.stringify(\n          anuncioLeve'));
  const m = ler("src/components/MercadoLivreTeste.jsx");
  assert.ok(m.includes("if (mem) return idFichaValido(mem.fichaIdPAIIA) ? String(mem.fichaIdPAIIA) : \"\";"));
});
