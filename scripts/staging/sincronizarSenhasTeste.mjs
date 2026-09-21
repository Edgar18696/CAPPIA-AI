import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF_AUTORIZADO = "rzqjxjzwrnubzyrwmflt";

const usuariosTeste = [
  ["paiia.staging.82@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_82"],
  ["paiia.staging.36@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_36"],
  ["paiia.staging.0@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_0"],
];

function exigir(nome) {
  const valor = process.env[nome];

  if (!valor) {
    throw new Error(`Variável obrigatória ausente: ${nome}`);
  }

  return valor;
}

if (process.env.PAIIA_STAGING_TEST_USER_CONFIRMED !== "SIM") {
  throw new Error(
    "Operação bloqueada. Defina PAIIA_STAGING_TEST_USER_CONFIRMED=SIM."
  );
}

const url = exigir("SUPABASE_STAGING_URL");
const serviceRoleKey = exigir("SUPABASE_STAGING_SERVICE_ROLE_KEY");
const projectRef = new URL(url).hostname.split(".")[0];

assert.equal(
  projectRef,
  PROJECT_REF_AUTORIZADO,
  "Bloqueado: o projeto informado não é o PAIIA-STAGING autorizado."
);

const admin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data, error } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (error) {
  throw error;
}

for (const [email, senhaEnv] of usuariosTeste) {
  const usuario = data.users.find(
    (item) => item.email?.toLowerCase() === email.toLowerCase()
  );

  if (!usuario) {
    throw new Error(`Usuário de teste não encontrado: ${email}`);
  }

  const password = exigir(senhaEnv);

  const { error: updateError } =
    await admin.auth.admin.updateUserById(usuario.id, {
      password,
      email_confirm: true,
    });

  if (updateError) {
    throw updateError;
  }

  console.log(`Senha sincronizada: ${email}`);
}

console.log(
  JSON.stringify(
    {
      ambiente: "staging",
      projectRef,
      resultado: "SENHAS_SINCRONIZADAS",
      usuarios: usuariosTeste.length,
    },
    null,
    2
  )
);