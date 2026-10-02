import * as React from 'react';

import {
  ETAPAS_TESTE_INICIAIS,
  IEtapaTeste,
  IResultadoTesteConexao,
  SituacaoEtapaTeste,
  testarConexaoPncp
} from '../../services/PncpService';

import {
  COR,
  FONTE,
  botaoSecundario,
  cartao,
  linhaAcoes,
  textoApoio,
  tituloSecao
} from './licitacoesEstilos';

// ============================================================
// LICITAÇÕES — TESTE DE CONEXÃO
//
// Responde a uma pergunta: o navegador consegue consultar a API
// do PNCP direto do SharePoint?
//
//   SIM → a busca funciona dentro do portal (opção A).
//   NÃO por CORS → a consulta precisa de um backend
//                  (Azure Function — opção B).
// ============================================================

export interface ILicitacoesTesteConexaoPageProps {
  onIrParaBusca: () => void;
}

const SIMBOLO: Record<SituacaoEtapaTeste, string> = {
  pendente: '○',
  executando: '◌',
  ok: '✓',
  alerta: '!',
  falha: '✕',
  ignorada: '–'
};

const ROTULO: Record<SituacaoEtapaTeste, string> = {
  pendente: 'Aguardando',
  executando: 'Testando…',
  ok: 'OK',
  alerta: 'Atenção',
  falha: 'Falhou',
  ignorada: 'Não executada'
};

const corSituacao = (
  situacao: SituacaoEtapaTeste
): { fundo: string; borda: string; texto: string } => {

  switch (situacao) {
    case 'ok':
      return { fundo: COR.cianoClaro, borda: COR.ciano, texto: COR.azul };
    case 'alerta':
      return { fundo: COR.indigoClaro, borda: COR.indigo, texto: COR.indigo };
    case 'falha':
      return { fundo: COR.azul, borda: COR.azul, texto: '#ffffff' };
    case 'executando':
      return { fundo: '#ffffff', borda: COR.ciano, texto: COR.azul };
    default:
      return { fundo: COR.neutro, borda: COR.cinzaClaro, texto: COR.cinza };
  }
};

const LinhaEtapa: React.FC<{
  etapa: IEtapaTeste;
  indice: number;
}> = ({ etapa, indice }) => {

  const cores = corSituacao(etapa.situacao);

  return (
    <li
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        padding: '12px 0',
        borderTop: indice === 0 ? 'none' : `1px solid ${COR.neutro}`
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 14,
          background: cores.fundo,
          border: `2px solid ${cores.borda}`,
          color: cores.texto
        }}
      >
        {SIMBOLO[etapa.situacao]}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <strong style={{ fontSize: 13, color: COR.azul }}>
            {indice + 1}. {etapa.titulo}
          </strong>

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: etapa.situacao === 'falha' ? COR.azul : cores.texto
            }}
          >
            {ROTULO[etapa.situacao]}
          </span>
        </div>

        {etapa.detalhe && (
          <p style={{ ...textoApoio, marginTop: 4 }}>
            {etapa.detalhe}
          </p>
        )}
      </div>
    </li>
  );
};

const CONTEUDO_VEREDICTO: Record<
  IResultadoTesteConexao['veredicto'],
  { titulo: string; texto: string; proximoPasso: string; destaque: string }
> = {
  viavel: {
    titulo: 'A busca pode rodar dentro do portal',
    texto:
      'O navegador conseguiu consultar e ler a API do PNCP direto do SharePoint. ' +
      'Não é necessário backend para usar a busca de licitações.',
    proximoPasso:
      'Faça uma busca real na aba "Buscar licitações" para validar os filtros e o tempo de resposta.',
    destaque: COR.ciano
  },
  bloqueadoCors: {
    titulo: 'O PNCP bloqueia chamadas vindas do navegador',
    texto:
      'O servidor do PNCP responde, mas não autoriza páginas de outros domínios a ler a resposta (CORS). ' +
      'Esta limitação é do PNCP e não pode ser contornada no SPFx.',
    proximoPasso:
      'Seguir com a opção B: publicar a consulta numa Azure Function e o portal chama a Function. ' +
      'As regras de filtro e score já estão separadas em utils/licitacoesFiltro.ts para isso.',
    destaque: COR.indigo
  },
  semConexao: {
    titulo: 'Não foi possível alcançar o PNCP',
    texto:
      'O navegador não obteve resposta de pncp.gov.br. Pode ser instabilidade do PNCP, ' +
      'rede, proxy ou firewall corporativo bloqueando o domínio.',
    proximoPasso:
      'Abra https://pncp.gov.br numa nova aba. Se abrir, peça à TI para liberar pncp.gov.br no proxy; ' +
      'se não abrir, o PNCP pode estar fora do ar — repita o teste mais tarde.',
    destaque: COR.azul
  },
  erroApi: {
    titulo: 'A conexão funciona, mas a API respondeu com erro',
    texto:
      'O navegador conseguiu falar com o PNCP, porém a resposta não veio como esperado.',
    proximoPasso:
      'Repita o teste em alguns minutos. Se persistir, verifique se a API de consulta do PNCP mudou de versão.',
    destaque: COR.indigo
  }
};

const montarDiagnosticoTexto = (
  resultado: IResultadoTesteConexao
): string => {

  const linhas = [
    'Diagnóstico de conexão — PNCP',
    `Executado em: ${resultado.executadoEm.toLocaleString('pt-BR')}`,
    `Resultado: ${CONTEUDO_VEREDICTO[resultado.veredicto].titulo}`,
    `URL testada: ${resultado.urlTestada}`,
    resultado.latenciaMs !== undefined ? `Latência: ${resultado.latenciaMs} ms` : '',
    `Origem: ${window.location.origin}`,
    `Navegador: ${navigator.userAgent}`,
    '',
    'Etapas:'
  ];

  resultado.etapas.forEach((etapa, indice) => {
    linhas.push(
      `${indice + 1}. ${etapa.titulo}: ${ROTULO[etapa.situacao]}` +
      `${etapa.detalhe ? ' — ' + etapa.detalhe : ''}`
    );
  });

  return linhas.filter(linha => linha !== undefined).join('\n');
};

const LicitacoesTesteConexaoPage: React.FC<ILicitacoesTesteConexaoPageProps> = ({
  onIrParaBusca
}) => {

  const [executando, setExecutando] = React.useState<boolean>(false);
  const [etapas, setEtapas] = React.useState<IEtapaTeste[]>(ETAPAS_TESTE_INICIAIS);
  const [resultado, setResultado] = React.useState<IResultadoTesteConexao | undefined>(undefined);
  const [copiado, setCopiado] = React.useState<boolean>(false);

  const montadoRef = React.useRef<boolean>(true);

  React.useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const executar = (): void => {

    setExecutando(true);
    setResultado(undefined);
    setCopiado(false);
    setEtapas(ETAPAS_TESTE_INICIAIS.map(etapa => ({ ...etapa })));

    testarConexaoPncp(novas => {
      if (montadoRef.current) {
        setEtapas(novas);
      }
    })
      .then(final => {
        if (montadoRef.current) {
          setResultado(final);
          setEtapas(final.etapas.map(etapa => ({ ...etapa })));
        }
      })
      .catch(erro => {
        console.error('[Licitações] Falha no teste de conexão:', erro);
      })
      .then(() => {
        if (montadoRef.current) {
          setExecutando(false);
        }
      })
      .catch(() => undefined);
  };

  const copiarDiagnostico = (): void => {

    if (!resultado) {
      return;
    }

    const texto = montarDiagnosticoTexto(resultado);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(texto)
        .then(() => setCopiado(true))
        .catch(() => window.prompt('Copie o diagnóstico:', texto));
    } else {
      window.prompt('Copie o diagnóstico:', texto);
    }
  };

  const veredicto = resultado
    ? CONTEUDO_VEREDICTO[resultado.veredicto]
    : undefined;

  return (
    <section style={{ fontFamily: FONTE }}>

      {/* EXPLICAÇÃO */}
      <div style={cartao}>
        <h2 style={tituloSecao}>
          Teste de conexão com o PNCP
        </h2>

        <p style={{ ...textoApoio, maxWidth: 760 }}>
          Verifica se este navegador consegue consultar a API pública do Portal Nacional
          de Contratações Públicas direto do SharePoint. O teste faz uma consulta pequena
          (pregões eletrônicos dos últimos 7 dias, 10 registros) e não grava nada.
        </p>

        <div style={{ ...linhaAcoes, marginTop: 16 }}>
          <button
            type="button"
            onClick={executar}
            disabled={executando}
          >
            {executando
              ? 'Testando…'
              : resultado
                ? 'Executar novamente'
                : 'Executar teste'}
          </button>

          {resultado && (
            <button
              type="button"
              style={botaoSecundario}
              onClick={copiarDiagnostico}
            >
              {copiado ? 'Diagnóstico copiado' : 'Copiar diagnóstico'}
            </button>
          )}
        </div>
      </div>

      {/* VEREDICTO */}
      {veredicto && resultado && (
        <div
          style={{
            ...cartao,
            borderLeft: `5px solid ${veredicto.destaque}`
          }}
          aria-live="polite"
        >
          <h2 style={{ ...tituloSecao, fontSize: 17 }}>
            {veredicto.titulo}
          </h2>

          <p style={{ ...textoApoio, maxWidth: 760, marginTop: 6 }}>
            {veredicto.texto}
          </p>

          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 8,
              background: COR.azulClaro,
              maxWidth: 760
            }}
          >
            <strong style={{ display: 'block', fontSize: 12, color: COR.azul, marginBottom: 4 }}>
              Próximo passo
            </strong>
            <span style={{ fontSize: 12, color: COR.azul, lineHeight: 1.5 }}>
              {veredicto.proximoPasso}
            </span>
          </div>

          {resultado.veredicto === 'viavel' && (
            <div style={{ marginTop: 14 }}>
              <button type="button" onClick={onIrParaBusca}>
                Ir para a busca de licitações
              </button>
            </div>
          )}
        </div>
      )}

      {/* ETAPAS */}
      <div style={cartao}>
        <h2 style={tituloSecao}>
          Etapas do teste
        </h2>

        <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
          {etapas.map((etapa, indice) => (
            <LinhaEtapa
              key={etapa.id}
              etapa={etapa}
              indice={indice}
            />
          ))}
        </ol>
      </div>

      {/* DETALHES TÉCNICOS */}
      {resultado && (
        <div style={cartao}>
          <h2 style={tituloSecao}>
            Detalhes técnicos
          </h2>

          <table style={{ marginTop: 10 }}>
            <tbody>
              <tr>
                <th style={{ width: 200 }}>Executado em</th>
                <td>{resultado.executadoEm.toLocaleString('pt-BR')}</td>
              </tr>
              <tr>
                <th>Origem da chamada</th>
                <td>{window.location.origin}</td>
              </tr>
              <tr>
                <th>Tempo de resposta</th>
                <td>{resultado.latenciaMs !== undefined ? `${resultado.latenciaMs} ms` : '-'}</td>
              </tr>
              <tr>
                <th>Registros no período</th>
                <td>
                  {resultado.totalRegistros !== undefined
                    ? resultado.totalRegistros.toLocaleString('pt-BR')
                    : '-'}
                </td>
              </tr>
              <tr>
                <th>URL testada</th>
                <td style={{ wordBreak: 'break-all' }}>{resultado.urlTestada}</td>
              </tr>
            </tbody>
          </table>

          {resultado.amostra && resultado.amostra.length > 0 && (
            <>
              <h2 style={{ ...tituloSecao, marginTop: 18 }}>
                Amostra recebida
              </h2>

              <p style={textoApoio}>
                Os três primeiros registros devolvidos, para confirmar que os dados chegam legíveis.
              </p>

              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Órgão</th>
                    <th>Modalidade</th>
                    <th>Objeto</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.amostra.map((item, indice) => (
                    <tr key={indice}>
                      <td>{item.orgao}</td>
                      <td>{item.modalidade}</td>
                      <td>{item.objeto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

    </section>
  );
};

export default LicitacoesTesteConexaoPage;
