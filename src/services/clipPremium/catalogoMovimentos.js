// Clip Premium — movimento OFICIAL único (set/2026).
// Slide lateral sutil da câmera (10–20°) + aproximação (push-in) suave no final.
// A peça NUNCA gira: sem 180°/360°, sem órbita, sem revelar lados ocultos.
// Movimentos antigos de rotação foram removidos da tela e do prompt.

export const MOVIMENTO_OFICIAL_CLIP_PREMIUM_ID = "slide-push-in";

export const MOVIMENTOS_CLIP_PREMIUM = [
  {
    id: MOVIMENTO_OFICIAL_CLIP_PREMIUM_ID,
    nome: "Slide lateral + aproximação",
    descricao:
      "A câmera desliza 10–20° para o lado e termina com uma aproximação suave. A peça não gira.",
    demo: "slide-push-in",
    promptMovimento:
      "The product stays completely still and never rotates. Only the camera moves: a very slow, subtle lateral slide of about 10–20 degrees, staying within the geometry visible in the reference photo, followed by a gentle push-in at the end. Keep the exact original viewing angle as the starting frame. Never reveal hidden sides, never orbit, no 180° or 360° turns.",
  },
];

// IDs antigos (rotação/órbita) que podem estar salvos no navegador.
// Qualquer um deles é convertido para o movimento oficial.
export const MOVIMENTOS_CLIP_PREMIUM_LEGADOS = [
  "giro-suave",
  "360",
  "giro-360",
  "zoom-cinematico",
  "panoramico",
  "detalhes-produto",
  "comercial-dinamico",
  "flutuacao-premium",
  "entrada-giro",
  "orbita",
  "orbita-lateral",
];

export function normalizarMovimentoClipPremium(id) {
  void id;
  return MOVIMENTO_OFICIAL_CLIP_PREMIUM_ID;
}

export function obterMovimentoClipPremium(id) {
  void id;
  return MOVIMENTOS_CLIP_PREMIUM[0];
}
