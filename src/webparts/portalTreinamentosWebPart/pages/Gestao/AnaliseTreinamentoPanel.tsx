import * as React from 'react';

import {
  IDocumento,
  IDocumentoRevisao
} from '../../models/Documento';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  DocumentoService
} from '../../services/DocumentoService';

import {
  SharePointDocumentoService
} from '../../services/sharepoint/SharePointDocumentoService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  obterRevisaoEmAndamento,
  obterRevisaoVigente
} from '../../services/DocumentoRevisaoFluxoService';

import {
  useDocumentoRevisaoFluxo
} from '../../hooks/useDocumentoRevisaoFluxo';

import FluxoRevisaoTab from
  '../Documentos/FluxoRevisaoTab';

import ResumoTreinamentoFluxo from
  './ResumoTreinamentoFluxo';

import ConteudoRevisaoTreinamentoModal, {
  SituacaoConteudoRevisao
} from './ConteudoRevisaoTreinamentoModal';

import {
  IConteudoRevisaoTreinamento,
  TreinamentoConteudoRevisaoService
} from '../../services/TreinamentoConteudoRevisaoService';

import {
  compararRevisoes
} from '../../utils/numeracaoRevisao';

// ============================================================
// ANÁLISE DO TREINAMENTO — fluxo de revisão DENTRO da Gestão de
// treinamentos.
//
// O treinamento é controlado por um documento (mesmo código, tipo
// TRN), mas quem cuida de treinamentos trabalha aqui: vê a etapa
// atual do fluxo, conclui a etapa (se for o responsável), anexa
// arquivos, abre nova revisão, edita/testa o conteúdo e consulta as
// revisões anteriores — sem ir para o módulo Documentos.
// ============================================================

export interface IAnaliseTreinamentoPanelProps {
  treinamento: ITreinamentoAdmin;
  documento: IDocumento;

  contexto?: IContextoAcesso;
  dataverseService?: DataverseService;
  sharePointDocumentoService?: SharePointDocumentoService;

  onVoltar: () => void;

  // Chamado depois de qualquer ação do fluxo (para a Gestão
  // atualizar status, revisões e pendências).
  onAlterado?: () => Promise<void>;

  onEditarConteudo?: (treinamento: ITreinamentoAdmin) => Promise<void>;
  onTestarTreinamento?: (treinamento: ITreinamentoAdmin) => void;
  onAbrirProcesso?: (processoId: string) => void;
}

const COR = {
  azul: '#202A44',
  ciano: '#05C3DD',
  indigo: '#485CC7',
  cinza: '#888B8D',
  cinzaClaro: '#D9D9D6',
  ciano10: '#E6F9FC',
  azul10: '#EDF0F5',
  indigo10: '#E8EAF8',
  texto: '#1F2937',
  textoSec: '#64748B',
  borda: '#E2E8F0',
  erro: '#B42318',
  erroFundo: '#FDECEC',
  sucesso: '#15803D',
  sucessoFundo: '#E7F5EE'
};

type Aba = 'fluxo' | 'revisoes';

const data = (valor?: string): string => {
  if (!valor) {
    return '-';
  }
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
};

const cartao: React.CSSProperties = {
  background: '#FFFFFF',
  border: `1px solid ${COR.borda}`,
  borderRadius: '12px',
  padding: '18px 20px'
};

const botao = (primario: boolean, desabilitado?: boolean): React.CSSProperties => ({
  border: `1px solid ${COR.azul}`,
  background: primario ? COR.azul : '#FFFFFF',
  color: primario ? '#FFFFFF' : COR.azul,
  borderRadius: '8px',
  padding: '8px 14px',
  fontWeight: 700,
  fontSize: '13px',
  cursor: desabilitado ? 'default' : 'pointer',
  opacity: desabilitado ? 0.5 : 1,
  fontFamily: 'inherit'
});

const rotulo: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: COR.textoSec,
  marginBottom: '4px'
};

const AnaliseTreinamentoPanel: React.FC<IAnaliseTreinamentoPanelProps> = ({
  treinamento,
  documento,
  contexto,
  dataverseService,
  sharePointDocumentoService,
  onVoltar,
  onAlterado,
  onEditarConteudo,
  onTestarTreinamento,
  onAbrirProcesso
}) => {

  const [revisoes, setRevisoes] =
    React.useState<IDocumentoRevisao[]>([]);

  const [carregando, setCarregando] =
    React.useState(true);

  const [erroCarga, setErroCarga] =
    React.useState('');

  const [aba, setAba] =
    React.useState<Aba>('fluxo');

  // Versão do fluxo: força a aba do fluxo a reler a instância depois
  // de criar revisão.
  const [versaoFluxo, setVersaoFluxo] =
    React.useState(0);

  const [novaAberta, setNovaAberta] =
    React.useState(false);

  // Desenho completo do fluxo (abre sob demanda).
  const [verDesenho, setVerDesenho] =
    React.useState(false);

  const [motivo, setMotivo] =
    React.useState('');

  const [alteracoes, setAlteracoes] =
    React.useState('');

  const documentoService =
    React.useMemo(
      () => dataverseService ? new DocumentoService(dataverseService) : undefined,
      [dataverseService]
    );

  const carregarRevisoes =
    React.useCallback(
      async (): Promise<void> => {
        if (!documentoService) {
          setCarregando(false);
          setErroCarga('Dataverse indisponível nesta tela.');
          return;
        }
        setCarregando(true);
        setErroCarga('');
        try {
          setRevisoes(await documentoService.getRevisoesDocumento(documento.id));
        } catch (erro) {
          setErroCarga(erro instanceof Error ? erro.message : 'Não foi possível carregar as revisões.');
        } finally {
          setCarregando(false);
        }
      },
      [documentoService, documento.id]
    );

  React.useEffect(
    () => {
      carregarRevisoes().catch(erro => console.error(erro));
    },
    [carregarRevisoes]
  );

  const aoAlterar =
    React.useCallback(
      async (): Promise<void> => {
        await carregarRevisoes();
        setVersaoFluxo(atual => atual + 1);
        if (onAlterado) {
          await onAlterado();
        }
      },
      [carregarRevisoes, onAlterado]
    );

  const usuarioFluxo =
    React.useMemo(
      () => ({
        id: contexto?.usuarioId || '',
        nome: contexto?.nome || contexto?.email || ''
      }),
      [contexto]
    );

  const fluxo =
    useDocumentoRevisaoFluxo(
      dataverseService,
      sharePointDocumentoService,
      documento,
      revisoes,
      usuarioFluxo,
      aoAlterar
    );

  const vigente = obterRevisaoVigente(revisoes);
  const andamento = obterRevisaoEmAndamento(revisoes);

  const revisoesOrdenadas =
    revisoes
      .slice()
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));

  const criarNovaRevisao = (): void => {
    // Antes de qualquer alteração: registra o conteúdo da revisão
    // vigente, se ainda não tiver (para consulta quando ficar obsoleta).
    const registrarVigente =
      vigente && dataverseService
        ? (async (): Promise<void> => {
          const servico = new TreinamentoConteudoRevisaoService(dataverseService);
          if (!(await servico.possui(vigente.id))) {
            await servico.registrar(vigente.id, treinamento.id, vigente.revisao);
          }
        })()
        : Promise.resolve();

    registrarVigente
      .catch(erro => console.error(erro))
      .then(() => fluxo.criarNovaRevisao({
        motivoAlteracao: motivo,
        descricaoAlteracoes: alteracoes
      }))
      .then(ok => {
        if (ok) {
          setNovaAberta(false);
          setMotivo('');
          setAlteracoes('');
          setAba('fluxo');
        }
      })
      .catch(erro => console.error(erro));
  };

  // ---------------- Revisões: situação e consulta ----------------

  const ehVigenteEstagio = (revisao: IDocumentoRevisao): boolean =>
    /vigente/i.test(revisao.status || '');

  // Vigente atual (a última publicada); as outras publicadas são obsoletas.
  const situacaoDe = (revisao: IDocumentoRevisao): SituacaoConteudoRevisao =>
    ehVigenteEstagio(revisao)
      ? (vigente && vigente.id === revisao.id ? 'vigente' : 'obsoleta')
      : 'rascunho';

  // A vigente que tornou esta obsoleta: a publicada de menor número acima dela.
  const substitutaDe = (revisao: IDocumentoRevisao): IDocumentoRevisao | undefined =>
    revisoes
      .filter(item => ehVigenteEstagio(item) && compararRevisoes(item.revisao, revisao.revisao) > 0)
      .sort((a, b) => compararRevisoes(a.revisao, b.revisao))[0];

  const [consulta, setConsulta] =
    React.useState<{
      revisao: IDocumentoRevisao;
      carregando: boolean;
      erro?: string;
      conteudo?: IConteudoRevisaoTreinamento;
    } | undefined>(undefined);

  const verConteudo = (revisao: IDocumentoRevisao): void => {
    if (!dataverseService) {
      return;
    }

    setConsulta({ revisao, carregando: true });

    const servico = new TreinamentoConteudoRevisaoService(dataverseService);

    // Revisão em andamento: o conteúdo atual (ainda não registrado).
    const carregar =
      situacaoDe(revisao) === 'rascunho'
        ? servico.gerar(treinamento.id, revisao.revisao)
        : servico.ler(revisao.id);

    carregar
      .then(lido => {
        if (lido === 'semColuna') {
          setConsulta({
            revisao,
            carregando: false,
            erro: 'O registro do conteúdo das revisões ainda não foi configurado: execute scripts/dataverse/criar-coluna-conteudo-revisao.ps1.'
          });
          return;
        }
        setConsulta({ revisao, carregando: false, conteudo: lido });
      })
      .catch(erro => setConsulta({
        revisao,
        carregando: false,
        erro: erro instanceof Error ? erro.message : 'Não foi possível carregar o conteúdo da revisão.'
      }));
  };

  // Vigente sem registro e sem revisão aberta: registra o conteúdo atual.
  const [registrando, setRegistrando] =
    React.useState(false);

  const registrarConteudoVigente = (): void => {
    if (!vigente || !dataverseService) {
      return;
    }
    setRegistrando(true);
    new TreinamentoConteudoRevisaoService(dataverseService)
      .registrar(vigente.id, treinamento.id, vigente.revisao)
      .then(aviso => {
        if (aviso) {
          window.alert(aviso);
        } else {
          verConteudo(vigente);
        }
      })
      .catch(erro => console.error(erro))
      .then(() => setRegistrando(false))
      .catch(() => undefined);
  };

  const podeEditarConteudo = !!andamento && !!onEditarConteudo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ------------------------------------------------ cabeçalho */}
      <div style={{ ...cartao, borderLeft: `4px solid ${COR.ciano}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...rotulo, color: COR.indigo }}>Análise do treinamento</div>
            <h2 style={{ margin: 0, color: COR.azul, fontSize: '20px' }}>
              {treinamento.codigo} — {treinamento.nome}
            </h2>
            <div style={{ color: COR.textoSec, fontSize: '13px', marginTop: '4px' }}>
              {treinamento.ativo
                ? 'Ativo: pode ser usado em trilhas e atribuições.'
                : 'Inativo até a publicação da revisão pelo fluxo.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {onTestarTreinamento && (
              <button
                type="button"
                style={botao(false)}
                onClick={() => onTestarTreinamento(treinamento)}
                title="Executar o treinamento como colaborador (sem gravar conclusão)"
              >
                Testar
              </button>
            )}

            {onEditarConteudo && (
              <button
                type="button"
                style={botao(false, !podeEditarConteudo)}
                disabled={!podeEditarConteudo}
                onClick={() => { void onEditarConteudo(treinamento); }}
                title={
                  podeEditarConteudo
                    ? `Alterar dados, módulos e avaliação dentro da ${andamento ? andamento.revisao : 'revisão'}`
                    : 'Abra uma nova revisão para alterar o conteúdo'
                }
              >
                Editar conteúdo
              </button>
            )}

            <button type="button" style={botao(true)} onClick={onVoltar}>
              Voltar à Gestão
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
            marginTop: '16px'
          }}
        >
          <div>
            <div style={rotulo}>Revisão vigente</div>
            <div style={{ fontWeight: 700, color: COR.azul }}>
              {vigente ? vigente.revisao : 'Ainda não publicada'}
            </div>
          </div>
          <div>
            <div style={rotulo}>Revisão em andamento</div>
            <div style={{ fontWeight: 700, color: andamento ? COR.indigo : COR.textoSec }}>
              {andamento ? `${andamento.revisao} · ${andamento.status || 'Elaboração'}` : 'Nenhuma'}
            </div>
          </div>
          <div>
            <div style={rotulo}>Responsável pelo treinamento</div>
            <div>{documento.responsavel || '-'}</div>
          </div>
          <div>
            <div style={rotulo}>Área</div>
            <div>{documento.area || '-'}</div>
          </div>
          <div>
            <div style={rotulo}>Próxima revisão periódica</div>
            <div>{data(documento.prazoRevisao)}</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ mensagens */}
      {(fluxo.erro || erroCarga) && (
        <div style={{ ...cartao, background: COR.erroFundo, borderColor: COR.erroFundo, color: COR.erro, padding: '12px 16px' }}>
          {fluxo.erro || erroCarga}
        </div>
      )}

      {fluxo.aviso && (
        <div style={{ ...cartao, background: COR.sucessoFundo, borderColor: COR.sucessoFundo, color: COR.sucesso, padding: '12px 16px' }}>
          {fluxo.aviso}
        </div>
      )}

      {/* ------------------------------------------------ nova revisão */}
      {!carregando && !andamento && (
        <div style={{ ...cartao, background: COR.azul10 }}>
          {!novaAberta && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ color: COR.texto, fontSize: '14px' }}>
                <strong>Nenhuma revisão em andamento.</strong> Para alterar o treinamento, abra uma nova
                revisão: ela segue o fluxo do processo (responsáveis, prazos e decisão de retreinamento).
              </div>
              <button type="button" style={botao(true)} onClick={() => setNovaAberta(true)}>
                Nova revisão
              </button>
            </div>
          )}

          {novaAberta && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 700, color: COR.azul }}>Nova revisão do treinamento</div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={rotulo}>Motivo da alteração *</span>
                <input
                  value={motivo}
                  maxLength={100}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex.: atualização da NR, mudança no procedimento, melhoria da avaliação"
                  style={{ padding: '9px 10px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '8px', fontFamily: 'inherit' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={rotulo}>Alterações previstas *</span>
                <textarea
                  value={alteracoes}
                  rows={3}
                  onChange={e => setAlteracoes(e.target.value)}
                  placeholder="O que será alterado nos dados, módulos ou avaliação"
                  style={{ padding: '9px 10px', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '8px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" style={botao(false)} onClick={() => setNovaAberta(false)} disabled={fluxo.processando}>
                  Cancelar
                </button>
                <button
                  type="button"
                  style={botao(true, fluxo.processando || !motivo.trim() || !alteracoes.trim())}
                  disabled={fluxo.processando || !motivo.trim() || !alteracoes.trim()}
                  onClick={criarNovaRevisao}
                >
                  {fluxo.processando ? 'Criando...' : 'Criar revisão'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------ abas */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${COR.borda}` }}>
        {([
          ['fluxo', 'Fluxo de revisão'],
          ['revisoes', `Revisões (${revisoes.length})`]
        ] as Array<[Aba, string]>).map(([chave, texto]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setAba(chave)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              color: aba === chave ? COR.azul : COR.textoSec,
              borderBottom: aba === chave ? `3px solid ${COR.ciano}` : '3px solid transparent',
              fontFamily: 'inherit'
            }}
          >
            {texto}
          </button>
        ))}
      </div>

      {carregando && (
        <div style={{ ...cartao, color: COR.textoSec }}>Carregando revisões...</div>
      )}

      {!carregando && aba === 'fluxo' && (
        <div style={cartao}>
          {andamento || vigente
            ? (
              <>
                {/* O que está sendo elaborado/revisado. */}
                <ResumoTreinamentoFluxo
                  treinamento={treinamento}
                  areaNome={documento.area}
                  revisao={andamento ? andamento.revisao : vigente ? vigente.revisao : undefined}
                  dataverseService={dataverseService}
                />

                {/* Etapa atual com os botões de ação (modo compacto). */}
                {andamento && (
                  <FluxoRevisaoTab
                    key={`etapa-${documento.id}-${versaoFluxo}`}
                    compacto
                    documento={documento}
                    revisoes={revisoes}
                    contexto={contexto}
                    dataverseService={dataverseService}
                    onAbrirProcesso={onAbrirProcesso}
                    onRevisaoAlterada={aoAlterar}
                    onVerFluxoCompleto={() => setVerDesenho(true)}
                    onAnexarArquivo={sharePointDocumentoService ? fluxo.anexarArquivo : undefined}
                    erroAnexo={fluxo.erro}
                  />
                )}

                <div style={{ marginTop: andamento ? '14px' : 0 }}>
                  <button
                    type="button"
                    onClick={() => setVerDesenho(!verDesenho)}
                    style={{ border: 'none', background: 'transparent', color: COR.indigo, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                  >
                    {verDesenho ? 'Ocultar desenho do fluxo' : 'Ver desenho do fluxo e histórico'}
                  </button>

                  {verDesenho && (
                    <div style={{ marginTop: '10px' }}>
                      <FluxoRevisaoTab
                        key={`desenho-${documento.id}-${versaoFluxo}`}
                        documento={documento}
                        revisoes={revisoes}
                        contexto={contexto}
                        dataverseService={dataverseService}
                        onAbrirProcesso={onAbrirProcesso}
                        onRevisaoAlterada={aoAlterar}
                      />
                    </div>
                  )}
                </div>
              </>
            )
            : (
              <div style={{ color: COR.textoSec }}>
                Este treinamento ainda não tem revisão registrada.
              </div>
            )}
        </div>
      )}

      {!carregando && aba === 'revisoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {revisoesOrdenadas.length === 0 && (
            <div style={{ ...cartao, color: COR.textoSec }}>Nenhuma revisão.</div>
          )}

          {revisoesOrdenadas.map(revisao => {
            const situacao = situacaoDe(revisao);
            const obsoleta = situacao === 'obsoleta';
            const substituta = obsoleta ? substitutaDe(revisao) : undefined;

            const selo =
              situacao === 'vigente'
                ? { texto: 'Vigente', cor: '#107C10', fundo: '#E7F6EC' }
                : obsoleta
                  ? { texto: 'Obsoleta', cor: COR.erro, fundo: '#FDE7E9' }
                  : { texto: revisao.status || 'Em elaboração', cor: COR.indigo, fundo: COR.indigo10 };

            return (
              <div
                key={revisao.id}
                style={{
                  ...cartao,
                  padding: 0,
                  overflow: 'hidden',
                  borderColor: obsoleta ? '#F3B8B3' : COR.borda,
                  background: obsoleta ? '#FFFBFA' : '#FFFFFF'
                }}
              >
                {/* faixa de revisão obsoleta (mesma lógica dos documentos) */}
                {obsoleta && (
                  <div style={{ background: COR.erro, color: '#FFFFFF', padding: '10px 18px', fontSize: '13px', lineHeight: 1.5 }}>
                    <strong style={{ display: 'block', fontSize: '13.5px', letterSpacing: '.4px', textTransform: 'uppercase' }}>
                      ⚠ Revisão obsoleta — não utilizar
                    </strong>
                    {substituta
                      ? `Substituída pela ${substituta.revisao} em ${data(substituta.dataVigencia || substituta.dataAprovacao)}. `
                      : ''}
                    Disponível apenas para consulta do histórico.
                    {vigente ? ` A revisão em vigor é a ${vigente.revisao}.` : ''}
                  </div>
                )}

                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: obsoleta ? COR.textoSec : COR.azul }}>
                      Revisão {revisao.revisao}
                    </div>
                    <span style={{ background: selo.fundo, color: selo.cor, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700 }}>
                      {selo.texto}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '10px', fontSize: '13px' }}>
                    <div><div style={rotulo}>Criada em</div>{data(revisao.criadoEm || revisao.dataRevisao)}</div>
                    <div><div style={rotulo}>Vigência</div>{data(revisao.dataVigencia)}</div>
                    <div><div style={rotulo}>Aprovada por</div>{revisao.aprovadoPor || '-'}</div>
                    <div><div style={rotulo}>Responsável</div>{revisao.responsavel || '-'}</div>
                    <div>
                      <div style={rotulo}>Retreinamento</div>
                      {situacao === 'rascunho' ? '-' : revisao.requerRetreinamento ? 'Sim' : 'Não'}
                    </div>
                  </div>

                  {(revisao.motivoAlteracao || revisao.descricaoAlteracoes || revisao.justificativa) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '10px', fontSize: '13px' }}>
                      {revisao.motivoAlteracao && (
                        <div><div style={rotulo}>Motivo da alteração</div>{revisao.motivoAlteracao}</div>
                      )}
                      {revisao.descricaoAlteracoes && (
                        <div><div style={rotulo}>Alterações realizadas</div><div style={{ whiteSpace: 'pre-wrap' }}>{revisao.descricaoAlteracoes}</div></div>
                      )}
                      {revisao.justificativa && (
                        <div><div style={rotulo}>Justificativa</div>{revisao.justificativa}</div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => verConteudo(revisao)}
                      style={{
                        ...botao(false),
                        borderColor: obsoleta ? COR.textoSec : COR.azul,
                        color: obsoleta ? COR.textoSec : COR.azul
                      }}
                    >
                      {obsoleta
                        ? '👁 Ver conteúdo (obsoleto)'
                        : situacao === 'rascunho'
                          ? '👁 Ver conteúdo atual'
                          : '👁 Ver conteúdo'}
                    </button>

                    {situacao === 'vigente' && !andamento && (
                      <button
                        type="button"
                        onClick={registrarConteudoVigente}
                        disabled={registrando}
                        title="Grava o conteúdo atual nesta revisão, para consulta quando ela ficar obsoleta"
                        style={{ ...botao(false, registrando), border: 'none', color: COR.indigo }}
                      >
                        {registrando ? 'Registrando...' : 'Registrar conteúdo atual nesta revisão'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {consulta && (
        <ConteudoRevisaoTreinamentoModal
          titulo={`${treinamento.codigo} — Revisão ${consulta.revisao.revisao}`}
          situacao={situacaoDe(consulta.revisao)}
          substituicao={
            (() => {
              const substituta = substitutaDe(consulta.revisao);
              return situacaoDe(consulta.revisao) === 'obsoleta' && substituta
                ? `Substituída pela ${substituta.revisao} em ${data(substituta.dataVigencia || substituta.dataAprovacao)}.`
                : undefined;
            })()
          }
          revisaoVigente={vigente ? vigente.revisao : undefined}
          carregando={consulta.carregando}
          erro={consulta.erro}
          conteudo={consulta.conteudo}
          onFechar={() => setConsulta(undefined)}
        />
      )}
    </div>
  );
};

export default AnaliseTreinamentoPanel;
