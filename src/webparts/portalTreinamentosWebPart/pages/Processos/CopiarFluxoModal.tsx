import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  IFluxoDefinicao,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  IProcesso
} from '../../models/Processo';

import {
  DESCRICAO_OPCAO_RESPONSAVEIS,
  OpcaoResponsaveisCopia,
  metadadosParaCopiar
} from '../../services/fluxo/copiaFluxo';

// ============================================================
// PROCESSOS — COPIAR FLUXO DE OUTRO PROCESSO
//
// Escolha do processo e da versão de origem, do que fazer com os
// responsáveis e se os metadados que faltam devem ser trazidos.
// A cópia entra como RASCUNHO no processo atual.
// ============================================================

export interface IFonteCopiaFluxo {
  processo: IProcesso;
  versoes: IFluxoDefinicao[];
  metadados: IFluxoMetadado[];
}

export interface ICopiaEscolhida {
  origem: IFluxoDefinicao;
  opcaoResponsaveis: OpcaoResponsaveisCopia;
  metadados: IFluxoMetadado[];
}

export interface ICopiarFluxoModalProps {
  aberto: boolean;
  processoDestino: IProcesso;
  metadadosDestino: IFluxoMetadado[];
  fontes: IFonteCopiaFluxo[];
  jaTemFluxo: boolean;
  processando: boolean;
  // Processo já escolhido na lista "Começar a partir de".
  processoInicialId?: string;
  onConfirmar: (escolha: ICopiaEscolhida) => void;
  onCancelar: () => void;
}

const COR_AZUL = '#202A44';
const COR_INDIGO = '#485CC7';
const COR_BORDA = '#D9D9D6';

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: COR_AZUL,
  marginBottom: '4px'
};

const entrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '38px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '14px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const botao = (principal: boolean, desabilitado: boolean): React.CSSProperties => ({
  minHeight: '38px',
  padding: '0 16px',
  borderRadius: '6px',
  border: `2px solid ${COR_AZUL}`,
  background: principal ? COR_AZUL : '#FFFFFF',
  color: principal ? '#FFFFFF' : COR_AZUL,
  fontWeight: 700,
  fontSize: '13.5px',
  cursor: desabilitado ? 'not-allowed' : 'pointer',
  opacity: desabilitado ? 0.45 : 1
});

const rotuloVersao = (definicao: IFluxoDefinicao): string =>
  `Versão ${definicao.versao} — ${definicao.status === 'publicado' ? 'publicada' : definicao.status === 'rascunho' ? 'rascunho' : 'arquivada'}`;

const CopiarFluxoModal: React.FC<ICopiarFluxoModalProps> = ({
  aberto,
  processoDestino,
  metadadosDestino,
  fontes,
  jaTemFluxo,
  processando,
  processoInicialId,
  onConfirmar,
  onCancelar
}) => {

  const opcoes = React.useMemo(
    () =>
      fontes
        .filter(f => f.processo.id !== processoDestino.id && f.versoes.length > 0)
        .sort((a, b) => `${a.processo.codigo} ${a.processo.nome}`.localeCompare(`${b.processo.codigo} ${b.processo.nome}`, 'pt-BR')),
    [fontes, processoDestino.id]
  );

  const [processoId, setProcessoId] = React.useState<string>(processoInicialId || '');

  // Ao abrir, parte do processo escolhido na lista do editor.
  React.useEffect(() => {
    if (aberto) {
      setProcessoId(processoInicialId || '');
    }
  }, [aberto, processoInicialId]);
  const [versao, setVersao] = React.useState<number | undefined>(undefined);
  const [opcaoResponsaveis, setOpcaoResponsaveis] = React.useState<OpcaoResponsaveisCopia>('automaticos');
  const [trazerMetadados, setTrazerMetadados] = React.useState<boolean>(true);

  const fonte = opcoes.find(f => f.processo.id === processoId);

  // Ao trocar de processo, sugere a versão publicada (ou a mais nova).
  React.useEffect(() => {
    if (!fonte) {
      setVersao(undefined);
      return;
    }
    const sugerida = fonte.versoes.find(v => v.status === 'publicado') || fonte.versoes[0];
    setVersao(sugerida ? sugerida.versao : undefined);
  }, [fonte]);

  React.useEffect(() => {
    if (!aberto) {
      return undefined;
    }
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !processando) {
        onCancelar();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aberto, processando, onCancelar]);

  if (!aberto) {
    return null;
  }

  const origem = fonte && versao !== undefined
    ? fonte.versoes.find(v => v.versao === versao)
    : undefined;

  const faltantes = fonte
    ? metadadosParaCopiar(fonte.metadados, metadadosDestino)
    : [];

  const etapas = origem ? origem.elementos.filter(e => e.tipo === 'tarefaHumana').length : 0;

  const especificos = origem
    ? origem.elementos.reduce(
      (soma, e) => soma + (e.responsaveis || []).filter(r => r.tipo !== 'autorRevisao' && r.tipo !== 'gestorArea').length,
      0
    )
    : 0;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Copiar fluxo de outro processo"
      onClick={() => { if (!processando) { onCancelar(); } }}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(680px, 100%)', maxHeight: '100%', overflowY: 'auto', background: '#FFFFFF', borderRadius: '10px', borderTop: `4px solid #05C3DD`, boxShadow: '0 20px 50px rgba(0,0,0,.3)', padding: '20px 22px', boxSizing: 'border-box', color: COR_AZUL }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '18px' }}>Copiar fluxo de outro processo</h2>
        <p style={{ margin: '0 0 16px', fontSize: '13.5px', lineHeight: 1.5 }}>
          O desenho e a configuração (etapas, botões, caminhos, campos e eventos de revisão) são copiados
          para <strong>{processoDestino.codigo ? `${processoDestino.codigo} — ` : ''}{processoDestino.nome}</strong> como
          {' '}<strong>rascunho{jaTemFluxo ? ' de uma nova versão' : ' da versão 1'}</strong>. Depois é só ajustar
          responsáveis e metadados e publicar. O fluxo de origem não é alterado.
        </p>

        {opcoes.length === 0
          ? (
            <p style={{ fontSize: '13.5px', color: COR_INDIGO }}>
              Nenhum outro processo tem fluxo para copiar ainda.
            </p>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label htmlFor="copiar-processo" style={rotulo}>Processo de origem</label>
                <select id="copiar-processo" value={processoId} onChange={e => setProcessoId(e.target.value)} style={entrada} disabled={processando}>
                  <option value="">Selecione…</option>
                  {opcoes.map(f => (
                    <option key={f.processo.id} value={f.processo.id}>
                      {f.processo.codigo ? `${f.processo.codigo} — ` : ''}{f.processo.nome}
                    </option>
                  ))}
                </select>
              </div>

              {fonte && (
                <div>
                  <label htmlFor="copiar-versao" style={rotulo}>Versão do fluxo</label>
                  <select
                    id="copiar-versao"
                    value={versao === undefined ? '' : String(versao)}
                    onChange={e => setVersao(Number(e.target.value))}
                    style={entrada}
                    disabled={processando}
                  >
                    {fonte.versoes.map(v => <option key={v.versao} value={v.versao}>{rotuloVersao(v)}</option>)}
                  </select>
                  {origem && (
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      {etapas} etapa(s) com responsável · {origem.transicoes.length} ligação(ões)
                      {especificos > 0 ? ` · ${especificos} responsável(is) específico(s) de área/usuário` : ''}
                    </div>
                  )}
                </div>
              )}

              {fonte && (
                <fieldset style={{ border: `1px solid ${COR_BORDA}`, borderRadius: '6px', padding: '10px 12px', margin: 0 }}>
                  <legend style={{ ...rotulo, padding: '0 4px', marginBottom: 0 }}>Responsáveis das etapas</legend>
                  {(['automaticos', 'manter', 'limpar'] as OpcaoResponsaveisCopia[]).map(opcao => (
                    <label key={opcao} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', marginBottom: '6px' }}>
                      <input
                        type="radio"
                        name="copiar-responsaveis"
                        checked={opcaoResponsaveis === opcao}
                        onChange={() => setOpcaoResponsaveis(opcao)}
                        disabled={processando}
                        style={{ marginTop: '3px' }}
                      />
                      {DESCRICAO_OPCAO_RESPONSAVEIS[opcao]}
                    </label>
                  ))}
                </fieldset>
              )}

              {fonte && (
                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px' }}>
                  <input
                    type="checkbox"
                    checked={trazerMetadados}
                    onChange={() => setTrazerMetadados(!trazerMetadados)}
                    disabled={processando || faltantes.length === 0}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    Trazer os metadados que faltam neste processo
                    <span style={{ display: 'block', fontSize: '12.5px', marginTop: '2px' }}>
                      {faltantes.length === 0
                        ? 'Este processo já tem todos os metadados da origem.'
                        : `${faltantes.length} metadado(s): ${faltantes.slice(0, 5).map(m => m.rotulo || m.chave).join(', ')}${faltantes.length > 5 ? '…' : ''}. Depois você pode editá-los na aba Metadados.`}
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onCancelar} disabled={processando} style={botao(false, processando)}>Cancelar</button>
          <button
            type="button"
            disabled={processando || !origem}
            onClick={() => {
              if (origem) {
                onConfirmar({
                  origem,
                  opcaoResponsaveis,
                  metadados: trazerMetadados ? faltantes : []
                });
              }
            }}
            style={botao(true, processando || !origem)}
          >
            {processando ? 'Copiando…' : 'Copiar fluxo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CopiarFluxoModal;
