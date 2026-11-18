// =============================================================
// PAIIA — define a SENHA DE TESTE de um usuário SÓ NO PAIIA-STAGING (18/11/2026).
// Você digita a senha (não aparece na tela) e ela vai direto para o Supabase de
// TESTE. Nada é gravado em arquivo e nada toca no PAIIA oficial.
//   node scripts/staging/definirSenhaStaging.mjs teste2@teste.com
// Requer: Supabase CLI logado neste computador (npx supabase).
// =============================================================
import { execSync } from "node:child_process";
import readline from "node:readline";
import { createClient } from "@supabase/supabase-js";
import { PRODUCTION_PROJECT_REF } from "./stagingGuard.mjs";

const REF = "rzqjxjzwrnubzyrwmflt"; // PAIIA-STAGING
if (REF === PRODUCTION_PROJECT_REF) throw new Error("BLOQUEADO: o projeto de produção nunca é usado aqui.");
const email = String(process.argv[2] || "").trim().toLowerCase();
if (!/^[^@\s]+@[^@\s]+$/.test(email)) { console.log("Uso: node scripts/staging/definirSenhaStaging.mjs seu@email"); process.exit(1); }

function perguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mostrando = true;
    rl._writeToOutput = (s) => { if (mostrando) rl.output.write(s); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write("\n"); resolve(r); });
    mostrando = false;
  });
}

console.log(`PAIIA-STAGING (${REF}) — senha de TESTE para ${email}. Use uma senha DIFERENTE da do PAIIA oficial.`);
const s1 = await perguntarOculto("Nova senha de teste (mín. 8 caracteres): ");
const s2 = await perguntarOculto("Repita a senha: ");
if (s1 !== s2) { console.log("As senhas não conferem. Nada foi alterado."); process.exit(1); }
if (s1.length < 8) { console.log("Senha curta demais. Nada foi alterado."); process.exit(1); }

const chaves = JSON.parse(execSync(`npx -y supabase@2 projects api-keys --project-ref ${REF} -o json`, { stdio: ["ignore", "pipe", "ignore"] }).toString());
const service = (chaves.find((k) => k.name === "service_role") || {}).api_key;
if (!service) throw new Error("Chave de serviço do STAGING não encontrada (o Supabase CLI está logado?).");
const admin = createClient(`https://${REF}.supabase.co`, service, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) throw error;
const u = data.users.find((x) => x.email?.toLowerCase() === email);
if (!u) { console.log(`${email} não existe no STAGING. Nada foi alterado.`); process.exit(1); }
const r = await admin.auth.admin.updateUserById(u.id, { password: s1, email_confirm: true });
if (r.error) { console.log("Erro:", r.error.message); process.exit(1); }
console.log(`Pronto: senha de teste definida para ${email} SÓ no STAGING. Entre em http://127.0.0.1:5184`);
