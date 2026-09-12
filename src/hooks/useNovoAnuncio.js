import { useEffect } from "react";
import {
  criarAnuncioVazio,
  carregarAnuncioTemporario,
  limparAnuncioTemporario,
} from "../services/anunciosService";
import {
  consumirNovaCriacaoMidia,
  deveIniciarNovaCriacaoMidia,
} from "../services/limparEstadoTemporarioMidia";

export default function useNovoAnuncio({
  anuncioEditando,
  fotosAnuncio,
  setFotosAnuncio,

  codigo,
  setCodigo,

  oem,
  setOem,

  titulo,
  setTitulo,

  descricao,
  setDescricao,

  preco,
  setPreco,

  tipoAnuncio,
  setTipoAnuncio,

  pecaEncontrada,
  setPecaEncontrada,

  diagnostico,
  setDiagnostico,

  auditoria,
  setAuditoria,
}) {
  const fotosSeguras =
    Array.isArray(fotosAnuncio)
      ? fotosAnuncio
      : [];

  const podeAtualizarFotos =
    typeof setFotosAnuncio ===
    "function";

  useEffect(() => {
    if (anuncioEditando) {
      setCodigo(
        anuncioEditando.codigo || ""
      );

      setOem(
        anuncioEditando.oem || ""
      );

      setTitulo(
        anuncioEditando.titulo || ""
      );

      setDescricao(
        anuncioEditando.descricao || ""
      );

      setPreco(
        anuncioEditando.preco || ""
      );

      setTipoAnuncio(
        anuncioEditando.tipoAnuncio ||
          "classico"
      );

      setPecaEncontrada(
        anuncioEditando.pecaEncontrada ||
          null
      );

      setDiagnostico(
        anuncioEditando.diagnostico ||
          null
      );

      setAuditoria(
        anuncioEditando.auditoria ||
          null
      );

      if (podeAtualizarFotos) {
        setFotosAnuncio(
          Array.isArray(
            anuncioEditando.fotos
          )
            ? anuncioEditando.fotos
            : []
        );
      }

      return;
    }

    if (deveIniciarNovaCriacaoMidia()) {
      consumirNovaCriacaoMidia();

      const vazio = criarAnuncioVazio() || {};

      setCodigo(vazio.codigo || "");
      setOem(vazio.oem || "");
      setTitulo(vazio.titulo || "");
      setDescricao(vazio.descricao || "");
      setPreco(vazio.preco || "");
      setTipoAnuncio(vazio.tipoAnuncio || "classico");
      setPecaEncontrada(null);
      setDiagnostico(null);
      setAuditoria(null);

      if (podeAtualizarFotos) {
        setFotosAnuncio([]);
      }

      return;
    }

    const anuncioTemporario =
      localStorage.getItem(
        "novoAnuncioTemporario"
      );

    if (anuncioTemporario) {
      try {
        const anuncio =
          JSON.parse(
            anuncioTemporario
          );

        setCodigo(
          anuncio.codigo || ""
        );

        setOem(
          anuncio.oem || ""
        );

        setTitulo(
          anuncio.titulo || ""
        );

        setDescricao(
          anuncio.descricao || ""
        );

        setPreco(
          anuncio.preco || ""
        );

        setTipoAnuncio(
          anuncio.tipoAnuncio ||
            "classico"
        );

        setPecaEncontrada(
          anuncio.pecaEncontrada ||
            null
        );

        setDiagnostico(
          anuncio.diagnostico ||
            null
        );

        setAuditoria(
          anuncio.auditoria ||
            null
        );

        if (
          podeAtualizarFotos &&
          Array.isArray(
            anuncio.fotos
          )
        ) {
          setFotosAnuncio(
            anuncio.fotos
          );
        }

        return;
      } catch (erro) {
        console.error(
          "Erro ao recuperar anúncio temporário:",
          erro
        );
      }
    }

    const veioCatalogo =
      localStorage.getItem(
        "usarDadosCatalogoNoAnuncio"
      ) === "true";

    if (veioCatalogo) {
      const anuncio =
        carregarAnuncioTemporario() ||
        criarAnuncioVazio() ||
        {};

      setCodigo(
        anuncio.codigo || ""
      );

      setOem(
        anuncio.oem || ""
      );

      setTitulo(
        anuncio.titulo || ""
      );

      setDescricao(
        anuncio.descricao || ""
      );

      setPreco(
        anuncio.preco || ""
      );

      setTipoAnuncio(
        anuncio.tipoAnuncio ||
          "classico"
      );

      setPecaEncontrada(
        anuncio.pecaEncontrada ||
          null
      );

      setDiagnostico(
        anuncio.diagnostico ||
          null
      );

      setAuditoria(
        anuncio.auditoria ||
          null
      );

      if (podeAtualizarFotos) {
        setFotosAnuncio(
          Array.isArray(
            anuncio.fotos
          )
            ? anuncio.fotos
            : []
        );
      }

      limparAnuncioTemporario();

      return;
    }

    const vazio =
      criarAnuncioVazio() || {};

    setCodigo(
      vazio.codigo || ""
    );

    setOem(
      vazio.oem || ""
    );

    setTitulo(
      vazio.titulo || ""
    );

    setDescricao(
      vazio.descricao || ""
    );

    setPreco(
      vazio.preco || ""
    );

    setTipoAnuncio(
      vazio.tipoAnuncio ||
        "classico"
    );

    setPecaEncontrada(
      vazio.pecaEncontrada ||
        null
    );

    setDiagnostico(
      vazio.diagnostico ||
        null
    );

    setAuditoria(
      vazio.auditoria ||
        null
    );

    if (podeAtualizarFotos) {
      setFotosAnuncio(
        (fotosAtuais) =>
          Array.isArray(
            fotosAtuais
          )
            ? fotosAtuais
            : []
      );
    }
  }, [
    anuncioEditando,
    podeAtualizarFotos,
    setAuditoria,
    setCodigo,
    setDescricao,
    setDiagnostico,
    setFotosAnuncio,
    setOem,
    setPecaEncontrada,
    setPreco,
    setTipoAnuncio,
    setTitulo,
  ]);

  useEffect(() => {
    if (anuncioEditando) {
      return;
    }

    const temConteudo =
      Boolean(
        codigo ||
          oem ||
          titulo ||
          descricao ||
          preco ||
          fotosSeguras.length
      );

    if (!temConteudo) {
      return;
    }

    localStorage.setItem(
      "rascunhoNovoAnuncioTemp",
      JSON.stringify({
        codigo,
        oem,
        titulo,
        descricao,
        preco,
        tipoAnuncio,
        pecaEncontrada,
        diagnostico,
        auditoria,
        fotos: fotosSeguras,
      })
    );
  }, [
    codigo,
    oem,
    titulo,
    descricao,
    preco,
    tipoAnuncio,
    pecaEncontrada,
    diagnostico,
    auditoria,
    fotosSeguras,
    anuncioEditando,
  ]);
}