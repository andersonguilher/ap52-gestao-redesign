/* AP5.2 6.6G.4E-A — Tela única, somente leitura de dados; versão 65.42.156.4.12.5.4.9 R2 (Frente 2: ruas com serviço nas planilhas em verde, aviso "conferir" no pedido a fazer, legenda do cinza;
 * R3: pedidos e serviços separados (a soma dos botões fecha).
 * R4: verde só no quarteirão do serviço (número da planilha × faixa de numeração do catálogo); verde também na rua pesquisada;
 *     frase-resumo no topo (serviços feitos e pedidos); botão "Serviços no mapa" liga e desliga o verde).
 * Base: 65.42.156.4.12.5.4.8 R3 (permissões por coluna, desempenho do modo rua, filtro preciso).
 * Preserva as telas internas de cadastro, serviços, casos e histórico e as abre por contexto.
 * NÃO gera coordenadas fictícias, NÃO altera status, NÃO vincula casos, NÃO executa UPDATE.
 */
'use strict';
(function(){
  const PREFIX='ap52u';
  const LIMITE_BUSCA=150;
  const MAX_PONTOS=6000;
  const MAX_RUA=200;
  const ABERTOS=new Set(['recebida','em_triagem','vinculada_a_caso','aguardando_resposta']);
  const EM_EXECUCAO=new Set(['a_programar','programado','em_execucao','aguardando_terceiro']);
  const CASOS_ABERTOS=new Set(['novo','a_vistoriar','vistoriado']);
  const CASO_STATUS={novo:'Novo',a_vistoriar:'A vistoriar',vistoriado:'Vistoriado',a_programar:'A programar',programado:'Programado',em_execucao:'Em execução',aguardando_terceiro:'Aguardando terceiro',concluido:'Concluído',cancelado:'Cancelado',sem_possibilidade_de_atendimento:'Sem possibilidade de atendimento'};
  const s={ativo:false,geracao:null,consulta:0,consultaPontos:0,visao:'all',pontos:[],semPonto:0,totais:{d:0,c:0},
    encontrados:[],execucoes:[],totalExecucoes:null,casos:[],termo:'',rua:null,catalogo:null,carregandoCatalogo:null,
    mapa:null,camada:null,linha:null,raio:null,centro:null,raioKm:1,pontoSelecionado:null,
    modo:'inicio',fallback:false,erro:null,cacheMapa:null,iconeCache:new Map(),catalogoIcones:null,
    modoRua:false,visaoAntes:null,mapaAntes:null,telaCheia:false,escolhaBairro:null,paginaBairros:0,similares:0,
    filtros:new Set(),origemId:'',origens:[],origensCarregadas:false,origensCarregando:false,origensErro:false,seqOrigens:0,seqOrigemTotal:0,origemTotal:null,origemPedidos:null,origemPedidosErro:false,origemPedidosSeq:0,origemPagina:0,origemHistoricoChaves:new Set(),vinculosExec:new Map(),vinculosCaso:new Map(),vinculosIndisponiveis:false,casoVinculosIndisponiveis:false,luzLigada:true,visaoCheia:null,
    // Ruas com serviço nas planilhas (servicos_executados). Só leitura; nada é vinculado nem gravado.
    ruas:{servicos:null,erro:false,carregando:false,porRua:new Map(),depois:new Map(),semTracado:[],memo:new Map(),memoRef:null,periodo:365,camada:null,camadaRua:null,camadaOrigem:null,chaveRua:null,renderer:null,visiveis:0,semItens:[],itens:[],blocos:new Map(),totalRuas:0,servPeriodo:0,servNoMapa:0,blocosPeriodo:0,ligadas:true},abertos:null};
  // Formas extraídas da referência icones-mapa-ap52.html, validada pela Frente 2.
  const SVG={
    tb:'<path d="M5 15c0-3 3-6 7-6s7 3 7 6"/><path d="M3 18h18"/><path d="M9 13l1.5 2M13 12l-.5 3M16 14l-1.5 1.5"/>',
    recap:'<circle cx="7.5" cy="15.5" r="3.5"/><path d="M11 15.5h7.5V10H13l-2 3"/><path d="M15.5 10V7.5h3"/>',
    quebra:'<path d="M3 17h4c1.5 0 2-5 5-5s3.5 5 5 5h4"/>',
    escav:'<path d="M3 18h11"/><rect x="4" y="13" width="7" height="4" rx="1"/><path d="M9 13V9.5l5-3 4 4"/><path d="M18 10.5l2.5 2.5-2.5 2"/>',
    ralo:'<rect x="4.5" y="6.5" width="15" height="11" rx="1.5"/><path d="M8.5 6.5v11M12 6.5v11M15.5 6.5v11"/>',
    tampao:'<circle cx="12" cy="12" r="7.5"/><path d="M7 9.5h10M6 12.5h12M7.5 15.5h9"/>',
    limpeza:'<path d="M12 4.5c3 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 2-5 5-9z"/><path d="M10 14.5a2 2 0 0 0 2 2"/>',
    relevagem:'<rect x="4" y="5" width="7" height="6" rx="1"/><rect x="13" y="5" width="7" height="6" rx="1"/><rect x="7.5" y="13" width="7" height="6" rx="1"/>',
    passeio:'<circle cx="12" cy="5.5" r="1.8"/><path d="M12 8v5l-2.5 5M12 13l2.5 5M9 10.5l3-1.5 3 1.5"/>',
    ponto:'<circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  };
  const SVG_NITIDO={
    tb:'<path d="M5.2 9.2 7.8 6.4l2.4 1.5 2.5-2.2 2.5 2 2.9-.7 1.1 3.3-1.5 2.1 1 2.6-3.1 1.6-2.5-1.3-2.5 1.6-3.1-1-1-2.7-1.6-2.2z" fill="#fff" stroke="none"/><path d="M3 20.4h4.2M9.9 20.4h4.2M16.8 20.4H21"/>',
    recap:'<circle cx="8" cy="15.2" r="4.4"/><circle cx="8" cy="15.2" r="1.3" fill="#fff" stroke="none"/><rect x="12.6" y="8.2" width="8" height="8.6" rx="1.6" fill="#fff" stroke="none"/><path d="M14.2 8.2V4.6h5.2"/><path d="M12.6 12.4H10"/>',
    quebra:'<path d="M5 18.2c2.4 0 3.2-7.4 7-7.4s4.6 7.4 7 7.4z" fill="#fff" stroke="none"/><path d="M9.8 14.6l1-2.4M13.4 12.2l1 2.4" style="stroke:var(--c)" stroke-width="1.6"/><path d="M2.5 18.4h19"/>',
    escav:'<rect x="2.6" y="16.4" width="11" height="4.2" rx="2.1" fill="#fff" stroke="none"/><rect x="4.2" y="10.4" width="7" height="5.2" rx="1.1" fill="#fff" stroke="none"/><path d="M10.6 12.2 15.4 6.8l4 3.4"/><path d="M17.6 10.6l3.8-.6-1 4.6z" fill="#fff"/>',
    ralo:'<rect x="3.8" y="5.2" width="16.4" height="13.6" rx="2"/><path d="M8.5 5.4v13.2M12 5.4v13.2M15.5 5.4v13.2" stroke-width="2.2"/>',
    tampao:'<circle cx="12" cy="12" r="8.6" fill="#fff" stroke="none"/><path d="M7.4 9.6h9.2M6.6 12h10.8M7.4 14.4h9.2" style="stroke:var(--c)" stroke-width="1.7"/>',
    limpeza:'<path d="M12 3.2c3.7 4.7 6.2 7.8 6.2 10.7a6.2 6.2 0 0 1-12.4 0c0-2.9 2.5-6 6.2-10.7z" fill="#fff" stroke="none"/><path d="M9.3 14.4a2.8 2.8 0 0 0 2.7 2.8" style="stroke:var(--c)" stroke-width="1.7"/>',
    relevagem:'<rect x="3.6" y="4.6" width="7.6" height="6.4" rx="1.2" fill="#fff" stroke="none"/><rect x="12.8" y="4.6" width="7.6" height="6.4" rx="1.2" fill="#fff" stroke="none"/><rect x="8.2" y="13" width="7.6" height="6.4" rx="1.2" fill="#fff" stroke="none"/>',
    ponto:'<circle cx="12" cy="12" r="3.6" fill="#fff" stroke="none"/>'
  };
  const GRUPO_SERVICO={
    tapa_buraco:'tb',recapeamento:'recap',implantacao_quebra_molas:'quebra',relevagem:'relevagem',
    recuperacao_gap:'escav',reconstrucao_gap:'escav',construcao_gap:'escav',
    construcao_caixa_ralo:'ralo',reconstrucao_caixa_ralo:'ralo',construcao_boca_lobo:'ralo',
    reconstrucao_boca_lobo:'ralo',reposicao_grelha_concreto:'ralo',reposicao_grelha_ferro:'ralo',
    reconstrucao_grelha_concreto:'ralo',nivelamento_grelha:'ralo',construcao_ramal_ralo:'ralo',
    recuperacao_ramal_ralo:'ralo',reconstrucao_ramal_ralo:'ralo',
    construcao_pv:'tampao',reconstrucao_pv:'tampao',reposicao_tampao_concreto:'tampao',
    reposicao_tampao_ferro:'tampao',reconstrucao_tampao_concreto:'tampao',nivelamento_tampao:'tampao',
    limpeza_manual:'limpeza',limpeza_mecanica:'limpeza',sondagem:'ponto',preparo_solo:'ponto'
    // Passeios não possui serviço aprovado no catálogo; SVG 'passeio' fica reservado.
  };
  const URGENCIA={alert:0,working:1,informed:2,neutral:3};
  const by=id=>document.getElementById(PREFIX+'-'+id);
  const norm=v=>typeof normalizarTextoBuscaMapa==='function'?normalizarTextoBuscaMapa(String(v||'')):String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const safe=v=>typeof dem52Texto==='function'?dem52Texto(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const localData=v=>typeof dem52Data==='function'?dem52Data(v):String(v??'');
  const valido=(id,g)=>id===s.consulta&&g===ac28Generation&&!!dem52Pode();
  const validoPontos=(id,g)=>id===s.consultaPontos&&g===ac28Generation&&!!dem52Pode();
  const coords=r=>Number.isFinite(Number(r?.latitude))&&Number.isFinite(Number(r?.longitude))&&r.latitude!==null&&r.longitude!==null&&Math.abs(Number(r.latitude))<=90&&Math.abs(Number(r.longitude))<=180;
  const podeVer=()=>typeof dem52Pode==='function'&&dem52Pode();
  function escopo(q){if(!dem52Global()&&acesso28?.user?.gerencia)q=q.eq('gerencia',acesso28.user.gerencia);return q;}
  function avisar(txt,erro=false){const n=by('aviso');n.textContent=txt||'';n.hidden=!txt;n.dataset.erro=erro?'true':'false';}
  function atualizarTopo(){by('escopo').textContent=dem52Escopo();const b=by('adicionar');b.disabled=!dem52PodeCadastrar();b.title=b.disabled?'Seu perfil não permite cadastrar demandas.':'Registrar uma solicitação';}
  // Origem = campo origem_id de demandas; 1746 é o nome oficial do canal Ouvidoria.
  const rotuloOrigem=nome=>String(nome||'')==='1746'?'Ouvidoria (1746)':String(nome||'Origem não informada');
  function nomeOrigemId(id){return rotuloOrigem(s.origens.find(x=>String(x.id)===String(id||''))?.nome||(id?'Origem cadastrada':'Origem não informada'));}
  function nomeOrigem(){return nomeOrigemId(s.origemId);}
  function filtroOrigemPonto(p){return !s.origemId||(p.tipo==='d'&&String(p.row.origem_id||'')===s.origemId);}
  function pontosDaOrigem(){return (s.modoRua?totalPontosRua():s.pontos).filter(filtroOrigemPonto);}
  async function carregarOrigens(forcar=false){
    if(!podeVer()||s.origensCarregando||(s.origensCarregadas&&!forcar))return;
    const combo=by('origem');if(!combo)return;const seq=++s.seqOrigens;s.origensCarregando=true;
    try{
      const r=await sb.from('demanda_origens').select('id,nome,ativo',{count:'exact'}).is('deleted_at',null).order('nome').range(0,499);
      if(seq!==s.seqOrigens||!s.ativo)return;
      if(r.error||!Number.isSafeInteger(r.count)||r.count>(r.data||[]).length)throw Error('Catálogo de origens indisponível ou incompleto');
      s.origens=r.data||[];s.origensErro=false;s.origensCarregadas=true;
      const anterior=s.origemId;combo.replaceChildren(new Option('Todas as origens',''));
      const lista=[...s.origens].sort((a,b)=>rotuloOrigem(a.nome).localeCompare(rotuloOrigem(b.nome),'pt-BR'));
      for(const o of lista)combo.add(new Option(rotuloOrigem(o.nome),String(o.id)));
      if(anterior&&!lista.some(o=>String(o.id)===anterior))combo.add(new Option('Origem selecionada (indisponível)',anterior));
      combo.value=anterior;combo.disabled=false;atualizarNotaOrigem();
    }catch(e){if(seq===s.seqOrigens){s.origensErro=true;combo.disabled=!s.origensCarregadas;by('origem-nota').textContent='Não foi possível carregar as origens. Use Atualizar para tentar novamente.';console.warn('[AP52/Origem] Catálogo não disponível:',e?.message||'erro');}}
    finally{if(seq===s.seqOrigens)s.origensCarregando=false;}
  }
  function atualizarNotaOrigem(){const n=by('origem-nota');if(!n)return;
    n.textContent=s.origemId?'Pedidos de '+nomeOrigem()+'. Os traçados verdes podem mostrar serviços registrados na mesma rua, mas NÃO confirmam que atenderam a esses pedidos.':'Selecione a origem dos pedidos. Serviços históricos são exibidos separadamente.';
    by('origem-limpar').hidden=!s.origemId;
  }
  async function contarOrigem(){
    const origem=s.origemId,seq=++s.seqOrigemTotal;
    if(!origem){s.origemTotal=null;atualizarResumoGeral();atualizarBarraMapa();return;}
    s.origemTotal={id:origem,carregando:true};atualizarResumoGeral();atualizarBarraMapa();
    try{
      const base=()=>escopo(sb.from('demandas').select('id',{count:'exact',head:true}).is('deleted_at',null).eq('origem_id',origem));
      const [todos,abertos]=await Promise.all([base(),base().in('status',[...ABERTOS])]);
      if(seq!==s.seqOrigemTotal||origem!==s.origemId||!s.ativo)return;
      s.origemTotal={id:origem,total:!todos.error&&Number.isSafeInteger(todos.count)?todos.count:null,abertos:!abertos.error&&Number.isSafeInteger(abertos.count)?abertos.count:null};
    }catch(e){if(seq===s.seqOrigemTotal)s.origemTotal={id:origem,total:null,abertos:null};}
    if(seq===s.seqOrigemTotal){atualizarResumoGeral();atualizarBarraMapa();}
  }
  // R2.6: origem dos pedidos é dado da demanda. Histórico na mesma rua NÃO é serviço vinculado.
  function statusPedidoOrigem(v){const t=String(v||'');return ({recebida:'Recebida',em_triagem:'Em triagem',vinculada_a_caso:'Vinculada a caso',aguardando_resposta:'Aguardando resposta',respondida:'Respondida',encerrada:'Encerrada',fora_da_competencia:'Fora da competência',duplicada:'Duplicada'})[t]||t.replace(/_/g,' ')||'Não informado';}
  // R28: prazo administrativo de resposta da Ouvidoria, independente da execução do serviço.
  const OUVIDORIA_ID='0a9142c9-dfff-4908-9f2b-f70dc373c21c';
  const PRAZO_ENCERRADOS=new Set(['respondida','encerrada','fora_da_competencia','duplicada']);
  function dataPrazo(valor){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor||''));if(!m)return null;
    const y=Number(m[1]),mes=Number(m[2]),dia=Number(m[3]);
    const data=new Date(Date.UTC(y,mes-1,dia));
    return data.getUTCFullYear()===y&&data.getUTCMonth()===mes-1&&data.getUTCDate()===dia?data:null;
  }
  function diaSaoPaulo(){
    const partes=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const p=Object.fromEntries(partes.map(x=>[x.type,x.value]));
    return Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
  }
  function prazoResposta(d){
    if(String(d?.origem_id||'')!==OUVIDORIA_ID)return null;
    const data=dataPrazo(d.prazo);if(!data)return null;
    const dataTexto=String(d.prazo).slice(8,10)+'/'+String(d.prazo).slice(5,7)+'/'+String(d.prazo).slice(0,4);
    if(PRAZO_ENCERRADOS.has(String(d.status||'')))return {dataTexto,indicador:'',classe:'finalizado',finalizado:true};
    const dias=Math.round((data.getTime()-diaSaoPaulo())/86400000);
    const indicador=dias<0?`Vencido há ${-dias} ${-dias===1?'dia':'dias'}`:dias===0?'Vence hoje':dias===1?'Vence amanhã':`Faltam ${dias} dias`;
    return {dataTexto,indicador,classe:dias<0?'vencido':dias<=1?'proximo':'normal',finalizado:false};
  }
  function htmlPrazoResposta(d){
    const p=prazoResposta(d);if(!p)return '';
    return `<span class="ap52u-prazo ap52u-prazo-${p.classe}"><span>${p.finalizado?'Prazo de resposta':'Responder até'} <b>${safe(p.dataTexto)}</b></span>${p.indicador?`<em>${safe(p.indicador)}</em>`:''}</span>`;
  }
  function origemSemLocalizacao(){
    return (s.origemPedidos||[]).filter(x=>!coords(x)).sort((a,b)=>{
      const pa=dataPrazo(a.prazo),pb=dataPrazo(b.prazo);
      return (pa?pa.getTime():Infinity)-(pb?pb.getTime():Infinity)||String(a.id).localeCompare(String(b.id));
    });
  }
  function chavesHistoricasOrigem(){const conjunto=new Set();
    if(!s.catalogo||!s.origemPedidos)return conjunto;
    for(const d of s.origemPedidos){const r=resolverRegistroRua(d.logradouro,d.bairro);
      if(r&&d.gerencia)conjunto.add(String(d.gerencia)+'|rua:'+r.rua);}
    return conjunto;
  }
  function atualizarPedidosOrigem(){
    const b=by('sem-localizar');if(!b)return;
    b.hidden=!s.origemId;
    const n=by('n-sem-localizar');
    n.textContent=!s.origemId?'0':s.origemPedidosErro?'Erro':s.origemPedidos?String(origemSemLocalizacao().length):'…';
    b.disabled=!!s.origemId&&!s.origemPedidos;
    b.title='Consultar pedidos desta origem que ainda não possuem coordenadas verificadas';
    if(by('origem-dialog')?.open)renderListaPedidosOrigem();
  }
  function renderListaPedidosOrigem(){
    const div=by('dialog-lista'),nota=by('dialog-nota');if(!div||!nota)return;
    const lista=origemSemLocalizacao(),n=lista.length,por=20,total=Math.max(1,Math.ceil(n/por));
    s.origemPagina=Math.min(Math.max(s.origemPagina,0),total-1);
    nota.textContent=s.origemPedidosErro?'Não foi possível carregar os registros da origem. Use Atualizar e tente novamente.':
      !s.origemPedidos?'Consultando solicitações…':`${n} pedido(s) de ${nomeOrigem()} sem coordenadas. Lista para conferência; nenhum endereço é geolocalizado automaticamente.`;
    const fatia=lista.slice(s.origemPagina*por,(s.origemPagina+1)*por);
    div.innerHTML=fatia.map(d=>`<article class="ap52u-pedido-local"><strong>${safe(d.logradouro||'Logradouro não informado')}${d.numero?' · nº '+safe(d.numero):''}</strong><small>${safe(d.bairro||'Bairro não informado')} · ${safe(d.gerencia||'Gerência não informada')}</small><small>Protocolo: ${safe(d.protocolo||'Não informado')} · Situação: ${safe(statusPedidoOrigem(d.status))}</small>${htmlPrazoResposta(d)}<button type="button" data-u-local-demanda="${safe(d.id)}">Ver pedido</button></article>`).join('')||'<p>Nenhum pedido sem coordenadas encontrado nesta origem.</p>';
    by('dialog-pagina').textContent=`Página ${s.origemPagina+1} de ${total}`;
    by('dialog-anterior').disabled=s.origemPagina<=0;
    by('dialog-proximo').disabled=s.origemPagina>=total-1;
  }
  async function carregarPedidosOrigem(){
    const origem=s.origemId,seq=++s.origemPedidosSeq;s.origemPedidos=null;s.origemPedidosErro=false;atualizarPedidosOrigem();
    if(!origem){atualizarResumoRuas();atualizarRuasVisiveis();return;}
    try{
      const todos=[];let total=null;
      for(let i=0;i<5000;i+=400){
        const q=escopo(sb.from('demandas').select('id,gerencia,logradouro,logradouro_normalizado,numero,bairro,protocolo,status,prazo,latitude,longitude,origem_id',{count:'exact'}).is('deleted_at',null).eq('origem_id',origem)).order('id').range(i,i+399);
        const r=await q;if(seq!==s.origemPedidosSeq||s.origemId!==origem||!s.ativo)return;
        if(r.error||!Number.isSafeInteger(r.count))throw Error('Consulta incompleta das demandas por origem');
        total=r.count;todos.push(...(r.data||[]));
        if(todos.length>=total)break;
        if(!(r.data||[]).length)throw Error('Paginação incompleta');
      }
      if(total===null||todos.length!==total)throw Error('Limite ou paginação incompleta');
      if(!s.catalogo)await carregarCatalogo();
      if(seq!==s.origemPedidosSeq||s.origemId!==origem||!s.ativo)return;
      s.origemPedidos=todos;s.origemHistoricoChaves=chavesHistoricasOrigem();
    }catch(e){if(seq!==s.origemPedidosSeq||s.origemId!==origem||!s.ativo)return;
      s.origemPedidosErro=true;console.warn('[AP52/R2.6] Não foi possível consultar a origem:',e?.message||'erro');}
    atualizarPedidosOrigem();atualizarRuasVisiveis();atualizarResumoRuas();renderContagens();
  }
  function definirOrigem(valor,{sincronizar=true}={}){
    const v=String(valor||'');if(v===s.origemId)return;
    s.origemId=v;s.origemPedidos=null;s.origemHistoricoChaves=new Set();s.origemPagina=0;++s.origemPedidosSeq;const combo=by('origem');if(combo&&[...combo.options].some(o=>o.value===v))combo.value=v;
    s.pontoSelecionado=null;s.centro=null;removerRaio();s.mapa?.closePopup?.();
    atualizarNotaOrigem();renderContagens();filtrarPontos();atualizarRuasVisiveis();atualizarBarraMapa();atualizarResumoRuas();void contarOrigem();
    if(s.termo)void pesquisar({preservarPonto:true,bairroEscolhido:s.escolhaBairro});
    void carregarPedidosOrigem();
    if(sincronizar)window.AP52Consolidado?.definirOrigem?.(v);
  }
  function modo(m){s.modo=m;const view=document.getElementById('view-demandas');view.dataset.ap52uModo=m;
    // 10.4.3: na ficha já existe "Voltar à lista" no cabeçalho.
    // Não manter outro botão flutuante por cima das ações e observações.
    by('retorno').hidden=['inicio','demanda','cadastro'].includes(m);if(m==='inicio'){
      if(dem52Cadastro?.aberto){return;}
      // As seções internas continuam montadas, sem retirar listeners nem dados.
      if(dem52c?.aba==='historico'||dem52c?.aba==='casos'){
        dem52c.aba='demandas';dem52c.modo=null;dem52cSincronizar();
      }
      by('busca').focus({preventScroll:true});
    } else if(m==='demanda')dem52El('fechar')?.focus({preventScroll:true});
    else if(m!=='cadastro')by('retorno').focus({preventScroll:true});
  }
  async function voltar(){
    if(s.modo==='cadastro'&&dem52Cadastro?.aberto){await cancelarCadastroDemandaAP52();if(dem52Cadastro.aberto)return;}
    if((s.modo==='caso'||s.modo==='historico')&&dem52c?.form&&!await dem52cPodeDescartar())return;
    if(dem52c?.form)dem52cFecharForm();modo('inicio');
    by('mapa')?.closest('.ap52u-palco')?.scrollIntoView?.({block:'nearest'});
  }
  function monta(){
    const view=document.getElementById('view-demandas');if(!view||by('painel'))return;
    view.classList.add('ap52u-ativo');view.dataset.ap52uModo='inicio';
    const sec=document.createElement('section');sec.id=PREFIX+'-painel';sec.className=PREFIX+'-painel';sec.setAttribute('aria-label','Central de Demandas — busca e mapa');
    sec.innerHTML=`<header class="ap52u-topo"><div><span class="ap52u-kicker">Coordenação de Conservação</span><h1>Central de Demandas</h1><p id="ap52u-escopo">AP5.2</p></div><button type="button" id="ap52u-adicionar" class="ap52u-primario">+ Adicionar demanda</button></header>
    <form id="ap52u-form" class="ap52u-pesquisar" role="search" aria-label="Procurar um logradouro"><label for="ap52u-busca">Procurar um logradouro, protocolo ou código histórico</label><div class="ap52u-busca-linha"><input id="ap52u-busca" type="search" autocomplete="off" maxlength="150" placeholder="Ex.: Avenida Glicina ou D21-PRE-0002" list="ap52u-sugestoes"><datalist id="ap52u-sugestoes"></datalist><button type="submit" id="ap52u-buscar" aria-label="Buscar logradouro">Buscar</button><button type="button" id="ap52u-consolidado" class="ap52u-consolidado-abrir" aria-label="Abrir consolidado da gerência" title="Consolidado">▦ Consolidado</button></div></form>

    <p class="ap52u-guia">Procure pela rua. Cada marca no mapa representa um local informado; toque nela para ver quem pediu, quando, o quê e o que já foi registrado. <strong>Pedido respondido não significa serviço executado.</strong></p>
    <p id="ap52u-resumo-geral" class="ap52u-resumo-geral" aria-live="polite" hidden></p>
    <div id="ap52u-aviso" class="ap52u-aviso" role="status" hidden></div>
    <nav id="ap52u-contagens" class="ap52u-contagens" aria-label="Filtrar os pontos no mapa">
      <button type="button" data-u-filtro="all" aria-pressed="true">Tudo no mapa <b id="ap52u-n-all">0</b></button>
      <div class="ap52u-origem-bar" role="group" aria-label="Filtrar pedidos por origem"><label for="ap52u-origem">Origem <select id="ap52u-origem" disabled><option value="">Carregando origens…</option></select></label><button id="ap52u-origem-limpar" type="button" hidden>Limpar</button><small id="ap52u-origem-nota" role="status">Pedidos por origem; serviços históricos são registros distintos.</small></div>
      <button type="button" id="ap52u-sem-localizar" class="ap52u-sem-localizar" hidden>Sem localização <b id="ap52u-n-sem-localizar">0</b></button>
      <button type="button" data-u-filtro="alert" aria-pressed="false">A fazer <b id="ap52u-n-alert">0</b></button>
      <button type="button" data-u-filtro="working" aria-pressed="false">Em execução <b id="ap52u-n-working">0</b></button>
      <button type="button" data-u-filtro="informed" aria-pressed="false">Executados <b id="ap52u-n-informed">0</b></button>
      <button type="button" data-u-filtro="neutral" aria-pressed="false">Outras situações <b id="ap52u-n-neutral">0</b></button>
      <button type="button" id="ap52u-ruas-pill" class="ap52u-ruas-pill" aria-pressed="true" hidden title="Mostrar ou esconder no mapa os quarteirões com serviço feito"><i class="ap52u-simbolo ap52u-simbolo-rua" aria-hidden="true"></i><span id="ap52u-rotulo-ruas">Serviços no mapa</span><b id="ap52u-n-historicos-origem" hidden></b></button>
      <button type="button" id="ap52u-servicos-pill" class="ap52u-servicos-pill" hidden>Serviços feitos nesta rua <b id="ap52u-n-servicos">0</b></button>
    </nav>
    <dialog id="ap52u-origem-dialog" class="ap52u-origem-dialog" aria-labelledby="ap52u-dialog-title"><div class="ap52u-dialog-head"><h2 id="ap52u-dialog-title">Pedidos sem coordenadas</h2><button id="ap52u-dialog-fechar" type="button" aria-label="Fechar lista">Fechar</button></div><p id="ap52u-dialog-nota" role="status"></p><div id="ap52u-dialog-lista" class="ap52u-dialog-lista"></div><div class="ap52u-dialog-paginacao"><button type="button" id="ap52u-dialog-anterior">Anterior</button><span id="ap52u-dialog-pagina"></span><button type="button" id="ap52u-dialog-proximo">Próxima</button></div></dialog>
    <div class="ap52u-palco"><div class="ap52u-mapa-wrap" data-mobile-filtros="fechado"><div id="ap52u-mapa" role="application" aria-label="Mapa de logradouros e registros com localização confirmada"></div>
      <button id="ap52u-filtros-toggle" class="ap52u-filtros-toggle" type="button" aria-label="Filtros do mapa" title="Filtros do mapa" aria-controls="ap52u-mobile-filtros-painel" aria-expanded="false"><svg class="ap52u-acao-icone ap52u-icone-filtro" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6.5 7.3v5.2l-3 1.5v-6.7z"/></svg><span class="ap52u-filtros-rotulo">Filtros do mapa</span><span class="ap52u-filtros-seta" aria-hidden="true">▾</span></button>
      <div class="ap52u-mapa-topo"><span id="ap52u-controle-local">Carregando pontos com coordenadas…</span><button id="ap52u-ver-tudo" type="button" title="Ver todas as ruas da AP5.2" aria-label="Ver todas as ruas da AP5.2" hidden><svg class="ap52u-acao-icone ap52u-icone-visao-geral" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><path d="m6.2 12.5 2.3 2.3 4.1-4.1"/></svg><span class="ap52u-ver-tudo-rotulo">Ver toda a AP5.2</span></button><button id="ap52u-atualizar" type="button" title="Atualizar registros">Atualizar</button><button id="ap52u-tela-cheia" type="button" aria-label="Tela cheia" title="Tela cheia"><span class="ap52u-full-icone" aria-hidden="true">⛶</span><span class="ap52u-full-texto">Tela cheia</span></button></div>
      <button id="ap52u-ver-detalhes" class="ap52u-ver-detalhes" type="button" hidden>Ver detalhes</button>
      <div id="ap52u-mapa-fallback" class="ap52u-mapa-fallback" hidden>O mapa não pôde carregar. Você ainda pode pesquisar ruas e abrir os registros na lista.</div>
      <div class="ap52u-legenda" aria-label="Legenda do mapa" data-aberta="false"><button id="ap52u-legenda-toggle" type="button" aria-expanded="false" aria-controls="ap52u-legenda-itens">Entenda as marcas</button><div id="ap52u-legenda-itens" class="ap52u-legenda-itens"><span><i class="ap52u-simbolo ap52u-simbolo-alert"></i> A fazer</span><span><i class="ap52u-simbolo ap52u-simbolo-working"></i> Em execução</span><span><i class="ap52u-simbolo ap52u-simbolo-informed"></i> Executado — marcado pela equipe</span><span class="ap52u-legenda-rua"><i class="ap52u-simbolo ap52u-simbolo-rua"></i> Quarteirão com serviço feito <select id="ap52u-periodo-ruas" aria-label="Período das ruas verdes"><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">12 meses</option><option value="0">tudo</option></select></span><span><i class="ap52u-simbolo ap52u-simbolo-conferir"></i> A fazer com serviço na rua depois — conferir <b id="ap52u-n-conferir"></b></span><span><i class="ap52u-simbolo ap52u-simbolo-neutral"></i> Encerrado no sistema, sem execução marcada</span><small id="ap52u-ruas-resumo" class="ap52u-ruas-resumo" role="status"></small><small>A cor indica a situação. O desenho é o serviço sugerido pelo texto do pedido e não é classificação confirmada.</small><small>Traçado da rua não é localização exata do pedido.</small><label class="ap52u-luz-opcao"><input id="ap52u-luz" type="checkbox" checked> Luz nos pendentes</label><details class="ap52u-desenhos"><summary>Ver os desenhos</summary><div id="ap52u-desenhos-conteudo"></div></details><p id="ap52u-vinculos-aviso" role="status" hidden></p></div></div>
    </div><aside class="ap52u-rua" id="ap52u-rua" aria-live="polite"><div class="ap52u-rua-intro"><span class="ap52u-kicker">A sua consulta</span><h2>Encontre uma rua</h2><p>Digite o nome do logradouro. Os pedidos e os serviços registrados nessa rua aparecerão aqui, mesmo quando não houver coordenadas.</p></div></aside></div>
    <section class="ap52u-mobile-resultados" id="ap52u-mobile-resultados" hidden></section>
    <button id="ap52u-retorno" type="button" class="ap52u-retorno" hidden>← Voltar à busca e ao mapa</button>`;
    view.prepend(sec);
    // R2.7: controles de situação + Origem fazem parte do próprio mapa,
    // também em tela cheia. Antes ficavam acima do palco cartográfico.
    const faixaMapa=by('contagens'),molduraMapa=by('mapa')?.closest('.ap52u-mapa-wrap');
    if(faixaMapa&&molduraMapa){
      // Mobile R2: um único menu inclui filtros, situação, atualização, tela cheia e legenda.
      // No desktop, display:contents preserva as posições originais dos elementos.
      const painelMobile=document.createElement('div');
      painelMobile.id='ap52u-mobile-filtros-painel';
      painelMobile.className='ap52u-mobile-filtros-painel';
      painelMobile.setAttribute('aria-label','Filtros e ações do mapa');
      molduraMapa.insertBefore(painelMobile,by('mapa'));
      painelMobile.appendChild(faixaMapa);
      const topoMobile=molduraMapa.querySelector('.ap52u-mapa-topo');
      const legendaMobile=molduraMapa.querySelector('.ap52u-legenda');
      if(topoMobile)painelMobile.appendChild(topoMobile);
      if(legendaMobile)painelMobile.appendChild(legendaMobile);
      // Mobile R5: manter ícones acessíveis dos botões originais.
      // A ordem no celular é Filtro | mapa completo (somente em modo rua) | ⛶/Sair.
      // No desktop ambos voltam para a barra original, sem duplicar listeners.
      const acoesMobile=document.createElement('div');
      acoesMobile.className='ap52u-mobile-mapa-acoes';
      molduraMapa.insertBefore(acoesMobile,painelMobile);
      const filtrosBtn=by('filtros-toggle');
      const verTudoBtn=by('ver-tudo');
      const telaCheiaBtn=by('tela-cheia');
      if(filtrosBtn)acoesMobile.appendChild(filtrosBtn);
      const larguraMobile=window.matchMedia?.('(max-width:900px)');
      const posicionarAcoes=()=>{
        if(!topoMobile)return;
        if(larguraMobile?.matches){
          if(verTudoBtn&&verTudoBtn.parentNode!==acoesMobile)acoesMobile.appendChild(verTudoBtn);
          if(telaCheiaBtn&&telaCheiaBtn.parentNode!==acoesMobile)acoesMobile.appendChild(telaCheiaBtn);
        }else{
          if(verTudoBtn&&verTudoBtn.parentNode!==topoMobile)topoMobile.insertBefore(verTudoBtn,by('atualizar'));
          if(telaCheiaBtn&&telaCheiaBtn.parentNode!==topoMobile)topoMobile.appendChild(telaCheiaBtn);
        }
      };
      posicionarAcoes();
      larguraMobile?.addEventListener?.('change',posicionarAcoes);
      if(typeof ResizeObserver==='function')new ResizeObserver(()=>ajustarAlturaTelaCheia()).observe(faixaMapa);
      requestAnimationFrame(()=>ajustarAlturaTelaCheia());
      // Mobile R2: os controles recolhem juntos, sem perder as escolhas.
      // Um único controle com aria-expanded governa o mesmo nav/IDs preexistentes.
      const mobileFiltros=by('filtros-toggle');
      mobileFiltros?.addEventListener('click',()=>{
        const abrir=molduraMapa.dataset.mobileFiltros!=='aberto';
        molduraMapa.dataset.mobileFiltros=abrir?'aberto':'fechado';
        mobileFiltros.setAttribute('aria-expanded',String(abrir));
        if(!abrir)molduraMapa.style.setProperty('--ap52u-controles-altura','0px');
        requestAnimationFrame(()=>ajustarAlturaTelaCheia());
      });
    }
    try{s.luzLigada=localStorage.getItem('ap52u-luz-pendentes')!=='off';}catch{}
    by('luz').checked=s.luzLigada;
    by('origem').addEventListener('change',()=>definirOrigem(by('origem').value));
    by('origem-limpar').addEventListener('click',()=>definirOrigem(''));
    by('sem-localizar').addEventListener('click',()=>{s.origemPagina=0;renderListaPedidosOrigem();by('origem-dialog').showModal();});
    by('dialog-fechar').addEventListener('click',()=>by('origem-dialog').close());
    by('origem-dialog').addEventListener('click',e=>{if(e.target===by('origem-dialog'))by('origem-dialog').close();});
    by('dialog-anterior').addEventListener('click',()=>{s.origemPagina--;renderListaPedidosOrigem();});
    by('dialog-proximo').addEventListener('click',()=>{s.origemPagina++;renderListaPedidosOrigem();});
    by('dialog-lista').addEventListener('click',e=>{const b=e.target.closest('[data-u-local-demanda]');if(!b)return;const id=b.dataset.uLocalDemanda;by('origem-dialog').close();if(s.telaCheia)alterarTelaCheia(false);abrirDemanda(id);});
    by('luz').addEventListener('change',()=>{s.luzLigada=by('luz').checked;try{localStorage.setItem('ap52u-luz-pendentes',s.luzLigada?'on':'off');}catch{}desenharPontos();});
    try{const per=localStorage.getItem('ap52u-periodo-ruas');if(['30','90','365','0'].includes(per))s.ruas.periodo=Number(per);}catch{}
    by('periodo-ruas').value=String(s.ruas.periodo);
    by('periodo-ruas').addEventListener('change',()=>{s.ruas.periodo=Number(by('periodo-ruas').value)||0;try{localStorage.setItem('ap52u-periodo-ruas',String(s.ruas.periodo));}catch{}s.mapa?.closePopup?.();desenharRuasExecutadas();renderContagens();});
    document.getElementById('ap52u-consolidado')?.addEventListener('click',()=>window.AP52Consolidado?.abrir?.());
    by('desenhos-conteudo').innerHTML=Object.entries({tb:'Tapa-buraco',recap:'Recapeamento',quebra:'Quebra-molas',escav:'Recuperação de GAP',ralo:'Grelha / caixa de ralo',tampao:'Tampão / PV',limpeza:'Limpeza de ralo',relevagem:'Relevagem',ponto:'Serviço a definir'}).map(([k,n])=>`<span>${svgIcone(k)} ${safe(n)}</span>`).join('');
    by('form').addEventListener('submit',e=>{e.preventDefault();void pesquisar();});
    by('busca').addEventListener('input',()=>{sugerir();if(!by('busca').value.trim())sairModoRua({limpar:true});});
    by('busca').addEventListener('focus',()=>{void carregarCatalogo().then(()=>sugerir());});
    try{s.ruas.ligadas=localStorage.getItem('ap52u-ruas-verdes')!=='off';}catch{}
    by('contagens').addEventListener('click',e=>{const rp=e.target.closest('#ap52u-ruas-pill');if(rp){s.ruas.ligadas=!s.ruas.ligadas;try{localStorage.setItem('ap52u-ruas-verdes',s.ruas.ligadas?'on':'off');}catch{}renderContagens();atualizarRuasVisiveis();return;}
      const serv=e.target.closest('#ap52u-servicos-pill');if(serv){if(s.telaCheia)alterarTelaCheia(false);by('rua').scrollIntoView({behavior:movimentoReduzido()?'instant':'smooth',block:'start'});by('rua-servicos')?.focus?.({preventScroll:true});return;}
      const b=e.target.closest('[data-u-filtro]');if(!b)return;const k=b.dataset.uFiltro;
      if(k==='all')s.filtros.clear();else if(s.filtros.has(k))s.filtros.delete(k);else s.filtros.add(k);
      if(s.filtros.size>=4)s.filtros.clear();s.visao=s.filtros.size===1?[...s.filtros][0]:'all';filtrarPontos();});
    by('retorno').addEventListener('click',()=>void voltar());
    // Voltar à lista, na ficha antiga, equivale a fechar o painel sobre o mapa.
    dem52El('fechar')?.addEventListener('click',e=>{if(s.modo==='demanda'){e.preventDefault();e.stopImmediatePropagation();void voltar();}},true);
    by('adicionar').addEventListener('click',async()=>{if(!dem52PodeCadastrar())return;modo('cadastro');await abrirCadastroDemandaAP52();});
    by('atualizar').addEventListener('click',async()=>{const centro=s.mapa?.getCenter(),zoom=s.mapa?.getZoom(),selecionado=s.pontoSelecionado;
      await carregarOrigens(true);await carregarPontos(true);if(s.termo)await pesquisar({preservarPonto:!!s.modoRua,bairroEscolhido:s.escolhaBairro});
      if(centro&&s.mapa)s.mapa.setView(centro,zoom,{animate:false});
      if(selecionado){s.pontoSelecionado=s.pontos.find(p=>p.row.id===selecionado.row.id)||selecionado;s.centro=[Number(selecionado.row.latitude),Number(selecionado.row.longitude)];desenharRaio({reenquadrar:false});}
    });
    by('ver-tudo').addEventListener('click',()=>{
      // Mobile R5: a saída do modo rua deve ser completa, mesmo em tela cheia.
      s.mapa?.closePopup?.();
      s.pontoSelecionado=null;s.centro=null;s.raioKm=1;
      if(s.raio&&s.mapa)s.mapa.removeLayer(s.raio);
      s.raio=null;
      by('ver-detalhes').hidden=true;
      sairModoRua({limpar:true});
      // Não alterar o estado de tela cheia nem reiniciar a consulta ao banco.
    });
    by('tela-cheia').addEventListener('click',()=>alterarTelaCheia(!s.telaCheia));
    by('ver-detalhes').addEventListener('click',()=>{if(s.pontoSelecionado){void abrirRegistroDoMapa(s.pontoSelecionado,{ficha:false});return;}alterarTelaCheia(false);by('rua')?.scrollIntoView({block:'start',behavior:movimentoReduzido()?'instant':'smooth'});});
    by('legenda-toggle').addEventListener('click',()=>{const el=by('legenda-toggle').closest('.ap52u-legenda'),aberta=el.dataset.aberta!=='true';el.dataset.aberta=String(aberta);by('legenda-toggle').setAttribute('aria-expanded',String(aberta));});
    window.addEventListener?.('orientationchange',()=>revalidarTamanhoMapa());
    window.addEventListener?.('resize',()=>{if(s.telaCheia){ajustarAlturaTelaCheia();revalidarTamanhoMapa();}});
    by('rua').addEventListener('click',e=>{
      const demanda=e.target.closest('[data-u-demanda]');if(demanda){abrirDemanda(demanda.dataset.uDemanda);return;}
      const caso=e.target.closest('[data-u-caso]');if(caso){void abrirCaso(caso.dataset.uCaso);return;}
      const casos=e.target.closest('[data-u-casos]');if(casos){void abrirListaCasos();return;}
      const adicionar=e.target.closest('[data-u-adicionar-rua]');if(adicionar){void adicionarRua();return;}
      const rvl=e.target.closest('[data-u-rvl]');if(rvl){void abrirRVL();return;}
      const hist=e.target.closest('[data-u-historico]');if(hist){void abrirHistorico();return;}
      const local=e.target.closest('[data-u-centro]');if(local){escolherPonto(local.dataset.uCentro);return;}
      const pag=e.target.closest('[data-u-pagina-bairros]');if(pag&&s.rua?.ambiguo){const total=Math.ceil((s.rua.bairros?.length||0)/8);s.paginaBairros=Math.min(total-1,Math.max(0,s.paginaBairros+Number(pag.dataset.uPaginaBairros)));renderRua();return;}
      const bairro=e.target.closest('[data-u-escolher-bairro]');if(bairro){void pesquisar({bairroEscolhido:bairro.dataset.uEscolherBairro});return;}
      const km=e.target.closest('[data-u-raio]');if(km){if(s.modoRua)sairModoRua({limpar:false,restaurar:false});s.raioKm=s.raioKm===Number(km.dataset.uRaio)&&s.raio?0:Number(km.dataset.uRaio);desenharRaio({animar:true});renderRua();return;}
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){
      if(s.telaCheia){e.preventDefault();alterarTelaCheia(false);return;}
      if(s.modo!=='inicio'&&!document.querySelector('.dem52s-admin-backdrop'))void voltar();
    }});
    // O formulário original conserva seus eventos de confirmação/recuperação.
    const cad=document.getElementById('dem52-cadastro-painel');if(cad)new MutationObserver(()=>{
      if(s.modo==='cadastro'&&cad.hidden){s.modo='inicio';view.dataset.ap52uModo='inicio';by('retorno').hidden=true;void carregarPontos();if(s.termo)void pesquisar();}
    }).observe(cad,{attributes:true,attributeFilter:['hidden']});
    const observer=new MutationObserver(()=>{
      if(view.style.display==='none'){if(s.telaCheia)alterarTelaCheia(false);s.ativo=false;s.consulta++;s.consultaPontos++;return;}
      if(!s.ativo){s.ativo=true;atualizarTopo();modo('inicio');void carregarOrigens();void carregarPontos();void iniciarMapa();}
      else atualizarTopo();
    });
    observer.observe(view,{attributes:true,attributeFilter:['style']});
    if(view.style.display!=='none'){s.ativo=true;atualizarTopo();void carregarOrigens();void carregarPontos();void iniciarMapa();}
  }
  async function carregarCatalogo(){
    if(s.catalogo||s.carregandoCatalogo)return s.carregandoCatalogo;
    if(typeof fetch!=='function'){s.catalogo=[];return [];}
    s.carregandoCatalogo=fetch('./catalogo-logradouros-ap52.json',{cache:'force-cache'})
      .then(r=>{if(!r.ok)throw Error('Catálogo não disponível.');return r.json();})
      .then(data=>{if(!Array.isArray(data.ruas))throw Error('Formato de catálogo inválido.');s.catalogo=data.ruas;return s.catalogo;})
      .catch(()=>{s.catalogo=[];return [];});
    return s.carregandoCatalogo;
  }
  // Catálogo municipal é a fonte de nomes e traçados, nunca a grafia histórica do pedido.
  // Mesma regra do SQL ap52_access.norm_logradouro(text), conferida em 945 grafias reais.
  function chaveRua(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/^r(ua)? +/,'rua ').replace(/^(est|estr|estrada) +/,'estrada ').replace(/^(av|avenida) +/,'avenida ').replace(/^(tv|trav|travessa|trv) +/,'travessa ').replace(/ +/g,' ');}
  function limparNomeRua(v){return chaveRua(String(v||'').replace(/["'“”‘’]/g,'').replace(/\s*(?:\bN[º°o.]?\s*\d+|,|\s+-\s+|\bESQUINA\b|\bTRECHO\b|\bPR[ÓO]XIMO\b|\bENTRE\b).*$/i,''));}
  // Índice do catálogo: calculado uma vez por carga do catálogo (antes, cada registro recalculava 14 mil nomes).
  let indiceCat=null;
  function indiceCatalogo(){if(!s.catalogo)return null;if(indiceCat&&indiceCat.ref===s.catalogo)return indiceCat;
    const ks=s.catalogo.map(r=>chaveRua(r.nome)),chaves=[...new Set(ks)].sort();const semTipo=new Map();
    for(const k of chaves){const n=k.replace(/^(?:rua|avenida|estrada|travessa) /,'');if(!semTipo.has(n))semTipo.set(n,new Set());semTipo.get(n).add(k);}
    indiceCat={ref:s.catalogo,chaves,semTipo,longas:new Map(),semTipoUnico:new Map(),porChave:null,ks};return indiceCat;}
  function porChaveCatalogo(){const ix=indiceCatalogo();if(!ix)return new Map();if(!ix.porChave){ix.porChave=new Map();
    s.catalogo.forEach((r,i)=>{const k=ix.ks[i];if(!ix.porChave.has(k))ix.porChave.set(k,[]);ix.porChave.get(k).push(r);});}return ix.porChave;}
  function catalogoLongas(base){const ix=indiceCatalogo();if(!base||!ix)return [];if(ix.longas.has(base))return ix.longas.get(base);
    const pre=base+' ';let lo=0,hi=ix.chaves.length;while(lo<hi){const m=(lo+hi)>>1;if(ix.chaves[m]<pre)lo=m+1;else hi=m;}
    const out=[];for(let i=lo;i<ix.chaves.length&&ix.chaves[i].startsWith(pre);i++)out.push(ix.chaves[i]);
    out.sort((a,b)=>b.length-a.length);ix.longas.set(base,out);return out;}
  // Sufixos de endereço aceitos depois do nome da rua (o resto é outra rua ou "logradouro parecido").
  const SUFIXOS_ENDERECO=/^(?:n|numero|num|numeros|tb|trecho|esquina|proximo|entre|km|altura|quadra|lote|sn|s n)\b|^\d/;
  function semTipoUnico(base){const ix=indiceCatalogo();const nome=String(base||'').replace(/^(?:rua|avenida|estrada|travessa) /,'');
    if(nome===base||!nome||!ix)return null;if(ix.semTipoUnico.has(base))return ix.semTipoUnico.get(base);
    const tipos=ix.semTipo.get(nome);const r=tipos&&tipos.size===1?nome:null;ix.semTipoUnico.set(base,r);return r;
  }
  function mesmoNomeDeRua(raw,base){let nome=chaveRua(raw),limpo=limparNomeRua(raw);if(!base)return false;
    // Registros sem prefixo só entram quando o catálogo não possui outro tipo com o mesmo nome.
    const sem=semTipoUnico(base);if(sem&&!/^(?:rua|avenida|estrada|travessa) /.test(nome)&&(nome===sem||nome.startsWith(sem+' '))){
      if(limpo===sem)return true;
      return SUFIXOS_ENDERECO.test(nome.slice(sem.length+1));
    }
    // Uma rua homônima mais longa jamais pertence à rua curta. Ex.: Bastos Tigre / Bastos.
    if(catalogoLongas(base).some(l=>nome===l||nome.startsWith(l+' ')))return false;
    if(limpo===base||nome===base)return true;
    if(!nome.startsWith(base+' '))return false;
    // Sufixos desconhecidos (ex.: Avenida Cesário de Melo FILHO) são outra rua.
    return SUFIXOS_ENDERECO.test(nome.slice(base.length+1));
  }
  function mesmaRuaRegistro(r,base,bairro){return mesmoNomeDeRua(r?.logradouro,base)&&(!bairro||norm(r?.bairro)===norm(bairro));}
  function sugerir(){const lista=by('sugestoes'),termo=chaveRua(by('busca').value);lista.replaceChildren();if(!s.catalogo||termo.length<3)return;
    const nomes=new Set();for(const rua of s.catalogo){if(nomes.size>=12)break;if(chaveRua(rua.nome).includes(termo))nomes.add(rua.nome);}
    for(const nome of nomes){const opt=document.createElement('option');opt.value=nome;lista.appendChild(opt);}
  }
  function agruparRuas(ruas,escolha){
    const grupos=new Map();for(const r of ruas){if(!grupos.has(String(r.id)))grupos.set(String(r.id),[]);grupos.get(String(r.id)).push(r);}
    const bairros=[...new Set(ruas.map(r=>r.bairro).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const precisaEscolher=grupos.size>1&&!escolha;
    const selecionadas=grupos.size===1?ruas:escolha?ruas.filter(r=>norm(r.bairro)===norm(escolha)):[];
    const idsSelecionados=new Set(selecionadas.map(r=>String(r.id)));
    return {grupos,bairros,precisaEscolher,selecionadas,identificadores:idsSelecionados,
      multiplasNoBairro:grupos.size>1&&selecionadas.length>0&&idsSelecionados.size>1,
      bairroFiltro:grupos.size>1?escolha||null:null};
  }
  async function resolverRua(termo,registros=[],escolhaBairro=null){
    const catalogo=await carregarCatalogo();const chave=limparNomeRua(termo);
    if(!chave||!catalogo?.length)return {nome:termo,chave,ruas:[],falha:true};
    let ruas=catalogo.filter(r=>chaveRua(r.nome)===chave);
    if(!ruas.length&&registros.length){const contagem=new Map();
      for(const r of registros){const limpa=limparNomeRua(r.logradouro);if(!limpa)continue;contagem.set(limpa,(contagem.get(limpa)||0)+1);}
      const candidatos=[...contagem.entries()].sort((a,b)=>b[1]-a[1]);
      for(const [cand] of candidatos){const grupo=catalogo.filter(r=>chaveRua(r.nome)===cand);if(grupo.length){ruas=grupo;break;}}
    }
    if(!ruas.length)return {nome:termo,chave,ruas:[],falha:true};
    const nome=ruas[0].nome,grupo=agruparRuas(ruas,escolhaBairro);
    return {nome,chave:chaveRua(nome),ruas:grupo.selecionadas,bairros:grupo.bairros,
      ambiguo:grupo.precisaEscolher,multiplasNoBairro:grupo.multiplasNoBairro,
      bairroFiltro:grupo.bairroFiltro,ids:[...grupo.identificadores],falha:false,
      idUnico:grupo.grupos.size===1};
  }
  function filtroPrecisao(q,chave){const termo=chave.replace(/[%,()\\]/g,'');
    // Só o nome exato ou o nome seguido de complemento de endereço (Nº, TB, esquina, número...).
    // Prefixos livres, como '... MELO FILHO', ficam fora e aparecem em "logradouros parecidos".
    const suf=['n %','numero %','num %','numeros %','tb%','trecho %','esquina %','proximo %','entre %','km %','altura %','quadra %','lote %','sn%','s n%','0%','1%','2%','3%','4%','5%','6%','7%','8%','9%'];
    const nomes=[termo,...(semTipoUnico(termo)?[semTipoUnico(termo)]:[])];
    q=q.or(nomes.flatMap(nome=>[`logradouro_normalizado.eq.${nome}`,...suf.map(x=>`logradouro_normalizado.like.${nome} ${x}`)]).join(','));
    // Exclui só as ruas mais longas do catálogo que o filtro acima poderia pegar (ex.: "rua projetada 01 ..."),
    // para não estourar o tamanho do endereço da consulta em nomes comuns ("Rua José" tem 113 nomes mais longos).
    for(const longa of catalogoLongas(termo))if(SUFIXOS_ENDERECO.test(longa.slice(termo.length+1)))q=q.not('logradouro_normalizado','like',longa+'%');
    return q;
  }
  function totalPontosRua(){return s.pontos.filter(p=>s.modoRua&&mesmaRuaRegistro(p.row,s.rua?.chave,s.rua?.bairroFiltro));}
  function atualizarBarraMapa(){const barra=by('controle-local');if(!barra)return;
    by('ver-tudo').hidden=!s.modoRua;
    if(!s.modoRua){
      if(s.origemId){const n=pontosDaOrigem().length,t=s.origemTotal;
        barra.textContent=t?.id===s.origemId&&Number.isSafeInteger(t.total)?`${n} de ${t.total} pedidos de ${nomeOrigem()} com ponto · ${Math.max(0,t.total-n)} sem localização`:`${n} pedido(s) de ${nomeOrigem()} com ponto · conferindo total da origem…`;return;}
      barra.textContent=s.pontos.length?`${s.pontos.length} ponto(s) exato(s) · ${s.semPonto} registro(s) sem localização`:`${s.semPonto} registro(s) ainda sem coordenadas — pesquise uma rua`;return;}
    const n=pontosDaOrigem().length;const sem=s.rua?.semLocalizacao;
    barra.textContent=n?`${s.rua.nome} · ${n} no mapa · ${Number.isSafeInteger(sem)?sem:'Indisponível'} sem localização (na lista ao lado)`:`Nenhum ponto com localização nesta rua; ${Number.isSafeInteger(sem)?sem:'Indisponível'} na lista ao lado`;
  }
  function sairModoRua({limpar=false,restaurar=true}={}){
    const anterior=s.mapaAntes;s.modoRua=false;s.escolhaBairro=null;s.mapaAntes=null;
    if(s.visaoAntes){s.visao=s.visaoAntes;s.visaoAntes=null;s.filtros.clear();if(s.visao!=='all')s.filtros.add(s.visao);}
    if(s.linha&&s.mapa){s.mapa.removeLayer(s.linha);s.linha=null;}
    if(limpar){s.consulta++;avisar('');s.termo='';s.rua=null;s.encontrados=[];s.execucoes=[];s.casos=[];s.totalExecucoes=null;by('busca').value='';renderRua();}
    renderContagens();filtrarPontos();atualizarBarraMapa();
    if(restaurar&&anterior&&s.mapa)s.mapa.setView(anterior.centro,anterior.zoom,{animate:false});
  }
  function revalidarTamanhoMapa(){if(!s.mapa)return;const center=s.mapa.getCenter(),zoom=s.mapa.getZoom();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!s.mapa)return;s.mapa.invalidateSize({pan:false});s.mapa.setView(center,zoom,{animate:false});}));}
  function ajustarAlturaTelaCheia(){
    // Altura aferida da faixa de filtros dentro do mapa, inclusive na mudança de origem.
    const faixa=by('contagens'),moldura=by('mapa')?.closest('.ap52u-mapa-wrap');
    if(!faixa||!moldura)return;
    const altura=Math.ceil(faixa.getBoundingClientRect().height);
    if(altura>0)moldura.style.setProperty('--ap52u-controles-altura',`${altura}px`);
  }
  function alterarTelaCheia(abrir){if(s.telaCheia===abrir)return;const centro=s.mapa?.getCenter(),zoom=s.mapa?.getZoom();s.telaCheia=abrir;
    // Mobile R3: ao alternar modos, o painel recolhe e o botão original fica à vista.
    if(typeof window.matchMedia==='function'&&window.matchMedia('(max-width:900px)').matches){
      const moldura=by('mapa')?.closest('.ap52u-mapa-wrap');
      if(moldura){moldura.dataset.mobileFiltros='fechado';moldura.style.setProperty('--ap52u-controles-altura','0px');}
      by('filtros-toggle')?.setAttribute('aria-expanded','false');
    }
    by('painel')?.classList.toggle('ap52u-full',abrir);document.body.classList.toggle('ap52u-corpo-travado',abrir);
    if(abrir){const legenda=by('legenda-toggle').closest('.ap52u-legenda');legenda.dataset.aberta='false';by('legenda-toggle').setAttribute('aria-expanded','false');}
    const botao=by('tela-cheia');botao.setAttribute('aria-label',abrir?'Sair da tela cheia':'Tela cheia');botao.setAttribute('title',abrir?'Sair da tela cheia':'Tela cheia');
    botao.querySelector('.ap52u-full-texto').textContent=abrir?'Sair':'Tela cheia';botao.querySelector('.ap52u-full-icone').textContent=abrir?'✕':'⛶';
    by('ver-detalhes').hidden=!(abrir&&!!s.pontoSelecionado);ajustarAlturaTelaCheia();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(s.mapa&&centro){s.mapa.invalidateSize({pan:false});s.mapa.setView(centro,zoom,{animate:false});}}));
    if(!abrir)botao.focus({preventScroll:true});
  }
  async function pesquisar({preservarPonto=false,bairroEscolhido=null}={}){
    const termo=by('busca').value.trim();if(!termo){sairModoRua({limpar:true});avisar('Informe a rua ou o código histórico para consultar.',true);by('busca').focus();return false;}
    if(!podeVer())return false;const id=++s.consulta,g=ac28Generation;s.termo=termo;s.encontrados=[];s.execucoes=[];s.totalExecucoes=null;s.casos=[];s.erro={execucoes:false,casos:false};s.rua=null;
    if(!preservarPonto){s.centro=null;s.pontoSelecionado=null;s.raioKm=1;removerRaio();}
    avisar('Consultando pedidos, casos e serviços desta rua…');by('buscar').disabled=true;
    const codigo=/^(?:D\d{1,3}[-_]|CO[-_]|\d{4}\/|SEI\b)/i.test(termo);
    let resolved=codigo?null:await resolverRua(termo,[],bairroEscolhido);
    if(!valido(id,g))return false;
    if(resolved?.ambiguo){
      if(s.modoRua)sairModoRua({limpar:false});
      s.paginaBairros=0;s.rua={...resolved,incompleto:false,semLocalizacao:0};renderRua();
      avisar('Há ruas diferentes com este nome. Escolha o bairro antes de destacar o traçado.');
      by('buscar').disabled=false;return true;
    }
    try{
      let chave=resolved&&!resolved.falha?resolved.chave:chaveRua(termo);
      let q=escopo(sb.from('demandas').select(DEM52_COLUNAS+',origem_id,latitude,longitude,logradouro_normalizado',{count:'exact'}).is('deleted_at',null));
      if(s.origemId)q=q.eq('origem_id',s.origemId);
      q=codigo?q.or(dem52FiltroProtocolo(termo)):resolved&&!resolved.falha?filtroPrecisao(q,chave):q.ilike('logradouro_normalizado','%'+chave.replace(/[\\%_]/g,'\\$&')+'%');
      if(resolved?.bairroFiltro)q=q.ilike('bairro',resolved.bairroFiltro);
      const ret=await q.order('data_recebimento',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(0,MAX_RUA-1);
      if(!valido(id,g))return false;if(ret.error)throw ret.error;
      s.encontrados=ret.data||[];let totalD=ret.count,incompleto=(ret.count||0)>s.encontrados.length;
      if(codigo&&s.encontrados.length){chave=limparNomeRua(s.encontrados[0].logradouro);resolved=await resolverRua(s.encontrados[0].logradouro,s.encontrados);}
      else if(resolved?.falha&&s.encontrados.length){
        const tent=await resolverRua(termo,s.encontrados);
        if(!tent.falha&&!tent.ambiguo){resolved=tent;chave=tent.chave;
          let precisa=escopo(sb.from('demandas').select(DEM52_COLUNAS+',origem_id,latitude,longitude,logradouro_normalizado',{count:'exact'}).is('deleted_at',null));
          if(s.origemId)precisa=precisa.eq('origem_id',s.origemId);
          precisa=filtroPrecisao(precisa,chave);
          const r2=await precisa.order('data_recebimento',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(0,MAX_RUA-1);
          if(!valido(id,g))return false;if(r2.error)throw r2.error;
          s.encontrados=r2.data||[];totalD=r2.count;incompleto=r2.count>s.encontrados.length;
        }
      }
      const filtro='%'+chave.replace(/[\\%_]/g,'\\$&')+'%';
      let totalCs=0;
      if(chave){
        let exq=escopo(sb.from('servicos_executados').select(DEM52H_EXEC,{count:'exact'}));
        let caq=escopo(sb.from('casos_operacionais').select('id,codigo,titulo,logradouro,logradouro_normalizado,numero,bairro,gerencia,latitude,longitude,status,created_at',{count:'exact'}).is('deleted_at',null));
        exq=resolved&&!resolved.falha?filtroPrecisao(exq,chave):exq.ilike('logradouro_normalizado',filtro);
        caq=resolved&&!resolved.falha?filtroPrecisao(caq,chave):caq.ilike('logradouro_normalizado',filtro);
        if(resolved?.bairroFiltro){exq=exq.ilike('bairro',resolved.bairroFiltro);caq=caq.ilike('bairro',resolved.bairroFiltro);}
        const [ex,ca]=await Promise.all([exq.order('data_execucao',{ascending:false}).range(0,99),s.origemId?Promise.resolve({data:[],count:0,error:null}):caq.order('created_at',{ascending:false}).range(0,99)]);
        if(!valido(id,g))return false;
        if(ex.error||!Number.isSafeInteger(ex.count)){s.erro.execucoes=true;console.warn('[AP5.2/tela única] Falha ao consultar serviços:',ex.error?.code||'contagem indisponível');}
        else{s.execucoes=ex.data||[];s.totalExecucoes=ex.count;incompleto=incompleto||ex.count>s.execucoes.length;}
        if(ca.error||!Number.isSafeInteger(ca.count)){s.erro.casos=true;console.warn('[AP5.2/tela única] Falha ao consultar casos:',ca.error?.code||'contagem indisponível');}
        else{s.casos=ca.data||[];totalCs=ca.count;incompleto=incompleto||ca.count>s.casos.length;}
      }
      if(!valido(id,g))return false;
      if(resolved&&!resolved.falha){
        s.encontrados=s.encontrados.filter(r=>mesmaRuaRegistro(r,resolved.chave,resolved.bairroFiltro));
        s.casos=s.casos.filter(r=>mesmaRuaRegistro(r,resolved.chave,resolved.bairroFiltro));
        s.execucoes=s.execucoes.filter(r=>mesmaRuaRegistro(r,resolved.chave,resolved.bairroFiltro));
      }
      const nomes=[...s.encontrados.map(r=>r.logradouro),...s.execucoes.map(r=>r.logradouro),...s.casos.map(r=>r.logradouro)].filter(Boolean);
      const nome=resolved&&!resolved.falha?resolved.nome:nomes.find(v=>chaveRua(v)===chaveRua(termo))||nomes[0]||termo;
      const coord=[...s.encontrados,...s.casos].filter(coords).length;
      const sem=Number.isSafeInteger(totalD)&&!s.erro.casos&&Number.isSafeInteger(totalCs)?Math.max(0,totalD+totalCs-coord):null;
      s.rua={...resolved,nome,chave:resolved&&!resolved.falha?resolved.chave:chave,incompleto,
        totalD,totalCs,semLocalizacao:incompleto?null:sem,exibidos:s.encontrados.length,semPonto:s.encontrados.filter(r=>!coords(r)).length};
      if(!preservarPonto&&!codigo&&resolved&&!resolved.falha){
        if(!s.modoRua){s.mapaAntes=s.mapa?{centro:s.mapa.getCenter(),zoom:s.mapa.getZoom()}:null;s.visaoAntes=s.visao;}
        s.modoRua=true;s.escolhaBairro=resolved.bairroFiltro;s.visao='all';s.filtros.clear();
        // Foco correto no catálogo: não depende do primeiro registro histórico.
        await destacarRua(resolved.ruas);if(!valido(id,g))return false;
      }else if(!preservarPonto&&s.modoRua){sairModoRua({limpar:false});}
      if(!preservarPonto&&(!resolved||resolved.falha)&&!codigo){
        if(s.linha&&s.mapa){s.mapa.removeLayer(s.linha);s.linha=null;}
        avisar(`Traçado não encontrado para “${termo}”. Escolha a rua na lista de sugestões.`,true);
      }
      // Indicar os registros parecidos que a consulta ampla capturaria, sem misturá-los à rua.
      s.similares=0;
      if(!preservarPonto&&!codigo&&s.modoRua&&resolved&&!resolved.falha){
        let amploQ=escopo(sb.from('demandas').select('id',{head:true,count:'exact'}).is('deleted_at',null));
        if(s.origemId)amploQ=amploQ.eq('origem_id',s.origemId);
        const amplo=await amploQ.ilike('logradouro_normalizado','%'+chave.replace(/[\\%_]/g,'\\$&')+'%');
        if(!valido(id,g))return false;
        if(!amplo.error&&Number.isSafeInteger(amplo.count)&&Number.isSafeInteger(totalD))s.similares=Math.max(0,amplo.count-totalD);
      }
      const erroParcial=!!(s.erro?.execucoes||s.erro?.casos);
      if(erroParcial)avisar('Consulta parcial: alguns dados estão indisponíveis. Consulte os avisos abaixo e tente novamente.',true);
      else if(incompleto)avisar('Exibindo os primeiros resultados. Use “Ver histórico completo da rua” para consultar os demais.');
      else if(resolved&&!resolved.falha)avisar('');
      renderContagens();filtrarPontos();renderRua();atualizarBarraMapa();
      return true;
    }catch(e){if(valido(id,g)){
      avisar('Não foi possível consultar a rua. Verifique a conexão e tente novamente.',true);
      by('rua').innerHTML='<div class="ap52u-rua-intro" role="alert"><h2>Consulta indisponível</h2><p>Os dados desta rua não puderam ser carregados. Tente novamente. Nenhuma contagem foi confirmada.</p></div>';
      console.warn('[AP5.2/tela única] Falha na busca:',e?.code||'consulta');
    }return false;}
    finally{if(valido(id,g))by('buscar').disabled=false;}
  }
  function renderRua(){const p=by('rua');if(!p)return;
    if(!s.rua){p.innerHTML='<div class="ap52u-rua-intro"><span class="ap52u-kicker">Sua consulta</span><h2>Encontre uma rua</h2><p>Os pedidos e os serviços aparecerão aqui, mesmo quando ainda não houver pinos no mapa.</p></div>';return;}
    if(s.rua.ambiguo){const bairros=s.rua.bairros||[],inicio=s.paginaBairros*8;
      p.innerHTML=`<div class="ap52u-rua-head"><h2>Qual delas?</h2><p>“${safe(s.rua.nome)}” identifica ruas diferentes no catálogo. Escolha o bairro; nenhum traçado será desenhado antes da escolha.</p></div><div class="ap52u-escolhas">${bairros.slice(inicio,inicio+8).map(b=>`<button type="button" data-u-escolher-bairro="${safe(b)}">${safe(b)}</button>`).join('')}</div>${bairros.length>8?`<div class="ap52u-paginar"><small>Mostrando ${inicio+1}–${Math.min(inicio+8,bairros.length)} de ${bairros.length} bairros</small>${inicio>0?'<button type="button" data-u-pagina-bairros="-1">Anterior</button>':''}${inicio+8<bairros.length?'<button type="button" data-u-pagina-bairros="1">Mais bairros</button>':''}</div>`:''}`;return;}
    const d=s.encontrados,ex=s.execucoes,cs=s.casos,exNome=s.rua.nome;
    const bairro=[...d,...ex,...cs].map(x=>x.bairro).find(Boolean)||'';
    const gerencia=[...new Set([...d,...ex,...cs].map(x=>x.gerencia).filter(Boolean))].join(' · ');
    const marcados=[...d,...cs].filter(coords).length,semCoordenadas=[...d,...cs].filter(x=>!coords(x)).length;
    const totalExec=Number.isSafeInteger(s.totalExecucoes)?s.totalExecucoes:ex.length;
    const execIndisponivel=!!s.erro?.execucoes,casosIndisponiveis=!!s.erro?.casos;
    const partesResumo=[`${d.length} ${d.length===1?'pedido recebido':'pedidos recebidos'}${s.origemId?' da origem '+nomeOrigem():''}`,
      s.origemId?'casos operacionais fora do filtro de origem':casosIndisponiveis?'casos operacionais indisponíveis':`${cs.length} ${cs.length===1?'caso':'casos'}`,
      execIndisponivel?'serviços executados indisponíveis':`${ex.length} ${ex.length===1?'registro de serviço executado':'registros de serviços executados'}`];
    const resumo=(d.length||ex.length||cs.length||execIndisponivel||casosIndisponiveis)?`${partesResumo.join(', ')} nesta consulta. Os registros de execução não são automaticamente vinculados a pedidos.`:'Não há registros disponíveis nesta busca. Verifique outra grafia do logradouro.';
    const rotuloExec=execIndisponivel?'Indisponível':totalExec>ex.length?`${ex.length} de ${totalExec}`:String(ex.length);
    const erroExecHtml='<p class="ap52u-erro-consulta" role="alert">Não foi possível consultar os serviços executados desta rua. A contagem está indisponível; tente novamente.</p>';
    const erroCasosHtml='<div class="ap52u-rua-bloco"><h3>Casos operacionais <span>Indisponível</span></h3><p class="ap52u-erro-consulta" role="alert">Não foi possível consultar os casos operacionais desta rua. Tente novamente.</p></div>';
    const lista=d.slice(0,30).map(x=>`<button type="button" class="ap52u-registro" data-u-demanda="${safe(x.id)}"><strong>${safe(x.assunto||'Pedido sem assunto')}</strong><span>${safe(x.numero?'Nº '+x.numero:'Número não informado')} · ${safe(x.solicitante||'Solicitante não informado')}</span><span>${safe(x.id_origem_migracao||x.protocolo||'Sem código')} · ${safe(localData(x.data_recebimento))} · ${safe(x.gerencia)} · Origem: ${safe(nomeOrigemId(x.origem_id))}</span><em>${safe(DEM52_STATUS[x.status]||'Situação não informada')}${x.origem_migracao?' · Histórico (a conferir)':''}</em>${htmlDepoisLista(x)}</button>`).join('');
    const casos=cs.slice(0,8).map(x=>`<button type="button" class="ap52u-registro" data-u-caso="${safe(x.id)}"><strong>${safe(x.codigo||x.titulo||'Caso operacional')}</strong><span>${safe(x.titulo||x.logradouro)} · ${safe(CASO_STATUS[x.status]||'Situação não informada')}</span></button>`).join('');
    const feitos=ex.slice(0,12).map(x=>`<article class="ap52u-execucao"><strong>${safe(x.servico_apresentacao||x.servico_original||'Serviço registrado')}</strong><span>${safe(localData(x.data_execucao))} · ${safe(x.numero?'nº '+x.numero:'trecho sem número')} · ${safe(x.gerencia)}</span><small>Registro de execução — não comprova vínculo com pedido específico</small></article>`).join('');
    p.innerHTML=`<div class="ap52u-rua-head"><span class="ap52u-kicker">Rua pesquisada</span><h2>${safe(exNome)}</h2><p>${safe([bairro,gerencia].filter(Boolean).join(' · ')||'Área AP5.2')}</p></div>
    ${s.rua.multiplasNoBairro?`<p class="ap52u-rua-alerta">${s.rua.ids.length} ruas diferentes com este nome em ${safe(s.rua.bairroFiltro)}; confira pelo número antes de interpretar os pontos.</p>`:''}
    <p class="ap52u-rua-resumo">${safe(resumo)}</p>
    <div class="ap52u-aviso-coord">${marcados} registro(s) com ponto confirmado · ${semCoordenadas} sem coordenadas nesta consulta. ${s.rua.incompleto?'Contagem parcial: há mais registros além dos exibidos. ':''}Traçado da rua não é localização exata de um pedido.</div>
    ${s.pontoSelecionado?`<div class="ap52u-raio-box"><strong>O que há por perto?</strong><div class="ap52u-raios">${[1,2,3].map(n=>`<button type="button" data-u-raio="${n}" aria-pressed="${!!s.raio&&s.raioKm===n}">${n} km</button>`).join('')}</div><p>${safe(resumoRaio())}</p></div>`:''}
    <div class="ap52u-rua-bloco"><h3>O que foi informado <span>${d.length}</span></h3>${lista||'<p>Nenhum pedido encontrado para este termo.</p>'}</div>
    ${casosIndisponiveis?erroCasosHtml:cs.length?`<div class="ap52u-rua-bloco"><h3>Casos operacionais <span>${cs.length}</span></h3>${casos}</div>`:''}
    ${s.similares?`<details class="ap52u-semelhantes"><summary>${s.similares} registros de logradouros parecidos</summary><p>Esses registros não foram incluídos na contagem nem nos pontos desta rua para evitar mistura de endereços.</p></details>`:''}
    ${s.origemId?'<p class="ap52u-aviso-origem-independente">Os serviços abaixo são do histórico da rua, de qualquer origem. Não comprovam atendimento aos pedidos filtrados.</p>':''}
    <div class="ap52u-rua-bloco" id="ap52u-rua-servicos" tabindex="-1"><h3>Serviços executados registrados <span>${safe(rotuloExec)}</span></h3>${execIndisponivel?erroExecHtml:feitos||'<p>Nenhuma execução registrada nesta busca. Isso não prova que o serviço não foi feito.</p>'}${!execIndisponivel&&ex.length>12?'<small>Esta tela apresenta os 12 registros mais recentes. Para consultar todas as datas, abra o histórico completo.</small>':''}</div>
    <button type="button" class="ap52u-historico-btn" data-u-historico="1">Ver histórico completo por data</button>
    <div class="ap52u-acoes-rua">
      <button type="button" data-u-casos="1">Consultar casos operacionais</button>
      ${dem52PodeCadastrar()?'<button type="button" data-u-adicionar-rua="1">Adicionar demanda nesta rua</button>':''}
      <button type="button" data-u-rvl="1">Abrir gerador de RVL</button>
    </div>
    <small class="ap52u-fonte">O texto original e as informações completas ficam na ficha. Pedidos semelhantes não são agrupados automaticamente.</small>`;
    // Resultado mobile permanece dentro do mesmo painel e na mesma página.
    by('mobile-resultados').hidden=true;
  }
  async function destacarRua(ruas){if(!s.mapa||!Array.isArray(ruas)||!ruas.length)return;
    if(s.linha){s.mapa.removeLayer(s.linha);s.linha=null;}
    const paths=[];for(const r of ruas)for(const trecho of r.trechos||[])for(const path of trecho.paths||[]){if(path.length>1)paths.push(path.map(([lng,lat])=>[lat,lng]));}
    if(!paths.length){avisar(`Traçado não encontrado para “${s.rua?.nome||''}”. Escolha a rua na lista de sugestões.`,true);return;}
    s.linha=L.layerGroup(paths.slice(0,1000).map(path=>L.polyline(path,{color:'#1f4e79',weight:5,opacity:.85}))).addTo(s.mapa);
    const bounds=L.latLngBounds(paths.flat());if(bounds.isValid()){
      const opts={padding:[48,48],maxZoom:17};
      if(movimentoReduzido())s.mapa.fitBounds(bounds,{...opts,animate:false});
      else s.mapa.flyToBounds(bounds,{...opts,duration:.65});
    }
  }
  function abrirDemanda(id){const d=s.encontrados.find(x=>x.id===id);if(!d||!podeVer())return;
    if(dem52c?.form)return;
    dem52c.aba='demandas';dem52c.modo=null;dem52cSincronizar();
    dem52.confirmado=d;dem52.selecionada=d.id;dem52RenderContexto();modo('demanda');
    document.querySelector('.dem52-context-body')?.scrollTo?.({top:0});
  }
  async function abrirCaso(id){if(!podeVer())return;modo('caso');await dem52cAbrirCaso(id);}
  async function abrirListaCasos(){if(!podeVer())return;modo('caso');await dem52cMudarAba('casos');}
  async function adicionarRua(){if(!dem52PodeCadastrar()||!s.rua)return;modo('cadastro');await abrirCadastroDemandaAP52();
    if(dem52Cadastro?.aberto){const l=dem52FormEl('logradouro');if(l&&!l.value)l.value=s.rua.nome;}
  }
  async function abrirRVL(){if(typeof mudarView==='function')await mudarView('rvl');}
  async function abrirHistorico(){if(!podeVer()||!s.rua?.nome)return;
    modo('historico');await dem52hAbrir();dem52hEl('termo').value=s.rua.nome;await dem52hBuscar();
  }
  function statusExecutado(p){if(p.tipo==='c')return p.row.status==='concluido';
    const id=p.row.id;const ctx=s.vinculosExec.get(id);const caso=s.vinculosCaso.get(id)||[];
    return !!ctx||caso.some(c=>c.status==='concluido');
  }
  function markerType(item){const status=item?.row?.status;
    if(statusExecutado(item))return 'informed';
    if(item?.tipo==='d'){
      if((s.vinculosCaso.get(item.row.id)||[]).some(c=>EM_EXECUCAO.has(c.status)))return 'working';
      return ABERTOS.has(status)?'alert':'neutral';
    }
    if(item?.tipo==='c')return EM_EXECUCAO.has(status)?'working':CASOS_ABERTOS.has(status)?'alert':'neutral';
    return 'neutral';
  }
  function rotuloMarcador(p){const sit=markerType(p);if(sit==='neutral'&&p?.tipo==='d')return `${statusDoPonto(p)} · sem execução marcada`;
    return sit==='informed'?'Executado':sit==='working'?'Em execução ou programado':sit==='alert'?'Aguardando serviço':'Outras situações';}
  const iconeChave=p=>p.tipo+':'+p.row.id;
  const iconeIndefinido=Object.freeze({grupo:'ponto',nome:null});
  // Pendências que já indicam o mesmo desenho, independentemente da opção ainda não confirmada.
  // Esta tabela existe SOMENTE para os ícones do mapa; não altera o motor nem grava serviços.
  const ICONES_A_CONFERIR=Object.freeze({
    reposicao_grelha_material_indefinido:Object.freeze({grupo:'ralo',nome:'Reposição de grelha (material a confirmar)'}),
    reposicao_tampao_material_indefinido:Object.freeze({grupo:'tampao',nome:'Reposição de tampão (material a confirmar)'}),
    desobstrucao:Object.freeze({grupo:'limpeza',nome:'Limpeza de ralo (manual ou mecânica a confirmar)'})
  });
  function sugerirIcone(p,dadosCatalogo){
    if(!dadosCatalogo||!window.AP52Classificador66g3b?.analisarDemanda)return iconeIndefinido;
    const titulo=String((p.tipo==='d'?p.row.assunto:p.row.titulo)||'');
    if(!titulo.trim())return iconeIndefinido;
    try{
      // Motor homologado: não faz escrita, não confirma serviço, não lê observações.
      // A API do catálogo adapta os Maps 2/28/65 para a entrada exigida pelo motor.
      const r=window.AP52Catalogo66g1.analyze(titulo,{
        tipo:'demanda',gerencia:p.row.gerencia,historica:p.tipo==='d'&&!!p.row.id_origem_migracao
      },dadosCatalogo);
      if(r?.erro||!Array.isArray(r?.candidatos)||r.exclusoes?.length)return iconeIndefinido;
      // Um 'problema' descreve a situação, não uma intervenção; não bloqueia o desenho.
      // Para serviços sem material/método informado, admitir SOMENTE os três identificadores
      // explícitos cuja família visual é comum a todas as opções ainda em conferência.
      // Qualquer candidato desconhecido ou famílias diferentes = ponto 'a definir'.
      const itens=r.candidatos.filter(c=>c.tipo!=='problema');
      if(!itens.length)return iconeIndefinido;
      const icones=itens.map(c=>{
        if(c.tipo==='servico_catalogo'){
          const grupo=GRUPO_SERVICO[c.codigo_servico];
          return grupo?{grupo,nome:c.nome_servico||null}:null;
        }
        if(c.tipo==='servico_a_identificar')return ICONES_A_CONFERIR[c.identificador]||null;
        return null;
      });
      if(icones.some(i=>!i||!i.grupo))return iconeIndefinido;
      const grupos=new Set(icones.map(i=>i.grupo));
      if(grupos.size!==1)return iconeIndefinido;
      const nomes=[...new Set(icones.map(i=>i.nome).filter(Boolean))];
      return {grupo:[...grupos][0],nome:nomes.join(' / ')||null};
    }catch(e){return iconeIndefinido;}
  }
  function iconeDe(p){return s.iconeCache.get(iconeChave(p))||iconeIndefinido;}
  async function prepararIconesPontos(id,g){
    let catalogo=null;
    try{catalogo=await window.AP52Catalogo66g1?.load?.();}catch(e){}
    if(!validoPontos(id,g))return;
    s.catalogoIcones=catalogo||null;
    // Cache por ID: cada ponto é analisado uma vez por carregamento, nunca por pan/zoom.
    for(const p of s.pontos)s.iconeCache.set(iconeChave(p),sugerirIcone(p,catalogo));
    desenharPontos();
  }
  function svgIcone(grupo){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG_NITIDO[grupo]||SVG_NITIDO.ponto}</svg>`;}
  function htmlMarcador(p,mini=false){
    const tipo=markerType(p),sug=iconeDe(p),selecionado=!!(s.pontoSelecionado&&iconeChave(s.pontoSelecionado)===iconeChave(p));
    const classes=['ap52u-marca','ap52u-marca-'+tipo];if(p.tipo==='c')classes.push('ap52u-marca-caso');
    if(mini)classes.push('ap52u-mini-marca');
    if(selecionado&&!mini)classes.push('ap52u-pulsando');
    else if(!mini&&s.luzLigada&&(tipo==='alert'||tipo==='working'))classes.push('ap52u-halo');
    const atraso=Array.from(String(p.row.id||'')).reduce((n,c)=>n+c.charCodeAt(0),0)%27;
    const conferir=!mini&&tipo==='alert'&&p.tipo==='d'&&!!servicosDepois(p.row);
    return `<span class="${classes.join(' ')}" style="--ap52u-delay:-${(atraso/10).toFixed(1)}s" aria-hidden="true">${svgIcone(sug.grupo)}${tipo==='informed'&&!mini?'<span class="ap52u-selo">✓</span>':''}${conferir?'<span class="ap52u-selo-conferir"></span>':''}</span>`;
  }
  function statusDoPonto(p){return p.tipo==='d'?(typeof DEM52_STATUS!=='undefined'?DEM52_STATUS[p.row.status]:null)||'Situação não informada':CASO_STATUS[p.row.status]||'Situação não informada';}
  function tituloDoPonto(p){return p.tipo==='d'?(p.row.assunto||'Pedido sem assunto'):(p.row.titulo||'Caso operacional');}
  function protocoloDoPonto(p){return p.tipo==='d'?(p.row.id_origem_migracao||p.row.protocolo||'Pedido sem código'):(p.row.codigo||'Caso sem código');}
  function descricaoAcessivel(p){const sug=iconeDe(p);const dep=p.tipo==='d'&&markerType(p)!=='informed'?servicosDepois(p.row):null;
    return `${p.tipo==='d'?'Pedido':'Caso operacional'} ${protocoloDoPonto(p)}; ${sug.nome?'serviço sugerido '+sug.nome:'serviço a definir'}; ${rotuloMarcador(p)}${dep?'; a rua teve serviço depois do pedido, conferir':''}`;}
  function htmlCartao(p){const r=p.row,sug=iconeDe(p),sit=markerType(p),data=p.tipo==='d'?r.data_recebimento:r.created_at;
    let info=rotuloMarcador(p);
    if(sit==='informed'){
      const exec=s.vinculosExec.get(r.id);const caso=(s.vinculosCaso.get(r.id)||[]).find(c=>c.status==='concluido');
      if(p.tipo==='c')info=`Executado · marcado pela equipe${r.codigo?' (caso '+r.codigo+')':''}${(r.data_conclusao||r.updated_at)?', '+localData(r.data_conclusao||r.updated_at):''}`;
      else if(exec)info=`Executado · registro de execução: ${exec.servico||'serviço'}${exec.data?', '+localData(exec.data):''}`;
      else if(caso)info=`Executado · marcado pela equipe${caso.codigo?' (caso '+caso.codigo+')':''}${caso.data?', '+localData(caso.data):''}`;
    }
    const dep=p.tipo==='d'&&sit!=='informed'?servicosDepois(r):null;
    return `<div class="ap52u-cartao"><strong class="ap52u-cartao-codigo">${safe(protocoloDoPonto(p))}</strong><span class="ap52u-cartao-titulo">${safe(tituloDoPonto(p))}</span><span class="ap52u-cartao-meta">${safe(data?localData(data):'Data não informada')} · ${safe(info)}</span>${p.tipo==='d'?`<span class="ap52u-cartao-meta">Origem: ${safe(nomeOrigemId(r.origem_id))}</span>${htmlPrazoResposta(r)}`:''}${dep?`<span class="ap52u-cartao-conferir">${safe(textoDepois(dep,sit))}</span>`:''}<span class="ap52u-cartao-servico">${sug.nome?'Serviço sugerido pelo texto: '+safe(sug.nome):'Serviço a definir'}</span></div>`;
  }
  function prioridadesGrupo(grupo){
    const totals=new Map();
    for(const p of grupo){const chave=iconeDe(p).grupo,prio=URGENCIA[markerType(p)];
      const prev=totals.get(chave)||{grupo:chave,n:0,urgencia:9,exemplo:p};
      prev.n++;if(prio<prev.urgencia){prev.urgencia=prio;prev.exemplo=p;}
      totals.set(chave,prev);
    }
    return [...totals.values()].sort((a,b)=>b.n-a.n||a.urgencia-b.urgencia||a.grupo.localeCompare(b.grupo)).slice(0,3);
  }
  function irPara(latlng){if(!s.mapa)return;
    const alvo=Math.min(Math.max(s.mapa.getZoom(),17),18);
    if(movimentoReduzido())s.mapa.setView(latlng,alvo,{animate:false});
    else s.mapa.flyTo(latlng,alvo,{duration:.65});
  }
  async function carregarPontos(forcarServicos=false){if(!podeVer())return;const id=++s.consultaPontos,g=ac28Generation;
    by('controle-local').textContent='Carregando pontos com coordenadas…';
    // Somente SELECT, RLS da sessão. Paginação impede truncamento silencioso >1000.
    async function linhas(tabela,colunas){let saida=[],ultima=false,total=0;
      for(let ini=0;ini<MAX_PONTOS;ini+=400){if(!validoPontos(id,g))return null;
        let q=escopo(sb.from(tabela).select(colunas,{count:'exact'}).is('deleted_at',null).not('latitude','is',null).not('longitude','is',null));
        const ret=await q.order('id').range(ini,ini+399);if(ret.error)throw ret.error;
        if(!validoPontos(id,g))return null;if(!Number.isSafeInteger(ret.count))throw Error('Resposta de contagem incompleta.');
        total=ret.count;saida.push(...ret.data);if(saida.length>=total){ultima=true;break;}
      }return {itens:saida,total,completo:ultima};
    }
    try{
      const [pedidos,casos]=await Promise.all([
        linhas('demandas','id,gerencia,assunto,logradouro,numero,bairro,latitude,longitude,status,data_recebimento,protocolo,id_origem_migracao,origem_id,prazo'),
        linhas('casos_operacionais','id,gerencia,codigo,titulo,logradouro,numero,bairro,latitude,longitude,status,created_at,updated_at,data_conclusao')
      ]);
      if(!validoPontos(id,g)||!pedidos||!casos)return;
      const [cntD,cntC,cntA]=await Promise.all([
        escopo(sb.from('demandas').select('id',{count:'exact',head:true}).is('deleted_at',null)),
        escopo(sb.from('casos_operacionais').select('id',{count:'exact',head:true}).is('deleted_at',null)),
        escopo(sb.from('demandas').select('id',{count:'exact',head:true}).is('deleted_at',null).in('status',[...ABERTOS]))
      ]);
      s.abertos=!cntA.error&&Number.isSafeInteger(cntA.count)?cntA.count:null;
      if(!validoPontos(id,g))return;
      s.totais={d:cntD.error?pedidos.total:(cntD.count||0),c:cntC.error?casos.total:(cntC.count||0)};
      s.semPonto=Math.max(0,s.totais.d+s.totais.c-pedidos.total-casos.total);
      s.pontos=[...pedidos.itens.filter(coords).map(row=>({tipo:'d',row})),...casos.itens.filter(coords).map(row=>({tipo:'c',row}))];
      await carregarVinculosVisiveis(id,g);
      if(!validoPontos(id,g))return;
      s.iconeCache.clear();s.catalogoIcones=null;
      s.fallback=!(pedidos.completo&&casos.completo);
      renderContagens();filtrarPontos();void prepararIconesPontos(id,g);
      if(s.origemId){void contarOrigem();void carregarPedidosOrigem();}
      atualizarBarraMapa();void carregarRuasExecutadas(id,g,forcarServicos);
      if(s.fallback)avisar('Há mais pontos do que o limite desta consulta; o mapa mostra apenas parte deles.');
    }catch(e){if(!validoPontos(id,g))return;by('controle-local').textContent='Coordenadas indisponíveis';console.warn('[AP5.2/tela única] Falha ao ler pontos:',e?.code||'consulta');}
  }
  async function carregarVinculosVisiveis(id,g){
    const vl=new Map(),cl=new Map();let erroExec=false,erroCasos=false;
    // Uma leitura paginada por fonte, nunca uma consulta por marcador.
    async function paginar(fazer){const all=[];for(let ini=0;ini<10000;ini+=450){if(!validoPontos(id,g))return null;
      const resp=await fazer(ini);if(resp.error)throw resp.error;if(!Number.isSafeInteger(resp.count))throw Error('Contagem indisponível');
      all.push(...(resp.data||[]));if(all.length>=resp.count)return all;
    }throw Error('Limite de paginação atingido');}
    try{
      const links=await paginar(ini=>sb.from('servicos_demandas_vinculos').select('demanda_id,servico_id,servicos_executados!inner(id,data_execucao,servico_apresentacao)',{count:'exact'}).order('id').range(ini,ini+449));
      for(const l of links||[])if(l.demanda_id&&!vl.has(l.demanda_id)){const e=l.servicos_executados;vl.set(l.demanda_id,{servico:e?.servico_apresentacao,data:e?.data_execucao});}
    }catch(e){erroExec=true;console.warn('[AP5.2/vinculos] Execuções indisponíveis:',e?.code||'leitura');}
    try{
      const links=await paginar(ini=>escopo(sb.from('caso_demandas').select('demanda_id,caso_id,gerencia,casos_operacionais(status,codigo,updated_at,data_conclusao)',{count:'exact'}).is('deleted_at',null)).order('id').range(ini,ini+449));
      for(const l of links||[]){if(!l.demanda_id)continue;const obj=l.casos_operacionais;if(!obj)continue;const grupo=cl.get(l.demanda_id)||[];grupo.push({status:obj.status,codigo:obj.codigo,data:obj.data_conclusao||obj.updated_at});cl.set(l.demanda_id,grupo);}
    }catch(e){erroCasos=true;console.warn('[AP5.2/vinculos] Casos vinculados indisponíveis:',e?.code||'leitura');}
    if(!validoPontos(id,g))return;
    s.vinculosExec=vl;s.vinculosCaso=cl;s.vinculosIndisponiveis=erroExec;s.casoVinculosIndisponiveis=erroCasos;
    const aviso=by('vinculos-aviso');if(aviso){aviso.textContent=erroExec?'Não foi possível conferir as execuções; verde e luz podem estar desatualizados.':'';aviso.hidden=!erroExec;}
  }
  function renderContagens(){const arr=pontosDaOrigem();
    const counts={all:arr.length,alert:0,working:0,informed:0,neutral:0};for(const p of arr)counts[markerType(p)]++;
    for(const [k,n]of Object.entries(counts))by('n-'+k).textContent=String(n);
    const primeira=by('contagens').querySelector?.('[data-u-filtro=all]');
    if(primeira)primeira.firstChild.textContent=s.modoRua?'Tudo nesta rua ':'Tudo no mapa ';
    by('servicos-pill').hidden=!s.modoRua;
    if(s.modoRua)by('n-servicos').textContent=s.erro?.execucoes?'Indisponível':Number.isSafeInteger(s.totalExecucoes)?String(s.totalExecucoes):'Indisponível';
    // Pedidos e serviços separados: os botões de situação somam os pedidos; "Serviços feitos" conta as linhas das planilhas e as ruas.
    const rp=by('ruas-pill');if(rp){const R=s.ruas;rp.hidden=!(R.servicos&&!R.erro&&R.servPeriodo>0);rp.title=s.origemId?'Mostrar ou ocultar serviços históricos nas ruas dos pedidos. Vínculo com o pedido NÃO confirmado.':'Mostrar ou esconder no mapa os quarteirões com serviço feito';
      const rotulo=by('rotulo-ruas'),quant=by('n-historicos-origem');if(rotulo)rotulo.textContent=s.origemId?'Histórico na mesma rua':'Serviços no mapa';if(quant){quant.hidden=!s.origemId;quant.textContent=s.origemId&&s.origemPedidos?String(blocosHistoricosOrigem().length):'…';}
      rp.setAttribute('aria-pressed',String(!!R.ligadas));}
    atualizarResumoGeral();
    const nc=by('n-conferir');if(nc){const n=s.ruas.porRua.size?arr.filter(p=>p.tipo==='d'&&markerType(p)==='alert'&&servicosDepois(p.row)).length:0;nc.textContent=n?`(${n})`:'';}
    if(s.telaCheia)ajustarAlturaTelaCheia();
  }
  async function iniciarMapa(){if(s.mapa)return;try{
    await carregarLeafletMapa();if(!s.ativo)return;
    s.mapa=L.map(by('mapa'),{center:[-22.930,-43.630],zoom:11,minZoom:9,maxZoom:19,preferCanvas:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contribuidores'}).addTo(s.mapa);
    try{const geo=await carregarDadosMapaGerencias();L.geoJSON(geo,{style:()=>({color:'#53677b',weight:1.3,opacity:.65,fillOpacity:.035})}).addTo(s.mapa);}catch{}
    s.mapa.createPane('ap52uRuas');s.mapa.getPane('ap52uRuas').style.zIndex='410';
    s.ruas.renderer=L.canvas({pane:'ap52uRuas',tolerance:toqueGrosso()?10:4});s.ruas.camada=L.layerGroup();s.ruas.camadaOrigem=L.layerGroup();
    s.mapa.on('zoomend',()=>ajustarEspessuraRuas());
    s.camada=L.layerGroup().addTo(s.mapa);s.mapa.on('zoomend moveend',()=>desenharPontos());
    new ResizeObserver(()=>{if(s.mapa&&s.ativo)s.mapa.invalidateSize({pan:false});}).observe(by('mapa'));
    desenharPontos();desenharRuasExecutadas();if(s.modoRua&&s.rua?.ruas?.length)void destacarRua(s.rua.ruas);
  }catch(e){by('mapa-fallback').hidden=false;by('mapa-fallback').textContent='Mapa temporariamente indisponível. A consulta por rua continua funcionando na lista.';}}
  function movimentoReduzido(){return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}
  function filtrarPontos(){by('contagens').querySelectorAll('[data-u-filtro]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.uFiltro==='all'?!s.filtros.size:s.filtros.has(b.dataset.uFiltro))));desenharPontos();atualizarRuasVisiveis();}
  function desenharPontos(){if(!s.mapa||!s.camada)return;s.camada.clearLayers();
    const pontos=pontosDaOrigem().filter(p=>!s.filtros.size||s.filtros.has(markerType(p)));
    const grupos=new Map(),z=s.mapa.getZoom();
    for(const p of pontos){const pos=s.mapa.project([Number(p.row.latitude),Number(p.row.longitude)],z),chave=`${Math.floor(pos.x/45)},${Math.floor(pos.y/45)}`;
      if(!grupos.has(chave))grupos.set(chave,[]);grupos.get(chave).push(p);}
    for(const grupo of grupos.values()){
      if(grupo.length>1){
        const latlngs=grupo.map(p=>[Number(p.row.latitude),Number(p.row.longitude)]);
        const lat=latlngs.reduce((a,p)=>a+p[0],0)/grupo.length,lng=latlngs.reduce((a,p)=>a+p[1],0)/grupo.length;
        const top=prioridadesGrupo(grupo),largura=31+top.length*22;
        const html=`<span class="ap52u-aglomerado" aria-hidden="true">${top.map(x=>htmlMarcador(x.exemplo,true)).join('')}<b>${grupo.length}</b></span>`;
        const icon=L.divIcon({className:'ap52u-marca-wrap ap52u-grupo-wrap'+(s.luzLigada&&grupo.some(p=>['alert','working'].includes(markerType(p)))?' ap52u-grupo-halo':''),html,iconSize:[largura,30],iconAnchor:[largura/2,15]});
        const marca=L.marker([lat,lng],{icon,keyboard:true,title:`${grupo.length} registros próximos`}).addTo(s.camada);
        const el=marca.getElement?.();if(el)el.setAttribute('aria-label',`${grupo.length} registros próximos; clique para separar os pontos`);
        marca.on('click',()=>{
          const iguais=latlngs.every(v=>v[0]===latlngs[0][0]&&v[1]===latlngs[0][1]);
          if(iguais){const destino=Math.min(s.mapa.getZoom()+2,19);
            if(movimentoReduzido())s.mapa.setView([lat,lng],destino,{animate:false});
            else s.mapa.flyTo([lat,lng],destino,{duration:.65});
          }else{const bounds=L.latLngBounds(latlngs),opts={padding:[48,48],maxZoom:18};
            if(movimentoReduzido())s.mapa.fitBounds(bounds,{...opts,animate:false});
            else s.mapa.flyToBounds(bounds,{...opts,duration:.65});
          }
        });
      }else{
        const p=grupo[0],r=p.row,latlng=[Number(r.latitude),Number(r.longitude)];
        const icon=L.divIcon({className:'ap52u-marca-wrap',html:htmlMarcador(p),iconSize:[34,34],iconAnchor:[17,17]});
        const marca=L.marker(latlng,{icon,keyboard:true,title:tituloDoPonto(p)}).addTo(s.camada);
        const el=marca.getElement?.();if(el){
          el.setAttribute('aria-label',descricaoAcessivel(p));
          // O mouse abre o tooltip via Leaflet; foco pelo teclado usa o mesmo cartão.
          el.addEventListener('focus',()=>marca.openTooltip());
          el.addEventListener('blur',()=>marca.closeTooltip());
        }
        // Touch: não abrir tooltip acidentalmente; foco por teclado mantém aria-label.
        if(window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches){
          const ponto=s.mapa.latLngToContainerPoint(latlng),abaixo=ponto.y<160;
          marca.bindTooltip(htmlCartao(p),{direction:abaixo?'bottom':'top',offset:abaixo?[0,17]:[0,-17],opacity:1,className:'ap52u-cartao-tooltip'});
          marca.on('tooltipopen',()=>{const tt=marca.getTooltip(),rect=tt?.getElement?.()?.getBoundingClientRect?.(),barra=by('mapa')?.closest('.ap52u-mapa-wrap')?.querySelector('.ap52u-mapa-topo')?.getBoundingClientRect?.();
            const limite=Math.max(barra?.bottom||0,by('mapa')?.getBoundingClientRect?.().top||0);
            if(rect&&rect.top<limite+3&&tt.options.direction!=='bottom'){tt.options.direction='bottom';tt.options.offset=L.point(0,17);marca.closeTooltip();marca.openTooltip();}
          });
        }
        marca.on('click',()=>{s.pontoSelecionado=p;s.centro=latlng;s.raioKm=1;desenharRaio({reenquadrar:false});irPara(latlng);
          by('ver-detalhes').hidden=!s.telaCheia;
          // Mobile R4: a consulta da rua fica atrás da sobreposição em tela cheia.
          // Mostrar imediatamente um popup do próprio pedido/caso, como nas ruas verdes.
          // A consulta completa é iniciada quando a pessoa pedir para abrir a ficha.
          if(s.telaCheia){abrirPopupMarcador(p,latlng);return;}
          if(s.modoRua){renderRua();return;}
          s.rua={nome:r.logradouro||'Rua não informada',chave:chaveRua(r.logradouro),incompleto:false};
          by('busca').value=r.logradouro||'';void pesquisarDoMarcador(p);
        });
      }
    }
  }
  async function pesquisarDoMarcador(p){const g=ac28Generation,token=s.consulta+1;
    // Não enquadrar a rua inteira após clicar no ponto; conservar o círculo selecionado.
    by('busca').value=p.row.logradouro||'';
    const consultaOk=await pesquisar({preservarPonto:true});
    if(consultaOk!==true)return false; // Não apagar 'Consulta indisponível' após falha do marcador.
    if(!s.ativo||g!==ac28Generation||token!==s.consulta)return false;
    desenharRaio({reenquadrar:false});renderRua();return true;
  }
  // Mobile R6: a ficha de um pedido aberto no mapa é consultada pelo UUID do pino.
  // Não depende da busca por rua, do filtro de origem nem das 200 linhas da lista.
  async function abrirFichaPedidoPeloId(p,botao){
    if(!p||p.tipo!=='d')return;
    const id=String(p.row?.id||''),g=ac28Generation;
    const atual=()=>s.ativo&&s.telaCheia&&g===ac28Generation&&
      s.pontoSelecionado?.tipo==='d'&&String(s.pontoSelecionado.row.id)===id;
    const erroNoPopup=mensagem=>{
      if(!atual())return;
      const pop=botao?.closest?.('.ap52u-ponto-pop');
      const aviso=pop?.querySelector?.('[data-u-erro-ficha]');
      if(aviso){aviso.textContent=mensagem;aviso.hidden=false;}
      if(botao){botao.disabled=false;botao.textContent='Abrir ficha do pedido';}
    };
    if(!id||!atual())return;
    if(!podeVer()||typeof dem52Pode!=='function'||!dem52Pode()){
      erroNoPopup('Você não tem permissão para consultar esta ficha. O mapa permanece aberto.');return;
    }
    if(dem52c?.form){erroNoPopup('Conclua ou cancele a edição em andamento antes de abrir outra ficha.');return;}
    try{
      // Escopo da gerência + RLS continuam no Supabase; não aplicar origem, rua nem paginação.
      const q=escopo(sb.from('demandas').select(DEM52_COLUNAS).is('deleted_at',null).eq('id',id));
      const resposta=await q.maybeSingle();
      if(!atual())return;
      if(resposta.error)throw resposta.error;
      const d=resposta.data;
      if(!d||String(d.id)!==id){erroNoPopup('Este pedido não está mais disponível ou você não tem acesso. O mapa permanece aberto.');return;}
      // Evitar que dados antigos no mapa mostrem um código divergente da ficha atual.
      const codigoMapa=String(protocoloDoPonto(p));
      const codigoFicha=String(d.id_origem_migracao||d.protocolo||'Pedido sem código');
      if(codigoMapa!==codigoFicha){
        erroNoPopup('O código deste pedido foi atualizado. Atualize o mapa para consultar a ficha correta.');return;
      }
      // Mesmo caminho de exibição de ficha da lista, mas com o registro exato validado.
      dem52c.aba='demandas';dem52c.modo=null;dem52cSincronizar();
      dem52.confirmado=d;dem52.selecionada=d.id;
      dem52RenderContexto();
      if(!atual())return;
      alterarTelaCheia(false);
      modo('demanda');
      document.querySelector('.dem52-context-body')?.scrollTo?.({top:0});
    }catch(e){
      if(atual()){
        console.warn('[AP52/Mobile R6] Falha na leitura da ficha por ID:',e?.code||'consulta');
        erroNoPopup('Não foi possível consultar este pedido. Verifique a conexão e tente novamente. O mapa permanece aberto.');
      }
    }
  }
  async function abrirRegistroDoMapa(p,{ficha=false,botao=null}={}){
    if(ficha&&p?.tipo==='d'){await abrirFichaPedidoPeloId(p,botao);return;}
    if(!p||!podeVer())return;
    const id=p.row.id;
    s.mapa?.closePopup?.();
    const ok=await pesquisarDoMarcador(p);
    // Uma seleção posterior não pode abrir a ficha de um marcador anterior.
    if(!s.ativo||s.pontoSelecionado?.row?.id!==id)return;
    if(s.telaCheia)alterarTelaCheia(false);
    if(ficha&&ok){
      if(p.tipo==='c'){await abrirCaso(id);return;}
      if(s.encontrados.some(d=>d.id===id)){abrirDemanda(id);return;}
      // Não substituir o pedido por outra demanda da rua.
      avisar('A ficha deste pedido não apareceu na consulta da rua. Confira o código e consulte a lista.',true);
    }
    by('rua')?.scrollIntoView?.({block:'start',behavior:movimentoReduzido()?'instant':'smooth'});
  }
  function abrirPopupMarcador(p,latlng){if(!s.mapa)return;
    const r=p.row;
    const endereco=[r.logradouro,r.numero?'nº '+r.numero:null,r.bairro].filter(Boolean).map(safe).join(' · ');
    const texto=`<div class="ap52u-ponto-pop">${htmlCartao(p)}${endereco?`<div class="ap52u-ponto-endereco">${endereco}</div>`:''}<button type="button" data-u-abrir-registro="1">${p.tipo==='d'?'Abrir ficha do pedido':'Abrir ficha do caso'}</button><p class="ap52u-ponto-erro" data-u-erro-ficha role="alert" aria-live="assertive" hidden></p></div>`;
    const pop=L.popup({className:'ap52u-ponto-popup',maxWidth:330,minWidth:215,autoPan:true,
      autoPanPaddingTopLeft:[16,105],autoPanPaddingBottomRight:[16,88]})
      .setLatLng(latlng).setContent(texto).openOn(s.mapa);
    const b=pop.getElement?.()?.querySelector?.('[data-u-abrir-registro]');
    b?.addEventListener('click',()=>{if(b.disabled)return;b.disabled=true;b.textContent='Carregando ficha…';void abrirRegistroDoMapa(p,{ficha:true,botao:b});});
  }
  function distancia(a,b){const R=6371000,deg=Math.PI/180,phi1=a[0]*deg,phi2=b[0]*deg,dphi=(b[0]-a[0])*deg,dlambda=(b[1]-a[1])*deg;
    const t=Math.sin(dphi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlambda/2)**2;return R*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t));}
  function removerRaio(){if(s.raio&&s.mapa)s.mapa.removeLayer(s.raio);s.raio=null;desenharPontos();}
  function desenharRaio({animar=false,reenquadrar=true}={}){if(!s.mapa)return;if(s.raio)s.mapa.removeLayer(s.raio);s.raio=null;
    if(s.centro&&s.raioKm>0){
      s.raio=L.circle(s.centro,{radius:s.raioKm*1000,color:'#1f4e79',weight:2,fillOpacity:.045,dashArray:'7 5'}).addTo(s.mapa);
      // Manter o ponto e o raio em destaque, sem reenquadrar a extensão inteira da rua.
      if(reenquadrar){const bounds=s.raio.getBounds();const opcoes={padding:[28,28],maxZoom:16};
        if(animar&&!movimentoReduzido())s.mapa.flyToBounds(bounds,{...opcoes,duration:.65});
        else s.mapa.fitBounds(bounds,{...opcoes,animate:false});
      }
    }
    desenharPontos();
  }
  function resumoRaio(){if(!s.centro||!s.raioKm)return 'Raio desligado.';
    const arr=s.pontos.filter(p=>distancia(s.centro,[Number(p.row.latitude),Number(p.row.longitude)])<=s.raioKm*1000);
    const alert=arr.filter(p=>markerType(p)==='alert').length,work=arr.filter(p=>markerType(p)==='working').length,feito=arr.filter(p=>markerType(p)==='informed').length,other=arr.filter(p=>markerType(p)==='neutral').length;
    return `${arr.length} ponto(s) localizado(s) em até ${s.raioKm} km: ${alert} a fazer, ${work} em programação/execução, ${feito} executado(s), ${other} encerrado(s) ou em outras situações. ${s.semPonto} registro(s) sem coordenadas não entram nessa contagem. Sem vínculo formal, execução não é comprovação do pedido.`;
  }
  function escolherPonto(id){const p=s.pontos.find(p=>p.row.id===id);if(!p)return;s.pontoSelecionado=p;s.centro=[Number(p.row.latitude),Number(p.row.longitude)];s.raioKm=1;
    // A escolha pela lista deve mostrar o registro mesmo que outro filtro estivesse ativo.
    if(s.filtros.size){s.filtros.clear();s.visao='all';filtrarPontos();}
    desenharRaio({reenquadrar:false});irPara(s.centro);renderRua();}

  // ===== 4.9 — Ruas com serviço nas planilhas (verde) e aviso "conferir" =====
  // Fonte: servicos_executados (planilhas BDS). O traçado vem do catálogo municipal.
  // Registro de planilha mostra que houve serviço NA RUA; não diz qual pedido foi atendido.
  const COR_RUA='#15803d';
  function toqueGrosso(){return !!window.matchMedia?.('(pointer: coarse)')?.matches;}
  function hoverFino(){return !!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches;}
  function espessuraRua(z){return z<=12?2.5:z<=14?3.5:z<=16?5:6;}
  function dataLocalISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function corteRuas(){const dias=Number(s.ruas.periodo)||0;if(!dias)return '';const d=new Date();d.setDate(d.getDate()-dias);return dataLocalISO(d);}
  function rotuloPeriodo(){return ({30:'nos últimos 30 dias',90:'nos últimos 90 dias',365:'nos últimos 12 meses',0:'em todo o histórico'})[Number(s.ruas.periodo)||0]||'';}
  // Ruas homônimas no mesmo bairro só contam como uma quando os trechos se tocam (pontas a menos de 25 m).
  function trechosContiguos(entradas,ids){const pontas=id=>entradas.filter(e=>String(e.id)===id).flatMap(e=>(e.trechos||[]).flatMap(t=>(t.paths||[]).flatMap(p=>p.length?[p[0],p[p.length-1]]:[])));
    const P=new Map(ids.map(id=>[id,pontas(id)])),pai=new Map(ids.map(id=>[id,id])),raiz=i=>pai.get(i)===i?i:raiz(pai.get(i));
    const perto=(a,b)=>Math.hypot((a[0]-b[0])*102000,(a[1]-b[1])*111000)<25;
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(P.get(ids[i]).some(a=>P.get(ids[j]).some(b=>perto(a,b))))pai.set(raiz(ids[i]),raiz(ids[j]));
    return new Set(ids.map(raiz)).size===1;}
  // Como o Consolidado: nome limpo do catálogo e, com homônimas, decide pelo bairro. Também aceita nome sem tipo quando só há um
  // tipo no catálogo (como a busca). Sem certeza, não desenha: o registro aparece em "sem traçado certo".
  function resolverRegistroRua(logradouro,bairro){const R=s.ruas;if(R.memoRef!==s.catalogo){R.memo=new Map();R.memoRef=s.catalogo;}
    const mk=String(logradouro||'')+'|'+String(bairro||'');if(R.memo.has(mk))return R.memo.get(mk);
    let out=null;const ix=indiceCatalogo();
    if(ix&&logradouro){const pc=porChaveCatalogo();let k=limparNomeRua(logradouro),c=pc.get(k);
      if(!c){const t=ix.semTipo.get(k);if(t&&t.size===1){k=[...t][0];c=pc.get(k);}}
      if(c){const b=norm(bairro),ids=[...new Set(c.map(x=>String(x.id)))];let grupo=null;
        if(ids.length===1)grupo=ids;
        else{const nb=[...new Set(c.filter(x=>norm(x.bairro)===b).map(x=>String(x.id)))];if(nb.length===1||(nb.length>1&&trechosContiguos(c,nb)))grupo=nb;}
        if(grupo){const doGrupo=c.filter(x=>grupo.includes(String(x.id))),noBairro=doGrupo.filter(x=>norm(x.bairro)===b),entradas=noBairro.length?noBairro:doGrupo;
          out={rua:grupo.slice().sort().join('+'),bairro:noBairro.length?b:'*',nome:entradas[0].nome,bairroCat:noBairro.length?noBairro[0].bairro:'',entradas,precisaBairro:ids.length>1};}
      }
    }
    R.memo.set(mk,out);return out;}
  async function lerServicosMapa(id,g,forcar=false){
    if(window.AP52ServicosCacheE2)return window.AP52ServicosCacheE2.ler({forcar,valido:()=>validoPontos(id,g)});
    const cols='id,logradouro,bairro,sub_bairro,gerencia,gerencia_territorial,territorio_cl,territorio_criterio,data_execucao,servico_apresentacao,servico_original,numero',LIMITE=40000;
    const consulta=(ini,fim,contar)=>{let q=sb.from('servicos_executados').select(cols,contar?{count:'exact'}:undefined);
      if(!dem52Global()){const gc=acesso28?.user?.gerencia;if(!gc)throw Error('Escopo indisponível');q=q.or('gerencia.eq."'+gc+'",gerencia_territorial.eq."'+gc+'"');}
      return q.order('id').range(ini,fim);};
    const r0=await consulta(0,999,true);if(r0.error)throw r0.error;if(!Number.isSafeInteger(r0.count))throw Error('Contagem indisponível');
    if(!validoPontos(id,g))return null;
    const total=r0.count,mapa=new Map((r0.data||[]).map(x=>[x.id,x]));if(total>LIMITE)throw Error('Mais de '+LIMITE+' serviços');
    // O servidor pode devolver menos linhas por página do que o pedido: o passo é o tamanho real da 1ª página.
    const passo=(r0.data||[]).length;if(mapa.size<total&&!passo)throw Error('Página vazia');
    const inicios=[];for(let ini=passo;ini<total;ini+=passo)inicios.push(ini);
    for(let i=0;i<inicios.length;i+=4){const lote=await Promise.all(inicios.slice(i,i+4).map(ini=>consulta(ini,ini+passo-1,false)));
      if(!validoPontos(id,g))return null;for(const r of lote){if(r.error)throw r.error;for(const x of r.data||[])mapa.set(x.id,x);}}
    if(mapa.size<total)throw Error('Leitura incompleta');
    return [...mapa.values()];}
  // R29: somente CL que pertence ao território oficialmente indicado no R3 pode gerar cobertura cruzada.
  async function carregarR3Territorial(){const R=s.ruas;if(R.r3)return R.r3;
    const resp=await fetch('./ruas-gerencias-ap52.json?v=20261112-of3',{cache:'force-cache'});
    if(!resp.ok)throw Error('R3 territorial indisponível');const j=await resp.json();
    if(!j?.g||j.versao!=='20261112-of3')throw Error('Versão R3 não homologada');
    R.r3=Object.fromEntries(Object.entries(j.g).map(([gc,ids])=>[gc,new Set(ids.map(String))]));return R.r3;}
  function servicoTerritorioR29(x){const R=s.ruas,cl=String(x.territorio_cl||'');
    if(!x.gerencia_territorial||!cl||!['R3_PONTO','R3_RUA_EXCLUSIVA','R3_TRECHO_CONFIRMADO'].includes(x.territorio_criterio))return null;
    if(!R.r3?.[x.gerencia_territorial]?.has(cl))return null;
    // CL com trechos em mais de uma cor exige geometria do ponto/trecho: não pintar a rua inteira por aproximação.
    if(Object.values(R.r3).filter(ids=>ids.has(cl)).length!==1)return null;
    if(R.r29PorClRef!==s.catalogo){R.r29PorClRef=s.catalogo;R.r29PorCl=new Map();
      for(const e of s.catalogo||[]){const k=String(e.id);if(!R.r29PorCl.has(k))R.r29PorCl.set(k,[]);R.r29PorCl.get(k).push(e);}}
    const entradas=R.r29PorCl?.get(cl)||[];if(!entradas.length)return null;
    return {rua:cl,bairro:'*',nome:entradas[0].nome,bairroCat:entradas[0].bairro||'',entradas,precisaBairro:false};}
  function r29NoTerritorioVisivel(x){const gc=acesso28?.user?.gerencia;
    if(dem52Global())return true;return x.gerencia_territorial?x.gerencia_territorial===gc:x.gerencia===gc;}
  function chaveSemTracado(logradouro,bairro){return 'sem:'+limparNomeRua(logradouro)+'|'+norm(bairro);}
  // Chave de "uma rua" para contar ruas executadas (mapa e Consolidado usam a mesma): a rua do catálogo, ou nome + bairro quando não há traçado certo.
  function ruaDoServico(logradouro,bairro,registro){const x=registro||{},r=x.gerencia_territorial?servicoTerritorioR29(x):resolverRegistroRua(logradouro,bairro);
    return r?'rua:'+r.rua:chaveSemTracado(logradouro,bairro);}
  // Quarteirão do serviço: o trecho do catálogo cuja faixa de numeração tem o número da planilha (ou fica a até 30 números dele).
  // Conferido com 220 serviços reais com número: 85% acham o quarteirão. Sem número, o serviço fica só na lista da rua.
  const TOLERANCIA_NUMERO=30;
  function numerosDoServico(v){return (String(v||'').match(/\d+/g)||[]).slice(0,3).map(Number).filter(n=>n>0&&n<100000);}
  function distanciaFaixa(n,f){let d=Infinity;if(!Array.isArray(f))return d;for(const [a,b] of [[f[0],f[1]],[f[2],f[3]]]){if(a==null||b==null)continue;const lo=Math.min(a,b),hi=Math.max(a,b);d=Math.min(d,n<lo?lo-n:n>hi?n-hi:0);}return d;}
  function larguraFaixa(f){let w=Infinity;for(const [a,b] of [[f[0],f[1]],[f[2],f[3]]])if(a!=null&&b!=null)w=Math.min(w,Math.abs(b-a));return w;}
  function rotuloFaixa(f){const v=(f||[]).filter(x=>x!=null);if(!v.length)return '';const lo=Math.min(...v),hi=Math.max(...v);return lo===hi?`nº ${lo}`:`nº ${lo} a ${hi}`;}
  function quarteiroes(r,numero){const out=[];
    for(const n of numerosDoServico(numero)){let melhor=null,md=Infinity,mw=Infinity;
      for(const e of r.entradas)for(const t of e.trechos||[]){const d=distanciaFaixa(n,t.faixas);if(d>TOLERANCIA_NUMERO)continue;const w=larguraFaixa(t.faixas);
        if(d<md||(d===md&&w<mw)){melhor={t,e};md=d;mw=w;}}
      if(melhor&&!out.some(x=>x.t===melhor.t))out.push(melhor);}
    return out;}
  function montarRuas(){const R=s.ruas;R.blocos=new Map();R.porRua=new Map();R.depois=new Map();R.semItens=[];R.itens=[];R.chaveRua=null;const sem=new Map();
    for(const x of R.servicos||[]){if(!r29NoTerritorioVisivel(x))continue;
      const r=x.gerencia_territorial?servicoTerritorioR29(x):resolverRegistroRua(x.logradouro,x.bairro);
      const item={data:String(x.data_execucao||'').slice(0,10),servico:x.servico_apresentacao||x.servico_original||'Serviço registrado',numero:x.numero||'',bairroN:r?r.bairro:'*',gerencia:String(x.gerencia||''),territorio:x.gerencia_territorial||null,apoio:!!(x.gerencia_territorial&&x.gerencia_territorial!==x.gerencia),rua:r?'rua:'+r.rua:chaveSemTracado(x.logradouro,x.bairro),noMapa:false};
      R.itens.push(item);
      if(!r){const nome=String(x.logradouro||'Logradouro não informado').trim();sem.set(nome,(sem.get(nome)||0)+1);R.semItens.push(item);continue;}
      if(!R.porRua.has(r.rua))R.porRua.set(r.rua,[]);R.porRua.get(r.rua).push(item);
      for(const {t,e} of quarteiroes(r,x.numero)){const k=String(t.id);let b=R.blocos.get(k);
        if(!b){b={chave:k,t,catId:String(e.id),nome:e.nome,bairroCat:e.bairro||'',precisaBairro:r.precisaBairro,faixa:rotuloFaixa(t.faixas),itens:[],periodo:[],latlngs:null,linha:null};R.blocos.set(k,b);}
        b.itens.push(item);item.noMapa=true;}}
    for(const b of R.blocos.values())b.itens.sort((a,c)=>c.data.localeCompare(a.data));
    for(const l of R.porRua.values())l.sort((a,c)=>c.data.localeCompare(a.data));
    R.semTracado=[...sem.entries()].sort((a,b)=>b[1]-a[1]);}
  // Serviços registrados na mesma rua (e no mesmo bairro, quando o catálogo separa) na data do pedido ou depois.
  function servicosDepois(row){const R=s.ruas;if(!row?.id||!R.porRua.size)return null;if(R.depois.has(row.id))return R.depois.get(row.id);
    const ini=String(row.data_recebimento||'').slice(0,10);let out=null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(ini)){const r=resolverRegistroRua(row.logradouro,row.bairro);
      if(r){const lista=(R.porRua.get(r.rua)||[]).filter(x=>x.data>=ini&&(r.bairro==='*'||x.bairroN==='*'||x.bairroN===r.bairro));if(lista.length)out={total:lista.length,itens:lista.slice(0,2)};}}
    R.depois.set(row.id,out);return out;}
  function textoDepois(dep,sit){const lista=dep.itens.map(x=>`${x.servico} (${localData(x.data)})`).join(', ')+(dep.total>dep.itens.length?` e mais ${dep.total-dep.itens.length}`:'');
    return (sit==='alert'||sit==='working'?'Há serviço nesta rua depois do pedido — conferir: ':'A rua teve serviço depois do pedido: ')+lista;}
  function htmlDepoisLista(x){if(!x||markerType({tipo:'d',row:x})==='informed')return '';const dep=servicosDepois(x);if(!dep)return '';
    return `<em class="ap52u-conferir">${safe(textoDepois(dep,markerType({tipo:'d',row:x})))}</em>`;}
   // E1: somente memória desta aba, nunca localStorage/IndexedDB; isolamento por identidade, escopo e geração.
   // Retorno válido apenas para listagem integral concluída e com até 2 minutos.
   function snapshotServicosCacheE1(){
     const R=s.ruas,meta=R.escopoCacheE1,u=acesso28?.user;
     if(!dem52Pode()||R.carregando||R.erro||!Array.isArray(R.servicos)||!meta||!u)return null;
     if(!Number.isFinite(meta.ts)||Date.now()-meta.ts<0||Date.now()-meta.ts>120000)return null;
     if(meta.uid!==u.user_id||meta.gc!==u.gerencia||meta.global!==dem52Global()||meta.geracao!==ac28Generation)return null;
     return R.servicos.slice();
   }
  async function carregarRuasExecutadas(id,g,forcar=false){const R=s.ruas;R.carregando=true;atualizarResumoRuas();
    let linhas=null,erro=null;
    try{[linhas]=await Promise.all([lerServicosMapa(id,g,forcar),carregarCatalogo(),carregarR3Territorial()]);}catch(e){erro=e;}
    if(!validoPontos(id,g))return;
    R.carregando=false;
    if(erro||!linhas){R.erro=true;R.servicos=null;R.escopoCacheE1=null;R.blocos=new Map();R.itens=[];R.porRua=new Map();R.depois=new Map();R.semTracado=[];R.semItens=[];R.totalRuas=0;R.servPeriodo=0;R.servNoMapa=0;
      console.warn('[AP5.2/ruas verdes] Serviços das planilhas indisponíveis:',erro?.code||erro?.message||'leitura');}
    else{
      // Em etapas curtas, para não travar a tela no celular (o catálogo tem 14 mil trechos).
      const pausa=()=>new Promise(r=>setTimeout(r,0));
      indiceCatalogo();await pausa();porChaveCatalogo();await pausa();if(!validoPontos(id,g))return;
      R.erro=false;R.servicos=linhas;R.escopoCacheE1={uid:acesso28?.user?.user_id,gc:acesso28?.user?.gerencia,global:dem52Global(),geracao:ac28Generation,ts:Date.now()};montarRuas();await pausa();if(!validoPontos(id,g))return;}
    desenharRuasExecutadas();renderContagens();desenharPontos();if(s.rua&&!s.rua.ambiguo)renderRua();}
  function textoTooltipRua(u){const n=u.periodo.length;return `<strong>${safe(u.nome)}</strong>${u.faixa?' · '+safe(u.faixa):''}<br>${n} ${n===1?'serviço feito':'serviços feitos'} neste quarteirão ${safe(rotuloPeriodo())}`;}
  function htmlPopupRua(u){const n=u.periodo.length,lista=u.periodo.slice(0,3).map(x=>`<li><b>${safe(x.servico)}</b><span>${safe(localData(x.data))}${x.numero?' · nº '+safe(x.numero):''}</span>${x.apoio?`<small>Apoio entre Gerências — Serviço executado pela ${safe(x.gerencia)} em apoio à ${safe(x.territorio)}</small>`:''}</li>`).join('');
    const mesmaRua=s.modoRua&&idsRuaPesquisada().has(u.catId);
    return `<div class="ap52u-rua-pop"><strong>${safe(u.nome)}</strong><span class="ap52u-rua-pop-meta">${[u.faixa,u.bairroCat].filter(Boolean).map(safe).join(' · ')}</span><span class="ap52u-rua-pop-meta">${n} ${n===1?'serviço feito':'serviços feitos'} neste quarteirão ${safe(rotuloPeriodo())}</span><ul>${lista}</ul>${n>3?`<small>E mais ${n-3}.</small>`:''}<small>Mostra que houve serviço aqui, não qual pedido foi atendido.</small>${s.origemId?'<small><b>Filtro por origem:</b> serviço histórico na mesma rua; vínculo com o pedido não confirmado.</small>':''}${mesmaRua?'':'<button type="button" data-u-abrir-rua="1">Ver esta rua</button>'}</div>`;}
  function abrirPopupRua(u,latlng){if(!s.mapa)return;
    // A janela não pode ficar sob a barra de cima do mapa (Atualizar / Tela cheia).
    const caixa=by('mapa')?.getBoundingClientRect?.(),barra=by('mapa')?.closest('.ap52u-mapa-wrap')?.querySelector('.ap52u-mapa-topo')?.getBoundingClientRect?.();
    const topo=Math.max(24,caixa&&barra?Math.round(barra.bottom-caixa.top)+10:24);
    const pop=L.popup({className:'ap52u-rua-popup',maxWidth:300,minWidth:220,autoPanPaddingTopLeft:[16,topo],autoPanPaddingBottomRight:[16,16]}).setLatLng(latlng).setContent(htmlPopupRua(u)).openOn(s.mapa);
    const el=pop.getElement?.();const b=el?.querySelector?.('[data-u-abrir-rua]');
    if(b)b.addEventListener('click',()=>{s.mapa.closePopup();by('busca').value=u.nome;void pesquisar({bairroEscolhido:u.precisaBairro&&u.bairroCat?u.bairroCat:null});});}
  // Período e contagens (não dependem do mapa: o resumo conta mesmo se o mapa falhar).
  function contarRuas(){const R=s.ruas,corte=corteRuas(),ruas=new Set();let serv=0,noMapa=0,blocos=0;
    for(const it of R.itens||[]){if(corte&&it.data<corte)continue;serv++;ruas.add(it.rua);if(it.noMapa)noMapa++;}
    for(const b of R.blocos.values()){b.periodo=corte?b.itens.filter(x=>x.data>=corte):b.itens;if(!b.periodo.length)continue;blocos++;
      if(!b.latlngs)b.latlngs=(b.t.paths||[]).filter(p=>p.length>1).map(p=>p.map(([lng,lat])=>[lat,lng]));}
    R.servPeriodo=serv;R.totalRuas=ruas.size;R.servNoMapa=noMapa;R.blocosPeriodo=blocos;}
  function numeroBR(n){return Number(n||0).toLocaleString('pt-BR');}
  function desenharRuasExecutadas(){const R=s.ruas;contarRuas();atualizarResumoRuas();atualizarResumoGeral();if(!s.mapa||!R.camada)return;
    R.camada.clearLayers();R.camadaRua?.clearLayers();R.camadaOrigem?.clearLayers();R.chaveRua=null;R.visiveis=0;
    const z=s.mapa.getZoom(),hover=hoverFino();
    for(const b of R.blocos.values()){b.linha=null;if(!b.periodo.length||!b.latlngs?.length)continue;R.visiveis++;
      const linha=L.polyline(b.latlngs,{renderer:R.renderer,color:COR_RUA,weight:espessuraRua(z),opacity:.85,lineCap:'round',lineJoin:'round'});
      linha.on('click',e=>abrirPopupRua(b,e.latlng));
      if(hover){linha.bindTooltip(()=>textoTooltipRua(b),{sticky:true,direction:'top',offset:[0,-8],className:'ap52u-rua-tooltip'});
        linha.on('mouseover',()=>linha.setStyle({weight:espessuraAtual()+3,opacity:1}));
        linha.on('mouseout',()=>linha.setStyle({weight:espessuraAtual(),opacity:.85}));}
      b.linha=linha;R.camada.addLayer(linha);}
    atualizarRuasVisiveis();atualizarResumoRuas();}
  // Na rua pesquisada o verde fica mais grosso, para aparecer por cima do azul.
  function espessuraAtual(){return espessuraRua(s.mapa.getZoom())+(s.modoRua?4:0);}
  function ajustarEspessuraRuas(redesenhar=false){const R=s.ruas;if(!s.mapa)return;const w=espessuraAtual();
    // No zoom, roda antes do redesenho do próprio Leaflet (zoomend vem antes de moveend): basta trocar a espessura.
    for(const b of R.blocos.values())if(b.linha){if(redesenhar&&b.linha._map)b.linha.setStyle({weight:w});else b.linha.options.weight=w;}}
  function idsRuaPesquisada(){return new Set((s.rua?.ids||[]).map(String));}
  // Visão geral: todos os quarteirões com serviço. Rua pesquisada: só os quarteirões dela, por cima do azul. O botão "Serviços no mapa" liga e desliga.
  function blocosHistoricosOrigem(){
    const out=[];if(!s.origemId||!s.origemPedidos||!s.origemHistoricoChaves.size)return out;
    const ids=s.modoRua?idsRuaPesquisada():null;
    for(const b of s.ruas.blocos.values()){
      if(!b.linha||!b.periodo.length||(ids&&!ids.has(b.catId)))continue;
      if(b.periodo.some(it=>s.origemHistoricoChaves.has(it.gerencia+'|'+it.rua)))out.push(b);
    }
    return out;
  }
  function atualizarRuasVisiveis(){const R=s.ruas;if(!s.mapa||!R.camada)return;if(!R.camadaRua)R.camadaRua=L.layerGroup();if(!R.camadaOrigem)R.camadaOrigem=L.layerGroup();
    const geral=!s.origemId&&!s.modoRua&&R.ligadas&&R.visiveis>0,naRua=!s.origemId&&s.modoRua&&R.ligadas;
    if(naRua){const ids=idsRuaPesquisada(),k=[...ids].sort().join(',');
      if(R.chaveRua!==k){if(s.mapa.hasLayer(R.camadaRua))s.mapa.removeLayer(R.camadaRua);R.camadaRua.clearLayers();for(const b of R.blocos.values())if(b.linha&&ids.has(b.catId))R.camadaRua.addLayer(b.linha);R.chaveRua=k;}}
    const verRua=naRua&&R.camadaRua.getLayers().length>0;
    // A mesma geometria pode pertencer às camadas geral e por origem; remover a seletiva ANTES de ligar a geral.
    if(s.mapa.hasLayer(R.camadaOrigem))s.mapa.removeLayer(R.camadaOrigem);
    R.camadaOrigem.clearLayers();
    if(!geral&&s.mapa.hasLayer(R.camada)){s.mapa.closePopup();s.mapa.removeLayer(R.camada);}
    if(!verRua&&s.mapa.hasLayer(R.camadaRua))s.mapa.removeLayer(R.camadaRua);
    if(geral&&!s.mapa.hasLayer(R.camada)){ajustarEspessuraRuas();R.camada.addTo(s.mapa);}
    if(verRua&&!s.mapa.hasLayer(R.camadaRua)){ajustarEspessuraRuas();R.camadaRua.addTo(s.mapa);}
    if(s.origemId&&R.ligadas){for(const b of blocosHistoricosOrigem())R.camadaOrigem.addLayer(b.linha);
      if(R.camadaOrigem.getLayers().length){ajustarEspessuraRuas();R.camadaOrigem.addTo(s.mapa);}}
  }
  function atualizarResumoRuas(){const el=by('ruas-resumo');if(!el)return;const R=s.ruas;
    if(s.origemId){
      if(s.origemPedidosErro){el.textContent='Não foi possível verificar os endereços dos pedidos desta origem.';return;}
      if(!s.origemPedidos){el.textContent='Conferindo ruas dos pedidos antes de mostrar serviços históricos…';return;}
      const blocos=blocosHistoricosOrigem();
      el.textContent=`${blocos.length} quarteirão(ões) com serviços históricos nas ruas dos pedidos de ${nomeOrigem()}, no período selecionado. A existência de serviço na rua NÃO confirma atendimento ao pedido.`;return;}
    if(R.carregando&&!R.servicos){el.textContent='Carregando os serviços feitos…';return;}
    if(R.erro){el.textContent='Não foi possível carregar os serviços das planilhas; o verde não aparece. Use “Atualizar”.';return;}
    if(!R.servicos){el.textContent='';return;}
    if(!s.catalogo?.length){el.textContent='Traçados das ruas indisponíveis; o verde não aparece.';return;}
    const t=R.servPeriodo,m=R.servNoMapa;
    el.textContent=`${numeroBR(m)} dos ${numeroBR(t)} serviços ${rotuloPeriodo()} aparecem no mapa, no quarteirão do número. Os outros ${numeroBR(t-m)} não têm número na planilha (ou o número não foi achado no catálogo): estão na busca da rua e no Consolidado.`;}
  // Frase-resumo no topo: o tamanho do trabalho (serviços feitos) e dos pedidos, em uma linha.
  function atualizarResumoGeral(){const el=by('resumo-geral');if(!el)return;const R=s.ruas,partes=[];
    const quem=typeof dem52Global==='function'&&!dem52Global()&&acesso28?.user?.gerencia?acesso28.user.gerencia:'AP5.2';
    if(s.origemId){const t=s.origemTotal;
      partes.push(t?.id===s.origemId&&Number.isSafeInteger(t.total)?`<b>${numeroBR(t.total)}</b> pedidos de <b>${safe(nomeOrigem())}</b>${Number.isSafeInteger(t.abertos)?`, <b>${numeroBR(t.abertos)}</b> aguardando`:''}`:`Pedidos de <b>${safe(nomeOrigem())}</b> · conferindo total`);
    }else{
      if(R.servicos&&!R.erro)partes.push(`<b>${numeroBR(R.servPeriodo)}</b> serviços feitos em <b>${numeroBR(R.totalRuas)}</b> ${R.totalRuas===1?'rua':'ruas'} ${safe(rotuloPeriodo())}`);
      if(Number.isSafeInteger(s.totais?.d)&&s.totais.d>0)partes.push(`<b>${numeroBR(s.totais.d)}</b> pedidos no sistema${Number.isSafeInteger(s.abertos)?`, <b>${numeroBR(s.abertos)}</b> esperando`:''}`);
    }
    el.hidden=!partes.length;el.innerHTML=partes.length?`<strong>${safe(quem)}</strong> · ${partes.join(' · ')}`:'';}
  // Acesso ao estado apenas para testes locais; sem métodos que gravem no banco.
  window.AP52TelaUnicaA={pesquisar,carregarPontos,carregarCatalogo,snapshotServicosCacheE1,definirOrigem,origemSelecionada:()=>s.origemId,pedidosOrigem:()=>s.origemPedidos?s.origemPedidos.length:null,semLocal:()=>s.origemPedidos?origemSemLocalizacao().length:null,historicoOrigem:()=>blocosHistoricosOrigem().length,origens:()=>s.origens.slice(),estado:()=>({totalPontos:s.pontos.length,semPonto:s.semPonto,modo:s.modo,origemId:s.origemId,pontosOrigem:pontosDaOrigem().length}),chaveRua,limparNomeRua,mesmaRuaRegistro,catalogo:()=>s.catalogo||[],classificar:(tipo,row)=>markerType({tipo,row}),ico:(tipo,row)=>iconeDe({tipo,row}),vinculos:()=>({exec:new Map(s.vinculosExec),casos:new Map(s.vinculosCaso),indisponivel:s.vinculosIndisponiveis}),
    ruaDoServico,carregarR3Territorial,ruas:()=>({servPeriodo:s.ruas.servPeriodo,ligadas:s.ruas.ligadas,totalRuas:s.ruas.totalRuas,servNoMapa:s.ruas.servNoMapa,blocos:s.ruas.blocosPeriodo,naRua:!!(s.mapa&&s.ruas.camadaRua&&s.mapa.hasLayer(s.ruas.camadaRua)),noRua:s.ruas.camadaRua?.getLayers().length||0,servicos:s.ruas.servicos?.length??null,erro:s.ruas.erro,unidades:s.ruas.blocos.size,visiveis:s.ruas.visiveis,naTela:!!(s.mapa&&s.ruas.camada&&s.mapa.hasLayer(s.ruas.camada)),semTracado:s.ruas.semTracado.slice(),periodo:s.ruas.periodo,
      lista:[...s.ruas.blocos.values()].filter(u=>u.periodo.length).map(u=>({nome:u.nome,bairro:u.bairroCat,faixa:u.faixa,catId:u.catId,n:u.periodo.length,ultimo:u.periodo[0]?.data}))}),
    depois:row=>servicosDepois(row),quarteiraoDe:(l,b,n)=>{const r=resolverRegistroRua(l,b);return r?quarteiroes(r,n).map(x=>({faixas:x.t.faixas,catId:String(x.e.id)})):null;},resolverRua:(l,b)=>{const r=resolverRegistroRua(l,b);return r&&{rua:r.rua,bairro:r.bairro,nome:r.nome,bairroCat:r.bairroCat}}};
  monta();
})();
