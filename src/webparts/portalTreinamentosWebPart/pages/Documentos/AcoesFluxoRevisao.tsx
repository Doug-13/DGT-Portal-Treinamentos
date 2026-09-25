import * as React from 'react';

import {
  IDocumentoRevisao
} from '../../models/Documento';

import {
  estagioRevisao
} from '../../services/DocumentoRevisaoFluxoService';

const COR_AZUL = '#202A44';
const COR_INDIGO = '#485CC7';

const botaoAcaoBase:
  React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  color: '#1F2937',
  fontSize: '12.5px',
  fontWeight: 700
};

// ============================================================
// AÇÕES DO FLUXO DE UMA REVISÃO
// ============================================================

const AcoesFluxoRevisao:
  React.FC<{
    revisao: IDocumentoRevisao;
    processando: boolean;
    podeAprovar: boolean;
    podeEditar: boolean;
    onEditar: () => void;
    onEnviarAprovacao: () => void;
    onIrParaElaboracao: () => void;
    onAbrirPublicar: () => void;
    onAbrirReprovar: () => void;
  }> = ({
    revisao,
    processando,
    podeAprovar,
    podeEditar,
    onEditar,
    onEnviarAprovacao,
    onIrParaElaboracao,
    onAbrirPublicar,
    onAbrirReprovar
  }) => {

    const estagio =
      estagioRevisao(
        revisao.status
      );

    const botaoAcao:
      React.CSSProperties = {
      ...botaoAcaoBase,
      cursor:
        processando
          ? 'not-allowed'
          : 'pointer'
    };

    if (estagio === 'vigente') {
      return null;
    }

    const semArquivo =
      !revisao.arquivoUrl;

    return (
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        {
          // ELABORAÇÃO: é aqui que a revisão é editada. Só depois de
          // pronta ela vai para o Gestor avaliar.
          estagio === 'elaboracao' &&
          (
            podeEditar
              ? (
                <>
                  <button
                    type="button"
                    disabled={processando}
                    style={{
                      ...botaoAcao,
                      border: `1px solid ${COR_AZUL}`,
                      color: COR_AZUL
                    }}
                    onClick={onEditar}
                  >
                    ✎ Editar revisão
                  </button>

                  <button
                    type="button"
                    disabled={processando || semArquivo}
                    title={
                      semArquivo
                        ? 'Anexe o arquivo da revisão em "Editar revisão" antes de enviar.'
                        : undefined
                    }
                    style={{
                      ...botaoAcao,
                      border: 0,
                      background: semArquivo ? '#CBD5E1' : COR_AZUL,
                      color: '#FFFFFF',
                      cursor: processando || semArquivo ? 'not-allowed' : 'pointer'
                    }}
                    onClick={onEnviarAprovacao}
                  >
                    Enviar para aprovação do Gestor →
                  </button>

                  {
                    semArquivo &&
                    (
                      <span
                        style={{
                          color: '#B45309',
                          fontSize: '12px'
                        }}
                      >
                        Anexe o arquivo para poder enviar.
                      </span>
                    )
                  }
                </>
              )
              : (
                <span
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: '#E8EAF8',
                    color: COR_INDIGO,
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  Revisão em elaboração pelo responsável do documento
                </span>
              )
          )
        }

        {
          // APROVAÇÃO: o Gestor decide. Aprovado → Vigente.
          // Reprovado → volta para Elaboração com o motivo registrado.
          estagio === 'aprovacao' &&
          (
            podeAprovar
              ? (
                <>
                  <button
                    type="button"
                    disabled={processando}
                    style={{
                      ...botaoAcao,
                      border: 0,
                      background: '#0E9F6E',
                      color: '#FFFFFF'
                    }}
                    onClick={onAbrirPublicar}
                  >
                    ✓ Aprovar
                  </button>

                  <button
                    type="button"
                    disabled={processando}
                    style={{
                      ...botaoAcao,
                      border: 0,
                      background: '#D92D20',
                      color: '#FFFFFF'
                    }}
                    onClick={onAbrirReprovar}
                  >
                    ✕ Reprovar
                  </button>
                </>
              )
              : (
                <span
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: '#FFF4E5',
                    color: '#B45309',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                  title="Somente o Gestor da área (ou um Administrador) pode aprovar este documento."
                >
                  Aguardando aprovação do Gestor da área
                </span>
              )
          )
        }

        {
          // Compatibilidade com revisões antigas no status "Revisão".
          estagio === 'revisao' && podeEditar && (
            <button
              type="button"
              disabled={processando}
              style={botaoAcao}
              onClick={onIrParaElaboracao}
            >
              Ir para elaboração
            </button>
          )
        }
      </div>
    );
  };


export default AcoesFluxoRevisao;
