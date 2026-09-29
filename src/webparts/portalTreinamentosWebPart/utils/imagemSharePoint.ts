// ============================================================
// URL DE IMAGEM DO SHAREPOINT
//
// Uma <img> só funciona com o endereço DIRETO do arquivo, como:
//   https://tenant.sharepoint.com/sites/Site/Biblioteca/pasta/imagem.png
//
// Links copiados do navegador (AllItems.aspx?id=...) e links de
// compartilhamento (/:i:/s/...) abrem uma PÁGINA do SharePoint,
// e não a imagem — por isso a imagem "quebra".
//
// Esta função converte automaticamente o link da biblioteca
// (AllItems.aspx?id=...) no endereço direto. Links de
// compartilhamento não podem ser convertidos sem consultar a API,
// então são sinalizados para o usuário copiar o link correto.
// ============================================================

export interface IResultadoUrlImagem {
  url: string;
  convertida: boolean;
  aviso?: string;
}

const AVISO_COMPARTILHAMENTO =
  'Este é um link de compartilhamento do SharePoint (ele abre uma página, não a imagem). ' +
  'Abra a biblioteca, selecione a imagem > "..." > Detalhes > "Caminho" (Copiar caminho direto) e cole aqui.';

export const converterUrlImagemSharePoint = (
  valor: string
): IResultadoUrlImagem => {

  const original =
    (valor || '').trim();

  if (!original) {
    return { url: '', convertida: false };
  }

  // Link de compartilhamento: /:i:/, /:b:/, /:u:/ etc.
  if (/sharepoint\.com\/:[a-z]:\//i.test(original)) {
    return {
      url: original,
      convertida: false,
      aviso: AVISO_COMPARTILHAMENTO
    };
  }

  // Link da visualização da biblioteca: .../Forms/AllItems.aspx?id=/sites/.../imagem.png
  if (/\/forms\/[^/?]+\.aspx/i.test(original)) {

    try {
      const endereco =
        new URL(original);

      const caminho =
        endereco.searchParams.get('id');

      if (caminho && /\.[a-z0-9]{2,5}$/i.test(caminho)) {

        const codificado =
          caminho
            .split('/')
            .map(parte => encodeURIComponent(parte))
            .join('/');

        return {
          url: `${endereco.origin}${codificado}`,
          convertida: true
        };
      }

    } catch {
      // URL inválida: segue para o retorno padrão.
    }

    return {
      url: original,
      convertida: false,
      aviso: 'Este link abre a biblioteca do SharePoint, não a imagem. Use o caminho direto do arquivo.'
    };
  }

  return {
    url: original,
    convertida: false
  };
};
