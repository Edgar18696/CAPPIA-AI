// =============================================================
// PAIIA — (14/11/2026) Aplicações manuais guardadas NESTE navegador
// (localStorage "paiiaAplicacoesManuaisPorCodigo"), agora presas à FICHA.
//
// Antes o valor era só a lista, por código: um anúncio NOVO do mesmo código
// herdava as aplicações de uma publicação anterior. Agora:
//   - grava { ficha, lista } (ficha = ID da ficha na base PAIIA);
//   - lê só se a ficha for a MESMA;
//   - lista antiga (sem ficha) só vale quando a cópia local da Conferência é
//     desta mesma ficha (legadoValido) — anúncio novo nunca herda.
// Funções puras (testáveis no Node).
// =============================================================

const txt = (v) => String(v ?? "").trim();

/** Valor guardado → lista desta ficha ([] se for de outra ficha ou não valer). */
export function lerAplicacoesDaFicha(valor, { fichaId = "", legadoValido = false } = {}) {
  if (Array.isArray(valor)) return legadoValido ? valor : [];
  if (valor && typeof valor === "object" && Array.isArray(valor.lista)) {
    const dona = txt(valor.ficha);
    if (!dona) return legadoValido ? valor.lista : [];
    return dona === txt(fichaId) ? valor.lista : [];
  }
  return [];
}

/** Lista → valor a gravar (null apaga). Com ficha: { ficha, lista }. */
export function valorAplicacoesDaFicha(lista, fichaId = "") {
  if (!Array.isArray(lista) || !lista.length) return null;
  const id = txt(fichaId);
  return id ? { ficha: id, lista } : lista;
}
