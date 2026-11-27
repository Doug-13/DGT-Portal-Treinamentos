import * as React from 'react';

import {
  FornecedoresService,
  IDadosColaborador
} from '../../services/fornecedores/FornecedoresService';

import {
  IColaboradorFornecedor,
  IDocumentoColaborador,
  IFornecedor,
  ITipoDocumentoFornecedor,
  tipoExigeNorma
} from '../../services/fornecedores/modeloFornecedores';

import {
  formatarCpf,
  IItemColaborador,
  mascararCpf,
  situacaoColaborador,
  tipoDoDocumento,
  tiposDeColaborador
} from '../../services/fornecedores/colaboradores';

import {
  EstadoDocumento,
  sugerirVencimento
} from '../../services/fornecedores/situacaoDocumental';

import {
  Aviso,
  COR,
  Modal,
  Selo,
  TomSelo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — COLABORADORES DO PRESTADOR
//
// Quem atua para a DGT pelo prestador: nome, função, CPF (coluna
// protegida, perfil "DGT - Fornecedores - CPF de colaboradores") e
// observações. Sem e-mail e sem telefone.
// Documentos: tipos CADASTRADOS em Tipos de documento › Colaborador,
// cada um "obrigatório para todos os colaboradores" ou opcional.
// "NR aplicável" pede a norma (um vigente por norma). Nova versão do
// mesmo tipo deixa a anterior como Substituída.
// ============================================================

const NORMAS_COMUNS = ['NR-06', 'NR-10', 'NR-11', 'NR-12', 'NR-18', 'NR-20', 'NR-33', 'NR-35'];

const TOM_ESTADO: Record<EstadoDocumento, TomSelo> = {
  'OK': 'ciano',
  'Sem validade': 'cinza',
  'A vencer': 'azul',
  'Vencido': 'indigo',
  'Faltando': 'indigo'
};

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const textoEstado = (item: IItemColaborador): string => {
  if (item.estado === 'Faltando') { return `! ${item.rotulo} faltando`; }
  if (item.estado === 'Vencido') { return `! ${item.rotulo} vencido`; }
  if (item.estado === 'A vencer') { return `${item.rotulo}: vence em ${item.dias} dia(s)`; }
  return `✓ ${item.rotulo}`;
};

// ------------------------------------------------------------
// Cadastro do colaborador
// ------------------------------------------------------------

const ColaboradorModal: React.FC<{
  colaborador?: IColaboradorFornecedor;
  fechar: () => void;
  salvar: (dados: IDadosColaborador) => Promise<void>;
}> = ({ colaborador, fechar, salvar }) => {

  const [d, setD] = React.useState<IDadosColaborador>({
    nome: colaborador ? colaborador.nome : '',
    funcao: colaborador ? colaborador.funcao : '',
    cpf: '',
    observacoes: colaborador ? colaborador.observacoes : '',
    ativo: colaborador ? colaborador.ativo : true
  });
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(d);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo={colaborador ? 'Editar colaborador' : 'Novo colaborador'}
      subtitulo="Sem e-mail e sem telefone. O CPF fica numa coluna protegida e nunca vai para o histórico."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={600}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !d.nome.trim())} disabled={gravando || !d.nome.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <label style={rotulo} htmlFor="col-nome">Nome</label>
      <input id="col-nome" style={campo} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 14px' }}>
        <div>
          <label style={rotulo} htmlFor="col-funcao">Função / cargo</label>
          <input id="col-funcao" style={campo} value={d.funcao} onChange={e => setD({ ...d, funcao: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="col-cpf">CPF</label>
          <input id="col-cpf" style={campo} autoComplete="off" inputMode="numeric" value={d.cpf}
            onChange={e => setD({ ...d, cpf: e.target.value.replace(/[^\d.-]/g, '').substring(0, 14) })}
            placeholder={colaborador ? 'vazio = mantém o CPF gravado' : 'somente números'} />
          {colaborador && <div style={ajuda}>Preencha só para informar ou corrigir.</div>}
        </div>
      </div>
      <label style={rotulo} htmlFor="col-obs">Observações</label>
      <textarea id="col-obs" style={{ ...campo, resize: 'vertical' }} rows={3} value={d.observacoes} onChange={e => setD({ ...d, observacoes: e.target.value })}
        placeholder="Ex.: atua na obra X; acompanha o técnico Y. Não escreva CPF, contatos ou dados de saúde aqui." />
      {colaborador && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13.5px' }}>
          <input type="checkbox" checked={d.ativo} onChange={e => setD({ ...d, ativo: e.target.checked })} />
          Colaborador ativo (desmarque quando deixar de atuar; nada é apagado)
        </label>
      )}
    </Modal>
  );
};

// ------------------------------------------------------------
// Documento do colaborador (tipo cadastrado)
// ------------------------------------------------------------

const DocumentoColaboradorModal: React.FC<{
  colaborador: IColaboradorFornecedor;
  tipo: ITipoDocumentoFornecedor;
  normaInicial: string;
  envioDisponivel: boolean;
  fechar: () => void;
  salvar: (dados: { norma: string; emissao: string; vencimento: string; observacoes: string; arquivo?: File; linkArquivo?: string }) => Promise<void>;
}> = ({ colaborador, tipo, normaInicial, envioDisponivel, fechar, salvar }) => {

  const [norma, setNorma] = React.useState(normaInicial);
  const [emissao, setEmissao] = React.useState('');
  const [vencimento, setVencimento] = React.useState('');
  const [vencimentoManual, setVencimentoManual] = React.useState(false);
  const [observacoes, setObservacoes] = React.useState('');
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [link, setLink] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const diasSugeridos = tipo.validadeDias;
  const exigeNorma = tipoExigeNorma(tipo.nome);

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar({ norma, emissao, vencimento, observacoes, arquivo, linkArquivo: link });
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo={`${tipo.nome} — ${colaborador.nome}`}
      subtitulo={tipo.descricao || (tipo.obrigatorio ? 'Obrigatório para todos os colaboradores.' : undefined)}
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={600}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando)} disabled={gravando} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Gravando…' : 'Registrar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {exigeNorma && (
        <div style={{ marginBottom: '6px' }}>
          <label style={rotulo} htmlFor="docc-norma">Qual NR se aplica a este colaborador</label>
          <input id="docc-norma" style={campo} list="docc-normas" value={norma} onChange={e => setNorma(e.target.value)} placeholder="Ex.: NR-10 (eletricidade), NR-35 (altura)" />
          <datalist id="docc-normas">{NORMAS_COMUNS.map(n => <option key={n} value={n} />)}</datalist>
          <div style={ajuda}>Varia por atividade: informe a norma do treinamento deste documento.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 14px' }}>
        <div>
          <label style={rotulo} htmlFor="docc-emissao">Emissão</label>
          <input id="docc-emissao" type="date" style={campo} value={emissao}
            onChange={e => { setEmissao(e.target.value); if (!vencimentoManual) { setVencimento(sugerirVencimento(e.target.value, diasSugeridos)); } }} />
        </div>
        <div>
          <label style={rotulo} htmlFor="docc-validade">Validade{tipo.exigeValidade ? '' : ' (se houver)'}</label>
          <input id="docc-validade" type="date" style={campo} value={vencimento} onChange={e => { setVencimento(e.target.value); setVencimentoManual(true); }} />
          {diasSugeridos && !vencimentoManual && <div style={ajuda}>Sugerida: emissão + {diasSugeridos} dias. Confira no documento.</div>}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <label style={rotulo} htmlFor="docc-arquivo">Arquivo</label>
        <input id="docc-arquivo" type="file" disabled={!envioDisponivel} onChange={e => setArquivo(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} />
        <div style={ajuda}>
          {envioDisponivel
            ? 'Vai para a pasta do fornecedor › Colaboradores, no site de Suprimentos.'
            : 'Envio indisponível nesta página: informe o link do arquivo abaixo.'}
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <label style={rotulo} htmlFor="docc-link">ou link do arquivo no SharePoint</label>
        <input id="docc-link" style={campo} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />
      </div>

      <div style={{ marginTop: '10px' }}>
        <label style={rotulo} htmlFor="docc-obs">Observações</label>
        <textarea id="docc-obs" style={{ ...campo, resize: 'vertical' }} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)}
          placeholder="Sem dados de saúde (o ASO fica só no arquivo)." />
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------
// Lista
// ------------------------------------------------------------

const ColaboradoresFornecedorView: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  // Tipos de documento de colaborador cadastrados (Tipos de documento › Colaborador).
  tiposColaborador: ITipoDocumentoFornecedor[];
  usuarioNome: string;
  voltar: () => void;
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, tiposColaborador, usuarioNome, voltar, aoAlterar }) => {

  const [colaboradores, setColaboradores] = React.useState<IColaboradorFornecedor[] | undefined>(undefined);
  const [documentos, setDocumentos] = React.useState<IDocumentoColaborador[]>([]);
  const [disponivel, setDisponivel] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [mostrarCpf, setMostrarCpf] = React.useState(false);
  const [mostrarInativos, setMostrarInativos] = React.useState(false);
  const [aberto, setAberto] = React.useState<string>('');
  const [editando, setEditando] = React.useState<IColaboradorFornecedor | 'novo' | undefined>(undefined);
  const [registrar, setRegistrar] = React.useState<{ colaborador: IColaboradorFornecedor; tipo: ITipoDocumentoFornecedor; norma: string } | undefined>(undefined);
  const [tipoEscolhido, setTipoEscolhido] = React.useState<string>('');

  const tiposAtivos = tiposDeColaborador(tiposColaborador);

  const carregar = React.useCallback(async (): Promise<void> => {
    try {
      const r = await servico.listarColaboradores(fornecedor.id);
      setDisponivel(r.disponivel);
      setColaboradores(r.colaboradores);
      setDocumentos(r.documentos);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const depois = async (texto: string): Promise<void> => {
    setAviso(texto);
    await carregar();
    await aoAlterar();
  };

  const visiveis = (colaboradores || []).filter(c => mostrarInativos || c.ativo);
  const situacoes: Record<string, ReturnType<typeof situacaoColaborador>> = {};
  (colaboradores || []).forEach(c => { situacoes[c.id] = situacaoColaborador(documentos.filter(d => d.colaboradorId === c.id), tiposColaborador); });
  const pendentes = (colaboradores || []).filter(c => c.ativo && situacoes[c.id].pendente).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" style={botao('discreto')} onClick={voltar}>← {fornecedor.razaoSocial}</button>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '19px', fontWeight: 700 }}>Colaboradores</div>
          <div style={{ fontSize: '13px', color: COR.texto2 }}>
            Quem atua para a DGT por este prestador. Documentos conforme os tipos cadastrados (obrigatórios para todos ou opcionais).
          </div>
        </div>
        {colaboradores && pendentes > 0 && <Selo tom="indigo">{`! ${pendentes} com pendência`}</Selo>}
      </div>

      {aviso && <Aviso tipo="ok">{aviso}</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {!disponivel && (
        <Aviso tipo="info">
          As tabelas de colaboradores ainda não existem no Dataverse. Rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.
        </Aviso>
      )}

      {disponivel && !colaboradores && !erro && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando colaboradores…</div>}

      {disponivel && colaboradores && tiposAtivos.length === 0 && (
        <Aviso tipo="info">
          Nenhum tipo de documento de colaborador cadastrado. O administrador do módulo cadastra em Tipos de documento › Colaborador (ex.: ASO, Integração, NR-35).
        </Aviso>
      )}

      {disponivel && colaboradores && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
            <button type="button" style={botao('principal')} onClick={() => setEditando('novo')}>Novo colaborador</button>
            <button type="button" style={botao('discreto')} onClick={() => setMostrarCpf(!mostrarCpf)}>{mostrarCpf ? 'Ocultar CPF' : 'Mostrar CPF'}</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} />
              Mostrar inativos
            </label>
            <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{colaboradores.filter(c => c.ativo).length} ativo(s)</span>
          </div>

          {visiveis.length === 0 && <Aviso tipo="info">Nenhum colaborador cadastrado para este fornecedor.</Aviso>}

          {visiveis.length > 0 && (
            <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
                <thead>
                  <tr>
                    <th style={celulaCabecalho}>Colaborador</th>
                    <th style={celulaCabecalho}>CPF</th>
                    <th style={celulaCabecalho}>Documentos</th>
                    <th style={celulaCabecalho} />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(c => {
                    const s = situacoes[c.id];
                    const expandido = aberto === c.id;
                    const docs = documentos.filter(d => d.colaboradorId === c.id);
                    const anteriores = docs.filter(d => d.situacao === 'Substituído');
                    return (
                      <React.Fragment key={c.id}>
                        <tr style={{ opacity: c.ativo ? 1 : 0.6 }}>
                          <td style={celula}>
                            <div style={{ fontWeight: 600 }}>{c.nome}{!c.ativo && ' (inativo)'}</div>
                            <div style={{ fontSize: '12px', color: COR.texto2 }}>{c.funcao || 'função não informada'}</div>
                          </td>
                          <td style={celula}>{c.cpf ? (mostrarCpf ? formatarCpf(c.cpf) : mascararCpf(c.cpf)) : <span style={{ color: COR.texto2 }}>—</span>}</td>
                          <td style={celula}>
                            {s.itens.length === 0
                              ? <span style={{ color: COR.texto2, fontSize: '13px' }}>nenhum registrado</span>
                              : <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{s.itens.map(n => <Selo key={n.chave} tom={TOM_ESTADO[n.estado]}>{textoEstado(n)}</Selo>)}</div>}
                            {s.faltandoObrigatorios.length > 0 && (
                              <div style={{ fontSize: '12px', color: COR.indigo, marginTop: '4px' }}>Faltam (obrigatórios): {s.faltandoObrigatorios.join(', ')}</div>
                            )}
                          </td>
                          <td style={{ ...celula, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <button type="button" style={botao('discreto')} onClick={() => setEditando(c)}>Editar</button>
                            <button type="button" style={botao('secundario')} aria-expanded={expandido} onClick={() => setAberto(expandido ? '' : c.id)}>
                              {expandido ? '▾' : '▸'} Documentos
                            </button>
                          </td>
                        </tr>
                        {expandido && (
                          <tr>
                            <td style={{ ...celula, background: COR.fundo }} colSpan={4}>
                              <div style={{ ...painel, padding: '12px 14px' }}>
                                {c.observacoes && <div style={{ fontSize: '13px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}><strong>Observações:</strong> {c.observacoes}</div>}
                                <ul style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '13.5px', lineHeight: 1.8 }}>
                                  {s.itens.map(item => {
                                    const tipoItem = item.tipo || (item.documento ? tipoDoDocumento(item.documento, tiposColaborador) : undefined);
                                    return (
                                      <li key={item.chave}>
                                        <strong>{item.rotulo}</strong>{item.obrigatorio ? ' (obrigatório)' : ''}
                                        {item.documento
                                          ? <> — emissão {dataBr(item.documento.emissao)}, validade {dataBr(item.documento.vencimento)}
                                            {item.documento.arquivoUrl && <> · <a href={item.documento.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: COR.azul }}>abrir</a></>}
                                          </>
                                          : ' — não registrado'}
                                        {tipoItem && tipoItem.ativo && (
                                          <>{' '}<button type="button" style={botao('discreto')}
                                            onClick={() => setRegistrar({ colaborador: c, tipo: tipoItem, norma: item.documento ? item.documento.norma : '' })}>{item.documento ? 'Renovar' : 'Registrar'}</button></>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                                {tiposAtivos.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <select aria-label="Tipo de documento" style={{ ...campo, width: 'auto', minWidth: '240px' }} value={tipoEscolhido} onChange={e => setTipoEscolhido(e.target.value)}>
                                      <option value="">Escolha o tipo…</option>
                                      {tiposAtivos.map(t => <option key={t.id} value={t.id}>{t.nome}{t.obrigatorio ? ' (obrigatório)' : ''}</option>)}
                                    </select>
                                    <button type="button" style={botao('secundario', !tipoEscolhido)} disabled={!tipoEscolhido}
                                      onClick={() => {
                                        const t = tiposAtivos.filter(x => x.id === tipoEscolhido)[0];
                                        if (t) { setRegistrar({ colaborador: c, tipo: t, norma: '' }); }
                                      }}>Registrar documento</button>
                                  </div>
                                )}
                                {anteriores.length > 0 && (
                                  <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '10px' }}>
                                    Versões anteriores: {anteriores.map(d => `${d.norma || (tipoDoDocumento(d, tiposColaborador) || { nome: d.tipo }).nome} (${dataBr(d.emissao)})`).join(' · ')}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editando && (
        <ColaboradorModal
          colaborador={editando === 'novo' ? undefined : editando}
          fechar={() => setEditando(undefined)}
          salvar={async dados => {
            await servico.salvarColaborador(fornecedor, dados, editando === 'novo' ? undefined : editando, colaboradores || [], usuarioNome);
            setEditando(undefined);
            await depois(editando === 'novo' ? `${dados.nome}: cadastrado.` : `${dados.nome}: atualizado.`);
          }}
        />
      )}

      {registrar && (
        <DocumentoColaboradorModal
          colaborador={registrar.colaborador}
          tipo={registrar.tipo}
          normaInicial={registrar.norma}
          envioDisponivel={servico.envioDisponivel}
          fechar={() => setRegistrar(undefined)}
          salvar={async dados => {
            await servico.registrarDocumentoColaborador(
              fornecedor,
              registrar.colaborador,
              { ...dados, tipo: registrar.tipo },
              documentos.filter(d => d.colaboradorId === registrar.colaborador.id),
              tiposColaborador,
              usuarioNome);
            setRegistrar(undefined);
            setTipoEscolhido('');
            await depois(`${registrar.colaborador.nome}: ${registrar.tipo.nome} registrado.`);
          }}
        />
      )}
    </div>
  );
};

export default ColaboradoresFornecedorView;
