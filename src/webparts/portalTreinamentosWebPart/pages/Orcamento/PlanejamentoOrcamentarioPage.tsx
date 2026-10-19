import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IAreaOrcamento,
  IConfigArea,
  OrcamentoService
} from '../../services/orcamento/OrcamentoService';

import {
  anoPadraoOrcamento
} from '../../services/orcamento/esquemaOrcamento';

import {
  IRegraCalculo
} from '../../services/orcamento/calculoOrcamento';

import {
  OrcamentoFluxoService
} from '../../services/orcamento/OrcamentoFluxoService';

import MinhaPlanilhaView from './MinhaPlanilhaView';
import AprovacoesView from './AprovacoesView';
import TodasPlanilhasView from './TodasPlanilhasView';
import ContasPorAreaView from './ContasPorAreaView';
import RegrasCalculoView from './RegrasCalculoView';

import {
  COR,
  CaixaMensagem,
  FONTE,
  cartao,
  estiloAba,
  estiloRaizTela,
  explicarErro
} from './orcamentoComum';

// ============================================================
// PLANEJAMENTO ORÇAMENTÁRIO
//
// Abas:
//   • Minha planilha        → todos com acesso ao módulo. Uma
//                             planilha por área em que a pessoa é
//                             gestora (ou "Geral" sem área).
//   • Todas as planilhas    → Administrador: lista, 👁 ver,
//                             devolver (motivo + prazo de 2 dias
//                             úteis), log de alterações e
//                             👁 consolidado mês a mês.
//   • Contas por área       → Administrador: grupos que cada área
//                             preenche.
//   • Regras de cálculo     → Administrador: contas calculadas
//                             (ex.: impostos = % da Receita bruta).
//
// A proteção dos dados está nas Security Roles do Dataverse — ver
// scripts/dataverse/criar-tabelas-orcamento.ps1.
// ============================================================

export interface IPlanejamentoOrcamentarioPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

type Aba = 'minha' | 'aprovacoes' | 'todas' | 'contas' | 'regras';

const PlanejamentoOrcamentarioPage: React.FC<IPlanejamentoOrcamentarioPageProps> = (props) => {

  const { dataverseService, contexto } = props;

  // Administrador global: todas as áreas. Administrador da área: as
  // mesmas visões de administração, só com as áreas que administra.
  // Regras de cálculo (valem para todas as áreas) só o global.
  const ehAdminGlobal = !!contexto && contexto.perfil === 'Administrador';
  const areasAdministradas =
    React.useMemo(
      () => (contexto && !ehAdminGlobal ? (contexto.areasAdministrador || []).map(id => id.replace(/[{}]/g, '').toLowerCase()) : undefined),
      [contexto, ehAdminGlobal]
    );
  const ehAdmin = ehAdminGlobal || (!!areasAdministradas && areasAdministradas.length > 0);

  const servico =
    React.useMemo(
      () => (dataverseService ? new OrcamentoService(dataverseService) : undefined),
      [dataverseService]
    );

  // Fluxo de aprovação (processo CONT-001).
  const fluxo =
    React.useMemo(
      () => (dataverseService && servico ? new OrcamentoFluxoService(dataverseService, servico) : undefined),
      [dataverseService, servico]
    );

  const [fluxoAtivo, setFluxoAtivo] = React.useState(false);
  const [motivoFluxo, setMotivoFluxo] = React.useState('');
  const [qtdAprovacoes, setQtdAprovacoes] = React.useState(0);

  const anoInicial = anoPadraoOrcamento();
  const anosDisponiveis = [anoInicial - 1, anoInicial, anoInicial + 1];

  const [aba, setAba] = React.useState<Aba>('minha');
  const [ano, setAno] = React.useState<number>(anoInicial);

  // Configuração compartilhada pelas abas.
  const [regras, setRegras] = React.useState<IRegraCalculo[]>([]);
  const [configs, setConfigs] = React.useState<IConfigArea[]>([]);
  const [areas, setAreas] = React.useState<IAreaOrcamento[]>([]);
  const [carregandoConfig, setCarregandoConfig] = React.useState(true);
  const [alertaConfig, setAlertaConfig] = React.useState('');

  // Alterações não salvas na "Minha planilha".
  const pendenciasRef = React.useRef(0);

  const aoMudarPendencias = React.useCallback((quantidade: number): void => {
    pendenciasRef.current = quantidade;
  }, []);

  React.useEffect(() => {
    const antesDeSair = (evento: BeforeUnloadEvent): string | undefined => {
      if (pendenciasRef.current > 0) {
        evento.preventDefault();
        evento.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', antesDeSair);
    return () => window.removeEventListener('beforeunload', antesDeSair);
  }, []);

  const confirmarDescarte = (): boolean =>
    pendenciasRef.current === 0 ||
    window.confirm('Existem alterações não salvas na sua planilha. Deseja descartá-las?');

  // Regras e contas por área: se as tabelas ainda não existirem, a
  // planilha funciona sem elas (todas as contas, nada calculado).
  const carregarRegras = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    try {
      setRegras(await servico.listarRegras());
    } catch (falha) {
      setRegras([]);
      setAlertaConfig(atual => atual || `Regras de cálculo indisponíveis — as contas calculadas ficam abertas para digitação. ${explicarErro(falha)}`);
    }
  }, [servico]);

  const carregarConfigs = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      return;
    }
    try {
      setConfigs(await servico.listarConfigAreas());
    } catch (falha) {
      setConfigs([]);
      setAlertaConfig(atual => atual || `Contas por área indisponíveis — as planilhas usam todas as contas. ${explicarErro(falha)}`);
    }
  }, [servico]);

  React.useEffect(() => {
    if (!servico) {
      return;
    }
    let ativo = true;
    setCarregandoConfig(true);
    setAlertaConfig('');
    Promise.all([
      carregarRegras(),
      carregarConfigs(),
      fluxo
        ? fluxo.verificar().then(resultado => {
          if (ativo) {
            setFluxoAtivo(resultado.ativo);
            setMotivoFluxo(resultado.motivo);
          }
        }).catch(() => undefined)
        : Promise.resolve(),
      ehAdmin
        ? servico.listarAreas().then(lista => {
          if (ativo) {
            setAreas(areasAdministradas ? lista.filter(area => areasAdministradas.indexOf(area.id) >= 0) : lista);
          }
        }).catch(() => undefined)
        : Promise.resolve()
    ])
      .catch(() => undefined)
      .then(() => { if (ativo) { setCarregandoConfig(false); } })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [servico, fluxo, ehAdmin, areasAdministradas, carregarRegras, carregarConfigs]);

  // Quantas aprovações aguardam o usuário no ano (mostra a aba).
  const contarAprovacoes = React.useCallback(async (): Promise<void> => {
    if (!servico || !fluxo || !contexto || !fluxoAtivo) {
      setQtdAprovacoes(0);
      return;
    }
    try {
      const planilhas = await servico.listarPlanilhas(ano);
      setQtdAprovacoes((await fluxo.pendenciasDoUsuario(planilhas, contexto)).length);
    } catch {
      setQtdAprovacoes(0);
    }
  }, [servico, fluxo, contexto, fluxoAtivo, ano]);

  React.useEffect(() => {
    contarAprovacoes().catch(() => undefined);
  }, [contarAprovacoes]);

  const aoAlterarFluxo = React.useCallback((): void => {
    contarAprovacoes().catch(() => undefined);
  }, [contarAprovacoes]);

  const trocarAno = (novoAno: number): void => {
    if (novoAno === ano || !confirmarDescarte()) {
      return;
    }
    pendenciasRef.current = 0;
    setAno(novoAno);
  };

  const trocarAba = (nova: Aba): void => {
    if (nova === aba) {
      return;
    }
    if (aba === 'minha' && !confirmarDescarte()) {
      return;
    }
    pendenciasRef.current = 0;
    setAba(nova);
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  if (!servico || !contexto) {
    return (
      <div style={{ ...cartao, fontFamily: FONTE, color: COR.texto2 }}>
        Carregando as permissões do usuário...
      </div>
    );
  }

  if (!contexto.usuarioId) {
    return (
      <div style={{ ...cartao, fontFamily: FONTE, color: COR.perigo }}>
        Seu usuário não está cadastrado no portal (tabela dgt_usuario). Peça a um administrador para cadastrá-lo em Usuários e acessos.
      </div>
    );
  }

  // "Aprovações" aparece para quem tem etapa aguardando (ou para o
  // Administrador, quando o fluxo está ativo).
  const mostrarAprovacoes = fluxoAtivo && (ehAdmin || qtdAprovacoes > 0 || aba === 'aprovacoes');

  const abas: Array<{ chave: Aba; titulo: string }> = [
    { chave: 'minha' as Aba, titulo: 'Minha planilha' }
  ]
    .concat(mostrarAprovacoes ? [{ chave: 'aprovacoes' as Aba, titulo: `Aprovações${qtdAprovacoes > 0 ? ` (${qtdAprovacoes})` : ''}` }] : [])
    .concat(ehAdmin
      ? [
        { chave: 'todas' as Aba, titulo: 'Todas as planilhas' },
        { chave: 'contas' as Aba, titulo: 'Contas por área' }
      ].concat(ehAdminGlobal ? [{ chave: 'regras' as Aba, titulo: 'Regras de cálculo' }] : [])
      : []);

  const conteudo = (): React.ReactNode => {

    if (carregandoConfig || !fluxo) {
      return <div style={{ ...cartao, color: COR.texto2 }}>Carregando a configuração do orçamento...</div>;
    }

    if (aba === 'aprovacoes' && fluxoAtivo) {
      return (
        <AprovacoesView
          servico={servico}
          fluxo={fluxo}
          contexto={contexto}
          ano={ano}
          regras={regras}
          onQuantidade={setQtdAprovacoes}
        />
      );
    }

    if (aba === 'todas' && ehAdmin) {
      return (
        <TodasPlanilhasView
          servico={servico}
          contexto={contexto}
          ano={ano}
          areas={areas}
          regras={regras}
          fluxo={fluxo}
          fluxoAtivo={fluxoAtivo}
          onFluxoAlterado={aoAlterarFluxo}
          areasPermitidas={areasAdministradas}
        />
      );
    }

    if (aba === 'contas' && ehAdmin) {
      return <ContasPorAreaView servico={servico} areas={areas} configs={configs} onSalvo={carregarConfigs} />;
    }

    if (aba === 'regras' && ehAdminGlobal) {
      return <RegrasCalculoView servico={servico} regras={regras} onSalvo={carregarRegras} />;
    }

    return (
      <MinhaPlanilhaView
        servico={servico}
        contexto={contexto}
        ano={ano}
        regras={regras}
        configs={configs}
        onPendencias={aoMudarPendencias}
        fluxo={fluxo}
        fluxoAtivo={fluxoAtivo}
        onFluxoAlterado={aoAlterarFluxo}
      />
    );
  };

  return (
    // Zoom de 80% e largura contida (ver estiloRaizTela).
    <section style={estiloRaizTela}>

      {/* Cabeçalho */}
      <div
        style={{
          background: COR.azul,
          color: '#FFFFFF',
          borderRadius: '14px',
          padding: '22px 24px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: COR.ciano, textTransform: 'uppercase', letterSpacing: '.6px' }}>
            Gestão
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
            Planejamento orçamentário
          </div>
          <div style={{ fontSize: '13.5px', opacity: 0.85, marginTop: '4px' }}>
            {ehAdminGlobal
              ? 'Preencha as suas planilhas, acompanhe as de todos os gestores e configure contas por área e regras de cálculo.'
              : ehAdmin
                ? 'Preencha as suas planilhas e administre as das áreas em que você é Administrador da área.'
              : 'Preencha o orçamento de cada área sob sua gestão, mês a mês. Só você e os administradores veem estas planilhas.'}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          Ano
          <select
            value={ano}
            onChange={evento => trocarAno(Number(evento.target.value))}
            style={{ padding: '7px 10px', borderRadius: '6px', border: 0, fontSize: '14px', fontWeight: 700, color: COR.azul, fontFamily: FONTE }}
            aria-label="Ano do orçamento"
          >
            {anosDisponiveis.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Abas: o Administrador vê todas; os demais veem "Aprovações"
          quando têm etapa do fluxo aguardando. */}
      {abas.length > 1 && (
        <div role="tablist" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', overflowX: 'auto' }}>
          {abas.map(item => (
            <button
              key={item.chave}
              type="button"
              role="tab"
              aria-selected={aba === item.chave}
              onClick={() => trocarAba(item.chave)}
              style={estiloAba(aba === item.chave)}
            >
              {item.titulo}
            </button>
          ))}
        </div>
      )}

      <CaixaMensagem tipo="alerta" texto={alertaConfig} />

      {/* Só o Administrador vê por que o fluxo CONT-001 não está ativo. */}
      {ehAdmin && !carregandoConfig && !fluxoAtivo && motivoFluxo && (
        <CaixaMensagem tipo="info" texto={`Fluxo de aprovação: ${motivoFluxo}`} />
      )}

      {conteudo()}
    </section>
  );
};

export default PlanejamentoOrcamentarioPage;
