/* AP5.2 v65.42.156.4.12.5.4.2 — busca por protocolo oficial OU código histórico de importação, sem alterar dados.
   v65.42.156.4.7.2 — junção: "recalque" sugere Afundamento ("assentamento" não) + aviso de praça da outra frente (156.4.7.1).
   v65.42.156.4.6.2 — "Praça" deixa de ser sugerido como tipo de serviço (aviso no card).
   v65.42.156.4.6.1 — Sugestão do tipo de serviço por palavras-chave (só quando aponta para um único tipo).
   v65.42.156.4.6 — Tipo de serviço dos históricos: sugestão não confirmada / A classificar.
   v65.42.156.4.3 — Atalho para Históricas no estado vazio da Central.
   v65.42.156.4.2 — Central de Demandas: separacao operacional entre acervo atual e historico (6.6F).
   v65.42.156.4.1 — o filtro "Origem" passa a listar também origens inativas (ex.: "Origem não informada" das solicitações antigas). O cadastro continua só com as ativas.
   A autorização dos dados permanece nas políticas RLS do Supabase. */
'use strict';
const DEM52_STATUS={recebida:'Recebida',em_triagem:'Em triagem',vinculada_a_caso:'Vinculada a caso',aguardando_resposta:'Aguardando resposta',respondida:'Respondida',encerrada:'Encerrada',fora_da_competencia:'Fora da competência',duplicada:'Duplicada'};
const DEM52_UNIDADES=['21ª GC','22ª GC','23ª GC','24ª GC','25ª GC','AP5.2'];
const DEM52_BUSCA={protocolo:'Protocolo / código',logradouro:'Logradouro',assunto:'Assunto',solicitante:'Solicitante'};
const DEM52_COLUNAS='id,gerencia,protocolo,data_recebimento,solicitante,assunto,logradouro,numero,trecho_referencia,bairro,sub_bairro,prazo,status,observacao,origem_migracao,id_origem_migracao,tipo_servico_id,origem:demanda_origens(nome),servico:demanda_tipos_servico(nome),created_by';
const DEM52_TAMANHO=25;
const DEM52_PENDENCIAS_HISTORICAS=new Set(['recebida','em_triagem','vinculada_a_caso','aguardando_resposta']);
let dem52Acervo='todas'; // 4.10: consulta inicial conjunta. Escolhas posteriores permanecem na sessão.
let dem52TemHistoricasNoEscopo=false; // Confirmado por consulta count/head, sujeito a RLS e ao escopo da gerencia.
function dem52Historica(d){return !!d?.origem_migracao;}
// Sugestão do tipo de serviço pelo assunto, apenas para leitura e confirmação humana.
// Não grava classificações e não altera o assunto original.
// v65.42.156.4.6.1: palavras-chave por tipo do catálogo; só sugere quando o assunto aponta para UM único tipo.
// Pedido composto (ex.: "TAPA BURACO E REPOSIÇÃO DE GRELHA") ou sem palavra conhecida continua "A classificar".
const DEM52_SUGESTOES_SERVICO=[
 ['Tapa-buraco',/\bTAPA[- ]?BURACOS?\b|\bBURACOS? NA VIA\b/],
 // "Recalque" é o termo técnico de afundamento. "Assentamento" NÃO entra: nos pedidos significa colocar/instalar
 // (assentamento de intertravados, de rede, reassentamento de meio-fio). Decisão de Daniel, 15/10/2026.
 ['Afundamento',/\bAFUNDAMENTOS?\b|\bRECALQUES?\b/],
 ['Recapeamento',/\bRECAPEAMENTO\b/],
 ['Drenagem',/\bGRELHAS?\b|\bTAMPAO\b|\bTAMPOES\b|\bGAP\b|\bRALOS?\b|\bBOCAS? DE LOBO\b|\bDESOBS?TRUCAO\b|\bPV\b|\bRAMAL\b|\bCANALETAS?\b|\bVACC?-ALL\b/],
 ['Calçada',/\bCALCADAS?\b|\bMEIO-FIO\b|\bRAMPAS?\b|\bINTERTRAVADOS?\b/]
];
// v65.42.156.4.6.2: "Praça" não é sugerido. Praças é outro contrato; nos pedidos antigos a palavra costuma
// descrever o local de um serviço do dia a dia. O card mostra o aviso para informar o serviço feito de fato.
function dem52SugestaoServico(assunto){
 const nome=String(assunto||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
 if(!nome)return '';
 const tipos=DEM52_SUGESTOES_SERVICO.filter(([,regra])=>regra.test(nome)).map(([tipo])=>tipo);
 return tipos.length===1?tipos[0]:'';
}

function dem52PossivelRepetida(d){return dem52Historica(d)&&/Possível repetição:/i.test(String(d?.observacao||''));}
function dem52TagHistorico(d){return dem52Historica(d)?`<span class="dem52-acervo-tag">Histórica</span>`:'';}

let dem52={itens:[],total:0,pagina:0,selecionada:null,origens:null,consulta:0,ocupado:false,foco:null,filtros:null,confirmado:null};
function dem52El(id){return document.getElementById('dem52-'+id);}
function dem52Texto(v){return escapar(String(v??''));}
function dem52Data(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:'Não informado';}
function dem52Endereco(d){return [d.logradouro,d.numero?'nº '+d.numero:'',d.trecho_referencia].filter(Boolean).join(' · ');}
// .or() recebe sintaxe PostgREST crua: valores entre aspas e caracteres de controle escapados.
// % e _ fornecidos pelo usuário são literais; os % externos realizam a busca parcial.
function dem52FiltroProtocolo(termo){
 const padrao='%'+String(termo).replace(/[\\%_]/g,'\\$&')+'%';
 const literal='"'+padrao.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
 return 'protocolo.ilike.'+literal+',id_origem_migracao.ilike.'+literal;
}
function dem52Global(){return acesso28?.user?.scope==='global';}
function dem52Escopo(){return dem52Global()?'Toda a AP5.2':(acesso28?.user?.gerencia||'Unidade não definida');}
function dem52Pode(){return !!acesso28&&!acesso28.legacy&&pode28('demandas');}
function dem52Montar(){
 const view=document.createElement('section');view.id='view-demandas';view.className='view';view.style.display='none';
 view.innerHTML=`<div class="crumbs"><b>AP5.2</b> / Demandas</div>
 <header class="dem52-head"><div><div class="dem52-eyebrow">Controle operacional</div><h1>Central de Demandas</h1><p>Consulte as solicitações recebidas e acompanhe cada protocolo da sua unidade.</p></div><span id="dem52-escopo" class="dem52-scope"></span></header>
 <div class="dem52-layout"><div class="dem52-principal">
 <form id="dem52-filtros" class="dem52-panel dem52-filters" role="search" aria-label="Filtrar demandas">
 <div class="dem52-acervo" role="group" aria-label="Acervo de solicitações"><span class="dem52-acervo-label">Consultar</span><div class="dem52-acervo-botoes"><button type="button" class="dem52-acervo-botao" data-dem52-acervo="atuais" aria-pressed="false">Demandas atuais</button><button type="button" class="dem52-acervo-botao" data-dem52-acervo="historicas" aria-pressed="false">Históricas</button><button type="button" class="dem52-acervo-botao" data-dem52-acervo="todas" aria-pressed="true">Todas</button></div></div>
 <div class="dem52-search"><label>Buscar em<select id="dem52-campo">${Object.entries(DEM52_BUSCA).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="dem52-search-text">Termo de busca<input type="search" id="dem52-busca" maxlength="150" placeholder="Protocolo ou código histórico (ex.: D21-PRE-0002)" autocomplete="off"></label></div>
 <div class="dem52-filter-row"><label>Gerência<select id="dem52-gerencia"></select></label><label>Origem<select id="dem52-origem"><option value="">Todas as origens</option></select></label><label>Situação<select id="dem52-status"><option value="">Todas as situações</option>${Object.entries(DEM52_STATUS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label></div>
 <div class="dem52-filter-actions"><button type="button" id="dem52-limpar" class="btn btn-ghost">Limpar filtros</button><button type="submit" class="btn btn-primary">Buscar demandas</button></div></form>
 <section class="dem52-panel" aria-labelledby="dem52-lista-titulo"><header class="dem52-list-head"><div><h2 id="dem52-lista-titulo">Demandas recebidas</h2><p id="dem52-contagem" aria-live="polite"></p></div><button type="button" id="dem52-atualizar" class="btn btn-ghost">Atualizar</button></header>
 <div id="dem52-acervo-aviso" class="dem52-acervo-aviso" hidden></div><div id="dem52-aviso" class="dem52-notice" role="status" hidden></div><div id="dem52-lista" aria-live="polite"></div>
 <nav id="dem52-paginacao" class="dem52-pagination" aria-label="Páginas de demandas" hidden><button type="button" id="dem52-anterior" class="btn btn-ghost">← Anterior</button><span id="dem52-pagina"></span><button type="button" id="dem52-proxima" class="btn btn-ghost">Próxima →</button></nav></section></div>
 <aside class="dem52-panel dem52-context" aria-labelledby="dem52-contexto-titulo"><header class="dem52-list-head"><h2 id="dem52-contexto-titulo" tabindex="-1">Consulta da demanda</h2><button type="button" id="dem52-fechar" class="btn btn-ghost" hidden>Voltar à lista</button></header><div id="dem52-contexto" class="dem52-context-body"></div></aside></div>`;
 document.querySelector('#app-shell>.main').append(view);
 dem52El('filtros').addEventListener('submit',e=>{e.preventDefault();carregarDemandasAP52(false,true);});
 view.querySelectorAll('[data-dem52-acervo]').forEach(b=>b.addEventListener('click',()=>{
   if(dem52.ocupado||b.dataset.dem52Acervo===dem52Acervo)return;
   dem52Acervo=b.dataset.dem52Acervo;dem52SincronizarAcervo();carregarDemandasAP52(false,true);
 }));
 dem52El('campo').addEventListener('change',()=>{dem52El('busca').placeholder=({protocolo:'Protocolo ou código histórico (ex.: D21-PRE-0002)',logradouro:'Digite o logradouro',assunto:'Digite o assunto',solicitante:'Digite o solicitante'})[dem52El('campo').value];});
 dem52El('limpar').addEventListener('click',()=>{dem52El('filtros').reset();dem52TemHistoricasNoEscopo=false;dem52SincronizarAcervo();dem52PrepararEscopo();dem52El('campo').dispatchEvent(new Event('change'));carregarDemandasAP52(false,true);});
 dem52El('atualizar').addEventListener('click',()=>carregarDemandasAP52(true,true));
 dem52El('anterior').addEventListener('click',()=>{if(dem52.pagina>0&&!dem52.ocupado){dem52.pagina--;carregarDemandasAP52();}});
 dem52El('proxima').addEventListener('click',()=>{if(!dem52.ocupado&&(dem52.pagina+1)*DEM52_TAMANHO<dem52.total){dem52.pagina++;carregarDemandasAP52();}});
 dem52El('fechar').addEventListener('click',()=>{dem52.selecionada=null;dem52Render();dem52.foco?.focus({preventScroll:true});dem52.foco?.scrollIntoView({block:'nearest'});});
}
function dem52SincronizarAcervo(){
 document.querySelectorAll('#view-demandas [data-dem52-acervo]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dem52Acervo===dem52Acervo)));
 const info=dem52El('acervo-aviso');if(!info)return;
 info.hidden=dem52Acervo!=='historicas';
 if(!info.hidden)info.textContent='Acervo histórico (2025–2026): registros importados para conferência. Situações recebida e em triagem não comprovam pendência atual. Possíveis repetidos permanecem separados. Este acervo não integra a lista padrão de demandas atuais.';
}
function dem52PrepararEscopo(){
 const el=dem52El('gerencia'),atual=el.value;dem52El('escopo').textContent=dem52Escopo();
 el.innerHTML=dem52Global()?'<option value="">Toda a AP5.2</option>'+DEM52_UNIDADES.map(g=>`<option value="${g}">${g}</option>`).join(''):`<option value="${dem52Texto(acesso28?.user?.gerencia||'')}">${dem52Texto(dem52Escopo())}</option>`;
 el.disabled=!dem52Global();if(dem52Global()&&DEM52_UNIDADES.includes(atual))el.value=atual;
}
async function carregarDemandasAP52(atualizarOrigens=false,aplicarFiltros=false){
 if(!dem52Pode())return;
 dem52PrepararEscopo();
 if(aplicarFiltros||!dem52.filtros){dem52.pagina=0;dem52.filtros={acervo:dem52Acervo,gerencia:dem52El('gerencia').value,status:dem52El('status').value,origem:dem52El('origem').value,termo:dem52El('busca').value.trim(),campo:dem52El('campo').value};}
 const filtros=dem52.filtros;dem52SincronizarAcervo();const consulta=++dem52.consulta,generation=ac28Generation;dem52.ocupado=true;dem52.selecionada=null;dem52.itens=[];
 document.getElementById('view-demandas').setAttribute('aria-busy','true');dem52El('contagem').textContent='Carregando…';dem52El('lista').innerHTML='<div class="dem52-empty">Consultando demandas…</div>';dem52El('aviso').hidden=true;dem52El('paginacao').hidden=true;dem52El('atualizar').disabled=true;dem52RenderContexto();
 const valido=()=>consulta===dem52.consulta&&generation===ac28Generation&&dem52Pode();
 try{
  let q=sb.from('demandas').select(DEM52_COLUNAS,{count:'exact'}).is('deleted_at',null);
  if(filtros.acervo==='atuais')q=q.is('origem_migracao',null);
  else if(filtros.acervo==='historicas')q=q.not('origem_migracao','is',null);
  const gc=dem52Global()?filtros.gerencia:acesso28.user.gerencia;
  if(gc)q=q.eq('gerencia',gc);else if(!dem52Global())throw Error('Unidade não definida.');
  const {status,origem,termo,campo}=filtros;
  if(status&&Object.hasOwn(DEM52_STATUS,status))q=q.eq('status',status);
  if(origem)q=q.eq('origem_id',origem);
  // v65.42.156.4.11.2 — Busca de logradouro como no Mapa das Gerências:
  // ignora acentos e diferenças de maiúsculas/pontuação, e aceita Rua/R./Av./Estr. como prefixo.
  // O banco já mantém logradouro_normalizado; filtragem, paginação e RLS continuam no servidor.
  if(termo&&Object.hasOwn(DEM52_BUSCA,campo)){
   if(campo==='protocolo'){
    // Protocolo oficial e código de importação compartilham o mesmo filtro.
    // O OR permanece dentro da consulta a demandas: RLS, acervo, gerência,
    // situação, origem, contagem e paginação continuam aplicados no servidor.
    q=q.or(dem52FiltroProtocolo(termo));
   }else{
    const campoSql=campo==='logradouro'?'logradouro_normalizado':campo;
    const textoBusca=campo==='logradouro'
     ?normalizarTextoBuscaMapa(tipoLogradouroSemPrefixoMapa(termo))||termo
     :termo;
    q=q.ilike(campoSql,'%'+textoBusca.replace(/[\\%_]/g,'\\$&')+'%');
   }
  }
  const inicio=dem52.pagina*DEM52_TAMANHO;
  q=q.order('data_recebimento',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(inicio,inicio+DEM52_TAMANHO-1);
  const catalogo=dem52.origens&&!atualizarOrigens?Promise.resolve({data:dem52.origens,error:null}):sb.from('demanda_origens').select('id,nome').is('deleted_at',null).order('ordem').order('nome'); // 156.4.1: o FILTRO inclui origens inativas (ex.: "Origem não informada" das solicitações antigas); o cadastro continua só com as ativas
  const [res,cat]=await Promise.all([q,catalogo]);if(!valido())return;
  if(res.error)throw res.error;
  if(cat.error){dem52El('aviso').hidden=false;dem52El('aviso').textContent='O filtro de origens não pôde ser atualizado. As demandas foram consultadas.';}
  else{dem52.origens=cat.data||[];const anterior=dem52El('origem').value;dem52El('origem').innerHTML='<option value="">Todas as origens</option>'+dem52.origens.map(o=>`<option value="${dem52Texto(o.id)}">${dem52Texto(o.nome)}</option>`).join('');dem52El('origem').value=anterior;}
  if(!Array.isArray(res.data)||!Number.isSafeInteger(res.count))throw Error('Resposta incompleta.');
  dem52.itens=res.data;dem52.total=res.count;
  if(dem52.pagina>0&&!dem52.itens.length){dem52.pagina=Math.max(0,Math.ceil(dem52.total/DEM52_TAMANHO)-1);return await carregarDemandasAP52();}
  // Atalho apenas quando não há demandas atuais no escopo consultado, sem filtros
  // restritivos, e existe ao menos um registro histórico visível pela mesma RLS.
  dem52TemHistoricasNoEscopo=false;
  if(filtros.acervo==='atuais'&&dem52.total===0&&!status&&!origem&&!termo){
   let historicas=sb.from('demandas').select('id',{count:'exact',head:true}).is('deleted_at',null).not('origem_migracao','is',null);
   if(gc)historicas=historicas.eq('gerencia',gc);
   const contagemHistoricas=await historicas;
   if(!valido())return;
   // Em caso de falha da consulta complementar, conservar o estado vazio padrão.
   dem52TemHistoricasNoEscopo=!contagemHistoricas.error&&Number.isSafeInteger(contagemHistoricas.count)&&contagemHistoricas.count>0;
  }
  dem52Render();
 }catch(e){if(!valido())return;dem52.itens=[];dem52.total=0;dem52El('contagem').textContent='Consulta indisponível';dem52El('lista').innerHTML='<div class="dem52-empty dem52-error"><strong>Não foi possível carregar as demandas.</strong><p>Verifique a conexão e use Atualizar para tentar novamente.</p></div>';dem52RenderContexto();console.error('Falha na consulta de Demandas:',e?.code||'consulta');}
 finally{if(valido()){dem52.ocupado=false;document.getElementById('view-demandas').removeAttribute('aria-busy');dem52El('atualizar').disabled=false;dem52El('anterior').disabled=dem52.pagina===0;dem52El('proxima').disabled=(dem52.pagina+1)*DEM52_TAMANHO>=dem52.total;}}
}
function dem52Render(){
 const n=dem52.total,inicio=dem52.pagina*DEM52_TAMANHO;dem52El('contagem').textContent=n?`${inicio+1}–${inicio+dem52.itens.length} de ${n} ${n===1?'demanda':'demandas'}`:'Nenhuma demanda nesta consulta';
 if(!dem52.itens.length){
  const f=dem52.filtros||{},lista=dem52El('lista');
  const vazio=document.createElement('div');vazio.className='dem52-empty dem52-help-empty';
  const icone=document.createElement('span');icone.className='dem52-empty-icon';icone.setAttribute('aria-hidden','true');icone.textContent='≡';vazio.append(icone);
  const titulo=document.createElement('strong'),mensagem=document.createElement('p');
  const rotulo={atuais:'Demandas atuais',historicas:'Históricas',todas:'Todas'}[f.acervo]||'Todas';
  // Termo pesquisado entra exclusivamente por textContent; nunca por HTML interpolado.
  if(f.termo){titulo.textContent=`Nenhum pedido encontrado com "${f.termo}" em ${rotulo}.`;}
  else if(f.acervo==='atuais'&&!f.status&&!f.origem){
   titulo.textContent=dem52TemHistoricasNoEscopo
    ?'Nenhum pedido foi cadastrado pelo site ainda. Os pedidos antigos estão em Históricas.'
    :'Nenhum pedido foi cadastrado pelo site ainda. Para registrar um pedido, use + Nova demanda.';
  }
  else if((f.acervo==='historicas'||f.acervo==='todas')&&!f.status&&!f.origem){
   titulo.textContent='Os pedidos antigos desta gerência ainda não foram trazidos para o site.';
  }
  else{titulo.textContent=`Nenhum pedido disponível em ${rotulo} com os filtros selecionados.`;}
  vazio.append(titulo);
  if(f.termo){mensagem.textContent=f.campo==='protocolo'?'Dica: você pode buscar pelo protocolo ou pelo código histórico de importação (ex.: D21-PRE-0002).':'Dica: busque pelo nome ou por uma palavra da rua, com ou sem acento. Ex.: Glicina ou Av. Glicina.';vazio.append(mensagem);}
  const destino=f.termo&&f.acervo!=='todas'?'todas':(!f.termo&&f.acervo==='atuais'&&!f.status&&!f.origem&&dem52TemHistoricasNoEscopo?'historicas':null);
  if(destino){const botao=document.createElement('button');botao.type='button';botao.className='btn btn-primary dem52-atalho-historicas';botao.textContent=destino==='todas'?'Buscar em Todas':'Ver Históricas';
   botao.addEventListener('click',()=>{if(dem52.ocupado)return;dem52Acervo=destino;dem52SincronizarAcervo();void carregarDemandasAP52(false,true);});vazio.append(botao);}
  lista.replaceChildren(vazio);
 }

 else{dem52El('lista').innerHTML=dem52.itens.map(d=>`<button type="button" class="dem52-row" data-dem52-id="${dem52Texto(d.id)}" aria-pressed="${d.id===dem52.selecionada}"><span class="dem52-row-top"><span class="dem52-origin">${dem52Texto(d.origem?.nome||'Origem não informada')} <span>· ${dem52Texto(d.protocolo||'Sem protocolo')}${dem52Historica(d)&&d.id_origem_migracao?' · Código histórico: '+dem52Texto(d.id_origem_migracao):''}</span>${dem52TagHistorico(d)}${dem52PossivelRepetida(d)?'<span class="dem52-duplicidade-tag">Possível repetição</span>':''}</span><span class="dem52-tag" data-status="${dem52Texto(d.status)}">${dem52Texto(DEM52_STATUS[d.status]||'Situação não informada')}</span></span><strong>${dem52Texto(d.assunto)}</strong><span class="dem52-address">${dem52Texto(dem52Endereco(d))}</span><span class="dem52-row-bottom"><span>${dem52Texto(d.gerencia)}${d.bairro?' · '+dem52Texto(d.bairro):''}</span><span>Recebida em ${dem52Data(d.data_recebimento)}</span></span></button>`).join('');dem52El('lista').querySelectorAll('[data-dem52-id]').forEach(btn=>btn.addEventListener('click',()=>{dem52.selecionada=btn.dataset.dem52Id;dem52Render();dem52.foco=dem52El('lista').querySelector('[aria-pressed="true"]');if(matchMedia('(max-width:1100px)').matches){dem52El('contexto-titulo').focus({preventScroll:true});dem52El('contexto-titulo').scrollIntoView({block:'start',behavior:'auto'});}}));}
 dem52El('paginacao').hidden=n<=DEM52_TAMANHO;dem52El('pagina').textContent=`Página ${dem52.pagina+1} de ${Math.max(1,Math.ceil(n/DEM52_TAMANHO))}`;dem52RenderContexto();
}
function dem52RenderContexto(){
 if(typeof dem52cSincronizar==='function')dem52cSincronizar();
 if(typeof dem52RenderContextoCadastro==='function'&&dem52RenderContextoCadastro())return;
 if(typeof dem52RenderContextoCasos==='function'&&dem52RenderContextoCasos())return;
 const d=(dem52.confirmado?.id===dem52.selecionada?dem52.confirmado:null)||dem52.itens.find(x=>x.id===dem52.selecionada);dem52El('fechar').hidden=!d;dem52El('contexto-titulo').textContent=d?'Detalhes da demanda':'Consulta da demanda';
 if(!d){dem52El('contexto').innerHTML=`<div class="dem52-context-intro"><div class="dem52-eyebrow">${dem52Texto(dem52Escopo())}</div><h3>Cada protocolo, uma demanda</h3><p>Selecione uma solicitação na lista para consultar seus dados e seu prazo.</p></div><div class="dem52-help"><h3>Demanda e Caso Operacional</h3><p>A demanda é o documento ou pedido recebido. O Caso Operacional reúne o problema no local, a execução e suas evidências.</p><p>Diferentes protocolos podem tratar do mesmo serviço. A resposta de cada solicitação continua sendo acompanhada individualmente.</p></div><p class="dem52-sei">Os processos administrativos continuam registrados no SEI.</p>`;return;}
 const linha=(label,value)=>`<div><dt>${label}</dt><dd>${dem52Texto(value||'Não informado')}</dd></div>`;
 const advertencia=dem52Historica(d)?`<div class="dem52-context-historico"><strong>${DEM52_PENDENCIAS_HISTORICAS.has(d.status)?'Pendência histórica — a conferir':'Solicitação histórica — acervo'}</strong><p>Registro recuperado de planilha antiga. Não presumir pendência atual nem atendimento por serviço executado.</p>${dem52PossivelRepetida(d)?'<p><strong>Possível repetição documental.</strong> Preservar os dois registros até a avaliação da Gerência.</p>':''}</div>`:'';
 dem52El('contexto').innerHTML=`${advertencia}<span class="dem52-tag" data-status="${dem52Texto(d.status)}">${dem52Texto(DEM52_STATUS[d.status]||'Situação não informada')}</span><h3 class="dem52-detail-title">${dem52Texto(d.assunto)}</h3><dl class="dem52-meta">${linha('Protocolo',d.protocolo)}${dem52Historica(d)&&d.id_origem_migracao?linha('Código histórico',d.id_origem_migracao):''}${linha('Origem',d.origem?.nome)}${linha('Gerência',d.gerencia)}${linha('Recebimento',dem52Data(d.data_recebimento))}${linha('Solicitante',d.solicitante)}${linha('Tipo de serviço',d.servico?.nome||(dem52Historica(d)?(dem52SugestaoServico(d.assunto)?dem52SugestaoServico(d.assunto)+' (sugestão não confirmada)':'A classificar'):'Não informado'))}${linha('Endereço',dem52Endereco(d))}${linha('Bairro / sub-bairro',[d.bairro,d.sub_bairro].filter(Boolean).join(' / '))}${linha('Prazo',dem52Data(d.prazo))}</dl>${d.observacao?`<div class="dem52-help"><h3>Observações</h3><p class="dem52-observacao">${dem52Texto(d.observacao)}</p></div>`:''}`;
 if(typeof dem52RenderCasosDaDemanda==='function')dem52RenderCasosDaDemanda(d);
}
function limparDemandasAP52(){
 window.AP52Demandas66g2?.clearAll?.(); // 4.12.4: remove modal no body e dados de sessão
 if(typeof limparHistoricoLogradouroAP52==='function')limparHistoricoLogradouroAP52();
 if(typeof limparCadastroDemandaAP52==='function')limparCadastroDemandaAP52();
 if(typeof limparCasosAP52==='function')limparCasosAP52();
 dem52.confirmado=null;
 dem52.consulta++;dem52.itens=[];dem52.total=0;dem52.pagina=0;dem52.selecionada=null;dem52.origens=null;dem52.ocupado=false;dem52.foco=null;dem52.filtros=null;dem52Acervo='todas';dem52SincronizarAcervo();
 dem52El('filtros')?.reset();if(dem52El('lista'))dem52El('lista').replaceChildren();if(dem52El('contexto'))dem52El('contexto').replaceChildren();if(dem52El('contagem'))dem52El('contagem').textContent='';if(dem52El('escopo'))dem52El('escopo').textContent='';
 if(dem52El('gerencia'))dem52El('gerencia').replaceChildren();if(dem52El('origem'))dem52El('origem').innerHTML='<option value="">Todas as origens</option>';
 document.getElementById('view-demandas')?.removeAttribute('aria-busy');document.getElementById('app-shell').classList.remove('demandas-layout-ativo');
}
dem52Montar();
