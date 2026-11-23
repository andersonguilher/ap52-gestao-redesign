/* AP5.2 · etapa 2: dossiê contextual de Em andamento; apenas dados já carregados. */
'use strict';
const asf53={id:null,usuario:null,origem:null,scroll:0,editing:false,bodyOverflow:null,painel:null,dialog:null,workspace:null};
function asf53Ativo(){
 const app=document.getElementById('app-shell'),view=document.getElementById('view-contratos');
 return !!(app&&view&&app.style.display!=='none'&&!app.classList.contains('mobile-inicio')&&view.style.display!=='none'&&secaoContratos==='asfaltinho'&&asfaltinhoAba==='andamento'&&perfil&&pode28('contratos','visualizar'));
}
function asf53Mobile(){return matchMedia('(max-width:1100px)').matches;}
function asf53Frente(){return asfaltinhoFrentes.find(f=>String(f.id)===asf53.id)||null;}
function asf53Data(v){return v?asf52Esc(fmtDate(String(v).slice(0,10))):'Não informada';}
function asf53Campo(rotulo,valor){return `<div><dt>${asf52Esc(rotulo)}</dt><dd>${asf52Esc(valor||'Não informado')}</dd></div>`;}
function asf53Resumo(){
 const base=asf52Base();
 const prazos=base.filter(f=>f.previsao).sort((a,b)=>String(a.previsao).localeCompare(String(b.previsao),'pt-BR')).slice(0,3);
 return `<div class="asf53-guide"><span class="asf53-symbol" aria-hidden="true">↗</span><h3>Uma rua, todas as informações</h3><p>Selecione uma frente para consultar seu resumo. Os filtros e valores digitados continuam na lista.</p></div><section class="asf53-section"><h3>Prazos para acompanhar</h3>${prazos.length?`<div class="asf53-deadlines">${prazos.map(f=>`<button type="button" data-asf53-id="${asf52Esc(f.id)}"><strong>${asf52Esc(f.logradouro||'Sem logradouro')}</strong><span>${asf53Data(f.previsao)}${asf52Vencida(f)?' · previsão vencida':''}</span></button>`).join('')}</div>`:'<p class="asf53-muted">Nenhuma previsão cadastrada para as frentes desta tela.</p>'}</section><p class="asf53-footnote">Resumo calculado com os dados carregados. Use “Atualizar dados” para buscar alterações feitas por outras pessoas.</p>`;
}
function asf53Dossie(f){
 const meta=asfLerOrigemFrente(f),links=asfVinculosFrente(f.id),vinculadas=new Set(links.map(c=>String(c.frente_id)));
 const faltas=asfFaltasFrente(f,vinculadas),pct=asfPercentual(f.percentual),inicio=asfPrimeiraExecucaoMedicaoFrente(f),ultima=asfUltimaExecucaoMedicaoFrente(f);
 const hist=(Array.isArray(meta.historico)?meta.historico:[]).filter(h=>String(h?.campo||'')!=='encarregado').slice(0,3);
 const datas=[
  [inicio?'Primeira execução':'Início cadastrado',inicio||f.inicio,inicio?'Medição · primeira execução registrada':meta.campos?.inicio?.fonte||'Cadastro da frente'],
  ['Previsão de término',f.previsao,meta.campos?.previsao?.fonte||'Cadastro da frente'],
  [ultima?'Última execução':'Conclusão cadastrada',ultima||f.conclusao,ultima?'Medição · última execução registrada':meta.campos?.conclusao?.fonte||'Cadastro da frente']
 ];
 const fora=!asf52Base().some(x=>String(x.id)===String(f.id));
 return `<section class="asf53-identity"><span class="asf53-territory">${asf52Esc(f.gerencia||'Gerência não informada')}</span><h3>${asf52Esc(f.logradouro||'Sem logradouro')}</h3><p>${asf52Esc([f.referencia,f.bairro].filter(Boolean).join(' · ')||'Referência territorial não informada')}</p><span class="asf53-status ${asfStatusConcluido(f)?'done':asfStatusPlanejada(f)?'planned':'neutral'}">${asf52Esc(asfTextoStatus(f))}</span></section><section class="asf53-section"><div class="asf53-execution"><div><h3>Execução cadastrada</h3><p>Avanço informado para esta frente</p></div><strong>${pct.toLocaleString('pt-BR',{maximumFractionDigits:1})}<small>%</small></strong></div><div class="asf53-progress" role="progressbar" aria-label="Execução cadastrada" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>${fora?'<p class="asf53-info">Esta frente não está mais na seleção de Em andamento. Ela permanece disponível na aba Histórico.</p>':''}${asf52Vencida(f)?'<p class="asf53-warning">Previsão de término vencida. Confira a situação da frente.</p>':''}</section><section class="asf53-section"><h3>Datas e origem</h3><dl class="asf53-dates">${datas.map(([rotulo,valor,fonte])=>`<div><dt>${asf52Esc(rotulo)}</dt><dd>${asf53Data(valor)}</dd>${valor?`<small>${asf52Esc(fonte)}</small>`:''}</div>`).join('')}</dl>${inicio||ultima?'<p class="asf53-muted">As datas de execução da medição prevalecem na consulta. A última execução registrada não é, por si só, confirmação de conclusão.</p>':''}</section><section class="asf53-section"><h3>Solicitante e localização</h3><dl class="asf53-meta">${asf53Campo('Manual',f.manual_operacional)}${asf53Campo('Solicitante / parlamentar',asfCombinarSolicitanteParlamentar(f))}${f.coordenadas?asf53Campo('Coordenadas cadastradas',f.coordenadas):''}</dl></section><section class="asf53-section"><div class="asf53-section-head"><h3>Dados a conferir</h3><span>${faltas.length}</span></div>${faltas.length?`<ul class="asf53-pending">${faltas.map(k=>`<li>${asf52Esc(ASF_FALTAS.find(t=>t.chave===k)?.rotulo||k)}</li>`).join('')}</ul>`:'<p class="asf53-muted">Nenhum campo pendente pelas regras atuais.</p>'}<p class="asf53-muted">Todos os campos pendentes têm o mesmo peso.</p></section><section class="asf53-section"><h3>Medições vinculadas</h3>${links.length?links.map(c=>`<div class="asf53-measure"><strong>${asf52Esc((c.medicoes||[]).map(n=>`${n}ª medição`).join(' · ')||'Vínculo cadastrado')}</strong><p>${asf52Esc(c.logradouro_documento||'')}</p><small>${c.tipo_match==='manual'?'Vínculo confirmado manualmente':'Correspondência exata registrada'}</small></div>`).join(''):`<p class="asf53-muted">${asfStatusConcluido(f)?'Nenhuma medição vinculada. Confira as correspondências na ficha completa.':'Sem vínculo confirmado. Medição só será cobrada como pendência após a conclusão.'}</p>`}</section><section class="asf53-section"><h3>Observações</h3><p class="asf53-note">${asf52Esc(f.observacao||'Nenhuma observação registrada.')}</p></section><section class="asf53-section"><h3>Últimas alterações</h3>${hist.length?`<ol class="asf53-timeline">${hist.map(h=>`<li><strong>${asf52Esc(h.rotulo||ASF_DOSSIE_HIST_ROTULOS[h.campo]||h.campo||'Alteração')}</strong><p>${asf52Esc(asfHistoricoValorTela(h.campo,h.de))} → ${asf52Esc(asfHistoricoValorTela(h.campo,h.para))}</p><small>${asf52Esc(asfHistoricoData(h.em))} · ${asf52Esc(h.usuario||'Usuário')}</small></li>`).join('')}</ol>`:'<p class="asf53-muted">Nenhuma alteração registrada no histórico desta frente.</p>'}<p class="asf53-footnote">Última atualização do cadastro: ${f.updated_at?asf52Esc(asfHistoricoData(f.updated_at)):'não informada'}. O histórico completo está na ficha.</p></section>`;
}
function asf53MarcarSelecao(){
 document.querySelectorAll('#asf52-resultados [data-asf52-id]').forEach(el=>{
  const ativa=el.dataset.asf52Id===asf53.id;el.classList.toggle('asf53-selected',ativa);
  const b=el.querySelector('[data-asf53-select]');if(b)b.setAttribute('aria-pressed',String(ativa));
 });
}
function asf53Render(){
 if(!asf53.painel)return;
 const f=asf53Frente();if(asf53.id&&!f)asf53.id=null;
 document.getElementById('asf53-title').textContent=f?'Dossiê da rua':'Acompanhamento';
 document.getElementById('asf53-body').innerHTML=f?asf53Dossie(f):asf53Resumo();
 const a=document.getElementById('asf53-actions');a.hidden=!f;
 document.getElementById('asf53-edit').textContent=pode28('contratos','editar')?'Editar ficha completa':'Ver ficha completa';
 document.getElementById('asf53-close').hidden=!f&&!asf53Mobile();
 asf53MarcarSelecao();
}
function asf53AbrirMobile(preservarPosicao=false){
 if(!asf53Ativo()||!asf53Mobile()||asf53.dialog.open)return;
 if(!preservarPosicao)asf53.scroll=scrollY;asf53.bodyOverflow=document.body.style.overflow;
 asf53.dialog.append(asf53.painel);asf53.dialog.showModal();document.body.style.overflow='hidden';
 asf53.painel.scrollTop=0;document.getElementById('asf53-close').focus({preventScroll:true});
}
function asf53RecolherMobile(restaurar=true){
 if(!asf53.dialog?.open)return;
 asf53.dialog.close();asf53.workspace.append(asf53.painel);
 if(asf53.bodyOverflow!==null){document.body.style.overflow=asf53.bodyOverflow;asf53.bodyOverflow=null;}
 if(restaurar){scrollTo(0,asf53.scroll);asf53RestaurarFoco();}
}
function asf53RestaurarFoco(){
 if(asf53.origem?.isConnected)asf53.origem.focus({preventScroll:true});
 else document.getElementById('asf52-busca')?.focus({preventScroll:true});
}
function asf53Selecionar(id,origem){
 if(!asf53Ativo())return;
 const f=asfaltinhoFrentes.find(f=>String(f.id)===String(id)&&f.area_responsavel==='AP5.2');if(!f)return;
 asf53.id=String(f.id);asf53.origem=origem||document.activeElement;asf53Render();asf53.painel.scrollTop=0;
 asf53AbrirMobile();
}
function asf53Fechar(){asf53RecolherMobile();asf53.id=null;asf53.editing=false;asf53Render();if(!asf53Mobile())asf53RestaurarFoco();}
function asf53Editar(){
 const f=asf53Frente();if(!f||!asf53Ativo())return;
 asf53.editing=true;asf53RecolherMobile(false);abrirDossieAsfaltinho(f.id);
}
function asf53Sincronizar(){
 const id=sessaoAtual?.user?.id||null;
 if(asf53.usuario!==id){asf53RecolherMobile(false);asf53.usuario=id;asf53.id=null;asf53.origem=null;asf53.editing=false;document.getElementById('asf53-body')?.replaceChildren();}
 const ativa=asf53Ativo(),app=document.getElementById('app-shell');
 if(app.classList.contains('asf53-layout')!==ativa)app.classList.toggle('asf53-layout',ativa);
 if(!ativa){asf53RecolherMobile(false);asf53.id=null;asf53.editing=false;}
}
function asf53Montar(){
 const content=document.getElementById('asf-content'),ws=document.createElement('div');ws.className='asf53-workspace';ws.id='asf53-workspace';
 content.before(ws);ws.append(content);asf53.workspace=ws;
 const aside=document.createElement('aside');aside.id='asf53-panel';aside.className='asf53-panel';aside.setAttribute('aria-labelledby','asf53-title');
 aside.innerHTML='<header class="asf53-top"><div><span>ASFALTINHO · AP5.2</span><h2 id="asf53-title">Acompanhamento</h2></div><button type="button" id="asf53-close" aria-label="Fechar dossiê e voltar à lista">×</button></header><div id="asf53-body"></div><footer id="asf53-actions" hidden><button type="button" class="btn btn-primary" id="asf53-edit">Editar ficha completa</button><small>Consulta ao mapa e histórico completo disponíveis na ficha.</small></footer>';
 ws.append(aside);asf53.painel=aside;
 const dialog=document.createElement('dialog');dialog.id='asf53-dialog';dialog.setAttribute('aria-labelledby','asf53-title');dialog.addEventListener('cancel',e=>{e.preventDefault();asf53Fechar();});dialog.addEventListener('click',e=>{if(e.target===dialog)asf53Fechar();});document.body.append(dialog);asf53.dialog=dialog;
 document.getElementById('asf53-close').onclick=asf53Fechar;document.getElementById('asf53-edit').onclick=asf53Editar;
 const resumo=document.createElement('button');resumo.id='asf53-mobile-summary';resumo.type='button';resumo.className='btn btn-ghost';resumo.textContent='Resumo do acompanhamento';resumo.onclick=()=>{asf53.id=null;asf53.origem=resumo;asf53Render();asf53AbrirMobile();};ws.before(resumo);
 new MutationObserver(asf53Sincronizar).observe(document.getElementById('view-contratos'),{attributes:true,attributeFilter:['style']});
 new MutationObserver(asf53Sincronizar).observe(document.getElementById('app-shell'),{attributes:true,attributeFilter:['class','style']});
 const form=document.getElementById('asfaltinho-dossie-overlay');
 new MutationObserver(()=>{
  if(!asf53.editing||form.classList.contains('open'))return;
  asf53.editing=false;
  requestAnimationFrame(()=>{if(!asf53Ativo()||form.classList.contains('open'))return;asf53Render();asf53AbrirMobile(true);if(!asf53Mobile())document.getElementById('asf53-edit').focus({preventScroll:true});});
 }).observe(form,{attributes:true,attributeFilter:['class']});
}
const asf53RenderBase=renderAsfaltinho;
renderAsfaltinho=function(){const result=asf53RenderBase();asf53Sincronizar();if(asf53Ativo())asf53Render();return result;};
const asf53ResultadoBase=asf52Resultados;
asf52Resultados=function(){asf53ResultadoBase();asf53MarcarSelecao();};
const asf53LinhaBase=asf52Linha;
asf52Linha=function(f){return asf53LinhaBase(f).replace('<h4>',`<h4><button type="button" class="asf53-street" data-asf53-select="${asf52Esc(f.id)}" aria-pressed="${String(f.id)===asf53.id}">`).replace('</h4>','</button></h4>').replace('>Ver ficha</button>','>Ver resumo</button>');};
const asf53TemJanelaBase=ap52HaJanelaAberta,asf53FechaJanelaBase=ap52FecharJanelaAberta;
ap52HaJanelaAberta=function(){return !!asf53.dialog?.open||asf53TemJanelaBase();};
ap52FecharJanelaAberta=function(){if(asf53.dialog?.open)asf53Fechar();else asf53FechaJanelaBase();};
document.addEventListener('click',event=>{
 const alvo=event.target.closest?.('[data-asf53-select],[data-asf53-id],[data-asf52-action="dossie"]');
 if(!alvo||!asf53Ativo())return;
 const id=alvo.dataset.asf53Select||alvo.dataset.asf53Id||alvo.closest('[data-asf52-id]')?.dataset.asf52Id;
 event.preventDefault();event.stopImmediatePropagation();asf53Selecionar(id,alvo);
},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&asf53.dialog?.open){event.preventDefault();asf53Fechar();}});
matchMedia('(max-width:1100px)').addEventListener('change',()=>{
 if(!asf53Ativo())return;
 if(!asf53Mobile())asf53RecolherMobile(false);
 else if(asf53.id&&!asf53.editing)asf53AbrirMobile();
 asf53Render();
});
asf53Montar();
