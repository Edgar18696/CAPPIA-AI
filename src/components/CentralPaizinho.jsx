import { useMemo, useState } from "react";

const TAREFAS = [
  {
    id: "meus-custos",
    icone: "🧾",
    titulo: "Cadastrar meus custos",
    descricao: "Salva despesas, taxas e impostos para calcular o preço mínimo sem prejuízo.",
    objetivo: "Cadastrar os custos reais da operação para usar automaticamente na precificação.",
    limites: "Não inventar valores e não alterar preços de anúncios automaticamente.",
    formato: "Separar despesas fixas mensais, custos por venda, comissão, imposto e tarifa.",
    saida: "Custo rateado por venda, preço mínimo sem prejuízo e preço recomendado.",
    campos: [],
    destino: "centralPrecificacao",
    direto: true,
  },
  {
    id: "prioridades",
    icone: "🎯",
    titulo: "Mostrar as prioridades de hoje",
    descricao: "Organiza problemas e oportunidades por impacto e urgência.",
    objetivo: "Analisar a operação dos marketplaces e indicar as ações mais importantes para hoje.",
    limites: "Somente leitura. Não alterar anúncios, preços ou estoque sem aprovação.",
    formato: "Separar em urgente, importante e oportunidade, explicando o motivo de cada prioridade.",
    saida: "Resumo executivo e lista ordenada de ações recomendadas.",
    campos: [["marketplace", "Marketplace", "Mercado Livre"], ["periodo", "Período analisado", "Últimos 7 dias"]],
    integracao: true,
  },
  {
    id: "nao-vende",
    icone: "📈",
    titulo: "Analisar vendas e anúncios do mês",
    descricao: "Mostra campeões, baixo desempenho, anúncios sem vendas e ações prioritárias.",
    objetivo: "Analisar todos os anúncios da conta no período informado, identificar os produtos mais vendidos, menos vendidos e sem vendas, explicar causas prováveis e recomendar ações para melhorar vendas, receita e margem.",
    limites: "Somente leitura. Não alterar preço, título, descrição, estoque, status, publicidade ou responder clientes. Usar somente dados reais das integrações autorizadas; não inventar métricas. Toda mudança depende da aprovação do usuário.",
    formato: "Classificar em campeões, bom, intermediário, baixo desempenho, sem vendas ou sem dados. Separar fato confirmado, causa provável e sugestão. Priorizar por impacto financeiro, compatibilidade, estoque e reputação.",
    saida: "Primeiro um resumo executivo; depois relatório dos anúncios problemáticos e plano de ação em: corrigir imediatamente, melhorar nesta semana, acompanhar, repor, não comprar, criar kit, confirmar tecnicamente ou dados insuficientes.",
    campos: [
      ["marketplace", "Marketplace", "Mercado Livre"],
      ["periodo", "Mês analisado", "Mês atual"],
      ["escopo", "Escopo", "Todos os anúncios da conta"],
    ],
    valoresIniciais: {
      marketplace: "Mercado Livre",
      periodo: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      escopo: "Todos os anúncios da conta",
    },
    promptExecutor: `Você é o Paizinho, analista comercial especializado em marketplaces de autopeças.

OBJETIVO
Analise os anúncios da conta no período informado e identifique os mais vendidos, menos vendidos, sem vendas, motivos prováveis, problemas e ações para melhorar vendas, receita e margem.

DADOS
Use somente dados reais das integrações autorizadas: status; vendas; faturamento; visitas; conversão; estoque; última venda; idade; preço; frete; tarifas; envio; título; descrição; atributos; fotos; perguntas; reclamações; devoluções; publicidade; concorrentes realmente equivalentes; e catálogos técnicos autorizados. Não invente métricas.

PERÍODO
Use o mês escolhido. Sem período informado, use o mês atual até a data da execução.

CLASSIFICAÇÃO
Separe em Campeões, Bom desempenho, Intermediário, Baixo desempenho, Sem vendas e Sem dados suficientes. Considere vendas, faturamento, margem, visitas, conversão, estoque, dias disponível, preço e última venda.

MAIS VENDIDOS
Verifique vendas, faturamento, margem, conversão, estoque, duração, ruptura, título, descrição, fotos, compatibilidade confirmada, preço, reposição, kits, margem e publicidade. Não recomende aumento de preço quando prejudicar claramente a competitividade.

MENOS VENDIDOS E SEM VENDAS
Analise preço e frete; título; descrição; compatibilidade; fotos; cadastro; estoque; visitas e conversão; perguntas; reclamações; devoluções; envio; reputação e concorrência realmente equivalente.

CONCORRÊNCIA
Compare original somente com original e importado somente com importado. Nunca misture original, importado, equivalente, paralelo, produto incompatível ou kit diferente.

COMPATIBILIDADE
Use somente catálogos autorizados. Nunca deduza aplicações. Sem confirmação, informe: “Não encontrei confirmação segura nos catálogos disponíveis.” Zero resultado é melhor do que aplicação errada. Informe a fonte.

SEGURANÇA
Somente leitura. Não altere preço, conteúdo, estoque, status ou publicidade; não publique, pause, reative, responda clientes, inicie campanhas ou compre. Toda alteração é sugestão sujeita à aprovação. Diferencie fato confirmado, causa provável e sugestão.

PRIORIDADE
Classifique como Urgente, Alta, Média, Baixa ou Oportunidade conforme impacto financeiro, risco técnico, estoque, reputação e potencial comercial.

RESUMO INICIAL
Informe período, total analisado, produtos vendidos e sem vendas, faturamento, campeões, piores, problemas de preço, descrição, compatibilidade, fotos, estoque baixo, valor parado e cinco ações prioritárias.

RELATÓRIO POR ANÚNCIO
Mostre identificação, produto/código, vendas, faturamento, visitas/conversão quando disponíveis, estoque, última venda, problema, evidência, causa provável, correção, impacto esperado, prioridade, aprovação e fonte técnica.

PLANO FINAL
Organize em: corrigir imediatamente; melhorar nesta semana; acompanhar; repor; não comprar; criar kit ou novo anúncio; confirmar tecnicamente; dados insuficientes. Nunca prometa aumento de vendas.`,
    integracao: true,
  },
  {
    id: "analisar-site",
    icone: "🌐",
    titulo: "Analisar meu site",
    descricao: "Revisa 20 produtos, corrige informações e prepara um piloto para o Mercado Livre.",
    objetivo: "Selecionar automaticamente 20 produtos do site, conferir e melhorar seus dados e preparar um lote seguro para exportação ao Mercado Livre.",
    limites: "Somente leitura e preparação. Não alterar o site, estoque ou preços; não enviar ou publicar no Mercado Livre sem aprovação. Compatibilidade somente por catálogos autorizados.",
    formato: "Auditar código, marca, categoria, título, descrição, OEM, atributos, aplicações, preço, estoque e fotos. Mostrar todas as correções em Antes × Depois.",
    saida: "Resumo do site, 20 produtos analisados, correções propostas, itens aprovados ou bloqueados e lote pronto para criação como rascunho após aprovação.",
    campos: [
      ["origem", "Site analisado", "Site próprio"],
      ["quantidade", "Quantidade do teste", "20 produtos"],
      ["destino", "Preparar para", "Mercado Livre"],
    ],
    valoresIniciais: {
      origem: "Site próprio",
      quantidade: "20 produtos",
      destino: "Mercado Livre",
    },
    promptExecutor: `Analise inicialmente 20 produtos escolhidos automaticamente no site. Use somente dados reais das integrações autorizadas.

Confira código, marca, categoria, estoque, preço, título, descrição, OEM, atributos, fotos e aplicações. Corrija título e descrição antes da exportação. Preencha somente dados comprovados.

Verifique toda compatibilidade nos catálogos técnicos autorizados. Se o site estiver errado, prepare a correção e apresente a fonte. Nunca deduza aplicações. Sem confirmação, informe “Não encontrei confirmação segura nos catálogos disponíveis.” e bloqueie o produto para exportação.

Confira o preço mínimo com os custos configurados no PAIIA e sinalize fotos fora do padrão Mercado Livre: 1200 × 1200, fundo branco e peça fiel.

Apresente resumo e comparação Antes × Depois por produto. Não altere o site nem publique. Após aprovação explícita, prepare somente rascunhos no Mercado Livre.`,
    integracao: true,
  },
  {
    id: "concorrencia",
    icone: "📊",
    titulo: "Comparar meus preços com a concorrência",
    descricao: "Compara originais ou importados sem misturar resultados.",
    objetivo: "Comparar os preços dos meus anúncios com concorrentes equivalentes.",
    limites: "Analisar somente a categoria escolhida. Nunca misturar originais e importados. Não alterar preços.",
    formato: "Comparar código, marca, aplicação, condição, preço, frete e reputação do vendedor.",
    saida: "Menor, médio e maior preço, posição do meu anúncio e recomendação comercial.",
    campos: [["categoria", "Categoria obrigatória", ""], ["produto", "Código, produto ou anúncios", "Ex.: 0258003300"], ["marketplace", "Marketplace", "Mercado Livre"]],
    categoria: true,
    integracao: true,
  },
  {
    id: "auditar",
    icone: "🔍",
    titulo: "Encontrar anúncios que precisam melhorar",
    descricao: "Audita título, descrição, fotos, preço, estoque e cadastro.",
    objetivo: "Auditar a qualidade comercial dos anúncios selecionados.",
    limites: "Somente leitura. Compatibilidade apenas com fonte técnica autorizada. Não publicar alterações.",
    formato: "Dar nota por título, descrição, fotos, atributos, preço, estoque e compatibilidade.",
    saida: "Ranking dos anúncios, falhas encontradas e correções sugeridas.",
    campos: [["escopo", "Escopo", "Ex.: meus 10 anúncios mais antigos"]],
    integracao: true,
  },
  {
    id: "compatibilidade",
    icone: "🔧",
    titulo: "Verificar compatibilidade da peça",
    descricao: "Consulta somente catálogos confiáveis já autorizados.",
    objetivo: "Confirmar a aplicação e a compatibilidade da peça informada.",
    limites: "Usar somente catálogos autorizados. Se não houver confirmação, responder não encontrado. Nunca deduzir aplicação.",
    formato: "Cruzar código, OEM, veículo, modelo, motor e ano nas fontes disponíveis.",
    saida: "Aplicações confirmadas, códigos relacionados, fonte e pendências.",
    campos: [["codigo", "Código ou OEM", "Ex.: 0258003300"], ["veiculo", "Veículo, motor e ano (opcional)", "Ex.: Gol 1.6 2012"]],
    destino: "centralPesquisa",
  },
  {
    id: "melhorar-anuncio",
    icone: "📝",
    titulo: "Melhorar títulos e descrições",
    descricao: "Prepara melhorias sem publicar automaticamente.",
    objetivo: "Melhorar títulos e descrições para aumentar clareza e conversão.",
    limites: "Preservar dados técnicos confirmados. Título com até 60 caracteres. Não publicar sem aprovação.",
    formato: "Analisar conteúdo atual, palavras importantes, código, marca e aplicações confirmadas.",
    saida: "Título sugerido, descrição revisada, alterações realizadas e pontos pendentes.",
    campos: [["escopo", "Anúncio ou produto", "Cole o código ou identifique o anúncio"]],
    destino: "novoAnuncio",
  },
  {
    id: "inativos",
    icone: "⏸️",
    titulo: "Encontrar anúncios inativos ou pausados",
    descricao: "Mostra motivo e possibilidade segura de recuperação.",
    objetivo: "Localizar anúncios inativos ou pausados e explicar o motivo.",
    limites: "Não reativar, alterar estoque ou publicar sem aprovação explícita.",
    formato: "Separar por falta de estoque, problema cadastral, decisão comercial ou restrição do marketplace.",
    saida: "Lista de anúncios, motivo, correção necessária e prioridade.",
    campos: [["marketplace", "Marketplace", "Mercado Livre"]],
    integracao: true,
  },
  {
    id: "estoque",
    icone: "📦",
    titulo: "Verificar estoque e necessidade de compra",
    descricao: "Analisa giro, risco de ruptura, excesso e reposição.",
    objetivo: "Identificar faltas, excessos e necessidades de reposição do estoque.",
    limites: "Não realizar compras nem alterar estoque. Recomendações dependem de vendas e saldos reais.",
    formato: "Considerar saldo, vendas por período, giro, cobertura e prazo de reposição.",
    saida: "Comprar, acompanhar ou não comprar, com quantidade sugerida e justificativa.",
    campos: [["periodo", "Período de vendas", "Últimos 90 dias"], ["prazo", "Prazo médio do fornecedor", "Ex.: 30 dias"]],
    integracao: true,
  },
  {
    id: "encalhados",
    icone: "🐢",
    titulo: "Encontrar produtos parados no estoque",
    descricao: "Mostra capital parado e ações para recuperar a venda.",
    objetivo: "Identificar produtos com estoque parado ou giro muito baixo.",
    limites: "Não criar promoções nem reduzir preços automaticamente.",
    formato: "Analisar dias em estoque, última venda, quantidade, custo, margem e procura.",
    saida: "Produtos encalhados, capital parado e plano de ação por item.",
    campos: [["dias", "Considerar parado após", "Ex.: 90 dias"]],
    integracao: true,
  },
  {
    id: "preco",
    icone: "💰",
    titulo: "Calcular preço, margem e lucro",
    descricao: "Considera custos, taxas, frete e margem pretendida.",
    objetivo: "Calcular um preço de venda sustentável e a margem líquida estimada.",
    limites: "Não alterar o preço do anúncio. Usar somente valores informados ou confirmados.",
    formato: "Somar compra, frete, embalagem, despesas, impostos e taxas do canal.",
    saida: "Preço mínimo, recomendado e ideal, margem e composição do custo.",
    campos: [["custo", "Custo da peça", "R$"], ["despesas", "Frete e outras despesas", "R$"], ["margem", "Margem desejada", "Ex.: 15%"]],
    destino: "centralPrecificacao",
  },
  {
    id: "financeiro",
    icone: "🧮",
    titulo: "Revisar vendas, compras e despesas",
    descricao: "Procura erros, duplicidades, perdas e problemas de organização.",
    objetivo: "Revisar a saúde financeira e localizar inconsistências em compras, pagamentos, despesas e recebimentos.",
    limites: "Somente leitura. Não pagar, excluir ou alterar lançamentos. Questões fiscais devem ser confirmadas pelo contador.",
    formato: "Separar compras, fornecedores, despesas, impostos, taxas, fretes, recebimentos e retiradas.",
    saida: "Resumo financeiro, erros prováveis, valor envolvido, correção sugerida e prioridade.",
    campos: [["origem", "Fonte dos dados", "Ex.: planilha ou relatório do marketplace"], ["periodo", "Período", "Mês atual"]],
    integracao: true,
  },
  {
    id: "comecar",
    icone: "🧭",
    titulo: "Não sei por onde começar",
    descricao: "O Paizinho transforma o problema em uma tarefa organizada.",
    objetivo: "Entender a necessidade do usuário e montar a tarefa mais adequada.",
    limites: "Fazer somente perguntas necessárias e não prometer funções indisponíveis.",
    formato: "Identificar problema, dados disponíveis, urgência e resultado esperado.",
    saida: "Contrato da tarefa recomendado para conferência do usuário.",
    campos: [["necessidade", "O que você precisa resolver?", "Conte com suas palavras"], ["resultado", "Qual resultado você espera?", "Ex.: uma lista do que corrigir"]],
  },
];

const SUGESTOES = ["meus-custos", "prioridades", "nao-vende", "analisar-site", "concorrencia", "estoque", "financeiro"];

function lerJson(chave) {
  try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch { return null; }
}

export default function CentralPaizinho({ setScreen }) {
  const contexto = useMemo(() => {
    const anuncio = lerJson("novoAnuncioTemporario") || {};
    return { codigo: anuncio.codigo || "", produto: anuncio.pecaEncontrada?.peca || anuncio.titulo || "", oem: anuncio.oem || "" };
  }, []);
  const [selecionada, setSelecionada] = useState(null);
  const [valores, setValores] = useState({});
  const [etapa, setEtapa] = useState("formulario");
  const [categoria, setCategoria] = useState("");
  const [livre, setLivre] = useState("");
  const [aviso, setAviso] = useState("");
  const [salva, setSalva] = useState(false);

  function escolher(tarefa) {
    if (tarefa?.direto && tarefa?.destino) {
      setScreen(tarefa.destino);
      return;
    }
    setSelecionada(tarefa); setValores(tarefa.valoresIniciais || {}); setCategoria(""); setEtapa("formulario"); setAviso(""); setSalva(false);
    setTimeout(() => document.getElementById("tarefa-paizinho")?.scrollIntoView({ behavior: "smooth" }), 30);
  }

  function montarContrato() {
    if (selecionada.categoria && !categoria) { setAviso("Escolha Original ou Importado para continuar."); return; }
    const obrigatorio = selecionada.campos?.[0];
    if (obrigatorio && !String(valores[obrigatorio[0]] || "").trim() && !["prioridades", "inativos", "estoque", "encalhados"].includes(selecionada.id)) {
      setAviso(`Preencha: ${obrigatorio[1]}.`); return;
    }
    setAviso(""); setEtapa("contrato");
  }

  function salvarTarefa() {
    const tarefa = { id: crypto.randomUUID?.() || String(Date.now()), tipo: selecionada.id, titulo: selecionada.titulo, categoria: categoria || null, dados: valores, contrato: { objetivo: selecionada.objetivo, limites: selecionada.limites, formato: selecionada.formato, saida: selecionada.saida }, promptExecutor: selecionada.promptExecutor || null, status: selecionada.integracao ? "aguardando_integracao" : "pronta", criadoEm: new Date().toISOString() };
    const atuais = lerJson("paizinhoTarefasProntas") || [];
    localStorage.setItem("paizinhoTarefasProntas", JSON.stringify([tarefa, ...atuais]));
    setSalva(true);
  }

  function interpretar() {
    const p = livre.toLowerCase();
    const tarefa = TAREFAS.find((item) =>
      (/(preço|preco|concorr)/.test(p) && item.id === "concorrencia") ||
      (/(finance|despesa|pagamento|compra)/.test(p) && item.id === "financeiro") ||
      (/(estoque|reposição|reposicao)/.test(p) && item.id === "estoque") ||
      (/(não vende|nao vende|venda)/.test(p) && item.id === "nao-vende") ||
      (/(compat|aplica|serve)/.test(p) && item.id === "compatibilidade")
    ) || TAREFAS.find((item) => item.id === "comecar");
    escolher(tarefa);
    setValores({ necessidade: livre });
  }

  return (
    <main style={S.pagina}>
      <button type="button" onClick={() => setScreen("home")} style={S.voltar}>← Voltar</button>
      <header style={S.cabecalho}><div style={S.icone}>👨‍🔧</div><div><h1 style={S.titulo}>Olá! O que posso fazer por você hoje?</h1><p style={S.subtitulo}>Escolha um trabalho pronto. O Paizinho fará somente as perguntas necessárias.</p></div></header>
      {(contexto.codigo || contexto.produto) && <div style={S.contexto}><strong>Dados já encontrados:</strong> {[contexto.produto, contexto.codigo, contexto.oem].filter(Boolean).join(" • ")}. Não serão solicitados novamente.</div>}

      <section style={S.atalhos}>{SUGESTOES.map((id) => { const t = TAREFAS.find((x) => x.id === id); return <button key={id} onClick={() => escolher(t)} style={S.sugestao}>{t.titulo}</button>; })}</section>
      <section style={S.grade}>{TAREFAS.map((t, i) => <button type="button" key={t.id} onClick={() => escolher(t)} style={{...S.cartao, ...(selecionada?.id === t.id ? S.cartaoAtivo : {})}}><span style={S.numero}>{i + 1}</span><span style={S.cartaoIcone}>{t.icone}</span><strong>{t.titulo}</strong><small style={S.descricao}>{t.descricao}</small></button>)}</section>

      <section style={S.livre}><label style={S.label}>Ou escreva com suas palavras<textarea value={livre} onChange={(e) => setLivre(e.target.value)} placeholder="Ex.: descubra onde estou perdendo dinheiro nos meus anúncios" rows={2} style={S.input}/></label><button type="button" onClick={interpretar} style={S.primario}>Preparar tarefa</button></section>

      {selecionada && <section id="tarefa-paizinho" style={S.fluxo}>
        <h2 style={S.fluxoTitulo}>{selecionada.icone} {selecionada.titulo}</h2>
        {aviso && <div style={S.aviso}>{aviso}</div>}
        {etapa === "formulario" ? <>
          <p style={S.ajuda}>Preencha apenas o necessário. Você poderá revisar tudo antes de confirmar.</p>
          {selecionada.categoria && <div style={S.opcoes}><button onClick={() => setCategoria("original")} style={{...S.opcao, ...(categoria === "original" ? S.opcaoAtiva : {})}}>Original</button><button onClick={() => setCategoria("importado")} style={{...S.opcao, ...(categoria === "importado" ? S.opcaoAtiva : {})}}>Importado</button></div>}
          <div style={S.campos}>{selecionada.campos?.map(([id, label, placeholder]) => <label key={id} style={S.label}>{label}<input value={valores[id] || ""} onChange={(e) => setValores({...valores, [id]: e.target.value})} placeholder={placeholder} style={S.input}/></label>)}</div>
          <button type="button" onClick={montarContrato} style={S.primario}>Revisar tarefa</button>
        </> : <>
          <h3 style={S.contratoTitulo}>Contrato da Tarefa</h3>
          <div style={S.contratoGrade}><Bloco titulo="🎯 Objetivo" texto={selecionada.objetivo}/><Bloco titulo="🔒 Limites" texto={selecionada.limites}/><Bloco titulo="📋 Formato" texto={selecionada.formato}/><Bloco titulo="✅ Saída" texto={selecionada.saida}/></div>
          {categoria && <p style={S.categoria}><strong>Categoria:</strong> {categoria === "original" ? "Peças originais" : "Peças importadas"} — resultados não serão misturados.</p>}
          {Object.values(valores).some(Boolean) && <div style={S.dados}><strong>Dados fornecidos:</strong>{Object.entries(valores).filter(([,v]) => v).map(([k,v]) => <div key={k}>{k}: {v}</div>)}</div>}
          {salva ? <div style={S.sucesso}><strong>Tarefa preparada e salva.</strong><p>{selecionada.integracao ? "A execução será liberada quando o Paizinho Executor e o marketplace estiverem conectados. Nenhum resultado foi simulado." : "A tarefa está pronta para seguir para o módulo correspondente."}</p>{selecionada.destino && <button onClick={() => setScreen(selecionada.destino)} style={S.primario}>Continuar para o módulo</button>}</div> : <div style={S.acoes}><button onClick={() => setEtapa("formulario")} style={S.secundario}>Editar solicitação</button><button onClick={salvarTarefa} style={S.primario}>Confirmar tarefa</button></div>}
        </>}
      </section>}
    </main>
  );
}

function Bloco({ titulo, texto }) { return <article style={S.bloco}><strong>{titulo}</strong><p>{texto}</p></article>; }

const S = {
  pagina:{width:"min(1180px,calc(100% - 24px))",margin:"42px auto",color:"#e2e8f0"}, voltar:{border:"1px solid #334155",background:"#0f172a",color:"#cbd5e1",borderRadius:10,padding:"9px 14px",cursor:"pointer",marginBottom:16}, cabecalho:{display:"flex",gap:16,alignItems:"center",padding:24,borderRadius:20,border:"1px solid #155e75",background:"linear-gradient(135deg,#020617,#0c2547)"}, icone:{width:62,height:62,display:"grid",placeItems:"center",borderRadius:18,background:"rgba(103,232,249,.12)",fontSize:34,flexShrink:0}, titulo:{margin:0,color:"#67e8f9",fontSize:"clamp(22px,4vw,34px)"}, subtitulo:{margin:"7px 0 0",color:"#cbd5e1"}, contexto:{marginTop:14,padding:"12px 15px",border:"1px solid rgba(103,232,249,.3)",borderRadius:12,background:"rgba(8,145,178,.09)",color:"#bae6fd"}, atalhos:{display:"flex",gap:8,flexWrap:"wrap",marginTop:18}, sugestao:{border:"1px solid #155e75",background:"rgba(8,145,178,.1)",color:"#a5f3fc",borderRadius:999,padding:"8px 11px",cursor:"pointer",fontWeight:700}, grade:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,260px),1fr))",gap:13,marginTop:16}, cartao:{minHeight:145,position:"relative",display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8,padding:17,border:"1px solid #334155",borderRadius:15,background:"linear-gradient(145deg,#0f172a,#111c31)",color:"#e2e8f0",textAlign:"left",cursor:"pointer"}, cartaoAtivo:{border:"1px solid #67e8f9",boxShadow:"0 0 0 2px rgba(103,232,249,.12)"}, numero:{position:"absolute",right:11,top:9,color:"#64748b",fontSize:11}, cartaoIcone:{fontSize:25}, descricao:{color:"#94a3b8",lineHeight:1.4,fontWeight:500}, livre:{display:"flex",alignItems:"end",gap:12,flexWrap:"wrap",marginTop:22,padding:18,border:"1px solid #334155",borderRadius:16,background:"#0f172a"}, fluxo:{scrollMarginTop:18,marginTop:22,padding:"clamp(17px,3vw,28px)",border:"1px solid #155e75",borderRadius:18,background:"linear-gradient(145deg,#071326,#0f172a)"}, fluxoTitulo:{margin:"0 0 14px",color:"#67e8f9"}, ajuda:{color:"#cbd5e1"}, campos:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:12,margin:"15px 0"}, label:{display:"flex",flexDirection:"column",gap:6,color:"#cbd5e1",fontSize:13,fontWeight:700,flex:"1 1 520px"}, input:{width:"100%",boxSizing:"border-box",border:"1px solid #475569",borderRadius:10,background:"#020617",color:"#f8fafc",padding:"11px 12px",font:"inherit",resize:"vertical"}, primario:{border:"1px solid #22d3ee",borderRadius:11,background:"linear-gradient(135deg,#0369a1,#0891b2)",color:"white",padding:"12px 17px",fontWeight:900,cursor:"pointer"}, secundario:{border:"1px solid #64748b",borderRadius:11,background:"#0f172a",color:"#e2e8f0",padding:"12px 17px",fontWeight:800,cursor:"pointer"}, opcoes:{display:"flex",gap:10,flexWrap:"wrap",margin:"13px 0"}, opcao:{border:"1px solid #475569",borderRadius:11,background:"#020617",color:"#e2e8f0",padding:"11px 18px",fontWeight:800,cursor:"pointer"}, opcaoAtiva:{borderColor:"#67e8f9",background:"rgba(8,145,178,.24)",color:"#cffafe"}, aviso:{padding:12,border:"1px solid #f59e0b",borderRadius:10,background:"rgba(245,158,11,.1)",color:"#fde68a"}, contratoTitulo:{color:"#f8fafc",marginTop:4}, contratoGrade:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:12}, bloco:{padding:16,border:"1px solid #334155",borderRadius:13,background:"#020617",lineHeight:1.5}, categoria:{padding:12,borderRadius:10,background:"rgba(8,145,178,.12)",color:"#cffafe"}, dados:{padding:14,border:"1px dashed #475569",borderRadius:12,color:"#cbd5e1",lineHeight:1.6}, acoes:{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}, sucesso:{marginTop:18,padding:16,border:"1px solid #16a34a",borderRadius:12,background:"rgba(22,163,74,.1)",color:"#dcfce7"}
};
