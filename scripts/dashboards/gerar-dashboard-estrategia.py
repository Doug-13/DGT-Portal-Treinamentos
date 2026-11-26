#!/usr/bin/env python3
r"""Gera o JSON do dashboard "Planejamento Estratégico — Visão 2029" a partir da planilha
"10. Acompanhamento da estratégia.xlsx", com os dados EMBUTIDOS (fontes "planilha.*").

Mesmas regras do painel HTML original (Painel_DGT_com_dados):
  - Quadro de Metas: 6 indicadores (aba "Quadro de Metas"), meta e real por mês e acumulado;
  - KRs: aba "Acompanhamento Pilares" (ignora a "- LEO"), status pelo acumulado;
  - Ações: aba "Ações" (cabeçalho AÇÃO / Área / Dono / Comentários / Status / Situação / Data limite);
  - Status: No alvo >= 80% da meta, Atenção 70–79%, Crítico < 70%, Sem dado
    (indicadores "menor é melhor", como tempo de proposta e churn: meta ÷ real).

Uso (Windows, na pasta do projeto):
  py -m pip install openpyxl
  py scripts\dashboards\gerar-dashboard-estrategia.py "C:\caminho\10. Acompanhamento da estratégia.xlsx" 2026

Gera dashboard-planejamento-estrategico.json na pasta atual. No portal:
Indicadores › Gerenciar dashboards › (Novo ou Editar) › Carregar arquivo .json › Salvar.
"""
import sys
if len(sys.argv) < 2:
    print(__doc__); sys.exit(2)
ARQ = sys.argv[1]
ANO = int(sys.argv[2]) if len(sys.argv) > 2 else 2026
SAIDA = sys.argv[3] if len(sys.argv) > 3 else 'dashboard-planejamento-estrategico.json'
import openpyxl, unicodedata, re, json, datetime, sys
wb=openpyxl.load_workbook(ARQ,data_only=True)
MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
def norm(v): return ''.join(c for c in unicodedata.normalize('NFD',('' if v is None else str(v)).lower()) if unicodedata.category(c)!='Mn').strip()
def aoa(nome): return [list(r) for r in wb[nome].iter_rows(values_only=True)]
def qnum(v,u):
    if v is None or v=='': return None
    if isinstance(v,(int,float)): x=float(v)
    else:
        s=re.sub(r'%|R\$|\s|Mi|mi|\bh\b','',str(v))
        s=s.replace('.','').replace(',','.') if ('.' in s and ',' in s) else s.replace(',','.')
        try: x=float(s)
        except: return None
    if u=='pct': return x*100 if abs(x)<=1.5 else x
    if u=='mi': return x/1000
    return x
def status(meta,real,dir='up'):
    if meta is None or real is None: return 'Sem dado'
    if meta==0 and real==0: return 'Sem dado'
    if meta==0: return 'No alvo' if real>0 else 'Sem dado'
    if dir=='down' and real==0: return 'No alvo'
    r=(meta/real) if dir=='down' else (real/meta); r*=100
    return 'No alvo' if r>=80 else 'Atenção' if r>=70 else 'Crítico'
def ating(meta,real,dir='up'):
    if not meta or real is None: return None
    if dir=='down': return round(meta/real*100,1) if real else None
    return round(real/meta*100,1)
UNID={'mi':'R$ mi','pct':'%','num':'nº','dias':'dias','brl':'R$','score':'nota','horas':'horas'}
def r2(x): return None if x is None else round(x,3)

# ---- Quadro de Metas
QM_DEF=[["Faturamento","faturamento","mi"],["Receita Recorrente","receita recorrente","mi"],["EBITDA","ebitda","pct"],["NRR","nrr","pct"],["Lucro Operacional","lucro operacional","pct"],["% Processos Críticos Mapeados","processos critic","pct"]]
nome=[n for n in wb.sheetnames if 'quadro' in norm(n) and 'meta' in norm(n)][0]; A=aoa(nome)
hdr=acum=-1
for r in range(min(len(A),15)):
    row=[norm(x) for x in A[r]]
    if 'acumulado' in row: hdr=r; acum=row.index('acumulado'); break
ini=acum+2; metas=[]; mensais=[]
for nomeI,chave,u in QM_DEF:
    rr=next((r for r in range(hdr+1,len(A)) if any(chave in norm(v) for v in A[r])),None)
    if rr is None: continue
    row=A[rr]+[None]*80
    am,ar=qnum(row[acum],u),qnum(row[acum+1],u)
    metas.append({"indicador":nomeI,"unidade":UNID[u],"metaAcumulada":r2(am),"realizadoAcumulado":r2(ar),"atingimento":ating(am,ar),"status":status(am,ar),"metas":1})
    for i,m in enumerate(MESES):
        me,re_=qnum(row[ini+2*i],u),qnum(row[ini+2*i+1],u)
        mensais.append({"indicador":nomeI,"unidade":UNID[u],"mes":i+1,"meta":r2(me),"realizado":r2(re_),"atingimento":ating(me,re_),"status":status(me,re_)})

# ---- KRs (Acompanhamento Pilares, sem LEO)
KR_DEF=[["entregas de produtos",["num","up"]],["demandas concluidas",["pct","up"]],["taxa de disponibilidade",["pct","up"]],["tempo de proposta",["dias","down"]],["forecast comercial publico",["brl","up"]],["forecast comercial privado",["brl","up"]],["aderencia ao bom",["pct","up"]],["projetos dentro do prazo",["pct","up"]],["csat",["score","up"]],["uptime",["pct","up"]],["churn publico",["pct","down"]],["churn privado",["pct","down"]],["receita recorrente",["mi","up"]],["tempo reduzido",["horas","up"]],["margem de lucro",["pct","up"]],["custo com servico terceiro",["brl","down"]],["cumprimento do plano de treinamento",["num","up"]],["avaliacao trimestral",["num","up"]],["indice de engajamento",["pct","up"]],["rituais de cultura",["num","up"]]]
def krdef(n):
    n=norm(n)
    for k,d in KR_DEF:
        if k in n: return d
    return ["num","up"]
nome=[n for n in wb.sheetnames if 'pilar' in norm(n) and 'leo' not in norm(n)][0]; A=aoa(nome)
for r in range(min(len(A),12)):
    row=[norm(x) for x in A[r]]
    if 'kr' in row:
        hdr=r; cK=row.index('kr'); cP=next(i for i,x in enumerate(row) if 'pilar' in x); cO=next((i for i,x in enumerate(row) if 'objetiv' in x),-1)
        cD=next((i for i,x in enumerate(row) if 'dono' in x or 'respons' in x),-1); cA=next(i for i,x in enumerate(row) if 'acumulado' in x); break
krs=[]; pil=''
for r in range(hdr+2,len(A)):
    row=A[r]+[None]*80
    if row[cP] not in (None,'') and str(row[cP]).strip(): pil=str(row[cP]).strip()
    kr=row[cK]
    if kr is None or not str(kr).strip(): continue
    u,d=krdef(kr); me,re_=qnum(row[cA],u),qnum(row[cA+1],u)
    krs.append({"pilar":pil,"indicador":str(kr).strip(),"objetivo":str(row[cO] or '').strip() if cO>=0 else '',"responsavel":str(row[cD] or '').strip() if cD>=0 else '',
                "unidade":UNID[u],"direcao":"Menor é melhor" if d=='down' else "Maior é melhor","meta":r2(me),"realizado":r2(re_),"atingimento":ating(me,re_,d),"status":status(me,re_,d),"indicadores":1})

# ---- Ações
nome=[n for n in wb.sheetnames if norm(n) in ('acoes','acao')][0]; A=aoa(nome)
hr=-1
for i in range(min(len(A),60)):
    row=[norm(c) for c in A[i]]
    iA=next((j for j,c in enumerate(row) if c=='acao' or c.startswith('acao')),-1)
    if iA<0: continue
    has=lambda *k: next((j for j,c in enumerate(row) if any(x in c for x in k)),-1)
    iArea,iDono,iCom,iSit,iData=has('area'),has('dono','respons'),has('coment','observ'),has('situa','farol'),has('data','limite','prazo de conclus')
    iSt=next((j for j,c in enumerate(row) if c=='status' or c.startswith('status')),-1)
    if iSt<0: iSt=has('status')
    if max(iArea,iDono,iSt,iSit)>=0: hr=i; C=dict(acao=iA,area=iArea,dono=iDono,com=iCom,st=iSt,sit=iSit,data=iData); break
def g(row,i):
    if i<0 or i>=len(row) or row[i] is None: return ''
    v=row[i]
    if isinstance(v,datetime.datetime): return v.strftime('%Y-%m-%d')
    return str(v).strip()
def sit(t):
    t=norm(t); return 'Atrasado' if 'atras' in t else 'Concluído' if 'conclu' in t else 'No prazo'
def stt(t):
    t=norm(t); return 'Concluído' if 'conclu' in t else 'Não iniciado' if ('nao inic' in t or 'naoinic' in t) else 'Em andamento'
acoes=[]
for i in range(hr+1,len(A)):
    row=A[i]; a=g(row,C['acao'])
    if not a or norm(a)=='acao': continue
    data=g(row,C['data'])
    m=re.match(r'(\d{4})-(\d{2})-(\d{2})',data) or None
    if not m:
        m2=re.match(r'(\d{2})/(\d{2})/(\d{4})',data)
        if m2: data=f"{m2.group(3)}-{m2.group(2)}-{m2.group(1)}"; m=re.match(r'(\d{4})-(\d{2})-(\d{2})',data)
    st=g(row,C['st'])
    acoes.append({"acao":a,"area":g(row,C['area']) or 'Sem área',"responsavel":g(row,C['dono']) or '—',"andamento":stt(st),"situacao":sit(g(row,C['sit']) or st),
                  "dataLimite":data if m else '',"mes":int(m.group(2)) if m else None,"comentario":g(row,C['com']),"acoes":1})
dados={"metas":metas,"metasMensais":mensais,"indicadores":krs,"acoes":acoes}

# ================= Montagem do dashboard =================
for k in dados:
    for l in dados[k]: l['ano']=ANO
ST=['No alvo','Atenção','Crítico','Sem dado']
C=lambda chave,rotulo,tipo,valores=None: dict(chave=chave,rotulo=rotulo,tipo=tipo,**({'valores':valores} if valores else {}))
ano=C('ano','Ano','numero')
fontes=[
 dict(id='planilha.metas',nome='Quadro de Metas — acumulado',descricao='Uma linha por indicador do Quadro de Metas: meta e realizado acumulados, atingimento e status.',
      campos=[C('indicador','Indicador','texto'),C('unidade','Unidade','texto'),C('metaAcumulada','Meta acumulada','numero'),C('realizadoAcumulado','Realizado acumulado','numero'),C('atingimento','Atingimento (%)','numero'),C('status','Status','texto',ST),C('metas','Quantidade (1 por indicador)','numero'),ano],linhas=dados['metas']),
 dict(id='planilha.metasMensais',nome='Quadro de Metas — por mês',descricao='Uma linha por indicador e mês: meta, realizado, atingimento e status do mês.',
      campos=[C('indicador','Indicador','texto'),C('unidade','Unidade','texto'),C('mes','Mês','mes'),C('meta','Meta do mês','numero'),C('realizado','Realizado do mês','numero'),C('atingimento','Atingimento (%)','numero'),C('status','Status do mês','texto',ST),ano],linhas=dados['metasMensais']),
 dict(id='planilha.indicadores',nome='Indicadores (KRs) por pilar',descricao='Uma linha por KR: pilar, objetivo, responsável, meta e realizado acumulados, atingimento e status.',
      campos=[C('pilar','Pilar','texto'),C('indicador','Indicador (KR)','texto'),C('objetivo','Objetivo','texto'),C('responsavel','Responsável','texto'),C('unidade','Unidade','texto'),C('direcao','Direção','texto',['Maior é melhor','Menor é melhor']),C('meta','Meta acumulada','numero'),C('realizado','Realizado acumulado','numero'),C('atingimento','Atingimento (%)','numero'),C('status','Status','texto',ST),C('indicadores','Quantidade (1 por KR)','numero'),ano],linhas=dados['indicadores']),
 dict(id='planilha.acoes',nome='Plano de ações',descricao='Uma linha por ação: área, responsável, status, situação (no prazo / atrasado / concluído), data limite e comentário.',
      campos=[C('acao','Ação','texto'),C('area','Área','texto'),C('responsavel','Responsável','texto'),C('andamento','Status','texto',['Concluído','Em andamento','Não iniciado']),C('situacao','Situação','texto',['Concluído','No prazo','Atrasado']),C('dataLimite','Data limite','data'),C('mes','Mês da data limite','mes'),C('comentario','Comentário','texto'),C('acoes','Quantidade (1 por ação)','numero'),ano],linhas=dados['acoes'])]
M,MM,K,A='planilha.metas','planilha.metasMensais','planilha.indicadores','planilha.acoes'
def card(t,f,m,filtro=None,fmt='inteiro',ag='soma',comp=None,larg=None):
    c=dict(tipo='cartao',titulo=t,fonte=f,medida=m,agregacao=ag,formato=fmt)
    if filtro: c['filtro']=filtro
    if comp: c['comparar']=comp
    return c
meta=lambda ind,t: card(t,M,'realizadoAcumulado',{'indicador':ind},'numero',comp={'medida':'metaAcumulada','rotulo':'Meta'})
d={"formato":"dgt-portal/dashboard@1",
 "titulo":"Planejamento Estratégico — Visão 2029",
 "descricao":"Ser referência nacional em soluções críticas de segurança e decisão, com operação exemplar e IA integrada ao dia a dia · Fonte: 10. Acompanhamento da estratégia.xlsx",
 "filtros":{"ano":True,"area":False,"anoPadrao":ANO,"periodo":True,"campos":["pilar","responsavel","area","situacao"]},
 "secoes":[
  {"pagina":"Quadro de Metas","titulo":"Visão acumulada — meta × realizado (farol: verde ≥ 80%, amarelo 70–79%, vermelho < 70%)","itens":[
    meta('Faturamento','Faturamento (R$ mi)'),meta('Receita Recorrente','Receita Recorrente (R$ mi)'),meta('EBITDA','EBITDA (%)'),
    meta('NRR','NRR (%)'),meta('Lucro Operacional','Lucro Operacional (%)'),meta('% Processos Críticos Mapeados','% Processos Críticos Mapeados'),
    {"tipo":"tabela","titulo":"Quadro de Metas — acumulado","fonte":M,"colunas":["indicador","unidade","metaAcumulada","realizadoAcumulado","atingimento","status"],"ordenar":"nenhum","larguraGrade":12}]},
  {"pagina":"Acompanhamento","titulo":"Evolução mensal dos indicadores — meta × real","itens":[
    {"tipo":"grafico","grafico":"linhas","titulo":"Faturamento — meta × real (R$ mi)","fonte":MM,"dimensao":"mes","filtro":{"indicador":"Faturamento"},"series":[{"medida":"meta","rotulo":"Meta"},{"medida":"realizado","rotulo":"Real"}],"formato":"numero","larguraGrade":6},
    {"tipo":"grafico","grafico":"linhas","titulo":"Receita Recorrente — meta × real (R$ mi)","fonte":MM,"dimensao":"mes","filtro":{"indicador":"Receita Recorrente"},"series":[{"medida":"meta","rotulo":"Meta"},{"medida":"realizado","rotulo":"Real"}],"formato":"numero","larguraGrade":6},
    {"tipo":"grafico","grafico":"barrasHorizontais","titulo":"Status dos meses por indicador","fonte":MM,"dimensao":"indicador","serieDimensao":"status","series":[{"medida":"realizado","agregacao":"contagem","rotulo":"Meses"}],"ordenar":"nenhum","formato":"inteiro","larguraGrade":12},
    {"tipo":"tabela","titulo":"Painel horizontal — realizado por mês","fonte":MM,"colunas":["indicador","mes","meta","realizado","atingimento","status"],"ordenar":"nenhum","limite":80,"larguraGrade":12}]},
  {"pagina":"Pilares","titulo":"Status dos indicadores por pilar","itens":[
    card('Indicadores (KRs)',K,'indicadores'),card('No alvo',K,'indicadores',{'status':'No alvo'}),card('Atenção',K,'indicadores',{'status':'Atenção'}),
    card('Crítico',K,'indicadores',{'status':'Crítico'}),card('Sem dado',K,'indicadores',{'status':'Sem dado'}),
    {"tipo":"grafico","grafico":"barrasHorizontais","titulo":"Indicadores por pilar e status","fonte":K,"dimensao":"pilar","serieDimensao":"status","series":[{"medida":"indicadores","rotulo":"KRs"}],"formato":"inteiro","larguraGrade":12},
    {"tipo":"tabela","titulo":"Indicadores por pilar","fonte":K,"colunas":["pilar","indicador","responsavel","meta","realizado","atingimento","status"],"ordenar":"pilar asc","limite":40,"larguraGrade":12}]},
  {"pagina":"Ações","titulo":"Consolidado do plano de ações","itens":[
    card('Total de ações',A,'acoes'),card('Concluídas',A,'acoes',{'situacao':'Concluído'},comp={'medida':'acoes','rotulo':'Total'}),
    card('No prazo',A,'acoes',{'situacao':'No prazo'}),card('Atrasadas',A,'acoes',{'situacao':'Atrasado'}),
    {"tipo":"grafico","grafico":"rosca","titulo":"Distribuição por situação","fonte":A,"dimensao":"situacao","series":[{"medida":"acoes","rotulo":"Ações"}],"formato":"inteiro","larguraGrade":4},
    {"tipo":"grafico","grafico":"barrasHorizontais","titulo":"Ações por responsável (situação empilhada)","fonte":A,"dimensao":"responsavel","serieDimensao":"situacao","series":[{"medida":"acoes","rotulo":"Ações"}],"formato":"inteiro","larguraGrade":8}]},
  {"pagina":"Ações","titulo":"Detalhamento das ações","itens":[
    {"tipo":"tabela","titulo":"Ações","fonte":A,"colunas":["acao","area","responsavel","andamento","situacao","dataLimite"],"ordenar":"dataLimite asc","limite":200,"larguraGrade":12}]}],
 "assistente":{"ativo":True,
  "escopo":"Painel do Planejamento Estratégico Visão 2029 da DGT (dados da planilha 10. Acompanhamento da estratégia). Responda sobre o Quadro de Metas (meta × realizado acumulado e mês a mês), os indicadores (KRs) por pilar e status, e o plano de ações (status, situação, prazos e áreas). Não avalie pessoas; aponte metas, pilares e ações que precisam de atenção e o que priorizar.",
  "fontes":[M,MM,K,A],"camposOcultos":["comentario"],
  "perguntasSugeridas":["Resuma a situação da estratégia em 5 pontos.","Quais indicadores do Quadro de Metas estão abaixo de 80% da meta?","Quais pilares concentram KRs críticos?","Quantas ações estão atrasadas e de quais áreas?","Em que meses o faturamento ficou abaixo da meta?"]},
 "fontesEmbutidas":fontes}
json.dump(d,open(SAIDA,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
from collections import Counter
print(f"OK: {SAIDA}")
print(f"  Quadro de Metas: {len(dados['metas'])} indicadores · {len(dados['metasMensais'])} lançamentos mensais")
print(f"  KRs: {len(dados['indicadores'])} · {dict(Counter(k['status'] for k in dados['indicadores']))}")
print(f"  Ações: {len(dados['acoes'])} · {dict(Counter(a['situacao'] for a in dados['acoes']))}")