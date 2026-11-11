import {
  DataverseService
} from '../DataverseService';

import {
  IPedidoAssinatura,
  IRepositorioAssinatura
} from './controleAssinatura';

import {
  SituacaoAssinatura
} from '../fluxo/assinaturaFluxo';

// ============================================================
// PEDIDOS DE ASSINATURA (Dataverse: dgt_assinatura)
//
// O portal cria o pedido (situação "pendente"); o Power Automate envia
// ao provedor e grava o retorno (enviado/assinado/recusado/expirado/
// cancelado/erro, link e arquivo assinado). Ver docs/assinatura-digital.md.
// ============================================================

export const TABELA_ASSINATURA = 'dgt_assinatura';

export const COL_ASSINATURA = {
  id: 'dgt_assinaturaid',
  titulo: 'dgt_name',
  chave: 'dgt_chave',
  provedor: 'dgt_provedor',
  situacao: 'dgt_situacao',
  origem: 'dgt_origem',
  alvoId: 'dgt_alvoid',
  codigo: 'dgt_codigo',
  arquivos: 'dgt_arquivosjson',
  signatarios: 'dgt_signatariosjson',
  ordemSequencial: 'dgt_ordemsequencial',
  prazo: 'dgt_prazo',
  mensagem: 'dgt_mensagem',
  idExterno: 'dgt_idexterno',
  linkAcompanhamento: 'dgt_linkacompanhamento',
  arquivoAssinado: 'dgt_arquivoassinado',
  erro: 'dgt_erro',
  solicitadoPor: 'dgt_solicitadopor',
  concluidoEm: 'dgt_concluidoem'
};

const texto = (registro: Record<string, unknown>, coluna: string): string =>
  registro[coluna] === undefined || registro[coluna] === null ? '' : String(registro[coluna]);

const json = <T,>(valor: string, padrao: T): T => {
  try { return valor ? JSON.parse(valor) as T : padrao; } catch { return padrao; }
};

const mensagem = (erro: unknown): string => (erro instanceof Error ? erro.message : String(erro));

const explicar = (erro: unknown): Error =>
  /could not find|does not exist|não existe|404/i.test(mensagem(erro))
    ? new Error('A tabela de pedidos de assinatura (dgt_assinatura) ainda não existe. Execute scripts/dataverse/criar-tabelas-assinatura.ps1.')
    : erro instanceof Error ? erro : new Error(String(erro));

export class AssinaturaService implements IRepositorioAssinatura {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  private converter(r: Record<string, unknown>): IPedidoAssinatura {
    return {
      id: texto(r, COL_ASSINATURA.id),
      chave: texto(r, COL_ASSINATURA.chave),
      titulo: texto(r, COL_ASSINATURA.titulo),
      provedor: texto(r, COL_ASSINATURA.provedor),
      situacao: (texto(r, COL_ASSINATURA.situacao) || 'pendente') as SituacaoAssinatura,
      origem: texto(r, COL_ASSINATURA.origem) === 'ambiente' ? 'ambiente' : 'documento',
      alvoId: texto(r, COL_ASSINATURA.alvoId),
      codigo: texto(r, COL_ASSINATURA.codigo),
      arquivos: json(texto(r, COL_ASSINATURA.arquivos), []),
      signatarios: json(texto(r, COL_ASSINATURA.signatarios), []),
      ordemSequencial: r[COL_ASSINATURA.ordemSequencial] === true,
      prazo: texto(r, COL_ASSINATURA.prazo),
      mensagem: texto(r, COL_ASSINATURA.mensagem),
      idExterno: texto(r, COL_ASSINATURA.idExterno),
      linkAcompanhamento: texto(r, COL_ASSINATURA.linkAcompanhamento),
      arquivoAssinado: texto(r, COL_ASSINATURA.arquivoAssinado),
      erro: texto(r, COL_ASSINATURA.erro),
      solicitadoPor: texto(r, COL_ASSINATURA.solicitadoPor),
      concluidoEm: texto(r, COL_ASSINATURA.concluidoEm)
    };
  }

  public async ler(chave: string): Promise<IPedidoAssinatura | undefined> {
    try {
      const linhas = await this.dataverse.listarRegistros(
        TABELA_ASSINATURA,
        `$filter=${COL_ASSINATURA.chave} eq '${chave.replace(/'/g, "''")}'&$top=1`
      );
      return linhas.length > 0 ? this.converter(linhas[0]) : undefined;
    } catch (erro) {
      throw explicar(erro);
    }
  }

  public async criar(pedido: Omit<IPedidoAssinatura, 'id'>): Promise<IPedidoAssinatura> {
    const corpo: Record<string, unknown> = {
      [COL_ASSINATURA.titulo]: pedido.titulo,
      [COL_ASSINATURA.chave]: pedido.chave,
      [COL_ASSINATURA.provedor]: pedido.provedor,
      [COL_ASSINATURA.situacao]: pedido.situacao,
      [COL_ASSINATURA.origem]: pedido.origem,
      [COL_ASSINATURA.alvoId]: pedido.alvoId,
      [COL_ASSINATURA.codigo]: pedido.codigo,
      [COL_ASSINATURA.arquivos]: JSON.stringify(pedido.arquivos),
      [COL_ASSINATURA.signatarios]: JSON.stringify(pedido.signatarios),
      [COL_ASSINATURA.ordemSequencial]: pedido.ordemSequencial,
      [COL_ASSINATURA.prazo]: pedido.prazo,
      [COL_ASSINATURA.mensagem]: pedido.mensagem,
      [COL_ASSINATURA.solicitadoPor]: pedido.solicitadoPor
    };
    try {
      const id = await this.dataverse.criarRegistro(TABELA_ASSINATURA, corpo);
      return { ...pedido, id: String(id || '') };
    } catch (erro) {
      throw explicar(erro);
    }
  }

  // Erro no envio: volta para "pendente" (o Power Automate tenta de novo).
  public async reenviar(id: string): Promise<void> {
    await this.dataverse.atualizarRegistro(TABELA_ASSINATURA, id, {
      [COL_ASSINATURA.situacao]: 'pendente',
      [COL_ASSINATURA.erro]: ''
    });
  }
}
