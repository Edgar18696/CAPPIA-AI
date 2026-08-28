export function criarBannerImagemEngine({
  larguraPreviewExportacao,
  alturaPreviewExportacao,
  imagensBanner = [],
  textosStudio = [],
  snapNaGrade,
  tamanhoGrade,
  setImagensBanner,
  setImagemArrastandoId,
}) {
  function iniciarRedimensionamentoImagem(
    evento,
    imagem,
    direcao = "sudeste"
  ) {
    evento.preventDefault();
    evento.stopPropagation();

    setImagemArrastandoId(null);

    const prancheta =
      document.getElementById(
        "banner-prancheta-exportavel"
      );

    if (!prancheta) {
      return;
    }

    const rect =
      prancheta.getBoundingClientRect();

    const escalaVisualX =
      rect.width /
      larguraPreviewExportacao;

    const escalaVisualY =
      rect.height /
      alturaPreviewExportacao;

    const fatorX =
      Math.max(
        0.01,
        escalaVisualX
      );

    const fatorY =
      Math.max(
        0.01,
        escalaVisualY
      );

    const inicioX =
      evento.clientX;

    const inicioY =
      evento.clientY;

    const escalaInicial =
      Number(imagem.escala) || 1;

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

    const larguraBase =
      imagem.tipo === "logo"
        ? 240
        : imagem.tipo === "objeto"
          ? 280
          : imagem.tipo === "icone"
            ? 190
            : 320;

    const alturaBase =
      imagem.tipo === "logo"
        ? 130
        : imagem.tipo === "objeto"
          ? 220
          : imagem.tipo === "icone"
            ? 190
            : 420;

    function mover(
      eventoMovimento
    ) {
      eventoMovimento.preventDefault();

      const diferencaX =
        (
          eventoMovimento.clientX -
          inicioX
        ) /
        fatorX *
        sinalX;

      const diferencaY =
        (
          eventoMovimento.clientY -
          inicioY
        ) /
        fatorY *
        sinalY;

      let variacaoEscala = 0;

      if (
        usaHorizontal &&
        usaVertical
      ) {
        const variacaoX =
          diferencaX /
          larguraBase;

        const variacaoY =
          diferencaY /
          alturaBase;

        variacaoEscala =
          (
            variacaoX +
            variacaoY
          ) /
          2;
      } else if (
        usaHorizontal
      ) {
        variacaoEscala =
          diferencaX /
          larguraBase;
      } else if (
        usaVertical
      ) {
        variacaoEscala =
          diferencaY /
          alturaBase;
      }

      let novaEscala =
        escalaInicial +
        variacaoEscala;

      if (
        eventoMovimento.shiftKey
      ) {
        novaEscala =
          Math.round(
            novaEscala * 10
          ) /
          10;
      }

      novaEscala =
        Math.min(
          4,
          Math.max(
            0.15,
            novaEscala
          )
        );

      setImagensBanner(
        (anteriores) =>
          anteriores.map(
            (item) =>
              item.id ===
              imagem.id
                ? {
                    ...item,
                    escala:
                      novaEscala,
                  }
                : item
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

  function iniciarRotacaoImagem(
    evento,
    imagem
  ) {
    evento.preventDefault();
    evento.stopPropagation();

    setImagemArrastandoId(null);

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
      (Number(imagem.x) || 0) *
        escalaX;

    const centroY =
      rect.top +
      (Number(imagem.y) || 0) *
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
      Number(imagem.rotacao) || 0;

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

      setImagensBanner(
        (anteriores) =>
          anteriores.map(
            (item) =>
              item.id ===
              imagem.id
                ? {
                    ...item,
                    rotacao:
                      novaRotacao,
                  }
                : item
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

  function calcularSnapElemento({
    x,
    y,
    larguraCanvas,
    alturaCanvas,
    ignorarId = null,
  }) {
    const limite = 12;
    const margem = 40;

    const alvosX = [
      margem,
      larguraCanvas / 2,
      larguraCanvas - margem,
    ];

    const alvosY = [
      margem,
      alturaCanvas / 2,
      alturaCanvas - margem,
    ];

    imagensBanner.forEach(
      (imagem) => {
        if (
          imagem.id !==
          ignorarId
        ) {
          alvosX.push(
            Number(imagem.x) ||
              larguraCanvas / 2
          );

          alvosY.push(
            Number(imagem.y) ||
              alturaCanvas / 2
          );
        }
      }
    );

    textosStudio.forEach(
      (texto) => {
        if (
          texto.id !==
          ignorarId
        ) {
          alvosX.push(
            Number(texto.x) ||
              larguraCanvas / 2
          );

          alvosY.push(
            Number(texto.y) ||
              alturaCanvas / 2
          );
        }
      }
    );

    let xFinal = x;
    let yFinal = y;
    let guiaX = null;
    let guiaY = null;

    const alvoX =
      alvosX.find(
        (valor) =>
          Math.abs(
            x - valor
          ) <= limite
      );

    const alvoY =
      alvosY.find(
        (valor) =>
          Math.abs(
            y - valor
          ) <= limite
      );

    if (
      alvoX !== undefined
    ) {
      xFinal = alvoX;
      guiaX = alvoX;
    }

    if (
      alvoY !== undefined
    ) {
      yFinal = alvoY;
      guiaY = alvoY;
    }

    if (snapNaGrade) {
      const grade =
        Math.max(
          1,
          Number(
            tamanhoGrade
          ) || 20
        );

      xFinal =
        Math.round(
          xFinal / grade
        ) * grade;

      yFinal =
        Math.round(
          yFinal / grade
        ) * grade;
    }

    return {
      x: Math.min(
        larguraCanvas -
          margem,
        Math.max(
          margem,
          xFinal
        )
      ),
      y: Math.min(
        alturaCanvas -
          margem,
        Math.max(
          margem,
          yFinal
        )
      ),
      guiaX,
      guiaY,
    };
  }

  return {
    iniciarRedimensionamentoImagem,
    iniciarRotacaoImagem,
    calcularSnapElemento,
  };
}