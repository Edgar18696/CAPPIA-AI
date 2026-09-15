export const REGRAS_PRESERVACAO_PRODUTO = [
  "Create a premium commercial product video using exactly the automotive part from the reference image.",

  "The product must remain completely unchanged throughout the entire video.",

  "Preserve the exact shape, proportions, colors, connectors, tubes, holes, materials and every visible physical detail from the reference image.",

  "Keep the product completely stationary.",

  "Do not rotate the product.",

  "Do not orbit around the product.",

  "Do not reveal the back or any hidden side.",

  "Start from exactly the same viewing angle as the reference image.",

  "Create depth only through camera movement.",

  "Make a very slow, subtle lateral camera slide of approximately 10–20 degrees while gradually pushing in toward the product.",

  "Keep the camera within the visible geometry of the original reference image.",

  "Never move far enough to require reconstruction of hidden parts.",

  "Finish with a slow premium close-up, keeping the original product geometry unchanged.",

  "Use a pure white studio background, subtle realistic shadow and professional product lighting.",

  "No text, no logo, no hands, no additional objects.",

  "No cuts, no deformation, no duplication and no new geometry.",
];

export function textoPreservacaoProduto() {
  return REGRAS_PRESERVACAO_PRODUTO.join(" ");
}