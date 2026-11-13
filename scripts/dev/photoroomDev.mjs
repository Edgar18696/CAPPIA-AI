// =============================================================
// PAIIA — (13/11) Intermediário LOCAL do Photoroom (somente "npm run dev").
// O navegador/celular manda a foto para cá; este processo no computador chama
// o Photoroom com a chave e devolve só o RECORTE (PNG com transparência).
//   - Chave: PHOTOROOM_SANDBOX_KEY em C:\PAIIA\photoroom-teste.env (fora do
//     projeto). Lida a cada pedido; nunca vai para o navegador nem para logs.
//   - Padrão: chave "sandbox_" (grátis, com marca-d'água). Básico (PAGO, v1/segment)
//     só com PHOTOROOM_USAR_PRODUCAO=sim no arquivo e no máximo PHOTOROOM_LIMITE_LOCAL
//     fotos (padrão 3) por vez que o servidor local sobe.
//   - Em produção isto será a função do Supabase com a chave nos Secrets
//     (não publicada; depende de autorização).
// =============================================================
import fs from "node:fs";
import https from "node:https";

export const ROTA_PHOTOROOM_LOCAL = "/__paiia/photoroom-recorte";
export const ARQUIVO_CHAVE_PHOTOROOM = "C:\\PAIIA\\photoroom-teste.env";
const LIMITE_CORPO = 20 * 1024 * 1024;
const URL_EDIT = "https://image-api.photoroom.com/v2/edit";

/** Lê só a mesma linha (valor vazio não "puxa" a linha de baixo). */
export function lerChaveSandbox(texto) {
  const k = (String(texto || "").match(/^[ \t]*PHOTOROOM_SANDBOX_KEY[ \t]*=[ \t]*([^\s#]*)/m) || [])[1] || "";
  if (!k) return { ok: false, erro: "Chave Sandbox do Photoroom não configurada." };
  if (!k.startsWith("sandbox_")) return { ok: false, erro: "A chave configurada não é Sandbox: recusada para não gerar cobrança." };
  return { ok: true, chave: k };
}

/**
 * (13/11) Qual chave usar. Produção (Básico, PAGO) SÓ se o arquivo tiver as duas linhas:
 *   PHOTOROOM_API_KEY=<chave de produção>   e   PHOTOROOM_USAR_PRODUCAO=sim
 * Sem isso, continua na Sandbox (grátis).
 */
export function escolherChave(texto) {
  const t = String(texto || "");
  const linha = (nome) => (t.match(new RegExp(`^[ \\t]*${nome}[ \\t]*=[ \\t]*([^\\s#]*)`, "m")) || [])[1] || "";
  const producao = linha("PHOTOROOM_API_KEY");
  if (/^sim$/i.test(linha("PHOTOROOM_USAR_PRODUCAO"))) {
    if (!producao) return { ok: false, erro: "PHOTOROOM_USAR_PRODUCAO=sim, mas a chave de produção está vazia." };
    if (producao.startsWith("sandbox_")) return { ok: false, erro: "PHOTOROOM_API_KEY tem uma chave Sandbox." };
    const limite = Number.parseInt(linha("PHOTOROOM_LIMITE_LOCAL") || "3", 10);
    return { ok: true, modo: "producao", chave: producao, limite: Number.isFinite(limite) && limite >= 0 ? limite : 3 };
  }
  const s = lerChaveSandbox(t);
  return s.ok ? { ...s, modo: "sandbox" } : s;
}

/** Corpo multipart da Remove Background API (Básico, v1/segment): tamanho cheio, sem cortar. */
export function corpoBasico(imagem, tipo = "image/jpeg") {
  const limite = "----paiia" + Date.now();
  const campos = { format: "png", size: "full", crop: "false", channels: "rgba" };
  const partes = Object.entries(campos).map(([k, v]) => Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="image_file"; filename="foto"\r\nContent-Type: ${tipo}\r\n\r\n`), imagem, Buffer.from(`\r\n--${limite}--\r\n`));
  return { tipo: `multipart/form-data; boundary=${limite}`, corpo: Buffer.concat(partes) };
}

/** Tira qualquer pedaço de chave de uma mensagem antes de devolver/registrar. */
export const esconderChave = (t) => String(t || "").replace(/sandbox_[A-Za-z0-9_-]+/g, "sandbox_***").replace(/sk_pr_[A-Za-z0-9_-]+/g, "sk_pr_***");

/** Corpo multipart da Image Editing API (só remoção de fundo, peça na posição original). */
export function corpoPhotoroom(imagem, tipo = "image/jpeg") {
  const limite = "----paiia" + Date.now();
  const campos = { removeBackground: "true", referenceBox: "originalImage", outputSize: "originalImage", padding: "0", "export.format": "png" };
  const partes = Object.entries(campos).map(([k, v]) => Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  partes.push(Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="imageFile"; filename="foto"\r\nContent-Type: ${tipo}\r\n\r\n`), imagem, Buffer.from(`\r\n--${limite}--\r\n`));
  return { tipo: `multipart/form-data; boundary=${limite}`, corpo: Buffer.concat(partes) };
}

const URL_SEGMENT = "https://sdk.photoroom.com/v1/segment";

function chamarPhotoroom(chave, imagem, tipo, modo = "sandbox") {
  const basico = modo === "producao";
  const { tipo: ct, corpo } = basico ? corpoBasico(imagem, tipo) : corpoPhotoroom(imagem, tipo);
  const cabecalhos = { "x-api-key": chave, "Content-Type": ct, "Content-Length": corpo.length };
  if (!basico) cabecalhos["pr-hd-background-removal"] = "auto";
  return new Promise((ok, falha) => {
    const req = https.request(basico ? URL_SEGMENT : URL_EDIT, { method: "POST", headers: cabecalhos }, (res) => {
      const partes = [];
      res.on("data", (x) => partes.push(x));
      res.on("end", () => ok({ status: res.statusCode, corpo: Buffer.concat(partes) }));
    });
    req.on("error", falha);
    req.setTimeout(110000, () => req.destroy(new Error("Photoroom demorou mais de 110 s.")));
    req.end(corpo);
  });
}

// Sandbox põe a marca-d'água também na transparência; sem limpar, a "caixa" da
// peça cresce e ela sai pequena no 1200×1200. Só no TESTE Sandbox: alfa < 128 = fundo
// (a marca chega a ~100 de alfa; com 64 ainda sobrava). Produção não tem marca nem limpeza.
async function limparMarcaSandbox(png) {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const img = await loadImage(png);
  const c = createCanvas(img.width, img.height);
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height);
  for (let i = 3; i < d.data.length; i += 4) if (d.data[i] < 128) d.data[i] = 0;
  x.putImageData(d, 0, 0);
  return c.toBuffer("image/png");
}

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    const partes = [];
    let total = 0;
    req.on("data", (p) => { total += p.length; if (total > LIMITE_CORPO) { falha(new Error("Foto grande demais (máx. 20 MB).")); req.destroy(); } else partes.push(p); });
    req.on("end", () => ok(Buffer.concat(partes)));
    req.on("error", falha);
  });
}

export function criarMiddlewarePhotoroom({ arquivoChave = ARQUIVO_CHAVE_PHOTOROOM, chamar = chamarPhotoroom, limpar = limparMarcaSandbox } = {}) {
  let pagasNestaExecucao = 0; // (13/11) teto de fotos PAGAS por vez que o servidor local sobe
  return async (req, res, next) => {
    if (!String(req.url || "").startsWith(ROTA_PHOTOROOM_LOCAL)) return next();
    const responder = (status, obj) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
    if (req.method !== "POST") return responder(405, { ok: false, erro: "Use POST." });
    let texto = "";
    try { texto = fs.readFileSync(arquivoChave, "utf8"); } catch { /* sem arquivo */ }
    const k = escolherChave(texto);
    if (!k.ok) return responder(503, { ok: false, erro: k.erro });
    if (k.modo === "producao" && pagasNestaExecucao >= k.limite) {
      return responder(429, { ok: false, erro: `Limite local de ${k.limite} foto(s) paga(s) atingido nesta execução (PHOTOROOM_LIMITE_LOCAL).` });
    }
    try {
      const imagem = await lerCorpo(req);
      if (!imagem.length) return responder(400, { ok: false, erro: "Foto vazia." });
      if (k.modo === "producao") pagasNestaExecucao += 1; // conta antes (pedido enviado = pode cobrar)
      const r = await chamar(k.chave, imagem, String(req.headers["content-type"] || "image/jpeg"), k.modo);
      if (r.status !== 200) return responder(502, { ok: false, erro: `Photoroom ${r.status}: ${esconderChave(r.corpo.toString("utf8").slice(0, 200)).split(k.chave).join("***")}` });
      const png = k.modo === "sandbox" ? await limpar(r.corpo) : r.corpo;
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("X-Paiia-Recorte", k.modo === "producao" ? "photoroom-basico" : "photoroom-sandbox");
      res.end(png);
    } catch (e) {
      responder(502, { ok: false, erro: esconderChave(e?.message || e).split(k.chave).join("***") });
    }
  };
}
