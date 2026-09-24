import { supabase } from "../../supabase.js";

function textoOuNull(valor) {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

export function normalizarCodigoCatalogo(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s.\-_\/]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function temValor(valor) {
  if (valor === null || valor === undefined) {
    return false;
  }
  if (typeof valor === "number") {
    return Number.isFinite(valor);
  }
  return String(valor).trim() !== "";
}

function preferirExistente(existente, novo) {
  if (temValor(existente)) {
    return existente;
  }
  return temValor(novo) ? novo : existente ?? null;
}

function tokensCodigo(valor) {
  return String(valor ?? "")
    .split(/[,;|/\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unirEquivalentes(atual, novo) {
  const mapa = new Map();
  for (const token of [...tokensCodigo(atual), ...tokensCodigo(novo)]) {
    const chave = normalizarCodigoCatalogo(token);
    if (!chave) {
      continue;
    }
    if (!mapa.has(chave)) {
      mapa.set(chave, token.trim());
    }
  }
  const lista = [...mapa.values()];
  return lista.length ? lista.join(", ") : null;
}

function conjuntosEquivalentesIguais(a, b) {
  const sa = new Set(
    tokensCodigo(a)
      .map(normalizarCodigoCatalogo)
      .filter(Boolean)
  );
  const sb = new Set(
    tokensCodigo(b)
      .map(normalizarCodigoCatalogo)
      .filter(Boolean)
  );
  if (sa.size !== sb.size) {
    return false;
  }
  for (const item of sa) {
    if (!sb.has(item)) {
      return false;
    }
  }
  return true;
}

function chaveAplicacao(registro) {
  return [
    normalizarTexto(registro.fabricante),
    normalizarCodigoCatalogo(registro.codigo_oem),
    normalizarTexto(registro.montadora),
    normalizarTexto(registro.modelo),
    normalizarTexto(registro.motor),
    registro.ano_inicio ?? "",
    registro.ano_fim ?? "",
  ].join("|");
}

function equivalenteNovoNoExistente(existente, novo) {
  const atuais = new Set(
    tokensCodigo(existente.codigo_equivalente)
      .map(normalizarCodigoCatalogo)
      .filter(Boolean)
  );
  return tokensCodigo(novo.codigo_equivalente)
    .map(normalizarCodigoCatalogo)
    .filter(Boolean)
    .some((token) => !atuais.has(token));
}

function observacaoNova(existente, novo) {
  const atual = normalizarTexto(existente.observacao);
  const candidata = normalizarTexto(novo.observacao);
  if (!candidata) {
    return false;
  }
  if (!atual) {
    return true;
  }
  return !atual.includes(candidata);
}

function unirObservacao(existente, novo, rastreio) {
  const partes = [];
  const vistos = new Set();
  for (const parte of [
    existente.observacao,
    novo.observacao,
    rastreio,
  ]) {
    const texto = textoOuNull(parte);
    if (!texto) {
      continue;
    }
    const chave = normalizarTexto(texto);
    if (vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);
    partes.push(texto);
  }
  return partes.length ? partes.join(" | ") : null;
}

function montarRastreio(registro) {
  const data = new Date().toISOString().slice(0, 10);
  const partes = [];
  const origem = textoOuNull(registro.origem_catalogo);
  if (origem) {
    partes.push(`origem importacao: ${origem}`);
  }
  const arquivo = textoOuNull(
    registro.arquivo_catalogo || registro.arquivoCatalogo
  );
  if (arquivo) {
    partes.push(`pdf: ${arquivo}`);
  }
  const pagina =
    registro.pagina ||
    registro.numeroPagina ||
    registro._pagina ||
    null;
  if (pagina) {
    partes.push(`pagina: ${pagina}`);
  }
  const original = textoOuNull(registro.codigo_original);
  if (
    original &&
    normalizarCodigoCatalogo(original) !==
      normalizarCodigoCatalogo(registro.codigo_oem)
  ) {
    partes.push(`codigo_original: ${original}`);
  }
  partes.push(`importado_em: ${data}`);
  return partes.join(" | ");
}

function registroExato(existente, novo) {
  return (
    normalizarTexto(existente.peca) === normalizarTexto(novo.peca) &&
    conjuntosEquivalentesIguais(
      existente.codigo_equivalente,
      novo.codigo_equivalente
    ) &&
    !observacaoNova(existente, novo)
  );
}

function precisaAtualizar(existente, novo) {
  if (equivalenteNovoNoExistente(existente, novo)) {
    return true;
  }
  if (observacaoNova(existente, novo)) {
    return true;
  }
  if (!temValor(existente.motor) && temValor(novo.motor)) {
    return true;
  }
  if (
    (existente.ano_inicio == null || existente.ano_inicio === "") &&
    temValor(novo.ano_inicio)
  ) {
    return true;
  }
  if (
    (existente.ano_fim == null || existente.ano_fim === "") &&
    temValor(novo.ano_fim)
  ) {
    return true;
  }
  if (!temValor(existente.modelo) && temValor(novo.modelo)) {
    return true;
  }
  if (!temValor(existente.montadora) && temValor(novo.montadora)) {
    return true;
  }
  return false;
}

function montarAtualizacao(existente, novo) {
  const codigoEquivalente = unirEquivalentes(
    existente.codigo_equivalente,
    novo.codigo_equivalente
  );
  const observacao = unirObservacao(
    existente,
    novo,
    existente.origem_catalogo &&
      normalizarTexto(existente.origem_catalogo) !==
        normalizarTexto(novo.origem_catalogo)
      ? montarRastreio(novo)
      : null
  );

  return {
    id: existente.id,
    codigo_equivalente: codigoEquivalente,
    observacao,
    motor: preferirExistente(existente.motor, novo.motor),
    modelo: preferirExistente(existente.modelo, novo.modelo),
    montadora: preferirExistente(existente.montadora, novo.montadora),
    ano_inicio: preferirExistente(existente.ano_inicio, novo.ano_inicio),
    ano_fim: preferirExistente(existente.ano_fim, novo.ano_fim),
  };
}

function payloadInsercao(registro) {
  const rastreio = montarRastreio({
    ...registro,
    codigo_original:
      registro.codigo_original || registro.codigo_oem,
  });
  const observacao = unirObservacao(
    { observacao: registro.observacao },
    { observacao: null },
    rastreio
  );
  return {
    peca: registro.peca,
    codigo_oem: registro.codigo_oem,
    codigo_equivalente: registro.codigo_equivalente || null,
    fabricante: registro.fabricante,
    origem_catalogo: registro.origem_catalogo,
    familia_catalogo: registro.familia_catalogo || null,
    categoria: registro.categoria || null,
    sistema: registro.sistema || null,
    tipo: registro.tipo || null,
    confianca_inteligencia: registro.confianca_inteligencia ?? null,
    montadora: registro.montadora || null,
    modelo: registro.modelo || null,
    motor: registro.motor || null,
    ano_inicio: registro.ano_inicio ?? null,
    ano_fim: registro.ano_fim ?? null,
    observacao,
    ativo: registro.ativo !== false,
    prioridade: registro.prioridade || 1,
    confiabilidade: registro.confiabilidade || 100,
  };
}

async function buscarExistentes(registros) {
  const porFabricante = new Map();
  for (const registro of registros) {
    const fabricante = textoOuNull(registro.fabricante);
    const codigo = textoOuNull(registro.codigo_oem);
    if (!fabricante || !codigo) {
      continue;
    }
    if (!porFabricante.has(fabricante)) {
      porFabricante.set(fabricante, new Set());
    }
    const set = porFabricante.get(fabricante);
    set.add(codigo);
    const compacto = normalizarCodigoCatalogo(codigo);
    if (compacto && compacto !== codigo) {
      set.add(compacto);
    }
  }

  const porCodigo = new Map();

  for (const [fabricante, codigosSet] of porFabricante.entries()) {
    const codigos = [...codigosSet];
    for (let i = 0; i < codigos.length; i += 40) {
      const lote = codigos.slice(i, i + 40);
      let inicio = 0;
      while (true) {
        const { data, error } = await supabase
          .from("catalogo_pecas")
          .select(
            "id,peca,codigo_oem,codigo_equivalente,fabricante,montadora,modelo,motor,ano_inicio,ano_fim,origem_catalogo,observacao,ativo"
          )
          .eq("fabricante", fabricante)
          .in("codigo_oem", lote)
          .eq("ativo", true)
          .range(inicio, inicio + 999);

        if (error) {
          throw error;
        }

        const linhas = data || [];
        for (const linha of linhas) {
          const chave = [
            normalizarTexto(linha.fabricante),
            normalizarCodigoCatalogo(linha.codigo_oem),
          ].join("|");
          if (!porCodigo.has(chave)) {
            porCodigo.set(chave, []);
          }
          porCodigo.get(chave).push(linha);
        }

        if (linhas.length < 1000) {
          break;
        }
        inicio += 1000;
      }
    }
  }

  return porCodigo;
}

async function inserirLotes(registros, onProgresso) {
  const TAMANHO = 100;
  let gravados = 0;
  let rejeitados = 0;

  for (let i = 0; i < registros.length; i += TAMANHO) {
    const lote = registros.slice(i, i + TAMANHO).map(payloadInsercao);
    const { data, error } = await supabase
      .from("catalogo_pecas")
      .insert(lote)
      .select("id");

    if (error) {
      if (error.code === "23505") {
        rejeitados += lote.length;
        continue;
      }
      throw error;
    }

    gravados += Array.isArray(data) ? data.length : lote.length;
    onProgresso?.(
      `💾 Base Técnica — ${gravados} novo(s) gravado(s)...`
    );
  }

  return { gravados, rejeitados };
}

async function atualizarLinhas(atualizacoes, onProgresso) {
  let gravados = 0;
  let rejeitados = 0;

  for (const item of atualizacoes) {
    const { id, ...campos } = item;
    const { error } = await supabase
      .from("catalogo_pecas")
      .update(campos)
      .eq("id", id);

    if (error) {
      rejeitados += 1;
      console.warn("⚠️ Falha ao complementar registro existente:", error);
      continue;
    }
    gravados += 1;
    if (gravados % 50 === 0) {
      onProgresso?.(
        `🧠 Complementando registros existentes: ${gravados}...`
      );
    }
  }

  return { gravados, rejeitados };
}

export function montarMensagemResumoImportacao(resumo) {
  return [
    "IMPORTAÇÃO CONCLUÍDA",
    `Novos: ${resumo.novos}`,
    `Atualizados: ${resumo.atualizados}`,
    `Já existentes/ignorados: ${resumo.jaExistentes}`,
    `Rejeitados: ${resumo.rejeitados}`,
    `Total analisado: ${resumo.totalAnalisado}`,
  ].join("\n");
}

export async function classificarEGravarCatalogoPecas({
  registros = [],
  onProgresso,
} = {}) {
  const resumo = {
    novos: 0,
    atualizados: 0,
    jaExistentes: 0,
    rejeitados: 0,
    totalAnalisado: registros.length,
  };

  const validos = [];
  for (const registro of registros) {
    const codigo = textoOuNull(registro.codigo_oem);
    const fabricante = textoOuNull(registro.fabricante);
    if (!codigo || !normalizarCodigoCatalogo(codigo) || !fabricante) {
      resumo.rejeitados += 1;
      continue;
    }
    validos.push({
      ...registro,
      codigo_original: registro.codigo_original || codigo,
    });
  }

  if (validos.length === 0) {
    return { ...resumo, inseridos: [], mensagem: montarMensagemResumoImportacao(resumo) };
  }

  onProgresso?.(
    `🔎 Conferindo ${validos.length} registro(s) na Base Técnica...`
  );

  const existentes = await buscarExistentes(validos);
  const paraInserir = [];
  const paraAtualizar = [];

  for (const registro of validos) {
    const chaveCodigo = [
      normalizarTexto(registro.fabricante),
      normalizarCodigoCatalogo(registro.codigo_oem),
    ].join("|");
    const candidatos = existentes.get(chaveCodigo) || [];
    const correspondente = candidatos.find(
      (item) => chaveAplicacao(item) === chaveAplicacao(registro)
    );

    if (correspondente) {
      if (registroExato(correspondente, registro)) {
        resumo.jaExistentes += 1;
        continue;
      }
      if (precisaAtualizar(correspondente, registro)) {
        paraAtualizar.push(montarAtualizacao(correspondente, registro));
        resumo.atualizados += 1;
      } else {
        resumo.jaExistentes += 1;
      }
      continue;
    }

    paraInserir.push(registro);
    if (candidatos.length > 0) {
      resumo.atualizados += 1;
    } else {
      resumo.novos += 1;
    }
  }

  onProgresso?.(
    `💾 Gravando ${paraInserir.length} novo(s) e complementar ${paraAtualizar.length} existente(s)...`
  );

  const insercao = await inserirLotes(paraInserir, onProgresso);
  const atualizacao = await atualizarLinhas(paraAtualizar, onProgresso);
  resumo.rejeitados += insercao.rejeitados + atualizacao.rejeitados;

  const mensagem = montarMensagemResumoImportacao(resumo);
  onProgresso?.(`✅ ${mensagem.replace(/\n/g, " | ")}`);

  return {
    ...resumo,
    inseridos: paraInserir,
    mensagem,
    totalGravados: insercao.gravados + atualizacao.gravados,
  };
}
