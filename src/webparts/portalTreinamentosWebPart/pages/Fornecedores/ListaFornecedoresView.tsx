import * as React from 'react';

import {
  FornecedoresService,
  INovoFornecedor
} from '../../services/fornecedores/FornecedoresService';

import {
  CATEGORIAS_FORNECEDOR,
  CRITICIDADES,
  Criticidade,
  IContatoFornecedor,
  IResultadoPrevia,
  REGIMES_TRIBUTARIOS,
  STATUS_FORNECEDOR
} from '../../services/fornecedores/modeloFornecedores';

import {
  formatarCnpj,
  normalizarCnpj,
  validarCnpjDigitado
} from '../../utils/cnpj';

import {
  Aviso,
  COR,
  Modal,
  Selo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  rotulo
} from '../Kits/kitsComum';

import {
  IFornecedorComSituacao
} from '../../services/fornecedores/situacaoDocumental';

// ============================================================
// FORNECEDORES — LISTA E NOVO CADASTRO
//
// Novo cadastro: o CNPJ é conferido no servidor (duplicidade) e os
// dados da Receita vêm do CNPJá para preencher o formulário. Depois de
// gravar, o portal já pede a consulta CNPJ + CEIS/CNEP.
// ============================================================

const contatoVazio = (): IContatoFornecedor => ({ nome: '', email: '', telefone: '' });

const novoVazio = (): INovoFornecedor => ({
  cnpj: '', razaoSocial: '', nomeFantasia: '', categoria: '', criticidade: '',
  uf: '', cidade: '', endereco: '', inscricaoEstadual: '', inscricaoMunicipal: '', regimeTributario: '',
  contatoComercial: contatoVazio(), contatoFiscal: contatoVazio(), contatoFinanceiro: contatoVazio(),
  observacoes: ''
});

export const resumoPendencias = (i: IFornecedorComSituacao): React.ReactNode => {
  const s = i.situacao;
  if (s.pendencias.length === 0) {
    return <span style={{ color: COR.texto2 }}>em dia</span>;
  }
  const partes: string[] = [];
  if (s.vencidos) { partes.push(`${s.vencidos} vencido${s.vencidos > 1 ? 's' : ''}`); }
  if (s.faltando) { partes.push(`${s.faltando} faltando`); }
  if (s.aVencer) { partes.push(`${s.aVencer} a vencer`); }
  return <Selo tom={s.vencidos || s.faltando ? 'indigo' : 'cinza'}>{partes.join(' · ')}</Selo>;
};

// ------------------------------------------------------------
// Novo fornecedor
// ------------------------------------------------------------

const CampoContato: React.FC<{ titulo: string; valor: IContatoFornecedor; aoMudar: (c: IContatoFornecedor) => void }> = ({ titulo, valor, aoMudar }) => (
  <div style={{ marginBottom: '10px' }}>
    <span style={rotulo}>{titulo}</span>
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <input aria-label={`${titulo} — nome`} style={{ ...campo, flex: '2 1 160px', width: 'auto' }} placeholder="Nome" value={valor.nome} onChange={e => aoMudar({ ...valor, nome: e.target.value })} />
      <input aria-label={`${titulo} — e-mail`} style={{ ...campo, flex: '2 1 160px', width: 'auto' }} placeholder="E-mail" value={valor.email} onChange={e => aoMudar({ ...valor, email: e.target.value })} />
      <input aria-label={`${titulo} — telefone`} style={{ ...campo, flex: '1 1 120px', width: 'auto' }} placeholder="Telefone" value={valor.telefone} onChange={e => aoMudar({ ...valor, telefone: e.target.value })} />
    </div>
  </div>
);

const NovoFornecedorModal: React.FC<{
  servico: FornecedoresService;
  usuarioNome: string;
  fechar: () => void;
  abrirExistente: (id: string) => void;
  aoCriar: (id: string, aviso: string) => Promise<void>;
}> = ({ servico, usuarioNome, fechar, abrirExistente, aoCriar }) => {

  const [dados, setDados] = React.useState<INovoFornecedor>(novoVazio());
  const [previa, setPrevia] = React.useState<IResultadoPrevia | undefined>(undefined);
  const [buscando, setBuscando] = React.useState(false);
  const [gravando, setGravando] = React.useState('');
  const [erro, setErro] = React.useState('');

  const erroCnpj = dados.cnpj ? validarCnpjDigitado(dados.cnpj) : undefined;
  const mudar = (parcial: Partial<INovoFornecedor>): void => setDados(atual => ({ ...atual, ...parcial }));

  const buscar = async (): Promise<void> => {
    const problema = validarCnpjDigitado(dados.cnpj);
    if (problema) {
      setErro(problema);
      return;
    }
    setBuscando(true);
    setErro('');
    setPrevia(undefined);
    try {
      const resultado = await servico.consultarPrevia(dados.cnpj);
      setPrevia(resultado);
      if (resultado.dados) {
        const r = resultado.dados;
        setDados(atual => ({
          ...atual,
          cnpj: formatarCnpj(atual.cnpj),
          razaoSocial: r.razaoSocial || atual.razaoSocial,
          nomeFantasia: r.nomeFantasia || atual.nomeFantasia,
          uf: r.uf || atual.uf,
          cidade: r.cidade || atual.cidade,
          endereco: r.endereco || atual.endereco
        }));
      }
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  const salvar = async (): Promise<void> => {
    setErro('');
    setGravando('Gravando o cadastro…');
    let id = '';
    try {
      id = await servico.criarFornecedor(dados, usuarioNome);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setGravando('');
      return;
    }

    setGravando('Consultando Receita e sanções…');
    let aviso = `${dados.razaoSocial}: cadastrado em homologação.`;
    try {
      const r = await servico.consultar(id, ['cnpj', 'sancoes'], usuarioNome);
      if (r.resultadoSancoes === 'Com registro') {
        aviso += ' ATENÇÃO: há sanção ou impedimento vigente (CEIS, CNEP ou CEPIM) — veja a aba Consultas.';
      } else if (r.resultadoSancoes === 'Nada consta') {
        aviso += ' CEIS, CNEP e CEPIM: nada consta.';
      } else if (r.resultadoSancoes) {
        aviso += ` Sanções: ${r.resultadoSancoes.toLowerCase()}.`;
      }
      if (r.leniencia && r.leniencia.registros > 0) {
        aviso += ` Leniência: ${r.leniencia.mensagem}.`;
      }
      if (r.cnpj && !r.cnpj.ok) {
        aviso += ` CNPJ: ${r.cnpj.mensagem}`;
      }
    } catch (e) {
      aviso += ` As consultas automáticas não rodaram (${String((e as Error)?.message || e)}). Use "Consultar agora" no cadastro.`;
    }
    setGravando('');
    await aoCriar(id, aviso);
  };

  const existente = previa ? previa.existente : undefined;
  const podeSalvar = !gravando && !erroCnpj && !!dados.cnpj && !!dados.razaoSocial.trim() && !!dados.categoria && !existente;

  return (
    <Modal
      titulo="Novo fornecedor"
      subtitulo="Comece pelo CNPJ: o portal confere se já existe e busca os dados na Receita."
      aoFechar={() => { if (!gravando) { fechar(); } }}
      largura={760}
      rodape={(
        <>
          <button type="button" style={botao('secundario', !!gravando)} disabled={!!gravando} onClick={fechar}>Cancelar</button>
          <button type="button" style={botao('principal', !podeSalvar)} disabled={!podeSalvar} onClick={() => { salvar().catch(() => undefined); }}>
            {gravando || 'Cadastrar e consultar'}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <label style={rotulo} htmlFor="novo-cnpj">CNPJ</label>
          <input
            id="novo-cnpj"
            style={campo}
            value={dados.cnpj}
            onChange={e => { mudar({ cnpj: e.target.value }); setPrevia(undefined); }}
            onBlur={() => { if (!validarCnpjDigitado(dados.cnpj)) { mudar({ cnpj: formatarCnpj(dados.cnpj) }); } }}
            placeholder="00.000.000/0000-00"
            autoComplete="off"
          />
        </div>
        <button type="button" style={botao('secundario', buscando || !!erroCnpj || !dados.cnpj)} disabled={buscando || !!erroCnpj || !dados.cnpj} onClick={() => { buscar().catch(() => undefined); }}>
          {buscando ? 'Buscando…' : 'Buscar na Receita'}
        </button>
      </div>
      {erroCnpj && <div style={{ ...ajuda, color: COR.indigo }}>{erroCnpj}</div>}
      <div style={ajuda}>Aceita o CNPJ numérico e o alfanumérico. O CNPJ não pode ser alterado depois do cadastro.</div>

      {existente && (
        <div style={{ marginTop: '12px' }}>
          <Aviso
            tipo="alerta"
            acao={<button type="button" style={botao('secundario')} onClick={() => abrirExistente(existente.id)}>Abrir cadastro</button>}
          >
            Este CNPJ já está cadastrado como “{existente.razaoSocial}”{existente.ativo ? '' : ' (inativo)'}.
          </Aviso>
        </div>
      )}
      {previa && previa.aviso && <div style={{ marginTop: '12px' }}><Aviso tipo="info">{previa.aviso}</Aviso></div>}
      {previa && previa.dados && (
        <div style={{ marginTop: '12px' }}>
          <Aviso tipo={/ativa/i.test(previa.dados.situacaoCadastral) ? 'ok' : 'alerta'}>
            Receita: situação <strong>{previa.dados.situacaoCadastral || 'não informada'}</strong>
            {previa.dados.cnaePrincipal && <> · {previa.dados.cnaePrincipal}</>}. Confira os dados abaixo.
          </Aviso>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 14px', marginTop: '14px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="novo-razao">Razão social</label>
          <input id="novo-razao" style={campo} value={dados.razaoSocial} onChange={e => mudar({ razaoSocial: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-fantasia">Nome fantasia</label>
          <input id="novo-fantasia" style={campo} value={dados.nomeFantasia} onChange={e => mudar({ nomeFantasia: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-categoria">Categoria</label>
          <select id="novo-categoria" style={campo} value={dados.categoria} onChange={e => mudar({ categoria: e.target.value })}>
            <option value="">Escolha…</option>
            {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-criticidade">Criticidade</label>
          <select id="novo-criticidade" style={campo} value={dados.criticidade} onChange={e => mudar({ criticidade: e.target.value as Criticidade })}>
            {CRITICIDADES.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-regime">Regime tributário</label>
          <select id="novo-regime" style={campo} value={dados.regimeTributario} onChange={e => mudar({ regimeTributario: e.target.value })}>
            {REGIMES_TRIBUTARIOS.map(r => <option key={r} value={r}>{r || 'Não informado'}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-ie">Inscrição estadual</label>
          <input id="novo-ie" style={campo} value={dados.inscricaoEstadual} onChange={e => mudar({ inscricaoEstadual: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-im">Inscrição municipal</label>
          <input id="novo-im" style={campo} value={dados.inscricaoMunicipal} onChange={e => mudar({ inscricaoMunicipal: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={rotulo} htmlFor="novo-endereco">Endereço</label>
          <input id="novo-endereco" style={campo} value={dados.endereco} onChange={e => mudar({ endereco: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-cidade">Cidade</label>
          <input id="novo-cidade" style={campo} value={dados.cidade} onChange={e => mudar({ cidade: e.target.value })} />
        </div>
        <div>
          <label style={rotulo} htmlFor="novo-uf">UF</label>
          <input id="novo-uf" style={campo} maxLength={2} value={dados.uf} onChange={e => mudar({ uf: e.target.value.toUpperCase() })} />
        </div>
      </div>

      <div style={{ marginTop: '14px' }}>
        <CampoContato titulo="Contato comercial" valor={dados.contatoComercial} aoMudar={c => mudar({ contatoComercial: c })} />
        <CampoContato titulo="Contato fiscal / contábil" valor={dados.contatoFiscal} aoMudar={c => mudar({ contatoFiscal: c })} />
        <CampoContato titulo="Contato financeiro / faturamento" valor={dados.contatoFinanceiro} aoMudar={c => mudar({ contatoFinanceiro: c })} />
      </div>

      <label style={rotulo} htmlFor="novo-obs">Observações</label>
      <textarea id="novo-obs" style={{ ...campo, resize: 'vertical' }} rows={3} value={dados.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
      <div style={ajuda}>Não escreva CPF, CNPJ, senhas ou dados bancários aqui: o portal bloqueia (LGPD).</div>
    </Modal>
  );
};

const ListaFornecedoresView: React.FC<{
  servico: FornecedoresService;
  itens: IFornecedorComSituacao[];
  usuarioNome: string;
  abrir: (id: string) => void;
  aoCriar: (id: string, aviso: string) => Promise<void>;
}> = ({ servico, itens, usuarioNome, abrir, aoCriar }) => {

  const [busca, setBusca] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [categoria, setCategoria] = React.useState('');
  const [mostrarInativos, setMostrarInativos] = React.useState(false);
  const [novo, setNovo] = React.useState(false);

  const termo = busca.trim().toLowerCase();
  const termoCnpj = normalizarCnpj(busca);

  const filtrados = itens.filter(i => {
    const f = i.fornecedor;
    if (!mostrarInativos && !f.ativo) { return false; }
    if (status && f.status !== status) { return false; }
    if (categoria && f.categoria !== categoria) { return false; }
    if (!termo) { return true; }
    return f.razaoSocial.toLowerCase().indexOf(termo) >= 0 ||
      f.nomeFantasia.toLowerCase().indexOf(termo) >= 0 ||
      f.cidade.toLowerCase().indexOf(termo) >= 0 ||
      (termoCnpj.length >= 4 && !!f.cnpj && f.cnpj.indexOf(termoCnpj) >= 0);
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
        <div style={{ flex: '2 1 240px' }}>
          <label style={rotulo} htmlFor="forn-busca">Buscar</label>
          <input id="forn-busca" style={campo} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Razão social, fantasia, cidade ou CNPJ" />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={rotulo} htmlFor="forn-status">Status</label>
          <select id="forn-status" style={campo} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUS_FORNECEDOR.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label style={rotulo} htmlFor="forn-categoria">Categoria</label>
          <select id="forn-categoria" style={campo} value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">Todas</option>
            {CATEGORIAS_FORNECEDOR.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', minHeight: '36px' }}>
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} /> Mostrar inativos
        </label>
        <button type="button" style={botao('principal')} onClick={() => setNovo(true)}>+ Novo fornecedor</button>
      </div>

      {filtrados.length === 0
        ? <Aviso tipo="info">{itens.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum fornecedor com esses filtros.'}</Aviso>
        : (
          <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
              <thead>
                <tr>
                  <th style={celulaCabecalho}>Fornecedor</th>
                  <th style={celulaCabecalho}>Categoria</th>
                  <th style={celulaCabecalho}>Status</th>
                  <th style={celulaCabecalho}>Documentos</th>
                  <th style={celulaCabecalho}>Sanções</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(i => (
                  <tr key={i.fornecedor.id} onClick={() => abrir(i.fornecedor.id)} style={{ cursor: 'pointer', opacity: i.fornecedor.ativo ? 1 : 0.55 }}>
                    <td style={celula}>
                      <div style={{ fontWeight: 600 }}>{i.fornecedor.razaoSocial}</div>
                      <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
                        {[i.fornecedor.nomeFantasia, [i.fornecedor.cidade, i.fornecedor.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') || '—'}
                        {!i.fornecedor.ativo && ' · inativo'}
                      </div>
                    </td>
                    <td style={celula}>{i.fornecedor.categoria || '—'}</td>
                    <td style={celula}>{i.fornecedor.status}</td>
                    <td style={celula}>{resumoPendencias(i)}</td>
                    <td style={celula}>
                      {i.fornecedor.resultadoSancoes === 'Com registro'
                        ? <Selo tom="indigo">! com registro</Selo>
                        : <span style={{ color: COR.texto2 }}>{i.fornecedor.resultadoSancoes}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {novo && (
        <NovoFornecedorModal
          servico={servico}
          usuarioNome={usuarioNome}
          fechar={() => setNovo(false)}
          abrirExistente={id => { setNovo(false); abrir(id); }}
          aoCriar={async (id, aviso) => { setNovo(false); await aoCriar(id, aviso); }}
        />
      )}
    </div>
  );
};

export { CampoContato };
export default ListaFornecedoresView;
