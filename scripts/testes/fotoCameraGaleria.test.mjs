// =============================================================
// (09/11) Foto IA com a câmera do celular → Galeria PAIIA (original + tratada ligadas),
// tratamento automático, recuperação depois de fechar o navegador, sem duplicar;
// foto tirada no PAIIA Voz também entra na Galeria.
//   node --test scripts/testes/fotoCameraGaleria.test.mjs
// =============================================================
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const C = await import("../../src/services/fotoIA/fotoCameraGaleria.js");
const VR = await import("../../src/modules/paiiaVoz/servicos/galeriaVozRegistro.js");
const { armazenamentoMemoria } = await import("../../src/modules/paiiaVoz/servicos/fotosVozLocal.js");
const { listarFotosGaleria } = await import("../../src/modules/paiiaVoz/servicos/galeriaVoz.js");
const ler = (p) => fs.readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const U = "user-1";
const BASE = "https://x.supabase.co/storage/v1/object/public/imagens/";

// ---- Supabase falso (só o que estas funções usam) ----
function supabaseFalso() {
  const arquivos = new Map();
  const linhas = [];
  const log = { uploads: [], inserts: 0, updates: 0, deletes: 0, removes: 0 };
  let seq = 0;
  const storage = {
    from: () => ({
      async upload(caminho, blob, op) {
        log.uploads.push({ caminho, upsert: op?.upsert });
        if (arquivos.has(caminho) && !op?.upsert) return { error: { message: "exists" } };
        arquivos.set(caminho, blob);
        return { error: null };
      },
      getPublicUrl: (c) => ({ data: { publicUrl: BASE + c } }),
      async remove() { log.removes += 1; return { error: null }; },
    }),
  };
  function consulta() {
    const filtros = [];
    let modo = "select";
    let dados = null;
    let lim = Infinity;
    let ordem = null;
    const q = {
      select() { return q; },
      eq(c, v) { filtros.push((l) => l[c] === v); return q; },
      like(c, p) { const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`); filtros.push((l) => re.test(String(l[c] ?? ""))); return q; },
      gte(c, v) { filtros.push((l) => String(l[c]) >= v); return q; },
      not(c, op, v) { filtros.push((l) => (op === "is" ? l[c] !== v : !new RegExp(`^${String(v).replace(/%/g, ".*")}$`).test(String(l[c] ?? "")))); return q; },
      order(c, o) { ordem = { c, asc: o?.ascending !== false }; return q; },
      limit(n) { lim = n; return q; },
      range(a, b) { lim = b - a + 1; return q; },
      insert(rows) { modo = "insert"; dados = rows; return q; },
      update(v) { modo = "update"; dados = v; return q; },
      delete() { modo = "delete"; return q; },
      single() { q._single = true; return q; },
      then(ok, falha) { return Promise.resolve(exec()).then(ok, falha); },
    };
    function exec() {
      if (modo === "insert") {
        const novas = dados.map((r) => ({ id: `row-${++seq}`, created_at: new Date().toISOString(), ...r }));
        linhas.push(...novas);
        log.inserts += novas.length;
        return { data: q._single ? novas[0] : novas, error: null };
      }
      const alvo = linhas.filter((l) => filtros.every((f) => f(l)));
      if (modo === "update") { alvo.forEach((l) => Object.assign(l, dados)); log.updates += alvo.length; return { data: alvo.map((l) => ({ id: l.id })), error: null }; }
      if (modo === "delete") { log.deletes += 1; return { data: null, error: null }; }
      let r = [...alvo];
      if (ordem) r.sort((a, b) => (a[ordem.c] < b[ordem.c] ? -1 : 1) * (ordem.asc ? 1 : -1));
      return { data: r.slice(0, lim).map((l) => ({ ...l })), error: null };
    }
    return q;
  }
  return { storage, from: () => consulta(), arquivos, linhas, log };
}

const blob = (n = "foto.jpg") => Object.assign(new Blob(["x"], { type: "image/jpeg" }), { name: n });

function depsReais(sb, extra = {}) {
  const chamadas = { recorte: 0, chaves: [] };
  const deps = {
    salvarOriginal: (item) => C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item }),
    tratar: (item) => C.tratarFotoDaGaleria({
      supabase: sb, usuarioId: U, linhaId: item.linhaId, urlOriginal: item.url, caminho: item.caminho, original: item.blob,
      recortarFotoIA: async ({ chave }) => { chamadas.recorte += 1; chamadas.chaves.push(chave); if (extra.falhaRecorte) await extra.falhaRecorte(chamadas.recorte); return { recorteUrl: "https://prov/recorte.png" }; },
      comporFotoFinal: async () => ({ blob: new Blob(["png"], { type: "image/png" }), baixaResolucao: false }),
      baixar: async () => new Blob(["r"], { type: "image/png" }),
    }),
  };
  return { deps, chamadas };
}

test("1) Tirar Foto: original salva NA HORA na Galeria, tratamento automático liga a tratada à MESMA linha", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  const { deps, chamadas } = depsReais(sb);
  const eventos = [];
  const fila = C.criarFilaCamera({ armazenamento: arm, deps, aoMudar: (e) => eventos.push(e.tipo) });
  const [item] = await fila.adicionar([blob("peca 1.jpg")]);
  assert.equal(item.estado, "salvando");
  await fila.rodar();
  assert.equal(sb.linhas.length, 1, "uma linha na Galeria");
  const l = sb.linhas[0];
  assert.match(l.imagem_original, /\/originais\/camera-/);
  assert.match(l.imagem_processada, /\/processadas\/camera-row-1\.png$/);
  assert.equal(l.tipo, "foto");
  assert.equal(l.status, "processado");
  // (13/11) Pronta sai da fila do aparelho NA HORA; fica só na lista da sessão.
  assert.deepEqual(await fila.listar(), [], "miniatura saiu da fila");
  const [final] = fila.listarProntas();
  assert.equal(final.linhaId, "row-1");
  assert.match(final.urlTratada, /processadas\/camera-row-1\.png$/);
  assert.deepEqual(chamadas.chaves, ["camera-row-1"]);
  assert.ok(eventos.indexOf("salva") < eventos.indexOf("pronta"), "salva antes de tratar");
  assert.match(C.resumoCamera(await fila.listar(), fila.listarProntas()), /1 foto\(s\) salva\(s\) na Galeria · 1 tratada/);
  // compatível com a Galeria do Voz / Criar Anúncio: aparece como TRATADA, com a original ligada
  const g = await listarFotosGaleria(sb, U);
  assert.equal(g.fotos.length, 1);
  assert.equal(g.fotos[0].tratada, true);
  assert.equal(g.fotos[0].original, l.imagem_original);
});

test("2) Antes do tratamento a original já aparece na Galeria (não tratada); repetir não duplica nada", async () => {
  const sb = supabaseFalso();
  const item = { id: "cabc", blob: blob(), nome: "a.jpg" };
  const s1 = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item });
  const g = await listarFotosGaleria(sb, U);
  assert.equal(g.fotos.length, 1);
  assert.equal(g.fotos[0].tratada, false, "original: o Voz trata se escolhida");
  const s2 = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item });
  assert.equal(s1.linhaId, s2.linhaId);
  assert.equal(sb.linhas.length, 1, "repetir não cria outra linha");
  assert.equal(new Set(sb.log.uploads.map((u) => u.caminho)).size, 1, "mesmo arquivo (sobrescrito)");
  assert.ok(sb.log.uploads.every((u) => u.upsert === true));
  const dep = { supabase: sb, usuarioId: U, linhaId: s1.linhaId, urlOriginal: s1.url, caminho: s1.caminho, original: item.blob,
    recortarFotoIA: async () => ({ recorteUrl: "r" }), comporFotoFinal: async () => ({ blob: new Blob(["p"]) }), baixar: async () => new Blob(["r"]) };
  const t1 = await C.tratarFotoDaGaleria(dep);
  const t2 = await C.tratarFotoDaGaleria(dep);
  assert.equal(t1.ligou, true);
  assert.equal(t2.ligou, false, "já tratada: não troca de novo");
  assert.equal(sb.linhas.length, 1);
  assert.equal(sb.log.updates, 1);
  assert.equal(new Set(sb.log.uploads.filter((u) => /processadas/.test(u.caminho)).map((u) => u.caminho)).size, 1);
  assert.equal(sb.log.deletes + sb.log.removes, 0, "nada apagado");
});

test("3) Falha no tratamento: original preservada, nova tentativa automática, depois 'Tentar de novo'", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  let t = 1_000_000;
  let falhar = true;
  const { deps } = depsReais(sb, { falhaRecorte: async () => { if (falhar) throw Object.assign(new Error("Sem resposta do servidor"), { temporario: true }); } });
  const fila = C.criarFilaCamera({ armazenamento: arm, deps, agora: () => t });
  await fila.adicionar([blob()]);
  await fila.rodar();
  let [i] = await fila.listar();
  assert.equal(i.estado, "salva", "volta para a fila");
  assert.ok(i.proximaEm > t);
  assert.equal(sb.linhas[0].imagem_processada, sb.linhas[0].imagem_original, "Galeria com a original");
  await fila.rodar(); // antes da hora: não tenta
  assert.equal((await fila.listar())[0].tentativas, 1);
  t += 60 * 60_000; await fila.rodar();
  t += 60 * 60_000; await fila.rodar();
  [i] = await fila.listar();
  assert.equal(i.estado, "falhou");
  assert.equal(i.tentativas, C.MAX_TENTATIVAS_AUTO);
  falhar = false;
  await fila.tentarDeNovo(i.id);
  assert.deepEqual(await fila.listar(), [], "pronta saiu da fila");
  assert.equal(fila.listarProntas().length, 1);
  assert.equal(sb.linhas.length, 1);
  // erro de regra (limite do mês): não repete sozinho
  const sb2 = supabaseFalso();
  const { deps: d2 } = depsReais(sb2, { falhaRecorte: async () => { throw Object.assign(new Error("limite"), { codigo: "LIMITE_MENSAL", temporario: false }); } });
  const f2 = C.criarFilaCamera({ armazenamento: armazenamentoMemoria(), deps: d2 });
  await f2.adicionar([blob()]);
  await f2.rodar();
  assert.equal((await f2.listar())[0].estado, "falhou");
  assert.equal(sb2.linhas.length, 1, "original continua na Galeria");
});

test("4) Fechou o navegador no meio: a fila do aparelho continua ao abrir de novo (sem duplicar)", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  // a) fechou enquanto salvava
  await arm.put({ id: "c1", blob: blob(), nome: "a.jpg", criadaEm: 1, estado: "salvando", tentativas: 0 });
  // b) fechou enquanto tratava (original já na Galeria)
  const s = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item: { id: "c2", blob: blob(), nome: "b.jpg" } });
  await arm.put({ id: "c2", blob: blob(), nome: "b.jpg", criadaEm: 2, estado: "tratando", tentativas: 0, ...s });
  const { deps, chamadas } = depsReais(sb);
  const fila = C.criarFilaCamera({ armazenamento: arm, deps }); // "abriu o PAIIA de novo"
  await Promise.all([fila.rodar(), fila.rodar()]); // duas chamadas juntas = uma passada
  assert.deepEqual(await fila.listar(), [], "as duas saíram da fila");
  assert.equal(fila.listarProntas().length, 2);
  assert.equal(sb.linhas.length, 2);
  assert.equal(chamadas.recorte, 2, "cada foto tratada uma vez");
});

test("5) Outro aparelho da conta retoma fotos da câmera sem tratamento (só depois de 10 min, uma vez)", async () => {
  const sb = supabaseFalso();
  const agora = Date.parse("2026-11-09T12:00:00Z");
  const em = (min) => new Date(agora - min * 60_000).toISOString();
  const cam = (n) => `${BASE}${U}/originais/camera-c${n}-a.jpg`;
  sb.linhas.push(
    { id: "a", user_id: U, tipo: "foto", created_at: em(30), imagem_original: cam(1), imagem_processada: cam(1) }, // retoma
    { id: "b", user_id: U, tipo: "foto", created_at: em(2), imagem_original: cam(2), imagem_processada: cam(2) }, // recente: o celular ainda pode estar tratando
    { id: "c", user_id: U, tipo: "foto", created_at: em(30), imagem_original: cam(3), imagem_processada: `${BASE}x.png` }, // já tratada
    { id: "d", user_id: U, tipo: "foto", created_at: em(30), imagem_original: `${BASE}${U}/originais/1-voz.jpg`, imagem_processada: `${BASE}${U}/originais/1-voz.jpg` }, // do Voz: não trata sozinho
    { id: "e", user_id: U, tipo: "foto", created_at: em(60 * 50), imagem_original: cam(5), imagem_processada: cam(5) }, // antiga demais
    { id: "f", user_id: "outro", tipo: "foto", created_at: em(30), imagem_original: cam(6), imagem_processada: cam(6) },
  );
  const tratadas = [];
  const ja = new Set();
  const r = await C.retomarDeOutrosAparelhos({ supabase: sb, usuarioId: U, agora, ja, tratar: async (x) => { tratadas.push(x); } });
  assert.equal(r.tratadas, 1);
  assert.deepEqual(tratadas.map((x) => x.linhaId), ["a"]);
  assert.equal(tratadas[0].caminho, `${U}/originais/camera-c1-a.jpg`);
  const r2 = await C.retomarDeOutrosAparelhos({ supabase: sb, usuarioId: U, agora, ja, tratar: async (x) => { tratadas.push(x); } });
  assert.equal(r2.tratadas, 0, "uma vez por abertura");
  const r3 = await C.retomarDeOutrosAparelhos({ supabase: sb, usuarioId: U, agora, locais: new Set(["a"]), tratar: async () => {} });
  assert.equal(r3.tratadas, 0, "a fila deste aparelho já cuida dela");
});

test("6) PAIIA Voz: foto tirada entra na Galeria na hora; tratada ligada à mesma linha; sem duplicar", async () => {
  const sb = supabaseFalso();
  const envios = { original: 0, tratada: 0 };
  const deps = {
    supabase: sb, usuarioId: U,
    garantirOriginal: async (reg) => { if (!reg.nuvem?.original) { envios.original += 1; reg.nuvem = { ...(reg.nuvem || {}), original: { url: `${BASE}${U}/originais/${reg.id}.jpg` } }; } return reg.nuvem.original; },
    garantirTratada: async (reg) => { envios.tratada += 1; return { url: `${BASE}${U}/prontas/1200x1200-voz-${reg.id}.png` }; },
  };
  const reg = { id: "f1", blob: blob(), versao: "original" };
  const r1 = await VR.registrarFotoVozNaGaleria(reg, deps);
  assert.ok(r1.linhaId);
  let g = await listarFotosGaleria(sb, U);
  assert.equal(g.fotos.length, 1, "aparece na Galeria logo depois de tirar");
  assert.equal(g.fotos[0].tratada, false);
  reg.tratada = { blob: new Blob(["p"]), em: 5 };
  reg.versao = "tratada";
  const r2 = await VR.registrarFotoVozNaGaleria(reg, deps);
  assert.equal(r2.linhaId, r1.linhaId);
  assert.equal(r2.tratadaLigada, true);
  await VR.registrarFotoVozNaGaleria(reg, deps);
  g = await listarFotosGaleria(sb, U);
  assert.equal(g.fotos.length, 1, "sem linha duplicada");
  assert.equal(g.fotos[0].tratada, true);
  assert.equal(envios.original, 1, "original enviada uma vez");
  // foto que veio da Galeria não é registrada de novo; sem login: nada
  assert.equal(await VR.registrarFotoVozNaGaleria({ id: "g", ia: { origem: "galeria" } }, deps), null);
  assert.equal(await VR.registrarFotoVozNaGaleria(reg, { ...deps, usuarioId: "" }), null);
  assert.equal(sb.linhas.length, 1);
  assert.notEqual(VR.marcaRegistro({ id: "a" }), VR.marcaRegistro({ id: "a", tratada: { blob: 1, em: 2 } }));
});

test("7) Telas: Foto IA com Tirar Foto (câmera) e Escolher Foto; lotes de até 8 preservados; fila em segundo plano no App; Voz registra na Galeria", () => {
  const foto = ler("src/modules/fotoIA/FotoIA.jsx");
  assert.match(foto, /TirarFotoCamera/);
  assert.match(foto, /files\.length > 8/, "limite do lote mantido");
  assert.match(foto, /processarSelecionadas/, "Produzir Foto IA mantido");
  const cam = ler("src/modules/fotoIA/components/TirarFotoCamera.jsx");
  assert.match(cam, /capture="environment"/);
  assert.match(cam, /data-paiia-tirar-foto/);
  assert.match(cam, /data-paiia-escolher-foto/);
  assert.match(cam, /Tentar de novo/);
  const app = ler("src/App.jsx");
  assert.match(app, /<FotosCameraSegundoPlano userId=\{usuario\?\.id\}/);
  const voz = ler("src/modules/paiiaVoz/PaiiaVozRapido.jsx");
  assert.match(voz, /registrarFotoVozNaGaleria/);
  // funções oficiais do Foto IA intactas
  const pipe = ler("src/services/fotoIA/pipelineFotoIA.js");
  assert.match(pipe, /export async function recortarFotoIA/);
  assert.match(pipe, /upsert: false/);
});

test("13/11) recorte GRÁTIS no aparelho primeiro; Replicate só como reserva; nada apagado", async () => {
  const sb = supabaseFalso();
  const item = { id: "cl1", blob: blob(), nome: "a.jpg" };
  const s = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item });
  let servidor = 0;
  let local = 0;
  const base = { supabase: sb, usuarioId: U, linhaId: s.linhaId, urlOriginal: s.url, caminho: s.caminho, original: item.blob,
    recortarFotoIA: async () => { servidor += 1; return { recorteUrl: "r" }; },
    comporFotoFinal: async ({ recorte }) => ({ blob: new Blob(["p"]), usado: recorte }), baixar: async () => new Blob(["srv"]) };
  const t1 = await C.tratarFotoDaGaleria({ ...base, recortarLocal: async (b) => { local += 1; assert.equal(b, item.blob, "recorta a própria foto"); return { blob: new Blob(["loc"]) }; } });
  assert.equal(t1.metodo, "local");
  assert.equal(servidor, 0, "sem crédito da Replicate");
  // local falhou (ex.: peça não identificada) → reserva do servidor
  const sb2 = supabaseFalso();
  const s2 = await C.salvarOriginalNaGaleria({ supabase: sb2, usuarioId: U, item: { id: "cl2", blob: blob(), nome: "b.jpg" } });
  const t2 = await C.tratarFotoDaGaleria({ ...base, supabase: sb2, linhaId: s2.linhaId, urlOriginal: s2.url, caminho: s2.caminho, recortarLocal: async () => { throw new Error("Não foi possível identificar a peça"); } });
  assert.equal(t2.metodo, "servidor");
  assert.equal(servidor, 1);
  assert.equal(local, 1);
  assert.equal(sb.log.deletes + sb.log.removes + sb2.log.deletes + sb2.log.removes, 0, "nada apagado da Galeria");
});

test("13/11) Salvar no celular: menu do aparelho com 1 toque; sem menu baixa; cancelar não marca", async () => {
  const { salvarNoAparelho } = await import("../../src/services/fotoIA/salvarNoAparelho.js");
  const prontas = [{ id: "a", linhaId: "row-1", urlTratada: "u1" }, { id: "b", linhaId: "row-2", urlTratada: "u2" }, { id: "c" }];
  const deps = (navegador) => {
    const baixados = [];
    return { baixados, d: { baixar: async (u) => new Blob([u], { type: "image/png" }), navegador, criarArquivo: (b, nome) => ({ b, nome }), baixarArquivo: (b, nome) => baixados.push(nome) } };
  };
  let compartilhado = null;
  const celular = { canShare: ({ files }) => files.length > 0, share: async (o) => { compartilhado = o; } };
  const r1 = deps(celular);
  const s1 = await salvarNoAparelho(prontas, r1.d);
  assert.equal(s1.modo, "compartilhar");
  assert.deepEqual(s1.ids, ["a", "b"], "só as que têm foto tratada");
  assert.deepEqual(compartilhado.files.map((f) => f.nome), ["paiia-row-1-1200x1200.png", "paiia-row-2-1200x1200.png"]);
  assert.equal(r1.baixados.length, 0);
  const r2 = deps({});
  const s2 = await salvarNoAparelho(prontas, r2.d);
  assert.equal(s2.modo, "download");
  assert.equal(r2.baixados.length, 2);
  const r3 = deps({ canShare: () => true, share: async () => { throw Object.assign(new Error("x"), { name: "AbortError" }); } });
  const s3 = await salvarNoAparelho(prontas, r3.d);
  assert.equal(s3.modo, "cancelado");
  assert.deepEqual(s3.ids, []);
  assert.equal(r3.baixados.length, 0);
});

test("13/11) fila: marcarSalvas e prontas antigas (24 h) saem na faxina", async () => {
  const arm = armazenamentoMemoria();
  await arm.put({ id: "velha", estado: "pronta", criadaEm: 1, prontaEm: Date.now() });
  const sb = supabaseFalso();
  const { deps } = depsReais(sb);
  const fila = C.criarFilaCamera({ armazenamento: arm, deps });
  await fila.adicionar([blob()]);
  await fila.rodar();
  assert.deepEqual(await fila.listar(), []);
  const [p] = fila.listarProntas();
  fila.marcarSalvas([p.id]);
  assert.equal(fila.listarProntas()[0].salvaNoAparelho, true);
});

test("13/11) tratamento que não termina: depois do limite volta para nova tentativa (não fica 'tratando' para sempre)", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  let travar = true;
  const { deps } = depsReais(sb);
  const tratarReal = deps.tratar;
  deps.tratar = (item) => (travar ? new Promise(() => {}) : tratarReal(item));
  const fila = C.criarFilaCamera({ armazenamento: arm, deps, limiteTratamentoMs: 30 });
  await fila.adicionar([blob()]);
  await fila.rodar();
  let [i] = await fila.listar();
  assert.equal(i.estado, "salva", "voltou para a fila (não 'tratando')");
  assert.match(i.erro, /demorou demais/);
  assert.ok(i.proximaEm > 0, "nova tentativa automática agendada");
  assert.equal(sb.linhas[0].imagem_original, sb.linhas[0].imagem_processada, "original preservada na Galeria");
  travar = false;
  await fila.tentarDeNovo(i.id);
  assert.deepEqual(await fila.listar(), []);
  assert.equal(fila.listarProntas().length, 1);
});

test("13/11) servidor de teste no celular: sem recarga automática quando PAIIA_TESTE_CELULAR=1", () => {
  const cfg = ler("vite.config.js");
  assert.match(cfg, /globalThis\.process\?\.env\?\.PAIIA_TESTE_CELULAR === "1" \? \{ server: \{ ws: false \} \} : \{\}/);
});

test("14/11) fotos travadas pelo limite antigo de 50 ganham UMA nova tentativa pelo caminho novo", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  const s = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item: { id: "velha", blob: blob(), nome: "a.jpg" } });
  // como ficou no site antigo: falhou pelo limite do foto-ia, original na Galeria
  await arm.put({ id: "velha", blob: blob(), nome: "a.jpg", criadaEm: Date.now(), estado: "falhou", tentativas: 1, erro: "Você atingiu o limite de 50 Fotos IA deste mês.", ...s });
  const { deps, chamadas } = depsReais(sb);
  const fila = C.criarFilaCamera({ armazenamento: arm, deps });
  await fila.rodar();
  assert.deepEqual(await fila.listar(), [], "tratada e fora da fila");
  assert.equal(fila.listarProntas().length, 1);
  assert.equal(chamadas.recorte, 1);
  // se falhar de novo pelo limite, NÃO reabre em loop
  const arm2 = armazenamentoMemoria();
  const sb2 = supabaseFalso();
  const s2 = await C.salvarOriginalNaGaleria({ supabase: sb2, usuarioId: U, item: { id: "v2", blob: blob(), nome: "b.jpg" } });
  await arm2.put({ id: "v2", blob: blob(), nome: "b.jpg", criadaEm: Date.now(), estado: "falhou", tentativas: 1, erro: "Você atingiu o limite de 50 Fotos IA deste mês.", ...s2 });
  const { deps: d2, chamadas: c2 } = depsReais(sb2, { falhaRecorte: async () => { throw Object.assign(new Error("Você atingiu o limite de 50 Fotos IA deste mês."), { codigo: "LIMITE_MENSAL", temporario: false }); } });
  const f2 = C.criarFilaCamera({ armazenamento: arm2, deps: d2 });
  await f2.rodar();
  await f2.rodar();
  await f2.rodar();
  assert.equal(c2.recorte, 1, "só uma nova tentativa");
  const [i2] = await f2.listar();
  assert.equal(i2.estado, "falhou");
  assert.equal(i2.reaberta, true);
});

test("14/11) falhas antigas saem da fila depois de 24 h; foto só no aparelho nunca sai; 'Remover da fila' não apaga a Galeria", async () => {
  const sb = supabaseFalso();
  const arm = armazenamentoMemoria();
  let t = Date.parse("2026-11-14T12:00:00Z");
  const { deps } = depsReais(sb);
  const fila = C.criarFilaCamera({ armazenamento: arm, deps, agora: () => t });
  const s = await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item: { id: "f1", blob: blob(), nome: "a.jpg" } });
  await arm.put({ id: "f1", blob: blob(), criadaEm: t, estado: "falhou", erro: "Fundo branco não aplicado: …", falhouEm: t - 25 * 3600_000, ...s });
  await arm.put({ id: "f2", blob: blob(), criadaEm: t, estado: "falhou", erro: "Fundo branco não aplicado: …", falhouEm: t - 3600_000, ...(await C.salvarOriginalNaGaleria({ supabase: sb, usuarioId: U, item: { id: "f2", blob: blob(), nome: "b.jpg" } })) });
  await arm.put({ id: "f3", blob: blob(), criadaEm: t - 30 * 3600_000, estado: "falhou", erro: "sem rede", falhouEm: t - 30 * 3600_000 }); // sem linhaId: original só no aparelho
  await fila.faxina();
  const ids = (await fila.listar()).map((i) => i.id).sort();
  assert.deepEqual(ids, ["f2", "f3"], "a de 25 h saiu; a recente fica; a que só existe no aparelho nunca sai");
  assert.equal(await fila.removerDaFila("f3"), false, "sem original na Galeria: não remove");
  assert.equal(await fila.removerDaFila("f2"), true);
  assert.deepEqual((await fila.listar()).map((i) => i.id), ["f3"]);
  assert.equal(sb.linhas.length, 2, "as duas originais continuam na Galeria");
  assert.equal(sb.log.deletes + sb.log.removes, 0, "nada apagado do Supabase");
  assert.equal(C.ROTULO_CAMERA.falhou, "fundo branco não aplicado · a original está salva na Galeria");
});
