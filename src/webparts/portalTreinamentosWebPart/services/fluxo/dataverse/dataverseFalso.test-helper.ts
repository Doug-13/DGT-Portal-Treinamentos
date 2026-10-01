/* eslint-disable @typescript-eslint/no-explicit-any */
// ============================================================
// DATAVERSE FALSO (somente para testes)
//
// Guarda registros em memória e entende o suficiente de OData para
// os repositórios do fluxo: $filter com "eq", "ne" e "and",
// $orderby (um campo) e $select (ignorado). Lookups gravados com
// "<SchemaName>@odata.bind" viram "_<schemaname>_value".
// ============================================================

import {
  DataverseService
} from '../../DataverseService';

type Registro = Record<string, any>;

const valorFiltro = (
  bruto: string
): any => {
  const texto = bruto.trim();
  if (texto === 'true') { return true; }
  if (texto === 'false') { return false; }
  if (/^'.*'$/.test(texto)) { return texto.slice(1, -1).replace(/''/g, "'"); }
  if (/^-?\d+(\.\d+)?$/.test(texto)) { return Number(texto); }
  return texto.toLowerCase();
};

export class DataverseFalso {

  public tabelas: Record<string, Registro[]> = {};

  public chamadas: string[] = [];

  private contador = 0;

  // Força o próximo PATCH com etag a falhar (simula outra pessoa).
  public conflitoNoProximo = false;

  private novoId(): string {
    this.contador++;
    const hex = ('000000000000' + this.contador.toString(16)).slice(-12);
    return `00000000-0000-4000-8000-${hex}`;
  }

  private tabela(nome: string): Registro[] {
    if (!this.tabelas[nome]) { this.tabelas[nome] = []; }
    return this.tabelas[nome];
  }

  private normalizar(nome: string, dados: Record<string, unknown>): Registro {
    const saida: Registro = {};
    Object.keys(dados).forEach(chave => {
      const valor = dados[chave];
      if (chave.indexOf('@odata.bind') > 0) {
        const campo = chave.replace('@odata.bind', '').toLowerCase();
        const id = String(valor).replace(/^.*\(/, '').replace(/\)$/, '');
        saida[`_${campo}_value`] = id;
      } else {
        saida[chave] = valor;
      }
    });
    return saida;
  }

  public async nomeConjunto(nome: string): Promise<string> { return `${nome}s`; }

  public async referenciaLookup(nome: string, id: string): Promise<string> {
    return `/${nome}s(${id})`;
  }

  public async listarRegistros(nome: string, consulta: string): Promise<Registro[]> {
    this.chamadas.push(`GET ${nome}?${consulta}`);
    const parametros: Record<string, string> = {};
    consulta.split('&').forEach(parte => {
      const i = parte.indexOf('=');
      if (i > 0) { parametros[parte.slice(0, i)] = parte.slice(i + 1); }
    });
    let lista = this.tabela(nome).slice();
    const filtro = parametros.$filter;
    if (filtro) {
      filtro.split(' and ').forEach(condicao => {
        const partes = condicao.trim().match(/^(\S+) (eq|ne) (.+)$/);
        if (!partes) { return; }
        const campo = partes[1];
        const valor = valorFiltro(partes[3]);
        lista = lista.filter(registro => {
          const atual = typeof registro[campo] === 'string' && typeof valor === 'string' && !/^'/.test(partes[3])
            ? String(registro[campo]).toLowerCase()
            : registro[campo];
          return partes[2] === 'eq' ? atual === valor : atual !== valor;
        });
      });
    }
    const ordem = parametros.$orderby;
    if (ordem) {
      const [campo, direcao] = ordem.split(' ');
      lista.sort((a, b) => (a[campo] > b[campo] ? 1 : a[campo] < b[campo] ? -1 : 0) * (direcao === 'desc' ? -1 : 1));
    }
    return lista.map(registro => ({ ...registro }));
  }

  public async obterRegistro(nome: string, id: string): Promise<{ registro: Registro; etag: string } | undefined> {
    const registro = this.tabela(nome).find(item => item[`${nome}id`] === id);
    return registro ? { registro: { ...registro }, etag: `W/"${registro.__versao || 1}"` } : undefined;
  }

  public async criarRegistro(nome: string, dados: Record<string, unknown>): Promise<string> {
    const id = this.novoId();
    this.chamadas.push(`POST ${nome}`);
    this.tabela(nome).push({ ...this.normalizar(nome, dados), [`${nome}id`]: id, createdon: new Date().toISOString(), __versao: 1 });
    return id;
  }

  public async atualizarRegistro(nome: string, id: string, dados: Record<string, unknown>, etag?: string): Promise<string> {
    this.chamadas.push(`PATCH ${nome}`);
    const registro = this.tabela(nome).find(item => item[`${nome}id`] === id);
    if (!registro) { throw new Error(`${nome}(${id}) não existe`); }
    if (etag && (this.conflitoNoProximo || etag !== `W/"${registro.__versao || 1}"`)) {
      this.conflitoNoProximo = false;
      const erro = new Error('conflito') as Error & { codigo?: string };
      erro.codigo = 'CONFLITO';
      throw erro;
    }
    Object.assign(registro, this.normalizar(nome, dados));
    registro.__versao = (registro.__versao || 1) + 1;
    return `W/"${registro.__versao}"`;
  }

  // Inclui um registro já existente (ex.: uma revisão).
  public incluir(nome: string, registro: Registro): void {
    this.tabela(nome).push({ __versao: 1, ...registro });
  }

  public comoServico(): DataverseService {
    return this as unknown as DataverseService;
  }
}
