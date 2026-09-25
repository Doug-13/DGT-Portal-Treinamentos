import * as React from 'react';

import {
  IDocumentoRevisao
} from '../../models/Documento';

// ============================================================
// MODAL DE REVISÃO
//   modo "criar"  → abre a próxima revisão (ex.: Rev.01) em Elaboração
//   modo "editar" → edita uma revisão que ainda está em Elaboração
// ============================================================

export interface IRevisaoEditorDados {
  motivoAlteracao: string;
  descricaoAlteracoes: string;
  arquivo?: File;
}

export interface IRevisaoEditorModalProps {
  aberto: boolean;
  modo: 'criar' | 'editar';

  // Número que será usado (criar) ou que está sendo editado.
  revisaoNumero: string;

  // Revisão vigente de onde a nova parte (só informativo).
  revisaoBase?: IDocumentoRevisao;

  // Revisão sendo editada (modo editar).
  revisao?: IDocumentoRevisao;

  processando: boolean;
  erro: string;

  onCancelar: () => void;
  onSalvar: (dados: IRevisaoEditorDados) => Promise<boolean>;
}

const COR_AZUL = '#202A44';
const COR_CIANO = '#05C3DD';
const COR_INDIGO = '#485CC7';

const rotulo: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  color: COR_AZUL,
  fontSize: '13px',
  fontWeight: 700
};

const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  fontSize: '13px',
  fontFamily: 'inherit'
};

const RevisaoEditorModal:
  React.FC<IRevisaoEditorModalProps> = ({
    aberto,
    modo,
    revisaoNumero,
    revisaoBase,
    revisao,
    processando,
    erro,
    onCancelar,
    onSalvar
  }) => {

    const [motivo, setMotivo] =
      React.useState('');

    const [descricao, setDescricao] =
      React.useState('');

    const [arquivo, setArquivo] =
      React.useState<File | undefined>(undefined);

    const [erroLocal, setErroLocal] =
      React.useState('');

    // Preenche o formulário toda vez que o modal abre.
    React.useEffect(
      () => {
        if (!aberto) {
          return;
        }

        setMotivo(
          modo === 'editar'
            ? revisao?.motivoAlteracao || ''
            : ''
        );

        setDescricao(
          modo === 'editar'
            ? revisao?.descricaoAlteracoes || ''
            : ''
        );

        setArquivo(undefined);
        setErroLocal('');
      },
      [
        aberto,
        modo,
        revisao
      ]
    );

    if (!aberto) {
      return null;
    }

    const salvar = (): void => {

      setErroLocal('');

      if (!motivo.trim()) {
        setErroLocal('Informe o motivo da alteração.');
        return;
      }

      if (!descricao.trim()) {
        setErroLocal('Descreva as alterações.');
        return;
      }

      onSalvar({
        motivoAlteracao: motivo,
        descricaoAlteracoes: descricao,
        arquivo
      })
        .catch(
          (error: unknown) =>
            console.error(error)
        );
    };

    const titulo =
      modo === 'criar'
        ? `Criar nova revisão — ${revisaoNumero}`
        : `Editar revisão ${revisaoNumero}`;

    const temArquivoAtual =
      modo === 'editar' &&
      !!revisao?.arquivoUrl;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(15,23,42,.55)'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#FFFFFF',
            borderRadius: '14px',
            boxShadow: '0 20px 50px rgba(15,23,42,.25)'
          }}
        >
          <div
            style={{
              padding: '18px 22px',
              borderBottom: `3px solid ${COR_CIANO}`,
              background: COR_AZUL,
              color: '#FFFFFF',
              borderRadius: '14px 14px 0 0'
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: '15px',
                textTransform: 'uppercase',
                letterSpacing: '.3px'
              }}
            >
              {titulo}
            </strong>

            <span
              style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                opacity: 0.85
              }}
            >
              {
                modo === 'criar'
                  ? (
                    revisaoBase
                      ? `A ${revisaoBase.revisao} continua vigente até esta revisão ser aprovada.`
                      : 'A revisão será criada em Elaboração.'
                  )
                  : 'Revisão em Elaboração — ainda não foi enviada ao Gestor.'
              }
            </span>
          </div>

          <div
            style={{
              padding: '20px 22px'
            }}
          >
            <label style={rotulo}>
              Motivo da alteração *
            </label>

            <input
              type="text"
              value={motivo}
              maxLength={100}
              onChange={event => setMotivo(event.target.value)}
              placeholder="Ex.: atualização do passo 4 conforme nova máquina"
              style={campo}
            />

            <label
              style={{
                ...rotulo,
                marginTop: '16px'
              }}
            >
              Descrição das alterações *
            </label>

            <textarea
              rows={5}
              value={descricao}
              onChange={event => setDescricao(event.target.value)}
              placeholder="Descreva o que muda em relação à revisão anterior."
              style={campo}
            />

            <label
              style={{
                ...rotulo,
                marginTop: '16px'
              }}
            >
              {
                temArquivoAtual
                  ? 'Substituir arquivo (opcional)'
                  : modo === 'criar'
                    ? 'Arquivo da nova revisão (pode ser anexado depois)'
                    : 'Arquivo da revisão (obrigatório para enviar à aprovação)'
              }
            </label>

            {
              temArquivoAtual &&
              (
                <div
                  style={{
                    marginBottom: '8px',
                    fontSize: '12px',
                    color: '#64748B'
                  }}
                >
                  Arquivo atual:{' '}
                  <a
                    href={revisao?.arquivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: COR_INDIGO, fontWeight: 700 }}
                  >
                    abrir
                  </a>
                </div>
              )
            }

            <input
              type="file"
              onChange={event =>
                setArquivo(
                  event.target.files && event.target.files.length > 0
                    ? event.target.files[0]
                    : undefined
                )
              }
              style={{
                fontSize: '13px'
              }}
            />

            {
              arquivo &&
              (
                <span
                  style={{
                    display: 'block',
                    marginTop: '6px',
                    fontSize: '12px',
                    color: '#64748B'
                  }}
                >
                  Selecionado: {arquivo.name}
                </span>
              )
            }

            {
              (erroLocal || erro) &&
              (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#FDE7E9',
                    color: '#A4262C',
                    fontSize: '12.5px',
                    lineHeight: 1.5
                  }}
                >
                  {erroLocal || erro}
                </div>
              )
            }

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px'
              }}
            >
              <button
                type="button"
                disabled={processando}
                onClick={onCancelar}
                style={{
                  padding: '9px 14px',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  background: '#FFFFFF',
                  color: '#1F2937',
                  fontWeight: 700,
                  cursor: processando ? 'not-allowed' : 'pointer'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={processando}
                onClick={salvar}
                style={{
                  padding: '9px 16px',
                  border: 0,
                  borderRadius: '8px',
                  background: processando ? '#8C93A8' : COR_AZUL,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  cursor: processando ? 'not-allowed' : 'pointer'
                }}
              >
                {
                  processando
                    ? 'Salvando...'
                    : modo === 'criar'
                      ? `Criar ${revisaoNumero}`
                      : 'Salvar alterações'
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

export default RevisaoEditorModal;
