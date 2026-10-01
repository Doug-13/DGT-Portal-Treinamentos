import * as React from 'react';

import {
  IFluxoMetadado,
  TipoCampoFluxo
} from '../../models/Fluxo';

import {
  gerarChave
} from '../../services/fluxo/bpmn/bpmnConversao';

import {
  estiloBotaoPequeno,
  estiloEntradaPainel,
  estiloRotuloPainel
} from './PainelPropriedadesFluxo';

// ============================================================
// METADADOS DO PROCESSO
//
// Campos que as etapas do fluxo podem exibir, exigir ou usar nas
// condições das decisões. São versionados junto com o fluxo.
// ============================================================

export interface IPainelMetadadosProps {
  metadados: IFluxoMetadado[];
  editavel: boolean;
  onAlterar: (metadados: IFluxoMetadado[]) => void;

  // Quantas etapas usam cada metadado (para avisar antes de excluir).
  usoPorChave: Record<string, number>;
}

const COR_AZUL = '#202A44';
const COR_BORDA = '#D9D9D6';

const TIPOS: Array<{ valor: TipoCampoFluxo; rotulo: string }> = [
  { valor: 'texto', rotulo: 'Texto curto' },
  { valor: 'textoLongo', rotulo: 'Texto longo' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'simNao', rotulo: 'Sim / Não' },
  { valor: 'lista', rotulo: 'Lista de opções' }
];

const PainelMetadados: React.FC<IPainelMetadadosProps> = ({
  metadados,
  editavel,
  onAlterar,
  usoPorChave
}) => {

  const alterar = (
    indice: number,
    parcial: Partial<IFluxoMetadado>
  ): void => {
    onAlterar(
      metadados.map(
        (item, posicao) => posicao === indice ? { ...item, ...parcial } : item
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: COR_AZUL }}>

      {
        metadados.length === 0 && (
          <div style={{ fontSize: '13.5px' }}>
            Nenhum metadado. Crie campos como “Número da não conformidade”, “Valor do pedido”
            ou “Exige retreinamento?” para usar nas etapas e nas decisões.
          </div>
        )
      }

      {
        metadados.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '760px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px' }}>
                <span style={estiloRotuloPainel}>Nome do campo</span>
                <span style={estiloRotuloPainel}>Tipo</span>
                <span style={estiloRotuloPainel}>Opções (lista, separadas por ;)</span>
                <span style={estiloRotuloPainel}>Ajuda</span>
                <span />
              </div>

              {
                metadados.map(
                  (metadado, indice) => (
                    <div
                      key={`metadado-${indice}`}
                      style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px', alignItems: 'start', paddingBottom: '8px', borderBottom: `1px dashed ${COR_BORDA}` }}
                    >
                      <div>
                        <input
                          type="text"
                          aria-label="Nome do campo"
                          value={metadado.rotulo}
                          disabled={!editavel}
                          onChange={evento => {
                            const rotulo = evento.target.value;

                            // Enquanto nenhuma etapa usa o campo, a chave
                            // acompanha o nome; depois disso fica fixa.
                            alterar(
                              indice,
                              usoPorChave[metadado.chave]
                                ? { rotulo }
                                : {
                                  rotulo,
                                  chave: gerarChave(
                                    rotulo,
                                    metadados.filter((_item, posicao) => posicao !== indice).map(item => item.chave)
                                  )
                                }
                            );
                          }}
                          style={estiloEntradaPainel}
                        />
                        <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                          Chave: {metadado.chave}
                          {usoPorChave[metadado.chave] ? ` · usado em ${usoPorChave[metadado.chave]} etapa(s)` : ''}
                        </div>
                      </div>

                      <select
                        aria-label="Tipo do campo"
                        value={metadado.tipo}
                        disabled={!editavel}
                        onChange={evento => alterar(indice, { tipo: evento.target.value as TipoCampoFluxo })}
                        style={estiloEntradaPainel}
                      >
                        {
                          TIPOS.map(
                            tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                          )
                        }
                      </select>

                      <input
                        type="text"
                        aria-label="Opções da lista"
                        value={(metadado.opcoes || []).join('; ')}
                        disabled={!editavel || metadado.tipo !== 'lista'}
                        placeholder={metadado.tipo === 'lista' ? 'Ex.: Baixo; Médio; Alto' : '—'}
                        onChange={evento => alterar(indice, {
                          opcoes: evento.target.value.split(';').map(item => item.trim()).filter(item => item.length > 0)
                        })}
                        style={estiloEntradaPainel}
                      />

                      <input
                        type="text"
                        aria-label="Texto de ajuda"
                        value={metadado.ajuda || ''}
                        disabled={!editavel}
                        onChange={evento => alterar(indice, { ajuda: evento.target.value || undefined })}
                        style={estiloEntradaPainel}
                      />

                      {
                        editavel
                          ? (
                            <button
                              type="button"
                              aria-label={`Excluir o campo ${metadado.rotulo}`}
                              onClick={() => {
                                const uso = usoPorChave[metadado.chave] || 0;

                                if (
                                  uso > 0 &&
                                  !window.confirm(`O campo "${metadado.rotulo}" é usado em ${uso} etapa(s). Excluir mesmo assim? Ele será retirado dessas etapas.`)
                                ) {
                                  return;
                                }

                                onAlterar(metadados.filter((_item, posicao) => posicao !== indice));
                              }}
                              style={estiloBotaoPequeno(false)}
                            >
                              ×
                            </button>
                          )
                          : <span />
                      }
                    </div>
                  )
                )
              }
            </div>
          </div>
        )
      }

      {
        editavel && (
          <div>
            <button
              type="button"
              onClick={() => {
                const chave =
                  gerarChave('novo campo', metadados.map(item => item.chave));

                onAlterar([
                  ...metadados,
                  {
                    chave,
                    rotulo: 'Novo campo',
                    tipo: 'texto'
                  }
                ]);
              }}
              style={estiloBotaoPequeno(true)}
            >
              + Metadado
            </button>
          </div>
        )
      }

      <div style={{ fontSize: '12px' }}>
        A chave acompanha o nome até o campo ser usado em alguma etapa; depois fica fixa, para não quebrar as condições que dependem dele.
      </div>
    </div>
  );
};

export default PainelMetadados;
