/* AP5.2 · Asfaltinho · Núcleo consolidado v65.42.68
   Fonte única de verdade para situação efetiva, datas, medição e precedência de dados.
   Regra central: Medição > Planilha/relatório para execução real. */
'use strict';

const ASF_CORE_VERSAO='65.42.68';
const asfCoreBaseStatus={
  concluido:asfStatusConcluido,
  andamento:asfStatusEmAndamento,
  planejada:asfStatusPlanejada,
  texto:asfTextoStatus,
  faltas:asfFaltasFrente
};
let asfCoreIndiceCache={assinatura:'',porFrente:new Map()};

function asfCoreAssinaturaDados(){
  const max=(lista,campo='updated_at')=>(lista||[]).map(x=>String(x?.[campo]||'')).sort().at(-1)||'';
  return [
    asfaltinhoFrentes?.length||0,max(asfaltinhoFrentes),
    asfaltinhoConciliacao?.length||0,max(asfaltinhoConciliacao),
    asfaltinhoMedicoes?.length||0,max(asfaltinhoMedicoes)
  ].join('|');
}
function asfCoreInvalidar(){asfCoreIndiceCache={assinatura:'',porFrente:new Map()};}
function asfCoreIndiceMedicoes(){
  const assinatura=asfCoreAssinaturaDados();
  if(asfCoreIndiceCache.assinatura===assinatura)return asfCoreIndiceCache;
  const porFrente=new Map();
  const registrar=(frenteId,medicoes=[],origem='Medição')=>{
    const id=String(frenteId||'').trim();if(!id)return;
    const atual=porFrente.get(id)||{medida:false,medicoes:new Set(),origens:new Set()};
    atual.medida=true;
    (Array.isArray(medicoes)?medicoes:[]).forEach(n=>{const v=Number(n);if(Number.isFinite(v))atual.medicoes.add(v);});
    if(origem)atual.origens.add(origem);
    porFrente.set(id,atual);
  };
  // Vínculos confirmados valem para qualquer área do contrato.
  (asfaltinhoConciliacao||[]).forEach(c=>{
    if(!c?.frente_id||!['exato','manual'].includes(String(c.tipo_match||'')))return;
    registrar(c.frente_id,c.medicoes,'Conciliação de medições');
  });
  // Mantém a conciliação segura já usada na relação operacional AP5.2.
  try{
    (asfRuasMedidasAP52?.()||[]).forEach(x=>{
      if(x?.frente?.id)registrar(x.frente.id,[...(x.medicoes||[])],'Relação consolidada de medições');
    });
  }catch(e){console.warn('Núcleo Asfaltinho: não foi possível consolidar o índice de medições.',e);}
  asfCoreIndiceCache={assinatura,porFrente};
  return asfCoreIndiceCache;
}
function asfCoreInfoMedicaoFrente(f){
  const id=String(f?.id||'').trim();
  if(!id)return {medida:false,medicoes:[],origens:[]};
  const x=asfCoreIndiceMedicoes().porFrente.get(id);
  return x?{medida:true,medicoes:[...x.medicoes].sort((a,b)=>a-b),origens:[...x.origens]}:{medida:false,medicoes:[],origens:[]};
}
function asfCoreStatusCadastro(f){
  const percentualCadastro=asfPercentual(f?.percentual);
  const bruto=String(f?.status||'').trim();
  if(percentualCadastro>=100||/conclu/i.test(bruto))return 'Concluído';
  if(/planejad|iniciar/i.test(bruto))return 'A iniciar';
  if(/suspens/i.test(bruto))return 'Suspenso';
  return bruto||'Em andamento';
}
function asfEstadoConsolidadoFrente(f,opcoes={}){
  f=f||{};
  const info=asfCoreInfoMedicaoFrente(f);
  const medida=opcoes.medida===true||info.medida;
  const medicoes=Array.isArray(opcoes.medicoes)?opcoes.medicoes:info.medicoes;
  const inicioMedicao=asfPrimeiraExecucaoMedicaoFrente(f)||'';
  const conclusaoMedicao=asfUltimaExecucaoMedicaoFrente(f)||'';
  const inicioCadastro=String(f.inicio||'').slice(0,10);
  const conclusaoCadastro=String(f.conclusao||'').slice(0,10);
  const percentualCadastro=asfPercentual(f.percentual);
  const statusCadastro=asfCoreStatusCadastro(f);
  const concluido=medida||statusCadastro==='Concluído';
  const status=concluido?'Concluído':statusCadastro;
  const percentual=concluido?100:percentualCadastro;
  const inicio=inicioMedicao||inicioCadastro;
  const conclusao=conclusaoMedicao||conclusaoCadastro;
  const solicitanteParlamentar=typeof asfCombinarSolicitanteParlamentar==='function'?asfCombinarSolicitanteParlamentar(f):String(f.solicitante||f.parlamentar||f.responsavel_operacional||'').trim();
  return {
    id:f.id??null,
    medida,medicoes:[...new Set((medicoes||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b),
    status,statusCadastro,concluido,
    percentual,percentualCadastro,
    inicio,inicioCadastro,inicioMedicao,
    conclusao,conclusaoCadastro,conclusaoMedicao,
    previsao:String(f.previsao||'').slice(0,10),
    solicitanteParlamentar,
    fontes:{
      status:medida?'Medição · rua medida':'Cadastro da frente',
      percentual:medida?'Medição · rua medida':'Cadastro da frente',
      inicio:inicioMedicao?'Medição · primeira execução registrada':'Cadastro da frente',
      conclusao:conclusaoMedicao?'Medição · última execução registrada':'Cadastro da frente',
      solicitanteParlamentar:(!String(f.solicitante||'').trim()&&!String(f.parlamentar||'').trim()&&String(f.responsavel_operacional||'').trim())?'Relatório operacional · coluna Responsável':'Cadastro da frente'
    }
  };
}
function asfFrenteEfetiva(f,opcoes={}){
  const e=asfEstadoConsolidadoFrente(f,opcoes);
  return {...(f||{}),status:e.status,percentual:e.percentual,inicio:e.inicio,conclusao:e.conclusao,_asf_estado_consolidado:e};
}

// A partir desta versão, todas as leituras de status passam pelo mesmo núcleo.
asfStatusConcluido=function(f){return asfEstadoConsolidadoFrente(f).concluido;};
asfStatusEmAndamento=function(f){const e=asfEstadoConsolidadoFrente(f);return !e.concluido&&e.status!=='A iniciar'&&e.status!=='Suspenso'&&!/cancel|arquiv/i.test(e.status);};
asfStatusPlanejada=function(f){return asfEstadoConsolidadoFrente(f).status==='A iniciar';};
asfTextoStatus=function(f){return asfEstadoConsolidadoFrente(f).status;};

// Pendências usam a situação efetiva, sem regravar o cadastro histórico.
asfFaltasFrente=function(f,vinculadas){
  const e=asfEstadoConsolidadoFrente(f),efetiva=asfFrenteEfetiva(f),ids=new Set(vinculadas||[]);
  if(e.medida&&f?.id)ids.add(String(f.id));
  return asfCoreBaseStatus.faltas(efetiva,ids);
};

// v65.42.148.8 — o Histórico soma todas as áreas do contrato (AP5.2, AP5.1 e "A confirmar").
// A regra continua a mesma: rua que está na medição e no controle aparece uma vez só e a medição prevalece.
// A relação operacional da AP5.2 (painel, em andamento, medições) continua usando asfRuasMedidasAP52.
function asfRuasMedidasTodasAreas(){
  const todas=asfaltinhoFrentes||[];
  const frentesPorId=new Map(todas.map(f=>[String(f.id),f]));
  const porNormArea=new Map();
  todas.forEach(f=>{
    const n=asfNormLogradouroOficial(f.logradouro||'');if(!n)return;
    const k=`${f.area_responsavel||'A confirmar'}|${n}`;
    if(!porNormArea.has(k))porNormArea.set(k,[]);porNormArea.get(k).push(f);
  });
  const unica=(area,n)=>{const l=porNormArea.get(`${area}|${n}`);return l?.length===1?l[0]:null;};
  const mapa=new Map();
  (asfaltinhoConciliacao||[]).forEach(c=>{
    let frente=c.frente_id?frentesPorId.get(String(c.frente_id)):null;
    const norm=asfNormLogradouroOficial(c.logradouro_documento||'');
    const areaMed=String(c.area_medicao||'').trim()||'A confirmar';
    // Sem vínculo confirmado, só associa por nome dentro da mesma área (na dúvida, a AP5.2, como antes).
    if(!frente&&norm)frente=areaMed==='AP5.1'?unica('AP5.1',norm):(unica('AP5.2',norm)||(areaMed==='A confirmar'?unica('A confirmar',norm):null));
    if(!norm&&!frente)return;
    const area=String(frente?.area_responsavel||areaMed||'A confirmar');
    const chave=frente?.id?`frente:${frente.id}`:`${area}|${norm||c.id}`;
    const atual=mapa.get(chave)||{c,frente,medicoes:new Set(),ocorrencias:0};
    (Array.isArray(c.medicoes)?c.medicoes:[]).forEach(n=>atual.medicoes.add(Number(n)));
    atual.ocorrencias+=Number(c.ocorrencias)||0;
    if(!atual.frente&&frente)atual.frente=frente;
    mapa.set(chave,atual);
  });
  return [...mapa.values()];
}
// Área mostrada no Histórico: a área definida vale; se a frente está "A confirmar", vale a área da medição.
function asfAreaRuaHistorico(frente,c){
  const fa=String(frente?.area_responsavel||'').trim(),ma=String(c?.area_medicao||'').trim();
  if(fa&&fa!=='A confirmar')return fa;
  if(ma&&ma!=='A confirmar')return ma;
  return fa||ma||'A confirmar';
}
// Relação mestre das ruas: o mesmo objeto efetivo alimenta Ruas, filtros e consultas.
asfBaseRuasUnificada=function(aplicarBusca=true){
  const frentes=(asfaltinhoFrentes||[]).slice();
  const usadas=new Set(),linhas=[];
  (asfRuasMedidasTodasAreas()||[]).forEach(({c,frente,medicoes,ocorrencias})=>{
    if(frente?.id)usadas.add(String(frente.id));
    const nums=[...(medicoes||[])].filter(Number.isFinite).sort((a,b)=>a-b);
    const base=frente||{logradouro:c?.logradouro_documento||'',gerencia:c?.gerencia_medicao||'',area_responsavel:c?.area_medicao||'AP5.2'};
    const e=asfEstadoConsolidadoFrente(base,{medida:true,medicoes:nums});
    linhas.push({
      chave:`med:${c?.id||frente?.id||asfNormLogradouroOficial(base.logradouro)}`,frente,frenteId:frente?.id||null,medida:true,area:asfAreaRuaHistorico(frente,c),
      logradouro:c?.logradouro_documento||frente?.logradouro||'Sem logradouro',referencia:frente?.referencia||'',bairro:frente?.bairro||'',gerencia:c?.gerencia_medicao||frente?.gerencia||'',
      percentual:e.percentual,status:e.status,inicio:e.inicio,conclusao:e.conclusao,previsao:e.previsao,
      inicioMedicao:e.inicioMedicao,conclusaoMedicao:e.conclusaoMedicao,inicioCadastro:e.inicioCadastro,conclusaoCadastro:e.conclusaoCadastro,
      fonte:frente?'Medição + planilha':'Medição',medicoes:e.medicoes.length?e.medicoes:nums,ocorrencias:Number(ocorrencias)||0,estado:e
    });
  });
  frentes.forEach(f=>{
    if(usadas.has(String(f.id)))return;
    const e=asfEstadoConsolidadoFrente(f);
    linhas.push({
      chave:`frente:${f.id}`,frente:f,frenteId:f.id,medida:e.medida,area:String(f.area_responsavel||'A confirmar'),
      logradouro:f.logradouro||'Sem logradouro',referencia:f.referencia||'',bairro:f.bairro||'',gerencia:f.gerencia||'',
      percentual:e.percentual,status:e.status,inicio:e.inicio,conclusao:e.conclusao,previsao:e.previsao,
      inicioMedicao:e.inicioMedicao,conclusaoMedicao:e.conclusaoMedicao,inicioCadastro:e.inicioCadastro,conclusaoCadastro:e.conclusaoCadastro,
      fonte:e.medida?'Medição + planilha':'Planilha de controle',medicoes:e.medicoes,ocorrencias:0,estado:e
    });
  });
  const q=normalizarTextoBuscaMapa(asfaltinhoBusca||'');
  const base=aplicarBusca?linhas.filter(r=>!q||normalizarTextoBuscaMapa([r.logradouro,r.referencia,r.bairro,r.gerencia,r.fonte,r.status,r.estado?.solicitanteParlamentar].filter(Boolean).join(' ')).includes(q)):linhas;
  return base.sort((a,b)=>String(a.logradouro||'').localeCompare(String(b.logradouro||''),'pt-BR'));
};

// Diagnóstico interno para testes/regressão. Não cria UI nem chamadas extras.
function asfCoreDiagnosticoFrente(id){
  const f=(asfaltinhoFrentes||[]).find(x=>String(x.id)===String(id));
  return f?asfEstadoConsolidadoFrente(f):null;
}
