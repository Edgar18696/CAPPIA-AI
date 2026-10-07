import { useEffect, useRef } from "react";
import {
  criarAnuncioVazio,
  carregarAnuncioTemporario,
  limparAnuncioTemporario,
} from "../services/anunciosService";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";

// =====================================================
// RASCUNHO LEVE DO NOVO ANÚNCIO
// - Fotos guardadas só por referência (URL), com ordem e capa.
// - Nenhum base64 (data:) ou blob: entra no localStorage: a imagem
//   continua só na memória da tela, sem ser convertida nem descartada.
// - Gravação protegida contra falta de espaço (cota do navegador).
// - Um rascunho com texto nunca é trocado por um vazio.
// =====================================================
const CHAVES_TEXTO_RASCUNHO = [
  "codigo",
  "oem",
  "titulo",
  "descricao",
  "preco",
];

function ehMidiaEmbutida(valor) {
  return (
    typeof valor === "string" &&
    /^\s*(data:|blob:)/i.test(valor)
  );
}

export function semMidiaEmbutida(valor, profundidade = 0) {
  if (ehMidiaEmbutida(valor)) return "";
  if (
    valor === null ||
    typeof valor !== "object" ||
    profundidade > 12
  ) {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) =>
      semMidiaEmbutida(item, profundidade + 1)
    );
  }
  const saida = {};
  Object.entries(valor).forEach(([chave, item]) => {
    saida[chave] = semMidiaEmbutida(item, profundidade + 1);
  });
  return saida;
}

function urlPersistente(valor) {
  return typeof valor === "string" &&
    valor.trim() &&
    !ehMidiaEmbutida(valor)
    ? valor
    : "";
}

// Referência leve de uma foto: só URL + dados curtos. Sem URL
// persistente (só base64/blob), a foto não entra no rascunho.
export function referenciaFotoRascunho(foto, indice) {
  if (typeof foto === "string") {
    const url = urlPersistente(foto);
    return url
      ? {
          imagem_processada: url,
          imagem_original: "",
          ordem: indice,
          capa: indice === 0,
        }
      : null;
  }

  if (!foto || typeof foto !== "object") return null;

  const principal =
    urlPersistente(foto.imagem_processada) ||
    urlPersistente(foto.imagem_original) ||
    urlPersistente(foto.url) ||
    urlPersistente(foto.src);

  if (!principal) return null;

  const referencia = {};
  Object.entries(foto).forEach(([chave, valor]) => {
    if (
      (typeof valor === "string" &&
        !ehMidiaEmbutida(valor) &&
        valor.length <= 2000) ||
      typeof valor === "number" ||
      typeof valor === "boolean"
    ) {
      referencia[chave] = valor;
    }
  });

  referencia.imagem_processada =
    urlPersistente(foto.imagem_processada) || principal;
  referencia.imagem_original =
    urlPersistente(foto.imagem_original);
  referencia.ordem = indice;
  referencia.capa = indice === 0;

  return referencia;
}

export function fotosParaRascunho(fotos) {
  const lista = Array.isArray(fotos) ? fotos : [];
  const referencias = [];
  let soNaMemoria = 0;

  lista.forEach((foto, indice) => {
    const referencia = referenciaFotoRascunho(foto, indice);
    if (referencia) {
      referencias.push(referencia);
    } else {
      soNaMemoria += 1;
    }
  });

  return { referencias, soNaMemoria };
}

export function rascunhoTemTexto(dados) {
  return Boolean(
    dados &&
      CHAVES_TEXTO_RASCUNHO.some((chave) =>
        String(dados?.[chave] ?? "").trim()
      )
  );
}

/**
 * O rascunho MAIS RECENTE entre a cópia principal e a reserva (pela hora
 * da gravação). Antes, a principal sempre vencia — e uma principal antiga
 * (ex.: gravada ao voltar da Central) apagava, no F5, o que foi digitado
 * depois no Novo Anúncio (o salvamento automático grava a reserva).
 */
export function rascunhoMaisRecente() {
  const principal = lerRascunhoAnuncio("novoAnuncioTemporario");
  const reserva = lerRascunhoAnuncio("rascunhoNovoAnuncioTemp");
  const p = rascunhoTemTexto(principal);
  const r = rascunhoTemTexto(reserva);
  if (p && r) return Number(reserva.salvoEm || 0) > Number(principal.salvoEm || 0) ? reserva : principal;
  if (p) return principal;
  if (r) return reserva;
  return principal || reserva || null;
}

export function lerRascunhoAnuncio(chave) {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

export function gravarRascunhoAnuncio(
  chave,
  dados,
  { permitirVazio = false } = {}
) {
  try {
    const { fotos, ...resto } = dados || {};
    const rascunho = {
      ...semMidiaEmbutida(resto),
      rascunhoLeve: 1,
      // Hora da gravação: no F5 vale o rascunho mais recente.
      salvoEm: Date.now(),
    };

    // Só mexe nas fotos quando quem gravou mandou as fotos.
    if (fotos !== undefined) {
      const { referencias, soNaMemoria } =
        fotosParaRascunho(fotos);
      rascunho.fotos = referencias;
      rascunho.fotosSoNaMemoria = soNaMemoria;
    }

    if (
      !permitirVazio &&
      !rascunhoTemTexto(rascunho) &&
      rascunhoTemTexto(lerRascunhoAnuncio(chave))
    ) {
      return false;
    }

    localStorage.setItem(chave, JSON.stringify(rascunho));
    return true;
  } catch (erro) {
    console.warn(
      `PAIIA: rascunho "${chave}" não foi gravado (${
        erro?.name || "erro"
      }). O anúncio continua na tela.`
    );
    return false;
  }
}

// Fotos do rascunho só entram quando a tela não tem fotos em memória
// (a memória pode ter a versão completa da imagem).
function fotosDoRascunhoSemSobrescrever(fotosRascunho) {
  const referencias = Array.isArray(fotosRascunho)
    ? fotosRascunho
    : [];

  return (fotosAtuais) =>
    Array.isArray(fotosAtuais) && fotosAtuais.length
      ? fotosAtuais
      : referencias;
}

export default function useNovoAnuncio({
  anuncioEditando,
  fotosAnuncio,
  setFotosAnuncio,

  codigo,
  setCodigo,

  oem,
  setOem,

  titulo,
  setTitulo,

  descricao,
  setDescricao,

  preco,
  setPreco,

  tipoAnuncio,
  setTipoAnuncio,

  pecaEncontrada,
  setPecaEncontrada,

  diagnostico,
  setDiagnostico,

  auditoria,
  setAuditoria,

  extrasRascunho,
}) {
  const fotosSeguras =
    Array.isArray(fotosAnuncio)
      ? fotosAnuncio
      : [];

  const podeAtualizarFotos =
    typeof setFotosAnuncio ===
    "function";

  // Evita que o salvamento automático grave o estado ainda vazio
  // enquanto o rascunho está sendo restaurado (volta da Galeria).
  const restauracaoConcluidaRef = useRef(false);

  const extrasRascunhoJson = JSON.stringify(
    semMidiaEmbutida(extrasRascunho || {})
  );

  useEffect(() => {
    if (anuncioEditando) {
      setCodigo(
        anuncioEditando.codigo || ""
      );

      setOem(
        anuncioEditando.oem || ""
      );

      setTitulo(
        anuncioEditando.titulo || ""
      );

      setDescricao(
        anuncioEditando.descricao || ""
      );

      setPreco(
        anuncioEditando.preco || ""
      );

      setTipoAnuncio(
        anuncioEditando.tipoAnuncio ||
          "classico"
      );

      setPecaEncontrada(
        anuncioEditando.pecaEncontrada ||
          null
      );

      setDiagnostico(
        anuncioEditando.diagnostico ||
          null
      );

      setAuditoria(
        anuncioEditando.auditoria ||
          null
      );

      if (podeAtualizarFotos) {
        setFotosAnuncio(
          Array.isArray(
            anuncioEditando.fotos
          )
            ? anuncioEditando.fotos
            : []
        );
      }

      return;
    }

    if (deveIniciarNovaCriacaoMidia()) {
      consumirNovaCriacaoMidia();

      const vazio = criarAnuncioVazio() || {};

      setCodigo(vazio.codigo || "");
      setOem(vazio.oem || "");
      setTitulo(vazio.titulo || "");
      setDescricao(vazio.descricao || "");
      setPreco(vazio.preco || "");
      setTipoAnuncio(vazio.tipoAnuncio || "classico");
      setPecaEncontrada(null);
      setDiagnostico(null);
      setAuditoria(null);

      if (podeAtualizarFotos) {
        setFotosAnuncio([]);
      }

      return;
    }

    function aplicarRascunho(anuncio) {
      setCodigo(anuncio.codigo || "");
      setOem(anuncio.oem || "");
      setTitulo(anuncio.titulo || "");
      setDescricao(anuncio.descricao || "");
      setPreco(anuncio.preco || "");
      setTipoAnuncio(
        anuncio.tipoAnuncio || "classico"
      );
      setPecaEncontrada(
        anuncio.pecaEncontrada || null
      );
      setDiagnostico(
        anuncio.diagnostico || null
      );
      setAuditoria(
        anuncio.auditoria || null
      );

      // Ficha reaberta da BASE (?ficha=<id>): as fotos são as DELA, mesmo
      // que a memória tenha fotos de outro anúncio. Vale uma vez só.
      if (podeAtualizarFotos && anuncio.fotosDaFicha === true) {
        setFotosAnuncio(Array.isArray(anuncio.fotos) ? anuncio.fotos : []);
        ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp"].forEach((chave) => {
          const r = lerRascunhoAnuncio(chave);
          if (r && r.fotosDaFicha) {
            delete r.fotosDaFicha;
            try {
              localStorage.setItem(chave, JSON.stringify(r));
            } catch {
              // sem espaço: na próxima abertura as fotos da ficha valem de novo
            }
          }
        });
        return;
      }

      if (
        podeAtualizarFotos &&
        Array.isArray(anuncio.fotos) &&
        anuncio.fotos.length
      ) {
        setFotosAnuncio(
          fotosDoRascunhoSemSobrescrever(
            anuncio.fotos
          )
        );
      }
    }

    const anuncioTemporario =
      lerRascunhoAnuncio(
        "novoAnuncioTemporario"
      );

    const rascunhoReserva =
      lerRascunhoAnuncio(
        "rascunhoNovoAnuncioTemp"
      );

    if (anuncioTemporario) {
      // Vale o rascunho MAIS RECENTE (principal ou reserva).
      aplicarRascunho(rascunhoMaisRecente() || anuncioTemporario);

      return;
    }

    const veioCatalogo =
      localStorage.getItem(
        "usarDadosCatalogoNoAnuncio"
      ) === "true";

    if (veioCatalogo) {
      const anuncio =
        carregarAnuncioTemporario() ||
        criarAnuncioVazio() ||
        {};

      setCodigo(
        anuncio.codigo || ""
      );

      setOem(
        anuncio.oem || ""
      );

      setTitulo(
        anuncio.titulo || ""
      );

      setDescricao(
        anuncio.descricao || ""
      );

      setPreco(
        anuncio.preco || ""
      );

      setTipoAnuncio(
        anuncio.tipoAnuncio ||
          "classico"
      );

      setPecaEncontrada(
        anuncio.pecaEncontrada ||
          null
      );

      setDiagnostico(
        anuncio.diagnostico ||
          null
      );

      setAuditoria(
        anuncio.auditoria ||
          null
      );

      if (podeAtualizarFotos) {
        setFotosAnuncio(
          Array.isArray(
            anuncio.fotos
          )
            ? anuncio.fotos
            : []
        );
      }

      limparAnuncioTemporario();

      return;
    }

    // Fallback: a cópia principal não existe (ex.: falta de espaço
    // ao abrir a Galeria) → recupera do rascunho de reserva.
    if (rascunhoTemTexto(rascunhoReserva)) {
      aplicarRascunho(rascunhoReserva);
      return;
    }

    const vazio =
      criarAnuncioVazio() || {};

    setCodigo(
      vazio.codigo || ""
    );

    setOem(
      vazio.oem || ""
    );

    setTitulo(
      vazio.titulo || ""
    );

    setDescricao(
      vazio.descricao || ""
    );

    setPreco(
      vazio.preco || ""
    );

    setTipoAnuncio(
      vazio.tipoAnuncio ||
        "classico"
    );

    setPecaEncontrada(
      vazio.pecaEncontrada ||
        null
    );

    setDiagnostico(
      vazio.diagnostico ||
        null
    );

    setAuditoria(
      vazio.auditoria ||
        null
    );

    if (podeAtualizarFotos) {
      setFotosAnuncio(
        (fotosAtuais) =>
          Array.isArray(
            fotosAtuais
          )
            ? fotosAtuais
            : []
      );
    }
  }, [
    anuncioEditando,
    podeAtualizarFotos,
    setAuditoria,
    setCodigo,
    setDescricao,
    setDiagnostico,
    setFotosAnuncio,
    setOem,
    setPecaEncontrada,
    setPreco,
    setTipoAnuncio,
    setTitulo,
  ]);

  useEffect(() => {
    if (anuncioEditando) {
      return;
    }

    // 1ª execução = montagem da tela: o estado ainda não foi
    // restaurado. Não grava, para não zerar o rascunho.
    if (!restauracaoConcluidaRef.current) {
      restauracaoConcluidaRef.current = true;
      return;
    }

    const temConteudo =
      Boolean(
        codigo ||
          oem ||
          titulo ||
          descricao ||
          preco ||
          fotosSeguras.length
      );

    if (!temConteudo) {
      return;
    }

    let extras = {};
    try {
      extras = JSON.parse(extrasRascunhoJson) || {};
    } catch {
      extras = {};
    }

    gravarRascunhoAnuncio("rascunhoNovoAnuncioTemp", {
      ...extras,
      codigo,
      oem,
      titulo,
      descricao,
      preco,
      tipoAnuncio,
      pecaEncontrada,
      diagnostico,
      auditoria,
      fotos: fotosSeguras,
    });
  }, [
    codigo,
    oem,
    titulo,
    descricao,
    preco,
    tipoAnuncio,
    pecaEncontrada,
    diagnostico,
    auditoria,
    fotosSeguras,
    anuncioEditando,
    extrasRascunhoJson,
  ]);
}