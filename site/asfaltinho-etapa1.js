/* AP5.2 · etapa 1: apresentação de Em andamento. Sem consultas adicionais. */
'use strict';
const asf52 = {usuario:null,gerencia:'',bairro:'',equipe:'',status:'',prazo:'',ordem:'manual',pagina:1,filtrosAbertos:false,rascunhos:new Map(),abertos:new Set(),salvando:new Set()};
function asf52Esc(v){return escapar(String(v??''));}
function asf52Sessao(){
 const id=sessaoAtual?.user?.id||'';
 if(asf52.usuario===id)return;
 Object.assign(asf52,{usuario:id,gerencia:'',bairro:'',equipe:'',status:'',prazo:'',ordem:'manual',pagina:1,filtrosAbertos:false});
 asf52.rascunhos.clear();asf52.abertos.clear();asf52.salvando.clear();
}
function asf52UltimoRelatorioAP52(){
 return asfaltinhoFrentes
  .filter(f=>f.area_responsavel==='AP5.2'&&f.data_relatorio_operacional)
  .map(f=>String(f.data_relatorio_operacional).slice(0,10))
  .filter(Boolean).sort().at(-1)||'';
}
function asf52EhDestaqueAP52(f){
 const data=String(f?.data_relatorio_operacional||'').slice(0,10),ultima=asf52UltimoRelatorioAP52();
 return !!ultima&&f?.area_responsavel==='AP5.2'&&data===ultima;
}
function asf52Base(){
 // Painel principal: mostra apenas frentes efetivamente iniciadas (> 0%). Frentes medidas ficam no Histórico.
 const medidas=new Set(asfRuasMedidasAP52().map(x=>String(x.frente?.id||'')).filter(Boolean));
 return asfaltinhoFrentes.filter(f=>f.area_responsavel==='AP5.2'&&!medidas.has(String(f.id))&&!asfStatusConcluido(f)&&asfPercentual(f.percentual)>0);
}
function asf52Equipe(f){return String(f.manual_operacional||'').trim();}
function asf52OrdemEquipe(valor){
 const texto=String(valor||'').trim(),m=texto.match(/^Manual\s+(\d+)$/i);
 return m?{grupo:0,num:Number(m[1]),texto}:{grupo:1,num:Number.MAX_SAFE_INTEGER,texto:texto||'ZZZ'};
}
function asf52CompararEquipe(a,b){
 const x=asf52OrdemEquipe(asf52Equipe(a)),y=asf52OrdemEquipe(asf52Equipe(b));
 if(x.grupo!==y.grupo)return x.grupo-y.grupo;
 if(x.num!==y.num)return x.num-y.num;
 const t=x.texto.localeCompare(y.texto,'pt-BR',{numeric:true,sensitivity:'base'});
 if(t)return t;
 const p=asfPercentual(b.percentual)-asfPercentual(a.percentual);
 if(p)return p;
 return String(a.logradouro||'').localeCompare(String(b.logradouro||''),'pt-BR',{numeric:true,sensitivity:'base'});
}
function asf52Vencida(f){return !!f.previsao&&String(f.previsao).slice(0,10)<dataRio()&&!asfStatusConcluido(f);}
function asf52Filtrar(base){
 const q=normalizarTextoBuscaMapa(asfaltinhoBusca||'');
 return base.filter(f=>(!q||normalizarTextoBuscaMapa([f.logradouro,f.referencia,f.bairro,f.gerencia,asf52Equipe(f),f.solicitante,f.parlamentar].filter(Boolean).join(' ')).includes(q))
 &&(!asf52.gerencia||f.gerencia===asf52.gerencia)&&(!asf52.bairro||f.bairro===asf52.bairro)&&(!asf52.equipe||asf52Equipe(f)===asf52.equipe)
 &&(!asf52.status||asfTextoStatus(f)===asf52.status)&&(!asf52.prazo||(asf52.prazo==='vencida'?asf52Vencida(f):!f.previsao)))
 .sort((a,b)=>{
  if(asf52.ordem==='manual')return asf52CompararEquipe(a,b);
  if(asf52.ordem==='previsao'){const x=String(a.previsao||'9999').localeCompare(String(b.previsao||'9999'));if(x)return x;}
  if(asf52.ordem==='atualizacao'){const x=String(b.updated_at||'').localeCompare(String(a.updated_at||''));if(x)return x;}
  return String(a.logradouro||'').localeCompare(String(b.logradouro||''),'pt-BR');
 });
}
function asf52Opcoes(lista,valor,todos){return `<option value="">${todos}</option>`+[...new Set(lista.filter(Boolean))].sort((a,b)=>{const x=asf52OrdemEquipe(a),y=asf52OrdemEquipe(b);if(/^Manual\s+\d+$/i.test(a)||/^Manual\s+\d+$/i.test(b)){if(x.grupo!==y.grupo)return x.grupo-y.grupo;if(x.num!==y.num)return x.num-y.num;}return String(a).localeCompare(String(b),'pt-BR',{numeric:true,sensitivity:'base'});}).map(x=>`<option value="${asf52Esc(x)}"${x===valor?' selected':''}>${asf52Esc(x)}</option>`).join('');}
function asf52FiltrarCampo(campo,valor){asf52[campo]=valor;asf52.pagina=1;asf52Resultados();}
function asf52Buscar(el){asfaltinhoBusca=el.value;asf52.pagina=1;asf52Resultados();}
function asf52FiltrosToggle(el){asf52.filtrosAbertos=!!el?.open;}
function asf52Limpar(){
 for(const k of ['gerencia','bairro','equipe','status','prazo']){asf52[k]='';const el=document.getElementById('asf52-'+k);if(el)el.value='';}
 asfaltinhoBusca='';const el=document.getElementById('asf52-busca');if(el)el.value='';asf52.pagina=1;asf52Resultados();
}
function asf52Indicadores(base){return `<div class="asf52-kpis" aria-label="Resumo das frentes desta tela"><div><span>Frentes em acompanhamento</span><strong>${base.length}</strong></div><div><span>Em execução</span><strong>${base.filter(asfStatusEmAndamento).length}</strong></div><div><span>A iniciar</span><strong>${base.filter(asfStatusPlanejada).length}</strong></div><div class="asf52-attention"><span>Previsão vencida</span><strong>${base.filter(asf52Vencida).length}</strong></div></div>`;}
function asf52Linha(f){
 const id=String(f.id),pct=asfPercentual(f.percentual),rascunho=asf52.rascunhos.get(id),aberto=asf52.abertos.has(id),salvando=asf52.salvando.has(id),edita=pode28('contratos','editar');
 const equipe=asf52Equipe(f),vencida=asf52Vencida(f),territorio=[f.referencia,f.bairro].filter(Boolean).join(' · ');
 const destaque=asf52EhDestaqueAP52(f);
 return `<article class="asf52-row asf-simple-row${destaque?' asf52-ap52-highlight':''}" data-asf52-id="${asf52Esc(id)}"><div class="asf52-identity"><div class="asf52-tags">${destaque?'<span class="asf52-area-badge">AP5.2 · frente atual</span>':''}<span>${asf52Esc(f.gerencia||'Gerência não informada')}</span><span class="asf52-status ${asfStatusPlanejada(f)?'planned':asfStatusEmAndamento(f)?'working':'other'}">${asf52Esc(asfTextoStatus(f))}</span></div><h4>${asf52Esc(f.logradouro||'Sem logradouro')}</h4>${territorio?`<p>${asf52Esc(territorio)}</p>`:''}<p class="asf52-team">${equipe?asf52Esc(equipe):'Manual não informado'}</p></div><div class="asf52-execution"><span class="asf52-label">Executado</span><strong>${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}<small>%</small></strong><div class="asf52-progress" role="progressbar" aria-label="Execução de ${asf52Esc(f.logradouro)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div><div class="asf52-dates"><span class="asf52-label">Previsão de término</span><strong>${f.previsao?asf52Esc(fmtDate(f.previsao)):'Não informada'}</strong>${vencida?'<span class="asf52-due">Previsão vencida</span>':''}<small>Atualizado: ${f.updated_at?asf52Esc(fmtDate(String(f.updated_at).slice(0,10))):'não informado'}</small></div><div class="asf52-actions"><button type="button" class="btn btn-ghost" data-asf52-action="dossie">Ver ficha</button>${edita?`<button type="button" class="btn btn-primary" data-asf52-action="editar" aria-expanded="${aberto}" aria-controls="asf52-edit-${asf52Esc(id)}">${aberto?'Fechar edição':'Atualizar execução'}</button>`:''}</div>${edita&&aberto?`<div class="asf52-editor" id="asf52-edit-${asf52Esc(id)}"><label for="asf-pct-${asf52Esc(id)}">Percentual executado<input id="asf-pct-${asf52Esc(id)}" type="number" min="0" max="100" step="0.1" value="${asf52Esc(rascunho??pct)}" data-asf52-draft ${salvando?'disabled':''}></label><p>A atualização mantém o histórico. Ao atingir 100%, a rua passa para concluída.</p><button type="button" class="btn btn-primary" data-asf52-action="salvar" ${salvando?'disabled':''}>${salvando?'Salvando…':'Salvar percentual'}</button></div>`:''}</article>`;
}
function asf52HtmlResultados(base){
 const lista=asf52Filtrar(base),paginas=Math.max(1,Math.ceil(lista.length/20));asf52.pagina=Math.min(asf52.pagina,paginas);
 const inicio=(asf52.pagina-1)*20,visiveis=lista.slice(inicio,inicio+20);
 return `<div class="asf52-list-head"><span role="status">${lista.length} de ${base.length} frentes${asf52.rascunhos.size?' · há alterações ainda não salvas':''}</span><span>Ordenação: ${{manual:'turmas em ordem crescente',nome:'A–Z',previsao:'previsão de término',atualizacao:'última atualização'}[asf52.ordem]}</span></div>${lista.length?`<div class="asf52-list">${visiveis.map(asf52Linha).join('')}</div>`:`<div class="asf52-empty"><strong>${base.length?'Nenhuma frente corresponde aos filtros.':'Nenhuma frente em acompanhamento.'}</strong><p>${base.length?'Ajuste a busca ou limpe os filtros para ver as outras ruas.':'Consulte o Histórico ou cadastre uma nova frente.'}</p>${base.length?'<button type="button" class="btn btn-ghost" onclick="asf52Limpar()">Limpar filtros</button>':''}</div>`}${paginas>1?`<nav class="asf52-pages" aria-label="Páginas das frentes"><button type="button" class="btn btn-ghost" onclick="asf52Pagina(-1)" ${asf52.pagina===1?'disabled':''}>Anterior</button><span>Página ${asf52.pagina} de ${paginas}</span><button type="button" class="btn btn-ghost" onclick="asf52Pagina(1)" ${asf52.pagina===paginas?'disabled':''}>Próxima</button></nav>`:''}`;
}
function asf52Pagina(delta){asf52.pagina+=delta;asf52Resultados();document.getElementById('asf52-resultados')?.focus({preventScroll:true});}
function asf52Resultados(){const el=document.getElementById('asf52-resultados');if(el)el.innerHTML=asf52HtmlResultados(asf52Base());}
const asf52OriginalAndamento=asfFrentesEmAndamentoSimples;
asfFrentesEmAndamentoSimples=function(){
 asf52Sessao();const base=asf52Base();
 // Reaproveita o formulário existente e seu fluxo de cadastro, sem reescrevê-los.
 const original=asfaltinhoNovaRuaAberta?asf52OriginalAndamento():'';
 const formulario=original.match(/<form class="asf-nova-rua"[\s\S]*?<\/form>/)?.[0]||'';
 return `<section class="asf52"><header class="asf52-heading"><div><span class="asf52-eyebrow">Acompanhamento operacional · AP5.2</span><h3>Ruas em andamento</h3><p>Consulte os prazos e registre o avanço das frentes.</p></div>${pode28('contratos','cadastrar')?'<button type="button" class="btn btn-primary" onclick="asfaltinhoNovaRuaAberta=!asfaltinhoNovaRuaAberta;renderAsfaltinho()">+ Nova rua</button>':''}</header>${asf52Indicadores(base)}${formulario}<details class="asf52-search-tools" ${asf52.filtrosAbertos?'open':''} ontoggle="asf52FiltrosToggle(this)"><summary><span aria-hidden="true">⌕</span> Buscar e filtrar ruas</summary><div class="asf52-filters" data-asf52-native-toggle><label class="asf52-search">Buscar frente<input type="search" id="asf52-busca" value="${asf52Esc(asfaltinhoBusca)}" placeholder="Rua, referência, manual ou solicitante" oninput="asf52Buscar(this)"></label><label>Gerência<select id="asf52-gerencia" onchange="asf52FiltrarCampo('gerencia',this.value)">${asf52Opcoes(base.map(f=>f.gerencia),asf52.gerencia,'Todas')}</select></label><label>Bairro<select id="asf52-bairro" onchange="asf52FiltrarCampo('bairro',this.value)">${asf52Opcoes(base.map(f=>f.bairro),asf52.bairro,'Todos')}</select></label><label>Manual<select id="asf52-equipe" onchange="asf52FiltrarCampo('equipe',this.value)">${asf52Opcoes(base.map(asf52Equipe),asf52.equipe,'Todas')}</select></label><label>Situação<select id="asf52-status" onchange="asf52FiltrarCampo('status',this.value)">${asf52Opcoes(base.map(asfTextoStatus),asf52.status,'Todas')}</select></label><label>Prazo<select id="asf52-prazo" onchange="asf52FiltrarCampo('prazo',this.value)"><option value="">Todos</option><option value="vencida"${asf52.prazo==='vencida'?' selected':''}>Previsão vencida</option><option value="sem"${asf52.prazo==='sem'?' selected':''}>Sem previsão</option></select></label><label>Ordenar por<select id="asf52-ordem" onchange="asf52FiltrarCampo('ordem',this.value)">${[['manual','Manual (1 → 17)'],['nome','Ordem alfabética'],['previsao','Previsão de término'],['atualizacao','Última atualização']].map(([k,v])=>`<option value="${k}"${asf52.ordem===k?' selected':''}>${v}</option>`).join('')}</select></label><button type="button" class="btn btn-ghost" onclick="asf52Limpar()">Limpar filtros</button></div></details><p class="asf52-scope"><strong>AP5.2 · frente atual</strong> identifica as ruas do relatório operacional mais recente da nossa área. As demais permanecem disponíveis para consulta porque a planilha também contém frentes de outras áreas.</p><div id="asf52-resultados" tabindex="-1">${asf52HtmlResultados(base)}</div></section>`;
};
document.addEventListener('input',event=>{
 const input=event.target.closest?.('[data-asf52-draft]');if(!input)return;
 const id=input.closest('[data-asf52-id]')?.dataset.asf52Id;if(id)asf52.rascunhos.set(id,input.value);
});
document.addEventListener('click',async event=>{
 const btn=event.target.closest?.('[data-asf52-action]');if(!btn)return;
 const id=btn.closest('[data-asf52-id]')?.dataset.asf52Id;if(!id)return;
 if(btn.dataset.asf52Action==='dossie'){abrirDossieAsfaltinho(id);return;}
 if(!pode28('contratos','editar'))return;
 if(btn.dataset.asf52Action==='editar'){
  if(asf52.abertos.has(id))asf52.abertos.delete(id);else asf52.abertos.add(id);
  const aberto=asf52.abertos.has(id);asf52Resultados();
  const row=[...document.querySelectorAll('[data-asf52-id]')].find(el=>el.dataset.asf52Id===id);
  (aberto?row?.querySelector('input'):row?.querySelector('[data-asf52-action="editar"]'))?.focus({preventScroll:true});return;
 }
 if(btn.dataset.asf52Action==='salvar'){
  if(asf52.salvando.has(id))return;
  const input=btn.closest('[data-asf52-id]').querySelector('[data-asf52-draft]');
  if(!input||input.value.trim()===''||!input.reportValidity())return;
  const antes=asfaltinhoFrentes.find(f=>String(f.id)===id),usuario=sessaoAtual?.user?.id;
  asf52.salvando.add(id);
  try{await asfAtualizarPercentualRapido(id,btn);
   if(usuario!==sessaoAtual?.user?.id)return;
   if(asfaltinhoFrentes.find(f=>String(f.id)===id)!==antes){asf52.rascunhos.delete(id);asf52.abertos.delete(id);}
  }finally{asf52.salvando.delete(id);if(usuario===sessaoAtual?.user?.id)asf52Resultados();}
 }
});
