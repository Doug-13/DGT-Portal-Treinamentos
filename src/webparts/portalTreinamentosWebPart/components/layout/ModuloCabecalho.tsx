import * as React from 'react';

import styles from
  '../PortalTreinamentos.module.scss';

import {
  Icones,
  IconeChave
} from '../common/Icones';

import {
  Pagina
} from '../../constants/routes';

import {
  IItemMenuTreinamento
} from '../../services/MenuPermissionService';

// ============================================================
// CABEÇALHO PADRÃO DE MÓDULO (hero + abas)
//
// Mesmo visual para Treinamentos, Documentos e próximos módulos:
//   [ícone]  Título                              “citação”
//            Subtítulo
//            Descrição
//   ─ Aba 1 ─ Aba 2 ─ Aba 3 ─
//
// Para criar um módulo novo, basta adicionar a configuração em
// CABECALHOS_MODULO e o menu em MenuPermissionService.
// ============================================================

export interface IConfigCabecalhoModulo {
  icone: IconeChave;
  titulo: string;
  subtitulo: string;
  descricao: string;
  citacao: string;
}

export const CABECALHOS_MODULO: {
  inicio: IConfigCabecalhoModulo;
  treinamentos: IConfigCabecalhoModulo;
  documentos: IConfigCabecalhoModulo;
} = {
  inicio: {
    icone: 'home',
    titulo: 'Intranet DGT',
    subtitulo: 'Conhecimento, processos e pessoas conectados.',
    descricao: 'Segurança em primeiro lugar · Pessoas que fazem a diferença · Resultados que constroem o amanhã.',
    citacao: 'Desenvolver pessoas também é construir o futuro.'
  },
  treinamentos: {
    icone: 'layers',
    titulo: 'Treinamentos',
    subtitulo: 'Desenvolva seu conhecimento. Construa resultados.',
    descricao: 'Trilhas, cursos, avaliações e certificações em um só lugar.',
    citacao: 'Pessoa que aprende hoje, constrói um amanhã melhor.'
  },
  documentos: {
    icone: 'fileText',
    titulo: 'Documentos',
    subtitulo: 'Procedimentos, políticas, instruções e muito mais.',
    descricao: 'Documentos vigentes, revisões e aprovações em um só lugar.',
    citacao: 'Informação organizada gera segurança e melhores resultados.'
  }
};

export interface IModuloCabecalhoProps {
  config: IConfigCabecalhoModulo;
  abas: IItemMenuTreinamento[];
  paginaAtual: Pagina;
  navegar: (pagina: Pagina) => void;

  // Páginas internas que devem destacar uma aba
  // (ex.: 'documentoDetalhe' → aba 'documentos').
  paginasFilhas?: Partial<Record<Pagina, Pagina>>;
}

const ModuloCabecalho:
  React.FC<IModuloCabecalhoProps> = ({
    config,
    abas,
    paginaAtual,
    navegar,
    paginasFilhas
  }) => {

    const IconeHero =
      Icones[config.icone];

    const paginaDaAba =
      (paginasFilhas && paginasFilhas[paginaAtual]) ||
      paginaAtual;

    return (
      <>
        <section className={styles.trainingHero}>

          <div className={styles.heroIcon}>
            <IconeHero />
          </div>

          <div className={styles.heroText}>
            <h1>{config.titulo}</h1>
            <h2>{config.subtitulo}</h2>
            <p>{config.descricao}</p>
          </div>

          <div className={styles.heroQuote}>
            <p>“{config.citacao}”</p>
            <strong>DGT</strong>
          </div>

        </section>

        {
          abas.length > 0 &&
          (
            <nav className={styles.trainingTabs}>
              {
                abas.map(
                  (aba, indice) => {

                    const ativo =
                      paginaDaAba === aba.pagina;

                    const IconeAba =
                      Icones[aba.icon];

                    return (
                      <button
                        key={`${aba.label}-${indice}`}
                        type="button"
                        className={
                          ativo
                            ? styles.trainingTabActive
                            : styles.trainingTab
                        }
                        onClick={() => navegar(aba.pagina)}
                        aria-current={ativo ? 'page' : undefined}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            color: ativo ? '#0874ce' : '#5C7287'
                          }}
                        >
                          <IconeAba />
                        </span>

                        <strong>{aba.label}</strong>
                      </button>
                    );
                  }
                )
              }
            </nav>
          )
        }
      </>
    );
  };

export default ModuloCabecalho;
