import * as React from 'react';

import { ITreinamento } from '../../../models/Treinamento';
import { IDocumento } from '../../../models/Documento';
import Loading from '../../../components/common/Loading';
import ErrorMessage from '../../../components/common/ErrorMessage';

import {
  IEventoCalendario
} from '../../../services/microsoft365/CalendarService';

import ModuloCabecalho, {
  CABECALHOS_MODULO
} from '../../../components/layout/ModuloCabecalho';

import {
  Icones,
  IconeChave
} from '../../../components/common/Icones';

import {
  DataverseService
} from '../../../services/DataverseService';

import {
  IContextoAcesso
} from '../../../services/AutorizacaoService';

import {
  podeAcessarRota
} from '../../../services/RoutePermissionService';

import {
  obterMenuArquitetura,
  obterMenuLicitacoes
} from '../../../services/MenuPermissionService';

import {
  FEATURE_FLAGS
} from '../../../constants/featureFlags';

import {
  AvisosService
} from '../../../services/notificacoes/AvisosService';

import {
  IAviso,
  PREFERENCIAS_PADRAO
} from '../../../services/notificacoes/preferenciasNotificacoes';

import {
  diaBrasilia,
  formatarHoraBrasilia,
  mesCurtoBrasilia,
  rotuloDiaRelativo
} from '../../../utils/fusoHorario';

// ============================================================
// INÍCIO DA INTRANET
//
//   hero do módulo (compartilhado)
//   ┌ Seu dia (faixa azul) ─────────────────┬ Próximos compromissos ┐
//   └ saudação + o que precisa de você      └ agenda do Outlook      ┘
//   Módulos da plataforma (só os que a pessoa pode acessar)
//   ┌ Aguardando você ──────────────┐ ┌ Meus treinamentos ┐
//   │ etapas de fluxo, prazos,      │ │ Documentos vigentes│
//   └ orçamento, licitações         ┘ └────────────────────┘
//
// Identidade DGT: azul 202A44, ciano 05C3DD, índigo 485CC7 para o que
// pede atenção, cinzas 888B8D / D9D9D6. Sem verde e vermelho: estados
// se distinguem por ícone, rótulo e peso.
// ============================================================

export interface IInicioPageProps {
  primeiroNome: string;
  treinamentos: ITreinamento[];
  documentos: IDocumento[];
  carregando: boolean;
  erro: string;
  quantidadeTrilhas: number;

  eventosCalendario:
    IEventoCalendario[];

  carregandoCalendario:
    boolean;

  erroCalendario:
    string;

  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;
  onVerDocumentos: () => void;

  // Opcional: abre a tela do documento direto do painel.
  onAbrirDocumento?: (documento: IDocumento) => void;

  // Opcionais (novos): módulos da plataforma e "Aguardando você".
  // Sem eles a tela continua funcionando só com treinamentos e
  // documentos.
  contextoAcesso?: IContextoAcesso;
  dataverseService?: DataverseService;
  onNavegar?: (pagina: string) => void;
  onAbrirDocumentoPorId?: (documentoId: string) => Promise<boolean | void> | boolean | void;
}

// ------------------------------------------------------------
// Módulos
// ------------------------------------------------------------

interface IModuloInicio {
  titulo: string;
  descricao: string;
  icone: IconeChave;
  pagina: string;
}

interface IGrupoModulos {
  nome: string;
  modulos: IModuloInicio[];
}

const montarGrupos = (
  contexto: IContextoAcesso | undefined
): IGrupoModulos[] => {

  // Mesmo critério do menu lateral: sem contexto carregado, mostra.
  const pode = (pagina: string): boolean =>
    !contexto || podeAcessarRota(pagina, contexto);

  const licitacoes = obterMenuLicitacoes(contexto);
  const arquitetura = obterMenuArquitetura(contexto);

  const grupos: IGrupoModulos[] = [
    {
      nome: 'Conhecimento',
      modulos: [
        { titulo: 'Treinamentos', descricao: 'Trilhas, cursos, avaliações e certificados', icone: 'graduationCap', pagina: 'treinamentosVisaoGeral' },
        { titulo: 'Documentos', descricao: 'POPs, instruções, políticas e manuais', icone: 'fileText', pagina: 'documentos' },
        ...(FEATURE_FLAGS.FLUXO_CONFIGURAVEL_TESTE
          ? [{ titulo: 'Processos', descricao: 'Mapeamento e fluxos de processos', icone: 'workflow' as IconeChave, pagina: 'processos' }]
          : [])
      ]
    },
    {
      nome: 'Comercial e projetos',
      modulos: [
        ...(licitacoes.length > 0
          ? [{ titulo: 'Licitações', descricao: 'Editais do PNCP e acompanhamento', icone: 'gavel' as IconeChave, pagina: licitacoes[0].pagina }]
          : []),
        ...(arquitetura.length > 0
          ? [{ titulo: 'Arquitetura de Soluções', descricao: 'B.O.M. e registros de oportunidade', icone: 'building' as IconeChave, pagina: arquitetura[0].pagina }]
          : []),
        { titulo: 'Kits', descricao: 'Catálogo de equipamentos e composição', icone: 'package', pagina: 'kits' },
        { titulo: 'Cálculo de HH', descricao: 'Homem-hora por área para o B.O.M.', icone: 'clock', pagina: 'calculoHH' },
        { titulo: 'CRM', descricao: 'Contas, contatos, leads e oportunidades', icone: 'briefcase', pagina: 'crm' }
      ]
    },
    {
      nome: 'Gestão e pessoas',
      modulos: [
        { titulo: 'Planejamento orçamentário', descricao: 'Planilhas e aprovação do orçamento', icone: 'wallet', pagina: 'planejamentoOrcamentario' },
        { titulo: 'Indicadores', descricao: 'Resultados e conformidade', icone: 'barChart', pagina: 'indicadores' },
        { titulo: 'RH e Pessoas', descricao: 'Certificados e informações dos colaboradores', icone: 'users', pagina: 'rhPessoas' }
      ]
    }
  ];

  return grupos
    .map(grupo => ({
      ...grupo,
      modulos: grupo.modulos.filter(modulo => pode(modulo.pagina))
    }))
    .filter(grupo => grupo.modulos.length > 0);
};

// ------------------------------------------------------------
// Avisos ("Aguardando você")
// ------------------------------------------------------------

const TIPO_AVISO: Record<string, { rotulo: string; icone: IconeChave }> = {
  fluxo: { rotulo: 'Etapa de fluxo', icone: 'workflow' },
  treinamentos: { rotulo: 'Treinamento', icone: 'graduationCap' },
  orcamento: { rotulo: 'Orçamento', icone: 'wallet' },
  licitacoes: { rotulo: 'Licitação', icone: 'gavel' }
};

const MAXIMO_AVISOS = 6;

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const normalizar = (
  valor: string
): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const plural = (
  quantidade: number,
  singular: string,
  pluralTexto: string
): string =>
  `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;

const dataPorExtenso = (): string => {
  const texto =
    new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const saudacao = (): string => {
  const hora = new Date().getHours();
  if (hora < 12) {
    return 'Bom dia';
  }
  if (hora < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
};

const abrirUrl = (
  url: string
): void => {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

// ------------------------------------------------------------
// Estilos (escopo .dgt-inicio)
// ------------------------------------------------------------

const CSS = `
.dgt-inicio {
  --azul: #202A44;
  --ciano: #05C3DD;
  --indigo: #485CC7;
  --cinza: #888B8D;
  --linha: #D9D9D6;
  --claro-azul: #EDF0F5;
  --claro-ciano: #E6F9FC;
  --claro-indigo: #E8EAF8;
  --texto: #202A44;
  --texto-2: #5E6470;
  font-family: Barlow, 'Segoe UI', Arial, sans-serif;
  color: var(--texto);
}
.dgt-inicio * { box-sizing: border-box; }
.dgt-inicio button { font-family: inherit; }
.dgt-inicio button:focus-visible,
.dgt-inicio a:focus-visible {
  outline: 2px solid var(--ciano);
  outline-offset: 2px;
}

/* Seu dia ----------------------------------------------------- */
.dgt-inicio .ini-dia {
  margin-top: 18px;
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  background: var(--azul);
  color: #FFFFFF;
  border-radius: 12px;
  border-top: 4px solid var(--ciano);
  overflow: hidden;
}
.dgt-inicio .ini-dia-principal { padding: 26px 30px 24px; }
.dgt-inicio .ini-data {
  margin: 0;
  color: #D9D9D6;
  font-size: 13px;
}
.dgt-inicio .ini-ola {
  margin: 6px 0 0;
  font-size: 30px;
  line-height: 1.15;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.dgt-inicio .ini-resumo {
  margin: 10px 0 0;
  max-width: 58ch;
  color: #EDF0F5;
  font-size: 15px;
  line-height: 1.5;
}
.dgt-inicio .ini-fatos {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.dgt-inicio .ini-fato {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 8px;
  background: rgba(255,255,255,.04);
  color: #FFFFFF;
  font-size: 13px;
  cursor: pointer;
}
.dgt-inicio .ini-fato strong { font-size: 20px; font-weight: 600; }
.dgt-inicio .ini-fato:hover { border-color: var(--ciano); }
.dgt-inicio .ini-fato.ini-atencao strong { color: var(--ciano); }

.dgt-inicio .ini-agenda {
  padding: 22px 24px;
  background: rgba(255,255,255,.05);
  border-left: 1px solid rgba(255,255,255,.12);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dgt-inicio .ini-agenda-topo {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.dgt-inicio .ini-agenda h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: #FFFFFF;
}
.dgt-inicio .ini-link-claro {
  border: 0; padding: 0; background: transparent;
  color: var(--ciano); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-evento {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid rgba(255,255,255,.10);
}
.dgt-inicio .ini-evento:last-child { border-bottom: 0; }
.dgt-inicio .ini-evento-dia {
  text-align: center;
  padding: 5px 0;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,.22);
  line-height: 1.1;
}
.dgt-inicio .ini-evento-dia strong { display: block; font-size: 17px; font-weight: 600; }
.dgt-inicio .ini-evento-dia small { font-size: 10.5px; color: #D9D9D6; }
.dgt-inicio .ini-evento-dia.ini-hoje { background: var(--ciano); border-color: var(--ciano); color: var(--azul); }
.dgt-inicio .ini-evento-dia.ini-hoje small { color: var(--azul); }
.dgt-inicio .ini-evento-titulo {
  display: block; font-size: 13.5px; font-weight: 600; color: #FFFFFF;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dgt-inicio .ini-evento-meta { display: block; margin-top: 2px; font-size: 12px; color: #D9D9D6; }
.dgt-inicio .ini-evento-acao {
  margin-top: 6px; padding: 4px 10px; border-radius: 6px;
  border: 1px solid var(--ciano); background: transparent;
  color: var(--ciano); font-size: 11.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-agenda-vazia { margin-top: 14px; color: #D9D9D6; font-size: 13px; line-height: 1.5; }

/* Seções ------------------------------------------------------ */
.dgt-inicio .ini-secao-titulo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 12px;
}
.dgt-inicio .ini-secao-titulo h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--azul);
  padding-bottom: 6px;
  border-bottom: 3px solid var(--ciano);
}
.dgt-inicio .ini-link {
  border: 0; padding: 0; background: transparent;
  color: var(--indigo); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-link:hover { text-decoration: underline; }

/* Módulos ----------------------------------------------------- */
.dgt-inicio .ini-grupos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}
.dgt-inicio .ini-grupo {
  background: #FFFFFF;
  border: 1px solid var(--linha);
  border-radius: 10px;
  padding: 14px;
}
.dgt-inicio .ini-grupo h3 {
  margin: 0 0 8px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cinza);
}
.dgt-inicio .ini-modulo {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 9px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--texto);
  text-align: left;
  cursor: pointer;
}
.dgt-inicio .ini-modulo:hover { background: var(--claro-ciano); border-color: var(--ciano); }
.dgt-inicio .ini-modulo-icone {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--claro-azul); color: var(--azul);
}
.dgt-inicio .ini-modulo:hover .ini-modulo-icone { background: var(--azul); color: #FFFFFF; }
.dgt-inicio .ini-modulo strong { display: block; font-size: 14px; font-weight: 600; }
.dgt-inicio .ini-modulo small { display: block; margin-top: 1px; font-size: 12px; color: var(--texto-2); }

/* Grade de trabalho ------------------------------------------ */
.dgt-inicio .ini-trabalho {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.dgt-inicio .ini-coluna { display: grid; gap: 16px; min-width: 0; }
.dgt-inicio .ini-painel {
  background: #FFFFFF;
  border: 1px solid var(--linha);
  border-radius: 10px;
  padding: 18px 20px;
  min-width: 0;
}
.dgt-inicio .ini-painel-topo {
  display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  margin-bottom: 8px;
}
.dgt-inicio .ini-painel-topo h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--azul); }

.dgt-inicio .ini-aviso {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #EDF0F5;
}
.dgt-inicio .ini-aviso:last-child { border-bottom: 0; }
.dgt-inicio .ini-aviso-icone {
  width: 34px; height: 34px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--claro-indigo); color: var(--indigo);
}
.dgt-inicio .ini-aviso-tipo { font-size: 11.5px; color: var(--indigo); font-weight: 600; }
.dgt-inicio .ini-aviso-titulo {
  display: block; margin-top: 1px; font-size: 14px; font-weight: 600; color: var(--azul);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dgt-inicio .ini-aviso-detalhe { display: block; margin-top: 2px; font-size: 12.5px; color: var(--texto-2); line-height: 1.4; }
.dgt-inicio .ini-botao {
  padding: 7px 14px; border-radius: 7px; border: 1px solid var(--azul);
  background: #FFFFFF; color: var(--azul); font-size: 12.5px; font-weight: 600; cursor: pointer;
  white-space: nowrap;
}
.dgt-inicio .ini-botao:hover { background: var(--azul); color: #FFFFFF; }
.dgt-inicio .ini-botao-primario {
  width: 100%; margin-top: 16px; padding: 11px 14px; border: 0; border-radius: 8px;
  background: var(--azul); color: #FFFFFF; font-size: 13.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-botao-primario:hover { box-shadow: inset 0 -3px 0 var(--ciano); }
.dgt-inicio .ini-vazio {
  padding: 18px 16px; border-radius: 8px; background: #F2F2F2;
  color: var(--texto-2); font-size: 13.5px; line-height: 1.5;
}
.dgt-inicio .ini-vazio strong { display: block; color: var(--azul); font-size: 14px; margin-bottom: 2px; }

/* Treinamentos ----------------------------------------------- */
.dgt-inicio .ini-progresso-numero { font-size: 34px; font-weight: 600; line-height: 1; color: var(--azul); }
.dgt-inicio .ini-progresso-legenda { font-size: 13px; color: var(--texto-2); }
.dgt-inicio .ini-barra {
  display: flex; height: 10px; margin-top: 12px; border-radius: 5px; overflow: hidden;
  background: #EDF0F5;
}
.dgt-inicio .ini-barra span { height: 100%; }
.dgt-inicio .ini-legenda { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-top: 12px; }
.dgt-inicio .ini-legenda div { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--texto-2); }
.dgt-inicio .ini-legenda i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.dgt-inicio .ini-legenda b { margin-left: auto; color: var(--azul); font-weight: 600; }
.dgt-inicio .ini-continuar {
  margin-top: 14px; padding: 12px 14px; border-radius: 8px; background: var(--claro-azul);
}
.dgt-inicio .ini-continuar small { display: block; font-size: 12px; color: var(--texto-2); }
.dgt-inicio .ini-continuar strong {
  display: block; margin-top: 2px; font-size: 14px; font-weight: 600; color: var(--azul);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Documentos ------------------------------------------------- */
.dgt-inicio .ini-doc {
  display: block; width: 100%; padding: 10px 2px; border: 0; border-bottom: 1px solid #EDF0F5;
  background: transparent; text-align: left; cursor: pointer; color: var(--texto);
}
.dgt-inicio .ini-doc:last-child { border-bottom: 0; }
.dgt-inicio .ini-doc:hover strong { color: var(--indigo); }
.dgt-inicio .ini-doc strong {
  display: block; font-size: 13.5px; font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dgt-inicio .ini-doc small { display: block; margin-top: 2px; font-size: 12px; color: var(--texto-2); }
.dgt-inicio .ini-doc code { font-family: inherit; font-weight: 600; color: var(--azul); }

.dgt-inicio .ini-rodape { margin: 18px 0 0; color: var(--cinza); font-size: 11.5px; text-align: right; }

/* Responsivo ------------------------------------------------- */
@media (max-width: 1100px) {
  .dgt-inicio .ini-dia,
  .dgt-inicio .ini-trabalho { grid-template-columns: minmax(0, 1fr); }
  .dgt-inicio .ini-agenda { border-left: 0; border-top: 1px solid rgba(255,255,255,.12); }
}
@media (max-width: 560px) {
  .dgt-inicio .ini-dia-principal { padding: 22px 20px; }
  .dgt-inicio .ini-ola { font-size: 25px; }
  .dgt-inicio .ini-aviso { grid-template-columns: 34px minmax(0, 1fr); }
  .dgt-inicio .ini-aviso .ini-botao { grid-column: 2; justify-self: start; }
}
`;

// ============================================================
// PÁGINA
// ============================================================

const InicioIntranetPage: React.FC<IInicioPageProps> = ({
  primeiroNome,
  treinamentos,
  documentos,
  carregando,
  erro,
  eventosCalendario,
  carregandoCalendario,
  erroCalendario,
  onAbrirTreinamento,
  onVerTreinamentos,
  onVerDocumentos,
  onAbrirDocumento,
  contextoAcesso,
  dataverseService,
  onNavegar,
  onAbrirDocumentoPorId
}) => {

  // ---------------- Aguardando você ----------------
  const [avisos, setAvisos] =
    React.useState<IAviso[]>([]);

  const [carregandoAvisos, setCarregandoAvisos] =
    React.useState(false);

  const [avisosDisponiveis, setAvisosDisponiveis] =
    React.useState(true);

  React.useEffect(
    () => {
      if (!dataverseService || !contextoAcesso) {
        setAvisosDisponiveis(false);
        return undefined;
      }

      let ativo = true;
      setAvisosDisponiveis(true);
      setCarregandoAvisos(true);

      new AvisosService(dataverseService)
        .coletar(contextoAcesso, PREFERENCIAS_PADRAO, [])
        .then(lista => {
          if (ativo) {
            // "Novo treinamento atribuído" já aparece em Meus
            // treinamentos; aqui ficam só os prazos e o que pede ação.
            setAvisos(lista.filter(aviso => aviso.id.indexOf('trn-novo:') !== 0));
          }
        })
        .catch(erroAvisos => {
          console.error('[Início] Não foi possível ler o que aguarda o usuário.', erroAvisos);
          if (ativo) {
            setAvisos([]);
          }
        })
        .then(() => {
          if (ativo) {
            setCarregandoAvisos(false);
          }
        })
        .catch(() => undefined);

      return () => {
        ativo = false;
      };
    },
    [dataverseService, contextoAcesso]
  );

  const abrirAviso = (
    aviso: IAviso
  ): void => {
    const acao = aviso.acao;

    if (!acao) {
      return;
    }

    if (acao.documentoId && onAbrirDocumentoPorId) {
      Promise.resolve(onAbrirDocumentoPorId(acao.documentoId))
        .then(abriu => {
          if (abriu === false && acao.pagina && onNavegar) {
            onNavegar(acao.pagina);
          }
        })
        .catch(() => {
          if (acao.pagina && onNavegar) {
            onNavegar(acao.pagina);
          }
        });
      return;
    }

    if (acao.pagina && onNavegar) {
      onNavegar(acao.pagina);
    }
  };

  // ---------------- Treinamentos ----------------
  const concluidos = treinamentos.filter(item => item.status === 'Concluído').length;
  // Reprovado conta como "em andamento": a pessoa ainda precisa refazer.
  const andamento = treinamentos.filter(item => item.status === 'Em andamento' || item.status === 'Reprovado').length;
  const pendentes = treinamentos.filter(item => item.status === 'Disponível').length;
  const vencidos = treinamentos.filter(item => item.status === 'Vencido').length;
  const total = concluidos + andamento + pendentes + vencidos;
  const percentual = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const aFazer = andamento + pendentes + vencidos;

  const continuar =
    treinamentos.find(item => item.status === 'Em andamento') ||
    treinamentos.find(item => item.status === 'Vencido') ||
    treinamentos.find(item => item.status === 'Disponível');

  const segmentos = [
    { rotulo: 'Concluídos', valor: concluidos, cor: '#202A44' },
    { rotulo: 'Em andamento', valor: andamento, cor: '#05C3DD' },
    { rotulo: 'A iniciar', valor: pendentes, cor: '#888B8D' },
    { rotulo: 'Vencidos', valor: vencidos, cor: '#485CC7' }
  ];

  // ---------------- Documentos ----------------
  const documentosVigentes =
    documentos.filter(
      documento => normalizar(documento.status) === 'vigente'
    );

  // ---------------- Módulos ----------------
  const grupos =
    React.useMemo(
      () => montarGrupos(contextoAcesso),
      [contextoAcesso]
    );

  const navegar = (pagina: string): void => {
    if (onNavegar) {
      onNavegar(pagina);
      return;
    }
    if (pagina === 'documentos') {
      onVerDocumentos();
    } else {
      onVerTreinamentos();
    }
  };

  // ---------------- Resumo do dia ----------------
  const qtdAvisos = avisos.length;

  const partesResumo: string[] = [];

  if (avisosDisponiveis && !carregandoAvisos) {
    partesResumo.push(
      qtdAvisos > 0
        ? `${plural(qtdAvisos, 'item aguarda', 'itens aguardam')} a sua ação`
        : 'Nada aguarda a sua ação agora'
    );
  }

  if (aFazer > 0) {
    partesResumo.push(`${plural(aFazer, 'treinamento está', 'treinamentos estão')} em aberto`);
  }

  const proximoEvento = eventosCalendario[0];

  if (proximoEvento && rotuloDiaRelativo(proximoEvento.inicio) === 'Hoje') {
    partesResumo.push(
      proximoEvento.diaInteiro
        ? `hoje você tem "${proximoEvento.titulo}"`
        : `seu próximo compromisso é às ${formatarHoraBrasilia(proximoEvento.inicio)}`
    );
  }

  const resumo =
    partesResumo.length === 0
      ? 'Bem-vindo à Intranet DGT.'
      : partesResumo
        .map((parte, i) => (i === 0 ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte))
        .join(partesResumo.length === 2 ? ' e ' : ', ')
        .replace(/, ([^,]*)$/, ' e $1') + '.';

  const nome = (primeiroNome || '').trim();

  return (
    <section className="dgt-inicio">
      <style>{CSS}</style>

      {/* HERO — mesmo componente dos módulos */}
      <ModuloCabecalho
        config={CABECALHOS_MODULO.inicio}
        abas={[]}
        paginaAtual="inicio"
        navegar={() => undefined}
      />

      {/* SEU DIA */}
      <div className="ini-dia">
        <div className="ini-dia-principal">
          <p className="ini-data">{dataPorExtenso()}</p>
          <h1 className="ini-ola">
            {saudacao()}{nome ? `, ${nome}` : ''}.
          </h1>
          <p className="ini-resumo">{resumo}</p>

          <div className="ini-fatos">
            {avisosDisponiveis && (
              <button
                type="button"
                className={`ini-fato${qtdAvisos > 0 ? ' ini-atencao' : ''}`}
                onClick={() => {
                  const alvo = document.getElementById('ini-aguardando');
                  if (alvo) {
                    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <strong>{carregandoAvisos ? '…' : qtdAvisos}</strong>
                aguardando você
              </button>
            )}
            <button type="button" className="ini-fato" onClick={onVerTreinamentos}>
              <strong>{aFazer}</strong>
              {aFazer === 1 ? 'treinamento em aberto' : 'treinamentos em aberto'}
            </button>
            <button type="button" className="ini-fato" onClick={onVerDocumentos}>
              <strong>{documentosVigentes.length}</strong>
              {documentosVigentes.length === 1 ? 'documento vigente' : 'documentos vigentes'}
            </button>
          </div>
        </div>

        <aside className="ini-agenda" aria-label="Próximos compromissos">
          <div className="ini-agenda-topo">
            <h2>Próximos compromissos</h2>
            <button
              type="button"
              className="ini-link-claro"
              onClick={() => abrirUrl('https://outlook.office.com/calendar/view/week')}
            >
              Abrir agenda
            </button>
          </div>

          {carregandoCalendario && (
            <p className="ini-agenda-vazia">Carregando a sua agenda...</p>
          )}

          {!carregandoCalendario && erroCalendario && (
            <p className="ini-agenda-vazia">
              A agenda não pôde ser carregada. A permissão Calendars.Read precisa estar aprovada no SharePoint Admin Center.
            </p>
          )}

          {!carregandoCalendario && !erroCalendario && eventosCalendario.length === 0 && (
            <p className="ini-agenda-vazia">Nenhum compromisso nos próximos dias.</p>
          )}

          {!carregandoCalendario && !erroCalendario && eventosCalendario.slice(0, 3).map(evento => {
            const relativo = rotuloDiaRelativo(evento.inicio);
            const horario =
              evento.diaInteiro
                ? 'Dia inteiro'
                : `${formatarHoraBrasilia(evento.inicio)}${evento.fim ? ` às ${formatarHoraBrasilia(evento.fim)}` : ''}`;

            return (
              <div key={evento.id} className="ini-evento">
                <div className={`ini-evento-dia${relativo === 'Hoje' ? ' ini-hoje' : ''}`}>
                  <strong>{diaBrasilia(evento.inicio)}</strong>
                  <small>{mesCurtoBrasilia(evento.inicio)}</small>
                </div>
                <div style={{ minWidth: 0 }}>
                  <span className="ini-evento-titulo" title={evento.titulo}>{evento.titulo}</span>
                  <span className="ini-evento-meta">
                    {relativo ? `${relativo}, ` : ''}{horario}
                    {evento.local ? ` (${evento.local})` : ''}
                  </span>
                  {evento.joinUrl
                    ? (
                      <button type="button" className="ini-evento-acao" onClick={() => abrirUrl(evento.joinUrl)}>
                        Entrar no Teams
                      </button>
                    )
                    : evento.webLink && (
                      <button type="button" className="ini-evento-acao" onClick={() => abrirUrl(evento.webLink)}>
                        Abrir evento
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </aside>
      </div>

      {/* MÓDULOS */}
      {grupos.length > 0 && (
        <>
          <div className="ini-secao-titulo">
            <h2>Módulos da plataforma</h2>
          </div>

          <div className="ini-grupos">
            {grupos.map(grupo => (
              <div key={grupo.nome} className="ini-grupo">
                <h3>{grupo.nome}</h3>
                {grupo.modulos.map(modulo => {
                  const Icone = Icones[modulo.icone];
                  return (
                    <button
                      key={modulo.pagina}
                      type="button"
                      className="ini-modulo"
                      onClick={() => navegar(modulo.pagina)}
                    >
                      <span className="ini-modulo-icone"><Icone /></span>
                      <span style={{ minWidth: 0 }}>
                        <strong>{modulo.titulo}</strong>
                        <small>{modulo.descricao}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {erro && <div style={{ marginTop: '16px' }}><ErrorMessage mensagem={erro} /></div>}

      {/* TRABALHO */}
      <div className="ini-secao-titulo">
        <h2>Seu trabalho</h2>
      </div>

      {carregando
        ? <Loading mensagem="Carregando o portal..." />
        : (
          <div className="ini-trabalho">

            {/* AGUARDANDO VOCÊ */}
            <div className="ini-coluna">
              <article className="ini-painel" id="ini-aguardando">
                <div className="ini-painel-topo">
                  <h3>Aguardando você</h3>
                  {qtdAvisos > MAXIMO_AVISOS && (
                    <span style={{ fontSize: '12.5px', color: '#5E6470' }}>
                      mostrando {MAXIMO_AVISOS} de {qtdAvisos}
                    </span>
                  )}
                </div>

                {!avisosDisponiveis && (
                  <div className="ini-vazio">
                    As pendências de fluxo, orçamento e licitações aparecem aqui assim que o seu acesso for carregado.
                  </div>
                )}

                {avisosDisponiveis && carregandoAvisos && (
                  <div className="ini-vazio">Verificando etapas de fluxo, prazos e alterações...</div>
                )}

                {avisosDisponiveis && !carregandoAvisos && qtdAvisos === 0 && (
                  <div className="ini-vazio">
                    <strong>Você está em dia.</strong>
                    Nenhuma etapa de fluxo, prazo de treinamento, orçamento ou licitação aguarda você.
                  </div>
                )}

                {avisosDisponiveis && !carregandoAvisos && avisos.slice(0, MAXIMO_AVISOS).map(aviso => {
                  const tipo = TIPO_AVISO[aviso.tipo] || { rotulo: 'Aviso', icone: 'bell' as IconeChave };
                  const Icone = Icones[tipo.icone];

                  return (
                    <div key={aviso.id} className="ini-aviso">
                      <span className="ini-aviso-icone"><Icone /></span>
                      <span style={{ minWidth: 0 }}>
                        <span className="ini-aviso-tipo">
                          {tipo.rotulo}{aviso.data ? `, ${aviso.data}` : ''}
                        </span>
                        <span className="ini-aviso-titulo" title={aviso.titulo}>{aviso.titulo}</span>
                        {aviso.detalhe && <span className="ini-aviso-detalhe">{aviso.detalhe}</span>}
                      </span>
                      {aviso.acao && (
                        <button type="button" className="ini-botao" onClick={() => abrirAviso(aviso)}>
                          Abrir
                        </button>
                      )}
                    </div>
                  );
                })}
              </article>
            </div>

            <div className="ini-coluna">

              {/* MEUS TREINAMENTOS */}
              <article className="ini-painel">
                <div className="ini-painel-topo">
                  <h3>Meus treinamentos</h3>
                  <button type="button" className="ini-link" onClick={onVerTreinamentos}>
                    Ver todos
                  </button>
                </div>

                {total === 0
                  ? (
                    <div className="ini-vazio">
                      <strong>Nenhum treinamento atribuído.</strong>
                      Quando você receber um treinamento, ele aparece aqui.
                    </div>
                  )
                  : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <span className="ini-progresso-numero">{percentual}%</span>
                        <span className="ini-progresso-legenda">
                          concluído ({concluidos} de {total})
                        </span>
                      </div>

                      <div
                        className="ini-barra"
                        role="img"
                        aria-label={segmentos.map(s => `${s.rotulo}: ${s.valor}`).join(', ')}
                      >
                        {segmentos.filter(s => s.valor > 0).map(s => (
                          <span
                            key={s.rotulo}
                            style={{ width: `${(s.valor / total) * 100}%`, background: s.cor }}
                          />
                        ))}
                      </div>

                      <div className="ini-legenda">
                        {segmentos.map(s => (
                          <div key={s.rotulo}>
                            <i style={{ background: s.cor }} />
                            {s.rotulo}
                            <b>{s.valor}</b>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                {continuar && (
                  <div className="ini-continuar">
                    <small>
                      {continuar.status === 'Em andamento'
                        ? `Continue de onde parou (${Math.max(0, Math.min(100, continuar.progresso || 0))}%)`
                        : continuar.status === 'Vencido'
                          ? 'Treinamento vencido'
                          : 'Próximo treinamento'}
                    </small>
                    <strong title={continuar.nome}>{continuar.nome}</strong>
                  </div>
                )}

                <button
                  type="button"
                  className="ini-botao-primario"
                  onClick={() => (continuar ? onAbrirTreinamento(continuar) : onVerTreinamentos())}
                >
                  {continuar
                    ? continuar.status === 'Em andamento' ? 'Continuar treinamento' : 'Começar treinamento'
                    : 'Ver meus treinamentos'}
                </button>
              </article>

              {/* DOCUMENTOS VIGENTES */}
              <article className="ini-painel">
                <div className="ini-painel-topo">
                  <h3>Documentos vigentes</h3>
                  <button type="button" className="ini-link" onClick={onVerDocumentos}>
                    Ver todos
                  </button>
                </div>

                {documentosVigentes.length === 0
                  ? (
                    <div className="ini-vazio">Nenhum documento vigente disponível.</div>
                  )
                  : documentosVigentes.slice(0, 5).map(documento => (
                    <button
                      key={documento.id}
                      type="button"
                      className="ini-doc"
                      onClick={() => (onAbrirDocumento ? onAbrirDocumento(documento) : onVerDocumentos())}
                    >
                      <strong title={documento.titulo}>{documento.titulo}</strong>
                      <small>
                        <code>{documento.codigo}</code>
                        {documento.revisaoAtual ? ` ${documento.revisaoAtual}` : ''}
                        {documento.area ? `, ${documento.area}` : ''}
                      </small>
                    </button>
                  ))}
              </article>
            </div>
          </div>
        )}

      <p className="ini-rodape">Horários no fuso de Brasília.</p>
    </section>
  );
};

export default InicioIntranetPage;
