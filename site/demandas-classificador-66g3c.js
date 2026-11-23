/* AP52 65.42.156.4.12.1 / 6.6G.4C — Motor R3 conforme decisões de 20/10/2026.
   Função pura; sem rede ou persistência. A interface apenas apresenta candidatos. */
(function(){
'use strict';
/**
 * AP5.2 — 6.6G.3B-R3: motor puro de sugestões, SEM ESCRITA.
 * Entrada: {assunto, observacao, historica, tipo, gerencia, modalidade}, catálogo oficial (28/65).
 * Saída: sugestão TRANSITÓRIA, com evidências e sem alteração de demanda/serviço.
 * Importante: sugestão NÃO é classificação automática, execução ou comprovação.
 */
const normalizar = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const tokens = texto => {
  const out = [];
  let clause=0,ultimoFim=0;
  const rx = /[\p{L}\p{N}]+/gu;
  for (const m of String(texto??'').matchAll(rx)) {
    if(/[;!?\n]/.test(String(texto).slice(ultimoFim,m.index)))clause++;
    out.push({valor:normalizar(m[0]),ini:m.index,fim:m.index+m[0].length,clause});
    ultimoFim=m.index+m[0].length;
  }
  return out;
};
const values = t => t.map(x=>x.valor);
const mesmaSequencia = (t,i,v) => v.every((x,k)=>t[i+k]?.valor===x);
const trecho = (texto,t,i,n)=>texto.slice(t[i].ini,t[i+n-1].fim);
const contemSeq = (arr,pat)=>arr.some((_,j)=>pat.every((x,k)=>arr[j+k]===x));
const anyMatch = (str,rx)=>rx.test(str);
const textoNormalizado = v => values(tokens(v)).join(' ');

function contextoPermitido(t,entrada){
  if(t.contexto==='geral')return true;
  if(t.contexto==='demanda_historica')return entrada.historica===true && entrada.tipo!=='bds';
  if(t.contexto==='bds_drenagem_21gc')return entrada.tipo==='bds' && entrada.gerencia==='21ª GC' && entrada.modalidade==='drenagem';
  return false;
}
function semPedido(ts,indice){
  // Escopo de cláusula evita que uma negação em um serviço elimine os outros.
  let antes=ts.slice(Math.max(0,indice-7),indice).filter(x=>x.clause===ts[indice]?.clause).map(x=>x.valor);
  const reset=Math.max(antes.lastIndexOf('apenas'),antes.lastIndexOf('somente'),antes.lastIndexOf('so'));
  if(reset!==-1)antes=antes.slice(reset+1);
  const before=antes;
  if(contemSeq(before,['nao','solicito']) || contemSeq(before,['nao','solicitamos']) ||
     contemSeq(before,['nao','pedimos']) || contemSeq(before,['nao','quero']) ||
     contemSeq(before,['nao','realizar']) || contemSeq(before,['nao','executar']) ||
     contemSeq(before,['sem','necessidade','de']) || contemSeq(before,['dispenso']))return true;
  return false;
}
function contextoTemporal(ts,ini,fim){
  const anteriores=ts.slice(Math.max(0,ini-6),ini).map(t=>t.valor);
  const posteriores=ts.slice(fim,Math.min(ts.length,fim+7)).map(t=>t.valor);
  if(contemSeq(anteriores,['ja','executado']) || contemSeq(anteriores,['ja','realizado']) ||
      contemSeq(anteriores,['servico','executado']) || contemSeq(anteriores,['servico','ja','executado']) ||
      contemSeq(posteriores,['ja','executado']) || contemSeq(posteriores,['ja','realizado']))return 'historico';
  if(contemSeq(posteriores,['nao','foi','feito']) || contemSeq(posteriores,['nao','foi','executado']) ||
      contemSeq(anteriores,['nao','executado']))return 'historico_ambiguo';
  return null;
}
function baseResultado(tipo, id, area, fonte, evidencia, motivo, dados={}){
 return {tipo,identificador:id,servico_id: dados.servico_id??null,area:area??null,fonte,evidencia_literal:evidencia,termo_catalogo:dados.termo_catalogo??null,motivo,
 exige_conferencia:true,confirmado:false,estado_atendimento:null,comprovacao:null,evidencias:[{fonte,trecho:evidencia}],...dados};
}
function adicionar(colecao,c,forcar=false){
 const key=(c.tipo==='servico_catalogo'?'servico:':'outro:')+(c.identificador??c.motivo);
 const prev=colecao.get(key);
 if(prev){
  for(const e of c.evidencias)if(!prev.evidencias.some(x=>x.fonte===e.fonte&&x.trecho===e.trecho))prev.evidencias.push(e);
  prev.necessita_conferencia=prev.necessita_conferencia||c.necessita_conferencia;
  if(forcar)prev.motivo=c.motivo;
  return;
 }
 colecao.set(key,c);
}
function interpretarFamiliasR2(texto,tt,fonte,achados,exclusoes){
 const vs=values(tt);
 const p=(id,tipo,area,start,count,reason)=>{
  if(semPedido(tt,start)){exclusoes.push({fonte,trecho:trecho(texto,tt,start,count),motivo:'A própria solicitação exclui esta intervenção.'});return;}
  adicionar(achados,baseResultado(tipo,id,area,fonte,trecho(texto,tt,start,count),reason));
 };
 for(let i=0;i<vs.length;i++){
  const action=vs[i];
  if(!['reposicao','reconstrucao','instalacao','construcao'].includes(action))continue;
  let objPos=-1, obj=null;
  for(let j=i+1;j<=Math.min(i+3,vs.length-1);j++){
   if(['grelha','grelhas','tampao','tampoes'].includes(vs[j])){objPos=j;obj=vs[j].startsWith('grelha')?'grelha':'tampao';break;}
   if(['e','mas','porem','sem','nao','para'].includes(vs[j]))break;
  }
  if(objPos<0)continue;
  const codigoId=`${action}_${obj}`;
  const next=vs.slice(objPos+1,objPos+5);
  const material=next.includes('ferro')?'ferro':next.includes('concreto')?'concreto':null;
  const count=objPos-i+1+(material?Math.min(next.indexOf(material)+1,3):0);
  const evid=trecho(texto,tt,i,count);
  if(semPedido(tt,i)){exclusoes.push({fonte,trecho:evid,motivo:'Menção negada: não é serviço solicitado.'});continue;}
  // Os serviços exatos (quando material conhecido) são reconhecidos pelo catálogo.
  if(material && action==='reposicao')continue;
  if(material && action==='reconstrucao' && material==='concreto')continue;
  if(action==='instalacao'||action==='construcao'){
   p(null,'fora_catalogo','Drenagem',i,count,`Instalação é conceitualmente construção; o catálogo oficial não possui construção de ${obj}. Não converter em reposição nem em construção de caixa de ralo.`);
  }else if(!material){
   p(`${codigoId}_material_indefinido`,'servico_a_identificar','Drenagem',i,count,
    `O material do(a) ${obj} não foi informado. Conferir ferro/concreto e a intervenção exata; não selecionar serviço do catálogo sem confirmação.`);
  }else{
   p(null,'fora_catalogo','Drenagem',i,count,`Não há serviço aprovado que corresponda com segurança a ${action} de ${obj} de ${material}. Conferência necessária.`);
  }
 }
}
function outrasObservacoesR2(texto,tt,fonte,achados,exclusoes){
 const vs=values(tt),flat=vs.join(' ');
 for(let i=0;i<tt.length;i++){
  if(['afundamento','afundamentos'].includes(vs[i])){
   if(semPedido(tt,i))continue;
   adicionar(achados,baseResultado('problema','afundamento',null,fonte,trecho(texto,tt,i,1),'Problema relatado: não escolher automaticamente tapa-buraco ou recuperação/reconstrução.'));
  }
  if(['desobstrucao','desentupimento'].includes(vs[i])){
   if(semPedido(tt,i))continue;
   const obj=vs.slice(i+1,i+4).find(x=>['ralo','gap','galeria','bueiro'].includes(x));
   adicionar(achados,baseResultado('servico_a_identificar','desobstrucao', 'Drenagem', fonte,
    trecho(texto,tt,i,Math.min(tt.length-i,obj?3:1)),
    `Desobstrução${obj?' de '+obj:''} requer identificar o método. Conferir com a gerência se é limpeza manual ou limpeza mecânica; não selecionar automaticamente.`,
    {opcoes_servico:['limpeza_manual','limpeza_mecanica'],servico_id:null,necessita_conferencia:true}));
  }
 }
 if(flat.includes('vazamento de agua potavel')||flat.includes('vazamento de agua tratada')){
   adicionar(achados,baseResultado('contexto_ambiguo','vazamento_agua_potavel',null,fonte,texto.trim(),
     'Possível competência distinta; encaminhar para conferência, sem atribuir competência automaticamente.'));
 }
 // Outros casos frequentes observados nos assuntos agregados, sem serviço compatível nos 28.
 for(const [rx,id,reason] of [
  [/\b(construcao|recuperacao|reconstrucao|instalacao) de calcada\b/,'calcada','Serviço de calçada não consta dos 28 serviços deste catálogo; requer conferência.'],
  [/\bconstrucao de baia de estacionamento\b/,'baia_estacionamento','Construção de baia não consta dos 28 serviços deste catálogo; requer conferência.']
 ]){
  if(rx.test(flat))adicionar(achados,baseResultado('fora_catalogo',id,null,fonte,texto.trim(),reason));
 }
}
function interpretarFamilias(texto,tt,fonte,achados,exclusoes,entrada,servicos){
 const vs=values(tt);
 const p=(id,tipo,area,start,count,reason,dados={})=>{
  if(semPedido(tt,start)){exclusoes.push({fonte,trecho:trecho(texto,tt,start,count),motivo:'A própria solicitação exclui esta intervenção.'});return;}
  adicionar(achados,baseResultado(tipo,id,area,fonte,trecho(texto,tt,start,count),reason,dados));
 };
 for(let i=0;i<vs.length;i++){
  const action=vs[i];
  if(!['reposicao','reconstrucao','instalacao','construcao'].includes(action))continue;
  let objPos=-1,obj=null;
  const limite=action==='instalacao'?8:3;
  for(let j=i+1;j<=Math.min(i+limite,vs.length-1);j++){
   if(action==='instalacao'&&tt[j]?.clause!==tt[i]?.clause)break;
   if(['grelha','grelhas','tampao','tampoes'].includes(vs[j])){objPos=j;obj=vs[j].startsWith('grelha')?'grelha':'tampao';break;}
   if(['e','mas','porem','sem','nao','para'].includes(vs[j]))break;
  }
  if(objPos<0)continue;
  const codigoId=`${action}_${obj}`;
  const next=vs.slice(objPos+1,objPos+5);
  const material=next.includes('ferro')?'ferro':next.includes('concreto')?'concreto':null;
  const count=objPos-i+1+(material?Math.min(next.indexOf(material)+1,3):0);
  const evid=trecho(texto,tt,i,count);
  if(semPedido(tt,i)){exclusoes.push({fonte,trecho:evid,motivo:'Menção negada: não é serviço solicitado.'});continue;}
  // Decisão R3: instalação de grelha/tampão equivale a reposição (somente demandas).
  if(action==='instalacao'&&entrada.tipo!=='bds'){
   if(!material){
    p('reposicao_'+obj+'_material_indefinido','servico_a_identificar','Drenagem',i,count,
      'Instalação tratada como reposição. Falta confirmar o material: concreto ou ferro. Nenhum serviço selecionado.',
      {opcoes_servico:['reposicao_'+obj+'_concreto','reposicao_'+obj+'_ferro'],necessita_conferencia:true});
   }else{
    const codigo='reposicao_'+obj+'_'+material,servico=servicos.get(codigo);
    if(servico)p(codigo,'servico_catalogo','Drenagem',i,count,
      'Instalação tratada como reposição mediante decisão operacional; conferir antes de registrar.',
      {servico_id:servico.id?.startsWith('fixture_')?null:servico.id??null,codigo_servico:codigo,nome_servico:servico.nome,necessita_conferencia:true});
    else p(null,'servico_a_identificar','Drenagem',i,count,
      'Reposição equivalente precisa de conferência no catálogo.',{necessita_conferencia:true});
   }
   continue;
  }
  // Demais famílias: manter exatamente a lógica R2 homologada.
  if(material && action==='reposicao')continue;
  if(material && action==='reconstrucao' && material==='concreto')continue;
  if(action==='instalacao'||action==='construcao'){
   p(null,'fora_catalogo','Drenagem',i,count,`Instalação é conceitualmente construção; o catálogo oficial não possui construção de ${obj}. Não converter em reposição nem em construção de caixa de ralo.`);
  }else if(!material){
   p(`${codigoId}_material_indefinido`,'servico_a_identificar','Drenagem',i,count,
    `O material do(a) ${obj} não foi informado. Conferir ferro/concreto e a intervenção exata; não selecionar serviço do catálogo sem confirmação.`);
  }else{
   p(null,'fora_catalogo','Drenagem',i,count,`Não há serviço aprovado que corresponda com segurança a ${action} de ${obj} de ${material}. Conferência necessária.`);
  }
 }
}

// 4.12.1: "junto à caixa de ralo" exige a mesma cautela de "de caixa de ralo".
// A decisão de sugerir GAP para locais específicos permanece pendente.
function tipoLocalAfundamento(vs,i){
 const proximos=vs.slice(i+1,i+11);
 const limite=proximos.findIndex(v=>['e','mais','tapa','reposicao','reconstrucao','recuperacao','desobstrucao'].includes(v));
 const tail=(limite>=0?proximos.slice(0,limite):proximos).join(' ');
 // Preposições variantes de locais/estruturas bloqueiam a sugestão genérica de GAP.
 if(/^(?:(?:de|do|da|em|no|na|nos|nas) )?(?:esgoto|rede de esgoto|rede de aguas? servidas?)\b/.test(tail))return 'esgoto';
 // 4.12.5: localização adjacente ao problema, sem procurar estruturas em outro serviço.
 // As flexões/contrações são explícitas; não usamos um curinga até encontrar "ralo".
 const preposicao='(?:de|do|da|dos|das|em|no|na|nos|nas|(?:sobre|sob)(?: (?:o|a|os|as))?)';
 const proximidade='(?:(?:junto|junta|juntos|juntas|proximo|proxima|proximos|proximas|perto|em frente) (?:a|ao|as|aos|de|do|da|dos|das))';
 const estrutura='(?:passeios?|calcadas?|(?:caixas?|cx) de ralos?|ralos?|ramal(?: de ralos?)?|ramais(?: de ralos?)?|tampao|tampoes|pvs?)';
 if(new RegExp('^(?:(?:'+preposicao+'|'+proximidade+') )?'+estrutura+'\\b').test(tail))return 'local_especifico';
 return 'generico';
}

function regrasEspeciaisR3(texto,tt,fonte,achados,exclusoes,entrada,servicos){
 if(entrada.tipo==='bds')return; // BDS não é pedido. A comparação deve resultar idêntica à R2.
 const vs=values(tt),flat=vs.join(' ');
 const marcar=(i,n,tipo,id,area,motivo,dados={})=>{
  if(semPedido(tt,i))return;
  adicionar(achados,baseResultado(tipo,id,area,fonte,trecho(texto,tt,i,n),motivo,dados));
 };
 const serv=(i,n,codigo,motivo)=>{
  const r=servicos.get(codigo);if(!r||semPedido(tt,i))return;
  adicionar(achados,baseResultado('servico_catalogo',codigo,r.area||null,fonte,trecho(texto,tt,i,n),motivo,{
   servico_id:r.id?.startsWith('fixture_')?null:r.id??null,codigo_servico:codigo,nome_servico:r.nome,necessita_conferencia:true}));
 };
 for(let i=0;i<vs.length;i++){
  const token=vs[i];
  // A/B: afundamento genérico sugere Recuperação de GAP, mas problema permanece separado.
  if(token==='afundamento'||token==='afundamentos'){
   if(semPedido(tt,i))continue;
   const natureza=tipoLocalAfundamento(vs,i);
   if(natureza==='esgoto'){
    marcar(i,Math.min(3,tt.length-i),'contexto_ambiguo','afundamento_esgoto',null,
      'Afundamento de esgoto: competência a conferir, possivelmente concessionária. Nenhum serviço sugerido.');
   }else if(natureza==='local_especifico'){
    marcar(i,Math.min(7,tt.length-i),'servico_a_identificar','afundamento_local_especifico','Drenagem',
      'Afundamento com local específico: definir intervenção antes de sugerir recuperação de GAP.');
   }else{
    serv(i,1,'recuperacao_gap','Afundamento sugere Recuperação de GAP por decisão operacional; exige conferência humana.');
   }
  }
  // F: palavras inteiras no ASSUNTO apenas; não reconhecer "TB" dentro de outras siglas.
  if(token==='tb')serv(i,1,'tapa_buraco','Sigla TB interpretada como tapa-buraco; exige conferência.');
  if(token==='raspagem'||token==='respagem')serv(i,1,'preparo_solo',
     'Raspagem/respagem interpretada como preparo de solo; exige conferência.');
  // C: reparo de PV / CX de ralo tem duas possibilidades; nenhuma é selecionada.
  if(token==='reparo'&&vs[i+1]==='de'){
   if(vs[i+2]==='pv')marcar(i,3,'servico_a_identificar','reparo_pv','Drenagem',
       'Reparo de PV: verificar recuperação ou reconstrução. O catálogo oferece Reconstrução de PV ou somente área.',
       {opcoes_servico:['reconstrucao_pv'],necessita_conferencia:true});
   if((vs[i+2]==='cx'||vs[i+2]==='caixa')&&vs[i+3]==='de'&&vs[i+4]==='ralo')
    marcar(i,5,'servico_a_identificar','reparo_caixa_ralo','Drenagem',
       'Reparo de caixa de ralo: verificar recuperação ou reconstrução. O catálogo oferece Reconstrução de caixa de ralo ou somente área.',
       {opcoes_servico:['reconstrucao_caixa_ralo'],necessita_conferencia:true});
  }
  // D: reconstrução de parede da caixa não autoriza selecionar reconstrução da caixa inteira.
  if(token==='reconstrucao'&&vs[i+1]==='de'&&vs[i+2]==='parede'&&vs[i+3]==='de'&&
     (vs[i+4]==='cx'||vs[i+4]==='caixa')&&
     ((vs[i+5]==='de'&&vs[i+6]==='ralo')||(vs[i+5]==='no'&&vs[i+6]==='oposto')))
    marcar(i,7,'servico_a_identificar','parede_caixa_ralo','Drenagem',
       'Reconstrução parcial de parede: confirmar se corresponde à reconstrução de caixa de ralo.',
       {opcoes_servico:['reconstrucao_caixa_ralo'],necessita_conferencia:true});
 }
}

function outrasObservacoes(texto,tt,fonte,achados,exclusoes,entrada){
 const vs=values(tt),flat=vs.join(' ');
 for(let i=0;i<tt.length;i++){
  if(['afundamento','afundamentos'].includes(vs[i])){
   if(semPedido(tt,i))continue;
   const natureza=tipoLocalAfundamento(vs,i);
   const motivo=natureza==='esgoto'
    ?'Problema relatado. Competência a conferir, possivelmente concessionária; nenhum serviço de reparo é sugerido.'
    :natureza==='local_especifico'
      ?'Problema relatado em local específico. Identifique a intervenção necessária antes de incluir; Recuperação de GAP não é sugerida.'
      :'Problema relatado. A sugestão de Recuperação de GAP precisa ser conferida antes de incluir.';
   adicionar(achados,baseResultado('problema','afundamento',null,fonte,trecho(texto,tt,i,1),motivo));
  }
  if(['desobstrucao','desentupimento'].includes(vs[i])){
   if(semPedido(tt,i))continue;
   const obj=vs.slice(i+1,i+4).find(x=>['ralo','gap','galeria','bueiro'].includes(x));
   adicionar(achados,baseResultado('servico_a_identificar','desobstrucao', 'Drenagem', fonte,
    trecho(texto,tt,i,Math.min(tt.length-i,obj?3:1)),
    `Desobstrução${obj?' de '+obj:''} requer identificar o método. Conferir com a gerência se é limpeza manual ou limpeza mecânica; não selecionar automaticamente.`,
    {opcoes_servico:['limpeza_manual','limpeza_mecanica'],servico_id:null,necessita_conferencia:true}));
  }
 }
 if(flat.includes('vazamento de agua potavel')||flat.includes('vazamento de agua tratada')){
   adicionar(achados,baseResultado('contexto_ambiguo','vazamento_agua_potavel',null,fonte,texto.trim(),
     'Possível competência distinta; encaminhar para conferência, sem atribuir competência automaticamente.'));
 }
 // Outros casos frequentes observados nos assuntos agregados, sem serviço compatível nos 28.
 for(const [rx,id,reason] of [
  [/\b(construcao|recuperacao|reconstrucao|instalacao) de calcada\b/,'calcada','Serviço de calçada não consta dos 28 serviços deste catálogo; requer conferência.'],
  [/\bconstrucao de baia de estacionamento\b/,'baia_estacionamento','Construção de baia não consta dos 28 serviços deste catálogo; requer conferência.']
 ]){
  if(rx.test(flat))adicionar(achados,baseResultado('fora_catalogo',id,null,fonte,texto.trim(),reason));
 }
}
function agrupamento(achados,exclusoes){
 const c=[...achados.values()];
 const s=c.filter(x=>x.tipo==='servico_catalogo');
 const outros=c.filter(x=>x.tipo!=='servico_catalogo');
 const neg=exclusoes.length>0;
 if(!c.length) return 'sem_correspondencia';
 if(c.length===1&&c[0].identificador==='vazamento_agua_potavel')return 'competencia_a_conferir';
 if(c.length===1&&c[0].tipo==='problema')return 'problema';
 if(c.length===1&&c[0].tipo==='fora_catalogo')return 'fora_catalogo';
 if(c.length===1&&c[0].tipo==='servico_a_identificar'&&!neg)return 'incompleto';
 if(outros.length||neg)return 'misto';
 if(s.some(x=>x.temporalidade==='historico_ambiguo'))return 'historico_ambiguo';
 if(s.some(x=>x.temporalidade==='historico'))return 'historico';
 if(s.some(x=>x.motivo.includes('O.T.')||x.termo_catalogo==='OT'))return 'ambiguo';
 if(s.some(x=>x.necessita_conferencia))return 'catalogo_para_conferencia';
 if(s.length>1)return 'catalogo_multiplo';
 return 'catalogo';
}
/** Função pura, de leitura: sem import de Supabase, fetch, escrita, DOM ou chamadas assíncronas. */
function analisarDemanda(entrada, catalogo){
 if(!catalogo||!Array.isArray(catalogo.servicos)||!Array.isArray(catalogo.termos)||
     catalogo.servicos.length!==28||catalogo.termos.length!==65){
   return {erro:'CATALOGO_INCOMPLETO',gravacao_automatica:false,candidatos:[],pendencias:['Catálogo incompleto ou indisponível; nenhuma sugestão apresentada.']};
 }
 const servicos=new Map(catalogo.servicos.map(x=>[x.codigo,x]));
 // Apenas o ASSUNTO gera candidatos de pedidos; observações podem relatar execução já realizada.
 // Preservar o texto da observação para leitura humana, mas não gerar candidatos a partir dela.
 const fontes=[['assunto',String(entrada?.assunto??'')]].filter(x=>x[1].trim());
 const observacaoOriginal=String(entrada?.observacao??'');
 const trechosObservacao=observacaoOriginal.trim()?[
   {fonte:'observacao',trecho:observacaoOriginal,rotulo:'Citado na observação, não é pedido',gera_sugestao:false}
 ]:[];
 const achados=new Map(),exclusoes=[];
 for(const [fonte,texto] of fontes){
  const tt=tokens(texto); if(!tt.length)continue;
  for(const termo of catalogo.termos){
   if(!contextoPermitido(termo,entrada))continue;
   const vsTermo=values(tokens(termo.termo));
   if(!vsTermo.length)continue;
   for(let i=0;i<=tt.length-vsTermo.length;i++){
    if(!mesmaSequencia(tt,i,vsTermo))continue;
    const ev=trecho(texto,tt,i,vsTermo.length);
    if(semPedido(tt,i)){exclusoes.push({fonte,trecho:ev,motivo:'A menção foi negada pelo solicitante.'});continue;}
    const servico=servicos.get(termo.servico_codigo);if(!servico)continue;
    const temporalidade=contextoTemporal(tt,i,i+vsTermo.length);
    const sensivel=!!termo.exige_conferencia || termo.termo.toUpperCase()==='BURACO NA VIA' ||
      (servico.codigo==='reposicao_tampao_ferro'&&values(tt).slice(i+vsTermo.length,i+vsTermo.length+1)[0]==='fundido') ||
      (entrada.tipo!=='bds'&&servico.codigo==='limpeza_mecanica'&&['vac-all','vacc-all','vacal'].includes(normalizar(termo.termo))); 
    const motivo=sensivel?(termo.exige_conferencia?'Sigla/termo exige conferência explícita (ex.: O.T.).':
      'Correspondência histórica ou material com complemento; avaliar contexto e evidência.'):
      'Correspondência lexical com o catálogo oficial; exige avaliação humana.';
    const candidate=baseResultado('servico_catalogo',servico.codigo,servico.area,fonte,ev,motivo,{
      servico_id:servico.id?.startsWith('fixture_')?null:servico.id??null,
      termo_catalogo:termo.termo,codigo_servico:servico.codigo,nome_servico:servico.nome,
      necessita_conferencia:sensivel,temporalidade,contexto_termo:termo.contexto});
    adicionar(achados,candidate);
   }
  }
  if(entrada.tipo==='bds'){
   interpretarFamiliasR2(texto,tt,fonte,achados,exclusoes);
   outrasObservacoesR2(texto,tt,fonte,achados,exclusoes);
  }else{
   interpretarFamilias(texto,tt,fonte,achados,exclusoes,entrada,servicos);
   outrasObservacoes(texto,tt,fonte,achados,exclusoes,entrada);
   regrasEspeciaisR3(texto,tt,fonte,achados,exclusoes,entrada,servicos);
  }
 }
 const candidatos=[...achados.values()].map(x=>({...x,evidencias:x.evidencias??[]}));
 const global=agrupamento(achados,exclusoes);
 const pendencias=candidatos.filter(x=>x.tipo!=='servico_catalogo'||x.necessita_conferencia||x.temporalidade)
  .map(x=>({identificador:x.identificador,descricao:x.motivo}));
 if(!candidatos.length)pendencias.push({identificador:null,descricao:'Nenhum serviço identificável com segurança. Conferir manualmente.'});
 return {tipo_resultado:global,candidatos,exclusoes,pendencias,trechos_observacao:trechosObservacao,
    texto_original:{assunto:String(entrada?.assunto??''),observacao:String(entrada?.observacao??'')},
    gravacao_automatica:false,confirmado:false,estado_atendimento:null,comprovacao:null,
    escopo_analise:'Sugestão transitória. Não grava, não confirma, não define execução, não substitui BDS/SEI.'};
}


const assinaturaCatalogoReferencia=Object.freeze({
 tipo:'fingerprints homologados de referência documental (não calculados em tempo real)',
 areas:'39715689eb059a9fb454ad406c50ea2b',
 servicos:'db70923f0d497c4e065cf06a6e29071e',
 termos:'449a5850ad275e30a8c59d8d3bbd3ac5',
 quantidades:Object.freeze({areas:2,servicos:28,termos:65})
});
const identificacao=Object.freeze({versaoMotor:'6.6G.3B-R3',versaoIntegracao:'65.42.156.4.12.5',
 versaoCatalogoReferencia:'6.6G.1',assinaturaCatalogoReferencia,
 aviso:'Assinaturas documentais: catálogo real validado separadamente por cardinalidade e estrutura.'});
window.AP52Classificador66g3b=Object.freeze({analisarDemanda,normalizar,identificacao});
})();
