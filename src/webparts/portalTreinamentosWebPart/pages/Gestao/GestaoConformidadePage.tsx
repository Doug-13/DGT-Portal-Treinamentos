import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IItemConformidade,
  IResumoConformidade,
  StatusConformidade
} from '../../services/ConformidadeService';

export interface IGestaoConformidadePageProps {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  carregando:
    boolean;

  erro:
    string;

  onVoltar:
    () => void;
}

const formatarData = (
  valor: string
): string => {

  if (!valor) {
    return '-';
  }

  const data =
    new Date(valor);

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return valor;
  }

  return data
    .toLocaleDateString(
      'pt-BR'
    );
};

const Cartao:
  React.FC<{
    titulo: string;
    valor: string | number;
    detalhe?: string;
  }> = ({
    titulo,
    valor,
    detalhe
  }) => (
    <div
      style={{
        padding: '18px',
        border:
          '1px solid #e5e7eb',
        borderRadius:
          '14px',
        background:
          '#fff'
      }}
    >
      <span
        style={{
          display:
            'block',
          color:
            '#64748b',
          fontSize:
            '12px'
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          display:
            'block',
          marginTop:
            '6px',
          fontSize:
            '26px',
          color:
            '#0b1f3a'
        }}
      >
        {valor}
      </strong>

      {detalhe && (
        <small
          style={{
            display:
              'block',
            marginTop:
              '4px',
            color:
              '#64748b'
          }}
        >
          {detalhe}
        </small>
      )}
    </div>
  );

const GestaoConformidadePage:
  React.FC<IGestaoConformidadePageProps> = (
    props
  ) => {

    const [
      filtro,
      setFiltro
    ] =
      React.useState<
        StatusConformidade | 'Todos'
      >(
        'Todos'
      );

    const [
      pesquisa,
      setPesquisa
    ] =
      React.useState('');

    const filtrados =
      React.useMemo(
        () => {

          const termo =
            pesquisa
              .trim()
              .toLowerCase();

          return props.itens
            .filter(
              item =>
                filtro ===
                  'Todos' ||
                item.status ===
                  filtro
            )
            .filter(
              item =>
                !termo ||
                item.usuario
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0 ||
                item.treinamento
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0 ||
                item.trilha
                  .toLowerCase()
                  .indexOf(
                    termo
                  ) >= 0
            );
        },
        [
          filtro,
          pesquisa,
          props.itens
        ]
      );

    return (
      <section>
        <PageHeader
          titulo="Conformidade de treinamentos"
          subtitulo="Visão consolidada de conclusões, pendências, vencimentos e reciclagens."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
        >
          ← Voltar
        </button>

        {props.erro && (
          <div
            style={{
              marginTop:
                '16px',
              padding:
                '12px',
              borderRadius:
                '8px',
              background:
                '#fde7e9',
              color:
                '#a4262c'
            }}
          >
            {props.erro}
          </div>
        )}

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(160px,1fr))',
            gap:
              '12px',
            marginTop:
              '18px'
          }}
        >
          <Cartao
            titulo="Conformidade"
            valor={
              `${props.resumo.conformidadePercentual}%`
            }
          />

          <Cartao
            titulo="Concluídos"
            valor={
              props.resumo.concluidos
            }
          />

          <Cartao
            titulo="Pendentes"
            valor={
              props.resumo.pendentes
            }
          />

          <Cartao
            titulo="Vencidos"
            valor={
              props.resumo.vencidos
            }
          />

          <Cartao
            titulo="A vencer"
            valor={
              props.resumo.aVencer
            }
            detalhe="Próximos 30 dias"
          />

          <Cartao
            titulo="Em andamento"
            valor={
              props.resumo.emAndamento
            }
          />
        </div>

        <div
          style={{
            marginTop:
              '18px',
            padding:
              '16px',
            border:
              '1px solid #e5e7eb',
            borderRadius:
              '14px',
            background:
              '#fff'
          }}
        >
          <div
            style={{
              display:
                'flex',
              gap:
                '10px',
              flexWrap:
                'wrap'
            }}
          >
            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar usuário, treinamento ou trilha..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                flex:
                  '1 1 280px',
                padding:
                  '10px',
                border:
                  '1px solid #d8dee8',
                borderRadius:
                  '8px'
              }}
            />

            <select
              value={
                filtro
              }
              onChange={
                event =>
                  setFiltro(
                    event.target.value as
                      StatusConformidade |
                      'Todos'
                  )
              }
              style={{
                padding:
                  '10px',
                border:
                  '1px solid #d8dee8',
                borderRadius:
                  '8px'
              }}
            >
              <option>
                Todos
              </option>
              <option>
                Concluído
              </option>
              <option>
                Pendente
              </option>
              <option>
                Vencido
              </option>
              <option>
                A vencer
              </option>
              <option>
                Bloqueado
              </option>
              <option>
                Em andamento
              </option>
              <option>
                Reprovado
              </option>
            </select>
          </div>

          {props.carregando ? (
            <div
              style={{
                padding:
                  '30px',
                textAlign:
                  'center'
              }}
            >
              Carregando conformidade...
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  'auto',
                marginTop:
                  '14px'
              }}
            >
              <table
                style={{
                  width:
                    '100%',
                  borderCollapse:
                    'collapse'
                }}
              >
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Treinamento</th>
                    <th>Trilha</th>
                    <th>Status</th>
                    <th>Conclusão</th>
                    <th>Validade</th>
                    <th>Dias</th>
                    <th>Origem</th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map(
                    item => (
                      <tr
                        key={
                          item.id
                        }
                      >
                        <td>
                          {
                            item.usuario
                          }
                        </td>

                        <td>
                          {
                            item.treinamento
                          }
                        </td>

                        <td>
                          {
                            item.trilha
                          }
                        </td>

                        <td>
                          {
                            item.status
                          }
                        </td>

                        <td>
                          {
                            formatarData(
                              item.conclusao
                            )
                          }
                        </td>

                        <td>
                          {
                            formatarData(
                              item.validade
                            )
                          }
                        </td>

                        <td>
                          {
                            item
                              .diasParaVencer !==
                            undefined
                              ? item
                                  .diasParaVencer
                              : '-'
                          }
                        </td>

                        <td>
                          {
                            item.origem
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  };

export default GestaoConformidadePage;
