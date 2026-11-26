import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// INTEGRAÇÕES (menu do usuário › Integrações, só Administrador)
//
// Mesmo padrão da Administração da IA (IaAdminService):
//   dgt_integracaoconfiguracao  uma linha por integração (ex.: CIGAM-BOM):
//                               endereço, ambiente, final do segredo e
//                               quem/quando trocou. O SEGREDO (dgt_segredo)
//                               é coluna protegida e NUNCA é lido aqui:
//                               salvar, verificar e remover passam pela
//                               Custom API dgt_GerenciarIntegracao.
//
// Script: scripts/dataverse/criar-integracoes-configuracao.ps1
// ============================================================

export const INTEGRACAO_API_GERENCIAR = 'dgt_GerenciarIntegracao';
const TABELA = 'dgt_integracaoconfiguracao';

export interface IIntegracao {
  id: string;
  nome: string;
  descricao: string;
  url: string;
  ambiente: string;
  segredoFinal: string;
  segredoAtualizadoEm: string;
  segredoAtualizadoPor: string;
}

export interface IResultadoIntegracao {
  ok: boolean;
  mensagem: string;
  segredoFinal?: string;
}

export type AcaoIntegracao = 'salvarSegredo' | 'salvarEndereco' | 'verificar' | 'removerSegredo';

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const mensagemDeErro = (erro: unknown): string => {
  const bruto = erro instanceof Error ? erro.message : String(erro);
  const json = /\{[\s\S]*\}/.exec(bruto);
  if (json) {
    try {
      const dados = JSON.parse(json[0]) as { error?: { message?: string } };
      if (dados.error && dados.error.message) {
        return dados.error.message.substring(0, 400);
      }
    } catch {
      // usa o texto bruto
    }
  }
  if (/\b404\b|Resource not found|0x80060888|Could not find/i.test(bruto)) {
    return 'As integrações ainda não foram criadas no Dataverse (rode scripts/dataverse/criar-integracoes-configuracao.ps1).';
  }
  if (/\b403\b|prv|privilege/i.test(bruto)) {
    return 'Sem permissão: é preciso Ler e Gravar em "Configuração de integração" (perfil de Administrador).';
  }
  return bruto.substring(0, 400);
};

export class IntegracaoAdminService {

  constructor(private readonly dataverse: DataverseService) { }

  // Lista as integrações SEM o segredo (a coluna protegida não é pedida).
  public async listar(): Promise<IIntegracao[]> {
    try {
      const registros = await this.dataverse.listarRegistros(
        TABELA,
        '$select=dgt_integracaoconfiguracaoid,dgt_name,dgt_descricao,dgt_url,dgt_ambiente,dgt_segredofinal,dgt_segredoatualizadoem,dgt_segredoatualizadopor' +
        '&$filter=statecode eq 0&$orderby=dgt_name'
      );
      return registros.map(registro => ({
        id: texto(registro, 'dgt_integracaoconfiguracaoid'),
        nome: texto(registro, 'dgt_name'),
        descricao: texto(registro, 'dgt_descricao'),
        url: texto(registro, 'dgt_url'),
        ambiente: texto(registro, 'dgt_ambiente'),
        segredoFinal: texto(registro, 'dgt_segredofinal'),
        segredoAtualizadoEm: texto(registro, 'dgt_segredoatualizadoem'),
        segredoAtualizadoPor: texto(registro, 'dgt_segredoatualizadopor')
      }));
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }

  public async gerenciar(
    acao: AcaoIntegracao,
    integracao: string,
    valores?: { segredo?: string; url?: string; ambiente?: string }
  ): Promise<IResultadoIntegracao> {
    const payload: Record<string, unknown> = { acao, integracao };
    if (acao === 'salvarSegredo') {
      payload.segredo = ((valores && valores.segredo) || '').trim();
    }
    if (acao === 'salvarEndereco') {
      payload.url = ((valores && valores.url) || '').trim();
      payload.ambiente = ((valores && valores.ambiente) || '').trim();
    }
    try {
      const resultado = await this.dataverse.executarCustomApiJson(INTEGRACAO_API_GERENCIAR, payload);
      if (Object.keys(resultado).length === 0) {
        throw new Error(
          'A Custom API dgt_GerenciarIntegracao respondeu vazio: o passo do plugin GerenciarIntegracaoPlugin não está registrado, está desativado ou é assíncrono.'
        );
      }
      return {
        ok: resultado.ok === true,
        mensagem: String(resultado.mensagem || ''),
        segredoFinal: resultado.segredoFinal ? String(resultado.segredoFinal) : undefined
      };
    } catch (erro) {
      const mensagem = mensagemDeErro(erro);
      if (/respondeu vazio/.test(mensagem)) {
        throw new Error(mensagem);
      }
      throw new Error(/não foi encontrad|not found|404/i.test(mensagem)
        ? `A Custom API ${INTEGRACAO_API_GERENCIAR} ainda não existe ou o passo do plugin não foi registrado.`
        : mensagem);
    } finally {
      // Não guarda o segredo em memória além da chamada.
      delete payload.segredo;
    }
  }
}
