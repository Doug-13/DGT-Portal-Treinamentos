import * as React from 'react';

import {
  Icones
} from '../../components/common/Icones';

import {
  IAmbiente,
  IAmbienteRegistro,
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  IFluxoDefinicao
} from '../../models/Fluxo';

import {
  COLUNAS_BASE,
  IAmbienteLayout,
  IContextoFiltro,
  PREFIXO_CAMPO_COLUNA,
  descreverFiltro,
  registroAtendeVisao
} from '../../services/ambientes/layoutAmbiente';

import {
  formatarValorCampo
} from '../../services/fluxo/FluxoEngine';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import {
  COR,
  FONTE,
  Selo,
  SeloPrazo,
  cartao,
  formatarData
} from '../Orcamento/orcamentoComum';

// ============================================================
// VISÃO GERAL DO AMBIENTE (configurável)
//
// Cards de resumo = VISÕES do layout (contagem + filtro, no estilo da
// Arquitetura de Soluções); clicar num card filtra a lista. A lista
// mostra as COLUNAS escolhidas, inclusive campos do fluxo.
// ============================================================

export interface IVisaoGeralAmbienteProps {
  ambiente: IAmbiente;
  layout: IAmbienteLayout;
  definicao?: IFluxoDefinicao;
  // Registros que o usuário pode ver nesta tela.
  registros: IAmbienteRegistro[];
  contextoFiltro: IContextoFiltro;
  visaoSelecionada: string;
  onSelecionarVisao: (id: string) => void;
  busca: string;
  mostrarEncerrados: boolean;
  onAbrir: (registro: IAmbienteRegistro) => void;
}

const CORES_SITUACAO: Record<SituacaoRegistroAmbiente, { texto: string; cor: string; fundo: string }> = {
  emAndamento: { texto: 'Em andamento', cor: '#0F4C81', fundo: '#E8F2FF' },
  concluido: { texto: 'Concluído', cor: '#107C10', fundo: '#E7F6EC' },
  cancelado: { texto: 'Cancelado', cor: '#64748b', fundo: '#F1F5F9' }
};

const celula: React.CSSProperties = {
  padding: '12px 12px',
  borderTop: `1px solid ${COR.borda}`,
  fontSize: '13px',
  color: COR.azul,
  verticalAlign: 'top'
};

const cabecalhoCelula: React.CSSProperties = {
  ...celula,
  borderTop: 0,
  fontSize: '11.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  color: COR.texto2,
  textAlign: 'left',
  background: COR.fundo,
  whiteSpace: 'nowrap'
};

// Fundo claro tingido a partir da cor do card (#RRGGBB → rgba).
const tingir = (cor: string, alfa: number): string => {
  const valor = /^#([0-9a-f]{6})$/i.exec(cor || '');
  if (!valor) {
    return `rgba(15, 108, 189, ${alfa})`;
  }
  const numero = parseInt(valor[1], 16);
  return `rgba(${(numero >> 16) & 255}, ${(numero >> 8) & 255}, ${numero & 255}, ${alfa})`;
};

const VisaoGeralAmbiente: React.FC<IVisaoGeralAmbienteProps> = (props) => {

  const { layout, definicao, registros, contextoFiltro } = props;

  const metadados = (definicao && definicao.metadados) || [];

  // Linha sob o mouse/foco (destaque).
  const [sobre, setSobre] = React.useState('');

  const visaoAtiva = layout.visoes.find(item => item.id === props.visaoSelecionada);

  const termo = props.busca.trim().toLowerCase();

  // Visão escolhida decide tudo; sem visão, o filtro "encerrados".
  const lista =
    registros
      .filter(item =>
        visaoAtiva
          ? registroAtendeVisao(item, visaoAtiva.filtro, contextoFiltro)
          : props.mostrarEncerrados || item.situacao === 'emAndamento')
      .filter(item =>
        !termo ||
        `${item.codigo} ${item.titulo} ${item.etapaAtual} ${item.solicitanteNome} ${item.areaNome} ${Object.keys(item.valores || {}).map(chave => item.valores[chave]).join(' ')}`
          .toLowerCase()
          .indexOf(termo) >= 0);

  const rotuloColuna = (chave: string): string => {
    const base = COLUNAS_BASE.find(item => item.chave === chave);
    if (base) {
      return chave === 'titulo' ? props.ambiente.rotuloRegistro : base.rotulo;
    }
    const meta = metadados.find(item => `${PREFIXO_CAMPO_COLUNA}${item.chave}` === chave);
    return meta ? meta.rotulo : chave.replace(PREFIXO_CAMPO_COLUNA, '');
  };

  const valorColuna = (registro: IAmbienteRegistro, chave: string): React.ReactNode => {
    switch (chave) {
      case 'codigo':
        return (
          <span style={{ whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: '6px', background: '#EEF4FA', color: '#202A44', fontSize: '12px', fontWeight: 700 }}>
            {registro.codigo}
          </span>
        );
      case 'titulo':
        return <strong style={{ color: '#202A44', fontWeight: 600 }}>{registro.titulo}</strong>;
      case 'etapa':
        return registro.etapaAtual || '—';
      case 'prazo':
        return registro.prazoEtapa && registro.situacao === 'emAndamento'
          ? <SeloPrazo prazo={registro.prazoEtapa} situacao={situacaoPrazo(registro.prazoEtapa)} />
          : '—';
      case 'situacao': {
        const cores = CORES_SITUACAO[registro.situacao] || CORES_SITUACAO.emAndamento;
        return <Selo texto={cores.texto} cor={cores.cor} fundo={cores.fundo} />;
      }
      case 'solicitante':
        return registro.solicitanteNome
          ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
              <span aria-hidden="true" style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#E8F2FF', color: '#0B5CAB', fontSize: '10px', fontWeight: 800 }}>
                {registro.solicitanteNome.split(' ').filter(Boolean).slice(0, 2).map(parte => parte.charAt(0).toUpperCase()).join('')}
              </span>
              {registro.solicitanteNome}
            </span>
          )
          : '—';
      case 'area':
        return registro.areaNome || '—';
      case 'criadoEm':
        return <span style={{ whiteSpace: 'nowrap' }}>{formatarData(registro.criadoEm)}</span>;
      default: {
        const campo = chave.substring(PREFIXO_CAMPO_COLUNA.length);
        const meta = metadados.find(item => item.chave === campo);
        const valor = (registro.valores || {})[campo] || '';
        return formatarValorCampo(meta ? meta.tipo : 'texto', valor) || '—';
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: FONTE }}>

      {/* Cards de resumo (visões) */}
      {layout.visoes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '10px' }}>
          {layout.visoes.map(visao => {
            const quantidade = registros.filter(item => registroAtendeVisao(item, visao.filtro, contextoFiltro)).length;
            const ativo = props.visaoSelecionada === visao.id;
            const IconeVisao = Icones[visao.icone] || Icones.grid;
            return (
              <button
                key={visao.id}
                type="button"
                onClick={() => props.onSelecionarVisao(ativo ? '' : visao.id)}
                aria-pressed={ativo}
                title={descreverFiltro(visao.filtro, definicao)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${ativo ? visao.cor : COR.borda}`,
                  boxShadow: ativo ? `0 0 0 3px ${tingir(visao.cor, 0.18)}` : 'none',
                  background: ativo ? tingir(visao.cor, 0.07) : '#FFFFFF',
                  cursor: 'pointer',
                  fontFamily: FONTE
                }}
              >
                <span
                  style={{
                    width: '38px',
                    height: '38px',
                    flexShrink: 0,
                    borderRadius: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: tingir(visao.cor, 0.12),
                    color: visao.cor
                  }}
                >
                  <IconeVisao />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '24px', lineHeight: 1.1, color: COR.azul }}>{quantidade}</strong>
                  <span style={{ display: 'block', fontSize: '12.5px', color: COR.texto2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {visao.nome}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {visaoAtiva && (
        <div style={{ fontSize: '12.5px', color: COR.texto2 }}>
          Mostrando <strong style={{ color: COR.azul }}>{visaoAtiva.nome}</strong> — {descreverFiltro(visaoAtiva.filtro, definicao)} ·{' '}
          <button
            type="button"
            onClick={() => props.onSelecionarVisao('')}
            style={{ border: 0, background: 'transparent', padding: 0, color: '#0874CE', fontWeight: 700, cursor: 'pointer', fontFamily: FONTE, fontSize: '12.5px' }}
          >
            mostrar todos
          </button>
        </div>
      )}

      {/* Lista */}
      <div style={{ ...cartao, padding: 0, marginBottom: 0, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${COR.borda}` }}>
          <strong style={{ fontSize: '14px', color: COR.azul }}>
            {visaoAtiva ? visaoAtiva.nome : (props.mostrarEncerrados ? 'Todos os registros' : 'Em andamento')}
          </strong>
          <span style={{ padding: '2px 9px', borderRadius: '999px', background: '#EEF2F7', color: COR.texto2, fontSize: '12px', fontWeight: 700 }}>
            {lista.length} {lista.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONTE }}>
            <thead>
              <tr>
                <th aria-hidden="true" style={{ ...cabecalhoCelula, width: '4px', padding: 0 }} />
                {layout.colunas.map(chave => <th key={chave} style={cabecalhoCelula}>{rotuloColuna(chave)}</th>)}
                <th aria-hidden="true" style={{ ...cabecalhoCelula, width: '28px' }} />
              </tr>
            </thead>
            <tbody>
              {lista.map(registro => {
                const cores = CORES_SITUACAO[registro.situacao] || CORES_SITUACAO.emAndamento;
                const marcada = sobre === registro.id;
                return (
                  <tr
                    key={registro.id}
                    tabIndex={0}
                    onClick={() => props.onAbrir(registro)}
                    onKeyDown={evento => { if (evento.key === 'Enter') { props.onAbrir(registro); } }}
                    onMouseEnter={() => setSobre(registro.id)}
                    onMouseLeave={() => setSobre('')}
                    onFocus={() => setSobre(registro.id)}
                    onBlur={() => setSobre('')}
                    style={{ cursor: 'pointer', background: marcada ? '#F3F8FE' : '#FFFFFF', transition: 'background .12s', outline: 'none' }}
                    title={`Abrir ${registro.codigo}`}
                  >
                    <td aria-hidden="true" style={{ ...celula, padding: 0, width: '4px', background: cores.cor, opacity: marcada ? 1 : 0.55 }} />
                    {layout.colunas.map(chave => <td key={chave} style={celula}>{valorColuna(registro, chave)}</td>)}
                    <td aria-hidden="true" style={{ ...celula, color: marcada ? '#0B5CAB' : '#CBD5E1', fontSize: '16px', textAlign: 'center' }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lista.length === 0 && (
          <div style={{ padding: '36px 18px', textAlign: 'center' }}>
            <div aria-hidden="true" style={{ fontSize: '28px', color: '#CBD5E1', marginBottom: '6px' }}>▤</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: COR.azul }}>Nenhum registro {visaoAtiva ? 'nesta visão' : 'encontrado'}</div>
            <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '4px' }}>
              {termo ? 'Ajuste a busca ou limpe o filtro.' : 'Os registros aparecem aqui assim que forem criados.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisaoGeralAmbiente;
