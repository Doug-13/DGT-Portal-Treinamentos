import {
  DataverseService,
  IDataverseRecord
} from './DataverseService';

// ================================================================
// ATRIBUIÇÃO DE TRILHA
// ================================================================
// Atribui uma trilha inteira a uma pessoa ou às áreas.
//
// Para cada pessoa:
//   1. registra a matrícula na trilha (dgt_usuariotrilha) — é ela
//      que faz a trilha aparecer como "atribuída", mesmo quando os
//      treinamentos foram reaproveitados de conclusões anteriores;
//   2. chama a Custom API dgt_ProcessarAtribuicao para cada
//      treinamento ativo da trilha, na ordem da trilha (duplicidade,
//      reaproveitamento e liberação sequencial ficam com a API).
//
// Por área, além disso, grava o vínculo dgt_trilhaarea para que a
// trilha fique visível na área e, com o plugin
// AtribuirTrilhaPorAreaPlugin registrado, chegue também a quem
// entrar na área depois.
//
// Nada é apagado: atribuições e matrículas existentes são mantidas.
// ================================================================

export type OrigemAtribuicaoTrilha =
  | 'Individual'
  | 'Grupo';

export interface IOpcoesAtribuicaoTrilha {
  origem: OrigemAtribuicaoTrilha;
  referencia?: string;
  dataLimite?: string;   // yyyy-mm-dd (opcional)
  prazoDias?: number;    // usado quando dataLimite não é informada
  observacao?: string;
}

export interface IResumoAtribuicaoTrilha {
  pessoas: number;
  treinamentos: number;
  criados: number;
  reaproveitados: number;
  existentes: number;
  liberados: number;
  matriculasCriadas: number;
  falhas: string[];
}

export interface IProgressoAtribuicaoTrilha {
  atual: number;
  total: number;
  descricao: string;
}

interface IItemTrilha {
  treinamentoId: string;
  nome: string;
  ordem: number;
  prazoDias: number;
}

const texto = (
  registro: IDataverseRecord,
  campo: string,
  padrao = ''
): string => {
  const valor = registro[campo];

  return valor === undefined ||
    valor === null
    ? padrao
    : String(valor);
};

const booleano = (
  registro: IDataverseRecord,
  campo: string,
  padrao = true
): boolean => {
  const valor = registro[campo];

  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 1 || valor === '1' || valor === 'true') {
    return true;
  }

  if (valor === 0 || valor === '0' || valor === 'false') {
    return false;
  }

  return padrao;
};

const guid = (
  valor: string
): string =>
  (valor || '')
    .replace(/[{}]/g, '')
    .trim()
    .toLowerCase();

const somarDias = (
  dias: number
): string => {
  const data = new Date();

  data.setDate(
    data.getDate() + dias
  );

  return data
    .toISOString()
    .substring(0, 10);
};

export const resumoVazio =
  (): IResumoAtribuicaoTrilha => ({
    pessoas: 0,
    treinamentos: 0,
    criados: 0,
    reaproveitados: 0,
    existentes: 0,
    liberados: 0,
    matriculasCriadas: 0,
    falhas: []
  });

export class AtribuicaoTrilhaService {

  private readonly dataverse:
    DataverseService;

  private opcoesCache:
    Record<string, Array<{ value: number; label: string }>> = {};

  public constructor(
    dataverse: DataverseService
  ) {
    this.dataverse = dataverse;
  }

  // ============================================================
  // CONSULTAS
  // ============================================================

  public async listarTreinamentosDaTrilha(
    trilhaId: string
  ): Promise<IItemTrilha[]> {

    const id = guid(trilhaId);

    const registros =
      await this.dataverse.listarRegistros(
        'dgt_trilhatreinamento',
        '$select=dgt_ordem,dgt_diasparaconclusao,dgt_ativo,_dgt_treinamento_value' +
        `&$filter=_dgt_trilha_value eq ${id}` +
        '&$orderby=dgt_ordem asc'
      );

    return registros
      .filter(registro =>
        booleano(registro, 'dgt_ativo', true) &&
        !!texto(registro, '_dgt_treinamento_value')
      )
      .map(registro => ({
        treinamentoId:
          texto(registro, '_dgt_treinamento_value'),
        nome:
          texto(
            registro,
            '_dgt_treinamento_value@OData.Community.Display.V1.FormattedValue',
            'Treinamento'
          ),
        ordem:
          Number(texto(registro, 'dgt_ordem', '0')) || 0,
        prazoDias:
          Number(texto(registro, 'dgt_diasparaconclusao', '0')) || 0
      }))
      .sort((a, b) => a.ordem - b.ordem);
  }

  public async trilhaEhParaTodasAreas(
    trilhaId: string
  ): Promise<boolean> {

    const resultado =
      await this.dataverse.obterRegistro(
        'dgt_trilha',
        trilhaId,
        ['dgt_todasareas']
      );

    return !!resultado &&
      booleano(resultado.registro, 'dgt_todasareas', false);
  }

  // ============================================================
  // ATRIBUIR TRILHA A UMA PESSOA
  // ============================================================

  public async atribuirParaPessoa(
    usuarioId: string,
    trilhaId: string,
    opcoes: IOpcoesAtribuicaoTrilha,
    itensCarregados?: IItemTrilha[],
    resumo: IResumoAtribuicaoTrilha = resumoVazio()
  ): Promise<IResumoAtribuicaoTrilha> {

    const itens =
      itensCarregados ||
      await this.listarTreinamentosDaTrilha(trilhaId);

    if (itens.length === 0) {
      throw new Error(
        'Esta trilha não possui treinamentos ativos.'
      );
    }

    resumo.pessoas++;

    // 1. Matrícula na trilha (dgt_usuariotrilha)
    try {
      const criada =
        await this.garantirMatricula(
          usuarioId,
          trilhaId,
          opcoes
        );

      if (criada) {
        resumo.matriculasCriadas++;
      }
    } catch (e) {
      resumo.falhas.push(
        `Matrícula na trilha: ${e instanceof Error ? e.message : 'erro desconhecido'}`
      );
    }

    // 2. Treinamentos, na ordem da trilha
    for (const item of itens) {

      resumo.treinamentos++;

      const dataLimite =
        opcoes.dataLimite ||
        (opcoes.prazoDias && opcoes.prazoDias > 0
          ? somarDias(opcoes.prazoDias)
          : item.prazoDias > 0
            ? somarDias(item.prazoDias)
            : '');

      try {

        const retorno =
          await this.dataverse.processarAtribuicao({
            UsuarioId: usuarioId,
            TreinamentoId: item.treinamentoId,
            TrilhaId: trilhaId,
            Origem: opcoes.origem,
            OrigemId: opcoes.referencia || trilhaId,
            DataLimite: dataLimite,
            Observacao:
              opcoes.observacao ||
              'Atribuição da trilha completa.'
          });

        if (retorno.criado) {
          resumo.criados++;
        } else if (retorno.reutilizado) {
          resumo.reaproveitados++;
        } else {
          resumo.existentes++;
        }

        if (retorno.liberado) {
          resumo.liberados++;
        }

      } catch (e) {
        resumo.falhas.push(
          `${item.nome}: ${e instanceof Error ? e.message : 'erro desconhecido'}`
        );
      }
    }

    return resumo;
  }

  // ============================================================
  // ATRIBUIR TRILHA ÀS ÁREAS
  // ============================================================

  public async atribuirParaAreas(
    trilhaId: string,
    areaIds: string[],
    membrosPorArea: Record<string, string[]>,
    opcoes: IOpcoesAtribuicaoTrilha,
    aoProgredir?: (progresso: IProgressoAtribuicaoTrilha) => void
  ): Promise<IResumoAtribuicaoTrilha> {

    const resumo = resumoVazio();

    const itens =
      await this.listarTreinamentosDaTrilha(trilhaId);

    if (itens.length === 0) {
      throw new Error(
        'Esta trilha não possui treinamentos ativos.'
      );
    }

    // 1. Vínculo trilha x área (visibilidade + pessoas futuras)
    for (const areaId of areaIds) {
      try {
        await this.garantirTrilhaArea(
          trilhaId,
          areaId
        );
      } catch (e) {
        resumo.falhas.push(
          `Vínculo da trilha com a área: ${e instanceof Error ? e.message : 'erro desconhecido'}`
        );
      }
    }

    // 2. Membros atuais (sem repetir pessoa)
    const pessoas: string[] = [];
    const vistos: Record<string, boolean> = {};

    areaIds.forEach(areaId => {
      (membrosPorArea[guid(areaId)] || []).forEach(usuarioId => {
        const chave = guid(usuarioId);
        if (!vistos[chave]) {
          vistos[chave] = true;
          pessoas.push(usuarioId);
        }
      });
    });

    let atual = 0;

    for (const usuarioId of pessoas) {

      atual++;

      if (aoProgredir) {
        aoProgredir({
          atual,
          total: pessoas.length,
          descricao: `Atribuindo a trilha (${atual} de ${pessoas.length})...`
        });
      }

      try {
        await this.atribuirParaPessoa(
          usuarioId,
          trilhaId,
          {
            ...opcoes,
            origem: 'Grupo'
          },
          itens,
          resumo
        );
      } catch (e) {
        resumo.falhas.push(
          e instanceof Error ? e.message : 'erro desconhecido'
        );
      }
    }

    return resumo;
  }

  // ============================================================
  // dgt_usuariotrilha (matrícula)
  // ============================================================

  // Retorna true quando criou uma nova matrícula.
  private async garantirMatricula(
    usuarioId: string,
    trilhaId: string,
    opcoes: IOpcoesAtribuicaoTrilha
  ): Promise<boolean> {

    const existentes =
      await this.dataverse.listarRegistros(
        'dgt_usuariotrilha',
        '$select=dgt_usuariotrilhaid,dgt_ativa' +
        `&$filter=_dgt_usuario_value eq ${guid(usuarioId)}` +
        ` and _dgt_trilha_value eq ${guid(trilhaId)}` +
        ' and dgt_ativa eq true' +
        '&$top=1'
      );

    if (existentes.length > 0) {
      return false;
    }

    const [
      origem,
      status,
      refUsuario,
      refTrilha
    ] = await Promise.all([
      this.opcao(
        'dgt_usuariotrilha',
        'dgt_origem',
        [opcoes.origem, 'Individual', 'Grupo']
      ),
      this.opcao(
        'dgt_usuariotrilha',
        'dgt_status',
        ['Em andamento', 'Ativa', 'Atribuída', 'Pendente', 'Não iniciada', 'Disponível']
      ),
      this.dataverse.referenciaLookup('dgt_usuario', usuarioId),
      this.dataverse.referenciaLookup('dgt_trilha', trilhaId)
    ]);

    const dados: Record<string, unknown> = {
      dgt_name: 'Atribuição de trilha',
      dgt_ativa: true,
      dgt_obrigatoria: true,
      dgt_dataatribuicao: new Date().toISOString(),
      dgt_origem: origem,
      dgt_status: status,
      dgt_origemreferencia:
        (opcoes.referencia || '').substring(0, 100),
      'dgt_Usuario@odata.bind': refUsuario,
      'dgt_Trilha@odata.bind': refTrilha
    };

    if (opcoes.dataLimite) {
      dados.dgt_datalimite = opcoes.dataLimite;
    }

    await this.dataverse.criarRegistro(
      'dgt_usuariotrilha',
      dados
    );

    return true;
  }

  // ============================================================
  // dgt_trilhaarea (vínculo trilha x área)
  // ============================================================

  private async garantirTrilhaArea(
    trilhaId: string,
    areaId: string
  ): Promise<void> {

    const existentes =
      await this.dataverse.listarRegistros(
        'dgt_trilhaarea',
        '$select=dgt_trilhaareaid,dgt_ativo' +
        `&$filter=_dgt_trilha_value eq ${guid(trilhaId)}` +
        ` and _dgt_area_value eq ${guid(areaId)}`
      );

    const ativo =
      existentes.find(registro =>
        booleano(registro, 'dgt_ativo', true)
      );

    if (ativo) {
      return;
    }

    if (existentes.length > 0) {
      await this.dataverse.atualizarTrilhaAreaFluxo(
        texto(existentes[0], 'dgt_trilhaareaid'),
        { dgt_ativo: true }
      );
      return;
    }

    await this.dataverse.criarTrilhaAreaFluxo(
      trilhaId,
      areaId,
      {
        dgt_name: 'Área da trilha',
        dgt_ativo: true
      }
    );
  }

  // ============================================================
  // OPÇÕES (choices)
  // ============================================================

  // Usa o primeiro rótulo encontrado; se nenhum existir, usa a
  // primeira opção do campo.
  private async opcao(
    tabela: string,
    campo: string,
    preferidos: string[]
  ): Promise<number> {

    const chave = `${tabela}.${campo}`;

    if (!this.opcoesCache[chave]) {
      this.opcoesCache[chave] =
        await this.dataverse.getChoiceOptions(
          tabela,
          campo
        );
    }

    const opcoes = this.opcoesCache[chave];

    if (opcoes.length === 0) {
      throw new Error(
        `O campo ${chave} não possui opções cadastradas.`
      );
    }

    for (const rotulo of preferidos) {
      const encontrada =
        opcoes.find(item =>
          item.label.trim().toLocaleLowerCase() ===
          rotulo.trim().toLocaleLowerCase()
        );

      if (encontrada) {
        return encontrada.value;
      }
    }

    return opcoes[0].value;
  }
}
