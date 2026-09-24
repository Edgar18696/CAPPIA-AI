import { useEffect, useMemo, useState } from "react";
import {
  CATALOGOS_ONLINE,
  GRUPOS_CATALOGOS_ONLINE,
  TIPOS_ACESSO,
  ROTULOS_BUSCA,
} from "../config/catalogosOnline";

// Área independente "Catálogos Online".
// Apenas abre catálogos externos em nova aba. Não faz scraping,
// não importa dados, não consulta a base interna e não guarda
// login, senha ou pagamento. O código/chassi digitado fica só na tela
// (e na área de transferência, para colar no site externo).

const CORES_ACESSO = {
  Livre: { fundo: "#052e16", borda: "#16a34a", texto: "#86efac" },
  Cadastro: { fundo: "#1e1b4b", borda: "#6366f1", texto: "#c7d2fe" },
  Assinatura: { fundo: "#3b0764", borda: "#c026d3", texto: "#f5d0fe" },
  Login: { fundo: "#172554", borda: "#3b82f6", texto: "#bfdbfe" },
  "Indisponível": { fundo: "#450a0a", borda: "#dc2626", texto: "#fecaca" },
  Bloqueado: { fundo: "#450a0a", borda: "#dc2626", texto: "#fecaca" },
};

const ROTULO_SELO = {
  Bloqueado: "🚫 Bloqueado no Brasil",
  "Indisponível": "⛔ Indisponível no Brasil",
};

// Modos de pesquisa oferecidos ao usuário
const MODOS = [
  {
    id: "auto",
    titulo: "Automático",
    icone: "✨",
    placeholder:
      "Digite o nome do catálogo, a peça, o código/OEM ou o chassi — o PAIIA identifica",
  },
  {
    id: "codigo",
    titulo: "Código / OEM",
    icone: "#️⃣",
    placeholder: "Ex.: 0258006827, 55562208, 7701050921",
  },
  {
    id: "descricao",
    titulo: "Descrição / peça",
    icone: "🔧",
    placeholder: "Ex.: sonda lambda, bico injetor, bobina, vela",
  },
  {
    id: "veiculo",
    titulo: "Veículo",
    icone: "🚗",
    placeholder: "Ex.: Chevrolet Onix, Renault Sandero, Fiat",
  },
  {
    id: "vin",
    titulo: "Chassi / VIN",
    icone: "🔎",
    placeholder: "Digite o chassi / VIN (17 letras e números, sem I, O e Q)",
  },
];

// Palavras que o usuário costuma digitar -> termos que aparecem nos cartões
const SINONIMOS = {
  sonda: ["sonda", "lambda", "sensor"],
  lambda: ["lambda", "sonda", "sensor"],
  bico: ["bico", "injecao", "injetor"],
  bicos: ["bico", "injecao", "injetor"],
  injetor: ["injetor", "bico", "injecao"],
  bobina: ["bobina", "ignicao"],
  bobinas: ["bobina", "ignicao"],
  vela: ["vela", "ignicao"],
  velas: ["vela", "ignicao"],
  cabo: ["cabo", "ignicao"],
  cabos: ["cabo", "ignicao"],
  sensor: ["sensor", "sonda"],
  sensores: ["sensor", "sonda"],
  bomba: ["bomba"],
  combustivel: ["combustivel", "bomba", "injecao"],
  oem: ["oem"],
  original: ["genuina", "oficial", "original"],
  genuina: ["genuina", "oficial"],
  equivalente: ["equivalencia", "referencia cruzada"],
  equivalencia: ["equivalencia", "referencia cruzada"],
  codigo: ["codigo", "referencia"],
  chassi: ["chassi", "vin"],
  vin: ["vin", "chassi"],
  placa: ["placa"],
  gm: ["gm", "chevrolet"],
  chevrolet: ["chevrolet", "gm"],
  vw: ["volkswagen", "vw"],
  mercedes: ["mercedes"],
  marelli: ["marelli", "cofap"],
  cofap: ["cofap", "marelli"],
  vdo: ["vdo", "continental"],
  ngk: ["ngk", "ntk"],
  ntk: ["ntk", "ngk"],
};

// Palavras de marca de veículo -> marca usada no filtro (para o modo Veículo)
const MARCAS_VEICULO = {
  chevrolet: "Chevrolet / GM",
  gm: "Chevrolet / GM",
  renault: "Renault",
  fiat: "Fiat",
  jeep: "Jeep / Ram / Dodge",
  ram: "Jeep / Ram / Dodge",
  dodge: "Jeep / Ram / Dodge",
  peugeot: "Peugeot / Citroën",
  citroen: "Peugeot / Citroën",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  audi: "Audi",
  ford: "Ford",
  toyota: "Toyota",
  nissan: "Nissan",
  hyundai: "Hyundai",
  kia: "Kia",
  mitsubishi: "Mitsubishi",
  mercedes: "Mercedes-Benz",
  bmw: "BMW / MINI",
  mini: "BMW / MINI",
  volvo: "Volvo",
  jaguar: "Jaguar / Land Rover",
  land: "Jaguar / Land Rover",
};

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Chassi/VIN: 17 caracteres, sem I, O e Q, com letras e números
function limparChassi(texto) {
  return String(texto || "")
    .toUpperCase()
    .replace(/[\s.\-/]/g, "");
}
function pareceChassi(texto) {
  const t = limparChassi(texto);
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(t) && /\d/.test(t) && /[A-Z]/.test(t);
}

// Parece um código de peça? (tem número e pelo menos 4 caracteres)
function pareceCodigo(texto) {
  const t = String(texto || "").trim();
  return t.length >= 4 && /\d/.test(t) && /^[A-Za-z0-9.\-/ ]+$/.test(t);
}

function textoDoCatalogo(c) {
  return normalizar(
    [
      c.nome,
      c.fabricante,
      (c.marcas || []).join(" "),
      c.categoria,
      c.descricao,
      c.observacao,
      (c.busca || []).map((b) => ROTULOS_BUSCA[b] || b).join(" "),
      c.oficial ? "oficial genuina original" : "",
      // catálogos oficiais de montadora trazem os códigos OEM
      c.oficial && c.grupo === "montadora" ? "oem" : "",
    ].join(" ")
  );
}

function combinaTexto(alvo, termo) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  return palavras.every((p) => {
    const alternativas = SINONIMOS[p] || [p];
    return alternativas.some((a) => alvo.includes(a));
  });
}

const aceita = (c, tipos) => (c.busca || []).some((b) => tipos.includes(b));

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export default function CatalogosOnline({
  catalogos = CATALOGOS_ONLINE,
  onVoltarCentral,
}) {
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("auto");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroMarca, setFiltroMarca] = useState("todas");
  const [filtroAcesso, setFiltroAcesso] = useState("Todos");
  const [copiado, setCopiado] = useState(""); // texto que está na área de transferência

  // Marcas disponíveis por grupo (para o filtro "Fabricante / marca")
  const marcasPorGrupo = useMemo(() => {
    const mapa = {};
    GRUPOS_CATALOGOS_ONLINE.forEach((g) => {
      const set = new Set();
      catalogos
        .filter((c) => c.grupo === g.id)
        .forEach((c) => (c.marcas || [c.fabricante]).forEach((m) => set.add(m)));
      mapa[g.id] = [...set].sort((a, b) => {
        if (a === "Multimarcas") return 1;
        if (b === "Multimarcas") return -1;
        return a.localeCompare(b, "pt-BR");
      });
    });
    return mapa;
  }, [catalogos]);

  // Filtros de grupo, marca e acesso
  const baseFiltrada = useMemo(
    () =>
      catalogos.filter((c) => {
        if (filtroGrupo !== "todos" && c.grupo !== filtroGrupo) return false;
        if (filtroMarca !== "todas" && !(c.marcas || []).includes(filtroMarca))
          return false;
        if (filtroAcesso !== "Todos" && c.acesso !== filtroAcesso) return false;
        return true;
      }),
    [catalogos, filtroGrupo, filtroMarca, filtroAcesso]
  );

  // Aplica o modo de pesquisa
  const resultado = useMemo(() => {
    const termo = busca.trim();

    // 1) Modo efetivo (no automático, o PAIIA identifica o tipo)
    let efetivo = modo;
    if (modo === "auto") {
      if (!termo) efetivo = "todos";
      else if (pareceChassi(termo)) efetivo = "vin";
      else {
        const porTexto = baseFiltrada.filter((c) =>
          combinaTexto(textoDoCatalogo(c), termo)
        );
        if (porTexto.length === 0 && pareceCodigo(termo)) efetivo = "codigo";
        else return { efetivo: "descricao", lista: porTexto, auto: true };
      }
    }

    switch (efetivo) {
      case "todos":
        return { efetivo, lista: baseFiltrada, auto: modo === "auto" };
      case "vin":
        // SOMENTE catálogos com consulta por chassi/VIN validada
        return {
          efetivo,
          lista: baseFiltrada.filter((c) => aceita(c, ["vin"]) && c.vin),
          auto: modo === "auto",
        };
      case "codigo":
        return {
          efetivo,
          lista: baseFiltrada.filter((c) => aceita(c, ["codigo", "equivalencia"])),
          auto: modo === "auto",
        };
      case "veiculo": {
        const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
        const marcasDigitadas = [
          ...new Set(palavras.map((p) => MARCAS_VEICULO[p]).filter(Boolean)),
        ];
        const lista = baseFiltrada.filter((c) => {
          if (!aceita(c, ["veiculo", "placa", "vin"])) return false;
          // montadoras: só as da marca digitada (se o usuário digitou uma marca)
          if (c.grupo === "montadora" && marcasDigitadas.length > 0) {
            return (c.marcas || []).some((m) => marcasDigitadas.includes(m));
          }
          return true;
        });
        return { efetivo, lista, auto: false, marcasDigitadas };
      }
      case "descricao":
      default: {
        const lista = termo
          ? baseFiltrada.filter((c) => combinaTexto(textoDoCatalogo(c), termo))
          : baseFiltrada;
        return { efetivo: "descricao", lista, auto: false };
      }
    }
  }, [baseFiltrada, busca, modo]);

  const { efetivo, lista: filtrados } = resultado;
  const chassi = efetivo === "vin" ? limparChassi(busca) : "";
  const chassiValido = chassi && pareceChassi(chassi);
  const ordemVin = (c) => ORDEM_VIN.indexOf(c.vin?.acesso);
  const vinDisponiveis =
    efetivo === "vin"
      ? filtrados
          .filter((c) => !VIN_INDISPONIVEL.includes(c.vin?.acesso))
          .sort((a, b) => ordemVin(a) - ordemVin(b))
      : [];
  const vinIndisponiveis =
    efetivo === "vin"
      ? filtrados.filter((c) => VIN_INDISPONIVEL.includes(c.vin?.acesso))
      : [];

  // Chassi válido: copia automaticamente para facilitar colar no site externo
  useEffect(() => {
    if (!chassiValido) return;
    let ativo = true;
    copiarTexto(chassi).then((ok) => {
      if (ok && ativo) setCopiado(chassi);
    });
    return () => {
      ativo = false;
    };
  }, [chassi, chassiValido]);

  const filtrosAtivos =
    busca ||
    modo !== "auto" ||
    filtroGrupo !== "todos" ||
    filtroMarca !== "todas" ||
    filtroAcesso !== "Todos";

  function limparFiltros() {
    setBusca("");
    setModo("auto");
    setFiltroGrupo("todos");
    setFiltroMarca("todas");
    setFiltroAcesso("Todos");
  }

  function escolherGrupo(id) {
    setFiltroGrupo(id);
    if (
      id !== "todos" &&
      filtroMarca !== "todas" &&
      !(marcasPorGrupo[id] || []).includes(filtroMarca)
    ) {
      setFiltroMarca("todas");
    }
  }

  async function copiarAtual(texto) {
    const t = String(texto || "").trim();
    if (!t) return;
    if (await copiarTexto(t)) setCopiado(t);
  }

  // Abrir catálogo: no modo chassi/código, copia o valor antes de abrir
  async function abrirCatalogo(c) {
    const valor =
      efetivo === "vin" && chassi
        ? chassi
        : efetivo === "codigo" && busca.trim()
        ? busca.trim()
        : "";
    if (valor && (await copiarTexto(valor))) setCopiado(valor);
    const destino = efetivo === "vin" && c?.vin?.url ? c.vin.url : c?.url;
    if (destino) window.open(destino, "_blank", "noopener,noreferrer");
  }

  const modoAtual = MODOS.find((m) => m.id === modo) || MODOS[0];
  const gruposVisiveis =
    filtroGrupo === "todos"
      ? GRUPOS_CATALOGOS_ONLINE
      : GRUPOS_CATALOGOS_ONLINE.filter((g) => g.id === filtroGrupo);

  return (
    <div data-testid="catalogos-online" style={{ textAlign: "left" }}>
      {/* CABEÇALHO DA ÁREA */}
      <div style={estilos.cabecalho}>
        <div style={{ flex: "1 1 420px" }}>
          <h3 style={estilos.tituloArea}>🌐 Catálogos Online — sites externos</h3>
          <p style={estilos.intro}>
            Atalhos para os catálogos oficiais das montadoras e dos fabricantes.
            Clique em <strong>Abrir catálogo</strong> e faça a pesquisa no site
            do fabricante. Cadastro, login ou assinatura são feitos por você no
            próprio site — o PAIIA não guarda senhas nem dados de pagamento.
          </p>
        </div>
        {onVoltarCentral && (
          <button
            type="button"
            onClick={onVoltarCentral}
            style={estilos.botaoVoltarCentral}
          >
            ← Voltar à Central de Catálogos
          </button>
        )}
      </div>

      <div style={estilos.avisoSeparacao}>
        <strong>Estes catálogos não fazem parte da base interna do PAIIA.</strong>{" "}
        Nada é importado nem consultado automaticamente. Para pesquisar nos
        catálogos já importados (Bosch, Magneti Marelli…), use a aba{" "}
        <em>📘 Catálogos já existentes</em>.
      </div>

      {/* TIPO DE PESQUISA */}
      <span style={estilos.rotulo}>Pesquisar por</span>
      <div style={estilos.linhaModos} role="radiogroup" aria-label="Tipo de pesquisa">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={modo === m.id}
            data-modo={m.id}
            onClick={() => setModo(m.id)}
            style={botaoModo(modo === m.id)}
          >
            {m.icone} {m.titulo}
          </button>
        ))}
      </div>

      <input
        id="busca-catalogos-online"
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={modoAtual.placeholder}
        aria-label={`Pesquisar — ${modoAtual.titulo}`}
        style={estilos.inputBusca}
        autoComplete="off"
        spellCheck={false}
      />

      {/* GRUPO */}
      <div style={{ ...estilos.linhaChips, marginTop: "12px" }}>
        {[{ id: "todos", titulo: "Todos", icone: "" }, ...GRUPOS_CATALOGOS_ONLINE].map(
          (g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => escolherGrupo(g.id)}
              style={chip(filtroGrupo === g.id)}
              aria-pressed={filtroGrupo === g.id}
            >
              {g.icone ? `${g.icone} ` : ""}
              {g.titulo}
            </button>
          )
        )}
      </div>

      {/* FILTROS */}
      <div style={estilos.gradeFiltros}>
        <label style={estilos.campoFiltro}>
          <span style={estilos.rotulo}>Fabricante / marca</span>
          <select
            value={filtroMarca}
            onChange={(e) => setFiltroMarca(e.target.value)}
            style={estilos.select}
            aria-label="Filtrar por fabricante ou marca"
          >
            <option value="todas">Todas as marcas</option>
            {GRUPOS_CATALOGOS_ONLINE.filter(
              (g) => filtroGrupo === "todos" || g.id === filtroGrupo
            ).map((g) => (
              <optgroup key={g.id} label={g.titulo}>
                {(marcasPorGrupo[g.id] || []).map((m) => (
                  <option key={`${g.id}-${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={estilos.campoFiltro}>
          <span style={estilos.rotulo}>Acesso</span>
          <select
            value={filtroAcesso}
            onChange={(e) => setFiltroAcesso(e.target.value)}
            style={estilos.select}
            aria-label="Filtrar pelo tipo de acesso"
          >
            <option value="Todos">Qualquer acesso</option>
            {TIPOS_ACESSO.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={estilos.linhaResumo}>
        <span data-testid="resumo-catalogos">
          {efetivo === "vin"
            ? `${vinDisponiveis.length} catálogos com chassi/VIN disponíveis no Brasil`
            : `${filtrados.length} de ${catalogos.length} catálogos`}
        </span>
        {filtrosAtivos && (
          <button type="button" onClick={limparFiltros} style={estilos.botaoLimpar}>
            ✕ Limpar filtros
          </button>
        )}
      </div>

      {/* PAINEL — CHASSI / VIN */}
      {efetivo === "vin" && (
        <div style={estilos.painelVin} data-testid="painel-vin">
          <div style={{ flex: "1 1 340px" }}>
            <strong>
              🔎 Pesquisa por Chassi / VIN
              {resultado.auto ? " (identificada automaticamente)" : ""}
            </strong>
            {chassi ? (
              <div style={{ marginTop: "6px" }}>
                Chassi: <code style={estilos.codigoChassi}>{chassi}</code>{" "}
                {chassiValido ? (
                  <span style={{ color: "#86efac" }}>✓ 17 caracteres</span>
                ) : (
                  <span style={{ color: "#fca5a5" }} data-testid="aviso-chassi">
                    ⚠️ O chassi tem 17 caracteres (sem I, O e Q) — você digitou{" "}
                    {chassi.length}.
                  </span>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "6px", color: "#cbd5e1" }}>
                Digite o chassi (17 caracteres) no campo acima.
              </div>
            )}
            <div style={{ marginTop: "6px", color: "#cbd5e1" }}>
              Mostrando <strong>somente</strong> os catálogos com consulta por
              chassi/VIN confirmada e testada a partir do Brasil
              {vinIndisponiveis.length > 0
                ? ` (${vinDisponiveis.length} disponíveis; ${vinIndisponiveis.length} bloqueados ou indisponíveis no Brasil, listados no fim)`
                : ""}
              . Ao clicar em <em>Abrir catálogo</em>, o chassi é copiado e o
              site abre direto na consulta por VIN, quando existe — é só colar.
              O PAIIA não consulta nem importa nada.
            </div>
            {copiado && copiado === chassi && (
              <div style={estilos.copiadoOk} data-testid="chassi-copiado">
                📋 Chassi copiado para a área de transferência
              </div>
            )}
          </div>
          {chassi && (
            <button
              type="button"
              onClick={() => copiarAtual(chassi)}
              style={estilos.botaoCopiar}
            >
              {copiado === chassi ? "✓ Chassi copiado" : "📋 Copiar chassi"}
            </button>
          )}
        </div>
      )}

      {/* PAINEL — CÓDIGO / OEM */}
      {efetivo === "codigo" && (
        <div style={estilos.painelCodigo} data-testid="painel-codigo">
          <div style={{ flex: "1 1 320px" }}>
            <strong>
              #️⃣ Pesquisa por Código / OEM
              {busca.trim() ? ` — “${busca.trim()}”` : ""}
            </strong>
            <div style={{ marginTop: "4px", color: "#cbd5e1" }}>
              Catálogos que aceitam pesquisa por código, OEM ou equivalência.
              Ao abrir um catálogo, o código é copiado para você colar no site.
            </div>
          </div>
          {busca.trim() && (
            <button
              type="button"
              onClick={() => copiarAtual(busca)}
              style={estilos.botaoCopiar}
            >
              {copiado === busca.trim() ? "✓ Código copiado" : "📋 Copiar código"}
            </button>
          )}
        </div>
      )}

      {/* PAINEL — VEÍCULO */}
      {efetivo === "veiculo" && (
        <div style={estilos.painelCodigo} data-testid="painel-veiculo">
          <div>
            <strong>🚗 Pesquisa por Veículo</strong>
            <div style={{ marginTop: "4px", color: "#cbd5e1" }}>
              Catálogos que permitem escolher marca, modelo e ano (ou placa).
              {resultado.marcasDigitadas?.length
                ? ` Montadoras filtradas para: ${resultado.marcasDigitadas.join(", ")}.`
                : " Digite a marca (ex.: Renault) para ver só o catálogo dessa montadora."}
            </div>
          </div>
        </div>
      )}

      {filtrados.length === 0 && (
        <div style={estilos.vazio}>
          Nenhum catálogo encontrado com esses filtros.{" "}
          <button type="button" onClick={limparFiltros} style={estilos.linkLimpar}>
            Limpar filtros
          </button>
        </div>
      )}

      {/* LISTA */}
      {gruposVisiveis.map((grupo) => {
        const base = efetivo === "vin" ? vinDisponiveis : filtrados;
        const itens = base.filter((c) => c.grupo === grupo.id);
        if (itens.length === 0) return null;
        return (
          <section key={grupo.id} style={{ marginBottom: "26px" }}>
            <h3 style={estilos.tituloGrupo}>
              {grupo.icone} {grupo.titulo}{" "}
              <span style={estilos.contagemGrupo}>({itens.length})</span>
            </h3>
            <div style={estilos.grade}>
              {itens.map((c) => (
                <CartaoCatalogo
                  key={c.id}
                  catalogo={c}
                  destacarVin={efetivo === "vin"}
                  onAbrir={() => abrirCatalogo(c)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* MODO VIN: catálogos que aceitam chassi mas não funcionam no Brasil */}
      {efetivo === "vin" && vinIndisponiveis.length > 0 && (
        <section style={{ marginBottom: "26px" }} data-testid="vin-indisponiveis">
          <h3 style={{ ...estilos.tituloGrupo, color: "#fca5a5" }}>
            ⛔ Aceitam chassi, mas estão bloqueados ou indisponíveis no Brasil{" "}
            <span style={estilos.contagemGrupo}>({vinIndisponiveis.length})</span>
          </h3>
          <div style={estilos.grade}>
            {vinIndisponiveis.map((c) => (
              <CartaoCatalogo
                key={c.id}
                catalogo={c}
                destacarVin
                indisponivel
                onAbrir={() => abrirCatalogo(c)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TEXTO_ACESSO_VIN = {
  Livre: { icone: "🔓", texto: "Livre — consulta por chassi sem login", cor: "#16a34a" },
  Cadastro: { icone: "🔐", texto: "Cadastro — exige criar conta para consultar o chassi", cor: "#6366f1" },
  Login: { icone: "🔑", texto: "Login — exige conta profissional existente", cor: "#6366f1" },
  Assinatura: { icone: "💳", texto: "Assinatura — exige plano pago para consultar o chassi", cor: "#c026d3" },
  "Indisponível": { icone: "⛔", texto: "Indisponível para o Brasil", cor: "#dc2626" },
  Bloqueado: { icone: "🚫", texto: "Bloqueado — acesso negado a partir do Brasil", cor: "#dc2626" },
};

// Acessos em que o usuário brasileiro NÃO consegue usar a consulta por chassi
const VIN_INDISPONIVEL = ["Indisponível", "Bloqueado"];
const ORDEM_VIN = ["Livre", "Cadastro", "Login", "Assinatura", "Indisponível", "Bloqueado"];

function CartaoCatalogo({ catalogo: c, destacarVin, indisponivel, onAbrir }) {
  const cor = CORES_ACESSO[c.acesso] || CORES_ACESSO.Livre;
  const infoVin = c.vin ? TEXTO_ACESSO_VIN[c.vin.acesso] : null;
  return (
    <div
      style={{
        ...estilos.cartao,
        ...(indisponivel ? { opacity: 0.75, borderColor: "#7f1d1d" } : {}),
      }}
      data-testid="cartao-catalogo-online"
      data-id={c.id}
    >
      <div style={estilos.topoCartao}>
        <span
          style={{
            ...estilos.selo,
            background: cor.fundo,
            borderColor: cor.borda,
            color: cor.texto,
          }}
        >
          {ROTULO_SELO[c.acesso] || c.acesso}
        </span>
        {!c.oficial && <span style={estilos.seloNaoOficial}>Não oficial</span>}
        {c.restricaoBrasil && !ROTULO_SELO[c.acesso] && (
          <span style={estilos.seloBloqueado} data-testid="selo-bloqueado">
            🚫 Bloqueado no Brasil
          </span>
        )}
      </div>

      <strong style={estilos.nome}>{c.nome}</strong>
      <span style={estilos.fabricante}>{c.fabricante}</span>
      {c.categoria && <span style={estilos.categoria}>{c.categoria}</span>}

      <p style={estilos.descricao}>{c.descricao}</p>

      {Array.isArray(c.busca) && c.busca.length > 0 && (
        <div style={estilos.linhaBusca}>
          <span style={estilos.rotuloBusca}>Pesquisa por:</span>
          {c.busca.map((b) => (
            <span
              key={b}
              style={b === "vin" ? estilos.tagVin : estilos.tagBusca}
            >
              {ROTULOS_BUSCA[b] || b}
            </span>
          ))}
        </div>
      )}

      {destacarVin && infoVin && (
        <div
          style={{
            ...estilos.caixaVin,
            borderColor: infoVin.cor,
          }}
          data-testid="info-vin"
        >
          <strong>
            {infoVin.icone} {infoVin.texto}
          </strong>
          {c.vin.observacao && (
            <div style={{ marginTop: "3px", color: "#cbd5e1" }}>
              {c.vin.observacao}
            </div>
          )}
          {c.vin.teste && (
            <div style={{ marginTop: "3px", color: "#94a3b8", fontSize: "11px" }}>
              Teste no Brasil: {c.vin.teste}.
            </div>
          )}
        </div>
      )}

      {c.restricaoBrasil && !destacarVin && (
        <p style={estilos.avisoBloqueio}>🚫 {c.restricaoBrasil}</p>
      )}

      {!destacarVin && c.observacao && (
        <p style={estilos.observacao}>⚠️ {c.observacao}</p>
      )}

      {!destacarVin && c.testeBrasil && (
        <p style={estilos.testeBrasil} data-testid="teste-brasil">
          Teste no Brasil (23/09/2026): {c.testeBrasil}
        </p>
      )}

      <button
        type="button"
        onClick={onAbrir}
        title={`Abrir ${destacarVin && c.vin?.url ? c.vin.url : c.url} em nova aba`}
        style={
          indisponivel
            ? { ...estilos.botaoAbrir, background: "#1f2937", borderColor: "#475569" }
            : estilos.botaoAbrir
        }
      >
        {indisponivel
          ? "Abrir mesmo assim ↗"
          : destacarVin && c.vin?.url && c.vin.url !== c.url
          ? "Abrir consulta por VIN ↗"
          : "Abrir catálogo ↗"}
      </button>
    </div>
  );
}

function chip(ativo) {
  return {
    padding: "8px 14px",
    borderRadius: "999px",
    border: `1px solid ${ativo ? "#22d3ee" : "#334155"}`,
    background: ativo ? "#083344" : "#0f172a",
    color: ativo ? "#a5f3fc" : "#cbd5e1",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function botaoModo(ativo) {
  return {
    padding: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${ativo ? "#22d3ee" : "#334155"}`,
    background: ativo ? "linear-gradient(135deg,#0e7490,#1e40af)" : "#0f172a",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
  };
}

const estilos = {
  cabecalho: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "12px",
  },
  tituloArea: { color: "#67e8f9", margin: "0 0 6px", fontSize: "18px" },
  intro: { color: "#cbd5e1", margin: 0, lineHeight: 1.6, fontSize: "14px" },
  botaoVoltarCentral: {
    padding: "10px 16px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  avisoSeparacao: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #b45309",
    background: "rgba(69,26,3,.55)",
    color: "#fde68a",
    fontSize: "13px",
    lineHeight: 1.5,
    marginBottom: "18px",
  },
  rotulo: {
    display: "block",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "6px",
  },
  linhaModos: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "10px",
  },
  inputBusca: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 14px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#ffffff",
    fontSize: "15px",
    outline: "none",
  },
  linhaChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
  },
  gradeFiltros: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
    gap: "12px",
    marginTop: "14px",
  },
  campoFiltro: { display: "flex", flexDirection: "column" },
  select: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "10px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#ffffff",
    fontSize: "14px",
    cursor: "pointer",
  },
  linhaResumo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: "13px",
    margin: "14px 0 16px",
  },
  botaoLimpar: {
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid #475569",
    background: "transparent",
    color: "#e2e8f0",
    fontSize: "12px",
    cursor: "pointer",
  },
  painelCodigo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #0e7490",
    background: "#083344",
    color: "#ecfeff",
    fontSize: "13px",
    marginBottom: "18px",
  },
  painelVin: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid #7c3aed",
    background: "rgba(46,16,101,.6)",
    color: "#f5f3ff",
    fontSize: "13px",
    lineHeight: 1.5,
    marginBottom: "18px",
  },
  codigoChassi: {
    padding: "2px 8px",
    borderRadius: "6px",
    background: "#020617",
    border: "1px solid #6d28d9",
    fontSize: "14px",
    letterSpacing: "1px",
  },
  copiadoOk: {
    marginTop: "6px",
    color: "#86efac",
    fontWeight: 700,
  },
  botaoCopiar: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #22d3ee",
    background: "#0e7490",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  vazio: {
    padding: "22px",
    borderRadius: "14px",
    border: "1px dashed #334155",
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: "18px",
  },
  linkLimpar: {
    background: "none",
    border: "none",
    color: "#67e8f9",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "inherit",
  },
  tituloGrupo: {
    color: "#67e8f9",
    margin: "0 0 12px",
    fontSize: "17px",
    paddingBottom: "8px",
    borderBottom: "1px solid #1e293b",
  },
  contagemGrupo: { color: "#94a3b8", fontWeight: 400, fontSize: "14px" },
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
    gap: "14px",
  },
  cartao: {
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    borderRadius: "14px",
    border: "1px solid #1e40af",
    background: "linear-gradient(180deg,#0f172a,#020617)",
    color: "#ffffff",
    boxShadow: "0 8px 20px rgba(2,6,23,.25)",
    minHeight: "220px",
    textAlign: "left",
  },
  topoCartao: {
    display: "flex",
    gap: "6px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  selo: {
    padding: "3px 9px",
    borderRadius: "999px",
    border: "1px solid",
    fontSize: "11px",
    fontWeight: 800,
  },
  seloBloqueado: {
    padding: "3px 9px",
    borderRadius: "999px",
    border: "1px solid #dc2626",
    background: "#450a0a",
    color: "#fecaca",
    fontSize: "11px",
    fontWeight: 800,
  },
  testeBrasil: {
    color: "#94a3b8",
    fontSize: "10.5px",
    lineHeight: 1.35,
    margin: "0 0 10px",
  },
  avisoBloqueio: {
    color: "#fecaca",
    fontSize: "11px",
    lineHeight: 1.4,
    margin: "0 0 8px",
    fontWeight: 700,
  },
  seloNaoOficial: {
    padding: "3px 9px",
    borderRadius: "999px",
    border: "1px solid #b45309",
    background: "#451a03",
    color: "#fcd34d",
    fontSize: "11px",
    fontWeight: 800,
  },
  nome: { fontSize: "15px", lineHeight: 1.3 },
  fabricante: { color: "#67e8f9", fontSize: "12px", marginTop: "4px" },
  categoria: { color: "#94a3b8", fontSize: "11px", marginTop: "2px" },
  descricao: {
    color: "#cbd5e1",
    fontSize: "13px",
    lineHeight: 1.5,
    margin: "10px 0 8px",
    flexGrow: 1,
  },
  linhaBusca: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "5px",
    marginBottom: "8px",
  },
  rotuloBusca: { color: "#94a3b8", fontSize: "11px", marginRight: "2px" },
  tagBusca: {
    padding: "2px 7px",
    borderRadius: "6px",
    background: "#1e293b",
    color: "#cbd5e1",
    fontSize: "11px",
  },
  tagVin: {
    padding: "2px 7px",
    borderRadius: "6px",
    background: "#4c1d95",
    color: "#ede9fe",
    fontSize: "11px",
    fontWeight: 700,
  },
  caixaVin: {
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid",
    background: "rgba(2,6,23,.6)",
    fontSize: "12px",
    lineHeight: 1.4,
    marginBottom: "10px",
  },
  observacao: {
    color: "#fcd34d",
    fontSize: "11px",
    lineHeight: 1.4,
    margin: "0 0 10px",
  },
  botaoAbrir: {
    marginTop: "auto",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #0e7490",
    background: "linear-gradient(135deg,#0f766e,#155e75)",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
};
