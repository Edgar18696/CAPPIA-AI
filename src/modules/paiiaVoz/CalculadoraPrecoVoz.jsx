// =============================================================
// PAIIA Voz — (P-03) Calcular Preço de Venda (opcional).
// Você informa o CUSTO da peça; frete, despesas, comissão, impostos e margem vêm
// dos parâmetros já existentes quando há (comissão de referência por modalidade,
// margens padrão 10/15/20%) e podem ser ajustados. Só preenche o Preço de Venda
// quando você toca em "Usar este preço". Não mexe no custo do Bling.
//   preço = (custo + frete + despesas) ÷ (1 − (comissão + impostos + margem) / 100)
// =============================================================
import { useState } from "react";
import { MARGENS_PADRAO } from "../../services/fretePrecificacao";
import { calcularPrecoVenda, comissaoReferencia, reais } from "./servicos/calculadoraPreco";

export default function CalculadoraPrecoVoz({ tipoAnuncio = "classico", freteInicial = "", aoUsarPreco }) {
  const [v, setV] = useState({ custo: "", frete: freteInicial ? String(freteInicial) : "", despesas: "", comissao: String(comissaoReferencia(tipoAnuncio)), impostos: "", margem: String(MARGENS_PADRAO[1].margem) });
  const r = calcularPrecoVenda(v);
  const campo = (k, rotulo, dica) => (
    <label key={k} style={{ display: "grid", gap: 2 }}>
      <span className="pr-rotulo">{rotulo}</span>
      <input className="pr-entrada" inputMode="decimal" value={v[k]} placeholder={dica} onChange={(e) => { const val = e.target.value; setV((o) => ({ ...o, [k]: val })); }} data-pv-calc={k} />
    </label>
  );
  return (
    <div className="pr-cartao pr-cinza" data-pv-calculadora style={{ display: "grid", gap: 6 }}>
      <strong data-pv-calc-abrir>🧮 Calcular Preço de Venda</strong>
      <p className="pr-fonte" style={{ margin: 0 }}>Opcional. O custo é o que VOCÊ pagou pela peça (não é preço de mercado). O preço sugerido só vai para o Preço de Venda se você tocar em “Usar”.</p>
      {campo("custo", "Custo da Mercadoria (R$)", "o que você pagou pela peça")}
      {campo("frete", "Frete (R$)", "0 se não houver")}
      {campo("despesas", "Despesas (R$)", "embalagem, etc.")}
      {campo("comissao", "Comissão do Marketplace (%)", "ex.: 12")}
      {campo("impostos", "Impostos (%)", "ex.: 0")}
      {campo("margem", "Margem Desejada (%)", "ex.: 15")}
      {r.ok ? (
        <div data-pv-calc-resultado>
          <p style={{ margin: "4px 0" }}>Preço de Venda Sugerido: <b data-pv-calc-preco>{reais(r.preco)}</b></p>
          <p className="pr-fonte" style={{ margin: 0 }}>Custo {reais(r.partes.custo)} · Frete {reais(r.partes.frete)} · Despesas {reais(r.partes.despesas)} · Comissão {reais(r.partes.comissao)} · Impostos {reais(r.partes.impostos)} · Lucro {reais(r.partes.lucro)}</p>
          <div className="pr-linha" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {MARGENS_PADRAO.map((m) => { const s = calcularPrecoVenda({ ...v, margem: m.margem }); return s.ok ? <button key={m.chave} type="button" className="pr-link" onClick={() => setV((o) => ({ ...o, margem: String(m.margem) }))}>{m.rotulo} {m.margem}%: {reais(s.preco)}</button> : null; })}
          </div>
          <button type="button" className="pr-botao pr-grande" onClick={() => aoUsarPreco?.(r.preco.toFixed(2).replace(".", ","))} data-pv-calc-usar>✅ Usar {reais(r.preco)} como Preço de Venda</button>
        </div>
      ) : <p className="pr-fonte" data-pv-calc-erro>{r.erro}</p>}
    </div>
  );
}
