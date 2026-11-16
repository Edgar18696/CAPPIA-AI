# Chamado ao suporte de desenvolvedores do Mercado Livre: 403 em /seller-promotions

**Assunto:** HTTP 403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES em /seller-promotions, com permissões e escopos do app ativos (App ID 1283127548197864)

Olá. Temos uma integração própria (in-house) com o Mercado Livre:

- Aplicativo: **Paiia**
- App ID: **1283127548197864**
- Site: MLB
- Conta dona do aplicativo: a confirmar (pergunta 0 abaixo). Pela API, só o token do user_id 2412238242 lê os dados privados do app; os de 824312524 e 1729335019 recebem 403 "No puedes acceder".

O aplicativo está autorizado por 3 contas nossas, todas com os escopos read, write e offline_access:

| Conta | user_id |
|---|---|
| CIEBR | 824312524 |
| LOJA ONLINE | 1729335019 |
| REVELAÇÃO | 2412238242 |

**O que funciona com os mesmos access tokens:**
- `/users/{id}/items/search`
- `/items/{id}`
- `/items/{id}/compatibilities`
- `/items/{id}/sale_price`
- `/users/{id}/shipping_options/free`
- `/sites/MLB/listing_prices`

**Evidência adicional:** os grants das 3 contas (`GET /users/{id}/applications`) contêm só os escopos `urn:global:admin:info`, `urn:global:admin:oauth`, `urn:global:admin:users`, `urn:ml:*:publish-sync`, `urn:ml:*:comunication`, `urn:ml:mktp:metrics`, `urn:ml:mktp:orders-shipments`, `read`, `write` e `offline_access`. Não há nenhum escopo de promoções/ofertas.

**O que falha, sempre, nas 3 contas** (inclusive logo após renovar o token da CIEBR em 16/11/2026):

```
GET https://api.mercadolibre.com/seller-promotions/users/{USER_ID}?app_version=v2
GET https://api.mercadolibre.com/seller-promotions/items/{ITEM_ID}?app_version=v2   (item da própria conta)
```

Resposta:
```
403 {"code":"PA_UNAUTHORIZED_RESULT_FROM_POLICIES","blocked_by":"PolicyAgent","message":"At least one policy returned UNAUTHORIZED.","status":403}
```

**Pedido:**
0. Confirmar qual user_id é o proprietário/administrador do App ID 1283127548197864.
1. Confirmar se o App ID 1283127548197864 tem a permissão funcional **"Promoções, cupons e descontos"** habilitada, com leitura e escrita.
2. Se estiver habilitada, informar qual política do PolicyAgent está negando o acesso.
3. Informar se, depois de habilitar a permissão, as contas já autorizadas precisam autorizar o aplicativo de novo.
4. Informar se é necessário algum ajuste ligado à separação de aplicações Mercado Livre e Mercado Pago (vigente desde 30/08/2026). Os outros aplicativos da conta dona são do Mercado Pago, separados.
5. A tela de edição do aplicativo no DevCenter (`/devcenter/edit-app/1283127548197864`) responde "Tuvimos un problema. Por favor, vuelve a intentarlo." Pedimos ajuda para acessá-la.

Nenhum token ou segredo foi incluído nesta mensagem.
