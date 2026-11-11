import * as React from 'react';

import {
  IFluxoDefinicao
} from '../../models/Fluxo';

import {
  ICONES_AMBIENTE,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  Icones,
  IconeChave
} from '../../components/common/Icones';

import {
  COLUNAS_BASE,
  CORES_VISAO,
  FiltroVisao,
  IAmbienteLayout,
  IVisaoAmbiente,
  PREFIXO_CAMPO_COLUNA,
  camposFiltraveis,
  etapasDoFluxo,
  layoutPadrao,
  novaVisao
} from '../../services/ambientes/layoutAmbiente';

import {
  COR,
  CaixaMensagem,
  FONTE,
  botao,
  campo
} from '../Orcamento/orcamentoComum';

// ============================================================
// PERSONALIZAR TELAS DO AMBIENTE (Administrador do ambiente)
//
//   Visões da tela inicial → cards de resumo com contagem e filtro
//   Colunas da lista       → campos básicos e campos do fluxo
//   Etapas do processo     → barra de etapas da tela do registro
//   Tela do registro       → dados, diagrama, histórico
// ============================================================

export interface IAmbienteLayoutEditorProps {
  layout: IAmbienteLayout;
  definicao?: IFluxoDefinicao;
  disponivel: boolean;
  processando: boolean;
  onSalvar: (layout: IAmbienteLayout) => Promise<string[]>;
  onFechar: () => void;
}

const TIPOS_FILTRO: Array<{ tipo: FiltroVisao['tipo']; nome: string }> = [
  { tipo: 'todos', nome: 'Todos os registros' },
  { tipo: 'aguardandoVoce', nome: 'Aguardando quem está vendo' },
  { tipo: 'meus', nome: 'Abertos por quem está vendo' },
  { tipo: 'etapas', nome: 'Estão na(s) etapa(s)...' },
  { tipo: 'situacao', nome: 'Situação...' },
  { tipo: 'atrasados', nome: 'Com prazo vencido' },
  { tipo: 'campo', nome: 'Campo do fluxo (Lista, Sim-Não ou faixa da Avaliação)...' }
];

const SITUACOES: Array<{ valor: SituacaoRegistroAmbiente; nome: string }> = [
  { valor: 'emAndamento', nome: 'Em andamento' },
  { valor: 'concluido', nome: 'Concluído' },
  { valor: 'cancelado', nome: 'Cancelado' }
];

const secao: React.CSSProperties = {
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  padding: '12px 14px',
  margin: '0 0 14px'
};

const legenda: React.CSSProperties = {
  padding: '0 6px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: COR.azul
};

const ajuda: React.CSSProperties = { fontSize: '12px', color: COR.texto2, margin: '0 0 8px' };

const pequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '28px',
  minWidth: '28px',
  padding: '0 8px',
  borderRadius: '6px',
  border: `1px solid ${perigo ? '#B42318' : COR.borda}`,
  background: '#FFFFFF',
  color: perigo ? '#B42318' : COR.azul,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: 'pointer'
});

const mover = <T,>(lista: T[], indice: number, direcao: -1 | 1): T[] => {
  const destino = indice + direcao;
  if (destino < 0 || destino >= lista.length) {
    return lista;
  }
  const copia = lista.slice();
  const [item] = copia.splice(indice, 1);
  copia.splice(destino, 0, item);
  return copia;
};

const AmbienteLayoutEditor: React.FC<IAmbienteLayoutEditorProps> = (props) => {

  const [layout, setLayout] = React.useState<IAmbienteLayout>(props.layout);
  const [erros, setErros] = React.useState<string[]>([]);

  const definicao = props.definicao;
  const etapasFluxo = etapasDoFluxo(definicao);
  const metadados = ((definicao && definicao.metadados) || []).filter(item => item.tipo !== 'tabela');
  const filtraveis = camposFiltraveis(definicao);

  const nomeEtapa = (id: string): string => {
    const elemento = etapasFluxo.find(item => item.id === id);
    return elemento ? elemento.nome : '(etapa removida do fluxo)';
  };

  const alterarVisao = (id: string, parcial: Partial<IVisaoAmbiente>): void =>
    setLayout(atual => ({ ...atual, visoes: atual.visoes.map(item => (item.id === id ? { ...item, ...parcial } : item)) }));

  const trocarTipoFiltro = (visao: IVisaoAmbiente, tipo: FiltroVisao['tipo']): void => {
    const filtro: FiltroVisao =
      tipo === 'etapas' ? { tipo, etapas: [] }
        : tipo === 'situacao' ? { tipo, situacoes: ['emAndamento'] }
          : tipo === 'campo' ? { tipo, campo: filtraveis[0] ? filtraveis[0].chave : '', valores: [] }
            : { tipo } as FiltroVisao;
    alterarVisao(visao.id, { filtro });
  };

  const alternar = (lista: string[], valor: string): string[] =>
    lista.indexOf(valor) >= 0 ? lista.filter(item => item !== valor) : lista.concat(valor);

  const validar = (): string[] => {
    const problemas: string[] = [];
    layout.visoes.forEach(visao => {
      if (!visao.nome.trim()) {
        problemas.push('Há uma visão sem nome.');
      }
      if (visao.filtro.tipo === 'etapas' && visao.filtro.etapas.length === 0) {
        problemas.push(`Visão "${visao.nome}": marque ao menos uma etapa.`);
      }
      if (visao.filtro.tipo === 'situacao' && visao.filtro.situacoes.length === 0) {
        problemas.push(`Visão "${visao.nome}": marque ao menos uma situação.`);
      }
      if (visao.filtro.tipo === 'campo' && (!visao.filtro.campo || visao.filtro.valores.length === 0)) {
        problemas.push(`Visão "${visao.nome}": escolha o campo e ao menos um valor.`);
      }
    });
    if (layout.colunas.length === 0) {
      problemas.push('Escolha ao menos uma coluna para a lista.');
    }
    if (layout.visoes.length > 8) {
      problemas.push('Use no máximo 8 visões na tela inicial.');
    }
    return problemas;
  };

  const salvar = async (): Promise<void> => {
    const problemas = validar();
    setErros(problemas);
    if (problemas.length > 0) {
      return;
    }
    const resultado = await props.onSalvar(layout);
    setErros(resultado);
  };

  const opcoesCampo = (chave: string): Array<{ valor: string; nome: string }> => {
    const meta = filtraveis.find(item => item.chave === chave);
    if (!meta) {
      return [];
    }
    if (meta.tipo === 'avaliacao') {
      return (meta.avaliacao ? meta.avaliacao.faixas : []).map(faixa => ({ valor: faixa.chave, nome: faixa.rotulo }));
    }
    return meta.tipo === 'simNao'
      ? [{ valor: 'sim', nome: 'Sim' }, { valor: 'nao', nome: 'Não' }]
      : (meta.opcoes || []).map(opcao => ({ valor: opcao, nome: opcao }));
  };

  // Colunas: escolhidas (na ordem) + disponíveis.
  const todasColunas: Array<{ chave: string; nome: string }> = [
    ...COLUNAS_BASE.map(item => ({ chave: item.chave, nome: item.rotulo })),
    ...metadados.map(item => ({ chave: `${PREFIXO_CAMPO_COLUNA}${item.chave}`, nome: `${item.rotulo} (campo do fluxo)` }))
  ];
  const nomeColuna = (chave: string): string => (todasColunas.find(item => item.chave === chave) || { nome: chave }).nome;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="layout-editor-titulo"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px', fontFamily: FONTE }}
    >
      <div style={{ width: '100%', maxWidth: '900px', background: '#FFFFFF', borderRadius: '10px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 id="layout-editor-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 700, flex: 1 }}>Personalizar telas do ambiente</h2>
          <button type="button" aria-label="Fechar" disabled={props.processando} onClick={props.onFechar} style={{ border: 0, background: 'transparent', color: '#FFFFFF', fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '16px 20px' }}>

          {!props.disponivel && (
            <CaixaMensagem tipo="alerta" texto="As colunas das telas configuráveis ainda não existem no Dataverse. Execute scripts/dataverse/criar-tabelas-ambientes.ps1 (ele só acrescenta o que falta) e recarregue o portal." />
          )}

          {!definicao && (
            <CaixaMensagem tipo="alerta" texto="O fluxo do ambiente ainda não tem versão publicada: etapas e campos aparecem aqui depois da publicação." />
          )}

          {/* VISÕES */}
          <fieldset style={secao}>
            <legend style={legenda}>Visões da tela inicial (cards)</legend>
            <p style={ajuda}>Cada visão vira um card com a contagem de registros; clicar nele filtra a lista. Ordem aqui = ordem na tela.</p>

            {layout.visoes.map((visao, indice) => {
              const IconeVisao = Icones[visao.icone] || Icones.grid;
              return (
                <div key={visao.id} style={{ border: `1px solid ${COR.borda}`, borderLeft: `4px solid ${visao.cor}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 170px 130px 1fr auto', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: visao.cor, display: 'inline-flex' }}><IconeVisao /></span>
                    <input aria-label="Nome da visão" value={visao.nome} maxLength={60} onChange={evento => alterarVisao(visao.id, { nome: evento.target.value })} style={campo} />
                    <select aria-label="Ícone" value={visao.icone} onChange={evento => alterarVisao(visao.id, { icone: evento.target.value as IconeChave })} style={campo}>
                      {ICONES_AMBIENTE.concat([{ chave: 'bell', nome: 'Sino' }, { chave: 'clock', nome: 'Relógio' }, { chave: 'alertTriangle', nome: 'Alerta' }]).map(item => <option key={item.chave} value={item.chave}>{item.nome}</option>)}
                    </select>
                    <select aria-label="Cor" value={visao.cor} onChange={evento => alterarVisao(visao.id, { cor: evento.target.value })} style={{ ...campo, color: visao.cor, fontWeight: 700 }}>
                      {CORES_VISAO.map(item => <option key={item.cor} value={item.cor}>{item.nome}</option>)}
                    </select>
                    <select aria-label="Filtro" value={visao.filtro.tipo} onChange={evento => trocarTipoFiltro(visao, evento.target.value as FiltroVisao['tipo'])} style={campo}>
                      {TIPOS_FILTRO.filter(item => item.tipo !== 'campo' || filtraveis.length > 0).map(item => <option key={item.tipo} value={item.tipo}>{item.nome}</option>)}
                    </select>
                    <span style={{ display: 'flex', gap: '4px' }}>
                      <button type="button" style={pequeno()} aria-label="Subir" disabled={indice === 0} onClick={() => setLayout(atual => ({ ...atual, visoes: mover(atual.visoes, indice, -1) }))}>↑</button>
                      <button type="button" style={pequeno()} aria-label="Descer" disabled={indice === layout.visoes.length - 1} onClick={() => setLayout(atual => ({ ...atual, visoes: mover(atual.visoes, indice, 1) }))}>↓</button>
                      <button type="button" style={pequeno(true)} aria-label="Remover visão" onClick={() => setLayout(atual => ({ ...atual, visoes: atual.visoes.filter(item => item.id !== visao.id) }))}>✕</button>
                    </span>
                  </div>

                  {visao.filtro.tipo === 'etapas' && (() => {
                    const filtro = visao.filtro;
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '13px' }}>
                        {etapasFluxo.map(etapa => (
                          <label key={etapa.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input type="checkbox" checked={filtro.etapas.indexOf(etapa.id) >= 0} onChange={() => alterarVisao(visao.id, { filtro: { tipo: 'etapas', etapas: alternar(filtro.etapas, etapa.id) } })} />
                            {etapa.nome}
                          </label>
                        ))}
                        {etapasFluxo.length === 0 && <span style={{ color: COR.texto2 }}>Publique o fluxo para escolher as etapas.</span>}
                      </div>
                    );
                  })()}

                  {visao.filtro.tipo === 'situacao' && (() => {
                    const filtro = visao.filtro;
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '13px' }}>
                        {SITUACOES.map(item => (
                          <label key={item.valor} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={filtro.situacoes.indexOf(item.valor) >= 0}
                              onChange={() => alterarVisao(visao.id, { filtro: { tipo: 'situacao', situacoes: alternar(filtro.situacoes, item.valor) as SituacaoRegistroAmbiente[] } })}
                            />
                            {item.nome}
                          </label>
                        ))}
                      </div>
                    );
                  })()}

                  {visao.filtro.tipo === 'campo' && (() => {
                    const filtro = visao.filtro;
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '8px', fontSize: '13px' }}>
                        <select aria-label="Campo" value={filtro.campo} onChange={evento => alterarVisao(visao.id, { filtro: { tipo: 'campo', campo: evento.target.value, valores: [] } })} style={{ ...campo, width: 'auto' }}>
                          {filtraveis.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
                        </select>
                        <span>=</span>
                        {opcoesCampo(filtro.campo).map(opcao => (
                          <label key={opcao.valor} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input type="checkbox" checked={filtro.valores.indexOf(opcao.valor) >= 0} onChange={() => alterarVisao(visao.id, { filtro: { tipo: 'campo', campo: filtro.campo, valores: alternar(filtro.valores, opcao.valor) } })} />
                            {opcao.nome}
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              );
            })}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button type="button" style={pequeno()} onClick={() => setLayout(atual => ({ ...atual, visoes: atual.visoes.concat(novaVisao()) }))}>+ Visão</button>
              <button type="button" style={pequeno()} onClick={() => setLayout(atual => ({ ...atual, visoes: layoutPadrao(definicao).visoes }))}>Restaurar visões padrão</button>
            </div>
          </fieldset>

          {/* COLUNAS */}
          <fieldset style={secao}>
            <legend style={legenda}>Colunas da lista</legend>
            <p style={ajuda}>Marque as colunas e ajuste a ordem. Campos do fluxo mostram o valor mais recente de cada registro.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px 14px' }}>
              {layout.colunas.map((chave, indice) => (
                <div key={chave} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <input type="checkbox" checked onChange={() => setLayout(atual => ({ ...atual, colunas: atual.colunas.filter(item => item !== chave) }))} />
                  <span style={{ flex: 1 }}>{indice + 1}. {nomeColuna(chave)}</span>
                  <button type="button" style={pequeno()} aria-label="Subir" disabled={indice === 0} onClick={() => setLayout(atual => ({ ...atual, colunas: mover(atual.colunas, indice, -1) }))}>↑</button>
                  <button type="button" style={pequeno()} aria-label="Descer" disabled={indice === layout.colunas.length - 1} onClick={() => setLayout(atual => ({ ...atual, colunas: mover(atual.colunas, indice, 1) }))}>↓</button>
                </div>
              ))}
              {todasColunas.filter(item => layout.colunas.indexOf(item.chave) < 0).map(item => (
                <label key={item.chave} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: COR.texto2 }}>
                  <input type="checkbox" checked={false} onChange={() => setLayout(atual => ({ ...atual, colunas: atual.colunas.concat(item.chave) }))} />
                  {item.nome}
                </label>
              ))}
            </div>
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', marginTop: '10px' }}>
              <input type="checkbox" checked={layout.lista.todosVeemTodos} onChange={() => setLayout(atual => ({ ...atual, lista: { todosVeemTodos: !atual.lista.todosVeemTodos } }))} />
              <span>
                <strong>Todos os usuários do ambiente veem todos os registros</strong>
                <span style={{ display: 'block', fontSize: '12px', color: COR.texto2 }}>Desmarcado: quem não administra o ambiente vê só os registros que abriu e os que aguardam por ele. (O Dataverse continua decidindo o que cada um pode ler.)</span>
              </span>
            </label>
          </fieldset>

          {/* ETAPAS */}
          <fieldset style={secao}>
            <legend style={legenda}>Etapas do processo (barra da tela do registro)</legend>
            <p style={ajuda}>Vêm do fluxo publicado. Esconda etapas de apoio e use nomes curtos (ex.: “Dados da demanda”, “Go/No-Go”).</p>
            {layout.etapas.map((etapa, indice) => (
              <div key={etapa.elementoId} style={{ display: 'grid', gridTemplateColumns: 'auto 28px 1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '6px', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  aria-label="Mostrar na barra"
                  checked={etapa.visivel}
                  onChange={() => setLayout(atual => ({ ...atual, etapas: atual.etapas.map(item => (item.elementoId === etapa.elementoId ? { ...item, visivel: !item.visivel } : item)) }))}
                />
                <strong style={{ textAlign: 'center' }}>{indice + 1}</strong>
                <span style={{ color: etapa.visivel ? COR.azul : COR.texto2 }}>{nomeEtapa(etapa.elementoId)}</span>
                <input
                  aria-label="Nome na barra"
                  value={etapa.rotulo}
                  placeholder="Nome na barra (vazio = nome da etapa)"
                  maxLength={40}
                  onChange={evento => setLayout(atual => ({ ...atual, etapas: atual.etapas.map(item => (item.elementoId === etapa.elementoId ? { ...item, rotulo: evento.target.value } : item)) }))}
                  style={campo}
                />
                <span style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" style={pequeno()} aria-label="Subir" disabled={indice === 0} onClick={() => setLayout(atual => ({ ...atual, etapas: mover(atual.etapas, indice, -1) }))}>↑</button>
                  <button type="button" style={pequeno()} aria-label="Descer" disabled={indice === layout.etapas.length - 1} onClick={() => setLayout(atual => ({ ...atual, etapas: mover(atual.etapas, indice, 1) }))}>↓</button>
                </span>
              </div>
            ))}
            {layout.etapas.length === 0 && <p style={ajuda}>Nenhuma etapa (publique o fluxo do ambiente).</p>}
          </fieldset>

          {/* REGISTRO */}
          <fieldset style={secao}>
            <legend style={legenda}>Tela do registro</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', marginBottom: '8px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" name="disposicao-registro" checked={layout.registro.disposicao !== 'umaColuna'} onChange={() => setLayout(atual => ({ ...atual, registro: { ...atual.registro, disposicao: 'duasColunas' } }))} />
                <span><strong>Duas colunas</strong> — dados do registro à esquerda (código, nome, etapa, prazo, responsável, Ver fluxo, documentos relacionados); campos da etapa à direita</span>
              </label>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="radio" name="disposicao-registro" checked={layout.registro.disposicao === 'umaColuna'} onChange={() => setLayout(atual => ({ ...atual, registro: { ...atual.registro, disposicao: 'umaColuna' } }))} />
                <span><strong>Uma coluna</strong> — cabeçalho do fluxo, desenho e campos em sequência</span>
              </label>
            </div>
            {([
              ['mostrarDados', 'Mostrar o quadro “Campos preenchidos” no fim da tela'],
              ['mostrarDiagrama', 'Abrir o desenho do fluxo já ao entrar no registro'],
              ['mostrarHistorico', 'Mostrar o histórico do fluxo']
            ] as Array<['mostrarDados' | 'mostrarDiagrama' | 'mostrarHistorico', string]>).map(([chave, texto]) => (
              <label key={chave} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '6px' }}>
                <input type="checkbox" checked={!!layout.registro[chave]} onChange={() => setLayout(atual => ({ ...atual, registro: { ...atual.registro, [chave]: !atual.registro[chave] } }))} />
                {texto}
              </label>
            ))}
          </fieldset>

          {erros.length > 0 && <CaixaMensagem tipo="erro" texto={erros.join('\n')} />}

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              disabled={props.processando}
              onClick={() => { if (window.confirm('Voltar todas as telas ao padrão gerado a partir do fluxo?')) { setLayout(layoutPadrao(definicao)); } }}
              style={botao('secundario', props.processando)}
            >
              Restaurar tudo ao padrão
            </button>
            <span style={{ display: 'flex', gap: '8px' }}>
              <button type="button" disabled={props.processando} onClick={props.onFechar} style={botao('secundario', props.processando)}>Cancelar</button>
              <button type="button" disabled={props.processando || !props.disponivel} onClick={() => { salvar().catch(() => undefined); }} style={botao('principal', props.processando || !props.disponivel)}>
                {props.processando ? 'Salvando...' : 'Salvar telas'}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbienteLayoutEditor;
