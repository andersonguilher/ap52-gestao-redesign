/* AP5.2 v65.42.156.4.11.1 — Central de Demandas / 6.6G.3C
   Somente leitura do catálogo homologado (2 áreas, 28 serviços, 65 termos).
   Não altera classificação legada, assunto, BDS, histórico, vínculos ou banco.
   Falha fechada: catálogo incompleto/indisponível = nenhuma sugestão oficial.
*/
(function () {
 'use strict';
 const NS='ap52-g1';
 const expected={areas:2,servicos:28,termos:65};
 const state={identity:null,epoch:0,data:null,loading:null,error:null};
 const panelRenderers=new WeakMap();
 const make=(tag,cls,content)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(content!=null)node.textContent=String(content);return node;};
 const norm=text=>String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function identity(){
  if(typeof dem52Pode!=='function'||!dem52Pode()||typeof sb==='undefined')return null;
  const uid=typeof acesso28!=='undefined'&&acesso28?.user?.user_id;
  if(!uid)return null;
  return String(uid)+'|'+String(typeof ac28Generation!=='undefined'?ac28Generation:'');
 }
 function clearOnIdentityChange(){
  const id=identity();
  if(state.identity!==id){state.identity=id;state.epoch++;state.data=null;state.error=null;state.loading=null;}
  return id;
 }
 function validate(areas,servicos,termos){
  if(areas.length!==expected.areas||servicos.length!==expected.servicos||termos.length!==expected.termos)throw Error('catálogo incompleto');
  const a=new Map(areas.map(v=>[v.id,v]));
  const s=new Map(servicos.map(v=>[v.id,v]));
  if(a.size!==expected.areas||s.size!==expected.servicos||new Set(servicos.map(v=>v.codigo)).size!==expected.servicos)throw Error('ids repetidos');
  if(areas.filter(v=>v.codigo==='drenagem').length!==1||areas.filter(v=>v.codigo==='pavimentacao').length!==1)throw Error('áreas divergentes');
  if(servicos.some(v=>!v.codigo||!v.nome||!a.has(v.area_id))||termos.some(t=>!s.has(t.servico_id)||!t.termo_normalizado||!['geral','demanda_historica','bds_drenagem_21gc'].includes(t.contexto)))throw Error('referência inválida');
  if(servicos.filter(v=>a.get(v.area_id).codigo==='drenagem').length!==23||servicos.filter(v=>a.get(v.area_id).codigo==='pavimentacao').length!==5)throw Error('distribuição divergente');
  if(termos.filter(t=>t.contexto==='bds_drenagem_21gc').length!==2||termos.filter(t=>t.contexto==='demanda_historica').length!==12)throw Error('escopo divergente');
  if(termos.some(t=>norm(t.termo)!==t.termo_normalizado)||new Set(termos.map(t=>t.contexto+'|'+t.termo_normalizado)).size!==expected.termos)throw Error('normalização divergente');
  // Não adicionar sinônimos de instalação ao catálogo; equivalência interpretativa fica no motor R3.
  if(termos.some(t=>t.termo_normalizado.includes('instalacao'))||servicos.some(v=>['construcao_grelha','construcao_tampao'].includes(v.codigo)))throw Error('homologação divergente');
  return {areas:a,servicos:s,termos};
 }
 async function load(force=false){
  const id=clearOnIdentityChange();if(!id)return null;
  if(state.data&&!force)return state.data;
  if(state.loading&&!force)return state.loading;
  state.error=null;const epoch=++state.epoch;
  const req=Promise.all([
   sb.from('catalogo_areas_servico').select('id,codigo,nome,ordem,ativo').eq('ativo',true).order('ordem'),
   sb.from('catalogo_servicos').select('id,area_id,codigo,nome,descricao,ordem,ativo').eq('ativo',true).order('ordem'),
   sb.from('catalogo_servico_termos').select('id,servico_id,termo,termo_normalizado,contexto,tipo,exige_conferencia')
  ]).then(values=>{
   for(const r of values)if(r.error||!Array.isArray(r.data))throw r.error||Error('leitura incompleta');
   const out=validate(...values.map(r=>r.data));
   if(epoch===state.epoch&&identity()===id){state.data=out;state.error=null;}
   return out;
  }).catch(err=>{
   if(epoch===state.epoch&&identity()===id){state.data=null;state.error=err?.code||'leitura';}
   return null;
  }).finally(()=>{if(epoch===state.epoch)state.loading=null;});
  state.loading=req;return req;
 }
 // Integracao 6.6G.3C: o motor R2 e a UNICA fonte de sugestoes.
 // O catalogo validado 2/28/65 continua sendo lido da fonte oficial, nunca de fixtures.
 function inputForEngine(dataset){
  const sv=[...dataset.servicos.values()].map(s=>({id:s.id,codigo:s.codigo,nome:s.nome,area:dataset.areas.get(s.area_id)?.nome||'',ativo:s.ativo}));
  const byId=new Map(sv.map(s=>[s.id,s.codigo]));
  const tt=dataset.termos.map(t=>({termo:t.termo,contexto:t.contexto,tipo:t.tipo,exige_conferencia:t.exige_conferencia,servico_codigo:byId.get(t.servico_id)}));
  return {servicos:sv,termos:tt};
 }
 function analyze(texto,context={},dataset=state.data){
  if(!dataset)return null;
  if(!window.AP52Classificador66g3b?.analisarDemanda)return {erro:'MOTOR_INDISPONIVEL',candidatos:[],pendencias:[],trechos_observacao:[]};
  return window.AP52Classificador66g3b.analisarDemanda({assunto:String(texto??''),observacao:String(context.observacao??''),historica:!!context.historica,tipo:context.tipo||'demanda',gerencia:context.gerencia||null,modalidade:context.modalidade||null},inputForEngine(dataset));
 }
 function suggest(texto,context={},dataset=state.data){
  const result=analyze(texto,context,dataset);if(!result||result.erro)return null;
  return result.candidatos.filter(x=>x.tipo==='servico_catalogo').map(x=>({codigo:x.codigo_servico,nome:x.nome_servico,area:x.area,termo:x.termo_catalogo,conferencia:!!x.necessita_conferencia,servico_id:x.servico_id}));
 }
 function section(texto,context){
  const box=make('section',NS+'-box');box.setAttribute('aria-label','Classificacao assistida para conferencia');
  box.append(make('h3','', 'Classificação assistida · confira antes de incluir'));
  const status=make('div',NS+'-body');box.append(status);
  const addCheckAction=(li,c)=>{
   if(context.tipo==='bds'||!context.demandaId)return;
   if(c.tipo!=='problema'&&c.tipo!=='servico_a_identificar')return;
   if(c.tipo==='problema'&&c.identificador!=='afundamento')return;
   // Apenas os itens ativos deste pedido, carregados com as permissões do próprio usuário.
   const itens=window.AP52Demandas66g2?.itensParaConferencia?.(context.demandaId);
   if(c.tipo==='problema'&&itens?.afundamentoAtivo){
    li.append(make('span','ap52-g2-already','já registrado'));return;
   }
   if(c.tipo==='servico_a_identificar'&&c.area==='Drenagem'&&itens?.areasAtivas){
    const drenagemId=[...state.data.areas.values()].find(a=>a.codigo==='drenagem')?.id;
    if(drenagemId&&itens.areasAtivas.includes(drenagemId))li.append(make('p',NS+'-muted','Já há item de Drenagem neste pedido; confira antes de incluir outro.'));
   }
   const call=window.AP52Demandas66g2?.conferirSugestao;
   if(!call)return;
   const edit=typeof pode28==='function'&&pode28('demandas','editar')&&
     (typeof dem52Global==='function'&&dem52Global()||context.gerencia===acesso28?.user?.gerencia);
   if(!edit)return;
   const b=make('button','btn btn-ghost '+NS+'-check','Conferir');b.type='button';
   b.addEventListener('click',()=>{void window.AP52Demandas66g2?.conferirSugestao?.({demandaId:context.demandaId,tipo:c.tipo,identificador:c.identificador,area:c.area,trecho:c.evidencia_literal});});
   li.append(b);
  };
  const render=()=>{
   status.replaceChildren();
   if(!clearOnIdentityChange()){status.append(make('p',NS+'-muted','Catálogo indisponível nesta sessão.'));return;}
   if(!state.data){
    if(state.error){status.append(make('p',NS+'-warn','Não foi possível consultar o catálogo oficial. Nenhuma sugestão foi produzida.'));
     const retry=make('button','btn btn-ghost '+NS+'-retry','Tentar novamente');retry.type='button';retry.addEventListener('click',()=>{status.replaceChildren(make('p',NS+'-muted','Consultando catálogo…'));void load(true).then(()=>{if(box.isConnected)render();});});status.append(retry);
    }else status.append(make('p',NS+'-muted','Consultando catálogo…'));
    return;
   }
   const r=analyze(texto,context);
   if(!r||r.erro){status.append(make('p',NS+'-warn','Motor de classificação indisponível. Nenhuma sugestão será incluída.'));return;}
   const cs=r.candidatos||[],sv=cs.filter(c=>c.tipo==='servico_catalogo'),others=cs.filter(c=>c.tipo!=='servico_catalogo');
   if(sv.length){
    status.append(make('p',NS+'-intro',sv.length===1?'1 serviço do catálogo reconhecido no assunto:':sv.length+' serviços do catálogo reconhecidos no assunto:'));
    const list=make('ul',NS+'-list');
    for(const c of sv){
     const li=make('li','');li.dataset.catalogoServicoId=c.servico_id||'';li.append(make('strong','',c.nome_servico));li.append(make('span',NS+'-area',' · '+c.area));
     li.append(make('small','',`Trecho identificado: ${c.evidencia_literal}${c.necessita_conferencia?' · exige conferência':''}`));list.append(li);
    }status.append(list);
   }
   if(others.length){
    status.append(make('h4',NS+'-subheading','Problemas e informações para conferência'));
    const list=make('ul',NS+'-review-list');
    for(const c of others){const li=make('li','');
     const label=c.tipo==='problema'?'Problema relatado':c.tipo==='servico_a_identificar'?'Serviço a identificar':c.tipo==='fora_catalogo'?'Sem serviço correspondente no catálogo':'Competência ou contexto a conferir';
     li.append(make('strong','',label+(c.area?' · '+c.area:'')));
     li.append(make('small','',`Trecho: ${c.evidencia_literal}`));li.append(make('p','',c.motivo));
     if(Array.isArray(c.opcoes_servico)&&c.opcoes_servico.length)li.append(make('p',NS+'-muted','Opções a conferir: '+c.opcoes_servico.map(cod=>state.data.servicos&&[...state.data.servicos.values()].find(s=>s.codigo===cod)?.nome||cod).join(' ou ')+'. Nenhuma opção está selecionada.'));
     addCheckAction(li,c);list.append(li);
    }status.append(list);
   }
   if(!cs.length)status.append(make('p',NS+'-none','Nenhum serviço identificável com segurança no assunto. Conferência humana necessária.'));
   if(r.exclusoes?.length){const block=make('div',NS+'-exclusions');block.append(make('strong','', 'Menções que não foram tratadas como pedido'));
    for(const e of r.exclusoes)block.append(make('p','',e.trecho+' — '+e.motivo));status.append(block);}
   if(r.trechos_observacao?.length){const notes=make('div',NS+'-notes');notes.append(make('strong','', 'Observações para leitura — não são pedidos'));
    if(cs.some(c=>c.identificador==='afundamento')&&r.trechos_observacao.some(x=>/esgoto|[áa]gua pot[áa]vel|concession[áa]ria/i.test(x.trecho)))
     notes.append(make('p',NS+'-warn','Observação cita concessionária — conferir competência.')); 
    for(const e of r.trechos_observacao)notes.append(make('p','',e.trecho));status.append(notes);}
   status.append(make('p',NS+'-disclaimer','Sugestões transitórias: nenhum serviço é incluído, confirmado ou marcado como executado automaticamente. Confirme pelo formulário de Serviços do pedido. O texto original é preservado.'));
  };panelRenderers.set(box,render);return {box,render};
 }
 function attach(holder,texto,context,anchor){
  if(!holder||!texto||holder.querySelector('.'+NS+'-box'))return;
  const built=section(texto,context);if(anchor&&anchor.parentNode===holder)anchor.after(built.box);else holder.append(built.box);built.render();
  if(clearOnIdentityChange()&&!state.data&&!state.error){
   void load().then(()=>{if(built.box.isConnected)built.render();});
  }else if(state.loading){void state.loading.then(()=>{if(built.box.isConnected)built.render();});}
 }
 function atualizarPainel(demandaId){
  if(typeof dem52==='undefined'||dem52.selecionada!==demandaId||typeof dem52El!=='function')return;
  const box=dem52El('contexto')?.querySelector('.'+NS+'-box');
  if(box)panelRenderers.get(box)?.();
 }
 function renderDemand(){
  if(typeof dem52==='undefined'||typeof dem52El!=='function'||!clearOnIdentityChange())return;
  const d=dem52.itens.find(x=>x.id===dem52.selecionada)||(dem52.confirmado?.id===dem52.selecionada?dem52.confirmado:null);
  const container=dem52El('contexto');
  if(!d||!container?.querySelector('.dem52-detail-title'))return;
  // Fora da secao 6.6G, que e recriada quando as pendencias terminam de carregar.
  attach(container,d.assunto,{tipo:'demanda',historica:!!d.origem_migracao,gerencia:d.gerencia,observacao:d.observacao,demandaId:d.id},container.querySelector(':scope > .dem52-meta'));
 }
 function renderHistory(chave){
  if(typeof dem52h==='undefined'||typeof dem52hEl!=='function'||!clearOnIdentityChange())return;
  const l=dem52h.linhas.find(x=>x.chave===chave);if(!l||!['d','s'].includes(l.tipo))return;
  const body=dem52hEl('detalhe')?.querySelector('.dem52h-detalhe-corpo');if(!body)return;
  const r=l.row,isBds=l.tipo==='s';
  attach(body,isBds?(r.servico_apresentacao||r.servico_original):r.assunto,
   {tipo:isBds?'bds':'demanda',historica:!isBds&&!!r.origem_migracao,gerencia:r.gerencia,modalidade:r.modalidade,observacao:!isBds?r.observacao:null});
 }
 function install(){
  if(typeof dem52RenderContexto!=='function'||typeof dem52hDetalhe!=='function')return false;
  if(window.__ap52Catalogo66g1Installed)return true;
  const oldContext=dem52RenderContexto,oldHistorico=dem52hDetalhe;
  dem52RenderContexto=function(){const result=oldContext.apply(this,arguments);renderDemand();return result;};
  dem52hDetalhe=function(){const result=oldHistorico.apply(this,arguments);renderHistory(arguments[0]);return result;};
  window.AP52Catalogo66g1={norm,suggest,analyze,validate,load,atualizarPainel,clear:()=>{state.identity=null;clearOnIdentityChange();},status:()=>({loaded:!!state.data,error:state.error})};
  window.__ap52Catalogo66g1Installed=true;return true;
 }
 if(!install())document.addEventListener('DOMContentLoaded',()=>{if(!install())console.warn('[AP5.2/6.6G.1] Módulos de Demandas não disponíveis.');},{once:true});
})();
