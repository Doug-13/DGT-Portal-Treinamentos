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
    //       "orgaoMunicipio": "...", "dataPregao": "...", "resumo": "...", "parecer": "...",
    //       "orgao": "<id do campo>", "municipio": "...", "uf": "...",
    //       "modalidade": "...", "numero": "...", "valorEstimado": "...",
    //       "abertura": "...", "encerramento": "...", "compatibilidade": "...",
    //       "aderencia": "...", "plataforma": "...", "linkPortal": "..."
    //     }
    //   }
    //   Campos personalizados: gravados um a um após criar a tarefa; com
    //   "atualizarCampos": true, regrava os campos de uma tarefa existente.
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

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            // Valores dos campos personalizados (o que faltar é completado).
            var valores = payload["campos"] as JObject ?? new JObject();
            CompletarValores(valores, payload);

            var existenteId = acompanhamento.GetAttributeValue<string>("dgt_clickuptarefaid");
            if (!string.IsNullOrEmpty(existenteId))
            {
                // "Atualizar campos": regrava os campos na tarefa que já existe.
                var resultadoExistente = new JObject
                {
                    ["id"] = existenteId,
                    ["url"] = acompanhamento.GetAttributeValue<string>("dgt_clickupurl") ?? string.Empty,
                    ["existente"] = true
                };
                if ((bool?)payload["atualizarCampos"] == true)
                {
                    PreencherCampos(existenteId, valores, resultadoExistente, tracing);
                }
                context.OutputParameters["ResultadoJson"] = resultadoExistente.ToString(Formatting.None);
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

            // Os campos personalizados são gravados UM A UM depois de criar a
            // tarefa (POST /task/{id}/field/{campo}): o ClickUp ignora em
            // silêncio campos que recusa na criação, e assim cada falha
            // aparece com o motivo.

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

                // (Sem checklist: a DGT não usa checklist nessas tarefas.)

                var resultadoNovo = new JObject
                {
                    ["id"] = id,
                    ["url"] = url,
                    ["existente"] = false
                };

                if (id.Length > 0)
                {
                    PreencherCampos(id, valores, resultadoNovo, tracing);
                }

                var atualizacao = new Entity(TabelaAcompanhamento, acompanhamento.Id);
                atualizacao["dgt_clickuptarefaid"] = id;
                atualizacao["dgt_clickupurl"] = url;
                sistema.Update(atualizacao);

                tracing.Trace("Tarefa {0} criada no ClickUp para o acompanhamento {1}.", id, acompanhamento.Id);

                context.OutputParameters["ResultadoJson"] = resultadoNovo.ToString(Formatting.None);
            }
        }

        // Grava cada campo mapeado na configuração e devolve, no resultado,
        // quantos foram preenchidos e quais falharam (com o motivo do ClickUp).
        private void PreencherCampos(string idTarefa, JObject valores, JObject resultado, ITracingService tracing)
        {
            var preenchidos = 0;
            var erros = new JArray();

            foreach (var mapa in _campos.Properties())
            {
                var idCampo = ((string)mapa.Value ?? string.Empty).Trim();
                var valor = valores[mapa.Name];

                if (idCampo.Length == 0 || valor == null || valor.Type == JTokenType.Null ||
                    (valor.Type == JTokenType.String && ((string)valor).Trim().Length == 0))
                {
                    continue;
                }

                var corpo = new JObject
                {
                    ["value"] = valor.Type == JTokenType.String ? (JToken)Mascarar((string)valor) : valor
                };

                // Datas com hora.
                if (mapa.Name == "abertura" || mapa.Name == "encerramento" || mapa.Name == "dataPregao")
                {
                    corpo["value_options"] = new JObject { ["time"] = true };
                }

                try
                {
                    using (var requisicao = new HttpRequestMessage(HttpMethod.Post, $"https://api.clickup.com/api/v2/task/{idTarefa}/field/{idCampo}"))
                    {
                        requisicao.Headers.TryAddWithoutValidation("Authorization", _token);
                        requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");
                        using (var resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult())
                        {
                            if (resposta.IsSuccessStatusCode)
                            {
                                preenchidos++;
                                continue;
                            }
                            var conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                            var motivo = string.Empty;
                            try { motivo = (string)JObject.Parse(conteudo)["err"] ?? string.Empty; }
                            catch (JsonException) { motivo = conteudo.Length > 150 ? conteudo.Substring(0, 150) : conteudo; }
                            tracing.Trace("Campo {0} ({1}) recusado: {2} {3}", mapa.Name, idCampo, (int)resposta.StatusCode, motivo);
                            erros.Add(new JObject { ["campo"] = mapa.Name, ["motivo"] = $"{(int)resposta.StatusCode} {motivo}".Trim() });
                        }
                    }
                }
                catch (Exception ex)
                {
                    tracing.Trace("Campo {0} não gravado: {1}", mapa.Name, ex.Message);
                    erros.Add(new JObject { ["campo"] = mapa.Name, ["motivo"] = "falha de rede" });
                }
            }

            resultado["camposPreenchidos"] = preenchidos;
            resultado["camposComErro"] = erros;
        }

        // Preenche os campos que o portal não mandou, a partir dos outros
        // (assim os campos não ficam vazios se o portal for de uma
        // versão anterior).
        private static void CompletarValores(JObject v, JObject payload)
        {
            string Texto(string chave) => ((string)v[chave] ?? string.Empty).Trim();

            if (Texto("orgaoMunicipio").Length == 0 && Texto("orgao").Length > 0)
            {
                var local = Texto("municipio") + (Texto("uf").Length > 0 ? "/" + Texto("uf") : string.Empty);
                v["orgaoMunicipio"] = Texto("orgao") + (local.Length > 0 ? " — " + local : string.Empty);
            }

            var encerramento = v["encerramento"];
            if ((v["dataPregao"] == null || v["dataPregao"].Type == JTokenType.Null) &&
                encerramento != null && encerramento.Type != JTokenType.Null)
            {
                v["dataPregao"] = encerramento.DeepClone();
            }

            if (Texto("resumo").Length == 0)
            {
                var descricao = ((string)payload["descricao"] ?? string.Empty)
                    .Replace("**", string.Empty)
                    .Replace("> ", string.Empty)
                    .Trim();
                if (descricao.Length > 0)
                {
                    v["resumo"] = descricao.Length > 3000 ? descricao.Substring(0, 3000) + "…" : descricao;
                }
            }

            // Aderência 0 ou negativa = desconhecida (tarefa criada fora da busca).
            var aderencia = (int?)v["aderencia"];
            if (aderencia.HasValue && aderencia.Value <= 0)
            {
                v["aderencia"] = null;
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
