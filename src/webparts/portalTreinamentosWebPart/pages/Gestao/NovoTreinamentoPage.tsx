import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  INovoTreinamento
} from '../../services/TreinamentoAdminService';

export interface INovoTreinamentoPageProps {

  onVoltar:
    () => void;

  onSalvar:
    (
      dados:
        INovoTreinamento
    ) => Promise<void>;
}

// ============================================================
// ESTILOS
// ============================================================

const labelStyle:
  React.CSSProperties = {

  display:
    'block',

  marginBottom:
    '6px',

  color:
    '#334155',

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
    '1px solid #d8dee8',

  borderRadius:
    '8px',

  fontSize:
    '14px',

  background:
    '#ffffff',

  outline:
    'none'
};

// ============================================================
// COMPONENTE
// ============================================================

const NovoTreinamentoPage:
  React.FC<
    INovoTreinamentoPageProps
  > = ({
    onVoltar,
    onSalvar
  }) => {

    const [
      nome,
      setNome
    ] =
      React.useState('');

    const [
      codigo,
      setCodigo
    ] =
      React.useState('');

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

    // ==========================================================
    // LIMPAR
    // ==========================================================

    const limpar =
      (): void => {

        setNome('');
        setCodigo('');
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

        setAtivo(
          true
        );
      };

    // ==========================================================
    // SALVAR
    // ==========================================================

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
          !codigo.trim()
        ) {

          setErro(
            'Informe o código do treinamento.'
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
          Number.isNaN(carga) ||
          carga <= 0
        ) {

          setErro(
            'Informe uma carga horária válida.'
          );

          return;
        }

        if (
          Number.isNaN(nota) ||
          nota < 0 ||
          nota > 100
        ) {

          setErro(
            'A nota mínima deve estar entre 0 e 100.'
          );

          return;
        }

        if (
          Number.isNaN(validade) ||
          validade < 0
        ) {

          setErro(
            'Informe uma validade válida.'
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

            codigo:
              codigo
                .trim()
                .toUpperCase(),

            descricao:
              descricao.trim(),

            cargaHorariaMin:
              carga,

            notaMinima:
              nota,

            validadeMeses:
              validade,

            ativo
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

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
      <section>

        <PageHeader
          titulo="Novo treinamento"
          subtitulo="Cadastre um novo treinamento no Portal DGT."
          acao={
            <button
              type="button"
              onClick={
                onVoltar
              }
            >
              Voltar
            </button>
          }
        />

        <div
          style={{
            maxWidth:
              '900px',

            padding:
              '24px',

            background:
              '#ffffff',

            border:
              '1px solid #e5e7eb',

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
                  '#fde7e9',

                color:
                  '#a4262c',

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
                  '#e7f5ee',

                color:
                  '#13795b',

                borderRadius:
                  '8px'
              }}
            >
              {sucesso}
            </div>
          )}

          {/* NOME / CÓDIGO */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                '2fr 1fr',

              gap:
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
                Código *
              </label>

              <input
                value={
                  codigo
                }
                onChange={
                  event =>
                    setCodigo(
                      event
                        .target
                        .value
                    )
                }
                placeholder="TRN-001"
                style={
                  inputStyle
                }
              />

            </div>

          </div>

          {/* DESCRIÇÃO */}

          <div
            style={{
              marginTop:
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
              rows={
                5
              }
              placeholder="Objetivo, público e conteúdo do treinamento..."
              style={{
                ...inputStyle,

                resize:
                  'vertical'
              }}
            />

          </div>

          {/* PARÂMETROS */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',

              gap:
                '18px',

              marginTop:
                '18px'
            }}
          >

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Carga horária
                (min)
              </label>

              <input
                type="number"
                min={
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

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Nota mínima
                (%)
              </label>

              <input
                type="number"
                min={
                  0
                }
                max={
                  100
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

            </div>

            <div>

              <label
                style={
                  labelStyle
                }
              >
                Validade
                (meses)
              </label>

              <input
                type="number"
                min={
                  0
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

            </div>

          </div>

          {/* ATIVO */}

          <div
            style={{
              marginTop:
                '22px',

              padding:
                '15px',

              border:
                '1px solid #e5e7eb',

              borderRadius:
                '10px',

              background:
                '#f8fafc'
            }}
          >

            <label
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap:
                  '10px',

                cursor:
                  'pointer'
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
              />

              <span>

                <strong
                  style={{
                    display:
                      'block',

                    color:
                      '#334155'
                  }}
                >
                  Treinamento ativo
                </strong>

                <small
                  style={{
                    color:
                      '#64748b'
                  }}
                >
                  O treinamento poderá ser utilizado em trilhas e atribuições.
                </small>

              </span>

            </label>

          </div>

          {/* BOTÕES */}

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
              disabled={
                salvando
              }
              onClick={
                onVoltar
              }
              style={{
                padding:
                  '10px 18px',

                border:
                  '1px solid #cbd5e1',

                borderRadius:
                  '8px',

                background:
                  '#ffffff',

                cursor:
                  'pointer'
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
                padding:
                  '10px 20px',

                border:
                  'none',

                borderRadius:
                  '8px',

                background:
                  salvando
                    ? '#94a3b8'
                    : '#1677ff',

                color:
                  '#ffffff',

                fontWeight:
                  700,

                cursor:
                  salvando
                    ? 'default'
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