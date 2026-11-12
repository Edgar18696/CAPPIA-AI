# Central do Paizinho — próxima etapa (piloto LOJA ONLINE)

Situação em 11/11/2026. Nada publicado, nenhum banco alterado, nenhum agendamento ativo.
Ramo local: `paizinho/auditoria-piloto-loja-online`.

## O que o teste local com dados reais mostrou
- Conta LOJA ONLINE (1729335019): 1.127 anúncios ativos.
- No teste local, as leituras passam pela função `mercadolivre-publicacao`, que tem uma lista de endereços
  permitidos. Ela recusa:
  - o perfil (`/users/{id}`);
  - a leitura em lote (`/items?ids`);
  - as visitas;
  - os pedidos.
  Por isso, no teste local, vendas, visitas, conversão e prejuízo aparecem como "não lido".
- O robô das 03h (`paizinho-auditoria`) consulta o ML diretamente com o token da conta, então essas leituras
  devem funcionar lá. Isso só é confirmado na primeira execução em modo "simular".
- A conta inteira levou mais de 20 minutos no navegador, e o Bling é o gargalo (cerca de 50 SKUs por minuto).

## Vendas e visitas no teste local: função `paizinho-leitura-ml` (preparada em 12/11/2026)
Situação: frete e medidas validados com a rodada completa (1.123 anúncios). Vendas, visitas, conversão
e faturamento seguem "não lido" porque a `mercadolivre-publicacao` recusa essas consultas.

O que foi preparado (só no ramo local, nada publicado):
- `supabase/functions/paizinho-leitura-ml/index.ts`: função nova, **somente leitura**.
  - Faz só GET no Mercado Livre e só nestes endereços: visitas (em grupo e por anúncio), pedidos da
    própria conta (`/orders/search?seller=1729335019...`) e custo dos envios (`/shipments/{id}/costs`).
    As regras estão em `src/services/paizinhoAuditoria/leituraComercial.js`, cobertas por testes.
  - Só responde ao usuário logado e só para a conta dele liberada no piloto (LOJA ONLINE).
  - Não renova nem grava token, não grava nada no banco. Se o token estiver vencido, pede para renovar
    pelo PAIIA.
  - Não precisa de tabela, segredo novo nem agendamento.
- No teste local, essas leituras passam a ir para a função nova; o resto continua igual. Enquanto ela
  não estiver publicada, o relatório diz "a função de leitura de vendas e visitas ainda não foi
  publicada" (conferido: hoje o endereço responde 404).

Passos que dependem da autorização (o Edgar executa ou autoriza):
1. Publicar só esta função, sem mexer nas outras:
   ```
   npx supabase login
   npx supabase functions deploy paizinho-leitura-ml --project-ref arqzpqkkpwikyecdbopf --use-api
   ```
   (`--use-api` evita precisar do Docker no Windows.)
2. Rodar de novo o teste local com "todos" (o Bling vem da memória do navegador por 24 h; cerca de 15 min).
   Ninguém deve clicar em "Sair" no PAIIA durante a rodada.
3. Conferir 3 a 5 anúncios contra o painel do Mercado Livre (vendas e visitas de 30 dias).
4. Para desfazer: `npx supabase functions delete paizinho-leitura-ml --project-ref arqzpqkkpwikyecdbopf`.

Observação: o faturamento de 30 dias é calculado como vendas × preço atual (aproximado). Depois da
primeira leitura real, avaliar usar o valor dos pedidos.

## Mudança necessária antes de ativar as 03h: rodar em partes
Uma função do Supabase tem limite de tempo por execução (poucos minutos). A conta inteira não cabe em uma
execução só. Proposta:
1. Às 03h a primeira chamada cria o registro do dia em `paiia_paizinho_relatorios` (status "em_andamento")
   e lê só a lista de anúncios.
2. Cada execução seguinte processa um lote (ex.: 150 anúncios) e guarda o resultado parcial no registro do
   dia. Ela é chamada pelo mesmo cron, a cada 3 minutos, entre 03h e 05h.
3. Quando todos os lotes terminam, junta as partes, monta o relatório e marca como "concluido".
4. Se algo falhar, o relatório sai com o que foi lido e a falha fica registrada. Nada é inventado.

## Passos que dependem da autorização do Edgar (nesta ordem)
1. Aplicar `20261110_paizinho_relatorios.sql` (tabelas do relatório e da tabela Renault).
2. Publicar a função `paizinho-auditoria` e criar os segredos `PAIZINHO_AUDITORIA_CHAVE` e
   `PAIZINHO_AUDITORIA_USUARIO_ID`.
3. Rodar uma vez em modo "simular" e conferir vendas, visitas, fretes e medidas contra o ML.
4. Ativar o agendamento (`20261110_paizinho_agendamento_03h.sql`, ajustado para as partes).
5. Publicar a tela no site ("Sim, publicar").

## Ainda em aberto
- Bling no servidor: o código da `bling-integracao` não está no repositório.
- Custo do Bling: a maior parte dos produtos está sem preço de custo, então não há margem.
- Medidas do Bling: muitas repetem 500 g e caixas padrão. Decidir se o Bling continua na comparação.
- Tabela Renault, créditos de concorrência (SerpAPI) e percentual de imposto.
- Toda divergência de frete e medidas fica "pendente de conferência física". Nenhum anúncio é alterado.
