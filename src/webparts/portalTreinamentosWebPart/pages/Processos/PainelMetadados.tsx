import * as React from 'react';

import {
  IColunaTabela,
  IFluxoMetadado,
  TipoCampoFluxo,
  TipoColunaTabela
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
// Pertencem ao PROCESSO (valem para todas as versões do fluxo).
// A ORDEM desta lista é a ordem em que os campos aparecem nas
// etapas e no documento. Use ↑ ↓ para reordenar.
// ============================================================

export interface IPainelMetadadosProps {
  metadados: IFluxoMetadado[];
  editavel: boolean;
  onAlterar: (metadados: IFluxoMetadado[]) => void;

  // Quantas etapas usam cada metadado (para avisar antes de excluir
  // e para travar a chave).
  usoPorChave: Record<string, number>;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_BORDA = '#D9D9D6';

const TIPOS: Array<{ valor: TipoCampoFluxo; rotulo: string }> = [
  { valor: 'texto', rotulo: 'Texto curto' },
  { valor: 'textoLongo', rotulo: 'Texto longo' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'simNao', rotulo: 'Sim / Não' },
  { valor: 'lista', rotulo: 'Lista de opções' },
  { valor: 'tabela', rotulo: 'Tabela' }
];

const TIPOS_COLUNA: Array<{ valor: TipoColunaTabela; rotulo: string }> = [
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
  { valor: 'simNao', rotulo: 'Sim / Não' },
  { valor: 'lista', rotulo: 'Lista' }
];

const lerOpcoes = (
  texto: string
): string[] =>
  texto.split(';').map(item => item.trim()).filter(item => item.length > 0);

const mover = <T,>(
  lista: T[],
  de: number,
  para: number
): T[] => {

  if (para < 0 || para >= lista.length) {
    return lista;
  }

  const copia =
    lista.slice();

  const [item] =
    copia.splice(de, 1);

  copia.splice(para, 0, item);

  return copia;
};

const botaoSeta = (
  rotulo: string,
  titulo: string,
  desabilitado: boolean,
  acao: () => void
): React.ReactElement => (
  <button
    type="button"
    title={titulo}
    aria-label={titulo}
    disabled={desabilitado}
    onClick={acao}
    style={{
      ...estiloBotaoPequeno(false),
      minHeight: '28px',
      minWidth: '28px',
      padding: 0,
      opacity: desabilitado ? 0.35 : 1,
      cursor: desabilitado ? 'default' : 'pointer'
    }}
  >
    {rotulo}
  </button>
);

// ------------------------------------------------------------
// Colunas de um metadado tabela
// ------------------------------------------------------------

const EditorColunas: React.FC<{
  colunas: IColunaTabela[];
  editavel: boolean;
  chaveFixa: boolean;
  rotuloTabela: string;
  onAlterar: (colunas: IColunaTabela[]) => void;
}> = ({ colunas, editavel, chaveFixa, rotuloTabela, onAlterar }) => {

  const alterar = (
    indice: number,
    parcial: Partial<IColunaTabela>
  ): void => {
    onAlterar(
      colunas.map(
        (coluna, posicao) => posicao === indice ? { ...coluna, ...parcial } : coluna
      )
    );
  };

  return (
    <div
      style={{
        marginTop: '8px',
        marginLeft: '64px',
        padding: '10px 12px',
        borderLeft: `3px solid ${COR_CIANO}`,
        background: '#F7FBFC',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <div style={{ ...estiloRotuloPainel, marginBottom: 0 }}>Colunas da tabela</div>

      {
        colunas.length === 0 && (
          <div style={{ fontSize: '12.5px' }}>
            Adicione as colunas que cada linha da tabela vai ter (ex.: Item, Quantidade, Data de entrega).
          </div>
        )
      }

      {
        colunas.map(
          (coluna, indice) => (
            <div
              key={`coluna-${indice}`}
              style={{ display: 'grid', gridTemplateColumns: '64px 1.4fr 1fr 1.4fr 110px 32px', gap: '6px', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px' }}>
                {botaoSeta('↑', `Subir a coluna ${coluna.rotulo}`, !editavel || indice === 0, () => onAlterar(mover(colunas, indice, indice - 1)))}
                {botaoSeta('↓', `Descer a coluna ${coluna.rotulo}`, !editavel || indice === colunas.length - 1, () => onAlterar(mover(colunas, indice, indice + 1)))}
              </div>

              <input
                type="text"
                aria-label={`Nome da coluna ${indice + 1} de ${rotuloTabela}`}
                value={coluna.rotulo}
                disabled={!editavel}
                onChange={evento => {
                  const rotulo = evento.target.value;
                  alterar(
                    indice,
                    chaveFixa
                      ? { rotulo }
                      : {
                        rotulo,
                        chave: gerarChave(
                          rotulo,
                          colunas.filter((_item, posicao) => posicao !== indice).map(item => item.chave)
                        )
                      }
                  );
                }}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              />

              <select
                aria-label={`Tipo da coluna ${coluna.rotulo}`}
                value={coluna.tipo}
                disabled={!editavel}
                onChange={evento => alterar(indice, { tipo: evento.target.value as TipoColunaTabela })}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              >
                {
                  TIPOS_COLUNA.map(
                    tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.rotulo}</option>
                  )
                }
              </select>

              <input
                type="text"
                aria-label={`Opções da coluna ${coluna.rotulo}`}
                value={(coluna.opcoes || []).join('; ')}
                disabled={!editavel || coluna.tipo !== 'lista'}
                placeholder={coluna.tipo === 'lista' ? 'Opções separadas por ;' : '—'}
                onChange={evento => alterar(indice, { opcoes: lerOpcoes(evento.target.value) })}
                style={{ ...estiloEntradaPainel, minHeight: '32px' }}
              />

              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px' }}>
                <input
                  type="checkbox"
                  checked={!!coluna.obrigatoria}
                  disabled={!editavel}
                  onChange={evento => alterar(indice, { obrigatoria: evento.target.checked || undefined })}
                />
                Obrigatória
              </label>

              {
                editavel
                  ? (
                    <button
                      type="button"
                      aria-label={`Excluir a coluna ${coluna.rotulo}`}
                      onClick={() => onAlterar(colunas.filter((_item, posicao) => posicao !== indice))}
                      style={{ ...estiloBotaoPequeno(false), minHeight: '28px', padding: 0 }}
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

      {
        editavel && (
          <div>
            <button
              type="button"
              onClick={() =>
                onAlterar([
                  ...colunas,
                  {
                    chave: gerarChave('coluna', colunas.map(item => item.chave)),
                    rotulo: `Coluna ${colunas.length + 1}`,
                    tipo: 'texto'
                  }
                ])
              }
              style={estiloBotaoPequeno(false)}
            >
              + Coluna
            </button>
          </div>
        )
      }
    </div>
  );
};

// ------------------------------------------------------------
// Lista de metadados
// ------------------------------------------------------------

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
            Nenhum metadado. Crie campos como “Número da não conformidade”, “Valor do pedido”,
            “Exige retreinamento?” ou uma tabela de itens, para usar nas etapas e nas decisões.
          </div>
        )
      }

      {
        metadados.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '820px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '64px 1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px' }}>
                <span style={estiloRotuloPainel}>Ordem</span>
                <span style={estiloRotuloPainel}>Nome do campo</span>
                <span style={estiloRotuloPainel}>Tipo</span>
                <span style={estiloRotuloPainel}>Opções (lista, separadas por ;)</span>
                <span style={estiloRotuloPainel}>Ajuda</span>
                <span />
              </div>

              {
                metadados.map(
                  (metadado, indice) => {

                    const uso =
                      usoPorChave[metadado.chave] || 0;

                    return (
                      <div
                        key={`metadado-${indice}`}
                        style={{ paddingBottom: '8px', borderBottom: `1px dashed ${COR_BORDA}` }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '64px 1.6fr 1fr 1.6fr 1.4fr 40px', gap: '8px', alignItems: 'start' }}>

                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', minHeight: '36px' }}>
                            {botaoSeta('↑', `Subir ${metadado.rotulo}`, !editavel || indice === 0, () => onAlterar(mover(metadados, indice, indice - 1)))}
                            {botaoSeta('↓', `Descer ${metadado.rotulo}`, !editavel || indice === metadados.length - 1, () => onAlterar(mover(metadados, indice, indice + 1)))}
                          </div>

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
                                  uso
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
                              {indice + 1}º · chave: {metadado.chave}
                              {uso ? ` · usado em ${uso} etapa(s)` : ''}
                            </div>
                          </div>

                          <select
                            aria-label="Tipo do campo"
                            value={metadado.tipo}
                            disabled={!editavel}
                            onChange={evento => {
                              const tipo = evento.target.value as TipoCampoFluxo;
                              alterar(
                                indice,
                                tipo === 'tabela' && (!metadado.colunas || metadado.colunas.length === 0)
                                  ? {
                                    tipo,
                                    colunas: [
                                      { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatoria: true }
                                    ]
                                  }
                                  : { tipo }
                              );
                            }}
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
                            onChange={evento => alterar(indice, { opcoes: lerOpcoes(evento.target.value) })}
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
                                    if (
                                      uso > 0 &&
                                      !window.confirm(`O campo "${metadado.rotulo}" é usado em ${uso} etapa(s). Excluir mesmo assim? Ele deixa de aparecer nessas etapas.`)
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

                        {
                          metadado.tipo === 'tabela' && (
                            <EditorColunas
                              colunas={metadado.colunas || []}
                              editavel={editavel}
                              chaveFixa={uso > 0}
                              rotuloTabela={metadado.rotulo}
                              onAlterar={colunas => alterar(indice, { colunas })}
                            />
                          )
                        }
                      </div>
                    );
                  }
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

      <div style={{ fontSize: '12px', lineHeight: '17px' }}>
        Os metadados pertencem ao processo e valem para todas as versões do fluxo. A ordem acima é a
        ordem em que os campos aparecem nas etapas e no documento. A chave acompanha o nome até o campo
        ser usado em alguma etapa; depois fica fixa.
      </div>
    </div>
  );
};

export default PainelMetadados;
