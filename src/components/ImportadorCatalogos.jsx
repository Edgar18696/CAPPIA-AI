import { useRef, useState } from "react";
import { motorImportacao } from "../services/importadores/motorImportacao";
import { executarExtracaoBruta } from "../services/importadores/pipeline/executarExtracaoBruta";
import { executarInterpretacaoAmostra } from "../services/importadores/pipeline/executarInterpretacaoAmostra";

const FABRICANTES = [
  {
    valor: "bosch",
    nome: "Bosch",
  },
  {
    valor: "magneti_marelli",
    nome: "Magneti Marelli",
  },
  {
    valor: "renault",
    nome: "Renault / Motrio",
  },
  {
    valor: "ngk",
    nome: "NGK / NTK",
  },
];

const FILTROS_AUDITORIA_FASE2 = [
  { id: "todos", rotulo: "Todos", tipo: null },
  { id: "produto", rotulo: "Produto", tipo: "produto" },
  { id: "aplicacao", rotulo: "Aplicação", tipo: "aplicacao" },
  {
    id: "tabela_referencia",
    rotulo: "Tabela/Referência",
    tipo: "tabela_referencia",
  },
  { id: "indefinido", rotulo: "Indefinido", tipo: "indefinido" },
];

function celulaAuditoria(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return String(valor);
}

function normalizarCodigoPecaAuditoria(valor) {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function compactarCodigoDiagnostico(valor = "") {
  return String(valor || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

function obterCodigosDiagnosticoCatalogo(
  tipoCatalogo = "",
  fabricante = ""
) {
  const tipo = String(tipoCatalogo || "")
    .trim()
    .toLowerCase();

  const mapa = {
    sondas: ["0258003300"],
    gasolina_2023: ["0280158448"],
    gasolina_2025: ["0280158276"],
    bicos_gasolina: ["0280155742"],
    sistemas_eletronicos: ["IWP049"],
    valvulas_egr: ["EV073C", "EV004", "EV075"],
  };

  if (tipo === "sistemas_eletronicos") {
    return mapa.sistemas_eletronicos;
  }

  return mapa[tipo] || [];
}

function registroTemCodigoDiagnostico(registro, codigo) {
  const alvo = compactarCodigoDiagnostico(codigo);

  if (!alvo) {
    return false;
  }

  const candidatos = [
    registro?.codigo_oem,
    registro?.codigo_marelli,
    registro?.codigo,
    registro?.codigoBosch,
    registro?.referencia,
    registro?.codigo_referencia,
    registro?.codigo_equivalente,
    registro?.equivalentes,
  ];

  return candidatos.some((valor) => {
    const lista = Array.isArray(valor) ? valor : [valor];

    return lista.some((item) => {
      const compacto = compactarCodigoDiagnostico(item);

      if (!compacto) {
        return false;
      }

      if (compacto === alvo) {
        return true;
      }

      if (/^\d+$/.test(alvo)) {
        return compacto.replace(/\D/g, "") === alvo;
      }

      return false;
    });
  });
}

function normalizarCampoDuplicidade(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function camposProdutoAuditoria(item) {
  return {
    codigo_peca: item?.interpretacao?.codigo_peca ?? null,
    codigo_interno:
      item?.interpretacao?.evidencias?.codigo_interno ??
      item?.interpretacao?.codigo_interno ??
      null,
    descricao: item?.interpretacao?.descricao ?? null,
    oem: item?.interpretacao?.oem ?? null,
  };
}

function valoresUnicosCampo(ocorrencias, campo) {
  return [
    ...new Set(
      ocorrencias.map((ocorrencia) =>
        normalizarCampoDuplicidade(ocorrencia.campos[campo])
      )
    ),
  ];
}

export function analisarDuplicidadeProdutosCandidatos(resultados = []) {
  const produtos = (resultados || [])
    .map((item, indice) => ({
      item,
      indice,
      campos: camposProdutoAuditoria(item),
    }))
    .filter(
      ({ item }) => item.interpretacao?.classificacao_candidata === "produto"
    );

  const gruposPorCodigo = new Map();

  for (const produto of produtos) {
    const chave = normalizarCodigoPecaAuditoria(produto.campos.codigo_peca);
    if (!chave) {
      continue;
    }
    if (!gruposPorCodigo.has(chave)) {
      gruposPorCodigo.set(chave, []);
    }
    gruposPorCodigo.get(chave).push(produto);
  }

  const grupos = [...gruposPorCodigo.entries()].map(([chave, ocorrencias]) => {
    const internos = valoresUnicosCampo(ocorrencias, "codigo_interno");
    const descricoes = valoresUnicosCampo(ocorrencias, "descricao");
    const oems = valoresUnicosCampo(ocorrencias, "oem");
    const repetido = ocorrencias.length > 1;
    const conflito =
      repetido &&
      (internos.length > 1 || descricoes.length > 1 || oems.length > 1);

    return {
      chave,
      codigo_peca: ocorrencias[0].campos.codigo_peca,
      quantidade: ocorrencias.length,
      paginasOrdens: ocorrencias
        .map(
          (ocorrencia) =>
            `${ocorrencia.item.bloco?.pagina ?? "—"}/${ocorrencia.item.bloco?.ordem_bloco ?? "—"}`
        )
        .join(", "),
      indices: ocorrencias.map((ocorrencia) => ocorrencia.indice),
      codigo_interno: ocorrencias
        .map((ocorrencia) => celulaAuditoria(ocorrencia.campos.codigo_interno))
        .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
        .join(" | "),
      descricao: ocorrencias
        .map((ocorrencia) => celulaAuditoria(ocorrencia.campos.descricao))
        .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
        .join(" | "),
      oem: ocorrencias
        .map((ocorrencia) => celulaAuditoria(ocorrencia.campos.oem))
        .filter((valor, indice, lista) => lista.indexOf(valor) === indice)
        .join(" | "),
      status: !repetido ? "único" : conflito ? "CONFLITO" : "CONSISTENTE",
      repetido,
      conflito,
    };
  });

  grupos.sort((a, b) => {
    if (a.conflito !== b.conflito) {
      return a.conflito ? -1 : 1;
    }
    if (a.repetido !== b.repetido) {
      return a.repetido ? -1 : 1;
    }
    return a.chave.localeCompare(b.chave);
  });

  const porIndice = new Map();
  for (const grupo of grupos) {
    for (const indice of grupo.indices) {
      porIndice.set(indice, grupo.status);
    }
  }

  return {
    grupos,
    porIndice,
    resumo: {
      produtosCandidatos: produtos.length,
      codigosUnicos: grupos.length,
      codigosRepetidos: grupos.filter((grupo) => grupo.repetido).length,
      repeticoesConsistentes: grupos.filter(
        (grupo) => grupo.status === "CONSISTENTE"
      ).length,
      conflitos: grupos.filter((grupo) => grupo.status === "CONFLITO").length,
    },
  };
}

export default function ImportadorCatalogos({
  cardStyle,
}) {
  const [
    fabricante,
    setFabricante,
  ] = useState("");

  const [
    arquivo,
    setArquivo,
  ] = useState(null);

  const [
    analisando,
    setAnalisando,
  ] = useState(false);

  const [
    importando,
    setImportando,
  ] = useState(false);

  const [
    progresso,
    setProgresso,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] = useState(null);

  const [
    resultado,
    setResultado,
  ] = useState(null);

  const [
    extraindoBruto,
    setExtraindoBruto,
  ] = useState(false);

  const [
    resultadoBruto,
    setResultadoBruto,
  ] = useState(null);

  const [
    inspecionarBlocos,
    setInspecionarBlocos,
  ] = useState(false);

  const [
    buscaInspecao,
    setBuscaInspecao,
  ] = useState("");

  const [
    interpretandoAmostra,
    setInterpretandoAmostra,
  ] = useState(false);

  const [
    resultadoInterpretacao,
    setResultadoInterpretacao,
  ] = useState(null);

  const [
    filtroAuditoriaFase2,
    setFiltroAuditoriaFase2,
  ] = useState("todos");

  const [
    blocoAuditoriaAtivo,
    setBlocoAuditoriaAtivo,
  ] = useState(null);

  const detalhesBlocoFase2Ref = useRef({});

  const tipoCatalogoDiagnostico =
    String(
      preview?.tipoCatalogo ||
        preview?.tipo_catalogo ||
        preview?.configuracao?.tipoCatalogo ||
        ""
    )
      .trim()
      .toLowerCase();

  const CODIGOS_DIAGNOSTICO =
    obterCodigosDiagnosticoCatalogo(
      tipoCatalogoDiagnostico,
      fabricante
    );

  const CODIGO_DIAGNOSTICO =
    CODIGOS_DIAGNOSTICO[0] || "";

  const diagnosticosPorCodigo =
    CODIGOS_DIAGNOSTICO.map((codigo) => {
      const registros = Array.isArray(preview?.registros)
        ? preview.registros.filter((registro) =>
            registroTemCodigoDiagnostico(registro, codigo)
          )
        : [];

      return {
        codigo,
        registros,
      };
    });

  const registrosDiagnostico =
    diagnosticosPorCodigo.flatMap(
      (item) => item.registros
    );

  const diagnosticosAusentes =
    diagnosticosPorCodigo.filter(
      (item) => item.registros.length === 0
    );

  function selecionarArquivo(
    event
  ) {
    const selecionado =
      event.target.files?.[0] ||
      null;

    setPreview(null);
    setResultado(null);
    setProgresso("");

    if (!selecionado) {
      setArquivo(null);
      return;
    }

    const ehPdf =
      selecionado.type ===
        "application/pdf" ||
      selecionado.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!ehPdf) {
      alert(
        "Selecione um catálogo em formato PDF."
      );

      event.target.value = "";
      setArquivo(null);

      return;
    }

    setArquivo(selecionado);
  }

  async function analisarPdf() {
    if (!arquivo) {
      alert(
        "Selecione o catálogo PDF."
      );
      return;
    }

    if (!fabricante) {
      alert(
        "Selecione o fabricante do catálogo."
      );
      return;
    }

    setAnalisando(true);
    setPreview(null);
    setResultado(null);
    setResultadoBruto(null);
    setInspecionarBlocos(false);
    setBuscaInspecao("");

    try {
      const resposta =
        await motorImportacao({
          arquivo,
          fabricante,
          modoPreview: true,

          onProgresso:
            (mensagem) => {
              setProgresso(
                String(
                  mensagem || ""
                )
              );
            },
        });

      setPreview(resposta);

      setProgresso(
        `✅ Análise concluída. ${
          resposta?.total || 0
        } registro(s) encontrado(s).`
      );
    } catch (erro) {
      console.error(
        "Erro ao analisar catálogo:",
        erro
      );

      setProgresso(
        "❌ Não foi possível analisar o catálogo."
      );

      alert(
        "Erro ao analisar catálogo: " +
          (erro instanceof Error
            ? erro.message
            : "Erro desconhecido.")
      );
    } finally {
      setAnalisando(false);
    }
  }

  async function importarPdf() {
    if (!arquivo) {
      alert(
        "Selecione o catálogo PDF."
      );
      return;
    }

    if (!fabricante) {
      alert(
        "Selecione o fabricante."
      );
      return;
    }

    if (!preview) {
      alert(
        "Analise o catálogo antes de importar."
      );
      return;
    }

    const total =
      Number(
        preview?.total || 0
      );

    if (total <= 0) {
      alert(
        "Nenhum registro foi encontrado. A importação foi bloqueada."
      );
      return;
    }

    const confirmar =
      window.confirm(
        `Importar ${total} registro(s) para a Base Técnica PAIIA?\n\n` +
          "O catálogo será processado novamente e gravado na base."
      );

    if (!confirmar) {
      return;
    }

    setImportando(true);
    setResultado(null);

    try {
      const resposta =
        await motorImportacao({
          arquivo,
          fabricante,
          modoPreview: false,

          onProgresso:
            (mensagem) => {
              setProgresso(
                String(
                  mensagem || ""
                )
              );
            },
        });

      setResultado(resposta);

      setProgresso(
        String(
          resposta?.mensagem ||
            `✅ Importação concluída. ${
              resposta?.total || 0
            } registro(s) processado(s).`
        ).replace(/\n/g, " | ")
      );

      alert(
        `${
          resposta?.mensagem ||
          "✅ Catálogo importado com sucesso."
        }\n\nFabricante: ${
          resposta?.fabricante ||
          fabricante
        }`
      );
    } catch (erro) {
      console.error(
        "Erro ao importar catálogo:",
        erro
      );

      setProgresso(
        "❌ Erro durante a importação."
      );

      alert(
        "Erro ao importar catálogo: " +
          (erro instanceof Error
            ? erro.message
            : "Erro desconhecido.")
      );
    } finally {
      setImportando(false);
    }
  }

  async function extrairBrutoPdf() {
    if (!arquivo) {
      alert("Selecione o catálogo PDF.");
      return;
    }

    if (!fabricante) {
      alert("Selecione o fabricante do catálogo.");
      return;
    }

    setExtraindoBruto(true);
    setResultadoBruto(null);
    setInspecionarBlocos(false);
    setBuscaInspecao("");
    setPreview(null);
    setResultado(null);

    try {
      const resposta = await executarExtracaoBruta({
        arquivo,
        fabricante,
        onProgresso: (mensagem) => {
          setProgresso(String(mensagem || ""));
        },
      });

      setResultadoBruto(resposta);
      setProgresso(
        `✅ Extração bruta gravada. ${resposta.totalPaginas} página(s), ${resposta.totalBlocos} bloco(s). Nada foi enviado para catalogo_pecas.`
      );
    } catch (erro) {
      console.error("Erro na extração bruta:", erro);
      setProgresso("❌ Não foi possível gravar a extração bruta.");
      alert(
        "Erro na extração bruta: " +
          (erro instanceof Error ? erro.message : "Erro desconhecido.")
      );
    } finally {
      setExtraindoBruto(false);
    }
  }

  async function interpretarAmostraFase2() {
    setInterpretandoAmostra(true);
    setResultadoInterpretacao(null);
    setFiltroAuditoriaFase2("todos");
    setBlocoAuditoriaAtivo(null);

    try {
      const resposta = await executarInterpretacaoAmostra({
        loteId: resultadoBruto?.loteId || null,
        onProgresso: (mensagem) => {
          setProgresso(String(mensagem || ""));
        },
      });

      setResultadoInterpretacao(resposta);
      setProgresso(
        `✅ Lote de validação Fase 2: ${resposta.totalInterpretados} bloco(s) interpretados de ${resposta.totalBlocosLote} no lote. Nada foi enviado para catalogo_pecas.`
      );
    } catch (erro) {
      console.error("Erro na interpretação da amostra:", erro);
      setProgresso("❌ Não foi possível interpretar a amostra da Fase 2.");
      alert(
        "Erro na interpretação da amostra: " +
          (erro instanceof Error ? erro.message : "Erro desconhecido.")
      );
    } finally {
      setInterpretandoAmostra(false);
    }
  }

  const ocupado =
    analisando ||
    importando ||
    extraindoBruto ||
    interpretandoAmostra;

  const blocosInspecao = resultadoBruto?.blocos || [];
  const termoInspecao = String(buscaInspecao || "")
    .trim()
    .toUpperCase();
  const blocosInspecaoFiltrados = termoInspecao
    ? blocosInspecao.filter((bloco) =>
        String(bloco.texto_original || "")
          .toUpperCase()
          .includes(termoInspecao)
      )
    : blocosInspecao;

  const resultadosFase2 = resultadoInterpretacao?.resultados || [];
  const filtroAuditoria = FILTROS_AUDITORIA_FASE2.find(
    (item) => item.id === filtroAuditoriaFase2
  );
  const linhasAuditoriaFase2 = resultadosFase2
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) =>
      filtroAuditoria?.tipo
        ? item.interpretacao?.classificacao_candidata === filtroAuditoria.tipo
        : true
    );

  const duplicidadeProdutosFase2 =
    analisarDuplicidadeProdutosCandidatos(resultadosFase2);

  function irParaDetalheBlocoFase2(indice) {
    setBlocoAuditoriaAtivo(indice);
    const alvo = detalhesBlocoFase2Ref.current[indice];
    if (alvo?.scrollIntoView) {
      alvo.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            color: "#67e8f9",
            marginTop: 0,
            marginBottom: "8px",
          }}
        >
          📚 Importador de Catálogos PDF
        </h2>

        <p
          style={{
            color: "#cbd5e1",
            margin: 0,
            lineHeight: "1.6",
          }}
        >
          Importe catálogos técnicos
          originais para a Base Técnica
          PAIIA.
        </p>
      </div>

      <div style={painelStyle}>
        <div style={etiquetaStyle}>
          1. FABRICANTE
        </div>

        <select
          value={fabricante}
          disabled={ocupado}
          onChange={(event) => {
            setFabricante(
              event.target.value
            );

            setPreview(null);
            setResultado(null);
            setResultadoBruto(null);
            setInspecionarBlocos(false);
            setBuscaInspecao("");
            setProgresso("");
          }}
          style={campoStyle}
        >
          <option value="">
            Selecione o fabricante
          </option>

          {FABRICANTES.map(
            (item) => (
              <option
                key={item.valor}
                value={item.valor}
              >
                {item.nome}
              </option>
            )
          )}
        </select>

        <div
          style={{
            ...etiquetaStyle,
            marginTop: "22px",
          }}
        >
          2. CATÁLOGO PDF
        </div>

        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={ocupado}
          onChange={
            selecionarArquivo
          }
          style={{
            ...campoStyle,
            padding: "11px",
          }}
        />

        {arquivo && (
          <div style={arquivoStyle}>
            <div>
              📄{" "}
              <strong>
                {arquivo.name}
              </strong>
            </div>

            <div
              style={{
                marginTop: "5px",
                color: "#94a3b8",
                fontSize: "13px",
              }}
            >
              {(
                arquivo.size /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={analisarPdf}
          disabled={
            ocupado ||
            !arquivo ||
            !fabricante
          }
          style={{
            ...botaoPrincipal,
            opacity:
              ocupado ||
              !arquivo ||
              !fabricante
                ? 0.55
                : 1,
            cursor:
              ocupado ||
              !arquivo ||
              !fabricante
                ? "not-allowed"
                : "pointer",
          }}
        >
          {analisando
            ? "⏳ Analisando catálogo..."
            : "🔎 Analisar PDF"}
        </button>

        <button
          type="button"
          onClick={extrairBrutoPdf}
          disabled={
            ocupado ||
            !arquivo ||
            !fabricante
          }
          style={{
            ...botaoPrincipal,
            background: "#0f766e",
            opacity:
              ocupado ||
              !arquivo ||
              !fabricante
                ? 0.55
                : 1,
            cursor:
              ocupado ||
              !arquivo ||
              !fabricante
                ? "not-allowed"
                : "pointer",
          }}
        >
          {extraindoBruto
            ? "⏳ Gravando extração bruta..."
            : "💾 Extrair bruto (Fase 1)"}
        </button>

        <button
          type="button"
          onClick={interpretarAmostraFase2}
          disabled={ocupado}
          style={{
            ...botaoPrincipal,
            background: "#6d28d9",
            opacity: ocupado ? 0.55 : 1,
            cursor: ocupado ? "not-allowed" : "pointer",
          }}
        >
          {interpretandoAmostra
            ? "⏳ Interpretando lote de validação..."
            : "🧠 Interpretar lote de validação Fase 2 (50 blocos)"}
        </button>
      </div>

      {resultadoInterpretacao && (
        <div style={resultadoStyle}>
          <h3
            style={{
              color: "#c4b5fd",
              marginTop: 0,
            }}
          >
            Fase 2 — lote de validação
          </h3>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              marginBottom: "14px",
            }}
          >
            {resultadoInterpretacao.totalInterpretados} bloco(s) interpretados
            de {resultadoInterpretacao.totalBlocosLote} no lote{" "}
            {resultadoInterpretacao.loteId}. Fase 1 não foi alterada.
            catalogo_pecas: nenhum registro enviado.
          </div>

          {resultadoInterpretacao.resumo && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              {[
                ["Total analisado", resultadoInterpretacao.resumo.totalAnalisado],
                [
                  "Produtos candidatos",
                  resultadoInterpretacao.resumo.produtosCandidatos,
                ],
                [
                  "Tabelas/referências",
                  resultadoInterpretacao.resumo.tabelasReferencias,
                ],
                ["Aplicações", resultadoInterpretacao.resumo.aplicacoes],
                ["Indefinidos", resultadoInterpretacao.resumo.indefinidos],
                ["Revisão manual", resultadoInterpretacao.resumo.revisaoManual],
                [
                  "Confiança média",
                  Number(resultadoInterpretacao.resumo.confiancaMedia || 0).toFixed(
                    2
                  ),
                ],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} style={infoStyle}>
                  <span style={rotuloStyle}>{rotulo}</span>
                  <strong>{valor}</strong>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            {FILTROS_AUDITORIA_FASE2.map((filtro) => (
              <button
                key={filtro.id}
                type="button"
                onClick={() => setFiltroAuditoriaFase2(filtro.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border:
                    filtroAuditoriaFase2 === filtro.id
                      ? "1px solid #c4b5fd"
                      : "1px solid #334155",
                  background:
                    filtroAuditoriaFase2 === filtro.id ? "#4c1d95" : "#0f172a",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {filtro.rotulo}
              </button>
            ))}
          </div>

          <div style={tabelaAuditoriaWrapStyle}>
            <table style={tabelaAuditoriaStyle}>
              <thead>
                <tr>
                  {[
                    "#",
                    "página",
                    "ordem",
                    "classificação",
                    "código_peça",
                    "código_interno",
                    "descrição",
                    "OEM",
                    "confiança",
                    "revisão_manual",
                    "duplicidade",
                  ].map((coluna) => (
                    <th key={coluna} style={tabelaAuditoriaThStyle}>
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasAuditoriaFase2.map(({ item, indice }) => {
                  const ativo = blocoAuditoriaAtivo === indice;
                  const duplicidade =
                    item.interpretacao?.classificacao_candidata === "produto"
                      ? duplicidadeProdutosFase2.porIndice.get(indice) || "—"
                      : "—";
                  return (
                    <tr
                      key={
                        item.interpretacao?.id ||
                        `${item.amostraCodigo}-${indice}`
                      }
                      onClick={() => irParaDetalheBlocoFase2(indice)}
                      style={{
                        cursor: "pointer",
                        background: ativo ? "#312e81" : "transparent",
                      }}
                    >
                      <td style={tabelaAuditoriaTdStyle}>{indice + 1}</td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(item.bloco?.pagina)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(item.bloco?.ordem_bloco)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(
                          item.interpretacao?.classificacao_candidata
                        )}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(item.interpretacao?.codigo_peca)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(
                          item.interpretacao?.evidencias?.codigo_interno
                        )}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(item.interpretacao?.descricao)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {celulaAuditoria(item.interpretacao?.oem)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {item.interpretacao?.confianca == null
                          ? "—"
                          : Number(item.interpretacao.confianca).toFixed(2)}
                      </td>
                      <td style={tabelaAuditoriaTdStyle}>
                        {item.interpretacao?.revisao_manual ? "sim" : "não"}
                      </td>
                      <td
                        style={{
                          ...tabelaAuditoriaTdStyle,
                          color:
                            duplicidade === "CONFLITO"
                              ? "#fca5a5"
                              : duplicidade === "CONSISTENTE"
                                ? "#86efac"
                                : "#cbd5e1",
                          fontWeight:
                            duplicidade === "CONFLITO" ||
                            duplicidade === "CONSISTENTE"
                              ? "700"
                              : "400",
                        }}
                      >
                        {duplicidade}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              color: "#c4b5fd",
              fontSize: "13px",
              fontWeight: "700",
              marginBottom: "8px",
            }}
          >
            Duplicidade de produtos candidatos
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "12px",
              marginBottom: "10px",
            }}
          >
            Repetição não é erro automático. O mesmo produto pode aparecer em
            páginas/estruturas diferentes. Nenhum registro foi mesclado ou
            excluído.
          </div>
          <div style={tabelaAuditoriaWrapStyle}>
            <table style={tabelaAuditoriaStyle}>
              <thead>
                <tr>
                  {[
                    "código_peça",
                    "ocorrências",
                    "páginas/ordens",
                    "código_interno",
                    "descrição",
                    "OEM",
                    "status",
                  ].map((coluna) => (
                    <th key={coluna} style={tabelaAuditoriaThStyle}>
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {duplicidadeProdutosFase2.grupos.map((grupo) => (
                  <tr
                    key={grupo.chave}
                    onClick={() => irParaDetalheBlocoFase2(grupo.indices[0])}
                    style={{
                      cursor: "pointer",
                      background:
                        grupo.status === "CONFLITO"
                          ? "rgba(127,29,29,.35)"
                          : grupo.status === "CONSISTENTE"
                            ? "rgba(20,83,45,.35)"
                            : "transparent",
                    }}
                  >
                    <td style={tabelaAuditoriaTdStyle}>{grupo.codigo_peca}</td>
                    <td style={tabelaAuditoriaTdStyle}>{grupo.quantidade}</td>
                    <td
                      style={tabelaAuditoriaTdStyle}
                      title={grupo.paginasOrdens}
                    >
                      {grupo.paginasOrdens}
                    </td>
                    <td style={tabelaAuditoriaTdStyle}>{grupo.codigo_interno}</td>
                    <td style={tabelaAuditoriaTdStyle}>{grupo.descricao}</td>
                    <td style={tabelaAuditoriaTdStyle}>{grupo.oem}</td>
                    <td
                      style={{
                        ...tabelaAuditoriaTdStyle,
                        fontWeight: "700",
                        color:
                          grupo.status === "CONFLITO"
                            ? "#fca5a5"
                            : grupo.status === "CONSISTENTE"
                              ? "#86efac"
                              : "#cbd5e1",
                      }}
                    >
                      {grupo.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            {[
              [
                "Produtos candidatos",
                duplicidadeProdutosFase2.resumo.produtosCandidatos,
              ],
              ["Códigos únicos", duplicidadeProdutosFase2.resumo.codigosUnicos],
              [
                "Códigos repetidos",
                duplicidadeProdutosFase2.resumo.codigosRepetidos,
              ],
              [
                "Repetições consistentes",
                duplicidadeProdutosFase2.resumo.repeticoesConsistentes,
              ],
              ["Conflitos", duplicidadeProdutosFase2.resumo.conflitos],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} style={infoStyle}>
                <span style={rotuloStyle}>{rotulo}</span>
                <strong>{valor}</strong>
              </div>
            ))}
          </div>

          <div
            style={{
              ...inspecaoListaStyle,
              maxHeight: "72vh",
            }}
          >
          {(resultadoInterpretacao.resultados || []).map((item, indice) => (
            <div
              key={item.interpretacao?.id || `${item.amostraCodigo}-${indice}`}
              ref={(no) => {
                detalhesBlocoFase2Ref.current[indice] = no;
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
                outline:
                  blocoAuditoriaAtivo === indice
                    ? "2px solid #c4b5fd"
                    : "none",
                borderRadius: "12px",
                scrollMarginTop: "12px",
              }}
            >
              <div style={inspecaoItemStyle}>
                <span style={rotuloStyle}>Bloco bruto original</span>
                <div>
                  #{indice + 1} · {item.amostraCodigo} · página {item.bloco?.pagina} ·
                  ordem {item.bloco?.ordem_bloco}
                </div>
                <pre style={inspecaoPreStyle}>
                  {item.bloco?.texto_original || "(vazio)"}
                </pre>
              </div>
              <div style={inspecaoItemStyle}>
                <span style={rotuloStyle}>Interpretação candidata</span>
                <div>
                  {item.interpretacao?.classificacao_candidata} ·{" "}
                  {item.interpretacao?.status_interpretacao} · revisão manual:{" "}
                  {item.interpretacao?.revisao_manual ? "sim" : "não"}
                </div>
                <pre style={inspecaoPreStyle}>
                  {JSON.stringify(
                    {
                      codigo_peca: item.interpretacao?.codigo_peca ?? null,
                      codigo_interno:
                        item.interpretacao?.evidencias?.codigo_interno ?? null,
                      descricao: item.interpretacao?.descricao ?? null,
                      oem: item.interpretacao?.oem ?? null,
                      fabricante_marca:
                        item.interpretacao?.fabricante_marca ?? null,
                      aplicacoes: item.interpretacao?.aplicacoes ?? [],
                      equivalencias: item.interpretacao?.equivalencias ?? [],
                      confianca: item.interpretacao?.confianca ?? null,
                      motivo_classificacao:
                        item.interpretacao?.motivo_classificacao ?? null,
                      evidencias: item.interpretacao?.evidencias ?? {},
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {resultadoBruto && (
        <div style={resultadoStyle}>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            Extração bruta persistida
          </h3>

          <div style={gridStyle}>
            <div style={infoStyle}>
              <span style={rotuloStyle}>
                PDF
              </span>
              <strong>
                {resultadoBruto.arquivoNome}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Lote / importação
              </span>
              <strong>
                {resultadoBruto.loteId}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas totais
              </span>
              <strong>
                {resultadoBruto.totalPaginas}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas processadas
              </span>
              <strong>
                {resultadoBruto.paginasProcessadas}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Blocos extraídos
              </span>
              <strong>
                {resultadoBruto.totalBlocos}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Páginas com erro
              </span>
              <strong>
                {resultadoBruto.paginasComErro || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Blocos pendentes
              </span>
              <strong>
                {resultadoBruto.blocosPendentes || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Status da extração
              </span>
              <strong>
                {resultadoBruto.statusExtracao}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setInspecionarBlocos((aberto) => !aberto)
            }
            style={{
              ...botaoPrincipal,
              marginTop: "16px",
              background: "#155e75",
            }}
          >
            {inspecionarBlocos
              ? "Fechar inspeção"
              : "Inspecionar blocos"}
          </button>

          {inspecionarBlocos && (
            <div>
              <div
                style={{
                  marginTop: "16px",
                  marginBottom: "10px",
                }}
              >
                <span style={rotuloStyle}>
                  Buscar em texto_original
                </span>
                <input
                  type="search"
                  value={buscaInspecao}
                  onChange={(event) => {
                    setBuscaInspecao(event.target.value);
                  }}
                  placeholder="IWP049, IWP058, TB0032, FEI0019..."
                  style={campoStyle}
                />
                <div
                  style={{
                    marginTop: "8px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  {`${blocosInspecaoFiltrados.length} de ${blocosInspecao.length} bloco(s)`}
                </div>
              </div>

              <div style={inspecaoListaStyle}>
              {blocosInspecao.length === 0 ? (
                <div>Nenhum bloco bruto para inspecionar.</div>
              ) : blocosInspecaoFiltrados.length === 0 ? (
                <div>
                  Nenhum bloco com “{buscaInspecao.trim()}” em texto_original.
                </div>
              ) : (
                blocosInspecaoFiltrados.map((bloco, indice) => (
                  <div
                    key={bloco.id || `${bloco.pagina}-${bloco.ordem_bloco}-${indice}`}
                    style={inspecaoItemStyle}
                  >
                    <div style={gridStyle}>
                      <div>
                        <span style={rotuloStyle}>Página</span>
                        <strong>{bloco.pagina}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Ordem</span>
                        <strong>{bloco.ordem_bloco}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Status</span>
                        <strong>{bloco.status}</strong>
                      </div>
                      <div>
                        <span style={rotuloStyle}>Hash</span>
                        <strong>{bloco.arquivoHash || resultadoBruto.arquivoHash}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <span style={rotuloStyle}>texto_original</span>
                      <pre style={inspecaoPreStyle}>
                        {bloco.texto_original || "(vazio)"}
                      </pre>
                    </div>

                    <div style={{ marginTop: "12px" }}>
                      <span style={rotuloStyle}>linhas_originais</span>
                      <pre style={inspecaoPreStyle}>
                        {JSON.stringify(bloco.linhas_originais || [], null, 2)}
                      </pre>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: "14px",
              color: "#86efac",
              fontSize: "14px",
            }}
          >
            catalogo_pecas: nenhum registro enviado.
          </div>
        </div>
      )}

      {preview && (
        <div style={resultadoStyle}>
          <h3
            style={{
              color: "#67e8f9",
              marginTop: 0,
            }}
          >
            ✅ Catálogo analisado
          </h3>

          <div style={gridStyle}>
            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Fabricante
              </span>

              <strong>
                {preview.fabricante ||
                  fabricante}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Registros encontrados
              </span>

              <strong
                style={{
                  fontSize: "24px",
                  color: "#86efac",
                }}
              >
                {preview.total || 0}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Tipo de catálogo
              </span>

              <strong>
                {preview
                  ?.configuracao
                  ?.tipoCatalogo ||
                  "Detectado automaticamente"}
              </strong>
            </div>

            <div style={infoStyle}>
              <span style={rotuloStyle}>
                Arquivo
              </span>

              <strong>
                {arquivo?.name}
              </strong>
            </div>
          </div>

          <div style={diagnosticoStyle}>
            <div style={diagnosticoCabecalhoStyle}>
              <div>
                <div style={etiquetaDiagnosticoStyle}>
                  DIAGNÓSTICO DO CATÁLOGO
                </div>

                <h3
                  style={{
                    color: "#ffffff",
                    margin: "5px 0 0",
                  }}
                >
                  {CODIGOS_DIAGNOSTICO.length
                    ? `Códigos ${CODIGOS_DIAGNOSTICO.join(" · ")}`
                    : "Sem código de diagnóstico deste tipo"}
                </h3>
              </div>

              <div style={contadorDiagnosticoStyle}>
                {diagnosticosPorCodigo
                  .map(
                    (item) =>
                      `${item.codigo}: ${item.registros.length}`
                  )
                  .join(" · ") || "0 aplicação(ões)"}
              </div>
            </div>

            {CODIGOS_DIAGNOSTICO.length === 0 ? (
              <div style={alertaDiagnosticoStyle}>
                ⚠️ Este tipo de catálogo não tem código de
                diagnóstico específico. Não reutilize código
                de outra família.
              </div>
            ) : diagnosticosAusentes.length > 0 ? (
              <div style={alertaDiagnosticoStyle}>
                ⚠️ O(s) código(s){" "}
                {diagnosticosAusentes
                  .map((item) => item.codigo)
                  .join(", ")}{" "}
                não apareceu(ram) no preview. Não importe o
                catálogo até verificarmos o parser.
              </div>
            ) : (
              <div style={tabelaDiagnosticoStyle}>
                {diagnosticosPorCodigo.map((bloco) =>
                  bloco.registros.slice(0, 8).map((registro, indice) => (
                  <div
                    key={`${bloco.codigo}-${indice}`}
                    style={linhaDiagnosticoStyle}
                  >
                    <div>
                      <span style={rotuloStyle}>
                        Código
                      </span>

                      <strong>
                        {bloco.codigo}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Montadora
                      </span>

                      <strong>
                        {registro?.montadora || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Modelo
                      </span>

                      <strong>
                        {registro?.modelo || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Motor
                      </span>

                      <strong>
                        {registro?.motor || "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Anos
                      </span>

                      <strong>
                        {registro?.ano_inicio ||
                          registro?.anoInicio ||
                          "-"}
                        {" → "}
                        {registro?.ano_fim ||
                          registro?.anoFim ||
                          "-"}
                      </strong>
                    </div>

                    <div>
                      <span style={rotuloStyle}>
                        Observação
                      </span>

                      <strong>
                        {registro?.observacao || "-"}
                      </strong>
                    </div>
                  </div>
                ))
                )}
              </div>
            )}
          </div>

          {Number(
            preview.total || 0
          ) > 0 && (
            <button
              type="button"
              onClick={importarPdf}
              disabled={importando}
              style={{
                ...botaoImportar,
                cursor: importando
                  ? "not-allowed"
                  : "pointer",
                opacity: importando
                  ? 0.6
                  : 1,
              }}
            >
              {importando
                ? "⏳ Importando para a base..."
                : "💾 Importar para Base PAIIA"}
            </button>
          )}

          {Number(
            preview.total || 0
          ) === 0 && (
            <div style={alertaStyle}>
              ⚠️ Nenhum registro
              técnico foi identificado.
              A gravação foi bloqueada
              para proteger a Base
              PAIIA.
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div style={sucessoStyle}>
          <strong>
            ✅ Importação finalizada
          </strong>

          <div
            style={{
              marginTop: "7px",
            }}
          >
            {(resultado.mensagem ||
              `${resultado.total || 0} registro(s) processado(s) pelo importador técnico.`)
              .split("\n")
              .map((linha, indice) => (
                <div
                  key={`${linha}-${indice}`}
                  style={{
                    marginTop: indice === 0 ? "7px" : "2px",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {linha}
                </div>
              ))}
          </div>
        </div>
      )}

      <div style={rodapeStyle}>
        <strong>
          🛡️ Importação técnica
        </strong>

        <div
          style={{
            marginTop: "6px",
          }}
        >
          O PDF é analisado pelo motor
          de importação e pelo parser
          específico do fabricante antes
          da gravação na base.
        </div>
      </div>
    </div>
  );
}

const painelStyle = {
  padding: "22px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #2563eb",
};

const etiquetaStyle = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
  marginBottom: "8px",
};

const campoStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "15px",
  boxSizing: "border-box",
};

const arquivoStyle = {
  marginTop: "14px",
  padding: "14px",
  borderRadius: "10px",
  background:
    "rgba(34,211,238,.07)",
  border:
    "1px solid rgba(103,232,249,.25)",
  color: "#cffafe",
};

const botaoPrincipal = {
  width: "100%",
  marginTop: "20px",
  padding: "14px 20px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#0891b2)",
  color: "#ffffff",
  fontWeight: "bold",
  fontSize: "15px",
};

const progressoStyle = {
  marginTop: "18px",
  padding: "15px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#cbd5e1",
  lineHeight: "1.5",
};

const resultadoStyle = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  background: "#020617",
  border: "1px solid #22d3ee",
};

const tabelaAuditoriaWrapStyle = {
  marginBottom: "16px",
  maxHeight: "280px",
  overflow: "auto",
  border: "1px solid #334155",
  borderRadius: "10px",
};

const tabelaAuditoriaStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "12px",
  color: "#e2e8f0",
};

const tabelaAuditoriaThStyle = {
  position: "sticky",
  top: 0,
  background: "#1e1b4b",
  color: "#c4b5fd",
  textAlign: "left",
  padding: "8px",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #4338ca",
};

const tabelaAuditoriaTdStyle = {
  padding: "7px 8px",
  borderBottom: "1px solid #1e293b",
  whiteSpace: "nowrap",
  maxWidth: "160px",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const inspecaoListaStyle = {
  marginTop: "16px",
  maxHeight: "520px",
  overflow: "auto",
  display: "grid",
  gap: "12px",
};

const inspecaoItemStyle = {
  padding: "14px",
  borderRadius: "12px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#e2e8f0",
};

const inspecaoPreStyle = {
  margin: 0,
  padding: "12px",
  borderRadius: "8px",
  background: "#020617",
  border: "1px solid #1e293b",
  color: "#cbd5e1",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "12px",
  maxHeight: "220px",
  overflow: "auto",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(190px,1fr))",
  gap: "12px",
};

const infoStyle = {
  padding: "14px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
  overflowWrap: "anywhere",
};

const rotuloStyle = {
  display: "block",
  color: "#94a3b8",
  fontSize: "12px",
  marginBottom: "6px",
};

const diagnosticoStyle = {
  marginTop: "18px",
  padding: "18px",
  borderRadius: "14px",
  background: "#08111f",
  border: "1px solid #334155",
};

const diagnosticoCabecalhoStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "14px",
};

const etiquetaDiagnosticoStyle = {
  color: "#67e8f9",
  fontSize: "11px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
};

const contadorDiagnosticoStyle = {
  padding: "8px 12px",
  borderRadius: "999px",
  background: "rgba(34,197,94,.12)",
  border: "1px solid rgba(34,197,94,.35)",
  color: "#86efac",
  fontWeight: "bold",
};

const alertaDiagnosticoStyle = {
  padding: "14px",
  borderRadius: "10px",
  background: "rgba(245,158,11,.08)",
  border: "1px solid rgba(245,158,11,.35)",
  color: "#fde68a",
  lineHeight: "1.5",
};

const tabelaDiagnosticoStyle = {
  display: "grid",
  gap: "10px",
};

const linhaDiagnosticoStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(150px,1fr))",
  gap: "10px",
  padding: "12px",
  borderRadius: "10px",
  background: "#0f172a",
  border: "1px solid #1e293b",
  color: "#e2e8f0",
};

const botaoImportar = {
  width: "100%",
  marginTop: "18px",
  padding: "15px 20px",
  borderRadius: "11px",
  border: "none",
  background:
    "linear-gradient(135deg,#059669,#22c55e)",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
};

const alertaStyle = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "10px",
  background:
    "rgba(245,158,11,.08)",
  border:
    "1px solid rgba(245,158,11,.35)",
  color: "#fde68a",
  lineHeight: "1.5",
};

const sucessoStyle = {
  marginTop: "18px",
  padding: "16px",
  borderRadius: "12px",
  background:
    "rgba(34,197,94,.08)",
  border:
    "1px solid rgba(34,197,94,.35)",
  color: "#bbf7d0",
};

const rodapeStyle = {
  marginTop: "20px",
  padding: "15px",
  borderRadius: "12px",
  background:
    "rgba(37,99,235,.06)",
  border:
    "1px solid rgba(37,99,235,.2)",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: "1.5",
};