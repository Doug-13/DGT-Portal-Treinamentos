import {
  DataverseService,
  IDataverseRecord
} from '../DataverseService';

// ============================================================
// ADMINISTRAÇÃO DA IA (Indicadores › Administrar IA)
//
// Tabelas (scripts/dataverse/criar-ia-administracao.ps1):
//   dgt_iaconfiguracao  registro "Claude": final da chave, quem/quando
//                       trocou, preços, limites e área de cada
//                       funcionalidade. A CHAVE (dgt_chaveapi) é coluna
//                       protegida e NUNCA é lida aqui: salvar, testar e
//                       remover passam pela Custom API dgt_GerenciarIa.
//   dgt_iaconsumo       uma linha por chamada à IA (sem conteúdo).
//   dgt_usuarioarea     dgt_principal = área principal do usuário
//                       (reserva para atribuir o consumo).
// ============================================================

export const IA_API_GERENCIAR = 'dgt_GerenciarIa';

const TABELA_CONFIGURACAO = 'dgt_iaconfiguracao';
const TABELA_CONSUMO = 'dgt_iaconsumo';

// Funcionalidades que usam a IA e precisam de uma área de uso.
export const FUNCIONALIDADES_IA: Array<{ chave: string; rotulo: string; siglaPadrao: string }> = [
  { chave: 'licitacoes', rotulo: 'Licitações — análise de editais', siglaPadrao: 'LIC' }
];

export interface IPrecoModelo {
  // US$ por milhão de tokens.
  entrada: number;
  saida: number;
}

export interface IPrecosIa {
  cotacaoBrl: number;
  modelos: { [modelo: string]: IPrecoModelo };
}

export interface IConfiguracaoIa {
  id: string;
  chaveFinal: string;
  chaveAtualizadaEm: string;
  chaveAtualizadaPor: string;
  precos: IPrecosIa;
  // US$ por mês, por id de área (minúsculo, sem chaves).
  limites: { [areaId: string]: number };
  areasFuncionalidade: { [funcionalidade: string]: string };
}

export interface IResultadoChave {
  ok: boolean;
  mensagem: string;
  chaveFinal?: string;
}

export interface IConsumoArea {
  areaId: string;
  areaNome: string;
  chamadas: number;
  custoUsd: number;
  custoBrl: number;
  semPreco: number;
}

export interface IVinculoPrincipal {
  vinculoId: string;
  areaId: string;
  areaNome: string;
  principal: boolean;
}

export interface IUsuarioVariasAreas {
  usuarioId: string;
  usuarioNome: string;
  vinculos: IVinculoPrincipal[];
}

export const guidIa = (valor?: unknown): string =>
  String(valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const texto = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const formatado = (registro: IDataverseRecord, campo: string): string => {
  const valor = registro[`${campo}@OData.Community.Display.V1.FormattedValue`] || registro[campo];
  return valor === undefined || valor === null ? '' : String(valor);
};

const lerJson = <T>(valor: string, padrao: T): T => {
  if (!valor) {
    return padrao;
  }
  try {
    const lido = JSON.parse(valor) as T;
    return lido && typeof lido === 'object' ? lido : padrao;
  } catch {
    return padrao;
  }
};

const numero = (valor: unknown): number => {
  const n = Number(valor);
  return isFinite(n) ? n : 0;
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
    return 'A administração da IA ainda não foi criada no Dataverse (rode scripts/dataverse/criar-ia-administracao.ps1).';
  }
  if (/\b403\b|prv|privilege/i.test(bruto)) {
    return 'Sem permissão: é preciso Ler e Gravar em "Configuração de IA" (perfil de Administrador).';
  }
  return bruto.substring(0, 400);
};

export class IaAdminService {

  constructor(private readonly dataverse: DataverseService) { }

  // ------------------------------------------------------------
  // Configuração (sem a chave)
  // ------------------------------------------------------------

  public async carregarConfiguracao(): Promise<IConfiguracaoIa> {
    try {
      const registros = await this.dataverse.listarRegistros(
        TABELA_CONFIGURACAO,
        '$select=dgt_iaconfiguracaoid,dgt_chavefinal,dgt_chaveatualizadaem,dgt_chaveatualizadapor,dgt_precosjson,dgt_limitesjson,dgt_areasfuncionalidadejson' +
        "&$filter=dgt_name eq 'Claude'&$top=1"
      );
      const registro = registros[0];
      if (!registro) {
        throw new Error('O registro "Claude" de Configuração de IA não existe (rode scripts/dataverse/criar-ia-administracao.ps1).');
      }
      const precos = lerJson<Partial<IPrecosIa>>(texto(registro, 'dgt_precosjson'), {});
      return {
        id: texto(registro, 'dgt_iaconfiguracaoid'),
        chaveFinal: texto(registro, 'dgt_chavefinal'),
        chaveAtualizadaEm: texto(registro, 'dgt_chaveatualizadaem'),
        chaveAtualizadaPor: texto(registro, 'dgt_chaveatualizadapor'),
        precos: { cotacaoBrl: numero(precos.cotacaoBrl), modelos: precos.modelos || {} },
        limites: lerJson<{ [areaId: string]: number }>(texto(registro, 'dgt_limitesjson'), {}),
        areasFuncionalidade: lerJson<{ [funcionalidade: string]: string }>(texto(registro, 'dgt_areasfuncionalidadejson'), {})
      };
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }

  public async salvarPrecos(configId: string, precos: IPrecosIa): Promise<void> {
    const modelos: { [modelo: string]: IPrecoModelo } = {};
    Object.keys(precos.modelos).forEach(modelo => {
      const nome = modelo.trim();
      if (nome) {
        modelos[nome] = { entrada: Math.max(0, numero(precos.modelos[modelo].entrada)), saida: Math.max(0, numero(precos.modelos[modelo].saida)) };
      }
    });
    await this.atualizar(configId, {
      dgt_precosjson: JSON.stringify({ cotacaoBrl: Math.max(0, numero(precos.cotacaoBrl)), modelos })
    });
  }

  public async salvarLimites(configId: string, limites: { [areaId: string]: number }): Promise<void> {
    const limpos: { [areaId: string]: number } = {};
    Object.keys(limites).forEach(areaId => {
      const valor = numero(limites[areaId]);
      if (valor > 0) {
        limpos[guidIa(areaId)] = Math.round(valor * 100) / 100;
      }
    });
    await this.atualizar(configId, { dgt_limitesjson: JSON.stringify(limpos) });
  }

  public async salvarAreasFuncionalidade(configId: string, areas: { [funcionalidade: string]: string }): Promise<void> {
    const limpas: { [funcionalidade: string]: string } = {};
    Object.keys(areas).forEach(chave => {
      if (areas[chave]) {
        limpas[chave] = guidIa(areas[chave]);
      }
    });
    await this.atualizar(configId, { dgt_areasfuncionalidadejson: JSON.stringify(limpas) });
  }

  // ------------------------------------------------------------
  // Chave (só pela Custom API; o portal nunca lê a chave)
  // ------------------------------------------------------------

  public async gerenciarChave(acao: 'salvarChave' | 'testarChave' | 'removerChave', chave?: string): Promise<IResultadoChave> {
    try {
      const resultado = await this.dataverse.executarCustomApiJson(
        IA_API_GERENCIAR,
        acao === 'salvarChave' ? { acao, chave: (chave || '').trim() } : { acao }
      );
      if (Object.keys(resultado).length === 0) {
        throw new Error(
          'A Custom API dgt_GerenciarIa respondeu vazio: o passo do plugin GerenciarIaPlugin não está registrado, está desativado ou é assíncrono. ' +
          'Rode scripts/dataverse/diagnosticar-ia.ps1 para ver o que corrigir.'
        );
      }
      return {
        ok: resultado.ok === true,
        mensagem: String(resultado.mensagem || ''),
        chaveFinal: resultado.chaveFinal ? String(resultado.chaveFinal) : undefined
      };
    } catch (erro) {
      const mensagem = mensagemDeErro(erro);
      if (/respondeu vazio/.test(mensagem)) {
        throw new Error(mensagem);
      }
      throw new Error(/não foi encontrad|not found|404/i.test(mensagem)
        ? `A Custom API ${IA_API_GERENCIAR} ainda não existe ou o passo do plugin não foi registrado.`
        : mensagem);
    }
  }

  // ------------------------------------------------------------
  // Consumo do mês por área
  // ------------------------------------------------------------

  public async consumoDoMes(): Promise<{ porArea: IConsumoArea[]; modelosSemPreco: string[] }> {
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
    try {
      const registros = await this.dataverse.listarRegistros(
        TABELA_CONSUMO,
        '$select=dgt_areaid,dgt_areanome,dgt_custousd,dgt_custobrl,dgt_modeloia,dgt_precoconfigurado' +
        `&$filter=createdon ge ${inicio}`
      );
      const mapa: { [chave: string]: IConsumoArea } = {};
      const semPreco: string[] = [];
      registros.forEach(registro => {
        const areaId = guidIa(texto(registro, 'dgt_areaid'));
        const chave = areaId || 'sem-area';
        if (!mapa[chave]) {
          mapa[chave] = { areaId, areaNome: texto(registro, 'dgt_areanome') || 'Sem área', chamadas: 0, custoUsd: 0, custoBrl: 0, semPreco: 0 };
        }
        mapa[chave].chamadas += 1;
        mapa[chave].custoUsd += numero(registro.dgt_custousd);
        mapa[chave].custoBrl += numero(registro.dgt_custobrl);
        if (registro.dgt_precoconfigurado === false) {
          mapa[chave].semPreco += 1;
          const modelo = texto(registro, 'dgt_modeloia');
          if (modelo && semPreco.indexOf(modelo) < 0) {
            semPreco.push(modelo);
          }
        }
      });
      return {
        porArea: Object.keys(mapa).map(chave => mapa[chave]).sort((a, b) => b.custoUsd - a.custoUsd),
        modelosSemPreco: semPreco
      };
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }

  // ------------------------------------------------------------
  // Área principal (reserva do consumo)
  // ------------------------------------------------------------

  public async usuariosComVariasAreas(): Promise<IUsuarioVariasAreas[]> {
    try {
      const registros = await this.dataverse.listarRegistros(
        'dgt_usuarioarea',
        '$select=dgt_usuarioareaid,_dgt_usuario_value,_dgt_area_value,dgt_principal&$filter=dgt_ativo eq true'
      );
      const porUsuario: { [usuarioId: string]: IUsuarioVariasAreas } = {};
      registros.forEach(registro => {
        const usuarioId = guidIa(registro._dgt_usuario_value);
        const areaId = guidIa(registro._dgt_area_value);
        if (!usuarioId || !areaId) {
          return;
        }
        if (!porUsuario[usuarioId]) {
          porUsuario[usuarioId] = { usuarioId, usuarioNome: formatado(registro, '_dgt_usuario_value') || 'Usuário', vinculos: [] };
        }
        porUsuario[usuarioId].vinculos.push({
          vinculoId: guidIa(registro.dgt_usuarioareaid),
          areaId,
          areaNome: formatado(registro, '_dgt_area_value') || 'Área',
          principal: registro.dgt_principal === true
        });
      });
      return Object.keys(porUsuario)
        .map(id => porUsuario[id])
        .filter(usuario => usuario.vinculos.length > 1)
        .sort((a, b) => a.usuarioNome.localeCompare(b.usuarioNome, 'pt-BR'));
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }

  // Marca um vínculo como principal e desmarca os outros do usuário.
  public async definirAreaPrincipal(usuario: IUsuarioVariasAreas, vinculoId: string): Promise<void> {
    for (const vinculo of usuario.vinculos) {
      const principal = vinculo.vinculoId === vinculoId;
      if (vinculo.principal !== principal) {
        await this.dataverse.atualizarRegistro('dgt_usuarioarea', vinculo.vinculoId, { dgt_principal: principal });
      }
    }
  }

  private async atualizar(configId: string, dados: Record<string, unknown>): Promise<void> {
    try {
      await this.dataverse.atualizarRegistro(TABELA_CONFIGURACAO, configId, dados);
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
  }
}
