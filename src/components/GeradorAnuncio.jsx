async function gerarAnuncioComIA() {
  if (!codigo && !oem) {
    alert("Informe o código da peça ou OEM para a IA gerar o anúncio.");
    return;
  }

  const encontrou = await buscarNoCatalogo();

  if (!encontrou) {
    return;
  }

  alert("✅ Anúncio gerado com inteligência do catálogo!");
}