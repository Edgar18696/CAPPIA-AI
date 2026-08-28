export class BaseMestre {
  constructor() {
    this.pecas = new Map();
  }

  adicionar(registro) {
    if (!registro) return;

    const codigo = String(
      registro.codigo_oem ||
      registro.codigo_equivalente ||
      registro.codigo ||
      ""
    ).trim();

    if (!codigo) return;

    if (!this.pecas.has(codigo)) {
      this.pecas.set(codigo, {
        codigoPrincipal: codigo,
        descricao: registro.peca || "",
        fabricantePrincipal: registro.fabricante || "",
        montadoras: new Set(),
        modelos: new Set(),
        motores: new Set(),
        equivalencias: new Set(),
        observacoes: new Set(),
        registros: [],
      });
    }

    const item = this.pecas.get(codigo);

    item.registros.push(registro);

    if (registro.montadora)
      item.montadoras.add(registro.montadora);

    if (registro.modelo)
      item.modelos.add(registro.modelo);

    if (registro.motor)
      item.motores.add(registro.motor);

    if (registro.codigo_equivalente)
      item.equivalencias.add(registro.codigo_equivalente);

    if (registro.observacao)
      item.observacoes.add(registro.observacao);
  }

  consultar(codigo) {
    return this.pecas.get(String(codigo).trim()) || null;
  }

  exportar(codigo) {
    const item = this.consultar(codigo);

    if (!item) return null;

    return {
      codigoPrincipal: item.codigoPrincipal,
      descricao: item.descricao,
      fabricantePrincipal: item.fabricantePrincipal,

      montadoras: [...item.montadoras],
      modelos: [...item.modelos],
      motores: [...item.motores],
      equivalencias: [...item.equivalencias],
      observacoes: [...item.observacoes],

      registros: item.registros,
    };
  }
}

export const baseMestre = new BaseMestre();