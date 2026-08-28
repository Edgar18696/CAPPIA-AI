import { supabase } from "../supabase";

export async function salvarBoschSupabase(
  registros
) {
  if (
    !Array.isArray(registros) ||
    registros.length === 0
  ) {
    return {
      sucesso: true,
      inseridos: 0,
    };
  }

  let inseridos = 0;

  for (const registro of registros) {
  const { error } = await supabase
  .from("catalogo_mestre")
  .upsert(
    {
      peca: registro.peca,

      codigo_oem:
        registro.codigo_oem,

      codigo_equivalente:
        registro.codigo_equivalente,

      fabricante:
        registro.fabricante,

      origem_catalogo:
        registro.origem_catalogo,

      montadora:
        registro.montadora,

      modelo:
        registro.modelo,

      motor:
        registro.motor,

      combustivel:
        registro.combustivel,

      observacao:
        registro.observacao || "",

      ativo: true,

      prioridade:
        registro.prioridade ?? 1,

      confiabilidade:
        registro.confiabilidade ?? 100,
    },
    {
      onConflict:
        "codigo_oem,fabricante,montadora,modelo,motor",
    }
  );

if (!error) {
  inseridos++;
} else {
  console.error(
    "Erro ao salvar:",
    registro.codigo_oem,
    error
  );
}
  return {
    sucesso: true,
    inseridos,
  };
}