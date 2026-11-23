/* AP5.2 Etapa 6.6G — R10.2 / complemento de cards, edicao e pendencias
   R10.2.1-cards (14/10/2026): bloco 'Execucao do servico' nos pedidos historicos — mostra o servico executado ligado
   (servicos_demandas_vinculos) ou aponta o que falta informar (se foi executado, quando, qual servico). Somente leitura.
   Base compativel: v65.42.156.4.3. RLS e triggers de auditoria no Supabase.
   Nao modifica status operacional, nao executa importacao e nao altera servicos.
*/
(function () {
 'use strict';
 const PREFIX='ap52-66g';
 const TIPOS={campo_ausente:'Informação ausente',endereco_divergente:'Endereço divergente',possivel_duplicidade:'Possível duplicidade',revisao_territorial:'Conferência territorial',outra:'Outras observações'};
 const STATUSES={pendente:'Pendente',em_analise:'Em análise',resolvida:'Resolvida',descartada:'Descartada'};
 const CAMPOS={protocolo:'Protocolo',logradouro:'Logradouro',numero:'Número',trecho_referencia:'Trecho ou referência',bairro:'Bairro',sub_bairro:'Sub-bairro',solicitante:'Solicitante',assunto:'Assunto',tipo_servico_id:'Tipo de serviço (catálogo)',observacao:'Observações da gerência'};
 const state={cache:new Map(),failures:new Set(),generation:0,items:null,loading:new Map(),modal:null,editing:null,detail:0,rendering:false};
 const el=(tag,cls,txt)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(txt!=null)node.textContent=String(txt);return node;};
 const safe=v=>String(v??'').trim();
 const textData=v=>safe(v)||'Não informado';
 const canEdit=d=>!!(typeof pode28==='function' && pode28('demandas','editar') && typeof dem52Pode==='function' && dem52Pode() && (typeof dem52Global==='function' && dem52Global() || d?.gerencia===(typeof acesso28!=='undefined'?acesso28?.user?.gerencia:null)));
 const historic=d=>!!d?.origem_migracao;
 const historicalReview=d=>historic(d)&&['recebida','em_triagem'].includes(d.status); // Classificacao de CONSULTA, nunca obra pendente
 function derived(d){
  const out=[];
  if(!safe(d.bairro))out.push({key:'bairro',text:'Bairro não informado'});
  if(!safe(d.assunto)||/assunto n[aã]o informado na fonte/i.test(safe(d.assunto)))out.push({key:'assunto',text:'Assunto não informado na fonte'});
  if(!safe(d.solicitante))out.push({key:'solicitante',text:'Solicitante não informado'});
  if(!safe(d.numero)&&!safe(d.trecho_referencia))out.push({key:'numero',text:'Número ou trecho não informado'});
  if(!safe(d.origem?.nome))out.push({key:'origem',text:'Origem não identificada'});
  if(historic(d)&&/poss[ií]vel\s+repeti[cç][aã]o/i.test(safe(d.observacao)))out.push({key:'duplicidade',text:'Possível repetição documental — conferir protocolo relacionado'});
  if(historic(d)&&/(rua n[aã]o encontrada|logradouro n[aã]o encontrado|grafia divergente)/i.test(safe(d.observacao)))out.push({key:'endereco',text:'Endereço requer conferência'});
  // v65.42.156.4.7.1: aviso apenas enquanto o serviço solicitado não tiver classificação efetiva.
  // O assunto original permanece intocado para rastreabilidade; não presumir serviço executado.
  const nomeTipo=safe(d.servico?.nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const tipoConfirmado=!!safe(d.tipo_servico_id) && nomeTipo!=='OUTROS / A CLASSIFICAR';
  if(historic(d)&&!tipoConfirmado&&/\bPRACAS?\b|\bAREA DE LAZER\b/.test(safe(d.assunto).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()))out.push({key:'praça',text:'Pedido relacionado a praça: confira qual serviço foi solicitado'});
  return out;
 }
 function pendList(id){return state.cache.get(id)||[];}
 function alerts(d){
  const persisted=pendList(d.id).filter(p=>p.situacao==='pendente'||p.situacao==='em_analise');
  const projected=derived(d).filter(x=>!persisted.some(p=>{
   const t=safe(p.titulo)+' '+safe(p.descricao);
   return t.toLowerCase().includes(x.key)|| (x.key==='duplicidade'&&p.tipo==='possivel_duplicidade') || (x.key==='endereco'&&['endereco_divergente','revisao_territorial'].includes(p.tipo));
  }));
  return {persisted,projected};
 }
 function showNotice(node,msg,kind){node.replaceChildren(el('p',PREFIX+'-'+(kind||'notice'),msg));}
 function nodeMatchesPage(){return typeof dem52!=='undefined'&&Array.isArray(dem52.itens)&&typeof dem52El==='function'&&!!dem52El('lista');}
 function appendPills(){
  if(!nodeMatchesPage())return;
  for(const d of dem52.itens){
   const row=[...dem52El('lista').querySelectorAll('[data-dem52-id]')].find(n=>n.dataset.dem52Id===d.id);
   if(!row||row.querySelector('.'+PREFIX+'-summary'))continue;
   const {persisted,projected}=alerts(d),n=persisted.length+projected.length;
   const hint=el('span',PREFIX+'-summary');
   if(historicalReview(d))hint.append(el('span',PREFIX+'-historical','Histórica · Informações a conferir'));
   if(state.cache.has(d.id)){
    if(n){hint.append(el('span',PREFIX+'-counter',`${n} ${n===1?'pendência':'pendências'}`));
      const first=persisted[0]?.titulo||projected[0]?.text;
      hint.append(el('span',PREFIX+'-hint',first));
    }else hint.append(el('span',PREFIX+'-ok','Sem pendências identificadas'));
   }else if(state.failures.has(d.id)){
    hint.append(el('span',PREFIX+'-error','Pendências salvas indisponíveis'));
    const automatic=derived(d);if(automatic.length)hint.append(el('span',PREFIX+'-hint',automatic[0].text));
   }else hint.append(el('span',PREFIX+'-muted','Verificando observações…'));
   row.append(hint);
  }
 }
 async function batchLoad(){
  if(!nodeMatchesPage())return;
  const ids=dem52.itens.map(x=>x.id).filter(Boolean);
  if(!ids.length)return;
  const pending=ids.filter(id=>!state.cache.has(id));if(!pending.length){appendPills();return;}
  const signature=pending.join(',');if(state.loading.has(signature))return;
  const gen=state.generation;
  state.loading.set(signature,true);
  try{
   const {data,error}=await sb.from('demanda_pendencias').select('id,demanda_id,tipo,titulo,descricao,origem,id_relacionado,situacao,criado_em,resolvido_em,justificativa_resolucao').in('demanda_id',pending).order('criado_em',{ascending:false});
   if(error)throw error;
   if(gen!==state.generation)return;
   for(const id of pending){state.cache.set(id,[]);state.failures.delete(id);}
   for(const item of (data||[]))if(state.cache.has(item.demanda_id))state.cache.get(item.demanda_id).push(item);
   dem52El('lista')?.querySelectorAll('.'+PREFIX+'-summary').forEach(node=>node.remove());
   appendPills();
   refreshDetail();
  }catch(e){
   if(gen!==state.generation)return;
   for(const id of pending)state.failures.add(id);
   console.warn('[AP5.2/6.6G] A leitura de pendências falhou:',e?.code||'consulta');
   const rows=dem52El('lista')?.querySelectorAll('.'+PREFIX+'-summary');
   rows?.forEach(n=>{n.replaceChildren(el('span',PREFIX+'-error','Pendências indisponíveis — tente Atualizar'));});
   refreshDetail();
  }finally{state.loading.delete(signature);}
 }
 function renderList(){
  if(!nodeMatchesPage())return;
  if(dem52.itens!==state.items){state.items=dem52.itens;state.cache.clear();state.failures.clear();state.generation++;}
  appendPills();
  void batchLoad();
 }
 function selected(){return typeof dem52!=='undefined' ? dem52.itens.find(x=>x.id===dem52.selecionada)||(dem52.confirmado?.id===dem52.selecionada?dem52.confirmado:null):null;}
 function addLine(parent,label,value){const row=el('div',PREFIX+'-field');row.append(el('dt','',label),el('dd','',textData(value)));parent.append(row);}
 function dateStr(s){if(!s)return 'Data não informada';const d=new Date(s);return Number.isNaN(d.getTime())?String(s):new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);}
 function historyDiff(h){
  const dsEvents={servico_incluido:'Serviço do pedido incluído',servico_alterado:'Serviço do pedido alterado',servico_arquivado:'Serviço do pedido arquivado',servico_restaurado:'Serviço do pedido restaurado'};
  if(dsEvents[h.tipo_evento])return dsEvents[h.tipo_evento];
  const a=h.antes||{},b=h.depois||{},names={...CAMPOS,protocolo:'Protocolo',status:'Situação',prazo:'Prazo',data_recebimento:'Recebimento',origem_id:'Origem',tipo_servico_id:'Tipo antigo'};
  const changed=Object.keys(names).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
  return changed.slice(0,7).map(k=>names[k]).join(', ') || ({pendencia_criada:'Pendência registrada',pendencia_alterada:'Pendência atualizada'}[h.tipo_evento]||'Registro de alteração');
 }
 function detailFresh(section,id){return section.isConnected&&selected()?.id===id;}
 const brData=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(8,10)+'/'+String(v).slice(5,7)+'/'+String(v).slice(0,4):'data não informada';
 async function loadExecution(box,section,d,token){
  try{
   const v=await sb.from('servicos_demandas_vinculos').select('servico_id').eq('demanda_id',d.id);
   if(v.error)throw v.error;
   const ids=[...new Set((v.data||[]).map(x=>x.servico_id).filter(Boolean))];
   let servicos=[];
   if(ids.length){const r=await sb.from('servicos_executados').select('id,data_execucao,servico_apresentacao').in('id',ids);if(r.error)throw r.error;servicos=r.data||[];}
   if(token!==state.detail||!detailFresh(section,d.id))return;
   box.querySelector('.'+PREFIX+'-muted')?.remove();
   if(servicos.length){
    box.append(el('p','',servicos.length===1?'Serviço executado ligado a este pedido:':'Serviços executados ligados a este pedido:'));
    const ul=el('ul',PREFIX+'-exec-list');
    for(const s of servicos.sort((a,b)=>String(a.data_execucao||'').localeCompare(String(b.data_execucao||''))))ul.append(el('li','',`${safe(s.servico_apresentacao)||'Serviço não informado'} — ${brData(s.data_execucao)}`));
    box.append(ul);
   }else{
    box.append(el('p','','Não há comprovação vinculada ao BDS para este pedido. A situação da planilha antiga (por exemplo, “Concluída”) não comprova a execução.'));
    box.append(el('p',PREFIX+'-muted','Consulte “Serviços do pedido” para ver execuções informadas pela gerência, ainda sem comprovação. O vínculo formal à execução será feito na Etapa 6.6G.5.'));
   }
  }catch(e){if(token!==state.detail||!detailFresh(section,d.id))return;showNotice(box,'Não foi possível consultar a execução agora.','error');}
 }
 async function loadAdditional(section,d,token){
  const original=section.querySelector('.'+PREFIX+'-original');
  const history=section.querySelector('.'+PREFIX+'-history');
  const req=[original?sb.from('demanda_origem_imutavel').select('dados_originais,arquivo_origem').eq('demanda_id',d.id).maybeSingle():Promise.resolve({data:null,error:null}),sb.from('demanda_alteracoes').select('tipo_evento,alterado_em,alterado_por,antes,depois').eq('demanda_id',d.id).order('alterado_em',{ascending:false}).limit(8)];
  try{
   const [a,b]=await Promise.all(req);
   if(token!==state.detail||!detailFresh(section,d.id))return;
   if(a.error||b.error)throw a.error||b.error;
   if(original&&a.data){original.replaceChildren();
    const meta=el('dl',PREFIX+'-meta');addLine(meta,'Arquivo de origem',a.data.arquivo_origem);
    const o=a.data.dados_originais||{};
    const labels={id_historico:'Identificador de origem',data_original:'Data original',endereco_original:'Endereço original',referencia_original:'Referência original',bairro_original:'Bairro original',assunto_original:'Serviço/assunto original',solicitante_original:'Solicitante original',situacao_original:'Situação original',observacao_original:'Observação da planilha original',fontes_originais:'Planilha(s) de origem',linhas_origem:'Linhas da fonte',id_sync_original:'Identificador técnico original'};
    for(const [k,label] of Object.entries(labels)){
      let v=o[k];
      if(k==='data_original' && typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v))v=v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4);
      addLine(meta,label,v===undefined||v===null||String(v).trim()===''?'Não informado na fonte':typeof v==='object'?JSON.stringify(v):v);
    }
    original.append(meta);
   }else if(original)showNotice(original,'Não há cópia de origem associada a este registro.','muted');
   history.replaceChildren();
   if(!(b.data||[]).length)history.append(el('p',PREFIX+'-muted','Nenhuma alteração registrada nesta etapa.'));
   for(const h of b.data||[]){const p=el('p',PREFIX+'-history-entry');p.append(el('strong','',dateStr(h.alterado_em)+' — '+historyDiff(h)));
    p.append(el('span','',`Registro por ${h.alterado_por?('usuário '+String(h.alterado_por).slice(0,8)+'…'):'processo administrativo'}`));history.append(p);}
  }catch(e){if(token!==state.detail||!detailFresh(section,d.id))return;if(original)showNotice(original,'Não foi possível consultar o original agora.','error');if(history)showNotice(history,'Não foi possível carregar o histórico.','error');}
 }
 function refreshDetail(){const c=typeof dem52El==='function'?dem52El('contexto'):null;c?.querySelector('.'+PREFIX+'-detail')?.remove();renderDetail();}
 function renderDetail(){
  if(typeof dem52El!=='function'||!nodeMatchesPage())return;
  const d=selected(),container=dem52El('contexto');
  if(!container||!d||!container.querySelector('.dem52-detail-title'))return;
  if(container.querySelector('.'+PREFIX+'-detail'))return;
  const section=el('section',PREFIX+'-detail');section.dataset.demandaId=d.id;
  const head=el('div',PREFIX+'-detail-head');head.append(el('h3','','Observações e pendências'));
  if(canEdit(d)){
   const edit=el('button','btn btn-primary '+PREFIX+'-edit','Editar informações');edit.type='button';edit.addEventListener('click',()=>void openEdit(d));head.append(edit);
  }
  section.append(head);
  if(historicalReview(d))section.append(el('p',PREFIX+'-historical-detail','Consulta histórica — a situação registrada precisa de conferência; este registro NÃO significa serviço pendente de execução.'));
  const {persisted,projected}=alerts(d),all=persisted.filter(x=>x.situacao==='pendente'||x.situacao==='em_analise');
  const observations=el('div',PREFIX+'-observations');observations.append(el('h4','','Observações da gerência'));
  observations.append(el('p','',textData(d.observacao)));section.append(observations);
  let execBox=null;
  if(historic(d)){execBox=el('div',PREFIX+'-execution');execBox.append(el('h4','','Execução do serviço'),el('p',PREFIX+'-muted','Verificando serviços executados ligados…'));section.append(execBox);}
  const alertBox=el('div',PREFIX+'-alerts');alertBox.append(el('h4','',`Pendências identificadas (${all.length+projected.length})`));
  if(!state.cache.has(d.id)) alertBox.append(el('p',state.failures.has(d.id)?PREFIX+'-error':PREFIX+'-muted',state.failures.has(d.id)?'Não foi possível consultar as pendências salvas; veja os avisos automáticos abaixo.':'Carregando pendências registradas…'));
  else if(!all.length&&!projected.length)alertBox.append(el('p',PREFIX+'-ok','Nenhuma pendência identificada pelas regras atuais.'));
  for(const p of all){const block=el('div',PREFIX+'-issue');
   const header=el('div',PREFIX+'-issue-head');header.append(el('strong','',safe(p.titulo)||TIPOS[p.tipo]||'Pendência'),el('span',PREFIX+'-status',STATUSES[p.situacao]||p.situacao));block.append(header);
   if(p.descricao)block.append(el('p','',p.descricao));
   if(p.id_relacionado)block.append(el('p',PREFIX+'-muted','Protocolo relacionado: '+p.id_relacionado));
   if(canEdit(d)){
    const resolve=el('button','btn btn-ghost '+PREFIX+'-small','Resolver / descartar');resolve.type='button';resolve.addEventListener('click',()=>openResolve(d,p));block.append(resolve);
   }alertBox.append(block);
  }
  for(const p of projected){const block=el('p',PREFIX+'-issue '+PREFIX+'-automatic');block.append(el('span',PREFIX+'-auto-label','Aviso automático'),el('span','',p.text));alertBox.append(block);}
  section.append(alertBox);
  // 10.4.3: apenas demandas importadas exibem o bloco da fonte original.
  let original=null;
  if(historic(d)){original=el('details',PREFIX+'-original-wrap');const origHead=el('summary','','Dados originais da importação');original.append(origHead);original.append(el('div',PREFIX+'-original','Carregando…'));section.append(original);}
  const audit=el('details',PREFIX+'-history-wrap');audit.append(el('summary','','Histórico das alterações'));audit.append(el('div',PREFIX+'-history','Carregando…'));section.append(audit);
  container.append(section);
  const token=++state.detail;if(execBox)void loadExecution(execBox,section,d,token);let extraLoaded=false;const showExtra=()=>{if(extraLoaded)return;extraLoaded=true;void loadAdditional(section,d,token);};
  if(original)original.addEventListener('toggle',()=>{if(original.open)showExtra();});
  audit.addEventListener('toggle',()=>{if(audit.open)showExtra();});
 }
 function fieldInput(k,d){
  const label=el('label',PREFIX+'-input-label');label.append(el('span','',CAMPOS[k]));
  const node=k==='tipo_servico_id'?document.createElement('select'):k==='observacao'?document.createElement('textarea'):document.createElement('input');
  node.name=k;node.value=safe(d[k]);node.autocomplete='off';if(k==='observacao')node.rows=4;
  if(k==='tipo_servico_id'){
   const option=el('option','','Não classificado');option.value='';node.append(option);
   label.append(node);
   const help=el('small',PREFIX+'-classification-help','Classifique pelo catálogo sem modificar o assunto original.');label.append(help);
   return label;
  }
  if(k==='assunto'||k==='logradouro')node.required=true;
  label.append(node);return label;
 }
 function modalBase(title){
  if(state.modal?.isConnected)closeModal();
  const overlay=el('div',PREFIX+'-overlay');overlay.id=PREFIX+'-overlay';
  const dialog=el('section',PREFIX+'-modal');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);dialog.tabIndex=-1;
  const head=el('div',PREFIX+'-modal-head');head.append(el('h3','',title));
  const close=el('button','btn btn-ghost','Fechar');close.type='button';close.addEventListener('click',closeModal);head.append(close);dialog.append(head);
  overlay.append(dialog);document.body.append(overlay);state.modal=overlay;state.editing={previousFocus:document.activeElement};
  overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});
  overlay.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();closeModal();return;}
   if(event.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  });
  close.focus();return dialog;
 }
 function closeModal(){const p=state.editing?.previousFocus;state.modal?.remove();state.modal=null;state.editing=null;if(p?.isConnected)p.focus({preventScroll:true});}
 function addFoot(form,cancelText,confirmText){const foot=el('div',PREFIX+'-modal-foot');const cancel=el('button','btn btn-ghost',cancelText);cancel.type='button';cancel.addEventListener('click',closeModal);
  const save=el('button','btn btn-primary',confirmText);save.type='submit';foot.append(cancel,save);form.append(foot);return save;}
 function busy(form,on){form.querySelectorAll('button,input,textarea,select').forEach(x=>x.disabled=on);}
 function showFormError(form,msg){const err=form.querySelector('.'+PREFIX+'-form-error');if(err){err.textContent=msg;err.hidden=false;}}
 function rowRefresh(id,values){const row=dem52.itens.find(x=>x.id===id);if(row)Object.assign(row,values);if(dem52.confirmado?.id===id)Object.assign(dem52.confirmado,values);state.cache.delete(id);
  dem52Render();const d=selected();if(d)void batchLoad();}
 async function openEdit(d){
  if(!canEdit(d))return;
  const id=d.id,dialog=modalBase('Editar solicitação'),currentOverlay=state.modal;
  const note=el('p',PREFIX+'-notice','Os dados originais permanecem preservados. Toda alteração ficará registrada no histórico.');dialog.append(note);
  const form=el('form',PREFIX+'-edit-form'),grid=el('div',PREFIX+'-grid');
  const keys=Object.keys(CAMPOS).filter(k=>k!=='tipo_servico_id');
  for(const k of keys)grid.append(fieldInput(k,d));
  form.append(grid);
  const err=el('p',PREFIX+'-form-error');err.hidden=true;err.setAttribute('role','alert');form.append(err);
  const save=addFoot(form,'Cancelar','Salvar alterações');dialog.append(form);
  busy(form,true);save.textContent='Conferindo registro…';
  let version=null,fresh=null;
  try{
   // Sempre ler TODOS os campos editáveis atuais antes de liberar o formulário.
   // Ler apenas updated_at e manter valores antigos da lista provoca perda de notas de colegas.
   const r=await sb.from('demandas').select('id,updated_at,'+keys.join(',')).eq('id',id).maybeSingle();
   if(r.error||!r.data)throw r.error||Error('não encontrado');
   if(state.modal!==currentOverlay||!currentOverlay?.isConnected)return;
   if(!canEdit(d))throw Error('sem_permissao');
   fresh=Object.fromEntries(keys.map(key=>[key,safe(r.data[key])]));
   version=r.data.updated_at;
   if(!version)throw Error('sem_versao');
   // v65.42.156.4.9: tipo antigo permanece somente para leitura.
   // A classificacao editavel passa a existir exclusivamente em demanda_servicos.
   const changedSinceList=keys.some(key=>fresh[key]!==safe(d[key]));
   for(const key of keys){
    const node=form.elements.namedItem(key);
    if(node)node.value=fresh[key];
   }
   if(changedSinceList){
    const warn=el('p',PREFIX+'-notice '+PREFIX+'-fresh-warning',
      'Este pedido foi atualizado depois que a lista foi carregada. O formulário já mostra os dados atuais; confira antes de salvar.');
    note.after(warn);
   }
   busy(form,false);save.textContent='Salvar alterações';
  }catch(e){
   if(state.modal!==currentOverlay||!currentOverlay?.isConnected)return;
   showFormError(form,'Não foi possível carregar os dados atuais do registro. Feche e tente novamente.');
   save.textContent='Indisponível';return;
  }
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!version||!fresh||!canEdit(d)||state.modal!==currentOverlay)return;
   const changes={};
   for(const key of keys){
    const value=safe(form.elements.namedItem(key)?.value);
    // Comparar com o registro mais recente vindo do banco, nunca com o objeto antigo da lista.
    if(value!==fresh[key])changes[key]=value||null;
   }
   if(('logradouro' in changes&&!changes.logradouro)||('assunto' in changes&&!changes.assunto)){
    showFormError(form,'Logradouro e assunto não podem ficar vazios.');return;
   }
   if(!Object.keys(changes).length){closeModal();return;}
   busy(form,true);save.textContent='Salvando…';
   try{
    // Controle otimista: caso outra sessão tenha atualizado após a leitura atual, não sobrescrever.
    const q=await sb.from('demandas').update(changes).eq('id',id).eq('updated_at',version)
      .select('id,updated_at,'+keys.join(',')+',servico:demanda_tipos_servico(nome)').maybeSingle();
    if(q.error)throw q.error;
    if(!q.data)throw Error('concorrencia');
    if(state.modal===currentOverlay)closeModal();
    rowRefresh(id,q.data);
   }catch(e){
    if(state.modal!==currentOverlay||!currentOverlay?.isConnected)return;
    showFormError(form,e?.message==='concorrencia'?
      'Este pedido foi alterado por outra pessoa. Atualize a lista antes de editar novamente.':
      'Não foi possível salvar. Confira sua permissão e tente novamente.');
    busy(form,false);save.textContent='Tentar novamente';
   }
  });
 }
 function openResolve(d,p){
  if(!canEdit(d))return;
  const dialog=modalBase('Tratar pendência');dialog.append(el('p',PREFIX+'-notice',safe(p.titulo)));
  const form=el('form',PREFIX+'-resolve-form');const situation=el('label',PREFIX+'-input-label');situation.append(el('span','','Encaminhamento'));
  const select=el('select');select.name='situacao';for(const [v,label] of [['resolvida','Marcar como resolvida'],['descartada','Descartar alerta']]){const opt=el('option','',label);opt.value=v;select.append(opt);}situation.append(select);form.append(situation);
  const reason=el('label',PREFIX+'-input-label');reason.append(el('span','','Justificativa obrigatória'));const area=el('textarea');area.name='justificativa_resolucao';area.required=true;area.rows=4;reason.append(area);form.append(reason);
  const err=el('p',PREFIX+'-form-error');err.hidden=true;err.setAttribute('role','alert');form.append(err);const save=addFoot(form,'Cancelar','Confirmar');dialog.append(form);
  form.addEventListener('submit',async e=>{e.preventDefault();const why=safe(area.value);if(!why){showFormError(form,'Informe como a pendência foi conferida.');return;}busy(form,true);save.textContent='Salvando…';
   try{const res=await sb.from('demanda_pendencias').update({situacao:select.value,justificativa_resolucao:why}).eq('id',p.id).eq('demanda_id',d.id).in('situacao',['pendente','em_analise']).select('id').maybeSingle();
    if(res.error)throw res.error;if(!res.data)throw Error('concorrencia');closeModal();state.cache.delete(d.id);dem52Render();void batchLoad();
   }catch(ex){showFormError(form,'Não foi possível atualizar. Verifique se outro usuário já resolveu este alerta.');busy(form,false);save.textContent='Tentar novamente';}
  });
 }
 function install(){
  if(typeof dem52Render!=='function'||typeof dem52RenderContexto!=='function'||typeof dem52El!=='function'||typeof sb==='undefined')return false;
  if(window.__ap52Cards66gInstalled)return true;
  const origRender=dem52Render,origContext=dem52RenderContexto;
  dem52RenderContexto=function(){const ret=origContext.apply(this,arguments);renderDetail();return ret;};
  dem52Render=function(){const ret=origRender.apply(this,arguments);renderList();return ret;};
  window.__ap52Cards66gInstalled=true;return true;
 }
 if(!install()){
  document.addEventListener('DOMContentLoaded',()=>{if(!install())console.warn('[AP5.2/6.6G] Módulos de Demandas não disponíveis nesta página.');},{once:true});
 }
})();
