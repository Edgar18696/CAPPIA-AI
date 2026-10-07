// =============================================================
// Supabase FALSO (em memória) para os testes de fluxo da ficha.
// Sem rede. Registra toda tabela tocada e toda função chamada, para
// os testes provarem que nada foi para o ML, o Bling ou a base de
// conhecimento. Suporta só o que os serviços da ficha usam.
// =============================================================
export const banco = { tabelas: { paiia_anuncios: [], paiia_anuncios_publicacoes: [] }, chamadas: [], funcoes: [], seq: 0 };
export const USUARIO = "11111111-2222-4333-8444-555555555555";

export function zerarBanco() {
  banco.tabelas = { paiia_anuncios: [], paiia_anuncios_publicacoes: [] };
  banco.chamadas = [];
  banco.funcoes = [];
  banco.seq = 0;
}
const novoId = () => {
  banco.seq += 1;
  return `00000000-0000-4000-8000-${String(banco.seq).padStart(12, "0")}`;
};
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function caminho(obj, expr) {
  // dados_conferencia->novo_anuncio->>completa
  const partes = expr.split(/(->>|->)/);
  let v = obj?.[partes[0]];
  for (let i = 1; i < partes.length; i += 2) {
    const op = partes[i];
    const k = partes[i + 1];
    v = v == null ? null : v[k];
    if (op === "->>" && v != null) v = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return v === undefined ? null : v;
}

function dividirTopo(s) {
  const out = [];
  let prof = 0;
  let atual = "";
  for (const c of s) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) {
      out.push(atual.trim());
      atual = "";
    } else atual += c;
  }
  if (atual.trim()) out.push(atual.trim());
  return out;
}

function projetar(tabela, linha, select) {
  if (!select || select === "*") return clone(linha);
  const r = {};
  for (const tok of dividirTopo(select)) {
    const emb = tok.match(/^([a-z_]+)\((.*)\)$/s);
    if (emb) {
      const filhos = banco.tabelas[emb[1]].filter((p) => p.anuncio_id === linha.id);
      r[emb[1]] = filhos.map((f) => projetar(emb[1], f, emb[2]));
      continue;
    }
    const [alias, expr] = tok.includes(":") ? tok.split(":") : [tok.split(/->>|->/).pop(), tok];
    r[alias.trim()] = /->/.test(expr) ? clone(caminho(linha, expr.trim())) : clone(linha[expr.trim()] ?? null);
  }
  return r;
}

class Consulta {
  constructor(tabela) {
    this.tabela = tabela;
    this.filtros = [];
    this.op = "select";
    this.cols = "*";
    this.dados = null;
    this.retornar = false;
    this.lim = null;
  }
  select(c = "*") {
    if (this.op === "select") this.cols = c;
    else this.retornar = c;
    return this;
  }
  insert(d) { this.op = "insert"; this.dados = d; return this; }
  update(d) { this.op = "update"; this.dados = d; return this; }
  upsert(d, o) { this.op = "upsert"; this.dados = d; this.onConflict = o?.onConflict; return this; }
  delete() { this.op = "delete"; return this; }
  eq(k, v) { this.filtros.push((l) => String(l[k]) === String(v)); return this; }
  neq(k, v) { this.filtros.push((l) => String(l[k]) !== String(v)); return this; }
  is(k, v) { this.filtros.push((l) => (l[k] ?? null) === v); return this; }
  order() { return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.unico = "talvez"; return this.executar(); }
  single() { this.unico = "um"; return this.executar(); }
  then(ok, erro) { return this.executar().then(ok, erro); }
  async executar() {
    banco.chamadas.push({ tabela: this.tabela, op: this.op });
    const t = banco.tabelas[this.tabela];
    if (!t) return { data: null, error: { code: "42P01", message: `tabela ${this.tabela} não existe no teste` } };
    const casa = (l) => this.filtros.every((f) => f(l));
    if (this.op === "delete") return { data: null, error: { message: "DELETE não é permitido pelo app" } };
    if (this.op === "insert") {
      const linha = { id: novoId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...clone(this.dados) };
      t.push(linha);
      return { data: this.retornar ? projetar(this.tabela, linha, this.retornar) : null, error: null };
    }
    if (this.op === "upsert") {
      const chaves = String(this.onConflict || "id").split(",");
      const existente = t.find((l) => chaves.every((k) => String(l[k]) === String(this.dados[k])));
      if (existente) Object.assign(existente, clone(this.dados));
      else t.push({ id: novoId(), status_publicacao: "pendente", ...clone(this.dados) });
      return { data: null, error: null };
    }
    if (this.op === "update") {
      t.filter(casa).forEach((l) => Object.assign(l, clone(this.dados)));
      return { data: null, error: null };
    }
    let linhas = t.filter(casa);
    if (this.lim) linhas = linhas.slice(0, this.lim);
    const proj = linhas.map((l) => projetar(this.tabela, l, this.cols));
    if (this.unico === "um") return proj.length === 1 ? { data: proj[0], error: null } : { data: null, error: { message: "não é uma linha" } };
    if (this.unico === "talvez") return { data: proj[0] || null, error: null };
    return { data: proj, error: null };
  }
}

export const supabase = {
  from: (t) => new Consulta(t),
  auth: {
    getUser: async () => ({ data: { user: { id: USUARIO } } }),
    getSession: async () => ({ data: { session: { user: { id: USUARIO } } } }),
  },
  functions: {
    invoke: async (nome, op) => {
      banco.funcoes.push({ nome, corpo: op?.body });
      return { data: { ok: false, erro: "função não chamada em teste" }, error: null };
    },
  },
};
export const supabaseUrl = "https://teste.invalid";
export const supabaseKey = "teste";
