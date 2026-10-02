import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import PesoEmbalagemML from "./PesoEmbalagemML";
import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";
import { conferirLogistica } from "../services/logistica/logisticaMercadoLivre";

/*
 * Revisão e confirmação da publicação REAL no Mercado Livre.
 *
 * Nada é publicado automaticamente:
 * 1. confere a conexão (conta do usuário logado + token válido);
 * 2. monta o anúncio e mostra tudo para revisão;
 * 3. "Validar no Mercado Livre" só confere os dados (não cria anúncio);
 * 4. "Publicar" exige a caixa de autorização marcada e um segundo clique.
 *
 * Tokens e credenciais nunca passam por aqui: tudo roda na função
 * mercadolivre-publicacao, no servidor.
 */

function obterUrlFoto(foto) {
  if (typeof foto === "string") return foto;
  return foto?.imagem_processada || foto?.imagem_original || foto?.url || foto?.src || "";
}

function precoTexto(valor) {
  const t = String(valor ?? "").trim();
  if (!t) return "";
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : t;
}

const CHAVE_MARCA_PADRAO = "paiia_ml_marca_padrao";

function lerMarcaPadrao() {
  try {
    return localStorage.getItem(CHAVE_MARCA_PADRAO) || "";
  } catch {
    return "";
  }
}

function salvarMarcaPadrao(marca) {
  try {
    if (marca.trim()) localStorage.setItem(CHAVE_MARCA_PADRAO, marca.trim());
  } catch {
    /* sem armazenamento: segue sem lembrar */
  }
}

function normalizar(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/*
 * Conferência antes de publicar. "erro" bloqueia a publicação;
 * "aviso" precisa ser revisado mas não bloqueia.
 */
function conferir({ campos, anuncio, preparo, estoque, fotosUrls, logistica }) {
  const itens = [];
  const descricao = String(anuncio?.descricao || "");
  const marca = campos.marca.trim();
  const fabricante = String(anuncio?.pecaEncontrada?.fabricante || anuncio?.pecaEncontrada?.fabricante_catalogo || "").trim();

  // Marca
  if (!marca) itens.push({ item: "Marca", nivel: "erro", texto: "Marca vazia. Preencha o campo Marca." });
  else {
    const outras = fabricante && normalizar(fabricante) !== normalizar(marca) && normalizar(campos.titulo).includes(normalizar(fabricante));
    itens.push({
      item: "Marca",
      nivel: outras ? "aviso" : "ok",
      texto: outras
        ? `Marca "${marca}", mas o título cita "${fabricante}". Confira se o título está de acordo com a marca anunciada.`
        : `Marca "${marca}".`,
    });
  }

  // Fotos
  const checks = preparo?.fotos_check || [];
  const boas = checks.filter((c) => c.ok).length;
  if (!fotosUrls.length) itens.push({ item: "Fotos", nivel: "erro", texto: "Nenhuma foto." });
  else if (!preparo) itens.push({ item: "Fotos", nivel: "aviso", texto: "Conferindo fotos..." });
  else if (boas === 0) itens.push({ item: "Fotos", nivel: "erro", texto: "Nenhuma foto abre por endereço público https." });
  else
    itens.push({
      item: "Fotos",
      nivel: boas < fotosUrls.length ? "aviso" : "ok",
      texto: `${boas} de ${fotosUrls.length} foto(s) abrem por https e são imagens.${boas < fotosUrls.length ? " As outras ficam de fora." : ""}`,
    });

  // Preço
  const t = String(campos.preco).trim();
  const preco = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  itens.push(
    Number.isFinite(preco) && preco > 0
      ? { item: "Preço", nivel: "ok", texto: preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }
      : { item: "Preço", nivel: "erro", texto: "Preço inválido." }
  );

  // Estoque
  const qtd = Math.floor(Number(campos.quantidade));
  if (!(qtd >= 1)) itens.push({ item: "Estoque", nivel: "erro", texto: "Quantidade precisa ser 1 ou mais." });
  else if (estoque?.ok && estoque.encontrado && estoque.saldoVirtualTotal != null)
    itens.push({
      item: "Estoque",
      nivel: qtd > Number(estoque.saldoVirtualTotal) ? "erro" : "ok",
      texto: `Bling: ${estoque.saldoVirtualTotal} disponível (SKU ${estoque.produto?.codigo}). Anúncio: ${qtd}.`,
    });
  else
    itens.push({
      item: "Estoque",
      nivel: "aviso",
      texto: `Quantidade informada à mão: ${qtd}. ${
        estoque === null
          ? "Consultando o Bling..."
          : estoque?.encontrado === false
            ? "SKU não encontrado no Bling."
            : "O Bling ainda não libera a leitura de estoque para o PAIIA (falta o escopo de Estoques)."
      }`,
    });

  // Descrição
  const problemas = [];
  if (!descricao.trim()) problemas.push("descrição vazia");
  if (/\boriginal\b/i.test(descricao)) problemas.push('contém a palavra "original"');
  if (marca && normalizar(descricao).includes(normalizar(marca))) problemas.push(`cita a marca "${marca}" no texto`);
  if (fabricante && normalizar(descricao).includes(normalizar(fabricante))) problemas.push(`cita "${fabricante}" no texto`);
  if (/\d+[.,]?\d*\s?(mm|cm|kg|gramas)\b/i.test(descricao)) problemas.push("contém medidas ou peso");
  if (/https?:|www\.|@|whats\s?app|\(\d{2}\)\s?\d{4,5}/i.test(descricao)) problemas.push("contém link ou contato (proibido no ML)");
  if (/não informado/i.test(descricao)) problemas.push('tem campo "Não informado"');
  itens.push({
    item: "Descrição",
    nivel: !descricao.trim() || /contato/.test(problemas.join()) ? "erro" : problemas.length ? "aviso" : "ok",
    texto: problemas.length ? `${descricao.length} caracteres; ${problemas.join("; ")}.` : `${descricao.length} caracteres, sem problemas encontrados.`,
  });

  // Compatibilidade
  const aplic = Array.isArray(anuncio?.pecaEncontrada?.aplicacoes) ? anuncio.pecaEncontrada.aplicacoes.length : 0;
  itens.push({
    item: "Compatibilidade",
    nivel: "aviso",
    texto: `O PAIIA tem ${aplic} aplicação(ões) desta peça, mas a tabela de compatibilidade do Mercado Livre ainda NÃO é enviada. Depois de publicar, será preciso preencher a compatibilidade no Mercado Livre.`,
  });

  // Peso e embalagem (bloqueia sem medida validada/informada, fora do
  // limite, sem simulação com os valores atuais ou sem confirmação).
  const log = conferirLogistica({
    medidaEnvio: logistica?.medida,
    origem: logistica?.origem,
    nivel: logistica?.nivel,
    validacao: logistica?.validacao,
    simulacao: logistica?.simulacao,
    confirmado: logistica?.confirmado,
  });
  itens.push({ item: "Peso e embalagem", nivel: log.nivel, texto: log.texto });

  // Frete
  const frete = preparo?.frete;
  if (!preparo) itens.push({ item: "Frete", nivel: "aviso", texto: "Conferindo..." });
  else if (frete?.erro) itens.push({ item: "Frete", nivel: "aviso", texto: `Não foi possível ler as preferências de envio: ${frete.erro}` });
  else {
    const modos = (frete?.modos || []).join(", ") || "nenhum";
    const gratis = Number.isFinite(preco) && preco >= 79;
    itens.push({
      item: "Frete",
      nivel: "aviso",
      texto: `Modos de envio da conta: ${modos}. Peso e medidas enviados: os do bloco PESO E EMBALAGEM.${gratis ? " Com preço a partir de R$ 79 o frete grátis é obrigatório e o custo fica com o vendedor." : ""}`,
    });
  }
  return itens;
}

// Toda chamada leva a conta ML escolhida (conta_ml). Sem conta: não chama.
async function chamar(acao, extra = {}, contaML = "") {
  if (!contaML) return { ok: false, codigo: "conta_nao_selecionada", erro: "Selecione a conta Mercado Livre desta publicação." };
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", {
    body: { acao, conta_ml: String(contaML), ...extra },
  });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}

export default function RevisaoPublicacaoML({ anuncio, titulo, onFechar }) {
  const [conexao, setConexao] = useState(null);
  const [preparo, setPreparo] = useState(null);
  const [validacao, setValidacao] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState("conexao");
  const [autorizado, setAutorizado] = useState(false);
  const [armado, setArmado] = useState(false);
  const [estoque, setEstoque] = useState(null);
  const [logistica, setLogistica] = useState(null);
  // Conta Mercado Livre desta publicação: escolha EXPLÍCITA do usuário.
  // Só vem pré-selecionada quando existe exatamente 1 conta conectada.
  const estadoContas = useContasML();
  const contasConectadas = contasMLConectadas(estadoContas);
  const [contaEscolhida, setContaEscolhida] = useState("");
  useEffect(() => {
    if (!contaEscolhida && contasConectadas.length === 1) setContaEscolhida(contasConectadas[0].ml_user_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoContas]);
  const contaInfo = contasConectadas.find((c) => c.ml_user_id === contaEscolhida) || null;

  const fotosUrls = useMemo(
    () =>
      // Só as fotos do produto: banners com texto/arte não seguem a
      // política de imagens do Mercado Livre.
      (Array.isArray(anuncio?.fotos) ? anuncio.fotos : [])
        .map(obterUrlFoto)
        .filter(Boolean),
    [anuncio]
  );

  const [campos, setCampos] = useState(() => ({
    titulo: String(titulo || anuncio?.titulo || "").slice(0, 60),
    preco: String(anuncio?.preco ?? ""),
    quantidade: 1,
    tipoAnuncio: anuncio?.tipoAnuncio === "premium" ? "premium" : "classico",
    // Marca do anúncio: a que o usuário usa nos canais (lembrada neste
    // navegador). O "fabricante" do catálogo é a referência técnica da peça,
    // não a marca anunciada, por isso não é usado aqui.
    marca: String(lerMarcaPadrao() || anuncio?.marca || ""),
    codigo: String(anuncio?.codigo || anuncio?.oem || ""),
    gtin: String(anuncio?.gtin || ""),
    categoria_id: "",
  }));
  // Atributos obrigatórios da categoria que o usuário escolhe aqui.
  const [extras, setExtras] = useState({});

  const dadosAnuncio = useMemo(
    () => ({
      ...campos,
      oem: anuncio?.oem || "",
      descricao: anuncio?.descricao || "",
      fotos: fotosUrls,
      // Só a medida validada/informada e confirmada vai ao ML.
      embalagem:
        logistica?.medida && logistica.confirmado
          ? { ...logistica.medida, nivel: logistica.nivel, origem: logistica.nivel, config_embalagem: logistica.config_embalagem, modalidade: logistica.modalidade }
          : null,
      atributos_extras: Object.entries(extras)
        .filter(([, v]) => v && (v.value_id || v.value_name))
        .map(([id, v]) => ({ id, ...v })),
    }),
    [campos, anuncio, fotosUrls, extras, logistica]
  );

  function alterarExtra(id, valor) {
    setExtras((e) => ({ ...e, [id]: valor }));
    setValidacao(null);
    setArmado(false);
  }

  function alterar(campo, valor) {
    setCampos((c) => ({ ...c, [campo]: valor }));
    setValidacao(null);
    setArmado(false);
  }

  async function preparar(categoriaId) {
    setOcupado("preparar");
    const r = await chamar("preparar", {
      anuncio: { ...dadosAnuncio, categoria_id: categoriaId ?? dadosAnuncio.categoria_id },
    }, contaEscolhida);
    setPreparo(r);
    if (r?.ok && r.categoria_id && !categoriaId) {
      setCampos((c) => ({ ...c, categoria_id: r.categoria_id }));
    }
    setOcupado("");
  }

  // Conexão da conta escolhida (roda de novo se o usuário trocar a conta).
  useEffect(() => {
    let ativo = true;
    setConexao(null);
    setPreparo(null);
    setValidacao(null);
    setResultado(null);
    setAutorizado(false);
    setArmado(false);
    if (!contaEscolhida) {
      setOcupado("");
      return () => { ativo = false; };
    }
    setOcupado("conexao");
    (async () => {
      const c = await chamar("validar_conexao", {}, contaEscolhida);
      if (!ativo) return;
      setConexao(c);
      setOcupado("");
      if (c?.ok && c.conectado && c.pertence_ao_usuario && String(c.ml_user_id) === String(contaEscolhida)) preparar();
    })();
    return () => { ativo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaEscolhida]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      // Estoque: somente leitura no Bling, pelo SKU.
      const sku = String(anuncio?.codigo || "").trim();
      if (sku) {
        try {
          const { data } = await supabase.functions.invoke("bling-integracao", {
            body: { acao: "saldo_por_sku", sku },
          });
          if (ativo) setEstoque(data || { ok: false });
        } catch {
          if (ativo) setEstoque({ ok: false });
        }
      } else if (ativo) setEstoque({ ok: false, encontrado: false });
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validarNoML() {
    setOcupado("validar");
    setValidacao(null);
    setArmado(false);
    const r = await chamar("validar_item", { anuncio: dadosAnuncio }, contaEscolhida);
    setValidacao(r);
    setOcupado("");
  }

  async function publicar() {
    if (!autorizado || !validacao?.valido || bloqueios.length > 0) return;
    if (!armado) {
      setArmado(true);
      return;
    }
    setOcupado("publicar");
    const r = await chamar("publicar", {
      anuncio: dadosAnuncio,
      confirmado: true,
      confirmacao: "PUBLICAR",
    }, contaEscolhida);
    setResultado(r);
    setArmado(false);
    setOcupado("");
  }

  const contaOk = Boolean(contaEscolhida) && conexao?.ok && conexao.conectado && conexao.pertence_ao_usuario && String(conexao.ml_user_id) === String(contaEscolhida);
  const conferencia = conferir({ campos, anuncio, preparo, estoque, fotosUrls, logistica });
  const bloqueios = conferencia.filter((c) => c.nivel === "erro");
  // Marca, código e GTIN já têm campo próprio acima.
  const cobertosPelosCampos = {
    BRAND: campos.marca.trim(),
    PART_NUMBER: campos.codigo.trim(),
    GTIN: campos.gtin.trim(),
  };
  const faltando = (preparo?.obrigatorios || []).filter(
    (a) => !a.preenchido && !cobertosPelosCampos[a.id]
  );
  const faltandoSemValor = faltando.filter((a) => !(extras[a.id]?.value_id || extras[a.id]?.value_name));

  return (
    <section data-paiia-revisao-ml style={painel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ color: "#fde047", margin: 0 }}>🟡 Revisão da publicação no Mercado Livre</h3>
        <button type="button" onClick={onFechar} style={botaoCinza}>✖ Fechar revisão</button>
      </div>

      <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 16px" }}>
        Nada é publicado automaticamente. Revise, valide e só então confirme.
      </p>

      {/* 1. Conexão */}
      <div style={bloco}>
        <strong style={subtitulo}>1. Conta Mercado Livre</strong>
        <label style={{ display: "block", color: "#e2e8f0", fontSize: 14, margin: "8px 0" }}>
          Publicar na conta:{" "}
          <select
            data-paiia-conta-ml-publicacao
            value={contaEscolhida}
            onChange={(e) => setContaEscolhida(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: 8, background: "#020617", color: "#e2e8f0", border: "1px solid #334155" }}
          >
            <option value="">— selecione a conta Mercado Livre —</option>
            {contasConectadas.map((c) => (
              <option key={c.ml_user_id} value={c.ml_user_id}>
                {(c.nickname || "Conta") + " (ID " + c.ml_user_id + ")" + (c.ativa ? " · ATIVA" : "")}
              </option>
            ))}
          </select>
        </label>
        {!contaEscolhida && <p style={erro}>Selecione explicitamente a conta Mercado Livre. Nada é validado ou publicado sem conta escolhida.</p>}
        {ocupado === "conexao" && <p style={info}>⏳ Conferindo a conexão...</p>}
        {conexao && !conexao.ok && <p style={erro}>❌ {conexao.erro}</p>}
        {conexao?.ok && !conexao.conectado && <p style={erro}>❌ Nenhuma conta conectada. Use Contas Marketplace.</p>}
        {conexao?.ok && conexao.conectado && (
          <div data-paiia-ml-conexao style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.7 }}>
            <div>Conta: <b>{conexao.nickname || "—"}</b> (ID {conexao.ml_user_id})</div>
            <div>
              Token pertence ao seu usuário:{" "}
              {conexao.pertence_ao_usuario ? <b style={{ color: "#22c55e" }}>SIM</b> : <b style={{ color: "#f87171" }}>NÃO</b>}
            </div>
            <div>
              Válido até: {conexao.token_valido_ate ? new Date(conexao.token_valido_ate).toLocaleString("pt-BR") : "—"}
              {conexao.renovado ? " (renovado agora)" : ""}
            </div>
            {conexao.pode_vender === false && (
              <div style={erro}>
                ⚠ O Mercado Livre informa que esta conta ainda não pode vender
                {conexao.bloqueios_venda?.length ? ` (${conexao.bloqueios_venda.join(", ")})` : ""}.
              </div>
            )}
          </div>
        )}
      </div>

      {contaOk && (
        <>
          {/* 2. Dados */}
          <div style={bloco}>
            <strong style={subtitulo}>2. Dados que serão enviados</strong>
            <div style={grade}>
              <Campo rotulo={`Título (${campos.titulo.length}/60)`}>
                <input style={entrada} maxLength={60} value={campos.titulo} onChange={(e) => alterar("titulo", e.target.value)} />
              </Campo>
              <Campo rotulo={`Preço ${precoTexto(campos.preco) ? `(${precoTexto(campos.preco)})` : ""}`}>
                <input style={entrada} value={campos.preco} onChange={(e) => alterar("preco", e.target.value)} />
              </Campo>
              <Campo rotulo="Quantidade">
                <input style={entrada} type="number" min={1} value={campos.quantidade} onChange={(e) => alterar("quantidade", e.target.value)} />
              </Campo>
              <Campo rotulo="Tipo de anúncio">
                <select style={entrada} value={campos.tipoAnuncio} onChange={(e) => alterar("tipoAnuncio", e.target.value)}>
                  <option value="classico">Clássico</option>
                  <option value="premium">Premium</option>
                </select>
              </Campo>
              <Campo rotulo="Marca">
                <input style={entrada} value={campos.marca} onChange={(e) => alterar("marca", e.target.value)} onBlur={(e) => salvarMarcaPadrao(e.target.value)} />
              </Campo>
              <Campo rotulo="Código da peça (Part Number)">
                <input style={entrada} value={campos.codigo} onChange={(e) => alterar("codigo", e.target.value)} />
              </Campo>
              <Campo rotulo="GTIN/EAN (se houver)">
                <input style={entrada} value={campos.gtin} onChange={(e) => alterar("gtin", e.target.value)} />
              </Campo>
              <Campo rotulo="Categoria sugerida pelo Mercado Livre">
                <select
                  style={entrada}
                  value={campos.categoria_id}
                  onChange={(e) => {
                    alterar("categoria_id", e.target.value);
                    setExtras({});
                    preparar(e.target.value);
                  }}
                >
                  {!(preparo?.categorias || []).length && <option value="">{ocupado === "preparar" ? "Carregando..." : "Sem sugestão"}</option>}
                  {(preparo?.categorias || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.dominio} ({c.id})</option>
                  ))}
                </select>
              </Campo>
            </div>

            <p style={info}>
              Condição: Novo · Fotos com endereço público: {preparo?.item?.pictures?.length ?? "—"} de {fotosUrls.length} ·
              Descrição: {String(anuncio?.descricao || "").length} caracteres
            </p>

            {/* Fotos que serão enviadas, na ordem: a primeira é a capa. */}
            <div data-paiia-revisao-fotos style={{ marginTop: 10 }}>
              <strong style={{ color: "#e2e8f0", fontSize: 13 }}>
                Fotos do anúncio ({fotosUrls.length}) — a 1ª é a capa
              </strong>
              {fotosUrls.length === 0 ? (
                <p style={erro}>❌ Nenhuma foto.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginTop: 8 }}>
                  {fotosUrls.map((url, i) => (
                    <figure key={`${url}-${i}`} style={{ margin: 0, padding: 6, borderRadius: 8, border: i === 0 ? "2px solid #22c55e" : "1px solid #334155", background: "#020617" }}>
                      <div style={{ height: 96, borderRadius: 6, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        <img src={url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      </div>
                      <figcaption style={{ color: i === 0 ? "#86efac" : "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 4 }}>
                        {i === 0 ? "⭐ Capa · 1" : `Foto ${i + 1}`}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <p style={info}>Banner e vídeo não entram nas fotos do produto no Mercado Livre.</p>
            </div>
            {preparo && !preparo.ok && <p style={erro}>❌ {preparo.erro}</p>}
            {faltando.length > 0 && (
              <div data-paiia-ml-obrigatorios style={{ marginTop: 10 }}>
                <p style={aviso}>⚠ Atributos obrigatórios desta categoria: preencha antes de validar.</p>
                <div style={grade}>
                  {faltando.map((a) => (
                    <Campo key={a.id} rotulo={a.nome}>
                      {a.valores?.length ? (
                        <select
                          style={entrada}
                          value={extras[a.id]?.value_id || ""}
                          onChange={(e) => alterarExtra(a.id, e.target.value ? { value_id: e.target.value } : null)}
                        >
                          <option value="">Selecione...</option>
                          {a.valores.map((v) => (
                            <option key={v.id} value={v.id}>{v.nome}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          style={entrada}
                          value={extras[a.id]?.value_name || ""}
                          onChange={(e) => alterarExtra(a.id, e.target.value ? { value_name: e.target.value } : null)}
                        />
                      )}
                    </Campo>
                  ))}
                </div>
              </div>
            )}
            {(preparo?.avisos || []).map((a) => (
              <p key={a} style={aviso}>⚠ {a}</p>
            ))}
          </div>

          {/* Peso e embalagem */}
          <PesoEmbalagemML
            key={`${anuncio?.codigo || ""}-${campos.categoria_id}-${contaEscolhida}`}
            contaML={contaEscolhida}
            sku={String(anuncio?.codigo || campos.codigo || "").trim()}
            categoriaId={campos.categoria_id}
            preco={campos.preco}
            tipoAnuncio={campos.tipoAnuncio}
            onChange={(l) => {
              setLogistica(l);
              setValidacao(null);
              setArmado(false);
            }}
          />

          {/* Conferência */}
          <div data-paiia-ml-conferencia style={bloco}>
            <strong style={subtitulo}>Conferência antes de publicar</strong>
            <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {conferencia.map((c) => (
                  <tr key={c.item} data-item={c.item} data-nivel={c.nivel} style={{ borderTop: "1px solid #1f2937" }}>
                    <td style={{ padding: "6px 8px", width: 30 }}>{c.nivel === "ok" ? "✅" : c.nivel === "erro" ? "❌" : "⚠️"}</td>
                    <td style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: "bold", width: 130 }}>{c.item}</td>
                    <td style={{ padding: "6px 8px", color: c.nivel === "erro" ? "#fca5a5" : c.nivel === "aviso" ? "#fde68a" : "#bbf7d0" }}>{c.texto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Validação */}
          <div style={bloco}>
            <strong style={subtitulo}>3. Validar no Mercado Livre (não publica)</strong>
            <button
              type="button"
              data-paiia-validar-ml
              onClick={validarNoML}
              disabled={!!ocupado || !campos.categoria_id || faltandoSemValor.length > 0}
              style={botaoAzul}
            >
              {ocupado === "validar" ? "⏳ Validando..." : "🔎 Validar dados no Mercado Livre"}
            </button>
            {validacao && validacao.ok && validacao.valido && (
              <p style={{ ...info, color: "#86efac" }}>✅ O Mercado Livre aceitou os dados. Nenhum anúncio foi criado.</p>
            )}
            {validacao && (!validacao.ok || !validacao.valido) && (
              <div style={erro}>
                ❌ {validacao.erro || validacao.mensagem || "O Mercado Livre apontou problemas:"}
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {(validacao.causas || []).map((c, i) => (
                    <li key={i}>{c.mensagem || c.codigo}</li>
                  ))}
                </ul>
                {!(validacao.causas || []).length && validacao.detalhe && (
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, color: "#cbd5e1", margin: "6px 0 0" }}>{validacao.detalhe}</pre>
                )}
              </div>
            )}
          </div>

          {/* 4. Confirmação */}
          <div style={bloco}>
            <strong style={subtitulo}>4. Confirmar publicação real</strong>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#e2e8f0", fontSize: 14, margin: "8px 0" }}>
              <input
                type="checkbox"
                data-paiia-autorizo-ml
                checked={autorizado}
                onChange={(e) => {
                  setAutorizado(e.target.checked);
                  setArmado(false);
                }}
              />
              Revisei os dados e autorizo publicar este anúncio na conta <b>{conexao.nickname}</b> (ID {conexao.ml_user_id}) do Mercado Livre.
            </label>
            <button
              type="button"
              data-paiia-publicar-ml
              onClick={publicar}
              disabled={!autorizado || !validacao?.valido || !!ocupado || resultado?.publicado || bloqueios.length > 0}
              style={{ ...botaoVerde, opacity: !autorizado || !validacao?.valido ? 0.5 : 1 }}
            >
              {ocupado === "publicar"
                ? "⏳ Publicando..."
                : armado
                  ? "⚠ Clique de novo para CONFIRMAR a publicação"
                  : "🚀 Publicar no Mercado Livre"}
            </button>
            {bloqueios.length > 0 && <p style={erro}>Corrija antes de publicar: {bloqueios.map((b) => b.item).join(", ")}.</p>}
            {!validacao?.valido && <p style={info}>Valide os dados antes de publicar.</p>}
            {resultado?.ok && resultado.publicado && (
              <p style={{ ...info, color: "#86efac" }}>
                ✅ Publicado: {resultado.item_id}{" "}
                {resultado.link && <a href={resultado.link} target="_blank" rel="noreferrer" style={{ color: "#67e8f9" }}>abrir anúncio</a>}
                {resultado.descricao_enviada === false && " (a descrição não foi enviada; revise no Mercado Livre)"}
              </p>
            )}
            {resultado && !resultado.ok && <p style={erro}>❌ {resultado.erro}</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Campo({ rotulo, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#94a3b8", fontSize: 12 }}>
      {rotulo}
      {children}
    </label>
  );
}

const painel = { marginTop: 20, padding: 22, borderRadius: 18, border: "1px solid #facc15", background: "#0f172a" };
const bloco = { marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #334155", background: "#111827" };
const subtitulo = { color: "#e2e8f0", fontSize: 15 };
const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 10 };
const entrada = { padding: "9px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", fontSize: 14 };
const info = { color: "#94a3b8", fontSize: 13, margin: "8px 0 0" };
const aviso = { color: "#facc15", fontSize: 13, margin: "6px 0 0" };
const erro = { color: "#fca5a5", fontSize: 13, margin: "8px 0 0" };
const botaoBase = { marginTop: 8, padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer" };
const botaoAzul = { ...botaoBase, background: "#2563eb", color: "#fff" };
const botaoVerde = { ...botaoBase, background: "#16a34a", color: "#fff" };
const botaoCinza = { ...botaoBase, marginTop: 0, background: "#334155", color: "#e2e8f0" };
