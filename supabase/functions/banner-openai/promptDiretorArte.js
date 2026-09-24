// Banner Express — DIRETOR DE ARTE: texto enviado à IA (OpenAI).
// Arquivo SEM dependências: usado pelo app, pelo servidor local
// (scripts/dev/bannerOpenAIDev.mjs) e pela função Supabase "banner-openai"
// (cópia idêntica em supabase/functions/banner-openai/).
// A IA cria SÓ a arte de fundo. Peça, logo, preço, código e contatos são
// colocados depois pelo PAIIA, exatamente como o usuário informou.

export const CORES_PROMPT = {
  azul:
    "a rich BLUE color system: deep navy and near-black shadows, royal blue midtones, vivid electric blue light, bright cyan neon highlights and crisp white hot spots; a tiny touch of warm amber only as small complementary sparks",
  vermelho:
    "a rich RED color system: near-black and deep crimson shadows, blood red midtones, hot red-orange light, golden yellow highlights and white hot spots",
  escuro:
    "a rich GRAPHITE color system: black and dark graphite shadows, steel gray midtones, cyan neon light and violet accents, white hot spots",
  clean:
    "a bright premium LIGHT color system: luminous white and pearl surfaces, soft silver, sky blue and royal blue light accents, with deep navy contrast details so it never looks washed out or flat",
};

export const DIRECOES_PROMPT = {
  "explosao-energia": {
    cena: "an explosive burst of electric energy radiating from behind the hero spot: dozens of sharp light rays and glowing energy streaks shooting outward, crackling light arcs, flying sparks and glowing particles, a bright circular shockwave ring on a glossy floor under the hero spot, darker vignette corners",
    elementos: "radial light rays, energy streaks, sparks, particles, lens flare, angular glowing geometric shards at the edges (out of focus in the foreground)",
    plataforma: true,
  },
  "arena-neon": {
    cena: "a futuristic neon showroom arena: a circular glowing podium disc (flat, empty) with concentric neon rings on the floor at the hero spot, tall light pillars and vertical light beams behind it, thin haze with volumetric rays, glossy reflective floor with long reflections",
    elementos: "concentric neon rings, light pillars, volumetric beams, haze, bokeh lights, bright rim reflections on the floor",
    plataforma: true,
  },
  velocidade: {
    cena: "pure high-speed light motion: strong diagonal light trails and motion-blurred speed streaks crossing the frame, sharp angular abstract light panels, a bright horizon glow behind the hero spot, dark glossy floor with streaking reflections",
    elementos: "diagonal speed lines, motion blur trails, angular panels, chevrons of light, sparks, strong perspective",
    plataforma: false,
  },
  "estudio-luxo": {
    cena: "a luxurious dark showroom-like light studio: black glossy floor with mirror reflections, long elegant curved strips of light in elegant arcs, a soft cone spotlight from above onto the hero spot, delicate haze, deep shadows and refined highlights",
    elementos: "curved light rails, thin elegant light lines, subtle smoke, mirror floor, soft spotlight cone, refined bokeh highlights",
    plataforma: true,
  },
  "cristal-metal": {
    cena: "a premium abstract composition of dark brushed-metal planes and translucent glass shards arranged in bold diagonal layers around the hero spot, polished chrome edges catching sharp light, light leaking between the layers, glossy floor",
    elementos: "layered glass shards, brushed metal planes, chrome edge highlights, light leaks, depth of field on foreground layers",
    plataforma: true,
  },
  "tecnologia-hud": {
    cena: "an advanced technology environment: large holographic HUD circles and interface rings (abstract, WITHOUT any letters or numbers) floating behind the hero spot, a glowing hexagon-grid platform on the floor under the hero spot, fine circuit-like light lines flowing in perspective, particles of light",
    elementos: "HUD rings without text, hexagon grid, circuit light lines, holographic glow, particles, scanning light beam",
    plataforma: true,
  },
  "escudo-confianca": {
    cena: "a powerful symmetric composition: a huge abstract glowing hexagonal light frame (pure geometric outline, no symbol, no text) standing behind the hero spot, bright backlight bursting from its center, a solid glowing platform on the floor under the hero spot, symmetric light beams and depth",
    elementos: "large glowing hexagonal frame, symmetric light beams, backlight burst, particles, reflective floor",
    plataforma: true,
  },
  "oficina-premium": {
    cena: "an abstract high-end garage atmosphere made only of out-of-focus bokeh light points and soft light panels (no recognizable objects, machines or vehicles), a dramatic spotlight creating a bright pool of light on a glossy surface at the hero spot, colored rim lights and haze",
    elementos: "bokeh lights, spotlight pool, haze, colored rim lights, depth of field",
    plataforma: true,
  },
  "comunicado-limpo": {
    cena: "a clean, luminous and modern composition: soft large gradient light planes and smooth curved translucent ribbons of light flowing across the frame, gentle glow behind the hero spot, subtle reflective surface, airy and organized with generous calm areas",
    elementos: "smooth curved light ribbons, soft geometric planes, gentle glow, subtle particles, clean reflections",
    plataforma: true,
  },
};

export const HUMOR_PROMPT = {
  promocao: "energetic retail promotion, maximum impact and excitement, vibrant saturated light, strong contrast, a selling mood",
  produto: "heroic showcase mood, clean commercial composition, the reserved hero area is the absolute focal point, dramatic light",
  premium: "sophisticated premium and technological campaign, elegant and powerful, refined dramatic lighting, rich deep tones with precise highlights",
  prontaEntrega: "a sense of speed, agility and immediate availability, dynamic motion, energetic light",
  comunicado: "clean, calm and instantly readable announcement, organized, luminous, professional",
  qualidade: "technological, professional and trustworthy, precision and reliability, confident strong lighting",
};

/**
 * @param {{ paleta?: string, direcaoId?: string, objetivo?: string, zonaProduto?: string,
 *   zonasTexto?: string[], luz?: string, semente?: number, baseProduto?: string }} dados
 */
export function montarPromptDiretorArte({
  paleta = "azul",
  direcaoId = "arena-neon",
  objetivo = "produto",
  zonaProduto = "",
  zonasTexto = [],
  luz = "",
  semente = 0,
  baseProduto = "",
} = {}) {
  const cor = CORES_PROMPT[paleta] || CORES_PROMPT.azul;
  const direcao = DIRECOES_PROMPT[direcaoId] || DIRECOES_PROMPT["arena-neon"];
  const humor = HUMOR_PROMPT[objetivo] || HUMOR_PROMPT.produto;
  const zonas = (Array.isArray(zonasTexto) ? zonasTexto : []).map(String).filter(Boolean).slice(0, 7);
  return [
    "You are an award-winning ADVERTISING ART DIRECTOR creating a purely ABSTRACT key-visual background for a high-impact social media campaign.",
    "The image must be 100% abstract: only light, glow, energy, geometric shapes, glossy surfaces, reflections, particles and atmosphere. There are NO objects of any kind in the image — no things, no machines, no vehicles, no devices, no mechanical shapes.",
    "Other elements (a photo, a logo and texts) will be placed on top later by another system, so leave the reserved areas described below free.",
    direcao.plataforma ? "A flat, empty glowing light disc/platform on the floor under the reserved hero area is allowed." : "",
    `VISUAL DIRECTION: ${direcao.cena}.`,
    `MOOD: ${humor}.`,
    `COLOR SCRIPT: ${cor}. The chosen color is a full color system with depth, never a flat fill: shadows, luminous midtones, intense highlights.`,
    `KEY LIGHT ${String(luz || "from behind")}; a strong backlight halo glowing exactly behind the reserved hero area.`,
    zonaProduto
      ? `RESERVED HERO AREA (keep it EMPTY — only soft light and glow, nothing inside it): ${String(zonaProduto)}. All energy lines, rays and geometry must lead the eye toward it.`
      : "RESERVED HERO AREA: a large empty glowing area in the center.",
    direcao.plataforma && baseProduto
      ? `LIGHT DISC POSITION: the glowing light disc on the floor must be centered exactly at ${String(baseProduto)} (the bottom edge of the reserved hero area). Do not place it higher or lower.`
      : "",
    `REQUIRED GRAPHIC RICHNESS: ${direcao.elementos}. Build three depth layers (blurred abstract light accents at the edges, sharp midground energy, deep background glow). Fill the whole frame with atmosphere: no dead empty areas.`,
    zonas.length
      ? `TEXT AREAS (texts, buttons and a logo will be placed here later): ${zonas.join("; ")}. Keep them calmer and with good contrast for legibility, but still part of the artwork (subtle light and texture), never an empty flat block.`
      : "",
    "AVOID: flat or empty background, simple gradient, plain studio, a small centered glow only, cold dull lighting, washed-out or muddy colors, generic stock look.",
    "ABSOLUTELY NO TEXT: no letters, words, numbers, logos, watermarks, icons, badges, buttons or symbols anywhere.",
    "FINAL CHECK: the image contains only abstract light and shapes; if anything looks like a physical object, turn it into abstract light.",
    `Output: premium abstract campaign artwork, vibrant, high contrast, cinematic depth, polished commercial finish (variation #${Number(semente) || 0}).`,
  ]
    .filter(Boolean)
    .join("\n");
}
