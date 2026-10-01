import * as React from 'react';

import {
  IBpmnSnapshot
} from '../../../services/fluxo/bpmn/bpmnConversao';

import {
  carregarEditorBpmn,
  IElementoSelecionadoBpmn,
  IModelerFluxo
} from './IModelerFluxo';

// ============================================================
// EDITOR VISUAL DO FLUXO (BPMN)
//
// Arrastar etapas, decisões, início e fim; ligar elementos;
// renomear com duplo clique. A configuração de cada elemento é
// feita no painel ao lado (fora deste componente).
//
// Para recarregar outro desenho, troque a "key" do componente.
// ============================================================

export interface IEditorBpmnFluxoRef {
  obterSnapshot(): IBpmnSnapshot | undefined;
  exportarXml(): Promise<string>;
  renomear(id: string, nome: string): void;
  selecionar(id: string): void;
  elemento(id: string): IElementoSelecionadoBpmn | undefined;
}

export interface IEditorBpmnFluxoProps {
  xmlInicial: string;
  altura?: number;
  onSelecionar: (elemento: IElementoSelecionadoBpmn | undefined) => void;
  onAlterado: () => void;
}

const COR_AZUL = '#202A44';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const estiloBotaoFerramenta: React.CSSProperties = {
  minHeight: '36px',
  minWidth: '36px',
  padding: '0 10px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  background: '#FFFFFF',
  color: COR_AZUL,
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer'
};

const EditorBpmnFluxo = React.forwardRef<IEditorBpmnFluxoRef, IEditorBpmnFluxoProps>(
  (
    {
      xmlInicial,
      altura = 560,
      onSelecionar,
      onAlterado
    },
    ref
  ) => {

    const containerRef =
      React.useRef<HTMLDivElement>(null);

    const modelerRef =
      React.useRef<IModelerFluxo | undefined>(undefined);

    // Guarda os callbacks mais recentes sem recriar o editor.
    const callbacksRef =
      React.useRef({ onSelecionar, onAlterado });

    callbacksRef.current = { onSelecionar, onAlterado };

    const [carregando, setCarregando] =
      React.useState<boolean>(true);

    const [erro, setErro] =
      React.useState<string>('');

    React.useEffect(
      () => {

        let cancelado = false;

        const iniciar = async (): Promise<void> => {

          try {

            const criar =
              await carregarEditorBpmn();

            if (cancelado || !containerRef.current) {
              return;
            }

            const modeler =
              criar(containerRef.current);

            modelerRef.current = modeler;

            modeler.aoSelecionar(
              elemento => callbacksRef.current.onSelecionar(elemento)
            );

            modeler.aoAlterar(
              () => callbacksRef.current.onAlterado()
            );

            await modeler.importar(xmlInicial);

          } catch (error) {

            console.error(error);

            if (!cancelado) {
              setErro('Não foi possível abrir o editor visual. Veja o console do navegador (F12).');
            }

          } finally {
            if (!cancelado) {
              setCarregando(false);
            }
          }
        };

        iniciar()
          .catch(
            (error: unknown) => console.error(error)
          );

        return () => {
          cancelado = true;

          if (modelerRef.current) {
            modelerRef.current.destruir();
            modelerRef.current = undefined;
          }
        };
      },
      []
    );

    React.useImperativeHandle(
      ref,
      () => ({
        obterSnapshot: () =>
          modelerRef.current
            ? modelerRef.current.snapshot()
            : undefined,

        exportarXml: () =>
          modelerRef.current
            ? modelerRef.current.exportarXml()
            : Promise.resolve(''),

        renomear: (id: string, nome: string) => {
          if (modelerRef.current) {
            modelerRef.current.renomear(id, nome);
          }
        },

        selecionar: (id: string) => {
          if (modelerRef.current) {
            modelerRef.current.selecionar(id);
          }
        },

        elemento: (id: string) =>
          modelerRef.current
            ? modelerRef.current.elemento(id)
            : undefined
      }),
      []
    );

    const ferramenta = (
      rotulo: string,
      titulo: string,
      acao: (modeler: IModelerFluxo) => void
    ): React.ReactElement => (
      <button
        type="button"
        title={titulo}
        aria-label={titulo}
        disabled={carregando || !!erro}
        onClick={() => {
          if (modelerRef.current) {
            acao(modelerRef.current);
          }
        }}
        style={estiloBotaoFerramenta}
      >
        {rotulo}
      </button>
    );

    return (
      <div style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '8px', overflow: 'hidden', background: '#FFFFFF' }}>

        <div
          style={{
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '8px 10px',
            borderBottom: `1px solid ${COR_BORDA}`,
            background: '#F2F2F2'
          }}
        >
          {ferramenta('↶', 'Desfazer', modeler => modeler.desfazer())}
          {ferramenta('↷', 'Refazer', modeler => modeler.refazer())}
          {ferramenta('+', 'Aproximar', modeler => modeler.aproximar(1))}
          {ferramenta('−', 'Afastar', modeler => modeler.aproximar(-1))}
          {ferramenta('Ajustar', 'Ajustar o desenho na tela', modeler => modeler.ajustarNaTela())}

          <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: COR_AZUL }}>
            Arraste da paleta à esquerda · duplo clique para renomear · clique em um elemento para configurá-lo
          </span>
        </div>

        <div style={{ position: 'relative', height: `${altura}px` }}>

          <div
            ref={containerRef}
            style={{ position: 'absolute', inset: 0 }}
          />

          {
            carregando && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,.85)',
                  color: COR_AZUL,
                  fontWeight: 600
                }}
              >
                Carregando editor visual...
              </div>
            )
          }

          {
            erro && (
              <div
                role="alert"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  color: COR_INDIGO,
                  fontWeight: 600
                }}
              >
                {erro}
              </div>
            )
          }
        </div>
      </div>
    );
  }
);

EditorBpmnFluxo.displayName = 'EditorBpmnFluxo';

export default EditorBpmnFluxo;
