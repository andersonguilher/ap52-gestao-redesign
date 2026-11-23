/* AP5.2 · Escalas dos conjugados — visão em calendário (alternável para a lista original)
   Lê as tabelas já renderizadas pelo sistema; não altera dados nem regras. */
(function(){
  'use strict';
  var MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var SEMANA=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  var modo='cal';

  function mesAno(root){
    var h=root.querySelector('.escala-mes-titulo h2'); if(!h) return null;
    var m=h.textContent.trim().toLowerCase().match(/([a-zçãé]+)\s*\/\s*(\d{4})/); if(!m) return null;
    var i=MESES.indexOf(m[1]); return i<0?null:{m:i,y:+m[2]};
  }

  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function partes(t){ var p=t.split(/\s*[·•]\s*/); if(p.length>1) return esc(p[0])+'<em>'+esc(p.slice(1).join(' · ').replace(/(\d{1,2}):00/g,'$1h').replace(/\s*às\s*/,'–'))+'</em>'; return esc(t); }
  function bloco(sec,ma){
    if(sec.querySelector('.rio-cal')) return;
    var tbl=sec.querySelector('table'); if(!tbl) return;
    var dias={}, hoje=0;
    [].forEach.call(tbl.querySelectorAll('tr'),function(tr){
      var tds=tr.querySelectorAll('td'); if(tds.length<2) return;
      var d=parseInt(tds[0].textContent,10); if(!d) return;
      var valor=tds[1].textContent.replace(/\s+/g,' ').trim();
      var plantao=/plant[ãa]o/i.test(valor) || tds[1].querySelector('[class*="plantao"]');
      var isHoje=/hoje/i.test(tds[0].textContent) || tr.classList.contains('hoje');
      if(isHoje) hoje=d;
      dias[d]={v:valor, p:!!plantao, w:tr.classList.contains('fim-semana'), x:tr.className};
    });
    var total=new Date(ma.y,ma.m+1,0).getDate();
    var primeiro=(new Date(ma.y,ma.m,1).getDay()+6)%7;      // segunda = 0
    var cal=document.createElement('div'); cal.className='rio-cal';
    var html='<div class="rio-cal-semana">'+SEMANA.map(function(s){return '<span>'+s+'</span>';}).join('')+'</div><div class="rio-cal-grade">';
    for(var i=0;i<primeiro;i++) html+='<div class="rio-cal-dia rio-vazio"></div>';
    for(var d=1; d<=total; d++){
      var x=dias[d]||{v:'—',p:false,w:false};
      var dow=(primeiro+d-1)%7, fim=dow>=5;
      var vazio=(x.v==='—'||x.v===''||x.v==='-');
      var cls='rio-cal-dia'+(fim?' rio-fim':'')+(d===hoje?' rio-hoje':'')+(x.p?' rio-plantao':'')+(vazio?' rio-sem':'');
      var txt=vazio?'':x.v.replace(/^plant[ãa]o\s*/i,'');
      html+='<div class="'+cls+'" title="'+d+' · '+(vazio?'sem escala':x.v)+'"><b>'+d+'</b>'+(d===hoje?'<i>Hoje</i>':'')+(txt?'<span>'+partes(txt)+'</span>':'')+'</div>';
    }
    html+='</div>';
    cal.innerHTML=html; sec.appendChild(cal);
  }

  function aplicar(){
    var wrap=document.getElementById('equip-escalas-tabela'); if(!wrap) return;
    var ma=mesAno(wrap); if(!ma) return;
    var dupla=wrap.querySelector('.escala-dupla'); if(!dupla) return;
    [].forEach.call(dupla.querySelectorAll('section.escala-bloco'),function(s){ bloco(s,ma); });
    dupla.classList.toggle('rio-cal-on',modo==='cal');
    var bar=document.querySelector('.rio-vista-bar');
    if(!bar){
      bar=document.createElement('div'); bar.className='rio-vista-bar'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','Modo de visualização');
      bar.innerHTML='<button type="button" class="rio-chip" data-m="cal">Calendário</button><button type="button" class="rio-chip" data-m="lista">Lista</button>';
      var tb=document.querySelector('#equip-escalas-wrap .toolbar'); if(tb) tb.appendChild(bar); else wrap.parentNode.insertBefore(bar,wrap);
      bar.addEventListener('click',function(e){ var b=e.target.closest('button'); if(!b) return; modo=b.dataset.m; aplicar(); });
    }
    [].forEach.call(bar.children,function(b){ b.setAttribute('aria-pressed',String(b.dataset.m===modo)); });
  }

  function boot(){
    var w=document.getElementById('equip-escalas-tabela');
    if(w&&!w.dataset.rioObs4){ w.dataset.rioObs4='1'; new MutationObserver(aplicar).observe(w,{childList:true}); }
    aplicar();
  }
  var n=0, t=setInterval(function(){ boot(); if(++n>60) clearInterval(t); },500); boot();
})();
