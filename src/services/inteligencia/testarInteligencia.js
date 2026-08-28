import {
  motorInteligenciaPeca,
  motorInteligenciaV2,
  gerarAnuncioV2,
} from "./index";

export async function testarInteligencia() {
  const codigoTeste =
    "0258986770";

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  console.log(
    "🤖 PAIZINHO APPIA — TESTE 001"
  );

  console.log(
    "Código:",
    codigoTeste
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );

  const inteligenciaBasica =
    motorInteligenciaPeca({
      codigo: codigoTeste,
      descricao: "",
    });

  console.log(
    "🧠 IDENTIFICAÇÃO:",
    inteligenciaBasica
  );

  console.log(
    "🏭 FABRICANTE:",
    inteligenciaBasica.fabricante
  );

  console.log(
    "📦 FAMÍLIA:",
    inteligenciaBasica.familia
  );

  console.log(
    "📚 CATÁLOGO:",
    inteligenciaBasica.catalogo
  );

  console.log(
    "⚙️ SISTEMA:",
    inteligenciaBasica.sistema
  );

  console.log(
    "📂 CATEGORIA:",
    inteligenciaBasica.categoria
  );

  console.log(
    "🎯 CONFIANÇA:",
    `${inteligenciaBasica.confianca}%`
  );

  console.log(
    "🔎 ORIGEM:",
    inteligenciaBasica.origemIdentificacao
  );

  try {
    const resultadoV2 =
      await motorInteligenciaV2({
        codigo: codigoTeste,
        descricao: "",
      });

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    console.log(
      "📚 MOTOR INTELIGÊNCIA V2:",
      resultadoV2
    );

    console.log(
      "📚 BASE MESTRE:",
      resultadoV2?.baseMestre
    );

    console.log(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
  } catch (erro) {
    console.error(
      "❌ ERRO MOTOR V2:",
      erro
    );
  }

  try {
    const anuncio =
      await gerarAnuncioV2({
        codigo: codigoTeste,
        descricao: "",
      });

    console.log(
      "📄 ANÚNCIO GERADO:",
      anuncio
    );
  } catch (erro) {
    console.error(
      "❌ ERRO AO GERAR ANÚNCIO:",
      erro
    );
  }

  return inteligenciaBasica;
}

export default testarInteligencia;