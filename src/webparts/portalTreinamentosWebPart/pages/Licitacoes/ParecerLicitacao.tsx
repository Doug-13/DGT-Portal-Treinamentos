import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  DecisaoParecer,
  ILicitacaoResultado,
  IParecerLicitacao,
  ISituacaoParecer,
  ROTULO_DECISAO
} from '../../models/Licitacao';

import {
  TAMANHO_MAXIMO_JUSTIFICATIVA,
  TAMANHO_MINIMO_JUSTIFICATIVA,
  detectarDadoSensivel
} from '../../services/LicitacaoParecerService';

import {
  SituacaoPareceres
} from '../../hooks/useParecerLicitacoes';

import {
  formatarDataHoraPncp,
  formatarMoeda
} from '../../utils/licitacoesFiltro';

import {
  COR,
  FONTE
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — PARECER DA DGT (Participar / Não participar)
//
//   SeloParecer             selo com a decisão vigente
//   ParecerCartao           bloco compacto no cartão da busca
//   ParecerPainel           seção completa (com histórico) no
//                           painel de pré-visualização do edital
//   RegistrarParecerDialog  janela para decidir e justificar
//
// Cores da decisão: ciano = participar; tom avermelhado =
// não participar (pedido do usuário). O vermelho NÃO faz parte
// da paleta do Manual DGT: é uma exceção deliberada, restrita a
// este selo/botão. O texto continua no azul institucional e a
// decisão também é indicada por ícone + rótulo.
// ============================================================

// Tons avermelhados usados só no "Não participar".
const VERMELHO = {
  forte: '#C0392B',   // borda, ícone, marcador
  claro: '#FDECEA',   // fundo de selo / bloco / opção ativa
  texto: '#9B2C1F'    // ícone e rótulo do botão
};

// ------------------------------------------------------------
// Estilos (próprios: não dependem de '.content button')
// ------------------------------------------------------------

const botaoBase: React.CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: '7px 12px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FONTE,
  whiteSpace: 'nowrap',
  lineHeight: 1.2
};

const botaoParticipar: React.CSSProperties = {
  ...botaoBase,
  background: COR.cianoClaro,
  color: COR.azul,
  border: `1px solid ${COR.ciano}`
};

const botaoNaoParticipar: React.CSSProperties = {
  ...botaoBase,
  background: VERMELHO.claro,
  color: VERMELHO.texto,
  border: `1px solid ${VERMELHO.forte}`
};

const botaoLink: React.CSSProperties = {
  ...botaoBase,
  background: 'transparent',
  color: COR.indigo,
  padding: '4px 6px'
};

const botaoPrimario: React.CSSProperties = {
  ...botaoBase,
  padding: '9px 16px',
  background: COR.botao,
  color: '#ffffff'
};

const botaoSecundario: React.CSSProperties = {
  ...botaoBase,
  padding: '9px 16px',
  background: '#ffffff',
  color: COR.azul,
  border: `1px solid ${COR.cinzaClaro}`
};

export const ICONE_DECISAO: { [decisao: string]: string } = {
  Participar: '✓',
  NaoParticipar: '✕'
};

export const COR_DECISAO: { [decisao: string]: string } = {
  Participar: COR.ciano,
  NaoParticipar: VERMELHO.forte
};

// Fundo claro de cada decisão (selo, bloco do cartão, opção ativa).
export const FUNDO_DECISAO: { [decisao: string]: string } = {
  Participar: COR.cianoClaro,
  NaoParticipar: VERMELHO.claro
};

export const formatarDataHora = (iso: string): string => {
  const data = new Date(iso);
  if (isNaN(data.getTime())) {
    return '-';
  }
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// ------------------------------------------------------------
// Selo
// ------------------------------------------------------------

export const SeloParecer: React.FC<{
  decisao: DecisaoParecer;
  tamanho?: 'normal' | 'grande';
}> = ({ decisao, tamanho }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: tamanho === 'grande' ? '6px 12px' : '3px 9px',
      borderRadius: 999,
      fontSize: tamanho === 'grande' ? 13 : 11,
      fontWeight: 600,
      color: decisao === 'Participar' ? COR.azul : VERMELHO.texto,
      background: FUNDO_DECISAO[decisao],
      border: `1px solid ${COR_DECISAO[decisao]}`,
      whiteSpace: 'nowrap'
    }}
  >
    <span aria-hidden="true">{ICONE_DECISAO[decisao]}</span>
    {ROTULO_DECISAO[decisao]}
  </span>
);

// Mensagem quando o registro de parecer não está disponível.
const textoIndisponivel = (
  situacao: SituacaoPareceres
): string | undefined => {
  switch (situacao) {
    case 'carregando':
      return 'Carregando pareceres…';
    case 'semConexao':
      return 'Pareceres indisponíveis: sem conexão com o Dataverse nesta tela.';
    case 'tabelaInexistente':
      return 'Pareceres indisponíveis: a tabela dgt_licitacaoparecer ainda não foi criada no Dataverse.';
    case 'erro':
      return 'Pareceres indisponíveis: falha ao ler o Dataverse.';
    default:
      return undefined;
  }
};

// ------------------------------------------------------------
// Bloco compacto (cartão da lista)
// ------------------------------------------------------------

export const ParecerCartao: React.FC<{
  parecer?: ISituacaoParecer;
  situacao: SituacaoPareceres;
  onRegistrar: (decisao?: DecisaoParecer) => void;
}> = ({ parecer, situacao, onRegistrar }) => {

  const indisponivel = textoIndisponivel(situacao);

  if (parecer) {
    const atual = parecer.atual;
    return (
      <div
        style={{
          marginBottom: 12,
          padding: '10px 12px',
          borderRadius: 8,
          background: atual.decisao === 'Participar' ? COR.cianoClaro2 : VERMELHO.claro,
          borderLeft: `3px solid ${COR_DECISAO[atual.decisao]}`,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}
      >
        <SeloParecer decisao={atual.decisao} />

        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario }}>
            Parecer de {atual.responsavel} em {formatarDataHora(atual.registradoEm)}
            {parecer.historico.length > 1 ? ` · ${parecer.historico.length} pareceres no histórico` : ''}
          </span>
          <span
            title={atual.justificativa}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: 12,
              color: COR.azul,
              marginTop: 2,
              overflowWrap: 'anywhere'
            }}
          >
            {atual.justificativa}
          </span>
        </div>

        {situacao === 'ok' && (
          <button
            type="button"
            style={botaoLink}
            onClick={() => onRegistrar(undefined)}
          >
            Alterar parecer
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}
    >
      <span style={{ fontSize: 11, color: COR.textoSecundario, marginRight: 4 }}>
        Parecer da DGT:
      </span>

      {indisponivel
        ? (
          <span style={{ fontSize: 11, color: COR.textoSecundario, fontStyle: 'italic' }}>
            {indisponivel}
          </span>
        )
        : (
          <>
            <button type="button" style={botaoParticipar} onClick={() => onRegistrar('Participar')}>
              ✓ Participar
            </button>
            <button type="button" style={botaoNaoParticipar} onClick={() => onRegistrar('NaoParticipar')}>
              ✕ Não participar
            </button>
          </>
        )}
    </div>
  );
};

// ------------------------------------------------------------
// Seção completa (painel do edital)
// ------------------------------------------------------------

const ItemHistorico: React.FC<{
  parecer: IParecerLicitacao;
  vigente: boolean;
}> = ({ parecer, vigente }) => (
  <li
    style={{
      position: 'relative',
      padding: '0 0 14px 18px',
      borderLeft: `2px solid ${COR.cinzaClaro}`,
      marginLeft: 5
    }}
  >
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: -6,
        top: 2,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: vigente ? COR_DECISAO[parecer.decisao] : '#ffffff',
        border: `2px solid ${COR_DECISAO[parecer.decisao]}`
      }}
    />
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <SeloParecer decisao={parecer.decisao} />
      {vigente && (
        <span style={{ fontSize: 10, fontWeight: 600, color: COR.indigo, textTransform: 'uppercase' }}>
          vigente
        </span>
      )}
      <span style={{ fontSize: 11, color: COR.textoSecundario }}>
        {parecer.responsavel} · {formatarDataHora(parecer.registradoEm)}
      </span>
    </div>
    <p
      style={{
        margin: '6px 0 0',
        fontSize: 12,
        lineHeight: 1.55,
        color: COR.azul,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere'
      }}
    >
      {parecer.justificativa}
    </p>
  </li>
);

export const ParecerPainel: React.FC<{
  parecer?: ISituacaoParecer;
  situacao: SituacaoPareceres;
  onRegistrar: (decisao?: DecisaoParecer) => void;
}> = ({ parecer, situacao, onRegistrar }) => {

  const indisponivel = textoIndisponivel(situacao);

  return (
    <div
      style={{
        marginBottom: 22,
        padding: 16,
        borderRadius: 10,
        background: '#ffffff',
        border: `1px solid ${COR.cinzaClaro}`,
        borderTop: `3px solid ${parecer ? COR_DECISAO[parecer.atual.decisao] : COR.indigo}`
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: parecer ? 14 : 0
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COR.azul }}>
            Parecer da DGT
          </h3>
          <span style={{ fontSize: 11, color: COR.textoSecundario }}>
            {parecer
              ? 'Cada alteração gera um novo registro; o histórico abaixo nunca é apagado.'
              : 'Ainda não há parecer para este edital. Decida e justifique para registrar o histórico.'}
          </span>
        </div>

        {indisponivel
          ? (
            <span style={{ fontSize: 11, color: COR.textoSecundario, fontStyle: 'italic' }}>
              {indisponivel}
            </span>
          )
          : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={botaoParticipar} onClick={() => onRegistrar('Participar')}>
                ✓ Avaliar Partipação
              </button>
              <button type="button" style={botaoNaoParticipar} onClick={() => onRegistrar('NaoParticipar')}>
                ✕ Não participar
              </button>
            </div>
          )}
      </div>

      {parecer && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0 0' }}>
          {parecer.historico.map((item, indice) => (
            <ItemHistorico key={item.id || indice} parecer={item} vigente={indice === 0} />
          ))}
        </ul>
      )}
    </div>
  );
};

// ------------------------------------------------------------
// Diálogo: decidir e justificar
// ------------------------------------------------------------

const MOTIVOS_RAPIDOS: { [decisao: string]: string[] } = {
  Participar: [
    'Objeto aderente ao portfólio DGT',
    'Valor estimado atrativo',
    'Prazo viável para a proposta',
    'Atestados técnicos compatíveis',
    'Cliente / região estratégica'
  ],
  NaoParticipar: [
    'Objeto fora do portfólio DGT',
    'Valor estimado abaixo do mínimo',
    'Prazo insuficiente para a proposta',
    'Exigências de habilitação não atendidas',
    'Região fora da área de atuação',
    'Modelo de contratação (comodato/locação) inviável'
  ]
};

export interface IRegistrarParecerDialogProps {
  item?: ILicitacaoResultado;
  decisaoInicial?: DecisaoParecer;
  parecerAtual?: ISituacaoParecer;
  onCancelar: () => void;
  onSalvar: (decisao: DecisaoParecer, justificativa: string) => Promise<void>;
}

export const RegistrarParecerDialog: React.FC<IRegistrarParecerDialogProps> = ({
  item,
  decisaoInicial,
  parecerAtual,
  onCancelar,
  onSalvar
}) => {

  const [decisao, setDecisao] = React.useState<DecisaoParecer | undefined>(decisaoInicial);
  const [justificativa, setJustificativa] = React.useState<string>('');
  const [salvando, setSalvando] = React.useState<boolean>(false);
  const [erro, setErro] = React.useState<string>('');

  const campoRef = React.useRef<HTMLTextAreaElement>(null);

  // Abre / troca de edital: reinicia.
  React.useEffect(() => {
    setDecisao(decisaoInicial);
    setJustificativa('');
    setErro('');
    setSalvando(false);
    if (item) {
      window.setTimeout(() => {
        if (campoRef.current) {
          campoRef.current.focus();
        }
      }, 50);
    }
  }, [item, decisaoInicial]);

  if (!item) {
    return null;
  }

  const texto = justificativa.trim();
  const sensivel = detectarDadoSensivel(texto);
  const curta = texto.length < TAMANHO_MINIMO_JUSTIFICATIVA;
  const podeSalvar = !!decisao && !curta && !sensivel && !salvando;

  const adicionarMotivo = (motivo: string): void => {
    setJustificativa(atual => {
      const base = atual.trim();
      if (base.indexOf(motivo) >= 0) {
        return atual;
      }
      return base ? `${base}; ${motivo}` : motivo;
    });
    if (campoRef.current) {
      campoRef.current.focus();
    }
  };

  const salvar = (): void => {
    if (!decisao || !podeSalvar) {
      return;
    }
    setSalvando(true);
    setErro('');
    onSalvar(decisao, texto)
      .catch(falha => {
        setErro((falha as Error).message || 'Não foi possível salvar o parecer.');
        setSalvando(false);
      });
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLDivElement>): void => {
    if (evento.key === 'Escape') {
      // Não deixa o Esc chegar ao painel do edital (que fecharia junto).
      evento.stopPropagation();
      if (!salvando) {
        onCancelar();
      }
    }
  };

  const opcao = (valor: DecisaoParecer): React.CSSProperties => {
    const ativa = decisao === valor;
    return {
      ...botaoBase,
      flex: '1 1 180px',
      padding: '12px 14px',
      fontSize: 13,
      textAlign: 'left',
      color: valor === 'NaoParticipar' ? VERMELHO.texto : COR.azul,
      background: ativa ? FUNDO_DECISAO[valor] : '#ffffff',
      border: `2px solid ${ativa || valor === 'NaoParticipar' ? COR_DECISAO[valor] : COR.cinzaClaro}`
    };
  };

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Registrar parecer do edital"
      onKeyDown={aoTeclar}
      onClick={() => { if (!salvando) { onCancelar(); } }}
      style={{
        position: 'fixed',
        inset: 0,
        // Acima do painel de pré-visualização (2147483000).
        zIndex: 2147483100,
        background: 'rgba(32, 42, 68, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: FONTE
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
          background: '#ffffff',
          borderRadius: 12,
          borderTop: `4px solid ${COR.ciano}`,
          boxShadow: '0 20px 50px rgba(32, 42, 68, 0.3)',
          padding: 22
        }}
      >
        <span style={{ fontSize: 11, color: COR.textoSecundario }}>
          {item.modalidade} · {item.local} · Nº {item.numero}
        </span>
        <h2 style={{ margin: '2px 0 6px', fontSize: 17, fontWeight: 600, color: COR.azul }}>
          Parecer — {item.orgao}
        </h2>
        <p
          title={item.objeto}
          style={{
            margin: '0 0 6px',
            fontSize: 12,
            lineHeight: 1.5,
            color: COR.azul,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {item.objeto}
        </p>
        <span style={{ display: 'block', fontSize: 11, color: COR.textoSecundario, marginBottom: 16 }}>
          Valor estimado {formatarMoeda(item.valor)} · encerra em {formatarDataHoraPncp(item.encerramento)} · aderência {item.score}%
        </span>

        {parecerAtual && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              background: COR.indigoClaro,
              fontSize: 12,
              color: COR.azul,
              marginBottom: 16,
              lineHeight: 1.5
            }}
          >
            Parecer vigente: <strong>{ROTULO_DECISAO[parecerAtual.atual.decisao]}</strong>
            {' '}({parecerAtual.atual.responsavel}, {formatarDataHora(parecerAtual.atual.registradoEm)}).
            O novo parecer passa a valer e o anterior permanece no histórico.
          </div>
        )}

        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COR.azul, marginBottom: 8 }}>
          Decisão
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <button
            type="button"
            style={opcao('Participar')}
            aria-pressed={decisao === 'Participar'}
            onClick={() => setDecisao('Participar')}
            disabled={salvando}
          >
            ✓ Avaliar Partipação
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: COR.textoSecundario, marginTop: 2 }}>
              A DGT vai disputar este edital
            </span>
          </button>
          <button
            type="button"
            style={opcao('NaoParticipar')}
            aria-pressed={decisao === 'NaoParticipar'}
            onClick={() => setDecisao('NaoParticipar')}
            disabled={salvando}
          >
            ✕ Não participar
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: COR.textoSecundario, marginTop: 2 }}>
              Edital descartado pela DGT
            </span>
          </button>
        </div>

        <label
          htmlFor="parecer-justificativa"
          style={{ display: 'block', fontSize: 12, fontWeight: 600, color: COR.azul, marginBottom: 6 }}
        >
          Justificativa (obrigatória)
        </label>

        {decisao && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {MOTIVOS_RAPIDOS[decisao].map(motivo => (
              <button
                key={motivo}
                type="button"
                onClick={() => adicionarMotivo(motivo)}
                disabled={salvando}
                style={{
                  ...botaoBase,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 400,
                  borderRadius: 999,
                  background: COR.azulClaro,
                  color: COR.azul
                }}
              >
                + {motivo}
              </button>
            ))}
          </div>
        )}

        <textarea
          id="parecer-justificativa"
          ref={campoRef}
          value={justificativa}
          maxLength={TAMANHO_MAXIMO_JUSTIFICATIVA}
          onChange={evento => setJustificativa(evento.target.value)}
          disabled={salvando}
          rows={5}
          placeholder="Explique por que a DGT vai ou não participar: aderência ao portfólio, valor, prazo, exigências de habilitação, região, concorrência…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            border: `1px solid ${sensivel ? COR.indigo : COR.cinzaClaro}`,
            borderRadius: 8,
            fontSize: 13,
            fontFamily: FONTE,
            color: COR.azul,
            resize: 'vertical',
            lineHeight: 1.5
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: COR.textoSecundario }}>
            Não informe CPF, CNPJ, senhas ou dados bancários.
          </span>
          <span style={{ fontSize: 11, color: curta ? COR.indigo : COR.textoSecundario, whiteSpace: 'nowrap' }}>
            {texto.length < TAMANHO_MINIMO_JUSTIFICATIVA
              ? `mínimo ${TAMANHO_MINIMO_JUSTIFICATIVA} caracteres`
              : `${texto.length} / ${TAMANHO_MAXIMO_JUSTIFICATIVA}`}
          </span>
        </div>

        {sensivel && (
          <p
            role="alert"
            style={{
              margin: '10px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: COR.indigoClaro,
              border: `1px solid ${COR.indigo}`,
              fontSize: 12,
              color: COR.azul,
              lineHeight: 1.5
            }}
          >
            ! A justificativa contém {sensivel}. Remova esse dado para poder salvar:
            pela política da DGT (LGPD), CPF, CNPJ, senhas e dados bancários não podem
            ser gravados no portal. Identifique o órgão pelo nome.
          </p>
        )}

        {erro && (
          <p
            role="alert"
            style={{
              margin: '10px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: COR.indigoClaro,
              fontSize: 12,
              fontWeight: 600,
              color: COR.azul
            }}
          >
            ! {erro}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" style={botaoSecundario} onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="button"
            style={{
              ...botaoPrimario,
              opacity: podeSalvar ? 1 : 0.5,
              cursor: podeSalvar ? 'pointer' : 'not-allowed'
            }}
            onClick={salvar}
            disabled={!podeSalvar}
          >
            {salvando ? 'Salvando…' : 'Registrar parecer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};