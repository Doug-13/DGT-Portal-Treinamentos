using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_AnalisarLicitacaoIa  →  API do Claude (Anthropic)
    //
    // Chamada pelo portal (Licitações › Análise da IA).
    //
    // PayloadJson:
    //   { "sistema": "...", "mensagem": "...", "modelo": "claude-sonnet-5-5",
    //     "temperatura": 0.2, "maxTokens": 1200 }
    //
    // ResultadoJson:
    //   { "texto": "...", "modelo": "...", "tokensEntrada": 0, "tokensSaida": 0 }
    //
    // REGISTRO (Plugin Registration Tool) — passo, NÃO plugin da Custom API:
    //   Message ........ dgt_AnalisarLicitacaoIa
    //   Primary Entity . none
    //   Stage .......... PostOperation   ·   Mode: Synchronous
    //   Secure Configuration (SOMENTE AQUI fica a chave):
    //       { "apiKey": "<chave da Anthropic>" }
    //     ou apenas a chave, sem JSON.
    //   Unsecure Configuration (opcional):
    //       { "modelos": "claude-sonnet-5-5,claude-haiku-5-5", "maxTokens": 2000 }
    //
    // A configuração segura só é visível para administradores do
    // sistema e não aparece no portal, no código nem no Git.
    //
    // Proteções:
    //   - modelo restrito à lista permitida; tokens e tamanho limitados;
    //   - CNPJ/CPF mascarados de novo antes do envio (LGPD);
    //   - erros da Anthropic vão para o Rastreamento do plugin, sem
    //     expor detalhes ao navegador; a chave nunca é registrada.
    // ================================================================
    public sealed class AnalisarLicitacaoIaPlugin : IPlugin
    {
        private const string UrlClaude = "https://api.anthropic.com/v1/messages";
        private const string VersaoApi = "2023-06-01";
        private const int LimiteMensagem = 60000;
        private const int LimiteSistema = 20000;

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(100) };

        private static readonly Regex Cnpj =
            new Regex(@"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", RegexOptions.Compiled);

        private static readonly Regex Cpf =
            new Regex(@"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", RegexOptions.Compiled);

        private readonly string _apiKey;
        private readonly string[] _modelos;
        private readonly int _maxTokens;

        public AnalisarLicitacaoIaPlugin(string unsecureConfig, string secureConfig)
        {
            _apiKey = LerChave(secureConfig);

            _modelos = new[] { "claude-sonnet-5-5", "claude-haiku-5-5" };
            _maxTokens = 2000;

            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);

                    var modelos = (string)config["modelos"];
                    if (!string.IsNullOrWhiteSpace(modelos))
                    {
                        _modelos = modelos
                            .Split(',')
                            .Select(m => m.Trim())
                            .Where(m => m.Length > 0)
                            .ToArray();
                    }

                    var max = (int?)config["maxTokens"];
                    if (max.HasValue && max.Value >= 200)
                    {
                        _maxTokens = max.Value;
                    }
                }
                catch (JsonException)
                {
                    // Configuração não segura inválida: usa os padrões.
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            if (string.IsNullOrWhiteSpace(_apiKey))
            {
                throw new InvalidPluginExecutionException(
                    "Chave da IA não configurada: informe-a na Configuração segura do passo do plugin AnalisarLicitacaoIaPlugin.");
            }

            var payloadJson =
                context.InputParameters.Contains("PayloadJson")
                    ? context.InputParameters["PayloadJson"] as string
                    : null;

            if (string.IsNullOrWhiteSpace(payloadJson))
            {
                throw new InvalidPluginExecutionException("PayloadJson não foi informado.");
            }

            JObject payload;
            try
            {
                payload = JObject.Parse(payloadJson);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            var mensagem = Mascarar((string)payload["mensagem"] ?? string.Empty);
            var sistema = Mascarar((string)payload["sistema"] ?? string.Empty);

            if (mensagem.Trim().Length == 0 || mensagem.Length > LimiteMensagem)
            {
                throw new InvalidPluginExecutionException("Mensagem vazia ou grande demais para a IA.");
            }

            if (sistema.Length > LimiteSistema)
            {
                sistema = sistema.Substring(0, LimiteSistema);
            }

            var pedido = (string)payload["modelo"];
            var modelo = _modelos.Contains(pedido) ? pedido : _modelos[0];

            var maxTokens = Math.Max(200, Math.Min((int?)payload["maxTokens"] ?? 1200, _maxTokens));

            var temperatura = Math.Max(0d, Math.Min((double?)payload["temperatura"] ?? 0.2d, 1d));

            var corpo = new JObject
            {
                ["model"] = modelo,
                ["max_tokens"] = maxTokens,
                ["temperature"] = temperatura,
                ["system"] = sistema,
                ["messages"] = new JArray
                {
                    new JObject
                    {
                        ["role"] = "user",
                        ["content"] = mensagem
                    }
                }
            };

            // .NET Framework 4.6.2: garante TLS 1.2 para a Anthropic.
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            using (var requisicao = new HttpRequestMessage(HttpMethod.Post, UrlClaude))
            {
                requisicao.Headers.Add("x-api-key", _apiKey);
                requisicao.Headers.Add("anthropic-version", VersaoApi);
                requisicao.Content = new StringContent(
                    corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");

                HttpResponseMessage resposta;
                string conteudo;

                try
                {
                    resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                    conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    tracing.Trace("Falha de rede ao chamar o Claude: {0}", ex.Message);
                    throw new InvalidPluginExecutionException(
                        "Não foi possível falar com a IA agora. Tente de novo em instantes.");
                }

                if (!resposta.IsSuccessStatusCode)
                {
                    tracing.Trace(
                        "Claude respondeu {0}: {1}",
                        (int)resposta.StatusCode,
                        conteudo.Length > 500 ? conteudo.Substring(0, 500) : conteudo);

                    var codigo = (int)resposta.StatusCode;

                    // Motivo informado pela Anthropic (não contém a chave).
                    var motivo = string.Empty;
                    try
                    {
                        motivo = (string)JObject.Parse(conteudo).SelectToken("error.message") ?? string.Empty;
                    }
                    catch (JsonException)
                    {
                        motivo = string.Empty;
                    }

                    if (motivo.Length > 250)
                    {
                        motivo = motivo.Substring(0, 250);
                    }

                    throw new InvalidPluginExecutionException(
                        codigo == 401 || codigo == 403
                            ? "A IA recusou a chave configurada no plugin (verifique a Configuração segura)."
                            : codigo == 429
                                ? "Limite de uso da IA atingido. Tente novamente em alguns minutos."
                                : $"A IA respondeu com erro ({codigo})" + (motivo.Length > 0 ? ": " + motivo : "."));
                }

                var resultado = JObject.Parse(conteudo);

                var texto = string.Join(
                    "\n",
                    (resultado["content"] as JArray ?? new JArray())
                        .OfType<JObject>()
                        .Where(b => (string)b["type"] == "text")
                        .Select(b => (string)b["text"]));

                var entrada = (int?)resultado.SelectToken("usage.input_tokens") ?? 0;
                var saida = (int?)resultado.SelectToken("usage.output_tokens") ?? 0;

                tracing.Trace("Análise ok · modelo {0} · tokens {1}/{2}", modelo, entrada, saida);

                context.OutputParameters["ResultadoJson"] =
                    JsonConvert.SerializeObject(new
                    {
                        texto,
                        modelo,
                        tokensEntrada = entrada,
                        tokensSaida = saida
                    });
            }
        }

        // Aceita { "apiKey": "..." } ou apenas a chave.
        private static string LerChave(string secureConfig)
        {
            var valor = (secureConfig ?? string.Empty).Trim();

            if (valor.StartsWith("{"))
            {
                try
                {
                    return ((string)JObject.Parse(valor)["apiKey"] ?? string.Empty).Trim();
                }
                catch (JsonException)
                {
                    return string.Empty;
                }
            }

            return valor;
        }

        private static string Mascarar(string texto) =>
            Cpf.Replace(Cnpj.Replace(texto, "[dado removido]"), "[dado removido]");
    }
}
