using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_CriarTarefaClickUp  →  ClickUp (tarefa de licitação)
    //
    // Chamada pelo portal quando o parecer é "Participar".
    //
    // PayloadJson:
    //   { "chaveEdital": "...", "nome": "...", "descricao": "markdown",
    //     "dataLimite": 1730000000000 (ms, opcional), "prioridade": 1..4 }
    //
    // ResultadoJson:
    //   { "id": "...", "url": "https://app.clickup.com/t/...", "existente": false }
    //
    // Uma tarefa por edital: se o acompanhamento já tem tarefa, devolve
    // a existente (não duplica). O id e o link ficam gravados em
    // dgt_licitacaoacompanhamento (dgt_clickuptarefaid / dgt_clickupurl).
    //
    // REGISTRO (Plugin Registration Tool):
    //   Message dgt_CriarTarefaClickUp · PostOperation · Synchronous
    //   "Delete AsyncOperation" desmarcado
    //   Secure Configuration   = o token pessoal do ClickUp (pk_...)
    //   Unsecure Configuration = {
    //     "listId": "<id da lista>",
    //     "status": "análise",                 (coluna onde a tarefa nasce)
    //     "tags": ["licitação"],               (somadas às do portal: modalidade, UF)
    //     "campos": {                          (opcional: campos personalizados da lista)
    //       "orgao": "<id do campo>", "municipio": "...", "uf": "...",
    //       "modalidade": "...", "numero": "...", "valorEstimado": "...",
    //       "abertura": "...", "encerramento": "...", "compatibilidade": "...",
    //       "aderencia": "...", "plataforma": "...", "linkPortal": "..."
    //     }
    //   }
    //   Além da descrição, cria o checklist "Etapas da participação".
    //
    // A descrição chega SEM CNPJ e SEM o link do PNCP; mesmo assim o
    // plugin mascara CNPJ/CPF de novo antes de enviar.
    // ================================================================
    public sealed class CriarTarefaClickUpPlugin : IPlugin
    {
        private const string TabelaAcompanhamento = "dgt_licitacaoacompanhamento";

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        private static readonly Regex Cnpj =
            new Regex(@"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b", RegexOptions.Compiled);

        private static readonly Regex Cpf =
            new Regex(@"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", RegexOptions.Compiled);

        private static readonly Regex SoDigitos =
            new Regex(@"^\d+$", RegexOptions.Compiled);

        private readonly string _token;
        private readonly string _listId;
        private readonly string[] _tags;
        private readonly string _status;
        private readonly JObject _campos;

        public CriarTarefaClickUpPlugin(string unsecureConfig, string secureConfig)
        {
            _token = (secureConfig ?? string.Empty).Trim();
            _listId = string.Empty;
            _tags = new[] { "licitação" };
            _status = string.Empty;
            _campos = new JObject();

            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);
                    _listId = ((string)config["listId"] ?? string.Empty).Trim();
                    _status = ((string)config["status"] ?? string.Empty).Trim();
                    _campos = config["campos"] as JObject ?? new JObject();
                    var tags = config["tags"] as JArray;
                    if (tags != null)
                    {
                        _tags = tags.Select(t => ((string)t ?? string.Empty).Trim()).Where(t => t.Length > 0).ToArray();
                    }
                }
                catch (JsonException)
                {
                    _listId = string.Empty;
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var sistema = fabrica.CreateOrganizationService(null);

            if (string.IsNullOrWhiteSpace(_token))
            {
                throw new InvalidPluginExecutionException(
                    "Token do ClickUp não configurado: informe-o na Configuração segura do passo do plugin CriarTarefaClickUpPlugin.");
            }

            if (!SoDigitos.IsMatch(_listId))
            {
                throw new InvalidPluginExecutionException(
                    "Lista do ClickUp não configurada: informe { \"listId\": \"...\" } na Configuração não segura do passo.");
            }

            var json = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;

            JObject payload;
            try
            {
                payload = JObject.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            var chave = ((string)payload["chaveEdital"] ?? string.Empty).Trim();
            var nome = Mascarar(((string)payload["nome"] ?? string.Empty).Trim());

            if (chave.Length == 0 || nome.Length == 0)
            {
                throw new InvalidPluginExecutionException("chaveEdital e nome são obrigatórios.");
            }

            // Uma tarefa por edital.
            var consulta = new QueryExpression(TabelaAcompanhamento)
            {
                ColumnSet = new ColumnSet("dgt_clickuptarefaid", "dgt_clickupurl"),
                TopCount = 1
            };
            consulta.Criteria.AddCondition("dgt_chaveedital", ConditionOperator.Equal, chave);
            var acompanhamento = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();

            if (acompanhamento == null)
            {
                throw new InvalidPluginExecutionException("Acompanhamento do edital não encontrado.");
            }

            var existenteId = acompanhamento.GetAttributeValue<string>("dgt_clickuptarefaid");
            if (!string.IsNullOrEmpty(existenteId))
            {
                context.OutputParameters["ResultadoJson"] = new JObject
                {
                    ["id"] = existenteId,
                    ["url"] = acompanhamento.GetAttributeValue<string>("dgt_clickupurl") ?? string.Empty,
                    ["existente"] = true
                }.ToString(Formatting.None);
                return;
            }

            var corpo = new JObject
            {
                ["name"] = nome.Length > 250 ? nome.Substring(0, 250) : nome,
                ["markdown_description"] = Mascarar((string)payload["descricao"] ?? string.Empty),
                ["tags"] = new JArray(_tags
                    .Concat((payload["tags"] as JArray ?? new JArray()).Select(t => ((string)t ?? string.Empty).Trim().ToLowerInvariant()))
                    .Where(t => t.Length > 0)
                    .Distinct()
                    .Take(10)),
                ["start_date"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                ["start_date_time"] = false
            };

            if (_status.Length > 0)
            {
                corpo["status"] = _status;
            }

            // Campos personalizados mapeados na configuração.
            var valores = payload["campos"] as JObject ?? new JObject();
            var personalizados = new JArray();
            foreach (var mapa in _campos.Properties())
            {
                var idCampo = ((string)mapa.Value ?? string.Empty).Trim();
                var valor = valores[mapa.Name];
                if (idCampo.Length == 0 || valor == null || valor.Type == JTokenType.Null ||
                    (valor.Type == JTokenType.String && ((string)valor).Length == 0))
                {
                    continue;
                }
                personalizados.Add(new JObject
                {
                    ["id"] = idCampo,
                    ["value"] = valor.Type == JTokenType.String ? (JToken)Mascarar((string)valor) : valor
                });
            }
            if (personalizados.Count > 0)
            {
                corpo["custom_fields"] = personalizados;
            }

            var dataLimite = (long?)payload["dataLimite"];
            if (dataLimite.HasValue && dataLimite.Value > 0)
            {
                corpo["due_date"] = dataLimite.Value;
                corpo["due_date_time"] = true;
            }

            var prioridade = (int?)payload["prioridade"];
            if (prioridade.HasValue && prioridade.Value >= 1 && prioridade.Value <= 4)
            {
                corpo["priority"] = prioridade.Value;
            }

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            using (var requisicao = new HttpRequestMessage(HttpMethod.Post, $"https://api.clickup.com/api/v2/list/{_listId}/task"))
            {
                requisicao.Headers.TryAddWithoutValidation("Authorization", _token);
                requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");

                HttpResponseMessage resposta;
                string conteudo;
                try
                {
                    resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                    conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    tracing.Trace("Falha de rede ao chamar o ClickUp: {0}", ex.Message);
                    throw new InvalidPluginExecutionException("Não foi possível falar com o ClickUp agora. Tente de novo em instantes.");
                }

                if (!resposta.IsSuccessStatusCode)
                {
                    var codigo = (int)resposta.StatusCode;
                    tracing.Trace("ClickUp respondeu {0}: {1}", codigo, conteudo.Length > 500 ? conteudo.Substring(0, 500) : conteudo);

                    var motivo = string.Empty;
                    try { motivo = (string)JObject.Parse(conteudo)["err"] ?? string.Empty; }
                    catch (JsonException) { motivo = string.Empty; }

                    throw new InvalidPluginExecutionException(
                        codigo == 401
                            ? "O ClickUp recusou o token configurado no plugin (verifique a Configuração segura)."
                            : codigo == 404
                                ? "Lista do ClickUp não encontrada (verifique o listId na Configuração não segura)."
                                : $"O ClickUp respondeu com erro ({codigo})" + (motivo.Length > 0 ? ": " + motivo : "."));
                }

                var tarefa = JObject.Parse(conteudo);
                var id = (string)tarefa["id"] ?? string.Empty;
                var url = (string)tarefa["url"] ?? (id.Length > 0 ? $"https://app.clickup.com/t/{id}" : string.Empty);

                // Checklist "Etapas da participação" (falha aqui não desfaz a tarefa).
                var etapas = (payload["checklist"] as JArray ?? new JArray())
                    .Select(t => Mascarar(((string)t ?? string.Empty).Trim()))
                    .Where(t => t.Length > 0)
                    .Take(20)
                    .ToList();
                if (id.Length > 0 && etapas.Count > 0)
                {
                    try
                    {
                        var checklist = EnviarJson(HttpMethod.Post, $"https://api.clickup.com/api/v2/task/{id}/checklist",
                            new JObject { ["name"] = "Etapas da participação" });
                        var idChecklist = (string)checklist?.SelectToken("checklist.id");
                        if (!string.IsNullOrEmpty(idChecklist))
                        {
                            foreach (var etapa in etapas)
                            {
                                EnviarJson(HttpMethod.Post, $"https://api.clickup.com/api/v2/checklist/{idChecklist}/checklist_item",
                                    new JObject { ["name"] = etapa.Length > 250 ? etapa.Substring(0, 250) : etapa });
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        tracing.Trace("Checklist não criado na tarefa {0}: {1}", id, ex.Message);
                    }
                }

                var atualizacao = new Entity(TabelaAcompanhamento, acompanhamento.Id);
                atualizacao["dgt_clickuptarefaid"] = id;
                atualizacao["dgt_clickupurl"] = url;
                sistema.Update(atualizacao);

                tracing.Trace("Tarefa {0} criada no ClickUp para o acompanhamento {1}.", id, acompanhamento.Id);

                context.OutputParameters["ResultadoJson"] = new JObject
                {
                    ["id"] = id,
                    ["url"] = url,
                    ["existente"] = false
                }.ToString(Formatting.None);
            }
        }

        private JObject EnviarJson(HttpMethod metodo, string url, JObject corpo)
        {
            using (var requisicao = new HttpRequestMessage(metodo, url))
            {
                requisicao.Headers.TryAddWithoutValidation("Authorization", _token);
                requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");
                using (var resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult())
                {
                    var conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    if (!resposta.IsSuccessStatusCode)
                    {
                        throw new InvalidOperationException($"ClickUp {(int)resposta.StatusCode}");
                    }
                    return string.IsNullOrWhiteSpace(conteudo) ? new JObject() : JObject.Parse(conteudo);
                }
            }
        }

        private static string Mascarar(string texto) =>
            Cpf.Replace(Cnpj.Replace(texto ?? string.Empty, "[dado removido]"), "[dado removido]");
    }
}
