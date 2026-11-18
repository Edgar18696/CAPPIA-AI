// PAIIA — TESTE (18/11/2026): botão 👁️ no campo de senha da tela de login.
// Senha oculta por padrão; o botão só alterna a exibição; o login continua igual.
//   node --test scripts/testes/loginOlhoSenha.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tela = fs.readFileSync(path.join(RAIZ, "src/components/Login.jsx"), "utf8");

test("login: senha oculta por padrão e botão 👁️ dentro do campo alterna mostrar/esconder", () => {
  assert.match(tela, /const \[mostrarSenha, setMostrarSenha\] =\s*useState\(false\);/, "começa oculta");
  assert.match(tela, /type=\{mostrarSenha \? "text" : "password"\}/);
  assert.match(tela, /onClick=\{\(\) => setMostrarSenha\(\(v\) => !v\)\}/);
  assert.match(tela, /aria-label=\{mostrarSenha \? "Esconder senha" : "Mostrar senha"\}/);
  assert.match(tela, /type="button"\s+onClick=\{\(\) => setMostrarSenha/, "o botão não envia o formulário");
  assert.match(tela, /position: "absolute",\s+right: "6px"/, "fica dentro do campo, à direita");
});

test("login: entrar e criar conta continuam iguais", () => {
  assert.match(tela, /onClick=\{entrarUsuario\}/);
  assert.match(tela, /setSenha\(e\.target\.value\)/);
  assert.match(tela, /placeholder="Senha"/);
  assert.equal((tela.match(/supabase|signIn|signOut/g) || []).length, 0, "a tela não mexe na autenticação");
});
