export const MOVIMENTOS_CLIP_PREMIUM = [
  {
    id: "giro-suave",
    nome: "Giro Suave",
    descricao: "Leve oscilação que mantém a peça inteira à vista.",
    demo: "giro-suave",
    promptMovimento:
      "Oscilação suave e curta no próprio eixo, sem completar 360°. Manter o produto inteiro, estável e centralizado. Sem zoom que corte a peça.",
  },
  {
    id: "360",
    nome: "Giro 360° IA",
    descricao: "Rotação completa a partir da foto.",
    demo: "giro-360",
    aviso:
      "A IA cria uma visão em rotação a partir da imagem fornecida. Partes não visíveis podem ser reconstruídas pela IA.",
    promptMovimento:
      "A única transformação permitida é a rotação do produto em torno do próprio eixo central, como em uma plataforma giratória de estúdio. Câmera fixa. Produto centralizado e inteiro visível. Sem zoom, dolly, pan ou tilt. Partes não visíveis na foto podem ser reconstruídas com máxima fidelidade ao que já se vê.",
  },
  {
    id: "zoom-cinematico",
    nome: "Zoom Cinemático",
    descricao: "Aproximação elegante, sem cortar o produto.",
    demo: "zoom-cinematico",
    promptMovimento:
      "Aproximação cinematográfica muito discreta. O produto deve permanecer inteiro no quadro o tempo todo. Sem cortar conectores ou bordas.",
  },
  {
    id: "panoramico",
    nome: "Panorâmico",
    descricao: "Deslocamento lateral suave com a peça no centro.",
    demo: "panoramico",
    promptMovimento:
      "Panorâmica lateral suave. O produto permanece inteiro e legível. Não sair do quadro.",
  },
  {
    id: "detalhes-produto",
    nome: "Detalhes do Produto",
    descricao: "Valoriza gravuras e conectores sem perder o conjunto.",
    demo: "detalhes-produto",
    promptMovimento:
      "Valorizar detalhes (conectores, gravações) com movimento mínimo, sempre mostrando o produto como um conjunto reconhecível. Não recortar a peça.",
  },
  {
    id: "comercial-dinamico",
    nome: "Comercial Dinâmico",
    descricao: "Ritmo de anúncio, produto sempre legível.",
    demo: "comercial-dinamico",
    promptMovimento:
      "Movimento comercial dinâmico e curto. Produto protagonista, inteiro no quadro, sem efeitos que distraiam da peça.",
  },
  {
    id: "flutuacao-premium",
    nome: "Flutuação Premium",
    descricao: "Flutua com suavidade em fundo limpo.",
    demo: "flutuacao-premium",
    promptMovimento:
      "Flutuação suave e premium. Produto centralizado, inteiro e estável. Sem sair do quadro.",
  },
  {
    id: "entrada-giro",
    nome: "Entrada + Giro",
    descricao: "Entra no quadro e gira de forma controlada.",
    demo: "entrada-giro",
    promptMovimento:
      "Entrada suave seguida de giro curto e controlado. O produto deve permanecer inteiro e centralizado após a entrada.",
  },
];

export function obterMovimentoClipPremium(id) {
  return (
    MOVIMENTOS_CLIP_PREMIUM.find((item) => item.id === id) ||
    MOVIMENTOS_CLIP_PREMIUM.find((item) => item.id === "giro-suave")
  );
}
