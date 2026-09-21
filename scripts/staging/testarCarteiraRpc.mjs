import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { exigir, validarAmbienteStaging } from "./stagingGuard.mjs";

const USUARIOS = [
  [82, "paiia.staging.82@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_82"],
  [36, "paiia.staging.36@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_36"],
  [0, "paiia.staging.0@invalid.example", "PAIIA_STAGING_TEST_PASSWORD_0"],
];

const PROVEDOR = "paiia-staging-functional";
const STAGING_PROJECT_REF_AUTORIZADO = "rzqjxjzwrnubzyrwmflt";

const { url, projectRef } = validarAmbienteStaging();

assert.equal(
  projectRef,
  STAGING_PROJECT_REF_AUTORIZADO,
  "Project Ref ativo não corresponde ao PAIIA-STAGING autorizado."
);

if (process.env.PAIIA_STAGING_TEST_USER_CONFIRMED !== "SIM") {
  throw new Error(
    "Confirme os três usuários sintéticos com PAIIA_STAGING_TEST_USER_CONFIRMED=SIM."
  );
}

const admin = createClient(
  url,
  exigir(process.env, "SUPABASE_STAGING_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const anonKey = exigir(process.env, "SUPABASE_STAGING_ANON_KEY");

const ordenar = (linhas) =>
  [...linhas].sort((a, b) => Number(b.saldo) - Number(a.saldo));

const erroJson = (erro) =>
  erro
    ? {
        message: erro.message || String(erro),
        code: erro.code || null,
        details: erro.details || null,
      }
    : null;

async function selecionar(tabela) {
  const resposta = await admin.from(tabela).select("*");

  if (resposta.error) {
    throw resposta.error;
  }

  return resposta.data || [];
}

async function estadoCompleto() {
  const [carteiras, operacoes, eventos, auditoria] = await Promise.all([
    selecionar("creditos_appia"),
    selecionar("operacoes_creditos_paiia"),
    selecionar("eventos_pagamento_paiia"),
    selecionar("migracao_creditos_paiia_auditoria"),
  ]);

  return {
    capturadoEm: new Date().toISOString(),
    projectRef,
    carteiras: ordenar(carteiras),
    operacoes,
    eventos,
    auditoria,
  };
}

function resumoFinal(estado) {
  const carteiras = ordenar(estado.carteiras);
  const auditoriaPorUsuario = new Map(
    estado.auditoria.map((registro) => [registro.user_id, registro])
  );

  const divergencias = carteiras.filter((carteira) => {
    const snapshot = auditoriaPorUsuario.get(carteira.user_id);

    return (
      !snapshot ||
      carteira.id !== snapshot.carteira_legada_id ||
      Number(carteira.saldo) !== Number(snapshot.saldo_legado) ||
      Number(carteira.total_comprado) !==
        Number(snapshot.total_comprado_legado) ||
      Number(carteira.total_utilizado) !==
        Number(snapshot.total_utilizado_legado)
    );
  }).length;

  return {
    carteiras: carteiras.length,
    saldos: carteiras.map((carteira) => Number(carteira.saldo)),
    total_saldo: carteiras.reduce(
      (total, carteira) => total + Number(carteira.saldo),
      0
    ),
    total_reservado: carteiras.reduce(
      (total, carteira) => total + Number(carteira.saldo_reservado),
      0
    ),
    usuarios_distintos: new Set(
      carteiras.map((carteira) => carteira.user_id)
    ).size,
    valores_nao_negativos: carteiras.every(
      (carteira) =>
        Number(carteira.saldo) >= 0 &&
        Number(carteira.saldo_reservado) >= 0
    ),
    snapshots: estado.auditoria.length,
    total_snapshot: estado.auditoria.reduce(
      (total, snapshot) => total + Number(snapshot.saldo_legado),
      0
    ),
    divergencias,
  };
}

const RESULTADO_OBRIGATORIO = {
  carteiras: 3,
  saldos: [82, 36, 0],
  total_saldo: 118,
  total_reservado: 0,
  usuarios_distintos: 3,
  valores_nao_negativos: true,
  snapshots: 3,
  total_snapshot: 118,
  divergencias: 0,
};

function validarBaseline(estado) {
  assert.deepEqual(
    resumoFinal(estado),
    RESULTADO_OBRIGATORIO,
    "O estado do PAIIA-STAGING não corresponde ao baseline autorizado."
  );
}

function estadoRelatorio(estado, prefixo) {
  return {
    carteiras: ordenar(estado.carteiras).map((carteira) => ({
      user_id: carteira.user_id,
      saldo: Number(carteira.saldo),
      saldo_reservado: Number(carteira.saldo_reservado),
      total_comprado: Number(carteira.total_comprado),
      total_utilizado: Number(carteira.total_utilizado),
    })),
    operacoes_teste: estado.operacoes.filter((operacao) =>
      operacao.chave_idempotencia?.startsWith(prefixo)
    ),
    eventos_teste: estado.eventos.filter(
      (evento) =>
        evento.provedor === PROVEDOR &&
        evento.evento_externo_id?.startsWith(prefixo)
    ),
  };
}

async function usuariosAuth() {
  const todos = [];

  for (let pagina = 1; ; pagina += 1) {
    const resposta = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: 1000,
    });

    if (resposta.error) {
      throw resposta.error;
    }

    const paginaAtual = resposta.data?.users || [];
    todos.push(...paginaAtual);

    if (paginaAtual.length < 1000) {
      return todos;
    }
  }
}

async function conferirUsuarios(snapshot) {
  const usuariosPorEmail = new Map(
    (await usuariosAuth()).map((usuario) => [
      String(usuario.email).toLowerCase(),
      usuario,
    ])
  );

  const idsDasCarteiras = new Set(
    snapshot.carteiras.map((carteira) => carteira.user_id)
  );

  const mapa = new Map();

  for (const [saldo, email, senhaEnv] of USUARIOS) {
    const usuario = usuariosPorEmail.get(email);

    assert.ok(
      usuario && idsDasCarteiras.has(usuario.id),
      `Usuário sintético inválido ou sem carteira: ${email}`
    );

    const carteira = snapshot.carteiras.find(
      (registro) => registro.user_id === usuario.id
    );

    assert.equal(
      Number(carteira.saldo),
      saldo,
      `Saldo inicial inesperado para ${email}`
    );

    mapa.set(saldo, {
      saldo,
      email,
      senhaEnv,
      id: usuario.id,
      carteira,
    });
  }

  assert.deepEqual(
    [...mapa.values()].map((usuario) => usuario.id).sort(),
    [...idsDasCarteiras].sort(),
    "As três carteiras não pertencem exatamente aos usuários sintéticos."
  );

  return mapa;
}

async function autenticar(mapa) {
  const clientes = new Map();

  for (const [saldo] of USUARIOS) {
    const usuario = mapa.get(saldo);

    const cliente = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const resposta = await cliente.auth.signInWithPassword({
      email: usuario.email,
      password: exigir(process.env, usuario.senhaEnv),
    });

    if (resposta.error) {
      throw resposta.error;
    }

    assert.equal(
      resposta.data.user?.id,
      usuario.id,
      `O login não corresponde ao usuário sintético de saldo ${saldo}.`
    );

    clientes.set(saldo, cliente);
  }

  return clientes;
}

async function carteira(cliente) {
  const resposta = await cliente.rpc("paiia_consultar_carteira");

  if (resposta.error) {
    throw resposta.error;
  }

  return resposta.data;
}

async function rpc(cliente, nome, parametros) {
  const resposta = await cliente.rpc(nome, parametros);

  if (resposta.error) {
    throw resposta.error;
  }

  return resposta.data;
}

async function salvar(caminho, dados) {
  await writeFile(caminho, `${JSON.stringify(dados, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function restaurar(snapshot, prefixo) {
  assert.equal(
    snapshot.projectRef,
    STAGING_PROJECT_REF_AUTORIZADO,
    "Snapshot não pertence ao staging autorizado."
  );

  validarBaseline(snapshot);

  const ids = snapshot.carteiras.map((carteira) => carteira.user_id);

  let resposta = await admin
    .from("operacoes_creditos_paiia")
    .delete()
    .in("user_id", ids)
    .like("chave_idempotencia", `${prefixo}%`);

  if (resposta.error) {
    throw resposta.error;
  }

  resposta = await admin
    .from("eventos_pagamento_paiia")
    .delete()
    .in("user_id", ids)
    .eq("provedor", PROVEDOR)
    .like("evento_externo_id", `${prefixo}%`);

  if (resposta.error) {
    throw resposta.error;
  }

  for (const carteiraOriginal of snapshot.carteiras) {
    resposta = await admin
      .from("creditos_appia")
      .upsert(carteiraOriginal, { onConflict: "user_id" });

    if (resposta.error) {
      throw resposta.error;
    }
  }
}

const argumentoRestauracao = process.argv.find((argumento) =>
  argumento.startsWith("--restore-snapshot=")
);

if (argumentoRestauracao) {
  const caminho = resolve(
    argumentoRestauracao.split("=").slice(1).join("=")
  );

  const documento = JSON.parse(await readFile(caminho, "utf8"));

  await restaurar(documento.snapshot, documento.prefixo);

  const resultadoFinal = resumoFinal(await estadoCompleto());

  assert.deepEqual(
    resultadoFinal,
    RESULTADO_OBRIGATORIO,
    "A restauração não recuperou o estado inicial."
  );

  console.log(
    JSON.stringify(
      {
        projectRef,
        restauracao: "PASSOU",
        final: resultadoFinal,
      },
      null,
      2
    )
  );
} else {
  const prefixo =
    `staging:teste-carteira:${Date.now()}:${randomUUID()}`;

  const pastaEvidencias = join(
    tmpdir(),
    "paiia-staging-creditos"
  );

  await mkdir(pastaEvidencias, {
    recursive: true,
    mode: 0o700,
  });

  const caminhoEvidencia = join(
    pastaEvidencias,
    `${prefixo.replaceAll(":", "-")}.json`
  );

  const snapshot = await estadoCompleto();

  validarBaseline(snapshot);

  const usuarios = await conferirUsuarios(snapshot);

  const documento = {
    projectRef,
    prefixo,
    status: "SNAPSHOT_CAPTURADO",
    snapshot,
    testes: [],
  };

  await salvar(caminhoEvidencia, documento);

  let clientes;
  let primeiraFalha = null;

  async function executarTeste(
    nome,
    operacao,
    esperado,
    executar,
    conferir
  ) {
    if (primeiraFalha) {
      throw new Error(
        `SEQUENCIA_INTERROMPIDA_APOS_FALHA:${primeiraFalha}`
      );
    }

    const registro = {
      nome,
      operacao,
      identificadores: {
        prefixo,
      },
      esperado,
      anterior: estadoRelatorio(
        await estadoCompleto(),
        prefixo
      ),
      resposta: null,
      obtido: null,
      posterior: null,
      resultado: "EM_EXECUCAO",
    };

    documento.testes.push(registro);
    await salvar(caminhoEvidencia, documento);

    try {
      registro.resposta = await executar();
      registro.obtido = await conferir(registro);
      registro.posterior = estadoRelatorio(
        await estadoCompleto(),
        prefixo
      );
      registro.resultado = "PASSOU";
    } catch (erro) {
      primeiraFalha = nome;
      registro.resultado = "FALHOU";
      registro.obtido = {
        erro: erroJson(erro),
      };

      try {
        registro.posterior = estadoRelatorio(
          await estadoCompleto(),
          prefixo
        );
      } catch (erroEstado) {
        registro.posterior = {
          erro: erroJson(erroEstado),
        };
      }

      throw erro;
    } finally {
      await salvar(caminhoEvidencia, documento);
    }
  }

  try {
    clientes = await autenticar(usuarios);

    const cliente82 = clientes.get(82);
    const cliente36 = clientes.get(36);
    const cliente0 = clientes.get(0);
    const userId82 = usuarios.get(82).id;

    const operacaoConfirmar =
      `${prefixo}:reserva-confirmacao`;

    await executarTeste(
      "reserva",
      "paiia_reservar_creditos(foto_ia, 3)",
      "saldo 82→79 e reservado 0→3",
      () =>
        rpc(cliente82, "paiia_reservar_creditos", {
          p_chave_idempotencia: operacaoConfirmar,
          p_recurso: "foto_ia",
          p_creditos: 3,
          p_metadados: {
            teste: true,
            prefixo,
          },
        }),
      async () => {
        const estado = await carteira(cliente82);

        assert.equal(Number(estado.saldo), 79);
        assert.equal(Number(estado.reservado), 3);

        return estado;
      }
    );

    await executarTeste(
      "confirmacao",
      "paiia_confirmar_creditos da reserva anterior",
      "reservado 3→0; saldo permanece 79; total_utilizado aumenta 3",
      () =>
        rpc(cliente82, "paiia_confirmar_creditos", {
          p_chave_idempotencia: operacaoConfirmar,
          p_resultado: {
            teste: true,
          },
        }),
      async () => {
        const estado = await carteira(cliente82);

        assert.equal(Number(estado.saldo), 79);
        assert.equal(Number(estado.reservado), 0);
        assert.equal(
          Number(estado.total_utilizado),
          Number(
            usuarios.get(82).carteira.total_utilizado
          ) + 3
        );

        return estado;
      }
    );

    const operacaoLiberar = `${prefixo}:devolucao`;

    await executarTeste(
      "devolucao",
      "reservar 2 créditos de banner e liberar a operação",
      "saldo e reserva retornam ao estado anterior",
      async () => {
        const antes = await carteira(cliente82);

        const reserva = await rpc(
          cliente82,
          "paiia_reservar_creditos",
          {
            p_chave_idempotencia: operacaoLiberar,
            p_recurso: "banner",
            p_creditos: 2,
            p_metadados: {
              teste: true,
              prefixo,
            },
          }
        );

        const liberacao = await rpc(
          cliente82,
          "paiia_liberar_creditos",
          {
            p_chave_idempotencia: operacaoLiberar,
            p_motivo: "teste_controlado",
          }
        );

        return {
          antes,
          reserva,
          liberacao,
        };
      },
      async (registro) => {
        const depois = await carteira(cliente82);

        assert.deepEqual(
          depois,
          registro.resposta.antes
        );

        return depois;
      }
    );

    const operacaoExpirar = `${prefixo}:expiracao`;

    await executarTeste(
      "expiracao",
      "reservar 1 crédito, envelhecer somente a operação de teste e expirar",
      "uma reserva é liberada e o saldo retorna ao estado anterior",
      async () => {
        const antes = await carteira(cliente82);

        await rpc(
          cliente82,
          "paiia_reservar_creditos",
          {
            p_chave_idempotencia: operacaoExpirar,
            p_recurso: "foto_ia",
            p_creditos: 1,
            p_metadados: {
              teste: true,
              prefixo,
            },
          }
        );

        let resposta = await admin
          .from("operacoes_creditos_paiia")
          .update({
            reservado_em: new Date(
              Date.now() - 3 * 60 * 60 * 1000
            ).toISOString(),
          })
          .eq("user_id", userId82)
          .eq(
            "chave_idempotencia",
            operacaoExpirar
          );

        if (resposta.error) {
          throw resposta.error;
        }

        resposta = await admin.rpc(
          "paiia_liberar_reservas_expiradas",
          {
            p_mais_antigas_que: "2 hours",
            p_limite: 100,
          }
        );

        if (resposta.error) {
          throw resposta.error;
        }

        return {
          antes,
          liberadas: Number(resposta.data),
        };
      },
      async (registro) => {
        assert.ok(
          registro.resposta.liberadas >= 1
        );

        const depois = await carteira(cliente82);

        assert.deepEqual(
          depois,
          registro.resposta.antes
        );

        return depois;
      }
    );

    const operacaoCliqueDuplo =
      `${prefixo}:clique-duplo`;

    await executarTeste(
      "clique_duplo_idempotencia",
      "duas reservas concorrentes com a mesma chave idempotente",
      "somente um débito de 4 créditos",
      async () => {
        const antes = await carteira(cliente82);

        const parametros = {
          p_chave_idempotencia:
            operacaoCliqueDuplo,
          p_recurso: "clip_premium",
          p_creditos: 4,
          p_metadados: {
            teste: true,
            prefixo,
            clique_duplo: true,
          },
        };

        const respostas = await Promise.all([
          cliente82.rpc(
            "paiia_reservar_creditos",
            parametros
          ),
          cliente82.rpc(
            "paiia_reservar_creditos",
            parametros
          ),
        ]);

        assert.ok(
          respostas.every(
            (resposta) => !resposta.error
          )
        );

        return {
          antes,
          respostas: respostas.map(
            (resposta) => resposta.data
          ),
        };
      },
      async (registro) => {
        const durante = await carteira(cliente82);

        assert.equal(
          Number(durante.saldo),
          Number(registro.resposta.antes.saldo) - 4
        );

        assert.equal(
          Number(durante.reservado),
          Number(
            registro.resposta.antes.reservado
          ) + 4
        );

        assert.equal(
          registro.resposta.respostas.filter(
            (resposta) =>
              resposta.idempotente === false
          ).length,
          1
        );

        assert.equal(
          registro.resposta.respostas.filter(
            (resposta) =>
              resposta.idempotente === true
          ).length,
          1
        );

        await rpc(
          cliente82,
          "paiia_liberar_creditos",
          {
            p_chave_idempotencia:
              operacaoCliqueDuplo,
            p_motivo:
              "fim_teste_clique_duplo",
          }
        );

        const depois = await carteira(cliente82);

        assert.equal(
          Number(depois.saldo),
          Number(registro.resposta.antes.saldo)
        );

        assert.equal(
          Number(depois.reservado),
          Number(
            registro.resposta.antes.reservado
          )
        );

        return {
          durante,
          depois,
        };
      }
    );

    const operacoesConcorrencia = [
      `${prefixo}:concorrencia:a`,
      `${prefixo}:concorrencia:b`,
    ];

    await executarTeste(
      "concorrencia",
      "duas reservas simultâneas de 50 créditos com chaves diferentes",
      "somente uma reserva é aceita e nenhum saldo fica negativo",
      async () => {
        const antes = await carteira(cliente82);

        const respostas = await Promise.all(
          operacoesConcorrencia.map((chave) =>
            cliente82.rpc(
              "paiia_reservar_creditos",
              {
                p_chave_idempotencia: chave,
                p_recurso: "clip_premium",
                p_creditos: 50,
                p_metadados: {
                  teste: true,
                  prefixo,
                  concorrencia: true,
                },
              }
            )
          )
        );

        return {
          antes,
          respostas: respostas.map(
            (resposta, indice) => ({
              chave:
                operacoesConcorrencia[indice],
              data: resposta.data,
              erro: erroJson(resposta.error),
            })
          ),
        };
      },
      async (registro) => {
        const sucessos =
          registro.resposta.respostas.filter(
            (resposta) => !resposta.erro
          );

        const falhas =
          registro.resposta.respostas.filter(
            (resposta) => resposta.erro
          );

        assert.equal(sucessos.length, 1);
        assert.equal(falhas.length, 1);

        const durante = await carteira(cliente82);

        assert.ok(
          Number(durante.saldo) >= 0 &&
            Number(durante.reservado) >= 0
        );

        await rpc(
          cliente82,
          "paiia_liberar_creditos",
          {
            p_chave_idempotencia:
              sucessos[0].chave,
            p_motivo: "fim_teste_concorrencia",
          }
        );

        const depois = await carteira(cliente82);

        assert.equal(
          Number(depois.saldo),
          Number(registro.resposta.antes.saldo)
        );

        assert.equal(
          Number(depois.reservado),
          Number(
            registro.resposta.antes.reservado
          )
        );

        return {
          durante,
          depois,
        };
      }
    );

    await executarTeste(
      "saldo_insuficiente",
      "usuário sintético de saldo zero tenta reservar 1 crédito",
      "CREDITOS_INSUFICIENTES e carteira inalterada",
      async () => {
        const antes = await carteira(cliente0);

        const resposta = await cliente0.rpc(
          "paiia_reservar_creditos",
          {
            p_chave_idempotencia:
              `${prefixo}:insuficiente`,
            p_recurso: "foto_ia",
            p_creditos: 1,
            p_metadados: {
              teste: true,
              prefixo,
            },
          }
        );

        return {
          antes,
          data: resposta.data,
          erro: erroJson(resposta.error),
        };
      },
      async (registro) => {
        assert.match(
          registro.resposta.erro?.message || "",
          /CREDITOS_INSUFICIENTES/i
        );

        const depois = await carteira(cliente0);

        assert.deepEqual(
          depois,
          registro.resposta.antes
        );

        assert.ok(
          Number(depois.saldo) >= 0 &&
            Number(depois.reservado) >= 0
        );

        return depois;
      }
    );

    const pagamentoId =
      `${prefixo}:pagamento-plano`;

    const eventoPlano =
      `${prefixo}:evento-plano`;

    const parametrosPlano = {
      p_provedor: PROVEDOR,
      p_evento_externo_id: eventoPlano,
      p_pagamento_externo_id: pagamentoId,
      p_user_id: userId82,
      p_tipo: "plano_ouro",
      p_creditos: 120,
      p_pacote_codigo: null,
      p_payload_hash: prefixo,
      p_payload: {
        teste: true,
        prefixo,
      },
    };

    await executarTeste(
      "plano_ouro_120",
      "paiia_creditar_pagamento para Plano Ouro",
      "saldo aumenta exatamente 120 créditos uma única vez",
      async () => {
        const antes = await carteira(cliente82);

        const resposta = await admin.rpc(
          "paiia_creditar_pagamento",
          parametrosPlano
        );

        if (resposta.error) {
          throw resposta.error;
        }

        return {
          antes,
          data: resposta.data,
        };
      },
      async (registro) => {
        const depois = await carteira(cliente82);

        assert.equal(
          Number(depois.saldo),
          Number(registro.resposta.antes.saldo) +
            120
        );

        return depois;
      }
    );

    await executarTeste(
      "concessao_duplicada",
      "repetir exatamente o mesmo evento do Plano Ouro",
      "resposta idempotente e nenhum crédito adicional",
      async () => {
        const antes = await carteira(cliente82);

        const resposta = await admin.rpc(
          "paiia_creditar_pagamento",
          parametrosPlano
        );

        if (resposta.error) {
          throw resposta.error;
        }

        return {
          antes,
          data: resposta.data,
        };
      },
      async (registro) => {
        assert.equal(
          registro.resposta.data.idempotente,
          true
        );

        const depois = await carteira(cliente82);

        assert.equal(
          Number(depois.saldo),
          Number(registro.resposta.antes.saldo)
        );

        return depois;
      }
    );

    await executarTeste(
      "pagamento_repetido",
      "novo evento externo reutiliza o mesmo pagamento já confirmado",
      "operação rejeitada ou idempotente sem adicionar créditos",
      async () => {
        const antes = await carteira(cliente82);

        const resposta = await admin.rpc(
          "paiia_creditar_pagamento",
          {
            ...parametrosPlano,
            p_evento_externo_id:
              `${prefixo}:evento-repetido`,
          }
        );

        return {
          antes,
          data: resposta.data,
          erro: erroJson(resposta.error),
        };
      },
      async (registro) => {
        assert.ok(
          registro.resposta.erro ||
            registro.resposta.data
              ?.idempotente === true
        );

        const depois = await carteira(cliente82);

        assert.equal(
          Number(depois.saldo),
          Number(registro.resposta.antes.saldo)
        );

        return depois;
      }
    );

    await executarTeste(
      "compatibilidade_legada",
      "consultar_creditos_appia e debitar_credito_clip no usuário de saldo 36",
      "consulta retorna 36; débito retorna 35; saldo não fica negativo",
      async () => {
        const consulta = await cliente36.rpc(
          "consultar_creditos_appia"
        );

        if (consulta.error) {
          throw consulta.error;
        }

        const debito = await cliente36.rpc(
          "debitar_credito_clip"
        );

        if (debito.error) {
          throw debito.error;
        }

        return {
          consulta: Number(consulta.data),
          debito: Number(debito.data),
        };
      },
      async (registro) => {
        assert.deepEqual(
          registro.resposta,
          {
            consulta: 36,
            debito: 35,
          }
        );

        const depois = await carteira(cliente36);

        assert.equal(Number(depois.saldo), 35);
        assert.ok(Number(depois.saldo) >= 0);

        return depois;
      }
    );

    documento.status = "TESTES_CONCLUIDOS";
  } catch (erro) {
    documento.status = "FALHOU";
    documento.erro = erroJson(erro);
  } finally {
    try {
      await restaurar(snapshot, prefixo);

      documento.restauracao = {
        resultado: "PASSOU",
        em: new Date().toISOString(),
      };

      const estadoFinal = await estadoCompleto();
      const resultadoFinal =
        resumoFinal(estadoFinal);

      assert.deepEqual(
        resultadoFinal,
        RESULTADO_OBRIGATORIO,
        "A conferência final não corresponde ao baseline."
      );

      documento.verificacaoFinal = {
        resultado: "PASSOU",
        ...resultadoFinal,
      };
    } catch (erroRestauracao) {
      documento.restauracao = {
        resultado: "FALHOU",
        erro: erroJson(erroRestauracao),
      };

      documento.verificacaoFinal = {
        resultado: "FALHOU",
      };

      documento.status =
        "FALHOU_RESTAURACAO";
    }

    for (const cliente of clientes?.values() || []) {
      await cliente.auth.signOut().catch(() => {});
    }

    documento.finalizadoEm =
      new Date().toISOString();

    await salvar(
      caminhoEvidencia,
      documento
    );

    console.log(
      JSON.stringify(
        {
          ambiente: "staging",
          projectRef,
          status: documento.status,
          primeiraFalha,
          restauracao:
            documento.restauracao,
          verificacaoFinal:
            documento.verificacaoFinal,
          evidenciaLocal:
            caminhoEvidencia,
        },
        null,
        2
      )
    );
  }

  if (
    documento.status !==
      "TESTES_CONCLUIDOS" ||
    documento.restauracao?.resultado !==
      "PASSOU"
  ) {
    process.exitCode = 1;
  }
}