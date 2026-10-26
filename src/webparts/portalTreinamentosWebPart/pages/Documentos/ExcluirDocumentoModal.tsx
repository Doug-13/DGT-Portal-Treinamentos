import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import {
  DocumentoExclusaoService,
  IAnaliseExclusao,
  IResultadoExclusao
} from '../../services/DocumentoExclusaoService';

// ============================================================
// EXCLUIR DOCUMENTO (administrador) — libera o código
// ============================================================

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

export interface IExcluirDocumentoModalProps {
  servico: DocumentoExclusaoService;
  documento: IDocumento;
  revisoes: IDocumentoRevisao[];
  usuario: { id: string; nome: string };
  onCancelar: () => void;
  onExcluido: (resultado: IResultadoExclusao) => void;
}

const ExcluirDocumentoModal: React.FC<IExcluirDocumentoModalProps> = ({
  servico,
  documento,
  revisoes,
  usuario,
  onCancelar,
  onExcluido
}) => {

  const [analise, setAnalise] =
    React.useState<IAnaliseExclusao | undefined>(undefined);

  const [justificativa, setJustificativa] =
    React.useState<string>('');

  const [confirmacao, setConfirmacao] =
    React.useState<string>('');

  const [processando, setProcessando] =
    React.useState<boolean>(false);

  const [erro, setErro] =
    React.useState<string>('');

  React.useEffect(
    () => {
      let cancelado = false;
      servico.analisar(documento, revisoes)
        .then(resultado => { if (!cancelado) { setAnalise(resultado); } })
        .catch((error: unknown) => {
          console.error(error);
          if (!cancelado) {
            setErro(error instanceof Error ? error.message : 'Não foi possível verificar o documento.');
          }
        });
      return () => { cancelado = true; };
    },
    [servico, documento, revisoes]
  );

  const codigo =
    documento.codigo.trim().toUpperCase();

  const pode =
    !!analise &&
    analise.podeExcluir &&
    justificativa.trim().length >= 10 &&
    confirmacao.trim().toUpperCase() === codigo &&
    !processando;

  const excluir = (): void => {
    if (!pode) {
      return;
    }
    setProcessando(true);
    setErro('');
    servico.excluir(documento, revisoes, justificativa, usuario)
      .then(resultado => onExcluido(resultado))
      .catch((error: unknown) => {
        console.error(error);
        setErro(error instanceof Error ? error.message : 'Não foi possível excluir o documento.');
      })
      .then(() => setProcessando(false))
      .catch((error: unknown) => console.error(error));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Excluir documento"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '40px 20px',
        overflowY: 'auto',
        background: 'rgba(15,23,42,.55)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: '16px',
          color: COR_AZUL,
          fontSize: '13.5px',
          lineHeight: 1.5
        }}
      >
        <h2 style={{ margin: '0 0 6px', fontSize: '19px' }}>Excluir documento</h2>
        <div style={{ color: COR_TEXTO_2, marginBottom: '12px' }}>
          <strong style={{ color: COR_AZUL }}>{codigo}</strong> — {documento.titulo} · alterado por administrador
        </div>

        {
          !analise && !erro && (
            <div style={{ color: COR_TEXTO_2 }}>Verificando se o documento pode ser excluído...</div>
          )
        }

        {
          analise && !analise.podeExcluir && (
            <div role="alert" style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8' }}>
              <strong>Este documento não pode ser excluído.</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                {analise.motivos.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )
        }

        {
          analise && analise.podeExcluir && (
            <>
              <div style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_CIANO}`, background: '#E6F9FC' }}>
                O código <strong>{codigo}</strong> será <strong>liberado</strong> para um novo documento. Nada é apagado:
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                  <li>as revisões ficam canceladas e as pendências do fluxo somem;</li>
                  <li>os vínculos com processos são desativados;</li>
                  <li>o documento sai das listas e fica arquivado como <strong>{codigo}-EXC-…</strong>;</li>
                  <li>a pasta dos arquivos no SharePoint é renomeada do mesmo jeito;</li>
                  <li>o histórico registra quem excluiu, quando e por quê.</li>
                </ul>
              </div>

              {
                analise.avisos.length > 0 && (
                  <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: COR_INDIGO }}>
                    {analise.avisos.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )
              }

              <label htmlFor="excluir-justificativa" style={{ display: 'block', fontSize: '12px', fontWeight: 700, margin: '14px 0 4px' }}>
                Justificativa (obrigatória, mínimo 10 caracteres)
              </label>
              <textarea
                id="excluir-justificativa"
                rows={3}
                value={justificativa}
                onChange={evento => setJustificativa(evento.target.value)}
                placeholder="Ex.: documento criado em duplicidade; o correto é o ARQ-MAP-002."
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '8px 10px', fontFamily: 'inherit', fontSize: '13px', color: COR_AZUL }}
              />

              <label htmlFor="excluir-confirmacao" style={{ display: 'block', fontSize: '12px', fontWeight: 700, margin: '12px 0 4px' }}>
                Para confirmar, digite o código <strong>{codigo}</strong>
              </label>
              <input
                id="excluir-confirmacao"
                value={confirmacao}
                onChange={evento => setConfirmacao(evento.target.value)}
                autoComplete="off"
                style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: COR_AZUL }}
              />
            </>
          )
        }

        {
          erro && (
            <div role="alert" style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COR_INDIGO}`, background: '#E8EAF8' }}>
              {erro}
            </div>
          )
        }

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button
            type="button"
            disabled={processando}
            onClick={onCancelar}
            style={{ padding: '8px 14px', borderRadius: '6px', border: `1px solid ${COR_AZUL}`, background: '#FFFFFF', color: COR_AZUL, fontWeight: 700, cursor: processando ? 'not-allowed' : 'pointer' }}
          >
            {analise && !analise.podeExcluir ? 'Fechar' : 'Cancelar'}
          </button>
          {
            analise && analise.podeExcluir && (
              <button
                type="button"
                disabled={!pode}
                onClick={excluir}
                style={{ padding: '8px 14px', borderRadius: '6px', border: 0, background: pode ? COR_INDIGO : '#CBD5E1', color: '#FFFFFF', fontWeight: 700, cursor: pode ? 'pointer' : 'not-allowed' }}
              >
                {processando ? 'Excluindo...' : 'Excluir e liberar o código'}
              </button>
            )
          }
        </div>
      </div>
    </div>
  );
};

export default ExcluirDocumentoModal;
