/* AP5.2 · Equipamentos / Mapa / Almoxarifado (v2) — apresentação apenas; não altera dados ou regras */
(function(){
  'use strict';

  /* cabeçalhos no padrão (azul + triângulo) */
  function heroes(){
    ['#view-equipamentos .eq27-heading','#view-mapa .mapa-page-head'].forEach(function(s){
      var el=document.querySelector(s); if(el) el.classList.add('rio-hero');
    });
  }

  /* Equipamentos: seletor de contrato em chips (a <select> continua no DOM e recebe o evento) */
  function eqChips(){
    var sel=document.getElementById('eq27-contrato'); var host=sel&&sel.closest('.eq27-contract-scope'); if(!host) return;
    var box=host.querySelector('.rio-ctr-chips');
    function sync(){ [].forEach.call(box.children,function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===sel.value)); }); }
    if(!box){
      box=document.createElement('div'); box.className='rio-ctr-chips'; box.setAttribute('role','group'); box.setAttribute('aria-label','Contrato');
      host.appendChild(box); sel.addEventListener('change',sync);
    }
    var sig=[].map.call(sel.options,function(o){return o.value;}).join('|');
    if(box.dataset.sig!==sig){
      box.dataset.sig=sig; box.innerHTML='';
      [].forEach.call(sel.options,function(o){
        var b=document.createElement('button'); b.type='button'; b.className='rio-chip'; b.dataset.v=o.value;
        b.textContent=o.value===''?'Todos os contratos':o.textContent;
        b.addEventListener('click',function(){ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); sync(); });
        box.appendChild(b);
      });
    }
    sync();
  }

  /* Equipamentos · Painel: seções após a primeira ficam recolhidas (abrem ao clicar) */
  function eqSecoes(){
    var wrap=document.getElementById('equip-painel-wrap'); if(!wrap) return;
    [].forEach.call(wrap.children,function(sec,i){
      if(sec.tagName!=='SECTION'||sec.dataset.rioAcc) return;
      var h=sec.firstElementChild; if(!h) return;
      sec.dataset.rioAcc='1'; h.classList.add('rio-acc-head'); h.setAttribute('role','button'); h.tabIndex=0;
      var open=(i===0); sec.classList.toggle('rio-collapsed',!open); h.setAttribute('aria-expanded',String(open));
      function t(){ var o=sec.classList.contains('rio-collapsed'); sec.classList.toggle('rio-collapsed',!o); h.setAttribute('aria-expanded',String(o)); }
      h.addEventListener('click',function(e){ if(e.target.closest('select,input,a,label')) return; var b=e.target.closest('button'); if(b&&b!==h) return; t(); });
      h.addEventListener('keydown',function(e){ if((e.key==='Enter'||e.key===' ')&&e.target===h){ e.preventDefault(); t(); } });
    });
  }

  function run(){ heroes(); eqChips(); eqSecoes(); }
  function boot(){
    var w=document.getElementById('equip-painel-wrap');
    if(w&&!w.dataset.rioObs3){ w.dataset.rioObs3='1'; new MutationObserver(eqSecoes).observe(w,{childList:true}); }
    run();
  }
  var n=0, t=setInterval(function(){ boot(); if(++n>60) clearInterval(t); },500); boot();
})();

/* Almoxarifado v2 — seletor de material em chips (Painel) e barra de nível (Estoque). Só apresentação. */
(function(){
  'use strict';
  function chips(){
    var dash=document.getElementById('almox-dashboard'); if(!dash) return;
    var sel=document.getElementById('almox-grafico-material'); if(!sel) return;
    var grid=dash.querySelector('.almox-grid'); if(!grid) return;
    var box=dash.querySelector('.rio-almox-chips');
    function sync(){ if(box) [].forEach.call(box.children,function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===sel.value)); }); }
    if(!box){
      box=document.createElement('div'); box.className='rio-ctr-chips rio-almox-chips'; box.setAttribute('role','group'); box.setAttribute('aria-label','Material analisado');
      grid.parentNode.insertBefore(box,grid);
    }
    if(!sel.dataset.rioBound){ sel.dataset.rioBound='1'; sel.addEventListener('change',sync); }
    var sig=[].map.call(sel.options,function(o){return o.value;}).join('|');
    if(box.dataset.sig!==sig){
      box.dataset.sig=sig; box.innerHTML='';
      [].forEach.call(sel.options,function(o){
        var b=document.createElement('button'); b.type='button'; b.className='rio-chip'; b.dataset.v=o.value; b.textContent=o.textContent;
        b.addEventListener('click',function(){ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); sync(); });
        box.appendChild(b);
      });
    }
    sync();
  }

  function barras(){
    var wrap=document.getElementById('almox-posicao-wrap'); var t=wrap&&wrap.querySelector('table'); if(!t) return;
    var ths=[].filter.call(t.querySelectorAll('thead th'),function(h){return h.offsetParent;}).map(function(h){return h.textContent.trim().toLowerCase();});
    var iS=ths.indexOf('saldo'), iM=ths.indexOf('mínimo'); if(iS<0||iM<0) return;
    [].forEach.call(t.querySelectorAll('tbody tr'),function(tr){
      var tds=tr.querySelectorAll('td'); if(tds.length!==ths.length) return;
      var cell=tds[iS]; if(cell.querySelector('.rio-nivel')) return;
      var s=parseFloat(String(tds[iS].textContent).replace(/\./g,'').replace(',','.'))||0, m=parseFloat(String(tds[iM].textContent).replace(/\./g,'').replace(',','.'))||0;
      if(m<=0) return;
      var ratio=s/m, pct=Math.max(0,Math.min(100,ratio/2*100)), cls=ratio<1?'baixo':ratio<1.5?'atencao':'ok';
      var bar=document.createElement('div'); bar.className='rio-nivel '+cls; bar.title='Saldo '+s+' · mínimo '+m;
      bar.innerHTML='<i style="width:'+pct.toFixed(0)+'%"></i><u></u>'; cell.appendChild(bar);
    });
  }

  function boot(){
    ['almox-dashboard','almox-posicao-wrap'].forEach(function(id){
      var el=document.getElementById(id);
      if(el&&!el.dataset.rioObs5){ el.dataset.rioObs5='1'; new MutationObserver(function(){ chips(); barras(); }).observe(el,{childList:true,subtree:true}); }
    });
    chips(); barras();
  }
  var n=0,t=setInterval(function(){ boot(); if(++n>80) clearInterval(t); },500); boot();
})();
