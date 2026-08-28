export type FamiliaPeca =
  | "sensor"
  | "bico"
  | "bomba"
  | "bobina"
  | "sonda"
  | "comando"
  | "cabecote"
  | "palheta"
  | "alternador"
  | "motor_partida"
  | "peca_geral";

export type EstiloDiretor =
  | "premium"
  | "marketplace"
  | "clean";

export interface DiretorIAEntrada {
  descricao?: string;
  categoria?: string;
  familia?: string;
  estilo?: EstiloDiretor;
  duracao?: number;
  instrucoesExtras?: string;
}

export interface DiretorIARetorno {
  familia: FamiliaPeca;
  estilo: EstiloDiretor;
  duracao: number;
  prompt: string;
  negativePrompt: string;
  movimentos: string[];
  focoDetalhes: string[];
}

function normalizarTexto(
  valor: unknown
): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function identificarFamiliaClip(
  entrada: DiretorIAEntrada
): FamiliaPeca {
  const texto = normalizarTexto(
    [
      entrada.familia,
      entrada.categoria,
      entrada.descricao,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const regras: Array<{
    familia: FamiliaPeca;
    palavras: string[];
  }> = [
    {
      familia: "sensor",
      palavras: [
        "sensor",
        "map",
        "maf",
        "pressao",
        "rotacao",
        "fase",
        "temperatura",
      ],
    },
    {
      familia: "bico",
      palavras: [
        "bico",
        "injetor",
        "injecao",
        "injector",
      ],
    },
    {
      familia: "bomba",
      palavras: [
        "bomba",
        "combustivel",
        "fuel pump",
      ],
    },
    {
      familia: "bobina",
      palavras: [
        "bobina",
        "ignicao",
        "coil",
      ],
    },
    {
      familia: "sonda",
      palavras: [
        "sonda",
        "lambda",
        "oxigenio",
        "oxygen sensor",
      ],
    },
    {
      familia: "comando",
      palavras: [
        "comando",
        "valvulas",
        "camshaft",
      ],
    },
    {
      familia: "cabecote",
      palavras: [
        "cabecote",
        "cylinder head",
      ],
    },
    {
      familia: "palheta",
      palavras: [
        "palheta",
        "limpador",
        "wiper",
      ],
    },
    {
      familia: "alternador",
      palavras: [
        "alternador",
        "alternator",
      ],
    },
    {
      familia: "motor_partida",
      palavras: [
        "motor de partida",
        "arranque",
        "starter motor",
      ],
    },
  ];

  const encontrada = regras.find(
    (regra) =>
      regra.palavras.some(
        (palavra) =>
          texto.includes(palavra)
      )
  );

  return encontrada?.familia ||
    "peca_geral";
}

function limitarDuracao(
  valor: unknown
): number {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return 10;
  }

  return numero <= 5 ? 5 : 10;
}

function obterDirecaoFamilia(
  familia: FamiliaPeca
) {
  const direcoes: Record<
    FamiliaPeca,
    {
      movimentos: string[];
      focos: string[];
      instrucao: string;
    }
  > = {
    sensor: {
      movimentos: [
        "slow cinematic push-in",
        "small lateral parallax",
        "subtle 10-degree camera orbit",
      ],
      focos: [
        "electrical connector",
        "sensor body",
        "mounting points",
      ],
      instrucao:
        "Emphasize the electrical connector, sensor body and mounting points without creating hidden sides.",
    },

    bico: {
      movimentos: [
        "slow diagonal push-in",
        "small controlled orbit",
        "gentle vertical pan",
      ],
      focos: [
        "injector nozzle",
        "electrical connector",
        "sealing area",
      ],
      instrucao:
        "Highlight the injector nozzle, connector and sealing area while keeping the exact injector geometry.",
    },

    bomba: {
      movimentos: [
        "slow lateral tracking",
        "subtle camera orbit",
        "gentle close-up",
      ],
      focos: [
        "electrical terminals",
        "fuel connections",
        "metallic body",
      ],
      instrucao:
        "Use lateral camera movement to show the pump length, connections and metallic finish.",
    },

    bobina: {
      movimentos: [
        "slow push-in",
        "small vertical tilt",
        "subtle side parallax",
      ],
      focos: [
        "electrical connector",
        "coil body",
        "spark plug connection",
      ],
      instrucao:
        "Focus on the connector, coil body and spark plug connection with restrained camera motion.",
    },

    sonda: {
      movimentos: [
        "slow cable-follow pan",
        "gentle push-in",
        "small side orbit",
      ],
      focos: [
        "sensor tip",
        "thread",
        "connector and cable",
      ],
      instrucao:
        "Follow the visible cable direction and highlight the thread, sensor tip and connector.",
    },

    comando: {
      movimentos: [
        "slow horizontal tracking",
        "subtle end-to-end pan",
        "small controlled orbit",
      ],
      focos: [
        "cam lobes",
        "bearing surfaces",
        "machined finish",
      ],
      instrucao:
        "Track along the camshaft length and emphasize the lobes and machined surfaces.",
    },

    cabecote: {
      movimentos: [
        "wide slow lateral pan",
        "subtle top-down tilt",
        "gentle push-in",
      ],
      focos: [
        "combustion areas",
        "machined surfaces",
        "mounting holes",
      ],
      instrucao:
        "Use a wider composition and show the visible machined surfaces and mounting points.",
    },

    palheta: {
      movimentos: [
        "slow horizontal tracking",
        "gentle push-in",
        "small depth parallax",
      ],
      focos: [
        "rubber blade",
        "mounting adapter",
        "full product length",
      ],
      instrucao:
        "Keep the full wiper blade visible and emphasize the rubber profile and mounting adapter.",
    },

    alternador: {
      movimentos: [
        "slow circular camera orbit",
        "gentle push-in",
        "small vertical tilt",
      ],
      focos: [
        "pulley",
        "electrical terminals",
        "vented housing",
      ],
      instrucao:
        "Highlight the pulley, terminals and vented housing without rotating the alternator itself.",
    },

    motor_partida: {
      movimentos: [
        "slow side tracking",
        "subtle orbit",
        "gentle close-up",
      ],
      focos: [
        "pinion area",
        "solenoid",
        "electrical terminals",
      ],
      instrucao:
        "Emphasize the pinion area, solenoid and terminals while preserving the exact assembly.",
    },

    peca_geral: {
      movimentos: [
        "slow cinematic push-in",
        "small lateral parallax",
        "subtle camera orbit",
      ],
      focos: [
        "main visible details",
        "connectors",
        "surface finish",
      ],
      instrucao:
        "Choose the most relevant visible details and use restrained professional camera movement.",
    },
  };

  return direcoes[familia];
}

function obterDirecaoEstilo(
  estilo: EstiloDiretor
): string {
  const estilos: Record<
    EstiloDiretor,
    string
  > = {
    premium:
      "Use premium automotive commercial cinematography, smooth stabilization, realistic studio lighting transitions and elegant pacing.",

    marketplace:
      "Use clear marketplace presentation, stable movement, strong product visibility and neutral commercial lighting.",

    clean:
      "Use minimal movement, clean composition, soft lighting and maximum technical fidelity.",
  };

  return estilos[estilo];
}

function montarNegativePrompt(): string {
  return [
    "deformed product",
    "distorted geometry",
    "changed proportions",
    "changed colors",
    "changed materials",
    "extra components",
    "missing components",
    "invented components",
    "wrong connectors",
    "wrong pins",
    "wrong holes",
    "wrong screws",
    "changed engravings",
    "changed labels",
    "rotating physical product",
    "invented hidden side",
    "cropped product",
    "cut off product",
    "text",
    "logo",
    "watermark",
    "frame",
    "hands",
    "people",
    "tools",
    "vehicle",
    "packaging",
    "extra objects",
    "cartoon",
    "illustration",
    "CGI",
    "3D render",
    "flicker",
    "camera shake",
    "heavy motion blur",
    "low quality",
  ].join(", ");
}

export function motorDiretorIA(
  entrada: DiretorIAEntrada = {}
): DiretorIARetorno {
  const familia =
    identificarFamiliaClip(entrada);

  const estilo:
    EstiloDiretor =
      entrada.estilo ||
      "premium";

  const duracao =
    limitarDuracao(
      entrada.duracao
    );

  const direcaoFamilia =
    obterDirecaoFamilia(familia);

  const prompt = [
    "You are an automotive commercial film director.",

    "Study the uploaded automotive part before creating the video.",

    `Detected product family: ${familia}.`,

    obterDirecaoEstilo(estilo),

    direcaoFamilia.instrucao,

    `Use this camera sequence: ${direcaoFamilia.movimentos.join(
      ", "
    )}.`,

    `Prioritize these visible details: ${direcaoFamilia.focos.join(
      ", "
    )}.`,

    "The uploaded automotive part is the only subject.",

    "Keep the physical product completely static.",

    "Animate only the virtual camera, depth, focus and subtle studio lighting.",

    "Never modify geometry, dimensions, proportions, colors, materials, connectors, pins, holes, screws, engravings, labels or manufacturing marks.",

    "Never invent hidden surfaces or unseen product details.",

    "Keep the entire product visible during the main sequence.",

    "Use realistic cinematic zoom, controlled orbit, pan, tilt and parallax only when compatible with the visible image.",

    "Use subtle depth of field and realistic metallic or plastic reflections without changing the product.",

    "Keep the original clean background.",

    "No text, no logo, no watermark, no frame, no people and no extra objects.",

    "Produce one premium automotive marketplace video with smooth stabilization and professional commercial quality.",

    entrada.descricao
      ? `Product description for context only: ${entrada.descricao}.`
      : "",

    entrada.instrucoesExtras ||
      "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    familia,
    estilo,
    duracao,
    prompt,
    negativePrompt:
      montarNegativePrompt(),
    movimentos:
      direcaoFamilia.movimentos,
    focoDetalhes:
      direcaoFamilia.focos,
  };
}

export default motorDiretorIA;