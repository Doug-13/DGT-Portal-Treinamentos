import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DIAS_AVISO_VENCIMENTO,
  ICertificadoRh,
  IColaboradorRh,
  RhCertificadosService,
  SituacaoCertificadoRh,
  StatusColaboradorRh,
  TAMANHO_MAXIMO_ARQUIVO_MB,
  TIPOS_CERTIFICADO_EXTERNO
} from '../../services/RhCertificadosService';

import {
  detectarDadoSensivel
} from '../../services/LicitacaoParecerService';

import EstruturaAreaAba from './EstruturaAreaAba';

// ============================================================
// RH E PESSOAS
//
// Aba ESTRUTURA POR ÁREA: cargo de cada pessoa em cada área
//   (Coordenador, Gestor, Gerente, Head, Diretor), usado pelos fluxos
//   de aprovação. Ver EstruturaAreaAba.tsx.
//
// Aba CERTIFICADOS:
//   • a tela lista só os COLABORADORES (cards coloridos), com um
//     status: "Verificar certificados" (algum vencido), "Vencimento
//     próximo" (até 30 dias), "Em dia" ou "Sem certificados";
//   • clicar no colaborador abre todos os certificados dele —
//     da plataforma e EXTERNOS (ensino superior, cursos, NRs...);
//   • o RH cadastra certificados externos com o documento anexado.
// ============================================================

export interface IRhPessoasPageProps {
  dataverseService?: DataverseService;
  spHttpClient?: SPHttpClient;
  siteUrl?: string;
  // Quem registra os certificados externos (auditoria).
  usuarioNome?: string;
}

type Aba = 'certificados' | 'estrutura';

const ABAS: Array<{ id: Aba; rotulo: string }> = [
  { id: 'certificados', rotulo: 'Certificados' },
  // Hierarquia por área (cargos) usada pelos fluxos de aprovação.
  { id: 'estrutura', rotulo: 'Estrutura por área' }
];

type FiltroStatus = 'todos' | StatusColaboradorRh;

// Quem precisa de atenção aparece primeiro.
const ORDEM: Record<StatusColaboradorRh, number> = { verificar: 0, atencao: 1, emDia: 2, semCertificado: 3 };

// ------------------------------------------------------------
// Cores
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
  ciano: '#0891B2',
  cianoClaro: '#E0F5FA',
  indigo: '#485CC7',
  indigoClaro: '#EEF0FB',
  cinza: '#94A3B8'
};

const STATUS: Record<StatusColaboradorRh, { rotulo: string; icone: string; cor: string; fundo: string }> = {
  verificar: { rotulo: 'Verificar certificados', icone: '!', cor: COR.vermelho, fundo: COR.vermelhoClaro },
  atencao: { rotulo: 'Vencimento próximo', icone: '⏳', cor: COR.ambar, fundo: COR.ambarClaro },
  emDia: { rotulo: 'Em dia', icone: '✓', cor: COR.verde, fundo: COR.verdeClaro },
  semCertificado: { rotulo: 'Sem certificados', icone: '○', cor: COR.sec, fundo: '#F1F5F9' }
};

const CORES_AVATAR = [COR.azulBotao, COR.verde, COR.roxo, COR.ciano, COR.indigo, '#C2410C', '#0F766E', '#BE185D'];

const corDoNome = (nome: string): string => {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) {
    soma = (soma + nome.charCodeAt(i) * (i + 1)) % 9973;
  }
  return CORES_AVATAR[soma % CORES_AVATAR.length];
};

const iniciais = (nome: string): string =>
  nome
    .split(/\s+/)
    .filter(p => p.length > 2 || /^[A-ZÀ-Ú]/.test(p))
    .filter((p, i, lista) => i === 0 || i === lista.length - 1)
    .map(p => p.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2) || '?';

const formatarData = (iso: string): string => {
  if (!iso) {
    return '—';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
};

const botao = (tipo: 'primario' | 'secundario' | 'perigo'): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: '8px',
  border: tipo === 'secundario' ? `1px solid ${COR.borda}` : tipo === 'perigo' ? `1px solid ${COR.vermelho}` : 0,
  background: tipo === 'primario' ? COR.azulBotao : '#FFFFFF',
  color: tipo === 'primario' ? '#FFFFFF' : tipo === 'perigo' ? COR.vermelho : COR.azul,
  fontSize: '12.5px',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
});

const campo: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  fontSize: '13px',
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

// ------------------------------------------------------------
// Pequenos componentes
// ------------------------------------------------------------

// Foto do Microsoft 365 (mesma fonte da foto do topo do portal:
// /_layouts/15/userphoto.aspx). Enquanto carrega — ou se a pessoa
// não tiver foto — aparecem as iniciais coloridas.
const Avatar: React.FC<{
  nome: string;
  email?: string;
  siteUrl?: string;
  tamanho?: number;
}> = ({ nome, email, siteUrl, tamanho = 42 }) => {

  const [foto, setFoto] = React.useState<'carregando' | 'ok' | 'sem'>('carregando');

  const url =
    email && siteUrl
      ? `${siteUrl.replace(/\/+$/, '')}/_layouts/15/userphoto.aspx?size=${tamanho > 48 ? 'L' : 'M'}&accountname=${encodeURIComponent(email)}`
      : '';

  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        flexShrink: 0,
        width: tamanho,
        height: tamanho,
        borderRadius: '50%',
        overflow: 'hidden',
        background: corDoNome(nome),
        color: '#FFFFFF',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: Math.round(tamanho * 0.38),
        letterSpacing: '.02em',
        boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 3px ${corDoNome(nome)}40`
      }}
    >
      {foto !== 'ok' && iniciais(nome)}

      {url && foto !== 'sem' && (
        <img
          src={url}
          alt=""
          loading="lazy"
          onLoad={evento => {
            const img = evento.currentTarget;
            // Sem foto, o SharePoint devolve a silhueta padrão
            // (PersonPlaceholder): nesse caso ficam as iniciais.
            const padrao =
              /placeholder/i.test(img.currentSrc || img.src) ||
              img.naturalWidth < 8;
            setFoto(padrao ? 'sem' : 'ok');
          }}
          onError={() => setFoto('sem')}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: foto === 'ok' ? 1 : 0,
            transition: 'opacity .2s ease'
          }}
        />
      )}
    </span>
  );
};

const SeloStatus: React.FC<{ status: StatusColaboradorRh }> = ({ status }) => {
  const s = STATUS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 700,
        color: status === 'verificar' ? '#FFFFFF' : s.cor,
        background: status === 'verificar' ? COR.vermelho : s.fundo,
        whiteSpace: 'nowrap'
      }}
    >
      <span aria-hidden="true">{s.icone}</span>
      {s.rotulo}
    </span>
  );
};

const SeloSituacao: React.FC<{ item: ICertificadoRh }> = ({ item }) => {

  const dias = Math.abs(item.diasParaVencer || 0);

  const mapa: Record<SituacaoCertificadoRh, { texto: string; cor: string; fundo: string }> = {
    valido: { texto: '✓ Válido', cor: COR.verde, fundo: COR.verdeClaro },
    semValidade: { texto: '✓ Sem vencimento', cor: COR.verde, fundo: COR.verdeClaro },
    vencendo: {
      texto: item.diasParaVencer === 0 ? '⏳ Vence hoje' : `⏳ Vence em ${dias} dia${dias === 1 ? '' : 's'}`,
      cor: COR.ambar,
      fundo: COR.ambarClaro
    },
    vencido: { texto: `! Vencido há ${dias} dia${dias === 1 ? '' : 's'}`, cor: '#FFFFFF', fundo: COR.vermelho }
  };

  const s = mapa[item.situacao];

  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, color: s.cor, background: s.fundo, whiteSpace: 'nowrap' }}>
      {s.texto}
    </span>
  );
};

const corSituacao = (situacao: SituacaoCertificadoRh): string =>
  situacao === 'vencido' ? COR.vermelho : situacao === 'vencendo' ? COR.ambar : COR.verde;

// ------------------------------------------------------------
// Exportar CSV (abre no Excel)
// ------------------------------------------------------------

const exportarCsv = (colaboradores: IColaboradorRh[]): void => {

  const rotuloSituacao: Record<SituacaoCertificadoRh, string> = {
    valido: 'Válido',
    semValidade: 'Sem vencimento',
    vencendo: 'A vencer',
    vencido: 'Vencido'
  };

  const celula = (valor: string): string => `"${(valor || '').replace(/"/g, '""')}"`;

  const linhas: string[] = [
    ['Colaborador', 'E-mail', 'Cargo', 'Status', 'Origem', 'Tipo', 'Curso / treinamento', 'Instituição',
      'Conclusão', 'Validade', 'Situação', 'Nº / registro'].map(celula).join(';')
  ];

  colaboradores.forEach(c => {
    if (c.certificados.length === 0) {
      linhas.push([c.nome, c.email, c.cargo, STATUS[c.status].rotulo, '', '', '', '', '', '', '', ''].map(celula).join(';'));
      return;
    }
    c.certificados.forEach(i => {
      linhas.push([
        c.nome, c.email, c.cargo, STATUS[c.status].rotulo,
        i.origem === 'plataforma' ? 'Plataforma' : 'Externo',
        i.tipo,
        `${i.treinamentoCodigo ? `${i.treinamentoCodigo} - ` : ''}${i.treinamento}`,
        i.instituicao,
        formatarData(i.realizacao),
        formatarData(i.validade),
        rotuloSituacao[i.situacao],
        i.numero
      ].map(celula).join(';'));
    });
  });

  const blob = new Blob(['\ufeff' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificados-colaboradores-${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ------------------------------------------------------------
// Card de um certificado (painel do colaborador)
// ------------------------------------------------------------

const CertificadoCard: React.FC<{
  item: ICertificadoRh;
  onRemover?: () => void;
}> = ({ item, onRemover }) => {

  const externo = item.origem === 'externo';

  return (
    <div
      style={{
        background: item.situacao === 'vencido' ? '#FFF8F7' : '#FFFFFF',
        border: `1px solid ${item.situacao === 'vencido' ? '#F3B7B0' : COR.borda}`,
        borderTop: `4px solid ${corSituacao(item.situacao)}`,
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '.05em',
            textTransform: 'uppercase',
            padding: '2px 8px',
            borderRadius: '999px',
            color: externo ? COR.roxo : COR.azulBotao,
            background: externo ? COR.roxoClaro : '#E8F2FF'
          }}
        >
          {externo ? 'Externo' : 'Plataforma'}
        </span>
        <SeloSituacao item={item} />
      </div>

      <div>
        <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: COR.sec }}>
          {externo ? item.tipo : item.treinamentoCodigo || item.tipo}
        </span>
        <strong style={{ fontSize: '14px', color: COR.azul, lineHeight: 1.3 }}>{item.treinamento}</strong>
        {item.instituicao && (
          <span style={{ display: 'block', fontSize: '12px', color: COR.sec }}>{item.instituicao}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px', color: COR.texto }}>
        <span>Conclusão: <strong>{formatarData(item.realizacao)}</strong></span>
        <span>
          Validade:{' '}
          <strong style={{ color: item.situacao === 'vencido' ? COR.vermelho : COR.texto }}>
            {item.validade ? formatarData(item.validade) : 'Não vence'}
          </strong>
        </span>
        {item.cargaHoraria !== undefined && <span>Carga horária: <strong>{item.cargaHoraria}h</strong></span>}
        {item.numero && <span style={{ overflowWrap: 'anywhere' }}>Nº: <strong>{item.numero}</strong></span>}
      </div>

      {item.observacoes && (
        <p style={{ margin: 0, fontSize: '12px', color: COR.sec, whiteSpace: 'pre-wrap' }}>{item.observacoes}</p>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: 'auto', paddingTop: '4px', flexWrap: 'wrap' }}>
        {item.arquivoUrl
          ? (
            <a href={item.arquivoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12.5px', fontWeight: 700, color: COR.azulBotao }}>
              📄 Abrir documento ↗
            </a>
          )
          : (
            <span style={{ fontSize: '12px', color: COR.sec }}>
              {externo ? 'Sem documento anexado' : 'PDF em geração'}
            </span>
          )}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: COR.sec }}>{item.registradoPor}</span>
        {onRemover && (
          <button type="button" onClick={onRemover} style={{ ...botao('perigo'), padding: '4px 10px', fontSize: '11.5px' }}>
            Remover
          </button>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Formulário: certificado externo
// ------------------------------------------------------------

const FormExterno: React.FC<{
  colaborador: IColaboradorRh;
  servico: RhCertificadosService;
  responsavel: string;
  onSalvo: () => void;
  onCancelar: () => void;
}> = ({ colaborador, servico, responsavel, onSalvo, onCancelar }) => {

  const [tipo, setTipo] = React.useState<string>(TIPOS_CERTIFICADO_EXTERNO[0]);
  const [titulo, setTitulo] = React.useState<string>('');
  const [instituicao, setInstituicao] = React.useState<string>('');
  const [cargaHoraria, setCargaHoraria] = React.useState<string>('');
  const [conclusao, setConclusao] = React.useState<string>('');
  const [naoVence, setNaoVence] = React.useState<boolean>(true);
  const [validade, setValidade] = React.useState<string>('');
  const [numero, setNumero] = React.useState<string>('');
  const [observacoes, setObservacoes] = React.useState<string>('');
  const [arquivo, setArquivo] = React.useState<File | undefined>(undefined);
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');

  // Formações acadêmicas normalmente não vencem; NR e certificações sim.
  React.useEffect(() => {
    setNaoVence(/superior|p[oó]s|mestrado|t[eé]cnico|idioma/i.test(tipo));
  }, [tipo]);

  const sensivel = detectarDadoSensivel([titulo, instituicao, numero, observacoes].join(' '));
  const arquivoGrande = !!arquivo && arquivo.size > TAMANHO_MAXIMO_ARQUIVO_MB * 1024 * 1024;

  const podeSalvar =
    !salvando &&
    !!titulo.trim() &&
    !!instituicao.trim() &&
    !!conclusao &&
    (naoVence || !!validade) &&
    !sensivel &&
    !arquivoGrande;

  const salvar = (): void => {
    if (!podeSalvar) {
      return;
    }
    setSalvando(true);
    setErro('');
    const horas = parseInt(cargaHoraria, 10);
    servico.adicionarExterno({
      usuarioId: colaborador.usuarioId,
      tipo,
      titulo,
      instituicao,
      cargaHoraria: isNaN(horas) ? undefined : horas,
      dataConclusao: conclusao,
      dataValidade: naoVence ? undefined : validade,
      numeroRegistro: numero,
      observacoes,
      arquivo,
      responsavel
    })
      .then(onSalvo)
      .catch(falha => {
        setErro(falha instanceof Error ? falha.message : String(falha));
        setSalvando(false);
      });
  };

  return (
    <div
      style={{
        border: `1px solid ${COR.borda}`,
        borderTop: `4px solid ${COR.roxo}`,
        borderRadius: '10px',
        padding: '16px',
        background: '#FFFFFF',
        marginBottom: '16px'
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: COR.azul }}>
        Novo certificado externo — {colaborador.nome}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <label>
          <span style={rotulo}>Tipo *</span>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={campo} disabled={salvando}>
            {TIPOS_CERTIFICADO_EXTERNO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ gridColumn: 'span 2' }}>
          <span style={rotulo}>Curso / título *</span>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} style={campo} disabled={salvando} maxLength={200}
            placeholder="Ex.: Bacharelado em Engenharia Elétrica" />
        </label>
        <label>
          <span style={rotulo}>Instituição *</span>
          <input value={instituicao} onChange={e => setInstituicao(e.target.value)} style={campo} disabled={salvando} maxLength={200}
            placeholder="Ex.: UFRGS" />
        </label>
        <label>
          <span style={rotulo}>Carga horária (horas)</span>
          <input type="number" min={0} value={cargaHoraria} onChange={e => setCargaHoraria(e.target.value)} style={campo} disabled={salvando} />
        </label>
        <label>
          <span style={rotulo}>Data de conclusão *</span>
          <input type="date" value={conclusao} onChange={e => setConclusao(e.target.value)} style={campo} disabled={salvando} />
        </label>
        <div>
          <span style={rotulo}>Validade</span>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12.5px', marginBottom: '6px' }}>
            <input type="checkbox" checked={naoVence} onChange={() => setNaoVence(!naoVence)} disabled={salvando} />
            Não vence
          </label>
          {!naoVence && (
            <input type="date" value={validade} onChange={e => setValidade(e.target.value)} style={campo} disabled={salvando} />
          )}
        </div>
        <label>
          <span style={rotulo}>Nº do certificado / registro</span>
          <input value={numero} onChange={e => setNumero(e.target.value)} style={campo} disabled={salvando} maxLength={100} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <span style={rotulo}>Observações</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} style={{ ...campo, resize: 'vertical' }} disabled={salvando} maxLength={4000} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          <span style={rotulo}>Documento (PDF ou imagem, até {TAMANHO_MAXIMO_ARQUIVO_MB} MB)</span>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setArquivo(e.target.files && e.target.files[0] ? e.target.files[0] : undefined)}
            disabled={salvando}
            style={{ fontSize: '13px' }}
          />
        </label>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '11.5px', color: COR.sec }}>
        Não digite CPF, CNPJ, senhas ou dados bancários nos campos. O documento fica na biblioteca
        Certificados (pasta Externos), com acesso restrito.
      </p>

      {(sensivel || arquivoGrande || erro) && (
        <p role="alert" style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: '8px', background: COR.vermelhoClaro, color: COR.vermelho, fontSize: '12.5px', fontWeight: 600 }}>
          {sensivel
            ? `Os campos contêm ${sensivel}. Remova esse dado para salvar (política da DGT / LGPD).`
            : arquivoGrande
              ? `O arquivo ultrapassa ${TAMANHO_MAXIMO_ARQUIVO_MB} MB.`
              : erro}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
        <button type="button" style={botao('secundario')} onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button
          type="button"
          style={{ ...botao('primario'), background: COR.roxo, opacity: podeSalvar ? 1 : 0.5, cursor: podeSalvar ? 'pointer' : 'not-allowed' }}
          onClick={salvar}
          disabled={!podeSalvar}
        >
          {salvando ? 'Salvando…' : 'Salvar certificado'}
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Painel do colaborador (todos os certificados)
// ------------------------------------------------------------

const PainelColaborador: React.FC<{
  colaborador: IColaboradorRh;
  servico: RhCertificadosService;
  externosDisponivel: boolean;
  responsavel: string;
  siteUrl?: string;
  onAlterado: () => void;
  onFechar: () => void;
}> = ({ colaborador, servico, externosDisponivel, responsavel, siteUrl, onAlterado, onFechar }) => {

  const [adicionando, setAdicionando] = React.useState<boolean>(false);
  const [mensagem, setMensagem] = React.useState<string>('');

  React.useEffect(() => {
    const aoTeclar = (e: KeyboardEvent): void => { if (e.key === 'Escape') { onFechar(); } };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [onFechar]);

  const plataforma = colaborador.certificados.filter(c => c.origem === 'plataforma');
  const externos = colaborador.certificados.filter(c => c.origem === 'externo');
  const s = STATUS[colaborador.status];

  const remover = (item: ICertificadoRh): void => {
    if (!window.confirm(`Remover "${item.treinamento}" da lista de ${colaborador.nome}?\n\nO registro não é apagado: fica no histórico.`)) {
      return;
    }
    servico.desativarExterno(item.chave)
      .then(() => { setMensagem('Certificado removido da lista.'); onAlterado(); })
      .catch(falha => setMensagem(falha instanceof Error ? falha.message : String(falha)));
  };

  const grade = (lista: ICertificadoRh[], podeRemover: boolean): React.ReactNode => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {lista.map(item => (
        <CertificadoCard key={item.chave} item={item} onRemover={podeRemover ? () => remover(item) : undefined} />
      ))}
    </div>
  );

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificados de ${colaborador.nome}`}
      onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: 'rgba(32,42,68,.5)', display: 'flex', justifyContent: 'flex-end', fontFamily: "Barlow, 'Segoe UI', Arial, sans-serif" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(980px, 100%)', height: '100%', background: COR.fundo, overflowY: 'auto', boxShadow: '-12px 0 40px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Cabeçalho */}
        <div style={{ background: '#FFFFFF', borderTop: `5px solid ${s.cor === COR.sec ? COR.indigo : s.cor}`, borderBottom: `1px solid ${COR.borda}`, padding: '18px 22px', display: 'flex', gap: '14px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
          <Avatar nome={colaborador.nome} email={colaborador.email} siteUrl={siteUrl} tamanho={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '19px', color: COR.azul }}>{colaborador.nome}</h2>
            <span style={{ display: 'block', fontSize: '12.5px', color: COR.sec }}>
              {colaborador.email}{colaborador.cargo ? ` · ${colaborador.cargo}` : ''}
            </span>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <SeloStatus status={colaborador.status} />
              <span style={{ fontSize: '12px', color: COR.sec }}>
                {plataforma.length} da plataforma · {externos.length} externo(s)
              </span>
            </div>
          </div>
          {externosDisponivel && !adicionando && (
            <button type="button" style={{ ...botao('primario'), background: COR.roxo }} onClick={() => setAdicionando(true)}>
              + Certificado externo
            </button>
          )}
          <button type="button" aria-label="Fechar" style={{ ...botao('secundario'), fontSize: '16px' }} onClick={onFechar}>×</button>
        </div>

        <div style={{ padding: '18px 22px' }}>

          {colaborador.vencidos > 0 && (
            <div role="alert" style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: COR.vermelhoClaro, border: `1px solid #F3B7B0`, color: COR.vermelho, fontSize: '13px', fontWeight: 600 }}>
              ! {colaborador.vencidos} certificado(s) vencido(s). Verifique a renovação com o colaborador.
            </div>
          )}

          {!externosDisponivel && (
            <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: COR.ambarClaro, color: COR.azul, fontSize: '12.5px' }}>
              Cadastro de certificados externos desativado: execute o script
              {' '}<code>scripts\dataverse\criar-tabela-certificados-externos.ps1</code>.
            </div>
          )}

          {mensagem && (
            <div role="status" style={{ marginBottom: '14px', fontSize: '12.5px', color: COR.sec }}>{mensagem}</div>
          )}

          {adicionando && (
            <FormExterno
              colaborador={colaborador}
              servico={servico}
              responsavel={responsavel}
              onCancelar={() => setAdicionando(false)}
              onSalvo={() => { setAdicionando(false); setMensagem('✓ Certificado externo cadastrado.'); onAlterado(); }}
            />
          )}

          <h3 style={{ margin: '4px 0 10px', fontSize: '14px', color: COR.azul, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COR.azulBotao, display: 'inline-block' }} />
            Treinamentos internos ({plataforma.length})
          </h3>
          {plataforma.length > 0
            ? grade(plataforma, false)
            : <p style={{ fontSize: '12.5px', color: COR.sec, margin: '0 0 8px' }}>Nenhum treinamento concluído no portal.</p>}

          <h3 style={{ margin: '22px 0 10px', fontSize: '14px', color: COR.azul, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COR.roxo, display: 'inline-block' }} />
            Certificados externos ({externos.length})
          </h3>
          {externos.length > 0
            ? grade(externos, true)
            : <p style={{ fontSize: '12.5px', color: COR.sec, margin: 0 }}>Nenhum certificado externo cadastrado.</p>}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Aba Certificados (lista de colaboradores)
// ------------------------------------------------------------

const AbaCertificados: React.FC<IRhPessoasPageProps> = ({
  dataverseService,
  spHttpClient,
  siteUrl,
  usuarioNome
}) => {

  const servico = React.useMemo(
    () => (dataverseService ? new RhCertificadosService(dataverseService, spHttpClient, siteUrl) : undefined),
    [dataverseService, spHttpClient, siteUrl]
  );

  const [dados, setDados] = React.useState<IColaboradorRh[]>([]);
  const [externosDisponivel, setExternosDisponivel] = React.useState<boolean>(true);
  const [carregando, setCarregando] = React.useState<boolean>(true);
  const [erro, setErro] = React.useState<string>('');
  const [busca, setBusca] = React.useState<string>('');
  const [filtro, setFiltro] = React.useState<FiltroStatus>('todos');
  const [versao, setVersao] = React.useState<number>(0);
  const [abertoId, setAbertoId] = React.useState<string>('');

  React.useEffect(() => {

    if (!servico) {
      setCarregando(false);
      setErro('Conexão com o Dataverse indisponível.');
      return undefined;
    }

    let ativo = true;
    setErro('');
    if (versao === 0) {
      setCarregando(true);
    }

    servico.carregar()
      .then(resultado => {
        if (ativo) {
          setDados(resultado.colaboradores);
          setExternosDisponivel(resultado.externosDisponivel);
        }
      })
      .catch(falha => { if (ativo) { setErro(falha instanceof Error ? falha.message : String(falha)); } })
      .then(() => { if (ativo) { setCarregando(false); } })
      .catch(() => undefined);

    return () => { ativo = false; };
  }, [servico, versao]);

  const totais = React.useMemo(() => ({
    colaboradores: dados.length,
    emDia: dados.filter(c => c.status === 'emDia').length,
    verificar: dados.filter(c => c.status === 'verificar').length,
    atencao: dados.filter(c => c.status === 'atencao').length,
    semCertificado: dados.filter(c => c.status === 'semCertificado').length,
    externos: dados.reduce((soma, c) => soma + c.certificados.filter(i => i.origem === 'externo').length, 0)
  }), [dados]);

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados
      .filter(c => filtro === 'todos' || c.status === filtro)
      .filter(c =>
        !termo ||
        `${c.nome} ${c.email} ${c.cargo}`.toLowerCase().indexOf(termo) >= 0 ||
        c.certificados.some(i => `${i.treinamento} ${i.treinamentoCodigo} ${i.instituicao} ${i.numero}`.toLowerCase().indexOf(termo) >= 0))
      .sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [dados, busca, filtro]);

  const aberto = dados.find(c => c.usuarioId === abertoId);

  const cartaoResumo = (
    titulo: string,
    valor: number,
    cor: string,
    alvo?: FiltroStatus
  ): React.ReactNode => {
    const ativo = alvo !== undefined && filtro === alvo && alvo !== 'todos';
    return (
      <button
        key={titulo}
        type="button"
        onClick={() => { if (alvo) { setFiltro(ativo ? 'todos' : alvo); } }}
        style={{
          textAlign: 'left',
          background: ativo ? `${cor}10` : '#FFFFFF',
          border: `1px solid ${ativo ? cor : COR.borda}`,
          borderTop: `4px solid ${cor}`,
          borderRadius: '10px',
          padding: '12px 14px',
          cursor: alvo ? 'pointer' : 'default',
          boxShadow: '0 2px 6px rgba(16,42,67,.05)'
        }}
      >
        <span style={{ display: 'block', fontSize: '12px', color: COR.sec }}>{titulo}</span>
        <strong style={{ fontSize: '24px', color: cor }}>{valor}</strong>
      </button>
    );
  };

  if (carregando) {
    return <p style={{ fontSize: '13px', color: COR.sec }}>Carregando colaboradores e certificados…</p>;
  }

  if (erro) {
    return (
      <div style={{ padding: '12px 14px', borderRadius: '10px', border: `1px solid ${COR.vermelho}`, color: COR.vermelho, fontSize: '13px', background: '#FFFFFF' }}>
        Não foi possível carregar os certificados: {erro}{' '}
        <button type="button" style={botao('secundario')} onClick={() => setVersao(v => v + 1)}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div>
      {/* Resumo (clique para filtrar) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {cartaoResumo('Colaboradores', totais.colaboradores, COR.azulBotao, 'todos')}
        {cartaoResumo('Em dia', totais.emDia, COR.verde, 'emDia')}
        {cartaoResumo('Verificar certificados', totais.verificar, COR.vermelho, 'verificar')}
        {cartaoResumo(`Vencimento próximo (${DIAS_AVISO_VENCIMENTO} dias)`, totais.atencao, COR.ambar, 'atencao')}
        {cartaoResumo('Sem certificados', totais.semCertificado, COR.indigo, 'semCertificado')}
        {cartaoResumo('Certificados externos', totais.externos, COR.roxo)}
      </div>

      {/* Busca e ações */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px', padding: '12px 14px', background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '10px' }}>
        <input
          aria-label="Buscar colaborador"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por colaborador, e-mail, cargo, curso ou instituição…"
          style={{ ...campo, flex: '1 1 320px', width: 'auto' }}
        />
        {filtro !== 'todos' && (
          <button type="button" style={botao('secundario')} onClick={() => setFiltro('todos')}>
            Filtro: {STATUS[filtro].rotulo} ✕
          </button>
        )}
        <button type="button" style={botao('secundario')} onClick={() => setVersao(v => v + 1)}>↻ Atualizar</button>
        <button type="button" style={botao('primario')} onClick={() => exportarCsv(visiveis)}>↓ Exportar (Excel)</button>
      </div>

      {/* Colaboradores */}
      {visiveis.length === 0
        ? <p style={{ fontSize: '13px', color: COR.sec }}>Nenhum colaborador com este filtro.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
            {visiveis.map(c => {
              const s = STATUS[c.status];
              const corBorda = c.status === 'semCertificado' ? COR.indigo : s.cor;
              const externos = c.certificados.filter(i => i.origem === 'externo').length;
              return (
                <button
                  key={c.usuarioId}
                  type="button"
                  onClick={() => setAbertoId(c.usuarioId)}
                  title={`Ver os certificados de ${c.nome}`}
                  style={{
                    textAlign: 'left',
                    background: c.status === 'verificar' ? '#FFF8F7' : '#FFFFFF',
                    border: `1px solid ${c.status === 'verificar' ? '#F3B7B0' : COR.borda}`,
                    borderTop: `5px solid ${corBorda}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 3px 10px rgba(16,42,67,.06)',
                    fontFamily: 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                    <Avatar nome={c.nome} email={c.email} siteUrl={siteUrl} tamanho={46} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block', fontSize: '14.5px', color: COR.azul, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nome}
                      </strong>
                      <span style={{ display: 'block', fontSize: '12px', color: COR.sec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.cargo || c.email}
                      </span>
                    </div>
                  </div>

                  <SeloStatus status={c.status} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: COR.sec, borderTop: `1px dashed ${COR.borda}`, paddingTop: '8px' }}>
                    <span>
                      <strong style={{ color: COR.azul }}>{c.certificados.length}</strong> certificado(s)
                      {externos > 0 ? <> · <strong style={{ color: COR.roxo }}>{externos}</strong> externo(s)</> : ''}
                    </span>
                    <span style={{ color: COR.azulBotao, fontWeight: 700 }}>Ver →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      {aberto && servico && (
        <PainelColaborador
          colaborador={aberto}
          servico={servico}
          externosDisponivel={externosDisponivel}
          responsavel={usuarioNome || ''}
          siteUrl={siteUrl}
          onAlterado={() => setVersao(v => v + 1)}
          onFechar={() => setAbertoId('')}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const RhPessoasPage: React.FC<IRhPessoasPageProps> = props => {

  const [aba, setAba] = React.useState<Aba>('certificados');

  return (
    <section>
      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${COR.borda}`, marginBottom: '16px' }} role="tablist">
        {ABAS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setAba(item.id)}
            style={{
              padding: '9px 14px',
              border: 0,
              borderBottom: `3px solid ${aba === item.id ? COR.azulBotao : 'transparent'}`,
              background: 'transparent',
              color: aba === item.id ? COR.azul : COR.sec,
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div
        style={{
          marginBottom: '18px',
          padding: '18px 22px',
          borderRadius: '14px',
          background: 'linear-gradient(120deg, #202A44 0%, #0B5CAB 60%, #05C3DD 100%)',
          color: '#FFFFFF'
        }}
      >
        <h1 style={{ margin: 0, fontSize: '22px' }}>Certificados dos colaboradores</h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
          Clique em um colaborador para ver todos os certificados — da plataforma e externos — e cadastrar novos documentos.
        </p>
      </div>

      {aba === 'certificados' && <AbaCertificados {...props} />}
      {aba === 'estrutura' && <EstruturaAreaAba dataverseService={props.dataverseService} />}
    </section>
  );
};

export default RhPessoasPage;
