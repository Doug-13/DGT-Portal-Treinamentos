import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  ITreinamentoAdmin
} from '../../services/TreinamentoAdminService';

import {
  AvaliacaoAdminService
} from '../../services/AvaliacaoAdminService';

import {
  ITreinamento
} from '../../models/Treinamento';

import {
  IModuloTreinamento,
  StatusUsuarioModulo
} from '../../models/Modulo';

import {
  IResultadoAvaliacao
} from '../../models/Avaliacao';

import {
  useModulos
} from '../../hooks/useModulos';

import {
  useModuloExecucao
} from '../../hooks/useModuloExecucao';

import {
  useAvaliacao
} from '../../hooks/useAvaliacao';

import ExecutarTreinamentoPage from
  './ExecutarTreinamentoPage';

import ModuloExecucaoPage from
  './ModuloExecucaoPage';

import AvaliacaoPage from
  '../Avaliacao/AvaliacaoPage';

// ============================================================
// MODO DE TESTE DO TREINAMENTO
//
// O administrador (ou editor) percorre o treinamento exatamente como
// um colaborador: mesmas telas de treinamento, módulos, perguntas
// rápidas e avaliação.
//
// NADA É GRAVADO:
//   - não cria nem altera atribuição (dgt_usuariotreinamento);
//   - não registra progresso de módulo (dgt_usuariomodulo);
//   - não grava respostas de perguntas rápidas;
//   - a avaliação é corrigida no navegador: não cria tentativa,
//     não conclui o treinamento e NÃO GERA CERTIFICADO.
//
// Os hooks de módulo e avaliação só gravam quando recebem o id da
// atribuição; aqui eles são chamados sem esse id (somente leitura).
// ============================================================

export interface IModoTesteTreinamentoPageProps {
  dataverse: DataverseService;
  treinamento: ITreinamentoAdmin;
  onSair: () => void;
}

type Tela =
  | 'treinamento'
  | 'modulo'
  | 'avaliacao';

const NOME_STATUS: Record<number, string> = {
  [StatusUsuarioModulo.NaoIniciado]: 'Não iniciado',
  [StatusUsuarioModulo.EmAndamento]: 'Em andamento',
  [StatusUsuarioModulo.Concluido]: 'Concluído'
};

const guid = (
  valor: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

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

const FaixaModoTeste: React.FC<{
  onSair: () => void;
}> = ({ onSair }) => (
  <div
    role="status"
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      flexWrap: 'wrap',
      padding: '12px 16px',
      marginBottom: '16px',
      borderRadius: '10px',
      background: '#FFF4E5',
      border: '1px solid #F5C77E',
      color: '#7A3E00'
    }}
  >
    <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
      <strong>🧪 Modo de teste.</strong>{' '}
      Você está vendo este treinamento como um colaborador. Nada é registrado:
      progresso, respostas e avaliação não são gravados e nenhum certificado é gerado.
    </div>

    <button
      type="button"
      onClick={onSair}
      style={{
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px solid #B45309',
        background: '#FFFFFF',
        color: '#7A3E00',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      Sair do modo de teste
    </button>
  </div>
);

const ModoTesteTreinamentoPage: React.FC<IModoTesteTreinamentoPageProps> = (
  props
) => {

  const modulos = useModulos(props.dataverse);
  const moduloExecucao = useModuloExecucao(props.dataverse);
  const avaliacao = useAvaliacao(props.dataverse);

  const avaliacaoAdmin =
    React.useMemo(
      () => new AvaliacaoAdminService(props.dataverse),
      [props.dataverse]
    );

  const [tela, setTela] = React.useState<Tela>('treinamento');
  const [iniciado, setIniciado] = React.useState(false);
  const [statusModulos, setStatusModulos] = React.useState<Record<string, number>>({});
  const [moduloAberto, setModuloAberto] = React.useState<IModuloTreinamento | undefined>();
  const [erroExecucao, setErroExecucao] = React.useState('');

  const [resultado, setResultado] = React.useState<IResultadoAvaliacao | undefined>();
  const [corrigindo, setCorrigindo] = React.useState(false);
  const [tentativaTeste, setTentativaTeste] = React.useState(0);

  // Carrega os módulos SEM atribuição (somente leitura).
  React.useEffect(
    () => {
      setTela('treinamento');
      setIniciado(false);
      setStatusModulos({});
      setModuloAberto(undefined);
      setResultado(undefined);
      setTentativaTeste(0);
      moduloExecucao.limpar();
      avaliacao.resetar();

      void modulos.carregar(props.treinamento.id);
    },
    // Recarrega apenas ao trocar de treinamento.
    [props.treinamento.id]
  );

  // Módulos com o status LOCAL do teste.
  const modulosTeste: IModuloTreinamento[] =
    React.useMemo(
      () =>
        modulos.modulos.map(modulo => {
          const status =
            statusModulos[modulo.id] ||
            StatusUsuarioModulo.NaoIniciado;

          return {
            ...modulo,
            usuarioModuloId: '',
            statusModulo: status,
            statusModuloNome: NOME_STATUS[status] || 'Não iniciado'
          };
        }),
      [modulos.modulos, statusModulos]
    );

  const obrigatorios =
    modulosTeste.filter(m => m.ativo && m.obrigatorio);

  const concluidos =
    modulosTeste.filter(m => m.statusModulo === StatusUsuarioModulo.Concluido);

  const progresso =
    modulosTeste.length
      ? Math.round((concluidos.length / modulosTeste.length) * 100)
      : 0;

  const avaliacaoLiberada =
    modulosTeste.length > 0 &&
    (obrigatorios.length ? obrigatorios : modulosTeste)
      .every(m => m.statusModulo === StatusUsuarioModulo.Concluido);

  const treinamentoVisao: ITreinamento = {
    id: props.treinamento.id,
    usuarioTreinamentoId: '',
    nome: props.treinamento.nome,
    codigo: props.treinamento.codigo,
    descricao: props.treinamento.descricao,
    // Nunca "Concluído" no teste: a avaliação continua disponível
    // para ser refeita quantas vezes for necessário.
    status:
      iniciado
        ? 'Em andamento'
        : 'Disponível',
    progresso,
    cargaHoraria: formatarCarga(props.treinamento.cargaHorariaMin),
    cargaHorariaMin: props.treinamento.cargaHorariaMin,
    notaMinima: props.treinamento.notaMinima,
    validadeMeses: props.treinamento.validadeMeses,
    ativo: props.treinamento.ativo,
    imagem: props.treinamento.imagemUrl,
    imagemUrl: props.treinamento.imagemUrl
  } as ITreinamento;

  const definirStatus = (
    modulo: IModuloTreinamento,
    status: number
  ): void =>
    setStatusModulos(atual => ({
      ...atual,
      [modulo.id]: Math.max(atual[modulo.id] || 0, status)
    }));

  // ---------------- Módulos ----------------

  const abrirModulo = (
    modulo: IModuloTreinamento
  ): void => {
    setErroExecucao('');
    setIniciado(true);
    definirStatus(modulo, StatusUsuarioModulo.EmAndamento);
    setModuloAberto(modulo);

    // Sem o id da atribuição: carrega o conteúdo e não grava respostas.
    void moduloExecucao.carregar(modulo.id, '');

    setTela('modulo');
    window.scrollTo(0, 0);
  };

  const concluirModuloAberto = async (): Promise<void> => {
    if (moduloAberto) {
      definirStatus(moduloAberto, StatusUsuarioModulo.Concluido);
    }

    setModuloAberto(undefined);
    moduloExecucao.limpar();
    setTela('treinamento');
    window.scrollTo(0, 0);
  };

  // ---------------- Avaliação ----------------

  const iniciarAvaliacao = async (): Promise<void> => {
    setErroExecucao('');
    setResultado(undefined);

    // Sem o id da atribuição: não consulta nem consome tentativas.
    const carregou =
      await avaliacao.carregar(props.treinamento.id);

    if (!carregou) {
      setErroExecucao(
        'Não foi possível abrir a avaliação. Verifique se existe uma avaliação ativa com questões.'
      );
      return;
    }

    setTela('avaliacao');
    window.scrollTo(0, 0);
  };

  // Correção local, sem gravar tentativa nem certificado.
  const corrigirAvaliacao = (
    respostas: Record<string, string[]>
  ): void => {

    const atual = avaliacao.avaliacao;

    if (!atual) {
      return;
    }

    setCorrigindo(true);

    const corrigir = async (): Promise<void> => {
      let pontos = 0;
      let pesoTotal = 0;
      let acertos = 0;

      for (const questao of atual.questoes) {
        const alternativas =
          await avaliacaoAdmin.listarAlternativas(questao.id);

        const corretas =
          alternativas
            .filter(a => a.ativa && a.correta)
            .map(a => guid(a.id))
            .sort();

        const marcadas =
          (respostas[questao.id] || [])
            .map(guid)
            .sort();

        const acertou =
          corretas.length > 0 &&
          corretas.length === marcadas.length &&
          corretas.every((id, i) => id === marcadas[i]);

        const peso = questao.peso > 0 ? questao.peso : 1;

        pesoTotal += peso;

        if (acertou) {
          pontos += peso;
          acertos += 1;
        }
      }

      const nota =
        pesoTotal
          ? (pontos / pesoTotal) * 100
          : 0;

      const aprovado =
        nota >= (atual.notaMinima || 0);

      const numero = tentativaTeste + 1;

      setTentativaTeste(numero);

      setResultado({
        sucesso: true,
        mensagem:
          (aprovado
            ? 'Você seria APROVADO nesta avaliação. '
            : 'Você seria REPROVADO nesta avaliação. ') +
          'Você está no modo de teste: este resultado não foi registrado e este modo não gera certificado.',
        tentativaId: '',
        nota,
        acertos,
        erros: atual.questoes.length - acertos,
        aprovado,
        total: atual.questoes.length,
        numeroTentativa: numero,
        tentativasRestantes: atual.tentativasPermitidas,
        treinamentoConcluido: false,
        proximoTreinamentoLiberado: false,
        proximoTreinamentoNome: ''
      });
    };

    corrigir()
      .catch(e =>
        setErroExecucao(
          e instanceof Error
            ? `Não foi possível corrigir a avaliação de teste: ${e.message}`
            : 'Não foi possível corrigir a avaliação de teste.'
        )
      )
      .then(() => setCorrigindo(false))
      .catch(() => setCorrigindo(false));
  };

  const refazerAvaliacao = (): void => {
    setResultado(undefined);
    void iniciarAvaliacao();
  };

  // ---------------- Render ----------------

  return (
    <section>

      <FaixaModoTeste onSair={props.onSair} />

      {tela === 'treinamento' && (
        <ExecutarTreinamentoPage
          treinamento={treinamentoVisao}
          modulos={modulosTeste}
          carregandoModulos={modulos.carregando}
          erroModulos={modulos.erro}
          erroExecucao={erroExecucao}
          processandoModuloId=""
          iniciandoTreinamento={false}
          progresso={progresso}
          avaliacaoLiberada={avaliacaoLiberada}
          onVoltar={props.onSair}
          onIniciarTreinamento={() => setIniciado(true)}
          onIniciarModulo={abrirModulo}
          onAbrirModulo={abrirModulo}
          onConcluirModulo={modulo => definirStatus(modulo, StatusUsuarioModulo.Concluido)}
          onIniciarAvaliacao={() => { void iniciarAvaliacao(); }}
        />
      )}

      {tela === 'modulo' && moduloAberto && (
        <ModuloExecucaoPage
          modulo={
            modulosTeste.find(m => m.id === moduloAberto.id) || moduloAberto
          }
          conteudos={moduloExecucao.conteudos}
          carregando={moduloExecucao.carregando}
          erro={moduloExecucao.erro}
          podeConcluir={moduloExecucao.podeConcluir}
          processando={false}
          onVoltar={() => { setTela('treinamento'); window.scrollTo(0, 0); }}
          onResponderPergunta={moduloExecucao.responderPergunta}
          onConcluir={concluirModuloAberto}
        />
      )}

      {tela === 'avaliacao' && (
        <>
          {erroExecucao && (
            <div style={{ marginBottom: '14px', padding: '12px 14px', borderRadius: '8px', background: '#FDE7E9', color: '#B42318', fontSize: '13px' }}>
              {erroExecucao}
            </div>
          )}

          <AvaliacaoPage
            avaliacao={avaliacao.avaliacao}
            carregando={avaliacao.carregando}
            erro={avaliacao.erro}
            tentativas={{
              realizadas: tentativaTeste,
              permitidas: avaliacao.tentativas.permitidas,
              restantes: avaliacao.tentativas.permitidas,
              proximaTentativa: tentativaTeste + 1
            }}
            resultado={resultado}
            processando={corrigindo}
            onVoltar={() => { setResultado(undefined); setTela('treinamento'); window.scrollTo(0, 0); }}
            onEnviar={corrigirAvaliacao}
          />

          {resultado && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px 18px',
                borderRadius: '10px',
                background: '#FFF4E5',
                border: '1px solid #F5C77E',
                color: '#7A3E00',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                <strong>Você está no modo de teste.</strong>{' '}
                Este modo não gera um certificado e o resultado não fica registrado.
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={refazerAvaliacao}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #B45309', background: '#FFFFFF', color: '#7A3E00', fontWeight: 700, cursor: 'pointer' }}
                >
                  Refazer avaliação
                </button>

                <button
                  type="button"
                  onClick={props.onSair}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#B45309', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Sair do modo de teste
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default ModoTesteTreinamentoPage;
