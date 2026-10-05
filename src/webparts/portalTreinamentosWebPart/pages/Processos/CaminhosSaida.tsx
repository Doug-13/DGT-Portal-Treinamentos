import * as React from 'react';

import {
  IFluxoMetadado,
  TipoCondicaoTransicao,
  TipoElementoFluxo
} from '../../models/Fluxo';

import {
  IConfigTransicao
} from '../../services/fluxo/bpmn/bpmnConversao';

// ============================================================
// CAMINHOS DE SAÍDA
//
// Mostra, para uma decisão (ou etapa), TODOS os caminhos que saem
// dela, para onde cada um leva e em que condição o documento segue
// por ele — sem precisar clicar ligação por ligação no desenho.
// ============================================================

export interface IResultadoDisponivel {
  resultado: string;
  descricao: string;
}

export interface ISaidaElemento {
  id: string;
  nome: string;
  destinoNome: string;
  destinoTipo?: TipoElementoFluxo;
  // Percurso depois do destino, atravessando eventos de revisão
  // (ex.: ['Documento Vigente']). Diferencia destinos com o mesmo nome.
  depoisDoDestino?: string[];
  config: IConfigTransicao;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const estiloRotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

const estiloEntrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '34px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '5px 8px',
  fontFamily: 'inherit',
  fontSize: '13px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const NOME_TIPO_DESTINO: Partial<Record<TipoElementoFluxo, string>> = {
  tarefaHumana: 'etapa',
  tarefaSistema: 'tarefa de sistema',
  gateway: 'decisão',
  eventoRevisao: 'evento de revisão',
  fim: 'fim'
};

// ------------------------------------------------------------
// Formulário da condição de UMA ligação
// ------------------------------------------------------------

export interface IFormCondicaoLigacaoProps {
  config: IConfigTransicao;
  onAlterar: (parcial: Partial<IConfigTransicao>) => void;
  editavel: boolean;
  tipoOrigem?: TipoElementoFluxo;
  resultadosDisponiveis: IResultadoDisponivel[];
  metadados: IFluxoMetadado[];
  prefixoId: string;
}

export const FormCondicaoLigacao: React.FC<IFormCondicaoLigacaoProps> = ({
  config,
  onAlterar,
  editavel,
  tipoOrigem,
  resultadosDisponiveis,
  metadados,
  prefixoId
}) => {

  const metadado =
    metadados.find(item => item.chave === config.campo);

  // Resultados únicos (a mesma ação pode chegar por mais de um caminho).
  const resultados =
    resultadosDisponiveis.filter(
      (item, indice) =>
        resultadosDisponiveis.findIndex(outro => outro.resultado === item.resultado && outro.descricao === item.descricao) === indice
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      <div>
        <label htmlFor={`${prefixoId}-condicao`} style={estiloRotulo}>Seguir por aqui quando</label>
        <select
          id={`${prefixoId}-condicao`}
          value={config.tipoCondicao}
          disabled={!editavel}
          onChange={evento => onAlterar({ tipoCondicao: evento.target.value as TipoCondicaoTransicao })}
          style={estiloEntrada}
        >
          <option value="sempre">Sempre</option>
          <option value="resultado">O botão clicado for...</option>
          <option value="campo">Um campo tiver o valor...</option>
        </select>
        {
          tipoOrigem === 'tarefaHumana' && config.tipoCondicao === 'sempre' && (
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Qualquer botão da etapa segue por aqui. Para separar os botões, escolha “O botão clicado for”.
            </div>
          )
        }
      </div>

      {
        config.tipoCondicao === 'resultado' && (
          <div>
            <label htmlFor={`${prefixoId}-resultado`} style={estiloRotulo}>Botão</label>
            <select
              id={`${prefixoId}-resultado`}
              value={config.resultado || ''}
              disabled={!editavel}
              onChange={evento => onAlterar({ resultado: evento.target.value })}
              style={estiloEntrada}
            >
              <option value="">Selecione...</option>
              {
                resultados.map(
                  item => (
                    <option key={`${item.resultado}-${item.descricao}`} value={item.resultado}>
                      {item.descricao}
                    </option>
                  )
                )
              }
            </select>
            {
              resultados.length === 0 && (
                <div style={{ fontSize: '12px', marginTop: '4px', color: COR_INDIGO }}>
                  Nenhuma etapa com botões chega até aqui. Ligue uma etapa antes desta decisão.
                </div>
              )
            }
          </div>
        )
      }

      {
        config.tipoCondicao === 'campo' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
            <div>
              <label htmlFor={`${prefixoId}-campo`} style={estiloRotulo}>Campo</label>
              <select
                id={`${prefixoId}-campo`}
                value={config.campo || ''}
                disabled={!editavel}
                onChange={evento => onAlterar({ campo: evento.target.value, valorEsperado: '' })}
                style={estiloEntrada}
              >
                <option value="">Selecione...</option>
                {
                  metadados
                    .filter(item => item.tipo !== 'tabela')
                    .map(
                      item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>
                    )
                }
              </select>
            </div>

            <div>
              <label htmlFor={`${prefixoId}-valor`} style={estiloRotulo}>Valor</label>
              {
                metadado && (metadado.tipo === 'simNao' || metadado.tipo === 'lista')
                  ? (
                    <select
                      id={`${prefixoId}-valor`}
                      value={config.valorEsperado || ''}
                      disabled={!editavel}
                      onChange={evento => onAlterar({ valorEsperado: evento.target.value })}
                      style={estiloEntrada}
                    >
                      <option value="">Selecione...</option>
                      {
                        metadado.tipo === 'simNao'
                          ? [
                            <option key="sim" value="sim">Sim</option>,
                            <option key="nao" value="nao">Não</option>
                          ]
                          : (metadado.opcoes || []).map(
                            opcao => <option key={opcao} value={opcao}>{opcao}</option>
                          )
                      }
                    </select>
                  )
                  : (
                    <input
                      id={`${prefixoId}-valor`}
                      type="text"
                      value={config.valorEsperado || ''}
                      disabled={!editavel}
                      onChange={evento => onAlterar({ valorEsperado: evento.target.value })}
                      style={estiloEntrada}
                    />
                  )
              }
            </div>

            {
              metadados.length === 0 && (
                <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: COR_INDIGO }}>
                  Cadastre metadados em “Metadados do processo” para usar aqui.
                </div>
              )
            }
          </div>
        )
      }
    </div>
  );
};

// ------------------------------------------------------------
// Frase que resume a regra do caminho
// ------------------------------------------------------------

export const descreverCondicao = (
  config: IConfigTransicao,
  resultadosDisponiveis: IResultadoDisponivel[],
  metadados: IFluxoMetadado[]
): string => {

  if (config.tipoCondicao === 'resultado') {

    const resultado =
      resultadosDisponiveis.find(item => item.resultado === config.resultado);

    return config.resultado
      ? `quando o botão “${resultado ? resultado.descricao : config.resultado}” for clicado`
      : 'quando o botão… (escolha o botão)';
  }

  if (config.tipoCondicao === 'campo') {

    const metadado =
      metadados.find(item => item.chave === config.campo);

    if (!metadado) {
      return 'quando o campo… (escolha o campo)';
    }

    const valor =
      metadado.tipo === 'simNao'
        ? (config.valorEsperado === 'sim' ? 'Sim' : config.valorEsperado === 'nao' ? 'Não' : '…')
        : (config.valorEsperado || '…');

    return `quando “${metadado.rotulo}” for ${valor}`;
  }

  return config.padrao
    ? 'quando nenhum outro caminho se aplicar'
    : 'sempre';
};

// ------------------------------------------------------------
// Lista de caminhos de saída
// ------------------------------------------------------------

export interface ICaminhosSaidaProps {
  saidas: ISaidaElemento[];
  editavel: boolean;
  tipoOrigem: TipoElementoFluxo;
  resultadosDisponiveis: IResultadoDisponivel[];
  metadados: IFluxoMetadado[];
  onAlterarSaida: (id: string, config: IConfigTransicao) => void;
  onDefinirPadrao: (id: string | undefined) => void;
  onRenomearSaida: (id: string, nome: string) => void;
  onSelecionarSaida: (id: string) => void;
}

const CampoNomeSaida: React.FC<{
  id: string;
  nome: string;
  editavel: boolean;
  onRenomear: (nome: string) => void;
}> = ({ id, nome, editavel, onRenomear }) => {

  const [valor, setValor] =
    React.useState<string>(nome);

  React.useEffect(
    () => setValor(nome),
    [nome]
  );

  return (
    <div>
      <label htmlFor={`saida-nome-${id}`} style={estiloRotulo}>Texto no desenho</label>
      <input
        id={`saida-nome-${id}`}
        type="text"
        value={valor}
        disabled={!editavel}
        placeholder="Ex.: Sim, Aprovado, Acima de R$ 10 mil"
        onChange={evento => setValor(evento.target.value)}
        onBlur={() => {
          if (valor !== nome) {
            onRenomear(valor);
          }
        }}
        onKeyDown={evento => {
          if (evento.key === 'Enter') {
            (evento.target as HTMLInputElement).blur();
          }
        }}
        style={estiloEntrada}
      />
    </div>
  );
};

const CaminhosSaida: React.FC<ICaminhosSaidaProps> = ({
  saidas,
  editavel,
  tipoOrigem,
  resultadosDisponiveis,
  metadados,
  onAlterarSaida,
  onDefinirPadrao,
  onRenomearSaida,
  onSelecionarSaida
}) => {

  if (saidas.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: COR_INDIGO, fontWeight: 600 }}>
        Nenhum caminho sai daqui ainda. No desenho, arraste a seta do menu do elemento até o próximo destino.
      </div>
    );
  }

  const ehDecisao =
    tipoOrigem === 'gateway';

  const temPadrao =
    saidas.some(saida => saida.config.padrao);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

      {
        ehDecisao && saidas.length < 2 && (
          <div style={{ fontSize: '12.5px', color: COR_INDIGO, fontWeight: 600 }}>
            Uma decisão precisa de pelo menos dois caminhos.
          </div>
        )
      }

      {
        ehDecisao && saidas.length >= 2 && !temPadrao && (
          <div style={{ fontSize: '12.5px', color: COR_AZUL, background: '#EDF0F5', borderRadius: '6px', padding: '6px 8px' }}>
            Dica: marque um caminho como <strong>padrão</strong>. Ele é usado quando nenhuma condição for atendida.
          </div>
        )
      }

      {
        saidas.map(
          (saida, indice) => {

            const alterar = (
              parcial: Partial<IConfigTransicao>
            ): void => {
              onAlterarSaida(saida.id, { ...saida.config, ...parcial });
            };

            return (
              <div
                key={saida.id}
                style={{
                  border: `1px solid ${saida.config.padrao ? COR_CIANO : COR_BORDA}`,
                  borderLeft: `4px solid ${saida.config.excecao ? COR_INDIGO : saida.config.padrao ? COR_CIANO : COR_AZUL}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                      Caminho {indice + 1}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: '19px' }}>
                      → {saida.destinoNome}
                      {
                        saida.destinoTipo && NOME_TIPO_DESTINO[saida.destinoTipo] && (
                          <span style={{ fontWeight: 400, fontSize: '12px' }}> ({NOME_TIPO_DESTINO[saida.destinoTipo]})</span>
                        )
                      }
                      {
                        (saida.depoisDoDestino || []).map(
                          (nome, posicao) => (
                            <span key={`${nome}-${posicao}`}> → {nome}</span>
                          )
                        )
                      }
                    </div>
                    <div style={{ fontSize: '12.5px', lineHeight: '17px' }}>
                      Segue por aqui {descreverCondicao(saida.config, resultadosDisponiveis, metadados)}.
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Abrir a configuração desta ligação"
                    onClick={() => onSelecionarSaida(saida.id)}
                    style={{
                      minHeight: '30px',
                      padding: '0 8px',
                      border: `1px solid ${COR_BORDA}`,
                      borderRadius: '6px',
                      background: '#FFFFFF',
                      color: COR_AZUL,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Detalhes
                  </button>
                </div>

                <FormCondicaoLigacao
                  config={saida.config}
                  onAlterar={alterar}
                  editavel={editavel}
                  tipoOrigem={tipoOrigem}
                  resultadosDisponiveis={resultadosDisponiveis}
                  metadados={metadados}
                  prefixoId={`saida-${saida.id}`}
                />

                <CampoNomeSaida
                  id={saida.id}
                  nome={saida.nome}
                  editavel={editavel}
                  onRenomear={nome => onRenomearSaida(saida.id, nome)}
                />

                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px' }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={saida.config.padrao}
                      disabled={!editavel}
                      onChange={evento => onDefinirPadrao(evento.target.checked ? saida.id : undefined)}
                    />
                    Caminho padrão
                  </label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={saida.config.excecao}
                      disabled={!editavel}
                      onChange={evento => alterar({ excecao: evento.target.checked })}
                    />
                    Devolução/reprovação (tracejado)
                  </label>
                </div>
              </div>
            );
          }
        )
      }
    </div>
  );
};

export default CaminhosSaida;
