/* AP5.2 v65.42.156 — Etapa 6.5: Histórico do Logradouro.
   v65.42.156.4.8.1 — Acesso aos detalhes individuais e sugestões consultivas do catálogo em cada item da linha do tempo.
   v65.42.156.4.7 — Histórico por data em forma de LINHA DO TEMPO (marcador por dia, mês, intervalo e prévia dos serviços).
   v65.42.156.4.0 — 6.6D.12: a pesquisa também encontra serviços pela rua da ESQUINA (somente referências homologadas, via tabela
     historico_logradouro_referencias e RLS). O serviço aparece uma vez, numa seção "Esquina com <rua do registro>". Se a tabela
     estiver vazia ou indisponível, o Histórico funciona exatamente como na 156.3.7.
   v65.42.156.3.7 — 1 cartão por rua/número/dia, sem subcartões documentais; apresentação da Drenagem conforme servico_apresentacao (AUD-34 PREVIEW).
   v65.42.156.3.6 — revisão: o bairro/sub-bairro deixa de separar o mesmo número em dois quadros (pedido sem bairro × serviço com bairro); bairros do quadro listados no cabeçalho; ordem dos quadros: números (crescente), depois trechos, depois sem número.
   v65.42.156.3.5 — agrupamento VISUAL por local dentro de cada dia, sem colapsar lançamentos e sem vinculação automática.
   v65.42.156.3.4 — revisão: solicitação sem título/situação repetidos dentro do dia; casos voltam a mostrar a contagem de arquivos e relatórios.
   v65.42.156.3.3 — linha do tempo diária recolhida, detalhes por clique e paginação por data.
   v65.42.156.3.2 — revisão: área vazia diz "com os filtros aplicados" quando há filtro; rótulo da data no card sem frase incompleta.
   v65.42.156.3.1 — Etapa 6.6C.5: áreas por tipo e agrupamento visual por data; preserva 6.6B.2: serviços executados (BDS) no histórico, só com as colunas liberadas pela R1.1.
   Somente leitura, pelo cliente autenticado existente; RLS permanece soberana.
   Identidade da rua = logradouro_normalizado GERADO no banco por norm_logradouro().
   Os helpers do mapa só preparam o termo digitado. Não renormalizamos registros,
   não unimos casos, não gravamos vínculos, não criamos pastas nem chamamos Drive.
   Paginação por ID consulta todas as páginas e confere totais; nunca trunca em 1.000. */
'use strict';
const DEM52H_LOCAL='id,gerencia,logradouro,logradouro_normalizado,numero,trecho_referencia,bairro,sub_bairro,latitude,longitude,created_at,deleted_at,motivo_arquivamento,status,tipo_servico_id,servico:demanda_tipos_servico(nome)';
const DEM52H_DEMANDA=DEM52H_LOCAL+',origem_id,origem_migracao,origem:demanda_origens(nome),protocolo,data_recebimento,solicitante,assunto,prazo,observacao';
const DEM52H_CASO=DEM52H_LOCAL+',codigo,titulo,diagnostico,proxima_acao,data_vistoria,data_programacao,data_inicio_execucao,data_conclusao';
/* Proposta 6.6B.2 — SOMENTE colunas autorizadas pela R1.1; nunca select('*'). */
const DEM52H_EXEC='id,gerencia,gerencia_territorial,territorio_cl,territorio_criterio,logradouro,logradouro_normalizado,numero,trecho_referencia,bairro,sub_bairro,data_execucao,modalidade,servico_original,servico_apresentacao,fonte_tipo,fonte_nome,criado_em';
/* 6.6D.12 — referências de esquina. Somente colunas de apresentação; nunca select('*'). */
const DEM52H_REF='id,gerencia,tipo_evento,servico_id,demanda_id,logradouro_busca,logradouro_normalizado,papel,contexto_loteamento,referencia_original,bairro';
const DEM52H_EXEC_VINCULO='id,servico_id,demanda_id,justificativa,validado_em,criado_em';
const DEM52H_MODALIDADES={asfalto_liso:'Asfalto Liso',asfaltinho:'Asfaltinho',tapa_buracos:'Tapa-Buracos',aplicacao_massa:'Aplicação de Massa',drenagem:'Drenagem',grelhas_tampoes:'Grelhas e Tampões',passeios:'Passeios',outros_pavimentos:'Outros Pavimentos',outros_servicos:'Outros Serviços'};
const DEM52H_FINAIS=['concluido','cancelado','sem_possibilidade_de_atendimento'];
let dem52h={consulta:0,controle:null,ocupado:false,termo:'',grupos:[],grupo:null,dados:null,linhas:[],visiveis:20,selecionada:null,filtros:{},pgRuas:0};
function dem52hEl(k){return document.getElementById('dem52h-'+k);}
function dem52hEsc(v){return dem52Texto(v);}
function dem52hDia(v){if(!v)return '';if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;return dem52eDataLocal(v).slice(0,10);}
function dem52hUnicos(itens){return [...new Map(itens.map(x=>[x.id,x])).values()];}
function dem52hHoje(){return dem52Hoje();}
function dem52hEscopo(gc){return dem52Pode()&&!!gc&&(dem52Global()||gc===acesso28?.user?.gerencia);}
// R29: território homologado é visível à gerência beneficiada, sem dar acesso ao JSON da origem.
function dem52hServicoVisivel(r){return dem52hEscopo(r.gerencia)||(
 dem52Pode()&&!!r.gerencia_territorial&&dem52hEscopo(r.gerencia_territorial)&&!!r.territorio_cl&&
 ['R3_PONTO','R3_RUA_EXCLUSIVA','R3_TRECHO_CONFIRMADO'].includes(r.territorio_criterio));}
function dem52hTerritorio(r){return r.gerencia_territorial&&r.territorio_cl&&r.territorio_criterio?r.gerencia_territorial:r.gerencia;}
function dem52hApoio(r){return r.gerencia_territorial&&r.territorio_cl&&r.gerencia!==r.gerencia_territorial?
 '<span class="dem52h-apoio">Apoio entre Gerências — Serviço executado pela '+dem52hEsc(r.gerencia)+' em apoio à '+dem52hEsc(r.gerencia_territorial)+'</span>':'';}

function dem52hConsultaBase(tabela,colunas){
 let q=sb.from(tabela).select(colunas,{count:'exact'});
 if(!dem52Global()){
  if(!DEM52_UNIDADES.includes(acesso28?.user?.gerencia))throw Error('Escopo indisponível.');
  // servicos_demandas_vinculos não tem coluna gerencia: o escopo vem da RLS (os dois lados precisam estar visíveis).
  if(tabela==='servicos_executados')q=q.or('gerencia.eq."'+acesso28.user.gerencia+'",gerencia_territorial.eq."'+acesso28.user.gerencia+'"');
  else if(tabela!=='servicos_demandas_vinculos')q=q.eq('gerencia',acesso28.user.gerencia);
 }
 return q;
}
async function dem52hTodas(tabela,colunas,filtrar,ctx){
 let rows=[],last=null,total=null;
 for(;;){
  if(!ctx.valido())throw Error('Consulta substituída.');
  // A busca curta por nome também seleciona as colunas exigidas na validação de escopo territorial.
  const selecao=tabela==='servicos_executados'&&!colunas.includes('gerencia_territorial')?colunas+',gerencia_territorial,territorio_cl,territorio_criterio':colunas;
  let q=filtrar(dem52hConsultaBase(tabela,selecao));if(last)q=q.gt('id',last);
  const {data,error,count}=await q.order('id').range(0,299).abortSignal(ctx.controle.signal);
  if(!ctx.valido())throw Error('Consulta substituída.');if(error)throw error;
  if(!Array.isArray(data)||!Number.isSafeInteger(count)||count<0)throw Error('Resposta incompleta.');
  if(total===null)total=count;
  if(count!==total-rows.length||data.length>count||(!data.length&&count))throw Error('Os registros mudaram durante a consulta.');
  for(const row of data)if(typeof row.id!=='string'||(last&&row.id<=last)||(row.gerencia&&!(tabela==='servicos_executados'?dem52hServicoVisivel(row):dem52hEscopo(row.gerencia))))throw Error('Resposta fora do escopo.');
  rows.push(...data);
  if(rows.length===total){if(new Set(rows.map(r=>r.id)).size!==total)throw Error('Resposta repetida.');return rows;}
  last=data[data.length-1].id;
 }
}
async function dem52hPorIds(tabela,colunas,campo,ids,ctx,ativos=false){
 const todos=[];ids=[...new Set(ids)].filter(Boolean);
 for(let i=0;i<ids.length;i+=75){const lote=ids.slice(i,i+75);todos.push(...await dem52hTodas(tabela,colunas,q=>{q=q.in(campo,lote);return ativos?q.is('deleted_at',null):q;},ctx));}
 return dem52hUnicos(todos);
}
/* 6.6D.12 — a tabela de referências é complementar: se não existir, sem permissão ou com erro,
   o Histórico segue só com os registros diretos da rua (comportamento da 156.3.7). */
async function dem52hRefsOpcional(filtrar,ctx){
 try{const r=await dem52hTodas('historico_logradouro_referencias',DEM52H_REF,filtrar,ctx);return r.filter(x=>x.papel==='esquina'&&x.logradouro_normalizado);}
 catch(e){if(!ctx.valido())throw e;return [];}
}
function dem52hIniciar(){
 dem52h.controle?.abort();const controle=new AbortController(),id=++dem52h.consulta,g=ac28Generation,u=acesso28?.user?.user_id;
 dem52h.controle=controle;dem52h.ocupado=true;dem52hEl('buscar').disabled=true;dem52hEl('area').setAttribute('aria-busy','true');
 const timer=setTimeout(()=>controle.abort(),45000);
 return {controle,valido:()=>id===dem52h.consulta&&g===ac28Generation&&u===acesso28?.user?.user_id&&dem52Pode()&&!controle.signal.aborted,
 atual:()=>id===dem52h.consulta&&g===ac28Generation&&u===acesso28?.user?.user_id&&dem52Pode(),
 fechar(){clearTimeout(timer);if(this.atual()){dem52h.ocupado=false;dem52h.controle=null;dem52hEl('buscar').disabled=false;dem52hEl('area').removeAttribute('aria-busy');}}};
}
function dem52hAviso(texto,erro=false){const el=dem52hEl('aviso');el.hidden=!texto;el.textContent=texto;el.classList.toggle('dem52h-erro',erro);}
function dem52hMontar(){
 const view=document.getElementById('view-demandas'),abas=view.querySelector('.dem52c-abas');
 const tab=document.createElement('button');tab.type='button';tab.id='dem52c-aba-historico';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.tabIndex=-1;tab.innerHTML='Histórico do Logradouro <small>o que aconteceu na rua</small>';tab.onclick=()=>dem52cMudarAba('historico');abas.append(tab);
 const area=document.createElement('section');area.id='dem52h-area';area.hidden=true;area.setAttribute('aria-label','Histórico do Logradouro');
 area.innerHTML=`<form id="dem52h-busca" class="dem52-panel dem52h-busca" role="search" aria-label="Pesquisar histórico de uma rua"><div><h2>O que já aconteceu nesta rua?</h2><p>Pesquise pelo nome do logradouro. Não precisa informar número.</p></div><div class="dem52h-busca-linha"><label for="dem52h-termo">Logradouro<input type="search" id="dem52h-termo" maxlength="250" placeholder="Ex.: Rua Amaral Costa" required autocomplete="off"></label><button type="submit" id="dem52h-buscar" class="btn btn-primary">Buscar histórico</button></div></form>
 <p id="dem52h-aviso" class="dem52h-aviso" role="status" hidden></p><div id="dem52h-ruas"></div><div id="dem52h-resultado" hidden></div>
 <div id="dem52h-inicio" class="dem52-panel dem52-empty"><strong>Uma rua, todo o histórico disponível</strong><p>Consulte demandas antigas e atuais, casos, serviços e arquivos associados. Aparecem somente os registros cadastrados e permitidos para sua conta.</p></div>
 <p class="dem52h-sei">O site acompanha os serviços após o encaminhamento oficial. Os processos e despachos continuam no SEI.</p>`;
 abas.after(area);dem52hEl('busca').onsubmit=e=>{e.preventDefault();dem52hBuscar();};
 area.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.hRua!==undefined)dem52hCarregar(dem52h.grupos[Number(b.dataset.hRua)]);
  else if(b.dataset.hLinha!==undefined)dem52hDetalhe(b.dataset.hLinha);
  else if(b.dataset.hCaso)dem52cAbrirCaso(b.dataset.hCaso);
  else if(b.dataset.hAcao==='atualizar'&&!dem52h.ocupado)dem52hCarregar(dem52h.grupo,true);
  else if(b.dataset.hAcao==='limpar'){dem52hEl('filtros').reset();dem52hFiltrar();}
  else if(b.dataset.hAcao==='mais'){dem52h.visiveis+=20;dem52hRenderLista();}
  else if(b.dataset.hAcao==='ruas-mais'){dem52h.pgRuas++;dem52hRenderRuas();}
  else if(b.dataset.hAcao==='voltar'){dem52hEl('detalhe').hidden=true;dem52h.selecionada=null;const alvo=dem52hEl('lista').querySelector('[aria-pressed=true]');alvo?.setAttribute('aria-pressed','false');alvo?.focus();}
 });
 area.addEventListener('change',e=>{if(e.target.closest('#dem52h-filtros'))dem52hFiltrar();});
 area.addEventListener('submit',e=>{if(e.target.id==='dem52h-filtros'){e.preventDefault();dem52hFiltrar();}});
}
function dem52hSincronizar(){
 const tab=dem52cEl('aba-historico'),area=dem52hEl('area');if(!tab||!area)return;
 const ativo=dem52c.aba==='historico';tab.setAttribute('aria-selected',String(ativo));tab.tabIndex=ativo?0:-1;tab.disabled=!!dem52Cadastro?.aberto;tab.title=tab.disabled?'Conclua ou cancele o cadastro para consultar o histórico.':'';area.hidden=!ativo;
}
async function dem52hAbrir(){
 if(!dem52Pode()||dem52Cadastro?.aberto||!await dem52cPodeDescartar())return;
 window.AP52Demandas66g2?.clearAll?.();
 dem52cFecharForm();dem52c.aba='historico';dem52c.modo=null;dem52cSincronizar();dem52hEl('termo').focus({preventScroll:true});
}
/* A pesquisa usa os helpers existentes do mapa para retirar o tipo (Rua/Av./R.).
   A seleção posterior usa igualdade da chave do banco: Amaral Costa e Amaral Costa
   Filho, por exemplo, são opções diferentes, nunca um histórico unido por prefixo. */
async function dem52hBuscar(){
 if(!dem52Pode())return;
 const termo=dem52hEl('termo').value.trim();
 const busca=normalizarTextoBuscaMapa(tipoLogradouroSemPrefixoMapa(termo));
 if(!busca||/^(rua|r|av|avenida|estrada|est|estr|travessa|tv|trav|trv|praca|beco|caminho|rodovia)$/.test(busca)){dem52hAviso('Digite o nome da rua, como Amaral Costa.',true);return;}
 const ctx=dem52hIniciar();dem52h.termo=termo;dem52h.grupos=[];dem52h.dados=null;dem52h.grupo=null;dem52h.pgRuas=0;
 dem52hEl('resultado').hidden=true;dem52hEl('resultado').replaceChildren();dem52hEl('ruas').replaceChildren();dem52hEl('inicio').hidden=true;dem52hAviso('Procurando logradouros nos registros disponíveis…');
 try{
  const col='id,gerencia,logradouro,logradouro_normalizado,bairro',f=q=>q.ilike('logradouro_normalizado','%'+busca.replace(/[\\%_]/g,'\\$&')+'%');
  const [d,c,execucoes,refs]=await Promise.all([dem52hTodas('demandas',col,f,ctx),dem52hTodas('casos_operacionais',col,f,ctx),dem52hTodas('servicos_executados',col,f,ctx),dem52hRefsOpcional(f,ctx)]);
  if(!ctx.valido())return;
  const grupos=new Map();
  const esquinas=refs.map(r=>({gerencia:r.gerencia,logradouro:r.logradouro_busca,logradouro_normalizado:r.logradouro_normalizado,bairro:r.bairro}));
  for(const row of [...d,...c,...execucoes,...esquinas]){
   if(!row.logradouro_normalizado)throw Error('Logradouro sem chave.');
   let g=grupos.get(row.logradouro_normalizado);
   if(!g){g={chave:row.logradouro_normalizado,nome:expandirTipoLogradouroMapa(row.logradouro),gerencias:new Set(),bairros:new Set()};grupos.set(g.chave,g);}
   g.gerencias.add(row.gerencia_territorial&&row.territorio_cl?row.gerencia_territorial:row.gerencia);if(row.bairro)g.bairros.add(row.bairro);
  }
  dem52h.grupos=[...grupos.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));dem52hAviso('');
  if(!dem52h.grupos.length){dem52hAviso('Nenhum registro encontrado para essa rua no seu acesso. Dica: digite parte do nome da rua, com ou sem acento, usando ou não abreviações. Ex.: Glicina ou Av. Glicina. Registros ainda não importados não aparecem aqui.');return;}
  const exato=normalizarTextoBuscaMapa(expandirTipoLogradouroMapa(termo));const escolhido=dem52h.grupos.find(g=>g.chave===exato)||(dem52h.grupos.length===1?dem52h.grupos[0]:null);
  if(escolhido){ctx.fechar();await dem52hCarregar(escolhido);return;}
  dem52hRenderRuas();
 }catch(e){if(ctx.atual()){ctx.controle.abort();dem52hAviso('Não foi possível concluir a busca. Confira a conexão e clique em Buscar histórico para tentar novamente.',true);}}
 finally{ctx.fechar();}
}
function dem52hRenderRuas(){
 const n=Math.min((dem52h.pgRuas+1)*20,dem52h.grupos.length);
 dem52hEl('ruas').innerHTML=`<section class="dem52-panel"><header class="dem52-list-head"><div><h2>Escolha o logradouro</h2><p>${dem52h.grupos.length} nomes encontrados. Ruas com nomes diferentes ficam separadas.</p></div></header>${dem52h.grupos.slice(0,n).map((g,i)=>`<button type="button" class="dem52-row" data-h-rua="${i}"><strong>${dem52hEsc(g.nome)}</strong><span class="dem52-address">${dem52hEsc([...g.gerencias].sort().join(' · '))}${g.bairros.size?' — '+dem52hEsc([...g.bairros].sort().join(' / ')):''}</span></button>`).join('')}${n<dem52h.grupos.length?'<button type="button" class="btn btn-ghost dem52h-mais" data-h-acao="ruas-mais">Mostrar mais logradouros</button>':''}</section>`;
}
async function dem52hCarregar(grupo,manter=false){
 if(!grupo||!dem52Pode())return;
 const ctx=dem52hIniciar(),filtros=manter?{...dem52h.filtros}:{};dem52h.grupo=grupo;dem52h.dados=null;dem52h.selecionada=null;dem52hEl('ruas').replaceChildren();dem52hEl('resultado').hidden=true;dem52hEl('resultado').replaceChildren();dem52hAviso('Reunindo serviços executados, demandas e casos desta rua…');
 try{
  const f=q=>q.eq('logradouro_normalizado',grupo.chave);
  const [demandasRua,casos,execucoesRua,refs]=await Promise.all([dem52hTodas('demandas',DEM52H_DEMANDA,f,ctx),dem52hTodas('casos_operacionais',DEM52H_CASO,f,ctx),dem52hTodas('servicos_executados',DEM52H_EXEC,f,ctx),dem52hRefsOpcional(f,ctx)]);
  // 6.6D.12 — registros de OUTRA rua que citam esta como esquina (referência homologada). Cada um entra uma única vez.
  const idsS=new Set(execucoesRua.map(x=>x.id)),idsD=new Set(demandasRua.map(x=>x.id));
  const refS=refs.filter(r=>r.tipo_evento==='servico'&&r.servico_id&&!idsS.has(r.servico_id)),refD=refs.filter(r=>r.tipo_evento==='demanda'&&r.demanda_id&&!idsD.has(r.demanda_id));
  const [execEsq,demEsq]=await Promise.all([dem52hPorIds('servicos_executados',DEM52H_EXEC,'id',refS.map(r=>r.servico_id),ctx),dem52hPorIds('demandas',DEM52H_DEMANDA,'id',refD.map(r=>r.demanda_id),ctx)]);
  const marca=(rows,lista,campo)=>{const m=new Map(lista.map(r=>[r[campo],r]));return rows.filter(x=>m.has(x.id)).map(x=>({...x,_esquina:{rua:m.get(x.id).logradouro_busca,referencia:m.get(x.id).referencia_original,contexto:m.get(x.id).contexto_loteamento}}));};
  const execucoes=[...execucoesRua,...marca(execEsq,refS,'servico_id')],demandas=[...demandasRua,...marca(demEsq,refD,'demanda_id')];
  const lc='id,gerencia,caso_id,demanda_id';
  const [ld,lcases,lv]=await Promise.all([
   dem52hPorIds('caso_demandas',lc,'demanda_id',demandas.map(x=>x.id),ctx,true),
   dem52hPorIds('caso_demandas',lc,'caso_id',casos.map(x=>x.id),ctx,true),
   dem52hPorIds('servicos_demandas_vinculos',DEM52H_EXEC_VINCULO,'servico_id',execucoes.map(x=>x.id),ctx)
  ]);
  const links=dem52hUnicos([...ld,...lcases]);
  const ds=new Set(demandas.map(x=>x.id)),cs=new Set(casos.map(x=>x.id));
  const [extraD,extraC]=await Promise.all([
   dem52hPorIds('demandas',DEM52H_DEMANDA,'id',[...links.map(x=>x.demanda_id),...lv.map(x=>x.demanda_id)].filter(id=>!ds.has(id)),ctx),
   dem52hPorIds('casos_operacionais',DEM52H_CASO,'id',links.map(x=>x.caso_id).filter(id=>!cs.has(id)),ctx)
  ]);
  const todosC=[...casos,...extraC],todosD=[...demandas,...extraD];let evidencias=null,relatorios=null;
  const adicionais=await Promise.allSettled([
   dem52hPorIds('caso_evidencias','id,caso_id,gerencia,tipo,mime_type','caso_id',todosC.map(x=>x.id),ctx,true),
   dem52hPorIds('relatorios_fotograficos','id,caso_id,gerencia,codigo,titulo,data_relatorio,status','caso_id',todosC.map(x=>x.id),ctx,true)
  ]);
  if(!ctx.valido())throw Error('Consulta interrompida.');
  if(adicionais[0].status==='fulfilled')evidencias=adicionais[0].value;
  if(adicionais[1].status==='fulfilled')relatorios=adicionais[1].value;
  // Vínculos só são considerados quando AMBOS os registros estão visíveis no mesmo escopo.
  const mapD=new Map(todosD.map(x=>[x.id,x])),mapC=new Map(todosC.map(x=>[x.id,x]));
  const vinculos=links.filter(l=>mapD.get(l.demanda_id)?.gerencia===l.gerencia&&mapC.get(l.caso_id)?.gerencia===l.gerencia);
  const mapE=new Map(execucoes.map(x=>[x.id,x]));
  // Vínculo é exibido apenas se serviço e demanda estiverem visíveis pela RLS.
  const linksExec=lv.filter(x=>mapE.has(x.servico_id)&&mapD.has(x.demanda_id));
  dem52h.dados={demandas,casos,execucoes,todosD,todosC,links:vinculos,linksExec,evidencias,relatorios,mapD,mapC,mapE};
  dem52h.filtros=filtros;dem52hRender();
  dem52hAviso(adicionais.some(r=>r.status==='rejected')?'O histórico foi consultado, mas parte das referências de arquivos não pôde ser carregada. Use Atualizar histórico para tentar novamente.':'',adicionais.some(r=>r.status==='rejected'));
 }catch(e){if(ctx.atual()){ctx.controle.abort();dem52h.dados=null;dem52hAviso('Não foi possível carregar o histórico completo. Confira a conexão e use Buscar histórico novamente. Nenhum total parcial foi apresentado.',true);}}
 finally{ctx.fechar();}
}
function dem52hDemandasCaso(c){const b=dem52h.dados;return dem52hUnicos(b.links.filter(l=>l.caso_id===c.id).map(l=>b.mapD.get(l.demanda_id)).filter(Boolean));}
function dem52hCasosDemanda(d){const b=dem52h.dados;return dem52hUnicos(b.links.filter(l=>l.demanda_id===d.id).map(l=>b.mapC.get(l.caso_id)).filter(Boolean));}
function dem52hDemandasExecucao(e){const b=dem52h.dados;return dem52hUnicos(b.linksExec.filter(l=>l.servico_id===e.id).map(l=>b.mapD.get(l.demanda_id)).filter(Boolean));}
function dem52hDataLinha(l){
 const r=l.row;if(l.tipo==='s')return {dia:r.data_execucao||'',rotulo:r.data_execucao?'Execução':''};if(l.tipo==='d')return {dia:r.data_recebimento||dem52hDia(r.created_at),rotulo:r.data_recebimento?'Recebimento':'Cadastro'};
 const candidatas=[['Conclusão',r.data_conclusao],['Início da execução',r.data_inicio_execucao],['Vistoria',r.data_vistoria]].filter(x=>x[1]&&x[1]<=dem52hHoje()).sort((a,b)=>b[1].localeCompare(a[1]));
 return candidatas.length?{rotulo:candidatas[0][0],dia:candidatas[0][1]}:{rotulo:'Abertura do caso',dia:dem52hDia(r.created_at)};
}
function dem52hAnos(l){const r=l.row;
 if(l.tipo==='s')return r.data_execucao?[r.data_execucao.slice(0,4)]:[];
 return [...new Set([r.created_at,r.data_recebimento,r.data_vistoria,r.data_programacao,r.data_inicio_execucao,r.data_conclusao,...(l.tipo==='c'?dem52hDemandasCaso(r).map(d=>d.data_recebimento):[])].filter(Boolean).map(v=>dem52hDia(v).slice(0,4)))];}
function dem52hOpcoes(lista,vazio){return `<option value="">${vazio}</option>`+lista.map(([k,v])=>`<option value="${dem52hEsc(k)}">${dem52hEsc(v)}</option>`).join('');}
function dem52hRender(){
 const b=dem52h.dados,g=dem52h.grupo;if(!b||!g)return;
 // Toda solicitação aparece como registro próprio, mesmo quando associada a um caso.
 dem52h.linhas=[...b.execucoes.map(row=>({tipo:'s',row,chave:'s:'+row.id})),...b.casos.map(row=>({tipo:'c',row,chave:'c:'+row.id})),...b.demandas.map(row=>({tipo:'d',row,chave:'d:'+row.id}))];
 dem52h.linhas.sort((a,c)=>dem52hDataLinha(c).dia.localeCompare(dem52hDataLinha(a).dia)||a.chave.localeCompare(c.chave));
 const ativos=b.casos.filter(c=>!c.deleted_at&&!DEM52H_FINAIS.includes(c.status)).length;
 const datas=[...b.execucoes.map(e=>e.data_execucao),...b.casos.filter(c=>c.status==='concluido').map(c=>c.data_conclusao)].filter(v=>v&&v<=dem52hHoje()).sort();
 const gerencias=[...new Set([...b.demandas,...b.casos].map(r=>r.gerencia).concat(b.execucoes.map(dem52hTerritorio)))].sort();
 const anos=[...new Set(dem52h.linhas.flatMap(dem52hAnos))].sort().reverse();
 const servicos=[...new Map([...b.todosD,...b.casos].filter(r=>r.tipo_servico_id).map(r=>[r.tipo_servico_id,r.servico?.nome||'Serviço registrado'])).entries(),
  ...new Map(b.execucoes.map(r=>['s:'+r.modalidade,DEM52H_MODALIDADES[r.modalidade]||r.modalidade])).entries()].sort((a,c)=>a[1].localeCompare(c[1],'pt-BR'));
 const origens=[...new Map(b.todosD.filter(d=>d.origem_id).map(d=>[d.origem_id,d.origem?.nome||'Origem registrada'])).entries(),
  ...new Map(b.execucoes.map(e=>['s:'+e.fonte_nome,e.fonte_nome])).entries()].sort((a,c)=>a[1].localeCompare(c[1],'pt-BR'));
 dem52hEl('resultado').innerHTML=`<section class="dem52-panel dem52h-resumo"><header><div><div class="dem52-eyebrow">Histórico do Logradouro</div><h2 id="dem52h-titulo" tabindex="-1">${dem52hEsc(g.nome)}</h2><p>${dem52hEsc(gerencias.join(' · ')||dem52Escopo())}</p></div><button type="button" class="btn btn-ghost" data-h-acao="atualizar">Atualizar histórico</button></header><p class="dem52h-legenda">Resumo geral da rua · todos os anos · registros disponíveis no seu acesso</p><dl class="dem52h-kpis">${[[b.demandas.length,'Demandas'],[b.casos.length,'Casos'],[b.execucoes.length,'Serviços executados'],[ativos,'Casos ativos']].map(([n,t])=>`<div><dd>${n}</dd><dt>${t}</dt></div>`).join('')}</dl>${(n=>n?`<p class="dem52h-legenda dem52h-esquina-resumo">Inclui ${n} registro(s) de rua transversal em que esta rua aparece como esquina.</p>`:'')(b.execucoes.filter(x=>x._esquina).length+b.demandas.filter(x=>x._esquina).length)}<p class="dem52h-ultima"><b>Última execução registrada:</b> ${datas.length?dem52Data(datas[datas.length-1]):'sem data de execução registrada'}</p></section>
 <details class="dem52-panel dem52h-filtros"><summary>Filtrar ocorrências <span id="dem52h-filtro-contagem"></span></summary><form id="dem52h-filtros"><div class="dem52h-filter-grid"><label>Ano<select id="dem52h-ano">${dem52hOpcoes(anos.map(a=>[a,a]),'Todos os anos')}</select></label><label>Status<select id="dem52h-status"><option value="">Todos os status</option><option value="arquivados">Registros arquivados</option><option value="s:executado">Serviços executados</option><optgroup label="Situação do caso">${Object.entries(DEM52_CASO_STATUS).map(([k,v])=>`<option value="c:${k}">${v}</option>`).join('')}</optgroup><optgroup label="Situação da demanda">${Object.entries(DEM52_STATUS).map(([k,v])=>`<option value="d:${k}">${v}</option>`).join('')}</optgroup></select></label><label>Tipo de serviço<select id="dem52h-servico">${dem52hOpcoes(servicos,'Todos os serviços')}</select></label><label>Origem<select id="dem52h-origem">${dem52hOpcoes(origens,'Todas as origens')}</select></label><label>Gerência<select id="dem52h-gerencia">${dem52hOpcoes(gerencias.map(v=>[v,v]),dem52Global()?'Todas as gerências':'Sua gerência')}</select></label><label>Número ou trecho<input id="dem52h-local" type="search" maxlength="150" placeholder="Ex.: 140 ou próximo à praça"></label></div><p>Nos serviços executados, o ano corresponde à execução; demandas e casos mantêm suas próprias datas. Os filtros alteram a lista; o resumo mostra toda a rua.</p><div class="dem52h-filter-actions"><button type="button" class="btn btn-ghost" data-h-acao="limpar">Limpar filtros</button><button type="submit" class="btn btn-primary">Aplicar filtros</button></div></form></details>
 <section id="dem52h-detalhe" class="dem52-panel dem52h-detalhe" hidden></section>
 <section class="dem52-panel"><header class="dem52-list-head"><div><h2>Solicitações e serviços desta rua</h2><p id="dem52h-contagem" role="status"></p></div></header><p class="dem52h-lista-nota">Pesquise somente pelo nome da rua: o dia reúne todos os números e trechos. Ao abrir, veja os serviços e pedidos por endereço. Coincidência de rua, número ou data não comprova vínculo.</p><div id="dem52h-lista"></div><button type="button" id="dem52h-mais" class="btn btn-ghost dem52h-mais" data-h-acao="mais" hidden>Mostrar mais ocorrências</button></section>`;
 for(const k of ['ano','status','servico','origem','gerencia','local'])dem52hEl(k).value=dem52h.filtros[k]||'';
 if(!dem52Global()){dem52hEl('gerencia').value=acesso28.user.gerencia;dem52hEl('gerencia').disabled=true;}
 dem52hEl('resultado').hidden=false;dem52hFiltrar();dem52hEl('titulo').focus({preventScroll:true});
}
function dem52hFiltrar(){
 dem52h.filtros=Object.fromEntries(['ano','status','servico','origem','gerencia','local'].map(k=>[k,dem52hEl(k).value.trim()]));dem52h.visiveis=20;dem52h.selecionada=null;dem52hEl('detalhe').hidden=true;dem52hRenderLista();
}
function dem52hCombina(l){
 const f=dem52h.filtros,r=l.row,ds=l.tipo==='c'?dem52hDemandasCaso(r):l.tipo==='s'?dem52hDemandasExecucao(r):[r];
 if(l.tipo==='s'){
  if(f.ano&&!dem52hAnos(l).includes(f.ano))return false;
  if(f.gerencia&&dem52hTerritorio(r)!==f.gerencia)return false;
  if(f.status&&f.status!=='s:executado')return false;
  if(f.servico&&f.servico!=='s:'+r.modalidade)return false;
  if(f.origem&&f.origem!=='s:'+r.fonte_nome)return false;
  if(f.local&&!normalizarTextoBuscaMapa([r.numero,r.trecho_referencia].filter(Boolean).join(' ')).includes(normalizarTextoBuscaMapa(f.local)))return false;
  return true;
 }
 if(f.ano&&!dem52hAnos(l).includes(f.ano))return false;
 if(f.gerencia&&r.gerencia!==f.gerencia)return false;
 if(f.status==='s:executado')return false;
 if(f.status==='arquivados'&&!r.deleted_at&&!ds.some(d=>d.deleted_at))return false;
 if(f.status.startsWith('c:')&&(l.tipo!=='c'||r.status!==f.status.slice(2)))return false;
 const porDemanda=!!f.origem||f.status.startsWith('d:');
 if(porDemanda&&!ds.some(d=>(!f.origem||d.origem_id===f.origem)&&(!f.status.startsWith('d:')||d.status===f.status.slice(2))))return false;
 if(f.servico&&r.tipo_servico_id!==f.servico&&!ds.some(d=>d.tipo_servico_id===f.servico))return false;
 if(f.local){const t=normalizarTextoBuscaMapa(f.local),registros=[r,...ds.filter(d=>d.logradouro_normalizado===dem52h.grupo.chave)];if(!registros.some(v=>normalizarTextoBuscaMapa([v.numero,v.trecho_referencia].filter(Boolean).join(' ')).includes(t)))return false;}
 return true;
}
function dem52hTag(l){if(l.tipo==='s')return '<span class="dem52-tag" data-status="concluido">Executado</span>';
 return (l.row.deleted_at?'<span class="dem52-tag">Arquivado</span> ':'')+(l.tipo==='c'?dem52cTag(l.row.status):`<span class="dem52-tag" data-status="${dem52hEsc(l.row.status)}">${dem52hEsc(DEM52_STATUS[l.row.status]||'Situação não informada')}</span>`);}
function dem52hArquivos(c){
 const b=dem52h.dados,e=b.evidencias?.filter(x=>x.caso_id===c.id),r=b.relatorios?.filter(x=>x.caso_id===c.id);
 return {e,r,texto:e?`${e.length} arquivo${e.length===1?'':'s'} · ${e.filter(x=>x.mime_type?.startsWith('image/')).length} foto(s)`:'Arquivos não consultados',relatorio:r?`${r.length} relatório(s)`:'Relatórios não consultados'};
}
/* 6.6D.3 — Uma única linha do tempo da rua.
   Cada DIA começa fechado e expande todos os dados disponíveis dos registros daquele dia.
   Paginação por DIA, não por linha: nenhum registro do dia fica oculto quando o usuário abre a data.
   Solicitações e serviços permanecem distintos; coincidência de rua/data NÃO cria vínculos.
   Casos operacionais permanecem em consulta complementar. Sem alteração de RLS ou escrita. */
/* 6.6D.5 — Rótulo SOMENTE de apresentação. Os campos de origem do Supabase
   são mantidos intactos, inclusive seus códigos 1, 2, 3 e descrições literais.
   Não reinterpretar categorias de outras modalidades como serviços de GAP. */
const DEM52H_TL_MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DEM52H_TL_SEMANA=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
function dem52hTlValida(dia){return /^\d{4}-\d{2}-\d{2}$/.test(String(dia||''));}
function dem52hTlMes(dia){if(!dem52hTlValida(dia))return 'Sem data informada';const m=DEM52H_TL_MESES[Number(dia.slice(5,7))-1];return m?`${m} de ${dia.slice(0,4)}`:'Sem data informada';}
function dem52hTlSemana(dia){if(!dem52hTlValida(dia))return '';const d=new Date(dia+'T12:00:00');return Number.isNaN(d.getTime())?'':DEM52H_TL_SEMANA[d.getDay()];}
function dem52hTlIntervalo(recente,anterior){
 if(!dem52hTlValida(recente)||!dem52hTlValida(anterior))return '';
 const dias=Math.round((Date.parse(recente+'T12:00:00')-Date.parse(anterior+'T12:00:00'))/86400000);
 if(!(dias>0))return '';
 return dias===1?'Intervalo de 1 dia':`Intervalo de ${dias} dias`;
}
function dem52hTlPlural(n,um,varios){return `${n} ${n===1?um:varios}`;}
function dem52hTlNomes(g){
 const nomes=[...new Set([...g.s.map(l=>dem52hNomeServico(l.row)),...g.d.map(l=>'Pedido: '+(String(l.row.assunto||'').trim()||'assunto não informado'))].map(x=>String(x||'').trim()).filter(Boolean))];
 return nomes.length>3?nomes.slice(0,3).join(' · ')+` · +${nomes.length-3}`:nomes.join(' · ');
}
function dem52hNomeServico(r){
 // AUD-34 PREVIEW: a classificação da Drenagem pertence ao registro de origem.
 // Não presumir GAP nem eliminar os objetos de serviços de limpeza.
 const apresentacao=String(r.servico_apresentacao||'').trim();
 if(apresentacao)return apresentacao;
 return String(r.servico_original||'').trim()||'Serviço executado';
}
/* 6.6D.4 — Consulta POR RUA. Em cada data, os registros são organizados em
   blocos VISUAIS por número/referência, sem UPDATE, sem deduplicação e sem criar
   vínculos. Um local com número agrupa os seus lançamentos; referências sem
   número são agrupadas apenas quando explicitamente iguais. Na ausência de
   número e referência, a localização não é presumida igual à de outro evento. */
function dem52hLocalTexto(v){return String(v||'').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();}
function dem52hChaveNumero(v){const n=dem52hLocalTexto(v).replace(/^(?:N(?:\.|[º°])?\s*)/,'');return /^0*\d+$/.test(n)?String(Number(n)):n;}
function dem52hGruposLocais(linhas){
 const porLocal=new Map();
 for(const l of linhas){
  const r=l.row,numero=dem52hChaveNumero(r.numero),trecho=dem52hLocalTexto(r.trecho_referencia);
  const escopo=dem52hLocalTexto(l.tipo==='s'?dem52hTerritorio(r):r.gerencia); // bairro não separa a mesma rua
  // Ausência de número/referência NÃO é evidência de ser o mesmo ponto.
  const esq=r._esquina?dem52hLocalTexto(r.logradouro):'';
  const ponto=esq?'e:'+esq+'|'+(numero||trecho):numero?'n:'+numero:trecho?'t:'+trecho:'i:'+l.chave;
  const chave=escopo+'|'+ponto;
  if(!porLocal.has(chave))porLocal.set(chave,{numero:esq?'':r.numero?String(r.numero).trim():'',trecho:esq?'':r.trecho_referencia?String(r.trecho_referencia).trim():'',gerencia:l.tipo==='s'?dem52hTerritorio(r):r.gerencia,bairro:r.bairro,subBairro:r.sub_bairro,linhas:[],
   esquina:esq?{rua:String(r.logradouro||'').trim(),numero:r.numero?String(r.numero).trim():'',trecho:r.trecho_referencia?String(r.trecho_referencia).trim():''}:null,
   chaveOrdenacao:esq?'c'+esq+'|'+(numero||trecho):numero?'a'+numero:trecho?'b'+trecho:'d'+l.chave /* letras: números, trechos, esquinas e, por último, sem número; o prefixo não se mistura com o número */});
  porLocal.get(chave).linhas.push(l);
 }
 return [...porLocal.values()].sort((a,b)=>a.chaveOrdenacao.localeCompare(b.chaveOrdenacao,'pt-BR',{numeric:true})||String(a.gerencia||'').localeCompare(String(b.gerencia||''),'pt-BR'));
}
/* 6.6D.5 — UM cartão visual por endereço/dia. Cada lançamento permanece
   individual (id e descrição de origem), sem consolidar dados no banco. */
function dem52hLocalCard(local){
 const ds=local.linhas.filter(l=>l.tipo==='d'),ss=local.linhas.filter(l=>l.tipo==='s');
 const localTitulo=local.esquina?`Esquina com ${dem52hEsc(expandirTipoLogradouroMapa(local.esquina.rua))}`:local.numero?`Nº ${dem52hEsc(local.numero)}`:local.trecho?`Trecho: ${dem52hEsc(local.trecho)}`:'Número e referência não informados';
 const unicos=valores=>{const mapa=new Map();for(const v of valores.filter(Boolean)){const k=dem52hLocalTexto(v);if(!mapa.has(k))mapa.set(k,String(v).trim());}return [...mapa.values()];};
 const contexto=[...unicos(local.linhas.map(l=>l.row.bairro)),...unicos(local.linhas.map(l=>l.row.sub_bairro)),local.gerencia].filter(Boolean).join(' · ');
 const campoComum=(nome,itens,formatar)=>{
  const vals=unicos(itens.map(l=>formatar(l.row)));
  return vals.length===1?dem52hLinha(nome,vals[0]):'';
 };
 const servicos=ss.length?`<section class="dem52h-local-grupo" aria-label="Serviços executados neste endereço">
  <h5>Serviços executados <span>${ss.length}</span></h5>
  <ul class="dem52h-local-servicos">${ss.map((l,i)=>{
    const r=l.row,nome=dem52hNomeServico(r),vinculados=dem52hDemandasExecucao(r);
    const fontes=unicos(ss.map(x=>x.row.fonte_nome)),tipos=unicos(ss.map(x=>x.row.fonte_tipo)),modalidades=unicos(ss.map(x=>DEM52H_MODALIDADES[x.row.modalidade]||x.row.modalidade));
    return `<li data-h-evento="${dem52hEsc(l.chave)}"><span class="dem52h-local-servico-nome">${dem52hEsc(nome)}</span>
      <span class="dem52h-local-servico-original">Registro original: ${dem52hEsc(r.servico_original||'Não informado')}</span>${dem52hApoio(r)}
      <button type="button" class="btn btn-ghost dem52h-local-detalhe-btn" data-h-linha="${dem52hEsc(l.chave)}" aria-pressed="${dem52h.selecionada===l.chave?'true':'false'}" aria-label="Ver detalhes e sugestões do catálogo: ${dem52hEsc(nome)}">Ver detalhes e sugestões</button>
      ${fontes.length!==1?`<span class="dem52h-local-servico-complemento">Fonte: ${dem52hEsc(r.fonte_nome||'Não informada')}</span>`:''}
      ${tipos.length!==1?`<span class="dem52h-local-servico-complemento">Tipo da fonte: ${dem52hEsc(r.fonte_tipo||'Não informado')}</span>`:''}
      ${modalidades.length!==1?`<span class="dem52h-local-servico-complemento">Modalidade: ${dem52hEsc(DEM52H_MODALIDADES[r.modalidade]||r.modalidade||'Não informada')}</span>`:''}
      ${vinculados.length?`<span class="dem52h-local-servico-complemento">${vinculados.length} vínculo(s) confirmado(s) com solicitação.</span>`:''}
      ${vinculados.length?`<details class="dem52h-local-vinculados"><summary>Consultar vínculos confirmados</summary>${vinculados.map(dem52hDemandaDetalhe).join('')}</details>`:''}
    </li>`;
  }).join('')}</ul>
  <dl class="dem52-meta dem52h-meta dem52h-local-comum">
   ${campoComum('Modalidade',ss,r=>DEM52H_MODALIDADES[r.modalidade]||r.modalidade)}
   ${campoComum('Fonte documental',ss,r=>r.fonte_nome)}
   ${campoComum('Tipo de fonte',ss,r=>r.fonte_tipo)}
  </dl>
 </section>`:'';
 const pedidos=ds.length?`<section class="dem52h-local-grupo" aria-label="Solicitações recebidas neste endereço">
  <h5>Solicitações recebidas <span>${ds.length}</span></h5>
  <ul class="dem52h-local-pedidos">${ds.map(l=>{
   const r=l.row,casos=dem52hCasosDemanda(r);
   return `<li data-h-evento="${dem52hEsc(l.chave)}"><div class="dem52h-local-pedido-cabecalho"><strong>${dem52hEsc(r.assunto||'Assunto não informado')}</strong>${dem52hTag(l)}</div>
    <button type="button" class="btn btn-ghost dem52h-local-detalhe-btn" data-h-linha="${dem52hEsc(l.chave)}" aria-pressed="${dem52h.selecionada===l.chave?'true':'false'}" aria-label="Ver detalhes e sugestões do catálogo: ${dem52hEsc(r.assunto||'Assunto não informado')}">Ver detalhes e sugestões</button>
    <dl class="dem52-meta dem52h-meta">
     ${dem52hLinha('Solicitante',r.solicitante)}${dem52hLinha('Protocolo',r.protocolo)}
     ${dem52hLinha('Origem',r.origem?.nome||'Origem não informada')}${dem52hLinha('Situação',DEM52_STATUS[r.status]||r.status)}
     ${dem52hLinha('Serviço solicitado',r.servico?.nome)}${dem52hLinha('Data de recebimento',r.data_recebimento?dem52Data(r.data_recebimento):null)}
     ${r.prazo?dem52hLinha('Prazo',dem52Data(r.prazo)):''}
     ${r.latitude!=null&&r.longitude!=null?dem52hLinha('Coordenadas',r.latitude+', '+r.longitude):''}
    </dl>
    ${r.observacao?`<p class="dem52h-local-observacao"><strong>Observações:</strong> ${dem52hEsc(r.observacao)}</p>`:''}
    ${r.deleted_at?`<p class="dem52h-local-observacao"><strong>Arquivamento:</strong> ${dem52hEsc(r.motivo_arquivamento||'Motivo não informado')}</p>`:''}
    ${casos.length?`<p class="dem52h-local-observacao">${casos.length} caso(s) formalmente associado(s) a esta solicitação.</p>`:''}
   </li>`;
  }).join('')}</ul></section>`:'';
 const registrosEndereco=unicos(local.linhas.map(l=>dem52Endereco(l.row)));
 const referencias=unicos(local.linhas.map(l=>l.row.trecho_referencia));
 const localInfos=local.esquina?(()=>{const e=local.esquina,orig=unicos(local.linhas.map(l=>l.row._esquina?.referencia)),ctx=unicos(local.linhas.map(l=>l.row._esquina?.contexto));
   const onde=[expandirTipoLogradouroMapa(e.rua),e.numero?'nº '+e.numero:'',orig.length?'':e.trecho].filter(Boolean).join(', '); // o texto original já aparece a seguir
   return `<p class="dem52h-esquina-nota"><strong>Registrado em:</strong> ${dem52hEsc(onde)}. Esta rua aparece no registro como esquina${orig.length?` (na planilha: “${orig.map(dem52hEsc).join('” · “')}”)`:''}${ctx.length?` · ${ctx.map(dem52hEsc).join(' · ')}`:''}.</p>`;})()
  :referencias.length?`<p class="dem52h-local-referencias"><strong>Referência:</strong> ${referencias.map(dem52hEsc).join(' · ')}</p>`:'';
 return `<section class="dem52h-endereco-bloco"${local.esquina?' data-esquina="1"':''}>
  <header class="dem52h-endereco-header"><div><h4>${localTitulo}</h4>${contexto?`<small>${dem52hEsc(contexto)}</small>`:''}</div>
   <div class="dem52h-endereco-contagem">${ss.length?`${ss.length} serviço(s)`:''}${ss.length&&ds.length?' · ':''}${ds.length?`${ds.length} solicitação(ões)`:''}</div>
  </header>
  <div class="dem52h-endereco-corpo">${servicos}${pedidos}${localInfos}
   ${registrosEndereco.length>1?`<p class="dem52h-local-referencias"><strong>Endereços como registrados:</strong> ${registrosEndereco.map(dem52hEsc).join(' · ')}</p>`:''}
   ${ss.length&&ds.length?'<p class="dem52h-vinculo-nota">Mesmo dia e endereço não comprovam atendimento ou vínculo. Somente vínculos registrados e validados são confirmados.</p>':''}
  </div>
 </section>`;
}
function dem52hRenderLista(){
 const linhas=dem52h.linhas.filter(dem52hCombina);
 const filtros=Object.entries(dem52h.filtros).filter(([k,v])=>v&&(k!=='gerencia'||dem52Global())).length;
 dem52hEl('filtro-contagem').textContent=filtros?`· ${filtros} ativo(s)`:'';
 const anterior=dem52hEl('lista');
 const diasAbertos=new Set([...anterior.querySelectorAll('details.dem52h-dia-card[open]')].map(e=>e.dataset.hDia));
 const casosAbertos=!!anterior.querySelector('.dem52h-casos-opcionais[open]');
 const ocorrencias=linhas.filter(l=>l.tipo==='d'||l.tipo==='s');
 const porDia=new Map();
 for(const l of ocorrencias){
  const dia=dem52hDataLinha(l).dia||'sem-data';
  if(!porDia.has(dia))porDia.set(dia,{d:[],s:[]});
  porDia.get(dia)[l.tipo].push(l);
 }
 const datas=[...porDia.keys()].sort((x,y)=>x==='sem-data'?1:y==='sem-data'?-1:y.localeCompare(x));
 const visiveis=datas.slice(0,dem52h.visiveis);
 // v65.42.156.4.7 — linha do tempo: marcador por dia (cor pelo tipo), separador de mês, intervalo entre as datas
 // e prévia do que aconteceu no dia. Os dados e a ordem (mais recente → mais antiga) são os mesmos de antes.
 let mesAnterior=null;
 const diasHtml=visiveis.map((dia,i)=>{
  const g=porDia.get(dia);const total=g.d.length+g.s.length;
  // Um dia contém todos os números e trechos dessa rua; um endereço com
  // vários serviços vira um único bloco, sem perder os lançamentos originais.
  const locais=dem52hGruposLocais([...g.d,...g.s]);
  const rua=dem52h.grupo?.nome||locais[0]?.linhas[0]?.row.logradouro||'Logradouro';
  const blocos=`<article class="dem52h-rua-dia-card"><header class="dem52h-rua-dia-header"><h4>${dem52hEsc(rua)}</h4><span>${locais.length} endereço(s)/trecho(s)</span></header>${locais.map(dem52hLocalCard).join('')}</article>`;
  const mes=dem52hTlMes(dia);
  const cabecalhoMes=mes!==mesAnterior?`<div class="dem52h-tl-mes" role="presentation"><span>${dem52hEsc(mes)}</span></div>`:'';
  mesAnterior=mes;
  const proximo=visiveis[i+1];
  const intervalo=proximo?dem52hTlIntervalo(dia,proximo):'';
  const tipo=g.s.length&&g.d.length?'ambos':g.s.length?'servico':'pedido';
  const nomes=dem52hTlNomes(g);
  const contadores=[g.s.length?`<span class="dem52h-tl-cont-servico">${dem52hTlPlural(g.s.length,'serviço','serviços')}</span>`:'',
                    g.d.length?`<span class="dem52h-tl-cont-pedido">${dem52hTlPlural(g.d.length,'solicitação','solicitações')}</span>`:''].join('');
  return `${cabecalhoMes}<div class="dem52h-tl-item" data-h-tl-tipo="${tipo}">
   <details class="dem52h-dia-card" data-h-dia="${dem52hEsc(dia)}" ${diasAbertos.has(dia)?'open':''}>
    <summary class="dem52h-dia-summary"><span class="dem52h-tl-quando"><span class="dem52h-dia-summary-titulo">${dia==='sem-data'?'Data não informada':dem52Data(dia)}</span>${dia==='sem-data'?'':`<span class="dem52h-tl-semana">${dem52hTlSemana(dia)}</span>`}</span>
      <span class="dem52h-tl-previa">${dem52hEsc(nomes)}</span>
      <span class="dem52h-dia-summary-contadores">${contadores}</span>
      <span class="dem52h-dia-summary-seta" aria-hidden="true">⌄</span>
    </summary>
    <div class="dem52h-dia-conteudo"><p>Registros disponíveis para esta data: ${total}. As datas de recebimento e execução são fatos diferentes; sua coincidência não cria vínculo.</p>
      ${blocos}</div>
   </details>${intervalo?`<p class="dem52h-tl-intervalo">${dem52hEsc(intervalo)}</p>`:''}</div>`;
 }).join('');
 const casos=linhas.filter(l=>l.tipo==='c');
 const casosHtml=casos.length?`<details class="dem52h-casos-opcionais" ${casosAbertos?'open':''}>
   <summary>Casos de acompanhamento <small>${casos.length} caso(s)</small></summary>
   <div class="dem52h-casos-secao">${casos.map(l=>`<article class="dem52h-dia-evento"><header><strong>${dem52hEsc(l.row.codigo||l.row.titulo||'Caso')}</strong>${dem52hTag(l)}</header><p>${dem52hEsc(l.row.titulo||'')}</p><dl class="dem52-meta dem52h-meta">${dem52hLinha('Endereço',dem52Endereco(l.row))}${dem52hLinha('Gerência',l.row.gerencia)}${dem52hLinha('Abertura',dem52Data(dem52hDia(l.row.created_at)))}${dem52hLinha('Vistoria',dem52Data(l.row.data_vistoria))}${dem52hLinha('Conclusão',dem52Data(l.row.data_conclusao))}</dl><p class="dem52h-vinculo-nota">${(a=>`${a.texto} · ${a.relatorio}`)(dem52hArquivos(l.row))}</p><button type="button" class="btn btn-ghost" data-h-caso="${dem52hEsc(l.row.id)}">Abrir caso e arquivos</button></article>`).join('')}</div>
   </details>`:'';
 const vazio=ocorrencias.length?'':`<p class="dem52h-tipo-vazio">${filtros?'Nenhuma solicitação ou execução com os filtros aplicados.':'Nenhuma solicitação recebida ou serviço executado disponível para esta rua.'}</p>`;
 anterior.innerHTML=`<section class="dem52h-timeline" aria-label="Histórico por data">
  <header class="dem52h-timeline-head"><h3>Histórico por data</h3><span>${datas.length} dia(s) · ${ocorrencias.length} registro(s)</span></header>
  <p class="dem52h-timeline-instrucao">Linha do tempo da data mais recente para a mais antiga. Abra um dia para ver os serviços e as solicitações organizados por número ou trecho, sem precisar informar o número na busca.</p>
  ${diasHtml?`<p class="dem52h-tl-legenda" aria-hidden="true"><span data-h-tl-tipo="servico">Serviço executado</span><span data-h-tl-tipo="pedido">Solicitação recebida</span><span data-h-tl-tipo="ambos">Os dois no mesmo dia</span></p><div class="dem52h-tl">${diasHtml}</div>`:''}${vazio}
 </section>${casosHtml}`;
 dem52hEl('contagem').textContent=ocorrencias.length?`${visiveis.length} de ${datas.length} data(s) · ${ocorrencias.length} ocorrência(s) disponível(is)${filtros?' com os filtros aplicados':''}`:'Nenhum pedido ou serviço com esses filtros';
 dem52hEl('mais').hidden=visiveis.length>=datas.length;
 dem52hEl('mais').textContent='Mostrar mais datas';
}

function dem52hLinha(nome,valor){return `<div><dt>${nome}</dt><dd>${dem52hEsc(valor||'Não informado')}</dd></div>`;}
function dem52hDemandaDetalhe(d){
 return `<article class="dem52h-vinculo"><header><strong>${dem52hEsc(d.origem?.nome||'Origem não informada')} · ${dem52hEsc(d.protocolo||'Sem protocolo')}</strong>${dem52hTag({tipo:'d',row:d})}</header><p>${dem52hEsc(d.assunto)}</p><dl class="dem52-meta dem52h-meta">${dem52hLinha('Endereço',dem52Endereco(d))}${dem52hLinha('Gerência',d.gerencia)}${dem52hLinha('Recebimento',dem52Data(d.data_recebimento))}${dem52hLinha('Serviço',d.servico?.nome)}${dem52hLinha('Solicitante',d.solicitante)}${dem52hLinha('Prazo',dem52Data(d.prazo))}${dem52hLinha('Coordenadas',d.latitude!=null&&d.longitude!=null?d.latitude+', '+d.longitude:null)}</dl>${d.observacao?`<p class="dem52-observacao">${dem52hEsc(d.observacao)}</p>`:''}${d.deleted_at?`<p>Arquivamento: ${dem52hEsc(d.motivo_arquivamento||'Motivo não informado')}</p>`:''}</article>`;
}
function dem52hCasoRelacionado(c){return `<article class="dem52h-vinculo"><header><strong>${dem52hEsc(c.codigo)}</strong>${dem52hTag({tipo:'c',row:c})}</header><p>${dem52hEsc(c.titulo)}</p><p>${dem52hEsc(dem52Endereco(c))}</p>${c.logradouro_normalizado!==dem52h.grupo.chave?'<p>O endereço atual deste caso está em outro logradouro. Ele aparece aqui pelo vínculo já registrado com a demanda.</p>':''}${!c.deleted_at?`<button type="button" class="btn btn-ghost" data-h-caso="${dem52hEsc(c.id)}">Abrir caso e arquivos</button>`:'<p>Caso arquivado · consulta histórica.</p>'}</article>`;}
function dem52hDetalhe(chave){
 if(!dem52Pode()||!dem52h.dados)return;
 const l=dem52h.linhas.find(x=>x.chave===chave);if(!l||!(l.tipo==='s'?dem52hServicoVisivel(l.row):dem52hEscopo(l.row.gerencia)))return;
 dem52h.selecionada=chave;const r=l.row,area=dem52hEl('detalhe');
 let corpo='';
 if(l.tipo==='s'){
  const ds=dem52hDemandasExecucao(r);
  corpo=`<p class="dem52h-detalhe-end">${dem52hEsc(dem52Endereco(r))}</p>
  <dl class="dem52-meta dem52h-meta">${dem52hLinha('Modalidade',DEM52H_MODALIDADES[r.modalidade]||r.modalidade)}${dem52hLinha('Descrição original',r.servico_original)}${dem52hLinha('Data da execução',r.data_execucao?dem52Data(r.data_execucao):'Não informada')}${dem52hLinha('Gerência executora',r.gerencia)}${r.gerencia_territorial?dem52hLinha('Território (R3)',r.gerencia_territorial):''}${r.gerencia_territorial&&r.gerencia!==r.gerencia_territorial?dem52hLinha('Apoio entre Gerências','Serviço executado pela '+r.gerencia+' em apoio à '+r.gerencia_territorial):''}${dem52hLinha('Bairro / sub-bairro',[r.bairro,r.sub_bairro].filter(Boolean).join(' / '))}${dem52hLinha('Fonte',r.fonte_nome)}${dem52hLinha('Origem do registro',r.fonte_tipo)}</dl>
  <h3>Demandas vinculadas e validadas (${ds.length})</h3>${ds.length?ds.map(dem52hDemandaDetalhe).join(''):'<p>Nenhuma demanda vinculada e validada no seu acesso. Isso não significa que não houve solicitação nesta rua.</p>'}`;
 }else if(l.tipo==='d'){
  const casos=dem52hCasosDemanda(r);corpo=dem52hDemandaDetalhe(r)+`<h3>Casos associados</h3>${casos.length?casos.map(dem52hCasoRelacionado).join(''):'<p>Nenhum caso associado disponível no seu acesso.</p>'}`;
 }else{
  const ds=dem52hDemandasCaso(r),ar=dem52hArquivos(r);
  corpo=`<p class="dem52h-detalhe-end">${dem52hEsc(dem52Endereco(r))}</p><dl class="dem52-meta dem52h-meta">${dem52hLinha('Tipo de serviço',r.servico?.nome)}${dem52hLinha('Gerência',r.gerencia)}${dem52hLinha('Bairro / sub-bairro',[r.bairro,r.sub_bairro].filter(Boolean).join(' / '))}${dem52hLinha('Coordenadas',r.latitude!=null&&r.longitude!=null?r.latitude+', '+r.longitude:null)}${dem52hLinha('Abertura',dem52Data(dem52hDia(r.created_at)))}${dem52hLinha('Vistoria',dem52Data(r.data_vistoria))}${dem52hLinha('Programação',dem52Data(r.data_programacao))}${dem52hLinha('Início da execução',dem52Data(r.data_inicio_execucao))}${dem52hLinha('Conclusão',dem52Data(r.data_conclusao))}</dl>${r.diagnostico?`<h3>Diagnóstico</h3><p class="dem52-observacao">${dem52hEsc(r.diagnostico)}</p>`:''}${r.proxima_acao?`<h3>Próxima ação</h3><p class="dem52-observacao">${dem52hEsc(r.proxima_acao)}</p>`:''}${r.deleted_at?`<p>Arquivamento: ${dem52hEsc(r.motivo_arquivamento||'Motivo não informado')}</p>`:''}
  <section class="dem52h-arquivos"><h3>Fotos e documentos do caso</h3><p>${ar.texto}${ar.e?` · ${ar.e.filter(e=>e.mime_type==='application/pdf').length} PDF(s) · ${ar.e.filter(e=>e.tipo==='bds').length} BDS` :''}</p><p>Os arquivos permanecem associados a este caso. Consulte fotos, PDFs, BDS e documentos na biblioteca do caso.</p>${!r.deleted_at?`<button type="button" class="btn btn-primary" data-h-caso="${dem52hEsc(r.id)}">Abrir caso e arquivos</button>`:'<p>Caso arquivado: as referências são apenas para consulta.</p>'}<h3>Relatórios fotográficos</h3>${ar.r?(ar.r.length?ar.r.map(rel=>`<article class="dem52h-vinculo"><strong>${dem52hEsc(rel.codigo||rel.titulo||'Relatório')}</strong><p>${dem52hEsc(rel.titulo)} · ${dem52Data(rel.data_relatorio)} · ${dem52hEsc(rel.status)}</p></article>`).join(''):'<p>Nenhum relatório associado. A emissão de relatórios será disponibilizada em uma próxima etapa.</p>'):'<p>Não foi possível consultar os relatórios.</p>'}</section>
  <h3>Demandas vinculadas (${ds.length})</h3>${ds.length?ds.map(dem52hDemandaDetalhe).join(''):'<p>Nenhuma demanda vinculada disponível.</p>'}`;
 }
 area.innerHTML=`<header class="dem52h-detalhe-head"><button type="button" class="btn btn-ghost" data-h-acao="voltar">← Voltar às ocorrências</button><div><div class="dem52-eyebrow">${l.tipo==='s'?'Serviço executado':l.tipo==='c'?'Caso operacional':'Demanda'}</div><h2 id="dem52h-detalhe-titulo" tabindex="-1">${dem52hEsc(l.tipo==='s'?dem52hNomeServico(r):l.tipo==='c'?r.codigo:(r.protocolo||'Sem protocolo'))}</h2><p>${dem52hEsc(l.tipo==='s'?(DEM52H_MODALIDADES[r.modalidade]||r.modalidade):(r.titulo||r.assunto))}</p></div><span>${dem52hTag(l)}</span></header><div class="dem52h-detalhe-corpo">${corpo}</div>`;
 area.hidden=false;dem52hRenderLista();dem52hEl('detalhe-titulo').focus({preventScroll:true});area.scrollIntoView({block:'start'});
}
function limparHistoricoLogradouroAP52(){
 dem52h.controle?.abort();dem52h.consulta++;dem52h.controle=null;dem52h.ocupado=false;dem52h.grupos=[];dem52h.grupo=null;dem52h.dados=null;dem52h.linhas=[];dem52h.selecionada=null;dem52h.filtros={};dem52h.termo='';dem52h.pgRuas=0;
 if(!dem52hEl('area'))return;dem52hEl('busca').reset();dem52hEl('ruas').replaceChildren();dem52hEl('resultado').replaceChildren();dem52hEl('resultado').hidden=true;dem52hEl('inicio').hidden=false;dem52hEl('area').hidden=true;dem52hEl('area').removeAttribute('aria-busy');dem52hEl('buscar').disabled=false;dem52hAviso('');
}
dem52hMontar();
