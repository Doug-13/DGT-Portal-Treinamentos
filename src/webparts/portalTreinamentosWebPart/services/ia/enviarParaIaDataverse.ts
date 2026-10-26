import {
  DataverseService
} from '../DataverseService';

import {
  EnviarParaIa,
  IRequisicaoIa,
  IRespostaIa
} from './provedoresIa';

// ============================================================
// Envio do prompt ao Claude PELO DATAVERSE
//
//   Portal ──(login Dataverse)──► Custom API dgt_AnalisarLicitacaoIa
//          ──► plugin AnalisarLicitacaoIaPlugin ──(chave)──► API do Claude
//
// A chave fica na Configuração segura do passo do plugin. O portal
// só envia o prompt já montado e recebe o texto gerado.
// ============================================================

export const criarEnviarParaIaDataverse = (
  dataverse: DataverseService
): EnviarParaIa =>
  async (requisicao: IRequisicaoIa): Promise<IRespostaIa> => {

    try {
      const resultado = await dataverse.analisarLicitacaoIa({ ...requisicao });
      // "parada" vem do plugin (pode não existir em versões antigas).
      return { texto: resultado.texto, parada: (resultado as { parada?: string }).parada };
    } catch (erro) {
      const bruto = erro instanceof Error ? erro.message : String(erro);

      // O Dataverse devolve { "error": { "message": "..." } }: usa só
      // a mensagem do plugin, sem os restos do JSON.
      let mensagem = bruto;
      const json = /\{[\s\S]*\}/.exec(bruto);
      if (json) {
        try {
          const dados = JSON.parse(json[0]) as { error?: { message?: string } };
          if (dados.error && dados.error.message) {
            mensagem = dados.error.message;
          }
        } catch {
          mensagem = bruto;
        }
      }

      if (/\b404\b|not found|Resource not found|0x80060888|Could not find/i.test(mensagem)) {
        throw new Error('A Custom API dgt_AnalisarLicitacaoIa ainda não existe no Dataverse (rode o script criar-tabelas-ia-licitacoes.ps1).');
      }
      if (/\b403\b|prv|privilege/i.test(mensagem)) {
        throw new Error('Sem permissão para usar a IA (é preciso Criar em "Análise de IA de licitação").');
      }
      throw new Error(mensagem.substring(0, 400));
    }
  };
