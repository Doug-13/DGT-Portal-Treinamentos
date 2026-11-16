import * as React from 'react';

import { ITreinamento } from '../../../models/Treinamento';
import { IDocumento } from '../../../models/Documento';
import Loading from '../../../components/common/Loading';
import ErrorMessage from '../../../components/common/ErrorMessage';

import {
  IEventoCalendario
} from '../../../services/microsoft365/CalendarService';

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
  IAreaAdmin,
  IUsuarioAreaAdmin
} from '../../../services/AreaAdminService';

import {
  filtrarDocumentosVisiveis,
  obterAreasVisiveis
} from '../../../services/DocumentoVisibilidade';

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

import {
  formatarDataCurta,
  vencimentoDocumento
} from '../../../utils/vencimentoDocumento';

// ============================================================
// INÍCIO DA INTRANET — Padrão visual DGT v1
//
//   ┌ Seu dia ──────────────────────────────────┬ Agenda ───────┐
//   │ data · saudação · resumo · perfil e áreas │ próximos 3    │
//   └───────────────────────────────────────────┴───────────────┘
//   [Aguardando você] [Treinamentos] [Capacitação %] [Documentos]
//   ┌ Aguardando você (filtro por tipo, prazo) ┐ ┌ Minha capacitação ┐
//   │                                          │ │ Documentos        │
//   └──────────────────────────────────────────┘ └───────────────────┘
//   Acesso rápido (somente módulos que a pessoa pode abrir)
//
// Regras de acesso:
//   • módulos: podeAcessarRota (mesmo critério do menu lateral);
//   • documentos: filtrarDocumentosVisiveis (mesmo critério da tela
//     Documentos). Sem áreas carregadas, só aparece o que é do usuário
//     ou corporativo vigente.
//   • avisos: AvisosService já devolve só o que é da pessoa.
// ============================================================

export interface IInicioPageProps {
  primeiroNome: string;
  treinamentos: ITreinamento[];
  documentos: IDocumento[];
  carregando: boolean;
  erro: string;
  quantidadeTrilhas: number;

  eventosCalendario: IEventoCalendario[];
  carregandoCalendario: boolean;
  erroCalendario: string;

  onAbrirTreinamento: (treinamento: ITreinamento) => void;
  onVerTreinamentos: () => void;
  onVerDocumentos: () => void;

  // Opcional: abre a tela do documento direto do painel.
  onAbrirDocumento?: (documento: IDocumento) => void;

  contextoAcesso?: IContextoAcesso;
  dataverseService?: DataverseService;
  onNavegar?: (pagina: string) => void;
  onAbrirDocumentoPorId?: (documentoId: string) => Promise<boolean | void> | boolean | void;

  // Áreas e vínculos: aplicam a mesma visibilidade da tela Documentos.
  areas?: IAreaAdmin[];
  usuariosAreas?: IUsuarioAreaAdmin[];
}

// ------------------------------------------------------------
// Módulos (acesso rápido)
// ------------------------------------------------------------

interface IModuloInicio {
  titulo: string;
  descricao: string;
  icone: IconeChave;
  pagina: string;
  contador?: number;
}

interface IGrupoModulos {
  nome: string;
  modulos: IModuloInicio[];
}

const montarGrupos = (
  contexto: IContextoAcesso | undefined,
  contadores: { treinamentos: number; documentos: number; trilhas: number }
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
        { titulo: 'Treinamentos', descricao: 'Cursos, avaliações e certificados', icone: 'graduationCap', pagina: 'treinamentosVisaoGeral', contador: contadores.treinamentos },
        { titulo: 'Trilhas', descricao: 'Sequências de aprendizagem', icone: 'layers', pagina: 'trilhas', contador: contadores.trilhas },
        { titulo: 'Certificados', descricao: 'Seus certificados e validades', icone: 'award', pagina: 'certificados' },
        { titulo: 'Documentos', descricao: 'POPs, instruções, políticas e manuais', icone: 'fileText', pagina: 'documentos', contador: contadores.documentos },
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
        { titulo: 'Kits', descricao: 'Equipamentos e composição', icone: 'package', pagina: 'kits' },
        { titulo: 'Cálculo de HH', descricao: 'Homem-hora por área', icone: 'clock', pagina: 'calculoHH' },
        { titulo: 'Implantações', descricao: 'Carteira, cronogramas e equipes', icone: 'activity', pagina: 'implantacoes' },
        { titulo: 'CRM', descricao: 'Contas, contatos e oportunidades', icone: 'briefcase', pagina: 'crm' }
      ]
    },
    {
      nome: 'Gestão e pessoas',
      modulos: [
        { titulo: 'Minha equipe', descricao: 'Progresso e pendências da equipe', icone: 'users', pagina: 'equipe' },
        { titulo: 'Gestão de treinamentos', descricao: 'Criar, atribuir e acompanhar', icone: 'settings', pagina: 'gestao' },
        { titulo: 'Planejamento orçamentário', descricao: 'Planilhas e aprovação', icone: 'wallet', pagina: 'planejamentoOrcamentario' },
        { titulo: 'Indicadores', descricao: 'Resultados e conformidade', icone: 'barChart', pagina: 'indicadores' },
        { titulo: 'RH e Pessoas', descricao: 'Informações dos colaboradores', icone: 'users', pagina: 'rhPessoas' },
        { titulo: 'Fornecedores', descricao: 'Cadastro, documentos e sanções', icone: 'briefcase', pagina: 'fornecedores' }
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

type TipoFiltro = 'todos' | 'fluxo' | 'treinamentos' | 'orcamento' | 'licitacoes';

const TIPO_AVISO: Record<string, { rotulo: string; plural: string; icone: IconeChave }> = {
  fluxo: { rotulo: 'Etapa de fluxo', plural: 'Fluxos', icone: 'workflow' },
  treinamentos: { rotulo: 'Treinamento', plural: 'Treinamentos', icone: 'graduationCap' },
  orcamento: { rotulo: 'Orçamento', plural: 'Orçamento', icone: 'wallet' },
  licitacoes: { rotulo: 'Licitação', plural: 'Licitações', icone: 'gavel' }
};

const AVISOS_INICIAIS = 6;

type SituacaoPrazo = 'atrasado' | 'hoje' | 'proximo' | 'futuro' | 'sem';

interface IAvisoTela extends IAviso {
  prazoIso?: string;      // AAAA-MM-DD
  diasPrazo?: number;     // negativo = atrasado
  situacao: SituacaoPrazo;
}

const DIA_MS = 86400000;

const hojeMeiaNoite = (): number => {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
};

const diasAte = (iso: string): number => {
  const [ano, mes, dia] = iso.substring(0, 10).split('-').map(Number);
  return Math.round((new Date(ano, mes - 1, dia).getTime() - hojeMeiaNoite()) / DIA_MS);
};

const situacaoDoPrazo = (dias?: number): SituacaoPrazo => {
  if (dias === undefined) {
    return 'sem';
  }
  if (dias < 0) {
    return 'atrasado';
  }
  if (dias === 0) {
    return 'hoje';
  }
  return dias <= 3 ? 'proximo' : 'futuro';
};

// O prazo vem no texto do aviso ("... prazo 17/11/2026").
const extrairPrazo = (aviso: IAviso): string | undefined => {
  const texto = `${aviso.detalhe || ''} ${aviso.titulo || ''}`;
  const achado = /prazo:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(texto);
  return achado ? `${achado[3]}-${achado[2]}-${achado[1]}` : undefined;
};

// Tira o "· prazo dd/mm/aaaa" do detalhe: o prazo já aparece no selo.
const limparDetalhe = (detalhe: string): string =>
  (detalhe || '').replace(/\s*[·\-–—]?\s*prazo:?\s*\d{2}\/\d{2}\/\d{4}/i, '').trim();

const rotuloPrazo = (aviso: IAvisoTela): string => {
  const dias = aviso.diasPrazo as number;
  switch (aviso.situacao) {
    case 'atrasado': return dias === -1 ? 'Atrasado 1 dia' : `Atrasado ${-dias} dias`;
    case 'hoje': return 'Vence hoje';
    case 'proximo': return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`;
    case 'futuro': return `Prazo ${formatarDataCurta(aviso.prazoIso).substring(0, 5)}`;
    default: return '';
  }
};

// "2026-11-12T14:43:36Z" → "Ontem, 11:43". Outros formatos passam como estão.
const formatarQuando = (valor: string): string => {
  if (!valor || !/^\d{4}-\d{2}-\d{2}T/.test(valor)) {
    return valor || '';
  }
  const relativo = rotuloDiaRelativo(valor);
  const hora = formatarHoraBrasilia(valor);
  const diasAtras = -diasAte(new Date(valor).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
  if (relativo === 'Hoje') {
    return `Hoje, ${hora}`;
  }
  if (diasAtras === 1) {
    return `Ontem, ${hora}`;
  }
  return `${diaBrasilia(valor)} ${mesCurtoBrasilia(valor).toLowerCase()}, ${hora}`;
};

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

const normalizar = (valor: string): string =>
  (valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const guid = (valor?: string): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const plural = (quantidade: number, singular: string, pluralTexto: string): string =>
  `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;

const dataPorExtenso = (): string => {
  const texto = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const saudacao = (): string => {
  const hora = new Date().getHours();
  if (hora < 12) {
    return 'Bom dia';
  }
  return hora < 18 ? 'Boa tarde' : 'Boa noite';
};

const abrirUrl = (url: string): void => {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

const ROTULO_PERFIL: Record<string, string> = {
  Funcionario: 'Colaborador',
  Editor: 'Editor',
  Gestor: 'Gestor',
  Administrador: 'Administrador'
};

// ------------------------------------------------------------
// Estilos (escopo .dgt-inicio; tokens --dgt-* do portal)
// ------------------------------------------------------------

const CSS = `
.dgt-inicio {
  --azul: var(--dgt-azul, #202A44);
  --azul-escuro: var(--dgt-azul-escuro, #161D30);
  --ciano: var(--dgt-ciano, #05C3DD);
  --ciano-texto: var(--dgt-ciano-texto, #0E7C8C);
  --indigo: var(--dgt-indigo, #485CC7);
  --linha: var(--dgt-linha-suave, #EDF0F5);
  --linha-forte: var(--dgt-linha, #D9D9D6);
  --claro-azul: var(--dgt-azul-claro, #EDF0F5);
  --claro-ciano: var(--dgt-ciano-claro, #E6F9FC);
  --claro-indigo: var(--dgt-indigo-claro, #E8EAF8);
  --texto: var(--dgt-texto, #202A44);
  --texto-2: var(--dgt-texto-2, #5E6470);
  --erro: var(--dgt-erro, #B42318);
  --erro-claro: var(--dgt-erro-claro, #FDE7E9);
  --alerta: var(--dgt-alerta, #B45309);
  --alerta-claro: var(--dgt-alerta-claro, #FFF4E5);
  --sucesso: var(--dgt-sucesso, #13795B);
  --sucesso-claro: var(--dgt-sucesso-claro, #E7F6EC);
  --sombra: var(--dgt-sombra-1, 0 1px 2px rgba(32,42,68,.06));
  font-family: var(--dgt-fonte, Barlow, 'Segoe UI', Arial, sans-serif);
  color: var(--texto);
  font-size: 14px;
}
.dgt-inicio * { box-sizing: border-box; }
.dgt-inicio button { font-family: inherit; }
.dgt-inicio button:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; box-shadow: none; }
.dgt-inicio .ini-topo button:focus-visible { outline-color: var(--ciano); }

/* ---------- Seu dia ---------- */
.dgt-inicio .ini-topo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  border-radius: 12px;
  overflow: hidden;
  color: #FFFFFF;
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(5,195,221,.16) 0%, rgba(5,195,221,0) 45%),
    linear-gradient(135deg, var(--azul) 0%, var(--azul-escuro) 100%);
  box-shadow: 0 6px 20px rgba(22,29,48,.18);
}
.dgt-inicio .ini-topo-principal { padding: 28px 32px 26px; min-width: 0; }
.dgt-inicio .ini-data {
  margin: 0; display: inline-flex; align-items: center; gap: 8px;
  color: #C7CCD6; font-size: 13px; font-weight: 500;
}
.dgt-inicio .ini-data::before { content: ""; width: 18px; height: 2px; background: var(--ciano); border-radius: 2px; }
.dgt-inicio .ini-ola {
  margin: 10px 0 0; color: #FFFFFF; font-size: 32px; line-height: 1.15;
  font-weight: 600; letter-spacing: -.015em;
}
.dgt-inicio .ini-resumo { margin: 8px 0 0; max-width: 64ch; color: #DCE1EA; font-size: 15px; line-height: 1.5; }
.dgt-inicio .ini-resumo strong { color: #FFFFFF; }
.dgt-inicio .ini-papeis { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.dgt-inicio .ini-papel {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-radius: 999px; border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.06); color: #E6E9F0; font-size: 12px; font-weight: 600;
}
.dgt-inicio .ini-papel svg { width: 14px; height: 14px; color: var(--ciano); }
.dgt-inicio .ini-papel-perfil { background: var(--ciano); border-color: var(--ciano); color: var(--azul); }
.dgt-inicio .ini-papel-perfil svg { color: var(--azul); }

/* ---------- Agenda ---------- */
.dgt-inicio .ini-agenda {
  padding: 22px 22px 18px; display: flex; flex-direction: column; min-width: 0;
  background: rgba(255,255,255,.05); border-left: 1px solid rgba(255,255,255,.10);
}
.dgt-inicio .ini-agenda-topo { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.dgt-inicio .ini-agenda h2 {
  margin: 0; display: inline-flex; align-items: center; gap: 8px;
  color: #FFFFFF; font-size: 14px; font-weight: 600;
}
.dgt-inicio .ini-agenda h2 svg { width: 16px; height: 16px; color: var(--ciano); }
.dgt-inicio .ini-link-claro {
  border: 0; padding: 4px 6px; border-radius: 6px; background: transparent;
  color: var(--ciano); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-link-claro:hover { background: rgba(5,195,221,.12); }
.dgt-inicio .ini-evento { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,.08); }
.dgt-inicio .ini-evento:last-child { border-bottom: 0; }
.dgt-inicio .ini-evento-dia { text-align: center; padding: 5px 0; border-radius: 8px; border: 1px solid rgba(255,255,255,.2); line-height: 1.1; }
.dgt-inicio .ini-evento-dia strong { display: block; font-size: 17px; font-weight: 600; }
.dgt-inicio .ini-evento-dia small { font-size: 11px; color: #C7CCD6; letter-spacing: .04em; }
.dgt-inicio .ini-evento-dia.ini-hoje { background: var(--ciano); border-color: var(--ciano); color: var(--azul); }
.dgt-inicio .ini-evento-dia.ini-hoje small { color: var(--azul); }
.dgt-inicio .ini-evento-titulo { display: block; font-size: 13.5px; font-weight: 600; color: #FFFFFF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-evento-meta { display: block; margin-top: 2px; font-size: 12px; color: #C7CCD6; }
.dgt-inicio .ini-evento-acao {
  margin-top: 6px; padding: 3px 10px; border-radius: 6px; border: 1px solid rgba(5,195,221,.6);
  background: transparent; color: var(--ciano); font-size: 12px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-evento-acao:hover { background: rgba(5,195,221,.12); }
.dgt-inicio .ini-agenda-vazia {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
  gap: 6px; padding: 8px 0; color: #C7CCD6; font-size: 13px; line-height: 1.45;
}
.dgt-inicio .ini-agenda-vazia strong { color: #FFFFFF; font-size: 14px; font-weight: 600; }

/* ---------- Indicadores ---------- */
.dgt-inicio .ini-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-top: 16px; }
.dgt-inicio .ini-kpi {
  position: relative; display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 14px; align-items: center;
  padding: 16px 18px; border: 1px solid var(--linha); border-radius: 10px; background: #FFFFFF;
  box-shadow: var(--sombra); color: var(--texto); text-align: left; cursor: pointer;
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.dgt-inicio .ini-kpi:hover { border-color: var(--linha-forte); box-shadow: 0 6px 16px rgba(32,42,68,.10); transform: translateY(-1px); }
.dgt-inicio .ini-kpi-icone { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--claro-azul); color: var(--azul); }
.dgt-inicio .ini-kpi-icone svg { width: 22px; height: 22px; }
.dgt-inicio .ini-kpi-valor { display: block; font-size: 28px; font-weight: 600; line-height: 1; letter-spacing: -.02em; }
.dgt-inicio .ini-kpi-rotulo { display: block; margin-top: 4px; font-size: 13px; color: var(--texto-2); font-weight: 500; }
.dgt-inicio .ini-kpi-extra { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--texto-2); }
.dgt-inicio .ini-kpi-extra.ini-ruim { color: var(--erro); }
.dgt-inicio .ini-kpi-extra.ini-atencao { color: var(--alerta); }
.dgt-inicio .ini-kpi-extra.ini-bom { color: var(--sucesso); }
.dgt-inicio .ini-kpi.ini-destaque { border-color: rgba(72,92,199,.35); background: linear-gradient(180deg, #FFFFFF 0%, #F6F7FD 100%); }
.dgt-inicio .ini-kpi.ini-destaque .ini-kpi-icone { background: var(--indigo); color: #FFFFFF; }
.dgt-inicio .ini-kpi.ini-destaque .ini-kpi-valor { color: var(--indigo); }

/* ---------- Grade principal ---------- */
.dgt-inicio .ini-trabalho { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(320px, 1fr); gap: 16px; align-items: start; margin-top: 16px; }
.dgt-inicio .ini-coluna { display: grid; gap: 16px; min-width: 0; }
.dgt-inicio .ini-painel { background: #FFFFFF; border: 1px solid var(--linha); border-radius: 10px; min-width: 0; box-shadow: var(--sombra); }
.dgt-inicio .ini-painel-topo { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 16px 20px 12px; }
.dgt-inicio .ini-painel-topo h2 { margin: 0; display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; color: var(--azul); }
.dgt-inicio .ini-painel-corpo { padding: 0 20px 18px; }
.dgt-inicio .ini-contagem { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: var(--claro-azul); color: var(--azul); font-size: 12px; font-weight: 700; }
.dgt-inicio .ini-contagem.ini-forte { background: var(--indigo); color: #FFFFFF; }
.dgt-inicio .ini-link { border: 0; padding: 4px 6px; border-radius: 6px; background: transparent; color: var(--indigo); font-size: 13px; font-weight: 600; cursor: pointer; }
.dgt-inicio .ini-link:hover { background: var(--claro-indigo); }

/* filtros por tipo */
.dgt-inicio .ini-filtros { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 20px 12px; border-bottom: 1px solid var(--linha); }
.dgt-inicio .ini-filtro {
  display: inline-flex; align-items: center; gap: 6px; min-height: 30px; padding: 0 12px;
  border: 1px solid var(--linha-forte); border-radius: 999px; background: #FFFFFF;
  color: var(--texto-2); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-filtro:hover { color: var(--texto); border-color: var(--azul); }
.dgt-inicio .ini-filtro[aria-pressed="true"] { background: var(--azul); border-color: var(--azul); color: #FFFFFF; }
.dgt-inicio .ini-filtro b { font-weight: 700; opacity: .85; }

/* item aguardando */
.dgt-inicio .ini-aviso {
  display: grid; grid-template-columns: 40px minmax(0,1fr) auto; align-items: center; gap: 14px;
  padding: 14px 20px; border-bottom: 1px solid var(--linha); position: relative;
}
.dgt-inicio .ini-aviso:last-child { border-bottom: 0; }
.dgt-inicio .ini-aviso:hover { background: #FAFBFD; }
.dgt-inicio .ini-aviso.ini-atrasado::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--erro); }
.dgt-inicio .ini-aviso-icone { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--claro-indigo); color: var(--indigo); }
.dgt-inicio .ini-aviso-linha { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.dgt-inicio .ini-aviso-tipo { font-size: 12px; color: var(--indigo); font-weight: 600; }
.dgt-inicio .ini-aviso-quando { font-size: 12px; color: var(--texto-2); }
.dgt-inicio .ini-aviso-titulo { display: block; margin-top: 3px; font-size: 14px; font-weight: 600; color: var(--azul); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-aviso-detalhe { display: block; margin-top: 2px; font-size: 13px; color: var(--texto-2); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-acoes { display: flex; align-items: center; gap: 10px; }
.dgt-inicio .ini-prazo { display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; background: var(--claro-azul); color: var(--texto-2); }
.dgt-inicio .ini-prazo svg { width: 13px; height: 13px; }
.dgt-inicio .ini-prazo.atrasado { background: var(--erro-claro); color: var(--erro); }
.dgt-inicio .ini-prazo.hoje, .dgt-inicio .ini-prazo.proximo { background: var(--alerta-claro); color: var(--alerta); }
.dgt-inicio .ini-botao {
  display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px;
  border-radius: 6px; border: 1px solid var(--linha-forte); background: #FFFFFF;
  color: var(--azul); font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.dgt-inicio .ini-botao svg { width: 15px; height: 15px; }
.dgt-inicio .ini-botao:hover { background: var(--azul); border-color: var(--azul); color: #FFFFFF; }
.dgt-inicio .ini-botao-primario {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  min-height: 40px; padding: 0 14px; border: 0; border-radius: 8px;
  background: var(--azul); color: #FFFFFF; font-size: 14px; font-weight: 600; cursor: pointer;
}
.dgt-inicio .ini-botao-primario svg { width: 16px; height: 16px; }
.dgt-inicio .ini-botao-primario:hover { background: var(--azul-escuro); }
.dgt-inicio .ini-mais { display: flex; justify-content: center; padding: 10px 20px 14px; border-top: 1px solid var(--linha); }

/* estados vazios */
.dgt-inicio .ini-vazio { display: grid; grid-template-columns: 44px minmax(0,1fr); gap: 14px; align-items: center; padding: 18px; margin: 4px 20px 18px; border-radius: 10px; background: #F7F9FB; color: var(--texto-2); font-size: 13.5px; line-height: 1.5; }
.dgt-inicio .ini-vazio-icone { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #FFFFFF; color: var(--texto-2); border: 1px solid var(--linha); }
.dgt-inicio .ini-vazio.ini-ok .ini-vazio-icone { background: var(--sucesso-claro); color: var(--sucesso); border-color: transparent; }
.dgt-inicio .ini-vazio strong { display: block; color: var(--azul); font-size: 14px; margin-bottom: 2px; }
.dgt-inicio .ini-painel-corpo .ini-vazio { margin: 4px 0 0; }

/* capacitação */
.dgt-inicio .ini-progresso { display: grid; grid-template-columns: 96px minmax(0,1fr); gap: 18px; align-items: center; }
.dgt-inicio .ini-anel { position: relative; width: 96px; height: 96px; }
.dgt-inicio .ini-anel svg { width: 96px; height: 96px; transform: rotate(-90deg); }
.dgt-inicio .ini-anel span { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: var(--azul); line-height: 1; }
.dgt-inicio .ini-anel small { margin-top: 3px; font-size: 11px; font-weight: 600; color: var(--texto-2); }
.dgt-inicio .ini-legenda { display: grid; gap: 7px; }
.dgt-inicio .ini-legenda div { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--texto-2); }
.dgt-inicio .ini-legenda i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex-shrink: 0; }
.dgt-inicio .ini-legenda b { margin-left: auto; color: var(--azul); font-weight: 700; }
.dgt-inicio .ini-continuar { display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 12px; align-items: center; margin-top: 16px; padding: 10px; border: 1px solid var(--linha); border-radius: 10px; background: #FAFBFD; }
.dgt-inicio .ini-continuar img, .dgt-inicio .ini-continuar .ini-capa { width: 72px; height: 48px; border-radius: 6px; object-fit: cover; background: var(--claro-azul); display: flex; align-items: center; justify-content: center; color: var(--azul); }
.dgt-inicio .ini-continuar small { display: block; font-size: 12px; color: var(--texto-2); font-weight: 600; }
.dgt-inicio .ini-continuar strong { display: block; margin-top: 2px; font-size: 14px; font-weight: 600; color: var(--azul); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-barrinha { height: 5px; margin-top: 7px; border-radius: 4px; background: #E3E7EE; overflow: hidden; }
.dgt-inicio .ini-barrinha span { display: block; height: 100%; background: var(--ciano-texto); border-radius: 4px; }

/* documentos */
.dgt-inicio .ini-abas { display: inline-flex; padding: 3px; gap: 2px; border-radius: 8px; background: var(--claro-azul); }
.dgt-inicio .ini-aba { border: 0; padding: 5px 10px; border-radius: 6px; background: transparent; color: var(--texto-2); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.dgt-inicio .ini-aba[aria-selected="true"] { background: #FFFFFF; color: var(--azul); box-shadow: 0 1px 2px rgba(32,42,68,.12); }
.dgt-inicio .ini-doc {
  display: grid; grid-template-columns: 34px minmax(0,1fr) auto; gap: 12px; align-items: center; width: 100%;
  padding: 10px 6px; border: 0; border-bottom: 1px solid var(--linha); border-radius: 0;
  background: transparent; text-align: left; cursor: pointer; color: var(--texto);
}
.dgt-inicio .ini-doc:last-child { border-bottom: 0; }
.dgt-inicio .ini-doc:hover { background: #FAFBFD; }
.dgt-inicio .ini-doc:hover strong { color: var(--indigo); }
.dgt-inicio .ini-doc-icone { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: var(--claro-ciano); color: var(--ciano-texto); }
.dgt-inicio .ini-doc-icone svg { width: 18px; height: 18px; }
.dgt-inicio .ini-doc strong { display: block; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-doc small { display: block; margin-top: 2px; font-size: 12px; color: var(--texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dgt-inicio .ini-doc code { font-family: inherit; font-weight: 700; color: var(--azul); }

/* acesso rápido */
.dgt-inicio .ini-secao-titulo { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 28px 0 12px; }
.dgt-inicio .ini-secao-titulo h2 { margin: 0; font-size: 18px; font-weight: 600; color: var(--azul); }
.dgt-inicio .ini-secao-titulo span { font-size: 13px; color: var(--texto-2); }
.dgt-inicio .ini-grupo + .ini-grupo { margin-top: 16px; }
.dgt-inicio .ini-grupo h3 { margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--texto-2); }
.dgt-inicio .ini-modulos { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.dgt-inicio .ini-modulo {
  display: grid; grid-template-columns: 40px minmax(0,1fr) auto; align-items: center; gap: 12px; width: 100%;
  padding: 12px 14px; border: 1px solid var(--linha); border-radius: 10px; background: #FFFFFF;
  color: var(--texto); text-align: left; cursor: pointer; box-shadow: var(--sombra);
  transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.dgt-inicio .ini-modulo:hover { border-color: var(--azul); box-shadow: 0 6px 16px rgba(32,42,68,.10); transform: translateY(-1px); }
.dgt-inicio .ini-modulo-icone { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--claro-azul); color: var(--azul); transition: background .15s ease, color .15s ease; }
.dgt-inicio .ini-modulo:hover .ini-modulo-icone { background: var(--azul); color: #FFFFFF; }
.dgt-inicio .ini-modulo strong { display: block; font-size: 14px; font-weight: 600; }
.dgt-inicio .ini-modulo small { display: block; margin-top: 1px; font-size: 12px; color: var(--texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.dgt-inicio .ini-rodape { margin: 18px 0 0; color: var(--texto-2); font-size: 12px; text-align: right; }

/* ---------- Responsivo ---------- */
@media (max-width: 1180px) {
  .dgt-inicio .ini-trabalho { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 900px) {
  .dgt-inicio .ini-topo { grid-template-columns: minmax(0, 1fr); }
  .dgt-inicio .ini-agenda { border-left: 0; border-top: 1px solid rgba(255,255,255,.10); }
}
@media (max-width: 560px) {
  .dgt-inicio .ini-topo-principal { padding: 22px 20px; }
  .dgt-inicio .ini-ola { font-size: 26px; }
  .dgt-inicio .ini-aviso { grid-template-columns: 40px minmax(0,1fr); padding: 14px 16px; }
  .dgt-inicio .ini-acoes { grid-column: 2; }
  .dgt-inicio .ini-progresso { grid-template-columns: minmax(0,1fr); justify-items: center; }
  .dgt-inicio .ini-legenda { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .dgt-inicio * { transition: none !important; }
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
  quantidadeTrilhas,
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
  onAbrirDocumentoPorId,
  areas,
  usuariosAreas
}) => {

  // ---------------- Aguardando você ----------------
  const [avisos, setAvisos] = React.useState<IAviso[]>([]);
  const [carregandoAvisos, setCarregandoAvisos] = React.useState(false);
  const [avisosDisponiveis, setAvisosDisponiveis] = React.useState(true);
  const [filtroAviso, setFiltroAviso] = React.useState<TipoFiltro>('todos');
  const [mostrarTodosAvisos, setMostrarTodosAvisos] = React.useState(false);
  const [abaDocumentos, setAbaDocumentos] = React.useState<'recentes' | 'minhas'>('recentes');

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

  const abrirAviso = (aviso: IAviso): void => {
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

  // Prazo e prioridade: atrasados primeiro, depois o prazo mais próximo.
  const avisosTela: IAvisoTela[] = React.useMemo(
    () => {
      const ordem: Record<SituacaoPrazo, number> = { atrasado: 0, hoje: 1, proximo: 2, futuro: 3, sem: 4 };
      return avisos
        .map(aviso => {
          const prazoIso = extrairPrazo(aviso);
          const diasPrazo = prazoIso ? diasAte(prazoIso) : undefined;
          return { ...aviso, prazoIso, diasPrazo, situacao: situacaoDoPrazo(diasPrazo) };
        })
        .sort((a, b) =>
          (ordem[a.situacao] - ordem[b.situacao]) ||
          ((a.diasPrazo === undefined ? 9999 : a.diasPrazo) - (b.diasPrazo === undefined ? 9999 : b.diasPrazo))
        );
    },
    [avisos]
  );

  const contagemTipos = React.useMemo(
    () => {
      const contagem: Record<string, number> = {};
      avisosTela.forEach(aviso => {
        contagem[aviso.tipo] = (contagem[aviso.tipo] || 0) + 1;
      });
      return contagem;
    },
    [avisosTela]
  );

  const avisosFiltrados = filtroAviso === 'todos'
    ? avisosTela
    : avisosTela.filter(aviso => aviso.tipo === filtroAviso);

  const avisosVisiveis = mostrarTodosAvisos
    ? avisosFiltrados
    : avisosFiltrados.slice(0, AVISOS_INICIAIS);

  const qtdAvisos = avisosTela.length;
  const qtdAtrasados = avisosTela.filter(aviso => aviso.situacao === 'atrasado').length;
  const qtdUrgentes = avisosTela.filter(aviso => aviso.situacao === 'hoje' || aviso.situacao === 'proximo').length;

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
    treinamentos.find(item => item.status === 'Vencido') ||
    treinamentos.find(item => item.status === 'Em andamento') ||
    treinamentos.find(item => item.status === 'Reprovado') ||
    treinamentos.find(item => item.status === 'Disponível');

  const segmentos = [
    { rotulo: 'Concluídos', valor: concluidos, cor: '#202A44' },
    { rotulo: 'Em andamento', valor: andamento, cor: '#0E7C8C' },
    { rotulo: 'A iniciar', valor: pendentes, cor: '#AEB4BE' },
    { rotulo: 'Vencidos', valor: vencidos, cor: '#B42318' }
  ];

  // ---------------- Documentos (mesma visibilidade da tela Documentos) ----------------
  const documentosVisiveis = React.useMemo(
    () => {
      if (!contextoAcesso) {
        return documentos;
      }
      const vinculos = usuariosAreas || [];
      const areasVisiveis = obterAreasVisiveis(contextoAcesso, areas || [], vinculos);
      return filtrarDocumentosVisiveis(documentos, contextoAcesso, areasVisiveis, vinculos);
    },
    [documentos, contextoAcesso, areas, usuariosAreas]
  );

  const documentosVigentes = React.useMemo(
    () => documentosVisiveis
      .filter(documento => normalizar(documento.status) === 'vigente')
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')),
    [documentosVisiveis]
  );

  // Documentos pelos quais a pessoa responde, pela revisão periódica mais próxima.
  const minhasRevisoes = React.useMemo(
    () => {
      const meuId = guid(contextoAcesso?.usuarioId);
      if (!meuId) {
        return [];
      }
      return documentosVigentes
        .filter(documento => guid(documento.responsavelId) === meuId)
        .map(documento => {
          const vencimento = vencimentoDocumento(documento);
          return { documento, data: vencimento ? vencimento.data : '', dias: vencimento ? diasAte(vencimento.data) : 9999 };
        })
        .sort((a, b) => a.dias - b.dias);
    },
    [documentosVigentes, contextoAcesso]
  );

  const revisoesProximas = minhasRevisoes.filter(item => item.dias <= 30).length;

  // ---------------- Módulos ----------------
  const grupos = React.useMemo(
    () => montarGrupos(contextoAcesso, {
      treinamentos: aFazer,
      documentos: documentosVigentes.length,
      trilhas: quantidadeTrilhas
    }),
    [contextoAcesso, aFazer, documentosVigentes.length, quantidadeTrilhas]
  );

  const totalModulos = grupos.reduce((soma, grupo) => soma + grupo.modulos.length, 0);

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

  const irParaAguardando = (): void => {
    const alvo = document.getElementById('ini-aguardando');
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ---------------- Resumo do dia ----------------
  const partesResumo: React.ReactNode[] = [];

  if (avisosDisponiveis && !carregandoAvisos) {
    partesResumo.push(
      qtdAvisos > 0
        ? <span key="a"><strong>{plural(qtdAvisos, 'item aguarda', 'itens aguardam')}</strong> a sua ação{qtdAtrasados > 0 ? <>, sendo <strong>{plural(qtdAtrasados, 'atrasado', 'atrasados')}</strong></> : ''}</span>
        : <span key="a">Nada aguarda a sua ação agora</span>
    );
  }

  if (aFazer > 0) {
    partesResumo.push(<span key="t"><strong>{plural(aFazer, 'treinamento', 'treinamentos')}</strong> em aberto</span>);
  }

  const proximoEvento = eventosCalendario[0];

  if (proximoEvento && rotuloDiaRelativo(proximoEvento.inicio) === 'Hoje') {
    partesResumo.push(
      proximoEvento.diaInteiro
        ? <span key="e">hoje você tem <strong>{proximoEvento.titulo}</strong></span>
        : <span key="e">próximo compromisso às <strong>{formatarHoraBrasilia(proximoEvento.inicio)}</strong></span>
    );
  }

  const resumo =
    partesResumo.length === 0
      ? <>Bem-vindo à Intranet DGT.</>
      : (
        <>
          {partesResumo.map((parte, indice) => (
            <React.Fragment key={indice}>
              {indice > 0 ? (indice === partesResumo.length - 1 ? ' e ' : ', ') : ''}
              {parte}
            </React.Fragment>
          ))}
          .
        </>
      );

  const nome = (primeiroNome || '').trim();
  const vinculos = (contextoAcesso?.vinculosArea || []).filter(vinculo => !!vinculo.areaNome);
  const perfil = contextoAcesso ? (ROTULO_PERFIL[contextoAcesso.perfil] || contextoAcesso.perfil) : '';

  const filtrosDisponiveis = (['fluxo', 'treinamentos', 'orcamento', 'licitacoes'] as TipoFiltro[])
    .filter(tipo => (contagemTipos[tipo] || 0) > 0);

  // ============================================================
  return (
    <section className="dgt-inicio">
      <style>{CSS}</style>

      {/* SEU DIA */}
      <div className="ini-topo" role="region" aria-label="Seu dia">
        <div className="ini-topo-principal">
          <p className="ini-data">{dataPorExtenso()}</p>
          <h1 className="ini-ola">
            {saudacao()}{nome ? `, ${nome}` : ''}
          </h1>
          <p className="ini-resumo">{resumo}</p>

          {(perfil || vinculos.length > 0) && (
            <div className="ini-papeis" aria-label="Seu perfil e áreas">
              {perfil && (
                <span className="ini-papel ini-papel-perfil">
                  <Icones.checkCircle />
                  {perfil}
                </span>
              )}
              {vinculos.slice(0, 4).map(vinculo => (
                <span key={vinculo.areaId} className="ini-papel" title={`${vinculo.areaNome}: ${vinculo.perfil}`}>
                  <Icones.building />
                  {vinculo.areaNome}
                </span>
              ))}
              {vinculos.length > 4 && (
                <span className="ini-papel" title={vinculos.slice(4).map(v => v.areaNome).join(', ')}>
                  +{vinculos.length - 4} áreas
                </span>
              )}
            </div>
          )}
        </div>

        <aside className="ini-agenda" aria-label="Próximos compromissos">
          <div className="ini-agenda-topo">
            <h2><Icones.clock />Próximos compromissos</h2>
            <button
              type="button"
              className="ini-link-claro"
              onClick={() => abrirUrl('https://outlook.office.com/calendar/view/week')}
            >
              Abrir agenda
            </button>
          </div>

          {carregandoCalendario && (
            <div className="ini-agenda-vazia">Carregando a sua agenda...</div>
          )}

          {!carregandoCalendario && erroCalendario && (
            <div className="ini-agenda-vazia">
              <strong>Agenda indisponível</strong>
              A permissão Calendars.Read precisa estar aprovada no SharePoint Admin Center.
            </div>
          )}

          {!carregandoCalendario && !erroCalendario && eventosCalendario.length === 0 && (
            <div className="ini-agenda-vazia">
              <strong>Agenda livre</strong>
              Nenhum compromisso nos próximos dias.
            </div>
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

      {/* INDICADORES */}
      <div className="ini-kpis">
        {avisosDisponiveis && (
          <button
            type="button"
            className={`ini-kpi${qtdAvisos > 0 ? ' ini-destaque' : ''}`}
            onClick={irParaAguardando}
          >
            <span className="ini-kpi-icone"><Icones.bell /></span>
            <span>
              <span className="ini-kpi-valor">{carregandoAvisos ? '…' : qtdAvisos}</span>
              <span className="ini-kpi-rotulo">Aguardando você</span>
              {!carregandoAvisos && (
                qtdAtrasados > 0
                  ? <span className="ini-kpi-extra ini-ruim">{plural(qtdAtrasados, 'atrasado', 'atrasados')}</span>
                  : qtdUrgentes > 0
                    ? <span className="ini-kpi-extra ini-atencao">{plural(qtdUrgentes, 'vence', 'vencem')} em até 3 dias</span>
                    : <span className="ini-kpi-extra ini-bom">Sem atrasos</span>
              )}
            </span>
          </button>
        )}

        <button type="button" className="ini-kpi" onClick={onVerTreinamentos}>
          <span className="ini-kpi-icone"><Icones.graduationCap /></span>
          <span>
            <span className="ini-kpi-valor">{aFazer}</span>
            <span className="ini-kpi-rotulo">Treinamentos em aberto</span>
            {vencidos > 0
              ? <span className="ini-kpi-extra ini-ruim">{plural(vencidos, 'vencido', 'vencidos')}</span>
              : <span className="ini-kpi-extra">{plural(concluidos, 'concluído', 'concluídos')}</span>}
          </span>
        </button>

        <button type="button" className="ini-kpi" onClick={() => navegar('certificados')}>
          <span className="ini-kpi-icone"><Icones.award /></span>
          <span>
            <span className="ini-kpi-valor">{total > 0 ? `${percentual}%` : '—'}</span>
            <span className="ini-kpi-rotulo">Capacitação concluída</span>
            <span className="ini-kpi-extra">
              {quantidadeTrilhas > 0 ? plural(quantidadeTrilhas, 'trilha', 'trilhas') : 'Ver certificados'}
            </span>
          </span>
        </button>

        <button type="button" className="ini-kpi" onClick={onVerDocumentos}>
          <span className="ini-kpi-icone"><Icones.fileText /></span>
          <span>
            <span className="ini-kpi-valor">{documentosVigentes.length}</span>
            <span className="ini-kpi-rotulo">Documentos vigentes</span>
            {revisoesProximas > 0
              ? <span className="ini-kpi-extra ini-atencao">{plural(revisoesProximas, 'revisão sua vence', 'revisões suas vencem')} em 30 dias</span>
              : <span className="ini-kpi-extra">Acesso conforme suas áreas</span>}
          </span>
        </button>
      </div>

      {erro && <div style={{ marginTop: '16px' }}><ErrorMessage mensagem={erro} /></div>}

      {/* TRABALHO */}
      {carregando
        ? <div style={{ marginTop: '16px' }}><Loading mensagem="Carregando o portal..." /></div>
        : (
          <div className="ini-trabalho">

            {/* AGUARDANDO VOCÊ */}
            <article className="ini-painel" id="ini-aguardando" aria-labelledby="ini-aguardando-titulo">
              <div className="ini-painel-topo">
                <h2 id="ini-aguardando-titulo">
                  Aguardando você
                  {qtdAvisos > 0 && <span className={`ini-contagem${qtdAtrasados > 0 ? ' ini-forte' : ''}`}>{qtdAvisos}</span>}
                </h2>
                {qtdAvisos > 0 && (
                  <span style={{ fontSize: '12.5px', color: 'var(--texto-2)' }}>Atrasados e prazos mais próximos primeiro</span>
                )}
              </div>

              {filtrosDisponiveis.length > 1 && (
                <div className="ini-filtros" role="group" aria-label="Filtrar por tipo">
                  <button
                    type="button"
                    className="ini-filtro"
                    aria-pressed={filtroAviso === 'todos'}
                    onClick={() => { setFiltroAviso('todos'); setMostrarTodosAvisos(false); }}
                  >
                    Todos <b>{qtdAvisos}</b>
                  </button>
                  {filtrosDisponiveis.map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      className="ini-filtro"
                      aria-pressed={filtroAviso === tipo}
                      onClick={() => { setFiltroAviso(tipo); setMostrarTodosAvisos(false); }}
                    >
                      {TIPO_AVISO[tipo].plural} <b>{contagemTipos[tipo]}</b>
                    </button>
                  ))}
                </div>
              )}

              {!avisosDisponiveis && (
                <div className="ini-vazio">
                  <span className="ini-vazio-icone"><Icones.hourglass /></span>
                  <span>As pendências de fluxo, orçamento e licitações aparecem aqui assim que o seu acesso for carregado.</span>
                </div>
              )}

              {avisosDisponiveis && carregandoAvisos && (
                <div className="ini-vazio" role="status">
                  <span className="ini-vazio-icone"><Icones.hourglass /></span>
                  <span>Verificando etapas de fluxo, prazos e alterações...</span>
                </div>
              )}

              {avisosDisponiveis && !carregandoAvisos && qtdAvisos === 0 && (
                <div className="ini-vazio ini-ok">
                  <span className="ini-vazio-icone"><Icones.checkCircle /></span>
                  <span>
                    <strong>Você está em dia.</strong>
                    Nenhuma etapa de fluxo, prazo de treinamento, orçamento ou licitação aguarda você.
                  </span>
                </div>
              )}

              {avisosDisponiveis && !carregandoAvisos && avisosVisiveis.length > 0 && (
                <div role="list">
                  {avisosVisiveis.map(aviso => {
                    const tipo = TIPO_AVISO[aviso.tipo] || { rotulo: 'Aviso', plural: 'Avisos', icone: 'bell' as IconeChave };
                    const Icone = Icones[tipo.icone];
                    const detalhe = limparDetalhe(aviso.detalhe);

                    return (
                      <div
                        key={aviso.id}
                        role="listitem"
                        className={`ini-aviso${aviso.situacao === 'atrasado' ? ' ini-atrasado' : ''}`}
                      >
                        <span className="ini-aviso-icone" aria-hidden="true"><Icone /></span>
                        <span style={{ minWidth: 0 }}>
                          <span className="ini-aviso-linha">
                            <span className="ini-aviso-tipo">{tipo.rotulo}</span>
                            {aviso.data && <span className="ini-aviso-quando">{formatarQuando(aviso.data)}</span>}
                          </span>
                          <span className="ini-aviso-titulo" title={aviso.titulo}>{aviso.titulo}</span>
                          {detalhe && <span className="ini-aviso-detalhe" title={detalhe}>{detalhe}</span>}
                        </span>
                        <span className="ini-acoes">
                          {aviso.situacao !== 'sem' && (
                            <span className={`ini-prazo ${aviso.situacao}`}>
                              {aviso.situacao === 'atrasado' ? <Icones.alertTriangle /> : <Icones.clock />}
                              {rotuloPrazo(aviso)}
                            </span>
                          )}
                          {aviso.acao && (
                            <button
                              type="button"
                              className="ini-botao"
                              aria-label={`Abrir: ${aviso.titulo}`}
                              onClick={() => abrirAviso(aviso)}
                            >
                              Abrir <Icones.arrowRight />
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {avisosDisponiveis && !carregandoAvisos && avisosFiltrados.length > AVISOS_INICIAIS && (
                <div className="ini-mais">
                  <button type="button" className="ini-link" onClick={() => setMostrarTodosAvisos(atual => !atual)}>
                    {mostrarTodosAvisos ? 'Mostrar menos' : `Mostrar todos (${avisosFiltrados.length})`}
                  </button>
                </div>
              )}
            </article>

            <div className="ini-coluna">

              {/* MINHA CAPACITAÇÃO */}
              <article className="ini-painel" aria-labelledby="ini-capacitacao-titulo">
                <div className="ini-painel-topo">
                  <h2 id="ini-capacitacao-titulo">Minha capacitação</h2>
                  <button type="button" className="ini-link" onClick={onVerTreinamentos}>Ver todos</button>
                </div>

                <div className="ini-painel-corpo">
                  {total === 0
                    ? (
                      <div className="ini-vazio">
                        <span className="ini-vazio-icone"><Icones.graduationCap /></span>
                        <span>
                          <strong>Nenhum treinamento atribuído.</strong>
                          Quando você receber um treinamento, ele aparece aqui.
                        </span>
                      </div>
                    )
                    : (
                      <div className="ini-progresso">
                        <div
                          className="ini-anel"
                          role="img"
                          aria-label={`${percentual}% concluído. ${segmentos.map(s => `${s.rotulo}: ${s.valor}`).join(', ')}`}
                        >
                          <svg viewBox="0 0 100 100" aria-hidden="true">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="#E3E7EE" strokeWidth="10" />
                            <circle
                              cx="50" cy="50" r="42" fill="none" stroke="#202A44" strokeWidth="10" strokeLinecap="round"
                              strokeDasharray={`${(percentual / 100) * 263.9} 263.9`}
                            />
                          </svg>
                          <span>{percentual}%<small>concluído</small></span>
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
                      </div>
                    )}

                  {continuar && (
                    <div className="ini-continuar">
                      {continuar.imagem
                        ? <img src={continuar.imagem} alt="" />
                        : <span className="ini-capa"><Icones.graduationCap /></span>}
                      <span style={{ minWidth: 0 }}>
                        <small style={continuar.status === 'Vencido' ? { color: 'var(--erro)' } : undefined}>
                          {continuar.status === 'Em andamento' || continuar.status === 'Reprovado'
                            ? 'Continue de onde parou'
                            : continuar.status === 'Vencido'
                              ? 'Treinamento vencido: refaça'
                              : 'Próximo treinamento'}
                        </small>
                        <strong title={continuar.nome}>{continuar.nome}</strong>
                        <span className="ini-barrinha" aria-hidden="true">
                          <span style={{ width: `${Math.max(0, Math.min(100, continuar.progresso || 0))}%` }} />
                        </span>
                      </span>
                    </div>
                  )}

                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="ini-botao-primario"
                      onClick={() => (continuar ? onAbrirTreinamento(continuar) : onVerTreinamentos())}
                    >
                      {continuar
                        ? continuar.status === 'Em andamento' ? 'Continuar treinamento' : 'Começar treinamento'
                        : 'Ver meus treinamentos'}
                      <Icones.arrowRight />
                    </button>
                  </div>
                </div>
              </article>

              {/* DOCUMENTOS */}
              <article className="ini-painel" aria-labelledby="ini-documentos-titulo">
                <div className="ini-painel-topo">
                  <h2 id="ini-documentos-titulo">Documentos</h2>
                  {minhasRevisoes.length > 0
                    ? (
                      <div className="ini-abas" role="tablist" aria-label="Lista de documentos">
                        <button type="button" role="tab" className="ini-aba" aria-selected={abaDocumentos === 'recentes'} onClick={() => setAbaDocumentos('recentes')}>
                          Vigentes
                        </button>
                        <button type="button" role="tab" className="ini-aba" aria-selected={abaDocumentos === 'minhas'} onClick={() => setAbaDocumentos('minhas')}>
                          Sob minha responsabilidade
                        </button>
                      </div>
                    )
                    : <button type="button" className="ini-link" onClick={onVerDocumentos}>Ver todos</button>}
                </div>

                <div className="ini-painel-corpo" role="tabpanel">
                  {abaDocumentos === 'minhas' && minhasRevisoes.length > 0
                    ? minhasRevisoes.slice(0, 5).map(item => {
                      const situacao = situacaoDoPrazo(item.dias === 9999 ? undefined : item.dias);
                      return (
                        <button
                          key={item.documento.id}
                          type="button"
                          className="ini-doc"
                          onClick={() => (onAbrirDocumento ? onAbrirDocumento(item.documento) : onVerDocumentos())}
                        >
                          <span className="ini-doc-icone" aria-hidden="true"><Icones.fileText /></span>
                          <span style={{ minWidth: 0 }}>
                            <strong title={item.documento.titulo}>{item.documento.titulo}</strong>
                            <small><code>{item.documento.codigo}</code> {item.documento.revisaoAtual}</small>
                          </span>
                          {item.data && (
                            <span className={`ini-prazo ${situacao === 'futuro' ? '' : situacao}`} title="Revisão periódica">
                              {situacao === 'atrasado'
                                ? 'Revisão vencida'
                                : item.dias <= 30 ? `Revisar em ${item.dias}d` : `Rev. ${formatarDataCurta(item.data)}`}
                            </span>
                          )}
                        </button>
                      );
                    })
                    : documentosVigentes.length === 0
                      ? (
                        <div className="ini-vazio">
                          <span className="ini-vazio-icone"><Icones.fileText /></span>
                          <span>Nenhum documento vigente disponível para você.</span>
                        </div>
                      )
                      : documentosVigentes.slice(0, 5).map(documento => (
                        <button
                          key={documento.id}
                          type="button"
                          className="ini-doc"
                          onClick={() => (onAbrirDocumento ? onAbrirDocumento(documento) : onVerDocumentos())}
                        >
                          <span className="ini-doc-icone" aria-hidden="true"><Icones.fileText /></span>
                          <span style={{ minWidth: 0 }}>
                            <strong title={documento.titulo}>{documento.titulo}</strong>
                            <small>
                              <code>{documento.codigo}</code>
                              {documento.revisaoAtual ? ` ${documento.revisaoAtual}` : ''}
                              {documento.area ? ` · ${documento.area}` : ''}
                            </small>
                          </span>
                          <span aria-hidden="true" style={{ color: 'var(--texto-2)', display: 'inline-flex' }}><Icones.arrowRight /></span>
                        </button>
                      ))}

                  {minhasRevisoes.length > 0 && (
                    <div style={{ marginTop: '10px', textAlign: 'right' }}>
                      <button type="button" className="ini-link" onClick={onVerDocumentos}>Ver todos os documentos</button>
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>
        )}

      {/* ACESSO RÁPIDO */}
      {grupos.length > 0 && (
        <>
          <div className="ini-secao-titulo">
            <h2>Acesso rápido</h2>
            <span>{plural(totalModulos, 'módulo disponível', 'módulos disponíveis')} para o seu perfil</span>
          </div>

          {grupos.map(grupo => (
            <div key={grupo.nome} className="ini-grupo">
              <h3>{grupo.nome}</h3>
              <div className="ini-modulos">
                {grupo.modulos.map(modulo => {
                  const Icone = Icones[modulo.icone];
                  return (
                    <button
                      key={modulo.pagina}
                      type="button"
                      className="ini-modulo"
                      onClick={() => navegar(modulo.pagina)}
                    >
                      <span className="ini-modulo-icone" aria-hidden="true"><Icone /></span>
                      <span style={{ minWidth: 0 }}>
                        <strong>{modulo.titulo}</strong>
                        <small title={modulo.descricao}>{modulo.descricao}</small>
                      </span>
                      {!!modulo.contador && <span className="ini-contagem">{modulo.contador}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      <p className="ini-rodape">Horários no fuso de Brasília.</p>
    </section>
  );
};

export default InicioIntranetPage;
