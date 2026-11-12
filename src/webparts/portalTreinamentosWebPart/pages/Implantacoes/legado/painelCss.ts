/* eslint-disable */
// Estilos do Painel de implantações (origem: painel-projetos/css/styles.css).
// Convertidos para a shadow root da página (:root/html -> :host, body -> [data-implbody]),
// sem o tema escuro e com o tema do portal no fim. Não afetam o restante do portal.
export const PAINEL_CSS: string = `:host {
  --bg: #edf0f3;
  --surface: #ffffff;
  --ink: #17212b;
  --muted: #5c6b7a;
  --line: #d3dae1;
  --line-strong: #aeb9c4;
  --scrum: #2f5d8a;
  --scrum-soft: #dce6f0;
  --wf: #1f7a70;
  --wf-soft: #dcedea;
  --base: #8a96a3;
  --alert: #b3261e;
  --alert-soft: #f7dedc;
  --ok: #2e7d4f;
  --ok-soft: #dcefe3;
  --focus: #2b6a8c;
  color-scheme: light;
  box-sizing: border-box;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
*,
*::before,
*::after {
  box-sizing: inherit;
}
:host {
  scroll-padding-top: env(safe-area-inset-top, 0px);
}
:where([data-implbody]) {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family:
    "Archivo",
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  font-size: 15px;
  line-height: 1.5;
}
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}
:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
:where([data-implbody]).cart header.top:not(#view header.top),
:where([data-implbody]).cart nav.views {
  display: none;
}
.cart-h {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 750;
  font-stretch: 92%;
  margin: 0;
  line-height: 1.1;
}
.cartb {
  margin-bottom: 10px;
  width: 100%;
}
.side .newp {
  width: 100%;
  margin-top: 12px;
}
.pwrap {
  position: relative;
}
.pwrap .pitem {
  width: 100%;
  padding-right: 34px;
}
.pedit {
  position: absolute;
  right: 4px;
  top: 6px;
  width: 26px;
  height: 26px;
  opacity: 0;
  transition: opacity 0.15s;
}
.pwrap:hover .pedit,
.pedit:focus {
  opacity: 1;
}
tr.prow {
  cursor: pointer;
}
tr.prow:hover td {
  background: var(--t-hover);
}
.chip.adm {
  background: color-mix(in srgb, #8e9cf0 22%, transparent);
  color: #8e9cf0;
}
.dwrap {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 28px;
  align-items: center;
}
@container view (max-width:700px) {
  .dwrap {
    grid-template-columns: 1fr;
  }
}
.donut {
  width: 220px;
  height: 220px;
}
.dseg {
  cursor: pointer;
  transition: opacity 0.2s;
}
.dseg.dim {
  opacity: 0.25;
}
.donut .dn {
  font-size: 34px;
  font-weight: 800;
  fill: var(--ink);
  font-family: inherit;
}
.donut .dl {
  font-size: 9.5px;
  fill: var(--muted);
  letter-spacing: 0.04em;
  font-family: inherit;
}
.dleg {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dli {
  display: grid;
  grid-template-columns: 14px 1fr auto 46px;
  gap: 12px;
  align-items: center;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg) 40%, var(--surface));
  padding: 10px 14px;
  cursor: pointer;
  color: var(--ink);
}
.dli:hover {
  border-color: var(--line-strong);
}
.dli.on {
  border-color: var(--scrum);
}
.dli.dim {
  opacity: 0.5;
}
.dli i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.dli .dt {
  display: flex;
  flex-direction: column;
}
.dli .dt b {
  font-size: 14px;
}
.dli .dt small {
  font-size: 12px;
  color: var(--muted);
}
.dli .dc {
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.dli .dp {
  font-size: 12px;
  color: var(--muted);
  text-align: right;
}
td.srcell {
  padding: 6px 8px !important;
}
textarea.srin {
  width: 100%;
  min-height: 38px;
  resize: vertical;
  border: 1px solid var(--t-grid);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--t-row);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--ink);
  display: block;
}
textarea.srin:focus {
  outline: none;
  border-color: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
.acrow {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 130px;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
}
.acrow input {
  border: 1px solid var(--t-grid);
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--t-row);
  font-size: 12.5px;
  color: var(--ink);
  min-width: 0;
  width: 100%;
}
.acrow input:focus {
  outline: none;
  border-color: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
.acrow input.late {
  border-color: var(--alert);
  color: var(--alert);
}
td.srcell .sub {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  margin-top: 4px;
}
.cart-top {
  align-items: center !important;
  margin-bottom: 8px !important;
}
.ctabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 18px;
}
.ctabs button {
  border: 0;
  background: none;
  padding: 10px 16px;
  font: inherit;
  font-weight: 650;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}
.ctabs button.on {
  color: var(--ink);
  border-bottom-color: var(--scrum);
}
.ctlbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  align-items: flex-end;
  margin-bottom: 14px;
}
.ctlbar h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 750;
  font-stretch: 92%;
}
.ctlbar .sp {
  flex: 1;
}
.ctlbar label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
.ctlbar label.chk {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  height: 34px;
  font-size: 13px;
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
}
.ctlbar select:disabled {
  opacity: 0.5;
}
.ctlbar select {
  max-width: 280px;
  height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  padding: 0 8px;
  font-size: 13.5px;
  font-weight: 600;
  min-width: 120px;
}
.ccard.crec {
  border-color: color-mix(in srgb, var(--wf) 55%, var(--line));
  background: color-mix(in srgb, var(--wf) 9%, var(--surface));
}
.ccard.crec .cv {
  color: var(--wf);
}
.ccard .cvs {
  font-size: 13px;
  font-weight: 600;
  margin-left: 3px;
  color: var(--muted);
}
.ctltb tr.nrec td {
  background: color-mix(in srgb, var(--wf) 8%, transparent);
}
.ctltb tr.pgrp.nrec td {
  color: var(--wf);
}
.ntag {
  font-size: 10.5px;
  font-weight: 650;
  color: var(--wf);
  border: 1px solid color-mix(in srgb, var(--wf) 50%, transparent);
  border-radius: 4px;
  padding: 0 5px;
  margin-left: 4px;
  white-space: nowrap;
}
.ctlcards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
@container view (max-width:1150px) {
  .ctlcards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container view (max-width:760px) {
  .ctlcards {
    grid-template-columns: 1fr;
  }
}
.ccard {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ccard .cl {
  font-size: 12.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.ccard .cl i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.ccard .cv {
  font-size: 24px;
  font-weight: 750;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  letter-spacing: -0.01em;
}
.ccard small {
  font-size: 12px;
  color: var(--muted);
}
.cbar {
  height: 4px;
  background: var(--bg);
  border-radius: 2px;
  overflow: hidden;
}
.cbar b {
  display: block;
  height: 100%;
  background: var(--ok);
}
.seg {
  display: inline-flex;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
}
.seg button {
  border: 0;
  background: none;
  padding: 5px 12px;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}
.seg button.on {
  background: var(--surface);
  color: var(--ink);
  font-weight: 650;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.ctlscroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
table.ctltb {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
  min-width: 100%;
  width: auto;
  table-layout: auto;
}
.ctltb th,
.ctltb td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
  background: var(--surface);
}
.ctltb th {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.ctltb .pn2 {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 260px;
  text-align: left;
  font-family: inherit;
  border-right: 1px solid var(--line);
}
.ctltb .mn {
  text-align: right;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  min-width: 120px;
}
.ctltb .inr {
  background: color-mix(in srgb, var(--scrum) 9%, var(--surface));
}
/* mês com três colunas (previsto · faturado · diferença) */
.ctltb .mfirst {
  border-left: 1px solid var(--line);
}
.ctltb th.mgrp {
  text-align: center;
  color: var(--ink);
}
.ctltb thead tr:first-child th {
  border-bottom: 0;
  padding-bottom: 3px;
}
.ctltb thead tr:last-child th {
  font-size: 11px;
  padding-top: 3px;
}
.ctltb .mn {
  min-width: 112px;
}
.ctltb tr.ptot td {
  background: color-mix(in srgb, var(--scrum) 16%, var(--surface));
  font-weight: 750;
}
.ctltb tr.pgrp td {
  font-weight: 700;
}
.ctltb tr.prow td.pn2 {
  padding-left: 24px;
}
.rtag {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 6px;
}
.srgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
  gap: 16px;
}
@container view (max-width:600px) {
  .srgrid {
    grid-template-columns: 1fr;
  }
}
.srcard {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--bg) 40%, var(--surface));
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.srh {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.srh h3 {
  margin: 0;
  font-size: 15.5px;
  font-weight: 750;
  font-stretch: 92%;
}
.srh .sub {
  font-size: 12px;
  color: var(--muted);
}
.srk {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 10px 0;
}
.srk div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.srk span {
  font-size: 11.5px;
  color: var(--muted);
}
.srk b {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
.srk small {
  font-size: 11.5px;
  color: var(--muted);
}
@container view (max-width:600px) {
  .srk {
    grid-template-columns: repeat(2, 1fr);
  }
}
.srs h4 {
  margin: 0 0 6px;
  font-size: 12.5px;
  font-weight: 700;
}
.srs h4 small {
  font-weight: 500;
  color: var(--muted);
}
.srs ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.srs li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12.5px;
  padding: 4px 0;
  border-top: 1px solid var(--line);
}
.srs li:first-child {
  border-top: 0;
}
.acth,
.actr {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 150px 130px;
  gap: 6px;
  align-items: center;
}
.acth {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  padding-left: 24px;
  grid-template-columns: minmax(0, 1fr) 150px 130px;
}
.actr {
  margin-top: 5px;
}
.actn {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
}
.actr input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--surface);
  font-size: 13px;
  color: var(--ink);
  min-width: 0;
  width: 100%;
}
.actr input:focus {
  outline: none;
  border-color: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
.actr input.late {
  border-color: var(--alert);
  color: var(--alert);
}
.srf {
  display: flex;
  justify-content: flex-end;
}
.bars {
  display: flex;
  gap: 14px;
  align-items: flex-end;
  overflow-x: auto;
  padding: 10px 4px 0;
}
.bcol {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 72px;
}
.bstack {
  width: 44px;
  display: flex;
  flex-direction: column-reverse;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg);
}
.bstack i {
  display: block;
  min-height: 4px;
  background: var(--scrum);
  border-top: 1px solid var(--surface);
}
.bstack i.r {
  background: var(--alert);
}
.bstack i.a {
  background: var(--wf);
}
.bstack i.c {
  background: var(--ok);
}
.bv {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.bl {
  font-size: 12px;
  color: var(--ink);
}
.bn {
  font-size: 11px;
  color: var(--muted);
}
.shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}
.side {
  background: var(--surface);
  border-right: 1px solid var(--line);
  padding: 18px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}
.side-h {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--muted);
  padding: 0 10px 10px;
  text-transform: uppercase;
}
.plist {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pitem {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  border: 1px solid transparent;
  background: none;
  border-radius: 8px;
  padding: 9px 10px;
  cursor: pointer;
  color: var(--ink);
}
.pitem:hover {
  background: color-mix(in srgb, var(--scrum) 8%, transparent);
}
.pitem.on {
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
  border-color: color-mix(in srgb, var(--scrum) 35%, transparent);
}
.pitem .pn {
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.pitem .pc {
  font-size: 12px;
  color: var(--muted);
}
@media (max-width: 900px) {
  .side {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    align-items: stretch;
  }
  .side-h {
    display: none;
  }
  .side > *,
  .plist > * {
    flex: 0 0 auto;
  }
  .side .cartb {
    margin: 0;
    min-width: 170px;
    width: auto;
  }
  .side .newp {
    width: auto;
    margin: 0;
    white-space: nowrap;
  }
  .pwrap {
    min-width: 200px;
  }
  .shell {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    padding: 10px;
  }
  .plist {
    flex-direction: row;
    overflow-x: auto;
  }
  .pitem {
    min-width: 200px;
  }
}
.wrap {
  max-width: 1360px;
  margin: 0 auto;
  padding: 22px 20px 64px;
  min-width: 0;
}
:where([data-implbody]).full .wrap {
  max-width: none;
  padding-left: 24px;
  padding-right: 24px;
}
.shell > .wrap {
  margin: 0;
  width: 100%;
  min-width: 0;
  overflow-x: clip;
}
#view {
  min-width: 0;
  container-type: inline-size;
  container-name: view;
}
@container view (max-width:1380px) {
  table.crono col.c-eap {
    width: 64px !important;
  }
  table.crono col.c-rk {
    width: 46px !important;
  }
  table.crono col.c-st {
    width: 116px !important;
  }
  table.crono col.c-pc {
    width: 82px !important;
  }
  table.crono col.c-du {
    width: 56px !important;
  }
  table.crono col.c-pl,
  table.crono col.c-rv,
  table.crono col.c-re {
    width: 124px !important;
  }
  table.crono col.c-pr {
    width: 72px !important;
  }
  table.crono col.c-ob {
    width: 13% !important;
  }
  table.crono col.c-ac {
    width: 38px !important;
  }
  table.crono td.real {
    white-space: normal;
  }
  table.crono input.dt {
    display: block;
    width: 100% !important;
    margin: 0 0 4px !important;
  }
  table.crono input.dt:last-child {
    margin-bottom: 0 !important;
  }
  table.crono td.dts {
    white-space: normal;
  }
  table.crono .stt {
    font-size: 11px;
    padding: 2px 6px;
  }
  table.crono .pcell {
    gap: 4px;
  }
  table.crono .pbar {
    min-width: 14px;
  }
}

header.top {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 28px;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 18px;
}
.title-block {
  min-width: 0;
  flex: 1 1 380px;
}
#projName {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 750;
  font-stretch: 92%;
  letter-spacing: -0.01em;
  line-height: 1.1;
  border: 0;
  background: transparent;
  width: 100%;
  padding: 2px 0;
  border-bottom: 1px dashed transparent;
}
#projName:hover,
#projName:focus {
  border-bottom-color: var(--line-strong);
  outline: none;
}
.subtitle {
  color: var(--muted);
  margin: 4px 0 0;
  font-size: 14px;
}
.params {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  align-items: flex-end;
}
.params label {
  display: flex;
  flex-direction: column;
  font-size: 12.5px;
  color: var(--muted);
  gap: 4px;
}
.params input {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 14px;
  color: var(--ink);
}
.sync {
  font-size: 12.5px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.sync[hidden] {
  display: none;
}
#finRevSel {
  appearance: none;
  -webkit-appearance: none;
  height: 36px;
  min-width: 170px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  padding: 0 34px 0 12px;
  background: var(--surface)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%238A96A3' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 12px center;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
#finRevSel:hover {
  border-color: var(--ink);
}
#finRevSel:focus {
  outline: none;
  border-color: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
#btnNewRev,
#btnDelRev {
  height: 36px;
}
.revbox {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.revlbl {
  font-size: 12.5px;
  color: var(--muted);
}
.revrow {
  display: flex;
  gap: 8px;
  align-items: center;
}
#btnDelRev:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.revmot {
  font-size: 12px;
  color: var(--muted);
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 16px;
}
.params {
  align-items: flex-start !important;
}
.sync i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
  display: inline-block;
}
.sync.cloud i {
  background: var(--ok);
}

nav.views {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 18px;
}
nav.views {
  overflow-x: auto;
}
.revrow {
  flex-wrap: wrap;
}
nav.views a {
  white-space: nowrap;
  padding: 9px 14px;
  text-decoration: none;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  font-weight: 650;
  font-stretch: 92%;
}
nav.views a[aria-current="page"] {
  color: var(--ink);
  border-bottom-color: var(--ink);
}

.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  margin-bottom: 18px;
  overflow: hidden;
}
.kpi {
  padding: 12px 16px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  margin: 0 -1px -1px 0;
}
.kpi .v {
  font-size: 25px;
  font-weight: 720;
  font-stretch: 86%;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.kpi .l {
  font-size: 12.5px;
  color: var(--muted);
}
.kpi .v.bad {
  color: var(--alert);
}
.kpi .v.good {
  color: var(--ok);
}
.kpi .v.warn {
  color: var(--wf);
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 18px;
}
.ith,
.itr {
  display: grid;
  grid-template-columns: 70px 100px minmax(200px, 1fr) 90px 60px 130px 112px 130px 30px;
  gap: 6px;
  align-items: center;
}
.ith {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  border-bottom: 1px solid var(--line);
  padding-bottom: 4px;
}
.itlist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.itr input,
.itr select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg);
  font-size: 13.5px;
  color: var(--ink);
  min-width: 0;
  width: 100%;
}
.itr input[data-k="qtd"],
.itr input[data-k="vu"] {
  text-align: right;
}
.itt {
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 13.5px;
}
.itr .rm:hover {
  color: var(--alert);
  background: color-mix(in srgb, var(--alert) 12%, transparent);
}
.ittot {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: flex-end;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.ittot b {
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.stt.s-r {
  color: var(--alert);
}
.stt.s-o {
  color: #c77a1e;
}
table.crono tr.cur td {
  background: color-mix(in srgb, var(--scrum) 8%, var(--t-row));
}
.fbanner {
  display: flex;
  gap: 12px;
  align-items: baseline;
  flex-wrap: wrap;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 18px;
  border: 1px solid var(--line);
}
.fbanner b {
  font-size: 14px;
}
.fbanner span {
  font-size: 13.5px;
  color: var(--muted);
}
.fbanner.ok {
  background: var(--ok-soft);
  border-color: var(--ok);
}
.fbanner.ok b {
  color: var(--ok);
}
.fbanner.lock {
  background: var(--scrum-soft);
  border-color: color-mix(in srgb, var(--scrum) 40%, transparent);
}
.fbanner.lock b {
  color: var(--scrum);
}
table.crono.ftb td {
  padding: 7px 10px !important;
}
#formItens .addc {
  align-self: flex-start;
  padding-left: 0;
  color: var(--scrum);
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 18px;
}
@container view (max-width:900px) {
  .grid3 {
    grid-template-columns: 1fr;
  }
}
.role .n.neg {
  color: var(--alert);
}
.grid21 {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 18px;
  margin-bottom: 18px;
}
@container view (max-width:820px) {
  .grid2,
  .grid21 {
    grid-template-columns: 1fr;
  }
}
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px 18px 18px;
  min-width: 0;
}
#view > .panel {
  margin-bottom: 18px;
}
#view > .panel:last-child {
  margin-bottom: 0;
}
.panel .tw {
  margin-top: 4px;
}
.panel-h {
  margin-bottom: 12px !important;
}
.kpis + .kpis {
  margin-top: -6px;
}
.panel-h {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.panel-h h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 720;
  font-stretch: 90%;
}
.panel-h .note {
  font-size: 12.5px;
  color: var(--muted);
}
.chart {
  position: relative;
  width: 100%;
}
.chart svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.chart .ax {
  font-size: 11px;
  fill: var(--muted);
  font-family: inherit;
}
.chart .grid {
  stroke: var(--line);
  stroke-width: 1;
}
.chart .cut {
  stroke: var(--alert);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.chart .cutl {
  font-size: 10.5px;
  fill: var(--alert);
}
.chart .lim {
  stroke: var(--ink);
  stroke-width: 1.2;
  stroke-dasharray: 6 3;
}
.chart .liml {
  font-size: 10.5px;
  fill: var(--ink);
  font-weight: 600;
}
.chart .hair {
  stroke: var(--line-strong);
  stroke-width: 1;
}
.tip {
  position: absolute;
  pointer-events: none;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 12.5px;
  line-height: 1.45;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: none;
  z-index: 3;
}
.tip b {
  font-weight: 700;
}
.tip .sw {
  display: inline-block;
  width: 10px;
  height: 3px;
  margin-right: 6px;
  vertical-align: 3px;
}
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 12.5px;
  color: var(--muted);
  margin-top: 8px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend svg {
  width: 24px;
  height: 8px;
}
.chart-empty {
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  padding: 34px 18px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.chart-foot {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.stk {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
.stk h3 {
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  margin: 4px 0 4px;
  font-stretch: 95%;
}
.stk h3 .org {
  color: var(--ink);
}
.role {
  display: grid;
  grid-template-columns: minmax(110px, 40%) 1fr;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid var(--line);
}
.role .admper {
  grid-column: 1 / -1;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--alert);
  font-size: 12.5px;
}
.role .admper li {
  line-height: 1.4;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 4px 14px;
  flex-wrap: wrap;
}
.role .admper b {
  font-weight: 400;
  margin-left: auto;
  text-align: right;
  white-space: nowrap;
}
.role .r {
  font-size: 13px;
  color: var(--muted);
}
.role .n {
  font-weight: 650;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.role .n.tbd {
  color: var(--muted);
  font-weight: 500;
  font-style: italic;
}
.role .c {
  display: block;
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 400;
  font-style: normal;
}

.stages {
  list-style: none;
  margin: 0;
  padding: 0;
}
.stage {
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.stage:first-child {
  border-top: 0;
  padding-top: 2px;
}
.stage-top {
  display: flex;
  align-items: baseline;
  gap: 8px;
  justify-content: space-between;
}
.stage-top .nm {
  font-weight: 680;
  font-stretch: 92%;
}
.stage-top .nm small {
  font-weight: 500;
  color: var(--muted);
  font-size: 12px;
  margin-left: 4px;
}
.chip {
  font-size: 11.5px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.chip.n {
  background: var(--bg);
  color: var(--muted);
}
.chip.a {
  background: var(--scrum-soft);
  color: var(--scrum);
}
.chip.c {
  background: var(--ok-soft);
  color: var(--ok);
}
.chip.r {
  background: var(--alert-soft);
  color: var(--alert);
}
.bar {
  height: 7px;
  background: var(--bg);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
  margin-top: 6px;
}
.bar b {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 4px;
  background: var(--scrum);
}
.bar.w b {
  background: var(--wf);
}
.bar .pl {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--ink);
}
.stage-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
  margin-top: 3px;
  font-variant-numeric: tabular-nums;
}
.gdate {
  font-size: 12px;
  color: var(--muted);
  margin-left: 10px;
  font-variant-numeric: tabular-nums;
}
.gatebtn {
  border: 0;
  background: none;
  padding: 0;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.gatebtn i {
  width: 9px;
  height: 9px;
  transform: rotate(45deg);
  border: 1.5px solid var(--line-strong);
  display: inline-block;
}
.gatebtn[aria-pressed="true"] {
  color: var(--ok);
}
.gatebtn[aria-pressed="true"] i {
  background: var(--ok);
  border-color: var(--ok);
}
details.fr {
  margin-top: 6px;
}
details.fr summary {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--muted);
}
.frl {
  list-style: none;
  padding: 0;
  margin: 6px 0 0;
}
.frl li {
  display: grid;
  grid-template-columns: 1fr 70px 42px;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  padding: 2px 0;
}
.frl .bar {
  margin: 0;
  height: 5px;
}
.frl .p {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

.alerts {
  list-style: none;
  padding: 0 8px 0 0;
  margin: 0;
  max-height: 460px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.panel.alp {
  display: flex;
  flex-direction: column;
}
.panel.alp .alerts {
  flex: 1 1 0;
  min-height: 320px;
  max-height: none;
}
.alerts::-webkit-scrollbar {
  width: 8px;
}
.alerts::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 4px;
}
.alerts::-webkit-scrollbar-track {
  background: transparent;
}
.alerts li {
  padding: 9px 0;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 10px;
  align-items: baseline;
}
.alerts li:first-child {
  border-top: 0;
}
.tag {
  font-size: 11.5px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.tag.r {
  background: var(--alert-soft);
  color: var(--alert);
}
.tag.a {
  background: var(--wf-soft);
  color: var(--wf);
}
.tag.b {
  background: var(--scrum-soft);
  color: var(--scrum);
}
.ok-msg {
  color: var(--muted);
  font-size: 14px;
  margin: 4px 0 0;
}

.btn {
  border: 1px solid var(--line-strong);
  background: var(--surface);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13.5px;
}
.btn:hover {
  border-color: var(--ink);
}
.btn.primary {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
.btn.ghost {
  border-color: transparent;
  background: transparent;
  padding: 4px 8px;
  font-weight: 500;
  color: var(--muted);
}
.btn.ghost:hover {
  color: var(--ink);
}
.btn.danger {
  color: var(--alert);
}
.btn.dangerfill {
  background: var(--alert);
  border-color: var(--alert);
  color: #fff;
}

/* Cronograma */
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.chips a {
  padding: 5px 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  text-decoration: none;
  color: var(--muted);
  font-size: 13.5px;
  font-weight: 600;
  background: var(--surface);
}
.chips a[aria-current="page"] {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.toolbar .sp {
  flex: 1;
}
.chipbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.chipbar .chips {
  margin: 0;
}
.chipbar .sp {
  flex: 1;
}
.g3seg {
  margin: -4px 0 14px;
}
.rtgrid {
  display: grid;
  grid-template-columns: minmax(300px, 420px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
@container view (max-width:900px) {
  .rtgrid {
    grid-template-columns: 1fr;
  }
}
.rtbar {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.rtrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.rtbar .sp {
  flex: 1;
}
.rtbar .btn {
  padding: 4px 8px;
  font-size: 12.5px;
}
.rtlist {
  display: flex;
  flex-direction: column;
  max-height: min(52vh, 420px);
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.rti {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 5px 10px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
}
.rti:last-child {
  border-bottom: 0;
}
.rti.dis {
  opacity: 0.55;
  cursor: not-allowed;
}
.rti:hover:not(.dis) {
  background: color-mix(in srgb, var(--scrum) 7%, transparent);
}
.rtt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rtt b {
  font-size: 13.5px;
}
.rtt small {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rtc {
  font-size: 11.5px;
  color: var(--muted);
  white-space: nowrap;
}
.rtbase {
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--ok) 6%, var(--surface));
}
.rtbase b {
  font-size: 13.5px;
}
.rtbase small {
  font-size: 11.5px;
  color: var(--muted);
}
.rtd .sv {
  margin-left: 10px;
  font-size: 11.5px;
  color: var(--scrum);
}
.rtopt label.chkl {
  flex-direction: row;
  align-items: center;
  color: var(--ink);
  font-size: 13.5px;
}
.rtopt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}
.rtopt label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.rtopt select,
.rtopt input:not([type="checkbox"]) {
  height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  padding: 0 8px;
  font-size: 13.5px;
}
.rtk {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.rtk div {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
}
.rtk b {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.rtk span {
  font-size: 11.5px;
  color: var(--muted);
}
@container view (max-width:700px) {
  .rtk {
    grid-template-columns: repeat(2, 1fr);
  }
}
.rtmap {
  width: 100%;
  max-height: 340px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg) 50%, var(--surface));
}
.rtn {
  font-size: 9px;
  font-weight: 700;
  font-family: inherit;
}
.rto {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.rto li {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 7px 0;
  border-top: 1px solid var(--line);
}
.rtno {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--scrum-soft);
  color: var(--scrum);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rtno.o {
  background: var(--ok-soft);
  color: var(--ok);
}
.rtd {
  font-size: 12.5px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
a.btn {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.implbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.implsum {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.isum {
  display: flex;
  align-items: baseline;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  padding: 6px 12px;
  cursor: pointer;
  color: var(--ink);
}
.isum b {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.isum span {
  font-size: 12.5px;
  color: var(--muted);
}
.isum.on {
  border-color: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
.isum.ok b {
  color: var(--ok);
}
.isum.run b {
  color: var(--scrum);
}
.isum.late b {
  color: var(--alert);
}
.isum.todo b {
  color: var(--muted);
}
.implacts {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.ipcol {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ipv {
  font-size: 11px;
  color: var(--muted);
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ipv a {
  color: var(--scrum);
}
.vsum {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.vsum span {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  color: var(--muted);
}
.vsum b {
  color: var(--ink);
  font-size: 15px;
  margin-right: 4px;
}
.vsum .warn {
  border-color: #e0a458;
}
.vsum .bad {
  border-color: var(--alert);
}
.vact {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 9px;
  white-space: nowrap;
}
.vact.upd {
  background: var(--ok-soft);
  color: var(--ok);
}
.vact.ren {
  background: var(--scrum-soft);
  color: var(--scrum);
}
.vact.new {
  background: color-mix(in srgb, #e0a458 20%, transparent);
  color: #c77a1e;
}
.vact.bad {
  background: var(--alert-soft);
  color: var(--alert);
}
.vout {
  border: 1px solid color-mix(in srgb, #e0a458 50%, transparent);
  border-radius: 8px;
  padding: 10px 12px;
}
.vout ul {
  margin: 6px 0 8px;
  padding-left: 18px;
  font-size: 13px;
}
table.crono.vprev {
  table-layout: auto !important;
  width: max-content !important;
  min-width: 100%;
}
table.crono.vprev td,
table.crono.vprev th {
  white-space: nowrap;
}
.chkl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}
.chkl input {
  width: auto;
}
.isearch {
  height: 34px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  padding: 0 10px;
  font-size: 13.5px;
  min-width: 220px;
}
.implscroll {
  overflow-x: auto;
  border: 1px solid var(--t-grid, var(--line));
  border-radius: 8px;
}
table.impltb {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  table-layout: auto;
  font-size: 13px;
}
.impltb th {
  background: var(--t-head);
  color: var(--t-head-ink);
  font-size: 12px;
  font-weight: 650;
  padding: 9px 10px;
  text-align: center;
  white-space: nowrap;
  position: sticky;
  top: 0;
}
.impltb th small {
  display: block;
  font-weight: 500;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
.impltb td {
  border-bottom: 1px solid var(--t-grid);
  border-right: 1px solid var(--t-grid);
  padding: 4px;
  background: var(--t-row);
  text-align: center;
}
.impltb .ipn {
  text-align: left;
  min-width: 220px;
  position: sticky;
  left: 0;
  z-index: 2;
}
.impltb td.ipn {
  padding: 6px 10px;
  vertical-align: middle;
}
.ipw {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ieap {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  min-width: 30px;
}
.ipname {
  font-weight: 650;
}
.impltb .ipc {
  min-width: 120px;
  padding: 4px 10px;
  vertical-align: middle;
}
.icb {
  width: 100%;
  min-width: 104px;
  border: 0;
  border-radius: 6px;
  padding: 6px 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: transparent;
  color: inherit;
}
.icb:hover {
  background: color-mix(in srgb, var(--scrum) 10%, transparent);
}
.icb .ii {
  font-size: 15px;
  line-height: 1;
}
.icb .it {
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
td.ic.ok .ii {
  color: var(--ok);
}
td.ic.run .ii {
  color: var(--scrum);
}
td.ic.late {
  background: color-mix(in srgb, var(--alert) 10%, var(--t-row));
}
td.ic.late .ii,
td.ic.late .it {
  color: var(--alert);
}
td.ic.todo .ii {
  color: var(--muted);
}
td.ic.ok {
  background: color-mix(in srgb, var(--ok) 8%, var(--t-row));
}
.icb .im {
  font-size: 10.5px;
  color: var(--muted);
  opacity: 0.85;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.imodeall {
  display: block;
  margin: 5px auto 0;
  font-size: 11px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--t-head-ink) 25%, transparent);
  background: transparent;
  color: var(--t-head-ink);
  padding: 2px 4px;
  max-width: 150px;
}
.imodeall option {
  color: #000;
}
.icsteps {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 340px;
  overflow-y: auto;
}
.icstep {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 7px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.icstep.ok {
  border-color: color-mix(in srgb, var(--ok) 50%, transparent);
}
.icstep.run {
  border-color: color-mix(in srgb, var(--scrum) 50%, transparent);
}
.ist b {
  font-size: 12.5px;
  display: block;
}
.ist small {
  font-size: 11px;
  color: var(--muted);
}
.isd {
  display: grid;
  grid-template-columns: 1fr 1fr 30px;
  gap: 5px;
}
.isd button {
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: 6px;
  cursor: pointer;
  color: var(--ok);
  font-weight: 700;
}
#icMenu select {
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--ink);
  padding: 0 6px;
  font-size: 13px;
}
#icMenu:has(.icsteps) {
  min-width: 420px;
}
.icmenu {
  min-width: 240px;
  padding: 10px;
  gap: 8px;
}
.icmenu label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
.icmenu input.dt {
  width: 100% !important;
  display: block;
  margin: 0 !important;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--ink);
}
.ich {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ich b {
  font-size: 13px;
}
.ich small {
  font-size: 11.5px;
  color: var(--muted);
}
.icact {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.icact button {
  flex: 1;
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12.5px;
  cursor: pointer;
  color: var(--ink);
}
.icact button:hover {
  border-color: var(--scrum);
}
td.rkc {
  text-align: center;
  padding: 4px !important;
}
.rk {
  border: 0;
  background: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: inline-flex;
}
.rk i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: block;
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 0%, transparent);
}
.rk.man i {
  box-shadow:
    0 0 0 2px var(--surface),
    0 0 0 3.5px var(--ink);
}
.rk:hover {
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
}
.rkmenu {
  position: absolute;
  z-index: 60;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  padding: 4px;
  display: flex;
  flex-direction: column;
  min-width: 150px;
}
.rkmenu[hidden] {
  display: none;
}
.rkmenu button {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: none;
  text-align: left;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--ink);
}
.rkmenu button:hover,
.rkmenu button.on {
  background: color-mix(in srgb, var(--scrum) 12%, transparent);
}
.rkmenu i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: block;
}
.expw {
  position: relative;
  display: inline-flex;
}
.expw .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.expm {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  padding: 4px;
  display: flex;
  flex-direction: column;
  min-width: 140px;
}
.expm[hidden] {
  display: none;
}
.expm button {
  border: 0;
  background: none;
  text-align: left;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--ink);
}
.expm button:hover {
  background: color-mix(in srgb, var(--scrum) 12%, transparent);
}
.acts {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.desc {
  color: var(--muted);
  font-size: 14px;
  max-width: 80ch;
  margin: 0 0 14px;
}
.scroll {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13.5px;
  font-stretch: 94%;
  table-layout: fixed;
}
th,
td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}
td {
  overflow-wrap: break-word;
  hyphens: auto;
}
th {
  font-weight: 600;
  color: var(--muted);
  font-size: 12.5px;
  background: var(--surface);
}
tr:last-child td {
  border-bottom: 0;
}
td.code {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  font-weight: 600;
}
td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
tr.group td {
  background: var(--wf-soft);
  font-weight: 700;
}
tr.sub td {
  background: color-mix(in srgb, var(--wf-soft) 45%, var(--surface));
  font-weight: 600;
}
tr.parent td {
  background: var(--wf-soft);
  font-weight: 700;
}
tr.proj td {
  background: var(--ink);
  color: var(--bg);
  font-weight: 750;
  border-bottom-color: var(--ink);
}
tr.proj td .small,
tr.proj .pred {
  color: color-mix(in srgb, var(--bg) 70%, var(--ink));
}
tr.proj .pc {
  color: var(--bg) !important;
}
tr.proj .chip {
  background: color-mix(in srgb, var(--bg) 18%, var(--ink));
  color: var(--bg);
}
.tg {
  border: 0;
  background: none;
  color: inherit;
  padding: 0;
  width: 16px;
  height: 16px;
  margin: 0 4px 0 -4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: -2px;
  border-radius: 3px;
}
.tg:hover {
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.tg[aria-expanded="false"] svg {
  transform: rotate(-90deg);
}
@media (prefers-reduced-motion: no-preference) {
  .tg svg {
    transition: transform 0.15s ease;
  }
}
tr.parent td .small {
  font-weight: 500;
}
tr.child td.code {
  padding-left: 22px;
  font-weight: 500;
  color: var(--muted);
}
tr.child td:nth-child(2) {
  padding-left: 22px;
}
tr.pt td {
  background: color-mix(in srgb, var(--wf-soft) 40%, var(--surface));
  font-weight: 650;
}
tr.pt td .small {
  font-weight: 500;
}
tr.pt td.code,
tr.pt td:nth-child(2) {
  padding-left: 22px;
}
tr.child.l2 td.code,
tr.child.l2 td:nth-child(2) {
  padding-left: 36px;
}
tr.late td.code {
  color: var(--alert);
}
tr.late td.code {
  color: var(--alert);
}
td .small {
  display: block;
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}
td.pred {
  font-size: 12.5px;
  color: var(--muted);
}
td.code .mk {
  display: inline-block;
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  background: var(--wf);
  margin-right: 6px;
  vertical-align: 1px;
}
th.c-act,
td.c-act {
  width: 72px;
  text-align: right;
  padding-left: 4px;
  padding-right: 8px;
}
select.st,
input.pct {
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 3px 6px;
  background: var(--surface);
  font-size: 13px;
  max-width: 100%;
}
input.pct {
  width: 64px;
  text-align: right;
}
.real {
  white-space: nowrap;
}
input.dt {
  display: inline-block;
  width: calc(50% - 3px);
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 2px 4px;
  background: var(--surface);
  font-size: 12.5px;
  vertical-align: middle;
}
input.dt + input.dt {
  margin-left: 6px;
}
td.prev {
  white-space: nowrap;
  font-size: 12.5px;
}
textarea.obs {
  width: 100%;
  min-height: 34px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 4px 6px;
  background: var(--surface);
  font: inherit;
  font-size: 12.5px;
  line-height: 1.35;
  display: block;
}
td.obsc {
  padding-top: 6px;
  padding-bottom: 6px;
}
@container view (max-width:1000px) {
  table.stack.wide,
  table.stack.wide tbody {
    display: block;
  }
  table.stack.wide thead,
  table.stack.wide colgroup {
    display: none;
  }
  table.stack.wide tr {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 14px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
  }
  table.stack.wide td {
    border: 0;
    padding: 0 !important;
    width: auto !important;
    text-align: left;
  }
  table.stack.wide td.code {
    grid-column: 1/2;
  }
  table.stack.wide td:nth-child(2) {
    grid-column: 2/-1;
  }
  table.stack.wide td.real,
  table.stack.wide td.obsc {
    grid-column: 1/-1;
  }
  table.stack.wide td:nth-child(2) {
    grid-column: 2/-1;
  }
  table.stack.wide td[data-l]::before {
    content: attr(data-l);
    display: block;
    font-size: 11.5px;
    color: var(--muted);
    font-weight: 500;
  }
  table.stack.wide td.obsc:empty,
  table.stack.wide td.c-act:empty {
    display: none;
  }
  table.stack.wide td.c-act {
    grid-column: -2/-1;
    text-align: right;
  }
  table.stack.wide tr.child.l2 {
    padding-left: 30px;
  }
  table.stack.wide tr.child:not(.l2) {
    padding-left: 18px;
  }
}
@container view (max-width:520px) {
  table.stack.wide tr {
    grid-template-columns: 1fr 1fr;
  }
}
.pc {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.pc.p50 {
  color: var(--scrum);
}
.pc.p100 {
  color: var(--ok);
}
select.st[data-v="concluido"] {
  background: var(--ok-soft);
  border-color: var(--ok);
}
select.st[data-v="bloqueado"] {
  background: var(--alert-soft);
  border-color: var(--alert);
}
select.st[data-v="andamento"] {
  background: var(--scrum-soft);
  border-color: var(--scrum);
}
.sprint {
  margin-bottom: 20px;
}
.sprint-h {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin: 0 0 8px;
  flex-wrap: wrap;
}
.sprint-h h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  font-stretch: 90%;
}
.sprint-h .meta {
  color: var(--muted);
  font-size: 13px;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 120px 0;
  color: var(--muted);
  font-size: 15px;
}
.spin {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line-strong);
  border-top-color: var(--scrum);
  border-radius: 50%;
  animation: sp 0.8s linear infinite;
}
@keyframes sp {
  to {
    transform: rotate(360deg);
  }
}
.empty {
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  padding: 28px;
  text-align: center;
  color: var(--muted);
  background: var(--surface);
}
.empty p {
  margin: 0 0 12px;
}
@container view (max-width:640px) {
  table.stack,
  table.stack tbody {
    display: block;
  }
  table.stack thead,
  table.stack colgroup {
    display: none;
  }
  table.stack tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 14px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
  }
  table.stack td {
    border: 0;
    padding: 0;
    width: auto !important;
  }
  table.stack td.full {
    grid-column: 1/-1;
  }
  table.stack td[data-l]::before {
    content: attr(data-l);
    display: block;
    font-size: 11.5px;
    color: var(--muted);
    font-weight: 500;
  }
  table.stack tr.group,
  table.stack tr.sub {
    display: block;
    padding: 8px 14px;
  }
  table.stack tr.group td,
  table.stack tr.sub td {
    display: inline;
    background: none;
  }
  table.stack tr.group {
    background: var(--wf-soft);
  }
  table.stack tr.parent {
    background: var(--wf-soft);
  }
  table.stack tr.pt {
    background: color-mix(in srgb, var(--wf-soft) 40%, var(--surface));
  }
  table.stack tr.pt td.code,
  table.stack tr.pt td:nth-child(2),
  table.stack tr.child.l2 td.code,
  table.stack tr.child.l2 td:nth-child(2) {
    padding-left: 0;
  }
  table.stack td.real {
    grid-column: 1/-1;
  }
  table.stack td.prev,
  table.stack td.real {
    white-space: normal;
  }
  table.stack tr.child td.code,
  table.stack tr.child td:nth-child(2) {
    padding-left: 0;
  }
  table.stack tr.sub {
    background: color-mix(in srgb, var(--wf-soft) 45%, var(--surface));
  }
}

dialog {
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  padding: 0;
  width: min(660px, calc(100vw - 24px));
  max-height: calc(100vh - 40px);
}
dialog::backdrop {
  background: rgba(10, 15, 20, 0.45);
}
dialog form {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
dialog h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  font-stretch: 90%;
}
dialog h4 {
  margin: 4px 0 -4px;
  font-size: 13px;
  color: var(--muted);
  font-weight: 700;
}
dialog.wide {
  width: min(980px, calc(100vw - 24px));
}
.sgrid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (max-width: 820px) {
  .sgrid {
    grid-template-columns: 1fr;
  }
}
.sbox {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px 14px;
  background: color-mix(in srgb, var(--bg) 55%, var(--surface));
}
.sbox.full {
  grid-column: 1/-1;
}
.sbox h4 {
  margin: 0 0 8px;
  font-size: 13.5px;
  color: var(--ink);
  font-weight: 700;
}
.shead {
  display: grid;
  grid-template-columns: 130px 1fr 1fr;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  padding: 0 0 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 6px;
}
.sr {
  display: grid;
  grid-template-columns: 130px 1fr 1fr;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
}
.sr.two {
  grid-template-columns: 1fr 1fr;
  margin-bottom: 8px;
}
.sr.c,
.shead.c {
  grid-template-columns: minmax(130px, 1fr) minmax(140px, 1.2fr) minmax(
      160px,
      1.3fr
    ) minmax(120px, 0.9fr) 30px;
}
.sr.two {
  grid-template-columns: 1.4fr 1fr;
}
.sr.c .rm {
  width: 28px;
  height: 28px;
}
.sr.c .rm:hover {
  color: var(--alert);
  background: color-mix(in srgb, var(--alert) 12%, transparent);
}
.addc {
  margin-top: 6px;
  padding-left: 0;
  color: var(--scrum);
}
.sr label,
.pzc label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sl {
  font-size: 12.5px;
  color: var(--muted);
}
.sbox input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--surface);
  font-size: 14px;
  color: var(--ink);
  width: 100%;
  min-width: 0;
}
.sbox input:focus {
  border-color: var(--scrum);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
.pz {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 820px) {
  .pz {
    grid-template-columns: 1fr;
  }
}
.pzc {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--surface);
}
.pzt {
  grid-column: 1/-1;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
.pzr {
  grid-column: 1/-1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-top: 1px dashed var(--line);
  padding-top: 8px;
}
.pzr b {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}
.sbox .hint {
  margin-top: 10px;
}
.adh,
.adr {
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: 1.3fr 1fr 0.9fr 1.1fr 30px;
  gap: 6px;
  align-items: center;
}
.adh {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  border-bottom: 1px solid var(--line);
  padding-bottom: 4px;
}
.adlist {
  grid-column: 1/-1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.adlist:empty {
  display: none;
}
.adr select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 6px;
  background: var(--surface);
  font-size: 13.5px;
  color: var(--ink);
  min-width: 0;
}
.adq {
  display: flex;
  align-items: center;
  gap: 4px;
}
.adq input {
  min-width: 0;
}
.adu {
  font-size: 12px;
  color: var(--muted);
}
.pzc .addc {
  grid-column: 1/-1;
  justify-self: start;
}
.pzc.adbox {
  grid-column: 1/-1;
}
.adh,
.adr {
  grid-template-columns: 2fr 1.2fr 1fr 1.2fr 30px !important;
}
.adr .rm:hover {
  color: var(--alert);
  background: color-mix(in srgb, var(--alert) 12%, transparent);
}
.fgrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
}
.fgrid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.fwide {
  grid-column: 1/-1;
}
.fgrid input,
.fgrid select,
dialog textarea {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--bg);
  font-size: 14px;
  color: var(--ink);
  width: 100%;
}
dialog textarea {
  min-height: 170px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12.5px;
}
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.hint {
  font-size: 12.5px;
  color: var(--muted);
  margin: 0;
}
.ftab {
  width: 100%;
  font-size: 13px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--bg);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 50;
  max-width: 90vw;
}
@media (prefers-reduced-motion: no-preference) {
  .bar b {
    transition: width 0.4s ease;
  }
}

/* ===== Cronograma tabelado ===== */
.ie {
  width: 100%;
  min-width: 0;
  border: 1px solid transparent;
  background: transparent;
  font: inherit;
  color: inherit;
  padding: 2px 5px;
  margin: -3px -6px;
  border-radius: 4px;
  text-overflow: ellipsis;
}
.ie:hover {
  border-color: var(--t-grid, #ccc);
}
.ie:focus {
  border-color: var(--scrum);
  background: var(--t-row, #fff);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
tr.proj .ie:focus {
  background: color-mix(
    in srgb,
    var(--t-proj-ink, #fff) 10%,
    var(--t-proj, #234)
  );
}
.tline {
  display: flex;
  align-items: center;
  gap: 0;
}
.tline .mk {
  flex: none;
}
.ie-pred {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.durw {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}
.ie-dur {
  width: 46px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  margin: -3px 0;
}
td.dur {
  text-align: right;
  white-space: nowrap;
}
input.dt.locked {
  opacity: 0.7;
  cursor: not-allowed;
  background: transparent !important;
  border-style: dashed !important;
}
:host {
  --t-head: #1e2b3a;
  --t-head-ink: #e9eef3;
  --t-proj: #2f4a66;
  --t-proj-ink: #ffffff;
  --t-l1: #e6edf4;
  --t-l2: #f3f6f9;
  --t-row: #ffffff;
  --t-hover: #f7fafc;
  --t-grid: #dce3ea;
  --prog: #1f7a70;
  --prog-track: #dde8e6;
  --mk: #c08a2e;
  --late: #b3261e;
}
.tw {
  border: 1px solid var(--t-grid);
  border-radius: 8px;
  overflow: hidden;
  background: var(--t-row);
}
table.crono {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 13px;
  font-stretch: 96%;
}
table.crono th {
  background: var(--t-head);
  color: var(--t-head-ink);
  font-weight: 600;
  font-size: 12px;
  text-align: left;
  padding: 9px 10px;
  border-right: 1px solid color-mix(in srgb, var(--t-head-ink) 14%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: sticky;
  top: 0;
  z-index: 2;
}
table.crono th:last-child,
table.crono td:last-child {
  border-right: 0;
}
table.crono td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--t-grid);
  border-right: 1px solid var(--t-grid);
  vertical-align: middle;
  background: var(--t-row);
  overflow-wrap: break-word;
}
table.crono tbody tr:last-child td {
  border-bottom: 0;
}
table.crono tr.child:hover td {
  background: var(--t-hover);
}
table.crono td.code {
  white-space: nowrap;
  padding-left: 8px;
  padding-right: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  display: table-cell;
}
table.crono td.code > span:last-child {
  vertical-align: middle;
}
.tgsp {
  display: inline-block;
  width: 16px;
  margin: 0 4px 0 -4px;
}
table.crono .tg {
  margin: 0 4px 0 -4px;
}
table.crono td.ttl {
  line-height: 1.3;
}
table.crono .sub {
  display: block;
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 400;
  margin-top: 2px;
}
table.crono .sub em {
  color: var(--late);
  font-style: normal;
  font-weight: 600;
}
table.crono .mut {
  color: var(--muted);
  font-weight: 400;
}
table.crono td.dts {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
}
table.crono td.dts .sub {
  white-space: nowrap;
}
table.crono td.pred {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
table.crono td.c-act {
  text-align: center;
  padding: 4px;
}
/* níveis */
table.crono tr.proj td {
  background: var(--t-proj);
  color: var(--t-proj-ink);
  font-weight: 700;
  border-bottom-color: var(--t-proj);
  border-right-color: color-mix(in srgb, var(--t-proj-ink) 16%, transparent);
}
table.crono tr.proj .sub,
table.crono tr.proj .mut,
table.crono tr.proj td.pred {
  color: color-mix(in srgb, var(--t-proj-ink) 72%, var(--t-proj));
}
table.crono tr.proj .sub em {
  color: #ffc2ba;
}
table.crono tr.proj .pbar {
  background: color-mix(in srgb, var(--t-proj-ink) 22%, var(--t-proj));
}
table.crono tr.proj .pbar b {
  background: var(--t-proj-ink);
}
table.crono tr.proj .stt {
  color: var(--t-proj-ink);
  background: color-mix(in srgb, var(--t-proj-ink) 14%, var(--t-proj));
}
table.crono tr.parent td {
  background: var(--t-l1);
  font-weight: 700;
}
table.crono tr.pt td {
  background: var(--t-l2);
  font-weight: 600;
}
table.crono tr.pt td.ttl,
table.crono tr.child.l1 td.ttl {
  padding-left: 24px;
}
table.crono tr.child.l2 td.ttl {
  padding-left: 40px;
}
table.crono tr.child td.code .tgsp {
  width: 6px;
}
table.crono tr.child.l1 td.code,
table.crono tr.child.l2 td.code,
table.crono tr.pt td.code {
  padding-left: 8px;
}
table.crono tr.child td.code {
  color: var(--muted);
  font-weight: 500;
}
table.crono tr.late td:first-child {
  box-shadow: inset 3px 0 0 var(--late);
}
table.crono .mk {
  display: inline-block;
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  background: var(--mk);
  margin: 0 7px 1px 1px;
  vertical-align: middle;
}
/* status e progresso */
.stt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 8px 2px 7px;
  border-radius: 10px;
  white-space: nowrap;
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.stt i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.stt.s-n {
  color: var(--muted);
}
.stt.s-a {
  color: var(--scrum);
}
.stt.s-c {
  color: var(--ok);
}
.pcell {
  display: flex;
  align-items: center;
  gap: 7px;
}
.pbar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--prog-track);
  overflow: hidden;
  min-width: 24px;
}
.pbar b {
  display: block;
  height: 100%;
  background: var(--prog);
  border-radius: 3px;
}
.pv {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: right;
}
/* campos */
table.crono td.real {
  white-space: nowrap;
  padding: 5px 8px;
}
table.crono input.dt {
  width: calc(50% - 3px);
  font-size: 12px;
  padding: 3px 4px;
  border: 1px solid var(--t-grid);
  border-radius: 4px;
  background: var(--t-row);
  color: var(--ink);
}
table.crono input.dt:hover,
table.crono textarea.obs:hover {
  border-color: var(--line-strong);
}
table.crono input.dt:focus,
table.crono textarea.obs:focus {
  border-color: var(--scrum);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
table.crono td.obsc {
  padding: 5px 8px;
}
table.crono textarea.obs {
  width: 100%;
  min-height: 28px;
  resize: vertical;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 6px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  display: block;
  color: var(--ink);
}
table.crono textarea.obs {
  border-color: var(--t-grid);
  background: var(--t-row);
}
table.crono tr.proj textarea.obs {
  background: color-mix(in srgb, var(--t-proj-ink) 8%, var(--t-proj));
  border-color: color-mix(in srgb, var(--t-proj-ink) 25%, transparent);
  color: var(--t-proj-ink);
}
table.crono tr.parent textarea.obs,
table.crono tr.pt textarea.obs {
  font-weight: 400;
}
.ico {
  border: 0;
  background: none;
  color: var(--muted);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ico:hover {
  background: color-mix(in srgb, var(--scrum) 12%, transparent);
  color: var(--scrum);
}
table.crono tr.proj .ico,
table.crono tr.proj .tg {
  color: var(--t-proj-ink);
}
@container view (max-width:1000px) {
  table.crono,
  table.crono tbody {
    display: block;
  }
  table.crono thead,
  table.crono colgroup {
    display: none;
  }
  table.crono tr {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 14px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--t-grid);
    background: var(--t-row);
  }
  table.crono tr.proj {
    background: var(--t-proj);
    color: var(--t-proj-ink);
  }
  table.crono tr.parent {
    background: var(--t-l1);
  }
  table.crono tr.pt {
    background: var(--t-l2);
  }
  table.crono td {
    border: 0 !important;
    padding: 0 !important;
    background: none !important;
    box-shadow: none !important;
  }
  table.crono td.code {
    grid-column: 1/2;
    grid-row: 1;
  }
  table.crono td.rkc {
    grid-column: 4/5;
    grid-row: 1;
    justify-self: end;
  }
  table.crono td.rkc:empty {
    display: none;
  }
  table.crono td.ttl {
    grid-column: 2/4;
    grid-row: 1;
  }
  table.crono td.real,
  table.crono td.obsc {
    grid-column: 1/-1;
  }
  table.crono td.obsc:empty,
  table.crono td.c-act:empty {
    display: none;
  }
  table.crono td[data-l]::before {
    content: attr(data-l);
    display: block;
    font-size: 11px;
    color: var(--muted);
    font-weight: 500;
  }
  table.crono tr.proj td[data-l]::before {
    color: inherit;
    opacity: 0.7;
  }
  table.crono tr.late {
    box-shadow: inset 3px 0 0 var(--late);
  }
  table.crono tr.child.l1 {
    padding-left: 24px;
  }
  table.crono tr.child.l2,
  table.crono tr.pt {
    padding-left: 32px;
  }
}
@container view (max-width:480px) {
  table.crono tr {
    grid-template-columns: 1fr 1fr;
  }
  table.crono td.rkc {
    grid-column: 2/3;
  }
  table.crono td.ttl {
    grid-column: 1/-1;
    grid-row: 2;
  }
}

/* ---------- Painel PMO: calendário e stakeholders ---------- */
.pmbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-bottom: 12px;
}
.pmnav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.pmnav h2 {
  margin: 0 0 0 8px;
  font-size: 19px;
  font-weight: 720;
  font-stretch: 90%;
}
.btn.ico2 {
  font-size: 20px;
  line-height: 1;
  padding: 2px 10px;
  color: var(--ink);
}
.seg {
  display: inline-flex;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  overflow: hidden;
}
.seg button {
  border: 0;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 6px 14px;
  cursor: pointer;
}
.seg button + button {
  border-left: 1px solid var(--line);
}
.seg button.on {
  background: var(--ink);
  color: var(--bg);
}
.pmfil {
  justify-content: flex-start;
  align-items: flex-end;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.pmf {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.pmf select {
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 5px 8px;
  max-width: 260px;
}
.pmchk {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  padding-bottom: 6px;
}
.cal {
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  overflow-x: auto;
}
.cwh,
.cw {
  display: grid;
  grid-template-columns: repeat(7, minmax(92px, 1fr));
  min-width: 660px;
}
.cwh span {
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--bg);
  border-bottom: 1px solid var(--line);
}
.cw {
  row-gap: 3px;
  min-height: 96px;
  border-bottom: 1px solid var(--line);
}
.cw:last-child {
  border-bottom: 0;
}
.cal.sem .cw {
  min-height: 420px;
  align-content: start;
}
.cd {
  border-left: 1px solid var(--line);
  min-width: 0;
}
.cd:first-child {
  border-left: 0;
}
.cd.fds {
  background: color-mix(in srgb, var(--bg) 55%, transparent);
}
.cd.out {
  background: color-mix(in srgb, var(--bg) 85%, transparent);
}
.cd.out .cdn {
  color: var(--line-strong);
}
.cdn {
  border: 0;
  background: none;
  font: inherit;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--muted);
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 12px;
}
.cdn:hover {
  color: var(--ink);
}
.cd.hoje .cdn {
  background: var(--scrum);
  color: #fff;
  margin: 2px 4px;
  padding: 2px 8px;
}
.ev {
  z-index: 1;
  min-width: 0;
  margin: 0 3px;
  border: 0;
  border-left: 3px solid var(--c);
  border-radius: 4px;
  background: color-mix(in srgb, var(--c) 18%, var(--surface));
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  height: 22px;
  padding: 0 6px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.ev b {
  font-weight: 700;
  color: var(--c);
}
.ev small {
  color: var(--muted);
}
.ev:hover {
  background: color-mix(in srgb, var(--c) 30%, var(--surface));
}
.ev.cl {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: 0;
}
.ev.cr {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin-right: 0;
}
.ev.late {
  box-shadow: inset 0 0 0 1.5px var(--alert);
}
.ev.done {
  opacity: 0.55;
  text-decoration: line-through;
  text-decoration-color: var(--muted);
}
.evmais {
  z-index: 1;
  border: 0;
  background: none;
  font: inherit;
  font-size: 11.5px;
  font-weight: 650;
  color: var(--scrum);
  text-align: left;
  padding: 0 8px;
  cursor: pointer;
}
.evmais:hover {
  text-decoration: underline;
}
.pmleg,
.stkp {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}
.stkp {
  margin-top: 0;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 14px;
  padding: 3px 10px 3px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.lg i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  flex: none;
}
.lg.on {
  border-color: var(--c);
  background: color-mix(in srgb, var(--c) 14%, var(--surface));
}
.lg.conc {
  opacity: 0.55;
}
.agenda ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.agd {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.agdh {
  display: flex;
  flex-direction: column;
}
.agdh b {
  font-size: 24px;
  font-weight: 720;
  line-height: 1;
}
.agdh span {
  font-size: 12px;
  color: var(--muted);
}
.agi {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 6px;
  padding: 6px 10px;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.agi:hover {
  border-color: var(--c);
}
.agi i {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  background: var(--c);
  flex: none;
}
.agt {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.agt b {
  font-size: 13.5px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.agt small,
.agp {
  font-size: 12px;
  color: var(--muted);
}
.agp {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.agi.late {
  border-color: var(--alert);
}
.agi.done {
  opacity: 0.55;
}
#dlgPmo .agenda ul {
  max-height: 55vh;
  overflow: auto;
}
.pmlist {
  margin: 8px 0 12px;
  padding-left: 0;
  list-style: none;
  max-height: 40vh;
  overflow: auto;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pmlist small {
  color: var(--muted);
}
.stkbar {
  display: inline-block;
  width: calc(100% - 34px);
  height: 8px;
  background: var(--bg);
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}
.stkbar i {
  display: block;
  height: 100%;
  background: var(--scrum);
}
.stkn {
  margin-left: 8px;
  font-variant-numeric: tabular-nums;
}
@container view (max-width: 700px) {
  .agd {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .agdh {
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
  }
  .agp {
    display: none;
  }
}

/* Estado da base compartilhada (js/localdb.js) */
#syncbadge {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
}
#syncbadge i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
}
#syncbadge.err {
  color: var(--alert);
  border-color: var(--alert);
}
#syncbadge.err i {
  background: var(--alert);
}

/* Assistente IA (Painel PMO) */
.iasug {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.iasug .lg {
  border-radius: 8px;
  text-align: left;
}
.iaconv {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 62vh;
  overflow: auto;
  margin-bottom: 12px;
}
.iaconv:empty {
  display: none;
}
.iamsg {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
}
.iamsg.iau {
  background: var(--scrum-soft);
  border-color: transparent;
  align-self: flex-end;
  max-width: 80%;
}
.iamsg.iau b {
  font-size: 12px;
  color: var(--muted);
}
.iamsg.iau p {
  margin: 2px 0 0;
  white-space: pre-wrap;
}
.iamsg.err {
  border-color: var(--alert);
  color: var(--alert);
}
.iamd h2,
.iamd h3,
.iamd h4 {
  margin: 14px 0 6px;
  font-size: 15.5px;
  font-weight: 720;
}
.iamd h2:first-child,
.iamd h3:first-child {
  margin-top: 2px;
}
.iamd p {
  margin: 6px 0;
}
.iamd ul,
.iamd ol {
  margin: 6px 0;
  padding-left: 22px;
}
.iamd .tw {
  margin: 8px 0;
  overflow-x: auto;
}
.iamd code {
  background: var(--bg);
  padding: 0 4px;
  border-radius: 4px;
}
.iain textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  resize: vertical;
}
.iaacts {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.iaacts .mut {
  margin-right: auto;
  font-size: 12px;
}

/* Carteira: sinaleiro de status, motivo do atraso administrativo e várias ações */
td.sinalcell {
  text-align: center;
}
.sinal {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--base);
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 0%, transparent);
  vertical-align: middle;
}
.sinal.r {
  background: #e5736b;
}
.sinal.a {
  background: #e0a458;
}
.sinal.c {
  background: #4fc48a;
}
.sinal.adm {
  background: #8e9cf0;
}
.sinal.n {
  background: var(--base);
}
.admmot {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #8e9cf0;
}
textarea.srin {
  resize: none;
  overflow: hidden;
  min-height: 32px;
}
.aclist {
  display: flex;
  flex-direction: column;
}
.aclist .acrow {
  grid-template-columns: 22px minmax(0, 1fr) 130px 22px;
  align-items: center;
}
.acdel {
  width: 22px;
  height: 22px;
  opacity: 0.45;
}
.acrow:hover .acdel,
.acdel:focus {
  opacity: 1;
}
.acadd {
  align-self: flex-start;
  margin-top: 4px;
  border: 0;
  background: none;
  color: var(--scrum);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  padding: 2px 2px;
  cursor: pointer;
}
.acadd:hover {
  text-decoration: underline;
}

/* Observações do cronograma: altura acompanha o texto (js: ajustarTextos) */
textarea.obs,
table.crono textarea.obs {
  resize: none;
  overflow: hidden;
}

/* Barras de rolagem: finas e nas cores do tema, em todos os painéis (sidebar, tabelas, calendário…) */
:host {
  --scroll-thumb: color-mix(in srgb, var(--muted) 45%, transparent);
  --scroll-thumb-hover: color-mix(in srgb, var(--muted) 75%, transparent);
}
/* Firefox: propriedades padrão (cor herdada por todos os elementos com rolagem) */
@supports (-moz-appearance: none) {
  :host {
    scrollbar-color: var(--scroll-thumb) transparent;
  }
  * {
    scrollbar-width: thin;
  }
}
/* Edge, Chrome e Safari: barra fina, arredondada e sem as setas das pontas */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track,
::-webkit-scrollbar-corner {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scroll-thumb-hover);
  background-clip: padding-box;
}
::-webkit-scrollbar-button {
  display: none;
}

/* Calendário: atividades separadas por dia (cada dia lista as suas) */
.cw {
  row-gap: 0;
  min-height: 110px;
}
.cd {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 0 6px;
  min-width: 0;
}
.cdl {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0 4px;
  min-width: 0;
}
.cdl .ev {
  margin: 0;
  width: 100%;
}
.ev.cont {
  border-left-style: dashed; /* continuação de uma atividade que começou em dia anterior */
}
.cd .evmais {
  align-self: flex-start;
  padding: 0 8px;
}
.cal.sem .cw {
  min-height: 420px;
}

/* Calendário por projeto: o dia é clicável e a janela agrupa as atividades por projeto */
.cal .cd[data-pmdia] {
  cursor: pointer;
}
.cal .cd[data-pmdia]:hover {
  background: color-mix(in srgb, var(--scrum) 7%, transparent);
}
.cdl .ev small {
  float: right;
  font-weight: 700;
  color: var(--ink);
  opacity: 0.75;
}
.diag + .diag {
  margin-top: 14px;
}
.diagh {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 6px;
}
.diagh i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
  flex: none;
}
.diagh b {
  font-size: 13.5px;
}
.diagh span {
  font-size: 12px;
  color: var(--muted);
}
.diagh .btn {
  margin-left: auto;
}
#dlgPmo .agenda {
  max-height: 62vh;
  overflow: auto;
}
#dlgPmo .agenda ul {
  max-height: none;
}
/* item de projeto no dia: nome encurta, a quantidade fica sempre visível */
.cdl .ev {
  display: flex;
  align-items: center;
  gap: 6px;
}
.cdl .ev b {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cdl .ev small {
  float: none;
  flex: none;
}

/* Calendário: número do dia sem esticar (hoje = pílula) e visão Semana com as atividades */
.cd .cdn {
  align-self: center;
  margin: 4px auto 2px;
  padding: 2px 10px;
}
.cd.hoje .cdn {
  margin: 4px auto 2px;
}
.cdnu {
  align-self: center;
  font-size: 11.5px;
  color: var(--muted);
  font-style: italic;
  margin-top: 6px;
}
.cal.sem .cwh,
.cal.sem .cw {
  grid-template-columns: repeat(7, minmax(140px, 1fr));
  min-width: 980px;
}
.cal.sem .cdl {
  gap: 10px;
  padding: 2px 6px;
}
.cdp ul {
  list-style: none;
  margin: 4px 0 0;
  padding: 0 0 0 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cda {
  width: 100%;
  text-align: left;
  border: 0;
  border-left: 2px solid var(--c);
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.3;
  padding: 2px 6px;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}
.cda:hover {
  background: color-mix(in srgb, var(--c) 14%, transparent);
}
.cda small {
  color: var(--muted);
}
.cda.late {
  color: var(--alert);
}
.cda.done {
  opacity: 0.55;
  text-decoration: line-through;
}

/* Calendário: itens no mesmo estilo da legenda (fundo neutro, texto claro, bolinha na cor do projeto) */
.cal .ev {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-left: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.cal .ev::before {
  content: "";
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  flex: none;
}
.cal .ev:hover {
  background: var(--surface);
  border-color: var(--c);
}
.cal .ev b {
  color: var(--ink);
  font-weight: 600;
}
.cal .ev small {
  color: var(--muted);
  opacity: 1;
  font-weight: 600;
}
.cal .ev.late {
  box-shadow: none;
}
/* atraso: só a quantidade em destaque */
.cal .ev.late small {
  background: var(--alert-soft);
  color: var(--alert);
  border-radius: 8px;
  padding: 0 6px;
}
.cal .ev.done {
  text-decoration: none;
  opacity: 0.6;
}
.cal .ev.cont {
  border-left-style: solid;
}
/* atividades da visão Semana: texto claro, linha fina na cor do projeto, atraso com um ponto vermelho */
.cda {
  color: var(--ink);
  border-left: 2px solid color-mix(in srgb, var(--c) 70%, transparent);
}
.cda:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.cda.late {
  color: var(--ink);
}
.cda.late::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--alert);
  margin-right: 6px;
  vertical-align: middle;
}
.cdp ul {
  padding-left: 10px;
}

/* Formulário G3: etapa/pacote em listas suspensas, nº da EAP automático */
.fgrid label[hidden] {
  display: none;
}
.eapauto {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  opacity: 0.85;
}

/* Painel PMO › Equipe do setor (subsetores) */
.eqg {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.eqc {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  min-width: 0;
}
.eqc h3 {
  margin: 0;
  font-size: 15px;
}
.eqc > .mut {
  margin: 2px 0 10px;
  font-size: 12.5px;
}
.eqk {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12.5px;
  color: var(--muted);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.eqk b {
  color: var(--text, inherit);
}
.eqk .bad b {
  color: var(--alert);
}
.eqc ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.eqc li {
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
}
.eqc li:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}
.eqn {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.eqn span {
  font-size: 12px;
  color: var(--muted);
}
.eqn .btn {
  margin-left: auto;
  padding: 3px 8px;
  font-size: 12px;
}

/* blocos de pontos (ex.: cercamento eletrônico x videomonitoramento) */
tr.pt.blk td {
  background: color-mix(in srgb, var(--wf-soft) 70%, var(--surface));
  font-weight: 700;
}
tr.pt.l2 td.code,
tr.pt.l2 td:nth-child(2) {
  padding-left: 36px;
}
tr.child.l3 td.code,
tr.child.l3 td:nth-child(2) {
  padding-left: 50px;
}

/* Roteirização: mapa OpenStreetMap */
.rtmap {
  height: 420px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 12px 0 6px;
  z-index: 0;
}
.rtvia {
  font-size: 12.5px;
  color: var(--muted);
  margin: 0 0 10px;
}
.rtpin {
  background: none;
  border: 0;
}
.rtpin span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 11px;
  background: #2f6fe4;
  color: #fff;
  font: 700 11px/1 system-ui, sans-serif;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  transform: translate(-50%, -50%);
}
.rtpin.o span {
  background: #1f2937;
}

/* Painel PMO › Gerenciar equipe */
.panel-h .btn[data-eqedit] {
  margin-left: 10px;
}
#eqLista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow: auto;
  margin: 10px 0;
}
.eqrow {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px;
}
.eqrh {
  display: grid;
  grid-template-columns: 1fr 150px 28px;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.eqrh input,
.eqrh select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--bg);
  color: var(--text, inherit);
  font: inherit;
  min-width: 0;
}
.eqobras {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}
.eqob {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.eqob:has(input:checked) {
  border-color: var(--scrum, #5b8def);
  background: color-mix(in srgb, var(--scrum, #5b8def) 16%, transparent);
}
.eqob input {
  margin: 0;
}

/* menu lateral: pasta de projetos encerrados */
.encf {
  margin-top: 14px;
}
.encf > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.encf > summary::-webkit-details-marker {
  display: none;
}
.encf > summary::before {
  content: "▸";
  font-size: 10px;
  transition: transform 0.15s ease;
}
.encf[open] > summary::before {
  transform: rotate(90deg);
}
.encn {
  font-weight: 600;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
  border-radius: 9px;
  padding: 0 6px;
  font-size: 10.5px;
}
.encf .pitem {
  opacity: 0.8;
}
.encchk {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 12px;
  font-size: 13px;
}
/* conectado: sem aviso flutuante; o estado aparece no topo do Painel da carteira */
#syncbadge.ok {
  display: none;
}
.livetag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--muted);
  vertical-align: middle;
}
.livetag i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ok);
}
.livetag.err {
  color: var(--alert);
  border-color: var(--alert);
}
.livetag.err i {
  background: var(--alert);
}

/* cabeçalhos longos da tabela da carteira quebram em duas linhas */
th.thw {
  white-space: normal;
  text-overflow: clip;
  line-height: 1.2;
}

/* listas suspensas das janelas: mesmo visual dos campos, com seta própria */
.sbox select,
dialog select {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 32px 7px 9px;
  background-color: var(--surface);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%238b95a7' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  font: inherit;
  font-size: 14px;
  color: var(--ink);
  width: 100%;
  min-width: 0;
  cursor: pointer;
}
.sbox select:focus,
dialog select:focus {
  border-color: var(--scrum);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
dialog select option {
  background: var(--surface);
  color: var(--ink);
}

/* janela Valores do contrato: um bloco só, em largura menor */
.pz.one {
  grid-template-columns: 1fr;
}
#dlgStk:has(.pz.one) {
  width: min(560px, calc(100vw - 24px));
}

/* cronograma: alça para arrastar atividades e destino do arrasto */
.grip {
  display: inline-flex;
  width: 16px;
  margin: 0 4px 0 -4px;
  justify-content: center;
  cursor: grab;
  color: var(--muted);
  opacity: 0.35;
  letter-spacing: -2px;
  user-select: none;
}
tr:hover .grip {
  opacity: 0.9;
}
.grip:active {
  cursor: grabbing;
}
table.crono tr.arrastando td {
  opacity: 0.45;
}
table.crono tr.dropok td {
  box-shadow: inset 0 2px 0 var(--scrum), inset 0 -2px 0 var(--scrum);
  background: color-mix(in srgb, var(--scrum) 14%, var(--surface));
}
td.c-act .nv {
  margin-left: 2px;
}
/* arrastar sobre outra atividade: linha azul onde ela vai entrar */
table.crono tr.dropantes td {
  box-shadow: inset 0 3px 0 var(--scrum);
}
table.crono tr.dropdepois td {
  box-shadow: inset 0 -3px 0 var(--scrum);
}
/* a linha da atividade pode ser arrastada pelo número, risco, status e % */
table.crono td[data-dragcel] {
  cursor: grab;
}
table.crono td[data-dragcel]:active {
  cursor: grabbing;
}
.grip {
  opacity: 0.6;
}

/* Painel PMO: listas com várias escolhas */
.msel {
  position: relative;
}
.msel > summary {
  list-style: none;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink);
  background: var(--surface)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%238b95a7' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 8px center;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 5px 28px 5px 8px;
  min-width: 180px;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.msel > summary::-webkit-details-marker {
  display: none;
}
.msel[open] > summary {
  border-color: var(--scrum);
}
.mlist {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  left: 0;
  min-width: 100%;
  width: max-content;
  max-width: 360px;
  max-height: 340px;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.25);
  padding: 6px;
}
.mlist label {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink);
  cursor: pointer;
}
.mlist label:hover {
  background: color-mix(in srgb, var(--scrum) 12%, transparent);
}
.mlist input {
  margin: 0;
}
.mclr {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  background: none;
  color: var(--scrum);
  font: inherit;
  font-size: 12.5px;
  padding: 4px 6px 8px;
  cursor: pointer;
}
.pmesc button {
  font-size: 12.5px;
  padding: 4px 10px;
}


/* Painel PMO › Equipes de campo */
.eqcal {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
}
.eqcal th,
.eqcal td {
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 6px;
  vertical-align: top;
}
.eqcal thead th {
  font-weight: 650;
  color: var(--muted);
  text-align: left;
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 1;
}
.eqcal th.eqtn {
  width: 170px;
  text-align: left;
}
.eqcal th.eqtn b {
  display: block;
  color: var(--ink);
  font-size: 13px;
}
.eqcal th.eqtn small {
  display: block;
  color: var(--muted);
  font-weight: 500;
}
.eqcal .eqatr {
  width: 150px;
  background: color-mix(in srgb, var(--alert) 6%, transparent);
}
.eqcal td.hoje,
.eqcal th.hoje {
  background: color-mix(in srgb, var(--scrum) 10%, transparent);
}
.eqcal td.fer,
.eqcal th.fer {
  background: color-mix(in srgb, var(--muted) 10%, transparent);
}
.eqcal tr.semeq th,
.eqcal tr.semeq td {
  border-top: 2px solid var(--line-strong);
}
.eqcal .ev {
  display: flex;
  gap: 4px;
  align-items: baseline;
  width: 100%;
  margin: 0 0 4px;
  padding: 3px 6px 3px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  text-align: left;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.eqcal .ev::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 50%;
  width: 5px;
  height: 5px;
  margin-top: -2.5px;
  border-radius: 50%;
  background: var(--c);
}
.eqcal .ev span {
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.eqcal .ev b {
  white-space: nowrap;
}
.eqcal .ev small {
  color: var(--muted);
}
.eqcal .ev.late {
  border-color: var(--alert);
}
.eqcal .ev.done {
  opacity: 0.55;
}
.eqtodas {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
}
.eqtodas select,
.eqitens select {
  width: auto;
  min-width: 200px;
}
.eqitens {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 55vh;
  overflow: auto;
}
.eqitens li {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--line);
}
.eqitens .agt small {
  display: block;
  color: var(--muted);
}
.eqtag {
  color: var(--scrum);
  font-weight: 600;
}
.eqch {
  margin: 18px 0 4px;
}
#eqcLista {
  display: grid;
  gap: 6px;
  margin-bottom: 6px;
}
.eqcrow {
  display: grid;
  grid-template-columns: 1fr 28px;
  gap: 8px;
  align-items: center;
}
.eqcrow input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
}
.eqcal td.eqatr {
  max-height: 260px;
}
.eqcal td.eqatr .ev span {
  display: none;
}
/* objeto do contrato (painel Valores do contrato) */
.role.objrow .n.obj {
  font-weight: 500;
  font-size: 13px;
  line-height: 1.4;
}
textarea.objta {
  min-height: 70px;
  font-family: inherit;
  font-size: 13.5px;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--surface);
  color: var(--ink);
  resize: vertical;
}

/* Equipes de campo: programação (técnico, projeto, pontos e data) */
.eqcal td[data-agnovo] {
  cursor: pointer;
}
.eqcal td[data-agnovo]:hover {
  background: color-mix(in srgb, var(--scrum) 8%, transparent);
}
.eqcal td.choque {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--alert) 60%, transparent);
}
.aglist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.agptsw {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.agptsh {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.agptsh .sl {
  margin-right: auto;
  font-size: 12.5px;
  color: var(--muted);
}
.agptsh input,
.agptsh select {
  width: auto;
  min-width: 200px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 9px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
.agpts {
  max-height: 46vh;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.agpt {
  display: grid;
  grid-template-columns: minmax(170px, 230px) 1fr;
  gap: 10px;
  align-items: start;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
}
.agpt:last-child {
  border-bottom: 0;
}
.agpth b {
  display: block;
  font-size: 13px;
  color: var(--ink);
}
.agpth small {
  display: block;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.3;
}
.agpth em {
  font-style: normal;
  font-size: 11px;
  color: var(--ok);
}
.agpt.feito {
  opacity: 0.6;
}
.agpta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.agat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
  background: var(--surface);
}
.agat input {
  margin: 0;
}
.agat:has(input:checked) {
  border-color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
}
.agat.ok {
  color: var(--muted);
  text-decoration: line-through;
}
.agobs {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  font-size: 12.5px;
  color: var(--muted);
}
.agobs input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
}

/* programação: nome do projeto e pontos quebram linha dentro do dia */
.eqcal .ev {
  flex-wrap: wrap;
}
.eqcal .ev b,
.eqcal .ev span {
  white-space: normal;
  overflow: visible;
  flex-basis: 100%;
}
/* programação: só o que está pendente, a menos que "Mostrar concluídas" esteja marcado */
.agpt[hidden] {
  display: none;
}
.agpts:not(.vertudo) .agpt.feito,
.agpts:not(.vertudo) .agat.ok {
  display: none;
}
.agpth em.agpend {
  color: var(--alert);
}
.agvt {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
  color: var(--muted);
}
.agvt input {
  min-width: 0 !important;
}

/* exportação da agenda: prévia do texto */
textarea.agtxt {
  width: 100%;
  margin-top: 10px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
  min-height: 180px;
}
/* roteirização no Painel PMO: ponto já concluído aparece esmaecido */
.rti.feito {
  opacity: 0.6;
}

/* janela de programação: cabe na tela sem barra externa; só a lista de pontos rola */
#dlgPmo:has(.agptsw) {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
#dlgPmo:has(.agptsw) > form {
  min-height: 0;
  max-height: calc(100vh - 40px);
  overflow: auto; /* só em telas muito baixas, quando nem a lista mínima cabe */
  gap: 10px;
}
#dlgPmo:has(.agptsw) .agptsw {
  flex: 1 1 auto;
  min-height: 230px;
  display: flex;
  flex-direction: column;
}
#dlgPmo:has(.agptsw) .agpts {
  flex: 1 1 auto;
  min-height: 140px;
  max-height: none;
}
#dlgPmo:has(.agptsw) .agobs,
#dlgPmo:has(.agptsw) .agptsw {
  margin-top: 0;
}
#dlgPmo:has(.agptsw) .hint {
  margin: 0;
}

/* programação com vários projetos */
.agpsel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.agpsel .msel > summary {
  max-width: none;
}
.agpsel .mlist {
  z-index: 40;
}
.agproj {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--c) 14%, var(--surface));
  border-bottom: 1px solid var(--line);
  font-weight: 650;
  font-size: 13px;
}
.agproj i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
}
.agproj small {
  margin-left: auto;
  font-weight: 500;
  color: var(--muted);
}
/* lista de projetos da programação: caixa e nome na mesma linha (o .fgrid empilhava) */
.fgrid .agpsel .mlist label {
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 5px 6px;
  font-size: 13px;
  color: var(--ink);
  text-align: left;
}
.fgrid .agpsel .mlist input {
  width: auto;
  flex: none;
  margin: 0;
}
.fgrid .agpsel .mlist {
  width: 100%;
  max-width: none;
  max-height: 300px;
}

/* programação: ponto recolhido (seta) e, ao abrir, atividades uma abaixo da outra */
details.agpt {
  display: block;
  padding: 0;
}
details.agpt > summary.agpth {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
}
details.agpt > summary.agpth::-webkit-details-marker {
  display: none;
}
details.agpt > summary.agpth:hover {
  background: color-mix(in srgb, var(--scrum) 7%, transparent);
}
.agseta {
  width: 0;
  height: 0;
  border-left: 6px solid var(--muted);
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  transition: transform 0.15s ease;
  flex: none;
}
details.agpt[open] .agseta {
  transform: rotate(90deg);
}
.agptn {
  flex: 1;
  min-width: 0;
}
.agptn b {
  display: inline;
  margin-right: 8px;
}
.agptn small {
  display: inline;
  color: var(--muted);
  font-size: 11.5px;
}
.agpth em {
  font-style: normal;
  font-size: 11.5px;
  white-space: nowrap;
}
.agpth em.agsel {
  color: var(--scrum);
  font-weight: 650;
}
details.agpt .agpta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px 8px 34px;
}
details.agpt .agat {
  display: flex;
  border: 0;
  border-radius: 6px;
  padding: 5px 8px;
  background: none;
  font-size: 13px;
}
details.agpt .agat:hover {
  background: color-mix(in srgb, var(--scrum) 8%, transparent);
}
details.agpt .agat:has(input:checked) {
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
}

/* semana: os dias ocupam toda a altura do calendário (linhas divisórias até o fim) */
.cal.sem .cw {
  align-content: stretch;
  align-items: stretch;
  grid-auto-rows: minmax(420px, auto);
}

/* Criar revisão: vários impactos (etapa, grupo, atividade e dias) */
#revImps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 46vh;
  overflow: auto;
}
.revimp {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
  align-items: end;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  position: relative;
}
.revimp label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--muted);
  min-width: 0;
}
.revimp .riAtv {
  grid-column: 1 / -1;
}
.revimp .riD input {
  width: 100%;
}
.revimp input,
.revimp select {
  min-width: 0;
}
.revimp [data-rirm] {
  position: absolute;
  top: 4px;
  right: 4px;
}
.revimp input.riDias,
.revimp input.riData {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}
/* "Alterar" e a data na mesma linha, com a mesma altura; a data atual fica embaixo */
.revimp {
  align-items: start;
}
.revimp select,
.revimp input.riData {
  height: 38px;
  box-sizing: border-box;
}

/* ação realizada */
.acok {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--t-grid);
  background: var(--t-row);
  color: transparent;
  display: grid;
  place-items: center;
  padding: 0;
  cursor: pointer;
}
.acok:hover { border-color: var(--ok, #2f8a4f); color: color-mix(in srgb, var(--ok, #2f8a4f) 55%, transparent); }
.acok.on { background: var(--ok, #2f8a4f); border-color: var(--ok, #2f8a4f); color: #fff; }
.acrow.feita input { text-decoration: line-through; color: var(--muted, #888); opacity: 0.75; }
.acrow.feita input.late { border-color: var(--t-grid); }

/* diferença da revisão x R00: no rodapé da célula, sem deslocar as datas (alinhadas com o realizado) */
table.crono td:has(> .revdif) { position: relative; }
table.crono td > .revdif { position: absolute; left: 10px; bottom: 2px; font-size: 10.5px; line-height: 1; white-space: nowrap; }
/* linha com diferença x R00: mais alta, com o mesmo espaço em todas as colunas para manter o alinhamento */
table.crono tr:has(.revdif) > td { padding-top: 10px; padding-bottom: 20px; }
table.crono td > .revdif { bottom: 5px; }

/* filtro de situação na implantação dos pontos */
.implacts .isit {
  border: 1px solid var(--t-grid);
  border-radius: 8px;
  background: var(--t-row);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  padding: 7px 10px;
  min-width: 170px;
}

/* "+" para inserir atividade abaixo: aparece ao passar o mouse na linha */
table.crono .addb { opacity: 0; color: var(--scrum); transition: opacity 0.12s; }
table.crono tr:hover .addb, table.crono .addb:focus-visible { opacity: 1; }
@media (hover: none) { table.crono .addb { opacity: 0.7; } }

/* 5 níveis: subgrupos e atividades mais fundas recuam um pouco mais a cada nível */
tr.pt.l3 td.code,
tr.pt.l3 td:nth-child(2) { padding-left: 50px; }
tr.pt.l4 td.code,
tr.pt.l4 td:nth-child(2) { padding-left: 64px; }
tr.child.l4 td.code,
tr.child.l4 td:nth-child(2) { padding-left: 64px; }
tr.child.l5 td.code,
tr.child.l5 td:nth-child(2) { padding-left: 78px; }
table.crono tr.pt.l2 td.ttl { padding-left: 34px; }
table.crono tr.pt.l3 td.ttl,
table.crono tr.child.l3 td.ttl { padding-left: 48px; }
table.crono tr.pt.l4 td.ttl,
table.crono tr.child.l4 td.ttl { padding-left: 60px; }
table.crono tr.child.l5 td.ttl { padding-left: 72px; }
tr.pt.blk.l2 td { background: color-mix(in srgb, var(--wf-soft) 45%, var(--surface)); }
tr.pt.blk.l3 td { background: color-mix(in srgb, var(--wf-soft) 25%, var(--surface)); }

/* ações da linha do cronograma: inserir/editar em cima, setas de nível (← elevar · → rebaixar) embaixo */
table.crono td.c-act .actsl,
table.crono td.c-act .nvbox {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 2px;
}
table.crono td.c-act .nvbox { margin-top: 2px; }
table.crono td.c-act .nvbox .nv { margin-left: 0; }
table.crono .nv:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}
table.crono .nv:disabled:hover { background: none; }
/* linha que acabou de mudar de nível */
@keyframes movido {
  from { box-shadow: inset 0 0 0 999px color-mix(in srgb, var(--scrum) 22%, transparent); }
  to { box-shadow: inset 0 0 0 999px transparent; }
}
table.crono tr.movido td { animation: movido 1.6s ease-out; }

/* ---------- Equipes de campo: situação, cartões, lista, painel lateral e programação ---------- */
.agst {
  --s: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 10px;
  white-space: nowrap;
  color: var(--s);
  background: color-mix(in srgb, var(--s) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--s) 35%, transparent);
}
.agst.s-n {
  --s: var(--muted);
  border-style: dashed;
}
.agst.s-p {
  --s: var(--scrum);
}
.agst.s-a {
  --s: var(--wf);
}
.agst.s-c {
  --s: var(--ok);
}
.agst.s-y {
  --s: var(--mk);
}
.agst.s-x {
  --s: var(--muted);
  text-decoration: line-through;
}
.agst.s-r {
  --s: var(--alert);
}
.agleg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  align-items: center;
}
.agcf {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--alert);
  white-space: nowrap;
}
.cdh {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  position: relative;
}
.cdh .cdadd {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
}
.cd:hover .cdadd,
.cdadd:focus-visible {
  opacity: 1;
}
.cdadd:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}
/* cartão de programação */
.agc {
  display: flex;
  align-items: stretch;
  min-width: 0;
  border: 1px solid var(--line);
  border-left: 4px solid var(--c);
  border-radius: 6px;
  background: var(--surface);
  overflow: hidden;
}
.agc:hover {
  border-color: var(--c);
}
.agcb {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  text-align: left;
  padding: 5px 7px;
  cursor: pointer;
}
.agc1 {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-width: 0;
}
.agc1 b {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c);
  line-height: 1.25;
  overflow-wrap: anywhere;
  flex: 1;
  min-width: 0;
}
.agc1 small {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.agc2 {
  font-size: 11.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
  max-width: 100%;
}
.agq {
  flex: none;
  width: 30px;
  border: 0;
  border-left: 1px solid var(--line);
  background: color-mix(in srgb, var(--ok) 8%, var(--surface));
  color: var(--ok);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.agq:hover {
  background: color-mix(in srgb, var(--ok) 22%, var(--surface));
}
.agc.s-c,
.agc.s-y {
  background: color-mix(in srgb, var(--ok) 6%, var(--surface));
}
.agc.s-x {
  opacity: 0.55;
  border-left-style: dashed;
}
.agc.s-x .agc1 b,
.agc.s-x .agc2 {
  text-decoration: line-through;
}
.agc.s-n {
  border-style: dashed;
  border-left-style: solid;
}
.agc.s-r {
  box-shadow: inset 0 0 0 1px var(--alert);
}
.cal.agsem .cdl {
  gap: 6px;
}
.agi.s-x {
  opacity: 0.55;
}
.agi .agp .agst {
  margin-left: 4px;
}
/* mês: carga do dia */
.agm {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  text-align: left;
  padding: 4px 6px;
  cursor: pointer;
}
.agm:hover {
  border-color: var(--scrum);
}
.agm span {
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agm b {
  color: var(--ink);
}
.agm.cf {
  border-color: var(--alert);
  background: color-mix(in srgb, var(--alert) 7%, var(--surface));
}
.agm .agmbar {
  display: flex;
  height: 4px;
  border-radius: 2px;
  overflow: hidden;
  gap: 1px;
  margin-top: 2px;
}
.agmbar i.c {
  background: var(--ok);
}
.agmbar i.p {
  background: var(--scrum);
}
.agmbar i.x {
  background: var(--line-strong);
}
.agdlist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 55vh;
  overflow: auto;
}
/* lista */
.agtw {
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}
table.agl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
table.agl th {
  text-align: left;
  font-size: 11.5px;
  text-transform: uppercase;
  color: var(--muted);
  background: var(--bg);
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 1;
}
table.agl td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}
table.agl tr:last-child td {
  border-bottom: 0;
}
table.agl td small {
  display: block;
  color: var(--muted);
  font-size: 11.5px;
}
table.agl .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
table.agl .nw {
  white-space: nowrap;
}
table.agl .agle {
  max-width: 340px;
  color: var(--muted);
}
table.agl tr.s-x td {
  opacity: 0.6;
}
table.agl .agacs {
  white-space: nowrap;
}
table.agl .agacs .agq {
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 6px;
  margin-right: 6px;
}
table.agl tr.err td {
  background: color-mix(in srgb, var(--alert) 9%, transparent);
}
table.agl tr.warn td {
  background: color-mix(in srgb, var(--mk) 10%, transparent);
}
table.agl tr.mut td {
  color: var(--muted);
}
.agdot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  margin-right: 6px;
}
.agbat {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid var(--scrum);
  border-radius: 8px;
  background: color-mix(in srgb, var(--scrum) 8%, var(--surface));
}
.agbat > b {
  margin-right: 6px;
}
.agbat[hidden] {
  display: none;
}
.agbat .agbtec {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.pmfil input[type="date"] {
  font: inherit;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 4px 8px;
}
.pmfil .agquem {
  margin-left: auto;
  align-self: center;
}
.lnk {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--scrum);
  text-decoration: underline;
  cursor: pointer;
}
.okt {
  color: var(--ok);
  font-weight: 600;
}
.bad {
  color: var(--alert);
}
.agwarnl {
  margin: 0;
  padding: 8px 10px 8px 26px;
  border: 1px solid color-mix(in srgb, var(--alert) 45%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--alert) 7%, transparent);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
/* disponibilidade do técnico */
.agdispw:empty {
  display: none;
}
.agdispw,
#agpDisp {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agdisp {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
}
.agdisph {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12.5px;
}
.agdisph i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  align-self: center;
}
.agdisph small {
  color: var(--muted);
}
.agdisph em {
  color: var(--alert);
  font-style: normal;
  font-weight: 600;
}
.dspd {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 5px;
}
.dsp {
  min-width: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 4px;
  padding: 2px 3px;
  font-size: 11px;
  line-height: 1.2;
  border: 1px solid var(--line);
}
.dsp small {
  font-size: 10px;
}
.dsp.lv {
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  border-color: color-mix(in srgb, var(--ok) 35%, transparent);
}
.dsp.oc {
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
  border-color: color-mix(in srgb, var(--scrum) 40%, transparent);
}
.dsp.cf {
  background: color-mix(in srgb, var(--alert) 16%, transparent);
  border-color: var(--alert);
  color: var(--alert);
}
.dsp.nu {
  opacity: 0.45;
}
/* janela + Programar: passos */
#dlgPmo:has(.agf2) {
  width: min(1000px, calc(100vw - 24px));
}
.agf2 {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) minmax(220px, 1.3fr) minmax(260px, 1.5fr);
  gap: 12px 16px;
  align-items: start;
}
.agstep {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.sl i {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--scrum);
  color: #fff;
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  margin-right: 4px;
}
.sl small {
  color: var(--muted);
}
.agstep .msel > summary {
  max-width: none;
}
.agtecs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 120px;
  overflow: auto;
}
.agtec {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--c);
  border-radius: 14px;
  padding: 3px 10px 3px 7px;
  font-size: 12.5px;
  cursor: pointer;
  background: var(--surface);
}
.agtec:has(input:checked) {
  background: color-mix(in srgb, var(--c) 16%, var(--surface));
  border-color: var(--c);
  font-weight: 650;
}
.agtec input {
  margin: 0;
}
.agstep select[name="equipe"] {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13.5px;
}
.agqw {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
}
.agqw > label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--muted);
}
.agqw input[type="date"],
.agqtd input,
.agpd input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13.5px;
}
.agquando:not(.per) .agsoper {
  display: none;
}
.agdias {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
  font-size: 12.5px;
  width: 100%;
}
.agptsf {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.agqtd,
.agpd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--muted);
}
.agqtd[hidden] {
  display: none;
}
.agqtd input,
.agpd input {
  width: 84px;
}
.agdist {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 13px;
}
.agdist[hidden] {
  display: none;
}
.agadv > summary {
  cursor: pointer;
  font-size: 12.5px;
  color: var(--muted);
  font-weight: 600;
}
.agadv[open] > summary {
  margin-bottom: 8px;
}
.agesc {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 13px;
  margin: 0;
}
.agesc legend {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  padding: 0 4px;
}
.agprev {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agprev .agtw {
  max-height: 26vh;
}
/* painel lateral */
dialog.drawer {
  margin: 0 0 0 auto;
  height: 100vh;
  max-height: 100vh;
  width: min(460px, 100vw);
  border-radius: 0;
  border-width: 0 0 0 1px;
}
dialog.drawer[open] {
  animation: agEntra 0.18s ease-out;
}
@keyframes agEntra {
  from {
    transform: translateX(30px);
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  dialog.drawer[open] {
    animation: none;
  }
}
dialog.drawer form {
  gap: 12px;
  min-height: 100%;
}
.agph {
  position: relative;
  border-left: 4px solid var(--c);
  padding: 0 34px 0 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: flex-start;
}
.agph h3 {
  color: var(--c);
}
.agph p {
  margin: 0;
  font-size: 13.5px;
}
.agpx {
  position: absolute;
  right: 0;
  top: -4px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
}
.agpx:hover {
  color: var(--ink);
}
.agpn {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.agpn div {
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
}
.agpn div + div {
  border-left: 1px solid var(--line);
}
.agpn b {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
.agpn span {
  font-size: 11.5px;
  color: var(--muted);
}
.agpinfo {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.agpacts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.agpacts .btn {
  font-size: 13px;
  padding: 5px 10px;
}
.agpacts .btn.on {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}
.agpf {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg) 60%, var(--surface));
}
.agpf h4 {
  margin: 0;
}
.agpf > label,
.agpf .fgrid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.agpf input:not([type="checkbox"]):not([type="radio"]),
.agpf select,
.agpf textarea {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13.5px;
}
dialog .agpf textarea {
  min-height: 56px;
  font-family: inherit;
}
.agpf .actions {
  margin-top: 0;
}
.agfpts {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px 8px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-height: 30vh;
  overflow: auto;
  font-size: 13px;
}
.agfpts legend {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.agcpt + .agcpt {
  border-top: 1px solid var(--line);
  padding-top: 4px;
}
.agcat {
  padding-left: 22px;
  color: var(--muted);
}
.agpsec > h4 {
  margin-bottom: 6px;
}
.agphist > summary h4 {
  display: inline;
  margin: 0;
}
.agphist > summary {
  cursor: pointer;
}
.agppts {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.agppts ul {
  margin: 2px 0 0;
  padding-left: 16px;
  color: var(--muted);
}
.agppts small {
  color: var(--muted);
}
.agppts li.ok > b::before {
  content: "✓ ";
  color: var(--ok);
}
.agppts li.canc {
  text-decoration: line-through;
  opacity: 0.65;
}
.agphist ol {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
}
.agphist li {
  display: flex;
  flex-direction: column;
  border-left: 2px solid var(--line-strong);
  padding-left: 8px;
}
.agphist li span {
  color: var(--muted);
  font-size: 11.5px;
}
.agphist li small {
  color: var(--muted);
}
.eqcap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.eqcap input {
  width: 80px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--bg);
  color: var(--ink);
}
@media (max-width: 760px) {
  .agf2 {
    grid-template-columns: 1fr;
  }
  .pmfil .agquem {
    margin-left: 0;
  }
}
.kpis.agkpis {
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
}
.agkpis .kpi {
  padding: 10px 12px;
}
/* janela + Programar: a janela rola inteira; a lista de pontos tem altura própria */
#dlgPmo:has(.agf2) .agptsw {
  flex: none;
  min-height: 0;
}
#dlgPmo:has(.agf2) .agpts {
  flex: none;
  height: 34vh;
  min-height: 170px;
}
/* + Programar: projeto, técnico e quando na mesma linha e na mesma altura */
.agf2 .msel > summary,
.agf2 .seg,
.agf2 .agqw input[type="date"],
.agf2 select[name="equipe"] {
  height: 36px;
  box-sizing: border-box;
}
.agf2 .seg button {
  padding-top: 0;
  padding-bottom: 0;
}
.agf2 .agqw {
  align-items: center;
}
.agf2 .agqw > label.agdt {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
}
.agf2 .agqw > label.agdt span:empty {
  display: none;
}
.agf2 .msel > summary {
  line-height: 24px;
  max-width: none;
}
.agf2 {
  grid-template-columns: minmax(180px, 1fr) minmax(200px, 1.1fr) minmax(340px, 1.6fr);
}
.agf2 .agqw input[type="date"] {
  width: 140px;
}
/* Quando: botões e datas numa linha; dias incluídos numa linha abaixo */
.agf2 {
  grid-template-columns: minmax(170px, 0.9fr) minmax(190px, 1fr) minmax(420px, 1.8fr);
}
.agf2 .agqw {
  gap: 6px;
  flex-wrap: wrap;
}
.agf2 .seg button {
  padding: 0 12px;
}
.agf2 .agqw input[type="date"] {
  width: 128px;
  padding: 5px 6px;
  font-size: 13px;
}
.agf2 .agqw > label.agdt span {
  color: var(--muted);
}
.agf2 .agdias {
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 10px;
  font-size: 12.5px;
  margin-top: 2px;
}
.agf2 .agdias .sl {
  font-size: 12px;
}
.agf2 .agdias .chkl {
  gap: 4px;
  font-size: 12.5px;
}
#dlgPmo:has(.agf2) {
  width: min(1100px, calc(100vw - 24px));
}
.agf2 {
  grid-template-columns: minmax(170px, 0.9fr) minmax(220px, 1fr) minmax(470px, 1.9fr);
}
.agjunto .chkl {
  white-space: nowrap;
}
#dlgPmo:has(.agf2) {
  width: min(1100px, calc(100vw - 24px)) !important; /* o diálogo tem largura fixa no index.html */
}
/* diálogo fechado nunca aparece (regras com display: flex anulavam o padrão do navegador) */
dialog:not([open]) {
  display: none !important;
}
.agesc[hidden] {
  display: none;
}
.agf2 select[name="equipe"] {
  width: 100%;
}
.agf2 select[name="equipe"] {
  appearance: none;
  padding-right: 28px;
  background: var(--surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%238b95a7' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center;
  border-color: var(--line-strong);
}
/* painel lateral: concluir ponto a ponto */
.agpth2 {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.agpth2 .agptok {
  margin-left: auto;
  font-size: 12px;
  padding: 3px 9px;
  color: var(--ok);
  border-color: color-mix(in srgb, var(--ok) 45%, transparent);
}
.agpth2 .agptdf {
  margin-left: auto;
  font-size: 12px;
}
.agppts li.ok .agpth2 > b::before {
  content: "✓ ";
  color: var(--ok);
}
/* cronograma: reordenar por arraste (alça ⋮⋮, linha de inserção e etiqueta do item) */
table.crono td.code .grip {
  touch-action: none;
}
table.crono td.code .grip.off {
  cursor: not-allowed;
  opacity: 0.2;
}
:where([data-implbody]).mvarr,
:where([data-implbody]).mvarr * {
  user-select: none;
  cursor: grabbing !important;
}
.mvlin {
  position: absolute;
  z-index: 60;
  height: 3px;
  border-radius: 2px;
  background: var(--scrum);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 30%, transparent);
  pointer-events: none;
}
.mvlin::before {
  content: "";
  position: absolute;
  left: -4px;
  top: -3px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--scrum);
}
.mvlbl {
  position: fixed;
  z-index: 61;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 340px;
  padding: 6px 10px;
  border: 1px solid var(--scrum);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font-size: 12.5px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}
.mvlbl small {
  color: var(--muted);
  font-size: 11.5px;
}
/* Equipe do setor: legenda das cores de situação das obras */
.eqleg {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  color: var(--muted);
  margin-left: auto;
}
.eqleg span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.eqleg i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
}
.eqlegw {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: -4px 0 12px;
  font-size: 12px;
}
.eqlegw .eqleg {
  margin-left: 0;
}
/* + Programar: projeto fora do painel (nome digitado) */
.agproj1 .agmanb {
  margin-left: 6px;
  font-size: 11.5px;
}
.agproj1 .agmanin {
  display: none;
  height: 36px;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13.5px;
}
.agproj1.man .agmanin {
  display: block;
}
.agproj1.man #agProjs {
  display: none;
}
.agptsw[hidden] {
  display: none;
}
#dlgPmo .agptsw[hidden] {
  display: none !important;
}
/* + Programar fora do painel: pontos digitados (nome, endereço, coordenadas) */
#dlgPmo .aglocw[hidden] {
  display: none;
}
.aglocw {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agloch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
#agLocs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.agloc {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(200px, 2fr) minmax(190px, 1.2fr) 30px;
  gap: 6px;
  align-items: center;
}
.agloc input {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  min-width: 0;
}
.agloc input.bad {
  border-color: var(--alert);
  box-shadow: 0 0 0 1px var(--alert);
}
@media (max-width: 760px) {
  .agloc {
    grid-template-columns: 1fr 30px;
  }
}
/* ---------- barra lateral: ícones, pesquisa e modo recolhido/aberto ---------- */
.side .cartb {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.sico {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 12%, transparent);
}
.stx {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.stop {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.stop .stg {
  width: 36px;
  height: 36px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: var(--ink);
}
.stit {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.side .side-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 4px 10px;
}
.shl {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.shl .sico {
  width: 22px;
  height: 22px;
}
.sbw {
  position: relative;
  flex: 1 1 150px;
  display: flex;
  align-items: center;
  color: var(--muted);
}
.sbw svg {
  position: absolute;
  left: 9px;
  pointer-events: none;
}
.sbusca {
  width: 100%;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  padding: 6px 8px 6px 28px;
}
.svazio {
  font-size: 12.5px;
  padding: 4px 10px 10px;
  margin: 0;
}
.pwrap[hidden],
.svazio[hidden] {
  display: none;
}
.sprj {
  display: none !important;
}
.sbadge {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}
@media (min-width: 901px) {
  .shell {
    grid-template-columns: 64px minmax(0, 1fr);
  }
  .shell > .wrap {
    grid-column: 2;
  }
  .side {
    width: 64px;
    padding: 12px 8px;
    overflow-x: hidden;
    transition: width 0.18s ease, box-shadow 0.18s ease;
  }
  /* recolhida: só os ícones */
  .side:not(.aberta) .stx,
  .side:not(.aberta) .stit,
  .side:not(.aberta) .side-h,
  .side:not(.aberta) .svazio,
  .side:not(.aberta) .plist,
  .side:not(.aberta) .encf,
  .side:not(.aberta) .newp {
    display: none !important;
  }
  .side:not(.aberta) .stop {
    justify-content: center;
  }
  .side:not(.aberta) .cartb {
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 6px 0;
  }
  .side:not(.aberta) .sprj {
    display: flex !important;
  }
  /* aberta: mais larga, por cima do conteúdo */
  .side.aberta {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 70;
    width: min(380px, 92vw);
    padding: 14px 14px 20px;
    box-shadow: 10px 0 30px rgba(0, 0, 0, 0.35);
  }
  :where([data-implbody]).sideab .shell > .wrap {
    filter: brightness(0.8);
  }
}
@media (prefers-reduced-motion: reduce) {
  .side {
    transition: none;
  }
}
@media (max-width: 900px) {
  .stop,
  .sprj {
    display: none !important;
  }
}
/* barra lateral: pasta dos projetos encerrados */
.side .encf {
  margin-top: 16px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.side .encf > summary {
  justify-content: flex-start;
}
.side .encf > summary .shl {
  flex: 1;
}
.sico.enc {
  color: var(--muted);
  background: color-mix(in srgb, var(--muted) 16%, transparent);
}
.encvz {
  font-size: 12.5px;
  margin: 0;
  padding: 2px 10px 6px;
}
.encbw {
  margin: 2px 4px 8px;
}
/* barra lateral fixada: aberta ao lado do conteúdo */
.stop .sfix {
  margin-left: auto;
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: var(--muted);
}
.stop .sfix.on {
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
}
@media (min-width: 901px) {
  .side:not(.aberta) .sfix {
    display: none;
  }
  :where([data-implbody]).sidefixa .shell {
    grid-template-columns: 320px minmax(0, 1fr);
  }
  :where([data-implbody]).sidefixa .side.aberta {
    position: sticky;
    width: 320px;
    box-shadow: none;
    z-index: auto;
  }
}
@media (max-width: 900px) {
  .sfix {
    display: none;
  }
}
/* carregando: no meio da janela (não no topo do conteúdo) */
.loading {
  position: fixed;
  inset: 0;
  padding: 0;
  z-index: 1;
  pointer-events: none;
}
/* ---------- carteira: acompanhamento (status report e ações) ---------- */
.srall {
  margin-left: 8px;
  font-size: 11.5px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
}
.srres {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  padding: 8px 30px 8px 10px;
  cursor: pointer;
}
.srres:hover,
.srres.on {
  border-color: var(--scrum);
}
.srtx {
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
}
.srmeta,
.srprox {
  font-size: 12px;
  color: var(--muted);
}
.srprox {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
}
.srprox b {
  font-weight: 650;
}
.srseta {
  position: absolute;
  right: 10px;
  top: 12px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--muted);
  border-bottom: 2px solid var(--muted);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
}
.srres.on .srseta {
  transform: rotate(-135deg);
  top: 16px;
}
.acdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
  background: var(--muted);
}
.acdot.s-r,
.acst.s-r {
  --s: var(--alert);
}
.acdot.s-a,
.acst.s-a {
  --s: var(--mk);
}
.acdot.s-p,
.acst.s-p {
  --s: var(--ok);
}
.acdot.s-n,
.acst.s-n {
  --s: var(--muted);
}
.acdot.s-c,
.acst.s-c {
  --s: var(--ok);
}
.acdot {
  background: var(--s, var(--muted));
}
.acst {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 650;
  padding: 2px 8px;
  border-radius: 10px;
  color: var(--s);
  background: color-mix(in srgb, var(--s) 14%, transparent);
  white-space: nowrap;
}
tr.srdet > td {
  background: color-mix(in srgb, var(--scrum) 5%, var(--surface));
  padding: 12px 14px 16px !important;
}
.srdg {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(420px, 1.4fr);
  gap: 16px;
  align-items: start;
}
.srdg h4 {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
}
.srdg h4 small {
  font-weight: 500;
  color: var(--muted);
  margin-left: 6px;
}
textarea.srin.srbig {
  min-height: 120px;
  width: 100%;
  font-size: 13.5px;
  line-height: 1.45;
}
.acth2,
.acbox .acrow {
  display: grid;
  grid-template-columns: 26px minmax(0, 2fr) minmax(120px, 1fr) 132px 26px;
  gap: 6px;
  align-items: center;
}
.acth2 {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 650;
  text-transform: uppercase;
  padding: 0 0 4px;
}
.acbox .acrow input {
  width: 100%;
  min-width: 0;
}
.acbox .aclist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.acbox .acrow .acdel {
  opacity: 0.6;
}
.acbox .acadd {
  align-self: flex-start;
}
.acrf {
  margin-left: auto;
  flex-direction: row !important;
  align-items: center;
  gap: 6px !important;
}
table.aclt td {
  vertical-align: middle;
}
table.aclt tr.s-r td:first-child {
  color: var(--alert);
  font-weight: 650;
}
@media (max-width: 1100px) {
  .srdg {
    grid-template-columns: 1fr;
  }
}
/* barra lateral: bolinha da situação do projeto */
.pitem .pdot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--c);
  margin-right: 7px;
  vertical-align: 1px;
}
.srprox {
  display: block;
  line-height: 1.4;
}
.srprox .acdot {
  display: inline-block;
  margin-right: 6px;
  vertical-align: 1px;
}
table.aclt .lnk {
  text-align: left;
}
/* barra lateral: navegação, painéis e pesquisa fixos; só a lista de projetos rola */
@media (min-width: 901px) {
  .side {
    display: flex;
    flex-direction: column;
    overflow-y: hidden;
  }
  .side > .stop,
  .side > .cartb,
  .side > .side-h {
    flex: none;
  }
  .side .sscroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin: 0 -6px;
    padding: 0 6px 8px;
    border-top: 1px solid var(--line);
    padding-top: 8px;
  }
  .side:not(.aberta) .sscroll {
    display: none;
  }
  .side:not(.aberta) {
    overflow-y: auto;
  }
}
@media (max-width: 900px) {
  .side .sscroll {
    display: contents;
  }
}
/* ações: prazo contínuo (∞) */
.acth2,
.acbox .acrow {
  grid-template-columns: 26px minmax(0, 2fr) minmax(120px, 1fr) 168px 26px;
}
.acdw {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.acdw .ac-d {
  flex: 1;
  min-width: 0;
}
.accont {
  display: none;
  flex: 1;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--scrum);
  padding: 6px 8px;
  border: 1px dashed color-mix(in srgb, var(--scrum) 50%, transparent);
  border-radius: 6px;
}
.acrow.cont .ac-d {
  display: none;
}
.acrow.cont .accont {
  display: block;
}
.actg {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  font-size: 16px;
  line-height: 1;
  color: var(--muted);
}
.actg.on {
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
}
.acdot.s-k,
.acst.s-k {
  --s: var(--scrum);
}
/* carteira: pesquisa e status na seção Projetos */
.cfilh {
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.cfilh h2 {
  margin-right: 6px;
}
.cbusca {
  flex: 0 1 340px;
}
.cstf {
  flex-direction: row !important;
  align-items: center;
  gap: 6px !important;
}
.cstf select {
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 5px 8px;
}
.cqn {
  margin-right: auto;
}
tr.prow[hidden],
tr.srdet[hidden] {
  display: none;
}
/* nome da sprint ao lado do número */
.sprint-h h3 {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sprint-h .sprn {
  font: inherit;
  font-weight: 650;
  color: var(--ink);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 2px 6px;
  min-width: 220px;
}
.sprint-h .sprn:hover,
.sprint-h .sprn:focus {
  border-color: var(--line-strong);
  background: var(--surface);
}
.sprint-h h3 {
  white-space: nowrap;
  flex: 0 1 auto;
  min-width: 0;
}
.sprint-h .sprn {
  width: min(420px, 50vw);
}
/* sprints: data de conclusão */
table.stack input.scfim {
  width: 100%;
  min-width: 132px;
  max-width: 150px;
}
table.stack tr.arrastando td {
  opacity: 0.45;
}
/* predecessora: com Ctrl pressionado, o campo vira link para a tarefa */
:where([data-implbody]).ctrl input.ie-pred[data-epred],
:where([data-implbody]).ctrl input.ie-pred[data-gpred] {
  cursor: pointer;
  text-decoration: underline;
  color: var(--scrum);
}
table.stack tr.movido td {
  animation: movido 1.6s ease;
}
/* sprint: período (início e fim) numa linha, com rótulo */
.sprint-h .sprdt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  font-size: 12.5px;
  color: var(--muted);
}
.sprint-h .sprdt .sprl {
  font-weight: 600;
  white-space: nowrap;
}
.sprint-h .sprdt input.dt {
  display: inline-block;
  width: 138px;
  margin: 0;
  padding: 4px 6px;
  font-size: 12.5px;
}
/* editar atividade (execução): blocos com título */
#formItem .fgrid > h4.fsec {
  grid-column: 1 / -1;
  margin: 10px 0 -4px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
#formItem .fgrid > h4.fsec:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
#formItem .fgrid > p.fdica {
  margin: -4px 0 0;
  font-size: 12px;
}
/* período da sprint e contagem de itens no canto direito do cabeçalho */
.sprint-h {
  align-items: center;
}
.sprint-h .sprdt {
  margin-left: auto;
}
/* monitoramento e controle: ciclo, execuções e histórico */
table.g4t select.g4ciclo {
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 4px 6px;
}
table.g4t td.bad {
  color: var(--alert);
  font-weight: 600;
}
table.g4t .c-act {
  white-space: nowrap;
}
.g4hsec {
  margin-top: 18px;
}
.g4lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 40vh;
  overflow: auto;
}
.g4lista li {
  display: grid;
  grid-template-columns: 92px 1fr auto 26px;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 13px;
}
table.g4t .mut,
.g4hsec .mut,
.g4lista .mut {
  color: var(--muted);
}
.g4lista .ico.rm {
  justify-self: end;
}
/* assistente IA: botão fixo no canto superior direito + painel lateral */
.iafab {
  position: fixed;
  top: 45px;
  right: 24px;
  z-index: 60;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--scrum);
  display: grid;
  place-items: center;
  cursor: pointer;
}
/* carteira e PMO: alinhado à linha dos botões do título (Exportar relatório executivo, Atualizar) */
:where([data-implbody]).cart .iafab {
  top: 36px;
  width: 34px;
  height: 34px;
}
.iafab:hover {
  border-color: var(--ink);
  background: color-mix(in srgb, var(--scrum) 12%, var(--surface));
}
.iafab:focus-visible {
  outline: 2px solid var(--scrum);
  outline-offset: 2px;
}
header.top {
  padding-right: 52px;
}
dialog.iadrawer {
  width: min(600px, 100vw);
  padding: 0;
}
dialog.iadrawer #iaHost,
dialog.iadrawer #iaBox {
  height: 100%;
}
dialog.iadrawer #iaBox {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  margin: 0;
  border: 0;
  border-radius: 0;
  padding: 18px 18px 14px;
}
dialog.iadrawer .panel-h {
  position: relative;
  padding-right: 36px;
}
dialog.iadrawer .iafechar {
  position: absolute;
  top: -4px;
  right: 0;
  font-size: 20px;
}
dialog.iadrawer .iaconv {
  flex: 1 1 auto;
  max-height: none;
  min-height: 0;
}
dialog.iadrawer .iaconv:empty {
  display: block;
}
dialog.iadrawer .iain {
  flex: none;
}
@media (max-width: 640px) {
  .iafab,
  :where([data-implbody]).cart .iafab {
    top: auto;
    bottom: 16px;
  }
  header.top {
    padding-right: 0;
  }
}/* assistente fixado: painel ao lado da página, sem fundo escurecido; a página encolhe */
dialog.iadrawer.fixo {
  position: fixed;
  inset: 0 0 0 auto;
  margin: 0;
  width: clamp(320px, 23vw, 440px);
  z-index: 55;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.18);
}
:where([data-implbody]).iafixo .shell {
  margin-right: clamp(320px, 23vw, 440px);
}
:where([data-implbody]).iafixo .iafab {
  display: none;
}
dialog.iadrawer .iabtns {
  position: absolute;
  top: -6px;
  right: 0;
  display: flex;
  gap: 2px;
}
dialog.iadrawer .iabtns .iafechar {
  position: static;
}
dialog.iadrawer .panel-h {
  padding-right: 72px;
}
dialog.iadrawer .iabtns .ico {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}
dialog.iadrawer .iafixar[aria-pressed="true"] {
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
}
@media (max-width: 900px) {
  :where([data-implbody]).iafixo .shell {
    margin-right: 0;
  }
}/* página de login */
:where([data-implbody]).loginpg {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  box-sizing: border-box;
  background: var(--bg);
}
.lgbox {
  width: min(400px, 100%);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 28px 28px 24px;
  box-sizing: border-box;
}
.lgmarca {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}
.lglogo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 14%, transparent);
}
.lgmarca h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 760;
  font-stretch: 90%;
}
.lgmarca p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}
.lgbox h2 {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 720;
}
.lgtxt {
  margin: 0 0 14px;
  font-size: 13.5px;
  color: var(--muted);
  line-height: 1.5;
}
.lgform {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}
.lgform label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}
.lgform input {
  font: inherit;
  font-size: 14.5px;
  font-weight: 400;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 9px 11px;
  width: 100%;
  box-sizing: border-box;
}
.lgform input:focus {
  outline: 2px solid var(--scrum);
  outline-offset: 0;
  border-color: var(--scrum);
}
.lgsenha {
  position: relative;
  display: block;
}
.lgsenha input {
  padding-right: 42px;
}
.lgolho {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
}
.lgolho[aria-pressed="true"] {
  color: var(--scrum);
}
.lgbtn {
  width: 100%;
  padding: 10px 12px;
  font-size: 14.5px;
  text-align: center;
  text-decoration: none;
  box-sizing: border-box;
  display: block;
}
.lgbtn:disabled {
  opacity: 0.6;
  cursor: progress;
}
.lglnk {
  align-self: center;
  font-size: 13px;
  color: var(--scrum);
}
.lgdica {
  margin: -4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.lgmsg {
  margin: 0;
  padding: 9px 11px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.45;
}
.lgmsg.err {
  color: var(--alert);
  background: color-mix(in srgb, var(--alert) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--alert) 35%, transparent);
}
.lgmsg.ok {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
}
.lgcod {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  margin: 0 0 14px;
}/* usuário logado no pé da barra lateral */
.side > .suser {
  flex: none;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.suser .pitem {
  width: 100%;
}
.cfgav {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--scrum) 18%, transparent);
  color: var(--scrum);
  font-size: 11.5px;
  font-weight: 760;
  flex: none;
}
.suser .sico.cfgav {
  width: 28px;
  height: 28px;
}
/* configurações */
.cfgh1 {
  margin: 0;
  font-size: 30px;
  font-weight: 760;
  font-stretch: 90%;
}
.cfgtop {
  margin-bottom: 10px;
}
.cfgtabs {
  margin-bottom: 16px;
}
.cfgkpis {
  margin-bottom: 14px;
}
.cfgkpis .kpi .v.ok {
  color: var(--ok);
}
.cfgbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: center;
  margin-bottom: 12px;
}
.cfgbar select,
.cfgdata input {
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 6px 8px;
}
.cfgbusca {
  flex: 1 1 240px;
  max-width: 360px;
}
.cfgbusca input {
  width: 100%;
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  padding: 6px 8px 6px 28px;
}
.cfgbar .note {
  flex: 1 1 320px;
  font-size: 12.5px;
  color: var(--muted);
}
.cfgnovo {
  margin-left: auto;
}
.cfgdata {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--muted);
}
table.cfgt td {
  vertical-align: middle;
}
.cfgord {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-transform: inherit;
  letter-spacing: inherit;
}
.cfgord.on {
  color: var(--ink);
}
.cfgu {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.cfgvoce,
.cfgind {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--scrum-soft);
  color: var(--scrum);
  white-space: nowrap;
}
.cfgst {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 99px;
  white-space: nowrap;
}
.cfgst.on {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 14%, transparent);
}
.cfgst.off {
  color: var(--muted);
  background: color-mix(in srgb, var(--muted) 16%, transparent);
}
.cfgst.warn {
  color: var(--alert);
  background: color-mix(in srgb, var(--alert) 13%, transparent);
}
.cfgacts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
  justify-content: flex-end;
}
table.cfgt .c-act {
  text-align: right;
}
.cfgacts .btn {
  padding: 4px 8px;
  font-size: 12.5px;
}
.cfgpag {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 13px;
}
.cfgpag .btn {
  padding: 2px 10px;
}
.cfgped {
  border-color: color-mix(in srgb, var(--alert) 40%, var(--line));
}
.cfgpedl {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  font-size: 13.5px;
}
.cfgperfis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.cfgperf {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cfgperfh {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.cfgperfh h3 {
  margin: 0;
  font-size: 15.5px;
}
.cfgperf .hint {
  margin: 0;
}
.cfgperf .cfgacts {
  margin-top: auto;
  justify-content: flex-start;
}
.cfgacc {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
}
.cfgacc li {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}
.cfgacc li b {
  font-weight: 600;
  min-width: 190px;
}
table.cfgmat {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
table.cfgmat th,
table.cfgmat td {
  border-bottom: 1px solid var(--line);
  padding: 6px 8px;
  text-align: center;
}
table.cfgmat th[scope="row"],
table.cfgmat thead th:first-child {
  text-align: left;
  font-weight: 600;
}
table.cfgmat thead th {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 700;
}
table.cfgmat input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--scrum);
}
.cfgherda {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.cfgdet summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 13.5px;
}
.cfgdet[open] summary {
  margin-bottom: 8px;
}
.cfgdl {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 6px 12px;
  margin: 0;
  font-size: 13.5px;
}
.cfgdl dt {
  color: var(--muted);
}
.cfgdl dd {
  margin: 0;
}
dialog.cfgdlg {
  width: min(560px, calc(100vw - 24px));
}
dialog.cfgdlg.largo {
  width: min(860px, calc(100vw - 24px));
}
dialog.cfgdlg label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
}
dialog.cfgdlg label.cfgherda {
  flex-direction: row;
  font-weight: 400;
}
dialog.cfgdlg input:not([type="checkbox"]),
dialog.cfgdlg select {
  font: inherit;
  font-size: 14px;
  font-weight: 400;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 8px 10px;
  width: 100%;
  box-sizing: border-box;
}
dialog.cfgdlg .fdica {
  font-weight: 400;
}
.cfgacao {
  font-weight: 600;
}
.cfgacao.c-acesso {
  color: var(--scrum);
}
.cfgacao.c-dados {
  color: var(--muted);
}
.cfgdetl {
  font-size: 12.5px;
  color: var(--muted);
  word-break: break-word;
}
/* permissões na tela: o que o perfil não pode fazer some (o servidor confere de qualquer jeito) */
:where([data-implbody]).ro-projetos [data-add],
:where([data-implbody]).ro-projetos [data-edit],
:where([data-implbody]).ro-projetos [data-newproj],
:where([data-implbody]).ro-projetos [data-editproj],
:where([data-implbody]).ro-projetos #btnNewRev,
:where([data-implbody]).ro-projetos #btnDelRev,
:where([data-implbody]).ro-projetos .grip,
:where([data-implbody]).ro-projetos [data-mvg],
:where([data-implbody]).ro-projetos [data-g4reg],
:where([data-implbody]).ro-projetos [data-vimport],
:where([data-implbody]).ro-projetos [data-addbelow],
:where([data-implbody]).ro-projetos [data-nv],
:where([data-implbody]).ro-projetos [data-newsc],
:where([data-implbody]).ro-projetos [data-itens],
:where([data-implbody]).ro-projetos [data-import],
:where([data-implbody]).ro-projetos [data-resched],
:where([data-implbody]).ro-projetos [data-icq],
:where([data-implbody]).ro-projetos [data-igrp],
:where([data-implbody]).ro-projetos [data-mvac],
:where([data-implbody]).ro-projetos [data-acadd],
:where([data-implbody]).ro-projetos [data-acdel],
:where([data-implbody]).ro-projetos [data-acfeita],
:where([data-implbody]).ro-projetos .sprlk,
:where([data-implbody]).ro-projetos [data-g4del],
:where([data-implbody]).ro-projetos [data-rkset],
:where([data-implbody]).ro-projetos [data-pontos],
:where([data-implbody]).ro-pmo [data-stk],
:where([data-implbody]).ro-pmo [data-eqedit],
:where([data-implbody]).ro-pmo [data-eqadd],
:where([data-implbody]).ro-pmo [data-eqrm],
:where([data-implbody]).ro-pmo [data-eqcadd],
:where([data-implbody]).ro-pmo [data-eqcrm],
:where([data-implbody]).ro-financeiro [data-fat-new],
:where([data-implbody]).ro-financeiro [data-fat-edit],
:where([data-implbody]).ro-financeiro [data-fat-del2],
:where([data-implbody]).sem-fin [data-fat-list],
:where([data-implbody]).sem-fin .chart-foot:has([data-fat-new]),
:where([data-implbody]).ro-campo [data-agfin],
:where([data-implbody]).ro-campo [data-agbat],
:where([data-implbody]).ro-campo [data-agnovo],
:where([data-implbody]).sx-projetos [data-expmenu],
:where([data-implbody]).sx-projetos .expw,
:where([data-implbody]).sx-carteira [data-cartpdf],
:where([data-implbody]).sx-carteira [data-xlsx],
:where([data-implbody]).sx-campo [data-agexp],
:where([data-implbody]).sx-campo [data-agpdf],
:where([data-implbody]).sx-campo [data-rtpdf],
:where([data-implbody]).sem-ia .iafab {
  display: none !important;
}
:where([data-implbody]).ro-projetos #view table input,
:where([data-implbody]).ro-projetos #view table select,
:where([data-implbody]).ro-projetos #view table textarea,
:where([data-implbody]).ro-projetos #view .aclist,
:where([data-implbody]).ro-projetos #view [data-gate],
:where([data-implbody]).ro-projetos #view [data-spred],
:where([data-implbody]).ro-projetos #view [data-icell],
:where([data-implbody]).ro-projetos #projName {
  pointer-events: none;
  opacity: 0.85;
}
@media (max-width: 640px) {
  .cfgdl {
    grid-template-columns: 1fr;
  }
  .cfgacc li b {
    min-width: 0;
  }
}.cfgacts .btn {
  white-space: nowrap;
}
table.cfgmat th[scope="row"],
table.cfgmat thead th:first-child {
  width: 30%;
  min-width: 200px;
}/* Minhas atividades */
.mvkpis {
  margin-bottom: 14px;
}
.kpi.mvk {
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border: 0;
  background: none;
}
.kpi.mvk:hover {
  background: color-mix(in srgb, var(--scrum) 8%, transparent);
}
.kpi.mvk.on {
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
  box-shadow: inset 0 -2px 0 var(--scrum);
}
.kpi .v.warn {
  color: #c98a1b;
}
.mvquem {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}
.mvquem select {
  font: inherit;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 6px 8px;
}
.mvavisos ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mva button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  font: inherit;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-left: 3px solid var(--c, var(--line-strong));
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
}
.mva button:hover {
  border-color: var(--c, var(--line-strong));
}
.mva.bad {
  --c: var(--alert);
}
.mva.warn {
  --c: #c98a1b;
}
.mva.info {
  --c: var(--scrum);
}
.mvdot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  flex: none;
}
.mvtot {
  margin-left: auto;
  font-size: 12.5px;
}
.mvgr {
  border-top: 1px solid var(--line);
  padding: 4px 0;
}
.mvgr summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 2px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13.5px;
}
.mvgt.bad {
  color: var(--alert);
}
.mvgt.warn {
  color: #c98a1b;
}
.mvgt.info {
  color: var(--scrum);
}
.mvgt.mut {
  color: var(--muted);
}
.mvgn {
  font-size: 11.5px;
  padding: 1px 8px;
  border-radius: 99px;
  background: var(--bg);
  border: 1px solid var(--line);
  color: var(--muted);
}
.mvlist {
  display: flex;
  flex-direction: column;
}
.mvrow {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr) 170px auto;
  gap: 4px 14px;
  align-items: center;
  padding: 9px 4px;
  border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
}
.mvrow:first-child {
  border-top: 0;
}
.mvfonte {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.mvfonte.f-crono {
  color: var(--scrum);
}
.mvfonte.f-campo {
  color: #2f8f6a;
}
.mvfonte.f-acao {
  color: #b0702a;
}
.mvtxt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.mvtxt b {
  font-size: 14px;
  font-weight: 600;
}
.mvtxt > span {
  font-size: 12.5px;
  color: var(--muted);
}
.mvproj {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--c);
  border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  border-radius: 4px;
  padding: 0 5px;
  margin-right: 6px;
}
.mvpor,
.mvini,
.mvbloq {
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  border-radius: 99px;
  white-space: nowrap;
}
.mvpor {
  background: var(--scrum-soft);
  color: var(--scrum);
}
.mvini {
  background: color-mix(in srgb, var(--ok) 15%, transparent);
  color: var(--ok);
}
.mvbloq {
  background: color-mix(in srgb, var(--alert) 13%, transparent);
  color: var(--alert);
}
.mvprazo {
  font-size: 12.5px;
  color: var(--muted);
}
.mvprazo.bad {
  color: var(--alert);
  font-weight: 600;
}
.mvacts {
  display: flex;
  gap: 2px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.mvacts .btn {
  padding: 4px 8px;
  font-size: 12.5px;
  white-space: nowrap;
}
.mvmais {
  margin: 6px 0 4px;
}
.sico {
  position: relative;
}
.mvbadge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 99px;
  background: var(--alert);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}
/* Gestão de equipes · Visão geral */
.gvset {
  margin-bottom: 10px;
}
tr.gvrow {
  cursor: pointer;
}
tr.gvrow:hover td,
tr.gvrow:focus-visible td {
  background: color-mix(in srgb, var(--scrum) 8%, transparent);
}
table.gvt td.num,
table.gvt th.num {
  text-align: right;
}
table.gvt td.bad {
  color: var(--alert);
  font-weight: 700;
}
.gvduo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 14px;
}
.gvtec,
.gvproj {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gvtec li,
.gvproj li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 7px 0;
  border-top: 1px solid var(--line);
  font-size: 13.5px;
}
.gvtec li:first-child,
.gvproj li:first-child {
  border-top: 0;
}
.gvtec li > b {
  min-width: 190px;
}
.gvproj li {
  justify-content: space-between;
}
@media (max-width: 760px) {
  .mvrow {
    grid-template-columns: 1fr;
  }
  .mvacts {
    justify-content: flex-start;
  }
}/* sprint: situação, período (clicável para ajustar) e botões Iniciar / Encerrar */
.sprint-h .sprdt {
  gap: 8px;
}
.sprst {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 99px;
  white-space: nowrap;
  color: var(--muted);
  background: color-mix(in srgb, var(--muted) 14%, transparent);
}
.sprst.and {
  color: var(--scrum);
  background: color-mix(in srgb, var(--scrum) 16%, transparent);
}
.sprst.fim {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 14%, transparent);
}
.sprper {
  border: 1px dashed var(--line-strong);
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 12.5px;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.sprper:hover {
  border-style: solid;
  border-color: var(--scrum);
}
.sprbt {
  padding: 4px 10px;
  font-size: 12.5px;
  white-space: nowrap;
}#formFat .sprg {
  grid-template-columns: 1fr 1fr 130px;
}
#formFat .sprg .fdica {
  font-size: 11.5px;
  font-weight: 400;
  color: var(--muted);
  min-height: 1em;
}/* sprint: bloco único com situação, período e ação */
.sprbox {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  font-size: 12.5px;
}
.sprseg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border: 0;
  border-left: 1px solid var(--line);
  background: none;
  color: var(--ink);
  font: inherit;
  white-space: nowrap;
}
.sprseg:first-child {
  border-left: 0;
}
.sprest {
  color: var(--muted);
  font-weight: 600;
}
.sprest i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  box-sizing: border-box;
}
.sprest.and {
  color: var(--scrum);
}
.sprest.and i {
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent);
}
.sprest.atras {
  color: var(--alert);
}
.sprest.atras i {
  background: currentColor;
}
.sprest.fim {
  color: var(--ok);
}
.sprest.fim i {
  background: currentColor;
}
button.sprper {
  position: relative;
  cursor: pointer;
  gap: 8px;
}
button.sprper:hover,
button.sprac:hover {
  background: color-mix(in srgb, var(--scrum) 10%, transparent);
}
.sprd {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.sprsub {
  color: var(--muted);
}
.sprper.atras .sprsub {
  color: var(--alert);
  font-weight: 600;
}
.sprbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
}
.sprbar i {
  display: block;
  height: 100%;
  background: var(--scrum);
}
.sprper.atras .sprbar i {
  background: var(--alert);
}
button.sprac {
  cursor: pointer;
  font-weight: 600;
  color: var(--ink);
}
button.sprac.prim {
  background: var(--ink);
  color: var(--bg);
}
button.sprac.prim:hover {
  background: color-mix(in srgb, var(--ink) 85%, var(--scrum));
}/* sprint: versão minimalista (só texto) */
.sprmin {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  color: var(--muted);
  white-space: nowrap;
}
.sprtx,
.sprlk {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}
.sprtx {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.sprtx:hover {
  color: var(--ink);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.sprtx-s.atras {
  color: var(--alert);
}
.sprtx-s.ok {
  color: var(--ok);
}
.sprlk {
  margin-left: 10px;
  color: var(--scrum);
  font-weight: 600;
}
.sprlk:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}/* Minhas atividades: subgrupo por projeto dentro de cada situação */
.mvpg {
  margin: 2px 0 10px;
}
.mvph {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  font-size: 13px;
  font-weight: 700;
  border-bottom: 1px solid var(--line);
}
.mvph .mvgn {
  margin-left: 6px;
}
.mvpg .mvlist {
  padding-left: 12px;
}/* sprint: previsão de conclusão (vencida em vermelho) */
table.stack input.sprev {
  width: 100%;
  max-width: 140px;
  box-sizing: border-box;
}
table.stack input.sprev.late {
  color: var(--alert);
  border-color: color-mix(in srgb, var(--alert) 55%, var(--line-strong));
  font-weight: 600;
}/* cabeçalho fixo (título e abas) ao rolar a página */
.pghead {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bg);
  margin: -22px -24px 14px;
  padding: 22px 24px 0;
  box-shadow: 0 1px 0 var(--line);
}
.pghead > header.top {
  margin-bottom: 10px;
}
.pghead > nav.ctabs,
.pghead > nav.views {
  margin-bottom: 0;
}
:where([data-implbody]).cart .pgproj {
  display: none;
}
@media (max-width: 900px) {
  .pghead {
    position: static;
    margin: 0 0 14px;
    padding: 0;
    box-shadow: none;
  }
}/* Configurações › Relatório semanal */
.relok {
  color: var(--ok);
  margin: 0;
}
.relform {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.relchk {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
}
.relchk input {
  accent-color: var(--scrum);
}
.relhor {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.relh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 6px;
}
.relh select,
.relh input,
.rellink input,
.rellink textarea {
  font: inherit;
  font-size: 13px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 5px 7px;
}
.relger {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.relger .relsel {
  font-size: 12px;
  color: var(--muted);
}
.relger .rellink {
  margin-top: 6px;
  font-weight: 500;
}
.rellink textarea {
  resize: vertical;
  font-weight: 400;
}
.relger legend {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  padding: 0 4px;
}
.rellink {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--muted);
  max-width: 420px;
}
.reldest {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.reldest h4 {
  margin: 0 0 6px;
  font-size: 13px;
}
.reldest ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.relacts {
  justify-content: flex-start;
  margin-top: 12px;
}
iframe.relframe {
  width: 100%;
  height: 62vh;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f3f5f7;
}/* situação: fora do prazo contratual (prazo + aditivos expirado) */
.sinal.fora {
  background: #B0304A;
}
.bstack i.fora {
  background: #B0304A;
}
.chip.fora {
  background: color-mix(in srgb, #B0304A 22%, transparent);
  color: #B0304A;
}
/* atraso administrativo: desde quando e períodos anteriores */
.admdesde {
  grid-column: 1 / -1;
  max-width: 260px;
}
.admbox {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admlist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.admr {
  display: grid;
  grid-template-columns: 150px auto 150px 70px minmax(0, 1fr) 28px;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
}
.admd {
  color: var(--muted);
  text-align: right;
}
.admm {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admmot small {
  color: var(--muted);
  font-weight: 400;
}/* atrasos administrativos: lista (motivo, desde, até) */
.admh,
.admbox .admr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 140px 140px 56px 74px 28px;
  gap: 6px;
  align-items: center;
}
.admh {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.admbox .admr input {
  min-width: 0;
}
.admst {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
}
.admr.aberto .admst {
  color: #8e9cf0;
}
@media (max-width: 760px) {
  .admh {
    display: none;
  }
  .admbox .admr {
    grid-template-columns: 1fr 1fr;
  }
}
/* ---------- Novo projeto: assistente em passos com a prévia da estrutura ---------- */
#dlgNovo {
  width: min(1080px, calc(100vw - 24px));
}
#dlgNovo h3 {
  margin-bottom: 10px;
}
.npsteps {
  display: flex;
  gap: 4px;
  margin: 0 0 14px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.npsteps button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.npsteps button i {
  font-style: normal;
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--line);
  font-size: 11px;
}
.npsteps button.on {
  color: var(--ink);
  border-bottom-color: var(--scrum);
  font-weight: 600;
}
.npsteps button.on i,
.npsteps button.ok i {
  background: var(--scrum);
  border-color: var(--scrum);
  color: var(--surface);
}
.nppane .sgrid {
  margin: 0;
}
.nppane textarea {
  width: 100%;
  resize: vertical;
}
.npcalc {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  align-items: baseline;
  margin-top: 10px;
  font-size: 13px;
  color: var(--muted);
}
.npcalc > b {
  font-size: 16px;
  color: var(--ink);
}
.npd input[readonly] {
  border-color: transparent;
  background: transparent;
  color: var(--muted);
  pointer-events: none;
}
.npmod {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 12px;
}
.npmod label {
  display: grid;
  gap: 4px;
  font-size: 12.5px;
  color: var(--muted);
}
.npmod select {
  min-width: min(420px, 80vw);
}
.npmod input {
  width: 110px;
}
.npresg {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px 18px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-bottom: 12px;
  font-size: 13px;
}
.npresg div {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.npresg span {
  color: var(--muted);
  font-size: 11.5px;
}
.npresg b {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.nptree {
  max-height: min(48vh, 520px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 6px 12px 10px;
}
.nptot {
  font-size: 12.5px;
  color: var(--muted);
  margin: 6px 0 8px;
}
.nptree details > summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  cursor: pointer;
  list-style: none;
}
.nptree details > summary::-webkit-details-marker {
  display: none;
}
.nptree details > summary::before {
  content: "›";
  display: inline-block;
  width: 12px;
  color: var(--muted);
  transition: transform 0.15s;
}
.nptree details[open] > summary::before {
  transform: rotate(90deg);
}
.nptree summary b {
  flex: 1;
}
.nptree summary span {
  color: var(--muted);
  font-size: 12.5px;
  white-space: nowrap;
}
.npgr {
  border-bottom: 1px solid var(--line);
}
.npgr:last-child {
  border-bottom: 0;
}
.npet {
  margin-left: 14px;
}
.npet summary b {
  font-weight: 600;
  font-size: 13px;
}
.nppt {
  margin: 6px 0 2px 14px;
  font-size: 12px;
  color: var(--muted);
}
.nplist {
  list-style: none;
  margin: 0 0 8px 14px;
  padding: 0;
  font-size: 12.5px;
}
.nplist li {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0 2px calc(var(--nv, 0) * 16px);
}
.nplist li.npg {
  font-weight: 600;
  padding-top: 5px;
}
.npcod {
  color: var(--muted);
  font-size: 11px;
  min-width: 92px;
  font-variant-numeric: tabular-nums;
}
.nplist small {
  margin-left: auto;
  color: var(--muted);
  white-space: nowrap;
}
#dlgNovo .actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
#dlgNovo .npesp {
  flex: 1;
}
#dlgNovo [hidden] {
  display: none !important;
}
@media (max-width: 640px) {
  .npcod {
    display: none;
  }
  .nplist small {
    display: none;
  }
}
.npmod input,
.nppane textarea {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 9px;
  background: var(--surface);
  font: inherit;
  font-size: 14px;
  color: var(--ink);
}
.npmod input:focus,
.nppane textarea:focus {
  border-color: var(--scrum);
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--scrum) 25%, transparent);
}
/* assistente: pontos da implantação (estrutura, energia e link) */
.nppts {
  margin-bottom: 12px;
}
.nppt-box {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 4px 12px 10px;
}
.nppt-box > summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  cursor: pointer;
}
.nppt-box > summary span {
  color: var(--muted);
  font-size: 12.5px;
}
.nppt-t {
  max-height: 300px;
  overflow: auto;
}
.nppt-h,
.nppt-r {
  display: grid;
  grid-template-columns: minmax(140px, 1.3fr) repeat(3, minmax(130px, 1fr));
  gap: 8px;
  align-items: center;
  padding: 3px 0;
}
.nppt-h {
  font-size: 11.5px;
  color: var(--muted);
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}
.nppt-r.todos {
  border-bottom: 1px dashed var(--line);
  padding-bottom: 7px;
  margin-bottom: 3px;
}
.nppt-r input,
.nppt-r select {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
@media (max-width: 720px) {
  .nppt-h {
    display: none;
  }
  .nppt-r {
    grid-template-columns: 1fr 1fr;
  }
}
.revimp .riAtual {
  font-size: 11.5px;
  color: var(--muted);
}
.ctltb thead th.pn2 {
  border-bottom: 1px solid var(--line);
  vertical-align: bottom;
}

/* medição dos itens por ponto */
.mpscroll {
  max-height: min(60vh, 560px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 10px 0 4px;
}
.mptb {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  min-width: 100%;
}
.mptb th,
.mptb td {
  padding: 4px 6px;
  border-bottom: 1px solid var(--line);
  white-space: nowrap;
}
.mptb thead th {
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 2;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  text-align: right;
  vertical-align: bottom;
  max-width: 130px;
  white-space: normal;
}
.mptb thead th small {
  display: block;
  font-weight: 400;
}
.mptb tfoot td {
  position: sticky;
  bottom: 0;
  background: var(--surface);
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mptb tfoot td.over {
  color: var(--alert);
}
.mptb .mpn {
  position: sticky;
  left: 0;
  background: var(--surface);
  z-index: 1;
  text-align: left;
  min-width: 150px;
}
.mptb thead .mpn {
  z-index: 3;
}
.mptb .mpn small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
.mptb input {
  width: 76px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 6px;
  background: var(--bg);
  color: var(--ink);
  text-align: right;
  font-size: 13px;
}
.mptb input::placeholder {
  color: var(--muted);
  opacity: 0.7;
}
.mptb .mpv {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
#formItens .actions .sp {
  flex: 1;
}
/* legenda do gráfico de recorrência */
.legend span > i {
  display: inline-block;
  width: 12px;
  height: 10px;
  border-radius: 2px;
}
.legend span > i.ln {
  width: 22px;
  height: 0;
  border-radius: 0;
  border-top: 2px dashed;
}
/* enquanto os dados do projeto carregam, o cabeçalho (nome, revisão, abas) fica oculto */
:where([data-implbody]).carregando .pgproj {
  display: none;
}
/* durante o carregamento (projeto, carteira, PMO): sem o botão do assistente */
:where([data-implbody]).carregando #iaFab {
  display: none;
}
/* revisão: escolha entre alterar o início ou o fim */
.revimp .riRef select {
  width: 100%;
}
/* Controladoria: linhas de grupo (Aquisição / Locação) mais destacadas */
.ctltb tr.pgrp:not(.nrec) td {
  background: color-mix(in srgb, var(--wf) 14%, var(--surface));
  font-weight: 800;
  font-size: 14px;
  border-top: 2px solid color-mix(in srgb, var(--wf) 55%, transparent);
  padding-top: 11px;
  padding-bottom: 11px;
}
.ctltb tr.pgrp:not(.nrec) td.pn2 {
  box-shadow: inset 4px 0 0 var(--wf);
  color: var(--ink);
}
.ctltb tr.pgrp:not(.nrec) td.pn2 .mut {
  font-weight: 600;
}
.ccard .cdif {
  display: block;
  font-size: 13.5px;
  font-weight: 700;
  margin: 2px 0 4px;
}
/* grupos da Controladoria em negrito e maiúsculas (inclusive a contagem e os valores) */
.ctltb tr.pgrp:not(.nrec) td,
.ctltb tr.pgrp:not(.nrec) td .mut {
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.ctltb tr.pgrp:not(.nrec) td .mut {
  color: inherit;
}
/* grupos da Controladoria: fundo neutro (o verde fica só para a recorrência) */
.ctltb tr.pgrp:not(.nrec) td {
  background: color-mix(in srgb, var(--ink) 9%, var(--surface));
  border-top: 2px solid var(--line-strong);
}
.ctltb tr.pgrp:not(.nrec) td.pn2 {
  box-shadow: inset 4px 0 0 var(--line-strong);
}
/* grupos da Controladoria com a mesma cor da linha "Físico x financeiro" */
.ctltb tr.pgrp:not(.nrec) td {
  background: color-mix(in srgb, var(--scrum) 16%, var(--surface));
  border-top: 2px solid color-mix(in srgb, var(--scrum) 45%, transparent);
}
.ctltb tr.pgrp:not(.nrec) td.pn2 {
  box-shadow: inset 4px 0 0 var(--scrum);
}
/* linhas de projeto: valores com a mesma cor da coluna Projeto (sem o tom do mês vigente) */
.ctltb tbody tr:not(.ptot):not(.pgrp):not(.nrec) td.inr {
  background: transparent;
}
/* ações do projeto dentro dos pontos de atenção */
.alp .alsub {
  font-size: 13px;
  margin: 14px 0 6px;
  color: var(--muted);
  font-weight: 650;
}
.alp .alsub small {
  font-weight: 500;
}

/* faturamento com atraso (controladoria) */
.ctltb td .atrm { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; margin-right: 2px; opacity: .9; }

/* login: logo com o ícone do site */
.lglogo.lgimg { width: 44px; height: 44px; background: none; border-radius: 10px; overflow: hidden; }
.lglogo.lgimg img { width: 44px; height: 44px; display: block; }
.lglogo.lgimg { flex-shrink: 0; }
.lgmarca h1 { line-height: 1.2; }
/* login: fundo em malha (desenhado em js/login.js) e caixa translúcida por cima */
:where([data-implbody]).loginpg { background: #020a16; position: relative; overflow-x: hidden; }
#lgFundo { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; }
:where([data-implbody]).loginpg .lgbox {
  position: relative;
  z-index: 1;
  background: rgba(6, 16, 30, 0.78);
  border-color: rgba(90, 170, 255, 0.18);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}
.lgmarca.lgcentro { justify-content: center; text-align: center; }
.iasug[hidden] { display: none !important; }
/* altura automática das caixas de texto pelo navegador (evita medir o layout a cada tela) */
@supports (field-sizing: content) {
  textarea.obs, textarea.srin { field-sizing: content; max-height: 400px; }
}

/* programação de e-mails: um painel por tipo de envio */
.relform > .panel { margin: 0; }
.reltipo { display: flex; flex-direction: column; gap: 12px; }
.reltipo > .hint { margin: -4px 0 0; }
.relnota { margin: 0; }
.relcols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
.relpptx { display: none; font-size: 12px; color: var(--muted); }
.relpp .relpptx { display: inline; }
.relpp { opacity: 0.85; }
.relproj { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow: auto; padding-right: 4px; }
.rellink select { font: inherit; font-size: 13px; font-weight: 400; color: var(--ink); background: var(--surface); border: 1px solid var(--line-strong); border-radius: 6px; padding: 5px 7px; }
.reltipo .rellink { max-width: 560px; }
.relquem { font-size: 13px; line-height: 1.5; padding: 8px 10px; border-radius: 8px; background: var(--surface-2, rgba(127, 127, 127, 0.08)); }
.reldet summary { cursor: pointer; font-size: 13px; }
.relaviso { color: var(--warn, #b9770e); }
.relcliul { margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; line-height: 1.6; }
.relsub { margin: 4px 0 -4px; font-size: 13.5px; }

/* Controladoria: aviso de faturamento atrasado (mesmo com diferença positiva) */
.ctlaviso {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  margin: 0 0 12px;
  padding: 10px 14px;
  border: 1px solid var(--mk);
  border-left-width: 4px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--mk) 10%, var(--surface));
  color: var(--ink);
  font-size: 13px;
  line-height: 1.45;
}
.ctlaviso > b {
  color: var(--mk);
}

/* E-mails: recorrência de cada envio */
.relrec {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: flex-end;
  margin: 8px 0 12px;
}
.relrec label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: var(--muted, #5c6b7a);
}
.relrec .relrecdias {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding-bottom: 6px;
}
.relrec .relrecdias label {
  flex-direction: row;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--ink);
}
.relrec input[type="number"] {
  width: 80px;
}

/* ==========================================================
   PORTAL DGT — tema e layout do painel dentro do portal
   (acrescentado por pages/Implantacoes; vale sobre o CSS original)
   Paleta do portal: azul-marinho #063654, azul #0878d1,
   ciano #11c9df, fundo #f5f8fb, texto #102a43, apoio #5e7185.
   ========================================================== */
:host {
  display: block;
  /* contexto próprio de camadas: nada do painel passa por cima do cabeçalho do portal */
  position: relative;
  z-index: 0;
  isolation: isolate;
  color-scheme: light;
  padding: 0;
  --bg: #f5f8fb;
  --surface: #ffffff;
  --ink: #102a43;
  --muted: #5e7185;
  --line: #dce4ea;
  --line-strong: #b9c8d6;
  --scrum: #0878d1;
  --scrum-soft: #e3f0fb;
  --wf: #0a8ea4;
  --wf-soft: #dff6fa;
  --base: #8a99a8;
  --alert: #c0392b;
  --alert-soft: #fbe5e2;
  --ok: #2e7d4f;
  --ok-soft: #dcefe3;
  --focus: #0878d1;
  --t-head: #063654;
  --t-head-ink: #ffffff;
  --t-proj: #0b5a8f;
  --t-proj-ink: #ffffff;
  --t-l1: #e6f0f8;
  --t-l2: #f2f7fb;
  --t-row: #ffffff;
  --t-hover: #f4f9fd;
  --t-grid: #dce4ea;
  --prog: #0878d1;
  --prog-track: #dcebf7;
  --mk: #c08a2e;
  --late: #c0392b;
  --dgt-navy: #063654;
  --dgt-blue: #0878d1;
  --dgt-blue-2: #075b96;
  --dgt-cyan: #11c9df;
}

/* "body" do painel: no fluxo da página do portal (sem altura de janela) */
:where([data-implbody]) {
  position: relative;
  margin: 0;
  min-height: 0;
  background: var(--bg);
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 14.5px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: clip;
}
.shell {
  min-height: 0;
}
/* lista de projetos: acompanha a rolagem da página.
   --impl-left / --impl-top: posição do painel na janela, mantidas por
   AmbientePainel.ts (a lista aberta fica sobre o painel, não sobre o menu do portal). */
.side {
  position: sticky;
  top: 0;
  align-self: start;
  height: auto;
  max-height: 100vh;
  background: #ffffff;
  border-right: 0;
}
@media (min-width: 901px) {
  /* coluna do trilho em toda a altura do painel */
  .shell {
    background: linear-gradient(to right, #ffffff 0 64px, var(--line) 64px 65px, transparent 65px);
  }
  :where([data-implbody]).sidefixa .shell {
    background: linear-gradient(to right, #ffffff 0 320px, var(--line) 320px 321px, transparent 321px);
  }
  .side.aberta {
    position: fixed;
    left: var(--impl-left, 0px);
    top: var(--impl-top, 0px);
    height: calc(100vh - var(--impl-top, 0px));
    max-height: none;
    box-shadow: 10px 0 30px rgba(6, 54, 84, 0.18);
  }
  :where([data-implbody]).sidefixa .side.aberta {
    position: sticky;
    left: auto;
    top: 0;
    height: auto;
    max-height: 100vh;
    box-shadow: none;
  }
}
/* botão do assistente: alinhado ao cabeçalho do painel (que fica fixo no
   topo ao rolar), dentro da área do painel — não no canto da janela */
.iafab {
  top: calc(var(--impl-top, 0px) + 45px);
  right: calc(var(--impl-right, 0px) + 24px);
}
:where([data-implbody]).cart .iafab {
  top: calc(var(--impl-top, 0px) + 36px);
}

/* cores do portal: botões, abas e seleção */
.btn:hover {
  border-color: var(--dgt-blue);
  color: var(--dgt-blue);
}
.btn.primary {
  background: var(--dgt-blue);
  border-color: var(--dgt-blue);
  color: #ffffff;
}
.btn.primary:hover {
  background: var(--dgt-blue-2);
  border-color: var(--dgt-blue-2);
  color: #ffffff;
}
.iafab {
  color: var(--dgt-blue);
}
.iafab:hover {
  border-color: var(--dgt-blue);
}
:focus-visible {
  outline-color: var(--dgt-cyan);
}
::selection {
  background: #cdeaf7;
}

/* cabeçalho: espaço para os dois botões do canto (assistente e tela cheia) */
header.top {
  padding-right: 96px;
}
@media (max-width: 640px) {
  header.top {
    padding-right: 0;
  }
}
/* botão de tela cheia: no canto do cabeçalho; o assistente fica ao lado dele */
.implfs {
  position: fixed;
  z-index: 60;
  top: calc(var(--impl-top, 0px) + 45px);
  right: calc(var(--impl-right, 0px) + 24px);
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--dgt-blue);
  display: grid;
  place-items: center;
  cursor: pointer;
}
:where([data-implbody]).cart .implfs {
  top: calc(var(--impl-top, 0px) + 36px);
  width: 34px;
  height: 34px;
}
.implfs:hover {
  border-color: var(--dgt-blue);
  background: var(--scrum-soft);
}
.iafab {
  right: calc(var(--impl-right, 0px) + 68px);
}
:where([data-implbody]).cart .iafab {
  right: calc(var(--impl-right, 0px) + 66px);
}
/* em tela cheia: o painel ocupa a tela e rola sozinho */
:host(:fullscreen) {
  overflow-y: auto;
  background: var(--bg);
}
:host(:fullscreen) :where([data-implbody]) {
  border: 0;
  border-radius: 0;
  min-height: 100%;
}
`;
