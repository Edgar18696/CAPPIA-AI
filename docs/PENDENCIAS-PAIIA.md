# PAIIA — Registro central de pendências

> Regra permanente (18/11/2026): **o Paizinho trabalha, o usuário decide.**
> Este arquivo é o único lugar das tarefas e correções. Atualize a linha (situação + histórico) em vez de criar outra.
> Situações: **pendente** · **em andamento** · **aguardando teste** · **aguardando decisão** · **concluído**.
> Prioridade: **P1** (bloqueia o trabalho ou é risco) · **P2** (importante) · **P3** (melhoria).

## Abertas

| # | Problema | Módulo | Prio. | Situação | Próximo passo / quem decide |
|---|---|---|---|---|---|
| 1 | Bucket `imagens` listável com a chave pública (qualquer um lista caminhos das fotos) | Segurança / Supabase | P1 | aguardando decisão | Mudança separada nas políticas do storage. Precisa da autorização do Edgar. |
| 2 | Permissão de Promoções do app ML ausente (`/seller-promotions` = 403) | Central de Promoções | P1 | aguardando suporte ML | Edgar abriu/abre chamado no Suporte para integradores. Não repetir o teste antes da resposta. |

| 4 | Imposto não cadastrado: nenhuma margem é definitiva, nada pode ser aprovado | Preços, Custos e Lucro | P1 | aguardando decisão | Edgar informa o % de imposto (projeto separado de impostos). |
| 5 | Custos vazios no Bling (ex.: 9091902258, 12663317) | Bling (dados) | P2 | pendente (Edgar) | Cadastrar o custo no fornecedor padrão do Bling. O PAIIA não grava no Bling. |
| 6 | Fila do Ranqueamento só no navegador (migração `20261117_paizinho_fila_anuncios` não aplicada) | Ranqueamento | P2 | aguardando decisão | Migração de produção: precisa de autorização específica. |
| 7 | Tabelas da Central de Promoções só no STAGING (`20261118_paiia_promocoes_selecao`) | Central de Promoções | P2 | aguardando decisão | Migração de produção: precisa de autorização específica. Até lá a seleção fica no navegador. |
| 8 | Rotina automática das 03h (relatório pronto de manhã) não ativa | Ranqueamento | P2 | pendente | Precisa de custo do Bling e imposto no servidor + cron; autorização. Começar pela REVELAÇÃO. |
| 9 | Botão "Sair" do app derruba a sessão em todos os computadores (`signOut` global) | Login | P2 | aguardando decisão | Trocar para `scope: "local"`. Precisa de autorização. |
| 10 | Situação real do MLB/Bling (anúncio 7700762751): branch `fix/situacao-real-mlb-bling` não publicada | Criar Anúncio / Publicação | P2 | aguardando decisão | Publicar com autorização. Nunca criar produto Bling para esse SKU. |
| 11 | MLB trocado (7527362): causa no servidor `publicar` não confirmada; conferência pós-publicação no servidor | Publicação | P2 | pendente | Código da função não está no repositório; função nova precisa de autorização. |
| 12 | Correção do SKU do parafuso (commit 383afc2, botão no Diagnóstico) não publicada | Criar Anúncio / Diagnóstico | P3 | aguardando decisão | Publicar com autorização. |
| 13 | NF de entrada no Bling (`/nfe` = 403) para custo | Bling | P3 | pendente | Permissão do app Bling; hoje usa pedidos de compra atendidos. |
| 14 | Branch `central/analisar-correcao` (12–13/11) nunca publicada | Ranqueamento | P3 | pendente | Revisar se ainda faz sentido depois da simplificação. |
| 15 | Conferência no site oficial da auditoria REVELAÇÃO (bobina/sonda, Exportar, Imprimir) | Ranqueamento | P2 | aguardando teste | Edgar logado: analisar REVELAÇÃO e clicar Imprimir uma vez. |

## Ranqueamento operacional 18/11 — aguardando decisão (publicar)

Tela principal com 4 números (analisados/restantes, pendências, urgentes, busca), lista com "Corrigir" e correção inteligente (prejuízo × custo não verificado × qualidade), "Marcar como resolvido" (fila/histórico), "Próximo anúncio", "Enviar para Promoções"; o resto em "Relatório completo". Testado no STAGING com o relatório real da REVELAÇÃO.

## Concluídas (histórico)

| Data | O quê | Onde |
|---|---|---|
| 18/11 | Simplificação geral (simulação automática, 1 clique para Promoções, textos e opções técnicas recolhidos) + margem com comissão real, custo pela última compra e faixas com autorização | main ad4b5fc |
| 18/11 | Relatório de impressão A4 próprio (todos os anúncios do filtro, conta, título completo, problemas + correções, observações); planilha com conta por anúncio e margem com vírgula | main fb9489c |
| 18/11 | Custo da última compra no Bling (função `paizinho-bling-compras` v1, só leitura); Exportar relatório | main c546b73 |
| 18/11 | Botão 👁️ na senha do login | main bd8f690 |
| 18/11 | Auditoria por anúncio; REVELAÇÃO padrão; fila no navegador | main a8b9ef6 |
| 18/11 | Central de Promoções (lista simples, metas 1/10/50/100/200, REVELAÇÃO principal) | main 77651f5 |
| 17/11 | Black Friday (só simulação, planilha manual) | main d3276ec |
| 17/11 | Central com 3 contas (LOJA ONLINE, CIEBR, REVELAÇÃO) | main 44fb1d0 |
| 15/11 | Trava de MLB devolvido trocado | main 43c4568 |
| 14/11 | Photoroom Basic na câmera (Foto IA) validado | produção |

## Pacote de simplificação 18/11 — PUBLICADO (main ad4b5fc)

Branch `paizinho/simplificacao-geral` (= main fb9489c + margem fc2c40b + simplificação). Testado em STAGING.

| # | Próximos candidatos (risco médio, ficaram para o próximo pacote) | Módulo |
|---|---|---|
| S1 | Juntar "Prioridades de hoje" e "Detalhes por assunto" na Auditoria por anúncio (hoje o mesmo problema aparece em até 4 lugares) | Ranqueamento |
| S2 | Central de Promoções aproveitar os dados do Ranqueamento (custo, margem, data da análise) ao receber um anúncio: o banco da seleção tem colunas fixas — precisa de coluna nova (migração, autorização) | Central de Promoções |
| S3 | Imposto informado num só lugar (Preços, Custos e Lucro), com a Black Friday só lendo | Preços / Promoções |

## Catálogos Técnicos — tela única (26/11/2026, branch catalogos/tecnicos-unificados, NÃO publicado)
- Aguardando o Edgar: publicar a branch; importar na produção DENSO Lambda (A+B+C) e TSA (roteiros prontos, não rodados).
- Euro: sem catálogo nem site identificado. Gauss: endereço oficial não conferido.
- TSA: 19 ocorrências para conferência manual (`C:\PAIIA\analise-tsa\PENDENCIAS_CONFERENCIA_MANUAL.csv`).
- Relatório: `C:\PAIIA\catalogos-tecnicos\RELATORIO_CATALOGOS_TECNICOS_26-11-2026.md`.

## PAIIA Parceiros — PUBLICADO (27/11/2026, main 0982232 + 4de45e1, autorizado pelo Edgar)
- **Modelo simplificado confirmado pelo Edgar no site oficial:**
  - catálogos dos fornecedores entram só com aprovação técnica;
  - contato direto entre usuário e fornecedor;
  - negociação, pagamento e entrega ficam entre as empresas;
  - mensalidade configurável, começando em R$ 199,90, com 30 dias gratuitos;
  - administração só pela comercial@casadainjecaosp.com.br;
  - nenhuma interferência comercial nos resultados técnicos.
- **O que foi feito:**
  - banco oficial: 10 tabelas, 23 funções, agendador da lista de montadoras/modelos (15 min), nenhum dado fictício (o banco recusa);
  - Supabase oficial: link de confirmação para www.paiia.com.br; e-mail "PAIIA AI";
  - código: olhinho no login, no cadastro (senha e confirmação) e convite para visitante sem login (antes aparecia erro de permissão).
- **Conferido em 27/11:**
  - produção com 0 parceiros, 0 itens e 1 administrador;
  - base técnica intacta (1.368.231 peças e 14.585 chaves);
  - olhinhos funcionando no site oficial;
  - formulário de administração conferido pelo Edgar.
- **Situação:** aguardando o primeiro parceiro real. Não cadastrar empresas fictícias na produção. Sem novas funcionalidades nesta etapa, só pequenas correções por necessidade real.
- **Reversão e backup:** `C:\PAIIA\backups\2026-11-27-antes-parceiros\PROCEDIMENTO_PUBLICACAO_E_REVERSAO.md`.
