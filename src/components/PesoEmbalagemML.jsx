import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import { conferirCotacao, faixaDoPreco, reais as reaisFrete } from "../services/fretePrecificacao";
import {
  AVISO_FORA_DO_LIMITE,
  AVISO_PERMANENTE,
  FONTE_LIMITES,
  LIMITES_MODALIDADE,
  MODALIDADES,
  CONFIG_EMBALAGEM_PADRAO,
  ESTAGIO_BASE,
  ROTULO_ESTAGIO,
  TEXTO_CONSENTIMENTO,
  TEXTO_DIVERGENTE,
  TEXTO_REFERENCIA_OBSERVACAO,
  TEXTO_SEM_REFERENCIA,
  medidaDaReferencia,
  mesAno,
  nivelExibido,
  referenciaAntiga,
  textoFaixa,
  NIVEL,
  ORDEM_NIVEL,
  ROTULO_NIVEL,
  TIPOS_EMBALAGEM,
  escolherMedidaParaEnvio,
  normalizarNivel,
  rotuloEmbalagem,
  compararCustos,
  dimensoesParaApi,
  divergentes,
  formatarDimensoes,
  formatarPeso,
  formatarReais,
  limitesDaModalidade,
  medidaCompleta,
  mesmaMedida,
  normalizarMedida,
  pesoConsideradoG,
  pesoCubicoG,
  rotuloModalidade,
  validarLimites,
} from "../services/logistica/logisticaMercadoLivre";

/*
 * PESO E EMBALAGEM — anúncios NOVOS do Mercado Livre.
 *
 * Hierarquia oficial: MEDIDO E VALIDADO > CONFIRMADO PELO USUÁRIO >
 * REFERÊNCIA DO MARKETPLACE > PADRÃO PAIIA > NÃO VALIDADO. Chave: SKU +
 * CONFIGURAÇÃO DE EMBALAGEM. A medida própria do usuário vale mais que o
 * padrão compartilhado. Confirmar aqui = CONFIRMADO PELO USUÁRIO (o navegador
 * nunca promove para MEDIDO E VALIDADO). Nada é preenchido por estimativa,
 * nada é reduzido para caber no limite e nada vai ao ML ou ao Bling aqui.
 */

async function chamarMLServidor(acao, extra = {}) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-publicacao", { body: { acao, ...extra } });
  if (error) return { ok: false, erro: error.message || "Falha ao falar com o servidor." };
  return data || { ok: false, erro: "Resposta vazia do servidor." };
}

function medidaDoRegistro(r) {
  if (!r) return null;
  const m = normalizarMedida(r);
  return medidaCompleta(m) ? m : null;
}

// Bling: largura × altura × profundidade (cm) e peso bruto (kg).
function medidaDoBling(p) {
  if (!p) return null;
  const pesoKg = Number(p.peso_bruto || p.peso_liquido || 0);
  const m = normalizarMedida({
    peso_g: pesoKg > 0 ? Math.round(pesoKg * 1000) : 0,
    comprimento_cm: p.profundidade,
    largura_cm: p.largura,
    altura_cm: p.altura,
  });
  return medidaCompleta(m) ? m : null;
}

const VAZIO = { peso_g: "", comprimento_cm: "", largura_cm: "", altura_cm: "" };

export default function PesoEmbalagemML({ sku, categoriaId, preco, tipoAnuncio, onChange, contaML, semTitulo = false, valorInicial = null, registroFrete = null }) {
  // Estado já conferido nesta Conferência (ficha persistente): ao voltar da
  // Central/atualizar a tela, os campos e a confirmação continuam como estavam.
  const inicialCompleto = medidaCompleta(valorInicial?.medida);
  const formInicial = inicialCompleto
    ? {
        peso_g: String(valorInicial.medida.peso_g),
        comprimento_cm: String(valorInicial.medida.comprimento_cm),
        largura_cm: String(valorInicial.medida.largura_cm),
        altura_cm: String(valorInicial.medida.altura_cm),
      }
    : VAZIO;
  // Simulações de frete/tarifa da conta Mercado Livre escolhida na revisão (conta_ml).
  const chamarML = (acao, extra = {}) => chamarMLServidor(acao, { ...extra, ...(contaML ? { conta_ml: String(contaML) } : {}) });
  const [base, setBase] = useState(null); // resposta da leitura inicial
  const [bling, setBling] = useState(null);
  const [config, setConfig] = useState((inicialCompleto && valorInicial?.config_embalagem) || CONFIG_EMBALAGEM_PADRAO);
  const [form, setForm] = useState(formInicial);
  // Modalidade: a da cotação da precificação (registro único) quando houver.
  const [modalidade, setModalidade] = useState((inicialCompleto && valorInicial?.modalidade) || registroFrete?.modalidade || "");
  const [simulacao, setSimulacao] = useState(null);
  const [confirmacao, setConfirmacao] = useState(() =>
    inicialCompleto && valorInicial?.confirmacao?.ok ? valorInicial.confirmacao : null
  );
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  // Com estado já conferido, a leitura da base não sobrescreve os campos.
  const preenchido = useRef(inicialCompleto ? (valorInicial?.config_embalagem || CONFIG_EMBALAGEM_PADRAO) : "");
  // Chave da última simulação automática (evita repetir a mesma consulta).
  const ultimaSimulacao = useRef("");

  // Medida própria salva para ESTE SKU + ESTA configuração de embalagem.
  const propriaReg = (base?.medidas_proprias || []).find((m) => m.config_embalagem === config) || null;
  const propria = medidaDoRegistro(propriaReg);
  const nivelPropria = normalizarNivel(propriaReg?.nivel_confianca);
  const referenciaML = medidaDoRegistro(base?.categoria_referencia);
  const blingMedida = medidaDoBling(bling?.produto);
  const medida = useMemo(() => normalizarMedida(form), [form]);
  const completa = medidaCompleta(medida);
  const escolha = escolherMedidaParaEnvio({
    propria: propria ? { medida: propria, nivel: nivelPropria } : null,
    informado: completa ? medida : null,
  });
  const nivelEnvio = completa ? escolha.nivel : null;
  // Referência COMPARTILHADA (só existe se 2+ contribuições consistentes).
  const refComp = base?.referencia_compartilhada || null;
  const medidaRefComp = medidaDaReferencia(refComp);
  const propriaAntiga = propriaReg ? referenciaAntiga(propriaReg.confirmado_em, base?.validade_meses) : false;
  const [consentimento, setConsentimento] = useState(null);
  const [armarRetirada, setArmarRetirada] = useState(false);
  const [avisoBase, setAvisoBase] = useState("");
  const modalidadeAtual = modalidade || base?.modalidade || "";
  const limites = completa ? validarLimites(medida, modalidadeAtual) : null;
  const simulacaoValida = Boolean(simulacao?.simulacao?.ok && simulacao.simulacao.dimensoes === dimensoesParaApi(medida) && simulacao.modalidade === modalidadeAtual);

  async function lerBase() {
    const r = await chamarML("simular_logistica", { sku, categoria_id: categoriaId || "", preco, tipoAnuncio, config_embalagem: config });
    setBase(r);
    if (!r?.ok) setErro(r?.erro || "Não foi possível ler os dados de envio.");
    return r;
  }

  // Leitura inicial: medidas próprias do SKU, referência do marketplace, modalidade e histórico.
  useEffect(() => {
    let ativo = true;
    (async () => {
      setOcupado("ler");
      const r = await chamarML("simular_logistica", { sku, categoria_id: categoriaId || "", preco, tipoAnuncio, config_embalagem: config });
      if (!ativo) return;
      setBase(r);
      setOcupado("");
      if (!r?.ok) setErro(r?.erro || "Não foi possível ler os dados de envio.");
    })();
    return () => {
      ativo = false;
    };
  }, [sku, categoriaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preenche com a medida própria da configuração escolhida (recomendação do PAIIA).
  // Só ao abrir ou trocar de configuração: nunca apaga o que o usuário digitou.
  useEffect(() => {
    if (!base?.ok || preenchido.current === config) return;
    preenchido.current = config;
    setForm(propria ? { peso_g: String(propria.peso_g), comprimento_cm: String(propria.comprimento_cm), largura_cm: String(propria.largura_cm), altura_cm: String(propria.altura_cm) } : VAZIO);
    setConfirmacao(null);
  }, [base, config]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bling: somente leitura, só para comparação (NÃO VALIDADO).
  useEffect(() => {
    let ativo = true;
    if (!sku) return undefined;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("bling-integracao", { body: { acao: "buscar_produto", codigo: sku } });
        if (ativo) setBling(data || null);
      } catch {
        if (ativo) setBling(null);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [sku]);

  const confirmadoAtual = Boolean(confirmacao?.ok && confirmacao.dimensoes === dimensoesParaApi(medida) && confirmacao.config === config);
  // Nível mostrado: só depois de confirmar (ou igual à medida própria). Senão, "A CONFIRMAR".
  const nivelTela = nivelExibido({ confirmado: confirmadoAtual, propria: propria ? { medida: propria, nivel: nivelPropria } : null, medida, nivel: nivelEnvio });
  const contribuir = consentimento ?? Boolean(base?.consentimento?.contribuir_anonimamente);

  function usarReferenciaCompartilhada() {
    if (!medidaRefComp) return;
    // Só preenche os campos: continua "a confirmar" até o usuário confirmar.
    setForm({ peso_g: String(medidaRefComp.peso_g), comprimento_cm: String(medidaRefComp.comprimento_cm), largura_cm: String(medidaRefComp.largura_cm), altura_cm: String(medidaRefComp.altura_cm) });
    setConfirmacao(null);
  }

  async function alterarConsentimento(ativar) {
    setOcupado("consentimento");
    setAvisoBase("");
    const r = await chamarML("logistica_consentimento", { confirmado: true, confirmacao: "CONSENTIMENTO", ativar });
    if (r?.ok) setConsentimento(Boolean(r.contribuir_anonimamente));
    else setAvisoBase(`❌ ${r?.erro || "Não foi possível gravar a escolha."}`);
    setOcupado("");
  }

  async function retirarContribuicoes() {
    if (!armarRetirada) {
      setArmarRetirada(true);
      return;
    }
    setOcupado("retirar");
    setAvisoBase("");
    const r = await chamarML("retirar_contribuicoes", { confirmado: true, confirmacao: "RETIRAR" });
    setAvisoBase(r?.ok ? `✅ Contribuições retiradas: ${r.retiradas}. A base foi recalculada.` : `❌ ${r?.erro || "Falha ao retirar."}`);
    setArmarRetirada(false);
    setOcupado("");
    await lerBase();
  }

  // Informa a tela de revisão.
  useEffect(() => {
    onChange?.({
      medida: completa ? medida : null,
      nivel: nivelEnvio,
      origem: nivelEnvio,
      config_embalagem: config,
      modalidade: modalidadeAtual,
      validacao: limites,
      simulacao: simulacaoValida ? simulacao.simulacao : null,
      confirmado: confirmadoAtual,
      // Dados mínimos da confirmação, para a ficha persistente da Conferência.
      confirmacao: confirmadoAtual
        ? {
            ok: true,
            dimensoes: confirmacao.dimensoes,
            config: confirmacao.config,
            confirmado_em: confirmacao.confirmado_em || "",
            confirmado_por: confirmacao.confirmado_por || "",
          }
        : null,
    });
  }, [medida, nivelEnvio, config, modalidadeAtual, simulacao, confirmacao]); // eslint-disable-line react-hooks/exhaustive-deps

  function alterar(campo, valor) {
    setForm({ ...form, [campo]: valor });
    setConfirmacao(null);
  }

  async function simular() {
    if (!completa) return;
    setOcupado("simular");
    setErro("");
    const comparar = [];
    if (propria && !mesmaMedida(propria, medida)) comparar.push({ rotulo: "Medida própria", medida: propria });
    if (medidaRefComp && !mesmaMedida(medidaRefComp, medida)) comparar.push({ rotulo: "Referência compartilhada", medida: medidaRefComp });
    if (referenciaML) comparar.push({ rotulo: "Referência do marketplace", medida: referenciaML });
    if (blingMedida) comparar.push({ rotulo: "Cadastro Bling", medida: blingMedida });
    const r = await chamarML("simular_logistica", {
      sku,
      categoria_id: categoriaId || "",
      preco,
      tipoAnuncio,
      modalidade: modalidadeAtual,
      config_embalagem: config,
      medida,
      comparar,
    });
    setSimulacao(r);
    if (!r?.ok) setErro(r?.erro || "Falha na simulação.");
    setOcupado("");
    return r;
  }

  // Simulação oficial automática (somente leitura) quando os 4 campos estão
  // preenchidos: mostra o peso considerado pelo ML e o frete estimado.
  // Mesma consulta do antigo botão "Simular frete"; nada é gravado aqui.
  const precoValido = Number(String(preco ?? "").replace(",", ".")) > 0;
  const chaveSimulacao = completa ? `${dimensoesParaApi(medida)}|${modalidadeAtual}|${config}|${preco}` : "";
  useEffect(() => {
    if (!completa || !precoValido || !base?.ok || ocupado || simulacaoValida) return undefined;
    if (ultimaSimulacao.current === chaveSimulacao) return undefined;
    const t = setTimeout(() => {
      ultimaSimulacao.current = chaveSimulacao;
      simular();
    }, 900);
    return () => clearTimeout(t);
  }, [chaveSimulacao, ocupado, base, simulacaoValida, precoValido]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmar() {
    if (!completa || !simulacaoValida) return;
    setOcupado("confirmar");
    setErro("");
    const comparacao = {};
    for (const c of simulacao.comparacoes || []) comparacao[c.rotulo] = { dimensoes: c.dimensoes, custo: c.custo_vendedor, peso_considerado_g: c.peso_considerado_g };
    const r = await chamarML("confirmar_logistica", {
      confirmado: true,
      confirmacao: "MEDIDA",
      sku,
      nivel: NIVEL.CONFIRMADO_PELO_USUARIO, // confirmar não é comprovar
      config_embalagem: config,
      medida,
      modalidade: modalidadeAtual,
      categoria_id: categoriaId || "",
      preco,
      tipoAnuncio,
      simulacao: simulacao.simulacao,
      comparacao,
    });
    if (r?.ok) {
      setConfirmacao({ ...r, dimensoes: dimensoesParaApi(medida), config });
      preenchido.current = config; // mantém na tela o que foi confirmado
      await lerBase();
    } else setErro(r?.erro || "Falha ao confirmar.");
    setOcupado("");
  }

  const sim = simulacaoValida ? simulacao.simulacao : null;
  const custoPorRotulo = Object.fromEntries((simulacao?.comparacoes || []).map((c) => [c.rotulo, c]));
  const haDivergencia =
    completa &&
    [propria, referenciaML, blingMedida].some((m) => m && divergentes(m, medida));
  // Limites da modalidade: aparecem sempre, mesmo antes de preencher a medida.
  const limitesInfo = limitesDaModalidade(modalidadeAtual);
  const modalidadesAtivas = (base?.modalidades || []).filter((m) => m.ativo && MODALIDADES[m.tipo]);
  const outrasConfigs = (base?.medidas_proprias || []).filter((m) => m.config_embalagem !== config);

  const statusMedida = confirmacao?.ok
    ? "✅ Peso e medidas confirmados. Ficam salvos para os próximos anúncios deste produto."
    : propria
      ? "Medida já cadastrada para este produto. Confira e confirme."
      : completa
        ? "Confira os valores e confirme."
        : "Peso e medidas ainda não cadastrados. Informe a embalagem pronta para envio.";
  const simulacaoFalhou = Boolean(simulacao && (!simulacao.ok || (simulacao.simulacao && !simulacao.simulacao.ok)) && !simulacaoValida);
  const calculando = ocupado === "simular";
  const valorPesoML = sim ? formatarPeso(sim.peso_considerado_g) : calculando ? "calculando..." : "—";
  const valorFrete = sim ? `${formatarReais(sim.custo_vendedor)} por envio` : calculando ? "calculando..." : simulacaoFalhou ? "não disponível" : "—";
  const podeConfirmar = completa && simulacaoValida && !ocupado && limites?.dentro !== false && !confirmadoAtual;
  // Conferência ⑥ NÃO é outro cálculo: o frete é o da PRECIFICAÇÃO
  // (registro único). A leitura do ML aqui só confere se continua igual.
  const freteRegistro = registroFrete?.final || null;
  const conferenciaFrete = (() => {
    if (!registroFrete) return { estado: "sem_registro", texto: "Sem cotação de frete da precificação: volte ao Novo Anúncio (🚚 Frete Mercado Livre) e cote." };
    if (!freteRegistro) return { estado: "sem_final", texto: "A precificação ainda não cotou o preço final: volte ao Novo Anúncio e recalcule." };
    if (!sim) return { estado: "aguardando", texto: "" };
    if (faixaDoPreco(preco) !== faixaDoPreco(freteRegistro.preco_cotado)) return { estado: "diferente", texto: "O preço desta Conferência está em outra faixa de frete: volte ao Novo Anúncio e recalcule a precificação." };
    const c = conferirCotacao({ registro: registroFrete, nova: { ok: true, custo_vendedor: sim.custo_vendedor, peso_cobrado_g: sim.peso_considerado_g } });
    return c.ok ? { estado: "igual", texto: "✔ Mercado Livre conferido agora: igual ao frete da precificação." } : { estado: "diferente", texto: `⚠ ${c.motivo}` };
  })();

  return (
    <div data-paiia-peso-embalagem style={bloco}>
      {!semTitulo && <strong style={subtitulo}>PESO E EMBALAGEM</strong>}

      {ocupado === "ler" ? (
        <p style={info}>⏳ Carregando peso e medidas...</p>
      ) : (
        <p data-paiia-status-medida style={{ ...info, color: confirmacao?.ok ? "#86efac" : propria ? "#bae6fd" : completa ? "#e2e8f0" : "#fde68a" }}>{statusMedida}</p>
      )}

      <div style={grade}>
        <Campo rotulo="Peso (g)">
          <input data-campo="peso_g" style={entrada} inputMode="decimal" value={form.peso_g} onChange={(e) => alterar("peso_g", e.target.value)} placeholder="g" />
        </Campo>
        <Campo rotulo="Comprimento (cm)">
          <input data-campo="comprimento_cm" style={entrada} inputMode="decimal" value={form.comprimento_cm} onChange={(e) => alterar("comprimento_cm", e.target.value)} placeholder="cm" />
        </Campo>
        <Campo rotulo="Largura (cm)">
          <input data-campo="largura_cm" style={entrada} inputMode="decimal" value={form.largura_cm} onChange={(e) => alterar("largura_cm", e.target.value)} placeholder="cm" />
        </Campo>
        <Campo rotulo="Altura (cm)">
          <input data-campo="altura_cm" style={entrada} inputMode="decimal" value={form.altura_cm} onChange={(e) => alterar("altura_cm", e.target.value)} placeholder="cm" />
        </Campo>
      </div>

      <Campo rotulo="Modalidade de envio">
        <select data-paiia-modalidade-envio style={{ ...entrada, maxWidth: 360 }} value={modalidadeAtual} disabled={modalidadesAtivas.length < 2} onChange={(e) => { setModalidade(e.target.value); setConfirmacao(null); }}>
          {modalidadesAtivas.length ? (
            modalidadesAtivas.map((m) => (
              <option key={m.tipo} value={m.tipo}>{nomeSimplesModalidade(m.tipo)}</option>
            ))
          ) : (
            <option value={modalidadeAtual}>{modalidadeAtual ? nomeSimplesModalidade(modalidadeAtual) : "Mercado Envios"}</option>
          )}
        </select>
      </Campo>

      <div data-paiia-resumo-envio style={resumoEnvio}>
        <div style={linhaResumo}><span>Peso considerado pelo ML</span><b data-paiia-peso-ml>{valorPesoML}</b></div>
        <div style={linhaResumo}><span>Frete da precificação</span><b data-paiia-frete-precificacao-conf>{freteRegistro ? `${reaisFrete(freteRegistro.custo_vendedor)} por envio (${freteRegistro.origem === "mercado_livre" ? "cotação ML" : "ESTIMATIVA PAIIA"}, ${freteRegistro.faixa_rotulo})` : "—"}</b></div>
        <div style={linhaResumo}><span>Conferência do ML agora</span><b data-paiia-frete-estimado>{valorFrete}</b></div>
        {conferenciaFrete.texto && (
          <div data-paiia-frete-conferencia={conferenciaFrete.estado} style={{ ...linhaResumo, color: conferenciaFrete.estado === "igual" ? "#86efac" : "#fca5a5", fontWeight: 700 }}>
            {conferenciaFrete.texto}
          </div>
        )}
      </div>

      {limites?.dentro === false && (
        <div data-paiia-fora-limite style={alerta}>
          ⚠ Fora do limite de {nomeSimplesModalidade(modalidadeAtual) || limites.modalidade}: {limites.excedidos.map((e) => e.texto).join("; ")}. Confira a embalagem ou escolha outra modalidade.
        </div>
      )}
      {!precoValido && completa && <p style={info}>Informe o preço do anúncio para calcular o frete.</p>}
      {erro && <p style={erroTxt}>❌ {erro}</p>}

      <button type="button" data-paiia-confirmar-medida onClick={confirmar} disabled={!podeConfirmar} style={{ ...botaoVerde, opacity: podeConfirmar ? 1 : 0.55 }}>
        {ocupado === "confirmar" ? "⏳ Confirmando..." : confirmadoAtual ? "✔ Peso e medidas confirmados" : "Confirmar peso e medidas"}
      </button>

      <details data-paiia-detalhes-tecnicos style={{ marginTop: 12 }}>
        <summary style={{ color: "#64748b", fontSize: 12, cursor: "pointer" }}>Ver detalhes técnicos</summary>
        <div style={{ marginTop: 6 }}>
      <p data-paiia-aviso-permanente style={avisoForte}>{AVISO_PERMANENTE}</p>
      <div style={grade}>
        <Campo rotulo="Configuração da embalagem">
          <select data-paiia-config-embalagem style={entrada} value={config} onChange={(e) => { setConfig(e.target.value); setSimulacao(null); setConfirmacao(null); }}>
            {TIPOS_EMBALAGEM.map((t) => (
              <option key={t.id} value={t.id}>{t.rotulo}</option>
            ))}
          </select>
        </Campo>
      </div>
      {propria ? (
        <p data-paiia-recomendacao style={{ ...info, color: "#bae6fd" }}>
          Recomendação do PAIIA para {sku} · {rotuloEmbalagem(config)}: {formatarDimensoes(propria)}, {formatarPeso(propria.peso_g)} — sua medida [{ROTULO_NIVEL[nivelPropria] || "—"}]{propriaAntiga ? ` · referência antiga (${mesAno(propriaReg.confirmado_em)}) — reconfirme` : ""}. Se a sua embalagem for diferente, altere os valores: a recomendação fica guardada.
        </p>
      ) : (
        <p style={info}>Sem medida registrada para {sku || "este SKU"} nesta configuração. Pese e meça a embalagem pronta para envio.{outrasConfigs.length ? ` Há medida sua em: ${outrasConfigs.map((m) => rotuloEmbalagem(m.config_embalagem)).join(", ")}.` : ""}</p>
      )}

      <div style={{ ...info, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        Nível de confiança:
        {ORDEM_NIVEL.map((o) => (
          <span key={o} data-origem={o} data-ativa={completa && nivelTela === o ? "sim" : "nao"} style={selo(completa && nivelTela === o)}>
            [{ROTULO_NIVEL[o]}]
          </span>
        ))}
        {!completa && <span style={{ color: "#fca5a5" }}>sem medida — preencha os 4 campos</span>}
        {completa && !nivelTela && <span data-paiia-a-confirmar style={{ color: "#fde68a", fontWeight: "bold" }}>A CONFIRMAR</span>}
      </div>
      <p data-paiia-nota-nivel style={{ ...info, fontSize: 11 }}>
        Ao confirmar, a medida fica como <b>CONFIRMADO PELO USUÁRIO</b>. <b>MEDIDO E VALIDADO</b> exige o processo de validação do PAIIA (ainda não disponível): confirmar não é comprovar.
      </p>

      <table style={tabela}>
        <tbody>
          <Linha rotulo="Peso físico" valor={completa ? formatarPeso(medida.peso_g) : "___"} />
          <Linha rotulo="Peso cúbico calculado" valor={completa ? `${formatarPeso(pesoCubicoG(medida))} (C × L × A ÷ 6.000)` : "___"} />
          <Linha
            rotulo="Peso/faixa cobrada"
            valor={sim ? `${formatarPeso(sim.peso_considerado_g)} (simulação oficial)` : completa ? `${formatarPeso(pesoConsideradoG(medida))} (cálculo PAIIA — simule para confirmar)` : "___"}
          />
          <Linha rotulo="Custo simulado" valor={sim ? `${formatarReais(sim.custo_vendedor)} por envio (vendedor, frete grátis)` : "R$ ___"} />
          <Linha rotulo="Modalidade logística" valor={modalidadeAtual ? rotuloModalidade(modalidadeAtual) : "___"} />
        </tbody>
      </table>

      {/* LIMITES */}
      <div data-paiia-limites style={{ marginTop: 10 }}>
        <strong style={{ color: "#e2e8f0", fontSize: 13 }}>LIMITES — {modalidadeAtual ? rotuloModalidade(modalidadeAtual) : "modalidade não identificada"}</strong>
        {limitesInfo ? (
          <p style={info}>
            {limitesInfo.nome}: peso até {formatarPeso(limitesInfo.peso_max_g)}; soma C + L + A até {limitesInfo.soma_max_cm} cm; maior lado até {limitesInfo.lado_max_cm} cm.
            <br />
            <span style={{ fontSize: 11 }}>Fonte: {FONTE_LIMITES}. Mínimos: não informados pelo ML.</span>
          </p>
        ) : (
          <p style={info}>
            Limites desta modalidade não encontrados na documentação consultada. Referência geral:{" "}
            {Object.values(LIMITES_MODALIDADE).map((l) => `${l.nome} ${formatarPeso(l.peso_max_g)}/${l.soma_max_cm} cm/${l.lado_max_cm} cm`).join(" · ")}
          </p>
        )}
        {limites?.dentro === false && (
          <div data-paiia-fora-limite style={alerta}>
            <b>{AVISO_FORA_DO_LIMITE}</b>
            <ul style={{ margin: "6px 0 0 18px" }}>
              {limites.excedidos.map((e) => (
                <li key={e.campo}>{e.texto}</li>
              ))}
            </ul>
            <div>Modalidade logística atual: {limites.modalidade}. O PAIIA não reduz peso nem medidas: confira a embalagem ou escolha outra modalidade.</div>
          </div>
        )}
      </div>

      {/* COMPARAÇÃO */}
      {(propria || referenciaML || blingMedida || refComp) && (
        <div data-paiia-comparacao style={{ marginTop: 12 }}>
          <strong style={{ color: haDivergencia ? "#facc15" : "#e2e8f0", fontSize: 13 }}>
            {haDivergencia ? "⚠ Divergência entre as fontes" : "Comparação das fontes"}
          </strong>
          <table style={tabela}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                <th style={celula}>Fonte</th>
                <th style={celula}>Embalagem</th>
                <th style={celula}>Peso</th>
                <th style={celula}>Peso ML</th>
                <th style={celula}>Frete</th>
                <th style={celula}>Diferença</th>
              </tr>
            </thead>
            <tbody>
              <LinhaFonte rotulo="MEDIDA PRÓPRIA (recomendada)" m={propria} extra={propria ? ` [${ROTULO_NIVEL[nivelPropria] || "—"}]` : " — nenhuma nesta configuração"} c={custoPorRotulo["Medida própria"] || (propria && mesmaMedida(propria, medida) ? sim : null)} base={sim} />
              <LinhaFonte
                rotulo="REFERÊNCIA COMPARTILHADA PAIIA"
                m={medidaRefComp}
                extra={
                  !refComp
                    ? ` — ${TEXTO_SEM_REFERENCIA}`
                    : refComp.estagio === ESTAGIO_BASE.DIVERGENTE
                      ? ` — DIVERGENTE: ${textoFaixa(refComp.faixa)}`
                      : ` — EM OBSERVAÇÃO · ${refComp.qtd_validacoes_independentes} contribuições independentes · ${mesAno(refComp.ultima_validacao_mes)}`
                }
                c={custoPorRotulo["Referência compartilhada"] || (medidaRefComp && mesmaMedida(medidaRefComp, medida) ? sim : null)}
                base={sim}
              />
              <LinhaFonte rotulo="REFERÊNCIA DE CATEGORIA DO MARKETPLACE" m={referenciaML} extra=" (média da categoria — só referência)" c={custoPorRotulo["Referência do marketplace"]} base={sim} />
              <LinhaFonte rotulo="CADASTRO BLING" m={blingMedida} extra={blingMedida ? " [NÃO VALIDADO]" : bling?.encontrado === false ? " — SKU não encontrado" : " — sem peso/medidas"} c={custoPorRotulo["Cadastro Bling"]} base={sim} />
              <LinhaFonte rotulo="MEDIDA QUE SERÁ ENVIADA AO MARKETPLACE" m={completa ? medida : null} extra={completa ? (nivelTela ? ` [${ROTULO_NIVEL[nivelTela]}]` : " [A CONFIRMAR — vira CONFIRMADO PELO USUÁRIO só depois da sua confirmação]") : " — nenhuma"} c={sim} destaque />
            </tbody>
          </table>
          {refComp?.estagio === ESTAGIO_BASE.EM_OBSERVACAO && (
            <div data-paiia-ref-compartilhada="observacao" style={{ ...info, color: "#bae6fd" }}>
              {ROTULO_ESTAGIO[refComp.estagio]}: {TEXTO_REFERENCIA_OBSERVACAO}{" "}
              <button type="button" data-paiia-usar-referencia onClick={usarReferenciaCompartilhada} style={{ ...botaoCinza, marginTop: 4, padding: "4px 10px", fontSize: 12 }}>
                Usar como ponto de partida
              </button>
            </div>
          )}
          {refComp?.estagio === ESTAGIO_BASE.DIVERGENTE && (
            <div data-paiia-ref-compartilhada="divergente" style={{ ...info, color: "#fde68a" }}>
              ⚠ {TEXTO_DIVERGENTE} (faixa: {textoFaixa(refComp.faixa)}).
              {refComp.possiveis_configuracoes_distintas ? " Há indício de embalagens diferentes para este SKU: revise a configuração da embalagem." : ""}
            </div>
          )}
          <p style={{ ...info, fontSize: 11 }}>Referência compartilhada, referência de categoria do marketplace e Bling aparecem só para comparação; nunca substituem a sua medida. PADRÃO PAIIA: ainda bloqueado.</p>
        </div>
      )}

      {sim && (
        <p data-paiia-resultado-simulacao style={{ ...info, color: "#86efac" }}>
          Simulação oficial (somente leitura): {sim.dimensoes.replace(",", " cm, ")} g → ML considera {formatarPeso(sim.peso_considerado_g)}; custo estimado {formatarReais(sim.custo_vendedor)} por envio.
        </p>
      )}
      {simulacao?.ok && simulacao.simulacao && !simulacao.simulacao.ok && <p style={erroTxt}>❌ {simulacao.simulacao.erro}</p>}
      {confirmacao?.ok && (
        <p data-paiia-medida-confirmada style={{ ...info, color: "#86efac" }}>
          Registrado no histórico do PAIIA por {confirmacao.confirmado_por || "você"} em {new Date(confirmacao.confirmado_em).toLocaleString("pt-BR")}.
          {confirmacao.motivo ? ` ${confirmacao.motivo}` : ""}
          {confirmacao.contribuicao === "registrada" ? " Contribuição anônima registrada." : ""}
        </p>
      )}
      <button type="button" data-paiia-simular-frete onClick={() => { ultimaSimulacao.current = chaveSimulacao; simular(); }} disabled={!completa || !!ocupado || !precoValido} style={{ ...botaoCinza, padding: "6px 12px", fontSize: 12 }}>
        {calculando ? "⏳ Simulando..." : "Simular frete de novo"}
      </button>
      {/* BASE LOGÍSTICA COMPARTILHADA — consentimento (desligado por padrão) */}
      <div data-paiia-consentimento style={{ marginTop: 12, padding: 10, borderRadius: 10, border: "1px solid #1f2937" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "#e2e8f0", fontSize: 13 }}>
          <input type="checkbox" data-paiia-contribuir checked={contribuir} disabled={!!ocupado || !base?.ok} onChange={(e) => alterarConsentimento(e.target.checked)} />
          <span>
            Contribuir anonimamente com a base logística do PAIIA
            <br />
            <span style={{ color: "#94a3b8", fontSize: 11 }}>{TEXTO_CONSENTIMENTO}</span>
          </span>
        </label>
        <button type="button" data-paiia-retirar onClick={retirarContribuicoes} disabled={!!ocupado} style={{ ...botaoCinza, marginTop: 8, padding: "6px 12px", fontSize: 12 }}>
          {ocupado === "retirar" ? "⏳ Retirando..." : armarRetirada ? "Clique de novo para confirmar a retirada" : "Retirar minhas contribuições"}
        </button>
        {avisoBase && <p style={{ ...info, fontSize: 12 }}>{avisoBase}</p>}
      </div>

      {/* HISTÓRICO */}
      {(base?.historico || []).length > 0 && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>Histórico deste SKU ({base.historico.length})</summary>
          <table style={tabela}>
            <tbody>
              {base.historico.map((h, i) => (
                <tr key={i} style={{ borderTop: "1px solid #1f2937" }}>
                  <td style={celula}>{new Date(h.confirmado_em).toLocaleString("pt-BR")}</td>
                  <td style={celula}>{formatarDimensoes(h)} · {formatarPeso(h.peso_g)}</td>
                  <td style={celula}>{rotuloEmbalagem(h.config_embalagem || CONFIG_EMBALAGEM_PADRAO)}</td>
                  <td style={celula}>{ROTULO_NIVEL[normalizarNivel(h.nivel_confianca || h.origem_dados)] || h.origem_dados}</td>
                  <td style={celula}>{h.modalidade_logistica || "—"}</td>
                  <td style={celula}>ML {formatarPeso(h.peso_considerado_ml_g)} · {formatarReais(h.custo_estimado)}</td>
                  <td style={celula}>{h.resultado_validacao}</td>
                  <td style={celula}>{h.usuario_email || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
        </div>
      </details>
    </div>
  );
}

// Nome da modalidade sem o código técnico entre parênteses.
function nomeSimplesModalidade(tipo) {
  return String(rotuloModalidade(tipo) || "").replace(/\s*\([^)]*\)\s*$/, "");
}

function LinhaFonte({ rotulo, m, extra, c, base, destaque }) {
  const cmp = c && base && c !== base ? compararCustos(base.custo_vendedor, c.custo_vendedor) : null;
  return (
    <tr style={{ borderTop: "1px solid #1f2937", color: destaque ? "#fde047" : "#e2e8f0" }}>
      <td style={celula}><b>{rotulo}</b><span style={{ color: "#94a3b8" }}>{extra}</span></td>
      <td style={celula}>{m ? formatarDimensoes(m) : "—"}</td>
      <td style={celula}>{m ? formatarPeso(m.peso_g) : "—"}</td>
      <td style={celula}>{c?.peso_considerado_g ? formatarPeso(c.peso_considerado_g) : m ? `${formatarPeso(pesoConsideradoG(m))}*` : "—"}</td>
      <td style={celula}>{c?.custo_vendedor != null ? formatarReais(c.custo_vendedor) : "—"}</td>
      <td style={celula}>{cmp ? (cmp.tipo === "igual" ? "igual" : `${cmp.tipo === "economia" ? "−" : "+"}${formatarReais(Math.abs(cmp.diferenca))} vs enviada`) : ""}</td>
    </tr>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <tr style={{ borderTop: "1px solid #1f2937" }}>
      <td style={{ ...celula, color: "#94a3b8", width: 260 }}>{rotulo}:</td>
      <td style={{ ...celula, color: "#e2e8f0" }}>{valor}</td>
    </tr>
  );
}

function Campo({ rotulo, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
      {rotulo}
      {children}
    </label>
  );
}

const selo = (ativo) => ({
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  border: `1px solid ${ativo ? "#22c55e" : "#334155"}`,
  color: ativo ? "#86efac" : "#64748b",
  background: ativo ? "#052e16" : "transparent",
});
const resumoEnvio = { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#0b1220", border: "1px solid #1f2937", display: "grid", gap: 4 };
const linhaResumo = { display: "flex", justifyContent: "space-between", gap: 12, color: "#cbd5e1", fontSize: 13 };
const bloco = { marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #334155", background: "#111827" };
const subtitulo = { color: "#e2e8f0", fontSize: 15 };
const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 6 };
const entrada = { padding: "9px 10px", borderRadius: 8, border: "1px solid #334155", background: "#0b1220", color: "#e2e8f0", fontSize: 14 };
const info = { color: "#94a3b8", fontSize: 13, margin: "8px 0 0" };
const avisoForte = { color: "#fde68a", fontSize: 13, margin: "8px 0", padding: "8px 10px", borderRadius: 8, background: "#422006", border: "1px solid #a16207" };
const alerta = { color: "#fecaca", fontSize: 13, marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#450a0a", border: "1px solid #b91c1c" };
const erroTxt = { color: "#fca5a5", fontSize: 13, margin: "8px 0 0" };
const tabela = { width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 12 };
const celula = { padding: "5px 6px", verticalAlign: "top" };
const botaoBase = { marginTop: 8, padding: "10px 16px", borderRadius: 10, border: "none", fontWeight: "bold", cursor: "pointer" };
const botaoAzul = { ...botaoBase, background: "#2563eb", color: "#fff" };
const botaoVerde = { ...botaoBase, background: "#16a34a", color: "#fff" };
const botaoCinza = { ...botaoBase, background: "#334155", color: "#e2e8f0" };
