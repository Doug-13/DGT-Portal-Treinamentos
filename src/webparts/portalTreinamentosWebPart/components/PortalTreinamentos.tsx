import * as React from 'react';
import styles from './PortalTreinamentos.module.scss';
import { IPortalTreinamentosProps } from './IPortalTreinamentosProps';
import logoDgt from '../assets/logo-dgt.png';
import { DataverseService, IDataverseRecord } from '../services/DataverseService';
import PortalRouter from './PortalRouter';
import { Pagina } from '../constants/routes';
import { ITreinamento, IHistorico, ICertificado } from '../models/Treinamento';
import { IDocumento } from '../models/Documento';
import { IColaborador } from '../models/Usuario';
import { useModulos } from '../hooks/useModulos';
import { useUsuario } from '../hooks/useUsuario';
import { useAvaliacao } from '../hooks/useAvaliacao';

type DataverseRecord = IDataverseRecord;

const imagensPadraoTreinamento: string[] = [
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80'
];

const documentosMock: IDocumento[] = [
  { id: 1, codigo: 'POP-001', documento: 'Política de Segurança da Informação', categoria: 'Política', status: 'Vigente', revisao: 'Rev.03' },
  { id: 2, codigo: 'POP-014', documento: 'Procedimento de Integração', categoria: 'Procedimento', status: 'Vigente', revisao: 'Rev.05' }
];

const colaboradoresMock: IColaborador[] = [
  { id: 1, nome: 'Ana Silva', funcao: 'Analista', setor: 'Qualidade', concluidos: 8, pendentes: 1, conformidade: '89%' }
];

const obterTexto = (r: DataverseRecord, chaves: string[], padrao = ''): string => {
  for (const chave of chaves) {
    const valor = r[chave];
    if (valor !== undefined && valor !== null && String(valor).trim() !== '') return String(valor);
  }
  return padrao;
};

const obterNumero = (r: DataverseRecord, chaves: string[], padrao = 0): number => {
  for (const chave of chaves) {
    const valor = r[chave];
    if (valor !== undefined && valor !== null && valor !== '') {
      const numero = Number(valor);
      if (!Number.isNaN(numero)) return numero;
    }
  }
  return padrao;
};

const obterBooleano = (r: DataverseRecord, chaves: string[], padrao = true): boolean => {
  for (const chave of chaves) {
    const valor = r[chave];
    if (typeof valor === 'boolean') return valor;
    if (valor === 1 || valor === '1' || valor === 'true') return true;
    if (valor === 0 || valor === '0' || valor === 'false') return false;
  }
  return padrao;
};

const obterFormatado = (r: DataverseRecord, chave: string): string =>
  obterTexto(r, [`${chave}@OData.Community.Display.V1.FormattedValue`], '');

const normalizarStatus = (valor: string, liberado = true): ITreinamento['status'] => {
  const status = valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (status.includes('conclu') || status.includes('aprov')) return 'Concluído';
  if (status.includes('reprov')) return 'Reprovado';
  if (status.includes('venc')) return 'Vencido';
  if (status.includes('cancel')) return 'Cancelado';
  if (status.includes('andamento') || status.includes('iniciado')) return 'Em andamento';
  if (status.includes('bloque') || !liberado) return 'Bloqueado';
  return 'Disponível';
};

const formatarData = (valor: string): string => {
  if (!valor) return '-';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleDateString('pt-BR');
};

const PortalTreinamentos: React.FC<IPortalTreinamentosProps> = ({
  userName, userEmail, siteUrl, dataverseClient, dataverseApiUrl
}) => {
  const [paginaAtual, setPaginaAtual] = React.useState<Pagina>('inicio');
  const [treinamentoSelecionado, setTreinamentoSelecionado] = React.useState<ITreinamento | null>(null);
  const [carregandoDataverse, setCarregandoDataverse] = React.useState(true);
  const [erroDataverse, setErroDataverse] = React.useState('');
  const [conectadoDataverse, setConectadoDataverse] = React.useState(false);
  const [meusTreinamentos, setMeusTreinamentos] = React.useState<ITreinamento[]>([]);
  const [historico, setHistorico] = React.useState<IHistorico[]>([]);
  const [certificados, setCertificados] = React.useState<ICertificado[]>([]);
  const [quantidadeTrilhasUsuario, setQuantidadeTrilhasUsuario] = React.useState(0);
  const [iniciandoTreinamento, setIniciandoTreinamento] = React.useState(false);
  const [erroExecucaoTreinamento, setErroExecucaoTreinamento] = React.useState('');

  const dataverseService = React.useMemo(
    () => new DataverseService(dataverseClient, dataverseApiUrl),
    [dataverseClient, dataverseApiUrl]
  );

  const usuario = useUsuario(userName, userEmail, siteUrl);
  const modulos = useModulos(dataverseService);
  const avaliacao = useAvaliacao(dataverseService);

  React.useEffect(() => {
    const carregar = async (): Promise<void> => {
      setCarregandoDataverse(true);
      setErroDataverse('');

      try {
        const [dadosTreinamentos, dadosAtribuicoes] = await Promise.all([
          dataverseService.getTreinamentos(),
          dataverseService.getUsuarioTreinamentos()
        ]);

        const catalogo: ITreinamento[] = dadosTreinamentos
          .map((r, indice) => {
            const minutos = obterNumero(r, ['dgt_cargahorariamin'], 0);
            const carga = minutos >= 60
              ? (minutos % 60 === 0 ? `${minutos / 60}h` : `${Math.floor(minutos / 60)}h ${minutos % 60}min`)
              : (minutos > 0 ? `${minutos}min` : 'Carga horária não informada');
            const validade = obterNumero(r, ['dgt_validademeses'], 0);

            return {
              id: obterTexto(r, ['dgt_treinamentoid'], `treinamento-${indice}`),
              nome: obterTexto(r, ['dgt_nome', 'dgt_name'], 'Treinamento'),
              codigo: obterTexto(r, ['dgt_codigo'], ''),
              descricao: obterTexto(r, ['dgt_descricao'], ''),
              status: 'Disponível' as ITreinamento['status'],
              progresso: 0,
              cargaHoraria: carga,
              validadeMeses: validade > 0 ? validade : undefined,
              ativo: obterBooleano(r, ['dgt_ativo'], true),
              imagem: imagensPadraoTreinamento[indice % imagensPadraoTreinamento.length]
            };
          })
          .filter(t => t.ativo);

        const email = userEmail.trim().toLowerCase();
        const nome = userName.trim().toLowerCase();

        const atribuicoes = dadosAtribuicoes.filter(r => {
          const emailRegistro = obterTexto(r, ['dgt_usuarioemail', 'dgt_email'], '').trim().toLowerCase();
          const usuarioRegistro = obterTexto(
            r,
            ['_dgt_usuario_value@OData.Community.Display.V1.FormattedValue', 'dgt_usuario'],
            ''
          ).trim().toLowerCase();

          return emailRegistro === email || usuarioRegistro === nome || usuarioRegistro === email;
        });

        const treinamentosUsuario: ITreinamento[] = atribuicoes.map((a, indice) => {
          const lookup = obterTexto(a, ['_dgt_treinamento_value'], '').replace(/[{}]/g, '').toLowerCase();
          const nomeLookup = obterTexto(a, ['_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue'], '');
          const item = catalogo.find(t => t.id.replace(/[{}]/g, '').toLowerCase() === lookup)
            || catalogo.find(t => t.nome.trim().toLowerCase() === nomeLookup.trim().toLowerCase());

          const liberado = obterBooleano(a, ['dgt_liberado'], true);
          const status = normalizarStatus(
            obterFormatado(a, 'dgt_status') || obterTexto(a, ['dgt_status'], ''),
            liberado
          );

          return {
            id: item?.id || lookup || `atribuicao-${indice}`,
            usuarioTreinamentoId: obterTexto(a, ['dgt_usuariotreinamentoid'], ''),
            nome: item?.nome || nomeLookup || 'Treinamento',
            codigo: item?.codigo || '',
            descricao: item?.descricao || '',
            status,
            progresso: status === 'Concluído' ? 100 : 0,
            cargaHoraria: item?.cargaHoraria || '-',
            validadeMeses: item?.validadeMeses,
            ativo: item?.ativo ?? true,
            imagem: item?.imagem || imagensPadraoTreinamento[indice % imagensPadraoTreinamento.length]
          };
        });

        const historicoUsuario: IHistorico[] = atribuicoes.map((a, indice) => {
          const lookup = obterTexto(a, ['_dgt_treinamento_value'], '').replace(/[{}]/g, '').toLowerCase();
          const item = catalogo.find(t => t.id.replace(/[{}]/g, '').toLowerCase() === lookup);
          const nota = obterNumero(a, ['dgt_nota'], -1);

          return {
            id: obterTexto(a, ['dgt_usuariotreinamentoid'], `historico-${indice}`),
            treinamento: item?.nome || obterTexto(a, ['_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue'], 'Treinamento'),
            trilha: obterTexto(a, ['_dgt_trilha_value@OData.Community.Display.V1.FormattedValue'], '-'),
            status: normalizarStatus(
              obterFormatado(a, 'dgt_status') || obterTexto(a, ['dgt_status'], ''),
              obterBooleano(a, ['dgt_liberado'], true)
            ),
            conclusao: formatarData(obterTexto(a, ['dgt_dataconclusao'], '')),
            nota: nota >= 0 ? `${nota}%` : '-',
            validade: formatarData(obterTexto(a, ['dgt_datavalidade'], ''))
          };
        });

        const certificadosUsuario: ICertificado[] = treinamentosUsuario
          .filter(t => t.status === 'Concluído')
          .map((t, indice) => {
            const a = atribuicoes.find(x =>
              obterTexto(x, ['dgt_usuariotreinamentoid'], '') === t.usuarioTreinamentoId
            );

            return {
              id: t.usuarioTreinamentoId || `cert-${indice}`,
              treinamento: t.nome,
              codigo: t.codigo,
              conclusao: a ? formatarData(obterTexto(a, ['dgt_dataconclusao'], '')) : '-',
              validade: a ? formatarData(obterTexto(a, ['dgt_datavalidade'], '')) : '-',
              cargaHoraria: t.cargaHoraria
            };
          });

        const trilhas = new Set(
          atribuicoes
            .map(a => obterTexto(a, ['_dgt_trilha_value'], ''))
            .filter(Boolean)
        );

        setMeusTreinamentos(treinamentosUsuario);
        setHistorico(historicoUsuario);
        setCertificados(certificadosUsuario);
        setQuantidadeTrilhasUsuario(trilhas.size);
        setConectadoDataverse(true);
      } catch (e) {
        setConectadoDataverse(false);
        setErroDataverse(e instanceof Error ? e.message : 'Erro ao carregar o Dataverse.');
      } finally {
        setCarregandoDataverse(false);
      }
    };

    carregar().catch((error: unknown) => {
      console.error('Erro ao carregar dados do portal:', error);
    });
  }, [dataverseService, userEmail, userName]);

  const navegar = React.useCallback((pagina: Pagina): void => {
    setPaginaAtual(pagina);
    window.scrollTo(0, 0);
  }, []);

  const abrirTreinamento = React.useCallback(async (treinamento: ITreinamento): Promise<void> => {
    if (treinamento.status === 'Bloqueado') return;

    setTreinamentoSelecionado(treinamento);
    setErroExecucaoTreinamento('');
    navegar('executarTreinamento');
    await modulos.carregar(treinamento.id, treinamento.usuarioTreinamentoId);
  }, [modulos, navegar]);

  const iniciarTreinamento = React.useCallback(async (): Promise<void> => {
    if (!treinamentoSelecionado?.usuarioTreinamentoId) {
      setErroExecucaoTreinamento('A atribuição deste treinamento não foi localizada.');
      return;
    }

    setIniciandoTreinamento(true);
    setErroExecucaoTreinamento('');

    try {
      await dataverseService.iniciarUsuarioTreinamento(treinamentoSelecionado.usuarioTreinamentoId);

      const atualizado: ITreinamento = {
        ...treinamentoSelecionado,
        status: 'Em andamento'
      };

      setTreinamentoSelecionado(atualizado);
      setMeusTreinamentos(lista =>
        lista.map(t =>
          t.usuarioTreinamentoId === atualizado.usuarioTreinamentoId ? atualizado : t
        )
      );

      await modulos.carregar(atualizado.id, atualizado.usuarioTreinamentoId);
    } catch (e) {
      setErroExecucaoTreinamento(
        e instanceof Error ? e.message : 'Erro ao iniciar treinamento.'
      );
    } finally {
      setIniciandoTreinamento(false);
    }
  }, [dataverseService, treinamentoSelecionado, modulos]);

  const iniciarAvaliacao = React.useCallback(async (): Promise<void> => {
    if (!treinamentoSelecionado) {
      setErroExecucaoTreinamento('Nenhum treinamento foi selecionado.');
      return;
    }

    if (!treinamentoSelecionado.usuarioTreinamentoId) {
      setErroExecucaoTreinamento(
        'A atribuição deste treinamento não foi localizada.'
      );
      return;
    }

    const carregou = await avaliacao.carregar(
      treinamentoSelecionado.id,
      treinamentoSelecionado.usuarioTreinamentoId
    );

    if (carregou) {
      setErroExecucaoTreinamento('');
      navegar('avaliacao');
      return;
    }

    setErroExecucaoTreinamento(
      'Não foi possível abrir a avaliação. Verifique a configuração da avaliação no Dataverse.'
    );
  }, [avaliacao, navegar, treinamentoSelecionado]);

  const enviarAvaliacao = React.useCallback((
    respostas: Record<string, string[]>
  ): void => {
    if (!treinamentoSelecionado?.usuarioTreinamentoId) {
      setErroExecucaoTreinamento(
        'A atribuição deste treinamento não foi localizada.'
      );
      return;
    }

    avaliacao.enviar(
      treinamentoSelecionado.usuarioTreinamentoId,
      respostas
    ).catch((error: unknown) => console.error(error));
  }, [avaliacao, treinamentoSelecionado]);


  const abasTreinamento: Array<{ pagina: Pagina; label: string; icon: string }> = [
    { pagina: 'inicio', label: 'Visão geral', icon: '⌂' },
    { pagina: 'treinamentos', label: 'Meus treinamentos', icon: '▶' },
    { pagina: 'trilhas', label: 'Trilhas', icon: '▰' },
    { pagina: 'treinamentos', label: 'Catálogo', icon: '▤' },
    { pagina: 'historico', label: 'Histórico', icon: '◷' },
    { pagina: 'certificados', label: 'Certificados', icon: '▣' },
    { pagina: 'gestao', label: 'Gestão', icon: '⚙' }
  ];

  const menuIntranet = [
    { label: 'Início', icon: '⌂' },
    { label: 'Treinamentos', icon: '▣', ativo: true },
    { label: 'Documentos', icon: '▤' },
    { label: 'Processos', icon: '⌘' },
    { label: 'Indicadores', icon: '▥' },
    { label: 'RH e Pessoas', icon: '♟' },
    { label: 'Sistemas', icon: '⌘' },
    { label: 'Comunicados', icon: '◩' },
    { label: 'Sobre a DGT', icon: '?' }
  ];

  return (
    <div className={styles.portal}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <img src={logoDgt} alt="DGT" />
        </div>

        <nav className={styles.intranetMenu}>
          {menuIntranet.map(item => (
            <button
              key={item.label}
              type="button"
              className={item.ativo ? styles.intranetMenuActive : styles.intranetMenuItem}
              title={item.ativo ? 'Módulo atual' : 'Módulo da Intranet DGT'}
            >
              <span className={styles.intranetIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarWords}>
          <strong>CONHECIMENTO</strong>
          <strong>PROCESSOS</strong>
          <strong>PESSOAS</strong>
          <strong>RESULTADOS</strong>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.globalHeader}>
          <label className={styles.globalSearch}>
            <span>⌕</span>
            <input
              type="text"
              placeholder="Pesquisar pessoas, documentos, treinamentos, processos..."
              aria-label="Pesquisar na Intranet DGT"
            />
          </label>

          <div className={styles.headerActions}>
            <span className={styles.connection}>
              {carregandoDataverse
                ? 'Conectando...'
                : conectadoDataverse
                  ? '● Dataverse conectado'
                  : '○ Dataverse indisponível'}
            </span>

            <button type="button" className={styles.headerIcon} title="Notificações">♢</button>
            <button type="button" className={styles.headerIcon} title="Aplicativos">▦</button>

            <div className={styles.userBox}>
              <div className={styles.avatar}>
                {usuario.fotoUsuario && !usuario.erroFotoUsuario ? (
                  <img
                    src={usuario.fotoUsuario}
                    alt={userName}
                    onError={usuario.registrarErroFoto}
                  />
                ) : (
                  <span>{usuario.primeiroNome.charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className={styles.userText}>
                <strong>{usuario.primeiroNome}</strong>
                <span>Colaborador</span>
              </div>
              <span className={styles.chevron}>⌄</span>
            </div>
          </div>
        </header>

        <main className={styles.page}>
          <section className={styles.trainingHero}>
            <div className={styles.heroIcon}>▰</div>
            <div className={styles.heroText}>
              <h1>Treinamentos</h1>
              <h2>Desenvolva seu conhecimento. Construa resultados.</h2>
              <p>Trilhas, cursos, avaliações e certificações em um só lugar.</p>
            </div>

            <div className={styles.heroQuote}>
              <p>“Pessoa que aprende hoje, constrói um amanhã melhor.”</p>
              <strong>DGT</strong>
            </div>
          </section>

          <nav className={styles.trainingTabs}>
            {abasTreinamento.map((aba, indice) => {
              const ativo =
                paginaAtual === aba.pagina ||
                (paginaAtual === 'executarTreinamento' && aba.label === 'Meus treinamentos') ||
                (paginaAtual === 'avaliacao' && aba.label === 'Meus treinamentos');

              return (
                <button
                  key={`${aba.label}-${indice}`}
                  type="button"
                  className={ativo ? styles.trainingTabActive : styles.trainingTab}
                  onClick={() => navegar(aba.pagina)}
                >
                  <span>{aba.icon}</span>
                  <strong>{aba.label}</strong>
                </button>
              );
            })}
          </nav>

          <div className={styles.content}>
            <PortalRouter
              pagina={paginaAtual}
              primeiroNome={usuario.primeiroNome}
              treinamentos={meusTreinamentos}
              treinamentoSelecionado={treinamentoSelecionado}
              documentos={documentosMock}
              historico={historico}
              certificados={certificados}
              colaboradores={colaboradoresMock}
              quantidadeTrilhas={quantidadeTrilhasUsuario}
              carregandoDataverse={carregandoDataverse}
              erroDataverse={erroDataverse}
              modulos={modulos.modulos}
              carregandoModulos={modulos.carregando}
              erroModulos={modulos.erro}
              erroExecucao={erroExecucaoTreinamento}
              processandoModuloId={modulos.processandoModuloId}
              iniciandoTreinamento={iniciandoTreinamento}
              progressoModulos={modulos.progresso}
              avaliacaoLiberada={modulos.avaliacaoLiberada}
              navegar={navegar}
              abrirTreinamento={(t: ITreinamento) => {
                abrirTreinamento(t).catch((error: unknown) => console.error(error));
              }}
              iniciarTreinamento={() => {
                iniciarTreinamento().catch((error: unknown) => console.error(error));
              }}
              iniciarModulo={m => {
                modulos.iniciar(m).catch((error: unknown) => console.error(error));
              }}
              concluirModulo={m => {
                modulos.concluir(m).catch((error: unknown) => console.error(error));
              }}
              iniciarAvaliacao={() => {
                iniciarAvaliacao().catch((error: unknown) => console.error(error));
              }}
              avaliacao={avaliacao.avaliacao}
              carregandoAvaliacao={avaliacao.carregando}
              erroAvaliacao={avaliacao.erro}
              tentativasAvaliacao={avaliacao.tentativas}
              envioAvaliacaoPreparado={avaliacao.envioPreparado}
              resultadoAvaliacao={avaliacao.resultado}
              processandoAvaliacao={avaliacao.processando}
              enviarAvaliacao={enviarAvaliacao}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default PortalTreinamentos;

