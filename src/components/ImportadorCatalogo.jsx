import { useEffect, useState } from "react";
import { supabase } from "../supabase";

import DashboardCatalogo from "./DashboardCatalogo";
import ImportadorExcel from "./ImportadorExcel";
import BuscaCatalogo from "./BuscaCatalogo";
import TabelaCatalogo from "./TabelaCatalogo";
import ModalEditar from "./ModalEditar";

export default function ImportadorCatalogo() {
  const [dados, setDados] = useState([]);
  const [colunas, setColunas] = useState([]);
  const [mensagem, setMensagem] = useState("");
  const [importando, setImportando] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [busca, setBusca] = useState("");
  const [buscaIA, setBuscaIA] = useState("");
  const [editando, setEditando] = useState(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  useEffect(() => {
    carregarCatalogo();
  }, []);

  async function carregarCatalogo() {
    const { data, error } = await supabase
      .from("catalogo_pecas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.log("ERRO CARREGAR CATÁLOGO:", error);
      setMensagem("Erro ao carregar catálogo.");
      return;
    }

    setCatalogo(data || []);
  }

  async function importarArquivo(e) {
    const arquivo = e.target.files[0];

    if (!arquivo) return;

    setMensagem("Lendo arquivo...");
    setDados([]);
    setColunas([]);

    const XLSX = await import("xlsx");
    const reader = new FileReader();

    reader.onload = (evento) => {
      const workbook = XLSX.read(evento.target.result, {
        type: "binary",
      });

      const nomeAba = workbook.SheetNames[0];
      const planilha = workbook.Sheets[nomeAba];
      const json = XLSX.utils.sheet_to_json(planilha);

      setDados(json);
      setColunas(json.length > 0 ? Object.keys(json[0]) : []);
      setMensagem(`Arquivo carregado: ${json.length} registros.`);
    };

    reader.readAsBinaryString(arquivo);
  }

  async function importarParaSupabase() {
    if (dados.length === 0) {
      setMensagem("Nenhum dado para importar.");
      return;
    }

    setImportando(true);
    setMensagem("Importando...");

    const registros = dados.map((item) => ({
      montadora: item.montadora || item.Montadora || "",
      modelo: item.modelo || item.Modelo || "",
      ano_inicio: Number(
        item.ano_inicio || item.AnoInicio || item.ano || item.Ano || 0
      ),
      ano_fim: Number(
        item.ano_fim || item.AnoFim || item.ano || item.Ano || 0
      ),
      motor: item.motor || item.Motor || "",
      peca: item.peca || item.Peça || item.Peca || "",
      codigo_oem: item.codigo_oem || item.OEM || item.oem || "",
      codigo_equivalente:
        item.codigo_equivalente || item.Equivalente || item.equivalente || "",
      fabricante: item.fabricante || item.Fabricante || "",
      observacao:
        item.observacao || item.Observacao || item.Observação || "",
    }));

    const { error } = await supabase
      .from("catalogo_pecas")
      .upsert(registros, {
        onConflict:
          "montadora,modelo,ano_inicio,ano_fim,motor,peca,codigo_oem",
      });

    if (error) {
      console.log("ERRO IMPORTAÇÃO:", error);
      setMensagem(`Erro: ${error.message}`);
      setImportando(false);
      return;
    }

    setMensagem(
      `✅ Catálogo sincronizado com sucesso!

📦 ${registros.length} registros processados.

• Novos registros foram adicionados.
• Registros existentes foram atualizados automaticamente.`
    );

    setDados([]);
    setColunas([]);
    await carregarCatalogo();
    setImportando(false);
  }

  async function excluirRegistro(id) {
    const confirmar = window.confirm(
      "Deseja excluir este registro do catálogo?"
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("catalogo_pecas")
      .delete()
      .eq("id", id);

    if (error) {
      console.log("ERRO EXCLUIR:", error);
      setMensagem(`Erro ao excluir: ${error.message}`);
      return;
    }

    setMensagem("Registro excluído com sucesso.");
    await carregarCatalogo();
  }

  async function salvarEdicao() {
    if (!editando?.id) return;

    setSalvandoEdicao(true);
    setMensagem("Salvando edição...");

    const { error } = await supabase
      .from("catalogo_pecas")
      .update({
        montadora: editando.montadora || "",
        modelo: editando.modelo || "",
        ano_inicio: Number(editando.ano_inicio || 0),
        ano_fim: Number(editando.ano_fim || 0),
        motor: editando.motor || "",
        peca: editando.peca || "",
        codigo_oem: editando.codigo_oem || "",
        codigo_equivalente: editando.codigo_equivalente || "",
        fabricante: editando.fabricante || "",
        observacao: editando.observacao || "",
      })
      .eq("id", editando.id);

    setSalvandoEdicao(false);

    if (error) {
      console.log("ERRO AO EDITAR:", error);
      setMensagem(`Erro ao salvar edição: ${error.message}`);
      return;
    }

    setMensagem("Registro atualizado com sucesso.");
    setEditando(null);
    await carregarCatalogo();
  }

  const totalPecas = catalogo.length;

  const totalMontadoras = new Set(
    catalogo.map((item) => item.montadora).filter(Boolean)
  ).size;

  const totalModelos = new Set(
    catalogo.map((item) => item.modelo).filter(Boolean)
  ).size;

  const totalFabricantes = new Set(
    catalogo.map((item) => item.fabricante).filter(Boolean)
  ).size;

  const totalOems = new Set(
    catalogo.map((item) => item.codigo_oem).filter(Boolean)
  ).size;
const interpretarConsulta = (texto) => {
  if (!texto) return null;

  const consulta = texto.toLowerCase();

  const anos = consulta.match(/\b(19|20)\d{2}\b/g) || [];

  const motores = consulta.match(/\b\d\.\d\b/g) || [];

  const modelos = [
    "gol",
    "voyage",
    "fox",
    "polo",
    "golf",
    "sandero",
    "logan",
    "duster",
    "clio",
    "kwid",
    "onix",
    "prisma",
    "spin",
    "cobalt",
    "cruze",
    "uno",
    "palio",
    "siena",
    "strada",
    "mobi",
    "argo",
    "toro",
    "hb20",
    "creta",
    "tucson",
    "ix35",
    "civic",
    "fit",
    "city",
    "corolla",
    "etios",
    "hilux",
    "versa",
    "march",
    "sentra",
    "frontier"
  ];

  const modeloEncontrado = modelos.find((m) =>
    consulta.includes(m)
  );

  return {
    modelo: modeloEncontrado || "-",
    ano: anos.join(", ") || "-",
    motor: motores.join(", ") || "-",
  };
};

const resultadoIA = interpretarConsulta(buscaIA);
  const catalogoFiltrado = catalogo.filter((item) => {
   const termo = (buscaIA || busca).toLowerCase();
   const consultaIA = buscaIA
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const palavrasConsulta = consultaIA
  .split(/\s+/)
  .filter((p) => p.length > 1);

    if (!termo) return true;

 const texto = `
${item.montadora ?? ""}
${item.modelo ?? ""}
${item.motor ?? ""}
${item.peca ?? ""}
${item.fabricante ?? ""}
${item.codigo_oem ?? ""}
${item.codigo_equivalente ?? ""}
${item.observacao ?? ""}
${item.ano_inicio ?? ""}
${item.ano_fim ?? ""}
`
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const buscaNormalizada = termo
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

if (!buscaIA) {
  return texto.includes(buscaNormalizada);
}

return palavrasConsulta.every((palavra) =>
  texto.includes(palavra)
);
  });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-white">
        🧠 Base de Conhecimento
      </h1>

      <DashboardCatalogo
        totalPecas={totalPecas}
        totalMontadoras={totalMontadoras}
        totalModelos={totalModelos}
        totalFabricantes={totalFabricantes}
        totalOems={totalOems}
      />

      <ImportadorExcel
        dados={dados}
        colunas={colunas}
        mensagem={mensagem}
        importando={importando}
        importarArquivo={importarArquivo}
        importarParaSupabase={importarParaSupabase}
      />

      <BuscaCatalogo busca={busca} setBusca={setBusca} />
      <div className="bg-white rounded-xl shadow p-6 mt-8">
  <h2 className="text-xl font-bold mb-4">
    🤖 Busca IA por frase
    <p className="text-sm text-gray-500 mt-3">
  A busca interpreta modelo, peça, motor, ano, OEM, equivalente e fabricante.
</p>
  </h2>
  {buscaIA && (
  <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
    <p className="font-semibold text-blue-700">
      🤖 Busca IA ativa
    </p>

    <p className="text-sm text-gray-700 mt-1">
      Consulta: <b>{buscaIA}</b>
    </p>

    <p className="text-sm text-gray-700 mt-1">
      Resultados encontrados: <b>{catalogoFiltrado.length}</b>
    </p>
    {resultadoIA && (
  <div className="mt-4 border-t pt-4">

    <p className="font-semibold text-gray-700 mb-2">
      🧠 A IA identificou:
    </p>

    <p>🚗 Modelo: <b>{resultadoIA.modelo}</b></p>

    <p>⚙️ Motor: <b>{resultadoIA.motor}</b></p>

    <p>📅 Ano: <b>{resultadoIA.ano}</b></p>

  </div>
)}
  </div>
)}

  <input
    type="text"
    placeholder="Ex: Sensor MAP do Logan 1.6 2015 Bosch"
    value={buscaIA}
    onChange={(e) => setBuscaIA(e.target.value)}
    className="w-full border rounded-lg px-4 py-2"
  />

  <p className="text-sm text-gray-500 mt-3">
    A busca interpreta modelo, peça, motor, ano, OEM, equivalente e fabricante.
  </p>
</div>

      <TabelaCatalogo
        catalogoFiltrado={catalogoFiltrado}
        setEditando={setEditando}
        excluirRegistro={excluirRegistro}
      />

      <ModalEditar
        editando={editando}
        setEditando={setEditando}
        salvarEdicao={salvarEdicao}
        salvandoEdicao={salvandoEdicao}
      />
    </div>
  );
}