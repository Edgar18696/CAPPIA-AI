import Projetos from "../Projetos";

export default function ProjetosScreen({
  projetos,
  nomeProjeto,
  setNomeProjeto,
  descricaoProjeto,
  setDescricaoProjeto,
  statusProjeto,
  setStatusProjeto,
  novoStatus,
  setNovoStatus,
  editandoProjeto,
  setEditandoProjeto,
  criarProjeto,
  atualizarProjeto,
  excluirProjeto,
  buscaProjeto,
  setBuscaProjeto,
  cardStyle,
  buttonGreen,
  buttonBlue,
  buttonRed,
  setScreen,
  setAnuncioEditando,
}) {
  return (
    <Projetos
      projetos={projetos}
      nomeProjeto={nomeProjeto}
      setNomeProjeto={setNomeProjeto}
      descricaoProjeto={descricaoProjeto}
      setDescricaoProjeto={setDescricaoProjeto}
      statusProjeto={statusProjeto}
      setStatusProjeto={setStatusProjeto}
      novoStatus={novoStatus}
      setNovoStatus={setNovoStatus}
      editandoProjeto={editandoProjeto}
      setEditandoProjeto={setEditandoProjeto}
      criarProjeto={criarProjeto}
      atualizarProjeto={atualizarProjeto}
      excluirProjeto={excluirProjeto}
      buscaProjeto={buscaProjeto}
      setBuscaProjeto={setBuscaProjeto}
      cardStyle={cardStyle}
      buttonGreen={buttonGreen}
      buttonBlue={buttonBlue}
      buttonRed={buttonRed}
      setScreen={setScreen}
      setAnuncioEditando={setAnuncioEditando}
    />
  );
}