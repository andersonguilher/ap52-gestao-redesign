/* AP5.2 v65.42.153 — Central de Demandas, Etapa 5: Caso Operacional.
   Usa as funções já instaladas no Supabase (ap52_casos_*, ap52_demanda_casos), sob RLS e permissões da conta.
   Nenhuma demanda é unida automaticamente: vincular ou criar caso exige ação explícita do usuário. */
'use strict';
const DEM52C_DEMANDA_ABERTA=['recebida','em_triagem','vinculada_a_caso','aguardando_resposta'];
const DEM52C_ANDAMENTO={observacao:'Observação',vistoria:'Vistoria',programacao:'Programação',execucao:'Execução',encaminhamento:'Encaminhamento',correcao:'Correção'};
const DEM52C_EVENTO={cadastro:'Caso cadastrado',alteracao:'Caso atualizado',...DEM52C_ANDAMENTO};
const DEM52C_BUSCA={codigo:'Código do caso',logradouro:'Logradouro',titulo:'Título'};
const DEM52C_DEFINITIVOS=['42501','22023','40001','23503','23514','23505','22007','22008','22P02','P0001','PGRST202','PGRST203'];
const DEM52C_PROXIMO={novo:'Defina quando será feita a vistoria e mude a situação para “A vistoriar”.',a_vistoriar:'Faça a vistoria no local e registre o resultado como andamento.',vistoriado:'Com a vistoria feita, decida se o serviço será programado.',a_programar:'Programe a execução e informe a data de programação.',programado:'Na data programada, mude a situação para “Em execução”.',em_execucao:'Ao terminar, mude para “Concluído” e informe a data de conclusão.',aguardando_terceiro:'Acompanhe o órgão ou a empresa responsável e registre os retornos.',concluido:'Caso concluído. A resposta de cada protocolo vinculado continua sendo acompanhada individualmente.',sem_possibilidade_de_atendimento:'Registre no histórico o motivo. Cada protocolo vinculado continua com resposta própria.',cancelado:'Caso cancelado. Os protocolos vinculados continuam com resposta própria.'};
const DEM52C_DATA_STATUS={vistoriado:'data_vistoria',programado:'data_programacao',em_execucao:'data_inicio_execucao',concluido:'data_conclusao'};
let dem52c={aba:'demandas',modo:null,lista:{itens:[],total:0,pagina:0,filtros:null,consulta:0,ocupado:false,carregada:false},
 caso:{id:null,dados:null,demandas:[],totalDemandas:0,pgDemandas:0,historico:[],totalHistorico:0,pgHistorico:0,consulta:0,estado:null},
 dc:null,dcConsulta:0,demanda:null,form:null,sugestoes:null,busca:null,servicos:null,aviso:null};

function dem52cEl(k){return document.getElementById('dem52c-'+k);}
function dem52cPodeEditar(){return dem52Pode()&&pode28('demandas','editar');}
function dem52cPodeCriar(){return dem52cPodeEditar()&&pode28('demandas','cadastrar');}
function dem52cStatus(s){return (typeof DEM52_CASO_STATUS!=='undefined'&&DEM52_CASO_STATUS[s])||'Situação não informada';}
function dem52cTag(s){return `<span class="dem52-tag dem52c-tag" data-caso-status="${dem52Texto(s)}">${dem52Texto(dem52cStatus(s))}</span>`;}
function dem52cDataHora(v){if(!v)return 'Não informado';const d=new Date(v);if(isNaN(d))return 'Não informado';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d).replace(',',' às');}
function dem52cDia(v){if(!v)return 'Não informado';const d=new Date(v);if(isNaN(d))return 'Não informado';return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
function dem52cAgora(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
function dem52cResponsavel(uid){if(!uid)return 'Sem responsável definido';return uid===acesso28?.user?.user_id?'Você':'Outra pessoa da equipe';}
function dem52cServicoNome(id){if(!id)return 'Não definido';return dem52c.servicos?.find(s=>s.id===id)?.nome||'Tipo de serviço registrado';}
function dem52cGeracao(){const g=ac28Generation,u=acesso28?.user?.user_id;return ()=>g===ac28Generation&&acesso28?.user?.user_id===u&&dem52Pode();}
function dem52cErro(e){
 const c=e?.code;
 if(c==='42501')return 'Seu acesso não permite esta ação nesta Gerência. Atualize a página e confira sua conta.';
 if(c==='40001')return 'Este caso foi alterado por outra pessoa enquanto você preenchia. Use “Recarregar caso” e faça a alteração novamente.';
 if(c==='22023'&&e?.message&&e.message.length<220&&!/jsonb|uuid|syntax|column/i.test(e.message))return e.message;
 if(c==='P0001'||c==='23503')return 'Uma opção escolhida não está mais disponível (por exemplo, o tipo de serviço). Recarregue e confira os dados.';
 if(['22P02','22007','22008','23514'].includes(c))return 'Confira as datas e os campos preenchidos.';
 return 'Não foi possível concluir. Verifique a conexão e tente novamente.';
}
async function dem52cRpc(nome,params,ms=20000){
 const controle=new AbortController(),t=setTimeout(()=>controle.abort(),ms);
 try{const {data,error}=await sb.rpc(nome,params).abortSignal(controle.signal);if(error)throw error;return data;}finally{clearTimeout(t);}
}
async function dem52cCarregarServicos(){
 if(dem52c.servicos)return dem52c.servicos;
 const valido=dem52cGeracao(),controle=new AbortController(),t=setTimeout(()=>controle.abort(),15000);
 try{
  const {data,error}=await sb.from('demanda_tipos_servico').select('id,nome').is('deleted_at',null).eq('ativo',true).order('ordem').order('nome').abortSignal(controle.signal);
  if(error||!Array.isArray(data))throw error||Error('Catálogo indisponível.');
  if(!valido())throw Error('Sessão alterada.');
  dem52c.servicos=data;return data;
 }finally{clearTimeout(t);}
}

/* ---------- Montagem ---------- */
function dem52cMontar(){
 const view=document.getElementById('view-demandas'),principal=view.querySelector('.dem52-principal');
 const abas=document.createElement('div');abas.className='dem52c-abas';abas.setAttribute('role','tablist');abas.setAttribute('aria-label','Áreas da Central de Demandas');
 abas.innerHTML=`<button type="button" role="tab" id="dem52c-aba-demandas" aria-selected="true">Demandas <small>protocolos recebidos</small></button><button type="button" role="tab" id="dem52c-aba-casos" aria-selected="false">Casos operacionais <small>serviço no local</small></button>`;
 view.querySelector('.dem52-layout').before(abas);
 const aviso=document.createElement('div');aviso.id='dem52c-aviso';aviso.className='dem52c-aviso';aviso.setAttribute('role','status');aviso.hidden=true;principal.prepend(aviso);
 const area=document.createElement('div');area.id='dem52c-area';area.className='dem52c-area';area.hidden=true;
 area.innerHTML=`<div id="dem52c-lista-wrap" class="dem52c-lista-wrap">
 <form id="dem52c-filtros" class="dem52-panel dem52-filters" role="search" aria-label="Filtrar casos operacionais">
 <div class="dem52-search"><label>Buscar em<select id="dem52c-campo">${Object.entries(DEM52C_BUSCA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="dem52-search-text">Termo de busca<input type="search" id="dem52c-termo" maxlength="150" placeholder="Ex.: CO-2026-000123" autocomplete="off"></label></div>
 <div class="dem52-filter-row dem52c-filter-row"><label>Gerência<select id="dem52c-gerencia"></select></label><label>Situação<select id="dem52c-status"><option value="abertos">Em aberto</option>${Object.entries(DEM52_CASO_STATUS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}<option value="todos">Todas as situações</option></select></label></div>
 <div class="dem52-filter-actions"><button type="button" class="btn btn-ghost" data-c-acao="limpar">Limpar filtros</button><button type="submit" class="btn btn-primary">Buscar casos</button></div></form>
 <section class="dem52-panel" aria-labelledby="dem52c-lista-titulo"><header class="dem52-list-head"><div><h2 id="dem52c-lista-titulo">Casos operacionais</h2><p id="dem52c-contagem" aria-live="polite"></p></div><button type="button" class="btn btn-ghost" data-c-acao="atualizar-lista" id="dem52c-atualizar">Atualizar</button></header>
 <div id="dem52c-lista" aria-live="polite"></div>
 <nav id="dem52c-paginacao" class="dem52-pagination" aria-label="Páginas de casos" hidden><button type="button" class="btn btn-ghost" data-c-acao="pagina-anterior" id="dem52c-anterior">← Anterior</button><span id="dem52c-pagina"></span><button type="button" class="btn btn-ghost" data-c-acao="pagina-proxima" id="dem52c-proxima">Próxima →</button></nav></section></div>
 <div id="dem52c-trabalho" class="dem52c-trabalho" hidden></div>`;
 dem52El('filtros').before(area);
 dem52cEl('aba-demandas').addEventListener('click',()=>dem52cMudarAba('demandas'));
 dem52cEl('aba-casos').addEventListener('click',()=>dem52cMudarAba('casos'));
 abas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const itens=[...abas.querySelectorAll('[role=tab]')].filter(b=>!b.disabled),i=itens.indexOf(e.target),alvo=itens[(i+(e.key==='ArrowRight'?1:-1)+itens.length)%itens.length];alvo?.focus();alvo?.click();});
 dem52cEl('filtros').addEventListener('submit',e=>{e.preventDefault();dem52cCarregarLista(true);});
 area.addEventListener('click',dem52cClique);aviso.addEventListener('click',dem52cClique);
 dem52El('contexto').addEventListener('click',dem52cClique);
 area.addEventListener('submit',e=>{const f=e.target.closest('form[data-c-form]');if(!f)return;e.preventDefault();dem52cSubmeter(f.dataset.cForm);});
 area.addEventListener('input',e=>{if(e.target.closest('form[data-c-form]')&&dem52c.form){dem52c.form.sujo=true;e.target.setCustomValidity?.('');const m=dem52cEl('form-erro');if(m&&!dem52c.form.incerto&&!m.querySelector('[data-c-acao="recarregar-caso"]'))m.hidden=true;}});
 area.addEventListener('change',e=>{if(e.target.id==='dem52c-f-status')dem52cSugerirData(e.target.value);});
}
function dem52cPrepararFiltros(){
 const el=dem52cEl('gerencia'),atual=el.value;
 el.innerHTML=dem52Global()?'<option value="">Toda a AP5.2</option>'+DEM52_UNIDADES.map(g=>`<option value="${g}">${g}</option>`).join(''):`<option value="${dem52Texto(acesso28?.user?.gerencia||'')}">${dem52Texto(dem52Escopo())}</option>`;
 el.disabled=!dem52Global();if(dem52Global()&&DEM52_UNIDADES.includes(atual))el.value=atual;
}

/* ---------- Visibilidade e abas ---------- */
function dem52cSincronizar(){
 const view=document.getElementById('view-demandas');if(!view||!dem52cEl('area'))return;
 const cad=!!dem52Cadastro?.aberto;
 if(cad&&(dem52c.aba!=='demandas'||dem52c.modo)){dem52cFecharForm();dem52c.aba='demandas';dem52c.modo=null;}
 if(cad&&!dem52cEl('aviso').hidden){dem52cEl('aviso').hidden=true;dem52c.aviso=null;}
 const casos=dem52c.aba==='casos',trabDemanda=!casos&&['criar','vincular'].includes(dem52c.modo);
 view.dataset.dem52cAba=dem52c.aba;if(dem52c.modo)view.dataset.dem52cModo=dem52c.modo;else delete view.dataset.dem52cModo;
 dem52cEl('aba-demandas').setAttribute('aria-selected',String(dem52c.aba==='demandas'));dem52cEl('aba-casos').setAttribute('aria-selected',String(casos));
 dem52cEl('aba-demandas').tabIndex=dem52c.aba==='demandas'?0:-1;dem52cEl('aba-casos').tabIndex=casos?0:-1;
 dem52cEl('aba-casos').disabled=cad;dem52cEl('aba-casos').title=cad?'Conclua ou cancele o cadastro da demanda para abrir os casos.':'';
 dem52cEl('area').hidden=cad||!(casos||trabDemanda);
 dem52cEl('lista-wrap').hidden=!(casos&&(dem52c.modo==='lista'||!dem52c.modo));
 dem52cEl('trabalho').hidden=dem52cEl('lista-wrap').hidden===false||dem52cEl('area').hidden;
 if(typeof dem52hSincronizar==='function')dem52hSincronizar();
}
async function dem52cPodeDescartar(){
 const f=dem52c.form;if(!f)return true;
 if(f.ocupado)return false;
 if(f.incerto){ap52Notify('Confirme primeiro a operação pendente com “Tentar novamente”.',{variant:'warning'});return false;}
 if(!f.sujo)return true;
 const g=ac28Generation;const ok=await ap52Confirm('As informações preenchidas ainda não foram salvas. Deseja descartar?',{title:'Descartar alterações?',confirmText:'Descartar',variant:'warning'});
 return ok&&g===ac28Generation;
}
function dem52cFecharForm(){dem52c.form?.controle?.abort();dem52c.form=null;dem52c.sugestoes=null;dem52c.busca=null;}
async function dem52cMudarAba(aba){
 if(aba==='historico'&&typeof dem52hAbrir==='function')return dem52hAbrir();
 if(aba===dem52c.aba&&(aba==='demandas'?!dem52c.modo:['lista','detalhe'].includes(dem52c.modo)))return;
 if(dem52Cadastro?.aberto&&aba==='casos')return;
 if(!await dem52cPodeDescartar())return;
 if(aba!=='demandas')window.AP52Demandas66g2?.clearAll?.();
 dem52cFecharForm();dem52c.aba=aba;
 if(aba==='casos'){dem52c.modo=dem52c.caso.id&&dem52c.caso.dados?'detalhe':'lista';if(!dem52c.lista.carregada)dem52cCarregarLista(true);else dem52cRenderLista();if(dem52c.modo==='detalhe')dem52cCarregarCaso(dem52c.caso.id,true);}
 else dem52c.modo=null;
 dem52RenderContexto();dem52cSincronizar();
 document.getElementById('view-demandas').scrollIntoView?.({block:'start'});
}

/* ---------- Avisos ---------- */
function dem52cAvisar(texto,casoId=null,variante='ok'){
 const el=dem52cEl('aviso');dem52c.aviso={texto,casoId};el.dataset.variante=variante;el.hidden=false;
 el.innerHTML=`<p>${dem52Texto(texto)}</p><div>${casoId?`<button type="button" class="btn btn-ghost" data-c-abrir="${dem52Texto(casoId)}">Abrir caso</button>`:''}<button type="button" class="btn btn-ghost dem52c-fechar-aviso" data-c-acao="fechar-aviso" aria-label="Fechar aviso">✕</button></div>`;
 el.scrollIntoView?.({block:'nearest'});
}

/* ---------- Cliques ---------- */
async function dem52cClique(e){
 const abrir=e.target.closest('[data-c-abrir]');if(abrir){e.preventDefault();dem52cAbrirCaso(abrir.dataset.cAbrir);return;}
 const vinc=e.target.closest('[data-c-vincular]');if(vinc){e.preventDefault();dem52cVincular(vinc.dataset.cVincular,vinc.dataset.cCodigo);return;}
 const linha=e.target.closest('[data-c-caso]');if(linha){dem52cAbrirCaso(linha.dataset.cCaso);return;}
 const b=e.target.closest('[data-c-acao]');if(!b)return;
 const acao=b.dataset.cAcao;
 if(acao==='limpar'){dem52cEl('filtros').reset();dem52cPrepararFiltros();dem52cCarregarLista(true);}
 else if(acao==='atualizar-lista')dem52cCarregarLista(false);
 else if(acao==='pagina-anterior'){if(dem52c.lista.pagina>0&&!dem52c.lista.ocupado){dem52c.lista.pagina--;dem52cCarregarLista(false);}}
 else if(acao==='pagina-proxima'){if(!dem52c.lista.ocupado&&(dem52c.lista.pagina+1)*25<dem52c.lista.total){dem52c.lista.pagina++;dem52cCarregarLista(false);}}
 else if(acao==='fechar-aviso'){dem52cEl('aviso').hidden=true;dem52c.aviso=null;}
 else if(acao==='voltar-lista'){if(!await dem52cPodeDescartar())return;dem52cFecharForm();dem52c.modo='lista';dem52c.caso.id=null;dem52c.caso.dados=null;dem52cRenderLista();dem52RenderContexto();dem52cSincronizar();dem52cEl('lista-titulo').scrollIntoView?.({block:'start'});}
 else if(acao==='recarregar-caso'){if(!await dem52cPodeDescartar())return;dem52cFecharForm();dem52c.modo='detalhe';dem52cCarregarCaso(dem52c.caso.id);}
 else if(acao==='editar')dem52cAbrirForm('editar');
 else if(acao==='andamento')dem52cAbrirForm('andamento');
 else if(acao==='cancelar-form'){if(!await dem52cPodeDescartar())return;dem52cCancelarForm();}
 else if(acao==='mais-demandas')dem52cCarregarMais('demandas');
 else if(acao==='mais-historico')dem52cCarregarMais('historico');
 else if(acao==='dc-recarregar'){dem52c.dc=null;dem52RenderContexto();}
 else if(acao==='criar'||acao==='vincular')dem52cIniciarTrabalhoDemanda(acao);
 else if(acao==='ir-vincular'){if(!await dem52cPodeDescartar())return;dem52cFecharForm();dem52cIniciarTrabalhoDemanda('vincular',true);}
 else if(acao==='ir-criar'){if(dem52c.form?.ocupado||dem52c.form?.incerto)return;dem52cFecharForm();dem52cIniciarTrabalhoDemanda('criar',true);}
 else if(acao==='buscar-caso')dem52cBuscarCasos();
 else if(acao==='tentar-novamente')dem52cSubmeter(dem52c.form?.tipo);
}

/* ---------- Lista de casos ---------- */
async function dem52cCarregarLista(aplicar){
 if(!dem52Pode())return;
 const L=dem52c.lista;dem52cPrepararFiltros();
 if(aplicar||!L.filtros){L.pagina=0;L.filtros={gerencia:dem52Global()?dem52cEl('gerencia').value:(acesso28?.user?.gerencia||''),status:dem52cEl('status').value||'abertos',campo:dem52cEl('campo').value,termo:dem52cEl('termo').value.trim()};}
 const consulta=++L.consulta,valido=dem52cGeracao();L.ocupado=true;
 dem52cEl('contagem').textContent='Carregando…';dem52cEl('lista').innerHTML='<div class="dem52-empty">Consultando casos…</div>';dem52cEl('paginacao').hidden=true;dem52cEl('atualizar').disabled=true;
 try{
  const f=L.filtros,p={status:f.status,campo:f.campo,termo:f.termo,pagina:L.pagina};if(f.gerencia)p.gerencia=f.gerencia;
  const [data]=await Promise.all([dem52cRpc('ap52_casos_listar',{p_filtros:p}),dem52cCarregarServicos().catch(()=>null)]);
  if(consulta!==L.consulta||!valido())return;
  if(!data||data.versao!==1||!Array.isArray(data.itens)||!Number.isSafeInteger(data.total)||data.itens.some(c=>typeof c.id!=='string'||(f.gerencia&&c.gerencia!==f.gerencia)))throw Error('Resposta incompleta.');
  L.itens=data.itens;L.total=data.total;L.carregada=true;
  if(L.pagina>0&&!L.itens.length&&L.total>0){L.pagina=Math.max(0,Math.ceil(L.total/25)-1);return await dem52cCarregarLista(false);}
  dem52cRenderLista();
 }catch(e){if(consulta!==L.consulta||!valido())return;L.itens=[];L.total=0;dem52cEl('contagem').textContent='Consulta indisponível';dem52cEl('lista').innerHTML=`<div class="dem52-empty dem52-error"><strong>Não foi possível carregar os casos.</strong><p>${dem52Texto(e?.code==='42501'?dem52cErro(e):'Verifique a conexão e use Atualizar para tentar novamente.')}</p></div>`;}
 finally{if(consulta===L.consulta&&valido()){L.ocupado=false;dem52cEl('atualizar').disabled=false;dem52cEl('anterior').disabled=L.pagina===0;dem52cEl('proxima').disabled=(L.pagina+1)*25>=L.total;}}
}
function dem52cEndereco(c){return [c.logradouro,c.numero?'nº '+c.numero:'',c.trecho_referencia].filter(Boolean).join(' · ');}
function dem52cRenderLista(){
 const L=dem52c.lista,n=L.total,ini=L.pagina*25;
 dem52cEl('contagem').textContent=n?`${ini+1}–${ini+L.itens.length} de ${n} ${n===1?'caso':'casos'}`:'Nenhum caso nesta consulta';
 if(!L.itens.length){const f=L.filtros||{};const filtrado=!!(f.termo||(f.status&&f.status!=='abertos')||(dem52Global()&&f.gerencia));dem52cEl('lista').innerHTML=`<div class="dem52-empty"><span class="dem52-empty-icon" aria-hidden="true">◎</span><strong>${filtrado?'Nenhum caso encontrado':'Nenhum caso em aberto'}</strong><p>${filtrado?'Ajuste os filtros para consultar outros casos.':'Os casos são criados a partir de uma demanda: abra uma demanda e use “Criar novo caso” ou “Vincular a caso existente”.'}</p></div>`;}
 else dem52cEl('lista').innerHTML=L.itens.map(c=>`<button type="button" class="dem52-row dem52c-row" data-c-caso="${dem52Texto(c.id)}" aria-pressed="${c.id===dem52c.caso.id}"><span class="dem52-row-top"><span class="dem52-origin">${dem52Texto(c.codigo)}</span>${dem52cTag(c.status)}</span><strong>${dem52Texto(c.titulo)}</strong><span class="dem52-address">${dem52Texto(dem52cEndereco(c))}</span><span class="dem52-row-bottom"><span>${dem52Texto(c.gerencia)} · ${dem52Texto(c.servico?.nome||'Serviço não definido')}</span><span>${Number(c.total_demandas)||0} ${Number(c.total_demandas)===1?'demanda':'demandas'} · atualizado em ${dem52cDia(c.updated_at)}</span></span></button>`).join('');
 dem52cEl('paginacao').hidden=n<=25;dem52cEl('pagina').textContent=`Página ${L.pagina+1} de ${Math.max(1,Math.ceil(n/25))}`;
}

/* ---------- Detalhe do caso ---------- */
async function dem52cAbrirCaso(id){
 if(!id||!dem52Pode()||dem52Cadastro?.aberto)return;
 if(dem52c.form&&!await dem52cPodeDescartar())return;
 dem52cFecharForm();dem52c.aba='casos';dem52c.modo='detalhe';
 if(dem52c.aviso?.casoId===id){dem52cEl('aviso').hidden=true;dem52c.aviso=null;}
 if(!dem52c.lista.carregada)dem52cCarregarLista(true);
 dem52RenderContexto();dem52cSincronizar();
 await dem52cCarregarCaso(id);
}
async function dem52cCarregarCaso(id,manterPaginas=false){
 const C=dem52c.caso,consulta=++C.consulta,valido=dem52cGeracao();
 if(C.id!==id){C.dados=null;C.demandas=[];C.historico=[];}
 C.id=id;C.estado='carregando';if(!manterPaginas){C.pgDemandas=0;C.pgHistorico=0;}
 dem52cRenderDetalhe();
 try{
  const [data]=await Promise.all([dem52cRpc('ap52_casos_detalhar',{p_dados:{caso_id:id,pagina_demandas:0,pagina_historico:0}}),dem52cCarregarServicos().catch(()=>null)]);
  if(consulta!==C.consulta||!valido())return;
  dem52cValidarDetalhe(data,id);
  C.dados=data.caso;C.demandas=data.demandas.itens;C.totalDemandas=data.demandas.total;C.historico=data.historico.itens;C.totalHistorico=data.historico.total;C.pgDemandas=0;C.pgHistorico=0;C.estado='ok';
  const i=dem52c.lista.itens.findIndex(x=>x.id===id);if(i>=0){dem52c.lista.itens[i]=data.caso;dem52cRenderLista();}
 }catch(e){if(consulta!==C.consulta||!valido())return;C.estado=e?.code==='42501'?'negado':'erro';if(C.estado==='negado')C.dados=null;}
 dem52cRenderDetalhe();dem52RenderContexto();
 if(C.estado==='ok'&&dem52c.modo==='detalhe'){const h=dem52cEl('det-h');h?.focus({preventScroll:true});if(matchMedia('(max-width:1100px)').matches)h?.scrollIntoView?.({block:'start'});}
}
function dem52cValidarDetalhe(data,id){
 if(!data||data.versao!==1||data.caso?.id!==id||!data.demandas||!data.historico||!Array.isArray(data.demandas.itens)||!Array.isArray(data.historico.itens)||!Number.isSafeInteger(data.demandas.total)||!Number.isSafeInteger(data.historico.total))throw Error('Resposta incompleta.');
}
async function dem52cCarregarMais(tipo){
 const C=dem52c.caso;if(C.estado!=='ok'||C.carregandoMais)return;
 const valido=dem52cGeracao(),id=C.id,pg=(tipo==='demandas'?C.pgDemandas:C.pgHistorico)+1;C.carregandoMais=true;dem52cRenderDetalhe();
 try{
  const data=await dem52cRpc('ap52_casos_detalhar',{p_dados:{caso_id:id,pagina_demandas:tipo==='demandas'?pg:0,pagina_historico:tipo==='historico'?pg:0}});
  if(!valido()||C.id!==id)return;dem52cValidarDetalhe(data,id);
  const ids=new Set((tipo==='demandas'?C.demandas:C.historico).map(x=>x.id));
  if(tipo==='demandas'){C.demandas=C.demandas.concat(data.demandas.itens.filter(x=>!ids.has(x.id)));C.totalDemandas=data.demandas.total;C.pgDemandas=pg;}
  else{C.historico=C.historico.concat(data.historico.itens.filter(x=>!ids.has(x.id)));C.totalHistorico=data.historico.total;C.pgHistorico=pg;}
 }catch{if(valido())ap52Notify('Não foi possível carregar mais registros. Tente novamente.',{variant:'warning'});}
 finally{C.carregandoMais=false;if(valido()&&C.id===id)dem52cRenderDetalhe();}
}
function dem52cLinha(nome,valor){return `<div><dt>${nome}</dt><dd>${dem52Texto(valor||'Não informado')}</dd></div>`;}
function dem52cCabecalhoCaso(c,voltar=true){
 return `<header class="dem52c-det-head">${voltar?'<button type="button" class="btn btn-ghost dem52c-voltar" data-c-acao="voltar-lista">← Voltar aos casos</button>':''}<div class="dem52c-det-id"><div class="dem52-eyebrow">Caso operacional · ${dem52Texto(c.gerencia)}</div><h2 id="dem52c-det-h" tabindex="-1">${dem52Texto(c.codigo)}</h2><p>${dem52Texto(c.titulo)}</p></div>${dem52cTag(c.status)}</header>`;
}
function dem52cRenderDetalhe(){
 const box=dem52cEl('trabalho');if(!box||dem52c.aba!=='casos'||!['detalhe','editar','andamento'].includes(dem52c.modo))return;
 const C=dem52c.caso,c=C.dados;
 if(!c){box.innerHTML=`<section class="dem52-panel dem52c-detalhe"><header class="dem52c-det-head"><button type="button" class="btn btn-ghost dem52c-voltar" data-c-acao="voltar-lista">← Voltar aos casos</button></header>${C.estado==='carregando'?'<div class="dem52-empty">Carregando caso…</div>':`<div class="dem52-empty dem52-error"><strong>${C.estado==='negado'?'Caso indisponível para sua conta.':'Não foi possível carregar o caso.'}</strong><p>${C.estado==='negado'?'Ele pode ter sido arquivado ou pertencer a outra Gerência.':'Verifique a conexão e tente novamente.'}</p>${C.estado==='negado'?'':'<button type="button" class="btn btn-ghost" data-c-acao="recarregar-caso">Tentar novamente</button>'}</div>`}</section>`;return;}
 if(dem52c.modo!=='detalhe')return; // formulário aberto: não substituir.
 const pode=dem52cPodeEditar(),pronto=C.estado==='ok';
 const demandas=C.demandas.map(d=>`<li class="dem52c-dem"><div class="dem52c-dem-top"><strong>${dem52Texto(d.origem?.nome||'Origem')} · ${dem52Texto(d.protocolo||'Sem protocolo')}</strong><span class="dem52-tag" data-status="${dem52Texto(d.status)}">${dem52Texto(DEM52_STATUS[d.status]||'Situação')}</span></div><p>${dem52Texto(d.assunto)}</p><p class="dem52c-dem-meta">${dem52Texto(dem52Endereco(d))} · recebida em ${dem52Data(d.data_recebimento)} · vinculada em ${dem52cDia(d.vinculada_em)}</p><details><summary>Mais dados</summary><dl class="dem52-meta">${dem52cLinha('Solicitante',d.solicitante)}${dem52cLinha('Prazo para resposta',d.prazo?dem52Data(d.prazo):null)}${dem52cLinha('Observação do vínculo',d.observacao_vinculo)}</dl></details></li>`).join('');
 const hist=C.historico.map(dem52cItemHistorico).join('');
 box.innerHTML=`<section class="dem52-panel dem52c-detalhe" aria-busy="${C.estado==='carregando'}">${dem52cCabecalhoCaso(c)}
 ${C.estado==='erro'?'<div class="dem52-cad-message dem52-cad-error dem52c-desatualizado" role="alert">Não foi possível atualizar os dados deste caso. As informações abaixo podem estar desatualizadas. <button type="button" class="btn btn-ghost" data-c-acao="recarregar-caso">Recarregar caso</button></div>':''}
 ${pode?`<div class="dem52c-det-acoes"><button type="button" class="btn btn-primary" data-c-acao="editar"${pronto?'':' disabled'}>Atualizar caso</button><button type="button" class="btn btn-ghost" data-c-acao="andamento"${pronto?'':' disabled'}>Registrar andamento</button></div>`:'<p class="dem52c-somente-leitura">Seu perfil pode consultar este caso, sem alterar.</p>'}
 <div class="dem52c-det-corpo">
 <section class="dem52c-bloco"><h3>Local e serviço</h3><dl class="dem52-meta dem52c-meta-grid">${dem52cLinha('Endereço',dem52cEndereco(c))}${dem52cLinha('Bairro / sub-bairro',[c.bairro,c.sub_bairro].filter(Boolean).join(' / '))}${dem52cLinha('Tipo de serviço',c.servico?.nome)}${dem52cLinha('Coordenadas',c.latitude!=null?`${c.latitude}, ${c.longitude}`:null)}</dl></section>
 <section class="dem52c-bloco"><h3>Andamento do serviço</h3><dl class="dem52-meta dem52c-meta-grid">${dem52cLinha('Responsável',dem52cResponsavel(c.responsavel_user_id))}${dem52cLinha('Vistoria',c.data_vistoria?dem52Data(c.data_vistoria):null)}${dem52cLinha('Programação',c.data_programacao?dem52Data(c.data_programacao):null)}${dem52cLinha('Início da execução',c.data_inicio_execucao?dem52Data(c.data_inicio_execucao):null)}${dem52cLinha('Conclusão',c.data_conclusao?dem52Data(c.data_conclusao):null)}</dl>
 ${c.diagnostico?`<div class="dem52c-texto"><h4>Diagnóstico</h4><p class="dem52-observacao">${dem52Texto(c.diagnostico)}</p></div>`:''}${c.proxima_acao?`<div class="dem52c-texto"><h4>Próxima ação</h4><p class="dem52-observacao">${dem52Texto(c.proxima_acao)}</p></div>`:''}</section>
 <section class="dem52c-bloco"><h3>Demandas vinculadas <span class="dem52c-cont">${C.totalDemandas}</span></h3><p class="dem52c-nota">Cada protocolo continua com resposta própria. Para incluir outro protocolo, abra a demanda e use “Vincular a caso existente”.</p>${C.demandas.length?`<ul class="dem52c-dems">${demandas}</ul>`:'<p class="dem52c-nota">Nenhuma demanda ativa vinculada.</p>'}${C.demandas.length<C.totalDemandas?`<button type="button" class="btn btn-ghost dem52c-mais" data-c-acao="mais-demandas" ${C.carregandoMais?'disabled':''}>Ver mais demandas (${C.totalDemandas-C.demandas.length})</button>`:''}</section>
 <section class="dem52c-bloco"><h3>Histórico <span class="dem52c-cont">${C.totalHistorico}</span></h3><ol class="dem52c-hist">${hist}</ol>${C.historico.length<C.totalHistorico?`<button type="button" class="btn btn-ghost dem52c-mais" data-c-acao="mais-historico" ${C.carregandoMais?'disabled':''}>Ver registros anteriores (${C.totalHistorico-C.historico.length})</button>`:''}</section>
 </div></section>`;
 if(pronto&&typeof dem52eMontarCaso==='function')dem52eMontarCaso(c);
}
function dem52cMudancas(a,n){
 if(!a||!n)return [];
 const out=[],txt=v=>{const s=String(v??'').trim();return s?(s.length>90?s.slice(0,90)+'…':s):'vazio';};
 const campos=[['status','Situação',v=>dem52cStatus(v)],['titulo','Título',txt],['logradouro','Logradouro',txt],['numero','Número',txt],['trecho_referencia','Trecho',txt],['bairro','Bairro',txt],['sub_bairro','Sub-bairro',txt],['tipo_servico_id','Tipo de serviço',v=>dem52cServicoNome(v)],['responsavel_user_id','Responsável',v=>dem52cResponsavel(v)],['data_vistoria','Vistoria',v=>v?dem52Data(v):'sem data'],['data_programacao','Programação',v=>v?dem52Data(v):'sem data'],['data_inicio_execucao','Início da execução',v=>v?dem52Data(v):'sem data'],['data_conclusao','Conclusão',v=>v?dem52Data(v):'sem data'],['diagnostico','Diagnóstico',txt],['proxima_acao','Próxima ação',txt]];
 for(const [k,nome,fmt]of campos)if(JSON.stringify(a[k]??null)!==JSON.stringify(n[k]??null))out.push(`${nome}: ${fmt(a[k])} → ${fmt(n[k])}`);
 if(String(a.latitude??'')!==String(n.latitude??'')||String(a.longitude??'')!==String(n.longitude??''))out.push('Coordenadas atualizadas');
 return out;
}
function dem52cItemHistorico(h){
 const mud=h.tipo==='alteracao'?dem52cMudancas(h.dados_anteriores,h.dados_novos):[];
 const autor=h.created_by&&h.created_by===acesso28?.user?.user_id?' · por você':'';
 const desc=h.tipo==='alteracao'?(mud.length?'':'Dados revisados sem mudança de conteúdo.'):h.tipo==='cadastro'?'Caso aberto a partir de uma demanda.':h.descricao;
 return `<li class="dem52c-hist-item" data-tipo="${dem52Texto(h.tipo)}"><div class="dem52c-hist-top"><strong>${dem52Texto(DEM52C_EVENTO[h.tipo]||'Registro')}</strong><span>${dem52Texto(dem52cDataHora(h.ocorrido_em))}${autor}</span></div>${desc?`<p class="dem52-observacao">${dem52Texto(desc)}</p>`:''}${mud.length?`<ul class="dem52c-mud">${mud.map(m=>`<li>${dem52Texto(m)}</li>`).join('')}</ul>`:''}</li>`;
}

/* ---------- Formulários do caso ---------- */
function dem52cOpcoesServico(atual){
 const lista=dem52c.servicos||[];let html='<option value="">Não definido</option>'+lista.map(s=>`<option value="${dem52Texto(s.id)}"${s.id===atual?' selected':''}>${dem52Texto(s.nome)}</option>`).join('');
 if(atual&&!lista.some(s=>s.id===atual))html+=`<option value="${dem52Texto(atual)}" selected>Tipo de serviço atual (fora do catálogo ativo)</option>`;
 return html;
}
function dem52cCamposLocal(v){
 return `<fieldset><legend><span>1</span> Identificação e local</legend><div class="dem52-cad-grid">
 <label class="dem52-cad-full">Título do caso *<input id="dem52c-f-titulo" required maxlength="300" value="${dem52Texto(v.titulo||'')}" placeholder="Ex.: Tapa-buraco na Rua das Rosas"><small>Um nome curto para reconhecer o problema no local.</small></label>
 <label class="dem52-cad-full">Logradouro *<input id="dem52c-f-logradouro" required maxlength="300" value="${dem52Texto(v.logradouro||'')}" autocomplete="off"></label>
 <label>Número<input id="dem52c-f-numero" maxlength="300" value="${dem52Texto(v.numero||'')}"></label><label>Bairro<input id="dem52c-f-bairro" maxlength="300" value="${dem52Texto(v.bairro||'')}"></label>
 <label class="dem52-cad-full">Trecho ou ponto de referência<input id="dem52c-f-trecho" maxlength="300" value="${dem52Texto(v.trecho_referencia||'')}"></label>
 <label>Sub-bairro / localidade<input id="dem52c-f-sub-bairro" maxlength="300" value="${dem52Texto(v.sub_bairro||'')}"></label>
 <label>Tipo de serviço<select id="dem52c-f-servico">${dem52cOpcoesServico(v.tipo_servico_id)}</select></label>
 </div><details class="dem52-cad-coordenadas"${v.latitude!=null?' open':''}><summary>Coordenadas (opcional)</summary><p>Preencha os dois valores ou deixe ambos em branco.</p><div class="dem52-cad-grid"><label>Latitude<input id="dem52c-f-latitude" inputmode="decimal" maxlength="20" value="${v.latitude!=null?dem52Texto(String(v.latitude).replace('.',',')):''}" placeholder="Ex.: -22,90"></label><label>Longitude<input id="dem52c-f-longitude" inputmode="decimal" maxlength="20" value="${v.longitude!=null?dem52Texto(String(v.longitude).replace('.',',')):''}" placeholder="Ex.: -43,56"></label></div></details></fieldset>`;
}
function dem52cCamposTexto(v){
 return `<label class="dem52-cad-full">Diagnóstico<textarea id="dem52c-f-diagnostico" maxlength="4000" rows="3" placeholder="O que foi constatado no local">${dem52Texto(v.diagnostico||'')}</textarea></label>
 <label class="dem52-cad-full">Próxima ação<textarea id="dem52c-f-proxima" maxlength="4000" rows="2" placeholder="Ex.: programar equipe de tapa-buraco">${dem52Texto(v.proxima_acao||'')}</textarea></label>`;
}
function dem52cRodape(textoSalvar){
 return `<p id="dem52c-form-erro" class="dem52-cad-message dem52-cad-error" role="alert" hidden></p><footer class="dem52-cad-footer"><button type="button" class="btn btn-ghost" data-c-acao="cancelar-form" id="dem52c-form-cancelar">Cancelar</button><button type="submit" class="btn btn-primary" id="dem52c-form-salvar" data-texto="${dem52Texto(textoSalvar)}">${dem52Texto(textoSalvar)}</button></footer>`;
}
async function dem52cAbrirForm(tipo){
 const C=dem52c.caso;if(!C.dados||C.estado!=='ok'||!dem52cPodeEditar()||dem52c.form)return;
 const f={tipo,op:null,envio:null,incerto:false,ocupado:false,sujo:false,controle:null,base:C.dados};dem52c.form=f;dem52c.modo=tipo;
 dem52cEl('aviso').hidden=true;dem52c.aviso=null;
 try{await dem52cCarregarServicos();}catch{}
 if(dem52c.form!==f)return;
 const c=f.base,box=dem52cEl('trabalho');
 if(tipo==='editar'){
  const datas=[['data_vistoria','Data da vistoria'],['data_programacao','Data da programação'],['data_inicio_execucao','Início da execução'],['data_conclusao','Data de conclusão']];
  box.innerHTML=`<section class="dem52-panel dem52c-detalhe">${dem52cCabecalhoCaso(c,false)}<form class="dem52-cadastro dem52c-form" data-c-form="editar" novalidate>
  <fieldset><legend><span>1</span> Situação do serviço</legend><div class="dem52-cad-grid">
  <label>Situação *<select id="dem52c-f-status" required>${Object.entries(DEM52_CASO_STATUS).map(([k,v])=>`<option value="${k}"${k===c.status?' selected':''}>${v}</option>`).join('')}</select></label>
  <label>Responsável<select id="dem52c-f-responsavel"><option value="manter">Manter: ${dem52Texto(dem52cResponsavel(c.responsavel_user_id))}</option>${c.responsavel_user_id!==acesso28?.user?.user_id?'<option value="minha_conta">Eu serei o responsável</option>':''}${c.responsavel_user_id?'<option value="sem_responsavel">Deixar sem responsável</option>':''}</select></label>
  ${datas.map(([k,n])=>`<label>${n}${k==='data_conclusao'?' (obrigatória ao concluir)':''}<input type="date" id="dem52c-f-${k}" value="${dem52Texto(c[k]||'')}"></label>`).join('')}
  </div><p id="dem52c-f-dica-data" class="dem52c-dica" hidden></p></fieldset>
  ${dem52cCamposLocal(c)}
  <fieldset><legend><span>3</span> Diagnóstico e próxima ação</legend><div class="dem52-cad-grid">${dem52cCamposTexto(c)}</div></fieldset>
  <p class="dem52-cad-note">A alteração fica registrada no histórico do caso, com data e autoria. Os protocolos vinculados não são respondidos automaticamente.</p>
  ${dem52cRodape('Salvar alterações')}</form></section>`;
 }else{
  box.innerHTML=`<section class="dem52-panel dem52c-detalhe">${dem52cCabecalhoCaso(c,false)}<form class="dem52-cadastro dem52c-form" data-c-form="andamento" novalidate>
  <fieldset><legend><span>1</span> Registrar andamento</legend><div class="dem52-cad-grid">
  <label>Tipo *<select id="dem52c-f-tipo" required>${Object.entries(DEM52C_ANDAMENTO).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
  <label>Data e hora<input type="datetime-local" id="dem52c-f-ocorrido" value="${dem52cAgora()}" data-padrao="${dem52cAgora()}" max="${dem52cAgora()}"><small>Quando aconteceu. Já vem com o horário atual.</small></label>
  <label class="dem52-cad-full">Descrição *<textarea id="dem52c-f-descricao" required maxlength="4000" rows="5" placeholder="Ex.: Vistoria realizada; buraco de aproximadamente 1 m² em frente ao nº 120."></textarea></label>
  </div></fieldset><p class="dem52-cad-note">O histórico não pode ser apagado nem editado. Para corrigir algo, registre um novo andamento do tipo “Correção”.</p>
  ${dem52cRodape('Registrar andamento')}</form></section>`;
 }
 dem52RenderContexto();dem52cSincronizar();
 box.querySelector('input,select,textarea')?.focus({preventScroll:true});box.scrollIntoView?.({block:'start'});
}
function dem52cSugerirData(status){
 const campo=DEM52C_DATA_STATUS[status],dica=dem52cEl('f-dica-data');if(!dica)return;dica.hidden=true;
 if(!campo)return;const el=dem52cEl('f-'+campo);if(el&&!el.value){el.value=dem52Hoje();dica.hidden=false;dica.textContent='Preenchemos a data com hoje. Ajuste se o serviço aconteceu em outro dia.';}
}
function dem52cCancelarForm(){
 const tipo=dem52c.form?.tipo;dem52cFecharForm();
 if(['criar','vincular'].includes(tipo)){dem52c.modo=null;dem52RenderContexto();dem52cSincronizar();dem52El('contexto-titulo')?.focus({preventScroll:true});return;}
 dem52c.modo='detalhe';dem52RenderContexto();dem52cSincronizar();dem52cCarregarCaso(dem52c.caso.id,true);
}
function dem52cCampoErro(k,msg){const el=dem52cEl('f-'+k);if(el){el.setCustomValidity(msg);el.reportValidity?.();el.focus();}throw Object.assign(Error(msg),{campo:true});}
function dem52cLerLocal(){
 const v=k=>(dem52cEl('f-'+k)?.value||'').trim();
 if(!v('titulo'))dem52cCampoErro('titulo','Informe o título do caso.');
 if(!v('logradouro'))dem52cCampoErro('logradouro','Informe o logradouro.');
 let latitude=null,longitude=null;
 if(v('latitude')||v('longitude')){
  for(const [k,lim]of [['latitude',90],['longitude',180]]){const x=v(k).replace(',','.');if(!/^[+-]?\d+(\.\d+)?$/.test(x)||Math.abs(Number(x))>lim){dem52cEl('f-latitude')?.closest('details')?.setAttribute('open','');dem52cCampoErro(k,'Informe latitude e longitude válidas, ou deixe as duas em branco.');}}
  latitude=Number(v('latitude').replace(',','.'));longitude=Number(v('longitude').replace(',','.'));
 }
 const servico=v('servico');
 return {titulo:v('titulo'),logradouro:v('logradouro'),numero:v('numero')||null,trecho_referencia:v('trecho')||null,bairro:v('bairro')||null,sub_bairro:v('sub-bairro')||null,tipo_servico_id:servico||null,latitude,longitude,diagnostico:v('diagnostico')||null,proxima_acao:v('proxima')||null};
}
function dem52cLerForm(tipo){
 document.querySelectorAll('#dem52c-trabalho [id^="dem52c-f-"]').forEach(el=>el.setCustomValidity?.(''));
 const v=k=>(dem52cEl('f-'+k)?.value||'').trim(),f=dem52c.form;
 if(tipo==='andamento'){
  const descricao=v('descricao');if(!descricao)dem52cCampoErro('descricao','Descreva o andamento.');
  const oc=v('ocorrido');if(oc&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(oc))dem52cCampoErro('ocorrido','Informe data e hora completas, ou deixe em branco para usar agora.');
  if(oc&&oc>dem52cAgora())dem52cCampoErro('ocorrido','A data e hora não podem estar no futuro.');
  // Sem mudança no horário sugerido, o banco registra o instante exato do salvamento.
  const padrao=dem52cEl('f-ocorrido')?.dataset.padrao;
  return {acao:'andamento',caso_id:f.base.id,tipo:v('tipo'),descricao,ocorrido_em:oc&&oc!==padrao?oc:null};
 }
 if(tipo==='editar'){
  const local=dem52cLerLocal(),status=v('status');
  const datas=Object.fromEntries(['data_vistoria','data_programacao','data_inicio_execucao','data_conclusao'].map(k=>[k,v(k)||null]));
  for(const [k,d]of Object.entries(datas))if(d&&!/^\d{4}-\d{2}-\d{2}$/.test(d))dem52cCampoErro(k,'Informe uma data válida.');
  if(datas.data_conclusao&&datas.data_conclusao>dem52Hoje())dem52cCampoErro('data_conclusao','A data de conclusão não pode estar no futuro.');
  if(status==='concluido'&&!datas.data_conclusao)dem52cCampoErro('data_conclusao','Informe a data de conclusão para concluir o caso.');
  if(datas.data_conclusao&&datas.data_inicio_execucao&&datas.data_conclusao<datas.data_inicio_execucao)dem52cCampoErro('data_conclusao','A conclusão não pode ser anterior ao início da execução.');
  return {acao:'atualizar',caso_id:f.base.id,updated_at:f.base.updated_at,...local,status,responsavel:v('responsavel')||'manter',...datas};
 }
 if(tipo==='criar'){
  const d=dem52c.demanda;const local=dem52cLerLocal();
  const resp=document.querySelector('#dem52c-trabalho input[name="dem52c-responsavel"]:checked')?.value||'sem_responsavel';
  return {acao:'criar',demanda_id:d.id,...local,responsavel:resp,observacao:null};
 }
 throw Error('Formulário desconhecido.');
}
function dem52cEstadoForm(){
 const f=dem52c.form,box=dem52cEl('trabalho');if(!f||!box)return;
 const salvar=dem52cEl('form-salvar'),cancelar=dem52cEl('form-cancelar');
 box.querySelectorAll('form[data-c-form] input,form[data-c-form] select,form[data-c-form] textarea').forEach(el=>el.disabled=f.ocupado||f.incerto);
 box.querySelectorAll('[data-c-vincular],[data-c-acao="buscar-caso"],#dem52c-busca-termo,#dem52c-busca-campo,#dem52c-obs').forEach(el=>el.disabled=f.ocupado||f.incerto);
 if(salvar){salvar.disabled=f.ocupado;salvar.textContent=f.ocupado?(f.incerto?'Verificando…':'Salvando…'):(f.incerto?'Tentar novamente':salvar.dataset.texto);}
 if(cancelar){cancelar.disabled=f.ocupado||f.incerto;}
 const irCriar=dem52cEl('ir-criar');if(irCriar)irCriar.disabled=f.ocupado||f.incerto;
 const tentar=dem52cEl('tentar');if(tentar){tentar.hidden=!f.incerto;tentar.disabled=f.ocupado;}
}
function dem52cMensagemForm(msg){const el=dem52cEl('form-erro');if(!el){ap52Notify(msg,{variant:'warning'});return;}el.textContent=msg;el.hidden=false;el.scrollIntoView?.({block:'nearest'});}
async function dem52cSubmeter(tipo){
 const f=dem52c.form;if(!f||f.tipo!==tipo||f.ocupado)return;
 if(!f.envio&&!(tipo==='criar'||tipo==='vincular'?dem52cPodeCriar():dem52cPodeEditar())){dem52cMensagemForm('Seu perfil não permite esta ação.');return;}
 let dados=null;
 if(!f.envio){if(tipo==='vincular')return;try{dados=dem52cLerForm(tipo);}catch(e){if(!e.campo)dem52cMensagemForm(e.message);return;}}
 const r=await dem52cEnviar(dados);if(!r)return;
 await dem52cSucesso(tipo,r,f);
}
async function dem52cEnviar(dados){
 const f=dem52c.form;if(!f||f.ocupado)return null;
 if(!f.envio){f.op=crypto.randomUUID();f.envio=Object.freeze({...dados});}
 const valido=dem52cGeracao(),ativo=()=>valido()&&dem52c.form===f;
 f.ocupado=true;const erro=dem52cEl('form-erro');if(erro&&!f.incerto)erro.hidden=true;dem52cEstadoForm();
 const controle=new AbortController();f.controle=controle;const t=setTimeout(()=>controle.abort(),25000);
 try{
  let data=null,error=null;
  // Nova tentativa: confere primeiro se a operação já foi gravada (exige só visualizar).
  if(f.incerto){const r=await sb.rpc('ap52_casos_confirmar',{p_operacao:f.op}).abortSignal(controle.signal);if(!ativo())return null;if(r.error)throw Object.assign(r.error,{code:r.error.code==='42501'?'CONFIRMACAO':r.error.code});data=r.data;}
  if(!data){const r=await sb.rpc('ap52_casos_salvar',{p_operacao:f.op,p_dados:f.envio}).abortSignal(controle.signal);data=r.data;error=r.error;}
  if(!ativo())return null;if(error)throw error;
  if(!data||data.versao!==1||data.operacao_id!==f.op||data.acao!==f.envio.acao||typeof data.caso_id!=='string'||typeof data.codigo!=='string')throw Object.assign(Error('Resposta incompleta.'),{code:'RESPOSTA'});
  f.incerto=false;f.envio=null;f.op=null;f.sujo=false;return data;
 }catch(e){
  if(!ativo())return null;
  if(DEM52C_DEFINITIVOS.includes(e?.code)){f.envio=null;f.op=null;f.incerto=false;dem52cMensagemForm(dem52cErro(e));if(e.code==='40001')dem52cMostrarRecarregar();}
  else{f.incerto=true;dem52cMensagemForm('Não foi possível confirmar se a operação foi salva. Use “Tentar novamente”: o sistema confere e não registra em duplicidade.');}
  return null;
 }finally{clearTimeout(t);if(ativo()){f.ocupado=false;f.controle=null;dem52cEstadoForm();}}
}
function dem52cMostrarRecarregar(){const el=dem52cEl('form-erro');if(el&&!el.querySelector('button')){const b=document.createElement('button');b.type='button';b.className='btn btn-ghost';b.dataset.cAcao='recarregar-caso';b.textContent='Recarregar caso';el.append(' ',b);}}
async function dem52cSucesso(tipo,r,f){
 dem52c.dc=null;
 if(tipo==='editar'||tipo==='andamento'){
  dem52cFecharForm();dem52c.modo='detalhe';
  dem52cAvisar(tipo==='editar'?`Caso ${r.codigo} atualizado.`:`Andamento registrado no caso ${r.codigo}.`);
  dem52c.lista.carregada&&dem52cCarregarLista(false);
  await dem52cCarregarCaso(r.caso_id);return;
 }
 // criar ou vincular: volta à demanda, com o aviso e o atalho para o caso.
 const d=dem52c.demanda;dem52cFecharForm();dem52c.modo=null;dem52c.dc=null;dem52c.lista.carregada=false;
 dem52cAvisar(tipo==='criar'?`Caso ${r.codigo} criado e vinculado à demanda ${d?.protocolo||d?.assunto||''}.`:`Demanda ${d?.protocolo||d?.assunto||''} vinculada ao caso ${r.codigo}.`,r.caso_id);
 await dem52cAtualizarDemanda(d?.id);
}
async function dem52cAtualizarDemanda(id){
 if(!id)return;const valido=dem52cGeracao();
 const antiga=dem52.itens.find(x=>x.id===id)||(dem52.confirmado?.id===id?dem52.confirmado:null);
 await carregarDemandasAP52(false,false);if(!valido())return;
 const nova=dem52.itens.find(x=>x.id===id);
 if(!nova&&antiga)dem52.confirmado={...antiga,status:antiga.status==='recebida'||antiga.status==='em_triagem'?'vinculada_a_caso':antiga.status};
 dem52.selecionada=id;dem52Render();dem52cSincronizar();
}

/* ---------- Seção “Caso operacional” na demanda ---------- */
function dem52RenderCasosDaDemanda(d){
 const ctx=dem52El('contexto');if(!ctx||!d)return;
 const box=document.createElement('section');box.id='dem52c-demanda-casos';box.className='dem52-help dem52c-demanda-casos';box.setAttribute('aria-live','polite');ctx.append(box);
 if(!dem52c.dc||dem52c.dc.id!==d.id||dem52c.dc.lista!==d)dem52cCarregarDemandaCasos(d);else dem52cRenderDemandaCasos();
}
async function dem52cCarregarDemandaCasos(d){
 const consulta=++dem52c.dcConsulta,valido=dem52cGeracao();dem52c.dc={id:d.id,estado:'carregando',dados:null,lista:d};dem52cRenderDemandaCasos();
 try{
  const data=await dem52cRpc('ap52_demanda_casos',{p_demanda_id:d.id});
  if(consulta!==dem52c.dcConsulta||!valido())return;
  if(!data||data.versao!==1||data.demanda?.id!==d.id||!Array.isArray(data.casos)||!Number.isSafeInteger(data.total))throw Error('Resposta incompleta.');
  dem52c.dc={id:d.id,estado:'ok',dados:data,lista:d};
  const item=dem52.itens.find(x=>x.id===d.id);
  if(item&&item.status!==data.demanda.status){item.status=data.demanda.status;dem52Render();return;}
  if(dem52.confirmado?.id===d.id&&dem52.confirmado.status!==data.demanda.status){dem52.confirmado={...dem52.confirmado,status:data.demanda.status};if(dem52.confirmado&&!item)dem52c.dc.lista=dem52.confirmado;dem52Render();return;}
 }catch(e){if(consulta!==dem52c.dcConsulta||!valido())return;dem52c.dc={id:d.id,estado:e?.code==='42501'?'negado':'erro',dados:null,lista:d};}
 dem52cRenderDemandaCasos();
}
function dem52cRenderDemandaCasos(){
 const box=dem52cEl('demanda-casos'),dc=dem52c.dc;if(!box||!dc||dem52.selecionada!==dc.id)return;
 if(['criar','vincular'].includes(dem52c.modo))dem52El('fechar').hidden=true;
 let html='<h3>Caso operacional</h3>';
 if(dc.estado==='carregando')html+='<p>Consultando casos vinculados…</p>';
 else if(dc.estado!=='ok')html+=`<p>${dc.estado==='negado'?'Sem acesso aos casos desta demanda.':'Não foi possível consultar os casos desta demanda.'}</p>${dc.estado==='negado'?'':'<button type="button" class="btn btn-ghost" data-c-acao="dc-recarregar">Tentar novamente</button>'}`;
 else{
  const dados=dc.dados,dem=dados.demanda,aberta=DEM52C_DEMANDA_ABERTA.includes(dem.status),trabalhando=['criar','vincular'].includes(dem52c.modo);
  html+=dados.total?`<ul class="dem52c-mini-lista">${dados.casos.map(c=>`<li><button type="button" class="dem52c-mini" data-c-abrir="${dem52Texto(c.id)}"><span><b>${dem52Texto(c.codigo)}</b>${dem52cTag(c.status)}</span><span>${dem52Texto(c.titulo)}</span><small>Abrir caso →</small></button></li>`).join('')}</ul>${dados.total>dados.casos.length?`<p class="dem52c-nota">Mostrando ${dados.casos.length} de ${dados.total} casos.</p>`:''}`:'<p>Esta demanda ainda não está vinculada a um caso operacional.</p>';
  if(trabalhando)html+='<p class="dem52c-nota">Conclua ou cancele o formulário aberto para continuar.</p>';
  else if(!aberta)html+=`<p class="dem52c-nota">Demanda com situação “${dem52Texto(DEM52_STATUS[dem.status]||dem.status)}”: não recebe novos vínculos.</p>`;
  else if(dem52cPodeCriar())html+=`<div class="dem52c-demanda-acoes"><button type="button" class="btn ${dados.total?'btn-ghost':'btn-primary'}" data-c-acao="vincular">${dados.total?'Vincular a outro caso':'Vincular a caso existente'}</button><button type="button" class="btn btn-ghost" data-c-acao="criar">Criar novo caso</button></div><p class="dem52c-nota">Vários protocolos podem compartilhar o mesmo caso. Cada um continua com resposta própria.</p>`;
 }
 box.innerHTML=html;
}

/* ---------- Criar caso / vincular a partir da demanda ---------- */
async function dem52cIniciarTrabalhoDemanda(tipo,trocando=false){
 const dc=dem52c.dc;if(dc?.estado!=='ok'||!dem52cPodeCriar()||(!trocando&&dem52c.form))return;
 const dem=dc.dados.demanda;if(!DEM52C_DEMANDA_ABERTA.includes(dem.status))return;
 dem52c.demanda={...dem,origem:dc.lista?.origem||null,servico:dc.lista?.servico||null};
 dem52c.form={tipo,op:null,envio:null,incerto:false,ocupado:false,sujo:false,controle:null,base:null};dem52c.modo=tipo;dem52c.sugestoes={estado:'carregando'};dem52c.busca=null;
 dem52cEl('aviso').hidden=true;dem52c.aviso=null;
 const valido=dem52cGeracao(),form=dem52c.form,box=dem52cEl('trabalho');
 dem52cSincronizar();box.innerHTML='<section class="dem52-panel"><div class="dem52-empty">Preparando…</div></section>';dem52RenderContexto();
 try{await dem52cCarregarServicos();}catch{}
 if(dem52c.form!==form||!valido())return;
 dem52cRenderTrabalhoDemanda();box.scrollIntoView?.({block:'start'});dem52cEl('trab-h')?.focus({preventScroll:true});
 try{
  const p={gerencia:dem.gerencia,origem_id:dem.origem_id,protocolo:dem.protocolo,logradouro:dem.logradouro,numero:dem.numero,trecho_referencia:dem.trecho_referencia,tipo_servico_id:dem.tipo_servico_id,data_recebimento:dem.data_recebimento,latitude:dem.latitude,longitude:dem.longitude};
  const data=await dem52cRpc('ap52_demandas_buscar_semelhantes',{p_dados:p});
  if(!valido()||dem52c.form!==form)return;
  const r=dem52ValidarDuplicidade(data,dem.gerencia);dem52c.sugestoes={estado:'ok',casos:r.casos};
 }catch{if(!valido()||dem52c.form!==form)return;dem52c.sugestoes={estado:'erro'};}
 dem52cRenderSugestoes();
}
function dem52cResumoDemanda(d){
 return `<div class="dem52c-demanda-resumo"><div class="dem52-eyebrow">Demanda · ${dem52Texto(d.gerencia)}</div><strong>${dem52Texto(d.origem?.nome?d.origem.nome+' · ':'')}${dem52Texto(d.protocolo||'Sem protocolo')}</strong><p>${dem52Texto(d.assunto)}</p><p class="dem52c-dem-meta">${dem52Texto(dem52Endereco(d))} · recebida em ${dem52Data(d.data_recebimento)}</p></div>`;
}
function dem52cRenderTrabalhoDemanda(){
 const box=dem52cEl('trabalho'),d=dem52c.demanda,f=dem52c.form;if(!box||!d||!f)return;
 if(f.tipo==='vincular'){
  box.innerHTML=`<section class="dem52-panel dem52c-detalhe"><header class="dem52c-det-head"><div class="dem52c-det-id"><div class="dem52-eyebrow">Vincular a caso existente</div><h2 id="dem52c-trab-h" tabindex="-1">Escolha o caso desta demanda</h2><p>O caso reúne o serviço no local. A demanda continua com protocolo e resposta próprios.</p></div></header>
  <div class="dem52c-det-corpo">${dem52cResumoDemanda(d)}
  <section class="dem52c-bloco"><h3>Casos abertos parecidos</h3><div id="dem52c-sugestoes"></div></section>
  <section class="dem52c-bloco"><h3>Procurar outro caso</h3><div class="dem52c-busca"><label>Buscar em<select id="dem52c-busca-campo">${Object.entries(DEM52C_BUSCA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Termo<input type="search" id="dem52c-busca-termo" maxlength="150" placeholder="Código, rua ou título" autocomplete="off"></label><button type="button" class="btn btn-ghost" data-c-acao="buscar-caso">Buscar</button></div><p class="dem52c-nota">Mostra casos em aberto da ${dem52Texto(d.gerencia)}.</p><div id="dem52c-busca-res"></div></section>
  <section class="dem52c-bloco"><label class="dem52c-obs">Observação do vínculo (opcional)<textarea id="dem52c-obs" maxlength="4000" rows="2" placeholder="Ex.: mesmo buraco informado pelo 1746"></textarea></label></section>
  <p id="dem52c-form-erro" class="dem52-cad-message dem52-cad-error" role="alert" hidden></p>
  <footer class="dem52-cad-footer"><button type="button" class="btn btn-ghost" data-c-acao="cancelar-form" id="dem52c-form-cancelar">Cancelar</button><button type="button" class="btn btn-ghost" data-c-acao="ir-criar" id="dem52c-ir-criar">Nenhum serve: criar novo caso</button><button type="button" class="btn btn-primary" data-c-acao="tentar-novamente" id="dem52c-tentar" hidden>Tentar novamente</button></footer></div></section>`;
  dem52cEl('busca-termo').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dem52cBuscarCasos();}});
  dem52cRenderSugestoes();dem52cRenderBusca();dem52cEstadoForm();return;
 }
 const sug=dem52c.sugestoes;
 box.innerHTML=`<section class="dem52-panel dem52c-detalhe"><header class="dem52c-det-head"><div class="dem52c-det-id"><div class="dem52-eyebrow">Criar caso operacional</div><h2 id="dem52c-trab-h" tabindex="-1">Novo caso a partir desta demanda</h2><p>Os dados do local vieram da demanda. Confira e ajuste se precisar.</p></div></header>
 <div class="dem52c-det-corpo">${dem52cResumoDemanda(d)}<div id="dem52c-sugestoes"></div></div>
 <form class="dem52-cadastro dem52c-form" data-c-form="criar" novalidate>
 ${dem52cCamposLocal({titulo:d.assunto,logradouro:d.logradouro,numero:d.numero,trecho_referencia:d.trecho_referencia,bairro:d.bairro,sub_bairro:d.sub_bairro,tipo_servico_id:d.tipo_servico_id,latitude:d.latitude,longitude:d.longitude})}
 <fieldset><legend><span>2</span> Acompanhamento</legend><div class="dem52-cad-grid">
 <div class="dem52-cad-full dem52c-radios" role="radiogroup" aria-label="Responsável pelo caso"><span>Quem vai acompanhar o caso?</span><label><input type="radio" name="dem52c-responsavel" value="minha_conta"> Eu vou acompanhar</label><label><input type="radio" name="dem52c-responsavel" value="sem_responsavel" checked> Definir depois</label></div>
 ${dem52cCamposTexto({})}</div></fieldset>
 <p class="dem52-cad-note">O caso começa como <b>Novo</b>. A demanda passa a <b>Vinculada a caso</b> e mantém o protocolo e a resposta próprios.</p>
 ${dem52cRodape('Criar caso e vincular')}</form></section>`;
 if(sug)dem52cRenderSugestoes();dem52cEstadoForm();
}
function dem52cCardCaso(c,motivos){
 const ja=dem52c.dc?.dados?.casos?.some(x=>x.id===c.id);
 const txtMot=[];if(motivos){if(motivos.includes('mesmo_protocolo'))txtMot.push('Mesmo protocolo e origem');if(motivos.includes('mesmo_logradouro'))txtMot.push(motivos.includes('mesmo_numero')?'Mesmo logradouro e número':motivos.includes('mesmo_trecho')?'Mesmo logradouro e trecho':'Mesmo logradouro');if(motivos.includes('local_proximo'))txtMot.push(`Local a cerca de ${c.distancia_m??80} m`);if(motivos.includes('mesmo_servico'))txtMot.push('Mesmo tipo de serviço');}
 const acao=ja?'<span class="dem52c-ja">Já vinculada a este caso</span>':`<button type="button" class="btn btn-primary" data-c-vincular="${dem52Texto(c.id)}" data-c-codigo="${dem52Texto(c.codigo)}">Vincular a este caso</button>`;
 const mais=dem52cLinha('Bairro / sub-bairro',[c.bairro,c.sub_bairro].filter(Boolean).join(' / '))+dem52cLinha('Vistoria',c.data_vistoria?dem52Data(c.data_vistoria):null)+dem52cLinha('Programação',c.data_programacao?dem52Data(c.data_programacao):null)+dem52cLinha('Diagnóstico',c.diagnostico)+dem52cLinha('Próxima ação',c.proxima_acao);
 return `<article class="dem52-dup-card dem52c-card"><div class="dem52-dup-card-top"><strong>${dem52Texto(c.codigo)}</strong>${dem52cTag(c.status)}</div><h4>${dem52Texto(c.titulo)}</h4><p>${dem52Texto(dem52cEndereco(c))}</p><p class="dem52-dup-resumo">${dem52Texto(c.gerencia)} · ${dem52Texto(c.servico?.nome||'Serviço não definido')}${c.total_demandas!=null?` · ${Number(c.total_demandas)} ${Number(c.total_demandas)===1?'demanda':'demandas'}`:''}</p>${txtMot.length?`<ul class="dem52-dup-motivos">${txtMot.map(m=>`<li>${dem52Texto(m)}</li>`).join('')}</ul>`:''}<details><summary>Mais dados do caso</summary><dl class="dem52-meta">${mais}</dl></details><div class="dem52c-card-acoes">${acao}</div></article>`;
}
function dem52cRenderSugestoes(){
 const el=dem52cEl('sugestoes'),s=dem52c.sugestoes,f=dem52c.form;if(!el||!s||!f)return;
 if(f.tipo==='criar'){
  if(s.estado==='ok'&&s.casos.total)el.innerHTML=`<div class="dem52c-alerta"><strong>Já existem ${s.casos.total} ${s.casos.total===1?'caso aberto parecido':'casos abertos parecidos'} nesta Gerência.</strong><p>Se for o mesmo problema no local, prefira vincular a demanda ao caso existente.</p><button type="button" class="btn btn-ghost" data-c-acao="ir-vincular">Ver casos parecidos</button></div>`;
  else el.innerHTML=s.estado==='carregando'?'<p class="dem52c-nota">Conferindo casos abertos parecidos…</p>':'';
  return;
 }
 if(s.estado==='carregando'){el.innerHTML='<p class="dem52c-nota">Conferindo casos abertos parecidos…</p>';return;}
 if(s.estado==='erro'){el.innerHTML='<p class="dem52c-nota">Não foi possível conferir os casos parecidos. Use a busca abaixo.</p>';return;}
 const g=s.casos;
 el.innerHTML=g.total?`${g.total>g.itens.length?`<p class="dem52-dup-limite">Mostrando ${g.itens.length} de ${g.total}. Use a busca abaixo para encontrar outro caso.</p>`:''}<div class="dem52-dup-cards">${g.itens.map(c=>dem52cCardCaso(c,c.motivos)).join('')}</div>`:'<p class="dem52c-nota">Nenhum caso aberto parecido foi encontrado pelo endereço, protocolo ou serviço. Procure pelo código ou crie um novo caso.</p>';
 dem52cEstadoForm();
}
async function dem52cBuscarCasos(){
 const f=dem52c.form,d=dem52c.demanda;if(!f||f.tipo!=='vincular'||f.ocupado||f.incerto)return;
 const termo=dem52cEl('busca-termo').value.trim(),campo=dem52cEl('busca-campo').value;
 if(!termo){dem52cEl('busca-termo').focus();dem52c.busca={estado:'vazio'};dem52cRenderBusca();return;}
 const valido=dem52cGeracao(),consulta=dem52c.buscaSeq=(dem52c.buscaSeq||0)+1;dem52c.busca={estado:'carregando',consulta};dem52cRenderBusca();
 try{
  const data=await dem52cRpc('ap52_casos_listar',{p_filtros:{gerencia:d.gerencia,status:'abertos',campo,termo,pagina:0}});
  if(!valido()||dem52c.form!==f||dem52c.busca?.consulta!==consulta)return;
  if(!data||data.versao!==1||!Array.isArray(data.itens)||data.itens.some(c=>c.gerencia!==d.gerencia))throw Error('Resposta incompleta.');
  dem52c.busca={estado:'ok',consulta,itens:data.itens,total:data.total};
 }catch{if(!valido()||dem52c.form!==f||dem52c.busca?.consulta!==consulta)return;dem52c.busca={estado:'erro',consulta};}
 dem52cRenderBusca();
}
function dem52cRenderBusca(){
 const el=dem52cEl('busca-res'),b=dem52c.busca;if(!el)return;
 if(!b){el.innerHTML='';return;}
 if(b.estado==='vazio'){el.innerHTML='<p class="dem52c-nota">Digite parte do código, do logradouro ou do título.</p>';return;}
 if(b.estado==='carregando'){el.innerHTML='<p class="dem52c-nota">Procurando…</p>';return;}
 if(b.estado==='erro'){el.innerHTML='<p class="dem52c-nota">Não foi possível buscar agora. Tente novamente.</p>';return;}
 el.innerHTML=b.itens.length?`${b.total>b.itens.length?`<p class="dem52-dup-limite">Mostrando ${b.itens.length} de ${b.total}. Digite mais detalhes para refinar.</p>`:''}<div class="dem52-dup-cards">${b.itens.map(c=>dem52cCardCaso(c,null)).join('')}</div>`:'<p class="dem52c-nota">Nenhum caso em aberto encontrado com esse termo.</p>';
 dem52cEstadoForm();
}
async function dem52cVincular(casoId,codigo){
 const f=dem52c.form,d=dem52c.demanda;if(!f||f.tipo!=='vincular'||f.ocupado||f.incerto||!d)return;
 if(!dem52cPodeCriar()){dem52cMensagemForm('Seu perfil não permite vincular demandas.');return;}
 const g=ac28Generation;
 if(!await ap52Confirm(`Vincular a demanda ${d.protocolo||d.assunto} ao caso ${codigo}? A demanda continua com protocolo e resposta próprios.`,{title:'Vincular demanda ao caso',confirmText:'Vincular',variant:'info'}))return;
 if(g!==ac28Generation||dem52c.form!==f)return;
 const r=await dem52cEnviar({acao:'vincular',demanda_id:d.id,caso_id:casoId,observacao:(dem52cEl('obs')?.value||'').trim()||null});
 if(r)await dem52cSucesso('vincular',r,f);
}

/* ---------- Painel lateral na aba Casos ---------- */
function dem52RenderContextoCasos(){
 dem52cSincronizar();
 if(dem52c.aba!=='casos')return false;
 dem52El('fechar').hidden=true;
 const c=dem52c.caso.dados&&['detalhe','editar','andamento'].includes(dem52c.modo)?dem52c.caso.dados:null;
 dem52El('contexto-titulo').textContent=c?'Próximo passo':'Casos operacionais';
 dem52El('contexto').innerHTML=(c?`<div class="dem52-context-intro"><div class="dem52-eyebrow">${dem52Texto(c.codigo)}</div><h3>${dem52Texto(dem52cStatus(c.status))}</h3><p>${dem52Texto(c.proxima_acao||DEM52C_PROXIMO[c.status]||'')}</p></div>`:`<div class="dem52-context-intro"><div class="dem52-eyebrow">${dem52Texto(dem52Escopo())}</div><h3>Um caso, um problema no local</h3><p>O Caso Operacional reúne vistoria, programação e execução de um serviço. Vários protocolos sobre o mesmo local podem ficar no mesmo caso.</p></div>`)
 +`<div class="dem52-help"><h3>Respostas continuam individuais</h3><p>Concluir o caso não responde os protocolos automaticamente. Cada SEI, 1746 ou ofício continua com sua própria resposta.</p></div><div class="dem52-help"><h3>Histórico permanente</h3><p>Cada alteração e andamento fica registrado com data e autoria. Para corrigir algo, registre um novo andamento.</p></div>`;
 return true;
}

/* ---------- Após cadastrar uma demanda ---------- */
function dem52CasosAposCadastro(registro,sucesso){
 if(!dem52cPodeCriar()||!sucesso)return;
 const b=document.createElement('button');b.type='button';b.className='btn btn-primary';b.textContent='Vincular ou criar caso';
 b.addEventListener('click',()=>{dem52SelecionarSalva(registro);const sec=dem52cEl('demanda-casos');sec?.scrollIntoView?.({block:'start'});dem52El('contexto-titulo')?.focus({preventScroll:true});});
 const div=document.createElement('div');div.className='dem52c-sucesso-acoes';const ver=sucesso.querySelector('#dem52-ver-salva');if(ver){ver.before(div);div.append(b,ver);}else sucesso.append(b);
 const p=sucesso.querySelector('p');if(p){const dica=document.createElement('p');dica.textContent='Próximo passo: vincule a um caso existente ou crie um novo caso operacional.';p.after(dica);}
}

/* ---------- Saída / troca de conta ---------- */
function limparCasosAP52(){
 if(typeof limparEvidenciasAP52==='function')limparEvidenciasAP52();
 dem52cFecharForm();dem52c.aba='demandas';dem52c.modo=null;dem52c.dc=null;dem52c.dcConsulta++;dem52c.demanda=null;dem52c.servicos=null;dem52c.aviso=null;
 dem52c.lista={itens:[],total:0,pagina:0,filtros:null,consulta:dem52c.lista.consulta+1,ocupado:false,carregada:false};
 dem52c.caso={id:null,dados:null,demandas:[],totalDemandas:0,pgDemandas:0,historico:[],totalHistorico:0,pgHistorico:0,consulta:dem52c.caso.consulta+1,estado:null};
 if(dem52cEl('area')){dem52cEl('filtros').reset();dem52cEl('lista').replaceChildren();dem52cEl('trabalho').replaceChildren();dem52cEl('contagem').textContent='';dem52cEl('gerencia').replaceChildren();dem52cEl('aviso').hidden=true;dem52cEl('aviso').replaceChildren();dem52cSincronizar();}
}
dem52cMontar();
