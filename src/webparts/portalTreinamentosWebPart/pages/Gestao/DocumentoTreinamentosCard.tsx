import * as React from 'react';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  ITreinamentoDocumentoAdmin
} from '../../services/TreinamentoDocumentoAdminService';

export interface IDocumentoTreinamentosCardProps {
  vinculos:
    ITreinamentoDocumentoAdmin[];

  treinamentos:
    ITreinamentoAdmin[];

  processando:
    boolean;

  erro:
    string;

  onVincular:
    (
      treinamentoId:
        string,

      obrigatorio:
        boolean,

      ordem:
        number,

      observacao:
        string
    ) => Promise<void>;

  onDesativar:
    (
      relacaoId:
        string
    ) => Promise<void>;
}

const DocumentoTreinamentosCard:
  React.FC<IDocumentoTreinamentosCardProps> = (
    props
  ) => {

    const [
      treinamentoId,
      setTreinamentoId
    ] =
      React.useState('');

    const [
      obrigatorio,
      setObrigatorio
    ] =
      React.useState(
        true
      );

    const [
      ordem,
      setOrdem
    ] =
      React.useState(
        1
      );

    const [
      observacao,
      setObservacao
    ] =
      React.useState('');

    const disponiveis =
      props.treinamentos
        .filter(
          item =>
            item.ativo &&
            !props.vinculos.some(
              vinculo =>
                vinculo.ativo &&
                vinculo.treinamentoId
                  .toLowerCase() ===
                item.id
                  .toLowerCase()
            )
        );

    const vincular =
      async (): Promise<void> => {

        if (
          !treinamentoId
        ) {
          return;
        }

        await props.onVincular(
          treinamentoId,
          obrigatorio,
          ordem,
          observacao
        );

        setTreinamentoId('');
        setObrigatorio(true);
        setOrdem(
          props.vinculos.length +
          2
        );
        setObservacao('');
      };

    return (
      <div
        style={{
          marginTop:
            '16px',

          padding:
            '18px',

          border:
            '1px solid #E2E8F0',

          borderRadius:
            '12px',

          background:
            '#FFFFFF'
        }}
      >
        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            gap:
              '12px'
          }}
        >
          <div>
            <strong
              style={{
                fontSize:
                  '17px'
              }}
            >
              Treinamentos vinculados
            </strong>

            <div
              style={{
                marginTop:
                  '4px',

                color:
                  '#64748B',

                fontSize:
                  '12px'
              }}
            >
              Estes treinamentos serão considerados na análise de impacto de uma nova revisão.
            </div>
          </div>

          <span
            style={{
              padding:
                '5px 9px',

              borderRadius:
                '999px',

              background:
                '#EAF4FF',

              color:
                '#0867D7',

              fontSize:
                '12px',

              fontWeight:
                700
            }}
          >
            {
              props.vinculos
                .filter(
                  item =>
                    item.ativo
                )
                .length
            } ativos
          </span>
        </div>

        {
          props.erro &&
          (
            <div
              style={{
                marginTop:
                  '12px',

                padding:
                  '10px',

                borderRadius:
                  '8px',

                background:
                  '#FDE7E9',

                color:
                  '#A4262C'
              }}
            >
              {
                props.erro
              }
            </div>
          )
        }

        {
          props.vinculos
            .filter(
              item =>
                item.ativo
            )
            .map(
              item => (
                <div
                  key={
                    item.id
                  }
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      '80px minmax(180px,1fr) 110px 100px',

                    gap:
                      '10px',

                    alignItems:
                      'center',

                    marginTop:
                      '12px',

                    padding:
                      '12px',

                    border:
                      '1px solid #E2E8F0',

                    borderRadius:
                      '9px'
                  }}
                >
                  <strong>
                    {
                      item.treinamentoCodigo ||
                      '-'
                    }
                  </strong>

                  <div>
                    {
                      item.treinamentoNome ||
                      'Treinamento'
                    }

                    {
                      item.observacao &&
                      (
                        <div
                          style={{
                            marginTop:
                              '3px',

                            color:
                              '#64748B',

                            fontSize:
                              '11px'
                          }}
                        >
                          {
                            item.observacao
                          }
                        </div>
                      )
                    }
                  </div>

                  <span>
                    {
                      item.obrigatorio
                        ? 'Obrigatório'
                        : 'Opcional'
                    }
                  </span>

                  <button
                    type="button"
                    disabled={
                      props.processando
                    }
                    onClick={() => {

                      props
                        .onDesativar(
                          item.id
                        )
                        .catch(
                          (
                            error:
                              unknown
                          ) =>
                            console.error(
                              error
                            )
                        );

                    }}
                  >
                    Desvincular
                  </button>
                </div>
              )
            )
        }

        {
          props.vinculos
            .filter(
              item =>
                item.ativo
            )
            .length ===
            0 &&
          (
            <div
              style={{
                marginTop:
                  '14px',

                padding:
                  '16px',

                border:
                  '1px dashed #CBD5E1',

                borderRadius:
                  '9px',

                color:
                  '#64748B'
              }}
            >
              Nenhum treinamento vinculado.
            </div>
          )
        }

        <div
          style={{
            marginTop:
              '18px',

            paddingTop:
              '16px',

            borderTop:
              '1px solid #E2E8F0'
          }}
        >
          <strong>
            + Vincular treinamento
          </strong>

          <select
            value={
              treinamentoId
            }
            onChange={
              event =>
                setTreinamentoId(
                  event.target.value
                )
            }
            style={{
              width:
                '100%',

              marginTop:
                '10px',

              padding:
                '10px',

              border:
                '1px solid #CBD5E1',

              borderRadius:
                '8px'
            }}
          >
            <option value="">
              Selecione...
            </option>

            {
              disponiveis.map(
                item => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.codigo
                    } - {
                      item.nome
                    }
                  </option>
                )
              )
            }
          </select>

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                '140px 140px 1fr',

              gap:
                '10px',

              marginTop:
                '10px'
            }}
          >
            <label>
              <input
                type="checkbox"
                checked={
                  obrigatorio
                }
                onChange={
                  event =>
                    setObrigatorio(
                      event.target.checked
                    )
                }
              />{' '}
              Obrigatório
            </label>

            <input
              type="number"
              min={
                1
              }
              value={
                ordem
              }
              onChange={
                event =>
                  setOrdem(
                    Math.max(
                      1,
                      Number(
                        event.target.value
                      ) ||
                      1
                    )
                  )
              }
              placeholder="Ordem"
            />

            <input
              value={
                observacao
              }
              onChange={
                event =>
                  setObservacao(
                    event.target.value
                  )
              }
              placeholder="Observação"
            />
          </div>

          <button
            type="button"
            disabled={
              props.processando ||
              !treinamentoId
            }
            onClick={() => {

              vincular()
                .catch(
                  (
                    error:
                      unknown
                  ) =>
                    console.error(
                      error
                    )
                );

            }}
            style={{
              marginTop:
                '12px',

              padding:
                '10px 14px',

              border:
                0,

              borderRadius:
                '8px',

              background:
                '#0867D7',

              color:
                '#FFFFFF',

              fontWeight:
                700
            }}
          >
            {
              props.processando
                ? 'Salvando...'
                : 'Vincular treinamento'
            }
          </button>
        </div>
      </div>
    );
  };

export default DocumentoTreinamentosCard;
