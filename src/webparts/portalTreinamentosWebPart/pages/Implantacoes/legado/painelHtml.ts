/* eslint-disable */
// Estrutura da página do Painel de implantações (origem: painel-projetos/index.html, sem scripts).
export const PAINEL_HTML: string = `
    <div class="shell">
      <aside class="side" id="side" aria-label="Projetos"></aside>
      <div class="wrap">
        <div class="pghead pgproj">
        <header class="top">
          <div class="title-block">
            <input
              id="projName"
              aria-label="Nome do projeto"
              value="Projeto sem nome"
            />
            <p class="subtitle" id="subtitle">
              PMBOK híbrido: Scrum em iniciação, planejamento, controle e
              encerramento; cascata na execução.
            </p>
          </div>
          <div class="params">
            <div class="revbox">
              <span class="revlbl">Revisão do cronograma</span>
              <div class="revrow">
                <select
                  id="finRevSel"
                  aria-label="Revisão do cronograma"
                ></select
                ><button class="btn" id="btnNewRev" type="button">
                  Nova revisão</button
                ><button
                  class="btn ghost danger"
                  id="btnDelRev"
                  type="button"
                  title="Excluir a revisão selecionada"
                >
                  Excluir revisão
                </button>
              </div>
              <span id="revMot2" class="revmot"></span>
            </div>
            <span class="sync" id="sync" hidden
              ><i></i><span>Salvo neste navegador</span></span
            >
          </div>
        </header>
        <nav class="views" id="views" aria-label="Seções"></nav>
        </div>
        <main id="view"></main>
      </div>
    </div>
    <dialog id="dlgItem"><form method="dialog" id="formItem"></form></dialog>
    <dialog id="dlgImport">
      <form method="dialog" id="formImport"></form>
    </dialog>
    <dialog id="dlgStk" class="wide">
      <form method="dialog" id="formStk"></form>
    </dialog>
    <dialog id="dlgFat"><form method="dialog" id="formFat"></form></dialog>
    <dialog id="dlgPts"><form method="dialog" id="formPts"></form></dialog>
    <dialog
      id="dlgItens"
      class="wide"
      style="width: min(1180px, calc(100vw - 24px))"
    >
      <form method="dialog" id="formItens"></form>
    </dialog>
    <dialog id="dlgPmo" style="width: min(860px, calc(100vw - 24px))">
      <form method="dialog" id="formPmo"></form>
    </dialog>
    <dialog id="dlgAg" class="drawer" aria-label="Programação de campo">
      <form method="dialog" id="formAg"></form>
    </dialog>
    <dialog id="dlgCfg" class="cfgdlg">
      <form method="dialog" id="formCfg" novalidate></form>
    </dialog>
    <dialog id="dlgNovo" class="wide npdlg" aria-label="Novo projeto">
      <form method="dialog" id="formNovo" novalidate></form>
    </dialog>
    <dialog id="dlgConfirm" style="width: min(560px, calc(100vw - 24px))">
      <form method="dialog" id="formConfirm"></form>
    </dialog>
    <button
      id="iaFab"
      class="iafab"
      type="button"
      title="Assistente IA (Ctrl + Shift + A)"
      aria-label="Abrir o Assistente IA"
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path
          d="M8.5 3l1.4 3.6 3.6 1.4-3.6 1.4L8.5 13 7.1 9.4 3.5 8l3.6-1.4z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path
          d="M14.5 12l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <dialog id="dlgIa" class="drawer iadrawer" aria-label="Assistente IA">
      <div id="iaHost"></div>
    </dialog>
`;
