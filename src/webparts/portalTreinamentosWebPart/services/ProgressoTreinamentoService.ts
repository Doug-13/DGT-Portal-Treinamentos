import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

import {
  StatusUsuarioModulo
} from '../models/Modulo';

import {
  calcularProgressoModulos
} from '../utils/progressoTreinamento';

// ============================================================
// PROGRESSO REAL DOS TREINAMENTOS DO USUÁRIO
//
// Antes, a tela inicial mostrava um valor FIXO (50% para
// "Em andamento"), mesmo sem nenhum módulo iniciado.
// Agora o percentual vem dos registros reais:
//   dgt_modulo         (módulos ativos de cada treinamento)
//   dgt_usuariomodulo  (progresso do usuário em cada módulo)
// com a mesma regra da tela do treinamento
// (utils/progressoTreinamento.ts).
//
// São 2 consultas por lote de até 25 treinamentos — não uma
// por treinamento.
// ============================================================

export interface IAtribuicaoProgresso {
  usuarioTreinamentoId: string;
  treinamentoId: string;
}

const TAMANHO_LOTE = 25;

const guid = (valor: unknown): string =>
  String(valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const ehGuid = (valor: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(valor);

const lotes = <T>(itens: T[], tamanho: number): T[][] => {
  const resultado: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultado.push(itens.slice(i, i + tamanho));
  }
  return resultado;
};

const filtroOu = (campo: string, ids: string[]): string =>
  '(' + ids.map(id => `${campo} eq ${id}`).join(' or ') + ')';

export class ProgressoTreinamentoService {

  private readonly dataverse: DataverseService;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // Devolve { usuarioTreinamentoId → percentual }.
  // Atribuições sem módulos ficam fora do resultado (quem chama
  // decide o valor padrão).
  public async calcular(
    atribuicoes: IAtribuicaoProgresso[]
  ): Promise<Record<string, number>> {

    const validas = atribuicoes
      .map(a => ({
        usuarioTreinamentoId: guid(a.usuarioTreinamentoId),
        treinamentoId: guid(a.treinamentoId)
      }))
      .filter(a => ehGuid(a.usuarioTreinamentoId) && ehGuid(a.treinamentoId));

    if (validas.length === 0) {
      return {};
    }

    const idsTreinamento = validas
      .map(a => a.treinamentoId)
      .filter((id, i, lista) => lista.indexOf(id) === i);

    const idsAtribuicao = validas
      .map(a => a.usuarioTreinamentoId)
      .filter((id, i, lista) => lista.indexOf(id) === i);

    const [modulos, progressos] = await Promise.all([
      this.lerEmLotes(
        'dgt_modulo',
        idsTreinamento,
        ids =>
          '$select=dgt_moduloid,dgt_obrigatorio,_dgt_treinamento_value' +
          `&$filter=dgt_ativo eq true and ${filtroOu('_dgt_treinamento_value', ids)}`
      ),
      this.lerEmLotes(
        'dgt_usuariomodulo',
        idsAtribuicao,
        ids =>
          '$select=dgt_status,_dgt_modulo_value,_dgt_usuariotreinamento_value' +
          `&$filter=dgt_ativo eq true and ${filtroOu('_dgt_usuariotreinamento_value', ids)}`
      )
    ]);

    // treinamento → módulos
    const modulosPorTreinamento: Record<string, Array<{ id: string; obrigatorio: boolean }>> = {};

    modulos.forEach(m => {
      const treinamento = guid(m._dgt_treinamento_value);
      (modulosPorTreinamento[treinamento] = modulosPorTreinamento[treinamento] || []).push({
        id: guid(m.dgt_moduloid),
        obrigatorio: m.dgt_obrigatorio === true
      });
    });

    // atribuição → módulos concluídos
    const concluidosPorAtribuicao: Record<string, Record<string, boolean>> = {};

    progressos.forEach(p => {
      if (Number(p.dgt_status) !== StatusUsuarioModulo.Concluido) {
        return;
      }
      const atribuicao = guid(p._dgt_usuariotreinamento_value);
      (concluidosPorAtribuicao[atribuicao] = concluidosPorAtribuicao[atribuicao] || {})[
        guid(p._dgt_modulo_value)
      ] = true;
    });

    const resultado: Record<string, number> = {};

    validas.forEach(a => {
      const lista = modulosPorTreinamento[a.treinamentoId] || [];
      if (lista.length === 0) {
        return;
      }
      const concluidos = concluidosPorAtribuicao[a.usuarioTreinamentoId] || {};
      resultado[a.usuarioTreinamentoId] = calcularProgressoModulos(
        lista.map(m => ({
          obrigatorio: m.obrigatorio,
          concluido: !!concluidos[m.id]
        }))
      ).progresso;
    });

    return resultado;
  }

  private async lerEmLotes(
    tabela: string,
    ids: string[],
    consulta: (lote: string[]) => string
  ): Promise<IDataverseRecord[]> {

    const partes = await Promise.all(
      lotes(ids, TAMANHO_LOTE).map(lote =>
        this.dataverse.listarRegistros(tabela, consulta(lote))
      )
    );

    return partes.reduce<IDataverseRecord[]>((todos, parte) => todos.concat(parte), []);
  }
}
