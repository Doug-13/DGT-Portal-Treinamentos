import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  IModuloAdmin
} from '../../services/ModuloAdminService';

import {
  IImpactoRemocaoModulo
} from '../../services/ModuloRemocaoService';

// ============================================================
// REMOVER MÓDULO (modal)
//
// Analisa o impacto, bloqueia se colaboradores já iniciaram o
// módulo e pede confirmação. Renderizado no <body> para ficar
// centralizado dentro da página do SharePoint.
// ============================================================

export interface IRemoverModuloModalProps {
  modulo?: IModuloAdmin;
  posicao: number;
  onAnalisar: (modulo: IModuloAdmin) => Promise<IImpactoRemocaoModulo>;
  onRemover: (modulo: IModuloAdmin) => Promise<void>;
  onFechar: () => void;
}

const C = {
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5'
};

const botao: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: '8px',
  border: `1px solid ${C.borda}`,
  background: C.branco,
  color: C.texto,
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer'
};

const RemoverModuloModal: React.FC<IRemoverModuloModalProps> = (
  props
) => {

  const [impacto, setImpacto] = React.useState<IImpactoRemocaoModulo | undefined>();
  const [analisando, setAnalisando] = React.useState(false);
  const [removendo, setRemovendo] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [confirmado, setConfirmado] = React.useState(false);

  const modulo = props.modulo;

  React.useEffect(
    () => {
      setImpacto(undefined);
      setErro('');
      setConfirmado(false);

      if (!modulo) {
        return;
      }

      setAnalisando(true);

      props.onAnalisar(modulo)
        .then(resultado => setImpacto(resultado))
        .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível analisar o módulo.'))
        .then(() => setAnalisando(false))
        .catch(() => setAnalisando(false));
    },
    [modulo ? modulo.id : '']
  );

  if (!modulo) {
    return null;
  }

  const remover = async (): Promise<void> => {
    setRemovendo(true);
    setErro('');

    try {
      await props.onRemover(modulo);
      props.onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível remover o módulo.');
    } finally {
      setRemovendo(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Remover módulo"
      onClick={() => { if (!removendo) { props.onFechar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(11, 45, 77, 0.45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '80px 16px',
        overflowY: 'auto',
        fontFamily: '"Segoe UI", Barlow, Arial, sans-serif'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          background: C.branco,
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(11, 45, 77, 0.25)',
          color: C.texto,
          padding: '22px 24px'
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '19px', color: C.vermelho }}>
          Remover módulo
        </h2>

        <div style={{ fontSize: '14px', marginBottom: '16px' }}>
          <strong>#{props.posicao}</strong> · {modulo.titulo}
        </div>

        {analisando && (
          <div style={{ color: C.secundario, fontSize: '14px' }}>
            Verificando conteúdos e registros de colaboradores...
          </div>
        )}

        {erro && (
          <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: C.vermelhoClaro, color: C.vermelho, fontSize: '13px' }}>
            {erro}
          </div>
        )}

        {impacto && !impacto.podeRemover && (
          <div style={{ padding: '14px', borderRadius: '8px', background: C.ambarClaro, color: C.ambar, fontSize: '13px', lineHeight: 1.5 }}>
            <strong>Remoção bloqueada.</strong> {impacto.motivoBloqueio}
          </div>
        )}

        {impacto && impacto.podeRemover && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: C.secundario }}>
              Nenhum colaborador iniciou este módulo. Serão excluídos de forma definitiva:
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '14px' }}>
              <tbody>
                {([
                  ['Módulo', 1],
                  ['Conteúdos', impacto.conteudos],
                  ['Perguntas rápidas', impacto.perguntas],
                  ['Alternativas das perguntas', impacto.alternativas]
                ] as Array<[string, number]>).map(([rotulo, quantidade]) => (
                  <tr key={rotulo} style={{ borderTop: `1px solid ${C.borda}` }}>
                    <td style={{ padding: '6px 4px' }}>{rotulo}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700 }}>{quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '10px 12px', borderRadius: '8px', background: C.fundo, fontSize: '12px', color: C.secundario, marginBottom: '14px', lineHeight: 1.5 }}>
              Os módulos seguintes sobem uma posição e são renumerados automaticamente.
              A remoção fica registrada no histórico do treinamento. <strong>Esta ação não pode ser desfeita.</strong>
            </div>

            <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={confirmado}
                disabled={removendo}
                onChange={() => setConfirmado(!confirmado)}
              />
              Entendo que o módulo e seus conteúdos serão excluídos definitivamente.
            </label>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button
            type="button"
            disabled={removendo}
            onClick={props.onFechar}
            style={{ ...botao, opacity: removendo ? 0.6 : 1 }}
          >
            {impacto && !impacto.podeRemover ? 'Fechar' : 'Cancelar'}
          </button>

          {impacto && impacto.podeRemover && (
            <button
              type="button"
              disabled={!confirmado || removendo}
              onClick={() => { void remover(); }}
              style={{
                ...botao,
                border: 'none',
                background: C.vermelho,
                color: C.branco,
                opacity: !confirmado || removendo ? 0.5 : 1
              }}
            >
              {removendo ? 'Removendo...' : 'Remover módulo'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RemoverModuloModal;
