/* Consulta consolidada: usa integralmente o cruzamento existente. */
'use strict';
const asf64={usuario:null,area:'',gerencia:'',status:'',fonte:'',medicao:'',solicitante:'',pagina:1,filtrosAbertos:false};
const ASF64_SEM_IDENTIFICACAO='__sem_identificacao__';
// v65.42.148.8 — área de cada rua no Histórico (AP5.2, AP5.1 ou a confirmar).
const ASF64_AREAS=['AP5.2','AP5.1','A confirmar'];
function asf64RotuloArea(r){
 const area=String(r?.area||'A confirmar');
 if(area==='AP5.2')return `AP5.2 · ${r.gerencia||'Gerência não informada'}`;
 const rot=area==='A confirmar'?'Área a confirmar':area;
 return r.gerencia?`${rot} · ${r.gerencia}`:rot;
}
function asf64ResumoAreas(base){
 const n=a=>base.filter(r=>r.area===a).length;
 return `<p class="asf54-note asf64-areas">Por área: <strong>AP5.2</strong> ${n('AP5.2')} · <strong>AP5.1</strong> ${n('AP5.1')} · <strong>Área a confirmar</strong> ${n('A confirmar')}</p>`;
}
function asf64Sessao(){const u=sessaoAtual?.user?.id||null;if(u!==asf64.usuario)Object.assign(asf64,{usuario:u,area:'',gerencia:'',status:'',fonte:'',medicao:'',solicitante:'',pagina:1,filtrosAbertos:false});}
function asf64DataHistorica(r){
 const e=r.estado||asfEstadoConsolidadoFrente(r.frente||{logradouro:r.logradouro},{medida:!!r.medida,medicoes:r.medicoes||[]});
 return String(e.inicio||e.conclusao||'').slice(0,10);
}
function asf64Lista(base){
 const q=normalizarTextoBuscaMapa(asfaltinhoBusca||''),solicitanteBruto=String(asf64.solicitante||''),solicitante=normalizarTextoBuscaMapa(solicitanteBruto);
 return base.filter(r=>(!q||normalizarTextoBuscaMapa([r.logradouro,r.referencia,r.bairro,r.gerencia,r.fonte,r.status,r.estado?.solicitanteParlamentar].filter(Boolean).join(' ')).includes(q))&&(!solicitanteBruto||(solicitanteBruto===ASF64_SEM_IDENTIFICACAO?!asf64Solicitantes(r).length:asf64Solicitantes(r).some(nome=>normalizarTextoBuscaMapa(nome)===solicitante)))&&(!asf64.area||r.area===asf64.area)&&(!asf64.gerencia||r.gerencia===asf64.gerencia)&&(!asf64.status||r.status===asf64.status)&&(!asf64.fonte||(asf64.fonte==='medicao'?r.medida:!r.medida))&&(!asf64.medicao||r.medicoes.map(String).includes(asf64.medicao)))
  .sort((a,b)=>{const da=asf64DataHistorica(a),db=asf64DataHistorica(b);if(da!==db){if(!da)return 1;if(!db)return -1;return db.localeCompare(da);}return String(a.logradouro||'').localeCompare(String(b.logradouro||''),'pt-BR',{numeric:true,sensitivity:'base'});});
}
function asf64NomeSolicitanteValido(nome){
 const bruto=String(nome||'').trim(),chave=normalizarTextoBuscaMapa(bruto);
 return !!bruto&&!['-','—','–'].includes(bruto)&&!['nao informado','nao informada','sem solicitante','sem parlamentar','sem identificacao'].includes(chave);
}
function asf64Solicitante(r){
 const e=r.estado||asfEstadoConsolidadoFrente(r.frente||{logradouro:r.logradouro},{medida:!!r.medida,medicoes:r.medicoes||[]});
 const bruto=String(e?.solicitanteParlamentar||r.frente?.solicitante||r.frente?.parlamentar||r.frente?.responsavel_operacional||'').trim();
 return asf64NomeSolicitanteValido(bruto)?bruto:'';
}
function asf64Solicitantes(r){
 const bruto=asf64Solicitante(r);if(!bruto)return [];
 const vistos=new Set();return bruto.split(/\s*\/\s*/).map(x=>x.trim()).filter(asf64NomeSolicitanteValido).filter(nome=>{const chave=normalizarTextoBuscaMapa(nome)||nome.toLocaleLowerCase('pt-BR');if(vistos.has(chave))return false;vistos.add(chave);return true;});
}
function asf64Ranking(base){
 const mapa=new Map();let semIdentificacao=0;
 (base||[]).forEach(r=>{const nomes=asf64Solicitantes(r);if(!nomes.length){semIdentificacao++;return;}nomes.forEach(nome=>{const chave=normalizarTextoBuscaMapa(nome)||nome.toLocaleLowerCase('pt-BR');const atual=mapa.get(chave)||{nome,frentes:0};atual.frentes++;mapa.set(chave,atual);});});
 const lista=[...mapa.values()].sort((a,b)=>b.frentes-a.frentes||a.nome.localeCompare(b.nome,'pt-BR',{numeric:true,sensitivity:'base'}));
 const max=Math.max(...lista.map(x=>x.frentes),1),selecionadoBruto=String(asf64.solicitante||''),selecionado=normalizarTextoBuscaMapa(selecionadoBruto);
 const linha=(x,i)=>{const ativo=selecionadoBruto!==ASF64_SEM_IDENTIFICACAO&&selecionado&&normalizarTextoBuscaMapa(x.nome)===selecionado;return `<button type="button" class="asf64-ranking-row${ativo?' active':''}" data-asf64-solicitante="${asf54Esc(x.nome)}" aria-pressed="${ativo?'true':'false'}" title="Ver as ${x.frentes} rua${x.frentes===1?'':'s'} de ${asf54Esc(x.nome)}"><span class="asf64-ranking-pos">${i+1}º</span><span class="asf64-ranking-name"><strong>${asf54Esc(x.nome)}</strong><span class="asf64-ranking-bar" aria-hidden="true"><i style="width:${Math.max(8,(x.frentes/max)*100)}%"></i></span></span><b>${x.frentes} ${x.frentes===1?'frente':'frentes'}</b></button>`;};
 const visiveis=lista.slice(0,8),restante=lista.slice(8);
 const ranking=lista.length?`<div class="asf64-ranking-list">${visiveis.map(linha).join('')}</div>${restante.length?`<details class="asf64-ranking-more"><summary>Ver ranking completo (${lista.length})</summary><div class="asf64-ranking-list">${restante.map((x,i)=>linha(x,i+8)).join('')}</div></details>`:''}`:'<div class="asf54-empty">Nenhum solicitante identificado no histórico.</div>';
 const historicoSemId=semIdentificacao?`<div class="asf64-unidentified-wrap"><span class="asf54-eyebrow">DADOS HISTÓRICOS</span><button type="button" class="asf64-unidentified-card${selecionadoBruto===ASF64_SEM_IDENTIFICACAO?' active':''}" data-asf64-solicitante="${ASF64_SEM_IDENTIFICACAO}" aria-pressed="${selecionadoBruto===ASF64_SEM_IDENTIFICACAO?'true':'false'}"><span><strong>Sem identificação de solicitante/parlamentar</strong><small>Registros antigos preservados sem atribuição confiável. Clique para consultar as ruas.</small></span><b>${semIdentificacao} ${semIdentificacao===1?'frente':'frentes'}</b></button></div>`:'';
 return `<section class="asf64-ranking"><div class="asf64-ranking-head"><div><span class="asf54-eyebrow">SOLICITANTES / PARLAMENTARES</span><h4>Ranking de frentes</h4><p>Clique em um nome para ver todas as ruas atribuídas a esse solicitante/parlamentar. Frentes com mais de um nome contam para cada pessoa. Registros sem identificação ficam separados e não participam do ranking.</p></div><span class="asf64-ranking-total">${lista.length} identificado${lista.length===1?'':'s'}</span></div>${ranking}${historicoSemId}</section>`;
}
function asf64Datas(r){
 const e=r.estado||asfEstadoConsolidadoFrente(r.frente||{logradouro:r.logradouro},{medida:!!r.medida,medicoes:r.medicoes||[]});
 const itens=[['Início efetivo',e.inicio,e.fontes.inicio],['Conclusão efetiva',e.conclusao,e.fontes.conclusao],['Início no controle',e.inicioCadastro,'Cadastro da frente'],['Conclusão no controle',e.conclusaoCadastro,'Cadastro da frente'],['Previsão cadastrada',e.previsao,'Cadastro da frente']];
 return `<dl class="asf64-dates">${itens.map(([label,v,fonte])=>`<div><dt>${asf54Esc(label)}</dt><dd>${v?asf54Esc(fmtDate(String(v).slice(0,10))):'Não informada'}</dd>${v?`<small>${asf54Esc(fonte)}</small>`:''}</div>`).join('')}</dl><p class="asf54-note">Situação efetiva calculada pelo núcleo consolidado. Primeira e última execução das medições prevalecem sobre as datas do controle; a previsão permanece independente.</p>`;
}
function asf64Resultados(){
 const base=asfBaseRuasUnificada(false),lista=asf64Lista(base),selecionado=String(asf64.solicitante||'').trim(),semIdentificacao=selecionado===ASF64_SEM_IDENTIFICACAO,porPagina=selecionado?Math.max(lista.length,1):20,paginas=Math.max(1,Math.ceil(lista.length/porPagina));asf64.pagina=Math.max(1,Math.min(asf64.pagina,paginas));const ini=(asf64.pagina-1)*porPagina,visiveis=lista.slice(ini,ini+porPagina);
 const tituloFoco=semIdentificacao?'Dados históricos sem identificação':selecionado;
 const foco=selecionado?`<div class="asf64-solicitante-view${semIdentificacao?' unidentified':''}"><div><span>${semIdentificacao?'Consulta':'Ruas de'}</span><strong>${asf54Esc(tituloFoco)}</strong><small>${lista.length} ${lista.length===1?'frente encontrada':'frentes encontradas'} · da mais recente para a mais antiga</small></div><button type="button" class="btn btn-ghost" data-asf64-solicitante-clear>Ver todo o histórico</button></div>`:'';
 return `${foco}<div class="asf54-results-head" role="status">${lista.length} rua(s) encontradas${lista.length?` · exibindo ${ini+1}–${Math.min(ini+porPagina,lista.length)}`:''}</div>${visiveis.map(r=>`<article class="asf64-row"><div class="asf64-main"><div><span class="asf54-eyebrow">${asf54Esc(asf64RotuloArea(r))}</span><h4>${asf54Esc(r.logradouro)}</h4><p>${asf54Esc([r.referencia,r.bairro].filter(Boolean).join(' · ')||'Referência complementar não informada')}</p><div class="asf64-tags"><span class="asf54-status">${asf54Esc(r.status)}</span><span class="asf64-source ${r.medida?'measured':''}">${asf54Esc(r.fonte)}</span>${asf64Solicitante(r)?`<span class="asf64-requester">Solicitante: ${asf54Esc(asf64Solicitante(r))}</span>`:''}${asf65LinksMedicoes(r)}</div></div><div class="asf64-progress"><span>Execução</span><strong>${asf54Esc(asfNum(r.percentual,1))}%</strong><div role="progressbar" aria-label="Execução" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${asfPercentual(r.percentual)}"><i style="width:${asfPercentual(r.percentual)}%"></i></div>${r.medida?'<small>Conforme regra da medição</small>':''}</div></div><details class="asf64-details"><summary>Consultar datas e origem</summary>${asf64Datas(r)}</details>${!r.medida&&r.frenteId?`<footer><button type="button" class="btn btn-ghost" data-asf64-ficha="${asf54Esc(r.frenteId)}">${pode28('contratos','editar')?'Editar ficha':'Consultar ficha'}</button></footer>`:''}</article>`).join('')||'<div class="asf54-empty"><strong>Nenhuma rua encontrada</strong><p>Revise a combinação de filtros ou use Limpar filtros.</p></div>'}${!selecionado?`<nav class="asf54-pagination" aria-label="Páginas do histórico"><button type="button" class="btn btn-ghost" data-asf64-page="-1" ${asf64.pagina===1?'disabled':''}>Anterior</button><span>Página ${asf64.pagina} de ${paginas}</span><button type="button" class="btn btn-ghost" data-asf64-page="1" ${asf64.pagina===paginas?'disabled':''}>Próxima</button></nav>`:''}`;
}
function asf64Atualizar(){const el=document.getElementById('asf64-resultados');if(el)el.innerHTML=asf64Resultados();}
function asf64Filtrar(chave,valor){if(chave==='busca')asfaltinhoBusca=valor;else if(['area','gerencia','status','fonte','medicao','solicitante'].includes(chave))asf64[chave]=valor;asf64.pagina=1;asf64Atualizar();}
function asf64FiltrosToggle(el){asf64.filtrosAbertos=!!el?.open;}
function asf64Opcoes(valores,selecionado){return valores.map(v=>`<option value="${asf54Esc(v)}" ${String(v)===selecionado?'selected':''}>${asf54Esc(v)}</option>`).join('');}
asfRuasUnificadas=function(){
 asf64Sessao();const base=asfBaseRuasUnificada(false),medidas=base.filter(r=>r.medida).length,gerencias=[...new Set(base.map(r=>r.gerencia).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),status=[...new Set(base.map(r=>r.status).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),medicoes=[...new Set(base.flatMap(r=>r.medicoes))].sort((a,b)=>a-b);
 return `<section class="asf54 asf64"><header class="asf54-heading"><div><span class="asf54-eyebrow">CONSULTA CONSOLIDADA · AP5.1 E AP5.2</span><h3>Histórico do Asfaltinho</h3><p>Ruas organizadas da execução mais recente para a mais antiga.</p></div></header><div class="asf54-summary"><div><span>Total na relação</span><strong>${base.length}</strong></div><div><span>Com medição</span><strong>${medidas}</strong></div><div><span>Somente no controle</span><strong>${base.length-medidas}</strong></div></div>${asf64ResumoAreas(base)}${asf64Ranking(base)}<p class="asf54-note">Cruzamento entre medições e planilha de controle, preservando os vínculos existentes. A relação inclui as ruas da AP5.1 e as de área ainda a confirmar. Quando a rua está nas duas fontes, a medição prevalece. Indicadores e ranking consideram a relação completa; os filtros abaixo são aplicados à lista. A ordem cronológica usa primeiro a data efetiva de início e, quando ela não existe, a data efetiva de conclusão; registros sem data ficam ao final.</p><details class="asf52-search-tools asf64-search-tools" ${asf64.filtrosAbertos?'open':''} ontoggle="asf64FiltrosToggle(this)"><summary><span aria-hidden="true">⌕</span> Buscar e filtrar ruas</summary><div class="asf54-filters asf64-filters"><label class="asf64-search">Buscar rua ou referência<input id="asf64-busca" type="search" value="${asf54Esc(asfaltinhoBusca)}" placeholder="Nome, referência, bairro ou gerência" oninput="asf64Filtrar('busca',this.value)"></label><label>Área<select onchange="asf64Filtrar('area',this.value)"><option value="">Todas</option>${asf64Opcoes(ASF64_AREAS.filter(a=>base.some(r=>r.area===a)),asf64.area)}</select></label><label>Gerência<select onchange="asf64Filtrar('gerencia',this.value)"><option value="">Todas</option>${asf64Opcoes(gerencias,asf64.gerencia)}</select></label><label>Situação<select onchange="asf64Filtrar('status',this.value)"><option value="">Todas</option>${asf64Opcoes(status,asf64.status)}</select></label><label>Fonte<select onchange="asf64Filtrar('fonte',this.value)"><option value="">Todas as fontes</option><option value="medicao" ${asf64.fonte==='medicao'?'selected':''}>Com medição</option><option value="controle" ${asf64.fonte==='controle'?'selected':''}>Somente controle</option></select></label><label>Número da medição<select onchange="asf64Filtrar('medicao',this.value)"><option value="">Todas</option>${asf64Opcoes(medicoes,asf64.medicao)}</select></label><button type="button" class="btn btn-ghost" data-asf64-clear>Limpar filtros</button></div></details><div id="asf64-resultados">${asf64Resultados()}</div></section>`;
};
document.addEventListener('click',e=>{
 if(secaoContratos!=='asfaltinho'||asfaltinhoAba!=='ruas'||!pode28('contratos','visualizar'))return;
 const el=e.target.closest?.('[data-asf64-ficha],[data-asf64-page],[data-asf64-clear],[data-asf64-solicitante],[data-asf64-solicitante-clear]');if(!el)return;
 if(el.hasAttribute('data-asf64-ficha')){const r=asfBaseRuasUnificada(false).find(r=>!r.medida&&String(r.frenteId)===el.dataset.asf64Ficha);if(r)abrirDossieAsfaltinho(r.frenteId);}
 else if(el.hasAttribute('data-asf64-solicitante')){asfaltinhoBusca='';Object.assign(asf64,{solicitante:el.dataset.asf64Solicitante||'',area:'',gerencia:'',status:'',fonte:'',medicao:'',pagina:1});renderAsfaltinho();requestAnimationFrame(()=>document.getElementById('asf64-resultados')?.scrollIntoView({behavior:'smooth',block:'start'}));}
 else if(el.hasAttribute('data-asf64-solicitante-clear')){asf64.solicitante='';asf64.pagina=1;renderAsfaltinho();requestAnimationFrame(()=>document.querySelector('.asf64-ranking')?.scrollIntoView({behavior:'smooth',block:'start'}));}
 else if(el.hasAttribute('data-asf64-clear')){asfaltinhoBusca='';Object.assign(asf64,{area:'',gerencia:'',status:'',fonte:'',medicao:'',solicitante:'',pagina:1});renderAsfaltinho();document.getElementById('asf64-busca')?.focus({preventScroll:true});}
 else{asf64.pagina+=Number(el.dataset.asf64Page);asf64Atualizar();document.getElementById('asf64-resultados')?.scrollIntoView({block:'start'});document.querySelector('#asf64-resultados summary')?.focus({preventScroll:true});}
});
