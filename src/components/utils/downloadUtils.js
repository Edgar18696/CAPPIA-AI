export async function baixarImagem(url) {
  const resposta = await fetch(url);
  const blob = await resposta.blob();

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `appia-ai-${Date.now()}.png`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}