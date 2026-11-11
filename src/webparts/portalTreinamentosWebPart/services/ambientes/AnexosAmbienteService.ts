import {
  IFluxoElemento
} from '../../models/Fluxo';

import {
  SituacaoRegistroAmbiente
} from '../../models/Ambiente';

// ============================================================
// ANEXOS DOS REGISTROS DE AMBIENTE (SharePoint)
//
// Ambiente com "Permitir anexar arquivos": cada registro tem uma pasta
//   <biblioteca>/Anexos de Ambientes/<chave do ambiente>/<código>
// O que cada etapa permite vem da configuração "Anexo de arquivo" da
// etapa no fluxo:
//   Não         → anexos só para consulta
//   Opcional    → incluir, substituir e remover
//   Obrigatório → idem, e a etapa só conclui com ao menos um anexo
// Substituir guarda a versão anterior (histórico de versões do
// SharePoint); remover manda para a lixeira (recuperável).
// Usa a sessão do SharePoint de quem está no portal: é preciso
// permissão de edição na biblioteca para incluir/alterar.
// ============================================================

export const PASTA_RAIZ_ANEXOS = 'Anexos de Ambientes';

export interface IAnexoRegistro {
  nome: string;
  caminho: string;
  url: string;
  tamanho: number;
  modificadoEm: string;
  modificadoPor: string;
}

export const segmentoSeguro = (texto: string): string =>
  (texto || '')
    .replace(/["*:<>?/\\|#%~&{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .substring(0, 120);

const escaparOData = (valor: string): string => valor.replace(/'/g, "''");

// Biblioteca padrão: "Documentos" (Shared Documents) do site do portal.
export const bibliotecaPadrao = (siteUrl: string): string => {
  const caminho = (/^https?:\/\/[^/]+(\/.*)?$/i.exec((siteUrl || '').trim()) || [])[1] || '';
  return `${caminho.replace(/\/+$/, '')}/Shared Documents`;
};

export const pastaDoRegistro = (
  biblioteca: string,
  chaveAmbiente: string,
  codigoRegistro: string
): string =>
  `${(biblioteca || '').replace(/\/+$/, '')}/${PASTA_RAIZ_ANEXOS}/${segmentoSeguro(chaveAmbiente)}/${segmentoSeguro(codigoRegistro)}`;

export interface IRegraAnexos {
  // Mostrar o quadro de anexos.
  visivel: boolean;
  // Incluir/substituir/remover nesta etapa.
  podeEditar: boolean;
  // A etapa exige ao menos um anexo para concluir.
  obrigatorio: boolean;
}

export const regraAnexosEtapa = (
  permiteAnexos: boolean,
  elementoAtual: IFluxoElemento | undefined,
  situacao: SituacaoRegistroAmbiente,
  podeAgir: boolean
): IRegraAnexos => {
  if (!permiteAnexos) {
    return { visivel: false, podeEditar: false, obrigatorio: false };
  }
  const configEtapa =
    elementoAtual && elementoAtual.tipo === 'tarefaHumana' ? (elementoAtual.anexoArquivo || 'nao') : 'nao';
  const etapaPermite = configEtapa === 'opcional' || configEtapa === 'obrigatorio';
  return {
    visivel: true,
    podeEditar: situacao === 'emAndamento' && podeAgir && etapaPermite,
    obrigatorio: situacao === 'emAndamento' && configEtapa === 'obrigatorio'
  };
};

export class AnexosAmbienteService {

  private readonly siteUrl: string;

  private digest?: { valor: string; expira: number };

  public constructor(siteUrl: string) {
    this.siteUrl = (siteUrl || '').replace(/\/+$/, '');
  }

  private url(caminhoApi: string): string {
    return `${this.siteUrl}/_api/web/${caminhoApi}`;
  }

  public async listar(pasta: string): Promise<IAnexoRegistro[]> {
    const resposta = await fetch(
      this.url(`GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(pasta))}')/Files`) +
      '?$select=Name,ServerRelativeUrl,Length,TimeLastModified&$expand=ModifiedBy&$orderby=TimeLastModified desc',
      { credentials: 'same-origin', headers: { Accept: 'application/json;odata=nometadata' } }
    );
    // Pasta ainda não criada = sem anexos.
    if (resposta.status === 404) {
      return [];
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem acesso à biblioteca de anexos no SharePoint.');
    }
    if (!resposta.ok) {
      throw new Error(`Não foi possível ler os anexos (${resposta.status}).`);
    }
    const dados = (await resposta.json()) as {
      value: Array<{ Name: string; ServerRelativeUrl: string; Length: string | number; TimeLastModified: string; ModifiedBy?: { Title?: string } }>;
    };
    const origem = (/^https?:\/\/[^/]+/i.exec(this.siteUrl) || [''])[0];
    return (dados.value || []).map(item => ({
      nome: item.Name,
      caminho: item.ServerRelativeUrl,
      url: `${origem}${encodeURI(item.ServerRelativeUrl)}?web=1`,
      tamanho: Number(item.Length) || 0,
      modificadoEm: item.TimeLastModified,
      modificadoPor: (item.ModifiedBy && item.ModifiedBy.Title) || ''
    }));
  }

  // Envia um arquivo. Com o mesmo nome: só substitui se "substituir"
  // (o SharePoint guarda a versão anterior).
  public async enviar(
    pasta: string,
    arquivo: File,
    substituir: boolean
  ): Promise<void> {
    await this.garantirPasta(pasta);
    const nome = segmentoSeguro(arquivo.name) || 'arquivo';
    const resposta = await fetch(
      this.url(`GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(pasta))}')`) +
      `/Files/AddUsingPath(decodedurl='${encodeURIComponent(escaparOData(nome))}',overwrite=${substituir ? 'true' : 'false'})`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': await this.obterDigest() },
        body: await arquivo.arrayBuffer()
      }
    );
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem permissão de edição na biblioteca de anexos do SharePoint.');
    }
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      if (!substituir && /exist/i.test(detalhe)) {
        throw new Error(`Já existe um anexo chamado "${nome}". Use "Substituir" nele ou renomeie o arquivo.`);
      }
      throw new Error(`Não foi possível enviar "${nome}" (${resposta.status}). ${detalhe.substring(0, 160)}`);
    }
  }

  // Manda para a lixeira do SharePoint (recuperável).
  public async remover(caminhoArquivo: string): Promise<void> {
    const resposta = await fetch(
      this.url(`GetFileByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(caminhoArquivo))}')/recycle()`),
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': await this.obterDigest() }
      }
    );
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error('Sem permissão para remover anexos nesta biblioteca.');
    }
    if (!resposta.ok) {
      throw new Error(`Não foi possível remover o anexo (${resposta.status}).`);
    }
  }

  private async garantirPasta(pasta: string): Promise<void> {
    // Cria cada nível que faltar (a biblioteca já existe).
    const partes = pasta.split('/');
    const inicioRaiz = partes.indexOf(PASTA_RAIZ_ANEXOS);
    let caminho = partes.slice(0, inicioRaiz).join('/');
    for (let i = inicioRaiz; i < partes.length; i++) {
      caminho = `${caminho}/${partes[i]}`;
      const existe = await fetch(
        this.url(`GetFolderByServerRelativePath(decodedurl='${encodeURIComponent(escaparOData(caminho))}')?$select=Exists`),
        { credentials: 'same-origin', headers: { Accept: 'application/json;odata=nometadata' } }
      );
      const dados = existe.ok ? ((await existe.json()) as { Exists?: boolean }) : { Exists: false };
      if (existe.ok && dados.Exists !== false) {
        continue;
      }
      const criada = await fetch(
        this.url(`folders/AddUsingPath(decodedurl='${encodeURIComponent(escaparOData(caminho))}')`),
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json;odata=nometadata', 'X-RequestDigest': await this.obterDigest() }
        }
      );
      if (criada.status === 401 || criada.status === 403) {
        throw new Error('Sem permissão de edição na biblioteca de anexos do SharePoint.');
      }
      if (!criada.ok) {
        throw new Error(`Não foi possível criar a pasta de anexos (${criada.status}). Confira a biblioteca configurada no ambiente.`);
      }
    }
  }

  private async obterDigest(): Promise<string> {
    if (this.digest && this.digest.expira > Date.now()) {
      return this.digest.valor;
    }
    const resposta = await fetch(`${this.siteUrl}/_api/contextinfo`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=nometadata' }
    });
    if (!resposta.ok) {
      throw new Error(`Sem acesso ao site do SharePoint (${resposta.status}).`);
    }
    const dados = (await resposta.json()) as { FormDigestValue: string; FormDigestTimeoutSeconds: number };
    this.digest = {
      valor: dados.FormDigestValue,
      expira: Date.now() + Math.max(60, (dados.FormDigestTimeoutSeconds || 1800) - 60) * 1000
    };
    return this.digest.valor;
  }
}
