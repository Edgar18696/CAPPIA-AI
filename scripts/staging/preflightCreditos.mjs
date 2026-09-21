import { createClient } from "@supabase/supabase-js";
import { exigir, validarAmbienteStaging } from "./stagingGuard.mjs";

const { url, projectRef } = validarAmbienteStaging(process.env, {
  exigirConfirmacaoTestes: false,
});
const serviceRole = exigir(process.env, "SUPABASE_STAGING_SERVICE_ROLE_KEY");
const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: carteiras, error } = await supabase
  .from("creditos_appia")
  .select("id,user_id,saldo,total_comprado,total_utilizado,created_at,updated_at")
  .order("saldo", { ascending: false });

if (error) {
  const tabelaAusente =
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /creditos_appia.*(does not exist|schema cache|not found)/i.test(
      `${error.message || ""} ${error.details || ""}`
    );

  if (tabelaAusente) {
    console.log(JSON.stringify({
      ambiente: "staging",
      projectRef,
      estado: "vazio",
      tabela_creditos_appia: "ausente",
      carteiras: 0,
      saldos: [],
      total: 0,
    }, null, 2));
    console.log("PREFLIGHT_STAGING_VAZIO: projeto novo; nenhuma escrita foi realizada.");
    process.exit(0);
  }

  throw error;
}

const saldos = (carteiras || []).map((item) => Number(item.saldo || 0));
const total = saldos.reduce((soma, saldo) => soma + saldo, 0);

console.log(JSON.stringify({
  ambiente: "staging",
  projectRef,
  carteiras: carteiras?.length || 0,
  saldos,
  total,
}, null, 2));

if ((carteiras?.length || 0) === 0 && total === 0) {
  console.log("PREFLIGHT_STAGING_VAZIO: tabela existente e sem carteiras; nenhuma escrita foi realizada.");
  process.exit(0);
}

const saldosEsperados = [82, 36, 0];
const saldosCorretos =
  saldos.length === saldosEsperados.length &&
  saldos.every((saldo, indice) => saldo === saldosEsperados[indice]);

if (carteiras?.length !== 3 || total !== 118 || !saldosCorretos) {
  throw new Error(
    `Preflight recusado: esperado 3 carteiras com saldos 82, 36 e 0 (total 118); encontrado ${carteiras?.length || 0}, saldos ${saldos.join(", ")} e total ${total}.`
  );
}

console.log("PREFLIGHT_APROVADO: 3 carteiras e 118 créditos preservados no staging.");
