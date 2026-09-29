import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DiagnosticoConexaoService,
  IPassoTeste,
  IResultadoTesteConexao,
  passosParaTexto
} from '../../services/DiagnosticoConexaoService';

import {
  diagnosticarErro,
  IDiagnosticoErro,
  montarRelatorioTecnico,
  registrarDiagnosticoNoConsole
} from '../../utils/diagnosticoDataverse';

// ============================================================
// PAINEL DE DIAGNÓSTICO DE ACESSO
//   • explica o erro em português e diz quem resolve;
//   • executa o teste de conexão passo a passo;
//   • copia um relatório completo para o suporte.
//
// modo "completo" → tela de acesso restrito
// modo "compacto" → faixa no topo do Início
// ============================================================

export interface IDiagnosticoAcessoPanelProps {
  erro: string;
  email?: string;
  pagina?: string;
  dataverseService?: DataverseService;
  modo?: 'completo' | 'compacto';
  onTentarNovamente?: () => void;
}

const COR_AZUL = '#202A44';

const ESTILO_STATUS: Record<IPassoTeste['status'], { icone: string; cor: string; fundo: string; rotulo: string }> = {
  ok: { icone: '✓', cor: '#107C10', fundo: '#E7F6EC', rotulo: 'OK' },
  aviso: { icone: '!', cor: '#B45309', fundo: '#FFF4E5', rotulo: 'Aviso' },
  erro: { icone: '✕', cor: '#B42318', fundo: '#FDE7E9', rotulo: 'Erro' },
  ignorado: { icone: '–', cor: '#94A3B8', fundo: '#F1F5F9', rotulo: '—' }
};

const botao = (
  primario: boolean
): React.CSSProperties => ({
  padding: '9px 14px',
  border: primario ? 0 : '1px solid #CBD5E1',
  borderRadius: '8px',
  background: primario ? COR_AZUL : '#FFFFFF',
  color: primario ? '#FFFFFF' : COR_AZUL,
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer'
});

const copiarTexto = async (
  texto: string
): Promise<boolean> => {

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // tenta o método antigo abaixo
  }

  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};

const DiagnosticoAcessoPanel:
  React.FC<IDiagnosticoAcessoPanelProps> = ({
    erro,
    email,
    pagina,
    dataverseService,
    modo = 'completo',
    onTentarNovamente
  }) => {

    const diagnosticoInicial =
      React.useMemo(
        () => diagnosticarErro(erro),
        [erro]
      );

    const [resultado, setResultado] =
      React.useState<IResultadoTesteConexao | undefined>(undefined);

    const [passos, setPassos] =
      React.useState<IPassoTeste[]>([]);

    const [testando, setTestando] =
      React.useState(false);

    const [mostrarTecnico, setMostrarTecnico] =
      React.useState(false);

    const [expandido, setExpandido] =
      React.useState(modo === 'completo');

    const [mensagemCopia, setMensagemCopia] =
      React.useState('');

    // Após o teste, o diagnóstico mais preciso é o do passo que falhou.
    const diagnostico: IDiagnosticoErro =
      resultado?.diagnosticoPrincipal ||
      diagnosticoInicial;

    const ambienteUrl =
      dataverseService
        ? dataverseService.urlApi.replace(/\/api\/data\/v[\d.]+\/?$/, '')
        : undefined;

    React.useEffect(
      () => {
        registrarDiagnosticoNoConsole(
          diagnosticoInicial,
          { email, ambienteUrl, pagina }
        );
      },
      [
        diagnosticoInicial
      ]
    );

    const executarTeste = (): void => {

      if (!dataverseService) {
        return;
      }

      setTestando(true);
      setResultado(undefined);
      setExpandido(true);

      new DiagnosticoConexaoService(
        dataverseService,
        email || ''
      )
        .executar(setPassos)
        .then(
          retorno => {
            setResultado(retorno);
            setPassos(retorno.passos);

            if (retorno.diagnosticoPrincipal) {
              registrarDiagnosticoNoConsole(
                retorno.diagnosticoPrincipal,
                { email, ambienteUrl, pagina }
              );
            }
          }
        )
        .catch(
          (error: unknown) => console.error(error)
        )
        .then(
          () => setTestando(false),
          () => setTestando(false)
        );
    };

    const copiarRelatorio = (): void => {

      const relatorio =
        montarRelatorioTecnico(
          diagnostico,
          {
            email,
            ambienteUrl,
            pagina,
            linhasExtras:
              passos.length > 0
                ? [
                  ...passosParaTexto(passos),
                  resultado ? `Conclusão: ${resultado.conclusao}` : ''
                ]
                : ['Teste de conexão: não executado.']
          }
        );

      copiarTexto(relatorio)
        .then(
          ok => {
            setMensagemCopia(
              ok
                ? 'Relatório copiado. Cole no e-mail ou chamado para o suporte.'
                : 'Não foi possível copiar automaticamente. Abra os detalhes técnicos e copie manualmente.'
            );

            if (!ok) {
              setMostrarTecnico(true);
            }

            window.setTimeout(() => setMensagemCopia(''), 6000);
          }
        )
        .catch(
          (error: unknown) => console.error(error)
        );
    };

    const corOrigem =
      diagnostico.origem === 'Portal DGT'
        ? '#485CC7'
        : diagnostico.origem === 'Entra ID'
          ? '#0F6CBD'
          : '#B42318';

    // ==========================================================
    // COMPACTO (faixa no Início)
    // ==========================================================

    if (modo === 'compacto' && !expandido) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#FFF4E5',
            border: '1px solid #F5C77E',
            color: '#7A4B00'
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
            <strong>⚠ {diagnostico.titulo}.</strong>{' '}
            Treinamentos e documentos não puderam ser carregados. A agenda continua disponível.
          </div>

          <button
            type="button"
            onClick={() => setExpandido(true)}
            style={botao(false)}
          >
            Ver diagnóstico
          </button>
        </div>
      );
    }

    // ==========================================================
    // COMPLETO
    // ==========================================================

    return (
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          margin: modo === 'compacto' ? '0 0 16px' : '0 auto',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          overflow: 'hidden',
          textAlign: 'left',
          boxShadow: '0 4px 16px rgba(15,35,55,.06)'
        }}
      >
        {/* CABEÇALHO */}

        <div
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
            padding: '20px 22px',
            borderBottom: '1px solid #EDF1F5'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              minWidth: '46px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FDE7E9',
              fontSize: '22px'
            }}
          >
            🔒
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: corOrigem,
                  color: '#FFFFFF',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '.4px'
                }}
                title="Onde o bloqueio aconteceu"
              >
                Origem: {diagnostico.origem}
              </span>

              {
                (diagnostico.status || diagnostico.codigo) &&
                (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: '#F1F5F9',
                      color: '#475569',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      fontFamily: 'Consolas, monospace'
                    }}
                  >
                    {diagnostico.status ? `HTTP ${diagnostico.status}` : ''}
                    {diagnostico.status && diagnostico.codigo ? ' · ' : ''}
                    {diagnostico.codigo || ''}
                  </span>
                )
              }
            </div>

            <h2 style={{ margin: 0, color: '#0A2845', fontSize: '18px' }}>
              {diagnostico.titulo}
            </h2>

            <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '13px', lineHeight: 1.55 }}>
              {diagnostico.explicacao}
            </p>

            <p style={{ margin: '8px 0 0', color: '#334155', fontSize: '12.5px' }}>
              <strong>Quem resolve:</strong> {diagnostico.responsavel}
            </p>
          </div>

          {
            modo === 'compacto' &&
            (
              <button
                type="button"
                onClick={() => setExpandido(false)}
                style={{ ...botao(false), padding: '5px 10px' }}
                title="Recolher"
              >
                ▴
              </button>
            )
          }
        </div>

        {/* COMO RESOLVER */}

        <div style={{ padding: '16px 22px', borderBottom: '1px solid #EDF1F5' }}>
          <strong style={{ display: 'block', marginBottom: '8px', color: COR_AZUL, fontSize: '13px' }}>
            Como resolver
          </strong>

          <ol style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '12.5px', lineHeight: 1.6 }}>
            {diagnostico.passos.map(passo => (
              <li key={passo}>{passo}</li>
            ))}
          </ol>
        </div>

        {/* TESTE DE CONEXÃO */}

        <div style={{ padding: '16px 22px', borderBottom: '1px solid #EDF1F5' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ display: 'block', color: COR_AZUL, fontSize: '13px' }}>
                Teste de conexão
              </strong>
              <span style={{ color: '#64748B', fontSize: '12px' }}>
                Verifica, passo a passo, onde está o bloqueio (Dataverse, permissões ou cadastro do portal).
              </span>
            </div>

            <button
              type="button"
              onClick={executarTeste}
              disabled={testando || !dataverseService}
              style={{
                ...botao(true),
                opacity: testando || !dataverseService ? 0.6 : 1,
                cursor: testando || !dataverseService ? 'not-allowed' : 'pointer'
              }}
            >
              {testando ? 'Testando...' : passos.length > 0 ? '↻ Testar novamente' : '▶ Executar teste de conexão'}
            </button>
          </div>

          {
            passos.length > 0 &&
            (
              <ol style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: '6px' }}>
                {passos.map((passo, indice) => {
                  const estilo = ESTILO_STATUS[passo.status];
                  const aguardando = testando && passo.detalhe === 'Aguardando...';

                  return (
                    <li
                      key={passo.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '26px 1fr auto',
                        gap: '10px',
                        alignItems: 'start',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: estilo.fundo
                      }}
                    >
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#FFFFFF',
                          border: `2px solid ${estilo.cor}`,
                          color: estilo.cor,
                          fontSize: '11px',
                          fontWeight: 900
                        }}
                      >
                        {aguardando ? indice + 1 : estilo.icone}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: '#1F2937', fontSize: '12.5px' }}>
                          {passo.nome}
                        </strong>
                        <span style={{ display: 'block', color: '#475569', fontSize: '12px', lineHeight: 1.45, wordBreak: 'break-word' }}>
                          {aguardando ? 'Aguardando...' : passo.detalhe}
                          {passo.diagnostico?.codigo ? ` (${passo.diagnostico.codigo})` : ''}
                        </span>
                      </div>

                      <span style={{ color: estilo.cor, fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {aguardando ? '' : estilo.rotulo}
                        {passo.duracaoMs !== undefined ? ` · ${passo.duracaoMs}ms` : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )
          }

          {
            resultado &&
            (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: resultado.diagnosticoPrincipal ? '#FDE7E9' : '#E7F6EC',
                  color: resultado.diagnosticoPrincipal ? '#8A1C1C' : '#0B5A0B',
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                {resultado.conclusao}
                {
                  !resultado.diagnosticoPrincipal && onTentarNovamente &&
                  (
                    <button
                      type="button"
                      onClick={onTentarNovamente}
                      style={{ ...botao(true), marginLeft: '10px', padding: '5px 10px' }}
                    >
                      Recarregar permissões
                    </button>
                  )
                }
              </div>
            )
          }
        </div>

        {/* AÇÕES + DETALHES TÉCNICOS */}

        <div style={{ padding: '14px 22px 18px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={copiarRelatorio} style={botao(false)}>
              📋 Copiar relatório para o suporte
            </button>

            <button type="button" onClick={() => setMostrarTecnico(!mostrarTecnico)} style={botao(false)}>
              {mostrarTecnico ? 'Ocultar detalhes técnicos' : 'Ver detalhes técnicos'}
            </button>

            {
              onTentarNovamente &&
              (
                <button type="button" onClick={onTentarNovamente} style={botao(false)}>
                  ↻ Tentar novamente
                </button>
              )
            }

            {
              mensagemCopia &&
              (
                <span style={{ color: '#107C10', fontSize: '12px', fontWeight: 700 }}>
                  {mensagemCopia}
                </span>
              )
            }
          </div>

          {
            mostrarTecnico &&
            (
              <pre
                style={{
                  margin: '12px 0 0',
                  padding: '12px',
                  maxHeight: '260px',
                  overflow: 'auto',
                  borderRadius: '8px',
                  background: '#0F172A',
                  color: '#E2E8F0',
                  fontSize: '11.5px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {montarRelatorioTecnico(
                  diagnostico,
                  {
                    email,
                    ambienteUrl,
                    pagina,
                    linhasExtras: passos.length > 0 ? passosParaTexto(passos) : undefined
                  }
                )}
              </pre>
            )
          }
        </div>
      </div>
    );
  };

export default DiagnosticoAcessoPanel;
