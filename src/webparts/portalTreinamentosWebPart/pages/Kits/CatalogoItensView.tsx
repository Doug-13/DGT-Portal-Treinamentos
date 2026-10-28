import * as React from 'react';

import {
  CategoriaItem
} from '../../services/bom/catalogoKits';

import {
  ICatalogoKitsCarregado,
  IItemKit,
  usosDoItem
} from '../../services/bom/KitsService';

import {
  SITUACOES_ITEM,
  SituacaoItemKit,
  TIPOS_ITEM,
  TipoItemKit
} from '../../services/bom/esquemaKits';

import {
  Aviso,
  COR,
  CampoMotivo,
  Interruptor,
  Modal,
  Numero,
  Selo,
  TomSelo,
  ajuda,
  botao,
  campo,
  painel,
  rotulo
} from './kitsComum';

// ============================================================
// KITS — EQUIPAMENTOS E ITENS
//
// Tudo o que o montador pode colocar num B.O.M.: equipamentos
// homologados (câmeras, switches, controladores) e os itens que
// compõem os kits (estrutura, infraestrutura, serviços, licenças,
// adesivos). Nada é excluído: item fora de uso é DESATIVADO.
// ============================================================

const CATEGORIAS: CategoriaItem[] = ['Estrutura', 'Câmera', 'Equipamento', 'Infraestrutura', 'Licença', 'Serviço', 'Identificação'];

const TOM_SITUACAO: Record<SituacaoItemKit, TomSelo> = {
  Homologado: 'ciano',
  'Em homologação': 'indigo',
  Descontinuado: 'cinza'
};

const nomeTipo = (tipo: TipoItemKit): string =>
  (TIPOS_ITEM.find(t => t.tipo === tipo) || { nome: tipo }).nome;

// Resumo técnico em uma linha.
export const resumoAtributos = (item: IItemKit): string => {
  const a = item.atributos;
  const partes: string[] = [];
  if (item.tipo === 'cameraVideo' || item.tipo === 'cameraOcr') {
    if (a.formato) { partes.push(a.formato); }
    if (a.zoomOptico) { partes.push('zoom óptico'); }
    if (a.consumoW) { partes.push(`${String(a.consumoW).replace('.', ',')} W`); }
  }
  if (item.tipo === 'switch') {
    partes.push(a.poe ? `PoE ${String(a.orcamentoW || 0).replace('.', ',')} W em ${a.portasPoe || 0} portas` : 'sem PoE');
    if (a.usoCatraca) { partes.push('usado na catraca'); }
  }
  if (a.padrao) { partes.push('padrão'); }
  return partes.join(', ');
};

const gerarChave = (descricao: string, existentes: string[]): string => {
  const base = descricao
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').slice(0, 5)
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') || 'item';
  let chave = base;
  let n = 2;
  while (existentes.indexOf(chave) >= 0) {
    chave = `${base}${n++}`;
  }
  return chave;
};

// ------------------------------------------------------------
// Editor (novo / alterar)
// ------------------------------------------------------------

interface IEditorProps {
  item?: IItemKit;
  catalogo: ICatalogoKitsCarregado;
  podeEditar: boolean;
  aoFechar: () => void;
  aoSalvar: (item: IItemKit, anterior: IItemKit | undefined, motivo: string) => Promise<void>;
}

const EditorItem: React.FC<IEditorProps> = ({ item, catalogo, podeEditar, aoFechar, aoSalvar }) => {

  const novo = !item;
  const [dados, setDados] = React.useState<IItemKit>(() => item
    ? { ...item, atributos: { ...item.atributos } }
    : { chave: '', tipo: 'item', codigo: '', descricao: '', categoria: 'Infraestrutura', situacao: 'Homologado', observacao: '', ordem: 99, ativo: true, atributos: {} });
  const [motivo, setMotivo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudar = (parcial: Partial<IItemKit>): void => setDados(atual => ({ ...atual, ...parcial }));
  const mudarAtributo = (parcial: Partial<IItemKit['atributos']>): void => setDados(atual => ({ ...atual, atributos: { ...atual.atributos, ...parcial } }));

  const usos = item ? usosDoItem(item.chave, catalogo.composicoes) : [];
  const camera = dados.tipo === 'cameraVideo' || dados.tipo === 'cameraOcr';
  const equipamento = dados.tipo !== 'item';
  const bloqueado = !podeEditar || salvando;

  const codigoRepetido = dados.codigo.trim() !== '' && catalogo.itens.some(outro =>
    outro.chave !== dados.chave && outro.ativo && outro.codigo.trim() === dados.codigo.trim() && outro.tipo === dados.tipo);

  const salvar = async (): Promise<void> => {
    if (!dados.descricao.trim()) {
      setErro(equipamento ? 'Informe o modelo.' : 'Informe a descrição do item.');
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe o motivo da alteração: ele vai para o histórico.');
      return;
    }
    const final: IItemKit = {
      ...dados,
      chave: dados.chave || (dados.tipo === 'item'
        ? gerarChave(dados.descricao, catalogo.itens.map(i => i.chave))
        : `${dados.tipo}:${dados.codigo.trim() || dados.descricao.trim()}`),
      categoria: camera ? 'Câmera' : equipamento ? 'Equipamento' : dados.categoria
    };
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar(final, item, motivo.trim());
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={novo ? 'Novo item ou equipamento' : (podeEditar ? 'Alterar item' : 'Detalhes do item')}
      subtitulo={novo ? 'Ele passa a aparecer no montador assim que for salvo.' : `Chave interna: ${dados.chave}`}
      aoFechar={aoFechar}
      largura={680}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>{podeEditar ? 'Cancelar' : 'Fechar'}</button>
          {podeEditar && <button type="button" style={botao('principal', salvando)} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar item'}</button>}
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {!dados.ativo && <Aviso tipo="info">Item desativado: não aparece para escolha no montador.</Aviso>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div>
          <label style={rotulo} htmlFor="kit-item-tipo">Tipo</label>
          <select id="kit-item-tipo" style={campo} value={dados.tipo} disabled={!novo || bloqueado} onChange={e => mudar({ tipo: e.target.value as TipoItemKit, atributos: {} })}>
            {TIPOS_ITEM.map(t => <option key={t.tipo} value={t.tipo}>{t.nome}</option>)}
          </select>
          <div style={ajuda}>{(TIPOS_ITEM.find(t => t.tipo === dados.tipo) || TIPOS_ITEM[0]).ajuda}</div>
        </div>

        {!equipamento && (
          <div>
            <label style={rotulo} htmlFor="kit-item-categoria">Categoria no B.O.M.</label>
            <select id="kit-item-categoria" style={campo} value={dados.categoria} disabled={bloqueado} onChange={e => mudar({ categoria: e.target.value as CategoriaItem })}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={ajuda}>Define o grupo em que o item aparece na lista final.</div>
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="kit-item-descricao">{equipamento ? 'Modelo' : 'Descrição'}</label>
          <input id="kit-item-descricao" style={campo} value={dados.descricao} disabled={bloqueado} onChange={e => mudar({ descricao: e.target.value })} placeholder={equipamento ? 'Ex.: Intelbras VIP 5440 D Z IA' : 'Ex.: Abraçadeira náilon preta 283x4,80 mm'} />
        </div>

        <div>
          <label style={rotulo} htmlFor="kit-item-codigo">Código CIGAM</label>
          <input id="kit-item-codigo" style={campo} value={dados.codigo} disabled={bloqueado} onChange={e => mudar({ codigo: e.target.value })} placeholder="Ex.: 3100050082" />
          <div style={ajuda}>{dados.codigo.trim() ? (codigoRepetido ? 'Atenção: outro item ativo do mesmo tipo já usa este código.' : 'É o código que vai para a planilha do CIGAM.') : 'Sem código o item entra no B.O.M. como pendente (não orçável).'}</div>
        </div>

        <div>
          <label style={rotulo} htmlFor="kit-item-situacao">Situação</label>
          <select id="kit-item-situacao" style={campo} value={dados.situacao} disabled={bloqueado} onChange={e => mudar({ situacao: e.target.value as SituacaoItemKit })}>
            {SITUACOES_ITEM.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={ajuda}>Descontinuado sai da escolha no montador, como um item desativado.</div>
        </div>
      </div>

      {camera && (
        <div style={{ marginTop: '18px', padding: '14px 16px', background: '#F7F8FA', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={rotulo} htmlFor="kit-item-formato">Formato</label>
            <select id="kit-item-formato" style={campo} value={dados.atributos.formato || 'Bullet'} disabled={bloqueado} onChange={e => mudarAtributo({ formato: e.target.value as 'Dome' | 'Bullet' })}>
              <option value="Bullet">Bullet</option>
              <option value="Dome">Dome</option>
            </select>
          </div>
          <div>
            <label style={rotulo}>Consumo (W)</label>
            <Numero valor={Number(dados.atributos.consumoW) || 0} passo={0.1} maximo={200} desabilitado={bloqueado} rotuloAcessivel="Consumo em watts" aoMudar={n => mudarAtributo({ consumoW: n })} />
          </div>
          <Interruptor marcado={!!dados.atributos.zoomOptico} desabilitado={bloqueado} texto="Zoom óptico" aoMudar={v => mudarAtributo({ zoomOptico: v })} />
          <Interruptor marcado={!!dados.atributos.padrao} desabilitado={bloqueado} texto="Modelo padrão" aoMudar={v => mudarAtributo({ padrao: v })} />
          <div style={{ ...ajuda, gridColumn: '1 / -1', marginTop: 0 }}>O consumo entra no cálculo do orçamento PoE do switch (com margem). Face Detect em ponto alto pede zoom óptico.</div>
        </div>
      )}

      {dados.tipo === 'switch' && (
        <div style={{ marginTop: '18px', padding: '14px 16px', background: '#F7F8FA', borderRadius: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <Interruptor marcado={!!dados.atributos.poe} desabilitado={bloqueado} texto="Tem PoE" aoMudar={v => mudarAtributo({ poe: v })} />
          <div>
            <label style={rotulo}>Orçamento PoE (W)</label>
            <Numero valor={Number(dados.atributos.orcamentoW) || 0} passo={1} maximo={2000} desabilitado={bloqueado || !dados.atributos.poe} rotuloAcessivel="Orçamento PoE" aoMudar={n => mudarAtributo({ orcamentoW: n })} />
          </div>
          <div>
            <label style={rotulo}>Portas PoE</label>
            <Numero valor={Number(dados.atributos.portasPoe) || 0} maximo={96} desabilitado={bloqueado || !dados.atributos.poe} rotuloAcessivel="Portas PoE" aoMudar={n => mudarAtributo({ portasPoe: n })} />
          </div>
          <Interruptor marcado={!!dados.atributos.padrao} desabilitado={bloqueado} texto="Switch padrão" aoMudar={v => mudarAtributo({ padrao: v })} />
          <Interruptor marcado={!!dados.atributos.usoCatraca} desabilitado={bloqueado} texto="Usado nas catracas" aoMudar={v => mudarAtributo({ usoCatraca: v })} />
        </div>
      )}

      {dados.tipo === 'controladorPorta' && (
        <div style={{ marginTop: '18px' }}>
          <Interruptor marcado={!!dados.atributos.padrao} desabilitado={bloqueado} texto="Controlador padrão nas portas" aoMudar={v => mudarAtributo({ padrao: v })} />
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <label style={rotulo} htmlFor="kit-item-obs">Observação</label>
        <textarea id="kit-item-obs" rows={2} style={{ ...campo, resize: 'vertical' }} value={dados.observacao} disabled={bloqueado} onChange={e => mudar({ observacao: e.target.value })} placeholder="Ex.: escassa até novembro; confirmar prazo com suprimentos." />
      </div>

      {!novo && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${COR.cinzaClaro}` }}>
          <Interruptor marcado={dados.ativo} desabilitado={bloqueado} texto={dados.ativo ? 'Item ativo' : 'Item desativado'} aoMudar={v => mudar({ ativo: v })} />
          {usos.length > 0 && (
            <div style={ajuda}>
              Usado em: <strong>{usos.join(', ')}</strong>.{!dados.ativo && ' Ao desativar, esses kits continuam levando o item e o montador avisa — retire-o da composição se for o caso.'}
            </div>
          )}
        </div>
      )}

      {podeEditar && <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={salvando} />}
    </Modal>
  );
};

// ------------------------------------------------------------
// Lista
// ------------------------------------------------------------

export interface ICatalogoItensViewProps {
  catalogo: ICatalogoKitsCarregado;
  podeEditar: boolean;
  chaveInicial?: string;
  aoSalvarItem: (item: IItemKit, anterior: IItemKit | undefined, motivo: string) => Promise<void>;
}

type FiltroTipo = 'todos' | TipoItemKit;

const CatalogoItensView: React.FC<ICatalogoItensViewProps> = ({ catalogo, podeEditar, chaveInicial, aoSalvarItem }) => {

  const [tipo, setTipo] = React.useState<FiltroTipo>('todos');
  const [categoria, setCategoria] = React.useState<string>('');
  const [busca, setBusca] = React.useState('');
  const [inativos, setInativos] = React.useState(false);
  const [soPendentes, setSoPendentes] = React.useState(false);
  const [editando, setEditando] = React.useState<IItemKit | 'novo' | undefined>(undefined);

  React.useEffect(() => {
    if (chaveInicial) {
      const alvo = catalogo.itens.find(i => i.chave === chaveInicial);
      if (alvo) {
        setEditando(alvo);
      }
    }
    // Só quando outra tela pede para abrir um item específico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveInicial]);

  const termo = busca.trim().toLowerCase();

  const visiveis = catalogo.itens
    .filter(i => tipo === 'todos' || i.tipo === tipo)
    .filter(i => !categoria || i.categoria === categoria)
    .filter(i => inativos || i.ativo)
    .filter(i => !soPendentes || !i.codigo.trim())
    .filter(i => !termo || `${i.descricao} ${i.codigo} ${i.chave}`.toLowerCase().indexOf(termo) >= 0)
    .sort((a, b) =>
      TIPOS_ITEM.map(t => t.tipo).indexOf(a.tipo) - TIPOS_ITEM.map(t => t.tipo).indexOf(b.tipo) ||
      CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) ||
      a.descricao.localeCompare(b.descricao));

  const contagem = (t: FiltroTipo): number =>
    catalogo.itens.filter(i => (t === 'todos' || i.tipo === t) && (inativos || i.ativo)).length;

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: '999px',
    border: `1px solid ${ativo ? COR.azul : COR.cinzaClaro}`,
    background: ativo ? COR.azul : COR.branco,
    color: ativo ? COR.branco : COR.azul,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit'
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }} role="tablist" aria-label="Tipo de item">
        {(['todos', ...TIPOS_ITEM.map(t => t.tipo)] as FiltroTipo[]).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tipo === t} style={chip(tipo === t)} onClick={() => { setTipo(t); setCategoria(''); }}>
            {t === 'todos' ? 'Todos' : (TIPOS_ITEM.find(x => x.tipo === t) || { plural: t }).plural} <span style={{ opacity: 0.7, fontWeight: 500 }}>({contagem(t)})</span>
          </button>
        ))}
      </div>

      <div style={{ ...painel, padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
        <input aria-label="Buscar item" style={{ ...campo, flex: '1 1 240px', width: 'auto' }} placeholder="Buscar por descrição, modelo ou código CIGAM" value={busca} onChange={e => setBusca(e.target.value)} />
        {tipo === 'item' && (
          <select aria-label="Categoria" style={{ ...campo, width: 'auto', flex: '0 0 190px' }} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <Interruptor marcado={soPendentes} aoMudar={setSoPendentes} texto="Só sem código CIGAM" />
        <Interruptor marcado={inativos} aoMudar={setInativos} texto="Mostrar desativados" />
        {podeEditar && (
          <button type="button" style={{ ...botao('principal'), marginLeft: 'auto' }} onClick={() => setEditando('novo')}>+ Novo item</button>
        )}
      </div>

      <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', color: COR.azul, minWidth: '760px' }}>
          <thead>
            <tr style={{ background: COR.azul, color: COR.branco, textAlign: 'left' }}>
              {['Item', 'Código CIGAM', 'Tipo', 'Situação', 'Usado em', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: `3px solid ${COR.ciano}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: COR.texto2 }}>
                Nenhum item com esses filtros.{podeEditar && ' Use "+ Novo item" para cadastrar.'}
              </td></tr>
            )}
            {visiveis.map(item => {
              const usos = usosDoItem(item.chave, catalogo.composicoes);
              const resumo = resumoAtributos(item);
              return (
                <tr key={item.chave} style={{ borderTop: `1px solid ${COR.cinzaClaro}`, opacity: item.ativo ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 600 }}>{item.descricao}</div>
                    {(resumo || item.observacao) && <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>{[resumo, item.observacao].filter(Boolean).join(' — ')}</div>}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                    {item.codigo.trim() ? item.codigo : <Selo tom="indigo" titulo="Entra no B.O.M. como pendente">! sem código</Selo>}
                  </td>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{item.tipo === 'item' ? item.categoria : nomeTipo(item.tipo)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {item.ativo ? <Selo tom={TOM_SITUACAO[item.situacao]}>{item.situacao}</Selo> : <Selo tom="cinza">Desativado</Selo>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12.5px', color: usos.length ? COR.azul : COR.texto2 }}>
                    {item.tipo === 'item' ? (usos.length ? usos.join(', ') : 'nenhum kit') : 'escolha no ponto'}
                  </td>
                  <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                    <button type="button" style={botao('secundario')} onClick={() => setEditando(item)}>{podeEditar ? 'Alterar' : 'Ver'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editando && (
        <EditorItem
          item={editando === 'novo' ? undefined : editando}
          catalogo={catalogo}
          podeEditar={podeEditar}
          aoFechar={() => setEditando(undefined)}
          aoSalvar={aoSalvarItem}
        />
      )}
    </div>
  );
};

export default CatalogoItensView;
