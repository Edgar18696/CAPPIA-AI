// =============================================================
// PAIIA Voz — ANÚNCIO RÁPIDO (versão de teste, 22/10/2026)
//
// 1 Fotos → 2 Código → 3 Título → 4 Descrição → 5 Enviar ao Novo Anúncio.
// Voz para preencher e corrigir; tudo também editável no teclado.
// Fundo branco feito no próprio aparelho, em paralelo; a original fica
// guardada e a tratada só vai ao anúncio se você escolher.
// Nada aqui grava no banco, publica, cobra créditos ou usa API paga:
// Conferência, Mercado Livre e Bling continuam no fluxo existente,
// com aprovação antes de qualquer escrita.
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  criarFichaVoz,
  lerFichaVoz,
  guardarFichaVoz,
  descartarFichaVoz,
  aplicarInterpretacao,
  incorporarResultadoBase,
  conferirCodigo,
  removerCodigo,
  confirmarAplicacao,
  removerAplicacao,
  codigoPrincipal,
  resumoAplicacao,
  incluirAplicacao,
  CHAVE_COMPLEMENTO_VOZ,
} from "./servicos/fichaVoz";
import {
  ETAPAS,
  ROTULOS_ETAPAS,
  PERGUNTAS,
  LIMITE_TITULO,
  estadoRapido,
  irParaEtapa,
  proximaEtapa,
  lerCodigoDaFala,
  definirTitulo,
  avaliarTitulo,
  ajustarTitulo,
  sugestoesTitulo,
  definirTextoDescricao,
  definirDescricaoFinal,
  organizarDescricao,
  descricaoParaEnvio,
  registrarConsultaBase,
  marcarBaseAproveitada,
  validarRapido,
  mapearRapidoParaNovoAnuncio,
  pesoMedidasParaEnvio,
} from "./servicos/rascunhoRapido";
import { editarPorVoz, comandoNavegacao } from "./servicos/edicaoPorVoz";
import { entenderTrecho } from "./servicos/conversaVoz";
import { criarReconhecedor, suportaReconhecimento, diagnosticoVoz } from "./servicos/reconhecimentoVoz";
import TesteMicrofone from "./TesteMicrofone";
import { consultarBaseVoz } from "./servicos/consultaBaseVoz";
import { candidatosDeCodigo, lerTextoDaFoto } from "./servicos/codigoNaFoto";
import { armazenamentoIndexedDB, armazenamentoMemoria, criarGuardaFotos, MAX_FOTOS_POR_FICHA } from "./servicos/fotosVozLocal";
import { criarExecutorFotoIA, criarFilaFotoIA, lerModo, gravarModo, modosDisponiveis, situacaoIA, resumoFotos } from "./servicos/fotoIAVoz";
// Foto IA OFICIAL, sem alteração (mesmas funções da tela Foto IA):
import { enviarOriginalFotoIA, recortarFotoIA } from "../../services/fotoIA/pipelineFotoIA";
import { comporFotoFinal } from "../../services/fotoIA/composicaoFotoIA";
import { supabase } from "../../supabase";
import { consumirAcaoPaiiaVoz } from "./servicos/acaoInicial";
import { iniciarAnuncioNovo } from "../../services/aberturaNovoAnuncio";
import { buscarConhecimentoValidado } from "../../services/paizinhoPesquisa/conhecimentoValidado";
import { pesquisarCatalogo } from "../../services/catalogoService";

const CHAVE_MANTER_MIC = "paiiaVozManterMicrofone";
function manterMicPadrao() {
  try {
    const s = localStorage.getItem(CHAVE_MANTER_MIC);
    if (s === "1" || s === "0") return s === "1";
  } catch {
    // sem localStorage
  }
  return Boolean(globalThis.matchMedia?.("(pointer: coarse)")?.matches);
}

export default function PaiiaVozRapido({ setScreen, usuario, onModoConversa }) {
  const [ficha, setFicha] = useState(() => lerFichaVoz() || criarFichaVoz());
  const [aviso, setAviso] = useState("");
  const [parcial, setParcial] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [erroVoz, setErroVoz] = useState("");
  const [entrada, setEntrada] = useState("");
  const [fotos, setFotos] = useState([]);
  const [consultando, setConsultando] = useState(false);
  const [lendoFoto, setLendoFoto] = useState({ estado: "", candidatos: [] });
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [confirmandoNova, setConfirmandoNova] = useState(false);
  const [editandoFinal, setEditandoFinal] = useState(false);
  const [manterMic, setManterMic] = useState(manterMicPadrao);
  const fichaRef = useRef(ficha);
  const reconhecedorRef = useRef(null);
  const fotoRef = useRef(null);
  const galeriaRef = useRef(null);
  const trocarRef = useRef({ input: null, id: null });
  const fotosRef = useRef([]);
  // Fundo branco com o Foto IA: real só com autorização (variável de build); no teste, simulação.
  const ambienteIA = useMemo(() => ({ modoTeste: Boolean(globalThis.__paiiaModoTeste), realLiberado: import.meta.env?.VITE_PAIIA_VOZ_FOTO_IA_REAL === "1" }), []);
  const [modoIA, setModoIA] = useState(() => lerModo(ambienteIA));
  const suporta = useMemo(() => suportaReconhecimento(), []);
  // (22/10) Aviso já na abertura: navegador sem voz / endereço inseguro / sem microfone.
  const avisoVoz = useMemo(() => diagnosticoVoz().aviso, []);
  const guarda = useMemo(() => criarGuardaFotos({ armazenamento: armazenamentoIndexedDB() || armazenamentoMemoria() }), []);
  const r = estadoRapido(ficha);
  const etapa = r.etapa;

  const mudarFicha = useCallback((nova) => {
    fichaRef.current = nova;
    setFicha(nova);
    guardarFichaVoz(nova);
  }, []);

  // ---------------- Fotos (IndexedDB) ----------------
  useEffect(() => { fotosRef.current = fotos; }, [fotos]);
  useEffect(() => () => fotosRef.current.forEach((f) => { URL.revokeObjectURL(f.url); if (f.urlTratada) URL.revokeObjectURL(f.urlTratada); }), []);
  const paraTela = useCallback((reg) => ({
    id: reg.id,
    nome: reg.nome,
    url: URL.createObjectURL(reg.blob),
    urlTratada: reg.tratada?.blob ? URL.createObjectURL(reg.tratada.blob) : "",
    tratada: reg.tratada ? { aplicavel: Boolean(reg.tratada.blob), motivo: reg.tratada.motivo || "", origem: reg.tratada.origem || "" } : null,
    ia: situacaoIA(reg),
    versao: reg.versao === "tratada" && reg.tratada?.blob ? "tratada" : "original",
    usarNoAnuncio: reg.usarNoAnuncio,
    reg,
  }), []);
  const recarregarFotos = useCallback(async () => {
    try {
      const regs = await guarda.listar(fichaRef.current.id);
      setFotos((atuais) => {
        atuais.forEach((f) => { URL.revokeObjectURL(f.url); if (f.urlTratada) URL.revokeObjectURL(f.urlTratada); });
        return regs.map(paraTela);
      });
      return regs;
    } catch {
      return [];
    }
  }, [guarda, paraTela]);
  const fichaId = ficha.id;
  useEffect(() => {
    guarda.faxina(fichaId).catch(() => {}).finally(() => recarregarFotos());
  }, [fichaId, guarda, recarregarFotos]);

  // ---------------- Fundo branco com o Foto IA (fila em paralelo) ----------------
  // Até 3 fotos ao mesmo tempo, enquanto você preenche as outras etapas. O
  // progresso (com a chave de cada foto) fica no aparelho: depois do F5 o
  // trabalho continua com a MESMA chave (sem cobrar de novo). Foto que falhou
  // só é repetida quando você pede.
  const filaRef = useRef(null);
  useEffect(() => {
    if (modoIA === "desligado" || !usuario?.id) {
      filaRef.current = null;
      return undefined;
    }
    let espera = null;
    const f = criarFilaFotoIA({
      guarda,
      executar: criarExecutorFotoIA({ supabase, usuarioId: usuario.id, enviarOriginalFotoIA, recortarFotoIA, comporFotoFinal }),
      aoMudar: () => {
        clearTimeout(espera);
        espera = setTimeout(() => recarregarFotos(), 150);
      },
    });
    filaRef.current = f;
    return () => {
      f.parar();
      clearTimeout(espera);
      if (filaRef.current === f) filaRef.current = null;
    };
  }, [modoIA, usuario?.id, guarda, recarregarFotos]);
  // muda quando entra foto nova ou uma foto foi trocada (tratamento zerado)
  const idsFotos = fotos.map((f) => f.id + (f.reg.ia ? "" : "*")).join(",");
  useEffect(() => {
    if (filaRef.current && idsFotos) filaRef.current.enfileirarNovas(fichaId).catch(() => {});
  }, [modoIA, usuario?.id, idsFotos, fichaId]);
  function trocarModoIA(m) {
    gravarModo(m);
    setModoIA(m);
  }
  async function repetirIA(id) {
    if (filaRef.current) await filaRef.current.repetir(fichaRef.current.id, id).catch(() => {});
    await recarregarFotos();
  }

  async function adicionarFotos(lista) {
    const arquivos = Array.from(lista || []).filter((a) => /^image\//.test(a.type || ""));
    if (!arquivos.length) return;
    try {
      const { guardadas, recusadas } = await guarda.adicionar(fichaRef.current.id, arquivos);
      await recarregarFotos();
      setAviso(`${guardadas.length} foto(s) guardada(s) neste aparelho e marcada(s) para o anúncio.${recusadas.length ? ` ${recusadas.length} não entrou(aram): ${[...new Set(recusadas.map((x) => x.motivo))].join("; ")}.` : ""}${modoIA !== "desligado" ? " O fundo branco começa agora; pode seguir para o código." : ""}`);
    } catch (e) {
      setAviso(`Não consegui guardar as fotos neste aparelho (${e?.message || e}).`);
    }
  }
  async function trocarFoto(id, arquivo) {
    if (!arquivo) return;
    try {
      await guarda.substituir(id, arquivo);
      await recarregarFotos();
      setAviso(`Foto trocada.${modoIA !== "desligado" ? " O fundo branco da nova foto começa agora." : ""}`);
    } catch (e) {
      setAviso(`Não consegui trocar a foto (${e?.message || e}).`);
    }
  }
  async function excluirFoto(id) {
    await guarda.remover(id).catch(() => {});
    await recarregarFotos();
  }
  // Mostra a escolha na hora; grava no aparelho em seguida.
  async function escolherVersao(id, versao) {
    setFotos((lista) => lista.map((f) => (f.id === id ? { ...f, versao: versao === "tratada" && f.urlTratada ? "tratada" : "original" } : f)));
    await guarda.escolherVersao(id, versao).catch(() => {});
  }
  async function marcarUso(id, usar) {
    setFotos((lista) => lista.map((f) => (f.id === id ? { ...f, usarNoAnuncio: usar } : f)));
    await guarda.marcarUso(id, usar).catch(() => {});
  }

  // ---------------- Navegação ----------------
  const irPara = useCallback((e) => {
    setConfirmandoEnvio(false);
    setAviso("");
    mudarFicha(irParaEtapa(fichaRef.current, e));
  }, [mudarFicha]);

  // ---------------- Código ----------------
  const consultarBase = useCallback(async (codigo) => {
    setConsultando(true);
    try {
      const res = await consultarBaseVoz(codigo, { buscarValidado: buscarConhecimentoValidado, pesquisarCatalogo });
      mudarFicha(registrarConsultaBase(fichaRef.current, res));
      if (res.encontrado) setAviso(`Encontrei o código na ${res.rotulo}. Veja as sugestões abaixo; você decide se aproveita.`);
      else setAviso("Não encontrei esse código na base PAIIA. Pode seguir normalmente.");
    } catch (e) {
      mudarFicha(registrarConsultaBase(fichaRef.current, { encontrado: false, erro: String(e?.message || e) }));
      setAviso("A consulta à base não respondeu agora. Pode seguir normalmente.");
    } finally {
      setConsultando(false);
    }
  }, [mudarFicha]);

  const definirCodigo = useCallback((codigo, { soletrado = false, duvidas = [] } = {}) => {
    const atual = codigoPrincipal(fichaRef.current);
    let base = fichaRef.current;
    if (atual && atual.normalizado !== String(codigo).replace(/[^0-9a-z]/gi, "").toUpperCase()) base = removerCodigo(base, atual.normalizado);
    const res = aplicarInterpretacao(base, { itens: [{ campo: "codigoPrincipal", valor: codigo, soletrado, duvidas }], naoEntendido: [], avisos: [] }, { origem: soletrado ? "voz" : "digitado", textoOriginal: `código: ${codigo}` });
    mudarFicha(res.ficha);
    setAviso(`Código ${codigo} anotado.${soletrado ? " Foi ditado: confira letra por letra." : ""} Consultando a base PAIIA…`);
    consultarBase(codigo);
  }, [consultarBase, mudarFicha]);

  function aproveitarBase() {
    const cp = codigoPrincipal(fichaRef.current);
    if (!cp) return;
    consultarBaseVoz(cp.codigo, { buscarValidado: buscarConhecimentoValidado, pesquisarCatalogo }).then((res) => {
      const inc = incorporarResultadoBase(fichaRef.current, res);
      let f = marcarBaseAproveitada(inc.ficha);
      const rr = estadoRapido(f);
      if (!rr.titulo.valor) {
        const sug = sugestoesTitulo(f)[0];
        if (sug) f = definirTitulo(f, sug, { origem: "base" });
      }
      mudarFicha(f);
      setAviso("Sugestões da base aproveitadas: confira o título e marque só as aplicações certas na Descrição.");
    });
  }

  async function lerCodigoNasFotos() {
    const primeira = fotos[0];
    if (!primeira) { setAviso("Tire ou escolha uma foto primeiro."); return; }
    setLendoFoto({ estado: "lendo", candidatos: [] });
    try {
      const texto = await lerTextoDaFoto(primeira.reg.blob, {});
      const candidatos = candidatosDeCodigo(texto);
      setLendoFoto({ estado: "ok", candidatos });
      setAviso(candidatos.length ? "Toque no código certo (e confira letra por letra)." : "Não consegui ler um código na foto. Fale ou digite.");
    } catch (e) {
      setLendoFoto({ estado: "erro", candidatos: [] });
      setAviso(`Leitura da foto indisponível agora (${e?.message || e}). Fale ou digite o código.`);
    }
  }

  // ---------------- Fala/digitação ----------------
  const tratarFala = useCallback((fala, origem = "voz") => {
    const t = String(fala || "").trim();
    if (!t) return;
    setAviso("");
    const f = fichaRef.current;
    const rr = estadoRapido(f);
    const nav = comandoNavegacao(t);
    if (nav) {
      if (rr.etapa === "enviar" && nav === "proximo") { setConfirmandoEnvio(true); return; }
      irPara(proximaEtapa(rr.etapa, nav === "proximo" ? 1 : -1));
      return;
    }
    if (rr.etapa === "fotos") {
      setAviso("Use “Foto da peça” ou “Da galeria”. Diga “próximo” para ir ao código.");
      return;
    }
    if (rr.etapa === "codigo") {
      const c = lerCodigoDaFala(t);
      if (c.pular) {
        let g = irParaEtapa(f, "titulo");
        g = { ...g, rapido: { ...estadoRapido(g), codigoPulado: true } };
        mudarFicha(g);
        setAviso("Tudo bem, seguimos sem código. O SKU pode ser preenchido no Novo Anúncio.");
        return;
      }
      if (c.erro) { setAviso(c.erro); return; }
      definirCodigo(c.codigo, { soletrado: c.soletrado && origem === "voz", duvidas: c.duvidas });
      return;
    }
    if (rr.etapa === "titulo") {
      const e = editarPorVoz(rr.titulo.valor, t, { padrao: "substituir", anterior: rr.titulo.anterior, campo: "titulo" });
      if (e.aviso) setAviso(e.aviso);
      // (22/10) Comando não entendido / fala de conversa: nada é alterado.
      if (!["nada", "nao-achou", "nao-entendeu", "nao-parece"].includes(e.acao)) {
        mudarFicha(definirTitulo(f, e.texto, { origem }));
        const av = avaliarTitulo(e.texto, f);
        const voltar = (e.acao === "substituir" || e.acao === "limpar") && rr.titulo.valor && rr.titulo.valor !== e.texto ? " Se não era isso, diga “desfaz”." : "";
        if (!e.aviso) setAviso((av.avisos.length ? av.avisos.join(" ") : `Título anotado (${e.texto.length}/${LIMITE_TITULO}). Diga “próximo” para a descrição.`) + voltar);
      }
      return;
    }
    if (rr.etapa === "descricao") {
      const e = editarPorVoz(rr.descricao.texto, t, { padrao: "acrescentar", separador: "\n", anterior: rr.descricao.anterior, campo: "descricao" });
      if (e.aviso) setAviso(e.aviso);
      if (["nada", "nao-achou", "nao-entendeu", "nao-parece"].includes(e.acao)) return;
      let g = definirTextoDescricao(f, e.texto);
      // Veículo dito na descrição vira aplicação "informada" (desmarcada): só entra se você conferir.
      if (e.acao === "acrescentar") {
        const ent = entenderTrecho(t, {});
        const v = ent.itens.find((i) => i.campo === "veiculo" && i.valor.modelos.length);
        const anos = ent.itens.find((i) => i.campo === "anos");
        if (v) {
          const c2 = JSON.parse(JSON.stringify(g));
          incluirAplicacao(c2, { texto: t, montadora: v.valor.montadora, modelos: v.valor.modelos, motores: v.valor.motores, anoInicio: anos?.valor.inicio || null, anoFim: anos?.valor.fim || null, tipoVeiculo: v.valor.tipo }, { origem: "usuario", agora: Date.now() });
          g = c2;
          setAviso("Anotei o veículo como aplicação “informada por você”. Marque-a abaixo se estiver certa.");
        }
      }
      mudarFicha(g);
      return;
    }
    if (rr.etapa === "enviar") setAviso("Toque em “Enviar ao Novo Anúncio” para conferir e confirmar.");
  }, [definirCodigo, irPara, mudarFicha]);

  // Microfone
  useEffect(() => {
    if (!suporta) return undefined;
    reconhecedorRef.current = criarReconhecedor({
      onParcial: (t) => setParcial(t),
      onFinal: (t) => { setParcial(""); tratarFala(t, "voz"); },
      onErro: (m) => { setErroVoz(m); setParcial(""); },
      onEstado: (v) => setOuvindo(v),
      manterLigado: manterMicPadrao(),
    });
    return () => reconhecedorRef.current?.parar();
  }, [suporta, tratarFala]);
  useEffect(() => {
    if (reconhecedorRef.current) reconhecedorRef.current.manterLigado = manterMic;
    try { localStorage.setItem(CHAVE_MANTER_MIC, manterMic ? "1" : "0"); } catch { /* sem localStorage */ }
  }, [manterMic]);
  const ligarMicrofone = useCallback(() => {
    setErroVoz("");
    if (!reconhecedorRef.current) { setErroVoz("Este navegador não reconhece voz. Use o Chrome ou digite."); return; }
    if (reconhecedorRef.current.ouvindo) reconhecedorRef.current.parar();
    else reconhecedorRef.current.iniciar();
  }, []);

  // Ação pedida pela página inicial (microfone/foto/digitar).
  useEffect(() => {
    const t = setTimeout(() => {
      const acao = consumirAcaoPaiiaVoz();
      if (acao === "microfone") ligarMicrofone();
      else if (acao === "foto") { if (estadoRapido(fichaRef.current).etapa !== "fotos") irPara("fotos"); try { fotoRef.current?.click(); } catch { /* precisa de toque */ } }
    }, 150);
    return () => clearTimeout(t);
  }, [ligarMicrofone, irPara]);

  function enviarDigitado(e) {
    e?.preventDefault?.();
    const t = entrada.trim();
    if (!t) return;
    setEntrada("");
    tratarFala(t, "digitado");
  }

  // ---------------- Enviar ----------------
  const fotosUsadas = fotos.filter((f) => f.usarNoAnuncio);
  const resumoFotosTela = resumoFotos(fotos.map((f) => f.reg));
  const validacao = useMemo(() => validarRapido(ficha, { fotos: fotosUsadas.length }), [ficha, fotosUsadas.length]);
  const organizada = useMemo(() => organizarDescricao(ficha), [ficha]);
  const pesoMedidas = useMemo(() => pesoMedidasParaEnvio(ficha), [ficha]);
  const avTitulo = useMemo(() => avaliarTitulo(estadoRapido(ficha).titulo.valor, ficha), [ficha]);
  const sugestoes = useMemo(() => sugestoesTitulo(ficha), [ficha]);

  async function enviarAoNovoAnuncio() {
    const f = fichaRef.current;
    const v = validarRapido(f, { fotos: fotosUsadas.length });
    if (!v.pronto) { setConfirmandoEnvio(false); setAviso(`Ainda falta: ${v.faltando.join(", ")}.`); return; }
    const { dados, complemento } = mapearRapidoParaNovoAnuncio(f);
    iniciarAnuncioNovo({ dados });
    try { localStorage.setItem(CHAVE_COMPLEMENTO_VOZ, JSON.stringify(complemento)); } catch { /* sem espaço */ }
    const regs = await guarda.listar(f.id).catch(() => []);
    const arquivos = regs.filter((x) => x.usarNoAnuncio).map((x) => guarda.arquivoEscolhido(x));
    globalThis.__paiiaVozFotosPendentes = arquivos.length ? { origem: dados.origemPaiiaVoz, arquivos } : null;
    const enviada = { ...f, enviadaEm: Date.now(), versao: (Number(f.versao) || 0) + 1 };
    fichaRef.current = enviada;
    guardarFichaVoz(enviada);
    setScreen?.("novoAnuncio");
  }

  async function novaFicha() {
    await guarda.limparFicha(fichaRef.current.id).catch(() => {});
    descartarFichaVoz();
    const f = criarFichaVoz();
    mudarFicha(f);
    setConfirmandoNova(false);
    setConfirmandoEnvio(false);
    setEditandoFinal(false);
    setLendoFoto({ estado: "", candidatos: [] });
    setAviso("Ficha nova.");
  }

  const cp = codigoPrincipal(ficha);
  const indice = ETAPAS.indexOf(etapa);

  return (
    <div className="pr" data-paiia-voz data-pr-etapa={etapa}>
      <style>{CSS_RAPIDO}</style>
      <div className="pr-topo">
        <button type="button" className="pr-voltar" onClick={() => setScreen?.("home")}>← Início</button>
        <h1>🎙️ PAIIA Voz</h1>
        <span className="pr-sub">Anúncio rápido · nada é publicado sem a sua conferência</span>
      </div>

      <nav className="pr-etapas" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <button key={e} type="button" className={`pr-etapa ${e === etapa ? "pr-atual" : ""} ${i < indice ? "pr-feita" : ""}`} onClick={() => irPara(e)} aria-current={e === etapa ? "step" : undefined} data-pr-ir={e}>
            <span>{i + 1}</span>{ROTULOS_ETAPAS[e]}
          </button>
        ))}
      </nav>

      <section className="pr-assistente" aria-live="polite">
        <div className="pr-mic-linha">
          <button type="button" className={`pr-mic ${ouvindo ? "pr-mic-ouvindo" : ""}`} onClick={ligarMicrofone} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar de ouvir" : "Falar"} data-pv-microfone>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a.9.9 0 1 0-1.8 0 4.2 4.2 0 0 1-8.4 0 .9.9 0 1 0-1.8 0 6 6 0 0 0 5.1 5.93V20H8.7a.9.9 0 1 0 0 1.8h6.6a.9.9 0 1 0 0-1.8h-2.4v-2.57A6 6 0 0 0 18 11.5Z" /></svg>
          </button>
          <div className="pr-pergunta">
            <span className="pr-quem">PAIIA</span>
            <p data-pr-pergunta>{PERGUNTAS[etapa]}</p>
            {parcial && <em className="pr-parcial">{parcial}</em>}
          </div>
        </div>
        {avisoVoz && <p className="pr-erro" role="status" data-pv-aviso-sem-voz>🎤 {avisoVoz}</p>}
        {!avisoVoz && <TesteMicrofone desligar={ouvindo} onAbrir={() => reconhecedorRef.current?.parar()} />}
        {suporta && (
          <label className="pr-check pr-manter" data-pv-manter-mic>
            <input type="checkbox" checked={manterMic} onChange={(e) => setManterMic(e.target.checked)} />
            Manter o microfone ligado entre as frases
          </label>
        )}
        {aviso && <p className="pr-aviso-geral" data-pr-aviso>{aviso}</p>}
        {erroVoz && <p className="pr-erro" role="alert">{erroVoz}</p>}
        {etapa !== "fotos" && etapa !== "enviar" && (
          <form className="pr-entrada" onSubmit={enviarDigitado}>
            <input value={entrada} onChange={(e) => setEntrada(e.target.value)} placeholder={etapa === "codigo" ? "Digite o código" : etapa === "titulo" ? "Digite o título ou um comando (troca … por …)" : "Digite uma informação da peça"} aria-label="Falar por texto" data-pr-entrada />
            <button type="submit" className="pr-botao">OK</button>
          </form>
        )}
      </section>

      {/* ---------------- 1 Fotos ---------------- */}
      {etapa === "fotos" && (
        <section className="pr-bloco" data-pr-bloco="fotos">
          <div className="pr-linha">
            <button type="button" className="pr-botao pr-claro" disabled={fotos.length >= MAX_FOTOS_POR_FICHA} onClick={() => fotoRef.current?.click()} data-pv-foto-botao>📷 Tirar foto</button>
            <button type="button" className="pr-botao pr-claro" disabled={fotos.length >= MAX_FOTOS_POR_FICHA} onClick={() => galeriaRef.current?.click()} data-pv-galeria-botao>🖼️ Galeria</button>
            <span className="pr-contador" data-pr-contador>{fotos.length} de {MAX_FOTOS_POR_FICHA}</span>
          </div>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ""; }} data-pv-foto-input />
          <input ref={galeriaRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ""; }} data-pv-galeria-input />
          <input ref={(el) => { trocarRef.current.input = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { trocarFoto(trocarRef.current.id, e.target.files?.[0]); e.target.value = ""; }} data-pr-trocar-input />
          <div className="pr-fotos">
            {fotos.map((f, i) => (
              <div key={f.id} className="pr-foto" data-pv-foto data-pr-versao={f.versao}>
                <img src={f.versao === "tratada" && f.urlTratada ? f.urlTratada : f.url} alt={`Foto ${i + 1}`} />
                <div className="pr-versoes" role="radiogroup" aria-label="Versão da foto">
                  <label className="pr-check"><input type="radio" name={`v-${f.id}`} checked={f.versao === "original"} onChange={() => escolherVersao(f.id, "original")} data-pr-original /> Original</label>
                  <label className="pr-check"><input type="radio" name={`v-${f.id}`} checked={f.versao === "tratada"} disabled={!f.tratada?.aplicavel} onChange={() => escolherVersao(f.id, "tratada")} data-pr-tratada /> Fundo branco</label>
                </div>
                <EstadoFotoIA f={f} modoIA={modoIA} onRepetir={() => repetirIA(f.id)} />
                {f.urlTratada && f.versao === "original" && <img className="pr-mini" src={f.urlTratada} alt="Prévia com fundo branco" />}
                <label className="pr-check"><input type="checkbox" checked={f.usarNoAnuncio} onChange={(e) => marcarUso(f.id, e.target.checked)} /> usar no anúncio</label>
                <div className="pr-linha">
                  <button type="button" className="pr-link" onClick={() => { trocarRef.current.id = f.id; trocarRef.current.input?.click(); }} data-pr-trocar>Trocar</button>
                  <button type="button" className="pr-link pr-perigo" onClick={() => excluirFoto(f.id)} data-pv-remover-foto>Excluir</button>
                </div>
              </div>
            ))}
          </div>
          {!fotos.length && <p className="pr-vazio">Nenhuma foto ainda. Você também pode continuar e adicionar as fotos no Novo Anúncio.</p>}
          <div className="pr-cartao pr-cinza" data-pr-modo-ia={modoIA}>
            <strong>Fundo branco com o Foto IA</strong>
            {modosDisponiveis(ambienteIA).map((m) => (
              <label key={m} className="pr-check">
                <input type="radio" name="modo-ia" checked={modoIA === m} onChange={() => trocarModoIA(m)} data-pr-modo-ia-opcao={m} />
                {m === "desligado" ? "Desligado (só a foto original)" : m === "simulacao" ? "Simulação de teste — gratuita, sem Replicate" : "Real — Foto IA oficial (conta no limite de 50 por mês)"}
              </label>
            ))}
            {!modosDisponiveis(ambienteIA).includes("real") && <p className="pr-fonte">Tratamento real (Foto IA oficial, Replicate/Recraft, pago): desligado — aguardando sua autorização.</p>}
            {modoIA !== "desligado" && !usuario?.id && <p className="pr-aviso">⚠️ Entre na sua conta para tratar as fotos.</p>}
          </div>
          <p className="pr-dica">Todas as fotos vão para o anúncio na versão escolhida. A original fica sempre guardada; o fundo branco é preparado enquanto você preenche código, título e descrição.</p>
          <div className="pr-nav"><span /><button type="button" className="pr-botao" onClick={() => irPara("codigo")} data-pr-continuar>Continuar →</button></div>
        </section>
      )}

      {/* ---------------- 2 Código ---------------- */}
      {etapa === "codigo" && (
        <section className="pr-bloco" data-pr-bloco="codigo">
          <label className="pr-rotulo" htmlFor="pr-codigo">Código da peça (SKU)</label>
          <CampoTexto id="pr-codigo" valor={cp?.codigo || ""} onSalvar={(v) => { const c = lerCodigoDaFala(v); if (c.codigo) definirCodigo(c.codigo); else if (c.erro) setAviso(c.erro); }} data="codigo" />
          {cp && cp.conferido === false && (
            <label className="pr-check"><input type="checkbox" onChange={(e) => mudarFicha(conferirCodigo(fichaRef.current, cp.normalizado, e.target.checked))} /> Conferi o código letra por letra</label>
          )}
          {fotos.length > 0 && (
            <div className="pr-linha">
              <button type="button" className="pr-link" onClick={lerCodigoNasFotos} disabled={lendoFoto.estado === "lendo"}>{lendoFoto.estado === "lendo" ? "Lendo a foto…" : "Ler código na foto (beta)"}</button>
              {lendoFoto.candidatos.map((c) => <button key={c} type="button" className="pr-chip" onClick={() => definirCodigo(c, { soletrado: true })}>{c}</button>)}
            </div>
          )}
          {consultando && <p className="pr-vazio">Consultando a base PAIIA…</p>}
          {r.base?.estado === "encontrado" && (
            <div className="pr-cartao" data-pr-base="encontrado">
              <strong>Encontrado na {r.base.rotulo}</strong>
              {r.base.descricao && <p>Peça: {r.base.descricao}</p>}
              <p>{r.base.aplicacoes} aplicação(ões) com fonte · {r.base.codigos.length} código(s) de referência</p>
              {r.base.aproveitado
                ? <p className="pr-ok">✓ Sugestões aproveitadas (as aplicações entram desmarcadas para você conferir).</p>
                : <button type="button" className="pr-botao" onClick={aproveitarBase} data-pr-aproveitar>Aproveitar sugestões</button>}
            </div>
          )}
          {r.base?.estado === "nada" && <p className="pr-vazio" data-pr-base="nada">Não encontrado na base PAIIA. Pode seguir normalmente.</p>}
          <div className="pr-cartao pr-cinza" data-pr-internet>
            <strong>Pesquisa na internet</strong>
            <p>Desligada nesta versão de teste: precisa da sua autorização (fonte e custo estão no relatório).</p>
          </div>
          <div className="pr-nav">
            <button type="button" className="pr-link" onClick={() => irPara("fotos")}>← Fotos</button>
            <button type="button" className="pr-botao" onClick={() => irPara("titulo")} data-pr-continuar>Continuar →</button>
          </div>
        </section>
      )}

      {/* ---------------- 3 Título ---------------- */}
      {etapa === "titulo" && (
        <section className="pr-bloco" data-pr-bloco="titulo">
          <label className="pr-rotulo" htmlFor="pr-titulo">Título ({r.titulo.valor.length}/{LIMITE_TITULO})</label>
          <AreaTexto id="pr-titulo" valor={r.titulo.valor} onSalvar={(v) => mudarFicha(definirTitulo(fichaRef.current, v.replace(/\s*\n+\s*/g, " "), { origem: "digitado" }))} data="titulo" linhas={2} umaLinha erro={r.titulo.valor.length > LIMITE_TITULO} />
          {avTitulo.avisos.filter((a) => !/^Falta/.test(a)).map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
          <div className="pr-linha">
            {r.titulo.valor && <button type="button" className="pr-link" onClick={() => mudarFicha(definirTitulo(fichaRef.current, ajustarTitulo(r.titulo.valor, fichaRef.current), { origem: "ajuste" }))} data-pr-ajustar>Ajustar ao padrão</button>}
            {r.titulo.anterior !== null && r.titulo.anterior !== r.titulo.valor && <button type="button" className="pr-link" onClick={() => mudarFicha(definirTitulo(fichaRef.current, r.titulo.anterior || "", { origem: "desfazer" }))}>Desfazer</button>}
          </div>
          {sugestoes.length > 0 && (
            <div className="pr-sugestoes">
              <span className="pr-rotulo">Sugestões (toque para usar)</span>
              {sugestoes.map((s) => <button key={s} type="button" className="pr-chip" onClick={() => mudarFicha(definirTitulo(fichaRef.current, s, { origem: "sugestao" }))} data-pr-sugestao>{s}</button>)}
            </div>
          )}
          <div className="pr-nav">
            <button type="button" className="pr-link" onClick={() => irPara("codigo")}>← Código</button>
            <button type="button" className="pr-botao" onClick={() => irPara("descricao")} data-pr-continuar>Continuar →</button>
          </div>
        </section>
      )}

      {/* ---------------- 4 Descrição ---------------- */}
      {etapa === "descricao" && (
        <section className="pr-bloco" data-pr-bloco="descricao">
          <label className="pr-rotulo" htmlFor="pr-desc">O que você falou ou digitou (uma informação por linha)</label>
          <AreaTexto id="pr-desc" valor={r.descricao.texto} onSalvar={(v) => mudarFicha(definirTextoDescricao(fichaRef.current, v))} data="descricao-texto" />
          {organizada.avisos.map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
          {organizada.medidas.length > 0 && (
            <div className="pr-cartao pr-cinza" data-pr-medidas>
              <strong>Para os campos da plataforma (não vão na descrição)</strong>
              {organizada.medidas.map((m) => <p key={m}>{m}</p>)}
              {pesoMedidas ? (
                <p data-pr-peso-medidas-envio>➡️ Vai para os Dados técnicos do Novo Anúncio (só nos campos vazios), para você conferir: <b>{pesoMedidas.texto}</b>{pesoMedidas.duvidas.length ? <span style={{ display: "block", color: "#fde68a" }}>⚠ {pesoMedidas.duvidas.join(" ")}</span> : null}</p>
              ) : <p className="pr-vazio">Não entendi peso ou medidas da embalagem aqui (ex.: “peso 350 gramas”, “medidas 20 por 10 por 10”).</p>}
            </div>
          )}
          <span className="pr-rotulo">Aplicações (marque só as certas)</span>
          {!ficha.aplicacoes.length && <p className="pr-vazio">Nenhuma aplicação. Pode falar o veículo (ex.: “serve no ônibus Neobus Mega Plus 2013 e 2014”) ou deixar para a Conferência.</p>}
          <ul className="pr-lista">
            {ficha.aplicacoes.map((a) => (
              <li key={a.id} data-pv-aplicacao={a.chave}>
                <label className="pr-check">
                  <input type="checkbox" checked={a.confirmada} onChange={(e) => mudarFicha(confirmarAplicacao(fichaRef.current, a.id, e.target.checked))} data-pv-confirmar-aplicacao />
                  <span>{[a.tipoVeiculo, a.montadora].filter(Boolean).join(" ")}{a.tipoVeiculo || a.montadora ? " · " : ""}{resumoAplicacao(a)}</span>
                </label>
                <span className="pr-fonte">{a.origem === "usuario" ? "informada por você" : (a.fontes || []).join(" · ")}</span>
                <button type="button" className="pr-link pr-perigo" onClick={() => mudarFicha(removerAplicacao(fichaRef.current, a.id))}>remover</button>
              </li>
            ))}
          </ul>
          <div className="pr-linha pr-entre">
            <span className="pr-rotulo">Descrição organizada {r.descricao.final !== null ? "(editada à mão)" : "(automática)"}</span>
            {r.descricao.final === null
              ? <button type="button" className="pr-link" onClick={() => { mudarFicha(definirDescricaoFinal(fichaRef.current, organizada.texto)); setEditandoFinal(true); }} data-pr-editar-final>Editar texto final</button>
              : <button type="button" className="pr-link" onClick={() => { mudarFicha(definirDescricaoFinal(fichaRef.current, null)); setEditandoFinal(false); }}>Voltar ao automático</button>}
          </div>
          {r.descricao.final !== null && editandoFinal
            ? <AreaTexto id="pr-final" valor={r.descricao.final} onSalvar={(v) => mudarFicha(definirDescricaoFinal(fichaRef.current, v))} data="descricao-final" linhas={14} />
            : <pre className="pr-previa" data-pr-descricao>{descricaoParaEnvio(ficha)}</pre>}
          <div className="pr-nav">
            <button type="button" className="pr-link" onClick={() => irPara("titulo")}>← Título</button>
            <button type="button" className="pr-botao" onClick={() => irPara("enviar")} data-pr-continuar>Continuar →</button>
          </div>
        </section>
      )}

      {/* ---------------- 5 Enviar ---------------- */}
      {etapa === "enviar" && (
        <section className="pr-bloco" data-pr-bloco="enviar">
          <span className="pr-rotulo">Fotos que vão para o Novo Anúncio</span>
          <div className="pr-envio-fotos" data-pr-envio-fotos>
            {fotos.map((f, i) => (
              <div key={f.id} className={`pr-envio-foto ${f.usarNoAnuncio ? "" : "pr-fora"}`} data-pr-envio-foto={f.usarNoAnuncio ? (f.versao === "tratada" ? "fundo-branco" : "original") : "fora"}>
                <img src={f.versao === "tratada" && f.urlTratada ? f.urlTratada : f.url} alt={`Foto ${i + 1}`} />
                <div>
                  <strong>{i + 1}. {f.usarNoAnuncio ? (f.versao === "tratada" ? "Fundo branco" : "Original") : "Não vai ao anúncio"}</strong>
                  <EstadoFotoIA f={f} modoIA={modoIA} onRepetir={() => repetirIA(f.id)} curto />
                  {f.tratada?.aplicavel && f.usarNoAnuncio && f.versao !== "tratada" && <button type="button" className="pr-link" onClick={() => escolherVersao(f.id, "tratada")} data-pr-usar-tratada>Usar fundo branco</button>}
                  {f.versao === "tratada" && <button type="button" className="pr-link" onClick={() => escolherVersao(f.id, "original")}>Usar original</button>}
                </div>
              </div>
            ))}
            {!fotos.length && <p className="pr-vazio">Nenhuma foto: adicione no Novo Anúncio.</p>}
          </div>
          {resumoFotosTela.interrompidas > 0 && <p className="pr-aviso" data-pr-aviso-interrompidas>⏸ {resumoFotosTela.interrompidas} foto(s) com o fundo branco interrompido. Toque em “Retomar” na foto, ou envie com a original.</p>}
          {resumoFotosTela.tratando > 0 && <p className="pr-aviso" data-pr-aviso-tratando>⏳ {resumoFotosTela.tratando} foto(s) ainda em tratamento. Se enviar agora, elas vão como original (você pode aguardar).</p>}
          <dl className="pr-resumo">
            <dt>Fotos</dt><dd data-pr-resumo-fotos>{fotosUsadas.length} ({fotosUsadas.filter((f) => f.versao === "tratada").length} com fundo branco)</dd>
            <dt>Código</dt><dd>{cp?.codigo || "— (preencher no Novo Anúncio)"}</dd>
            <dt>Título</dt><dd data-pr-resumo-titulo>{r.titulo.valor || "—"} <small>({r.titulo.valor.length}/{LIMITE_TITULO})</small></dd>
            <dt>Aplicações conferidas</dt><dd>{ficha.aplicacoes.filter((a) => a.confirmada).length}</dd>
            <dt>Peso/medidas</dt><dd data-pr-resumo-peso-medidas>{pesoMedidas ? `${pesoMedidas.texto} (conferir no Novo Anúncio)` : "— (preencher no Novo Anúncio)"}</dd>
          </dl>
          <pre className="pr-previa">{descricaoParaEnvio(ficha)}</pre>
          {validacao.faltando.length > 0 && <p className="pr-falta" data-pr-faltando>Para enviar falta: {validacao.faltando.join(", ")}.</p>}
          {validacao.avisos.map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
          {!usuario && <p className="pr-aviso">⚠️ Entre na sua conta para o Novo Anúncio salvar o anúncio e as fotos.</p>}
          {confirmandoEnvio ? (
            <div className="pr-cartao" data-pv-confirmacao-envio>
              <p>O Novo Anúncio será aberto com código, título, descrição e as fotos marcadas. Lá você confere tudo (SKU, fotos, compatibilidade, peso, medidas, frete, preço, estoque e duplicidade) e aprova antes de qualquer publicação.</p>
              <button type="button" className="pr-botao" onClick={enviarAoNovoAnuncio} data-pv-confirmar-envio>Abrir no Novo Anúncio</button>
              <button type="button" className="pr-link" onClick={() => setConfirmandoEnvio(false)}>Voltar</button>
            </div>
          ) : (
            <button type="button" className="pr-botao pr-grande" disabled={!validacao.pronto} onClick={() => setConfirmandoEnvio(true)} data-pv-enviar-novo>➡️ Enviar ao Novo Anúncio</button>
          )}
          <div className="pr-nav"><button type="button" className="pr-link" onClick={() => irPara("descricao")}>← Descrição</button><span /></div>
        </section>
      )}

      <div className="pr-rodape">
        {confirmandoNova ? (
          <span>Apagar esta ficha e as fotos deste aparelho? <button type="button" className="pr-link pr-perigo" onClick={novaFicha} data-pv-nova-sim>Sim, começar outra</button> <button type="button" className="pr-link" onClick={() => setConfirmandoNova(false)}>Não</button></span>
        ) : (
          <button type="button" className="pr-link" onClick={() => setConfirmandoNova(true)} data-pv-nova>Nova ficha</button>
        )}
        {onModoConversa && <button type="button" className="pr-link" onClick={onModoConversa} data-pr-modo-conversa>Modo conversa (anterior)</button>}
      </div>
    </div>
  );
}

/** Estado do Foto IA de uma foto (na fila, tratando, pronta, falhou + tentar de novo). */
function EstadoFotoIA({ f, modoIA, onRepetir, curto = false }) {
  const ia = f.ia || {};
  if (!ia.estado) {
    return <span className="pr-status" data-pr-status="sem">{modoIA === "desligado" ? "Fundo branco: desligado" : "Fundo branco: aguardando"}</span>;
  }
  if (ia.estado === "pronta") return <span className="pr-status pr-ok" data-pr-status="pronta">✓ Fundo branco pronto{modoIA === "simulacao" || f.tratada?.origem === "fotoIA" ? "" : ""}{curto ? "" : " — compare e escolha"}</span>;
  if (ia.estado === "interrompida") {
    return (
      <span className="pr-status pr-falhou" data-pr-status="interrompida">
        ⏸ Fundo branco interrompido ao atualizar a página.{" "}
        {modoIA !== "desligado" && <button type="button" className="pr-link" onClick={onRepetir} data-pr-retomar>Retomar</button>}
        {!curto && <span className="pr-fonte"> Não recomeça sozinho{modoIA === "real" ? " (no modo real o provedor pode cobrar de novo)" : ""}. A original continua valendo.</span>}
      </span>
    );
  }
  if (ia.estado === "falhou") {
    return (
      <span className="pr-status pr-falhou" data-pr-status="falhou">
        ✗ Fundo branco falhou: {ia.erro || "erro"}{" "}
        {modoIA !== "desligado" && <button type="button" className="pr-link" onClick={onRepetir} data-pr-repetir>Tentar de novo</button>}
        {!curto && <span className="pr-fonte"> A original continua valendo.</span>}
      </span>
    );
  }
  return (
    <span className="pr-status" data-pr-status="tratando">
      ⏳ {modoIA === "desligado" && ia.estado === "na-fila" ? "Fundo branco pausado (desligado)" : `Fundo branco: ${ia.rotulo}${ia.tentativa > 1 ? ` (tentativa ${ia.tentativa})` : ""}…`}
    </span>
  );
}

/** Campo de uma linha: edita livre e salva ao sair (Enter também). */
function CampoTexto({ id, valor, onSalvar, data, erro = false }) {
  const [texto, setTexto] = useState(valor);
  const [focado, setFocado] = useState(false);
  const mostrado = focado ? texto : valor;
  return (
    <input
      id={id}
      className={`pr-campo ${erro ? "pr-campo-erro" : ""}`}
      value={mostrado}
      onFocus={() => { setTexto(valor); setFocado(true); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { setFocado(false); if (texto !== valor) onSalvar(texto); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      data-pr-campo={data}
    />
  );
}

function AreaTexto({ id, valor, onSalvar, data, linhas = 5, umaLinha = false, erro = false }) {
  const [texto, setTexto] = useState(valor);
  const [focado, setFocado] = useState(false);
  return (
    <textarea
      id={id}
      className={`pr-campo ${erro ? "pr-campo-erro" : ""}`}
      rows={linhas}
      onKeyDown={umaLinha ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
      value={focado ? texto : valor}
      onFocus={() => { setTexto(valor); setFocado(true); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { setFocado(false); if (texto !== valor) onSalvar(texto); }}
      data-pr-campo={data}
    />
  );
}

const CSS_RAPIDO = `
.pr { max-width: 760px; margin: 0 auto 40px; text-align: left; color: #e2e8f0; }
.pr *, .pr *::before, .pr *::after { box-sizing: border-box; }
.pr-topo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pr-topo h1 { margin: 0; font-size: 22px !important; color: #fff; }
.pr-sub { color: #94a3b8; font-size: 13px; }
.pr-voltar { padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; cursor: pointer; font-weight: 700; }
.pr-etapas { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
.pr-etapa { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; border-radius: 10px; border: 1px solid #1e293b; background: #0b1220; color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; min-width: 0; }
.pr-etapa span { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #1e293b; color: #e2e8f0; font-size: 12px; }
.pr-atual { border-color: #22d3ee; color: #fff; background: #082f49; }
.pr-atual span { background: #0891b2; }
.pr-feita span { background: #15803d; }
.pr-assistente { position: sticky; top: 0; z-index: 5; padding: 10px; border-radius: 14px; background: linear-gradient(145deg, #0f172a, #082f49); border: 1px solid rgba(56,189,248,.35); margin-bottom: 10px; }
.pr-mic-linha { display: flex; gap: 10px; align-items: center; }
.pr-mic { width: 60px; height: 60px; flex: none; border-radius: 50%; border: 0; cursor: pointer; color: #fff; display: grid; place-items: center; background: radial-gradient(circle at 30% 25%, #22d3ee, #0284c7 55%, #1d4ed8); box-shadow: 0 8px 20px rgba(14,165,233,.4); }
.pr-mic-ouvindo { background: radial-gradient(circle at 30% 25%, #f87171, #dc2626 60%, #991b1b); box-shadow: 0 0 0 7px rgba(248,113,113,.2); }
.pr-pergunta { min-width: 0; }
.pr-pergunta p { margin: 2px 0 0; color: #f1f5f9; font-size: 15px; line-height: 1.4; }
.pr-quem { color: #67e8f9; font-size: 11px; font-weight: 800; letter-spacing: .6px; }
.pr-parcial { display: block; color: #a5f3fc; font-size: 13px; margin-top: 4px; }
.pr-aviso-geral { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: #0f172a; border: 1px solid #1e293b; font-size: 14px; color: #e2e8f0; }
.pr-erro { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: rgba(127,29,29,.35); border: 1px solid #f87171; color: #fecaca; font-size: 14px; }
.pr-entrada { display: flex; gap: 6px; margin-top: 8px; }
.pr-entrada input { flex: 1; min-width: 0; }
.pr input[type="text"], .pr-entrada input, .pr-campo { padding: 10px 12px; border-radius: 10px; border: 1px solid #334155; background: #020617; color: #f8fafc; font-size: 16px; width: 100%; font-family: inherit; }
.pr-entrada input { width: auto !important; }
.pr-campo-erro { border-color: #f87171; }
.pr-bloco { padding: 12px; border-radius: 14px; border: 1px solid #1e293b; background: #0b1220; display: flex; flex-direction: column; gap: 10px; }
.pr-linha { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pr-entre { justify-content: space-between; }
.pr-botao { padding: 10px 16px; border-radius: 10px; border: 0; background: linear-gradient(90deg, #2563eb, #0891b2); color: #fff; font-weight: 800; font-size: 15px; cursor: pointer; }
.pr-botao:disabled { opacity: .45; cursor: not-allowed; }
.pr-claro { background: #0f172a; border: 1px solid #334155; }
.pr-grande { width: 100%; padding: 14px; font-size: 17px; }
.pr-link { background: none; border: 0; color: #67e8f9; font-weight: 700; cursor: pointer; padding: 6px 4px; font-size: 14px; }
.pr-perigo { color: #fca5a5; }
.pr-chip { padding: 6px 10px; border-radius: 999px; border: 1px solid #0e7490; background: #083344; color: #cffafe; font-size: 13px; cursor: pointer; text-align: left; }
.pr-contador { color: #94a3b8; font-size: 13px; margin-left: auto; }
.pr-fotos { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.pr-foto { display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 12px; border: 1px solid #1e293b; background: #0f172a; min-width: 0; }
.pr-foto img { width: 100%; aspect-ratio: 1; object-fit: contain; background: #fff; border-radius: 8px; }
.pr-foto .pr-mini { width: 48px; height: 48px; aspect-ratio: auto; border: 1px solid #334155; }
.pr-versoes { display: flex; flex-direction: column; gap: 2px; }
.pr-status { font-size: 12px; color: #94a3b8; overflow-wrap: anywhere; }
.pr-falhou { color: #fca5a5; }
.pr-envio-fotos { display: flex; flex-direction: column; gap: 8px; }
.pr-envio-foto { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px; border-radius: 10px; border: 1px solid #1e293b; }
.pr-envio-foto img { width: 64px; height: 64px; object-fit: contain; background: #fff; border-radius: 8px; }
.pr-envio-foto div { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; }
.pr-fora { opacity: .5; }
.pr-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #cbd5e1; cursor: pointer; }
.pr input[type="checkbox"], .pr input[type="radio"] { width: 18px !important; min-width: 18px !important; height: 18px; flex: none; accent-color: #22c55e; }
.pr-manter { margin-top: 6px; white-space: normal; align-items: flex-start; }
.pr-rotulo { color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
.pr-vazio, .pr-dica { color: #94a3b8; font-size: 13px; margin: 0; }
.pr-aviso { color: #fde68a !important; font-size: 13px; margin: 0; }
.pr-falta { color: #fca5a5; font-weight: 700; margin: 0; }
.pr-ok { color: #86efac; margin: 0; }
.pr-cartao { padding: 10px; border-radius: 12px; border: 1px solid #0e7490; background: #082f49; display: flex; flex-direction: column; gap: 6px; }
.pr-cartao p { margin: 0; font-size: 14px; }
.pr-cinza { border-color: #334155; background: #0f172a; }
.pr-sugestoes { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.pr-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pr-lista li { padding: 8px; border-radius: 10px; border: 1px solid #1e293b; display: flex; flex-direction: column; gap: 2px; }
.pr-fonte { color: #94a3b8; font-size: 12px; }
.pr-previa { margin: 0; padding: 10px; border-radius: 10px; background: #020617; border: 1px solid #1e293b; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; font-size: 14px; color: #e2e8f0; max-height: 360px; overflow-y: auto; }
.pr-resumo { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 0; font-size: 14px; }
.pr-resumo dt { color: #94a3b8; }
.pr-resumo dd { margin: 0; overflow-wrap: anywhere; }
.pr-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.pr-rodape { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-bottom: 32px; color: #94a3b8; font-size: 13px; }
@media (max-width: 480px) { .pr-topo h1 { font-size: 19px !important; } .pr-sub { display: none; } }
`;
