/* AP5.2 v65.42.156.4.12.5.4.10 R3 — Consolidado da Gerência (Frente 2).
 * R3: regra do Daniel — a rua é da gerência em cuja cor ela está, respeitando EXATAMENTE as linhas do mapa oficial.
 * A rua é cortada nas linhas das cores; entra na lista de cada gerência onde tem um pedaço de pelo menos 20 m
 * (pedaço menor é só o cruzamento com a rua de divisa). O mapa usa as linhas do KML oficial, sem simplificar.
 * R2: saiu a regra "rua de divisa conta para os dois lados".
 * 4.10: "Pesquisar" — um campo só, que procura em solicitante, rua, bairro, sub-bairro, assunto, protocolo, serviço e origem e vale para
 * os indicadores e a tabela (substitui o "Filtrar a lista"; os outros filtros continuam). "Ruas da gerência" — quantas ruas a gerência tem
 * no mapa das gerências, quantas tiveram serviço registrado no período e quais não tiveram (visão "Ruas da gerência").
 * R4: visão "Por gerência". R3: indicadores em dois grupos — Pedidos (a soma fecha) e Serviços feitos (mesma conta do mapa).
 * Base 4.8 R3: permissões por coluna, índice do catálogo.
 * Leitura paginada com sessão/RLS; cache de sessão até Atualizar. Nenhuma escrita.
 * Unidade dos indicadores de demandas: o pedido. Planilhas = serviço, sem inferir vínculo. Rua da gerência = código do logradouro no catálogo.
 */
'use strict';
(function(){
 const P='ap52con';const MAX=25000;const PAGE=450;const VRG='20261112-of3';const MAX_LINHAS_COB=4000;
 const ABERTOS=new Set(['recebida','em_triagem','vinculada_a_caso','aguardando_resposta']);
 const EXEC=new Set(['a_programar','programado','em_execucao','aguardando_terceiro']);
 const NOME={alert:'A fazer',working:'Em execução',informed:'Executados',neutral:'Outras situações'};
 const api=()=>window.AP52TelaUnicaA;
 const el=k=>document.getElementById(P+'-'+k);
 const safe=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const norm=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const fmt=v=>{if(!v)return '—';const t=String(v).slice(0,10);const a=t.split('-');return a.length===3?`${a[2]}/${a[1]}/${a[0]}`:t};
 const nBR=n=>Number(n).toLocaleString('pt-BR');
 const hoje=()=>new Date();
 const state={aberto:false,carregado:false,carregando:false,seq:0,dados:{},erros:{},tipo:'rua',ordem:{col:'pedidos',asc:false},sit:new Set(),expandida:null,q:[],cob:'todas',rg:null,rgErro:null,cobAtual:null,ruas:new Map(),filtroAtivo:null,origemPendente:null};
 // Pesquisa: cada palavra precisa aparecer (sem acento, maiúscula ou pontuação). Palavras de uma letra só contam se forem número.
 const palavras=v=>norm(v).split(' ').filter(w=>w.length>1||/\d/.test(w));
 function montar(){if(el('painel'))return;
  const painel=document.createElement('section');painel.id=P+'-painel';painel.className=P+'-painel';painel.hidden=true;painel.tabIndex=-1; painel.setAttribute('role','dialog');painel.setAttribute('aria-modal','true');painel.setAttribute('aria-label','Consolidado da Gerência');
  painel.innerHTML=`<header class="ap52con-head"><div><span>Coordenação de Conservação · Central de Demandas</span><h2>Consolidado da Gerência</h2><p>Consulte os pedidos por rua, solicitante ou sub-bairro. Dados originais, sem agrupamento automático de nomes.</p></div><div><button id="ap52con-atualizar" type="button">Atualizar dados</button><button id="ap52con-fechar" type="button">← Voltar ao mapa</button></div></header>
   <p class="ap52con-msg" id="ap52con-aviso" role="status" hidden></p>
   <div class="ap52con-filtros">
    <label class="ap52con-pesquisa">Pesquisar<input id="ap52con-pesquisa" type="search" placeholder="Nome, rua, bairro, serviço…" autocomplete="off" enterkeyhint="search"><small id="ap52con-pesquisa-resumo" aria-live="polite">Ex.: Lucinha · Campo Grande · Estrada do Campinho · tapa-buraco. Procura em solicitante, rua, bairro, sub-bairro, assunto, protocolo e serviço.</small></label>
    <label>Gerência<select id="ap52con-gc"><option value="">Toda a AP5.2</option><option>21ª GC</option><option>22ª GC</option><option>23ª GC</option><option>24ª GC</option><option>25ª GC</option></select></label>
    <label>Período<select id="ap52con-periodo"><option value="ano">Ano atual</option><option value="3m">Últimos 3 meses</option><option value="mes">Este mês</option><option value="tudo">Tudo</option></select></label>
    <label>Solicitante<input id="ap52con-solicitante" type="search" placeholder="Pesquise um nome ou gabinete" autocomplete="off" list="ap52con-sugestoes"><datalist id="ap52con-sugestoes"></datalist></label>
    <label>Sub-bairro<select id="ap52con-sub"><option value="">Todos</option></select></label>
    <label>Origem dos pedidos<select id="ap52con-origem"><option value="">Todas as origens</option></select></label>
    <details class="ap52con-mais"><summary>Mais filtros</summary><div>
     <label>Bairro<select id="ap52con-bairro"><option value="">Todos</option></select></label>
     <label>Serviço sugerido<select id="ap52con-servico"><option value="">Todos</option></select></label>
    </div></details>
   </div>
   <div id="ap52con-inclui" class="ap52con-inclui" hidden></div>
   <div class="ap52con-situacoes" aria-label="Filtrar por situação"><span>Situação</span>
     <button type="button" data-s="alert" aria-pressed="false">A fazer</button><button type="button" data-s="working" aria-pressed="false">Em execução</button><button type="button" data-s="informed" aria-pressed="false">Executados</button><button type="button" data-s="neutral" aria-pressed="false">Outras situações</button>
     <button type="button" id="ap52con-limpar">Limpar filtros</button></div>
   <div class="ap52con-kpis" aria-label="Indicadores consolidados"><div class="ap52con-kpi-grupo ap52con-kpi-pedidos" role="group" aria-labelledby="ap52con-g-pedidos"><span class="ap52con-kpi-titulo" id="ap52con-g-pedidos">Pedidos</span><article><small>Total</small><strong id="ap52con-k-pedidos">—</strong></article><article><small>A fazer</small><strong id="ap52con-k-alert">—</strong></article><article><small>Em execução</small><strong id="ap52con-k-working">—</strong></article><article><small>Executados</small><strong id="ap52con-k-informed">—</strong><small id="ap52con-k-reg">—</small></article><article><small>Outras situações</small><strong id="ap52con-k-neutral">—</strong></article></div><div class="ap52con-kpi-grupo ap52con-kpi-servicos" role="group" aria-labelledby="ap52con-g-servicos"><span class="ap52con-kpi-titulo" id="ap52con-g-servicos">Serviços feitos (planilhas)</span><article><small>Serviços</small><strong id="ap52con-k-planilhas">—</strong><small id="ap52con-k-planilhas-nota"></small></article><article><small>Ruas com serviço</small><strong id="ap52con-k-ruas-serv">—</strong><small>em um trecho ou número</small></article></div></div>
   <section class="ap52con-cob" aria-labelledby="ap52con-cob-titulo">
    <div class="ap52con-cob-topo"><span class="ap52con-kpi-titulo" id="ap52con-cob-titulo">Ruas da gerência</span><small id="ap52con-cob-sub"></small></div>
    <div class="ap52con-cob-barra" id="ap52con-cob-barra" role="img" aria-label=""><span id="ap52con-cob-com-barra"></span></div>
    <div class="ap52con-cob-nums" id="ap52con-cob-botoes" role="group" aria-label="Ver a lista de ruas">
     <button type="button" data-cob="todas" aria-pressed="false"><strong id="ap52con-k-cob-total">—</strong><small>ruas</small></button>
     <button type="button" data-cob="com" aria-pressed="false" class="ap52con-cob-com"><strong id="ap52con-k-cob-com">—</strong><small id="ap52con-k-cob-com-txt">com serviço registrado</small></button>
     <button type="button" data-cob="sem" aria-pressed="false" class="ap52con-cob-sem"><strong id="ap52con-k-cob-sem">—</strong><small>sem serviço registrado</small></button>
    </div>
    <p class="ap52con-cob-nota" id="ap52con-cob-nota"></p>
   </section>
   <div class="ap52con-tabela-tools"><div id="ap52con-visoes" role="group" aria-label="Visão da tabela"><button type="button" data-v="rua" aria-pressed="true">Por rua</button><button type="button" data-v="sol" aria-pressed="false">Por solicitante</button><button type="button" data-v="sub" aria-pressed="false">Por sub-bairro</button><button type="button" data-v="ger" aria-pressed="false">Por gerência</button><button type="button" data-v="cob" aria-pressed="false">Ruas da gerência</button><span class="ap52con-n-linhas" id="ap52con-k-ruas" aria-live="polite"></span></div><button id="ap52con-csv" type="button">Baixar para Excel</button><button id="ap52con-imprimir" type="button">Imprimir</button></div>
   <p class="ap52con-nota" id="ap52con-nota-tabela">Pedido executado: caso concluído, vínculo a caso concluído ou vínculo explícito a serviço ativo. Serviços na mesma rua, sem vínculo, não comprovam execução daquele pedido.</p>
   <div class="ap52con-rolagem"><table id="ap52con-tabela"><thead></thead><tbody></tbody></table></div>
   <p class="ap52con-nota" id="ap52con-nota-ger" hidden></p>
   <p class="ap52con-fonte" id="ap52con-fonte">As consultas respeitam o acesso da conta e são atualizadas apenas quando solicitado.</p>`;
  document.body.appendChild(painel);
  el('fechar').addEventListener('click',fechar);
  el('atualizar').addEventListener('click',()=>void carregar(true));
  el('imprimir').addEventListener('click',()=>window.print());
  el('csv').addEventListener('click',exportar);
  for(const id of ['gc','periodo','solicitante','sub','bairro','servico','origem'])el(id).addEventListener(id==='solicitante'?'input':'change',()=>{if(id==='origem')api()?.definirOrigem?.(el('origem').value,{sincronizar:false});render();});
  let espera=null;
  el('pesquisa').addEventListener('input',e=>{clearTimeout(espera);espera=setTimeout(()=>{state.q=palavras(e.target.value);state.expandida=null;render();},180);});
  el('pesquisa').addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(espera);state.q=palavras(e.target.value);render();}});
  el('visoes').addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(!b)return;state.tipo=b.dataset.v;if(state.tipo==='cob')state.cob='todas';state.ordem={col:'pedidos',asc:false};state.expandida=null;render();});
  el('cob-botoes').addEventListener('click',e=>{const b=e.target.closest('[data-cob]');if(!b||!state.cobAtual)return;state.tipo='cob';state.cob=b.dataset.cob;state.ordem=state.cob==='com'?{col:'pl',asc:false}:{col:'pedidos',asc:false};state.expandida=null;render();
    el('tabela').closest('.ap52con-rolagem')?.scrollIntoView({block:'start',behavior:'smooth'});});
  painel.querySelector('.ap52con-situacoes').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;const k=b.dataset.s;state.sit.has(k)?state.sit.delete(k):state.sit.add(k);if(state.sit.size>=4)state.sit.clear();render();});
  el('limpar').addEventListener('click',()=>{state.sit.clear();for(const id of ['solicitante','sub','bairro','servico','origem','pesquisa'])el(id).value='';state.q=[];render();});
  el('tabela').addEventListener('click',e=>{
   const th=e.target.closest('th[data-col]');if(th){const col=th.dataset.col;state.ordem=state.ordem.col===col?{col,asc:!state.ordem.asc}:{col,asc:col==='nome'};renderTabela();return;}
   const mapa=e.target.closest('button[data-mapa]');if(mapa){const key=mapa.dataset.mapa;const grupo=state.ruas.get(key);if(!grupo)return;irParaRua(grupo.nome,grupo.bairro||null);return;}
   const mapaCob=e.target.closest('button[data-mapa-cob]');if(mapaCob){const n=unidades()?.nomeU(mapaCob.dataset.mapaCob);if(!n)return;irParaRua(n.nome,n.bairros.length===1?n.bairros[0]:null);return;}
   const linha=e.target.closest('tr[data-key]');if(!linha||state.tipo==='cob')return;const k=linha.dataset.key;
   if(state.tipo==='rua'){state.expandida=state.expandida===k?null:k;renderTabela();return;}
   if(state.tipo==='sol')el('solicitante').value=k;
   if(state.tipo==='sub')el('sub').value=k;
   if(state.tipo==='ger'){if(el('gc').disabled)return;el('gc').value=k;}
   state.tipo='rua';state.expandida=null;render();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.aberto){e.preventDefault();fechar();}});
 }
 function rotuloOrigem(nome){return nome==='1746'?'Ouvidoria (1746)':String(nome||'Origem não informada');}
 function definirOrigem(id){state.origemPendente=String(id||'');if(el('origem')&&[...el('origem').options].some(o=>o.value===state.origemPendente)){el('origem').value=state.origemPendente;if(state.aberto&&state.carregado)render();}}
 function irParaRua(nome,bairro){fechar();const busca=document.getElementById('ap52u-busca');if(busca){busca.value=nome;void api()?.pesquisar?.({bairroEscolhido:bairro||null});}}
 async function abrir(){if(typeof dem52Pode==='function'&&!dem52Pode())return;montar();state.aberto=true;el('painel').hidden=false;document.body.classList.add('ap52con-travado');
  const gc=el('gc');if(typeof dem52Global==='function'&&!dem52Global()){gc.value=(typeof acesso28!=='undefined'?acesso28?.user?.gerencia:null)||'';gc.disabled=true;}else{gc.disabled=false;}
  state.origemPendente=api()?.origemSelecionada?.()||'';
  el('painel').focus({preventScroll:true});if(!state.carregado)await carregar(false);else{definirOrigem(state.origemPendente);render();}
 }
 function fechar(){if(!state.aberto)return;state.aberto=false;el('painel').hidden=true;document.body.classList.remove('ap52con-travado');document.getElementById('ap52u-consolidado')?.focus({preventScroll:true});}
 function avisar(msg,erro=false){const elx=el('aviso');if(!elx)return;elx.hidden=!msg;elx.textContent=msg||'';elx.dataset.erro=erro?'true':'false';}
 const pode=()=>typeof dem52Global==='function'&&dem52Global();
 function escopo(q){if(!pode()&&(typeof acesso28!=='undefined'?acesso28?.user?.gerencia:null))q=q.eq('gerencia',acesso28.user.gerencia);return q;}
 async function ler(tabela,colunas,ordem='id'){
   const total=[];for(let ini=0;ini<MAX;ini+=PAGE){let q=sb.from(tabela).select(colunas,{count:'exact'});
     if(tabela==='demandas'||tabela==='casos_operacionais'||tabela==='caso_demandas'||tabela==='demanda_tipos_servico'||tabela==='demanda_origens'){
       if(tabela==='demandas'||tabela==='casos_operacionais'||tabela==='caso_demandas')q=q.is('deleted_at',null);
     }
     if(tabela==='servicos_executados'&&!pode()){
       const gc=acesso28?.user?.gerencia;if(!gc)throw Error('Escopo indisponível');
       q=q.or('gerencia.eq."'+gc+'",gerencia_territorial.eq."'+gc+'"');
     }else if(['demandas','casos_operacionais','caso_demandas'].includes(tabela))q=escopo(q);
     const r=await q.order(ordem).range(ini,ini+PAGE-1);
     if(r.error)throw r.error;if(!Number.isSafeInteger(r.count))throw Error('Contagem exata indisponível: '+tabela);
     total.push(...(r.data||[]));if(total.length>=r.count)return total;
   }
   throw Error('Fonte com mais de '+MAX+' registros: '+tabela);
 }
 // Ruas de cada gerência (arquivo do site, gerado do mapa das gerências × catálogo de ruas). Não vem do banco.
 async function lerRuasGerencias(){const r=await fetch('./ruas-gerencias-ap52.json?v='+VRG,{cache:'force-cache'});if(!r.ok)throw Error('HTTP '+r.status);
  const j=await r.json();if(!j||typeof j.g!=='object')throw Error('arquivo vazio');return j;}
 async function carregar(forcar){if(state.carregando)return;if(state.carregado&&!forcar){render();return;}
  const id=++state.seq;state.carregando=true;el('atualizar').disabled=true;avisar('Consultando dados autorizados e conferindo contagens…');
  const rgP=state.rg?Promise.resolve(state.rg):lerRuasGerencias().catch(e=>({erro:String(e?.message||e)}));
  // O catálogo de ruas dá os nomes oficiais; sem ele, as ruas ficam pela grafia do registro.
  try{await Promise.all([api()?.carregarCatalogo?.(),api()?.carregarR3Territorial?.()]);}catch{}
  if(id!==state.seq)return;
  const fontes={
   demandas:['id,gerencia,logradouro,numero,bairro,sub_bairro,solicitante,assunto,protocolo,id_origem_migracao,data_recebimento,status,tipo_servico_id,origem_id','id'],
   servicos_executados:['id,gerencia,gerencia_territorial,territorio_cl,territorio_criterio,logradouro,numero,bairro,sub_bairro,servico_apresentacao,data_execucao','id'],
   casos_operacionais:['id,gerencia,status,codigo,updated_at','id'],
   caso_demandas:['id,gerencia,demanda_id,caso_id','id'],
   servicos_demandas_vinculos:['id,demanda_id,servico_id,validado_em','id'],
     demanda_tipos_servico:['id,nome','id'],demanda_origens:['id,nome,ativo','id']};
   // E1: reutiliza apenas o snapshot completo e recente de serviços que o mapa já consultou
   // com o mesmo usuário, gerência, papel e geração. 'Atualizar' sempre busca no Supabase.
   const snapshotExec=!forcar?api()?.snapshotServicosCacheE1?.():null;
   const items=await Promise.all(Object.entries(fontes).map(async([key,[cols,ordem]])=>{
     try{return[key,key==='servicos_executados'?(window.AP52ServicosCacheE2?await window.AP52ServicosCacheE2.ler({forcar:!!forcar,valido:()=>id===state.seq&&typeof dem52Pode==='function'&&dem52Pode()}):snapshotExec||await ler(key,cols,ordem)):await ler(key,cols,ordem),null]}
     catch(e){return[key,null,e?.message||e?.code||'Falha']}
   }));
  const rg=await rgP;
  if(id!==state.seq)return;
  state.dados={};state.erros={};for(const [key,data,err] of items){state.dados[key]=data||[];if(err)state.erros[key]=err;}
  if(rg&&!rg.erro){state.rg=rg;state.rgErro=null;}else{state.rgErro=rg?.erro||'indisponível';}
  state.carregado=true;state.carregando=false;el('atualizar').disabled=false;
  const problemas=Object.keys(state.erros);avisar(problemas.length?'Consulta parcial: indisponível '+problemas.join(', ')+'. Os totais dependentes dessas fontes não serão apresentados como zero.':'',problemas.length>0);
  prepararOpcoes();render();
 }
 function prepararOpcoes(){const d=state.dados.demandas||[];const map=(id,rows)=>{const ctl=el(id),old=ctl.value;ctl.innerHTML='<option value="">Todos</option>'+[...new Set(rows.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(rows.includes(old))ctl.value=old;};
  map('sub',d.map(r=>r.sub_bairro));map('bairro',d.map(r=>r.bairro));
  const tipos=new Map((state.dados.demanda_tipos_servico||[]).map(x=>[x.id,x.nome]));map('servico',d.map(r=>tipos.get(r.tipo_servico_id)||'Não informado'));
  // Por ID, não por nome: opções ativas e históricas permanecem disponíveis.
  const ctl=el('origem'),old=state.origemPendente!==null?state.origemPendente:ctl.value;
  const usadas=new Set(d.map(r=>String(r.origem_id||'')).filter(Boolean));
  const itens=(state.dados.demanda_origens||[]).filter(o=>o.ativo||usadas.has(String(o.id)))
    .sort((a,b)=>rotuloOrigem(a.nome).localeCompare(rotuloOrigem(b.nome),'pt-BR'));
  ctl.replaceChildren(new Option('Todas as origens',''));
  for(const o of itens)ctl.add(new Option(rotuloOrigem(o.nome),String(o.id)));
  if(old&&![...ctl.options].some(o=>o.value===old))ctl.add(new Option('Origem selecionada (indisponível)',old));
  ctl.value=old||'';state.origemPendente=null;
  el('sugestoes').innerHTML=[...new Set(d.map(r=>r.solicitante).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).slice(0,1000).map(v=>`<option value="${safe(v)}"></option>`).join('');
 }
 function periodo(data){const opt=el('periodo').value;if(opt==='tudo')return true;if(!data)return false;const text=String(data).slice(0,10);const dia=new Date(text+'T12:00:00');if(Number.isNaN(+dia))return false;const now=hoje();
  if(opt==='ano')return dia.getFullYear()===now.getFullYear();
  if(opt==='mes')return dia.getFullYear()===now.getFullYear()&&dia.getMonth()===now.getMonth();
  const inicio=new Date(now);inicio.setMonth(inicio.getMonth()-3);return dia>=inicio&&dia<=now;
 }
 // Índice do catálogo por chave (uma vez) e memória por logradouro+bairro: antes, cada registro varria 14 mil nomes.
 let indice=null;const memo=new Map();
 function indiceCat(){const app=api();const catalogo=app?.catalogo?.()||[];if(indice&&indice.ref===catalogo)return indice;
  const mapa=new Map();for(const x of catalogo){const k=app?.chaveRua?.(x.nome)||norm(x.nome);if(!mapa.has(k))mapa.set(k,[]);mapa.get(k).push(x);}
  indice={ref:catalogo,mapa};memo.clear();return indice;}
 function keyRua(r){const ix=indiceCat();const mk=String(r.logradouro||'')+'|'+String(r.bairro||'')+'|'+String(r.sub_bairro||'');if(memo.has(mk))return memo.get(mk);
  const app=api();const limpa=app?.limparNomeRua?.(r.logradouro)||norm(r.logradouro);
  const candidatas=ix.mapa.get(limpa)||[];let out;
  if(candidatas.length){const ids=new Set(candidatas.map(x=>String(x.id)));
    if(ids.size===1)out={key:limpa,nome:candidatas[0].nome,bairro:r.bairro||candidatas[0].bairro||'',sub:r.sub_bairro||''};
    else{const bairro=norm(r.bairro);const correspondentes=candidatas.filter(x=>norm(x.bairro)===bairro);const candidatos=new Set(correspondentes.map(x=>String(x.id)));
      out=candidatos.size===1?{key:limpa+'|'+[...candidatos][0],nome:correspondentes[0].nome,bairro:r.bairro||'',sub:r.sub_bairro||''}
        :{key:limpa+'|?'+bairro,nome:candidatas[0].nome,bairro:r.bairro||'',sub:r.sub_bairro||''};}
  }else out={key:limpa+'|'+norm(r.bairro),nome:r.logradouro||'Não informado',bairro:r.bairro||'',sub:r.sub_bairro||''};
  memo.set(mk,out);return out;
 }
 // Texto de pesquisa de cada registro (uma vez por carga).
 const txtPed=new WeakMap(),txtServ=new WeakMap();
 function textoPedido(r,k,servico,origem){let t=txtPed.get(r);if(t==null){t=' '+norm([r.solicitante,r.logradouro,k?.nome,r.numero,r.bairro,r.sub_bairro,r.assunto,r.protocolo,r.id_origem_migracao,servico,origem].join(' '))+' ';txtPed.set(r,t);}return t;}
 function textoServico(r,k){let t=txtServ.get(r);if(t==null){t=' '+norm([r.logradouro,k?.nome,r.numero,r.bairro,r.sub_bairro,r.servico_apresentacao].join(' '))+' ';txtServ.set(r,t);}return t;}
 const bate=(t,Q)=>Q.every(w=>t.includes(w));
 const txtLugar=new WeakMap();
 function textoLugar(r){let t=txtLugar.get(r);if(t==null){t=' '+norm([r.logradouro,r._key?.nome,r.bairro,r.sub_bairro].join(' '))+' ';txtLugar.set(r,t);}return t;}
 function compor(){const d=state.dados.demandas||[],pl=state.dados.servicos_executados||[],cs=state.dados.casos_operacionais||[],l=state.dados.caso_demandas||[],x=state.dados.servicos_demandas_vinculos||[];
  const filteredGc=el('gc').value,sub=el('sub').value,bairro=el('bairro').value,serv=el('servico').value,origem=el('origem').value,sol=norm(el('solicitante').value),Q=state.q;
  const tipos=new Map((state.dados.demanda_tipos_servico||[]).map(x=>[x.id,x.nome]));const origens=new Map((state.dados.demanda_origens||[]).map(x=>[x.id,x.nome]));
  const cases=new Map(cs.map(c=>[c.id,c]));const casesByDem=new Map();for(const link of l){const c=cases.get(link.caso_id);if(!c)continue;const arr=casesByDem.get(link.demanda_id)||[];arr.push(c);casesByDem.set(link.demanda_id,arr);}
  const servAtivos=new Set(pl.map(y=>y.id)),execByDem=new Set(x.filter(y=>servAtivos.has(y.servico_id)).map(y=>y.demanda_id));
  const possuiLeituraExec=!state.erros.servicos_executados&&!state.erros.servicos_demandas_vinculos;
  const possuiLeituraCasos=!state.erros.casos_operacionais&&!state.erros.caso_demandas;
  let pedidos=d.filter(r=>!filteredGc||r.gerencia===filteredGc).filter(r=>periodo(r.data_recebimento)).filter(r=>!sub||r.sub_bairro===sub).filter(r=>!bairro||r.bairro===bairro)
   .filter(r=>!serv||(tipos.get(r.tipo_servico_id)||'Não informado')===serv).filter(r=>!origem||String(r.origem_id||'')===origem).filter(r=>!sol||norm(r.solicitante).includes(sol))
   .map(r=>{const relacionados=casesByDem.get(r.id)||[];const executed=(possuiLeituraExec&&execByDem.has(r.id))||(possuiLeituraCasos&&relacionados.some(c=>c.status==='concluido'));
     const working=possuiLeituraCasos&&relacionados.some(c=>EXEC.has(c.status));const situacao=executed?'informed':working?'working':ABERTOS.has(r.status)?'alert':'neutral';
     const k=keyRua(r),servico=tipos.get(r.tipo_servico_id)||'Não informado',orig=rotuloOrigem(origens.get(r.origem_id)||'Origem não informada');
     return {...r,situacao,comPlanilha:possuiLeituraExec&&execByDem.has(r.id),_key:k,servico,origem:orig,_t:Q.length?textoPedido(r,k,servico,orig):''};});
  if(Q.length)pedidos=pedidos.filter(p=>bate(p._t,Q));
  if(state.sit.size)pedidos=pedidos.filter(r=>state.sit.has(r.situacao));
  const plBase=pl.filter(r=>periodo(r.data_execucao)).filter(r=>!sub||r.sub_bairro===sub).filter(r=>!bairro||r.bairro===bairro);
  const chaveTerritorio=r=>r.gerencia_territorial&&r.territorio_cl&&['R3_PONTO','R3_RUA_EXCLUSIVA','R3_TRECHO_CONFIRMADO'].includes(r.territorio_criterio)?r.gerencia_territorial:null;
  let planilhas=plBase.filter(r=>!filteredGc||r.gerencia===filteredGc).map(r=>{const k=keyRua(r);return {...r,_key:k,_t:Q.length?textoServico(r,k):''};});
  let territoriais=plBase.filter(r=>!filteredGc||chaveTerritorio(r)===filteredGc||(!r.gerencia_territorial&&r.gerencia===filteredGc))
    .map(r=>{const k=keyRua(r);return {...r,_key:k,_t:Q.length?textoServico(r,k):''};});
  const filtroPedido=!!(sol||serv||origem||state.sit.size);let pelaRua=false;
  // Pesquisa: serviço entra quando tem as palavras. Se nenhum serviço tem (ex.: nome de solicitante ou protocolo), entram os serviços das ruas dos pedidos achados.
  if(Q.length){const diretos=planilhas.filter(s=>bate(s._t,Q));if(diretos.length||!pedidos.length)planilhas=diretos;else pelaRua=true;
    territoriais=territoriais.filter(s=>bate(s._t,Q)||pelaRua);}
  const restrito=filtroPedido||pelaRua;
  if(restrito){const chaves=new Set(pedidos.map(r=>r._key.key));planilhas=planilhas.filter(r=>chaves.has(r._key.key));territoriais=territoriais.filter(r=>chaves.has(r._key.key));}
  return {pedidos,planilhas,territoriais,restrito,pelaRua,sol,solAll:d.filter(r=>periodo(r.data_recebimento)&&(!filteredGc||r.gerencia===filteredGc)&&(!sol||norm(r.solicitante).includes(sol))),possuiLeituraExec,possuiLeituraCasos};
 }
 // Unidade "rua da gerência": código do logradouro no catálogo. Quando o mesmo nome tem dois códigos no mesmo bairro e os trechos se tocam,
 // o mapa já trata como uma rua só ("rua:a+b"); aqui também.
 let unidadesCache=null;
 function unidades(){const app=api(),cat=app?.catalogo?.()||[];if(!state.rg||!cat.length)return null;
  const ref=[cat,state.dados.servicos_executados,state.dados.demandas,state.rg];
  if(unidadesCache&&unidadesCache.ref.every((x,i)=>x===ref[i]))return unidadesCache;
  const info=new Map();for(const e of cat){const id=String(e.id);let x=info.get(id);if(!x){x={nome:e.nome,bairros:new Set()};info.set(id,x);}if(e.bairro)x.bairros.add(e.bairro);}
  const chave=app?.ruaDoServico,grupo=new Map();
  const ver=(l,b,r)=>{const k=chave?chave(l,b,r):'';if(k&&k.startsWith('rua:')&&k.includes('+'))for(const id of k.slice(4).split('+'))grupo.set(id,k);};
  for(const s of state.dados.servicos_executados||[])ver(s.logradouro,s.bairro,s);
  for(const p of state.dados.demandas||[])ver(p.logradouro,p.bairro);
  const daUnidade=k=>{if(!k||!k.startsWith('rua:'))return k||'';const ids=k.slice(4).split('+');return grupo.get(ids[0])||k;};
  const porGer=new Map();for(const g of GERENCIAS){const s=new Set();for(const id of state.rg.g?.[g]||[])s.add(grupo.get(String(id))||'rua:'+id);porGer.set(g,s);}
  const nomes=new Map();
  const nomeU=k=>{let n=nomes.get(k);if(n)return n;const ids=String(k).slice(4).split('+');const i0=info.get(ids[0]);const bs=new Set();for(const id of ids)for(const b of info.get(id)?.bairros||[])bs.add(b);
   n={nome:i0?.nome||String(k).slice(4),bairros:[...bs].sort((a,b)=>a.localeCompare(b,'pt-BR'))};n.t=' '+norm(n.nome+' '+n.bairros.join(' '))+' ';n.nb=new Set(n.bairros.map(norm));nomes.set(k,n);return n;};
  unidadesCache={ref,porGer,daUnidade,nomeU};return unidadesCache;}
 function gerenciasDaVisao(){const g=el('gc').value;return g?[g]:GERENCIAS;}
 function cobertura(com){const U=unidades();if(!U)return null;const gers=gerenciasDaVisao();const chave=api()?.ruaDoServico;const kDe=r=>chave?chave(r.logradouro,r.bairro,r):'';
  const base=new Set();for(const g of gers)for(const k of U.porGer.get(g)||[])base.add(k);
  const serv=new Map(),porChave=new Map();
  for(const s of com.territoriais){const k=kDe(s);porChave.set(k,(porChave.get(k)||0)+1);const u=U.daUnidade(k);if(!u.startsWith('rua:')||!base.has(u))continue;let x=serv.get(u);if(!x){x={n:0,ult:null};serv.set(u,x);}x.n++;if(!x.ult||s.data_execucao>x.ult)x.ult=s.data_execucao;}
  const ped=new Map();
  for(const p of com.pedidos){const u=U.daUnidade(kDe(p));if(!u.startsWith('rua:'))continue;let x=ped.get(u);if(!x){x={n:0,alert:0};ped.set(u,x);}x.n++;if(p.situacao==='alert')x.alert++;}
  // Quais ruas entram: pesquisa e bairro valem pelo nome e bairro da rua; filtros que só existem no pedido (solicitante, situação, sub-bairro…)
  // ficam com as ruas dos pedidos e serviços achados.
  let uni=base,modo='base';const bairro=el('bairro').value,sub=el('sub').value;
  if(bairro){const b=norm(bairro);uni=new Set([...uni].filter(k=>U.nomeU(k).nb.has(b)));modo='bairro';}
  const tocadas=()=>{const t=new Set([...serv.keys(),...ped.keys()]);return new Set([...uni].filter(k=>t.has(k)));};
  if(sub||com.restrito){uni=tocadas();modo='tocadas';}
  else if(state.q.length){
   // A pesquisa vale pelo nome da rua só quando as palavras são de lugar: aparecem na rua ou no bairro de pelo menos metade dos registros achados.
   // Assim "Cosmos" e "Estrada do Campinho" listam todas as ruas (com e sem serviço); "Lucinha" e "tapa-buraco" ficam nas ruas dos registros.
   const regs=[...com.pedidos,...com.planilhas];
   const deLugar=!regs.length||state.q.every(w=>{let n=0;for(const r of regs)if(textoLugar(r).includes(w))n++;return n*2>=regs.length;});
   const pelaRua=deLugar?[...uni].filter(k=>bate(U.nomeU(k).t,state.q)):[];
   if(pelaRua.length){uni=new Set(pelaRua);modo='nome';}else{uni=tocadas();modo='tocadas';}}
  let comServ=0;for(const k of uni)if(serv.has(k))comServ++;
  let conf=null;
  if(modo==='base'){const dentro=new Set();let fora=0,semTracado=0;const foraN=new Map();
   for(const [k,n] of porChave){if(!k||!k.startsWith('rua:')){semTracado++;continue;}const u=U.daUnidade(k);if(base.has(u))dentro.add(u);else{fora++;foraN.set(u,(foraN.get(u)||0)+n);}}
   const exemplos=[...foraN.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([u])=>U.nomeU(u).nome);
   const semPlanilha=gers.filter(g=>!(state.dados.servicos_executados||[]).some(s=>s.gerencia===g));
   conf={total:dentro.size+fora+semTracado,dentro:dentro.size,fora,semTracado,exemplos,semPlanilha};}
  return {uni,serv,ped,com:comServ,sem:uni.size-comServ,total:uni.size,modo,gers,conf};
 }
 function textoPeriodo(){const v=el('periodo').value;return ({ano:'no ano atual','3m':'nos últimos 3 meses',mes:'neste mês',tudo:'em todo o histórico'})[v]||'';}
 function renderCobertura(com){const c=(state.rg&&!state.erros.servicos_executados)?cobertura(com):null;state.cobAtual=c;
  const gers=gerenciasDaVisao();const quem=gers.length===1?gers[0]:'AP5.2';
  el('cob-titulo').textContent='Ruas da '+quem;
  const barra=el('cob-barra'),parte=el('cob-com-barra');
  if(!c){for(const k of ['cob-total','cob-com','cob-sem'])el('k-'+k).textContent='Indisponível';parte.style.width='0%';barra.setAttribute('aria-label','Indisponível');
   el('cob-sub').textContent='';el('cob-nota').textContent=state.erros.servicos_executados?'Sem as planilhas de serviços, não dá para saber quais ruas tiveram serviço.':(state.rgErro?'A lista de ruas das gerências não carregou ('+state.rgErro+'). Tente "Atualizar dados".':'O catálogo de ruas não carregou. Tente "Atualizar dados".');
   if(state.tipo==='cob')state.tipo='rua';return;}
  el('k-cob-total').textContent=nBR(c.total);el('k-cob-com').textContent=nBR(c.com);el('k-cob-sem').textContent=nBR(c.sem);
  const pct=c.total?c.com/c.total*100:0;const pctTxt=c.com&&pct<1?'menos de 1%':Math.round(pct)+'%';
  parte.style.width=(c.total?Math.max(c.com?0.6:0,pct):0).toFixed(2)+'%';
  barra.setAttribute('aria-label',`${pctTxt} das ruas com serviço registrado ${textoPeriodo()}`);
  el('k-cob-com-txt').textContent=`com serviço registrado (${pctTxt})`;
  const qTxt=el('pesquisa').value.trim();
  el('cob-sub').textContent=c.modo==='nome'?`com “${qTxt}” no nome ou no bairro · ${textoPeriodo()}`:c.modo==='bairro'?`no bairro ${el('bairro').value} · ${textoPeriodo()}`:c.modo==='tocadas'?`só as ruas dos pedidos e serviços encontrados · ${textoPeriodo()}`:`pelo mapa das gerências · serviço ${textoPeriodo()}`;
  let nota='';
  if(c.conf){const f=c.conf;const onde=gers.length===1?'na '+gers[0]:'na AP5.2';
   nota=f.total?`Das ${nBR(f.total)} ruas com serviço ${textoPeriodo()}, ${nBR(f.dentro)} ficam ${onde}.`+(f.fora?` ${nBR(f.fora)} ficam fora do mapa ${gers.length===1?'dela':'da AP5.2'}${f.exemplos.length?' (ex.: '+f.exemplos.join(', ')+')':''}.`:'')+(f.semTracado?` ${nBR(f.semTracado)} ${f.semTracado===1?'nome não tem':'nomes não têm'} traçado no catálogo de ruas.`:''):'';
   if(f.semPlanilha.length)nota+=(nota?' ':'')+(f.semPlanilha.length===1?f.semPlanilha[0]+': sem lançamentos próprios disponíveis; serviços de apoio podem constar na cobertura territorial.':f.semPlanilha.map(g=>g.replace(' GC','')).join(', ').replace(/, ([^,]*)$/,' e $1')+': sem lançamentos próprios disponíveis; serviços de apoio podem constar na cobertura territorial.');}
  el('cob-nota').textContent=nota+(nota?' ':'')+'"Sem serviço registrado" quer dizer que não há linha na planilha, não que a rua esteja ruim.';
 }
 const colunas={
   rua:[['nome','Rua (sub-bairro · bairro)'],['pedidos','Pedidos'],['alert','A fazer'],['working','Em execução'],['informed','Pedidos executados'],['pl','Serviços feitos'],['ult','Último serviço'],['sols','Solicitantes']],
   sol:[['nome','Solicitante'],['ruas','Ruas'],['pedidos','Pedidos'],['alert','A fazer'],['working','Em execução'],['informed','Pedidos executados'],['percent','% de pedidos executados']],
   ger:[['nome','Gerência'],['pl','Serviços feitos'],['ruasServ','Ruas com serviço'],['pedidos','Pedidos'],['alert','A fazer'],['working','Em execução'],['informed','Pedidos executados'],['neutral','Outras situações']],
   sub:[['nome','Sub-bairro'],['ruas','Ruas'],['pedidos','Pedidos'],['alert','A fazer'],['working','Em execução'],['informed','Pedidos executados'],['pl','Serviços feitos']],
   cob:[['nome','Rua (bairro)'],['situ','Situação'],['pl','Serviços feitos'],['ult','Último serviço'],['pedidos','Pedidos'],['alert','A fazer'],['mapa','Mapa']]
 };
 function agrupar(com){const map=new Map();state.ruas=new Map();const tipo=state.tipo;
  const criar=(key,nome,meta)=>({key,nome,meta,pedidos:0,alert:0,working:0,informed:0,neutral:0,reg:0,ruasSet:new Set(),ruasServSet:new Set(),solsMap:new Map(),pl:0,ult:null,lista:[],bairro:meta?.bairro||'',sub:meta?.sub||''});
  const chaveRuaExec=api()?.ruaDoServico;
  for(const p of com.pedidos){const rua=p._key;if(!state.ruas.has(rua.key))state.ruas.set(rua.key,{...rua,nome:rua.nome});
   const key=tipo==='rua'?rua.key:tipo==='sol'?p.solicitante||'Não informado':tipo==='ger'?p.gerencia||'Não informada':p.sub_bairro||'Não informado';
   if(!map.has(key))map.set(key,criar(key,tipo==='rua'?rua.nome:key,tipo==='rua'?rua:{}));const x=map.get(key);
   x.pedidos++;x[p.situacao]++;if(p.comPlanilha)x.reg++;x.ruasSet.add(rua.key);
   x.solsMap.set(p.solicitante||'Não informado',(x.solsMap.get(p.solicitante||'Não informado')||0)+1);x.lista.push(p);
  }
  if(tipo!=='sol')for(const s of com.planilhas){const rua=s._key;const key=tipo==='rua'?rua.key:tipo==='ger'?s.gerencia||'Não informada':s.sub_bairro||'Não informado';
    if(!map.has(key)){if(com.restrito)continue;map.set(key,criar(key,tipo==='rua'?rua.nome:key,tipo==='rua'?rua:{}));}
    const x=map.get(key);x.pl++;if(!x.ult||s.data_execucao>x.ult)x.ult=s.data_execucao;x.ruasSet.add(rua.key);x.ruasServSet.add(chaveRuaExec?chaveRuaExec(s.logradouro,s.bairro,s):rua.key);
    if(!state.ruas.has(rua.key))state.ruas.set(rua.key,{...rua,nome:rua.nome});
  }
  // Por gerência: as 5 aparecem para quem vê toda a AP5.2, mesmo sem dados carregados.
  if(tipo==='ger'&&pode()&&!el('gc').value&&!com.restrito&&!state.q.length)for(const g of GERENCIAS)if(!map.has(g))map.set(g,criar(g,g,{}));
  return [...map.values()].map(x=>({...x,ruasServ:x.ruasServSet.size,ruas:x.ruasSet.size,sols:[...x.solsMap.keys()].join(', '),percent:x.pedidos?Math.round(x.informed/x.pedidos*100):0}));
 }
 function linhasCob(){const c=state.cobAtual,U=unidades();if(!c||!U)return [];const seg=state.cob,rows=[];
  for(const k of c.uni){const s=c.serv.get(k),p=c.ped.get(k);if(seg==='com'&&!s)continue;if(seg==='sem'&&s)continue;const n=U.nomeU(k);
   rows.push({key:k,nome:n.nome,bairros:n.bairros,situ:s?'Com serviço':'Sem serviço registrado',pl:s?.n||0,ult:s?.ult||null,pedidos:p?.n||0,alert:p?.alert||0});}
  return rows;}
 function prepararVisao(){el('visoes').querySelectorAll('[data-v]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===state.tipo)));
  el('painel').querySelectorAll('[data-s]').forEach(b=>b.setAttribute('aria-pressed',String(state.sit.has(b.dataset.s))));
  el('cob-botoes').querySelectorAll('[data-cob]').forEach(b=>b.setAttribute('aria-pressed',String(state.tipo==='cob'&&state.cob===b.dataset.cob)));
 }
 function render(){if(!state.aberto||!state.carregado)return;const com=compor();const ped=com.pedidos,planilhas=com.planilhas;
  el('k-pedidos').textContent=nBR(ped.length);
  // Pedidos: a soma de A fazer + Em execução + Executados + Outras dá o Total.
  const semCasos=!com.possuiLeituraExec||!com.possuiLeituraCasos;
  for(const k of ['alert','working','informed','neutral'])el('k-'+k).textContent=(semCasos&&k!=='alert')?'Indisponível':nBR(ped.filter(p=>p.situacao===k).length);
  el('k-reg').textContent=com.possuiLeituraExec?'marcados pela equipe':'Vínculos indisponíveis';
  // Serviços feitos: linhas das planilhas e ruas com serviço (mesma chave de rua do mapa).
  const chaveRuaExec=api()?.ruaDoServico,ruasExec=new Set(com.territoriais.map(x=>chaveRuaExec?chaveRuaExec(x.logradouro,x.bairro,x):x._key.key).filter(k=>k.startsWith('rua:'))).size;
  el('k-ruas-serv').textContent=state.erros.servicos_executados?'Indisponível':nBR(ruasExec);
  el('k-planilhas').textContent=state.erros.servicos_executados?'Indisponível':nBR(planilhas.length);
  el('k-planilhas-nota').textContent=el('origem').value?'Serviços históricos nestas ruas, sem vínculo automático à origem':com.restrito?'Nessas ruas, de qualquer pedido':'';
  el('nota-tabela').textContent=el('origem').value?'Filtro de origem aplicado aos pedidos. Serviços das planilhas exibidos apenas nas mesmas ruas, sem vínculo automático à origem, sem atribuir origem a esses serviços nem comprovar atendimento dos pedidos.':'Pedido executado: caso concluído, vínculo a caso concluído ou vínculo explícito a serviço ativo. Serviços na mesma rua, sem vínculo, não comprovam execução daquele pedido.';
  const includes=el('inclui');includes.hidden=!com.sol;
  if(com.sol){const grafias=new Map();for(const p of com.solAll)grafias.set(p.solicitante||'Não informado',(grafias.get(p.solicitante||'Não informado')||0)+1);
    includes.textContent='Inclui: '+[...grafias.entries()].sort((a,b)=>b[1]-a[1]).map(([n,v])=>`${n} (${v})`).join(' · ');
  }
  const resumo=el('pesquisa-resumo');
  resumo.textContent=state.q.length?`Achou ${nBR(ped.length)} ${ped.length===1?'pedido':'pedidos'} e ${nBR(planilhas.length)} ${planilhas.length===1?'serviço':'serviços'}`+(com.pelaRua?' (serviços nas ruas desses pedidos).':'.'):'Ex.: Lucinha · Campo Grande · Estrada do Campinho · tapa-buraco. Procura em solicitante, rua, bairro, sub-bairro, assunto, protocolo e serviço.';
  resumo.dataset.ativo=state.q.length?'true':'false';
  renderCobertura(com);
  prepararVisao();
  state.atual=com;renderTabela();
  el('fonte').textContent='Dados somente leitura, sessão autenticada e RLS. '+(Object.keys(state.erros).length?'Fontes indisponíveis: '+Object.keys(state.erros).join(', '):'Todas as fontes retornaram contagens exatas.')+' · Atualize para buscar alterações recentes.';
 }
 function valor(x,c){if(state.tipo==='cob'){switch(c){case 'nome':return x.nome+(x.bairros.length?` (${x.bairros.join(', ')})`:'');case 'ult':return x.ult?fmt(x.ult):'—';case 'mapa':return '';default:return x[c]??'—';}}
  switch(c){case 'ult':return x.ult?fmt(x.ult):'—';case 'ruas':return x.ruas;case 'nome':return x.nome+(state.tipo==='rua'&&x.meta?.sub?` (${x.meta.sub} · ${x.meta.bairro||'bairro não informado'})`:'');case 'informed':return x.informed+(state.tipo==='rua'&&x.reg?` (${x.reg} na planilha)`:'');case 'percent':return state.atual?.possuiLeituraExec&&state.atual?.possuiLeituraCasos?x.percent+'%':'Indisponível';case 'sols':return x.sols||'—';case 'ruasServ':return x.ruasServ;default:return x[c]??'—';}}
 function linhasVisiveis(){const rows=state.tipo==='cob'?linhasCob():agrupar(state.atual);const o=state.ordem;
  rows.sort((x,y)=>{const a=x[o.col],b=y[o.col];const cmp=typeof a==='string'?a.localeCompare(b,'pt-BR'):String(o.col)==='ult'?(a||'').localeCompare(b||''):Number(a||0)-Number(b||0);return (o.asc?1:-1)*cmp||x.nome.localeCompare(y.nome,'pt-BR');});return rows;
 }
 const TEXTO=new Set(['nome','sols','situ']);const GERENCIAS=['21ª GC','22ª GC','23ª GC','24ª GC','25ª GC'];
 function renderTabela(){if(!state.atual)return;const cols=colunas[state.tipo],table=el('tabela');const todas=linhasVisiveis();
  const cob=state.tipo==='cob';const rows=cob?todas.slice(0,MAX_LINHAS_COB):todas;
  const n=todas.length,nome=(state.tipo==='rua'||cob)?(n===1?'rua':'ruas'):state.tipo==='sol'?(n===1?'solicitante':'solicitantes'):state.tipo==='ger'?(n===1?'gerência':'gerências'):(n===1?'sub-bairro':'sub-bairros');
  const vazias=state.tipo==='ger'?todas.filter(x=>!x.pedidos&&!x.pl).map(x=>x.nome):[];const notaGer=el('nota-ger');
  if(notaGer){notaGer.hidden=!vazias.length;notaGer.textContent=vazias.length?`${vazias.join(', ')}: pedidos e planilhas ainda não carregados no sistema. O zero não quer dizer que não houve trabalho.`:'';}
  el('k-ruas').textContent=`${n.toLocaleString('pt-BR')} ${nome} na lista`+(cob&&state.cob!=='todas'?(state.cob==='com'?' · com serviço':' · sem serviço registrado'):'');
  el('nota-tabela').textContent=el('origem').value?'Filtro de origem aplicado aos pedidos. Serviços das planilhas exibidos apenas nas mesmas ruas, sem vínculo automático à origem, sem atribuir origem a esses serviços nem comprovar atendimento dos pedidos.':cob?'A rua é da gerência em cuja cor ela está no mapa oficial, cortada exatamente nas linhas das cores. Rua que atravessa gerências (ex.: Estrada do Campinho) aparece em cada uma, com o seu trecho. Pedaço de menos de 20 m não conta: é só o cruzamento com a rua da divisa. Pedidos e serviços entram pela rua e pelo bairro do registro.':'Pedido executado: caso concluído, vínculo a caso concluído ou vínculo explícito a serviço ativo. Serviços na mesma rua, sem vínculo, não comprovam execução daquele pedido.';
  table.querySelector('thead').innerHTML='<tr>'+cols.map(([k,label])=>k==='mapa'?`<th class="ap52con-col-num" scope="col">${safe(label)}</th>`:`<th data-col="${k}" class="${TEXTO.has(k)?'ap52con-col-texto':'ap52con-col-num'}" scope="col" tabindex="0" aria-sort="${state.ordem.col===k?(state.ordem.asc?'ascending':'descending'):'none'}">${safe(label)}</th>`).join('')+'</tr>';
  const celula=(x,k)=>{if(k==='mapa')return `<td class="ap52con-col-num"><button type="button" class="ap52con-ver" data-mapa-cob="${safe(x.key)}">Ver no mapa</button></td>`;const v=valor(x,k);
   const cls=(TEXTO.has(k)?'ap52con-col-texto':'ap52con-col-num')+(k==='situ'?(x.pl?' ap52con-situ-com':' ap52con-situ-sem'):'');return `<td class="${cls}">${safe(typeof v==='number'?v.toLocaleString('pt-BR'):v)}</td>`;};
  table.querySelector('tbody').innerHTML=rows.length?rows.map(x=>{
    const more=state.tipo==='rua'&&state.expandida===x.key;
    const out=cob?`<tr class="ap52con-linha-cob" data-key="${safe(x.key)}">${cols.map(([k])=>celula(x,k)).join('')}</tr>`
      :`<tr class="ap52con-linha" data-key="${safe(x.key)}" tabindex="0" aria-expanded="${more}" title="${state.tipo==='rua'?'Abrir pedidos da rua':'Filtrar por este valor'}">${cols.map(([k])=>celula(x,k)).join('')}</tr>`;
    if(!more)return out;
    return out+`<tr class="ap52con-detalhe"><td colspan="${cols.length}"><div><h3>Pedidos: ${safe(x.nome)}</h3>${x.lista.length?x.lista.slice(0,200).map(p=>`<p><strong>${safe(p.id_origem_migracao||p.protocolo||'Sem código')}</strong> · ${fmt(p.data_recebimento)} · ${safe(p.assunto||p.servico)} · ${safe(p.solicitante||'Não informado')} · ${safe(p.origem)} · ${safe(NOME[p.situacao])}</p>`).join(''):'<p>Sem pedidos nesta consulta; há registros de execução na rua.</p>'}<button type="button" data-mapa="${safe(x.key)}">Ver esta rua no mapa</button></div></td></tr>`;
  }).join('')+(todas.length>rows.length?`<tr><td colspan="${cols.length}">Mostrando ${nBR(rows.length)} de ${nBR(todas.length)} ruas. Use a pesquisa ou escolha a gerência para ver as outras; "Baixar para Excel" leva a lista inteira.</td></tr>`:'')
   :`<tr><td colspan="${cols.length}">${cob&&!state.cobAtual?'Lista de ruas indisponível.':'Nenhum registro encontrado para os filtros atuais.'}</td></tr>`;
 }
 function exportar(){if(!state.atual)return;const cols=colunas[state.tipo].filter(([k])=>k!=='mapa'),rows=linhasVisiveis();const esc=v=>{const str=String(v??'');return /[;"\r\n]/.test(str)?'"'+str.replace(/"/g,'""')+'"':str;};
  const filtros=`Filtros: Gerência ${el('gc').value||'Toda AP5.2'}; Período ${el('periodo').selectedOptions[0].text}; Pesquisa ${el('pesquisa').value.trim()||'—'}; Solicitante ${el('solicitante').value||'todos'}; Sub-bairro ${el('sub').value||'todos'}; Origem ${el('origem').selectedOptions[0]?.text||'Todas as origens'}; Situações ${[...state.sit].map(x=>NOME[x]).join('+')||'Todas'}`+(state.tipo==='cob'?`; Ruas ${({todas:'todas',com:'com serviço',sem:'sem serviço registrado'})[state.cob]}`:'');
  const lines=['﻿'+esc(filtros),cols.map(x=>esc(x[1])).join(';'),...rows.map(r=>cols.map(([k])=>esc(valor(r,k))).join(';'))];
  const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AP52-consolidado-'+state.tipo+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 window.AP52Consolidado={abrir,fechar,definirOrigem,atualizar:()=>carregar(true),_test:{periodo,compor,agrupar,cobertura:()=>state.cobAtual,palavras,linhasCob,linhas:()=>linhasVisiveis()}};
})();
