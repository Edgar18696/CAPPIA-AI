export function criarBannerTextoEngine({
  larguraPreviewExportacao,
  alturaPreviewExportacao,
  elementoSelecionado,
  textosStudio = [],
  editandoTextoId,
  textoAntesEdicao,
  cancelarEdicaoTextoRef,
  setTextosStudio,
  setTextoArrastando,
  setImagemArrastandoId,
  setElementoSelecionado,
  setArrastando,
  setTextoAntesEdicao,
  setEditandoTextoId,
  setTituloStudio,
}) {
  function iniciarRedimensionamentoTexto(
    evento,
    item,
    direcao = "sudeste"
  ) {
    evento.preventDefault();
    evento.stopPropagation();

    setTextoArrastando(null);

    const inicioX =
      evento.clientX;

    const inicioY =
      evento.clientY;

    const tamanhoInicial =
      Number(item.tamanho) || 38;

    const usaHorizontal =
      [
        "leste",
        "oeste",
        "nordeste",
        "noroeste",
        "sudeste",
        "sudoeste",
      ].includes(direcao);

    const usaVertical =
      [
        "norte",
        "sul",
        "nordeste",
        "noroeste",
        "sudeste",
        "sudoeste",
      ].includes(direcao);

    const sinalX =
      [
        "oeste",
        "noroeste",
        "sudoeste",
      ].includes(direcao)
        ? -1
        : 1;

    const sinalY =
      [
        "norte",
        "noroeste",
        "nordeste",
      ].includes(direcao)
        ? -1
        : 1;

    function mover(
      eventoMovimento
    ) {
      const diferencaX =
        (
          eventoMovimento.clientX -
          inicioX
        ) *
        sinalX;

      const diferencaY =
        (
          eventoMovimento.clientY -
          inicioY
        ) *
        sinalY;

      const diferenca =
        usaHorizontal &&
        usaVertical
          ? (
              diferencaX +
              diferencaY
            ) /
            2
          : usaHorizontal
            ? diferencaX
            : diferencaY;

      const novoTamanho =
        tamanhoInicial +
        diferenca / 3;

      setTextosStudio(
        (anteriores) =>
          anteriores.map(
            (texto) =>
              texto.id === item.id
                ? {
                    ...texto,
                    tamanho:
                      Math.min(
                        140,
                        Math.max(
                          12,
                          novoTamanho
                        )
                      ),
                  }
                : texto
          )
      );
    }

    function finalizar() {
      window.removeEventListener(
        "mousemove",
        mover
      );

      window.removeEventListener(
        "mouseup",
        finalizar
      );
    }

    window.addEventListener(
      "mousemove",
      mover
    );

    window.addEventListener(
      "mouseup",
      finalizar
    );
  }

  function iniciarRotacaoTexto(
    evento,
    item
  ) {
    evento.preventDefault();
    evento.stopPropagation();

    setTextoArrastando(null);

    const prancheta =
      document.getElementById(
        "banner-prancheta-exportavel"
      );

    if (!prancheta) {
      return;
    }

    const rect =
      prancheta.getBoundingClientRect();

    const escalaX =
      rect.width /
      larguraPreviewExportacao;

    const escalaY =
      rect.height /
      alturaPreviewExportacao;

    const centroX =
      rect.left +
      (Number(item.x) || 0) *
        escalaX;

    const centroY =
      rect.top +
      (Number(item.y) || 0) *
        escalaY;

    const anguloMouseInicial =
      Math.atan2(
        evento.clientY -
          centroY,
        evento.clientX -
          centroX
      ) *
      (180 / Math.PI);

    const rotacaoInicial =
      Number(item.rotacao) || 0;

    function mover(
      eventoMovimento
    ) {
      const anguloMouseAtual =
        Math.atan2(
          eventoMovimento.clientY -
            centroY,
          eventoMovimento.clientX -
            centroX
        ) *
        (180 / Math.PI);

      let novaRotacao =
        rotacaoInicial +
        (
          anguloMouseAtual -
          anguloMouseInicial
        );

      if (
        eventoMovimento.shiftKey
      ) {
        novaRotacao =
          Math.round(
            novaRotacao / 15
          ) * 15;
      }

      novaRotacao =
        (
          (
            novaRotacao %
            360
          ) +
          360
        ) %
        360;

      setTextosStudio(
        (anteriores) =>
          anteriores.map(
            (texto) =>
              texto.id ===
              item.id
                ? {
                    ...texto,
                    rotacao:
                      novaRotacao,
                  }
                : texto
          )
      );
    }

    function finalizar() {
      window.removeEventListener(
        "mousemove",
        mover
      );

      window.removeEventListener(
        "mouseup",
        finalizar
      );
    }

    window.addEventListener(
      "mousemove",
      mover
    );

    window.addEventListener(
      "mouseup",
      finalizar
    );
  }

  function iniciarEdicaoDiretaTexto(
    evento,
    item
  ) {
    if (item.tipo === "selo") {
      return;
    }

    evento.preventDefault();
    evento.stopPropagation();

    cancelarEdicaoTextoRef.current =
      false;

    setArrastando(false);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setElementoSelecionado(item.id);

    setTextoAntesEdicao(
      String(item.texto || "")
    );

    setEditandoTextoId(
      item.id
    );

    window.setTimeout(() => {
      const editor =
        document.querySelector(
          `[data-editor-texto-id="${item.id}"]`
        );

      editor?.focus();

      const selecao =
        window.getSelection?.();

      if (
        editor &&
        selecao
      ) {
        const faixa =
          document.createRange();

        faixa.selectNodeContents(
          editor
        );

        selecao.removeAllRanges();
        selecao.addRange(faixa);
      }
    }, 0);
  }

  function finalizarEdicaoDiretaTexto(
    evento,
    item
  ) {
    if (
      editandoTextoId !==
      item.id
    ) {
      return;
    }

    const cancelou =
      cancelarEdicaoTextoRef.current;

    const textoDigitado =
      String(
        evento.currentTarget
          .innerText || ""
      ).trim();

    const textoFinal =
      cancelou
        ? textoAntesEdicao
        : textoDigitado ||
          textoAntesEdicao;

    setTextosStudio(
      (anteriores) =>
        anteriores.map(
          (texto) =>
            texto.id === item.id
              ? {
                  ...texto,
                  texto:
                    textoFinal,
                }
              : texto
        )
    );

    setTituloStudio(
      textoFinal
    );

    setEditandoTextoId(null);
    setTextoAntesEdicao("");

    cancelarEdicaoTextoRef.current =
      false;
  }

  function controlarTeclaEdicaoTexto(
    evento
  ) {
    if (
      evento.key === "Escape"
    ) {
      evento.preventDefault();
      evento.stopPropagation();

      cancelarEdicaoTextoRef.current =
        true;

      evento.currentTarget.innerText =
        textoAntesEdicao;

      evento.currentTarget.blur();
      return;
    }

    if (
      evento.key === "Enter" &&
      !evento.shiftKey
    ) {
      evento.preventDefault();
      evento.currentTarget.blur();
    }
  }

  function atualizarTextoSelecionado(
    alteracoes
  ) {
    if (!elementoSelecionado) {
      return;
    }

    const textoExiste =
      textosStudio.some(
        (item) =>
          item.id ===
          elementoSelecionado
      );

    if (!textoExiste) {
      return;
    }

    setTextosStudio(
      (anteriores) =>
        anteriores.map(
          (item) =>
            item.id ===
            elementoSelecionado
              ? {
                  ...item,
                  ...alteracoes,
                }
              : item
        )
    );
  }

  return {
    iniciarRedimensionamentoTexto,
    iniciarRotacaoTexto,
    iniciarEdicaoDiretaTexto,
    finalizarEdicaoDiretaTexto,
    controlarTeclaEdicaoTexto,
    atualizarTextoSelecionado,
  };
}