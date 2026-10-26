import * as React from 'react';

import {
  IResultadoRetorno
} from '../../services/fluxo/FluxoEngine';

// ============================================================
// VOLTAR UMA ETAPA (somente administrador)
//
// Corrige um avanço indevido: a revisão volta UMA etapa, para onde
// estava imediatamente antes. A prévia (simulação do motor, nada
// gravado) mostra exatamente o que vai acontecer; a justificativa é
// obrigatória e vai ao histórico como "alterado por administrador".
// ============================================================

const COR_AZUL = '#202A44';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';
const COR_TEXTO_2 = '#5E6670';

export interface IRetornarEtapaPainelProps {
  previa?: IResultadoRetorno;
  revisaoAtual: string;
  processando: boolean;
  onConfirmar: (justificativa: string) => Promise<boolean>;
}

const RetornarEtapaPainel: React.FC<IRetornarEtapaPainelProps> = ({
  previa,
  revisaoAtual,
  processando,
  onConfirmar
}) => {

  const [aberto, setAberto] =
    React.useState<boolean>(false);

  const [justificativa, setJustificativa] =
    React.useState<string>('');

  if (!previa) {
    return null;
  }

  const bloqueado =
    !previa.ok;

  const podeConfirmar =
    !bloqueado &&
    !processando &&
    justificativa.trim().length >= 10;

  const confirmar = (): void => {
    onConfirmar(justificativa)
      .then(
        ok => {
          if (ok) {
            setAberto(false);
            setJustificativa('');
          }
        }
      )
      .catch((error: unknown) => console.error(error));
  };

  const efeitos: string[] = [];

  if (previa.ok && previa.modo === 'revisao') {
    efeitos.push(`A revisão ${revisaoAtual} será cancelada (status “Cancelada”). Ela continua registrada no histórico.`);
    efeitos.push(`O documento volta para a ${previa.etapaDestino ? previa.etapaDestino.replace(/^Vigente \((.*)\)$/, '$1') : 'revisão'} vigente, que nunca deixou de valer.`);
    efeitos.push('A pendência atual é cancelada. A próxima revisão receberá um novo número (ex.: Rev.01B).');
  }

  if (previa.ok && previa.modo === 'etapa') {
    efeitos.push(`A pendência de “${previa.etapaOrigem}” é cancelada e “${previa.etapaDestino}” volta a ficar pendente para os mesmos responsáveis.`);

    if (previa.rotuloRestaurado) {
      efeitos.push(`O número da revisão volta de ${previa.rotuloAnterior} para ${previa.rotuloRestaurado} (desfaz o evento de revisão).`);
    }

    if (previa.arquivoRemovidoNoTrecho) {
      efeitos.push(
        previa.arquivoRestaurarUrl
          ? 'O arquivo removido pelo evento de revisão será restaurado.'
          : 'O arquivo removido pelo evento de revisão NÃO pode ser restaurado automaticamente: será preciso anexá-lo de novo.'
      );
    }

    efeitos.push('Respostas dadas depois dessa etapa deixam de valer e serão respondidas novamente.');
  }

  return (
    <div
      style={{
        borderTop: `1px dashed ${COR_BORDA}`,
        paddingTop: '12px',
        color: COR_AZUL
      }}
    >
      {
        !aberto
          ? (
            <button
              type="button"
              disabled={processando}
              onClick={() => setAberto(true)}
              title="Corrige um avanço indevido voltando a revisão uma etapa. Fica registrado como alterado por administrador."
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${COR_INDIGO}`,
                background: '#FFFFFF',
                color: COR_INDIGO,
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: processando ? 'not-allowed' : 'pointer'
              }}
            >
              ↶ Voltar uma etapa (administrador)
            </button>
          )
          : (
            <div
              style={{
                border: `1px solid ${COR_INDIGO}`,
                background: '#E8EAF8',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px',
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px' }}>
                Voltar uma etapa — alterado por administrador
              </div>

              {
                bloqueado
                  ? (
                    <div role="alert">
                      <strong style={{ color: COR_INDIGO }}>Não é possível voltar:</strong>{' '}
                      {previa.erros.join(' ')}
                    </div>
                  )
                  : (
                    <>
                      <div>
                        <span style={{ color: COR_TEXTO_2 }}>De</span>{' '}
                        <strong>{previa.etapaOrigem}</strong>{' '}
                        <span style={{ color: COR_TEXTO_2 }}>para</span>{' '}
                        <strong>{previa.etapaDestino}</strong>
                      </div>

                      <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {efeitos.map(item => <li key={item}>{item}</li>)}
                      </ul>

                      <div>
                        <label
                          htmlFor="retorno-justificativa"
                          style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}
                        >
                          Justificativa (obrigatória, mínimo 10 caracteres)
                        </label>
                        <textarea
                          id="retorno-justificativa"
                          value={justificativa}
                          onChange={evento => setJustificativa(evento.target.value)}
                          rows={3}
                          placeholder="Ex.: a revisão foi aprovada por engano; precisa voltar para ajuste do item 4."
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: `1px solid ${COR_BORDA}`,
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            color: COR_AZUL,
                            background: '#FFFFFF'
                          }}
                        />
                      </div>
                    </>
                  )
              }

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {
                  !bloqueado && (
                    <button
                      type="button"
                      disabled={!podeConfirmar}
                      onClick={confirmar}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: 0,
                        background: podeConfirmar ? COR_INDIGO : '#CBD5E1',
                        color: '#FFFFFF',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: podeConfirmar ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {processando ? 'Voltando...' : 'Confirmar retorno'}
                    </button>
                  )
                }
                <button
                  type="button"
                  disabled={processando}
                  onClick={() => {
                    setAberto(false);
                    setJustificativa('');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `1px solid ${COR_AZUL}`,
                    background: '#FFFFFF',
                    color: COR_AZUL,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: processando ? 'not-allowed' : 'pointer'
                  }}
                >
                  {bloqueado ? 'Fechar' : 'Cancelar'}
                </button>
              </div>
            </div>
          )
      }
    </div>
  );
};

export default RetornarEtapaPainel;
