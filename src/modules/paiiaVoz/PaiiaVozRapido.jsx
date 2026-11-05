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
  listarFichasGuardadas,
  guardarNaListaVoz,
  retirarDaListaVoz,
  fichaVazia,
  aplicarInterpretacao,
  incorporarResultadoBase,
  conferirCodigo,
  removerCodigo,
  confirmarAplicacao,
  removerAplicacao,
  editarAplicacao,
  textoAplicacao,
  codigoPrincipal,
  codigosAdicionais,
  codigosParaDescricao,
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
import { criarExecutorFotoIA, criarExecutorSimulado, criarFilaFotoIA, lerModo, gravarModo, modosDisponiveis, situacaoIA, resumoFotos } from "./servicos/fotoIAVoz";
// (31/10/2026) Ficha na conta: fotos e dados do Voz na MESMA ficha do Novo Anúncio (celular ⇄ computador).
import { sincronizarFichaVoz, garantirOriginalNaNuvem } from "./servicos/fichaVozNuvem";
import { decidirPassoFinal, enderecoPublicacaoDaFicha } from "./servicos/passoFinalVoz";
import { situacaoEnvioFotos } from "./servicos/fichaVozNuvem"; // (03/11) aviso das fotos em segundo plano
// (02/11/2026) Etapa 1: ficha completa (marca, estoque, tipo, peso/medidas, aplicações) direto do Voz.
import { dadosCompletosVoz, camposDitosNaFala } from "./servicos/fichaCompletaVoz";
// (02/11/2026) Etapa 2: conferências oficiais (só leitura) direto do Voz.
// (03/11/2026) Pacote C: conversa “Completar a ficha” (só o que falta) na etapa final.
import CompletarVoz from "./CompletarVoz";
import { camposDaFicha, CAMPOS_DIRETOS, valoresCamposDiretos, definirCampoDireto, proximoCampoDireto, usarDadosDoBling, camposDaEtapa, definirTipoVeiculoVoz, estadoEtapasVoz, situacaoAplicacao } from "./servicos/completarVoz";
import { TIPO_CARRO, TIPO_PESADA } from "../../services/tipoVeiculoAnuncio";
import FinalizarAnuncioVoz from "./FinalizarAnuncioVoz";
import CategoriaVoz from "./CategoriaVoz";
import { excluirFichaDefinitivamente } from "../../services/exclusaoFichaService";
import { descartarRascunhoLocalDaFicha } from "../../services/exclusaoFicha";
import { CHAVE_ANUNCIO_EM_ANDAMENTO, CHAVES_ANUNCIO_LOCAL } from "../../services/fichasCentral";
import { proximaPerguntaCompletar, responderCompletar, aberturaCompletar, fimCompletar, estadoCompletar, registrarConferencia, anotarFalaPaiia } from "./servicos/completarVoz";
import { prepararEGravar, definirModalidadeEGravar, confirmarCategoriaEGravar } from "./servicos/preparoVozService";
import { montarRevisao } from "./servicos/revisaoCelularVoz";
import { useContasML, contasMLConectadas } from "../../services/contaMLAtiva";
import { nomeDaLoja } from "../../services/duplicidadeML";
import { salvarFichaNovoAnuncio, lerFichaNovoAnuncio } from "../../services/fichaNovoAnuncioService";
import { rascunhoDaFicha } from "../../services/fichaNovoAnuncio";
// Foto IA OFICIAL, sem alteração (mesmas funções da tela Foto IA):
import { enviarOriginalFotoIA, recortarFotoIA } from "../../services/fotoIA/pipelineFotoIA";
import { comporFotoFinal } from "../../services/fotoIA/composicaoFotoIA";
import { supabase } from "../../supabase";
import GaleriaSeletor from "../../components/fotos/GaleriaSeletor";
import { baixarFotoGaleria, vagasFotos } from "./servicos/galeriaVoz";
import { consumirAcaoPaiiaVoz } from "./servicos/acaoInicial";
import { iniciarAnuncioNovo, abrirFichaNoNovoAnuncio } from "../../services/aberturaNovoAnuncio";
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

// (04/11) Assinatura dos dados completos (custo, peso, medidas, aplicações) para salvar na conta quando mudarem.
function marcaCompletos(ficha) {
  try { const c = dadosCompletosVoz(ficha, { fotos: 1 }); return JSON.stringify([c.custo || "", c.medida || null, c.aplicacoes || [], c.tipoVeiculo || ""]); } catch { return ""; } // (05/11) conteúdo das aplicações, não só a quantidade (corrigida também salva)
}

export default function PaiiaVozRapido({ setScreen, usuario, onModoConversa }) {
  const [ficha, setFicha] = useState(() => lerFichaVoz() || criarFichaVoz());
  const [aviso, setAviso] = useState("");
  const [parcial, setParcial] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [erroVoz, setErroVoz] = useState("");
  const [fotos, setFotos] = useState([]);
  const [consultando, setConsultando] = useState(false);
  const [lendoFoto, setLendoFoto] = useState({ estado: "", candidatos: [] });
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [confirmandoNova, setConfirmandoNova] = useState(false);
  const [editandoFinal, setEditandoFinal] = useState(false);
  const [manterMic, setManterMic] = useState(manterMicPadrao);
  const [ouvidoCodigo, setOuvidoCodigo] = useState(null);
  // (04/11) Campo tocado para ditar (Marca, Preço, Estoque, Peso, Medidas): o texto aparece nele enquanto você fala.
  const [campoVoz, setCampoVozEstado] = useState("");
  const [editandoAp, setEditandoAp] = useState(""); // (05/11) aplicação em correção
  const [lendoBlingVoz, setLendoBlingVoz] = useState(false);
  const campoVozRef = useRef("");
  const setCampoVoz = useCallback((id) => { campoVozRef.current = id; setCampoVozEstado(id); }, []); // (03/11) o que o celular ouviu no código (diagnóstico)
  const fichaRef = useRef(ficha);
  const reconhecedorRef = useRef(null);
  const fotoRef = useRef(null);
  const [galeriaAberta, setGaleriaAberta] = useState(false); // (06/11) Galeria interna do PAIIA (fotos da conta)
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

  const mudarFicha = useCallback((nova0) => {
    // (31/10/2026) o vínculo com a ficha da conta nunca se perde (evita criar outra ficha)
    const ant = fichaRef.current;
    const nova = nova0 && ant?.fichaIdPAIIA && !nova0.fichaIdPAIIA && nova0.id === ant.id ? { ...nova0, fichaIdPAIIA: ant.fichaIdPAIIA } : nova0;
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

  // ---------------- Ficha na conta (celular ⇄ computador) ----------------
  // Cada mudança (código, título, descrição, fotos, fundo branco pronto) vai
  // para a MESMA ficha do Novo Anúncio. Uma gravação por vez; se algo mudar
  // durante a gravação, grava de novo no fim. Falha não apaga nada.
  const [nuvem, setNuvem] = useState({ estado: "", texto: "" });
  const [versaoNuvem, setVersaoNuvem] = useState(0); // (05/11) muda a cada gravação na conta: a Finalizar relê a ficha
  const depsNuvem = useMemo(() => ({
    usuarioId: usuario?.id || "",
    guarda,
    enviarOriginal: (reg) => enviarOriginalFotoIA({ supabase, usuarioId: usuario?.id, arquivo: guarda.comoArquivo(reg) }),
    enviarTratada: async (reg) => {
      const caminho = `${usuario?.id}/prontas/1200x1200-voz-${reg.id}-${Date.now()}.png`;
      const { error } = await supabase.storage.from("imagens").upload(caminho, reg.tratada.blob, { upsert: false, contentType: reg.tratada.blob.type || "image/png" });
      if (error) throw new Error(error.message || "falha no envio da foto com fundo branco");
      const { data } = supabase.storage.from("imagens").getPublicUrl(caminho);
      if (!data?.publicUrl) throw new Error("sem endereço público");
      return { caminho, url: data.publicUrl };
    },
    lerFicha: lerFichaNovoAnuncio,
    salvarFicha: salvarFichaNovoAnuncio,
  }), [usuario?.id, guarda]);
  const depsNuvemRef = useRef(depsNuvem);
  useEffect(() => { depsNuvemRef.current = depsNuvem; }, [depsNuvem]);
  const sincRef = useRef({ rodando: false, deNovo: false });
  const sincronizar = useCallback(async () => {
    const st = sincRef.current;
    if (st.rodando) { st.deNovo = true; return null; }
    const f = fichaRef.current;
    if (!usuario?.id || f.enviadaEm) return null;
    st.rodando = true;
    let res = null;
    try {
      const rr = estadoRapido(f);
      const { dados } = mapearRapidoParaNovoAnuncio(f);
      const regs = await guarda.listar(f.id);
      setNuvem((n) => ({ ...n, estado: "salvando" }));
      const completos = dadosCompletosVoz(f, { fotos: regs.length });
      res = await sincronizarFichaVoz({ fichaVozId: f.id, fichaIdPAIIA: f.fichaIdPAIIA || "", codigo: dados.codigo, codigoNormalizado: codigoPrincipal(f)?.normalizado || "", titulo: rr.titulo.valor, descricao: dados.descricao, preco: dados.preco, oem: dados.oem, completos }, regs, depsNuvemRef.current);
      if (res.ok && res.fichaIdPAIIA && res.fichaIdPAIIA !== fichaRef.current.fichaIdPAIIA) {
        const comId = { ...fichaRef.current, fichaIdPAIIA: res.fichaIdPAIIA };
        fichaRef.current = comId;
        setFicha(comId);
        guardarFichaVoz(comId);
      }
      const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      if (res.ok) setVersaoNuvem((v) => v + 1);
      setNuvem(res.ok
        ? { estado: "salva", repetir: res.erros.length > 0, pendencias: res.pendencias || [], texto: `☁️ Ficha salva na sua conta às ${hora} · ${res.fotosNaFicha} foto(s) na ficha${res.completa ? " · ficha completa ✔" : res.pendencias?.length ? ` · falta(m) ${res.pendencias.length} item(ns)` : ""}${res.conflitos.length ? ` · ${res.conflitos.join(", ")} editado(s) no computador: mantido o do computador` : ""}${res.erros.length ? ` · ⚠️ ${res.erros.length} foto(s) ainda não enviada(s) — tento de novo sozinho` : ""}` }
        : { estado: res.estado, repetir: res.estado === "erro" || Boolean(res.erros?.length), texto: res.estado === "aguardando-codigo" ? "☁️ As fotos e os dados vão para a sua conta assim que o código for informado (até lá ficam guardados neste aparelho)." : res.estado === "sem-login" ? `⚠️ ${res.erro}` : `⚠️ ${res.erro}` });
      if (res.ok || res.erros?.length) await recarregarFotos();
    } catch (e) {
      setNuvem({ estado: "erro", repetir: true, texto: `⚠️ Não consegui salvar na conta agora (${e?.message || e}). Nada foi perdido: tento de novo.` });
    } finally {
      st.rodando = false;
      if (st.deNovo) { st.deNovo = false; setTimeout(() => { sincronizar(); }, 300); }
    }
    return res;
  }, [usuario?.id, guarda, recarregarFotos]);
  useEffect(() => {
    guarda.faxina(fichaId, { manter: listarFichasGuardadas().map((x) => x.id) }).catch(() => {}).finally(() => recarregarFotos());
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
      executar: modoIA === "real"
        ? criarExecutorFotoIA({ supabase, usuarioId: usuario.id, enviarOriginalFotoIA, recortarFotoIA, comporFotoFinal, garantirOriginal: (reg) => garantirOriginalNaNuvem(reg, depsNuvemRef.current) })
        : criarExecutorSimulado(),
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
  const marcaFotos = fotos.map((f) => `${f.id}:${f.versao}:${f.usarNoAnuncio ? 1 : 0}:${f.ia?.estado || ""}:${f.reg?.nuvem?.original ? 1 : 0}:${f.reg?.nuvem?.tratada ? 1 : 0}`).join(",");
  const r0 = estadoRapido(ficha);
  // (05/11) Ao chegar na Finalizar, grava na conta na hora (a conferência usa os dados mais novos).
  useEffect(() => {
    if (etapa === "finalizar" && usuario?.id) sincronizar();
  }, [etapa, usuario?.id, sincronizar]);
  const marcaFicha = `${codigoPrincipal(ficha)?.codigo || ""}|${r0.titulo.valor}|${descricaoParaEnvio(ficha)}|${ficha?.campos?.preco?.valor ?? ""}|${ficha?.campos?.marca?.valor ?? ""}|${ficha?.campos?.quantidade?.valor ?? ""}|${marcaCompletos(ficha)}|${codigosParaDescricao(ficha).join(",")}`; // (02/11) marca/estoque também salvam na conta; (04/11) custo, peso, medidas e aplicações também
  useEffect(() => {
    if (!usuario?.id) return undefined;
    const t = setTimeout(() => { sincronizar(); }, 1200);
    return () => clearTimeout(t);
  }, [marcaFicha, marcaFotos, usuario?.id, sincronizar]);
  // (03/11/2026) Envio em segundo plano: se uma foto falhou, tenta de novo sozinho
  // (sem esperar outra mudança); ao voltar para a aba/tela ou à internet, retoma na hora.
  // Só reenvia o que já está pronto no aparelho: nenhum fundo branco novo é processado.
  useEffect(() => {
    if (!usuario?.id || !nuvem.repetir) return undefined;
    const t = setTimeout(() => { sincronizar(); }, 20000);
    return () => clearTimeout(t);
  }, [nuvem, usuario?.id, sincronizar]);
  useEffect(() => {
    if (!usuario?.id) return undefined;
    const retomar = () => { if (typeof document === "undefined" || document.visibilityState !== "hidden") setTimeout(() => { sincronizar(); }, 500); };
    document.addEventListener("visibilitychange", retomar);
    window.addEventListener("online", retomar);
    return () => { document.removeEventListener("visibilitychange", retomar); window.removeEventListener("online", retomar); };
  }, [usuario?.id, sincronizar]);
  const envioFotos = situacaoEnvioFotos(
    fotos.map((f) => ({ usar: f.usarNoAnuncio, original: Boolean(f.reg?.nuvem?.original), versao: f.versao, tratadaPronta: Boolean(f.reg?.tratada?.blob), tratadaEnviada: Boolean(f.reg?.nuvem?.tratada), tratando: Boolean(f.ia?.ativo) })),
    { logado: Boolean(usuario?.id), temCodigo: Boolean(codigoPrincipal(ficha)?.codigo || ficha.fichaIdPAIIA), falhou: Boolean(nuvem.repetir) },
  );
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
  // (06/11) Galeria interna: baixa as escolhidas e guarda nesta ficha (mesmo caminho das fotos do aparelho).
  // Foto já tratada (fundo branco): entra pronta, sem passar de novo pelo Foto IA (sem créditos);
  // a ficha usa os MESMOS arquivos da Galeria (nada é enviado de novo, nada é alterado lá).
  async function usarFotosDaGaleria(itens) {
    const arquivos = [];
    const prontas = [];
    for (const it of itens) {
      try {
        const final = await baixarFotoGaleria(it);
        if (!it.tratada) { arquivos.push(final); continue; }
        const original = it.original ? await baixarFotoGaleria({ id: `${it.id}-original`, url: it.original }).catch(() => null) : null;
        prontas.push({ it, final, original });
      } catch (e) { return `Não consegui trazer uma foto da Galeria (${e?.message || e}). Nada foi alterado na Galeria.`; }
    }
    if (prontas.length) {
      try {
        const em = Date.now();
        // tudo gravado junto com a foto: a fila do Foto IA nunca a vê como “nova”
        const extras = prontas.map(({ it, final, original }) => ({
          tratada: { blob: final, origem: "galeria", baixaResolucao: false, em },
          ia: { estado: "pronta", origem: "galeria", erro: "", em },
          versao: "tratada",
          nuvem: { original: { caminho: "", url: original ? it.original : it.url }, tratada: { caminho: "", url: it.url, em } },
        }));
        const { guardadas, recusadas } = await guarda.adicionar(fichaRef.current.id, prontas.map((p) => p.original || p.final), extras);
        await recarregarFotos();
        if (!arquivos.length) setAviso(`${guardadas.length} foto(s) da Galeria já com fundo branco: entraram prontas, sem novo tratamento.${recusadas.length ? ` ${recusadas.length} não entrou(aram): ${[...new Set(recusadas.map((x) => x.motivo))].join("; ")}.` : ""}`);
      } catch (e) { return `Não consegui guardar as fotos da Galeria neste aparelho (${e?.message || e}).`; }
    }
    if (arquivos.length) await adicionarFotos(arquivos);
    setGaleriaAberta(false);
    return "";
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
    // saiu do passo: nenhum campo continua “ouvindo”; (04/11) na etapa 3 o Título vem primeiro
    const inicial = e === "descricao" && !estadoRapido(fichaRef.current).titulo.valor ? "titulo" : "";
    campoVozRef.current = inicial;
    setCampoVozEstado(inicial);
    setEditandoAp("");
    setConfirmandoEnvio(false);
    setAviso("");
    mudarFicha(irParaEtapa(fichaRef.current, e));
    // (04/11) Finalizar abre no topo (a escolha da conta é a primeira coisa da tela)
    if (e === "finalizar") setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "auto" }); } catch { /* sem rolagem */ } }, 30);
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

  const definirCodigo = useCallback((codigo, { soletrado = false, duvidas = [], ouvido = "" } = {}) => {
    const atual = codigoPrincipal(fichaRef.current);
    let base = fichaRef.current;
    if (atual && atual.normalizado !== String(codigo).replace(/[^0-9a-z]/gi, "").toUpperCase()) base = removerCodigo(base, atual.normalizado);
    const res = aplicarInterpretacao(base, { itens: [{ campo: "codigoPrincipal", valor: codigo, soletrado, duvidas }], naoEntendido: [], avisos: [] }, { origem: soletrado ? "voz" : "digitado", textoOriginal: `código: ${codigo}` });
    mudarFicha(res.ficha);
    // Mostra o que o celular ouviu (diagnóstico: o reconhecedor às vezes formata números sozinho).
    const ouviu = ouvido && ouvido.trim() !== codigo ? ` (ouvi “${ouvido.trim()}”)` : "";
    setOuvidoCodigo(ouvido ? { ouvido: ouvido.trim(), codigo } : null);
    setAviso(`Código ${codigo} anotado${ouviu}.${soletrado ? " Foi ditado: confira letra por letra. Para traço, diga “traço”." : ""} Consultando a base PAIIA…`);
    consultarBase(codigo);
  }, [consultarBase, mudarFicha]);

  // (04/11) Código ADICIONAL da mesma peça (por voz ou digitação): guardado sem repetir; o SKU principal não muda.
  const acrescentarCodigo = useCallback((codigo, { soletrado = false, ouvido = "" } = {}) => {
    const n = String(codigo || "").replace(/[^0-9a-z]/gi, "").toUpperCase();
    if (!n) return;
    if ((fichaRef.current.codigos || []).some((x) => x.normalizado === n)) { setAviso(`O código ${codigo} já está na ficha.`); return; }
    const res = aplicarInterpretacao(fichaRef.current, { itens: [{ campo: "codigoAdicional", valor: codigo, soletrado }], naoEntendido: [], avisos: [] }, { origem: soletrado ? "voz" : "digitado", textoOriginal: `código adicional: ${codigo}` });
    mudarFicha(res.ficha);
    setAviso(`Código adicional ${codigo} anotado${ouvido && ouvido.trim() !== codigo ? ` (ouvi “${ouvido.trim()}”)` : ""}.${soletrado ? " Foi ditado: marque “conferido” para ele entrar na descrição." : ""}`);
  }, [mudarFicha]);

  // (05/11) Aplicação corrigida: mesmo registro, volta a pendente (nova confirmação + nova validação no catálogo).
  const salvarAplicacaoEditada = useCallback((id, texto) => {
    const atual = fichaRef.current.aplicacoes.find((x) => x.id === id);
    if (!atual || String(texto || "").trim() === textoAplicacao(atual)) return;
    const r = editarAplicacao(fichaRef.current, id, texto);
    if (!r.ok) { setAviso(`⚠️ ${r.erro}`); return; }
    mudarFicha(r.ficha);
    setEditandoAp("");
    if (campoVozRef.current === `ap:${id}`) { campoVozRef.current = ""; setCampoVozEstado(""); }
    setAviso(`✏️ Aplicação corrigida: ${textoAplicacao(r.aplicacao)}. Confira e marque de novo — o catálogo do Mercado Livre valida de novo na Finalizar.`);
  }, [mudarFicha]);

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

  // (04/11) Cadastro Bling: SÓ leitura e SÓ quando você pede; preenche apenas campos vazios.
  async function trazerDoBling() {
    const cod = codigoPrincipal(fichaRef.current)?.codigo;
    if (!cod || lendoBlingVoz) return;
    setLendoBlingVoz(true);
    try {
      const { data } = await supabase.functions.invoke("bling-integracao", { body: { acao: "buscar_produto", codigo: cod } });
      if (!data?.ok || !data.produto) { setAviso(data?.encontrado === false ? `O SKU ${cod} não foi encontrado no Bling. Preencha pelos campos.` : "Não consegui ler o Bling agora. Preencha pelos campos."); return; }
      const r = usarDadosDoBling(fichaRef.current, data.produto);
      if (r.usados.length) mudarFicha(r.ficha);
      setAviso(r.usados.length ? `Do Bling (confira): ${r.usados.map((id) => CAMPOS_DIRETOS.find((c) => c.id === id)?.rotulo || id).join(", ")}. O que já estava na ficha não foi trocado.` : "O Bling não tem dados novos para os campos vazios.");
    } catch {
      setAviso("Não consegui ler o Bling agora. Preencha pelos campos.");
    } finally {
      setLendoBlingVoz(false);
    }
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

  // ---------------- Completar (conversa) ----------------
  // Pergunta só o que falta; as conferências/categoria/modalidade usam os
  // serviços de sempre. Nada aqui aprova nem publica (isso continua na Revisão).
  const estadoContasML = useContasML();
  const contasCompletar = useMemo(() => contasMLConectadas(estadoContasML).filter((c) => String(c.ml_user_id || "").trim()).map((c) => ({ id: String(c.ml_user_id), nome: nomeDaLoja(c.ml_user_id, c.nickname) })), [estadoContasML]);
  const [completarOcupado, setCompletarOcupado] = useState("");
  const [versaoRevisao, setVersaoRevisao] = useState(0);
  const [removendo, setRemovendo] = useState(null); // (04/11) confirmação de “Remover ficha de teste”
  const [guardadas, setGuardadas] = useState(() => listarFichasGuardadas());
  const [conversaAberta, setConversaAberta] = useState(false);
  const conversaAbertaRef = useRef(false);
  const [recenteCompletar, setRecenteCompletar] = useState("");
  const vozConversaRef = useRef(false); // você ligou o microfone na conversa: ele volta sozinho depois de cada pergunta
  const [falarPerguntas, setFalarPerguntas] = useState(() => { try { return localStorage.getItem("paiiaVozFalar") === "1"; } catch { return true; } });
  const micAntesDeFalar = useRef(false);
  useEffect(() => {
    if (!recenteCompletar) return undefined;
    const t = setTimeout(() => setRecenteCompletar(""), 2500);
    return () => clearTimeout(t);
  }, [recenteCompletar]);
  // (03/11) Eco: enquanto o PAIIA fala (e logo depois), o que o microfone captar é ignorado.
  const falaPaiiaRef = useRef({ ate: 0, texto: "" });
  const aoFalarPergunta = useCallback((falando, texto = "") => {
    if (falando) falaPaiiaRef.current = { ate: Number.POSITIVE_INFINITY, texto: String(texto || falaPaiiaRef.current.texto) };
    else falaPaiiaRef.current = { ...falaPaiiaRef.current, ate: Date.now() + 350 };
    const rec = reconhecedorRef.current;
    if (!rec) return;
    if (falando) { micAntesDeFalar.current = Boolean(rec.ouvindo); if (rec.ouvindo) rec.parar(); }
    else if (micAntesDeFalar.current || vozConversaRef.current) { micAntesDeFalar.current = false; setTimeout(() => { try { if (!rec.ouvindo) rec.iniciar(); } catch { /* precisa de toque */ } }, 300); }
  }, []);
  const contarFotos = () => fotosRef.current.filter((x) => x.usarNoAnuncio).length;
  const idDaFichaNaConta = useCallback(async () => {
    for (let i = 0; i < 4; i++) {
      const res = await sincronizar();
      if (res && fichaRef.current.fichaIdPAIIA) return fichaRef.current.fichaIdPAIIA;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
    return fichaRef.current.fichaIdPAIIA || "";
  }, [sincronizar]);
  const executarAcaoCompletar = useCallback(async (acao) => {
    setCompletarOcupado(acao === "confirmarCategoria" ? "Confirmando a categoria e conferindo de novo…" : "Conferindo categoria, duplicidade, Bling e frete…");
    try {
      const id = await idDaFichaNaConta();
      if (!id) { mudarFicha(anotarFalaPaiia(fichaRef.current, "Ainda não consegui salvar a ficha na sua conta. Confira a internet; eu tento de novo na próxima resposta.")); return; }
      const c = estadoCompletar(fichaRef.current);
      if (acao === "confirmarCategoria") {
        const lida = await lerFichaNovoAnuncio(id);
        const p = lida.ok ? lida.ficha?.dados_conferencia?.paiia_voz?.preparo : null;
        const r = p ? await confirmarCategoriaEGravar(id, p) : { ok: false, erro: "conferência não encontrada" };
        if (!r.ok) mudarFicha(anotarFalaPaiia(fichaRef.current, `Não consegui confirmar a categoria (${r.erro || "erro"}). Ela fica para a revisão.`));
      } else if (c.modalidade) {
        await definirModalidadeEGravar(id, c.modalidade);
      }
      await prepararEGravar(id, { conta: c.conta });
      const lida = await lerFichaNovoAnuncio(id);
      const rev = lida.ok ? montarRevisao(lida.ficha) : null;
      const catV = lida.ok ? lida.ficha?.dados_conferencia?.paiia_voz?.preparo?.verificacoes?.categoria : null;
      const idSug = rev?.pendencias.find((x) => x.id === "categoria")?.sugerida || "";
      const sugerida = acao === "confirmarCategoria" || !idSug ? "" : `${idSug}${catV?.caminho ? ` — ${catV.caminho}` : ""}`;
      let f = registrarConferencia(fichaRef.current, { fotos: contarFotos(), revisao: rev, sugerida });
      const prox = proximaPerguntaCompletar(f, { fotos: contarFotos() });
      f = anotarFalaPaiia(f, prox && !prox.acao ? prox.texto : fimCompletar(f, { fotos: contarFotos() }).texto);
      mudarFicha(f);
    } catch (e) {
      mudarFicha(anotarFalaPaiia(fichaRef.current, `A conferência não respondeu agora (${e?.message || e}). Tente de novo com “conferir”.`));
    } finally {
      setCompletarOcupado("");
      setVersaoRevisao((v) => v + 1); // a Revisão relê a ficha
    }
  }, [idDaFichaNaConta, mudarFicha]);
  const responderNaConversa = useCallback((texto, origem = "digitado") => {
    if (completarOcupado) return;
    const k = String(texto || "").trim().toLowerCase();
    if (/^(?:conferir|confere|conferir de novo)$/.test(k)) { executarAcaoCompletar("conferir"); return; }
    const antes = proximaPerguntaCompletar(fichaRef.current, { fotos: contarFotos() })?.texto || "";
    const r = responderCompletar(fichaRef.current, texto, { fotos: contarFotos(), contas: contasCompletar, origem });
    mudarFicha(r.ficha);
    if (r.anotado?.length) setRecenteCompletar(r.anotado.join(", "));
    else setAviso(r.resposta);
    // Mesma pergunta (não entendeu ou faltou parte): não há fala nova, então o microfone volta a ouvir sozinho.
    if (vozConversaRef.current && !r.acao && (r.pergunta?.texto || "") === antes) {
      setTimeout(() => { const rec = reconhecedorRef.current; try { if (rec && !rec.ouvindo) rec.iniciar(); } catch { /* precisa de toque */ } }, 600);
    }
    if (r.acao) executarAcaoCompletar(r.acao);
  }, [completarOcupado, contasCompletar, executarAcaoCompletar, mudarFicha]);

  // ---------------- Fala/digitação ----------------
  const tratarFala = useCallback((fala, origem = "voz") => {
    const t = String(fala || "").trim();
    if (!t) return;
    if (origem === "voz") {
      const eco = falaPaiiaRef.current;
      const sem = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      if (Date.now() < eco.ate || (sem(t).length >= 30 && sem(eco.texto).includes(sem(t)))) {
        setAviso("🔇 Ignorei o que o microfone ouviu enquanto o PAIIA falava. Responda depois da pergunta.");
        // a conversa não pode parar: volta a ouvir logo depois que o PAIIA terminar
        if (vozConversaRef.current) setTimeout(() => { const rec = reconhecedorRef.current; try { if (rec && !rec.ouvindo && Date.now() >= falaPaiiaRef.current.ate) rec.iniciar(); } catch { /* precisa de toque */ } }, 600);
        return;
      }
    }
    setAviso("");
    const f = fichaRef.current;
    const rr = estadoRapido(f);
    const nav = comandoNavegacao(t);
    if (nav) {
      if (rr.etapa === "finalizar" && nav === "proximo") { setAviso("Confira as pendências e use “Executar operações autorizadas”."); return; }
      // (03/11) Fluxo único: das fotos vai direto para a conversa (código, descrição e o resto).
      irPara(proximaEtapa(rr.etapa, nav === "proximo" ? 1 : -1));
      return;
    }
    if (rr.etapa === "fotos") {
      setAviso("Use “Foto da peça” ou “Da galeria”. Diga “próximo” para ir ao código.");
      return;
    }
    if (rr.etapa === "codigo") {
      // (03/11/2026) Código FALADO: sem traço/ponto que não foi pronunciado (o reconhecedor
      // do celular formata números sozinho); hífen só com “traço”. Digitado: como foi digitado.
      const c = lerCodigoDaFala(t, { falado: origem === "voz" });
      if (c.pular) {
        let g = irParaEtapa(f, "descricao");
        g = { ...g, rapido: { ...estadoRapido(g), codigoPulado: true } };
        mudarFicha(g);
        setAviso("Tudo bem, seguimos sem código. O SKU pode ser preenchido no Novo Anúncio.");
        return;
      }
      if (c.erro) { setAviso(c.erro); return; }
      // (04/11) Microfone do campo “Acrescentar código”: entra como código ADICIONAL (o principal não muda).
      if (campoVozRef.current === "codigoAdicional") { acrescentarCodigo(c.codigo, { soletrado: c.soletrado && origem === "voz", ouvido: origem === "voz" ? t : "" }); return; }
      definirCodigo(c.codigo, { soletrado: c.soletrado && origem === "voz", duvidas: c.duvidas, ouvido: origem === "voz" ? t : "" });
      return;
    }
    if (rr.etapa === "descricao" && campoVozRef.current === "titulo") {
      const e = editarPorVoz(rr.titulo.valor, t, { padrao: "substituir", anterior: rr.titulo.anterior, campo: "titulo" });
      if (e.aviso) setAviso(e.aviso);
      // (22/10) Comando não entendido / fala de conversa: nada é alterado.
      if (!["nada", "nao-achou", "nao-entendeu", "nao-parece"].includes(e.acao)) {
        mudarFicha(definirTitulo(f, e.texto, { origem }));
        const av = avaliarTitulo(e.texto, f);
        const voltar = (e.acao === "substituir" || e.acao === "limpar") && rr.titulo.valor && rr.titulo.valor !== e.texto ? " Se não era isso, diga “desfaz”." : "";
        if (!e.aviso) setAviso((av.avisos.length ? av.avisos.join(" ") : `Título anotado (${e.texto.length}/${LIMITE_TITULO}). Agora toque no 🎤 da Descrição.`) + voltar);
      }
      return;
    }
    if (["preco", "envio", "compat"].includes(rr.etapa)) {
      // (04/11) Compatibilidade: “carro” / “linha pesada” escolhem o tipo de veículo.
      if (rr.etapa === "compat" && /^(carro|autom[oó]vel|linha pesada|pesad[ao]|caminh[aã]o|[oô]nibus)$/i.test(t)) {
        const tipo = /^(carro|autom)/i.test(t) ? TIPO_CARRO : TIPO_PESADA;
        mudarFicha(definirTipoVeiculoVoz(f, tipo));
        setAviso(`✅ Tipo de veículo: ${tipo}`);
        return;
      }
      if (rr.etapa === "compat" && String(campoVozRef.current || "").startsWith("ap:")) { salvarAplicacaoEditada(campoVozRef.current.slice(3), t); return; }
      const id = rr.etapa === "compat" ? "aplicacoes" : (campoVozRef.current && CAMPOS_DIRETOS.find((c) => c.id === campoVozRef.current)?.etapa === rr.etapa ? campoVozRef.current : proximoCampoDireto(f, "", { etapa: rr.etapa }) || camposDaEtapa(rr.etapa)[0]?.id);
      const rotulo = CAMPOS_DIRETOS.find((c) => c.id === id)?.rotulo || id;
      const res = definirCampoDireto(f, id, t, { origem });
      const rec = reconhecedorRef.current;
      const ouvirDeNovo = () => setTimeout(() => { try { if (rec && !rec.ouvindo && campoVozRef.current) rec.iniciar(); } catch { /* precisa de toque */ } }, 400);
      if (!res.ok) { setAviso(`⚠️ ${rotulo}: ${res.erro}`); if (origem === "voz") ouvirDeNovo(); return; }
      mudarFicha(res.ficha);
      const prox = id === "aplicacoes" ? "" : proximoCampoDireto(res.ficha, id, { etapa: rr.etapa });
      setAviso(`✅ ${rotulo}: ${res.valor}${prox ? ` → agora ${CAMPOS_DIRETOS.find((c) => c.id === prox)?.rotulo}` : id === "aplicacoes" ? " · marque abaixo se estiver certa" : " · etapa completa: diga “próximo”"}`);
      setCampoVoz(prox);
      if (prox && origem === "voz") ouvirDeNovo(); // avança e já escuta o próximo campo
      return;
    }
    if (rr.etapa === "descricao") {
      // (02/11/2026) "marca …, preço …, quantidade …" ditos aqui vão para os CAMPOS
      // (não para o texto da descrição). Só quando a frase é inteira de campos.
      const campos = camposDitosNaFala(t);
      if (campos) {
        mudarFicha(aplicarInterpretacao(f, campos.interpretacao, { origem, textoOriginal: t }).ficha);
        setAviso(`Anotei: ${campos.resumo}. Diga “próximo” quando terminar.`);
        return;
      }
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
    if (rr.etapa === "finalizar") {
      if (conversaAbertaRef.current && (proximaPerguntaCompletar(f, { fotos: fotosRef.current.filter((x) => x.usarNoAnuncio).length }) || /^conferir/i.test(t))) { responderNaConversa(t, origem); return; }
      setAviso("Na finalização, confira as pendências e use “Executar operações autorizadas”.");
    }
  }, [definirCodigo, acrescentarCodigo, salvarAplicacaoEditada, irPara, mudarFicha, responderNaConversa, setCampoVoz]);

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

  const temParcial = Boolean(parcial);
  // (04/11) O campo que está recebendo a fala fica sempre à vista (só rola se estiver fora da tela).
  useEffect(() => {
    if (!ouvindo) return;
    const sel = campoVoz === "titulo" ? "#pr-titulo" : campoVoz ? `[data-pv-campo-direto="${campoVoz}"]` : `[data-pr-bloco="${etapa}"] .pr-campo`;
    const t = setTimeout(() => {
      try {
        const el = document.querySelector(sel);
        const r = el?.getBoundingClientRect?.();
        if (r && (r.top < 0 || r.bottom > window.innerHeight)) el.scrollIntoView?.({ block: "nearest" });
      } catch { /* sem rolagem */ }
    }, 60);
    return () => clearTimeout(t);
  }, [ouvindo, campoVoz, etapa, aviso, temParcial]);
  // Ação pedida pela página inicial (microfone/foto/digitar).
  useEffect(() => {
    const t = setTimeout(() => {
      const acao = consumirAcaoPaiiaVoz();
      if (acao === "microfone") ligarMicrofone();
      else if (acao === "foto") { if (estadoRapido(fichaRef.current).etapa !== "fotos") irPara("fotos"); try { fotoRef.current?.click(); } catch { /* precisa de toque */ } }
    }, 150);
    return () => clearTimeout(t);
  }, [ligarMicrofone, irPara]);

  // ---------------- Enviar ----------------
  const fotosUsadas = fotos.filter((f) => f.usarNoAnuncio);
  const resumoFotosTela = resumoFotos(fotos.map((f) => f.reg));
  const validacao = useMemo(() => validarRapido(ficha, { fotos: fotosUsadas.length }), [ficha, fotosUsadas.length]);
  const organizada = useMemo(() => organizarDescricao(ficha), [ficha]);
  const pesoMedidas = useMemo(() => pesoMedidasParaEnvio(ficha), [ficha]);
  const avTitulo = useMemo(() => avaliarTitulo(estadoRapido(ficha).titulo.valor, ficha), [ficha]);
  const sugestoes = useMemo(() => sugestoesTitulo(ficha), [ficha]);
  const perguntaCompletar = proximaPerguntaCompletar(ficha, { fotos: fotosUsadas.length });
  const historicoCompletar = estadoCompletar(ficha).historico;
  // Ao chegar na etapa final: o PAIIA diz o que já tem e faz a primeira pergunta.
  useEffect(() => {
    if (etapa !== "enviar" || !usuario?.id || !conversaAberta || historicoCompletar.length) return;
    mudarFicha(anotarFalaPaiia(fichaRef.current, aberturaCompletar(fichaRef.current, { fotos: fotosRef.current.filter((x) => x.usarNoAnuncio).length }).texto));
  }, [etapa, usuario?.id, conversaAberta, historicoCompletar.length, mudarFicha]);

  async function enviarAoNovoAnuncio() {
    const f = fichaRef.current;
    const v = validarRapido(f, { fotos: fotosUsadas.length });
    if (!v.pronto) { setConfirmandoEnvio(false); setAviso(`Ainda falta: ${v.faltando.join(", ")}.`); return; }
    const { dados, complemento } = mapearRapidoParaNovoAnuncio(f);
    // (31/10/2026) Ficha já na conta: o Novo Anúncio abre ESSA ficha (com as fotos dela).
    if (usuario?.id) {
      const res = await sincronizar();
      const id = res?.fichaIdPAIIA || fichaRef.current.fichaIdPAIIA;
      if (id) {
        const lida = await lerFichaNovoAnuncio(id);
        const rasc = lida.ok ? rascunhoDaFicha(lida.ficha) : null;
        if (rasc) {
          const pm = dados.pesoMedidasVoz;
          const extra = { origemPaiiaVoz: dados.origemPaiiaVoz };
          if (pm?.campos && typeof pm.campos === "object") {
            const preenchidos = [];
            for (const [c, v] of Object.entries(pm.campos)) if (typeof v === "string" && v.trim() && !String(rasc[c] ?? "").trim()) { extra[c] = v; preenchidos.push(c); }
            if (preenchidos.length) extra.vozPesoMedidas = { campos: preenchidos, texto: String(pm.texto || ""), frases: Array.isArray(pm.frases) ? pm.frases.slice(0, 6) : [], duvidas: Array.isArray(pm.duvidas) ? pm.duvidas.slice(0, 4) : [], conferido: false };
          }
          try { localStorage.setItem(CHAVE_COMPLEMENTO_VOZ, JSON.stringify(complemento)); } catch { /* sem espaço */ }
          abrirFichaNoNovoAnuncio({ ...rasc, ...extra });
          globalThis.__paiiaVozFotosPendentes = null;
          const enviada = { ...fichaRef.current, enviadaEm: Date.now(), versao: (Number(f.versao) || 0) + 1 };
          fichaRef.current = enviada;
          guardarFichaVoz(enviada);
          setScreen?.("novoAnuncio");
          return;
        }
      }
    }
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

  // (Etapa 1 simplificação) Compatibilidade rápida: só Montadora, Modelo e Ano.
  // O motor fica interno: vem do título/descrição quando há UM só (ex.: "1.6");
  // se faltar, a Finalizar pergunta com as opções do catálogo do Mercado Livre.
  const [veic, setVeic] = useState({ montadora: "", modelo: "", ano: "" });
  function motorDaFicha(f) {
    const t = `${f?.rapido?.titulo?.valor || ""} ${f?.rapido?.descricao?.texto || ""} ${f?.rapido?.descricao?.final || ""}`;
    const achados = [...new Set((t.match(/\b\d\.\d\b/g) || []))];
    return achados.length === 1 ? achados[0] : "";
  }
  function adicionarVeiculoRapido() {
    const montadora = veic.montadora.trim(); const modelo = veic.modelo.trim(); const ano = veic.ano.trim();
    const m = ano.match(/^(\d{4})(?:\s*(?:a|à|ate|até|-|–)\s*(\d{4}))?$/i);
    if (!montadora || !modelo || !m) { setAviso("Preencha Montadora, Modelo e Ano (ex.: 2012 ou 2010 a 2014)."); return; }
    const anoInicio = Number(m[1]); const anoFim = Number(m[2] || m[1]);
    if (anoFim < anoInicio) { setAviso("O ano final é menor que o inicial."); return; }
    const f = JSON.parse(JSON.stringify(fichaRef.current));
    const motor = motorDaFicha(f);
    const cap = (t) => t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    const r = incluirAplicacao(f, { texto: `${montadora} ${modelo} ${anoInicio}${anoFim !== anoInicio ? ` a ${anoFim}` : ""}`, montadora: cap(montadora), modelos: [cap(modelo)], motores: motor ? [motor] : [], anoInicio, anoFim }, { origem: "usuario", agora: Date.now(), confirmada: true });
    if (r?.aviso) { setAviso(r.aviso); return; }
    mudarFicha(f);
    setVeic({ montadora: "", modelo: "", ano: "" });
    setAviso(`✅ ${cap(montadora)} ${cap(modelo)} ${anoInicio}${anoFim !== anoInicio ? `–${anoFim}` : ""} incluído${motor ? ` (motor ${motor}, da descrição)` : " (o motor será conferido no catálogo do Mercado Livre)"}.`);
  }
  // Resposta à pergunta do motor (Finalizar): grava SÓ na aplicação perguntada e reconfere.
  function definirMotorDaAplicacao(pm, motor) {
    const s = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const f = JSON.parse(JSON.stringify(fichaRef.current));
    const a = f.aplicacoes.find((x) => s(x.montadora) === s(pm.montadora) && (x.modelos || []).some((mo) => s(mo) === s(pm.modelo)) && Number(x.anoInicio || 0) === Number(pm.anoInicio || 0) && Number(x.anoFim || 0) === Number(pm.anoFim || 0) && !(x.motores || []).length);
    if (!a) { setAviso("Não encontrei essa aplicação na ficha; confira a etapa Compat."); return; }
    a.motores = [motor];
    mudarFicha(f);
    setAviso(`✅ Motor ${motor} registrado para ${pm.aplicacao}. A conferência é refeita sozinha.`);
  }

  // (Rodada 1) Etapa 7: guarda no rascunho só o resultado (para a barra de etapas); a decisão fica na conta.
  const marcarCategoria = useCallback((c) => {
    const atual = fichaRef.current;
    const ant = atual.categoriaVoz || {};
    if (Boolean(ant.ok) === Boolean(c?.ok) && (ant.id || "") === (c?.id || "")) return;
    const nova = { ...atual, categoriaVoz: c?.ok ? { ok: true, id: c.id, caminho: c.caminho, automatica: Boolean(c.automatica), em: Date.now() } : { ok: false, em: Date.now() } };
    fichaRef.current = nova;
    setFicha(nova);
    guardarFichaVoz(nova);
  }, []);

  // (Passo 7) Ficha do rascunho não encontrada na conta: liga o rascunho a uma ficha DESTA conta
  // com o mesmo código (id) ou, com id vazio, deixa a próxima gravação criar a ficha nesta conta.
  // O rascunho e as fotos do aparelho ficam como estão (nada é apagado).
  function trocarFichaDaConta(id) {
    const atual = fichaRef.current;
    const nova = { ...atual, versao: (Number(atual.versao) || 0) + 1 };
    if (id) nova.fichaIdPAIIA = id; else delete nova.fichaIdPAIIA;
    delete nova.enviadaEm; delete nova.enviadaPara;
    fichaRef.current = nova;
    setFicha(nova);
    guardarFichaVoz(nova);
    setAviso(id ? `↪ Rascunho ligado à ficha ${id.slice(0, 8)} desta conta. Gravando…` : "➕ Criando a ficha nesta conta com o rascunho e as fotos deste aparelho…");
    setTimeout(() => { sincronizar(); }, 50);
  }

  // (Passo 7) Abre a Publicação da MESMA ficha (chamado pela Finalizar depois da aprovação):
  // endereço ?ficha=<ID> e, a partir daqui, o celular não regrava mais a ficha.
  function abrirPublicacaoDaFicha(id, auto = "") {
    let destino = enderecoPublicacaoDaFicha(window.location.href, id);
    // (Publicação automática) nº da autorização única vai junto; a Publicação executa sozinha.
    if (destino && auto) { try { const u = new URL(destino, window.location.href); u.searchParams.set("auto", auto); destino = u.pathname + u.search + u.hash; } catch { /* sem auto */ } }
    if (!destino || id !== fichaRef.current.fichaIdPAIIA) { setAviso("⚠️ A Publicação não é desta ficha: nada foi aberto."); return; }
    window.history.replaceState(window.history.state, "", destino);
    if (!fichaRef.current.enviadaEm) {
      const enviada = { ...fichaRef.current, enviadaEm: Date.now(), enviadaPara: "publicacao", versao: (Number(fichaRef.current.versao) || 0) + 1 };
      fichaRef.current = enviada;
      guardarFichaVoz(enviada);
    }
    setScreen?.("mercadoLivreTeste");
  }

  // (04/11) Remover ficha de teste: SÓ a ficha deste aparelho, não publicada, depois de UMA confirmação
  // mostrando código, data e fotos. Na conta, quem confere e apaga é a exclusão de sempre
  // (exclusaoFichaService: relê tudo, recusa ficha publicada/com MLB/Bling vinculado).
  function pedirRemoverFicha() {
    const f = fichaRef.current;
    if (fichaPreservada(f.fichaIdPAIIA)) { setAviso("Esta ficha está preservada por decisão sua: não é removida por aqui."); return; }
    setRemovendo({ codigo: codigoPrincipal(f)?.codigo || "", data: new Date(f.criadaEm || Date.now()).toLocaleString("pt-BR"), fotos: fotos.map((x) => (x.versao === "tratada" && x.urlTratada ? x.urlTratada : x.url)).filter(Boolean), ocupado: false });
  }
  async function removerFichaTeste() {
    const f = fichaRef.current;
    if (fichaPreservada(f.fichaIdPAIIA)) { setRemovendo(null); return; }
    setRemovendo((r) => (r ? { ...r, ocupado: true } : r));
    if (f.fichaIdPAIIA && usuario?.id) {
      const res = await excluirFichaDefinitivamente(f.fichaIdPAIIA).catch((e) => ({ ok: false, erro: e?.message || String(e) }));
      if (!res.apagada && !res.naoEncontrada) { setRemovendo(null); setAviso(`⛔ Ficha não removida: ${res.erro || res.motivo || "não passou nas conferências de segurança"}. Nada foi apagado.`); return; }
      try { descartarRascunhoLocalDaFicha(globalThis.localStorage, f.fichaIdPAIIA, { chaveGuardada: CHAVE_ANUNCIO_EM_ANDAMENTO, chavesLocais: CHAVES_ANUNCIO_LOCAL }); } catch { /* sem localStorage */ }
    }
    try { localStorage.removeItem(CHAVE_COMPLEMENTO_VOZ); } catch { /* sem localStorage */ }
    await guarda.limparFicha(f.id).catch(() => {}); // só as fotos DESTA ficha (a Galeria do celular não é tocada)
    retirarDaListaVoz(f.id);
    iniciarFichaNova();
    setRemovendo(null);
    setAviso("🗑️ Ficha de teste removida. Começamos uma ficha nova, limpa.");
  }

  // (04/11) Nova ficha: abre TOTALMENTE vazia. A anterior nunca é apagada sozinha:
  // com trabalho em andamento, você escolhe guardar (fica na lista “Fichas guardadas”) ou descartar (com confirmação).
  const fichaEmAndamento = (f, nFotos) => nFotos > 0 || !fichaVazia(f) || Boolean(estadoRapido(f).titulo.valor || estadoRapido(f).descricao.texto);
  function pedirNovaFicha() {
    if (fichaEmAndamento(fichaRef.current, fotosRef.current.length)) { setConfirmandoNova(true); return; }
    iniciarFichaNova();
  }
  function iniciarFichaNova(fichaAbrir = null) {
    try { reconhecedorRef.current?.parar(); } catch { /* sem microfone */ }
    const f = fichaAbrir || criarFichaVoz();
    mudarFicha(f);
    campoVozRef.current = "";
    setCampoVozEstado("");
    setEditandoAp("");
    setParcial("");
    setOuvidoCodigo(null);
    setConfirmandoNova(false);
    setConfirmandoEnvio(false);
    setEditandoFinal(false);
    setRemovendo(null);
    setLendoFoto({ estado: "", candidatos: [] });
    conversaAbertaRef.current = false;
    setConversaAberta(false);
    setRecenteCompletar("");
    setNuvem({ estado: "", texto: "" });
    setVersaoRevisao((v) => v + 1);
    setGuardadas(listarFichasGuardadas());
    setAviso(fichaAbrir ? `Ficha ${codigoPrincipal(f)?.codigo || ""} reaberta.` : "Ficha nova, vazia.");
  }
  async function novaFicha({ guardar }) {
    const atual = fichaRef.current;
    if (guardar) {
      const g = guardarNaListaVoz(atual);
      if (!g.ok) { setAviso(`⚠️ Não consegui guardar a ficha (${g.erro}). Nada foi apagado.`); setConfirmandoNova(false); return; }
    } else {
      await guarda.limparFicha(atual.id).catch(() => {}); // descartar: você confirmou (a ficha da conta e a Galeria não são tocadas)
    }
    iniciarFichaNova();
    setAviso(guardar ? "Ficha anterior guardada neste aparelho. Ficha nova, vazia." : "Ficha anterior descartada deste aparelho. Ficha nova, vazia.");
  }
  function abrirGuardada(id) {
    const atual = fichaRef.current;
    if (fichaEmAndamento(atual, fotosRef.current.length)) {
      const g = guardarNaListaVoz(atual);
      if (!g.ok) { setAviso(`⚠️ Não consegui guardar a ficha atual (${g.erro}). Nada foi trocado.`); return; }
    }
    const f = retirarDaListaVoz(id);
    if (f) iniciarFichaNova(f);
  }

  const cp = codigoPrincipal(ficha);
  const estEtapas = estadoEtapasVoz(ficha, { fotos: fotosUsadas.length, etapaAtual: etapa, ordem: ETAPAS });

  // (04/11) Microfone de um campo: toque e fale (o texto aparece no próprio campo).
  const micCampo = (id, rotulo) => (suporta && !avisoVoz ? (
    <button type="button" className={`pr-mic-campo ${campoVoz === id && ouvindo ? "pr-mic-ouvindo" : ""}`} aria-label={`Falar ${rotulo}`} aria-pressed={campoVoz === id && ouvindo} data-pv-campo-mic={id || "descricao"}
      onClick={() => { const rec = reconhecedorRef.current; if (campoVoz === id && ouvindo) { rec?.parar(); return; } setCampoVoz(id); setErroVoz(""); try { if (rec && !rec.ouvindo) rec.iniciar(); } catch { /* sem microfone */ } }}>🎤</button>
  ) : null);
  const renderCampo = (c) => {
    const valores = valoresCamposDiretos(ficha);
    const ativo = campoVoz === c.id || (!campoVoz && c.id === "aplicacoes");
    const ehAplic = c.id === "aplicacoes";
    return (
      <div key={c.id} className={`pr-campo-direto ${ativo ? "pr-campo-ativo" : ""}`} data-pv-campo-direto={c.id} data-estado={ativo ? (ouvindo ? "ouvindo" : "ativo") : valores[c.id] ? "ok" : "vazio"}>
        <label htmlFor={`pr-dd-${c.id}`}>{c.rotulo}{c.opcional ? " — opcional" : ""}{ativo && ouvindo ? " · 🎤 ouvindo…" : ""}</label>
        <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap" }}>
          <CampoTexto id={`pr-dd-${c.id}`} campoVoz={c.id} valor={ehAplic ? "" : valores[c.id]} ditando={ativo && ouvindo ? (parcial || " ") : ""} inputMode={["marca", "aplicacoes"].includes(c.id) ? "text" : "decimal"}
            onSalvar={(v) => { if (!String(v).trim()) return; const res = definirCampoDireto(fichaRef.current, c.id, v, { origem: "digitado" }); if (res.ok) mudarFicha(res.ficha); else setAviso(`⚠️ ${c.rotulo}: ${res.erro}`); }} data={`dado-${c.id}`} />
          {micCampo(c.id, c.rotulo)}
        </div>
        {ehAplic && valores.aplicacoes && <p className="pr-fonte" data-pv-aplicacoes-resumo>{valores.aplicacoes}</p>}
      </div>
    );
  };
  const navEtapa = (antes, depois) => (
    <div className="pr-nav">
      {antes ? <button type="button" className="pr-link" onClick={() => irPara(antes)}>← {ROTULOS_ETAPAS[antes]}</button> : <span />}
      {depois ? <button type="button" className="pr-botao" onClick={() => irPara(depois)} data-pr-continuar>Próximo →</button> : <span />}
    </div>
  );

  return (
    <div className="pr" lang="pt-BR" data-paiia-voz data-pr-etapa={etapa}>
      <style>{CSS_RAPIDO}</style>
      <div className="pr-topo">
        <button type="button" className="pr-voltar" onClick={() => setScreen?.("home")}>← Início</button>
        <h1>🎙️ PAIIA Voz</h1>
        <span className="pr-sub">Anúncio rápido · nada é publicado sem a sua conferência</span>
      </div>

      <nav className="pr-etapas" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <button key={e} type="button" className={`pr-etapa ${e === etapa ? "pr-atual" : ""} ${estEtapas[e] === "ok" ? "pr-feita" : estEtapas[e] === "pe" ? "pr-pendente" : ""}`} onClick={() => irPara(e)} aria-current={e === etapa ? "step" : undefined} data-pr-ir={e} data-pr-estado={estEtapas[e] || "nao"}>
            <span>{e !== etapa && estEtapas[e] === "ok" ? "✓" : e !== etapa && estEtapas[e] === "pe" ? "!" : i + 1}</span>{ROTULOS_ETAPAS[e]}
          </button>
        ))}
      </nav>

      {/* (04/11) Ficha antiga já enviada: avisa (nada é apagado sozinho). */}
      {ficha.enviadaEm && (
        <div className="pr-cartao pr-cinza" data-pr-enviada>
          <p>Esta ficha ({cp?.codigo || "sem código"}) já foi enviada {ficha.enviadaPara === "publicacao" ? "à Publicação" : "ao Novo Anúncio"} em {new Date(ficha.enviadaEm).toLocaleString("pt-BR")}. Os dados e as fotos continuam guardados aqui; mudanças feitas aqui não vão para aquela ficha.</p>
          <p className="pr-fonte">Para continuar aquela ficha, use a etapa 7 (Finalizar) ou a Central no computador. Para outra peça, toque em “Nova ficha limpa” (na etapa Fotos).</p>
        </div>
      )}
      {envioFotos.texto && <p className="pr-fonte pr-envio-fundo" role="status" data-pr-envio-fundo={envioFotos.estado}>{envioFotos.texto}</p>}
      <section className="pr-assistente" aria-live="polite">
        <div className="pr-mic-linha">
          <button type="button" className={`pr-mic ${ouvindo ? "pr-mic-ouvindo" : ""}`} onClick={ligarMicrofone} aria-pressed={ouvindo} aria-label={ouvindo ? "Parar de ouvir" : "Falar"} data-pv-microfone>
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a.9.9 0 1 0-1.8 0 4.2 4.2 0 0 1-8.4 0 .9.9 0 1 0-1.8 0 6 6 0 0 0 5.1 5.93V20H8.7a.9.9 0 1 0 0 1.8h6.6a.9.9 0 1 0 0-1.8h-2.4v-2.57A6 6 0 0 0 18 11.5Z" /></svg>
          </button>
          <div className="pr-pergunta">
            <span className="pr-quem">PAIIA</span>
            <p data-pr-pergunta>{etapa === "finalizar" && usuario && conversaAberta && perguntaCompletar ? perguntaCompletar.texto : PERGUNTAS[etapa]}</p>
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
        {/* (04/11) Sem caixa extra de digitação: cada campo tem o seu microfone e aceita digitação direta. */}
      </section>

      {/* ---------------- 1 Fotos ---------------- */}
      {etapa === "fotos" && (
        <section className="pr-bloco" data-pr-bloco="fotos">
          <div className="pr-linha">
            <button type="button" className="pr-botao pr-claro" disabled={fotos.length >= MAX_FOTOS_POR_FICHA} onClick={() => fotoRef.current?.click()} data-pv-foto-botao>📷 Tirar foto</button>
            <button type="button" className="pr-botao pr-claro" disabled={fotos.length >= MAX_FOTOS_POR_FICHA} onClick={() => setGaleriaAberta(true)} data-pv-galeria-botao>🖼️ Galeria</button>
            <button type="button" className="pr-botao pr-claro" disabled={fotos.length >= MAX_FOTOS_POR_FICHA} onClick={() => galeriaRef.current?.click()} data-pv-dispositivo-botao>📁 Enviar foto do dispositivo</button>
            <span className="pr-contador" data-pr-contador>{fotos.length} de {MAX_FOTOS_POR_FICHA}</span>
          </div>
          <input ref={fotoRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ""; }} data-pv-foto-input />
          <input ref={galeriaRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ""; }} data-pv-galeria-input />
          {/* (06/11) Galeria interna: fotos da conta (só leitura); a escolhida é copiada para esta ficha como as outras. */}
          {galeriaAberta && (
            <GaleriaSeletor
              supabase={supabase}
              userId={usuario?.id}
              vagas={vagasFotos(fotos.length, MAX_FOTOS_POR_FICHA)}
              onEscolher={usarFotosDaGaleria}
              onFechar={() => setGaleriaAberta(false)}
              onArquivo={() => galeriaRef.current?.click()}
              classeBotao="pr-botao"
              classeLink="pr-link"
            />
          )}
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
                <span className="pr-status" data-pr-na-conta={f.reg?.nuvem?.original ? (f.versao === "tratada" ? (f.reg?.nuvem?.tratada ? "tratada" : "enviando") : "original") : "nao"}>{f.reg?.nuvem?.original ? (f.versao === "tratada" ? (f.reg?.nuvem?.tratada ? "☁️ Na ficha: fundo branco" : "☁️ Fundo branco pronto — enviando em segundo plano (pode continuar)") : "☁️ Na ficha: original") : "📱 Só neste aparelho (vai para a ficha com o código)"}</span>
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
                {m === "desligado" ? "Desligado (só a foto original)" : m === "simulacao" ? "Simulação de teste — gratuita, sem Replicate (não remove o fundo de verdade)" : "Real — Foto IA oficial (conta no limite de 50 por mês)"}
              </label>
            ))}
            {!modosDisponiveis(ambienteIA).includes("real") && <p className="pr-fonte">Tratamento real (Foto IA oficial, Replicate/Recraft, pago): desligado — aguardando sua autorização.</p>}
            {modoIA !== "desligado" && !usuario?.id && <p className="pr-aviso">⚠️ Entre na sua conta para tratar as fotos.</p>}
          </div>
          {nuvem.texto && <p className="pr-fonte" data-pr-nuvem={nuvem.estado}>{nuvem.texto}</p>}
          {nuvem.pendencias?.length > 0 && (
            <ul className="pr-fonte" data-pr-pendencias-ficha>{nuvem.pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          <p className="pr-dica">Todas as fotos vão para o anúncio na versão escolhida. A original fica sempre guardada; o fundo branco é preparado enquanto você preenche código, título e descrição.</p>
          <div className="pr-cartao pr-cinza" data-pv-fichas>
            <strong>Fichas</strong>
            {removendo ? (
              <div data-pv-remover-confirmacao>
                <p>Remover <b>somente esta ficha</b> de teste? Código: <b>{removendo.codigo || "sem código"}</b> · criada em {removendo.data} · {removendo.fotos.length} foto(s).</p>
                <div className="pr-linha">{removendo.fotos.map((u, i) => <img key={u} src={u} alt={`Foto ${i + 1}`} style={{ width: 48, height: 48, objectFit: "contain", background: "#fff", borderRadius: 6 }} />)}</div>
                <p className="pr-fonte">Ficha publicada não é removida. Os demais anúncios, o Bling e o Mercado Livre não são alterados.</p>
                <div className="pr-linha">
                  <button type="button" className="pr-botao pr-claro pr-perigo" disabled={removendo.ocupado} onClick={removerFichaTeste} data-pv-remover-sim>{removendo.ocupado ? "⏳ Conferindo e removendo…" : "Sim, remover esta ficha"}</button>
                  <button type="button" className="pr-link" disabled={removendo.ocupado} onClick={() => setRemovendo(null)}>Não</button>
                </div>
              </div>
            ) : (
              <div className="pr-linha">
                <button type="button" className="pr-link pr-perigo" onClick={pedirRemoverFicha} data-pv-remover-ficha>🗑️ Remover ficha de teste</button>
                <button type="button" className="pr-link" onClick={pedirNovaFicha} data-pv-nova-limpa>＋ Nova ficha limpa</button>
              </div>
            )}
            {guardadas.length > 0 && (
              <div data-pv-fichas-guardadas>
                <span className="pr-rotulo">Fichas guardadas neste aparelho ({guardadas.length})</span>
                {guardadas.map((g) => (
                  <div key={g.id} className="pr-linha pr-entre" data-pv-ficha-guardada={g.id}>
                    <span className="pr-fonte">{codigoPrincipal(g)?.codigo || "sem código"} · {estadoRapido(g).titulo.valor || "sem título"} · {g.guardadaEm || g.atualizadaEm ? new Date(g.guardadaEm || g.atualizadaEm).toLocaleString("pt-BR") : ""}</span>
                    <button type="button" className="pr-link" onClick={() => abrirGuardada(g.id)} data-pv-abrir-guardada>Abrir</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pr-nav"><span /><button type="button" className="pr-botao" onClick={() => irPara("codigo")} data-pr-continuar>Continuar →</button></div>
        </section>
      )}

      {/* ---------------- 2 Código ---------------- */}
      {etapa === "codigo" && (
        <section className="pr-bloco" data-pr-bloco="codigo">
          <label className="pr-rotulo" htmlFor="pr-codigo">Código da peça (SKU)</label>
          <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap" }} data-pv-campo-direto="codigo">
            <CampoTexto id="pr-codigo" valor={cp?.codigo || ""} ditando={ouvindo && campoVoz !== "codigoAdicional" ? parcial || " " : ""} onSalvar={(v) => { const c = lerCodigoDaFala(v); if (c.codigo) definirCodigo(c.codigo); else if (c.pular) tratarFala(v, "digitado"); else if (c.erro) setAviso(c.erro); }} data="codigo" />
            {micCampo("codigo", "Código")}
          </div>
          {ouvidoCodigo && ouvidoCodigo.codigo === (cp?.codigo || "") && <p className="pr-fonte" data-pr-ouvido>🎤 O celular ouviu: “{ouvidoCodigo.ouvido}” → anotei <b>{ouvidoCodigo.codigo}</b>. Traço só entra se você disser “traço”; para corrigir, digite acima.</p>}
          {/* (04/11) Códigos adicionais da mesma peça: todos os conferidos vão para a descrição (Códigos de Referência). */}
          <div className="pr-cartao pr-cinza" data-pv-codigos-adicionais>
            <span className="pr-rotulo">Códigos adicionais da mesma peça ({codigosAdicionais(ficha).length})</span>
            {codigosAdicionais(ficha).map((c) => (
              <div key={c.normalizado} className="pr-linha pr-entre" data-pv-codigo-adicional={c.codigo} data-conferido={c.conferido !== false ? "sim" : "nao"}>
                <span><b>{c.codigo}</b> <span className="pr-fonte">{c.fonte ? `· sugerido: ${c.fonte}` : c.origem === "voz" ? "· ditado" : "· digitado"}</span></span>
                <span className="pr-linha" style={{ gap: 4 }}>
                  <label className="pr-check"><input type="checkbox" checked={c.conferido !== false} onChange={(e) => mudarFicha(conferirCodigo(fichaRef.current, c.normalizado, e.target.checked))} data-pv-conferir-codigo /> conferido</label>
                  <button type="button" className="pr-link pr-perigo" onClick={() => mudarFicha(removerCodigo(fichaRef.current, c.normalizado))} data-pv-remover-codigo>remover</button>
                </span>
              </div>
            ))}
            <label className="pr-rotulo" htmlFor="pr-codigo-adicional">Acrescentar código (fale ou digite e toque fora / Enter)</label>
            <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap" }} data-pv-campo-direto="codigoAdicional">
              <CampoTexto id="pr-codigo-adicional" valor="" ditando={campoVoz === "codigoAdicional" && ouvindo ? parcial || " " : ""} onSalvar={(v) => { const c = lerCodigoDaFala(v); if (c.codigo) acrescentarCodigo(c.codigo); else if (c.erro) setAviso(c.erro); }} data="codigo-adicional" />
              {micCampo("codigoAdicional", "Código adicional")}
            </div>
            <p className="pr-fonte" style={{ margin: 0 }}>Só os conferidos entram na descrição. Códigos sugeridos pela base não são considerados equivalentes sem a sua conferência.</p>
          </div>
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
            <button type="button" className="pr-botao" onClick={() => irPara("descricao")} data-pr-continuar>Continuar →</button>
          </div>
        </section>
      )}

      {/* ---------------- 3 Descrição e título ---------------- */}
      {etapa === "descricao" && (
        <section className="pr-bloco" data-pr-bloco="descricao">
          <div className={`pr-campo-direto ${campoVoz === "titulo" ? "pr-campo-ativo" : ""}`} data-pv-campo-direto="titulo">
            <label htmlFor="pr-titulo">Título ({r.titulo.valor.length}/{LIMITE_TITULO}){campoVoz === "titulo" && ouvindo ? " · 🎤 ouvindo…" : ""}</label>
            <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <AreaTexto id="pr-titulo" valor={r.titulo.valor} onSalvar={(v) => mudarFicha(definirTitulo(fichaRef.current, v.replace(/\s*\n+\s*/g, " "), { origem: "digitado" }))} data="titulo" linhas={2} umaLinha erro={r.titulo.valor.length > LIMITE_TITULO} ditando={campoVoz === "titulo" && ouvindo ? parcial || " " : ""} />
              {micCampo("titulo", "Título")}
            </div>
          </div>
          {avTitulo.avisos.filter((a) => !/^Falta/.test(a)).map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
          <div className="pr-linha">
            {r.titulo.valor && <button type="button" className="pr-link" onClick={() => mudarFicha(definirTitulo(fichaRef.current, ajustarTitulo(r.titulo.valor, fichaRef.current), { origem: "ajuste" }))} data-pr-ajustar>Ajustar ao padrão</button>}
            {r.titulo.anterior !== null && r.titulo.anterior !== r.titulo.valor && <button type="button" className="pr-link" onClick={() => mudarFicha(definirTitulo(fichaRef.current, r.titulo.anterior || "", { origem: "desfazer" }))}>Desfazer</button>}
          </div>
          {sugestoes.length > 0 && (
            <div className="pr-sugestoes">
              <span className="pr-rotulo">Sugestões de título (toque para usar)</span>
              {sugestoes.map((s) => <button key={s} type="button" className="pr-chip" onClick={() => mudarFicha(definirTitulo(fichaRef.current, s, { origem: "sugestao" }))} data-pr-sugestao>{s}</button>)}
            </div>
          )}
          <div className={`pr-campo-direto ${!campoVoz ? "pr-campo-ativo" : ""}`} data-pv-campo-direto="descricao">
            <label htmlFor="pr-desc">Descrição (cada fala é acrescentada; uma informação por linha){!campoVoz && ouvindo ? " · 🎤 ouvindo…" : ""}</label>
            <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <AreaTexto id="pr-desc" valor={semLinhaMedidas(r.descricao.texto)} onSalvar={(v) => mudarFicha(definirTextoDescricao(fichaRef.current, comLinhaMedidas(v, estadoRapido(fichaRef.current).descricao.texto)))} data="descricao-texto" ditando={ouvindo && !campoVoz ? parcial || " " : ""} acrescentar />
              {micCampo("", "Descrição")}
            </div>
          </div>
          {organizada.avisos.map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
          <div className="pr-linha pr-entre">
            <span className="pr-rotulo">Descrição organizada {r.descricao.final !== null ? "(editada à mão)" : "(automática)"}</span>
            {r.descricao.final === null
              ? <button type="button" className="pr-link" onClick={() => { mudarFicha(definirDescricaoFinal(fichaRef.current, organizada.texto)); setEditandoFinal(true); }} data-pr-editar-final>Editar texto final</button>
              : <button type="button" className="pr-link" onClick={() => { mudarFicha(definirDescricaoFinal(fichaRef.current, null)); setEditandoFinal(false); }}>Voltar ao automático</button>}
          </div>
          {r.descricao.final !== null && editandoFinal
            ? <AreaTexto id="pr-final" valor={r.descricao.final} onSalvar={(v) => mudarFicha(definirDescricaoFinal(fichaRef.current, v))} data="descricao-final" linhas={14} />
            : <pre className="pr-previa" data-pr-descricao>{descricaoParaEnvio(ficha)}</pre>}
          {navEtapa("codigo", "preco")}
        </section>
      )}

      {/* ---------------- 4 Preço, custo e estoque ---------------- */}
      {etapa === "preco" && (
        <section className="pr-bloco" data-pr-bloco="preco">
          <div className="pr-cartao" data-pv-dados-diretos>
            {cp?.codigo && (
              <button type="button" className="pr-link" disabled={lendoBlingVoz} onClick={trazerDoBling} data-pv-dados-bling>{lendoBlingVoz ? "⏳ Lendo o cadastro Bling…" : "⬇️ Trazer do Bling (só leitura; preenche só o que está vazio)"}</button>
            )}
            {camposDaEtapa("preco").map(renderCampo)}
            <p className="pr-fonte" style={{ margin: 0 }}>O estoque aqui é a quantidade a anunciar; o estoque oficial continua o do Bling.</p>
          </div>
          {navEtapa("descricao", "envio")}
        </section>
      )}

      {/* ---------------- 5 Peso, medidas e frete ---------------- */}
      {etapa === "envio" && (
        <section className="pr-bloco" data-pr-bloco="envio">
          <div className="pr-cartao" data-pv-dados-diretos>
            {camposDaEtapa("envio").map(renderCampo)}
            <p className="pr-fonte" style={{ margin: 0 }}>“20 por 10 por 5” preenche as três medidas.</p>
          </div>
          <p className="pr-fonte" data-pv-frete-info>🚚 <b>Frete:</b> calculado pelo Mercado Livre na finalização, com o preço, o peso e as medidas acima. O PAIIA não estima frete.</p>
          {organizada.medidas.length > 0 && (
            <div className="pr-cartao pr-cinza" data-pr-medidas>
              <strong>Ditos na descrição (vão só para os campos da plataforma)</strong>
              {organizada.medidas.map((m) => <p key={m}>{m}</p>)}
              {pesoMedidas ? (
                <p data-pr-peso-medidas-envio>➡️ Vai para os Dados técnicos do Novo Anúncio (só nos campos vazios), para você conferir: <b>{pesoMedidas.texto}</b>{pesoMedidas.duvidas.length ? <span style={{ display: "block", color: "#fde68a" }}>⚠ {pesoMedidas.duvidas.join(" ")}</span> : null}</p>
              ) : <p className="pr-vazio">Não entendi peso ou medidas da embalagem aqui (ex.: “peso 350 gramas”, “medidas 20 por 10 por 10”).</p>}
            </div>
          )}
          {navEtapa("preco", "compat")}
        </section>
      )}

      {/* ---------------- 6 Compatibilidade ---------------- */}
      {etapa === "compat" && (
        <section className="pr-bloco" data-pr-bloco="compat">
          {/* (Etapa 1) Só Montadora, Modelo e Ano. O motor é interno (descrição ou catálogo do ML). */}
          <div className="pr-cartao" data-pv-veiculo-rapido style={{ display: "grid", gap: 8 }}>
            <span className="pr-rotulo">Veículo compatível</span>
            <input className="pr-entrada" placeholder="Montadora (ex.: Fiat)" value={veic.montadora} onChange={(e) => setVeic((v) => ({ ...v, montadora: e.target.value }))} data-pv-veic="montadora" />
            <input className="pr-entrada" placeholder="Modelo (ex.: Uno)" value={veic.modelo} onChange={(e) => setVeic((v) => ({ ...v, modelo: e.target.value }))} data-pv-veic="modelo" />
            <input className="pr-entrada" placeholder="Ano (ex.: 2012 ou 2010 a 2014)" inputMode="numeric" value={veic.ano} onChange={(e) => setVeic((v) => ({ ...v, ano: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") adicionarVeiculoRapido(); }} data-pv-veic="ano" />
            <button type="button" className="pr-botao pr-grande" onClick={adicionarVeiculoRapido} data-pv-veic-adicionar>➕ Adicionar veículo</button>
          </div>
          <details open={campoVoz === "aplicacoes" || undefined} data-pv-aplicacao-completa>
            <summary className="pr-fonte">Falar ou digitar a aplicação completa (opcional)</summary>
            {camposDaEtapa("compat").filter((c) => c.id === "aplicacoes").map(renderCampo)}
          </details>
          {camposDaEtapa("compat").filter((c) => c.id !== "aplicacoes").map(renderCampo)}
          <span className="pr-rotulo">Aplicações (marque só as certas)</span>
          {ficha.aplicacoes.length > 0 && (
            <p className="pr-fonte" data-pv-aplicacoes-contagem>{["confirmada", "ambigua", "pendente"].map((e) => `${ficha.aplicacoes.filter((a) => situacaoAplicacao(a).estado === e).length} ${e === "confirmada" ? "confirmada(s)" : e === "ambigua" ? "ambígua(s)" : "pendente(s)"}`).join(" · ")}. A validação no catálogo do Mercado Livre é feita na Finalizar, com a conta escolhida.</p>
          )}
          {!ficha.aplicacoes.length && <p className="pr-vazio">Nenhuma aplicação. Fale o veículo e os anos (ex.: “Renault Master 2013 a 2022”).</p>}
          <ul className="pr-lista">
            {ficha.aplicacoes.map((a) => (
              <li key={a.id} data-pv-aplicacao={a.chave} data-pv-aplicacao-estado={situacaoAplicacao(a).estado}>
                <label className="pr-check">
                  <input type="checkbox" checked={a.confirmada} onChange={(e) => mudarFicha(confirmarAplicacao(fichaRef.current, a.id, e.target.checked))} data-pv-confirmar-aplicacao />
                  <span>{[a.tipoVeiculo, a.montadora].filter(Boolean).join(" ")}{a.tipoVeiculo || a.montadora ? " · " : ""}{resumoAplicacao(a)}</span>
                </label>
                <span className={`pr-fonte pr-ap-${situacaoAplicacao(a).estado}`}>{situacaoAplicacao(a).estado === "confirmada" ? "✅" : situacaoAplicacao(a).estado === "ambigua" ? "⚠️" : "⏳"} {situacaoAplicacao(a).texto}</span>
                <span className="pr-fonte">{a.origem === "usuario" ? "informada por você" : (a.fontes || []).join(" · ")}{a.editadaEm ? " · corrigida" : ""}</span>
                {/* (05/11) Corrigir a MESMA aplicação (teclado ou microfone), sem criar outra. */}
                {campoVoz === `ap:${a.id}` || editandoAp === a.id ? (
                  <div className={`pr-campo-direto ${campoVoz === `ap:${a.id}` ? "pr-campo-ativo" : ""}`} data-pv-campo-direto={`ap:${a.id}`} data-pv-editando-aplicacao={a.id}>
                    <label htmlFor={`pr-ap-${a.id}`}>Corrigir (fale ou digite; Enter salva){campoVoz === `ap:${a.id}` && ouvindo ? " · 🎤 ouvindo…" : ""}</label>
                    <div className="pr-linha" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <CampoTexto id={`pr-ap-${a.id}`} valor={textoAplicacao(a)} ditando={campoVoz === `ap:${a.id}` && ouvindo ? parcial || " " : ""} onSalvar={(v) => salvarAplicacaoEditada(a.id, v)} data="aplicacao-editar" />
                      {micCampo(`ap:${a.id}`, "Aplicação")}
                    </div>
                    <button type="button" className="pr-link" onClick={() => { setEditandoAp(""); if (campoVozRef.current === `ap:${a.id}`) setCampoVoz(""); }} data-pv-editar-fechar>Fechar</button>
                  </div>
                ) : (
                  <button type="button" className="pr-link" onClick={() => setEditandoAp(a.id)} data-pv-editar-aplicacao>Editar</button>
                )}
                <button type="button" className="pr-link pr-perigo" onClick={() => mudarFicha(removerAplicacao(fichaRef.current, a.id))}>remover</button>
              </li>
            ))}
          </ul>
          {(() => {
            const tipo = dadosCompletosVoz(ficha, { fotos: fotosUsadas.length });
            return (
              <div className="pr-cartao pr-cinza" data-pv-tipo-veiculo={tipo.tipoVeiculo || "nao"}>
                <span className="pr-rotulo">Tipo de veículo{tipo.tipoVeiculo ? `: ${tipo.tipoVeiculo}` : ""}</span>
                {tipo.tipoVeiculoOrigem !== "aplicacoes" && (
                  <div className="pr-linha">
                    {[TIPO_CARRO, TIPO_PESADA].map((t) => <button key={t} type="button" className={`pr-chip ${tipo.tipoVeiculo === t ? "pr-chip-on" : ""}`} onClick={() => mudarFicha(definirTipoVeiculoVoz(fichaRef.current, t))} data-pv-tipo={t}>{t}</button>)}
                  </div>
                )}
                {tipo.tipoVeiculoOrigem === "aplicacoes" && <p className="pr-fonte">Definido pelas aplicações marcadas.</p>}
              </div>
            );
          })()}
          {navEtapa("envio", "categoria")}
        </section>
      )}

      {/* ---------------- 7 Categoria (Rodada 1) ---------------- */}
      {etapa === "categoria" && (
        <section className="pr-bloco" data-pr-bloco="categoria">
          {usuario
            ? <CategoriaVoz key={ficha.fichaIdPAIIA || ficha.id} fichaId={ficha.fichaIdPAIIA || ""} versaoNuvem={versaoNuvem} aoMudar={marcarCategoria} />
            : <p className="pr-aviso">Entre na sua conta para conferir a categoria.</p>}
          {navEtapa("compat", "finalizar")}
        </section>
      )}

      {/* ---------------- 8 Finalizar ---------------- */}
      {etapa === "finalizar" && (
        <section className="pr-bloco" data-pr-bloco="finalizar">
          {/* Passo 7: UM botão grande — completar a ficha (vai direto à etapa pendente) ou seguir para a Publicação. */}
          {(() => {
            const pf = decidirPassoFinal(ficha, { fotos: fotosUsadas.length });
            return (
              <div className="pr-cartao" data-pv-passo-final={pf.acao}>
                {pf.acao === "completar" ? (
                  <>
                    <button type="button" className="pr-botao pr-grande" onClick={() => irPara(pf.etapa)} data-pv-completar-ficha={pf.etapa}>
                      ✏️ Completar ficha
                    </button>
                    <p className="pr-fonte" data-pv-falta>{`Falta: ${pf.faltam.join(", ")}`.replace(/\.?$/, ".")} O botão leva direto a “{pf.rotulo}”.</p>
                  </>
                ) : (
                  <p className="pr-fonte" data-pv-etapas-ok>✓ Etapas 1 a 6 completas. Agora é só seguir o próximo passo abaixo.</p>
                )}
              </div>
            );
          })()}
          {/* (04/11) Finalizar abre no topo: primeiro a conta de destino, depois os dados, pendências, operações e autorização. */}
          {!usuario && <p className="pr-aviso">⚠️ Entre na sua conta para finalizar.</p>}
          {(() => {
            const blocoFicha = (
              <>
              {(() => {
                const pend = dadosCompletosVoz(ficha, { fotos: fotosUsadas.length }).pendencias;
                const etapaDa = (t) => /^Fotos/i.test(t) ? "fotos" : /^C[oó]digo|SKU/i.test(t) ? "codigo" : /^T[ií]tulo|^Descri/i.test(t) ? "descricao" : /^Marca|^Pre[cç]o|^Estoque|^Quantidade|^Custo/i.test(t) ? "preco" : /^Peso|^Medida|^Comprimento|^Largura|^Altura/i.test(t) ? "envio" : "compat";
                return pend.length ? (
                  <div className="pr-cartao" data-pv-pendencias-envio>
                    <strong>Falta completar ({pend.length})</strong>
                    <ul className="pr-fonte" style={{ margin: 0, paddingLeft: 18 }}>{pend.map((x) => <li key={x}>{x} <button type="button" className="pr-link" onClick={() => irPara(etapaDa(x))} data-pv-ir-etapa={etapaDa(x)}>→ ir</button></li>)}</ul>
                  </div>
                ) : <p className="pr-ok" data-pv-ficha-completa>✅ Ficha completa.</p>;
              })()}
              <dl className="pr-resumo">
                <dt>Fotos</dt><dd data-pr-resumo-fotos>{fotosUsadas.length} ({fotosUsadas.filter((f) => f.versao === "tratada").length} com fundo branco)</dd>
                <dt>Código</dt><dd>{cp?.codigo || "—"}</dd>
                <dt>Título</dt><dd data-pr-resumo-titulo>{r.titulo.valor || "—"} <small>({r.titulo.valor.length}/{LIMITE_TITULO})</small></dd>
                <dt>Aplicações conferidas</dt><dd>{ficha.aplicacoes.filter((a) => a.confirmada).length}</dd>
                <dt>Peso/medidas</dt><dd data-pr-resumo-peso-medidas>{pesoMedidas ? pesoMedidas.texto : "—"}</dd>
              </dl>
              <span className="pr-rotulo">Fotos que vão para o anúncio</span>
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
                {!fotos.length && <p className="pr-vazio">Nenhuma foto: volte à etapa Fotos.</p>}
              </div>
              {resumoFotosTela.interrompidas > 0 && <p className="pr-aviso" data-pr-aviso-interrompidas>⏸ {resumoFotosTela.interrompidas} foto(s) com o fundo branco interrompido. Toque em “Retomar” na foto, ou siga com a original.</p>}
              {resumoFotosTela.tratando > 0 && <p className="pr-aviso" data-pr-aviso-tratando>⏳ {resumoFotosTela.tratando} foto(s) ainda em tratamento. Se seguir agora, elas vão como original (você pode aguardar).</p>}
              {validacao.faltando.length > 0 && <p className="pr-falta" data-pr-faltando>Falta: {validacao.faltando.join(", ")}.</p>}
              {validacao.avisos.map((a) => <p key={a} className="pr-aviso">⚠️ {a}</p>)}
              {nuvem.texto && <p className="pr-fonte" data-pr-nuvem={nuvem.estado}>{nuvem.texto}</p>}
              </>
            );
            return usuario
              ? <FinalizarAnuncioVoz key={`${ficha.id}-${versaoRevisao}`} fichaId={ficha.fichaIdPAIIA || ""} usuarioId={usuario?.id || ""} depoisDaConta={blocoFicha} versaoNuvem={versaoNuvem} aoIrEtapa={irPara} aoAbrirPublicacao={abrirPublicacaoDaFicha} codigoRascunho={cp?.codigo || ""} aoTrocarFicha={trocarFichaDaConta} aoDefinirMotor={definirMotorDaAplicacao} />
              : blocoFicha;
          })()}
          {usuario && (
            <details className="pr-fonte" open={conversaAberta} onToggle={(e) => { conversaAbertaRef.current = e.currentTarget.open; setConversaAberta(e.currentTarget.open); }} data-pv-conversa-opcional>
              <summary>Completar conversando com o PAIIA (opcional)</summary>
            <CompletarVoz
              historico={historicoCompletar}
              pergunta={perguntaCompletar}
              fim={perguntaCompletar ? null : fimCompletar(ficha, { fotos: fotosUsadas.length })}
              contas={contasCompletar}
              ocupado={completarOcupado}
              falar={falarPerguntas && conversaAberta}
              onFalar={(v) => { setFalarPerguntas(v); try { localStorage.setItem("paiiaVozFalar", v ? "1" : "0"); } catch { /* sem localStorage */ } }}
              onResponder={(t) => responderNaConversa(t, "digitado")}
              aoFalar={aoFalarPergunta}
              campos={camposDaFicha(ficha, { fotos: fotosUsadas.length })}
              ouvindo={ouvindo}
              parcial={parcial}
              vozDisponivel={Boolean(suporta) && !avisoVoz}
              recente={recenteCompletar}
              onMicrofone={() => { vozConversaRef.current = !ouvindo; ligarMicrofone(); }}
            />
            </details>
          )}
          {confirmandoEnvio ? (
            <div className="pr-cartao" data-pv-confirmacao-envio>
              <p>Abrir esta ficha no Novo Anúncio do computador para editar à mão? Nada é publicado.</p>
              <button type="button" className="pr-botao" onClick={enviarAoNovoAnuncio} data-pv-confirmar-envio>Abrir no Novo Anúncio</button>
              <button type="button" className="pr-link" onClick={() => setConfirmandoEnvio(false)}>Voltar</button>
            </div>
          ) : (
            <button type="button" className="pr-link" disabled={!validacao.pronto} onClick={() => setConfirmandoEnvio(true)} data-pv-enviar-novo>✏️ Editar no Novo Anúncio (computador)</button>
          )}
          {navEtapa("categoria", "")}
        </section>
      )}

      {confirmandoNova && (
        <div className="pr-cartao pr-folha" role="dialog" aria-label="Nova ficha" data-pv-nova-confirmacao>
          <p><b>Há uma ficha em andamento</b> ({codigoPrincipal(ficha)?.codigo || "sem código"} · {fotos.length} foto(s)). A nova ficha abre vazia. O que fazer com esta?</p>
          <button type="button" className="pr-botao" onClick={() => novaFicha({ guardar: true })} data-pv-nova-guardar>💾 Guardar esta e começar nova</button>
          <button type="button" className="pr-botao pr-claro pr-perigo" onClick={() => novaFicha({ guardar: false })} data-pv-nova-descartar>🗑️ Descartar esta (apaga do aparelho) e começar nova</button>
          <p className="pr-fonte">Descartar apaga só os dados e as fotos desta ficha neste aparelho; a ficha na conta, os anúncios e a Galeria do celular não são tocados.</p>
          <button type="button" className="pr-link" onClick={() => setConfirmandoNova(false)} data-pv-nova-cancelar>Cancelar</button>
        </div>
      )}
      <div className="pr-rodape">
        <button type="button" className="pr-link" onClick={pedirNovaFicha} data-pv-nova>Nova ficha</button>
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
function CampoTexto({ id, valor, onSalvar, data, erro = false, ditando = "", inputMode, campoVoz }) {
  const [texto, setTexto] = useState(valor);
  const [focado, setFocado] = useState(false);
  // (04/11) Enquanto você fala, o texto reconhecido aparece no próprio campo.
  const mostrado = ditando ? ditando : focado ? texto : valor;
  return (
    <input
      id={id}
      className={`pr-campo ${erro ? "pr-campo-erro" : ""} ${ditando ? "pr-campo-ditando" : ""}`}
      value={mostrado}
      readOnly={Boolean(ditando)}
      inputMode={inputMode}
      data-pv-campo-voz={campoVoz}
      onFocus={() => { setTexto(valor); setFocado(true); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { setFocado(false); if (texto !== valor) onSalvar(texto); }}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      data-pr-campo={data}
    />
  );
}

function AreaTexto({ id, valor, onSalvar, data, linhas = 5, umaLinha = false, erro = false, ditando = "", acrescentar = false }) {
  const [texto, setTexto] = useState(valor);
  const [focado, setFocado] = useState(false);
  // (04/11) Enquanto você fala, o texto reconhecido aparece no próprio campo (na descrição, como linha nova).
  const mostrado = ditando ? (acrescentar && valor ? `${valor}\n${ditando}` : ditando) : focado ? texto : valor;
  return (
    <textarea
      id={id}
      className={`pr-campo ${erro ? "pr-campo-erro" : ""} ${ditando ? "pr-campo-ditando" : ""}`}
      rows={linhas}
      readOnly={Boolean(ditando)}
      onKeyDown={umaLinha ? (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
      value={mostrado}
      onFocus={() => { setTexto(valor); setFocado(true); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => { setFocado(false); if (texto !== valor) onSalvar(texto); }}
      data-pr-campo={data}
    />
  );
}

// (04/11) Peso/medidas ficam guardados numa linha interna (só para os campos técnicos e o frete):
// o campo Descrição não mostra essa linha e a descrição comercial não a usa.
const ehLinhaMedidas = (l) => String(l || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().startsWith("medidas da embalagem:");
const semLinhaMedidas = (t) => String(t || "").split("\n").filter((l) => !ehLinhaMedidas(l)).join("\n").replace(/\n+$/, "");
const comLinhaMedidas = (visivel, original) => [String(visivel || "").replace(/\n+$/, ""), ...String(original || "").split("\n").filter(ehLinhaMedidas)].filter((l, i) => i > 0 || l.trim()).join("\n");

// (04/11) Fichas que você mandou preservar: nunca removidas por aqui.
const FICHAS_PRESERVADAS = ["05b4911c"];
function fichaPreservada(id) {
  const t = String(id || "").toLowerCase();
  return Boolean(t) && FICHAS_PRESERVADAS.some((p) => t.startsWith(p));
}

const CSS_RAPIDO = `
.pr { max-width: 760px; margin: 0 auto 40px; text-align: left; color: #e2e8f0; }
.pr *, .pr *::before, .pr *::after { box-sizing: border-box; }
.pr-topo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pr-topo h1 { margin: 0; font-size: 22px !important; color: #fff; }
.pr-sub { color: #94a3b8; font-size: 13px; }
.pr-voltar { padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; cursor: pointer; font-weight: 700; }
.pr-etapas { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 4px; margin-bottom: 10px; }
.pr-etapa { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; border-radius: 10px; border: 1px solid #1e293b; background: #0b1220; color: #94a3b8; font-size: 11px; font-weight: 700; cursor: pointer; min-width: 0; }
.pr-etapa span { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: #1e293b; color: #e2e8f0; font-size: 12px; }
.pr-atual { border-color: #22d3ee; color: #fff; background: #082f49; }
.pr-atual span { background: #0891b2; }
.pr-feita span { background: #15803d; }
.pr-pendente span { background: #b45309; }
.pr-pendente { color: #fcd34d; }
.pr-chip-on { background: #0e7490; color: #fff; }
@media (max-width: 480px) { .pr-etapas { gap: 3px; } .pr-etapa { font-size: 8px; padding: 4px 0; letter-spacing: -0.2px; } .pr-etapa span { width: 20px; height: 20px; font-size: 11px; } }
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
.pr-conta { padding: 10px 14px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-weight: 800; font-size: 15px; cursor: pointer; }
.pr-conta-on { border: 2px solid #22d3ee; background: #0e7490; color: #fff; }
.pr-sugestoes { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.pr-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pr-lista li { padding: 8px; border-radius: 10px; border: 1px solid #1e293b; display: flex; flex-direction: column; gap: 2px; }
.pr-fonte { color: #94a3b8; font-size: 12px; }
.pr-previa { margin: 0; padding: 10px; border-radius: 10px; background: #020617; border: 1px solid #1e293b; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; font-size: 14px; color: #e2e8f0; max-height: 360px; overflow-y: auto; }
.pr-resumo { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 0; font-size: 14px; }
.pr-resumo dt { color: #94a3b8; }
.pr-resumo dd { margin: 0; overflow-wrap: anywhere; }
.pr-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.pr-campo-direto { margin: 6px 0; }
.pr-campo-direto label { display: block; font-size: 14px; margin-bottom: 2px; }
.pr-campo-ativo label { font-weight: 700; color: #7dd3fc; }
.pr-campo-ditando { border-color: #38bdf8 !important; box-shadow: 0 0 0 2px rgba(56,189,248,.35); }
.pr-mic-campo { flex: 0 0 auto; width: 46px; min-height: 42px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; font-size: 20px; }
.pr-mic-campo.pr-mic-ouvindo { background: #0ea5e9; }
.pr-folha { position: fixed; left: 8px; right: 8px; bottom: 8px; z-index: 20; max-width: 744px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,.6); }
.pr-ap-confirmada { color: #86efac; } .pr-ap-ambigua { color: #fde68a; } .pr-ap-pendente { color: #94a3b8; }
/* (05/11) Celular: nada passa da largura da tela (botões quebram linha em vez de sair da tela). */
.pr { width: 100%; min-width: 0; overflow-wrap: anywhere; }
.pr-bloco, .pr-cartao, .pr-assistente, .pr-campo-direto, .pr-linha > * { min-width: 0; max-width: 100%; }
.pr-botao, .pr-link, .pr-conta, .pr-chip { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.pr-nav { flex-wrap: wrap; gap: 8px; }
.pr-nav .pr-botao { margin-left: auto; }
.pr-etapa { overflow: hidden; overflow-wrap: normal; word-break: normal; hyphens: auto; line-height: 1.15; text-align: center; }
.pr img { max-width: 100%; }
.pr-rodape { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-bottom: 32px; color: #94a3b8; font-size: 13px; }
@media (max-width: 480px) { .pr-topo h1 { font-size: 19px !important; } .pr-sub { display: none; } }
`;
