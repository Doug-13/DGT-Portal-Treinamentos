import * as React from 'react';

import PageHeader from
  '../../components/layout/PageHeader';

import {
  IItemConformidade,
  IResumoConformidade
} from '../../services/ConformidadeService';

export interface IIndicadoresPageProps {
  itens:
    IItemConformidade[];

  resumo:
    IResumoConformidade;

  onVoltar:
    () => void;
}

const Indicador:
  React.FC<{
    titulo: string;
    valor: string | number;
    detalhe?: string;
  }> = ({
    titulo,
    valor,
    detalhe
  }) => (
    <article
      style={{
        background:
          '#ffffff',
        border:
          '1px solid #e5e7eb',
        borderRadius:
          '16px',
        padding:
          '20px',
        minHeight:
          '118px'
      }}
    >
      <span
        style={{
          display:
            'block',
          fontSize:
            '12px',
          color:
            '#64748b',
          marginBottom:
            '8px'
        }}
      >
        {titulo}
      </span>

      <strong
        style={{
          display:
            'block',
          fontSize:
            '30px',
          lineHeight:
            1.1,
          color:
            '#0b1f3a'
        }}
      >
        {valor}
      </strong>

      {detalhe && (
        <small
          style={{
            display:
              'block',
            marginTop:
              '8px',
            color:
              '#64748b'
          }}
        >
          {detalhe}
        </small>
      )}
    </article>
  );

const Barra:
  React.FC<{
    label: string;
    valor: number;
    total: number;
  }> = ({
    label,
    valor,
    total
  }) => {

    const percentual =
      total > 0
        ? Math.round(
            (
              valor /
              total
            ) *
            100
          )
        : 0;

    return (
      <div
        style={{
          marginBottom:
            '14px'
        }}
      >
        <div
          style={{
            display:
              'flex',
            justifyContent:
              'space-between',
            gap:
              '12px',
            marginBottom:
              '6px'
          }}
        >
          <span>
            {label}
          </span>

          <strong>
            {valor} ({percentual}%)
          </strong>
        </div>

        <div
          style={{
            height:
              '10px',
            borderRadius:
              '999px',
            background:
              '#eef2f7',
            overflow:
              'hidden'
          }}
        >
          <div
            style={{
              width:
                `${percentual}%`,
              height:
                '100%',
              background:
                '#0091ff',
              borderRadius:
                '999px'
            }}
          />
        </div>
      </div>
    );
  };

const IndicadoresPage:
  React.FC<IIndicadoresPageProps> = (
    props
  ) => {

    const total =
      props.resumo.total;

    const notas =
      props.itens
        .map(
          item =>
            item.nota
        )
        .filter(
          (
            nota
          ): nota is number =>
            typeof nota ===
              'number'
        );

    const notaMedia =
      notas.length > 0
        ? Math.round(
            notas.reduce(
              (
                soma,
                nota
              ) =>
                soma +
                nota,
              0
            ) /
            notas.length
          )
        : 0;

    const retreinamentos =
      props.itens.filter(
        item =>
          item.origem
            .toLowerCase()
            .indexOf(
              'revis'
            ) >= 0 ||
          item.origem
            .toLowerCase()
            .indexOf(
              'reciclag'
            ) >= 0
      ).length;

    const pessoas =
      new Set(
        props.itens.map(
          item =>
            item.usuario
        )
      ).size;

    const treinamentos =
      new Set(
        props.itens.map(
          item =>
            item.treinamento
        )
      ).size;

    return (
      <section>
        <PageHeader
          titulo="Indicadores"
          subtitulo="Visão consolidada da operação de treinamentos."
        />

        <button
          type="button"
          onClick={
            props.onVoltar
          }
        >
          ← Voltar
        </button>

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(170px,1fr))',
            gap:
              '14px',
            marginTop:
              '18px'
          }}
        >
          <Indicador
            titulo="Conformidade"
            valor={
              `${props.resumo.conformidadePercentual}%`
            }
          />

          <Indicador
            titulo="Pessoas"
            valor={
              pessoas
            }
          />

          <Indicador
            titulo="Treinamentos"
            valor={
              treinamentos
            }
          />

          <Indicador
            titulo="Concluídos"
            valor={
              props.resumo.concluidos
            }
          />

          <Indicador
            titulo="Pendentes"
            valor={
              props.resumo.pendentes
            }
          />

          <Indicador
            titulo="Vencidos"
            valor={
              props.resumo.vencidos
            }
          />

          <Indicador
            titulo="A vencer"
            valor={
              props.resumo.aVencer
            }
            detalhe="Próximos 30 dias"
          />

          <Indicador
            titulo="Nota média"
            valor={
              `${notaMedia}%`
            }
          />

          <Indicador
            titulo="Retreinamentos"
            valor={
              retreinamentos
            }
          />
        </div>

        <div
          style={{
            display:
              'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(320px,1fr))',
            gap:
              '16px',
            marginTop:
              '18px'
          }}
        >
          <article
            style={{
              background:
                '#fff',
              border:
                '1px solid #e5e7eb',
              borderRadius:
                '16px',
              padding:
                '20px'
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                color:
                  '#0b1f3a'
              }}
            >
              Distribuição por status
            </h3>

            <Barra
              label="Concluídos"
              valor={
                props.resumo.concluidos
              }
              total={
                total
              }
            />

            <Barra
              label="Pendentes"
              valor={
                props.resumo.pendentes
              }
              total={
                total
              }
            />

            <Barra
              label="Vencidos"
              valor={
                props.resumo.vencidos
              }
              total={
                total
              }
            />

            <Barra
              label="A vencer"
              valor={
                props.resumo.aVencer
              }
              total={
                total
              }
            />

            <Barra
              label="Em andamento"
              valor={
                props.resumo.emAndamento
              }
              total={
                total
              }
            />

            <Barra
              label="Reprovados"
              valor={
                props.resumo.reprovados
              }
              total={
                total
              }
            />
          </article>

          <article
            style={{
              background:
                '#fff',
              border:
                '1px solid #e5e7eb',
              borderRadius:
                '16px',
              padding:
                '20px'
            }}
          >
            <h3
              style={{
                marginTop:
                  0,
                color:
                  '#0b1f3a'
              }}
            >
              Power BI
            </h3>

            <p
              style={{
                color:
                  '#475569',
                lineHeight:
                  1.6
              }}
            >
              Esta área está preparada para receber o relatório corporativo
              do Power BI. Os indicadores desta página continuam disponíveis
              mesmo antes da publicação do relatório.
            </p>

            <div
              style={{
                marginTop:
                  '18px',
                minHeight:
                  '220px',
                border:
                  '1px dashed #cbd5e1',
                borderRadius:
                  '12px',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                textAlign:
                  'center',
                padding:
                  '20px',
                background:
                  '#f8fafc',
                color:
                  '#64748b'
              }}
            >
              Power BI incorporado será inserido aqui
            </div>
          </article>
        </div>
      </section>
    );
  };

export default IndicadoresPage;
