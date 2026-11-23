import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  IContratoFornecedor,
  IFornecedor
} from '../../services/fornecedores/modeloFornecedores';

import {
  filtrarContratos,
  IDadosContrato,
  OrdemContrato,
  ordenarContratos,
  projetosDistintos,
  situacaoDoContrato,
  SituacaoContrato,
  validarContrato
} from '../../services/fornecedores/contratos';

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
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — CONTRATOS
//
// Aba Contratos do fornecedor (novo, editar, encerrar) e visão
// Contratos do módulo (todos os fornecedores, só leitura; "Abrir" leva
// ao fornecedor). Ordena por assinatura, início ou fim da vigência;
// filtra por projeto (valores já usados) e por "vencendo em 30 dias".
// Contrato não é excluído: encerra, com motivo.
// ============================================================

const DIAS_FILTRO_VENCENDO = 30;

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const TOM_SITUACAO: Record<SituacaoContrato, TomSelo> = {
  'Vigente': 'ciano',
  'Vence em breve': 'azul',
  'Vencido': 'indigo',
  'Encerrado': 'cinza'
};

const VAZIO: IDadosContrato = { nome: '', projeto: '', dataAssinatura: '', inicioVigencia: '', fimVigencia: '', observacoes: '' };

export const dadosDoContrato = (c?: IContratoFornecedor): IDadosContrato =>
  c
    ? { nome: c.nome, projeto: c.projeto, dataAssinatura: c.dataAssinatura, inicioVigencia: c.inicioVigencia, fimVigencia: c.fimVigencia, observacoes: c.observacoes }
    : { ...VAZIO };

// Campos do contrato (usados também no Conferir → "É um contrato").
export const CamposContrato: React.FC<{
  d: IDadosContrato;
  mudar: (parcial: Partial<IDadosContrato>) => void;
  projetos: string[];
  prefixo: string;
}> = ({ d, mudar, projetos, prefixo }) => (
  <>
    <label style={rotulo} htmlFor={`${prefixo}-nome`}>Nome do contrato</label>
    <input id={`${prefixo}-nome`} style={campo} value={d.nome} maxLength={200} onChange={e => mudar({ nome: e.target.value })} placeholder="Ex.: Contrato de prestação de serviços de manutenção" />

    <label style={rotulo} htmlFor={`${prefixo}-projeto`}>Projeto</label>
    <input id={`${prefixo}-projeto`} style={campo} value={d.projeto} maxLength={200} list={`${prefixo}-projetos`} onChange={e => mudar({ projeto: e.target.value })} />
    <datalist id={`${prefixo}-projetos`}>
      {projetos.map(p => <option key={p} value={p} />)}
    </datalist>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 14px', marginTop: '4px' }}>
      <div>
        <label style={rotulo} htmlFor={`${prefixo}-assinatura`}>Assinatura</label>
        <input id={`${prefixo}-assinatura`} type="date" style={campo} value={d.dataAssinatura} onChange={e => mudar({ dataAssinatura: e.target.value })} />
      </div>
      <div>
        <label style={rotulo} htmlFor={`${prefixo}-inicio`}>Início da vigência</label>
        <input id={`${prefixo}-inicio`} type="date" style={campo} value={d.inicioVigencia} onChange={e => mudar({ inicioVigencia: e.target.value })} />
      </div>
      <div>
        <label style={rotulo} htmlFor={`${prefixo}-fim`}>Fim da vigência</label>
        <input id={`${prefixo}-fim`} type="date" style={campo} value={d.fimVigencia} onChange={e => mudar({ fimVigencia: e.target.value })} />
        <div style={ajuda}>Vazio = prazo indeterminado.</div>
      </div>
    </div>

    <label style={rotulo} htmlFor={`${prefixo}-obs`}>Observações</label>
    <textarea id={`${prefixo}-obs`} style={{ ...campo, resize: 'vertical' }} rows={2} value={d.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
  </>
);

const ContratoModal: React.FC<{
  contrato?: IContratoFornecedor;
  projetos: string[];
  envioDisponivel: boolean;
  fechar: () => void;
  salvar: (d: IDadosContrato, arquivo: { arquivo?: File; link?: string }) => Promise<void>;
}> = ({ contrato, projetos, envioDisponivel, fechar, salvar }) => {
  const [d, setD] = React.useState<IDadosContrato>(() => dadosDoContrato(contrato));
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [link, setLink] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const ok = async (): Promise<void> => {
    const problema = validarContrato(d);
    if (problema) {
      setErro(problema);
      return;
    }
    setGravando(true);
    setErro('');
    try {
      await salvar(d, { arquivo, link });
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando(false);
    }
  };

  return (
    <Modal
      titulo={contrato ? 'Editar contrato' : 'Novo contrato'}
      subtitulo="O arquivo fica na pasta do fornecedor, subpasta Contratos."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={620}
      rodape={(
        <>
          <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', gravando)} disabled={gravando} onClick={() => { ok().catch(() => undefined); }}>
            {gravando ? 'Gravando…' : 'Salvar contrato'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <CamposContrato d={d} mudar={p => setD(a => ({ ...a, ...p }))} projetos={projetos} prefixo="contrato" />

      <label style={rotulo} htmlFor="contrato-arquivo">{contrato && contrato.arquivoUrl ? 'Substituir o arquivo (opcional)' : 'Arquivo (opcional)'}</label>
      {envioDisponivel && (
        <input id="contrato-arquivo" type="file" style={{ ...campo, padding: '6px' }} onChange={e => setArquivo(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} />
      )}
      <input aria-label="Link do arquivo no SharePoint" style={{ ...campo, marginTop: '6px' }} placeholder="ou cole o link do arquivo (https://…)" value={link} onChange={e => setLink(e.target.value)} disabled={!!arquivo} />
    </Modal>
  );
};

const ContratosFornecedorView: React.FC<{
  servico: FornecedoresService;
  // Com fornecedor: aba do fornecedor (edita). Sem: visão do módulo.
  fornecedor?: IFornecedor;
  fornecedores?: IFornecedor[];
  usuarioNome: string;
  abrir?: (fornecedorId: string) => void;
  aoAlterar?: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, fornecedores, usuarioNome, abrir, aoAlterar }) => {

  const [contratos, setContratos] = React.useState<IContratoFornecedor[] | undefined>(undefined);
  const [disponivel, setDisponivel] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [projeto, setProjeto] = React.useState('');
  const [ordem, setOrdem] = React.useState<OrdemContrato>('fim');
  const [soVencendo, setSoVencendo] = React.useState(false);
  const [verEncerrados, setVerEncerrados] = React.useState(false);
  const [editando, setEditando] = React.useState<IContratoFornecedor | 'novo' | undefined>(undefined);

  const carregar = React.useCallback(async (): Promise<void> => {
    try {
      const r = await servico.listarContratos(fornecedor ? fornecedor.id : undefined);
      setDisponivel(r.disponivel);
      setContratos(r.contratos);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fornecedor]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  if (!disponivel) {
    return <Aviso tipo="info">A tabela de contratos ainda não existe no Dataverse. Rode de novo scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.</Aviso>;
  }

  const nomes: Record<string, string> = {};
  (fornecedores || []).forEach(f => { nomes[f.id] = f.razaoSocial; });

  const todos = contratos || [];
  const projetos = projetosDistintos(todos);
  const visiveis = ordenarContratos(
    filtrarContratos(todos, projeto, soVencendo ? DIAS_FILTRO_VENCENDO : undefined)
      .filter(c => verEncerrados || c.situacao !== 'Encerrado')
      .filter(c => fornecedor || nomes[c.fornecedorId]),
    ordem);
  const encerrados = todos.filter(c => c.situacao === 'Encerrado').length;

  const depois = async (aviso: string): Promise<void> => {
    setEditando(undefined);
    await carregar();
    if (aoAlterar) {
      await aoAlterar(aviso);
    }
  };

  const encerrar = (c: IContratoFornecedor): void => {
    if (!fornecedor) {
      return;
    }
    const motivo = window.prompt(`Encerrar "${c.nome}"? Informe o motivo (ex.: fim do projeto, rescisão):`, '');
    if (motivo === null) {
      return;
    }
    servico.encerrarContrato(fornecedor, c, motivo, usuarioNome)
      .then(() => depois('Contrato encerrado.'))
      .catch(e => setErro(String((e as Error)?.message || e)));
  };

  return (
    <div>
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <div style={{ minWidth: '200px' }}>
          <label style={rotulo} htmlFor="contratos-projeto">Projeto</label>
          <select id="contratos-projeto" style={campo} value={projeto} onChange={e => setProjeto(e.target.value)}>
            <option value="">Todos os projetos</option>
            {projetos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={{ minWidth: '200px' }}>
          <label style={rotulo} htmlFor="contratos-ordem">Ordenar por</label>
          <select id="contratos-ordem" style={campo} value={ordem} onChange={e => setOrdem(e.target.value as OrdemContrato)}>
            <option value="fim">Fim da vigência</option>
            <option value="inicio">Início da vigência</option>
            <option value="assinatura">Data de assinatura</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', paddingBottom: '8px' }}>
          <input type="checkbox" checked={soVencendo} onChange={e => setSoVencendo(e.target.checked)} />
          Vencendo em até {DIAS_FILTRO_VENCENDO} dias (e vencidos)
        </label>
        {encerrados > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', paddingBottom: '8px' }}>
            <input type="checkbox" checked={verEncerrados} onChange={e => setVerEncerrados(e.target.checked)} />
            Mostrar encerrados ({encerrados})
          </label>
        )}
        <div style={{ flex: 1 }} />
        {fornecedor && <button type="button" style={botao('principal')} onClick={() => setEditando('novo')}>Novo contrato</button>}
      </div>

      {!contratos && !erro && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando contratos…</div>}
      {contratos && visiveis.length === 0 && <Aviso tipo="info">{todos.length === 0 ? 'Nenhum contrato registrado.' : 'Nenhum contrato com estes filtros.'}</Aviso>}

      {visiveis.length > 0 && (
        <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
            <thead>
              <tr>
                {!fornecedor && <th style={celulaCabecalho}>Fornecedor</th>}
                <th style={celulaCabecalho}>Contrato</th>
                <th style={celulaCabecalho}>Projeto</th>
                <th style={celulaCabecalho}>Assinatura</th>
                <th style={celulaCabecalho}>Vigência</th>
                <th style={celulaCabecalho}>Situação</th>
                <th style={celulaCabecalho}>Arquivo</th>
                <th style={celulaCabecalho} />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(c => {
                const s = situacaoDoContrato(c);
                return (
                  <tr key={c.id}>
                    {!fornecedor && <td style={{ ...celula, fontWeight: 600 }}>{nomes[c.fornecedorId]}</td>}
                    <td style={celula}>
                      <div style={{ fontWeight: 600 }}>{c.nome}</div>
                      {c.origem === 'E-mail' && <div style={{ fontSize: '12px', color: COR.texto2 }}>recebido por e-mail</div>}
                    </td>
                    <td style={celula}>{c.projeto || '—'}</td>
                    <td style={celula}>{dataBr(c.dataAssinatura)}</td>
                    <td style={celula}>{dataBr(c.inicioVigencia)} a {c.fimVigencia ? dataBr(c.fimVigencia) : 'indeterminado'}</td>
                    <td style={celula}><Selo tom={TOM_SITUACAO[s.situacao]}>{s.texto}</Selo></td>
                    <td style={celula}>{c.arquivoUrl ? <a href={c.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ color: COR.azul }}>abrir ↗</a> : '—'}</td>
                    <td style={{ ...celula, whiteSpace: 'nowrap' }}>
                      {fornecedor && c.situacao !== 'Encerrado' && (
                        <>
                          <button type="button" style={botao('secundario')} onClick={() => setEditando(c)}>Editar</button>{' '}
                          <button type="button" style={botao('secundario')} onClick={() => encerrar(c)}>Encerrar</button>
                        </>
                      )}
                      {!fornecedor && abrir && <button type="button" style={botao('secundario')} onClick={() => abrir(c.fornecedorId)}>Abrir</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ ...ajuda, marginTop: '10px' }}>
        O fim da vigência gera aviso interno para Suprimentos (Power Automate, docs/fornecedores.md). Contrato recebido assinado por e-mail entra pela fila “A conferir” (aba Documentos → Conferir → Contrato).
      </div>

      {editando && fornecedor && (
        <ContratoModal
          contrato={editando === 'novo' ? undefined : editando}
          projetos={projetos}
          envioDisponivel={servico.envioDisponivel}
          fechar={() => setEditando(undefined)}
          salvar={async (d, arquivo) => {
            await servico.salvarContrato(fornecedor, editando === 'novo' ? undefined : editando, d, arquivo, usuarioNome);
            await depois(editando === 'novo' ? 'Contrato registrado.' : 'Contrato alterado.');
          }}
        />
      )}
    </div>
  );
};

export default ContratosFornecedorView;
