/* AP5.2 65.42.156.4.12.3 — 6.6G.4D-R2: posição real dos itens, conferência individual, sem gravação pela prévia.
   Leitura pelo Supabase sob RLS; a prévia NÃO altera pedidos, itens, histórico nem banco.
   Abrir pedido consulta o registro autorizado e usa o painel original 6.6G.2.
   Eventual gravação permanece EXCLUSIVAMENTE no formulário já homologado pela RPC R3.1,
   após ação explícita do usuário autorizado. Não há confirmação ou escrita em lote. */
(function(){
'use strict';
const IDS=["D21-PRE-0001","D21-PRE-0003","D21-PRE-0004","D21-PRE-0005","D21-PRE-0006","D21-PRE-0007","D21-PRE-0008","D21-PRE-0010","D21-PRE-0013","D21-PRE-0014","D21-PRE-0015","D21-PRE-0016","D21-PRE-0017","D21-PRE-0026","D21-PRE-0032","D21-PRE-0036","D21-PRE-0042","D21-PRE-0057","D21-PRE-0225","D21-PRE-0226","D21-PRE-0286","D21-PRE-0584","D21-PRE-0592","D21-PRE-0799","D21-PRE-0857"];
// Piloto fixo: 25 IDs de importação. Todo conteúdo é carregado do banco com RLS e sessão ativa.
const ns='ap52-lote4c';let epoch=0,openRequest=0,opened=false,filter='todos',itemFilter='todos',records=[];
const node=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=String(txt);return el;};
// Elegibilidade visual: somente 21ª GC ou Coordenação com escopo global.
// Consultas continuam sujeitas a RLS; essa verificação não amplia nenhuma permissão.
const acessoPiloto=()=>{
 const u=typeof acesso28!=='undefined'?acesso28?.user:null;
 return !!(u&&(u.scope==='global'||u.gerencia==='21ª GC'));
};
const authKey=()=>{
 if(typeof dem52Pode!=='function'||!dem52Pode()||typeof sb==='undefined'||!acessoPiloto())return null;
 const u=typeof acesso28!=='undefined'?acesso28?.user:null;
 return u?.user_id?`${u.user_id}|${u.scope}|${u.gerencia||''}|${typeof ac28Generation!=='undefined'?ac28Generation:''}`:null;
};
function category(a){
 const cs=a?.candidatos||[];const services=cs.filter(c=>c.tipo==='servico_catalogo');
 if(services.length>1)return 'multiplos';
 if(services.length===1)return 'catalogo';
 if(cs.some(c=>c.tipo==='servico_a_identificar'))return 'identificar';
 if(cs.some(c=>c.tipo==='problema'))return 'problema';
 return 'sem';
}
const labels={catalogo:'Serviço do catálogo',multiplos:'Vários serviços',identificar:'Serviço a identificar',problema:'Problema relatado',sem:'Sem serviço correspondente no catálogo'};
// Contagens vêm SOMENTE dos itens ativos realmente lidos sob RLS. Nenhuma contagem
// representa execução, aprovação da demanda ou conferência de todas as sugestões.
function resumirItens(itens){
 const ativo=Array.isArray(itens)?itens:[];
 const servicos=ativo.filter(i=>i.natureza==='servico');
 const confirmados=servicos.filter(i=>i.classificacao==='confirmada'&&!!i.catalogo_servico_id);
 const sugeridos=servicos.filter(i=>i.classificacao==='sugerida'&&!!i.catalogo_servico_id);
 const identificar=servicos.filter(i=>!i.catalogo_servico_id||i.classificacao==='pendente');
 const semConfirmacao=servicos.filter(i=>!confirmados.includes(i)&&!sugeridos.includes(i)&&!identificar.includes(i));
 return Object.freeze({total:ativo.length,
  confirmados:confirmados.length,sugeridos:sugeridos.length,identificar:identificar.length,
  semConfirmacao:semConfirmacao.length, aConferir:servicos.length-confirmados.length,
  problemas:ativo.filter(i=>i.natureza==='problema').length});
}
function quantidade(n,singular,plural){return `${n} ${n===1?singular:plural}`;}
const registroFiltros=[['todos','Todos os registros'],['sem','Sem item cadastrado'],['com','Com item cadastrado'],['pendente','Com serviço não confirmado']];
function atendeFiltro(row){
 return itemFilter==='todos'||(itemFilter==='sem'&&row.itens.total===0)||
  (itemFilter==='com'&&row.itens.total>0)||
  (itemFilter==='pendente'&&row.itens.aConferir>0);
}

function clear(){epoch++;openRequest++;opened=false;records=[];filter='todos';itemFilter='todos';const panel=document.getElementById(ns+'-conteudo');if(panel){panel.hidden=true;panel.replaceChildren();}const btn=document.getElementById(ns+'-abrir');if(btn){btn.textContent='Abrir';btn.setAttribute('aria-expanded','false');}}

// Ação individual: consulta novamente o pedido inteiro sob a RLS vigente, sem confiar
// nos dados resumidos da prévia. Não concede permissão nem envia gravação.
async function abrirPedido(demandaId,button,feedback){
 const auth=authKey(),req=epoch,request=++openRequest;
 const registro=records.find(r=>r.data.id===demandaId);
 if(!auth||!opened||!registro||!button||!feedback||typeof dem52==='undefined'||
    typeof dem52Render!=='function'||typeof DEM52_COLUNAS!=='string')return;
 button.disabled=true;feedback.textContent='Abrindo pedido autorizado…';
 try{
  const result=await sb.from('demandas').select(DEM52_COLUNAS)
    .eq('id',demandaId).is('deleted_at',null).maybeSingle();
  if(authKey()!==auth||epoch!==req||request!==openRequest||!opened||!button.isConnected)return;
  const d=result?.data;
  if(result.error||!d||d.id!==demandaId||d.gerencia!==registro.data.gerencia||
     d.id_origem_migracao!==registro.data.id_origem_migracao||!d.origem_migracao)throw Error('PEDIDO_NAO_DISPONIVEL');
  // Reutilizar o card original, com permissões, carregamento de itens, versão
  // de concorrência e formulário/RPC já homologados; jamais salvar aqui.
  dem52.confirmado=d;dem52.selecionada=d.id;
  dem52Render();
  feedback.textContent='Pedido aberto no painel de detalhes. Confira cada item individualmente.';
  const detail=document.getElementById('dem52-contexto-titulo');
  if(detail){detail.focus({preventScroll:true});
   if(window.matchMedia?.('(max-width:1100px)').matches)detail.scrollIntoView({block:'start',behavior:'auto'});}
 }catch(err){if(authKey()===auth&&epoch===req&&request===openRequest&&opened&&button.isConnected)
   feedback.textContent='Não foi possível abrir este pedido com segurança. Confira seu acesso e tente novamente.';
 }finally{if(authKey()===auth&&epoch===req&&opened&&button.isConnected){button.disabled=false;if(request!==openRequest)feedback.textContent='';}}
}
function permiteConferir(d){return !!(d&&typeof pode28==='function'&&pode28('demandas','editar')&&
 ((typeof dem52Global==='function'&&dem52Global())||d.gerencia===acesso28?.user?.gerencia));}

function render(panel){
 panel.replaceChildren();const intro=node('p','ap52-lote4c-desc','Conferência individual dos 25 pedidos-piloto. As sugestões não comprovam execução nem são gravadas pela prévia. Para registrar um serviço, abra o pedido e use o formulário normal de Serviços do pedido, com confirmação individual.');panel.append(intro);
 const meta=window.AP52Classificador66g3b?.identificacao;
 panel.append(node('p','ap52-lote4c-meta','Motor: '+(meta?.versaoMotor||'indisponível')+' · Catálogo institucional 2 áreas / 28 serviços / 65 termos (assinatura documental de referência).'));
 if(!records.length){panel.append(node('p','ap52-lote4c-empty','Nenhum pedido do piloto está disponível no seu escopo. A consulta respeita as permissões da sua gerência.'));return;}
 const comItem=records.filter(r=>r.itens.total>0).length;
 const pendentes=records.filter(r=>r.itens.aConferir>0).length;
 const resumo=node('p','ap52-lote4c-resumo',
  `${quantidade(records.length,'pedido consultado','pedidos consultados')} · ${quantidade(comItem,'com item registrado','com itens registrados')} · ${quantidade(records.length-comItem,'sem item registrado','sem itens registrados')} · ${quantidade(pendentes,'com serviço não confirmado','com serviços não confirmados')}`);
 resumo.setAttribute('aria-live','polite');panel.append(resumo);

 const categories=['todos','catalogo','multiplos','identificar','problema','sem'];
 const buttons=node('div','ap52-lote4c-filtros');buttons.setAttribute('role','group');buttons.setAttribute('aria-label','Filtrar resultados da prévia');
 for(const key of categories){const count=key==='todos'?records.length:records.filter(r=>r.group===key).length;
  const b=node('button','btn btn-ghost ap52-lote4c-filter',`${key==='todos'?'Todos os pedidos':labels[key]} · ${count}`);
  b.type='button';b.setAttribute('aria-pressed',String(filter===key));b.addEventListener('click',()=>{if(!authKey()){clear();return;}filter=key;render(panel);});buttons.append(b);
 }panel.append(buttons);
 const itemButtons=node('div','ap52-lote4c-filtros ap52-lote4c-filtros-registro');
 itemButtons.setAttribute('role','group');itemButtons.setAttribute('aria-label','Filtrar por itens já registrados');
 for(const [key,label] of registroFiltros){
  const n=records.filter(r=>key==='todos'||(key==='sem'&&r.itens.total===0)||(key==='com'&&r.itens.total>0)||(key==='pendente'&&r.itens.aConferir>0)).length;
  const b=node('button','btn btn-ghost ap52-lote4c-filter',`${label} · ${n}`);
  b.type='button';b.setAttribute('aria-pressed',String(itemFilter===key));
  b.addEventListener('click',()=>{if(!authKey()){clear();return;}itemFilter=key;render(panel);});itemButtons.append(b);
 }panel.append(itemButtons);
 const list=node('div','ap52-lote4c-grid');let countVisible=0;
 for(const row of records){if((filter!=='todos'&&row.group!==filter)||!atendeFiltro(row))continue;countVisible++;
  const d=row.data,a=row.analysis,card=node('article','ap52-lote4c-card');
  const hd=node('div','ap52-lote4c-card-head');hd.append(node('strong','',d.id_origem_migracao||'Pedido histórico'));
  hd.append(node('span','ap52-lote4c-tag',labels[row.group]));card.append(hd);
  card.append(node('h4','',d.assunto||'Assunto não informado'));
  card.append(node('p','ap52-lote4c-muted',`Situação histórica: ${d.status||'Não informada'} · Recebimento: ${d.data_recebimento||'Não informado'}`));
  if(row.itens.total){
   const stats=[];
   if(row.itens.confirmados)stats.push(quantidade(row.itens.confirmados,'serviço confirmado','serviços confirmados'));
   if(row.itens.sugeridos)stats.push(quantidade(row.itens.sugeridos,'serviço sugerido a confirmar','serviços sugeridos a confirmar'));
   if(row.itens.identificar)stats.push(quantidade(row.itens.identificar,'serviço a identificar','serviços a identificar'));
   if(row.itens.semConfirmacao)stats.push(quantidade(row.itens.semConfirmacao,'serviço sem confirmação','serviços sem confirmação'));
   if(row.itens.problemas)stats.push(quantidade(row.itens.problemas,'problema registrado','problemas registrados'));
   const extra=row.itens.total-row.itens.confirmados-row.itens.sugeridos-row.itens.identificar-row.itens.semConfirmacao-row.itens.problemas;
   if(extra>0)stats.push(quantidade(extra,'outro item registrado','outros itens registrados'));
   const itemInfo=node('p','ap52-lote4c-alert',`Itens cadastrados neste pedido: ${stats.join(' · ')}. Conferir a lista atual antes de incluir qualquer outro.`);
   card.append(itemInfo);
  }else{
   card.append(node('p','ap52-lote4c-sem-item','Nenhum serviço ou problema registrado neste pedido até esta consulta.'));
  }
  const cand=a?.candidatos||[];
  if(cand.length){const ul=node('ul','ap52-lote4c-items');for(const c of cand){const li=node('li','');
   const name=c.tipo==='servico_catalogo'?(c.nome_servico||c.codigo_servico):c.tipo==='problema'?'Problema relatado: afundamento':c.tipo==='servico_a_identificar'?'Serviço a identificar'+(c.area?' · '+c.area:''):c.tipo==='contexto_ambiguo'?'Competência ou contexto a conferir':'Sem serviço correspondente no catálogo';
   li.append(node('strong','',name));li.append(node('span','',` — ${c.motivo||'Exige conferência.'}`));ul.append(li);
  }card.append(ul);}else card.append(node('p','ap52-lote4c-muted','Nenhuma correspondência segura com os serviços atuais.'));
  if(d.observacao&&String(d.observacao).trim()){
   const obs=node('div','ap52-lote4c-obs');obs.append(node('strong','','Observação original — somente leitura; não é pedido:'));
   obs.append(node('p','',d.observacao));card.append(obs);
  }
  card.append(node('p','ap52-lote4c-muted','Sugestões ainda não confirmadas · Execução não comprovada pela prévia.'));
  const actions=node('div','ap52-lote4c-actions');
  const edit=permiteConferir(d);
  const open=node('button','btn '+(edit?'btn-primary':'btn-ghost')+' ap52-lote4c-open',edit?'Abrir pedido para conferir':'Ver pedido');
  open.type='button';open.setAttribute('aria-label',(edit?'Abrir para conferência individual: ':'Consultar: ')+(d.id_origem_migracao||'pedido'));
  const feedback=node('p','ap52-lote4c-muted ap52-lote4c-feedback','');feedback.setAttribute('role','status');
  open.addEventListener('click',()=>{void abrirPedido(d.id,open,feedback);});
  actions.append(open);card.append(actions,feedback);
  list.append(card);
 }
 if(!countVisible)list.append(node('p','ap52-lote4c-empty','Nenhum pedido corresponde à combinação de filtros.'));
 panel.append(list);
}
async function load(panel){
 const key=authKey();if(!key){panel.replaceChildren(node('p','ap52-lote4c-empty','É necessário estar autenticado e ter acesso às demandas.'));return;}
 const req=++epoch;panel.replaceChildren(node('p','ap52-lote4c-muted','Consultando os pedidos autorizados e o catálogo oficial…'));
 try{
  const c=await window.AP52Catalogo66g1?.load();if(!c)throw Error('CATALOGO_INDISPONIVEL');
  const q=await sb.from('demandas').select('id,gerencia,id_origem_migracao,origem_migracao,assunto,status,data_recebimento,observacao').in('id_origem_migracao',IDS).is('deleted_at',null).not('origem_migracao','is',null).order('id_origem_migracao');
  if(q.error||!Array.isArray(q.data))throw q.error||Error('DEMANDAS_INDISPONIVEIS');
  const ids=q.data.map(x=>x.id);
  let dataItens=[];
  if(ids.length){const r=await sb.from('demanda_servicos').select('demanda_id,id,natureza,classificacao,catalogo_servico_id').in('demanda_id',ids).is('deleted_at',null);
   if(r.error||!Array.isArray(r.data))throw r.error||Error('ITENS_INDISPONIVEIS');dataItens=r.data;
  }
  if(req!==epoch||authKey()!==key||!opened)return;
  const byDemand=new Map();
  for(const item of dataItens){if(!byDemand.has(item.demanda_id))byDemand.set(item.demanda_id,[]);byDemand.get(item.demanda_id).push(item);}
  records=q.data.map(d=>{
   const a=window.AP52Catalogo66g1.analyze(d.assunto,{tipo:'demanda',historica:true,gerencia:d.gerencia,observacao:d.observacao},c);
   return {data:d,analysis:a,group:category(a),itens:resumirItens(byDemand.get(d.id))};
  });filter='todos';itemFilter='todos';render(panel);
 }catch(e){if(req!==epoch||authKey()!==key||!opened)return;records=[];
  panel.replaceChildren(node('p','ap52-lote4c-empty','Não foi possível verificar a prévia com segurança. Nenhuma sugestão foi apresentada. Atualize a sessão e tente novamente.'));
  console.warn('[AP5.2/6.6G.4C] Falha de consulta somente leitura',e?.code||'indisponível');
 }
}
function install(){
 const view=document.getElementById('view-demandas'),parent=view?.querySelector('.dem52-principal');
 if(!parent||document.getElementById(ns))return;
 const section=node('section','dem52-panel ap52-lote4c');section.id=ns;
 // Fica recolhida, no topo da coluna principal, imediatamente após as abas da Central.
 const hd=node('header','ap52-lote4c-header');hd.append(node('h2','','Prévia histórica · 25 pedidos-piloto'));
 const toggle=node('button','btn btn-ghost','Abrir');toggle.id=ns+'-abrir';toggle.type='button';
 toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',ns+'-conteudo');
 const panel=node('div','ap52-lote4c-conteudo');panel.id=ns+'-conteudo';panel.hidden=true;
 toggle.addEventListener('click',()=>{
  if(!authKey()||section.hidden)return;
  if(opened){clear();return;}opened=true;toggle.textContent='Fechar';toggle.setAttribute('aria-expanded','true');panel.hidden=false;void load(panel);
 });
 hd.append(toggle);section.append(hd,panel);
 parent.insertBefore(section,parent.querySelector('#dem52-filtros'));
 const sync=()=>{
  const onDemandas=view.dataset.dem52cAba!=='casos'&&view.dataset.dem52cAba!=='historico';
  const ok=!!authKey()&&onDemandas&&view.style.display!=='none';
  if(!ok&&opened)clear();
  section.hidden=!ok;
 };
 // Mudanças de aba e de sessão recolhem a prévia e removem os dados em memória.
 const observer=new MutationObserver(sync);
 observer.observe(view,{attributes:true,attributeFilter:['style','class','data-dem52c-aba']});
 window.addEventListener('focus',sync);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&opened)clear();else sync();});
 sync();
 window.AP52DemandasPrevia4C=Object.freeze({clear,status:()=>({aberta:opened,quantidade:records.length,visivel:!section.hidden})});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
