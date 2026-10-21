import {
  DataverseService
} from './DataverseService';

import {
  ModuloConteudoAdminService
} from './ModuloConteudoAdminService';

import {
  IMidiaTreinamento,
  ITreinamentoMidia,
  MidiaTreinamentoService
} from './MidiaTreinamentoService';

// ============================================================
// GESTÃO DAS IMAGENS DE UM TREINAMENTO
//
// Inventário: cruza as mídias registradas (dgt_midia) com o que os
// conteúdos realmente usam:
//   • conteúdo Imagem      → campo URL
//   • <img src> nos textos → campo conteúdo (HTML)
//   • capa do treinamento  → dgt_imagemurl
//
// Ações:
//   • desativar  — só se a imagem não estiver em uso; o arquivo NÃO é
//                  apagado do SharePoint (revisões antigas continuam
//                  mostrando a imagem que tinham);
//   • substituir — envia o novo arquivo (nome único) e troca o
//                  endereço em todos os lugares que usam a imagem;
//                  a mídia antiga é desativada;
//   • trazer para o portal — copia uma imagem "avulsa" (URL colada à
//                  mão antes das mídias) para a biblioteca de mídias e
//                  troca o endereço nos conteúdos.
//
// Nada disso altera revisões já publicadas: elas guardam o conteúdo da
// época, e os arquivos nunca são apagados nem sobrescritos.
// ============================================================

export type CampoUsoImagem =
  | 'url'
  | 'html'
  | 'capa';

export interface IUsoImagem {
  campo: CampoUsoImagem;
  conteudoId?: string;
  moduloTitulo: string;
  conteudoTitulo: string;
  conteudoAtivo: boolean;
}

export interface IImagemInventario {
  // URL normalizada (para comparar).
  chave: string;
  // URL como está gravada.
  url: string;
  // Presente quando a imagem é uma mídia do portal.
  midia?: IMidiaTreinamento;
  usos: IUsoImagem[];
}

export interface IInventarioMidias {
  gerenciadas: IImagemInventario[];
  // URLs usadas nos conteúdos que não são mídias do portal.
  avulsas: IImagemInventario[];
}

export interface ITreinamentoGestaoMidia extends ITreinamentoMidia {
  imagemUrl?: string;
}

export interface IModuloGestaoMidia {
  id: string;
  titulo: string;
}

const TABELA_CONTEUDO = 'dgt_moduloconteudo';

const REGEX_IMG =
  /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi;

// Normaliza para comparar: decodifica, sem query/hash, minúsculas.
export const normalizarUrlImagem = (
  valor: string
): string => {

  let url =
    (valor || '').trim();

  try {
    url = decodeURI(url);
  } catch {
    // mantém
  }

  return url
    .replace(/[?#].*$/, '')
    .toLowerCase();
};

const ehUrlDeImagem = (
  valor: string
): boolean =>
  /^https?:\/\//i.test((valor || '').trim());

// Troca, num HTML, todo <img src> que aponta para "antiga" por "nova".
export const trocarSrcNoHtml = (
  html: string,
  antiga: string,
  nova: string
): string => {

  const chave =
    normalizarUrlImagem(antiga);

  return (html || '').replace(
    REGEX_IMG,
    (trecho: string, inicio: string, src: string, fim: string) =>
      normalizarUrlImagem(src) === chave
        ? `${inicio}${nova}${fim}`
        : trecho
  );
};

const nomeDaUrl = (
  url: string
): string => {
  const limpa = url.replace(/[?#].*$/, '');
  const partes = limpa.split('/');
  let nome = partes[partes.length - 1] || 'imagem.png';
  try {
    nome = decodeURIComponent(nome);
  } catch {
    // mantém
  }
  return /\.[a-z0-9]{2,5}$/i.test(nome) ? nome : `${nome}.png`;
};

export class MidiaGestaoService {

  private readonly dataverse: DataverseService;

  private readonly midias: MidiaTreinamentoService;

  private readonly conteudos: ModuloConteudoAdminService;

  public constructor(
    dataverse: DataverseService,
    midias: MidiaTreinamentoService
  ) {
    this.dataverse = dataverse;
    this.midias = midias;
    this.conteudos = new ModuloConteudoAdminService(dataverse);
  }

  // ----------------------------------------------------------
  // INVENTÁRIO
  // ----------------------------------------------------------

  public async inventariar(
    treinamento: ITreinamentoGestaoMidia,
    modulos: IModuloGestaoMidia[]
  ): Promise<IInventarioMidias> {

    const [midiasAtivas, conteudosPorModulo] =
      await Promise.all([
        this.midias.listar(treinamento.id),
        Promise.all(
          modulos.map(
            async modulo => ({
              modulo,
              itens: await this.conteudos.listar(modulo.id)
            })
          )
        )
      ]);

    const mapa: Record<string, IImagemInventario> = {};

    const garantir = (url: string): IImagemInventario => {
      const chave = normalizarUrlImagem(url);
      if (!mapa[chave]) {
        mapa[chave] = { chave, url: url.trim(), usos: [] };
      }
      return mapa[chave];
    };

    midiasAtivas.forEach(
      midia => {
        if (midia.url) {
          garantir(midia.url).midia = midia;
        }
      }
    );

    conteudosPorModulo.forEach(
      ({ modulo, itens }) => {
        itens.forEach(
          conteudo => {

            if (conteudo.tipo === 'Imagem' && ehUrlDeImagem(conteudo.url)) {
              garantir(conteudo.url).usos.push({
                campo: 'url',
                conteudoId: conteudo.id,
                moduloTitulo: modulo.titulo,
                conteudoTitulo: conteudo.titulo || 'Imagem',
                conteudoAtivo: conteudo.ativo
              });
            }

            const html =
              conteudo.conteudo || '';

            if (html.indexOf('<img') >= 0) {

              const vistos: Record<string, boolean> = {};

              let encontrado: RegExpExecArray | undefined;

              REGEX_IMG.lastIndex = 0;

              while ((encontrado = REGEX_IMG.exec(html) || undefined) !== undefined) {

                const src = encontrado[2];

                if (!ehUrlDeImagem(src) || vistos[normalizarUrlImagem(src)]) {
                  continue;
                }

                vistos[normalizarUrlImagem(src)] = true;

                garantir(src).usos.push({
                  campo: 'html',
                  conteudoId: conteudo.id,
                  moduloTitulo: modulo.titulo,
                  conteudoTitulo: `${conteudo.titulo || conteudo.tipo} (no texto)`,
                  conteudoAtivo: conteudo.ativo
                });
              }
            }
          }
        );
      }
    );

    // Capa: lida do Dataverse (a lista da tela pode estar desatualizada
    // depois de uma substituição).
    let capa =
      treinamento.imagemUrl || '';

    try {
      const lido =
        await this.dataverse.obterRegistro('dgt_treinamento', treinamento.id, ['dgt_imagemurl']);
      if (lido) {
        capa = String(lido.registro.dgt_imagemurl || '');
      }
    } catch (error) {
      console.error('Capa do treinamento não pôde ser relida:', error);
    }

    if (capa && ehUrlDeImagem(capa)) {
      garantir(capa).usos.push({
        campo: 'capa',
        moduloTitulo: '',
        conteudoTitulo: 'Capa do treinamento',
        conteudoAtivo: true
      });
    }

    const todas =
      Object.keys(mapa).map(chave => mapa[chave]);

    return {
      gerenciadas:
        todas
          .filter(item => !!item.midia)
          .sort((a, b) => (b.midia ? b.midia.criadoEm : '').localeCompare(a.midia ? a.midia.criadoEm : '')),
      avulsas:
        todas
          .filter(item => !item.midia)
          .sort((a, b) => a.url.localeCompare(b.url))
    };
  }

  // ----------------------------------------------------------
  // AÇÕES
  // ----------------------------------------------------------

  // Desativa a mídia (some da galeria). Bloqueado se estiver em uso.
  public async desativar(
    item: IImagemInventario
  ): Promise<void> {

    if (!item.midia) {
      throw new Error('Esta imagem não é uma mídia do portal.');
    }

    if (item.usos.length > 0) {
      throw new Error(
        `A imagem está em uso em ${item.usos.length} lugar(es). Substitua ou retire a imagem desses conteúdos antes de desativá-la.`
      );
    }

    await this.dataverse.atualizarRegistro(
      'dgt_midia',
      item.midia.id,
      { dgt_ativo: false }
    );
  }

  // Troca o endereço em todos os usos. Devolve quantos foram trocados.
  private async trocarEmTodosOsUsos(
    item: IImagemInventario,
    novaUrl: string,
    treinamento: ITreinamentoGestaoMidia
  ): Promise<number> {

    let trocados = 0;

    // Um conteúdo pode usar a mesma imagem no URL e no texto: lê o
    // HTML atual uma vez por conteúdo.
    const htmlPorConteudo: Record<string, string> = {};

    for (const uso of item.usos) {

      if (uso.campo === 'capa') {
        await this.dataverse.atualizarRegistro(
          'dgt_treinamento',
          treinamento.id,
          { dgt_imagemurl: novaUrl }
        );
        trocados++;
        continue;
      }

      if (!uso.conteudoId) {
        continue;
      }

      if (uso.campo === 'url') {
        await this.dataverse.atualizarRegistro(
          TABELA_CONTEUDO,
          uso.conteudoId,
          { dgt_url: novaUrl }
        );
        trocados++;
        continue;
      }

      // HTML: relê o registro para não sobrescrever edição recente.
      if (htmlPorConteudo[uso.conteudoId] === undefined) {
        const lido =
          await this.dataverse.obterRegistro(TABELA_CONTEUDO, uso.conteudoId, ['dgt_conteudo']);
        htmlPorConteudo[uso.conteudoId] =
          lido ? String(lido.registro.dgt_conteudo || '') : '';
      }

      const novoHtml =
        trocarSrcNoHtml(htmlPorConteudo[uso.conteudoId], item.url, novaUrl);

      if (novoHtml !== htmlPorConteudo[uso.conteudoId]) {
        await this.dataverse.atualizarRegistro(
          TABELA_CONTEUDO,
          uso.conteudoId,
          { dgt_conteudo: novoHtml }
        );
        htmlPorConteudo[uso.conteudoId] = novoHtml;
        trocados++;
      }
    }

    return trocados;
  }

  // Envia o novo arquivo e troca a imagem em todos os lugares.
  public async substituir(
    item: IImagemInventario,
    arquivo: File,
    treinamento: ITreinamentoGestaoMidia,
    enviadoPor: string
  ): Promise<{ nova: IMidiaTreinamento; trocados: number }> {

    const nova =
      await this.midias.enviar(arquivo, treinamento, enviadoPor);

    const trocados =
      await this.trocarEmTodosOsUsos(item, nova.url, treinamento);

    if (item.midia) {
      try {
        await this.dataverse.atualizarRegistro('dgt_midia', item.midia.id, { dgt_ativo: false });
      } catch (error) {
        // A troca já foi feita; a antiga só continua visível na galeria.
        console.error('Imagem substituída, mas a mídia antiga não foi desativada:', error);
      }
    }

    return { nova, trocados };
  }

  // Copia uma imagem avulsa (URL antiga) para as mídias do portal.
  // Funciona para arquivos do mesmo SharePoint do portal; de outros
  // sites o navegador costuma bloquear — nesse caso, use Substituir.
  public async trazerParaOPortal(
    item: IImagemInventario,
    treinamento: ITreinamentoGestaoMidia,
    enviadoPor: string
  ): Promise<{ nova: IMidiaTreinamento; trocados: number }> {

    let resposta: Response;

    try {
      resposta =
        await fetch(item.url, { credentials: 'include' });
    } catch {
      throw new Error(
        'O navegador não conseguiu baixar esta imagem (ela está em outro site ou bloqueada). ' +
        'Baixe o arquivo e use "Substituir".'
      );
    }

    if (resposta.status === 404) {
      throw new Error('A imagem não existe mais neste endereço (foi excluída ou movida). Use "Substituir" com o arquivo correto.');
    }

    if (!resposta.ok) {
      throw new Error(`Não foi possível baixar a imagem (${resposta.status}). Use "Substituir" com o arquivo.`);
    }

    const tipo =
      resposta.headers.get('content-type') || '';

    if (tipo && tipo.indexOf('image/') !== 0) {
      throw new Error(
        'Este endereço não devolve uma imagem (provavelmente é um link de página do SharePoint). Use "Substituir" com o arquivo.'
      );
    }

    const conteudo =
      await resposta.blob();

    const arquivo =
      new File([conteudo], nomeDaUrl(item.url), { type: tipo || conteudo.type });

    return this.substituir(item, arquivo, treinamento, enviadoPor);
  }
}
