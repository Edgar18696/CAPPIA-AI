import { memo } from "react";

import ToolbarTexto from "./ToolbarTexto";
import BannerCanvasGuias from "./BannerCanvasGuias";

function BannerCanvas({ contexto }) {
  const {
    zoomCanvas,
    calcularSnapElemento,
    imagemArrastandoId,
    textoArrastando,
    arrastando,
    setPosicaoProduto,
    setTextosStudio,
    setImagensBanner,
    setMostrarGuiaVertical,
    setMostrarGuiaHorizontal,
    setArrastando,
    setTextoArrastando,
    setImagemArrastandoId,
    setElementoSelecionado,
    imagemSelecionadaId,
    setImagemSelecionadaId,
    larguraPreviewExportacao,
    formatoSelecionadoExportacao,
    fundoTransparenteExportacao,
    tipoExportacao,
    fundoStudio,
    mostrarGrade,
    tamanhoGrade,
    mostrarAreaSegura,
    mostrarGuiaVertical,
    mostrarGuiaHorizontal,
    textoSelecionado,
    atualizarTextoSelecionado,
    duplicarElementoSelecionado,
    excluirTextoSelecionado,
    imagensBanner,
    camadasStudio,
    setCamadasStudio,
    elementoSelecionado,
    obterFiltroEfeitoRapido,
    iniciarRedimensionamentoImagem,
    iniciarRotacaoImagem,
    textosStudio,
    editandoTextoId,
    iniciarEdicaoDiretaTexto,
    finalizarEdicaoDiretaTexto,
    controlarTeclaEdicaoTexto,
    setTituloStudio,
    setCorTituloStudio,
    setTamanhoTituloStudio,
    iniciarRedimensionamentoTexto,
    iniciarRotacaoTexto,
    setScreen,
  } = contexto;

  return (
<div
  id="banner-prancheta-exportavel"
  data-area-exportavel="banner"
  onMouseDown={(evento) => {
    const clicouEmElemento =
      evento.target.closest(
        '[data-elemento-banner="true"]'
      );

    if (!clicouEmElemento) {
      setElementoSelecionado(null);
      setImagemSelecionadaId(null);
      setTextoArrastando(null);
      setImagemArrastandoId(null);
      setArrastando(false);
    }
  }}
  onMouseMove={(evento) => {
    const rect =
      evento.currentTarget.getBoundingClientRect();

    const fatorZoom =
      Math.max(0.25, zoomCanvas / 100);

    const x =
      (evento.clientX - rect.left) /
      fatorZoom;

    const y =
      (evento.clientY - rect.top) /
      fatorZoom;

    const elementoMovendoId =
      imagemArrastandoId ??
      textoArrastando;

    const snap =
      calcularSnapElemento({
        x,
        y,
        larguraCanvas:
          rect.width / fatorZoom,
        alturaCanvas:
          rect.height / fatorZoom,
        ignorarId:
          elementoMovendoId,
      });

    if (arrastando) {
      setPosicaoProduto({
        x: snap.x,
        y: snap.y,
      });
    }

    if (
      textoArrastando !== null
    ) {
      setTextosStudio(
        (anteriores) =>
          anteriores.map(
            (texto) =>
              texto.id ===
              textoArrastando
                ? {
                    ...texto,
                    x: snap.x,
                    y: snap.y,
                  }
                : texto
          )
      );
    }

    if (
      imagemArrastandoId !==
      null
    ) {
      setImagensBanner(
        (anteriores) =>
          anteriores.map(
            (imagem) =>
              imagem.id ===
              imagemArrastandoId
                ? {
                    ...imagem,
                    x: snap.x,
                    y: snap.y,
                  }
                : imagem
          )
      );
    }

    const movendoElemento =
      arrastando ||
      textoArrastando !== null ||
      imagemArrastandoId !== null;

    setMostrarGuiaVertical(
      movendoElemento
        ? snap.guiaX
        : null
    );

    setMostrarGuiaHorizontal(
      movendoElemento
        ? snap.guiaY
        : null
    );
  }}
  onMouseUp={() => {
    setArrastando(false);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);
  }}
  onMouseLeave={() => {
    setArrastando(false);
    setTextoArrastando(null);
    setImagemArrastandoId(null);
    setMostrarGuiaVertical(null);
    setMostrarGuiaHorizontal(null);
  }}
  style={{
    width: "100%",
    maxWidth:
      `${larguraPreviewExportacao}px`,

    aspectRatio:
      `${formatoSelecionadoExportacao.largura} / ${formatoSelecionadoExportacao.altura}`,

    height: "auto",
    margin: "0 auto",

    background:
      fundoTransparenteExportacao &&
      tipoExportacao === "png"
        ? "transparent"
        : fundoStudio,

    border:
      "2px dashed #334155",

    borderRadius: "16px",
    position: "relative",
    flexShrink: 0,
    overflow: "hidden",

    boxShadow:
      "0 10px 30px rgba(0,0,0,.30)",
  }}
>
 
    <BannerCanvasGuias
      mostrarGrade={mostrarGrade}
      tamanhoGrade={tamanhoGrade}
      mostrarAreaSegura={mostrarAreaSegura}
      mostrarGuiaVertical={mostrarGuiaVertical}
      mostrarGuiaHorizontal={mostrarGuiaHorizontal}
    />

    {textoSelecionado && (
      <div data-nao-exportar="true">
        <ToolbarTexto
          texto={textoSelecionado}
          onAtualizar={atualizarTextoSelecionado}
          onDuplicar={duplicarElementoSelecionado}
          onExcluir={excluirTextoSelecionado}
        />
      </div>
    )}

    {imagensBanner
  .filter((imagem) => {
    const camada = camadasStudio.find(
      (item) => item.id === imagem.id
    );

    return camada?.visivel !== false;
  })
  .map((imagem) => (
  <div
    key={imagem.id}
    data-elemento-banner="true"
    onMouseDown={(evento) => {
  const camadaImagem = camadasStudio.find(
    (camada) => camada.id === imagem.id
  );

  if (
    evento.button !== 0 ||
    camadaImagem?.bloqueado
  ) {
    return;
  }

  evento.preventDefault();
  evento.stopPropagation();

  setArrastando(false);
  setTextoArrastando(null);

  setImagemSelecionadaId(
    imagem.id
  );

  setElementoSelecionado(
    imagem.id
  );

  setCamadasStudio((anteriores) => {
  const atual =
    anteriores.find(
      (camada) =>
        camada.id === imagem.id
    );

  return [
    ...anteriores.filter(
      (camada) =>
        camada.id !== imagem.id
    ),
    atual,
  ].filter(Boolean);
});

  setImagemArrastandoId(
    imagem.id
  );
}}
    style={{
      position: "absolute",

      left: imagem.x ?? 450,
      top: imagem.y ?? 300,

      width:
        imagem.tipo === "logo"
          ? "240px"
          : imagem.tipo ===
              "objeto"
            ? "280px"
            : imagem.tipo ===
                "icone"
              ? "190px"
              : "320px",
      height:
        imagem.tipo === "logo"
          ? "130px"
          : imagem.tipo ===
              "objeto"
            ? "220px"
            : imagem.tipo ===
                "icone"
              ? "190px"
              : "420px",

      transform: `
        translate(-50%, -50%)
        rotate(${imagem.rotacao || 0}deg)
        scale(${Number(imagem.escala) || 1})
      `,

      transformOrigin: "center",

      display: "flex",
      alignItems: "center",
      justifyContent: "center",

      cursor: camadasStudio.find(
        (camada) => camada.id === imagem.id
      )?.bloqueado
        ? "not-allowed"
        : "grab",
      userSelect: "none",

      zIndex:
        camadasStudio.findIndex(
          (camada) =>
            camada.id === imagem.id
        ) + 1,

      outline:
        elementoSelecionado ===
        imagem.id
          ? "2px solid #22d3ee"
          : "none",

      outlineOffset: "4px",
    }}
  >
    <img
      src={imagem.src}
      alt={
        imagem.tipo === "logo"
          ? "Logo"
          : imagem.tipo ===
              "objeto"
            ? imagem.nome ||
              "Objeto"
            : imagem.tipo ===
                "icone"
              ? imagem.nome ||
                "Ícone"
              : "Produto"
      }
      draggable={false}
      onDragStart={(evento) => evento.preventDefault()}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
        filter:
          obterFiltroEfeitoRapido(imagem),
      }}
    />

    {elementoSelecionado ===
      imagem.id && (
      <>
        {[
          {
            chave: "noroeste",
            left: "-8px",
            top: "-8px",
            cursor: "nwse-resize",
          },
          {
            chave: "norte",
            left: "50%",
            top: "-8px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
          {
            chave: "nordeste",
            right: "-8px",
            top: "-8px",
            cursor: "nesw-resize",
          },
          {
            chave: "oeste",
            left: "-8px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "leste",
            right: "-8px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "sudoeste",
            left: "-8px",
            bottom: "-8px",
            cursor: "nesw-resize",
          },
          {
            chave: "sul",
            left: "50%",
            bottom: "-8px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
        ].map((alca) => (
          <button
            key={alca.chave}
            type="button"
            data-nao-exportar="true"
            title={`Redimensionar ${alca.chave}`}
            onMouseDown={(evento) =>
              iniciarRedimensionamentoImagem(
                evento,
                imagem,
                alca.chave
              )
            }
            style={{
              position: "absolute",
              left: alca.left,
              right: alca.right,
              top: alca.top,
              bottom: alca.bottom,
              transform:
                alca.transform,
              width: "13px",
              height: "13px",
              boxSizing:
                "border-box",
              border:
                "2px solid #ffffff",
              borderRadius:
                "3px",
              background:
                "#22d3ee",
              boxShadow:
                "0 2px 7px rgba(0,0,0,.45)",
              cursor:
                alca.cursor,
              pointerEvents:
                "auto",
              padding: 0,
              zIndex: 52,
            }}
          />
        ))}

        <button
          type="button"
          data-nao-exportar="true"
          title="Redimensionar"
          onMouseDown={(evento) =>
            iniciarRedimensionamentoImagem(
              evento,
              imagem,
              "sudeste"
            )
          }
          style={{
            position: "absolute",
            right: "-8px",
            bottom: "-8px",
            width: "16px",
            height: "16px",
            padding: 0,
            boxSizing:
              "border-box",
            borderRadius: "3px",
            border:
              "2px solid #ffffff",
            background:
              "#22d3ee",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor:
              "nwse-resize",
            zIndex: 54,
          }}
        />

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            top: "-45px",
            left: "50%",
            width: "2px",
            height: "36px",
            background: "#22c55e",
            transform:
              "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 49,
          }}
        />

        <button
          type="button"
          data-nao-exportar="true"
          title="Rotacionar"
          onMouseDown={(evento) => {
            evento.preventDefault();
            evento.stopPropagation();
            setImagemArrastandoId(null);
            iniciarRotacaoImagem(
              evento,
              imagem
            );
          }}
          style={{
            position: "absolute",
            top: "-61px",
            left: "50%",
            transform:
              "translateX(-50%)",
            width: "26px",
            height: "26px",
            padding: 0,
            borderRadius: "50%",
            border:
              "3px solid #ffffff",
            background: "#22c55e",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor: "grab",
            zIndex: 54,
          }}
        >
          <span
            style={{
              display: "block",
              color: "#ffffff",
              fontSize: "13px",
              lineHeight: 1,
              pointerEvents:
                "none",
            }}
          >
            ↻
          </span>
        </button>

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-42px",
            transform:
              "translateX(-50%)",
            padding: "5px 8px",
            borderRadius: "7px",
            background:
              "rgba(2,6,23,.94)",
            border:
              "1px solid #22d3ee",
            color: "#e0f2fe",
            fontSize: "10px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow:
              "0 5px 14px rgba(0,0,0,.34)",
            zIndex: 55,
          }}
        >
          X: {Math.round(
            Number(imagem.x) || 0
          )} · Y: {Math.round(
            Number(imagem.y) || 0
          )}
          {" · "}
          L: {Math.round(
            (
              imagem.tipo === "logo"
                ? 240
                : imagem.tipo ===
                    "objeto"
                  ? 280
                  : imagem.tipo ===
                      "icone"
                    ? 190
                    : 320
            ) *
              (
                Number(
                  imagem.escala
                ) || 1
              )
          )}
          {" · "}
          A: {Math.round(
            (
              imagem.tipo === "logo"
                ? 130
                : imagem.tipo ===
                    "objeto"
                  ? 220
                  : imagem.tipo ===
                      "icone"
                    ? 190
                    : 420
            ) *
              (
                Number(
                  imagem.escala
                ) || 1
              )
          )}
          {" · "}
          ↻ {Math.round(
            Number(
              imagem.rotacao
            ) || 0
          )}°
        </div>
      </>
    )}
  </div>
))}

    {imagensBanner.length === 0 &&
  textosStudio.length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            color: "#64748b",
            fontWeight: "bold",
            fontSize: "18px",
          }}
        >
          <span>
            Selecione uma imagem na Galeria
          </span>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem(
                "modoGaleria",
                "selecionarParaBanner"
              );
              setScreen("galeria");
            }}
            style={{
              background:
                "linear-gradient(135deg,#2563eb,#22d3ee)",
              color: "#ffffff",
              border: "none",
              padding: "12px 22px",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            🖼️ Abrir Galeria
          </button>
        </div>
      )}
{textosStudio
  .filter((item) => {
    const camada = camadasStudio.find(
      (camadaAtual) => camadaAtual.id === item.id
    );

    return camada?.visivel !== false;
  })
  .map((item) => (
  <div
    key={item.id}
    data-elemento-banner="true"
    onMouseDown={(evento) => {
      const camadaTexto = camadasStudio.find(
        (camada) => camada.id === item.id
      );

      if (camadaTexto?.bloqueado) {
        return;
      }

      if (editandoTextoId === item.id) {
        evento.stopPropagation();
        return;
      }

      evento.preventDefault();
      evento.stopPropagation();

      setArrastando(false);
      setTextoArrastando(item.id);
      setElementoSelecionado(item.id);

      setTituloStudio(
        item.texto || ""
      );

      setCorTituloStudio(
        item.cor || "#ffffff"
      );

      setTamanhoTituloStudio(
        Number(item.tamanho) || 38
      );
    }}
    onDoubleClick={(evento) =>
      iniciarEdicaoDiretaTexto(
        evento,
        item
      )
    }
    style={{
      position: "absolute",
      left: item.x ?? 450,
      top: item.y ?? 120,

      transform: `
        translate(-50%, -50%)
        rotate(${item.rotacao || 0}deg)
      `,

      color:
        item.cor || "#ffffff",

      fontSize: `${
        Number(item.tamanho) || 38
      }px`,

      fontWeight:
        item.negrito === false
          ? "normal"
          : "bold",

      fontStyle:
        item.italico
          ? "italic"
          : "normal",

      textDecoration:
        item.sublinhado
          ? "underline"
          : "none",

      fontFamily:
        item.fonte ||
        "Arial, Helvetica, sans-serif",

      textAlign:
        item.alinhamento || "center",

      textShadow:
        item.sombra === false
          ? "none"
          : "0 2px 8px rgba(0,0,0,.65)",

      cursor: camadasStudio.find(
        (camada) => camada.id === item.id
      )?.bloqueado
        ? "not-allowed"
        : "grab",
      userSelect: "none",
      width:
        item.larguraMaxima
          ? `${item.larguraMaxima}px`
          : "auto",
      maxWidth:
        item.larguraMaxima
          ? `${item.larguraMaxima}px`
          : "none",
      whiteSpace:
        item.quebrarLinha
          ? "normal"
          : "nowrap",
      lineHeight:
        item.quebrarLinha
          ? 1.08
          : "normal",
      overflowWrap: "break-word",
      boxSizing: "border-box",

      padding:
        item.tipo === "selo"
          ? "12px 18px"
          : "4px 8px",

      borderRadius:
        item.tipo === "selo"
          ? item.formatoSelo ===
            "escudo"
            ? "18px 18px 34px 34px"
            : item.formatoSelo ===
                "impacto"
              ? "9px"
              : item.formatoSelo ===
                  "faixa"
                ? "5px"
                : item.formatoSelo ===
                    "premium"
                  ? "14px"
                  : "999px"
          : "0",

      background:
        item.tipo === "selo"
          ? item.fundo ||
            "#2563eb"
          : "transparent",

      border:
        item.tipo === "selo"
          ? `3px solid ${
              item.bordaSelo ||
              "rgba(255,255,255,.88)"
            }`
          : "none",

      boxShadow:
        item.tipo === "selo"
          ? item.formatoSelo ===
            "impacto"
            ? "0 12px 28px rgba(127,29,29,.48), inset 0 0 0 2px rgba(255,255,255,.12)"
            : item.formatoSelo ===
                "premium"
              ? "0 12px 28px rgba(0,0,0,.38), inset 0 0 18px rgba(255,255,255,.16)"
              : "0 10px 24px rgba(0,0,0,.32)"
          : "none",

      zIndex:
        camadasStudio.findIndex(
          (camada) =>
            camada.id === item.id
        ) + 2,

      outline:
        elementoSelecionado ===
        item.id
          ? "2px dashed #22d3ee"
          : "none",

      outlineOffset: "4px",
    }}
  >
    <div
      data-editor-texto-id={item.id}
      contentEditable={
        editandoTextoId === item.id
      }
      suppressContentEditableWarning
      spellCheck={false}
      onMouseDown={(evento) => {
        if (editandoTextoId === item.id) {
          evento.stopPropagation();
        }
      }}
      onBlur={(evento) =>
        finalizarEdicaoDiretaTexto(
          evento,
          item
        )
      }
      onKeyDown={
        controlarTeclaEdicaoTexto
      }
      style={{
        outline:
          editandoTextoId === item.id
            ? "2px solid #facc15"
            : "none",
        outlineOffset: "5px",
        borderRadius: "4px",
        cursor:
          editandoTextoId === item.id
            ? "text"
            : "inherit",
        minWidth:
          editandoTextoId === item.id
            ? "45px"
            : "auto",
        padding:
          editandoTextoId === item.id
            ? "2px 5px"
            : 0,
      }}
      title="Duplo clique para editar"
    >
      {item.texto}
    </div>

    {elementoSelecionado ===
      item.id &&
      editandoTextoId !== item.id && (
      <>
        {[
          {
            chave: "noroeste",
            left: "-10px",
            top: "-10px",
            cursor: "nwse-resize",
          },
          {
            chave: "norte",
            left: "50%",
            top: "-10px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
          {
            chave: "nordeste",
            right: "-10px",
            top: "-10px",
            cursor: "nesw-resize",
          },
          {
            chave: "oeste",
            left: "-10px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "leste",
            right: "-10px",
            top: "50%",
            transform:
              "translateY(-50%)",
            cursor: "ew-resize",
          },
          {
            chave: "sudoeste",
            left: "-10px",
            bottom: "-10px",
            cursor: "nesw-resize",
          },
          {
            chave: "sul",
            left: "50%",
            bottom: "-10px",
            transform:
              "translateX(-50%)",
            cursor: "ns-resize",
          },
        ].map((alca) => (
          <button
            key={alca.chave}
            type="button"
            data-nao-exportar="true"
            title={`Redimensionar ${alca.chave}`}
            onMouseDown={(evento) =>
              iniciarRedimensionamentoTexto(
                evento,
                item,
                alca.chave
              )
            }
            style={{
              position: "absolute",
              left: alca.left,
              right: alca.right,
              top: alca.top,
              bottom: alca.bottom,
              transform:
                alca.transform,
              width: "13px",
              height: "13px",
              boxSizing:
                "border-box",
              border:
                "2px solid #ffffff",
              borderRadius: "3px",
              background:
                "#22d3ee",
              boxShadow:
                "0 2px 7px rgba(0,0,0,.45)",
              cursor:
                alca.cursor,
              pointerEvents:
                "auto",
              padding: 0,
              zIndex: 52,
            }}
          />
        ))}

        <button
          type="button"
          data-nao-exportar="true"
          title="Redimensionar texto"
          onMouseDown={(evento) =>
            iniciarRedimensionamentoTexto(
              evento,
              item,
              "sudeste"
            )
          }
          style={{
            position: "absolute",
            right: "-10px",
            bottom: "-10px",
            width: "17px",
            height: "17px",
            padding: 0,
            boxSizing:
              "border-box",
            borderRadius: "3px",
            border:
              "2px solid #ffffff",
            background: "#22d3ee",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor:
              "nwse-resize",
            zIndex: 54,
          }}
        />

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            top: "-43px",
            left: "50%",
            width: "2px",
            height: "34px",
            background: "#22c55e",
            transform:
              "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 49,
          }}
        />

        <button
          type="button"
          data-nao-exportar="true"
          title="Rotacionar texto"
          onMouseDown={(evento) =>
            iniciarRotacaoTexto(
              evento,
              item
            )
          }
          style={{
            position: "absolute",
            top: "-59px",
            left: "50%",
            transform:
              "translateX(-50%)",
            width: "25px",
            height: "25px",
            padding: 0,
            borderRadius: "50%",
            border:
              "3px solid #ffffff",
            background: "#22c55e",
            boxShadow:
              "0 2px 8px rgba(0,0,0,.45)",
            cursor: "grab",
            zIndex: 54,
          }}
        >
          <span
            style={{
              display: "block",
              color: "#ffffff",
              fontSize: "13px",
              lineHeight: 1,
              pointerEvents:
                "none",
            }}
          >
            ↻
          </span>
        </button>

        <div
          data-nao-exportar="true"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "-44px",
            transform:
              "translateX(-50%)",
            padding: "5px 8px",
            borderRadius: "7px",
            background:
              "rgba(2,6,23,.94)",
            border:
              "1px solid #22d3ee",
            color: "#e0f2fe",
            fontSize: "10px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow:
              "0 5px 14px rgba(0,0,0,.34)",
            zIndex: 55,
          }}
        >
          X: {Math.round(
            Number(item.x) || 0
          )} · Y: {Math.round(
            Number(item.y) || 0
          )}
          {" · "}
          Fonte: {Math.round(
            Number(item.tamanho) ||
              38
          )} px
          {" · "}
          ↻ {Math.round(
            Number(item.rotacao) ||
              0
          )}°
        </div>
      </>
    )}
  </div>
))}
  </div>
  );
}

export default memo(BannerCanvas);