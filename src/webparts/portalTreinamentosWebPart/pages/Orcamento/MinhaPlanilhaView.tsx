import * as React from 'react';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IAlteracaoOrcamento,
  IAreaOrcamento,
  IConfigArea,
  ILinhaOrcamento,
  IPlanilhaOrcamento,
  OrcamentoService,
  arredondar,
  linhasDoModelo,
  mesesVazios,
  novaChaveTemporaria,
  totalLinha
} from '../../services/orcamento/OrcamentoService';

import {
  AREA_GERAL,
  PRAZO_AJUSTE_DIAS_UTEIS,
  STATUS_PLANILHA
} from '../../services/orcamento/esquemaOrcamento';

import {
  IContaOrcamento
} from '../../services/orcamento/planoContasOrcamento';

import {
  IRegraCalculo,
  aplicarRegras,
  contasCalculadas
} from '../../services/orcamento/calculoOrcamento';

import {
  situacaoPrazo
} from '../../services/orcamento/diasUteis';

import TabelaOrcamento from './TabelaOrcamento';
import AdicionarLinhaModal from './AdicionarLinhaModal';
import PainelAlteracoes from './PainelAlteracoes';

import {
  COR,
  CaixaMensagem,
  CartaoNumero,
  SeloPrazo,
  SeloStatus,
  baixarCsv,
  botao,
  campo,
  cartao,
  explicarErro,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  gerarCsvOrcamento,
  nomeArquivoSeguro,
  somar,
  somarMeses
} from './orcamentoComum';

// ============================================================
// MINHA PLANILHA (Gestor)
//
// • UMA planilha por ÁREA, compartilhada pelos gestores da área
//   (Gestor ou Administrador da área). Qualquer um deles pode iniciar,
//   preencher e enviar. Sem área vinculada → planilha "Geral" pessoal.
// • Dois gestores editando ao mesmo tempo: ao salvar, se alguém
//   alterou a mesma linha depois que você abriu, o portal avisa e
//   não sobrescreve.
// • A planilha nova vem com as contas dos grupos configurados para a
//   área (Contas por área). Sem configuração → todas as contas.
// • Linhas calculadas por regra (ex.: impostos) são recalculadas a
//   cada digitação e ficam bloqueadas.
// • Ao salvar, cada linha alterada vai para o log (anterior → novo).
// • Devolvida para ajuste: mostra o motivo, o prazo (dias úteis) e as
//   linhas alteradas.
// ============================================================

export interface IMinhaPlanilhaViewProps {
  servico: OrcamentoService;
  contexto: IContextoAcesso;
  ano: number;
  regras: IRegraCalculo[];
  configs: IConfigArea[];
  // Avisa a página quantas alterações não salvas existem.
  onPendencias: (quantidade: number) => void;
}

const guid = (valor: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const NOMES_MES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const clonar = (linha: ILinhaOrcamento): ILinhaOrcamento => ({ ...linha, valores: linha.valores.slice() });

const assinatura = (linha: ILinhaOrcamento): string =>
  JSON.stringify([linha.descricao, linha.valores]);

const MinhaPlanilhaView: React.FC<IMinhaPlanilhaViewProps> = (props) => {

  const { servico, contexto, ano, regras, configs, onPendencias } = props;

  // Áreas em que o usuário preenche orçamento.
  const areasDoUsuario =
    React.useMemo((): IAreaOrcamento[] => {
      const lista: IAreaOrcamento[] = [];
      (contexto.vinculosArea || [])
        .filter(item => item.perfil === 'Gestor' || item.perfil === 'Administrador da área')
        .forEach(item => {
          const id = guid(item.areaId);
          if (id && !lista.some(area => area.id === id)) {
            lista.push({ id, nome: item.areaNome });
          }
        });
      return lista.length > 0 ? lista : [AREA_GERAL];
    }, [contexto]);

  const [planilhasDoAno, setPlanilhasDoAno] = React.useState<IPlanilhaOrcamento[]>([]);
  const [areaId, setAreaId] = React.useState<string>(areasDoUsuario[0].id);
  const [planilha, setPlanilha] = React.useState<IPlanilhaOrcamento | undefined>(undefined);
  const [linhas, setLinhas] = React.useState<ILinhaOrcamento[]>([]);
  const [originais, setOriginais] = React.useState<{ [id: string]: ILinhaOrcamento }>({});
  const [removidas, setRemovidas] = React.useState<ILinhaOrcamento[]>([]);
  const [alteracoesLog, setAlteracoesLog] = React.useState<IAlteracaoOrcamento[]>([]);
  const [carregandoLog, setCarregandoLog] = React.useState(false);
  const [carregando, setCarregando] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [alerta, setAlerta] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [progresso, setProgresso] = React.useState('');
  const [modalAberto, setModalAberto] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [somenteComValor, setSomenteComValor] = React.useState(false);

  // Áreas do usuário + áreas de planilhas já existentes (ex.: uma
  // planilha "Geral" criada antes de a pessoa ter área).
  const areasExibidas =
    React.useMemo((): IAreaOrcamento[] => {
      const lista = areasDoUsuario.slice();
      planilhasDoAno.forEach(item => {
        if (!lista.some(area => area.id === item.areaId)) {
          lista.push({ id: item.areaId, nome: item.areaNome || AREA_GERAL.nome });
        }
      });
      return lista;
    }, [areasDoUsuario, planilhasDoAno]);

  const areaAtual =
    areasExibidas.filter(area => area.id === areaId)[0] || areasExibidas[0];

  const gruposDaArea = (id: string): string[] | undefined => {
    const config = configs.filter(item => item.areaId === id)[0];
    return config && config.grupos.length > 0 ? config.grupos : undefined;
  };

  const editavel = !!planilha && planilha.status !== STATUS_PLANILHA.enviada;
  const somenteLeitura = !editavel;

  const calculadas =
    React.useMemo(() => contasCalculadas(regras), [regras]);

  const codigosCalculados = Object.keys(calculadas);

  // Regras em ref: os manipuladores memorizados sempre usam as atuais.
  const regrasRef = React.useRef(regras);
  regrasRef.current = regras;
  const editavelRef = React.useRef(editavel);
  editavelRef.current = editavel;

  const recalcular = React.useCallback(
    (lista: ILinhaOrcamento[]): ILinhaOrcamento[] =>
      editavelRef.current ? aplicarRegras(lista, regrasRef.current) : lista,
    []
  );

  // ----------------------------------------------------------
  // Alterações pendentes
  // ----------------------------------------------------------

  const novas = linhas.filter(linha => !linha.id);

  const alteradas =
    linhas.filter(linha => !!linha.id && (!originais[linha.id] || assinatura(originais[linha.id]) !== assinatura(linha)));

  const removidasGravadas = removidas.filter(linha => !!linha.id);

  const totalPendencias = novas.length + alteradas.length + removidasGravadas.length;

  const pendenciasRef = React.useRef(0);
  pendenciasRef.current = totalPendencias;

  React.useEffect(() => {
    onPendencias(totalPendencias);
  }, [totalPendencias, onPendencias]);

  const chavesAlteradas =
    novas.map(linha => linha.chave).concat(alteradas.map(linha => linha.chave));

  // Linhas alteradas depois da última devolução (destaque na tabela).
  const destacadas =
    React.useMemo(() => {
      const mapa: { [chave: string]: string } = {};
      if (!planilha || !planilha.dataDevolucao) {
        return mapa;
      }
      const limite = new Date(planilha.dataDevolucao).getTime();
      alteracoesLog
        .filter(item => new Date(item.data).getTime() >= limite && item.origem === 'Gestor')
        .forEach(item => {
          mapa[item.linhaId] = 'alterada após a devolução';
        });
      return mapa;
    }, [alteracoesLog, planilha]);

  // ----------------------------------------------------------
  // Carregamento
  // ----------------------------------------------------------

  const aplicarCarregadas = (lista: ILinhaOrcamento[], editavelAgora: boolean): void => {
    const mapa: { [id: string]: ILinhaOrcamento } = {};
    lista.forEach(linha => {
      if (linha.id) {
        mapa[linha.id] = clonar(linha);
      }
    });
    setOriginais(mapa);
    // Recalcula na carga: se uma regra mudou, as linhas calculadas
    // aparecem como "não salvo" para o gestor gravar.
    setLinhas(editavelAgora ? aplicarRegras(lista, regrasRef.current) : lista);
    setRemovidas([]);
  };

  const carregarLog = React.useCallback(async (planilhaId: string): Promise<void> => {
    setCarregandoLog(true);
    try {
      setAlteracoesLog(await servico.listarAlteracoes(planilhaId));
    } catch (falha) {
      setAlteracoesLog([]);
      setAlerta(`Não foi possível carregar o log de alterações. ${explicarErro(falha)}`);
    } finally {
      setCarregandoLog(false);
    }
  }, [servico]);

  const carregar = React.useCallback(async (): Promise<void> => {

    setCarregando(true);
    setErro('');
    setAlerta('');

    try {
      const doAno =
        await servico.listarPlanilhasDoUsuario(
          ano,
          contexto.usuarioId,
          areasDoUsuario.map(area => area.id)
        );

      setPlanilhasDoAno(doAno);

      const encontrada =
        doAno.filter(item => item.areaId === areaId)[0];

      setPlanilha(encontrada);
      setAlteracoesLog([]);

      if (!encontrada) {
        aplicarCarregadas([], false);
        return;
      }

      let lista = await servico.carregarLinhas(encontrada.id);

      // Planilha que nunca teve linhas: grava as contas do modelo
      // (só os grupos da área, se configurados).
      if (
        lista.length === 0 &&
        encontrada.status === STATUS_PLANILHA.emPreenchimento &&
        (await servico.contarLinhasJaCriadas(encontrada.id)) === 0
      ) {
        setProgresso('Preparando a planilha com as contas do modelo...');

        const resultado =
          await servico.preencherComModelo(
            encontrada,
            gruposDaArea(encontrada.areaId),
            (feitas, total) =>
              setProgresso(`Preparando a planilha com as contas do modelo (${feitas} de ${total})...`)
          );

        if (resultado.falhas.length > 0) {
          setErro(
            `${resultado.falhas.length} conta(s) do modelo não puderam ser incluídas. ` +
            'Clique em "+ Adicionar linha" > "Incluir as contas que faltam" para tentar de novo.\n' +
            resultado.falhas.slice(0, 5).join('\n')
          );
        }

        lista = await servico.carregarLinhas(encontrada.id);
      }

      aplicarCarregadas(lista, encontrada.status !== STATUS_PLANILHA.enviada);
      carregarLog(encontrada.id).catch(() => undefined);
    } catch (falha) {
      setErro(explicarErro(falha));
      setPlanilha(undefined);
      aplicarCarregadas([], false);
    } finally {
      setProgresso('');
      setCarregando(false);
    }
  // configs entra só pelo gruposDaArea na criação do modelo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servico, contexto, ano, areaId, areasDoUsuario, carregarLog]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  // Regras mudaram (ex.: Administrador editou na outra aba):
  // recalcula a planilha aberta.
  React.useEffect(() => {
    setLinhas(atual => recalcular(atual));
  }, [regras, recalcular]);

  // ----------------------------------------------------------
  // Ações
  // ----------------------------------------------------------

  const trocarArea = (novoId: string): void => {
    if (novoId === areaId) {
      return;
    }
    if (
      pendenciasRef.current > 0 &&
      !window.confirm('Existem alterações não salvas nesta planilha. Deseja descartá-las e trocar de área?')
    ) {
      return;
    }
    setAviso('');
    setBusca('');
    setAreaId(novoId);
  };

  const equipeDaArea = (id: string): string => {
    const config = configs.filter(item => item.areaId === id)[0];
    return config ? config.equipeId : '';
  };

  const iniciarPlanilha = async (): Promise<void> => {
    const equipeId = equipeDaArea(areaAtual.id);
    if (
      areaAtual.id &&
      !equipeId &&
      !window.confirm(
        `A equipe da área ${areaAtual.nome} ainda não foi configurada pelo administrador.\n\n` +
        'Se continuar, a planilha fica visível só para você (e os administradores) até a equipe ser sincronizada — ' +
        'depois disso ela passa a ser compartilhada com os outros gestores da área automaticamente.\n\nContinuar?'
      )
    ) {
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await servico.criarPlanilha(ano, contexto, areaAtual, equipeId);
      await carregar();
      setAviso(`Planilha de ${ano} — ${areaAtual.nome} criada com as contas do modelo. Preencha os valores e clique em "Salvar alterações".`);
    } catch (falha) {
      setErro(explicarErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  const linhasRef = React.useRef<ILinhaOrcamento[]>(linhas);
  linhasRef.current = linhas;
  const planilhaRef = React.useRef<IPlanilhaOrcamento | undefined>(planilha);
  planilhaRef.current = planilha;

  const proximaOrdem = (lista: ILinhaOrcamento[]): number =>
    lista.reduce((maior, linha) => Math.max(maior, linha.ordem), 0) + 10;

  const adicionarLinha = React.useCallback((conta: IContaOrcamento, descricao: string): void => {
    const atualPlanilha = planilhaRef.current;
    if (!atualPlanilha) {
      return;
    }
    setLinhas(atual => recalcular(atual.concat([{
      chave: novaChaveTemporaria(),
      planilhaId: atualPlanilha.id,
      grupo: conta.grupo,
      codigo: conta.codigo,
      conta: conta.conta,
      descricao,
      ordem: proximaOrdem(atual),
      valores: mesesVazios()
    }])));
    setAviso('');
  }, [recalcular]);

  // Contas do modelo (da área) que não estão na planilha.
  const contasFaltantes =
    React.useMemo(
      () => planilha
        ? linhasDoModelo(planilha.id, gruposDaArea(planilha.areaId))
          .filter(modelo => !linhas.some(linha => linha.grupo === modelo.grupo && linha.codigo === modelo.codigo))
        : [],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [linhas, planilha, configs]
    );

  const incluirFaltantes = (): void => {
    if (contasFaltantes.length === 0) {
      return;
    }
    setLinhas(atual => recalcular(atual.concat(contasFaltantes)));
    setAviso(`${contasFaltantes.length} conta(s) do modelo incluída(s). Clique em "Salvar alterações" para gravar.`);
  };

  const alterarLinha = React.useCallback((
    chave: string,
    alterar: (linha: ILinhaOrcamento) => ILinhaOrcamento
  ): void => {
    setLinhas(atual => recalcular(atual.map(linha => (linha.chave === chave ? alterar(linha) : linha))));
    setAviso('');
  }, [recalcular]);

  const alterarValor = React.useCallback((chave: string, mes: number, valor: number): void =>
    alterarLinha(chave, linha => {
      const valores = linha.valores.slice();
      valores[mes] = arredondar(valor);
      return { ...linha, valores };
    }), [alterarLinha]);

  const colarValores = React.useCallback((chave: string, mesInicial: number, colados: number[]): void =>
    alterarLinha(chave, linha => {
      const valores = linha.valores.slice();
      colados.forEach((valor, deslocamento) => {
        const mes = mesInicial + deslocamento;
        if (mes < 12) {
          valores[mes] = arredondar(valor);
        }
      });
      return { ...linha, valores };
    }), [alterarLinha]);

  const repetirJaneiro = React.useCallback((chave: string): void =>
    alterarLinha(chave, linha => ({
      ...linha,
      valores: linha.valores.map(() => linha.valores[0])
    })), [alterarLinha]);

  const alterarDescricao = React.useCallback((chave: string, descricao: string): void =>
    alterarLinha(chave, linha => ({ ...linha, descricao })), [alterarLinha]);

  const removerLinha = React.useCallback((chave: string): void => {
    const linha = linhasRef.current.filter(item => item.chave === chave)[0];
    if (!linha) {
      return;
    }
    if (
      totalLinha(linha) !== 0 &&
      !window.confirm(`Remover a linha "${linha.codigo} ${linha.conta}"? Ela some da planilha ao salvar (o registro fica no histórico).`)
    ) {
      return;
    }
    setLinhas(atual => recalcular(atual.filter(item => item.chave !== chave)));
    if (linha.id) {
      setRemovidas(atual => atual.concat([linha]));
    }
    setAviso('');
  }, [recalcular]);

  const descartar = (): void => {
    if (pendenciasRef.current > 0 && !window.confirm('Descartar as alterações não salvas?')) {
      return;
    }
    carregar().catch(() => undefined);
  };

  const salvar = async (): Promise<boolean> => {

    if (!planilha || totalPendencias === 0) {
      return true;
    }

    setSalvando(true);
    setErro('');
    setAlerta('');
    setAviso('');

    try {
      // Outro gestor da área alterou as mesmas linhas desde que esta
      // tela carregou? Então não sobrescreve.
      if (alteradas.length + removidasGravadas.length > 0) {
        const noBanco: { [id: string]: ILinhaOrcamento } = {};
        (await servico.carregarLinhas(planilha.id)).forEach(linha => {
          if (linha.id) {
            noBanco[linha.id] = linha;
          }
        });
        const conflitos =
          alteradas.concat(removidasGravadas).filter(linha => {
            if (!linha.id || codigosCalculados.indexOf(linha.codigo) >= 0) {
              return false;
            }
            const atual = noBanco[linha.id];
            const original = originais[linha.id];
            return !atual || (!!original && assinatura(atual) !== assinatura(original));
          });
        if (conflitos.length > 0) {
          setErro(
            `${conflitos.length} linha(s) foram alteradas (ou removidas) por outro gestor da área depois que você abriu a planilha:\n` +
            conflitos.slice(0, 10).map(linha => `• ${linha.codigo} ${linha.conta}`).join('\n') +
            (conflitos.length > 10 ? `\n• ... e mais ${conflitos.length - 10}` : '') +
            '\n\nNada foi salvo. Anote os seus valores, clique em "Descartar" para ver a versão atual e refaça as alterações.'
          );
          return false;
        }
      }

      const resultado =
        await servico.salvarAlteracoes(
          planilha.id,
          { novas, alteradas, removidas: removidasGravadas, equipeId: planilha.equipeId },
          (feitas, total) => {
            if (total > 20) {
              setAviso(`Gravando linhas novas (${feitas} de ${total})...`);
            }
          },
          {
            usuarioNome: contexto.nome,
            originais,
            codigosCalculados
          }
        );

      // Recarrega do Dataverse: o que aparece é o que foi gravado.
      await carregar();

      if (resultado.avisos.length > 0) {
        setAlerta(resultado.avisos.join('\n'));
      }

      if (resultado.falhas.length > 0) {
        setErro(
          `${resultado.gravadas} alteração(ões) gravada(s), ${resultado.falhas.length} com erro:\n` +
          resultado.falhas.join('\n')
        );
        return false;
      }

      setAviso(`✓ ${resultado.gravadas} alteração(ões) salva(s) e registrada(s) no log.`);
      return true;
    } catch (falha) {
      setErro(explicarErro(falha));
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const enviar = async (): Promise<void> => {

    if (!planilha) {
      return;
    }

    if (linhas.length === 0) {
      setErro('Inclua pelo menos uma linha antes de enviar a planilha.');
      return;
    }

    const reenvio = planilha.status === STATUS_PLANILHA.devolvida;

    if (!window.confirm(
      reenvio
        ? `Reenviar a planilha de ${ano} (${areaAtual.nome}) com os ajustes? Ela volta a ficar somente leitura.`
        : `Enviar a planilha de ${ano} (${areaAtual.nome})? Depois de enviada, ela fica somente leitura. Se precisar de ajuste, o administrador devolve para você com o motivo.`
    )) {
      return;
    }

    const salvou = await salvar();

    if (!salvou) {
      return;
    }

    setSalvando(true);
    try {
      const avisoHistorico = await servico.enviarPlanilha(planilha, contexto);
      await carregar();
      setAviso(`✓ Planilha de ${ano} — ${areaAtual.nome} ${reenvio ? 'reenviada' : 'enviada'}.`);
      if (avisoHistorico) {
        setAlerta(avisoHistorico);
      }
    } catch (falha) {
      setErro(explicarErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  const exportar = (): void => {
    if (!planilha) {
      return;
    }
    baixarCsv(
      `${nomeArquivoSeguro(`Orcamento_${ano}_${areaAtual.nome}_${planilha.gestorNome}`)}.csv`,
      gerarCsvOrcamento(ano, linhas, false)
    );
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  const linhasVisiveis =
    React.useMemo(() => {
      const termo = busca.trim().toLowerCase();
      return linhas.filter(linha =>
        (!somenteComValor || totalLinha(linha) !== 0 || !!linha.descricao || !linha.id) &&
        (!termo ||
          linha.conta.toLowerCase().indexOf(termo) >= 0 ||
          linha.codigo.indexOf(termo) >= 0 ||
          linha.grupo.toLowerCase().indexOf(termo) >= 0 ||
          linha.descricao.toLowerCase().indexOf(termo) >= 0)
      );
    }, [linhas, busca, somenteComValor]);

  const filtroAtivo = !!busca.trim() || somenteComValor;

  const seletorAreas = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
      {areasExibidas.map(area => {
        const daArea = planilhasDoAno.filter(item => item.areaId === area.id)[0];
        const ativa = area.id === areaAtual.id;
        const prazo = daArea && daArea.status === STATUS_PLANILHA.devolvida ? situacaoPrazo(daArea.prazoAjuste, daArea.dataDevolucao) : undefined;
        return (
          <button
            key={area.id || 'geral'}
            type="button"
            onClick={() => trocarArea(area.id)}
            aria-pressed={ativa}
            style={{
              textAlign: 'left',
              minWidth: '220px',
              flex: '0 1 280px',
              padding: '12px 14px',
              borderRadius: '10px',
              border: `2px solid ${ativa ? COR.ciano : COR.borda}`,
              background: ativa ? '#F0FCFE' : '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>Área</div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: COR.azul, margin: '2px 0 6px' }}>{area.nome}</div>
            {daArea
              ? <SeloStatus status={daArea.status} />
              : <span style={{ fontSize: '12px', color: COR.texto2 }}>Não iniciada</span>}
            {prazo && (
              <div style={{ marginTop: '6px' }}>
                <SeloPrazo prazo={daArea.prazoAjuste} situacao={prazo} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  if (carregando) {
    return (
      <>
        {areasExibidas.length > 1 && seletorAreas}
        <div style={{ ...cartao, color: COR.texto2 }}>
          {progresso || `Carregando a planilha de ${ano} — ${areaAtual.nome}...`}
          {progresso && (
            <div style={{ fontSize: '12px', marginTop: '6px' }}>
              Isso acontece só na primeira vez. Não feche a página.
            </div>
          )}
        </div>
      </>
    );
  }

  if (!planilha) {
    const grupos = gruposDaArea(areaAtual.id);
    return (
      <>
        {areasExibidas.length > 1 && seletorAreas}
        <CaixaMensagem tipo="erro" texto={erro} />
        <div style={{ ...cartao, textAlign: 'center', padding: '36px 20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, color: COR.azul }}>
            Você ainda não iniciou o orçamento de {ano} — {areaAtual.nome}
          </div>
          <div style={{ fontSize: '13.5px', color: COR.texto2, margin: '8px auto 18px', maxWidth: '560px' }}>
            {areaAtual.id
              ? 'A planilha é da área: os gestores da área e os administradores conseguem vê-la e qualquer gestor da área pode preenchê-la.'
              : 'A planilha é sua: só você e os administradores conseguem vê-la.'}
            {grupos
              ? ` Ela virá com as contas dos ${grupos.length} grupo(s) definidos para esta área.`
              : ' Ela virá com todas as contas do plano de contas.'}
            {areasExibidas.length > 1 && ' Cada área tem a sua própria planilha.'}
          </div>
          <button type="button" onClick={() => { iniciarPlanilha().catch(() => undefined); }} disabled={salvando} style={botao('principal', salvando)}>
            {salvando ? 'Criando...' : `Iniciar planilha de ${ano}`}
          </button>
        </div>
      </>
    );
  }

  const totais = somarMeses(linhas);
  const total = somar(totais);
  const maiorMes = totais.reduce((maior, valor, indice) => (valor > totais[maior] ? indice : maior), 0);
  const prazo = planilha.status === STATUS_PLANILHA.devolvida ? situacaoPrazo(planilha.prazoAjuste, planilha.dataDevolucao) : undefined;
  const qtdDestacadas = Object.keys(destacadas).length;

  return (
    <>
      {areasExibidas.length > 1 && seletorAreas}

      <CaixaMensagem tipo="erro" texto={erro} />
      <CaixaMensagem tipo="alerta" texto={alerta} />
      <CaixaMensagem tipo="sucesso" texto={aviso} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <CartaoNumero titulo="Total anual" valor={formatarMoeda(total)} detalhe={`${linhas.filter(linha => totalLinha(linha) !== 0).length} de ${linhas.length} linha(s) com valor`} />
        <CartaoNumero titulo="Média mensal" valor={formatarMoeda(arredondar(total / 12))} />
        <CartaoNumero
          titulo="Mês de maior valor"
          valor={total ? formatarMoeda(totais[maiorMes]) : '—'}
          detalhe={total ? NOMES_MES_LONGOS[maiorMes] : undefined}
        />
        <div style={{ ...cartao, marginBottom: 0, flex: '1 1 180px', minWidth: '180px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', letterSpacing: '.4px' }}>Situação</div>
          <div style={{ marginTop: '8px' }}><SeloStatus status={planilha.status} /></div>
          {planilha.status === STATUS_PLANILHA.enviada && (
            <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>Enviada em {formatarData(planilha.dataEnvio)}</div>
          )}
          <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>
            {planilha.areaId ? 'Planilha da área' : 'Planilha pessoal'} · criada por {planilha.gestorNome || '—'}
          </div>
          {planilha.areaId && !planilha.equipeId && (
            <div style={{ fontSize: '11.5px', color: '#B45309', marginTop: '4px', fontWeight: 600 }}>
              Ainda não compartilhada com a equipe da área (aguardando sincronização).
            </div>
          )}
          {prazo && (
            <div style={{ marginTop: '6px' }}><SeloPrazo prazo={planilha.prazoAjuste} situacao={prazo} /></div>
          )}
        </div>
      </div>

      {planilha.status === STATUS_PLANILHA.devolvida && (
        <div
          role="alert"
          style={{ ...cartao, background: '#FFF5F5', borderColor: '#F3C1C1', borderLeft: `5px solid ${COR.perigo}` }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: COR.perigo }}>⚠ Pendência de ajuste</div>
            {prazo && <SeloPrazo prazo={planilha.prazoAjuste} situacao={prazo} />}
          </div>
          <div style={{ fontSize: '13px', color: COR.azul, marginTop: '4px' }}>
            Sua planilha foi devolvida
            {planilha.devolvidoPor ? <> por <strong>{planilha.devolvidoPor}</strong></> : null}
            {' '}em {formatarDataHora(planilha.dataDevolucao)}.
            {planilha.prazoAjuste && (
              <> Você tem até <strong>{formatarData(planilha.prazoAjuste)}</strong> ({PRAZO_AJUSTE_DIAS_UTEIS} dias úteis) para ajustar e reenviar.</>
            )}
          </div>
          <div style={{ marginTop: '10px', padding: '10px 12px', background: '#FFFFFF', border: '1px solid #F3C1C1', borderRadius: '8px', fontSize: '13.5px', color: COR.azul, whiteSpace: 'pre-line' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: COR.texto2, textTransform: 'uppercase', marginBottom: '4px' }}>Motivo</div>
            {planilha.motivoDevolucao || 'Motivo não informado.'}
          </div>
          <div style={{ fontSize: '12.5px', color: COR.texto2, marginTop: '8px' }}>
            Faça os ajustes, clique em <strong>Salvar alterações</strong> e depois em <strong>Reenviar planilha</strong>.
            {qtdDestacadas > 0 && ` Você já alterou ${qtdDestacadas} linha(s) desde a devolução (destacadas em azul na tabela).`}
          </div>
        </div>
      )}

      {planilha.status === STATUS_PLANILHA.enviada && (
        <CaixaMensagem tipo="info" texto="Esta planilha já foi enviada e está somente para consulta. Se precisar de ajuste, o administrador a devolverá para você com o motivo." />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {editavel && (
          <button type="button" onClick={() => setModalAberto(true)} disabled={salvando} style={botao('principal', salvando)}>
            + Adicionar linha
          </button>
        )}
        {editavel && (
          <button
            type="button"
            onClick={() => { salvar().catch(() => undefined); }}
            disabled={salvando || totalPendencias === 0}
            style={botao('principal', salvando || totalPendencias === 0)}
          >
            {salvando ? 'Salvando...' : `Salvar alterações${totalPendencias > 0 ? ` (${totalPendencias})` : ''}`}
          </button>
        )}
        {editavel && totalPendencias > 0 && (
          <button type="button" onClick={descartar} disabled={salvando} style={botao('secundario', salvando)}>
            Descartar
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={exportar} disabled={linhas.length === 0} style={botao('secundario', linhas.length === 0)}>
          Exportar CSV
        </button>
        {editavel && (
          <button
            type="button"
            onClick={() => { enviar().catch(() => undefined); }}
            disabled={salvando || linhas.length === 0}
            style={botao(planilha.status === STATUS_PLANILHA.devolvida ? 'principal' : 'secundario', salvando || linhas.length === 0)}
            title="Conclui o preenchimento. A planilha fica somente leitura."
          >
            {planilha.status === STATUS_PLANILHA.devolvida ? 'Reenviar planilha' : 'Enviar planilha'}
          </button>
        )}
      </div>

      {linhas.length === 0 ? (
        <div style={{ ...cartao, textAlign: 'center', color: COR.texto2, fontSize: '13.5px', padding: '30px 20px' }}>
          Nenhuma linha na planilha. Clique em <strong>+ Adicionar linha</strong> para escolher as contas
          {editavel && contasFaltantes.length > 0 && (
            <>
              {' '}ou{' '}
              <button type="button" onClick={incluirFaltantes} style={{ ...botao('secundario'), minHeight: '28px', marginLeft: '4px' }}>
                incluir todas as contas do modelo
              </button>
            </>
          )}
          .
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <input
              type="search"
              placeholder="Buscar conta, código, grupo ou descrição..."
              value={busca}
              onChange={evento => setBusca(evento.target.value)}
              aria-label="Buscar na planilha"
              style={{ ...campo, maxWidth: '360px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: COR.azul, cursor: 'pointer' }}>
              <input type="checkbox" checked={somenteComValor} onChange={evento => setSomenteComValor(evento.target.checked)} />
              Mostrar só linhas com valor
            </label>
            {filtroAtivo && (
              <span style={{ fontSize: '12px', color: '#B45309', fontWeight: 600 }}>
                Filtro ativo: exibindo {linhasVisiveis.length} de {linhas.length} linhas (subtotais da tabela consideram só as exibidas; os cartões acima mostram o total da planilha).
              </span>
            )}
          </div>
          {editavel && (
            <div style={{ fontSize: '12px', color: COR.texto2, marginBottom: '8px' }}>
              Dica: digite os valores (ex.: 1.500,00) ou cole uma linha copiada do Excel na célula de janeiro. Ao lado do nome de cada conta, ⇉ preenche todos os meses com o valor de janeiro e ✕ remove a linha. Use “Exibir” para alternar entre os semestres.
              {codigosCalculados.length > 0 && ' Linhas marcadas com ƒ são calculadas automaticamente (ex.: impostos) e não aceitam digitação.'}
            </div>
          )}
          {linhasVisiveis.length === 0 ? (
            <div style={{ ...cartao, textAlign: 'center', color: COR.texto2, fontSize: '13.5px' }}>
              Nenhuma linha atende ao filtro.
            </div>
          ) : (
            <TabelaOrcamento
              linhas={linhasVisiveis}
              ano={ano}
              somenteLeitura={somenteLeitura}
              chavesAlteradas={chavesAlteradas}
              calculadas={calculadas}
              destacadas={destacadas}
              onAlterarValor={alterarValor}
              onColarValores={colarValores}
              onAlterarDescricao={alterarDescricao}
              onRepetirJaneiro={repetirJaneiro}
              onRemover={removerLinha}
            />
          )}
        </>
      )}

      <div style={{ marginTop: '16px' }}>
        <PainelAlteracoes
          alteracoes={alteracoesLog}
          carregando={carregandoLog}
          desde={planilha.dataDevolucao || undefined}
          modoInicial={planilha.status === STATUS_PLANILHA.devolvida ? 'todas' : 'desde'}
          titulo={planilha.status === STATUS_PLANILHA.devolvida ? 'Linhas alteradas na planilha' : 'Log de alterações'}
          aberto={planilha.status === STATUS_PLANILHA.devolvida}
        />
      </div>

      {modalAberto && (
        <AdicionarLinhaModal
          codigosNaPlanilha={linhas.map(linha => linha.codigo)}
          gruposPermitidos={gruposDaArea(planilha.areaId)}
          codigosCalculados={codigosCalculados}
          quantidadeFaltantes={contasFaltantes.length}
          onIncluirFaltantes={incluirFaltantes}
          onAdicionar={adicionarLinha}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </>
  );
};

export default MinhaPlanilhaView;
