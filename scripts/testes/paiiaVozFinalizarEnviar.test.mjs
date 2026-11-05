// Etapa 3: "Finalizar e Enviar" — um botão; Bling só com autorização (sem duplicar); retomada; confirmação final na Publicação.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");
const seg = f.slice(f.indexOf("const seguirParaPublicacao"), f.indexOf("const decisao = faltaRev[0]"));

test("1) um botão principal 'Finalizar e Enviar'; com SKU ausente no Bling ele só habilita com a autorização marcada", () => {
  assert.ok(f.includes('"✅ Finalizar e Enviar"') && f.includes("data-pv-autorizo-bling-cadastro"));
  assert.ok(f.includes("disabled={Boolean(rodando) || (blingAusente && !autorizoCadastro)}"));
  assert.ok(f.includes("!(p.id === \"bling\" && blingAusente)"), "SKU ausente não vira 'decisão' separada");
});

test("2) Bling: pelo executor existente (confere antes, registra na ficha, não repete o que já foi feito)", () => {
  assert.ok(seg.includes('executarFinalizacao(fichaId, { marcadas: ["bling_criar"]') && seg.includes("if (!autorizoCadastro) return"));
  assert.ok(seg.indexOf("executarFinalizacao") < seg.indexOf("preparar(fichaId, { conta })") && seg.indexOf("preparar(fichaId, { conta })") < seg.indexOf("aprovarRevisaoEGravar"), "Bling → reconfere → aprova");
  assert.ok(f.includes('const blingAusente = (skuAusenteNoBling(row) || blingEmCurso) && opBling?.estado !== "ok";'), "cadastro já feito não aparece de novo; tentativa não confirmada continua pendente");
  assert.ok(seg.includes("O que já foi feito ficou salvo"), "erro mostra só a pendência e permite continuar");
});

test("3) não publica: termina abrindo a Publicação da MESMA ficha (confirmação final explícita lá)", () => {
  assert.ok(!/ml_publicar|publicar_item/.test(seg));
  assert.ok(seg.includes("abrirPublicacao(fichaId)") && seg.includes("p.fichaId !== fichaId"));
  assert.ok(f.includes("A publicação no Mercado Livre só acontece depois da sua confirmação final."));
});

test("4) (08/11) cadastro real no Bling pela ação existente, protegida no servidor; publicação no ML continua bloqueada nesta tela", () => {
  const reais = ler("src/modules/paiiaVoz/servicos/finalizarDepsReais.js");
  assert.ok(reais.includes("cadastrarNoBlingVoz(ctx.row, { chamarBling })") && reais.includes("conferirAntesVoz(ctx, { chamarBling })"));
  assert.ok(/async ml_publicar\(\) \{ return \{ ok: false, bloqueado: true/.test(reais));
});
