// =============================================================
// PAIIA — Fontes do anúncio pré-montado (23/11/2026). SÓ LEITURA.
// Usa a MESMA consulta do aviso ao lado do código (mesmo cache: nada é
// consultado duas vezes) e, se preciso, lê UMA ficha ou UM anúncio ML.
// Nada é criado no PAIIA, no Bling ou no Mercado Livre.
// =============================================================
import { consultarSKURapido, chaveConsulta, cacheConsultaSKU } from "./consultaInicialSKU";
import { lerBling, consultarML, lerFichasDoCodigo, blingEstaConectado } from "./produtoExistenteService";
import { lerFichaNovoAnuncio } from "./fichaNovoAnuncioService";
import { reunirFontesProvisorias, montarAnuncioProvisorio, montarDescricaoProvisoria, FONTE } from "./anuncioProvisorio";

/** contas: [{ id, nome }] só as conectadas. Nunca lança. */
export async function montarProvisorioDasFontes({ codigo, contas = [], fichaAtualId = "" }) {
  const sku = String(codigo || "").trim();
  try {
    const blingConectado = await blingEstaConectado().catch(() => null);
    const chave = chaveConsulta({ codigo: sku, contas, blingConectado, fichaAtualId });
    const consulta = chave
      ? await cacheConsultaSKU.obter(chave, () => consultarSKURapido({ codigo: sku, contas, blingConectado, lerBling, consultarML, lerFichas: lerFichasDoCodigo, fichaAtualId }))
      : null;
    const fontes = await reunirFontesProvisorias({ consulta, lerFicha: lerFichaNovoAnuncio, consultarML });
    return { ...montarAnuncioProvisorio({ codigo: sku, ...fontes }), consulta };
  } catch (e) {
    return { fonte: FONTE.NENHUMA, rotulo: "", titulo: "", descricao: montarDescricaoProvisoria({ codigo: sku }), provisorio: true, erro: String(e?.message || e), consulta: null };
  }
}
