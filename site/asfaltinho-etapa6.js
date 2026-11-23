/* Situação efetiva v65.42.68: o núcleo consolidado é a única fonte de status, percentual e datas. */
'use strict';
function asf66Medida(f){return asfEstadoConsolidadoFrente(f).medida;}
function asf66Efetiva(f){return asfFrenteEfetiva(f);}

// As telas legadas desta etapa apenas consomem o núcleo; não redefinem mais as regras centrais.
const asf66ConferenciaBase=asf54Base;
asf54Base=function(){return asf66ConferenciaBase().map(x=>({...x,f:asf66Efetiva(x.f)}));};

const asf66DossieBase=asf53Dossie;
asf53Dossie=function(f){
 const estado=asfEstadoConsolidadoFrente(f),medida=estado.medida;let html=asf66DossieBase(asf66Efetiva(f));
 html=html.replace('A última execução registrada não é, por si só, confirmação de conclusão.','Rua que consta na medição é considerada concluída, com 100% de execução.');
 if(medida)html=html.replaceAll('Execução cadastrada','Execução consolidada').replace('Avanço informado para esta frente','Concluída · medição prevalece').replace('Nenhuma medição vinculada. Confira as correspondências na ficha completa.','Rua identificada na relação consolidada de medições.').replace('<section class="asf53-identity">',`<p class="asf66-notice">Concluída · 100% pela medição. Cadastro original preservado: ${asf54Esc(estado.statusCadastro||'sem status')} · ${asf54Esc(estado.percentualCadastro)}%.</p><section class="asf53-identity">`);
 return html;
};

const asf66AbrirBase=abrirDossieAsfaltinho;
abrirDossieAsfaltinho=function(id){
 const result=asf66AbrirBase(id),overlay=document.getElementById('asfaltinho-dossie-overlay');if(!overlay?.classList.contains('open'))return result;
 const f=asfaltinhoFrentes.find(x=>String(x.id)===String(id)),estado=asfEstadoConsolidadoFrente(f),medida=estado.medida;
 let aviso=document.getElementById('asf66-aviso');const status=document.getElementById('asf-dossie-status'),pct=document.getElementById('asf-dossie-percentual');
 if(!aviso&&status){aviso=document.createElement('p');aviso.id='asf66-aviso';aviso.className='asf66-notice';status.closest('.field')?.before(aviso);}
 if(aviso){aviso.hidden=!medida;aviso.textContent=`Situação consolidada: Concluído · 100% pela medição. Cadastro original preservado: ${estado.statusCadastro} · ${estado.percentualCadastro}%.`;}
 for(const [el,texto] of [[status,'Status'],[pct,'Percentual executado']]){const label=el?.closest('.field')?.querySelector('label');if(label)label.textContent=texto+(medida?' no cadastro original':'');}
 return result;
};
