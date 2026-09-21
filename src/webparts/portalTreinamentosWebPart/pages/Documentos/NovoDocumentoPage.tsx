import { INovoDocumentoCompleto } from '../../services/DocumentoAdminService';
import * as React from 'react';

export interface INovoDocumentoPageProps {
  processando: boolean;
  erro: string;

  onVoltar:
    () => void;

  onSalvar:
    (
      dados:
        INovoDocumentoCompleto
    ) => Promise<void>;
}

const C = {
  azul:
    '#0B67D1',

  azulEscuro:
    '#0A2845',

  texto:
    '#28445F',

  secundario:
    '#61788E',

  borda:
    '#D8E2EC',

  fundo:
    '#F6F9FC',

  branco:
    '#FFFFFF',

  vermelho:
    '#B42318',

  vermelhoClaro:
    '#FDE7E9'
};

const input:
  React.CSSProperties = {

  width:
    '100%',

  minHeight:
    '42px',

  padding:
    '10px 12px',

  boxSizing:
    'border-box',

  border:
    `1px solid ${C.borda}`,

  borderRadius:
    '8px',

  background:
    C.branco,

  color:
    C.azulEscuro,

  fontSize:
    '13px'
};

const label:
  React.CSSProperties = {

  display:
    'block',

  marginBottom:
    '6px',

  color:
    C.texto,

  fontWeight:
    700,

  fontSize:
    '12px'
};

const NovoDocumentoPage:
  React.FC<
    INovoDocumentoPageProps
  > = (
    props
  ) => {

    const [
      codigo,
      setCodigo
    ] =
      React.useState('');

    const [
      titulo,
      setTitulo
    ] =
      React.useState('');

    const [
      descricao,
      setDescricao
    ] =
      React.useState('');

    const [
      tipo,
      setTipo
    ] =
      React.useState(
        'POP'
      );

    const [
      area,
      setArea
    ] =
      React.useState(
        'Qualidade'
      );

    const [
      responsavel,
      setResponsavel
    ] =
      React.useState('');

    const [
      revisaoInicial,
      setRevisaoInicial
    ] =
      React.useState(
        'Rev.01'
      );

    const [
      status,
      setStatus
    ] =
      React.useState(
        'Em elaboração'
      );

    const [
      ativo,
      setAtivo
    ] =
      React.useState(
        true
      );

    const [
      arquivo,
      setArquivo
    ] =
      React.useState<
        File | undefined
      >(
        undefined
      );

    const [
      erroLocal,
      setErroLocal
    ] =
      React.useState('');

    const salvar =
      async (): Promise<void> => {

        setErroLocal('');

        if (
          !codigo.trim()
        ) {

          setErroLocal(
            'Informe o código do documento.'
          );

          return;
        }

        if (
          !titulo.trim()
        ) {

          setErroLocal(
            'Informe o título do documento.'
          );

          return;
        }

        if (
          !tipo.trim()
        ) {

          setErroLocal(
            'Selecione o tipo do documento.'
          );

          return;
        }

        if (
          !area.trim()
        ) {

          setErroLocal(
            'Selecione a área responsável.'
          );

          return;
        }
        if (
          !arquivo
        ) {

          setErroLocal(
            'Selecione o arquivo do documento.'
          );

          return;
        }

        try {

          await props
            .onSalvar({
              codigo:
                codigo
                  .trim(),

              titulo:
                titulo
                  .trim(),

              descricao:
                descricao
                  .trim(),

              tipo,

              area,

              responsavel:
                responsavel
                  .trim(),

              revisaoInicial:
                revisaoInicial
                  .trim() ||
                'Rev.01',

              status,

              ativo,

              arquivo:
                arquivo as File
            });

        } catch (e) {

          setErroLocal(
            e instanceof Error
              ? e.message
              : 'Não foi possível criar o documento.'
          );
        }
      };

    return (
      <section>

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            gap:
              '12px',

            alignItems:
              'center',

            flexWrap:
              'wrap'
          }}
        >
          <div>
            <h1
              style={{
                margin:
                  0,

                color:
                  C.azulEscuro,

                fontSize:
                  '28px'
              }}
            >
              Novo documento
            </h1>

            <p
              style={{
                margin:
                  '5px 0 0',

                color:
                  C.secundario
              }}
            >
              Cadastre os dados principais e selecione o arquivo inicial do documento.
            </p>
          </div>

          <button
            type="button"
            onClick={
              props.onVoltar
            }
            style={{
              padding:
                '9px 14px',

              border:
                `1px solid ${C.azul}`,

              borderRadius:
                '8px',

              background:
                C.branco,

              color:
                C.azul,

              fontWeight:
                700,

              cursor:
                'pointer'
            }}
          >
            ← Voltar
          </button>
        </div>

        {
          (
            props.erro ||
            erroLocal
          ) &&
          (
            <div
              style={{
                marginTop:
                  '16px',

                padding:
                  '12px 14px',

                borderRadius:
                  '8px',

                background:
                  C.vermelhoClaro,

                color:
                  C.vermelho
              }}
            >
              {
                erroLocal ||
                props.erro
              }
            </div>
          )
        }

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'minmax(0,1fr) 340px',

            gap:
              '18px',

            marginTop:
              '18px',

            alignItems:
              'start'
          }}
        >

          <div
            style={{
              padding:
                '20px',

              border:
                `1px solid ${C.borda}`,

              borderRadius:
                '14px',

              background:
                C.branco
            }}
          >
            <h2
              style={{
                margin:
                  '0 0 18px',

                color:
                  C.azulEscuro,

                fontSize:
                  '18px'
              }}
            >
              Dados do documento
            </h2>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '180px minmax(0,1fr)',

                gap:
                  '14px'
              }}
            >
              <div>
                <label style={label}>
                  Código *
                </label>

                <input
                  value={
                    codigo
                  }
                  placeholder="Ex.: POP-001"
                  onChange={
                    event =>
                      setCodigo(
                        event.target
                          .value
                          .toUpperCase()
                      )
                  }
                  style={
                    input
                  }
                />
              </div>

              <div>
                <label style={label}>
                  Título *
                </label>

                <input
                  value={
                    titulo
                  }
                  placeholder="Ex.: Operação segura de equipamentos"
                  onChange={
                    event =>
                      setTitulo(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                />
              </div>
            </div>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  'repeat(3,minmax(150px,1fr))',

                gap:
                  '14px',

                marginTop:
                  '14px'
              }}
            >
              <div>
                <label style={label}>
                  Tipo de documento *
                </label>

                <select
                  value={
                    tipo
                  }
                  onChange={
                    event =>
                      setTipo(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                >
                  <option value="POP">
                    POP
                  </option>

                  <option value="Política">
                    Política
                  </option>

                  <option value="Instrução de Trabalho">
                    Instrução de Trabalho
                  </option>

                  <option value="Procedimento">
                    Procedimento
                  </option>

                  <option value="Formulário">
                    Formulário
                  </option>

                  <option value="Norma">
                    Norma
                  </option>

                  <option value="Manual">
                    Manual
                  </option>

                  <option value="Outro">
                    Outro
                  </option>
                </select>
              </div>

              <div>
                <label style={label}>
                  Área *
                </label>

                <select
                  value={
                    area
                  }
                  onChange={
                    event =>
                      setArea(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                >
                  <option value="Qualidade">
                    Qualidade
                  </option>

                  <option value="Segurança">
                    Segurança
                  </option>

                  <option value="Engenharia">
                    Engenharia
                  </option>

                  <option value="Produção">
                    Produção
                  </option>

                  <option value="Manutenção">
                    Manutenção
                  </option>

                  <option value="RH">
                    RH
                  </option>

                  <option value="Administrativo">
                    Administrativo
                  </option>

                  <option value="TI">
                    TI
                  </option>

                  <option value="Financeiro">
                    Financeiro
                  </option>

                  <option value="Comercial">
                    Comercial
                  </option>
                </select>
              </div>

              <div>
                <label style={label}>
                  Responsável
                </label>

                <input
                  value={
                    responsavel
                  }
                  placeholder="Nome ou e-mail"
                  onChange={
                    event =>
                      setResponsavel(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                />
              </div>
            </div>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '180px 220px 1fr',

                gap:
                  '14px',

                marginTop:
                  '14px'
              }}
            >
              <div>
                <label style={label}>
                  Revisão inicial
                </label>

                <input
                  value={
                    revisaoInicial
                  }
                  onChange={
                    event =>
                      setRevisaoInicial(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                />
              </div>

              <div>
                <label style={label}>
                  Status
                </label>

                <select
                  value={
                    status
                  }
                  onChange={
                    event =>
                      setStatus(
                        event.target.value
                      )
                  }
                  style={
                    input
                  }
                >
                  <option value="Em elaboração">
                    Em elaboração
                  </option>

                  <option value="Em revisão">
                    Em revisão
                  </option>

                  <option value="Em aprovação">
                    Em aprovação
                  </option>

                  <option value="Vigente">
                    Vigente
                  </option>
                </select>
              </div>

              <label
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '8px',

                  marginTop:
                    '25px',

                  color:
                    C.texto,

                  fontWeight:
                    700
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
                        event.target.checked
                      )
                  }
                />

                Documento ativo
              </label>
            </div>

            <div
              style={{
                marginTop:
                  '14px'
              }}
            >
              <label style={label}>
                Descrição
              </label>

              <textarea
                rows={
                  5
                }
                value={
                  descricao
                }
                placeholder="Descreva o objetivo, aplicação e observações do documento."
                onChange={
                  event =>
                    setDescricao(
                      event.target.value
                    )
                }
                style={{
                  ...input,

                  resize:
                    'vertical'
                }}
              />
            </div>
          </div>

          <aside
            style={{
              display:
                'grid',

              gap:
                '14px'
            }}
          >
            <div
              style={{
                padding:
                  '18px',

                border:
                  `1px solid ${C.borda}`,

                borderRadius:
                  '14px',

                background:
                  C.branco
              }}
            >
              <h2
                style={{
                  margin:
                    '0 0 5px',

                  color:
                    C.azulEscuro,

                  fontSize:
                    '17px'
                }}
              >
                Arquivo do documento
              </h2>

              <p
                style={{
                  margin:
                    '0 0 14px',

                  color:
                    C.secundario,

                  fontSize:
                    '12px',

                  lineHeight:
                    1.45
                }}
              >
                Selecione o arquivo correspondente à primeira revisão.
              </p>

              <label
                style={{
                  minHeight:
                    '150px',

                  display:
                    'flex',

                  flexDirection:
                    'column',

                  alignItems:
                    'center',

                  justifyContent:
                    'center',

                  padding:
                    '18px',

                  border:
                    '2px dashed #B9C9D8',

                  borderRadius:
                    '12px',

                  background:
                    '#F8FBFE',

                  textAlign:
                    'center',

                  cursor:
                    'pointer'
                }}
              >
                <span
                  style={{
                    fontSize:
                      '34px'
                  }}
                >
                  📤
                </span>

                <strong
                  style={{
                    marginTop:
                      '9px',

                    color:
                      C.azul
                  }}
                >
                  Selecionar arquivo
                </strong>

                <span
                  style={{
                    marginTop:
                      '4px',

                    color:
                      C.secundario,

                    fontSize:
                      '11px'
                  }}
                >
                  PDF, DOCX, XLSX, PPTX ou arquivo compatível
                </span>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  style={{
                    display:
                      'none'
                  }}
                  onChange={
                    event => {

                      const item =
                        event.target.files &&
                        event.target.files[
                          0
                        ];

                      setArquivo(
                        item ||
                        undefined
                      );
                    }
                  }
                />
              </label>

              {
                arquivo &&
                (
                  <div
                    style={{
                      marginTop:
                        '12px',

                      padding:
                        '10px 12px',

                      borderRadius:
                        '8px',

                      background:
                        '#EEF6FF',

                      color:
                        C.texto,

                      fontSize:
                        '12px'
                    }}
                  >
                    <strong>
                      {
                        arquivo.name
                      }
                    </strong>

                    <div
                      style={{
                        marginTop:
                          '3px',

                        color:
                          C.secundario
                      }}
                    >
                      {
                        Math.ceil(
                          arquivo.size /
                          1024
                        )
                      } KB
                    </div>
                  </div>
                )
              }
            </div>

            <div
              style={{
                padding:
                  '16px',

                borderRadius:
                  '12px',

                background:
                  '#FFF8E1',

                color:
                  '#604A00',

                fontSize:
                  '12px',

                lineHeight:
                  1.5
              }}
            >
              <strong>
                Próxima etapa
              </strong>

              <div
                style={{
                  marginTop:
                    '5px'
                }}
              >
                O documento será criado no Dataverse. O upload físico do arquivo para a biblioteca SharePoint será conectado no próximo bloco da Gestão Documental.
              </div>
            </div>
          </aside>
        </div>

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'flex-end',

            gap:
              '10px',

            marginTop:
              '18px'
          }}
        >
          <button
            type="button"
            onClick={
              props.onVoltar
            }
            style={{
              padding:
                '10px 16px',

              border:
                `1px solid ${C.azul}`,

              borderRadius:
                '8px',

              background:
                C.branco,

              color:
                C.azul,

              fontWeight:
                700,

              cursor:
                'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={
              props.processando
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
                '10px 18px',

              border:
                0,

              borderRadius:
                '8px',

              background:
                props.processando
                  ? '#9DB3C7'
                  : C.azul,

              color:
                '#FFFFFF',

              fontWeight:
                800,

              cursor:
                props.processando
                  ? 'not-allowed'
                  : 'pointer'
            }}
          >
            {
              props.processando
                ? 'Salvando...'
                : 'Criar documento'
            }
          </button>
        </div>

      </section>
    );
  };

export default NovoDocumentoPage;

