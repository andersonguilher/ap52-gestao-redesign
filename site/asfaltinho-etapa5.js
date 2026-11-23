/* Navegação contextual Ruas → Medições → Ruas, sem consulta adicional. */
'use strict';
const asf65={usuario:null,retorno:null};
function asf65Sessao(){const id=sessaoAtual?.user?.id||null;if(asf65.usuario!==id){asf65.usuario=id;asf65.retorno=null;}}
function asf65LinksMedicoes(r){
 asf65Sessao();if(!r.medicoes.length)return '';
 return `<span class="asf65-links"><span>Medições:</span>${r.medicoes.map(n=>asfaltinhoMedicoes.some(m=>Number(m.numero)===Number(n))?`<button type="button" data-asf65-medicao="${asf54Esc(n)}" data-asf65-rua="${asf54Esc(r.logradouro)}" aria-label="Consultar ${asf54Esc(n)}ª medição de ${asf54Esc(r.logradouro)}">${asf54Esc(n)}ª ↗</button>`:`<span class="asf54-status">${asf54Esc(n)}ª</span>`).join('')}</span>`;
}
function asf65Abrir(numero,rua){
 asf65Sessao();if(secaoContratos!=='asfaltinho'||asfaltinhoAba!=='ruas'||!pode28('contratos','visualizar'))return;
 const n=Number(numero);if(!asfaltinhoMedicoes.some(m=>Number(m.numero)===n))return;
 asf65.retorno={usuario:asf65.usuario,scroll:scrollY,busca:asfaltinhoBusca,filtros:{gerencia:asf64.gerencia,status:asf64.status,fonte:asf64.fonte,medicao:asf64.medicao,pagina:asf64.pagina},medicaoAnterior:asf54.medicao,selecionadaAnterior:asfaltinhoMedicaoSelecionada,rua:String(rua||''),numero:n};
 asf54Sessao();asf54.medicao=String(n);asfaltinhoMedicaoSelecionada=null;
 asf65TrocarBase('medicoes');requestAnimationFrame(()=>{const b=document.getElementById('asf65-voltar');b?.scrollIntoView({block:'start'});b?.focus({preventScroll:true});});
}
function asf65Voltar(){
 asf65Sessao();const r=asf65.retorno;if(!r||r.usuario!==sessaoAtual?.user?.id||!pode28('contratos','visualizar'))return;
 asf65.retorno=null;asfaltinhoBusca=r.busca;Object.assign(asf64,r.filtros);asf54.medicao=r.medicaoAnterior;asfaltinhoMedicaoSelecionada=r.selecionadaAnterior;
 asf65TrocarBase('ruas');requestAnimationFrame(()=>{scrollTo(0,r.scroll);const botao=[...document.querySelectorAll('[data-asf65-medicao]')].find(b=>b.dataset.asf65Medicao===String(r.numero)&&b.dataset.asf65Rua===r.rua);(botao||document.getElementById('asf64-busca'))?.focus({preventScroll:true});});
}
const asf65MedicoesBase=asfMedicoes;
asfMedicoes=function(){asf65Sessao();const r=asf65.retorno;return (r?`<div class="asf65-return"><button type="button" class="btn btn-ghost" id="asf65-voltar" onclick="asf65Voltar()">← Voltar ao Histórico</button><div><strong>${asf54Esc(r.rua)}</strong><p>Consulta iniciada pela ${asf54Esc(r.numero)}ª medição. Os detalhes abrangem toda a medição, não apenas esta rua.</p></div></div>`:'')+asf65MedicoesBase();};
const asf65TrocarBase=trocarAbaAsfaltinho;
trocarAbaAsfaltinho=function(aba){asf65Sessao();asf65.retorno=null;return asf65TrocarBase(aba);};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-asf65-medicao]');if(b)asf65Abrir(b.dataset.asf65Medicao,b.dataset.asf65Rua);});
