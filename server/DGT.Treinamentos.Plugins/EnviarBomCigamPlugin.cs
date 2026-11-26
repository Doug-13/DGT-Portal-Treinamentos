using System;
using System.Net.Http;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_EnviarBomCigam  →  webhook MAAX  →  CIGAM (HML)
    //
    // O portal chama com:
    //   PayloadJson = { "bomId": "...", "representante": "...",
    //                   "unidadeNegocio": "001", "controle": "NA",
    //                   "previsaoVenda": "AAAA-MM-DD",
    //                   "reenviar": false, "justificativa": "" }
    //
    // Os ITENS E PREÇOS NÃO vêm do navegador: são lidos da lista
    // congelada no envio para aprovação (dgt_bom_selecaokit.bomEnviado),
    // e o cliente vem da demanda (dgt_bom_codigocigam).
    //
    // A MAAX responde na hora (só confirma o recebimento); a oportunidade
    // e o pedido são criados em segundo plano (~10 s por item). Cada
    // tentativa fica registrada em dgt_bom_bom.dgt_bom_cigamenvio (JSON).
    //
    // REGISTRO (Plugin Registration Tool):
    //   Message dgt_EnviarBomCigam · PostOperation · Synchronous
    //   Secure Configuration   = o token do webhook (entregue pela MAAX)
    //   Unsecure Configuration = { "url": "https://api-bots.maaxhub.com.br/api/automation/webhook/<id>",
    //                              "ambiente": "Homologação" }
    //
    // O token vai SÓ no cabeçalho x-webhook-token: nunca na URL, em log,
    // em mensagem de erro ou no registro do envio.
    // ================================================================
    public sealed class EnviarBomCigamPlugin : IPlugin
    {
        private const string TabelaBom = "dgt_bom_bom";
        private const string TabelaDemanda = "dgt_bom_demanda";
        private const string ColunaEnvio = "dgt_bom_cigamenvio";

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        private readonly string _token;
        private readonly string _url = string.Empty;
        private readonly string _ambiente = "Homologação";

        public EnviarBomCigamPlugin(string unsecureConfig, string secureConfig)
        {
            _token = (secureConfig ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);
                    _url = ((string)config["url"] ?? string.Empty).Trim();
                    _ambiente = ((string)config["ambiente"] ?? _ambiente).Trim();
                }
                catch (JsonException)
                {
                    _url = string.Empty;
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            // Leitura e gravação com o usuário que clicou: respeita os perfis de segurança.
            var servico = fabrica.CreateOrganizationService(context.InitiatingUserId);

            if (string.IsNullOrWhiteSpace(_token))
            {
                throw new InvalidPluginExecutionException("Token do webhook não configurado: informe-o na Configuração segura do passo do EnviarBomCigamPlugin.");
            }
            if (!_url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) || _url.IndexOf('?') >= 0)
            {
                throw new InvalidPluginExecutionException("Endereço do webhook não configurado (ou com parâmetros): informe { \"url\": \"https://...\" } na Configuração não segura do passo.");
            }

            JObject entrada;
            try
            {
                entrada = JObject.Parse(context.InputParameters.Contains("PayloadJson") ? (string)context.InputParameters["PayloadJson"] ?? "{}" : "{}");
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            Guid bomId;
            if (!Guid.TryParse((string)entrada["bomId"], out bomId))
            {
                throw new InvalidPluginExecutionException("Informe o bomId.");
            }
            var reenviar = entrada["reenviar"] != null && entrada["reenviar"].Type == JTokenType.Boolean && (bool)entrada["reenviar"];
            var justificativa = ((string)entrada["justificativa"] ?? string.Empty).Trim();

            var bom = servico.Retrieve(TabelaBom, bomId, new ColumnSet("dgt_name", "dgt_bom_revisao", "dgt_bom_demanda", "dgt_bom_selecaokit", ColunaEnvio));
            var demandaRef = bom.GetAttributeValue<EntityReference>("dgt_bom_demanda");
            if (demandaRef == null)
            {
                throw new InvalidPluginExecutionException("O B.O.M. não está vinculado a uma demanda.");
            }
            var demanda = servico.Retrieve(TabelaDemanda, demandaRef.Id, new ColumnSet("dgt_name", "dgt_bom_numero", "dgt_bom_codigocigam"));

            var envios = LerEnvios(bom.GetAttributeValue<string>(ColunaEnvio));
            var bloqueio = BomCigam.EnvioQueBloqueia(envios);
            if (bloqueio != null && !reenviar)
            {
                context.OutputParameters["ResultadoJson"] = new JObject
                {
                    ["enviado"] = false,
                    ["jaEnviado"] = true,
                    ["ultimo"] = bloqueio,
                    ["mensagem"] = "Este B.O.M. já foi lançado no CIGAM. Um novo lançamento cria outra oportunidade e outro pedido."
                }.ToString(Formatting.None);
                return;
            }
            if (bloqueio != null && justificativa.Length < 10)
            {
                throw new InvalidPluginExecutionException("Para lançar de novo, informe a justificativa (mínimo de 10 caracteres).");
            }

            var numero = (bom.GetAttributeValue<string>("dgt_name") ?? string.Empty).Trim();
            var revisao = (bom.GetAttributeValue<string>("dgt_bom_revisao") ?? string.Empty).Trim();
            var montagem = BomCigam.MontarCorpo(bom.GetAttributeValue<string>("dgt_bom_selecaokit"), new BomCigam.Parametros
            {
                Bom = numero,
                Revisao = revisao,
                Titulo = $"{demanda.GetAttributeValue<string>("dgt_bom_numero")} · {demanda.GetAttributeValue<string>("dgt_name")}".Trim(' ', '·'),
                ClienteCigam = (demanda.GetAttributeValue<string>("dgt_bom_codigocigam") ?? string.Empty).Trim(),
                Representante = ((string)entrada["representante"] ?? string.Empty).Trim(),
                UnidadeNegocio = ((string)entrada["unidadeNegocio"] ?? string.Empty).Trim(),
                Controle = ((string)entrada["controle"] ?? string.Empty).Trim(),
                PrevisaoVenda = ((string)entrada["previsaoVenda"] ?? string.Empty).Trim()
            }, DateTime.UtcNow.AddHours(-3));

            if (montagem.Erros.Count > 0)
            {
                throw new InvalidPluginExecutionException("Não foi possível lançar no CIGAM:\n• " + string.Join("\n• ", montagem.Erros));
            }

            int codigo;
            string resposta;
            Postar(montagem.Corpo, out codigo, out resposta);
            var situacao = BomCigam.Situacao(codigo);
            tracing.Trace("Webhook BOM {0} {1}: HTTP {2} ({3}), {4} itens.", numero, revisao, codigo, situacao, montagem.Itens);

            var registro = new JObject
            {
                ["em"] = DateTime.UtcNow.ToString("o"),
                ["porId"] = context.InitiatingUserId.ToString(),
                ["ambiente"] = _ambiente,
                ["situacao"] = situacao,
                ["http"] = codigo,
                ["mensagem"] = Mensagem(codigo, resposta),
                ["itens"] = montagem.Itens,
                ["valorTotal"] = Math.Round(montagem.ValorTotal, 2),
                ["representante"] = montagem.Corpo["representante"],
                ["unidadeNegocio"] = montagem.Corpo["unidade_negocio"],
                ["controle"] = montagem.Corpo["controle"],
                ["previsaoVenda"] = montagem.Corpo["previsao_venda"],
                ["reenvio"] = bloqueio != null,
                ["justificativa"] = bloqueio != null ? justificativa : null
            };
            envios.Add(registro);

            var atualizar = new Entity(TabelaBom, bomId) { [ColunaEnvio] = envios.ToString(Formatting.None) };
            servico.Update(atualizar);

            context.OutputParameters["ResultadoJson"] = new JObject
            {
                ["enviado"] = situacao != "recusado",
                ["jaEnviado"] = false,
                ["ultimo"] = registro,
                ["segundosEstimados"] = montagem.Itens * 10 + 10
            }.ToString(Formatting.None);
        }

        private static JArray LerEnvios(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) { return new JArray(); }
            try { return JArray.Parse(json); }
            catch (JsonException) { return new JArray(); }
        }

        // Sem repetição automática: o webhook não protege contra duplicidade.
        private void Postar(JObject corpo, out int codigo, out string conteudo)
        {
            codigo = 0;
            conteudo = string.Empty;
            try
            {
                using (var requisicao = new HttpRequestMessage(HttpMethod.Post, _url))
                {
                    requisicao.Headers.TryAddWithoutValidation("x-webhook-token", _token);
                    requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");
                    using (var resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult())
                    {
                        codigo = (int)resposta.StatusCode;
                        conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
                    }
                }
            }
            catch (Exception ex)
            {
                conteudo = ex.GetType().Name;
            }
        }

        private static string Mensagem(int codigo, string conteudo)
        {
            switch (codigo)
            {
                case 0: return "Sem resposta do webhook (tempo esgotado ou falha de rede). O lançamento pode ter sido recebido: confira no CIGAM antes de lançar de novo.";
                case 401: return "Token do webhook ausente ou inválido (Configuração segura do passo).";
                case 404: return "Endereço do webhook errado ou automação desativada na MAAX.";
            }
            if (codigo >= 200 && codigo < 300)
            {
                return "Recebido pela MAAX; a oportunidade e o pedido são criados em segundo plano.";
            }
            var texto = conteudo ?? string.Empty;
            return $"Webhook respondeu HTTP {codigo}: {(texto.Length > 200 ? texto.Substring(0, 200) : texto)}";
        }
    }
}
