using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // FORNECEDORES — documentos recebidos por e-mail (regras PURAS,
    // testadas em server/DGT.Treinamentos.Plugins.Tests).
    //
    // O Fluxo 2 do Power Automate salva os anexos na pasta do fornecedor
    // e chama "receberDocumentos": cada arquivo vira um documento
    // "A conferir" (sem tipo e sem datas), que a analista confere no
    // portal. Próxima etapa (C): a IA lê o arquivo e sugere tipo e datas.
    // ================================================================
    public static class DocumentosRecebidosFornecedor
    {
        public const string SituacaoAConferir = "A conferir";

        // Protocolo da ficha: FORN-AAAA-NNNN (o sequencial pode passar de 4 dígitos).
        private static readonly Regex Protocolo =
            new Regex(@"FORN-\d{4}-\d{4,}", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        // Mesma limpeza do portal (SharePointDocumentoService.limparSegmento).
        private static readonly Regex Proibidos = new Regex(@"[~""#%&*:<>?\\{|}]", RegexOptions.Compiled);
        private static readonly Regex Espacos = new Regex(@"\s+", RegexOptions.Compiled);

        // Primeiro protocolo encontrado no texto (assunto do e-mail), em maiúsculas.
        public static string ExtrairProtocolo(string texto)
        {
            var m = Protocolo.Match(texto ?? string.Empty);
            return m.Success ? m.Value.ToUpperInvariant() : string.Empty;
        }

        // Nome da pasta do fornecedor — IGUAL ao do portal
        // (FornecedoresService.pastaFornecedor + limparSegmento):
        // "Razão social (8 primeiros caracteres do id)".
        public static string NomePasta(string razaoSocial, Guid fornecedorId)
        {
            var razao = (razaoSocial ?? string.Empty).Trim();
            if (razao.Length > 80)
            {
                razao = razao.Substring(0, 80);
            }
            var bruto = $"{razao} ({fornecedorId.ToString("D").Substring(0, 8)})";
            return Espacos.Replace(Proibidos.Replace(bruto.Trim().Replace("/", "-"), "-"), " ");
        }

        public sealed class Arquivo
        {
            public string Nome { get; set; }
            public string Url { get; set; }
        }

        // Arquivos válidos para registrar: com nome, link https e sem
        // repetir um link já registrado para o fornecedor.
        public static List<Arquivo> FiltrarNovos(IEnumerable<Arquivo> recebidos, ICollection<string> urlsJaRegistradas)
        {
            var vistos = new HashSet<string>(urlsJaRegistradas ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
            var novos = new List<Arquivo>();
            foreach (var a in recebidos ?? Enumerable.Empty<Arquivo>())
            {
                var nome = (a?.Nome ?? string.Empty).Trim();
                var url = (a?.Url ?? string.Empty).Trim();
                if (nome.Length == 0 || !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || vistos.Contains(url))
                {
                    continue;
                }
                vistos.Add(url);
                novos.Add(new Arquivo { Nome = nome, Url = url });
            }
            return novos;
        }
    }
}
