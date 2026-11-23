/* Ajustes de leitura exclusivos ao Asfaltinho. Sem acesso a dados. */
'use strict';
const asf67={abertos:{},contrato:false,usuario:null};
function asf67Ativo(){const app=document.getElementById('app-shell'),v=document.getElementById('view-contratos');return !!(app&&v&&app.style.display!=='none'&&v.style.display!=='none'&&!app.classList.contains('mobile-inicio')&&secaoContratos==='asfaltinho');}
function asf67Sincronizar(){const app=document.getElementById('app-shell');if(!app)return;const on=asf67Ativo();if(app.classList.contains('asf67-layout')!==on)app.classList.toggle('asf67-layout',on);}
function asf67Aplicar(){
 asf67Sincronizar();if(!asf67Ativo())return;
 const u=sessaoAtual?.user?.id||null;if(u!==asf67.usuario){asf67.usuario=u;asf67.abertos={};asf67.contrato=false;}
 const mobile=matchMedia('(max-width:820px)').matches;
 const meta=document.querySelector('#asf-contrato-header .asf-contract-meta');
 if(meta&&!meta.closest('.asf67-contract')){const d=document.createElement('details');d.className='asf67-contract';d.innerHTML='<summary>Dados do contrato</summary>';meta.before(d);d.append(meta);d.open=!mobile||asf67.contrato;d.addEventListener('toggle',()=>{if(matchMedia('(max-width:820px)').matches)asf67.contrato=d.open;});}
 document.querySelectorAll('#asf-content .asf52-filters:not([data-asf52-native-toggle]),#asf-content .asf54-filters').forEach(box=>{
  if(box.querySelector('.asf67-filter'))return;
  const search=box.querySelector('input[type="search"]')?.closest('label'),rest=[...box.children].filter(x=>x!==search);if(!rest.length)return;
  const d=document.createElement('details');d.className='asf67-filter';const s=document.createElement('summary');s.textContent='Filtros e ordenação';d.append(s);const body=document.createElement('div');body.className='asf67-filter-body';rest.forEach(x=>body.append(x));d.append(body);box.append(d);box.classList.add('asf67-filter-shell');
  const key=asfaltinhoAba;d.open=!mobile||!!asf67.abertos[key];d.addEventListener('toggle',()=>{if(matchMedia('(max-width:820px)').matches)asf67.abertos[key]=d.open;});
 });
}
const asf67RenderBase=renderAsfaltinho;
renderAsfaltinho=function(){const r=asf67RenderBase();asf67Aplicar();return r;};
new MutationObserver(asf67Sincronizar).observe(document.getElementById('app-shell'),{attributes:true,attributeFilter:['style','class']});
new MutationObserver(asf67Sincronizar).observe(document.getElementById('view-contratos'),{attributes:true,attributeFilter:['style']});
matchMedia('(max-width:820px)').addEventListener('change',e=>{document.querySelectorAll('.asf67-contract,.asf67-filter').forEach(d=>{d.open=!e.matches||(d.classList.contains('asf67-contract')?asf67.contrato:!!asf67.abertos[asfaltinhoAba]);});});
