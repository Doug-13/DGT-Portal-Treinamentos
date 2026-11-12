import * as React from 'react';

import {
  IConfigSubprocesso,
  IFluxoMetadado,
  IMapeamentoSubprocesso
} from '../../models/Fluxo';

import {
  TIPOS_DOCUMENTO
} from '../../constants/tiposDocumento';

import {
  PREFIXO_CAMPO,
  PREFIXO_COLUNA
} from '../../services/fluxo/subprocesso/regrasSubprocesso';

// ============================================================
// CONFIGURAÇÃO DO SUBPROCESSO (modal da etapa no editor de fluxo)
//
// O subprocesso cria documentos que seguem OUTRO fluxo — um por linha
// de uma tabela deste fluxo, ou um só — e grava as referências a eles
// num campo "Documentos referenciados" deste fluxo.
// ============================================================

export interface IProcessoSubprocessoOpcao {
  id: string;
  codigo: string;
  nome: string;
  publicado: boolean;
  metadados: IFluxoMetadado[];
}

export interface IPainelSubprocessoProps {
  config: IConfigSubprocesso;
  editavel: boolean;
  // Metadados DESTE processo (pai).
  metadados: IFluxoMetadado[];
  // Fluxos que podem ser chamados (o atual fica de fora).
  processos: IProcessoSubprocessoOpcao[];
  processoAtualId?: string;
  areas: Array<{ id: string; nome: string; sigla?: string }>;
  onAlterar: (config: IConfigSubprocesso) => void;
  // "Criar no filho": grava campos (mesma chave do pai) no processo
  // filho e recarrega a lista. Devolve erros.
  onCriarMetadadosFilho?: (processoId: string, metadados: IFluxoMetadado[]) => Promise<string[]>;
}

import {
  camposAusentesNoFilho,
  compatibilidade,
  sugerirMapeamentos,
  tipoDaOrigem
} from '../../services/fluxo/subprocesso/mapeamentoSubprocesso';

const COR_AZUL = '#202A44';
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
  minHeight: '36px',
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '6px 8px',
  fontFamily: 'inherit',
  fontSize: '13.5px',
  color: COR_AZUL,
  background: '#FFFFFF'
};

const grupo: React.CSSProperties = {
  border: `1px solid ${COR_BORDA}`,
  borderRadius: '6px',
  padding: '10px 12px',
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px'
};

const legenda: React.CSSProperties = {
  ...rotulo,
  padding: '0 6px',
  marginBottom: 0
};

const ajuda: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '17px',
  marginTop: '4px'
};

const caixaInfo: React.CSSProperties = {
  fontSize: '12.5px',
  lineHeight: '18px',
  background: '#EDF0F5',
  borderRadius: '6px',
  padding: '8px 10px'
};

const botaoPequeno = (perigo = false): React.CSSProperties => ({
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '6px',
  border: `1px solid ${perigo ? '#B42318' : COR_BORDA}`,
  background: '#FFFFFF',
  color: perigo ? '#B42318' : COR_AZUL,
  fontWeight: 700,
  fontSize: '12.5px',
  cursor: 'pointer'
});

const PainelSubprocesso: React.FC<IPainelSubprocessoProps> = ({
  config,
  editavel,
  metadados,
  processos,
  processoAtualId,
  areas,
  onAlterar,
  onCriarMetadadosFilho
}) => {

  const alterar = (parcial: Partial<IConfigSubprocesso>): void =>
    onAlterar({ ...config, ...parcial });

  const opcoesFluxo =
    processos
      .filter(item => item.id !== processoAtualId)
      .sort((a, b) => `${a.codigo} ${a.nome}`.localeCompare(`${b.codigo} ${b.nome}`, 'pt-BR'));

  const fluxoEscolhido = processos.find(item => item.id === config.fluxoId);
  const tabelas = metadados.filter(item => item.tipo === 'tabela');
  const camposDocumentos = metadados.filter(item => item.tipo === 'documentos');
  const tabela = tabelas.find(item => item.chave === config.campoTabela);
  const colunas = config.origem === 'tabela' && tabela ? tabela.colunas || [] : [];
  const colunasUsuario = colunas.filter(item => item.tipo === 'usuario');

  // Filtro de linhas: colunas Lista ou Sim/Não e seus valores.
  const colunasFiltro = colunas.filter(item => item.tipo === 'lista' || item.tipo === 'simNao');
  const colunaFiltro =
    config.filtroLinhas ? colunasFiltro.find(item => item.chave === config.filtroLinhas?.coluna) : undefined;
  const opcoesFiltro: Array<{ valor: string; rotulo: string }> =
    !colunaFiltro
      ? []
      : colunaFiltro.tipo === 'simNao'
        ? [{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }]
        : (colunaFiltro.opcoes || []).map(opcao => ({ valor: opcao, rotulo: opcao }));
  const metadadosFilho = fluxoEscolhido ? fluxoEscolhido.metadados : [];
  const ausentes = fluxoEscolhido ? camposAusentesNoFilho(metadados, metadadosFilho) : [];
  const [avisoMapeamento, setAvisoMapeamento] = React.useState('');
  const [paraCriar, setParaCriar] = React.useState<string[]>([]);
  const [criando, setCriando] = React.useState(false);

  // Origens possíveis de um valor copiado para o filho.
  const origens: Array<{ valor: string; rotulo: string }> = [
    ...colunas.map(item => ({ valor: `${PREFIXO_COLUNA}${item.chave}`, rotulo: `Coluna: ${item.rotulo}` })),
    ...metadados
      .filter(item => item.tipo !== 'tabela')
      .map(item => ({ valor: `${PREFIXO_CAMPO}${item.chave}`, rotulo: `Campo deste fluxo: ${item.rotulo}` })),
    { valor: 'pai:referencia', rotulo: 'Este documento (como referência)' },
    { valor: 'pai:codigo', rotulo: 'Código deste documento' },
    { valor: 'pai:titulo', rotulo: 'Título deste documento' }
  ];

  const mapeamentos = config.mapeamentos || [];

  const alterarMapeamento = (indice: number, parcial: Partial<IMapeamentoSubprocesso>): void =>
    alterar({ mapeamentos: mapeamentos.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)) });

  const marcadores: string[] = [
    '{pai.codigo}', '{pai.titulo}', '{n}',
    ...colunas.filter(item => item.tipo !== 'usuario').map(item => `{coluna:${item.chave}}`)
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: COR_AZUL }}>

      <div style={caixaInfo}>
        Ao passar por aqui, o sistema <strong>cria documentos que seguem outro fluxo</strong> —
        um por linha da tabela escolhida (ex.: uma ação por constatação da auditoria) ou um só —
        e grava os documentos criados num campo deste fluxo. A aba <strong>Referências</strong> dos
        dois documentos mostra a ligação. Escolha abaixo se este fluxo segue em frente ou espera os novos documentos.
      </div>

      <fieldset style={grupo}>
        <legend style={legenda}>Documentos criados</legend>

        <div>
          <label htmlFor="sub-fluxo" style={rotulo}>Fluxo que eles seguem *</label>
          <select
            id="sub-fluxo"
            value={config.fluxoId}
            disabled={!editavel}
            onChange={evento => {
              const escolhido = processos.find(item => item.id === evento.target.value);
              alterar({
                fluxoId: evento.target.value,
                fluxoNome: escolhido ? `${escolhido.codigo ? `${escolhido.codigo} — ` : ''}${escolhido.nome}` : undefined,
                // Outro fluxo = outros metadados: descarta destinos inválidos.
                mapeamentos: mapeamentos.filter(item => !escolhido || escolhido.metadados.some(meta => meta.chave === item.destino))
              });
            }}
            style={entrada}
          >
            <option value="">Selecione...</option>
            {opcoesFluxo.map(item => (
              <option key={item.id} value={item.id}>
                {item.codigo ? `${item.codigo} — ` : ''}{item.nome}{item.publicado ? '' : ' (sem versão publicada)'}
              </option>
            ))}
          </select>
          {fluxoEscolhido && !fluxoEscolhido.publicado && (
            <div style={{ ...ajuda, color: '#B42318' }}>
              Este fluxo ainda não tem versão publicada: o subprocesso não cria documentos até ele ser publicado.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          <div>
            <label htmlFor="sub-tipo" style={rotulo}>Tipo do documento *</label>
            <select id="sub-tipo" value={config.tipoDocumento} disabled={!editavel} onChange={evento => alterar({ tipoDocumento: evento.target.value })} style={entrada}>
              {TIPOS_DOCUMENTO.map(item => <option key={item.sigla} value={item.sigla}>{item.sigla} — {item.nome}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="sub-area" style={rotulo}>Área</label>
            <select
              id="sub-area"
              value={config.areaId || ''}
              disabled={!editavel}
              onChange={evento => {
                const area = areas.find(item => item.id === evento.target.value);
                alterar({ areaId: evento.target.value || undefined, areaNome: area ? area.nome : undefined });
              }}
              style={entrada}
            >
              <option value="">Mesma área deste documento</option>
              {areas.map(item => <option key={item.id} value={item.id}>{item.sigla ? `${item.sigla} — ` : ''}{item.nome}</option>)}
            </select>
          </div>
        </div>
        <div style={{ ...ajuda, marginTop: 0 }}>Código gerado como em “Novo documento”: ÁREA-TIPO-NNN (ex.: QUA-PDA-004).</div>
      </fieldset>

      <fieldset style={grupo}>
        <legend style={legenda}>Quantos documentos</legend>

        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px' }}>
          <input type="radio" name="sub-origem" checked={config.origem === 'tabela'} disabled={!editavel} onChange={() => alterar({ origem: 'tabela' })} />
          Um por linha de uma tabela deste fluxo
        </label>

        {config.origem === 'tabela' && (
          <div style={{ marginLeft: '24px' }}>
            <select
              aria-label="Tabela de origem"
              value={config.campoTabela || ''}
              disabled={!editavel}
              onChange={evento => alterar({ campoTabela: evento.target.value, filtroLinhas: undefined, autor: (config.autor || '').indexOf(PREFIXO_COLUNA) === 0 ? 'executor' : config.autor })}
              style={entrada}
            >
              <option value="">Selecione a tabela...</option>
              {tabelas.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
            </select>
            {tabelas.length === 0 && (
              <div style={ajuda}>Crie em <strong>Metadados</strong> um campo do tipo Tabela (ex.: “Ações”, com O quê, Responsável e Prazo).</div>
            )}
            <div style={ajuda}>Linhas vazias são ignoradas. Se o fluxo passar de novo por aqui, linhas que já viraram documento não são recriadas.</div>

            {tabela && (
              <div style={{ marginTop: '10px', borderTop: `1px dashed ${COR_BORDA}`, paddingTop: '10px' }}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px' }}>
                  <input
                    type="checkbox"
                    checked={!!config.filtroLinhas}
                    disabled={!editavel || colunasFiltro.length === 0}
                    onChange={evento => alterar({
                      filtroLinhas: evento.target.checked && colunasFiltro.length > 0
                        ? { coluna: colunasFiltro[0].chave, valores: [] }
                        : undefined
                    })}
                  />
                  Criar só para as linhas que atendem a uma condição
                </label>

                {colunasFiltro.length === 0 && (
                  <div style={ajuda}>Para filtrar, a tabela precisa de uma coluna do tipo <strong>Lista</strong> ou <strong>Sim/Não</strong> (ex.: “Conforme?”).</div>
                )}

                {config.filtroLinhas && colunaFiltro && (
                  <div style={{ marginTop: '8px', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
                      <span>Quando a coluna</span>
                      <select
                        aria-label="Coluna da condição"
                        value={config.filtroLinhas.coluna}
                        disabled={!editavel}
                        onChange={evento => alterar({ filtroLinhas: { coluna: evento.target.value, valores: [] } })}
                        style={{ ...entrada, width: 'auto', minWidth: '180px' }}
                      >
                        {colunasFiltro.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
                      </select>
                      <span>for:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                      {opcoesFiltro.map(opcao => {
                        const marcado = config.filtroLinhas ? config.filtroLinhas.valores.indexOf(opcao.valor) >= 0 : false;
                        return (
                          <label key={opcao.valor} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13.5px' }}>
                            <input
                              type="checkbox"
                              checked={marcado}
                              disabled={!editavel}
                              onChange={() => {
                                const atual = config.filtroLinhas ? config.filtroLinhas.valores : [];
                                alterar({
                                  filtroLinhas: {
                                    coluna: config.filtroLinhas ? config.filtroLinhas.coluna : colunaFiltro.chave,
                                    valores: marcado ? atual.filter(item => item !== opcao.valor) : atual.concat(opcao.valor)
                                  }
                                });
                              }}
                            />
                            {opcao.rotulo}
                          </label>
                        );
                      })}
                    </div>
                    <div style={{ ...ajuda, marginTop: 0 }}>
                      {config.filtroLinhas.valores.length === 0
                        ? 'Marque ao menos um valor.'
                        : `Só as linhas com “${colunaFiltro.rotulo}” = ${opcoesFiltro.filter(opcao => config.filtroLinhas && config.filtroLinhas.valores.indexOf(opcao.valor) >= 0).map(opcao => opcao.rotulo).join(' ou ')} viram documento. As demais são ignoradas.`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px' }}>
          <input type="radio" name="sub-origem" checked={config.origem === 'unico'} disabled={!editavel} onChange={() => alterar({ origem: 'unico', campoTabela: '' })} />
          Um único documento
        </label>
      </fieldset>

      <fieldset style={grupo}>
        <legend style={legenda}>Depois de criar os documentos</legend>

        <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px' }}>
          <input type="radio" name="sub-aguardar" checked={config.aguardar !== 'todos'} disabled={!editavel} onChange={() => alterar({ aguardar: 'nao' })} />
          <span>
            <strong>Seguir para a próxima etapa</strong>
            <span style={{ ...ajuda, display: 'block', marginTop: '2px' }}>Os documentos criados correm em paralelo; este documento não espera por eles.</span>
          </span>
        </label>

        <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px' }}>
          <input type="radio" name="sub-aguardar" checked={config.aguardar === 'todos'} disabled={!editavel} onChange={() => alterar({ aguardar: 'todos' })} />
          <span>
            <strong>Aguardar todos serem concluídos</strong>
            <span style={{ ...ajuda, display: 'block', marginTop: '2px' }}>
              Este documento fica parado aqui e só segue quando o fluxo de TODOS os documentos criados chegar ao fim
              (ex.: a auditoria só fecha com as ações resolvidas). Se nenhuma linha gerar documento, segue na hora.
              Um Administrador pode liberar sem esperar, informando o motivo.
            </span>
          </span>
        </label>
      </fieldset>

      <fieldset style={grupo}>
        <legend style={legenda}>Título e autor</legend>

        <div>
          <label htmlFor="sub-titulo" style={rotulo}>Título *</label>
          <input id="sub-titulo" type="text" value={config.titulo} disabled={!editavel} onChange={evento => alterar({ titulo: evento.target.value })} style={entrada} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
            {marcadores.map(item => (
              <button
                key={item}
                type="button"
                disabled={!editavel}
                onClick={() => alterar({ titulo: `${config.titulo || ''}${config.titulo && !/\s$/.test(config.titulo) ? ' ' : ''}${item}` })}
                style={{ ...botaoPequeno(), minHeight: '24px', fontWeight: 600, fontSize: '11.5px' }}
                title="Inserir no título"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="sub-autor" style={rotulo}>Autor da revisão do novo documento</label>
          <select id="sub-autor" value={config.autor || 'executor'} disabled={!editavel} onChange={evento => alterar({ autor: evento.target.value })} style={entrada}>
            <option value="executor">Quem concluiu a etapa anterior</option>
            <option value="autorPai">Autor da revisão deste documento</option>
            {colunasUsuario.map(item => <option key={item.chave} value={`${PREFIXO_COLUNA}${item.chave}`}>Coluna “{item.rotulo}” da linha</option>)}
          </select>
          <div style={ajuda}>
            No fluxo do novo documento, é quem responde por “Autor da revisão”. Para cada ação ter o seu
            responsável, crie na tabela uma coluna do tipo <strong>Usuário</strong> e escolha-a aqui.
          </div>
        </div>
      </fieldset>

      <fieldset style={grupo}>
        <legend style={legenda}>Ligação com este documento</legend>
        <div>
          <label htmlFor="sub-referencias" style={rotulo}>Guardar os documentos criados no campo *</label>
          <select id="sub-referencias" value={config.campoReferencias} disabled={!editavel} onChange={evento => alterar({ campoReferencias: evento.target.value })} style={entrada}>
            <option value="">Selecione...</option>
            {camposDocumentos.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}
          </select>
          {camposDocumentos.length === 0 && (
            <div style={ajuda}>Crie em <strong>Metadados</strong> um campo do tipo “Documentos referenciados (vários)” (ex.: “Ações abertas”).</div>
          )}
          <div style={ajuda}>Mostre esse campo (somente leitura) nas etapas seguintes para acompanhar os documentos criados.</div>
        </div>
      </fieldset>

      <fieldset style={grupo}>
        <legend style={legenda}>Valores levados para o novo documento</legend>

        {!fluxoEscolhido && <div style={ajuda}>Escolha primeiro o fluxo dos documentos criados.</div>}

        {fluxoEscolhido && metadadosFilho.length === 0 && (
          <div style={ajuda}>O fluxo escolhido não tem metadados. Crie-os no processo dele para receber valores daqui.</div>
        )}

        {fluxoEscolhido && mapeamentos.map((item, indice) => {
          const destino = metadadosFilho.find(meta => meta.chave === item.destino);
          const origem = tipoDaOrigem(item.origem, config, metadados);
          const compat = destino && origem ? compatibilidade(origem, destino) : undefined;
          const corCompat = !compat ? '#64748B' : compat.nivel === 'ok' ? '#107C10' : compat.nivel === 'aviso' ? '#B45309' : '#B42318';
          return (
            <div key={`map-${indice}`} data-mapeamento={indice} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '6px', alignItems: 'center' }}>
                <select aria-label="Origem do valor" value={item.origem} disabled={!editavel} onChange={evento => alterarMapeamento(indice, { origem: evento.target.value })} style={entrada}>
                  {origens.map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
                </select>
                <span aria-hidden="true">→</span>
                <select aria-label="Campo do novo documento" value={item.destino} disabled={!editavel} onChange={evento => alterarMapeamento(indice, { destino: evento.target.value })} style={entrada}>
                  <option value="">Campo do novo documento...</option>
                  {metadadosFilho.map(meta => <option key={meta.chave} value={meta.chave}>{meta.rotulo}</option>)}
                </select>
                <button type="button" disabled={!editavel} onClick={() => alterar({ mapeamentos: mapeamentos.filter((_m, posicao) => posicao !== indice) })} style={botaoPequeno(true)} aria-label="Remover">
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', fontSize: '11.5px' }}>
                {compat && (
                  <span data-compatibilidade={compat.nivel} style={{ color: corCompat, fontWeight: 700 }}>
                    {compat.nivel === 'ok' ? '✓' : compat.nivel === 'aviso' ? '⚠' : '✕'} {compat.mensagem}
                  </span>
                )}
                {item.destino && (
                  <label style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input type="checkbox" checked={!!item.somenteLeitura} disabled={!editavel} onChange={() => alterarMapeamento(indice, { somenteLeitura: !item.somenteLeitura })} />
                    somente leitura no filho
                  </label>
                )}
              </div>
            </div>
          );
        })}

        {fluxoEscolhido && editavel && metadadosFilho.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => {
                const sugestoes = sugerirMapeamentos(config, metadados, metadadosFilho);
                setAvisoMapeamento(sugestoes.length > 0
                  ? `${sugestoes.length} par(es) sugerido(s) por chave ou nome iguais — revise antes de publicar.`
                  : 'Nenhum campo equivalente (mesma chave ou nome, tipo compatível) encontrado.');
                if (sugestoes.length > 0) {
                  alterar({ mapeamentos: mapeamentos.concat(sugestoes) });
                }
              }}
              style={botaoPequeno()}
            >
              Mapear automaticamente
            </button>
            {avisoMapeamento && <span style={{ ...ajuda, marginLeft: '8px' }}>{avisoMapeamento}</span>}
          </div>
        )}

        {/* Campos do pai que o filho não tem: criar no processo filho (mesma chave). */}
        {fluxoEscolhido && editavel && onCriarMetadadosFilho && ausentes.length > 0 && (
          <div style={{ border: `1px dashed ${COR_BORDA}`, borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ ...ajuda, marginTop: 0, marginBottom: '6px' }}>
              Campos deste processo que o fluxo “{fluxoEscolhido.nome}” não tem. Marque e crie-os lá com a <strong>mesma chave</strong> e
              definição (tipo, opções, regra); eles já entram mapeados.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '12.5px' }}>
              {ausentes.map(meta => (
                <label key={meta.chave} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label={`Criar ${meta.rotulo} no filho`}
                    checked={paraCriar.indexOf(meta.chave) >= 0}
                    onChange={() => setParaCriar(atual => (atual.indexOf(meta.chave) >= 0 ? atual.filter(c => c !== meta.chave) : atual.concat(meta.chave)))}
                  />
                  {meta.rotulo}
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={paraCriar.length === 0 || criando}
              onClick={() => {
                if (!onCriarMetadadosFilho || !fluxoEscolhido) {
                  return;
                }
                const selecionados = ausentes.filter(meta => paraCriar.indexOf(meta.chave) >= 0);
                setCriando(true);
                onCriarMetadadosFilho(fluxoEscolhido.id, selecionados)
                  .then(erros => {
                    setCriando(false);
                    if (erros.length > 0) {
                      setAvisoMapeamento(erros.join(' '));
                      return;
                    }
                    setParaCriar([]);
                    setAvisoMapeamento(`${selecionados.length} campo(s) criado(s) no fluxo filho e mapeado(s).`);
                    alterar({
                      mapeamentos: mapeamentos.concat(
                        selecionados
                          .filter(meta => !mapeamentos.some(item => item.destino === meta.chave))
                          .map(meta => ({ origem: `campo:${meta.chave}`, destino: meta.chave }))
                      )
                    });
                  })
                  .catch(() => setCriando(false));
              }}
              style={{ ...botaoPequeno(), marginTop: '6px' }}
            >
              {criando ? 'Criando...' : `Criar no filho (${paraCriar.length})`}
            </button>
          </div>
        )}

        {fluxoEscolhido && metadadosFilho.length > 0 && editavel && origens.length > 0 && (
          <div>
            <button type="button" onClick={() => alterar({ mapeamentos: mapeamentos.concat({ origem: origens[0].valor, destino: '' }) })} style={botaoPequeno()}>
              + Valor
            </button>
          </div>
        )}

        <div style={{ ...ajuda, marginTop: 0 }}>
          Use tipos compatíveis (ex.: coluna Data → campo Data; coluna Usuário → campo Usuário).
          “Este documento (como referência)” vai para um campo do tipo Documento referenciado do novo
          documento — assim ele mostra de onde veio.
        </div>
      </fieldset>
    </div>
  );
};

export default PainelSubprocesso;
