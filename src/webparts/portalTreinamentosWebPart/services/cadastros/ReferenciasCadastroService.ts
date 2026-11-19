import {
  DataverseService
} from '../DataverseService';

// ============================================================
// REFERÊNCIAS A CADASTROS (alinhamento das tabelas — fase 3)
//
// Alguns módulos guardavam em TEXTO um dado que já tem cadastro
// próprio (fabricante, área). Eles passam a gravar também o LOOKUP
// para o cadastro, sem deixar de gravar o texto:
//
//   dgt_declaracaofabricante.dgt_fabricante   → dgt_FabricanteCadastro
//   dgt_certificacaofabricante.dgt_emissor    → dgt_FabricanteCadastro
//   dgt_certificacaofabricante.dgt_area       → dgt_AreaCadastro
//   dgt_terceiro.dgt_area                     → dgt_AreaCadastro
//   dgt_bom_ro.dgt_bom_fabricante             → dgt_bom_FabricanteCadastro
//
// Regras para não afetar o que já funciona:
//   1. O texto continua sendo gravado e lido como antes (telas,
//      exportações, Power BI e prazos de validade dos ROs usam o texto).
//   2. O lookup é gravado DEPOIS do registro principal, numa chamada
//      separada. Se falhar (coluna ainda não criada, falta de
//      privilégio Acrescentar), o registro principal já está salvo e
//      o erro só vai para o console.
//   3. A correspondência é pelo nome (ou sigla, na área), sem
//      maiúsculas, acentos e espaços repetidos. Sem correspondência,
//      o lookup fica vazio e o texto vale sozinho.
//   4. Se o usuário não pode ler o cadastro, nada muda para ele.
//
// Plano: docs/alinhamento-tabelas.md · Colunas:
// scripts/dataverse/criar-colunas-alinhamento.ps1
// ============================================================

export interface IItemCadastro {
  id: string;
  nome: string;
  sigla?: string;
}

export const COLUNAS_ALINHAMENTO = {
  // nome lógico da coluna (leitura) e nome de navegação (gravação)
  fabricanteCadastro: { coluna: 'dgt_fabricantecadastro', navegacao: 'dgt_FabricanteCadastro' },
  areaCadastro: { coluna: 'dgt_areacadastro', navegacao: 'dgt_AreaCadastro' },
  roFabricanteCadastro: { coluna: 'dgt_bom_fabricantecadastro', navegacao: 'dgt_bom_FabricanteCadastro' },
  fornecedor: { coluna: 'dgt_fornecedor', navegacao: 'dgt_Fornecedor' },
  fornecedorColaborador: { coluna: 'dgt_fornecedorcolaborador', navegacao: 'dgt_FornecedorColaborador' }
};

export interface IColunaLookup {
  coluna: string;
  navegacao: string;
}

const guid = (valor: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

export const normalizarChave = (valor: string): string =>
  (valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();

// Procura pelo nome e, se houver, pela sigla.
export const resolverPorNome = (
  lista: IItemCadastro[] | undefined,
  valor: string
): IItemCadastro | undefined => {

  const chave = normalizarChave(valor);

  if (!lista || !chave) {
    return undefined;
  }

  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    if (normalizarChave(item.nome) === chave || (item.sigla && normalizarChave(item.sigla) === chave)) {
      return item;
    }
  }

  return undefined;
};

export class ReferenciasCadastroService {

  private readonly dataverse: DataverseService;
  private readonly colunas: Record<string, Promise<boolean>> = {};
  private fabricantesCache?: Promise<IItemCadastro[] | undefined>;
  private areasCache?: Promise<IItemCadastro[] | undefined>;

  public constructor(dataverse: DataverseService) {
    this.dataverse = dataverse;
  }

  // A coluna de lookup existe e o usuário consegue lê-la? (uma consulta
  // por tabela/coluna, guardada enquanto a página estiver aberta)
  public colunaDisponivel(tabela: string, coluna: string): Promise<boolean> {

    const chave = `${tabela}.${coluna}`;

    if (!this.colunas[chave]) {
      // Todas as colunas desta fase são lookups: na Web API, _<coluna>_value.
      this.colunas[chave] =
        this.dataverse.listarRegistros(tabela, `$select=_${coluna}_value&$top=1`)
          .then(() => true)
          .catch(() => false);
    }

    return this.colunas[chave];
  }

  // Fabricantes ativos; undefined = sem acesso ao cadastro.
  public fabricantes(): Promise<IItemCadastro[] | undefined> {

    if (!this.fabricantesCache) {
      this.fabricantesCache =
        this.dataverse.listarRegistros('dgt_fabricante', '$select=dgt_fabricanteid,dgt_name&$filter=dgt_ativo eq true')
          .then(regs => regs
            .map(r => ({ id: guid(r.dgt_fabricanteid), nome: String(r.dgt_name || '').trim() }))
            .filter(f => !!f.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
          .catch(() => undefined);
    }

    return this.fabricantesCache;
  }

  // Áreas ativas (nome e sigla); undefined = sem acesso ao cadastro.
  public areas(): Promise<IItemCadastro[] | undefined> {

    if (!this.areasCache) {
      this.areasCache =
        this.dataverse.listarRegistros('dgt_area', '$select=dgt_areaid,dgt_name,dgt_sigla&$filter=dgt_ativo eq true')
          .then(regs => regs
            .map(r => ({
              id: guid(r.dgt_areaid),
              nome: String(r.dgt_name || '').trim(),
              sigla: String(r.dgt_sigla || '').trim()
            }))
            .filter(a => !!a.nome)
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
          .catch(() => undefined);
    }

    return this.areasCache;
  }

  // Esquece os cadastros lidos (ex.: depois de cadastrar um fabricante).
  public limparCache(): void {
    this.fabricantesCache = undefined;
    this.areasCache = undefined;
  }

  // Grava (ou limpa) um lookup DEPOIS do registro principal.
  // Nunca lança erro: o registro principal já foi salvo.
  //   alvoId    → vincula ao registro do cadastro
  //   undefined → limpa o vínculo (só em registro já existente)
  public async aplicarLookup(
    tabela: string,
    id: string,
    lookup: IColunaLookup,
    tabelaAlvo: string,
    alvoId: string | undefined,
    registroNovo: boolean
  ): Promise<void> {

    if (!id) {
      return;
    }

    try {
      if (!(await this.colunaDisponivel(tabela, lookup.coluna))) {
        return;
      }

      if (alvoId) {
        const referencia = await this.dataverse.referenciaLookup(tabelaAlvo, alvoId);
        await this.dataverse.atualizarRegistro(tabela, id, { [`${lookup.navegacao}@odata.bind`]: referencia });
      } else if (!registroNovo) {
        await this.dataverse.limparLookup(tabela, id, lookup.navegacao);
      }
    } catch (erro) {
      console.warn(`[Portal DGT] Não foi possível gravar o vínculo ${tabela}.${lookup.coluna}:`, erro);
    }
  }

  // Atalhos: resolve pelo texto e grava o lookup.
  public async vincularFabricante(
    tabela: string,
    id: string,
    lookup: IColunaLookup,
    nomeFabricante: string,
    registroNovo: boolean
  ): Promise<void> {
    if (!(await this.colunaDisponivel(tabela, lookup.coluna))) {
      return;
    }
    const lista = await this.fabricantes();
    if (!lista) {
      return; // sem acesso ao cadastro: não mexe no vínculo
    }
    const item = resolverPorNome(lista, nomeFabricante);
    await this.aplicarLookup(tabela, id, lookup, 'dgt_fabricante', item ? item.id : undefined, registroNovo);
  }

  public async vincularArea(
    tabela: string,
    id: string,
    lookup: IColunaLookup,
    nomeArea: string,
    registroNovo: boolean
  ): Promise<void> {
    if (!(await this.colunaDisponivel(tabela, lookup.coluna))) {
      return;
    }
    const lista = await this.areas();
    if (!lista) {
      return;
    }
    const item = resolverPorNome(lista, nomeArea);
    await this.aplicarLookup(tabela, id, lookup, 'dgt_area', item ? item.id : undefined, registroNovo);
  }
}
