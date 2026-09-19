import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import FluxoTreinamentoEtapas from
  '../../components/common/FluxoTreinamentoEtapas';

import {
  IEditarTreinamento,
  INovoTreinamento,
  ITreinamentoAdmin,
  TipoTreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  IAreaAdmin
} from '../../services/AreaAdminService';

export interface INovoTreinamentoPageProps {

  areas:
    IAreaAdmin[];

  onVoltar:
    () => void;

  onSalvar:
    (
      dados:
        INovoTreinamento
    ) => Promise<void>;

  treinamentoExistente?:
    ITreinamentoAdmin;

  onAtualizar?:
    (
      dados:
        IEditarTreinamento
    ) => Promise<void>;

  onEtapaClick?:
    (
      etapa:
        1 | 2 | 3
    ) => void;
}

const cores = {
  azul:
    '#0B5CAB',

  azulEscuro:
    '#0B2D4D',

  branco:
    '#FFFFFF',

  texto:
    '#18324A',

  textoSecundario:
    '#66788A',

  borda:
    '#D8E2EC',

  fundoDesabilitado:
    '#F1F5F9',

  verdeClaro:
    '#E7F5EE',

  verde:
    '#13795B',

  vermelhoClaro:
    '#FDE7E9',

  vermelho:
    '#A4262C'
};

const labelStyle:
  React.CSSProperties = {
  display:
    'block',

  marginBottom:
    '6px',

  color:
    cores.texto,

  fontSize:
    '13px',

  fontWeight:
    700
};

const inputStyle:
  React.CSSProperties = {
  width:
    '100%',

  boxSizing:
    'border-box',

  padding:
    '11px 12px',

  border:
    `1px solid ${cores.borda}`,

  borderRadius:
    '8px',

  fontSize:
    '14px',

  color:
    cores.texto,

  background:
    cores.branco,

  outline:
    'none'
};

const inputBloqueadoStyle:
  React.CSSProperties = {
  ...inputStyle,

  background:
    cores.fundoDesabilitado,

  color:
    '#475569',

  cursor:
    'not-allowed',

  fontWeight:
    700
};

const helpStyle:
  React.CSSProperties = {
  display:
    'block',

  marginTop:
    '5px',

  color:
    cores.textoSecundario,

  fontSize:
    '12px'
};

const buttonPrimary:
  React.CSSProperties = {
  padding:
    '10px 16px',

  border:
    `1px solid ${cores.azul}`,

  borderRadius:
    '8px',

  background:
    cores.azul,

  color:
    cores.branco,

  fontWeight:
    700,

  cursor:
    'pointer'
};

const buttonSecondary:
  React.CSSProperties = {
  padding:
    '10px 16px',

  border:
    `1px solid ${cores.azul}`,

  borderRadius:
    '8px',

  background:
    cores.branco,

  color:
    cores.azul,

  fontWeight:
    700,

  cursor:
    'pointer'
};

const tiposTreinamento:
  TipoTreinamentoAdmin[] = [
  'POP',
  'IT',
  'PROC',
  'POL',
  'INT',
  'NR',
  'MAN',
  'SIS',
  'COM',
  'TEC',
  'OUT'
];

const NovoTreinamentoPage:
  React.FC<
    INovoTreinamentoPageProps
  > = ({
    areas,
    onVoltar,
    onSalvar,
    treinamentoExistente,
    onAtualizar,
    onEtapaClick
  }) => {

    const areasDisponiveis =
      (areas || [])
        .filter(
          area =>
            area.ativa
        )
        .sort(
          (
            a,
            b
          ) =>
            a.nome.localeCompare(
              b.nome,
              'pt-BR'
            )
        );

    const modoEdicao =
      !!treinamentoExistente;

    const [
      nome,
      setNome
    ] =
      React.useState('');

    const [
      areaId,
      setAreaId
    ] =
      React.useState('');

    const [
      tipoTreinamento,
      setTipoTreinamento
    ] =
      React.useState<
        TipoTreinamentoAdmin
      >(
        'OUT'
      );

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      cargaHoraria,
      setCargaHoraria
    ] =
      React.useState(
        '60'
      );

    const [
      notaMinima,
      setNotaMinima
    ] =
      React.useState(
        '70'
      );

    const [
      validadeMeses,
      setValidadeMeses
    ] =
      React.useState(
        '12'
      );

    const [
      imagemUrl,
      setImagemUrl
    ] =
      React.useState('');

    const [
      erroImagem,
      setErroImagem
    ] =
      React.useState(
        false
      );

    const [
      ativo,
      setAtivo
    ] =
      React.useState(
        true
      );

    const [
      salvando,
      setSalvando
    ] =
      React.useState(
        false
      );

    const [
      erro,
      setErro
    ] =
      React.useState('');

    const [
      sucesso,
      setSucesso
    ] =
      React.useState('');

    const areaSelecionada =
      areasDisponiveis.find(
        area =>
          area.id ===
          areaId
      );

    const codigoPreview =
      areaSelecionada
        ? `TRN-${areaSelecionada.sigla}-${tipoTreinamento}-XXX`
        : `TRN-AREA-${tipoTreinamento}-XXX`;

    const limpar =
      (): void => {

        setNome('');
        setAreaId('');
        setTipoTreinamento(
          'OUT'
        );

        setDescricao('');

        setCargaHoraria(
          '60'
        );

        setNotaMinima(
          '70'
        );

        setValidadeMeses(
          '12'
        );

        setImagemUrl('');
        setErroImagem(false);
        setAtivo(true);
      };


    React.useEffect(
      () => {

        if (
          !treinamentoExistente
        ) {
          return;
        }

        setNome(
          treinamentoExistente.nome ||
          ''
        );

        setDescricao(
          treinamentoExistente.descricao ||
          ''
        );

        setCargaHoraria(
          String(
            treinamentoExistente.cargaHorariaMin ||
            60
          )
        );

        setNotaMinima(
          String(
            treinamentoExistente.notaMinima ||
            70
          )
        );

        setValidadeMeses(
          String(
            treinamentoExistente.validadeMeses ||
            0
          )
        );

        setImagemUrl(
          treinamentoExistente.imagemUrl ||
          ''
        );

        setAreaId(
          treinamentoExistente.areaId ||
          ''
        );

        setTipoTreinamento(
          treinamentoExistente.tipoTreinamento ||
          'OUT'
        );

        setAtivo(
          treinamentoExistente.ativo
        );

      },
      [
        treinamentoExistente
      ]
    );

    const salvar =
      async (): Promise<void> => {

        setErro('');
        setSucesso('');

        if (
          !nome.trim()
        ) {

          setErro(
            'Informe o nome do treinamento.'
          );

          return;
        }

        if (
          !modoEdicao &&
          !areaId
        ) {

          setErro(
            'Selecione a área do treinamento.'
          );

          return;
        }

        if (
          !tipoTreinamento
        ) {

          setErro(
            'Selecione o tipo do treinamento.'
          );

          return;
        }

        const carga =
          Number(
            cargaHoraria
          );

        const nota =
          Number(
            notaMinima
          );

        const validade =
          Number(
            validadeMeses
          );

        if (
          !Number.isFinite(
            carga
          ) ||
          carga <= 0
        ) {

          setErro(
            'Informe uma carga horária válida em minutos.'
          );

          return;
        }

        if (
          !Number.isFinite(
            nota
          ) ||
          nota < 0 ||
          nota > 100
        ) {

          setErro(
            'A nota mínima deve estar entre 0 e 100.'
          );

          return;
        }

        if (
          !Number.isFinite(
            validade
          ) ||
          validade < 0
        ) {

          setErro(
            'Informe uma validade válida.'
          );

          return;
        }

        if (
          imagemUrl.trim() &&
          !/^https?:\/\//i.test(
            imagemUrl.trim()
          )
        ) {

          setErro(
            'A URL da imagem deve começar com http:// ou https://.'
          );

          return;
        }

        setSalvando(
          true
        );

        try {

          await onSalvar({

            nome:
              nome.trim(),

            // O código é criado pelo plugin no Dataverse.
            codigo:
              '',

            areaId,

            tipoTreinamento,

            descricao:
              descricao.trim(),

            cargaHorariaMin:
              Math.round(
                carga
              ),

            notaMinima:
              nota,

            validadeMeses:
              Math.round(
                validade
              ),

            ativo,

            imagemUrl:
              imagemUrl.trim()
          });

          limpar();

          setSucesso(
            'Treinamento cadastrado com sucesso.'
          );

        } catch (e) {

          setErro(
            e instanceof Error
              ? e.message
              : 'Não foi possível cadastrar o treinamento.'
          );

        } finally {

          setSalvando(
            false
          );
        }
      };

    return (
      <section>

        <PageHeader
          titulo={
            modoEdicao
              ? 'Editar treinamento'
              : 'Novo treinamento'
          }
          subtitulo={
            modoEdicao
              ? 'Etapa 1 de 3 — revise os dados e navegue entre as etapas antes de concluir.'
              : 'Etapa 1 de 3 — cadastre os dados gerais. O código será gerado automaticamente ao salvar.'
          }
          acao={
            <button
              type="button"
              onClick={
                onVoltar
              }
              style={
                buttonSecondary
              }
            >
              ← Voltar
            </button>
          }
        />

        <FluxoTreinamentoEtapas
          etapa={1}
          permitirNavegacao={
            modoEdicao
          }
          onEtapaClick={
            onEtapaClick
          }
        />

        <div
          style={{
            maxWidth:
              '980px',

            padding:
              '24px',

            background:
              cores.branco,

            border:
              `1px solid ${cores.borda}`,

            borderRadius:
              '14px'
          }}
        >

          {erro && (
            <div
              style={{
                marginBottom:
                  '18px',

                padding:
                  '13px 15px',

                background:
                  cores.vermelhoClaro,

                color:
                  cores.vermelho,

                borderRadius:
                  '8px'
              }}
            >
              {erro}
            </div>
          )}

          {sucesso && (
            <div
              style={{
                marginBottom:
                  '18px',

                padding:
                  '13px 15px',

                background:
                  cores.verdeClaro,

                color:
                  cores.verde,

                borderRadius:
                  '8px'
              }}
            >
              {sucesso}
            </div>
          )}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                '2fr 1fr',

              gap:
                '18px',

              marginBottom:
                '18px'
            }}
          >

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Nome *
              </label>

              <input
                value={
                  nome
                }
                onChange={
                  event =>
                    setNome(
                      event
                        .target
                        .value
                    )
                }
                placeholder="Ex.: NR-12 Operação"
                style={
                  inputStyle
                }
              />

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Código
              </label>

              <input
                value={
                  modoEdicao
                    ? (
                      treinamentoExistente
                        ?.codigo ||
                      codigoPreview
                    )
                    : codigoPreview
                }
                readOnly
                disabled
                aria-label="Código gerado automaticamente"
                style={
                  inputBloqueadoStyle
                }
              />

              <span
                style={
                  helpStyle
                }
              >
                {
                  modoEdicao
                    ? 'Código gerado na criação e mantido imutável.'
                    : 'Gerado automaticamente no formato TRN-ÁREA-TIPO-SEQUENCIAL.'
                }
              </span>

            </div>

          </div>

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                '1fr 1fr',

              gap:
                '18px',

              marginBottom:
                '18px'
            }}
          >

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Área *
              </label>

              <select
                value={
                  areaId
                }
                onChange={
                  event =>
                    setAreaId(
                      event
                        .target
                        .value
                    )
                }
                style={
                  inputStyle
                }
              >

                <option value="">
                  Selecione a área
                </option>

                {areasDisponiveis.map(
                  area => (

                    <option
                      key={
                        area.id
                      }
                      value={
                        area.id
                      }
                    >
                      {
                        area.sigla
                      } - {
                        area.nome
                      }
                    </option>
                  )
                )}

              </select>

              <span
                style={
                  helpStyle
                }
              >
                A sigla da área será utilizada na geração do código.
              </span>

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Tipo *
              </label>

              <select
                value={
                  tipoTreinamento
                }
                onChange={
                  event =>
                    setTipoTreinamento(
                      event
                        .target
                        .value as TipoTreinamentoAdmin
                    )
                }
                style={
                  inputStyle
                }
              >

                {tiposTreinamento.map(
                  tipo => (

                    <option
                      key={
                        tipo
                      }
                      value={
                        tipo
                      }
                    >
                      {
                        tipo
                      }
                    </option>
                  )
                )}

              </select>

              <span
                style={
                  helpStyle
                }
              >
                POP, IT, processo, política, integração, NR, sistema, técnico etc.
              </span>

            </div>

          </div>

          <div
            style={{
              marginBottom:
                '18px'
            }}
          >

            <label
              style={
                labelStyle
              }
            >
              Descrição
            </label>

            <textarea
              value={
                descricao
              }
              onChange={
                event =>
                  setDescricao(
                    event
                      .target
                      .value
                  )
              }
              placeholder="Objetivo, público e conteúdo do treinamento..."
              rows={
                5
              }
              style={{
                ...inputStyle,

                resize:
                  'vertical'
              }}
            />

          </div>

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                '1fr 1fr 1fr',

              gap:
                '18px',

              marginBottom:
                '18px'
            }}
          >

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Carga horária (min)
              </label>

              <input
                type="number"
                min={
                  1
                }
                step={
                  1
                }
                value={
                  cargaHoraria
                }
                onChange={
                  event =>
                    setCargaHoraria(
                      event
                        .target
                        .value
                    )
                }
                style={
                  inputStyle
                }
              />

              <span
                style={
                  helpStyle
                }
              >
                Ex.: 40 = 40 min, 60 = 1h, 90 = 1h30.
              </span>

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Nota mínima (%)
              </label>

              <input
                type="number"
                min={
                  0
                }
                max={
                  100
                }
                step={
                  0.01
                }
                value={
                  notaMinima
                }
                onChange={
                  event =>
                    setNotaMinima(
                      event
                        .target
                        .value
                    )
                }
                style={
                  inputStyle
                }
              />

              <span
                style={
                  helpStyle
                }
              >
                Percentual padrão de aprovação.
              </span>

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Validade (meses)
              </label>

              <input
                type="number"
                min={
                  0
                }
                step={
                  1
                }
                value={
                  validadeMeses
                }
                onChange={
                  event =>
                    setValidadeMeses(
                      event
                        .target
                        .value
                    )
                }
                style={
                  inputStyle
                }
              />

              <span
                style={
                  helpStyle
                }
              >
                Use 0 para treinamento sem vencimento periódico.
              </span>

            </div>

          </div>

          <div
            style={{
              marginBottom:
                '18px'
            }}
          >

            <label
              style={
                labelStyle
              }
            >
              Imagem do treinamento
            </label>

            <input
              value={
                imagemUrl
              }
              onChange={
                event => {

                  setImagemUrl(
                    event
                      .target
                      .value
                  );

                  setErroImagem(
                    false
                  );
                }
              }
              placeholder="https://.../imagem.jpg"
              style={
                inputStyle
              }
            />

            <span
              style={
                helpStyle
              }
            >
              Preferencialmente utilize uma URL do SharePoint.
            </span>

            {
              imagemUrl &&
              !erroImagem &&
              /^https?:\/\//i.test(
                imagemUrl
              ) &&
              (
                <div
                  style={{
                    marginTop:
                      '12px'
                  }}
                >
                  <img
                    src={
                      imagemUrl
                    }
                    alt="Pré-visualização"
                    onError={() =>
                      setErroImagem(
                        true
                      )
                    }
                    style={{
                      width:
                        '180px',

                      height:
                        '100px',

                      objectFit:
                        'cover',

                      borderRadius:
                        '8px',

                      border:
                        `1px solid ${cores.borda}`
                    }}
                  />
                </div>
              )
            }

          </div>

          <label
            style={{
              display:
                'flex',

              gap:
                '10px',

              alignItems:
                'flex-start',

              padding:
                '15px',

              border:
                `1px solid ${cores.borda}`,

              borderRadius:
                '10px',

              background:
                '#F8FAFC'
            }}
          >

            <input
              type="checkbox"
              checked={
                ativo
              }
              onChange={
                event =>
                  setAtivo(
                    event
                      .target
                      .checked
                  )
              }
              style={{
                marginTop:
                  '3px'
              }}
            />

            <span>

              <strong
                style={{
                  display:
                    'block',

                  color:
                    cores.texto
                }}
              >
                Treinamento ativo
              </strong>

              <small
                style={{
                  color:
                    cores.textoSecundario
                }}
              >
                O treinamento poderá ser utilizado em trilhas e atribuições.
              </small>

            </span>

          </label>

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'flex-end',

              gap:
                '10px',

              marginTop:
                '24px'
            }}
          >

            <button
              type="button"
              onClick={
                onVoltar
              }
              disabled={
                salvando
              }
              style={{
                ...buttonSecondary,

                opacity:
                  salvando
                    ? 0.6
                    : 1
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={
                salvando
              }
              onClick={() => {

                salvar()
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
                ...buttonPrimary,

                opacity:
                  salvando
                    ? 0.65
                    : 1,

                cursor:
                  salvando
                    ? 'wait'
                    : 'pointer'
              }}
            >
              {
                salvando
                  ? 'Salvando...'
                  : 'Salvar treinamento'
              }
            </button>

          </div>

        </div>

      </section>
    );
  };

export default NovoTreinamentoPage;
