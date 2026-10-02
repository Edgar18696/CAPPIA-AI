import { useContasML, contasMLConectadas } from "../services/contaMLAtiva";

/*
 * "CONTA MERCADO LIVRE ATIVA: <nome>" — mostrado no cabeçalho e nas telas
 * que trabalham com o Mercado Livre. Nenhum nome de conta fixo no código:
 * tudo vem do servidor (nome devolvido pelo próprio Mercado Livre).
 */
export default function ContaMLAtivaBadge({ onClick, estilo }) {
  const e = useContasML();
  const conectadas = contasMLConectadas(e);
  if (!e.carregado || !conectadas.length) return null;
  const ativa = conectadas.find((c) => c.ativa);
  const texto = ativa
    ? `CONTA MERCADO LIVRE ATIVA: ${ativa.nickname || ativa.ml_user_id}`
    : "CONTA MERCADO LIVRE ATIVA: nenhuma — selecione";
  return (
    <button
      type="button"
      data-paiia-conta-ml-ativa={ativa?.ml_user_id || ""}
      title={ativa ? `ID Mercado Livre ${ativa.ml_user_id} · ${conectadas.length} conta(s) conectada(s)` : "Defina a conta ativa em Contas Marketplace"}
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: "999px",
        border: `1px solid ${ativa ? "#facc15" : "#f87171"}`,
        background: ativa ? "rgba(113,63,18,.55)" : "rgba(127,29,29,.55)",
        color: ativa ? "#fef08a" : "#fecaca",
        fontWeight: 800,
        fontSize: "12px",
        letterSpacing: ".3px",
        cursor: onClick ? "pointer" : "default",
        ...(estilo || {}),
      }}
    >
      🟡 {texto}
    </button>
  );
}
