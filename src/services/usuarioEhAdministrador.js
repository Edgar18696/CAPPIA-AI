export function usuarioEhAdministrador(usuario) {
  if (!usuario) {
    return false;
  }

  const app = usuario.app_metadata || {};
  const meta = usuario.user_metadata || {};

  const papeis = [
    app.role,
    app.papel,
    app.perfil,
    meta.role,
    meta.papel,
    meta.perfil,
    meta.tipo_conta,
  ].map((valor) =>
    String(valor || "")
      .trim()
      .toLowerCase()
  );

  if (
    papeis.some(
      (papel) =>
        papel === "admin" ||
        papel === "administrador"
    )
  ) {
    return true;
  }

  if (app.admin === true || meta.admin === true) {
    return true;
  }

  const emailsPermitidos = String(
    import.meta.env.VITE_PAIIA_ADMIN_EMAILS || ""
  )
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const email = String(usuario.email || "")
    .trim()
    .toLowerCase();

  return Boolean(email && emailsPermitidos.includes(email));
}
