import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  RhCertificadosService,
  TAMANHO_MAXIMO_ARQUIVO_MB
} from '../../services/RhCertificadosService';

import {
  CATEGORIAS,
  CRITICIDADES,
  CategoriaCertificacao,
  Criticidade,
  ICertificacao,
  IDadosFabricantes,
  IDeclaracao,
  IFabricante,
  ILinhaImportada,
  IPessoaRef,
  ITerceiro,
  RhFabricantesService,
  STATUS_CERTIFICACAO,
  STATUS_MANUAIS,
  StatusCertificacao,
  StatusManual,
  TIPOS_DECLARACAO,
  interpretarResumo,
  normalizarNome
} from '../../services/RhFabricantesService';

// ============================================================
// RH E PESSOAS — ABA FABRICANTES E TERCEIROS
//
// A planilha CONTROLE DE CERTIFICAÇÕES dentro do portal:
//   • Certificações: certificações de fabricante e registros
//     profissionais (CREA/CFT) de colaboradores E terceiros, com o
//     quadro-resumo da capa (criticidade × status);
//   • Declarações dos fabricantes: cartas/declarações com vencimento
//     e documento anexado;
//   • Terceiros: cadastro de quem NÃO tem acesso ao portal;
//   • Fabricantes: cadastro e contato no fabricante.
// ============================================================

export interface IFabricantesTerceirosAbaProps {
  dataverseService?: DataverseService;
  spHttpClient?: SPHttpClient;
  siteUrl?: string;
  usuarioNome?: string;
}

type Secao = 'certificacoes' | 'declaracoes' | 'terceiros' | 'fabricantes';

const SECOES: Array<{ id: Secao; rotulo: string }> = [
  { id: 'certificacoes', rotulo: 'Certificações' },
  { id: 'declaracoes', rotulo: 'Declarações dos fabricantes' },
  { id: 'terceiros', rotulo: 'Terceiros' },
  { id: 'fabricantes', rotulo: 'Fabricantes' }
];

// ------------------------------------------------------------
// Visual (mesma paleta da página de RH)
// ------------------------------------------------------------

const COR = {
  azul: '#202A44',
  azulBotao: '#0B5CAB',
  texto: '#334155',
  sec: '#64748B',
  borda: '#DCE3EC',
  fundo: '#F8FAFC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  ambar: '#B45309',
  ambarClaro: '#FFF4E5',
  vermelho: '#B42318',
  vermelhoClaro: '#FDECEA',
  roxo: '#6D28D9',
  roxoClaro: '#F1EBFE',
  cinzaClaro: '#F1F5F9'
};

const ESTILO_STATUS: Record<StatusCertificacao, { cor: string; fundo: string; icone: string }> = {
  OK: { cor: COR.verde, fundo: COR.verdeClaro, icone: '✓' },
  'A vencer': { cor: COR.ambar, fundo: COR.ambarClaro, icone: '⏳' },
  NOK: { cor: '#FFFFFF', fundo: COR.vermelho, icone: '!' },
  'Em andamento': { cor: COR.azulBotao, fundo: '#E8F2FF', icone: '↻' },
  'N/A': { cor: COR.sec, fundo: COR.cinzaClaro, icone: '–' }
};

const ESTILO_CRITICIDADE: Record<string, { cor: string; fundo: string }> = {
  Alta: { cor: COR.vermelho, fundo: COR.vermelhoClaro },
  Média: { cor: COR.ambar, fundo: COR.ambarClaro },
  Baixa: { cor: COR.verde, fundo: COR.verdeClaro }
};

const painel: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '16px 18px'
};

const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  fontSize: '13.5px',
  fontFamily: 'inherit',
  color: COR.texto,
  background: '#FFFFFF'
};

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: COR.azul,
  marginBottom: '4px'
};

const ajuda: React.CSSProperties = { fontSize: '12px', color: COR.sec, marginTop: '4px', lineHeight: 1.4 };

// Os botões definem tamanho e cor inline: o CSS do portal força
// ".content button" (11px, fundo azul) em todo botão.
const botao = (tipo: 'primario' | 'secundario' | 'perigo' | 'link' = 'primario'): React.CSSProperties => ({
  padding: tipo === 'link' ? '2px 4px' : '8px 14px',
  borderRadius: '8px',
  border: tipo === 'secundario' ? `1px solid ${COR.borda}` : tipo === 'perigo' ? `1px solid ${COR.vermelho}` : 0,
  background: tipo === 'primario' ? COR.azulBotao : tipo === 'link' ? 'transparent' : '#FFFFFF',
  color: tipo === 'primario' ? '#FFFFFF' : tipo === 'perigo' ? COR.vermelho : tipo === 'link' ? COR.azulBotao : COR.azul,
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit'
});

const th: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11.5px',
  fontWeight: 800,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.sec,
  background: COR.fundo,
  borderBottom: `1px solid ${COR.borda}`,
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '13.5px',
  color: COR.texto,
  borderBottom: `1px solid ${COR.borda}`,
  verticalAlign: 'middle'
};

const formatarData = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const Selo: React.FC<{ cor: string; fundo: string; children: React.ReactNode; titulo?: string }> = ({ cor, fundo, children, titulo }) => (
  <span title={titulo} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: cor, background: fundo, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

const SeloStatus: React.FC<{ status: StatusCertificacao; dias?: number }> = ({ status, dias }) => {
  const e = ESTILO_STATUS[status];
  const detalhe =
    status === 'NOK' && dias !== undefined ? ` · vencido há ${Math.abs(dias)}d`
      : status === 'A vencer' && dias !== undefined ? ` · ${dias}d`
        : '';
  return <Selo cor={e.cor} fundo={e.fundo}><span aria-hidden="true">{e.icone}</span>{status}{detalhe}</Selo>;
};

const SeloPessoa: React.FC<{ pessoa?: IPessoaRef }> = ({ pessoa }) =>
  pessoa && pessoa.tipo === 'terceiro'
    ? <Selo cor={COR.roxo} fundo={COR.roxoClaro}>Terceiro</Selo>
    : null;

const Aviso: React.FC<{ tipo: 'erro' | 'ok' | 'info'; children: React.ReactNode }> = ({ tipo, children }) => (
  <div role={tipo === 'erro' ? 'alert' : 'status'} style={{
    padding: '10px 14px', borderRadius: '10px', marginBottom: '12px', fontSize: '13.5px', lineHeight: 1.45,
    background: tipo === 'erro' ? COR.vermelhoClaro : tipo === 'ok' ? COR.verdeClaro : '#EEF2F7',
    color: tipo === 'erro' ? COR.vermelho : tipo === 'ok' ? COR.verde : COR.texto,
    border: `1px solid ${tipo === 'erro' ? '#F3B7B0' : tipo === 'ok' ? '#B7E0CC' : COR.borda}`
  }}>
    {children}
  </div>
);

const Modal: React.FC<{ titulo: string; subtitulo?: string; largura?: number; aoFechar: () => void; rodape: React.ReactNode; children: React.ReactNode }> =
  ({ titulo, subtitulo, largura = 640, aoFechar, rodape, children }) => {
    React.useEffect(() => {
      const tecla = (e: KeyboardEvent): void => { if (e.key === 'Escape') { aoFechar(); } };
      document.addEventListener('keydown', tecla);
      return () => document.removeEventListener('keydown', tecla);
    }, [aoFechar]);
    return ReactDOM.createPortal(
      <div role="dialog" aria-modal="true" aria-label={titulo} onClick={aoFechar}
        style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15, 23, 42, .45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto', fontFamily: '"Segoe UI", Arial, sans-serif' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '14px', width: '100%', maxWidth: `${largura}px`, boxShadow: '0 20px 50px rgba(15,23,42,.3)' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COR.borda}` }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: COR.azul }}>{titulo}</div>
            {subtitulo && <div style={{ ...ajuda, marginTop: '2px' }}>{subtitulo}</div>}
          </div>
          <div style={{ padding: '16px 20px' }}>{children}</div>
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${COR.borda}`, display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>{rodape}</div>
        </div>
      </div>,
      document.body
    );
  };

const Grade: React.FC<{ children: React.ReactNode; min?: number }> = ({ children, min = 200 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: '12px', marginBottom: '12px' }}>{children}</div>
);

const CampoArquivo: React.FC<{ arquivo?: File; aoMudar: (f?: File) => void; atualUrl?: string; obrigatorio?: boolean }> = ({ arquivo, aoMudar, atualUrl, obrigatorio }) => (
  <div style={{ marginBottom: '12px' }}>
    <label style={rotulo}>Documento {obrigatorio ? '' : '(opcional)'}</label>
    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e => aoMudar(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)} style={{ fontSize: '13px' }} />
    <div style={ajuda}>
      {arquivo ? `${arquivo.name} (${(arquivo.size / 1024 / 1024).toFixed(1)} MB)` : atualUrl ? 'Já há um documento anexado; escolha outro só para substituir.' : `PDF ou imagem, até ${TAMANHO_MAXIMO_ARQUIVO_MB} MB. Vai para a biblioteca Certificados do SharePoint.`}
    </div>
  </div>
);

// ------------------------------------------------------------
// Exportar CSV (abre no Excel)
// ------------------------------------------------------------

const baixarCsv = (nome: string, cabecalho: string[], linhas: string[][]): void => {
  const celula = (v: string): string => `"${(v || '').replace(/"/g, '""')}"`;
  const conteudo = [cabecalho, ...linhas].map(l => l.map(celula).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}-${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ------------------------------------------------------------
// Formulário: certificação
// ------------------------------------------------------------

const FormCertificacao: React.FC<{
  dados: IDadosFabricantes;
  item?: ICertificacao;
  pessoaInicial?: IPessoaRef;
  categoriaInicial?: CategoriaCertificacao;
  aoFechar: () => void;
  aoSalvar: (c: Parameters<RhFabricantesService['salvarCertificacao']>[0]) => Promise<void>;
  aoNovoTerceiro: () => void;
}> = ({ dados, item, pessoaInicial, categoriaInicial, aoFechar, aoSalvar, aoNovoTerceiro }) => {

  const pessoas: IPessoaRef[] = [
    ...dados.colaboradores,
    ...dados.terceiros.filter(t => t.ativo).map(t => ({ tipo: 'terceiro' as const, id: t.id, nome: t.nome, detalhe: t.empresa || 'Terceiro' }))
  ];

  const [categoria, setCategoria] = React.useState<CategoriaCertificacao>(item ? item.categoria : categoriaInicial || 'Certificação de fabricante');
  const [pessoaChave, setPessoaChave] = React.useState<string>(() => {
    const p = item ? item.pessoa : pessoaInicial;
    return p ? `${p.tipo}:${p.id}` : '';
  });
  const [emissor, setEmissor] = React.useState(item ? item.emissor : '');
  const [titulo, setTitulo] = React.useState(item ? item.titulo : '');
  const [criticidade, setCriticidade] = React.useState<Criticidade | ''>(item ? item.criticidade : 'Alta');
  const [area, setArea] = React.useState(item ? item.area : '');
  const [statusManual, setStatusManual] = React.useState<StatusManual>(item ? item.statusManual : '');
  const [emissao, setEmissao] = React.useState(item ? item.emissao : '');
  const [vencimento, setVencimento] = React.useState(item ? item.vencimento : '');
  const [numero, setNumero] = React.useState(item ? item.numero : '');
  const [observacoes, setObservacoes] = React.useState(item ? item.observacoes : '');
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const registro = categoria === 'Registro profissional';
  const pessoa = pessoas.filter(p => `${p.tipo}:${p.id}` === pessoaChave)[0];

  // Área sugerida: a do terceiro (cadastro) quando houver.
  React.useEffect(() => {
    if (!item && pessoa && pessoa.tipo === 'terceiro' && !area) {
      const t = dados.terceiros.filter(x => x.id === pessoa.id)[0];
      if (t && t.area) {
        setArea(t.area);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoaChave]);

  const salvar = async (): Promise<void> => {
    if (!pessoa) {
      setErro('Escolha o colaborador ou o terceiro.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({
        id: item ? item.id : undefined,
        categoria, pessoa, emissor, titulo, criticidade, area, statusManual, emissao, vencimento, numero, observacoes, arquivo,
        arquivoUrlAtual: item ? item.arquivoUrl : undefined
      });
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={item ? 'Alterar certificação' : 'Nova certificação'}
      subtitulo="Campos da planilha Controle de Certificações. O status sai da data de vencimento."
      largura={720}
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('primario')} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>
      )}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <div role="radiogroup" aria-label="Categoria" style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {CATEGORIAS.map(c => (
          <button key={c} type="button" role="radio" aria-checked={categoria === c} onClick={() => setCategoria(c)}
            style={{ ...botao(categoria === c ? 'primario' : 'secundario'), borderRadius: '999px' }}>
            {c === 'Registro profissional' ? 'Registro profissional (CREA/CFT)' : c}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="cert-pessoa">Colaborador ou terceiro</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select id="cert-pessoa" style={campo} value={pessoaChave} onChange={e => setPessoaChave(e.target.value)}>
            <option value="">Escolha…</option>
            <optgroup label="Colaboradores (com acesso ao portal)">
              {dados.colaboradores.map(p => <option key={p.id} value={`colaborador:${p.id}`}>{p.nome}{p.detalhe ? ` — ${p.detalhe}` : ''}</option>)}
            </optgroup>
            <optgroup label="Terceiros (sem acesso)">
              {pessoas.filter(p => p.tipo === 'terceiro').map(p => <option key={p.id} value={`terceiro:${p.id}`}>{p.nome} — {p.detalhe}</option>)}
            </optgroup>
          </select>
          <button type="button" style={botao('secundario')} onClick={aoNovoTerceiro} title="Cadastrar uma pessoa que não tem acesso ao portal">+ Terceiro</button>
        </div>
      </div>

      <Grade>
        <div>
          <label style={rotulo} htmlFor="cert-emissor">{registro ? 'Órgão' : 'Fabricante'}</label>
          <input id="cert-emissor" style={campo} list="lista-fabricantes" value={emissor} onChange={e => setEmissor(e.target.value)} placeholder={registro ? 'Ex.: CFT/RS, CREA-RS' : 'Ex.: Intelbras, Hikvision, Genetec'} />
          <datalist id="lista-fabricantes">
            {(registro ? ['CFT/RS', 'CREA-RS', 'CREA-SC', 'CREA-MT', 'CFT/SC'] : dados.fabricantes.map(f => f.nome)).map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <label style={rotulo} htmlFor="cert-titulo">{registro ? 'Título profissional' : 'Certificação'}</label>
          <input id="cert-titulo" style={campo} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={registro ? 'Ex.: Técnico em Eletrônica' : 'Ex.: INTELBRAS - DEFENSE IA'} />
        </div>
      </Grade>

      <Grade min={150}>
        <div>
          <label style={rotulo} htmlFor="cert-crit">Criticidade</label>
          <select id="cert-crit" style={campo} value={criticidade} onChange={e => setCriticidade(e.target.value as Criticidade | '')}>
            <option value="">—</option>
            {CRITICIDADES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={rotulo} htmlFor="cert-area">Área</label>
          <input id="cert-area" style={campo} list="lista-areas" value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: SUPORTE, LPI" />
          <datalist id="lista-areas">
            {['SUPORTE', 'SUPPLY', 'LPI', 'INTELIGÊNCIA', 'IMPLANTAÇÃO', 'PROJETOS', 'COMERCIAL'].map(a => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <label style={rotulo} htmlFor="cert-emissao">Emissão</label>
          <input id="cert-emissao" type="date" style={campo} value={emissao} onChange={e => setEmissao(e.target.value)} />
        </div>
        <div>
          <label style={rotulo} htmlFor="cert-venc">Vencimento</label>
          <input id="cert-venc" type="date" style={campo} value={vencimento} onChange={e => setVencimento(e.target.value)} />
        </div>
      </Grade>

      <Grade>
        <div>
          <label style={rotulo} htmlFor="cert-status">Status</label>
          <select id="cert-status" style={campo} value={statusManual} onChange={e => setStatusManual(e.target.value as StatusManual)}>
            {STATUS_MANUAIS.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          </select>
          <div style={ajuda}>Automático: OK, “A vencer” (até 30 dias) ou NOK (vencido).</div>
        </div>
        <div>
          <label style={rotulo} htmlFor="cert-numero">Nº do certificado / registro</label>
          <input id="cert-numero" style={campo} value={numero} onChange={e => setNumero(e.target.value)} placeholder="Opcional" />
        </div>
      </Grade>

      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="cert-obs">Observações</label>
        <textarea id="cert-obs" rows={2} style={{ ...campo, resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: Precisa renovar; não irá renovar…" />
      </div>

      <CampoArquivo arquivo={arquivo} aoMudar={setArquivo} atualUrl={item ? item.arquivoUrl : undefined} />
    </Modal>
  );
};

// ------------------------------------------------------------
// Formulário: terceiro
// ------------------------------------------------------------

const FormTerceiro: React.FC<{
  item?: ITerceiro;
  aoFechar: () => void;
  aoSalvar: (t: Omit<ITerceiro, 'id' | 'ativo'> & { id?: string }) => Promise<void>;
}> = ({ item, aoFechar, aoSalvar }) => {

  const [d, setD] = React.useState({
    nome: item ? item.nome : '',
    empresa: item ? item.empresa : '',
    area: item ? item.area : '',
    funcao: item ? item.funcao : '',
    email: item ? item.email : '',
    telefone: item ? item.telefone : '',
    observacoes: item ? item.observacoes : ''
  });
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const mudar = (parcial: Partial<typeof d>): void => setD(atual => ({ ...atual, ...parcial }));

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({ ...d, id: item ? item.id : undefined });
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={item ? 'Alterar terceiro' : 'Novo terceiro'}
      subtitulo="Pessoa sem acesso ao portal (prestador, parceiro). Não informe CPF nem documentos pessoais."
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('primario')} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar terceiro'}</button>
        </>
      )}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="ter-nome">Nome completo</label>
        <input id="ter-nome" style={campo} value={d.nome} onChange={e => mudar({ nome: e.target.value })} />
      </div>
      <Grade>
        <div>
          <label style={rotulo} htmlFor="ter-empresa">Empresa</label>
          <input id="ter-empresa" style={campo} value={d.empresa} onChange={e => mudar({ empresa: e.target.value })} placeholder="Razão social ou nome fantasia" />
        </div>
        <div>
          <label style={rotulo} htmlFor="ter-funcao">Função / cargo</label>
          <input id="ter-funcao" style={campo} value={d.funcao} onChange={e => mudar({ funcao: e.target.value })} placeholder="Ex.: Técnico de campo" />
        </div>
        <div>
          <label style={rotulo} htmlFor="ter-area">Área de atuação na DGT</label>
          <input id="ter-area" style={campo} value={d.area} onChange={e => mudar({ area: e.target.value })} placeholder="Ex.: SUPORTE, IMPLANTAÇÃO" />
        </div>
      </Grade>
      <Grade>
        <div>
          <label style={rotulo} htmlFor="ter-email">E-mail</label>
          <input id="ter-email" type="email" style={campo} value={d.email} onChange={e => mudar({ email: e.target.value })} placeholder="Opcional" />
        </div>
        <div>
          <label style={rotulo} htmlFor="ter-tel">Telefone</label>
          <input id="ter-tel" style={campo} value={d.telefone} onChange={e => mudar({ telefone: e.target.value })} placeholder="(51) 99999-0000" />
        </div>
      </Grade>
      <div>
        <label style={rotulo} htmlFor="ter-obs">Observações</label>
        <textarea id="ter-obs" rows={2} style={{ ...campo, resize: 'vertical' }} value={d.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------
// Formulário: fabricante
// ------------------------------------------------------------

const FormFabricante: React.FC<{
  item?: IFabricante;
  aoFechar: () => void;
  aoSalvar: (f: Omit<IFabricante, 'id'> & { id?: string }) => Promise<void>;
}> = ({ item, aoFechar, aoSalvar }) => {

  const [d, setD] = React.useState({
    nome: item ? item.nome : '',
    contatoNome: item ? item.contatoNome : '',
    contatoTelefone: item ? item.contatoTelefone : '',
    contatoEmail: item ? item.contatoEmail : '',
    site: item ? item.site : '',
    observacoes: item ? item.observacoes : ''
  });
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const mudar = (parcial: Partial<typeof d>): void => setD(atual => ({ ...atual, ...parcial }));

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({ ...d, id: item ? item.id : undefined });
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={item ? 'Alterar fabricante' : 'Novo fabricante'}
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('primario')} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar fabricante'}</button>
        </>
      )}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Grade>
        <div>
          <label style={rotulo} htmlFor="fab-nome">Fabricante</label>
          <input id="fab-nome" style={campo} value={d.nome} onChange={e => mudar({ nome: e.target.value })} placeholder="Ex.: Hikvision" />
        </div>
        <div>
          <label style={rotulo} htmlFor="fab-site">Site / portal de parceiros</label>
          <input id="fab-site" style={campo} value={d.site} onChange={e => mudar({ site: e.target.value })} placeholder="Opcional" />
        </div>
      </Grade>
      <Grade>
        <div>
          <label style={rotulo} htmlFor="fab-contato">Contato no fabricante</label>
          <input id="fab-contato" style={campo} value={d.contatoNome} onChange={e => mudar({ contatoNome: e.target.value })} placeholder="Nome(s)" />
        </div>
        <div>
          <label style={rotulo} htmlFor="fab-tel">Telefone</label>
          <input id="fab-tel" style={campo} value={d.contatoTelefone} onChange={e => mudar({ contatoTelefone: e.target.value })} placeholder="(51) 99999-0000" />
        </div>
      </Grade>
      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="fab-email">E-mail</label>
        <input id="fab-email" style={campo} value={d.contatoEmail} onChange={e => mudar({ contatoEmail: e.target.value })} />
      </div>
      <div>
        <label style={rotulo} htmlFor="fab-obs">Observações</label>
        <textarea id="fab-obs" rows={2} style={{ ...campo, resize: 'vertical' }} value={d.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
      </div>
    </Modal>
  );
};

// ------------------------------------------------------------
// Formulário: declaração
// ------------------------------------------------------------

const FormDeclaracao: React.FC<{
  dados: IDadosFabricantes;
  item?: IDeclaracao;
  aoFechar: () => void;
  aoSalvar: (d: Parameters<RhFabricantesService['salvarDeclaracao']>[0]) => Promise<void>;
}> = ({ dados, item, aoFechar, aoSalvar }) => {

  const [fabricante, setFabricante] = React.useState(item ? item.fabricante : '');
  const [tipo, setTipo] = React.useState(item ? item.tipo : TIPOS_DECLARACAO[0]);
  const [titulo, setTitulo] = React.useState(item ? item.titulo : '');
  const [emissao, setEmissao] = React.useState(item ? item.emissao : '');
  const [vencimento, setVencimento] = React.useState(item ? item.vencimento : '');
  const [observacoes, setObservacoes] = React.useState(item ? item.observacoes : '');
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const salvar = async (): Promise<void> => {
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({ id: item ? item.id : undefined, fabricante, tipo, titulo, emissao, vencimento, observacoes, arquivo });
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={item ? 'Alterar declaração' : 'Nova declaração do fabricante'}
      subtitulo="Carta ou declaração emitida pelo fabricante (parceria, revenda, credenciamento…), usada em propostas e licitações."
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('primario')} disabled={salvando} onClick={() => { salvar().catch(() => undefined); }}>{salvando ? 'Salvando…' : 'Salvar declaração'}</button>
        </>
      )}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <Grade>
        <div>
          <label style={rotulo} htmlFor="dec-fab">Fabricante</label>
          <input id="dec-fab" style={campo} list="lista-fab-dec" value={fabricante} onChange={e => setFabricante(e.target.value)} />
          <datalist id="lista-fab-dec">{dados.fabricantes.map(f => <option key={f.id} value={f.nome} />)}</datalist>
        </div>
        <div>
          <label style={rotulo} htmlFor="dec-tipo">Tipo</label>
          <select id="dec-tipo" style={campo} value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_DECLARACAO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </Grade>
      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="dec-titulo">Descrição</label>
        <input id="dec-titulo" style={campo} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Declaração de canal Gold 2026" />
      </div>
      <Grade>
        <div>
          <label style={rotulo} htmlFor="dec-emissao">Emissão</label>
          <input id="dec-emissao" type="date" style={campo} value={emissao} onChange={e => setEmissao(e.target.value)} />
        </div>
        <div>
          <label style={rotulo} htmlFor="dec-venc">Vencimento</label>
          <input id="dec-venc" type="date" style={campo} value={vencimento} onChange={e => setVencimento(e.target.value)} />
          <div style={ajuda}>Em branco = não vence.</div>
        </div>
      </Grade>
      <div style={{ marginBottom: '12px' }}>
        <label style={rotulo} htmlFor="dec-obs">Observações</label>
        <textarea id="dec-obs" rows={2} style={{ ...campo, resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
      </div>
      <CampoArquivo arquivo={arquivo} aoMudar={setArquivo} atualUrl={item ? item.arquivoUrl : undefined} obrigatorio={!item} />
    </Modal>
  );
};

// ------------------------------------------------------------
// Importar da planilha (colar)
// ------------------------------------------------------------

const ImportarModal: React.FC<{
  dados: IDadosFabricantes;
  aoFechar: () => void;
  aoImportar: (linhas: ILinhaImportada[], criarTerceiros: boolean) => Promise<string>;
}> = ({ dados, aoFechar, aoImportar }) => {

  const [texto, setTexto] = React.useState('');
  const [criarTerceiros, setCriarTerceiros] = React.useState(true);
  const [importando, setImportando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  const pessoas: IPessoaRef[] = [
    ...dados.colaboradores,
    ...dados.terceiros.map(t => ({ tipo: 'terceiro' as const, id: t.id, nome: t.nome, detalhe: t.empresa }))
  ];
  // Já cadastrada = mesma pessoa, certificação e vencimento: não duplica.
  const jaExiste = (l: ILinhaImportada): boolean =>
    !!l.pessoa && dados.certificacoes.some(c =>
      !!c.pessoa && c.pessoa.id === (l.pessoa as IPessoaRef).id &&
      normalizarNome(c.titulo) === normalizarNome(l.titulo) &&
      (c.vencimento || '') === (l.vencimento || ''));
  const linhas = (texto.trim() ? interpretarResumo(texto, pessoas) : [])
    .map(l => (!l.erro && jaExiste(l) ? { ...l, erro: 'Já cadastrada (não será duplicada).' } : l));
  const validas = linhas.filter(l => !l.erro);
  const semPessoa = validas.filter(l => !l.pessoa);
  const nomesNovos = semPessoa.map(l => normalizarNome(l.pessoaNome)).filter((n, i, lista) => lista.indexOf(n) === i);

  const importar = async (): Promise<void> => {
    setImportando(true);
    setErro('');
    try {
      await aoImportar(validas, criarTerceiros);
      aoFechar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
      setImportando(false);
    }
  };

  return (
    <Modal
      titulo="Importar da planilha"
      subtitulo="Na aba RESUMO, selecione as linhas da coluna Criticidade até Observações (B a J), copie e cole aqui."
      largura={860}
      aoFechar={aoFechar}
      rodape={(
        <>
          <button type="button" style={botao('secundario')} onClick={aoFechar}>Cancelar</button>
          <button type="button" style={botao('primario')} disabled={importando || validas.length === 0}
            onClick={() => { importar().catch(() => undefined); }}>
            {importando ? 'Importando…' : `Importar ${validas.length - (criarTerceiros ? 0 : semPessoa.length)} certificação(ões)`}
          </button>
        </>
      )}
    >
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <textarea aria-label="Linhas coladas" rows={7} value={texto} onChange={e => setTexto(e.target.value)}
        placeholder={'ALTA\tSUPORTE\tNOME DO COLABORADOR\tIntelbras\tINTELBRAS - DEFENSE IA\tOK\t12/11/2025\t12/11/2027\t'}
        style={{ ...campo, fontFamily: 'Consolas, monospace', fontSize: '12.5px' }} />
      <div style={ajuda}>O status é recalculado pela data de vencimento. Linhas com CPF, CNPJ, senha ou dado bancário são recusadas.</div>

      {linhas.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '12px 0' }}>
            <Selo cor={COR.verde} fundo={COR.verdeClaro}>{validas.length - semPessoa.length} com pessoa encontrada</Selo>
            {semPessoa.length > 0 && <Selo cor={COR.roxo} fundo={COR.roxoClaro}>{nomesNovos.length} pessoa(s) não encontrada(s)</Selo>}
            {linhas.length > validas.length && <Selo cor={COR.vermelho} fundo={COR.vermelhoClaro}>{linhas.length - validas.length} ignorada(s)</Selo>}
          </div>

          {semPessoa.length > 0 && (
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: COR.texto, marginBottom: '10px' }}>
              <input type="checkbox" checked={criarTerceiros} onChange={e => setCriarTerceiros(e.target.checked)} style={{ marginTop: '3px' }} />
              <span>
                Cadastrar como <strong>terceiro</strong> quem não foi encontrado entre os colaboradores: {nomesNovos.join(', ')}.
                <span style={{ display: 'block', ...ajuda }}>Se for colaborador da DGT, desmarque: ele precisa estar no cadastro de usuários (com o mesmo nome) antes de importar.</span>
              </span>
            </label>
          )}

          <div style={{ maxHeight: '300px', overflow: 'auto', border: `1px solid ${COR.borda}`, borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: 'none', borderRadius: 0 }}>
              <thead><tr>{['Linha', 'Pessoa', 'Fabricante', 'Certificação', 'Vencimento', 'Importação'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.linha}>
                    <td style={td}>{l.linha}</td>
                    <td style={td}>{l.pessoaNome} {l.pessoa ? (l.pessoa.tipo === 'terceiro' ? <Selo cor={COR.roxo} fundo={COR.roxoClaro}>Terceiro</Selo> : null) : <Selo cor={COR.roxo} fundo={COR.roxoClaro}>novo</Selo>}</td>
                    <td style={td}>{l.emissor}</td>
                    <td style={td}>{l.titulo}</td>
                    <td style={td}>{formatarData(l.vencimento)}</td>
                    <td style={{ ...td, color: l.erro ? (/Já cadastrada/.test(l.erro) ? COR.sec : COR.vermelho) : COR.verde, fontWeight: 600 }}>{l.erro || 'Pronta'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
};

// ------------------------------------------------------------
// Aba
// ------------------------------------------------------------

const FabricantesTerceirosAba: React.FC<IFabricantesTerceirosAbaProps> = ({ dataverseService, spHttpClient, siteUrl, usuarioNome }) => {

  const servico = React.useMemo(
    () => (dataverseService ? new RhFabricantesService(dataverseService, new RhCertificadosService(dataverseService, spHttpClient, siteUrl)) : undefined),
    [dataverseService, spHttpClient, siteUrl]);

  const [dados, setDados] = React.useState<IDadosFabricantes | undefined>(undefined);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');
  const [secao, setSecao] = React.useState<Secao>('certificacoes');

  const [busca, setBusca] = React.useState('');
  const [filtroStatus, setFiltroStatus] = React.useState<'' | StatusCertificacao>('');
  const [filtroCrit, setFiltroCrit] = React.useState<'' | Criticidade>('');
  const [filtroCategoria, setFiltroCategoria] = React.useState<'' | CategoriaCertificacao>('');
  const [filtroPessoa, setFiltroPessoa] = React.useState<'' | 'colaborador' | 'terceiro'>('');
  const [mostrarInativos, setMostrarInativos] = React.useState(false);

  const [formCert, setFormCert] = React.useState<{ item?: ICertificacao; pessoa?: IPessoaRef; categoria?: CategoriaCertificacao } | undefined>(undefined);
  const [formTerceiro, setFormTerceiro] = React.useState<{ item?: ITerceiro } | undefined>(undefined);
  const [formFabricante, setFormFabricante] = React.useState<{ item?: IFabricante } | undefined>(undefined);
  const [formDeclaracao, setFormDeclaracao] = React.useState<{ item?: IDeclaracao } | undefined>(undefined);
  const [importar, setImportar] = React.useState(false);
  const [terceiroAberto, setTerceiroAberto] = React.useState<string>('');

  const responsavel = usuarioNome || 'RH';

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setErro('Serviço do Dataverse indisponível.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setDados(await servico.carregar());
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [servico]);

  React.useEffect(() => { carregar().catch(() => undefined); }, [carregar]);

  const avisar = (texto: string): void => {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 5000);
  };

  const executar = async (acao: () => Promise<void>, ok: string): Promise<void> => {
    await acao();
    await carregar();
    avisar(ok);
  };

  if (carregando && !dados) {
    return <p style={{ fontSize: '13.5px', color: COR.sec }}>Carregando fabricantes, terceiros e certificações…</p>;
  }

  if (erro && !dados) {
    return <Aviso tipo="erro">Não foi possível carregar: {erro} <button type="button" style={botao('link')} onClick={() => { carregar().catch(() => undefined); }}>Tentar de novo</button></Aviso>;
  }

  if (!dados || !servico) {
    return null;
  }

  if (!dados.disponivel) {
    return (
      <Aviso tipo="info">
        As tabelas desta aba ainda não foram criadas no Dataverse. Peça ao administrador para rodar
        <strong> scripts/dataverse/criar-tabelas-fabricantes-terceiros.ps1</strong> e dar permissão de Criar, Ler e Gravar ao RH.
      </Aviso>
    );
  }

  // ---------------- certificações filtradas ----------------

  const termo = normalizarNome(busca);
  const certificacoes = dados.certificacoes
    .filter(c => !filtroStatus || c.status === filtroStatus)
    .filter(c => !filtroCrit || c.criticidade === filtroCrit)
    .filter(c => !filtroCategoria || c.categoria === filtroCategoria)
    .filter(c => !filtroPessoa || (c.pessoa ? c.pessoa.tipo : 'colaborador') === filtroPessoa)
    .filter(c => !termo || normalizarNome(`${c.pessoaNome} ${c.emissor} ${c.titulo} ${c.area} ${c.observacoes}`).indexOf(termo) >= 0)
    .sort((a, b) =>
      STATUS_CERTIFICACAO.indexOf(a.status) - STATUS_CERTIFICACAO.indexOf(b.status) ||
      CRITICIDADES.indexOf(a.criticidade as Criticidade) - CRITICIDADES.indexOf(b.criticidade as Criticidade) ||
      (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));

  // Capa da planilha: criticidade × status.
  const contagem = (crit: Criticidade | '', status: StatusCertificacao): number =>
    dados.certificacoes.filter(c => c.categoria === 'Certificação de fabricante' && (c.criticidade || '') === crit && c.status === status).length;
  const linhasCapa: Array<Criticidade | ''> = [...CRITICIDADES, ...(dados.certificacoes.some(c => c.categoria === 'Certificação de fabricante' && !c.criticidade) ? [''] as Array<Criticidade | ''> : [])];

  const salvarCertificacao = (c: Parameters<RhFabricantesService['salvarCertificacao']>[0]): Promise<void> =>
    executar(() => servico.salvarCertificacao(c, responsavel), 'Certificação salva.');

  const exportar = (): void => baixarCsv(
    'certificacoes-fabricantes',
    ['Criticidade', 'Área', 'Pessoa', 'Vínculo', 'Categoria', 'Fabricante / órgão', 'Certificação', 'Status', 'Emissão', 'Vencimento', 'Nº', 'Observações', 'Documento'],
    certificacoes.map(c => [
      c.criticidade, c.area, c.pessoaNome, c.pessoa && c.pessoa.tipo === 'terceiro' ? 'Terceiro' : 'Colaborador',
      c.categoria, c.emissor, c.titulo, c.status, formatarData(c.emissao), formatarData(c.vencimento), c.numero, c.observacoes, c.arquivoUrl
    ]));

  const importarLinhas = async (linhas: ILinhaImportada[], criarTerceiros: boolean): Promise<string> => {
    const criados: Record<string, IPessoaRef> = {};
    let total = 0;
    for (const l of linhas) {
      let pessoa = l.pessoa;
      if (!pessoa) {
        if (!criarTerceiros) {
          continue;
        }
        const chave = normalizarNome(l.pessoaNome);
        if (!criados[chave]) {
          const id = await servico.salvarTerceiro({ nome: l.pessoaNome, empresa: '', area: l.area, funcao: '', email: '', telefone: '', observacoes: 'Cadastrado na importação da planilha Controle de Certificações.' }, responsavel);
          criados[chave] = { tipo: 'terceiro', id, nome: l.pessoaNome, detalhe: 'Terceiro' };
        }
        pessoa = criados[chave];
      }
      await servico.salvarCertificacao({
        categoria: 'Certificação de fabricante',
        pessoa,
        emissor: l.emissor,
        titulo: l.titulo,
        criticidade: l.criticidade,
        area: l.area,
        statusManual: /andamento/i.test(l.statusPlanilha) ? 'Em andamento' : /^n\/?a$/i.test(l.statusPlanilha) ? 'N/A' : '',
        emissao: l.emissao,
        vencimento: l.vencimento,
        numero: '',
        observacoes: l.observacoes
      }, responsavel);
      total++;
    }
    await carregar();
    const texto = `${total} certificação(ões) importada(s)${Object.keys(criados).length ? `, ${Object.keys(criados).length} terceiro(s) cadastrado(s)` : ''}.`;
    avisar(texto);
    return texto;
  };

  // ---------------- render das seções ----------------

  const filtroSelect = (valor: string, aoMudar: (v: string) => void, opcoes: Array<[string, string]>, nome: string): React.ReactElement => (
    <select aria-label={nome} value={valor} onChange={e => aoMudar(e.target.value)} style={{ ...campo, width: 'auto', minWidth: '150px' }}>
      {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );

  const secaoCertificacoes = (
    <>
      <div style={{ ...painel, marginBottom: '14px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: COR.azul }}>Resumo das certificações de fabricante</h3>
          <span style={{ fontSize: '12.5px', color: COR.sec }}>Clique em um número para filtrar a lista.</span>
        </div>
        <table style={{ borderCollapse: 'collapse', minWidth: '560px', width: '100%', boxShadow: 'none', borderRadius: 0 }}>
          <thead>
            <tr>
              <th style={th}>Criticidade</th>
              {STATUS_CERTIFICACAO.map(s => <th key={s} style={{ ...th, textAlign: 'center' }}>{s}</th>)}
              <th style={{ ...th, textAlign: 'center' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {linhasCapa.map(crit => {
              const total = STATUS_CERTIFICACAO.reduce((s, st) => s + contagem(crit, st), 0);
              return (
                <tr key={crit || 'sem'}>
                  <td style={td}>{crit ? <Selo cor={ESTILO_CRITICIDADE[crit].cor} fundo={ESTILO_CRITICIDADE[crit].fundo}>{crit}</Selo> : <span style={{ color: COR.sec }}>Sem criticidade</span>}</td>
                  {STATUS_CERTIFICACAO.map(st => {
                    const n = contagem(crit, st);
                    return (
                      <td key={st} style={{ ...td, textAlign: 'center' }}>
                        {n > 0
                          ? <button type="button" style={{ ...botao('link'), fontSize: '15px', color: ESTILO_STATUS[st].cor === '#FFFFFF' ? COR.vermelho : ESTILO_STATUS[st].cor }}
                            onClick={() => { setFiltroCrit(crit as Criticidade); setFiltroStatus(st); setFiltroCategoria('Certificação de fabricante'); }}>
                            {n} <span style={{ fontSize: '11.5px', color: COR.sec, fontWeight: 600 }}>({Math.round(n / Math.max(1, total) * 100)}%)</span>
                          </button>
                          : <span style={{ color: '#CBD5E1' }}>0</span>}
                      </td>
                    );
                  })}
                  <td style={{ ...td, textAlign: 'center', fontWeight: 800 }}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ ...painel, padding: '12px 14px', marginBottom: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Buscar" style={{ ...campo, flex: '1 1 240px', width: 'auto' }} placeholder="Buscar por pessoa, fabricante, certificação ou área…" value={busca} onChange={e => setBusca(e.target.value)} />
        {filtroSelect(filtroStatus, v => setFiltroStatus(v as StatusCertificacao | ''), [['', 'Todos os status'], ...STATUS_CERTIFICACAO.map(s => [s, s] as [string, string])], 'Status')}
        {filtroSelect(filtroCrit, v => setFiltroCrit(v as Criticidade | ''), [['', 'Toda criticidade'], ...CRITICIDADES.map(c => [c, c] as [string, string])], 'Criticidade')}
        {filtroSelect(filtroCategoria, v => setFiltroCategoria(v as CategoriaCertificacao | ''), [['', 'Fabricante e registros'], ['Certificação de fabricante', 'Só fabricantes'], ['Registro profissional', 'Só CREA/CFT']], 'Categoria')}
        {filtroSelect(filtroPessoa, v => setFiltroPessoa(v as '' | 'colaborador' | 'terceiro'), [['', 'Colaboradores e terceiros'], ['colaborador', 'Só colaboradores'], ['terceiro', 'Só terceiros']], 'Vínculo')}
        {(busca || filtroStatus || filtroCrit || filtroCategoria || filtroPessoa) && (
          <button type="button" style={botao('link')} onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroCrit(''); setFiltroCategoria(''); setFiltroPessoa(''); }}>Limpar filtros</button>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={botao('secundario')} onClick={() => setImportar(true)}>Importar da planilha</button>
          <button type="button" style={botao('secundario')} onClick={exportar}>↓ Exportar (Excel)</button>
          <button type="button" style={botao('primario')} onClick={() => setFormCert({})}>+ Nova certificação</button>
        </span>
      </div>

      <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px', boxShadow: 'none', borderRadius: 0 }}>
          <thead>
            <tr>{['Criticidade', 'Área', 'Pessoa', 'Fabricante / órgão', 'Certificação', 'Status', 'Emissão', 'Vencimento', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {certificacoes.length === 0 && (
              <tr><td colSpan={9} style={{ ...td, textAlign: 'center', padding: '28px', color: COR.sec }}>
                {dados.certificacoes.length === 0 ? 'Nenhuma certificação cadastrada. Use “Importar da planilha” ou “+ Nova certificação”.' : 'Nenhuma certificação com esses filtros.'}
              </td></tr>
            )}
            {certificacoes.map(c => (
              <tr key={c.id} style={{ background: c.status === 'NOK' ? '#FFF8F7' : '#FFFFFF' }}>
                <td style={td}>{c.criticidade ? <Selo cor={ESTILO_CRITICIDADE[c.criticidade].cor} fundo={ESTILO_CRITICIDADE[c.criticidade].fundo}>{c.criticidade}</Selo> : '—'}</td>
                <td style={td}>{c.area || '—'}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: COR.azul }}>{c.pessoaNome}</div>
                  <SeloPessoa pessoa={c.pessoa} />
                </td>
                <td style={td}>{c.emissor}</td>
                <td style={td}>
                  <div>{c.titulo}</div>
                  {c.categoria === 'Registro profissional' && <span style={{ fontSize: '12px', color: COR.sec }}>Registro profissional{c.numero ? ` · nº ${c.numero}` : ''}</span>}
                  {c.observacoes && <div style={{ fontSize: '12px', color: COR.sec, marginTop: '2px' }}>{c.observacoes}</div>}
                </td>
                <td style={td}><SeloStatus status={c.status} dias={c.diasParaVencer} /></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatarData(c.emissao)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: c.status === 'NOK' ? COR.vermelho : COR.texto, fontWeight: c.status === 'NOK' ? 700 : 400 }}>{c.vencimento ? formatarData(c.vencimento) : 'Não vence'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {c.arquivoUrl && <a href={c.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 700, color: COR.azulBotao, marginRight: '8px' }}>📄 Documento</a>}
                  <button type="button" style={botao('link')} onClick={() => setFormCert({ item: c })}>Alterar</button>
                  <button type="button" style={{ ...botao('link'), color: COR.vermelho }} onClick={() => {
                    if (window.confirm(`Remover "${c.titulo}" de ${c.pessoaNome}? O registro fica no histórico.`)) {
                      executar(() => servico.removerCertificacao(c.id), 'Certificação removida da lista.').catch(e => setErro(String((e as Error).message || e)));
                    }
                  }}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const secaoDeclaracoes = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13.5px', color: COR.sec }}>Cartas e declarações dos fabricantes, com o documento e o vencimento.</span>
        <button type="button" style={botao('primario')} onClick={() => setFormDeclaracao({})}>+ Nova declaração</button>
      </div>
      {dados.declaracoes.length === 0
        ? <div style={{ ...painel, color: COR.sec, fontSize: '13.5px' }}>Nenhuma declaração cadastrada.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {dados.declaracoes
              .slice()
              .sort((a, b) => STATUS_CERTIFICACAO.indexOf(a.status) - STATUS_CERTIFICACAO.indexOf(b.status) || a.fabricante.localeCompare(b.fabricante))
              .map(d => (
                <div key={d.id} style={{ ...painel, borderTop: `4px solid ${d.status === 'NOK' ? COR.vermelho : d.status === 'A vencer' ? COR.ambar : COR.verde}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: COR.azul }}>{d.fabricante}</strong>
                    <SeloStatus status={d.status} dias={d.diasParaVencer} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: COR.sec }}>{d.tipo}</span>
                  <span style={{ fontSize: '14px', color: COR.texto }}>{d.titulo}</span>
                  <span style={{ fontSize: '12.5px', color: COR.texto }}>Emissão <strong>{formatarData(d.emissao)}</strong> · Vencimento <strong>{d.vencimento ? formatarData(d.vencimento) : 'não vence'}</strong></span>
                  {d.observacoes && <span style={{ fontSize: '12.5px', color: COR.sec }}>{d.observacoes}</span>}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '6px', flexWrap: 'wrap' }}>
                    {d.arquivoUrl && <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 700, color: COR.azulBotao }}>📄 Abrir declaração ↗</a>}
                    <span style={{ marginLeft: 'auto' }} />
                    <button type="button" style={botao('link')} onClick={() => setFormDeclaracao({ item: d })}>Alterar</button>
                    <button type="button" style={{ ...botao('link'), color: COR.vermelho }} onClick={() => {
                      if (window.confirm('Remover esta declaração da lista? O registro fica no histórico.')) {
                        executar(() => servico.removerDeclaracao(d.id), 'Declaração removida da lista.').catch(e => setErro(String((e as Error).message || e)));
                      }
                    }}>Remover</button>
                  </div>
                </div>
              ))}
          </div>
        )}
    </>
  );

  const terceirosVisiveis = dados.terceiros
    .filter(t => mostrarInativos || t.ativo)
    .filter(t => !termo || normalizarNome(`${t.nome} ${t.empresa} ${t.area} ${t.funcao}`).indexOf(termo) >= 0);

  const secaoTerceiros = (
    <>
      <div style={{ ...painel, padding: '12px 14px', marginBottom: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="Buscar terceiro" style={{ ...campo, flex: '1 1 240px', width: 'auto' }} placeholder="Buscar por nome, empresa, área ou função…" value={busca} onChange={e => setBusca(e.target.value)} />
        <label style={{ fontSize: '13px', color: COR.texto, display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)} /> Mostrar desativados
        </label>
        <button type="button" style={{ ...botao('primario'), marginLeft: 'auto' }} onClick={() => setFormTerceiro({})}>+ Novo terceiro</button>
      </div>
      <Aviso tipo="info">Terceiros não têm acesso ao portal: o RH cadastra a pessoa e as certificações dela aqui.</Aviso>
      {terceirosVisiveis.length === 0
        ? <div style={{ ...painel, color: COR.sec, fontSize: '13.5px' }}>Nenhum terceiro cadastrado.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {terceirosVisiveis.map(t => {
              const certs = dados.certificacoes.filter(c => c.pessoa && c.pessoa.tipo === 'terceiro' && c.pessoa.id === t.id);
              const pior = STATUS_CERTIFICACAO.filter(s => certs.some(c => c.status === s))[0];
              const aberto = terceiroAberto === t.id;
              return (
                <div key={t.id} style={{ ...painel, opacity: t.ativo ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span aria-hidden="true" style={{ width: '40px', height: '40px', borderRadius: '50%', background: COR.roxoClaro, color: COR.roxo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px' }}>
                      {t.nome.split(/\s+/).filter(Boolean).map(p => p.charAt(0)).filter((_, i, l) => i === 0 || i === l.length - 1).join('').toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: COR.azul }}>{t.nome} {!t.ativo && <Selo cor={COR.sec} fundo={COR.cinzaClaro}>Desativado</Selo>}</div>
                      <div style={{ fontSize: '12.5px', color: COR.sec }}>
                        {[t.funcao, t.empresa, t.area].filter(Boolean).join(' · ') || 'Sem empresa/função informadas'}
                        {(t.email || t.telefone) && <> · {[t.email, t.telefone].filter(Boolean).join(' · ')}</>}
                      </div>
                    </div>
                    {pior ? <SeloStatus status={pior} /> : <Selo cor={COR.sec} fundo={COR.cinzaClaro}>Sem certificações</Selo>}
                    <button type="button" style={botao('secundario')} onClick={() => setTerceiroAberto(aberto ? '' : t.id)}>{aberto ? 'Fechar' : `Certificações (${certs.length})`}</button>
                    <button type="button" style={botao('link')} onClick={() => setFormTerceiro({ item: t })}>Alterar</button>
                    <button type="button" style={{ ...botao('link'), color: t.ativo ? COR.vermelho : COR.verde }} onClick={() => {
                      if (!t.ativo || window.confirm(`Desativar ${t.nome}? Ele sai das listas, mas o histórico fica.`)) {
                        executar(() => servico.definirTerceiroAtivo(t.id, !t.ativo), t.ativo ? 'Terceiro desativado.' : 'Terceiro reativado.').catch(e => setErro(String((e as Error).message || e)));
                      }
                    }}>{t.ativo ? 'Desativar' : 'Reativar'}</button>
                  </div>
                  {aberto && (
                    <div style={{ marginTop: '12px', borderTop: `1px solid ${COR.borda}`, paddingTop: '10px' }}>
                      {certs.length === 0 && <p style={{ fontSize: '13px', color: COR.sec, margin: '0 0 8px' }}>Nenhuma certificação cadastrada.</p>}
                      {certs.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${COR.fundo}`, flexWrap: 'wrap', fontSize: '13.5px' }}>
                          <SeloStatus status={c.status} dias={c.diasParaVencer} />
                          <span style={{ flex: 1, minWidth: '200px' }}><strong>{c.emissor}</strong> — {c.titulo}</span>
                          <span style={{ color: COR.sec }}>vence {c.vencimento ? formatarData(c.vencimento) : '—'}</span>
                          {c.arquivoUrl && <a href={c.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: COR.azulBotao }}>📄</a>}
                          <button type="button" style={botao('link')} onClick={() => setFormCert({ item: c })}>Alterar</button>
                        </div>
                      ))}
                      {t.ativo && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                          <button type="button" style={botao('primario')} onClick={() => setFormCert({ pessoa: { tipo: 'terceiro', id: t.id, nome: t.nome, detalhe: t.empresa }, categoria: 'Certificação de fabricante' })}>+ Certificação de fabricante</button>
                          <button type="button" style={botao('secundario')} onClick={() => setFormCert({ pessoa: { tipo: 'terceiro', id: t.id, nome: t.nome, detalhe: t.empresa }, categoria: 'Registro profissional' })}>+ Registro CREA/CFT</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );

  const secaoFabricantes = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13.5px', color: COR.sec }}>Fabricantes e o contato de cada um. Os nomes aparecem como sugestão nas certificações e declarações.</span>
        <button type="button" style={botao('primario')} onClick={() => setFormFabricante({})}>+ Novo fabricante</button>
      </div>
      <div style={{ ...painel, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px', boxShadow: 'none', borderRadius: 0 }}>
          <thead><tr>{['Fabricante', 'Contato', 'Telefone', 'E-mail', 'Certificações', 'Declarações', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {dados.fabricantes.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '28px', color: COR.sec }}>Nenhum fabricante cadastrado.</td></tr>}
            {dados.fabricantes.map(f => {
              const nome = normalizarNome(f.nome);
              const nCert = dados.certificacoes.filter(c => normalizarNome(c.emissor) === nome || normalizarNome(c.titulo).indexOf(nome) === 0).length;
              const nDec = dados.declaracoes.filter(d => normalizarNome(d.fabricante) === nome).length;
              return (
                <tr key={f.id}>
                  <td style={{ ...td, fontWeight: 700, color: COR.azul }}>{f.nome}{f.site && <div style={{ fontSize: '12px', fontWeight: 400 }}><a href={/^https?:/i.test(f.site) ? f.site : `https://${f.site}`} target="_blank" rel="noopener noreferrer" style={{ color: COR.azulBotao }}>{f.site}</a></div>}</td>
                  <td style={td}>{f.contatoNome || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{f.contatoTelefone || '—'}</td>
                  <td style={{ ...td, overflowWrap: 'anywhere' }}>{f.contatoEmail || '—'}</td>
                  <td style={td}>{nCert}</td>
                  <td style={td}>{nDec}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button type="button" style={botao('link')} onClick={() => setFormFabricante({ item: f })}>Alterar</button>
                    <button type="button" style={{ ...botao('link'), color: COR.vermelho }} onClick={() => {
                      if (window.confirm(`Remover ${f.nome} da lista de fabricantes?`)) {
                        executar(() => servico.removerFabricante(f.id), 'Fabricante removido da lista.').catch(e => setErro(String((e as Error).message || e)));
                      }
                    }}>Remover</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  // Indicadores do topo.
  const nNok = dados.certificacoes.filter(c => c.status === 'NOK').length + dados.declaracoes.filter(d => d.status === 'NOK').length;
  const nVencer = dados.certificacoes.filter(c => c.status === 'A vencer').length + dados.declaracoes.filter(d => d.status === 'A vencer').length;
  const indicadores: Array<{ valor: number; rotulo: string; cor: string; acao: () => void }> = [
    { valor: dados.certificacoes.length, rotulo: 'Certificações', cor: COR.azulBotao, acao: () => { setSecao('certificacoes'); setFiltroStatus(''); } },
    { valor: nNok, rotulo: 'Vencidas (NOK)', cor: COR.vermelho, acao: () => { setSecao('certificacoes'); setFiltroStatus('NOK'); } },
    { valor: nVencer, rotulo: 'A vencer (30 dias)', cor: COR.ambar, acao: () => { setSecao('certificacoes'); setFiltroStatus('A vencer'); } },
    { valor: dados.declaracoes.length, rotulo: 'Declarações', cor: COR.verde, acao: () => setSecao('declaracoes') },
    { valor: dados.terceiros.filter(t => t.ativo).length, rotulo: 'Terceiros ativos', cor: COR.roxo, acao: () => setSecao('terceiros') }
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        {indicadores.map(i => (
          <button key={i.rotulo} type="button" onClick={i.acao}
            style={{ textAlign: 'left', background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderTop: `4px solid ${i.cor}`, borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ display: 'block', fontSize: '12.5px', color: COR.sec, fontWeight: 600 }}>{i.rotulo}</span>
            <span style={{ display: 'block', fontSize: '26px', fontWeight: 800, color: i.cor }}>{i.valor}</span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Seções" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {SECOES.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={secao === s.id} onClick={() => { setSecao(s.id); setBusca(''); }}
            style={{ ...botao(secao === s.id ? 'primario' : 'secundario'), borderRadius: '999px', background: secao === s.id ? COR.azul : '#FFFFFF' }}>
            {s.rotulo}
          </button>
        ))}
      </div>

      {mensagem && <Aviso tipo="ok">{mensagem}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {secao === 'certificacoes' && secaoCertificacoes}
      {secao === 'declaracoes' && secaoDeclaracoes}
      {secao === 'terceiros' && secaoTerceiros}
      {secao === 'fabricantes' && secaoFabricantes}

      {formCert && (
        <FormCertificacao
          dados={dados}
          item={formCert.item}
          pessoaInicial={formCert.pessoa}
          categoriaInicial={formCert.categoria}
          aoFechar={() => setFormCert(undefined)}
          aoSalvar={salvarCertificacao}
          aoNovoTerceiro={() => setFormTerceiro({})}
        />
      )}
      {formTerceiro && (
        <FormTerceiro
          item={formTerceiro.item}
          aoFechar={() => setFormTerceiro(undefined)}
          aoSalvar={t => executar(async () => { await servico.salvarTerceiro(t, responsavel); }, t.id ? 'Terceiro atualizado.' : 'Terceiro cadastrado. Agora ele aparece na escolha de pessoa das certificações.')}
        />
      )}
      {formFabricante && (
        <FormFabricante
          item={formFabricante.item}
          aoFechar={() => setFormFabricante(undefined)}
          aoSalvar={f => executar(async () => { await servico.salvarFabricante(f); }, 'Fabricante salvo.')}
        />
      )}
      {formDeclaracao && (
        <FormDeclaracao
          dados={dados}
          item={formDeclaracao.item}
          aoFechar={() => setFormDeclaracao(undefined)}
          aoSalvar={d => executar(() => servico.salvarDeclaracao(d, responsavel), 'Declaração salva.')}
        />
      )}
      {importar && (
        <ImportarModal
          dados={dados}
          aoFechar={() => setImportar(false)}
          aoImportar={importarLinhas}
        />
      )}
    </div>
  );
};

export default FabricantesTerceirosAba;
