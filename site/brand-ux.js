/* AP5.2 · Divulgação progressiva (não altera regras de negócio nem dados) */
(function(){
  'use strict';
  var LS='ap52.rio.acc.v1', st={};
  try{ st=JSON.parse(localStorage.getItem(LS)||'{}'); }catch(e){}
  function save(){ try{ localStorage.setItem(LS,JSON.stringify(st)); }catch(e){} }

  /* seções analíticas: [seletor, aberta por padrão] */
  var ACC=[
    ['.pessoal-relatorios-rapidos',false],
    ['.pessoal-overview-distribuicoes',false],
    ['.pessoal-gerencias',false],
    ['.pessoal-evolucao',false],
    ['.pessoal-estabilidade',false],
    ['.pessoal-movimentacoes',false]
  ];

  function setOpen(sec,head,open){
    sec.classList.toggle('rio-collapsed',!open);
    head.setAttribute('aria-expanded',String(open));
  }
  function initAcc(){
    ACC.forEach(function(a){
      document.querySelectorAll(a[0]).forEach(function(sec){
        if(sec.dataset.rioAcc) return;
        var head=sec.firstElementChild; if(!head) return;
        sec.dataset.rioAcc=a[0];
        head.classList.add('rio-acc-head');
        head.setAttribute('role','button'); head.tabIndex=0;
        setOpen(sec,head,a[0] in st ? !!st[a[0]] : a[1]);
        function toggle(){ var open=sec.classList.contains('rio-collapsed'); setOpen(sec,head,open); st[a[0]]=open; save(); }
        head.addEventListener('click',function(ev){
          if(ev.target.closest('select,input,a,label') ) return;
          if(ev.target.closest('button') && ev.target.closest('button')!==head) return;
          toggle();
        });
        head.addEventListener('keydown',function(ev){
          if((ev.key==='Enter'||ev.key===' ') && ev.target===head){ ev.preventDefault(); toggle(); }
        });
      });
    });
  }

  /* Atenção necessária: esconde itens com contagem 0 */
  function markZeros(){
    var list=document.getElementById('pessoal-atencao-lista'); if(!list) return;
    var any=false;
    list.querySelectorAll('.pessoal-atencao-item').forEach(function(b){
      var q=b.querySelector('.pessoal-atencao-qtd');
      var zero=!!q && q.textContent.trim()==='0';
      b.classList.toggle('rio-zero',zero); if(!zero) any=true;
    });
    list.parentElement.classList.toggle('rio-all-zero',!any && list.children.length>0);
    var note=list.parentElement.querySelector('.rio-ok-note');
    if(!note){ note=document.createElement('p'); note.className='rio-ok-note'; note.textContent='Nenhuma ocorrência que exija ação agora.'; list.after(note); }
  }

  /* Alertas e pendências: 5 primeiros + "Mostrar todas" */
  var LIMIT=5, expanded=false;
  function limitPend(){
    var list=document.getElementById('pessoal-pendencias-lista'); if(!list) return;
    var items=[].slice.call(list.children).filter(function(e){return e.classList.contains('pessoal-pendencia-item');});
    items.forEach(function(e,i){ e.classList.toggle('rio-extra',!expanded && i>=LIMIT); });
    var btn=document.getElementById('rio-pend-more');
    if(items.length<=LIMIT){ if(btn) btn.remove(); return; }
    if(!btn){
      btn=document.createElement('button'); btn.type='button'; btn.id='rio-pend-more'; btn.className='rio-more';
      btn.addEventListener('click',function(){ expanded=!expanded; limitPend(); });
      list.after(btn);
    }
    btn.textContent=expanded?'Mostrar menos':'Mostrar todas ('+items.length+')';
  }

  function observe(id,fn){
    var el=document.getElementById(id); if(!el||el.dataset.rioObs) return;
    el.dataset.rioObs='1';
    new MutationObserver(function(){ fn(); }).observe(el,{childList:true,subtree:true,characterData:true});
    fn();
  }

  /* Funcionários: gaveta do dossiê/resumo (desktop) */
  function initDrawer(){
    var panel=document.getElementById('pessoal-contexto'); if(!panel||panel.dataset.rioDrawer) return;
    panel.dataset.rioDrawer='1';
    var bd=document.createElement('div'); bd.className='rio-drawer-backdrop'; bd.hidden=true; panel.parentElement.insertBefore(bd,panel);
    var x=document.createElement('button'); x.type='button'; x.className='rio-drawer-close'; x.setAttribute('aria-label','Fechar painel'); x.textContent='×'; x.hidden=true; panel.parentElement.insertBefore(x,panel.nextSibling);
    function isOpen(){ return panel.classList.contains('pessoal-contexto-selecionado')||panel.classList.contains('rio-resumo-open'); }
    function sync(){ var wide=window.matchMedia('(min-width:821px)').matches; var o=wide&&isOpen(); bd.hidden=!o; x.hidden=!(o&&!panel.classList.contains('pessoal-contexto-selecionado')); }
    function close(){
      panel.classList.remove('rio-resumo-open');
      var f=document.getElementById('pessoal-contexto-fechar'); if(f&&panel.classList.contains('pessoal-contexto-selecionado')) f.click();
      sync();
    }
    new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
    bd.addEventListener('click',close); x.addEventListener('click',close);
    document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&isOpen()) close(); });
    document.addEventListener('click',function(e){
      var b=e.target.closest('.ps15-abrir-resumo'); if(!b) return;
      setTimeout(function(){ if(window.matchMedia('(min-width:821px)').matches){ panel.classList.add('rio-resumo-open'); sync(); } },0);
    },true);
    window.addEventListener('resize',sync); sync();
  }

  function boot(){
    initAcc(); initDrawer();
    observe('pessoal-atencao-lista',markZeros);
    observe('pessoal-pendencias-lista',limitPend);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
  /* conteúdo é preenchido depois do login: tenta de novo por alguns segundos */
  var n=0, t=setInterval(function(){ boot(); if(++n>40) clearInterval(t); },500);
})();

/* RVL: assistente por etapas (reaproveita rvlIrEtapa/rvlIrPrevia e o scrollspy existente sem alterá-los) */
(function(){
  'use strict';
  var cur=1, nav=null;
  function V(){ return document.getElementById('view-rvl'); }
  function names(){ return [].map.call(document.querySelectorAll('#view-rvl .rvl-step b'),function(b){return b.textContent.trim();}); }
  function ensureNav(){
    var v=V(); if(!v||nav&&nav.isConnected) return;
    var ed=v.querySelector('.rvl-editor'), bottom=v.querySelector('.rvl-bottom-actions'); if(!ed) return;
    nav=document.createElement('div'); nav.className='rio-wiz-nav';
    nav.innerHTML='<button type="button" class="btn rio-back">← Voltar</button><span class="rio-wiz-pos"></span><button type="button" class="btn btn-primary rio-next">Avançar →</button>';
    ed.insertBefore(nav,bottom||null);
    nav.querySelector('.rio-back').addEventListener('click',function(){ go(Math.max(1,cur-1)); });
    nav.querySelector('.rio-next').addEventListener('click',function(){ go(Math.min(6,cur+1)); });
  }
  function go(n){
    var v=V(); if(!v) return; ensureNav(); cur=n;
    v.classList.add('rio-wizard'); v.classList.toggle('rio-step-final',n===6);
    v.querySelectorAll('.rvl-card[data-rvl-step]').forEach(function(c){ c.classList.toggle('rio-step-on',Number(c.dataset.rvlStep)===n); });
    v.querySelectorAll('.rvl-step').forEach(function(b,i){ b.classList.toggle('is-active',i===n-1); });
    if(nav){
      var nm=names();
      nav.querySelector('.rio-back').hidden=(n===1);
      nav.querySelector('.rio-next').hidden=(n===6);
      nav.querySelector('.rio-next').textContent=(n===5?'Conferir prévia':'Avançar: '+(nm[n]||''))+' →';
      nav.querySelector('.rio-wiz-pos').textContent='Etapa '+n+' de 6'+(nm[n-1]?' · '+nm[n-1]:'');
    }
    if(n===6){
      try{ if(typeof rvlAtualizarPrevia==='function') rvlAtualizarPrevia(); }catch(e){}
      setTimeout(function(){ window.dispatchEvent(new Event('resize')); },60);
    }
    var h=v.querySelector('.rvl-page-head'); var top=h?h.getBoundingClientRect().top+window.scrollY-12:0;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }
  window.rvlIrEtapa=function(n){ go(Number(n)||1); };
  window.rvlIrPrevia=function(){ go(6); };
  function boot(){ if(V()&&V().querySelector('.rvl-editor')) go(cur); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

/* Logo/marca da sidebar volta ao início */
(function(){
  'use strict';
  function boot(){
    var name=document.querySelector('.sidebar .brand-name'), sub=document.querySelector('.sidebar .brand-sub');
    if(!name||name.parentElement.classList.contains('rio-home-link')) return;
    var a=document.createElement('div'); a.className='rio-home-link'; a.setAttribute('role','link'); a.tabIndex=0;
    a.setAttribute('aria-label','Ir para o início (Gestão de Pessoal · Painel)'); a.title='Ir para o início';
    name.parentNode.insertBefore(a,name); a.appendChild(name); if(sub) a.appendChild(sub);
    function home(){
      if(window.matchMedia('(max-width:820px)').matches && typeof voltarInicioMobile==='function'){ voltarInicioMobile(); return; }
      if(typeof mudarView==='function') mudarView('overview');
      window.scrollTo({top:0,behavior:'smooth'});
    }
    a.addEventListener('click',home);
    a.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); home(); } });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

/* Contratos: blocos auxiliares recolhidos por padrão */
(function(){
  'use strict';
  function head(sec){ return sec.querySelector(':scope > .contrato-historico-head, :scope > .contrato-auto-head') || sec.firstElementChild; }
  function apply(){
    var body=document.getElementById('contrato-painel-body'); if(!body) return;
    body.querySelectorAll('.contrato-historico-card, .contrato-auto').forEach(function(sec){
      if(sec.dataset.rioAcc) return; var h=head(sec); if(!h) return;
      sec.dataset.rioAcc='1'; h.classList.add('rio-acc-head'); h.setAttribute('role','button'); h.tabIndex=0;
      sec.classList.add('rio-collapsed'); h.setAttribute('aria-expanded','false');
      function t(){ var open=sec.classList.contains('rio-collapsed'); sec.classList.toggle('rio-collapsed',!open); h.setAttribute('aria-expanded',String(open)); }
      h.addEventListener('click',function(e){ if(e.target.closest('select,input,a,label')) return; var b=e.target.closest('button'); if(b&&b!==h) return; t(); });
      h.addEventListener('keydown',function(e){ if((e.key==='Enter'||e.key===' ')&&e.target===h){ e.preventDefault(); t(); } });
    });
  }
  function boot(){
    var body=document.getElementById('contrato-painel-body');
    if(body&&!body.dataset.rioObs){ body.dataset.rioObs='1'; new MutationObserver(apply).observe(body,{childList:true}); }
    apply();
    var topo=document.querySelector('.ap52u-topo'); if(topo) topo.classList.add('rio-hero');
  }
  var n=0,t=setInterval(function(){ boot(); if(++n>40) clearInterval(t); },500); boot();
})();

/* Breadcrumb: cada nível (exceto o atual) volta para a tela correspondente */
(function(){
  'use strict';
  var MAP={
    'gestão de pessoal':function(){ mudarView('overview'); },
    'gestão de contratos':function(){ abrirSecaoContratos('painel'); },
    'equipamentos':function(){ abrirSecaoEquip('painel'); },
    'almoxarifado':function(){ abrirSecaoAlmox('painel'); },
    'mapa das gerências':function(){ mudarView('mapa'); },
    'demandas':function(){ mudarView('demandas'); }
  };
  function home(){ if(typeof mudarView==='function') mudarView('overview'); window.scrollTo({top:0,behavior:'smooth'}); }
  function mk(txt,fn){
    var a=document.createElement('a'); a.className='rio-crumb'; a.setAttribute('role','link'); a.tabIndex=0; a.textContent=txt;
    a.addEventListener('click',function(e){ e.preventDefault(); fn(); });
    a.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fn(); } });
    return a;
  }
  function wrap(c){
    if(c.dataset.rioCrumb) return;
    var u=c.querySelector('.unidade-contexto');
    if(u&&!u.classList.contains('rio-crumb')){ u.classList.add('rio-crumb'); u.setAttribute('role','link'); u.tabIndex=0; u.title='Ir para o início';
      u.addEventListener('click',home); u.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); home(); } }); }
    [].slice.call(c.childNodes).forEach(function(nd){
      if(nd.nodeType!==3||nd.textContent.indexOf('/')<0) return;
      var frag=document.createDocumentFragment();
      nd.textContent.split('/').forEach(function(part,i,arr){
        var txt=part.replace(/\u00a0/g,' ').trim();
        if(i>0) frag.appendChild(document.createTextNode(' / '));
        var isLast=(i===arr.length-1) && !nd.nextSibling;
        var fn=MAP[txt.toLowerCase()];
        if(txt && fn && !isLast) frag.appendChild(mk(txt,fn)); else if(txt) frag.appendChild(document.createTextNode(txt));
      });
      nd.parentNode.replaceChild(frag,nd);
    });
    c.dataset.rioCrumb='1';
  }
  function boot(){ document.querySelectorAll('.crumbs, .crumb').forEach(wrap); }
  var n=0,t=setInterval(function(){ boot(); if(++n>40) clearInterval(t); },500); boot();
})();

/* Funcionários: popover de filtros fecha ao clicar fora ou com Esc */
(function(){
  'use strict';
  function d(){ return document.getElementById('pessoal-filtros-detalhes'); }
  document.addEventListener('click',function(e){
    var el=d(); if(!el||!el.open) return;
    if(window.matchMedia('(max-width:820px)').matches) return;
    if(!e.target.closest('#pessoal-filtros-detalhes')) el.open=false;
  });
  document.addEventListener('keydown',function(e){
    var el=d(); if(e.key==='Escape'&&el&&el.open&&!window.matchMedia('(max-width:820px)').matches){ el.open=false; var s=el.querySelector('summary'); if(s) s.focus(); }
  });
})();

/* Ponto: dias sem registro não repetem a etiqueta "Sem registro" */
(function(){
  'use strict';
  function mark(){
    var g=document.getElementById('ponto-grid'); if(!g) return;
    g.querySelectorAll('.day-cell').forEach(function(c){
      var t=c.querySelector('.day-tag'); c.classList.toggle('rio-nodata',!!t&&t.textContent.trim()==='Sem registro');
    });
    [].forEach.call(g.children,function(c,i){ c.classList.toggle('rio-weekend',(i%7)>=5 && !c.classList.contains('day-empty')); });
  }
  function boot(){
    var g=document.getElementById('ponto-grid'); if(!g||g.dataset.rioObs) return;
    g.dataset.rioObs='1'; new MutationObserver(mark).observe(g,{childList:true,subtree:true,characterData:true}); mark();
  }
  var n=0,t=setInterval(function(){ boot(); if(++n>40) clearInterval(t); },500); boot();
})();

/* Central de Ação: botão com indicadores (atenção = vermelho; comunicados novos = ciano) */
(function(){
  'use strict';
  function sync(){
    var t=document.getElementById('central-acao-toggle'); if(!t) return;
    var pill=t.querySelector('.rio-ca-att');
    if(!pill){ pill=document.createElement('span'); pill.className='rio-ca-pill rio-ca-att'; pill.setAttribute('aria-hidden','true'); t.insertBefore(pill,t.querySelector('.central-acao-toggle-badge')||null); }
    var res=document.querySelector('.central-atencao-resumo');
    var n=res?(parseInt(res.textContent,10)||0):0;
    /* só conta se existem itens de verdade na lista (e não o estado "tudo tranquilo") */
    var itens=document.querySelectorAll('#central-acao .central-atencao-item').length;
    var tranq=!!document.querySelector('#central-acao .central-atencao-tranquilo');
    if(!itens||tranq) n=0;
    var urgent=!!(res&&res.classList.contains('tem-alerta'))||!!document.querySelector('.central-atencao-item.urgente');
    pill.textContent=String(Math.min(n,99));
    pill.classList.toggle('rio-on',n>0); pill.classList.toggle('rio-urgent',n>0&&urgent);
    var com=t.classList.contains('tem-itens')?(parseInt((t.querySelector('.central-acao-toggle-badge')||{}).textContent,10)||0):0;
    var txt=[]; if(n>0) txt.push(n+' em atenção'); if(com>0&&t.classList.contains('tem-itens')) txt.push(com+' comunicado(s) novo(s)');
    /* animação: sempre que houver itens em atenção ou comunicados novos */
    var sig=n+':'+(urgent?1:0)+':'+com;
    t.classList.toggle('rio-attn',(n>0||com>0)); t.classList.toggle('rio-attn-urgent',n>0&&urgent);
    t.dataset.rioSig=sig;
    t.setAttribute('aria-label','Central de Ação'+(txt.length?': '+txt.join(', '):'')); t.title=txt.length?txt.join(' · '):'Central de Ação';
  }
  function boot(){
    var p=document.getElementById('central-acao'); if(p&&!p.dataset.rioObs){ p.dataset.rioObs='1'; new MutationObserver(sync).observe(p,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']}); }
    var t=document.getElementById('central-acao-toggle'); if(t&&!t.dataset.rioObs){ t.dataset.rioObs='1'; new MutationObserver(sync).observe(t,{attributes:true,attributeFilter:['class']}); }
    sync();
  }
  var n=0,i=setInterval(function(){ boot(); if(++n>60) clearInterval(i); },500); boot();
})();

/* Nome da gerência: reduz a fonte até caber inteiro em uma linha */
(function(){
  'use strict';
  function fit(){
    var el=document.querySelector('.sidebar .brand-sub'); if(!el) return;
    var host=el.parentElement; if(!host||!host.clientWidth) return;
    var avail=host.clientWidth-(host.classList.contains('rio-home-link')?16:0);
    var size=11; el.style.fontSize=size+'px'; el.style.display='inline-block'; el.style.maxWidth='none';
    while(el.scrollWidth>avail && size>7){ size-=0.25; el.style.fontSize=size+'px'; }
  }
  function boot(){
    var el=document.querySelector('.sidebar .brand-sub'); if(!el||el.dataset.rioFit) return;
    el.dataset.rioFit='1';
    new MutationObserver(fit).observe(el,{childList:true,characterData:true,subtree:true});
    if(window.ResizeObserver) new ResizeObserver(fit).observe(el.parentElement);
    window.addEventListener('resize',fit); fit();
  }
  var n=0,t=setInterval(function(){ boot(); fit(); if(++n>40) clearInterval(t); },500); boot();
})();
