import * as React from 'react';

import {
  IHistorico
} from '../../models/Treinamento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

export interface IHistoricoPageProps {
  historico:
    IHistorico[];
}

const HistoricoPage:
  React.FC<IHistoricoPageProps> = ({
    historico
  }) => {

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

          if (!termo) {
            return historico;
          }

          return historico.filter(
            item =>
              item.treinamento
                .toLowerCase()
                .indexOf(
                  termo
                ) >= 0 ||
              item.trilha
                .toLowerCase()
                .indexOf(
                  termo
                ) >= 0 ||
              item.status
                .toLowerCase()
                .indexOf(
                  termo
                ) >= 0
          );
        },
        [
          pesquisa,
          historico
        ]
      );

    return (
      <section>
        <PageHeader
          titulo="Meu histórico"
          subtitulo="Acompanhe todas as suas atribuições, conclusões, notas e validades."
        />

        {historico.length === 0 ? (
          <EmptyState
            titulo="Nenhum histórico encontrado"
          />
        ) : (
          <>
            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar no histórico..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                width:
                  '100%',
                maxWidth:
                  '420px',
                padding:
                  '10px 12px',
                border:
                  '1px solid #d8dee8',
                borderRadius:
                  '8px',
                marginBottom:
                  '16px'
              }}
            />

            <div
              style={{
                overflowX:
                  'auto',
                background:
                  '#fff',
                border:
                  '1px solid #e5e7eb',
                borderRadius:
                  '12px'
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
                    <th>
                      Treinamento
                    </th>
                    <th>
                      Trilha
                    </th>
                    <th>
                      Status
                    </th>
                    <th>
                      Conclusão
                    </th>
                    <th>
                      Nota
                    </th>
                    <th>
                      Validade
                    </th>
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
                            item.conclusao
                          }
                        </td>
                        <td>
                          {
                            item.nota
                          }
                        </td>
                        <td>
                          {
                            item.validade
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    );
  };

export default HistoricoPage;
