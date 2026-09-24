/**
 * INSERT-ONLY seguro para a fila Magneti Marelli.
 * Nunca faz UPDATE. Nunca apaga. Lotes pequenos + reconciliação após timeout.
 */
import { supabase } from "../../supabase.js";
import {
  TIPO_REFERENCIA_APLICACAO,
  TIPO_REFERENCIA_NOTA,
  ehReferenciaTecnicaSemAplicacao,
  chaveInsertNotaTecnica,
} from "./referenciaTecnica.js";

const TAMANHO_LOTE = 1;

export function normalizarCampoChave(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s.\-_\/]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

export function chaveAplicacaoInsertOnly(registro) {
  if (ehReferenciaTecnicaSemAplicacao(registro)) {
    return chaveInsertNotaTecnica(registro);
  }

  return [
    normalizarCampoChave(registro.origem_catalogo),
    normalizarCampoChave(registro.codigo_oem),
    normalizarCampoChave(registro.montadora),
    normalizarCampoChave(registro.modelo),
    normalizarCampoChave(registro.motor),
    registro.ano_inicio ?? "",
    registro.ano_fim ?? "",
    normalizarCampoChave(registro.codigo_equivalente),
  ].join("|");
}

function textoOuNull(valor) {
  const texto = String(valor ?? "").trim();
  return texto || null;
}

export function payloadInsertOnly(registro) {
  let tipo =
    textoOuNull(registro.tipo_referencia) || TIPO_REFERENCIA_APLICACAO;
  const semVeiculo =
    !textoOuNull(registro.montadora) &&
    !textoOuNull(registro.modelo) &&
    !textoOuNull(registro.motor);
  if (tipo === TIPO_REFERENCIA_APLICACAO && semVeiculo && textoOuNull(registro.observacao)) {
    tipo = TIPO_REFERENCIA_NOTA;
  }
  const nota = tipo === TIPO_REFERENCIA_NOTA;

  return {
    peca: textoOuNull(registro.peca),
    codigo_oem: textoOuNull(registro.codigo_oem),
    codigo_equivalente: textoOuNull(registro.codigo_equivalente),
    fabricante: textoOuNull(registro.fabricante) || "Magneti Marelli",
    origem_catalogo: textoOuNull(registro.origem_catalogo),
    familia_catalogo: textoOuNull(registro.familia_catalogo),
    categoria: textoOuNull(registro.categoria),
    sistema: textoOuNull(registro.sistema),
    tipo: textoOuNull(registro.tipo),
    montadora: nota ? null : textoOuNull(registro.montadora),
    modelo: nota ? null : textoOuNull(registro.modelo),
    motor: nota ? null : textoOuNull(registro.motor),
    ano_inicio: nota ? null : registro.ano_inicio ?? null,
    ano_fim: nota ? null : registro.ano_fim ?? null,
    observacao: textoOuNull(registro.observacao),
    pagina_catalogo: registro.pagina_catalogo ?? null,
    tipo_referencia: tipo,
    ativo: registro.ativo !== false,
    prioridade: registro.prioridade || 1,
    confiabilidade: registro.confiabilidade || 100,
  };
}

export async function carregarChavesPorCodigos(origem, codigos = []) {
  const chaves = new Set();
  const unicos = [...new Set(codigos.filter(Boolean))];
  if (!origem || !unicos.length) {
    return chaves;
  }
  for (const codigo of unicos) {
    const { data, error } = await supabase
      .from("catalogo_pecas")
      .select(
        "codigo_oem,codigo_equivalente,montadora,modelo,motor,ano_inicio,ano_fim,origem_catalogo,observacao,pagina_catalogo,tipo_referencia"
      )
      .eq("fabricante", "Magneti Marelli")
      .eq("codigo_oem", codigo)
      .limit(200);

    if (error) {
      throw error;
    }
    for (const linha of data || []) {
      if (String(linha.origem_catalogo || "") !== String(origem || "")) {
        continue;
      }
      chaves.add(chaveAplicacaoInsertOnly(linha));
    }
  }
  return chaves;
}

export async function existePorIndiceUnico(payload) {
  let consulta = supabase
    .from("catalogo_pecas")
    .select("id")
    .eq("codigo_oem", payload.codigo_oem)
    .eq("origem_catalogo", payload.origem_catalogo)
    .limit(1);

  consulta = payload.montadora
    ? consulta.eq("montadora", payload.montadora)
    : consulta.is("montadora", null);
  consulta = payload.modelo
    ? consulta.eq("modelo", payload.modelo)
    : consulta.is("modelo", null);
  consulta = payload.motor
    ? consulta.eq("motor", payload.motor)
    : consulta.is("motor", null);
  consulta = payload.peca
    ? consulta.eq("peca", payload.peca)
    : consulta.is("peca", null);
  consulta =
    payload.ano_inicio === null || payload.ano_inicio === undefined
      ? consulta.is("ano_inicio", null)
      : consulta.eq("ano_inicio", payload.ano_inicio);
  consulta =
    payload.ano_fim === null || payload.ano_fim === undefined
      ? consulta.is("ano_fim", null)
      : consulta.eq("ano_fim", payload.ano_fim);

  if (payload.tipo_referencia === TIPO_REFERENCIA_NOTA) {
    consulta = consulta.eq("tipo_referencia", TIPO_REFERENCIA_NOTA);
    consulta = payload.observacao
      ? consulta.eq("observacao", payload.observacao)
      : consulta.is("observacao", null);
    consulta =
      payload.pagina_catalogo === null || payload.pagina_catalogo === undefined
        ? consulta.is("pagina_catalogo", null)
        : consulta.eq("pagina_catalogo", payload.pagina_catalogo);
  }

  const { data, error } = await consulta;
  if (error) {
    throw error;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function carregarChavesExistentes(origem, codigos = []) {
  if (codigos.length) {
    return carregarChavesPorCodigos(origem, codigos);
  }
  return carregarChavesPorCodigos(origem, []);
}

async function inserirLoteComReconciliacao(lote, chaves, log) {
  const payload = lote.map((item) => item.payload);
    const { data, error } = await supabase
      .from("catalogo_pecas")
      .insert(payload)
      .select("id,codigo_oem,origem_catalogo");

  if (!error) {
    const gravados = Array.isArray(data) ? data.length : payload.length;
    for (const item of lote) {
      chaves.add(item.chave);
    }
    log.decisoes.push({
      acao: "INSERT",
      quantidade: gravados,
    });
    return { gravados, ignorados: 0, erros: 0 };
  }

  const timeout =
    error.code === "57014" || /timeout/i.test(String(error.message || ""));

  if (error.code === "23505" || timeout) {
    log.decisoes.push({
      acao: "RECONCILIAR",
      motivo: timeout ? "timeout" : "unique_constraint",
      quantidade: lote.length,
    });
  } else {
    throw error;
  }

  const origem = lote[0]?.payload?.origem_catalogo;
  const atuais = await carregarChavesPorCodigos(
    origem,
    lote.map((item) => item.payload.codigo_oem)
  );
  for (const chave of atuais) {
    chaves.add(chave);
  }

  let gravados = 0;
  let ignorados = 0;
  for (const item of lote) {
    if (chaves.has(item.chave)) {
      ignorados += 1;
      log.decisoes.push({
        acao: "IGNORAR",
        chave: item.chave,
        motivo: "reconciliado_existente",
      });
      continue;
    }
    const { error: erroUm } = await supabase
      .from("catalogo_pecas")
      .insert(item.payload)
      .select("id");
    if (!erroUm) {
      chaves.add(item.chave);
      gravados += 1;
      log.decisoes.push({
        acao: "INSERT",
        chave: item.chave,
        motivo: "apos_timeout",
      });
      continue;
    }
    if (erroUm.code === "23505") {
      chaves.add(item.chave);
      ignorados += 1;
      log.decisoes.push({
        acao: "IGNORAR",
        chave: item.chave,
        motivo: "unique_apos_timeout",
      });
      continue;
    }
    log.erros.push({ chave: item.chave, erro: erroUm.message });
  }

  return { gravados, ignorados, erros: log.erros.length };
}

export async function classificarInsertOnly({ registros = [], onProgresso } = {}) {
  const log = {
    analisados: registros.length,
    novos: 0,
    ignorados: 0,
    ignorados_arquivo: 0,
    ignorados_banco: 0,
    suspeitos: 0,
    chavesExistentesNoBanco: 0,
    erros: [],
    exemplosNovos: [],
    exemplosExistentes: [],
    exemplosSuspeitos: [],
  };

  const preparados = [];
  const vistosNoArquivo = new Set();

  for (const registro of registros) {
    if (!textoOuNull(registro?.codigo_oem) || !textoOuNull(registro?.fabricante)) {
      log.suspeitos += 1;
      if (log.exemplosSuspeitos.length < 5) {
        log.exemplosSuspeitos.push({
          motivo: "sem_codigo_ou_fabricante",
          codigo: registro?.codigo_oem || null,
          montadora: registro?.montadora || null,
        });
      }
      continue;
    }
    const payload = payloadInsertOnly(registro);
    if (
      payload.tipo_referencia === TIPO_REFERENCIA_APLICACAO &&
      !payload.montadora &&
      !payload.modelo &&
      !payload.motor
    ) {
      if (payload.observacao) {
        payload.tipo_referencia = TIPO_REFERENCIA_NOTA;
      }
    }
    if (!payload.origem_catalogo) {
      log.suspeitos += 1;
      if (log.exemplosSuspeitos.length < 5) {
        log.exemplosSuspeitos.push({ motivo: "sem_origem", codigo: payload.codigo_oem });
      }
      continue;
    }
    const chave = chaveAplicacaoInsertOnly(payload);
    if (vistosNoArquivo.has(chave)) {
      log.ignorados += 1;
      log.ignorados_arquivo += 1;
      continue;
    }
    vistosNoArquivo.add(chave);
    preparados.push({ chave, payload });
  }

  const origens = [...new Set(preparados.map((item) => item.payload.origem_catalogo))];
  const chaves = new Set();
  let falhasSelect = 0;
  for (const item of preparados) {
    try {
      const existe = await existePorIndiceUnico(item.payload);
      if (existe) {
        chaves.add(item.chave);
      }
    } catch (erro) {
      falhasSelect += 1;
      if (log.erros.length < 5) {
        log.erros.push({ chave: item.chave, erro: erro.message || String(erro) });
      }
    }
  }
  log.chavesExistentesNoBanco = chaves.size;
  log.falhas_select = falhasSelect;
  onProgresso?.(
    `🔎 DRY-RUN SELECT: ${chaves.size} chave(s) já na origem ${origens.join(" | ")} | falhas=${falhasSelect}`
  );

  if (falhasSelect) {
    log.consulta_incompleta = true;
    log.nao_cruzados = preparados.length - (log.ignorados_banco + log.novos);
  }

  for (const item of preparados) {
    if (chaves.has(item.chave)) {
      log.ignorados += 1;
      log.ignorados_banco += 1;
      if (log.exemplosExistentes.length < 5) {
        log.exemplosExistentes.push({
          chave: item.chave,
          codigo: item.payload.codigo_oem,
          montadora: item.payload.montadora,
          modelo: item.payload.modelo,
        });
      }
    } else {
      log.novos += 1;
      if (log.exemplosNovos.length < 5) {
        log.exemplosNovos.push({
          chave: item.chave,
          codigo: item.payload.codigo_oem,
          oem: item.payload.codigo_equivalente,
          montadora: item.payload.montadora,
          modelo: item.payload.modelo,
          motor: item.payload.motor,
          ano_inicio: item.payload.ano_inicio,
          ano_fim: item.payload.ano_fim,
        });
      }
    }
  }

  return log;
}

export async function inserirSomenteSeguro({
  registros = [],
  onProgresso,
  onCheckpoint,
} = {}) {
  const log = {
    analisados: registros.length,
    novos: 0,
    ignorados: 0,
    suspeitos: 0,
    erros: [],
    decisoes: [],
  };

  const preparados = [];
  const vistosNoArquivo = new Set();

  for (const registro of registros) {
    if (!textoOuNull(registro?.codigo_oem) || !textoOuNull(registro?.fabricante)) {
      log.suspeitos += 1;
      log.decisoes.push({ acao: "SUSPEITO", motivo: "sem_codigo_ou_fabricante" });
      continue;
    }
    const payload = payloadInsertOnly(registro);
    if (!payload.origem_catalogo) {
      log.suspeitos += 1;
      log.decisoes.push({ acao: "SUSPEITO", motivo: "sem_origem" });
      continue;
    }
    const chave = chaveAplicacaoInsertOnly(payload);
    if (vistosNoArquivo.has(chave)) {
      log.ignorados += 1;
      log.decisoes.push({ acao: "IGNORAR", chave, motivo: "duplicata_no_arquivo" });
      continue;
    }
    vistosNoArquivo.add(chave);
    preparados.push({ chave, payload });
  }

  const origens = [...new Set(preparados.map((item) => item.payload.origem_catalogo))];
  const chaves = new Set();
  onProgresso?.(
    `🔎 INSERT-ONLY: ${preparados.length} candidato(s) em ${origens.join(" | ")} (existência por registro, sem SELECT em massa)`
  );

  const pendentes = preparados;

  for (let i = 0; i < pendentes.length; i += TAMANHO_LOTE) {
    const lote = pendentes.slice(i, i + TAMANHO_LOTE);
    let resultado = { gravados: 0, ignorados: 0, erros: 0 };
    try {
      const jaExiste = await existePorIndiceUnico(lote[0].payload);
      if (jaExiste) {
        chaves.add(lote[0].chave);
        log.ignorados += 1;
        log.decisoes.push({ acao: "IGNORAR", chave: lote[0].chave, motivo: "existe_indice" });
        if ((i + 1) % 25 === 0 || i + 1 === pendentes.length) {
          onProgresso?.(
            `💾 Progresso ${i + 1}/${pendentes.length}: novos ${log.novos}, ignorados ${log.ignorados}`
          );
          onCheckpoint?.({
            ...log,
            pendentesRestantes: Math.max(0, pendentes.length - i - lote.length),
          });
        }
        continue;
      }
      resultado = await inserirLoteComReconciliacao(lote, chaves, log);
    } catch (erro) {
      const msg = String(erro?.message || erro);
      if (/timeout|57014/i.test(msg)) {
        try {
          const { error: erroUm } = await supabase
            .from("catalogo_pecas")
            .insert(lote[0].payload)
            .select("id");
          if (!erroUm) {
            resultado = { gravados: 1, ignorados: 0, erros: 0 };
          } else if (erroUm.code === "23505" || /timeout|57014/i.test(String(erroUm.message || ""))) {
            resultado = { gravados: 0, ignorados: 1, erros: 0 };
            if (erroUm.code !== "23505") {
              log.erros.push({ chave: lote[0].chave, erro: erroUm.message });
            }
          } else {
            log.erros.push({ chave: lote[0].chave, erro: erroUm.message });
          }
        } catch (erro2) {
          log.erros.push({ chave: lote[0].chave, erro: String(erro2?.message || erro2) });
        }
      } else {
        log.erros.push({ chave: lote[0].chave, erro: msg });
      }
    }
    log.novos += resultado.gravados;
    log.ignorados += resultado.ignorados;
    if ((i + 1) % 25 === 0 || i + 1 === pendentes.length) {
      onProgresso?.(
        `💾 Progresso ${i + 1}/${pendentes.length}: novos ${log.novos}, ignorados ${log.ignorados}, erros ${log.erros.length}`
      );
      onCheckpoint?.({
        ...log,
        pendentesRestantes: Math.max(0, pendentes.length - i - lote.length),
      });
    }
  }

  return log;
}
