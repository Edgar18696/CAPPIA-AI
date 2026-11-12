// =============================================================
// PAIIA — Regras do Mercado Livre — Anúncios (mesmo produto em várias
// contas). Catálogo de regras OFICIAIS, versionado, com fonte e data.
// Só dados: nada aqui lê ou altera anúncios. Plano completo em
// docs/regras-ml-anuncios/PLANO.md (ramo paizinho/regras-ml-anuncios).
// Revisar as fontes a cada 90 dias.
// =============================================================

export const VERSAO_REGRAS = "2026-11-11";
export const DATA_ACESSO = "11/11/2026";
export const REVISAR_A_CADA_DIAS = 90;

export const CONTAS_REGRAS = Object.freeze([
  { nome: "LOJA ONLINE", ml: "1729335019", leitura: "piloto (somente leitura)" },
  { nome: "REVELAÇÃO", ml: "2412238242", leitura: "somente leitura (12/11/2026)" },
  { nome: "CIEBR", ml: "824312524", leitura: "somente leitura (12/11/2026)" },
]);

/** tipo: "explicita" = escrito na fonte; "interpretacao" = conclusão a partir do texto. */
export const REGRAS = Object.freeze([
  {
    id: "R1", titulo: "Anúncio duplicado é proibido", tipo: "explicita",
    resumo: "Não é permitido anunciar o mesmo produto com as mesmas condições de venda. Só se aceita repetir para oferecer outra forma de envio ou de pagamento. O ML exclui os duplicados e isso pode levar à desativação da conta.",
    fontes: [["Central de Ajuda — Anúncios duplicados", "https://www.mercadolivre.com.br/ajuda/Anuncios-duplicados_2517"]],
  },
  {
    id: "R2", titulo: "Duplicados são cancelados; fica o de melhor visibilidade", tipo: "explicita",
    resumo: "Duplicados são cancelados automaticamente; o ML mantém ativo o anúncio com melhor visibilidade. Orientação: agrupar variações ou criar kits.",
    fontes: [["Central de Vendedores — Anúncios duplicados", "https://vendedores.mercadolivre.com.br/nota/anuncios-duplicados-o-que-sao-e-como-evita-los"]],
  },
  {
    id: "R3", titulo: "Autopeças: duplicado é cancelado; juntar compatibilidades", tipo: "explicita",
    resumo: "Em Peças de Carros e Caminhonetes o duplicado pode ser cancelado. Não criar mais de um anúncio do mesmo produto: adicionar os veículos compatíveis no anúncio com mais exposição. Envio ou pagamento diferentes não são pausados.",
    fontes: [["Central de Vendedores — Autopeças duplicadas", "https://vendedores.mercadolivre.com.br/nota/por-que-evitar-anuncios-duplicados-de-autopecas"]],
  },
  {
    id: "R4", titulo: "Anunciar semelhante: mudar preço, tipo ou envio", tipo: "explicita",
    resumo: "Ao copiar um anúncio próprio, o ML recomenda mudar preço, tipo de publicação ou envio. A política oficial (R1) só cita envio e pagamento: diferença só de preço é ambígua.",
    fontes: [["Central de Vendedores — Anunciar semelhante", "https://vendedores.mercadolivre.com.br/nota/crie-anuncios-a-partir-de-produtos-que-ja-estao-a-venda"]],
  },
  {
    id: "R5", titulo: "Clonar anúncios ou imagens é moderado", tipo: "explicita",
    resumo: "O ML não recomenda clonar publicações nem imagens: \"Este cenário será moderado\". Copiar o mesmo anúncio com as mesmas fotos de uma conta para outra é o principal risco.",
    fontes: [["Developers — Boas práticas", "https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/boas-praticas-para-usar-a-plataforma"]],
  },
  {
    id: "R6", titulo: "Moderação DUPLIS", tipo: "explicita",
    resumo: "Existe a moderação \"DUPLIS – Publicações duplicadas\" (inativa, inativa para revisar ou ativa com perda de exposição). O histórico de infrações não mostra itens removidos por duplicidade.",
    fontes: [["Developers — Gerenciar moderações", "https://developers.mercadolivre.com.br/pt_br/gerenciar-moderacoes"]],
  },
  {
    id: "R7", titulo: "Termos: uso de mais de uma conta", tipo: "explicita",
    resumo: "Os Termos não proíbem ter várias contas, mas o ML pode aplicar medidas se o uso de mais de uma conta prejudicar outros usuários. Sanções vão de aviso a desativação.",
    fontes: [["Termos e condições gerais (modificados em 15/10/2026)", "https://www.mercadolivre.com.br/ajuda/991"]],
  },
  {
    id: "R8", titulo: "Só pela API oficial, sem raspagem", tipo: "explicita",
    resumo: "É proibido usar robôs ou raspagem para extrair conteúdo do site. A função usa só a API oficial, com as contas autorizadas.",
    fontes: [["Termos e condições gerais — seção 12", "https://www.mercadolivre.com.br/ajuda/991"]],
  },
  {
    id: "R9", titulo: "Sanções podem atingir todas as contas", tipo: "explicita",
    resumo: "Em denúncias de marca (Brand Protection), as sanções podem ser aplicadas \"sobre todas suas contas na plataforma\". Mostra que o ML liga contas do mesmo titular.",
    fontes: [["Termos e condições Marketplace", "https://www.mercadolivre.com.br/ajuda/23050"]],
  },
  {
    id: "R10", titulo: "Políticas de cadastramento fazem parte dos Termos", tipo: "explicita",
    resumo: "Descumprir as políticas implica cancelamento do conteúdo e pode gerar sanções e suspensão da conta.",
    fontes: [["Cadastramento de anúncios", "https://www.mercadolivre.com.br/ajuda/1012"]],
  },
  {
    id: "R11", titulo: "Regras correlatas", tipo: "explicita",
    resumo: "Preço simbólico para manipular a busca é proibido; anunciar um produto para vender outro, ou quantidade diferente, é proibido; fotos sem logos ou texto; kits virtuais duplicados não são permitidos.",
    fontes: [
      ["Infrações de preço", "https://www.mercadolivre.com.br/ajuda/1019"],
      ["Contornar tarifas", "https://www.mercadolivre.com.br/ajuda/1027"],
      ["Infrações em fotos", "https://www.mercadolivre.com.br/ajuda/1024"],
      ["Kits virtuais", "https://developers.mercadolivre.com.br/pt_br/kits-virtuais"],
    ],
  },
  {
    id: "R12", titulo: "Catálogo: contas disputam a mesma página", tipo: "interpretacao",
    resumo: "No catálogo, um algoritmo escolhe o ganhador por preço, parcelamento, envio e reputação. Duas contas no mesmo produto de catálogo competem entre si; não há regra oficial sobre contas do mesmo dono.",
    fontes: [["Developers — Concorrência em catálogo", "https://developers.mercadolivre.com.br/pt_br/concorrencia-em-catalogo"]],
  },
]);

export const LACUNAS = Object.freeze([
  "Nenhuma fonte oficial diz se a regra de duplicado vale entre contas diferentes do mesmo dono.",
  "Nenhuma regra distingue contas de CNPJs diferentes das contas do mesmo titular.",
  "Os Termos não fixam quantas contas um vendedor pode ter.",
  "Mudar só fotos ou título não tem base oficial para deixar de ser duplicado; mudar só o preço é ambíguo.",
  "Clássico x Premium como diferença aparece só numa nota (R4), não na política oficial (R1).",
]);

export const NIVEIS_RISCO = Object.freeze([
  { nivel: "Alto", cor: "#f87171", criterio: "Mesmo produto em 2 ou mais contas com o mesmo envio e o mesmo tipo de anúncio; fotos clonadas; ou moderação de duplicado já aplicada. Duplicado dentro da mesma conta também é alto.", base: "R1, R2, R5, R6" },
  { nivel: "Médio", cor: "#fbbf24", criterio: "Mesmo produto diferente só no preço, nas fotos ou no título; ou duas contas disputando o mesmo produto de catálogo.", base: "R4, R7, R12" },
  { nivel: "Baixo", cor: "#4ade80", criterio: "Mesmo produto com envio ou pagamento/tipo de anúncio diferentes e fotos próprias.", base: "R1, R3, R4" },
  { nivel: "Informativo", cor: "#94a3b8", criterio: "Produtos parecidos, mas com código, lado ou aplicação diferentes.", base: "—" },
]);

export const RECOMENDACOES = Object.freeze([
  { acao: "Manter", texto: "Risco baixo: já existe diferença de envio ou de pagamento.", base: "R1, R3" },
  { acao: "Melhorar", texto: "Sugestões sem executar: diferenciar o envio ou o tipo de anúncio de verdade, trocar fotos clonadas por fotos próprias, juntar compatibilidades no anúncio com mais exposição, ou transformar em variação/kit.", base: "R1, R3, R4, R5" },
  { acao: "Unificar (decisão sua)", texto: "Só para duplicidade confirmada na MESMA conta (mesmo código, quantidade, marca, aplicações, tipo e envio) quando não for possível diferenciar a condição de venda: juntar num anúncio só, com todas as aplicações. Qual manter é decisão sua, considerando histórico, reputação do anúncio e posição na busca — nunca só as vendas. Entre contas diferentes as regras não são claras: não sugerimos encerrar.", base: "R1, R2, R3" },
]);

/** O que identifica o mesmo produto entre contas, do sinal mais forte ao mais fraco. */
export const SINAIS_MESMO_PRODUTO = Object.freeze([
  "GTIN igual",
  "Código da peça (PART_NUMBER) e marca iguais",
  "Código original/OEM e marca iguais",
  "SKU do vendedor igual",
  "Mesmo produto de catálogo",
  "Fotos iguais (indício de clonagem)",
  "Título muito parecido na mesma categoria (só confirma junto com outro sinal)",
]);

export const ETAPAS = Object.freeze([
  { etapa: "Catálogo de regras oficiais com fonte e data", situacao: "pronto" },
  { etapa: "Ler os anúncios ativos das 3 contas (somente leitura, autorizado em 12/11/2026)", situacao: "pronto" },
  { etapa: "Detectar o mesmo produto entre contas e classificar o risco", situacao: "pronto" },
  { etapa: "Visitas de 30 dias da REVELAÇÃO e da CIEBR (hoje só a LOJA ONLINE)", situacao: "aguardando autorização para publicar a leitura ampliada" },
  { etapa: "Comparar fotos (hash)", situacao: "aguardando autorização" },
  { etapa: "Consultar o suporte do ML sobre as lacunas", situacao: "aguardando autorização" },
  { etapa: "Qualquer ação nos anúncios", situacao: "nunca automática: só com sua autorização, item por item" },
]);
