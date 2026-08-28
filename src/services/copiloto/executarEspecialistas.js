import {
  especialistaTecnico,
  especialistaComercial,
  especialistaSEO,
  especialistaMarketplace,
  especialistaAuditoria,
  especialistaPublicacao,
} from "./index";

export function executarEspecialistas(
  contexto
) {
  const tecnico =
    especialistaTecnico(
      contexto
    );

  const comercial =
    especialistaComercial(
      contexto
    );

  const seo =
    especialistaSEO(
      contexto
    );

  const marketplace =
    especialistaMarketplace(
      contexto
    );

  const auditoria =
    especialistaAuditoria(
      contexto
    );

  const publicacao =
  especialistaPublicacao({
    ...contexto,
    seo,
    comercial,
  });

  return {
    tecnico,
    comercial,
    seo,
    marketplace,
    auditoria,
    publicacao,
  };
}

export default executarEspecialistas;