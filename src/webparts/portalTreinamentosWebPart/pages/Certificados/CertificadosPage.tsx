import * as React from 'react';
import * as ReactDOM from 'react-dom';

import {
  ICertificado
} from '../../models/Treinamento';

import PageHeader from
  '../../components/layout/PageHeader';

import EmptyState from
  '../../components/common/EmptyState';

// ============================================================
// CERTIFICADOS
//
// Cards no mesmo padrão dos cards de "Meus treinamentos":
//   • prévia do certificado no topo (miniatura da 1ª página do
//     PDF gerada pelo SharePoint; se não houver, um certificado
//     desenhado com os dados do treinamento);
//   • selo de situação (Válido / Vence em N dias / Vencido /
//     Gerando PDF);
//   • "Visualizar certificado" abre o PDF dentro do portal,
//     com Baixar e Abrir em nova aba.
//
// Pensado para muitos certificados: busca, filtros por
// situação com contadores e grade que se ajusta à largura.
// ============================================================

export interface ICertificadosPageProps {
  certificados:
    ICertificado[];
}

type Situacao =
  | 'valido'
  | 'vencendo'
  | 'vencido'
  | 'semValidade';

type Filtro =
  | 'todos'
  | 'valido'
  | 'vencendo'
  | 'vencido';

const DIAS_AVISO_VENCIMENTO = 30;

const COR = {
  azul: '#0B2D4D',
  azulBotao: '#0B5CAB',
  texto: '#334155',
  textoSec: '#64748B',
  borda: '#DCE5EE',
  fundo: '#EDF3F8',
  verde: '#138A63',
  verdeClaro: '#E8F6EF',
  ambar: '#B45309',
  ambarClaro: '#FEF3C7',
  vermelho: '#B42318',
  vermelhoClaro: '#FDECEA',
  cinza: '#64748B'
};

// ------------------------------------------------------------
// Datas
// ------------------------------------------------------------

// "dd/mm/aaaa" → Date
const lerData = (
  valor?: string
): Date | undefined => {

  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(valor || '');

  if (!m) {
    return undefined;
  }

  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
};

const diasAte = (
  data: Date
): number => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((data.getTime() - hoje.getTime()) / 86400000);
};

const situacaoDe = (
  item: ICertificado
): { situacao: Situacao; dias?: number } => {

  const validade = lerData(item.validade);

  if (!validade) {
    return { situacao: 'semValidade' };
  }

  const dias = diasAte(validade);

  if (dias < 0) {
    return { situacao: 'vencido', dias };
  }

  if (dias <= DIAS_AVISO_VENCIMENTO) {
    return { situacao: 'vencendo', dias };
  }

  return { situacao: 'valido', dias };
};

// ------------------------------------------------------------
// Selo de situação (canto da prévia)
// ------------------------------------------------------------

const Selo: React.FC<{ item: ICertificado }> = ({ item }) => {

  const { situacao, dias } = situacaoDe(item);

  let texto = '✓ Válido';
  let fundo = COR.verde;

  if (situacao === 'vencido') {
    texto = '! Vencido';
    fundo = COR.vermelho;
  } else if (situacao === 'vencendo') {
    texto = dias === 0 ? '⏳ Vence hoje' : `⏳ Vence em ${dias} dia${dias === 1 ? '' : 's'}`;
    fundo = COR.ambar;
  } else if (situacao === 'semValidade') {
    texto = '✓ Sem vencimento';
  }

  return (
    <span
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 2,
        padding: '0 9px',
        minHeight: 22,
        lineHeight: '22px',
        borderRadius: 999,
        background: fundo,
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 700,
        boxShadow: '0 2px 6px rgba(0,0,0,.18)',
        whiteSpace: 'nowrap'
      }}
    >
      {texto}
    </span>
  );
};

// ------------------------------------------------------------
// Certificado desenhado (quando não há miniatura do PDF)
// ------------------------------------------------------------

const CertificadoDesenhado: React.FC<{ item: ICertificado }> = ({ item }) => (
  <div
    aria-hidden="true"
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #E8F2FA 0%, #D5E8F6 100%)',
      padding: 12,
      boxSizing: 'border-box'
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 230,
        aspectRatio: '1.414 / 1',
        background: '#ffffff',
        border: `2px solid ${COR.azul}`,
        outline: '1px solid #05C3DD',
        outlineOffset: -6,
        borderRadius: 3,
        boxShadow: '0 4px 12px rgba(16,42,67,.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '8px 12px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: 1, color: '#05C3DD' }}>DGT</span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: COR.azul, marginTop: 2 }}>
        CERTIFICADO
      </span>
      <span style={{ fontSize: 6.5, color: COR.textoSec, marginTop: 1 }}>de conclusão</span>
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: COR.azul,
          marginTop: 5,
          lineHeight: 1.25,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {item.treinamento}
      </span>
      <span style={{ width: '40%', borderTop: `1px solid ${COR.borda}`, marginTop: 6 }} />
      <span style={{ fontSize: 6, color: COR.textoSec, marginTop: 3 }}>
        {item.numero || item.codigo} · {item.conclusao}
      </span>
    </div>
  </div>
);

// ------------------------------------------------------------
// Prévia: miniatura do PDF por cima do certificado desenhado
// ------------------------------------------------------------

const Previa: React.FC<{ item: ICertificado; onClick?: () => void }> = ({ item, onClick }) => {

  const [falhou, setFalhou] = React.useState<boolean>(false);
  const [carregou, setCarregou] = React.useState<boolean>(false);

  const usarMiniatura =
    item.situacaoArquivo === 'disponivel' &&
    !!item.previewUrl &&
    !falhou;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={evento => {
        if (onClick && (evento.key === 'Enter' || evento.key === ' ')) {
          evento.preventDefault();
          onClick();
        }
      }}
      title={onClick ? 'Visualizar certificado' : undefined}
      style={{
        position: 'relative',
        height: 150,
        overflow: 'hidden',
        background: COR.fundo,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0
      }}
    >
      {(!usarMiniatura || !carregou) && <CertificadoDesenhado item={item} />}

      {usarMiniatura && (
        <img
          src={item.previewUrl}
          alt={`Prévia do certificado — ${item.treinamento}`}
          loading="lazy"
          onLoad={evento => {
            // O SharePoint às vezes devolve uma imagem "vazia"
            // (1×1) quando ainda não gerou a miniatura.
            const img = evento.currentTarget;
            if (img.naturalWidth < 20) {
              setFalhou(true);
            } else {
              setCarregou(true);
            }
          }}
          onError={() => setFalhou(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            background: '#ffffff',
            opacity: carregou ? 1 : 0,
            transition: 'opacity .25s ease'
          }}
        />
      )}

      <Selo item={item} />
    </div>
  );
};

// ------------------------------------------------------------
// Card
// ------------------------------------------------------------

const botao: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  cursor: 'pointer'
};

const CertificadoCard: React.FC<{
  item: ICertificado;
  onVisualizar: (item: ICertificado) => void;
}> = ({ item, onVisualizar }) => {

  const disponivel =
    item.situacaoArquivo === 'disponivel' && !!item.arquivoUrl;

  const { situacao } = situacaoDe(item);

  const corBorda =
    situacao === 'vencido'
      ? '#F3B7B0'
      : situacao === 'vencendo'
        ? '#F5D48A'
        : '#9FD4B2';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: '#ffffff',
        border: `1px solid ${corBorda}`,
        borderRadius: 9,
        overflow: 'hidden',
        boxShadow: '0 2px 7px rgba(16,42,67,.06)'
      }}
    >
      <Previa
        item={item}
        onClick={disponivel ? () => onVisualizar(item) : undefined}
      />

      <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: COR.verde, letterSpacing: 0.3 }}>
            {item.codigo || 'CERTIFICADO'}
          </span>
          {item.cargaHoraria && item.cargaHoraria !== '-' && (
            <span style={{ fontSize: 10, color: COR.textoSec, whiteSpace: 'nowrap' }}>
              ⏱ {item.cargaHoraria}
            </span>
          )}
        </div>

        <h3
          title={item.treinamento}
          style={{
            margin: '4px 0 8px',
            fontSize: 14,
            lineHeight: 1.3,
            color: COR.azul,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {item.treinamento}
        </h3>

        <div style={{ fontSize: 11, color: COR.texto, lineHeight: 1.7 }}>
          <div>Conclusão: <strong>{item.conclusao}</strong></div>
          <div>Validade: <strong>{item.validade || '-'}</strong></div>
          {item.revisao && (
            <div>
              Revisão do treinamento: <strong>{item.revisao}</strong>
              {item.revisaoAtual && item.revisaoAtual !== item.revisao && (
                <span
                  title="O treinamento foi revisado depois da sua conclusão. Sua conclusão continua registrada."
                  style={{
                    display: 'inline-block',
                    marginLeft: 6,
                    padding: '0 6px',
                    borderRadius: 999,
                    background: '#EDF0F5',
                    color: COR.azul,
                    fontSize: 10,
                    fontWeight: 700
                  }}
                >
                  atual: {item.revisaoAtual}
                </span>
              )}
            </div>
          )}
          {item.numero && (
            <div style={{ color: COR.textoSec, overflowWrap: 'anywhere' }}>
              Nº {item.numero}
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', gap: 6 }}>
          {disponivel
            ? (
              <>
                <button
                  type="button"
                  onClick={() => onVisualizar(item)}
                  style={{ ...botao, flex: 1, border: 0, background: COR.verde, color: '#ffffff' }}
                >
                  👁 Visualizar certificado
                </button>
                {item.downloadUrl && (
                  <a
                    href={item.downloadUrl}
                    title="Baixar PDF"
                    aria-label="Baixar PDF"
                    style={{ ...botao, border: `1px solid ${COR.verde}`, background: '#ffffff', color: COR.verde }}
                  >
                    ↓
                  </a>
                )}
              </>
            )
            : (
              <span
                title={item.situacaoArquivo === 'semAcesso'
                  ? 'O PDF foi emitido, mas seu usuário não tem acesso à biblioteca de certificados. Peça acesso ao administrador.'
                  : 'O PDF está sendo gerado. Atualize a página (F5) em alguns minutos.'}
                style={{
                  ...botao,
                  flex: 1,
                  cursor: 'help',
                  background: '#F1F5F9',
                  color: COR.textoSec,
                  fontWeight: 600
                }}
              >
                {item.situacaoArquivo === 'semAcesso' ? '🔒 Sem acesso ao PDF' : '⏳ PDF em geração'}
              </span>
            )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// Visualizador (PDF dentro do portal)
// ------------------------------------------------------------

const Visualizador: React.FC<{
  item?: ICertificado;
  onFechar: () => void;
}> = ({ item, onFechar }) => {

  React.useEffect(() => {
    if (!item) {
      return undefined;
    }
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === 'Escape') {
        onFechar();
      }
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [item, onFechar]);

  if (!item || !item.arquivoUrl) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificado — ${item.treinamento}`}
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        background: 'rgba(11,45,77,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: "'Segoe UI', Arial, sans-serif"
      }}
    >
      <div
        onClick={evento => evento.stopPropagation()}
        style={{
          width: 'min(1100px, 100%)',
          height: 'min(820px, 100%)',
          background: '#ffffff',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,.3)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: `3px solid ${COR.verde}`,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, color: COR.textoSec }}>
              {item.codigo}{item.numero ? ` · Nº ${item.numero}` : ''}
            </span>
            <h2 style={{ margin: 0, fontSize: 16, color: COR.azul, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.treinamento}
            </h2>
          </div>

          {item.downloadUrl && (
            <a href={item.downloadUrl} style={{ ...botao, background: COR.verde, color: '#ffffff' }}>
              ↓ Baixar
            </a>
          )}
          <a
            href={item.arquivoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...botao, border: `1px solid ${COR.borda}`, background: '#ffffff', color: COR.azul }}
          >
            Abrir em nova aba ↗
          </a>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            style={{ ...botao, border: `1px solid ${COR.borda}`, background: '#ffffff', color: COR.azul, fontSize: 16 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, background: '#F1F5F9', position: 'relative' }}>
          <p
            style={{
              position: 'absolute',
              top: '45%',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 12,
              color: COR.textoSec,
              margin: 0
            }}
          >
            Carregando o certificado… Se não aparecer, use “Abrir em nova aba”.
          </p>
          <iframe
            title={`Certificado — ${item.treinamento}`}
            src={item.arquivoUrl}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------

const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'valido', rotulo: 'Válidos' },
  { id: 'vencendo', rotulo: 'A vencer' },
  { id: 'vencido', rotulo: 'Vencidos' }
];

const encaixa = (filtro: Filtro, item: ICertificado): boolean => {
  if (filtro === 'todos') {
    return true;
  }
  const { situacao } = situacaoDe(item);
  if (filtro === 'valido') {
    return situacao === 'valido' || situacao === 'semValidade';
  }
  return situacao === filtro;
};

const CertificadosPage:
  React.FC<ICertificadosPageProps> = ({
    certificados
  }) => {

    const [busca, setBusca] = React.useState<string>('');
    const [filtro, setFiltro] = React.useState<Filtro>('todos');
    const [aberto, setAberto] = React.useState<ICertificado | undefined>(undefined);

    const fechar = React.useCallback((): void => setAberto(undefined), []);

    // Mais recentes primeiro.
    const ordenados = React.useMemo(
      () =>
        certificados
          .slice()
          .sort((a, b) => {
            const da = lerData(a.conclusao);
            const db = lerData(b.conclusao);
            return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
          }),
      [certificados]
    );

    const visiveis = React.useMemo(() => {
      const termo = busca.trim().toLowerCase();
      return ordenados.filter(item =>
        encaixa(filtro, item) &&
        (!termo ||
          `${item.treinamento} ${item.codigo} ${item.numero || ''}`
            .toLowerCase()
            .indexOf(termo) >= 0)
      );
    }, [ordenados, busca, filtro]);

    return (
      <section>
        <PageHeader
          titulo="Certificados"
          subtitulo="Consulte, visualize e baixe os certificados dos treinamentos concluídos."
        />

        {certificados.length === 0 ? (
          <EmptyState
            titulo="Nenhum certificado disponível"
          />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 14
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtrar certificados">
                {FILTROS.map(f => {
                  const ativo = filtro === f.id;
                  const total = certificados.filter(item => encaixa(f.id, item)).length;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setFiltro(f.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: ativo ? 700 : 500,
                        cursor: 'pointer',
                        border: `1px solid ${ativo ? COR.verde : COR.borda}`,
                        background: ativo ? COR.verdeClaro : '#ffffff',
                        color: COR.azul
                      }}
                    >
                      {f.rotulo} ({total})
                    </button>
                  );
                })}
              </div>

              <input
                aria-label="Buscar certificado"
                value={busca}
                onChange={evento => setBusca(evento.target.value)}
                placeholder="Buscar por treinamento, código ou nº…"
                style={{
                  width: 280,
                  maxWidth: '100%',
                  padding: '8px 11px',
                  border: `1px solid ${COR.borda}`,
                  borderRadius: 8,
                  fontSize: 12,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {visiveis.length === 0 ? (
              <p style={{ fontSize: 13, color: COR.textoSec }}>
                Nenhum certificado com este filtro.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 16,
                  alignItems: 'stretch'
                }}
              >
                {visiveis.map(item => (
                  <CertificadoCard
                    key={item.id}
                    item={item}
                    onVisualizar={setAberto}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <Visualizador
          item={aberto}
          onFechar={fechar}
        />
      </section>
    );
  };

export default CertificadosPage;
