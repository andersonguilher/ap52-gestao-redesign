/* AP5.2 · Gestão de Contratos v2
   - seletor de contrato em "chips" (a <select> original continua no DOM e recebe o evento change)
   - medidor de vigência (dias restantes) calculado a partir do texto já exibido
   - filtro por situação no Cadastro (substitui os 3 indicadores grandes)
   Não altera dados nem regras de negócio. */
(function(){
  'use strict';
  var MS=86400000, filtro='all';
  function dt(a,b,c){ return new Date(+a,+b-1,+c); }

  function meter(strong,encerrado){
    if(strong.dataset.rioVig===strong.textContent && strong.parentElement.querySelector('.rio-vig')) return;
    strong.parentElement.querySelectorAll('.rio-vig').forEach(function(e){ e.remove(); });
    strong.dataset.rioVig=strong.textContent;
    var m=strong.textContent.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/); if(!m) return;
    var a=dt(m[3],m[2],m[1]), b=dt(m[6],m[5],m[4]), now=new Date(); now.setHours(0,0,0,0);
    var total=b-a, pct=Math.max(0,Math.min(100,total>0?(now-a)/total*100:100)), days=Math.ceil((b-now)/MS), s, txt;
    if(encerrado){ s='done'; txt='Contrato encerrado'; pct=100; }
    else if(days<0){ s='over'; txt='Vencido há '+(-days)+(-days===1?' dia':' dias'); pct=100; }
    else if(days===0){ s='danger'; txt='Vence hoje'; }
    else if(days<=30){ s='danger'; txt='Vence em '+days+(days===1?' dia':' dias'); }
    else if(days<=90){ s='warn'; txt='Vence em '+days+' dias'; }
    else if(now<a){ s='ok'; txt='Inicia em '+Math.ceil((a-now)/MS)+' dias'; pct=0; }
    else { s='ok'; txt=days+' dias restantes'; }
    var w=document.createElement('div'); w.className='rio-vig'; w.dataset.s=s;
    w.innerHTML='<div class="rio-vig-bar" role="img" aria-label="'+Math.round(pct)+'% da vigência decorrida"><i style="width:'+pct.toFixed(1)+'%"></i></div><div class="rio-vig-txt"></div>';
    w.querySelector('.rio-vig-txt').textContent=txt;
    strong.parentElement.appendChild(w);
  }

  function vigencias(){
    document.querySelectorAll('.contrato-dado, .contrato-mini-meta .item').forEach(function(box){
      var sp=box.querySelector('span'), st=box.querySelector('strong'); if(!sp||!st) return;
      if(sp.textContent.trim().toLowerCase()!=='vigência') return;
      var card=box.closest('.contrato-master, .contrato-cadastro-card'); var tag=card&&card.querySelector('.contrato-status');
      meter(st, !!tag && /encerrado/i.test(tag.textContent));
    });
  }

  function seletor(){
    var sel=document.getElementById('contrato-filtro'); var tb=sel&&sel.closest('.contrato-toolbar'); if(!tb) return;
    var box=tb.querySelector('.rio-ctr-chips');
    function sync(){ [].forEach.call(box.children,function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===sel.value)); }); }
    if(!box){
      box=document.createElement('div'); box.className='rio-ctr-chips'; box.setAttribute('role','group'); box.setAttribute('aria-label','Contrato');
      tb.appendChild(box); sel.addEventListener('change',sync);
    }
    var sig=[].map.call(sel.options,function(o){return o.value;}).join('|');
    if(box.dataset.sig!==sig){
      box.dataset.sig=sig; box.innerHTML='';
      [].forEach.call(sel.options,function(o){
        var b=document.createElement('button'); b.type='button'; b.className='rio-chip'; b.textContent=o.textContent; b.dataset.v=o.value;
        b.addEventListener('click',function(){ sel.value=o.value; sel.dispatchEvent(new Event('change',{bubbles:true})); sync(); });
        box.appendChild(b);
      });
    }
    sync();
  }

  var PLURAL={'Ativo':'Ativos','Suspenso':'Suspensos','Pendente':'Pendentes','Encerrado':'Encerrados'};
  var ORDEM=['Ativo','Suspenso','Pendente','Encerrado'];

  function filtros(){
    var body=document.getElementById('contrato-cadastro-body'); if(!body) return;
    var cards=[].slice.call(body.querySelectorAll('.contrato-cadastro-card')); if(!cards.length) return;
    var counts={};
    cards.forEach(function(c){ var t=c.querySelector('.contrato-status'); var k=t?t.textContent.trim():'Outros'; c.dataset.rioSt=k; counts[k]=(counts[k]||0)+1; });
    var bar=document.querySelector('.rio-ctr-filter');
    if(!bar){
      bar=document.createElement('div'); bar.className='rio-ctr-filter'; bar.setAttribute('role','group'); bar.setAttribute('aria-label','Filtrar por situação');
      body.parentNode.insertBefore(bar,body);
    }
    function aplicar(){
      if(filtro!=='all' && !counts[filtro]) filtro='all';
      cards.forEach(function(c){ c.hidden=(filtro!=='all' && c.dataset.rioSt!==filtro); });
      [].forEach.call(bar.children,function(b){ b.setAttribute('aria-pressed',String(b.dataset.v===filtro)); });
    }
    var sig=JSON.stringify(counts);
    if(bar.dataset.sig!==sig){
      bar.dataset.sig=sig; bar.innerHTML='';
      var keys=Object.keys(counts).sort(function(x,y){ var i=ORDEM.indexOf(x), j=ORDEM.indexOf(y); return (i<0?9:i)-(j<0?9:j); });
      [['all','Todos',cards.length]].concat(keys.map(function(k){ return [k,PLURAL[k]||k,counts[k]]; })).forEach(function(it){
        var b=document.createElement('button'); b.type='button'; b.className='rio-chip'; b.dataset.v=it[0];
        var a=document.createElement('span'); a.textContent=it[1]; var n=document.createElement('span'); n.className='n'; n.textContent=it[2];
        b.appendChild(a); b.appendChild(n);
        b.addEventListener('click',function(){ filtro=it[0]; aplicar(); });
        bar.appendChild(b);
      });
    }
    aplicar();
  }

  function run(){ seletor(); vigencias(); filtros(); }
  function boot(){
    ['contrato-painel-body','contrato-cadastro-body'].forEach(function(id){
      var el=document.getElementById(id);
      if(el&&!el.dataset.rioObs2){ el.dataset.rioObs2='1'; new MutationObserver(run).observe(el,{childList:true}); }
    });
    run();
  }
  var n=0, t=setInterval(function(){ boot(); if(++n>60) clearInterval(t); },500); boot();
})();
