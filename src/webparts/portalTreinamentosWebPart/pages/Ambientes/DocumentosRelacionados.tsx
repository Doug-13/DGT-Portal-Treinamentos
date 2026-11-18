import * as React from 'react';

import {
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

import {
  IValorDocumento
} from '../../services/fluxo/valorDocumento';

import {
  COR,
  formatarData
} from '../Orcamento/orcamentoComum';

// ============================================================
// DOCUMENTOS RELACIONADOS (coluna da esquerda do registro)
//
// Lista os campos "Documento(s) referenciado(s)" preenchidos — ex.:
// os RNC criados pelo subprocesso da Auditoria — como cartões
// clicáveis. Cada referência é resolvida para mostrar a situação atual:
//   registro de ambiente → ambiente, situação e etapa atual; abre o
//                          registro (no mesmo ou em outro ambiente)
//   documento            → abre em Documentos
// O texto gravado no campo (código e título) é usado enquanto carrega
// e quando a referência não pode ser lida (ex.: sem acesso).
// Registro criado por subprocesso: o grupo "Originado por" (primeiro)
// leva ao registro pai; o pai lista os filhos no campo de referências.
// ============================================================

export interface IReferenciaResolvida {
  tipo: 'registro' | 'documento';
  id: string;
  codigo: string;
  titulo: string;
  // tipo = 'registro'
  ambienteNome?: string;
  ambienteChave?: string;
  mesmoAmbiente?: boolean;
  situacao?: SituacaoRegistroAmbiente;
  etapaAtual?: string;
  prazoEtapa?: string;
  concluidoEm?: string;
}

export interface IGrupoDocumentosRelacionados {
  chave: string;
  rotulo: string;
  documentos: IValorDocumento[];
  // true = o registro/documento que originou este (subprocesso).
  origem?: boolean;
}

export interface IDocumentosRelacionadosProps {
  grupos: IGrupoDocumentosRelacionados[];
  // Código deste registro: tirado do começo dos títulos ("AUD-2026-0002 —
  // RNC item 4" vira "RNC item 4"), porque aqui ele é redundante.
  codigoRegistro: string;
  // Lê a situação atual das referências (sem isso: só o texto gravado).
  resolver?: (ids: string[]) => Promise<IReferenciaResolvida[]>;
  // Abre a referência (sem isso: os cartões não são clicáveis).
  onAbrir?: (referencia: IReferenciaResolvida) => void;
}

const SITUACAO: Record<SituacaoRegistroAmbiente, { texto: string; cor: string; fundo: string }> = {
  emAndamento: { texto: 'Em andamento', cor: '#0F4C81', fundo: '#E8F2FF' },
  concluido: { texto: 'Concluído', cor: '#107C10', fundo: '#E7F6EC' },
  cancelado: { texto: 'Cancelado', cor: '#64748B', fundo: '#F1F5F9' }
};

// Visual base do cartão é INLINE: a regra global ".content button" do
// portal (fundo azul-escuro, texto branco) vence uma classe simples.
// Aqui só a interação, com !important pelo mesmo motivo.
const CSS = `
.dgt-docrel-clicavel:hover { background: #F7F9FB !important; border-color: #CBD5E1 !important; }
.dgt-docrel-item:focus-visible { outline: 2px solid ${COR.azulAcao}; outline-offset: 2px; }
.dgt-docrel-seta { flex-shrink: 0; align-self: center; color: #94A3B8; font-size: 18px; line-height: 1; transition: color .15s, transform .15s; }
.dgt-docrel-clicavel:hover .dgt-docrel-seta { color: ${COR.azulAcao}; transform: translateX(2px); }
.dgt-docrel-titulo { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
`;

const estiloCartao: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  width: '100%',
  margin: 0,
  padding: '9px 10px 9px 12px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  background: '#FFFFFF',
  color: COR.azul,
  textAlign: 'left',
  font: 'inherit',
  fontWeight: 400,
  lineHeight: 1.35,
  boxShadow: 'none',
  transition: 'background .15s, border-color .15s'
};

const tirarPrefixo = (titulo: string, codigo: string): string => {
  const limpo = (titulo || '').trim();
  if (!codigo || limpo.indexOf(codigo) !== 0) {
    return limpo;
  }
  const resto = limpo.slice(codigo.length).replace(/^\s*[—–-]\s*/, '').trim();
  return resto || limpo;
};

const DocumentosRelacionados: React.FC<IDocumentosRelacionadosProps> = (props) => {

  const ids =
    props.grupos
      .reduce((lista, grupo) => lista.concat(grupo.documentos.map(doc => doc.id)), [] as string[])
      .filter((id, indice, lista) => lista.indexOf(id) === indice);

  const chaveIds = ids.join('|');

  const [resolvidos, setResolvidos] = React.useState<Record<string, IReferenciaResolvida>>({});
  const [carregando, setCarregando] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    if (!props.resolver || ids.length === 0) {
      setResolvidos({});
      return undefined;
    }
    setCarregando(true);
    props.resolver(ids)
      .then(lista => {
        if (!ativo) {
          return;
        }
        const mapa: Record<string, IReferenciaResolvida> = {};
        lista.forEach(item => { mapa[item.id] = item; });
        setResolvidos(mapa);
      })
      .catch(erro => console.warn('[Documentos relacionados]', erro))
      .then(() => { if (ativo) { setCarregando(false); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [chaveIds]);

  const total = ids.length;

  if (total === 0) {
    return null;
  }

  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COR.borda}`, borderRadius: '12px', padding: '14px 14px 12px' }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <strong style={{ fontSize: '14px', color: COR.azul }}>Documentos relacionados</strong>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F4C81', background: '#E8F2FF', borderRadius: '999px', padding: '1px 8px' }}>
          {total}
        </span>
      </div>

      {props.grupos.map(grupo => (
        <section key={grupo.chave} style={{ marginBottom: '10px' }} aria-label={grupo.rotulo}>
          <div style={{ fontSize: '11.5px', color: COR.texto2, fontWeight: 700, marginBottom: '6px', lineHeight: 1.35 }}>
            {grupo.origem ? '↑ ' : ''}{grupo.rotulo}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {grupo.documentos.map(doc => {
              const ref = resolvidos[doc.id];
              const codigo = (ref && ref.codigo) || doc.codigo || 'Sem código';
              const titulo = tirarPrefixo((ref && ref.titulo) || doc.titulo, props.codigoRegistro);
              const situacao = ref && ref.tipo === 'registro' && ref.situacao ? SITUACAO[ref.situacao] : undefined;
              const semAcesso = !carregando && !!props.resolver && !ref;
              // Sem leitura da referência, tenta abrir como documento.
              const alvo: IReferenciaResolvida = ref || { tipo: 'documento', id: doc.id, codigo, titulo };
              const clicavel = !!props.onAbrir;

              const detalhe =
                carregando && !ref
                  ? 'Carregando situação…'
                  : ref && ref.tipo === 'registro'
                    ? [
                      ref.mesmoAmbiente ? '' : ref.ambienteNome,
                      ref.situacao === 'emAndamento' && ref.etapaAtual ? `Etapa: ${ref.etapaAtual}` : '',
                      ref.situacao === 'emAndamento' && ref.prazoEtapa ? `prazo ${formatarData(ref.prazoEtapa)}` : '',
                      ref.situacao === 'concluido' && ref.concluidoEm ? `em ${formatarData(ref.concluidoEm)}` : ''
                    ].filter(Boolean).join(' · ')
                    : ref && ref.tipo === 'documento'
                      ? 'Documento'
                      : semAcesso
                        ? 'Não foi possível ler a situação (sem acesso ou removido).'
                        : '';

              const classes = clicavel ? 'dgt-docrel-item dgt-docrel-clicavel' : 'dgt-docrel-item';

              const conteudo = (
                <>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, color: COR.azul, letterSpacing: '.2px' }}>{codigo}</span>
                      {situacao && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: situacao.cor, background: situacao.fundo, borderRadius: '999px', padding: '1px 7px' }}>
                          {situacao.texto}
                        </span>
                      )}
                    </span>
                    {titulo && titulo !== codigo && (
                      <span className="dgt-docrel-titulo" style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.35 }} title={titulo}>
                        {titulo}
                      </span>
                    )}
                    {detalhe && (
                      <span style={{ fontSize: '11.5px', color: COR.texto2, lineHeight: 1.35 }}>{detalhe}</span>
                    )}
                  </span>
                  {clicavel && <span className="dgt-docrel-seta" aria-hidden="true">›</span>}
                </>
              );

              return clicavel
                ? (
                  <button
                    key={doc.id}
                    type="button"
                    className={classes}
                    style={{ ...estiloCartao, cursor: 'pointer' }}
                    data-referencia={codigo}
                    title={ref && ref.tipo === 'registro' && !ref.mesmoAmbiente && ref.ambienteNome ? `Abrir ${codigo} em ${ref.ambienteNome}` : `Abrir ${codigo}`}
                    onClick={() => props.onAbrir && props.onAbrir(alvo)}
                  >
                    {conteudo}
                  </button>
                )
                : (
                  <div key={doc.id} className={classes} style={estiloCartao} data-referencia={codigo}>{conteudo}</div>
                );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DocumentosRelacionados;
