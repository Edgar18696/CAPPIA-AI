// Servidor local da IA do Banner Express (somente "npm run dev" / localhost).
// Faz no próprio computador o que a função Supabase "banner-openai" fará
// depois do deploy: recebe a foto real posicionada e pede à OpenAI o cenário.
// A chave fica só no computador: OPENAI_API_KEY no arquivo .env.local do
// projeto (ignorado pelo git) ou nas variáveis de ambiente do Windows.
// A chave nunca vai para o navegador nem aparece nos logs.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  gerarCenarioOpenAI,
  montarPromptBanner,
  dataUrlParaBytes,
} from "../../src/services/banner/openaiBannerComum.js";

export const ROTA_BANNER_OPENAI_LOCAL = "/__paiia/banner-openai";
const LIMITE_CORPO = 25 * 1024 * 1024;

function lerVariavelDosArquivos(raiz, nome) {
  for (const arquivo of [".env.local", ".env"]) {
    try {
      const texto = fs.readFileSync(path.join(raiz, arquivo), "utf8");
      for (const linha of texto.split(/\r?\n/)) {
        const encontrado = linha.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (encontrado && encontrado[1] === nome) {
          return encontrado[2].replace(/^["']|["']$/g, "").trim();
        }
      }
    } catch {
      // arquivo não existe
    }
  }
  return "";
}

// Windows: variável criada depois que o terminal/Explorer já estava aberto
// não aparece em process.env; lê direto do registro (usuário e sistema).
// O valor fica só na memória deste processo e nunca é registrado.
function lerVariavelDoWindows(nome) {
  if (process.platform !== "win32") return "";
  const chaves = [
    "HKCU\\Environment",
    "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
  ];
  for (const chave of chaves) {
    try {
      const saida = execFileSync("reg", ["query", chave, "/v", nome], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      const linha = saida.split(/\r?\n/).find((l) => l.trim().startsWith(nome));
      const valor = linha ? linha.trim().split(/\s+REG_(?:EXPAND_)?SZ\s+/)[1] : "";
      if (valor && valor.trim()) return valor.trim();
    } catch {
      // variável não existe nesse local
    }
  }
  return "";
}

export function lerConfiguracaoLocal(raiz) {
  let origemChave = "";
  let apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (apiKey) origemChave = "variável de ambiente do processo";
  if (!apiKey) {
    apiKey = lerVariavelDosArquivos(raiz, "OPENAI_API_KEY");
    if (apiKey) origemChave = ".env.local/.env do projeto";
  }
  if (!apiKey) {
    apiKey = lerVariavelDoWindows("OPENAI_API_KEY");
    if (apiKey) origemChave = "variável de ambiente do Windows";
  }
  return {
    apiKey,
    origemChave,
    modelo:
      String(process.env.OPENAI_BANNER_MODELO || "").trim() ||
      lerVariavelDosArquivos(raiz, "OPENAI_BANNER_MODELO") ||
      "gpt-image-2",
    qualidade:
      String(process.env.OPENAI_BANNER_QUALIDADE || "").trim() ||
      lerVariavelDosArquivos(raiz, "OPENAI_BANNER_QUALIDADE") ||
      "medium",
    // Só para testes automatizados (servidor OpenAI simulado).
    baseUrl: String(process.env.PAIIA_OPENAI_BASE_URL || "https://api.openai.com"),
  };
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const partes = [];
    req.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > LIMITE_CORPO) {
        reject(new Error("CORPO_GRANDE"));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    req.on("error", reject);
  });
}

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(corpo));
}

function registrarLog(raiz, linha) {
  const texto = `${new Date().toISOString()} ${linha}`;
  console.log(`[PAIIA Banner IA] ${linha}`);
  try {
    const pasta = path.join(raiz, "logs");
    fs.mkdirSync(pasta, { recursive: true });
    fs.appendFileSync(path.join(pasta, "banner-openai-local.log"), `${texto}\n`);
  } catch {
    // log em arquivo é opcional
  }
  return texto;
}

function ehLocal(req) {
  const ip = String(req.socket?.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function criarMiddlewareBannerOpenAI(raiz, opcoes = {}) {
  const fetchImpl = opcoes.fetchImpl || fetch;
  const historico = [];

  return async function middlewareBannerOpenAI(req, res, next) {
    const url = String(req.url || "").split("?")[0];
    if (!url.startsWith(ROTA_BANNER_OPENAI_LOCAL)) return next();
    if (!ehLocal(req)) {
      return responder(res, 403, { sucesso: false, codigo: "SO_LOCALHOST", erro: "Disponível só no próprio computador." });
    }

    const config = lerConfiguracaoLocal(raiz);

    // Diagnóstico: GET /__paiia/banner-openai/status (sem mostrar a chave)
    if (req.method === "GET") {
      return responder(res, 200, {
        servidorLocal: true,
        chaveConfigurada: Boolean(config.apiKey),
        origemChave: config.origemChave,
        modeloPreferido: config.modelo,
        qualidade: config.qualidade,
        ultimasChamadas: historico.slice(-10),
      });
    }
    if (req.method !== "POST") {
      return responder(res, 405, { sucesso: false, erro: "Método não permitido." });
    }
    if (!config.apiKey) {
      registrarLog(raiz, "FALHA SEM_CHAVE: OPENAI_API_KEY não encontrada no .env.local nem no Windows.");
      return responder(res, 503, {
        sucesso: false,
        codigo: "SEM_CHAVE",
        erro: "OPENAI_API_KEY não encontrada. Coloque a chave no arquivo .env.local do projeto (use ATIVAR_OPENAI_LOCAL.ps1).",
      });
    }

    let corpo;
    try {
      corpo = JSON.parse(await lerCorpo(req));
    } catch {
      return responder(res, 400, { sucesso: false, codigo: "PEDIDO_INVALIDO", erro: "Pedido inválido." });
    }

    const referencia = dataUrlParaBytes(corpo.referencia);
    if (!referencia || referencia.length < 1000) {
      return responder(res, 422, { sucesso: false, codigo: "SEM_FOTO", erro: "Foto do produto ausente." });
    }
    const mascara = dataUrlParaBytes(corpo.mascara);
    const prompt = montarPromptBanner({
      paleta: corpo.paleta,
      estilo: corpo.estilo,
      cenario: corpo.cenario,
      zonasLivres: corpo.zonasLivres,
      pedestal: Boolean(corpo.pedestal),
      modo: String(corpo.modo || ""),
      zonaProduto: String(corpo.zonaProduto || ""),
      direcao: String(corpo.direcao || ""),
      objetivoDiretor: String(corpo.objetivoDiretor || ""),
      luz: String(corpo.luz || ""),
      baseProduto: String(corpo.baseProduto || ""),
      semente: Number(corpo.variacao) || 0,
    });

    registrarLog(raiz, `pedido: tamanho=${corpo.tamanho} formato=${corpo.formato} cenario=${corpo.cenario} modelo=${config.modelo} qualidade=${config.qualidade} mascara=${mascara ? "sim" : "não"} modo=${corpo.modo || "padrao"}`);
    let resultado;
    try {
      resultado = await gerarCenarioOpenAI({
        apiKey: config.apiKey,
        referencia,
        mascara,
        tamanho: String(corpo.tamanho || "1024x1024"),
        qualidade: config.qualidade,
        modeloPreferido: config.modelo,
        prompt,
        fetchImpl,
        baseUrl: config.baseUrl,
      });
    } catch (erro) {
      const linha = registrarLog(raiz, `FALHA CONEXAO_OPENAI: ${erro?.message || erro}`);
      historico.push({ ok: false, codigo: "CONEXAO_OPENAI", linha });
      return responder(res, 502, {
        sucesso: false,
        codigo: "CONEXAO_OPENAI",
        erro: `Não foi possível conectar à OpenAI: ${erro?.message || erro}`,
      });
    }

    if (!resultado.ok) {
      const linha = registrarLog(raiz, `FALHA ${resultado.codigo}: ${resultado.mensagem} (tentativas: ${JSON.stringify(resultado.tentativas)})`);
      historico.push({ ok: false, codigo: resultado.codigo, linha });
      return responder(res, resultado.status && resultado.status < 500 ? resultado.status : 502, {
        sucesso: false,
        codigo: resultado.codigo,
        erro: resultado.mensagem,
        tentativas: resultado.tentativas,
      });
    }

    const linha = registrarLog(
      raiz,
      `OK OpenAI modelo=${resultado.modelo} tempo=${(resultado.duracaoMs / 1000).toFixed(1)}s x-request-id=${resultado.idPedido || "-"} mascara=${resultado.usouMascara ? "sim" : "não"}`
    );
    historico.push({ ok: true, modelo: resultado.modelo, idPedido: resultado.idPedido, duracaoMs: resultado.duracaoMs, linha });

    return responder(res, 200, {
      sucesso: true,
      origem: "openai-local",
      imagem: `data:image/png;base64,${resultado.b64}`,
      modelo: resultado.modelo,
      qualidade: config.qualidade,
      idPedido: resultado.idPedido,
      duracaoMs: resultado.duracaoMs,
      usouMascara: resultado.usouMascara,
    });
  };
}
