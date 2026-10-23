using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_BaixarArquivoPncp
    //
    // Por que existe: o PNCP devolve o cabeçalho
    //   Access-Control-Allow-Origin: *, *   (duplicado)
    // e o navegador RECUSA o arquivo ("only one is allowed"). Baixando
    // pelo servidor do Dataverse não há essa regra; o portal recebe o
    // arquivo e grava na pasta do edital no SharePoint.
    //
    // PayloadJson:   { "url": "https://pncp.gov.br/pncp-api/v1/.../arquivos/1" }
    // ResultadoJson: { "base64": "...", "tipo": "application/pdf",
    //                  "nome": "EDITAL.pdf", "tamanho": 12345 }
    //
    // Segurança:
    //   - só aceita endereços do PNCP (https://pncp.gov.br/...), para o
    //     plugin não virar um "baixador" de qualquer site;
    //   - limite de 40 MB por arquivo;
    //   - o endereço (que contém o CNPJ do órgão) é usado só em memória:
    //     não é gravado nem escrito no rastreamento.
    //
    // REGISTRO: nenhum passo é necessário. O script
    // scripts/dataverse/criar-api-baixar-arquivo-pncp.ps1 cria a Custom
    // API já ligada a este plugin (depois do Update do assembly).
    // ================================================================
    public sealed class BaixarArquivoPncpPlugin : IPlugin
    {
        private const long LimiteBytes = 40L * 1024 * 1024;

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(90) };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            var json = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;

            string url;
            try
            {
                url = ((string)JObject.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json)["url"] ?? string.Empty).Trim();
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            if (!Uri.TryCreate(url, UriKind.Absolute, out var endereco) ||
                endereco.Scheme != Uri.UriSchemeHttps ||
                !string.Equals(endereco.Host, "pncp.gov.br", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidPluginExecutionException("Somente arquivos do PNCP (https://pncp.gov.br) podem ser baixados.");
            }

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            HttpResponseMessage resposta;
            try
            {
                resposta = Http.GetAsync(endereco, HttpCompletionOption.ResponseHeadersRead).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                tracing.Trace("Falha de rede ao baixar do PNCP: {0}", ex.Message);
                throw new InvalidPluginExecutionException("Não foi possível falar com o PNCP agora. Tente de novo em instantes.");
            }

            using (resposta)
            {
                if (!resposta.IsSuccessStatusCode)
                {
                    throw new InvalidPluginExecutionException($"O PNCP respondeu HTTP {(int)resposta.StatusCode} ao baixar o arquivo.");
                }

                var tamanhoInformado = resposta.Content.Headers.ContentLength;
                if (tamanhoInformado.HasValue && tamanhoInformado.Value > LimiteBytes)
                {
                    throw new InvalidPluginExecutionException(
                        $"Arquivo grande demais para baixar pelo portal ({tamanhoInformado.Value / 1048576} MB; limite 40 MB). Baixe pelo PNCP.");
                }

                var bytes = resposta.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult();
                if (bytes.LongLength > LimiteBytes)
                {
                    throw new InvalidPluginExecutionException("Arquivo grande demais para baixar pelo portal (limite 40 MB). Baixe pelo PNCP.");
                }

                var tipo = resposta.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
                var disposicao = resposta.Content.Headers.ContentDisposition;
                var nome = (disposicao?.FileNameStar ?? disposicao?.FileName ?? string.Empty).Trim('"', ' ');

                tracing.Trace("Arquivo do PNCP baixado: {0} bytes, {1}.", bytes.LongLength, tipo);

                context.OutputParameters["ResultadoJson"] = new JObject
                {
                    ["base64"] = Convert.ToBase64String(bytes),
                    ["tipo"] = tipo,
                    ["nome"] = nome,
                    ["tamanho"] = bytes.LongLength
                }.ToString(Formatting.None);
            }
        }
    }
}
