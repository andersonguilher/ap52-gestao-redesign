/* Site AP5.2 — 10.4.5 R2.3 · Caminho B transacional · CANDIDATO (NÃO PUBLICAR)
 * Requer migração R3.1 e RPCs transacionais do Caminho B homologadas antes de ativar esta versão.
 * Nenhuma sugestão automática, nenhuma execução comprovada e nenhuma escrita em demandas.tipo_servico_id.
 */
(function () {
 'use strict';
 const PX='ap52-g2';
 const SELECT_COLS='id,demanda_id,gerencia,natureza,problema,catalogo_area_id,catalogo_servico_id,descricao_referencia,classificacao,origem_sugestao,situacao_atendimento,executado_em_informado,justificativa,deleted_at,motivo_arquivamento';
 const EXEC_COLS='id,inicio_execucao_em,inicio_execucao_por,execucao_informada_em,execucao_informada_por,observacao_andamento';
 const SIT={solicitado:'Solicitado — aguardando atendimento',em_execucao:'Em execução',executado_informado:'Execução informada (não comprovada)',nao_executavel:'Não executável',fora_competencia:'Fora da competência',cancelado:'Cancelado'};
 const state={identity:null,generation:0,selected:null,rows:[],version:null,loading:false,error:null,form:null,overlay:null,summaryToken:0,summary:new Map(),pending:null,pendingAdmin:null,pendingExecution:null,execReady:false,notice:null,catalogObservers:new WeakMap(),observers:new Set()};
 const el=(tag,cl,txt)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(txt!==undefined&&txt!==null)n.textContent=String(txt);return n;};
 const clean=s=>String(s??'').trim();
 function contextoDemandasAtivo(){
  const view=document.getElementById('view-demandas'),shell=document.getElementById('app-shell');
  return (!view||(view.style.display!=='none'&&!['historico','casos'].includes(view.dataset.dem52cAba)))&&
    (!shell||(shell.style.display!=='none'&&!shell.classList.contains('mobile-inicio')));
 }
 const canRead=()=>contextoDemandasAtivo()&&typeof dem52Pode==='function'&&dem52Pode()&&typeof sb!=='undefined';
 const current=()=>typeof dem52!=='undefined'&&(dem52.itens.find(x=>x.id===dem52.selecionada)||(dem52.confirmado?.id===dem52.selecionada?dem52.confirmado:null));
 const identity=()=>canRead()?(String(typeof acesso28!=='undefined'?acesso28?.user?.user_id:'')+'|'+String(typeof ac28Generation!=='undefined'?ac28Generation:0)):null;
 const canEdit=d=>!!(d&&canRead()&&typeof pode28==='function'&&pode28('demandas','editar')&&(typeof dem52Global==='function'&&dem52Global()||d.gerencia===acesso28?.user?.gerencia));
 const canArchive=d=>canEdit(d)&&!!pode28('demandas','excluir');
 const fmt=d=>/^\d{4}-\d{2}-\d{2}$/.test(clean(d))?`${d.slice(8,10)}/${d.slice(5,7)}/${d.slice(0,4)}`:'Data não informada';
 const fmtDateTime=d=>{if(!d)return 'Data não informada';const n=new Date(d);return Number.isNaN(n.getTime())?'Data indisponível':n.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});};
 const today=()=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
 const spDate=t=>{const n=new Date(t);if(!Number.isFinite(n.getTime()))return null;const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(n).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;};
 // 4.12.4 — descarte explícito em mudanças de sessão/área; não depende de render ou reload.
 function clearAll(){
  state.generation++;state.identity=null;state.selected=null;state.rows=[];state.version=null;
  state.loading=false;state.error=null;state.pending=null;state.pendingAdmin=null;state.pendingExecution=null;state.execReady=false;state.notice=null;
  state.summary.clear();state.summaryToken++;
  closeModal();
  for(const observer of state.observers)observer.disconnect();state.observers.clear();
  state.catalogObservers=new WeakMap();
 }
 function resetIdentity(){const id=identity();if(id!==state.identity){clearAll();state.identity=id;}return !!id;}
 function active(){return state.rows.filter(r=>!r.deleted_at);}
 function haAfundamentoAtivo(){return active().some(r=>r.natureza==='problema'&&r.problema==='afundamento'&&r.situacao_atendimento!=='cancelado');}
 function itensParaConferencia(demandaId){
  if(!resetIdentity()||!canRead()||current()?.id!==demandaId||state.selected!==demandaId||state.loading||state.error||state.version===null)return null;
  return {afundamentoAtivo:haAfundamentoAtivo(),areasAtivas:[...new Set(active().filter(r=>r.natureza==='servico'&&r.situacao_atendimento!=='cancelado'&&r.catalogo_area_id).map(r=>r.catalogo_area_id))]};
 }
 function catalog(){return window.AP52Catalogo66g1?.load?.()??Promise.resolve(null);}
 function serviceName(row,data){const entry=data?.servicos?.get(row.catalogo_servico_id),area=data?.areas?.get(row.catalogo_area_id);return {nome:entry?.nome||((row.catalogo_servico_id)?'Serviço do catálogo indisponível':'Falta escolher o serviço'),area:area?.nome||'Área não identificada'};}
 function rowKey(r){return r.id||null;}
 function serialize(r){return {id:rowKey(r),natureza:r.natureza,problema:r.natureza==='problema'?'afundamento':null,catalogo_area_id:r.natureza==='servico'?r.catalogo_area_id:null,catalogo_servico_id:r.natureza==='servico'?r.catalogo_servico_id:null,descricao_referencia:r.descricao_referencia||null,classificacao:r.natureza==='servico'?r.classificacao:null,situacao_atendimento:r.situacao_atendimento||null,executado_em_informado:r.situacao_atendimento==='executado_informado'?r.executado_em_informado:null,justificativa:['nao_executavel','fora_competencia','cancelado'].includes(r.situacao_atendimento)?r.justificativa||null:null};}
 function selectedFresh(id,generation){return resetIdentity()&&generation===state.generation&&state.selected===id&&current()?.id===id;}
 async function loadCurrent(id,force=false){
  if(!resetIdentity())return;
  if(state.selected===id&&!force&&(state.loading||state.version!==null||state.error))return;
  if(state.selected!==id){closeModal();state.pending=null;state.pendingAdmin=null;state.pendingExecution=null;state.notice=null;}
  const gen=++state.generation;state.selected=id;state.rows=[];state.version=null;state.error=null;state.execReady=false;state.loading=true;renderSection();
  try{
   // Primeira e segunda leitura de versão protegem contra dados alterados enquanto a lista era carregada.
   let rows=null,version=null,consistent=false,execReady=false;
   for(let retry=0;retry<2;retry++){
    const a=await sb.rpc('ap52_demanda_servicos_versao',{p_demanda_id:id});if(a.error||typeof a.data!=='string')throw a.error||Error('versão indisponível');
    const b=await sb.from('demanda_servicos').select(SELECT_COLS).eq('demanda_id',id).order('created_at',{ascending:true});if(b.error||!Array.isArray(b.data))throw b.error||Error('lista indisponível');
    // Compatibilidade: colunas 10.4.5 ainda não instaladas -> formulário 10.4.4 permanece funcional.
    const extra=await sb.from('demanda_servicos').select(EXEC_COLS).eq('demanda_id',id);
    const hasExtra=!extra.error&&Array.isArray(extra.data)&&extra.data.length===b.data.length;
    const extraById=hasExtra?new Map(extra.data.map(x=>[x.id,x])):new Map();
    const c=await sb.rpc('ap52_demanda_servicos_versao',{p_demanda_id:id});if(c.error||typeof c.data!=='string')throw c.error||Error('versão indisponível');
    if(a.data===c.data){rows=b.data.map(x=>({...x,...(extraById.get(x.id)||{})}));version=c.data;execReady=hasExtra;consistent=true;break;}
   }
   if(!consistent)throw Object.assign(Error('A lista mudou durante a leitura.'),{code:'40001'});
   if(!selectedFresh(id,gen))return;
   state.rows=rows;state.version=version;state.execReady=execReady;state.error=null;state.loading=false;renderSection();
  }catch(err){if(!selectedFresh(id,gen))return;state.error=err?.code==='40001'?'A lista foi alterada por outra pessoa. Atualize antes de editar.':'Não foi possível consultar os serviços do pedido. Tente novamente.';state.loading=false;renderSection();}
 }
 function message(text,kind='muted'){return el('p',PX+'-'+kind,text);}
 // 10.4.3: a classificação escolhida no cadastro atual permanece visível.
 // Em registros históricos, o tipo legado continua meramente informativo e
 // pode ser ocultado quando já existe uma lista operacional formal.
 function hideLegacyField(rows){const meta=dem52El('contexto')?.querySelector('.dem52-meta');if(!meta)return;
  const d=current();if(!d)return;
  const legado=!!d.origem_migracao;
  for(const line of meta.children){const dt=line.querySelector('dt');if(!dt||!['Tipo de serviço','Tipo antigo'].includes(dt.textContent))continue;
   const original=d.servico?.nome||'';
   dt.textContent=legado?'Tipo antigo':'Tipo de serviço';
   const dd=line.querySelector('dd');if(dd&&original)dd.textContent=original;
   line.hidden=legado&&(!original||!!rows.length);
  }
 }
 function renderSection(){
  if(!resetIdentity())return;
  const d=current(),holder=typeof dem52El==='function'?dem52El('contexto'):null;
  if(!d||!holder?.querySelector('.dem52-detail-title'))return;
  let section=holder.querySelector('.'+PX+'-section');if(section&&section.dataset.demandaId!==d.id){section.remove();section=null;}
  if(!section){section=el('section',PX+'-section');section.dataset.demandaId=d.id;section.setAttribute('aria-label','Serviços do pedido');const meta=holder.querySelector(':scope > .dem52-meta');if(meta)meta.after(section);else holder.append(section);}
  if(!canEdit(d))holder.querySelectorAll('.'+PX+'-suggest').forEach(n=>n.remove());
  section.replaceChildren();const head=el('div',PX+'-head'),titles=el('div','');titles.append(el('h3','', 'Serviços do pedido'));
  const isForSelected=state.selected===d.id,rows=isForSelected?state.rows:[];
  titles.append(el('p',PX+'-helper','O tipo informado no cadastro identifica o pedido. Para acompanhar o atendimento, registre o serviço abaixo. Nenhuma inclusão significa execução automática.'));head.append(titles);
  if(canEdit(d)&&isForSelected&&!state.error&&!state.loading&&state.version!==null){const buttons=el('div',PX+'-head-buttons'),add=el('button','btn btn-primary','+ Registrar serviço'),problem=el('button','btn btn-ghost','+ Registrar afundamento');add.type=problem.type='button';add.onclick=()=>openForm(null,'servico');problem.onclick=()=>openForm(null,'problema');buttons.append(add,problem);head.append(buttons);}
  section.append(head);
  // 10.4.4 R1 — informação de cadastro, sem criar item operacional.
  // Não inferir tipo estruturado de assuntos antigos ou sugestões transitórias.
  if(!d.origem_migracao&&d.tipo_servico_id&&clean(d.servico?.nome)){
   const requested=el('p',PX+'-requested');requested.append(el('strong','','Tipo solicitado no cadastro: '));
   requested.append(document.createTextNode(clean(d.servico.nome)));
   section.append(requested);
  }
  // Avisos de conflito ficam persistentes mesmo quando a lista é recriada pelo recarregamento.
  if(state.notice?.demanda===d.id){
   const notice=el('div',PX+'-persistent-warn');notice.setAttribute('role','alert');
   notice.append(el('p','',state.notice.texto));
   const dismiss=el('button','btn btn-ghost','Entendi');dismiss.type='button';
   dismiss.onclick=()=>{state.notice=null;renderSection();};notice.append(dismiss);section.append(notice);
  }
  hideLegacyField(rows.filter(r=>!r.deleted_at));
  if(!isForSelected||state.loading){section.append(message('Consultando a lista de serviços…'));return;}
  if(state.error){section.append(message(state.error,'warn'));const retry=el('button','btn btn-ghost','Tentar novamente');retry.type='button';retry.onclick=()=>loadCurrent(d.id,true);section.append(retry);return;}
  const activeRows=active();const top=el('div',PX+'-totals');const services=activeRows.filter(r=>r.natureza==='servico');const nservices=services.length;const nExecutions=services.filter(r=>r.situacao_atendimento==='executado_informado').length;const nProgress=services.filter(r=>r.situacao_atendimento==='em_execucao').length;
  top.append(el('span','',`${nservices} ${nservices===1?'serviço registrado':'serviços registrados'}`));if(nProgress)top.append(el('span','',`${nProgress} ${nProgress===1?'em execução':'em execução'}`));top.append(el('span','',`${nExecutions} ${nExecutions===1?'execução informada':'execuções informadas'} (sem comprovação automática)`));const problems=activeRows.filter(r=>r.natureza==='problema'&&r.situacao_atendimento!=='cancelado').length;if(problems)top.append(el('span','',`${problems} ${problems===1?'problema registrado':'problemas registrados'}`));
  if(activeRows.some(r=>r.natureza==='servico'&&!r.catalogo_servico_id))top.append(el('span',PX+'-attention','Há serviços a classificar'));
  section.append(top);
  if(!nservices)section.append(message('O pedido foi recebido, mas ainda não há serviço registrado para acompanhamento. Use “+ Registrar serviço” quando for necessário acompanhar o atendimento.'));
  const list=el('div',PX+'-list');section.append(list);
  void catalog().then(data=>{if(!section.isConnected||current()?.id!==d.id||state.selected!==d.id||state.loading||state.error)return;
   list.replaceChildren();for(const r of active()){const names=serviceName(r,data),card=el('article',PX+'-item'+(r.situacao_atendimento==='cancelado'?' '+PX+'-cancelled':''));const line=el('div',PX+'-item-head'),info=el('div',PX+'-item-info');
     info.append(el('strong','',r.natureza==='problema'?'Problema registrado: Afundamento':names.nome));
     if(r.natureza==='servico')info.append(el('small','',`${names.area}${r.classificacao==='sugerida'?' · Sugestão para conferência':!r.catalogo_servico_id?' · A classificar':''}`));
     line.append(info);const status=el('span',PX+'-pill '+PX+'-pill-'+(r.situacao_atendimento||'problema'),SIT[r.situacao_atendimento]||(r.natureza==='problema'?'Registrado':'Solicitado'));line.append(status);card.append(line);
     if(r.descricao_referencia)card.append(message(r.descricao_referencia,'reference'));
     if(r.situacao_atendimento==='em_execucao')card.append(message('Início registrado: '+fmtDateTime(r.inicio_execucao_em)+'. Execução ainda não informada.','progress'));
     if(r.situacao_atendimento==='executado_informado')card.append(message('Informado pela gerência em '+fmt(r.executado_em_informado)+' — não é comprovação.','execution'));
     if(r.observacao_andamento)card.append(message('Andamento: '+r.observacao_andamento,'reference'));
     if(r.justificativa)card.append(message('Justificativa: '+r.justificativa,'reference'));
     if(canEdit(d)){const actions=el('div',PX+'-actions'),edit=el('button','btn btn-ghost',r.situacao_atendimento==='cancelado'?'Reabrir / editar':'Editar serviço');edit.type='button';edit.onclick=()=>openForm(r);actions.append(edit);
      if(state.execReady&&r.natureza==='servico'&&r.classificacao==='confirmada'&&r.catalogo_servico_id&&['solicitado','em_execucao'].includes(r.situacao_atendimento)){
       const action=el('button','btn btn-primary '+PX+'-execution-btn',r.situacao_atendimento==='solicitado'?'Registrar início':'Informar execução');action.type='button';action.onclick=()=>openExecutionForm(r);actions.append(action);
      }
      // Caminho B: a autorização definitiva e a integridade são verificadas pelas RPCs no banco.
      if(canArchive(d)){const archive=el('button','btn btn-ghost '+PX+'-archive-btn','Arquivar');archive.type='button';archive.onclick=()=>openAdministrativeAction(r,'arquivar');actions.append(archive);}
      card.append(actions);}
     list.append(card);
    }
   const archived=rows.filter(r=>r.deleted_at);if(canArchive(d)&&archived.length){const wrap=el('details',PX+'-archived');wrap.append(el('summary','',`${archived.length} itens arquivados (administração)`));for(const r of archived){const card=el('div',PX+'-archived-item'),details=el('div',PX+'-archived-desc');details.append(el('strong','',r.natureza==='problema'?'Afundamento':serviceName(r,data).nome));if(r.motivo_arquivamento)details.append(el('small','',`Motivo: ${r.motivo_arquivamento}`));card.append(details);const restore=el('button','btn btn-ghost','Restaurar');restore.type='button';restore.onclick=()=>openAdministrativeAction(r,'restaurar');card.append(restore);wrap.append(card);}section.append(wrap);}
  });
  bindSuggestions(section,d);
  // Sincroniza o painel assistido com a lista atualizada após carregar ou salvar.
  window.AP52Catalogo66g1?.atualizarPainel?.(d.id);
 }
 function bindSuggestions(section,d){const catbox=section.parentElement?.querySelector('.ap52-g1-box');if(!catbox||state.catalogObservers.has(catbox))return;
  let inProgress=false,repeat=false;
  const update=async()=>{
   if(inProgress){repeat=true;return;}inProgress=true;
   try{
    if(current()?.id!==d.id||state.selected!==d.id||state.error||state.version===null)return;
    const data=await catalog();if(!data||!catbox.isConnected||current()?.id!==d.id||state.selected!==d.id)return;
    for(const li of catbox.querySelectorAll('.ap52-g1-list li')){
     const name=clean(li.querySelector('strong')?.textContent),area=clean(li.querySelector('.ap52-g1-area')?.textContent).replace(/^·\s*/,'');
     const match=data.servicos.get(li.dataset.catalogoServicoId)||[...data.servicos.values()].find(s=>s.nome===name&&data.areas.get(s.area_id)?.nome===area);
     const already=!!match&&active().some(r=>r.natureza==='servico'&&r.catalogo_servico_id===match.id);
     const oldButton=li.querySelector('.'+PX+'-suggest'),oldMark=li.querySelector('.'+PX+'-already');
     if(already){oldButton?.remove();if(!oldMark)li.append(el('span',PX+'-already','já incluído'));}
     else{oldMark?.remove();if(!canEdit(d)){oldButton?.remove();continue;}
      if(!oldButton&&match){const button=el('button','btn btn-ghost '+PX+'-suggest','Incluir');button.type='button';button.onclick=()=>{if(current()?.id===d.id)openForm(null,'servico',{area:match.area_id,service:match.id});};li.append(button);}
     }
    }
   }finally{inProgress=false;if(repeat){repeat=false;void update();}}
  };
  const observer=new MutationObserver(()=>{void update();});observer.observe(catbox,{subtree:true,childList:true});state.catalogObservers.set(catbox,observer);state.observers.add(observer);void update();
 }
 function makeField(form,tag,title,name,options=null){const l=el('label',PX+'-field'),s=el('span','',title),node=el(tag,'');node.name=name;node.id=PX+'-'+name;if(tag==='select'&&options)for(const [value,label] of options){const op=el('option','',label);op.value=value;node.append(op);}if(tag==='textarea')node.rows=3;l.append(s,node);form.append(l);return node;}
 async function openForm(existing=null,nature='servico',prefill={}){
  const d=current();if(!canEdit(d)||state.selected!==d.id||state.version===null||state.error||state.loading)return;
  const formToken=state.generation,formIdentity=identity();
  const data=await catalog();if(!data){if(state.generation===formToken)showInline('Não foi possível consultar o catálogo oficial. Tente novamente.');return;}
  if(!d||current()?.id!==d.id||!canEdit(d)||state.generation!==formToken||identity()!==formIdentity)return;
  if(!existing&&nature==='problema'&&haAfundamentoAtivo()){
   showInline('Este afundamento já está registrado neste pedido.');return;
  }
  closeModal();let conflicted=false;const overlay=el('div',PX+'-overlay');overlay.setAttribute('role','presentation');const dialog=el('section',PX+'-modal');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',existing?'Editar item do pedido':'Incluir item no pedido');dialog.tabIndex=-1;
  const hd=el('div',PX+'-modal-head');hd.append(el('h3','',existing?'Editar item do pedido':nature==='problema'?'Registrar afundamento':'Incluir serviço'));const close=el('button','btn btn-ghost','Fechar');close.type='button';close.onclick=dismissForm;hd.append(close);dialog.append(hd);
  const f=el('form',PX+'-form'),rows=active(),original=existing?{...existing}:{id:null,natureza:nature,problema:nature==='problema'?'afundamento':null,catalogo_area_id:prefill.area||null,catalogo_servico_id:prefill.service||null,descricao_referencia:clean(prefill.reference).slice(0,4000),classificacao:prefill.service?'confirmada':'pendente',situacao_atendimento:nature==='problema'?null:'solicitado',executado_em_informado:null,justificativa:null};
  const isProblem=original.natureza==='problema';const tip=message(isProblem?'Afundamento é um problema registrado, não um serviço pendente de classificação.':(!existing?'Escolha o serviço pedido. Se o pedido não diz qual é, escolha só a área e descreva o que falta conferir.':'Escolha a área e o serviço. Se o serviço não for identificável, registre somente a área e descreva o que falta conferir.'),'hint');f.append(tip);
  const area=isProblem?null:makeField(f,'select','Área de serviço','catalogo_area_id',[['','Escolha a área'],...[...data.areas.values()].map(a=>[a.id,a.nome])]);
  const service=isProblem?null:makeField(f,'select','Serviço do catálogo','catalogo_servico_id',[['','Somente a área — serviço ainda não identificado']]);
  const desc=makeField(f,'textarea',isProblem?'Descrição do problema (opcional)':'Trecho original / referência do serviço','descricao_referencia');desc.maxLength=4000;
  const attend=makeField(f,'select','Situação do atendimento','situacao_atendimento',isProblem?[['','Problema registrado'],['cancelado','Cancelado — lançamento por engano']]:Object.entries(SIT).filter(([v])=>v!=='em_execucao'||existing?.situacao_atendimento==='em_execucao'));if(!isProblem)f.append(message('“Solicitado” não indica trabalho iniciado. “Execução informada” exige data e não equivale a serviço comprovado.','hint'));
  const date=isProblem?null:makeField(f,'input','Data informada da execução','executado_em_informado');if(date){date.type='date';date.max=today();}
  const reason=makeField(f,'textarea','Justificativa','justificativa');reason.maxLength=4000;
  // Confirmação humana explícita: editar a situação não deve aceitar sugestão em silêncio.
  let suggestionCheck=null;
  if(existing?.classificacao==='sugerida'){
   const block=el('label',PX+'-confirm-suggestion');suggestionCheck=el('input','');suggestionCheck.type='checkbox';suggestionCheck.required=true;
   const origem=clean(existing.origem_sugestao);
   block.append(suggestionCheck,el('span','',`Confirmo que este serviço corresponde ao pedido. Ao salvar, a sugestão${origem?' de origem "'+origem+'"':''} será confirmada em meu nome e essa decisão ficará registrada no histórico.`));f.append(block);
  }
  const alert=message('','error');alert.hidden=true;alert.setAttribute('role','alert');f.append(alert);
  const foot=el('div',PX+'-modal-foot'),cancel=el('button','btn btn-ghost','Cancelar'),save=el('button','btn btn-primary','Salvar serviço');cancel.type='button';cancel.onclick=dismissForm;save.type='submit';foot.append(cancel,save);f.append(foot);dialog.append(f);overlay.append(dialog);document.body.append(overlay);state.overlay=overlay;state.form=f;
  const ownsForm=()=>state.overlay===overlay&&state.form===f&&state.generation===formToken&&state.selected===d.id&&current()?.id===d.id&&identity()===formIdentity&&canEdit(d);
  overlay.onclick=e=>{if(e.target===overlay)dismissForm();};overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();dismissForm();}else if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];if(!nodes.length)return;if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}};
  if(area){area.value=original.catalogo_area_id||'';}
  const updateOptions=()=>{if(!area||!service)return;const old=service.value||original.catalogo_servico_id||'';service.replaceChildren();const empty=el('option','','Somente a área — serviço ainda não identificado');empty.value='';service.append(empty);for(const s of data.servicos.values()){if(s.area_id!==area.value||(!s.ativo&&s.id!==original.catalogo_servico_id))continue;const opt=el('option','',s.nome+(s.ativo?'':' (inativo, já registrado)'));opt.value=s.id;service.append(opt);}service.value=[...service.options].some(o=>o.value===old)?old:'';};
  if(area){area.onchange=()=>{original.catalogo_servico_id=null;service.value='';updateOptions();};updateOptions();service.value=original.catalogo_servico_id||'';}
  desc.value=original.descricao_referencia||'';attend.value=original.situacao_atendimento||'';if(original.situacao_atendimento==='em_execucao')attend.disabled=true;if(date)date.value=original.executado_em_informado||'';reason.value=original.justificativa||'';
  const conditional=()=>{if(date){date.closest('label').hidden=attend.value!=='executado_informado';date.required=attend.value==='executado_informado';}reason.closest('label').hidden=!['nao_executavel','fora_competencia','cancelado'].includes(attend.value);reason.required=!reason.closest('label').hidden;};attend.onchange=conditional;conditional();close.focus();
  f.onsubmit=async event=>{
   event.preventDefault();if(!ownsForm()){error('Sua sessão ou o pedido mudou. Reabra a demanda.');return;}
   if(suggestionCheck&&!suggestionCheck.checked){error('Confirme conscientemente o serviço sugerido antes de salvar.');return;}
   const updated={...original,descricao_referencia:clean(desc.value)||null,situacao_atendimento:attend.value||null,executado_em_informado:date&&attend.value==='executado_informado'?date.value:null,justificativa:reason.required?clean(reason.value)||null:null};
   if(isProblem){updated.natureza='problema';updated.problema='afundamento';updated.classificacao=null;updated.catalogo_area_id=null;updated.catalogo_servico_id=null;}
   else{updated.catalogo_area_id=area.value||null;updated.catalogo_servico_id=service.value||null;updated.problema=null;updated.classificacao=updated.catalogo_servico_id?'confirmada':'pendente';}
   if(!isProblem&&!updated.catalogo_area_id){error('Selecione a área.');return;}
   if(!isProblem&&!updated.catalogo_servico_id&&!updated.descricao_referencia){error('Descreva o serviço ainda não identificado.');return;}
   if(updated.situacao_atendimento==='executado_informado'&&(!updated.catalogo_servico_id||updated.classificacao!=='confirmada'||!updated.executado_em_informado)){error('Para informar execução, escolha e confirme o serviço e informe a data.');return;}
   if(updated.executado_em_informado&&updated.executado_em_informado>today()){error('A data informada não pode ser futura.');return;}
   if(reason.required&&!updated.justificativa){error('Informe a justificativa.');return;}
   if(isProblem&&!existing&&haAfundamentoAtivo()){
    error('Este afundamento já está registrado neste pedido. Atualize a lista antes de tentar outro lançamento.');
    save.disabled=true;return;
   }
   // Bloqueio preventivo no cliente. A validação transacional do banco continua necessária.
   if(!isProblem&&updated.catalogo_servico_id&&updated.situacao_atendimento!=='cancelado'){
    const duplicado=rows.find(r=>r.natureza==='servico'&&r.catalogo_servico_id===updated.catalogo_servico_id&&
      r.id!==updated.id&&r.situacao_atendimento!=='cancelado');
    if(duplicado){error('Este serviço já consta neste pedido. Edite o item existente na lista em vez de incluí-lo novamente. Nenhuma gravação foi enviada.');service.focus();return;}
   }
   const full=rows.map(r=>serialize(existing?.id===r.id?updated:r));if(!existing)full.push(serialize(updated));
   const payload={p_demanda_id:d.id,p_versao:state.version,p_itens:full};const same=state.pending&&state.pending.demanda===d.id&&JSON.stringify(state.pending.payload)===JSON.stringify(payload);
   const operacao=same?state.pending.operacao:crypto.randomUUID();state.pending={demanda:d.id,payload,operacao};
   f.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=true);save.textContent='Salvando…';
   try{
    const q=await sb.rpc('ap52_demanda_servicos_salvar',{p_operacao:operacao,...payload});
    // Uma resposta antiga pode concluir no servidor, mas nunca pode modificar outro formulário/sessão.
    if(!ownsForm())return;
    if(q.error)throw q.error;
    state.pending=null;state.notice=null;closeModal();await loadCurrent(d.id,true);
    if(!selectedFresh(d.id,state.generation))return;
    if(typeof dem52RenderContexto==='function')dem52RenderContexto();void updateSummary();
   }catch(ex){if(!ownsForm())return;if(ex?.code==='40001'){
     // Não recarregar/fechar aqui: isso apagava o aviso e o formulário sem que a pessoa pudesse lê-lo.
     conflicted=true;state.pending=null;
     f.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=false);
     save.disabled=true;save.textContent='Salvamento bloqueado: lista desatualizada';
     state.notice={demanda:d.id,texto:'A lista de serviços foi alterada em outra sessão. Sua edição NÃO foi salva. Atualize a lista, confira as alterações e faça a edição novamente.'};
     error('Sua edição NÃO foi salva: outra pessoa alterou a lista. Os dados que você digitou continuam nesta janela para consulta. Não é possível reenviar sem atualizar e conferir a lista.');
     const reload=el('button','btn btn-ghost','Atualizar lista e refazer');reload.type='button';
     reload.onclick=()=>{if(!window.confirm('A edição nesta janela NÃO foi salva. Copie o que precisar antes de atualizar. Deseja descartar este formulário e consultar a lista atualizada?'))return;closeModal();void loadCurrent(d.id,true);};
     foot.insertBefore(reload,save);
     alert.scrollIntoView({block:'nearest'});
    }
    else if(ex?.code==='23505'){
     // Duplicidade de item é rejeição definitiva, não erro de rede: não oferecer reenvio.
     state.pending=null;f.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=false);
     save.disabled=true;save.textContent='Item já registrado';
     error(isProblem?'Este afundamento já está registrado neste pedido. Atualize a lista para conferir.':'Este serviço já consta na demanda. Atualize a lista para conferir.');
     const refresh=el('button','btn btn-ghost','Atualizar lista');refresh.type='button';
     refresh.onclick=()=>{closeModal();void loadCurrent(d.id,true);};foot.insertBefore(refresh,save);
    }
    else{f.querySelectorAll('button,input,select,textarea').forEach(n=>n.disabled=false);conditional();save.textContent='Tentar reenviar';error('Não foi possível confirmar a gravação. Confira a conexão e tente reenviar sem alterar os campos.');}}
  };
  function error(txt){alert.textContent=txt;alert.hidden=false;}
  function dismissForm(){closeModal();if(conflicted&&current()?.id===d.id)void loadCurrent(d.id,true);}
 }
 function showInline(txt,kind='warn'){const box=dem52El('contexto')?.querySelector('.'+PX+'-section');if(box){const p=message(txt,kind);p.setAttribute('role','alert');box.prepend(p);}}
 function closeModal(){if(state.overlay){state.overlay.remove();state.overlay=null;}state.form=null;}
 // 10.4.5 — interface desativada automaticamente até a migração R2 (colunas + RPC) estar instalada.
 // Esta transição utiliza a mesma idempotência, versão e escopo dos demais serviços (Caminho B).
 async function openExecutionForm(row){
  const d=current();if(!d||!canEdit(d)||!state.execReady||!row?.id||state.selected!==d.id||
   state.version===null||state.loading||state.error||row.deleted_at||row.natureza!=='servico'||
   row.classificacao!=='confirmada'||!row.catalogo_servico_id||
   !['solicitado','em_execucao'].includes(row.situacao_atendimento))return;
  const isStart=row.situacao_atendimento==='solicitado';
  const target=isStart?'em_execucao':'executado_informado';
  const gen=state.generation,who=identity(),version=state.version;
  closeModal();const overlay=el('div',PX+'-overlay'),dialog=el('section',PX+'-modal');
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-label',isStart?'Registrar início da execução':'Informar execução do serviço');
  dialog.tabIndex=-1;
  const header=el('div',PX+'-modal-head');header.append(el('h3','',isStart?'Registrar início da execução':'Informar execução do serviço'));
  const close=el('button','btn btn-ghost','Fechar');close.type='button';header.append(close);dialog.append(header);
  const form=el('form',PX+'-form');
  form.append(message(isStart?'O sistema registrará a data e o usuário responsável pelo início. Isso não indica execução concluída.':'A conclusão será apenas informada pela gerência. A comprovação por fotos ou relatório é independente.','hint'));
  const date=isStart?null:makeField(form,'input','Data em que o serviço foi executado','execucao_data_1045');
  const minimumDate=!isStart&&row.inicio_execucao_em?spDate(row.inicio_execucao_em):null;
  if(date){date.type='date';date.max=today();if(minimumDate)date.min=minimumDate;date.required=true;}
  const note=makeField(form,'textarea','Observação do andamento (opcional)','observacao_andamento_1045');note.maxLength=2000;
  note.value=row.observacao_andamento||'';
  const alert=message('','error');alert.hidden=true;alert.setAttribute('role','alert');form.append(alert);
  const foot=el('div',PX+'-modal-foot'),cancel=el('button','btn btn-ghost','Cancelar'),save=el('button','btn btn-primary',isStart?'Confirmar início':'Registrar execução informada');
  cancel.type='button';save.type='submit';foot.append(cancel,save);form.append(foot);dialog.append(form);overlay.append(dialog);document.body.append(overlay);
  state.overlay=overlay;state.form=form;
  let busy=false, uncertain=false;
  const owns=()=>state.overlay===overlay&&state.form===form&&state.generation===gen&&
    state.selected===d.id&&current()?.id===d.id&&identity()===who&&canEdit(d);
  const dismiss=()=>{if(!busy)closeModal();};close.onclick=dismiss;cancel.onclick=dismiss;
  overlay.onclick=e=>{if(e.target===overlay)dismiss();};
  overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}};
  const error=txt=>{alert.hidden=false;alert.textContent=txt;};
  form.onsubmit=async e=>{
   e.preventDefault();if(busy)return;
   if(!owns()||state.version!==version){error('A demanda ou sessão mudou. Feche e atualize a lista antes de tentar.');return;}
   const payload={p_demanda_id:d.id,p_item_id:row.id,p_versao:version,p_situacao:target,
     p_executado_em:isStart?null:date.value||null,p_observacao:clean(note.value)||null};
   if(!isStart&&(!payload.p_executado_em||payload.p_executado_em>today())){error('Informe uma data de execução válida, não futura.');return;}
   if(!isStart&&minimumDate&&payload.p_executado_em<minimumDate){error('A data de execução não pode ser anterior à data de início registrada.');return;}
   if(payload.p_observacao&&payload.p_observacao.length>2000){error('A observação deve ter no máximo 2000 caracteres.');return;}
   const key=JSON.stringify(payload),same=state.pendingExecution?.key===key&&state.pendingExecution?.demanda===d.id;
   // Uma operação cujo resultado ficou incerto nunca deve ser reenviada com dados diferentes.
   if(uncertain&&!same){error('Os dados da tentativa anterior mudaram. Atualize a lista antes de prosseguir.');return;}
   const operation=same?state.pendingExecution.operacao:crypto.randomUUID();
   state.pendingExecution={demanda:d.id,key,operacao:operation};
   busy=true;form.querySelectorAll('button,input,textarea').forEach(n=>n.disabled=true);save.textContent='Registrando…';
   try{
    const result=await sb.rpc('ap52_demanda_servico_andamento_1045',{p_operacao:operation,...payload});
    if(!owns())return;
    if(result.error)throw result.error;
    state.pendingExecution=null;state.notice=null;closeModal();
    await loadCurrent(d.id,true);
    if(selectedFresh(d.id,state.generation)){if(typeof dem52RenderContexto==='function')dem52RenderContexto();void updateSummary();}
   }catch(ex){if(!owns())return;busy=false;save.disabled=false;cancel.disabled=false;close.disabled=false;
    if(['40001','22023','42501','PGRST202','42883','23514'].includes(ex?.code)){
     state.pendingExecution=null;save.disabled=true;save.textContent='Operação não realizada';
     error(ex?.code==='40001'?'A lista mudou em outra sessão. Sua ação não foi aplicada. Atualize o pedido.':
      ex?.code==='42501'?'Você não tem permissão para acompanhar este serviço.':
      ['PGRST202','42883'].includes(ex?.code)?'O acompanhamento 10.4.5 não está instalado ou disponível no banco.':'A transição foi recusada pelo banco. Atualize e confira a situação do serviço.');
     const refresh=el('button','btn btn-ghost','Atualizar serviços');refresh.type='button';
     refresh.onclick=()=>{closeModal();void loadCurrent(d.id,true);};foot.insertBefore(refresh,save);
    }else{
     uncertain=true;save.textContent='Repetir a mesma operação';
     error('Não foi possível confirmar o resultado. Verifique a conexão e repita esta MESMA operação, sem alterar os dados.');
    }
   }
  };
  (date||note).focus();
 }
 // Caminho B: nunca emitir UPDATE direto. As RPCs precisam existir e ser homologadas no banco.
 async function openAdministrativeAction(row,action){
  const d=current();if(!d||!canArchive(d)||!row?.id||state.selected!==d.id||state.version===null||state.error||state.loading)return;
  if(action!=='arquivar'&&action!=='restaurar')return;
  if(action==='arquivar'&&row.deleted_at||action==='restaurar'&&!row.deleted_at)return;
  const token=state.generation,who=identity(),version=state.version;
  closeModal();let busy=false;const overlay=el('div',PX+'-overlay'),dialog=el('section',PX+'-modal');
  overlay.setAttribute('role','presentation');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',action==='arquivar'?'Arquivar serviço':'Restaurar serviço');dialog.tabIndex=-1;
  const heading=el('div',PX+'-modal-head');heading.append(el('h3','',action==='arquivar'?'Arquivar item do pedido':'Restaurar item do pedido'));
  const close=el('button','btn btn-ghost','Fechar');close.type='button';close.onclick=()=>{if(!busy)closeModal();};heading.append(close);dialog.append(heading);
  const form=el('form',PX+'-form'),description=el('p',PX+'-hint',action==='arquivar'?'Arquivar retira este item da lista ativa, mas mantém o registro e seu histórico. Não é o mesmo que Cancelado.':'Restaurar devolve o item à lista ativa. O banco deve recusar duplicidades ou conflitos.');form.append(description);
  const refer=el('p',PX+'-hint','Item: '+(row.natureza==='problema'?'Afundamento':clean(row.descricao_referencia)||'Serviço registrado') );form.append(refer);
  let reason=null;if(action==='arquivar'){reason=makeField(form,'textarea','Motivo obrigatório do arquivamento','motivo_arquivamento');reason.required=true;reason.maxLength=4000;reason.placeholder='Explique por que este item deve ser arquivado';}
  const alert=message('','error');alert.hidden=true;alert.setAttribute('role','alert');form.append(alert);
  const foot=el('div',PX+'-modal-foot'),cancel=el('button','btn btn-ghost','Cancelar'),confirm=el('button','btn btn-primary',action==='arquivar'?'Confirmar arquivamento':'Confirmar restauração');cancel.type='button';cancel.onclick=()=>{if(!busy)closeModal();};confirm.type='submit';foot.append(cancel,confirm);form.append(foot);dialog.append(form);overlay.append(dialog);document.body.append(overlay);state.overlay=overlay;state.form=form;
  const owns=()=>state.overlay===overlay&&state.form===form&&state.generation===token&&state.selected===d.id&&current()?.id===d.id&&identity()===who&&canArchive(d);
  overlay.onclick=e=>{if(e.target===overlay&&!busy)closeModal();};overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();if(!busy)closeModal();}else if(e.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];if(nodes.length&&e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(nodes.length&&!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}};
  const showError=msg=>{alert.textContent=msg;alert.hidden=false;};
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;if(!owns()||state.version!==version){showError('A sessão ou a lista mudou. Feche, atualize o pedido e confira novamente. Nenhuma operação foi enviada.');return;}
   const motive=action==='arquivar'?clean(reason.value):null;if(action==='arquivar'&&!motive){showError('Informe o motivo do arquivamento. Nenhuma operação foi enviada.');reason.focus();return;}
   const rpc=action==='arquivar'?'ap52_demanda_servico_arquivar':'ap52_demanda_servico_restaurar';
   const payload={p_demanda_id:d.id,p_item_id:row.id,p_versao:version};if(action==='arquivar')payload.p_motivo=motive;
   const key=JSON.stringify({rpc,payload});const same=state.pendingAdmin?.key===key;
   const operation=same?state.pendingAdmin.operacao:crypto.randomUUID();state.pendingAdmin={key,operacao:operation};
   busy=true;form.querySelectorAll('button,textarea').forEach(n=>n.disabled=true);confirm.textContent='Processando…';
   try{
    const q=await sb.rpc(rpc,{p_operacao:operation,...payload});if(!owns())return;if(q.error)throw q.error;
    state.pendingAdmin=null;state.notice=null;closeModal();await loadCurrent(d.id,true);
    if(selectedFresh(d.id,state.generation)){if(typeof dem52RenderContexto==='function')dem52RenderContexto();void updateSummary();}
   }catch(ex){if(!owns())return;busy=false;form.querySelectorAll('button,textarea').forEach(n=>n.disabled=false);confirm.textContent='Tentar novamente';
    if(ex?.code==='40001'){
     state.pendingAdmin=null;confirm.disabled=true;showError('A lista mudou em outra sessão. Nada foi arquivado ou restaurado por esta tentativa. Atualize a lista e confira novamente.');
     state.notice={demanda:d.id,texto:'A lista de serviços mudou. Atualize antes de tentar arquivar ou restaurar. Esta tentativa não foi gravada.'};
    }else if(ex?.code==='22023'){
     // Rejeição determinística: repetir a mesma operação não resolve o problema.
     // Exigir nova conferência do item, sem reutilizar o UUID desta tentativa.
     state.pendingAdmin=null;confirm.disabled=true;showError('Esta operação não é válida para o estado atual do item, ou os dados da tentativa mudaram. Nada foi gravado. Feche esta janela, atualize a lista e confira novamente.');
    }else if(ex?.code==='42501'||ex?.code==='PGRST301'){
     state.pendingAdmin=null;confirm.disabled=true;showError('Você não tem autorização para esta operação. Nenhuma alteração foi confirmada.');
    }else if(ex?.code==='PGRST202'||ex?.code==='42883'){
     state.pendingAdmin=null;confirm.disabled=true;showError('Arquivamento ainda não habilitado no banco. A implantação da RPC precisa ser concluída antes do uso.');
    }else if(ex?.code==='23505'||ex?.code==='23514'){
     state.pendingAdmin=null;confirm.disabled=true;showError('Não foi possível concluir: já existe item ativo equivalente ou há uma restrição de integridade. Atualize a lista para conferir.');
    }else{if(reason)reason.disabled=true;showError('Não foi possível confirmar o resultado. Mantenha o mesmo motivo e use Tentar novamente, sem iniciar outra operação.');}
   }
  };
  (reason||confirm).focus();
 }
 async function updateSummary(){if(!resetIdentity())return;const rows=dem52?.itens||[],ids=rows.map(d=>d.id).filter(Boolean),token=++state.summaryToken,gen=state.generation;
  if(!ids.length)return;
  try{const r=await sb.from('demanda_servicos_resumo').select('demanda_id,itens_ativos,servicos,problemas,sem_servico,solicitados,executados_informados,cancelados').in('demanda_id',ids);if(r.error)throw r.error;
    if(token!==state.summaryToken||gen!==state.generation)return;
    state.summary=new Map((r.data||[]).map(x=>[x.demanda_id,x]));
    for(const row of dem52El('lista')?.querySelectorAll('[data-dem52-id]')||[]){row.querySelector('.'+PX+'-row-summary')?.remove();const v=state.summary.get(row.dataset.dem52Id);if(!v||!v.itens_ativos)continue;const sum=el('span',PX+'-row-summary',`${v.servicos} ${v.servicos===1?'serviço':'serviços'}${v.executados_informados?' · '+v.executados_informados+' executado(s) informado(s)':''}${v.problemas?' · '+v.problemas+' problema(s)':''}${v.sem_servico?' · '+v.sem_servico+' a classificar':''}`);row.append(sum);}
  }catch(e){/* Erro não deve impedir a lista principal nem revelar registros de outro escopo. */}
 }
 function renderDemand(){if(!resetIdentity())return;const d=current();if(!d)return;
   if(state.selected!==d.id){void loadCurrent(d.id,true);return;}
   renderSection();
 }
 // Nao salva nem preenche situacao de execucao: so abre o formulario homologado da 6.6G.2.
 async function conferirSugestao(info){
  const d=current();if(!d||!canEdit(d)||state.selected!==d.id||d.id!==info?.demandaId||state.version===null||state.error||state.loading)return false;
  if(info.tipo==='problema'&&info.identificador==='afundamento'){
   if(haAfundamentoAtivo()){showInline('Este afundamento já está registrado neste pedido.');return false;}
   await openForm(null,'problema',{reference:clean(info.trecho)});
  }
  else if(info.tipo==='servico_a_identificar'&&info.area==='Drenagem'){
   const data=await catalog();const area=[...(data?.areas?.values()||[])].find(a=>a.codigo==='drenagem');
   if(!area)return false;
   await openForm(null,'servico',{area:area.id,reference:clean(info.trecho)});
  }else return false;
  return true;
 }
 function install(){if(typeof dem52RenderContexto!=='function'||typeof dem52Render!=='function'||!window.AP52Catalogo66g1)return false;
   if(window.__ap52G2Installed)return true;
   const oldContext=dem52RenderContexto,oldRender=dem52Render;
   dem52RenderContexto=function(){const result=oldContext.apply(this,arguments);renderDemand();return result;};
   dem52Render=function(){const result=oldRender.apply(this,arguments);void updateSummary();return result;};
   // Defesa para saídas por wrappers, abas, histórico ou ocultação do shell.
   // O observador de navegação permanece instalado após clearAll; não observa o formulário.
   const navigationObserver=new MutationObserver(()=>{
    if(!contextoDemandasAtivo()&&(state.identity!==null||state.selected!==null||state.overlay))clearAll();
   });
   for(const host of [document.getElementById('view-demandas'),document.getElementById('app-shell')]){
    if(host)navigationObserver.observe(host,{attributes:true,attributeFilter:['style','class','data-dem52c-aba']});
   }
   window.AP52Demandas66g2={loadCurrent,clearAll,updateSummary,conferirSugestao,itensParaConferencia,status:()=>({selected:state.selected,version:state.version,items:state.rows.length,error:state.error})};window.__ap52G2Installed=true;return true;
 }
 if(!install())document.addEventListener('DOMContentLoaded',()=>{if(!install())console.warn('[AP5.2/6.6G.2] Módulos ainda não disponíveis.');},{once:true});
})();
