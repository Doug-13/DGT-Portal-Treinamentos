import * as React from 'react';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IModuloAdmin,
  ModuloAdminService
} from '../../services/ModuloAdminService';

import {
  AvaliacaoAdminService,
  IAvaliacaoAdmin
} from '../../services/AvaliacaoAdminService';

// ============================================================
// RESUMO DO TREINAMENTO NA ETAPA DO FLUXO
//
// Mostra, de forma visual, o que está sendo elaborado/revisado:
// dados do cadastro, módulos e avaliação — para quem executa a
// etapa (Elaboração, Revisão técnica, Aprovação…) ver o conteúdo
// antes de avançar. Aponta o que ainda falta (ex.: sem módulos,
// avaliação sem questões).
// ============================================================

export interface IResumoTreinamentoFluxoProps {
  treinamento: ITreinamentoAdmin;
  areaNome?: string;
  revisao?: string;
  dataverseService?: DataverseService;

  // Editar dados/módulos/avaliação (só com revisão em andamento).
  onEditar?: () => void;
  onTestar?: () => void;

  // true = começa recolhido (ex.: painel lateral do assistente).
  iniciarRecolhido?: boolean;
}

interface IAvaliacaoResumo {
  avaliacao: IAvaliacaoAdmin;
  questoes: number;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinzaClaro: '#D9D9D6',
  azul10: '#EDF0F5',
  ciano10: '#E6F9FC',
  borda: '#E2E8F0',
  textoSec: '#64748B',
  alerta: '#B45309',
  alertaFundo: '#FFF4E5'
};

const cargaHoraria = (min: number): string => {
  if (!min) {
    return '-';
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${min} min (${h}h${m ? (m < 10 ? `0${m}` : String(m)) : ''})` : `${min} min`;
};

const rotulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.textoSec,
  marginBottom: '4px'
};

const valor: React.CSSProperties = {
  fontSize: '14px',
  color: '#1F2937',
  wordBreak: 'break-word'
};

const campo: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '8px',
  padding: '10px 12px'
};

const botao = (primario: boolean): React.CSSProperties => ({
  border: `1px solid ${COR.azul}`,
  background: primario ? COR.azul : '#FFFFFF',
  color: primario ? '#FFFFFF' : COR.azul,
  borderRadius: '8px',
  padding: '7px 12px',
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
  fontFamily: 'inherit'
});

const ResumoTreinamentoFluxo: React.FC<IResumoTreinamentoFluxoProps> = ({
  treinamento,
  areaNome,
  revisao,
  dataverseService,
  onEditar,
  onTestar,
  iniciarRecolhido = false
}) => {

  const [modulos, setModulos] =
    React.useState<IModuloAdmin[]>([]);

  const [avaliacoes, setAvaliacoes] =
    React.useState<IAvaliacaoResumo[]>([]);

  const [carregando, setCarregando] =
    React.useState(true);

  const [erro, setErro] =
    React.useState('');

  const [aberto, setAberto] =
    React.useState(!iniciarRecolhido);

  React.useEffect(
    () => {
      let ativo = true;

      const carregar = async (): Promise<void> => {
        if (!dataverseService) {
          setCarregando(false);
          return;
        }

        setCarregando(true);
        setErro('');

        try {
          const [listaModulos, listaAvaliacoes] = await Promise.all([
            new ModuloAdminService(dataverseService).listarPorTreinamento(treinamento.id),
            new AvaliacaoAdminService(dataverseService).listarAvaliacoes(treinamento.id)
          ]);

          const servicoAvaliacao = new AvaliacaoAdminService(dataverseService);

          const comQuestoes =
            await Promise.all(
              listaAvaliacoes.map(async avaliacao => ({
                avaliacao,
                questoes: (await servicoAvaliacao.listarQuestoes(avaliacao.id)).length
              }))
            );

          if (ativo) {
            setModulos(
              listaModulos
                .slice()
                .sort((a, b) => a.ordem - b.ordem)
            );
            setAvaliacoes(comQuestoes);
          }
        } catch (e) {
          console.error(e);
          if (ativo) {
            setErro('Não foi possível carregar módulos e avaliação.');
          }
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      };

      carregar().catch(e => console.error(e));

      return () => {
        ativo = false;
      };
    },
    [dataverseService, treinamento.id]
  );

  const modulosAtivos = modulos.filter(item => item.ativo);
  const avaliacaoAtiva = avaliacoes.find(item => item.avaliacao.ativa) || avaliacoes[0];

  // O que ainda falta para o treinamento estar completo.
  const pendencias: string[] = [];

  if (!carregando && !erro) {
    if (!treinamento.descricao || !treinamento.descricao.trim()) {
      pendencias.push('Descrição não preenchida.');
    }
    if (modulosAtivos.length === 0) {
      pendencias.push('Nenhum módulo ativo cadastrado.');
    }
    if (!avaliacaoAtiva) {
      pendencias.push('Nenhuma avaliação cadastrada.');
    } else if (avaliacaoAtiva.questoes === 0) {
      pendencias.push('A avaliação não tem questões.');
    } else if (
      avaliacaoAtiva.avaliacao.quantidadeQuestoes > 0 &&
      avaliacaoAtiva.questoes < avaliacaoAtiva.avaliacao.quantidadeQuestoes
    ) {
      pendencias.push(
        `A avaliação sorteia ${avaliacaoAtiva.avaliacao.quantidadeQuestoes} questões, mas só ${avaliacaoAtiva.questoes} estão cadastradas.`
      );
    }
  }

  return (
    <section
      style={{
        border: `1px solid ${COR.borda}`,
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '14px',
        background: '#FFFFFF'
      }}
    >
      {/* barra */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          padding: '10px 14px',
          background: COR.azul10,
          borderBottom: aberto ? `1px solid ${COR.borda}` : 'none'
        }}
      >
        <div style={{ fontWeight: 700, color: COR.azul, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.03em' }}>
          Treinamento {revisao ? `· ${revisao}` : ''}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onTestar && (
            <button type="button" style={botao(false)} onClick={onTestar}>
              Testar
            </button>
          )}
          {onEditar && (
            <button type="button" style={botao(true)} onClick={onEditar}>
              Editar treinamento
            </button>
          )}
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            style={{ ...botao(false), border: 'none', background: 'transparent', color: COR.indigo }}
          >
            {aberto ? 'Recolher' : 'Mostrar'}
          </button>
        </div>
      </div>

      {aberto && (
        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* pendências do conteúdo */}
          {pendencias.length > 0 && (
            <div style={{ background: COR.alertaFundo, border: `1px solid ${COR.alerta}`, color: '#7C2D12', borderRadius: '8px', padding: '10px 12px', fontSize: '13px' }}>
              <strong>Atenção antes de avançar:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                {pendencias.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* dados do cadastro (mesma organização do formulário) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '10px' }}>
            <div style={campo}>
              <div style={rotulo}>Nome</div>
              <div style={{ ...valor, fontWeight: 700 }}>{treinamento.nome || '-'}</div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Código</div>
              <div style={{ ...valor, fontWeight: 700, color: COR.azul }}>{treinamento.codigo || '-'}</div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Área</div>
              <div style={valor}>{areaNome || '-'}</div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Tipo</div>
              <div style={valor}>TRN - Treinamento</div>
            </div>
          </div>

          <div style={campo}>
            <div style={rotulo}>Descrição</div>
            <div style={{ ...valor, whiteSpace: 'pre-wrap', color: treinamento.descricao ? valor.color : COR.textoSec }}>
              {treinamento.descricao || 'Não preenchida.'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={campo}>
              <div style={rotulo}>Carga horária</div>
              <div style={valor}>{cargaHoraria(treinamento.cargaHorariaMin)}</div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Nota mínima</div>
              <div style={valor}>{treinamento.notaMinima}%</div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Validade</div>
              <div style={valor}>
                {treinamento.validadeMeses > 0 ? `${treinamento.validadeMeses} meses` : 'Sem vencimento'}
              </div>
            </div>
            <div style={campo}>
              <div style={rotulo}>Situação</div>
              <div style={valor}>
                {treinamento.ativo ? 'Ativo' : 'Inativo até a publicação'}
              </div>
            </div>
          </div>

          <div style={{ ...campo, display: 'flex', gap: '12px', alignItems: 'center' }}>
            {treinamento.imagemUrl
              ? (
                <img
                  src={treinamento.imagemUrl}
                  alt=""
                  style={{ width: '96px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${COR.borda}` }}
                />
              )
              : (
                <div style={{ width: '96px', height: '60px', borderRadius: '6px', background: COR.azul, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                  {(treinamento.codigo || 'TRN').split('-').slice(0, 2).join('-')}
                </div>
              )}
            <div>
              <div style={rotulo}>Imagem do treinamento</div>
              <div style={{ ...valor, fontSize: '12px', color: COR.textoSec }}>
                {treinamento.imagemUrl || 'Sem imagem (usa a capa padrão).'}
              </div>
            </div>
          </div>

          {/* módulos */}
          <div style={campo}>
            <div style={{ ...rotulo, display: 'flex', justifyContent: 'space-between' }}>
              <span>Módulos ({modulosAtivos.length})</span>
              {modulosAtivos.length > 0 && (
                <span>
                  Duração total: {modulosAtivos.reduce((soma, item) => soma + (item.duracaoMin || 0), 0)} min
                </span>
              )}
            </div>

            {carregando && <div style={{ ...valor, color: COR.textoSec }}>Carregando...</div>}
            {erro && <div style={{ ...valor, color: COR.alerta }}>{erro}</div>}

            {!carregando && !erro && modulosAtivos.length === 0 && (
              <div style={{ ...valor, color: COR.textoSec }}>Nenhum módulo.</div>
            )}

            {!carregando && modulosAtivos.length > 0 && (
              <ol style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: 1.7 }}>
                {modulosAtivos.map(item => (
                  <li key={item.id}>
                    <strong>{item.titulo}</strong>
                    <span style={{ color: COR.textoSec }}>
                      {' · '}{item.tipoModulo}
                      {item.duracaoMin ? ` · ${item.duracaoMin} min` : ''}
                      {item.obrigatorio ? '' : ' · opcional'}
                    </span>
                    {item.urlConteudo && (
                      <>
                        {' · '}
                        <a href={item.urlConteudo} target="_blank" rel="noopener noreferrer">abrir</a>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* avaliação */}
          <div style={campo}>
            <div style={rotulo}>Avaliação</div>

            {!carregando && !erro && !avaliacaoAtiva && (
              <div style={{ ...valor, color: COR.textoSec }}>Nenhuma avaliação.</div>
            )}

            {!carregando && avaliacaoAtiva && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '13px' }}>
                <div><span style={{ color: COR.textoSec }}>Nome: </span><strong>{avaliacaoAtiva.avaliacao.nome || '-'}</strong></div>
                <div><span style={{ color: COR.textoSec }}>Questões cadastradas: </span><strong>{avaliacaoAtiva.questoes}</strong></div>
                <div>
                  <span style={{ color: COR.textoSec }}>Sorteio: </span>
                  <strong>
                    {avaliacaoAtiva.avaliacao.sortearQuestoes && avaliacaoAtiva.avaliacao.quantidadeQuestoes > 0
                      ? `${avaliacaoAtiva.avaliacao.quantidadeQuestoes} por tentativa`
                      : 'todas'}
                  </strong>
                </div>
                <div><span style={{ color: COR.textoSec }}>Nota mínima: </span><strong>{avaliacaoAtiva.avaliacao.notaMinima}%</strong></div>
                <div>
                  <span style={{ color: COR.textoSec }}>Tentativas: </span>
                  <strong>{avaliacaoAtiva.avaliacao.tentativasPermitidas || 'ilimitadas'}</strong>
                </div>
                <div>
                  <span style={{ color: COR.textoSec }}>Tempo: </span>
                  <strong>{avaliacaoAtiva.avaliacao.tempoLimiteMin ? `${avaliacaoAtiva.avaliacao.tempoLimiteMin} min` : 'sem limite'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ResumoTreinamentoFluxo;
