import {
  DataverseService
} from '../DataverseService';

import {
  BaseImplantacoes
} from './BaseImplantacoes';

import {
  AssistenteImplantacoes,
  IPedidoAssistente
} from './AssistenteImplantacoes';

import {
  ISessaoPainel,
  podeNoPainel
} from './permissoesImplantacoes';

// ============================================================
// IMPLANTAÇÕES — ponte das rotas "api/*" do painel
//
// O painel chamava um servidor próprio (tools/servidor.py) por
// fetch("api/..."). No portal não há esse servidor: esta ponte
// recebe as mesmas chamadas e as atende com os serviços do portal.
// Qualquer outro endereço (mapas, rotas) segue para a rede normalmente.
//
//   api/assistente          → AssistenteImplantacoes (Custom API da IA de Licitações)
//   api/auth/*, api/admin/* → não existem mais (acessos são do portal)
// ============================================================

export type BuscarPainel =
  (entrada: string, opcoes?: RequestInit) => Promise<Response>;

type Resultado = { status: number; corpo: unknown };

export type RotaPainel =
  (caminho: string, corpo: Record<string, unknown>, consulta: string) => Promise<Resultado | undefined>;

const responder = (resultado: Resultado): Response =>
  new Response(
    typeof resultado.corpo === 'string'
      ? resultado.corpo
      : JSON.stringify(resultado.corpo),
    {
      status: resultado.status,
      headers: {
        'Content-Type': typeof resultado.corpo === 'string'
          ? 'text/html; charset=utf-8'
          : 'application/json; charset=utf-8'
      }
    }
  );

const mensagemErro = (erro: unknown): string => {

  const bruto = erro instanceof Error ? erro.message : String(erro);

  // O Dataverse devolve { "error": { "message": "..." } }: usa só a mensagem.
  const json = /\{[\s\S]*\}/.exec(bruto);

  if (json) {
    try {
      const dados = JSON.parse(json[0]) as { error?: { message?: string } };
      if (dados.error && dados.error.message) {
        return dados.error.message.substring(0, 400);
      }
    } catch {
      // segue com o texto bruto
    }
  }

  return bruto.substring(0, 400);
};

export const criarPonteApi = (
  janela: Window,
  dataverse: DataverseService,
  base: BaseImplantacoes,
  sessao: ISessaoPainel,
  rotasExtras?: RotaPainel[]
): BuscarPainel => {

  const assistente = new AssistenteImplantacoes(dataverse, base);

  const atender = async (
    caminho: string,
    corpo: Record<string, unknown>,
    consulta: string
  ): Promise<Resultado> => {

    if (caminho === 'api/assistente') {

      if (!podeNoPainel(sessao.perms, 'assistente')) {
        return { status: 403, corpo: { erro: 'Seu perfil no portal não inclui o Assistente IA.' } };
      }

      const pergunta = String(corpo.pergunta || '').trim();

      if (!pergunta) {
        return { status: 400, corpo: { erro: 'Escreva a pergunta.' } };
      }

      try {
        const texto = await assistente.responder(corpo as unknown as IPedidoAssistente);
        return { status: 200, corpo: { texto } };
      } catch (erro) {

        const detalhe = mensagemErro(erro);

        if (/0x80060888|not found|Could not find/i.test(detalhe)) {
          return { status: 503, corpo: { erro: 'A IA do portal não está instalada (Custom API dgt_AnalisarLicitacaoIa). Veja docs/ia-licitacoes.md.' } };
        }

        if (/\b403\b|prv|privilege/i.test(detalhe)) {
          return { status: 403, corpo: { erro: 'Sem permissão para usar a IA no Dataverse (é preciso Criar em "Análise de IA de licitação").' } };
        }

        return { status: 502, corpo: { erro: detalhe } };
      }
    }

    for (let i = 0; i < (rotasExtras || []).length; i++) {
      const resultado = await (rotasExtras as RotaPainel[])[i](caminho, corpo, consulta);
      if (resultado) {
        return resultado;
      }
    }

    if (caminho === 'api/auth/logout') {
      return { status: 200, corpo: {} };
    }

    return {
      status: 404,
      corpo: { erro: 'Esta função do painel antigo não existe no portal.' }
    };
  };

  return async (entrada: string, opcoes?: RequestInit): Promise<Response> => {

    const endereco = String(entrada);

    if (!/^\/?api\//.test(endereco)) {
      return janela.fetch(endereco, opcoes);
    }

    const semBarra = endereco.replace(/^\//, '');
    const corte = semBarra.indexOf('?');
    const caminho = corte >= 0 ? semBarra.substring(0, corte) : semBarra;
    const consulta = corte >= 0 ? semBarra.substring(corte + 1) : '';

    let corpo: Record<string, unknown> = {};

    if (opcoes && typeof opcoes.body === 'string' && opcoes.body) {
      try {
        corpo = JSON.parse(opcoes.body) as Record<string, unknown>;
      } catch {
        corpo = {};
      }
    }

    try {
      return responder(await atender(caminho, corpo, consulta));
    } catch (erro) {
      return responder({ status: 500, corpo: { erro: mensagemErro(erro) } });
    }
  };
};
