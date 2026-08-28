import { useMemo, useState } from "react";
import { supabase } from "../supabase";

const CATEGORIAS_SITE = [
  {
    principal: "Emissões",
    subcategorias: [],
  },
  {
    principal: "Ar Condicionado",
    subcategorias: [
      "Abraçadeira",
      "Comando do Ar",
      "Compressor",
      "Condensador",
      "Difusor de ar",
      "Eletroventilador",
      "Evaporador",
      "Filtro",
      "Filtro de ar",
      "Mangueiras",
      "Motor Atuador",
      "Pressostato",
      "Radiador",
      "Resistencia",
      "Termostato",
      "Valvula Expansão",
      "Ventoinha",
    ],
  },
  {
    principal: "Carroceria",
    subcategorias: [
      "Arruela",
      "Assoalho",
      "Batente",
      "Borracha",
      "Cabos",
      "Capo",
      "Coluna",
      "Dobradiças",
      "Fechadura",
      "Frisos",
      "Grades",
      "Haste",
      "Lateral",
      "Limitador Porta",
      "Mangueira Tanque",
      "Olho de Gato",
      "Painel Frontal",
      "Parabarros",
      "Parachoque",
      "Parafusos",
      "Paralamas",
      "Porta Dianteira",
      "Porta Mala",
      "Porta Traseira",
      "Portas",
      "Presilhas",
      "Rebite",
      "Spoiler",
      "Suporte",
      "Tampa Combustivel",
      "Tampa de vedação",
      "Tampa Porta Mala",
      "Teto",
      "Travessa",
    ],
  },
  {
    principal: "Elétrica",
    subcategorias: [
      "Acendedor Cigarros",
      "Alarmes",
      "Alternadores",
      "Antena",
      "Baterias",
      "Bobina de Ignição",
      "Bomba Combustibel",
      "Bomba Eletrica Limpador",
      "Bomba Vacuo",
      "Botão Vidro Eletrico",
      "Botões",
      "Buzina",
      "Cabos de Vela",
      "Caixa de Fusivel",
      "Chave de Seta",
      "Chave Limpador",
      "Chicotes",
      "Circuito",
      "Comutadores",
      "Conector",
      "Distribuidores",
      "Esguicho do Farol",
      "Fusiveis",
      "Interruptor de Porta",
      "Lampadas",
      "Maquina de Vidro Eletrica",
      "Modulos",
      "Motor de Arranque",
      "Motor do Limpador",
      "Motor Ventoinha",
      "Porta Escova",
      "Regulador de Voltagem",
      "Reles",
      "Rotor Distribuidor",
      "Sensores",
      "Soquete Lampada",
      "Tampa do Distribuidor",
      "Terminal Bateria",
      "Trava Elétrica",
    ],
  },
  {
    principal: "Escapamento",
    subcategorias: [
      "Abraçadeira",
      "Apito Escapamento",
      "Catalisador",
      "Coxim",
      "Juntas",
      "Ponteiras",
      "Silencioso",
      "Suporte",
    ],
  },
  {
    principal: "Exterior",
    subcategorias: [
      "Adesivo",
      "Aerofoles",
      "Antena",
      "Borrachas",
      "Buzina",
      "Calhas de Chuva",
      "Calotas",
      "Camaras de Ré",
      "Capa Retrovisor",
      "Churrasqueira",
      "Emblema",
      "Engates",
      "Esguicho Limpador Para-brisa",
      "Espelho Retrovisor",
      "Estribo",
      "Farol",
      "Frisos",
      "Grade",
      "Iluminação",
      "Lanterna",
      "Maçaneta",
      "Mangueria Combustivel",
      "Moldura Lateral",
      "Palhetas",
      "Parabrisa",
      "Parachoque",
      "Parafuso de Rodas",
      "Paralama",
      "Pisca",
      "Pneus",
      "Presilha",
      "Rack",
      "Retrovisor",
      "Rodas",
      "Sensores",
      "Spoiler",
      "Tanque Combustivel",
      "Teto Solar",
      "Vidro",
    ],
  },
  {
    principal: "Ferramentas",
    subcategorias: [
      "Alicates",
      "Carregador Bateria",
      "Chaves",
      "Lixa",
      "Maquina Teste Bicos",
    ],
  },
  {
    principal: "Freios",
    subcategorias: [
      "Cabo Freio de Mão",
      "Cano Freio",
      "Cavalete de Freio",
      "Cilindro de Freio",
      "Disco de Freio",
      "Filtro de Oleo",
      "Flexiveis",
      "Fluido de Freio",
      "Hidrovacuo",
      "Interruptor",
      "Lona de Freio",
      "Modulo ABS",
      "Panela de Freio",
      "Parafuso",
      "Pastilha de Freio",
      "Pedal Embreagem",
      "Pedal Freio",
      "Pinças de Freio",
      "Prato Espelho Freio",
      "Reparo",
      "Reservatorio",
      "Sensor ABS",
      "Servo Freio",
      "Tambor Freio",
      "Valvula Equalizadora",
    ],
  },
  {
    principal: "Injeção Eletrônica",
    subcategorias: [
      "Atuador de Marcha Lenta",
      "Bico Injetor",
      "Bomba de Combustivel",
      "Conector Bico Injetor",
      "Corpo de Borboleta",
      "Filtro Bico Injetor",
      "Filtro de Combustivel",
      "Flauta Bico Injetores",
      "Fluxo de AR",
      "Junta",
      "Kits",
      "Mangueira",
      "Modulo de Injeção",
      "Motor de Passo",
      "Orings",
      "Regulador de Pressão",
      "Sensor de Fase",
      "Sensor de Nivel",
      "Sensor de Rotação",
      "Sensor de Velocidade",
      "Sensor Detonação",
      "Sensor Map",
      "Sensor Nivel",
      "Sensores",
      "Sonda Lambda",
      "Tampa Flange Combustivel",
      "Valvula Canister",
      "Valvula EGR",
      "Valvula Solenoide",
    ],
  },
  {
    principal: "Interior",
    subcategorias: [
      "Acendedores",
      "Adesivo",
      "Airbag",
      "Alavanca de Cambio",
      "Alça de Apoio",
      "Alto Falantes",
      "Apoio de Braço",
      "Apoio de Cabeça",
      "Bagagito",
      "Banco",
      "Bateria",
      "Bola de Cambio",
      "Brake Light",
      "Cabo acelerador",
      "Caixa de Bateria",
      "Canaleta Porta",
      "Chave",
      "Cinto de Segurança",
      "Cinzeiros",
      "Coluna de Direção",
      "Computador de Bordo",
      "Comutador",
      "Consoles",
      "Difusor de Ar",
      "Difusores de Ar",
      "Espelho Retrovisor",
      "Estepe",
      "Extintor",
      "Forro de Teto",
      "Forros de Porta",
      "Grade Porta Malas",
      "Lanterna de Teto",
      "Luzes Interna",
      "Macaco",
      "Maçaneta",
      "Manivela",
      "Manopla Cambio",
      "Maquina de Vidro Manual",
      "Maquina Vidro Eletrico",
      "Moldura",
      "Painel",
      "Painel de Instrumentos",
      "Pedal Acelerador",
      "Pedal Embreagem",
      "Pedal Freio",
      "Pestana",
      "Plafon",
      "Porta Luvas",
      "Presilhas",
      "Puxador Porta",
      "Quebra Sol",
      "Rede",
      "Roldana",
      "Segurança Veicular",
      "Soleira",
      "Suporte",
      "Tampa Porta Luva",
      "Tampão",
      "Tapetes",
      "Tensor",
      "Trambulador",
      "Volante Direção",
    ],
  },
  {
    principal: "Motor",
    subcategorias: [
      "Abraçadeira",
      "Adesivo",
      "Alternador",
      "Aneis",
      "Arruela",
      "Balancim",
      "Bomba D'agua",
      "Bombas",
      "Bronzinas",
      "Cabeçotes",
      "Cabos",
      "Caixa de Rele",
      "Caixa Filtro de Ar",
      "Canister",
      "Carburador",
      "Carcaça Valvula Termostatica",
      "Carter",
      "Coletores de Admissão",
      "Comando de Valvula",
      "Correias",
      "Coxim",
      "Defletor",
      "Direção Hidraulica",
      "Distribuidor",
      "Embreagem",
      "Engrenagens",
      "Filtros",
      "Flange",
      "Helice Ventoinha",
      "Hidrovacuo",
      "Interruptor Cebolinha",
      "Juntas",
      "Mangueiras",
      "Mola de Valvula",
      "Motor de Arranque",
      "Oleo",
      "Parafuso",
      "Pistão",
      "Polias",
      "Porcas",
      "Presilhas",
      "Protetor de Carter",
      "Protetores",
      "Radiadores",
      "Reservatorio de Agua",
      "Retentor",
      "Rolamentos",
      "Selos do Motor",
      "Sensor Temperatua",
      "Sensor Temperatura",
      "Sensores",
      "Suporte",
      "Tampa de Oleo",
      "Tampa Reservatorio de Agua",
      "Tensor Correia",
      "Trocador de Calor",
      "Tucho Hidraulico",
      "Turbina",
      "Valvula Solenoide",
      "Válvula Termostática",
      "Valvulas",
      "Vareta Oleo",
      "Vela Aquededora",
      "Vela Ignição",
      "Ventoinha",
      "Virabrequim",
      "Volante do Motor",
    ],
  },
  {
    principal: "Suspenção",
    subcategorias: [
      "Agregado",
      "Amortecedor",
      "Arroelas",
      "Arruelas",
      "Bandeja",
      "Barra Estabilizadora",
      "Batentes",
      "Bieleta",
      "Braço Tirante",
      "Bucha",
      "Caixa de Direção",
      "Calço",
      "Calota",
      "Coifa",
      "Cordas",
      "Cubo de Roda",
      "Disco de Freio",
      "Eixo Traseiro",
      "Manga de Eixo",
      "Molas",
      "Parafusos",
      "Pivo",
      "Porca de Aço",
      "Rodas",
      "Rolamentos",
      "Telescopio",
      "Terminal Direção",
    ],
  },
  {
    principal: "Transmissão",
    subcategorias: [
      "Anel de retenção",
      "Atuador de Embreagem",
      "Cambio",
      "Cambio Automatico",
      "Cardan",
      "Coifa",
      "Coroa",
      "Coxim de Cambio",
      "Diferencial",
      "Disco de Embreagem",
      "Eixo",
      "Embreagem",
      "Engrenagens",
      "Filtro",
      "Flange",
      "Garfo",
      "Homocinética",
      "Pinhão",
      "Plato",
      "Retentor",
      "Rolamentos",
      "Sincronizador",
      "Tambulador",
      "Trocador de Calor",
      "Volante de Embreagem",
    ],
  },
];

const BRANDS = [
  "Agrale",
  "Alfa Romeo",
  "Asia Motors",
  "Audi",
  "BMW",
  "BYD",
  "CaoaChery",
  "Chery",
  "Chevrolet",
  "Chrysler",
  "Citroen",
  "Dacia",
  "DAF",
  "Daihatsu",
  "Dodge",
  "Effa",
  "Ferrari",
  "Fiat",
  "Ford",
  "Foton",
  "Geely",
  "Honda",
  "Hyundai",
  "Iveco",
  "Jac",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Lifan",
  "Man",
  "Marcopolo",
  "Maserati",
  "Mazda",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "New Holland",
  "Nissan",
  "OPel",
  "Outras",
  "Peugeot",
  "Porsche",
  "RAM",
  "Renault",
  "Scania",
  "Seat",
  "Smart",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Toyota",
  "Troller",
  "Vauxhall",
  "Volkswagen",
  "Volvo",
  "Yamaha",
];

function obterUrlFoto(foto) {
  if (typeof foto === "string") {
    return foto;
  }

  return (
    foto?.imagem_processada ||
    foto?.imagem_original ||
    foto?.url ||
    foto?.src ||
    ""
  );
}

function normalizarPreco(valor) {
  if (
    typeof valor === "number" &&
    Number.isFinite(valor)
  ) {
    return valor.toFixed(2);
  }

  const texto =
    String(valor ?? "")
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .trim();

  if (!texto) {
    return "";
  }

  const normalizado =
    texto.includes(",")
      ? texto
          .replace(/\./g, "")
          .replace(",", ".")
      : texto;

  const numero =
    Number(
      normalizado.replace(
        /[^\d.-]/g,
        ""
      )
    );

  return Number.isFinite(numero)
    ? numero.toFixed(2)
    : "";
}

function valoresUnicos(lista = []) {
  return [
    ...new Set(
      lista
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
    ),
  ];
}

function sugerirDados(dados) {
  const peca =
    dados?.pecaEncontrada ||
    null;

  const diagnostico =
    dados?.diagnostico ||
    null;

  const aplicacoes =
    Array.isArray(
      peca?.aplicacoes
    )
      ? peca.aplicacoes
      : [];

  const nomePeca =
    String(
      peca?.peca ||
      diagnostico?.peca ||
      ""
    ).trim();

  const fabricante =
    String(
      peca?.fabricante ||
      peca?.marca ||
      diagnostico?.fabricante ||
      ""
    ).trim();

  const montadoras =
    valoresUnicos(
      aplicacoes.map(
        (item) =>
          item?.montadora
      )
    );

 const modelos =
  valoresUnicos(
    aplicacoes
      .map((item) => {
        let modelo = String(
          item?.modelo ||
          item?.veiculo ||
          ""
        )
          .replace(/�/g, "")
          .replace(/[^\wÀ-ÿ\s.-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (!modelo) {
          return "";
        }

        // Remove informação técnica que venha depois do modelo
        modelo = modelo
          .split(
            /\s+(?=(?:gasolina|flex|diesel|mpfi|sohc|dohc|16v|8v|12v|20v|24v|powertech|motor|ano|código|codigo|bosch)\b)/i
          )[0]
          .trim();
          modelo = modelo
  .replace(
    /^(?:\d[\d\s.-]*\d)\s+(?=[A-Za-zÀ-ÿ])/,
    ""
  )
  .trim();

        // Descarta datas, códigos e números soltos
        if (
          /^\d+([.,]\d+)*$/.test(modelo)
        ) {
          return "";
        }

        // Descarta letras soltas
        if (
          /^[a-zA-Z]$/.test(modelo)
        ) {
          return "";
        }

        // Precisa parecer nome/modelo de veículo.
        // Mantém Astra, Vectra, C4, A3, 320i etc.
        const pareceModelo =
          /[A-Za-zÀ-ÿ]{2,}/.test(modelo) ||
          /^[A-Za-z]\d+[A-Za-z]*$/i.test(modelo) ||
          /^\d+[A-Za-z]+$/i.test(modelo);

        if (!pareceModelo) {
          return "";
        }

        return modelo;
      })
      .filter(Boolean)
  );

  const motores =
    valoresUnicos(
      aplicacoes.map(
        (item) =>
          item?.motor
      )
    );

  const codigo =
    String(
      dados?.codigo ||
      dados?.oem ||
      peca?.codigo_oem ||
      ""
    ).trim();

  const breveDescricao =
    [
      nomePeca,
      fabricante
        ? `Marca/Fabricante: ${fabricante}.`
        : "",
      montadoras.length
        ? `Aplicações: ${montadoras
            .slice(0, 4)
            .join(", ")}.`
        : "",
      codigo
        ? `Código: ${codigo}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

 const tags =
  valoresUnicos([
    ...modelos.slice(0, 12),
  ]);
  let categoriaPrincipal =
    "Injeção Eletrônica";

  let subcategoria = "";

  const textoPeca =
    `${nomePeca} ${dados?.titulo || ""}`
      .toLowerCase();

  if (
    textoPeca.includes(
      "sonda lambda"
    )
  ) {
    subcategoria =
      "Sonda Lambda";
  } else if (
    textoPeca.includes(
      "bico injet"
    )
  ) {
    subcategoria =
      "Bico Injetor";
  } else if (
    textoPeca.includes(
      "sensor map"
    )
  ) {
    subcategoria =
      "Sensor Map";
  } else if (
    textoPeca.includes(
      "sensor de rotação"
    ) ||
    textoPeca.includes(
      "sensor rotacao"
    )
  ) {
    subcategoria =
      "Sensor de Rotação";
  } else if (
    textoPeca.includes(
      "sensor de fase"
    )
  ) {
    subcategoria =
      "Sensor de Fase";
  } else if (
    textoPeca.includes(
      "bomba de combust"
    )
  ) {
    subcategoria =
      "Bomba de Combustivel";
  } else if (
    textoPeca.includes(
      "corpo de borboleta"
    )
  ) {
    subcategoria =
      "Corpo de Borboleta";
  } else if (
    textoPeca.includes(
      "egr"
    )
  ) {
    subcategoria =
      "Valvula EGR";
  } else if (
    textoPeca.includes(
      "bobina"
    )
  ) {
    categoriaPrincipal =
      "Elétrica";

    subcategoria =
      "Bobina de Ignição";
  } else if (
    textoPeca.includes(
      "alternador"
    )
  ) {
    categoriaPrincipal =
      "Elétrica";

    subcategoria =
      "Alternadores";
  } else if (
    textoPeca.includes(
      "motor de arranque"
    ) ||
    textoPeca.includes(
      "motor de partida"
    )
  ) {
    categoriaPrincipal =
      "Elétrica";

    subcategoria =
      "Motor de Arranque";
  }

  const brand =
    montadoras.find(
      (montadora) =>
        BRANDS.some(
          (item) =>
            item.toLowerCase() ===
            String(
              montadora
            ).toLowerCase()
        )
    ) ||
    "";

  return {
    breveDescricao,
    tags,
    categoriaPrincipal,
    subcategoria,
    brand,
    montadoras,
    modelos,
    motores,
    fabricante,
  };
}

export default function PublicacaoSite({
  cardStyle,
  setScreen,
}) {
  const dados = useMemo(() => {
    try {
      const salvo =
        localStorage.getItem(
          "siteAnuncioRevisao"
        ) ||
        localStorage.getItem(
          "anuncioProntoPublicacao"
        );

      return salvo
        ? JSON.parse(salvo)
        : null;
    } catch {
      return null;
    }
  }, []);

  const sugestoes =
    useMemo(
      () =>
        sugerirDados(
          dados || {}
        ),
      [dados]
    );

  const [titulo, setTitulo] =
    useState(
      String(
        dados?.titulo || ""
      )
    );

  const [
    descricao,
    setDescricao,
  ] =
    useState(
      String(
        dados?.descricao || ""
      )
    );

  const [
    breveDescricao,
    setBreveDescricao,
  ] =
    useState(
      sugestoes
        .breveDescricao ||
      ""
    );

  const [
    preco,
    setPreco,
  ] =
    useState(
      normalizarPreco(
        dados?.preco
      )
    );

  const [
    precoPromocional,
    setPrecoPromocional,
  ] =
    useState("");

  const [
    estoque,
    setEstoque,
  ] =
    useState(
      String(
        dados?.estoque ?? "0"
      )
    );

  const [
    entrega,
    setEntrega,
  ] =
    useState(
      "Entrega normal"
    );
const [peso, setPeso] =
  useState("0.500");

const [comprimento, setComprimento] =
  useState("20");

const [largura, setLargura] =
  useState("15");

const [altura, setAltura] =
  useState("10");
  const [
    categoriaPrincipal,
    setCategoriaPrincipal,
  ] =
    useState(
      sugestoes
        .categoriaPrincipal
    );

  const [
    subcategoria,
    setSubcategoria,
  ] =
    useState(
      sugestoes
        .subcategoria
    );

  const [
    brand,
    setBrand,
  ] =
    useState(
      sugestoes.brand
    );

  const [
    tagsTexto,
    setTagsTexto,
  ] =
    useState(
      sugestoes.tags
        .join(", ")
    );

  const [
    enviando,
    setEnviando,
  ] =
    useState(false);

  const fotos =
    Array.isArray(
      dados?.fotos
    )
      ? dados.fotos
      : [];

  const subcategorias =
    CATEGORIAS_SITE.find(
      (item) =>
        item.principal ===
        categoriaPrincipal
    )?.subcategorias ||
    [];

  function voltar() {
    setScreen?.(
      "centralPublicacao"
    );
  }

  async function enviarRascunho() {
    if (enviando) {
      return;
    }

    const tituloFinal =
      String(
        titulo || ""
      ).trim();

    const precoFinal =
      normalizarPreco(
        preco
      );

    if (!tituloFinal) {
      alert(
        "Informe o título do produto."
      );
      return;
    }

    if (!precoFinal) {
      alert(
        "Informe um preço válido."
      );
      return;
    }

    const imagens =
      fotos
        .map(
          obterUrlFoto
        )
        .filter(
          (url) =>
            String(
              url || ""
            ).startsWith(
              "https://"
            )
        );

    const tags =
      valoresUnicos(
        String(
          tagsTexto || ""
        )
          .split(",")
      );

    setEnviando(true);

    try {
      const {
        data: resultado,
        error,
      } =
        await supabase
          .functions
          .invoke(
            "publicar-woocommerce",
            {
              body: {
                titulo:
                  tituloFinal,

                descricao,

                breve_descricao:
                  breveDescricao,

                codigo:
                  dados?.codigo ||
                  dados?.oem ||
                  "",

                oem:
                  dados?.oem ||
                  "",

                sku:
                  dados?.codigo ||
                  dados?.oem ||
                  "",

                preco:
                  precoFinal,

                preco_promocional:
                  normalizarPreco(
                    precoPromocional
                  ),

                estoque:
                  Math.max(
                    0,
                    Math.floor(
                      Number(
                        estoque
                      ) || 0
                    )
                  ),

                entrega,
                entrega,

peso,

dimensoes: {
  comprimento,
  largura,
  altura,
},

imagens,

                imagens,

                categoria:
                  subcategoria ||
                  categoriaPrincipal,

                categoria_principal:
                  categoriaPrincipal,

                tags,

                brand,

                fabricante:
                  sugestoes
                    .fabricante,

                montadoras:
                  sugestoes
                    .montadoras,

                modelos:
                  sugestoes
                    .modelos,

                motores:
                  sugestoes
                    .motores,

                aplicacoes:
                  Array.isArray(
                    dados
                      ?.pecaEncontrada
                      ?.aplicacoes
                  )
                    ? dados
                        .pecaEncontrada
                        .aplicacoes
                    : [],
              },
            }
          );

      if (error) {
        throw new Error(
          error?.message ||
          "A função publicar-woocommerce não respondeu."
        );
      }

      if (
        !resultado?.sucesso
      ) {
        throw new Error(
          resultado?.erro ||
          "Não foi possível enviar o produto para o WooCommerce."
        );
      }

      alert(
        `✅ Produto enviado como RASCUNHO.\n\nID WooCommerce: ${resultado?.produto?.id || "-"}`
      );
    } catch (erro) {
      console.error(
        "Erro ao enviar produto:",
        erro
      );

      alert(
        erro instanceof Error
          ? erro.message
          : "Erro ao enviar o produto."
      );
    } finally {
      setEnviando(false);
    }
  }

  if (!dados) {
    return (
      <div style={paginaStyle}>
        <section
          style={{
            ...cardStyle,
            ...secaoStyle,
            textAlign:
              "center",
          }}
        >
          <h2
            style={{
              color:
                "#67e8f9",
            }}
          >
            🌐 Seu Site
          </h2>

          <p
            style={{
              color:
                "#94a3b8",
            }}
          >
            Nenhum anúncio foi
            encontrado para revisão.
          </p>

          <button
            type="button"
            onClick={voltar}
            style={botaoSecundario}
          >
            ⬅ Voltar
          </button>
        </section>
      </div>
    );
  }

  return (
    <div style={paginaStyle}>
      <section
        style={{
          ...cardStyle,
          ...topoStyle,
        }}
      >
        <div
          style={{
            fontSize:
              "42px",
          }}
        >
          🌐
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              color:
                "#86efac",
            }}
          >
            Anúncio para Seu Site
          </h2>

          <p
            style={{
              margin:
                "5px 0 0",
              color:
                "#bbf7d0",
            }}
          >
            Revise os dados antes de
            enviar ao WooCommerce.
          </p>
        </div>
      </section>

      <div style={layoutStyle}>
        <main>
          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              1. Título do produto
            </h3>

            <input
              value={titulo}
              onChange={(e) =>
                setTitulo(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              2. Descrição do produto
            </h3>

            <textarea
              value={descricao}
              onChange={(e) =>
                setDescricao(
                  e.target.value
                )
              }
              rows={15}
              style={{
                ...inputStyle,
                resize:
                  "vertical",
                minHeight:
                  "300px",
              }}
            />
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              3. Breve descrição
            </h3>

            <textarea
              value={
                breveDescricao
              }
              onChange={(e) =>
                setBreveDescricao(
                  e.target.value
                )
              }
              rows={5}
              style={{
                ...inputStyle,
                resize:
                  "vertical",
              }}
            />
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              4. Dados do produto
            </h3>

            <div style={gradeCampos}>
              <label style={labelStyle}>
                Preço normal
                <input
                  value={preco}
                  onChange={(e) =>
                    setPreco(
                      e.target.value
                    )
                  }
                  placeholder="0,00"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Preço promocional
                <input
                  value={
                    precoPromocional
                  }
                  onChange={(e) =>
                    setPrecoPromocional(
                      e.target.value
                    )
                  }
                  placeholder="Opcional"
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Estoque
                <input
                  type="number"
                  min="0"
                  value={estoque}
                  onChange={(e) =>
                    setEstoque(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Entrega
                <select
                  value={entrega}
                  onChange={(e) =>
                    setEntrega(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option>
                    Entrega normal
                  </option>
                  <option>
                    Pronta entrega
                  </option>
                  <option>
                    Sob consulta
                  </option>
                </select>
              </label>
              <label style={labelStyle}>
  Peso (kg)
  <input
    type="number"
    min="0"
    step="0.001"
    value={peso}
    onChange={(e) =>
      setPeso(e.target.value)
    }
    placeholder="Ex.: 0.500"
    style={inputStyle}
  />
</label>

<label style={labelStyle}>
  Comprimento (cm)
  <input
    type="number"
    min="0"
    step="0.1"
    value={comprimento}
    onChange={(e) =>
      setComprimento(e.target.value)
    }
    placeholder="Ex.: 20"
    style={inputStyle}
  />
</label>

<label style={labelStyle}>
  Largura (cm)
  <input
    type="number"
    min="0"
    step="0.1"
    value={largura}
    onChange={(e) =>
      setLargura(e.target.value)
    }
    placeholder="Ex.: 15"
    style={inputStyle}
  />
</label>

<label style={labelStyle}>
  Altura (cm)
  <input
    type="number"
    min="0"
    step="0.1"
    value={altura}
    onChange={(e) =>
      setAltura(e.target.value)
    }
    placeholder="Ex.: 10"
    style={inputStyle}
  />
</label>
            </div>
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              8. Fotos
            </h3>

            <div style={gradeFotos}>
              {fotos.map(
                (foto, index) => {
                  const url =
                    obterUrlFoto(
                      foto
                    );

                  if (!url) {
                    return null;
                  }

                  return (
                    <div
                      key={
                        foto?.id ||
                        `${url}-${index}`
                      }
                      style={fotoBox}
                    >
                      <img
                        src={url}
                        alt={`Produto ${index + 1}`}
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </section>
        </main>

        <aside>
          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              5. Tags
            </h3>

            <textarea
              value={tagsTexto}
              onChange={(e) =>
                setTagsTexto(
                  e.target.value
                )
              }
              rows={6}
              placeholder="Gol, Parati, Polo..."
              style={{
                ...inputStyle,
                resize:
                  "vertical",
              }}
            />

            <small style={ajudaStyle}>
              Separe por vírgulas.
            </small>
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              6. Categorias
            </h3>

            <label style={labelStyle}>
              Categoria principal
              <select
                value={
                  categoriaPrincipal
                }
                onChange={(e) => {
                  setCategoriaPrincipal(
                    e.target.value
                  );
                  setSubcategoria(
                    ""
                  );
                }}
                style={inputStyle}
              >
                {CATEGORIAS_SITE.map(
                  (item) => (
                    <option
                      key={
                        item.principal
                      }
                      value={
                        item.principal
                      }
                    >
                      {item.principal}
                    </option>
                  )
                )}
              </select>
            </label>

            <label style={labelStyle}>
              Subcategoria
              <select
                value={
                  subcategoria
                }
                onChange={(e) =>
                  setSubcategoria(
                    e.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="">
                  Sem subcategoria
                </option>

                {subcategorias.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>
          </section>

          <section style={secaoStyle}>
            <h3 style={tituloSecao}>
              7. Brands
            </h3>

            <select
              value={brand}
              onChange={(e) =>
                setBrand(
                  e.target.value
                )
              }
              style={inputStyle}
            >
              <option value="">
                Selecione
              </option>

              {BRANDS.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </section>

          <section
            style={{
              ...secaoStyle,
              position:
                "sticky",
              top:
                "20px",
            }}
          >
            <div
              style={{
                color:
                  "#94a3b8",
                fontSize:
                  "12px",
                lineHeight:
                  1.6,
                marginBottom:
                  "14px",
              }}
            >
              O produto será enviado
              como <strong
                style={{
                  color:
                    "#86efac",
                }}
              >
                RASCUNHO
              </strong>.
            </div>

            <button
              type="button"
              onClick={
                enviarRascunho
              }
              disabled={
                enviando
              }
              style={{
                ...botaoPrincipal,
                opacity:
                  enviando
                    ? 0.65
                    : 1,
                cursor:
                  enviando
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {enviando
                ? "⏳ Enviando..."
                : "🌐 Enviar como Rascunho"}
            </button>

            <button
              type="button"
              onClick={voltar}
              style={{
                ...botaoSecundario,
                width:
                  "100%",
                marginTop:
                  "10px",
              }}
            >
              ⬅ Voltar à Central
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

const paginaStyle = {
  width:
    "100%",
  maxWidth:
    "1280px",
  margin:
    "30px auto",
  padding:
    "0 16px 30px",
  boxSizing:
    "border-box",
};

const topoStyle = {
  padding:
    "24px",
  borderRadius:
    "18px",
  border:
    "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#052e16,#0f172a)",
  display:
    "flex",
  alignItems:
    "center",
  gap:
    "16px",
};

const layoutStyle = {
  display:
    "grid",
  gridTemplateColumns:
    "minmax(0,2fr) minmax(280px,0.8fr)",
  gap:
    "18px",
  alignItems:
    "start",
  marginTop:
    "18px",
};

const secaoStyle = {
  padding:
    "20px",
  borderRadius:
    "15px",
  background:
    "#0f172a",
  border:
    "1px solid #1e293b",
  marginBottom:
    "18px",
};

const tituloSecao = {
  margin:
    "0 0 14px",
  color:
    "#67e8f9",
  fontSize:
    "17px",
};

const inputStyle = {
  width:
    "100%",
  boxSizing:
    "border-box",
  marginTop:
    "7px",
  padding:
    "11px 12px",
  borderRadius:
    "9px",
  border:
    "1px solid #334155",
  background:
    "#020617",
  color:
    "#ffffff",
  fontSize:
    "14px",
  outline:
    "none",
};

const labelStyle = {
  color:
    "#cbd5e1",
  fontSize:
    "12px",
  fontWeight:
    "700",
};

const gradeCampos = {
  display:
    "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(180px,1fr))",
  gap:
    "14px",
};

const gradeFotos = {
  display:
    "grid",
  gridTemplateColumns:
    "repeat(auto-fill,minmax(130px,1fr))",
  gap:
    "12px",
};

const fotoBox = {
  height:
    "140px",
  borderRadius:
    "11px",
  border:
    "1px solid #334155",
  background:
    "#ffffff",
  padding:
    "7px",
  overflow:
    "hidden",
};

const ajudaStyle = {
  color:
    "#64748b",
  display:
    "block",
  marginTop:
    "8px",
};

const botaoPrincipal = {
  width:
    "100%",
  padding:
    "13px 16px",
  borderRadius:
    "11px",
  border:
    "1px solid #22c55e",
  background:
    "linear-gradient(135deg,#166534,#22c55e)",
  color:
    "#ffffff",
  fontWeight:
    "800",
};

const botaoSecundario = {
  padding:
    "12px 16px",
  borderRadius:
    "10px",
  border:
    "1px solid #475569",
  background:
    "#020617",
  color:
    "#e2e8f0",
  cursor:
    "pointer",
  fontWeight:
    "700",
};