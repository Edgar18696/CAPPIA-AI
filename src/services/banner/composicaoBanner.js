// Banner Express — regras de composição (puras, sem navegador).
// Decide o que pode aparecer na arte e onde cada elemento fica.
// A IA nunca escreve preço, código, site, WhatsApp ou logo: esses dados
// vêm somente dos campos preenchidos e são desenhados pelo PAIIA.

export const FORMATO_MERCADO_LIVRE = "mercadoLivre";

export const CAMPOS_COMERCIAIS = ["logo", "preco", "codigo", "site", "whatsapp"];

// Chamadas curtas permitidas no Mercado Livre (sem dados comerciais).
export const CHAMADAS_MERCADO_LIVRE = [
  { id: "", texto: "Sem chamada" },
  { id: "promocao", texto: "PROMOÇÃO" },
  { id: "prontaEntrega", texto: "PRONTA ENTREGA" },
  { id: "destaque", texto: "PRODUTO EM DESTAQUE" },
  { id: "qualidade", texto: "QUALIDADE E CONFIANÇA" },
];

export function textoChamadaMercadoLivre(id) {
  const item = CHAMADAS_MERCADO_LIVRE.find((opcao) => opcao.id === id);
  return item && item.id ? item.texto : "";
}

export function ehMercadoLivre(formato) {
  return formato === FORMATO_MERCADO_LIVRE;
}

// ---------------------------------------------------------------
// Limpeza dos campos (nunca completa nem inventa nada)
// ---------------------------------------------------------------
export function limparCodigo(valor) {
  const texto = String(valor || "")
    .replace(/[^\p{L}\p{N} .\-/]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return texto.slice(0, 40);
}

export function limparSite(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return "";
  if (/^@[\w.]{2,40}$/.test(texto)) return texto;
  const semProtocolo = texto
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (/\s/.test(semProtocolo)) return "";
  if (!/^[\w-]+(\.[\w-]+)+(\/[\w\-./?=&%#]*)?$/i.test(semProtocolo)) return "";
  return semProtocolo.toLowerCase().slice(0, 60);
}

export function formatarWhatsApp(valor) {
  let digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.length >= 12 && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  if (digitos.length === 9) {
    return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
  }
  if (digitos.length === 8) {
    return `${digitos.slice(0, 4)}-${digitos.slice(4)}`;
  }
  return "";
}

// "R$ 1.299,90" -> { simbolo: "R$", inteiro: "1.299", centavos: ",90" }
export function partesPreco(precoFormatado) {
  const texto = String(precoFormatado || "").trim();
  const encontrado = texto.match(/^(R\$)\s*([\d.]+)(,\d{2})?$/);
  if (!encontrado) {
    return texto ? { simbolo: "", inteiro: texto, centavos: "" } : null;
  }
  return {
    simbolo: encontrado[1],
    inteiro: encontrado[2],
    centavos: encontrado[3] || "",
  };
}

// Dados comerciais que realmente entram na arte.
// Mercado Livre: tudo bloqueado, mesmo que preenchido.
export function dadosComerciaisDoBanner({
  formato,
  dados = {},
  exibir = {},
  formatarPreco = (valor) => String(valor || "").trim(),
}) {
  const vazio = { logo: "", preco: "", codigo: "", site: "", whatsapp: "", nomeLoja: "" };

  const preenchidos = {
    logo: String(dados.logo || "").trim(),
    preco: formatarPreco(dados.preco),
    codigo: limparCodigo(dados.codigo),
    site: limparSite(dados.site),
    whatsapp: formatarWhatsApp(dados.whatsapp),
  };

  if (ehMercadoLivre(formato)) {
    return {
      ...vazio,
      bloqueados: CAMPOS_COMERCIAIS.filter((campo) => preenchidos[campo]),
    };
  }

  const resultado = { ...vazio, bloqueados: [] };
  for (const campo of CAMPOS_COMERCIAIS) {
    if (exibir[campo] !== false && preenchidos[campo]) {
      resultado[campo] = preenchidos[campo];
    }
  }
  // Sem arquivo de logo, o nome real da loja pode ocupar o lugar do logo.
  if (!resultado.logo && exibir.logo !== false) {
    resultado.nomeLoja = String(dados.nomeLoja || "").trim().slice(0, 40);
  }
  return resultado;
}

// ---------------------------------------------------------------
// Variação (determinística por número, para "Gerar novamente")
// ---------------------------------------------------------------
export function numeroAleatorio(semente) {
  let x = (Math.abs(Math.floor(Number(semente) || 0)) + 1) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const CENARIOS = [
  { id: "estudio-neon", nome: "estúdio com linhas de luz neon e piso reflexivo", pedestal: true, feixes: true, grade: false, anel: false },
  { id: "anel-luz", nome: "anel de luz circular atrás do produto", pedestal: true, feixes: false, grade: false, anel: true },
  { id: "velocidade", nome: "feixes diagonais de velocidade", pedestal: false, feixes: true, grade: true, anel: false },
  { id: "oficina-bokeh", nome: "oficina desfocada com luzes bokeh", pedestal: true, feixes: false, grade: false, anel: false },
  { id: "tecnologia", nome: "grade tecnológica em perspectiva", pedestal: false, feixes: false, grade: true, anel: true },
  { id: "fumaca-luz", nome: "névoa com raios de luz volumétrica", pedestal: true, feixes: true, grade: false, anel: false },
];

export function escolherCenario(variacao) {
  const n = CENARIOS.length;
  const indice = (((Math.floor(Number(variacao) || 0) * 5 + 2) % n) + n) % n;
  return CENARIOS[indice];
}

// ---------------------------------------------------------------
// Layout
// ---------------------------------------------------------------
function ret(x, y, largura, altura) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    largura: Math.max(1, Math.round(largura)),
    altura: Math.max(1, Math.round(altura)),
  };
}

export function retangulosSobrepoem(a, b, folga = 0) {
  if (!a || !b) return false;
  return !(
    a.x + a.largura <= b.x + folga ||
    b.x + b.largura <= a.x + folga ||
    a.y + a.altura <= b.y + folga ||
    b.y + b.altura <= a.y + folga
  );
}

// Encaixa a peça (proporção real, sem distorcer) dentro da área.
export function encaixarProduto(area, proporcao, preenchimento = 1) {
  const p = Number(proporcao) > 0 ? Number(proporcao) : 1;
  let largura = area.largura * preenchimento;
  let altura = largura / p;
  if (altura > area.altura * preenchimento) {
    altura = area.altura * preenchimento;
    largura = altura * p;
  }
  return ret(
    area.x + (area.largura - largura) / 2,
    area.y + (area.altura - altura) / 2,
    largura,
    altura
  );
}

// Layouts elegíveis conforme formato e formato da peça.
export function layoutsElegiveis({ largura, altura, formato, proporcaoProduto }) {
  if (ehMercadoLivre(formato)) return ["ml-centro"];
  const vertical = altura / largura >= 1.5;
  const pecaLarga = proporcaoProduto >= 1.45;
  const pecaAlta = proporcaoProduto <= 0.7;
  if (vertical) {
    return pecaAlta
      ? ["v-lado-produto-direita", "v-titulo-topo", "v-produto-topo"]
      : ["v-titulo-topo", "v-produto-topo"];
  }
  // Peça larga: também a faixa central (título em cima, peça na largura toda, preço embaixo).
  if (pecaLarga) return ["titulo-topo", "v-titulo-topo", "produto-direita", "produto-esquerda"];
  return ["produto-direita", "produto-esquerda", "titulo-topo"];
}

// A peça é a protagonista: entre os layouts possíveis, fica só com os que
// deixam a peça (sem deformar) com pelo menos 90% da maior área possível.
function escolherLayoutComPecaMaior(lista, planejar, variacao) {
  if (lista.length <= 1) return lista[0];
  const areas = lista.map((nome) => {
    const produto = planejar(nome).produto;
    return { nome, area: produto ? produto.largura * produto.altura : 0 };
  });
  const maior = Math.max(...areas.map((item) => item.area));
  const bons = areas.filter((item) => item.area >= maior * 0.9).map((item) => item.nome);
  return bons[Math.abs(Math.floor(variacao)) % bons.length];
}

export function planejarLayout({
  largura,
  altura,
  formato,
  proporcaoProduto = 1,
  variacao = 0,
  temLogo = false,
  temContato = false,
  temChamadaMl = false,
  temPreco = true,
  temCodigo = true,
  nomeForcado = "",
}) {
  // Mercado Livre nunca reserva espaço para logo ou contatos.
  if (ehMercadoLivre(formato)) {
    temLogo = false;
    temContato = false;
  }
  const margem = Math.round(Math.min(largura, altura) * 0.05);
  const espaco = Math.round(margem * 0.6);
  const lista = layoutsElegiveis({ largura, altura, formato, proporcaoProduto });
  const nome = nomeForcado || escolherLayoutComPecaMaior(lista, (candidato) =>
    planejarLayout({
      largura, altura, formato, proporcaoProduto, variacao, temLogo, temContato,
      temChamadaMl, temPreco, temCodigo, nomeForcado: candidato,
    }), variacao);
  const cenario = escolherCenario(variacao);
  const logoNaDireita = numeroAleatorio(variacao * 11 + 5) > 0.5;
  const verticalFormato = altura / largura >= 1.5;
  // Stories/Status: logo centralizado no topo, com destaque próprio.
  const logoCentro = verticalFormato;

  const alturaTopo = temLogo ? Math.round(altura * (verticalFormato ? 0.07 : 0.095)) : 0;
  const alturaRodape = temContato ? Math.round(altura * (verticalFormato ? 0.055 : 0.08)) : 0;
  const topo = margem + (alturaTopo ? alturaTopo + espaco : 0);
  const base = altura - margem - (alturaRodape ? alturaRodape + espaco : 0);
  const util = { x: margem, y: topo, largura: largura - margem * 2, altura: base - topo };

  const plano = {
    nome,
    cenario,
    margem,
    zonaLogo: temLogo
      ? ret(
          logoCentro
            ? (largura - largura * 0.44) / 2
            : logoNaDireita
              ? largura - margem - largura * 0.34
              : margem,
          margem,
          largura * (logoCentro ? 0.44 : 0.34),
          alturaTopo
        )
      : null,
    logoNaDireita,
    logoCentro,
    zonaRodape: temContato ? ret(margem, altura - margem - alturaRodape, largura - margem * 2, alturaRodape) : null,
    zonaTexto: null,
    zonaPreco: null,
    areaProduto: null,
    produto: null,
    zonaChamadaMl: null,
    alinhamento: "left",
  };

  if (nome === "ml-centro") {
    const faixa = temChamadaMl ? Math.round(altura * 0.12) : 0;
    const chamadaEmCima = numeroAleatorio(variacao * 5 + 1) > 0.5;
    const margemMl = Math.round(largura * 0.06);
    const area = ret(
      margemMl,
      margemMl + (faixa && chamadaEmCima ? faixa + espaco : 0),
      largura - margemMl * 2,
      altura - margemMl * 2 - (faixa ? faixa + espaco : 0)
    );
    plano.areaProduto = area;
    plano.produto = encaixarProduto(area, proporcaoProduto, 0.96);
    plano.zonaChamadaMl = faixa
      ? ret(margemMl, chamadaEmCima ? margemMl : altura - margemMl - faixa, largura - margemMl * 2, faixa)
      : null;
    plano.alinhamento = "center";
    return plano;
  }

  if (nome === "produto-direita" || nome === "produto-esquerda") {
    const direita = nome === "produto-direita";
    const larguraProduto = util.largura * (proporcaoProduto >= 1.3 ? 0.64 : 0.6);
    const area = ret(
      direita ? util.x + util.largura - larguraProduto : util.x,
      util.y,
      larguraProduto,
      util.altura
    );
    plano.areaProduto = area;
    plano.produto = encaixarProduto(area, proporcaoProduto, 0.98);
    plano.zonaTexto = ret(
      direita ? util.x : util.x + larguraProduto + espaco,
      util.y,
      util.largura - larguraProduto - espaco,
      util.altura
    );
  } else if (nome === "titulo-topo") {
    const alturaTitulo = util.altura * 0.26;
    plano.zonaTexto = ret(util.x, util.y, util.largura, alturaTitulo);
    const semBlocoPreco = !temPreco && !temCodigo;
    const larguraProduto = util.largura * (semBlocoPreco ? 1 : 0.66);
    const produtoDireita = numeroAleatorio(variacao * 3 + 9) > 0.5;
    const area = ret(
      produtoDireita ? util.x + util.largura - larguraProduto : util.x,
      util.y + alturaTitulo + espaco,
      larguraProduto,
      util.altura - alturaTitulo - espaco
    );
    plano.areaProduto = area;
    plano.produto = encaixarProduto(area, proporcaoProduto, 0.95);
    plano.zonaPreco = semBlocoPreco
      ? null
      : ret(
          produtoDireita ? util.x : util.x + larguraProduto + espaco,
          util.y + alturaTitulo + espaco,
          util.largura - larguraProduto - espaco,
          util.altura - alturaTitulo - espaco
        );
  } else if (nome === "v-titulo-topo" || nome === "v-produto-topo") {
    const alturaTitulo = util.altura * 0.17;
    // Bloco comercial só do tamanho do que existe (preço > código > CTA).
    const fracaoBloco = temPreco ? (temCodigo ? 0.27 : 0.22) : temCodigo ? 0.12 : 0.08;
    const alturaProduto = util.altura - alturaTitulo - util.altura * fracaoBloco - espaco * 2;
    const produtoPrimeiro = nome === "v-produto-topo";
    const yProduto = produtoPrimeiro ? util.y : util.y + alturaTitulo + espaco;
    const yTitulo = produtoPrimeiro ? util.y + alturaProduto + espaco : util.y;
    const area = ret(util.x, yProduto, util.largura, alturaProduto);
    plano.areaProduto = area;
    plano.produto = encaixarProduto(area, proporcaoProduto, 1);
    plano.zonaTexto = ret(util.x, yTitulo, util.largura, alturaTitulo);
    const yPreco = Math.max(yProduto + alturaProduto, yTitulo + alturaTitulo) + espaco;
    plano.zonaPreco = ret(util.x, yPreco, util.largura, util.y + util.altura - yPreco);
    plano.alinhamento = "center";
  } else {
    // v-lado-produto-direita: título em cima; peça alta ao lado do preço
    const alturaTitulo = util.altura * 0.19;
    plano.zonaTexto = ret(util.x, util.y, util.largura, alturaTitulo);
    // Largura da coluna da peça conforme a proporção dela (peça alta = coluna
    // estreita e bem alta); o resto fica para preço, código e CTA.
    const alturaColuna = util.altura - alturaTitulo - espaco;
    const larguraIdeal = (alturaColuna * 0.97 * proporcaoProduto) / util.largura + 0.04;
    const larguraProduto = util.largura * Math.min(0.6, Math.max(0.44, larguraIdeal));
    const area = ret(
      util.x + util.largura - larguraProduto,
      util.y + alturaTitulo + espaco,
      larguraProduto,
      util.altura - alturaTitulo - espaco
    );
    plano.areaProduto = area;
    plano.produto = encaixarProduto(area, proporcaoProduto, 0.96);
    plano.zonaPreco = ret(
      util.x,
      util.y + alturaTitulo + espaco,
      util.largura - larguraProduto - espaco,
      util.altura - alturaTitulo - espaco
    );
  }

  return plano;
}

// Converte o retângulo final para o quadro pedido à IA (preenchimento "cover").
export function mapearParaQuadroIA(retangulo, final, quadro) {
  const escala = Math.max(final.largura / quadro.largura, final.altura / quadro.altura);
  const deslocX = (quadro.largura * escala - final.largura) / 2;
  const deslocY = (quadro.altura * escala - final.altura) / 2;
  return {
    x: (retangulo.x + deslocX) / escala,
    y: (retangulo.y + deslocY) / escala,
    largura: retangulo.largura / escala,
    altura: retangulo.altura / escala,
  };
}

// Tamanho pedido à OpenAI para cada formato final.
export function tamanhoQuadroIA(largura, altura) {
  const razao = altura / largura;
  if (razao >= 1.2) return { largura: 1024, altura: 1536, texto: "1024x1536" };
  if (razao <= 0.83) return { largura: 1536, altura: 1024, texto: "1536x1024" };
  return { largura: 1024, altura: 1024, texto: "1024x1024" };
}

// Onde a peça real será colada (para a IA deixar o lugar vazio e iluminado).
export function descreverZonaProduto(retangulo, quadro) {
  const px = (v, total) => Math.max(0, Math.min(100, Math.round((v / total) * 100)));
  return `${px(retangulo.x, quadro.largura)}% to ${px(retangulo.x + retangulo.largura, quadro.largura)}% of the image width and ${px(retangulo.y, quadro.altura)}% to ${px(retangulo.y + retangulo.altura, quadro.altura)}% of the image height`;
}

// Descrição das áreas livres (para a IA deixar espaço para o texto).
export function descreverZonasLivres(plano, largura, altura) {
  const zonas = [plano.zonaTexto, plano.zonaPreco, plano.zonaChamadaMl, plano.zonaLogo, plano.zonaRodape]
    .filter(Boolean)
    .map((zona) => {
      const px = (v, total) => Math.round((v / total) * 100);
      return `${px(zona.x, largura)}%–${px(zona.x + zona.largura, largura)}% da largura × ${px(zona.y, altura)}%–${px(zona.y + zona.altura, altura)}% da altura`;
    });
  return zonas;
}
