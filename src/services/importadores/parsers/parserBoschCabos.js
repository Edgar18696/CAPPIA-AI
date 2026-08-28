const bobinas = parserBoschBobinas(...);
const velas = parserBoschVelas(...);
const cabos = parserBoschCabos(...);

return removerDuplicados([
  ...bobinas,
  ...velas,
  ...cabos,
]);