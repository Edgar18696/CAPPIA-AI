import { useEffect, useState } from "react";
import {
  TIPOS_EMPRESA,
  SITUACOES,
  SEGMENTOS_AUTOMOTIVOS,
  NIVEIS_VALIDACAO,
  COTACAO_INTERNA_ATIVA,
  resumoValidacao,
  termoParaTexto,
  linkTelefone,
  linkEmail,
  linkSite,
  SITUACOES_TECNICAS,
  CRITERIOS_SELECAO,
  FUNCOES_CONTATO,
  formatarMensalidade,
  rotuloDe,
  pendenciasAprovacao,
  parceiroVisivel,
  perfilParaParceiro,
  rotuloPerfil,
  codigosParaParceiros,
  agruparItensPorParceiro,
  linkWhatsapp,
  parceiroEmBranco,
  contatoEmBranco,
  contratoEmBranco,
  situacaoContrato,
  fimDoPeriodo,
  dataCurta,
  reaisParaCentavos,
  LIMITE_CATALOGO_BYTES,
  modoTesteParceiros,
} from "../config/parceirosPiloto";
import {
  meuPapel,
  listarParceiros,
  salvarParceiro,
  verificarVencimentos,
  enviarLogotipo,
  enviarArquivoCatalogo,
  linkArquivoCatalogo,
  definirSituacaoCatalogo,
  listarItensDoParceiro,
  enviarItens,
  enviarListaColada,
  aprovarItensPendentes,
  analisarItem,
  removerItem,
  itensDeParceirosPorCodigos,
  itensDeParceirosPorTexto,
  validacaoDoCatalogo,
  contasDoParceiro,
  vincularConta,
  desvincularConta,
  registrarCotacaoSimulada,
  listarCotacoesSimuladas,
} from "../services/parceirosService";
import { resumoExtracao } from "../services/parceiros/extracaoCatalogo";
import { ambienteSupabase } from "../supabase";

// Na produção somem os selos e avisos de teste; no STAGING continuam.
const EM_TESTE = modoTesteParceiros(ambienteSupabase);

// (26-27/11/2026) PAIIA PARCEIROS — PILOTO (só STAGING, dados fictícios, sem cobrança).
// Pesquisa técnica + aproximação: o comprador fala DIRETO com o fornecedor; sem pedidos,
// pagamentos ou cotação interna (código guardado, desligado por COTACAO_INTERNA_ATIVA).
// Área COMERCIAL, separada dos resultados técnicos, sem prioridade comprada.
// Perfis: administrador · parceiro comercial · usuário comum (o banco também garante).
// O distribuidor preenche o cadastro, envia logotipo e catálogo; tudo fica sujeito
// à aprovação do administrador.

export default function ParceirosPiloto() {
  const [papel, setPapel] = useState({ admin: false, parceiros: [] });
  const [parceiros, setParceiros] = useState([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [abertoId, setAbertoId] = useState("");
  const [modo, setModo] = useState("ver"); // ver | editar
  const [rascunho, setRascunho] = useState(null);

  async function carregar() {
    const [p, lista] = await Promise.all([meuPapel(), listarParceiros()]);
    setPapel(p);
    setParceiros(lista);
    return { p, lista };
  }

  async function recarregar(manterId) {
    try {
      const { lista } = await carregar();
      setErro("");
      if (manterId) setAbertoId(manterId);
      return lista;
    } catch (e) {
      setErro(e.message);
      return [];
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const p = await meuPapel();
        // Administrador: a rotina de vencimentos roda sozinha ao abrir (renova ou suspende).
        if (p.admin) {
          const r = await verificarVencimentos();
          if (vivo && (r.renovados || r.suspensos)) {
            setAviso(`Vencimentos verificados: ${r.renovados} renovado(s), ${r.suspensos} suspenso(s).`);
          }
        }
        const lista = await listarParceiros();
        if (vivo) { setPapel(p); setParceiros(lista); }
      } catch (e) {
        if (vivo) setErro(e.message);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const aberto = parceiros.find((p) => p.id === abertoId) || null;

  function abrir(id) {
    setModo("ver");
    setAbertoId((atual) => (atual === id ? "" : id));
  }

  function editar(parceiro) {
    const base = structuredClone(parceiro || parceiroEmBranco());
    if (!base.contrato) base.contrato = contratoEmBranco();
    if (!base.controle) base.controle = { criterios: {}, observacoes_admin: "" };
    setRascunho(base);
    setAbertoId(parceiro?.id || "");
    setModo("editar");
  }

  return (
    <section className="pp-area" data-testid="area-parceiros">
      <EstilosParceiros />
      <div className="pp-topo">
        <div>
          <h3 className="pp-titulo">🤝 PAIIA Parceiros {EM_TESTE && <span className="pp-selo">PILOTO · TESTE · DADOS FICTÍCIOS</span>}</h3>
          <p className="pp-miudo">
            Área comercial, separada da informação técnica: parceiros nunca mudam a ordem nem o conteúdo
            dos resultados dos catálogos.{EM_TESTE && " Sem cobrança real."}
          </p>
          <p className="pp-miudo" data-testid="perfil-atual">Você está como: <b>{rotuloPerfil(papel)}</b></p>
        </div>
        {papel.admin && (
          <button type="button" className="pp-botao" onClick={() => editar(null)} data-testid="novo-parceiro">
            + Cadastrar parceiro
          </button>
        )}
      </div>

      {erro && <div className="pp-aviso pp-aviso-erro">{erro}</div>}
      {aviso && <div className="pp-aviso">{aviso}</div>}

      <div className="pp-grade-cartoes">
        {parceiros.map((p) => {
          const sit = SITUACOES.find((s) => s.id === p.situacao);
          const meu = papel.parceiros.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => abrir(p.id)} className={`pp-cartao${p.id === abertoId ? " pp-cartao-ativo" : ""}`} data-testid={`parceiro-${p.id}`}>
              <span className="pp-linha">
                <Logo parceiro={p} tamanho={30} />
                <strong>{p.nome_fantasia}</strong>
              </span>
              <span className="pp-miudo">{rotuloDe(TIPOS_EMPRESA, p.tipo_empresa)}{meu ? " · sua empresa" : ""}</span>
              {(papel.admin || meu) && <span className="pp-miudo" style={{ color: sit?.cor }}>● {sit?.rotulo}</span>}
            </button>
          );
        })}
        {!parceiros.length && !erro && <div className="pp-miudo">Nenhum parceiro disponível.</div>}
      </div>

      {modo === "ver" && aberto && (
        <PerfilParceiro parceiro={aberto} perfil={perfilParaParceiro(papel, aberto.id)} aoEditar={() => editar(aberto)} />
      )}
      {modo === "editar" && rascunho && (
        <FormularioParceiro
          key={rascunho.id || "novo"}
          inicial={rascunho}
          perfil={rascunho.id ? perfilParaParceiro(papel, rascunho.id) : "admin"}
          aoCancelar={() => { setModo("ver"); setRascunho(null); }}
          aoSalvar={async (salvo, continuar) => {
            const lista = await recarregar(salvo.id);
            if (continuar) {
              const novo = lista.find((x) => x.id === salvo.id);
              if (novo) editar(novo);
            } else {
              setModo("ver");
              setRascunho(null);
            }
          }}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Perfil comercial do parceiro                                         */
/* ------------------------------------------------------------------ */
function PerfilParceiro({ parceiro, perfil, aoEditar }) {
  const visivel = parceiroVisivel(parceiro);
  const gerencia = perfil === "admin" || perfil === "parceiro";
  const contrato = situacaoContrato(parceiro.contrato);
  return (
    <div className="pp-painel" data-testid="perfil-parceiro">
      <div className="pp-topo">
        <div className="pp-linha">
          <Logo parceiro={parceiro} tamanho={52} />
          <div>
            <strong className="pp-nome">{parceiro.nome_fantasia}</strong>
            <div className="pp-miudo">
              {rotuloDe(TIPOS_EMPRESA, parceiro.tipo_empresa)}
              {parceiro.segmentos?.length ? ` · ${parceiro.segmentos.join(", ")}` : ""}
            </div>
          </div>
        </div>
        {perfil === "admin" && <button type="button" className="pp-botao" onClick={aoEditar} data-testid="administrar-parceiro">⚙️ Administração</button>}
        {perfil === "parceiro" && <button type="button" className="pp-botao" onClick={aoEditar} data-testid="meus-dados">✏️ Meus dados e catálogo</button>}
      </div>

      {gerencia && !visivel && (
        <div className="pp-aviso">
          Este parceiro não aparece para os usuários: só aparece quando está <b>Ativo</b> e dentro da vigência.
        </div>
      )}

      {parceiro.apresentacao && <p className="pp-texto">{parceiro.apresentacao}</p>}
      {parceiro.marcas?.length > 0 && <div className="pp-miudo">Marcas: {parceiro.marcas.join(", ")}</div>}

      <ContatosDiretos parceiro={parceiro} />

      {parceiro.contatos?.length > 0 && (
        <div className="pp-contatos-ver" data-testid="contatos-parceiro">
          {parceiro.contatos.map((c, i) => (
            <div key={`${c.nome}-${i}`} className="pp-contato-cartao">
              <strong>{c.nome}</strong>
              <span className="pp-miudo">{[c.funcao, c.regiao].filter(Boolean).join(" · ")}</span>
              <BotoesContato whatsapp={c.telefone} telefone={c.telefone} email={c.email} mini />
            </div>
          ))}
        </div>
      )}

      {gerencia && parceiro.contrato && (
        <div className="pp-miudo" data-testid="resumo-contrato">
          Mensalidade{EM_TESTE ? " (simulação)" : ""}: <b>{formatarMensalidade(parceiro.contrato.mensalidade_centavos)}</b> · {EM_TESTE ? "sem cobrança" : "cobrança fora do PAIIA"} ·{" "}
          <span style={{ color: contrato.cor }}>{contrato.rotulo}</span>
          {parceiro.contrato.suspensao_motivo ? ` · ${parceiro.contrato.suspensao_motivo}` : ""}
        </div>
      )}

      <CatalogoDoParceiro parceiro={parceiro} perfil={perfil} />
      {COTACAO_INTERNA_ATIVA && gerencia && <CotacoesRecebidas parceiro={parceiro} />}
    </div>
  );
}

/* Contato direto com o fornecedor: o PAIIA só aproxima; a negociação é com a empresa. */
function ContatosDiretos({ parceiro, compacto }) {
  const temAlgum = [parceiro.whatsapp, parceiro.telefone, linkEmail(parceiro.email_comercial), linkSite(parceiro.site)].some(Boolean);
  return (
    <div className="pp-contato-direto" data-testid="contato-direto">
      {!compacto && <span className="pp-rotulo">Fale direto com a empresa</span>}
      {temAlgum
        ? <BotoesContato whatsapp={parceiro.whatsapp} telefone={parceiro.telefone} email={parceiro.email_comercial} site={parceiro.site} />
        : <span className="pp-miudo">Contato ainda não informado.</span>}
      {!compacto && <span className="pp-miudo">Preço, disponibilidade, pagamento e entrega são combinados diretamente com o fornecedor.</span>}
    </div>
  );
}

function BotoesContato({ whatsapp, telefone, email, site, mini }) {
  const zap = linkWhatsapp(whatsapp);
  const tel = linkTelefone(telefone);
  const mail = linkEmail(email);
  const web = linkSite(site);
  const cls = mini ? "pp-link pp-link-mini" : "pp-link";
  return (
    <span className="pp-chips">
      {zap && <a href={zap} target="_blank" rel="noopener noreferrer" className={`${cls} pp-link-zap`}>WhatsApp</a>}
      {!zap && whatsapp && whatsapp !== telefone && <span className="pp-miudo">WhatsApp {whatsapp}</span>}
      {tel ? <a href={tel} className={cls}>📞 {telefone}</a> : telefone ? <span className="pp-miudo">📞 {telefone}</span> : null}
      {mail && <a href={mail} className={cls}>✉ {email}</a>}
      {web && <a href={web} target="_blank" rel="noopener noreferrer" className={cls}>↗ Site</a>}
    </span>
  );
}

function CatalogoDoParceiro({ parceiro, perfil }) {
  const [filtro, setFiltro] = useState("");
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [cotando, setCotando] = useState(null);

  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      listarItensDoParceiro(parceiro.id, filtro)
        .then((l) => { if (vivo) { setItens(l); setErro(""); } })
        .catch((e) => vivo && setErro(e.message));
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [parceiro.id, filtro]);

  const podeCotar = COTACAO_INTERNA_ATIVA && (perfil === "usuario" || perfil === "admin");
  return (
    <div className="pp-bloco-simples">
      <strong>📖 Catálogo do parceiro</strong>
      {parceiro.catalogo_tipo === "site" && parceiro.catalogo_url && (
        <a href={linkSite(parceiro.catalogo_url) || parceiro.catalogo_url} target="_blank" rel="noopener noreferrer" className="pp-link">↗ Catálogo no site do parceiro</a>
      )}
      <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Filtrar por código, descrição ou aplicação" className="pp-campo" data-testid="filtro-catalogo-parceiro" />
      {erro && <div className="pp-aviso pp-aviso-erro">{erro}</div>}
      <TabelaItens itens={itens} mostrarSituacao={perfil !== "usuario"} aoCotar={podeCotar && parceiro.modalidades?.includes("cotacao") ? setCotando : null} />
      {COTACAO_INTERNA_ATIVA && cotando && <CotacaoSimulada parceiro={parceiro} item={cotando} aoFechar={() => setCotando(null)} />}
    </div>
  );
}

function CotacoesRecebidas({ parceiro }) {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    listarCotacoesSimuladas(parceiro.id).then(setLista).catch(() => setLista([]));
  }, [parceiro.id]);
  if (!lista.length) return null;
  return (
    <div className="pp-miudo" data-testid="cotacoes-recebidas">
      <b>Cotações recebidas (simuladas, nada foi enviado):</b>
      {lista.slice(0, 8).map((c) => (
        <div key={c.id} data-testid="cotacao-recebida">
          {c.codigo} × {c.quantidade} em {dataCurta(c.criado_em)}
          {c.mensagem ? <> · <i>“{c.mensagem}”</i></> : " · sem observação"}
        </div>
      ))}
    </div>
  );
}

function TabelaItens({ itens, mostrarSituacao, validacao, aoCotar, aoAnalisar, aoRemover, limite = 200 }) {
  // item suspeito: o administrador registra a conferência técnica antes de aprovar
  const [conferindo, setConferindo] = useState({ id: "", texto: "" });
  if (!itens.length) return <div className="pp-miudo">Nenhum item.</div>;
  const colunas = 5 + (mostrarSituacao ? 1 : 0) + (validacao ? 1 : 0);
  return (
    <div className="pp-rolagem">
      <table className="pp-tabela">
        <thead>
          <tr>
            <th>Código</th><th>Descrição / aplicação</th><th>Equivalências</th><th>Marca</th>
            {validacao && <th>Validação técnica</th>}
            {mostrarSituacao && <th>Aprovação</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {itens.slice(0, limite).flatMap((i) => {
            const sit = SITUACOES_TECNICAS[i.situacao_tecnica] || SITUACOES_TECNICAS.pendente;
            const v = validacao?.get(i.id);
            const nivel = NIVEIS_VALIDACAO[v?.nivel || "sem_divergencia"];
            const suspeito = v && v.nivel !== "sem_divergencia";
            const linhas = [
              <tr key={i.id || i.codigo} data-testid={`item-${i.codigo}`}>
                <td><b>{i.codigo}</b></td>
                <td>{i.descricao}{i.aplicacao ? <div className="pp-miudo">{i.aplicacao}</div> : null}</td>
                <td className="pp-miudo">{(i.equivalencias || []).slice(0, 6).join(", ")}{i.equivalencias?.length > 6 ? "…" : ""}</td>
                <td>{i.marca}</td>
                {validacao && (
                  <td data-testid={`validacao-${i.codigo}`}>
                    <span style={{ color: nivel.cor, fontWeight: 700 }}>{nivel.icone} {nivel.rotulo}</span>
                    {v?.motivos?.map((m) => <div key={m} className="pp-miudo">• {m}</div>)}
                  </td>
                )}
                {mostrarSituacao && <td style={{ color: sit.cor }}>{sit.rotulo}{i.analise_motivo ? <div className="pp-miudo">Conferência: {i.analise_motivo}</div> : null}</td>}
                <td className="pp-acoes">
                  {aoCotar && i.situacao_tecnica === "aprovado" && <button type="button" className="pp-botao-mini" onClick={() => aoCotar(i)}>Solicitar cotação</button>}
                  {aoAnalisar && i.situacao_tecnica !== "aprovado" && (
                    <button
                      type="button"
                      className="pp-botao-mini"
                      data-testid={`aprovar-item-${i.codigo}`}
                      onClick={() => (suspeito ? setConferindo({ id: i.id, texto: "" }) : aoAnalisar(i, "aprovado"))}
                    >
                      {suspeito ? "Conferir e aprovar" : "Aprovar"}
                    </button>
                  )}
                  {aoAnalisar && i.situacao_tecnica === "pendente" && <button type="button" className="pp-botao-mini" onClick={() => aoAnalisar(i, "recusado")}>Recusar</button>}
                  {aoRemover && <button type="button" className="pp-botao-mini" onClick={() => aoRemover(i)}>Remover</button>}
                </td>
              </tr>,
            ];
            if (conferindo.id === i.id) {
              linhas.push(
                <tr key={`${i.id}-conferencia`}>
                  <td colSpan={colunas}>
                    <div className="pp-conferencia" data-testid="conferencia-tecnica">
                      <span className="pp-miudo">Registre o que foi conferido (ex.: "confirmado no catálogo do fabricante"). Os dados oficiais do PAIIA não mudam.</span>
                      <input className="pp-campo" value={conferindo.texto} onChange={(e) => setConferindo({ id: i.id, texto: e.target.value })} placeholder="Conferência técnica" data-testid="texto-conferencia" />
                      <span className="pp-linha pp-quebra">
                        <button
                          type="button"
                          className="pp-botao-mini pp-botao-principal"
                          disabled={!conferindo.texto.trim()}
                          data-testid="confirmar-conferencia"
                          onClick={() => { aoAnalisar(i, "aprovado", conferindo.texto.trim()); setConferindo({ id: "", texto: "" }); }}
                        >
                          Aprovar com esta conferência
                        </button>
                        <button type="button" className="pp-botao-mini" onClick={() => setConferindo({ id: "", texto: "" })}>Cancelar</button>
                      </span>
                    </div>
                  </td>
                </tr>
              );
            }
            return linhas;
          })}
        </tbody>
      </table>
      {itens.length > limite && <div className="pp-miudo">Mostrando {limite} de {itens.length} itens. Use o filtro.</div>}
    </div>
  );
}

function CotacaoSimulada({ parceiro, item, aoFechar }) {
  const [quantidade, setQuantidade] = useState("1");
  const [mensagem, setMensagem] = useState("");
  const [estado, setEstado] = useState("");

  async function enviar() {
    setEstado("Registrando…");
    try {
      await registrarCotacaoSimulada({ parceiroId: parceiro.id, codigo: item.codigo, quantidade, mensagem });
      setEstado("✅ Simulação registrada no ambiente de teste. Nada foi enviado ao parceiro.");
    } catch (e) {
      setEstado(e.message);
    }
  }

  return (
    <div className="pp-painel pp-painel-cotacao" data-testid="cotacao-simulada">
      <strong>Solicitar cotação — {item.codigo} · {parceiro.nome_fantasia}</strong>
      <div className="pp-miudo">SIMULAÇÃO: no piloto nada é enviado ao parceiro.</div>
      <div className="pp-linha pp-quebra">
        <label className="pp-campo-rotulo pp-curto">
          <span>Quantidade</span>
          <input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="pp-campo" />
        </label>
        <label className="pp-campo-rotulo pp-cresce">
          <span>Observação (opcional)</span>
          <input value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="pp-campo" />
        </label>
      </div>
      <div className="pp-linha pp-quebra">
        <button type="button" className="pp-botao pp-botao-principal" onClick={enviar} data-testid="confirmar-cotacao">Registrar simulação</button>
        <button type="button" className="pp-botao" onClick={aoFechar}>Fechar</button>
      </div>
      {estado && <div className="pp-miudo" data-testid="estado-cotacao">{estado}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadastro: o próprio distribuidor preenche; o administrador aprova    */
/* ------------------------------------------------------------------ */
function FormularioParceiro({ inicial, perfil, aoCancelar, aoSalvar }) {
  const admin = perfil === "admin";
  const [p, setP] = useState(inicial);
  const [estado, setEstado] = useState("");
  const [itens, setItens] = useState([]);
  const [lista, setLista] = useState("");
  const [contas, setContas] = useState([]);
  const [emailConta, setEmailConta] = useState("");
  const [progresso, setProgresso] = useState(null);
  const [extraido, setExtraido] = useState(null); // { itens, aviso, resumo }
  const pendencias = pendenciasAprovacao(p);
  const contrato = p.contrato || contratoEmBranco();
  const controle = p.controle || { criterios: {} };
  const statusContrato = situacaoContrato(contrato);
  const [validacao, setValidacao] = useState(new Map());
  const pendentes = itens.filter((i) => i.situacao_tecnica === "pendente").length;
  const resumoPendentes = resumoValidacao(itens, validacao, { somentePendentes: true });

  useEffect(() => {
    if (!p.id) return;
    listarItensDoParceiro(p.id).then(setItens).catch(() => {});
    validacaoDoCatalogo(p.id).then(setValidacao).catch(() => {});
    if (admin) contasDoParceiro(p.id).then(setContas).catch(() => {});
  }, [p.id, admin]);

  const set = (campo, valor) => setP((atual) => ({ ...atual, [campo]: valor }));
  const setContrato = (mudancas) => setP((atual) => ({ ...atual, contrato: { ...(atual.contrato || contratoEmBranco()), ...mudancas } }));
  const setControle = (mudancas) => setP((atual) => ({ ...atual, controle: { ...(atual.controle || {}), ...mudancas } }));
  const separar = (texto) => String(texto || "").split(",").map((s) => s.trim()).filter(Boolean);
  const segmentos = p.segmentos || [];
  const outrosSegmentos = segmentos.filter((s) => !SEGMENTOS_AUTOMOTIVOS.includes(s));
  const alternarSegmento = (s) => set("segmentos", segmentos.includes(s) ? segmentos.filter((x) => x !== s) : [...segmentos, s]);

  const contatos = p.contatos || [];
  const setContato = (i, campo, valor) => set("contatos", contatos.map((c, n) => (n === i ? { ...c, [campo]: valor } : c)));

  async function executar(acao, sucesso) {
    setEstado("Aguarde…");
    try {
      const r = await acao();
      setEstado(typeof sucesso === "function" ? sucesso(r) : sucesso);
    } catch (e) {
      setEstado(e.message);
    }
  }

  function mudarSituacao(situacao) {
    if ((situacao === "aprovado" || situacao === "ativo") && pendencias.length) {
      setEstado(`Para aprovar falta: ${pendencias.join("; ")}.`);
      return;
    }
    setEstado("");
    set("situacao", situacao);
    if ((situacao === "aprovado" || situacao === "ativo") && !controle.aprovado_em) {
      setControle({ aprovado_em: new Date().toISOString(), aprovado_por: EM_TESTE ? "Administrador (simulação)" : "Administrador" });
    }
  }

  async function salvar() {
    if (!String(p.nome_fantasia || "").trim()) { setEstado("Informe o nome da empresa."); return; }
    if (admin && (p.situacao === "aprovado" || p.situacao === "ativo") && pendencias.length) {
      setEstado(`Para aprovar falta: ${pendencias.join("; ")}.`);
      return;
    }
    await executar(async () => {
      const salvo = await salvarParceiro(p, { admin });
      await aoSalvar(salvo, !p.id); // cadastro novo continua aberto para enviar logotipo e catálogo
    }, EM_TESTE ? "✅ Salvo (ambiente de teste)." : "✅ Salvo.");
  }

  async function enviarCatalogo(arquivo) {
    setExtraido(null);
    setProgresso(0);
    await executar(async () => {
      const caminho = await enviarArquivoCatalogo(p.id, arquivo, (f) => setProgresso(Math.round(f * 100)));
      setP((a) => ({ ...a, catalogo_arquivo: caminho, catalogo_situacao: "pendente" }));
      setProgresso(null);
      setEstado("Catálogo enviado. Lendo os itens automaticamente…");
      try {
        const { lerArquivoCatalogo } = await import("../services/parceiros/lerArquivoCatalogo");
        const r = await lerArquivoCatalogo(arquivo, (f) => setEstado(`Lendo o catálogo… ${Math.round(f * 100)}%`));
        setExtraido({ ...r, resumo: resumoExtracao(r.itens) });
        return r;
      } catch (e) {
        // O arquivo já está enviado e aguardando aprovação; só a leitura automática falhou.
        return { itens: [], aviso: `A leitura automática não conseguiu abrir o arquivo (${e.message || "formato não reconhecido"}).` };
      }
    }, (r) => (r.itens.length
      ? `✅ Catálogo enviado para aprovação. Encontramos ${r.itens.length} itens: confira abaixo e envie.`
      : `✅ Catálogo enviado para aprovação. ${r.aviso || "Nenhum item reconhecido automaticamente."}`));
    setProgresso(null);
  }

  const recarregarItens = async () => {
    const [lista, v] = await Promise.all([listarItensDoParceiro(p.id), validacaoDoCatalogo(p.id).catch(() => new Map())]);
    setItens(lista);
    setValidacao(v);
  };

  return (
    <div className="pp-painel" data-testid="formulario-parceiro">
      <strong className="pp-nome">
        {!p.id ? (EM_TESTE ? "Cadastrar parceiro (fictício)" : "Cadastrar parceiro") : admin ? `⚙️ Administração — ${p.nome_fantasia}` : `✏️ Meus dados — ${p.nome_fantasia}`}
      </strong>
      {!admin && <p className="pp-miudo">Preencha seus dados, envie o logotipo e o catálogo. Tudo passa pela aprovação do PAIIA antes de aparecer para os usuários.</p>}

      <Bloco titulo="1. Empresa">
        <Campo rotulo="Nome da empresa"><input className="pp-campo" value={p.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} data-testid="campo-nome" /></Campo>
        <Campo rotulo="Razão social"><input className="pp-campo" value={p.razao_social || ""} onChange={(e) => set("razao_social", e.target.value)} /></Campo>
        <Campo rotulo="CNPJ"><input className="pp-campo" value={p.documento || ""} onChange={(e) => set("documento", e.target.value)} /></Campo>
        <Campo rotulo="Tipo">
          <select className="pp-campo" value={p.tipo_empresa} onChange={(e) => set("tipo_empresa", e.target.value)}>
            {TIPOS_EMPRESA.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </Campo>
        <div className="pp-largo pp-bloco-simples" data-testid="segmentos">
          <span className="pp-rotulo">Linhas e segmentos (todas as linhas automotivas)</span>
          <div className="pp-chips">
            {SEGMENTOS_AUTOMOTIVOS.map((s) => (
              <button key={s} type="button" className={`pp-chip pp-chip-botao${segmentos.includes(s) ? " pp-chip-ativo" : ""}`} onClick={() => alternarSegmento(s)} aria-pressed={segmentos.includes(s)}>
                {segmentos.includes(s) ? "✓ " : ""}{s}
              </button>
            ))}
          </div>
          <input
            className="pp-campo"
            placeholder="Outros segmentos (separados por vírgula)"
            value={outrosSegmentos.join(", ")}
            onChange={(e) => set("segmentos", [...segmentos.filter((s) => SEGMENTOS_AUTOMOTIVOS.includes(s)), ...separar(e.target.value)])}
          />
        </div>
        <Campo rotulo="Marcas (separadas por vírgula)" largo><input className="pp-campo" value={(p.marcas || []).join(", ")} onChange={(e) => set("marcas", separar(e.target.value))} /></Campo>
        <Campo rotulo="Logotipo (PNG, JPG ou WEBP, até 1 MB)" largo>
          <div className="pp-linha">
            <Logo parceiro={p} tamanho={40} />
            {p.id ? (
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                data-testid="arquivo-logo"
                className="pp-arquivo"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = "";
                  if (arquivo) executar(async () => set("logotipo_url", await enviarLogotipo(p.id, arquivo)), "✅ Logotipo enviado.");
                }}
              />
            ) : <span className="pp-miudo">Salve o cadastro para enviar o logotipo.</span>}
          </div>
        </Campo>
        <Campo rotulo="Apresentação" largo><textarea className="pp-campo" rows={3} value={p.apresentacao || ""} onChange={(e) => set("apresentacao", e.target.value)} /></Campo>
      </Bloco>

      <Bloco titulo="2. Contatos comerciais">
        <Campo rotulo="Site"><input className="pp-campo" value={p.site || ""} onChange={(e) => set("site", e.target.value)} /></Campo>
        <Campo rotulo="WhatsApp da empresa"><input className="pp-campo" value={p.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} /></Campo>
        <Campo rotulo="Telefone comercial"><input className="pp-campo" value={p.telefone || ""} onChange={(e) => set("telefone", e.target.value)} data-testid="campo-telefone" /></Campo>
        <Campo rotulo="E-mail comercial"><input className="pp-campo" value={p.email_comercial || ""} onChange={(e) => set("email_comercial", e.target.value)} /></Campo>
        <div className="pp-largo pp-lista-contatos" data-testid="editor-contatos">
          <span className="pp-rotulo">Vendedores e representantes</span>
          {contatos.map((c, i) => (
            <div key={i} className="pp-contato-linha" data-testid="linha-contato">
              <input className="pp-campo" placeholder="Nome" value={c.nome || ""} onChange={(e) => setContato(i, "nome", e.target.value)} aria-label="Nome do contato" />
              <select className="pp-campo" value={c.funcao || "Vendedor"} onChange={(e) => setContato(i, "funcao", e.target.value)} aria-label="Função">
                {[...new Set([...FUNCOES_CONTATO, ...(c.funcao ? [c.funcao] : [])])].map((f) => <option key={f}>{f}</option>)}
              </select>
              <input className="pp-campo" placeholder="Região (opcional)" value={c.regiao || ""} onChange={(e) => setContato(i, "regiao", e.target.value)} aria-label="Região" />
              <input className="pp-campo" placeholder="WhatsApp / telefone" value={c.telefone || ""} onChange={(e) => setContato(i, "telefone", e.target.value)} aria-label="Telefone" />
              <input className="pp-campo" placeholder="E-mail" value={c.email || ""} onChange={(e) => setContato(i, "email", e.target.value)} aria-label="E-mail" />
              <button type="button" className="pp-botao-mini pp-remover" onClick={() => set("contatos", contatos.filter((_, n) => n !== i))} aria-label="Remover contato">✕<span className="pp-so-celular"> Remover contato</span></button>
            </div>
          ))}
          <button type="button" className="pp-botao" onClick={() => set("contatos", [...contatos, contatoEmBranco()])} data-testid="adicionar-contato">
            + Adicionar vendedor ou representante
          </button>
        </div>
      </Bloco>

      <Bloco titulo="3. Catálogo (passa pela validação e aprovação técnica)">
        <label className="pp-opcao pp-largo">
          <input type="checkbox" checked={!!p.catalogo_autorizado} onChange={(e) => set("catalogo_autorizado", e.target.checked)} />
          <span>A empresa autoriza a integração do seu catálogo ao PAIIA</span>
        </label>
        <Campo rotulo="Catálogo no site (opcional)" largo>
          <input className="pp-campo" placeholder="https://" value={p.catalogo_url || ""} onChange={(e) => { set("catalogo_url", e.target.value); set("catalogo_tipo", e.target.value ? "site" : "itens_paiia"); }} />
        </Campo>
        {p.id ? (
          <>
            <Campo rotulo={`Enviar catálogo — PDF ou planilha (CSV, XLS, XLSX), até ${LIMITE_CATALOGO_BYTES / 1024 / 1024} MB. O PAIIA lê os itens sozinho.`} largo>
              <input
                type="file"
                accept=".pdf,.csv,.xls,.xlsx"
                data-testid="arquivo-catalogo"
                className="pp-arquivo"
                disabled={progresso !== null}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = "";
                  if (arquivo) enviarCatalogo(arquivo);
                }}
              />
            </Campo>
            {progresso !== null && (
              <div className="pp-largo">
                <div className="pp-barra"><div style={{ width: `${progresso}%` }} /></div>
                <span className="pp-miudo" data-testid="progresso-envio">Enviando… {progresso}%</span>
              </div>
            )}
            <div className="pp-largo pp-chips" data-testid="situacao-catalogo">
              <span className="pp-miudo" style={{ color: (SITUACOES_TECNICAS[p.catalogo_situacao] || SITUACOES_TECNICAS.sem_envio).cor }}>
                Arquivo: {(SITUACOES_TECNICAS[p.catalogo_situacao] || SITUACOES_TECNICAS.sem_envio).rotulo}
              </span>
              {p.catalogo_arquivo && (
                <button type="button" className="pp-botao-mini" onClick={() => executar(async () => window.open(await linkArquivoCatalogo(p.catalogo_arquivo), "_blank", "noopener"), "")}>Abrir arquivo</button>
              )}
              {admin && p.catalogo_arquivo && p.catalogo_situacao === "pendente" && (
                <>
                  <button type="button" className="pp-botao-mini" onClick={() => executar(async () => { await definirSituacaoCatalogo(p.id, "aprovado"); set("catalogo_situacao", "aprovado"); }, "✅ Catálogo aprovado.")}>Aprovar arquivo</button>
                  <button type="button" className="pp-botao-mini" onClick={() => executar(async () => { await definirSituacaoCatalogo(p.id, "recusado"); set("catalogo_situacao", "recusado"); }, "Arquivo recusado.")}>Recusar</button>
                </>
              )}
            </div>

            {extraido?.itens?.length > 0 && (
              <div className="pp-largo pp-painel pp-painel-extracao" data-testid="extracao">
                <strong>Leitura automática: {extraido.resumo.total} itens encontrados</strong>
                <span className="pp-miudo">
                  {extraido.resumo.comDescricao} com descrição · {extraido.resumo.comAplicacao} com aplicação · {extraido.resumo.comEquivalencias} com equivalências
                  {extraido.aviso ? ` · ${extraido.aviso}` : ""}
                </span>
                <TabelaItens itens={extraido.itens} limite={10} />
                <div className="pp-linha pp-quebra">
                  <button
                    type="button"
                    className="pp-botao pp-botao-principal"
                    data-testid="enviar-extraidos"
                    onClick={() => executar(async () => {
                      const n = await enviarItens(p.id, extraido.itens);
                      setExtraido(null);
                      await recarregarItens();
                      return n;
                    }, (n) => `✅ ${n} itens enviados para aprovação técnica.`)}
                  >
                    Enviar {extraido.itens.length} itens para aprovação
                  </button>
                  <button type="button" className="pp-botao" onClick={() => setExtraido(null)}>Descartar leitura</button>
                </div>
              </div>
            )}

            <details className="pp-largo pp-detalhes">
              <summary>Digitar ou colar itens (código ; descrição ; marca ; segmento ; aplicação ; equivalências)</summary>
              <textarea className="pp-campo pp-mono" rows={4} value={lista} onChange={(e) => setLista(e.target.value)} data-testid="lista-itens" placeholder="ABC-123 ; Bomba de combustível ; Marca X ; Injeção eletrônica ; Gol 1.0 2010-2015 ; 0580454001, 23221-0D010" />
              <button
                type="button"
                className="pp-botao"
                data-testid="enviar-itens"
                onClick={() => executar(async () => { const n = await enviarListaColada(p.id, lista); setLista(""); await recarregarItens(); return n; }, (n) => `✅ ${n} itens enviados para aprovação técnica.`)}
              >
                Enviar itens para aprovação
              </button>
            </details>

            <div className="pp-largo pp-bloco-simples">
              <span className="pp-rotulo">Itens do catálogo: {itens.length} ({pendentes} aguardando aprovação)</span>
              {pendentes > 0 && (
                <div className="pp-chips" data-testid="resumo-validacao">
                  <span className="pp-miudo">Validação automática dos pendentes:</span>
                  {Object.entries(NIVEIS_VALIDACAO).map(([id, n]) => (
                    <span key={id} className="pp-chip" style={{ color: n.cor, borderColor: n.cor }}>{n.icone} {n.rotulo}: {resumoPendentes[id] || 0}</span>
                  ))}
                </div>
              )}
              {admin && pendentes > 0 && (
                <div className="pp-linha pp-quebra">
                  {resumoPendentes.sem_divergencia > 0 && (
                    <button type="button" className="pp-botao pp-botao-principal" data-testid="aprovar-todos" onClick={() => executar(async () => { const n = await aprovarItensPendentes(p.id); await recarregarItens(); return n; }, (n) => `✅ ${n} itens sem divergência aprovados.`)}>
                      Aprovar os sem divergência ({resumoPendentes.sem_divergencia})
                    </button>
                  )}
                  {resumoPendentes.conferir + resumoPendentes.conflito > 0 && (
                    <span className="pp-miudo">
                      {resumoPendentes.conferir + resumoPendentes.conflito} item(ns) suspeito(s) ficam fora da aprovação em lote: confira um a um ("Conferir e aprovar") ou recuse.
                    </span>
                  )}
                </div>
              )}
              {!admin && resumoPendentes.conferir + resumoPendentes.conflito > 0 && (
                <div className="pp-aviso">Alguns itens precisam de conferência: corrija e envie de novo, ou aguarde a análise técnica do PAIIA.</div>
              )}
              <TabelaItens
                itens={[...itens].sort((a, b) => (a.situacao_tecnica === "pendente" ? 0 : 1) - (b.situacao_tecnica === "pendente" ? 0 : 1))}
                mostrarSituacao
                validacao={validacao}
                limite={100}
                aoAnalisar={admin ? (i, s, motivo) => executar(async () => { await analisarItem(i.id, s, motivo); await recarregarItens(); }, s === "aprovado" ? "✅ Item aprovado." : "Item recusado.") : null}
                aoRemover={(i) => executar(async () => { await removerItem(i.id); await recarregarItens(); }, "Item removido.")}
              />
            </div>
          </>
        ) : <div className="pp-largo pp-miudo">Salve o cadastro para enviar o catálogo e os itens.</div>}
      </Bloco>

      {admin && (
        <Bloco titulo="4. Parceria e contrato (só administrador)">
          <div className="pp-largo pp-opcoes pp-opcoes-coluna">
            <span className="pp-rotulo">Seleção (os 6 critérios são exigidos para aprovar)</span>
            {CRITERIOS_SELECAO.map((c) => (
              <label key={c.id} className="pp-opcao">
                <input type="checkbox" checked={!!controle.criterios?.[c.id]} onChange={(e) => setControle({ criterios: { ...(controle.criterios || {}), [c.id]: e.target.checked } })} />
                <span>{c.rotulo}</span>
              </label>
            ))}
          </div>
          <Campo rotulo="Situação da parceria">
            <select className="pp-campo" value={p.situacao} onChange={(e) => mudarSituacao(e.target.value)} data-testid="campo-situacao">
              {SITUACOES.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo={EM_TESTE ? "Mensalidade (R$, simulação)" : "Mensalidade (R$)"}>
            <CampoReais centavos={contrato.mensalidade_centavos} aoMudar={(c) => setContrato({ mensalidade_centavos: c })} />
          </Campo>
          <Campo rotulo="Experiência gratuita (dias)">
            <input type="number" min="0" max="365" className="pp-campo" value={contrato.experiencia_dias ?? 0} onChange={(e) => setContrato({ experiencia_dias: e.target.value })} data-testid="campo-experiencia" />
          </Campo>
          <Campo rotulo="Início da parceria">
            <input type="date" className="pp-campo" value={contrato.vigencia_inicio || ""} onChange={(e) => setContrato({ vigencia_inicio: e.target.value, vigencia_fim: fimDoPeriodo(e.target.value, contrato.periodo_meses) })} />
          </Campo>
          <Campo rotulo="Período (meses)">
            <input type="number" min="1" max="60" className="pp-campo" value={contrato.periodo_meses ?? 12} onChange={(e) => setContrato({ periodo_meses: e.target.value, vigencia_fim: fimDoPeriodo(contrato.vigencia_inicio, e.target.value) })} />
          </Campo>
          <Campo rotulo="Vencimento">
            <input type="date" className="pp-campo" value={contrato.vigencia_fim || ""} onChange={(e) => setContrato({ vigencia_fim: e.target.value })} data-testid="campo-vencimento" />
          </Campo>
          <label className="pp-opcao pp-largo">
            <input type="checkbox" checked={!!contrato.renovacao_automatica} onChange={(e) => setContrato({ renovacao_automatica: e.target.checked })} data-testid="campo-renovacao" />
            <span>Renovação automática ao vencer (sem marcar, a parceria é suspensa automaticamente no vencimento)</span>
          </label>
          <div className="pp-largo pp-miudo" data-testid="status-contrato">
            Situação do contrato: <b style={{ color: statusContrato.cor }}>{statusContrato.rotulo}</b> · {EM_TESTE ? "cobrança desligada no piloto (o banco não permite ligar)" : "o PAIIA não faz cobrança automática"}
            {contrato.suspensao_motivo ? ` · ${contrato.suspensao_motivo}` : ""}
          </div>
          <Campo rotulo="Observações internas (só o administrador vê)" largo>
            <textarea className="pp-campo" rows={2} value={controle.observacoes_admin || ""} onChange={(e) => setControle({ observacoes_admin: e.target.value })} />
          </Campo>
          {controle.aprovado_em && <div className="pp-largo pp-miudo">Aprovado em {dataCurta(controle.aprovado_em)} por {controle.aprovado_por}</div>}
          {pendencias.length > 0 && <div className="pp-largo pp-aviso">Ainda não pode ser aprovado. Falta: {pendencias.join("; ")}.</div>}
          {p.id && (
            <div className="pp-largo pp-bloco-simples" data-testid="contas-parceiro">
              <span className="pp-rotulo">Contas de login do parceiro (editam os dados comerciais e enviam catálogo)</span>
              {contas.map((c) => (
                <span key={c.user_id} className="pp-linha pp-miudo">
                  {c.email}
                  <button type="button" className="pp-botao-mini" onClick={() => executar(async () => { await desvincularConta(p.id, c.user_id); setContas(await contasDoParceiro(p.id)); }, "Conta desvinculada.")}>Desvincular</button>
                </span>
              ))}
              <div className="pp-linha pp-quebra">
                <input className="pp-campo pp-cresce" placeholder="E-mail da conta PAIIA do parceiro" value={emailConta} onChange={(e) => setEmailConta(e.target.value)} />
                <button type="button" className="pp-botao" onClick={() => executar(async () => { await vincularConta(p.id, emailConta); setEmailConta(""); setContas(await contasDoParceiro(p.id)); }, "✅ Conta vinculada.")}>Vincular</button>
              </div>
            </div>
          )}
        </Bloco>
      )}

      <div className="pp-linha pp-quebra pp-rodape">
        <button type="button" className="pp-botao pp-botao-principal" onClick={salvar} data-testid="salvar-parceiro">Salvar</button>
        <button type="button" className="pp-botao" onClick={aoCancelar}>Fechar</button>
        {estado && <span className="pp-miudo" data-testid="estado-parceiro">{estado}</span>}
      </div>
    </div>
  );
}

function CampoReais({ centavos, aoMudar }) {
  const formatar = (c) => ((Number(c) || 0) / 100).toFixed(2).replace(".", ",");
  // Só este campo muda a mensalidade, então o texto começa do valor salvo e segue o que é digitado.
  const [texto, setTexto] = useState(() => formatar(centavos));
  return (
    <input
      className="pp-campo"
      inputMode="decimal"
      data-testid="campo-mensalidade"
      value={texto}
      onChange={(e) => { setTexto(e.target.value); aoMudar(reaisParaCentavos(e.target.value)); }}
      onBlur={() => setTexto(formatar(reaisParaCentavos(texto)))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Caixa "Parceiros com este código" abaixo dos resultados técnicos     */
/* ------------------------------------------------------------------ */
export function ParceirosNaPesquisa({ pesquisa }) {
  const [grupos, setGrupos] = useState([]);
  const [cotando, setCotando] = useState(null);
  const chave = pesquisa ? codigosParaParceiros(pesquisa.termo, pesquisa.resultados).join(",") : "";
  const texto = pesquisa ? termoParaTexto(pesquisa.termo) : "";

  useEffect(() => {
    let vivo = true;
    const codigos = chave ? chave.split(",") : [];
    if (!codigos.length && !texto) return undefined;
    // código / equivalência + descrição / aplicação; só itens aprovados de parceiros ativos
    Promise.all([
      listarParceiros(),
      codigos.length ? itensDeParceirosPorCodigos(codigos) : [],
      texto ? itensDeParceirosPorTexto(texto).catch(() => []) : [],
    ])
      .then(([parceiros, porCodigo, porTexto]) => {
        const porId = new Map([...porCodigo, ...porTexto].map((i) => [i.id, i]));
        if (vivo) setGrupos(agruparItensPorParceiro([...porId.values()], parceiros));
      })
      .catch(() => vivo && setGrupos([]));
    return () => { vivo = false; };
  }, [chave, texto]);

  if ((!chave && !texto) || !grupos.length) return null;

  return (
    <div className="pp-area pp-caixa-comercial" data-testid="parceiros-na-pesquisa">
      <EstilosParceiros />
      <strong>🤝 Fornecedores com esta referência no catálogo <span className="pp-selo">{EM_TESTE ? "COMERCIAL · PILOTO FICTÍCIO" : "COMERCIAL"}</span></strong>
      <div className="pp-miudo">
        Informação comercial à parte: não altera os resultados técnicos acima, e nenhuma empresa paga para aparecer antes (ordem alfabética).
        Preço, disponibilidade, pagamento e entrega são combinados diretamente com o fornecedor.
      </div>
      {grupos.map(({ parceiro, itens }) => (
        <div key={parceiro.id} className="pp-linha pp-quebra pp-linha-parceiro" data-testid="fornecedor-na-pesquisa">
          <Logo parceiro={parceiro} tamanho={28} />
          <div className="pp-cresce">
            <b>{parceiro.nome_fantasia}</b>
            <div className="pp-miudo">
              {itens.slice(0, 6).map((i) => `${i.codigo}${i.descricao ? ` — ${i.descricao}` : ""}`).join(" · ")}
              {itens.length > 6 ? ` · e mais ${itens.length - 6}` : ""}
            </div>
            <ContatosDiretos parceiro={parceiro} compacto />
            {parceiro.contatos?.length > 0 && (
              <div className="pp-vendedores" data-testid="vendedores-na-pesquisa">
                {parceiro.contatos.slice(0, 4).map((c, n) => (
                  <div key={`${c.nome}-${n}`} className="pp-vendedor">
                    <span className="pp-miudo"><b>{c.nome}</b>{c.funcao || c.regiao ? ` · ${[c.funcao, c.regiao].filter(Boolean).join(" · ")}` : ""}</span>
                    <BotoesContato whatsapp={c.telefone} telefone={c.telefone} email={c.email} mini />
                  </div>
                ))}
              </div>
            )}
          </div>
          {COTACAO_INTERNA_ATIVA && parceiro.modalidades?.includes("cotacao") && (
            <button type="button" className="pp-botao-mini" onClick={() => setCotando({ parceiro, item: itens[0] })}>Solicitar cotação</button>
          )}
        </div>
      ))}
      {COTACAO_INTERNA_ATIVA && cotando && <CotacaoSimulada parceiro={cotando.parceiro} item={cotando.item} aoFechar={() => setCotando(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Logo({ parceiro, tamanho }) {
  const estilo = { width: tamanho, height: tamanho, borderRadius: "8px", flex: "0 0 auto" };
  if (parceiro.logotipo_url) return <img src={parceiro.logotipo_url} alt="" style={{ ...estilo, objectFit: "contain", background: "#fff" }} />;
  return (
    <span style={{ ...estilo, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#334155", color: "#e2e8f0", fontWeight: 800, fontSize: tamanho * 0.45 }}>
      {String(parceiro.nome_fantasia || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Bloco({ titulo, children }) {
  return (
    <fieldset className="pp-bloco">
      <legend>{titulo}</legend>
      <div className="pp-form">{children}</div>
    </fieldset>
  );
}

function Campo({ rotulo, largo, children }) {
  return (
    <label className={`pp-campo-rotulo${largo ? " pp-largo" : ""}`}>
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

// Estilos próprios da área (classes "pp-"): o CSS global do PAIIA estica todo input
// para 100% e força as grades montadas em estilo de linha; aqui isso fica sob controle.
const CSS_PARCEIROS = `
.pp-area { margin-top: 26px; color: #e2e8f0; text-align: left; }
.pp-area * { text-align: left; }
.pp-area button { text-align: center; }
.pp-area .pp-cartao, .pp-area .pp-cartao * { text-align: left; }
.pp-topo { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.pp-titulo { color: #e2e8f0; font-size: 15px; margin: 0 0 4px; }
.pp-selo { margin-left: 6px; padding: 2px 7px; border-radius: 999px; background: #b45309; color: #fff; font-size: 10px; font-weight: 800; vertical-align: middle; white-space: nowrap; }
.pp-miudo { color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0; }
.pp-texto { margin: 0; color: #cbd5e1; line-height: 1.5; }
.pp-nome { font-size: 16px; }
.pp-rotulo { font-size: 12px; color: #94a3b8; font-weight: 700; }
.pp-linha { display: flex; gap: 10px; align-items: center; min-width: 0; }
.pp-quebra { flex-wrap: wrap; }
.pp-cresce { flex: 1 1 200px; min-width: 0; }
.pp-curto { flex: 0 0 120px; }
.pp-grade-cartoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr)); gap: 10px; }
.pp-cartao { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; border-radius: 12px; border: 1px solid #475569; background: linear-gradient(180deg,#0f172a,#020617); color: #fff; cursor: pointer; width: 100%; }
.pp-cartao-ativo { border-color: #f59e0b; background: rgba(120,53,15,.35); }
.pp-painel { margin-top: 12px; padding: 14px; border-radius: 12px; border: 1px solid #475569; background: rgba(15,23,42,.85); display: grid; gap: 12px; min-width: 0; }
.pp-painel-cotacao { border: 1px dashed #f59e0b; background: rgba(120,53,15,.18); }
.pp-painel-extracao { margin-top: 0; border-color: #0e7490; background: rgba(14,116,144,.12); }
.pp-caixa-comercial { margin-top: 14px; padding: 12px; border-radius: 12px; border: 1px dashed #64748b; background: rgba(30,41,59,.6); display: grid; gap: 8px; }
.pp-linha-parceiro { padding-top: 8px; border-top: 1px solid #334155; }
.pp-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pp-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid #475569; color: #94a3b8; font-size: 12px; font-weight: 700; }
.pp-chip-ativo { border-color: #22d3ee; color: #a5f3fc; }
.pp-link { padding: 5px 10px; border-radius: 8px; border: 1px solid #64748b; color: #e2e8f0; text-decoration: none; font-size: 12px; font-weight: 700; display: inline-block; }
.pp-link-texto { color: #a5f3fc; }
.pp-link-mini { padding: 3px 8px; font-weight: 600; }
.pp-link-zap { border-color: #22c55e; color: #bbf7d0; }
.pp-contato-direto { display: grid; gap: 6px; }
.pp-vendedores { display: grid; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #334155; }
.pp-vendedor { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; }
.pp-chip-botao { background: transparent; cursor: pointer; }
.pp-conferencia { display: grid; gap: 6px; padding: 8px; border-radius: 8px; border: 1px dashed #fbbf24; background: rgba(120,53,15,.18); }
.pp-contatos-ver { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 8px; }
.pp-contato-cartao { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; border: 1px solid #334155; background: rgba(2,6,23,.5); }
.pp-bloco { border: 1px solid #334155; border-radius: 10px; padding: 10px 12px 12px; margin: 0; min-width: 0; }
.pp-bloco legend { color: #a5f3fc; font-size: 13px; font-weight: 700; padding: 0 6px; }
.pp-form { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 12px; align-items: start; }
.pp-largo { grid-column: 1 / -1; }
.pp-campo-rotulo { display: grid; gap: 4px; min-width: 0; }
.pp-campo-rotulo > span { font-size: 12px; color: #94a3b8; line-height: 1.35; }
.pp-area .pp-campo { width: 100%; min-width: 0; box-sizing: border-box; padding: 9px 10px; border-radius: 8px; border: 1px solid #334155; background: #020617; color: #e2e8f0; font-size: 14px; }
.pp-area textarea.pp-campo { resize: vertical; }
.pp-mono { font-family: ui-monospace, Consolas, monospace; }
.pp-area .pp-arquivo { width: 100%; min-width: 0; color: #cbd5e1; font-size: 13px; }
.pp-opcoes { display: flex; flex-wrap: wrap; gap: 8px 18px; }
.pp-opcoes-coluna { flex-direction: column; gap: 6px; }
.pp-opcao { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #cbd5e1; line-height: 1.35; cursor: pointer; }
.pp-area .pp-opcao input[type="checkbox"] { width: 18px !important; height: 18px; min-width: 18px !important; flex: 0 0 18px; margin: 0; accent-color: #22d3ee; }
.pp-lista-contatos { display: grid; gap: 8px; }
.pp-contato-linha { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1.1fr 1.3fr auto; gap: 6px; align-items: center; padding: 8px; border-radius: 10px; border: 1px solid #334155; background: rgba(2,6,23,.4); }
.pp-botao { padding: 9px 14px; border-radius: 10px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-weight: 700; cursor: pointer; justify-self: start; }
.pp-botao-principal { border-color: #22d3ee; background: #0e7490; color: #fff; }
.pp-botao-mini { padding: 5px 10px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; font-size: 12px; cursor: pointer; }
.pp-remover { justify-self: end; }
.pp-acoes { white-space: nowrap; }
.pp-acoes .pp-botao-mini + .pp-botao-mini { margin-left: 4px; }
.pp-rolagem { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.pp-tabela { width: 100%; min-width: 760px; border-collapse: collapse; font-size: 12px; }
.pp-tabela td:first-child { white-space: nowrap; }
.pp-tabela th { color: #94a3b8; border-bottom: 1px solid #334155; padding: 6px; font-weight: 700; }
.pp-tabela td { border-bottom: 1px solid #1e293b; padding: 6px; vertical-align: top; }
.pp-bloco-simples { display: grid; gap: 8px; min-width: 0; }
.pp-detalhes summary { cursor: pointer; color: #a5f3fc; font-size: 13px; margin-bottom: 8px; }
.pp-detalhes { display: grid; gap: 8px; }
.pp-barra { height: 8px; border-radius: 99px; background: #1e293b; overflow: hidden; }
.pp-barra > div { height: 100%; background: #22d3ee; transition: width .2s; }
.pp-aviso { padding: 8px 10px; border-radius: 8px; background: rgba(120,53,15,.35); color: #fde68a; font-size: 12px; }
.pp-aviso-erro { background: rgba(127,29,29,.4); color: #fecaca; }
.pp-rodape { position: sticky; bottom: 34px; padding: 10px; margin: 0 -14px -14px; border-top: 1px solid #334155; background: rgba(15,23,42,.97); border-radius: 0 0 12px 12px; }
.pp-so-celular { display: none; }
@media (max-width: 900px) {
  .pp-contato-linha { grid-template-columns: 1fr 1fr; }
  .pp-contato-linha > input:first-child { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .pp-contato-linha { grid-template-columns: 1fr; }
  .pp-remover { justify-self: stretch; color: #fca5a5; }
  .pp-so-celular { display: inline; }
  .pp-topo > .pp-botao, .pp-topo > button { width: 100%; }
  .pp-painel { padding: 12px; }
  .pp-rodape { margin: 0 -12px -12px; }
  .pp-rodape .pp-botao { flex: 1 1 auto; }
}
`;

function EstilosParceiros() {
  return <style>{CSS_PARCEIROS}</style>;
}
