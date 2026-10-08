using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_SincronizarClickUp
    //
    // Chamada pelo fluxo do Power Automate "DGT - Sincronizar ClickUp".
    // O fluxo busca as páginas da API do ClickUp (o token fica no fluxo,
    // nunca no portal) e entrega cada página para esta API, que converte
    // e grava as tarefas em dgt_clickuptarefa.
    //
    // PayloadJson:
    //   { "acao": "pagina",
    //     "listaCronogramaId": "9013...",      (lista do Cronograma Geral)
    //     "resposta": { ...corpo da API GET /team/{id}/task... } }
    //
    //   { "acao": "finalizar",
    //     "ids": ["86abc...", ...] }           (todos os ids recebidos)
    //
    // Regras (equivalentes às consultas do Power BI "BI - Clickup V3"):
    //   - Campos personalizados localizados pelo NOME (Freq. Mensal,
    //     Tempo Antes, Tempo Depois, Progresso/%Concluído), com
    //     tradução de listas suspensas e números com vírgula ou ponto.
    //   - Data de conclusão = date_done; se vazia, date_closed.
    //   - Hierarquia: 0 tarefa principal, 1 subtarefa, 2 subtarefa 2+.
    //   - Uma linha por tarefa (tags e responsáveis em texto ";"), o que
    //     evita a contagem dobrada por tag que existia no BI.
    //   - Só grava o que mudou (date_updated + lista do cronograma).
    //   - "finalizar" desativa (não apaga) tarefas que sumiram do ClickUp.
    // ================================================================
    public sealed class SincronizarClickUpPlugin : IPlugin
    {
        private const string Tabela = "dgt_clickuptarefa";
        private const int TamanhoNome = 200;

        private static readonly string[] CampoFrequencia =
            { "Freq. Mensal", "Freq Mensal", "Frequência Mensal", "Frequencia Mensal" };

        private static readonly string[] CampoTempoAntes =
            { "Tempo Antes", "Tempo Antes (min/exec)" };

        private static readonly string[] CampoTempoDepois =
            { "Tempo Depois", "Tempo Depois (min/exec)" };

        private static readonly string[] CampoProgresso =
            { "Progresso", "%Concluído", "% Concluído", "%Concluido" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            // Quem chama precisa ter o privilégio exigido pela Custom API
            // (Gravar em dgt_clickuptarefa). A gravação roda como SYSTEM.
            var sistema =
                factory.CreateOrganizationService(null);

            try
            {
                var payloadJson =
                    context.InputParameters.Contains("PayloadJson")
                        ? context.InputParameters["PayloadJson"] as string
                        : null;

                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    throw new InvalidPluginExecutionException(
                        "PayloadJson não foi informado.");
                }

                var payload = JObject.Parse(payloadJson);

                var acao =
                    (Texto(payload["acao"]) ?? "pagina")
                        .Trim()
                        .ToLowerInvariant();

                object resultado;

                if (acao == "finalizar")
                {
                    resultado = Finalizar(sistema, tracing, payload);
                }
                else
                {
                    resultado = ProcessarPagina(sistema, tracing, payload);
                }

                context.OutputParameters["ResultadoJson"] =
                    JsonConvert.SerializeObject(resultado);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível sincronizar o ClickUp: " + ex.Message,
                    ex);
            }
        }

        // ============================================================
        // PÁGINA
        // ============================================================

        private static object ProcessarPagina(
            IOrganizationService sistema,
            ITracingService tracing,
            JObject payload)
        {
            var listaCronogramaId =
                (Texto(payload["listaCronogramaId"]) ?? string.Empty).Trim();

            var resposta =
                payload["resposta"] as JObject ?? new JObject();

            var tarefas =
                (resposta["tasks"] as JArray ?? new JArray())
                    .OfType<JObject>()
                    .Where(t => !string.IsNullOrWhiteSpace(Texto(t["id"])))
                    .ToList();

            var existentes =
                BuscarExistentes(
                    sistema,
                    tarefas.Select(t => Texto(t["id"])).Distinct().ToList());

            int criadas = 0, atualizadas = 0, inalteradas = 0, falhas = 0;

            var agora = DateTime.UtcNow;

            foreach (var tarefa in tarefas)
            {
                var taskId = Texto(tarefa["id"]);

                try
                {
                    var registro = Converter(tarefa, listaCronogramaId);
                    var hash = (string)registro["dgt_hashsync"];

                    Entity atual;

                    if (existentes.TryGetValue(taskId, out atual))
                    {
                        var ativo = atual.GetAttributeValue<bool?>("dgt_ativo") != false;

                        if (ativo &&
                            string.Equals(
                                atual.GetAttributeValue<string>("dgt_hashsync"),
                                hash,
                                StringComparison.Ordinal))
                        {
                            inalteradas++;
                            continue;
                        }

                        registro.Id = atual.Id;
                        registro["dgt_ultimasincronizacao"] = agora;
                        sistema.Update(registro);
                        atualizadas++;
                    }
                    else
                    {
                        registro["dgt_ultimasincronizacao"] = agora;
                        sistema.Create(registro);
                        criadas++;
                    }
                }
                catch (Exception ex)
                {
                    // Uma tarefa com problema não interrompe a página.
                    falhas++;
                    tracing.Trace("Tarefa {0}: {1}", taskId, ex.Message);
                }
            }

            return new
            {
                acao = "pagina",
                recebidas = tarefas.Count,
                criadas,
                atualizadas,
                inalteradas,
                falhas,
                ultimaPagina =
                    resposta["last_page"] != null &&
                    resposta["last_page"].Type == JTokenType.Boolean
                        ? (bool)resposta["last_page"]
                        : tarefas.Count == 0
            };
        }

        private static Dictionary<string, Entity> BuscarExistentes(
            IOrganizationService sistema,
            List<string> ids)
        {
            var resultado = new Dictionary<string, Entity>(StringComparer.Ordinal);

            foreach (var lote in Lotes(ids, 200))
            {
                var consulta =
                    new QueryExpression(Tabela)
                    {
                        ColumnSet = new ColumnSet("dgt_taskid", "dgt_hashsync", "dgt_ativo")
                    };

                consulta.Criteria.AddCondition(
                    "dgt_taskid",
                    ConditionOperator.In,
                    lote.Cast<object>().ToArray());

                foreach (var e in sistema.RetrieveMultiple(consulta).Entities)
                {
                    var id = e.GetAttributeValue<string>("dgt_taskid");

                    if (!string.IsNullOrEmpty(id) && !resultado.ContainsKey(id))
                    {
                        resultado[id] = e;
                    }
                }
            }

            return resultado;
        }

        // ============================================================
        // FINALIZAR: desativa o que não veio nesta sincronização
        // ============================================================

        private static object Finalizar(
            IOrganizationService sistema,
            ITracingService tracing,
            JObject payload)
        {
            var recebidos =
                new HashSet<string>(
                    (payload["ids"] as JArray ?? new JArray())
                        .Select(Texto)
                        .Where(id => !string.IsNullOrWhiteSpace(id)),
                    StringComparer.Ordinal);

            // Proteção: se nada veio (ex.: falha na API do ClickUp), não
            // desativa nada.
            if (recebidos.Count == 0)
            {
                return new { acao = "finalizar", desativadas = 0, aviso = "Nenhum id recebido; nada foi desativado." };
            }

            var consulta =
                new QueryExpression(Tabela)
                {
                    ColumnSet = new ColumnSet("dgt_taskid"),
                    PageInfo = new PagingInfo { PageNumber = 1, Count = 5000 }
                };

            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);

            var desativar = new List<Guid>();

            while (true)
            {
                var pagina = sistema.RetrieveMultiple(consulta);

                desativar.AddRange(
                    pagina.Entities
                        .Where(e => !recebidos.Contains(e.GetAttributeValue<string>("dgt_taskid") ?? string.Empty))
                        .Select(e => e.Id));

                if (!pagina.MoreRecords)
                {
                    break;
                }

                consulta.PageInfo.PageNumber++;
                consulta.PageInfo.PagingCookie = pagina.PagingCookie;
            }

            var agora = DateTime.UtcNow;

            foreach (var id in desativar)
            {
                try
                {
                    var registro = new Entity(Tabela, id);
                    registro["dgt_ativo"] = false;
                    registro["dgt_hashsync"] = "removida";
                    registro["dgt_ultimasincronizacao"] = agora;
                    sistema.Update(registro);
                }
                catch (Exception ex)
                {
                    tracing.Trace("Desativar {0}: {1}", id, ex.Message);
                }
            }

            return new { acao = "finalizar", recebidos = recebidos.Count, desativadas = desativar.Count };
        }

        // ============================================================
        // CONVERSÃO DE UMA TAREFA DO CLICKUP
        // ============================================================

        private static Entity Converter(JObject t, string listaCronogramaId)
        {
            var registro = new Entity(Tabela);

            var nome = Texto(t["name"]) ?? "(sem nome)";
            var status = t["status"] as JObject;
            var lista = t["list"] as JObject;
            var pasta = t["folder"] as JObject;

            var parent = Texto(t["parent"]);
            var topLevel = Texto(t["top_level_parent"]);

            var nivel =
                string.IsNullOrEmpty(parent)
                    ? 0
                    : string.IsNullOrEmpty(topLevel) || topLevel == parent
                        ? 1
                        : 2;

            var responsaveis =
                (t["assignees"] as JArray ?? new JArray()).OfType<JObject>().ToList();

            var tags =
                (t["tags"] as JArray ?? new JArray())
                    .OfType<JObject>()
                    .Select(tag => Texto(tag["name"]))
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

            var campos = t["custom_fields"] as JArray ?? new JArray();

            var listaId = lista != null ? Texto(lista["id"]) : null;
            var dataAtualizacao = Texto(t["date_updated"]);

            var conclusao =
                ParaData(t["date_done"]) ?? ParaData(t["date_closed"]);

            var noCronograma =
                !string.IsNullOrEmpty(listaCronogramaId) &&
                string.Equals(listaId, listaCronogramaId, StringComparison.Ordinal);

            registro["dgt_taskid"] = Texto(t["id"]);
            registro["dgt_name"] = Cortar(nome, TamanhoNome);
            registro["dgt_nomecompleto"] = Cortar(nome, 2000);

            registro["dgt_status"] = Cortar(status != null ? Texto(status["status"]) : null, 100);
            registro["dgt_tipostatus"] = Cortar(status != null ? Texto(status["type"]) : null, 50);

            registro["dgt_listaid"] = Cortar(listaId, 50);
            registro["dgt_lista"] = Cortar(lista != null ? Texto(lista["name"]) : null, 200);
            registro["dgt_pasta"] = Cortar(pasta != null ? Texto(pasta["name"]) : null, 200);

            registro["dgt_parentid"] = Cortar(parent, 50);
            registro["dgt_toplevelparentid"] = Cortar(topLevel, 50);
            registro["dgt_nivelhierarquia"] = nivel;

            registro["dgt_responsaveis"] =
                Cortar(string.Join("; ", responsaveis.Select(r => Texto(r["username"])).Where(v => !string.IsNullOrWhiteSpace(v))), 2000);

            registro["dgt_emailsresponsaveis"] =
                Cortar(string.Join("; ", responsaveis.Select(r => Texto(r["email"])).Where(v => !string.IsNullOrWhiteSpace(v))), 4000);

            registro["dgt_tags"] = Cortar(string.Join("; ", tags), 2000);

            registro["dgt_datacriacao"] = ParaData(t["date_created"]);
            registro["dgt_dataatualizacao"] = ParaData(t["date_updated"]);
            registro["dgt_datainicio"] = ParaData(t["start_date"]);
            registro["dgt_dataprazo"] = ParaData(t["due_date"]);
            registro["dgt_dataconclusao"] = conclusao;

            registro["dgt_freqmensal"] = ParaDecimal(Numero(CampoPersonalizado(campos, CampoFrequencia)));
            registro["dgt_tempoantesmin"] = ParaDecimal(Numero(CampoPersonalizado(campos, CampoTempoAntes)));
            registro["dgt_tempodepoismin"] = ParaDecimal(Numero(CampoPersonalizado(campos, CampoTempoDepois)));
            registro["dgt_progresso"] = ParaDecimal(Progresso(CampoPersonalizado(campos, CampoProgresso)));

            registro["dgt_url"] = Cortar(Texto(t["url"]), 500);
            registro["dgt_cronograma"] = noCronograma;
            registro["dgt_ativo"] = true;

            // Muda quando a tarefa muda no ClickUp ou quando a lista do
            // cronograma configurada no fluxo muda.
            registro["dgt_hashsync"] =
                Cortar((dataAtualizacao ?? string.Empty) + "|" + (noCronograma ? "1" : "0"), 100);

            return registro;
        }

        // Localiza o campo personalizado pelo nome (igual, ou começando
        // por "nome " / "nome(") e traduz listas suspensas.
        private static JToken CampoPersonalizado(JArray campos, string[] nomes)
        {
            var procurados =
                nomes.Select(n => n.Trim().ToLowerInvariant()).ToList();

            var campo =
                campos.OfType<JObject>().FirstOrDefault(c =>
                {
                    var nome = (Texto(c["name"]) ?? string.Empty).Trim().ToLowerInvariant();

                    return procurados.Any(n =>
                        nome == n ||
                        nome.StartsWith(n + " ", StringComparison.Ordinal) ||
                        nome.StartsWith(n + "(", StringComparison.Ordinal));
                });

            if (campo == null)
            {
                return null;
            }

            var valor = campo["value"];

            if (Texto(campo["type"]) == "drop_down")
            {
                var opcoes = campo.SelectToken("type_config.options") as JArray;

                if (opcoes != null && valor != null)
                {
                    var bruto = Texto(valor);

                    var opcao =
                        opcoes.OfType<JObject>().FirstOrDefault(o =>
                            Texto(o["id"]) == bruto ||
                            Texto(o["orderindex"]) == bruto);

                    if (opcao != null)
                    {
                        return opcao["name"];
                    }
                }
            }

            return valor;
        }

        // Progresso: número (0–100) ou objeto { percent_complete }.
        private static double? Progresso(JToken valor)
        {
            if (valor == null || valor.Type == JTokenType.Null)
            {
                return null;
            }

            if (valor.Type == JTokenType.Object)
            {
                return Numero(valor["percent_complete"]);
            }

            return Numero(valor);
        }

        // Número: aceita 0.75, "0.75", "0,75", "1.234,56" e "1,234.56"
        // (o último separador é o decimal).
        private static double? Numero(JToken valor)
        {
            if (valor == null || valor.Type == JTokenType.Null)
            {
                return null;
            }

            if (valor.Type == JTokenType.Integer || valor.Type == JTokenType.Float)
            {
                return valor.Value<double>();
            }

            var texto = (Texto(valor) ?? string.Empty).Trim();

            if (texto.Length == 0)
            {
                return null;
            }

            var ponto = texto.LastIndexOf('.');
            var virgula = texto.LastIndexOf(',');

            string normalizado;

            if (ponto >= 0 && virgula >= 0)
            {
                normalizado =
                    ponto > virgula
                        ? texto.Replace(",", string.Empty)
                        : texto.Replace(".", string.Empty).Replace(",", ".");
            }
            else
            {
                normalizado = texto.Replace(",", ".");
            }

            double numero;

            return double.TryParse(
                normalizado,
                NumberStyles.Float,
                CultureInfo.InvariantCulture,
                out numero)
                ? numero
                : (double?)null;
        }

        private static decimal? ParaDecimal(double? valor)
        {
            if (!valor.HasValue || double.IsNaN(valor.Value) || double.IsInfinity(valor.Value))
            {
                return null;
            }

            // Limite das colunas decimais criadas pelo script.
            var limitado = Math.Max(-1000000000d, Math.Min(1000000000d, valor.Value));

            return Math.Round((decimal)limitado, 4);
        }

        // Datas do ClickUp: milissegundos desde 1970 (UTC).
        private static DateTime? ParaData(JToken valor)
        {
            var texto = Texto(valor);

            if (string.IsNullOrWhiteSpace(texto))
            {
                return null;
            }

            long ms;

            if (long.TryParse(texto, NumberStyles.Integer, CultureInfo.InvariantCulture, out ms) && ms > 0)
            {
                return new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(ms);
            }

            return null;
        }

        private static string Texto(JToken valor)
        {
            if (valor == null || valor.Type == JTokenType.Null || valor.Type == JTokenType.Undefined)
            {
                return null;
            }

            if (valor.Type == JTokenType.String)
            {
                return (string)valor;
            }

            if (valor.Type == JTokenType.Float)
            {
                return valor.Value<double>().ToString(CultureInfo.InvariantCulture);
            }

            if (valor.Type == JTokenType.Object || valor.Type == JTokenType.Array)
            {
                return valor.ToString(Formatting.None);
            }

            return Convert.ToString(((JValue)valor).Value, CultureInfo.InvariantCulture);
        }

        private static string Cortar(string valor, int maximo)
        {
            if (string.IsNullOrEmpty(valor))
            {
                return null;
            }

            return valor.Length <= maximo ? valor : valor.Substring(0, maximo);
        }

        private static IEnumerable<List<string>> Lotes(List<string> itens, int tamanho)
        {
            for (var i = 0; i < itens.Count; i += tamanho)
            {
                yield return itens.Skip(i).Take(tamanho).ToList();
            }
        }
    }
}
