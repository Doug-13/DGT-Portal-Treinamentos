import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

export interface IGestaoPageProps {

  treinamentos:
    ITreinamentoAdmin[];

  carregando:
    boolean;

  erro:
    string;

  processandoId:
    string;

  onNovoTreinamento:
    () => void;

  onAtribuirTreinamento:
    () => void;

  onTrilhas:
    () => void;

  onAreas:
    () => void;

  onEquipe:
    () => void;

  onEditarTreinamento:
    (
      treinamento:
        ITreinamentoAdmin
    ) => Promise<void>;

  onDefinirAtivo:
    (
      treinamentoId:
        string,
      ativo:
        boolean
    ) => Promise<void>;

  /*
   * Mantidos temporariamente por compatibilidade
   * com o PortalRouter. Não aparecem mais como
   * botões independentes no dashboard.
   */
  onModulos:
    () => void;

  onAvaliacoes:
    () => void;

  onDocumentos:
    () => void;

  onConformidade:
    () => void;

  onIndicadores:
    () => void;
}

const thStyle:
  React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: '12px',
  color: '#64748b',
  background: '#f8fafc',
  whiteSpace: 'nowrap'
};

const tdStyle:
  React.CSSProperties = {
  padding: '13px 14px',
  borderTop: '1px solid #edf0f4',
  color: '#334155',
  fontSize: '13px',
  verticalAlign: 'middle'
};

const inputStyle:
  React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  border: '1px solid #d8dee8',
  borderRadius: '8px',
  fontSize: '14px'
};

const Acao:
  React.FC<{
    titulo: string;
    descricao: string;
    icone: string;
    destaque?: boolean;
    onClick: () => void;
  }> = ({
    titulo,
    descricao,
    icone,
    destaque,
    onClick
  }) => (

    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        padding:
          '20px',

        textAlign:
          'left',

        border:
          destaque
            ? '1px solid #1677ff'
            : '1px solid #e5e7eb',

        borderRadius:
          '14px',

        background:
          destaque
            ? '#eef6ff'
            : '#ffffff',

        cursor:
          'pointer'
      }}
    >

      <div
        style={{
          fontSize:
            '24px',

          marginBottom:
            '12px'
        }}
      >
        {icone}
      </div>

      <strong
        style={{
          display:
            'block',

          color:
            '#0b1f3a',

          fontSize:
            '15px'
        }}
      >
        {titulo}
      </strong>

      <span
        style={{
          display:
            'block',

          marginTop:
            '6px',

          color:
            '#64748b',

          fontSize:
            '12px',

          lineHeight:
            1.45
        }}
      >
        {descricao}
      </span>

    </button>
  );

const GestaoPage:
  React.FC<
    IGestaoPageProps
  > = (
    props
  ) => {

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
            return props
              .treinamentos;
          }

          return props
            .treinamentos
            .filter(
              item =>
                item.nome
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.codigo
                  .toLowerCase()
                  .includes(
                    termo
                  ) ||

                item.descricao
                  .toLowerCase()
                  .includes(
                    termo
                  )
            );

        },
        [
          pesquisa,
          props.treinamentos
        ]
      );

    return (
      <section>

        <PageHeader
          titulo="Gestão de treinamentos"
          subtitulo="Cadastre treinamentos por um fluxo simples e linear. Módulos e avaliação são configurados automaticamente após o cadastro."
        />

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit, minmax(210px, 1fr))',

            gap:
              '14px',

            marginBottom:
              '28px'
          }}
        >

          <Acao
            titulo="Criar treinamento"
            descricao="Fluxo guiado: treinamento → módulos → avaliação."
            icone="+"
            destaque
            onClick={
              props.onNovoTreinamento
            }
          />

          <Acao
            titulo="Atribuir treinamento"
            descricao="Atribua treinamentos diretamente."
            icone="◎"
            onClick={
              props.onAtribuirTreinamento
            }
          />

          <Acao
            titulo="Gerenciar trilhas"
            descricao="Organize cursos, sequência e pré-requisitos."
            icone="▰"
            onClick={
              props.onTrilhas
            }
          />

          <Acao
            titulo="Áreas e acessos"
            descricao="Gerencie áreas, usuários e perfis de acesso."
            icone="◈"
            onClick={
              props.onAreas
            }
          />

          <Acao
            titulo="Minha equipe"
            descricao="Acompanhe progresso e pendências."
            icone="♟"
            onClick={
              props.onEquipe
            }
          />

          <Acao
            titulo="Documentos"
            descricao="Gerencie documentos, revisões e retreinamentos."
            icone="▤"
            onClick={
              props.onDocumentos
            }
          />

          <Acao
            titulo="Conformidade"
            descricao="Acompanhe concluídos, pendentes e vencidos."
            icone="◉"
            onClick={
              props.onConformidade
            }
          />

          <Acao
            titulo="Indicadores"
            descricao="Acompanhe conformidade, vencimentos e desempenho."
            icone="▥"
            onClick={
              props.onIndicadores
            }
          />

        </div>

        <div
          style={{
            background:
              '#ffffff',

            border:
              '1px solid #e5e7eb',

            borderRadius:
              '14px',

            overflow:
              'hidden'
          }}
        >

          <div
            style={{
              padding:
                '18px',

              borderBottom:
                '1px solid #e5e7eb',

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '15px',

              flexWrap:
                'wrap'
            }}
          >

            <div>

              <strong
                style={{
                  display:
                    'block',

                  color:
                    '#0b1f3a',

                  fontSize:
                    '16px'
                }}
              >
                Treinamentos cadastrados
              </strong>

              <span
                style={{
                  display:
                    'block',

                  marginTop:
                    '4px',

                  color:
                    '#64748b',

                  fontSize:
                    '12px'
                }}
              >
                {
                  props
                    .treinamentos
                    .length
                } treinamento(s)
              </span>

            </div>

            <input
              type="search"
              value={
                pesquisa
              }
              placeholder="Pesquisar..."
              onChange={
                event =>
                  setPesquisa(
                    event.target.value
                  )
              }
              style={{
                ...inputStyle,

                maxWidth:
                  '320px'
              }}
            />

          </div>

          {props.erro && (
            <div
              style={{
                margin:
                  '16px',

                padding:
                  '12px',

                background:
                  '#fde7e9',

                color:
                  '#a4262c',

                borderRadius:
                  '8px'
              }}
            >
              {props.erro}
            </div>
          )}

          {props.carregando ? (
            <div
              style={{
                padding:
                  '30px',

                textAlign:
                  'center'
              }}
            >
              Carregando treinamentos...
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  'auto'
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
                    <th style={thStyle}>
                      Código
                    </th>

                    <th style={thStyle}>
                      Treinamento
                    </th>

                    <th style={thStyle}>
                      Carga
                    </th>

                    <th style={thStyle}>
                      Nota
                    </th>

                    <th style={thStyle}>
                      Validade
                    </th>

                    <th style={thStyle}>
                      Status
                    </th>

                    <th style={thStyle}>
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtrados.map(
                    treinamento => {

                      const processando =
                        props.processandoId ===
                        treinamento.id;

                      return (
                        <tr
                          key={
                            treinamento.id
                          }
                        >
                          <td style={tdStyle}>
                            <strong>
                              {
                                treinamento.codigo ||
                                '-'
                              }
                            </strong>
                          </td>

                          <td style={tdStyle}>
                            <strong
                              style={{
                                color:
                                  '#1f2937'
                              }}
                            >
                              {
                                treinamento.nome
                              }
                            </strong>

                            {treinamento.descricao && (
                              <span
                                style={{
                                  display:
                                    'block',

                                  marginTop:
                                    '4px',

                                  color:
                                    '#64748b',

                                  fontSize:
                                    '12px',

                                  maxWidth:
                                    '380px'
                                }}
                              >
                                {
                                  treinamento.descricao
                                }
                              </span>
                            )}
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .cargaHorariaMin
                            } min
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .notaMinima
                            }%
                          </td>

                          <td style={tdStyle}>
                            {
                              treinamento
                                .validadeMeses >
                                0
                                ? `${treinamento.validadeMeses} meses`
                                : 'Sem validade'
                            }
                          </td>

                          <td style={tdStyle}>
                            <span
                              style={{
                                display:
                                  'inline-block',

                                padding:
                                  '5px 9px',

                                borderRadius:
                                  '20px',

                                background:
                                  treinamento.ativo
                                    ? '#e7f5ee'
                                    : '#f1f5f9',

                                color:
                                  treinamento.ativo
                                    ? '#13795b'
                                    : '#64748b',

                                fontSize:
                                  '12px',

                                fontWeight:
                                  700
                              }}
                            >
                              {
                                treinamento.ativo
                                  ? 'Ativo'
                                  : 'Inativo'
                              }
                            </span>
                          </td>

                          <td style={tdStyle}>
                            <div
                              style={{
                                display:
                                  'flex',

                                gap:
                                  '7px',

                                flexWrap:
                                  'wrap'
                              }}
                            >
                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() => {

                                  void props
                                    .onEditarTreinamento(
                                      treinamento
                                    )
                                    .catch(
                                      (
                                        error:
                                          unknown
                                      ) =>
                                        console.error(
                                          'Erro ao abrir edição do treinamento:',
                                          error
                                        )
                                    );
                                }}
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                disabled={
                                  processando
                                }
                                onClick={() => {
                                  props
                                    .onDefinirAtivo(
                                      treinamento.id,
                                      !treinamento.ativo
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
                                {
                                  processando
                                    ? 'Processando...'
                                    : treinamento.ativo
                                      ? 'Desativar'
                                      : 'Ativar'
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>  

      </section>
    );
  };

export default GestaoPage;
