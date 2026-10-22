// =============================================================
// PAIIA Voz — tela do assistente (v1 local, 20/10/2026)
//
// Fala ou digitação → ficha de trabalho → consulta (só leitura) na base
// PAIIA → conferência do usuário → envio ao Novo Anúncio (fluxo atual,
// com Conferência e aprovação antes de qualquer publicação).
// Nada aqui grava no banco, publica, cobra créditos ou usa API paga.
// =============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { conversar, proximaPergunta } from "./servicos/conversaVoz";
import {
  criarFichaVoz,
  lerFichaVoz,
  guardarFichaVoz,
  descartarFichaVoz,
  aplicarInterpretacao,
  incorporarResultadoBase,
  editarCampo,
  confirmarCampo,
  definirCodigoPrincipal,
  conferirCodigo,
  removerCodigo,
  confirmarAplicacao,
  removerAplicacao,
  montarTitulo,
  montarDescricao,
  validarParaEnvio,
  mapearParaNovoAnuncio,
  codigoPrincipal,
  resumoAplicacao,
  formatarValor,
  fichaVazia,
  ROTULOS,
  CHAVE_COMPLEMENTO_VOZ,
  ORDEM_ATRIBUTOS,
  ROTULOS_ATRIBUTOS,
  definirAtributo,
} from "./servicos/fichaVoz";
import { criarReconhecedor, suportaReconhecimento, diagnosticoVoz } from "./servicos/reconhecimentoVoz";
import { consultarBaseVoz, MENSAGEM_NAO_ENCONTRADO } from "./servicos/consultaBaseVoz";
import { consumirAcaoPaiiaVoz } from "./servicos/acaoInicial";
import { candidatosDeCodigo, lerTextoDaFoto } from "./servicos/codigoNaFoto";
import { armazenamentoIndexedDB, armazenamentoMemoria, criarGuardaFotos } from "./servicos/fotosVozLocal";
import PaiiaVozRapido from "./PaiiaVozRapido";
import { iniciarAnuncioNovo } from "../../services/aberturaNovoAnuncio";
import { buscarConhecimentoValidado } from "../../services/paizinhoPesquisa/conhecimentoValidado";
import { pesquisarCatalogo } from "../../services/catalogoService";

const ROTULO_ORIGEM = {
  usuario: "Informada por você",
  base_validada: "Base validada PAIIA",
  catalogo: "Catálogo interno PAIIA",
};
const ROTULO_ORIGEM_CAMPO = {
  voz: "dito",
  digitado: "digitado",
  foto: "da foto",
  base_validada: "base PAIIA",
  catalogo: "catálogo",
};

const CHAVE_MANTER_MIC = "paiiaVozManterMicrofone";
function manterMicPadrao() {
  try {
    const salvo = localStorage.getItem(CHAVE_MANTER_MIC);
    if (salvo === "1" || salvo === "0") return salvo === "1";
  } catch {
    // sem localStorage
  }
  // Celular/tablet: o Chrome do Android desliga o microfone a cada pausa.
  return Boolean(globalThis.matchMedia?.("(pointer: coarse)")?.matches);
}

const BOAS_VINDAS = "Olá! Me conte sobre a peça do jeito que você falaria no balcão — por exemplo: “tenho uma lanterna dianteira de ônibus Neobus Mega Plus”. Eu vou perguntando o que faltar. Se preferir, também entendo “código …”, “preço …” e “aplicação …”.";

// Modo padrão: anúncio rápido (fotos → código → título → descrição → enviar).
// O modo conversa (anterior) continua disponível e funcionando.
const CHAVE_MODO = "paiiaVozModo";
function modoInicial() {
  try {
    return localStorage.getItem(CHAVE_MODO) === "conversa" ? "conversa" : "rapido";
  } catch {
    return "rapido";
  }
}
export default function PaiiaVoz(props) {
  const [modo, setModo] = useState(modoInicial);
  const trocar = (m) => {
    try {
      localStorage.setItem(CHAVE_MODO, m);
    } catch {
      // sem localStorage
    }
    setModo(m);
  };
  return modo === "conversa"
    ? <PaiiaVozConversa {...props} onModoRapido={() => trocar("rapido")} />
    : <PaiiaVozRapido {...props} onModoConversa={() => trocar("conversa")} />;
}

function PaiiaVozConversa({ setScreen, usuario, onModoRapido }) {
  const [ficha, setFicha] = useState(() => lerFichaVoz() || criarFichaVoz());
  const [mensagens, setMensagens] = useState(() => {
    const salva = lerFichaVoz();
    if (salva && !fichaVazia(salva)) {
      const cod = codigoPrincipal(salva)?.codigo;
      const p = proximaPergunta(salva);
      return [{ id: "m0", quem: "paiia", texto: `Continuando a ficha salva neste aparelho${cod ? ` (código ${cod})` : ""}. ${p ? p.texto : "Fale ou digite o que falta,"} Ou toque em “Nova ficha” para começar outra.` }];
    }
    return [{ id: "m0", quem: "paiia", texto: BOAS_VINDAS }];
  });
  const [entrada, setEntrada] = useState("");
  const [parcial, setParcial] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [erroVoz, setErroVoz] = useState("");
  const [consulta, setConsulta] = useState({ estado: "", texto: "" });
  const [fotos, setFotos] = useState([]);
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [confirmandoNova, setConfirmandoNova] = useState(false);
  const [destacarFoto, setDestacarFoto] = useState(false);
  const [manterMic, setManterMic] = useState(manterMicPadrao);
  const guardaFotos = useMemo(() => criarGuardaFotos({ armazenamento: armazenamentoIndexedDB() || armazenamentoMemoria() }), []);
  const fotosRef = useRef([]);
  const galeriaRef = useRef(null);
  const fichaRef = useRef(ficha);
  const reconhecedorRef = useRef(null);
  const entradaRef = useRef(null);
  const fotoRef = useRef(null);
  const mensagensRef = useRef(null);
  const suporta = useMemo(() => suportaReconhecimento(), []);
  const avisoVoz = useMemo(() => diagnosticoVoz().aviso, []);

  // Guarda a ficha neste aparelho a cada mudança (sobrevive ao F5).
  useEffect(() => {
    fichaRef.current = ficha;
    guardarFichaVoz(ficha);
  }, [ficha]);

  // A conversa rola sozinha até a última mensagem.
  useEffect(() => {
    const el = mensagensRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensagens]);

  const falar = useCallback((quem, texto, extra = {}) => {
    setMensagens((atual) => [...atual, { id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`, quem, texto, ...extra }].slice(-40));
  }, []);

  const processar = useCallback((texto, origem) => {
    const t = String(texto || "").trim();
    if (!t) return;
    falar("voce", t, { origem });
    // Conversa natural: entende o que foi dito no contexto da última pergunta
    // e responde com a próxima pergunta (sem IA paga, sem rede).
    const r = conversar(fichaRef.current, t, { origem });
    fichaRef.current = r.ficha;
    setFicha(r.ficha);
    falar("paiia", r.texto, { avisos: r.avisos });
  }, [falar]);

  // Reconhecimento de voz (navegador). Sem suporte → digitação.
  useEffect(() => {
    if (!suporta) return undefined;
    reconhecedorRef.current = criarReconhecedor({
      onParcial: (t) => setParcial(t),
      onFinal: (t) => {
        setParcial("");
        processar(t, "voz");
      },
      onErro: (msg) => {
        setErroVoz(msg);
        setParcial("");
      },
      onEstado: (v) => setOuvindo(v),
      manterLigado: manterMicPadrao(),
    });
    return () => reconhecedorRef.current?.parar();
  }, [suporta, processar]);

  useEffect(() => {
    if (reconhecedorRef.current) reconhecedorRef.current.manterLigado = manterMic;
    try {
      localStorage.setItem(CHAVE_MANTER_MIC, manterMic ? "1" : "0");
    } catch {
      // sem localStorage
    }
  }, [manterMic]);

  // Fotos guardadas neste aparelho (IndexedDB): voltam depois do F5.
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  useEffect(() => () => fotosRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const fichaId = ficha.id;
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await guardaFotos.faxina(fichaId);
        const regs = await guardaFotos.listar(fichaId);
        if (!vivo) return;
        setFotos((atuais) => {
          atuais.forEach((f) => URL.revokeObjectURL(f.url));
          return regs.map(fotoDaTela);
        });
        if (regs.length) falar("paiia", `${regs.length} foto(s) desta ficha recuperada(s) deste aparelho.`);
      } catch {
        // sem banco local: as fotos ficam só até atualizar a página
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichaId, guardaFotos]);

  function fotoDaTela(reg) {
    const arquivo = guardaFotos.comoArquivo(reg);
    return {
      id: reg.id,
      arquivo,
      url: URL.createObjectURL(reg.blob),
      usarNoAnuncio: reg.usarNoAnuncio,
      guardada: true,
      leitura: { estado: "", progresso: 0, candidatos: [] },
    };
  }

  const ligarMicrofone = useCallback(() => {
    setErroVoz("");
    if (!reconhecedorRef.current) {
      setErroVoz("Este navegador não tem reconhecimento de voz. Use o Chrome (computador ou Android) ou digite abaixo.");
      entradaRef.current?.focus();
      return;
    }
    if (reconhecedorRef.current.ouvindo) reconhecedorRef.current.parar();
    else reconhecedorRef.current.iniciar();
  }, []);

  // Ação pedida pela página inicial.
  useEffect(() => {
    // Consumida dentro do temporizador: o modo de desenvolvimento do React
    // monta duas vezes e a ação não pode se perder nem repetir.
    const t = setTimeout(() => {
      const acao = consumirAcaoPaiiaVoz();
      if (acao === "microfone") ligarMicrofone();
      else if (acao === "foto") {
        setDestacarFoto(true);
        try {
          fotoRef.current?.click();
        } catch {
          // o navegador pode exigir um toque do usuário
        }
      } else if (acao === "digitar") entradaRef.current?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [ligarMicrofone]);

  function enviarDigitado(e) {
    e?.preventDefault?.();
    const t = entrada.trim();
    if (!t) return;
    setEntrada("");
    processar(t, "digitado");
  }

  async function consultarBase() {
    const cp = codigoPrincipal(fichaRef.current);
    if (!cp) {
      falar("paiia", "Primeiro diga ou digite o código da peça.");
      return;
    }
    setConsulta({ estado: "buscando", texto: `Consultando a base PAIIA para ${cp.codigo}…` });
    const res = await consultarBaseVoz(cp.codigo, { buscarValidado: buscarConhecimentoValidado, pesquisarCatalogo });
    if (!res.encontrado) {
      setConsulta({ estado: "nada", texto: res.erro && res.erro.startsWith("Informe") ? res.erro : MENSAGEM_NAO_ENCONTRADO });
      falar("paiia", `${MENSAGEM_NAO_ENCONTRADO}${res.erro && !res.erro.startsWith("Informe") ? ` (${res.erro})` : ""}`);
      return;
    }
    const r = incorporarResultadoBase(fichaRef.current, res);
    fichaRef.current = r.ficha;
    setFicha(r.ficha);
    const n = res.aplicacoes.length;
    setConsulta({ estado: "ok", texto: `${res.rotulo}: ${n} aplicação(ões) e ${res.codigos.length} código(s) de referência encontrados.` });
    falar("paiia", `Encontrei na ${res.rotulo}: ${n} aplicação(ões). Elas aparecem na ficha com a fonte; confirme as que valem para este anúncio.${r.mudancas.length ? "" : " (Nada novo: já estava na ficha.)"}`);
  }

  function atualizar(fn) {
    const nova = fn(fichaRef.current);
    fichaRef.current = nova;
    setFicha(nova);
  }

  async function adicionarFotos(lista) {
    const arquivos = Array.from(lista || []).filter((a) => /^image\//.test(a.type || ""));
    if (!arquivos.length) return;
    setDestacarFoto(false);
    const fichaAtual = fichaRef.current.id;
    try {
      const { guardadas, recusadas } = await guardaFotos.adicionar(fichaAtual, arquivos);
      setFotos((atuais) => [...atuais, ...guardadas.map(fotoDaTela)]);
      const partes = [];
      if (guardadas.length) partes.push(`${guardadas.length} foto(s) guardada(s) neste aparelho (continuam se a página for atualizada). Toque em “Ler código na foto” para eu sugerir o código impresso na peça ou na caixa.`);
      if (recusadas.length) partes.push(`Não guardei ${recusadas.length}: ${[...new Set(recusadas.map((r) => r.motivo))].join("; ")}.`);
      falar("paiia", partes.join(" "));
    } catch (e) {
      // Sem espaço/banco local: mostra mesmo assim, mas avisa que some no F5.
      setFotos((atuais) => [
        ...atuais,
        ...arquivos.map((arquivo) => ({
          id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          arquivo,
          url: URL.createObjectURL(arquivo),
          usarNoAnuncio: /^image\/(jpeg|png|webp)$/i.test(arquivo.type || ""),
          guardada: false,
          leitura: { estado: "", progresso: 0, candidatos: [] },
        })),
      ]);
      falar("paiia", `${arquivos.length} foto(s) recebida(s), mas NÃO consegui guardar neste aparelho (${e?.message || e}). Não atualize a página antes de enviar.`);
    }
  }

  function atualizarFoto(id, mudar) {
    setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, ...mudar(f) } : f)));
  }

  function marcarFoto(foto, usar) {
    atualizarFoto(foto.id, () => ({ usarNoAnuncio: usar }));
    if (foto.guardada) guardaFotos.marcarUso(foto.id, usar).catch(() => {});
  }

  function removerFoto(foto) {
    setFotos((atuais) => atuais.filter((f) => f.id !== foto.id));
    URL.revokeObjectURL(foto.url);
    if (foto.guardada) guardaFotos.remover(foto.id).catch(() => {});
  }

  async function lerCodigoFoto(foto) {
    atualizarFoto(foto.id, () => ({ leitura: { estado: "lendo", progresso: 0, candidatos: [] } }));
    try {
      const texto = await lerTextoDaFoto(foto.arquivo, {
        onProgresso: (p) => atualizarFoto(foto.id, (f) => ({ leitura: { ...f.leitura, progresso: p } })),
      });
      const candidatos = candidatosDeCodigo(texto);
      atualizarFoto(foto.id, () => ({ leitura: { estado: "ok", progresso: 100, candidatos } }));
      falar("paiia", candidatos.length ? `Na foto li: ${candidatos.join(", ")}. Toque no código certo para usar (e confira letra por letra).` : "Não consegui ler um código nesta foto. Tente uma foto mais próxima e bem iluminada, ou diga o código.");
    } catch (e) {
      atualizarFoto(foto.id, () => ({ leitura: { estado: "erro", progresso: 0, candidatos: [] } }));
      falar("paiia", `A leitura da foto não está disponível agora (${e?.message || e}). Diga ou digite o código.`);
    }
  }

  function usarCandidato(codigo) {
    const interp = { itens: [{ campo: "codigo", valor: codigo, soletrado: true }], naoEntendido: [], avisos: [] };
    const r = aplicarInterpretacao(fichaRef.current, interp, { origem: "foto", textoOriginal: `código da foto: ${codigo}` });
    const p = proximaPergunta(r.ficha);
    const nova = { ...r.ficha, conversa: { ...(r.ficha.conversa || {}), pendente: p?.campo || null } };
    fichaRef.current = nova;
    setFicha(nova);
    falar("paiia", `Código ${codigo} anotado. Confira letra por letra e marque “conferido”.${p ? ` ${p.texto}` : ""}`);
  }

  const validacao = useMemo(() => validarParaEnvio(ficha), [ficha]);
  const titulo = useMemo(() => montarTitulo(ficha), [ficha]);
  const descricao = useMemo(() => montarDescricao(ficha), [ficha]);

  function enviarAoNovoAnuncio() {
    const f = fichaRef.current;
    const v = validarParaEnvio(f);
    if (!v.pronto) {
      setConfirmandoEnvio(false);
      falar("paiia", `Ainda falta: ${v.faltando.join(", ")}.`);
      return;
    }
    const { dados, complemento } = mapearParaNovoAnuncio(f);
    iniciarAnuncioNovo({ dados });
    try {
      localStorage.setItem(CHAVE_COMPLEMENTO_VOZ, JSON.stringify(complemento));
    } catch {
      // sem espaço: marca/quantidade ficam para a Conferência
    }
    const arquivos = fotos.filter((x) => x.usarNoAnuncio).map((x) => x.arquivo);
    globalThis.__paiiaVozFotosPendentes = arquivos.length ? { origem: dados.origemPaiiaVoz, arquivos } : null;
    const enviada = { ...f, enviadaEm: Date.now(), versao: (Number(f.versao) || 0) + 1 };
    fichaRef.current = enviada;
    guardarFichaVoz(enviada);
    setScreen?.("novoAnuncio");
  }

  function novaFicha() {
    guardaFotos.limparFicha(fichaRef.current.id).catch(() => {});
    fotos.forEach((f) => URL.revokeObjectURL(f.url));
    descartarFichaVoz();
    const f = criarFichaVoz();
    fichaRef.current = f;
    setFicha(f);
    setFotos([]);
    setConsulta({ estado: "", texto: "" });
    setConfirmandoNova(false);
    setMensagens([{ id: `m${Date.now()}`, quem: "paiia", texto: "Ficha nova. Diga o código da próxima peça." }]);
  }

  const cp = codigoPrincipal(ficha);

  return (
    <div className="pv" data-paiia-voz>
      <style>{CSS_VOZ}</style>

      <div className="pv-topo">
        <button type="button" className="pv-voltar" onClick={() => setScreen?.("home")}>← Início</button>
        <h1>🎙️ PAIIA Voz</h1>
        <span className="pv-sub">Assistente de anúncios de autopeças · nada é publicado sem a sua conferência</span>
        {onModoRapido && <button type="button" className="pv-link" onClick={onModoRapido} data-pv-modo-rapido>Voltar ao anúncio rápido</button>}
      </div>

      <div className="pv-colunas">
        {/* ---------------- Conversa ---------------- */}
        <section className="pv-conversa" aria-label="Conversa">
          <div className="pv-mic-area">
            <button
              type="button"
              className={`pv-mic ${ouvindo ? "pv-mic-ouvindo" : ""}`}
              onClick={ligarMicrofone}
              aria-pressed={ouvindo}
              aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
              data-pv-microfone
            >
              <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
                <path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a.9.9 0 1 0-1.8 0 4.2 4.2 0 0 1-8.4 0 .9.9 0 1 0-1.8 0 6 6 0 0 0 5.1 5.93V20H8.7a.9.9 0 1 0 0 1.8h6.6a.9.9 0 1 0 0-1.8h-2.4v-2.57A6 6 0 0 0 18 11.5Z" />
              </svg>
            </button>
            <div className="pv-mic-texto">
              <strong>{ouvindo ? "Ouvindo… fale agora" : suporta ? "Toque no microfone e fale" : "Digite abaixo"}</strong>
              <span data-pv-suporte-voz={suporta && !avisoVoz ? "sim" : "nao"}>
                {avisoVoz || "Fale normalmente. Ex.: “tenho uma lanterna dianteira de ônibus Neobus Mega Plus”"}
              </span>
              {parcial && <em className="pv-parcial" data-pv-parcial>{parcial}</em>}
            </div>
          </div>
          {suporta && (
            <label className="pv-check pv-manter" data-pv-manter-mic>
              <input type="checkbox" checked={manterMic} onChange={(e) => setManterMic(e.target.checked)} />
              Manter o microfone ligado entre as frases (recomendado no celular)
            </label>
          )}
          {erroVoz && <p className="pv-erro" role="alert" data-pv-erro-voz>{erroVoz}</p>}

          <div className="pv-mensagens" aria-live="polite" ref={mensagensRef}>
            {mensagens.map((m) => (
              <div key={m.id} className={`pv-msg pv-msg-${m.quem}`} data-pv-mensagem={m.quem}>
                <span className="pv-msg-quem">{m.quem === "voce" ? `Você${m.origem === "voz" ? " (voz)" : ""}` : "PAIIA"}</span>
                <p>{m.texto}</p>
                {(m.avisos || []).map((a) => (
                  <p key={a} className="pv-aviso" data-pv-aviso>⚠️ {a}</p>
                ))}
              </div>
            ))}
          </div>

          <form className="pv-entrada" onSubmit={enviarDigitado}>
            <textarea
              ref={entradaRef}
              rows={2}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) enviarDigitado(e);
              }}
              placeholder="Digite como falaria, por exemplo: lanterna dianteira de ônibus Neobus Mega Plus 2013 e 2014"
              aria-label="Digite para o PAIIA Voz"
              data-pv-entrada
            />
            <button type="submit" className="pv-botao" data-pv-enviar-texto>Enviar</button>
          </form>

          <div className={`pv-fotos ${destacarFoto ? "pv-destaque" : ""}`}>
            <button type="button" className="pv-botao pv-botao-claro" onClick={() => fotoRef.current?.click()} data-pv-foto-botao>
              📷 Foto da peça
            </button>
            <button type="button" className="pv-botao pv-botao-claro" onClick={() => galeriaRef.current?.click()} data-pv-galeria-botao>
              🖼️ Da galeria
            </button>
            <input
              ref={galeriaRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                adicionarFotos(e.target.files);
                e.target.value = "";
              }}
              data-pv-galeria-input
            />
            <input
              ref={fotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                adicionarFotos(e.target.files);
                e.target.value = "";
              }}
              data-pv-foto-input
            />
            {fotos.map((f) => (
              <div key={f.id} className="pv-foto" data-pv-foto>
                <img src={f.url} alt="Foto da peça" />
                <label className="pv-check">
                  <input
                    type="checkbox"
                    checked={f.usarNoAnuncio}
                    disabled={!/^image\/(jpeg|png|webp)$/i.test(f.arquivo.type || "")}
                    onChange={(e) => marcarFoto(f, e.target.checked)}
                  />
                  usar no anúncio
                </label>
                {!f.guardada && <span className="pv-aviso" data-pv-foto-nao-guardada>só nesta tela</span>}
                <button type="button" className="pv-link" onClick={() => removerFoto(f)} data-pv-remover-foto>Remover</button>
                <button type="button" className="pv-link" onClick={() => lerCodigoFoto(f)} disabled={f.leitura.estado === "lendo"} data-pv-ler-foto>
                  {f.leitura.estado === "lendo" ? `Lendo… ${f.leitura.progresso}%` : "Ler código na foto (beta)"}
                </button>
                {f.leitura.candidatos.map((c) => (
                  <button key={c} type="button" className="pv-chip" onClick={() => usarCandidato(c)} data-pv-candidato={c}>{c}</button>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Ficha ---------------- */}
        <section className="pv-ficha" aria-label="Ficha da peça" data-pv-ficha>
          <div className="pv-ficha-topo">
            <h2>Ficha da peça</h2>
            {confirmandoNova ? (
              <span className="pv-confirma">
                Apagar esta ficha deste aparelho?
                <button type="button" className="pv-link pv-perigo" onClick={novaFicha} data-pv-nova-sim>Sim, começar outra</button>
                <button type="button" className="pv-link" onClick={() => setConfirmandoNova(false)}>Não</button>
              </span>
            ) : (
              <button type="button" className="pv-link" onClick={() => (fichaVazia(ficha) ? novaFicha() : setConfirmandoNova(true))} data-pv-nova>Nova ficha</button>
            )}
          </div>
          {ficha.enviadaEm && (
            <p className="pv-info" data-pv-enviada>Esta ficha já foi enviada ao Novo Anúncio em {new Date(ficha.enviadaEm).toLocaleString("pt-BR")}. Mudanças aqui não alteram aquele anúncio.</p>
          )}

          <h3>Códigos</h3>
          {!ficha.codigos.length && <p className="pv-vazio">Nenhum código ainda. Diga “código …”.</p>}
          <ul className="pv-lista">
            {ficha.codigos.map((c) => (
              <li key={c.normalizado} data-pv-codigo={c.normalizado}>
                <label className="pv-check">
                  <input type="radio" name="pv-principal" checked={c.principal} onChange={() => atualizar((f) => definirCodigoPrincipal(f, c.normalizado))} data-pv-principal />
                  <strong>{c.codigo}</strong>
                </label>
                <span className="pv-tag">{c.principal ? "principal (SKU)" : "referência"}</span>
                <span className="pv-tag pv-tag-fraca">{ROTULO_ORIGEM_CAMPO[c.origem] || c.origem}</span>
                {(c.soletrado || c.conferido === false || c.origem === "foto") && (
                  <label className="pv-check pv-alerta">
                    <input type="checkbox" checked={c.conferido !== false} onChange={(e) => atualizar((f) => conferirCodigo(f, c.normalizado, e.target.checked))} data-pv-conferir-codigo />
                    conferido letra por letra
                  </label>
                )}
                <button type="button" className="pv-link pv-perigo" onClick={() => atualizar((f) => removerCodigo(f, c.normalizado))} aria-label={`Remover ${c.codigo}`}>remover</button>
              </li>
            ))}
          </ul>
          <div className="pv-consulta">
            <button type="button" className="pv-botao" onClick={consultarBase} disabled={!cp || consulta.estado === "buscando"} data-pv-consultar-base>
              🔎 Consultar base PAIIA
            </button>
            {consulta.texto && <span className={`pv-consulta-texto pv-${consulta.estado}`} data-pv-consulta={consulta.estado}>{consulta.texto}</span>}
          </div>

          <h3>Dados</h3>
          <div className="pv-campos">
            {["descricao", "marca", "preco", "custo", "quantidade"].map((campo) => {
              const c = ficha.campos[campo];
              return (
                <CampoFicha
                  key={`${campo}:${c ? `${c.valor}:${c.em}` : ""}`}
                  campo={campo}
                  dado={c}
                  onMudar={(valor) => atualizar((f) => editarCampo(f, campo, valor))}
                  onConfirmar={(v) => atualizar((f) => confirmarCampo(f, campo, v))}
                />
              );
            })}
          </div>
          <p className="pv-dica">Marca: o padrão da loja no campo Marca do anúncio é <strong>Torken</strong>. A marca não entra no título nem na descrição.</p>

          {ficha.peca && (
            <>
              <h3>Detalhes da peça</h3>
              <ul className="pv-lista pv-detalhes" data-pv-detalhes>
                {ORDEM_ATRIBUTOS.filter((k) => ficha.atributos?.[k]).map((k) => (
                  <li key={k} data-pv-detalhe={k}>
                    <strong>{ROTULOS_ATRIBUTOS[k]}:</strong> {k === "lado" && ficha.atributos[k].valor === "par" ? "par (esquerdo e direito)" : ficha.atributos[k].valor}
                    <button type="button" className="pv-link pv-perigo" onClick={() => atualizar((f) => definirAtributo(f, k, ""))}>remover</button>
                  </li>
                ))}
                {!ORDEM_ATRIBUTOS.some((k) => ficha.atributos?.[k]) && <li className="pv-vazio">Fale lado, lente, LED/halógena ou tensão, se houver.</li>}
              </ul>
            </>
          )}

          <h3>Aplicações</h3>
          {!ficha.aplicacoes.length && <p className="pv-vazio">Nenhuma aplicação. Diga o veículo (ex.: “ônibus Neobus Mega Plus 2013 e 2014”) ou consulte a base PAIIA.</p>}
          {ficha.conversa?.veiculoParcial && <p className="pv-vazio" data-pv-veiculo-parcial>Veículo em andamento: {[ficha.conversa.veiculoParcial.tipo, ficha.conversa.veiculoParcial.montadora].filter(Boolean).join(" ")} — falta o modelo.</p>}
          <ul className="pv-lista">
            {ficha.aplicacoes.map((a) => (
              <li key={a.id} className={a.confirmada ? "pv-ok" : ""} data-pv-aplicacao={a.chave}>
                <label className="pv-check">
                  <input type="checkbox" checked={a.confirmada} onChange={(e) => atualizar((f) => confirmarAplicacao(f, a.id, e.target.checked))} data-pv-confirmar-aplicacao />
                  <strong>{[a.tipoVeiculo, a.montadora].filter(Boolean).join(" ")}{a.tipoVeiculo || a.montadora ? " · " : ""}{resumoAplicacao(a)}</strong>
                </label>
                <span className={`pv-tag ${a.origem === "usuario" ? "pv-tag-alerta" : "pv-tag-fonte"}`}>{ROTULO_ORIGEM[a.origem] || a.origem}</span>
                {a.fontes.length > 0 && <span className="pv-fonte">{a.fontes.join(" · ")}</span>}
                {a.origem === "usuario" && !a.confirmada && <span className="pv-fonte">Confira no catálogo antes de confirmar.</span>}
                <button type="button" className="pv-link pv-perigo" onClick={() => atualizar((f) => removerAplicacao(f, a.id))}>remover</button>
              </li>
            ))}
          </ul>

          <h3>Prévia do anúncio</h3>
          <label className="pv-rotulo">Título ({titulo.length}/60)</label>
          <div className="pv-previa" data-pv-titulo>{titulo || "—"}</div>
          <label className="pv-rotulo">Descrição</label>
          <pre className="pv-previa pv-previa-desc" data-pv-descricao>{descricao || "—"}</pre>

          <div className="pv-envio">
            {validacao.faltando.length > 0 && <p className="pv-falta" data-pv-faltando>Para enviar falta: {validacao.faltando.join(", ")}.</p>}
            {validacao.avisos.map((a) => <p key={a} className="pv-aviso">⚠️ {a}</p>)}
            {!usuario && <p className="pv-aviso">Entre na sua conta para salvar o anúncio e as fotos.</p>}
            {confirmandoEnvio ? (
              <div className="pv-confirma-bloco" data-pv-confirmacao-envio>
                <p>O Novo Anúncio será aberto com título, descrição, código, códigos de referência e preço. Marca e quantidade seguem para a Conferência. Você ainda vai conferir, adicionar fotos e aprovar antes de qualquer publicação.</p>
                <button type="button" className="pv-botao" onClick={enviarAoNovoAnuncio} data-pv-confirmar-envio>Abrir no Novo Anúncio</button>
                <button type="button" className="pv-link" onClick={() => setConfirmandoEnvio(false)}>Voltar</button>
              </div>
            ) : (
              <button type="button" className="pv-botao pv-botao-grande" disabled={!validacao.pronto} onClick={() => setConfirmandoEnvio(true)} data-pv-enviar-novo>
                ➡️ Enviar ao Novo Anúncio
              </button>
            )}
            <p className="pv-dica">Continuidade: esta ficha fica salva neste aparelho. Depois de enviada, o anúncio vira uma ficha da sua conta e abre no celular ou no computador pela Central de Publicação.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function CampoFicha({ campo, dado, onMudar, onConfirmar }) {
  const numero = campo === "preco" || campo === "custo";
  const inteiro = campo === "quantidade";
  const valorAtual = dado ? (numero ? Number(dado.valor).toFixed(2).replace(".", ",") : String(dado.valor)) : "";
  // O pai remonta este campo (key) quando o valor muda por voz/base.
  const [texto, setTexto] = useState(valorAtual);

  function salvar() {
    const t = texto.trim();
    if (t === valorAtual) return;
    if (!t) return onMudar("");
    if (numero) {
      const n = Number(t.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n) && n >= 0) onMudar(Math.round(n * 100) / 100);
      else setTexto(valorAtual);
      return;
    }
    if (inteiro) {
      const n = Number(t);
      if (Number.isInteger(n) && n >= 0) onMudar(n);
      else setTexto(valorAtual);
      return;
    }
    onMudar(t);
  }

  return (
    <div className={`pv-campo ${dado?.confirmado ? "pv-ok" : ""}`} data-pv-campo={campo}>
      <label className="pv-rotulo" htmlFor={`pv-${campo}`}>{ROTULOS[campo]}</label>
      <input
        id={`pv-${campo}`}
        value={texto}
        inputMode={numero ? "decimal" : inteiro ? "numeric" : "text"}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        placeholder={numero ? "0,00" : ""}
        data-pv-campo-input={campo}
      />
      <div className="pv-campo-pe">
        {dado ? <span className="pv-tag pv-tag-fraca">{ROTULO_ORIGEM_CAMPO[dado.origem] || dado.origem}{numero ? ` · ${formatarValor(campo, dado.valor)}` : ""}</span> : <span className="pv-tag pv-tag-fraca">vazio</span>}
        {dado && (
          <label className="pv-check">
            <input type="checkbox" checked={Boolean(dado.confirmado)} onChange={(e) => onConfirmar(e.target.checked)} data-pv-confirmar-campo={campo} />
            conferido
          </label>
        )}
      </div>
    </div>
  );
}

const CSS_VOZ = `
.pv { max-width: 1180px; margin: 0 auto 40px; text-align: left; color: #e2e8f0; }
.pv *, .pv *::before, .pv *::after { box-sizing: border-box; }
.pv-topo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.pv-topo h1 { margin: 0; font-size: 24px !important; color: #fff; }
.pv-sub { color: #94a3b8; font-size: 13px; }
.pv-voltar { padding: 8px 12px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: #cbd5e1; cursor: pointer; font-weight: 700; }
.pv-colunas { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 18px; align-items: start; }
.pv-conversa, .pv-ficha { border: 1px solid #1e293b; background: #0b1220; border-radius: 18px; padding: 16px; }
.pv-mic-area { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 14px; background: linear-gradient(145deg, #0f172a, #082f49); border: 1px solid rgba(56,189,248,.35); }
.pv-mic { width: 84px; height: 84px; flex: none; border-radius: 50%; border: 0; cursor: pointer; color: #fff; display: grid; place-items: center;
  background: radial-gradient(circle at 30% 25%, #22d3ee, #0284c7 55%, #1d4ed8); box-shadow: 0 10px 28px rgba(14,165,233,.45); transition: transform .15s ease; }
.pv-mic:hover { transform: scale(1.04); }
.pv-mic:focus-visible, .pv-botao:focus-visible, .pv-link:focus-visible, .pv-voltar:focus-visible { outline: 3px solid #fde68a; outline-offset: 3px; }
.pv-mic-ouvindo { background: radial-gradient(circle at 30% 25%, #f87171, #dc2626 60%, #991b1b); box-shadow: 0 0 0 8px rgba(248,113,113,.18), 0 10px 28px rgba(220,38,38,.45); animation: pv-pulso 1.2s ease-in-out infinite; }
@keyframes pv-pulso { 50% { box-shadow: 0 0 0 14px rgba(248,113,113,.08), 0 10px 28px rgba(220,38,38,.45); } }
@media (prefers-reduced-motion: reduce) { .pv-mic-ouvindo { animation: none; } }
.pv-mic-texto { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.pv-mic-texto strong { color: #fff; font-size: 16px; }
.pv-mic-texto span { color: #94a3b8; font-size: 13px; }
.pv-parcial { color: #a5f3fc; font-size: 14px; }
.pv-erro { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: rgba(127,29,29,.35); border: 1px solid #f87171; color: #fecaca; font-size: 14px; }
.pv-mensagens { margin: 12px 0; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
.pv-msg { padding: 10px 12px; border-radius: 12px; font-size: 14px; line-height: 1.5; }
.pv-msg p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.pv-msg-paiia { background: #0f172a; border: 1px solid #1e293b; }
.pv-msg-voce { background: rgba(8,145,178,.18); border: 1px solid rgba(56,189,248,.35); align-self: flex-end; max-width: 92%; }
.pv-msg-quem { font-size: 11px; font-weight: 800; letter-spacing: .5px; color: #67e8f9; text-transform: uppercase; }
.pv-aviso { color: #fde68a !important; font-size: 13px; margin: 6px 0 0; }
.pv-entrada { display: flex; gap: 8px; align-items: stretch; }
.pv-entrada textarea { flex: 1; min-width: 0; resize: vertical; padding: 10px 12px; border-radius: 12px; border: 1px solid #334155; background: #020617; color: #fff; font-size: 15px; font-family: inherit; }
.pv-botao { padding: 10px 14px; border-radius: 12px; border: 1px solid #38bdf8; background: linear-gradient(135deg, #1d4ed8, #0891b2); color: #fff; font-weight: 800; cursor: pointer; font-size: 14px; }
.pv-botao:disabled { opacity: .45; cursor: not-allowed; }
.pv-botao-claro { background: #0f172a; border-color: #334155; color: #e2e8f0; }
.pv-botao-grande { width: 100%; padding: 14px; font-size: 16px; }
.pv-link { background: none; border: 0; color: #67e8f9; cursor: pointer; font-weight: 700; padding: 4px 6px; font-size: 13px; }
.pv-link:disabled { opacity: .5; }
.pv-perigo { color: #fca5a5; }
.pv-check.pv-manter { margin: 6px 0 0; font-size: 13px; color: #cbd5e1; white-space: normal; align-items: flex-start; min-width: 0; }
.pv-fotos { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; padding: 8px; border-radius: 12px; }
.pv-destaque { border: 2px dashed #67e8f9; }
.pv-foto { width: 150px; display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 12px; border: 1px solid #1e293b; background: #0f172a; }
.pv-foto img { width: 100%; height: 110px; object-fit: contain; background: #fff; border-radius: 8px; }
.pv-chip { padding: 4px 8px; border-radius: 999px; border: 1px solid #38bdf8; background: rgba(8,145,178,.2); color: #e0f2fe; font-size: 12px; cursor: pointer; text-align: left; overflow-wrap: anywhere; }
.pv-ficha-topo { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.pv-ficha h2 { margin: 0; font-size: 18px !important; color: #fff; }
.pv-ficha h3 { margin: 16px 0 8px; font-size: 14px !important; color: #67e8f9; text-transform: uppercase; letter-spacing: .6px; }
.pv-vazio { color: #64748b; font-size: 13px; margin: 0; }
.pv-info { margin: 8px 0 0; padding: 8px 10px; border-radius: 10px; background: rgba(8,47,73,.6); border: 1px solid #0e7490; color: #cffafe; font-size: 13px; }
.pv-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.pv-lista li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 10px; border-radius: 10px; border: 1px solid #1e293b; background: #0f172a; font-size: 14px; }
.pv-lista li.pv-ok, .pv-campo.pv-ok { border-color: rgba(34,197,94,.55); }
.pv-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #cbd5e1; }
.pv-check { white-space: nowrap; }
.pv input[type="checkbox"], .pv input[type="radio"] { width: 18px !important; min-width: 18px !important; height: 18px; flex: none; accent-color: #22c55e; }
.pv-alerta { color: #fde68a; }
.pv-tag { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; background: rgba(56,189,248,.15); color: #a5f3fc; border: 1px solid rgba(56,189,248,.35); }
.pv-tag-fraca { background: transparent; color: #94a3b8; border-color: #334155; }
.pv-tag-alerta { background: rgba(250,204,21,.12); color: #fde68a; border-color: rgba(250,204,21,.45); }
.pv-tag-fonte { background: rgba(34,197,94,.12); color: #bbf7d0; border-color: rgba(34,197,94,.45); }
.pv-fonte { flex-basis: 100%; color: #94a3b8; font-size: 12px; }
.pv-consulta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
.pv-consulta-texto { font-size: 13px; color: #cbd5e1; }
.pv-nada { color: #fde68a; }
.pv-ok.pv-consulta-texto { color: #bbf7d0; }
.pv-campos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pv-campo { padding: 8px; border-radius: 10px; border: 1px solid #1e293b; background: #0f172a; }
.pv-campo:first-child { grid-column: 1 / -1; }
.pv-campo input { width: 100%; padding: 9px 10px; border-radius: 9px; border: 1px solid #334155; background: #020617; color: #fff; font-size: 15px; }
.pv-campo-pe { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.pv-rotulo { display: block; font-size: 12px; color: #94a3b8; font-weight: 700; margin: 6px 0 4px; }
.pv-dica { color: #94a3b8; font-size: 12.5px; margin: 8px 0 0; line-height: 1.5; }
.pv-previa { padding: 10px 12px; border-radius: 10px; border: 1px solid #1e293b; background: #020617; color: #e2e8f0; font-size: 14px; }
.pv-previa-desc { white-space: pre-wrap; font-family: inherit; margin: 0; max-height: 260px; overflow-y: auto; font-size: 13px; line-height: 1.5; }
.pv-envio { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.pv-falta { margin: 0; color: #fca5a5; font-size: 14px; font-weight: 700; }
.pv-confirma { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 13px; color: #fecaca; }
.pv-confirma-bloco { padding: 12px; border-radius: 12px; border: 1px solid #38bdf8; background: rgba(8,47,73,.5); display: flex; flex-direction: column; gap: 8px; }
.pv-confirma-bloco p { margin: 0; font-size: 14px; color: #e0f2fe; line-height: 1.5; }
@media (max-width: 900px) {
  .pv-colunas { grid-template-columns: minmax(0, 1fr); }
  .pv-mensagens { max-height: 300px; }
}
@media (max-width: 520px) {
  .pv-conversa, .pv-ficha { padding: 12px; border-radius: 14px; }
  .pv-campos { grid-template-columns: 1fr; }
  .pv-entrada { flex-direction: column; }
  .pv-mic { width: 72px; height: 72px; }
  .pv-foto { width: calc(50% - 5px); }
}
`;
