/* eslint-disable */
// ============================================================
// PAINEL DE IMPLANTAÇÕES — código da tela (JavaScript puro)
//
// Origem: painel-projetos/js/app.js. Aqui ele roda DENTRO do portal:
// a função recebe a janela e o documento do quadro (iframe) criado
// por ImplantacoesPage.tsx e a ponte de "fetch" (rotas api/*).
// Base de dados, sessão e permissões vêm do portal
// (services/implantacoes), por window.LOCAL_HOST / SESSAO / PODE.
//
// Arquivo .js de propósito: o TypeScript do SPFx compila para ES5
// sem downlevelIteration, o que quebraria Set/Map/spread deste código.
// Ele é copiado para lib/ por config/typescript.json (includeGlobs).
// ============================================================
export function iniciarPainelLegado(window, document, fetch) {
  const { location, localStorage, navigator, FormData, CSS, Blob, URL, URLSearchParams, Image, AbortController, MutationObserver, setTimeout, clearTimeout, setInterval, requestAnimationFrame, cancelAnimationFrame, queueMicrotask, matchMedia, getComputedStyle } = window;
  const GRUPOS = {
    1: { nome: "Iniciação", resp: "PMO" },
    2: { nome: "Planejamento", resp: "PMO / Projetos" },
    3: { nome: "Execução", resp: "Frentes" },
    4: { nome: "Monitoramento e controle", resp: "PMO" },
    5: { nome: "Encerramento", resp: "PMO" },
  };
  const DESC = {
    1: "Passagem de bastão de Pré-vendas e Comercial: recebimento e conferência da documentação do contrato.",
    2: "Aprovação do projeto, baseline de cronograma e físico x financeiro, custos, riscos e kick-off. As solicitações de compra fazem parte da execução (G3).",
    3: "Execução em cascata por frente de trabalho. Planejado = revisão vigente (ou baseline, quando não revisada). O % real segue o critério de medição por eventos: início realizado = 50%, término realizado = 100%. Na etapa de instalação, use “Número de pontos” para replicar a estrutura de cada ponto.",
    4: "Desvios, revisões de cronograma, medições e change requests, em sprints paralelas à execução.",
    5: "Aceite, handover contratual, atestado técnico e lições aprendidas.",
  };
  const STATUS = {
    backlog: "A fazer",
    andamento: "Em andamento",
    concluido: "Concluído",
    bloqueado: "Bloqueado",
  };
  // planejamento (G2): também "Recusado" (ex.: aprovação ou parâmetro recusado)
  const STATUS_G2 = Object.assign({}, STATUS, { recusado: "Recusado" });
  const STATUS_G1 = {
    naorecebido: "Não recebido",
    analise: "Em análise",
    aceito: "Aceito",
    naoaceito: "Não aceito",
  };
  const G1MAP = {
    backlog: "naorecebido",
    andamento: "analise",
    concluido: "aceito",
    bloqueado: "naoaceito",
  };
  const stG = (g, v) =>
    +g === 1
      ? STATUS_G1[v]
        ? v
        : G1MAP[v] || "naorecebido"
      : (+g === 2 ? STATUS_G2 : STATUS)[v]
        ? v
        : "backlog";
  const stOpts = (g) => (+g === 1 ? STATUS_G1 : +g === 2 ? STATUS_G2 : STATUS);
  /* projeto concluído = execução (G3) 100% e todos os itens das sprints de iniciação, planejamento
     e encerramento (G1, G2, G5) concluídos/aceitos; o G4 (monitoramento) é contínuo e não conta */
  const sprintsOk = (itens) =>
    itens.filter((i) => [1, 2, 5].includes(+i.grupo)).every((i) => isDoneSt(stG(i.grupo, i.status)));
  const isDoneSt = (v) => v === "concluido" || v === "aceito",
    isBlockSt = (v) => v === "bloqueado" || v === "naoaceito" || v === "recusado",
    isProgSt = (v) => v === "andamento" || v === "analise";
  const STCLS = {
    naorecebido: "backlog",
    analise: "andamento",
    aceito: "concluido",
    naoaceito: "bloqueado",
    recusado: "bloqueado",
  };
  const GDUR = { 1: 7, 2: 7, 5: 30 };
  /* datas de uma sprint (início e fim informados no cabeçalho da sprint) */
  const sprintPer = (g, sp) => {
    const x = ((cfg.sprintDatas || {})[g] || {})[sp];
    return x && x[0] && x[1] ? x : null;
  };
  // período da fase pelas sprints com data (do menor início ao maior fim)
  const perSprints = (g) => {
    const L = Object.values((cfg.sprintDatas || {})[g] || {}).filter((x) => x && x[0] && x[1]);
    return L.length ? [L.map((x) => x[0]).sort()[0], L.map((x) => x[1]).sort().pop()] : null;
  };
  /* período de cada fase: pelas datas das sprints, quando informadas; senão, a partir da ordem de
     início (iniciação e planejamento) e do fim da execução (encerramento) */
  function grpDates(g) {
    const d1 = +cfg.durG1 || GDUR[1],
      d2 = +cfg.durG2 || GDUR[2],
      d5 = +cfg.durG5 || GDUR[5];
    const P1 = perSprints(1) || (stk.oi ? [stk.oi, addDays(stk.oi, d1 - 1)] : null);
    const P2 = perSprints(2) || (P1 ? [addDays(P1[1], 1), addDays(P1[1], d2)] : null);
    const tad = fimExec(true);
    const P5 = perSprints(5) || (tad ? [addDays(tad, 1), addDays(tad, d5)] : null);
    if (+g === 1) return P1;
    if (+g === 2) return P2;
    if (+g === 5) return P5;
    if (+g === 4) return perSprints(4) || (P1 ? [P1[0], (P5 && P5[1]) || tad || (P2 && P2[1])] : null);
    const L = ofG(3);
    const a = L.map(rI).filter(Boolean).sort()[0];
    return a ? [a, tad] : null;
  }
  const fmtPer = (P) =>
    P && P[0] && P[1]
      ? `${fmtD(P[0])} – ${fmtD(P[1])} · ${Math.round((dt(P[1]) - dt(P[0])) / DAY) + 1} dias`
      : "sem datas";
  const GATES = {
    1: { k: "g12", l: "TAP aprovado" },
    2: { k: "g23", l: "Baseline congelada" },
    3: { k: "g35", l: "Aceite final" },
  };
  const DEF_CFG = {
    nome: "Projeto sem nome",
    corte: "",
    revAtual: "Rev. 00",
    gates: { g12: false, g23: false, g35: false },
  };
  const ROLES_DGT = [
    ["prevenda", "Pré-vendas"],
    ["comercial", "Comercial"],
    ["analista", "PMO do projeto"],
  ];
  /* equipe do setor: três subsetores e quem atende cada um (área = valor do campo Responsável) */
  const EQUIPE = [
    { setor: "PMO", area: "PMO", desc: "Documentação e gerenciamento do projeto", membros: ["Marcelo Lopes", "Lucas Schneider", "Mariana Kroeff", "Alex Santos"] },
    { setor: "Implantação", area: "Implantação", desc: "Implantação física da solução", membros: ["Leonardo Sauter"] },
    { setor: "Infraestrutura", area: "Infraestrutura", desc: "Configuração e ativação de equipamentos e sistemas", membros: ["Euler Silva", "André Dosciati"] },
  ];
  /* equipe cadastrada no Painel PMO (config/equipe do banco compartilhado); sem cadastro, vale a lista acima */
  let EQ = null;
  let EQC = null; // equipes de campo da Implantação (config/equipe → equipesCampo)
  const EQC_PADRAO = ["Fernando Voigt", "Gilson Nunes", "Fábio Lauxen / Carlos Fleck", "Denis Voltz"];
  const equipesCampo = () => EQC || EQC_PADRAO;
  const FUNCAO_SUB = { PMO: "PMO do projeto", Implantação: "Implantação", Infraestrutura: "Infraestrutura" };
  const equipe = () => {
    const M = EQ || EQUIPE.flatMap((e) => e.membros.map((nome) => ({ nome, subsetor: e.setor })));
    return EQUIPE.map((e) => Object.assign({}, e, { membros: M.filter((m) => m.subsetor === e.setor).map((m) => m.nome) }));
  };
  const subsetorDe = (nome) => {
    const k = normNome(nome);
    const e = equipe().find((x) => x.membros.some((m) => normNome(m) === k));
    return e ? e.setor : "";
  };
  const ROLES_CLI = [
    ["fiscal", "Fiscal do contrato"],
    ["gestor", "Gestor do contrato"],
    ["financeiro", "Contato financeiro"],
  ];
  const LS = "pmo-hibrido-v1";
  const S = { itens: [], fats: [], prog: [] };
  let cfg = JSON.parse(JSON.stringify(DEF_CFG));
  let stk = {};
  let db = null,
    downloads = null;
  // ao recarregar, continua na página em que estava (o endereço guarda a página: #pmo, #painel, #g3…)
  let view = location.hash ? parseHash() : "carteira";
  let pendingRender = false;
  let cfgLoaded = false;
  let ready = false;
  let PID = "main",
    PB = "",
    PROJS = [],
    UNSUB = [];
  // a lista de projetos do banco já chegou? até lá, carteira, PMO e barra não usam o "projeto principal"
  let projsOk = false;
  const VERSAO = ((document.querySelector('script[src*="js/app.js"]') || {}).src || "").replace(/^.*[?&]v=/, "");
  if (VERSAO && location.protocol.startsWith("http"))
    setInterval(async () => {
      try {
        const h = await (await fetch("index.html", { cache: "no-store" })).text();
        const v = (h.match(/js\/app\.js\?v=(\d+)/) || [])[1];
        if (!v || v === VERSAO) return;
        const ocupado = document.querySelector("dialog[open]") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
        if (!ocupado) location.reload();
      } catch (e) {}
    }, 60000);
  // ligando ao banco compartilhado: nada de "projeto principal" na tela até a conexão terminar
  let conectando = true;
  const PKEY = "pmo-hibrido-proj";
  const editingDate = () => {
    const a = document.activeElement;
    return !!(
      a &&
      a.matches &&
      a.matches("input.dt,textarea.obs,input.ie,input.acf,textarea.acf")
    );
  };

  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const p2 = (n) => String(n).padStart(2, "0");
  const fmtPct = (x) =>
    x == null || isNaN(x)
      ? "–"
      : (x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  const fmtN = (x) =>
    (+x || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const BRL = (v) =>
    (+v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const fmtMoney = (v) =>
    v === "" || v == null || isNaN(+v)
      ? ""
      : (+v).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const parseMoney = (t) => {
    t = String(t || "").trim();
    if (!t) return "";
    const n = +t.replace(/\./g, "").replace(",", ".");
    return isNaN(n) ? "" : Math.round(n * 100) / 100;
  };
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("input.money"))) return;
    const dg = t.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!dg) {
      t.value = "";
      return;
    }
    t.value = (+dg / 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    t.setSelectionRange(t.value.length, t.value.length);
  });
  const BRLc = (v) => {
    v = +v || 0;
    const a = Math.abs(v);
    if (a >= 1e6)
      return (
        "R$ " +
        (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
        " mi"
      );
    if (a >= 1e3)
      return (
        "R$ " +
        (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) +
        "k"
      );
    return "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  };
  const iso = (d) =>
    d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  const todayISO = () => iso(new Date());
  const corte = () => todayISO();
  // data "AAAA-MM-DD" -> Date; a conversão do texto é guardada (é chamada milhares de vezes por tela)
  // comparação de textos em português: um comparador só (localeCompare com idioma recria um a cada chamada)
  const COLPT_ = new Intl.Collator("pt-BR"),
    COLPTN_ = new Intl.Collator("pt-BR", { numeric: true });
  const COLPT = (a, b) => COLPT_.compare(String(a == null ? "" : a), String(b == null ? "" : b));
  const COLPTN = (a, b) => COLPTN_.compare(String(a == null ? "" : a), String(b == null ? "" : b));
  const DTC = new Map();
  const dt = (s) => {
    if (!s) return null;
    let t = DTC.get(s);
    if (t === undefined) {
      t = new Date(s + "T00:00:00").getTime();
      if (DTC.size > 50000) DTC.clear();
      DTC.set(s, t);
    }
    return new Date(t);
  };
  // mesmo que dt, mas só o número (ms), sem criar objeto Date
  const dtN = (s) => {
    if (!s) return NaN;
    let t = DTC.get(s);
    if (t === undefined) {
      t = new Date(s + "T00:00:00").getTime();
      DTC.set(s, t);
    }
    return t;
  };
  const DAY = 86400000;
  const fmtD = (s) => {
    if (!s) return "–";
    const [a, m, d] = s.split("-");
    return d + "/" + m + "/" + a.slice(2);
  };
  const MES = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  function uid(p) {
    return (
      (p || "a") +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 7)
    );
  }
  function parseHash() {
    const h = (location.hash || "").replace("#", "");
    return /^(carteira|pmo|minhas|config|painel|fxf|cronograma|g[1-5])$/.test(h)
      ? h === "cronograma"
        ? "g3"
        : h
      : "painel";
  }

  /* ---------- Persistência ---------- */
  const COLL = { atividades: "itens", faturamentos: "fats", progresso: "prog" };
  function loadLocal() {
    try {
      const d = JSON.parse(localStorage.getItem(LS) || "{}");
      if (d.itens) S.itens = d.itens;
      if (d.fats) S.fats = d.fats;
      if (d.prog) S.prog = d.prog;
      if (d.stk) stk = d.stk;
      if (d.cfg) cfg = mergeCfg(d.cfg);
    } catch (e) {}
  }
  function saveLocal() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({
          itens: S.itens,
          fats: S.fats,
          prog: S.prog,
          cfg,
          stk,
        }),
      );
    } catch (e) {}
  }
  function mergeCfg(x) {
    x = x || {};
    return Object.assign({}, DEF_CFG, x, {
      gates: Object.assign({}, DEF_CFG.gates, x.gates || {}),
    });
  }
  function clean(o) {
    const r = {};
    for (const k in o) {
      if (k === "id") continue;
      const v = o[k];
      if (v !== undefined && !(typeof v === "number" && isNaN(v))) r[k] = v;
    }
    return r;
  }
  function errMsg(e) {
    const c = e && e.code;
    if (
      c === "permission_denied" ||
      c === "not_granted" ||
      c === "unauthenticated"
    )
      return "Sem permissão para editar este painel.";
    if (c === "rate_limited" || c === "resource_exhausted")
      return "Muitas alterações seguidas. Aguarde alguns segundos.";
    return (
      "Não foi possível salvar: " + ((e && e.message) || "erro desconhecido")
    );
  }
  async function put(coll, obj) {
    if (db) {
      const a = S[COLL[coll]];
      const k = a.findIndex((x) => x.id === obj.id);
      if (k >= 0) a[k] = obj;
      else a.push(obj);
      render();
      try {
        await db
          .collection(PB + coll)
          .doc(obj.id)
          .set(clean(obj));
      } catch (e) {
        toast(errMsg(e));
      }
    } else {
      const a = S[COLL[coll]];
      const i = a.findIndex((x) => x.id === obj.id);
      if (i >= 0) a[i] = obj;
      else a.push(obj);
      saveLocal();
      render();
    }
  }
  async function putMany(coll, list) {
    if (db) {
      for (const o of list) {
        try {
          await db
            .collection(PB + coll)
            .doc(o.id)
            .set(clean(o));
        } catch (e) {
          toast(errMsg(e));
          return;
        }
      }
    } else {
      const a = S[COLL[coll]];
      list.forEach((o) => {
        const i = a.findIndex((x) => x.id === o.id);
        if (i >= 0) a[i] = o;
        else a.push(o);
      });
      saveLocal();
      render();
    }
  }
  /* Escritas por campo (update), em fila por documento e com paralelismo limitado */
  const wq = new Map();
  let wActive = 0;
  const wWait = [];
  function slot() {
    return new Promise((res) => {
      if (wActive < 6) {
        wActive++;
        res();
      } else wWait.push(res);
    });
  }
  function release() {
    wActive--;
    const n = wWait.shift();
    if (n) {
      wActive++;
      n();
    }
  }
  async function dbPatch(coll, id, fields, isNew) {
    const prev = wq.get(id) || Promise.resolve();
    const job = prev.then(async () => {
      await slot();
      try {
        for (let k = 0; k < 4; k++) {
          try {
            const ref = db.collection(PB + coll).doc(id);
            if (isNew) await ref.set(clean(fields));
            else await ref.update(clean(fields));
            return;
          } catch (e) {
            if (
              (e.code === "rate_limited" || e.code === "resource_exhausted") &&
              k < 3
            ) {
              await new Promise((r) => setTimeout(r, 800 * (k + 1)));
              continue;
            }
            if (e.code === "invalid_argument" && !isNew) {
              isNew = true;
              fields = Object.assign(
                {},
                S.itens.find((x) => x.id === id) || {},
                fields,
              );
              continue;
            }
            toast(errMsg(e));
            return;
          }
        }
      } finally {
        release();
      }
    });
    wq.set(
      id,
      job.catch(() => {}),
    );
    return job;
  }
  function patchItems(patches) {
    // patches: [{id, fields, isNew?}]
    if (!patches.length) return;
    pmoVelho();
    patches.forEach((p) => {
      const i = S.itens.findIndex((x) => x.id === p.id);
      if (i >= 0) S.itens[i] = Object.assign({}, S.itens[i], p.fields);
      else S.itens.push(Object.assign({ id: p.id }, p.fields));
    });
    if (db) {
      patches.forEach((p) => dbPatch("atividades", p.id, p.fields, !!p.isNew));
      render();
    } else {
      saveLocal();
      render();
    }
  }
  function diffFields(a, b) {
    const f = {};
    const ks = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
    ks.forEach((k) => {
      if (k === "id") return;
      const x = a ? a[k] : undefined,
        y = b[k];
      if (y === undefined) return;
      if (JSON.stringify(x) !== JSON.stringify(y)) f[k] = y;
    });
    return f;
  }
  function askConfirm(msg, okLabel) {
    return new Promise((res) => {
      const d = $("#dlgConfirm"),
        f = $("#formConfirm");
      f.innerHTML = `<h3>Confirmar</h3><p style="margin:0;font-size:14px">${esc(msg)}</p><div class="actions"><button type="button" class="btn" id="cfNo">Cancelar</button><button type="button" class="btn dangerfill" id="cfYes">${esc(okLabel || "Excluir")}</button></div>`;
      let done = false;
      const fin = (v) => {
        if (done) return;
        done = true;
        if (d.open) d.close();
        res(v);
      };
      $("#cfNo").onclick = () => fin(false);
      $("#cfYes").onclick = () => fin(true);
      d.oncancel = () => fin(false);
      d.showModal();
      $("#cfYes").focus();
    });
  }
  async function del(coll, id) {
    if (db) {
      const a = S[COLL[coll]];
      const k = a.findIndex((x) => x.id === id);
      if (k >= 0) {
        a.splice(k, 1);
        render();
      }
    }
    if (db) {
      try {
        await db
          .collection(PB + coll)
          .doc(id)
          .delete();
      } catch (e) {
        toast(errMsg(e));
      }
    } else {
      S[COLL[coll]] = S[COLL[coll]].filter((x) => x.id !== id);
      saveLocal();
      render();
    }
  }
  async function saveCfg() {
    pmoVelho();
    if (db) {
      try {
        await db.doc(PB + "config/projeto").set(clean(cfg));
        const pr = PROJS.find((x) => x.id === PID);
        if (pr && pr.nome !== cfg.nome)
          db.doc("projetos/" + PID)
            .update({ nome: cfg.nome })
            .catch(() => {});
      } catch (e) {
        toast(errMsg(e));
      }
    } else {
      saveLocal();
      render();
    }
  }
  async function saveStk() {
    pmoVelho();
    if (db) {
      try {
        await db.doc(PB + "config/stakeholders").set(clean(stk));
      } catch (e) {
        toast(errMsg(e));
      }
    } else {
      saveLocal();
      render();
    }
  }
  function pctFromDates(it) {
    return it.fimReal ? 100 : it.inicioReal ? 50 : 0;
  }
  function putItem(it) {
    if (+it.grupo === 3) it.pctReal = pctFromDates(it);
    const old = S.itens.find((x) => x.id === it.id);
    const f = old ? diffFields(old, it) : clean(it);
    if (old && !Object.keys(f).length) return;
    pmoVelho();
    patchItems([{ id: it.id, fields: f, isNew: !old }]);
    if (+it.grupo === 3) afterG3();
  }
  let cleanupDone = false;
  function maybeRevCleanup() {
    if (
      cleanupDone ||
      !db ||
      !cfgLoaded ||
      !cfg.revCleanup ||
      hasRevs() ||
      !S.itens.length
    )
      return;
    cleanupDone = true;
    const P = ofG(3)
      .filter((i) => i.inicioRev || i.fimRev || i.lagRev)
      .map((i) => ({
        id: i.id,
        fields: { inicioRev: "", fimRev: "", lagRev: 0 },
      }));
    patchItems(P);
    db.doc(PB + "config/projeto")
      .update({ revCleanup: 0 })
      .catch(() => {});
    cfg.revCleanup = 0;
    setTimeout(afterG3, 300);
  }
  /* migrações das etapas de SC/recebimento dos cronogramas antigos: desligadas (todos os projetos já
     foram convertidos e elas criavam uma etapa "Solicitação de compras" indevida em cronogramas novos) */
  const MIGRA_SC = false;
  function migrateEtapa3() {
    if (!MIGRA_SC) return false;
    const L = ofG(3);
    if (
      !L.length ||
      L.some((i) => /Solicita[çc][ãa]o de compras/i.test(i.faseNome || ""))
    )
      return false;
    const scs = L.filter(
      (i) =>
        i.sc &&
        /Solicita/i.test(i.pacoteNome || "") &&
        !/Recebimento/i.test(i.titulo || ""),
    );
    if (!scs.length) return false;
    const bump = (c) =>
      String(c || "").replace(/G3-F(\d+)/g, (m, n) =>
        +n >= 3 ? "G3-F" + p2(+n + 1) : m,
      );
    const st = {};
    L.forEach((i) => {
      st[i.id] = {
        faseNum: +i.faseNum >= 3 ? +i.faseNum + 1 : +i.faseNum,
        codigo: bump(i.codigo),
        pred: bump(i.pred),
      };
      if (+i.faseNum >= 3)
        st[i.id].faseNome = String(i.faseNome || "").replace(
          /^Frente\s*\d+/i,
          "Frente " + p2(+i.faseNum + 1),
        );
    });
    const ord = scs
      .slice()
      .sort((a, b) => +a.faseNum - +b.faseNum || +a.seq - +b.seq);
    const map = {};
    ord.forEach((i, k) => {
      const nc = `G3-F03-P01-A${p2(k + 1)}`;
      map[st[i.id].codigo] = nc;
      Object.assign(st[i.id], {
        faseNum: 3,
        faseNome: "Frente 03 · Solicitação de compras",
        pacoteNum: 1,
        pacoteNome: "Solicitações de compra",
        seq: k + 1,
        codigo: nc,
      });
    });
    const remap = (t) =>
      String(t || "").replace(/G3-F\d+-P\d+-A\d+/g, (x) => map[x] || x);
    const P = L.map((i) => {
      const f = st[i.id];
      f.pred = remap(f.pred);
      const o = {};
      Object.keys(f).forEach((k) => {
        if (f[k] !== i[k]) o[k] = f[k];
      });
      return { id: i.id, fields: o };
    }).filter((x) => Object.keys(x.fields).length);
    S.itens
      .filter((i) => +i.grupo !== 3 && /G3-F\d/.test(i.dep || ""))
      .forEach((i) =>
        P.push({ id: i.id, fields: { dep: remap(bump(i.dep)) } }),
      );
    patchItems(P);
    let ch = false;
    if (cfg.obsGrp) {
      const o = {};
      Object.entries(cfg.obsGrp).forEach(([k, v]) => {
        const m = k.match(/^f(\d+)(.*)$/);
        if (m && +m[1] >= 3) o["f" + (+m[1] + 1) + m[2]] = v;
        else o[k] = v;
      });
      cfg.obsGrp = o;
      ch = true;
    }
    if (
      Array.isArray(cfg.cronRevs) &&
      cfg.cronRevs.some((R) => +R.etapa >= 3)
    ) {
      cfg.cronRevs = cfg.cronRevs.map((R) =>
        +R.etapa >= 3 ? Object.assign({}, R, { etapa: +R.etapa + 1 }) : R,
      );
      ch = true;
    }
    if (ch) saveCfg();
    return true;
  }
  function migrateEtapa5() {
    if (!MIGRA_SC) return false;
    const L = ofG(3);
    if (
      !L.length ||
      // cronogramas que já têm etapa de suprimentos/recebimentos ou SCs nomeadas não são migrados
      L.some(
        (i) =>
          i.sc ||
          /Recebimento|Suprimentos|Solicita[çc]/i.test(i.faseNome || "") ||
          /^(SC|Recebimento|Contrata[çc][ãa]o ·)/i.test(i.titulo || ""),
      )
    )
      return false;
    const bump = (c) =>
      String(c || "").replace(/G3-F(\d+)/g, (m, n) =>
        +n >= 5 ? "G3-F" + p2(+n + 1) : m,
      );
    const P = [];
    L.filter((i) => +i.faseNum >= 5).forEach((i) => {
      const nf = +i.faseNum + 1;
      const f = {
        faseNum: nf,
        faseNome: String(i.faseNome || "").replace(
          /^Frente\s*\d+/i,
          "Frente " + p2(nf),
        ),
        codigo: bump(i.codigo),
        pred: bump(i.pred),
      };
      if (nf === 6 && /materiais/i.test(i.pred || ""))
        f.pred = "G3-F05 (todas)";
      P.push({ id: i.id, fields: f });
    });
    S.itens
      .filter((i) => +i.grupo !== 3 && /G3-F\d/.test(i.dep || ""))
      .forEach((i) => P.push({ id: i.id, fields: { dep: bump(i.dep) } }));
    P.push({
      id: "g3f05sc01",
      isNew: true,
      fields: {
        grupo: 3,
        ordem: Date.now(),
        faseNum: 5,
        faseNome: "Frente 05 · Recebimento de materiais",
        pacoteNum: 1,
        pacoteNome: "Solicitações de compra",
        seq: 1,
        codigo: "G3-F05-P01-A01",
        sc: 1,
        titulo: "SC 01 · Materiais do projeto (BOM)",
        resp: "Suprimentos",
        peso: 0,
        pred: "G3-F04 (todas)",
        predTipo: "TI",
        duracao: 15,
        inicio: "",
        fim: "",
        inicioRev: "",
        fimRev: "",
        inicioReal: "",
        fimReal: "",
        pctReal: 0,
        marco: false,
        valor: "",
        obs: "",
      },
    });
    patchItems(P);
    if (cfg.obsGrp) {
      const o = {};
      Object.entries(cfg.obsGrp).forEach(([k, v]) => {
        const m = k.match(/^f(\d+)(.*)$/);
        if (m && +m[1] >= 5) o["f" + (+m[1] + 1) + m[2]] = v;
        else o[k] = v;
      });
      cfg.obsGrp = o;
      saveCfg();
    }
    return true;
  }
  function openSC(f) {
    const L = ofG(3).filter((i) => +i.faseNum === f);
    const nxt = L.filter((i) => i.sc).length + 1;
    const form = $("#formFat");
    form.innerHTML = `<h3>Nova solicitação de compra · etapa ${f}</h3><div class="fgrid">
    <label>Nº da SC<input name="num" required value="${p2(nxt)}"></label>
    <label class="fwide">Descrição / materiais<input name="desc" required placeholder="Ex.: câmeras, postes, fontes"></label>
    <label>Fornecedor<input name="forn"></label>
    <label>Data da solicitação<input name="ini" type="date" value="${todayISO()}"></label>
    <label>Prazo de entrega (dias)<input name="dur" type="number" min="0" value="30"></label>
    <label>Responsável<input name="resp" value="PMO"></label></div>
    <p class="hint">A SC entra na etapa ${f} como atividade: o planejado vai da solicitação até a entrega prevista, e o realizado é lançado com a data de entrada em estoque.</p>
    <div class="actions"><button type="button" class="btn" id="scCancel">Cancelar</button><button class="btn primary" type="submit">Criar SC</button></div>`;
    $("#scCancel").onclick = () => $("#dlgFat").close();
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const dur = Math.max(0, Math.round(+d.dur || 0));
      const pn = (L[0] && L[0].pacoteNum) || 1;
      const seq =
        L.filter((i) => +i.pacoteNum === pn).reduce(
          (m, i) => Math.max(m, +i.seq || 0),
          0,
        ) + 1;
      const rev = hasRevs();
      const a = d.ini || "";
      const b = a ? fimUtil(a, dur) : "";
      const it = {
        id: uid(),
        grupo: 3,
        ordem: Date.now(),
        faseNum: f,
        faseNome:
          (L[0] && L[0].faseNome) ||
          `Frente ${p2(f)} · Recebimento de materiais`,
        pacoteNum: pn,
        pacoteNome: (L[0] && L[0].pacoteNome) || "Solicitações de compra",
        seq,
        codigo: `G3-F${p2(f)}-P${p2(pn)}-A${p2(seq)}`,
        sc: 1,
        titulo: `SC ${d.num.trim()} · ${d.desc.trim()}`,
        resp: (d.resp || "").trim() || "PMO",
        peso: 0,
        pred: a ? "" : (L[0] && L[0].pred) || "",
        predTipo: "TI",
        duracao: dur,
        inicio: rev ? "" : a,
        fim: rev ? "" : b,
        inicioRev: rev ? a : "",
        fimRev: rev ? b : "",
        inicioReal: "",
        fimReal: "",
        pctReal: 0,
        marco: false,
        valor: "",
        obs: d.forn ? "Fornecedor: " + d.forn.trim() : "",
      };
      if (rev) {
        it.inicio = a;
        it.fim = b;
      }
      $("#dlgFat").close();
      putItem(it);
      toast(`SC ${d.num.trim()} incluída na etapa ${f}.`);
    };
    $("#dlgFat").showModal();
  }
  /* Setor responsável padrão pelo tipo de tarefa (G3 e G5). Partes externas (cliente,
     concessionária, operadora…) e pessoas nomeadas não são alteradas. */
  /* SETOR_INI */
  const SETOR_EXTERNO = /^(cliente|concessionaria|operadora|provedor|municipio|spgg|prefeitura|contratante)$/;
  const RESP_V = 5; // versão das regras de setor já aplicadas no projeto (cfg.respV)
  /* nomes de responsável unificados (versão 3) */
  const RENOMEAR_RESP = {
    cliente: "Contratante",
    municipio: "Contratante",
    operadora: "Provedor",
    "leonardo sauter": "Implantação",
    "marcos goncalves": "Suprimentos",
    "rua goncalves": "Infraestrutura",
    "pre-vendas": "Pré-vendas",
    projetos: "PMO", // versão 5: documentação e gestão ficam com o PMO
  };
  /* setor por tarefa definido pelo PMO (versão 4) */
  function setorTarefa(i) {
    const t = normNome(i.titulo).split(/\s*›\s*/).pop();
    if (/apostilamento/.test(t)) return "Pré-vendas";
    if (/^ajuste\b/.test(t)) return "Implantação";
    if (/ativacao|ativar/.test(t) && !/energi|link/.test(t) && !SETOR_EXTERNO.test(normNome(i.resp)))
      return "Infraestrutura";
    return null;
  }
  function setorDe(i) {
    if (+i.grupo !== 3 && +i.grupo !== 5) return null;
    const r = normNome(i.resp);
    // aprovações e aceites do órgão contratante: um único nome, "Contratante"
    const tf = normNome(i.titulo).split(/\s*›\s*/).pop();
    if (/^(spgg|municipio|cliente|prefeitura)$/.test(r) && /aprova|aceite/.test(tf)) return "Contratante";
    if (SETOR_EXTERNO.test(r)) return null;
    if (r && !/^(implantacao|infraestrutura|projetos|suprimentos|comercial|pmo|pre-vendas|analista|suporte|administrativo|intrasetor|intersetorial|cs|cx|cs\/cx)( ?\/ ?[a-z-]+)*$/.test(r))
      return null; // responsável nomeado (pessoa)
    // a regra vale para a tarefa (último trecho do título "Grupo › Tarefa"); o grupo só decide o handover
    const partes = normNome(i.titulo).split(/\s*›\s*/);
    const t = partes[partes.length - 1];
    const grp = partes.slice(0, -1).join(" ");
    const fase = normNome(i.faseNome);
    const ponto = !!i.ponto || /^ponto\b/.test(normNome(i.pacoteNome));
    const ehSC = /^sc\b|solicitacao de compra/.test(t);
    const receb = /recebimento|suprimentos/.test(fase) || /^(rm\b|recebimento)/.test(t);
    if (/handover/.test(t) || /handover/.test(grp)) return "Infraestrutura";
    if (ehSC) return receb ? null : "PMO"; // no recebimento, a "SC" é a entrega do material (Suprimentos)
    if (/caderno de atividades/.test(t)) return "PMO";
    if (/memorial|descritivo|\btermos?\b|projeto executivo|projeto as.?built|pranchas?|\bart\b|a\.r\.t/.test(t))
      return "PMO";
    if (/escopo|arquitetura/.test(t)) return "Infraestrutura";
    if (/configura/.test(t)) return "Infraestrutura";
    if (/vistoria/.test(t)) return "Implantação";
    if (/energi|padrao de (medicao|entrada)|\bposte\b|\blink\b|conectividade/.test(t)) return "Implantação";
    if (/ativacao|ativar/.test(t)) return "Infraestrutura";
    if (ponto && /infraestrutura/.test(t)) return "Implantação";
    return null;
  }
  /* SETOR_FIM */
  /* responsável depois das regras ainda não aplicadas no projeto (versão v): 1 = setores por tipo
     de tarefa, 2 = aceites do contratante, 3 = nomes unificados */
  function respNovo(i, v) {
    let r = i.resp;
    if (v < 2) {
      const s = setorDe(i);
      if (s && (v < 1 || s === "Contratante")) r = s;
    }
    if (v < 4) r = RENOMEAR_RESP[normNome(r)] || r;
    if (v < 5) r = String(r || "").replace(/(^|[\/,;]\s*)Projetos(?=\s*[\/,;]|$)/gi, "$1PMO");
    if (v < 4 && (+i.grupo === 3 || +i.grupo === 5)) r = setorTarefa(i) || r;
    return r !== i.resp ? r : null;
  }
  function migrateResp() {
    const v = +cfg.respV || (cfg.respV1 ? 1 : 0);
    if (v >= RESP_V) return;
    const P = S.itens
      .map((i) => ({ i, s: respNovo(i, v) }))
      .filter((x) => x.s)
      .map((x) => ({ id: x.i.id, fields: { resp: x.s } }));
    if (P.length) patchItems(P);
    cfg.respV = RESP_V;
    saveCfg();
  }
  /* a função "Analista do projeto" passou a se chamar "PMO do projeto" */
  const FUNCAO_ANTIGA = { "analista do projeto": "PMO do projeto" };
  const funcaoAtual = (f) => FUNCAO_ANTIGA[String(f || "").trim().toLowerCase()] || f;
  function migrateFuncao() {
    const L = Array.isArray(stk.dgt) ? stk.dgt : [];
    if (!L.some((c) => funcaoAtual(c.funcao) !== c.funcao)) return;
    stk.dgt = L.map((c) => Object.assign({}, c, { funcao: funcaoAtual(c.funcao) }));
    saveStk();
  }
  /* durações gravadas antes do calendário de dias úteis estavam em dias corridos: converte uma
     única vez para o equivalente em dias úteis, pelo período planejado (ou proporção 5/7) */
  function duracaoUtil(i) {
    const d = +i.duracao;
    if (i.duracao === "" || i.duracao == null || isNaN(d) || d === 0) return null;
    const a = i.inicio,
      b = i.fim;
    const n = a && b ? Math.max(1, diasUteis(a, b)) : Math.max(1, Math.round((d * 5) / 7));
    return n !== d ? n : null;
  }
  function migrateDiasUteis() {
    if (cfg.diasUteis) return;
    const P = ofG(3)
      .map((i) => ({ id: i.id, n: duracaoUtil(i) }))
      .filter((x) => x.n != null)
      .map((x) => ({ id: x.id, fields: { duracao: x.n } }));
    if (P.length) patchItems(P);
    cfg.diasUteis = 1;
    saveCfg();
  }
  function migrateDur() {
    const D = {};
    PONTO_TPL.forEach((t) => (D[t[0]] = t[3]));
    const p = S.itens
      .filter((i) => i.ponto && !i.durTpl && D[i.titulo] != null)
      .map((i) => ({ id: i.id, fields: { duracao: D[i.titulo], durTpl: 1 } }));
    patchItems(p);
  }
  /* peso físico automático: proporcional à duração da atividade em dias úteis (marco = 0) */
  function durDias(i) {
    if (i.duracao !== "" && i.duracao != null && !isNaN(+i.duracao)) return Math.max(0, +i.duracao);
    const a = rI(i),
      b = rF(i);
    return a && b ? Math.max(1, diasUteis(a, b)) : 1;
  }
  function normWeights() {
    const L = ofG(3);
    const P = L.reduce((s, i) => s + durDias(i), 0);
    if (!L.length || !P) return [];
    const out = L.map((i) => ({
      id: i.id,
      v: Math.round(((durDias(i) * 100) / P) * 1000) / 1000,
    }));
    const d =
      Math.round((100 - out.reduce((s, x) => s + x.v, 0)) * 1000) / 1000;
    out.sort((a, b) => b.v - a.v);
    out[0].v = Math.round((out[0].v + d) * 1000) / 1000;
    return out
      .filter((x) => {
        const it = L.find((i) => i.id === x.id);
        return it.peso === "" || it.peso == null || Math.abs(+it.peso - x.v) > 0.0005;
      })
      .map((x) => ({ id: x.id, fields: { peso: x.v } }));
  }
  function afterG3() {
    const nw = normWeights();
    if (nw.length) patchItems(nw);
    const ch = reschedule(S.itens);
    patchItems(ch);
    return ch.length;
  }
  /* Programação automática: passagem para frente pela rede de predecessoras (dias úteis) */
  // folga da predecessora em dias úteis, no fim do texto: "+7d", "+ 7 dias", "-2d"
  const LAG_RE = /\s*([+-])\s*(\d+)\s*d(?:ias?)?\s*$/i;
  const predLag = (p) => {
    const m = String(p || "").match(LAG_RE);
    return m ? (m[1] === "-" ? -1 : 1) * +m[2] : 0;
  };
  /* predecessora na etapa/grupo/ponto (cfg.predGrp[chave]): vale para as atividades de dentro que não
     têm predecessora própria; a mais próxima (grupo antes da etapa) prevalece */
  const ANC = new WeakMap(); // por montagem da árvore (wbs)
  function ancestrais(W) {
    if (ANC.has(W)) return ANC.get(W);
    const M = new Map();
    ANC.set(W, M);
    W.top.forEach((U, fn) => {
      const K = chavesEtapa(W, fn);
      const desce = (L, pais) =>
        L.forEach((n) => {
          if (n.item) return M.set(n.item.id, pais);
          const k = K.get(n);
          const P = k ? [k].concat(pais) : pais;
          if (n.head) M.set(n.head.id, P);
          desce(n.bloco ? n.pts : n.kids || [], P);
        });
      desce(U, ["f" + fn]);
    });
    return M;
  }
  function predHerdada(i, anc) {
    if (String(i.pred || "").trim()) return null;
    const G = cfg.predGrp || {};
    if (!Object.keys(G).length) return null;
    if (!(anc instanceof Map)) anc = ancestrais(anc); // aceita a árvore (wbs) ou o mapa pronto
    const k = (anc.get(i.id) || []).find((x) => G[x] && String(G[x].pred || "").trim());
    return k ? Object.assign({ chave: k }, G[k]) : null;
  }
  function predIds(i, ctx) {
    const out = [];
    const p = String(i.pred || "").replace(LAG_RE, "");
    p.split(/\s*[+,;]\s*/).forEach((tok) => {
      tok = tok.trim();
      let m;
      if ((m = tok.match(/G3-F0*(\d+)\s*\(todas\)/i))) {
        (ctx.byFase.get(+m[1]) || []).forEach((x) => out.push(x.id));
        return;
      }
      if ((m = tok.match(/G3-F\d+-P\d+-A\d+/))) {
        const x = ctx.byCode.get(m[0]);
        if (x) out.push(x.id);
        return;
      }
      if ((m = tok.match(/^G3-F0*(\d+)$/i))) {
        (ctx.byFase.get(+m[1]) || []).forEach((x) => out.push(x.id));
        return;
      }
      if ((m = tok.match(/^(\d+(?:\.\d+)*)(?:\s*(TI|II|TT|IT))?$/i))) {
        const n = m[1];
        if (!n.includes(".")) {
          (ctx.byFase.get(+n) || []).forEach((x) => out.push(x.id));
          return;
        }
        const id = ctx.byNum.get(n);
        if (id) {
          out.push(id);
          return;
        }
        ctx.byNum.forEach((v, k) => {
          if (k.startsWith(n + ".")) out.push(v);
        });
      }
    });
    return [...new Set(out)].filter((x) => x !== i.id);
  }
  function reschedule(list) {
    const L = ofG(3, list);
    if (!L.length) return [];
    const W = wbs(list);
    const byId = new Map(L.map((i) => [i.id, i]));
    const byCode = new Map(L.filter((i) => i.codigo).map((i) => [i.codigo, i]));
    const byFase = new Map();
    L.forEach((i) => {
      const f = +i.faseNum || 0;
      if (!byFase.has(f)) byFase.set(f, []);
      byFase.get(f).push(i);
    });
    const byNum = new Map();
    W.num.forEach((n, id) => byNum.set(n, id));
    const ctx = { byFase, byCode, byNum };
    const anc = ancestrais(W);
    const rev = hasRevs();
    const kI = rev ? "inicioRev" : "inicio",
      kF = rev ? "fimRev" : "fim";
    const get = (i) => ({
      a: rev ? i.inicioRev || i.inicio : i.inicio,
      b: rev ? i.fimRev || i.fim : i.fim,
    });
    const dur = (i) => {
      if (i.duracao !== "" && i.duracao != null && !isNaN(+i.duracao))
        return Math.max(0, +i.duracao);
      const g = get(i);
      if (g.a && g.b) return Math.max(1, diasUteis(g.a, g.b));
      return 1;
    };
    const endOf = fimUtil;
    const cap = Math.max(1, +cfg.capPontoDia || 2);
    const ptRank = new Map();
    W.tree.forEach((T) => {
      T.filter((n) => n.ponto)
        .sort((x, y) => x.ponto - y.ponto)
        .forEach((n, k) => {
          const f = n.items.find((i) => (+i.seq || 0) === 1);
          if (f) ptRank.set(f.id, k);
        });
    });
    const plan = new Map(),
      eff = new Map(),
      vis = new Set();
    // o realizado não mexe no planejado nem no revisado das sucessoras; só o que já estava concluído
    // na data da revisão vigente entra com as datas reais (a revisão congela o realizado)
    const rdAtual = rev ? (cronRevs()[cronRevs().length - 1] || {}).data || "" : "";
    const proj = (i, r) =>
      rdAtual && i.fimReal && i.fimReal <= rdAtual ? { a: i.inicioReal || i.fimReal, b: i.fimReal } : { a: r.a, b: r.b };
    /* atividade-resumo (mesmo nome do grupo, com atividades dentro): é o próprio grupo, então vai do
       início da primeira ao fim da última atividade de dentro; a duração dela não manda nas datas */
    const RES = new Map();
    {
      const desc = (n, out) => {
        if (n.item) out.push(n.item);
        (n.items || []).forEach((x) => out.push(x));
        if (n.head) out.push(n.head);
        (n.pts || []).forEach((x) => desc(x, out));
        return out;
      };
      const varre = (L) =>
        L.forEach((n) => {
          if (n.bloco && n.head && n.pts && n.pts.length) {
            const ks = desc({ pts: n.pts }, []).filter((x) => x.id !== n.head.id && byId.has(x.id));
            if (ks.length) RES.set(n.head.id, ks);
          }
          if (n.pts) varre(n.pts);
        });
      W.top.forEach((U) => varre(U));
    }
    const calc = (i) => {
      if (eff.has(i.id)) return eff.get(i.id);
      if (vis.has(i.id)) {
        return proj(i, get(i));
      }
      vis.add(i.id);
      if (RES.has(i.id)) {
        const ks = RES.get(i.id);
        const E = ks.map(calc);
        const Pl = ks.map((k) => plan.get(k.id)).filter((x) => x && x.a);
        const mn = (L, k) => L.map((x) => x[k]).filter(Boolean).sort()[0] || "";
        const mx = (L, k) => L.map((x) => x[k]).filter(Boolean).sort().pop() || "";
        const r = Pl.length ? { a: mn(Pl, "a"), b: mx(Pl, "b") } : get(i);
        plan.set(i.id, r);
        const e = { a: mn(E, "a") || r.a, b: E.every((x) => x.b) ? mx(E, "b") : r.b };
        vis.delete(i.id);
        eff.set(i.id, e);
        return e;
      }
      const d = dur(i);
      let r = get(i);
      // datas pela predecessora x (texto + tipo de vínculo); null quando não há predecessora
      const porPred = (x, propria) => {
        const ps = predIds(x, ctx)
          .map((id) => byId.get(id))
          .filter(Boolean);
        const g2 = /(^|[\s+])G2(?![\w-])/i.test(String(x.pred || "")) ? grpDates(2) : null;
        // itens de sprint como predecessora (G1/G2/G4/G5-Sxx-Txx): conclusão real ou o período da sprint
        const spr = [...String(x.pred || "").matchAll(/G([1245])-S\d+-T\d+/g)]
          .map((m) => (list || S.itens).find((y) => y.codigo === m[0] && +y.grupo === +m[1]))
          .filter(Boolean)
          .map((y) => {
            const P = sprintPer(+y.grupo, +y.sprint || 1) || grpDates(+y.grupo) || [];
            return { a: y.inicioReal || y.inicio || P[0], b: y.fimReal || y.fim || P[1] };
          });
        if (!(ps.length || g2 || spr.length)) return null;
        const pr = ps.map(calc).concat(spr);
        if (g2) pr.push({ a: g2[0], b: g2[1] });
        const t = String(x.predTipo || "TI").toUpperCase();
        const ult = (k) => pr.map((y) => y[k]).sort().pop();
        let a = null,
          b = null;
        if (t === "II") {
          if (pr.every((y) => y.a)) a = proxUtil(ult("a"));
        } else if (t === "TT") {
          if (pr.every((y) => y.b)) {
            b = proxUtil(ult("b"));
            a = addUteis(b, -(Math.max(d, 1) - 1));
          }
        } else if (t === "IT") {
          if (pr.every((y) => y.a)) {
            b = proxUtil(ult("a"));
            a = addUteis(b, -(Math.max(d, 1) - 1));
          }
        } else if (pr.every((y) => y.b)) {
          // término-início: começa no próximo dia útil após a predecessora
          a = proxUtil(addDays(ult("b"), 1));
        }
        const lag = predLag(x.pred);
        if (a && lag) {
          a = addUteis(a, lag);
          if (b) b = addUteis(b, lag);
        }
        if (a && propria && rev && +i.lagRev) {
          a = addUteis(a, +i.lagRev);
          if (b) b = addUteis(b, +i.lagRev);
        }
        if (a && i.ponto && (+i.seq || 0) === 1 && t === "TI" && !/G3-F\d+-P\d+-A\d+/.test(String(x.pred || ""))) {
          const k = ptRank.get(i.id) || 0;
          a = addUteis(a, Math.floor(k / cap));
        }
        return a ? { a, b: b || endOf(a, d) } : {};
      };
      const own = String(i.pred || "").trim() ? porPred(i, true) : null;
      // etapa/grupo/ponto de cima com predecessora: piso para todas as atividades de dentro,
      // tenham ou não predecessora própria (vale a data mais tarde)
      const PG = cfg.predGrp || {};
      const pais = (anc.get(i.id) || [])
        .filter((k) => PG[k] && String(PG[k].pred || "").trim())
        .map((k) => porPred({ id: i.id, pred: PG[k].pred, predTipo: PG[k].predTipo || "TI" }, false))
        .filter(Boolean);
      let melhor = own && own.a ? own : null;
      pais.forEach((x) => {
        if (x.a && (!melhor || x.a > melhor.a)) melhor = x;
      });
      if (melhor) r = { a: melhor.a, b: melhor.b };
      else if (own || pais.length) {
        // tem predecessora, mas ela ainda não tem data: mantém o planejado
      } else if (!r.a && (stk.apc || stk.oi)) {
        // execução: começa no dia seguinte à reunião de APC (sem APC registrada, na ordem de início)
        const a = proxUtil(stk.apc ? addDays(stk.apc, 1) : stk.oi);
        r = { a, b: endOf(a, d) };
      } else if (r.a && i.duracao !== "" && i.duracao != null) {
        const a = proxUtil(r.a);
        r = { a, b: endOf(a, d) };
      } else if (r.a) {
        // datas fixas sem duração: início e fim levados para dias úteis
        const a = proxUtil(r.a);
        const b = r.b ? antUtil(r.b) : a;
        r = { a, b: b < a ? a : b };
      }
      plan.set(i.id, r);
      // projeção para as sucessoras: planejado/revisado (o realizado não reprograma as sucessoras)
      const e = proj(i, r);
      vis.delete(i.id);
      eff.set(i.id, e);
      return e;
    };
    const out = [];
    L.forEach((i) => {
      calc(i);
      const r = plan.get(i.id);
      if (!r || !r.a) return;
      const g = get(i);
      const f = {};
      if (r.a !== g.a) f[kI] = r.a;
      if (r.b !== g.b) f[kF] = r.b;
      if (rev && (!i.inicio || !i.fim)) {
        f.inicio = i.inicio || r.a;
        f.fim = i.fim || r.b;
      }
      if (!rev) {
        const nd = diasUteis(r.a, r.b);
        if (RES.has(i.id)) {
          if (+i.duracao !== nd) f.duracao = nd;
        } else if (i.duracao === "" || i.duracao == null) {
          if (Object.keys(f).length) f.duracao = nd;
        }
      }
      if (Object.keys(f).length) out.push({ id: i.id, fields: f });
    });
    return out;
  }
  function snapshot(list) {
    const c = corte();
    put("progresso", {
      id: c,
      data: c,
      fisico: Math.round(physReal(list) * 10000) / 10000,
    });
  }

  /* ---------- Métricas ---------- */
  const ofG = (g, L) => (L || S.itens).filter((i) => +i.grupo === +g);
  function wfun(L) {
    // execução (G3): peso pela duração em dias úteis; demais grupos, pelo peso gravado
    const g3 = L.length && L.every((i) => +i.grupo === 3);
    const pf = g3 ? durDias : (i) => +i.peso || 0;
    const P = L.reduce((s, i) => s + pf(i), 0);
    return { P, w: (i) => (P > 0 ? pf(i) : 1), W: P > 0 ? P : L.length };
  }
  function frac(t, a, b) {
    if (!a || !b) return 0;
    a = dtN(a);
    b = dtN(b);
    if (t < a) return 0;
    if (t >= b + DAY) return 1;
    return Math.min(1, (t - a + DAY) / (b - a + DAY));
  }
  const rI = (i) => (hasRevs() && i.inicioRev) || i.inicio,
    rF = (i) => (hasRevs() && i.fimRev) || i.fim;
  const cronRevs = () => (Array.isArray(cfg.cronRevs) ? cfg.cronRevs : []);
  const hasRevs = () => cronRevs().length > 0;
  const RKEY = "pmo-hibrido-revsel";
  let revForce = null; // exportação: fixa a revisão vigente, sem mudar a seleção da tela
  function selRevN() {
    if (revForce != null) return revForce;
    const L = cronRevs();
    let v = null;
    try {
      v = localStorage.getItem(RKEY);
    } catch (e) {}
    const n = v == null || v === "" ? L.length : +v;
    return Math.max(0, Math.min(L.length, isNaN(n) ? L.length : n));
  }
  const revName = (n) => (n ? `R${p2(n)}` : "R00");
  // atividade incluída numa revisão (revIni = nº da revisão): não existe nas anteriores
  const naRev = (i, n) => (+i.revIni || 0) <= n;
  function revDates(i, n) {
    if (!naRev(i, n)) return ["", ""];
    if (!n) return [i.inicio, i.fim];
    const L = cronRevs();
    let d;
    if (n >= L.length) d = [rI(i), rF(i)];
    else {
      const sn = (L[n - 1] && L[n - 1].snap) || {};
      d = sn[i.id] || [rI(i), rF(i)];
    }
    // a revisão congela o realizado: o que já estava concluído na data da revisão fica com as datas reais;
    // o que não foi concluído (inclusive em andamento) segue o replanejamento da revisão
    const rd = ((L[Math.min(n, L.length) - 1] || {}).data) || "";
    if (rd && i.fimReal && i.fimReal <= rd) return [i.inicioReal || i.fimReal, i.fimReal];
    return d;
  }
  /* pesos e datas de cada atividade para a curva planejada: montados uma vez por tarefa do navegador
     (o gráfico chama physPlan para cada data; refazer pesos e datas a cada ponto era o mais lento) */
  let PPC = null;
  function ppPrep(n, L0) {
    // a carteira troca de projeto (S.itens e cfg) dentro da mesma tarefa: a chave inclui os dois
    if (!L0 && PPC && PPC.n === n && PPC.rf === revForce && PPC.itens === S.itens && PPC.cfg === cfg && PPC.len === S.itens.length) return PPC;
    const L = (L0 || ofG(3)).filter((i) => naRev(i, n));
    const { w, W } = wfun(L);
    const arr = L.map((i) => {
      const d = revDates(i, n);
      return [w(i), d[0] ? dtN(d[0]) : null, d[1] ? dtN(d[1]) : null];
    });
    const r = { n, rf: revForce, W, arr, itens: S.itens, cfg, len: S.itens.length };
    if (!L0) {
      PPC = r;
      queueMicrotask(() => (PPC = null));
    }
    return r;
  }
  function physPlan(t, rev, L) {
    const n = rev ? selRevN() : 0;
    const { W, arr } = ppPrep(n, L);
    if (!W) return 0;
    let s = 0;
    for (const [w, a, b] of arr) {
      if (a == null || b == null) continue;
      s += w * (t < a ? 0 : t >= b + DAY ? 1 : Math.min(1, (t - a + DAY) / (b - a + DAY)));
    }
    return s / W;
  }
  function physReal(list) {
    const L = ofG(3, list);
    const { w, W } = wfun(L);
    if (!W) return 0;
    return L.reduce((s, i) => s + (w(i) * pctFromDates(i)) / 100, 0) / W;
  }
  const metaMode = () => finParams().M > 0;
  function fimExec(rev) {
    const L = ofG(3);
    if (!L.length) return null;
    const n = rev ? selRevN() : 0;
    const ds = L.map((i) => revDates(i, n)[1]).filter(Boolean);
    if (!ds.length) return null;
    return ds.sort().pop();
  }
  /* ===== Regras de faturamento e medição (locação) ===== */
  const ymOf = (s) => (s ? String(s).slice(0, 7) : "");
  const ymAdd = (ym, k) => {
    let [y, m] = ym.split("-").map(Number);
    m += k;
    y += Math.floor((m - 1) / 12);
    m = ((((m - 1) % 12) + 12) % 12) + 1;
    return y + "-" + p2(m);
  };
  const ymStart = (ym) =>
    new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).getTime();
  const ymDim = (ym) => new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
  const ymLbl = (ym) => MES[+ym.slice(5, 7) - 1] + "/" + ym.slice(2, 4);
  const ymCmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  function easter(y) {
    const a = y % 19,
      b = Math.floor(y / 100),
      c = y % 100,
      d = Math.floor(b / 4),
      e = b % 4,
      f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4),
      k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31),
      da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  const _hol = {};
  function holidays(y) {
    if (_hol[y]) return _hol[y];
    const s = new Set(
      [
        "01-01",
        "04-21",
        "05-01",
        "09-07",
        "10-12",
        "11-02",
        "11-15",
        "11-20",
        "12-25",
      ].map((x) => y + "-" + x),
    );
    const E = easter(y);
    [-48, -47, -2, 60].forEach((k) => {
      const d = new Date(E);
      d.setDate(d.getDate() + k);
      s.add(iso(d));
    });
    return (_hol[y] = s);
  }
  const isBiz = (d) => {
    const w = d.getDay();
    return w !== 0 && w !== 6 && !holidays(d.getFullYear()).has(iso(d));
  };
  function nfDate(comp) {
    const b = ymAdd(comp, 1);
    const d = new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, 10);
    while (!isBiz(d) && d.getDate() > 1) d.setDate(d.getDate() - 1);
    return iso(d);
  }
  function recDate(nf) {
    const d = dt(nf);
    const r = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    while (!isBiz(r)) r.setDate(r.getDate() + 1);
    return iso(r);
  }
  const isAq = (o) => (o || stk).natureza === "aquisicao";
  // doação: sem contrato assinado, sem valor e sem faturamento
  const isDoa = (o) => (o || stk).natureza === "doacao";
  const OPT_DOA = `<option value="doacao">Doação (sem contrato e sem faturamento)</option>`;
  function finParams() {
    const P = prazos();
    if (isDoa()) return { M: 0, n: 0, total: 0, doa: true };
    if (isAq()) {
      const t = +stk.valorContrato || 0;
      return { M: t, n: t ? 1 : 0, total: t, aq: true };
    }
    const n = +stk.mesesValor || 0;
    const M = P.parcela || 0;
    const total =
      +stk.valorContrato ||
      M * n ||
      ofG(3).reduce((s, i) => s + (+i.valor || 0), 0);
    return { M, n, total };
  }
  function tadDate(rev) {
    return fimExec(rev);
  }
  /* cronograma de faturamento planejado: R00 (baseline) ou revisão vigente */
  function schedFor(rev) {
    const { M, n, aq } = finParams();
    // locação faturada desde a assinatura (opção do contrato) ou, por padrão, a partir do T.A.D.
    const tad =
      !aq && stk.fatInicio === "assinatura" && stk.assinatura
        ? stk.assinatura
        : tadDate(rev);
    if (!M || !n || !tad) return [];
    if (aq) {
      const c = ymOf(tad);
      return [
        {
          comp: c,
          v: Math.round(M * 100) / 100,
          tipo: "unica",
          bill: ymAdd(c, 1),
        },
      ];
    }
    const R = (v) => Math.round(v * 100) / 100;
    if (stk.fatInicio === "assinatura" && stk.assinatura) {
      const out = [];
      for (let k = 0; k < n; k++)
        out.push({ comp: ymAdd(ymOf(tad), k), v: M, tipo: "cheia" });
      out.forEach((e) => (e.bill = ymAdd(e.comp, 1)));
      return out;
    }
    // visão da implantação: nível mensal por competência (pontos ativos antes do T.A.D.)
    // até a 1ª parcela cheia, com o passado congelado em cada revisão
    const L = lvRev(rev ? selRevN() : 0);
    if (!L.ini) return [];
    const out = [];
    for (let c = L.ini, k = 0; k < 240; c = ymAdd(c, 1), k++) {
      const x = L.get(c);
      if (!x || x.v <= 0.005) continue;
      out.push({ comp: c, v: R(x.v), tipo: x.tipo, bill: ymAdd(c, 1) });
      if (x.v >= M - 0.005) break;
    }
    return out;
  }
  /* ---------- Faturamento por ponto (itens do contrato medidos ponto a ponto) ---------- */
  // pontos da implantação (mesmo número de ponto em várias etapas = o mesmo ponto)
  function ptList() {
    const M = new Map();
    ofG(3).forEach((i) => {
      if (!i.ponto) return;
      const k = String(+i.pacoteNum || 0);
      let p = M.get(k);
      if (!p) M.set(k, (p = { k, nome: i.pacoteNome || "Ponto " + p2(+i.pacoteNum), blk: gPath(i).join(" › "), items: [] }));
      p.items.push(i);
    });
    return [...M.values()].sort((a, b) => +a.k - +b.k);
  }
  const itId = (it, k) => it.id || "i" + k;
  const medDef = (m) => m != null && m !== "";
  // valor mensal de cada ponto: itens "por ponto" na quantidade medida no ponto;
  // sem medição, o saldo do item é dividido igualmente entre os pontos não medidos
  function ptValores() {
    const P = ptList();
    const I = itensC().map((it, k) => Object.assign({}, it, { id: itId(it, k) }));
    const med = stk.medPonto || {};
    let central = 0;
    P.forEach((p) => {
      p.v = 0;
      p.q = {};
    });
    if (!P.length) return { P, I, central: 0 };
    if (!I.length) {
      const M = finParams().M;
      P.forEach((p) => (p.v = M / P.length));
      return { P, I, central: 0, semItens: true };
    }
    I.forEach((it) => {
      const vu = +it.vu || 0,
        q = +it.qtd || 0;
      if (it.med === "tad") {
        central += q * vu;
        return;
      }
      const mm = (p) => (med[p.k] || {})[it.id];
      const usados = P.filter((p) => medDef(mm(p)));
      const soma = usados.reduce((s, p) => s + (+mm(p) || 0), 0);
      const resto = P.length - usados.length;
      const cada = resto ? Math.max(0, q - soma) / resto : 0;
      P.forEach((p) => {
        const auto = !medDef(mm(p));
        const qq = auto ? cada : +mm(p) || 0;
        p.q[it.id] = { q: qq, auto };
        p.v += qq * vu;
      });
    });
    return { P, I, central: Math.round(central * 100) / 100 };
  }
  // ativação do ponto = término da última atividade do ponto (planejado na revisão n)
  const ptAtiv = (p, n) => {
    const d = p.items.map((i) => revDates(i, n)[1]);
    return d.every(Boolean) ? d.sort().pop() : "";
  };
  const ptAtivReal = (p) =>
    p.items.every((i) => i.fimReal) ? p.items.map((i) => i.fimReal).sort().pop() : "";
  const tadAt = (n) => {
    const ds = ofG(3).map((i) => revDates(i, n)[1]).filter(Boolean);
    return ds.length ? ds.sort().pop() : "";
  };
  /* nível mensal planejado na revisão n, sem congelar: cada ponto entra no mês seguinte
     à ativação pelo seu valor mensal; na competência do T.A.D. completa a parcela pro rata;
     depois do T.A.D., parcela cheia. Teto do nível = 1ª parcela. */
  function lvRaw(n) {
    const { M } = finParams();
    const tad = tadAt(n);
    if (!M || !tad) return { ini: "", get: () => null };
    const R = (v) => Math.round(v * 100) / 100;
    const tadC = ymOf(tad),
      day = +tad.slice(8, 10),
      dim = ymDim(tadC);
    // ponto ativado: fatura já na competência da ativação, pro rata dos dias restantes
    // (ativação nos últimos 7 dias do mês: começa na competência seguinte), e cheio depois
    const st = ptValores()
      .P.map((p) => {
        const a = ptAtiv(p, n);
        if (!a || !(p.v > 0)) return null;
        const c0 = ymOf(a),
          dd = +a.slice(8, 10),
          dm = ymDim(c0);
        const f0 = dd > dm - 7 ? 0 : Math.min(30, dm - dd + 1) / 30;
        return { c0, f0, c: f0 > 0 ? c0 : ymAdd(c0, 1), v: p.v };
      })
      .filter((s) => s && s.c <= tadC);
    const base = (c) => {
      const t = st.reduce((a, s) => a + (s.c0 === c ? s.v * s.f0 : s.c0 < c ? s.v : 0), 0);
      return t >= M - 0.01 ? M : t;
    };
    const ini = st.length ? st.map((s) => s.c).sort()[0] : tadC;
    // T.A.D. nos últimos 7 dias do mês: a parcela cheia começa na competência seguinte
    const bT = base(tadC);
    const pr = day > dim - 7 ? bT : bT + ((M - bT) * Math.min(30, dim - day + 1)) / 30;
    const ff = pr >= M - 0.005 ? tadC : ymAdd(tadC, 1);
    return {
      ini,
      ff,
      get(c) {
        if (c < ini) return null;
        if (c >= ff) return { v: M, tipo: "cheia" };
        if (c === tadC) return pr > 0.005 ? { v: R(pr), tipo: day > dim - 7 ? "parcial" : "prorata" } : null;
        const b = base(c);
        return b > 0.005 ? { v: R(b), tipo: "parcial" } : null;
      },
    };
  }
  // revisão n: as competências anteriores ao mês da revisão ficam congeladas: com boletim,
  // valem o faturado (a revisão assume o realizado); sem boletim, como estavam na revisão anterior
  function lvRev(n) {
    const raw = lvRaw(n);
    if (!n) return raw;
    const rv = cronRevs()[n - 1] || {};
    const cut = ymOf(rv.data || "");
    if (!cut) return raw;
    const prev = lvRev(n - 1);
    const fat = new Map();
    realAlloc().forEach((e) => {
      if (e.comp < cut) fat.set(e.comp, (fat.get(e.comp) || 0) + (+e.v || 0));
    });
    const iniF = [...fat.keys()].sort()[0] || "";
    const ini = [prev.ini && prev.ini < cut ? prev.ini : "", iniF, raw.ini].filter(Boolean).sort()[0] || "";
    return {
      ini,
      cut,
      get: (c) => {
        if (c >= cut) return raw.get(c);
        if (fat.has(c)) return { v: Math.round(fat.get(c) * 100) / 100, tipo: "realizado" };
        return prev.get(c);
      },
    };
  }
  /* aumento de recorrência: quanto o nível mensal sobe de uma competência para a outra,
     até a 1ª parcela cheia (teto). Quedas (glosas, meses sem boletim) não reduzem
     a recorrência já implantada. */
  function recSerie(E, M) {
    const by = new Map();
    E.forEach((e) => by.set(e.comp, (by.get(e.comp) || 0) + (+e.v || 0)));
    const cs = [...by.keys()].sort();
    if (!cs.length || !M) return [];
    const out = [];
    let top = 0;
    for (let c = cs[0]; c <= cs[cs.length - 1]; c = ymAdd(c, 1)) {
      const nv = Math.min(M, by.get(c) || 0);
      const novo = Math.max(top, nv);
      out.push({ comp: c, bill: ymAdd(c, 1), nivel: Math.round(nv * 100) / 100, aum: Math.round((novo - top) * 100) / 100, acum: Math.round(novo * 100) / 100 });
      top = novo;
      if (top >= M - 0.005) break;
    }
    return out;
  }
  /* boletins de medição (realizado = liberados + em liberação) */
  function boletins() {
    return S.fats
      .map((f) => {
        const comp = f.comp || ymOf(f.data);
        return Object.assign({}, f, {
          comp,
          compFim: f.compFim && f.compFim >= comp ? f.compFim : comp,
          situacao: f.situacao || "liberado",
          envio: f.envio || f.data || "",
        });
      })
      .filter((b) => b.comp)
      .sort((a, b) => ymCmp(a.comp, b.comp));
  }
  function realAlloc() {
    const out = [];
    boletins().forEach((b) => {
      const comps = [];
      let c = b.comp;
      while (c <= b.compFim && comps.length < 120) {
        comps.push(c);
        c = ymAdd(c, 1);
      }
      const v = +b.valor || 0,
        cents = Math.round(v * 100),
        base = Math.floor(cents / comps.length);
      comps.forEach((c, k) =>
        out.push({
          comp: c,
          bill: ymAdd(c, 1),
          v:
            (k === comps.length - 1
              ? cents - base * (comps.length - 1)
              : base) / 100,
          b,
          first: k === 0,
        }),
      );
    });
    return out;
  }
  function realImpl() {
    const RA = realAlloc();
    if (isAq()) return RA;
    const M = finParams().M;
    if (!M) return RA;
    const S = recSerie(RA, M);
    const u = S[S.length - 1];
    if (!u || u.acum < M - 0.005) return RA;
    const pl = [...sched(false), ...sched(true)].map((e) => e.comp).sort().pop() || "";
    const lim = pl > u.comp ? pl : u.comp;
    return RA.filter((e) => e.comp <= lim);
  }
  const cumBill = (E, t) =>
    E.reduce((s, e) => s + (ymStart(e.bill) <= t ? e.v : 0), 0);
  function finPlan(t, rev) {
    return cumBill(sched(rev), t);
  }
  function finReal(t) {
    return cumBill(realImpl(), t);
  }
  function finTotal() {
    return finParams().total;
  }
  function firstFull(rev) {
    const E = sched(rev);
    const M = finParams().M;
    return E.find((e) => e.v >= M - 0.005) || null;
  }
  function schedR00() {
    return schedFor(false);
  }
  function sched(rev) {
    return schedFor(!!rev);
  }
  function renderRevSel() {
    const el = $("#finRevSel");
    if (!el) return;
    {
      const bd = $("#btnDelRev");
      if (bd) bd.disabled = !cronRevs().length;
    }
    const L = cronRevs();
    const cur = selRevN();
    el.innerHTML =
      `<option value="0">R00</option>` +
      L.map(
        (R, k) =>
          `<option value="${k + 1}">${revName(k + 1)}${k === L.length - 1 ? " (em vigor)" : ""}</option>`,
      ).join("");
    el.value = String(cur);
    {
      const m = $("#revMot2");
      if (m) {
        const R = cur ? L[cur - 1] : null;
        m.textContent = R
          ? [
              R.impactos && R.impactos.filter((x) => +x.dias).length > 1
                ? `Impactos: ${R.impactos.filter((x) => +x.dias).map((x) => `${x.rot} ${x.dias > 0 ? "+" : ""}${x.dias} d`).join("; ")}`
                : R.dias
                  ? `Impacto ${R.dias > 0 ? "+" : ""}${R.dias} d`
                  : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : "";
        m.title = m.textContent;
      }
    }
  }
  function delRev() {
    const L = cronRevs();
    if (!L.length) {
      toast("Não há revisões para excluir.");
      return;
    }
    const n = selRevN();
    if (!n) {
      toast("Selecione na lista a revisão que deseja excluir.");
      return;
    }
    if (n !== L.length) {
      toast(
        `Só a revisão mais recente (${revName(L.length)}) pode ser excluída. Exclua as posteriores primeiro.`,
      );
      return;
    }
    askConfirm(
      `Excluir a ${revName(n)}? As datas da execução voltam para a ${revName(n - 1)}${n === 1 ? " (planejado original)" : ""}. Esta ação não pode ser desfeita.`,
      "Excluir revisão",
    ).then((ok) => {
      if (!ok) return;
      const R = L[n - 1],
        prev = L[n - 2];
      const P = [];
      ofG(3).forEach((i) => {
        const f = {};
        if (prev) {
          const d = (prev.snap || {})[i.id];
          if (
            d &&
            (d[0] !== (i.inicioRev || "") || d[1] !== (i.fimRev || ""))
          ) {
            f.inicioRev = d[0] || "";
            f.fimRev = d[1] || "";
          }
        } else if (i.inicioRev || i.fimRev) {
          f.inicioRev = "";
          f.fimRev = "";
        }
        if (!prev) {
          if (+i.lagRev) f.lagRev = 0;
        } else if (+i.lagRev && (R.lags ? R.lags[i.id] : R.item === i.id && R.dias)) {
          f.lagRev = (+i.lagRev || 0) - (R.lags ? R.lags[i.id] : R.dias);
        }
        if (Object.keys(f).length) P.push({ id: i.id, fields: f });
      });
      const NL = L.slice(0, -1).map((x) => Object.assign({}, x));
      if (NL.length) delete NL[NL.length - 1].snap;
      cfg.cronRevs = NL;
      if (!NL.length) {
        cfg.gates = Object.assign({}, cfg.gates, { g23: false });
        cfg.gateDates = Object.assign({}, cfg.gateDates || {}, { g23: "" });
      }
      try {
        localStorage.removeItem(RKEY);
      } catch (e) {}
      saveCfg();
      patchItems(P);
      setTimeout(afterG3, 0);
      toast(`${revName(n)} excluída.`);
    });
  }
  function openNewRev() {
    const L = cronRevs();
    const n = L.length + 1;
    const d = $("#dlgConfirm"),
      f = $("#formConfirm");
    const W = wbs();
    const fases = fasesWF();
    if (!fases.length) {
      toast("Cadastre as atividades da execução antes de criar uma revisão.");
      return;
    }
    const nomeF = (x) =>
      (x.nome || "").replace(/^Frente\s*\d+\s*[·\-–]\s*/i, "");
    // início planejado vigente (o mais cedo entre as atividades) e diferença com sinal em dias úteis
    const inicioAtual = (its) => its.map((i) => rI(i)).filter(Boolean).sort()[0] || "";
    // término planejado vigente (o mais tarde entre as atividades)
    const fimAtual = (its) => its.map((i) => rF(i)).filter(Boolean).sort().pop() || "";
    const difUteis = (a, b) => {
      a = proxUtil(a);
      return b > a ? diasUteis(addDays(a, 1), b) : b < a ? -diasUteis(b, addDays(a, -1)) : 0;
    };
    // grupos da etapa (grupos e pontos), para achar a atividade mais rápido
    const grupos = (fn) => {
      const G = [];
      const soltas = [];
      const grp = (n, d) => {
        G.push({ k: "b:" + n.num, rot: `${"  ".repeat(d)}${n.num} · ${n.bloco}`, its: n.items });
        n.pts.forEach((x) =>
          x.bloco ? grp(x, d + 1) : x.ponto ? G.push({ k: "p:" + x.num, rot: `${"  ".repeat(d + 1)}${x.num} · ${x.nome || "Ponto " + p2(x.ponto)}`, its: x.items }) : null,
        );
      };
      (W.top.get(fn) || []).forEach((n) => {
        if (n.item) soltas.push(n.item);
        else if (n.bloco) grp(n, 0);
        else if (n.ponto) G.push({ k: "p:" + n.num, rot: `${n.num} · ${n.nome || "Ponto " + p2(n.ponto)}`, its: n.items });
      });
      if (soltas.length && G.length) G.unshift({ k: "soltas", rot: "Atividades fora de grupo", its: soltas });
      return G;
    };
    const grpOpts = (fn) =>
      `<option value="">Todos os grupos</option>${grupos(fn).map((g) => `<option value="${esc(g.k)}">${esc(g.rot)}</option>`).join("")}`;
    const itsDe = (fn, gk) => {
      const g = gk ? grupos(fn).find((x) => x.k === gk) : null;
      return g ? g.its : W.byFase.get(fn) || [];
    };
    const kids = (fn, gk) => {
      const L0 = itsDe(fn, gk);
      return `<option value="__todas">Todas as atividades (${L0.filter((i) => !i.fimReal).length} em aberto)</option>` + L0
        .map((i) => `<option value="${i.id}">${W.num.get(i.id)} · ${esc(i.titulo)}${i.fimReal ? " (concluída)" : ""}</option>`)
        .join("");
    };
    // um impacto = etapa + grupo + atividade (ou todas) + dias; a revisão pode ter vários
    const linhaImp = () => `<div class="revimp">
      <label>Etapa<select class="riFase">${fases.map((x) => `<option value="${x.num}">${x.num} · ${esc(nomeF(x))}</option>`).join("")}</select></label>
      <label>Grupo<select class="riGrp">${grpOpts(fases[0].num)}</select></label>
      <label class="riAtv">Atividade<select class="riItem">${kids(fases[0].num, "")}</select></label>
      <label class="riRef">Alterar<select class="riModo" title="Escolha se a data informada é o novo início ou o novo término"><option value="ini">Início</option><option value="fim">Fim</option></select></label>
      <label class="riD"><span class="riLbl">Novo início</span><input class="riData" type="date" title="Data em que a atividade (ou a primeira do grupo) passa a começar"><small class="riAtual"></small></label>
      <button type="button" class="ico rm" data-rirm title="Remover impacto" aria-label="Remover impacto"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
    </div>`;
    f.innerHTML = `<h3>Criar ${revName(n)}</h3><p style="margin:0;font-size:14px">${L.length ? `A ${revName(L.length)} será congelada.` : `O planejado R00 será congelado.`} Informe onde o cronograma da execução passa a ser impactado. Pode haver mais de um impacto (grupos ou atividades diferentes, cada um com os seus dias); as sucessoras são reprogramadas.</p>
  <label class="chkl"><input type="checkbox" id="revSem"> Sem impacto: só registrar a revisão (nenhuma atividade é deslocada)</label>
  <div id="revImps">${linhaImp()}</div>
  <button type="button" class="btn ghost" id="revAdd">+ Adicionar impacto</button>
  <div class="fgrid"><label class="fwide">Motivo<input id="revMot" placeholder="Ex.: atraso de energia, aditivo de prazo, replanejamento"></label></div>
  <p class="hint" id="revPrev"></p>
  <div class="actions"><button type="button" class="btn" id="cfNo">Cancelar</button><button type="button" class="btn primary" id="cfYes">Criar ${revName(n)}</button></div>`;
    const box = $("#revImps");
    const sem = $("#revSem");
    // atividades de cada linha (abertas; uma atividade em mais de uma linha fica com a última)
    const lerImps = () =>
      [...box.querySelectorAll(".revimp")].map((r) => {
        const fn = +r.querySelector(".riFase").value,
          gk = r.querySelector(".riGrp").value,
          iv = r.querySelector(".riItem").value;
        const its = iv === "__todas" ? itsDe(fn, gk).filter((i) => !i.fimReal) : S.itens.filter((x) => x.id === iv);
        const rot = iv === "__todas" ? `${gk ? (r.querySelector(".riGrp").selectedOptions[0] || {}).text.trim() : "etapa " + fn} (${its.length} ativ.)` : its[0] ? W.num.get(its[0].id) : "";
        // a data pedida vale para o início atual (o mais cedo) ou para o término atual (o mais tarde);
        // o deslocamento é em dias úteis e vale para todas as atividades da linha
        const modo = (r.querySelector(".riModo") || {}).value === "fim" ? "fim" : "ini";
        const base = modo === "fim" ? fimAtual(its) : inicioAtual(its);
        const v = r.querySelector(".riData").value;
        const alvo = v && +v.slice(0, 4) > 1999 ? (modo === "fim" ? antUtil(v) : proxUtil(v)) : "";
        const dias = base && alvo ? (modo === "fim" ? difUteis(antUtil(base), alvo) : difUteis(base, alvo)) : 0;
        return { fn, gk, iv, its, rot, base, alvo, dias, modo };
      });
    // atualiza a data sugerida (o início atual) quando muda a atividade/grupo
    const sugerir = (r) => {
      const fn = +r.querySelector(".riFase").value,
        gk = r.querySelector(".riGrp").value,
        iv = r.querySelector(".riItem").value;
      const its = iv === "__todas" ? itsDe(fn, gk).filter((i) => !i.fimReal) : S.itens.filter((x) => x.id === iv);
      const fim = (r.querySelector(".riModo") || {}).value === "fim";
      const b = fim ? fimAtual(its) : inicioAtual(its);
      r.querySelector(".riData").value = b;
      r.querySelector(".riLbl").textContent = fim ? "Novo fim" : "Novo início";
      r.querySelector(".riData").title = fim ? "Data em que a atividade (ou a última do grupo) passa a terminar" : "Data em que a atividade (ou a primeira do grupo) passa a começar";
      r.querySelector(".riAtual").textContent = b ? `${fim ? "término" : "início"} atual ${fmtD(b)}` : fim ? "sem término planejado" : "sem início planejado";
    };
    const prev = () => {
      box.hidden = sem.checked;
      $("#revAdd").hidden = sem.checked;
      if (sem.checked) {
        $("#revPrev").textContent = "A revisão é registrada sem deslocar nenhuma atividade: o planejado atual passa a ser a revisão vigente.";
        return;
      }
      const I = lerImps().filter((x) => x.its.length && x.dias);
      const nA = new Set(I.flatMap((x) => x.its.map((i) => i.id))).size;
      $("#revPrev").textContent = I.length
        ? `${I.map((x) => `${x.rot}: ${x.modo === "fim" ? "término" : "início"} ${fmtD(x.base)} → ${fmtD(x.alvo)} (${x.dias > 0 ? "+" : ""}${x.dias} dia${Math.abs(x.dias) === 1 ? "" : "s"} út${Math.abs(x.dias) === 1 ? "il" : "eis"})`).join(" · ")} — ${nA} atividade${nA === 1 ? "" : "s"} deslocada${nA === 1 ? "" : "s"}; as concluídas não mudam e as sucessoras são recalculadas.`
        : "Informe, para cada impacto, a nova data de início ou de término (início em fim de semana ou feriado vai para o próximo dia útil; término, para o dia útil anterior).";
    };
    box.onchange = (e) => {
      const r = e.target.closest(".revimp");
      if (e.target.classList.contains("riFase")) {
        r.querySelector(".riGrp").innerHTML = grpOpts(+e.target.value);
        r.querySelector(".riItem").innerHTML = kids(+e.target.value, "");
        sugerir(r);
      } else if (e.target.classList.contains("riGrp")) {
        r.querySelector(".riItem").innerHTML = kids(+r.querySelector(".riFase").value, e.target.value);
        sugerir(r);
      } else if (e.target.classList.contains("riItem") || e.target.classList.contains("riModo")) sugerir(r);
      prev();
    };
    box.oninput = prev;
    box.onclick = (e) => {
      if (e.target.closest("[data-rirm]")) {
        if (box.querySelectorAll(".revimp").length > 1) e.target.closest(".revimp").remove();
        prev();
      }
    };
    $("#revAdd").onclick = () => {
      box.insertAdjacentHTML("beforeend", linhaImp());
      sugerir(box.lastElementChild);
      prev();
    };
    sem.onchange = prev;
    sugerir(box.querySelector(".revimp"));
    prev();
    $("#cfNo").onclick = () => d.close();
    $("#cfYes").onclick = () => {
      const mot = $("#revMot").value.trim();
      const I = sem.checked ? [] : lerImps().filter((x) => x.its.length && x.dias);
      if (!sem.checked && !I.length) {
        toast("Informe a atividade e a nova data (início ou fim) de cada impacto, ou marque “Sem impacto”.");
        return;
      }
      // dias por atividade (a última linha que a menciona vale)
      const lags = {};
      I.forEach((x) => x.its.forEach((i) => (lags[i.id] = x.dias)));
      const R = L.map((x) => Object.assign({}, x));
      if (R.length) {
        const snap = {};
        ofG(3).forEach((i) => {
          snap[i.id] = [rI(i), rF(i)];
        });
        R[R.length - 1].snap = snap;
      }
      const ids = Object.keys(lags);
      R.push({
        n,
        data: todayISO(),
        motivo: mot,
        etapa: I[0] ? I[0].fn : "",
        item: ids[0] || "",
        itemNum: I.length ? I.map((x) => x.rot).join(" · ") : "sem impacto",
        itens: ids,
        lags,
        impactos: I.map((x) => ({ etapa: x.fn, grupo: x.gk, item: x.iv, rot: x.rot, dias: x.dias, de: x.base, para: x.alvo, ref: x.modo })),
        dias: I.length === 1 ? I[0].dias : 0,
      });
      cfg.cronRevs = R;
      cfg.gates = Object.assign({}, cfg.gates, { g23: true });
      if (!(cfg.gateDates && cfg.gateDates.g23))
        cfg.gateDates = Object.assign({}, cfg.gateDates || {}, {
          g23: todayISO(),
        });
      try {
        localStorage.removeItem(RKEY);
      } catch (e) {}
      d.close();
      saveCfg();
      // cada atividade: com predecessora, desloca pelo atraso (lag); sem, pelas datas da revisão
      const P = [];
      ids.forEach((id) => {
        const x = S.itens.find((i) => i.id === id);
        const dd = lags[id];
        if (!x || !dd) return;
        const hasP = predIds(x, { byFase: new Map(), byCode: new Map(), byNum: new Map() }).length || String(x.pred || "").trim();
        if (hasP) P.push({ id, fields: { lagRev: (+x.lagRev || 0) + dd } });
        else {
          const a = rI(x),
            b = rF(x);
          // deslocamento em dias úteis (o mesmo da data pedida)
          if (a) P.push({ id, fields: { inicioRev: addUteis(proxUtil(a), dd), fimRev: b ? addUteis(antUtil(b), dd) : "" } });
        }
      });
      if (P.length) patchItems(P);
      afterG3();
      toast(`${revName(n)} criada${I.length ? ` · ${I.length} impacto${I.length > 1 ? "s" : ""}, ${ids.length} atividade${ids.length > 1 ? "s" : ""}` : " sem deslocar atividades"}.`);
    };
    d.showModal();
  }

  function finRange() {
    const ms = [...sched(false), ...sched(true), ...realImpl()].map(
      (e) => e.bill,
    );
    const cm = ymAdd(ymOf(corte()), 0);
    if (!ms.length) return null;
    // locação com a 1ª parcela já alcançada: a implantação terminou, não estende até o mês atual
    const M1 = finParams().M;
    const rs = !isAq() && M1 ? recSerie(realImpl(), M1) : [];
    if (isAq() || !rs.length || rs[rs.length - 1].acum < M1 - 0.005) ms.push(cm);
    ms.sort();
    return {
      a: ymStart(ms[0]),
      b: ymStart(ymAdd(ms[ms.length - 1], 1)),
      months: (() => {
        const L = [];
        let m = ms[0];
        while (m <= ms[ms.length - 1]) {
          L.push(m);
          m = ymAdd(m, 1);
        }
        return L;
      })(),
    };
  }
  const SIT = { liberacao: "Em liberação", liberado: "Liberado" };
  function seriesFin() {
    const rev = "vigente";
    const ct = dt(corte()).getTime();
    const R0 = sched(false),
      RV = sched(true),
      RA = realAlloc();
    return [
      {
        name: "Planejado R00",
        color: C("--base"),
        dash: "6 4",
        width: 1.8,
        fn: (t) => cumBill(R0, t),
      },
      ...(selRevN()
        ? [
            {
              name: `Revisão ${revName(selRevN())}`,
              color: C("--scrum"),
              dash: "6 4",
              width: 2,
              fn: (t) => cumBill(RV, t),
            },
          ]
        : []),
      {
        name: "Realizado (liberados + em liberação)",
        color: C("--ok"),
        width: 3,
        until: ct,
        fn: (t) => cumBill(RA, t),
      },
    ];
  }
  /* recorrência mensal: barras = recorrência implantada (realizado), com o aumento do mês
     destacado; linhas = nível previsto (R00 e revisão); referência = 1ª parcela cheia */
  function recChart(host, lg) {
    if (!host) return;
    const M = finParams().M;
    const R0 = sched(false),
      RV = sched(true),
      RA = realImpl();
    drawRec(host, lg, {
      M,
      s0: recSerie(R0, M),
      sv: recSerie(RV, M),
      sr: recSerie(RA, M),
      rev: selRevN() ? revName(selRevN()) : "",
      mv: ymOf(corte()),
    });
  }
  /* desenha a recorrência: séries {bill, acum, aum}; M = meta (1ª parcela ou soma da carteira) */
  function drawRec(host, lg, o) {
    const { M, s0, sv, sr, mv } = o;
    const all = [...s0, ...sv, ...sr].map((e) => e.bill).sort();
    if (!M || !all.length) {
      host.innerHTML = `<div class="chart-empty">${isDoa() ? "Doação: sem faturamento." : "Informe a parcela mensal e as datas da execução para traçar a recorrência."}</div>`;
      if (lg) lg.innerHTML = "";
      return;
    }
    let a = all[0],
      b = all[all.length - 1];
    if (mv > b && sr.length && sr[sr.length - 1].acum < M - 0.005) b = mv;
    a = ymAdd(a, -1);
    b = ymAdd(b, 1);
    let ms = [];
    for (let m = a; m <= b && ms.length < 60; m = ymAdd(m, 1)) ms.push(m);
    if (o.meses && ms.length > o.meses) {
      const iv = ms.indexOf(mv);
      const ini = Math.max(0, Math.min(ms.length - o.meses, (iv < 0 ? (mv < ms[0] ? 0 : ms.length) : iv) - 5));
      ms = ms.slice(ini, ini + o.meses);
    }
    const lv = (S, bm) => {
      const L = S.filter((e) => e.bill <= bm);
      return L.length ? L[L.length - 1].acum : 0;
    };
    const ultR = sr.length ? sr[sr.length - 1].bill : "";
    const W = Math.max(320, host.clientWidth || 600),
      H = Math.round(Math.min(330, Math.max(230, W * 0.4)));
    const m = { l: 66, r: 14, t: 18, b: 28 };
    const iw = W - m.l - m.r,
      ih = H - m.t - m.b;
    const ymax = M * 1.1;
    const cw = iw / ms.length;
    const X = (k) => m.l + k * cw,
      Y = (v) => m.t + ih - (Math.min(v, ymax) / ymax) * ih;
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = (M * k) / 4;
      g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${BRLc(v)}</text>`;
    }
    const st = Math.max(1, Math.ceil(ms.length / Math.max(2, Math.floor(iw / 58))));
    let bars = "",
      lab = "";
    ms.forEach((bm, k) => {
      if (!(k % st)) g += `<text class="ax" x="${X(k) + cw / 2}" y="${H - 8}" text-anchor="middle">${ymLbl(bm)}</text>`;
      if (bm === mv) g += `<rect x="${X(k)}" y="${m.t}" width="${cw}" height="${ih}" fill="var(--scrum)" fill-opacity=".07"/>`;
      if (!ultR || bm > (mv > ultR ? mv : ultR)) return;
      const ac = lv(sr, bm);
      const x = sr.find((e) => e.bill === bm);
      const au = x ? x.aum : 0;
      const bw = Math.max(4, cw * 0.56),
        bx = X(k) + (cw - bw) / 2;
      if (ac - au > 0.005) bars += `<rect x="${bx}" y="${Y(ac - au)}" width="${bw}" height="${Y(0) - Y(ac - au)}" fill="var(--ok)" fill-opacity=".35" rx="2"/>`;
      if (au > 0.005) {
        bars += `<rect x="${bx}" y="${Y(ac)}" width="${bw}" height="${Y(ac - au) - Y(ac)}" fill="var(--ok)" rx="2"/>`;
        if (cw >= 34) lab += `<text class="ax" x="${bx + bw / 2}" y="${Y(ac) - 5}" text-anchor="middle" style="fill:var(--ok);font-weight:600">+${BRLc(au)}</text>`;
      }
    });
    const step = (S, cor, dash, w) => {
      let d = "";
      ms.forEach((bm, k) => {
        const y = Y(lv(S, bm)).toFixed(1);
        d += (k ? `L${X(k).toFixed(1)},${y}` : `M${X(k).toFixed(1)},${y}`) + `L${X(k + 1).toFixed(1)},${y}`;
      });
      return `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${w}" stroke-dasharray="${dash}" stroke-linejoin="round"/>`;
    };
    const teto = `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(M)}" y2="${Y(M)}" stroke="var(--wf)" stroke-width="1.5" stroke-dasharray="2 3"/><text class="ax" x="${W - m.r}" y="${Y(M) - 5}" text-anchor="end" style="fill:var(--wf);font-weight:600">${o.tetoLbl || "1ª parcela"} ${BRL(M)}</text>`;
    const rev = o.rev;
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Recorrência mensal implantada">${g}${bars}${step(s0, "var(--base)", "6 4", 1.8)}${rev ? step(sv, "var(--scrum)", "6 4", 2.2) : ""}${teto}${lab}<line class="hair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="display:none"/><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="tip"></div>`;
    const svg = host.querySelector("svg"),
      tip = host.querySelector(".tip"),
      hair = svg.querySelector(".hair"),
      hit = svg.querySelector(".hit");
    hit.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = ((ev.clientX - r.left) * W) / r.width;
      const k = Math.max(0, Math.min(ms.length - 1, Math.floor((sx - m.l) / cw)));
      const bm = ms[k];
      const xc = X(k) + cw / 2;
      hair.setAttribute("x1", xc);
      hair.setAttribute("x2", xc);
      hair.style.display = "";
      const au = (S) => (S.find((e) => e.bill === bm) || {}).aum || 0;
      const ln = (cor, nome, S, real) => {
        if (real && (!ultR || bm > (mv > ultR ? mv : ultR))) return "";
        const v = lv(S, bm),
          d = au(S);
        return `<div><span class="sw" style="background:${cor}"></span>${nome}: <b>${BRL(v)}</b> <span style="color:var(--muted)">${fmtPct(v / M)}${d > 0.005 ? ` · +${BRL(d)} no mês` : ""}</span></div>`;
      };
      tip.innerHTML = `<div style="color:var(--muted);margin-bottom:2px">Liberação ${ymLbl(bm)} · competência ${ymLbl(ymAdd(bm, -1))}</div>${ln("var(--base)", "Previsto R00", s0)}${rev ? ln("var(--scrum)", "Previsto " + rev, sv) : ""}${ln("var(--ok)", "Implantado", sr, true)}`;
      tip.style.display = "block";
      const hw = host.clientWidth,
        tw = tip.offsetWidth,
        px = (xc / W) * hw;
      tip.style.left = Math.max(0, Math.min(hw - tw, px + 12 > hw - tw ? px - tw - 12 : px + 12)) + "px";
      tip.style.top = "8px";
    });
    hit.addEventListener("mouseleave", () => {
      hair.style.display = "none";
      tip.style.display = "none";
    });
    if (lg)
      lg.innerHTML = `<div class="legend"><span><i style="background:var(--ok)"></i>Aumento no mês (realizado)</span><span><i style="background:var(--ok);opacity:.35"></i>Recorrência já implantada</span><span><i class="ln" style="border-color:var(--base)"></i>Previsto R00</span>${rev ? `<span><i class="ln" style="border-color:var(--scrum)"></i>Previsto ${rev}</span>` : ""}<span><i class="ln" style="border-color:var(--wf);border-top-style:dotted"></i>${o.tetoLbl || "1ª parcela cheia"}</span></div>`;
  }
  function finChart(host, lg) {
    if (!isAq()) return recChart(host, lg);
    const r = finRange();
    if (!host) return;
    if (!r) {
      host.innerHTML = `<div class="chart-empty">Informe valor, parcelamento e datas da execução para traçar o faturamento.</div>`;
      if (lg) lg.innerHTML = "";
      return;
    }
    const sn = seriesFin();
    const tot = finTotal();
    drawChart(host, {
      range: { a: r.a, b: r.b },
      series: sn,
      ymax: Math.max(tot, finReal(r.b), 1),
      yMoney: true,
      monthly: true,
      label: "Curva S financeira",
    });
    if (lg) lg.innerHTML = legend(sn);
  }
  function metScrum(g) {
    const L = ofG(g);
    const tot = L.reduce((s, i) => s + (+i.esforco || 0), 0);
    const isD = (i) => isDoneSt(stG(g, i.status));
    const done = L.filter(isD).reduce((s, i) => s + (+i.esforco || 0), 0);
    const nd = L.filter(isD).length;
    const pct = tot > 0 ? done / tot : L.length ? nd / L.length : 0;
    const sprints = [...new Set(L.map((i) => +i.sprint || 1))]
      .sort((a, b) => a - b)
      .map((s) => {
        const X = L.filter((i) => (+i.sprint || 1) === s);
        const t = X.reduce((a, i) => a + (+i.esforco || 0), 0);
        const d = X.filter(isD).reduce((a, i) => a + (+i.esforco || 0), 0);
        const n = X.length,
          n2 = X.filter(isD).length;
        return { s, t, d, n, nd: n2, pct: t > 0 ? d / t : n ? n2 / n : 0 };
      });
    return {
      L,
      n: L.length,
      nd,
      tot,
      done,
      pct,
      sprints,
      bloq: L.filter((i) => isBlockSt(stG(g, i.status))),
      and: L.some((i) => isProgSt(stG(g, i.status))),
    };
  }
  function metWF() {
    const L = ofG(3);
    const { P } = wfun(L);
    const t = dt(corte()).getTime();
    const real = physReal(),
      plan = physPlan(t, false),
      planR = physPlan(t, true);
    // x baseline: compara só o escopo que existia na R00 (sem atividades incluídas em revisões)
    const L0 = L.filter((i) => naRev(i, 0));
    const real0 = L0.length < L.length ? physReal(L0) : real;
    const c = corte();
    const late = L.filter((i) => rF(i) && rF(i) < c && pctFromDates(i) < 100);
    return {
      L,
      P,
      real,
      plan,
      planR,
      spi: plan > 0 ? real0 / plan : null,
      real0,
      spiR: planR > 0 ? real / planR : null,
      late,
      nd: L.filter((i) => pctFromDates(i) >= 100).length,
    };
  }
  function fasesWF() {
    const L = ofG(3);
    const m = new Map();
    L.forEach((i) => {
      const k = +i.faseNum || 0;
      if (!m.has(k))
        m.set(k, { num: k, nome: i.faseNome || "Fase " + p2(k), L: [] });
      m.get(k).L.push(i);
    });
    return [...m.values()]
      .sort((a, b) => a.num - b.num)
      .map((f) => {
        const { w, W } = wfun(f.L);
        const pct = W
          ? f.L.reduce((s, i) => s + (w(i) * pctFromDates(i)) / 100, 0) / W
          : 0;
        return Object.assign(f, { pct });
      });
  }
  function dateRange() {
    const ds = [];
    S.itens
      .filter((i) => +i.grupo === 3)
      .forEach((i) => {
        [
          "inicio",
          "fim",
          "inicioRev",
          "fimRev",
          "inicioReal",
          "fimReal",
        ].forEach((k) => i[k] && ds.push(i[k]));
      });
    S.fats.forEach((f) => f.data && ds.push(f.data));
    S.prog.forEach((p) => p.data && ds.push(p.data));
    if (!ds.length) return null;
    const P = prazos();
    if (P.lim) ds.push(P.lim);
    ds.sort();
    return { a: dt(ds[0]).getTime(), b: dt(ds[ds.length - 1]).getTime() + DAY };
  }

  /* ---------- Gráfico de linhas (SVG) ---------- */
  function drawChart(host, cfgc) {
    const W = Math.max(300, host.clientWidth || 600),
      H = Math.round(Math.min(340, Math.max(220, W * 0.42)));
    const m = { l: cfgc.yMoney ? 62 : 40, r: 14, t: 14, b: 28 };
    const iw = W - m.l - m.r,
      ih = H - m.t - m.b;
    const { a, b } = cfgc.range;
    const ymax = cfgc.ymax || 1;
    const X = (t) => m.l + ((t - a) / (b - a)) * iw,
      Y = (v) => m.t + ih - (v / ymax) * ih;
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = (ymax * k) / 4;
      g += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${cfgc.yMoney ? BRLc(v) : Math.round(v * 100) + "%"}</text>`;
    }
    if (cfgc.monthly) {
      const ms = [];
      let d = new Date(a);
      d = new Date(d.getFullYear(), d.getMonth(), 1);
      while (d.getTime() < b) {
        ms.push(d.getTime());
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      }
      const st = Math.max(
        1,
        Math.ceil(ms.length / Math.max(2, Math.floor(iw / 60))),
      );
      ms.forEach((t, k) => {
        const t2 = k + 1 < ms.length ? ms[k + 1] : b;
        g += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}" stroke-opacity=".45"/>`;
        if (k % st) return;
        const dd = new Date(t);
        g += `<text class="ax" x="${(X(t) + X(t2)) / 2}" y="${H - 8}" text-anchor="middle">${MES[dd.getMonth()]}/${String(dd.getFullYear()).slice(2)}</text>`;
      });
    } else {
      const weeks = [];
      {
        const d0 = new Date(a);
        let d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
        while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
        while (d.getTime() <= b) {
          weeks.push(d.getTime());
          d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
        }
      }
      const step = Math.max(
        1,
        Math.ceil(weeks.length / Math.max(2, Math.floor(iw / 56))),
      );
      weeks.forEach((t, i) => {
        if (i % step) return;
        const dd = new Date(t);
        g += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${m.t + ih}" stroke-opacity=".45"/><text class="ax" x="${X(t)}" y="${H - 8}" text-anchor="middle">${p2(dd.getDate())}/${p2(dd.getMonth() + 1)}</text>`;
      });
    }
    const ct = dt(corte()).getTime();
    (cfgc.marks || []).forEach((mk) => {
      if (mk.t >= a && mk.t <= b)
        g += `<line class="lim" x1="${X(mk.t)}" x2="${X(mk.t)}" y1="${m.t}" y2="${m.t + ih}"/>`;
    });
    if (ct >= a && ct <= b)
      g += `<line class="cut" x1="${X(ct)}" x2="${X(ct)}" y1="${m.t}" y2="${m.t + ih}"/><text class="cutl" x="${X(ct) + 4}" y="${m.t + 10}">corte</text>`;
    const N = Math.min(160, Math.max(40, Math.round(iw / 5)));
    const ts = [];
    for (let k = 0; k <= N; k++) ts.push(a + ((b - a) * k) / N);
    let paths = "";
    cfgc.series.forEach((s) => {
      const end = s.until != null ? Math.min(s.until, b) : b;
      const pts = ts.filter((t) => t <= end);
      if (s.until != null && end >= a) pts.push(end);
      if (!pts.length) return;
      const dpath = pts
        .map(
          (t, i) =>
            (i ? "L" : "M") +
            X(t).toFixed(1) +
            "," +
            Y(Math.min(ymax, s.fn(t))).toFixed(1),
        )
        .join("");
      paths += `<path d="${dpath}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.until != null && end >= a)
        paths += `<circle cx="${X(end)}" cy="${Y(Math.min(ymax, s.fn(end)))}" r="3.5" fill="${s.color}"/>`;
    });
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(cfgc.label)}">${g}${paths}<line class="hair" id="hair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="display:none"/><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="tip"></div>`;
    const svg = host.querySelector("svg"),
      tip = host.querySelector(".tip"),
      hair = svg.querySelector("#hair"),
      rect = svg.querySelector("rect");
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = ((ev.clientX - r.left) * W) / r.width;
      const t =
        a + ((Math.max(m.l, Math.min(W - m.r, sx)) - m.l) / iw) * (b - a);
      hair.setAttribute("x1", X(t));
      hair.setAttribute("x2", X(t));
      hair.style.display = "";
      const rows = cfgc.series
        .filter((s) => s.until == null || t <= s.until)
        .map(
          (s) =>
            `<div><span class="sw" style="background:${s.color}"></span>${esc(s.name)}: <b>${cfgc.yMoney && !s.pctInMoney ? BRL(s.fn(t)) : s.pctInMoney ? fmtPct(s.fn(t) / ymax) : fmtPct(s.fn(t))}</b></div>`,
        )
        .join("");
      tip.innerHTML = `<div style="color:var(--muted);margin-bottom:2px">${fmtD(iso(new Date(t)))}</div>${rows}`;
      tip.style.display = "block";
      const hw = host.clientWidth,
        tw = tip.offsetWidth,
        px = (X(t) / W) * hw;
      tip.style.left =
        Math.max(
          0,
          Math.min(hw - tw, px + 12 > hw - tw ? px - tw - 12 : px + 12),
        ) + "px";
      tip.style.top = "8px";
    };
    rect.addEventListener("mousemove", move);
    rect.addEventListener("touchstart", (e) => move(e.touches[0]), {
      passive: true,
    });
    rect.addEventListener("mouseleave", () => {
      tip.style.display = "none";
      hair.style.display = "none";
    });
  }
  function legend(series) {
    return `<div class="legend">${series.map((s) => `<span>${s.vert ? `<svg viewBox="0 0 10 16" style="width:10px;height:16px"><line x1="5" y1="1" x2="5" y2="15" stroke="${s.color}" stroke-width="${s.width || 1.2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/></svg>` : ""}<svg viewBox="0 0 24 8" ${s.vert ? 'style="display:none"' : ""}><line x1="1" y1="4" x2="23" y2="4" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linecap="round"/></svg>${esc(s.name)}</span>`).join("")}</div>`;
  }
  // cores do tema (variáveis CSS): lidas uma vez por tela; getComputedStyle a cada uso recalcula o estilo
  let CCOR = new Map();
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (CCOR = new Map()));
  } catch (e) {}
  const C = (v) => {
    let c = CCOR.get(v);
    if (c === undefined) {
      c = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      CCOR.set(v, c);
    }
    return c;
  };
  function seriesFis() {
    const rev = "vigente";
    const L = ofG(3);
    const ct = dt(corte()).getTime();
    const realFn = (t) => {
      const { w, W } = wfun(L);
      if (!W) return 0;
      return (
        // mesma regra do planejado: avança de forma linear entre o início e o término reais;
        // em andamento, avança até o % atual na data de corte
        L.reduce((a, i) => {
          if (i.fimReal) return a + w(i) * frac(t, i.inicioReal || i.fimReal, i.fimReal);
          if (i.inicioReal) {
            const pc = pctFromDates(i) / 100;
            return a + w(i) * pc * frac(t, i.inicioReal, corte());
          }
          return a;
        }, 0) / W
      );
    };
    return [
      {
        name: "Planejado R00",
        color: C("--base"),
        dash: "6 4",
        width: 1.8,
        fn: (t) => physPlan(t, false),
      },
      ...(selRevN()
        ? [
            {
              name: `Revisão ${revName(selRevN())}`,
              color: C("--wf"),
              dash: "6 4",
              width: 2,
              fn: (t) => physPlan(t, true),
            },
          ]
        : []),
      {
        name: "Realizado",
        color: C("--scrum"),
        width: 3,
        until: ct,
        fn: realFn,
      },
    ];
  }

  /* ---------- Painel ---------- */
  let rq = 0;
  function render() {
    if (rq) return;
    rq = requestAnimationFrame(() => {
      rq = 0;
      renderNow();
      ajustarTextos();
    });
  }
  function renderNow() {
    if (editingDate()) {
      pendingRender = true;
      return;
    }
    document.body.classList.toggle("cart", view === "carteira" || view === "pmo" || view === "config" || view === "minhas");
    document.body.classList.remove("carregando");
    permsTela();
    if (view === "minhas") {
      document.body.classList.add("full");
      renderSide();
      renderMinhas();
      return;
    }
    if (view === "config") {
      document.body.classList.add("full");
      renderSide();
      renderConfig();
      return;
    }
    if (view === "carteira") {
      document.body.classList.add("full");
      renderSide();
      renderCarteira();
      return;
    }
    if (view === "pmo") {
      document.body.classList.add("full");
      renderSide();
      renderPmo();
      return;
    }
    // carregando: sem cabeçalho do projeto (nome, revisão e abas ainda não existem)
    document.body.classList.toggle("carregando", !ready);
    if (!ready) {
      document.body.classList.add("full");
      $("#view").innerHTML =
        `<div class="loading"><span class="spin"></span>Carregando dados do projeto…</div>`;
      return;
    }
    document.body.classList.add("full");
    renderSide(); // marca o projeto aberto na barra (recolhida: selo com o código)
    const pn = $("#projName");
    if (document.activeElement !== pn) pn.value = cfg.nome || "";
    renderRevSel();

    const cli = stk.cliente;
    $("#subtitle").textContent = cli
      ? "Cliente: " + cli + (stk.contrato ? " · " + stk.contrato : "")
      : "PMBOK híbrido: Scrum em iniciação, planejamento, controle e encerramento; cascata na execução.";
    $("#views").innerHTML =
      `<a href="#painel" ${view === "painel" ? 'aria-current="page"' : ""}>Painel</a><a href="#g3" ${/^g/.test(view) ? 'aria-current="page"' : ""}>Cronograma e atividades</a>${PODE("financeiro") && !isDoa() ? `<a href="#fxf" ${view === "fxf" ? 'aria-current="page"' : ""}>Físico x financeiro</a>` : ""}`;
    if (view === "painel" || (view === "fxf" && !PODE("financeiro"))) renderPainel();
    else if (view === "fxf") renderFxF();
    else renderCrono();
  }
  function calcPrazos(o) {
    const r = {};
    r.aq = o.natureza === "aquisicao";
    const A = Array.isArray(o.aditivos) ? o.aditivos : [];
    r.addVig = A.filter((a) => a.tipo === "vig").reduce(
      (s, a) => s + (+a.qtd || 0),
      0,
    );
    r.addImpl = A.filter((a) => a.tipo === "impl").reduce(
      (s, a) => s + (+a.qtd || 0),
      0,
    );
    r.nAd = A.length;
    if (!r.aq && o.assinatura && +o.prazoContrato) {
      const d0 = dt(o.assinatura);
      const k = +o.prazoContrato + r.addVig;
      const last = new Date(
        d0.getFullYear(),
        d0.getMonth() + k + 1,
        0,
      ).getDate();
      const d = new Date(
        d0.getFullYear(),
        d0.getMonth() + k,
        Math.min(d0.getDate(), last),
      );
      d.setDate(d.getDate() - 1);
      r.vig = iso(d);
    }
    if (o.oi && +o.prazoImpl)
      r.lim = addDays(o.oi, +o.prazoImpl + r.addImpl - 1);
    r.valor = +o.valorContrato || 0;
    r.meses = +o.mesesValor || 0;
    r.parcela = r.valor && r.meses ? r.valor / r.meses : 0;
    if (r.aq) {
      r.meses = 1;
      r.parcela = r.valor;
    }
    return r;
  }
  function prazos() {
    return calcPrazos(stk);
  }
  function restam(s) {
    const n = Math.round((dt(s) - dt(corte())) / DAY);
    return n >= 0
      ? `restam ${n} dia${n === 1 ? "" : "s"}`
      : `vencido há ${-n} dia${n === -1 ? "" : "s"}`;
  }
  function przRows() {
    const P = prazos();
    const row = (l, main, sub, bad) =>
      `<div class="role"><span class="r">${l}</span><span class="n ${main ? "" : "tbd"}">${main || "A definir"}${sub ? `<span class="c" ${bad ? 'style="color:var(--alert)"' : ""}>${sub}</span>` : ""}</span></div>`;
    return (
      row(
        "Assinatura do contrato",
        isDoa() ? "Não se aplica" : stk.assinatura ? fmtD(stk.assinatura) : "",
        isDoa()
          ? "Doação · sem contrato assinado"
          : P.aq
          ? "Aquisição · sem prazo contratual de vigência"
          : stk.prazoContrato
            ? `Prazo contratual de ${fmtN(stk.prazoContrato)} meses`
            : "",
      ) +
      row("Ordem de início", stk.oi ? fmtD(stk.oi) : "", stk.oi ? "início da contagem do prazo de implantação" : "") +
      row(
        "Prazo de implantação",
        stk.prazoImpl ? `${fmtN(+stk.prazoImpl + (P.addImpl || 0))} dias` : "",
        stk.prazoImpl
          ? P.addImpl
            ? `${fmtN(stk.prazoImpl)} dias contratuais + ${fmtN(P.addImpl)} de aditivo`
            : "contados da ordem de início"
          : "",
      ) +
      row(
        "Limite de implantação",
        P.lim ? fmtD(P.lim) : "",
        P.lim ? restam(P.lim) : "",
        P.lim && P.lim < corte() && metWF().real < 1,
      ) +
      row(
        "Reunião de APC",
        stk.apc ? fmtD(stk.apc) : "",
        stk.apc
          ? apcLapso(stk) > APC_TOL
            ? `${apcLapso(stk)} dias após a ordem de início · atraso administrativo`
            : apcLapso(stk)
              ? `${apcLapso(stk)} dia${apcLapso(stk) === 1 ? "" : "s"} após a ordem de início · dentro da tolerância de ${APC_TOL} dias`
              : "a execução começa no dia seguinte"
          : "",
        apcLapso(stk) > APC_TOL,
      ) +
      (() => {
        // atraso administrativo: total no projeto e cada período (o lapso OS → APC entra automaticamente)
        const r = admResumo(stk);
        const H = admHist(stk).slice().sort((a, b) => (a.ini || "9").localeCompare(b.ini || "9"));
        if (!H.length) return row("Atraso administrativo", "Nenhum", "Sem atraso administrativo registrado");
        // períodos em vermelho, ocupando a largura toda do card (abaixo do rótulo e do total)
        const per = H.map((x) => `<li><span>${esc(x.mot || "Sem motivo informado")}</span><b>${!x.ini ? "início a informar" : x.fim ? `${fmtD(x.ini)} a ${fmtD(x.fim)}` : `desde ${fmtD(x.ini)}, em aberto`}${x.ini ? ` · ${diasCorridos(x.ini, x.fim || todayISO())} d` : ""}</b></li>`).join("");
        return `<div class="role admrole"><span class="r">Atraso administrativo</span><span class="n">${r.total} dia${r.total === 1 ? "" : "s"}${r.abertos ? " · em aberto" : ""}</span><ul class="admper">${per}</ul></div>`;
      })() +
      ((stk.aditivos || []).length
        ? `<h3 style="margin-top:14px">Aditivos de prazo</h3>` +
          (stk.aditivos || [])
            .map((a) =>
              row(
                esc(a.num || "Aditivo"),
                `+${fmtN(a.qtd || 0)} ${a.tipo === "vig" ? "meses" : "dias"}`,
                `${a.tipo === "vig" ? "Vigência" : "Implantação"}${a.data ? " · " + fmtD(a.data) : ""}`,
              ),
            )
            .join("")
        : row("Aditivos de prazo", "", "Nenhum aditivo registrado"))
    );
  }
  function valRows() {
    const P = prazos();
    const row = (l, main, sub, cls) =>
      `<div class="role"><span class="r">${l}</span><span class="n ${main ? "" : "tbd"} ${cls || ""}">${main || "A definir"}${sub ? `<span class="c">${sub}</span>` : ""}</span></div>`;
    const fat = finReal(dt(corte()).getTime());
    const saldo = P.valor ? P.valor - fat : 0;
    const np =
      !P.aq && P.parcela && saldo > 0 ? Math.ceil(saldo / P.parcela - 1e-3) : 0;
    const objRow = stk.objeto ? `<div class="role objrow"><span class="r">Objeto</span><span class="n obj">${esc(stk.objeto)}</span></div>` : "";
    if (isDoa()) return objRow + row("Natureza", "Doação", "Sem contrato, sem valor e sem faturamento");
    return (
      objRow +
      row(
        "Valor total",
        P.valor ? BRL(P.valor) : "",
        stk.contrato ? esc(stk.contrato) : "",
      ) +
      (P.aq
        ? row("Natureza", "Aquisição", "Parcela única após o T.A.D.")
        : row(
            "Parcelamento",
            P.meses ? `${fmtN(P.meses)} meses` : "",
            P.parcela ? `Locação · parcela mensal de ${BRL(P.parcela)}` : "",
          )) +
      row(
        "Faturado até a data",
        BRL(fat),
        P.valor ? fmtPct(fat / P.valor) + " do contrato" : "",
      ) +
      row(
        "Saldo a faturar",
        P.valor ? BRL(saldo) : "",
        np
          ? `≈ ${np} parcela${np > 1 ? "s" : ""} restante${np > 1 ? "s" : ""}`
          : "",
        saldo < 0 ? "neg" : "",
      )
    );
  }
  function stageStatus(pct, started, late) {
    if (late) return ["r", "Em atraso"];
    if (pct >= 1) return ["c", "Concluída"];
    if (pct > 0 || started) return ["a", "Em andamento"];
    return ["n", "Não iniciada"];
  }
  function renderPainel() {
    const wf = metWF();
    const tot = finTotal();
    const ct = dt(corte()).getTime();
    const fat = finReal(ct);
    const finPl = finPlan(ct, true);
    const fimRev = ofG(3).map(rF).filter(Boolean).sort().pop(),
      fimBL = ofG(3)
        .filter((i) => naRev(i, 0))
        .map((i) => i.fim)
        .filter(Boolean)
        .sort()
        .pop();
    const desl =
      fimRev && fimBL ? Math.round((dt(fimRev) - dt(fimBL)) / DAY) : null;
    const P = prazos();
    const spiC = (v) =>
      v == null ? "" : v >= 1 ? "good" : v < 0.9 ? "bad" : "warn";
    const k = `<div class="kpis">
    <div class="kpi"><div class="v">${fmtPct(wf.real)}</div><div class="l">Físico realizado</div></div>
    <div class="kpi"><div class="v">${fmtPct(wf.plan)}</div><div class="l">Físico planejado (baseline)</div></div>
    <div class="kpi"><div class="v ${spiC(wf.spi)}">${wf.spi == null ? "–" : wf.spi.toFixed(2).replace(".", ",")}</div><div class="l">SPI x baseline${Math.abs(wf.real0 - wf.real) > 1e-6 ? ` · escopo da R00: ${fmtPct(wf.real0)} realizado` : ""}</div></div>
    <div class="kpi"><div class="v ${spiC(wf.spiR)}">${wf.spiR == null ? "–" : wf.spiR.toFixed(2).replace(".", ",")}</div><div class="l">SPI x revisão vigente</div></div>
    ${isAq() ? `<div class="kpi"><div class="v">${tot ? fmtPct(fat / tot) : "–"}</div><div class="l">Faturado ${tot ? BRLc(fat) + " de " + BRLc(tot) : "(sem valores de marco)"}</div></div>` : (() => {
      const M = finParams().M;
      const r = recSerie(realImpl(), M);
      const a = r.length ? r[r.length - 1].acum : 0;
      if (isDoa()) return `<div class="kpi"><div class="v">–</div><div class="l">Doação: sem faturamento</div></div>`;
      return `<div class="kpi"><div class="v ${M && a >= M - 0.005 ? "good" : ""}">${M ? fmtPct(a / M) : "–"}</div><div class="l">Recorrência implantada ${M ? BRLc(a) + " de " + BRLc(M) + " (1ª parcela)" : "(sem parcela)"}</div></div>`;
    })()}
    <div class="kpi"><div class="v ${desl > 0 || (P.lim && fimRev && fimRev > P.lim) ? "bad" : ""}">${fimRev ? fmtD(fimRev) : "–"}</div><div class="l">Término planejado${desl ? ` (${desl > 0 ? "+" : ""}${desl} d x BL)` : ""}</div></div>
    <div class="kpi"><div class="v ${P.lim && P.lim < corte() && wf.real < 1 ? "bad" : ""}">${P.lim ? fmtD(P.lim) : "–"}</div><div class="l">Limite de implantação${P.lim ? " · " + restam(P.lim) : ""}</div></div>
  </div>`;
    const rg = dateRange();
    const chartBox = (id, title, note, empty, foot) =>
      `<section class="panel"><div class="panel-h"><h2>${title}</h2><span class="note">${note}</span></div>${rg ? `<div class="chart" id="${id}"></div><div id="${id}-lg"></div>` : `<div class="chart-empty">${empty}</div>`}${foot || ""}</section>`;
    const charts = `<div class="grid2">
    ${chartBox("chFis", "Curva S · Planejado x realizado (execução)", "Avanço físico ponderado do G3", "Informe as datas de baseline das atividades do G3 para traçar a curva.")}
    ${isDoa() ? `<section class="panel"><div class="chart-empty">Doação: sem faturamento.</div></section>` : chartBox("chFin", isAq() ? "Curva S · Faturamento (mês de faturamento)" : "Recorrência mensal · rumo à 1ª parcela", isAq() ? (tot ? "Valor total: " + BRL(tot) : "Informe valor e parcelamento do contrato") : finParams().M ? "1ª parcela cheia: " + BRL(finParams().M) : "Informe a parcela mensal do contrato", "Informe datas e valores dos marcos de medição do G3 para traçar a curva.", `<div class="chart-foot"><button class="btn" data-fat-new>Registrar faturamento</button><button class="btn ghost" data-fat-list>Ver lançamentos (${S.fats.length})</button></div>`)}
  </div>`;
    const role = (p) => {
      return `<div class="role"><span class="r">${esc(funcaoAtual(p.funcao) || "Contato")}</span><span class="n ${p.nome ? "" : "tbd"}">${p.nome ? esc(p.nome) : "A definir"}${ctEmail(p) ? `<span class="c">${esc(ctEmail(p))}</span>` : ""}${ctTel(p) ? `<span class="c">${esc(ctTel(p))}</span>` : ""}</span></div>`;
    };
    const stkP = `<section class="panel"><div class="panel-h"><h2>Stakeholders</h2><button class="btn ghost" data-stk="stk">Editar</button></div>
    <div class="stk"><div><h3><span class="org">DGT Tecnologia</span></h3>${contacts("dgt").map(role).join("") || `<p class="ok-msg">Nenhum contato cadastrado.</p>`}</div>
    <div><h3><span class="org">${esc(stk.cliente || "Cliente")}</span>${stk.contrato ? " · " + esc(stk.contrato) : ""}</h3>${contacts("cli").map(role).join("") || `<p class="ok-msg">Nenhum contato cadastrado.</p>`}</div>
</div></section>`;
    const przP = `<section class="panel"><div class="panel-h"><h2>Prazos do contrato</h2><button class="btn ghost" data-stk="prazos">Editar</button></div><div class="stk"><div>${przRows()}</div></div></section>`;
    const valP = `<section class="panel"><div class="panel-h"><h2>Valores do contrato</h2><button class="btn ghost" data-stk="valores">Editar</button></div><div class="stk"><div>${valRows()}</div></div></section>`;
    const gateB = (g) => {
      const G = GATES[g];
      if (!G) return "";
      const on = !!cfg.gates[G.k];
      const gd = (cfg.gateDates || {})[G.k];
      const ref = on
        ? gd
          ? `aprovado em ${fmtD(gd)}`
          : "aprovado"
        : G.k === "g35" && fimExec(true)
          ? `planejado ${fmtD(fimExec(true))}`
          : "";
      return `<button class="gatebtn" data-gate="${G.k}" aria-pressed="${on}"><i></i>${G.l}</button>${ref ? `<span class="gdate">${ref}</span>` : ""}`;
    };
    let st = "";
    [1, 2, 3, 4, 5].forEach((g) => {
      let pct,
        meta,
        chip,
        isW = g === 3,
        pl = "";
      if (isW) {
        pct = wf.real;
        chip = stageStatus(pct, pct > 0, wf.late.length > 0);
        meta = `<span>${wf.nd}/${wf.L.length} atividades</span><span>prev. ${fmtPct(wf.planR)}</span>`;
        pl = wf.L.length
          ? `<i class="pl" style="left:calc(${Math.min(1, wf.planR) * 100}% - 1px)"></i>`
          : "";
      } else {
        const m = metScrum(g);
        pct = m.pct;
        chip = stageStatus(pct, m.and, false);
        if (m.bloq.length)
          chip = [
            "r",
            m.bloq.length + " bloqueado" + (m.bloq.length > 1 ? "s" : ""),
          ];
        meta = `<span>${m.nd}/${m.n} itens · ${m.sprints.length} sprint${m.sprints.length === 1 ? "" : "s"}</span><span>${fmtPct(pct)}</span>`;
      }
      const fr =
        isW && wf.L.length
          ? `<details class="fr"><summary>Frentes de trabalho</summary><ul class="frl">${fasesWF()
              .map(
                (f) =>
                  `<li><span>${esc(f.nome.replace(/^Frente\s*/i, "F"))}</span><span class="bar w"><b style="width:${f.pct * 100}%"></b></span><span class="p">${fmtPct(f.pct)}</span></li>`,
              )
              .join("")}</ul></details>`
          : "";
      st += `<li class="stage"><div class="stage-top"><a href="#g${g}" class="nm" style="color:inherit;text-decoration:none">G${g} · ${GRUPOS[g].nome}<small>${isW ? "cascata" : "Scrum"}</small></a><span class="chip ${chip[0]}">${chip[1]}</span></div>
      <div class="bar ${isW ? "w" : ""}"><b style="width:${pct * 100}%"></b>${pl}</div><div class="stage-meta">${meta}</div><div class="stage-meta"><span>${fmtPer(grpDates(g))}</span></div>${fr}${gateB(g) ? `<div style="margin-top:6px">${gateB(g)}</div>` : ""}</li>`;
    });
    const stP = `<section class="panel"><div class="panel-h"><h2>Andamento das etapas</h2><span class="note">Traço = planejado na revisão vigente</span></div><ul class="stages">${st}</ul></section>`;
    const al = alerts(wf, tot, fat, finPl);
    // ações do projeto (acompanhamento da carteira) em aberto, junto dos pontos de atenção
    const hojeA = todayISO();
    const acA = (Array.isArray(cfg.acoes) ? cfg.acoes : [])
      .filter((a) => a && a.t && !a.ok)
      .sort((a, b) => ((a.cont ? "9" : a.d || "8") < (b.cont ? "9" : b.d || "8") ? -1 : 1));
    const acHtml = acA.length
      ? `<h3 class="alsub">Ações do projeto <small>(${acA.length} em aberto)</small></h3><ul class="alerts">${acA
          .map((a) => {
            const late = a.d && !a.cont && a.d < hojeA;
            return `<li><span class="tag ${late ? "r" : "b"}">${late ? "Ação atrasada" : "Ação"}</span><span>${esc(a.t)} — <b>${esc(a.r || "sem responsável")}</b> · ${a.cont ? "contínua" : a.d ? "prazo " + fmtD(a.d) + (late ? " (vencido)" : "") : "sem prazo"}</span></li>`;
          })
          .join("")}</ul>`
      : "";
    const alP = `<section class="panel alp"><div class="panel-h"><h2>Pontos de atenção</h2><span class="note">Data de corte ${fmtD(corte())}</span></div>${al.length ? `<ul class="alerts">${al.map((a) => `<li><span class="tag ${a[0]}">${a[1]}</span><span>${a[2]}</span></li>`).join("")}</ul>` : `<p class="ok-msg">Nenhum desvio identificado na data de corte.</p>`}${acHtml}</section>`;
    $("#view").innerHTML =
      k +
      charts +
      `<div class="grid3">${stkP}${przP}${valP}</div><div class="grid2">${stP}${alP}</div>`;
    if (rg) {
      const mk = P.lim
        ? [{ t: dt(P.lim).getTime(), l: "limite contratual" }]
        : [];
      const sf = seriesFis();
      drawChart($("#chFis"), {
        range: rg,
        series: sf,
        ymax: 1,
        marks: mk,
        label: "Curva S física",
      });
      $("#chFis-lg").innerHTML = legend(
        sf.concat(
          mk.length
            ? [
                {
                  name: "Limite de implantação (" + fmtD(prazos().lim) + ")",
                  color: C("--ink"),
                  dash: "3 2",
                  width: 1.4,
                  vert: true,
                },
              ]
            : [],
        ),
      );
      finChart($("#chFin"), $("#chFin-lg"));
    }
  }
  function alerts(wf, tot, fat, finPl) {
    const al = [];
    const c = corte();
    {
      const RG = cfg.riscoGrp || {};
      const ks = Object.keys(RG).filter((k) => RG[k] === "r" || RG[k] === "y");
      if (ks.length) {
        const W = wbs();
        const F = fasesWF();
        const nm = (f) => {
          const x = F.find((y) => y.num === f);
          return x
            ? (x.nome || "").replace(/^Frente\s*\d+\s*[·\-–]\s*/i, "")
            : "";
        };
        const lab = (k) => {
          if (k === "proj") return "Projeto";
          let m = k.match(/^f(\d+)p(\d+)$/);
          if (m) {
            const n = (W.tree.get(+m[1]) || []).find((x) => x.ponto === +m[2]);
            return `${n ? n.num : m[1]} · ${n && n.nome ? n.nome : "Ponto " + p2(+m[2])}`;
          }
          m = k.match(/^f(\d+)$/);
          return m ? `${m[1]} · ${nm(+m[1])}` : k;
        };
        ks.sort(
          (a, b) => (RG[a] === "r" ? 0 : 1) - (RG[b] === "r" ? 0 : 1),
        ).forEach((k) => {
          const o = ((cfg.obsGrp || {})[k] || "").trim();
          al.push([
            RG[k] === "r" ? "r" : "a",
            "Risco",
            `${esc(lab(k))}: risco ${RG[k] === "r" ? "alto" : "em atenção"}${o ? " · " + esc(o) : ""}.`,
          ]);
        });
      }
    }
    if (!hasRevs() && !cfg.gates.g23 && wf.L.some((i) => pctFromDates(i) > 0))
      al.push([
        "r",
        "Gate",
        "Execução com avanço registrado sem baseline congelada. O SPI perde referência formal.",
      ]);
    if (wf.spiR != null && wf.spiR < 0.9)
      al.push([
        "r",
        "Prazo",
        `SPI de ${wf.spiR.toFixed(2).replace(".", ",")} contra a revisão vigente. Avalie recuperação no caminho crítico e registre ação no G4.`,
      ]);
    else if (wf.spi != null && wf.spi < 0.9)
      al.push([
        "a",
        "Prazo",
        `SPI de ${wf.spi.toFixed(2).replace(".", ",")} contra a baseline. A revisão vigente absorve o desvio, mas ele precisa estar coberto por mudança aprovada.`,
      ]);
    const P = prazos();
    const fimRv = ofG(3).map(rF).filter(Boolean).sort().pop();
    if (P.lim && fimRv && fimRv > P.lim)
      al.push([
        "r",
        "Contrato",
        `Término planejado (${fmtD(fimRv)}) excede o limite de implantação (${fmtD(P.lim)}) em ${Math.round((dt(fimRv) - dt(P.lim)) / DAY)} dias. Avalie aditivo de prazo ou plano de recuperação.`,
      ]);
    if (P.lim && P.lim < c && wf.real < 1)
      al.push([
        "r",
        "Contrato",
        `Prazo de implantação vencido em ${fmtD(P.lim)} com ${fmtPct(wf.real)} de físico realizado.`,
      ]);
    if (P.vig && P.lim && P.vig < P.lim)
      al.push([
        "a",
        "Contrato",
        `A vigência (${fmtD(P.vig)}) termina antes do limite de implantação (${fmtD(P.lim)}).`,
      ]);
    if (P.vig && P.vig >= c && (dt(P.vig) - dt(c)) / DAY <= 90)
      al.push([
        "a",
        "Vigência",
        `Vigência contratual termina em ${fmtD(P.vig)} (${restam(P.vig)}). Avalie a necessidade de prorrogação.`,
      ]);
    if (!stk.oi || !stk.prazoImpl)
      al.push([
        "b",
        "Contrato",
        "Ordem de início ou prazo de implantação não informados.",
      ]);
    if (stk.atrasoAdm || admAberto(stk))
      al.push([
        "a",
        "Administrativo",
        `Atraso administrativo${admHist(stk).filter((x) => !x.fim).map((x) => x.mot).filter(Boolean).length ? ": " + esc(admHist(stk).filter((x) => !x.fim).map((x) => x.mot).filter(Boolean).join(" · ")) : ""}${admTxt(stk) ? " · " + esc(admTxt(stk)) : ""}.`,
      ]);
    const ni = wf.L.filter(
      (i) => rI(i) && rI(i) < c && !i.inicioReal && !(rF(i) && rF(i) < c),
    );
    if (ni.length)
      al.push([
        "a",
        "Início",
        `${ni.length} atividade${ni.length > 1 ? "s" : ""} com início planejado vencido e sem início realizado: ${ni
          .slice(0, 4)
          .map((i) => esc(idG3(i)))
          .join(", ")}${ni.length > 4 ? "…" : ""}.`,
      ]);
    // atrasos agrupados por pacote: o ponto (pontos), o grupo ou o pacote de trabalho da etapa
    const Wl = wbs();
    const pac = new Map();
    wf.late.forEach((i) => {
      const f = +i.faseNum || 0;
      let k, nome, todos, num;
      if (i.ponto) {
        const n = (Wl.tree.get(f) || []).find((x) => x.ponto === +i.pacoteNum);
        k = "p" + f + ":" + i.pacoteNum;
        num = n ? n.num : "";
        nome = (i.pacoteNome || "Ponto " + p2(+i.pacoteNum)) + (i.bloco ? " · " + i.bloco : "");
        todos = n ? n.items : [i];
      } else if (i.bloco) {
        const n = (Wl.top.get(f) || []).find((x) => x.bloco === i.bloco);
        k = "b" + f + ":" + i.bloco;
        num = n ? n.num : "";
        nome = i.bloco;
        todos = n ? n.items : [i];
      } else {
        k = "a" + f + ":" + i.pacoteNum;
        num = String(f);
        nome = i.pacoteNome || "Pacote " + p2(+i.pacoteNum);
        todos = wf.L.filter((x) => +x.faseNum === f && !x.ponto && !x.bloco && +x.pacoteNum === +i.pacoteNum);
      }
      if (!pac.has(k)) pac.set(k, { num, nome, todos, late: [] });
      pac.get(k).late.push(i);
    });
    pac.forEach((g) => {
      const fim = g.late.map(rF).filter(Boolean).sort();
      const pct = Math.round(rollPct(g.todos) * 1000) / 10;
      const um = g.late.length === 1;
      al.push([
        "r",
        "Atraso",
        `${esc(g.num)} ${esc(g.nome)}: ${um ? esc(g.late[0].titulo) + " atrasada" : g.late.length + " de " + g.todos.length + " atividades atrasadas"}, término planejado ${um ? "em " + fmtD(fim[0]) : "até " + fmtD(fim[fim.length - 1])}, pacote com ${String(pct).replace(".", ",")}% realizado.`,
      ]);
    });
    if (metaMode()) {
      const P0 = prazos();
      const tadR = tadDate(true);
      const ff = firstFull(true);
      const hoje = todayISO();
      if (tadR && P0.lim && tadR > P0.lim)
        al.push([
          "r",
          "T.A.D.",
          `T.A.D. planejado em ${fmtD(tadR)}, após o fim do prazo de implantação (${fmtD(P0.lim)}). Folga de ${Math.round((dt(P0.lim) - dt(tadR)) / DAY)} dias.`,
        ]);

      const RV = sched(true),
        RA = realAlloc();
      // mês encerrado: o que ficou abaixo do previsto não é mais faturável (não faturado);
      // só o mês de faturamento vigente ainda tem valor a faturar
      const comps = [...new Set(RV.map((e) => e.comp))].sort();
      const mvA = ymOf(corte());
      const perdas = [];
      const ATc = atrasoFat(
        comps.filter((c) => ymAdd(c, 1) <= mvA),
        (c) => RA.filter((e) => e.comp === c).reduce((s, e) => s + e.v, 0) - RV.filter((e) => e.comp === c).reduce((s, e) => s + e.v, 0),
      );
      const atrasos = [];
      comps.forEach((c) => {
        const tc = ATc.tarde.get(c);
        if (tc) tc.forEach((x) => atrasos.push([c, x[0], x[1]]));
        const pv = RV.filter((e) => e.comp === c).reduce((s, e) => s + e.v, 0),
          fv = RA.filter((e) => e.comp === c).reduce((s, e) => s + e.v, 0);
        const falta = pv - fv - somaAt(tc);
        if (falta <= 0.005) return;
        const bm = ymAdd(c, 1);
        const emitido = RA.some((e) => e.comp === c);
        if (bm < mvA || (bm === mvA && emitido)) perdas.push([c, falta]);
        else if (bm === mvA && nfDate(c) < hoje)
          al.push([
            "r",
            "A faturar",
            `Competência ${ymLbl(c)}: ${BRL(falta)} a faturar no mês vigente; o prazo da NF venceu em ${fmtD(nfDate(c))}.`,
          ]);
      });
      if (atrasos.length)
        al.push([
          "a",
          "Faturado com atraso",
          `${BRL(atrasos.reduce((s, x) => s + x[2], 0))} faturados depois do mês previsto (${atrasos.map((x) => `comp. ${ymLbl(x[0])} faturada na comp. ${ymLbl(x[1])}: ${BRL(x[2])}, ${mesesAt(x[0], x[1])} ${mesesAt(x[0], x[1]) === 1 ? "mês" : "meses"} de atraso`).join("; ")}). O financeiro está atrasado em relação ao previsto, mesmo que o total do período feche.`,
        ]);
      if (perdas.length)
        al.push([
          "a",
          "Não faturado",
          `${BRL(perdas.reduce((s, x) => s + x[1], 0))} previstos e não faturados (${perdas.map((x) => `${ymLbl(x[0])}: ${BRL(x[1])}`).join("; ")}). Esse valor não é mais faturável: revise o previsto ou registre a justificativa.`,
        ]);
      boletins()
        .filter((b) => b.situacao === "liberacao")
        .forEach((b) =>
          al.push([
            "a",
            "Boletim",
            `Boletim da competência ${ymLbl(b.comp)}${b.compFim !== b.comp ? " a " + ymLbl(b.compFim) : ""} em liberação desde ${fmtD(b.envio)} (${BRL(b.valor)}).`,
          ]),
        );
    } else if (tot && wf.real - fat / tot > 0.1)
      al.push([
        "a",
        "Faturamento",
        `Físico realizado (${fmtPct(wf.real)}) acima do faturado (${fmtPct(fat / tot)}). Verifique medições pendentes de emissão.`,
      ]);
    if (tot && finPl - fat > 0.005 * tot)
      al.push([
        "a",
        "Faturamento",
        `Faturado ${BRLc(fat)} abaixo do planejado na revisão vigente para a data (${BRLc(finPl)}).`,
      ]);
    if (wf.P > 0 && Math.abs(wf.P - 100) > 0.01)
      al.push([
        "a",
        "Pesos",
        `Os pesos físicos do G3 somam ${fmtN(wf.P)}%. Ajuste para 100% para fechar a curva S.`,
      ]);
    const semData = wf.L.filter((i) => !i.inicio || !i.fim).length;
    if (semData)
      al.push([
        "a",
        "Baseline",
        `${semData} de ${wf.L.length} atividades do G3 sem datas de baseline. A curva S planejada fica incompleta.`,
      ]);

    [1, 2, 4, 5].forEach((g) =>
      metScrum(g).bloq.forEach((i) =>
        al.push([
          "b",
          "Bloqueio",
          `${esc(i.codigo)} ${esc(i.titulo)}${i.dep ? " (depende de " + esc(i.dep) + ")" : ""}.`,
        ]),
      ),
    );
    const falt = contacts("dgt")
      .concat(contacts("cli"))
      .filter((c) => c.funcao && !c.nome)
      .map((c) => c.funcao);
    if (falt.length)
      al.push([
        "b",
        "Stakeholders",
        "Sem responsável definido: " + falt.join(", ") + ".",
      ]);
    return al;
  }

  /* ---------- Físico x financeiro ---------- */
  const itensC = () =>
    Array.isArray(stk.itensContrato) ? stk.itensContrato : [];
  const itTot = (i) => Math.round((+i.qtd || 0) * (+i.vu || 0) * 100) / 100;
  const fmtQ = (v) =>
    (+v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  function parseQ(t) {
    t = String(t || "").trim();
    if (!t) return "";
    const n = +t.replace(/\./g, "").replace(",", ".");
    return isNaN(n) ? "" : n;
  }
  function itensPanel() {
    const L = itensC();
    const tot = L.reduce((s, i) => s + itTot(i), 0);
    const P = prazos();
    const dif = P.parcela ? Math.round((tot - P.parcela) * 100) / 100 : null;
    const rec =
      L.length && P.parcela
        ? Math.abs(dif) < 0.01
          ? `<span class="stt s-c"><i></i>${isAq() ? "Confere com o valor do contrato" : "Confere com a parcela mensal"}</span>`
          : `<span class="stt s-r"><i></i>Diferença de ${BRL(dif)} para a parcela (${BRL(P.parcela)})</span>`
        : "";
    return `<section class="panel"><div class="panel-h"><h2>Itens do contrato faturados</h2><span style="display:flex;gap:10px;align-items:center">${rec}<button class="btn" data-itens>Editar itens</button></span></div>
  ${
    L.length
      ? `<div class="tw"><table class="crono ftb"><colgroup><col style="width:64px"><col style="width:96px"><col><col style="width:96px"><col style="width:60px"><col style="width:140px"><col style="width:150px"><col style="width:96px"></colgroup>
  <thead><tr><th>Item</th><th>Código</th><th>Descrição</th><th style="text-align:right">Qtd/mês</th><th>Un</th><th style="text-align:right">Valor unitário</th><th style="text-align:right">Total mensal</th><th style="text-align:right">% parcela</th></tr></thead><tbody>
  ${L.map((i) => `<tr class="child"><td class="dts">${esc(i.item)}</td><td class="dts">${esc(i.codigo)}</td><td>${esc(i.descricao)}</td><td class="dts" style="text-align:right">${fmtQ(i.qtd)}</td><td>${esc(i.un || "UN")}</td><td class="dts" style="text-align:right">${BRL(i.vu)}</td><td class="dts" style="text-align:right"><b>${BRL(itTot(i))}</b></td><td class="dts" style="text-align:right">${tot ? fmtPct(itTot(i) / tot) : "–"}</td></tr>`).join("")}
  <tr class="parent"><td colspan="6">${isAq() ? "Total (parcela única)" : "Total mensal (1ª parcela cheia)"}</td><td class="dts" style="text-align:right">${BRL(tot)}</td><td class="dts" style="text-align:right">100%</td></tr></tbody></table></div>`
      : `<p class="ok-msg">Nenhum item cadastrado. Use “Editar itens” para incluir os itens faturados do contrato.</p>`
  }</section>`;
  }
  function openItens() {
    const row = (i, k) =>
      `<div class="itr" data-id="${esc(i.id || (k != null ? itId(i, k) : ""))}"><input data-k="item" value="${esc(i.item || "")}" placeholder="Item" aria-label="Item"><input data-k="codigo" value="${esc(i.codigo || "")}" placeholder="Código" aria-label="Código"><input data-k="descricao" value="${esc(i.descricao || "")}" placeholder="Descrição" aria-label="Descrição"><input data-k="qtd" inputmode="decimal" value="${i.qtd === "" || i.qtd == null ? "" : fmtQ(i.qtd)}" placeholder="Qtd/mês" aria-label="Quantidade por mês"><input data-k="un" value="${esc(i.un || "UN")}" aria-label="Unidade"><input data-k="vu" class="money" inputmode="numeric" value="${fmtMoney(i.vu)}" placeholder="0,00" aria-label="Valor unitário"><select data-k="med" aria-label="Medição do item" title="Por ponto: entra no faturamento conforme cada ponto é ativado. No T.A.D.: item central, faturado só a partir do T.A.D."><option value="">Por ponto</option><option value="tad" ${i.med === "tad" ? "selected" : ""}>No T.A.D.</option></select><span class="itt">–</span><button type="button" class="ico rm" data-rmit title="Remover item" aria-label="Remover item"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
    const form = $("#formItens");
    form.innerHTML = `<h3>Itens do contrato faturados</h3>
  <div class="ith"><span>Item</span><span>Código</span><span>Descrição</span><span>Qtd/mês</span><span>Un</span><span>Valor unitário</span><span>Medição</span><span>Total mensal</span><span></span></div>
  <div class="itlist">${itensC().map(row).join("")}</div>
  <button type="button" class="btn ghost addc" data-addit>+ Adicionar item</button>
  <div class="ittot"><span>Total mensal</span><b id="itSum">–</b><span id="itRec" class="sl"></span></div>
  <div class="actions"><button type="button" class="btn" id="itCancel">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>`;
    const read = () =>
      [...form.querySelectorAll(".itr")].map((r) => {
        const o = {};
        r.querySelectorAll("[data-k]").forEach(
          (x) => (o[x.dataset.k] = x.value.trim()),
        );
        o.qtd = parseQ(o.qtd);
        o.vu = parseMoney(o.vu);
        // id fixo do item: a medição por ponto fica ligada a ele
        o.id = r.dataset.id || uid("it");
        r.dataset.id = o.id;
        if (!o.med) delete o.med;
        return o;
      });
    const upd = () => {
      const L = read();
      form
        .querySelectorAll(".itr")
        .forEach(
          (r, k) => (r.querySelector(".itt").textContent = BRL(itTot(L[k]))),
        );
      const t = L.reduce((s, i) => s + itTot(i), 0);
      $("#itSum").textContent = BRL(t);
      const P = prazos();
      $("#itRec").textContent = P.parcela
        ? Math.abs(t - P.parcela) < 0.01
          ? "confere com a parcela mensal"
          : `parcela mensal: ${BRL(P.parcela)} · diferença ${BRL(t - P.parcela)}`
        : "";
    };
    form.oninput = () => setTimeout(upd, 0);
    upd();
    form.onclick = (e) => {
      if (e.target.closest("[data-addit]")) {
        form
          .querySelector(".itlist")
          .insertAdjacentHTML("beforeend", row({ un: "UN" }));
        form
          .querySelector(".itlist")
          .lastElementChild.querySelector("input")
          .focus();
        upd();
        return;
      }
      const rm = e.target.closest("[data-rmit]");
      if (rm) {
        rm.closest(".itr").remove();
        upd();
      }
    };
    $("#itCancel").onclick = () => $("#dlgItens").close();
    form.onsubmit = (e) => {
      e.preventDefault();
      stk = Object.assign({}, stk, {
        itensContrato: read().filter((i) => i.descricao || i.codigo || i.vu),
      });
      $("#dlgItens").close();
      saveStk();
    };
    $("#dlgItens").showModal();
  }

  /* aumento de recorrência mês a mês: previsto (R00 e revisão) x realizado */
  function recPanel(R0, RV, RA, M, mv) {
    if (!M) return "";
    const s0 = recSerie(R0, M),
      sv = recSerie(RV, M),
      sr = recSerie(RA, M);
    const bms = [...new Set([...s0, ...sv, ...sr].filter((e) => e.aum > 0.005).map((e) => e.bill))].sort();
    const head = `<section class="panel"><div class="panel-h"><h2>Aumento de recorrência</h2><span class="note">1ª parcela cheia: ${BRL(M)} · o que o faturamento mensal sobe a cada competência até chegar nela</span></div>`;
    if (!bms.length) return head + `<p class="ok-msg">Sem faturamento previsto ou realizado.</p></section>`;
    const at = (S, bm) => S.find((e) => e.bill === bm);
    const v = (x) => (x && x.aum > 0.005 ? `+${BRL(x.aum)}` : '<span class="mut">–</span>');
    const ac = (S, bm) => {
      const L = S.filter((e) => e.bill <= bm);
      return L.length ? L[L.length - 1].acum : 0;
    };
    const t = (S) => S.reduce((a, e) => a + e.aum, 0);
    const rows = bms
      .map((bm) => {
        const r = at(sr, bm);
        const fut = bm > mv;
        const aR = ac(sr, bm);
        return `<tr class="child ${bm === mv ? "cur" : ""}"><td class="dts">${ymLbl(bm)}${bm === mv ? ' <span class="mut">· vigente</span>' : ""}</td><td class="dts">${ymLbl(ymAdd(bm, -1))}</td><td class="dts" style="text-align:right">${v(at(s0, bm))}</td><td class="dts" style="text-align:right">${v(at(sv, bm))}</td><td class="dts" style="text-align:right;color:var(--ok)">${fut && !r ? '<span class="mut">–</span>' : v(r)}</td><td class="dts" style="text-align:right">${fut && !r ? '<span class="mut">–</span>' : `${BRL(aR)} <span class="sub">${fmtPct(aR / M)}</span>`}</td></tr>`;
      })
      .join("");
    return (
      head +
      `<div class="tw"><table class="crono ftb"><colgroup><col style="width:130px"><col style="width:110px"><col><col><col><col></colgroup><thead><tr><th title="Mês em que a competência é liberada">Mês de liberação</th><th>Competência</th><th style="text-align:right">Previsto R00</th><th style="text-align:right">${selRevN() ? "Previsto " + revName(selRevN()) : "Previsto revisão (–)"}</th><th style="text-align:right">Realizado</th><th style="text-align:right">Recorrência implantada</th></tr></thead><tbody>${rows}
      <tr class="parent"><td colspan="2">Total</td><td class="dts" style="text-align:right">${BRL(t(s0))}</td><td class="dts" style="text-align:right">${BRL(t(sv))}</td><td class="dts" style="text-align:right">${BRL(t(sr))}</td><td class="dts" style="text-align:right">${fmtPct(t(sr) / M)} da 1ª parcela</td></tr></tbody></table></div>
      <p class="hint" style="margin-top:8px">Aumento = quanto o valor mensal faturado sobe em relação à competência anterior (ex.: 50 mil na competência dez, liberada em jan, e 80 mil na de jan → +50 mil em jan e +30 mil em fev). Teto: a 1ª parcela cheia. Quedas por glosa ou mês sem boletim não reduzem a recorrência já implantada. Nas revisões, as competências anteriores ao mês da revisão ficam congeladas.</p></section>`
    );
  }
  /* faturamento por ponto: valor mensal medido pelos itens do contrato e mês de entrada */
  function ptFatPanel() {
    const { P, central, semItens } = ptValores();
    if (!P.length) return "";
    const n = selRevN();
    const M = finParams().M;
    const totP = P.reduce((s, p) => s + p.v, 0);
    const tadR = tadAt(n);
    const rows = P.map((p) => {
      const a = ptAtiv(p, n),
        r = ptAtivReal(p);
      const d0 = r || a;
      // pro rata na competência da ativação; nos últimos 7 dias do mês, só a partir da seguinte
      const c = d0 ? (+d0.slice(8, 10) > ymDim(ymOf(d0)) - 7 ? ymAdd(ymOf(d0), 1) : ymOf(d0)) : "";
      const depois = c && tadR && c > ymOf(tadR);
      return `<tr class="child"><td>${esc(p.nome)}${p.blk ? ` <span class="sub">${esc(p.blk)}</span>` : ""}</td><td class="dts">${a ? fmtD(a) : '<span class="mut">sem data</span>'}</td><td class="dts">${r ? fmtD(r) : '<span class="mut">–</span>'}</td><td class="dts">${c ? ymLbl(c) + (depois ? ' <span class="sub">já no T.A.D.</span>' : "") : '<span class="mut">–</span>'}</td><td class="dts" style="text-align:right">${BRL(p.v)}</td></tr>`;
    }).join("");
    const conf =
      Math.abs(totP + central - M) < 0.01
        ? `<span class="stt s-c"><i></i>Pontos + T.A.D. conferem com a parcela</span>`
        : `<span class="stt s-r"><i></i>Pontos + T.A.D. = ${BRL(totP + central)} · parcela ${BRL(M)}</span>`;
    return `<section class="panel"><div class="panel-h"><h2>Faturamento por ponto</h2><span style="display:flex;gap:10px;align-items:center">${semItens ? "" : conf}<button class="btn" data-medpt>Medir itens por ponto</button></span></div>
    <div class="tw" style="max-height:420px;overflow:auto"><table class="crono ftb"><colgroup><col><col style="width:130px"><col style="width:120px"><col style="width:150px"><col style="width:140px"></colgroup><thead><tr><th>Ponto</th><th>Ativação planejada${n ? " (" + revName(n) + ")" : ""}</th><th>Ativação real</th><th>Fatura a partir de</th><th style="text-align:right">Valor mensal</th></tr></thead><tbody>${rows}
    <tr class="parent"><td colspan="4">Total dos pontos${central ? ` · itens faturados só no T.A.D.: ${BRL(central)}` : ""}</td><td class="dts" style="text-align:right">${BRL(totP)}</td></tr></tbody></table></div>
    <p class="hint" style="margin-top:8px">${semItens ? "Sem itens do contrato cadastrados: a parcela é dividida igualmente entre os pontos. " : ""}Cada ponto passa a ser faturado na competência em que é ativado (término da última atividade do ponto), proporcional aos dias restantes do mês; ativado nos últimos 7 dias do mês, entra na competência seguinte. Itens marcados “no T.A.D.” (central, plataforma) entram só na competência do T.A.D. Item sem medição no ponto: o saldo da quantidade do contrato é dividido igualmente entre os pontos não medidos.</p></section>`;
  }
  /* medição dos itens do contrato ponto a ponto (quantidade de cada item em cada ponto) */
  function openMedPonto() {
    const { P, I } = ptValores();
    const IP = I.filter((it) => it.med !== "tad");
    if (!IP.length) {
      toast("Cadastre os itens do contrato (Editar itens) e marque quais são medidos por ponto.");
      return;
    }
    const med = stk.medPonto || {};
    const form = $("#formItens");
    const th = IP.map((it) => `<th title="${esc(it.descricao)} · ${fmtQ(it.qtd)} no contrato · ${BRL(it.vu)}">${esc(it.item ? it.item + " · " : "")}${esc(it.descricao || it.codigo || "Item")}<small>${fmtQ(it.qtd)} · ${BRL(it.vu)}</small></th>`).join("");
    const rows = P.map(
      (p) =>
        `<tr data-pk="${esc(p.k)}"><td class="mpn">${esc(p.nome)}${p.blk ? `<small>${esc(p.blk)}</small>` : ""}</td>${IP.map((it) => {
          const m = (med[p.k] || {})[it.id];
          return `<td><input data-it="${esc(it.id)}" inputmode="decimal" value="${medDef(m) ? fmtQ(m) : ""}" aria-label="${esc(it.descricao)} no ${esc(p.nome)}"></td>`;
        }).join("")}<td class="mpv">–</td></tr>`,
    ).join("");
    form.innerHTML = `<h3>Medição dos itens por ponto</h3>
    <p class="hint">Informe a quantidade de cada item instalada em cada ponto. Em branco, o ponto recebe a parte igual do saldo do item (mostrada em cinza).</p>
    <div class="mpscroll"><table class="mptb"><thead><tr><th class="mpn">Ponto</th>${th}<th class="mpv">Valor mensal</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td class="mpn">Medido / contrato</td>${IP.map((it) => `<td data-ft="${esc(it.id)}">–</td>`).join("")}<td class="mpv" id="mpTot">–</td></tr></tfoot></table></div>
    <div class="actions"><button type="button" class="btn ghost" id="mpLimpar" title="Apaga a medição: todos os itens voltam à divisão igual">Limpar medição</button><span class="sp"></span><button type="button" class="btn" id="mpCancel">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>`;
    const ler = () => {
      const o = {};
      form.querySelectorAll("tr[data-pk]").forEach((tr) => {
        const x = {};
        tr.querySelectorAll("input[data-it]").forEach((inp) => {
          const v = parseQ(inp.value);
          if (v !== "") x[inp.dataset.it] = v;
        });
        if (Object.keys(x).length) o[tr.dataset.pk] = x;
      });
      return o;
    };
    const upd = () => {
      const sv = stk.medPonto;
      stk.medPonto = ler();
      const R = ptValores();
      stk.medPonto = sv;
      let tot = 0;
      R.P.forEach((p) => {
        const tr = form.querySelector(`tr[data-pk="${CSS.escape(p.k)}"]`);
        if (!tr) return;
        tr.querySelectorAll("input[data-it]").forEach((inp) => {
          const q = p.q[inp.dataset.it];
          inp.placeholder = q && q.auto ? fmtQ(Math.round(q.q * 100) / 100) : "";
        });
        tr.querySelector(".mpv").textContent = BRL(p.v);
        tot += p.v;
      });
      IP.forEach((it) => {
        const s = R.P.reduce((a, p) => a + ((p.q[it.id] && !p.q[it.id].auto && p.q[it.id].q) || 0), 0);
        const c = form.querySelector(`[data-ft="${CSS.escape(it.id)}"]`);
        c.textContent = `${fmtQ(s)} / ${fmtQ(it.qtd)}`;
        c.className = s > (+it.qtd || 0) + 1e-9 ? "over" : "";
      });
      $("#mpTot").textContent = BRL(tot);
    };
    form.oninput = () => setTimeout(upd, 0);
    form.onclick = null;
    $("#mpCancel").onclick = () => $("#dlgItens").close();
    $("#mpLimpar").onclick = () => {
      form.querySelectorAll("input[data-it]").forEach((i) => (i.value = ""));
      upd();
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      stk = Object.assign({}, stk, { medPonto: ler() });
      $("#dlgItens").close();
      saveStk();
    };
    upd();
    $("#dlgItens").showModal();
  }
  function renderFxF() {
    if (isDoa()) {
      $("#view").innerHTML = `<section class="panel"><p class="ok-msg">Doação: o projeto não tem contrato assinado, valor nem faturamento.</p></section>`;
      return;
    }
    const P = prazos();
    const { M, n, total } = finParams();
    const hoje = todayISO();
    const mv = ymOf(corte());
    const tmv = ymStart(mv);
    const R0 = sched(false),
      RV = sched(true),
      RA = realImpl(),
      B = boletins();
    const sum = (E, f) => E.filter(f).reduce((s, e) => s + e.v, 0);
    const realTot = isAq() ? B.reduce((s, b) => s + (+b.valor || 0), 0) : sum(RA, () => true);
    const lastBill = RA.length
      ? RA.map((e) => e.bill)
          .sort()
          .pop()
      : mv;
    const refD = lastBill < mv ? lastBill : mv;
    const planAc = sum(R0, (e) => e.bill <= refD);
    const desv = realTot - planAc;
    const prevMes = sum(RV, (e) => e.bill === mv),
      fatMes = sum(RA, (e) => e.bill === mv);
    // com boletim emitido no mês (mesmo em liberação), não há mais o que faturar nele
    const aFat = RA.some((e) => e.bill === mv) ? 0 : Math.max(0, prevMes - fatMes);
    const tad0 = tadDate(false),
      tadR = tadDate(true);
    const folga =
      P.lim && tadR ? Math.round((dt(P.lim) - dt(tadR)) / DAY) : null;
    const ff = firstFull(true);
    const nfMv = nfDate(ymAdd(mv, -1));
    const aFatVenc = aFat > 0 && nfMv < hoje;
    const kp = (v, l, c) =>
      `<div class="kpi"><div class="v ${c || ""}">${v}</div><div class="l">${l}</div></div>`;
    // locação: tudo medido pela recorrência (até a 1ª parcela cheia), sem visão do contrato
    const recR = !isAq() && M ? recSerie(RA, M) : [];
    const recAc = (S, bm) => {
      const L = S.filter((e) => e.bill <= bm);
      return L.length ? L[L.length - 1].acum : 0;
    };
    const impl = recR.length ? recR[recR.length - 1].acum : 0;
    const dRec = impl - recAc(recSerie(R0, M), mv);
    const k = (isAq()
      ? `<div class="kpis">
    ${kp(total ? BRL(total) : "–", "Valor total · aquisição, parcela única")}
    ${kp(BRL(realTot), `Realizado · ${total ? fmtPct(realTot / total) : "–"} do total`)}
    ${kp((desv >= 0 ? "+" : "") + BRL(desv), `Desvio x R00 até ${ymLbl(refD)}`, desv < -0.005 ? "bad" : desv > 0.005 ? "good" : "")}
    ${kp(ff ? BRL(ff.v) : "–", "Parcela única" + (ff ? ` · comp. ${ymLbl(ff.comp)} · NF até ${fmtD(nfDate(ff.comp))}` : ""))}`
      : `<div class="kpis">
    ${kp(M ? BRL(M) : "–", ff ? `1ª parcela cheia · comp. ${ymLbl(ff.comp)}, liberada em ${ymLbl(ff.bill)}` : "1ª parcela cheia")}
    ${kp(BRL(impl), `Recorrência implantada · ${M ? fmtPct(impl / M) : "–"} da 1ª parcela`, M && impl >= M - 0.005 ? "good" : "")}
    ${kp((dRec >= 0 ? "+" : "") + BRL(dRec), `Recorrência x R00 em ${ymLbl(mv)}`, dRec < -0.005 ? "bad" : dRec > 0.005 ? "good" : "")}
    ${kp(M ? BRL(Math.max(0, M - impl)) : "–", "Falta implantar até a 1ª parcela", M && M - impl > 0.005 ? "warn" : "")}`
    ) + `
    ${kp(folga == null ? "–" : (folga >= 0 ? "+" : "") + folga + " d", tadR ? `Folga de implantação · T.A.D. ${fmtD(tadR)}` : "Folga de implantação", folga != null && folga < 0 ? "bad" : "")}
    ${aFat > 0.005 ? kp(BRL(aFat), aFatVenc ? `A faturar em ${ymLbl(mv)} · NF vencida` : `A faturar em ${ymLbl(mv)}`, aFatVenc ? "bad" : "") : ""}
  </div>`;
    const chart = (isAq() ? "" : recPanel(R0, RV, RA, M, mv)) + `<section class="panel"><div class="panel-h"><h2>${isAq() ? "Curva S · Faturamento acumulado" : "Recorrência mensal · rumo à 1ª parcela"}</h2></div><div class="chart" id="chFin2"></div><div id="chFin2-lg"></div></section>` + (isAq() ? "" : ptFatPanel());
    // tabela mensal
    const r = finRange();
    let mt = `<section class="panel"><div class="panel-h"><h2>Acompanhamento mensal</h2><span class="note">Mês vigente: ${ymLbl(mv)}</span></div>`;
    if (r) {
      let difTot = 0,
        atrTot = 0;
      const AT = atrasoFat(
        r.months.filter((bm) => bm <= mv),
        (bm) => sum(RA, (e) => e.comp === ymAdd(bm, -1)) - sum(RV, (e) => e.bill === bm),
      );
      const rows = r.months
        .map((bm) => {
          const comp = ymAdd(bm, -1);
          const p0 = sum(R0, (e) => e.bill === bm),
            pv = sum(RV, (e) => e.bill === bm);
          const bs = B.filter((b) => comp >= b.comp && comp <= b.compFim);
          const fv = isAq()
            ? B.filter((b) => b.comp === comp).reduce((s, b) => s + (+b.valor || 0), 0)
            : sum(RA, (e) => e.comp === comp);
          const cov = bs.length && !B.some((b) => b.comp === comp);
          const lib = bs.length && bs.every((b) => b.situacao === "liberado");
          const st = !bs.length
            ? ["n", "Pendente"]
            : lib
              ? ["c", "Realizado"]
              : ["o", "Em liberação"];
          const nf = nfDate(comp),
            rc = recDate(nf);
          // diferença realizado x previsto: no mês vigente o que falta ainda é "a faturar";
          // em mês encerrado, o que faltou é "não faturado" (não pode mais ser faturado)
          const dif = bm <= mv ? sum(RA, (e) => e.comp === comp) - pv : 0;
          difTot += dif;
          // com boletim emitido (mesmo em liberação), o que faltou não será mais faturado
          const aberto = bm === mv && !bs.length;
          // faltou e foi faturado depois / faturou a mais compensando atraso anterior: atraso, não "acima do previsto"
          const tr = AT.tarde.get(bm),
            rcA = AT.rec.get(bm),
            vT = somaAt(tr),
            vR = somaAt(rcA);
          atrTot += vR;
          const nMA = rcA ? Math.max(...rcA.map((x) => mesesAt(x[0], bm))) : 0;
          const difTxt =
            bm <= mv && dif < -0.005 && vT > 0.005
              ? `<span style="color:var(--mk)">−${BRL(-dif)}</span><span class="sub">faturado com atraso em ${listaAt(tr, ymLbl)}${-dif - vT > 0.005 ? ` · <span style="color:var(--alert)">${BRL(-dif - vT)} não faturado</span>` : ""}</span>`
              : bm <= mv && dif > 0.005 && vR > 0.005
                ? `<span style="color:var(--mk)">+${BRL(dif)}</span><span class="sub">atraso de ${listaAt(rcA, ymLbl)} (${nMA} ${nMA === 1 ? "mês" : "meses"})${dif - vR > 0.005 ? ` · +${BRL(dif - vR)} acima do previsto` : ""}</span>`
                : bm > mv || Math.abs(dif) <= 0.005
              ? '<span class="mut">–</span>'
              : dif > 0
                ? `<span style="color:var(--ok)">+${BRL(dif)}</span><span class="sub">acima do previsto</span>`
                : aberto
                  ? `<span style="color:${nf < hoje ? "var(--alert)" : "inherit"}">${BRL(-dif)}</span><span class="sub">a faturar${nf < hoje ? " · NF vencida" : ""}</span>`
                  : `<span style="color:var(--alert)">−${BRL(-dif)}</span><span class="sub">não faturado</span>`;
          const tipo = R0.find((e) => e.comp === comp);
          return `<tr class="child ${bm === mv ? "cur" : ""}"><td class="dts">${ymLbl(bm)}${bm === mv ? ' <span class="mut">· vigente</span>' : ""}</td><td class="dts">${ymLbl(comp)}${tipo ? `<span class="sub">${{ prorata: "T.A.D. pro rata", parcial: "pontos ativos", realizado: "faturado (congelado)", cheia: "cheia", complemento: "saldo do contrato", unica: "parcela única" }[tipo.tipo]}</span>` : ""}</td><td class="dts" style="text-align:right">${p0 ? BRL(p0) : '<span class="mut">–</span>'}</td><td class="dts" style="text-align:right">${pv ? BRL(pv) : '<span class="mut">–</span>'}</td><td class="dts" style="text-align:right">${fv ? BRL(fv) : cov ? '<span class="mut">coberto</span>' : '<span class="mut">–</span>'}</td><td><span class="stt s-${st[0]}"><i></i>${st[1]}</span></td><td class="dts">${fmtD(nf)}</td><td class="dts">${fmtD(rc)}</td><td class="dts" style="text-align:right">${difTxt}</td></tr>`;
        })
        .join("");
      const t0 = R0.reduce((s, e) => s + e.v, 0),
        tv = RV.reduce((s, e) => s + e.v, 0);
      mt += `<div class="tw"><table class="crono ftb"><colgroup><col style="width:120px"><col style="width:110px"><col><col><col><col style="width:130px"><col style="width:90px"><col style="width:100px"><col></colgroup><thead><tr><th>Mês faturamento</th><th>Competência</th><th style="text-align:right">Planejado R00</th><th style="text-align:right">${selRevN() ? "Revisão " + revName(selRevN()) : "Revisão (–)"}</th><th style="text-align:right">Realizado</th><th>Situação</th><th>NF até</th><th>Recebimento</th><th style="text-align:right" title="Realizado menos o previsto. No mês vigente, o que falta ainda pode ser faturado; em mês encerrado, o que faltou não é mais faturável.">Diferença</th></tr></thead><tbody>${rows}<tr class="parent"><td colspan="2">Total</td><td class="dts" style="text-align:right">${BRL(t0)}</td><td class="dts" style="text-align:right">${BRL(tv)}</td><td class="dts" style="text-align:right">${BRL(realTot)}</td><td colspan="3"></td><td class="dts" style="text-align:right" title="Soma das diferenças até o mês vigente">${Math.abs(difTot) <= 0.005 ? '<span class="mut">–</span>' : `<span style="color:${difTot < 0 ? "var(--alert)" : "var(--ok)"}">${difTot < 0 ? "−" : "+"}${BRL(Math.abs(difTot))}</span>`}${atrTot > 0.005 ? `<span class="sub" style="color:var(--mk)">${BRL(atrTot)} faturado com atraso</span>` : ""}</td></tr></tbody></table></div>`;
    } else
      mt += `<p class="ok-msg">Informe valor, parcelamento e datas da execução.</p>`;
    mt += `</section>`;
    const bt = `<section class="panel"><div class="panel-h"><h2>Boletins de medição</h2><button class="btn" data-fat-new>Novo boletim</button></div>
  ${
    B.length
      ? `<div class="tw"><table class="crono ftb"><colgroup><col style="width:150px"><col style="width:130px"><col style="width:96px"><col style="width:96px"><col style="width:120px"><col><col style="width:130px"><col style="width:80px"></colgroup><thead><tr><th>Competência</th><th>Situação</th><th>Envio</th><th>Liberação</th><th>NF</th><th>Referência</th><th style="text-align:right">Valor</th><th></th></tr></thead><tbody>
  ${B.map((b) => `<tr class="child"><td class="dts">${ymLbl(b.comp)}${b.compFim !== b.comp ? " a " + ymLbl(b.compFim) : ""}</td><td><span class="stt ${b.situacao === "liberado" ? "s-c" : "s-o"}"><i></i>${SIT[b.situacao]}</span></td><td class="dts">${fmtD(b.envio)}</td><td class="dts">${b.liberacao ? fmtD(b.liberacao) : '<span class="mut">–</span>'}</td><td>${esc(b.nf) || '<span class="mut">–</span>'}</td><td>${esc(b.ref) || '<span class="mut">–</span>'}</td><td class="dts" style="text-align:right">${BRL(b.valor)}</td><td class="c-act" style="white-space:nowrap"><button class="ico" data-fat-edit="${b.id}" title="Editar" aria-label="Editar boletim">${PENCIL}</button><button class="ico" data-fat-del2="${b.id}" title="Excluir" aria-label="Excluir boletim"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></td></tr>`).join("")}
  <tr class="parent"><td colspan="6">Total realizado</td><td class="dts" style="text-align:right">${BRL(realTot)}</td><td></td></tr></tbody></table></div>`
      : `<p class="ok-msg">Nenhum boletim registrado.</p>`
  }</section>`;
    $("#view").innerHTML = k + chart + mt + itensPanel() + bt;
    finChart($("#chFin2"), $("#chFin2-lg"));
  }

  /* ---------- Cronograma ---------- */
  function renderCrono() {
    const g = +view[1];
    const chips = `<div class="chips">${[1, 2, 3, 4, 5].map((k) => `<a href="#g${k}" ${k === g ? 'aria-current="page"' : ""}>G${k} ${GRUPOS[k].nome}</a>`).join("")}</div>`;
    let extra = "";
    if (g === 3) {
      const F = ptFases();
      if (F.length)
        extra = `<button class="btn" data-pontos="1">Número de pontos (${Math.max(...F.map((x) => x.pts.length))})</button>`;
    }
    const hasPt = g === 3 && ptFases().length;
    const mode = hasPt && g3mode === "impl" ? "impl" : "crono"; // a roteirização foi para o Painel PMO
    // cronograma G3: recolher/expandir todas as etapas e grupos de pontos de uma vez
    if (g === 3 && mode === "crono" && ofG(3).length)
      extra += `<span class="seg tgall"><button data-tgall="0" title="Recolher todas as etapas">Recolher tudo</button><button data-tgall="1" title="Expandir todas as etapas e pontos">Expandir tudo</button></span>`;
    const seg = hasPt
      ? `<div class="seg g3seg"><button class="${mode === "crono" ? "on" : ""}" data-g3mode="crono">Cronograma</button><button class="${mode === "impl" ? "on" : ""}" data-g3mode="impl">Implantação dos pontos</button></div>`
      : "";
    $("#view").innerHTML =
      `<div class="chipbar">${chips}<span class="sp"></span>${toolbar(g, extra)}</div>${seg}` +
      (g === 3
        ? mode === "impl"
          ? viewImpl()
          : viewWF()
        : viewScrum(g));
  }
  let g3mode = (() => {
    try {
      return localStorage.getItem("pmo-hibrido-g3mode") || "crono";
    } catch (e) {
      return "crono";
    }
  })();
  let implQ = "",
    implF = "";
  function implCell(i) {
    const c = corte();
    if (!i) return `<td class="ic na"><span class="mut">–</span></td>`;
    const late = rF(i) && rF(i) < c && !i.fimReal;
    let cls, ico, txt;
    if (i.fimReal) {
      cls = "ok";
      ico = "●";
      txt = fmtD(i.fimReal);
    } else if (i.inicioReal) {
      cls = late ? "late" : "run";
      ico = "◐";
      txt = "desde " + fmtD(i.inicioReal);
    } else {
      cls = late ? "late" : "todo";
      ico = "○";
      txt = rF(i) ? "plan. " + fmtD(rF(i)) : "sem data";
    }
    return `<td class="ic ${cls}"><button class="icb" data-icell="${i.id}" title="${esc(i.titulo)} · ${cls === "ok" ? "concluído" : cls === "run" ? "em andamento" : cls === "late" ? "atrasado" : "não iniciado"}"><span class="ii">${ico}</span><span class="it">${txt}</span></button></td>`;
  }
  const PMODES = {
    estrutura: {
      label: "Estrutura",
      opts: {
        poste: {
          l: "Poste novo",
          steps: [
            ["Instalação do poste", "Implantação", 2],
            ["Instalação da infraestrutura elétrica e lógica", "Implantação", 1],
          ],
        },
        existente: {
          l: "Estrutura existente",
          steps: [["Instalação da infraestrutura elétrica e lógica", "Implantação", 1]],
        },
        torre: {
          l: "Torre",
          steps: [
            ["Instalação da torre", "Implantação", 3],
            ["Instalação da infraestrutura elétrica e lógica", "Implantação", 1],
          ],
        },
      },
    },
    energia: {
      label: "Energia",
      opts: {
        deriv: {
          l: "Derivada",
          steps: [
            ["Derivação de energia do ponto existente", "Implantação", 1],
          ],
        },
        padrao_dgt: {
          l: "Padrão de medição pela contratada",
          steps: [
            ["Instalação do padrão de medição", "Implantação", 2],
            [
              "Solicitação de abertura de protocolo ao cliente",
              "Implantação",
              1,
            ],
            ["Protocolo aberto pelo cliente", "Contratante", 3],
            ["Concessionária energizou o ponto", "Concessionária", 10],
          ],
        },
        padrao_cli: {
          l: "Padrão de medição pelo cliente",
          steps: [
            [
              "Solicitação ao cliente: instalação do padrão e protocolo",
              "Implantação",
              1,
            ],
            ["Instalação do padrão de medição", "Contratante", 7],
            ["Protocolo aberto pelo cliente", "Contratante", 3],
            ["Concessionária energizou o ponto", "Concessionária", 10],
          ],
        },
      },
    },
    link: {
      label: "Link",
      opts: {
        deriv: {
          l: "Derivada",
          steps: [["Conexão ao link existente", "Implantação", 1]],
        },
        link_dgt: {
          l: "Link pela contratada",
          // a contratada pede o link direto à operadora: nada é solicitado ao cliente
          steps: [
            ["Instalação da infraestrutura de link", "Implantação", 2],
            ["Solicitação do link à operadora", "Implantação", 1],
            ["Operadora ativou o link", "Provedor", 10],
          ],
        },
        link_cli: {
          l: "Link pelo cliente",
          steps: [
            [
              "Solicitação ao cliente: infraestrutura e pedido de link",
              "Implantação",
              1,
            ],
            ["Instalação da infraestrutura de link", "Contratante", 7],
            ["Pedido aberto pelo cliente junto à operadora", "Contratante", 3],
            ["Operadora ativou o link", "Provedor", 10],
          ],
        },
      },
    },
  };
  /* tarefas de ponto importadas do Smartsheet ("Padrão de Medição de Energia › …",
     "Conectividade › Ativação do Link"): reconhecidas como energia ou link pelo título */
  const grpAuto = (i) => {
    if (!i.ponto) return null;
    const t = normNome(i.titulo);
    if (/energi|padrao de (medicao|entrada)/.test(t)) return "energia";
    if (/\blink\b|conectividade/.test(t)) return "link";
    return null;
  };
  const grpOf = (i) =>
    i.grp ||
    (/^Energia\b/i.test(i.titulo || "")
      ? "energia"
      : /^Link\b/i.test(i.titulo || "")
        ? "link"
        : grpAuto(i));
  const modeOf = (items) => {
    const x = items.find((i) => i.gmode);
    if (x) return x.gmode;
    // importadas: modalidade deduzida pelas tarefas (quem instala o padrão / pede o link)
    if (!items.length || items.some((i) => /^(energia|link)$/i.test(String(i.titulo).trim())) || !items.every(grpAuto))
      return "simples";
    const g = grpAuto(items[0]);
    const t = items.map((i) => normNome(i.titulo + " " + i.resp)).join(" ");
    if (/deriva|existente/.test(t)) return "deriv";
    const doCliente = /\((municipio|contratante|cliente|prefeitura)\)|instalacao do (poste|padrao)[^|]*\b(contratante|municipio|cliente)\b/.test(
      items.map((i) => normNome(i.titulo + (/instalacao/.test(normNome(i.titulo)) ? " " + i.resp : ""))).join(" | "),
    );
    return g === "energia" ? (doCliente ? "padrao_cli" : "padrao_dgt") : doCliente ? "link_cli" : "link_dgt";
  };
  /* colunas fixas da implantação dos pontos (mesmas do modelo do painel) em todos os projetos:
     cada tarefa do ponto é encaixada numa etapa pelo título */
  const ETAPAS_PT = [
    ["infra", "Infraestrutura"],
    ["energia", "Energia"],
    ["link", "Link"],
    ["ajuste", "Ajuste"],
    ["ativ", "Ativação"],
    ["hand", "Handover"],
  ];
  function etapaPt(i) {
    const g = grpOf(i);
    if (g) return g;
    const t = normNome(i.titulo);
    if (/handover|relatorio de obra|as.?built/.test(t)) return "hand";
    if (/ajuste/.test(t)) return "ajuste";
    if (/ativa|teste|ativos|configura|licen|cadastr|camera|sistema|comissionamento/.test(t)) return "ativ";
    return "infra";
  }
  /* colunas da implantação: as subetapas que existem dentro dos pontos, na ordem em que aparecem
     (energia e link ficam agrupados pela modalidade); com subetapas demais (cronogramas importados),
     volta às etapas padrão */
  function implCols(pts) {
    const fixas = () =>
      ETAPAS_PT.map(([k, label]) => ({
        key: k,
        g: k === "energia" || k === "link" ? k : null,
        label,
      }));
    if (!pts || !pts.length) return fixas();
    const C = new Map();
    pts.forEach((p) =>
      p.items
        .slice()
        .sort((a, b) => (+a.seq || 0) - (+b.seq || 0))
        .forEach((i, k) => {
          const g = grpOf(i);
          const key = g || "t:" + normNome(i.titulo);
          const c = C.get(key);
          if (c) c.ord.push(k);
          else
            C.set(key, {
              key,
              g: g === "energia" || g === "link" || g === "estrutura" ? g : null,
              t: g ? null : normNome(i.titulo),
              label: g ? (PMODES[g] && PMODES[g].label) || g[0].toUpperCase() + g.slice(1) : i.titulo,
              ord: [k],
            });
        }),
    );
    const L = [...C.values()];
    if (L.filter((c) => c.t).length > 10) return fixas();
    const med = (c) => c.ord.reduce((a, b) => a + b, 0) / c.ord.length;
    return L.sort((a, b) => med(a) - med(b));
  }
  const itensEtapa = (p, c) =>
    p.items
      .filter((i) =>
        c.g ? grpOf(i) === c.g : c.t ? !grpOf(i) && normNome(i.titulo) === c.t : etapaPt(i) === c.key,
      )
      .sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
  function implGrpCell(p, c) {
    const its = itensEtapa(p, c);
    if (!its.length && c.g)
      // ponto sem tarefas deste grupo (comum nos importados): permite definir a modalidade
      return `<td class="ic todo"><button class="icb" data-igrp="${c.g}" data-ipt="${p.items[0].faseNum}:${p.ponto}" title="Definir modalidade"><span class="ii">+</span><span class="it"></span><span class="im">definir modalidade</span></button></td>`;
    if (!its.length) return implCell(null);
    if (!c.g && its.length === 1) return implCell(its[0]);
    if (!c.g) {
      // várias tarefas na mesma etapa (importadas): andamento conjunto; o clique abre a próxima pendente
      const cc = corte();
      const n = its.length,
        dn = its.filter((i) => i.fimReal).length,
        st = its.some((i) => i.inicioReal),
        late = its.some((i) => rF(i) && rF(i) < cc && !i.fimReal);
      const cls = dn === n ? "ok" : late ? "late" : st ? "run" : "todo";
      const ico = dn === n ? "●" : st ? "◐" : "○";
      const nxt = its.find((i) => !i.fimReal) || its[n - 1];
      const txt = dn === n ? fmtD(its[n - 1].fimReal) : `${dn}/${n}` + (rF(nxt) ? " · plan. " + fmtD(rF(nxt)) : "");
      return `<td class="ic ${cls}"><button class="icb" data-icell="${nxt.id}" title="${esc(its.map((i) => (i.fimReal ? "✓ " : "· ") + i.titulo).join(" | "))}"><span class="ii">${ico}</span><span class="it">${txt}</span><span class="im">${esc(nxt.titulo)}</span></button></td>`;
    }
    const cc = corte();
    const n = its.length,
      dn = its.filter((i) => i.fimReal).length,
      st = its.some((i) => i.inicioReal),
      late = its.some((i) => rF(i) && rF(i) < cc && !i.fimReal);
    const cls = dn === n ? "ok" : late ? "late" : st ? "run" : "todo";
    const ico = dn === n ? "●" : st ? "◐" : "○";
    const md = modeOf(its);
    const ml = md === "simples" ? "definir modalidade" : PMODES[c.g].opts[md].l;
    const nxt = its.find((i) => !i.fimReal);
    const txt =
      dn === n
        ? fmtD(its[n - 1].fimReal)
        : nxt
          ? `${n > 1 ? dn + "/" + n + " · " : ""}${esc(nxt.resp || "")}`
          : "";
    return `<td class="ic ${cls}"><button class="icb" data-igrp="${c.g}" data-ipt="${p.items[0].faseNum}:${p.ponto}" title="${esc(ml)}"><span class="ii">${ico}</span><span class="it">${txt}</span><span class="im">${esc(ml)}</span></button></td>`;
  }
  /* ---------- Roteirização ---------- */
  const RT_BASE = {
    nome: "DGT Tecnologia (partida)",
    end: "Rua Evaristo José Fernandes, 121 - Rincão dos Ilhéus, Estância Velha - RS, 93608-570",
    lat: -29.667422634202882,
    lng: -51.14398186966541,
  };
  const RT_FAT = 1.3;
  const RT = { sel: null, origin: "base", custom: "", ret: true, route: null };
  const svUrl = (lat, lng) =>
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const hav = (a, b) => {
    const R = 6371,
      t = (x) => (x * Math.PI) / 180;
    const dLa = t(b.lat - a.lat),
      dLo = t(b.lng - a.lng);
    const h =
      Math.sin(dLa / 2) ** 2 +
      Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  /* pontos dos projetos escolhidos no Painel PMO › Roteirização (chave "projeto|ponto"),
     com as coordenadas da vistoria de cada projeto e a situação do ponto */
  function rtPoints() {
    if (!PMO) return [];
    const S = new Set(PM.rtProj || []);
    return PMO.projs
      .filter((p) => S.has(p.id))
      .flatMap((p) => {
        const m = new Map();
        p.ag.forEach(({ i }) => {
          if (!i.ponto) return;
          const k = +i.pacoteNum;
          if (!m.has(k)) m.set(k, { nome: i.pacoteNome || "Ponto " + p2(k), feito: true });
          if (!i.fimReal) m.get(k).feito = false;
        });
        const V = p.vist || {};
        return [...m.entries()]
          .sort((x, y) => x[0] - y[0])
          .map(([k, o]) => {
            const v = V[k] || {};
            const C = vCoord(v.coord, v.lat, v.lng);
            const lat = parseFloat(C.lat),
              lng = parseFloat(C.lng);
            return {
              pn: p.id + "|" + k,
              pid: p.id,
              proj: p,
              ponto: k,
              nome: `${nomeCurto(p)} · ${o.nome}`,
              pontoNome: o.nome,
              feito: o.feito,
              v,
              lat,
              lng,
              ok: isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180,
            };
          });
      });
  }
  function rtSolve(nodes, ret) {
    const n = nodes.length;
    if (n < 2) return { ord: nodes.map((_, k) => k), dist: 0 };
    const D = nodes.map((a) => nodes.map((b) => hav(a, b)));
    const ord = [0];
    const used = new Set([0]);
    while (ord.length < n) {
      const last = ord[ord.length - 1];
      let bj = -1,
        bd = Infinity;
      for (let j = 0; j < n; j++)
        if (!used.has(j) && D[last][j] < bd) {
          bd = D[last][j];
          bj = j;
        }
      ord.push(bj);
      used.add(bj);
    }
    const len = (o) => {
      let s = 0;
      for (let k = 0; k < o.length - 1; k++) s += D[o[k]][o[k + 1]];
      if (ret) s += D[o[o.length - 1]][o[0]];
      return s;
    };
    let best = len(ord),
      imp = true,
      guard = 0;
    while (imp && guard++ < 200) {
      imp = false;
      for (let i = 1; i < n - 1; i++)
        for (let j = i + 1; j < n; j++) {
          const o = ord
            .slice(0, i)
            .concat(ord.slice(i, j + 1).reverse(), ord.slice(j + 1));
          const L = len(o);
          if (L < best - 1e-9) {
            ord.splice(0, n, ...o);
            best = L;
            imp = true;
          }
        }
    }
    return { ord, dist: best, D };
  }
  function rtCompute() {
    const P = rtPoints();
    const sel = P.filter((x) => x.ok && RT.sel.has(x.pn));
    if (!sel.length) {
      RT.route = null;
      return;
    }
    let nodes = sel.map((x) => Object.assign({}, x));
    let originNode = null;
    {
      originNode = {
        pn: null,
        nome: RT_BASE.nome,
        lat: RT_BASE.lat,
        lng: RT_BASE.lng,
        ok: true,
        v: { end: RT_BASE.end },
      };
      nodes = [originNode].concat(nodes);
    }
    if (false) {
      const C = vCoord(RT.custom);
      const lat = parseFloat(C.lat),
        lng = parseFloat(C.lng);
      if (isFinite(lat) && isFinite(lng)) {
        originNode = { pn: null, nome: "Origem", lat, lng, ok: true, v: {} };
        nodes = [originNode].concat(nodes);
      }
    }
    let S0;
    if (originNode || RT.ret || nodes.length > 120) S0 = rtSolve(nodes, RT.ret);
    else {
      S0 = null;
      for (let st = 0; st < nodes.length; st++) {
        const nn = [nodes[st]].concat(nodes.filter((_, k) => k !== st));
        const r = rtSolve(nn, false);
        if (!S0 || r.dist < S0.dist - 1e-9)
          S0 = { dist: r.dist, ord: r.ord.map((k) => nodes.indexOf(nn[k])) };
      }
    }
    const seq = S0.ord.map((k) => nodes[k]);
    const legs = seq.map((x, k) => (k ? hav(seq[k - 1], x) : 0));
    if (RT.ret && seq.length > 1) legs.push(hav(seq[seq.length - 1], seq[0]));
    RT.route = {
      seq,
      legs,
      total: legs.reduce((a, b) => a + b, 0),
      origin: !!originNode,
    };
  }
  const rtNum = (v) => +v || 0;
  function rtTotals(list) {
    const t = { camVMS: 0, camCE: 0, licVMS: 0, licRF: 0, licAV: 0 };
    list.forEach((x) => {
      Object.keys(t).forEach((k) => (t[k] += rtNum(x.v[k])));
    });
    return t;
  }
  function rtSvg(seq, ret, W, H) {
    if (!seq.length) return "";
    const lats = seq.map((x) => x.lat),
      lngs = seq.map((x) => x.lng);
    const la0 = Math.min(...lats),
      la1 = Math.max(...lats),
      lo0 = Math.min(...lngs),
      lo1 = Math.max(...lngs);
    const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
    const sx = (lo1 - lo0) * k || 0.001,
      sy = la1 - la0 || 0.001;
    const pad = 28;
    const sc = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
    const X = (lng) => pad + (lng - lo0) * k * sc + (W - 2 * pad - sx * sc) / 2,
      Y = (lat) => H - pad - (lat - la0) * sc - (H - 2 * pad - sy * sc) / 2;
    const pts = seq.map((x) => [X(x.lng), Y(x.lat)]);
    const path =
      pts
        .map(
          (p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1),
        )
        .join("") + (ret && pts.length > 2 ? "Z" : "");
    return `<svg viewBox="0 0 ${W} ${H}" class="rtmap" role="img" aria-label="Croqui da rota"><path d="${path}" fill="none" stroke="var(--scrum)" stroke-width="2.2" stroke-linejoin="round" stroke-dasharray="${ret ? "" : "0"}"/>${pts.map((p, i) => `<g><circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 9 : 8}" fill="${i === 0 ? "var(--ok)" : "var(--surface)"}" stroke="${i === 0 ? "var(--ok)" : "var(--scrum)"}" stroke-width="2"/><text x="${p[0]}" y="${p[1] + 3.5}" text-anchor="middle" class="rtn" fill="${i === 0 ? "#fff" : "var(--ink)"}">${seq[i].pn == null ? "O" : i + (RT.route && RT.route.origin ? 0 : 1)}</text><title>${esc(seq[i].nome)}</title></g>`).join("")}</svg>`;
  }
  function viewRota() {
    const P = rtPoints();
    if (!P.length)
      return `<div class="empty"><p>${(PM.rtProj || []).length ? "Os projetos escolhidos não têm pontos no cronograma." : "Escolha um ou mais projetos para listar os pontos."}</p></div>`;
    if (!RT.sel) RT.sel = new Set();
    RT.sel = new Set([...RT.sel].filter((k) => P.some((x) => x.pn === k))); // projeto retirado: tira os pontos dele
    if (RT.pend == null) RT.pend = true;
    const nOk = P.filter((x) => x.ok).length;
    const R = RT.route;
    const nNo = P.length - nOk;
    const LV = (RT.showAll ? P : P.filter((x) => x.ok)).filter((x) => !RT.pend || !x.feito);
    const list = `<section class="panel rtl"><div class="panel-h"><h2>Pontos</h2><span class="note">${RT.sel.size} de ${nOk} selecionado${RT.sel.size === 1 ? "" : "s"}</span></div>
    <div class="rtopt"><div class="rtbase"><span class="sl">Partida · DGT Tecnologia</span><small>${esc(RT_BASE.end)}</small></div>
      <div class="rtrow"><label class="chkl"><input type="checkbox" data-rtret ${RT.ret ? "checked" : ""}> Retornar à DGT</label><button class="btn primary" data-rtcalc ${RT.sel.size ? "" : "disabled"}>Calcular menor rota</button></div></div>
    <div class="rtbar"><label class="chkl"><input type="checkbox" data-rtpend ${RT.pend ? "checked" : ""}> Só pontos pendentes</label><button class="btn ghost" data-rtall="1">Todos</button><button class="btn ghost" data-rtall="0">Nenhum</button><span class="sp"></span>${nNo ? `<button class="btn ghost" data-rtshow>${RT.showAll ? "Ocultar" : "Mostrar"} ${nNo} sem coordenadas</button>` : ""}</div>
    <div class="rtlist">${LV.map((x) => `<label class="rti ${x.ok ? "" : "dis"} ${x.feito ? "feito" : ""}" style="--c:${x.proj.cor}"><input type="checkbox" data-rtp="${esc(x.pn)}" ${RT.sel.has(x.pn) && x.ok ? "checked" : ""} ${x.ok ? "" : "disabled"}><span class="rtt"><b>${esc(x.nome)}</b><small>${x.ok ? esc(x.v.end || "") : "sem coordenadas"}</small></span><span class="rtc">${[rtNum(x.v.camVMS) ? `VMS ${x.v.camVMS}` : "", rtNum(x.v.camCE) ? `CE ${x.v.camCE}` : ""].filter(Boolean).join(" · ")}</span></label>`).join("") || `<p class="ok-msg" style="padding:10px">Nenhum ponto com coordenadas. Importe a vistoria na visão Implantação dos pontos.</p>`}</div></section>`;
    let res = `<section class="panel rtr"><div class="panel-h"><h2>Rota</h2>${
      R
        ? `<span style="display:flex;gap:8px;flex-wrap:wrap">${rtGmapsSegs(R)
            .map(
              (g, k, a) =>
                `<a class="btn ghost" href="${g.url}" target="_blank" rel="noopener">${a.length > 1 ? `Rota no Google Maps · trecho ${k + 1}` : "Rota viária no Google Maps"}</a>`,
            )
            .join(
              "",
            )}<button class="btn" data-rtpdf>Exportar relatório PDF</button></span>`
        : ""
    }</div>`;
    if (!R)
      res += `<div id="rtMap" class="rtmap" role="img" aria-label="Mapa dos pontos selecionados"></div><p class="hint">Selecione os pontos e clique em “Calcular menor rota” para ver o trajeto pelas ruas.</p>`;
    else {
      const pts = R.seq.filter((x) => x.pn != null);
      const T = rtTotals(pts);
      res += `<div class="rtk rtk5"><div><b>≈ ${fmtN(R.total * RT_FAT)} km</b><span>estimativa viária (linha reta ${fmtN(R.total)} km × ${String(RT_FAT).replace(".", ",")})</span></div><div><b>${pts.length}</b><span>pontos</span></div><div><b>${T.camVMS + T.camCE}</b><span>câmeras (VMS ${T.camVMS} · CE ${T.camCE})</span></div><div><b>${T.licVMS + T.licRF + T.licAV}</b><span>licenças (VMS ${T.licVMS} · RF ${T.licRF} · AV ${T.licAV})</span></div></div>
    <div id="rtMap" class="rtmap" role="img" aria-label="Mapa da rota"></div><p class="rtvia" id="rtVia"></p>
    <ol class="rto">${R.seq.map((x, k) => `<li><span class="rtno ${x.pn == null ? "o" : ""}">${x.pn == null ? "O" : k + (R.origin ? 0 : 1)}</span><span class="rtt"><b>${esc(x.nome)}</b><small>${esc(x.v.end || "")}</small></span><span class="rtd">${k ? "≈ +" + fmtN(R.legs[k] * RT_FAT) + " km" : "partida"}${`<a class="sv" href="${svUrl(x.lat, x.lng)}" target="_blank" rel="noopener" title="Abrir o ponto no mapa">Mapa</a>`}</span></li>`).join("")}${RT.ret && R.seq.length > 1 ? `<li><span class="rtno o">↩</span><span class="rtt"><b>Retorno à DGT Tecnologia</b></span><span class="rtd">≈ +${fmtN(R.legs[R.legs.length - 1] * RT_FAT)} km</span></li>` : ""}</ol>
    <p class="hint">A ordem é otimizada pela menor distância entre as coordenadas (vizinho mais próximo + 2-opt), sempre partindo da DGT. A quilometragem é uma <b>estimativa viária</b>: linha reta × ${String(RT_FAT).replace(".", ",")}, fator típico de malha urbana. O trajeto e a distância exatos pelas ruas aparecem ao abrir a rota no Google Maps; o link “Mapa” de cada ponto abre a localização no Google Maps.</p>`;
    }
    res += `</section>`;
    setTimeout(rtMapa, 0);
    return `<div class="rtgrid">${list}${res}</div>`;
  }
  /* mapa OpenStreetMap (Leaflet) com os pontos e o trajeto pelas ruas (OSRM); sem internet, cai no esboço em linha reta */
  const RTM = { map: null, key: "", geo: null, km: null, min: null };
  const loadCSS = (href) => {
      if (window.__carregarEstilo) return window.__carregarEstilo(href);
    if (!document.querySelector(`link[href="${href}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    }
  };
  async function rtMapa() {
    const el = document.getElementById("rtMap");
    if (!el) return;
    const R = RT.route;
    let seq;
    if (R) seq = R.seq.concat(RT.ret && R.seq.length > 1 ? [R.seq[0]] : []);
    else
      seq = [Object.assign({ pn: null }, RT_BASE)].concat(
        rtPoints().filter((x) => x.ok && RT.sel && RT.sel.has(x.pn)),
      );
    try {
      loadCSS("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css");
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js");
    } catch (e) {
      if (R) el.outerHTML = rtSvg(R.seq, RT.ret, 560, 300);
      return;
    }
    if (!el.isConnected) return;
    if (RTM.map) RTM.map.remove();
    const map = (RTM.map = window.L.map(el, { scrollWheelZoom: false }));
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    const pinos = R ? R.seq : seq;
    pinos.forEach((x, k) => {
      const n = x.pn == null ? "DGT" : R ? k + (R.origin ? 0 : 1) : String(x.ponto);
      window.L.marker([x.lat, x.lng], {
        icon: window.L.divIcon({ className: "rtpin" + (x.pn == null ? " o" : ""), html: `<span>${esc(String(n))}</span>`, iconSize: null }),
        title: x.nome,
      })
        .bindPopup(`<b>${esc(x.nome)}</b>${x.v && x.v.end ? "<br>" + esc(x.v.end) : ""}`)
        .addTo(map);
    });
    const ll = seq.map((x) => [x.lat, x.lng]);
    if (ll.length > 1) map.fitBounds(window.L.latLngBounds(ll), { padding: [28, 28] });
    else if (ll.length) map.setView(ll[0], 15);
    if (!R || seq.length < 2) return;
    const reta = window.L.polyline(ll, { color: "#5b8def", weight: 3, dashArray: "6 6", opacity: 0.8 }).addTo(map);
    const via = (t) => {
      const v = document.getElementById("rtVia");
      if (v) v.innerHTML = t;
    };
    const key = seq.map((x) => x.lng.toFixed(6) + "," + x.lat.toFixed(6)).join(";");
    if (RTM.key !== key) {
      RTM.key = key;
      RTM.geo = null;
      via("Calculando o trajeto pelas ruas…");
      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${key}?overview=full&geometries=geojson`);
        const j = await r.json();
        if (j.code !== "Ok") throw new Error(j.code);
        RTM.geo = j.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
        RTM.km = j.routes[0].distance / 1000;
        RTM.min = j.routes[0].duration / 60;
      } catch (e) {
        RTM.key = "";
        via("Não foi possível traçar o trajeto pelas ruas agora; o mapa mostra a ligação em linha reta entre os pontos.");
        return;
      }
    }
    if (!el.isConnected || RTM.map !== map) return;
    reta.remove();
    window.L.polyline(RTM.geo, { color: "#2f6fe4", weight: 4, opacity: 0.85 }).addTo(map);
    const h = Math.floor(RTM.min / 60), m = Math.round(RTM.min % 60);
    via(`Trajeto pelas ruas: <b>${fmtN(RTM.km)} km</b> · cerca de <b>${h ? h + " h " : ""}${m} min</b> de carro, sem paradas (OpenStreetMap / OSRM).`);
  }
  function rtGmapsSegs(R) {
    const s = R.seq.concat(RT.ret && R.seq.length > 1 ? [R.seq[0]] : []);
    const out = [];
    for (let i = 0; i < s.length - 1; i += 9) {
      const part = s.slice(i, i + 10);
      out.push({
        a: i + 1,
        b: i + part.length,
        url:
          "https://www.google.com/maps/dir/" +
          part.map((x) => `${x.lat},${x.lng}`).join("/"),
      });
    }
    return out;
  }
  function rtGmaps(R) {
    const s = R.seq.concat(RT.ret && R.seq.length > 1 ? [R.seq[0]] : []);
    return (
      "https://www.google.com/maps/dir/" +
      s.map((x) => `${x.lat},${x.lng}`).join("/")
    );
  }
  async function rtPDF() {
    const R = RT.route;
    if (!R) return;
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    toast("Gerando relatório…");
    try {
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      );
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
      );
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const pw = doc.internal.pageSize.getWidth();
      const pts = R.seq.filter((x) => x.pn != null);
      const T = rtTotals(pts);
      const pt = (t) => String(t == null ? "" : t).replace(/·/g, "-");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Relatório de roteirização dos pontos", 10, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        pt(
          `${[...new Set(pts.map((x) => x.proj.nome))].join(" / ")} - Emitido em ${fmtD(todayISO())}`,
        ),
        10,
        17.5,
      );
      doc.setTextColor(0);
      const box = (x, y, w, h, v, l) => {
        doc.setDrawColor(210);
        doc.roundedRect(x, y, w, h, 2, 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(String(v), x + 4, y + 8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(l, x + 4, y + 13);
        doc.setTextColor(0);
      };
      box(
        10,
        22,
        52,
        16,
        `~${fmtN(R.total * RT_FAT)} km`,
        `estimativa viária (reta ${fmtN(R.total)} km x ${String(RT_FAT).replace(".", ",")})`,
      );
      box(66, 22, 40, 16, pts.length, "pontos na rota");
      box(
        110,
        22,
        62,
        16,
        T.camVMS + T.camCE,
        `câmeras: VMS ${T.camVMS} - CE ${T.camCE}`,
      );
      box(
        176,
        22,
        80,
        16,
        T.licVMS + T.licRF + T.licAV,
        `licenças: VMS ${T.licVMS} - Rec. Facial ${T.licRF} - Análise ${T.licAV}`,
      );
      // mapa da rota (OpenStreetMap); sem internet, o croqui
      const s = R.seq;
      await rtMapaPDF(doc, s, RT.ret, 10, 42, 95, 70);
      // ordem resumida ao lado
      doc.autoTable({
        startY: 42,
        margin: { left: 110, right: 10 },
        head: [["#", "Ponto", "Trecho"]],
        body: R.seq
          .map((x, k) => [
            x.pn == null ? "O" : k + (R.origin ? 0 : 1),
            pt(x.nome),
            k ? "~" + fmtN(R.legs[k] * RT_FAT) + " km" : "partida",
          ])
          .concat(
            RT.ret && s.length > 1
              ? [
                  [
                    "R",
                    "Retorno à DGT",
                    `~${fmtN(R.legs[R.legs.length - 1] * RT_FAT)} km`,
                  ],
                ]
              : [],
          ),
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 1.2 },
        headStyles: { fillColor: [30, 43, 58] },
        columnStyles: {
          0: { cellWidth: 10 },
          2: { cellWidth: 24, halign: "right" },
        },
      });
      {
        let y = Math.max(doc.lastAutoTable.finalY + 8, 122);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text("Partida: DGT Tecnologia", 10, y);
        doc.setFont("helvetica", "normal");
        doc.text(pt(RT_BASE.end), 48, y);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.text("Rota viária no Google Maps:", 10, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(43, 106, 140);
        let xx = 56;
        rtGmapsSegs(R).forEach((g, k, a) => {
          const lbl =
            a.length > 1
              ? `trecho ${k + 1} (paradas ${g.a}-${g.b})`
              : "abrir rota";
          doc.textWithLink(lbl, xx, y, { url: g.url });
          xx += doc.getTextWidth(lbl) + 6;
        });
        doc.setTextColor(0);
        y += 6;
        doc.setFontSize(7.5);
        doc.setTextColor(110);
        doc.text(
          pt(
            `Distâncias estimadas: linha reta entre coordenadas x ${String(RT_FAT).replace(".", ",")} (fator de malha urbana). Trajeto exato pelas ruas no link do Google Maps.`,
          ),
          10,
          y,
        );
        doc.setTextColor(0);
      }
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Informações dos pontos na ordem da rota", 10, 12);
      tabelaPontosRota(doc, pts, 16, (x) => R.seq.indexOf(x) + (R.origin ? 0 : 1));
      await downloads.save({
        filename: `roteirizacao-${todayISO()}.pdf`,
        data: doc.output("blob"),
      });
    } catch (e) {
      toast("Não foi possível gerar o PDF: " + ((e && e.message) || e));
    }
  }
  function viewImpl() {
    const F = ptFases()[0];
    if (!F)
      return `<div class="empty"><p>Nenhuma etapa estruturada por pontos.</p></div>`;
    const W = wbs();
    const pts = F.pts;
    const cols = implCols(pts);
    const fnome = (fasesWF().find((x) => x.num === F.f) || {}).nome || "";
    const q = implQ.trim().toLowerCase();
    const stOf = (p) => {
      const pc = rollPct(p.items);
      const late = p.items.some((i) => rF(i) && rF(i) < corte() && !i.fimReal);
      return pc >= 1 ? "ok" : late ? "late" : pc > 0 ? "run" : "todo";
    };
    const L = pts.filter(
      (p) =>
        (!q ||
          String(p.nome || "")
            .toLowerCase()
            .includes(q)) &&
        (!implF || stOf(p) === implF),
    );
    const cnt = (c) =>
      pts.filter((p) => {
        const its = itensEtapa(p, c);
        return its.length && its.every((i) => i.fimReal);
      }).length;
    const tot = { ok: 0, run: 0, late: 0, todo: 0 };
    pts.forEach((p) => tot[stOf(p)]++);
    const head = `<div class="implbar"><div class="implsum">${[
      ["ok", "Concluídos"],
      ["run", "Em andamento"],
      ["late", "Atrasados"],
      ["todo", "Não iniciados"],
    ]
      .map(
        ([k, l]) =>
          `<button class="isum ${k} ${implF === k ? "on" : ""}" data-implf="${k}"><b>${tot[k]}</b><span>${l}</span></button>`,
      )
      .join(
        "",
      )}</div><span class="implacts"><button class="btn ghost" data-vmodelo>Baixar modelo da vistoria</button><button class="btn" data-vimport>Importar vistoria</button><input type="file" id="vFile" accept=".xlsx,.csv" hidden><select class="isit" data-implsit aria-label="Filtrar por situação" title="Filtrar por situação">${[
      ["", "Todas as situações"],
      ["ok", "Concluídos"],
      ["run", "Em andamento"],
      ["late", "Atrasados"],
      ["todo", "Não iniciados"],
    ]
      .map(([k, l]) => `<option value="${k}" ${implF === k ? "selected" : ""}>${l}${k ? ` (${tot[k]})` : ""}</option>`)
      .join("")}</select><input class="isearch" data-implq placeholder="Buscar ponto…" value="${esc(implQ)}" aria-label="Buscar ponto"></span></div>`;
    const rows = L.map((p) => {
      const pc = rollPct(p.items);
      const vi = (cfg.vist || {})[p.ponto] || {};
      const vd = vDesc(vi);
      const vl = vLic(vi);
      return `<tr><td class="ipn"><span class="ipw"><span class="ieap">${W.num.get(p.items[0].id).split(".").slice(0, 2).join(".")}</span><span class="ipcol"><input class="ie ie-name ipname" data-ep="${F.f}:${p.ponto}" value="${esc(p.nome || "Ponto " + p2(p.ponto))}" aria-label="Nome do ponto" spellcheck="false">${vd || vi.lat ? `<span class="ipv" title="${esc([vd, vl, vi.coord, vi.obs ? "Obs.: " + vi.obs : ""].filter(Boolean).join(" · "))}">${esc(vd)}${vi.lat && vi.lng ? ` · <a href="https://www.google.com/maps?q=${encodeURIComponent(vi.lat + "," + vi.lng)}" target="_blank" rel="noopener">mapa</a>` : ""}</span>` : ""}</span></span></td>
      ${cols.map((c) => implGrpCell(p, c)).join("")}<td class="ipc">${pctCell(pc * 100)}</td></tr>`;
    }).join("");
    const th = (c) =>
      c.g
        ? `<th>${esc(c.label)}<small>${cnt(c)}/${pts.length}</small><select class="imodeall" data-modeall="${c.g}" aria-label="Aplicar modalidade de ${esc(c.label)} a todos"><option value="">aplicar a todos…</option>${Object.entries(
            PMODES[c.g].opts,
          )
            .map(([k, o]) => `<option value="${k}">${esc(o.l)}</option>`)
            .join("")}</select></th>`
        : `<th>${esc(c.label)}<small>${cnt(c)}/${pts.length}</small></th>`;
    return `<section class="panel"><div class="panel-h"><h2>Implantação · etapa ${F.f} · ${esc(fnome.replace(/^Frente\s*\d+\s*[·\-–]\s*/i, ""))}</h2><span class="note">${pts.length} pontos · clique em uma célula para lançar o realizado ou definir a modalidade</span></div>${head}
  <div class="implscroll"><table class="impltb"><thead><tr><th class="ipn">Ponto</th>${cols.map(th).join("")}<th class="ipc">% ponto</th></tr></thead><tbody>${rows || `<tr><td colspan="${cols.length + 2}" class="mut" style="padding:20px">Nenhum ponto encontrado.</td></tr>`}</tbody></table></div>
  <p class="hint" style="margin-top:8px">● concluído · ◐ em andamento · ○ não iniciado · vermelho = término planejado vencido. Em Energia e Link, a modalidade define as tarefas do ponto e os responsáveis (contratada, cliente, concessionária ou operadora).</p></section>`;
  }
  /* ---------- Vistoria: modelo e importação ---------- */
  const VCOLS = [
    ["ponto", "Ponto (código)"],
    ["end", "Endereço"],
    ["coord", "Coordenadas (lat, long)"],
    ["camVMS", "Câmeras VMS"],
    ["camCE", "Câmeras CE"],
    ["licVMS", "Licenças VMS"],
    ["licRF", "Licenças Rec. Facial"],
    ["licAV", "Licenças Análise de vídeo"],
    ["infra", "Infraestrutura"],
    ["energia", "Energia"],
    ["link", "Link"],
    ["obs", "Observação"],
  ];
  const VINFRA = ["Torre", "Poste Concreto", "Poste Metálico", "Existente"];
  const VEN = [
      "Derivada",
      "Padrão de medição pelo cliente",
      "Padrão de medição pela contratada",
    ],
    VLK = ["Derivada", "Link pelo cliente", "Link pela contratada"];
  const VMAP = {
    energia: {
      deriv: /deriv|existente/i,
      padrao_dgt: /contrat|dgt|nosso|pr[oó]pri/i,
      padrao_cli: /cliente|prefeit|munic/i,
    },
    link: {
      deriv: /deriv|existente/i,
      link_dgt: /contrat|dgt|nosso|pr[oó]pri/i,
      link_cli: /cliente|prefeit|munic/i,
    },
  };
  const vMode = (g, t) => {
    t = String(t || "").trim();
    if (!t) return "";
    for (const [k, re] of Object.entries(VMAP[g])) if (re.test(t)) return k;
    return "";
  };
  const vInfra = (t) => {
    t = String(t || "").trim();
    if (!t) return "";
    if (/torre/i.test(t)) return "Torre";
    if (/concret/i.test(t)) return "Poste Concreto";
    if (/met[aá]l/i.test(t)) return "Poste Metálico";
    if (/exist/i.test(t)) return "Existente";
    return t;
  };
  const normH = (t) =>
    String(t || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const vNum = (t) => {
    t = String(t ?? "").trim();
    if (!t) return "";
    const n = +t.replace(",", ".");
    return isNaN(n) ? "" : n;
  };
  function vCoord(c, lat, lng) {
    let a = String(lat || "").trim(),
      b = String(lng || "").trim();
    if (c && !a) {
      const m = String(c)
        .replace(/;/g, ",")
        .match(/(-?\d+(?:[.,]\d+)?)\s*[,\s]\s*(-?\d+(?:[.,]\d+)?)/);
      if (m) {
        a = m[1].replace(",", ".");
        b = m[2].replace(",", ".");
      }
    }
    return {
      lat: a,
      lng: b,
      coord: a && b ? `${a}, ${b}` : String(c || "").trim(),
    };
  }
  async function vistModelo() {
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    try {
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
      );
      const wb = new window.ExcelJS.Workbook();
      const ws = wb.addWorksheet("Vistoria", {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      ws.columns = VCOLS.map(([k, l]) => ({
        header: l,
        key: k,
        width:
          {
            ponto: 16,
            end: 38,
            coord: 26,
            infra: 18,
            energia: 32,
            link: 22,
            obs: 40,
          }[k] || 14,
      }));
      const rows = Array.from({ length: 10 }, (_, k) => ({
        ponto: "Ponto " + p2(k + 1),
      }));
      rows.forEach((r) => ws.addRow(r));
      const bd = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      ws.getRow(1).height = 30;
      for (let r = 1; r <= rows.length + 1; r++)
        for (let c = 1; c <= VCOLS.length; c++) {
          const cl = ws.getRow(r).getCell(c);
          cl.border = bd;
          cl.alignment =
            r === 1
              ? { horizontal: "center", vertical: "middle", wrapText: true }
              : { horizontal: "center", vertical: "middle" };
          if (r === 1) cl.font = { bold: true };
        }
      const last = Math.max(rows.length + 1, 300);
      const list = (a) => ({
        type: "list",
        allowBlank: true,
        formulae: ['"' + a.join(",") + '"'],
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error: "Escolha um valor da lista.",
      });
      const ci = (k) => VCOLS.findIndex((c) => c[0] === k) + 1;
      const L = (n) => String.fromCharCode(64 + n);
      for (let r = 2; r <= last; r++) {
        ws.getCell(`${L(ci("infra"))}${r}`).dataValidation = list(VINFRA);
        ws.getCell(`${L(ci("energia"))}${r}`).dataValidation = list(VEN);
        ws.getCell(`${L(ci("link"))}${r}`).dataValidation = list(VLK);
        ["camVMS", "camCE", "licVMS", "licRF", "licAV"].forEach(
          (k) =>
            (ws.getCell(`${L(ci(k))}${r}`).dataValidation = {
              type: "whole",
              operator: "greaterThanOrEqual",
              allowBlank: true,
              formulae: [0],
              showErrorMessage: true,
              error: "Informe um número inteiro.",
            }),
        );
      }
      const wi = wb.addWorksheet("Instruções");
      wi.columns = [
        { header: "Coluna", width: 26 },
        { header: "Como preencher", width: 100 },
      ];
      wi.getRow(1).font = { bold: true };
      [
        [
          "Ponto (código)",
          "Identificação do ponto, ex.: M215-C130. Uma linha por ponto, na ordem de implantação.",
        ],
        ["Endereço", "Endereço ou referência do ponto."],
        [
          "Coordenadas (lat, long)",
          "Latitude e longitude na mesma célula, separadas por vírgula, em graus decimais. Ex.: -29.6783, -51.1306",
        ],
        [
          "Câmeras VMS / Câmeras CE",
          "Quantidade de câmeras de cada tipo no ponto.",
        ],
        [
          "Licenças VMS / Rec. Facial / Análise de vídeo",
          "Quantidade de licenças de cada tipo no ponto.",
        ],
        ["Infraestrutura", VINFRA.join(" · ")],
        ["Energia", VEN.join(" · ")],
        ["Link", VLK.join(" · ")],
        [
          "Observação",
          "Texto livre: restrições de acesso, pendências, referências do local.",
        ],
        ["", ""],
        [
          "Exemplo de linha",
          "M215-C130 · Av. Exemplo, 100 · -29.6783, -51.1306 · VMS 2 · CE 1 · Lic. VMS 3 · Rec. Facial 1 · Análise de vídeo 1 · Poste Concreto · Padrão de medição pela contratada · Link pela contratada",
        ],
      ].forEach((x) => wi.addRow(x));
      const buf = await wb.xlsx.writeBuffer();
      await downloads.save({
        filename: "modelo-vistoria-tecnica.xlsx",
        data: new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
    } catch (e) {
      toast("Não foi possível gerar o modelo: " + ((e && e.message) || e));
    }
  }
  async function vistParse(file) {
    // portal: ExcelJS (.xlsx) e leitor de CSV próprios (services/implantacoes/BibliotecasPainel.ts)
    const A = await window.__lerPlanilha(file);
    const hi = A.findIndex((r) => r.some((c) => /^ponto/i.test(normH(c))));
    if (hi < 0)
      throw new Error("cabeçalho com a coluna “Ponto” não encontrado");
    const H = A[hi].map(normH);
    const find = (...keys) =>
      H.findIndex((h) => keys.some((x) => h.startsWith(x)));
    const ix = {
      ponto: find("ponto"),
      end: find("endereco", "local"),
      coord: find("coordenada"),
      lat: find("latitude"),
      lng: find("longitude"),
      camVMS: find("camerasvms", "camvms", "camerasdevms"),
      camCE: find("camerasce", "camce"),
      cams: find("ncamera", "camera", "qtdcamera"),
      licVMS: find("licencasvms", "licvms"),
      licRF: find(
        "licencasrecfacial",
        "licencasreconhecimento",
        "licrf",
        "licencasrf",
      ),
      licAV: find("licencasanalise", "licav", "licencasav"),
      infra: find("infraestrutura", "tipodeinfraestrutura", "infra"),
      energia: find("energia"),
      link: find("link"),
      obs: find("observacao", "obs"),
    };
    const g = (r, k) => (ix[k] >= 0 ? String(r[ix[k]] ?? "").trim() : "");
    return A.slice(hi + 1)
      .filter((r) => r.some((c) => String(c).trim()))
      .map((r) => {
        const C = vCoord(g(r, "coord"), g(r, "lat"), g(r, "lng"));
        const o = {
          ponto: g(r, "ponto"),
          end: g(r, "end"),
          coord: C.coord,
          lat: C.lat,
          lng: C.lng,
          camVMS: vNum(g(r, "camVMS") || (ix.camVMS < 0 ? g(r, "cams") : "")),
          camCE: vNum(g(r, "camCE")),
          licVMS: vNum(g(r, "licVMS")),
          licRF: vNum(g(r, "licRF")),
          licAV: vNum(g(r, "licAV")),
          infra: vInfra(g(r, "infra")),
          energia: g(r, "energia"),
          link: g(r, "link"),
          obs: g(r, "obs"),
        };
        o.mE = vMode("energia", o.energia);
        o.mL = vMode("link", o.link);
        o.infraOk = !o.infra || VINFRA.includes(o.infra);
        return o;
      })
      .filter((o) => o.ponto);
  }
  const vDesc = (v) =>
    [
      v.end,
      v.camVMS !== "" && v.camVMS != null
        ? `VMS ${v.camVMS}`
        : v.cams
          ? `${v.cams} câm.`
          : "",
      v.camCE ? `CE ${v.camCE}` : "",
      v.infra,
    ]
      .filter(Boolean)
      .join(" · ");
  const vLic = (v) =>
    [
      v.licVMS ? `Lic. VMS ${v.licVMS}` : "",
      v.licRF ? `Rec. Facial ${v.licRF}` : "",
      v.licAV ? `Análise de vídeo ${v.licAV}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  const vNorm = (t) =>
    String(t || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  function vistMatch(rows) {
    const F = ptFases()[0];
    const pts = F ? F.pts : [];
    const used = new Set();
    const seen = new Set();
    rows.forEach((o) => {
      o.dup = seen.has(vNorm(o.ponto));
      seen.add(vNorm(o.ponto));
      o.act = "";
      o.pn = null;
    });
    rows.forEach((o) => {
      if (o.dup) return;
      const p = pts.find(
        (p) => !used.has(p.ponto) && vNorm(p.nome) === vNorm(o.ponto),
      );
      if (p) {
        o.act = "upd";
        o.pn = p.ponto;
        used.add(p.ponto);
      }
    });
    const generic = pts.filter(
      (p) =>
        !used.has(p.ponto) &&
        /^PONTO\s*\d+$/i.test(String(p.nome || "Ponto 0")),
    );
    rows.forEach((o) => {
      if (o.act || o.dup) return;
      const p = generic.shift();
      if (p) {
        o.act = "ren";
        o.pn = p.ponto;
        o.from = p.nome;
        used.add(p.ponto);
      } else o.act = "new";
    });
    const out = pts
      .filter((p) => !used.has(p.ponto))
      .map((p) => ({
        pn: p.ponto,
        nome: p.nome || "Ponto " + p2(p.ponto),
        real: p.items.some((i) => i.inicioReal || i.fimReal),
        pct: rollPct(p.items),
      }));
    return { rows, out };
  }
  function vistPreview(rows) {
    const M = vistMatch(rows);
    const d = $("#dlgFat"),
      f = $("#formFat");
    const R = M.rows;
    const bad = (t) =>
      `<span style="color:var(--alert)">${esc(t)} (não reconhecido)</span>`;
    const cnt = (k) => R.filter((o) => o.act === k).length;
    const dups = R.filter((o) => o.dup).length;
    const warn = R.filter(
      (o) => (o.energia && !o.mE) || (o.link && !o.mL) || !o.infraOk,
    ).length;
    const act = (o) =>
      o.dup
        ? `<span class="vact bad">Duplicado · ignorado</span>`
        : o.act === "upd"
          ? `<span class="vact upd">Atualiza existente</span>`
          : o.act === "ren"
            ? `<span class="vact ren">Renomeia ${esc(o.from || "")}</span>`
            : `<span class="vact new">Novo ponto</span>`;
    f.innerHTML = `<h3>Importar vistoria técnica</h3>
   <div class="vsum"><span><b>${cnt("upd")}</b> atualizados</span><span><b>${cnt("ren")}</b> renomeados</span><span><b>${cnt("new")}</b> novos</span>${dups ? `<span class="bad"><b>${dups}</b> duplicados</span>` : ""}<span class="${M.out.length ? "warn" : ""}"><b>${M.out.length}</b> fora da planilha</span></div>
   <p class="hint">Os pontos são associados pelo código: um código que já existe no projeto atualiza esse ponto, em qualquer ordem. Códigos novos ocupam primeiro os pontos ainda com nome genérico (“Ponto 01”…) e, depois, criam pontos novos no fim da etapa.</p>
   <div class="tw" style="max-height:330px;overflow:auto"><table class="crono ftb vprev"><thead><tr><th>#</th><th>Ação</th><th>Ponto</th><th>Endereço / coordenadas</th><th>Câm. VMS</th><th>Câm. CE</th><th>Licenças</th><th>Infraestrutura</th><th>Energia</th><th>Link</th><th>Observação</th></tr></thead><tbody>
   ${R.map((o, k) => `<tr class="child"><td class="dts">${k + 1}</td><td>${act(o)}</td><td><b>${esc(o.ponto)}</b></td><td>${esc(o.end)}${o.coord ? `<span class="sub">${esc(o.coord)}</span>` : ""}</td><td class="dts">${esc(o.camVMS)}</td><td class="dts">${esc(o.camCE)}</td><td style="font-size:12px">${esc(vLic(o)) || '<span class="mut">–</span>'}</td><td>${o.infra ? (o.infraOk ? esc(o.infra) : bad(o.infra)) : '<span class="mut">–</span>'}</td><td>${o.mE ? esc(PMODES.energia.opts[o.mE].l) : o.energia ? bad(o.energia) : '<span class="mut">–</span>'}</td><td>${o.mL ? esc(PMODES.link.opts[o.mL].l) : o.link ? bad(o.link) : '<span class="mut">–</span>'}</td><td style="white-space:normal;min-width:180px">${esc(o.obs) || '<span class="mut">–</span>'}</td></tr>`).join("")}</tbody></table></div>
   ${
     M.out.length
       ? `<div class="vout"><b>Pontos do projeto que não estão na planilha</b><p class="hint">Eles são mantidos como estão, a menos que você marque a exclusão abaixo.</p>
     <ul>${M.out.map((x) => `<li>${esc(x.nome)}${x.real ? ` <span class="vact bad">⚠ possui datas realizadas · ${fmtPct(x.pct)}</span>` : ""}</li>`).join("")}</ul>
     <label class="chkl"><input type="checkbox" id="vDel"> Excluir do projeto ${M.out.length === 1 ? "este ponto" : `estes ${M.out.length} pontos`}, com todas as atividades${M.out.some((x) => x.real) ? " (inclusive os que já têm datas realizadas)" : ""}</label></div>`
       : ""
   }
   ${warn ? `<p class="hint" style="color:var(--alert)">${warn} linha(s) com valores não reconhecidos. Energia e link não reconhecidos não alteram a modalidade do ponto.</p>` : ""}
   <p class="hint">Energia e link recriam as tarefas apenas dos pontos em que a modalidade mudar; as datas realizadas dessas tarefas são apagadas.</p>
   <div class="actions"><button type="button" class="btn" id="vCancel">Cancelar</button><button class="btn primary" type="submit" id="vGo">Importar</button></div>`;
    $("#vCancel").onclick = () => d.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const delSel = !!($("#vDel") && $("#vDel").checked);
      if (
        delSel &&
        M.out.some((x) => x.real) &&
        !(await askConfirm(
          `Confirma a exclusão de ${M.out.length} ponto(s), incluindo pontos com datas realizadas? Esta ação não pode ser desfeita.`,
          "Excluir e importar",
        ))
      )
        return;
      $("#vGo").disabled = true;
      $("#vGo").textContent = "Importando…";
      try {
        await vistApply(M, delSel);
        d.close();
        toast("Vistoria importada.");
      } catch (err) {
        $("#vGo").disabled = false;
        $("#vGo").textContent = "Importar";
        toast("Erro na importação: " + ((err && err.message) || err));
      }
    };
    d.classList.add("wide");
    if (!d.open) d.showModal();
    d.addEventListener("close", () => d.classList.remove("wide"), {
      once: true,
    });
  }
  async function vistApply(M, delSel) {
    let F = ptFases();
    if (!F.length)
      throw new Error("o projeto não tem etapa estruturada por pontos");
    const W0 = {};
    F.forEach((x) => {
      W0[x.f] = x.pts
        .flatMap((p) => p.items)
        .reduce((s, i) => s + (+i.peso || 0), 0);
    });
    const rows = M.rows.filter((o) => !o.dup);
    const nNew = rows.filter((o) => o.act === "new").length;
    const delPn = new Set(delSel ? M.out.map((x) => x.pn) : []);
    if (delPn.size) {
      const ids = new Set();
      F.forEach((x) =>
        x.pts
          .filter((p) => delPn.has(p.ponto))
          .forEach((p) => p.items.forEach((i) => ids.add(i.id))),
      );
      ids.forEach((id) => del("atividades", id));
      S.itens = S.itens.filter((x) => !ids.has(x.id));
      const vv = Object.assign({}, cfg.vist || {});
      delPn.forEach((pn) => delete vv[pn]);
      cfg.vist = vv;
      F = ptFases();
    }
    const before = new Set(F[0].pts.map((p) => p.ponto));
    if (nNew || delPn.size) {
      const plans = F.map((x) =>
        planPontos(x.f, x.pts, x.pts.length + nNew, W0[x.f]),
      );
      const w = plans.flatMap((pl) => pl.writes);
      patchItems(
        w
          .map((o) => {
            const old = S.itens.find((x) => x.id === o.id);
            return old
              ? { id: o.id, fields: diffFields(old, o) }
              : { id: o.id, fields: clean(o), isNew: true };
          })
          .filter((p) => p.isNew || Object.keys(p.fields).length),
      );
      F = ptFases();
    }
    const fresh = F[0].pts
      .filter((p) => !before.has(p.ponto))
      .map((p) => p.ponto)
      .sort((a, b) => a - b);
    rows
      .filter((o) => o.act === "new")
      .forEach((o, k) => {
        o.pn = fresh[k];
      });
    const vist = Object.assign({}, cfg.vist || {});
    const ren = [];
    rows.forEach((o) => {
      if (o.pn == null) return;
      vist[o.pn] = {
        end: o.end,
        coord: o.coord,
        lat: o.lat,
        lng: o.lng,
        camVMS: o.camVMS,
        camCE: o.camCE,
        licVMS: o.licVMS,
        licRF: o.licRF,
        licAV: o.licAV,
        infra: o.infra,
        obs: o.obs,
      };
      F.forEach((x) => {
        const q = x.pts.find((y) => y.ponto === o.pn);
        if (q && vNorm(q.nome) !== vNorm(o.ponto))
          q.items.forEach((i) =>
            ren.push({ id: i.id, fields: { pacoteNome: o.ponto } }),
          );
      });
    });
    if (ren.length) patchItems(ren);
    cfg.vist = vist;
    saveCfg();
    for (const o of rows) {
      if (o.pn == null) continue;
      if (o.mE) await setPointMode(F[0].f, o.pn, "energia", o.mE, true);
      if (o.mL) await setPointMode(F[0].f, o.pn, "link", o.mL, true);
    }
    setTimeout(afterG3, 400);
  }
  async function setPointMode(f, pn, g, mode, silent) {
    const P = S.itens
      .filter(
        (i) =>
          +i.grupo === 3 && i.ponto && +i.faseNum === f && +i.pacoteNum === pn,
      )
      .sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
    if (!P.length) return false;
    const old = P.filter((i) => grpOf(i) === g);
    if (modeOf(old) === mode) return false;
    if (
      !silent &&
      old.some((i) => i.inicioReal || i.fimReal) &&
      !(await askConfirm(
        `${g === "energia" ? "A energia" : "O link"} deste ponto já tem datas realizadas. Trocar a modalidade apaga essas datas. Continuar?`,
        "Trocar",
      ))
    )
      return false;
    const def = PMODES[g].opts[mode];
    // grupo novo no ponto: peso médio das tarefas do ponto; entra depois da infraestrutura
    // (o link, depois da energia)
    const w = old.length
      ? old.reduce((s, i) => s + (+i.peso || 0), 0)
      : (P.reduce((s, i) => s + (+i.peso || 0), 0) / P.length) * def.steps.length;
    const ultEn = P.map((i) => grpOf(i)).lastIndexOf("energia");
    const idx = old.length ? P.indexOf(old[0]) : g === "estrutura" ? 0 : g === "link" && ultEn >= 0 ? ultEn + 1 : Math.min(1, P.length);
    const fresh = def.steps.map(([t, rs, d], k) => ({
      id: uid(),
      grupo: 3,
      ordem: Date.now() + k,
      faseNum: f,
      faseNome: (old[0] || P[0]).faseNome,
      pacoteNum: pn,
      pacoteNome: (old[0] || P[0]).pacoteNome,
      ponto: 1,
      grp: g,
      gmode: mode,
      titulo: `${PMODES[g].label} · ${t}`,
      resp: rs,
      duracao: d,
      durTpl: 1,
      peso: Math.round((w / def.steps.length) * 1000) / 1000,
      predTipo: "TI",
      inicio: "",
      fim: "",
      inicioRev: "",
      fimRev: "",
      inicioReal: "",
      fimReal: "",
      pctReal: 0,
      marco: false,
      valor: "",
      obs: "",
    }));
    const seqd = P.filter((i) => grpOf(i) !== g);
    seqd.splice(idx, 0, ...fresh);
    const patches = [];
    let prev = null;
    seqd.forEach((i, k) => {
      const code = `G3-F${p2(f)}-P${p2(pn)}-A${p2(k + 1)}`;
      const isNew = fresh.includes(i);
      const fl = { seq: k + 1, codigo: code };
      if (k > 0) fl.pred = prev;
      else fl.pred = i.pred || "";
      if (k > 0) fl.predTipo = "TI";
      if (isNew)
        patches.push({
          id: i.id,
          fields: clean(Object.assign({}, i, fl)),
          isNew: true,
        });
      else {
        const o = {};
        Object.keys(fl).forEach((x) => {
          if (fl[x] !== i[x]) o[x] = fl[x];
        });
        if (Object.keys(o).length) patches.push({ id: i.id, fields: o });
      }
      prev = code;
    });
    old.forEach((i) => del("atividades", i.id));
    patchItems(patches);
    return true;
  }
  function openGrpMenu(btn) {
    const [f, pn] = btn.dataset.ipt.split(":").map(Number);
    const g = btn.dataset.igrp;
    const its = S.itens
      .filter(
        (i) =>
          +i.grupo === 3 &&
          i.ponto &&
          +i.faseNum === f &&
          +i.pacoteNum === pn &&
          grpOf(i) === g,
      )
      .sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
    let m = document.getElementById("icMenu");
    if (!m) {
      m = document.createElement("div");
      m.id = "icMenu";
      m.className = "rkmenu icmenu";
      document.body.appendChild(m);
    }
    const md = modeOf(its);
    const W = wbs();
    const pn0 = (its[0] && its[0].pacoteNome) || "Ponto " + p2(pn);
    m.innerHTML = `<div class="ich"><b>${esc(pn0)} · ${PMODES[g].label}</b><small>Modalidade e responsabilidades</small></div>
   <label>Modalidade<select data-pmode="${g}" data-ipt="${f}:${pn}">${md === "simples" ? `<option value="simples" selected>Não definida (tarefa única)</option>` : ""}${Object.entries(
     PMODES[g].opts,
   )
     .map(
       ([k, o]) =>
         `<option value="${k}" ${md === k ? "selected" : ""}>${esc(o.l)}</option>`,
     )
     .join("")}</select></label>
   <div class="icsteps">${its
     .map(
       (
         i,
       ) => `<div class="icstep ${i.fimReal ? "ok" : i.inicioReal ? "run" : ""}"><div class="ist"><b>${esc(W.num.get(i.id) || "")} ${esc(String(i.titulo).replace(new RegExp("^" + PMODES[g].label + "\\s*·\\s*"), ""))}</b><small>${esc(i.resp || "")} · ${fmtN(i.duracao || 0)} d · plan. ${fmtD(rI(i))} – ${fmtD(rF(i))}</small></div>
      <div class="isd"><input type="date" class="dt icd" data-ri="${i.id}" value="${esc(i.inicioReal || "")}" title="Início realizado"><input type="date" class="dt icd" data-rf="${i.id}" value="${esc(i.fimReal || "")}" title="Fim realizado"><button data-icq="fim" data-id="${i.id}" title="Concluir hoje">✓</button></div></div>`,
     )
     .join("")}</div>`;
    const b = btn.getBoundingClientRect();
    m.style.left =
      Math.max(8, Math.min(window.innerWidth - 440, b.left - 100)) + window.scrollX + "px";
    m.style.top = b.bottom + 4 + window.scrollY + "px";
    m.hidden = false;
  }
  function openImplMenu(btn) {
    const id = btn.dataset.icell;
    const it = S.itens.find((x) => x.id === id);
    if (!it) return;
    let m = document.getElementById("icMenu");
    if (!m) {
      m = document.createElement("div");
      m.id = "icMenu";
      m.className = "rkmenu icmenu";
      document.body.appendChild(m);
    }
    const W = wbs();
    m.innerHTML = `<div class="ich"><b>${esc(W.num.get(id))} · ${esc(it.titulo)}</b><small>Planejado ${fmtD(rI(it))} – ${fmtD(rF(it))}</small></div>
   <label>Início realizado<input type="date" class="dt icd" data-ri="${id}" value="${esc(it.inicioReal || "")}"></label><label>Fim realizado<input type="date" class="dt icd" data-rf="${id}" value="${esc(it.fimReal || "")}"></label>
   <div class="icact"><button data-icq="ini" data-id="${id}">Iniciar hoje</button><button data-icq="fim" data-id="${id}">Concluir hoje</button><button data-icq="clr" data-id="${id}">Limpar</button></div>`;
    const b = btn.getBoundingClientRect();
    m.style.left =
      Math.max(8, Math.min(window.innerWidth - 260, b.left)) + window.scrollX + "px";
    m.style.top = b.bottom + 4 + window.scrollY + "px";
    m.hidden = false;
  }
  function toolbar(g, extra) {
    return `<span class="acts"><button class="btn primary" data-add="${g}">Adicionar ${g === 3 ? "atividade" : "item"}</button>${extra || ""}<span class="expw"><button class="btn" data-expmenu aria-haspopup="true">Exportar cronograma <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><span class="expm" hidden><button data-exp="pdf">PDF</button><button data-exp="csv">CSV</button><button data-exp="ss">Smartsheet (.xlsx)</button></span></span></span>`;
  }
  function viewScrum(g) {
    const m = metScrum(g);
    const PG = grpDates(g);
    let h = `<p class="desc">${DESC[g]}</p><p class="desc" style="margin-top:-8px"><b>Período:</b> ${fmtPer(PG)}${g === 4 ? " · durante todo o projeto" : g === 5 ? " · inclui o prazo do atestado técnico" : ` · ${m.sprints.length} sprint${m.sprints.length === 1 ? "" : "s"}`}</p>`;
    if (!m.n)
      return (
        h +
        `<div class="empty"><p>Nenhum item em ${GRUPOS[g].nome.toLowerCase()} ainda.</p><button class="btn primary" data-add="${g}">Adicionar o primeiro item</button></div>`
      );
    m.sprints.forEach((s) => {
      const L = m.L.filter((i) => (+i.sprint || 1) === s.s).sort(
        (a, b) => (+a.seq || 0) - (+b.seq || 0),
      );
      // nome da sprint (ex.: "Licitação"): cfg.sprintNomes[grupo][sprint], editável no próprio título
      const sn = ((cfg.sprintNomes || {})[g] || {})[s.s] || "";
      h += `<section class="sprint"><div class="sprint-h"><h3>Sprint ${p2(s.s)}<input class="ie sprn" data-sprn="${g}|${s.s}" value="${esc(sn)}" placeholder="Nome da sprint" aria-label="Nome da sprint ${p2(s.s)}" spellcheck="false"></h3><span class="sprdt">${sprBotoes(g, s.s, g === 4 ? 0 : s.n - s.nd)}</span><span class="meta">${g === 4 ? g4Meta(L) : `${s.nd}/${s.n} itens · ${fmtPct(s.pct)}`}</span></div>
    ${g === 4 ? g4Tabela(L, s.s) : `<div class="scroll"><table class="stack"><colgroup><col style="width:112px"><col><col style="width:12%"><col style="width:64px"><col style="width:12%"><col style="width:150px"><col style="width:132px"><col style="width:150px"><col style="width:72px"></colgroup><thead><tr><th>ID</th><th>Item e critério de aceite</th><th>Responsável</th><th>Esforço</th><th>Dependência</th><th title="Data em que o item deve estar concluído (prazo)">Conclusão prevista</th><th>Status</th><th title="Data em que o item foi de fato concluído">Concluído em</th><th class="c-act"></th></tr></thead><tbody>
    ${L.map(
      (
        i,
      ) => `<tr data-sid="${i.id}"><td class="code"><span class="grip" data-sgrip="${i.id}" title="Clique, segure e arraste para mudar a ordem (os IDs da sprint são renumerados)" aria-label="Arrastar para reordenar">⋮⋮</span>${esc(i.codigo)}</td><td class="full">${esc(i.titulo)}${i.dod ? `<span class="small">Aceite: ${esc(i.dod)}</span>` : ""}</td><td data-l="Responsável">${esc(i.resp) || "–"}</td><td class="num" data-l="Esforço">${i.esforco != null && i.esforco !== "" ? fmtN(i.esforco) : "–"}</td><td class="pred" data-l="Dependência">${esc(i.dep) || "–"}</td>
      <td data-l="Conclusão prevista"><input type="date" class="dt sprev ${i.fim && i.fim < todayISO() && !isDoneSt(stG(g, i.status)) ? "late" : ""}" data-sprev="${i.id}" value="${esc(i.fim || "")}" aria-label="Conclusão prevista" title="Conclusão prevista (prazo do item)"></td>
      <td data-l="Status">${(() => {
        const v = stG(g, i.status);
        return `<select class="st" data-st="${i.id}" data-v="${STCLS[v] || v}" aria-label="Status">${Object.entries(
          stOpts(g),
        )
          .map(
            ([k, l]) =>
              `<option value="${k}" ${v === k ? "selected" : ""}>${l}</option>`,
          )
          .join("")}</select>`;
      })()}</td>
      <td data-l="Concluído em"><input type="date" class="dt scfim" data-scfim="${i.id}" value="${esc(i.fimReal || "")}" aria-label="Concluído em" title="Concluído em (data real)"></td>
      <td class="c-act"><button class="btn ghost" data-edit="${i.id}">Editar</button></td></tr>`,
    ).join("")}</tbody></table></div>`}</section>`;
    });
    if (g === 4) h += g4Historico(m.L);
    return h;
  }
  /* ---------- monitoramento e controle (G4): itens cíclicos ----------
     Cada item tem um ciclo (semanal, mensal…) e um histórico de execuções (execs: [{d, obs, por, em}]).
     A próxima execução vem da última mais o ciclo; vencida fica em vermelho. */
  const CICLOS = { semanal: ["Semanal", 7], quinzenal: ["Quinzenal", 14], mensal: ["Mensal", "1m"], bimestral: ["Bimestral", "2m"], trimestral: ["Trimestral", "3m"], demanda: ["Sob demanda", 0] };
  const addMeses = (s0, n) => {
    const d = dt(s0);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  };
  const execsDe = (i) => (Array.isArray(i.execs) ? i.execs.filter((x) => x && x.d) : []).slice().sort((a, b) => (a.d < b.d ? 1 : -1));
  function proxExec(i) {
    const c = CICLOS[i.ciclo || "mensal"] || CICLOS.mensal;
    if (!c[1]) return "";
    // sem execução: o primeiro vencimento é um ciclo depois do início da sprint (ou da fase)
    const ult = execsDe(i)[0];
    const P = ult ? null : sprintPer(4, +i.sprint || 1) || grpDates(4);
    const base = ult ? ult.d : P && P[0];
    if (!base) return "";
    return typeof c[1] === "number" ? addDays(base, c[1]) : addMeses(base, +c[1][0]);
  }
  function g4Meta(L) {
    const n = L.reduce((t, i) => t + execsDe(i).length, 0);
    const venc = L.filter((i) => {
      const p = proxExec(i);
      return p && p < todayISO();
    }).length;
    return `${n} execuç${n === 1 ? "ão" : "ões"}${venc ? ` · <b class="bad">${venc} vencida${venc > 1 ? "s" : ""}</b>` : ""}`;
  }
  function g4Tabela(L) {
    const hoje = todayISO();
    return `<div class="scroll"><table class="stack g4t"><colgroup><col style="width:112px"><col><col style="width:13%"><col style="width:150px"><col style="width:170px"><col style="width:120px"><col style="width:190px"></colgroup><thead><tr><th>ID</th><th>Item e critério de aceite</th><th>Responsável</th><th>Ciclo</th><th>Execuções</th><th>Próxima</th><th class="c-act"></th></tr></thead><tbody>
    ${L.map((i) => {
      const E = execsDe(i);
      const px = proxExec(i);
      return `<tr data-sid="${i.id}"><td class="code"><span class="grip" data-sgrip="${i.id}" title="Clique, segure e arraste para mudar a ordem (os IDs da sprint são renumerados)" aria-label="Arrastar para reordenar">⋮⋮</span>${esc(i.codigo)}</td><td class="full">${esc(i.titulo)}${i.dod ? `<span class="small">Aceite: ${esc(i.dod)}</span>` : ""}</td><td data-l="Responsável">${esc(i.resp) || "–"}</td>
      <td data-l="Ciclo"><select class="g4ciclo" data-ciclo="${i.id}" aria-label="Ciclo">${Object.entries(CICLOS).map(([k, [l]]) => `<option value="${k}" ${(i.ciclo || "mensal") === k ? "selected" : ""}>${l}</option>`).join("")}</select></td>
      <td data-l="Execuções"><button type="button" class="lnk g4hist" data-g4hist="${i.id}" title="Ver o histórico de execuções">${E.length ? `${E.length}× · última ${fmtD(E[0].d)}` : "nenhuma ainda"}</button></td>
      <td data-l="Próxima" class="${px && px < hoje ? "bad" : ""}">${px ? fmtD(px) + (px < hoje ? " · vencida" : "") : `<span class="mut">–</span>`}</td>
      <td class="c-act"><button class="btn" data-g4reg="${i.id}" title="Registrar uma execução deste item">+ Execução</button> <button class="btn ghost" data-edit="${i.id}">Editar</button></td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  // tudo o que já foi executado no monitoramento, do mais recente para o mais antigo
  function g4Historico(L) {
    const R = L.flatMap((i) => execsDe(i).map((x) => ({ i, x }))).sort((a, b) => (a.x.d < b.x.d ? 1 : a.x.d > b.x.d ? -1 : 0));
    const nome = (sp) => ((cfg.sprintNomes || {})[4] || {})[sp] || `Sprint ${p2(sp)}`;
    return `<section class="sprint g4hsec"><div class="sprint-h"><h3>Histórico de execuções</h3><span class="meta">${R.length ? `${R.length} registro${R.length > 1 ? "s" : ""}` : "nenhum registro ainda"}</span></div>${
      R.length
        ? `<div class="scroll"><table class="stack"><colgroup><col style="width:110px"><col style="width:30%"><col style="width:18%"><col><col style="width:16%"></colgroup><thead><tr><th>Data</th><th>Item</th><th>Sprint</th><th>Observação</th><th>Registrado por</th></tr></thead><tbody>${R.map(
            ({ i, x }) => `<tr><td class="nw">${fmtD(x.d)}</td><td><button type="button" class="lnk" data-g4hist="${i.id}">${esc(i.codigo)} · ${esc(i.titulo)}</button></td><td>${esc(nome(+i.sprint || 1))}</td><td>${esc(x.obs || "") || `<span class="mut">–</span>`}</td><td>${esc(x.por || "") || `<span class="mut">–</span>`}${x.em ? `<small class="mut"> · ${fmtDH(x.em)}</small>` : ""}</td></tr>`,
          ).join("")}</tbody></table></div>`
        : `<p class="hint">Use “+ Execução” em cada item para registrar o que foi feito (data e observação). Os registros aparecem aqui e no histórico de cada item.</p>`
    }</section>`;
  }
  /* janela do item: registrar execução e ver/excluir o histórico */
  function g4Janela(id, foco) {
    const it = S.itens.find((x) => x.id === id);
    if (!it) return;
    const d = $("#dlgFat"),
      f = $("#formFat");
    const E = execsDe(it);
    f.innerHTML = `<h3>${esc(it.codigo)} · ${esc(it.titulo)}</h3><p class="hint">Ciclo: ${esc((CICLOS[it.ciclo || "mensal"] || CICLOS.mensal)[0])}${proxExec(it) ? ` · próxima ${fmtD(proxExec(it))}` : ""}</p>
      <h4>Registrar execução</h4><div class="fgrid"><label>Data<input type="date" name="d" value="${todayISO()}" max="${todayISO()}" required></label><label class="fwide">Observação<input name="obs" placeholder="Ex.: boletim de setembro enviado e aprovado"></label></div>
      <h4>Histórico (${E.length})</h4>${
        E.length
          ? `<ul class="g4lista">${E.map((x) => `<li><b>${fmtD(x.d)}</b><span>${esc(x.obs || "") || `<span class="mut">sem observação</span>`}</span><small class="mut">${esc(x.por || "")}${x.em ? " · " + fmtDH(x.em) : ""}</small><button type="button" class="ico rm" data-g4del="${esc(x.d + "|" + (x.em || ""))}" title="Excluir este registro" aria-label="Excluir registro">×</button></li>`).join("")}</ul>`
          : `<p class="hint">Nenhuma execução registrada ainda.</p>`
      }
      <div class="actions"><button type="button" class="btn" id="g4Fechar">Fechar</button><button class="btn primary" type="submit">Registrar execução</button></div>`;
    $("#g4Fechar").onclick = () => d.close();
    f.onclick = async (e) => {
      const b = e.target.closest("[data-g4del]");
      if (!b) return;
      if (!(await askConfirm("Excluir este registro de execução?", "Excluir"))) return;
      const [dd, em] = b.dataset.g4del.split("|");
      const atual = S.itens.find((x) => x.id === id);
      let tirou = false;
      const L = (atual.execs || []).filter((x) => {
        if (!tirou && x.d === dd && (x.em || "") === em) return !(tirou = true);
        return true;
      });
      putItem(Object.assign({}, atual, { execs: L }));
      setTimeout(() => g4Janela(id), 60);
    };
    f.onsubmit = (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(f).entries());
      if (!v.d) return;
      if (v.d > todayISO()) return toast("A execução não pode ser numa data futura.");
      const atual = S.itens.find((x) => x.id === id);
      const reg = { d: v.d, obs: (v.obs || "").trim(), por: (window.SESSAO && window.SESSAO.usuario && window.SESSAO.usuario.nome) || (typeof agUser === "string" ? agUser : ""), em: new Date().toISOString() };
      putItem(Object.assign({}, atual, { execs: (atual.execs || []).concat(reg) }));
      toast(`Execução registrada em ${fmtD(v.d)}.`);
      d.close();
    };
    if (!d.open) d.showModal();
    const fx = f.querySelector(foco === "reg" ? '[name="obs"]' : "#g4Fechar");
    if (fx) fx.focus();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-g4reg],[data-g4hist]");
    if (!b) return;
    g4Janela(b.dataset.g4reg || b.dataset.g4hist, b.dataset.g4reg ? "reg" : "hist");
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("[data-ciclo]"))) return;
    const it = S.itens.find((x) => x.id === t.dataset.ciclo);
    if (it) putItem(Object.assign({}, it, { ciclo: t.value }));
  });
  /* ordem das atividades da sprint: arrastar pela alça ⋮⋮ ao lado do ID; a sprint é renumerada
     (G1-S01-T01, T02…) e dependências/predecessoras que citam os IDs antigos acompanham */
  const SG = { on: null };
  async function reordenarSprint(id, alvoId, depois) {
    const it = S.itens.find((x) => x.id === id);
    if (!it || alvoId === id) return;
    const g = +it.grupo,
      sp = +it.sprint || 1;
    const L = S.itens.filter((x) => +x.grupo === g && (+x.sprint || 1) === sp).sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
    const k = L.findIndex((x) => x.id === id);
    let j = L.findIndex((x) => x.id === alvoId) + (depois ? 1 : 0);
    if (j > k) j--;
    if (j === k || j < 0) return; // soltou no mesmo lugar
    L.splice(k, 1);
    L.splice(j, 0, it);
    const P = [],
      ren = {};
    L.forEach((x, n) => {
      const codigo = `G${g}-S${p2(sp)}-T${p2(n + 1)}`;
      if (x.codigo && x.codigo !== codigo) ren[x.codigo] = codigo;
      if (+x.seq !== n + 1 || x.codigo !== codigo) P.push({ id: x.id, fields: { seq: n + 1, codigo } });
    });
    // dependências (sprints) e predecessoras (execução) citam os IDs: trocam todos de uma vez
    const troca = (t) => String(t || "").replace(/G[1245]-S\d+-T\d+/g, (c) => ren[c] || c);
    S.itens.forEach((x) => {
      ["dep", "pred"].forEach((c) => {
        if (!x[c] || troca(x[c]) === String(x[c])) return;
        const q = P.find((y) => y.id === x.id);
        if (q) q.fields[c] = troca(x[c]);
        else P.push({ id: x.id, fields: { [c]: troca(x[c]) } });
      });
    });
    if (await salvarAtomico(P)) toast(`“${it.titulo}” agora é ${`G${g}-S${p2(sp)}-T${p2(j + 1)}`}; a sprint foi renumerada.`);
  }
  function sgFim(ok) {
    const m = SG.on;
    SG.on = null;
    if (!m) return;
    m.lin.remove();
    document.body.classList.remove("mvarr");
    m.tr.classList.remove("arrastando");
    if (ok && m.alvo) reordenarSprint(m.id, m.alvo.id, m.alvo.depois);
  }
  document.addEventListener("pointerdown", (e) => {
    const gr = e.target.closest && e.target.closest("[data-sgrip]");
    if (!gr || e.button !== 0) return;
    e.preventDefault();
    const tr = gr.closest("tr");
    const lin = document.createElement("div");
    lin.className = "mvlin";
    lin.hidden = true;
    document.body.append(lin);
    document.body.classList.add("mvarr");
    tr.classList.add("arrastando");
    SG.on = { id: gr.dataset.sgrip, tr, tb: tr.closest("tbody"), lin, alvo: null };
  });
  document.addEventListener("pointermove", (e) => {
    const m = SG.on;
    if (!m) return;
    m.alvo = null;
    m.lin.hidden = true;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const r = el && el.closest && el.closest("tr[data-sid]");
    if (!r || r === m.tr || r.closest("tbody") !== m.tb) return; // só dentro da mesma sprint
    const b = r.getBoundingClientRect(),
      t = m.tb.getBoundingClientRect();
    const depois = e.clientY > b.top + b.height / 2;
    m.alvo = { id: r.dataset.sid, depois };
    m.lin.hidden = false;
    m.lin.style.left = t.left + window.scrollX + "px";
    m.lin.style.width = t.width + "px";
    m.lin.style.top = (depois ? b.bottom : b.top) + window.scrollY - 1.5 + "px";
  });
  document.addEventListener("pointerup", () => SG.on && sgFim(true));
  document.addEventListener("pointercancel", () => SG.on && sgFim(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && SG.on) sgFim(false);
  });
  /* Ctrl + clique na predecessora: vai até a tarefa (atividade da execução, etapa inteira ou item de sprint) */
  // com Ctrl pressionado, as predecessoras aparecem como link
  const marcaCtrl = (e) => document.body.classList.toggle("ctrl", !!(e.ctrlKey || e.metaKey));
  document.addEventListener("keydown", marcaCtrl);
  document.addEventListener("keyup", marcaCtrl);
  window.addEventListener("blur", () => document.body.classList.remove("ctrl"));
  function irParaPred(raw) {
    const t = String(raw || "");
    let m = t.match(/G3-F\d+-P\d+-A\d+/);
    if (m) {
      const it = ofG(3).find((i) => i.codigo === m[0]);
      if (!it) return toast("Predecessora não encontrada no cronograma.");
      return focoNivel({ id: it.id });
    }
    m = t.match(/G3-F0*(\d+)(?![\d-])/);
    if (m) return focoNivel({ etapa: +m[1] });
    m = t.match(/G([1245])-S\d+-T\d+/);
    if (m) {
      const it = S.itens.find((i) => i.codigo === m[0]);
      if (!it) return toast("Predecessora não encontrada nas sprints.");
      location.hash = "g" + m[1];
      setTimeout(() => {
        const tr = document.querySelector(`#view tr[data-sid="${CSS.escape(it.id)}"]`);
        if (!tr) return;
        tr.scrollIntoView({ block: "center" });
        tr.classList.add("movido");
        setTimeout(() => tr.classList.remove("movido"), 1600);
      }, 150);
      return;
    }
    toast("Sem predecessora para abrir.");
  }
  document.addEventListener(
    "click",
    (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const inp = e.target.closest && e.target.closest("input.ie-pred[data-epred], input.ie-pred[data-gpred]");
      if (!inp) return;
      e.preventDefault();
      e.stopPropagation();
      inp.blur();
      if (inp.dataset.gpred) return irParaPred(((cfg.predGrp || {})[inp.dataset.gpred] || {}).pred);
      const it = S.itens.find((x) => x.id === inp.dataset.epred);
      const hp = it && !String(it.pred || "").trim() && predHerdada(it, ancestrais(wbs()));
      irParaPred(it && (it.pred || (hp && hp.pred)));
    },
    true,
  );
  /* início e fim da sprint: "Iniciar sprint" define o período (cfg.sprintDatas, usado no cronograma e
     nas predecessoras) e marca o início; "Encerrar sprint" registra a data de encerramento
     (cfg.sprintEstado[grupo][sprint] = {ini, fim}) */
  const sprEst = (g, sp) => ((cfg.sprintEstado || {})[g] || {})[sp] || {};
  // bloco único: situação | período (clicável) com dias e barra de tempo | ação
  function sprBotoes(g, sp, pendentes) {
    const x = ((cfg.sprintDatas || {})[g] || {})[sp] || [];
    const st = sprEst(g, sp);
    const dm = (s) => (s ? s.slice(8, 10) + "/" + s.slice(5, 7) : "…");
    const hoje = todayISO();
    const total = x[0] && x[1] ? Math.round((dt(x[1]) - dt(x[0])) / 864e5) + 1 : 0;
    let sub = total ? `${total} dia${total > 1 ? "s" : ""}` : "";
    let pct = -1,
      atras = false;
    if (st.ini && !st.fim && total) {
      const k = Math.round((dt(hoje) - dt(x[0])) / 864e5) + 1;
      if (k > total) {
        atras = true;
        sub = `${k - total} dia${k - total > 1 ? "s" : ""} de atraso`;
        pct = 100;
      } else if (k >= 1) {
        sub = `dia ${k} de ${total}`;
        pct = Math.round((k / total) * 100);
      }
    }
    // minimalista: só texto; o período abre o ajuste, a ação é um link discreto
    void pct;
    const per = x[0] || x[1]
      ? `<button type="button" class="sprtx" data-spred="${g}|${sp}" title="Ajustar o período da sprint">${dm(x[0])} – ${dm(x[1])}</button>${sub ? `<span class="sprtx-s ${atras ? "atras" : ""}">· ${sub}</span>` : ""}`
      : "";
    const link = (attr, txt, t) => `<button type="button" class="sprlk" ${attr}${t ? ` title="${t}"` : ""}>${txt}</button>`;
    if (st.fim) return `<span class="sprmin"><span class="sprtx-s ok">Encerrada em ${dm(st.fim)}</span>${per ? `<span class="sprtx-s">·</span>${per}` : ""}${link(`data-sprreab="${g}|${sp}"`, "Reabrir", "Reabrir a sprint (remove a data de encerramento)")}</span>`;
    if (st.ini) return `<span class="sprmin">${per}${link(`data-sprfim="${g}|${sp}|${pendentes}"`, "Encerrar")}</span>`;
    return `<span class="sprmin">${per}${link(`data-sprini="${g}|${sp}"`, "Iniciar sprint")}</span>`;
  }
  function sprGravar(g, sp, datas, estado) {
    if (datas) {
      const N = JSON.parse(JSON.stringify(cfg.sprintDatas || {}));
      N[g] = N[g] || {};
      N[g][sp] = datas;
      cfg.sprintDatas = N;
    }
    if (estado !== undefined) {
      const E = JSON.parse(JSON.stringify(cfg.sprintEstado || {}));
      E[g] = E[g] || {};
      if (estado) E[g][sp] = estado;
      else delete E[g][sp];
      cfg.sprintEstado = E;
    }
    saveCfg();
    afterG3();
    render();
  }
  // janela de início (ou de ajuste) do período da sprint
  function sprJanela(g, sp, modo) {
    const d = $("#dlgFat"),
      f = $("#formFat");
    const x = ((cfg.sprintDatas || {})[g] || {})[sp] || [];
    const st = sprEst(g, sp);
    const ini = x[0] || (modo === "iniciar" ? todayISO() : "");
    const fim = x[1] || (ini ? addDays(ini, 13) : "");
    const nome = ((cfg.sprintNomes || {})[g] || {})[sp] || "";
    f.innerHTML = `<h3>${modo === "iniciar" ? "Iniciar" : "Período da"} Sprint ${p2(sp)}${nome ? " · " + esc(nome) : ""}</h3><p class="hint">${modo === "iniciar" ? "Defina o período da sprint. As atividades que dependem dela no cronograma passam a seguir essas datas." : "Ajuste o início e o fim previsto da sprint."}</p>
      <div class="fgrid sprg"><label>Início<input type="date" name="ini" value="${esc(ini)}" required></label><label>Fim previsto<input type="date" name="fim" value="${esc(fim)}" required></label><label>Nº de dias<input type="number" name="dias" min="1" max="730" step="1"><span class="fdica" id="sprUteis"></span></label></div>
      <div class="actions">${modo !== "iniciar" && !st.ini ? `<button type="button" class="btn ghost danger" id="sprLimpa">Remover período</button>` : ""}<button type="button" class="btn" id="sprCanc">Cancelar</button><button class="btn primary" type="submit">${modo === "iniciar" ? "▶ Iniciar sprint" : "Salvar"}</button></div>`;
    $("#sprCanc").onclick = () => d.close();
    // nº de dias corridos (início e fim contam) e, abaixo, quantos são úteis; dias ↔ fim previsto
    const corridos = (a, b) => Math.round((dt(b) - dt(a)) / 864e5) + 1;
    const mostraUteis = () => {
      const a = f.ini.value,
        b = f.fim.value;
      $("#sprUteis").textContent = a && b && b >= a ? `${diasUteis(a, b)} dias úteis` : "";
    };
    const pelasDatas = () => {
      const a = f.ini.value,
        b = f.fim.value;
      f.dias.value = a && b && b >= a ? corridos(a, b) : "";
      mostraUteis();
    };
    const pelosDias = () => {
      const n = Math.round(+f.dias.value);
      if (f.ini.value && n >= 1) f.fim.value = addDays(f.ini.value, n - 1);
      mostraUteis();
    };
    f.fim.oninput = f.fim.onchange = pelasDatas;
    // mudar o início mantém o nº de dias (o fim acompanha)
    f.ini.oninput = f.ini.onchange = () => (f.dias.value ? pelosDias() : pelasDatas());
    f.dias.oninput = pelosDias;
    pelasDatas();
    const lp = $("#sprLimpa");
    if (lp)
      lp.onclick = () => {
        const N = JSON.parse(JSON.stringify(cfg.sprintDatas || {}));
        if (N[g]) delete N[g][sp];
        cfg.sprintDatas = N;
        d.close();
        saveCfg();
        afterG3();
        render();
      };
    f.onsubmit = (e) => {
      e.preventDefault();
      const a = f.ini.value,
        b = f.fim.value;
      if (!a || !b) return toast("Informe o início e o fim previsto.");
      if (b < a) return toast("O fim da sprint precisa ser depois do início.");
      d.close();
      sprGravar(g, sp, [a, b], modo === "iniciar" ? { ini: a } : undefined);
      toast(modo === "iniciar" ? `Sprint ${p2(sp)} iniciada: ${fmtD(a)} a ${fmtD(b)}.` : "Período da sprint atualizado.");
    };
    if (!d.open) d.showModal();
    f.ini.focus();
  }
  // encerrar: registra a data (hoje, ajustável) e avisa se ainda há itens abertos
  function sprEncerrar(g, sp, pendentes) {
    const d = $("#dlgFat"),
      f = $("#formFat");
    const x = ((cfg.sprintDatas || {})[g] || {})[sp] || [];
    f.innerHTML = `<h3>Encerrar Sprint ${p2(sp)}</h3>${+pendentes ? `<p class="hint bad">Ainda há ${pendentes} ite${+pendentes > 1 ? "ns" : "m"} sem concluir nesta sprint.</p>` : `<p class="hint">Todos os itens da sprint estão concluídos.</p>`}
      <div class="fgrid"><label>Data de encerramento<input type="date" name="fim" value="${todayISO()}" required></label></div>
      <div class="actions"><button type="button" class="btn" id="sprCanc">Cancelar</button><button class="btn primary" type="submit">■ Encerrar sprint</button></div>`;
    $("#sprCanc").onclick = () => d.close();
    f.onsubmit = (e) => {
      e.preventDefault();
      const fim = f.fim.value;
      const st = sprEst(g, sp);
      const ini = st.ini || x[0] || "";
      if (!fim) return;
      if (ini && fim < ini) return toast("O encerramento precisa ser depois do início da sprint.");
      d.close();
      sprGravar(g, sp, null, { ini, fim });
      toast(`Sprint ${p2(sp)} encerrada em ${fmtD(fim)}.`);
    };
    if (!d.open) d.showModal();
    f.fim.focus();
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest && e.target.closest("[data-sprini],[data-spred],[data-sprfim],[data-sprreab]");
    if (!b) return;
    if (b.dataset.sprini) {
      const [g, sp] = b.dataset.sprini.split("|");
      return sprJanela(g, sp, "iniciar");
    }
    if (b.dataset.spred) {
      const [g, sp] = b.dataset.spred.split("|");
      return sprJanela(g, sp, "editar");
    }
    if (b.dataset.sprfim) {
      const [g, sp, n] = b.dataset.sprfim.split("|");
      return sprEncerrar(g, sp, n);
    }
    const [g, sp] = b.dataset.sprreab.split("|");
    if (!(await askConfirm(`Reabrir a Sprint ${p2(sp)}? A data de encerramento é removida.`, "Reabrir"))) return;
    const st = sprEst(g, sp);
    sprGravar(g, sp, null, st.ini ? { ini: st.ini } : null);
  });
  // datas da sprint: gravadas no projeto; o período da fase e as predecessoras que dependem dela são recalculados
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("[data-sprd]"))) return;
    const [g, sp, k] = t.dataset.sprd.split("|");
    const N = JSON.parse(JSON.stringify(cfg.sprintDatas || {}));
    N[g] = N[g] || {};
    const x = (N[g][sp] || ["", ""]).slice();
    x[+k] = t.value || "";
    if (x[0] && x[1] && x[1] < x[0]) {
      toast("O fim da sprint precisa ser depois do início.");
      t.value = (((cfg.sprintDatas || {})[g] || {})[sp] || [])[+k] || "";
      return;
    }
    if (x[0] || x[1]) N[g][sp] = x;
    else delete N[g][sp];
    cfg.sprintDatas = N;
    saveCfg();
    afterG3();
    render();
  });
  // nome da sprint salvo ao sair do campo
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("[data-sprn]"))) return;
    const [g, sp] = t.dataset.sprn.split("|");
    const N = JSON.parse(JSON.stringify(cfg.sprintNomes || {}));
    N[g] = N[g] || {};
    const v = t.value.trim().replace(/\s+/g, " ");
    if (v) N[g][sp] = v;
    else delete N[g][sp];
    cfg.sprintNomes = N;
    saveCfg();
  });
  /* níveis do cronograma: etapa › grupo › subgrupo › subgrupo › atividade (5 níveis).
     O grupo fica em "bloco" e os subgrupos em "sub" (lista, até 2). */
  const MAXG = 3;
  const subOf = (i) => (Array.isArray(i && i.sub) ? i.sub.filter((x) => x) : []);
  const gPath = (i) => (i && i.bloco ? [i.bloco, ...subOf(i)].slice(0, MAXG) : []);
  const setPath = (P) => ({ bloco: P[0] || "", sub: P.slice(1, MAXG) });
  // dentro do ponto: subgrupos da atividade ("psub"); o ponto conta como um nível
  const psubOf = (i) => (i && i.ponto && Array.isArray(i.psub) ? i.psub.filter((x) => x) : []);
  const samePath = (a, b) => a.length === b.length && a.every((x, k) => x === b[k]);
  const prefixo = (P, Q) => Q.length <= P.length && Q.every((x, k) => x === P[k]);
  const gruposDe = (n, key) => (n.bloco ? [key, ...n.pts.flatMap((pt, m) => (pt.bloco ? gruposDe(pt, key + "s" + (m + 1)) : []))] : []);
  /* ordem da etapa: pacote e sequência; depois de reordenar por arraste, vale o campo "ord" das
     atividades. Atividade nova sem "ord" fica logo depois da anterior (pacote/sequência) ou, se for de
     um pacote novo, no fim da etapa */
  const temOrd = (i) => i.ord != null && i.ord !== "" && isFinite(+i.ord);
  function ordenarG3(list) {
    const base = list
      .slice()
      .sort(
        (a, b) =>
          (+a.faseNum || 0) - (+b.faseNum || 0) ||
          (+a.pacoteNum || 0) - (+b.pacoteNum || 0) ||
          (+a.seq || 0) - (+b.seq || 0),
      );
    const L = [];
    let f0 = null,
      G = [];
    const fecha = () => {
      if (G.some(temOrd)) {
        const O = G.filter(temOrd);
        const maxO = Math.max(...O.map((i) => +i.ord)),
          maxP = Math.max(...O.map((i) => +i.pacoteNum || 0));
        let ult = -Infinity,
          k = 0;
        const ef = new Map();
        G.forEach((i, n) => {
          if (temOrd(i)) {
            ult = +i.ord;
            k = 0;
          } else k++;
          ef.set(i, temOrd(i) ? ult : (+i.pacoteNum || 0) > maxP ? maxO + 1 + n * 1e-6 : ult + k * 1e-6);
        });
        G = G.map((i, n) => [i, n])
          .sort((a, b) => ef.get(a[0]) - ef.get(b[0]) || a[1] - b[1])
          .map((x) => x[0]);
      }
      L.push(...G);
      G = [];
    };
    base.forEach((i) => {
      if (+i.faseNum !== f0) {
        fecha();
        f0 = +i.faseNum;
      }
      G.push(i);
    });
    fecha();
    return L;
  }
  function wbs(list) {
    const L = ordenarG3(ofG(3, list));
    const num = new Map(),
      code = new Map(),
      byFase = new Map(),
      tree = new Map();
    L.forEach((i) => {
      const f = +i.faseNum || 0;
      if (!tree.has(f)) tree.set(f, []);
      const T = tree.get(f);
      if (i.ponto) {
        let n = T.find((x) => x.ponto === +i.pacoteNum);
        if (!n) {
          n = { ponto: +i.pacoteNum, nome: i.pacoteNome, items: [] };
          T.push(n);
        }
        n.items.push(i);
      } else T.push({ item: i });
    });
    /* blocos de pontos (ex.: "Pontos de cercamento eletrônico" e "Pontos de videomonitoramento"):
       nível entre a etapa e os pontos, só quando a etapa tem dois ou mais blocos */
    const top = new Map();
    tree.forEach((T, f) => {
      const U = [];
      T.forEach((n) => {
        const P = gPath(n.item || n.items[0]);
        if (!P.length) return U.push(n);
        // desce pelos grupos do caminho (grupo › subgrupo › subgrupo), criando os que faltam
        let lista = U,
          g = null;
        P.forEach((nome, d) => {
          let x = lista.find((y) => y.bloco === nome);
          if (!x) lista.push((x = { bloco: nome, pts: [], path: P.slice(0, d + 1) }));
          g = x;
          lista = x.pts;
        });
        // atividade com o mesmo nome do grupo é o próprio grupo (resumo): não vira linha filha
        if (n.item && !g.head && normNome(n.item.titulo) === normNome(g.bloco)) g.head = n.item;
        else g.pts.push(n);
        n.blk = g;
      });
      // grupo que ficou só com a atividade-resumo volta a ser uma atividade comum
      const fix = (L) =>
        L.map((n) => {
          if (!n.bloco) return n;
          n.pts = fix(n.pts);
          return n.head && !n.pts.length ? { item: n.head } : n;
        });
      top.set(f, fix(U));
    });
    // atividades do ponto em árvore (subgrupos "psub"); n.items continua com todas, em ordem
    const arvPt = (items) => {
      const U = [];
      items.forEach((i) => {
        const P = psubOf(i);
        let lista = U,
          g = null;
        P.forEach((nome, d) => {
          let x = lista.find((y) => y.bloco === nome);
          if (!x) lista.push((x = { bloco: nome, pts: [], path: P.slice(0, d + 1) }));
          g = x;
          lista = x.pts;
        });
        if (g && !g.head && normNome(i.titulo) === normNome(g.bloco)) g.head = i;
        else (g ? g.pts : U).push({ item: i });
      });
      const fix = (L) =>
        L.map((n) => {
          if (!n.bloco) return n;
          n.pts = fix(n.pts);
          return n.head && !n.pts.length ? { item: n.head } : n;
        });
      return fix(U);
    };
    const ptNum = (n, nn, flat) => {
      n.num = nn;
      n.kids = arvPt(n.items);
      n.kids.forEach((k, m) => {
        const c = nn + "." + (m + 1);
        if (k.item) {
          num.set(k.item.id, c);
          flat.push(k.item);
        } else grpNum(k, c, flat);
      });
    };
    const grpNum = (n, nn, flat) => {
      n.num = nn;
      if (n.head) {
        num.set(n.head.id, nn);
        flat.push(n.head);
      }
      n.pts.forEach((pt, m) => {
        const c = nn + "." + (m + 1);
        if (pt.item) {
          num.set(pt.item.id, c);
          flat.push(pt.item);
        } else if (pt.bloco) grpNum(pt, c, flat);
        else ptNum(pt, c, flat);
      });
      n.items = (n.head ? [n.head] : []).concat(n.pts.flatMap((pt) => (pt.item ? [pt.item] : pt.items)));
    };
    top.forEach((U, f) => {
      const flat = [];
      U.forEach((n, k) => {
        const nn = f + "." + (k + 1);
        if (n.item) {
          num.set(n.item.id, nn);
          flat.push(n.item);
        } else if (n.bloco) grpNum(n, nn, flat);
        else ptNum(n, nn, flat);
      });
      byFase.set(f, flat);
    });
    L.forEach((i) => {
      if (i.codigo && num.has(i.id)) code.set(i.codigo, num.get(i.id));
    });
    return { num, code, byFase, tree, top };
  }
  function rollPct(ch) {
    const { w, W } = wfun(ch);
    return W
      ? ch.reduce((s, i) => s + (w(i) * pctFromDates(i)) / 100, 0) / W
      : 0;
  }
  const STX = (pct) =>
    pct >= 1
      ? ["c", "Concluído"]
      : pct > 0
        ? ["a", "Em andamento"]
        : ["n", "Não iniciado"];
  const stCell = (st) => `<span class="stt s-${st[0]}"><i></i>${st[1]}</span>`;
  const pctCell = (v) =>
    `<span class="pcell"><span class="pbar"><b style="width:${Math.max(0, Math.min(100, v))}%"></b></span><span class="pv">${fmtN(v)}%</span></span>`;
  const PENCIL = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.6 12l-2.8.8.8-2.8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  const CKEY = "pmo-hibrido-recolhidos";
  let collapsed = (() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CKEY) || "[]"));
    } catch (e) {
      return new Set();
    }
  })();
  function saveCollapsed() {
    try {
      localStorage.setItem(CKEY, JSON.stringify([...collapsed]));
    } catch (e) {}
  }
  const tgBtn = (k) =>
    `<button class="tg" data-tg="${k}" aria-expanded="${!collapsed.has(k)}" aria-label="${collapsed.has(k) ? "Expandir" : "Recolher"}"><svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  const RISK = {
    g: ["Baixo", "var(--ok)"],
    y: ["Atenção", "#E0A458"],
    r: ["Alto", "var(--alert)"],
  };
  function riskAuto(ch) {
    const c = corte();
    const t = dt(c).getTime();
    if (!ch.length) return ["g", "sem atividades"];
    const pct = rollPct(ch);
    if (pct >= 1) return ["g", "concluída"];
    const late = ch.filter((i) => rF(i) && rF(i) < c && !i.fimReal).length;
    if (late)
      return [
        "r",
        `${late} atividade${late > 1 ? "s" : ""} com término vencido`,
      ];
    const plan = physPlan(t, true, ch);
    if (plan > 0 && pct / plan < 0.9)
      return ["y", `avanço ${fmtPct(pct)} abaixo do planejado ${fmtPct(plan)}`];
    const ns = ch.filter((i) => rI(i) && rI(i) < c && !i.inicioReal).length;
    if (ns)
      return ["y", `${ns} atividade${ns > 1 ? "s" : ""} sem início realizado`];
    const rf = ch.map(rF).filter(Boolean).sort().pop();
    if (rf && pct < 1 && (dt(rf) - t) / DAY <= 7 && pct < 0.5)
      return ["y", "término planejado em até 7 dias"];
    return ["g", "dentro do planejado"];
  }
  function riskCell(key, ch) {
    if (!key) return `<td class="rkc"></td>`;
    const m = (cfg.riscoGrp || {})[key];
    const a = riskAuto(ch);
    const lv = m && RISK[m] ? m : a[0];
    const tip =
      m && RISK[m]
        ? `Risco ${RISK[lv][0].toLowerCase()} (manual). Automático: ${RISK[a[0]][0].toLowerCase()}, ${a[1]}.`
        : `Risco ${RISK[lv][0].toLowerCase()} (automático): ${a[1]}.`;
    return `<td class="rkc"><button class="rk ${m && RISK[m] ? "man" : ""}" data-rk="${key}" title="${esc(tip)}" aria-label="${esc(tip)}"><i style="background:${RISK[lv][1]}"></i></button></td>`;
  }
  function sumRow(cls, num, nome, ch, W, btn, key, ea) {
    const c = corte();
    const ri = ch.map(rI).filter(Boolean).sort()[0],
      rf = ch.map(rF).filter(Boolean).sort().pop();
    const ar = ch
        .map((i) => i.inicioReal)
        .filter(Boolean)
        .sort()[0],
      af =
        ch.length && ch.every((i) => i.fimReal)
          ? ch
              .map((i) => i.fimReal)
              .sort()
              .pop()
          : "";
    const resp = [
      ...new Set(
        ch
          .map((i) => i.resp)
          .filter(Boolean)
          .flatMap((x) => x.split(/\s*\/\s*/)),
      ),
    ].join(" / ");
    const late = rf && rf < c && !af;
    const pct = rollPct(ch);
    return `<tr class="${cls} ${late ? "late" : ""}"><td class="code">${key ? tgBtn(key) : `<span class="tgsp"></span>`}<span>${num}</span></td>${riskCell(key, ch)}
    <td class="ttl">${ea ? `<input class="ie ie-name" ${ea} value="${esc(nome)}" aria-label="Nome" spellcheck="false">` : esc(nome)}${late ? `<span class="sub"><em>atrasada</em></span>` : ""}</td>
    <td data-l="Status">${stCell(STX(pct))}</td>
    <td data-l="% real">${pctCell(pct * 100)}</td>
    <td data-l="Duração" class="dts" style="text-align:right">${(() => {
      const n = hasRevs() ? selRevN() : 0;
      const a = ch
          .map((i) => revDates(i, n)[0])
          .filter(Boolean)
          .sort()[0],
        b = ch
          .map((i) => revDates(i, n)[1])
          .filter(Boolean)
          .sort()
          .pop();
      return a && b
        ? diasUteis(a, b) + " d"
        : `<span class="mut">–</span>`;
    })()}</td>
    <td data-l="Planejado" class="dts">${(() => {
      const a = ch
          .map((i) => i.inicio)
          .filter(Boolean)
          .sort()[0],
        b = ch
          .map((i) => i.fim)
          .filter(Boolean)
          .sort()
          .pop();
      return a || b
        ? `${fmtD(a)} – ${fmtD(b)}`
        : `<span class="mut">sem datas</span>`;
    })()}</td>
    ${
      hasRevs()
        ? `<td data-l="Revisão ${revName(selRevN())}" class="dts">${(() => {
            const n = selRevN();
            const a = ch
                .map((i) => revDates(i, n)[0])
                .filter(Boolean)
                .sort()[0],
              b = ch
                .map((i) => revDates(i, n)[1])
                .filter(Boolean)
                .sort()
                .pop();
            return a || b
              ? `${fmtD(a)} – ${fmtD(b)}`
              : `<span class="mut">sem datas</span>`;
          })()}</td>`
        : ""
    }
    <td data-l="Realizado" class="dts">${ar ? (af ? `${fmtD(ar)} – ${fmtD(af)}` : `${fmtD(ar)} – <span class="mut">em curso</span>`) : `<span class="mut">–</span>`}</td>
    <td class="pred" data-l="Predecessora">${
      key && key !== "proj"
        ? (() => {
            const gp = (cfg.predGrp || {})[key] || {};
            return `<input class="ie ie-pred" data-gpred="${key}" value="${gp.pred ? predTxt(gp.pred, W) + (gp.predTipo && gp.predTipo !== "TI" ? " " + esc(gp.predTipo) : "") : ""}" placeholder="–" aria-label="Predecessora" spellcheck="false" title="Predecessora desta etapa/grupo: nenhuma atividade de dentro começa antes dela (quem tem predecessora própria segue a que der a data mais tarde). Ex.: 2, 1.3, G2-S04-T01 +7d. Ctrl + clique abre a predecessora.">`;
          })()
        : ""
    }</td>
    <td class="obsc" data-l="Observação">${key ? `<textarea class="obs" rows="1" data-obsg="${key}" aria-label="Observação" placeholder="Observação">${esc((cfg.obsGrp || {})[key] || "")}</textarea>` : ""}</td>
    <td class="c-act">${btn || ""}</td></tr>`;
  }
  // alça de reordenar (⋮⋮): np = caminho do item na árvore da etapa
  const mvTravado = () => hasRevs() && selRevN() < cronRevs().length;
  const gripMv = (np) =>
    mvTravado()
      ? `<span class="grip off" data-mvg="${np}" title="Revisão congelada: volte para a revisão vigente para reordenar" aria-label="Reordenar indisponível">⋮⋮</span>`
      : `<span class="grip" data-mvg="${np}" title="Clique, segure e arraste para reordenar (o que está dentro acompanha)" aria-label="Arrastar para reordenar">⋮⋮</span>`;
  const comNp = (html, np) => html.replace("<tr class=", `<tr data-np="${np}" class=`).replace('<td class="code">', `<td class="code">${gripMv(np)}`);
  function childRow(i, W, lvl, np) {
    const c = corte();
    const late = rF(i) && rF(i) < c && !i.fimReal;
    const hasRev =
      (i.inicioRev && i.inicioRev !== i.inicio) ||
      (i.fimRev && i.fimRev !== i.fim);
    const pc = pctFromDates(i);
    const alca = "";
    return `<tr${np ? ` data-np="${np}"` : ""} class="child l${Math.max(1, Math.min(5, lvl || 1))} ${late ? "late" : ""}"><td class="code">${np ? gripMv(np) : `<span class="tgsp"></span>`}<span>${W.num.get(i.id)}</span></td><td class="rkc"${alca}></td>
    <td class="ttl"><span class="tline">${i.marco ? `<i class="mk" title="Marco de medição"></i>` : ""}<input class="ie ie-name" data-et="${i.id}" value="${esc(i.titulo)}" title="${esc(i.titulo)}" aria-label="Atividade" spellcheck="false"></span><span class="sub">${esc(i.resp) || "Sem responsável"}${i.equipe ? ` · <span class="eqtag">${esc(i.equipe)}</span>` : ""}${late ? ` · <em>atrasada</em>` : ""}</span></td>
    <td data-l="Status"${alca}>${stCell(STX(pc / 100))}</td>
    <td data-l="% real"${alca}>${pctCell(pc)}</td>
    <td data-l="Duração" class="dur">${(() => {
      const n = hasRevs() ? cronRevs().length : 0;
      const d = revDates(i, n);
      const v =
        i.duracao !== "" && i.duracao != null && !isNaN(+i.duracao)
          ? +i.duracao
          : d[0] && d[1]
            ? diasUteis(d[0], d[1])
            : "";
      const ro = hasRevs() && selRevN() < cronRevs().length;
      return ro
        ? `${v === "" ? "–" : v + " d"}`
        : `<span class="durw"><input class="ie ie-dur" data-edur="${i.id}" inputmode="numeric" value="${v}" aria-label="Duração em dias úteis" title="Duração em dias úteis"><span class="mut">d</span></span>`;
    })()}</td>
    ${(() => {
      const lk = String(i.pred || "").trim() || predHerdada(i, W)
        ? ` readonly data-lock="${i.id}" class="dt locked"`
        : ` class="dt"`;
      const inp = (a, b) =>
        `<input type="date"${lk} value="${esc(a || "")}" data-ps="${i.id}" aria-label="Início planejado" title="Início"><input type="date"${lk} value="${esc(b || "")}" data-pf="${i.id}" aria-label="Fim planejado" title="Fim">`;
      if (!hasRevs())
        return `<td data-l="Planejado" class="real">${inp(i.inicio, i.fim)}</td>`;
      const n = selRevN(),
        L = cronRevs().length,
        d = revDates(i, n);
      const dif = d[0] !== i.inicio || d[1] !== i.fim;
      return `<td data-l="Planejado" class="dts">${i.inicio || i.fim ? `${fmtD(i.inicio)} – ${fmtD(i.fim)}` : `<span class="mut">sem datas</span>`}</td><td data-l="Revisão ${revName(n)}" class="${n === L ? "real" : "dts"}">${n === L ? inp(d[0], d[1]) : d[0] || d[1] ? `${fmtD(d[0])} – ${fmtD(d[1])}` : `<span class="mut">sem datas</span>`}${
        dif && d[1] && i.fim
          ? `<span class="sub revdif" style="color:${d[1] > i.fim ? "var(--alert)" : "var(--ok)"}">${(() => {
              const k = Math.round((dt(d[1]) - dt(i.fim)) / DAY);
              return k ? (k > 0 ? "+" : "") + k + " d x R00" : "";
            })()}</span>`
          : ""
      }</td>`;
    })()}
    <td data-l="Realizado" class="real"><input class="dt" type="date" value="${esc(i.inicioReal || "")}" data-ri="${i.id}" aria-label="Início realizado" title="Início realizado"><input class="dt" type="date" value="${esc(i.fimReal || "")}" data-rf="${i.id}" aria-label="Fim realizado" title="Fim realizado"></td>
    <td class="pred" data-l="Predecessora"><input class="ie ie-pred" data-epred="${i.id}" value="${i.pred ? predTxt(i.pred, W) + (i.predTipo && i.predTipo !== "TI" ? " " + esc(i.predTipo) : "") : ""}" placeholder="${(() => {
      const hp = !i.pred && predHerdada(i, W);
      return hp ? "↑ " + esc(predTxt(hp.pred, W)) : "–";
    })()}" aria-label="Predecessora" spellcheck="false" title="Nº EAP da predecessora. Ex.: 2.1, 3 (etapa inteira), 4.1 + 5.2, G2-S04-T01 (item de sprint). Folga em dias úteis no fim: +7d ou -2d. Sufixo II, TT ou IT muda o vínculo. Ctrl + clique abre a predecessora."></td>
    <td class="obsc" data-l="Observação"><textarea class="obs" rows="1" data-obs="${i.id}" aria-label="Observação" placeholder="Observação">${esc(i.obs || "")}</textarea></td>
    <td class="c-act"><span class="actsl">${addBtn(i.id)}<button class="ico" data-edit="${i.id}" title="Editar atividade" aria-label="Editar atividade">${PENCIL}</button></span>${estrBtn("ativ", i.id, W)}</td></tr>`;
  }
  function predTxt(p, W) {
    if (!p) return "–";
    W = W || wbs();
    return esc(
      String(p)
        .replace(/G3-F\d+-P\d+-A\d+/g, (x) => W.code.get(x) || x)
        .replace(/G3-F0*(\d+)\s*\(todas\)/g, "$1")
        .replace(/G3-F0*(\d+)(?![\d-])/g, "$1"),
    );
  }
  const idG3 = (i) => {
    const n = wbs().num.get(i.id);
    return n || i.codigo;
  };
  function viewWF() {
    const m = metWF();
    const ptF = ptFases();
    const nPt = ptF.length ? Math.max(...ptF.map((x) => x.pts.length)) : 0;
    let h = "";
    if (!m.L.length)
      return (
        h +
        `<div class="empty"><p>Nenhuma atividade de execução cadastrada.</p><button class="btn primary" data-add="3">Adicionar a primeira atividade</button></div>`
      );
    const W = wbs();
    const c = corte();
    let rows = "";
    const allCh = fasesWF().flatMap((f) => W.byFase.get(f.num) || []);
    rows += sumRow(
      "proj",
      "0",
      cfg.nome && cfg.nome !== "Projeto sem nome"
        ? cfg.nome
        : "Visão geral do projeto",
      allCh,
      W,
      "",
      "proj",
      `data-eproj="1"`,
    );
    if (!collapsed.has("proj"))
      fasesWF().forEach((f) => {
        const ch = W.byFase.get(f.num) || [];
        const nm = (f.nome || "").replace(/^Frente\s*\d+\s*[·\-–]\s*/i, "");
        const T = W.tree.get(f.num) || [];
        const hasPt = T.some((n) => n.ponto);
        const fk = "f" + f.num;
        const hasSC = ch.some((i) => i.sc);
        rows += comNp(sumRow(
          "parent",
          f.num,
          nm,
          ch,
          W,
          (hasPt
            ? `<button class="ico" data-pontos="${f.num}" title="Definir número de pontos" aria-label="Definir número de pontos"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`
            : hasSC
              ? `<button class="ico" data-newsc="${f.num}" title="Nova solicitação de compra" aria-label="Nova solicitação de compra"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`
              : "") + estrBtn("etapa", f.num, W),
          fk,
          `data-ef="${f.num}"`,
        ), fk);
        if (collapsed.has(fk)) return;
        const ptRow = (n, nv, np) => {
          const pk = fk + "p" + n.ponto;
          rows += comNp(sumRow(
            nv ? "pt l" + (nv + 1) : "pt",
            n.num,
            n.nome || "Ponto " + p2(n.ponto),
            n.items,
            W,
            `<span class="actsl">${addBtn(n.items[n.items.length - 1].id, "Inserir atividade no fim deste ponto")}</span>` + estrBtn("ponto", f.num + "|" + n.ponto, W),
            pk,
            `data-ep="${f.num}:${n.ponto}"`,
          ), np);
          if (!collapsed.has(pk))
            n.kids.forEach((k, m) => (k.item ? (rows += childRow(k.item, W, nv ? nv + 2 : 2, np + "." + m)) : grpRow(k, pk + "s" + (m + 1), (nv || 0) + 1, n, np + "." + m)));
        };
        // grupo (nível d = 0) e subgrupos (d = 1, 2), cada um recolhível; pt = ponto, quando é subgrupo dentro dele
        const grpRow = (n, key, d, pt, np) => {
          rows += comNp(sumRow(
            "pt blk" + (d ? " l" + (d + 1) : ""),
            n.num,
            n.bloco,
            n.items,
            W,
            `<span class="actsl">${addBtn(n.items[n.items.length - 1].id, "Inserir atividade no fim deste grupo")}</span>` +
              (pt ? estrBtn("pgrupo", f.num + "|" + pt.ponto + "|" + JSON.stringify(n.path), W) : estrBtn("grupo", f.num + "|" + JSON.stringify(n.path), W)),
            key,
            `data-eg="${esc(f.num + "|" + (pt ? pt.ponto : "") + "|" + JSON.stringify(n.path))}"`,
          ), np);
          if (collapsed.has(key)) return;
          n.pts.forEach((x, m) =>
            x.item ? (rows += childRow(x.item, W, d + 2, np + "." + m)) : x.bloco ? grpRow(x, key + "s" + (m + 1), d + 1, pt, np + "." + m) : ptRow(x, d + 1, np + "." + m),
          );
        };
        (W.top.get(f.num) || T).forEach((n, k) => {
          const np = fk + ":" + k;
          if (n.item) rows += childRow(n.item, W, 1, np);
          else if (n.bloco) grpRow(n, fk + "b" + (k + 1), 0, undefined, np);
          else ptRow(n, 0, np);
        });
      });
    const RV = hasRevs();
    const nS = selRevN();
    return (
      h +
      `<div class="tw"><table class="crono"><colgroup><col class="c-eap" style="width:72px"><col class="c-rk" style="width:54px"><col class="c-ttl"><col class="c-st" style="width:136px"><col class="c-pc" style="width:100px"><col class="c-du" style="width:64px">${RV ? `<col class="c-pl" style="width:146px"><col class="c-rv" style="width:${nS === cronRevs().length ? 222 : 146}px">` : `<col class="c-pl" style="width:222px">`}<col class="c-re" style="width:222px"><col class="c-pr" style="width:92px"><col class="c-ob" style="width:${RV ? 9 : 10}%"><col class="c-ac" style="width:64px"></colgroup><thead><tr><th>EAP</th><th title="Sinaleiro de risco da etapa" style="text-align:center;padding-left:4px;padding-right:4px">Risco</th><th>Etapa / atividade</th><th>Status</th><th>% real</th><th style="text-align:right">Dur.</th><th>Planejado${RV ? " R00" : ""}</th>${RV ? `<th>Revisão ${revName(nS)}${nS === cronRevs().length ? "" : " (congelada)"}</th>` : ""}<th>Realizado (início · fim)</th><th>Predec.</th><th>Observação</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
    );
  }

  /* ---------- Códigos ---------- */
  function faseNumFor(nome, extra) {
    const L = ofG(3).concat(extra || []);
    const f = L.find(
      (i) =>
        (i.faseNome || "").trim().toLowerCase() === nome.trim().toLowerCase(),
    );
    if (f) return +f.faseNum;
    return L.reduce((m, i) => Math.max(m, +i.faseNum || 0), 0) + 1;
  }
  function pacoteNumFor(fn, nome, extra) {
    const L = ofG(3)
      .concat(extra || [])
      .filter((i) => +i.faseNum === fn);
    const f = L.find(
      (i) =>
        (i.pacoteNome || "").trim().toLowerCase() === nome.trim().toLowerCase(),
    );
    if (f) return +f.pacoteNum;
    return L.reduce((m, i) => Math.max(m, +i.pacoteNum || 0), 0) + 1;
  }
  function addDays(s, n) {
    const d = dt(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  /* Dias úteis: segunda a sexta, exceto feriados nacionais (base físico-financeira da DGT).
     O cronograma conta durações em dias úteis e não planeja atividades em fins de semana/feriados. */
  const FERIADOS = new Set([
    "2026-01-01", "2026-04-03", "2026-04-21", "2026-05-01", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-25",
    "2027-01-01", "2027-03-26", "2027-04-21", "2027-05-01", "2027-09-07", "2027-10-12", "2027-11-02", "2027-11-15", "2027-11-20", "2027-12-25",
    "2028-01-01", "2028-04-14", "2028-04-21", "2028-05-01", "2028-09-07", "2028-10-12", "2028-11-02", "2028-11-15", "2028-11-20", "2028-12-25",
  ]);
  const diaUtil = (s) => {
    const w = dt(s).getDay();
    return w !== 0 && w !== 6 && !FERIADOS.has(s);
  };
  const proxUtil = (s) => {
    while (s && !diaUtil(s)) s = addDays(s, 1);
    return s;
  };
  const antUtil = (s) => {
    while (s && !diaUtil(s)) s = addDays(s, -1);
    return s;
  };
  /* anda n dias úteis a partir de s (n negativo volta) */
  function addUteis(s, n) {
    let d = s,
      k = Math.abs(n);
    const passo = n < 0 ? -1 : 1;
    while (k > 0) {
      d = addDays(d, passo);
      if (diaUtil(d)) k--;
    }
    return d;
  }
  /* fim de uma atividade de d dias úteis que começa em a (marco: d = 0, fim = início) */
  const fimUtil = (a, d) => (d === 0 ? a : addUteis(proxUtil(a), d - 1));
  /* dias úteis entre a e b, inclusive */
  function diasUteis(a, b) {
    if (!a || !b || b < a) return 0;
    let n = 0;
    for (let d = a; d <= b; d = addDays(d, 1)) if (diaUtil(d)) n++;
    return n;
  }
  function normDates(it) {
    if (it.inicio && !it.fim && it.duracao !== "" && it.duracao != null)
      it.fim = fimUtil(it.inicio, Math.max(0, +it.duracao || 0));
    if (it.inicio && it.fim && (it.duracao === "" || it.duracao == null))
      it.duracao = Math.max(1, diasUteis(it.inicio, it.fim));
    if (it.fim && it.inicio && it.fim < it.inicio) it.fim = it.inicio;
    if (it.fimRev && it.inicioRev && it.fimRev < it.inicioRev)
      it.fimRev = it.inicioRev;
  }
  function assignCode(it, extra) {
    const pool = S.itens.concat(extra || []).filter((x) => x.id !== it.id);
    if (+it.grupo === 3) {
      const same = pool.filter(
        (x) =>
          +x.grupo === 3 &&
          +x.faseNum === +it.faseNum &&
          +x.pacoteNum === +it.pacoteNum,
      );
      it.seq = same.reduce((m, x) => Math.max(m, +x.seq || 0), 0) + 1;
      it.codigo = `G3-F${p2(it.faseNum)}-P${p2(it.pacoteNum)}-A${p2(it.seq)}`;
    } else {
      const same = pool.filter(
        (x) => +x.grupo === +it.grupo && (+x.sprint || 1) === (+it.sprint || 1),
      );
      it.seq = same.reduce((m, x) => Math.max(m, +x.seq || 0), 0) + 1;
      it.codigo = `G${it.grupo}-S${p2(it.sprint || 1)}-T${p2(it.seq)}`;
    }
  }

  /* ---------- Formulários ---------- */
  function openForm(g, id) {
    const it = id ? S.itens.find((x) => x.id === id) : null;
    const v = (k) => (it && it[k] != null ? esc(it[k]) : "");
    /* etapas (1, 2, 3…) e pacotes (1.1, 1.2, 2.1…) existentes no cronograma, para as listas suspensas */
    const L3 = ofG(3);
    const etapas = new Map();
    L3.forEach((i) => {
      const fn = +i.faseNum || 0;
      if (!etapas.has(fn)) etapas.set(fn, { nome: i.faseNome || "", pacs: new Map() });
      const P = etapas.get(fn).pacs;
      if (!P.has(+i.pacoteNum || 0)) P.set(+i.pacoteNum || 0, i.pacoteNome || "");
    });
    const ETS = [...etapas.entries()].sort((a, b) => a[0] - b[0]);
    const semPrefixo = (n) => String(n || "").replace(/^(Frente|Fase|Etapa)\s*\d+\s*·\s*/i, "");
    const etapaOpts = () =>
      ETS.map(
        ([n, e]) =>
          `<option value="${n}" ${it && +it.faseNum === n ? "selected" : ""}>${n} · ${esc(semPrefixo(e.nome))}</option>`,
      ).join("") + `<option value="nova">+ Nova etapa…</option>`;
    const pacoteOpts = (fn) => {
      const e = etapas.get(+fn);
      return (
        (e ? [...e.pacs.entries()].sort((a, b) => a[0] - b[0]) : [])
          .map(
            ([n, nome]) =>
              `<option value="${n}" ${it && +it.faseNum === +fn && +it.pacoteNum === n ? "selected" : ""}>${fn}.${n} · ${esc(nome)}</option>`,
          )
          .join("") + `<option value="novo">+ Novo pacote…</option>`
      );
    };
    const fase0 = it ? +it.faseNum : ETS.length ? ETS[ETS.length - 1][0] : "nova";
    const lastSprint =
      ofG(g).reduce((m, i) => Math.max(m, +i.sprint || 0), 0) || 1;
    let f = `<h3>${it ? "Editar" : "Nova"} ${g === 3 ? "atividade" : "item"} · G${g} ${GRUPOS[g].nome}</h3><div class="fgrid">`;
    if (g === 3) {
      // formulário em blocos: onde fica, atividade, dependência, planejado, revisão (só com revisão) e realizado
      const comPred = !!(it && String(it.pred || "").trim());
      const TIPOS = { TI: "Término → início", II: "Início → início", TT: "Término → término", IT: "Início → término" };
      f += `<h4 class="fsec">Onde fica</h4>
      <label>Etapa<select name="faseSel" id="fSel">${etapaOpts()}</select></label>
      <label>Pacote de trabalho<select name="pacSel" id="pSel"></select></label>
      <label id="fNovaL" hidden>Nome da nova etapa<input name="faseNova" id="fNova" placeholder="Ex.: Vistoria técnica"></label>
      <label id="pNovoL" hidden>Nome do novo pacote<input name="pacNovo" id="pNovo" placeholder="Ex.: Levantamento de campo"></label>
      <h4 class="fsec">Atividade</h4>
      <label class="fwide">Nome<span class="eapauto" id="eapAuto"></span><input name="titulo" required value="${v("titulo")}" placeholder="Somente o nome; o nº da EAP é calculado"></label>
      <label>Responsável<input name="resp" value="${v("resp")}"></label>
      <label>Equipe de campo<select name="equipe"><option value="">Sem equipe</option>${equipesCampo().concat(it && it.equipe && !equipesCampo().includes(it.equipe) ? [it.equipe] : []).map((t) => `<option ${it && it.equipe === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
      <h4 class="fsec">Dependência</h4>
      <label>Predecessora<input name="pred" value="${v("pred")}" placeholder="Ex.: 2.1 · 4.1 + 5.2 · G2-S04-T01 +7d"></label>
      <label>Tipo de vínculo<select name="predTipo">${Object.entries(TIPOS).map(([t, l]) => `<option value="${t}" ${(it && it.predTipo ? it.predTipo : "TI") === t ? "selected" : ""}>${t} · ${l}</option>`).join("")}</select></label>
      <p class="hint fwide fdica">Nº da EAP (2.1), etapa inteira (3) ou item de sprint (G2-S04-T01). Folga em dias úteis no fim: +7d ou -2d.</p>
      <h4 class="fsec">Planejado${hasRevs() ? " (baseline)" : ""}</h4>
      <label>Duração (dias úteis)<input name="duracao" type="number" min="0" value="${v("duracao")}"></label>
      <label>Início<input name="inicio" type="date" value="${v("inicio")}"></label>
      <label>Fim<input name="fim" type="date" value="${v("fim")}"></label>
      ${comPred ? `<p class="hint fwide fdica">Com predecessora, início e fim são calculados pela predecessora e pela duração (dias úteis, sem fins de semana e feriados).</p>` : ""}
      ${hasRevs() ? `<h4 class="fsec">Revisão vigente</h4>
      <label>Início<input name="inicioRev" type="date" value="${v("inicioRev")}"></label>
      <label>Fim<input name="fimRev" type="date" value="${v("fimRev")}"></label>
      <p class="hint fwide fdica">Altere somente com mudança aprovada; em branco, segue o planejado. A baseline não se regrava por atraso.</p>` : ""}
      <h4 class="fsec">Realizado</h4>
      <label>Início<input name="inicioReal" type="date" value="${v("inicioReal")}"></label>
      <label>Fim<input name="fimReal" type="date" value="${v("fimReal")}"></label>`;
    } else {
      f += `<label>Sprint<input name="sprint" type="number" min="1" required value="${it ? +it.sprint || 1 : lastSprint}"></label>
      <label>Responsável<input name="resp" value="${v("resp")}"></label>
      <label>Esforço (pts ou h)<input name="esforco" type="number" min="0" step="0.5" value="${v("esforco")}"></label>
      ${g === 4 ? "" : `<label>Conclusão prevista (prazo)<input name="fim" type="date" value="${v("fim")}"></label>`}
      <label>Status<select name="status">${Object.entries(stOpts(g))
        .map(
          ([k, l]) =>
            `<option value="${k}" ${it && stG(g, it.status) === k ? "selected" : ""}>${l}</option>`,
        )
        .join("")}</select></label>
      <label class="fwide">Item / atividade<input name="titulo" required value="${v("titulo")}"></label>
      <label class="fwide">Critério de aceite (DoD)<input name="dod" value="${v("dod")}"></label>
      <label class="fwide">Dependência<input name="dep" value="${v("dep")}"></label>`;
    }
    f += `</div>
  <div class="actions">${it ? `<button type="button" class="btn danger" id="btnDel" style="margin-right:auto">Excluir</button>` : ""}<button type="button" class="btn" id="btnCancel">Cancelar</button><button class="btn primary" type="submit">${it ? "Salvar alterações" : "Adicionar"}</button></div>`;
    const form = $("#formItem");
    form.innerHTML = f;
    if (g === 3) {
      const fSel = $("#fSel"), pSel = $("#pSel");
      fSel.value = String(fase0);
      /* nº da EAP que a atividade vai receber (pronta: o atual; nova: próximo do pacote) */
      const eap = () => {
        const fn = fSel.value === "nova" ? ETS.reduce((m, x) => Math.max(m, x[0]), 0) + 1 : +fSel.value;
        const e = etapas.get(fn);
        const pn = pSel.value === "novo" ? (e ? Math.max(0, ...e.pacs.keys()) : 0) + 1 : +pSel.value;
        const mesmo = it && +it.faseNum === fn && +it.pacoteNum === pn;
        const tmp = Object.assign({}, it || {}, { id: "__eap", grupo: 3, faseNum: fn, pacoteNum: pn, seq: mesmo ? it.seq : 1e6 });
        const n = wbs(S.itens.filter((x) => !it || x.id !== it.id).concat(tmp)).num.get("__eap");
        $("#eapAuto").textContent = `Nº EAP ${n || fn + ".1"}${mesmo ? "" : " (calculado ao salvar)"}`;
      };
      const sincPac = () => {
        $("#fNovaL").hidden = fSel.value !== "nova";
        $("#fNova").required = fSel.value === "nova";
        pSel.innerHTML = fSel.value === "nova" ? `<option value="novo">+ Novo pacote…</option>` : pacoteOpts(fSel.value);
        if (!it || String(it.faseNum) !== fSel.value) {
          const o = pSel.querySelectorAll("option");
          pSel.value = o.length > 1 ? o[o.length - 2].value : "novo";
        }
        sincNovo();
      };
      const sincNovo = () => {
        $("#pNovoL").hidden = pSel.value !== "novo";
        $("#pNovo").required = pSel.value === "novo";
        eap();
      };
      fSel.onchange = sincPac;
      pSel.onchange = sincNovo;
      sincPac();
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const base = it
        ? Object.assign({}, it)
        : { id: uid(), grupo: g, ordem: Date.now() };
      if (g === 3) {
        let fn, faseNome, pn, pacoteNome;
        if (d.faseSel === "nova") {
          fn = ETS.reduce((m, x) => Math.max(m, x[0]), 0) + 1;
          const comPrefixo = ETS.some(([, e]) => /^Frente\s*\d+\s*·/i.test(e.nome));
          faseNome = (comPrefixo ? `Frente ${p2(fn)} · ` : "") + d.faseNova.trim();
        } else {
          fn = +d.faseSel;
          faseNome = etapas.get(fn).nome;
        }
        if (d.pacSel === "novo") {
          const e = etapas.get(fn);
          pn = (e ? Math.max(0, ...e.pacs.keys()) : 0) + 1;
          pacoteNome = d.pacNovo.trim();
        } else {
          pn = +d.pacSel;
          pacoteNome = etapas.get(fn).pacs.get(pn);
        }
        const moved = !it || +it.faseNum !== fn || +it.pacoteNum !== pn;
        Object.assign(base, {
          faseNome,
          pacoteNome,
          faseNum: fn,
          pacoteNum: pn,
          titulo: d.titulo.trim(),
          pred: d.pred.trim(),
          predTipo: d.pred.trim() ? d.predTipo : "",
          duracao: d.duracao === "" ? "" : +d.duracao,
          inicio: d.inicio,
          fim: d.fim,
          inicioRev: hasRevs() ? d.inicioRev : base.inicioRev || "",
          fimRev: hasRevs() ? d.fimRev : base.fimRev || "",
          resp: d.resp.trim(),
          equipe: d.equipe || "",
          peso: base.peso == null ? "" : base.peso, // automático pela duração (normWeights)
          inicioReal: d.inicioReal,
          fimReal:
            d.fimReal && d.inicioReal && d.fimReal < d.inicioReal
              ? d.inicioReal
              : d.fimReal,
          marco: !!base.marco,
          valor: base.valor == null ? "" : base.valor,
        });
        // início realizado apagado pelo usuário apaga também o fim (antes o fim recolocava o início)
        if (it && it.inicioReal && !base.inicioReal) base.fimReal = "";
        if (base.fimReal && !base.inicioReal) base.inicioReal = base.fimReal;
        normDates(base);
        if (moved) assignCode(base);
      } else {
        const moved = !it || (+it.sprint || 1) !== (+d.sprint || 1);
        Object.assign(base, {
          sprint: +d.sprint || 1,
          resp: d.resp.trim(),
          esforco: d.esforco === "" ? "" : +d.esforco,
          status: d.status,
          titulo: d.titulo.trim(),
          dod: d.dod.trim(),
          dep: d.dep.trim(),
        });
        if ("fim" in d) base.fim = d.fim || "";
        if (moved) assignCode(base);
      }
      $("#dlgItem").close();
      putItem(base);
    };
    $("#btnCancel").onclick = () => $("#dlgItem").close();
    const bd = $("#btnDel");
    if (bd)
      bd.onclick = () => {
        askConfirm(
          `Excluir “${it.titulo}”${+it.grupo === 3 ? " (" + idG3(it) + ")" : " (" + it.codigo + ")"}? Esta ação não pode ser desfeita.`,
        ).then((ok) => {
          if (!ok) return;
          $("#dlgItem").close();
          del("atividades", it.id);
          if (+it.grupo === 3) setTimeout(afterG3, 0);
        });
      };
    $("#dlgItem").showModal();
  }
  /* ---------- Estrutura: recuar/avançar nível e arrastar atividades ----------
     etapa = atividades com o mesmo faseNum; grupo = atividades com o mesmo "bloco" dentro da etapa
     (a atividade com o mesmo nome do grupo é o resumo dele); atividade = uma linha do cronograma.
     → avança um nível (entra no grupo de cima; etapa vira grupo da etapa anterior)
     ← recua um nível (sai do grupo; grupo vira etapa). */
  const NV_ICO = {
    in: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M9 5l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    out: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8H4M7 5 4 8l3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  /* setas de nível: "Rebaixar nível" (→, vira filha do item anterior do mesmo nível) e "Elevar nível"
     (←, sai do pai e fica logo depois dele). Sempre visíveis; desabilitadas com o motivo no tooltip. */
  const nvBtn = (dir, tipo, ref, pode) => {
    const nome = dir === "in" ? "Rebaixar nível" : "Elevar nível";
    const tip = pode === true ? nome : `${nome} · indisponível: ${pode}`;
    return `<button class="ico nv" data-nv="${dir}" data-tipo="${tipo}" data-ref="${esc(String(ref))}" title="${esc(tip)}" aria-label="${esc(tip)}"${pode === true ? "" : " disabled"}>${NV_ICO[dir]}</button>`;
  };
  // lista de irmãos (nós da wbs) dentro do caminho de grupos P da etapa fn
  function irmaos(W, fn, P) {
    let U = W.top.get(+fn) || [];
    for (const nome of P) {
      const g = U.find((n) => n.bloco === nome);
      if (!g) return [];
      U = g.pts;
    }
    return U;
  }
  const refGrupo = (ref) => {
    const p = ref.indexOf("|");
    return { fn: +ref.slice(0, p), GP: ref.slice(p + 1).startsWith("[") ? JSON.parse(ref.slice(p + 1)) : [ref.slice(p + 1)] };
  };
  const LIM = "o cronograma tem no máximo 5 níveis";
  // filhos (nós) dentro do ponto, no caminho de subgrupos Q
  function kidsDe(pt, Q) {
    let U = (pt && pt.kids) || [];
    for (const nome of Q) {
      const g = U.find((n) => n.bloco === nome);
      if (!g) return [];
      U = g.pts;
    }
    return U;
  }
  /* nome de grupo novo sem colidir com outro grupo do mesmo nível (grupos são identificados pelo
     nome): se já existir, recebe um complemento (ex.: o nome do ponto) ou um número */
  function nomeLivre(U, nome, extra) {
    const usado = (x) => U.some((n) => n.bloco === x);
    if (!usado(nome)) return nome;
    if (extra && !usado(nome + " · " + extra)) return nome + " · " + extra;
    for (let k = 2; ; k++) if (!usado(`${nome} (${k})`)) return `${nome} (${k})`;
  }
  const refPGrupo = (ref, W) => {
    const a = ref.indexOf("|"),
      b = ref.indexOf("|", a + 1);
    const fn = +ref.slice(0, a),
      pn = +ref.slice(a + 1, b);
    return { fn, pn, GP: JSON.parse(ref.slice(b + 1)), pt: ((W || wbs()).tree.get(fn) || []).find((n) => n.ponto === pn) };
  };
  // o que cada seta pode fazer agora (true) ou o motivo de não poder
  function nivelPode(tipo, ref, W) {
    W = W || wbs();
    const L3 = ofG(3);
    if (tipo === "ativ") {
      const it = L3.find((i) => i.id === ref);
      if (!it) return { in: "atividade não encontrada", out: "atividade não encontrada" };
      if (it.ponto) {
        // dentro do ponto: entra na atividade/subgrupo de cima; sai do subgrupo ou do ponto
        const pt = (W.tree.get(+it.faseNum) || []).find((n) => n.ponto === +it.pacoteNum);
        const Q = psubOf(it);
        const U = kidsDe(pt, Q);
        const k = U.findIndex((n) => n.item && n.item.id === it.id);
        const ant = k > 0 ? U[k - 1] : null;
        const g = gPath(it).length + 1;
        return {
          in: !ant ? "não há item anterior no mesmo nível" : (ant.bloco ? g + ant.path.length : g + Q.length + 1) > MAXG ? LIM : true,
          out: true,
        };
      }
      const P = gPath(it);
      const U = irmaos(W, it.faseNum, P);
      const k = U.findIndex((n) => (n.item && n.item.id === it.id) || (n.head && n.head.id === it.id));
      const ant = k > 0 ? U[k - 1] : null;
      return {
        in: !ant ? "não há item anterior no mesmo nível" : ant.ponto ? "o item anterior é um ponto" : !ant.bloco && P.length + 1 > MAXG ? LIM : true,
        out: P.length || L3.some((i) => +i.faseNum === +it.faseNum && i.id !== it.id) ? true : "a atividade é a única da etapa",
      };
    }
    if (tipo === "pgrupo") {
      const { fn, pn, GP, pt } = refPGrupo(ref, W);
      if (!pt) return { in: "ponto não encontrado", out: "ponto não encontrado" };
      const its = pt.items.filter((i) => prefixo(psubOf(i), GP));
      const prof = Math.max(1, ...its.map((i) => psubOf(i).length)) - GP.length + 1;
      const U = kidsDe(pt, GP.slice(0, -1));
      const k = U.findIndex((n) => n.bloco === GP[GP.length - 1]);
      const ant = k > 0 ? U[k - 1] : null;
      const g = gPath(pt.items[0]).length + 1;
      return {
        in: !ant ? "não há item anterior no mesmo nível" : (ant.bloco ? g + ant.path.length : g + GP.length) + prof > MAXG ? LIM : true,
        out: true,
      };
    }
    if (tipo === "ponto") {
      const [fn, pn] = String(ref).split("|").map(Number);
      const pt = (W.tree.get(fn) || []).find((n) => n.ponto === pn);
      if (!pt) return { in: "ponto não encontrado", out: "ponto não encontrado" };
      const PG = gPath(pt.items[0]);
      const prof = 1 + Math.max(0, ...pt.items.map((i) => psubOf(i).length));
      const U = irmaos(W, fn, PG);
      const k = U.indexOf(pt);
      const ant = k > 0 ? U[k - 1] : null;
      return {
        in: !ant ? "não há item anterior no mesmo nível" : ant.ponto ? "o item anterior é outro ponto" : (ant.bloco ? ant.path.length : PG.length + 1) + prof > MAXG ? LIM : true,
        out: PG.length ? true : "o ponto já está no nível mais alto da etapa",
      };
    }
    if (tipo === "grupo") {
      const { fn, GP } = refGrupo(ref);
      const its = L3.filter((i) => +i.faseNum === fn && prefixo(gPath(i), GP));
      const prof = Math.max(1, ...its.map((i) => gPath(i).length)) - GP.length + 1;
      const U = irmaos(W, fn, GP.slice(0, -1));
      const k = U.findIndex((n) => n.bloco === GP[GP.length - 1]);
      const ant = k > 0 ? U[k - 1] : null;
      const base = ant ? (ant.bloco ? ant.path.length : GP.length) : 0;
      return {
        in: !ant ? "não há item anterior no mesmo nível" : ant.ponto ? "o item anterior é um ponto" : base + prof > MAXG ? LIM : true,
        out: true,
      };
    }
    const fn = +ref;
    const F = fasesWF().map((f) => f.num);
    const prof = Math.max(0, ...L3.filter((i) => +i.faseNum === fn).map((i) => gPath(i).length));
    return {
      in: F.indexOf(fn) <= 0 ? "não há etapa anterior" : prof + 1 > MAXG ? LIM : true,
      out: "a etapa já está no nível mais alto",
    };
  }
  function estrBtn(tipo, ref, W) {
    const p = nivelPode(tipo, ref, W);
    return `<span class="nvbox">${nvBtn("out", tipo, ref, p.out)}${nvBtn("in", tipo, ref, p.in)}</span>`;
  }
  const semFrente = (n) => String(n || "").replace(/^(Frente|Fase|Etapa)\s*\d+\s*[·\-–]\s*/i, "");
  function faseNomeNum(nome, n) {
    return /^Frente\s*\d+\s*·/i.test(nome || "")
      ? String(nome).replace(/^Frente\s*\d+/i, "Frente " + p2(n))
      : nome;
  }
  /* aplica a nova estrutura: mapa(item) devolve os campos novos */
  /* inserir atividade abaixo (um clique, como o "+" de linha do Word): entra no mesmo grupo/ponto,
     logo depois da atividade, começando no dia útil seguinte ao término dela; as atividades de baixo
     são renumeradas e as predecessoras que citam os códigos antigos acompanham */
  const addBtn = (id, tip) =>
    `<button class="ico addb" data-addbelow="${esc(id)}" title="${esc(tip || "Inserir atividade abaixo")}" aria-label="${esc(tip || "Inserir atividade abaixo")}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>`;
  function novaAbaixo(id) {
    const L3 = ofG(3);
    const it = L3.find((i) => i.id === id);
    if (!it) return;
    const pac = L3.filter((i) => +i.faseNum === +it.faseNum && +i.pacoteNum === +it.pacoteNum).sort(
      (a, b) => (+a.seq || 0) - (+b.seq || 0),
    );
    const d0 = proxUtil(addDays(rF(it) || rI(it) || todayISO(), 1));
    const nv = {
      id: uid(),
      grupo: 3,
      ordem: Date.now(),
      faseNum: it.faseNum,
      faseNome: it.faseNome,
      pacoteNum: it.pacoteNum,
      pacoteNome: it.pacoteNome,
      titulo: "Nova atividade",
      resp: it.resp || "",
      equipe: "",
      peso: "",
      pred: "",
      predTipo: "TI",
      duracao: 1,
      inicio: d0,
      fim: d0,
      inicioRev: hasRevs() ? d0 : "",
      fimRev: hasRevs() ? d0 : "",
      inicioReal: "",
      fimReal: "",
      pctReal: 0,
      marco: false,
      valor: "",
      obs: "",
    };
    if (it.bloco) Object.assign(nv, setPath(gPath(it)));
    if (it.ponto) {
      nv.ponto = it.ponto;
      if (psubOf(it).length) nv.psub = psubOf(it);
    }
    pac.splice(pac.findIndex((i) => i.id === it.id) + 1, 0, nv);
    const ren = {};
    const P = [];
    pac.forEach((i, k) => {
      const seq = k + 1,
        codigo = `G3-F${p2(i.faseNum)}-P${p2(i.pacoteNum)}-A${p2(seq)}`;
      if (i === nv) {
        nv.seq = seq;
        nv.codigo = codigo;
        return;
      }
      if (+i.seq !== seq || i.codigo !== codigo) {
        if (i.codigo && i.codigo !== codigo) ren[i.codigo] = codigo;
        P.push({ id: i.id, fields: { seq, codigo } });
      }
    });
    const troca = (t) => String(t || "").replace(/G3-F\d+-P\d+-A\d+/g, (c) => ren[c] || c);
    if (Object.keys(ren).length)
      L3.forEach((i) => {
        const np = troca(i.pred);
        if (np !== String(i.pred || "")) {
          const q = P.find((x) => x.id === i.id);
          if (q) q.fields.pred = np;
          else P.push({ id: i.id, fields: { pred: np } });
        }
      });
    P.push({ id: nv.id, fields: Object.assign({}, nv, { id: undefined }), isNew: true });
    delete P[P.length - 1].fields.id;
    patchItems(P);
    afterG3();
    // o nome da nova atividade já fica selecionado para digitar
    setTimeout(() => {
      const x = document.querySelector(`input.ie-name[data-et="${nv.id}"]`);
      if (x) {
        x.scrollIntoView({ block: "center", behavior: "smooth" });
        x.focus();
        x.select();
      }
    }, 120);
  }
  async function aplicarEstrutura(mapa, foco) {
    const P = [];
    const ren = {};
    const novos = ofG(3).map((i) => [i, Object.assign({}, i, mapa(i) || {})]);
    // ordem manual: quem muda de etapa e cai numa posição já ocupada perde o "ord" (entra no fim)
    const ocupadas = new Set(novos.filter(([i, n]) => temOrd(n) && +i.faseNum === +n.faseNum).map(([, n]) => n.faseNum + "|" + +n.ord));
    novos.forEach(([i, n]) => {
      if (!temOrd(n) || +i.faseNum === +n.faseNum) return;
      const k = n.faseNum + "|" + +n.ord;
      if (ocupadas.has(k)) n.ord = "";
      else ocupadas.add(k);
    });
    novos.forEach(([i, n]) => {
      n.faseNome = faseNomeNum(n.faseNome, n.faseNum);
      n.codigo = `G3-F${p2(n.faseNum)}-P${p2(n.pacoteNum)}-A${p2(n.seq)}`;
      if (i.codigo && i.codigo !== n.codigo) ren[i.codigo] = n.codigo;
      const f = diffFields(i, n);
      if (Object.keys(f).length) P.push({ id: i.id, fields: f });
    });
    // o código é só a posição: as predecessoras (e dependências de outros grupos) acompanham a troca
    if (Object.keys(ren).length) {
      const troca = (t) => String(t || "").replace(/G3-F\d+-P\d+-A\d+/g, (c) => ren[c] || c);
      S.itens.forEach((i) => {
        const campo = +i.grupo === 3 ? "pred" : "dep";
        const q = P.find((x) => x.id === i.id);
        const atual = q && campo in q.fields ? q.fields[campo] : i[campo];
        if (!atual) return;
        const v = troca(atual);
        if (v === String(atual)) return;
        if (q) q.fields[campo] = v;
        else P.push({ id: i.id, fields: { [campo]: v } });
      });
    }
    if (!(await salvarAtomico(P))) return false;
    afterG3();
    if (foco) focoNivel(foco);
    return true;
  }
  /* grava a mudança de estrutura de uma vez (lote); se falhar, volta tudo como estava */
  async function salvarAtomico(P) {
    if (!P.length) return true;
    const antes = new Map(P.map((p) => [p.id, S.itens.find((x) => x.id === p.id)]));
    P.forEach((p) => {
      const k = S.itens.findIndex((x) => x.id === p.id);
      if (k >= 0) S.itens[k] = Object.assign({}, S.itens[k], p.fields);
    });
    if (!db) {
      saveLocal();
      render();
      return true;
    }
    render();
    if (!db.batch) {
      P.forEach((p) => dbPatch("atividades", p.id, p.fields, false));
      return true;
    }
    try {
      const b = db.batch();
      P.forEach((p) => b.update(db.collection(PB + "atividades").doc(p.id), clean(p.fields)));
      await b.commit();
      return true;
    } catch (e) {
      antes.forEach((v, id) => {
        const k = S.itens.findIndex((x) => x.id === id);
        if (k >= 0 && v) S.itens[k] = v;
      });
      render();
      toast("Não foi possível salvar a mudança de nível (" + ((e && e.message) || e) + "). A posição anterior foi restaurada.");
      return false;
    }
  }
  /* depois de mudar de nível: abre o novo pai (e os de cima), mantém a linha à vista e a destaca */
  function focoNivel(foco) {
    const W = wbs();
    const abrir = [];
    let alvo = null;
    const busca = (L, key, pais) => {
      for (let m = 0; m < L.length && !alvo; m++) {
        const n = L[m];
        const k = key(n, m);
        if (n.item && foco.id && n.item.id === foco.id) alvo = { pais, num: W.num.get(foco.id) };
        else if (n.bloco) {
          if (foco.grupo && samePath(n.path, foco.grupo)) alvo = { pais, num: n.num, proprio: k };
          else if (n.head && foco.id && n.head.id === foco.id) alvo = { pais, num: n.num, proprio: k };
          else busca(n.pts, (x, j) => (x.bloco ? k + "s" + (j + 1) : x.ponto ? k.replace(/b.*$/, "") + "p" + x.ponto : ""), pais.concat(k));
        } else if (n.ponto && foco.ponto && n.ponto === +foco.ponto) alvo = { pais, num: n.num };
        else if (n.ponto && foco.id && n.items.some((i) => i.id === foco.id)) alvo = { pais: pais.concat(k), num: W.num.get(foco.id), interno: k };
      }
    };
    if (foco.etapa) alvo = { pais: [], num: String(foco.etapa) };
    else {
      const it = foco.id ? ofG(3).find((i) => i.id === foco.id) : null;
      const fn = it ? +it.faseNum : +foco.fn;
      busca(W.top.get(fn) || [], (n, k) => (n.bloco ? "f" + fn + "b" + (k + 1) : n.ponto ? "f" + fn + "p" + n.ponto : ""), ["proj", "f" + fn]);
    }
    if (!alvo) return;
    alvo.pais.forEach((k) => k && collapsed.delete(k));
    if (alvo.interno) [...collapsed].filter((c) => c.startsWith(alvo.interno + "s")).forEach((c) => collapsed.delete(c));
    saveCollapsed();
    render();
    setTimeout(() => {
      const tr = [...document.querySelectorAll("#view table.crono tbody tr")].find(
        (r) => (r.querySelector("td.code") || {}).innerText && r.querySelector("td.code").innerText.replace(/[^0-9.]/g, "") === alvo.num,
      );
      if (!tr) return;
      const r = tr.getBoundingClientRect();
      if (r.top < 60 || r.bottom > window.innerHeight) tr.scrollIntoView({ block: "nearest" });
      tr.classList.add("movido");
      setTimeout(() => tr.classList.remove("movido"), 1600);
      const b = tr.querySelector("[data-nv]:not([disabled])");
      if (b) b.focus({ preventScroll: true });
    }, 60);
  }
  const nomeEtapa = (fn) => semFrente((ofG(3).find((i) => +i.faseNum === fn) || {}).faseNome) || "Etapa " + fn;
  async function mudarNivel(dir, tipo, ref) {
    const L3 = ofG(3);
    const pode = nivelPode(tipo, ref)[dir];
    if (pode !== true) return toast((dir === "in" ? "Rebaixar nível" : "Elevar nível") + ": " + pode + ".");
    if (tipo === "ponto" || tipo === "pgrupo" || (tipo === "ativ" && (L3.find((i) => i.id === ref) || {}).ponto)) return nivelNoPonto(dir, tipo, ref);
    if (tipo === "ativ") {
      const it = L3.find((i) => i.id === ref);
      if (!it) return;
      const Pi = gPath(it);
      if (dir === "out" && !Pi.length) {
        // atividade solta na etapa: vira uma etapa nova logo depois desta; as seguintes andam uma casa
        const fn = +it.faseNum;
        const prefixoE = /^Frente\s*\d+\s*·/i.test(it.faseNome || "");
        const ok = await aplicarEstrutura(
          (i) =>
            i.id === it.id
              ? { faseNum: fn + 1, faseNome: (prefixoE ? `Frente ${p2(fn + 1)} · ` : "") + it.titulo, pacoteNum: 1, pacoteNome: it.titulo, seq: 1 }
              : +i.faseNum > fn
                ? { faseNum: +i.faseNum + 1 }
                : {},
          { id: it.id },
        );
        if (ok) renumEtapasCfg((n, r) => (n > fn ? "f" + (n + 1) + r : undefined), (n) => (n > fn ? n + 1 : n));
        return;
      }
      if (dir === "out") {
        // sai do grupo e fica logo abaixo dele (depois da última atividade do grupo), como no MS Project
        const chave = (i) => [+i.pacoteNum || 0, +i.seq || 0];
        const novo = setPath(Pi.slice(0, -1));
        const M = L3.filter((i) => +i.faseNum === +it.faseNum && prefixo(gPath(i), Pi) && i.id !== it.id)
          .sort((a, b) => chave(a)[0] - chave(b)[0] || chave(a)[1] - chave(b)[1]);
        const ult = M[M.length - 1];
        if (!ult) return aplicarEstrutura((i) => (i.id === it.id ? novo : {}), { id: it.id });
        const pac = L3.filter((i) => +i.faseNum === +ult.faseNum && +i.pacoteNum === +ult.pacoteNum && i.id !== it.id)
          .sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
        pac.splice(pac.findIndex((i) => i.id === ult.id) + 1, 0, it);
        const nova = new Map(pac.map((i, n) => [i.id, n + 1]));
        return aplicarEstrutura(
          (i) =>
            i.id === it.id
              ? Object.assign({}, novo, { pacoteNum: +ult.pacoteNum, pacoteNome: ult.pacoteNome, seq: nova.get(i.id) })
              : nova.has(i.id)
                ? { seq: nova.get(i.id) }
                : {},
          { id: it.id },
        );
      }
      // entra no grupo de cima (no mesmo nível); se em cima houver uma atividade, ela vira o grupo
      if (Pi.length >= MAXG) return toast("O cronograma tem no máximo 5 níveis (etapa, 3 níveis de grupo e atividade).");
      let U = wbs().top.get(+it.faseNum) || [];
      Pi.forEach((nome) => {
        const g = U.find((n) => n.bloco === nome);
        U = g ? g.pts : [];
      });
      const k = U.findIndex((n) => n.item && n.item.id === it.id);
      const ant = k > 0 ? U[k - 1] : null;
      if (!ant || ant.ponto) return toast("Não há grupo nem atividade acima para receber esta atividade.");
      if (ant.bloco) return aplicarEstrutura((i) => (i.id === it.id ? setPath(ant.path) : {}), { id: it.id });
      const P2 = Pi.concat(nomeLivre(U, ant.item.titulo));
      return aplicarEstrutura((i) => (i.id === it.id || i.id === ant.item.id ? setPath(P2) : {}), { id: it.id });
    }
    if (tipo === "grupo") {
      const p = ref.indexOf("|");
      const fn = +ref.slice(0, p);
      const GP = ref.slice(p + 1).startsWith("[") ? JSON.parse(ref.slice(p + 1)) : [ref.slice(p + 1)];
      const bloco = GP[GP.length - 1];
      const daqui = (i) => +i.faseNum === fn && prefixo(gPath(i), GP);
      const prof = Math.max(...L3.filter(daqui).map((i) => gPath(i).length)) - GP.length + 1;
      if (dir === "in") {
        // entra no grupo/subgrupo imediatamente acima, no mesmo nível
        let U = wbs().top.get(fn) || [];
        GP.slice(0, -1).forEach((nome) => {
          const g = U.find((n) => n.bloco === nome);
          U = g ? g.pts : [];
        });
        const k = U.findIndex((n) => n.bloco === bloco);
        const ant = k > 0 ? U[k - 1] : null;
        if (!ant || ant.ponto) return toast("Não há item anterior no mesmo nível para receber este grupo.");
        // item anterior é um grupo: entra nele; é uma atividade: ela vira o grupo (resumo) e este entra nela
        const novoPai = ant.bloco ? ant.path : GP.slice(0, -1).concat(nomeLivre(U, ant.item.titulo));
        const foco = { grupo: novoPai.concat(bloco), fn };
        return aplicarEstrutura(
          (i) =>
            daqui(i)
              ? setPath(novoPai.concat(gPath(i).slice(GP.length - 1)))
              : !ant.bloco && i.id === ant.item.id
                ? setPath(novoPai)
                : {},
          foco,
        );
      }
      if (GP.length > 1) {
        // subgrupo sobe um nível: passa a ser irmão do grupo de cima
        return aplicarEstrutura((i) => (daqui(i) ? setPath(GP.slice(0, -2).concat(gPath(i).slice(GP.length - 1))) : {}), {
          grupo: GP.slice(0, -2).concat(bloco),
          fn,
        });
      }
      const prefixoF = /^Frente\s*\d+\s*·/i.test((L3[0] || {}).faseNome || "");
      const kG = "f" + fn + "b" + ((wbs().top.get(fn) || []).findIndex((n) => n.bloco === bloco) + 1);
      const okG = await aplicarEstrutura(
        (i) =>
          daqui(i)
            ? Object.assign({ faseNum: fn + 1, faseNome: (prefixoF ? `Frente ${p2(fn + 1)} · ` : "") + bloco }, setPath(gPath(i).slice(1)))
            : +i.faseNum > fn
              ? { faseNum: +i.faseNum + 1 }
              : {},
        { etapa: fn + 1 },
      );
      if (okG) renumEtapasCfg((n, r) => (n > fn ? "f" + (n + 1) + r : "f" + n + r === kG ? "f" + (fn + 1) : undefined), (n) => (n > fn ? n + 1 : n));
      return;
    }
    // etapa vira grupo da etapa anterior; os pacotes vêm depois dos de lá e as seguintes voltam uma casa
    const fn = +ref;
    const F = fasesWF().map((f) => f.num);
    const dest = F[F.indexOf(fn) - 1];
    if (dest == null) return;
    const titulo = nomeEtapa(fn);
    const off = L3.filter((i) => +i.faseNum === dest).reduce((m, i) => Math.max(m, +i.pacoteNum || 0), 0);
    const dNome = (L3.find((i) => +i.faseNum === dest) || {}).faseNome || "";
    const okE = await aplicarEstrutura((i) =>
      +i.faseNum === fn
        ? Object.assign({ faseNum: dest, faseNome: dNome, pacoteNum: (+i.pacoteNum || 0) + off }, setPath([titulo].concat(gPath(i))))
        : +i.faseNum > fn
          ? { faseNum: +i.faseNum - 1 }
          : {},
      { grupo: [titulo], fn: dest },
    );
    if (okE)
      renumEtapasCfg(
        (n, r) => (n === fn ? (/^p\d+$/.test(r) ? "f" + dest + "p" + (+r.slice(1) + off) : null) : n > fn ? "f" + (n - 1) + r : undefined),
        (n) => (n === fn ? dest : n > fn ? n - 1 : n),
      );
  }
  /* Implantação (pontos): mesmas regras de EAP dentro e em volta do ponto */
  async function nivelNoPonto(dir, tipo, ref) {
    const W = wbs();
    const L3 = ofG(3);
    const seqOrd = (a, b) => (+a.seq || 0) - (+b.seq || 0);
    const renumera = (ordem) => new Map(ordem.map((i, n) => [i.id, n + 1]));
    // logo depois da última atividade que continua no ponto (antes do que já tinha saído dele)
    const aposPonto = (resto, mov) => {
      const k = resto.reduce((m, i, n) => (i.ponto ? n : m), -1);
      return resto.slice(0, k + 1).concat(mov, resto.slice(k + 1));
    };
    if (tipo === "ativ") {
      const it = L3.find((i) => i.id === ref);
      const fn = +it.faseNum,
        pn = +it.pacoteNum;
      const pt = (W.tree.get(fn) || []).find((n) => n.ponto === pn);
      const Q = psubOf(it);
      const pac = L3.filter((i) => +i.faseNum === fn && +i.pacoteNum === pn).sort(seqOrd);
      if (dir === "in") {
        const U = kidsDe(pt, Q);
        const ant = U[U.findIndex((n) => n.item && n.item.id === it.id) - 1];
        if (ant.bloco) return aplicarEstrutura((i) => (i.id === it.id ? { psub: ant.path } : {}), { id: it.id });
        const Q2 = Q.concat(nomeLivre(U, ant.item.titulo));
        return aplicarEstrutura((i) => (i.id === it.id || i.id === ant.item.id ? { psub: Q2 } : {}), { id: it.id });
      }
      if (Q.length) {
        // sobe um nível dentro do ponto: fica logo depois do subgrupo de onde saiu
        const resto = pac.filter((i) => i.id !== it.id);
        const M = resto.filter((i) => i.ponto && prefixo(psubOf(i), Q));
        const ordem = resto.slice();
        ordem.splice(ordem.indexOf(M[M.length - 1]) + 1, 0, it);
        const nova = renumera(ordem);
        return aplicarEstrutura((i) => (i.id === it.id ? { psub: Q.slice(0, -1), seq: nova.get(i.id) } : nova.has(i.id) ? { seq: nova.get(i.id) } : {}), { id: it.id });
      }
      // sai do ponto: fica logo depois dele, no mesmo nível do ponto
      const nova = renumera(aposPonto(pac.filter((i) => i.id !== it.id), [it]));
      return aplicarEstrutura(
        (i) => (i.id === it.id ? Object.assign({ ponto: 0, psub: [], seq: nova.get(i.id) }, setPath(gPath(it))) : nova.has(i.id) ? { seq: nova.get(i.id) } : {}),
        { id: it.id },
      );
    }
    if (tipo === "pgrupo") {
      const { fn, pn, GP, pt } = refPGrupo(ref, W);
      const nome = GP[GP.length - 1];
      const noPonto = (i) => +i.faseNum === fn && +i.pacoteNum === pn && i.ponto;
      const daqui = (i) => noPonto(i) && prefixo(psubOf(i), GP);
      const primeiro = pt.items.find(daqui);
      if (dir === "in") {
        const U = kidsDe(pt, GP.slice(0, -1));
        const ant = U[U.findIndex((n) => n.bloco === nome) - 1];
        const novoPai = ant.bloco ? ant.path : GP.slice(0, -1).concat(nomeLivre(U, ant.item.titulo));
        return aplicarEstrutura(
          (i) => (daqui(i) ? { psub: novoPai.concat(psubOf(i).slice(GP.length - 1)) } : !ant.bloco && i.id === ant.item.id ? { psub: novoPai } : {}),
          { id: primeiro.id },
        );
      }
      if (GP.length > 1)
        return aplicarEstrutura((i) => (daqui(i) ? { psub: GP.slice(0, -2).concat(psubOf(i).slice(GP.length - 1)) } : {}), { id: primeiro.id });
      // subgrupo do 1º nível do ponto sai do ponto: vira grupo logo depois dele
      const pac = L3.filter((i) => +i.faseNum === fn && +i.pacoteNum === pn).sort(seqOrd);
      const nova = renumera(aposPonto(pac.filter((i) => !daqui(i)), pac.filter(daqui)));
      const PG = gPath(pt.items[0]);
      const livre = nomeLivre(irmaos(W, fn, PG), nome, pt.nome || "Ponto " + p2(pn));
      return aplicarEstrutura(
        (i) =>
          daqui(i)
            ? Object.assign({ ponto: 0, psub: [], seq: nova.get(i.id) }, setPath(PG.concat([livre], psubOf(i).slice(1))))
            : nova.has(i.id)
              ? { seq: nova.get(i.id) }
              : {},
        { id: primeiro.id },
      );
    }
    // o ponto inteiro: entra no grupo de cima (ou a atividade de cima vira o grupo) / sai do grupo
    const [fn, pn] = String(ref).split("|").map(Number);
    const pt = (W.tree.get(fn) || []).find((n) => n.ponto === pn);
    const PG = gPath(pt.items[0]);
    const doPonto = (i) => +i.faseNum === fn && +i.pacoteNum === pn && i.ponto;
    if (dir === "in") {
      const U = irmaos(W, fn, PG);
      const ant = U[U.indexOf(pt) - 1];
      if (ant.bloco) return aplicarEstrutura((i) => (doPonto(i) ? setPath(ant.path) : {}), { ponto: pn, fn });
      const P2 = PG.concat(nomeLivre(U, ant.item.titulo));
      return aplicarEstrutura((i) => (doPonto(i) || i.id === ant.item.id ? setPath(P2) : {}), { ponto: pn, fn });
    }
    return aplicarEstrutura((i) => (doPonto(i) ? setPath(PG.slice(0, -1)) : {}), { ponto: pn, fn });
  }
  /* etapas renumeradas: observações e riscos (guardados por "f<etapa>…") e as etapas das revisões
     acompanham. chave(n, resto) devolve a nova chave, null para descartar ou undefined para manter. */
  function renumEtapasCfg(chave, num) {
    ["obsGrp", "riscoGrp", "predGrp"].forEach((c) => {
      if (!cfg[c]) return;
      const o = {};
      Object.entries(cfg[c]).forEach(([k, v]) => {
        const m = k.match(/^f(\d+)(.*)$/);
        const nk = m ? chave(+m[1], m[2]) : undefined;
        if (nk === null) return;
        o[nk === undefined ? k : nk] = v;
      });
      cfg[c] = o;
    });
    if (Array.isArray(cfg.cronRevs))
      cfg.cronRevs = cfg.cronRevs.map((R) =>
        Object.assign(
          {},
          R,
          R.etapa ? { etapa: num(+R.etapa) } : {},
          Array.isArray(R.impactos) ? { impactos: R.impactos.map((x) => Object.assign({}, x, x.etapa ? { etapa: num(+x.etapa) } : {})) } : {},
        ),
      );
    saveCfg();
  }
  /* ---------- reordenar por arraste (alça ⋮⋮ ao lado do nº da EAP) ----------
     O item troca de posição entre os irmãos (mesmo pai, mesmo nível) e leva tudo o que tem dentro,
     inclusive o que está recolhido. A ordem fica no campo "ord" das atividades da etapa: o código
     interno, o nº do ponto, as datas e os vínculos não mudam; a numeração EAP sai da posição. Etapas
     trocam de número, e observações, riscos, revisões e predecessoras acompanham. Mudar de nível
     continua sendo pelas setas Elevar/Rebaixar.
     Caminho de uma linha (data-np): "f3" = etapa 3; "f3:4.0" = 1º filho do 5º item da etapa 3. */
  const npPai = (np) => (np.includes(":") ? np.replace(/[:.]\d+$/, "") : "");
  const npSob = (np, x) => x === np || x.startsWith(np + (np.includes(":") ? "." : ":"));
  const npProf = (np) => np.split(/[:.]/).length;
  function noDe(W, np) {
    const m = String(np).match(/^f(\d+)(?::([\d.]+))?$/);
    if (!m) return null;
    const fn = +m[1];
    if (!m[2]) return { fn, etapa: true };
    let lista = W.top.get(fn) || [],
      irm = null,
      n = null,
      k = -1;
    for (const x of m[2].split(".")) {
      irm = lista;
      k = +x;
      n = lista[k];
      if (!n) return null;
      lista = n.bloco ? n.pts : n.ponto ? n.kids || [] : [];
    }
    return { fn, n, irm, k };
  }
  const itensNo = (n) => (n.item ? [n.item] : n.bloco ? (n.head ? [n.head] : []).concat(n.pts.flatMap(itensNo)) : (n.kids || []).flatMap(itensNo));
  // chave de cada grupo/ponto da etapa (recolher, observação e risco são guardados por ela, pela posição)
  function chavesEtapa(W, fn) {
    const M = new Map();
    const desce = (L, chave) =>
      L.forEach((n, m) => {
        if (n.bloco) {
          const k = chave(m);
          M.set(n, k);
          desce(n.pts, (j) => k + "s" + (j + 1));
        } else if (n.ponto) {
          const k = "f" + fn + "p" + n.ponto;
          M.set(n, k);
          desce(n.kids || [], (j) => k + "s" + (j + 1));
        }
      });
    desce(W.top.get(fn) || [], (m) => "f" + fn + "b" + (m + 1));
    return M;
  }
  // troca de chaves (permutação): observações, riscos e linhas recolhidas acompanham o grupo
  function trocaChaves(T) {
    if (![...T].some(([a, b]) => a !== b)) return;
    ["obsGrp", "riscoGrp", "predGrp"].forEach((c) => {
      if (!cfg[c]) return;
      const o = {};
      Object.entries(cfg[c]).forEach(([k, v]) => (o[T.has(k) ? T.get(k) : k] = v));
      cfg[c] = o;
    });
    collapsed = new Set([...collapsed].map((k) => (T.has(k) ? T.get(k) : k)));
    saveCollapsed();
    saveCfg();
  }
  let mvSalvando = false;
  /* move o item np para antes (ou depois) do irmão alvo; devolve o novo caminho, ou "" se nada mudou */
  async function reordenar(np, alvo, depois) {
    if (/^f\d+$/.test(np)) return reordEtapa(+np.slice(1), +alvo.slice(1), depois);
    const W = wbs();
    const a = noDe(W, np),
      b = noDe(W, alvo);
    if (!a || !b || a.n === b.n) return "";
    if (a.irm !== b.irm) return moverPara(W, a, b, depois);
    let j = b.k + (depois ? 1 : 0);
    if (j > a.k) j--;
    if (j === a.k) return ""; // soltou na posição de origem
    const antes = chavesEtapa(W, a.fn);
    a.irm.splice(a.k, 1);
    a.irm.splice(j, 0, a.n);
    const agora = chavesEtapa(W, a.fn);
    const ord = new Map((W.top.get(a.fn) || []).flatMap(itensNo).map((i, x) => [i.id, x + 1]));
    const T = new Map();
    antes.forEach((k, n) => T.set(k, agora.get(n)));
    const ok = await aplicarEstrutura((i) => (+i.faseNum === a.fn && ord.has(i.id) ? { ord: ord.get(i.id) } : {}));
    if (!ok) return "";
    trocaChaves(T);
    const pai = npPai(np);
    return pai + (pai.includes(":") ? "." : ":") + j;
  }
  /* atividade ou grupo solto em outro grupo/etapa: passa a ser daquele grupo (e daquela etapa),
     na posição da linha azul; o código acompanha a etapa e as predecessoras são atualizadas */
  function npDe(W, achou) {
    const busca = (L, pre) => {
      for (let k = 0; k < L.length; k++) {
        const n = L[k];
        if (achou(n)) return pre + k;
        const r = busca(n.bloco ? n.pts : n.ponto ? n.kids || [] : [], pre + k + ".");
        if (r) return r;
      }
      return "";
    };
    for (const [fn, U] of W.top) {
      const r = busca(U, "f" + fn + ":");
      if (r) return r;
    }
    return "";
  }
  async function moverPara(W, a, b, depois) {
    if (!a.n.item && !a.n.bloco) return "";
    const fa = a.fn,
      fb = b.fn;
    const mov = itensNo(a.n);
    if (!mov.length) return "";
    if (fa !== fb && mov.some((i) => i.ponto)) {
      toast("Grupo com pontos não muda de etapa por arraste: use o número de pontos da etapa de destino.");
      return "";
    }
    // grupo de destino: o mesmo da linha alvo
    const bn = b.n;
    const destPath = bn.item ? gPath(bn.item) : bn.bloco ? bn.path.slice(0, -1) : gPath((bn.items || [])[0]);
    const base = a.n.item ? gPath(a.n.item).length : a.n.path.length - 1;
    const novoCam = (i) => destPath.concat(gPath(i).slice(base));
    if (mov.some((i) => novoCam(i).length > MAXG)) {
      toast("Não cabe ali: passaria do limite de níveis (grupo › subgrupo › subgrupo).");
      return "";
    }
    if (a.n.bloco && irmaos(W, fb, destPath).some((n) => n !== a.n && n.bloco === a.n.bloco)) {
      toast(`Já existe um grupo “${a.n.bloco}” ali. Renomeie um deles antes de mover.`);
      return "";
    }
    // nova ordem da etapa de destino, com o item na posição da linha azul
    a.irm.splice(a.k, 1);
    const j = b.irm.indexOf(b.n) + (depois ? 1 : 0);
    b.irm.splice(j, 0, a.n);
    const ord = new Map((W.top.get(fb) || []).flatMap(itensNo).map((i, x) => [i.id, x + 1]));
    // mudou de etapa: entra num pacote da etapa de destino, com sequência nova (o código é a posição)
    const novos = new Map();
    if (fa !== fb) {
      const L3 = ofG(3);
      const ref = (bn.item && !bn.item.ponto && bn.item) || L3.find((i) => +i.faseNum === fb && !i.ponto);
      const pac = ref ? +ref.pacoteNum || 1 : 1;
      const pacNome = ref ? ref.pacoteNome : "";
      const fNome = (L3.find((i) => +i.faseNum === fb) || {}).faseNome || "";
      let sq = Math.max(0, ...L3.filter((i) => +i.faseNum === fb && +i.pacoteNum === pac).map((i) => +i.seq || 0));
      mov.forEach((i) => novos.set(i.id, { faseNum: fb, faseNome: fNome, pacoteNum: pac, pacoteNome: pacNome, seq: ++sq }));
    }
    const ids = new Set(mov.map((i) => i.id));
    const ok = await aplicarEstrutura((i) => {
      if (+i.faseNum !== fb && !ids.has(i.id)) return {};
      const o = ord.has(i.id) ? { ord: ord.get(i.id) } : {};
      if (ids.has(i.id)) Object.assign(o, setPath(novoCam(i)), novos.get(i.id) || {});
      return o;
    });
    if (!ok) return "";
    const W2 = wbs();
    const alvoCam = a.n.bloco ? destPath.concat(a.n.bloco) : null;
    return npDe(W2, (n) => (alvoCam ? n.bloco && samePath(n.path, alvoCam) && itensNo(n).some((i) => ids.has(i.id)) : n.item && ids.has(n.item.id)));
  }
  /* etapa: troca de número; "G3-F03" e "G3-F03 (todas)" nas predecessoras acompanham */
  async function reordEtapa(fa, fb, depois) {
    const F = fasesWF().map((f) => f.num);
    const k = F.indexOf(fa);
    let j = F.indexOf(fb) + (depois ? 1 : 0);
    if (k < 0 || j < 0 || fa === fb) return "";
    if (j > k) j--;
    if (j === k) return "";
    const N = F.slice();
    N.splice(k, 1);
    N.splice(j, 0, fa);
    const mapa = new Map(N.map((f, x) => [f, F[x]]));
    const nn = (n) => (mapa.has(n) ? mapa.get(n) : n);
    const refEt = (t) => String(t || "").replace(/G3-F(\d+)(\s*\(todas\))?(?![\d-])/g, (m0, d, tod) => `G3-F${p2(nn(+d))}${tod || ""}`);
    const ok = await aplicarEstrutura((i) => {
      const o = { faseNum: nn(+i.faseNum) };
      if (i.pred && refEt(i.pred) !== String(i.pred)) o.pred = refEt(i.pred);
      return o;
    });
    if (!ok) return "";
    renumEtapasCfg((n, r) => (nn(n) !== n ? "f" + nn(n) + r : undefined), nn);
    collapsed = new Set(
      [...collapsed].map((c) => {
        const m = c.match(/^f(\d+)(\D.*)?$/);
        return m ? "f" + nn(+m[1]) + (m[2] || "") : c;
      }),
    );
    saveCollapsed();
    return "f" + F[j];
  }
  // linha movida: fica à vista e piscando
  function realcarNp(np) {
    // redesenha já (sem esperar o próximo quadro): outro arraste logo em seguida pega as linhas certas
    if (rq) {
      cancelAnimationFrame(rq);
      rq = 0;
    }
    renderNow();
    setTimeout(() => {
      const tr = document.querySelector(`#view table.crono tr[data-np="${np}"]`);
      if (!tr) return;
      const r = tr.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 20) tr.scrollIntoView({ block: "center" });
      tr.classList.add("movido");
      setTimeout(() => tr.classList.remove("movido"), 1600);
    }, 60);
  }
  /* interação: segura a alça, arrasta (linha azul = onde entra), solta; Esc ou soltar fora cancela */
  const MV = { on: null };
  function mvFim(ok) {
    const m = MV.on;
    MV.on = null;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.lbl.remove();
    m.lin.remove();
    document.body.classList.remove("mvarr");
    m.linhas.forEach((r) => r.classList.remove("arrastando"));
    if (!ok || !m.alvo) return;
    mvSalvando = true;
    reordenar(m.np, m.alvo.np, m.alvo.depois)
      .then((novo) => {
        if (novo) {
          toast(`${m.rot} movido para ${novo.startsWith("f") && !novo.includes(":") ? "a etapa " + novo.slice(1) : m.np.split(":")[0] !== novo.split(":")[0] ? "a etapa " + novo.split(":")[0].slice(1) : "a nova posição"}${m.nDentro ? ` com ${p1s(m.nDentro, "item", "itens")} de dentro` : ""}.`);
          realcarNp(novo);
        }
      })
      .finally(() => (mvSalvando = false));
  }
  function mvAtualiza() {
    const m = MV.on;
    if (!m) return;
    m.lbl.style.left = m.x + 14 + "px";
    m.lbl.style.top = m.y + 14 + "px";
    m.alvo = null;
    m.lin.hidden = true;
    const el = document.elementFromPoint(m.x, m.y);
    const tr = el && el.closest && el.closest("tr[data-np]");
    if (!tr || tr.closest("tbody") !== m.tb) return;
    const x = tr.dataset.np;
    if (m.tipo === "item" || m.tipo === "bloco") return mvLivre(m, x);
    const d = npProf(m.np);
    if (npProf(x) < d) return;
    const anc = x.split(/(?=[:.])/).slice(0, d).join("");
    if (anc === m.np || npPai(anc) !== npPai(m.np)) return; // o próprio item, o que está dentro dele ou outro pai
    const doAnc = [...m.tb.querySelectorAll("tr[data-np]")].filter((r) => npSob(anc, r.dataset.np));
    const r0 = doAnc[0].getBoundingClientRect();
    const depois = x !== anc || m.y > r0.top + r0.height / 2;
    const ref = depois ? doAnc[doAnc.length - 1].getBoundingClientRect() : r0;
    const tb = m.tb.getBoundingClientRect();
    m.alvo = { np: anc, depois };
    m.lin.hidden = false;
    m.lin.style.left = tb.left + window.scrollX + "px";
    m.lin.style.width = tb.width + "px";
    m.lin.style.top = (depois ? ref.bottom : ref.top) + window.scrollY - 1.5 + "px";
  }
  // atividade ou grupo: alvo é a própria linha apontada (em qualquer grupo/etapa); dentro de um ponto,
  // o alvo é o ponto; na linha da etapa, entra no começo dela
  function mvLivre(m, x0) {
    let x = x0,
      antes = false;
    if (!x.includes(":")) {
      if (!(m.W.top.get(+x.slice(1)) || []).length) return;
      x += ":0";
      antes = true;
    }
    const [fp, rest] = x.split(":");
    const idx = rest.split(".");
    for (let d = 1; d < idx.length; d++) {
      const pre = fp + ":" + idx.slice(0, d).join(".");
      const no = noDe(m.W, pre);
      if (no && no.n && no.n.ponto) {
        x = pre;
        break;
      }
    }
    if (npSob(m.np, x)) return;
    const rows = [...m.tb.querySelectorAll("tr[data-np]")].filter((r) => npSob(x, r.dataset.np));
    if (!rows.length) return;
    const r0 = rows[0].getBoundingClientRect();
    const depois = !antes && (x !== x0 && x0.includes(":") ? true : m.y > r0.top + r0.height / 2);
    const ref = depois ? rows[rows.length - 1].getBoundingClientRect() : r0;
    const tb = m.tb.getBoundingClientRect();
    m.alvo = { np: x, depois };
    m.lin.hidden = false;
    m.lin.style.left = tb.left + window.scrollX + "px";
    m.lin.style.width = tb.width + "px";
    m.lin.style.top = (depois ? ref.bottom : ref.top) + window.scrollY - 1.5 + "px";
  }
  document.addEventListener("pointerdown", (e) => {
    let g = e.target.closest && e.target.closest("[data-mvg]");
    if (!g || e.button !== 0) return;
    e.preventDefault();
    if (mvSalvando) return toast("Aguarde: a mudança anterior ainda está sendo salva.");
    // redesenho pendente: aplica já e pega a alça que ficou sob o mouse (as linhas mudaram de posição)
    if (rq) {
      cancelAnimationFrame(rq);
      rq = 0;
      renderNow();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      g = el && el.closest && el.closest("[data-mvg]");
      if (!g) return;
    }
    if (g.classList.contains("off")) return toast(g.title);
    const np = g.dataset.mvg;
    const tb = g.closest("tbody");
    const linhas = [...tb.querySelectorAll("tr[data-np]")].filter((r) => npSob(np, r.dataset.np));
    const W = wbs();
    const no = noDe(W, np);
    if (!no) return;
    const tr = linhas[0];
    const num = tr.querySelector("td.code").innerText.replace(/[^0-9.]/g, "");
    const nome = (tr.querySelector("td.ttl .ie-name") || {}).value || tr.querySelector("td.ttl").innerText.split("\n")[0];
    const nDentro = no.etapa ? (W.byFase.get(no.fn) || []).length : no.n.item ? 0 : no.n.bloco ? itensNo(no.n).length - (no.n.head ? 1 : 0) : no.n.items.length;
    const lbl = document.createElement("div");
    lbl.className = "mvlbl";
    lbl.innerHTML = `<b>${esc(num)} · ${esc(nome)}</b>${nDentro ? `<small>${p1s(nDentro, "item de dentro acompanha", "itens de dentro acompanham")}</small>` : ""}<small>Solte na linha azul · Esc cancela</small>`;
    const lin = document.createElement("div");
    lin.className = "mvlin";
    lin.hidden = true;
    document.body.append(lbl, lin);
    document.body.classList.add("mvarr");
    linhas.forEach((r) => r.classList.add("arrastando"));
    MV.on = { np, tb, linhas, lbl, lin, x: e.clientX, y: e.clientY, alvo: null, rot: `${num} · ${nome}`, nDentro, raf: 0, W, tipo: no.etapa ? "etapa" : no.n.item ? "item" : no.n.bloco ? "bloco" : "ponto" };
    // rolagem automática perto das bordas da janela
    const rola = () => {
      const m = MV.on;
      if (!m) return;
      const v = m.y < 80 ? -Math.ceil((80 - m.y) / 6) : m.y > window.innerHeight - 60 ? Math.ceil((m.y - window.innerHeight + 60) / 6) : 0;
      if (v) {
        window.scrollBy(0, v);
        mvAtualiza();
      }
      m.raf = requestAnimationFrame(rola);
    };
    MV.on.raf = requestAnimationFrame(rola);
    mvAtualiza();
  });
  document.addEventListener("pointermove", (e) => {
    if (!MV.on) return;
    MV.on.x = e.clientX;
    MV.on.y = e.clientY;
    mvAtualiza();
  });
  document.addEventListener("pointerup", () => MV.on && mvFim(true));
  document.addEventListener("pointercancel", () => MV.on && mvFim(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && MV.on) {
      e.preventDefault();
      mvFim(false);
    }
  });
  /* contato dos stakeholders em dois campos (e-mail e telefone). Cadastros antigos só têm "contato":
     o que parece e-mail vai para o e-mail e o restante para o telefone. "contato" continua gravado
     (e-mail · telefone) para as exportações e os dados antigos. */
  const CT_EMAIL = /[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}/g;
  const ctEmail = (c) => (c && c.email != null ? String(c.email) : ((String((c && c.contato) || "").match(CT_EMAIL) || []).join(", ")));
  const ctTel = (c) =>
    c && c.telefone != null
      ? String(c.telefone)
      : String((c && c.contato) || "")
          .replace(CT_EMAIL, "")
          .replace(/^[\s,;·|/-]+|[\s,;·|/-]+$/g, "")
          .trim();
  const ctJunta = (o) => {
    o.email = String(o.email || "").trim();
    o.telefone = String(o.telefone || "").trim();
    o.contato = [o.email, o.telefone].filter(Boolean).join(" · ");
    return o;
  };
  const ctCampos = (c, ph) =>
    `<input data-c="email" type="email" value="${esc(ctEmail(c))}" placeholder="E-mail${ph || ""}" aria-label="E-mail"><input data-c="telefone" type="tel" value="${esc(ctTel(c))}" placeholder="Telefone${ph || ""}" aria-label="Telefone">`;
  function contacts(side) {
    if (Array.isArray(stk[side])) return stk[side];
    const R = side === "dgt" ? ROLES_DGT : ROLES_CLI;
    return R.map(([k, l]) => ({
      funcao: l,
      nome: (stk[k] || {}).nome || "",
      contato: (stk[k] || {}).contato || "",
    }));
  }
  const adRow = (a) =>
    `<div class="adr"><input data-a="num" value="${esc(a.num || "")}" placeholder="Ex.: 1º Termo Aditivo" aria-label="Número do aditivo"><select data-a="tipo" aria-label="Aplica em"><option value="impl" ${a.tipo !== "vig" ? "selected" : ""}>Implantação</option><option value="vig" class="optvig" ${a.tipo === "vig" ? "selected" : ""}>Vigência</option></select><span class="adq"><input data-a="qtd" type="number" min="0" value="${esc(a.qtd ?? "")}" aria-label="Acréscimo"><span class="adu">${a.tipo === "vig" ? "meses" : "dias"}</span></span><input data-a="data" type="date" value="${esc(a.data || "")}" aria-label="Data do aditivo"><button type="button" class="ico rm" data-rmad title="Remover aditivo" aria-label="Remover aditivo"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
  /* atrasos administrativos do projeto (stk.admHist: [{ini, fim, mot, por}]): podem ser vários ao longo da
     vida do projeto e mais de um ao mesmo tempo; sem "fim" = em aberto. O projeto está em atraso
     administrativo enquanto houver algum em aberto (stk.atrasoAdm e stk.atrasoAdmMotivo são derivados). */
  const diasCorridos = (a, b) => (a && b ? Math.max(0, Math.round((dt(b) - dt(a)) / DAY)) + 1 : 0);
  // APC depois da Ordem de Serviço: o intervalo conta como atraso administrativo (automático, não editável)
  const APC_MOT = "Lapso entre a Ordem de Serviço e a reunião de APC";
  // lapso entre a ordem de início e a APC: até 7 dias corridos é aceitável (não é atraso administrativo)
  const APC_TOL = 7;
  const apcLapso = (k) => (k && k.oi && k.apc && k.apc > k.oi ? diasCorridos(k.oi, addDays(k.apc, -1)) : 0);
  function admApc(k) {
    if (!k || !k.oi || !k.apc || k.apc <= k.oi) return null;
    if (apcLapso(k) <= APC_TOL) return null;
    const hoje = todayISO();
    return { ini: k.oi, fim: k.apc <= hoje ? addDays(k.apc, -1) : "", mot: APC_MOT, auto: true };
  }
  const admAberto = (k) => admHist(k).some((x) => !x.fim);
  function admHist(k) {
    const A = admApc(k);
    const H = (Array.isArray(k && k.admHist) ? k.admHist : []).filter((x) => !x.auto).concat(A ? [A] : []);
    // projetos marcados antes do histórico: o atraso atual vira um item em aberto (início a informar)
    if (k && k.atrasoAdm && !H.some((x) => !x.fim)) return H.concat([{ ini: "", fim: "", mot: k.atrasoAdmMotivo || "", legado: true }]);
    return H;
  }
  // dias em atraso sem contar duas vezes os períodos que se sobrepõem
  function diasUniao(L, hoje) {
    const I = L.filter((x) => x.ini)
      .map((x) => [x.ini, x.fim || hoje])
      .filter(([a, b]) => b >= a)
      .sort((x, y) => (x[0] < y[0] ? -1 : 1));
    let t = 0,
      ca = null,
      cb = null;
    I.forEach(([a, b]) => {
      if (cb && a <= addDays(cb, 1)) {
        if (b > cb) cb = b;
      } else {
        if (ca) t += diasCorridos(ca, cb);
        ca = a;
        cb = b;
      }
    });
    if (ca) t += diasCorridos(ca, cb);
    return t;
  }
  function admResumo(k) {
    const H = admHist(k);
    const hoje = todayISO();
    const ab = H.filter((x) => !x.fim);
    const desde = ab.map((x) => x.ini).filter(Boolean).sort()[0] || "";
    return {
      abertos: ab.length,
      desde,
      dias: ab.length ? diasUniao(ab, hoje) : null,
      total: diasUniao(H, hoje),
      periodos: H.filter((x) => x.ini).length,
      semInicio: ab.some((x) => !x.ini),
    };
  }
  const admTxt = (k) => {
    const r = admResumo(k);
    const atual = r.abertos ? (r.desde ? `${r.abertos > 1 ? `${r.abertos} em aberto, ` : ""}desde ${fmtD(r.desde)} (${r.dias} dia${r.dias === 1 ? "" : "s"})` : "início não registrado") + (r.semInicio && r.desde ? " · há atraso sem data de início" : "") : "";
    const tot = r.total ? `total no projeto: ${r.total} dia${r.total === 1 ? "" : "s"}${r.periodos > 1 ? ` em ${r.periodos} atrasos` : ""}` : "";
    return [atual, tot].filter(Boolean).join(" · ");
  };
  const admRow = (x) =>
    `<div class="admr ${x.fim ? "" : "aberto"}"><input data-h="mot" value="${esc(x.mot || "")}" placeholder="Motivo (ex.: aguardando liberação de postes pela concessionária)" aria-label="Motivo"><input type="date" data-h="ini" value="${esc(x.ini || "")}" max="${todayISO()}" aria-label="Desde" title="Desde"><input type="date" data-h="fim" value="${esc(x.fim || "")}" max="${todayISO()}" aria-label="Até (em branco = em aberto)" title="Até (em branco = em aberto)"><span class="admd">${x.ini ? diasCorridos(x.ini, x.fim || todayISO()) + " d" : "–"}</span><span class="admst">${x.fim ? "encerrado" : "em aberto"}</span><button type="button" class="ico rm" data-rmadm title="Remover este atraso" aria-label="Remover este atraso">×</button><input type="hidden" data-h="por" value="${esc(x.por || "")}"></div>`;
  // atraso administrativo: dias e situação recalculados ao digitar "Desde"/"Até"
  const admAtual = (r) => {
    const ini = (r.querySelector('[data-h="ini"]') || {}).value || "",
      fim = (r.querySelector('[data-h="fim"]') || {}).value || "";
    const d = r.querySelector(".admd"),
      st = r.querySelector(".admst");
    if (d) d.textContent = ini ? diasCorridos(ini, fim && fim >= ini ? fim : todayISO()) + " d" : "–";
    if (st) st.textContent = fim ? "encerrado" : "em aberto";
    r.classList.toggle("aberto", !fim);
  };
  ["input", "change"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      const r = e.target.closest && e.target.closest(".admr");
      if (r && e.target.type === "date") admAtual(r);
    }),
  );
  /* parte: "stk" (stakeholders), "prazos" (vigência, implantação, aditivos e situação) ou "valores" */
  function openStk(parte) {
    parte = parte || "stk";
    const row = (c) =>
      `<div class="sr c"><input data-c="funcao" list="dlFunc" value="${esc(funcaoAtual(c.funcao) || "")}" placeholder="Função" aria-label="Função"><input data-c="nome" value="${esc(c.nome || "")}" placeholder="Nome" aria-label="Nome">${ctCampos(c)}<button type="button" class="ico rm" data-rm title="Remover contato" aria-label="Remover contato"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
    const list = (side) =>
      `<div class="clist" data-side="${side}">${contacts(side).map(row).join("")}</div><button type="button" class="btn ghost addc" data-addc="${side}">+ Adicionar contato</button>`;
    const form = $("#formStk");
    const secStk = `
    <section class="sbox"><h4>DGT Tecnologia</h4><div class="shead c"><span>Função</span><span>Nome</span><span>E-mail</span><span>Telefone</span><span></span></div>${list("dgt")}</section>
    <section class="sbox"><h4>Cliente</h4>
      <div class="sr two"><label><span class="sl">Órgão / cliente</span><input name="cliente" value="${esc(stk.cliente || "")}" placeholder="Ex.: Prefeitura Municipal de …"></label><label><span class="sl">Contrato</span><input name="contrato" value="${esc(stk.contrato || "")}" placeholder="Ex.: Contrato nº 000/2026"></label></div>
      <div class="shead c"><span>Função</span><span>Nome</span><span>E-mail</span><span>Telefone</span><span></span></div>${list("cli")}</section>`;
    const secPrazos = `
    <section class="sbox full">
      <div class="pz">
        <div class="pzc"><span class="pzt">Vigência</span>
          <label><span class="sl">Data de assinatura</span><input type="date" name="assinatura" value="${esc(stk.assinatura || "")}"></label>
          <label class="lvig"><span class="sl">Prazo contratual (meses)</span><input type="number" min="0" name="prazoContrato" value="${esc(stk.prazoContrato || "")}"></label>
          <div class="pzr lvig"><span class="sl">Fim da vigência</span><b id="pzVig">–</b></div></div>
        <div class="pzc"><span class="pzt">Implantação</span>
          <label><span class="sl">Ordem de início</span><input type="date" name="oi" value="${esc(stk.oi || "")}"></label>
          <label><span class="sl">Prazo de implantação (dias)</span><input type="number" min="0" name="prazoImpl" value="${esc(stk.prazoImpl || "")}"></label>
          <label><span class="sl">Reunião de APC</span><input type="date" name="apc" value="${esc(stk.apc || "")}"></label>
          <div class="pzr"><span class="sl">Limite de implantação</span><b id="pzLim">–</b></div></div>
      </div>
      <div class="pz" style="margin-top:14px">
        <div class="pzc adbox"><span class="pzt">Aditivos de prazo</span>
          <div class="adh"><span>Nº / termo</span><span>Aplica em</span><span>Acréscimo</span><span>Data</span><span></span></div>
          <div class="adlist">${(stk.aditivos || []).map(adRow).join("")}</div>
          <button type="button" class="btn ghost addc" data-addad>+ Adicionar aditivo</button></div>
      </div>
      <div class="pz" style="margin-top:14px"><div class="pzc adbox"><span class="pzt">Situação administrativa</span>
        <p class="hint" style="grid-column:1/-1;margin:0">Atrasos administrativos (pendência de terceiro, cliente ou demais áreas). O projeto pode ter vários, inclusive ao mesmo tempo; com “Até” em branco, o atraso está em aberto.</p>
        <div class="admbox" style="grid-column:1/-1"><div class="admh"><span>Motivo</span><span>Desde</span><span>Até</span><span>Dias</span><span></span><span></span></div>${admApc(stk) ? `<p class="hint admauto">Automático: <b>${APC_MOT}</b> · ${fmtD(admApc(stk).ini)} a ${admApc(stk).fim ? fmtD(admApc(stk).fim) : "hoje (APC em " + fmtD(stk.apc) + ")"}</p>` : ""}<div class="admlist">${admHist(stk)
          .filter((x) => !x.auto)
          .slice()
          .sort((x, y) => (!x.fim && y.fim ? -1 : x.fim && !y.fim ? 1 : (y.ini || "9").localeCompare(x.ini || "9")))
          .map(admRow)
          .join("")}</div>
          ${admResumo(stk).semInicio ? `<p class="hint bad">Informe o “Desde” do atraso em aberto: a data de início não foi registrada.</p>` : ""}
          <button type="button" class="btn ghost addc" data-addadm>+ Adicionar atraso administrativo</button>
          ${admResumo(stk).total ? `<p class="hint">Total em atraso administrativo no projeto: <b>${admResumo(stk).total} dias</b>${admResumo(stk).periodos > 1 ? ` em ${admResumo(stk).periodos} atrasos (dias sobrepostos contam uma vez)` : ""}.</p>` : ""}</div></div></div>
      <p class="hint">Dias corridos contados a partir da própria data (dia 1 = assinatura ou ordem de início). A ordem de início conta o prazo contratual; o cronograma é planejado a partir da reunião de APC (sem APC, da ordem de início). APC depois da ordem de início: o intervalo entra como atraso administrativo automático.</p>
    </section>`;
    const secValores = `
    <section class="sbox full">
      <div class="pz one">
        <div class="pzc"><span class="pzt">Valor do contrato</span>
          <label style="grid-column:1/-1"><span class="sl">Objeto do contrato</span><textarea name="objeto" rows="3" class="objta" placeholder="Ex.: locação de sistema de videomonitoramento para as escolas municipais…">${esc(stk.objeto || "")}</textarea></label>
          <label style="grid-column:1/-1"><span class="sl">Natureza</span><select name="natureza" class="natsel"><option value="locacao" ${!isAq() && !isDoa() ? "selected" : ""}>Locação (mensal)</option><option value="aquisicao" ${isAq() ? "selected" : ""}>Aquisição (parcela única após o T.A.D.)</option><option value="doacao" ${isDoa() ? "selected" : ""}>Doação (sem contrato e sem faturamento)</option></select></label>
          <label class="lval"><span class="sl">Valor total (R$)</span><input class="money" inputmode="numeric" name="valorContrato" value="${fmtMoney(stk.valorContrato)}" placeholder="0,00"></label>
          <label class="lmeses"><span class="sl">Dividido em (meses)</span><input type="number" min="0" name="mesesValor" value="${esc(stk.mesesValor || "")}"></label>
          <label class="lmeses" style="grid-column:1/-1"><span class="sl">Faturamento a partir de</span><select name="fatInicio"><option value="" ${stk.fatInicio !== "assinatura" ? "selected" : ""}>T.A.D. (fim da implantação)</option><option value="assinatura" ${stk.fatInicio === "assinatura" ? "selected" : ""}>Assinatura do contrato</option></select></label>
          <div class="pzr pzParcR"><span class="sl" id="pzParcL">Parcela mensal</span><b id="pzParc">–</b></div></div>
      </div>
    </section>`;
    const titulo = { stk: "Stakeholders", prazos: "Prazos do contrato", valores: "Valores do contrato" }[parte];
    form.innerHTML = `<h3>${titulo}</h3>
  <div class="sgrid">${parte === "stk" ? secStk : parte === "prazos" ? secPrazos : secValores}</div>
  ${parte === "stk" ? `<datalist id="dlFunc">${["Pré-vendas", "Comercial", "PMO do projeto", "Implantação", "Infraestrutura", "Coordenador de implantação", "Responsável técnico", "Fiscal do contrato", "Gestor do contrato", "Contato financeiro", "Secretário(a)", "TI do cliente"].map((x) => `<option value="${x}">`).join("")}</datalist>
  <p class="hint">Use apenas nome e contato profissional. Não registre CPF, CNPJ, senhas ou dados bancários.</p>` : ""}
  <div class="actions"><button type="button" class="btn" id="stkCancel">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>`;
    const readAd = () =>
      [...form.querySelectorAll(".adlist .adr")]
        .map((r) => {
          const o = {};
          r.querySelectorAll("[data-a]").forEach(
            (x) => (o[x.dataset.a] = x.value.trim()),
          );
          o.qtd = o.qtd === "" ? "" : +o.qtd;
          return o;
        })
        .filter((o) => o.num || o.qtd || o.data);
    const upd = () => {
      if (parte === "stk") return;
      const d = Object.assign({}, stk, Object.fromEntries(new FormData(form).entries()));
      const P = calcPrazos(
        Object.assign({}, d, {
          valorContrato: parte === "valores" ? parseMoney(d.valorContrato) : stk.valorContrato,
          aditivos: parte === "prazos" ? readAd() : stk.aditivos || [],
        }),
      );
      const txt = (sel, v) => {
        const el = form.querySelector(sel);
        if (el) el.textContent = v;
      };
      txt("#pzVig", P.vig ? fmtD(P.vig) + (P.addVig ? ` (+${fmtN(P.addVig)} m)` : "") : "–");
      txt("#pzLim", P.lim ? fmtD(P.lim) + (P.addImpl ? ` (+${fmtN(P.addImpl)} d)` : "") : "–");
      txt("#pzParc", P.parcela ? BRL(P.parcela) : "–");
      txt("#pzParcL", P.aq ? "Parcela única" : "Parcela mensal");
      const doa = d.natureza === "doacao";
      form
        .querySelectorAll(".lmeses,.lvig,.optvig")
        .forEach((lm) => (lm.style.display = P.aq || doa ? "none" : ""));
      form.querySelectorAll(".lval,.pzParcR").forEach((lm) => (lm.style.display = doa ? "none" : ""));
      form.querySelectorAll(".adr").forEach((r) => {
        const t = r.querySelector('[data-a="tipo"]').value;
        r.querySelector(".adu").textContent = t === "vig" ? "meses" : "dias";
      });
    };
    form.oninput = () => setTimeout(upd, 0);
    upd();
    form.onchange = upd;
    form.onclick = (e) => {
      if (e.target.closest("[data-addad]")) {
        form
          .querySelector(".adlist")
          .insertAdjacentHTML("beforeend", adRow({ tipo: "impl" }));
        form
          .querySelector(".adlist")
          .lastElementChild.querySelector("input")
          .focus();
        upd();
        return;
      }
      const rh = e.target.closest("[data-rmadm]");
      if (rh) {
        rh.closest(".admr").remove();
        return;
      }
      if (e.target.closest("[data-addadm]")) {
        const L = form.querySelector(".admlist");
        L.insertAdjacentHTML("afterbegin", admRow({ ini: todayISO(), fim: "", mot: "", por: (SESS().usuario && SESS().usuario.nome) || "" }));
        L.firstElementChild.querySelector('[data-h="mot"]').focus();
        return;
      }
      const ra = e.target.closest("[data-rmad]");
      if (ra) {
        ra.closest(".adr").remove();
        upd();
        return;
      }
      const a = e.target.closest("[data-addc]");
      if (a) {
        const L = form.querySelector(`.clist[data-side="${a.dataset.addc}"]`);
        L.insertAdjacentHTML("beforeend", row({}));
        L.lastElementChild.querySelector("input").focus();
        return;
      }
      const rm = e.target.closest("[data-rm]");
      if (rm) {
        rm.closest(".sr").remove();
      }
    };
    $("#stkCancel").onclick = () => $("#dlgStk").close();
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      const n = Object.assign({}, stk);
      if (parte === "stk") {
        n.cliente = (d.cliente || "").trim();
        n.contrato = (d.contrato || "").trim();
      ["dgt", "cli"].forEach((side) => {
        n[side] = [...form.querySelectorAll(`.clist[data-side="${side}"] .sr`)]
          .map((r) => {
            const o = {};
            r.querySelectorAll("[data-c]").forEach(
              (x) => (o[x.dataset.c] = x.value.trim()),
            );
            return ctJunta(o);
          })
          .filter((o) => o.funcao || o.nome || o.contato);
      });
      }
      if (parte === "prazos") {
        n.assinatura = d.assinatura || "";
        n.prazoContrato = d.prazoContrato === "" ? "" : +d.prazoContrato;
        n.oi = d.oi || "";
        n.apc = d.apc || "";
        n.prazoImpl = d.prazoImpl === "" ? "" : +d.prazoImpl;
        n.aditivos = readAd();
        {
          const hoje = todayISO();
          const quem = (SESS().usuario && SESS().usuario.nome) || "";
          const L = [...form.querySelectorAll(".admr")]
            .map((r) => {
              const v = (h) => (r.querySelector(`[data-h="${h}"]`) || {}).value || "";
              const ini = v("ini") && v("ini") <= hoje ? v("ini") : v("ini") ? hoje : "";
              let fim = v("fim");
              if (fim && fim > hoje) fim = hoje;
              if (ini && fim && fim < ini) fim = ini;
              return { ini, fim, mot: v("mot").trim(), por: v("por") || quem };
            })
            .filter((x) => x.mot || x.ini || x.fim);
          L.sort((x, y) => (x.ini || "9").localeCompare(y.ini || "9"));
          n.admHist = L;
          const A = admApc(n);
          const ab = L.concat(A ? [A] : []).filter((x) => !x.fim);
          n.atrasoAdm = ab.length > 0;
          n.atrasoAdmMotivo = ab.map((x) => x.mot).filter(Boolean).join(" · ");
        }
      }
      if (parte === "valores") {
        n.natureza = ["aquisicao", "doacao"].includes(d.natureza) ? d.natureza : "locacao";
        n.objeto = (d.objeto || "").trim();
        n.valorContrato = n.natureza === "doacao" ? "" : parseMoney(d.valorContrato);
        n.mesesValor = n.natureza === "doacao" || d.mesesValor === "" ? "" : +d.mesesValor;
        n.fatInicio = n.natureza !== "doacao" && d.fatInicio === "assinatura" ? "assinatura" : "";
      }
      // aquisição e doação: sem vigência mensal nem aditivo de vigência
      if (n.natureza === "aquisicao" || n.natureza === "doacao") {
        n.prazoContrato = "";
        n.aditivos = (n.aditivos || []).filter((a) => a.tipo !== "vig");
      }
      const oiChanged = n.oi !== (stk.oi || "") || (n.apc || "") !== (stk.apc || "");
      stk = n;
      $("#dlgStk").close();
      saveStk();
      if (oiChanged) setTimeout(afterG3, 0);
    };
    $("#dlgStk").showModal();
  }
  function openFat(list, id) {
    if (list) {
      location.hash = "fxf";
      return;
    }
    const f0 = id ? boletins().find((b) => b.id === id) : null;
    const form = $("#formFat");
    const mv = ymOf(corte());
    const ff = firstFull(true);
    form.innerHTML = `<h3>${f0 ? "Editar" : "Novo"} boletim de medição</h3><div class="fgrid">
    <label>Competência (início)<input name="comp" type="month" required value="${esc(f0 ? f0.comp : ymAdd(mv, -1))}"></label>
    <label>Competência (fim, se período)<input name="compFim" type="month" value="${esc(f0 && f0.compFim !== f0.comp ? f0.compFim : "")}"></label>
    <label>Situação<select name="situacao"><option value="liberacao" ${!f0 || f0.situacao === "liberacao" ? "selected" : ""}>Em liberação</option><option value="liberado" ${f0 && f0.situacao === "liberado" ? "selected" : ""}>Liberado</option></select></label>
    <label>Valor (R$)<input name="valor" class="money" inputmode="numeric" required placeholder="0,00" value="${f0 ? fmtMoney(f0.valor) : ""}"></label>
    <label>Data de envio<input name="envio" type="date" required value="${esc(f0 ? f0.envio : corte())}"></label>
    <label>Data de liberação<input name="liberacao" type="date" value="${esc((f0 && f0.liberacao) || "")}"></label>
    <label class="fwide">NF(s)<input name="nf" value="${esc((f0 && f0.nf) || "")}" placeholder="Ex.: 1234, 1235"></label>
    <label class="fwide">Referência<input name="ref" value="${esc((f0 && f0.ref) || "")}" placeholder="Ex.: Medição 01 · pro rata"></label></div>
    <p class="hint">Boletim de período divide o valor igualmente entre as competências (centavos na última). Liberado exige data de liberação, não anterior ao envio.${ff ? ` 1ª parcela cheia planejada na competência ${ymLbl(ff.comp)} (${BRL(ff.v)}).` : ""}</p>
    <div class="actions"><button type="button" class="btn" id="fatCancel">Cancelar</button><button class="btn primary" type="submit">${f0 ? "Salvar" : "Registrar"}</button></div>`;
    $("#fatCancel").onclick = () => $("#dlgFat").close();
    form.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form).entries());
      if (d.compFim && d.compFim < d.comp) {
        toast("A competência final não pode ser anterior à inicial.");
        return;
      }
      if (d.situacao === "liberado" && !d.liberacao) {
        toast("Boletim liberado exige a data de liberação.");
        return;
      }
      if (d.liberacao && d.envio && d.liberacao < d.envio) {
        toast("A data de liberação não pode ser anterior ao envio.");
        return;
      }
      const o = {
        id: f0 ? f0.id : uid("f"),
        comp: d.comp,
        compFim: d.compFim || d.comp,
        situacao: d.situacao,
        valor: +parseMoney(d.valor) || 0,
        envio: d.envio,
        liberacao: d.situacao === "liberado" ? d.liberacao : d.liberacao || "",
        nf: (d.nf || "").trim(),
        ref: (d.ref || "").trim(),
        data: d.envio,
      };
      $("#dlgFat").close();
      put("faturamentos", o);
    };
    if (!$("#dlgFat").open) $("#dlgFat").showModal();
  }
  /* ---------- Pontos ---------- */
  const PONTO_TPL = [
    ["Infraestrutura", "Implantação", 15, 1],
    ["Energia", "Implantação", 7, 7],
    ["Link", "Implantação", 7, 7],
    ["Ajuste", "Implantação", 3, 1],
    ["Ativação", "Infraestrutura", 3, 1],
    ["Handover", "Infraestrutura", 6, 3],
  ];
  function ptFases() {
    return [...wbs().tree.entries()]
      .filter(([f, T]) => T.some((n) => n.ponto))
      .map(([f, T]) => ({
        f,
        pts: T.filter((n) => n.ponto).sort((a, b) => a.ponto - b.ponto),
      }));
  }
  function planPontos(f, pts, n, wOver) {
    const cur = pts.length;
    const all = pts.flatMap((p) => p.items);
    const Wtot =
      wOver ||
      all.reduce((s, i) => s + (+i.peso || 0), 0) ||
      PONTO_TPL.reduce((s, t) => s + t[2], 0);
    const tplP = pts[0];
    const tpl = tplP
      ? tplP.items.slice().sort((a, b) => (+a.seq || 0) - (+b.seq || 0))
      : null;
    const base = tpl
      ? tpl.map((i) => ({
          titulo: i.titulo,
          resp: i.resp,
          w: +i.peso || 0,
          marco: !!i.marco,
          d: i.duracao,
          grp: i.grp || "",
          gmode: i.gmode || "",
        }))
      : PONTO_TPL.map((t) => ({
          titulo: t[0],
          resp: t[1],
          w: t[2],
          marco: t[0] === "Handover",
          d: t[3],
        }));
    const bsum = base.reduce((s, t) => s + t.w, 0) || base.length;
    const per = (k) =>
      Math.round(((Wtot * ((base[k].w || 1) / bsum)) / n) * 1000) / 1000;
    const first0 = tpl ? tpl[0].pred : "G3-F" + p2(f - 1) + " (todas)";
    const tag = tplP ? "-P" + p2(tplP.ponto) + "-" : null;
    const firstFor = (pn) =>
      tag && first0 && first0.includes(tag)
        ? first0.split(tag).join("-P" + p2(pn) + "-")
        : first0;
    const fn = (all[0] && all[0].faseNome) || "";
    const writes = [];
    const keep = pts.slice(0, n),
      drop = pts.slice(n);
    keep.forEach((p) =>
      p.items
        .slice()
        .sort((a, b) => (+a.seq || 0) - (+b.seq || 0))
        .forEach((i, k) => {
          const np = k < base.length ? per(k) : +i.peso || 0;
          if (np !== +i.peso) writes.push(Object.assign({}, i, { peso: np }));
        }),
    );
    let next = pts.reduce((m, p) => Math.max(m, p.ponto), 0);
    for (let x = cur; x < n; x++) {
      next++;
      const pn = next;
      let prev = null;
      base.forEach((t, k) => {
        const code = `G3-F${p2(f)}-P${p2(pn)}-A${p2(k + 1)}`;
        writes.push({
          id: uid(),
          grupo: 3,
          ordem: Date.now() + f * 1e6 + x * 10 + k,
          faseNum: f,
          faseNome: fn,
          pacoteNum: pn,
          pacoteNome: "Ponto " + p2(pn),
          ponto: 1,
          seq: k + 1,
          codigo: code,
          titulo: t.titulo,
          resp: t.resp,
          peso: per(k),
          pred: k === 0 ? firstFor(pn) : prev,
          predTipo: "TI",
          duracao: t.d == null ? "" : t.d,
          durTpl: 1,
          ...(t.grp ? { grp: t.grp, gmode: t.gmode } : {}),
          inicio: "",
          fim: "",
          inicioRev: "",
          fimRev: "",
          inicioReal: "",
          fimReal: "",
          pctReal: 0,
          marco: t.marco,
          valor: "",
        });
        prev = code;
      });
    }
    return { writes, drop };
  }
  function openPontos() {
    const F = ptFases();
    const cur = F.length ? Math.max(...F.map((x) => x.pts.length)) : 1;
    const form = $("#formPts");
    form.innerHTML = `<h3>Número de pontos</h3><div class="fgrid"><label>Quantidade de pontos<input name="n" type="number" min="1" max="500" required value="${cur || 1}"></label></div>
  ${F.map((x) => {
    const t = x.pts[0]
      ? x.pts[0].items
          .slice()
          .sort((a, b) => (+a.seq || 0) - (+b.seq || 0))
          .map((i) => i.titulo)
      : [];
    return `<p class="hint"><b>Etapa ${x.f}:</b> ${t.map(esc).join(" → ")}</p>`;
  }).join("")}
  <div class="fgrid"><label>Infraestruturas por dia (capacidade)<input name="cap" type="number" min="1" max="100" value="${+cfg.capPontoDia || 2}"></label></div>
  <p class="hint">A capacidade escalona o início da primeira atividade de cada ponto: com 2 por dia, os pontos 01 e 02 começam no mesmo dia, 03 e 04 no dia seguinte, e assim por diante. A quantidade vale para todas as etapas estruturadas por ponto, mantendo o vínculo do ponto entre elas. O peso físico de cada etapa é dividido igualmente entre os pontos.</p>
  <div class="actions"><button type="button" class="btn" id="ptCancel">Cancelar</button><button class="btn primary" type="submit">Aplicar</button></div>`;
    $("#ptCancel").onclick = () => $("#dlgPts").close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const n = Math.max(1, Math.min(500, Math.round(+fd.get("n") || 1)));
      const cap = Math.max(1, Math.round(+fd.get("cap") || 2));
      if (cap !== (+cfg.capPontoDia || 2)) {
        cfg.capPontoDia = cap;
        saveCfg();
      }
      const plans = F.map((x) => planPontos(x.f, x.pts, n));
      const drop = plans.flatMap((pl) => pl.drop);
      if (drop.length) {
        const nd = drop.filter((p) =>
          p.items.some((i) => i.inicioReal || i.fimReal),
        ).length;
        const q = Math.max(...F.map((x) => Math.max(0, x.pts.length - n)));
        if (
          !(await askConfirm(
            `Remover ${q} ponto${q > 1 ? "s" : ""}${nd ? ` (há datas realizadas lançadas em ${nd} deles)` : ""}?`,
            "Remover",
          ))
        )
          return;
      }
      $("#dlgPts").close();
      drop.forEach((p) => p.items.forEach((i) => del("atividades", i.id)));
      const w = plans.flatMap((pl) => pl.writes);
      {
        const dropIds = new Set(drop.flatMap((p) => p.items.map((i) => i.id)));
        S.itens = S.itens.filter((x) => !dropIds.has(x.id));
        patchItems(
          w
            .map((o) => {
              const old = S.itens.find((x) => x.id === o.id);
              return old
                ? { id: o.id, fields: diffFields(old, o) }
                : { id: o.id, fields: clean(o), isNew: true };
            })
            .filter((p) => p.isNew || Object.keys(p.fields).length),
        );
        afterG3();
      }
      toast(`Projeto com ${n} ponto${n > 1 ? "s" : ""}.`);
    };
    $("#dlgPts").showModal();
  }

  /* ---------- Importação ---------- */
  const COLS_S = [
    "Sprint",
    "Item",
    "Responsável",
    "Esforço",
    "DoD",
    "Dependência",
    "Status",
  ];
  const COLS_W = [
    "Fase",
    "Pacote",
    "Atividade",
    "Predecessora",
    "Tipo",
    "Duração",
    "Início BL",
    "Fim BL",
    "Responsável",
    "Peso",
    "Marco",
    "Valor",
  ];
  function parseDate(s) {
    s = (s || "").trim();
    if (!s) return "";
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      return y + "-" + p2(m[2]) + "-" + p2(m[1]);
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : "";
  }
  function parseNum(s) {
    s = (s || "")
      .trim()
      .replace(/R\$\s?/, "")
      .replace("%", "")
      .replace(/\./g, "")
      .replace(",", ".");
    return s === "" ? "" : isNaN(+s) ? "" : +s;
  }
  function parseStatus(s) {
    s = (s || "").toLowerCase();
    if (/conclu|feito|done/.test(s)) return "concluido";
    if (/andamento|doing|exec/.test(s)) return "andamento";
    if (/bloq|block/.test(s)) return "bloqueado";
    return "backlog";
  }
  function openImport(g) {
    const cols = g === 3 ? COLS_W : COLS_S;
    const form = $("#formImport");
    form.innerHTML = `<h3>Colar em lote · G${g} ${GRUPOS[g].nome}</h3>
  <p class="hint">Copie as linhas do Excel ou Smartsheet, uma atividade por linha, colunas separadas por tabulação ou ponto e vírgula, nesta ordem:</p>
  <p class="hint" style="color:var(--ink);font-weight:600">${cols.join(" | ")}</p>
  <p class="hint">Uma linha de cabeçalho é ignorada. IDs são gerados automaticamente.</p>
  <textarea id="impTxt" aria-label="Linhas para importar"></textarea><p class="hint" id="impPrev">Nenhuma linha reconhecida.</p>
  <div class="actions"><button type="button" class="btn" id="impCancel">Cancelar</button><button class="btn primary" type="submit" id="impGo" disabled>Importar</button></div>`;
    const ta = $("#impTxt");
    let parsed = [];
    ta.oninput = () => {
      parsed = parseLines(g, ta.value);
      $("#impPrev").textContent = parsed.length
        ? parsed.length + " linha(s) prontas para importar."
        : "Nenhuma linha reconhecida.";
      $("#impGo").disabled = !parsed.length;
    };
    $("#impCancel").onclick = () => $("#dlgImport").close();
    form.onsubmit = (e) => {
      e.preventDefault();
      $("#dlgImport").close();
      patchItems(
        parsed.map((o) => ({ id: o.id, fields: clean(o), isNew: true })),
      );
      if (g === 3) afterG3();
      toast(parsed.length + " itens importados.");
    };
    $("#dlgImport").showModal();
    ta.focus();
  }
  function parseLines(g, txt) {
    const out = [];
    let t = Date.now();
    txt
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .forEach((l, idx) => {
        const c = (l.includes("\t") ? l.split("\t") : l.split(";")).map((x) =>
          x.trim(),
        );
        if (idx === 0 && /^(sprint|fase)$/i.test(c[0])) return;
        if (g === 3) {
          if (!c[2]) return;
          const fnome = c[0] || "Fase sem nome",
            pnome = c[1] || "Pacote sem nome";
          const fn = faseNumFor(fnome, out),
            pn = pacoteNumFor(fn, pnome, out);
          const it = {
            id: uid(),
            grupo: 3,
            ordem: t++,
            faseNome: fnome,
            pacoteNome: pnome,
            faseNum: fn,
            pacoteNum: pn,
            titulo: c[2],
            pred: c[3] || "",
            predTipo: c[3] ? (c[4] || "TI").toUpperCase() : "",
            duracao: parseNum(c[5]),
            inicio: parseDate(c[6]),
            fim: parseDate(c[7]),
            resp: c[8] || "",
            peso: parseNum(c[9]),
            pctReal: 0,
            marco: /^s/i.test(c[10] || ""),
            valor: parseNum(c[11]),
          };
          normDates(it);
          assignCode(it, out);
          out.push(it);
        } else {
          if (!c[1]) return;
          const it = {
            id: uid(),
            grupo: g,
            ordem: t++,
            sprint: +parseNum(c[0]) || 1,
            titulo: c[1],
            resp: c[2] || "",
            esforco: parseNum(c[3]),
            dod: c[4] || "",
            dep: c[5] || "",
            status: parseStatus(c[6]),
          };
          assignCode(it, out);
          out.push(it);
        }
      });
    return out;
  }
  async function exportSmartsheet() {
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    toast("Gerando planilha para o Smartsheet…");
    try {
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
      );
      const wb = new window.ExcelJS.Workbook();
      wb.creator = "Painel do projeto";
      const D = (v) => (v ? new Date(v + "T12:00:00") : null);
      const style = (ws, widths) => {
        ws.columns.forEach((c, k) => (c.width = widths[k] || 14));
        const h = ws.getRow(1);
        h.font = { bold: true };
        h.alignment = { vertical: "middle", wrapText: true };
        h.height = 30;
        ws.views = [{ state: "frozen", ySplit: 1 }];
      };
      /* 1. Cronograma G3 (projeto Smartsheet) */
      const rows = cronoRows();
      const W = wbs();
      const L = ofG(3);
      const byId = new Map(L.map((i) => [i.id, i]));
      const byCode = new Map(
        L.filter((i) => i.codigo).map((i) => [i.codigo, i]),
      );
      const byFase = new Map();
      L.forEach((i) => {
        const f = +i.faseNum || 0;
        if (!byFase.has(f)) byFase.set(f, []);
        byFase.get(f).push(i);
      });
      const byNum = new Map();
      W.num.forEach((n, id) => byNum.set(n, id));
      const ctx = { byFase, byCode, byNum };
      const rowOf = new Map();
      rows.forEach((x, k) => {
        if (x.it) rowOf.set(x.it.id, k + 1);
      });
      const TT = { TI: "FS", II: "SS", TT: "FF", IT: "SF" };
      const ws = wb.addWorksheet("Cronograma G3");
      ws.columns = [
        { header: "Nome da tarefa" },
        { header: "EAP" },
        { header: "Nível" },
        { header: "Responsável" },
        { header: "Status" },
        { header: "% concluído" },
        { header: "Duração" },
        { header: "Início" },
        { header: "Término" },
        { header: "Predecessores" },
        { header: "Início linha de base (R00)" },
        { header: "Término linha de base (R00)" },
        { header: "Início real" },
        { header: "Término real" },
        { header: "Observação" },
      ];
      rows.forEach((x, k) => {
        let pr = "";
        if (x.it) {
          const ids = predIds(x.it, ctx).filter((id) => rowOf.has(id));
          const t = TT[String(x.it.predTipo || "TI").toUpperCase()] || "FS";
          pr = ids
            .map((id) => rowOf.get(id) + (t === "FS" ? "" : t))
            .join(", ");
        }
        const durV = x.it
          ? x.it.duracao !== "" && x.it.duracao != null
            ? `${+x.it.duracao}d`
            : ""
          : "";
        const lv = x.ol || (x.it ? (x.it.ponto ? 3 : 2) : x.lvl);
        const row = ws.addRow([
          x.nome,
          x.eap,
          lv,
          x.resp || "",
          x.st,
          Math.round((x.pct || 0) * 1000) / 1000,
          durV,
          x.it ? D(x.ra) : null,
          x.it ? D(x.rb) : null,
          pr,
          D(x.a),
          D(x.b),
          D(x.ea),
          D(x.eb),
          x.obs || "",
        ]);
        row.outlineLevel = Math.min(7, lv);
        if (x.lvl < 3) row.font = { bold: true };
      });
      ws.getColumn(6).numFmt = "0%";
      [8, 9, 11, 12, 13, 14].forEach(
        (c) => (ws.getColumn(c).numFmt = "dd/mm/yyyy"),
      );
      ws.properties.outlineProperties = { summaryBelow: false };
      style(ws, [48, 10, 7, 24, 14, 12, 10, 13, 13, 22, 15, 15, 13, 13, 40]);
      /* 2. Grupos Scrum */
      const wg = wb.addWorksheet("G1 G2 G4 G5");
      wg.columns = [
        { header: "Nome da tarefa" },
        { header: "Grupo" },
        { header: "ID" },
        { header: "Responsável" },
        { header: "Status" },
        { header: "Início" },
        { header: "Término" },
        { header: "Dependência" },
        { header: "Critério de aceite (DoD)" },
      ];
      [1, 2, 4, 5].forEach((g) => {
        const P = grpDates(g);
        const hdr = wg.addRow([
          `G${g} · ${GRUPOS[g].nome}`,
          `G${g}`,
          "",
          "",
          "",
          P ? D(P[0]) : null,
          P ? D(P[1]) : null,
          "",
          "",
        ]);
        hdr.font = { bold: true };
        hdr.outlineLevel = 0;
        ofG(g)
          .slice()
          .sort((a, b) => String(a.codigo).localeCompare(b.codigo))
          .forEach((i) => {
            const r2 = wg.addRow([
              i.titulo,
              `G${g}`,
              i.codigo,
              i.resp || "",
              stOpts(g)[stG(g, i.status)] || "",
              P ? D(P[0]) : null,
              P ? D(P[1]) : null,
              i.dep || "",
              i.dod || "",
            ]);
            r2.outlineLevel = 1;
          });
      });
      [6, 7].forEach((c) => (wg.getColumn(c).numFmt = "dd/mm/yyyy"));
      style(wg, [46, 8, 14, 22, 16, 13, 13, 28, 50]);
      /* 3. Pontos (vistoria e implantação) */
      const F = ptFases()[0];
      if (F) {
        const wp = wb.addWorksheet("Pontos");
        const V = cfg.vist || {};
        wp.columns = [
          { header: "Ponto" },
          { header: "EAP" },
          { header: "Endereço" },
          { header: "Coordenadas" },
          { header: "Câmeras VMS" },
          { header: "Câmeras CE" },
          { header: "Licenças VMS" },
          { header: "Licenças Rec. Facial" },
          { header: "Licenças Análise de vídeo" },
          { header: "Infraestrutura" },
          { header: "Energia" },
          { header: "Link" },
          { header: "% concluído" },
          { header: "Status" },
          { header: "Observação" },
        ];
        F.pts.forEach((p) => {
          const v = V[p.ponto] || {};
          const md = (g) => {
            const m = modeOf(p.items.filter((i) => grpOf(i) === g));
            return m === "simples" ? "" : PMODES[g].opts[m].l;
          };
          const pc = rollPct(p.items);
          wp.addRow([
            p.nome || "Ponto " + p2(p.ponto),
            p.num,
            v.end || "",
            v.coord || (v.lat && v.lng ? `${v.lat}, ${v.lng}` : ""),
            +v.camVMS || 0,
            +v.camCE || 0,
            +v.licVMS || 0,
            +v.licRF || 0,
            +v.licAV || 0,
            v.infra || "",
            md("energia"),
            md("link"),
            pc,
            STX(pc)[1],
            v.obs || "",
          ]);
        });
        wp.getColumn(13).numFmt = "0%";
        style(wp, [18, 8, 40, 26, 12, 12, 12, 14, 16, 18, 32, 22, 12, 14, 40]);
      }
      /* 4. Físico x financeiro mensal */
      const r = finRange();
      if (r) {
        const wf = wb.addWorksheet("Fisico x financeiro");
        const R0 = sched(false),
          RV = sched(true),
          RA = realAlloc();
        const sum = (E, bm) =>
          E.filter((e) => e.bill === bm).reduce((a, e) => a + e.v, 0);
        wf.columns = [
          { header: "Mês de faturamento" },
          { header: "Competência" },
          { header: "Planejado R00" },
          { header: `Revisão ${revName(selRevN())}` },
          { header: "Realizado" },
          { header: "Diferença" },
          { header: "NF até" },
          { header: "Recebimento" },
        ];
        r.months.forEach((bm) => {
          const c = ymAdd(bm, -1);
          const a = sum(R0, bm),
            b = sum(RV, bm),
            f = sum(RA, bm);
          const nf = nfDate(c);
          wf.addRow([
            ymLbl(bm),
            ymLbl(c),
            a,
            b,
            f,
            f - b,
            D(nf),
            D(recDate(nf)),
          ]);
        });
        [3, 4, 5, 6].forEach((c) => (wf.getColumn(c).numFmt = '"R$" #,##0.00'));
        [7, 8].forEach((c) => (wf.getColumn(c).numFmt = "dd/mm/yyyy"));
        style(wf, [18, 14, 16, 16, 16, 16, 13, 13]);
      }
      /* 5. Boletins */
      const B = boletins();
      if (B.length) {
        const wbm = wb.addWorksheet("Boletins");
        wbm.columns = [
          { header: "Competência" },
          { header: "Competência final" },
          { header: "Situação" },
          { header: "Envio" },
          { header: "Liberação" },
          { header: "NF" },
          { header: "Referência" },
          { header: "Valor" },
        ];
        B.forEach((b) =>
          wbm.addRow([
            ymLbl(b.comp),
            ymLbl(b.compFim),
            SIT[b.situacao],
            D(b.envio),
            D(b.liberacao),
            b.nf || "",
            b.ref || "",
            +b.valor || 0,
          ]),
        );
        [4, 5].forEach((c) => (wbm.getColumn(c).numFmt = "dd/mm/yyyy"));
        wbm.getColumn(8).numFmt = '"R$" #,##0.00';
        style(wbm, [14, 16, 14, 13, 13, 16, 30, 16]);
      }
      /* 6. Itens do contrato */
      const IC = itensC();
      if (IC.length) {
        const wi = wb.addWorksheet("Itens do contrato");
        wi.columns = [
          { header: "Item" },
          { header: "Código" },
          { header: "Descrição" },
          { header: "Qtd/mês" },
          { header: "Un" },
          { header: "Valor unitário" },
          { header: "Total mensal" },
        ];
        IC.forEach((i) =>
          wi.addRow([
            i.item,
            i.codigo,
            i.descricao,
            +i.qtd || 0,
            i.un || "UN",
            +i.vu || 0,
            itTot(i),
          ]),
        );
        [6, 7].forEach((c) => (wi.getColumn(c).numFmt = '"R$" #,##0.00'));
        style(wi, [8, 12, 56, 10, 6, 16, 16]);
      }
      /* 7. Contrato */
      const wc = wb.addWorksheet("Contrato");
      wc.columns = [
        { header: "Campo" },
        { header: "Valor" },
        { header: "Detalhe" },
      ];
      const P = prazos();
      const fp = finParams();
      [
        ["Projeto", cfg.nome || ""],
        ["Cliente", stk.cliente || ""],
        ["Contrato", stk.contrato || ""],
        ["Natureza", isAq() ? "Aquisição (parcela única)" : "Locação"],
        ["Assinatura", D(stk.assinatura)],
        ["Ordem de início", D(stk.oi)],
        ["Prazo de implantação (dias)", +stk.prazoImpl || ""],
        ["Limite de implantação", D(P.lim)],
        ["Fim da vigência", D(P.vig)],
        ["Valor total", fp.total || 0],
        ["Parcela", fp.M || 0, isAq() ? "parcela única" : `${fp.n} meses`],
      ].forEach((x) => wc.addRow(x));
      (stk.aditivos || []).forEach((a) =>
        wc.addRow([
          `Aditivo · ${a.num || ""}`,
          `+${a.qtd || 0} ${a.tipo === "vig" ? "meses" : "dias"}`,
          a.tipo === "vig" ? "Vigência" : "Implantação",
        ]),
      );
      contacts("dgt").forEach((c) =>
        wc.addRow([`DGT · ${c.funcao || ""}`, c.nome || "", ctEmail(c), ctTel(c)]),
      );
      contacts("cli").forEach((c) =>
        wc.addRow([
          `Cliente · ${c.funcao || ""}`,
          c.nome || "",
          ctEmail(c),
          ctTel(c),
        ]),
      );
      wc.getColumn(2).numFmt = "@";
      [5, 6, 8, 9].forEach((rw) => {
        const cl = wc.getRow(rw).getCell(2);
        if (cl.value instanceof Date) cl.numFmt = "dd/mm/yyyy";
      });
      [10, 11].forEach(
        (rw) => (wc.getRow(rw).getCell(2).numFmt = '"R$" #,##0.00'),
      );
      style(wc, [34, 44, 30]);
      const buf = await wb.xlsx.writeBuffer();
      await downloads.save({
        filename: `smartsheet-${fileBase().replace(/^cronograma-/, "")}.xlsx`,
        data: new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
    } catch (e) {
      toast("Não foi possível gerar a planilha: " + ((e && e.message) || e));
    }
  }
  function cronoRows() {
    const W = wbs();
    const n = hasRevs() ? selRevN() : 0;
    const out = [];
    const c = corte();
    const roll = (ch) => {
      const a = ch
          .map((i) => i.inicio)
          .filter(Boolean)
          .sort()[0],
        b = ch
          .map((i) => i.fim)
          .filter(Boolean)
          .sort()
          .pop();
      const ra = ch
          .map((i) => revDates(i, n)[0])
          .filter(Boolean)
          .sort()[0],
        rb = ch
          .map((i) => revDates(i, n)[1])
          .filter(Boolean)
          .sort()
          .pop();
      const ea = ch
          .map((i) => i.inicioReal)
          .filter(Boolean)
          .sort()[0],
        eb =
          ch.length && ch.every((i) => i.fimReal)
            ? ch
                .map((i) => i.fimReal)
                .sort()
                .pop()
            : "";
      const p = rollPct(ch);
      return {
        a,
        b,
        ra,
        rb,
        ea,
        eb,
        p,
        dur: ra && rb ? Math.round((dt(rb) - dt(ra)) / DAY) + 1 : "",
      };
    };
    const all = fasesWF().flatMap((f) => W.byFase.get(f.num) || []);
    const R0 = roll(all);
    out.push({
      lvl: 0,
      eap: "0",
      nome: cfg.nome || "Projeto",
      resp: "",
      st: STX(R0.p)[1],
      pct: R0.p,
      ...R0,
      pred: "",
      obs: (cfg.obsGrp || {}).proj || "",
    });
    // linhas escondidas na tela (etapa, grupo ou ponto recolhido) ficam marcadas com oc: o PDF as omite
    const ocP = collapsed.has("proj");
    fasesWF().forEach((f) => {
      const ch = W.byFase.get(f.num) || [];
      const R = roll(ch);
      const fk = "f" + f.num;
      const ocF = ocP || collapsed.has(fk);
      out.push({
        oc: ocP,
        lvl: 1,
        eap: String(f.num),
        nome: (f.nome || "").replace(/^Frente\s*\d+\s*[·\-–]\s*/i, ""),
        resp: "",
        st: STX(R.p)[1],
        pct: R.p,
        ...R,
        pred: predTxt(ch[0] && ch[0].pred, W).replace(/&amp;/g, "&"),
        obs: (cfg.obsGrp || {})["f" + f.num] || "",
      });
      const nivel = (eap) => String(eap).split(".").length;
      // grupo/subgrupo: linha de resumo e, abaixo, o que estiver dentro (recursivo)
      const grp = (nd, key, oc) => {
        const R = roll(nd.items);
        const ocB = oc || collapsed.has(key);
        out.push({
          oc,
          lvl: 2,
          ol: nivel(nd.num),
          eap: nd.num,
          nome: nd.bloco,
          resp: "",
          st: STX(R.p)[1],
          pct: R.p,
          ...R,
          pred: "",
          obs: (cfg.obsGrp || {})[key] || "",
        });
        return nd.pts.flatMap((pt, m) => (pt.bloco ? grp(pt, key + "s" + (m + 1), ocB) : [{ nd: pt, oc: ocB }]));
      };
      (W.top.get(f.num) || []).flatMap((nd, k) => (nd.bloco ? grp(nd, fk + "b" + (k + 1), ocF) : [{ nd, oc: ocF }])).forEach(({ nd, oc }) => {
        const item = (i) => {
          const d = revDates(i, n);
          const pc = pctFromDates(i) / 100;
          return {
            it: i,
            lvl: 3,
            ol: nivel(W.num.get(i.id)),
            eap: W.num.get(i.id),
            nome: i.titulo,
            resp: i.resp || "",
            st: STX(pc)[1],
            pct: pc,
            dur: i.duracao,
            a: i.inicio,
            b: i.fim,
            ra: d[0],
            rb: d[1],
            ea: i.inicioReal,
            eb: i.fimReal,
            pred:
              predTxt(i.pred, W).replace(/&amp;/g, "&") +
              (i.pred && i.predTipo && i.predTipo !== "TI"
                ? " " + i.predTipo
                : ""),
            obs: i.obs || "",
            late: rF(i) && rF(i) < c && !i.fimReal,
          };
        };
        if (nd.item) out.push(Object.assign(item(nd.item), { oc }));
        else {
          const R = roll(nd.items);
          const ocI = oc || collapsed.has(fk + "p" + nd.ponto);
          out.push({
            oc,
            lvl: 2,
            ol: nivel(nd.num),
            eap: nd.num,
            nome: nd.nome || "Ponto " + p2(nd.ponto),
            resp: "",
            st: STX(R.p)[1],
            pct: R.p,
            ...R,
            pred: predTxt(nd.items[0] && nd.items[0].pred, W).replace(
              /&amp;/g,
              "&",
            ),
            obs: (cfg.obsGrp || {})["f" + f.num + "p" + nd.ponto] || "",
          });
          // atividades do ponto, com os subgrupos de dentro dele
          const emit = (L, key, oc2) =>
            L.forEach((k, m) => {
              if (k.item) return out.push(Object.assign(item(k.item), { oc: oc2 }));
              const kk = key + "s" + (m + 1);
              const R2 = roll(k.items);
              out.push({ oc: oc2, lvl: 2, ol: nivel(k.num), eap: k.num, nome: k.bloco, resp: "", st: STX(R2.p)[1], pct: R2.p, ...R2, pred: "", obs: (cfg.obsGrp || {})[kk] || "" });
              emit(k.pts, kk, oc2 || collapsed.has(kk));
            });
          emit(nd.kids || nd.items.map((i) => ({ item: i })), fk + "p" + nd.ponto, ocI);
        }
      });
    });
    return out;
  }
  const pctTxt = (v) =>
    (Math.round((v || 0) * 1000) / 10).toLocaleString("pt-BR") + "%";
  async function exportCSV(g) {
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
    const RV = hasRevs();
    const n = selRevN();
    const head = [
      "EAP",
      "Nível",
      "Etapa / atividade",
      "Responsável",
      "Status",
      "% real",
      "Duração (d)",
      "Início planejado R00",
      "Fim planejado R00",
    ]
      .concat(RV ? [`Início ${revName(n)}`, `Fim ${revName(n)}`] : [])
      .concat([
        "Início realizado",
        "Fim realizado",
        "Predecessora",
        "Observação",
      ]);
    const rows = cronoRows().map((x) =>
      [
        x.eap,
        ["Projeto", "Etapa", "Ponto", "Atividade"][x.lvl],
        x.nome,
        x.resp,
        x.st,
        pctTxt(x.pct),
        x.dur,
        fmtD(x.a),
        fmtD(x.b),
      ]
        .concat(RV ? [fmtD(x.ra), fmtD(x.rb)] : [])
        .concat([fmtD(x.ea), fmtD(x.eb), x.pred, x.obs]),
    );
    [1, 2, 4, 5].forEach((gg) => {
      const P = grpDates(gg);
      ofG(gg).forEach((i) =>
        rows.push(
          [
            i.codigo,
            "G" + gg,
            i.titulo,
            i.resp || "",
            stOpts(gg)[stG(gg, i.status)] || "",
            "",
            P ? Math.round((dt(P[1]) - dt(P[0])) / DAY) + 1 : "",
            P ? fmtD(P[0]) : "",
            P ? fmtD(P[1]) : "",
          ]
            .concat(RV ? ["", ""] : [])
            .concat(["", "", i.dep || "", i.dod || ""]),
        ),
      );
    });
    const csv =
      "\uFEFF" +
      [head]
        .concat(rows)
        .map((r) => r.map(q).join(";"))
        .join("\r\n");
    try {
      await downloads.save({
        filename: fileBase() + ".csv",
        data: new Blob([csv], { type: "text/csv" }),
      });
    } catch (e) {
      toast("Não foi possível exportar: " + ((e && e.message) || e));
    }
  }
  const fileBase = () =>
    (
      "cronograma-" +
      String(cfg.nome || "projeto")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase()
    ).slice(0, 80);
  const loadJS = (src) =>
    window.__carregarBiblioteca ? window.__carregarBiblioteca(src) :
    new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const sc = document.createElement("script");
      sc.src = src;
      sc.onload = res;
      sc.onerror = () => rej(new Error("falha ao carregar " + src));
      document.head.appendChild(sc);
    });
  /* quadro consolidado do PDF do cronograma (de obra): situação da implantação e cliente/contrato
     (sem valores do contrato, contatos de pessoas nem status report) */
  function resumoCronPDF(doc, y, P) {
    const pt = (t) => String(t == null ? "" : t).replace(/[·›]/g, "-");
    const wf = metWF();
    const c = corte();
    const tot = { ok: 0, run: 0, late: 0, todo: 0 };
    ptFases().forEach((F) =>
      F.pts.forEach((p) => {
        const pc = rollPct(p.items);
        const late = p.items.some((i) => rF(i) && rF(i) < c && !i.fimReal);
        tot[pc >= 1 ? "ok" : late ? "late" : pc > 0 ? "run" : "todo"]++;
      }),
    );
    const nPt = tot.ok + tot.run + tot.late + tot.todo;
    const fimR = fimExec(true),
      tad = tadDate(true);
    const atrLim = P.lim && fimR ? Math.round((dt(fimR) - dt(P.lim)) / DAY) : null;
    const impl = [
      ["Físico real", `${fmtPct(wf.real)} (planejado ${hasRevs() ? `${revName(selRevN())} ${fmtPct(wf.planR)}` : fmtPct(wf.plan)})`],
      nPt ? ["Pontos", `${nPt} no total · ${tot.ok} concluídos · ${tot.run} em andamento · ${tot.late} atrasados · ${tot.todo} não iniciados`] : null,
      ["Atividades atrasadas", String(wf.late.length)],
      ["Término previsto", fimR ? fmtD(fimR) : "–"],
      ["T.A.D. previsto", tad ? fmtD(tad) : "–"],
      ["Limite de implantação", P.lim ? `${fmtD(P.lim)}${atrLim > 0 ? ` (término ${atrLim} d após o limite)` : ""}` : "–"],
    ].filter(Boolean);
    const cli = [
      ["Cliente", stk.cliente || "–"],
      ["Contrato", stk.contrato || "–"],
      ["Assinatura / vigência", `${stk.assinatura ? fmtD(stk.assinatura) : "–"}${P.vig ? " a " + fmtD(P.vig) : ""}`],
      stk.objeto ? ["Objeto", String(stk.objeto).slice(0, 260)] : null,
    ].filter(Boolean);
    const kv = (L) => L.map(([k, v]) => `${k}: ${v}`).join("\n");
    doc.autoTable({
      startY: y,
      margin: { left: 8, right: 8 },
      theme: "grid",
      head: [["Situação da implantação", "Cliente e contrato"]],
      body: [[pt(kv(impl)), pt(kv(cli))]],
      styles: { fontSize: 7, cellPadding: 1.6, valign: "top", overflow: "linebreak", lineColor: [210, 218, 225], lineWidth: 0.1 },
      headStyles: { fillColor: [43, 106, 140], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 130 } },
    });
    return doc.lastAutoTable.finalY + 4;
  }
  async function exportPDF() {
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    toast("Gerando PDF…");
    try {
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      );
      await loadJS(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
      );
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      // o PDF sai somente com a revisão vigente (a última), qualquer que seja a selecionada na tela
      revForce = cronRevs().length;
      const RV = hasRevs();
      const n = selRevN();
      // exporta como o cronograma está aberto na tela: etapas, grupos e pontos recolhidos não abrem
      const rows = cronoRows().filter((x) => !x.oc);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(String(cfg.nome || "Projeto"), 10, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(90);
      const P1 = grpDates(1),
        P2 = grpDates(2),
        P5 = grpDates(5),
        P = prazos();
      doc.text(
        `${stk.cliente || ""}${stk.contrato ? " · " + stk.contrato : ""} · Emitido em ${fmtD(todayISO())} · Revisão: ${revName(n)}`,
        10,
        17,
      );
      doc.text(`Limite de implantação: ${P.lim ? fmtD(P.lim) : "–"}`, 10, 21.5);
      const yh = 25;
      doc.setTextColor(0);
      const y0 = resumoCronPDF(doc, yh, P);
      const head = [
        [
          "EAP",
          "Etapa / atividade",
          "Resp.",
          "Status",
          "% real",
          "Dur.",
          RV ? `Planejado ${revName(n)}` : "Planejado",
        ]
          .concat(["Realizado", "Predec.", "Observação"]),
      ];
      const per = (a, b) => (a || b ? `${fmtD(a)} – ${fmtD(b)}` : "–");
      const pt = (t) => String(t == null ? "" : t).replace(/·/g, "-");
      const body = rows.map((x) =>
        [
          x.eap,
          (x.lvl ? "  ".repeat(Math.max(0, (x.ol || String(x.eap).split(".").length) - 1)) : "") + pt(x.nome),
          x.resp,
          x.st,
          pctTxt(x.pct),
          x.dur === "" || x.dur == null ? "" : x.dur + " d",
          RV ? per(x.ra, x.rb) : per(x.a, x.b),
        ]
          .concat([
            x.ea ? (x.eb ? per(x.ea, x.eb) : `${fmtD(x.ea)} – em curso`) : "–",
            x.pred || "–",
            x.obs || "",
          ]),
      );
      doc.autoTable({
        head,
        body,
        startY: y0,
        theme: "grid",
        margin: { left: 8, right: 8 },
        styles: {
          fontSize: 6.8,
          cellPadding: 1.1,
          lineColor: [210, 218, 225],
          lineWidth: 0.1,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [30, 43, 58],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 14 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 12, halign: "right" },
          5: { cellWidth: 11, halign: "right" },
        },
        didParseCell: (d) => {
          if (d.section !== "body") return;
          const x = rows[d.row.index];
          if (x.lvl === 0) {
            d.cell.styles.fillColor = [47, 74, 102];
            d.cell.styles.textColor = 255;
            d.cell.styles.fontStyle = "bold";
          } else if (x.lvl === 1) {
            d.cell.styles.fillColor = [230, 237, 244];
            d.cell.styles.fontStyle = "bold";
          } else if (x.lvl === 2) {
            d.cell.styles.fillColor = [243, 246, 249];
            d.cell.styles.fontStyle = "bold";
          } else if (x.late && d.column.index === 0) {
            d.cell.styles.textColor = [179, 38, 30];
          }
        },
        didDrawPage: () => {
          const pg = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(
            `Página ${pg}`,
            doc.internal.pageSize.getWidth() - 20,
            doc.internal.pageSize.getHeight() - 5,
          );
          doc.setTextColor(0);
        },
      });
      revForce = null;
      await downloads.save({
        filename: fileBase() + ".pdf",
        data: doc.output("blob"),
      });
    } catch (e) {
      revForce = null;
      toast("Não foi possível gerar o PDF: " + ((e && e.message) || e));
    }
  }

  /* ---------- Eventos ---------- */
  let toastT;
  // Copia para a área de transferência. Em endereço http (não seguro, ex.: http://DGT-NBK-IMP-03:8080)
  // o navigator.clipboard não existe; usa a cópia clássica por textarea (dentro do diálogo aberto).
  function copiarCopia(txt) {
    const host = document.querySelector("dialog[open]") || document.body;
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
    host.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {}
    ta.remove();
    return ok;
  }
  async function copiarTexto(txt) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(txt);
        return true;
      } catch (e) {}
    }
    return copiarCopia(txt);
  }
  function toast(m) {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = m;
    clearTimeout(toastT);
    toastT = setTimeout(() => t.remove(), 3200);
  }
  document.addEventListener(
    "click",
    (e) => {
      const im = document.getElementById("icMenu");
      const gm = e.target.closest("[data-g3mode]");
      if (gm) {
        g3mode = gm.dataset.g3mode;
        try {
          localStorage.setItem("pmo-hibrido-g3mode", g3mode);
        } catch (e) {}
        render();
        return;
      }
      const ra = e.target.closest("[data-rtall]");
      if (ra) {
        RT.sel = new Set(
          ra.dataset.rtall === "1"
            ? rtPoints()
                .filter((x) => x.ok && (!RT.pend || !x.feito))
                .map((x) => x.pn)
            : [],
        );
        RT.route = null;
        render();
        return;
      }
      if (e.target.closest("[data-rtcalc]")) {
        const c = document.querySelector("[data-rtcustom]");
        if (c) RT.custom = c.value;
        rtCompute();
        if (!RT.route) toast("Selecione pontos com coordenadas.");
        render();
        return;
      }
      if (e.target.closest("[data-rtpdf]")) {
        rtPDF();
        return;
      }
      if (e.target.closest("[data-rtshow]")) {
        RT.showAll = !RT.showAll;
        render();
        return;
      }
      const fb = e.target.closest("[data-implf]");
      if (fb) {
        implF = implF === fb.dataset.implf ? "" : fb.dataset.implf;
        render();
        return;
      }
      const ic = e.target.closest("[data-icell]");
      if (ic) {
        openImplMenu(ic);
        return;
      }
      const ig = e.target.closest("[data-igrp]");
      if (ig) {
        openGrpMenu(ig);
        return;
      }
      if (e.target.closest("[data-vmodelo]")) {
        vistModelo();
        return;
      }
      if (e.target.closest("[data-vimport]")) {
        const fi = $("#vFile");
        if (fi) {
          fi.value = "";
          fi.click();
        }
        return;
      }
      const q = e.target.closest("[data-icq]");
      if (q) {
        const it = S.itens.find((x) => x.id === q.dataset.id);
        if (it) {
          const t = todayISO();
          const n = Object.assign({}, it);
          if (q.dataset.icq === "ini") {
            n.inicioReal = n.inicioReal || t;
          } else if (q.dataset.icq === "fim") {
            n.inicioReal = n.inicioReal || t;
            n.fimReal = t;
          } else {
            n.inicioReal = "";
            n.fimReal = "";
          }
          putItem(n);
        }
        if (im) im.hidden = true;
        return;
      }
      if (im && !im.hidden && !e.target.closest("#icMenu")) im.hidden = true;
    },
    true,
  );
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.rtp) {
      const pn = t.dataset.rtp;
      t.checked ? RT.sel.add(pn) : RT.sel.delete(pn);
      RT.route = null;
      render();
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-rtpend")) {
      RT.pend = t.checked;
      render();
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-rtorig")) {
      RT.origin = t.value;
      RT.route = null;
      render();
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-rtret")) {
      RT.ret = t.checked;
      if (RT.route) rtCompute();
      render();
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-rtcustom")) {
      RT.custom = t.value;
      return;
    }
    if (t.id === "vFile" && t.files && t.files[0]) {
      try {
        const rows = await vistParse(t.files[0]);
        if (!rows.length) {
          toast("Nenhum ponto encontrado na planilha.");
          return;
        }
        vistPreview(rows);
      } catch (err) {
        toast(
          "Não foi possível ler a planilha: " + ((err && err.message) || err),
        );
      }
      return;
    }
    if (t.dataset && t.dataset.pmode) {
      const [f, pn] = t.dataset.ipt.split(":").map(Number);
      const ok = await setPointMode(f, pn, t.dataset.pmode, t.value);
      const im = document.getElementById("icMenu");
      if (im) im.hidden = true;
      if (ok) {
        toast("Modalidade aplicada e tarefas do ponto atualizadas.");
        setTimeout(afterG3, 300);
      }
      return;
    }
    if (t.dataset && t.dataset.modeall) {
      const g = t.dataset.modeall,
        mode = t.value;
      if (!mode) return;
      const F = ptFases()[0];
      if (!F) return;
      const comR = F.pts.filter((p) =>
        p.items.some((i) => grpOf(i) === g && (i.inicioReal || i.fimReal)),
      ).length;
      if (
        !(await askConfirm(
          `Aplicar “${PMODES[g].opts[mode].l}” em ${PMODES[g].label} de todos os ${F.pts.length} pontos?${comR ? ` ${comR} ponto(s) com datas realizadas terão essas datas apagadas.` : ""}`,
          "Aplicar",
        ))
      ) {
        t.value = "";
        return;
      }
      let n = 0;
      for (const p of F.pts) {
        if (await setPointMode(F.f, p.ponto, g, mode, true)) n++;
      }
      t.value = "";
      toast(`${n} ponto(s) atualizados.`);
      setTimeout(afterG3, 400);
    }
  });
  // filtro de situação da implantação (mesmo filtro dos contadores)
  document.addEventListener("change", (e) => {
    if (e.target.matches && e.target.matches("[data-implsit]")) {
      implF = e.target.value;
      render();
    }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches && t.matches("[data-implq]")) {
      implQ = t.value;
      clearTimeout(window.__iq);
      window.__iq = setTimeout(() => {
        render();
        setTimeout(() => {
          const x = document.querySelector("[data-implq]");
          if (x) {
            x.focus();
            x.setSelectionRange(x.value.length, x.value.length);
          }
        }, 30);
      }, 250);
    }
  });
  document.addEventListener(
    "click",
    (e) => {
      const rk = e.target.closest("[data-rk]");
      const rm = document.getElementById("rkMenu");
      if (rk) {
        e.stopPropagation();
        const key = rk.dataset.rk;
        const m =
          rm ||
          Object.assign(document.createElement("div"), {
            id: "rkMenu",
            className: "rkmenu",
          });
        if (!rm) document.body.appendChild(m);
        const cur = (cfg.riscoGrp || {})[key] || "";
        m.innerHTML = [
          ["", "Automático"],
          ["g", "Baixo"],
          ["y", "Atenção"],
          ["r", "Alto"],
        ]
          .map(
            ([v, l]) =>
              `<button data-rkset="${v}" data-rkkey="${key}" class="${cur === v ? "on" : ""}"><i style="background:${v ? RISK[v][1] : "linear-gradient(135deg,var(--ok) 0 33%,#E0A458 33% 66%,var(--alert) 66%)"}"></i>${l}</button>`,
          )
          .join("");
        const b = rk.getBoundingClientRect();
        m.style.left = Math.min(window.innerWidth - 170, b.left) + window.scrollX + "px";
        m.style.top = b.bottom + 4 + window.scrollY + "px";
        m.hidden = false;
        return;
      }
      const rs = e.target.closest("[data-rkset]");
      if (rs) {
        const k = rs.dataset.rkkey,
          v = rs.dataset.rkset;
        const o = Object.assign({}, cfg.riscoGrp || {});
        if (v) o[k] = v;
        else delete o[k];
        cfg.riscoGrp = o;
        saveCfg();
        if (rm) rm.hidden = true;
        render();
        return;
      }
      if (rm) rm.hidden = true;
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const em = e.target.closest("[data-expmenu]");
    document.querySelectorAll(".expm").forEach((m) => {
      if (!em || !m.parentElement.contains(em)) m.hidden = true;
    });
    if (em) {
      const m = em.parentElement.querySelector(".expm");
      m.hidden = !m.hidden;
      return;
    }
    const ex = e.target.closest("[data-exp]");
    if (ex) {
      ex.closest(".expm").hidden = true;
      if (ex.dataset.exp === "pdf") exportPDF();
      else if (ex.dataset.exp === "ss") exportSmartsheet();
      else exportCSV(3);
      return;
    }
    if (e.target.closest("#btnNewRev")) {
      openNewRev();
      return;
    }
    if (e.target.closest("#btnDelRev")) {
      delRev();
      return;
    }
    const b = e.target.closest(
      "[data-addbelow],[data-newsc],[data-fat-edit],[data-itens],[data-medpt],[data-fat-del2],[data-resched],[data-tg],[data-tgall],[data-pontos],[data-gate],[data-add],[data-import],[data-edit],[data-export],[data-stk],[data-fat-new],[data-fat-list],[data-nv]",
    );
    if (!b) return;
    if (b.dataset.addbelow) {
      novaAbaixo(b.dataset.addbelow);
      return;
    }
    if (b.dataset.newsc) {
      openSC(+b.dataset.newsc);
      return;
    }
    if (b.dataset.fatEdit) {
      openFat(false, b.dataset.fatEdit);
      return;
    }
    if (b.hasAttribute("data-itens")) {
      openItens();
      return;
    }
    if (b.hasAttribute("data-medpt")) {
      openMedPonto();
      return;
    }
    if (b.dataset.fatDel2) {
      askConfirm("Excluir este boletim de medição?").then((ok) => {
        if (ok) del("faturamentos", b.dataset.fatDel2);
      });
      return;
    }
    if (b.dataset.resched) {
      const n = afterG3(S.itens);
      toast(
        n
          ? `${n} atividade${n > 1 ? "s" : ""} reprogramada${n > 1 ? "s" : ""} (${cfg.gates.g23 ? "revisão vigente" : "baseline"}).`
          : "Datas planejadas já estão consistentes com as predecessoras.",
      );
      return;
    }
    if (b.dataset.tg) {
      const k = b.dataset.tg;
      collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k);
      saveCollapsed();
      render();
      return;
    }
    if (b.dataset.tgall) {
      if (b.dataset.tgall === "1") collapsed.clear();
      else {
        const W = wbs();
        collapsed = new Set(
          fasesWF().flatMap((f) => [
            "f" + f.num,
            ...(W.tree.get(f.num) || [])
              .filter((n) => n.ponto)
              .flatMap((n) => ["f" + f.num + "p" + n.ponto, ...(n.kids || []).flatMap((k, m) => (k.bloco ? gruposDe(k, "f" + f.num + "p" + n.ponto + "s" + (m + 1)) : []))]),
            ...(W.top.get(f.num) || []).flatMap((n, k) => gruposDe(n, "f" + f.num + "b" + (k + 1))),
          ]),
        );
      }
      saveCollapsed();
      render();
      return;
    }
    if (b.dataset.pontos) {
      openPontos();
      return;
    }
    if (b.dataset.gate) {
      const gk = b.dataset.gate;
      const on = !cfg.gates[gk];
      cfg.gateDates = Object.assign({}, cfg.gateDates || {}, {
        [gk]: on ? corte() : "",
      });
      cfg.gates = Object.assign({}, cfg.gates, {
        [b.dataset.gate]: !cfg.gates[b.dataset.gate],
      });
      saveCfg();
    } else if (b.dataset.add) openForm(+b.dataset.add);
    else if (b.dataset.import) openImport(+b.dataset.import);
    else if (b.dataset.export) exportCSV(+b.dataset.export);
    else if (b.hasAttribute("data-stk")) openStk(b.dataset.stk);
    else if (b.hasAttribute("data-fat-new")) openFat(false);
    else if (b.hasAttribute("data-fat-list")) openFat(true);
    else if (b.dataset.nv) mudarNivel(b.dataset.nv, b.dataset.tipo, b.dataset.ref);
    else if (b.dataset.edit) {
      const it = S.itens.find((x) => x.id === b.dataset.edit);
      if (it) openForm(+it.grupo, it.id);
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.st) {
      // sprints: concluir sem data registra hoje; reabrir apaga a data de conclusão
      const it = S.itens.find((x) => x.id === t.dataset.st);
      if (!it) return;
      const ok = isDoneSt(stG(it.grupo, t.value));
      const fimReal = ok ? it.fimReal || todayISO() : "";
      putItem(Object.assign({}, it, { status: t.value, fimReal, pctReal: ok ? 100 : 0 }));
    } else if (t.dataset.sprev) {
      // previsão de conclusão do item da sprint (prazo usado em Minhas atividades e nos avisos)
      const it = S.itens.find((x) => x.id === t.dataset.sprev);
      if (!it) return;
      const v = t.value || "";
      if (v && +v.slice(0, 4) < 2000) return;
      putItem(Object.assign({}, it, { fim: v }));
    } else if (t.dataset.scfim) {
      // data de conclusão da atividade da sprint: com data, fica concluída; sem data, volta para em andamento
      const it = S.itens.find((x) => x.id === t.dataset.scfim);
      if (!it) return;
      const v = t.value || "";
      if (v && +v.slice(0, 4) < 2000) return;
      const feito = isDoneSt(stG(it.grupo, it.status));
      const status = v && !feito ? (+it.grupo === 1 ? "aceito" : "concluido") : !v && feito ? (+it.grupo === 1 ? "analise" : "andamento") : it.status;
      putItem(Object.assign({}, it, { fimReal: v, status, pctReal: v ? 100 : 0 }));
    } else if (t.dataset.ri || t.dataset.rf) {
      return;
    } else if (t.id === "corte") {
      cfg.corte = t.value;
      saveCfg();
    } else if (t.id === "finRevSel") {
      try {
        localStorage.setItem(RKEY, t.value);
      } catch (e) {}
      render();
    } else if (t.id === "projName") {
      cfg.nome = t.value.trim() || "Projeto sem nome";
      saveCfg();
    }
  });
  function commitDate(t) {
    const id = t.dataset.ri || t.dataset.rf;
    const it = S.itens.find((x) => x.id === id);
    if (!it) return;
    const k = t.dataset.ri ? "inicioReal" : "fimReal";
    const v = t.value || "";
    if (v === (it[k] || "")) return;
    if (v) {
      const y = +v.slice(0, 4);
      if (y < 2000 || y > 2100) {
        toast("Data inválida. Informe dia, mês e ano com 4 dígitos.");
        t.value = it[k] || "";
        return;
      }
    }
    const n = Object.assign({}, it, { [k]: v });
    // limpar o início apaga a realização inteira (sem início não há fim); antes o fim recolocava o início
    if (k === "inicioReal" && !v && n.fimReal) {
      n.fimReal = "";
      document.querySelectorAll(`input[data-rf="${id}"]`).forEach((x) => (x.value = ""));
    }
    if (n.fimReal && !n.inicioReal) n.inicioReal = n.fimReal;
    if (n.fimReal && n.inicioReal && n.fimReal < n.inicioReal) {
      toast("O fim realizado não pode ser anterior ao início realizado.");
      t.value = it[k] || "";
      return;
    }
    putItem(n);
  }
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("input.dt"))) return;
    setTimeout(() => {
      commitDate(t);
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Enter" &&
      e.target.matches &&
      e.target.matches("input.dt,input.ie")
    )
      e.target.blur();
    if (
      e.key === "Escape" &&
      e.target.matches &&
      e.target.matches("input.ie")
    ) {
      e.target.value = e.target.defaultValue;
      e.target.blur();
    }
  });
  function lockMsg(id) {
    const i = S.itens.find((x) => x.id === id);
    const W = wbs();
    toast(
      `Planejado calculado pela predecessora (${i ? predTxt(i.pred, W).replace(/&amp;/g, "&") : ""}). Para mudar, altere a predecessora ou a duração no lápis.`,
    );
  }
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    if (t.matches && t.matches("input[data-lock]")) {
      lockMsg(t.dataset.lock);
      t.blur();
    }
  });
  document.addEventListener("mousedown", (e) => {
    const t = e.target;
    if (t.matches && t.matches("input[data-lock]")) {
      e.preventDefault();
      lockMsg(t.dataset.lock);
    }
  });
  function predToCodes(txt) {
    const W = wbs();
    const byNum = new Map();
    W.num.forEach((n, id) => byNum.set(n, id));
    let tipo = "TI";
    let t = String(txt || "").trim();
    const m = t.match(/\s+(TI|II|TT|IT)$/i);
    if (m) {
      tipo = m[1].toUpperCase();
      t = t.slice(0, m.index).trim();
    }
    let lag = "";
    const ml = t.match(/\s*([+-])\s*(\d+)\s*d(?:ias?)?$/i);
    if (ml) {
      lag = ` ${ml[1]}${+ml[2]}d`;
      t = t.slice(0, ml.index).trim();
    }
    if (!t) return { pred: "", predTipo: "" };
    const parts = t.split(/\s*\+\s*/).map((x) => {
      x = x.trim();
      if (/^\d+$/.test(x)) return `G3-F${p2(+x)} (todas)`;
      if (/^\d+(\.\d+)+$/.test(x)) {
        const id = byNum.get(x);
        const it = id && S.itens.find((y) => y.id === id);
        return it && it.codigo ? it.codigo : x;
      }
      return x;
    });
    return { pred: parts.join(" + ") + lag, predTipo: tipo };
  }
  function commitInline(t) {
    const v = t.value.trim();
    if (v === t.defaultValue.trim()) return;
    if (t.dataset.eproj) {
      cfg.nome = v || "Projeto sem nome";
      saveCfg();
      return;
    }
    if (t.dataset.ef) {
      const f = +t.dataset.ef;
      if (!v) {
        t.value = t.defaultValue;
        return;
      }
      const L = ofG(3).filter((i) => +i.faseNum === f);
      const nome = `Frente ${p2(f)} · ${v}`;
      patchItems(
        L.filter((i) => i.faseNome !== nome).map((i) => ({
          id: i.id,
          fields: { faseNome: nome },
        })),
      );
      return;
    }
    if (t.dataset.eg) {
      const [fs, ps, ...resto] = t.dataset.eg.split("|");
      const f = +fs,
        pto = ps === "" ? null : +ps;
      let path;
      try {
        path = JSON.parse(resto.join("|"));
      } catch (e) {
        return;
      }
      const d = path.length - 1;
      const velho = path[d];
      if (!v) {
        t.value = t.defaultValue;
        toast("O nome do grupo não pode ficar vazio.");
        return;
      }
      if (v === velho) return;
      const daEtapa = ofG(3).filter((i) => +i.faseNum === f && (pto == null || (i.ponto && +i.pacoteNum === pto)));
      const cam = (i) => (pto == null ? gPath(i) : psubOf(i));
      const novo = path.slice(0, d).concat(v);
      // outro grupo no mesmo nível já tem esse nome: juntaria os dois sem querer
      if (daEtapa.some((i) => prefixo(cam(i), novo))) {
        t.value = t.defaultValue;
        toast(`Já existe um grupo “${v}” neste nível. Use outro nome (ou mova as atividades pela estrutura).`);
        return;
      }
      const P = daEtapa
        .filter((i) => prefixo(cam(i), path))
        .map((i) => {
          const C = cam(i).slice();
          C[d] = v;
          const fields = pto == null ? setPath(C) : { psub: C };
          // atividade-resumo do grupo (mesmo nome do grupo) acompanha
          if (cam(i).length === path.length && normNome(i.titulo) === normNome(velho)) fields.titulo = v;
          return { id: i.id, fields };
        });
      if (P.length) {
        patchItems(P);
        toast(`Grupo renomeado: “${velho}” → “${v}” (${P.length} atividade${P.length > 1 ? "s" : ""}).`);
      }
      return;
    }
    if (t.dataset.ep) {
      const [f, pn] = t.dataset.ep.split(":").map(Number);
      if (!v) {
        t.value = t.defaultValue;
        return;
      }
      patchItems(
        ofG(3)
          .filter((i) => +i.faseNum === f && +i.pacoteNum === pn && i.ponto)
          .map((i) => ({ id: i.id, fields: { pacoteNome: v } })),
      );
      return;
    }
    if (t.dataset.et) {
      const it = S.itens.find((x) => x.id === t.dataset.et);
      if (!it) return;
      if (!v) {
        t.value = t.defaultValue;
        toast("O nome da atividade não pode ficar vazio.");
        return;
      }
      putItem(Object.assign({}, it, { titulo: v }));
      return;
    }
    if (t.dataset.edur) {
      const it = S.itens.find((x) => x.id === t.dataset.edur);
      if (!it) return;
      if (v === "") {
        t.value = t.defaultValue;
        return;
      }
      const d = Math.round(+v.replace(",", "."));
      if (isNaN(d) || d < 0 || d > 3650) {
        toast("Informe a duração em dias (0 a 3650).");
        t.value = t.defaultValue;
        return;
      }
      const rev = hasRevs();
      const kI = rev ? "inicioRev" : "inicio",
        kF = rev ? "fimRev" : "fim";
      const a0 = rev ? it.inicioRev || it.inicio : it.inicio;
      const n = Object.assign({}, it, { duracao: d });
      if (a0) n[kF] = d === 0 ? a0 : addDays(a0, d - 1);
      if (rev && !it.inicioRev && a0) n.inicioRev = a0;
      putItem(n);
      return;
    }
    if (t.dataset.gpred) {
      const k = t.dataset.gpred;
      const p = predToCodes(v);
      // não pode apontar para uma atividade de dentro dela mesma
      const W = wbs();
      const anc = ancestrais(W);
      const dentro = ofG(3).filter((i) => (anc.get(i.id) || []).includes(k));
      const cods = new Set(dentro.map((i) => i.codigo));
      const fn = +(k.match(/^f(\d+)/) || [])[1];
      if ((p.pred.match(/G3-F\d+-P\d+-A\d+/g) || []).some((c) => cods.has(c)) || new RegExp(`G3-F0*${fn}(?![\\d-])`).test(p.pred) && /^f\d+$/.test(k)) {
        toast("A predecessora não pode ser uma atividade de dentro da própria etapa/grupo.");
        t.value = t.defaultValue;
        return;
      }
      const G = Object.assign({}, cfg.predGrp || {});
      if (p.pred) G[k] = { pred: p.pred, predTipo: p.predTipo || "TI" };
      else delete G[k];
      cfg.predGrp = G;
      saveCfg();
      const n = afterG3();
      toast(p.pred ? `Predecessora aplicada: as ${dentro.length} atividades de dentro não começam antes dela${n ? ` · ${n} data(s) recalculada(s)` : ""}.` : "Predecessora da etapa/grupo removida.");
      render();
      return;
    }
    if (t.dataset.epred) {
      const it = S.itens.find((x) => x.id === t.dataset.epred);
      if (!it) return;
      const p = predToCodes(v);
      if (p.pred && p.pred === it.codigo) {
        toast("Uma atividade não pode ser predecessora dela mesma.");
        t.value = t.defaultValue;
        return;
      }
      putItem(Object.assign({}, it, p));
      return;
    }
  }
  function commitPrev(t) {
    const id = t.dataset.ps || t.dataset.pf;
    const it = S.itens.find((x) => x.id === id);
    if (!it || t.dataset.lock) return;
    const v = t.value || "";
    if (v) {
      const y = +v.slice(0, 4);
      if (y < 2000 || y > 2100) {
        toast("Data inválida. Informe dia, mês e ano com 4 dígitos.");
        t.value = t.defaultValue;
        return;
      }
    } else if (t.defaultValue) {
      // o planejado é recalculado pelo cronograma: em branco a atividade iria para o início do projeto
      toast("O planejado não pode ficar em branco: informe outra data (ou altere a duração/predecessora no lápis).");
      t.value = t.defaultValue;
      return;
    }
    const rev = hasRevs();
    const kI = rev ? "inicioRev" : "inicio",
      kF = rev ? "fimRev" : "fim";
    const a0 = rev ? it.inicioRev || it.inicio : it.inicio,
      b0 = rev ? it.fimRev || it.fim : it.fim;
    const d0 =
      it.duracao !== "" && it.duracao != null && !isNaN(+it.duracao)
        ? +it.duracao
        : a0 && b0
          ? Math.max(1, diasUteis(a0, b0))
          : 1;
    const n = Object.assign({}, it);
    if (t.dataset.ps) {
      if (v === (a0 || "")) return;
      // início em fim de semana/feriado vai para o próximo dia útil
      const vi = v ? proxUtil(v) : "";
      if (vi && vi !== v) toast("Início ajustado para o próximo dia útil: " + fmtD(vi) + ".");
      n[kI] = vi;
      n[kF] = vi ? fimUtil(vi, d0) : "";
    } else {
      if (v === (b0 || "")) return;
      if (v && a0 && v < a0) {
        toast("O fim planejado não pode ser anterior ao início.");
        t.value = t.defaultValue;
        return;
      }
      const vf = v ? antUtil(v) : "";
      if (vf && vf !== v) toast("Fim ajustado para o dia útil anterior: " + fmtD(vf) + ".");
      n[kF] = vf < (a0 || "") ? a0 : vf;
      if (vf && a0) n.duracao = Math.max(1, diasUteis(a0, n[kF]));
    }
    putItem(n);
  }
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("input.ie,input[data-ps],input[data-pf]")))
      return;
    setTimeout(() => {
      if (t.matches("input.ie")) commitInline(t);
      else commitPrev(t);
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("textarea.obs"))) return;
    setTimeout(() => {
      const v = t.value.trim();
      if (t.dataset.obsg) {
        const k = t.dataset.obsg;
        if (v !== ((cfg.obsGrp || {})[k] || "")) {
          cfg.obsGrp = Object.assign({}, cfg.obsGrp || {}, { [k]: v });
          saveCfg();
        }
      } else {
        const it = S.itens.find((x) => x.id === t.dataset.obs);
        if (it && v !== (it.obs || ""))
          patchItems([{ id: it.id, fields: { obs: v } }]);
      }
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  window.addEventListener("hashchange", () => {
    view = parseHash();
    // a programação de equipes de campo é do Painel PMO: não fica aberta sobre outras telas
    const dp = $("#dlgPmo");
    if (view !== "pmo" && dp && dp.open) dp.close();
    const da = $("#dlgAg");
    if (view !== "pmo" && da && da.open) da.close();
    render();
    window.scrollTo(0, 0);
  });
  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (view === "carteira") render();
      else if (view === "painel") renderPainel();
      else if (view === "fxf") renderFxF();
    }, 150);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (view === "painel") renderPainel();
    else if (view === "fxf") renderFxF();
  });

  /* ---------- Inicialização ---------- */
  const hasHost = !!(window.claude && window.claude.use);
  /* Execução local: base com vários projetos no navegador (js/localdb.js) */
  const HOST = hasHost ? window.claude : window.LOCAL_HOST || null;
  /* Execução local (VS Code / navegador): dados iniciais e downloads */
  if (!hasHost) {
    try {
      if (!HOST && !localStorage.getItem("pmo-hibrido-v1") && window.SEED)
        localStorage.setItem("pmo-hibrido-v1", JSON.stringify(window.SEED));
    } catch (e) {}
    downloads = {
      save: async ({ filename, data }) => {
        const u = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = u;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 2000);
      },
    };
  }
  if (!HOST) {
    conectando = false;
    loadLocal();
    ready = true;
    render();
    setTimeout(() => {
      if (!db && S.itens.length) {
        migrateEtapa5();
        migrateEtapa3();
        migrateDur();
        migrateResp();
        migrateFuncao();
        migrateDiasUteis();
        afterG3();
      }
    }, 300);
  } else render();
  (async () => {
    const CL = HOST;
    if (!CL || !CL.use) return;
    try {
      downloads = (await CL.use("downloads")) || downloads;
    } catch (e) {}
    let d = null;
    try {
      d = await CL.use("db");
    } catch (e) {}
    if (!d) {
      conectando = false;
      loadLocal();
      ready = true;
      render();
      return;
    }
    db = d;
    conectando = false;
    ouvirAgenda();
    db.doc("config/equipe").onSnapshot((x) => {
      const o = x.exists ? x.data() : {};
      if (Array.isArray(o.membros)) EQ = o.membros;
      if (Array.isArray(o.equipesCampo)) EQC = o.equipesCampo;
      if (+o.capDia > 0) AG_CAP = +o.capDia;
    });
    db.collection("projetos").onSnapshot(
      (snap) => {
        // ordem numérica pelo código do projeto (ex.: "9791 - …" antes de "10016 - …");
        // projetos sem código vão para o fim, em ordem alfabética
        const cod = (s) => {
          const m = String(s || "").match(/^\s*(\d+)/);
          return m ? +m[1] : Infinity;
        };
        const nl = snap.docs
          .map((x) => Object.assign({ id: x.id }, x.data()))
          .sort(
            (a, b) =>
              cod(a.nome) - cod(b.nome) ||
              COLPT(String(a.nome || ""), String(b.nome || "")),
          );
        const chave = (L) => L.map((x) => x.id + (x.encerrado ? "!" : "")).join();
        const ch = chave(nl) !== chave(PROJS) || !projsOk;
        PROJS = nl;
        projsOk = true;
        if (ch) {
          CART = null;
          PMO = null;
          if (view === "carteira" || view === "pmo") render();
        }
        renderSide();
      },
      () => {},
    );
    let pid = "main";
    try {
      pid = localStorage.getItem(PKEY) || "main";
    } catch (e) {}
    connect(pid);
  })();
  function connect(pid) {
    UNSUB.forEach((u) => {
      try {
        u();
      } catch (e) {}
    });
    UNSUB = [];
    PID = pid || "main";
    PB = PID === "main" ? "" : `projetos/${PID}/`;
    try {
      localStorage.setItem(PKEY, PID);
    } catch (e) {}
    S.itens = [];
    S.fats = [];
    S.prog = [];
    cfg = mergeCfg({});
    stk = {};
    ready = false;
    cfgLoaded = false;
    cleanupDone = false;
    render();
    renderSide();
    const CL = HOST;
    const got = {
      itens: false,
      fats: false,
      prog: false,
      cfg: false,
      stk: false,
    };
    let repaired = false;
    const myPid = PID;
    const check = () => {
      if (myPid !== PID || ready || !Object.values(got).every(Boolean)) return;
      ready = true;
      render();
      renderSide();
      setTimeout(async () => {
        if (repaired || myPid !== PID) return;
        repaired = true;
        let ok = null;
        try {
          const u = await CL.use("user");
          if (u && u.can) ok = await u.can("data.write");
        } catch (e) {}
        if (ok === false || myPid !== PID) return;
        migrateEtapa5();
        migrateEtapa3();
        migrateDur();
        migrateResp();
        migrateFuncao();
        migrateDiasUteis();
        if (!hasRevs()) {
          const P = ofG(3)
            .filter((i) => i.inicioRev || i.fimRev || +i.lagRev)
            .map((i) => ({
              id: i.id,
              fields: { inicioRev: "", fimRev: "", lagRev: 0 },
            }));
          if (P.length) patchItems(P);
        }
        afterG3();
        maybeRevCleanup();
      }, 50);
    };
    const sub = (coll, key) =>
      UNSUB.push(
        db.collection(PB + coll).onSnapshot(
          (snap) => {
            if (myPid !== PID) return;
            S[key] = snap.docs.map((x) =>
              Object.assign({ id: x.id }, x.data()),
            );
            got[key] = true;
            if (ready) render();
            else check();
          },
          (err) => {
            got[key] = true;
            check();
            toast(errMsg(err));
          },
        ),
      );
    sub("atividades", "itens");
    sub("faturamentos", "fats");
    sub("progresso", "prog");
    UNSUB.push(
      db.doc(PB + "config/projeto").onSnapshot(
        (snap) => {
          if (myPid !== PID) return;
          cfgLoaded = true;
          cfg = mergeCfg(snap.exists ? snap.data() : {});
          got.cfg = true;
          if (ready) {
            render();
            renderSide();
            maybeRevCleanup();
          } else check();
        },
        () => {
          got.cfg = true;
          check();
        },
      ),
    );
    UNSUB.push(
      db.doc(PB + "config/stakeholders").onSnapshot(
        (snap) => {
          if (myPid !== PID) return;
          stk = snap.exists ? Object.assign({}, snap.data()) : {};
          got.stk = true;
          if (ready) render();
          else check();
        },
        () => {
          got.stk = true;
          check();
        },
      ),
    );
    setTimeout(() => {
      if (myPid === PID && !ready) {
        Object.keys(got).forEach((k) => (got[k] = true));
        check();
      }
    }, 8000);
  }
  let sideEncAberta = false;
  /* barra lateral: recolhida (só ícones) ou aberta por cima do conteúdo; clicar fora, escolher um
     projeto ou Esc recolhe. A pesquisa filtra os projetos pelo nome e pelo cliente. */
  // fixada: fica aberta ao lado do conteúdo (não cobre nem recolhe); a escolha fica neste navegador
  let sideFixa = (() => {
    try {
      return localStorage.getItem("pmo-hibrido-sidefixa") === "1";
    } catch (e) {
      return false;
    }
  })();
  let sideAberta = sideFixa,
    sideBusca = "",
    sideBuscaEnc = "";
  const semAcento = (x) =>
    String(x || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const SIC = {
    minhas: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="3" y="2.5" width="14" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 7.2l1.3 1.3 2.4-2.6M6.5 12.7l1.3 1.3 2.4-2.6M12 7.5h2.5M12 13h2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cfg: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    menu: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    cart: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 14.2h6.5M14.2 11v6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    pmo: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15M6.5 2v3M13.5 2v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="7" cy="12" r="1.1" fill="currentColor"/><circle cx="10" cy="12" r="1.1" fill="currentColor"/><circle cx="13" cy="12" r="1.1" fill="currentColor"/></svg>`,
    pasta: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2h6a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    arquivo: `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="2.5" y="3" width="15" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.8 7v8.5a1.5 1.5 0 0 0 1.5 1.5h9.4a1.5 1.5 0 0 0 1.5-1.5V7M8 10.5h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    pino: `<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M7.5 2.5h5l-.8 5 2.8 2.8v1.2H5.5v-1.2l2.8-2.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 11.5v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    lupa: `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  };
  function fixarSide(v) {
    sideFixa = v;
    try {
      localStorage.setItem("pmo-hibrido-sidefixa", v ? "1" : "0");
    } catch (e) {}
    document.body.classList.toggle("sidefixa", v);
    abrirSide(v || sideAberta, true);
  }
  function abrirSide(v, semFoco) {
    sideAberta = v;
    const el = $("#side");
    if (!el) return;
    el.classList.toggle("aberta", v);
    document.body.classList.toggle("sideab", v && !sideFixa);
    document.body.classList.toggle("sidefixa", sideFixa);
    if (v && !semFoco) setTimeout(() => (el.querySelector(".sbusca") || {}).focus && el.querySelector(".sbusca").focus(), 30);
    if (v && semFoco) setTimeout(() => el.querySelector(".sbuscaEnc") && el.querySelector(".sbuscaEnc").focus({ preventScroll: true }), 90);
  }
  // cada lista tem a sua pesquisa: a de cima filtra os ativos; a da pasta, os encerrados
  function filtraSide() {
    const el = $("#side");
    if (!el) return;
    const filtra = (lista, txt, vazio) => {
      const q = semAcento(txt);
      let n = 0;
      if (lista)
        lista.querySelectorAll(".pwrap").forEach((w) => {
          const ok = !q || w.dataset.txt.includes(q);
          w.hidden = !ok;
          if (ok) n++;
        });
      if (vazio) vazio.hidden = !q || n > 0;
    };
    filtra(el.querySelector(".plist.ativos"), sideBusca, el.querySelector(".svazio"));
    filtra(el.querySelector(".encf .plist"), sideBuscaEnc, el.querySelector(".svazioEnc"));
  }
  // situação do projeto na carteira (cores da rosca "Status em aberto"); a carteira é lida em segundo plano
  const SIT_COR = { fora: "#B0304A", atraso: "#E5736B", adm: "#8E9CF0", atencao: "#E0A458", prazo: "#4FC48A", concl: "var(--muted)" };
  const SIT_NOME = { fora: "Fora do prazo contratual", atraso: "Em atraso", adm: "Atraso administrativo", atencao: "Atenção", prazo: "No prazo", concl: "Concluído" };
  function sitProj(id) {
    try {
      if (!CART) {
        if (db && projsOk && !cartBusy) loadCarteira();
        return "";
      }
      return (CART.find((x) => x.id === id) || {}).cat || "";
    } catch (e) {
      return ""; // início: a carteira ainda não existe
    }
  }
  function renderSide() {
    const el = $("#side");
    if (!el) return;
    const rolado = (el.querySelector(".sscroll") || {}).scrollTop || 0; // a lista não volta ao topo ao redesenhar
    const ae = document.activeElement;
    const comFoco = ae && ae.classList.contains("sbusca") ? (ae.classList.contains("sbuscaEnc") ? ".sbuscaEnc" : ".sbusca:not(.sbuscaEnc)") : "";
    const carregando = !PROJS.length && ((db && !projsOk) || (!db && conectando));
    const T = PROJS.length ? PROJS : carregando ? [] : [{ id: "main", nome: cfg.nome }];
    const L = T.filter((p) => !p.encerrado),
      E = T.filter((p) => p.encerrado);
    const item = (p) => {
      const on = p.id === PID && view !== "carteira" && view !== "pmo";
      const nm = on && cfg.nome && ready ? cfg.nome : p.nome || "Projeto";
      const cat = sitProj(p.id);
      return `<div class="pwrap" data-txt="${esc(semAcento(nm + " " + (p.cliente || "")))}"><button class="pitem ${on ? "on" : ""}" data-proj="${esc(p.id)}" ${on ? 'aria-current="true"' : ""}><span class="pn">${cat ? `<i class="pdot" style="--c:${SIT_COR[cat] || "var(--muted)"}" title="${esc(SIT_NOME[cat] || "Concluído")}"></i>` : ""}${esc(nm)}</span>${p.cliente ? `<span class="pc">${esc(p.cliente)}</span>` : ""}</button>${db ? `<button class="ico pedit" data-editproj="${esc(p.id)}" title="Editar projeto" aria-label="Editar projeto">${PENCIL}</button>` : ""}</div>`;
    };
    const abertaEnc = E.some((p) => p.id === PID && view !== "carteira" && view !== "pmo") || sideEncAberta;
    const atual = T.find((p) => p.id === PID && view !== "carteira" && view !== "pmo");
    el.innerHTML = `<div class="stop"><button class="ico stg" data-sidetg title="${sideAberta ? "Recolher a barra" : "Abrir a barra de projetos"}" aria-label="${sideAberta ? "Recolher a barra" : "Abrir a barra de projetos"}" aria-expanded="${sideAberta}">${SIC.menu}</button><span class="stit">Navegação</span><button class="ico sfix ${sideFixa ? "on" : ""}" data-sidefix title="${sideFixa ? "Desafixar a barra (volta a recolher ao clicar fora)" : "Fixar a barra aberta ao lado do conteúdo"}" aria-label="${sideFixa ? "Desafixar a barra" : "Fixar a barra"}" aria-pressed="${sideFixa}">${SIC.pino}</button></div><button class="pitem cartb ${view === "carteira" ? "on" : ""}" data-cart title="Painel da carteira"><span class="sico">${SIC.cart}</span><span class="stx"><span class="pn">Painel da carteira</span><span class="pc">${carregando ? "carregando…" : `${L.length} projeto${L.length === 1 ? "" : "s"}`}</span></span></button>${PODE("projetos") || PODE("campo") ? (() => {
      const n = nAtrasadasMinhas();
      return `<button class="pitem cartb ${view === "minhas" ? "on" : ""}" data-minhas title="Minhas atividades${n ? ` · ${n} atrasada${n > 1 ? "s" : ""}` : ""}"><span class="sico">${SIC.minhas}${n ? `<i class="mvbadge">${n > 99 ? "99+" : n}</i>` : ""}</span><span class="stx"><span class="pn">Minhas atividades</span><span class="pc">${n ? `<b class="bad">${n} atrasada${n > 1 ? "s" : ""}</b>` : "Avisos e pendências"}</span></span></button>`;
    })() : ""}${PODE("pmo") || PODE("campo") ? `<button class="pitem cartb ${view === "pmo" ? "on" : ""}" data-pmo title="Gestão de equipes"><span class="sico">${SIC.pmo}</span><span class="stx"><span class="pn">Gestão de equipes</span><span class="pc">Supervisão, calendário e campo</span></span></button>` : ""}${temConfig() ? `<button class="pitem cartb ${view === "config" ? "on" : ""}" data-cfg title="Configurações"><span class="sico">${SIC.cfg}</span><span class="stx"><span class="pn">Configurações</span><span class="pc">Usuários, setores e permissões</span></span></button>` : ""}<button class="pitem cartb sprj ${atual ? "on" : ""}" data-sidetg title="${esc(atual ? "Projeto: " + (atual.nome || "") : "Projetos")}"><span class="sico">${SIC.pasta}</span><b class="sbadge">${atual ? esc((String(atual.nome || "").match(/\d{3,}/) || ["•"])[0]) : carregando ? "…" : L.length}</b></button><button class="pitem cartb sprj" data-sideenc title="Projetos encerrados (${E.length})"><span class="sico enc">${SIC.arquivo}</span><b class="sbadge">${carregando ? "…" : E.length}</b></button><div class="side-h"><span class="shl"><span class="sico">${SIC.pasta}</span>Projetos</span><label class="sbw">${SIC.lupa}<input class="sbusca" type="search" value="${esc(sideBusca)}" placeholder="Pesquisar projeto" aria-label="Pesquisar projeto"></label></div><div class="sscroll"><p class="svazio mut" hidden>Nenhum projeto encontrado.</p><nav class="plist ativos">${L.map(item).join("")}</nav>${
      // pasta dos projetos encerrados: sempre no fim da lista (vazia, explica como encerrar)
      `<details class="encf" ${abertaEnc ? "open" : ""}><summary class="side-h"><span class="shl"><span class="sico enc">${SIC.arquivo}</span>Projetos encerrados</span><span class="encn">${E.length}</span></summary>${E.length ? `<label class="sbw encbw">${SIC.lupa}<input class="sbusca sbuscaEnc" type="search" value="${esc(sideBuscaEnc)}" placeholder="Pesquisar encerrado" aria-label="Pesquisar projeto encerrado"></label><p class="svazio svazioEnc mut" hidden>Nenhum encerrado encontrado.</p><nav class="plist">${E.map(item).join("")}</nav>` : `<p class="encvz mut">Nenhum projeto encerrado. Para encerrar, use o lápis do projeto e marque “Projeto encerrado”.</p>`}</details>`
    }${db && PODE("projetos", "criar") ? `<button class="btn newp" data-newproj>+ Novo projeto</button>` : ""}</div>${(() => {
      // quem está logado: minha conta (alterar senha, sair)
      const u = SESS().usuario;
      return u ? `<div class="suser"><button class="pitem cartb" data-conta title="Minha conta · ${esc(u.nome)}"><span class="sico cfgav">${esc(iniciais(u.nome))}</span><span class="stx"><span class="pn">${esc(u.nome)}</span><span class="pc">${esc([u.setorNome, u.perfilNome].filter(Boolean).join(" · "))}</span></span></button></div>` : "";
    })()}`;
    const det = el.querySelector(".encf");
    if (det) det.ontoggle = () => (sideEncAberta = det.open);
    el.classList.toggle("aberta", sideAberta);
    document.body.classList.toggle("sidefixa", sideFixa);
    filtraSide();
    if (rolado) el.querySelector(".sscroll").scrollTop = rolado;
    const sb = el.querySelector(".sbusca:not(.sbuscaEnc)");
    sb.oninput = () => {
      sideBusca = sb.value;
      filtraSide();
    };
    const se = el.querySelector(".sbuscaEnc");
    if (se)
      se.oninput = () => {
        sideBuscaEnc = se.value;
        filtraSide();
      };
    const fx = comFoco && el.querySelector(comFoco);
    if (fx) {
      fx.focus();
      fx.setSelectionRange(fx.value.length, fx.value.length);
    }
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-sideenc]")) {
      // ícone da pasta de encerrados (barra recolhida): abre a barra com a pasta aberta
      e.preventDefault();
      sideEncAberta = true;
      abrirSide(true, true);
      renderSide();
      setTimeout(() => {
        const d = $("#side .encf");
        if (d) d.scrollIntoView({ block: "end" });
      }, 60);
      return;
    }
    if (e.target.closest("[data-sidefix]")) {
      e.preventDefault();
      fixarSide(!sideFixa);
      renderSide();
      return;
    }
    if (e.target.closest("[data-sidetg]")) {
      e.preventDefault();
      if (sideFixa) fixarSide(false); // ☰ com a barra fixada: desafixa e recolhe
      abrirSide(!sideAberta);
      renderSide();
      return;
    }
    // clicar fora da barra (ou escolher um painel/projeto) recolhe
    if (sideAberta && !sideFixa && (!e.target.closest("#side") || e.target.closest("[data-proj],[data-cart],[data-pmo],[data-minhas],[data-cfg],[data-conta],[data-newproj],[data-editproj]"))) {
      abrirSide(false);
      renderSide();
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sideAberta && !sideFixa && !document.querySelector("dialog[open]")) {
      abrirSide(false);
      renderSide();
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cart]")) {
      location.hash = "carteira";
      return;
    }
    if (e.target.closest("[data-newproj]")) {
      openNewProj();
      return;
    }
    {
      const ep = e.target.closest("[data-editproj]");
      if (ep) {
        openEditProj(ep.dataset.editproj);
        return;
      }
    }
    if (e.target.closest("textarea,input,select,.srcell")) return;
    const b = e.target.closest("[data-proj]");
    if (!b) return;
    const id = b.dataset.proj;
    if (!db || id === PID) {
      location.hash = "painel";
      return;
    }
    connect(id);
    location.hash = "painel";
  });
  /* ---------- Painel da carteira ---------- */
  // cores da situação dos contratos (mesmas da rosca "Status em aberto" da carteira)
  const CAT_COR = { fora: "#B0304A", atraso: "#E5736B", adm: "#8E9CF0", atencao: "#E0A458", prazo: "#4FC48A" };
  const CAT_NOME = { fora: "Fora do prazo contratual", atraso: "Em atraso", adm: "Atraso administrativo", atencao: "Atenção", prazo: "No prazo" };
  let CART = null,
    cartBusy = false,
    cartAt = 0,
    cartF = "";
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cf]");
    if (!b) return;
    const k = b.dataset.cf;
    cartF = cartF === k ? "" : k;
    render();
  });
  async function loadCarteira(force) {
    if (!db || cartBusy || !projsOk) return;
    if (!force && CART && Date.now() - cartAt < 30000) return;
    cartBusy = true;
    const L = PROJS.length ? PROJS : [{ id: "main", nome: cfg.nome }];
    const key = L.map((p) => p.id + (p.encerrado ? "!" : "")).join();
    try {
      const out = await Promise.all(
        L.map(async (p) => {
          const b = p.id === "main" ? "" : `projetos/${p.id}/`;
          const [a, f, c, k] = await Promise.all([
            db.collection(b + "atividades").get(),
            db.collection(b + "faturamentos").get(),
            db.doc(b + "config/projeto").get(),
            db.doc(b + "config/stakeholders").get(),
          ]);
          const data = {
            itens: a.docs.map((x) => Object.assign({ id: x.id }, x.data())),
            fats: f.docs.map((x) => Object.assign({ id: x.id }, x.data())),
            cfg: c.exists ? c.data() : {},
            stk: k.exists ? k.data() : {},
          };
          return Object.assign(
            { id: p.id, nomeLista: p.nome, clienteLista: p.cliente, encerrado: !!p.encerrado },
            projMetrics(data),
          );
        }),
      );
      if (
        key !==
        (PROJS.length ? PROJS : [{ id: "main" }]).map((p) => p.id + (p.encerrado ? "!" : "")).join()
      ) {
        cartBusy = false;
        CART = null;
        if (view === "carteira") render();
        return;
      }
      CART = out;
      cartAt = Date.now();
      renderSide();
    } catch (e) {
      toast("Não foi possível carregar a carteira: " + ((e && e.message) || e));
    }
    cartBusy = false;
    if (view === "carteira") render();
  }
  function projMetrics(data) {
    const sv = { itens: S.itens, fats: S.fats, prog: S.prog, cfg, stk };
    S.itens = data.itens;
    S.fats = data.fats;
    S.prog = [];
    cfg = mergeCfg(data.cfg);
    stk = Object.assign({}, data.stk || {});
    try {
      const wf = metWF();
      const P = prazos();
      const fp = finParams();
      const tad = tadDate(true);
      const ff = firstFull(true);
      const fat = boletins().reduce((s, b) => s + (+b.valor || 0), 0);
      const folga =
        P.lim && tad ? Math.round((dt(P.lim) - dt(tad)) / DAY) : null;
      const hoje = todayISO();
      const dLim = P.lim ? Math.round((dt(P.lim) - dt(hoje)) / DAY) : null;
      // atraso em relação ao limite contratual: conclusão real (se concluído) ou a mais tardia
      // entre o T.A.D. planejado e hoje (se ainda em execução); 0 = dentro do prazo
      const concl = !!(wf.L.length && wf.real >= 1 && sprintsOk(S.itens));
      const fimEf = concl
        ? wf.L.map((i) => i.fimReal).filter(Boolean).sort().pop()
        : [tad, hoje].filter(Boolean).sort().pop();
      const atraso = P.lim && fimEf ? Math.max(0, Math.round((dt(fimEf) - dt(P.lim)) / DAY)) : null;
      let cat = "prazo";
      if (concl) cat = "concl";
      else if (dLim != null && dLim < 0) cat = "fora"; // prazo contratual + aditivos expirado: prevalece
      else if (stk.atrasoAdm || admAberto(stk)) cat = "adm";
      else if (
        wf.late.length ||
        (folga != null && folga < 0) ||
        (dLim != null && dLim < 0)
      )
        cat = "atraso";
      else if (dLim != null && dLim <= 15) cat = "atencao";
      let st = ["c", "No prazo"];
      if (concl) st = ["c", "Concluído"];
      else if (
        (folga != null && folga < 0) ||
        (wf.spiR != null && wf.spiR < 0.9)
      )
        st = ["r", "Em risco"];
      else if (wf.spiR != null && wf.spiR < 1) st = ["a", "Atenção"];
      if (!wf.L.length) st = ["n", "Sem cronograma"];
      const CATST = {
        fora: ["fora", "Fora do prazo contratual"],
        atraso: ["r", "Em atraso"],
        adm: ["adm", "Atraso administrativo"],
        atencao: ["a", "Atenção"],
        prazo: ["c", "No prazo"],
        concl: ["n", "Concluído"],
      };
      if (wf.L.length) st = CATST[cat];
      const L3 = ofG(3);
      const ds = L3.flatMap((i) => [i.inicio, i.fim, rI(i), rF(i)])
        .filter(Boolean)
        .sort();
      let curve = null;
      if (ds.length) {
        const a = dt(ds[0]).getTime(),
          b = dt(ds[ds.length - 1]).getTime();
        const sf = seriesFis();
        const rf = sf[sf.length - 1].fn;
        const ct = dt(corte()).getTime();
        const n = Math.round((b - a) / DAY) + 1;
        const p0 = [],
          pr = [],
          re = [];
        for (let k = 0; k < n; k++) {
          const t = a + k * DAY;
          p0.push(physPlan(t, false));
          pr.push(physPlan(t, true));
          re.push(t <= ct ? rf(t) : null);
        }
        curve = { a, n, p0, pr, re };
      }
      const fin = {
        R0: sched(false).map((e) => ({ comp: e.comp, bill: e.bill, v: e.v })),
        RV: sched(true).map((e) => ({ comp: e.comp, bill: e.bill, v: e.v })),
        RA: realAlloc().map((e) => ({
          comp: e.comp,
          bill: e.bill,
          v: e.v,
          sit: (e.b && e.b.situacao) || "liberado",
        })),
      };
      // aumento de recorrência (implantação): previsto pela revisão vigente x realizado
      if (!isAq()) {
        const M1 = finParams().M;
        fin.recP = recSerie(fin.RV, M1);
        fin.recP0 = recSerie(fin.R0, M1);
        fin.recR = recSerie(fin.RA, M1);
      } else fin.recP = fin.recR = fin.recP0 = [];
      // Controladoria (fluxo de caixa): depois da 1ª parcela cheia, o previsto segue com a parcela
      // mensal até completar o valor do contrato (a visão do projeto continua só até a 1ª parcela)
      if (!isAq() && !isDoa()) {
        const { M: Mc, n: nc } = finParams();
        const teto = +stk.valorContrato || Mc * nc;
        const estende = (E) => {
          if (!Mc || !E.length || E[E.length - 1].v < Mc - 0.005) return E;
          const out = E.slice();
          let acum = out.reduce((a, e) => a + e.v, 0);
          let c = out[out.length - 1].comp;
          for (let k = 0; k < 120 && acum < teto - 0.005; k++) {
            c = ymAdd(c, 1);
            const v = Math.round(Math.min(Mc, teto - acum) * 100) / 100;
            out.push({ comp: c, bill: ymAdd(c, 1), v });
            acum += v;
          }
          return out;
        };
        // meses depois da 1ª parcela cheia: parcela cheia (o que faltar é glosa/diferença)
        const cheia = (E) => {
          const i = E.findIndex((e) => e.v >= Mc - 0.005);
          return i < 0 ? E : E.map((e, j) => (j > i ? Object.assign({}, e, { v: Mc }) : e));
        };
        fin.R0 = estende(cheia(fin.R0));
        fin.RV = estende(cheia(fin.RV));
      }
      let al = [];
      try {
        const ct2 = dt(corte()).getTime();
        al = alerts(wf, finTotal(), finReal(ct2), finPlan(ct2, true));
      } catch (e) {}
      const sev = { r: 0, a: 1, b: 2 };
      al = al.slice().sort((x, y) => (sev[x[0]] ?? 3) - (sev[y[0]] ?? 3));
      return {
        aq: isAq(),
        rev: revName(cronRevs().length),
        sr: cfg.statusReport || "",
        srData: cfg.statusReportData || "",
        alerts: al.slice(0, 3),
        nAlerts: al.length,
        acoes: Array.isArray(cfg.acoes) ? cfg.acoes.slice() : [],
        curve,
        fin,
        cat,
        dLim,
        admMot: stk.atrasoAdmMotivo || "",
        admTxt: admTxt(stk),
        admAtivo: !!stk.atrasoAdm || admAberto(stk),
        nome: cfg.nome,
        cliente: stk.cliente,
        contrato: stk.contrato,
        real: wf.real,
        plan: wf.planR,
        spi: wf.spiR,
        late: wf.late.length,
        tad,
        lim: P.lim,
        folga,
        atraso,
        valor: fp.total,
        M: fp.M,
        ff,
        fat,
        st,
        n: wf.L.length,
        oi: stk.oi,
      };
    } finally {
      S.itens = sv.itens;
      S.fats = sv.fats;
      S.prog = sv.prog;
      cfg = sv.cfg;
      stk = sv.stk;
    }
  }
  function renderCarteira() {
    const v = $("#view");
    if (!db && conectando) {
      document.body.classList.add("carregando");
      v.innerHTML = `<div class="loading"><span class="spin"></span>Carregando a carteira…</div>`;
      return;
    }
    if (!db) {
      CART = [
        Object.assign(
          { id: "main", nomeLista: cfg.nome, clienteLista: stk.cliente },
          projMetrics({ itens: S.itens, fats: S.fats, cfg, stk }),
        ),
      ];
      cartAt = Date.now();
    }
    if (!CART || (db && !projsOk)) {
      document.body.classList.add("carregando");
      v.innerHTML = `<div class="loading"><span class="spin"></span>Carregando a carteira…</div>`;
      loadCarteira();
      return;
    }
    if (db) loadCarteira();
    if (cartTab === "ctl") {
      renderCtl(v);
      return;
    }
    const C = CART.filter((x) => !x.encerrado);
    const n = C.length;
    const val = C.reduce((s, x) => s + (+x.valor || 0), 0),
      meta = C.reduce((s, x) => s + (+x.M || 0), 0),
      fat = C.reduce((s, x) => s + (+x.fat || 0), 0);
    const risco = C.filter((x) => x.st[0] === "r" || x.st[0] === "fora").length,
      aten = C.filter((x) => x.st[0] === "a").length;
    const W = C.filter((x) => x.n);
    const fm = W.length ? W.reduce((s, x) => s + x.real, 0) / W.length : 0;
    const mv = ymOf(todayISO());
    const metaMes = C.filter((x) => x.ff && x.ff.comp === mv).reduce(
      (s, x) => s + x.ff.v,
      0,
    );
    const kp = (a, l, c) =>
      `<div class="kpi"><div class="v ${c || ""}">${a}</div><div class="l">${l}</div></div>`;
    const k = `<div class="kpis">${kp(n, "Projetos na carteira")}${kp(BRLc(val), "Valor total contratado")}${kp(BRLc(meta), "Meta · 1ªs parcelas cheias")}${kp(BRLc(fat), "Realizado (boletins)")}${kp(fmtPct(fm), "Físico médio realizado")}${kp(risco, "Projetos em risco", risco ? "bad" : "")}${kp(aten, "Projetos em atenção", aten ? "warn" : "")}</div>`;
    // previsão de 1ª parcela cheia por mês
    const by = {};
    C.forEach((x) => {
      if (x.ff) {
        by[x.ff.comp] = (by[x.ff.comp] || []).concat([x]);
      }
    });
    const ms = Object.keys(by).sort();
    let chart = `<section class="panel"><div class="panel-h"><h2>1ª parcela cheia por competência</h2><span class="note">Meta do setor · previsão pela revisão vigente</span></div>`;
    if (ms.length) {
      const mx = Math.max(
        ...ms.map((m) => by[m].reduce((s, x) => s + x.ff.v, 0)),
      );
      chart += `<div class="bars">${ms
        .map((m) => {
          const t = by[m].reduce((s, x) => s + x.ff.v, 0);
          return `<div class="bcol"><span class="bv">${BRLc(t)}</span><div class="bstack" style="height:${Math.max(6, (t / mx) * 160)}px">${by[m].map((x) => `<i style="flex:${x.ff.v}" class="${x.st[0]}" title="${esc(x.nome || x.nomeLista)} · ${BRL(x.ff.v)}"></i>`).join("")}</div><span class="bl">${ymLbl(m)}</span><span class="bn">${by[m].length} proj.</span></div>`;
        })
        .join("")}</div>`;
    } else
      chart += `<p class="ok-msg">Sem previsão de parcela cheia: informe valor, parcelamento e cronograma nos projetos.</p>`;
    chart += `</section>`;
    const CATS = [
      ["fora", "Fora do prazo contratual", "prazo contratual + aditivos expirado", "#B0304A"],
      ["atraso", "Em atraso", "execução física atrasada, por data", "#E5736B"],
      [
        "adm",
        "Atraso administrativo",
        "pendência de terceiro, cliente ou demais áreas",
        "#8E9CF0",
      ],
      ["atencao", "Atenção", "prazo contratual em até 15 dias", "#E0A458"],
      ["prazo", "No prazo", "dentro do prazo contratual", "#4FC48A"],
    ];
    const ab = C.filter((x) => x.cat !== "concl");
    const tot = ab.length;
    const cnt = (c) => ab.filter((x) => x.cat === c).length;
    const nConc = C.length - tot;
    let ang = 0;
    const R = 70,
      CIR = 2 * Math.PI * R;
    const segs = CATS.map(([k, l, d, col]) => {
      const n = cnt(k);
      if (!n) return "";
      const len = (n / tot) * CIR;
      const seg = `<circle class="dseg ${cartF && cartF !== k ? "dim" : ""}" data-cf="${k}" r="${R}" cx="90" cy="90" fill="none" stroke="${col}" stroke-width="26" stroke-dasharray="${Math.max(0, len - 2)} ${CIR}" stroke-dashoffset="${-ang}" transform="rotate(-90 90 90)"><title>${l}: ${n}</title></circle>`;
      ang += len;
      return seg;
    }).join("");
    const donut = `<section class="panel"><div class="panel-h" style="flex-direction:column;align-items:flex-start;gap:2px"><h2>Status em aberto</h2><span class="note">Distribuição dos contratos ainda em execução, por situação. Clique em uma fatia ou linha para filtrar a carteira.</span></div>
   <div class="dwrap"><svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Status dos contratos em aberto"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--line)" stroke-width="26"/>${segs}<text x="90" y="88" text-anchor="middle" class="dn">${tot}</text><text x="90" y="108" text-anchor="middle" class="dl">CONTRATOS EM</text><text x="90" y="121" text-anchor="middle" class="dl">ABERTO</text></svg>
   <div class="dleg">${CATS.map(([k, l, d, col]) => {
     const n = cnt(k);
     return `<button class="dli ${cartF === k ? "on" : ""} ${cartF && cartF !== k ? "dim" : ""}" data-cf="${k}"><i style="background:${col}"></i><span class="dt"><b>${l}</b><small>${d}</small></span><span class="dc">${n}</span><span class="dp">${tot ? Math.round((n / tot) * 100) : 0}%</span></button>`;
   }).join("")}
   <p class="hint">${nConc ? `${nConc} contrato${nConc > 1 ? "s" : ""} concluído${nConc > 1 ? "s" : ""} fora da rosca.` : "Nenhum contrato concluído na carteira atual; a rosca considera todos os contratos ativos."}${cartF ? ` · <button class="btn ghost" data-cf="">Limpar filtro</button>` : ""}</p></div></div></section>`;
    const CF = cartF ? C.filter((x) => x.cat === cartF) : C;
    const rows = CF.map(
      (
        x,
      ) => `<tr class="child prow" data-proj="${esc(x.id)}" data-txt="${esc(semAcento([x.nome, x.nomeLista, x.cliente, x.clienteLista, x.contrato].filter(Boolean).join(" ")))}" tabindex="0"><td><b>${esc(x.nome || x.nomeLista || "Projeto")}</b><span class="sub">${esc(x.cliente || x.clienteLista || "–")}${x.contrato ? " · " + esc(x.contrato) : ""}</span>${x.cat === "adm" ? `<span class="admmot">Atraso administrativo: ${esc(x.admMot || "motivo não informado")}${x.admTxt ? ` <small>· ${esc(x.admTxt)}</small>` : ""}</span>` : ""}</td>
    <td class="sinalcell"><span class="sinal ${x.st[0]}" role="img" aria-label="${esc(x.st[1])}" title="${esc(x.st[1] + (x.cat === "fora" && x.lim ? `: limite contratual em ${fmtD(x.lim)}${x.atraso ? ` (${x.atraso} dias)` : ""}` : "") + (x.cat === "adm" ? ": " + (x.admMot || "motivo não informado") + (x.admTxt ? " · " + x.admTxt : "") : "") + (x.cat === "fora" && x.admAtivo ? " · também em atraso administrativo" + (x.admTxt ? " " + x.admTxt : "") : ""))}"></span></td>
    <td class="dts" style="text-align:center">${fmtPct(x.real || 0)}</td><td class="dts" style="text-align:center">${fmtPct(x.plan)}</td>
    <td class="dts" style="text-align:center;color:${x.spi == null ? "inherit" : x.spi < 0.9 ? "var(--alert)" : x.spi < 1 ? "var(--wf)" : "var(--ok)"}">${x.spi == null ? "–" : x.spi.toFixed(2).replace(".", ",")}</td>
    <td class="dts" style="text-align:center">${x.tad ? fmtD(x.tad) : "–"}</td><td class="dts" style="text-align:center">${x.lim ? fmtD(x.lim) : "–"}</td>
    <td class="dts" style="text-align:center;color:${x.atraso ? "var(--alert)" : "inherit"}">${x.atraso == null ? "–" : x.atraso ? x.atraso + " d" : '<span class="mut">no prazo</span>'}</td>
    <td class="srcell">${acompResumo(x)}</td></tr>${cartAbertos.has(x.id) ? acompDetalhe(x) : ""}`,
    ).join("");
    const tbl = `<section class="panel"><div class="panel-h cfilh"><h2>Projetos</h2><label class="sbw cbusca">${SIC.lupa}<input class="sbusca" type="search" data-cartq value="${esc(cartBusca)}" placeholder="Pesquisar projeto, cliente ou contrato" aria-label="Pesquisar projeto"></label><label class="pmf cstf">Status<select data-cartst><option value="">Todos (${C.length})</option>${CATS.map(([kk, l]) => `<option value="${kk}" ${cartF === kk ? "selected" : ""}>${l} (${C.filter((x) => x.cat === kk).length})</option>`).join("")}</select></label><span class="note cqn" id="cartQn"></span><button class="btn ghost" data-cartref>Atualizar</button></div>
    <div class="tw"><table class="crono ftb"><colgroup><col><col style="width:64px"><col style="width:90px"><col style="width:90px"><col style="width:70px"><col style="width:96px"><col style="width:96px"><col style="width:76px"><col style="width:34%"></colgroup>
    <thead><tr><th>Projeto${cartF ? ` · ${CATS.find((c) => c[0] === cartF)[1]}` : ""}</th><th style="text-align:center">Status</th><th style="text-align:center">Físico real</th><th style="text-align:center">Planejado</th><th style="text-align:center">SPI</th><th class="thw" style="text-align:center" title="Termo de aceite definitivo: data planejada no cronograma">T.A.D. planejado</th><th class="thw" style="text-align:center" title="Limite de implantação do contrato (ordem de início + prazo + aditivos)">Limite contratual</th><th style="text-align:center" title="Dias além do limite contratual: até a conclusão real ou, em execução, até a data mais tardia entre hoje e o T.A.D. planejado">Atraso</th><th>Acompanhamento <button type="button" class="lnk srall" data-srall>${CF.every((x) => cartAbertos.has(x.id)) ? "recolher todos" : "abrir todos"}</button></th></tr></thead><tbody>${rows}</tbody></table></div>${dlResp()}</section>`;
    v.innerHTML =
      cartHeader() +
      k +
      donut +
      `<div class="grid2"><section class="panel"><div class="panel-h"><h2>Curva S acumulada · Físico G3</h2><span class="note">${cartF ? "Filtro aplicado · " : ""}Média ponderada pelo valor do contrato</span></div><div class="chart" id="chCartF"></div><div id="chCartF-lg"></div></section><section class="panel"><div class="panel-h"><h2>Recorrência implantada · carteira</h2><span class="note">${cartF ? "Filtro aplicado · " : ""}Locações, rumo à 1ª parcela de cada projeto, por mês de liberação</span></div><div class="chart" id="chCartM"></div><div id="chCartM-lg"></div></section></div>` +
      tbl;
    v.querySelectorAll("textarea.srin").forEach(ajustaAltura);
    filtraCart();
    drawCartCurves(CF);
  }
  /* pesquisa na tabela de projetos da carteira (nome, cliente, contrato), sem redesenhar a tela */
  let cartBusca = "";
  function filtraCart() {
    const q = semAcento(cartBusca);
    let n = 0,
      t = 0;
    document.querySelectorAll("#view table.ftb tr.prow[data-txt]").forEach((r) => {
      const ok = !q || r.dataset.txt.includes(q);
      r.hidden = !ok;
      t++;
      if (ok) n++;
      const d = r.nextElementSibling;
      if (d && d.classList.contains("srdet")) d.hidden = !ok;
    });
    const el = $("#cartQn");
    if (el) el.textContent = q ? `${n} de ${t}` : "";
  }
  document.addEventListener("input", (e) => {
    if (e.target.matches && e.target.matches("[data-cartq]")) {
      cartBusca = e.target.value;
      filtraCart();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches && e.target.matches("[data-cartst]")) {
      cartF = e.target.value;
      render();
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("[data-cartpdf]")) cartPDF();
  });
  /* relatório executivo da carteira (PDF): indicadores, situação, projetos e acompanhamento.
     Vale o que está na tela: filtro de status (rosca/seletor) e pesquisa. */
  async function cartPDF() {
    if (!downloads) return toast("Exportação indisponível neste ambiente.");
    if (!CART) return toast("A carteira ainda está carregando.");
    const q = semAcento(cartBusca);
    const txt = (x) => semAcento([x.nome, x.nomeLista, x.cliente, x.clienteLista, x.contrato].filter(Boolean).join(" "));
    const C = CART.filter((x) => !x.encerrado);
    const L = C.filter((x) => (!cartF || x.cat === cartF) && (!q || txt(x).includes(q)));
    if (!L.length) return toast("Nenhum projeto com os filtros atuais.");
    toast("Gerando o relatório executivo…");
    try {
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth(),
        H = doc.internal.pageSize.getHeight();
      const pt = (t) => String(t == null ? "" : t).replace(/›/g, ">").replace(/∞/g, "contínuo").replace(/[^\x00-\xFF•–—“”‘’…]/g, "");
      const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const COR = { fora: "#B0304A", atraso: "#E5736B", adm: "#8E9CF0", atencao: "#E0A458", prazo: "#4FC48A", concl: "#8E9AA6" };
      const NOME = { fora: "Fora do prazo contratual", atraso: "Em atraso", adm: "Atraso administrativo", atencao: "Atenção", prazo: "No prazo", concl: "Concluído" };
      const filtro = [cartF ? "status: " + NOME[cartF] : "", q ? `pesquisa: "${cartBusca.trim()}"` : ""].filter(Boolean).join(" · ");
      // cabeçalho
      doc.setFillColor(30, 43, 58);
      doc.rect(0, 0, W, 22, "F");
      doc.setTextColor(255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Relatório executivo · Carteira de projetos", 10, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(pt(`DGT Tecnologia · posição em ${fmtD(todayISO())} · ${L.length} projeto${L.length > 1 ? "s" : ""}${filtro ? " · " + filtro : ""}`), 10, 17);
      doc.setTextColor(0);
      // indicadores
      const val = L.reduce((s0, x) => s0 + (+x.valor || 0), 0),
        meta = L.reduce((s0, x) => s0 + (+x.M || 0), 0),
        fat = L.reduce((s0, x) => s0 + (+x.fat || 0), 0);
      const Wc = L.filter((x) => x.n);
      const fm = Wc.length ? Wc.reduce((s0, x) => s0 + x.real, 0) / Wc.length : 0;
      const atr = L.filter((x) => (x.atraso || 0) > 0).length;
      const AB = L.flatMap((x) => (x.acoes || []).filter((a) => a.t && !a.ok));
      const abAt = AB.filter((a) => acSit(a)[0] === "r").length;
      const K = [
        [String(L.length), "Projetos"],
        [BRLc(val), "Valor contratado"],
        [BRLc(meta), "Meta · 1ªs parcelas cheias"],
        [BRLc(fat), "Realizado (boletins)"],
        [fmtPct(fm), "Físico médio realizado"],
        [String(atr), "Além do limite contratual"],
        [`${AB.length}${abAt ? ` (${abAt} atras.)` : ""}`, "Ações em aberto"],
      ];
      const kw = (W - 20 - 6 * 3) / K.length;
      K.forEach(([v, l], i) => {
        const x = 10 + i * (kw + 3);
        doc.setDrawColor(210);
        doc.setFillColor(246, 248, 250);
        doc.roundedRect(x, 27, kw, 18, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(pt(v), x + 3, 35);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(90);
        doc.text(pt(l), x + 3, 41);
        doc.setTextColor(0);
      });
      // situação dos contratos
      let xs = 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Situação:", xs, 53);
      xs += 18;
      doc.setFont("helvetica", "normal");
      ["fora", "atraso", "adm", "atencao", "prazo", "concl"].forEach((c) => {
        const n = L.filter((x) => x.cat === c).length;
        if (!n && c === "concl") return;
        doc.setFillColor(...rgb(COR[c]));
        doc.rect(xs, 50.2, 3.2, 3.2, "F");
        const t = pt(`${NOME[c]}: ${n} (${Math.round((n / L.length) * 100)}%)`);
        doc.text(t, xs + 5, 53);
        xs += 5 + doc.getTextWidth(t) + 8;
      });
      // tabela de projetos
      const spiTxt = (x) => (x.spi == null ? "–" : x.spi.toFixed(2).replace(".", ","));
      doc.autoTable({
        startY: 58,
        head: [["Projeto", "Cliente", "Situação", "Físico real", "Planejado", "SPI", "T.A.D. plan.", "Limite contr.", "Atraso"]],
        body: L.map((x) => [pt(x.nome || x.nomeLista || "Projeto"), pt(x.cliente || x.clienteLista || "–"), pt(NOME[x.cat] || x.st[1]), fmtPct(x.real || 0), fmtPct(x.plan), spiTxt(x), x.tad ? fmtD(x.tad) : "–", x.lim ? fmtD(x.lim) : "–", x.atraso == null ? "–" : x.atraso ? x.atraso + " d" : "no prazo"]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 1.6, valign: "middle" },
        headStyles: { fillColor: [30, 43, 58] },
        columnStyles: { 0: { cellWidth: 70, fontStyle: "bold" }, 1: { cellWidth: 52 }, 2: { cellWidth: 34 }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" }, 7: { halign: "center" }, 8: { halign: "center" } },
        didParseCell: (d) => {
          if (d.section !== "body") return;
          const x = L[d.row.index];
          if (d.column.index === 2) d.cell.styles.textColor = rgb(COR[x.cat] || "#555555").map((v) => Math.max(0, v - 40));
          if (d.column.index === 5 && x.spi != null) d.cell.styles.textColor = x.spi < 0.9 ? [179, 38, 30] : x.spi < 1 ? [31, 122, 112] : [46, 125, 79];
          if (d.column.index === 8 && x.atraso) d.cell.styles.textColor = [179, 38, 30];
        },
      });
      // acompanhamento: status report e ações em aberto de cada projeto
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Acompanhamento dos projetos", 10, 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(90);
      doc.text("Status report mais recente e ações em aberto (responsável e prazo).", 10, 18);
      doc.setTextColor(0);
      const acTxt = (x) => {
        const A = (x.acoes || []).filter((a) => a.t && !a.ok).sort((a, b) => (a.cont ? "9" : a.d || "8") < (b.cont ? "9" : b.d || "8") ? -1 : 1);
        return A.length ? A.map((a) => `• ${a.t} — ${a.r || "sem responsável"} · ${a.cont ? "contínua" : a.d ? fmtD(a.d) + (a.d < todayISO() ? " (atrasada)" : "") : "sem prazo"}`).join("\n") : "Nenhuma ação em aberto.";
      };
      doc.autoTable({
        startY: 22,
        head: [["Projeto", "Status report", "Ações em aberto"]],
        body: L.map((x) => [pt(`${x.nome || x.nomeLista || "Projeto"}\n${NOME[x.cat] || x.st[1]}${x.srData ? "\natualizado " + fmtD(x.srData) : ""}`), pt(x.sr || "Sem status report."), pt(acTxt(x))]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, valign: "top", overflow: "linebreak" },
        headStyles: { fillColor: [30, 43, 58] },
        columnStyles: { 0: { cellWidth: 58, fontStyle: "bold" }, 1: { cellWidth: 104 } },
        didParseCell: (d) => {
          if (d.section === "body" && d.column.index === 2 && /atrasada/.test(d.cell.raw)) d.cell.styles.textColor = [150, 30, 25];
        },
      });
      // rodapé com páginas
      const np = doc.internal.getNumberOfPages();
      for (let i = 1; i <= np; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(120);
        doc.text(pt(`Painel PMO · DGT Tecnologia · relatório executivo da carteira · ${fmtD(todayISO())}`), 10, H - 5);
        doc.text(`Página ${i} de ${np}`, W - 30, H - 5);
      }
      doc.setTextColor(0);
      await downloads.save({ filename: `relatorio-executivo-carteira-${todayISO()}.pdf`, data: doc.output("blob") });
    } catch (err) {
      toast("Não foi possível gerar o relatório: " + ((err && err.message) || err));
    }
  }
  /* acompanhamento dos projetos na carteira: resumo na tabela (status report, ações abertas,
     atrasadas e a próxima com responsável); ao abrir, status report e ações por inteiro */
  const cartAbertos = new Set();
  let acRespF = "";
  const acSit = (a) => {
    const hoje = todayISO();
    if (a.ok) return ["c", "Realizada " + fmtD(a.ok)];
    if (a.cont) return ["k", "Contínua"];
    if (!a.d) return ["n", "Sem prazo"];
    if (a.d < hoje) return ["r", "Atrasada"];
    if (a.d === hoje) return ["a", "Vence hoje"];
    return ["p", "No prazo"];
  };
  // sugestões de responsável: equipe do setor e quem já aparece nas ações
  const dlResp = () => {
    const N = new Set(equipe().flatMap((e) => e.membros));
    (CART || []).forEach((x) => (x.acoes || []).forEach((a) => a.r && N.add(a.r)));
    return `<datalist id="dlResp">${[...N].sort((a, b) => COLPT(a, b)).map((n) => `<option value="${esc(n)}">`).join("")}</datalist>`;
  };
  function acompResumo(x) {
    const AC = (x.acoes || []).filter((a) => a.t);
    const ab = AC.filter((a) => !a.ok);
    const at = ab.filter((a) => acSit(a)[0] === "r");
    const prox = ab.filter((a) => a.d && !a.cont).sort((a, b) => (a.d < b.d ? -1 : 1))[0] || ab.find((a) => !a.cont) || ab[0];
    const meta = [
      x.srData ? `atualizado ${fmtD(x.srData)}` : "",
      ab.length ? `<b>${ab.length}</b> ${ab.length === 1 ? "ação aberta" : "ações abertas"}` : AC.length ? "ações concluídas" : "sem ações",
      at.length ? `<em class="bad">${at.length} atrasada${at.length > 1 ? "s" : ""}</em>` : "",
    ].filter(Boolean);
    const aberto = cartAbertos.has(x.id);
    return `<button type="button" class="srres ${aberto ? "on" : ""}" data-srtg="${esc(x.id)}" aria-expanded="${aberto}" title="${aberto ? "Recolher" : "Abrir status report e ações"}"><span class="srtx">${x.sr ? esc(x.sr) : `<span class="mut">Sem status report</span>`}</span><span class="srmeta">${meta.join(" · ")}</span>${prox ? `<span class="srprox"><i class="acdot s-${acSit(prox)[0]}"></i>Próxima: ${esc(prox.t)}${prox.r ? ` · <b>${esc(prox.r)}</b>` : ` · <em class="bad">sem responsável</em>`}${prox.cont ? " · contínua" : prox.d ? ` · ${fmtD(prox.d)}` : ""}</span>` : ""}<span class="srseta" aria-hidden="true"></span></button>`;
  }
  function acompDetalhe(x) {
    return `<tr class="srdet"><td colspan="9"><div class="srdg">
      <div class="srbox"><h4>Status report${x.srData ? ` <small>atualizado em ${fmtD(x.srData)}</small>` : ""}</h4><textarea class="acf srin srbig" rows="5" data-srp2="${esc(x.id)}" placeholder="Situação do projeto, o que avançou, impedimentos e próximos passos…" aria-label="Status report">${esc(x.sr || "")}</textarea></div>
      <div class="acbox"><h4>Ações</h4><div class="acth2"><span></span><span>Ação</span><span>Responsável</span><span>Prazo</span><span></span></div><div class="aclist" data-acp="${esc(x.id)}">${(x.acoes.length ? x.acoes : [{}]).map(acRowHTML).join("")}<button type="button" class="acadd" data-acadd>+ ação</button></div></div>
    </div></td></tr>`;
  }
  /* ações em aberto de todos os projetos (filtradas pela situação da rosca), pelo prazo */
  function acoesCarteira(CF) {
    const L = CF.flatMap((x) => (x.acoes || []).map((a, k) => ({ x, a, k }))).filter((o) => o.a.t && !o.a.ok);
    const R = [...new Set(L.map((o) => o.a.r || ""))].sort((a, b) => (!a ? 1 : !b ? -1 : COLPT(a, b)));
    if (acRespF && !R.includes(acRespF === "-" ? "" : acRespF)) acRespF = "";
    const F = L.filter((o) => !acRespF || (o.a.r || "") === (acRespF === "-" ? "" : acRespF)).sort((p, q) => (p.a.d || "9999") < (q.a.d || "9999") ? -1 : (p.a.d || "9999") > (q.a.d || "9999") ? 1 : 0);
    const nAt = L.filter((o) => acSit(o.a)[0] === "r").length,
      nSem = L.filter((o) => !o.a.r).length;
    const linhas = F.map((o) => {
      const s = acSit(o.a);
      return `<tr class="acl s-${s[0]}"><td class="nw">${o.a.d ? fmtD(o.a.d) : "–"}</td><td><button type="button" class="lnk" data-srtg="${esc(o.x.id)}" data-srfoco="1">${esc(o.x.nome || o.x.nomeLista || "Projeto")}</button></td><td>${esc(o.a.t)}</td><td>${o.a.r ? esc(o.a.r) : `<em class="bad">sem responsável</em>`}</td><td><span class="acst s-${s[0]}">${s[1]}</span></td><td><button type="button" class="acok" data-acfeita="${esc(o.x.id)}|${o.k}" title="Marcar como realizada" aria-label="Marcar como realizada"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></td></tr>`;
    }).join("");
    return `<section class="panel"><div class="panel-h"><h2>Ações em aberto</h2><span class="note">${L.length} ${L.length === 1 ? "ação" : "ações"}${nAt ? ` · <b class="bad">${nAt} atrasada${nAt > 1 ? "s" : ""}</b>` : ""}${nSem ? ` · ${nSem} sem responsável` : ""}${cartF ? " · filtro da rosca aplicado" : ""}</span><label class="pmf acrf">Responsável<select data-acrf><option value="">Todos</option>${R.map((r) => `<option value="${r ? esc(r) : "-"}" ${acRespF === (r || "-") ? "selected" : ""}>${r ? esc(r) : "Sem responsável"}</option>`).join("")}</select></label></div>${
      L.length
        ? `<div class="tw"><table class="crono ftb aclt"><colgroup><col style="width:96px"><col style="width:24%"><col><col style="width:18%"><col style="width:130px"><col style="width:52px"></colgroup><thead><tr><th>Prazo</th><th>Projeto</th><th>Ação</th><th>Responsável</th><th>Situação</th><th></th></tr></thead><tbody>${linhas || `<tr><td colspan="6" class="mut">Nenhuma ação deste responsável.</td></tr>`}</tbody></table></div>`
        : `<p class="ok-msg">Nenhuma ação em aberto. Abra o acompanhamento de um projeto na tabela abaixo para cadastrar.</p>`
    }</section>`;
  }
  document.addEventListener("click", (e) => {
    let b;
    if ((b = e.target.closest && e.target.closest("[data-srtg]"))) {
      const id = b.dataset.srtg;
      const abrir = b.dataset.srfoco ? true : !cartAbertos.has(id);
      abrir ? cartAbertos.add(id) : cartAbertos.delete(id);
      render();
      if (abrir && b.dataset.srfoco)
        setTimeout(() => {
          const r = document.querySelector(`[data-acp="${CSS.escape(id)}"]`);
          if (r) r.closest("tr").scrollIntoView({ block: "center" });
        }, 60);
    } else if ((b = e.target.closest && e.target.closest("[data-srall]"))) {
      const ids = (CART || []).filter((x) => !x.encerrado && (!cartF || x.cat === cartF)).map((x) => x.id);
      const todos = ids.every((id) => cartAbertos.has(id));
      ids.forEach((id) => (todos ? cartAbertos.delete(id) : cartAbertos.add(id)));
      render();
    } else if ((b = e.target.closest && e.target.closest("[data-acfeita]"))) {
      const [pid, k] = b.dataset.acfeita.split("|");
      const x = CART && CART.find((y) => y.id === pid);
      if (!x || !x.acoes[+k]) return;
      const ac = x.acoes.map((a, j) => (j === +k ? Object.assign({}, a, { ok: todayISO() }) : a));
      x.acoes = ac;
      const base = pid === "main" ? "" : `projetos/${pid}/`;
      db.doc(base + "config/projeto")
        .update({ acoes: ac })
        .then(() => {
          if (pid === PID) cfg.acoes = ac;
        })
        .catch((err) => toast(errMsg(err)));
      toast("Ação marcada como realizada.");
      render();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches && e.target.matches("[data-acrf]")) {
      acRespF = e.target.value;
      render();
    }
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-cartref]")) {
      CART = null;
      render();
    }
  });
  function statusReport(CF) {
    if (!CF.length) return "";
    const card = (x) => {
      const A = [0, 1, 2].map((k) => x.acoes[k] || {});
      const hoje = todayISO();
      return `<article class="srcard" data-srp="${esc(x.id)}">
      <header class="srh"><div><h3>${esc(x.nome || x.nomeLista || "Projeto")}</h3><span class="sub">${esc(x.cliente || x.clienteLista || "–")}${x.contrato ? " · " + esc(x.contrato) : ""}</span></div><span class="chip ${x.st[0]}">${x.st[1]}</span></header>
      <div class="srk">
        <div><span>Físico</span><b>${fmtPct(x.real)}</b><small>plan. ${fmtPct(x.plan)}</small></div>
        <div><span>SPI</span><b style="color:${x.spi == null ? "inherit" : x.spi < 0.9 ? "var(--alert)" : x.spi < 1 ? "var(--wf)" : "var(--ok)"}">${x.spi == null ? "–" : x.spi.toFixed(2).replace(".", ",")}</b><small>${x.late ? x.late + " atrasada" + (x.late > 1 ? "s" : "") : "sem atrasos"}</small></div>
        <div><span>T.A.D. planejado</span><b>${x.tad ? fmtD(x.tad) : "–"}</b><small>limite contratual ${x.lim ? fmtD(x.lim) : "–"}${x.atraso != null ? ` · <em style="color:${x.atraso ? "var(--alert)" : "var(--ok)"};font-style:normal">${x.atraso ? x.atraso + " d de atraso" : "no prazo"}</em>` : ""}</small></div>
        <div><span>1ª parcela cheia</span><b>${x.ff ? BRLc(x.ff.v) : "–"}</b><small>${x.ff ? "comp. " + ymLbl(x.ff.comp) : "sem previsão"}</small></div>
        <div><span>Realizado</span><b>${BRLc(x.fat || 0)}</b><small>de ${x.valor ? BRLc(x.valor) : "–"}</small></div>
      </div>
      <div class="srs"><h4>Pontos de atenção${x.nAlerts > 3 ? ` <small>(3 de ${x.nAlerts})</small>` : ""}</h4>${x.alerts.length ? `<ul>${x.alerts.map((a) => `<li><span class="tag ${a[0]}">${a[1]}</span><span>${a[2]}</span></li>`).join("")}</ul>` : `<p class="ok-msg">Nenhum ponto de atenção.</p>`}</div>
      <div class="srs"><h4>Próximas ações</h4><div class="acth"><span>Ação</span><span>Responsável</span><span>Prazo</span></div>
        ${A.map((a, k) => `<div class="actr"><span class="actn">${k + 1}</span><input class="acf" data-k="t" value="${esc(a.t || "")}" placeholder="Descreva a ação" aria-label="Ação ${k + 1}"><input class="acf" data-k="r" value="${esc(a.r || "")}" placeholder="Responsável" aria-label="Responsável ${k + 1}"><input class="acf ${a.d && a.d < hoje && a.t ? "late" : ""}" data-k="d" type="date" value="${esc(a.d || "")}" aria-label="Prazo ${k + 1}"></div>`).join("")}
      </div>
      <footer class="srf"><button class="btn ghost" data-proj="${esc(x.id)}">Abrir projeto →</button></footer>
    </article>`;
    };
    return `<section class="panel"><div class="panel-h"><h2>Status report</h2><span class="note">${cartF ? "Filtro aplicado · " : ""}${CF.length} projeto${CF.length > 1 ? "s" : ""} · ${fmtD(todayISO())}</span></div><div class="srgrid">${CF.map(card).join("")}</div></section>`;
  }
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("input.acf"))) return;
    setTimeout(() => {
      const c = t.closest("[data-srp]");
      if (!c || !CART) return;
      const pid = c.dataset.srp;
      const x = CART.find((y) => y.id === pid);
      if (!x) return;
      const ac = [...c.querySelectorAll(".actr")].map((r, k) => {
        const o = {};
        r.querySelectorAll("[data-k]").forEach(
          (i) => (o[i.dataset.k] = i.value.trim()),
        );
        if (x.acoes[k] && x.acoes[k].ok) o.ok = x.acoes[k].ok;
        return o;
      });
      const norm = (L) =>
        JSON.stringify(
          L.map((a) => ({ t: a.t || "", r: a.r || "", d: a.d || "" })),
        );
      const prev = [0, 1, 2].map((k) => x.acoes[k] || {});
      if (norm(ac) === norm(prev)) {
        if (pendingRender && !editingDate()) {
          pendingRender = false;
          render();
        }
        return;
      }
      const keep = ac.filter((a) => a.t || a.r || a.d);
      x.acoes = ac;
      const b = pid === "main" ? "" : `projetos/${pid}/`;
      db.doc(b + "config/projeto")
        .update({ acoes: keep })
        .then(() => {
          if (pid === PID) cfg.acoes = keep;
        })
        .catch((err) => toast(errMsg(err)));
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    if (!(t.matches && t.matches("textarea.srin"))) return;
    setTimeout(() => {
      const pid = t.dataset.srp2;
      const x = CART && CART.find((y) => y.id === pid);
      const v = t.value.trim();
      if (!x || v === (x.sr || "")) {
        if (pendingRender && !editingDate()) {
          pendingRender = false;
          render();
        }
        return;
      }
      x.sr = v;
      x.srData = todayISO();
      const b = pid === "main" ? "" : `projetos/${pid}/`;
      db.doc(b + "config/projeto")
        .update({ statusReport: v, statusReportData: todayISO() })
        .then(() => {
          if (pid === PID) cfg.statusReport = v;
        })
        .catch((err) => toast(errMsg(err)));
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  /* ações do status report: uma linha por ação (texto + data), quantas forem necessárias */
  function acRowHTML(a) {
    a = a || {};
    const late = a.t && a.d && !a.cont && a.d < todayISO() && !a.ok;
    // ação realizada: marcada com a data em que foi concluída (riscada, sem o alerta de atraso)
    const ok = `<button type="button" class="acok ${a.ok ? "on" : ""}" data-acok title="${a.ok ? `Realizada em ${fmtD(a.ok)} · clique para reabrir` : "Marcar como realizada"}" aria-label="${a.ok ? "Ação realizada" : "Marcar como realizada"}" aria-pressed="${a.ok ? "true" : "false"}"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    return `<div class="acrow ${a.ok ? "feita" : ""} ${a.cont ? "cont" : ""}" data-ok="${esc(a.ok || "")}" data-cont="${a.cont ? "1" : ""}">${ok}<input class="acf ac-t" data-k="t" value="${esc(a.t || "")}" placeholder="Próxima ação" aria-label="Próxima ação"><input class="acf ac-r" data-k="r" list="dlResp" value="${esc(a.r || "")}" placeholder="Responsável" aria-label="Responsável"><span class="acdw"><input class="acf ac-d ${late ? "late" : ""}" data-k="d" type="date" value="${esc(a.cont ? "" : a.d || "")}" aria-label="Data da ação" title="Data da ação"><span class="accont">Contínuo</span><button type="button" class="ico actg ${a.cont ? "on" : ""}" data-accont title="${a.cont ? "Prazo contínuo · clique para informar uma data" : "Prazo contínuo (sem data final)"}" aria-label="Prazo contínuo" aria-pressed="${a.cont ? "true" : "false"}">∞</button></span><button type="button" class="ico acdel" data-acdel title="Remover ação" aria-label="Remover ação"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
  }
  // prazo contínuo: a ação não tem data final (acompanhamento permanente) e nunca fica atrasada
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-accont]");
    if (!b) return;
    const row = b.closest(".acrow"),
      box = b.closest("[data-acp]");
    if (!row || !box) return;
    const cont = row.dataset.cont !== "1";
    row.dataset.cont = cont ? "1" : "";
    row.classList.toggle("cont", cont);
    b.classList.toggle("on", cont);
    b.setAttribute("aria-pressed", cont ? "true" : "false");
    b.title = cont ? "Prazo contínuo · clique para informar uma data" : "Prazo contínuo (sem data final)";
    if (cont) row.querySelector(".ac-d").value = "";
    const mudou = salvarAcoes(box);
    if (!cont) row.querySelector(".ac-d").focus();
    else if (mudou && !editingDate()) render(); // resumo da tabela mostra "contínua"
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-acok]");
    if (!b) return;
    const row = b.closest(".acrow"),
      box = b.closest("[data-acp]");
    if (!row || !box) return;
    const ok = row.dataset.ok ? "" : todayISO();
    row.dataset.ok = ok;
    row.classList.toggle("feita", !!ok);
    b.classList.toggle("on", !!ok);
    b.title = ok ? `Realizada em ${fmtD(ok)} · clique para reabrir` : "Marcar como realizada";
    b.setAttribute("aria-pressed", ok ? "true" : "false");
    salvarAcoes(box);
    toast(ok ? "Ação marcada como realizada." : "Ação reaberta.");
  });
  function salvarAcoes(box) {
    const pid = box.dataset.acp;
    const x = CART && CART.find((y) => y.id === pid);
    if (!x) return;
    const ant = x.acoes || [];
    const ac = [...box.querySelectorAll(".acrow")]
      .map((row, k) => {
        const o = {};
        row.querySelectorAll("[data-k]").forEach((i) => (o[i.dataset.k] = i.value.trim()));
        const di = row.querySelector(".ac-d");
        const ok = row.dataset.ok || "";
        const cont = row.dataset.cont === "1";
        if (di) di.classList.toggle("late", !!(o.t && o.d && !cont && o.d < todayISO() && !ok));
        const r = { t: o.t || "", r: o.r || "", d: cont ? "" : o.d || "" };
        if (cont) r.cont = true;
        if (ok) r.ok = ok;
        return r;
      })
      .filter((a) => a.t || a.d || a.r || a.cont);
    const norm = (L) => JSON.stringify(L.map((a) => [a.t || "", a.r || "", a.d || "", a.ok || "", !!a.cont]));
    if (norm(ac) === norm(ant)) return false;
    x.acoes = ac;
    const b = pid === "main" ? "" : `projetos/${pid}/`;
    db.doc(b + "config/projeto")
      .update({ acoes: ac })
      .then(() => {
        if (pid === PID) cfg.acoes = ac;
      })
      .catch((err) => toast(errMsg(err)));
    return true;
  }
  document.addEventListener("focusout", (e) => {
    const t = e.target;
    const box = t.closest && t.closest("[data-acp]");
    if (!box) return;
    setTimeout(() => {
      if (box.contains(document.activeElement)) return;
      if (salvarAcoes(box) && !editingDate()) return render();
      if (pendingRender && !editingDate()) {
        pendingRender = false;
        render();
      }
    }, 0);
  });
  document.addEventListener("click", (e) => {
    const box = e.target.closest && e.target.closest("[data-acp]");
    if (!box) return;
    if (e.target.closest("[data-acadd]")) {
      e.target.closest("[data-acadd]").insertAdjacentHTML("beforebegin", acRowHTML({}));
      const L = box.querySelectorAll(".acrow .ac-t");
      L[L.length - 1].focus();
    } else if (e.target.closest("[data-acdel]")) {
      e.target.closest(".acrow").remove();
      if (!box.querySelector(".acrow")) box.querySelector("[data-acadd]").insertAdjacentHTML("beforebegin", acRowHTML({}));
      salvarAcoes(box);
    }
  });
  /* status report da carteira: a caixa acompanha o tamanho do texto */
  // navegadores atuais ajustam a altura sozinhos (CSS field-sizing), sem medir o layout em JavaScript
  const ALTURA_CSS = !!(window.CSS && CSS.supports && CSS.supports("field-sizing", "content"));
  function ajustaAltura(el) {
    if (ALTURA_CSS) return;
    if (!el.offsetParent) return; // oculto (linha recolhida): ajusta quando aparecer
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }
  /* status report da carteira e observações do cronograma acompanham o tamanho do texto */
  function ajustarTextos() {
    if (ALTURA_CSS) return;
    // em lote (zera, mede, aplica) para não recalcular o layout a cada caixa em cronogramas grandes
    const L = [...document.querySelectorAll("#view textarea.srin, #view textarea.obs")].filter((el) => el.offsetParent);
    L.forEach((el) => (el.style.height = "auto"));
    const h = L.map((el) => el.scrollHeight);
    L.forEach((el, k) => (el.style.height = h[k] + 2 + "px"));
  }
  document.addEventListener("input", (e) => {
    if (e.target && e.target.matches && e.target.matches("textarea.srin, textarea.obs")) ajustaAltura(e.target);
  });
  let rzTexto;
  window.addEventListener("resize", () => {
    clearTimeout(rzTexto);
    rzTexto = setTimeout(ajustarTextos, 200);
  });
  let cartTab = (() => {
    try {
      return localStorage.getItem("pmo-hibrido-carttab") === "ctl" ? "ctl" : "adm";
    } catch (e) {
      return "adm";
    }
  })();
  function cartHeader() {
    return `<header class="top cart-top"><div class="title-block"><h1 class="cart-h">Painel da carteira${window.__sync ? ` <span class="livetag ${window.__sync.erro ? "err" : ""}" role="status"><i></i><span>${esc(window.__sync.txt)}</span></span>` : ""}</h1><p class="subtitle">Posição em ${fmtD(todayISO())} · ${(() => {
      const T = CART || [];
      const n = cartTab === "ctl" ? T.length : T.filter((x) => !x.encerrado).length;
      const e = T.filter((x) => x.encerrado).length;
      return `${n} projeto${n === 1 ? "" : "s"}${e ? (cartTab === "ctl" ? ` · ${e} encerrado${e === 1 ? "" : "s"} incluído${e === 1 ? "" : "s"}` : ` · ${e} encerrado${e === 1 ? "" : "s"} fora da lista`) : ""}`;
    })()}</p></div>${cartTab === "ctl" ? `<button class="btn primary" data-xlsx>Exportar Excel</button>` : `<button class="btn primary" data-cartpdf>Exportar relatório executivo</button>`}</header>
  <nav class="ctabs"><button class="${cartTab === "adm" ? "on" : ""}" data-ctab="adm">Administrativo</button><button class="${cartTab === "ctl" ? "on" : ""}" data-ctab="ctl">Controladoria</button></nav>`;
  }
  const CTL = {
    proj: "",
    sit: "andamento",
    nat: "",
    de: "",
    ate: "",
    mode: "prev",
    all: false,
  };
  let CTLp = null;
  function ctlRange() {
    const mv = ymOf(todayISO());
    if (CTL.all) {
      const ms = ctlSet()
        .flatMap((x) =>
          [...x.fin.R0, ...x.fin.RV, ...x.fin.RA].map((e) => e.bill),
        )
        .sort();
      if (ms.length) return { de: ms[0], ate: ms[ms.length - 1] };
    }
    return { de: CTL.de || mv, ate: CTL.ate || CTL.de || mv };
  }
  function ctlSet() {
    const C = CART || [];
    return C.filter(
      (x) =>
        (!CTL.proj || x.id === CTL.proj) &&
        (!CTL.nat || (CTL.nat === "aq" ? !!x.aq : !x.aq)) &&
        (CTL.sit === "todos" ||
          (CTL.sit === "concl" ? x.cat === "concl" : x.cat !== "concl")),
    );
  }
  // aumento de recorrência do projeto no mês de liberação bm: previsto (revisão vigente) x realizado
  /* faturamento com atraso: o que faltou num mês e foi faturado num mês seguinte (primeiro a faltar,
     primeiro a ser compensado). tarde: mês que faltou -> [[mês em que foi faturado, valor]];
     rec: mês que faturou a mais -> [[mês de origem do atraso, valor]] */
  function atrasoFat(keys, difOf) {
    const fila = [],
      tarde = new Map(),
      rec = new Map();
    const add = (M, k, v) => (M.get(k) || M.set(k, []).get(k)).push(v);
    keys.forEach((k) => {
      let d = difOf(k);
      if (d < -0.005) fila.push([k, -d]);
      else
        while (d > 0.005 && fila.length) {
          const q = fila[0],
            u = Math.min(d, q[1]);
          q[1] -= u;
          d -= u;
          add(tarde, q[0], [k, u]);
          add(rec, k, [q[0], u]);
          if (q[1] <= 0.005) fila.shift();
        }
    });
    return { tarde, rec };
  }
  const somaAt = (L) => (L || []).reduce((a, x) => a + x[1], 0);
  const mesesAt = (a, b) => {
    let n = 0;
    for (let m = a; m < b && n < 120; m = ymAdd(m, 1)) n++;
    return n;
  };
  const listaAt = (L, fmt) => [...new Set((L || []).map((x) => x[0]))].sort().map(fmt).join(", ");
  function ctlRec(x, mode, bm) {
    const s = (L) => (L || []).filter((e) => e.bill === bm).reduce((a, e) => a + (+e.aum || 0), 0);
    const pv = s(x.fin.recP),
      fv = s(x.fin.recR);
    if (mode === "p0") return s(x.fin.recP0);
    // mês ainda não liberado: sem diferença (o realizado ainda não aconteceu)
    return mode === "prev" ? pv : mode === "fat" ? fv : bm > ymOf(todayISO()) ? 0 : fv - pv;
  }
  function ctlVal(x, mode, bm) {
    const s = (L, f) => L.filter(f).reduce((a, e) => a + (+e.v || 0), 0);
    if (mode === "p0") return s(x.fin.R0, (e) => e.bill === bm);
    const pv = s(x.fin.RV, (e) => e.bill === bm),
      fv = s(x.fin.RA, (e) => e.bill === bm);
    return mode === "prev" ? pv : mode === "fat" ? fv : fv - pv;
  }
  function ctlMonths(P) {
    const { de, ate } = ctlRange();
    const L = [];
    let m = de;
    while (m <= ate && L.length < 60) {
      L.push(m);
      m = ymAdd(m, 1);
    }
    return L.length ? L : [de];
  }
  function renderCtl(v) {
    const C = CART || [];
    const mv = ymOf(todayISO());
    const { de, ate } = ctlRange();
    const P = ctlSet();
    const inR = (b) => b >= de && b <= ate;
    const sum = (k, f) =>
      P.reduce(
        (a, x) => a + x.fin[k].filter(f).reduce((s, e) => s + (+e.v || 0), 0),
        0,
      );
    const prev = sum("RV", (e) => inR(e.bill)),
      fat = sum("RA", (e) => inR(e.bill)),
      lib = sum("RA", (e) => inR(e.bill) && e.sit === "liberacao");
    const nP = P.filter((x) => x.fin.RV.some((e) => inR(e.bill))).length;
    const falta = (f) =>
      P.reduce((a, x) => {
        const ms = [...new Set(x.fin.RV.map((e) => e.bill))].filter((b) => inR(b));
        return a + ms.filter((b) => f(b, x)).reduce((t, b) => t + Math.max(0, ctlVal(x, "prev", b) - ctlVal(x, "fat", b)), 0);
      }, 0);
    // mês com boletim emitido (mesmo em liberação) fecha: o que faltou não será faturado
    const emit = (x, b) => x.fin.RA.some((e) => e.bill === b);
    // não faturado: o que ficou abaixo do previsto no mês vigente e nos anteriores (mês em aberto
    // não garante faturamento); meses futuros ainda são só previsão
    // atraso por projeto (todos os meses até o vigente, não só os do filtro)
    const ATP = new Map();
    const atP = (x) => {
      if (!ATP.has(x.id)) {
        const ks = [...new Set([...x.fin.RV, ...x.fin.RA].map((e) => e.bill))].filter((b) => b <= mv).sort();
        ATP.set(x.id, atrasoFat(ks, (b) => ctlVal(x, "dif", b)));
      }
      return ATP.get(x.id);
    };
    const atSoma = (L, k, bm) => L.reduce((a, x) => a + somaAt(atP(x)[k].get(bm)), 0);
    const atPer = (k) => P.reduce((a, x) => a + [...atP(x)[k].entries()].filter((e) => inR(e[0])).reduce((t, e) => t + somaAt(e[1]), 0), 0);
    const af = falta((b) => b > mv),
      perd = Math.max(0, falta((b) => b <= mv) - atPer("tarde")),
      atr = atPer("rec");
    const nfV = nfDate(ymAdd(mv, -1));
    const venc = af > 0.005 && inR(mv) && nfV < todayISO();
    const per = CTL.all
      ? `(todo o período · ${ymLbl(de)} a ${ymLbl(ate)})`
      : de === ate
        ? ymLbl(de)
        : `${ymLbl(de)} a ${ymLbl(ate)}`;
    const opt = (v, l, sel) =>
      `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(l)}</option>`;
    const allM = [
      ...new Set(
        C.flatMap((x) => [...x.fin.RV, ...x.fin.RA].map((e) => e.bill)).concat([
          mv,
        ]),
      ),
    ].sort();
    const mOpts = (sel) =>
      allM
        .map((m) =>
          opt(m, ymLbl(m) + (m === mv ? " · vigente" : ""), m === sel),
        )
        .join("");
    const f = CTLp || { proj: CTL.proj, sit: CTL.sit, nat: CTL.nat, de, ate, all: CTL.all };
    const dif = fat - prev;
    // aumento de recorrência no período (implantação: até a 1ª parcela cheia)
    const recIn = (x, k) => (x.fin[k] || []).filter((e) => inR(e.bill)).reduce((a, e) => a + (+e.aum || 0), 0);
    const NV = P.filter((x) => !x.aq && (recIn(x, "recP") > 0.005 || recIn(x, "recR") > 0.005));
    const rP = NV.reduce((a, x) => a + recIn(x, "recP"), 0),
      rR = NV.reduce((a, x) => a + recIn(x, "recR"), 0);
    const mesesRec = (x, k) => (x.fin[k] || []).filter((e) => inR(e.bill) && e.aum > 0.005).map((e) => e.bill);
    const filt = `<div class="ctlbar"><h2>Carteira completa</h2><span class="sp"></span>
    <label>Projetos<select data-cf2="proj">${opt("", `Todos (${C.length})`, !f.proj)}${C.map((x) => opt(x.id, x.nome || x.nomeLista, f.proj === x.id)).join("")}</select></label>
    <label>Situação<select data-cf2="sit">${opt("andamento", "Em andamento", f.sit === "andamento")}${opt("concl", "Concluídos", f.sit === "concl")}${opt("todos", "Todos", f.sit === "todos")}</select></label>
    <label>Natureza<select data-cf2="nat">${opt("", "Todas", !f.nat)}${opt("loc", "Locação", f.nat === "loc")}${opt("aq", "Aquisição", f.nat === "aq")}</select></label>
    <label>Faturamento de<select data-cf2="de" ${f.all ? "disabled" : ""}>${mOpts(f.de)}</select></label><label>até<select data-cf2="ate" ${f.all ? "disabled" : ""}>${mOpts(f.ate)}</select></label><label class="chk"><input type="checkbox" data-cf2="all" ${f.all ? "checked" : ""}><span>Todo o período</span></label>
    <button class="btn ghost" data-ctlclear>Limpar filtros</button></div>`;
    // faturamento atrasado no período (competências anteriores faturadas agora): aviso mesmo quando a
    // diferença fica positiva — não é faturamento acima do previsto
    const atrProj = P.map((x) => [x, [...atP(x).rec.entries()].filter((e) => inR(e[0])).reduce((t, e) => t + somaAt(e[1]), 0)])
      .filter((y) => y[1] > 0.005)
      .sort((a, b) => b[1] - a[1]);
    const avisoAtr = atr > 0.005
      ? `<div class="ctlaviso" role="alert"><b>Faturamento atrasado ${per}: ${BRL(atr)}</b><span>Valor de competências anteriores faturado com atraso neste período${dif > 0.005 ? ". A diferença aparece positiva, mas <b>não é faturamento acima do previsto</b>" : ""}.${atrProj.length ? ` ${atrProj.length === 1 ? "Projeto" : "Projetos"}: ${atrProj.slice(0, 8).map((y) => `${esc(y[0].nome || y[0].nomeLista || "Projeto")} (${BRL(y[1])})`).join("; ")}${atrProj.length > 8 ? ` e mais ${atrProj.length - 8}` : ""}.` : ""}</span></div>`
      : "";
    const cards = avisoAtr + `<div class="ctlcards">
    <div class="ccard"><span class="cl"><i style="background:var(--scrum)"></i>Previsto ${per}</span><b class="cv" style="color:var(--scrum)">${BRL(prev)}</b><small>${nP} projeto${nP === 1 ? "" : "s"} com faturamento previsto</small></div>
    <div class="ccard"><span class="cl"><i style="background:var(--ok)"></i>Faturado ${per}</span><b class="cv" style="color:var(--ok)">${BRL(fat)}</b><div class="cbar"><b style="width:${prev ? Math.min(100, (fat / prev) * 100) : 0}%"></b></div><small>${prev ? fmtPct(fat / prev) + " do previsto" : "sem previsto"}${lib ? ` · ${BRL(lib)} em liberação` : ""}</small></div>
    <div class="ccard"><span class="cl"><i style="background:${dif < -0.005 ? "var(--alert)" : atr > 0.005 ? "var(--mk)" : "var(--ok)"}"></i>Diferença ${per}</span><b class="cv" style="color:${dif < -0.005 ? "var(--alert)" : dif > 0.005 ? (atr > 0.005 ? "var(--mk)" : "var(--ok)") : "var(--ink)"}">${dif > 0.005 ? "+" : ""}${BRL(dif)}</b><small>${Math.abs(dif) <= 0.005 ? "faturado igual ao previsto" : prev ? `faturado ${fmtPct(Math.abs(dif) / prev)} ${dif < 0 ? "abaixo" : "acima"} do previsto` : "faturado sem previsto"}${af > 0.005 ? ` · ${BRL(af)} previsto nos meses seguintes` : ""}${atr > 0.005 ? ` · <span style="color:var(--mk)">${BRL(atr)} faturado com atraso</span>` : ""}${perd > 0.005 ? ` · <span style="color:var(--alert)">${BRL(perd)} não faturado</span>` : ""}</small></div>
    <div class="ccard crec"><span class="cl"><i style="background:var(--wf)"></i>Aumento da recorrência ${per}</span><b class="cv">+${BRL(rR)}<span class="cvs">/mês</span></b><small>${!NV.length ? "nenhum aumento de recorrência previsto ou realizado no período" : Math.abs(rR - rP) <= 0.005 ? "realizado igual ao previsto" : `realizado ${rP > 0.005 ? fmtPct(Math.abs(rR - rP) / rP) + " " : ""}${rR < rP ? "abaixo" : "acima"} do previsto · <span style="color:${rR < rP ? "var(--alert)" : "var(--ok)"}">${BRL(Math.abs(rR - rP))} ${rR < rP ? "abaixo" : "acima"} do previsto</span>`}</small></div></div>`;
    const ms = ctlMonths(P);
    // cada mês tem três colunas: previsto, faturado e diferença (faturado − previsto)
    const MDS = ["p0", "prev", "fat", "dif"];
    const cell = (val, bm, md, L) => {
      const neg = md === "dif" && val < -0.005,
        pos = md === "dif" && val > 0.005;
      // atraso: faltou e foi faturado depois, ou faturou a mais compensando mês anterior
      const vT = L && neg ? atSoma(L, "tarde", bm) : 0,
        vR = L && pos ? atSoma(L, "rec", bm) : 0;
      // tudo atraso: cor âmbar; parte atraso (linhas de total): só a marca "inclui atraso"
      const atr = (neg && vT >= -val - 0.005) || (pos && vR >= val - 0.005),
        parc = !atr && (vR > 0.005 || vT > 0.005);
      const tt = vT > 0.005 ? `${BRL(vT)} faturado com atraso nos meses seguintes` : vR > 0.005 ? `${BRL(vR)} referente a faturamento atrasado de meses anteriores (não é faturamento acima do previsto)` : "";
      return `<td class="mn ${bm === mv ? "inr" : ""} ${md === MDS[0] ? "mfirst" : ""} md-${md}" ${tt ? `title="${tt}"` : ""} style="${atr ? "color:var(--mk)" : neg ? "color:var(--alert)" : pos ? "color:var(--ok)" : ""}">${atr ? '<small class="atrm">atraso</small> ' : parc ? '<small class="atrm" style="color:var(--mk)">inclui atraso</small> ' : ""}${Math.abs(val) > 0.004 ? (md === "dif" && val > 0 ? "+" : "") + BRL(val) : '<span class="mut">–</span>'}</td>`;
    };
    const cells = (L) => ms.map((bm) => MDS.map((md) => cell(L.reduce((a, x) => a + ctlVal(x, md, bm), 0), bm, md, L)).join("")).join("");
    // só os projetos com faturamento (previsto ou faturado) nos meses mostrados
    const PT = P.filter((x) => ms.some((bm) => ["p0", "prev", "fat"].some((k) => Math.abs(ctlVal(x, k, bm)) > 0.004)));
    // destaque verde só quando a recorrência foi faturada (realizado) no período
    const emRec = (x) => NV.includes(x) && recIn(x, "recR") > 0.005;
    const rowOf = (x) =>
      `<tr class="child prow ${emRec(x) ? "nrec" : ""}" data-proj="${esc(x.id)}"><td class="pn2">${esc(x.nome || x.nomeLista || "Projeto")} <span class="rtag">${esc(x.rev || "R00")}</span>${emRec(x) ? ` <span class="ntag">↑ recorrência +${BRL(recIn(x, "recR"))}</span>` : ""}</td>${cells([x])}</tr>`;
    const recCells = (L) => ms.map((bm) => MDS.map((md) => cell(L.reduce((a, x) => a + ctlRec(x, md, bm), 0), bm, md)).join("")).join("");
    const nvRow = NV.length
      ? `<tr class="pgrp nrec"><td class="pn2">↑ Aumento da recorrência <span class="mut">· ${NV.length} projeto${NV.length === 1 ? "" : "s"}</span></td>${recCells(NV)}</tr>`
      : "";
    const tbl = `<section class="panel"><div class="panel-h"><h2>Físico x financeiro por competência</h2></div>
    <div class="ctlscroll"><table class="ctltb"><thead><tr><th class="pn2" rowspan="2">Projeto</th>${ms.map((m) => `<th class="mn mgrp mfirst ${m === mv ? "inr" : ""}" colspan="4">${ymLbl(m)}${m === mv ? " · vigente" : ""}</th>`).join("")}</tr>
    <tr>${ms.map((m) => `<th class="mn mfirst ${m === mv ? "inr" : ""}" title="Previsto no planejamento original (R00)">Previsto planejado</th><th class="mn ${m === mv ? "inr" : ""}" title="Previsto pela revisão em vigor">Previsto vigente</th><th class="mn ${m === mv ? "inr" : ""}">Faturado</th><th class="mn ${m === mv ? "inr" : ""}" title="Faturado menos o previsto vigente">Diferença</th>`).join("")}</tr></thead>
    <tbody><tr class="ptot"><td class="pn2">Físico x financeiro</td>${cells(P)}</tr>${nvRow}
    ${PT.length ? "" : `<tr><td class="pn2 mut" colspan="${ms.length * 4 + 1}">Nenhum projeto com faturamento no período.</td></tr>`}${[
      [true, "Aquisição (parcela única)"],
      [false, "Locação e serviços mensais"],
    ]
      .map(([aq, l]) => {
        const G = PT.filter((x) => !!x.aq === aq);
        if (!G.length) return "";
        return (
          `<tr class="pgrp"><td class="pn2">${l} <span class="mut">· ${G.length} projeto${G.length === 1 ? "" : "s"}</span></td>${cells(G)}</tr>` +
          G.map(rowOf).join("")
        );
      })
      .join("")}</tbody></table></div>
    <p class="hint" style="margin-top:8px">Colunas por mês de faturamento (competência + 1). Previsto pela revisão em vigor de cada projeto; faturado = boletins liberados e em liberação. Só aparecem os projetos com faturamento no período${P.length > PT.length ? ` (${P.length - PT.length} sem faturamento ocultos)` : ""}. Aumento da recorrência = quanto o faturamento mensal da locação sobe em relação à competência anterior, até a 1ª parcela cheia.</p></section>`;
    // consolidado: aumento de recorrência por projeto e mês
    const recTot = (x, md) => ms.reduce((a, bm) => a + ctlRec(x, md, bm), 0);
    const tdT = (val, md) => `<td class="mn ${md === MDS[0] ? "mfirst" : ""} md-${md}" style="${md === "dif" && val < -0.005 ? "color:var(--alert)" : md === "dif" && val > 0.005 ? "color:var(--ok)" : ""}">${Math.abs(val) > 0.004 ? (md === "dif" && val > 0 ? "+" : "") + BRL(val) : '<span class="mut">–</span>'}</td>`;
    const recTbl = NV.length
      ? `<section class="panel"><div class="panel-h"><h2>Aumento da recorrência por projeto</h2><span class="note">quanto cada projeto acrescenta ao faturamento mensal, por mês de liberação</span></div>
    <div class="ctlscroll"><table class="ctltb"><thead><tr><th class="pn2" rowspan="2">Projeto</th>${ms.map((m) => `<th class="mn mgrp mfirst ${m === mv ? "inr" : ""}" colspan="4">${ymLbl(m)}${m === mv ? " · vigente" : ""}</th>`).join("")}${ms.length > 1 ? `<th class="mn mgrp mfirst" colspan="4">Total do período</th>` : ""}</tr>
    <tr>${ms.map((m) => `<th class="mn mfirst ${m === mv ? "inr" : ""}">Previsto planejado</th><th class="mn ${m === mv ? "inr" : ""}">Previsto vigente</th><th class="mn ${m === mv ? "inr" : ""}">Realizado</th><th class="mn ${m === mv ? "inr" : ""}">Diferença</th>`).join("")}${ms.length > 1 ? `<th class="mn mfirst">Previsto planejado</th><th class="mn">Previsto vigente</th><th class="mn">Realizado</th><th class="mn">Diferença</th>` : ""}</tr></thead>
    <tbody><tr class="ptot"><td class="pn2">Total</td>${recCells(NV)}${ms.length > 1 ? MDS.map((md) => tdT(NV.reduce((a, x) => a + recTot(x, md), 0), md)).join("") : ""}</tr>
    ${NV.map((x) => `<tr class="child prow" data-proj="${esc(x.id)}"><td class="pn2">${esc(x.nome || x.nomeLista || "Projeto")} <span class="rtag">${esc(x.rev || "R00")}</span> <span class="mut">· 1ª parcela ${BRL(x.M)}</span></td>${recCells([x])}${ms.length > 1 ? MDS.map((md) => tdT(recTot(x, md), md)).join("") : ""}</tr>`).join("")}</tbody></table></div>
    <p class="hint" style="margin-top:8px">Exemplo: 50 mil faturados na competência dez (liberada em jan) e 80 mil na de jan → +50 mil em jan e +30 mil em fev. Teto: a 1ª parcela cheia do projeto. Quedas por glosa não reduzem a recorrência já implantada.</p></section>`
      : "";
    const recGraf = `<section class="panel"><div class="panel-h"><h2>Recorrência implantada · carteira</h2><span class="note">Locações dos filtros aplicados, rumo à 1ª parcela de cada projeto, por mês de liberação (12 meses)</span></div><div class="chart" id="chCtlRec"></div><div id="chCtlRec-lg"></div></section>`;
    v.innerHTML = cartHeader() + filt + cards + recGraf + tbl; // tabela "Aumento da recorrência por projeto" retirada a pedido
    requestAnimationFrame(() => recCarteira($("#chCtlRec"), $("#chCtlRec-lg"), P));
  }
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset && t.hasAttribute && t.hasAttribute("data-natsw")) {
      t.closest("form")
        .querySelectorAll(".lmeses,.lvig")
        .forEach(
          (lm) => (lm.style.display = t.value === "aquisicao" || t.value === "doacao" ? "none" : ""),
        );
      t.closest("form").querySelectorAll(".lval,.lass").forEach((lm) => (lm.style.display = t.value === "doacao" ? "none" : ""));
      return;
    }
    if (!t.dataset || !t.dataset.cf2) return;
    const v = t.type === "checkbox" ? t.checked : t.value;
    const k = t.dataset.cf2;
    if ((k === "de" || k === "ate") && !CTL.de) {
      const R = ctlRange();
      CTL.de = R.de;
      CTL.ate = R.ate;
    }
    CTL[k] = v;
    if (k === "de" && CTL.ate && CTL.ate < v) CTL.ate = v;
    if (k === "ate" && CTL.de && v < CTL.de) CTL.de = v;
    CTLp = null;
    render();
  });
  document.addEventListener("click", (e) => {
    const tb = e.target.closest("[data-ctab]");
    if (tb) {
      cartTab = tb.dataset.ctab;
      try {
        localStorage.setItem("pmo-hibrido-carttab", cartTab);
      } catch (_) {}
      render();
      return;
    }
    if (e.target.closest("[data-ctlapply]")) {
      if (CTLp) {
        Object.assign(CTL, CTLp);
        if (CTL.ate < CTL.de) CTL.ate = CTL.de;
      }
      CTLp = null;
      render();
      return;
    }
    if (e.target.closest("[data-ctlclear]")) {
      Object.assign(CTL, {
        proj: "",
        sit: "andamento",
        nat: "",
        de: "",
        ate: "",
        all: false,
      });
      CTLp = null;
      render();
      return;
    }
    const cm = e.target.closest("[data-cmode]");
    if (cm) {
      CTL.mode = cm.dataset.cmode;
      render();
      return;
    }
    if (e.target.closest("[data-xlsx]")) exportCtlXlsx();
  });
  async function exportCtlXlsx() {
    if (!downloads) {
      toast("Exportação indisponível neste ambiente.");
      return;
    }
    try {
      // portal: ExcelJS no lugar do SheetJS (mesmas abas, larguras e formato R$)
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js");
      const ms = ctlMonths(ctlSet());

      const P = ctlSet().filter((x) => ms.some((bm) => Math.abs(ctlVal(x, "prev", bm)) > 0.004 || Math.abs(ctlVal(x, "fat", bm)) > 0.004));
      const wb = new window.ExcelJS.Workbook();
      [
        ["p0", "Previsto planejado"],
        ["prev", "Previsto vigente"],
        ["fat", "Faturado"],
        ["dif", "Diferença"],
      ].forEach(([k, l]) => {
        const tot = (bm) => P.reduce((a, x) => a + ctlVal(x, k, bm), 0);
        const aoa = [
          ["Projeto", "Revisão", ...ms.map((m) => ymLbl(m))],
          [
            "Físico x financeiro",
            "",
            ...ms.map((bm) => Math.round(tot(bm) * 100) / 100),
          ],
          ...(P.some((x) => (x.fin.recP || []).concat(x.fin.recR || []).some((e) => e.aum > 0.005 && ms.includes(e.bill)))
            ? [["Aumento da recorrência", "", ...ms.map((bm) => Math.round(P.reduce((a, x) => a + ctlRec(x, k, bm), 0) * 100) / 100)]]
            : []),
          ...P.map((x) => [
            x.nome || x.nomeLista,
            x.rev || "R00",
            ...ms.map((bm) => Math.round(ctlVal(x, k, bm) * 100) / 100),
          ]),
        ];
        const ws = wb.addWorksheet(l);
        aoa.forEach((r) => ws.addRow(r));
        ws.columns.forEach((col, c) => (col.width = c === 0 ? 40 : c === 1 ? 8 : 14));
        for (let rI2 = 2; rI2 <= aoa.length; rI2++)
          for (let c = 3; c <= aoa[0].length; c++) {
            const cel = ws.getRow(rI2).getCell(c);
            if (typeof cel.value === "number") cel.numFmt = '"R$" #,##0.00';
          }
      });
      const out = await wb.xlsx.writeBuffer();
      await downloads.save({
        filename: `carteira-fisico-financeiro-${todayISO()}.xlsx`,
        data: new Blob([out], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      });
    } catch (err) {
      toast("Não foi possível exportar: " + ((err && err.message) || err));
    }
  }
  function drawCartCurves(CF) {
    const hF = $("#chCartF"),
      hM = $("#chCartM");
    if (!hF || !hM) return;
    const ct = dt(todayISO()).getTime();
    const P = CF.filter((x) => x.curve);
    if (P.length) {
      const ws = P.reduce((s, x) => s + (+x.valor || 1), 0);
      const w = (x) => (+x.valor || 1) / ws;
      const at = (x, arr, t, isReal) => {
        const c = x.curve;
        const k = Math.round((t - c.a) / DAY);
        if (k < 0) return 0;
        if (k >= c.n) {
          if (isReal) {
            for (let j = c.n - 1; j >= 0; j--)
              if (arr[j] != null) return arr[j];
            return 0;
          }
          return arr[c.n - 1] || 0;
        }
        const v = arr[k];
        if (v == null) {
          if (!isReal) return 0;
          for (let j = k; j >= 0; j--) if (arr[j] != null) return arr[j];
          return 0;
        }
        return v;
      };
      const a = Math.min(...P.map((x) => x.curve.a)),
        b = Math.max(...P.map((x) => x.curve.a + x.curve.n * DAY));
      const sr = [
        {
          name: "Planejado R00",
          color: C("--base"),
          dash: "6 4",
          width: 1.8,
          fn: (t) => P.reduce((s, x) => s + w(x) * at(x, x.curve.p0, t), 0),
        },
        {
          name: "Revisão vigente",
          color: C("--wf"),
          dash: "6 4",
          width: 2,
          fn: (t) => P.reduce((s, x) => s + w(x) * at(x, x.curve.pr, t), 0),
        },
        {
          name: "Realizado",
          color: C("--scrum"),
          width: 3,
          until: ct,
          fn: (t) =>
            P.reduce((s, x) => s + w(x) * at(x, x.curve.re, t, true), 0),
        },
      ];
      drawChart(hF, {
        range: { a, b },
        series: sr,
        ymax: 1,
        label: "Curva S física da carteira",
      });
      $("#chCartF-lg").innerHTML = legend(sr);
    } else
      hF.innerHTML = `<div class="chart-empty">Sem cronograma nos projetos selecionados.</div>`;
    recCarteira(hM, $("#chCartM-lg"), CF);
  }
  // recorrência implantada da carteira (locações): soma, mês a mês, do que cada projeto já implantou rumo à 1ª parcela
  function recCarteira(hM, lgEl, CF) {
    if (!hM) return;
    const F = CF.filter((x) => !x.aq && x.fin && +x.M > 0 && ((x.fin.recP0 || []).length || (x.fin.recP || []).length || (x.fin.recR || []).length));
    if (F.length) {
      const mv = ymOf(todayISO());
      const lv = (S, bm) => {
        const L = (S || []).filter((e) => e.bill <= bm);
        return L.length ? L[L.length - 1].acum : 0;
      };
      const bills = F.flatMap((x) => [...(x.fin.recP0 || []), ...(x.fin.recP || []), ...(x.fin.recR || [])].map((e) => e.bill)).sort();
      const soma = (k, ate) => {
        const out = [];
        let ant = 0;
        for (let bm = bills[0]; bm <= ate; bm = ymAdd(bm, 1)) {
          const ac = F.reduce((a, x) => a + lv(x.fin[k], bm), 0);
          out.push({ bill: bm, acum: ac, aum: Math.max(0, ac - ant) });
          ant = ac;
        }
        return out;
      };
      const fimP = bills[bills.length - 1];
      const temR = F.some((x) => (x.fin.recR || []).length);
      drawRec(hM, lgEl, {
        M: F.reduce((a, x) => a + (+x.M || 0), 0),
        s0: soma("recP0", fimP),
        sv: soma("recP", fimP),
        sr: temR ? soma("recR", mv < fimP ? mv : fimP) : [],
        rev: "Revisão vigente",
        mv,
        tetoLbl: "Soma das 1ªs parcelas",
        meses: 12,
      });
    } else {
      hM.innerHTML = `<div class="chart-empty">Informe a parcela mensal e o cronograma nos projetos de locação.</div>`;
      if (lgEl) lgEl.innerHTML = "";
    }
  }
  /* ---------- Painel PMO: calendário das atividades e stakeholders da DGT ---------- */
  const PKEY_PMO = "pmo-hibrido-pmo";
  let PMO = null,
    pmoBusy = false,
    pmoAt = 0;
  const PM = Object.assign(
    {
      tab: "geral",
      modo: "mes",
      cur: "",
      nivel: "pacote",
      proj: [],
      pessoa: [],
      escopo: "minhas",
      ocultarConc: true,
      msel: "",
    },
    (() => {
      try {
        return JSON.parse(localStorage.getItem(PKEY_PMO) || "{}");
      } catch (e) {
        return {};
      }
    })(),
  );
  // versões anteriores guardavam um projeto/pessoa só (texto)
  ["proj", "pessoa", "rtProj", "eqTec", "eqSt"].forEach((k) => {
    if (!Array.isArray(PM[k])) PM[k] = PM[k] ? [PM[k]] : [];
  });
  delete PM.resp;
  if (PM.tab === "ia") PM.tab = "cal"; // o assistente saiu da aba e virou o botão do canto superior direito
  PM.msel = "";
  function savePM() {
    try {
      const o = Object.assign({}, PM);
      delete o.cur;
      delete o.msel;
      localStorage.setItem(PKEY_PMO, JSON.stringify(o));
    } catch (e) {}
  }
  const normNome = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const codProj = (s) => {
    const m = String(s || "").match(/^\s*(\d+)/);
    return m ? m[1] : "";
  };
  /* "Responsável" das atividades: áreas e partes externas não são pessoas */
  const AREAS = new Set(
    [
      "implantação", "infraestrutura", "cliente", "projetos", "comercial", "pmo", "provedor",
      "suprimentos", "concessionária", "pré-vendas", "suporte", "administrativo", "intrasetor",
      "município", "cs", "cx", "intersetorial", "analista", "spgg", "operadora", "financeiro",
    ].map(normNome),
  );
  const ehPessoa = (s) =>
    !AREAS.has(normNome(s)) && /^\p{Lu}[\p{L}'-]+(\s+(d[aeo]s?\s+)?\p{Lu}[\p{L}'-]+)+$/u.test(String(s).trim());
  /* cor fixa por projeto (ângulo áureo sobre o matiz) */
  const corProj = (k) => `hsl(${Math.round((k * 137.508) % 360)} 52% 42%)`;
  /* datas planejadas como o painel do projeto as calcula: reprograma com o contexto do projeto */
  function pmoAgenda(data) {
    const sv = { itens: S.itens, fats: S.fats, prog: S.prog, cfg, stk };
    S.itens = data.itens;
    cfg = mergeCfg(data.cfg);
    stk = Object.assign({}, data.stk || {});
    try {
      // projeto ainda não aberto desde o calendário de dias úteis: converte as durações na leitura
      if (!cfg.diasUteis)
        S.itens = data.itens.map((i) => {
          const n = +i.grupo === 3 ? duracaoUtil(i) : null;
          return n == null ? i : Object.assign({}, i, { duracao: n });
        });
      const P = new Map(reschedule(S.itens).map((p) => [p.id, p.fields]));
      // projeto ainda não aberto desde a padronização de setores: aplica a regra só na leitura
      const v = +cfg.respV || (cfg.respV1 ? 1 : 0);
      const setor = (i) => {
        const s = v < RESP_V && respNovo(i, v);
        return s ? { resp: s } : {};
      };
      const L = ofG(3).map((i) => Object.assign({}, i, P.get(i.id) || {}, setor(i)));
      return L.map((i) => ({ i, a: rI(i), b: rF(i) })).filter((x) => x.a);
    } finally {
      S.itens = sv.itens;
      S.fats = sv.fats;
      S.prog = sv.prog;
      cfg = sv.cfg;
      stk = sv.stk;
    }
  }
  // gravou algo no projeto aberto: a próxima tela que usa os dados de todos os projetos (Minhas
  // atividades, Gestão de equipes) relê em vez de esperar os 30 s do cache
  function pmoVelho() {
    pmoAt = 0;
    cartAt = 0; // carteira também relê (situação, motivo e períodos de atraso administrativo)
  }
  async function loadPmo(force) {
    if (pmoBusy || (db && !projsOk) || (!db && conectando)) return;
    if (!force && PMO && Date.now() - pmoAt < 30000) return;
    pmoBusy = true;
    try {
      // projetos encerrados ficam fora do Painel PMO (os stakeholders continuam no painel do projeto)
      const L = (PROJS.length ? PROJS : [{ id: "main", nome: cfg.nome }]).filter((p) => !p.encerrado);
      const out = await Promise.all(
        L.map(async (p) => {
          if (!db)
            return { id: p.id, itens: S.itens, cfg, stk };
          const b = p.id === "main" ? "" : `projetos/${p.id}/`;
          if (p.id === "main" || p.id === L[0].id) {
            const eq = await db.doc("config/equipe").get();
            if (eq.exists && Array.isArray(eq.data().membros)) EQ = eq.data().membros;
            if (eq.exists && Array.isArray(eq.data().equipesCampo)) EQC = eq.data().equipesCampo;
            if (eq.exists && +eq.data().capDia > 0) AG_CAP = +eq.data().capDia;
          }
          const [a, c, k] = await Promise.all([
            db.collection(b + "atividades").get(),
            db.doc(b + "config/projeto").get(),
            db.doc(b + "config/stakeholders").get(),
          ]);
          return {
            id: p.id,
            itens: a.docs.map((x) => Object.assign({ id: x.id }, x.data())),
            cfg: c.exists ? c.data() : {},
            stk: k.exists ? k.data() : {},
          };
        }),
      );
      const hoje = todayISO();
      const projs = out
        .map((d) => {
          const nome = (d.cfg && d.cfg.nome) || (L.find((p) => p.id === d.id) || {}).nome || "Projeto";
          const ag = pmoAgenda(d);
          const g3 = ag.length;
          const conc = g3 && ag.every((x) => x.i.fimReal) && sprintsOk(d.itens || []);
          return {
            id: d.id,
            nome,
            cod: codProj(nome),
            cliente: (d.stk && d.stk.cliente) || "",
            dgt: Array.isArray(d.stk && d.stk.dgt) ? d.stk.dgt : [],
            vist: (d.cfg && d.cfg.vist) || {},
            ag,
            conc,
            itens: (d.itens || []).filter((i) => +i.grupo !== 3),
            cfg: d.cfg || {},
          };
        })
        .sort((x, y) => (+x.cod || 1e9) - (+y.cod || 1e9) || COLPT(x.nome, y.nome));
      projs.forEach((p, k) => (p.cor = corProj(k)));
      // eventos por atividade
      const ev = [];
      projs.forEach((p) =>
        p.ag.forEach(({ i, a, b }) => {
          const fim = b && b >= a ? b : a;
          ev.push({
            id: p.id + "|" + i.id,
            pid: p.id,
            proj: p,
            a,
            b: fim,
            i,
            titulo: i.titulo || "Atividade",
            fase: i.faseNome || "",
            pac: i.pacoteNome || "",
            resp: i.resp || "",
            done: !!i.fimReal,
            late: !i.fimReal && fim < hoje,
          });
        }),
      );
      // pessoas da DGT: cadastro de stakeholders de cada projeto e nomes atribuídos nas atividades
      const pes = new Map();
      const vincular = (nome, funcao, p, fonte) => {
        const k = normNome(nome);
        if (!k) return;
        if (!pes.has(k))
          pes.set(k, { nome: String(nome).trim(), funcoes: new Set(), projs: [], fontes: new Set() });
        const o = pes.get(k);
        if (funcao) o.funcoes.add(funcao);
        o.fontes.add(fonte);
        if (!o.projs.find((x) => x.id === p.id)) o.projs.push(p);
      };
      projs.forEach((p) => {
        p.dgt.forEach((s) => vincular(s.nome, funcaoAtual(s.funcao), p, "cad"));
        p.ag.forEach(({ i }) =>
          String(i.resp || "")
            .split(/\s*[\/,;]\s*/)
            .filter(ehPessoa)
            .forEach((n) => vincular(n, "", p, "ativ")),
        );
      });
      PMO = { projs, ev, pes: [...pes.values()] };
      pmoAt = Date.now();
    } catch (e) {
      toast("Não foi possível carregar o Painel PMO: " + ((e && e.message) || e));
    }
    pmoBusy = false;
    if (view === "pmo" || view === "minhas") render();
    else renderSide(); // contador de atrasadas em "Minhas atividades"
  }
  /* filtros e nível de detalhe (atividade, pacote ou frente) */
  function pmoEventos() {
    if (!PMO) return [];
    let E = PMO.ev;
    if (PM.proj.length) {
      const P = new Set(PM.proj);
      E = E.filter((e) => P.has(e.pid));
    }
    if (PM.pessoa.length) {
      // "minhas": só as tarefas do subsetor de cada pessoa (PMO: Projetos/PMO; Implantação; Infraestrutura)
      // nas obras em que ela está alocada, além das atribuídas a ela pelo nome;
      // "projetos": todas as atividades das obras em que as pessoas estão alocadas
      const AREAS = { PMO: ["projetos", "pmo"], Implantação: ["implantacao"], Infraestrutura: ["infraestrutura"] };
      const resps = (e) => String(e.resp || "").split(/\s*[\/,;]\s*/).map(normNome);
      const quem = PM.pessoa.map((k) => {
        const p = PMO.pes.find((x) => normNome(x.nome) === k);
        return {
          k,
          areas: AREAS[subsetorDe(p ? p.nome : k)],
          aloc: new Set(PMO.projs.filter((x) => x.dgt.some((d) => normNome(d.nome) === k)).map((x) => x.id)),
          ids: new Set(p ? p.projs.map((x) => x.id) : []),
        };
      });
      E = E.filter((e) => {
        const r = resps(e);
        return quem.some((q) => {
          if (r.includes(q.k)) return true;
          if (PM.escopo === "projetos") return q.aloc.has(e.pid) || (!q.areas && q.ids.has(e.pid));
          if (!q.areas) return q.ids.has(e.pid);
          return q.aloc.has(e.pid) && r.some((x) => q.areas.includes(x));
        });
      });
    }
    if (PM.nivel !== "atividade") {
      const g = new Map();
      E.forEach((e) => {
        const k =
          PM.nivel === "frente"
            ? e.pid + "|f" + e.i.faseNum
            : e.pid + "|f" + e.i.faseNum + "|p" + e.i.pacoteNum;
        if (!g.has(k)) g.set(k, []);
        g.get(k).push(e);
      });
      E = [...g.entries()].map(([k, L]) => {
        const a = L.map((x) => x.a).sort()[0],
          b = L.map((x) => x.b).sort().pop();
        const done = L.every((x) => x.done);
        const f = L[0];
        return {
          id: k,
          pid: f.pid,
          proj: f.proj,
          a,
          b,
          titulo: PM.nivel === "frente" ? f.fase.replace(/^Frente\s*\d+\s*·\s*/, "") : f.pac || f.fase,
          fase: f.fase,
          pac: PM.nivel === "frente" ? "" : f.pac,
          resp: [...new Set(L.map((x) => x.resp).filter(Boolean))].join(", "),
          done,
          late: L.some((x) => x.late),
          n: L.length,
          nDone: L.filter((x) => x.done).length,
          itens: L,
        };
      });
    }
    if (PM.ocultarConc) E = E.filter((e) => !e.done);
    return E;
  }
  const DSEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const MESES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const domDe = (s) => addDays(s, -dt(s).getDay());
  function pmoCur() {
    return PM.cur || todayISO();
  }
  /* nome curto do projeto para o calendário: "11034 Alvorada" */
  function nomeCurto(p) {
    const partes = String(p.nome || "").split(/\s+-\s+/);
    const cidade = (partes[1] || partes[0] || "").toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    return (p.cod ? p.cod + " " : "") + cidade.replace(/ (D[aeo]s?|E) /g, (m) => m.toLowerCase());
  }
  /* uma semana do calendário: cada dia mostra os projetos com atividades naquele dia, como a visão
     de mês do Outlook. Clicar no dia abre as atividades do dia, agrupadas por projeto; clicar num
     projeto abre só as dele. Os projetos aparecem sempre na mesma ordem (código). */
  function semanaHTML(w0, E, mesRef, maxL, detalhe) {
    const w6 = addDays(w0, 6);
    const hoje = todayISO();
    const L = E.filter((e) => e.a <= w6 && e.b >= w0);
    let html = "";
    for (let d = 0; d < 7; d++) {
      const ds = addDays(w0, d);
      const out = mesRef && ds.slice(0, 7) !== mesRef;
      const porProj = new Map();
      (diaUtil(ds) ? L.filter((e) => e.a <= ds && e.b >= ds) : []).forEach((e) => {
        if (!porProj.has(e.pid)) porProj.set(e.pid, { p: e.proj, n: 0, late: 0, done: 0, its: [] });
        const g = porProj.get(e.pid);
        g.n++;
        g.its.push(e);
        if (e.late) g.late++;
        if (e.done) g.done++;
      });
      const G = [...porProj.entries()].sort(
        (a, b) => (+a[1].p.cod || 1e9) - (+b[1].p.cod || 1e9) || COLPT(a[1].p.nome, b[1].p.nome),
      );
      const vis = G.slice(0, maxL);
      const resto = G.length - vis.length;
      const itens = vis
        .map(([pid, g]) => {
          const cls = ["ev", g.done === g.n ? "done" : "", g.late ? "late" : ""].join(" ");
          const tip = `${g.p.nome}\n${g.n} ${g.n === 1 ? "atividade" : "atividades"} no dia${g.late ? ` · ${g.late} atrasada${g.late > 1 ? "s" : ""}` : ""}`;
          const chip = `<button type="button" class="${cls}" style="--c:${g.p.cor}" data-pmdia="${ds}" data-pmdp="${esc(pid)}" title="${esc(tip)}"><b>${esc(nomeCurto(g.p))}</b> <small>${g.n}</small></button>`;
          if (!detalhe) return chip;
          // visão Semana: as atividades do projeto naquele dia, logo abaixo do projeto
          const its = g.its
            .slice()
            .sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0) || COLPT(String(x.titulo), String(y.titulo)))
            .map(
              (e) =>
                `<li><button type="button" class="cda ${e.done ? "done" : ""} ${e.late ? "late" : ""}" style="--c:${g.p.cor}" data-pmev="${esc(e.id)}" title="${esc(`${e.titulo} · ${fmtD(e.a)} – ${fmtD(e.b)}${e.resp ? " · " + e.resp : ""}${e.late ? " · Atrasada" : ""}`)}">${esc(e.titulo)}${e.n ? ` <small>${e.nDone}/${e.n}</small>` : ""}</button></li>`,
            )
            .join("");
          return `<div class="cdp">${chip}<ul>${its}</ul></div>`;
        })
        .join("");
      const naoUtil = !diaUtil(ds) ? `<span class="cdnu">${FERIADOS.has(ds) ? "Feriado" : "Fim de semana"}</span>` : "";
      html += `<div class="cd ${out ? "out" : ""} ${ds === hoje ? "hoje" : ""} ${d === 0 || d === 6 ? "fds" : ""}" data-pmdia="${ds}" title="Ver as atividades do dia"><button type="button" class="cdn" data-pmdia="${ds}">${+ds.slice(8)}${ds.slice(8) === "01" ? " " + MES[+ds.slice(5, 7) - 1] : ""}</button>${naoUtil}<div class="cdl">${itens}</div>${resto > 0 ? `<button type="button" class="evmais" data-pmdia="${ds}">+${resto} ${resto === 1 ? "projeto" : "projetos"}</button>` : ""}</div>`;
    }
    return `<div class="cw">${html}</div>`;
  }
  function calHTML(E) {
    const c = pmoCur();
    if (PM.modo === "agenda") return agendaHTML(E, c);
    const head = `<div class="cwh">${DSEM.map((d) => `<span>${d}</span>`).join("")}</div>`;
    if (PM.modo === "semana") return `<div class="cal sem">${head}${semanaHTML(domDe(c), E, "", 999, true)}</div>`;
    const m0 = c.slice(0, 7) + "-01";
    const [y, m] = m0.split("-").map(Number);
    const ultimo = iso(new Date(y, m, 0));
    let rows = "";
    for (let w = domDe(m0); w <= ultimo; w = addDays(w, 7))
      rows += semanaHTML(w, E, c.slice(0, 7), 4);
    return `<div class="cal">${head}${rows}</div>`;
  }
  function agendaHTML(E, c) {
    const fimP = addDays(c, 29);
    const L = E.filter((e) => e.b >= c && e.a <= fimP);
    const dias = new Map();
    L.forEach((e) => {
      const d = proxUtil(e.a < c ? c : e.a);
      if (!dias.has(d)) dias.set(d, []);
      dias.get(d).push(e);
    });
    const ks = [...dias.keys()].sort();
    if (!ks.length)
      return `<p class="ok-msg">Nenhuma atividade entre ${fmtD(c)} e ${fmtD(fimP)} com os filtros atuais.</p>`;
    return `<div class="agenda">${ks
      .map((d) => {
        const L2 = dias.get(d).sort((x, y) => COLPT(x.proj.nome, y.proj.nome));
        return `<div class="agd"><div class="agdh"><b>${+d.slice(8)}</b><span>${DSEM[dt(d).getDay()]}, ${MES[+d.slice(5, 7) - 1]}</span></div><ul>${L2.map(
          (e) =>
            `<li><button type="button" class="agi ${e.done ? "done" : ""} ${e.late ? "late" : ""}" style="--c:${e.proj.cor}" data-pmev="${esc(e.id)}"><i></i><span class="agt"><b>${esc(e.titulo)}</b><small>${esc(e.proj.nome)}${e.pac && e.pac !== e.titulo ? " · " + esc(e.pac) : ""}</small></span><span class="agp">${e.a < d ? "continua · " : ""}${fmtD(e.a)} – ${fmtD(e.b)}</span></button></li>`,
        ).join("")}</ul></div>`;
      })
      .join("")}</div>`;
  }
  function pmoTitulo() {
    const c = pmoCur();
    if (PM.modo === "semana") {
      const a = domDe(c),
        b = addDays(a, 6);
      return `${+a.slice(8)} ${MES[+a.slice(5, 7) - 1]} – ${+b.slice(8)} ${MES[+b.slice(5, 7) - 1]} ${b.slice(0, 4)}`;
    }
    if (PM.modo === "agenda") return `${fmtD(c)} – ${fmtD(addDays(c, 29))}`;
    const m = MESES[+c.slice(5, 7) - 1];
    return `${m[0].toUpperCase() + m.slice(1)} de ${c.slice(0, 4)}`;
  }
  function renderPmo() {
    const v = $("#view");
    if (!PMO) {
      document.body.classList.add("carregando");
      v.innerHTML = `<div class="loading"><span class="spin"></span>Carregando o Painel PMO…</div>`;
      loadPmo();
      return;
    }
    loadPmo();
    const hdr = `<header class="top cart-top"><div class="title-block"><h1 class="cart-h">Gestão de equipes</h1><p class="subtitle">Posição em ${fmtD(todayISO())} · ${PMO.projs.length} projeto${PMO.projs.length === 1 ? "" : "s"} · ${PMO.ev.length} atividades com data</p></div><button class="btn ghost" data-pmref>Atualizar</button></header>
    <nav class="ctabs"><button class="${PM.tab === "geral" ? "on" : ""}" data-pmtab="geral">Visão geral</button><button class="${PM.tab === "cal" ? "on" : ""}" data-pmtab="cal">Calendário</button><button class="${PM.tab === "stk" ? "on" : ""}" data-pmtab="stk">Stakeholders DGT</button><button class="${PM.tab === "eqc" ? "on" : ""}" data-pmtab="eqc">Equipes de campo</button><button class="${PM.tab === "rota" ? "on" : ""}" data-pmtab="rota">Roteirização</button></nav>`;
    v.innerHTML = hdr + (PM.tab === "geral" ? pmoGeralHTML() : PM.tab === "stk" ? pmoStkHTML() : PM.tab === "eqc" ? pmoEqcHTML() : PM.tab === "rota" ? pmoRotaHTML() : pmoCalHTML());
  }
  function pmoCalHTML() {
    const E = pmoEventos();
    // lista suspensa com várias escolhas (caixas de seleção)
    const msel = (k, opts, lbl, todos) => {
      const S = new Set(PM[k]);
      const txt = !S.size ? todos : S.size === 1 ? (opts.find((o) => o[0] === [...S][0]) || ["", "1 selecionado"])[1] : `${S.size} selecionados`;
      return `<div class="pmf">${lbl}<details class="msel" data-msel="${k}" ${PM.msel === k ? "open" : ""}><summary title="${esc(txt)}">${esc(txt)}</summary><div class="mlist">${
        S.size ? `<button type="button" class="mclr" data-mclr="${k}">Limpar seleção</button>` : ""
      }${opts.map(([v, l]) => `<label><input type="checkbox" data-mv="${k}" value="${esc(v)}" ${S.has(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div></details></div>`;
    };
    const pessoas = equipe()
      .flatMap((e) => e.membros.map((m) => [normNome(m), `${m} · ${e.setor}`]))
      .concat(PMO.pes.filter((p) => p.fontes.has("cad") && !subsetorDe(p.nome)).map((p) => [normNome(p.nome), p.nome]));
    const sel = (k, opts, lbl) =>
      `<label class="pmf">${lbl}<select data-pmf="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${PM[k] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
    const bar = `<div class="pmbar">
      <div class="pmnav"><button class="btn" data-pmnav="hoje">Hoje</button><button class="btn ghost ico2" data-pmnav="-1" aria-label="Anterior">‹</button><button class="btn ghost ico2" data-pmnav="1" aria-label="Próximo">›</button><h2>${esc(pmoTitulo())}</h2></div>
      <div class="seg">${[
        ["mes", "Mês"],
        ["semana", "Semana"],
        ["agenda", "Agenda"],
      ]
        .map(([k, l]) => `<button class="${PM.modo === k ? "on" : ""}" data-pmmodo="${k}">${l}</button>`)
        .join("")}</div></div>
    <div class="pmbar pmfil">
      ${msel("proj", PMO.projs.map((p) => [p.id, p.nome]), "Projeto", "Todos os projetos")}
      ${msel("pessoa", pessoas, "Stakeholder DGT", "Todos")}
      ${PM.pessoa.length ? `<div class="pmf">Mostrar<div class="seg pmesc"><button class="${PM.escopo !== "projetos" ? "on" : ""}" data-pmesc="minhas" title="Só as tarefas do subsetor da pessoa nas obras em que está alocada">${PM.pessoa.length > 1 ? "Tarefas deles" : "Minhas tarefas"}</button><button class="${PM.escopo === "projetos" ? "on" : ""}" data-pmesc="projetos" title="Todas as atividades das obras em que a pessoa está alocada">Todas dos projetos</button></div></div>` : ""}
      ${sel("nivel", [
        ["frente", "Etapas"],
        ["pacote", "Pacotes"],
        ["atividade", "Atividades"],
      ], "Detalhe")}
      <label class="pmchk"><input type="checkbox" data-pmf="ocultarConc" ${PM.ocultarConc ? "checked" : ""}> Ocultar concluídas</label>
    </div>`;
    const hoje = todayISO();
    const ab = E.filter((e) => !e.done);
    const k7 = ab.filter((e) => e.a <= addDays(hoje, 7) && e.b >= hoje).length;
    const kp = (a, l, cl) => `<div class="kpi"><div class="v ${cl || ""}">${a}</div><div class="l">${l}</div></div>`;
    const kpis = `<div class="kpis">${kp(ab.filter((e) => e.a <= hoje && e.b >= hoje).length, "Em execução hoje")}${kp(k7, "Ativas nos próximos 7 dias")}${kp(ab.filter((e) => e.late).length, "Atrasadas (fim planejado vencido)", "bad")}${kp(new Set(ab.map((e) => e.pid)).size, "Projetos com atividades em aberto")}</div>`;
    return kpis + `<section class="panel">${bar}${calHTML(E)}</section>`;
  }
  function pmoStkHTML() {
    // obras com a cor da situação na carteira (em atraso, atraso administrativo, atenção, no prazo)
    if (!CART && !cartBusy) loadCarteira().then(() => view === "pmo" && PM.tab === "stk" && render());
    const sitDe = (id) => (CART ? (CART.find((x) => x.id === id) || {}).cat : "") || "";
    const corSit = (x) => CAT_COR[sitDe(x.id)] || "var(--muted)";
    const legSit = `<span class="eqleg">${Object.entries(CAT_NOME).map(([k, l]) => `<span><i style="--c:${CAT_COR[k]}"></i>${l}</span>`).join("")}</span>`;
    const P = PMO.pes.slice().sort((a, b) => b.projs.length - a.projs.length || COLPT(a.nome, b.nome));
    const comPessoa = new Set(PMO.pes.flatMap((p) => p.projs.map((x) => x.id)));
    const sem = PMO.projs.filter((p) => !comPessoa.has(p.id));
    const ativos = (p) => p.projs.filter((x) => !x.conc).length;
    const mx = Math.max(1, ...P.map((p) => p.projs.length));
    const kp = (a, l, cl) => `<div class="kpi"><div class="v ${cl || ""}">${a}</div><div class="l">${l}</div></div>`;
    const kpis = `<div class="kpis">${kp(P.length, "Stakeholders DGT cadastrados")}${kp(PMO.projs.length - sem.length, "Projetos com stakeholder DGT")}${kp(sem.length, "Projetos sem stakeholder DGT", sem.length ? "bad" : "")}${kp(P.length ? (P.reduce((s, p) => s + p.projs.length, 0) / P.length).toFixed(1).replace(".", ",") : "–", "Projetos por pessoa (média)")}</div>`;
    const fonte = (p) =>
      [p.fontes.has("cad") ? "cadastro de stakeholders" : "", p.fontes.has("ativ") ? "responsável em atividades" : ""]
        .filter(Boolean)
        .join(" e ");
    const rows = P.map(
      (p) => `<tr class="child"><td><b>${esc(p.nome)}</b><span class="sub">${esc([subsetorDe(p.nome), ...p.funcoes].filter(Boolean).join(" · ") || fonte(p))}</span></td>
      <td><span class="stkbar"><i style="width:${(p.projs.length / mx) * 100}%"></i></span><b class="stkn">${p.projs.length}</b></td><td class="dts" style="text-align:right">${ativos(p)}</td>
      <td><div class="stkp">${p.projs.map((x) => `<button class="lg ${x.conc || sitDe(x.id) === "concl" ? "conc" : ""}" style="--c:${corSit(x)}" data-pmabrir="${esc(x.id)}" title="${esc(x.nome)}${CAT_NOME[sitDe(x.id)] ? " · " + CAT_NOME[sitDe(x.id)] : x.conc || sitDe(x.id) === "concl" ? " · concluído" : ""}"><i></i>${esc(x.cod || x.nome)}</button>`).join("")}</div></td>
      <td><button class="btn ghost" data-pmver="${esc(normNome(p.nome))}">Ver no calendário</button></td></tr>`,
    ).join("");
    const tbl = `<section class="panel"><div class="panel-h"><h2>Projetos por stakeholder da DGT</h2><span class="note">Pessoas cadastradas em Stakeholders › DGT Tecnologia de cada projeto e nomes atribuídos como responsáveis nas atividades</span></div>${
      P.length
        ? `<div class="tw"><table class="crono ftb"><colgroup><col style="width:26%"><col style="width:22%"><col style="width:80px"><col><col style="width:150px"></colgroup><thead><tr><th>Stakeholder</th><th>Projetos vinculados</th><th style="text-align:right">Em aberto</th><th>Projetos</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<p class="ok-msg">Nenhum stakeholder da DGT cadastrado. Cadastre em cada projeto: Painel › Stakeholders › Editar.</p>`
    }</section>`;
    const semT = sem.length
      ? `<section class="panel"><div class="panel-h"><h2>Projetos sem stakeholder DGT</h2><span class="note">Clique para abrir o projeto e cadastrar em Stakeholders › Editar</span></div><div class="stkp">${sem.map((x) => `<button class="lg" style="--c:${corSit(x)}" data-pmabrir="${esc(x.id)}"><i></i>${esc(x.nome)}</button>`).join("")}</div></section>`
      : "";
    // carga por área responsável (atividades em aberto)
    const hoje = todayISO();
    const ar = new Map();
    PMO.ev
      .filter((e) => !e.done && e.resp && !ehPessoa(e.resp))
      .forEach((e) => {
        if (!ar.has(e.resp)) ar.set(e.resp, { n: 0, late: 0, p: new Set(), prox: 0 });
        const o = ar.get(e.resp);
        o.n++;
        if (e.late) o.late++;
        if (e.a <= addDays(hoje, 30)) o.prox++;
        o.p.add(e.pid);
      });
    const AR = [...ar.entries()].sort((a, b) => b[1].n - a[1].n);
    const arT = AR.length
      ? `<section class="panel"><div class="panel-h"><h2>Carga por área responsável</h2><span class="note">Atividades em aberto dos cronogramas, pelo campo Responsável</span></div><div class="tw"><table class="crono ftb"><thead><tr><th>Área</th><th style="text-align:right">Projetos</th><th style="text-align:right">Em aberto</th><th style="text-align:right">Início até 30 dias</th><th style="text-align:right">Atrasadas</th></tr></thead><tbody>${AR.map(([k, o]) => `<tr class="child"><td><b>${esc(k)}</b></td><td class="dts" style="text-align:right">${o.p.size}</td><td class="dts" style="text-align:right">${o.n}</td><td class="dts" style="text-align:right">${o.prox}</td><td class="dts" style="text-align:right;color:${o.late ? "var(--alert)" : "inherit"}">${o.late}</td></tr>`).join("")}</tbody></table></div></section>`
      : "";
    const eqT = `<section class="panel"><div class="panel-h"><h2>Equipe do setor</h2><span class="note">Pessoas, subsetor e obras em que estão alocadas (Stakeholders › DGT Tecnologia de cada projeto)</span><button class="btn" data-eqedit>Gerenciar equipe</button></div><div class="eqlegw"><span class="mut">Cor da obra = situação na carteira:</span>${legSit}</div><div class="eqg">${equipe().map((e) => {
      const o = ar.get(e.area);
      const carga = o
        ? `<div class="eqk"><span><b>${o.n}</b> em aberto</span><span><b>${o.p.size}</b> projetos</span><span><b>${o.prox}</b> início até 30 dias</span><span class="${o.late ? "bad" : ""}"><b>${o.late}</b> atrasadas</span></div>`
        : `<div class="eqk"><span>Sem atividades em aberto atribuídas a “${esc(e.area)}”</span></div>`;
      const pessoas = e.membros
        .map((m) => {
          // só o cadastro de stakeholders do projeto conta (responsável em atividade não aloca a pessoa)
          const pj = PMO.projs.filter((x) => x.dgt.some((d) => normNome(d.nome) === normNome(m)));
          return `<li><div class="eqn"><b>${esc(m)}</b><span>${pj.length ? `${pj.length} ${pj.length === 1 ? "obra alocada" : "obras alocadas"}` : "sem obras alocadas"}</span>${pj.length ? `<button class="btn ghost" data-pmver="${esc(normNome(m))}" title="Ver no calendário">Calendário</button>` : ""}</div>${pj.length ? `<div class="stkp">${pj.map((x) => `<button class="lg ${x.conc || sitDe(x.id) === "concl" ? "conc" : ""}" style="--c:${corSit(x)}" data-pmabrir="${esc(x.id)}" title="${esc(x.nome + (CAT_NOME[sitDe(x.id)] ? " · " + CAT_NOME[sitDe(x.id)] : sitDe(x.id) === "concl" ? " · Concluído" : ""))}"><i></i>${esc(x.cod || x.nome)}</button>`).join("")}</div>` : ""}</li>`;
        })
        .join("");
      return `<div class="eqc"><h3>${esc(e.setor)}</h3><p class="mut">${esc(e.desc)}</p>${carga}<ul>${pessoas || `<li class="mut">Ninguém cadastrado neste subsetor.</li>`}</ul></div>`;
    }).join("")}</div></section>`;
    return kpis + eqT + tbl + semT + arT;
  }
  /* cadastro da equipe: pessoa, subsetor e obras (grava em config/equipe e nos stakeholders DGT de cada projeto) */
  function eqLinhaHTML(m) {
    const tem = (p) => p.dgt.some((d) => normNome(d.nome) === normNome(m.nome));
    return `<div class="eqrow" data-orig="${esc(m.nome)}"><div class="eqrh"><input data-eq="nome" value="${esc(m.nome)}" placeholder="Nome" aria-label="Nome"><select data-eq="sub" aria-label="Subsetor">${EQUIPE.map((e) => `<option ${e.setor === m.subsetor ? "selected" : ""}>${esc(e.setor)}</option>`).join("")}</select><button type="button" class="ico rm" data-eqrm title="Remover pessoa" aria-label="Remover pessoa"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
      <div class="eqobras">${PMO.projs.map((p) => `<label class="eqob" title="${esc(p.nome)}"><input type="checkbox" value="${esc(p.id)}" ${m.nome && tem(p) ? "checked" : ""}><span>${esc(p.cod || p.nome)}</span></label>`).join("")}</div></div>`;
  }
  function openEquipesCampo() {
    const f = $("#formPmo");
    const linha = (t) => `<div class="eqcrow"><input data-eqc-nome value="${esc(t)}" placeholder="Nome da equipe" aria-label="Equipe"><button type="button" class="ico rm" data-eqcrm title="Remover equipe" aria-label="Remover equipe"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
    f.innerHTML = `<h3>Equipes de campo · Implantação</h3><p class="hint">Equipes que o supervisor de implantação programa nas obras. Uma equipe pode ter mais de uma pessoa, ex.: “Fábio Lauxen / Carlos Fleck”. Renomear uma equipe não altera as programações já feitas.</p>
      <div id="eqcLista">${equipesCampo().map(linha).join("")}</div>
      <button type="button" class="btn ghost" data-eqcadd>+ Adicionar equipe</button>
      <label class="eqcap">Capacidade: pontos por técnico por dia<input type="number" min="1" step="1" data-eqcap value="${AG_CAP}"></label><p class="hint">Acima disso, o dia aparece com excesso de alocação na agenda.</p>
      <div class="actions"><button type="button" class="btn" data-pmclose>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>`;
    f.onchange = f.oninput = null;
    f.onclick = (e) => {
      if (e.target.closest("[data-eqcadd]")) {
        $("#eqcLista").insertAdjacentHTML("beforeend", linha(""));
        $("#eqcLista").lastElementChild.querySelector("input").focus();
      } else if (e.target.closest("[data-eqcrm]")) e.target.closest(".eqcrow").remove();
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const campo = [...new Set([...f.querySelectorAll(".eqcrow input")].map((x) => x.value.trim().replace(/\s+/g, " ")).filter(Boolean))];
      try {
        const cap = Math.max(1, Math.round(+f.querySelector("[data-eqcap]").value || AG_CAP));
        await db.doc("config/equipe").set({ membros: equipe().flatMap((x) => x.membros.map((nome) => ({ nome, subsetor: x.setor }))), equipesCampo: campo, capDia: cap });
        EQC = campo;
        AG_CAP = cap;
        $("#dlgPmo").close();
        toast("Equipes de campo salvas.");
        render();
      } catch (err) {
        toast("Não foi possível salvar: " + ((err && err.message) || err));
      }
    };
    if (!$("#dlgPmo").open) $("#dlgPmo").showModal();
  }
  function openEquipe() {
    const M = equipe().flatMap((e) => e.membros.map((nome) => ({ nome, subsetor: e.setor })));
    const f = $("#formPmo");
    f.innerHTML = `<h3>Equipe do setor</h3><p class="hint">Cadastre as pessoas, escolha o subsetor e marque as obras em que estão alocadas. As obras marcadas entram em Stakeholders › DGT Tecnologia do projeto, com a função do subsetor; desmarcar a obra ou remover a pessoa tira ela do projeto.</p>
      <div id="eqLista">${M.map(eqLinhaHTML).join("")}</div>
      <button type="button" class="btn ghost" data-eqadd>+ Adicionar pessoa</button>
      <div class="actions"><button type="button" class="btn" data-pmclose>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>`;
    f.onclick = (e) => {
      if (e.target.closest("[data-eqcadd]")) {
        $("#eqcLista").insertAdjacentHTML("beforeend", `<div class="eqcrow" data-orig=""><input data-eqc-nome placeholder="Nome da equipe" aria-label="Equipe"><button type="button" class="ico rm" data-eqcrm title="Remover equipe" aria-label="Remover equipe">×</button></div>`);
        $("#eqcLista").lastElementChild.querySelector("input").focus();
      } else if (e.target.closest("[data-eqcrm]")) e.target.closest(".eqcrow").remove();
      else if (e.target.closest("[data-eqadd]")) {
        $("#eqLista").insertAdjacentHTML("beforeend", eqLinhaHTML({ nome: "", subsetor: "PMO" }));
        $("#eqLista").lastElementChild.querySelector("input").focus();
      } else if (e.target.closest("[data-eqrm]")) e.target.closest(".eqrow").remove();
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const rows = [...f.querySelectorAll(".eqrow")]
        .map((r) => ({
          orig: r.dataset.orig || "",
          nome: r.querySelector('[data-eq="nome"]').value.trim().replace(/\s+/g, " "),
          sub: r.querySelector('[data-eq="sub"]').value,
          projs: new Set([...r.querySelectorAll(".eqob input:checked")].map((x) => x.value)),
        }))
        .filter((r) => r.nome);
      const nomes = rows.map((r) => normNome(r.nome));
      if (new Set(nomes).size !== nomes.length) return toast("Há pessoas com o mesmo nome na lista.");
      const removidos = M.map((m) => normNome(m.nome)).filter((n) => !rows.some((r) => normNome(r.orig) === n || normNome(r.nome) === n));
      const funcoes = new Set(Object.values(FUNCAO_SUB).concat(["Analista do projeto"]).map(normNome));
      try {
        await db.doc("config/equipe").set({ membros: rows.map((r) => ({ nome: r.nome, subsetor: r.sub })), equipesCampo: equipesCampo(), capDia: AG_CAP });
        EQ = rows.map((r) => ({ nome: r.nome, subsetor: r.sub }));
        for (const p of PMO.projs) {
          let dgt = p.dgt.map((d) => Object.assign({}, d));
          const antes = JSON.stringify(dgt);
          dgt = dgt.filter((d) => !removidos.includes(normNome(d.nome)));
          rows.forEach((r) => {
            const ks = [normNome(r.orig), normNome(r.nome)].filter(Boolean);
            const k = dgt.findIndex((d) => ks.includes(normNome(d.nome)));
            if (r.projs.has(p.id)) {
              if (k < 0) dgt.push({ funcao: FUNCAO_SUB[r.sub], nome: r.nome, contato: "", email: "", telefone: "" });
              else {
                dgt[k].nome = r.nome;
                if (!dgt[k].funcao || funcoes.has(normNome(dgt[k].funcao))) dgt[k].funcao = FUNCAO_SUB[r.sub];
              }
            } else if (k >= 0) dgt.splice(k, 1);
          });
          if (JSON.stringify(dgt) === antes) continue;
          await db.doc((p.id === "main" ? "" : `projetos/${p.id}/`) + "config/stakeholders").update({ dgt });
          p.dgt = dgt;
        }
        $("#dlgPmo").close();
        toast("Equipe salva.");
        loadPmo(true);
        render();
      } catch (err) {
        toast("Não foi possível salvar a equipe: " + ((err && err.message) || err));
      }
    };
    if (!$("#dlgPmo").open) $("#dlgPmo").showModal();
  }
  /* ---------- Equipes de campo (Implantação): programação do supervisor ----------
     Cada programação é gravada por dia: uma ocorrência por técnico e dia na coleção "agendaCampo" do
     banco compartilhado. As ocorrências criadas juntas (um período) têm a mesma "serie", cuja regra
     original fica em "agendaSerie": alterar um dia mexe só nele; "este dia e os próximos" e "todo o
     período" levam a mudança às irmãs. Nada é apagado: cancelar e excluir marcam o registro, e o
     histórico (hist) guarda quem fez, quando e o que mudou. Programações antigas com data e "até"
     continuam valendo como um bloco de vários dias. */
  let AGC = [];
  let AG_CAP = 4; // pontos por técnico num dia antes de acusar excesso (config/equipe → capDia)
  const AGP = { id: "", modo: "" }; // painel lateral aberto e o formulário dentro dele
  const AGSEL = new Set(); // seleção da visualização em lista
  let AGC_S = new Map(); // regras originais das séries (agendaSerie)
  function ouvirAgenda() {
    db.collection("agendaSerie").onSnapshot((s) => {
      AGC_S = new Map(s.docs.map((d) => [d.id, d.data()]));
    });
    db.collection("agendaCampo").onSnapshot((s) => {
      AGC = s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
      if (view === "minhas" || (view === "pmo" && PM.tab === "geral")) {
        if (!$("#dlgPmo").open && !$("#dlgAg").open) render();
        return;
      }
      if (view !== "pmo" || PM.tab !== "eqc") return;
      if ($("#dlgAg").open) agPainel(AGP.id, true);
      const dia = $("#formPmo [data-diaref]");
      if ($("#dlgPmo").open && dia) agDiaDlg(dia.dataset.diaref);
      if (!$("#dlgPmo").open) render();
    });
  }
  const AG_ST = {
    planejada: ["Planejada", "n"],
    programada: ["Programada", "p"],
    andamento: ["Em andamento", "a"],
    concluida: ["Concluída", "c"],
    parcial: ["Concluída parcialmente", "y"],
    cancelada: ["Cancelada", "x"],
    bloqueada: ["Bloqueada", "r"],
  };
  const AG_MOT = ["Indisponibilidade do técnico", "Impedimento de acesso ao local", "Indisponibilidade de materiais", "Condições climáticas", "Solicitação do cliente", "Reprogramação operacional", "Outros"];
  // "prog" e "feito" são as situações das versões anteriores
  const agSt = (a) => (a.status === "feito" ? "concluida" : AG_ST[a.status] ? a.status : "programada");
  const agFim = (a) => (a.dataFim && a.dataFim >= a.data ? a.dataFim : a.data);
  const agAtivo = (a) => !a.excluida && agSt(a) !== "cancelada";
  const agFeito = (a) => agSt(a) === "concluida" || agSt(a) === "parcial";
  const agFechado = (a) => agFeito(a) || agSt(a) === "cancelada";
  const agChip = (a) => `<span class="agst s-${AG_ST[agSt(a)][1]}">${AG_ST[agSt(a)][0]}</span>`;
  const agPids = (a) => (Array.isArray(a.pids) && a.pids.length ? a.pids : a.pid ? [a.pid] : []);
  const projDe = (pid) => (PMO ? PMO.projs.find((p) => p.id === pid) : null);
  const agProj = (a) => projDe(agPids(a)[0]);
  const agNomeProj = (a) => {
    const L = agPids(a).map(projDe).filter(Boolean);
    return L.length > 1 ? L.map(nomeCurto).join(" + ") : L[0] ? L[0].nome : a.projNome || "";
  };
  const agProjCurto = (a) => {
    const L = agPids(a).map(projDe).filter(Boolean);
    return L.length ? L.map(nomeCurto).join(" + ") : a.projNome || "";
  };
  const ptPid = (a, x) => x.pid || a.pid;
  const ptK = (a, x) => ptPid(a, x) + "|" + x.pn;
  const ptCanc = (x) => (x.ativ || []).length > 0 && x.ativ.every((t) => t.canc);
  const byData = (x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0);
  const p1s = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  /* pontos previstos (sem os cancelados), executados e pendentes de uma programação */
  function agNums(a) {
    const P = a.pontos || [];
    const st = agSt(a);
    const plan = st === "cancelada" ? 0 : P.length ? P.filter((x) => !ptCanc(x)).length : (a.locais || []).length || +a.qtd || 0;
    const feitos = new Set(a.ptsExec || []);
    const exec = st === "concluida" ? (a.exec != null && a.exec !== "" ? +a.exec : plan) : st === "parcial" ? +a.exec || 0 : st === "cancelada" ? 0 : P.filter((x) => !ptCanc(x) && feitos.has(ptK(a, x))).length;
    return { plan, exec, pend: agFeito(a) ? Math.max(0, plan - exec) : 0 };
  }
  // pontos por dia (programações antigas de vários dias dividem os pontos pelos dias úteis)
  const agPtsDia = (a) => {
    const n = agNums(a).plan;
    return a.dataFim && a.dataFim > a.data ? Math.ceil(n / Math.max(1, diasUteis(a.data, a.dataFim))) : n;
  };
  const agAtivTxt = (a) => {
    const T = [...new Set((a.pontos || []).flatMap((x) => (x.ativ || []).filter((t) => !t.canc).map((t) => t.titulo)))];
    return T.length ? T.slice(0, 3).join(", ") + (T.length > 3 ? ` +${T.length - 3}` : "") : a.obs || "";
  };
  /* quem está usando: o nome vai para o histórico de cada alteração (guardado só neste navegador) */
  const UKEY = "pmo-hibrido-usuario";
  let agUser = (() => {
    try {
      return localStorage.getItem(UKEY) || "";
    } catch (e) {
      return "";
    }
  })();
  function agQuem(trocar) {
    const su = window.SESSAO && window.SESSAO.usuario;
    if (su) return Promise.resolve((agUser = su.nome));
    if (agUser && !trocar) return Promise.resolve(agUser);
    return new Promise((res) => {
      const d = $("#dlgConfirm"),
        f = $("#formConfirm");
      const nomes = equipe().flatMap((e) => e.membros);
      f.innerHTML = `<h3>Quem está programando?</h3><p class="hint">O nome fica registrado no histórico de cada alteração da agenda (quem e quando). Fica guardado só neste navegador.</p><label>Seu nome<input id="agUserIn" list="agUserL" autocomplete="name" value="${esc(agUser)}"></label><datalist id="agUserL">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist><div class="actions"><button type="button" class="btn" id="cfNo">Cancelar</button><button type="button" class="btn primary" id="cfYes">Continuar</button></div>`;
      let done = false;
      const fin = (v) => {
        if (done) return;
        done = true;
        if (d.open) d.close();
        res(v);
      };
      $("#cfNo").onclick = () => fin(trocar ? agUser : "");
      $("#cfYes").onclick = () => {
        const v = $("#agUserIn").value.trim().replace(/\s+/g, " ");
        if (!v) return $("#agUserIn").focus();
        agUser = v;
        try {
          localStorage.setItem(UKEY, v);
        } catch (e) {}
        fin(v);
      };
      f.onsubmit = (e) => {
        e.preventDefault();
        $("#cfYes").click();
      };
      d.oncancel = () => fin(trocar ? agUser : "");
      d.showModal();
      $("#agUserIn").focus();
    });
  }
  const agAgora = () => new Date().toISOString();
  const horaAgora = () => {
    const d = new Date();
    return p2(d.getHours()) + ":" + p2(d.getMinutes());
  };
  const fmtDH = (s) => {
    const d = new Date(s);
    return isNaN(d) ? "" : `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
  };
  const AG_ROT = { locais: "Pontos (fora do painel)", projNome: "Projeto", equipe: "Técnico", data: "Data", dataFim: "Até", hIni: "Início", hFim: "Término", obs: "Observação", qtd: "Pontos previstos", status: "Situação", pontos: "Pontos", pids: "Projeto" };
  const agVal = (k, v) =>
    k === "locais" ? (v || []).map((x) => x.nome || x.end).join(", ").slice(0, 160) || "—" : k === "data" || k === "dataFim" ? (v ? fmtD(v) : "—") : k === "status" ? (AG_ST[v] ? AG_ST[v][0] : v || "—") : k === "pontos" ? (v || []).map((x) => x.nome + ((x.ativ || []).some((t) => t.canc) ? " (com cancelamento)" : "")).join(", ").slice(0, 160) || "—" : k === "pids" ? (v || []).map((x) => (projDe(x) || {}).nome || x).join(" + ") : v === "" || v == null ? "—" : String(v);
  /* o campo mudou? (vazio, nulo e zero são iguais; pontos comparam ponto, atividades e cancelamentos) */
  const agSig = (o, k) =>
    k === "pontos"
      ? (o.pontos || []).map((x) => ptK(o, x) + ":" + (x.ativ || []).map((t) => t.id + (t.canc ? "x" : "")).join(",")).join(";")
      : k === "pids"
        ? agPids(o).join(",")
        : o[k] == null || o[k] === 0 ? "" : JSON.stringify(o[k]);
  const agDifere = (a, b, k) => agSig(a, k) !== agSig(b, k);
  /* novos campos de uma ocorrência, com o que mudou (de → para) no histórico */
  function agMudar(a, campos, acao, txt) {
    const dif = Object.keys(campos)
      .filter((k) => AG_ROT[k] && agDifere(a, Object.assign({}, a, campos), k))
      .map((k) => `${AG_ROT[k]}: ${agVal(k, a[k])} → ${agVal(k, campos[k])}`);
    const n = Object.assign({}, a, campos, { atualizado: agAgora(), por: agUser });
    // quem estava programado originalmente continua registrado
    if (campos.equipe && a.equipe && campos.equipe !== a.equipe && !a.equipeOrig) n.equipeOrig = a.equipe;
    n.hist = (a.hist || []).concat({ em: agAgora(), por: agUser, acao, txt: txt != null ? txt : dif.join("; ") }).slice(-200);
    delete n.id;
    return { id: a.id, data: n, mudou: txt != null || dif.length > 0 };
  }
  /* grava de uma vez (lote atômico no servidor): se o servidor recusar, nada muda */
  async function agGravar(L) {
    if (!L.length) return true;
    try {
      if (db.batch) {
        const b = db.batch();
        L.forEach((x) => b.set(db.doc((x.coll || "agendaCampo") + "/" + x.id), x.data));
        await b.commit();
      } else for (const x of L) await db.doc((x.coll || "agendaCampo") + "/" + x.id).set(x.data);
      return true;
    } catch (e) {
      toast("Não foi possível salvar na agenda: " + ((e && e.message) || e) + ". Nada foi alterado.");
      return false;
    }
  }
  /* ---------- disponibilidade e conflitos ---------- */
  const agDoDia = (eq, d, ign, extra) => AGC.concat(extra || []).filter((x) => agAtivo(x) && x.equipe === eq && x.data <= d && agFim(x) >= d && !(ign && x.id && ign.has(x.id)));
  const hMin = (h) => (/^\d\d:\d\d$/.test(h || "") ? +h.slice(0, 2) * 60 + +h.slice(3) : null);
  const sobrepoe = (a, b) => {
    const a0 = hMin(a.hIni),
      a1 = hMin(a.hFim),
      b0 = hMin(b.hIni),
      b1 = hMin(b.hFim);
    return a0 != null && a1 != null && b0 != null && b1 != null && a0 < b1 && b0 < a1;
  };
  // mesma programação = mesmas atividades (ou, sem atividades, mesmo projeto e mesmo horário)
  const agChave = (a) => {
    const ids = (a.pontos || []).flatMap((x) => (x.ativ || []).filter((t) => !t.canc).map((t) => t.id)).sort().join(",");
    return ids || "g:" + (agPids(a).slice().sort().join(",") || normNome(a.projNome)) + "|" + (a.hIni || "");
  };
  /* problemas de um técnico num dia: horários sobrepostos, duplicidade e excesso de pontos */
  function agProbDia(L) {
    const P = [];
    for (let i = 0; i < L.length; i++)
      for (let j = i + 1; j < L.length; j++) {
        if (agChave(L[i]) === agChave(L[j])) P.push("programação duplicada");
        else if (sobrepoe(L[i], L[j])) P.push("horários sobrepostos");
      }
    const pts = L.reduce((s, a) => s + agPtsDia(a), 0);
    if (pts > AG_CAP) P.push(`${pts} pontos (capacidade ${AG_CAP})`);
    return [...new Set(P)];
  }
  /* conflitos de uma programação antes de salvar: erros impedem, alertas pedem confirmação.
     ign = ocorrências que estão sendo alteradas; extra = as outras que vão ser criadas junto */
  function agChecar(c, ign, extra) {
    const erros = [],
      alertas = [];
    const L = agDoDia(c.equipe, c.data, ign, extra);
    const k = agChave(c);
    L.forEach((x) => {
      const nome = `${agProjCurto(x)}${x.hIni ? " " + x.hIni + (x.hFim ? "–" + x.hFim : "") : ""}`;
      if (agChave(x) === k) erros.push(`${c.equipe} já tem esta mesma programação em ${fmtD(c.data)} (${nome}).`);
      else if (sobrepoe(c, x)) alertas.push(`${c.equipe}: horário sobreposto em ${fmtD(c.data)} com ${nome}.`);
    });
    const pts = L.reduce((s, x) => s + agPtsDia(x), 0) + agPtsDia(c);
    if (pts > AG_CAP) alertas.push(`${c.equipe}: ${pts} pontos em ${fmtD(c.data)} (capacidade ${AG_CAP} por dia).`);
    const meus = new Set((c.pontos || []).filter((x) => !ptCanc(x)).map((x) => ptK(c, x)));
    if (meus.size)
      AGC.concat(extra || [])
        .filter((x) => agAtivo(x) && x.equipe !== c.equipe && x.data <= c.data && agFim(x) >= c.data && !(ign && x.id && ign.has(x.id)))
        .forEach((x) => {
          if ((c.junto || []).includes(x.equipe)) return; // técnicos que vão juntos
          const comum = (x.pontos || []).filter((p) => !ptCanc(p) && meus.has(ptK(x, p)));
          if (comum.length) alertas.push(`${comum.map((p) => p.nome).join(", ")} também está com ${x.equipe} em ${fmtD(c.data)}.`);
        });
    if (!diaUtil(c.data)) alertas.push(`${fmtD(c.data)} não é dia útil (${FERIADOS.has(c.data) ? "feriado" : "fim de semana"}).`);
    const livres = equipesCampo().filter((t) => t !== c.equipe && !agDoDia(t, c.data, ign, extra).length);
    if ((erros.length || alertas.length) && livres.length) alertas.push(`Livres em ${fmtD(c.data)}: ${livres.slice(0, 4).join(", ")}${livres.length > 4 ? "…" : ""}.`);
    return { erros, alertas: [...new Set(alertas)], livres };
  }
  /* confere uma lista de ocorrências: devolve false se houver erro ou se o usuário desistir nos alertas */
  async function agConferir(L, ign) {
    const E = [],
      A = [];
    const extra = [];
    L.forEach((c) => {
      const r = agChecar(c, ign, extra);
      extra.push(c);
      E.push(...r.erros);
      A.push(...r.alertas);
    });
    if (E.length) {
      toast(E[0] + (E.length > 1 ? ` (+${E.length - 1})` : ""));
      return false;
    }
    return A.length ? agAlertas([...new Set(A)]) : true;
  }
  function agAlertas(L) {
    return new Promise((res) => {
      const d = $("#dlgConfirm"),
        f = $("#formConfirm");
      f.innerHTML = `<h3>Conflitos de agenda</h3><ul class="agwarnl">${L.slice(0, 12)
        .map((x) => `<li>${esc(x)}</li>`)
        .join("")}${L.length > 12 ? `<li>+${L.length - 12}…</li>` : ""}</ul><p class="hint">Volte para ajustar ou salve assim mesmo: os conflitos continuam marcados na agenda.</p><div class="actions"><button type="button" class="btn" id="cfNo">Voltar e ajustar</button><button type="button" class="btn primary" id="cfYes">Salvar mesmo assim</button></div>`;
      let done = false;
      const fin = (v) => {
        if (done) return;
        done = true;
        if (d.open) d.close();
        res(v);
      };
      $("#cfNo").onclick = () => fin(false);
      $("#cfYes").onclick = () => fin(true);
      d.oncancel = () => fin(false);
      d.showModal();
      $("#cfNo").focus();
    });
  }
  /* disponibilidade de um técnico num intervalo: um quadradinho por dia (livre, ocupado, conflito) */
  function agDispHTML(eq, de, ate, ign) {
    if (!eq || !de) return "";
    if (!ate || ate < de) ate = de;
    const dias = [];
    for (let d = de; d <= ate && dias.length < 31; d = addDays(d, 1)) dias.push(d);
    let nP = 0,
      nPts = 0;
    const cel = dias
      .map((d) => {
        const L = agDoDia(eq, d, ign);
        const pr = agProbDia(L);
        const pts = L.reduce((s, x) => s + agPtsDia(x), 0);
        nP += L.filter((x) => x.data === d || d === de).length;
        nPts += L.filter((x) => x.data === d || d === de).reduce((s, x) => s + agNums(x).plan, 0);
        const cls = pr.length ? "cf" : L.length ? "oc" : !diaUtil(d) ? "nu" : "lv";
        const tt = `${DSEM[dt(d).getDay()]} ${fmtD(d)}: ${L.length ? `${p1s(L.length, "programação", "programações")}, ${p1s(pts, "ponto", "pontos")}${pr.length ? " · " + pr.join(", ") : ""}` : diaUtil(d) ? "livre" : "não útil"}`;
        return `<span class="dsp ${cls}" title="${esc(tt)}"><b>${+d.slice(8)}</b>${L.length ? `<small>${pts}p</small>` : ""}</span>`;
      })
      .join("");
    const pend = AGC.filter((x) => agAtivo(x) && x.equipe === eq && !agFechado(x) && agFim(x) < todayISO()).length;
    return `<div class="agdisp"><div class="agdisph"><i style="--c:${eqCor(eq)}"></i><b>${esc(eq)}</b><small>${p1s(nP, "programação", "programações")} · ${p1s(nPts, "ponto", "pontos")} de ${fmtD(de)} a ${fmtD(ate)}${pend ? ` · <em>${p1s(pend, "pendente", "pendentes")} de conclusão</em>` : ""}</small></div><div class="dspd">${cel}</div></div>`;
  }
  /* pontos do projeto (nº, nome, endereço e se já está concluído) para a programação */
  function pontosProj(pid) {
    const p = PMO && PMO.projs.find((x) => x.id === pid);
    if (!p) return [];
    const m = new Map();
    p.ag.forEach(({ i }) => {
      if (!i.ponto) return;
      const k = +i.pacoteNum;
      if (!m.has(k)) m.set(k, { pn: k, nome: i.pacoteNome || "Ponto " + p2(k), ativ: [] });
      m.get(k).ativ.push({ id: i.id, titulo: String(i.titulo || "").replace(/^(Energia|Link) · /, "$1: "), seq: +i.seq || 0, feito: !!i.fimReal, resp: i.resp || "" });
    });
    const V = p.vist || {};
    return [...m.values()]
      .sort((a, b) => a.pn - b.pn)
      .map((x) => Object.assign(x, { end: (V[x.pn] || {}).end || "", feito: x.ativ.every((t) => t.feito), ativ: x.ativ.sort((a, b) => a.seq - b.seq) }));
  }
  /* ---------- agenda: Mês / Semana / Agenda / Lista ---------- */
  const eqCor = (t) => corProj(Math.max(0, equipesCampo().indexOf(t)));
  const eqCur = () => PM.eqIni || todayISO();
  function eqRange() {
    const c = eqCur();
    const modo = PM.eqModo || "semana";
    if (modo === "semana") return [domDe(c), addDays(domDe(c), 6)];
    if (modo === "agenda") return [c, addDays(c, 29)];
    const m0 = c.slice(0, 7) + "-01";
    const [y, m] = m0.split("-").map(Number);
    const m1 = iso(new Date(y, m, 0));
    if (modo === "lista" && PM.eqDe) return [PM.eqDe, PM.eqAte && PM.eqAte >= PM.eqDe ? PM.eqAte : PM.eqDe];
    return [m0, m1];
  }
  function eqEventos() {
    const T = new Set(PM.eqTec || []);
    const St = new Set(PM.eqSt || []);
    return AGC.filter((a) => !a.excluida && (!PM.proj.length || agPids(a).some((x) => PM.proj.includes(x))) && (!T.size || T.has(a.equipe)) && (!St.size || St.has(agSt(a))))
      .map((a) => {
        const P = a.pontos || [];
        const n = agNums(a);
        return {
          a,
          id: a.id,
          ini: a.data,
          fim: agFim(a),
          equipe: a.equipe,
          st: agSt(a),
          n,
          titulo: `${agNomeProj(a)} · ${P.length === 1 ? P[0].nome : p1s(P.length ? P.length : n.plan, "ponto", "pontos")}`,
          sub: agAtivTxt(a),
          done: agFeito(a),
        };
      })
      .sort((x, y) => (x.ini < y.ini ? -1 : x.ini > y.ini ? 1 : 0) || (x.a.hIni || "99").localeCompare(y.a.hIni || "99") || COLPT(x.equipe, y.equipe));
  }
  /* cartão de uma programação: técnico, horário, projeto, pontos e situação; ✓ finaliza com um clique */
  function agCard(e) {
    const a = e.a;
    const podeFin = !agFechado(a) && e.st !== "bloqueada";
    const h = a.hIni ? `${a.hIni}${a.hFim ? "–" + a.hFim : ""} · ` : "";
    const pts = e.st === "cancelada" ? "" : e.done || e.n.exec ? `${e.n.exec}/${e.n.plan} pts` : p1s(e.n.plan, "pt", "pts");
    const tt = `${e.equipe} · ${agNomeProj(a)} · ${AG_ST[e.st][0]}${e.sub ? " · " + e.sub : ""}${a.equipeOrig ? " · originalmente " + a.equipeOrig : ""}${(a.junto || []).length ? " · junto com " + a.junto.join(", ") : ""} · clique para abrir`;
    return `<div class="agc s-${AG_ST[e.st][1]}" style="--c:${eqCor(e.equipe)}"><button type="button" class="agcb" data-agid="${esc(e.id)}" title="${esc(tt)}"><span class="agc1"><b>${esc(e.equipe)}</b>${(a.junto || []).length ? `<small>+${a.junto.length}</small>` : ""}</span><span class="agc2">${h}${esc(agProjCurto(a))}${pts ? " · " + pts : ""}</span><span class="agc3">${agChip(a)}</span></button>${podeFin ? `<button type="button" class="agq" data-agfin="${esc(e.id)}" title="Finalizar atividade: todos os pontos executados, agora" aria-label="Finalizar ${esc(e.equipe)} em ${fmtD(e.ini)}">✓</button>` : ""}</div>`;
  }
  function eqSemana(w0, E, mesRef, mes) {
    const hoje = todayISO();
    let html = "";
    for (let d = 0; d < 7; d++) {
      const ds = addDays(w0, d);
      const out = mesRef && ds.slice(0, 7) !== mesRef;
      const L = E.filter((e) => e.ini <= ds && e.fim >= ds);
      const T = [...new Set(L.filter((e) => e.st !== "cancelada").map((e) => e.equipe))];
      const prob = T.map((t) => [t, agProbDia(agDoDia(t, ds))]).filter((x) => x[1].length);
      const aviso = prob.length ? `<span class="agcf" title="${esc(prob.map(([t, p]) => t + ": " + p.join(", ")).join(" · "))}">⚠ ${prob.length}</span>` : "";
      let corpo = "";
      if (mes) {
        if (L.length) {
          const at = L.filter((e) => e.st !== "cancelada");
          const pts = at.reduce((s, e) => s + e.n.plan, 0);
          const ok = L.filter((e) => e.done).length,
            cx = L.length - at.length,
            ab = at.length - ok;
          corpo = `<button type="button" class="agm ${prob.length ? "cf" : ""}" data-agdia="${ds}" title="Abrir o dia ${fmtD(ds)}">${at.length ? `<span><b>${T.length}</b> téc · <b>${at.length}</b> prog</span><span>${p1s(pts, "ponto", "pontos")}</span>` : `<span>${p1s(cx, "cancelada", "canceladas")}</span>`}<span class="agmbar">${ok ? `<i class="c" style="flex:${ok}"></i>` : ""}${ab ? `<i class="p" style="flex:${ab}"></i>` : ""}${cx ? `<i class="x" style="flex:${cx}"></i>` : ""}</span></button>`;
        }
      } else corpo = L.map(agCard).join("");
      const naoUtil = !diaUtil(ds) ? `<span class="cdnu">${FERIADOS.has(ds) ? "Feriado" : "Fim de semana"}</span>` : "";
      html += `<div class="cd ${out ? "out" : ""} ${ds === hoje ? "hoje" : ""} ${d === 0 || d === 6 ? "fds" : ""}"><div class="cdh"><button type="button" class="cdn" data-agnovo="|${ds}" title="Programar neste dia">${+ds.slice(8)}${ds.slice(8) === "01" ? " " + MES[+ds.slice(5, 7) - 1] : ""}</button>${aviso}${mes ? "" : `<button type="button" class="cdadd" data-agnovo="|${ds}" title="Programar neste dia" aria-label="Programar em ${fmtD(ds)}">+</button>`}</div>${naoUtil}<div class="cdl">${corpo}</div></div>`;
    }
    return `<div class="cw">${html}</div>`;
  }
  function eqListaHTML(E) {
    [...AGSEL].forEach((id) => {
      if (!E.some((e) => e.id === id)) AGSEL.delete(id);
    });
    const nS = AGSEL.size;
    const T = equipesCampo();
    const todas = E.length && E.every((e) => AGSEL.has(e.id));
    const bar = `<div class="agbat" ${nS ? "" : "hidden"}><b>${p1s(nS, "selecionada", "selecionadas")}</b><button type="button" class="btn" data-agbat="fin">✓ Finalizar</button><label class="pmf agbtec">Trocar técnico<select data-agbattec><option value="">Escolha…</option>${T.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label><button type="button" class="btn danger" data-agbat="canc">Cancelar…</button><button type="button" class="btn danger" data-agbat="excl">Excluir…</button><button type="button" class="btn ghost" data-agbat="limpa">Limpar seleção</button></div>`;
    const rows = E.map((e) => {
      const a = e.a;
      const podeFin = !agFechado(a) && e.st !== "bloqueada";
      return `<tr class="s-${AG_ST[e.st][1]}"><td><input type="checkbox" data-agsel="${esc(e.id)}" ${AGSEL.has(e.id) ? "checked" : ""} aria-label="Selecionar"></td><td class="nw">${DSEM[dt(e.ini).getDay()]} ${fmtD(e.ini)}${e.fim !== e.ini ? " – " + fmtD(e.fim) : ""}${a.hIni ? `<small>${a.hIni}${a.hFim ? "–" + a.hFim : ""}</small>` : ""}</td><td>${esc(agProjCurto(a))}</td><td class="nw"><i class="agdot" style="--c:${eqCor(e.equipe)}"></i>${esc(e.equipe)}${a.equipeOrig ? `<small>orig. ${esc(a.equipeOrig)}</small>` : ""}</td><td class="agle">${esc((a.pontos || []).length === 1 ? a.pontos[0].nome + " · " : "")}${esc(e.sub)}</td><td class="num">${e.st === "cancelada" ? "–" : e.n.plan}</td><td class="num">${e.done || e.n.exec ? e.n.exec : "–"}</td><td>${agChip(a)}</td><td class="agacs">${podeFin ? `<button type="button" class="agq" data-agfin="${esc(e.id)}" title="Finalizar atividade" aria-label="Finalizar">✓</button>` : ""}<button type="button" class="btn ghost" data-agid="${esc(e.id)}">Abrir</button></td></tr>`;
    }).join("");
    return `${bar}<div class="agtw"><table class="agl"><thead><tr><th><input type="checkbox" data-agselall ${todas ? "checked" : ""} aria-label="Selecionar todas"></th><th>Data</th><th>Projeto</th><th>Técnico</th><th>Etapa</th><th class="num">Pontos planejados</th><th class="num">Pontos executados</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${rows || `<tr><td colspan="9" class="mut">Nenhuma programação no período com os filtros atuais.</td></tr>`}</tbody></table></div>`;
  }
  function eqCalHTML(E) {
    const c = eqCur();
    const modo = PM.eqModo || "semana";
    if (modo === "lista") {
      const [de, ate] = eqRange();
      return eqListaHTML(E.filter((e) => e.fim >= de && e.ini <= ate));
    }
    if (modo === "agenda") {
      const fimP = addDays(c, 29);
      const L = E.filter((e) => e.fim >= c && e.ini <= fimP);
      const dias = new Map();
      L.forEach((e) => {
        const d = e.ini < c ? c : e.ini;
        if (!dias.has(d)) dias.set(d, []);
        dias.get(d).push(e);
      });
      const ks = [...dias.keys()].sort();
      if (!ks.length) return `<p class="ok-msg">Nenhuma programação entre ${fmtD(c)} e ${fmtD(fimP)} com os filtros atuais.</p>`;
      return `<div class="agenda">${ks
        .map((d) => `<div class="agd"><div class="agdh"><b>${+d.slice(8)}</b><span>${DSEM[dt(d).getDay()]}, ${MES[+d.slice(5, 7) - 1]}</span></div><ul>${dias
          .get(d)
          .map((e) => `<li><button type="button" class="agi s-${AG_ST[e.st][1]}" style="--c:${eqCor(e.equipe)}" data-agid="${esc(e.id)}"><i></i><span class="agt"><b>${esc(e.equipe)} · ${esc(e.titulo)}</b><small>${esc(e.sub || "")}</small></span><span class="agp">${e.a.hIni ? e.a.hIni + (e.a.hFim ? "–" + e.a.hFim : "") + " · " : ""}${e.fim !== e.ini ? fmtD(e.ini) + " – " + fmtD(e.fim) + " · " : ""}${agChip(e.a)}</span></button></li>`)
          .join("")}</ul></div>`)
        .join("")}</div>`;
    }
    const head = `<div class="cwh">${DSEM.map((d) => `<span>${d}</span>`).join("")}</div>`;
    if (modo === "semana") return `<div class="cal sem agsem">${head}${eqSemana(domDe(c), E, "", false)}</div>`;
    const m0 = c.slice(0, 7) + "-01";
    const [y, m] = m0.split("-").map(Number);
    const ultimo = iso(new Date(y, m, 0));
    let rows = "";
    for (let w = domDe(m0); w <= ultimo; w = addDays(w, 7)) rows += eqSemana(w, E, c.slice(0, 7), true);
    return `<div class="cal agmes">${head}${rows}</div>`;
  }
  /* indicadores do período e dos filtros: programações, técnicos, pontos e atividades não se misturam */
  function agKpis(L, ini, fim) {
    const hoje = todayISO();
    const at = L.filter((e) => e.st !== "cancelada");
    let plan = 0,
      exec = 0,
      base = 0,
      pendA = 0,
      cancA = 0;
    L.forEach((e) => {
      const a = e.a;
      const A = (a.pontos || []).flatMap((x) => x.ativ || []);
      if (e.st === "cancelada") {
        cancA += A.length || 1;
        return;
      }
      cancA += A.filter((t) => t.canc).length;
      plan += e.n.plan;
      exec += e.n.exec;
      if (e.done || e.fim < hoje) base += e.n.plan;
      if (e.st === "parcial") {
        const ok = new Set(a.ptsExec || []);
        const P = (a.pontos || []).filter((x) => !ptCanc(x) && !ok.has(ptK(a, x)));
        pendA += P.reduce((s, x) => s + (x.ativ || []).filter((t) => !t.canc).length, 0) || (e.n.pend || a.pendTxt ? 1 : 0);
      } else if (!e.done && e.fim < hoje) pendA += A.filter((t) => !t.canc).length || 1;
    });
    let nCf = 0;
    const T = [...new Set(at.map((e) => e.equipe))];
    for (let d = ini, k = 0; d <= fim && k < 92; d = addDays(d, 1), k++) T.forEach((t) => agProbDia(agDoDia(t, d)).length && nCf++);
    const pct = base ? Math.round((exec / base) * 100) : null;
    const kp = (v, l, cls, tt) => `<div class="kpi" ${tt ? `title="${esc(tt)}"` : ""}><div class="v ${cls || ""}">${v}</div><div class="l">${l}</div></div>`;
    return `<div class="kpis agkpis">${kp(L.length, "Programações no período", "", "Uma programação = um técnico num dia")}${kp(T.length, "Técnicos alocados", "", "Técnicos distintos com programação ativa")}${kp(plan, "Pontos planejados", "", "Pontos das programações ativas (sem os cancelados)")}${kp(exec, "Pontos executados", exec ? "good" : "")}${kp(pendA, "Atividades pendentes", pendA ? "warn" : "", "Atividades de programações vencidas e não finalizadas, e das não executadas nas parciais")}${kp(cancA, "Atividades canceladas")}${kp(pct == null ? "–" : pct + "%", "Execução", pct != null && pct < 80 ? "warn" : pct != null ? "good" : "", "Pontos executados ÷ pontos planejados das programações vencidas ou finalizadas")}${kp(nCf, "Conflitos de alocação", nCf ? "bad" : "", "Técnico × dia com horários sobrepostos, duplicidade ou mais pontos que a capacidade")}</div>`;
  }
  function pmoEqcHTML() {
    const E = eqEventos();
    const [ini, fim] = eqRange();
    const modo = PM.eqModo || "semana";
    const titulo =
      modo === "semana"
        ? `${+ini.slice(8)} ${MES[+ini.slice(5, 7) - 1]} – ${+fim.slice(8)} ${MES[+fim.slice(5, 7) - 1]} ${fim.slice(0, 4)}`
        : modo === "agenda" || modo === "lista"
          ? `${fmtD(ini)} – ${fmtD(fim)}`
          : (() => {
              const t = MESES[+ini.slice(5, 7) - 1];
              return `${t[0].toUpperCase() + t.slice(1)} de ${ini.slice(0, 4)}`;
            })();
    const msel = (k, opts, lbl, todos) => {
      const S = new Set(PM[k] || []);
      const txt = !S.size ? todos : S.size === 1 ? (opts.find((o) => o[0] === [...S][0]) || ["", "1"])[1] : `${S.size} selecionados`;
      return `<div class="pmf">${lbl}<details class="msel" data-msel="${k}" ${PM.msel === k ? "open" : ""}><summary>${esc(txt)}</summary><div class="mlist">${S.size ? `<button type="button" class="mclr" data-mclr="${k}">Limpar seleção</button>` : ""}${opts.map(([v, l]) => `<label><input type="checkbox" data-mv="${k}" value="${esc(v)}" ${S.has(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div></details></div>`;
    };
    const noPer = E.filter((e) => e.ini <= fim && e.fim >= ini);
    const per = modo === "lista" ? `<label class="pmf">De<input type="date" data-eqper="de" value="${ini}"></label><label class="pmf">Até<input type="date" data-eqper="ate" value="${fim}"></label>` : "";
    return `${agKpis(noPer, ini, fim)}<section class="panel"><div class="pmbar">
      <div class="pmnav"><button class="btn" data-eqnav="hoje">Hoje</button><button class="btn ghost ico2" data-eqnav="-1" aria-label="Anterior">‹</button><button class="btn ghost ico2" data-eqnav="1" aria-label="Próximo">›</button><h2>${esc(titulo)}</h2></div>
      <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary agprog" data-agnovo="">+ Programar</button><button class="btn" data-agexp>Exportar agenda</button><button class="btn" data-eqedit="campo">Gerenciar equipes</button><div class="seg">${[["mes", "Mês"], ["semana", "Semana"], ["agenda", "Agenda"], ["lista", "Lista"]].map(([k, l]) => `<button class="${modo === k ? "on" : ""}" data-eqmodo="${k}">${l}</button>`).join("")}</div></span></div>
      <div class="pmbar pmfil">${msel("proj", PMO.projs.map((p) => [p.id, p.nome]), "Projeto", "Todos os projetos")}${msel("eqTec", equipesCampo().map((t) => [t, t]), "Técnico / equipe", "Todos")}${msel("eqSt", Object.entries(AG_ST).map(([k, v]) => [k, v[0]]), "Situação", "Todas")}${per}<p class="hint agquem" style="margin:0">Alterações registradas como <b>${esc(agUser || "—")}</b> · <button type="button" class="lnk" data-aguser>${agUser ? "trocar" : "identificar-se"}</button></p></div>
      ${eqCalHTML(E)}<div class="agleg">${Object.values(AG_ST).map(([l, c]) => `<span class="agst s-${c}">${l}</span>`).join("")}<span class="agcf">⚠ conflito</span></div></section>`;
  }
  /* detalhe de um dia (a partir do mês): cartões, conflitos e programar */
  function agDiaDlg(ds) {
    const E = eqEventos().filter((e) => e.ini <= ds && e.fim >= ds);
    const at = E.filter((e) => e.st !== "cancelada");
    const T = [...new Set(at.map((e) => e.equipe))];
    const prob = T.map((t) => [t, agProbDia(agDoDia(t, ds))]).filter((x) => x[1].length);
    const livres = equipesCampo().filter((t) => !agDoDia(t, ds).length);
    pmoDialog(`<h3>${DSEM[dt(ds).getDay()]}, ${fmtD(ds)}</h3><p class="hint">${p1s(E.length, "programação", "programações")} · ${p1s(T.length, "técnico", "técnicos")} · ${p1s(at.reduce((s, e) => s + e.n.plan, 0), "ponto", "pontos")}${livres.length ? ` · livres: ${esc(livres.join(", "))}` : ""}</p>${prob.length ? `<ul class="agwarnl">${prob.map(([t, p]) => `<li><b>${esc(t)}</b>: ${esc(p.join("; "))}</li>`).join("")}</ul>` : ""}<div class="agdlist" data-diaref="${ds}">${E.map(agCard).join("") || "<p class='ok-msg'>Nenhuma programação neste dia com os filtros atuais.</p>"}</div><p><button type="button" class="btn primary" data-agnovo="|${ds}">+ Programar neste dia</button></p>`);
  }
  /* ---------- + Programar / Editar: projeto → técnico → dia ou período → pontos → revisão ---------- */
  function agForm(a) {
    const T = equipesCampo();
    const ed = !!a.id;
    const projs = PMO.projs;
    const opt = (v, l, s) => `<option value="${esc(v)}" ${s ? "selected" : ""}>${esc(l)}</option>`;
    const sel = new Set(agPids(a));
    const marcado = new Set((a.pontos || []).flatMap((x) => (x.ativ || []).filter((t) => !t.canc).map((t) => t.id)));
    const cancAnt = new Map((a.pontos || []).flatMap((x) => (x.ativ || []).filter((t) => t.canc).map((t) => [t.id, t])));
    // man = projeto fora do painel (nome digitado, sem pontos nem atividades do cronograma)
    const Q = { per: !!(a.dataFim && a.dataFim > a.data), excl: new Set(), man: !!a.avulso };
    const st0 = agSt(a);
    // ponto fechado (seta); ao abrir, as atividades aparecem uma abaixo da outra para marcar
    const linha = (pid, x) => {
      const nm = x.ativ.filter((t) => marcado.has(t.id)).length;
      const np = x.ativ.filter((t) => !t.feito).length;
      return `<details class="agpt ${x.feito ? "feito" : ""}" data-pid="${esc(pid)}" data-pn="${x.pn}" data-txt="${esc(normNome(x.nome + " " + x.end))}">
          <summary class="agpth"><span class="agseta" aria-hidden="true"></span><span class="agptn"><b>${esc(x.nome)}</b>${x.end ? `<small>${esc(x.end)}</small>` : ""}</span>${x.feito ? `<em>concluído</em>` : `<em class="agpend">${np} pendente${np > 1 ? "s" : ""}</em>`}<em class="agsel" ${nm ? "" : "hidden"}>${nm} marcada${nm > 1 ? "s" : ""}</em></summary>
          <div class="agpta">${x.ativ
            .map((t) => `<label class="agat ${t.feito ? "ok" : ""}" title="${esc(t.titulo + (t.resp ? " · " + t.resp : "") + (t.feito ? " · já concluída" : ""))}"><input type="checkbox" value="${esc(t.id)}" data-titulo="${esc(t.titulo)}" ${marcado.has(t.id) ? "checked" : ""}><span>${esc(t.titulo)}</span></label>`)
            .join("")}</div></details>`;
    };
    const ptsHTML = () => {
      if (!sel.size) return `<p class="mut" style="padding:10px">Escolha um ou mais projetos.</p>`;
      return [...sel]
        .map((pid) => {
          const p = projDe(pid);
          const L = pontosProj(pid);
          return `<div class="agproj" style="--c:${p ? p.cor : "var(--muted)"}"><i></i>${esc(p ? p.nome : pid)}<small>${L.length} pontos</small></div>${L.length ? L.map((x) => linha(pid, x)).join("") : `<p class="mut" style="padding:6px 10px">Sem pontos no cronograma: informe a quantidade de pontos previstos.</p>`}`;
        })
        .join("");
    };
    const titulos = () => [...new Set([...sel].flatMap((pid) => pontosProj(pid).flatMap((x) => x.ativ.map((t) => t.titulo))))];
    const projTxt = () => (!sel.size ? "Escolha os projetos…" : sel.size === 1 ? (projDe([...sel][0]) || {}).nome || "1 projeto" : `${sel.size} projetos`);
    const locLinha = (l) =>
      `<div class="agloc"><input data-l="nome" value="${esc(l.nome || "")}" placeholder="Nome (ex.: Escola Centro)" aria-label="Nome do ponto"><input data-l="end" value="${esc(l.end || "")}" placeholder="Endereço" aria-label="Endereço"><input data-l="coord" value="${esc(l.lat && l.lng ? l.lat + ", " + l.lng : "")}" placeholder="Coordenadas: -29.6842, -51.1287" aria-label="Coordenadas (latitude, longitude)"><button type="button" class="ico rm" data-aglocrm title="Remover ponto" aria-label="Remover ponto">×</button></div>`;
    // pontos digitados: linhas vazias são ignoradas; coordenada que não dá para ler fica marcada
    const lerLocais = () =>
      [...f.querySelectorAll("#agLocs .agloc")]
        .map((r) => {
          const g = (k) => r.querySelector(`[data-l="${k}"]`).value.trim().replace(/\s+/g, " ");
          const c = g("coord");
          const v = vCoord(c);
          const lat = parseFloat(v.lat),
            lng = parseFloat(v.lng);
          const ok = !c || (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
          r.querySelector('[data-l="coord"]').classList.toggle("bad", !ok);
          return { nome: g("nome"), end: g("end"), lat: ok && c ? String(lat) : "", lng: ok && c ? String(lng) : "", erro: !ok };
        })
        .filter((l) => l.nome || l.end || l.lat || l.erro);
    const tecHTML = ed
      ? `<select name="equipe" required>${T.concat(a.equipe && !T.includes(a.equipe) ? [a.equipe] : []).map((t) => opt(t, t, t === a.equipe)).join("")}</select>`
      : `<details class="msel" id="agTecs"><summary>${esc(a.equipe || "Escolha o técnico…")}</summary><div class="mlist">${T.map((t) => `<label><input type="checkbox" data-agtec value="${esc(t)}" ${t === a.equipe ? "checked" : ""}><span><i class="agdot" style="--c:${eqCor(t)}"></i>${esc(t)}</span></label>`).join("")}</div></details><div class="agjunto" hidden><label class="chkl"><input type="radio" name="junto" value="1" checked> Juntos na mesma atividade</label><label class="chkl"><input type="radio" name="junto" value="0"> Dividir os pontos entre eles</label></div>`;
    const quando = `<div class="seg agmodo"><button type="button" class="${Q.per ? "" : "on"}" data-agper="0">Um dia</button><button type="button" class="${Q.per ? "on" : ""}" data-agper="1">Período</button></div><label class="agdt"><span></span><input type="date" name="data" required aria-label="Data" value="${esc(a.data || todayISO())}"></label><label class="agsoper agdt"><span>até</span><input aria-label="Até" type="date" name="dataFim" value="${esc(a.dataFim || "")}"></label><span class="agsoper agdias"><span class="sl">Incluir também</span><label class="chkl"><input type="checkbox" name="sab"> sábados</label><label class="chkl"><input type="checkbox" name="dom"> domingos</label><label class="chkl"><input type="checkbox" name="fer"> feriados</label></span>`;
    const stSel = !ed || st0 === "planejada" || st0 === "programada";
    pmoDialog(`<h3>${ed ? "Editar programação" : a.origem ? "Reprogramar" : "Programar equipe de campo"}</h3>
      <div class="agf2">
        <div class="agstep agproj1 ${Q.man ? "man" : ""}"><span class="sl"><i>1</i> Projeto <button type="button" class="lnk agmanb" data-agman>${Q.man ? "escolher do painel" : "projeto fora do painel"}</button></span><input class="agmanin" name="projMan" value="${esc(a.avulso ? a.projNome || "" : "")}" placeholder="Ex.: Visita técnica · Prefeitura de Canoas" aria-label="Projeto ou atividade fora do painel"><details class="msel" id="agProjs"><summary>${esc(projTxt())}</summary><div class="mlist">${projs.map((p) => `<label><input type="checkbox" data-agp value="${esc(p.id)}" ${sel.has(p.id) ? "checked" : ""}><span>${esc(p.nome)}</span></label>`).join("")}</div></details></div>
        <div class="agstep"><span class="sl"><i>2</i> Técnico / equipe${ed ? "" : " <small>(um ou mais)</small>"}</span>${tecHTML}</div>
        <div class="agstep agquando ${Q.per ? "per" : ""}"><span class="sl"><i>3</i> Quando</span><div class="agqw">${quando}</div></div>
      </div>
      <div id="agDisp" class="agdispw"></div>
      <div class="aglocw" ${Q.man ? "" : "hidden"}><div class="agloch"><span class="sl"><i>4</i> Pontos <small>(opcional: endereço e coordenadas para calcular a rota na exportação)</small></span><button type="button" class="btn ghost" data-aglocadd>+ Adicionar ponto</button></div><div id="agLocs">${(a.locais || []).map(locLinha).join("")}</div></div>
      <div class="agptsw">
        <div class="agptsh"><span class="sl"><i>4</i> Pontos e atividades</span><input type="search" class="agbusca" placeholder="Filtrar pontos (ex.: M8, Centro)" aria-label="Filtrar pontos"><select class="agtit" aria-label="Atividade"><option value="">Marcar atividade nos pontos filtrados…</option>${titulos().map((t) => opt(t, t)).join("")}</select><label class="agvt"><input type="checkbox" class="agvertudo"> Mostrar concluídas</label><button type="button" class="btn ghost" data-aglimpa>Limpar</button></div>
        <div id="agPts" class="agpts">${ptsHTML()}</div>
        <div class="agptsf"><p class="hint" id="agRes"></p><label class="agqtd">Pontos previstos<input type="number" name="qtd" min="0" step="1" value="${esc(a.qtd || "")}" placeholder="0"></label></div>
      </div>
      <div class="agdist" hidden><span class="sl">Distribuição dos pontos</span><label class="chkl"><input type="radio" name="dist" value="dist" checked> Distribuir entre os dias</label><label class="chkl"><input type="radio" name="dist" value="rep"> Repetir os mesmos pontos em todos</label><label class="agpd">Pontos por dia<input type="number" name="porDia" min="1" step="1" placeholder="auto"></label></div>
      <details class="agadv" ${a.hIni || a.obs || st0 === "planejada" ? "open" : ""}><summary>Horário, situação e observação</summary><div class="fgrid">
        <label>Início<input type="time" name="hIni" value="${esc(a.hIni || "")}"></label><label>Término<input type="time" name="hFim" value="${esc(a.hFim || "")}"></label>
        ${stSel ? `<label>Situação<select name="status">${opt("programada", "Programada (confirmada)", st0 !== "planejada")}${opt("planejada", "Planejada (rascunho)", st0 === "planejada")}</select></label>` : `<label>Situação<input value="${esc(AG_ST[st0][0])}" disabled></label>`}
        <label class="fwide">Observação<input name="obs" value="${esc(a.obs || "")}" placeholder="Ex.: levar escada; acompanhar com o fiscal"></label></div></details>
      ${ed ? agEscHTML(a, "Aplicar a alteração a") : ""}
      <div class="agprev"><span class="sl"><i>5</i> Revisão</span><p class="hint" id="agPrevRes"></p><div class="agtw"><table class="agl agprevt"><thead><tr><th></th><th>Data</th><th>Técnico</th><th>Pontos</th><th>Agenda do técnico</th></tr></thead><tbody id="agPrev"></tbody></table></div></div>`);
    const f = $("#formPmo");
    f.querySelector(".actions").innerHTML = `<button type="button" class="btn" data-pmclose>Cancelar</button><button class="btn primary" type="submit" id="agOk">${ed ? "Salvar alteração" : "Confirmar"}</button>`;
    // pontos marcados agrupados por ponto (as atividades canceladas antes continuam registradas)
    const lerPts = () => {
      const porPt = new Map();
      f.querySelectorAll("#agPts input:checked").forEach((x) => {
        const el = x.closest(".agpt");
        const k = el.dataset.pid + "|" + el.dataset.pn;
        if (!porPt.has(k)) porPt.set(k, { pid: el.dataset.pid, pn: +el.dataset.pn, nome: el.querySelector(".agpth b").textContent, ativ: [] });
        porPt.get(k).ativ.push({ id: x.value, titulo: x.dataset.titulo });
      });
      (a.pontos || []).forEach((x) =>
        (x.ativ || []).forEach((t) => {
          if (!cancAnt.has(t.id)) return;
          const k = ptK(a, x);
          if (!porPt.has(k)) return;
          porPt.get(k).ativ.push(cancAnt.get(t.id));
        }),
      );
      return [...porPt.values()];
    };
    const ler = () => {
      const d = Object.fromEntries(new FormData(f).entries());
      const pts = lerPts();
      const eqs = ed ? [d.equipe] : [...f.querySelectorAll("[data-agtec]:checked")].map((x) => x.value);
      const dias = [];
      if (!Q.per) {
        if (d.data) dias.push(d.data);
      } else if (d.data) {
        const ate = d.dataFim && d.dataFim >= d.data ? d.dataFim : d.data;
        for (let x = d.data; x <= ate && dias.length < 93; x = addDays(x, 1)) {
          const w = dt(x).getDay();
          if (FERIADOS.has(x) ? d.fer : w === 6 ? d.sab : w === 0 ? d.dom : true) dias.push(x);
        }
      }
      if (Q.man) pts.length = 0;
      const locais = Q.man ? lerLocais() : [];
      return { d, pts, eqs, dias, man: Q.man, projMan: String(d.projMan || "").trim().replace(/\s+/g, " "), locais, diasOn: dias.filter((x) => !Q.excl.has(x)), qtd: Math.max(0, Math.round(+d.qtd || 0)), dist: d.dist || "dist", junto: d.junto !== "0", porDia: Math.max(0, Math.round(+d.porDia || 0)) };
    };
    // dia × técnico, com os pontos de cada um: repetir (todos em todos) ou distribuir em ordem.
    // Técnicos juntos: os pontos são distribuídos pelos dias e cada técnico do grupo leva os mesmos
    // Pontos distribuídos por vários dias/técnicos: a rota mais curta saindo da DGT (vizinho mais
    // próximo + 2-opt, a mesma da Roteirização) é cortada em trechos seguidos, um por dia/técnico.
    // Assim cada dia fica numa mesma região (ex.: 3 dias e 3 bairros = um bairro por dia) em vez de
    // seguir a ordem da lista. Pontos sem coordenadas na Vistoria ficam no fim, na ordem da lista.
    const porRota = (pts) => {
      const C = pts.map((x) => {
        const p = projDe(x.pid);
        const vv = ((p && p.vist) || {})[x.pn] || {};
        const c = vCoord(vv.coord, vv.lat, vv.lng);
        const lat = parseFloat(c.lat),
          lng = parseFloat(c.lng);
        return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng, x } : null;
      });
      const com = C.filter(Boolean),
        sem = pts.filter((_, k) => !C[k]);
      Q.rota = { com: com.length, sem: sem.length };
      if (com.length < 3) return pts;
      const { ord } = rtSolve([RT_BASE].concat(com), false);
      return ord
        .filter((k) => k > 0)
        .map((k) => com[k - 1].x)
        .concat(sem);
    };
    const montar = (v) => {
      const jn = v.junto && v.eqs.length > 1;
      Q.rota = null;
      const S = [];
      v.diasOn.forEach((dd) => (jn ? [v.eqs[0]] : v.eqs).forEach((eq) => S.push({ data: dd, equipe: eq, pontos: [] })));
      let sobra = [];
      if (v.pts.length && (v.dist === "rep" || S.length <= 1)) S.forEach((s) => (s.pontos = v.pts));
      else if (v.pts.length) {
        // sem "pontos por dia", espalha por igual (os primeiros dias levam a sobra da divisão)
        const base = Math.floor(v.pts.length / S.length),
          resto = v.pts.length % S.length;
        let k = 0;
        const ord = porRota(v.pts);
        S.forEach((s, j) => {
          const pd = v.porDia || base + (j < resto ? 1 : 0);
          s.pontos = ord.slice(k, k + pd);
          k += pd;
        });
        sobra = ord.slice(k);
      }
      let R = v.pts.length ? S.filter((s) => s.pontos.length) : S,
        vaz = v.pts.length ? S.filter((s) => !s.pontos.length) : [];
      if (jn) {
        const todos = (L) => L.flatMap((s) => v.eqs.map((eq) => Object.assign({}, s, { equipe: eq })));
        R = todos(R);
        vaz = todos(vaz);
      }
      return { S: R, vazios: vaz, sobra };
    };
    const cand = (s, v) => {
      if (v.man)
        return { equipe: s.equipe, data: s.data, dataFim: "", pontos: [], pids: [], pid: "", projNome: v.projMan, avulso: true, locais: v.locais.map(({ nome, end, lat, lng }) => ({ nome, end, lat, lng })), qtd: 0, hIni: v.d.hIni || "", hFim: v.d.hFim || "", obs: (v.d.obs || "").trim(), junto: ed ? a.junto || [] : v.junto && v.eqs.length > 1 ? v.eqs.filter((x) => x !== s.equipe) : [] };
      const pids = s.pontos.length ? [...new Set(s.pontos.map((x) => x.pid))] : [...sel];
      return { equipe: s.equipe, data: s.data, dataFim: "", pontos: s.pontos, pids, pid: pids[0] || "", projNome: pids.map((x) => (projDe(x) || {}).nome || x).join(" / "), avulso: false, qtd: s.pontos.length ? 0 : v.qtd, hIni: v.d.hIni || "", hFim: v.d.hFim || "", obs: (v.d.obs || "").trim(), junto: ed ? a.junto || [] : v.junto && v.eqs.length > 1 ? v.eqs.filter((x) => x !== s.equipe) : [] };
    };
    const ignEd = () => new Set(ed ? (Q.per ? [a] : agAlvo(a, escolha())).map((x) => x.id) : []);
    const escolha = () => (f.querySelector('[name="esc"]:checked') || {}).value || "dia";
    const resumo = () => {
      f.querySelectorAll("#agPts .agpt").forEach((el) => {
        const n = el.querySelectorAll("input:checked").length;
        const b = el.querySelector(".agsel");
        if (b) {
          b.hidden = !n;
          b.textContent = `${n} marcada${n > 1 ? "s" : ""}`;
        }
      });
      const C = [...f.querySelectorAll("#agPts input:checked")];
      const nP = new Set(C.map((x) => x.closest(".agpt").dataset.pid + "|" + x.closest(".agpt").dataset.pn)).size;
      const nJ = new Set(C.map((x) => x.closest(".agpt").dataset.pid)).size;
      $("#agRes").textContent = C.length ? `${C.length} atividade${C.length > 1 ? "s" : ""} em ${nP} ponto${nP > 1 ? "s" : ""}${nJ > 1 ? ` de ${nJ} projetos` : ""}` : "Nenhuma atividade marcada: informe ao lado os pontos previstos.";
      f.querySelector(".agqtd").hidden = !!C.length;
      const v = ler();
      const { S, vazios, sobra } = montar(v);
      f.querySelector(".agquando").classList.toggle("per", Q.per);
      const fe = f.querySelector(".agesc");
      if (fe) fe.hidden = Q.per; // virar período vale para este dia (os novos dias entram na mesma programação)
      f.querySelector(".agdist").hidden = !(v.pts.length > 1 && v.diasOn.length * (v.junto ? 1 : v.eqs.length) > 1);
      f.querySelector(".agptsw").hidden = Q.man;
      f.querySelector(".aglocw").hidden = !Q.man;
      f.querySelector(".agproj1").classList.toggle("man", Q.man);
      const jw = f.querySelector(".agjunto");
      if (jw) jw.hidden = v.eqs.length < 2;
      const ts = f.querySelector("#agTecs summary");
      if (ts) ts.textContent = !v.eqs.length ? "Escolha o técnico…" : v.eqs.length === 1 ? v.eqs[0] : `${v.eqs.length} técnicos: ${v.eqs.join(", ")}`;
      const ign = ignEd();
      const extra = [];
      const R = S.map((s) => {
        const c = cand(s, v);
        const r = agChecar(c, ign, extra);
        extra.push(c);
        return { s, c, r };
      });
      // dias desmarcados (período) continuam na lista para voltar
      const fora = Q.per ? v.dias.filter((x) => Q.excl.has(x)) : [];
      const lin = R.map(({ s, r }) => {
        const pr = r.erros.concat(r.alertas);
        return `<tr class="${r.erros.length ? "err" : r.alertas.filter((x) => !/^Livres/.test(x)).length ? "warn" : ""}"><td>${Q.per ? `<input type="checkbox" data-agx="${s.data}" checked aria-label="Incluir ${fmtD(s.data)}">` : ""}</td><td class="nw">${DSEM[dt(s.data).getDay()]} ${fmtD(s.data)}</td><td>${esc(s.equipe)}</td><td>${s.pontos.length ? esc(s.pontos.map((x) => x.nome).join(", ")) : v.man && v.locais.length ? esc(v.locais.map((l, k) => l.nome || "Ponto " + (k + 1)).join(", ")) : v.qtd ? p1s(v.qtd, "ponto previsto", "pontos previstos") : "—"}</td><td>${pr.length ? pr.map(esc).join("<br>") : `<span class="okt">livre</span>`}</td></tr>`;
      })
        .concat(vazios.map((s) => `<tr class="mut"><td>${Q.per ? `<input type="checkbox" data-agx="${s.data}" checked aria-label="Incluir ${fmtD(s.data)}">` : ""}</td><td class="nw">${DSEM[dt(s.data).getDay()]} ${fmtD(s.data)}</td><td>${esc(s.equipe)}</td><td colspan="2">sem pontos neste dia (não será criada)</td></tr>`))
        .concat([...new Set(fora)].map((x) => `<tr class="mut"><td><input type="checkbox" data-agx="${x}" aria-label="Incluir ${fmtD(x)}"></td><td class="nw">${DSEM[dt(x).getDay()]} ${fmtD(x)}</td><td colspan="3">dia retirado</td></tr>`))
        .sort((x, y) => (x.match(/\d\d\/\d\d\/\d{4}/) || [""])[0].split("/").reverse().join("").localeCompare((y.match(/\d\d\/\d\d\/\d{4}/) || [""])[0].split("/").reverse().join("")));
      $("#agPrev").innerHTML = lin.join("") || `<tr><td colspan="5" class="mut">${v.eqs.length ? "Escolha o dia." : "Escolha o técnico."}</td></tr>`;
      // pontos distintos (técnicos juntos no mesmo ponto contam uma vez)
      const nPts = v.man ? S.length && v.locais.length * new Set(S.map((x) => x.data)).size : v.pts.length ? new Set(S.flatMap((x) => x.pontos.map((p) => x.data + "|" + p.pid + "|" + p.pn))).size : S.length * v.qtd;
      const nE = R.filter((x) => x.r.erros.length).length;
      $("#agPrevRes").innerHTML = `${p1s(S.length, "programação", "programações")} · ${p1s(new Set(S.map((x) => x.data)).size, "dia", "dias")} · ${p1s(new Set(S.map((x) => x.equipe)).size, "técnico", "técnicos")} · ${p1s(nPts, "ponto", "pontos")}${v.pts.length > 1 && S.length > 1 ? (v.dist === "rep" ? " · os mesmos pontos em todos" : Q.rota && Q.rota.com >= 3 ? ` · pontos distribuídos por proximidade (rota mais curta a partir da DGT, uma região por dia)${Q.rota.sem ? ` · <b class="bad">${p1s(Q.rota.sem, "ponto sem coordenadas ficou", "pontos sem coordenadas ficaram")} no fim: cadastre na Vistoria</b>` : ""}` : ` · pontos distribuídos na ordem da lista${Q.rota && Q.rota.sem ? " (cadastre as coordenadas na Vistoria para distribuir por proximidade)" : ""}`) : ""}${sobra.length ? ` · <b class="bad">${p1s(sobra.length, "ponto ficou", "pontos ficaram")} sem dia: aumente “Pontos por dia” ou o período</b>` : ""}${nE ? ` · <b class="bad">${p1s(nE, "duplicada", "duplicadas")}</b>` : ""}`;
      $("#agOk").textContent = ed ? "Salvar alteração" : S.length > 1 ? `Confirmar ${S.length} programações` : "Confirmar";
      // disponibilidade dos técnicos escolhidos no intervalo
      const de = v.dias[0] || v.d.data,
        ate = v.dias[v.dias.length - 1] || de;
      $("#agDisp").innerHTML = v.eqs.map((eq) => agDispHTML(eq, de, ate < addDays(de, 4) ? addDays(de, 4) : ate, ign)).join("");
    };
    resumo();
    f.onchange = (e) => {
      const t = e.target;
      if (t.hasAttribute("data-agp")) {
        f.querySelectorAll("#agPts input:checked").forEach((x) => marcado.add(x.value));
        f.querySelectorAll("#agPts input:not(:checked)").forEach((x) => marcado.delete(x.value));
        t.checked ? sel.add(t.value) : sel.delete(t.value);
        $("#agPts").innerHTML = ptsHTML();
        f.querySelector("#agProjs summary").textContent = projTxt();
        f.querySelector(".agtit").innerHTML = `<option value="">Marcar atividade nos pontos filtrados…</option>${titulos().map((x) => opt(x, x)).join("")}`;
        $("#agPts").classList.toggle("vertudo", f.querySelector(".agvertudo").checked);
      } else if (t.classList.contains("agvertudo")) {
        $("#agPts").classList.toggle("vertudo", t.checked);
      } else if (t.classList.contains("agtit") && t.value) {
        f.querySelectorAll(`#agPts .agpt:not([hidden]) input[data-titulo="${CSS.escape(t.value)}"]`).forEach((x) => {
          if (!x.closest(".agat").classList.contains("ok")) x.checked = true;
        });
        t.value = "";
      } else if (t.hasAttribute("data-agx")) {
        t.checked ? Q.excl.delete(t.dataset.agx) : Q.excl.add(t.dataset.agx);
      }
      resumo();
    };
    f.oninput = (e) => {
      if (e.target.classList.contains("agbusca")) {
        const q = normNome(e.target.value);
        f.querySelectorAll("#agPts .agpt").forEach((l) => (l.hidden = q && !l.dataset.txt.includes(q)));
      } else if (e.target.type === "number" || e.target.closest(".agloc")) resumo();
    };
    f.onclick = (e) => {
      ["#agProjs", "#agTecs"].forEach((k) => {
        const d = f.querySelector(k);
        if (d && !e.target.closest(k)) d.open = false;
      });
      if (e.target.closest("[data-aglocadd]")) {
        $("#agLocs").insertAdjacentHTML("beforeend", locLinha({}));
        $("#agLocs").lastElementChild.querySelector("input").focus();
        return;
      }
      if (e.target.closest("[data-aglocrm]")) {
        e.target.closest(".agloc").remove();
        resumo();
        return;
      }
      if (e.target.closest("[data-agman]")) {
        Q.man = !Q.man;
        e.target.closest("[data-agman]").textContent = Q.man ? "escolher do painel" : "projeto fora do painel";
        resumo();
        if (Q.man) f.querySelector(".agmanin").focus();
        return;
      }
      const b = e.target.closest("[data-agper]");
      if (b) {
        Q.per = b.dataset.agper === "1";
        f.querySelectorAll("[data-agper]").forEach((x) => x.classList.toggle("on", x === b));
                if (Q.per && !f.querySelector('[name="dataFim"]').value) f.querySelector('[name="dataFim"]').value = addUteis(proxUtil(f.querySelector('[name="data"]').value || todayISO()), 4);
        resumo();
      } else if (e.target.closest("[data-aglimpa]")) {
        f.querySelectorAll("#agPts input").forEach((x) => (x.checked = false));
        resumo();
      }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = ler();
      if (Q.man ? !v.projMan : !sel.size) return toast(Q.man ? "Escreva o projeto ou a atividade." : "Escolha o projeto.");
      if (Q.man && v.locais.some((l) => l.erro)) return toast("Confira as coordenadas marcadas em vermelho (ex.: -29.6842, -51.1287).");
      if (!v.eqs.length || !v.eqs[0]) return toast("Escolha o técnico ou a equipe.");
      if (!v.d.data) return toast("Informe a data.");
      if (Q.per && v.d.dataFim && v.d.dataFim < v.d.data) return toast("O fim do período é antes do início.");
      if (v.d.hIni && v.d.hFim && v.d.hFim <= v.d.hIni) return toast("O término precisa ser depois do início.");
      if (ed) return Q.per ? salvarPeriodo(v) : salvarEdicao(v);
      const { S, sobra } = montar(v);
      if (!S.length) return toast(v.diasOn.length ? "Nenhum dia recebeu pontos." : "Nenhum dia no período: confira as datas e os dias incluídos.");
      if (sobra.length) return toast(`${p1s(sobra.length, "ponto ficou", "pontos ficaram")} sem dia: aumente “Pontos por dia” ou o período.`);
      const C = S.map((s) => cand(s, v));
      if (!(await agConferir(C, new Set()))) return;
      const quem = await agQuem();
      if (!quem) return;
      const agora = agAgora();
      const lote = uid("lt");
      const status = v.d.status === "planejada" ? "planejada" : "programada";
      const ops = [];
      const serie = new Map();
      v.eqs.forEach((eq) => {
        const D = S.filter((s) => s.equipe === eq);
        if (!D.length) return;
        const sid = uid("sr");
        serie.set(eq, sid);
        ops.push({ coll: "agendaSerie", id: sid, data: { lote, equipe: eq, de: D[0].data, ate: D[D.length - 1].data, dias: D.map((s) => s.data), modo: v.pts.length > 1 && S.length > 1 ? v.dist : "", porDia: v.porDia || "", pids: [...sel], pontos: v.pts, qtd: v.qtd, hIni: v.d.hIni || "", hFim: v.d.hFim || "", obs: (v.d.obs || "").trim(), status, origem: a.origem || "", criadoPor: quem, criadoEm: agora } });
      });
      const novos = [];
      S.forEach((s, k) => {
        const D = S.filter((x) => x.equipe === s.equipe);
        const pos = D.indexOf(s) + 1;
        const id = uid("ag");
        novos.push({ id, s });
        ops.push({
          id,
          data: Object.assign(C[k], {
            serie: serie.get(s.equipe),
            lote,
            status,
            origem: a.origem || "",
            criadoPor: quem,
            criadoEm: agora,
            atualizado: agora,
            por: quem,
            hist: [{ em: agora, por: quem, acao: a.origem ? "reprogramada" : "criada", txt: (D.length > 1 ? `Dia ${pos} de ${D.length} do período ${fmtD(D[0].data)} a ${fmtD(D[D.length - 1].data)}` : "") + (a.origem ? (D.length > 1 ? " · " : "") + "pendências de outra programação" : "") }],
          }),
        });
      });
      const orig = a.origem && AGC.find((x) => x.id === a.origem);
      if (orig) ops.push(agMudar(orig, { reprog: (orig.reprog || []).concat(novos.map((x) => x.id)) }, "reprogramada", `Pendências reprogramadas para ${[...new Set(S.map((s) => fmtD(s.data)))].join(", ")} (${[...new Set(S.map((s) => s.equipe))].join(", ")})`));
      if (!(await agGravar(ops))) return;
      $("#dlgPmo").close();
      toast(S.length > 1 ? `${S.length} programações criadas (${p1s(new Set(S.map((s) => s.data)).size, "dia", "dias")}).` : "Programação criada.");
      render();
    };
    /* edição: o dia, este dia e os próximos ou todo o período. Nos outros dias valem só os campos
       alterados; a data anda o mesmo número de dias úteis; pontos e projeto mudam junto só quando a
       série repete os mesmos pontos em todos os dias. As finalizadas e canceladas não mudam. */
    /* edição que vira período: este dia passa a ser o primeiro e os outros dias entram na mesma série */
    async function salvarPeriodo(v) {
      const { S, sobra } = montar(v);
      if (!S.length) return toast(v.diasOn.length ? "Nenhum dia recebeu pontos." : "Nenhum dia no período: confira as datas e os dias incluídos.");
      if (sobra.length) return toast(`${p1s(sobra.length, "ponto ficou", "pontos ficaram")} sem dia: aumente “Pontos por dia” ou o período.`);
      const C = S.map((x) => cand(x, v));
      if (!(await agConferir(C, new Set([a.id])))) return;
      const quem = await agQuem();
      if (!quem) return;
      const agora = agAgora();
      const sid = a.serie || uid("sr");
      const st = stSel ? (v.d.status === "planejada" ? "planejada" : "programada") : agSt(a);
      const per = `${fmtD(S[0].data)} a ${fmtD(S[S.length - 1].data)}`;
      const ops = [agMudar(a, Object.assign({}, C[0], { serie: sid, status: st }), "alterada para período", `Período ${per} (${p1s(S.length, "dia", "dias")})`)];
      C.slice(1).forEach((c, k) =>
        ops.push({
          id: uid("ag"),
          data: Object.assign(c, { serie: sid, lote: a.lote || "", status: st, origem: a.id, criadoPor: quem, criadoEm: agora, atualizado: agora, por: quem, hist: [{ em: agora, por: quem, acao: "criada", txt: `Dia ${k + 2} de ${S.length} do período ${per} (a partir da programação de ${fmtD(a.data)})` }] }),
        }),
      );
      if (!AGC_S.has(sid)) ops.push({ coll: "agendaSerie", id: sid, data: { lote: a.lote || "", equipe: C[0].equipe, de: S[0].data, ate: S[S.length - 1].data, dias: S.map((x) => x.data), modo: v.pts.length > 1 && S.length > 1 ? v.dist : "", porDia: v.porDia || "", pids: [...sel], pontos: v.pts, qtd: v.qtd, hIni: v.d.hIni || "", hFim: v.d.hFim || "", obs: (v.d.obs || "").trim(), status: st, origem: a.id, criadoPor: quem, criadoEm: agora } });
      if (!(await agGravar(ops))) return;
      $("#dlgPmo").close();
      toast(`Programação estendida para ${p1s(S.length, "dia", "dias")} (${per}).`);
      render();
    }
    async function salvarEdicao(v) {
      const s = { data: v.d.data, equipe: v.d.equipe, pontos: v.pts };
      const campos = cand(s, v);
      if (stSel) campos.status = v.d.status === "planejada" ? "planejada" : "programada";
      const mud = ["projNome", "locais", "equipe", "data", "dataFim", "pontos", "pids", "qtd", "hIni", "hFim", "obs", "status"].filter((k) => k in campos && agDifere(a, campos, k));
      if (!mud.length) {
        $("#dlgPmo").close();
        return toast("Nada foi alterado.");
      }
      const esc_ = escolha();
      const alvo = agAlvo(a, esc_);
      const rep = agRepete(a);
      const passo = campos.data !== a.data ? agPasso(a.data, campos.data) : 0;
      const L = alvo.map((x) => {
        if (x.id === a.id) return { x, c: campos };
        const c = {};
        mud.forEach((k) => {
          if (k === "data") c.data = addUteis(x.data, passo);
          else if (["pontos", "pids", "qtd"].includes(k)) {
            if (rep) Object.assign(c, { [k]: campos[k], pid: campos.pid, projNome: campos.projNome });
          } else c[k] = campos[k];
        });
        return { x, c };
      });
      const ign = new Set(alvo.map((x) => x.id));
      if (!(await agConferir(L.map(({ x, c }) => Object.assign({}, x, c, { id: "" })), ign))) return;
      if (!(await agQuem())) return;
      const rot = esc_ === "dia" ? "alterada" : esc_ === "prox" ? "alterada (este dia e os próximos)" : "alterada (todo o período)";
      const ops = L.map(({ x, c }) => agMudar(x, c, campos.equipe !== a.equipe && mud.length === 1 ? "técnico substituído" : rot)).filter((o) => o.mudou);
      if (!(await agGravar(ops))) return;
      $("#dlgPmo").close();
      const pul = esc_ === "dia" ? 0 : agIrmas(a).filter((x) => agFechado(x) && (esc_ === "todos" || x.data > a.data)).length;
      toast(`${p1s(ops.length, "dia alterado", "dias alterados")}${pul ? ` · ${p1s(pul, "finalizado ou cancelado ficou", "finalizados ou cancelados ficaram")} como estava` : ""}${!rep && esc_ !== "dia" && mud.some((k) => k === "pontos") ? " · os pontos mudaram só neste dia (cada dia tem os seus)" : ""}.`);
      render();
    }
  }
  /* irmãs de uma ocorrência: mesma série (mesmo técnico de origem, mesmo período) */
  const agIrmas = (a) => (a.serie ? AGC.filter((x) => x.serie === a.serie && !x.excluida && x.id !== a.id) : []);
  const agRepete = (a) => {
    const s = AGC_S.get(a.serie);
    return !!(s && s.modo === "rep");
  };
  function agAlvo(a, e) {
    if (e === "dia") return [a];
    return [a].concat(agIrmas(a).filter((x) => !agFechado(x) && (e === "todos" || x.data > a.data))).sort(byData);
  }
  // dias úteis entre duas datas, com sinal (para andar as outras datas da série o mesmo tanto)
  const agPasso = (a, b) => (b >= a ? 1 : -1) * Math.max(0, diasUteis(b >= a ? a : b, b >= a ? b : a) - (diaUtil(b >= a ? a : b) ? 1 : 0));
  function agEscHTML(a, leg) {
    const I = agIrmas(a).filter((x) => !agFechado(x));
    if (!I.length) return "";
    const nP = I.filter((x) => x.data > a.data).length;
    return `<fieldset class="agesc"><legend>${esc(leg || "Aplicar a")}</legend><label class="chkl"><input type="radio" name="esc" value="dia" checked> Somente este dia</label>${nP ? `<label class="chkl"><input type="radio" name="esc" value="prox"> Este dia e os próximos (${nP + 1})</label>` : ""}<label class="chkl"><input type="radio" name="esc" value="todos"> Todo o período (${I.length + 1} dias em aberto)</label></fieldset>`;
  }
  /* ---------- painel lateral da programação: dados, ações rápidas e histórico ---------- */
  function agPainel(id, refresh) {
    const d = $("#dlgAg"),
      f = $("#formAg");
    const a = AGC.find((x) => x.id === id);
    if (!a || a.excluida) {
      if (d.open) d.close();
      return;
    }
    if (refresh && AGP.modo && AGP.id === id) return; // não atrapalha um formulário aberto
    if (!refresh || AGP.id !== id) AGP.modo = "";
    AGP.id = id;
    if (!refresh && $("#dlgPmo").open) $("#dlgPmo").close();
    const st = agSt(a),
      n = agNums(a),
      P = a.pontos || [];
    const irm = a.serie ? AGC.filter((x) => x.serie === a.serie && !x.excluida).sort(byData) : [];
    const pos = irm.findIndex((x) => x.id === a.id) + 1;
    const ok = new Set(a.ptsExec || []);
    const nProj = new Set(P.map((x) => ptPid(a, x))).size;
    const porPonto = !agFechado(a) && st !== "bloqueada";
    const quando = a.ptsExecEm || {};
    const pts = P.map((x) => {
      const c = ptCanc(x);
      const k = ptK(a, x);
      const e = !c && (ok.has(k) || (st === "concluida" && !a.ptsExec));
      const bt = !porPonto || c ? "" : e ? `<button type="button" class="lnk agptdf" data-agpt="${esc(k)}" data-desf="1">desfazer</button>` : `<button type="button" class="btn agptok" data-agpt="${esc(k)}">✓ Concluir ponto</button>`;
      return `<li class="${c ? "canc" : e ? "ok" : ""}"><div class="agpth2"><b>${esc(x.nome)}</b>${nProj > 1 ? ` <small>${esc(nomeCurto(projDe(ptPid(a, x)) || { nome: "" }))}</small>` : ""}${c ? " <small>cancelado</small>" : e ? ` <small>executado${quando[k] ? " " + fmtDH(quando[k]) : ""}</small>` : ""}${bt}</div><ul>${(x.ativ || []).map((t) => `<li class="${t.canc ? "canc" : ""}">${esc(t.titulo)}${t.canc ? ` <small>cancelada · ${esc(t.canc.motivo)}</small>` : ""}</li>`).join("")}</ul></li>`;
    }).join("");
    const B = (k, l, cls) => `<button type="button" class="btn ${cls || ""} ${AGP.modo === k ? "on" : ""}" data-aga="${k}">${l}</button>`;
    const aberta = !agFechado(a);
    const acts = [
      aberta && st !== "bloqueada" && B("fin", "✓ Finalizar atividade", "primary"),
      st === "planejada" && B("conf", "Confirmar programação"),
      (st === "planejada" || st === "programada") && B("ini", "▶ Registrar início"),
      aberta && B("ed", "Editar"),
      aberta && B("tec", "Trocar técnico"),
      aberta && B("data", "Alterar data"),
      aberta && B("canc", "Cancelar etapa…", "danger"),
      st === "bloqueada" ? B("desb", "Desbloquear") : aberta && B("bloq", "Bloquear"),
      (st === "cancelada" || st === "parcial" || P.some((x) => (x.ativ || []).some((t) => t.canc))) && B("repr", "Reprogramar pendências"),
      agFechado(a) && B("reab", "Reabrir"),
      B("excl", "Excluir", "danger"),
    ]
      .filter(Boolean)
      .join("");
    const H = (a.hist || []).slice().reverse();
    const info = [
      a.equipeOrig && a.equipeOrig !== a.equipe ? `Programado originalmente para <b>${esc(a.equipeOrig)}</b>` : "",
      (a.junto || []).length ? `Junto com <b>${esc(a.junto.join(", "))}</b> na mesma atividade` : "",
      st === "cancelada" ? `Cancelada: <b>${esc(a.motivoCanc || "")}</b>${a.obsCanc ? " · " + esc(a.obsCanc) : ""}${a.cancPor ? ` · ${esc(a.cancPor)}, ${fmtDH(a.cancEm)}` : ""}` : "",
      st === "bloqueada" ? `Bloqueada: <b>${esc(a.motivoBloq || "")}</b>` : "",
      a.inicioExec ? `Início registrado em ${fmtDH(a.inicioExec)}` : "",
      agFeito(a) && a.conclusao ? `Concluída em ${fmtD(a.conclusao.slice(0, 10))} ${a.conclusao.slice(11, 16)}${a.obsConc ? " · " + esc(a.obsConc) : ""}` : "",
      a.pendTxt ? `Pendências: <b>${esc(a.pendTxt)}</b>` : "",
      a.obs ? `Obs.: ${esc(a.obs)}` : "",
    ].filter(Boolean);
    f.innerHTML = `<div class="agph" style="--c:${eqCor(a.equipe)}"><button type="button" class="ico agpx" data-agclose aria-label="Fechar">×</button>${agChip(a)}<h3>${esc(a.equipe)}</h3><p>${DSEM[dt(a.data).getDay()]}, ${fmtD(a.data)}${agFim(a) !== a.data ? " a " + fmtD(agFim(a)) : ""}${a.hIni ? ` · ${a.hIni}${a.hFim ? "–" + a.hFim : ""}` : ""}</p><p><b>${esc(agNomeProj(a))}</b></p>${irm.length > 1 ? `<p class="hint">Dia ${pos} de ${irm.length} do período ${fmtD(irm[0].data)} a ${fmtD(irm[irm.length - 1].data)}</p>` : ""}</div>
      <div class="agpn"><div><b>${n.plan}</b><span>previstos</span></div><div><b>${agFeito(a) || n.exec ? n.exec : "–"}</b><span>executados</span></div><div><b>${agFeito(a) ? n.pend : n.exec ? n.plan - n.exec : "–"}</b><span>pendentes</span></div></div>
      ${info.length ? `<ul class="agpinfo">${info.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
      <div class="agpacts">${acts}</div>
      <div id="agpForm">${agpFormHTML(a)}</div>
      ${P.length ? `<section class="agpsec"><h4>Pontos e atividades</h4><ul class="agppts">${pts}</ul></section>` : ""}
      ${(a.locais || []).length ? `<section class="agpsec"><h4>Pontos</h4><ul class="agppts">${a.locais.map((l, k) => `<li><b>${esc(l.nome || "Ponto " + (k + 1))}</b>${l.end ? ` <small>${esc(l.end)}</small>` : ""}${l.lat && l.lng ? ` <a href="https://www.google.com/maps?q=${esc(l.lat)},${esc(l.lng)}" target="_blank" rel="noopener">mapa</a>` : ` <small class="bad">sem coordenadas</small>`}</li>`).join("")}</ul></section>` : ""}
      <details class="agpsec agphist" ${AGP.modo === "hist" ? "open" : ""}><summary><h4>Histórico (${H.length})</h4></summary><ol>${H.map((h) => `<li><span>${fmtDH(h.em)}${h.por ? " · " + esc(h.por) : ""}</span><b>${esc(h.acao)}</b>${h.txt ? `<small>${esc(h.txt)}</small>` : ""}</li>`).join("") || "<li class='mut'>Sem registros.</li>"}</ol></details>`;
    if (!d.open) d.showModal();
    const fx = f.querySelector("#agpForm input:not([type=hidden]), #agpForm select");
    if (AGP.modo && fx && !refresh) fx.focus();
  }
  function agpFormHTML(a) {
    const m = AGP.modo;
    const P = (a.pontos || []).filter((x) => !ptCanc(x));
    const n = agNums(a);
    const hoje = todayISO();
    const voltar = `<button type="button" class="btn" data-aga="">Voltar</button>`;
    const motivos = `<label>Motivo<select name="cm"><option value="">Escolha…</option>${AG_MOT.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label><label>Observação complementar<input name="co" placeholder="Obrigatória quando o motivo é “Outros”"></label>`;
    if (m === "fin") {
      const dia = a.data > hoje ? hoje : agFim(a) < hoje ? agFim(a) : hoje;
      return `<div class="agpf"><h4>Finalizar atividade</h4>${P.length ? `<fieldset class="agfpts"><legend>Pontos executados</legend>${P.map((x) => `<label class="chkl"><input type="checkbox" name="pe" value="${esc(ptK(a, x))}" checked> ${esc(x.nome)}</label>`).join("")}</fieldset>` : `<label>Pontos executados<input type="number" name="exec" min="0" step="1" value="${n.plan}"></label>`}
        <div class="fgrid"><label>Data da conclusão<input type="date" name="fd" value="${dia}" max="${hoje}"></label><label>Horário<input type="time" name="fh" value="${dia === hoje ? horaAgora() : a.hFim || ""}"></label></div>
        <label>Observações<input name="fo" placeholder="Opcional"></label><label>Pendências<textarea name="fp" rows="2" placeholder="Ex.: faltou energização; cliente não liberou o acesso"></textarea></label>
        <p class="hint" id="agfRes"></p><div class="actions">${voltar}<button type="button" class="btn primary" data-agok="fin">Confirmar conclusão</button></div></div>`;
    }
    if (m === "tec") {
      const T = equipesCampo().filter((t) => t !== a.equipe);
      const op = T.map((t) => {
        const L = agDoDia(t, a.data);
        const pr = agProbDia(L);
        const pts = L.reduce((s, x) => s + agPtsDia(x), 0);
        return `<option value="${esc(t)}">${esc(t)} — ${!L.length ? "livre" : `${p1s(L.length, "programação", "programações")}, ${pts} pts${pr.length ? " · conflito" : ""}`}</option>`;
      }).join("");
      return `<div class="agpf"><h4>Trocar técnico</h4><label>Novo técnico (disponibilidade em ${fmtD(a.data)})<select name="nt">${op}</select></label>${agEscHTML(a)}<div id="agpDisp"></div><p class="hint">${esc(a.equipe)} fica registrado no histórico e é liberado nos dias trocados.</p><div class="actions">${voltar}<button type="button" class="btn primary" data-agok="tec">Aplicar troca</button></div></div>`;
    }
    if (m === "data") return `<div class="agpf"><h4>Alterar data</h4><label>Nova data<input type="date" name="nd" value="${a.data}"></label>${agEscHTML(a)}<p class="hint">Nos outros dias, a data anda o mesmo número de dias úteis.</p><div id="agpDisp"></div><div class="actions">${voltar}<button type="button" class="btn primary" data-agok="data">Mover</button></div></div>`;
    if (m === "canc")
      return `<div class="agpf"><h4>Cancelar etapa</h4>${P.length ? `<fieldset class="agfpts"><legend>Etapas a cancelar <small>(desmarque o que continua)</small></legend>${P.map((x) => `<div class="agcpt"><label class="chkl"><input type="checkbox" data-cpt="${esc(ptK(a, x))}" checked> <b>${esc(x.nome)}</b></label>${(x.ativ || []).filter((t) => !t.canc).map((t) => `<label class="chkl agcat"><input type="checkbox" name="ca" value="${esc(t.id)}" data-pt="${esc(ptK(a, x))}" checked> ${esc(t.titulo)}</label>`).join("")}</div>`).join("")}</fieldset>` : ""}${motivos}<div id="agcEsc">${agEscHTML(a, "Cancelar também outros dias? (só quando todas as etapas do dia são canceladas)")}</div><p class="hint">Nada é apagado: o registro fica no histórico, sai da carga do técnico e pode ser reprogramado.</p><div class="actions">${voltar}<button type="button" class="btn dangerfill" data-agok="canc">Confirmar cancelamento</button></div></div>`;
    if (m === "excl")
      return `<div class="agpf"><h4>Excluir programação</h4><p class="hint">Sai da agenda e dos indicadores e libera o técnico. O registro e o histórico continuam guardados${agFeito(a) ? "; as datas já lançadas no cronograma não são desfeitas" : ""}. Se o serviço não aconteceu, prefira <b>Cancelar etapa</b>, que entra nos indicadores e pode ser reprogramado.</p><label>Motivo (opcional)<input name="xm" placeholder="Ex.: lançada por engano"></label>${agEscHTML(a, "Excluir")}<div class="actions">${voltar}<button type="button" class="btn dangerfill" data-agok="excl">Excluir</button></div></div>`;
    if (m === "bloq") return `<div class="agpf"><h4>Bloquear programação</h4>${motivos}<p class="hint">Bloqueada não pode ser finalizada até ser desbloqueada.</p><div class="actions">${voltar}<button type="button" class="btn primary" data-agok="bloq">Bloquear</button></div></div>`;
    return "";
  }
  function agPainelEventos() {
    const f = $("#formAg"),
      d = $("#dlgAg");
    f.onsubmit = (e) => e.preventDefault();
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close(); // clique fora do painel
    });
    d.addEventListener("close", () => {
      AGP.modo = "";
    });
    const atual = () => AGC.find((x) => x.id === AGP.id);
    const prevFin = () => {
      const a = atual();
      const r = f.querySelector("#agfRes");
      if (!a || !r) return;
      const n = agNums(a);
      const ex = f.querySelector('[name="exec"]') ? Math.max(0, +f.querySelector('[name="exec"]').value || 0) : f.querySelectorAll('[name="pe"]:checked').length;
      const pend = (f.querySelector('[name="fp"]') || {}).value || "";
      r.innerHTML = ex >= n.plan && !pend.trim() ? `Será registrada como <b>Concluída</b> (${ex}/${n.plan} pontos).` : `Será registrada como <b>Concluída parcialmente</b>: ${ex} de ${n.plan} pontos executados${n.plan - ex > 0 ? `, ${n.plan - ex} pendente${n.plan - ex > 1 ? "s" : ""}` : ""}${pend.trim() ? " e pendências informadas" : ""}. O previsto continua registrado.`;
    };
    const prevDisp = () => {
      const a = atual();
      const el = f.querySelector("#agpDisp");
      if (!a || !el) return;
      const e_ = (f.querySelector('[name="esc"]:checked') || {}).value || "dia";
      const alvo = agAlvo(a, e_);
      const ign = new Set(alvo.map((x) => x.id));
      const de = alvo[0].data,
        ate = alvo[alvo.length - 1].data;
      if (AGP.modo === "tec") {
        const nt = f.querySelector('[name="nt"]').value;
        el.innerHTML = agDispHTML(nt, de, ate < addDays(de, 4) ? addDays(de, 4) : ate) + agDispHTML(a.equipe, de, ate < addDays(de, 4) ? addDays(de, 4) : ate);
      } else {
        const nd = f.querySelector('[name="nd"]').value;
        if (!nd) return (el.innerHTML = "");
        const r = agChecar(Object.assign({}, a, { data: nd, id: "" }), ign);
        el.innerHTML = (r.erros.length || r.alertas.length ? `<ul class="agwarnl">${r.erros.concat(r.alertas).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="okt">${esc(a.equipe)} está livre em ${fmtD(nd)}.</p>`) + agDispHTML(a.equipe, nd, addDays(nd, 4), ign);
      }
    };
    f.addEventListener("change", (e) => {
      const t = e.target;
      if (t.dataset.cpt) f.querySelectorAll(`[name="ca"][data-pt="${CSS.escape(t.dataset.cpt)}"]`).forEach((x) => (x.checked = t.checked));
      if (t.name === "ca" || t.dataset.cpt) {
        const tudo = [...f.querySelectorAll('[name="ca"]')].every((x) => x.checked);
        const ce = f.querySelector("#agcEsc");
        if (ce) {
          ce.hidden = !tudo;
          if (!tudo) {
            const r = ce.querySelector('[value="dia"]');
            if (r) r.checked = true;
          }
        }
      }
      prevFin();
      if (AGP.modo === "tec" || AGP.modo === "data") prevDisp();
    });
    f.addEventListener("input", prevFin);
    f.addEventListener("click", async (e) => {
      const t = e.target;
      if (t.closest("[data-agclose]")) return d.close();
      const a = atual();
      if (!a) return;
      let b;
      if ((b = t.closest("[data-agpt]"))) {
        if (await agPonto(a, b.dataset.agpt, !!b.dataset.desf)) agPainel(a.id, true);
        return;
      }
      if ((b = t.closest("[data-aga]"))) {
        const k = b.dataset.aga;
        if (k === "ed") {
          d.close();
          return agForm(a);
        }
        if (k === "repr") {
          d.close();
          return agReprogramar(a);
        }
        if (["fin", "tec", "data", "canc", "bloq", "excl", ""].includes(k)) {
          AGP.modo = AGP.modo === k ? "" : k;
          agPainel(a.id, true);
          f.querySelector("#agpForm").innerHTML = agpFormHTML(a);
          f.querySelectorAll("[data-aga]").forEach((x) => x.classList.toggle("on", x.dataset.aga === AGP.modo && !!AGP.modo));
          prevFin();
          if (AGP.modo === "tec" || AGP.modo === "data") prevDisp();
          const fx = f.querySelector("#agpForm input, #agpForm select");
          if (fx) fx.focus();
          return;
        }
        if (k === "reab" && !(await askConfirm("Reabrir esta programação? Ela volta para Programada; as datas já lançadas no cronograma não são desfeitas.", "Reabrir"))) return;
        if (!(await agQuem())) return;
        const em = agAgora();
        const st = agSt(a);
        const C = {
          conf: [{ status: "programada" }, "confirmada"],
          ini: [{ status: "andamento", inicioExec: em }, "início registrado"],
          desb: [{ status: a.stAnt && a.stAnt !== "bloqueada" ? a.stAnt : "programada", motivoBloq: "" }, "desbloqueada"],
          reab: [{ status: "programada", exec: "", ptsExec: [], ptsExecEm: {}, conclusao: "", pendTxt: "", obsConc: "", motivoCanc: "", obsCanc: "", pontos: (a.pontos || []).map((x) => Object.assign({}, x, { ativ: (x.ativ || []).map((t) => (t.canc && t.canc.todo ? Object.assign({}, t, { canc: null }) : t)) })) }, `reaberta (estava ${AG_ST[st][0].toLowerCase()})`],
        }[k];
        if (!C) return;
        if (!(await agGravar([agMudar(a, C[0], C[1])]))) return;
        if (k === "ini") {
          const nA = await agCrono(a, null, "ini", todayISO());
          toast(`Início registrado${nA ? ` · ${p1s(nA, "atividade iniciada", "atividades iniciadas")} no cronograma` : ""}.`);
        } else toast({ conf: "Programação confirmada.", desb: "Programação desbloqueada.", reab: "Programação reaberta." }[k]);
        AGP.modo = "";
        agPainel(a.id, true);
      } else if ((b = t.closest("[data-agok]"))) {
        const k = b.dataset.agok;
        const v = Object.fromEntries(new FormData(f).entries());
        const e_ = v.esc || "dia";
        if (k === "fin") {
          if (v.fd && v.fd > todayISO()) return toast("A conclusão não pode ser numa data futura.");
          const pe = [...f.querySelectorAll('[name="pe"]:checked')].map((x) => x.value);
          if (await agFinalizar([a], { data: v.fd, hora: v.fh, obs: v.fo, pend: v.fp, pts: f.querySelector('[name="pe"]') ? pe : null, exec: v.exec })) {
            AGP.modo = "";
            agPainel(a.id, true);
          }
        } else if (k === "tec") {
          if (!v.nt) return toast("Escolha o novo técnico.");
          const alvo = agAlvo(a, e_);
          if (!(await agConferir(alvo.map((x) => Object.assign({}, x, { equipe: v.nt, id: "" })), new Set(alvo.map((x) => x.id))))) return;
          if (!(await agQuem())) return;
          if (!(await agGravar(alvo.map((x) => agMudar(x, { equipe: v.nt }, "técnico substituído"))))) return;
          toast(`${v.nt} assume ${p1s(alvo.length, "dia", "dias")}; ${a.equipe} foi liberado.`);
          AGP.modo = "";
          agPainel(a.id, true);
        } else if (k === "data") {
          if (!v.nd) return toast("Informe a nova data.");
          if (v.nd === a.data) return toast("A data é a mesma.");
          const alvo = agAlvo(a, e_);
          const passo = agPasso(a.data, v.nd);
          const novo = (x) => (x.id === a.id ? v.nd : addUteis(x.data, passo));
          const fimN = (x) => (x.dataFim ? addDays(novo(x), Math.round((dt(x.dataFim) - dt(x.data)) / 864e5)) : "");
          if (!(await agConferir(alvo.map((x) => Object.assign({}, x, { data: novo(x), dataFim: fimN(x), id: "" })), new Set(alvo.map((x) => x.id))))) return;
          if (!(await agQuem())) return;
          if (!(await agGravar(alvo.map((x) => agMudar(x, { data: novo(x), dataFim: fimN(x) }, "data alterada"))))) return;
          toast(`${p1s(alvo.length, "dia movido", "dias movidos")}.`);
          AGP.modo = "";
          agPainel(a.id, true);
        } else if (k === "excl") {
          const alvo = agAlvo(a, e_);
          if (!(await agQuem())) return;
          if (!(await agGravar(alvo.map((x) => agMudar(x, { excluida: true, excluidaEm: agAgora(), excluidaPor: agUser }, "excluída", (v.xm || "").trim()))))) return;
          toast(`${p1s(alvo.length, "programação excluída", "programações excluídas")}.`);
          d.close();
        } else if (k === "canc" || k === "bloq") {
          if (!v.cm) return toast("Escolha o motivo.");
          if (v.cm === "Outros" && !(v.co || "").trim()) return toast("Descreva o motivo na observação.");
          if (k === "bloq") {
            if (!(await agQuem())) return;
            if (!(await agGravar([agMudar(a, { status: "bloqueada", stAnt: agSt(a), motivoBloq: v.cm + (v.co ? " · " + v.co.trim() : "") }, "bloqueada", v.cm + (v.co ? " · " + v.co.trim() : ""))]))) return;
            toast("Programação bloqueada.");
          } else {
            const ca = f.querySelectorAll('[name="ca"]').length ? new Set([...f.querySelectorAll('[name="ca"]:checked')].map((x) => x.value)) : null;
            if (ca && !ca.size) return toast("Marque ao menos uma etapa para cancelar.");
            const tudo = !ca || [...f.querySelectorAll('[name="ca"]')].every((x) => x.checked);
            const alvo = tudo ? agAlvo(a, e_) : [a];
            if (alvo.length > 1 && !(await askConfirm(`Cancelar ${alvo.length} dias desta programação (${fmtD(alvo[0].data)} a ${fmtD(alvo[alvo.length - 1].data)})?`, "Cancelar os dias"))) return;
            if (!(await agCancelar(alvo, v.cm, (v.co || "").trim(), tudo ? null : ca))) return;
            toast(tudo ? `${p1s(alvo.length, "dia cancelado", "dias cancelados")}; o técnico ficou livre.` : `${p1s(ca.size, "etapa cancelada", "etapas canceladas")}; o restante continua programado.`);
          }
          AGP.modo = "";
          agPainel(a.id, true);
        }
      }
    });
  }
  /* finaliza uma ou mais programações: sem informação extra, todos os pontos executados agora */
  async function agFinalizar(L, o) {
    o = o || {};
    L = L.filter((a) => !agFechado(a) && agSt(a) !== "bloqueada");
    if (!L.length) {
      toast("Nenhuma programação em aberto para finalizar (as bloqueadas precisam ser desbloqueadas antes).");
      return false;
    }
    if (!(await agQuem())) return false;
    const hoje = todayISO();
    const R = L.map((a) => {
      const n = agNums(a);
      const P = (a.pontos || []).filter((x) => !ptCanc(x));
      const pe = o.pts ? new Set(o.pts) : null;
      const exe = P.filter((x) => !pe || pe.has(ptK(a, x)));
      const exec = P.length ? exe.length : o.exec != null && o.exec !== "" ? Math.max(0, Math.round(+o.exec)) : n.plan;
      const pend = String(o.pend || "").trim();
      // pendência informada ou ponto não executado: não pode ficar como concluída
      const st = exec >= n.plan && !pend ? "concluida" : "parcial";
      const dia = o.data || (a.data > hoje ? hoje : agFim(a) < hoje ? agFim(a) : hoje);
      const hora = o.hora || (dia === hoje ? horaAgora() : a.hFim || "");
      const campos = { status: st, exec, conclusao: dia + "T" + (hora || "00:00"), obsConc: String(o.obs || "").trim(), pendTxt: pend, ptsExec: exe.map((x) => ptK(a, x)) };
      const txt = `${exec} de ${n.plan} ${n.plan === 1 ? "ponto executado" : "pontos executados"} em ${fmtD(dia)}${hora ? " " + hora : ""}${pend ? " · pendências: " + pend : ""}${campos.obsConc ? " · obs.: " + campos.obsConc : ""}`;
      return { a, m: agMudar(a, campos, st === "concluida" ? "concluída" : "concluída parcialmente", txt), keys: new Set(campos.ptsExec), dia, st };
    });
    if (!(await agGravar(R.map((r) => r.m)))) return false;
    let nA = 0;
    for (const r of R) nA += await agCrono(r.a, r.keys, "fim", r.dia);
    const np = R.filter((r) => r.st === "parcial").length;
    toast(`${R.length > 1 ? p1s(R.length, "programação finalizada", "programações finalizadas") : R[0].st === "concluida" ? "Atividade concluída" : "Execução parcial registrada"}${np && R.length > 1 ? ` (${np} parcial${np > 1 ? "s" : ""})` : ""}${nA ? ` · ${p1s(nA, "atividade concluída", "atividades concluídas")} no cronograma` : ""}.`);
    return true;
  }
  /* conclui um ponto da programação (os outros continuam em aberto); concluir o último conclui a programação.
     desfazer tira o ponto dos executados (as datas já lançadas no cronograma ficam) */
  async function agPonto(a, k, desfazer) {
    if (agFechado(a) || agSt(a) === "bloqueada") {
      toast(agSt(a) === "bloqueada" ? "Programação bloqueada: desbloqueie antes de concluir pontos." : "Esta programação já está finalizada.");
      return false;
    }
    const P = (a.pontos || []).filter((x) => !ptCanc(x));
    const x = P.find((y) => ptK(a, y) === k);
    if (!x || !(await agQuem())) return false;
    const hoje = todayISO();
    const ok = new Set((a.ptsExec || []).filter((y) => P.some((z) => ptK(a, z) === y)));
    desfazer ? ok.delete(k) : ok.add(k);
    const todos = P.every((y) => ok.has(ptK(a, y)));
    const dia = a.data > hoje ? hoje : agFim(a) < hoje ? agFim(a) : hoje;
    const em = agAgora();
    const quando = Object.assign({}, a.ptsExecEm || {});
    if (desfazer) delete quando[k];
    else quando[k] = em;
    const campos = { ptsExec: [...ok], ptsExecEm: quando, exec: ok.size };
    if (!desfazer && todos) Object.assign(campos, { status: "concluida", conclusao: dia + "T" + (dia === hoje ? horaAgora() : a.hFim || "00:00"), inicioExec: a.inicioExec || em });
    else if (ok.size && (agSt(a) === "planejada" || agSt(a) === "programada")) Object.assign(campos, { status: "andamento", inicioExec: a.inicioExec || em });
    const acao = desfazer ? "ponto reaberto" : todos ? "ponto concluído · programação concluída" : "ponto concluído";
    if (!(await agGravar([agMudar(a, campos, acao, `${x.nome}${desfazer ? "" : " em " + fmtD(dia)} · ${ok.size} de ${P.length} pontos executados`)]))) return false;
    const nA = desfazer ? 0 : await agCrono(a, new Set([k]), "fim", dia);
    toast(desfazer ? `${x.nome} voltou para pendente.` : `${x.nome} concluído (${ok.size}/${P.length})${todos ? " · programação concluída" : ""}${nA ? ` · ${p1s(nA, "atividade concluída", "atividades concluídas")} no cronograma` : ""}.`);
    return true;
  }
  /* cancela programações inteiras (ids = null) ou só algumas atividades (etapas) de uma programação */
  async function agCancelar(L, motivo, obs, ids) {
    const quem = await agQuem();
    if (!quem) return false;
    const em = agAgora();
    const ops = L.map((a) => {
      const P = a.pontos || [];
      const vivas = P.flatMap((x) => (x.ativ || []).filter((t) => !t.canc).map((t) => t.id));
      const tudo = !ids || vivas.every((id) => ids.has(id));
      const canc = Object.assign({ motivo, obs, em, por: quem }, tudo ? { todo: true } : {});
      const nomes = [];
      const pontos = P.map((x) =>
        Object.assign({}, x, {
          ativ: (x.ativ || []).map((t) => {
            if (t.canc || !(tudo || ids.has(t.id))) return t;
            nomes.push(x.nome + ": " + t.titulo);
            return Object.assign({}, t, { canc });
          }),
        }),
      );
      const campos = tudo ? { status: "cancelada", pontos, motivoCanc: motivo, obsCanc: obs, cancEm: em, cancPor: quem } : { pontos };
      return agMudar(a, campos, tudo ? "cancelada" : "etapa cancelada", motivo + (obs ? " · " + obs : "") + (tudo ? "" : " — " + nomes.join("; ")));
    });
    return agGravar(ops);
  }
  /* pendências (pontos não executados ou cancelados) numa nova programação ligada à original */
  function agReprogramar(a) {
    const st = agSt(a);
    const ok = new Set(a.ptsExec || []);
    const pts = (a.pontos || [])
      .map((x) => {
        const at = (x.ativ || []).filter((t) => st === "cancelada" || t.canc || (st === "parcial" && !ok.has(ptK(a, x))));
        return at.length ? Object.assign({}, x, { ativ: at.map((t) => ({ id: t.id, titulo: t.titulo })) }) : null;
      })
      .filter(Boolean);
    const dia = proxUtil(addDays(a.data > todayISO() ? a.data : todayISO(), 1));
    agForm({ equipe: a.equipe, pids: agPids(a), pontos: pts, data: dia, hIni: a.hIni, hFim: a.hFim, obs: a.obs, qtd: pts.length ? 0 : agNums(a).pend || a.qtd, origem: a.id });
  }
  /* cronograma do projeto: datas realizadas das atividades da programação (só preenche o que está vazio) */
  async function agCrono(a, keys, campo, dia) {
    let n = 0;
    for (const x of a.pontos || []) {
      if (keys && !keys.has(ptK(a, x))) continue;
      const p = projDe(ptPid(a, x));
      if (!p) continue;
      const base = p.id === "main" ? "" : `projetos/${p.id}/`;
      const ag = new Map(p.ag.map(({ i }) => [i.id, i]));
      for (const t of x.ativ || []) {
        const i = !t.canc && ag.get(t.id);
        if (!i) continue;
        if (campo === "ini") {
          if (i.inicioReal || i.fimReal) continue;
          await db.doc(base + "atividades/" + i.id).update({ inicioReal: dia, pctReal: 50 });
          i.inicioReal = dia;
        } else {
          if (i.fimReal) continue;
          const ini = i.inicioReal && i.inicioReal <= dia ? i.inicioReal : a.data <= dia ? a.data : dia;
          await db.doc(base + "atividades/" + i.id).update({ inicioReal: ini, fimReal: dia, pctReal: 100 });
          i.inicioReal = ini;
          i.fimReal = dia;
        }
        n++;
      }
    }
    if (n) PMO = null;
    return n;
  }
  /* ações em lote da visualização em lista */
  async function agLote(k, tec) {
    const L = [...AGSEL].map((id) => AGC.find((x) => x.id === id)).filter(Boolean);
    if (k === "limpa") {
      AGSEL.clear();
      return render();
    }
    if (!L.length) return toast("Selecione programações na lista.");
    if (k === "fin") {
      if (await agFinalizar(L)) AGSEL.clear();
    } else if (k === "tec") {
      const A = L.filter((a) => !agFechado(a));
      if (!A.length) return toast("As selecionadas já estão finalizadas ou canceladas.");
      if (!(await agConferir(A.map((x) => Object.assign({}, x, { equipe: tec, id: "" })), new Set(A.map((x) => x.id))))) return render();
      if (!(await agQuem())) return render();
      if (await agGravar(A.map((x) => agMudar(x, { equipe: tec }, "técnico substituído")))) {
        toast(`${tec} assume ${p1s(A.length, "programação", "programações")}.`);
        AGSEL.clear();
      }
    } else if (k === "excl") {
      if (!(await askConfirm(`Excluir ${p1s(L.length, "programação", "programações")}? Saem da agenda e dos indicadores; o registro e o histórico continuam guardados.`, "Excluir"))) return;
      if (!(await agQuem())) return;
      if (await agGravar(L.map((x) => agMudar(x, { excluida: true, excluidaEm: agAgora(), excluidaPor: agUser }, "excluída", "")))) {
        toast(`${p1s(L.length, "programação excluída", "programações excluídas")}.`);
        AGSEL.clear();
      }
    } else if (k === "canc") {
      const A = L.filter((a) => !agFechado(a));
      if (!A.length) return toast("As selecionadas já estão finalizadas ou canceladas.");
      pmoDialog(`<h3>Cancelar ${p1s(A.length, "programação", "programações")}</h3><p class="hint">${esc(A.map((x) => `${fmtD(x.data)} ${x.equipe}`).slice(0, 8).join(" · "))}${A.length > 8 ? " …" : ""}</p><div class="fgrid"><label>Motivo<select name="cm"><option value="">Escolha…</option>${AG_MOT.map((x) => `<option>${esc(x)}</option>`).join("")}</select></label><label>Observação complementar<input name="co"></label></div><p class="hint">Nada é apagado: os registros ficam no histórico e podem ser reprogramados.</p>`);
      const f = $("#formPmo");
      f.querySelector(".actions").innerHTML = `<button type="button" class="btn" data-pmclose>Voltar</button><button class="btn dangerfill" type="submit">Confirmar cancelamento</button>`;
      f.onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f).entries());
        if (!v.cm) return toast("Escolha o motivo.");
        if (v.cm === "Outros" && !(v.co || "").trim()) return toast("Descreva o motivo na observação.");
        if (!(await agCancelar(A, v.cm, (v.co || "").trim(), null))) return;
        $("#dlgPmo").close();
        AGSEL.clear();
        toast(`${p1s(A.length, "programação cancelada", "programações canceladas")}.`);
        render();
      };
      return;
    }
    render();
  }
  agPainelEventos();
  /* Painel PMO › Roteirização: projetos (vários) e pontos de projetos diferentes na mesma rota */
  function pmoRotaHTML() {
    const S = new Set(PM.rtProj);
    const comCoord = (p) => Object.values(p.vist || {}).some((v) => v && (v.coord || v.lat));
    const opts = PMO.projs.map((p) => [p.id, p.nome + (comCoord(p) ? "" : " (sem coordenadas)")]);
    const txt = !S.size ? "Escolha os projetos" : S.size === 1 ? (opts.find((o) => o[0] === [...S][0]) || ["", "1"])[1] : `${S.size} projetos`;
    const filtro = `<div class="pmbar pmfil"><div class="pmf">Projetos da rota<details class="msel" data-msel="rtProj" ${PM.msel === "rtProj" ? "open" : ""}><summary>${esc(txt)}</summary><div class="mlist">${S.size ? `<button type="button" class="mclr" data-mclr="rtProj">Limpar seleção</button>` : ""}${opts.map(([v, l]) => `<label><input type="checkbox" data-mv="rtProj" value="${esc(v)}" ${S.has(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div></details></div><p class="hint" style="margin:0">Os pontos precisam ter coordenadas (vistoria). Marque pontos de um ou mais projetos e calcule a menor rota a partir da DGT.</p></div>`;
    return `<section class="panel">${filtro}</section>${viewRota()}`;
  }
  /* exportação da agenda por técnico: PDF (uma página por técnico) e texto para WhatsApp/e-mail */
  // ponto digitado numa programação fora do painel, no formato das linhas da agenda
  const agLocLinha = (a, l, k) => {
    const lat = parseFloat(l.lat),
      lng = parseFloat(l.lng);
    return {
      a,
      quando: fmtD(a.data) + (agFim(a) !== a.data ? " a " + fmtD(agFim(a)) : ""),
      dia: DSEM[dt(a.data).getDay()],
      proj: a.projNome || "",
      projCurto: a.projNome || "",
      ponto: l.nome || "Ponto " + (k + 1),
      end: l.end || "",
      mapa: isFinite(lat) && isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : "",
      lat,
      lng,
      projObj: null,
      pn: "L" + (k + 1),
      v: { end: l.end || "", coord: isFinite(lat) && isFinite(lng) ? `${lat}, ${lng}` : "" },
      ativ: "",
      obs: a.obs || "",
      feito: agFeito(a),
      st: AG_ST[agSt(a)][0],
      hora: a.hIni ? a.hIni + (a.hFim ? "–" + a.hFim : "") : "",
    };
  };
  // onde cadastrar a coordenada que falta: vistoria do projeto ou o ponto da programação fora do painel
  const ondeCoord = (L) =>
    L.every((l) => l.a.avulso)
      ? "Informe as coordenadas nos pontos da programação (Editar)."
      : L.some((l) => l.a.avulso)
        ? "Cadastre na aba Vistoria do projeto ou, nos projetos fora do painel, nos pontos da programação."
        : "Cadastre as coordenadas na aba Vistoria do projeto.";
  function agLinhas(equipe, de, ate) {
    return AGC.filter((a) => agAtivo(a) && a.equipe === equipe && a.data <= ate && agFim(a) >= de)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
      .flatMap((a) => {
        if (a.avulso && (a.locais || []).length) return a.locais.map((l, k) => agLocLinha(a, l, k));
        return (a.pontos && a.pontos.length ? a.pontos : [{ nome: "", ativ: [] }]).map((x) => {
          const p = projDe(ptPid(a, x)) || agProj(a);
          const v = ((p && p.vist) || {})[x.pn] || {};
          const C = vCoord(v.coord, v.lat, v.lng);
          const lat = parseFloat(C.lat),
            lng = parseFloat(C.lng);
          return {
            a,
            quando: fmtD(a.data) + (agFim(a) !== a.data ? " a " + fmtD(agFim(a)) : ""),
            dia: DSEM[dt(a.data).getDay()],
            proj: p ? p.nome : a.projNome || "",
            projCurto: p ? nomeCurto(p) : a.projNome || "",
            ponto: x.nome || "",
            end: v.end || "",
            mapa: isFinite(lat) && isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : "",
            lat,
            lng,
            projObj: p,
            pn: x.pn,
            v,
            ativ: (x.ativ || []).map((t) => t.titulo).join("; "),
            obs: a.obs || "",
            feito: agFeito(a),
            st: AG_ST[agSt(a)][0],
            hora: a.hIni ? a.hIni + (a.hFim ? "–" + a.hFim : "") : "",
          };
        });
      });
  }
  function agTexto(equipe, de, ate) {
    const L = agLinhas(equipe, de, ate);
    if (!L.length) return `*Agenda de campo · ${equipe}*\n${fmtD(de)} a ${fmtD(ate)}\nSem programações no período.`;
    let txt = `*Agenda de campo · ${equipe}*\n${fmtD(de)} a ${fmtD(ate)}\n`;
    let dia = "";
    L.forEach((l) => {
      const cab = `${l.dia}, ${l.quando}`;
      if (cab !== dia) {
        txt += `\n*${cab}*\n`;
        dia = cab;
      }
      txt += `• ${l.hora ? l.hora + " · " : ""}${l.projCurto}${l.ponto ? " · " + l.ponto : ""}${l.feito ? ` (${l.st.toLowerCase()})` : ""}\n`;
      if (l.end) txt += `  Endereço: ${l.end}\n`;
      if (l.mapa) txt += `  Mapa: ${l.mapa}\n`;
      if (l.ativ) txt += `  Atividades: ${l.ativ}\n`;
      if (l.obs) txt += `  Obs.: ${l.obs}\n`;
    });
    return txt.trim();
  }
  /* mapa da rota para os PDFs: tiles do OpenStreetMap num canvas, trajeto pelas ruas (OSRM) e pontos
     numerados. Se a DGT estiver longe dos pontos, o mapa enquadra só os pontos (a saída fica indicada). */
  const lonX = (lng, z) => ((lng + 180) / 360) * 256 * 2 ** z;
  const latY = (lat, z) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z;
  };
  const tile = (z, x, y) =>
    new Promise((res) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      const t = setTimeout(() => res(null), 8000);
      im.onload = () => (clearTimeout(t), res(im));
      im.onerror = () => (clearTimeout(t), res(null));
      im.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    });
  async function mapaRota(seq, ret, W, H) {
    const pts = seq.filter((x) => x.pn != null);
    if (!pts.length) return null;
    const ida = seq.concat(ret && seq.length > 1 ? [seq[0]] : []);
    // trajeto pelas ruas (opcional)
    let geo = null,
      km = null,
      min = null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${ida.map((x) => x.lng.toFixed(6) + "," + x.lat.toFixed(6)).join(";")}?overview=full&geometries=geojson`, { signal: ctl.signal });
      const j = await r.json(); // o tempo limite vale também para a leitura da resposta
      clearTimeout(t);
      if (j.code === "Ok") {
        geo = j.routes[0].geometry.coordinates.map((c) => ({ lng: c[0], lat: c[1] }));
        km = j.routes[0].distance / 1000;
        min = j.routes[0].duration / 60;
      }
    } catch (e) {}
    // enquadramento: só os pontos quando a DGT está a mais de 3x o tamanho da área dos pontos
    const origem = seq.find((x) => x.pn == null);
    const diam = Math.max(...pts.map((a) => Math.max(...pts.map((b) => hav(a, b)))), 0.3);
    const longe = origem && Math.min(...pts.map((a) => hav(origem, a))) > 3 * diam;
    const quadro = longe ? pts : seq;
    const pad = 36;
    let z = 17;
    for (; z > 3; z--) {
      const xs = quadro.map((x) => lonX(x.lng, z)),
        ys = quadro.map((x) => latY(x.lat, z));
      if (Math.max(...xs) - Math.min(...xs) <= W - 2 * pad && Math.max(...ys) - Math.min(...ys) <= H - 2 * pad) break;
    }
    const xs = quadro.map((x) => lonX(x.lng, z)),
      ys = quadro.map((x) => latY(x.lat, z));
    const x0 = (Math.max(...xs) + Math.min(...xs)) / 2 - W / 2,
      y0 = (Math.max(...ys) + Math.min(...ys)) / 2 - H / 2;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    g.fillStyle = "#e8eef2";
    g.fillRect(0, 0, W, H);
    const n = 2 ** z;
    const T = [];
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W) / 256); tx++)
      for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H) / 256); ty++)
        if (ty >= 0 && ty < n) T.push(tile(z, ((tx % n) + n) % n, ty).then((im) => im && g.drawImage(im, tx * 256 - x0, ty * 256 - y0)));
    await Promise.all(T);
    const P = (x) => [lonX(x.lng, z) - x0, latY(x.lat, z) - y0];
    // trajeto
    g.lineJoin = "round";
    g.lineCap = "round";
    const linha = (L, cor, larg, tr) => {
      g.strokeStyle = cor;
      g.lineWidth = larg;
      g.setLineDash(tr ? [10, 8] : []);
      g.beginPath();
      L.forEach((x, k) => (k ? g.lineTo(...P(x)) : g.moveTo(...P(x))));
      g.stroke();
    };
    if (geo) {
      linha(geo, "rgba(255,255,255,.85)", 9);
      linha(geo, "#1f6fe0", 5);
    } else linha(ida, "#1f6fe0", 4, true);
    // pontos numerados na ordem da rota (menores quando são muitos)
    const raio = pts.length > 15 ? 11 : 15;
    seq.forEach((x, k) => {
      const [px, py] = P(x);
      if (px < -20 || py < -20 || px > W + 20 || py > H + 20) return;
      const o = x.pn == null;
      g.beginPath();
      g.arc(px, py, raio, 0, 2 * Math.PI);
      g.fillStyle = o ? "#1f2937" : "#1f6fe0";
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = "#fff";
      g.setLineDash([]);
      g.stroke();
      g.fillStyle = "#fff";
      g.font = `bold ${raio === 15 ? 15 : 11}px Arial`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(o ? "S" : String(k), px, py + 1);
    });
    g.font = "13px Arial";
    g.textAlign = "right";
    g.textBaseline = "bottom";
    g.fillStyle = "rgba(255,255,255,.85)";
    g.fillRect(W - 150, H - 20, 150, 20);
    g.fillStyle = "#333";
    g.fillText("© OpenStreetMap", W - 6, H - 4);
    return { url: cv.toDataURL("image/jpeg", 0.85), km, min, longe, dOrig: longe ? Math.min(...pts.map((a) => hav(origem, a))) : 0 };
  }
  async function rtMapaPDF(doc, seq, ret, mx, my, mw, mh) {
    let M = null;
    try {
      // nunca segura o PDF: se o mapa não ficar pronto em 25 s, usa o croqui
      M = await Promise.race([mapaRota(seq, ret, Math.round(mw * 9), Math.round(mh * 9)), new Promise((r) => setTimeout(() => r(null), 25000))]);
    } catch (e) {}
    if (!M) {
      rtCroqui(doc, seq, ret, mx, my, mw, mh);
      return null;
    }
    doc.addImage(M.url, "JPEG", mx, my, mw, mh);
    doc.setDrawColor(210);
    doc.rect(mx, my, mw, mh);
    doc.setFontSize(7.5);
    doc.setTextColor(100);
    const nota = [
      M.km != null ? `Trajeto pelas ruas: ${fmtN(M.km)} km (~${Math.floor(M.min / 60) ? Math.floor(M.min / 60) + " h " : ""}${Math.round(M.min % 60)} min, sem paradas)` : "Ligação em linha reta entre os pontos (trajeto pelas ruas indisponível)",
      M.longe ? `Saída e retorno na DGT, fora do mapa (~${fmtN(M.dOrig * RT_FAT)} km até o 1º ponto)` : "",
    ].filter(Boolean);
    nota.forEach((t, k) => doc.text(t.replace(/[·›]/g, "-"), mx, my + mh + 4 + k * 3.6));
    doc.setTextColor(0);
    return M;
  }
  /* tabela "informações dos pontos na ordem da rota" (relatório da roteirização e agenda do técnico):
     cada ponto com o projeto, endereço, coordenadas, câmeras/licenças da vistoria, modalidade de energia e link */
  function tabelaPontosRota(doc, pts, startY, numero, rota) {
    const pt = (t) => String(t == null ? "" : t).replace(/[·›]/g, "-");
    const pw = doc.internal.pageSize.getWidth();
    const modos = (x) => {
      const it = ((x.proj && x.proj.ag) || []).map((o) => o.i).filter((i) => i.ponto && +i.pacoteNum === +x.ponto);
      const m = (g) => {
        const L = it.filter((i) => grpOf(i) === g);
        if (!L.length) return "";
        const md = modeOf(L);
        return md === "simples" || !PMODES[g].opts[md] ? "" : PMODES[g].opts[md].l;
      };
      return [m("energia"), m("link")];
    };
    const T = { camVMS: 0, camCE: 0, licVMS: 0, licRF: 0, licAV: 0 };
    // rota = { trecho(x), saida: [linha], retorno: [linha] }: a coluna Trecho entra depois das coordenadas
    const tc = rota ? 1 : 0;
    const body = pts.map((x) => {
      const v = x.v || {};
      Object.keys(T).forEach((k) => (T[k] += rtNum(v[k])));
      return [
        String(numero(x)),
        pt(x.proj ? nomeCurto(x.proj) : x.l ? x.l.projCurto : ""),
        pt(x.pontoNome || x.nome),
        pt(v.end || ""),
        `${(+x.lat).toFixed(6)}, ${(+x.lng).toFixed(6)}`,
        ...(rota ? [rota.trecho(x)] : []),
        rtNum(v.camVMS),
        rtNum(v.camCE),
        rtNum(v.licVMS),
        rtNum(v.licRF),
        rtNum(v.licAV),
        ...modos(x),
        pt(v.obs || ""),
        "abrir",
      ];
    });
    // linha da tabela -> ponto (uma linha quebrada entre páginas chega ao gancho com índice -1)
    const ptDe = new Map(body.map((r, k) => [r, pts[k]]));
    const vazio = (n) => Array(n).fill("");
    const total = ["", "Total", "", "", "", ...vazio(tc), T.camVMS, T.camCE, T.licVMS, T.licRF, T.licAV, "", "", "", ""];
    if (rota) {
      body.unshift(rota.saida.concat(vazio(14 + tc - rota.saida.length)));
      body.push(rota.retorno.concat(vazio(14 + tc - rota.retorno.length)));
    }
    body.push(total);
    const cMapa = 13 + tc;
    const cs = {
      0: { cellWidth: 7 },
      1: { cellWidth: 26 },
      4: { cellWidth: 26 },
      [5 + tc]: { halign: "center", cellWidth: 10 },
      [6 + tc]: { halign: "center", cellWidth: 10 },
      [7 + tc]: { halign: "center", cellWidth: 10 },
      [8 + tc]: { halign: "center", cellWidth: 13 },
      [9 + tc]: { halign: "center", cellWidth: 11 },
      [cMapa]: { cellWidth: 11 },
    };
    if (tc) cs[5] = { cellWidth: 16, halign: "right" };
    doc.autoTable({
      startY,
      head: [["#", "Projeto", "Ponto", "Endereço", "Coordenadas", ...(rota ? ["Trecho"] : []), "Câm. VMS", "Câm. CE", "Lic. VMS", "Lic. Rec. Facial", "Lic. Análise", "Energia", "Link", "Observação", "Mapa"]],
      body,
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [30, 43, 58], halign: "center" },
      columnStyles: cs,
      didParseCell: (d) => {
        if (d.section === "body" && d.row.raw === total) {
          d.cell.styles.fontStyle = "bold";
          d.cell.styles.fillColor = [230, 237, 244];
        }
        if (d.section === "body" && rota && (d.row.raw === body[0] || d.row.raw === body[body.length - 2])) d.cell.styles.textColor = [90, 90, 90];
        if (d.section === "body" && d.column.index === cMapa && ptDe.get(d.row.raw)) d.cell.styles.textColor = [43, 106, 140];
      },
      didDrawCell: (d) => {
        const x = d.section === "body" && d.column.index === cMapa && ptDe.get(d.row.raw);
        if (x) doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url: svUrl(x.lat, x.lng) });
      },
      didDrawPage: () => {
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, pw - 20, doc.internal.pageSize.getHeight() - 5);
        doc.setTextColor(0);
      },
    });
  }
  function rtCroqui(doc, s, ret, mx, my, mw, mh) {
    doc.setDrawColor(210);
    doc.rect(mx, my, mw, mh);
    const lats = s.map((x) => x.lat),
      lngs = s.map((x) => x.lng);
    const la0 = Math.min(...lats),
      la1 = Math.max(...lats),
      lo0 = Math.min(...lngs),
      lo1 = Math.max(...lngs);
    const kk = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
    const sx = (lo1 - lo0) * kk || 0.001,
      sy = la1 - la0 || 0.001;
    const pad = 6;
    const sc = Math.min((mw - 2 * pad) / sx, (mh - 2 * pad) / sy);
    const X = (l) => mx + pad + (l - lo0) * kk * sc + (mw - 2 * pad - sx * sc) / 2,
      Y = (l) => my + mh - pad - (l - la0) * sc - (mh - 2 * pad - sy * sc) / 2;
    doc.setDrawColor(43, 106, 140);
    doc.setLineWidth(0.5);
    for (let k = 1; k < s.length; k++) doc.line(X(s[k - 1].lng), Y(s[k - 1].lat), X(s[k].lng), Y(s[k].lat));
    if (ret && s.length > 2) doc.line(X(s[s.length - 1].lng), Y(s[s.length - 1].lat), X(s[0].lng), Y(s[0].lat));
    s.forEach((x, k) => {
      doc.setFillColor(k === 0 ? 46 : 255, k === 0 ? 125 : 255, k === 0 ? 79 : 255);
      doc.circle(X(x.lng), Y(x.lat), 2.4, "FD");
      doc.setFontSize(6);
      doc.setTextColor(k === 0 ? 255 : 0);
      doc.text(k === 0 ? "S" : String(k), X(x.lng), Y(x.lat) + 0.9, { align: "center" });
    });
    doc.setTextColor(100);
    doc.setLineWidth(0.2);
    doc.setFontSize(7.5);
    doc.text("Croqui da sequência (proporcional às coordenadas, sem escala viária).", mx, my + mh + 4);
    doc.setTextColor(0);
  }
  async function agPDF(equipes, de, ate) {
    if (!downloads) return toast("Exportação indisponível neste ambiente.");
    toast("Gerando a agenda…");
    try {
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await loadJS("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const semRota = [];
      const pt = (t) => String(t == null ? "" : t).replace(/[·›]/g, "-");
      for (const [k, eq] of equipes.entries()) {
        if (k) doc.addPage();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(pt(`Agenda de campo - ${eq}`), 10, 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90);
        const L = agLinhas(eq, de, ate);
        // período = da primeira à última data das programações listadas
        const p0 = L.length ? L.map((l) => l.a.data).sort()[0] : de,
          p1 = L.length ? L.map((l) => agFim(l.a)).sort().pop() : ate;
        doc.text(pt(`Período ${fmtD(p0)}${p1 !== p0 ? " a " + fmtD(p1) : ""} - DGT Tecnologia - Implantação - emitido em ${fmtD(todayISO())}`), 10, 17.5);
        doc.setTextColor(0);
        doc.autoTable({
          startY: 22,
          head: [["Data", "Projeto", "Ponto", "Endereço", "Atividades", "Obs.", "Situação"]],
          body: L.length
            ? L.map((l) => [`${l.dia} ${l.quando}`, pt(l.proj), pt(l.ponto), pt(l.end), pt(l.ativ), pt(l.obs), pt(l.st)])
            : [["", "Sem programações no período", "", "", "", "", ""]],
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 1.5, valign: "top" },
          headStyles: { fillColor: [30, 43, 58] },
          columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 42 }, 2: { cellWidth: 30 }, 3: { cellWidth: 55 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20 } },
          didDrawCell: (c) => {
            // endereço com link para o mapa do ponto
            const l = L[c.row.index];
            if (c.section === "body" && c.column.index === 3 && l && l.mapa) doc.link(c.cell.x, c.cell.y, c.cell.width, c.cell.height, { url: l.mapa });
          },
        });
        // rota de cada dia: saída da DGT, menor sequência entre os pontos com coordenadas e retorno
        const dias = [...new Set(L.map((l) => l.a.data))].sort();
        // dias com pontos sem coordenada na vistoria: a rota não sai (ou sai sem esses pontos) e o PDF avisa
        const semC = L.filter((l) => l.pn != null && !(isFinite(l.lat) && isFinite(l.lng)));
        if (semC.length) {
          const porProj = [...new Set(semC.map((l) => l.projCurto))];
          const dSem = [...new Set(semC.map((l) => l.a.data))].sort();
          const aviso = pt(`Rota: ${semC.length} ponto${semC.length > 1 ? "s" : ""} sem coordenadas (${porProj.join(", ")}) em ${dSem.map(fmtD).join(", ")}. ${dSem.every((d) => !L.some((l) => l.a.data === d && isFinite(l.lat) && isFinite(l.lng))) ? "Esses dias ficaram sem rota." : "Esses pontos ficaram fora da rota."} ${ondeCoord(semC)}`);
          doc.setFontSize(9);
          doc.setTextColor(179, 38, 30);
          doc.text(doc.splitTextToSize(aviso, 277), 10, doc.lastAutoTable.finalY + 7);
          doc.setTextColor(0);
          semRota.push(...porProj);
        }
        for (const dia of dias) {
          const vistos = new Set();
          const nos = L.filter((l) => l.a.data === dia && isFinite(l.lat) && isFinite(l.lng)).filter((l) => {
            const k = l.lat + "," + l.lng;
            if (vistos.has(k)) return false;
            vistos.add(k);
            return true;
          });
          if (!nos.length) continue;
          const base = { pn: null, nome: RT_BASE.nome, lat: RT_BASE.lat, lng: RT_BASE.lng, v: { end: RT_BASE.end } };
          const nodes = [base].concat(nos.map((l) => ({ pn: l.ponto, nome: `${l.projCurto} · ${l.ponto}`, pontoNome: l.ponto, proj: l.projObj, ponto: l.pn, v: l.v, lat: l.lat, lng: l.lng, l })));
          const S0 = rtSolve(nodes, true);
          const seq = S0.ord.map((k) => nodes[k]);
          const legs = seq.map((x, k) => (k ? hav(seq[k - 1], x) : 0));
          legs.push(hav(seq[seq.length - 1], seq[0]));
          const tot = legs.reduce((a, b) => a + b, 0);
          doc.addPage();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.text(pt(`Rota de ${DSEM[dt(dia).getDay()]}, ${fmtD(dia)} - ${eq}`), 10, 12);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(90);
          doc.text(pt(`Saída e retorno: DGT Tecnologia - ${nos.length} ponto${nos.length > 1 ? "s" : ""} - ~${fmtN(tot * RT_FAT)} km estimados (linha reta ${fmtN(tot)} km x ${String(RT_FAT).replace(".", ",")})`), 10, 17.5);
          doc.setTextColor(0);
          // pontos na ordem da rota, com o trecho de cada um (sem mapa)
          const ord = seq.filter((x) => x.pn != null);
          const km = (k) => "~" + fmtN(legs[k] * RT_FAT) + " km";
          tabelaPontosRota(doc, ord, 22, (x) => seq.indexOf(x), {
            trecho: (x) => km(seq.indexOf(x)),
            saida: ["S", "DGT Tecnologia (saída)", "", pt(RT_BASE.end), "", "saída"],
            retorno: ["R", "Retorno à DGT", "", "", "", km(legs.length - 1)],
          });
          // links do Google Maps (até 10 paradas por link)
          const ida = seq.concat([seq[0]]);
          let y = doc.lastAutoTable.finalY + 6;
          doc.setFontSize(9);
          for (let i = 0, t = 1; i < ida.length - 1; i += 9, t++) {
            const parte = ida.slice(i, i + 10);
            const url = "https://www.google.com/maps/dir/" + parte.map((x) => `${x.lat},${x.lng}`).join("/");
            doc.setTextColor(43, 106, 140);
            doc.textWithLink(pt(`Abrir rota no Google Maps${ida.length > 10 ? " - trecho " + t : ""}`), 10, y, { url });
            y += 5;
          }
          doc.setTextColor(0);
        }
      }
      const nome = equipes.length === 1 ? normNome(equipes[0]).replace(/[^a-z0-9]+/g, "-") : "equipes";
      await downloads.save({ filename: `agenda-${nome}-${de}-a-${ate}.pdf`, data: doc.output("blob") });
      if (semRota.length) toast(`Agenda baixada, mas sem rota para pontos sem coordenadas na vistoria: ${[...new Set(semRota)].join(", ")}.`);
    } catch (e) {
      toast("Não foi possível gerar o PDF: " + ((e && e.message) || e));
    }
  }
  function agExportar() {
    const dias = eqRange();
    const T = equipesCampo();
    pmoDialog(`<h3>Exportar agenda por técnico</h3>
      <div class="fgrid">
        <label>Técnico / equipe<select name="eq"><option value="">Todos (uma página por técnico)</option>${T.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
        <label>De<input type="date" name="de" value="${dias[0]}"></label>
        <label>Até<input type="date" name="ate" value="${dias[dias.length - 1]}"></label>
      </div>
      <p class="hint">O PDF traz a agenda (data, projeto, ponto, endereço com link para o mapa, atividades e observações) e, para cada dia, a rota a partir da DGT: ordem dos pontos, quilometragem estimada, croqui e links do Google Maps. O texto é para colar no WhatsApp ou no e-mail do técnico.</p>
      <p class="hint bad" id="agRotaAv" hidden></p>
      <textarea id="agTxt" class="agtxt" readonly rows="9" aria-label="Texto da agenda"></textarea>`);
    const f = $("#formPmo");
    f.querySelector(".actions").innerHTML = `<button type="button" class="btn" data-pmclose>Fechar</button><button type="button" class="btn" data-agcopiar>Copiar texto</button><button type="button" class="btn primary" data-agpdf>Baixar PDF</button>`;
    const val = () => {
      const d = Object.fromEntries(new FormData(f).entries());
      const de = d.de || dias[0],
        ate = d.ate && d.ate >= de ? d.ate : de;
      return { eqs: d.eq ? [d.eq] : T, de, ate };
    };
    const prev = () => {
      const v = val();
      $("#agTxt").value = v.eqs.map((e) => agTexto(e, v.de, v.ate)).join("\n\n");
      // a rota do dia precisa das coordenadas dos pontos (vistoria do projeto)
      const sem = v.eqs.flatMap((e) => agLinhas(e, v.de, v.ate)).filter((l) => l.pn != null && !(isFinite(l.lat) && isFinite(l.lng)));
      const av = $("#agRotaAv");
      av.hidden = !sem.length;
      av.textContent = sem.length ? `Sem rota para ${sem.length} ponto${sem.length > 1 ? "s" : ""}: faltam as coordenadas em ${[...new Set(sem.map((l) => l.projCurto))].join(", ")}. A agenda sai normalmente. ${ondeCoord(sem)}` : "";
    };
    prev();
    f.onchange = prev;
    f.onclick = async (e) => {
      const v = val();
      if (e.target.closest("[data-agpdf]")) agPDF(v.eqs, v.de, v.ate);
      else if (e.target.closest("[data-agcopiar]")) {
        if (await copiarTexto($("#agTxt").value)) toast("Texto copiado.");
        else {
          $("#agTxt").select();
          toast("Selecione e copie o texto (Ctrl+C).");
        }
      }
    };
  }
  /* ---------- Assistente IA (tools/assistente.py, via servidor) ---------- */
  const IA = { conversa: [], busy: false, rascunho: "" };
  const IA_SUGESTOES = [
    "Faça um resumo executivo da carteira, por PMO do projeto.",
    "Quais projetos estão com o limite de implantação vencido e qual o próximo passo de cada um?",
    "Liste as atividades atrasadas da Implantação nos próximos 15 dias, por projeto.",
    "Resuma a situação do projeto 10381: andamento, pontos, faturamento e pendências.",
    "Como está o faturamento: contratado x faturado por projeto?",
  ];
  function iaHTML() {
    return `<section class="panel" id="iaBox"><div class="panel-h"><h2>Assistente IA</h2><span class="iabtns"><button type="button" class="ico iafixar" data-iafixar title="Fixar o assistente ao lado da tela" aria-label="Fixar o assistente" aria-pressed="false">${SIC.pino}</button><button type="button" class="ico iafechar" data-iafechar title="Fechar (Esc)" aria-label="Fechar o assistente">×</button></span><span class="note">Pergunte sobre os projetos; a resposta é montada com os dados do painel (Claude, Anthropic)</span></div>
      <div class="iasug">${IA_SUGESTOES.map((t) => `<button class="lg" data-iasug="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <div id="iaConv" class="iaconv"></div>
      <div class="iain"><textarea id="iaTxt" rows="3" placeholder="Ex.: Quais pontos do 10792 estão atrasados e com qual responsável?" aria-label="Pergunta ao assistente"></textarea>
      <div class="iaacts"><span class="mut">Ctrl+Enter envia</span><button class="btn ghost" data-ianova>Nova conversa</button><button class="btn primary" data-iaenviar>Perguntar</button></div></div></section>`;
  }
  function iaAtualizar() {
    const c = document.getElementById("iaConv");
    if (!c) return;
    // sugestões só antes da primeira pergunta (voltam em "Nova conversa")
    const sg = document.querySelector("#iaBox .iasug");
    if (sg) sg.hidden = IA.conversa.length > 0 || IA.busy;
    c.innerHTML =
      IA.conversa
        .map((m, k) =>
          m.role === "user"
            ? `<div class="iamsg iau"><b>Pergunta</b><p>${esc(m.texto)}</p></div>`
            : `<div class="iamsg iaa ${m.erro ? "err" : ""}"><div class="iamd">${m.erro ? esc(m.texto) : md2html(m.texto)}</div>${m.erro ? "" : `<button class="btn ghost" data-iacopiar="${k}">Copiar texto</button>`}</div>`,
        )
        .join("") +
      (IA.busy ? `<div class="iamsg iaa"><span class="spin"></span> Consultando os dados do painel…</div>` : "");
    const t = document.getElementById("iaTxt");
    if (t && !t.value && IA.rascunho) t.value = IA.rascunho;
    const b = document.querySelector("[data-iaenviar]");
    if (b) b.disabled = IA.busy;
    c.scrollTop = c.scrollHeight;
  }
  /* panorama da carteira calculado pelo painel (situação, físico, SPI, prazos) para o assistente */
  function iaCarteira() {
    return (CART || []).map((x) => ({
      id: x.id,
      situacao: x.encerrado ? "Encerrado" : x.st && x.st[1],
      real: x.real == null ? null : Math.round(x.real * 1000) / 10,
      plan: x.plan == null ? null : Math.round(x.plan * 1000) / 10,
      spi: x.spi == null ? null : Math.round(x.spi * 100) / 100,
      tad: x.tad || "",
      lim: x.lim || "",
      folga: x.folga,
      atraso_dias_limite: x.atraso,
    }));
  }
  async function iaEnviar(texto) {
    texto = String(texto || "").trim();
    if (!texto || IA.busy) return;
    const historico = IA.conversa.filter((m) => !m.erro).map((m) => ({ role: m.role, texto: m.texto }));
    IA.conversa.push({ role: "user", texto });
    IA.busy = true;
    IA.rascunho = "";
    const t = document.getElementById("iaTxt");
    if (t) t.value = "";
    iaAtualizar();
    try {
      if (!CART && db) await loadCarteira(true);
      const r = await fetch("api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: texto, historico, carteira: iaCarteira() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || "O servidor respondeu " + r.status);
      IA.conversa.push({ role: "assistant", texto: j.texto });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      IA.conversa.push({ role: "assistant", texto: msg, erro: true });
    }
    IA.busy = false;
    iaAtualizar();
  }
  /* Markdown simples da resposta (títulos, listas, negrito, tabelas) em HTML seguro */
  function md2html(md) {
    const inl = (s) =>
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>")
        .replace(/(^|\s)_([^_]+)_(?=\s|$|[.,;:])/g, "$1<i>$2</i>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
    const L = String(md || "").replace(/\r/g, "").split("\n");
    const ehLinhaTabela = (l) => /^\s*\|.*\|\s*$/.test(l);
    let out = "",
      lista = "";
    const fecha = () => {
      if (lista) out += `</${lista}>`;
      lista = "";
    };
    for (let k = 0; k < L.length; k++) {
      const l = L[k];
      if (ehLinhaTabela(l)) {
        fecha();
        const rows = [];
        while (k < L.length && ehLinhaTabela(L[k])) rows.push(L[k++]);
        k--;
        const cel = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const sep = rows[1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(rows[1]);
        const corpo = sep ? rows.slice(2) : rows.slice(1);
        out += `<div class="tw"><table class="crono ftb"><thead><tr>${cel(rows[0]).map((c) => `<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${corpo.map((r) => `<tr class="child">${cel(r).map((c) => `<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        continue;
      }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
        fecha();
        const n = Math.min(4, m[1].length + 1);
        out += `<h${n}>${inl(m[2])}</h${n}>`;
      } else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) {
        if (lista !== "ul") {
          fecha();
          out += "<ul>";
          lista = "ul";
        }
        out += `<li>${inl(m[1])}</li>`;
      } else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) {
        if (lista !== "ol") {
          fecha();
          out += "<ol>";
          lista = "ol";
        }
        out += `<li>${inl(m[1])}</li>`;
      } else if (/^\s*(---|\*\*\*)\s*$/.test(l)) {
        fecha();
        out += "<hr>";
      } else if (l.trim()) {
        fecha();
        out += `<p>${inl(l)}</p>`;
      } else fecha();
    }
    fecha();
    return out;
  }
  /* botão fixo no canto superior direito: abre o assistente em painel lateral em qualquer tela;
     a conversa fica guardada ao fechar e reabrir */
  // fixado: fica aberto ao lado da página (sem escurecer o fundo) e a escolha é lembrada neste navegador
  const IA_FIXO_KEY = "pmo-hibrido-iafixo";
  let iaFixo = (() => {
    try {
      return localStorage.getItem(IA_FIXO_KEY) === "1";
    } catch (e) {
      return false;
    }
  })();
  function iaMostrar() {
    const d = $("#dlgIa"),
      host = $("#iaHost");
    if (!d || !host) return;
    if (!host.firstChild) host.innerHTML = iaHTML();
    if (d.open) d.close();
    d.classList.toggle("fixo", iaFixo);
    document.body.classList.toggle("iafixo", iaFixo);
    const b = host.querySelector("[data-iafixar]");
    if (b) {
      b.setAttribute("aria-pressed", iaFixo ? "true" : "false");
      b.title = iaFixo ? "Desafixar (volta a abrir por cima da tela)" : "Fixar o assistente ao lado da tela";
    }
    iaAtualizar();
    if (iaFixo) d.show();
    else d.showModal();
    const t = document.getElementById("iaTxt");
    if (t) t.focus();
  }
  function iaAbrir() {
    const d = $("#dlgIa");
    if (!d) return;
    if (d.open) {
      if (iaFixo) iaFixar(false);
      return d.close();
    }
    iaMostrar();
  }
  function iaFixar(v) {
    iaFixo = v;
    try {
      localStorage.setItem(IA_FIXO_KEY, v ? "1" : "0");
    } catch (e) {}
  }
  if ($("#iaFab")) $("#iaFab").addEventListener("click", iaAbrir);
  if ($("#dlgIa")) {
    $("#dlgIa").addEventListener("click", (e) => {
      if (e.target.closest("[data-iafixar]")) {
        iaFixar(!iaFixo);
        return iaMostrar();
      }
      if (e.target.closest("[data-iafechar]")) {
        if (iaFixo) iaFixar(false); // fechar desafixa; o botão do canto abre de novo
        return $("#dlgIa").close();
      }
      if (e.target === e.currentTarget && !iaFixo) $("#dlgIa").close(); // clique fora do painel
    });
    // o evento chega depois: ao trocar de modo (fecha e reabre) o painel já está aberto de novo
    $("#dlgIa").addEventListener("close", () => {
      if (!$("#dlgIa").open) document.body.classList.remove("iafixo");
    });
    if (iaFixo) iaMostrar();
  }
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      iaAbrir();
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("#iaBox")) return;
    let b;
    if ((b = e.target.closest("[data-iasug]"))) iaEnviar(b.dataset.iasug);
    else if (e.target.closest("[data-iaenviar]")) iaEnviar((document.getElementById("iaTxt") || {}).value);
    else if (e.target.closest("[data-ianova]")) {
      IA.conversa = [];
      iaAtualizar();
    } else if ((b = e.target.closest("[data-iacopiar]"))) {
      const m = IA.conversa[+b.dataset.iacopiar];
      // texto limpo (sem as marcações **, #, `) para colar em e-mail, Teams etc.
      const limpo = (s) =>
        String(s || "")
          .split("\n")
          .filter((l) => !/^\s*\|?\s*:?-{3,}/.test(l))
          .map((l) =>
            l
              .replace(/^\s{0,3}#{1,6}\s+/, "")
              .replace(/^(\s*)[-*]\s+/, "$1• ")
              .replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2")
              .replace(/`([^`]+)`/g, "$1")
              .replace(/^\s*\|(.*)\|\s*$/, (x, c) => c.split("|").map((y) => y.trim()).join("\t")),
          )
          .join("\n");
      if (m)
        copiarTexto(limpo(m.texto)).then((ok) => {
          toast(ok ? "Texto copiado." : "Não foi possível copiar.");
          if (ok) {
            b.textContent = "Copiado ✓";
            setTimeout(() => (b.textContent = "Copiar texto"), 1800);
          }
        });
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "iaTxt") IA.rascunho = e.target.value;
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.id === "iaTxt" && e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      iaEnviar(e.target.value);
    }
  });
  function pmoMover(n) {
    const c = pmoCur();
    if (PM.modo === "mes") {
      const [y, m] = c.split("-").map(Number);
      const d = new Date(y, m - 1 + n, 1);
      PM.cur = iso(d);
    } else PM.cur = addDays(c, n * (PM.modo === "semana" ? 7 : 30));
  }
  function pmoAchar(id) {
    const E = pmoEventos();
    return E.find((e) => e.id === id) || (PMO ? PMO.ev.find((e) => e.id === id) : null);
  }
  function pmoDialog(html) {
    const d = $("#dlgPmo"),
      f = $("#formPmo");
    f.onsubmit = (e) => e.preventDefault();
    f.onclick = null;
    f.onchange = null;
    f.innerHTML = html + `<div class="actions"><button type="button" class="btn" data-pmclose>Fechar</button></div>`;
    if (!d.open) d.showModal();
  }
  function pmoDetalhe(e) {
    const st = e.done ? ["c", "Concluída"] : e.late ? ["r", "Atrasada"] : e.a <= todayISO() ? ["a", "Em execução"] : ["n", "A iniciar"];
    const lista = e.itens
      ? `<ul class="pmlist">${e.itens
          .slice()
          .sort((x, y) => (+x.i.seq || 0) - (+y.i.seq || 0))
          .map((x) => `<li><span class="chip ${x.done ? "c" : x.late ? "r" : "n"}">${x.done ? "ok" : x.late ? "atraso" : "aberta"}</span> ${esc(x.titulo)} <small>${fmtD(x.a)} – ${fmtD(x.b)}${x.resp ? " · " + esc(x.resp) : ""}</small></li>`)
          .join("")}</ul>`
      : `<p class="hint">Realizado: ${e.i.inicioReal ? fmtD(e.i.inicioReal) : "–"} a ${e.i.fimReal ? fmtD(e.i.fimReal) : "–"}${e.i.obs ? " · " + esc(e.i.obs) : ""}</p>`;
    pmoDialog(`<h3>${esc(e.titulo)}</h3><p class="hint" style="color:var(--ink)"><b>${esc(e.proj.nome)}</b><br>${esc(e.fase)}${e.pac && e.pac !== e.titulo ? " › " + esc(e.pac) : ""}</p>
      <p class="hint"><span class="chip ${st[0]}">${st[1]}</span> Planejado ${fmtD(e.a)} – ${fmtD(e.b)}${e.resp ? " · " + esc(e.resp) : ""}</p>${lista}
      <p><button type="button" class="btn primary" data-pmabrir="${esc(e.pid)}">Abrir cronograma do projeto</button></p>`);
  }
  function pmoDia(d, pid) {
    const E = pmoEventos()
      .filter((e) => diaUtil(d) && e.a <= d && e.b >= d && (!pid || e.pid === pid))
      .sort((x, y) => (+x.proj.cod || 1e9) - (+y.proj.cod || 1e9) || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    const grupos = new Map();
    E.forEach((e) => {
      if (!grupos.has(e.pid)) grupos.set(e.pid, []);
      grupos.get(e.pid).push(e);
    });
    const item = (e) =>
      `<li><button type="button" class="agi ${e.done ? "done" : ""} ${e.late ? "late" : ""}" style="--c:${e.proj.cor}" data-pmev="${esc(e.id)}"><i></i><span class="agt"><b>${esc(e.titulo)}</b><small>${esc(e.fase.replace(/^Frente\s*\d+\s*·\s*/, ""))}${e.pac && e.pac !== e.titulo ? " · " + esc(e.pac) : ""}${e.resp ? " · " + esc(e.resp) : ""}</small></span><span class="agp">${fmtD(e.a)} – ${fmtD(e.b)}</span></button></li>`;
    const corpo = [...grupos.values()]
      .map((L) => {
        const p = L[0].proj;
        const late = L.filter((e) => e.late).length;
        return `<div class="diag"><div class="diagh" style="--c:${p.cor}"><i></i><b>${esc(p.nome)}</b><span>${L.length} ${L.length === 1 ? "atividade" : "atividades"}${late ? ` · ${late} atrasada${late > 1 ? "s" : ""}` : ""}</span><button type="button" class="btn ghost" data-pmabrir="${esc(p.id)}">Abrir cronograma</button></div><ul>${L.map(item).join("")}</ul></div>`;
      })
      .join("");
    const titulo = pid && E[0] ? ` · ${esc(E[0].proj.nome)}` : "";
    pmoDialog(`<h3>${DSEM[dt(d).getDay()]}, ${fmtD(d)}${titulo}</h3><p class="hint">${E.length} ${E.length === 1 ? "atividade" : "atividades"}${pid ? "" : ` em ${grupos.size} ${grupos.size === 1 ? "projeto" : "projetos"}`}${pid ? ` · <button type="button" class="btn ghost" data-pmdia="${d}">ver todos os projetos do dia</button>` : ""}</p><div class="agenda">${corpo || "<p class='ok-msg'>Nenhuma atividade neste dia com os filtros atuais.</p>"}</div>`);
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-pmo]")) {
      location.hash = "pmo";
      return;
    }
    if (t.closest("[data-pmclose]")) {
      $("#dlgPmo").close();
      return;
    }
    let b;
    if ((b = t.closest("[data-pmabrir]"))) {
      const id = b.dataset.pmabrir;
      if ($("#dlgPmo").open) $("#dlgPmo").close();
      if (db && id !== PID) connect(id);
      location.hash = "g3";
      return;
    }
    if (view !== "pmo") return;
    if (t.closest("[data-pmref]")) {
      PMO = null;
      render();
    } else if ((b = t.closest("[data-pmtab]"))) {
      PM.tab = b.dataset.pmtab;
      savePM();
      render();
    } else if ((b = t.closest("[data-pmmodo]"))) {
      PM.modo = b.dataset.pmmodo;
      savePM();
      render();
    } else if ((b = t.closest("[data-pmnav]"))) {
      if (b.dataset.pmnav === "hoje") PM.cur = "";
      else pmoMover(+b.dataset.pmnav);
      render();
    } else if ((b = t.closest("[data-pmproj]"))) {
      PM.proj = PM.proj.includes(b.dataset.pmproj) ? PM.proj.filter((x) => x !== b.dataset.pmproj) : PM.proj.concat(b.dataset.pmproj);
      savePM();
      render();
    } else if ((b = t.closest("[data-eqnav]"))) {
      const n = +b.dataset.eqnav;
      const modo = PM.eqModo || "semana";
      if (b.dataset.eqnav === "hoje") {
        PM.eqIni = "";
        PM.eqDe = PM.eqAte = "";
      } else if (modo === "lista") {
        // a lista anda o tamanho do período escolhido
        const [de, ate] = eqRange();
        const n0 = Math.round((dt(ate) - dt(de)) / 864e5) + 1;
        PM.eqDe = addDays(de, n * n0);
        PM.eqAte = addDays(ate, n * n0);
        PM.eqIni = PM.eqDe;
      } else if (modo === "mes") {
        const [y, m] = eqCur().split("-").map(Number);
        PM.eqIni = iso(new Date(y, m - 1 + n, 1));
      } else PM.eqIni = addDays(eqCur(), n * (modo === "semana" ? 7 : 30));
      render();
    } else if ((b = t.closest("[data-eqmodo]"))) {
      PM.eqModo = b.dataset.eqmodo;
      savePM();
      render();
    } else if ((b = t.closest("[data-agexp]"))) {
      agExportar();
    } else if ((b = t.closest("[data-agfin]")) && view === "pmo") {
      const a = AGC.find((x) => x.id === b.dataset.agfin);
      if (a) agFinalizar([a]);
    } else if ((b = t.closest("[data-agid]")) && view === "pmo") {
      if (AGC.some((x) => x.id === b.dataset.agid)) agPainel(b.dataset.agid);
    } else if ((b = t.closest("[data-agnovo]")) && view === "pmo") {
      const [equipe, data] = b.dataset.agnovo.split("|");
      agForm({ equipe: equipe || "", data: data || todayISO(), pids: PM.proj.slice() });
    } else if ((b = t.closest("[data-agdia]"))) {
      agDiaDlg(b.dataset.agdia);
    } else if ((b = t.closest("[data-agbat]"))) {
      agLote(b.dataset.agbat);
    } else if ((b = t.closest("[data-aguser]"))) {
      agQuem(true).then(() => render());
    } else if ((b = t.closest("[data-pmesc]"))) {
      PM.escopo = b.dataset.pmesc;
      savePM();
      render();
    } else if ((b = t.closest("[data-mclr]"))) {
      PM[b.dataset.mclr] = [];
      savePM();
      render();
    } else if ((b = t.closest("[data-eqedit]"))) {
      b.dataset.eqedit === "campo" ? openEquipesCampo() : openEquipe();
    } else if ((b = t.closest("[data-pmver]"))) {
      PM.pessoa = [b.dataset.pmver];
      PM.tab = "cal";
      savePM();
      render();
    } else if ((b = t.closest("[data-pmev]"))) {
      const ev = pmoAchar(b.dataset.pmev);
      if (ev) pmoDetalhe(ev);
    } else if ((b = t.closest("[data-pmdia]"))) {
      pmoDia(b.dataset.pmdia, b.dataset.pmdp || "");
    }
  });
  // listas com várias escolhas: a lista fica aberta enquanto se marca; fecha ao clicar fora
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details.msel")) return;
    if (d.open) {
      PM.msel = d.dataset.msel;
      document.querySelectorAll("details.msel[open]").forEach((x) => x !== d && (x.open = false));
    } else if (PM.msel === d.dataset.msel) PM.msel = "";
  }, true);
  document.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest("details.msel")) return;
    document.querySelectorAll("details.msel[open]").forEach((x) => (x.open = false));
    PM.msel = "";
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.matches && t.matches("[data-mv]")) {
      const k = t.dataset.mv;
      PM[k] = t.checked ? [...new Set(PM[k].concat(t.value))] : PM[k].filter((x) => x !== t.value);
      if (k === "rtProj") RT.route = null;
      PM.msel = k;
      savePM();
      render();
      return;
    }
    if (t.matches && t.matches("[data-agsel]")) {
      t.checked ? AGSEL.add(t.dataset.agsel) : AGSEL.delete(t.dataset.agsel);
      return render();
    }
    if (t.matches && t.matches("[data-agselall]")) {
      const [de, ate] = eqRange();
      eqEventos()
        .filter((e) => e.fim >= de && e.ini <= ate)
        .forEach((e) => (t.checked ? AGSEL.add(e.id) : AGSEL.delete(e.id)));
      return render();
    }
    if (t.matches && t.matches("[data-agbattec]")) {
      if (t.value) agLote("tec", t.value);
      return;
    }
    if (t.matches && t.matches("[data-eqper]")) {
      const [de, ate] = eqRange();
      PM.eqDe = t.dataset.eqper === "de" ? t.value || de : de;
      PM.eqAte = t.dataset.eqper === "ate" ? t.value || ate : ate;
      if (PM.eqAte < PM.eqDe) PM.eqAte = PM.eqDe;
      savePM();
      return render();
    }
    if (!t.matches || !t.matches("[data-pmf]")) return;
    const k = t.dataset.pmf;
    PM[k] = t.type === "checkbox" ? t.checked : t.value;
    savePM();
    render();
  });
  /* ---------- Novo projeto ---------- */
  async function openEditProj(pid) {
    const d = $("#dlgFat"),
      f = $("#formFat");
    const base = pid === "main" ? "" : `projetos/${pid}/`;
    let c = {},
      k = {};
    try {
      const [a, b] = await Promise.all([
        db.doc(base + "config/projeto").get(),
        db.doc(base + "config/stakeholders").get(),
      ]);
      c = a.exists ? a.data() : {};
      k = b.exists ? b.data() : {};
    } catch (e) {
      toast("Não foi possível carregar o projeto.");
      return;
    }
    const v = (x) => esc(x == null ? "" : x);
    f.innerHTML = `<h3>Editar projeto</h3><div class="fgrid">
    <label class="fwide">Nome do projeto<input name="nome" required value="${v(c.nome)}"></label>
    <label>Cliente<input name="cliente" value="${v(k.cliente)}"></label><label>Contrato<input name="contrato" value="${v(k.contrato)}"></label>
    <label class="lass" ${k.natureza === "doacao" ? 'style="display:none"' : ""}>Data de assinatura<input name="assinatura" type="date" value="${v(k.assinatura)}"></label><label>Ordem de início<input name="oi" type="date" value="${v(k.oi)}"></label>
    <label>Prazo de implantação (dias)<input name="prazoImpl" type="number" min="1" value="${v(k.prazoImpl)}"></label><label class="lvig" ${k.natureza === "aquisicao" || k.natureza === "doacao" ? 'style="display:none"' : ""}>Prazo contratual (meses)<input name="prazoContrato" type="number" min="1" value="${v(k.prazoContrato)}"></label>
    <label>Natureza<select name="natureza" data-natsw><option value="locacao" ${k.natureza !== "aquisicao" && k.natureza !== "doacao" ? "selected" : ""}>Locação</option><option value="aquisicao" ${k.natureza === "aquisicao" ? "selected" : ""}>Aquisição (parcela única)</option><option value="doacao" ${k.natureza === "doacao" ? "selected" : ""}>Doação (sem contrato e sem faturamento)</option></select></label><label class="lval" ${k.natureza === "doacao" ? 'style="display:none"' : ""}>Valor total (R$)<input name="valor" class="money" inputmode="numeric" value="${fmtMoney(k.valorContrato)}" placeholder="0,00"></label><label class="lmeses" ${k.natureza === "aquisicao" || k.natureza === "doacao" ? 'style="display:none"' : ""}>Dividido em (meses)<input name="meses" type="number" min="1" value="${v(k.mesesValor)}"></label></div>
  <label class="chkl encchk"><input type="checkbox" name="encerrado" ${(PROJS.find((p) => p.id === pid) || {}).encerrado ? "checked" : ""}> Projeto encerrado: vai para a pasta Encerrados e sai do painel da carteira (a Controladoria continua analisando)</label>
  <p class="hint">Contatos, aditivos e itens do contrato continuam sendo editados no painel do projeto. A quantidade de pontos é ajustada no cronograma (botão “Número de pontos”).</p>
  <div class="actions"><button type="button" class="btn" id="npCancel">Cancelar</button><button class="btn primary" type="submit" id="npGo">Salvar alterações</button></div>`;
    $("#npCancel").onclick = () => d.close();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const x = Object.fromEntries(new FormData(f).entries());
      $("#npGo").disabled = true;
      const st = {
        cliente: (x.cliente || "").trim(),
        contrato: (x.contrato || "").trim(),
        assinatura: x.assinatura || "",
        oi: x.oi || "",
        prazoImpl: x.prazoImpl === "" ? "" : +x.prazoImpl,
        prazoContrato: x.prazoContrato === "" ? "" : +x.prazoContrato,
        valorContrato: parseMoney(x.valor),
        mesesValor:
          x.natureza === "aquisicao" ? 1 : x.natureza === "doacao" || x.meses === "" ? "" : +x.meses,
        ...(x.natureza === "aquisicao" || x.natureza === "doacao" ? { prazoContrato: "" } : {}),
        ...(x.natureza === "doacao" ? { valorContrato: "", assinatura: "" } : {}),
        natureza: ["aquisicao", "doacao"].includes(x.natureza) ? x.natureza : "locacao",
      };
      const nome = (x.nome || "").trim();
      const oiCh = (st.oi || "") !== (k.oi || "");
      try {
        await db.doc(base + "config/projeto").update({ nome });
        await db.doc(base + "config/stakeholders").update(st);
        await db
          .doc("projetos/" + pid)
          .set(
            Object.assign({}, PROJS.find((p) => p.id === pid) || { ordem: 1 }, {
              nome,
              cliente: st.cliente,
              encerrado: !!x.encerrado,
            }),
          );
        if (pid === PID) {
          cfg.nome = nome;
          Object.assign(stk, st);
          if (oiCh) setTimeout(afterG3, 300);
        }
        d.close();
        CART = null;
        render();
        renderSide();
        toast("Projeto atualizado.");
      } catch (err) {
        $("#npGo").disabled = false;
        toast(errMsg(err));
      }
    };
    d.showModal();
  }
  /* Modelo padrão DGT para projeto novo: G1, G2, G4 e G5 do projeto-base (Balneário Camboriú);
     G3 com Projeto Executivo e As-Built terminando em apresentação e aceite, Infraestrutura com os
     cadastros nos softwares e Implantação = Central de Monitoramento + Ponto 01..N, cada ponto com
     estrutura, energia e link definidos na criação. */
  const MP_DOD1 = "Documento recebido, conferido e arquivado na pasta do contrato";
  const MP_SCRUM = {
    1: [
      [1, "Edital", "Comercial", "", MP_DOD1], [1, "Ata", "Comercial", "", MP_DOD1], [1, "Termo de Referência", "Comercial", "", MP_DOD1],
      [2, "B.O.M.", "Comercial", "", MP_DOD1], [2, "Catálogos", "Comercial", "", MP_DOD1], [2, "Cotações", "Comercial", "", MP_DOD1], [2, "Apostilamentos", "Comercial", "", MP_DOD1],
      [3, "Contratos", "Comercial", "", MP_DOD1], [3, "Empenhos", "Comercial", "", MP_DOD1], [3, "Ordem de Início", "Comercial", "", MP_DOD1],
    ],
    2: [
      [1, "Reunião de APC", "PMO", "", ""], [1, "Documento de APC", "PMO", "", ""],
      [2, "Criação de pasta de documentos", "PMO", "", ""], [2, "Aprovação de BOM", "PMO", "G1-S02-T01", ""], [2, "Gerar Projeto Estruturado", "PMO", "G2-S02-T02", ""], [2, "Criar Metaconta", "PMO", "G2-S02-T02", ""], [2, "Parametrizar projeto", "PMO", "G2-S02-T03", ""],
      [3, "Cronograma de obra", "PMO", "", ""], [3, "Cronograma Físico-Financeiro", "PMO", "", ""],
      [4, "Reunião de kick-off", "PMO", "G2-S01-T01", ""],
    ],
    4: [
      [1, "Medições", "PMO", "Status do G3", "Boletins de medição enviados e liberados por competência"], [1, "Análise de desvios", "PMO", "Status do G3", "SPI, prazo e custo avaliados na data de corte, com ações registradas (recorrente por sprint)"],
      [2, "Revisões de cronograma", "PMO", "Status do G3", "Revisões registradas com motivo, etapa e impacto em dias"], [2, "Change requests", "PMO", "Status do G3", "Mudanças de escopo avaliadas e aprovadas"],
      [3, "Atas de reuniões", "PMO", "", ""], [3, "Pesquisa IEP", "PMO", "", ""],
    ],
    5: [
      [1, "Envio de Documentação As Built do Projeto", "Infraestrutura", "", ""], [1, "Envio dos Pontos para Conferência do Suporte", "Infraestrutura", "", ""], [1, "Aceite dos Pontos pelo Suporte", "Infraestrutura", "", ""],
      [2, "Emissão do Atestado Técnico", "PMO", "", ""],
      [3, "Reunião L.A.P", "PMO", "", ""], [3, "Pesquisa IEP", "PMO", "", ""],
    ],
  };
  // etapas do G3: [nome, [[pacote, bloco, título, resp, duração, peso, predecessora]...]]
  const MP_G3 = [
    ["Compras e Contratações", [
      [1, "", "SC Preliminar - Pontos externos", "PMO", 3, 10.345, ""],
      [1, "", "SC Preliminar - Central de Monitoramento", "PMO", 3, 15.486, ""],
      [1, "SC Prestador de Serviços", "SC Prestador de Serviços", "PMO", 3, 10.345, "G3-F02 (todas)"],
      [1, "SC Prestador de Serviços", "Caderno de Atividades 01", "PMO", 3, 0.69, "G3-F02 (todas)"],
    ]],
    ["Vistoria Técnica", [
      [1, "", "Vistoria externa", "Implantação", 4, 1.379, "G2-S04-T01"],
      [1, "", "Preenchimento de RDO", "Implantação", 1, 0.345, "G3-F02-P01-A01"],
      [1, "", "Preenchimento de Planilha de Vistoria", "Implantação", 1, 0.345, "G3-F02-P01-A02"],
    ]],
    ["Recebimento das Compras e Contratações", [
      [1, "", "Recebimento · SC Preliminar - Pontos externos", "PMO", 1, 0.345, "G3-F01-P01-A01"],
      [1, "", "Recebimento · SC Preliminar - Central de Monitoramento", "PMO", 1, 0.345, "G3-F01-P01-A02"],
      [1, "", "Contratação · SC Prestador de Serviços", "PMO", 1, 0.345, "G3-F01-P01-A03"],
    ]],
    ["Projeto Executivo", [
      [1, "", "ART", "PMO", 5, 0.345, "G3-F02 (todas)"],
      [1, "", "Pranchas Executivas", "PMO", 5, 0.345, "G3-F02 (todas)"],
      [1, "", "Memorial Descritivo", "PMO", 5, 0.345, "G3-F02 (todas)"],
      [1, "", "Termo de Compromisso", "PMO", 5, 0.345, "G3-F02 (todas)"],
      [1, "", "Termo de Entrega de Documentos", "PMO", 5, 0.345, "G3-F02 (todas)"],
      [2, "", "Apresentação do Projeto Executivo", "PMO", 1, 0.345, "G3-F04-P01-A05"],
      [3, "", "Aceite do Projeto Executivo", "Contratante", 1, 0.345, "G3-F04-P02-A01"],
    ]],
    ["Infraestrutura", [
      [1, "", "Arquitetura de rede - E1", "Infraestrutura", 1, 0.345, "G3-F02 (todas)"],
      [2, "Cadastros de monitoramento", "Zabbix", "Infraestrutura", 1, 0.345, "G3-F05-P01-A01"],
      [2, "Cadastros de monitoramento", "DGT Care", "Infraestrutura", 1, 0.345, "G3-F05-P01-A01"],
      [3, "Configuração de equipamentos", "Câmeras", "Infraestrutura", 1, 0.345, "G3-F03-P01-A01"],
      [3, "Configuração de equipamentos", "Servidores", "Infraestrutura", 1, 0.345, "G3-F03-P01-A02"],
      [4, "", "Arquitetura de rede - E2", "Infraestrutura", 1, 0.345, "G3-F05-P03-A01"],
      [5, "Cadastros nos sistemas", "Software de videomonitoramento", "Infraestrutura", 1, 0.345, "5.3"],
      [5, "Cadastros nos sistemas", "Software de análise de risco", "Infraestrutura", 1, 0.345, "5.3"],
      [5, "Cadastros nos sistemas", "Software de reconhecimento facial", "Infraestrutura", 1, 0.345, "5.3"],
      [5, "Cadastros nos sistemas", "Software de cercamento eletrônico", "Infraestrutura", 1, 0.345, "5.3"],
    ]],
    ["Implantação", [
      [1, "Central de Monitoramento", "Instalação de Rack e servidores", "Implantação", 1, 0.345, "5.5"],
      [1, "Central de Monitoramento", "Instalação de Infraestrutura", "Implantação", 1, 0.345, "5.5"],
      [1, "Central de Monitoramento", "Link e Energia", "Implantação", 1, 0.345, "5.5"],
    ]],
    ["Treinamentos", [
      [1, "", "Elaboração de Listas de Treinamentos", "Implantação", 1, 0.345, "G3-F06 (todas)"],
      [1, "", "Treinamento dos sistemas", "Implantação", 1, 0.345, "G3-F07-P01-A01"],
    ]],
    ["Projeto As-Built", [
      [1, "", "Pranchas As-Built", "PMO", 5, 0.345, "G3-F07 (todas)"],
      [1, "", "Memorial Descritivo", "PMO", 5, 0.345, "G3-F07 (todas)"],
      [1, "", "Termo de Aceite Definitivo", "PMO", 5, 0.345, "G3-F07 (todas)"],
      [1, "", "Termo de Entrega de Documentos", "PMO", 5, 0.345, "G3-F07 (todas)"],
      [2, "", "Apresentação do Projeto As-Built", "PMO", 1, 0.345, "G3-F08-P01-A04"],
      [3, "", "Aceite do Projeto As-Built", "Contratante", 1, 0.345, "G3-F08-P02-A01"],
    ]],
  ];
  const MP_ETAPA_PTS = 6; // etapa da Implantação (pontos depois da Central de Monitoramento)
  const MP_PADRAO = { estrutura: "existente", energia: "deriv", link: "link_cli" };
  // pontos: [{nome, estrutura, energia, link}]
  function modeloPadrao(pontos, porDia) {
    const cap = Math.max(1, Math.round(+porDia || 2));
    const fimEstr = []; // código da última atividade de estrutura de cada ponto
    const out = [];
    let ordem = Date.now();
    Object.entries(MP_SCRUM).forEach(([g, L]) => {
      const cont = {};
      L.forEach(([sp, titulo, resp, dep, dod]) => {
        cont[sp] = (cont[sp] || 0) + 1;
        out.push({ grupo: +g, sprint: sp, seq: cont[sp], ordem: ordem++, codigo: `G${g}-S${p2(sp)}-T${p2(cont[sp])}`, titulo, resp, dep, dod, esforco: "", status: +g === 1 ? "naorecebido" : "backlog" });
      });
    });
    const g3 = (o) => Object.assign({ grupo: 3, predTipo: "TI", durTpl: 1, marco: false, valor: "", sub: [], inicio: "", fim: "", inicioRev: "", fimRev: "", inicioReal: "", fimReal: "", pctReal: 0, obs: "" }, o, { ordem: ordem++ });
    MP_G3.forEach(([nome, L], k) => {
      const f = k + 1;
      const seq = {};
      L.forEach(([pc, bloco, titulo, resp, duracao, peso, pred]) => {
        seq[pc] = (seq[pc] || 0) + 1;
        const pacoteNome = bloco || (pc === 1 ? nome : titulo);
        out.push(g3({ faseNum: f, faseNome: `Frente ${p2(f)} · ${nome}`, pacoteNum: pc, pacoteNome, seq: seq[pc], codigo: `G3-F${p2(f)}-P${p2(pc)}-A${p2(seq[pc])}`, titulo, resp, duracao, peso, pred, bloco }));
      });
      if (f !== MP_ETAPA_PTS) return;
      // pontos da implantação: estrutura → energia → link, em sequência dentro do ponto
      (pontos || []).forEach((pt, j) => {
        const pn = j + 2;
        let s = 0;
        let ant = "";
        const inicio = j < cap ? "5.5" : fimEstr[j - cap];
        ["estrutura", "energia", "link"].forEach((g) => {
          const md = pt[g] || MP_PADRAO[g];
          const def = PMODES[g].opts[md] || PMODES[g].opts[MP_PADRAO[g]];
          def.steps.forEach(([t, rs, d]) => {
            s++;
            const codigo = `G3-F${p2(f)}-P${p2(pn)}-A${p2(s)}`;
            out.push(g3({ faseNum: f, faseNome: `Frente ${p2(f)} · ${nome}`, pacoteNum: pn, pacoteNome: (pt.nome || "").trim() || "Ponto " + p2(j + 1), ponto: pn, grp: g, gmode: PMODES[g].opts[md] ? md : MP_PADRAO[g], seq: s, codigo, titulo: `${PMODES[g].label} · ${t}`, resp: rs, duracao: d, peso: 0.345, pred: ant || inicio, bloco: "" }));
            ant = codigo;
            if (g === "estrutura") fimEstr[j] = codigo;
          });
        });
      });
    });
    return out.map((i, k) => Object.assign(i, { id: "i" + String(k + 1).padStart(4, "0") }));
  }
  /* Novo projeto: assistente em 4 passos (contrato e valores, prazos, stakeholders e estrutura).
     A estrutura (G1 a G5) é copiada de um projeto modelo, sem datas realizadas, e pode ser conferida antes de criar. */
  const NP = { passo: 0, modelo: "", itens: null, carregando: false, dgt: [], pontos: [], cap: 2 };
  // responsáveis do modelo: quem é de PMO, Implantação ou Infraestrutura passa para a pessoa informada no projeto novo
  function npResp(L) {
    const M = {};
    (NP.dgt || []).forEach((c) => {
      const sub = Object.keys(FUNCAO_SUB).find((k) => FUNCAO_SUB[k] === c.funcao);
      if (sub && c.nome) M[sub] = c.nome;
    });
    return L.map((i) => {
      const sub = i.resp ? subsetorDe(i.resp) : "";
      return sub && M[sub] && normNome(i.resp) !== normNome(M[sub]) ? Object.assign({}, i, { resp: M[sub] }) : i;
    });
  }
  const NP_PASSOS = ["Contrato e valores", "Prazos", "Stakeholders", "Estrutura G1 a G5", "Revisão"];
  async function npCarregarModelo(id) {
    NP.modelo = id;
    NP.itens = null;
    if (id === "__padrao") return;
    if (!db || id === PID) {
      NP.itens = S.itens.slice();
      return;
    }
    NP.carregando = true;
    try {
      const b = id === "main" ? "" : `projetos/${id}/`;
      const a = await db.collection(b + "atividades").get();
      if (NP.modelo === id) NP.itens = a.docs.map((x) => Object.assign({ id: x.id }, x.data()));
    } catch (e) {
      if (NP.modelo === id) NP.itens = [];
    }
    NP.carregando = false;
  }
  // prévia da estrutura que o projeto novo vai receber
  const npItens = (N) => (NP.modelo === "__padrao" ? npResp(modeloPadrao(NP.pontos.slice(0, N), NP.cap)) : templateItems(N, npResp(NP.itens)));
  function npPrevia(N) {
    if (NP.modelo !== "__padrao" && (NP.carregando || !NP.itens)) return `<p class="hint"><span class="spin"></span> Carregando a estrutura do modelo…</p>`;
    const L = npItens(N);
    if (!L.length) return `<p class="hint bad">O projeto modelo não tem cronograma. Escolha outro modelo.</p>`;
    const ord = (a, b) => (+a.ordem || 0) - (+b.ordem || 0) || (+a.seq || 0) - (+b.seq || 0);
    const li = (i, nivel) =>
      `<li style="--nv:${nivel || 0}"><span class="npcod">${esc(i.codigo || "")}</span>${esc(i.titulo || "")}${i.resp ? `<small>${esc(i.resp)}</small>` : ""}</li>`;
    // lista com a hierarquia de grupos (bloco › subgrupos) do cronograma
    const arvore = (its, cam) => {
      let ant = [];
      return its
        .map((i) => {
          const c = cam(i);
          let h = "";
          c.forEach((nome, k) => {
            if (ant[k] !== nome) {
              h += `<li class="npg" style="--nv:${k}">${esc(nome)}</li>`;
              ant = ant.slice(0, k).concat(nome);
            }
          });
          ant = c.slice();
          const resumo = c.length && normNome(c[c.length - 1]) === normNome(i.titulo);
          return h + (resumo ? "" : li(i, c.length));
        })
        .join("");
    };
    const grupos = [1, 2, 3, 4, 5].map((g) => {
      const its = L.filter((i) => +i.grupo === g).sort(ord);
      let corpo = "";
      if (g === 3) {
        const fases = [...new Set(its.map((i) => +i.faseNum))].sort((a, b) => a - b);
        corpo = fases
          .map((f) => {
            const F = its.filter((i) => +i.faseNum === f);
            const nome = (F[0].faseNome || "Etapa " + f).replace(/^Frente \d+ · /, "");
            const gerais = F.filter((i) => !i.ponto);
            const pts = F.filter((i) => i.ponto);
            const nums = [...new Set(pts.map((i) => +i.pacoteNum))].sort((a, b) => a - b);
            const nPts = nums.length;
            // pontos com as mesmas atividades ficam juntos
            const tipos = new Map();
            nums.forEach((n) => {
              const its = pts.filter((i) => +i.pacoteNum === n).sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
              const k = its.map((i) => i.titulo).join("|");
              if (!tipos.has(k)) tipos.set(k, { its, nomes: [] });
              tipos.get(k).nomes.push(its[0].pacoteNome || "Ponto " + p2(n));
            });
            const porPonto = [...tipos.values()]
              .map((t) => `<p class="nppt">${t.nomes.length === nPts ? `Em cada ponto (${esc(t.nomes[0])} a ${esc(t.nomes[nPts - 1])})` : `${t.nomes.length} ponto${t.nomes.length > 1 ? "s" : ""}: ${esc(t.nomes.slice(0, 8).join(", "))}${t.nomes.length > 8 ? "…" : ""}`} · ${t.its.length} atividade${t.its.length > 1 ? "s" : ""}</p><ul class="nplist">${arvore(t.its, psubOf)}</ul>`)
              .join("");
            const porPt = tipos.size === 1 ? [...tipos.values()][0].its.length : 0;
            return `<details class="npet"><summary><b>Etapa ${p2(f)} · ${esc(nome)}</b><span>${F.length} atividade${F.length > 1 ? "s" : ""}${pts.length ? (porPt ? ` · ${porPt} por ponto × ${nPts} ponto${nPts > 1 ? "s" : ""}` : ` · ${nPts} pontos`) : ""}</span></summary>
              ${gerais.length ? `<ul class="nplist">${arvore(gerais, gPath)}</ul>` : ""}
              ${porPonto}</details>`;
          })
          .join("");
      } else {
        const sprints = [...new Set(its.map((i) => +i.sprint || 0))].sort((a, b) => a - b);
        corpo =
          sprints.length > 1 || (sprints[0] || 0) > 0
            ? sprints.map((sp) => `<p class="nppt">${sp ? "Sprint " + sp : "Sem sprint"}</p><ul class="nplist">${its.filter((i) => (+i.sprint || 0) === sp).map((i) => li(i)).join("")}</ul>`).join("")
            : `<ul class="nplist">${its.map((i) => li(i)).join("")}</ul>`;
      }
      return `<details class="npgr" ${g === 3 ? "open" : ""}><summary><b>G${g} · ${esc(GRUPOS[g].nome)}</b><span>${its.length} atividade${its.length === 1 ? "" : "s"}</span></summary>${corpo || `<p class="hint">Sem atividades.</p>`}</details>`;
    });
    return `<p class="nptot"><b>${L.length}</b> atividades no total · as datas planejadas são calculadas a partir da ordem de início; nenhuma data realizada é copiada. Responsáveis do modelo que sejam pessoas de PMO, Implantação ou Infraestrutura passam a ser as informadas em Stakeholders.</p>${grupos.join("")}`;
  }
  function openNewProj() {
    const d = $("#dlgNovo"),
      f = $("#formNovo");
    NP.passo = 0;
    const abertos = PROJS.filter((p) => !p.encerrado);
    void abertos;
    const modelo0 = "__padrao";
    NP.pontos = [];
    const membros = (sub) => (equipe().find((e) => e.setor === sub) || { membros: [] }).membros;
    const dl = (id, L) => `<datalist id="${id}">${L.map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`;
    const crow = (c) =>
      `<div class="sr c"><input data-c="funcao" list="npFuncCli" value="${esc(c.funcao || "")}" placeholder="Função" aria-label="Função"><input data-c="nome" value="${esc(c.nome || "")}" placeholder="Nome" aria-label="Nome">${ctCampos(c)}<button type="button" class="ico rm" data-nprm title="Remover contato" aria-label="Remover contato">×</button></div>`;
    const drow = (funcao, sub) =>
      `<div class="sr c npd"><input data-c="funcao" value="${esc(funcao)}" aria-label="Função" readonly tabindex="-1"><input data-c="nome" list="npEq${esc(sub)}" placeholder="Nome (${esc(membros(sub).join(", ") || "digite")})" aria-label="${esc(funcao)}">${ctCampos({}, " (opcional)")}<span></span></div>`;
    f.innerHTML = `<h3>Novo projeto</h3>
    <nav class="npsteps">${NP_PASSOS.map((t, k) => `<button type="button" data-nppasso="${k}"><i>${k + 1}</i>${t}</button>`).join("")}</nav>
    <div class="nppane" data-p="0"><div class="sgrid"><section class="sbox full">
      <div class="fgrid">
        <label class="fwide">Nome do projeto *<input name="nome" required placeholder="Ex.: 11500 - MUNICÍPIO - LOC + LINK"></label>
        <label>Órgão / cliente<input name="cliente" placeholder="Ex.: Município de …/RS"></label>
        <label>Contrato<input name="contrato" placeholder="Ex.: TA 72/2026 ao Contrato 133/2023"></label>
        <label class="fwide">Objeto do contrato<textarea name="objeto" rows="2" placeholder="Ex.: locação de sistema de videomonitoramento…"></textarea></label>
        <label>Natureza<select name="natureza" data-natsw><option value="locacao">Locação (mensal)</option><option value="aquisicao">Aquisição (parcela única após o T.A.D.)</option>${OPT_DOA}</select></label>
        <label class="lval">Valor total (R$)<input name="valor" class="money" inputmode="numeric" placeholder="0,00"></label>
        <label class="lmeses">Dividido em (meses)<input name="meses" type="number" min="1" value="12"></label>
        <label class="lmeses">Faturamento a partir de<select name="fatInicio"><option value="">T.A.D. (fim da implantação)</option><option value="assinatura">Assinatura do contrato</option></select></label>
      </div>
      <div class="npcalc"><span>Parcela <b id="npParcL">mensal</b></span><b id="npParc">–</b></div>
    </section></div></div>
    <div class="nppane" data-p="1" hidden><div class="sgrid"><section class="sbox full">
      <div class="pz">
        <div class="pzc"><span class="pzt">Vigência</span>
          <label class="lass"><span class="sl">Data de assinatura</span><input type="date" name="assinatura"></label>
          <label class="lvig"><span class="sl">Prazo contratual (meses)</span><input type="number" min="1" name="prazoContrato" value="12"></label>
          <div class="pzr lvig"><span class="sl">Fim da vigência</span><b id="npVig">–</b></div></div>
        <div class="pzc"><span class="pzt">Implantação</span>
          <label><span class="sl">Ordem de início *</span><input type="date" name="oi" required></label>
          <label><span class="sl">Prazo de implantação (dias)</span><input type="number" min="1" name="prazoImpl" value="90"></label>
          <div class="pzr"><span class="sl">Limite de implantação</span><b id="npLim">–</b></div></div>
      </div>
      <div class="pz" style="margin-top:14px"><div class="pzc"><span class="pzt">Reunião de APC</span>
          <label><span class="sl">Data da reunião de APC *</span><input type="date" name="apc" required></label>
          <div class="pzr"><span class="sl">Lapso após a ordem de início</span><b id="npApc">–</b></div></div></div>
      <p class="hint">A ordem de início (ordem de serviço) conta o prazo contratual de implantação. O cronograma de execução começa no dia seguinte à reunião de APC; se ela for depois da ordem de início, o intervalo entra como atraso administrativo.</p>
    </section></div></div>
    <div class="nppane" data-p="2" hidden><div class="sgrid">
      <section class="sbox"><h4>DGT Tecnologia</h4><div class="shead c"><span>Função</span><span>Nome</span><span>E-mail</span><span>Telefone</span><span></span></div>
        <div class="clist" data-side="dgt">${drow("PMO do projeto", "PMO")}${drow("Implantação", "Implantação")}${drow("Infraestrutura", "Infraestrutura")}</div>
        ${["PMO", "Implantação", "Infraestrutura"].map((x) => dl("npEq" + x, membros(x))).join("")}</section>
      <section class="sbox"><h4>Cliente</h4><div class="shead c"><span>Função</span><span>Nome</span><span>E-mail</span><span>Telefone</span><span></span></div>
        <div class="clist" data-side="cli">${ROLES_CLI.map(([, l]) => crow({ funcao: l })).join("")}</div>
        <button type="button" class="btn ghost addc" data-npaddc>+ Adicionar contato</button>
        ${dl("npFuncCli", ["Fiscal do contrato", "Gestor do contrato", "Contato financeiro", "Secretário(a)", "TI do cliente", "Responsável técnico"])}</section>
    </div><p class="hint">Use apenas nome e contato profissional. Não registre CPF, CNPJ, senhas ou dados bancários.</p></div>
    <div class="nppane" data-p="3" hidden>
      <div class="npmod"><label>Estrutura<select name="modelo"><option value="__padrao" selected>Modelo padrão DGT (recomendado)</option><optgroup label="Copiar de um projeto">${(PROJS.length ? PROJS : [{ id: PID, nome: cfg.nome }])
        .slice()
        .sort((a, b) => !!a.encerrado - !!b.encerrado || COLPTN(String(a.nome || ""), String(b.nome || "")))
        .map((p) => `<option value="${esc(p.id)}">${esc(p.nome || p.id)}${p.encerrado ? " (encerrado)" : ""}</option>`)
        .join("")}</optgroup></select></label>
        <label>Número de pontos<input name="pontos" type="number" min="1" max="500" value="10"></label>
        <label>Pontos por dia<input name="porDia" type="number" min="1" max="100" value="${+cfg.capPontoDia || 2}" title="Quantos pontos a equipe instala por dia: escalona o início dos pontos"></label></div>
      <p class="hint">A Central e os primeiros pontos (tantos quantos por dia) começam depois dos cadastros nos sistemas (5.5); cada ponto seguinte começa quando termina a estrutura do ponto que o antecede na fila (ex.: 2 por dia = ponto 03 depois da estrutura do 01, ponto 04 depois da do 02…).</p>
      <div class="nppts" id="npPts"></div>
      <div class="nptree" id="npArv"></div>
    </div>
    <div class="nppane" data-p="4" hidden>
      <div class="npres" id="npRes"></div>
      <p class="hint">Confira os dados. Para corrigir algo, clique no passo correspondente acima; ao criar, o projeto abre no painel.</p>
    </div>
    <p class="hint bad" id="npMsg"></p>
    <div class="actions"><button type="button" class="btn" id="npCancel">Cancelar</button><span class="npesp"></span><button type="button" class="btn" id="npVolta">Voltar</button><button type="button" class="btn primary" id="npAvanca">Avançar</button><button class="btn primary" type="submit" id="npGo">Criar projeto</button></div>`;
    const q = (s) => f.querySelector(s);
    const dados = () => Object.fromEntries(new FormData(f).entries());
    const lerAd = () =>
      [...f.querySelectorAll(".adlist .adr")]
        .map((r) => {
          const o = {};
          r.querySelectorAll("[data-a]").forEach((x) => (o[x.dataset.a] = x.value.trim()));
          o.qtd = o.qtd === "" ? "" : +o.qtd;
          return o;
        })
        .filter((o) => o.num || o.qtd || o.data);
    const lerContatos = (side) =>
      [...f.querySelectorAll(`.clist[data-side="${side}"] .sr`)]
        .map((r) => {
          const o = {};
          r.querySelectorAll("[data-c]").forEach((x) => (o[x.dataset.c] = x.value.trim()));
          return ctJunta(o);
        })
        .filter((o) => o.nome || o.contato || (side === "cli" && o.funcao && (o.nome || o.contato)));
    const calc = () => {
      const x = dados();
      const aq = x.natureza === "aquisicao";
      const P = calcPrazos({ natureza: x.natureza, assinatura: x.assinatura, prazoContrato: aq ? "" : +x.prazoContrato || "", oi: x.oi, prazoImpl: +x.prazoImpl || "", aditivos: lerAd(), valorContrato: parseMoney(x.valor), mesesValor: aq ? 1 : +x.meses || "" });
      q("#npVig").textContent = P.vig ? fmtD(P.vig) + (P.addVig ? ` (+${fmtN(P.addVig)} m)` : "") : "–";
      q("#npLim").textContent = P.lim ? fmtD(P.lim) + (P.addImpl ? ` (+${fmtN(P.addImpl)} d)` : "") : "–";
      q("#npApc").textContent = x.apc && x.oi ? (x.apc > x.oi ? (diasCorridos(x.oi, addDays(x.apc, -1)) > APC_TOL ? `${diasCorridos(x.oi, addDays(x.apc, -1))} dias de atraso administrativo` : `${diasCorridos(x.oi, addDays(x.apc, -1))} dias · dentro da tolerância de ${APC_TOL} dias`) : "sem atraso") : "–";
      q("#npParc").textContent = P.parcela ? BRL(P.parcela) : "–";
      q("#npParcL").textContent = aq ? "única" : "mensal";
      f.querySelectorAll(".lmeses,.lvig,.optvig").forEach((el) => (el.style.display = aq ? "none" : ""));
      f.querySelectorAll(".adr").forEach((r) => (r.querySelector(".adu").textContent = r.querySelector('[data-a="tipo"]').value === "vig" ? "meses" : "dias"));
      return { x, P };
    };
    const resumo = () => {
      const { x, P } = calc();
      const dg = lerContatos("dgt").filter((c) => c.nome);
      const cl = lerContatos("cli").filter((c) => c.nome);
      const lin = (l, v) => `<div><span>${l}</span><b>${v || "–"}</b></div>`;
      q("#npRes").innerHTML = `<div class="npresg">${lin("Projeto", esc(x.nome))}${lin("Cliente", esc([x.cliente, x.contrato].filter(Boolean).join(" · ")))}${lin("Valor", parseMoney(x.valor) ? BRL(parseMoney(x.valor)) + (P.parcela ? ` · ${x.natureza === "aquisicao" ? "parcela única" : `${x.meses}× ${BRL(P.parcela)}`}` : "") : "")}${lin("Vigência", x.assinatura ? fmtD(x.assinatura) + (P.vig ? " a " + fmtD(P.vig) : "") : "")}${lin("Implantação", x.oi ? fmtD(x.oi) + (P.lim ? " a " + fmtD(P.lim) + ` (${x.prazoImpl} dias)` : "") : "")}${lin("Reunião de APC", x.apc ? fmtD(x.apc) + (x.oi && x.apc > x.oi ? ` · ${diasCorridos(x.oi, addDays(x.apc, -1))} dias de atraso administrativo` : "") : "")}${lin("DGT", esc(dg.map((c) => `${c.funcao}: ${c.nome}`).join(" · ")))}${lin("Contatos do cliente", cl.length ? cl.length + " contato" + (cl.length > 1 ? "s" : "") : "")}${lin("Estrutura", (() => {
        const N = Math.max(1, Math.min(500, Math.round(+x.pontos || 1)));
        const nomeM = NP.modelo === "__padrao" ? "Modelo padrão DGT" : "Cópia de " + esc((PROJS.find((p) => p.id === NP.modelo) || {}).nome || "projeto");
        if (NP.modelo !== "__padrao" && (NP.carregando || !NP.itens)) return nomeM + " · carregando…";
        NP.dgt = lerContatos("dgt");
        const L = npItens(N);
        return `${nomeM} · ${N} ponto${N > 1 ? "s" : ""} · ${L.length} atividades (G3: ${L.filter((i) => +i.grupo === 3).length})`;
      })())}</div>`;
    };
    const opcoes = (g, v) => Object.entries(PMODES[g].opts).map(([k, o]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(o.l)}</option>`).join("");
    const lerPontos = () => {
      NP.cap = Math.max(1, Math.round(+dados().porDia || 2));
      f.querySelectorAll(".nppt-r[data-j]").forEach((r) => {
        const j = +r.dataset.j;
        NP.pontos[j] = { nome: r.querySelector("[data-pn]").value, estrutura: r.querySelector('[data-pg="estrutura"]').value, energia: r.querySelector('[data-pg="energia"]').value, link: r.querySelector('[data-pg="link"]').value };
      });
    };
    const tabelaPontos = () => {
      const box = q("#npPts");
      if (NP.modelo !== "__padrao") {
        box.innerHTML = "";
        return;
      }
      lerPontos();
      const N = Math.max(1, Math.min(500, Math.round(+dados().pontos || 1)));
      for (let j = 0; j < N; j++) NP.pontos[j] = Object.assign({ nome: "", ...MP_PADRAO }, NP.pontos[j] || (j ? { ...NP.pontos[j - 1], nome: "" } : {}));
      const sel = (g, v, j) => `<select data-pg="${g}" aria-label="${PMODES[g].label} do ponto ${j + 1}">${opcoes(g, v)}</select>`;
      box.innerHTML = `<details class="nppt-box" ${N <= 30 ? "open" : ""}><summary><b>Pontos da implantação</b><span>estrutura, energia e link de cada ponto</span></summary>
        <div class="nppt-t"><div class="nppt-h"><span>Ponto</span><span>Estrutura</span><span>Energia</span><span>Link</span></div>
        <div class="nppt-r todos"><span class="mut">Aplicar a todos</span>${["estrutura", "energia", "link"].map((g) => `<select data-ptodos="${g}" aria-label="${PMODES[g].label} de todos os pontos"><option value="">—</option>${opcoes(g, "")}</select>`).join("")}</div>
        ${NP.pontos
          .slice(0, N)
          .map((p, j) => `<div class="nppt-r" data-j="${j}"><input data-pn value="${esc(p.nome)}" placeholder="Ponto ${p2(j + 1)}" aria-label="Nome do ponto ${j + 1}">${sel("estrutura", p.estrutura, j)}${sel("energia", p.energia, j)}${sel("link", p.link, j)}</div>`)
          .join("")}</div></details>`;
    };
    const arvore = () => {
      const N = Math.max(1, Math.min(500, Math.round(+dados().pontos || 1)));
      if (NP.modelo === "__padrao") lerPontos();
      NP.dgt = lerContatos("dgt");
      q("#npArv").innerHTML = npPrevia(N);
    };
    const ir = (k) => {
      NP.passo = Math.max(0, Math.min(4, k));
      f.querySelectorAll(".nppane").forEach((p) => (p.hidden = +p.dataset.p !== NP.passo));
      f.querySelectorAll("[data-nppasso]").forEach((b) => {
        b.classList.toggle("on", +b.dataset.nppasso === NP.passo);
        b.classList.toggle("ok", +b.dataset.nppasso < NP.passo);
      });
      q("#npVolta").hidden = NP.passo === 0;
      q("#npAvanca").hidden = NP.passo === 4;
      q("#npGo").hidden = NP.passo !== 4;
      q("#npMsg").textContent = "";
      if (NP.passo === 3) {
        tabelaPontos();
        arvore();
      }
      if (NP.passo === 4) {
        if (NP.modelo === "__padrao") lerPontos();
        resumo();
        const fx = falta();
        q("#npGo").disabled = !!fx;
        q("#npMsg").innerHTML = fx ? `Para criar o projeto: ${esc(fx[1])} <button type="button" class="lnk" data-nppasso="${fx[0]}">Ir para ${esc(NP_PASSOS[fx[0]])}</button>` : "";
      }
      const p = f.querySelector(`.nppane[data-p="${NP.passo}"] input:not([readonly]),.nppane[data-p="${NP.passo}"] select`);
      if (p && NP.passo < 3) setTimeout(() => p.focus(), 30);
    };
    // campos obrigatórios: volta ao passo em que estão
    const falta = () => {
      const x = dados();
      if (!(x.nome || "").trim()) return [0, "Informe o nome do projeto.", "nome"];
      if (!x.oi) return [1, "Informe a ordem de início: ela define as datas planejadas do cronograma.", "oi"];
      if (x.assinatura && x.oi && x.oi < x.assinatura) return [1, "A ordem de início não pode ser anterior à assinatura.", "oi"];
      if (!x.apc) return [1, "Informe a data da reunião de APC: a execução começa no dia seguinte a ela.", "apc"];
      if (x.assinatura && x.apc < x.assinatura) return [1, "A reunião de APC não pode ser anterior à assinatura.", "apc"];
      return null;
    };
    // navegação livre entre os passos; o que falta só impede de criar (aparece na Revisão)
    const avancar = () => ir(NP.passo + 1);
    f.oninput = (e) => {
      calc();
      if ((e.target.name === "pontos" || e.target.name === "porDia") && NP.passo === 3) {
        tabelaPontos();
        arvore();
      }
      if (e.target.matches("[data-pn]")) arvore();
    };
    f.onchange = async (e) => {
      calc();
      const td = e.target.dataset && e.target.dataset.ptodos;
      if (td) {
        if (e.target.value) f.querySelectorAll(`.nppt-r[data-j] [data-pg="${td}"]`).forEach((s) => (s.value = e.target.value));
        e.target.value = "";
        arvore();
        return;
      }
      if (e.target.matches && e.target.matches("[data-pg]")) {
        arvore();
        return;
      }
      if (e.target.name === "modelo") {
        const id = e.target.value;
        const p = npCarregarModelo(id);
        tabelaPontos();
        arvore();
        await p;
        if (NP.modelo === id) arvore();
      }
    };
    f.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && NP.passo < 4) {
        e.preventDefault();
        avancar();
      }
    };
    f.onclick = (e) => {
      const b = e.target.closest("[data-nppasso]");
      if (b) {
        ir(+b.dataset.nppasso);
        return;
      }
      if (e.target.closest("[data-npad]")) {
        q(".adlist").insertAdjacentHTML("beforeend", adRow({ tipo: "impl" }));
        q(".adlist").lastElementChild.querySelector("input").focus();
        calc();
        return;
      }
      const ra = e.target.closest("[data-rmad]");
      if (ra) {
        ra.closest(".adr").remove();
        calc();
        return;
      }
      if (e.target.closest("[data-npaddc]")) {
        const L = q('.clist[data-side="cli"]');
        L.insertAdjacentHTML("beforeend", crow({}));
        L.lastElementChild.querySelector("input").focus();
        return;
      }
      const rm = e.target.closest("[data-nprm]");
      if (rm) rm.closest(".sr").remove();
    };
    q("#npCancel").onclick = () => d.close();
    q("#npVolta").onclick = () => ir(NP.passo - 1);
    q("#npAvanca").onclick = avancar;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fx = falta();
      if (fx) {
        ir(fx[0]);
        q("#npMsg").textContent = fx[1];
        return;
      }
      if (NP.modelo !== "__padrao" && (NP.carregando || !NP.itens)) {
        q("#npMsg").textContent = "Aguarde a estrutura do modelo terminar de carregar.";
        return;
      }
      if (NP.modelo === "__padrao") lerPontos();
      const x = dados();
      const N = Math.max(1, Math.min(500, Math.round(+x.pontos || 1)));
      const aq = x.natureza === "aquisicao";
      const extra = {
        objeto: (x.objeto || "").trim(),
        fatInicio: !aq && x.natureza !== "doacao" && x.fatInicio === "assinatura" ? "assinatura" : "",
        aditivos: [],
        apc: x.apc || "",
        dgt: lerContatos("dgt").filter((c) => c.nome),
        cli: lerContatos("cli"),
      };
      {
        const A0 = admApc({ oi: x.oi, apc: x.apc });
        if (A0 && !A0.fim) Object.assign(extra, { atrasoAdm: true, atrasoAdmMotivo: APC_MOT });
      }
      q("#npGo").disabled = true;
      q("#npMsg").classList.remove("bad");
      q("#npMsg").textContent = "Criando projeto…";
      try {
        const nid = await createProject(x, N, (m) => (q("#npMsg").textContent = m), { prontos: NP.modelo === "__padrao" ? (NP.dgt = extra.dgt, npItens(N)) : null, itens: (NP.dgt = extra.dgt, npResp(NP.itens || [])), stk: extra });
        d.close();
        CART = null;
        toast("Projeto criado.");
        connect(nid);
        location.hash = "painel";
      } catch (err) {
        q("#npGo").disabled = false;
        q("#npMsg").classList.add("bad");
        q("#npMsg").textContent = "Erro ao criar: " + ((err && err.message) || err);
      }
    };
    ir(0);
    calc();
    npCarregarModelo(modelo0);
    d.showModal();
  }
  function templateItems(N, base) {
    const src = (base || S.itens).map((i) => Object.assign({}, i));
    const pts = src.filter((i) => +i.grupo === 3 && i.ponto);
    const rest = src.filter((i) => !(+i.grupo === 3 && i.ponto));
    const p1 = pts
      .filter((i) => +i.pacoteNum === Math.min(...pts.map((x) => +x.pacoteNum)))
      .sort((a, b) => (+a.seq || 0) - (+b.seq || 0));
    const wt = {};
    pts.forEach((i) => {
      wt[i.titulo] = (wt[i.titulo] || 0) + (+i.peso || 0);
    });
    const clr = (i) => {
      [
        "inicio",
        "fim",
        "inicioRev",
        "fimRev",
        "inicioReal",
        "fimReal",
        "obs",
      ].forEach((k) => (i[k] = ""));
      delete i.lagRev;
      i.pctReal = 0;
      if (+i.grupo === 1) i.status = "naorecebido";
      else if (+i.grupo !== 3) i.status = "backlog";
      return i;
    };
    const out = rest.map(clr);
    if (p1.length) {
      const tag = "-P" + p2(p1[0].pacoteNum) + "-";
      for (let k = 1; k <= N; k++)
        p1.forEach((i) => {
          const n = clr(Object.assign({}, i));
          const nt = "-P" + p2(k) + "-";
          n.pacoteNum = k;
          n.pacoteNome = "Ponto " + p2(k);
          n.codigo = String(i.codigo).split(tag).join(nt);
          n.pred = String(i.pred || "")
            .split(tag)
            .join(nt);
          n.peso = Math.round(((wt[i.titulo] || 0) / N) * 1000) / 1000;
          n.id = "t" + k + "_" + i.id;
          out.push(n);
        });
    }
    return out.map((i, k) => {
      const o = Object.assign({}, i);
      o.id = "i" + String(k + 1).padStart(4, "0");
      return o;
    });
  }
  async function createProject(x, N, msg, opt) {
    opt = opt || {};
    const nid = uid("p");
    const base = `projetos/${nid}/`;
    const ordem = Math.max(0, ...PROJS.map((p) => +p.ordem || 0)) + 1;
    const M = (+parseMoney(x.valor) || 0) / (+x.meses || 1);
    const stk0 = {
      cliente: (x.cliente || "").trim(),
      contrato: (x.contrato || "").trim(),
      assinatura: x.assinatura || "",
      prazoContrato: x.natureza === "aquisicao" || x.natureza === "doacao" ? "" : +x.prazoContrato || 12,
      oi: x.oi,
      prazoImpl: +x.prazoImpl || 90,
      aditivos: [],
      valorContrato: x.natureza === "doacao" ? "" : +parseMoney(x.valor) || "",
      mesesValor: x.natureza === "aquisicao" ? 1 : x.natureza === "doacao" ? "" : +x.meses || 12,
      natureza: ["aquisicao", "doacao"].includes(x.natureza) ? x.natureza : "locacao",
      dgt: [],
      cli: [],
      ...(opt.stk || {}),
    };
    const cfg0 = {
      nome: x.nome.trim(),
      gates: { g12: false, g23: false, g35: false },
      capPontoDia: Math.max(1, Math.round(+x.porDia || +cfg.capPontoDia || 2)),
      diasUteis: 1, // durações já em dias úteis: o projeto novo não passa pela conversão de dias corridos
    };
    const items = opt.prontos || templateItems(N, opt.itens);
    if (!items.length)
      throw new Error("o projeto modelo não tem cronograma: escolha outro modelo");
    await db.doc(base + "config/projeto").set(clean(cfg0));
    await db.doc(base + "config/stakeholders").set(clean(stk0));
    let done = 0;
    const q = items.slice();
    const worker = async () => {
      while (q.length) {
        const it = q.shift();
        const id = it.id;
        await db
          .collection(base + "atividades")
          .doc(id)
          .set(clean(it));
        done++;
        if (done % 10 === 0) msg(`Criando atividades… ${done}/${items.length}`);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await db
      .doc("projetos/" + nid)
      .set({ nome: cfg0.nome, cliente: stk0.cliente, ordem });
    return nid;
  }
  /* ---------- Configurações: gestão de usuários, setores, perfis e permissões, histórico ----------
     Tudo é conferido e gravado no servidor (tools/auth.py); a tela só mostra o que a sessão pode ver. */
  // declarações de função: a barra lateral usa estas antes de o arquivo terminar de carregar
  function SESS() {
    return window.SESSAO || { ativado: false };
  }
  function PODE(rec, acao) {
    return window.PODE ? window.PODE(rec, acao) : true;
  }
  const CFGV = {
    tab: "usuarios",
    D: null,
    carregando: false,
    erro: "",
    uf: { q: "", setor: "", perfil: "", status: "" },
    ord: { col: "nome", dir: 1 },
    pag: 1,
    hf: { q: "", uid: "", setor: "", cat: "", de: "", ate: "" },
    hpag: 1,
    H: null,
  };
  const ACAO_TXT = {
    "acesso.login": "Entrou no painel",
    "acesso.logout": "Saiu do painel",
    "acesso.login_falhou": "Tentativa de login recusada",
    "acesso.bloqueio_tentativas": "Bloqueio por tentativas erradas",
    "usuario.criar": "Usuário cadastrado",
    "usuario.editar": "Cadastro alterado",
    "usuario.setor": "Setor alterado",
    "usuario.perfil": "Perfil alterado",
    "usuario.permissoes": "Permissões individuais alteradas",
    "usuario.ativar": "Usuário ativado (desbloqueado)",
    "usuario.desativar": "Usuário desativado (bloqueado)",
    "usuario.excluir": "Usuário excluído",
    "usuario.senha_redefinir_link": "Link de redefinição gerado",
    "usuario.senha_redefinida": "Senha redefinida",
    "usuario.senha_alterada": "Senha alterada",
    "usuario.pedido_redefinicao": "Pediu redefinição de senha",
    "setor.criar": "Setor criado",
    "setor.editar": "Setor renomeado",
    "setor.ativar": "Setor ativado",
    "setor.desativar": "Setor desativado",
    "setor.excluir": "Setor excluído",
    "perfil.criar": "Perfil criado",
    "perfil.editar": "Perfil alterado",
    "perfil.permissoes": "Permissões do perfil alteradas",
    "perfil.excluir": "Perfil excluído",
    "dados.criar": "Registros criados",
    "dados.editar": "Registros alterados",
    "dados.excluir": "Registros excluídos",
    "relatorio.enviar": "E-mail enviado (Enviar agora)",
    "relatorio.teste": "E-mail de teste enviado",
    "relatorio.configurar": "E-mails e relatórios configurados",
  };
  function cfgAbas() {
    return [
      ["usuarios", "Gestão de usuários", PODE("usuarios")],
      ["setores", "Setores", PODE("setores")],
      ["perfis", "Perfis e permissões", PODE("perfis")],
      ["historico", "Histórico de atividades", PODE("historico")],
      ["relatorio", "E-mails e relatórios", PODE("relatorio", "administrar")],
    ].filter((x) => x[2]);
  }
  function temConfig() {
    return !SESS().ativado || cfgAbas().length > 0;
  }
  async function cfgApi(rota, corpo) {
    const r = await fetch(rota, corpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) } : { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) {
      location.replace("login.html?expirou=1&volta=" + encodeURIComponent(location.pathname + location.hash));
      throw new Error("Sessão expirada.");
    }
    if (!r.ok) throw new Error(j.erro || "O servidor respondeu " + r.status);
    return j;
  }
  async function cfgCarregar(silencioso) {
    if (!SESS().ativado) return;
    CFGV.carregando = !silencioso;
    try {
      CFGV.D = await cfgApi("api/admin/resumo");
      // setores em ordem alfabética em todas as listas (cadastro, filtros, histórico)
      if (CFGV.D.setores) CFGV.D.setores.sort((a, b) => COLPT(a.nome, b.nome));
      CFGV.erro = "";
    } catch (e) {
      CFGV.erro = e.message;
    }
    CFGV.carregando = false;
    if (view === "config") renderConfig();
  }
  const fmtQuando = (s) => (s ? fmtDH(s) : "–");
  function iniciais(n) {
    return String(n || "?")
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .filter((c, k, a) => k === 0 || k === a.length - 1)
      .join("")
      .toUpperCase();
  }

  function renderConfig() {
    const v = $("#view");
    if (!SESS().ativado) {
      v.innerHTML = `<header class="top cfgtop"><div class="title-block"><h1 class="cfgh1">Configurações</h1></div></header>
      <section class="panel"><div class="panel-h"><h2>Login ainda não ativado</h2></div><p class="hint">O painel funciona sem login até o primeiro administrador ser criado. No computador do servidor, abra um terminal na pasta do painel e rode:</p><pre class="lgcod">python tools/criar_admin.py</pre><p class="hint">O script pede o seu e-mail, nome, setor e senha (a senha não aparece na tela e só o hash é guardado). A partir daí o painel passa a exigir login, e os demais usuários são cadastrados aqui, em Gestão de usuários.</p></section>`;
      return;
    }
    const abas = cfgAbas();
    if (!abas.length) {
      v.innerHTML = `<section class="panel"><p class="hint">Você não tem acesso às configurações.</p></section>`;
      return;
    }
    if (!abas.some((a) => a[0] === CFGV.tab)) CFGV.tab = abas[0][0];
    const top = `<header class="top cfgtop"><div class="title-block"><h1 class="cfgh1">Configurações</h1><p class="subtitle">Usuários, setores, perfis de permissão e histórico de atividades do painel.</p></div></header>
      <nav class="ctabs cfgtabs">${abas.map(([k, l]) => `<button class="${CFGV.tab === k ? "on" : ""}" data-cfgtab="${k}">${l}</button>`).join("")}</nav>`;
    if (CFGV.tab === "historico") {
      v.innerHTML = top + cfgHistHTML();
      if (!CFGV.H) cfgHistCarregar();
      return;
    }
    if (CFGV.tab === "relatorio") {
      v.innerHTML = top + cfgRelHTML();
      if (CFGV.R && !CFGV.Rerro) relQuemTodos();
      if (!CFGV.R && !CFGV.Rcarregando) cfgRelCarregar();
      return;
    }
    if (!CFGV.D) {
      v.innerHTML = top + (CFGV.erro ? `<section class="panel"><p class="bad">${esc(CFGV.erro)}</p><button class="btn" data-cfgrecarregar>Tentar de novo</button></section>` : `<div class="loading"><span class="spin"></span>Carregando…</div>`);
      if (!CFGV.carregando && !CFGV.erro) cfgCarregar();
      return;
    }
    v.innerHTML = top + (CFGV.tab === "usuarios" ? cfgUsuariosHTML() : CFGV.tab === "setores" ? cfgSetoresHTML() : cfgPerfisHTML());
    const qi = v.querySelector("[data-cfgq]");
    if (qi && CFGV.focoBusca) {
      qi.focus();
      qi.setSelectionRange(qi.value.length, qi.value.length);
      CFGV.focoBusca = false;
    }
  }
  const pill = (txt, cls) => `<span class="cfgst ${cls}">${txt}</span>`;
  const stUsuario = (u) => (!u.ativo ? pill("Inativo", "off") : u.bloqueado ? pill("Bloqueado (tentativas)", "warn") : pill("Ativo", "on"));

  /* ----- usuários ----- */
  function cfgUsuariosHTML() {
    const D = CFGV.D;
    const U = D.usuarios || [];
    const F = CFGV.uf;
    const q = semAcento(F.q.toLowerCase());
    let L = U.filter(
      (u) =>
        (!q || semAcento((u.nome + " " + u.email).toLowerCase()).includes(q)) &&
        (!F.setor || u.setor === F.setor) &&
        (!F.perfil || u.perfil === F.perfil) &&
        (!F.status || (F.status === "ativo" ? u.ativo && !u.bloqueado : F.status === "inativo" ? !u.ativo : u.ativo && u.bloqueado)),
    );
    const chave = { nome: (u) => u.nome, email: (u) => u.email, setor: (u) => u.setorNome, perfil: (u) => u.perfilNome, status: (u) => (u.ativo ? (u.bloqueado ? 1 : 0) : 2) };
    const k = chave[CFGV.ord.col] || chave.nome;
    L = L.slice().sort((a, b) => {
      const x = k(a),
        y = k(b);
      return (typeof x === "number" ? x - y : COLPT(String(x), String(y))) * CFGV.ord.dir;
    });
    const POR = 15;
    const np = Math.max(1, Math.ceil(L.length / POR));
    CFGV.pag = Math.min(CFGV.pag, np);
    const pagL = L.slice((CFGV.pag - 1) * POR, CFGV.pag * POR);
    const ativos = U.filter((u) => u.ativo).length;
    const bloq = U.filter((u) => u.ativo && u.bloqueado).length;
    const eu = SESS().usuario.id;
    const th = (col, txt) => `<th><button class="cfgord ${CFGV.ord.col === col ? "on" : ""}" data-cfgord="${col}" aria-label="Ordenar por ${txt}">${txt}${CFGV.ord.col === col ? (CFGV.ord.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
    const opt = (L2, sel, todos) => `<option value="">${todos}</option>` + L2.map(([v2, l]) => `<option value="${esc(v2)}" ${sel === v2 ? "selected" : ""}>${esc(l)}</option>`).join("");
    const pedidos = D.pedidos || [];
    const adm = PODE("usuarios", "administrar");
    return `<div class="kpis cfgkpis"><div class="kpi"><div class="v">${U.length}</div><div class="l">Usuários cadastrados</div></div><div class="kpi"><div class="v ok">${ativos}</div><div class="l">Ativos</div></div><div class="kpi"><div class="v ${U.length - ativos ? "bad" : ""}">${U.length - ativos}</div><div class="l">Inativos</div></div><div class="kpi"><div class="v ${bloq ? "bad" : ""}">${bloq}</div><div class="l">Bloqueados por tentativas</div></div></div>
    ${pedidos.length && adm ? `<section class="panel cfgped"><div class="panel-h"><h2>Pedidos de redefinição de senha</h2><span class="note">Pedidos feitos em “Esqueci minha senha”. Gere o link e envie ao colaborador.</span></div>${pedidos.map((p) => `<div class="cfgpedl"><span><b>${esc(p.nome)}</b> pediu em ${fmtQuando(p.em)}</span><button class="btn" data-cfgulink="${esc(p.uid)}">Gerar link de redefinição</button></div>`).join("")}</section>` : ""}
    <section class="panel"><div class="cfgbar"><label class="sbw cfgbusca">${SIC.lupa}<input type="search" data-cfgq value="${esc(F.q)}" placeholder="Pesquisar por nome ou e-mail" aria-label="Pesquisar usuário"></label>
      <select data-cfguf="setor" aria-label="Filtrar por setor">${opt((D.setores || []).map((s) => [s.id, s.nome]), F.setor, "Todos os setores")}</select>
      <select data-cfguf="perfil" aria-label="Filtrar por perfil">${opt((D.perfis || []).map((p) => [p.id, p.nome]), F.perfil, "Todos os perfis")}</select>
      <select data-cfguf="status" aria-label="Filtrar por status">${opt([["ativo", "Ativos"], ["inativo", "Inativos"]], F.status, "Todos os status")}</select>
      ${PODE("usuarios", "criar") ? `<button class="btn primary cfgnovo" data-cfgunovo>+ Cadastrar usuário</button>` : ""}</div>
    <div class="scroll"><table class="stack cfgt"><colgroup><col style="width:19%"><col style="width:21%"><col style="width:11%"><col style="width:11%"><col style="width:9%"><col></colgroup><thead><tr>${th("nome", "Usuário")}${th("email", "E-mail")}${th("setor", "Setor")}${th("perfil", "Perfil")}${th("status", "Status")}<th class="c-act">Ações</th></tr></thead><tbody>
    ${pagL.length ? pagL.map((u) => `<tr><td class="full"><span class="cfgu"><span class="cfgav" aria-hidden="true">${esc(iniciais(u.nome))}</span><span><b>${esc(u.nome)}</b>${u.id === eu ? ` <span class="cfgvoce">você</span>` : ""}</span></span></td><td data-l="E-mail">${esc(u.email)}</td><td data-l="Setor">${esc(u.setorNome || "–")}</td><td data-l="Perfil">${esc(u.perfilNome || "–")}${Object.keys(u.perms || {}).length ? ` <span class="cfgind" title="Tem permissões individuais além do perfil">+ ind.</span>` : ""}</td><td data-l="Status">${stUsuario(u)}</td>
      <td class="c-act"><div class="cfgacts"><button class="btn ghost" data-cfguver="${u.id}">Ver</button>${PODE("usuarios", "editar") ? `<button class="btn ghost" data-cfguedit="${u.id}">Editar</button>` : ""}${adm && u.id !== eu ? (u.ativo ? `<button class="btn ghost" data-cfgudes="${u.id}">${u.bloqueado ? "Desbloquear" : "Desativar"}</button>` : `<button class="btn ghost" data-cfguat="${u.id}">Ativar</button>`) : ""}${PODE("usuarios", "excluir") && u.id !== eu ? `<button class="btn ghost danger" data-cfgudel="${u.id}" ${u.ultimoLogin ? `title="Já acessou o painel: para manter o histórico, desative em vez de excluir"` : ""}>Excluir</button>` : ""}</div></td></tr>`).join("") : `<tr><td colspan="6" class="hint">Nenhum usuário encontrado com esses filtros.</td></tr>`}
    </tbody></table></div>
    <div class="cfgpag"><span class="mut">${L.length} usuário${L.length === 1 ? "" : "s"}${L.length !== U.length ? ` de ${U.length}` : ""}</span>${np > 1 ? `<span><button class="btn ghost" data-cfgpag="-1" ${CFGV.pag <= 1 ? "disabled" : ""} aria-label="Página anterior">‹</button> Página ${CFGV.pag} de ${np} <button class="btn ghost" data-cfgpag="1" ${CFGV.pag >= np ? "disabled" : ""} aria-label="Próxima página">›</button></span>` : ""}</div></section>`;
  }
  // matriz de permissões (recursos × ações); val: {rec: [acoes]}; herda: permissões do perfil (individuais)
  function cfgMatriz(val, editavel, herda) {
    const R = CFGV.D.recursos,
      A = CFGV.D.acoes;
    const meu = (SESS().perms || {});
    return `<div class="scroll"><table class="cfgmat"><thead><tr><th>Funcionalidade</th>${Object.entries(A).map(([k, l]) => `<th>${l}</th>`).join("")}${herda ? "<th>Origem</th>" : ""}</tr></thead><tbody>${R.map((r) => {
      const ind = herda && Object.prototype.hasOwnProperty.call(val, r.id);
      const cur = ind || !herda ? val[r.id] || [] : herda[r.id] || [];
      return `<tr data-rec="${r.id}"><th scope="row">${esc(r.nome)}</th>${Object.keys(A).map((a) => (r.acoes.includes(a) ? `<td><input type="checkbox" data-m="${r.id}|${a}" ${cur.includes(a) ? "checked" : ""} ${!editavel || (herda && !ind) || !(meu[r.id] || []).includes(a) ? "disabled" : ""} aria-label="${esc(r.nome)}: ${A[a]}"></td>` : `<td class="mut">–</td>`)).join("")}${herda ? `<td><label class="cfgherda"><input type="checkbox" data-ind="${r.id}" ${ind ? "checked" : ""} ${editavel ? "" : "disabled"}> individual</label></td>` : ""}</tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function lerMatriz(f, herda) {
    const out = {};
    CFGV.D.recursos.forEach((r) => {
      if (herda && !(f.querySelector(`[data-ind="${r.id}"]`) || {}).checked) return;
      out[r.id] = [...f.querySelectorAll(`[data-m^="${r.id}|"]`)].filter((c) => c.checked).map((c) => c.dataset.m.split("|")[1]);
    });
    return out;
  }
  function cfgDlg(html, largo) {
    const d = $("#dlgCfg"),
      f = $("#formCfg");
    d.classList.toggle("largo", !!largo);
    f.innerHTML = html;
    f.onsubmit = (e) => e.preventDefault();
    f.onclick = null;
    f.onchange = null;
    if (!d.open) d.showModal();
    return { d, f };
  }
  const OLHO_CFG = `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  function cfgUsuarioForm(id) {
    const D = CFGV.D;
    const u = id ? D.usuarios.find((x) => x.id === id) : null;
    const adm = PODE("usuarios", "administrar");
    const perfilSel = u ? u.perfil : adm ? "colaborador" : "consulta";
    const perfisL = D.perfis.filter((p) => adm || p.id === "consulta" || (u && p.id === u.perfil));
    const perfDe = (pid) => (D.perfis.find((p) => p.id === pid) || {}).perms || {};
    const { d, f } = cfgDlg(
      `<h3>${u ? "Editar usuário" : "Cadastrar usuário"}</h3><div class="fgrid">
      <label class="fwide">Nome completo<input name="nome" required maxlength="120" value="${esc(u ? u.nome : "")}" autocomplete="off"></label>
      <label class="fwide">E-mail corporativo<input name="email" type="email" required maxlength="254" value="${esc(u ? u.email : "")}" autocomplete="off" placeholder="nome@dgt.com.br" list="cfgPortalUs"><span class="fdica">O mesmo do login do Microsoft 365: é por ele que a pessoa é reconhecida ao abrir o portal.</span></label><datalist id="cfgPortalUs">${(D.portalUsuarios || []).map((p) => `<option value="${esc(p.email)}">${esc(p.nome)}</option>`).join("")}</datalist>
      ${true ? "" : `<label class="fwide">Senha inicial<span class="lgsenha"><input name="senha" type="password" required maxlength="200" autocomplete="new-password"><button type="button" class="ico lgolho" data-olho aria-label="Mostrar a senha" aria-pressed="false">${OLHO_CFG}</button></span><span class="fdica">Mínimo de 8 caracteres, com letras e números. O colaborador troca no primeiro acesso.</span></label>`}
      <label>Setor<select name="setor" required><option value="">Escolha…</option>${D.setores.filter((s) => s.ativo || (u && u.setor === s.id)).map((s) => `<option value="${s.id}" ${u && u.setor === s.id ? "selected" : ""}>${esc(s.nome)}${s.ativo ? "" : " (inativo)"}</option>`).join("")}</select></label>
      <label>Perfil de permissão<select name="perfil" required>${perfisL.map((p) => `<option value="${p.id}" ${perfilSel === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
      ${u ? "" : `<label>Status<select name="ativo"><option value="1">Ativo</option><option value="0">Inativo</option></select></label>`}
      </div>
      ${adm ? `<details class="cfgdet" ${u && Object.keys(u.perms || {}).length ? "open" : ""}><summary>Permissões individuais (opcional)</summary><p class="hint">Marque “individual” numa funcionalidade para substituir o que o perfil concede só para este usuário.</p><div id="cfgMatU">${cfgMatriz(u ? u.perms || {} : {}, true, perfDe(perfilSel))}</div></details>` : ""}
      <p class="lgmsg err" hidden></p>
      <div class="actions"><button type="button" class="btn" data-cfgfechar>Cancelar</button><button class="btn primary" type="submit">${u ? "Salvar" : "Cadastrar"}</button></div>`,
      true,
    );
    const erro = (t) => {
      const m = f.querySelector(".lgmsg");
      m.textContent = t;
      m.hidden = !t;
    };
    const redesenhaMatriz = () => {
      const box = f.querySelector("#cfgMatU");
      if (!box) return;
      const atual = lerMatriz(f, true);
      box.innerHTML = cfgMatriz(atual, true, perfDe(f.perfil.value));
    };
    f.perfil.onchange = redesenhaMatriz;
    f.onchange = (e) => {
      if (e.target.dataset.ind) {
        const atual = lerMatriz(f, true);
        if (!e.target.checked) delete atual[e.target.dataset.ind];
        else atual[e.target.dataset.ind] = (perfDe(f.perfil.value)[e.target.dataset.ind] || []).slice();
        f.querySelector("#cfgMatU").innerHTML = cfgMatriz(atual, true, perfDe(f.perfil.value));
      }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const corpo = { acao: u ? "editar" : "criar", id: u ? u.id : "", nome: f.nome.value, email: f.email.value, setor: f.setor.value, perfil: f.perfil.value };
      if (!u) corpo.ativo = f.ativo.value === "1";
      if (adm) corpo.perms = lerMatriz(f, true);
      const b = f.querySelector('[type="submit"]');
      b.disabled = true;
      try {
        await cfgApi("api/admin/usuario", corpo);
        d.close();
        toast(u ? "Usuário atualizado. Vale quando a pessoa abrir o painel de novo." : "Usuário cadastrado. Ele já pode abrir Implantações no portal.");
        cfgCarregar(true);
      } catch (err) {
        erro(err.message);
      }
      b.disabled = false;
    };
    // e-mail escolhido da lista do portal: preenche o nome
    f.email.addEventListener("change", () => {
      const p = (D.portalUsuarios || []).find((x) => x.email.toLowerCase() === f.email.value.trim().toLowerCase());
      if (p && !f.nome.value.trim()) f.nome.value = p.nome;
    });
    f.nome.focus();
  }
  function cfgUsuarioVer(id) {
    const D = CFGV.D;
    const u = D.usuarios.find((x) => x.id === id);
    if (!u) return;
    const nomeDe = (uid) => (uid === "console" ? "Console do servidor" : (D.usuarios.find((x) => x.id === uid) || {}).nome || "–");
    const perf = D.perfis.find((p) => p.id === u.perfil) || {};
    const ef = Object.assign({}, perf.perms || {}, u.perms || {});
    const R = D.recursos.filter((r) => (ef[r.id] || []).length);
    const { f } = cfgDlg(
      `<h3><span class="cfgu"><span class="cfgav" aria-hidden="true">${esc(iniciais(u.nome))}</span>${esc(u.nome)}</span></h3>
      <dl class="cfgdl"><dt>E-mail</dt><dd>${esc(u.email)}</dd><dt>Setor</dt><dd>${esc(u.setorNome || "–")}</dd><dt>Perfil</dt><dd>${esc(u.perfilNome || "–")}</dd><dt>Status</dt><dd>${stUsuario(u)}${u.trocarSenha ? ` <span class="mut">· troca a senha no próximo acesso</span>` : ""}</dd>
      <dt>Último acesso</dt><dd>${fmtQuando(u.ultimoLogin)}</dd><dt>Cadastrado</dt><dd>${fmtQuando(u.criadoEm)} · por ${esc(nomeDe(u.criadoPor))}</dd><dt>Última alteração</dt><dd>${fmtQuando(u.atualizadoEm)} · por ${esc(nomeDe(u.atualizadoPor))}</dd></dl>
      <h4>Acesso efetivo</h4>${R.length ? `<ul class="cfgacc">${R.map((r) => `<li><b>${esc(r.nome)}</b>${(ef[r.id] || []).map((a) => D.acoes[a]).join(", ")}${(u.perms || {})[r.id] ? ` <span class="cfgind">individual</span>` : ""}</li>`).join("")}</ul>` : `<p class="hint">Nenhum acesso.</p>`}
      <div class="actions">${PODE("historico") ? `<button type="button" class="btn" data-cfghistu="${u.id}">Ver histórico deste usuário</button>` : ""}<button type="button" class="btn primary" data-cfgfechar>Fechar</button></div>`,
      true,
    );
    f.querySelector("[data-cfgfechar]").focus();
  }
  async function cfgUsuarioAcao(id, acao) {
    const u = CFGV.D.usuarios.find((x) => x.id === id);
    if (!u) return;
    const T = {
      desativar: [u.bloqueado ? `Desbloquear ${u.nome}? As tentativas erradas são zeradas.` : `Desativar ${u.nome}? Ele perde o acesso ao painel (quem estiver com o painel aberto perde ao recarregar). O cadastro e o histórico continuam.`, u.bloqueado ? "Desbloquear" : "Desativar"],
      ativar: [`Ativar ${u.nome}? Ele volta a poder entrar no painel.`, "Ativar"],
      excluir: [`Excluir ${u.nome} definitivamente? Só é possível para quem nunca acessou o painel.`, "Excluir"],
    }[acao];
    if (!(await askConfirm(T[0], T[1]))) return;
    try {
      // desbloquear (bloqueio por tentativas) = ativar de novo, que zera as tentativas
      await cfgApi("api/admin/usuario", { acao: acao === "desativar" && u.bloqueado ? "ativar" : acao, id });
      toast(acao === "excluir" ? "Usuário excluído." : acao === "ativar" || u.bloqueado ? "Acesso liberado." : "Usuário desativado.");
      cfgCarregar(true);
    } catch (e) {
      toast(e.message);
    }
  }
  async function cfgLinkSenha(id) {
    const u = CFGV.D.usuarios.find((x) => x.id === id);
    if (!u) return;
    if (!(await askConfirm(`Gerar um link de redefinição de senha para ${u.nome}? O link vale 24 horas; a senha atual continua valendo até ele criar a nova.`, "Gerar link"))) return;
    try {
      const r = await cfgApi("api/admin/usuario", { acao: "link_senha", id });
      const { f } = cfgDlg(
        `<h3>Link de redefinição · ${esc(u.nome)}</h3><p class="hint">${r.enviado ? `Enviado também por e-mail para <b>${esc(r.email)}</b>.` : `Envie este link para <b>${esc(r.email)}</b> (Teams ou e-mail). Ele vale 24 horas e só pode ser usado uma vez.`} Você não vê nem define a senha: o colaborador cria a dele.</p>
        <label class="fwide">Link<input readonly value="${esc(r.link)}" id="cfgLinkIn"></label>
        <div class="actions"><button type="button" class="btn" data-cfgfechar>Fechar</button><button type="button" class="btn primary" id="cfgCopiar">Copiar link</button></div>`,
      );
      const inp = f.querySelector("#cfgLinkIn");
      inp.select();
      f.querySelector("#cfgCopiar").onclick = () => {
        inp.select();
        copiarTexto(inp.value).then((ok) => toast(ok ? "Link copiado." : "Link selecionado: use Ctrl+C."));
      };
      cfgCarregar(true);
    } catch (e) {
      toast(e.message);
    }
  }

  /* ----- setores ----- */
  function cfgSetoresHTML() {
    const S = (CFGV.D.setores || []).slice().sort((a, b) => COLPT(a.nome, b.nome));
    const ativos = S.filter((s) => s.ativo).length;
    return `<div class="kpis cfgkpis"><div class="kpi"><div class="v">${S.length}</div><div class="l">Setores</div></div><div class="kpi"><div class="v ok">${ativos}</div><div class="l">Ativos</div></div><div class="kpi"><div class="v">${S.length - ativos}</div><div class="l">Inativos</div></div><div class="kpi"><div class="v">${S.reduce((t, s) => t + s.usuarios, 0)}</div><div class="l">Usuários vinculados</div></div></div>
    <section class="panel"><div class="cfgbar"><span class="note">Setores inativos deixam de aparecer no cadastro de novos usuários. Um setor com usuários vinculados não pode ser excluído.</span>${PODE("setores", "criar") ? `<button class="btn primary cfgnovo" data-cfgsnovo>+ Novo setor</button>` : ""}</div>
    <div class="scroll"><table class="stack cfgt"><colgroup><col style="width:40%"><col style="width:20%"><col style="width:15%"><col></colgroup><thead><tr><th>Setor</th><th>Usuários vinculados</th><th>Status</th><th class="c-act">Ações</th></tr></thead><tbody>
    ${S.map((s) => `<tr><td class="full"><b>${esc(s.nome)}</b></td><td data-l="Usuários" class="num">${s.usuarios}</td><td data-l="Status">${s.ativo ? pill("Ativo", "on") : pill("Inativo", "off")}</td><td class="c-act"><div class="cfgacts">${PODE("usuarios") && s.usuarios ? `<button class="btn ghost" data-cfgsver="${s.id}">Ver usuários</button>` : ""}${PODE("setores", "editar") ? `<button class="btn ghost" data-cfgsedit="${s.id}">Renomear</button><button class="btn ghost" data-cfgsat="${s.id}|${s.ativo ? "desativar" : "ativar"}">${s.ativo ? "Desativar" : "Ativar"}</button>` : ""}${PODE("setores", "excluir") ? `<button class="btn ghost danger" data-cfgsdel="${s.id}" ${s.usuarios ? `disabled title="Tem ${s.usuarios} usuário(s) vinculado(s)"` : ""}>Excluir</button>` : ""}</div></td></tr>`).join("")}
    </tbody></table></div></section>`;
  }
  function cfgSetorForm(id) {
    const s = id ? CFGV.D.setores.find((x) => x.id === id) : null;
    const { d, f } = cfgDlg(`<h3>${s ? "Renomear setor" : "Novo setor"}</h3><label class="fwide">Nome do setor<input name="nome" required maxlength="80" value="${esc(s ? s.nome : "")}"></label><p class="lgmsg err" hidden></p><div class="actions"><button type="button" class="btn" data-cfgfechar>Cancelar</button><button class="btn primary" type="submit">${s ? "Salvar" : "Criar setor"}</button></div>`);
    f.nome.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await cfgApi("api/admin/setor", { acao: s ? "editar" : "criar", id: s ? s.id : "", nome: f.nome.value });
        d.close();
        toast(s ? "Setor renomeado." : "Setor criado.");
        cfgCarregar(true);
      } catch (err) {
        const m = f.querySelector(".lgmsg");
        m.textContent = err.message;
        m.hidden = false;
      }
    };
  }

  /* ----- perfis e permissões ----- */
  function cfgPerfisHTML() {
    const P = CFGV.D.perfis || [];
    const R = CFGV.D.recursos;
    return `<section class="panel"><div class="cfgbar"><span class="note">Cada perfil define o que pode ser feito em cada funcionalidade. As permissões são conferidas no servidor a cada operação. Permissões individuais de um usuário (em Gestão de usuários) substituem as do perfil naquela funcionalidade.</span>${PODE("perfis", "criar") ? `<button class="btn primary cfgnovo" data-cfgpnovo>+ Novo perfil</button>` : ""}</div>
    <div class="cfgperfis">${P.map((p) => `<article class="cfgperf"><div class="cfgperfh"><h3>${esc(p.nome)}${p.sistema ? ` <span class="cfgind">inicial</span>` : ""}</h3><span class="mut">${p.usuarios} usuário${p.usuarios === 1 ? "" : "s"}</span></div><p class="hint">${esc(p.descricao || "")}</p>
      <ul class="cfgacc">${R.filter((r) => (p.perms[r.id] || []).length).map((r) => `<li><b>${esc(r.nome)}</b>${p.perms[r.id].map((a) => CFGV.D.acoes[a]).join(", ")}</li>`).join("") || `<li class="mut">Nenhum acesso.</li>`}</ul>
      <div class="cfgacts">${p.total ? `<span class="mut">Acesso completo e fixo</span>` : `${PODE("perfis", "editar") ? `<button class="btn ghost" data-cfgpedit="${p.id}">Editar permissões</button>` : ""}${PODE("perfis", "excluir") && !p.sistema ? `<button class="btn ghost danger" data-cfgpdel="${p.id}" ${p.usuarios ? `disabled title="Tem usuários com este perfil"` : ""}>Excluir</button>` : ""}`}</div></article>`).join("")}</div></section>`;
  }
  function cfgPerfilForm(id) {
    const p = id ? CFGV.D.perfis.find((x) => x.id === id) : null;
    const { d, f } = cfgDlg(
      `<h3>${p ? "Editar perfil" : "Novo perfil"}</h3><div class="fgrid"><label>Nome<input name="nome" required maxlength="60" value="${esc(p ? p.nome : "")}"></label><label class="fwide">Descrição<input name="descricao" maxlength="240" value="${esc(p ? p.descricao : "")}"></label></div>
      <h4>Permissões por funcionalidade</h4>${cfgMatriz(p ? p.perms : {}, true, null)}<p class="hint">Só é possível conceder permissões que você também tem.</p>
      <p class="lgmsg err" hidden></p><div class="actions"><button type="button" class="btn" data-cfgfechar>Cancelar</button><button class="btn primary" type="submit">${p ? "Salvar" : "Criar perfil"}</button></div>`,
      true,
    );
    f.nome.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await cfgApi("api/admin/perfil", { acao: p ? "editar" : "criar", id: p ? p.id : "", nome: f.nome.value, descricao: f.descricao.value, perms: lerMatriz(f, null) });
        d.close();
        toast(p ? "Perfil atualizado. Vale já para todos os usuários com este perfil." : "Perfil criado.");
        cfgCarregar(true);
      } catch (err) {
        const m = f.querySelector(".lgmsg");
        m.textContent = err.message;
        m.hidden = false;
      }
    };
  }

  /* ----- histórico de atividades (consulta no servidor, paginada) ----- */
  async function cfgHistCarregar() {
    const q = new URLSearchParams(Object.entries(Object.assign({}, CFGV.hf, { pag: CFGV.hpag, por: 50 })).filter(([, v]) => v !== "" && v != null));
    try {
      CFGV.H = await cfgApi("api/admin/historico?" + q.toString());
      CFGV.herro = "";
    } catch (e) {
      CFGV.H = { total: 0, itens: [], pag: 1, por: 50 };
      CFGV.herro = e.message;
    }
    if (!CFGV.D && SESS().ativado) await cfgCarregar(true);
    if (view === "config" && CFGV.tab === "historico") renderConfig();
  }
  function cfgHistHTML() {
    const H = CFGV.H;
    const F = CFGV.hf;
    const D = CFGV.D || {};
    const nomes = (D.nomesUsuarios || D.usuarios || []).slice().sort((a, b) => COLPT(a.nome, b.nome));
    const opt = (L, sel, todos) => `<option value="">${todos}</option>` + L.map(([v2, l]) => `<option value="${esc(v2)}" ${sel === v2 ? "selected" : ""}>${esc(l)}</option>`).join("");
    const np = H ? Math.max(1, Math.ceil(H.total / H.por)) : 1;
    return `<section class="panel"><div class="cfgbar cfghbar"><label class="sbw cfgbusca">${SIC.lupa}<input type="search" data-cfghq value="${esc(F.q)}" placeholder="Pesquisar (nome, ação, registro)" aria-label="Pesquisar no histórico"></label>
      <select data-cfghf="uid" aria-label="Usuário">${opt(nomes.map((u) => [u.id, u.nome]), F.uid, "Todos os usuários")}</select>
      <select data-cfghf="setor" aria-label="Setor">${opt((D.setores || []).map((s) => [s.nome, s.nome]), F.setor, "Todos os setores")}</select>
      <select data-cfghf="cat" aria-label="Tipo">${opt(Object.entries((D.categorias || { acesso: "Acesso", usuario: "Usuários", setor: "Setores", perfil: "Perfis e permissões", dados: "Dados" })), F.cat, "Todos os tipos")}</select>
      <label class="cfgdata">De<input type="date" data-cfghf="de" value="${esc(F.de)}"></label><label class="cfgdata">Até<input type="date" data-cfghf="ate" value="${esc(F.ate)}"></label>
      ${PODE("historico", "exportar") ? `<button class="btn" data-cfghcsv>Exportar CSV</button>` : ""}</div>
    ${CFGV.herro ? `<p class="bad">${esc(CFGV.herro)}</p>` : ""}
    ${!H ? `<div class="loading"><span class="spin"></span>Carregando…</div>` : `<div class="scroll"><table class="stack cfgt cfght"><colgroup><col style="width:130px"><col style="width:17%"><col style="width:12%"><col style="width:20%"><col style="width:17%"><col></colgroup><thead><tr><th>Data e hora</th><th>Usuário</th><th>Setor</th><th>Ação</th><th>Registro afetado</th><th>Detalhe</th></tr></thead><tbody>
      ${H.itens.length ? H.itens.map((e) => `<tr><td class="nw">${fmtQuando(e.em)}</td><td data-l="Usuário">${esc(e.nome || "–")}</td><td data-l="Setor">${esc(e.setor || "–")}</td><td data-l="Ação"><span class="cfgacao c-${esc(String(e.acao).split(".")[0])}">${esc(ACAO_TXT[e.acao] || e.acao)}</span></td><td data-l="Registro">${esc((e.alvo && (e.alvo.nome || e.alvo.id)) || "–")}</td><td data-l="Detalhe" class="cfgdetl">${esc(e.detalhe || "") || `<span class="mut">–</span>`}</td></tr>`).join("") : `<tr><td colspan="6" class="hint">Nenhuma atividade encontrada com esses filtros.</td></tr>`}
      </tbody></table></div>
      <div class="cfgpag"><span class="mut">${H.total} evento${H.total === 1 ? "" : "s"}</span>${np > 1 ? `<span><button class="btn ghost" data-cfghpag="-1" ${CFGV.hpag <= 1 ? "disabled" : ""} aria-label="Página anterior">‹</button> Página ${CFGV.hpag} de ${np} <button class="btn ghost" data-cfghpag="1" ${CFGV.hpag >= np ? "disabled" : ""} aria-label="Próxima página">›</button></span>` : ""}</div>`}</section>`;
  }
  async function cfgHistCSV() {
    const L = [];
    let pag = 1;
    for (;;) {
      const q = new URLSearchParams(Object.entries(Object.assign({}, CFGV.hf, { pag, por: 200 })).filter(([, v]) => v !== "" && v != null));
      const r = await cfgApi("api/admin/historico?" + q.toString());
      L.push(...r.itens);
      if (pag * r.por >= r.total || pag > 200) break;
      pag++;
    }
    const c = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const linhas = [["Data e hora", "Usuário", "Setor", "Ação", "Registro afetado", "Detalhe"]].concat(L.map((e) => [fmtQuando(e.em), e.nome, e.setor, ACAO_TXT[e.acao] || e.acao, (e.alvo && (e.alvo.nome || e.alvo.id)) || "", e.detalhe]));
    const blob = new Blob(["﻿" + linhas.map((l) => l.map(c).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `historico-atividades-${todayISO()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }


  /* ----- relatório semanal por e-mail (tools/relatorio.py; enviado pelo servidor) ----- */
  const DIAS_S = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  async function cfgRelCarregar() {
    CFGV.Rcarregando = true;
    try {
      CFGV.R = await cfgApi("api/admin/relatorio");
      CFGV.Rerro = "";
    } catch (e) {
      CFGV.Rerro = e.message;
    }
    CFGV.Rcarregando = false;
    if (view === "config" && CFGV.tab === "relatorio") renderConfig();
  }
  const REL_DESC = {
    pendencias: "Cada pessoa recebe as próprias atividades (atrasadas, de hoje e dos próximos 7 dias). Quem não tem pendências na semana não recebe.",
    gerencial: "Resumo da equipe: pendências por pessoa, projetos com mais atrasos, ações vencidas e campo sem finalização.",
    cronogramas: "Situação do cronograma de cada projeto (atrasadas, próximos 15 dias, etapas e término), entregue aos contatos do cliente cadastrados no projeto. Abaixo, quem da equipe também recebe.",
  };
  function cfgRelHTML() {
    if (CFGV.Rerro) return `<section class="panel"><p class="bad">${esc(CFGV.Rerro)}</p></section>`;
    const R = CFGV.R;
    if (!R) return `<div class="loading"><span class="spin"></span>Carregando…</div>`;
    const c = R.cfg;
    const U = R.usuarios.filter((u) => u.ativo && u.email);
    const NT = Object.fromEntries(R.tiposNomes || []);
    const okEmail = R.email.configurado;
    const marcaTodos = (nome) => `<span class="relsel"><button type="button" class="lnk" data-relsel="${nome}" data-v="1">marcar todos</button> · <button type="button" class="lnk" data-relsel="${nome}" data-v="0">desmarcar todos</button></span>`;
    const secao = (tipo) => {
      const t = c.tipos[tipo];
      const perfis = new Set(t.perfis == null ? R.perfis.map((p) => p.id) : t.perfis);
      const us = new Set(t.usuarios || []);
      const hor = t.horarios || [];
      const cron = tipo === "cronogramas";
      const todosProj = cron && t.projetos == null;
      const projs = new Set(t.projetos || []);
      const contPerfil = (id) => U.filter((u) => u.perfil === id).length;
      return `<section class="panel reltipo" data-tipo="${tipo}"><div class="panel-h"><h2>${esc(NT[tipo] || tipo)}</h2></div>
        <p class="hint">${REL_DESC[tipo]}</p>
        <label class="relchk"><input type="checkbox" name="ativo" ${t.ativo ? "checked" : ""}> Enviar automaticamente</label>
        ${(() => {
          // recorrência (portal): diária com 1 hora; semanal/quinzenal com hora por dia; mensal com vários dias, cada um com hora
          const rc = Object.assign({ freq: "semanal", hora: "07:00", semana: [{ dia: 0, hora: "07:00" }], mes: [{ dia: 1, hora: "07:00" }] }, t.recorrencia || {});
          const semH = {};
          (rc.semana || []).forEach((h) => (semH[h.dia] = h.hora));
          const sem = rc.freq === "semanal" || rc.freq === "quinzenal";
          const linhaMes = (h) => `<span class="relrecm"><label>Dia<input type="number" name="recmesd" min="1" max="31" value="${+h.dia || 1}"></label><label>Hora<input type="time" name="recmesh" value="${esc(h.hora || "07:00")}"></label><button type="button" class="ico rm" data-relmesrm aria-label="Remover este dia">×</button></span>`;
          return `<div class="relrec"><label>Recorrência<select name="freq">${[["diaria", "Diária (segunda a sexta)"], ["semanal", "Semanal"], ["quinzenal", "Quinzenal (a cada duas semanas)"], ["mensal", "Mensal"]].map(([v2, l]) => `<option value="${v2}" ${rc.freq === v2 ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="relrecdiaria" ${rc.freq === "diaria" ? "" : "hidden"}>Hora<input type="time" name="hora" value="${esc(rc.hora || "07:00")}"></label></div>
          <div class="relrecsem" ${sem ? "" : "hidden"}><span class="relrecleg">Dias e horários</span>${DIAS_S.map((d, j) => `<label class="relrecd ${semH[j] ? "on" : ""}"><input type="checkbox" name="recdia" value="${j}" ${semH[j] ? "checked" : ""}><span>${d.slice(0, 3)}</span><input type="time" name="recdiah" data-dia="${j}" value="${esc(semH[j] || "07:00")}" ${semH[j] ? "" : "disabled"} aria-label="Hora de ${d}"></label>`).join("")}</div>
          <div class="relrecmes" ${rc.freq === "mensal" ? "" : "hidden"}><span class="relrecleg">Dias do mês e horários</span><div class="relrecmesl">${(rc.mes && rc.mes.length ? rc.mes : [{ dia: 1, hora: "07:00" }]).map(linhaMes).join("")}</div><button type="button" class="btn ghost" data-relmesadd>+ Adicionar dia</button><span class="hint">Dia 29, 30 ou 31 em mês mais curto = último dia do mês.</span></div>`;
        })()}
        ${cron ? `<fieldset class="relger relcli"><legend>Clientes</legend><label class="relchk"><input type="checkbox" name="clientes" ${t.clientes !== false ? "checked" : ""}> Enviar a cada projeto aos contatos do cliente cadastrados (Stakeholders › Cliente, com e-mail preenchido)</label>
            <p class="hint">Cada contato recebe só o cronograma do próprio projeto, sem o link do painel. Para incluir ou corrigir um contato, edite os stakeholders do cliente no projeto.</p>${relCliHTML(t)}</fieldset>` : ""}
        ${cron ? `<fieldset class="relger"><legend>Projetos</legend><label class="relchk"><input type="checkbox" name="todosProj" ${todosProj ? "checked" : ""}> Todos os projetos em andamento (inclui os que forem criados)</label>
            <div class="relproj">${marcaTodos("proj")}${R.projetos.map((p) => `<label class="relchk"><input type="checkbox" name="proj" value="${esc(p.id)}" ${todosProj || projs.has(p.id) ? "checked" : ""} ${todosProj ? "disabled" : ""}> ${esc(p.nome)}</label>`).join("")}</div></fieldset>
          <label class="rellink">Conteúdo<select name="conteudo"><option value="resumo" ${t.conteudo !== "completo" ? "selected" : ""}>Resumido: todos os projetos num só e-mail (atrasadas, próximos 15 dias, término)</option><option value="completo" ${t.conteudo === "completo" ? "selected" : ""}>Completo: um e-mail por projeto, com todas as atividades e as etapas</option></select></label>
          <label class="relchk"><input type="checkbox" name="alocados" ${t.alocados ? "checked" : ""}> Enviar também a cada usuário o cronograma dos projetos em que está alocado como stakeholder DGT</label>` : ""}
        ${cron ? `<h3 class="relsub">Equipe DGT que também recebe</h3>` : ""}
        <div class="relcols">
          <fieldset class="relger"><legend>Por perfil de usuário</legend>${R.perfis.map((p) => `<label class="relchk"><input type="checkbox" name="perfil" value="${esc(p.id)}" ${perfis.has(p.id) ? "checked" : ""}> ${esc(p.nome)} <span class="mut">(${contPerfil(p.id)})</span></label>`).join("")}</fieldset>
          <fieldset class="relger"><legend>Por usuário</legend>${U.length ? marcaTodos("usuario") + U.map((u) => { const pp = perfis.has(u.perfil); return `<label class="relchk${pp ? " relpp" : ""}"><input type="checkbox" name="usuario" value="${esc(u.id)}" data-perfil="${esc(u.perfil || "")}" data-exp="${us.has(u.id) ? 1 : 0}" ${pp || us.has(u.id) ? "checked" : ""} ${pp ? "disabled" : ""}> ${esc(u.nome)} <span class="mut">${esc(u.email)}</span><span class="relpptx"> · pelo perfil</span></label>`; }).join("") : `<p class="hint">Nenhum usuário ativo com e-mail.</p>`}</fieldset>
        </div>
        ${tipo === "pendencias" ? "" : `<label class="rellink">Outros e-mails (fora do painel), um por linha ou separados por vírgula<textarea name="extras" rows="2" placeholder="nome@dgt.com.br">${esc((t.extras || []).join("\n"))}</textarea></label>`}
        <div class="relquem" data-relquem></div>
        <div class="actions relacts"><button type="button" class="btn" data-relprev="${tipo}">Prévia${tipo === "pendencias" ? ": minhas atividades" : cron ? ": equipe" : ""}</button>${cron ? `<button type="button" class="btn" data-relprev="${tipo}" data-cli="1">Prévia: e-mail do cliente</button>` : ""}<button type="button" class="btn" data-relteste="${tipo}">Enviar teste para mim</button><button type="button" class="btn primary" data-relagora="${tipo}">Enviar agora</button></div>
      </section>`;
    };
    const tipos = (R.tiposNomes || []).map((x) => x[0]);
    return `<section class="panel"><div class="panel-h"><h2>Como os e-mails saem</h2></div><p class="hint">Os e-mails entram na fila do Portal DGT (tabela <b>E-mail de implantações</b>) e são enviados pelo fluxo do Power Automate. O envio automático é disparado quando alguém da equipe (Editor, Gestor ou Administrador) está com o painel aberto no horário marcado ou depois dele, no mesmo dia.</p></section>
    <form id="relForm" class="relform">
      <p class="hint relnota">Cada envio tem a própria recorrência e os próprios destinatários. A prévia, o teste e o “Enviar agora” usam o que está salvo.</p>
      ${tipos.map(secao).join("")}
      <section class="panel"><label class="rellink">Endereço do portal nos links dos e-mails<input name="link" value="${esc(R.link)}" placeholder="https://…sharepoint.com/sites/…"></label>
        <div class="actions"><button class="btn primary" type="submit">Salvar programação</button></div></section>
    </form>
    <section class="panel"><div class="panel-h"><h2>Últimos envios</h2></div>${
      (c.enviados || []).length
        ? `<div class="scroll"><table class="stack cfgt"><thead><tr><th>Quando</th><th>Envio</th><th>Motivo</th><th class="num">E-mails</th><th>Falhas</th></tr></thead><tbody>${c.enviados.map((x) => `<tr><td class="nw">${fmtQuando(x.em)}</td><td>${esc(x.tipo ? NT[x.tipo] || x.tipo : "Pendências e gerencial")}</td><td>${esc(x.motivo)}</td><td class="num">${x.enviados}${x.pulados ? ` <span class="mut">(${x.pulados} sem ${x.tipo === "cronogramas" ? "projetos" : "pendências"})</span>` : ""}</td><td class="${(x.falhas || []).length ? "bad" : ""}">${(x.falhas || []).map(esc).join("<br>") || "–"}</td></tr>`).join("")}</tbody></table></div>`
        : `<p class="hint">Nenhum envio ainda.</p>`
    }</section>`;
  }
  // contatos de cliente (salvos) dos projetos marcados
  function relCliHTML(t) {
    const R = CFGV.R;
    const ok = t.projetos == null ? null : new Set(t.projetos);
    const cli = (R.destinatarios.cronogramas || []).filter((x) => x.cliente && (!ok || ok.has(x.projetos[0])));
    const sem = (R.destinatarios.cronSemCliente || []).filter((x) => !ok || ok.has(x.id));
    const por = new Map();
    cli.forEach((x) => (por.get(x.projetoNome) || por.set(x.projetoNome, []).get(x.projetoNome)).push(x));
    return `<div data-relcli><details class="reldet"><summary>${cli.length} contato${cli.length !== 1 ? "s" : ""} de cliente em ${por.size} projeto${por.size !== 1 ? "s" : ""}</summary><ul class="relcliul">${[...por].map(([pn, L]) => `<li><b>${esc(pn)}</b>: ${L.map((x) => `${esc(x.nome)}${x.funcao ? ` <span class="mut">(${esc(x.funcao)})</span>` : ""} <span class="mut">${esc(x.email)}</span>`).join("; ")}</li>`).join("") || "<li class=\"mut\">Nenhum</li>"}</ul></details>${
      sem.length ? `<details class="reldet"><summary class="relaviso">${sem.length} projeto${sem.length !== 1 ? "s" : ""} sem e-mail de cliente cadastrado (não recebem)</summary><ul class="relcliul">${sem.map((x) => `<li>${esc(x.nome)}</li>`).join("")}</ul></details>` : ""}</div>`;
  }
  // lê uma seção (tipo de envio) do formulário
  function relLerTipo(sec) {
    const q = (s) => [...sec.querySelectorAll(s)];
    const ex = sec.querySelector("[name=extras]");
    const t = {
      ativo: sec.querySelector("[name=ativo]").checked,
      recorrencia: {
        freq: sec.querySelector("[name=freq]").value,
        hora: sec.querySelector("[name=hora]").value || "07:00",
        semana: q("input[name=recdia]:checked").map((x) => ({ dia: +x.value, hora: (sec.querySelector(`[name=recdiah][data-dia="${x.value}"]`) || {}).value || "07:00" })),
        mes: q(".relrecm").map((r) => ({ dia: Math.max(1, Math.min(31, Math.round(+r.querySelector("[name=recmesd]").value || 1))), hora: r.querySelector("[name=recmesh]").value || "07:00" })),
      },
      perfis: q("input[name=perfil]:checked").map((x) => x.value),
      usuarios: q("input[name=usuario]").filter((x) => (x.disabled ? x.dataset.exp === "1" : x.checked)).map((x) => x.value),
      extras: ex ? [...new Set(ex.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))] : [],
    };
    if (sec.dataset.tipo === "cronogramas") {
      t.projetos = sec.querySelector("[name=todosProj]").checked ? null : q("input[name=proj]:checked").map((x) => x.value);
      t.conteudo = sec.querySelector("[name=conteudo]").value;
      t.alocados = sec.querySelector("[name=alocados]").checked;
      t.clientes = sec.querySelector("[name=clientes]").checked;
    }
    return t;
  }
  function relLerForm() {
    const f = $("#relForm");
    const tipos = {};
    f.querySelectorAll("section[data-tipo]").forEach((sec) => (tipos[sec.dataset.tipo] = relLerTipo(sec)));
    return { tipos, link: f.link.value.trim() };
  }
  // quem recebe, conforme o que está marcado na tela (antes de salvar)
  function relQuem(sec) {
    const R = CFGV.R;
    const t = relLerTipo(sec);
    const P = new Set(t.perfis), S = new Set(t.usuarios);
    const L = R.usuarios.filter((u) => u.ativo && u.email && (P.has(u.perfil) || S.has(u.id))).map((u) => u.nome);
    const ja = new Set(R.usuarios.filter((u) => u.ativo && u.email && (P.has(u.perfil) || S.has(u.id))).map((u) => u.email.toLowerCase()));
    t.extras.forEach((e) => !ja.has(e) && /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e) && L.push(e));
    let extra = "";
    if (sec.dataset.tipo === "cronogramas") {
      const np = t.projetos == null ? R.projetos.length : t.projetos.length;
      extra = ` · ${np} projeto${np !== 1 ? "s" : ""}`;
      if (t.alocados) {
        const al = (R.destinatarios.cronogramas || []).filter((x) => x.alocado);
        extra += ` · mais ${al.length} pessoa${al.length !== 1 ? "s" : ""} pelos projetos em que está alocada${al.length ? ` (${al.map((x) => esc(x.nome)).join(", ")})` : ""}`;
      }
      const cb = sec.querySelector("[data-relcli]");
      if (cb) cb.outerHTML = relCliHTML(t);
      if (t.clientes) {
        const ok = t.projetos == null ? null : new Set(t.projetos);
        const nc = (R.destinatarios.cronogramas || []).filter((x) => x.cliente && (!ok || ok.has(x.projetos[0]))).length;
        extra = ` · <b>${nc} contato${nc !== 1 ? "s" : ""} de cliente</b>` + extra;
      }
    }
    const el = sec.querySelector("[data-relquem]");
    if (el) el.innerHTML = `<b>${sec.dataset.tipo === "cronogramas" ? "Equipe" : "Recebem"} (${L.length}):</b> ${L.length ? L.map(esc).join(", ") : "ninguém selecionado"}${extra}${t.ativo ? "" : ` <span class="mut">· envio automático desligado</span>`}`;
  }
  function relQuemTodos() {
    document.querySelectorAll("#relForm section[data-tipo]").forEach(relQuem);
  }
  document.addEventListener("change", (e) => {
    const x = e.target;
    if (view !== "config" || CFGV.tab !== "relatorio" || !x.closest || !x.closest("#relForm")) return;
    const sec = x.closest("section[data-tipo]");
    if (!sec) return;
    if (x.name === "perfil") {
      const P = new Set([...sec.querySelectorAll("input[name=perfil]:checked")].map((y) => y.value));
      sec.querySelectorAll("input[name=usuario]").forEach((u) => {
        const pp = P.has(u.dataset.perfil);
        u.disabled = pp;
        u.checked = pp || u.dataset.exp === "1";
        u.closest("label").classList.toggle("relpp", pp);
      });
    } else if (x.name === "usuario") x.dataset.exp = x.checked ? 1 : 0;
    else if (x.name === "freq") {
      sec.querySelector(".relrecdiaria").hidden = x.value !== "diaria";
      sec.querySelector(".relrecsem").hidden = !(x.value === "semanal" || x.value === "quinzenal");
      sec.querySelector(".relrecmes").hidden = x.value !== "mensal";
    } else if (x.name === "recdia") {
      const h = sec.querySelector(`[name=recdiah][data-dia="${x.value}"]`);
      if (h) h.disabled = !x.checked;
      x.closest("label").classList.toggle("on", x.checked);
    }
    else if (x.name === "todosProj") sec.querySelectorAll("input[name=proj]").forEach((p) => ((p.disabled = x.checked), x.checked && (p.checked = true)));
    relQuem(sec);
  });
  document.addEventListener("click", async (e) => {
    if (view !== "config" || CFGV.tab !== "relatorio" || !e.target.closest) return;
    const t = e.target;
    const sec = t.closest("section[data-tipo]");
    let b;
    if ((b = t.closest("[data-relsel]"))) {
      sec.querySelectorAll(`input[name=${b.dataset.relsel}]:not(:disabled)`).forEach((x) => {
        x.checked = b.dataset.v === "1";
        if (x.name === "usuario") x.dataset.exp = x.checked ? 1 : 0;
      });
      relQuem(sec);
    } else if (t.closest("[data-reladd]") || (b = t.closest("[data-relrm]"))) {
      const v = relLerForm();
      const H = v.tipos[sec.dataset.tipo].horarios;
      if (b) H.splice(+b.dataset.relrm, 1);
      else H.push({ dia: 0, hora: "07:00" });
      CFGV.R.cfg = Object.assign({}, CFGV.R.cfg, { tipos: v.tipos });
      CFGV.R.link = v.link;
      renderConfig();
    } else if ((b = t.closest("[data-relprev]"))) {
      const tp = b.dataset.relprev;
      const cli = b.dataset.cli === "1";
      const nm = cli ? "Prévia · e-mail do cliente (primeiro projeto com contato)" : { pendencias: "Prévia · suas atividades", gerencial: "Prévia · resumo gerencial", cronogramas: "Prévia · cronogramas (equipe)" }[tp];
      const { f } = cfgDlg(`<h3>${nm}</h3><iframe class="relframe" data-relprevia title="Prévia do e-mail"></iframe><div class="actions"><button type="button" class="btn primary" data-cfgfechar>Fechar</button></div>`, true);
      f.querySelector("[data-cfgfechar]").focus();
      fetch(`api/admin/relatorio/previa?tipo=${tp}${cli ? "&cliente=1" : ""}`)
        .then((r) => r.text())
        .then((h) => {
          const fr = f.querySelector("[data-relprevia]");
          if (fr) fr.srcdoc = h;
        })
        .catch(() => {});
    } else if ((b = t.closest("[data-relmesadd]"))) {
      // recorrência mensal: mais um dia do mês (copia a última linha)
      const L = b.parentElement.querySelector(".relrecmesl");
      const ult = L.querySelector(".relrecm:last-child");
      if (ult) {
        const n = ult.cloneNode(true);
        n.querySelector("[name=recmesd]").value = Math.min(31, (+ult.querySelector("[name=recmesd]").value || 1) + 14);
        L.appendChild(n);
        n.querySelector("[name=recmesd]").focus();
      }
    } else if ((b = t.closest("[data-relmesrm]"))) {
      const L = b.closest(".relrecmesl");
      if (L.querySelectorAll(".relrecm").length > 1) b.closest(".relrecm").remove();
      else toast("Deixe pelo menos um dia do mês (ou mude a recorrência).");
    } else if ((b = t.closest("[data-relagora]"))) {
      // envia já, a todos os destinatários SALVOS deste envio (a recorrência continua valendo)
      const NT2 = Object.fromEntries(CFGV.R.tiposNomes || []);
      const tp = b.dataset.relagora;
      if (!window.confirm(`Enviar agora "${NT2[tp] || tp}" a todos os destinatários salvos?\n\nSe você mudou algo nesta tela, salve a programação antes.`)) return;
      const txt = b.textContent;
      b.disabled = true;
      b.textContent = "Enviando…";
      try {
        const r = await cfgApi("api/admin/relatorio", { acao: "enviar", tipo: tp });
        toast(r.enviados ? `${r.enviados} e-mail${r.enviados > 1 ? "s" : ""} na fila de envio${r.pulados ? ` (${r.pulados} sem conteúdo)` : ""}.` : "Nenhum e-mail a enviar: confira os destinatários.");
        cfgRelCarregar();
      } catch (err) {
        toast(err.message);
        b.disabled = false;
        b.textContent = txt;
      }
    } else if ((b = t.closest("[data-relteste]"))) {
      const txt = b.textContent;
      b.disabled = true;
      b.textContent = "Enviando…";
      try {
        const r = await cfgApi("api/admin/relatorio", { acao: "teste", tipo: b.dataset.relteste });
        toast(`Teste enviado para ${r.para} (${r.enviados} e-mail${r.enviados > 1 ? "s" : ""}).`);
        cfgRelCarregar();
      } catch (err) {
        toast(err.message);
        b.disabled = false;
        b.textContent = txt;
      }
    }
  });
  document.addEventListener("submit", async (e) => {
    if (!e.target || e.target.id !== "relForm") return;
    e.preventDefault();
    const v = relLerForm();
    const NT = Object.fromEntries(CFGV.R.tiposNomes || []);
    for (const [k, t] of Object.entries(v.tipos)) {
      if (t.ativo && (t.recorrencia.freq === "semanal" || t.recorrencia.freq === "quinzenal") && !t.recorrencia.semana.length) return toast(`${NT[k]}: marque pelo menos um dia da semana.`);
      if (t.ativo && t.recorrencia.freq === "mensal" && !t.recorrencia.mes.length) return toast(`${NT[k]}: inclua pelo menos um dia do mês.`);
      if (k === "cronogramas" && t.projetos && !t.projetos.length && t.ativo) return toast("Cronogramas: escolha pelo menos um projeto.");
    }
    try {
      await cfgApi("api/admin/relatorio", Object.assign({ acao: "salvar" }, v));
      toast("Programação salva.");
      cfgRelCarregar();
    } catch (err) {
      toast(err.message);
    }
  });
  /* ----- minha conta (canto inferior da barra lateral) ----- */
  function contaAbrir() {
    const u = SESS().usuario;
    if (!u) return;
    const { f } = cfgDlg(`<h3><span class="cfgu"><span class="cfgav" aria-hidden="true">${esc(iniciais(u.nome))}</span>${esc(u.nome)}</span></h3><dl class="cfgdl"><dt>E-mail</dt><dd>${esc(u.email)}</dd><dt>Setor</dt><dd>${esc(u.setorNome || "–")}</dd><dt>Perfil</dt><dd>${esc(u.perfilNome || "–")}</dd></dl>
      <p class="hint">O acesso é pelo login do Portal DGT: não há senha neste painel.</p><div class="actions"><button type="button" class="btn primary" data-cfgfechar>Fechar</button></div>`);
    f.querySelector("[data-cfgfechar]").focus();
  }
  async function sairPainel() {
    try {
      await fetch("api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch (e) {}
    location.replace("login.html?saiu=1");
  }
  window.__avisoPerm = (m) => toast(m + " A tela voltou ao que está salvo.");

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest) return;
    let b;
    if (t.closest("[data-cfg]")) {
      location.hash = "config";
      return;
    }
    if (t.closest("[data-conta]")) return contaAbrir();
    if (t.closest("[data-sair]")) return sairPainel();
    if (t.closest("[data-cfgfechar]")) return $("#dlgCfg").close();
    if ((b = t.closest("[data-olho]")) && b.closest("#formCfg")) {
      const i = b.parentNode.querySelector("input");
      const ver = i.type === "password";
      i.type = ver ? "text" : "password";
      b.setAttribute("aria-pressed", String(ver));
      b.setAttribute("aria-label", ver ? "Ocultar a senha" : "Mostrar a senha");
      return;
    }
    if ((b = t.closest("[data-cfghistu]"))) {
      $("#dlgCfg").close();
      CFGV.tab = "historico";
      CFGV.hf = { q: "", uid: b.dataset.cfghistu, setor: "", cat: "", de: "", ate: "" };
      CFGV.hpag = 1;
      CFGV.H = null;
      location.hash = "config";
      renderConfig();
      return;
    }
    if (view !== "config") return;
    if ((b = t.closest("[data-cfgtab]"))) {
      CFGV.tab = b.dataset.cfgtab;
      if (CFGV.tab === "historico") CFGV.H = null;
      else cfgCarregar(true);
      renderConfig();
    } else if (t.closest("[data-cfgrecarregar]")) {
      CFGV.erro = "";
      cfgCarregar();
    } else if ((b = t.closest("[data-cfgord]"))) {
      const c = b.dataset.cfgord;
      CFGV.ord = { col: c, dir: CFGV.ord.col === c ? -CFGV.ord.dir : 1 };
      renderConfig();
    } else if ((b = t.closest("[data-cfgpag]"))) {
      CFGV.pag += +b.dataset.cfgpag;
      renderConfig();
    } else if (t.closest("[data-cfgunovo]")) cfgUsuarioForm("");
    else if ((b = t.closest("[data-cfguedit]"))) cfgUsuarioForm(b.dataset.cfguedit);
    else if ((b = t.closest("[data-cfguver]"))) cfgUsuarioVer(b.dataset.cfguver);
    else if ((b = t.closest("[data-cfgulink]"))) cfgLinkSenha(b.dataset.cfgulink);
    else if ((b = t.closest("[data-cfgudes]"))) cfgUsuarioAcao(b.dataset.cfgudes, "desativar");
    else if ((b = t.closest("[data-cfguat]"))) cfgUsuarioAcao(b.dataset.cfguat, "ativar");
    else if ((b = t.closest("[data-cfgudel]"))) cfgUsuarioAcao(b.dataset.cfgudel, "excluir");
    else if (t.closest("[data-cfgsnovo]")) cfgSetorForm("");
    else if ((b = t.closest("[data-cfgsedit]"))) cfgSetorForm(b.dataset.cfgsedit);
    else if ((b = t.closest("[data-cfgsver]"))) {
      CFGV.tab = "usuarios";
      CFGV.uf = { q: "", setor: b.dataset.cfgsver, perfil: "", status: "" };
      CFGV.pag = 1;
      renderConfig();
    } else if ((b = t.closest("[data-cfgsat]"))) {
      const [id, acao] = b.dataset.cfgsat.split("|");
      const s = CFGV.D.setores.find((x) => x.id === id);
      (acao === "ativar" ? Promise.resolve(true) : askConfirm(`Desativar o setor ${s.nome}? Os ${s.usuarios} usuário(s) vinculados continuam com acesso; o setor só deixa de aparecer em novos cadastros.`, "Desativar"))
        .then((ok) => ok && cfgApi("api/admin/setor", { acao, id }))
        .then((r) => {
          if (r) {
            toast(acao === "ativar" ? "Setor ativado." : "Setor desativado.");
            cfgCarregar(true);
          }
        })
        .catch((err) => toast(err.message));
    } else if ((b = t.closest("[data-cfgsdel]"))) {
      const s = CFGV.D.setores.find((x) => x.id === b.dataset.cfgsdel);
      askConfirm(`Excluir o setor ${s.nome} definitivamente?`, "Excluir")
        .then((ok) => ok && cfgApi("api/admin/setor", { acao: "excluir", id: s.id }))
        .then((r) => {
          if (r) {
            toast("Setor excluído.");
            cfgCarregar(true);
          }
        })
        .catch((err) => toast(err.message));
    } else if (t.closest("[data-cfgpnovo]")) cfgPerfilForm("");
    else if ((b = t.closest("[data-cfgpedit]"))) cfgPerfilForm(b.dataset.cfgpedit);
    else if ((b = t.closest("[data-cfgpdel]"))) {
      const p = CFGV.D.perfis.find((x) => x.id === b.dataset.cfgpdel);
      askConfirm(`Excluir o perfil ${p.nome}?`, "Excluir")
        .then((ok) => ok && cfgApi("api/admin/perfil", { acao: "excluir", id: p.id }))
        .then((r) => {
          if (r) {
            toast("Perfil excluído.");
            cfgCarregar(true);
          }
        })
        .catch((err) => toast(err.message));
    } else if ((b = t.closest("[data-cfghpag]"))) {
      CFGV.hpag += +b.dataset.cfghpag;
      cfgHistCarregar();
    } else if (t.closest("[data-cfghcsv]")) {
      cfgHistCSV().catch((err) => toast(err.message));
    }
  });
  let cfgTmr;
  document.addEventListener("input", (e) => {
    if (view !== "config") return;
    const t = e.target;
    if (t.matches && t.matches("[data-cfgq]")) {
      CFGV.uf.q = t.value;
      CFGV.pag = 1;
      CFGV.focoBusca = true;
      renderConfig();
    } else if (t.matches && t.matches("[data-cfghq]")) {
      clearTimeout(cfgTmr);
      cfgTmr = setTimeout(() => {
        CFGV.hf.q = t.value;
        CFGV.hpag = 1;
        cfgHistCarregar().then(() => {
          const i = document.querySelector("[data-cfghq]");
          if (i) {
            i.focus();
            i.setSelectionRange(i.value.length, i.value.length);
          }
        });
      }, 350);
    }
  });
  document.addEventListener("change", (e) => {
    if (view !== "config") return;
    const t = e.target;
    if (t.dataset && t.dataset.cfguf) {
      CFGV.uf[t.dataset.cfguf] = t.value;
      CFGV.pag = 1;
      renderConfig();
    } else if (t.dataset && t.dataset.cfghf) {
      CFGV.hf[t.dataset.cfghf] = t.value;
      CFGV.hpag = 1;
      cfgHistCarregar();
    }
  });
  /* ---------- Minhas atividades (painel de cada pessoa) e Visão geral da Gestão de equipes ----------
     Pendências de quatro fontes, de todos os projetos em andamento (dados do Painel PMO):
       crono  atividades do cronograma de execução (G3) sem término realizado
       sprint itens de G1, G2 e G5 não concluídos e itens cíclicos do G4 com execução vencendo
       acao   ações da carteira (status report) em aberto
       campo  programações das equipes de campo ainda não finalizadas
     De quem é: o nome da pessoa no responsável, mais as atividades do setor dela (PMO, Implantação,
     Infraestrutura) nas obras em que ela está alocada como stakeholder DGT. */
  const MA = { fonte: "", proj: "", sit: "", q: "", pessoa: "", abertas: { futura: false, semdata: false } };
  const PEND_FONTE = { crono: "Cronograma", sprint: "Sprints", acao: "Ações da carteira", campo: "Equipes de campo" };
  const PEND_SIT = {
    atrasada: ["Atrasadas", "bad"],
    hoje: ["Vencem hoje", "warn"],
    semana: ["Próximos 7 dias", "info"],
    andamento: ["Em andamento", "info"],
    futura: ["Mais adiante", "mut"],
    semdata: ["Sem data", "mut"],
  };
  const MKEY = "pmo-hibrido-minhas";
  /* nome do login → nome usado nas atividades e na equipe: "Marcelo Lopes da Silveira Júnior" é o
     "Marcelo Lopes" da equipe (todas as palavras do nome curto aparecem no nome do login) */
  function nomeNasAtividades(nome) {
    const k = normNome(nome);
    const pal = new Set(k.split(" "));
    const conhecidos = [...new Set(equipe().flatMap((e) => e.membros).concat(PMO ? PMO.pes.map((x) => x.nome) : []))];
    if (conhecidos.some((n) => normNome(n) === k)) return nome;
    const cand = conhecidos.filter((n) => {
      const P = normNome(n).split(" ");
      return P.length >= 2 && P.every((x) => pal.has(x));
    });
    return cand.sort((a, b) => b.length - a.length)[0] || nome;
  }
  function minhaPessoa() {
    if (MA.pessoa) return MA.pessoa; // "ver como" a partir da Gestão de equipes
    const u = SESS().usuario;
    if (u) return nomeNasAtividades(u.nome);
    try {
      return localStorage.getItem(MKEY) || "";
    } catch (e) {
      return "";
    }
  }
  function regraPessoa(nome) {
    const k = normNome(nome);
    const AR = { PMO: ["projetos", "pmo"], Implantação: ["implantacao"], Infraestrutura: ["infraestrutura"] };
    const setor = subsetorDe(nome);
    const areas = AR[setor] || null;
    const aloc = new Set((PMO ? PMO.projs : []).filter((p) => p.dgt.some((d) => normNome(d.nome) === k)).map((p) => p.id));
    const fn = (pid, resp) => {
      const r = String(resp || "")
        .split(/\s*[\/,;+]\s*/)
        .map(normNome);
      if (r.includes(k)) return "nome";
      return areas && aloc.has(pid) && r.some((x) => areas.includes(x)) ? "setor" : "";
    };
    fn.setor = setor;
    fn.k = k;
    return fn;
  }
  const addMesesIso = (s0, n) => {
    const d = dt(s0);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  };
  function situacao(ini, fim, hoje, em7) {
    if (fim && fim < hoje) return "atrasada";
    if (fim && fim === hoje) return "hoje";
    if (fim && fim <= em7) return "semana";
    if (ini && ini <= hoje) return "andamento";
    return fim || ini ? "futura" : "semdata";
  }
  let PEND_CACHE = { k: "", L: null };
  /* todas as pendências de uma pessoa (ou de todos, sem nome) */
  function pendencias(nome) {
    if (!PMO) return [];
    const ck = [pmoAt, AGC.length, AGC.reduce((t, a) => t + (a.status || "").length, 0), nome, todayISO()].join("|");
    if (PEND_CACHE.k === ck) return PEND_CACHE.L;
    const hoje = todayISO();
    const em7 = addDays(hoje, 7);
    const meu = nome ? regraPessoa(nome) : () => "nome";
    const L = [];
    const add = (o) => {
      o.sit = o.sit || situacao(o.ini, o.fim, hoje, em7);
      o.atraso = o.fim && o.fim < hoje ? diasEntre(o.fim, hoje) : 0;
      L.push(o);
    };
    PMO.projs.forEach((p) => {
      // cronograma de execução
      p.ag.forEach(({ i, a, b }) => {
        if (i.fimReal) return;
        const por = meu(p.id, i.resp);
        if (!por) return;
        const fim = b && b >= a ? b : a;
        add({ fonte: "crono", id: i.id, p, i, titulo: i.titulo || "Atividade", ctx: [i.faseNome, i.pacoteNome].filter(Boolean).join(" › "), resp: i.resp || "", ini: a, fim, por, iniciada: !!i.inicioReal });
      });
      const SD = (p.cfg && p.cfg.sprintDatas) || {};
      const SN = (p.cfg && p.cfg.sprintNomes) || {};
      (p.itens || []).forEach((i) => {
        const g = +i.grupo;
        if (![1, 2, 4, 5].includes(g)) return;
        const por = meu(p.id, i.resp);
        if (!por) return;
        const sp = +i.sprint || 1;
        const per = (SD[g] || {})[sp] || [];
        const ctx = `${GRUPOS[g].nome} · Sprint ${p2(sp)}${(SN[g] || {})[sp] ? " " + SN[g][sp] : ""}`;
        if (g === 4) {
          // monitoramento: só os itens com ciclo definido ou já executados (os demais não geram cobrança)
          if (!i.ciclo && !(i.execs || []).length) return;
          const c = { semanal: 7, quinzenal: 14, mensal: "1", bimestral: "2", trimestral: "3" }[i.ciclo || "mensal"];
          if (!c) return;
          const ex = (i.execs || []).filter((x) => x && x.d).map((x) => x.d).sort();
          const base = ex.length ? ex[ex.length - 1] : per[0] || (p.ag.map((x) => x.a).filter(Boolean).sort()[0] || "");
          if (!base) return;
          const prox = typeof c === "number" ? addDays(base, c) : addMesesIso(base, +c);
          if (prox > em7) return;
          add({ fonte: "sprint", g, id: i.id, p, i, titulo: i.titulo, ctx: ctx + " · cíclico", resp: i.resp || "", ini: "", fim: prox, por, ciclico: true, ultima: ex[ex.length - 1] || "" });
          return;
        }
        const st = stG(g, i.status);
        if (isDoneSt(st)) return;
        add({ fonte: "sprint", g, id: i.id, p, i, titulo: i.titulo, ctx, resp: i.resp || "", ini: i.inicio || per[0] || "", fim: i.fim || per[1] || "", por, st, bloq: isBlockSt(st) });
      });
      // ações da carteira
      ((p.cfg && p.cfg.acoes) || []).forEach((a, k) => {
        if (!a || !a.t || a.ok) return;
        const por = meu(p.id, a.r);
        if (!por) return;
        add({ fonte: "acao", id: p.id + "#" + k, k, p, titulo: a.t, ctx: "Status report", resp: a.r || "", ini: "", fim: a.cont ? "" : a.d || "", por, cont: !!a.cont, sit: a.cont ? "andamento" : "" });
      });
    });
    // programações de campo: do técnico pelo nome; o setor de Implantação acompanha todas
    const regra = nome ? regraPessoa(nome) : null;
    AGC.forEach((a) => {
      if (!agAtivo(a) || agFechado(a)) return;
      const fim = agFim(a);
      if (fim < addDays(hoje, -60) || a.data > em7) return;
      const eq = normNome(a.equipe);
      const tecnico = !regra || eq.split(/\s*[\/,+&]\s*|\s+e\s+/).includes(regra.k) || eq.includes(regra.k);
      const sup = regra && regra.setor === "Implantação";
      if (!tecnico && !sup) return;
      const sit = fim < hoje ? "atrasada" : a.data <= hoje ? "hoje" : "semana";
      add({ fonte: "campo", id: a.id, ag: a, p: agProj(a), titulo: (a.equipe || "Equipe") + " · " + (agAtivTxt(a) || "programação"), ctx: agNomeProj(a) + (a.hIni ? ` · ${a.hIni}${a.hFim ? "–" + a.hFim : ""}` : ""), resp: a.equipe || "", ini: a.data, fim, por: tecnico ? "nome" : "setor", sit, campoPend: fim < hoje });
    });
    const ord = Object.keys(PEND_SIT);
    L.sort((x, y) => ord.indexOf(x.sit) - ord.indexOf(y.sit) || (x.fim || "9") .localeCompare(y.fim || "9") || COLPT(String(x.titulo), String(y.titulo)));
    PEND_CACHE = { k: ck, L };
    return L;
  }
  const diasEntre = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
  function avisosDe(L) {
    const n = (f) => L.filter(f).length;
    const A = [];
    const atr = n((x) => x.sit === "atrasada" && x.fonte === "crono");
    if (atr) A.push(["bad", `${atr} atividade${atr > 1 ? "s" : ""} do cronograma com prazo vencido`, "atrasada", "crono"]);
    const camp = n((x) => x.fonte === "campo" && x.campoPend);
    if (camp) A.push(["bad", `${camp} programaç${camp > 1 ? "ões" : "ão"} de campo de dias anteriores sem finalização`, "atrasada", "campo"]);
    const ac = n((x) => x.fonte === "acao" && x.sit === "atrasada");
    if (ac) A.push(["bad", `${ac} aç${ac > 1 ? "ões" : "ão"} da carteira com prazo vencido`, "atrasada", "acao"]);
    const sp = n((x) => x.fonte === "sprint" && x.sit === "atrasada");
    if (sp) A.push(["bad", `${sp} ite${sp > 1 ? "ns" : "m"} de sprint vencido${sp > 1 ? "s" : ""} (inclui execuções cíclicas do monitoramento)`, "atrasada", "sprint"]);
    const bl = n((x) => x.bloq);
    if (bl) A.push(["warn", `${bl} ite${bl > 1 ? "ns" : "m"} de sprint bloqueado${bl > 1 ? "s" : ""} ou recusado${bl > 1 ? "s" : ""}`, "", "sprint"]);
    const hj = n((x) => x.sit === "hoje");
    if (hj) A.push(["warn", `${hj} pendência${hj > 1 ? "s" : ""} vence${hj > 1 ? "m" : ""} hoje`, "hoje", ""]);
    const cpHoje = n((x) => x.fonte === "campo" && x.sit === "hoje");
    if (cpHoje) A.push(["info", `${cpHoje} programaç${cpHoje > 1 ? "ões" : "ão"} de campo para hoje`, "hoje", "campo"]);
    const sm = n((x) => x.sit === "semana");
    if (sm) A.push(["info", `${sm} pendência${sm > 1 ? "s" : ""} vence${sm > 1 ? "m" : ""} nos próximos 7 dias`, "semana", ""]);
    return A;
  }
  function nAtrasadasMinhas() {
    if (!PMO) return 0;
    // sempre as da própria pessoa, mesmo quando a tela mostra outra ("ver como")
    const salva = MA.pessoa;
    MA.pessoa = "";
    const nome = minhaPessoa();
    MA.pessoa = salva;
    return nome ? pendencias(nome).filter((x) => x.sit === "atrasada").length : 0;
  }

  function renderMinhas() {
    const v = $("#view");
    if (!PMO) {
      document.body.classList.add("carregando");
      v.innerHTML = `<div class="loading"><span class="spin"></span>Carregando as suas atividades…</div>`;
      loadPmo();
      return;
    }
    loadPmo();
    const nome = minhaPessoa();
    const outro = !!MA.pessoa;
    const pessoasL = [...new Set(equipe().flatMap((e) => e.membros).concat(PMO.pes.map((x) => x.nome)))].sort((a, b) => COLPT(a, b));
    const escolha = !SESS().usuario && !outro
      ? `<label class="mvquem">Ver as atividades de<select data-mvquem><option value="">Escolha uma pessoa…</option>${pessoasL.map((n) => `<option ${normNome(n) === normNome(nome) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`
      : "";
    const hdr = `<header class="top cart-top"><div class="title-block"><h1 class="cart-h">${outro ? "Atividades de " + esc(nome) : "Minhas atividades"}</h1><p class="subtitle">${nome ? `${outro ? "" : esc(nome) + " · "}${esc(subsetorDe(nome) || "setor não cadastrado na equipe")} · posição em ${fmtD(todayISO())}` : "Escolha a pessoa para ver os avisos e as pendências."}${outro ? ` · <a href="#minhas" data-mvvoltar>voltar para as minhas</a>` : ""}</p></div>${escolha}<button class="btn ghost" data-pmref>Atualizar</button></header>`;
    if (!nome) {
      v.innerHTML = hdr + `<section class="panel"><p class="hint">Sem login ativado, escolha acima de quem são as atividades. A escolha fica guardada neste navegador.</p></section>`;
      return;
    }
    const T = pendencias(nome);
    const A = avisosDe(T);
    const F = MA;
    const q = semAcento(F.q.toLowerCase());
    const L = T.filter((x) => (!F.fonte || x.fonte === F.fonte) && (!F.proj || (x.p && x.p.id === F.proj)) && (!F.sit || x.sit === F.sit) && (!q || semAcento([x.titulo, x.ctx, x.p && x.p.nome, x.resp].join(" ").toLowerCase()).includes(q)));
    const cont = (s) => T.filter((x) => x.sit === s).length;
    const kpi = (s, txt, cls) => `<button class="kpi mvk ${F.sit === s ? "on" : ""}" data-mvsit="${s}"><div class="v ${cont(s) && cls ? cls : ""}">${cont(s)}</div><div class="l">${txt}</div></button>`;
    const projsL = [...new Map(T.filter((x) => x.p).map((x) => [x.p.id, x.p])).values()].sort((a, b) => (+a.cod || 1e9) - (+b.cod || 1e9));
    const opt = (L2, sel, todos) => `<option value="">${todos}</option>` + L2.map(([v2, l]) => `<option value="${esc(v2)}" ${sel === v2 ? "selected" : ""}>${esc(l)}</option>`).join("");
    const sem = !T.length
      ? `<section class="panel"><p class="hint">${regraPessoa(nome).setor ? "Nenhuma pendência encontrada. Tudo em dia!" : `Nenhuma pendência encontrada para <b>${esc(nome)}</b>. Se você deveria ter atividades, confira se o seu nome está igual no login, no responsável das atividades e nos stakeholders DGT dos projetos, e se você está na equipe (Gestão de equipes › Stakeholders DGT) com o seu setor.`}</p></section>`
      : "";
    const grupos = Object.keys(PEND_SIT)
      .map((s) => [s, L.filter((x) => x.sit === s)])
      .filter(([, G]) => G.length);
    v.innerHTML =
      hdr +
      `<div class="kpis mvkpis">${kpi("atrasada", "Atrasadas", "bad")}${kpi("hoje", "Vencem hoje", "warn")}${kpi("semana", "Próximos 7 dias", "")}${kpi("andamento", "Em andamento", "")}${kpi("futura", "Mais adiante", "")}</div>
      ${A.length ? `<section class="panel mvavisos"><div class="panel-h"><h2>Avisos</h2><span class="note">Clique num aviso para filtrar a lista.</span></div><ul>${A.map(([c, t, s, f]) => `<li class="mva ${c}"><button data-mvaviso="${s}|${f}"><span class="mvdot"></span>${esc(t)}</button></li>`).join("")}</ul></section>` : ""}
      ${sem}
      ${T.length ? `<section class="panel"><div class="cfgbar"><select data-mvf="proj" aria-label="Projeto">${opt(projsL.map((p) => [p.id, p.nome]), F.proj, "Todos os projetos")}</select>
        <select data-mvf="fonte" aria-label="Tipo">${opt(Object.entries(PEND_FONTE).map(([k, l]) => [k, `${l} (${T.filter((x) => x.fonte === k).length})`]), F.fonte, "Todos os tipos")}</select>
        <label class="sbw cfgbusca">${SIC.lupa}<input type="search" data-mvq value="${esc(F.q)}" placeholder="Pesquisar atividade, projeto ou etapa" aria-label="Pesquisar pendência"></label>
        ${F.sit || F.fonte || F.proj || F.q ? `<button class="btn ghost" data-mvlimpar>Limpar filtros</button>` : ""}<span class="mut mvtot">${L.length} de ${T.length} pendência${T.length === 1 ? "" : "s"}</span></div>
        ${grupos.length ? grupos.map(([s, G]) => mvGrupo(s, G)).join("") : `<p class="hint">Nenhuma pendência com esses filtros.</p>`}</section>` : ""}`;
    if (MA.focoBusca) {
      const i = v.querySelector("[data-mvq]");
      if (i) {
        i.focus();
        i.setSelectionRange(i.value.length, i.value.length);
      }
      MA.focoBusca = false;
    }
  }
  const MV_MAX = 60;
  function mvGrupo(s, G) {
    const [txt, cls] = PEND_SIT[s];
    const longo = (s === "futura" || s === "semdata") && !MA.abertas[s] && !MA.sit;
    // por projeto (ordem do código); dentro do projeto: ações, cronograma, sprints e campo
    const ORD_F = { acao: 0, crono: 1, sprint: 2, campo: 3 };
    const chaveP = (x) => (x.p ? x.p.id : "~");
    const projs = new Map();
    G.forEach((x) => {
      const k = chaveP(x);
      if (!projs.has(k)) projs.set(k, { p: x.p, L: [] });
      projs.get(k).L.push(x);
    });
    const PL = [...projs.values()].sort((a, b) => (!a.p ? 1 : !b.p ? -1 : (+a.p.cod || 1e9) - (+b.p.cod || 1e9) || COLPT(a.p.nome, b.p.nome)));
    PL.forEach((o) => o.L.sort((a, b) => ORD_F[a.fonte] - ORD_F[b.fonte] || (a.fim || "9").localeCompare(b.fim || "9")));
    let resta = MA.abertas[s + "Tudo"] ? Infinity : MV_MAX;
    let mostrados = 0;
    const blocos = PL.map((o) => {
      if (resta <= 0) return "";
      const L = o.L.slice(0, resta);
      resta -= L.length;
      mostrados += L.length;
      const cab = o.p ? esc(o.p.nome) : "Sem projeto";
      return `<div class="mvpg"><div class="mvph">${cab}<span class="mvgn">${o.L.length}</span></div><div class="mvlist">${L.map(mvLinha).join("")}</div></div>`;
    }).join("");
    return `<details class="mvgr" ${longo ? "" : "open"} data-mvgr="${s}"><summary><span class="mvgt ${cls}">${txt}</span><span class="mvgn">${G.length}</span></summary>
      ${blocos}${G.length > mostrados ? `<button class="btn ghost mvmais" data-mvmais="${s}">Mostrar mais ${G.length - mostrados}</button>` : ""}</details>`;
  }
  function mvPrazo(x) {
    if (x.fonte === "acao" && x.cont) return "Contínua";
    if (!x.fim) return "Sem prazo";
    const hoje = todayISO();
    if (x.fim < hoje) return `${fmtD(x.fim)} · há ${x.atraso} dia${x.atraso === 1 ? "" : "s"}`;
    if (x.fim === hoje) return "Hoje";
    const d = diasEntre(hoje, x.fim);
    return `${fmtD(x.fim)} · em ${d} dia${d === 1 ? "" : "s"}`;
  }
  function mvLinha(x) {
    const pe = PODE("projetos", "editar");
    const acoes = [];
    if (x.fonte === "crono" && pe) {
      if (!x.iniciada) acoes.push(`<button class="btn ghost" data-mvac="iniciar" data-mvid="${esc(x.p.id + "|" + x.id)}" title="Registrar o início realizado com a data de hoje">Iniciar</button>`);
      acoes.push(`<button class="btn ghost" data-mvac="concluir" data-mvid="${esc(x.p.id + "|" + x.id)}" title="Registrar o término realizado com a data de hoje">Concluir</button>`);
    }
    if (x.fonte === "sprint" && pe) acoes.push(x.ciclico ? `<button class="btn ghost" data-mvac="exec" data-mvid="${esc(x.p.id + "|" + x.id)}" title="Registrar a execução de hoje">+ Execução</button>` : `<button class="btn ghost" data-mvac="sprint" data-mvid="${esc(x.p.id + "|" + x.id)}" title="Marcar como concluído hoje">Concluir</button>`);
    if (x.fonte === "acao" && pe) acoes.push(`<button class="btn ghost" data-mvac="acao" data-mvid="${esc(x.p.id + "|" + x.k)}" title="Marcar a ação como concluída">Concluir</button>`);
    acoes.push(`<button class="btn ghost" data-mvabrir="${esc(x.fonte + "|" + (x.p ? x.p.id : "") + "|" + x.id + "|" + (x.g || ""))}">Abrir</button>`);
    const quem = x.por === "setor" ? `<span class="mvpor" title="Atribuída ao seu setor (${esc(x.resp)}) numa obra em que você está alocado">setor</span>` : "";
    return `<div class="mvrow ${x.sit}"><span class="mvfonte f-${x.fonte}">${PEND_FONTE[x.fonte]}</span><div class="mvtxt"><b>${esc(x.titulo)}</b><span>${esc(x.ctx || "")}${x.resp ? ` · ${esc(x.resp)}` : ""} ${quem}${x.bloq ? ` <span class="mvbloq">bloqueado</span>` : ""}${x.iniciada ? ` <span class="mvini">iniciada</span>` : ""}</span></div><span class="mvprazo ${x.sit === "atrasada" ? "bad" : ""}">${mvPrazo(x)}</span><span class="mvacts">${acoes.join("")}</span></div>`;
  }
  /* abrir: vai ao projeto e à atividade (ou à programação de campo) */
  async function mvAbrir(chave) {
    const [fonte, pid, id, g] = chave.split("|");
    if (fonte === "campo") {
      PM.tab = "eqc";
      savePM();
      location.hash = "pmo";
      setTimeout(() => agPainel(id), 400);
      return;
    }
    if (pid !== PID) {
      if (!db) return;
      connect(pid);
      for (let t = 0; t < 60 && !(ready && PID === pid); t++) await new Promise((r) => setTimeout(r, 250));
    }
    if (fonte === "acao") {
      location.hash = "painel";
      return;
    }
    if (fonte === "crono") {
      location.hash = "g3";
      setTimeout(() => focoNivel({ id }), 300);
      return;
    }
    location.hash = "g" + (g || 2);
    setTimeout(() => {
      const tr = document.querySelector(`#view tr[data-sid="${CSS.escape(id)}"]`);
      if (!tr) return;
      tr.scrollIntoView({ block: "center" });
      tr.classList.add("movido");
      setTimeout(() => tr.classList.remove("movido"), 1600);
    }, 300);
  }
  /* ações rápidas: gravadas direto no projeto da pendência */
  async function mvAcao(ac, chave) {
    const [pid, id] = chave.split("|");
    const p = PMO && PMO.projs.find((x) => x.id === pid);
    if (!p || !db) return;
    const base = pid === "main" ? "" : `projetos/${pid}/`;
    const hoje = todayISO();
    try {
      if (ac === "acao") {
        const k = +id;
        const c = await db.doc(base + "config/projeto").get();
        const A = ((c.exists && c.data().acoes) || []).slice();
        if (!A[k] || A[k].t !== (p.cfg.acoes[k] || {}).t) return toast("A ação mudou desde o carregamento. Atualize e tente de novo.");
        if (!(await askConfirm(`Concluir a ação “${A[k].t}”?`, "Concluir"))) return;
        A[k] = Object.assign({}, A[k], { ok: hoje });
        await db.doc(base + "config/projeto").update({ acoes: A });
        p.cfg.acoes = A;
        toast("Ação concluída.");
      } else {
        const it = (p.itens || []).find((x) => x.id === id) || (p.ag.find((x) => x.i.id === id) || {}).i;
        if (!it) return;
        let campos;
        if (ac === "iniciar") campos = { inicioReal: hoje, pctReal: 50 };
        else if (ac === "concluir") {
          if (!(await askConfirm(`Concluir “${it.titulo}” com término realizado hoje (${fmtD(hoje)})?`, "Concluir"))) return;
          campos = { inicioReal: it.inicioReal || hoje, fimReal: hoje, pctReal: 100 };
        } else if (ac === "sprint") {
          if (!(await askConfirm(`Marcar “${it.titulo}” como concluído hoje?`, "Concluir"))) return;
          campos = { status: +it.grupo === 1 ? "aceito" : "concluido", fimReal: hoje };
        } else if (ac === "exec") {
          const reg = { d: hoje, obs: "", por: (SESS().usuario && SESS().usuario.nome) || minhaPessoa(), em: new Date().toISOString() };
          campos = { execs: (it.execs || []).concat(reg) };
        }
        await db.doc(base + "atividades/" + id).update(campos);
        Object.assign(it, campos);
        toast(ac === "iniciar" ? "Início registrado." : ac === "exec" ? "Execução registrada." : "Concluído.");
      }
      pmoAt = Date.now() - 31000; // os dados do PMO serão relidos
      PEND_CACHE.k = "";
      render();
      loadPmo(true);
    } catch (e) {
      toast("Não foi possível gravar: " + ((e && e.message) || e));
    }
  }

  /* Gestão de equipes · Visão geral: pendências por pessoa da equipe DGT e equipes de campo hoje */
  const GV = { setor: "" };
  function pmoGeralHTML() {
    const hoje = todayISO();
    const pessoas = equipe().flatMap((e) => e.membros.map((n) => ({ nome: n, setor: e.setor })));
    const linhas = pessoas
      .filter((x) => !GV.setor || x.setor === GV.setor)
      .map((x) => {
        const salva = MA.pessoa;
        MA.pessoa = x.nome;
        const L = pendencias(x.nome);
        MA.pessoa = salva;
        const c = (f) => L.filter(f).length;
        return Object.assign(x, {
          atr: c((y) => y.sit === "atrasada"),
          hoje: c((y) => y.sit === "hoje"),
          sem: c((y) => y.sit === "semana"),
          and: c((y) => y.sit === "andamento"),
          acoes: c((y) => y.fonte === "acao"),
          acAtr: c((y) => y.fonte === "acao" && y.sit === "atrasada"),
          campo: c((y) => y.fonte === "campo" && y.campoPend),
          total: L.length,
        });
      })
      .sort((a, b) => b.atr - a.atr || COLPT(a.nome, b.nome));
    const tot = (k) => linhas.reduce((t, x) => t + x[k], 0);
    const TODOS = pendencias("");
    const camHoje = AGC.filter((a) => agAtivo(a) && a.data <= hoje && agFim(a) >= hoje);
    const semFin = AGC.filter((a) => agAtivo(a) && !agFechado(a) && agFim(a) < hoje && agFim(a) >= addDays(hoje, -60));
    const tecs = equipesCampo().map((t) => ({ t, L: camHoje.filter((a) => normNome(a.equipe) === normNome(t)) }));
    const atrProj = new Map();
    TODOS.filter((x) => x.fonte === "crono" && x.sit === "atrasada").forEach((x) => atrProj.set(x.p.id, (atrProj.get(x.p.id) || 0) + 1));
    const topProj = [...atrProj.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => [PMO.projs.find((p) => p.id === id), n]);
    const SETS = [...new Set(pessoas.map((x) => x.setor))];
    return `<div class="kpis mvkpis"><div class="kpi"><div class="v ${tot("atr") ? "bad" : ""}">${TODOS.filter((x) => x.sit === "atrasada").length}</div><div class="l">Pendências atrasadas</div></div><div class="kpi"><div class="v">${linhas.filter((x) => x.atr).length}/${linhas.length}</div><div class="l">Pessoas com atraso</div></div><div class="kpi"><div class="v ${TODOS.filter((x) => x.fonte === "acao" && x.sit === "atrasada").length ? "bad" : ""}">${TODOS.filter((x) => x.fonte === "acao" && x.sit === "atrasada").length}</div><div class="l">Ações vencidas</div></div><div class="kpi"><div class="v">${camHoje.length}</div><div class="l">Programações de campo hoje</div></div><div class="kpi"><div class="v ${semFin.length ? "bad" : ""}">${semFin.length}</div><div class="l">Campo sem finalização</div></div></div>
    <section class="panel"><div class="panel-h"><h2>Pendências por pessoa</h2><span class="note">Mesma regra de “Minhas atividades”: nome no responsável e setor nas obras em que a pessoa está alocada. Clique numa pessoa para ver a lista dela.</span></div>
      <div class="seg gvset"><button class="${!GV.setor ? "on" : ""}" data-gvset="">Todos</button>${SETS.map((s) => `<button class="${GV.setor === s ? "on" : ""}" data-gvset="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="scroll"><table class="stack cfgt gvt"><thead><tr><th>Pessoa</th><th>Setor</th><th class="num">Atrasadas</th><th class="num">Vencem hoje</th><th class="num">Próx. 7 dias</th><th class="num">Em andamento</th><th class="num">Ações abertas</th><th class="num">Campo s/ finalizar</th><th class="num">Total</th></tr></thead><tbody>
      ${linhas.map((x) => `<tr class="gvrow" data-gvver="${esc(x.nome)}" tabindex="0" title="Ver as atividades de ${esc(x.nome)}"><td class="full"><span class="cfgu"><span class="cfgav">${esc(iniciais(x.nome))}</span><b>${esc(x.nome)}</b></span></td><td data-l="Setor">${esc(x.setor)}</td><td class="num ${x.atr ? "bad" : ""}" data-l="Atrasadas">${x.atr || "–"}</td><td class="num" data-l="Hoje">${x.hoje || "–"}</td><td class="num" data-l="7 dias">${x.sem || "–"}</td><td class="num" data-l="Em andamento">${x.and || "–"}</td><td class="num ${x.acAtr ? "bad" : ""}" data-l="Ações">${x.acoes ? x.acoes + (x.acAtr ? ` (${x.acAtr} vencida${x.acAtr > 1 ? "s" : ""})` : "") : "–"}</td><td class="num ${x.campo ? "bad" : ""}" data-l="Campo">${x.campo || "–"}</td><td class="num" data-l="Total"><b>${x.total}</b></td></tr>`).join("")}
      </tbody></table></div></section>
    <div class="gvduo"><section class="panel"><div class="panel-h"><h2>Equipes de campo hoje</h2><span class="note">${fmtD(hoje)}</span></div>
      <ul class="gvtec">${tecs.map(({ t, L }) => `<li><b>${esc(t)}</b>${L.length ? L.map((a) => `<button class="lnk" data-gvag="${esc(a.id)}">${esc(agProjCurto(a) || "programação")}${a.hIni ? " · " + esc(a.hIni) : ""}</button> ${agChip(a)}`).join("") : `<span class="mvbloq">sem programação</span>`}</li>`).join("")}</ul>
      ${semFin.length ? `<p class="hint bad">${semFin.length} programaç${semFin.length > 1 ? "ões" : "ão"} de dias anteriores ainda sem finalização: <button class="lnk" data-pmtab="eqc">abrir Equipes de campo</button></p>` : ""}</section>
    <section class="panel"><div class="panel-h"><h2>Projetos com mais atividades atrasadas</h2><span class="note">Cronograma de execução</span></div>
      ${topProj.length ? `<ul class="gvproj">${topProj.map(([p, n]) => `<li><button class="lnk" data-proj="${esc(p.id)}">${esc(p.nome)}</button><span class="bad"><b>${n}</b> atrasada${n > 1 ? "s" : ""}</span></li>`).join("")}</ul>` : `<p class="hint">Nenhuma atividade atrasada.</p>`}</section></div>`;
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t.closest) return;
    let b;
    if (t.closest("[data-minhas]")) {
      MA.pessoa = "";
      location.hash = "minhas";
      return;
    }
    if ((b = t.closest("[data-gvver]"))) {
      MA.pessoa = b.dataset.gvver;
      MA.fonte = MA.proj = MA.sit = MA.q = "";
      if (location.hash === "#minhas") render();
      else location.hash = "minhas";
      return;
    }
    if ((b = t.closest("[data-gvset]"))) {
      GV.setor = b.dataset.gvset;
      render();
      return;
    }
    if ((b = t.closest("[data-gvag]"))) {
      PM.tab = "eqc";
      savePM();
      render();
      setTimeout(() => agPainel(b.dataset.gvag), 300);
      return;
    }
    if (view !== "minhas") return;
    if (t.closest("[data-mvvoltar]")) {
      e.preventDefault();
      MA.pessoa = "";
      render();
    } else if ((b = t.closest("[data-mvsit]"))) {
      MA.sit = MA.sit === b.dataset.mvsit ? "" : b.dataset.mvsit;
      render();
    } else if ((b = t.closest("[data-mvaviso]"))) {
      const [s, f] = b.dataset.mvaviso.split("|");
      MA.sit = s;
      MA.fonte = f;
      render();
    } else if (t.closest("[data-mvlimpar]")) {
      MA.fonte = MA.proj = MA.sit = MA.q = "";
      render();
    } else if ((b = t.closest("[data-mvmais]"))) {
      MA.abertas[b.dataset.mvmais + "Tudo"] = true;
      render();
    } else if ((b = t.closest("[data-mvabrir]"))) mvAbrir(b.dataset.mvabrir);
    else if ((b = t.closest("[data-mvac]"))) mvAcao(b.dataset.mvac, b.dataset.mvid);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-gvver]")) e.target.click();
  });
  document.addEventListener(
    "toggle",
    (e) => {
      const d = e.target;
      if (d.dataset && d.dataset.mvgr) MA.abertas[d.dataset.mvgr] = d.open;
    },
    true,
  );
  document.addEventListener("input", (e) => {
    if (view !== "minhas" || !e.target.matches || !e.target.matches("[data-mvq]")) return;
    MA.q = e.target.value;
    MA.focoBusca = true;
    render();
  });
  document.addEventListener("change", (e) => {
    if (view !== "minhas") return;
    const t = e.target;
    if (t.dataset && t.dataset.mvf) {
      MA[t.dataset.mvf] = t.value;
      render();
    } else if (t.matches && t.matches("[data-mvquem]")) {
      try {
        localStorage.setItem(MKEY, t.value);
      } catch (err) {}
      render();
    }
  });
  /* cabeçalho fixo nas telas gerais (carteira, Gestão de equipes, Minhas atividades, Configurações):
     o título e as abas logo abaixo dele ficam presos no topo ao rolar a página */
  function fixarCabecalho() {
    const v = document.getElementById("view");
    if (!v) return;
    const h = v.firstElementChild;
    if (!h || !h.matches("header.top")) return;
    const box = document.createElement("div");
    box.className = "pghead";
    v.insertBefore(box, h);
    box.appendChild(h);
    const prox = box.nextElementSibling;
    if (prox && prox.matches("nav.ctabs")) box.appendChild(prox);
  }
  if (document.getElementById("view")) new MutationObserver(fixarCabecalho).observe(document.getElementById("view"), { childList: true });
  /* o que o perfil não pode fazer some da tela (o servidor confere de qualquer jeito) */
  function permsTela() {
    const B = document.body.classList;
    B.toggle("ro-projetos", !PODE("projetos", "editar"));
    B.toggle("ro-campo", !PODE("campo", "criar") && !PODE("campo", "editar"));
    B.toggle("ro-financeiro", !PODE("financeiro", "editar") && !PODE("financeiro", "criar"));
    B.toggle("ro-pmo", !PODE("pmo", "editar") && !PODE("pmo", "criar"));
    B.toggle("sem-fin", !PODE("financeiro"));
    B.toggle("sx-projetos", !PODE("projetos", "exportar"));
    B.toggle("sx-carteira", !PODE("carteira", "exportar"));
    B.toggle("sx-campo", !PODE("campo", "exportar"));
    B.toggle("sem-ia", !PODE("assistente"));
    // tela que o perfil não vê: vai para a primeira que ele pode ver
    const ok = { carteira: PODE("carteira"), pmo: PODE("pmo") || PODE("campo"), minhas: PODE("projetos") || PODE("campo"), config: temConfig() };
    if (view in ok && !ok[view] && SESS().ativado) {
      const alt = ["carteira", "pmo", "config"].find((k) => ok[k]);
      if (alt) location.hash = alt;
      else if (PODE("projetos")) location.hash = "painel";
    }
  }
}
