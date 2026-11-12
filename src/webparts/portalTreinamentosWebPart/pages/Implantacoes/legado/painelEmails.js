/* eslint-disable */
// ============================================================
// PAINEL DE IMPLANTAÇÕES — conteúdo dos e-mails
//
// Origem: painel-projetos/tools/relatorio.py (servidor Python). Aqui a
// mesma lógica roda no navegador, sobre os dados já carregados do
// Dataverse. Este arquivo só MONTA os e-mails (destinatários, assunto e
// HTML); a fila de envio e a recorrência ficam em
// services/implantacoes/RelatorioImplantacoes.ts.
//
// Tipos de envio:
//   pendencias   cada pessoa recebe as próprias atividades
//   gerencial    resumo da equipe
//   cronogramas  situação do cronograma por projeto (equipe e clientes)
//
// Arquivo .js pelo mesmo motivo de painelApp.js (ver cabeçalho de lá).
// ============================================================

const E = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const norm = (s) =>
  String(s == null ? "" : s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const p2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const deIso = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const maisDias = (s, n) => {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
const maisMeses = (s, n) => {
  const d = deIso(s);
  const m = d.getMonth() + n;
  const y = d.getFullYear() + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  const ult = new Date(y, mm + 1, 0).getDate();
  return iso(new Date(y, mm, Math.min(d.getDate(), ult)));
};
const diasEntre = (a, b) => Math.round((deIso(b) - deIso(a)) / 864e5);
const dm = (s) => (s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
const dma = (s) => (s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(2, 4)}` : "–");
const num = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
};
const vals = (m) => (m && typeof m === "object" ? Object.values(m) : []);

const EQUIPE_PADRAO = { PMO: [], "Implantação": [], Infraestrutura: [] };
const AREAS = { PMO: ["projetos", "pmo"], "Implantação": ["implantacao"], Infraestrutura: ["infraestrutura"] };
const GRUPOS = { 1: "Iniciação", 2: "Planejamento", 3: "Execução", 4: "Monitoramento e controle", 5: "Encerramento" };
const FONTE = { acao: "Ação da carteira", crono: "Cronograma", sprint: "Sprint", campo: "Equipe de campo" };
const ORD_F = { acao: 0, crono: 1, sprint: 2, campo: 3 };
const SIT = [
  ["atrasada", "Atrasadas", "#c0392b"],
  ["hoje", "Vencem hoje", "#b9770e"],
  ["semana", "Próximos 7 dias", "#2f5d8a"],
  ["andamento", "Em andamento", "#2f5d8a"],
  ["futura", "Mais adiante", "#6b7785"],
  ["semdata", "Sem data", "#6b7785"],
];
const SIT_C = { atrasada: ["Atrasada", "#c0392b"], andamento: ["Em andamento", "#2f5d8a"], futura: ["A iniciar", "#6b7785"], concluida: ["Concluída", "#2e7d4f"] };
const CSS_T = "border-collapse:collapse;width:100%;font-size:13px";
const TD = "padding:6px 8px;border-bottom:1px solid #e3e7eb;vertical-align:top";
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export const TIPOS_EMAIL = [
  ["pendencias", "Relatório semanal · pendências por pessoa"],
  ["gerencial", "Resumo gerencial"],
  ["cronogramas", "Cronograma para o cliente e a equipe"],
];

/* ---------- base ---------- */
function criarBase(baldes) {
  const root = baldes._root || {};
  const projs = [];
  Object.entries(root.projetos || {}).forEach(([pid, v]) => {
    if (!v || v.encerrado) return;
    const b = baldes[pid === "main" ? "_root" : pid];
    if (!b) return;
    const cfg = (b.config || {}).projeto || {};
    const nome = cfg.nome || v.nome || pid;
    const m = /^\s*(\d+)/.exec(nome);
    projs.push({ id: pid, b, cfg, nome, cod: m ? +m[1] : 1e9, dgt: ((b.config || {}).stakeholders || {}).dgt || [] });
  });
  projs.sort((a, b) => a.cod - b.cod || a.nome.localeCompare(b.nome));
  const eq = ((root.config || {}).equipe || {}).membros;
  let equipe = EQUIPE_PADRAO;
  if (Array.isArray(eq) && eq.length) {
    equipe = {};
    eq.forEach((m) => (equipe[m.subsetor || ""] = equipe[m.subsetor || ""] || []).push(m.nome || ""));
  }
  const base = {
    projs,
    equipe,
    agenda: vals(root.agendaCampo),
    setorDe(nome) {
      const k = norm(nome);
      return Object.keys(equipe).find((s) => equipe[s].some((x) => norm(x) === k)) || "";
    },
    conhecidos() {
      const L = [].concat(...Object.values(equipe));
      projs.forEach((p) => p.dgt.forEach((d) => L.push((d && d.nome) || "")));
      return [...new Set(L)].filter(Boolean);
    },
    // "Marcelo Lopes da Silveira Júnior" (portal) → "Marcelo Lopes" (equipe / atividades)
    nomeNasAtividades(nome) {
      const k = norm(nome);
      const pal = new Set(k.split(" "));
      const C = base.conhecidos();
      if (C.some((n) => norm(n) === k)) return nome;
      const cand = C.filter((n) => norm(n).split(" ").length >= 2 && norm(n).split(" ").every((x) => pal.has(x)));
      return cand.sort((a, b) => b.length - a.length)[0] || nome;
    },
  };
  return base;
}
const datasG3 = (i, rev) => {
  const a = (rev && i.inicioRev) || i.inicio || "";
  const b = (rev && i.fimRev) || i.fim || "";
  return [a, b && b >= a ? b : a];
};

/* ---------- pendências (mesma regra de "Minhas atividades") ---------- */
function pendencias(base, nome, hoje) {
  const em7 = maisDias(hoje, 7);
  const k = nome ? norm(nome) : "";
  const setor = nome ? base.setorDe(nome) : "";
  const areas = AREAS[setor];
  const aloc = new Set(nome ? base.projs.filter((p) => p.dgt.some((d) => norm(d && d.nome) === k)).map((p) => p.id) : []);
  const meu = (pid, resp) => {
    if (!nome) return "nome";
    const r = String(resp || "").split(/\s*[/,;+]\s*/).map(norm);
    if (r.includes(k)) return "nome";
    return areas && aloc.has(pid) && r.some((x) => areas.includes(x)) ? "setor" : "";
  };
  const sit = (ini, fim) => (fim && fim < hoje ? "atrasada" : fim && fim === hoje ? "hoje" : fim && fim <= em7 ? "semana" : ini && ini <= hoje ? "andamento" : fim || ini ? "futura" : "semdata");
  const L = [];
  const add = (o) => {
    if (!o.sit) o.sit = sit(o.ini, o.fim);
    o.atraso = o.fim && o.fim < hoje ? diasEntre(o.fim, hoje) : 0;
    L.push(o);
  };
  base.projs.forEach((p) => {
    const A = vals(p.b.atividades);
    const rev = !!(p.cfg.cronRevs && p.cfg.cronRevs.length);
    const g3 = A.filter((i) => String(i.grupo) === "3");
    g3.forEach((i) => {
      if (i.fimReal) return;
      const por = meu(p.id, i.resp);
      if (!por) return;
      const [a, b] = datasG3(i, rev);
      add({ fonte: "crono", p, titulo: i.titulo || "Atividade", ctx: [i.faseNome, i.pacoteNome].filter(Boolean).join(" › "), resp: i.resp || "", ini: a, fim: b, por });
    });
    const SD = p.cfg.sprintDatas || {};
    A.forEach((i) => {
      const g = parseInt(i.grupo, 10) || 0;
      if (![1, 2, 4, 5].includes(g)) return;
      const por = meu(p.id, i.resp);
      if (!por) return;
      const sp = parseInt(i.sprint, 10) || 1;
      const per = (SD[g] || {})[sp] || [];
      const ctx = `${GRUPOS[g]} · Sprint ${p2(sp)}`;
      if (g === 4) {
        if (!i.ciclo && !(i.execs && i.execs.length)) return;
        const c = { semanal: 7, quinzenal: 14, mensal: "1", bimestral: "2", trimestral: "3" }[i.ciclo || "mensal"];
        if (!c) return;
        const ex = (i.execs || []).filter((x) => x && x.d).map((x) => x.d).sort();
        const iniG3 = g3.map((j) => datasG3(j, rev)[0]).filter(Boolean).sort();
        const b0 = ex.length ? ex[ex.length - 1] : per[0] || iniG3[0] || "";
        if (!b0) return;
        const prox = typeof c === "number" ? maisDias(b0, c) : maisMeses(b0, +c);
        if (prox > em7) return;
        add({ fonte: "sprint", p, titulo: i.titulo || "", ctx: ctx + " · cíclico", resp: i.resp || "", ini: "", fim: prox, por });
        return;
      }
      let st = String(i.status || "");
      if (g === 1) st = { backlog: "naorecebido", andamento: "analise", concluido: "aceito", bloqueado: "naoaceito" }[st] || st;
      if (st === "concluido" || st === "aceito") return;
      add({ fonte: "sprint", p, titulo: i.titulo || "", ctx, resp: i.resp || "", ini: i.inicio || per[0] || "", fim: i.fim || per[1] || "", por, bloq: ["bloqueado", "naoaceito", "recusado"].includes(st) });
    });
    (p.cfg.acoes || []).forEach((a) => {
      if (!a || !a.t || a.ok) return;
      const por = meu(p.id, a.r);
      if (!por) return;
      const o = { fonte: "acao", p, titulo: a.t, ctx: "Status report", resp: a.r || "", ini: "", fim: a.cont ? "" : a.d || "", por };
      if (a.cont) o.sit = "andamento";
      add(o);
    });
  });
  const nomes = new Map(base.projs.map((p) => [p.id, p]));
  const lim = maisDias(hoje, -60);
  base.agenda.forEach((a) => {
    if (!a) return;
    const st = a.status || "programada";
    if (a.excluida || ["cancelada", "concluida", "feito", "parcial"].includes(st)) return;
    const d0 = a.data || "";
    const fim = (a.dataFim || "") >= d0 ? a.dataFim : d0;
    if (!d0 || fim < lim || d0 > em7) return;
    const eqn = norm(a.equipe);
    const tecnico = !nome || eqn.split(/\s*[/,+&]\s*|\s+e\s+/).includes(k) || (k && eqn.includes(k));
    if (!tecnico && setor !== "Implantação") return;
    const pids = a.pids || (a.pid ? [a.pid] : []);
    const p = pids.length ? nomes.get(pids[0]) : null;
    add({ fonte: "campo", p, titulo: `${a.equipe || "Equipe"} · programação de campo`, ctx: p ? p.nome : a.projNome || "", resp: a.equipe || "", ini: d0, fim, por: tecnico ? "nome" : "setor", sit: fim < hoje ? "atrasada" : d0 <= hoje ? "hoje" : "semana", campoPend: fim < hoje });
  });
  return L;
}

/* ---------- HTML ---------- */
const prazo = (x, hoje) =>
  x.fonte === "acao" && !x.fim && x.sit === "andamento" ? "Contínua" : !x.fim ? "Sem prazo" : x.fim < hoje ? `${dm(x.fim)} · há ${x.atraso} dia${x.atraso !== 1 ? "s" : ""}` : x.fim === hoje ? "Hoje" : dm(x.fim);

function molde(titulo, sub, corpo, link, externo) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>.c{padding:5px 8px;border-bottom:1px solid #e3e7eb;vertical-align:top}.n{white-space:nowrap}.s{font-size:12px;color:#5c6b7a}.atrasada{color:#c0392b}.andamento{color:#2f5d8a}.futura{color:#6b7785}.concluida{color:#2e7d4f}</style></head><body style="margin:0;background:#f3f5f7;font-family:Segoe UI,Arial,sans-serif;color:#17212b">
<div style="max-width:760px;margin:0 auto;padding:20px">
<div style="background:#fff;border:1px solid #dfe4e9;border-radius:10px;padding:22px 24px">
<div style="font-size:12px;color:#6b7785;margin-bottom:4px">${externo ? "Escritório de Projetos · DGT Tecnologia" : "Painel de implantações · Portal DGT"}</div>
<h1 style="margin:0 0 4px;font-size:21px">${E(titulo)}</h1><div style="font-size:13px;color:#5c6b7a;margin-bottom:16px">${sub}</div>
${corpo}
${link ? `<p style="margin:18px 0 0"><a href="${E(link)}" style="background:#202A44;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:13px;font-weight:600">Abrir no Portal DGT</a></p>` : ""}
</div><p style="font-size:11px;color:#8a96a3;margin:10px 4px">${externo ? "Enviado pelo Escritório de Projetos da DGT Tecnologia. Em caso de dúvidas, responda a este e-mail." : "Enviado automaticamente pelo painel de implantações. Para mudar a recorrência ou os destinatários: Configurações › E-mails e relatórios."}</p></div></body></html>`;
}
function kpis(L) {
  const c = {};
  SIT.forEach(([s]) => (c[s] = L.filter((x) => x.sit === s).length));
  const cel = SIT.slice(0, 4)
    .map(([s, t, cor]) => `<td style="padding:10px 12px;border:1px solid #e3e7eb;text-align:left"><div style="font-size:22px;font-weight:700;color:${c[s] ? cor : "#17212b"}">${c[s]}</div><div style="font-size:12px;color:#5c6b7a">${t}</div></td>`)
    .join("");
  return [`<table style="${CSS_T};margin-bottom:14px"><tr>${cel}</tr></table>`, c];
}
function htmlPessoa(base, nomeLogin, link, momento, hoje) {
  const nome = base.nomeNasAtividades(nomeLogin);
  const L = pendencias(base, nome, hoje);
  const [k, c] = kpis(L);
  let corpo = k;
  const MAX = 40;
  SIT.slice(0, 4).forEach(([s, t, cor]) => {
    const G = L.filter((x) => x.sit === s);
    if (!G.length) return;
    const ch = (x) => [(x.p || {}).cod == null ? 1e9 : x.p.cod, (x.p || {}).nome || "~", ORD_F[x.fonte], x.fim || "9"];
    G.sort((a, b) => {
      const A = ch(a), B = ch(b);
      for (let j = 0; j < 4; j++) if (A[j] !== B[j]) return A[j] < B[j] ? -1 : 1;
      return 0;
    });
    let linhas = "", atual = null, n = 0;
    G.slice(0, MAX).forEach((x) => {
      const pn = (x.p || {}).nome || "Sem projeto";
      if (pn !== atual) {
        linhas += `<tr><td colspan="3" style="padding:10px 8px 4px;font-weight:700;border-bottom:1px solid #cfd6dd">${E(pn)}</td></tr>`;
        atual = pn;
      }
      linhas += `<tr><td style="${TD};width:110px;color:#5c6b7a;font-size:12px">${FONTE[x.fonte]}</td><td style="${TD}"><b>${E(x.titulo)}</b><div style="font-size:12px;color:#5c6b7a">${E(x.ctx)}${x.resp ? " · " + E(x.resp) : ""}${x.por === "setor" ? " · <i>setor</i>" : ""}</div></td><td style="${TD};width:130px;white-space:nowrap;color:${cor}">${prazo(x, hoje)}${x.bloq ? " · bloqueada" : ""}</td></tr>`;
      n++;
    });
    const mais = G.length > n ? `<tr><td colspan="3" style="${TD};color:#5c6b7a">… e mais ${G.length - n} no painel</td></tr>` : "";
    corpo += `<h2 style="font-size:15px;margin:18px 0 6px;color:${cor}">${t} (${G.length})</h2><table style="${CSS_T}">${linhas}${mais}</table>`;
  });
  const resto = c.futura + c.semdata;
  if (resto) corpo += `<p style="font-size:12px;color:#5c6b7a;margin-top:14px">Mais ${resto} pendência(s) com prazo mais adiante ou sem data: veja em Minhas atividades.</p>`;
  if (!L.length) corpo += '<p style="font-size:14px">Nenhuma pendência encontrada. Tudo em dia!</p>';
  const sub = `${E(nome)} · ${E(base.setorDe(nome) || "setor não cadastrado na equipe")} · ${momento} · posição em ${dm(hoje)}`;
  const rel = c.atrasada + c.hoje + c.semana + c.andamento;
  return [molde("Suas atividades", sub, corpo, link), rel, c];
}
function htmlGerencial(base, link, momento, hoje) {
  const pessoas = [].concat(...Object.keys(base.equipe).map((s) => base.equipe[s].map((n) => [n, s])));
  const th = 'style="padding:6px 8px;text-align:right;font-size:11.5px;color:#5c6b7a;border-bottom:2px solid #cfd6dd"';
  const thE = th.replace("text-align:right", "text-align:left");
  let linhas = "";
  pessoas.forEach(([n, s]) => {
    const L = pendencias(base, n, hoje);
    const cnt = (f) => L.filter(f).length;
    const atr = cnt((x) => x.sit === "atrasada"),
      ac = cnt((x) => x.fonte === "acao"),
      acv = cnt((x) => x.fonte === "acao" && x.sit === "atrasada");
    linhas += `<tr><td style="${TD}"><b>${E(n)}</b><div style="font-size:12px;color:#5c6b7a">${E(s)}</div></td><td style="${TD};text-align:right;color:${atr ? "#c0392b" : "#17212b"};font-weight:${atr ? 700 : 400}">${atr || "–"}</td><td style="${TD};text-align:right">${cnt((x) => x.sit === "hoje") || "–"}</td><td style="${TD};text-align:right">${cnt((x) => x.sit === "semana") || "–"}</td><td style="${TD};text-align:right">${ac ? ac + (acv ? ` (${acv} venc.)` : "") : "–"}</td><td style="${TD};text-align:right">${cnt((x) => x.campoPend) || "–"}</td></tr>`;
  });
  let corpo = `<h2 style="font-size:15px;margin:4px 0 6px">Pendências por pessoa</h2><table style="${CSS_T}"><tr><th ${thE}>Pessoa</th><th ${th}>Atrasadas</th><th ${th}>Hoje</th><th ${th}>7 dias</th><th ${th}>Ações abertas</th><th ${th}>Campo sem finalizar</th></tr>${linhas || `<tr><td colspan="6" style="${TD};color:#5c6b7a">Cadastre a equipe em Gestão de equipes para ver as pendências por pessoa.</td></tr>`}</table>`;
  const T = pendencias(base, "", hoje);
  const atr = new Map();
  T.forEach((x) => x.fonte === "crono" && x.sit === "atrasada" && atr.set(x.p.nome, (atr.get(x.p.nome) || 0) + 1));
  const top = [...atr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) corpo += `<h2 style="font-size:15px;margin:18px 0 6px">Projetos com mais atividades atrasadas</h2><table style="${CSS_T}">${top.map(([n, q]) => `<tr><td style="${TD}">${E(n)}</td><td style="${TD};text-align:right;color:#c0392b;font-weight:700">${q}</td></tr>`).join("")}</table>`;
  const acv = T.filter((x) => x.fonte === "acao" && x.sit === "atrasada").sort((a, b) => (a.fim || "").localeCompare(b.fim || ""));
  if (acv.length) corpo += `<h2 style="font-size:15px;margin:18px 0 6px;color:#c0392b">Ações da carteira vencidas (${acv.length})</h2><table style="${CSS_T}">${acv.slice(0, 30).map((x) => `<tr><td style="${TD}"><b>${E(x.titulo)}</b><div style="font-size:12px;color:#5c6b7a">${E(x.p.nome)} · ${E(x.resp) || "sem responsável"}</div></td><td style="${TD};width:120px;color:#c0392b;white-space:nowrap">${prazo(x, hoje)}</td></tr>`).join("")}</table>`;
  const camp = T.filter((x) => x.campoPend);
  if (camp.length) corpo += `<p style="font-size:13px;margin-top:14px;color:#c0392b"><b>${camp.length}</b> programação(ões) de campo de dias anteriores ainda sem finalização.</p>`;
  return molde("Resumo gerencial da equipe", `${momento} · posição em ${dm(hoje)} · ${base.projs.length} projetos em andamento`, corpo, link);
}

/* ---------- cronogramas ---------- */
const projetosCron = (base, t) => {
  const ok = t.projetos == null ? null : new Set(t.projetos);
  return base.projs.filter((p) => (!ok || ok.has(p.id)) && vals(p.b.atividades).some((i) => String(i.grupo) === "3"));
};
function cronProjeto(p, hoje) {
  const A = vals(p.b.atividades).filter((i) => String(i.grupo) === "3");
  A.sort((x, y) => num(x.ordem) - num(y.ordem) || num(x.seq) - num(y.seq));
  const rev = !!(p.cfg.cronRevs && p.cfg.cronRevs.length);
  const em15 = maisDias(hoje, 15);
  const L = A.map((i) => {
    const [a, b] = datasG3(i, rev);
    const s = i.fimReal ? "concluida" : b && b < hoje ? "atrasada" : (a && a <= hoje) || i.inicioReal ? "andamento" : "futura";
    const dentro = (d) => !!d && hoje <= d && d <= em15;
    return { i, a, b, s, ctx: [i.faseNome, i.pacoteNome].filter(Boolean).join(" › "), atraso: s === "atrasada" ? diasEntre(b, hoje) : 0, prox: s !== "concluida" && (dentro(a) || dentro(b)) };
  });
  const max = (f) => L.map(f).filter(Boolean).sort().pop() || "";
  const n = (s) => L.filter((x) => x.s === s).length;
  return { L, rev, fimV: max((x) => x.b), fimB: max((x) => x.i.fim), tot: L.length, conc: n("concluida"), atr: n("atrasada"), and: n("andamento"), prox: L.filter((x) => x.prox).length };
}
function cronSecoes(c, hoje, completo, enxuto) {
  const LIM = enxuto ? 10 : 20;
  const th = 'style="padding:6px 8px;text-align:left;font-size:11.5px;color:#5c6b7a;border-bottom:2px solid #cfd6dd"';
  const pct = c.tot ? Math.round((100 * c.conc) / c.tot) : 0;
  const desl = c.rev && c.fimB && c.fimV && c.fimV !== c.fimB;
  const kp = [
    [c.tot, "Atividades", "#17212b"],
    [`${c.conc} <span style="font-size:13px;color:#5c6b7a">(${pct}%)</span>`, "Concluídas", "#2e7d4f"],
    [c.atr, "Atrasadas", c.atr ? "#c0392b" : "#17212b"],
    [c.prox, "Próximos 15 dias", "#17212b"],
    [dma(c.fimV), "Término " + (c.rev ? "revisado" : "previsto") + (desl ? ` <span style="color:#b9770e">(base ${dma(c.fimB)})</span>` : ""), "#17212b"],
  ];
  let h = `<table style="${CSS_T};margin-bottom:10px"><tr>${kp.map(([v, t, cor]) => `<td style="padding:8px 10px;border:1px solid #e3e7eb"><div style="font-size:19px;font-weight:700;color:${cor}">${v}</div><div style="font-size:11.5px;color:#5c6b7a">${t}</div></td>`).join("")}</tr></table>`;
  const tab = (titulo, cor, L, col) => {
    if (!L.length) return "";
    const lin = L.slice(0, LIM)
      .map((x) => `<tr><td style="${TD}"><b>${E(x.i.titulo)}</b><div style="font-size:12px;color:#5c6b7a">${E(x.ctx)}${x.i.resp ? " · " + E(x.i.resp) : ""}</div></td><td style="${TD};width:150px;white-space:nowrap;color:${cor}">${col(x)}</td></tr>`)
      .join("");
    const mais = L.length > LIM ? `<tr><td colspan="2" style="${TD};color:#5c6b7a">… e mais ${L.length - LIM}</td></tr>` : "";
    return `<h3 style="font-size:14px;margin:14px 0 4px;color:${cor}">${titulo} (${L.length})</h3><table style="${CSS_T}">${lin}${mais}</table>`;
  };
  h += tab("Atrasadas", "#c0392b", c.L.filter((x) => x.s === "atrasada").sort((x, y) => x.b.localeCompare(y.b)), (x) => `${dm(x.b)} · há ${x.atraso} dia${x.atraso !== 1 ? "s" : ""}`);
  h += tab("Próximos 15 dias", "#2f5d8a", c.L.filter((x) => x.prox).sort((x, y) => (x.a || x.b).localeCompare(y.a || y.b) || x.b.localeCompare(y.b)), (x) => `${dm(x.a)} a ${dm(x.b)}`);
  if (enxuto) return h;
  const G = new Map();
  c.L.forEach((x) => (G.get(x.ctx || "Sem etapa") || G.set(x.ctx || "Sem etapa", []).get(x.ctx || "Sem etapa")).push(x));
  let lin = "";
  G.forEach((L, nome) => {
    const ss = new Set(L.map((x) => x.s));
    const s = ss.size === 1 && ss.has("concluida") ? "concluida" : ss.has("atrasada") ? "atrasada" : ss.has("andamento") || ss.has("concluida") ? "andamento" : "futura";
    const [t, cor] = SIT_C[s];
    const ini = L.map((x) => x.a).filter(Boolean).sort()[0] || "";
    const fim = L.map((x) => x.b).filter(Boolean).sort().pop() || "";
    lin += `<tr><td style="${TD}">${E(nome)}</td><td style="${TD};white-space:nowrap">${dma(ini)} a ${dma(fim)}</td><td style="${TD};text-align:right">${L.filter((x) => x.s === "concluida").length}/${L.length}</td><td style="${TD};color:${cor};white-space:nowrap">${t}</td></tr>`;
  });
  h += `<h3 style="font-size:14px;margin:14px 0 4px">Etapas</h3><table style="${CSS_T}"><tr><th ${th}>Etapa</th><th ${th}>Período</th><th ${th.replace("text-align:left", "text-align:right")}>Concluídas</th><th ${th}>Situação</th></tr>${lin}</table>`;
  if (completo) {
    let atual = null;
    lin = "";
    c.L.forEach((x) => {
      if (x.ctx !== atual) {
        atual = x.ctx;
        lin += `<tr><td colspan="4" style="padding:10px 8px 4px;font-weight:700;border-bottom:1px solid #cfd6dd">${E(atual || "Sem etapa")}</td></tr>`;
      }
      const i = x.i;
      const [t] = SIT_C[x.s];
      const real = i.inicioReal || i.fimReal ? `${dma(i.inicioReal)} a ${dma(i.fimReal)}` : "–";
      lin += `<tr><td class="c">${E(i.titulo)}${i.resp ? `<div class="s">${E(i.resp)}</div>` : ""}</td><td class="c n">${dma(x.a)} a ${dma(x.b)}</td><td class="c n">${real}</td><td class="c n ${x.s}">${t}</td></tr>`;
    });
    h += `<h3 style="font-size:14px;margin:16px 0 4px">Cronograma completo</h3><table style="${CSS_T}"><tr><th ${th}>Atividade</th><th ${th}>${c.rev ? "Revisado" : "Previsto"}</th><th ${th}>Realizado</th><th ${th}>Situação</th></tr>${lin}</table>`;
  }
  return h;
}
function htmlCronogramas(projs, link, momento, hoje, completo, externo) {
  const C = projs.map((p) => [p, cronProjeto(p, hoje)]);
  let corpo = "";
  if (C.length > 1) {
    const th = 'style="padding:6px 8px;text-align:right;font-size:11.5px;color:#5c6b7a;border-bottom:2px solid #cfd6dd"';
    corpo += `<h2 style="font-size:15px;margin:4px 0 6px">Visão geral</h2><table style="${CSS_T}"><tr><th ${th.replace("text-align:right", "text-align:left")}>Projeto</th><th ${th}>Concluídas</th><th ${th}>Atrasadas</th><th ${th}>15 dias</th><th ${th}>Término</th></tr>${C.map(([p, c]) => `<tr><td style="${TD}">${E(p.nome)}</td><td style="${TD};text-align:right">${c.tot ? Math.round((100 * c.conc) / c.tot) : 0}%</td><td style="${TD};text-align:right;color:${c.atr ? "#c0392b" : "#17212b"};font-weight:${c.atr ? 700 : 400}">${c.atr || "–"}</td><td style="${TD};text-align:right">${c.prox || "–"}</td><td style="${TD};text-align:right;white-space:nowrap">${dma(c.fimV)}</td></tr>`).join("")}</table>`;
  }
  C.forEach(([p, c]) => (corpo += `<h2 style="font-size:16px;margin:24px 0 8px;padding-top:12px;border-top:2px solid #17212b">${E(p.nome)}</h2>` + cronSecoes(c, hoje, completo, C.length > 1 && !completo)));
  if (!C.length) corpo = '<p style="font-size:14px">Nenhum projeto com cronograma selecionado.</p>';
  const titulo = C.length === 1 ? `Cronograma · ${projs[0].nome}` : "Cronogramas dos projetos";
  if (externo) return molde(titulo, `Posição em ${dm(hoje)}`, corpo, "", true); // cliente: sem link do portal
  return molde(titulo, `${momento} · posição em ${dm(hoje)}` + (C.length > 1 ? ` · ${C.length} projetos` : ""), corpo, link);
}
// contatos do cliente com e-mail (campo e-mail; nos cadastros antigos, o e-mail escrito em "contato")
function clientesDe(p) {
  const st = (p.b.config || {}).stakeholders || {};
  const L = [];
  (st.cli || []).forEach((c) => {
    if (!c || typeof c !== "object") return;
    (String(c.email != null && c.email !== "" ? c.email : c.contato || "").match(EMAIL_RE) || []).forEach((e) => {
      e = e.replace(/^\.+|\.+$/g, "").toLowerCase();
      if (EMAIL_OK.test(e) && L.every((x) => x.email !== e)) L.push({ nome: c.nome || e, funcao: c.funcao || "", email: e });
    });
  });
  return L;
}

/* ---------- destinatários ---------- */
// usuarios: [{ id, nome, email, perfil }] — usuários do portal com o módulo Implantações
const escolhidos = (t, U) => {
  const P = t.perfis, S = new Set(t.usuarios || []);
  return U.filter((u) => P == null || P.includes(u.perfil) || S.has(u.id));
};
const comExtras = (L, t) => {
  const ja = new Set(L.map((x) => x.email.toLowerCase()));
  (t.extras || []).forEach((e) => {
    if (!ja.has(e.toLowerCase())) {
      ja.add(e.toLowerCase());
      L.push({ id: null, nome: e, email: e });
    }
  });
  return L;
};
function destinatariosDe(base, T, usuarios) {
  const U = (usuarios || []).filter((u) => u && u.email);
  const pes = (u) => ({ id: u.id, nome: u.nome, email: u.email });
  const pend = escolhidos(T.pendencias, U).map((u) => Object.assign(pes(u), { nomeAtividades: base.nomeNasAtividades(u.nome) }));
  const ger = comExtras(escolhidos(T.gerencial, U).map(pes), T.gerencial);
  const t = T.cronogramas;
  const sel = projetosCron(base, t);
  const ids = sel.map((p) => p.id);
  const cron = comExtras(escolhidos(t, U).map(pes), t);
  cron.forEach((x) => (x.projetos = ids.slice()));
  if (t.alocados) {
    const ja = new Set(cron.map((x) => x.email.toLowerCase()));
    U.forEach((u) => {
      if (ja.has(u.email.toLowerCase())) return;
      const n = norm(base.nomeNasAtividades(u.nome));
      const meus = sel.filter((p) => p.dgt.some((d) => norm(d && d.nome) === n)).map((p) => p.id);
      if (meus.length) cron.push(Object.assign(pes(u), { projetos: meus, alocado: true }));
    });
  }
  const cli = [], sem = [];
  if (t.clientes) {
    sel.forEach((p) => {
      const L = clientesDe(p);
      if (!L.length) sem.push({ id: p.id, nome: p.nome });
      L.forEach((c) => cli.push({ id: null, nome: c.nome, funcao: c.funcao, email: c.email, projetos: [p.id], projetoNome: p.nome, cliente: true }));
    });
  }
  return { pendencias: pend, gerencial: ger, cronogramas: cron.concat(cli), cronSemCliente: sem };
}
const momentoDe = (agora) => ((agora.getDay() + 6) % 7 < 3 ? "abertura da semana" : "fechamento da semana");

/* ---------- API usada pelo portal ---------- */
export function dadosDosEmails(baldes, tipos, usuarios) {
  const base = criarBase(baldes);
  return { projetos: base.projs.map((p) => ({ id: p.id, nome: p.nome })), destinatarios: destinatariosDe(base, tipos, usuarios) };
}
export function previaDoEmail(baldes, tipos, tipo, link, nome, cliente, agora) {
  const base = criarBase(baldes);
  const hoje = iso(agora), momento = momentoDe(agora);
  if (tipo === "gerencial") return htmlGerencial(base, link, momento, hoje);
  if (tipo === "cronogramas") {
    const t = tipos.cronogramas;
    let P = projetosCron(base, t);
    const completo = t.conteudo === "completo";
    if (cliente) {
      const comCli = P.filter((p) => clientesDe(p).length).slice(0, 1);
      return htmlCronogramas(comCli.length ? comCli : P.slice(0, 1), link, momento, hoje, completo, true);
    }
    return htmlCronogramas(completo ? P.slice(0, 1) : P, link, momento, hoje, completo, false);
  }
  return htmlPessoa(base, nome, link, momento, hoje)[0];
}
// Monta os e-mails de um tipo. soPara = { nome, email }: só para essa pessoa (teste).
// Devolve { emails: [{ para, assunto, html }], pulados }.
export function montarEmails(baldes, tipos, tipo, usuarios, link, soPara, agora) {
  const base = criarBase(baldes);
  const hoje = iso(agora), momento = momentoDe(agora);
  const t = tipos[tipo];
  const ds = destinatariosDe(base, tipos, usuarios)[tipo];
  const emails = [];
  let pulados = 0;
  const manda = (para, assunto, html) => emails.push({ para, assunto, html });
  if (tipo === "pendencias") {
    let pess = ds;
    if (soPara) {
      pess = ds.filter((p) => p.email.toLowerCase() === soPara.email.toLowerCase());
      if (!pess.length) pess = [{ nome: soPara.nome || soPara.email, email: soPara.email }];
    }
    pess.forEach((p) => {
      const [h, n, c] = htmlPessoa(base, p.nome, link, momento, hoje);
      if (!n && !soPara) return void pulados++;
      manda(p.email, `Suas atividades · ${c.atrasada} atrasada(s) · ${dm(hoje)}`, h);
    });
  } else if (tipo === "gerencial") {
    const ger = soPara ? [{ email: soPara.email }] : ds;
    if (ger.length) {
      const h = htmlGerencial(base, link, momento, hoje);
      ger.forEach((g) => manda(g.email, `Resumo gerencial da equipe · ${dm(hoje)}`, h));
    }
  } else {
    const sel = new Map(projetosCron(base, t).map((p) => [p.id, p]));
    const completo = t.conteudo === "completo";
    let dest = ds;
    if (soPara) {
      // teste: a versão da equipe e, se ligado, um exemplo do que o cliente recebe
      const todos = [...sel.keys()];
      dest = [{ email: soPara.email, projetos: completo ? todos.slice(0, 1) : todos }];
      const ex = t.clientes ? todos.filter((i) => clientesDe(sel.get(i)).length).slice(0, 1) : [];
      if (ex.length) dest.push({ email: soPara.email, projetos: ex, cliente: true });
    }
    const cache = new Map();
    const guardado = (k, f) => (cache.has(k) ? cache.get(k) : cache.set(k, f()).get(k));
    dest.forEach((x) => {
      const P = (x.projetos || []).filter((i) => sel.has(i)).map((i) => sel.get(i));
      if (!P.length) return void pulados++;
      if (x.cliente) {
        const p = P[0];
        manda(x.email, `Cronograma do projeto · ${p.nome} · ${dm(hoje)}`, guardado("cli|" + p.id, () => htmlCronogramas([p], link, momento, hoje, completo, true)));
      } else if (completo) {
        P.forEach((p) => manda(x.email, `Cronograma · ${p.nome} · ${dm(hoje)}`, guardado(p.id, () => htmlCronogramas([p], link, momento, hoje, true, false))));
      } else {
        manda(x.email, (P.length === 1 ? `Cronograma · ${P[0].nome}` : `Cronogramas · ${P.length} projetos`) + ` · ${dm(hoje)}`, guardado(P.map((p) => p.id).join(","), () => htmlCronogramas(P, link, momento, hoje, false, false)));
      }
    });
  }
  return { emails, pulados };
}
