import { useEffect, useState } from "react";
import { supabase } from "../supabase";

/*
 * Contas Mercado Livre do usuário PAIIA (N contas) e a CONTA ATIVA.
 *
 * - A lista vem da função mercadolivre-oauth (acao "listar_contas"), sem tokens.
 * - A conta ativa fica gravada no servidor (coluna "ativa"): é a mesma em
 *   todas as telas e dispositivos.
 * - Toda chamada às funções do Mercado Livre deve enviar conta_ml (ML user_id).
 *   O servidor BLOQUEIA quando há mais de uma conta e nenhuma foi informada,
 *   e nas escritas exige sempre a conta explícita.
 */

let estado = { carregado: false, contas: [], ativa: null, erro: "" };
let promessa = null;
const ouvintes = new Set();

function avisar() {
  ouvintes.forEach((fn) => {
    try { fn(estado); } catch { /* ignora ouvinte com erro */ }
  });
}

export async function carregarContasML(forcar = false) {
  if (estado.carregado && !forcar) return estado;
  if (promessa && !forcar) return promessa;
  promessa = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("mercadolivre-oauth", {
        body: { acao: "listar_contas" },
      });
      if (error || !data?.ok) {
        estado = { carregado: true, contas: [], ativa: null, erro: data?.erro || error?.message || "Não foi possível ler as contas Mercado Livre." };
      } else {
        const contas = Array.isArray(data.contas) ? data.contas : [];
        estado = { carregado: true, contas, ativa: data.conta_ativa || null, erro: "" };
      }
    } catch (e) {
      estado = { carregado: true, contas: [], ativa: null, erro: e?.message || "Falha ao ler as contas Mercado Livre." };
    } finally {
      promessa = null;
    }
    avisar();
    return estado;
  })();
  return promessa;
}

export function contasMLConectadas(e = estado) {
  return (e.contas || []).filter((c) => c.status !== "desconectada");
}

/** ML user_id da conta ativa, ou lança erro claro (nunca escolhe sozinho). */
export async function idContaMLAtiva() {
  const e = estado.carregado ? estado : await carregarContasML();
  const conectadas = contasMLConectadas(e);
  if (!conectadas.length) throw new Error("Nenhuma conta Mercado Livre conectada. Use Contas Marketplace.");
  const ativa = conectadas.find((c) => c.ativa);
  if (!ativa) throw new Error("Defina a CONTA MERCADO LIVRE ATIVA em Contas Marketplace antes de continuar.");
  return ativa.ml_user_id;
}

/** Igual a idContaMLAtiva, mas devolve undefined em vez de lançar erro (leituras). */
export async function idContaMLAtivaOpcional() {
  try { return await idContaMLAtiva(); } catch { return undefined; }
}

export async function definirContaMLAtiva(mlUserId) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-oauth", {
    body: { acao: "definir_ativa", ml_user_id: String(mlUserId) },
  });
  if (error || !data?.ok) throw new Error(data?.erro || error?.message || "Não foi possível trocar a conta ativa.");
  await carregarContasML(true);
  return data.conta_ativa;
}

export async function desconectarContaML(mlUserId) {
  const { data, error } = await supabase.functions.invoke("mercadolivre-oauth", {
    body: { acao: "desconectar", ml_user_id: String(mlUserId), confirmacao: "DESCONECTAR" },
  });
  if (error || !data?.ok) throw new Error(data?.erro || error?.message || "Não foi possível desconectar.");
  await carregarContasML(true);
  return true;
}

export function ouvirContasML(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Hook: { carregado, contas, ativa, erro } sempre atualizado. */
export function useContasML() {
  const [e, setE] = useState(estado);
  useEffect(() => {
    const parar = ouvirContasML(setE);
    carregarContasML().then(setE);
    return parar;
  }, []);
  return e;
}
