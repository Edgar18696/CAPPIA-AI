import { useCallback, useEffect, useRef, useState } from "react";
import { salvarFichaNovoAnuncio } from "../services/fichaNovoAnuncioService";
import { lerRascunhoAnuncio, rascunhoMaisRecente } from "./useNovoAnuncio";
import { deveIniciarNovaCriacaoMidia } from "../services/limparEstadoTemporarioMidia";
import {
  podeCriarFicha,
  montarNovoAnuncioParaFicha,
  assinaturaNovoAnuncio,
  idFichaValido,
  normalizarCodigoFicha,
} from "../services/fichaNovoAnuncio";

/*
 * FICHA PERSISTENTE DURANTE O NOVO ANÚNCIO.
 * - Cria a ficha na base assim que há código/OEM + algum conteúdo.
 * - Depois grava SEMPRE na mesma ficha (ID guardado no rascunho do navegador
 *   e no endereço ?ficha=), com espera de 1,5 s para juntar a digitação.
 * - Saindo da tela com alteração pendente: grava na hora.
 * - O navegador continua como cópia rápida; a base é a persistência principal.
 */
const ESPERA_MS = 1500;

/**
 * ID da ficha em andamento ao abrir o Novo Anúncio: o do endereço
 * (?tela=novoAnuncio&ficha=) ou o do MESMO rascunho que a tela restaura.
 * Criação nova (Home / Limpar) começa sem ficha.
 */
export function fichaDoNovoAnuncioAoAbrir() {
  const nada = { id: "", codigo: "" };
  try {
    if (deveIniciarNovaCriacaoMidia()) return nada;
    const usado = rascunhoMaisRecente();
    const codigo = normalizarCodigoFicha(usado?.codigo || usado?.oem);
    const url = new URL(window.location.href);
    const daUrl = url.searchParams.get("ficha") || "";
    if (url.searchParams.get("tela") === "novoAnuncio" && idFichaValido(daUrl)) {
      return { id: daUrl, codigo: String(usado?.fichaIdPAIIA || "") === daUrl ? codigo : "" };
    }
    return idFichaValido(usado?.fichaIdPAIIA) ? { id: usado.fichaIdPAIIA, codigo } : nada;
  } catch {
    return nada;
  }
}
/** ID da ficha que está no rascunho DESTE navegador ("" se não houver). */
export function fichaDoRascunhoLocal() {
  try {
    const id = rascunhoMaisRecente()?.fichaIdPAIIA;
    if (idFichaValido(id)) return id;
    for (const chave of ["novoAnuncioTemporario", "rascunhoNovoAnuncioTemp"]) {
      const outro = lerRascunhoAnuncio(chave)?.fichaIdPAIIA;
      if (idFichaValido(outro)) return outro;
    }
  } catch {
    // sem acesso ao navegador
  }
  return "";
}
function fichaNoEndereco(id) {
  try {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("ficha", id);
    else url.searchParams.delete("ficha");
    url.searchParams.set("tela", "novoAnuncio");
    if (url.toString() !== window.location.href) window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    // sem acesso ao endereço
  }
}

export default function useFichaNovoAnuncio({ estado, desativado = false }) {
  const [abertura] = useState(() => (desativado ? { id: "", codigo: "" } : fichaDoNovoAnuncioAoAbrir()));
  const [fichaId, setFichaId] = useState(abertura.id);
  const [status, setStatus] = useState({ estado: fichaId ? "salvo" : "", erro: "", em: "" });
  // editou: só uma edição REAL do usuário grava uma ficha que já existe.
  // Abrir (F5, ?ficha=, Central, Voltar) e restaurar o rascunho é leitura.
  const ref = useRef({ timer: 0, gravando: null, ultima: "", id: fichaId, fechada: "", codigo: abertura.codigo, editou: false });
  ref.current.id = fichaId;

  const montado = montarNovoAnuncioParaFicha(estado, fichaId);
  const assinatura = assinaturaNovoAnuncio(montado);
  const pode = podeCriarFicha({ ...estado, fotos: estado?.fotos });
  const atualRef = useRef({ montado, assinatura, pode, estado, desativado });
  atualRef.current = { montado, assinatura, pode, estado, desativado };

  // Endereço sempre aponta a ficha em andamento (F5 / outro navegador).
  useEffect(() => {
    if (fichaId) fichaNoEndereco(fichaId);
  }, [fichaId]);
  // Saiu do Novo Anúncio: o endereço deixa de apontar a ficha (a próxima
  // tela coloca o seu próprio ?tela=; o F5 lá não reabre o Novo Anúncio).
  useEffect(() => () => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tela") === "novoAnuncio" && url.searchParams.has("ficha")) {
        url.searchParams.delete("ficha");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // ignora
    }
  }, []);

  const gravar = useCallback(async () => {
    const st = ref.current;
    st.timer = 0;
    const { montado: m, assinatura: a, pode: p, estado: e, desativado: off } = atualRef.current;
    if (off || !p) return { ok: true, vazio: true };
    if (st.fechada && st.fechada === st.id) return { ok: false, fechada: true, erro: "Esta ficha já foi publicada: alterações aqui não são gravadas nela." };
    if (a === st.ultima && st.id) return { ok: true };
    if (st.gravando) {
      await st.gravando.catch(() => null);
      return gravar();
    }
    setStatus((s) => ({ ...s, estado: "salvando", erro: "" }));
    const codigo = String(e?.codigo || e?.oem || "").trim();
    st.gravando = salvarFichaNovoAnuncio({ fichaId: st.id, codigo, titulo: e?.titulo, montado: m });
    let r;
    try {
      r = await st.gravando;
    } catch (erro) {
      r = { ok: false, erro: String(erro?.message || erro) };
    } finally {
      st.gravando = null;
    }
    if (r.ok) {
      st.ultima = a;
      st.codigo = normalizarCodigoFicha(codigo);
      if (r.fichaId !== st.id) {
        st.id = r.fichaId;
        setFichaId(r.fichaId);
      }
      setStatus({ estado: "salvo", erro: "", em: r.salvoEm });
    } else if (r.fechada) {
      st.fechada = st.id;
      setStatus({ estado: "fechada", erro: r.erro, em: "" });
    } else {
      setStatus({ estado: "erro", erro: r.erro || "Não foi possível salvar a ficha na base PAIIA.", em: "" });
    }
    return r;
  }, []);

  // Cada alteração: grava depois de uma pequena espera (não a cada tecla).
  useEffect(() => {
    if (!pode || desativado) return undefined;
    const st = ref.current;
    if (assinatura === st.ultima && st.id) return undefined;
    if (st.id && !st.editou) return undefined; // ficha aberta, sem edição: nada a gravar
    window.clearTimeout(st.timer);
    st.timer = window.setTimeout(() => { gravar(); }, ESPERA_MS);
    return undefined;
  }, [assinatura, pode, desativado, gravar]);

  // Saindo da tela com gravação pendente: grava na hora.
  useEffect(() => () => {
    const st = ref.current;
    if (st.timer) {
      window.clearTimeout(st.timer);
      gravar();
    }
  }, [gravar]);

  /** Grava agora (antes de navegar). Devolve { ok, fichaId, erro }. */
  const salvarAgora = useCallback(async () => {
    const st = ref.current;
    if (st.timer) {
      window.clearTimeout(st.timer);
      st.timer = 0;
    }
    const r = await gravar();
    return { ...r, fichaId: ref.current.id };
  }, [gravar]);

  /** Um anúncio NOVO (outro código ou "Limpar"): a próxima gravação cria outra ficha. A anterior continua na base. */
  const novaFicha = useCallback(() => {
    const st = ref.current;
    window.clearTimeout(st.timer);
    st.timer = 0;
    st.ultima = "";
    st.id = "";
    st.fechada = "";
    st.codigo = "";
    setFichaId("");
    fichaNoEndereco("");
    setStatus({ estado: "", erro: "", em: "" });
  }, []);

  /**
   * "Buscar e montar" com OUTRO código = outro anúncio → outra ficha.
   * Mesmo código (ou ficha ainda sem gravação nesta tela) = mesma ficha.
   */
  const fichaServeParaCodigo = useCallback((codigo) => {
    const st = ref.current;
    if (!st.id) return true;
    const c = normalizarCodigoFicha(codigo);
    const doEstado = normalizarCodigoFicha(atualRef.current.estado?.codigo || atualRef.current.estado?.oem);
    return !c || c === (st.codigo || doEstado);
  }, []);

  /** Edição real (evento do usuário, não de navegação): libera a gravação. */
  const marcarEdicao = useCallback((e) => {
    if (!e || !e.isTrusted) return;
    const alvo = e.target && e.target.closest ? e.target : null;
    if (alvo && alvo.closest("[data-paiia-navegacao]")) return;
    if (e.type === "click" && !(alvo && alvo.closest("button,[role=button],input,select,textarea,label"))) return;
    ref.current.editou = true;
  }, []);
  const propsInteracao = { onInputCapture: marcarEdicao, onChangeCapture: marcarEdicao, onClickCapture: marcarEdicao };

  return { fichaId, status, salvarAgora, novaFicha, fichaServeParaCodigo, propsInteracao };
}
