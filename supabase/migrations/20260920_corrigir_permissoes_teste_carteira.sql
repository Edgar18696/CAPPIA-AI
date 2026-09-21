begin;

grant select, insert, update, delete
on table public.creditos_appia
to service_role;

grant select, insert, update, delete
on table public.operacoes_creditos_paiia
to service_role;

grant select, insert, update, delete
on table public.eventos_pagamento_paiia
to service_role;

grant select
on table public.migracao_creditos_paiia_auditoria
to service_role;

commit;