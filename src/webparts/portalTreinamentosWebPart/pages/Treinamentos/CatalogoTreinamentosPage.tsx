import * as React from 'react';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

// ============================================================
// CATÁLOGO DE TREINAMENTOS (administração)
//
// Mostra todos os treinamentos criados, na forma de cartões, e
// permite abrir cada um no MODO DE TESTE: o administrador percorre
// módulos e avaliação como um colaborador, sem gerar registros nem
// certificado.
// ============================================================

export interface ICatalogoTreinamentosPageProps {
  treinamentos: ITreinamentoAdmin[];
  carregando: boolean;
  erro: string;
  onTestar: (treinamento: ITreinamentoAdmin) => void;
}

type Filtro = 'ativos' | 'inativos' | 'todos';

const C = {
  azul: '#0B5CAB',
  azulEscuro: '#0B2D4D',
  branco: '#FFFFFF',
  texto: '#18324A',
  secundario: '#66788A',
  borda: '#D8E2EC',
  fundo: '#F6F9FC',
  verde: '#13795B',
  verdeClaro: '#E7F5EE',
  cinzaClaro: '#EEF2F6',
  vermelho: '#B42318',
  vermelhoClaro: '#FDE7E9'
};

const formatarCarga = (
  minutos: number
): string => {
  if (!minutos) {
    return '—';
  }

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (!horas) {
    return `${resto} min`;
  }

  return resto
    ? `${horas}h${resto < 10 ? '0' : ''}${resto}`
    : `${horas}h`;
};

const Capa: React.FC<{ url: string; codigo: string }> = ({ url, codigo }) => {
  const [erro, setErro] = React.useState(false);

  if (url && !erro) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setErro(true)}
        style={{ width: '100%', height: '130px', objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <div
      style={{
        height: '130px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${C.azulEscuro}, ${C.azul})`,
        color: C.branco,
        fontWeight: 700,
        letterSpacing: '1px'
      }}
    >
      {codigo || 'TREINAMENTO'}
    </div>
  );
};

const CatalogoTreinamentosPage: React.FC<ICatalogoTreinamentosPageProps> = (
  props
) => {

  const [pesquisa, setPesquisa] = React.useState('');
  const [filtro, setFiltro] = React.useState<Filtro>('ativos');

  const lista =
    React.useMemo(
      () => {
        const termo = pesquisa.trim().toLowerCase();

        return props.treinamentos
          .filter(t =>
            filtro === 'todos' ||
            (filtro === 'ativos' ? t.ativo : !t.ativo)
          )
          .filter(t =>
            !termo ||
            t.nome.toLowerCase().indexOf(termo) >= 0 ||
            (t.codigo || '').toLowerCase().indexOf(termo) >= 0 ||
            (t.descricao || '').toLowerCase().indexOf(termo) >= 0
          )
          .sort((a, b) => (a.codigo || a.nome).localeCompare(b.codigo || b.nome, 'pt-BR'));
      },
      [filtro, pesquisa, props.treinamentos]
    );

  const contagem = (f: Filtro): number =>
    props.treinamentos.filter(t =>
      f === 'todos' || (f === 'ativos' ? t.ativo : !t.ativo)
    ).length;

  return (
    <section style={{ color: C.texto }}>

      <div style={{ marginBottom: '18px' }}>
        <h1 style={{ margin: '0 0 4px', color: C.azulEscuro, fontSize: '26px' }}>
          Catálogo de treinamentos
        </h1>
        <p style={{ margin: 0, color: C.secundario, fontSize: '14px' }}>
          Todos os treinamentos criados. Use <strong>Testar</strong> para percorrer o treinamento
          e a avaliação como um colaborador — sem gerar registros nem certificado.
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '18px'
        }}
      >
        <input
          value={pesquisa}
          onChange={e => setPesquisa(e.target.value)}
          placeholder="Pesquisar por nome, código ou descrição..."
          style={{
            flex: '1 1 280px',
            padding: '10px 12px',
            border: `1px solid ${C.borda}`,
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />

        {(['ativos', 'inativos', 'todos'] as Filtro[]).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: `1px solid ${filtro === f ? C.azulEscuro : C.borda}`,
              background: filtro === f ? C.azulEscuro : C.branco,
              color: filtro === f ? C.branco : C.texto,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {f === 'ativos' ? 'Ativos' : f === 'inativos' ? 'Inativos' : 'Todos'} ({contagem(f)})
          </button>
        ))}
      </div>

      {props.erro && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', background: C.vermelhoClaro, color: C.vermelho, fontSize: '13px' }}>
          {props.erro}
        </div>
      )}

      {props.carregando && (
        <div style={{ color: C.secundario }}>Carregando treinamentos...</div>
      )}

      {!props.carregando && lista.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', background: C.branco, border: `1px solid ${C.borda}`, borderRadius: '12px', color: C.secundario }}>
          Nenhum treinamento encontrado.
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px'
        }}
      >
        {lista.map(t => (
          <article
            key={t.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: C.branco,
              border: `1px solid ${C.borda}`,
              borderRadius: '14px',
              overflow: 'hidden',
              opacity: t.ativo ? 1 : 0.8
            }}
          >
            <Capa url={t.imagemUrl} codigo={t.codigo} />

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.secundario }}>
                  {t.codigo}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    background: t.ativo ? C.verdeClaro : C.cinzaClaro,
                    color: t.ativo ? C.verde : C.secundario
                  }}
                >
                  {t.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <strong style={{ fontSize: '15px', color: C.azulEscuro, lineHeight: 1.35 }}>
                {t.nome}
              </strong>

              <p
                title={t.descricao}
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: C.secundario,
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                } as React.CSSProperties}
              >
                {t.descricao || 'Sem descrição.'}
              </p>

              <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: C.secundario, marginTop: 'auto', paddingTop: '6px' }}>
                <span>⏱ {formatarCarga(t.cargaHorariaMin)}</span>
                <span>🎯 {t.notaMinima}%</span>
                <span>📅 {t.validadeMeses ? `${t.validadeMeses} meses` : 'Sem validade'}</span>
              </div>

              <button
                type="button"
                onClick={() => props.onTestar(t)}
                style={{
                  marginTop: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#1677ff',
                  color: C.branco,
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                ▶ Testar como colaborador
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default CatalogoTreinamentosPage;
