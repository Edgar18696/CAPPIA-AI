// Rodada 2: etapa 8 simplificada — ordem, um botão, Bling sem simulação de sucesso, estoque e fotos claros.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const f = ler("src/modules/paiiaVoz/FinalizarAnuncioVoz.jsx");

test("1) ordem: resumo → conta → modalidade → Bling → decisão → UM botão no final, só com conta", () => {
  const ordem = ["data-pv-finalizar-dados", "data-pv-finalizar-contas", "data-pv-modalidade", "data-pv-bling=", "data-pv-seguir=\"decisao\"", "data-pv-continuar-publicacao"].map((x) => f.indexOf(x));
  assert.ok(ordem.every((v, i) => v > 0 && (i === 0 || v > ordem[i - 1])), JSON.stringify(ordem));
  assert.ok(f.includes("{conta && (") && f.indexOf("{conta && (") < f.indexOf("data-pv-continuar-publicacao"), "sem conta, sem botão");
  assert.equal((f.match(/data-pv-continuar-publicacao/g) || []).length, 1);
});

test("2) Bling ausente: a autorização só aparece porque o cadastro real existe (ação protegida do servidor); a trava continua no código", () => {
  assert.ok(f.includes("const blingBloqueado = blingAusente && !criarBlingDisponivel;"));
  assert.ok(f.includes("const criarBlingDisponivel = true;"), "(08/11) cadastro real pela ação existente criar_produto");
  assert.ok(f.includes("data-pv-bling-pendencia") && f.includes("cadastro automático ainda não está disponível"), "a pendência clara continua para quando não houver cadastro");
  assert.ok(f.includes("{pronto && (contaAutomatica || (blingAusente && criarBlingDisponivel)) && ("));
  assert.ok(f.includes("!decisao && !blingBloqueado"));
});

test("3) estoque: 'Estoque da ficha' separado do 'Saldo oficial do Bling' (nunca alterado); fotos originais avisadas", () => {
  assert.ok(f.includes("<dt>Estoque da ficha</dt>") && f.includes("Saldo oficial do Bling: só consultado, nunca alterado."));
  assert.ok(!f.includes("estoque inicial 0"));
  assert.ok(f.includes("vai a foto ORIGINAL"));
});

test("4) categoria da etapa 7 reaproveitada; Clássico padrão com Premium opcional; barra com 8 colunas", () => {
  assert.ok(f.includes("const caminhoCat = vCat?.estado === \"ok\"") && f.includes("data-pv-trocar-premium"));
  assert.ok(ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx").includes("grid-template-columns: repeat(8, minmax(0, 1fr))"));
});
