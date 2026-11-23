/* AP5.2 v65.42.156.4.10 — textos de orientação permanentes, sem tooltip e sem dados em HTML. */
(function(){
 'use strict';
 const tabTips={
  'dem52c-aba-demandas':'Pedidos recebidos: quem pediu, quando, o quê e onde.',
  'dem52c-aba-casos':'O problema no local. Um caso pode reunir vários pedidos e é o que a equipe vistoria e executa.',
  'dem52c-aba-historico':'Digite uma rua para ver tudo o que aconteceu nela: pedidos e serviços executados, por data.'
 };
 const archiveTips={
  atuais:'Pedidos cadastrados pelo site (botão + Nova demanda).',
  historicas:'Pedidos trazidos das planilhas antigas da gerência.',
  todas:'Os pedidos do site e os das planilhas antigas, juntos.'
 };
 function addHelp(button,text,kind){
  if(!button||button.closest('.ap52-help-'+kind+'-wrap'))return;
  const parent=button.parentElement,wrap=document.createElement('div'),caption=document.createElement('p');
  wrap.className='ap52-help-'+kind+'-wrap';if(kind==='tab')wrap.setAttribute('role','presentation');caption.className='ap52-help-'+kind;caption.textContent=text;
  parent.insertBefore(wrap,button);wrap.append(button,caption);
 }
 function install(){
  const view=document.getElementById('view-demandas');if(!view)return;
  for(const [id,t] of Object.entries(tabTips))addHelp(document.getElementById(id),t,'tab');
  for(const [value,t] of Object.entries(archiveTips))addHelp(view.querySelector('[data-dem52-acervo="'+value+'"]'),t,'acervo');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
