import { useMemo, useState } from "react";

const CAMPOS_FIXOS = [
  ["aluguel", "Aluguel", "Aluguel do imóvel, condomínio e locação do espaço da empresa."],
  ["energia", "Energia", "Conta mensal de energia usada pela empresa."],
  ["agua", "Água", "Conta mensal de água da empresa."],
  ["internet", "Internet", "Internet e telefonia usadas na operação."],
  ["folha", "Salários e encargos", "Salários, pró-labore e encargos mensais ligados à operação."],
  ["contabilidade", "Contabilidade", "Honorários mensais do contador e serviços contábeis recorrentes."],
  ["sistemas", "Sistemas e assinaturas", "Ex.: ERP, emissor de nota, PAIIA, hospedagem, domínio, ferramentas e assinaturas usadas na empresa."],
  ["transporte", "Transporte", "Ex.: combustível, motoboy, coleta, deslocamentos e fretes gerais que não pertencem a uma venda específica."],
  ["outrosFixos", "Outras despesas fixas", "Ex.: telefone, limpeza, material de escritório, segurança, manutenção e despesas mensais não listadas acima."],
];

function numero(valor) {
  const texto = String(valor ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!texto) return 0;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : 0;
}

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export const PERFIL_CUSTOS_INICIAL = {
  aluguel: "1500,00",
  energia: "350,00",
  agua: "100,00",
  internet: "150,00",
  folha: "0,00",
  contabilidade: "300,00",
  sistemas: "200,00",
  transporte: "200,00",
  outrosFixos: "200,00",
  vendasMensais: "300",
  custoOperacionalPedido: "2,00",
  comissaoPercentual: "16",
  impostoPercentual: "6",
  taxaFixaMarketplace: "6,00",
};

export function carregarPerfilCustos() {
  try {
    return {
      ...PERFIL_CUSTOS_INICIAL,
      ...JSON.parse(localStorage.getItem("paiiaPerfilCustos") || "{}"),
    };
  } catch {
    return { ...PERFIL_CUSTOS_INICIAL };
  }
}

export function resumirPerfilCustos(perfil = {}) {
  const totalFixoMensal = CAMPOS_FIXOS.reduce(
    (total, [campo]) => total + numero(perfil[campo]),
    0
  );
  const vendasMensais = numero(perfil.vendasMensais);
  const custoFixoPorVenda =
    vendasMensais > 0 ? totalFixoMensal / vendasMensais : 0;

  return {
    totalFixoMensal,
    vendasMensais,
    custoFixoPorVenda,
    custoOperacionalPedido: numero(perfil.custoOperacionalPedido),
    comissaoPercentual: numero(perfil.comissaoPercentual),
    impostoPercentual: numero(perfil.impostoPercentual),
    taxaFixaMarketplace: numero(perfil.taxaFixaMarketplace),
  };
}

export default function MeusCustos({ value, onChange }) {
  const [aberto, setAberto] = useState(true);
  const [mensagem, setMensagem] = useState("");

  const resumo = useMemo(() => resumirPerfilCustos(value), [value]);

  function alterar(campo, novoValor) {
    onChange?.({ ...value, [campo]: novoValor });
    setMensagem("");
  }

  function salvar() {
    localStorage.setItem("paiiaPerfilCustos", JSON.stringify(value));
    setMensagem("✅ Perfil salvo neste computador e aplicado aos cálculos.");
  }

  function carregarExemplo() {
    onChange?.({ ...PERFIL_CUSTOS_INICIAL });
    setMensagem("🧪 Exemplo carregado. Confira os valores antes de salvar.");
  }

  return (
    <section style={bloco}>
      <button type="button" onClick={() => setAberto(!aberto)} style={cabecalho}>
        <span>
          <strong style={{ color: "#67e8f9", fontSize: "20px" }}>
            🧾 Meus Custos
          </strong>
          <small style={{ display: "block", color: "#94a3b8", marginTop: "5px" }}>
            Cadastre uma vez para o PAIIA calcular o preço mínimo real.
          </small>
        </span>
        <span style={{ color: "#67e8f9", fontSize: "18px" }}>
          {aberto ? "−" : "+"}
        </span>
      </button>

      {aberto && (
        <div style={{ paddingTop: "20px" }}>
          <p style={aviso}>
            Seus custos salvos são carregados automaticamente. Para testar a
            peça de R$ 65,00, clique em “Carregar exemplo”. Passe o mouse sobre
            o nome de cada campo para ver o que deve ser informado.
          </p>

          <h4 style={subtitulo}>Despesas fixas mensais</h4>
          <div style={grade}>
            {CAMPOS_FIXOS.map(([campo, label, ajuda]) => (
              <CampoCusto
                key={campo}
                label={label}
                ajuda={ajuda}
                value={value[campo]}
                onChange={(novoValor) => alterar(campo, novoValor)}
                prefixo="R$"
              />
            ))}
            <CampoCusto
              label="Vendas previstas por mês"
              value={value.vendasMensais}
              onChange={(novoValor) => alterar("vendasMensais", novoValor)}
              placeholder="Ex.: 100"
            />
          </div>

          <h4 style={subtitulo}>Custos da operação e marketplace</h4>
          <div style={grade}>
            <CampoCusto
              label="Custo operacional por pedido"
              ajuda="Ex.: etiqueta, fita, impressão, separação e materiais consumidos em cada pedido."
              value={value.custoOperacionalPedido}
              onChange={(novoValor) => alterar("custoOperacionalPedido", novoValor)}
              prefixo="R$"
            />
            <CampoCusto
              label="Comissão do marketplace"
              ajuda="Percentual cobrado pelo Mercado Livre, Shopee ou outro canal sobre o valor da venda."
              value={value.comissaoPercentual}
              onChange={(novoValor) => alterar("comissaoPercentual", novoValor)}
              sufixo="%"
            />
            <CampoCusto
              label="Imposto sobre a venda"
              ajuda="Percentual de imposto informado pela contabilidade para cada venda."
              value={value.impostoPercentual}
              onChange={(novoValor) => alterar("impostoPercentual", novoValor)}
              sufixo="%"
            />
            <CampoCusto
              label="Tarifa fixa por venda"
              ajuda="Valor fixo cobrado pelo marketplace por unidade ou pedido, além da comissão percentual."
              value={value.taxaFixaMarketplace}
              onChange={(novoValor) => alterar("taxaFixaMarketplace", novoValor)}
              prefixo="R$"
            />
          </div>

          <div style={resumoStyle}>
            <div style={resumoItem}>
              <span style={resumoLabel}>Total fixo mensal</span>
              <strong style={resumoValor}>{moeda(resumo.totalFixoMensal)}</strong>
            </div>
            <div style={resumoItem}>
              <span style={resumoLabel}>Rateio fixo por venda</span>
              <strong style={resumoValor}>
                {resumo.vendasMensais > 0
                  ? moeda(resumo.custoFixoPorVenda)
                  : "Informe as vendas/mês"}
              </strong>
            </div>
            <div style={resumoItem}>
              <span style={resumoLabel}>Percentuais sobre a venda</span>
              <strong style={resumoValor}>
                {(resumo.comissaoPercentual + resumo.impostoPercentual).toFixed(2)}%
              </strong>
            </div>
          </div>

          {resumo.totalFixoMensal > 0 && resumo.vendasMensais <= 0 && (
            <p style={{ ...aviso, borderColor: "#f59e0b", color: "#fde68a" }}>
              ⚠ Informe quantas vendas espera fazer por mês para ratear as despesas fixas.
            </p>
          )}

          <div style={rodape}>
            <button type="button" onClick={carregarExemplo} style={botaoExemplo}>
              🧪 Carregar exemplo
            </button>
            <button type="button" onClick={salvar} style={botaoSalvar}>
              💾 Salvar meus custos
            </button>
            <span style={{ color: "#86efac", fontSize: "12px" }}>{mensagem}</span>
          </div>

          <p style={{ color: "#64748b", fontSize: "11px", margin: "14px 0 0" }}>
            Confirme alíquotas e obrigações tributárias com seu contador.
          </p>
        </div>
      )}
    </section>
  );
}

function CampoCusto({
  label,
  ajuda,
  value,
  onChange,
  prefixo,
  sufixo,
  placeholder = "0,00",
}) {
  return (
    <label style={{ display: "block" }} title={ajuda || ""}>
      <span style={{ display: "block", color: "#cbd5e1", fontSize: "12px", marginBottom: "6px", cursor: ajuda ? "help" : "default" }}>
        {label}{ajuda ? " ⓘ" : ""}
      </span>
      <div style={campoWrap}>
        {prefixo && <span style={adorno}>{prefixo}</span>}
        <input
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={input}
        />
        {sufixo && <span style={adorno}>{sufixo}</span>}
      </div>
    </label>
  );
}

const bloco = {
  marginTop: "18px",
  padding: "22px",
  borderRadius: "16px",
  background: "linear-gradient(135deg,#071426,#0f172a)",
  border: "1px solid #0e7490",
};

const cabecalho = {
  width: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  textAlign: "left",
  cursor: "pointer",
};

const aviso = {
  padding: "11px 13px",
  borderRadius: "10px",
  border: "1px solid #155e75",
  background: "rgba(8,145,178,.08)",
  color: "#bae6fd",
  fontSize: "12px",
  lineHeight: 1.5,
};

const subtitulo = {
  color: "#e2e8f0",
  fontSize: "14px",
  margin: "20px 0 10px",
};

const grade = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: "12px",
};

const campoWrap = {
  display: "flex",
  alignItems: "center",
  minHeight: "44px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#020617",
  overflow: "hidden",
};

const input = {
  width: "100%",
  padding: "11px 9px",
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#f8fafc",
  fontSize: "14px",
};

const adorno = {
  padding: "0 10px",
  color: "#67e8f9",
  fontSize: "12px",
  fontWeight: "bold",
};

const resumoStyle = {
  marginTop: "18px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: "10px",
};

const resumoItem = {
  minWidth: 0,
  padding: "13px 14px",
  borderRadius: "11px",
  border: "1px solid #334155",
  background: "rgba(2,6,23,.72)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const resumoLabel = {
  color: "#94a3b8",
  fontSize: "11px",
};

const resumoValor = {
  color: "#f8fafc",
  fontSize: "15px",
  lineHeight: 1.3,
  overflowWrap: "anywhere",
};

const rodape = {
  marginTop: "18px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const botaoExemplo = {
  padding: "11px 16px",
  borderRadius: "10px",
  border: "1px solid #64748b",
  background: "#0f172a",
  color: "#e2e8f0",
  fontWeight: "bold",
  cursor: "pointer",
};

const botaoSalvar = {
  padding: "11px 16px",
  borderRadius: "10px",
  border: "1px solid #22d3ee",
  background: "linear-gradient(135deg,#2563eb,#0891b2)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

