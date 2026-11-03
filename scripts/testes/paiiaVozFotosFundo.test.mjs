// =============================================================
// PAIIA Voz — Pacote B (03/11/2026): fotos em segundo plano.
//   node --test scripts/testes/paiiaVozFotosFundo.test.mjs
// Sem rede e sem Foto IA: só o reenvio do que já está pronto no aparelho.
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { situacaoEnvioFotos, sincronizarFichaVoz } from "../../src/modules/paiiaVoz/servicos/fichaVozNuvem.js";

const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const foto = (x = {}) => ({ usar: true, original: true, versao: "tratada", tratadaPronta: true, tratadaEnviada: true, tratando: false, ...x });

test("aviso único: conta o que falta enviar e o que ainda está em preparo", () => {
  assert.equal(situacaoEnvioFotos([foto(), foto(), foto(), foto()]).texto, "", "tudo na ficha: sem aviso");
  const s = situacaoEnvioFotos([foto({ tratadaEnviada: false }), foto({ tratadaEnviada: false }), foto(), foto({ tratando: true, tratadaPronta: false, versao: "original" })]);
  assert.equal(s.estado, "enviando");
  assert.equal(s.enviando, 2);
  assert.equal(s.tratando, 1);
  assert.match(s.texto, /2 foto\(s\) enviando para a ficha · 1 com fundo branco em preparo — em segundo plano, pode continuar preenchendo/);
  assert.match(situacaoEnvioFotos([foto({ original: false })], { falhou: true }).texto, /tento de novo sozinho/);
  assert.match(situacaoEnvioFotos([foto({ original: false })], { temCodigo: false }).texto, /assim que o código for informado/);
  assert.equal(situacaoEnvioFotos([foto({ usar: false, original: false })]).texto, "", "foto desmarcada não conta");
  assert.equal(situacaoEnvioFotos([]).texto, "");
});

function depsFalhaUmaVez() {
  const nuvem = {};
  let falhas = 1;
  const enviosTratada = [];
  const guarda = { salvarNuvem: async (id, x) => { nuvem[id] = { ...(nuvem[id] || {}), ...x }; } };
  const salvas = [];
  return {
    nuvem, enviosTratada, salvas,
    deps: {
      usuarioId: "u1", guarda,
      enviarOriginal: async (reg) => ({ caminho: `o/${reg.id}`, url: `https://f/o-${reg.id}.jpg` }),
      enviarTratada: async (reg) => { enviosTratada.push(reg.id); if (falhas-- > 0) throw new Error("rede caiu"); return { caminho: `t/${reg.id}`, url: `https://f/t-${reg.id}.png` }; },
      lerFicha: async () => ({ ok: true, ficha: { id: "F1", status_fluxo: "rascunho", dados_conferencia: { etapa_fluxo: "novo_anuncio", novo_anuncio: {}, paiia_voz: {} } } }),
      salvarFicha: async (a) => { salvas.push(a); return { ok: true, fichaId: "F1" }; },
    },
  };
}

test("falha no envio de uma foto: nada se perde e a próxima tentativa envia (sem Foto IA)", async () => {
  const m = depsFalhaUmaVez();
  const regs = ["a", "b"].map((id) => ({ id, nome: id, usarNoAnuncio: true, versao: "tratada", tratada: { blob: { type: "image/png" }, em: 5 } }));
  const voz = { fichaVozId: "v", fichaIdPAIIA: "F1", codigo: "242101345R", titulo: "Presilha", descricao: "x", preco: "", oem: "" };
  const r1 = await sincronizarFichaVoz(voz, regs, m.deps);
  assert.equal(r1.ok, true);
  assert.equal(r1.erros.length, 1, "1 foto falhou, a outra foi");
  // a ficha recebe a ORIGINAL da que falhou (nunca fica sem foto)
  assert.deepEqual(m.salvas[0].montado.novo_anuncio.fotos, ["https://f/o-a.jpg", "https://f/t-b.png"]);
  const regs2 = regs.map((r) => ({ ...r, nuvem: m.nuvem[r.id] }));
  const r2 = await sincronizarFichaVoz(voz, regs2, m.deps);
  assert.equal(r2.erros.length, 0);
  assert.deepEqual(m.salvas[1].montado.novo_anuncio.fotos, ["https://f/t-a.png", "https://f/t-b.png"]);
  assert.deepEqual(m.enviosTratada, ["a", "b", "a"], "só reenvia a que falhou");
});

test("tela: aviso em todas as etapas, nova tentativa automática e retomada ao voltar — sem acionar o Foto IA", () => {
  const f = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.ok(f.includes("data-pr-envio-fundo"));
  const iAviso = f.indexOf("data-pr-envio-fundo");
  const iFotos = f.indexOf('{etapa === "fotos" && (');
  assert.ok(iAviso > 0 && iAviso < iFotos, "o aviso fica fora das etapas (aparece em todas)");
  assert.ok(f.includes("if (!usuario?.id || !nuvem.repetir) return undefined;") && f.includes("setTimeout(() => { sincronizar(); }, 20000)"));
  assert.ok(f.includes('document.addEventListener("visibilitychange", retomar)') && f.includes('window.addEventListener("online", retomar)'));
  // o reenvio chama só a sincronização (envio do que está pronto), nunca a fila do Foto IA
  const bloco = f.slice(f.indexOf("// (03/11/2026) Envio em segundo plano"), f.indexOf("const envioFotos"));
  assert.ok(!/filaRef|enfileirar|executar|recortarFotoIA/.test(bloco));
  assert.ok(!f.includes("☁️ Enviando o fundo branco…"));
});
