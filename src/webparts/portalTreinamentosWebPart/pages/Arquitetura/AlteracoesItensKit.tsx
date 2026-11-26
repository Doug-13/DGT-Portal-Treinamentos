import * as React from 'react';

import {
  CategoriaItem
} from '../../services/bom/catalogoKits';

import {
  AcaoAlteracaoItem,
  IAlteracaoAplicada,
  IItemBom,
  IRefItemBom,
  IRegistroAlteracaoBom,
  SituacaoAlteracao,
  catalogoParaSubstituicao,
  mesmoItem
} from '../../services/bom/montadorBom';

import {
  COR,
  FONTE,
  botao,
  campo,
  formatarDataHora
} from './arquiteturaComum';

import {
  IconeKit
} from './IconesKit';

// ============================================================
// ALTERAÇÕES MANUAIS DE ITENS DO KIT
//
// Janela para trocar (substituir) ou cancelar um item do kit gerado
// e a lista de histórico (quem, quando, motivo, desfeita). Usado na
// Seleção de kit e no B.O.M. pronto.
// ============================================================

export const VERDE_ALT = '#107C10';
export const VERMELHO_ALT = '#B42318';
const AMBAR = '#B45309';

const CATEGORIAS: CategoriaItem[] = ['Estrutura', 'Câmera', 'Equipamento', 'Infraestrutura', 'Licença', 'Serviço', 'Identificação'];

const semAcento = (texto: string): string =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const quemQuando = (por: string, em: string): string =>
  `${por || 'usuário não identificado'} · ${formatarDataHora(em)}`;

export const SITUACAO: Record<SituacaoAlteracao, { texto: string; cor: string; fundo: string }> = {
  aplicada: { texto: 'Em vigor', cor: VERDE_ALT, fundo: '#E7F6EC' },
  naoAplicada: { texto: 'Não aplicada', cor: AMBAR, fundo: '#FFF4E5' },
  desfeita: { texto: 'Desfeita', cor: COR.texto2, fundo: '#F1F5F9' }
};

const seloPequeno = (texto: string, cor: string, fundo: string): React.ReactElement => (
  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', background: fundo, color: cor, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
    {texto}
  </span>
);

export const SeloSituacao: React.FC<{ situacao: SituacaoAlteracao }> = ({ situacao }) =>
  seloPequeno(SITUACAO[situacao].texto, SITUACAO[situacao].cor, SITUACAO[situacao].fundo);

// ------------------------------------------------------------
// Janela: trocar ou cancelar item
// ------------------------------------------------------------

export interface IDadosAlteracaoItem {
  acao: AcaoAlteracaoItem;
  adicionado?: IRefItemBom;
  quantidadePorPonto?: number;
  motivo: string;
}

export interface IModalAlterarItemProps {
  item: IItemBom;
  nomePonto: string;
  // Quantidade do item em UM ponto e nº de pontos iguais.
  quantidadePorPonto: number;
  pontosIguais: number;
  usuarioNome?: string;
  onConfirmar: (dados: IDadosAlteracaoItem) => void;
  onFechar: () => void;
}

export const ModalAlterarItem: React.FC<IModalAlterarItemProps> = ({
  item, nomePonto, quantidadePorPonto, pontosIguais, usuarioNome, onConfirmar, onFechar
}) => {

  const [acao, setAcao] = React.useState<AcaoAlteracaoItem>('substituir');
  const [busca, setBusca] = React.useState('');
  const [escolhido, setEscolhido] = React.useState<IRefItemBom | undefined>();
  const [manual, setManual] = React.useState(false);
  const [codigoManual, setCodigoManual] = React.useState('');
  const [descricaoManual, setDescricaoManual] = React.useState('');
  const [categoriaManual, setCategoriaManual] = React.useState<CategoriaItem>(item.categoria);
  const [mesmaQuantidade, setMesmaQuantidade] = React.useState(true);
  const [quantidade, setQuantidade] = React.useState<number>(Math.max(1, quantidadePorPonto));
  const [motivo, setMotivo] = React.useState('');

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onFechar();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  // Mesma categoria primeiro: na troca, quase sempre é o equivalente.
  const catalogo = React.useMemo(
    () => catalogoParaSubstituicao()
      .filter(r => !mesmoItem(item, r))
      .sort((a, b) => Number(b.categoria === item.categoria) - Number(a.categoria === item.categoria)),
    [item]
  );

  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const resultados = catalogo
    .filter(r => {
      const alvo = semAcento(`${r.codigo} ${r.descricao} ${r.categoria}`);
      return termos.every(t => alvo.indexOf(t) >= 0);
    })
    .slice(0, 40);

  const novoItem: IRefItemBom | undefined = manual
    ? (descricaoManual.trim() ? { codigo: codigoManual.trim(), descricao: descricaoManual.trim(), categoria: categoriaManual } : undefined)
    : escolhido;

  const motivoOk = motivo.trim().length >= 3;
  const quantidadeOk = mesmaQuantidade || quantidade >= 1;
  const podeConfirmar = motivoOk && (acao === 'remover' || (!!novoItem && quantidadeOk));

  const confirmar = (): void => {
    if (!podeConfirmar) {
      return;
    }
    onConfirmar({
      acao,
      adicionado: acao === 'substituir' ? novoItem : undefined,
      quantidadePorPonto: acao === 'substituir' && !mesmaQuantidade ? quantidade : undefined,
      motivo: motivo.trim()
    });
  };

  const rotulo: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 700, color: COR.azul, margin: '0 0 5px' };
  const opcaoAcao = (id: AcaoAlteracaoItem, texto: string, descricao: string): React.ReactElement => (
    <button
      type="button"
      aria-pressed={acao === id}
      onClick={() => setAcao(id)}
      style={{
        flex: '1 1 0', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontFamily: FONTE,
        border: `${acao === id ? 2 : 1}px solid ${acao === id ? COR.ciano : COR.borda}`,
        background: acao === id ? '#E6F9FC' : '#FFFFFF'
      }}
    >
      <strong style={{ display: 'block', fontSize: '13px', color: COR.azul }}>{texto}</strong>
      <span style={{ fontSize: '11.5px', color: COR.texto2 }}>{descricao}</span>
    </button>
  );

  return (
    <div
      role="presentation"
      onClick={onFechar}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, background: 'rgba(32,42,68,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: FONTE }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-alterar-item"
        onClick={e => e.stopPropagation()}
        style={{ background: '#FFFFFF', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(32,42,68,.25)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COR.borda}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconeKit nome="trocar" tamanho={19} cor={COR.indigo} />
          <h3 id="titulo-alterar-item" style={{ margin: 0, fontSize: '16px', color: COR.azul }}>Trocar ou cancelar item</h3>
          <button type="button" aria-label="Fechar" onClick={onFechar} style={{ marginLeft: 'auto', border: 0, background: 'transparent', fontSize: '20px', color: COR.texto2, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 20px' }}>

          {/* item que sai */}
          <div style={{ border: `1px solid #F3B8B3`, background: '#FEF6F5', borderRadius: '10px', padding: '10px 12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11.5px', color: VERMELHO_ALT, fontWeight: 700, marginBottom: '3px' }}>Sai do kit de {nomePonto}</div>
            <div style={{ color: COR.azul, fontWeight: 700, fontSize: '13.5px' }}>{item.descricao}</div>
            <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>
              {item.codigo || 'sem código'} · {item.categoria} · {quantidadePorPonto.toLocaleString('pt-BR')} por ponto
              {pontosIguais > 1 ? ` × ${pontosIguais} pontos = ${item.quantidade.toLocaleString('pt-BR')}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {opcaoAcao('substituir', 'Substituir por outro item', 'O item sai e outro entra no lugar.')}
            {opcaoAcao('remover', 'Só cancelar o item', 'O item sai do kit sem substituto.')}
          </div>

          {acao === 'substituir' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <label style={{ ...rotulo, margin: 0 }} htmlFor="busca-item-novo">Item que entra</label>
                <button
                  type="button"
                  onClick={() => setManual(!manual)}
                  style={{ border: 0, background: 'transparent', color: COR.indigo, fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: FONTE, padding: 0 }}
                >
                  {manual ? 'Escolher do catálogo' : 'Não está no catálogo? Informar à mão'}
                </button>
              </div>

              {!manual && (
                <>
                  <input
                    id="busca-item-novo"
                    autoFocus
                    value={busca}
                    placeholder="Buscar por código ou descrição"
                    onChange={e => setBusca(e.target.value)}
                    style={campo}
                  />
                  <div role="listbox" aria-label="Itens do catálogo" style={{ border: `1px solid ${COR.borda}`, borderRadius: '8px', marginTop: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {resultados.length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: '12.5px', color: COR.texto2 }}>Nenhum item encontrado. Tente outro termo ou informe o item à mão.</div>
                    )}
                    {resultados.map((r, n) => {
                      const marcado = !!escolhido && mesmoItem(escolhido, r) && escolhido.descricao === r.descricao;
                      return (
                        <button
                          key={`${r.codigo}-${n}`}
                          type="button"
                          role="option"
                          aria-selected={marcado}
                          onClick={() => setEscolhido(r)}
                          style={{
                            display: 'flex', gap: '10px', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0,
                            borderTop: n ? `1px solid ${COR.borda}` : 0, cursor: 'pointer', fontFamily: FONTE,
                            background: marcado ? '#E6F9FC' : '#FFFFFF'
                          }}
                        >
                          <span style={{ fontFamily: 'Consolas, monospace', fontSize: '12px', color: COR.texto2, minWidth: '86px' }}>{r.codigo || 'sem código'}</span>
                          <span style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: '13px', color: COR.azul, fontWeight: marcado ? 700 : 600 }}>{r.descricao}</span>
                            <span style={{ fontSize: '11.5px', color: COR.texto2 }}>{r.categoria}</span>
                          </span>
                          {marcado && <IconeKit nome="check" tamanho={16} cor={COR.ciano} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {manual && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)', gap: '8px' }}>
                  <div>
                    <label style={rotulo} htmlFor="codigo-manual">Código CIGAM</label>
                    <input id="codigo-manual" value={codigoManual} onChange={e => setCodigoManual(e.target.value)} placeholder="Opcional" style={campo} />
                  </div>
                  <div>
                    <label style={rotulo} htmlFor="descricao-manual">Descrição</label>
                    <input id="descricao-manual" value={descricaoManual} onChange={e => setDescricaoManual(e.target.value)} style={campo} />
                  </div>
                  <div>
                    <label style={rotulo} htmlFor="categoria-manual">Categoria</label>
                    <select id="categoria-manual" value={categoriaManual} onChange={e => setCategoriaManual(e.target.value as CategoriaItem)} style={campo}>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ alignSelf: 'end', fontSize: '11.5px', color: AMBAR, paddingBottom: '8px' }}>
                    {codigoManual.trim() ? '' : 'Sem código, o item entra como pendente (não orçável até o cadastro).'}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '14px' }}>
                <label style={rotulo}>Quantidade do novo item</label>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px', color: COR.azul }}>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name="qtd-novo" checked={mesmaQuantidade} onChange={() => setMesmaQuantidade(true)} />
                    A mesma do item removido
                  </label>
                  <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
                    <input type="radio" name="qtd-novo" checked={!mesmaQuantidade} onChange={() => setMesmaQuantidade(false)} />
                    Outra:
                  </label>
                  <input
                    type="number"
                    min={1}
                    aria-label="Quantidade por ponto"
                    value={quantidade}
                    disabled={mesmaQuantidade}
                    onChange={e => setQuantidade(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    style={{ ...campo, width: '90px' }}
                  />
                  <span style={{ fontSize: '12px', color: COR.texto2 }}>por ponto{pontosIguais > 1 ? ` (× ${pontosIguais} pontos iguais)` : ''}</span>
                </div>
                {mesmaQuantidade && (
                  <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '4px' }}>
                    Acompanha o kit: se o número de câmeras mudar, a quantidade muda junto.
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: '14px' }}>
            <label style={rotulo} htmlFor="motivo-alteracao">Motivo</label>
            <textarea
              id="motivo-alteracao"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex.: cliente já tem o equipamento; modelo descontinuado; pedido do comercial"
              style={{ ...campo, resize: 'vertical' }}
            />
            {!motivoOk && motivo.length > 0 && <div style={{ fontSize: '11.5px', color: VERMELHO_ALT, marginTop: '3px' }}>Descreva o motivo (fica no histórico).</div>}
          </div>

          <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IconeKit nome="relogio" tamanho={14} />
            Fica no histórico como {usuarioNome || 'usuário não identificado'}, com data e hora. Para voltar atrás, use Desfazer: a alteração continua registrada.
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${COR.borda}`, display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" style={botao('secundario')} onClick={onFechar}>Cancelar</button>
          <button type="button" style={botao(acao === 'remover' ? 'perigo' : 'principal', !podeConfirmar)} disabled={!podeConfirmar} onClick={confirmar}>
            {acao === 'remover' ? 'Cancelar item' : 'Substituir item'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Histórico de alterações
// ------------------------------------------------------------

const linhaItem = (sinal: '−' | '+', ref: IRefItemBom, quantidade: number, cor: string, riscar: boolean): React.ReactElement => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '12.5px' }}>
    <strong style={{ color: cor, width: '12px', flexShrink: 0 }}>{sinal}</strong>
    <span style={{ color: COR.azul, textDecoration: riscar ? 'line-through' : undefined }}>
      {ref.descricao}
      <span style={{ color: COR.texto2 }}> · {ref.codigo || 'sem código'}{quantidade > 0 ? ` · ${quantidade.toLocaleString('pt-BR')} un.` : ''}</span>
    </span>
  </div>
);

export interface IHistoricoAlteracoesProps {
  registros: Array<IAlteracaoAplicada | IRegistroAlteracaoBom>;
  // Mostra o ponto e o kit de cada alteração (visão do projeto).
  mostrarPonto?: boolean;
  onDesfazer?: (registro: IAlteracaoAplicada) => void;
  desabilitado?: boolean;
}

export const HistoricoAlteracoes: React.FC<IHistoricoAlteracoesProps> = ({ registros, mostrarPonto, onDesfazer, desabilitado }) => {
  if (registros.length === 0) {
    return null;
  }
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {registros.map(r => {
        const a = r.alteracao;
        const desfeita = r.situacao === 'desfeita';
        const doProjeto = r as IRegistroAlteracaoBom;
        return (
          <li
            key={a.id}
            style={{
              border: `1px solid ${COR.borda}`, borderLeft: `4px solid ${SITUACAO[r.situacao].cor}`, borderRadius: '8px',
              padding: '9px 12px', background: desfeita ? COR.fundo : '#FFFFFF'
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '5px' }}>
              <IconeKit nome={a.acao === 'substituir' ? 'trocar' : 'lixeira'} tamanho={15} cor={COR.indigo} />
              <strong style={{ fontSize: '13px', color: COR.azul }}>
                {a.acao === 'substituir' ? 'Item substituído' : 'Item cancelado'}
                {mostrarPonto && doProjeto.pontoNome ? ` · ${doProjeto.pontoNome}` : ''}
              </strong>
              {mostrarPonto && doProjeto.kit && <span style={{ fontSize: '12px', color: COR.texto2 }}>{doProjeto.kit}</span>}
              <SeloSituacao situacao={r.situacao} />
              {onDesfazer && r.situacao !== 'desfeita' && (
                <button
                  type="button"
                  disabled={desabilitado}
                  onClick={() => onDesfazer(r)}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', border: `1px solid ${COR.borda}`, background: '#FFFFFF', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', fontWeight: 700, color: COR.azul, cursor: desabilitado ? 'not-allowed' : 'pointer', fontFamily: FONTE }}
                >
                  <IconeKit nome="desfazer" tamanho={13} /> Desfazer
                </button>
              )}
            </div>
            {linhaItem('−', a.removido, r.quantidadeRemovida, VERMELHO_ALT, true)}
            {a.acao === 'substituir' && a.adicionado && linhaItem('+', a.adicionado, r.quantidadeAdicionada, VERDE_ALT, false)}
            <div style={{ fontSize: '12px', color: COR.azul, marginTop: '5px' }}><strong>Motivo:</strong> {a.motivo || '—'}</div>
            <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>Feita por {quemQuando(a.por, a.em)}</div>
            {a.desfeita && (
              <div style={{ fontSize: '11.5px', color: COR.texto2, marginTop: '2px' }}>
                Desfeita por {quemQuando(a.desfeita.por, a.desfeita.em)}{a.desfeita.motivo ? ` · ${a.desfeita.motivo}` : ''}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
