// =============================================================
// PAIIA — TESTES: aviso de compatibilidade fiel ao que está gravado (17/10/2026).
//   node --test scripts/testes/compatModelosRegistrados.test.mjs
// Caso 510959620: modelos registrados SEM motor/ano ficavam gravados, mas a
// Publicação dizia "nenhuma aplicação estruturada foi cadastrada" e mandava
// voltar à Conferência — o usuário repetia o cadastro e o aviso continuava.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { textoSoModelosSemDetalhes, situacaoCompatibilidade, lerAplicacoesAprovadas, separarAplicacoesParaML, TEXTO_SEM_APLICACAO } from "../../src/services/compatibilidadeML.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ler = (r) => fs.readFileSync(path.join(RAIZ, r), "utf8").replace(/\r\n/g, "\n");

test("1) texto dos modelos registrados cita o que está gravado e não diz 'nada cadastrado'", () => {
  const t = textoSoModelosSemDetalhes([{ montadora: "Volkswagen", modelo: "Jetta" }, { montadora: "Volkswagen", modelo: "Golf" }]);
  assert.match(t, /Modelos registrados e gravados na ficha: Volkswagen Jetta, Volkswagen Golf/);
  assert.match(t, /sem motor e sem ano/);
  assert.equal(/foi cadastrada/.test(t), false);
  assert.notEqual(t, TEXTO_SEM_APLICACAO);
});

test("2) texto aprovado só com modelos: vira 'sem detalhes' (não vai à tabela do ML) — regra mantida", () => {
  const ap = lerAplicacoesAprovadas({ texto: "VOLKSWAGEN\n\n• Jetta" });
  const s = separarAplicacoesParaML(ap);
  assert.equal(s.detalhadas.length, 0);
  assert.equal(s.semDetalhes.length, 1);
  // a proteção continua: sem aplicação detalhada e sem autorização = bloqueia
  assert.equal(situacaoCompatibilidade({ aplicacoes: s.detalhadas, semCompatibilidadeConfirmada: false }).bloqueia, true);
  assert.equal(situacaoCompatibilidade({ aplicacoes: s.detalhadas, semCompatibilidadeConfirmada: true }).bloqueia, false);
});

test("3) telas: Publicação e Conferência usam o texto dos modelos registrados; catálogo sem versão é AVISO", () => {
  const rev = ler("src/components/RevisaoPublicacaoML.jsx");
  assert.match(rev, /modelosSemDetalhes\.length\s*\n?\s*\? textoSoModelosSemDetalhes\(modelosSemDetalhes\)/);
  assert.match(rev, /semCompatOpcao: true, texto: modelosSemDetalhes\.length/);
  assert.match(rev, /nivel: "aviso", texto: `\$\{aplicacoes\.length\} aplicação\(ões\) registrada\(s\) e gravada\(s\) na ficha, mas nenhuma versão do catálogo/);
  const conf = ler("src/components/MercadoLivreTeste.jsx");
  assert.match(conf, /modelosSemDetalhes\.length \? textoSoModelosSemDetalhes\(modelosSemDetalhes\) : TEXTO_SEM_APLICACAO/);
});
