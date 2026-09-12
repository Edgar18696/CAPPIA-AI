import { useMemo } from "react";

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function formatarNumero(valor) {
  return numero(valor).toLocaleString("pt-BR");
}

function formatarMoeda(valor) {
  return numero(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
export default function CentralInteligencia({
  setScreen,
  totalFotos = 0,
  totalBanners = 0,
  totalVideos = 0,
  totalAnuncios = 0,
  anunciosProntos = 0,
  anunciosMargemBaixa = 0,
  anunciosReajuste = 0,
  oportunidadesMargem = 0,
  produtosPoucaConcorrencia = 0,
  anunciosSemFoto = 0,
  lucroEstimado = 0,
  margemMedia = 0,
  precoMedio = 0,
  totalMercadoLivre = 0,
  totalShopee = 0,
  totalAmazon = 0,
  totalSite = 0,
  totalPecas = 0,
  totalFabricantes = 0,
  totalCatalogos = 0,
  totalCompatibilidades = 0,
}) {
  const totalOportunidades = useMemo(() => {
    return (
      numero(anunciosReajuste) +
      numero(oportunidadesMargem) +
      numero(produtosPoucaConcorrencia) +
      numero(anunciosProntos)
    );
  }, [
    anunciosReajuste,
    oportunidadesMargem,
    produtosPoucaConcorrencia,
    anunciosProntos,
  ]);

  const score = useMemo(() => {
    let pontos = 70;

    if (numero(anunciosReajuste) === 0) pontos += 8;
    if (numero(anunciosMargemBaixa) === 0) pontos += 7;
    if (numero(anunciosSemFoto) === 0) pontos += 5;
    if (numero(anunciosProntos) > 0) pontos += 4;
    if (numero(produtosPoucaConcorrencia) > 0) pontos += 3;
    if (numero(oportunidadesMargem) > 0) pontos += 3;

    return Math.min(100, pontos);
  }, [
    anunciosReajuste,
    anunciosMargemBaixa,
    anunciosSemFoto,
    anunciosProntos,
    produtosPoucaConcorrencia,
    oportunidadesMargem,
  ]);

  const statusScore =
    score >= 90
      ? "🟢 Excelente desempenho"
      : score >= 75
        ? "🟡 Operação saudável"
        : "🟠 Existem pontos importantes para revisar";

  const prioridades = [
    {
      icone: "🔴",
      titulo: "Preços para revisar",
      valor: anunciosReajuste,
      texto: "Anúncios que podem estar fora da faixa ideal.",
      tela: "centralPrecificacao",
    },
    {
      icone: "🟠",
      titulo: "Margem baixa",
      valor: anunciosMargemBaixa,
      texto: "Produtos que precisam de atenção na rentabilidade.",
      tela: "centralPrecificacao",
    },
    {
      icone: "🟢",
      titulo: "Oportunidades de margem",
      valor: oportunidadesMargem,
      texto: "Produtos com espaço para melhorar o lucro.",
      tela: "centralPrecificacao",
    },
    {
      icone: "🔵",
      titulo: "Prontos para publicar",
      valor: anunciosProntos,
      texto: "Anúncios finalizados aguardando publicação.",
      tela: "centralPublicacao",
    },
  ];

  const acoes = [
  ["🛒", "Novo Anúncio", "novoAnuncio"],
  ["📋", "Meus Anúncios", "meusAnuncios"],
  ["💰", "Precificação", "centralPrecificacao"],
  ["📤", "Publicar", "centralPublicacao"],
  ["📸", "Foto IA", "foto"],
  ["🎨", "Banner IA", "banner"],
  ["📚", "Catálogos", "importadorUniversal"],
];

  function iniciarDia() {
    localStorage.setItem(
      "appiaUltimaAnaliseDia",
      new Date().toISOString()
    );

    setScreen?.("centralPrecificacao");
  }

  return (
    <div style={pagina}>
      <section style={hero}>
        <div>
          <div style={selo}>🧠 CENTRAL DE INTELIGÊNCIA PAIIA</div>

          <h1 style={titulo}>
            Seu consultor comercial automotivo
          </h1>

          <p style={subtitulo}>
            O PAIIA organiza o que merece sua atenção e mostra
            onde agir primeiro.
          </p>
        </div>

        <button
          type="button"
          onClick={iniciarDia}
          style={botaoPrincipal}
        >
          🚀 Iniciar Meu Dia
        </button>
      </section>

      <section style={paizinho}>
  <div style={{ fontSize: "42px" }}>🤖</div>

  <div style={{ flex: 1 }}>
    <h2 style={tituloPaizinho}>
      Bom dia!
    </h2>

    <p style={textoPaizinho}>
      Hoje estou acompanhando{" "}
      <strong style={{ color: "#67e8f9" }}>
        {formatarNumero(totalAnuncios)}
      </strong>{" "}
      anúncio(s) no PAIIA.
    </p>

    <p style={textoPaizinho}>
      O preço médio atual é{" "}
      <strong style={{ color: "#86efac" }}>
        {formatarMoeda(precoMedio)}
      </strong>
      .
    </p>

    {anunciosSemFoto > 0 && (
      <p style={textoPaizinho}>
        📸 Encontrei{" "}
        <strong style={{ color: "#facc15" }}>
          {formatarNumero(anunciosSemFoto)}
        </strong>{" "}
        anúncio(s) sem foto principal.
      </p>
    )}

    {totalOportunidades > 0 ? (
      <p style={textoPaizinho}>
        💡 Também encontrei{" "}
        <strong style={{ color: "#67e8f9" }}>
          {formatarNumero(totalOportunidades)}
        </strong>{" "}
        ação(ões) importantes para hoje.
      </p>
    ) : (
      <p style={textoPaizinho}>
        ✅ Nenhuma prioridade comercial crítica foi identificada agora.
      </p>
    )}
  </div>
</section>

      <section style={scoreBox}>
        <div>
          <span style={rotulo}>SCORE PAIIA</span>
          <div style={scoreNumero}>{score} / 100</div>
          <div style={statusScoreStyle}>{statusScore}</div>
        </div>

        <div style={barraContainer}>
          <div
            style={{
              ...barraScore,
              width: `${score}%`,
            }}
          />
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="⚡ Prioridades de Hoje"
          texto="O que merece sua atenção primeiro."
        />

        <div style={gradeQuatro}>
          {prioridades.map((item) => (
            <button
              key={item.titulo}
              type="button"
              onClick={() => setScreen?.(item.tela)}
              style={cardPrioridade}
            >
              <div style={iconeGrande}>{item.icone}</div>
              <strong style={valorGrande}>
                {formatarNumero(item.valor)}
              </strong>
              <span style={tituloCard}>{item.titulo}</span>
              <span style={textoCard}>{item.texto}</span>
            </button>
          ))}
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="💰 Resumo Comercial"
          texto="Visão rápida da saúde financeira dos anúncios."
        />

        <div style={gradeQuatro}>
          <Metrica
            titulo="Lucro estimado"
            valor={formatarMoeda(lucroEstimado)}
          />
          <Metrica
            titulo="Margem média"
            valor={`${numero(margemMedia).toFixed(1)}%`}
          />
          <Metrica
            titulo="Preço médio"
            valor={formatarMoeda(precoMedio)}
          />
          <Metrica
            titulo="Anúncios"
            valor={formatarNumero(totalAnuncios)}
          />
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="📤 Marketplaces"
          texto="Anúncios distribuídos pelos canais de venda."
        />

        <div style={gradeQuatro}>
          <Metrica titulo="🟡 Mercado Livre" valor={formatarNumero(totalMercadoLivre)} />
          <Metrica titulo="🟠 Shopee" valor={formatarNumero(totalShopee)} />
          <Metrica titulo="🔵 Amazon" valor={formatarNumero(totalAmazon)} />
          <Metrica titulo="🌐 Site" valor={formatarNumero(totalSite)} />
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="📚 Base Mestre"
          texto="Conhecimento técnico disponível para o PAIIA."
        />

        <div style={gradeQuatro}>
          <Metrica titulo="Peças" valor={formatarNumero(totalPecas)} />
          <Metrica titulo="Fabricantes" valor={formatarNumero(totalFabricantes)} />
          <Metrica titulo="Catálogos" valor={formatarNumero(totalCatalogos)} />
          <Metrica
            titulo="Compatibilidades"
            valor={formatarNumero(totalCompatibilidades)}
          />
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="🎯 Produção PAIIA"
          texto="Tudo o que já foi produzido dentro da plataforma."
        />

        <div style={gradeQuatro}>
          <Metrica titulo="📷 Fotos IA" valor={formatarNumero(totalFotos)} />
          <Metrica titulo="🎨 Banners" valor={formatarNumero(totalBanners)} />
          <Metrica titulo="🎬 Clips" valor={formatarNumero(totalVideos)} />
          <Metrica
            titulo="📸 Sem foto profissional"
            valor={formatarNumero(anunciosSemFoto)}
          />
        </div>
      </section>

      <section style={blocoPaizinho}>
        <Cabecalho
          titulo="🧠 Paizinho"
          texto="Minha recomendação para hoje."
        />

        <div style={planoDia}>
          <LinhaPlano
            numero="①"
            texto={`Revisar ${formatarNumero(anunciosReajuste)} preço(s).`}
          />
          <LinhaPlano
            numero="②"
            texto={`Analisar ${formatarNumero(anunciosMargemBaixa)} produto(s) com margem baixa.`}
          />
          <LinhaPlano
            numero="③"
            texto={`Publicar ${formatarNumero(anunciosProntos)} anúncio(s) pronto(s).`}
          />
          <LinhaPlano
            numero="④"
            texto={`Avaliar ${formatarNumero(produtosPoucaConcorrencia)} produto(s) com pouca concorrência.`}
          />
        </div>
      </section>

      <section style={bloco}>
        <Cabecalho
          titulo="⚡ Ações Rápidas"
          texto="Continue trabalhando sem sair do fluxo."
        />

        <div style={gradeAcoes}>
          {acoes.map(([icone, nome, tela]) => (
            <button
              key={nome}
              type="button"
              onClick={() => setScreen?.(tela)}
              style={botaoAcao}
            >
              <span style={{ fontSize: "28px" }}>{icone}</span>
              <strong>{nome}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cabecalho({ titulo, texto }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <h2 style={tituloSecao}>{titulo}</h2>
      <p style={subtituloSecao}>{texto}</p>
    </div>
  );
}

function Metrica({ titulo, valor }) {
  return (
    <div style={cardMetrica}>
      <span style={rotuloMetrica}>{titulo}</span>
      <strong style={valorMetrica}>{valor}</strong>
    </div>
  );
}

function LinhaPlano({ numero, texto }) {
  return (
    <div style={linhaPlano}>
      <strong style={numeroPlano}>{numero}</strong>
      <span>{texto}</span>
    </div>
  );
}

const pagina = {
  width: "100%",
  maxWidth: "1280px",
  margin: "28px auto 0",
  textAlign: "left",
};

const hero = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "20px",
  flexWrap: "wrap",
  padding: "26px",
  borderRadius: "20px",
  border: "1px solid #2563eb",
  background: "linear-gradient(135deg,#0f172a,#172554)",
  boxShadow: "0 18px 40px rgba(0,0,0,.24)",
};

const selo = {
  color: "#67e8f9",
  fontWeight: "bold",
  fontSize: "13px",
  letterSpacing: ".05em",
};

const titulo = {
  color: "#ffffff",
  margin: "8px 0 6px",
  fontSize: "30px",
};

const subtitulo = {
  color: "#94a3b8",
  margin: 0,
  lineHeight: 1.55,
};

const botaoPrincipal = {
  padding: "15px 24px",
  borderRadius: "13px",
  border: "1px solid #4ade80",
  background: "linear-gradient(135deg,#15803d,#22c55e)",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
  minWidth: "210px",
  boxShadow: "0 14px 30px rgba(34,197,94,.2)",
};

const paizinho = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #0ea5e9",
  background: "linear-gradient(135deg,#082f49,#0f172a)",
};

const tituloPaizinho = {
  margin: 0,
  color: "#ffffff",
  fontSize: "20px",
};

const textoPaizinho = {
  margin: "7px 0 0",
  color: "#cbd5e1",
  lineHeight: 1.5,
};

const scoreBox = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #334155",
  background: "#0f172a",
};

const rotulo = {
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: "bold",
};

const scoreNumero = {
  color: "#67e8f9",
  fontWeight: "bold",
  fontSize: "32px",
  marginTop: "4px",
};

const statusScoreStyle = {
  color: "#cbd5e1",
  marginTop: "3px",
};

const barraContainer = {
  marginTop: "14px",
  height: "12px",
  borderRadius: "999px",
  background: "#1e293b",
  overflow: "hidden",
};

const barraScore = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(135deg,#2563eb,#22d3ee)",
  transition: ".3s",
};

const bloco = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1e293b",
  background: "#0f172a",
};

const blocoPaizinho = {
  ...bloco,
  border: "1px solid #22c55e",
  background: "linear-gradient(135deg,#052e16,#0f172a)",
};

const tituloSecao = {
  margin: 0,
  color: "#67e8f9",
  fontSize: "20px",
};

const subtituloSecao = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
};

const gradeQuatro = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: "12px",
};

const cardPrioridade = {
  minHeight: "180px",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #334155",
  background: "linear-gradient(145deg,#020617,#0f172a)",
  color: "#ffffff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "7px",
  textAlign: "left",
};

const iconeGrande = {
  fontSize: "28px",
};

const valorGrande = {
  color: "#67e8f9",
  fontSize: "26px",
};

const tituloCard = {
  fontWeight: "bold",
  color: "#ffffff",
};

const textoCard = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.45,
};

const cardMetrica = {
  padding: "17px",
  borderRadius: "13px",
  border: "1px solid #334155",
  background: "#020617",
};

const rotuloMetrica = {
  display: "block",
  color: "#94a3b8",
  fontSize: "12px",
  marginBottom: "8px",
};

const valorMetrica = {
  color: "#ffffff",
  fontSize: "22px",
};

const planoDia = {
  display: "grid",
  gap: "10px",
};

const linhaPlano = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "13px 14px",
  borderRadius: "11px",
  border: "1px solid #166534",
  background: "rgba(2,6,23,.55)",
  color: "#dcfce7",
};

const numeroPlano = {
  color: "#86efac",
  fontSize: "18px",
};

const gradeAcoes = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: "12px",
};

const botaoAcao = {
  minHeight: "105px",
  padding: "14px",
  borderRadius: "13px",
  border: "1px solid #2563eb",
  background: "linear-gradient(135deg,#172554,#0f172a)",
  color: "#ffffff",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};