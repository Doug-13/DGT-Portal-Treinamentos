import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  CATEGORIAS_FORNECEDOR,
  CRITICIDADES,
  Criticidade,
  IConsultaFornecedor,
  IDocumentoFornecedor,
  IFornecedor,
  IHistoricoFornecedor,
  ITipoDocumentoFornecedor,
  REGIMES_TRIBUTARIOS,
  ROTULO_CONSULTA,
  STATUS_FORNECEDOR,
  StatusFornecedor
} from '../../services/fornecedores/modeloFornecedores';

import {
  calcularSituacao,
  EstadoDocumento,
  IItemSituacao,
  sugerirVencimento,
  tipoSeAplica
} from '../../services/fornecedores/situacaoDocumental';

import {
  formatarCnpj
} from '../../utils/cnpj';

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
  formatarDataHora,
  painel,
  rotulo
} from '../Kits/kitsComum';

import {
  CampoContato
} from './ListaFornecedoresView';

// ============================================================
// FORNECEDORES — DETALHE
//
// Seções: Dados · Documentos · Consultas · Histórico
// Status restritos (só administrador do módulo): Homologado, Suspenso,
// Bloqueado e Descredenciado. "Em homologação" e "Com restrição"
// qualquer pessoa com o módulo pode definir.
// ============================================================

const STATUS_RESTRITOS: StatusFornecedor[] = ['Homologado', 'Suspenso', 'Bloqueado', 'Descredenciado'];

type Secao = 'dados' | 'documentos' | 'consultas' | 'historico';

const SECOES: Array<{ id: Secao; rotulo: string }> = [
  { id: 'dados', rotulo: 'Dados' },
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'consultas', rotulo: 'Consultas' },
  { id: 'historico', rotulo: 'Histórico' }
];

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const TOM_ESTADO: Record<EstadoDocumento, TomSelo> = {
  'OK': 'ciano',
  'Sem validade': 'cinza',
  'A vencer': 'azul',
  'Vencido': 'indigo',
  'Faltando': 'indigo'
};

const rotuloEstado = (item: IItemSituacao): string => {
  if (item.estado === 'Faltando') { return '! faltando'; }
  if (item.estado === 'Vencido') { return `! vencido há ${Math.abs(item.dias || 0)} dia(s)`; }
  if (item.estado === 'A vencer') { return `vence em ${item.dias} dia(s)`; }
  if (item.estado === 'OK' && !item.documento) { return 'opcional'; }
  return item.estado === 'OK' ? '✓ em dia' : 'sem validade';
};

const Linha: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div style={{ display: 'flex', gap: '12px', padding: '7px 0', borderBottom: `1px solid ${COR.fundo}`, fontSize: '14px' }}>
    <div style={{ width: '200px', flexShrink: 0, color: COR.texto2 }}>{titulo}</div>
    <div style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{children || '—'}</div>
  </div>
);

// ------------------------------------------------------------
// Editar cadastro
// ------------------------------------------------------------

const EditarFornecedorModal: React.FC<{
  fornecedor: IFornecedor;
  administra: boolean;
  fechar: () => void;
  salvar: (novo: IFornecedor, motivo: string) => Promise<void>;
}> = ({ fornecedor, administra, fechar, salvar }) => {

  const [f, setF] = React.useState<IFornecedor>({ ...fornecedor });
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudar = (parcial: Partial<IFornecedor>): void => setF(atual => ({ ...atual, ...parcial }));

  const statusPermitidos = STATUS_FORNECEDOR.filter(s =>
    administra || STATUS_RESTRITOS.indexOf(s) < 0 || s === fornecedor.status);

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar(f, motivo);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo="Editar fornecedor"
      subtitulo="Toda alteração fica no histórico com o motivo."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={760}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { confirmar().catch(() => undefined); }}>
            {gravando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 14px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="ed-razao">Razão social</label>
          <input id="ed-razao" style={campo} value={f.razaoSocial} onChange={e => mudar({ razaoSocial: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-fantasia">Nome fantasia</label>
          <input id="ed-fantasia" style={campo} value={f.nomeFantasia} onChange={e => mudar({ nomeFantasia: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-status">Status</label>
          <select id="ed-status" style={campo} value={f.status} onChange={e => mudar({ status: e.target.value as StatusFornecedor })}>
            {statusPermitidos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {!administra && <div style={ajuda}>Homologado, Suspenso, Bloqueado e Descredenciado: só o administrador do módulo.</div>}
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-categoria">Categoria</label>
          <select id="ed-categoria" style={campo} value={f.categoria} onChange={e => mudar({ categoria: e.target.value })}>
            {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-criticidade">Criticidade</label>
          <select id="ed-criticidade" style={campo} value={f.criticidade} onChange={e => mudar({ criticidade: e.target.value as Criticidade })}>
            {CRITICIDADES.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-regime">Regime tributário</label>
          <select id="ed-regime" style={campo} value={f.regimeTributario} onChange={e => mudar({ regimeTributario: e.target.value })}>
            {REGIMES_TRIBUTARIOS.map(r => <option key={r} value={r}>{r || 'Não informado'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-ie">Inscrição estadual</label>
          <input id="ed-ie" style={campo} value={f.inscricaoEstadual} onChange={e => mudar({ inscricaoEstadual: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-im">Inscrição municipal</label>
          <input id="ed-im" style={campo} value={f.inscricaoMunicipal} onChange={e => mudar({ inscricaoMunicipal: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="ed-endereco">Endereço</label>
          <input id="ed-endereco" style={campo} value={f.endereco} onChange={e => mudar({ endereco: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-cidade">Cidade</label>
          <input id="ed-cidade" style={campo} value={f.cidade} onChange={e => mudar({ cidade: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="ed-uf">UF</label>
          <input id="ed-uf" style={campo} maxLength={2} value={f.uf} onChange={e => mudar({ uf: e.target.value.toUpperCase() })} />
        </div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <CampoContato titulo="Contato comercial" valor={f.contatoComercial} aoMudar={c => mudar({ contatoComercial: c })} />
        <CampoContato titulo="Contato fiscal / contábil" valor={f.contatoFiscal} aoMudar={c => mudar({ contatoFiscal: c })} />
        <CampoContato titulo="Contato financeiro / faturamento" valor={f.contatoFinanceiro} aoMudar={c => mudar({ contatoFinanceiro: c })} />
      </div>

      <label style={rotulo} htmlFor="ed-obs">Observações</label>
      <textarea id="ed-obs" style={{ ...campo, resize: 'vertical' }} rows={3} value={f.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13.5px' }}>
        <input type="checkbox" checked={f.ativo} onChange={e => mudar({ ativo: e.target.checked })} />
        Cadastro ativo (desmarque para tirar de uso; nada é apagado)
      </label>

      <div style={{ marginTop: '14px' }}>
        <label style={rotulo} htmlFor="ed-motivo">Motivo da alteração</label>
        <textarea id="ed-motivo" style={{ ...campo, resize: 'vertical' }} rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
          placeholder="Ex.: homologação aprovada pela Coordenação de Suprimentos em 10/11." />
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------
// Registrar / renovar documento
// ------------------------------------------------------------

const DocumentoModal: React.FC<{
  tipo: ITipoDocumentoFornecedor;
  envioDisponivel: boolean;
  fechar: () => void;
  salvar: (dados: { titulo: string; emissao: string; vencimento: string; observacoes: string; arquivo?: File; linkArquivo?: string }) => Promise<void>;
}> = ({ tipo, envioDisponivel, fechar, salvar }) => {

  const [emissao, setEmissao] = React.useState('');
  const [vencimento, setVencimento] = React.useState('');
  const [vencimentoManual, setVencimentoManual] = React.useState(false);
  const [observacoes, setObservacoes] = React.useState('');
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [link, setLink] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const mudarEmissao = (valor: string): void => {
    setEmissao(valor);
    if (!vencimentoManual) {
      setVencimento(sugerirVencimento(valor, tipo.validadeDias));
    }
  };

  const confirmar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      await salvar({ titulo: tipo.nome, emissao, vencimento, observacoes, arquivo, linkArquivo: link });
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo={tipo.nome}
      subtitulo={tipo.descricao || 'Registre a versão atual do documento. A anterior fica no histórico.'}
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={620}
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
      <div style={{ marginBottom: '10px' }}>
        <Selo tom={tipo.visibilidade === 'Externo' ? 'azul' : 'cinza'}>
          {tipo.visibilidade === 'Externo' ? 'Externo: o fornecedor verá no portal futuro' : 'Interno: só a DGT vê'}
        </Selo>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px 14px' }}>
        <div>
          <label style={rotulo} htmlFor="doc-emissao">Emissão</label>
          <input id="doc-emissao" type="date" style={campo} value={emissao} onChange={e => mudarEmissao(e.target.value)} />
        </div>
        <div>
          <label style={rotulo} htmlFor="doc-validade">Validade{tipo.exigeValidade ? '' : ' (se houver)'}</label>
          <input id="doc-validade" type="date" style={campo} value={vencimento} onChange={e => { setVencimento(e.target.value); setVencimentoManual(true); }} />
          {tipo.validadeDias && !vencimentoManual && <div style={ajuda}>Sugerida: emissão + {tipo.validadeDias} dias. Confira no documento.</div>}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <label style={rotulo} htmlFor="doc-arquivo">Arquivo</label>
        <input id="doc-arquivo" type="file" disabled={!envioDisponivel} onChange={e => setArquivo(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} />
        <div style={ajuda}>
          {envioDisponivel
            ? 'Vai para a biblioteca de documentos de fornecedores, numa pasta do fornecedor.'
            : 'Envio indisponível nesta página: informe o link do arquivo abaixo.'}
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <label style={rotulo} htmlFor="doc-link">ou link do arquivo no SharePoint</label>
        <input id="doc-link" style={campo} value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />
      </div>

      <div style={{ marginTop: '10px' }}>
        <label style={rotulo} htmlFor="doc-obs">Observações</label>
        <textarea id="doc-obs" style={{ ...campo, resize: 'vertical' }} rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
      </div>
    </Modal>
  );
};

const DetalheFornecedorView: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  tipos: ITipoDocumentoFornecedor[];
  administra: boolean;
  usuarioNome: string;
  voltar: () => void;
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, tipos, administra, usuarioNome, voltar, aoAlterar }) => {

  const [secao, setSecao] = React.useState<Secao>('dados');
  const [documentos, setDocumentos] = React.useState<IDocumentoFornecedor[] | undefined>(undefined);
  const [consultas, setConsultas] = React.useState<IConsultaFornecedor[] | undefined>(undefined);
  const [historico, setHistorico] = React.useState<IHistoricoFornecedor[] | undefined>(undefined);
  const [erro, setErro] = React.useState('');
  const [consultando, setConsultando] = React.useState('');
  const [editando, setEditando] = React.useState(false);
  const [registrar, setRegistrar] = React.useState<ITipoDocumentoFornecedor | undefined>(undefined);
  const [verAnteriores, setVerAnteriores] = React.useState(false);

  const carregarDocumentos = React.useCallback(async (): Promise<void> => {
    try {
      setDocumentos(await servico.listarDocumentos(fornecedor.id, tipos));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id, tipos]);

  const carregarConsultas = React.useCallback(async (): Promise<void> => {
    try {
      setConsultas(await servico.listarConsultas(fornecedor.id));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id]);

  const carregarHistorico = React.useCallback(async (): Promise<void> => {
    try {
      setHistorico(await servico.listarHistorico(fornecedor.id));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor.id]);

  React.useEffect(() => {
    setDocumentos(undefined);
    setConsultas(undefined);
    setHistorico(undefined);
    carregarDocumentos().catch(() => undefined);
  }, [carregarDocumentos]);

  React.useEffect(() => {
    if (secao === 'consultas' && !consultas) { carregarConsultas().catch(() => undefined); }
    if (secao === 'historico' && !historico) { carregarHistorico().catch(() => undefined); }
  }, [secao, consultas, historico, carregarConsultas, carregarHistorico]);

  const situacao = calcularSituacao(fornecedor, tipos, documentos || []);

  const consultarAgora = async (quais: Array<'cnpj' | 'sancoes'>): Promise<void> => {
    setConsultando(quais.length > 1 ? 'Consultando Receita e sanções…' : quais[0] === 'cnpj' ? 'Consultando a Receita…' : 'Consultando sanções…');
    setErro('');
    try {
      const r = await servico.consultar(fornecedor.id, quais, usuarioNome);
      const partes: string[] = [];
      if (r.cnpj) { partes.push(`CNPJ: ${r.cnpj.mensagem}`); }
      if (r.resultadoSancoes) { partes.push(`Sanções: ${r.resultadoSancoes}`); }
      if (r.leniencia && r.leniencia.registros > 0) { partes.push(`Leniência: ${r.leniencia.mensagem}`); }
      await carregarConsultas();
      await aoAlterar(partes.join(' · '));
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setConsultando('');
    }
  };

  const outrosTipos = tipos.filter(t => t.ativo && !tipoSeAplica(t, fornecedor.categoria));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" style={botao('discreto')} onClick={voltar}>← Fornecedores</button>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '19px', fontWeight: 700 }}>{fornecedor.razaoSocial}</div>
          <div style={{ fontSize: '13px', color: COR.texto2 }}>
            {fornecedor.cnpj ? formatarCnpj(fornecedor.cnpj) : 'CNPJ protegido (sem permissão de leitura)'}
            {fornecedor.categoria && ` · ${fornecedor.categoria}`}
            {fornecedor.criticidade && ` · criticidade ${fornecedor.criticidade}`}
          </div>
        </div>
        <Selo tom={fornecedor.status === 'Homologado' ? 'ciano' : STATUS_RESTRITOS.indexOf(fornecedor.status) >= 0 ? 'indigo' : 'azul'}>{fornecedor.status}</Selo>
        {!fornecedor.ativo && <Selo tom="cinza">inativo</Selo>}
        {fornecedor.resultadoSancoes === 'Com registro' && <Selo tom="indigo">! sanção vigente</Selo>}
      </div>

      <div role="tablist" aria-label="Seções do fornecedor" style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${COR.cinzaClaro}`, marginBottom: '14px', overflowX: 'auto' }}>
        {SECOES.map(s => {
          const ativo = s.id === secao;
          const contagem = s.id === 'documentos' && situacao.pendencias.length > 0 ? ` (${situacao.pendencias.length})` : '';
          return (
            <button key={s.id} type="button" role="tab" aria-selected={ativo} onClick={() => setSecao(s.id)}
              style={{ padding: '8px 14px', border: 0, borderBottom: `3px solid ${ativo ? COR.ciano : 'transparent'}`, marginBottom: '-1px', background: 'none', color: COR.azul, fontWeight: ativo ? 700 : 500, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {s.rotulo}{contagem}
            </button>
          );
        })}
      </div>

      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      {/* ---------------- Dados ---------------- */}
      {secao === 'dados' && (
        <div style={painel}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <button type="button" style={botao('secundario')} onClick={() => setEditando(true)}>Editar</button>
          </div>
          <Linha titulo="Nome fantasia">{fornecedor.nomeFantasia}</Linha>
          <Linha titulo="Situação na Receita">
            {fornecedor.situacaoCadastral ? `${fornecedor.situacaoCadastral}${fornecedor.dataSituacao ? ` desde ${dataBr(fornecedor.dataSituacao)}` : ''}` : 'ainda não consultada'}
          </Linha>
          <Linha titulo="Abertura">{fornecedor.dataAbertura ? dataBr(fornecedor.dataAbertura) : ''}</Linha>
          <Linha titulo="Natureza / porte">{[fornecedor.naturezaJuridica, fornecedor.porte].filter(Boolean).join(' · ')}</Linha>
          <Linha titulo="Atividade principal">{fornecedor.cnaePrincipal}</Linha>
          <Linha titulo="Endereço">{[fornecedor.endereco, [fornecedor.cidade, fornecedor.uf].filter(Boolean).join('/')].filter(Boolean).join(' — ')}</Linha>
          <Linha titulo="Inscrições">{[fornecedor.inscricaoEstadual && `IE ${fornecedor.inscricaoEstadual}`, fornecedor.inscricaoMunicipal && `IM ${fornecedor.inscricaoMunicipal}`].filter(Boolean).join(' · ')}</Linha>
          <Linha titulo="Regime tributário">{fornecedor.regimeTributario}</Linha>
          <Linha titulo="Contato comercial">{[fornecedor.contatoComercial.nome, fornecedor.contatoComercial.email, fornecedor.contatoComercial.telefone].filter(Boolean).join(' · ')}</Linha>
          <Linha titulo="Contato fiscal / contábil">{[fornecedor.contatoFiscal.nome, fornecedor.contatoFiscal.email, fornecedor.contatoFiscal.telefone].filter(Boolean).join(' · ')}</Linha>
          <Linha titulo="Contato financeiro">{[fornecedor.contatoFinanceiro.nome, fornecedor.contatoFinanceiro.email, fornecedor.contatoFinanceiro.telefone].filter(Boolean).join(' · ')}</Linha>
          <Linha titulo="Observações">{fornecedor.observacoes}</Linha>
          <Linha titulo="Cadastrado em">{formatarDataHora(fornecedor.criadoEm)}</Linha>
        </div>
      )}

      {/* ---------------- Documentos ---------------- */}
      {secao === 'documentos' && (
        <div>
          {!documentos && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando documentos…</div>}
          {documentos && situacao.itens.length === 0 && (
            <Aviso tipo="info">Nenhum tipo de documento se aplica à categoria “{fornecedor.categoria || 'sem categoria'}”. Configure em Tipos de documento.</Aviso>
          )}
          {documentos && situacao.itens.length > 0 && (
            <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
                <thead>
                  <tr>
                    <th style={celulaCabecalho}>Documento</th>
                    <th style={celulaCabecalho}>Situação</th>
                    <th style={celulaCabecalho}>Emissão</th>
                    <th style={celulaCabecalho}>Validade</th>
                    <th style={celulaCabecalho}>Arquivo</th>
                    <th style={celulaCabecalho} />
                  </tr>
                </thead>
                <tbody>
                  {situacao.itens.map(item => (
                    <tr key={item.tipo.id}>
                      <td style={celula}>
                        <div style={{ fontWeight: 600 }}>{item.tipo.nome}</div>
                        <div style={{ fontSize: '12px', color: COR.texto2 }}>
                          {item.tipo.obrigatorio ? 'obrigatório' : 'opcional'} · {item.tipo.visibilidade === 'Externo' ? 'externo' : 'interno'}
                        </div>
                      </td>
                      <td style={celula}><Selo tom={TOM_ESTADO[item.estado]}>{rotuloEstado(item)}</Selo></td>
                      <td style={celula}>{item.documento ? dataBr(item.documento.emissao) : '—'}</td>
                      <td style={celula}>{item.documento && item.documento.vencimento ? dataBr(item.documento.vencimento) : '—'}</td>
                      <td style={celula}>
                        {item.documento && item.documento.arquivoUrl
                          ? <a href={item.documento.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: COR.azul }}>abrir</a>
                          : '—'}
                      </td>
                      <td style={{ ...celula, textAlign: 'right' }}>
                        <button type="button" style={botao('secundario')} onClick={() => setRegistrar(item.tipo)}>
                          {item.documento ? 'Renovar' : 'Registrar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {documentos && outrosTipos.length > 0 && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: COR.texto2 }}>Documento de outra categoria:</span>
              <select style={{ ...campo, width: 'auto', minWidth: '260px' }} value="" onChange={e => { const t = outrosTipos.filter(x => x.id === e.target.value)[0]; if (t) { setRegistrar(t); } }}>
                <option value="">Escolha…</option>
                {outrosTipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
          )}

          {documentos && documentos.some(d => d.situacao === 'Substituído') && (
            <div style={{ marginTop: '14px' }}>
              <button type="button" style={botao('discreto')} onClick={() => setVerAnteriores(!verAnteriores)}>
                {verAnteriores ? '▾' : '▸'} Versões anteriores ({documentos.filter(d => d.situacao === 'Substituído').length})
              </button>
              {verAnteriores && (
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.7 }}>
                  {documentos.filter(d => d.situacao === 'Substituído').map(d => (
                    <li key={d.id}>
                      {d.tipoNome} — emissão {dataBr(d.emissao)}{d.vencimento ? `, validade ${dataBr(d.vencimento)}` : ''} · {d.registradoPor || '—'}
                      {d.arquivoUrl && <> · <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: COR.azul }}>abrir</a></>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Consultas ---------------- */}
      {secao === 'consultas' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
            <button type="button" style={botao('principal', !!consultando)} disabled={!!consultando} onClick={() => { consultarAgora(['cnpj', 'sancoes']).catch(() => undefined); }}>
              {consultando || 'Consultar agora'}
            </button>
            <button type="button" style={botao('secundario', !!consultando)} disabled={!!consultando} onClick={() => { consultarAgora(['sancoes']).catch(() => undefined); }}>Só sanções</button>
            <button type="button" style={botao('secundario', !!consultando)} disabled={!!consultando} onClick={() => { consultarAgora(['cnpj']).catch(() => undefined); }}>Só Receita</button>
            <span style={{ fontSize: '12.5px', color: COR.texto2 }}>
              Última: Receita {fornecedor.ultimaConsultaCnpj ? formatarDataHora(fornecedor.ultimaConsultaCnpj) : 'nunca'} · sanções {fornecedor.ultimaConsultaSancoes ? formatarDataHora(fornecedor.ultimaConsultaSancoes) : 'nunca'}
            </span>
          </div>
          <div style={ajuda}>
            Automáticas: Receita (CNPJá) e, no Portal da Transparência, CEIS, CNEP, CEPIM e acordos de leniência (leniência é informativa e não altera o resultado de sanções).
            A consulta consolidada do TCU (licitantes inidôneos e CNJ) ainda não é automática: emita no site do TCU e registre em Documentos.
          </div>

          {!consultas && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando consultas…</div>}
          {consultas && consultas.length === 0 && <Aviso tipo="info">Nenhuma consulta registrada ainda.</Aviso>}
          {consultas && consultas.length > 0 && (
            <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
              {consultas.map(c => (
                <div key={c.id} style={{ ...painel, padding: '12px 16px', borderLeft: `4px solid ${/com registro|erro|situação:|em vigor/i.test(c.resultado) ? COR.indigo : COR.ciano}` }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>{ROTULO_CONSULTA[c.tipo] || c.tipo}</strong>
                    <Selo tom={/com registro|erro|situação:|em vigor/i.test(c.resultado) ? 'indigo' : 'ciano'}>{c.resultado}</Selo>
                    <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{formatarDataHora(c.quando)} · {c.executadoPor || '—'} · {c.fonte}</span>
                  </div>
                  {c.resumo && <div style={{ fontSize: '13.5px', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{c.resumo}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Histórico ---------------- */}
      {secao === 'historico' && (
        <div>
          {!historico && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando histórico…</div>}
          {historico && historico.length === 0 && <Aviso tipo="info">Sem registros no histórico.</Aviso>}
          {historico && historico.length > 0 && (
            <div style={{ display: 'grid', gap: '8px' }}>
              {historico.map(h => (
                <div key={h.id} style={{ ...painel, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <strong>{h.acao}</strong>
                    <span style={{ fontSize: '12.5px', color: COR.texto2 }}>{formatarDataHora(h.quando)} · {h.usuario || '—'}</span>
                  </div>
                  {h.descricao && <div style={{ fontSize: '13.5px', marginTop: '4px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{h.descricao}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editando && (
        <EditarFornecedorModal
          fornecedor={fornecedor}
          administra={administra}
          fechar={() => setEditando(false)}
          salvar={async (novo, motivo) => {
            await servico.atualizarFornecedor(novo, fornecedor, motivo, usuarioNome);
            setEditando(false);
            setHistorico(undefined);
            await aoAlterar('Cadastro atualizado.');
          }}
        />
      )}

      {registrar && (
        <DocumentoModal
          tipo={registrar}
          envioDisponivel={servico.envioDisponivel}
          fechar={() => setRegistrar(undefined)}
          salvar={async dados => {
            const vigentes = (documentos || []).filter(d => d.tipoId === registrar.id && d.situacao === 'Vigente');
            await servico.registrarDocumento(fornecedor, { ...dados, tipo: registrar }, vigentes, usuarioNome);
            setRegistrar(undefined);
            setHistorico(undefined);
            await carregarDocumentos();
            await aoAlterar(`${registrar.nome}: registrado.`);
          }}
        />
      )}
    </div>
  );
};

export default DetalheFornecedorView;
