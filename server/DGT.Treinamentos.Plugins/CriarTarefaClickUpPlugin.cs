using System;
using System.Collections.Generic;
using System.Globalization;
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
    // Chamada pelo portal quando o parecer é "Participar" e pelo
    // "↻ Atualizar campos" do Acompanhamento.
    //
    // PayloadJson:
    //   { "chaveEdital": "...", "nome": "...", "descricao": "markdown",
    //     "encerramentoPncp": "2026-12-10T09:00:00",  (texto do PNCP = Data Pregão;
    //                                                    sem fuso → horário de Brasília)
    //     "aberturaPncp": "...",                       (idem, campo Abertura)
    //     "prioridade": 1..4, "urgente": false,        (Urgente = SÓ prioridade 1)
    //     "tags": [...], "campos": { ... }, "atualizarCampos": false }
    //
    // ResultadoJson:
    //   { "id", "url", "existente", "camposPreenchidos", "camposComErro": [{campo, motivo}] }
    //
    // DATAS (regra em PrazosLicitacao.cs / TarefaLicitacaoClickUp.cs):
    //   - Prazos SLA = pregão − N dias úteis, com piso (acionamento + 1 du)
    //     e teto (pregão − 1 du); Impugnação respeita o limite legal.
    //   - Data de acionamento = criação da tarefa; gravada UMA vez (campo
    //     "acionamento" e coluna dgt_clickupacionamento). O "Atualizar
    //     campos" recalcula a partir dela, NUNCA de hoje.
    //   - O plugin NÃO grava due_date: o vencimento é das automações do
    //     ClickUp.
    //   - Todas as datas com horário (value_options.time = true).
    //
    // Uma tarefa por edital (dgt_clickuptarefaid / dgt_clickupurl).
    //
    // REGISTRO (Plugin Registration Tool):
    //   Message dgt_CriarTarefaClickUp · PostOperation · Synchronous
    //   Secure Configuration   = o token pessoal do ClickUp (pk_...)
    //   Unsecure Configuration = {
    //     "listId": "<id da lista>",
    //     "status": "análise",                 (coluna onde a tarefa nasce)
    //     "tags": ["licitação"],               (somadas às do portal: modalidade, UF)
    //     "diasUteis": { "analiseInicial": 7, "analiseTecnica": 6, "impugnacao": 4,
    //                    "checklist": 3, "proposta": 2, "limiteImpugnacao": 3 },
    //     "feriados": ["2026-06-29", ...],     (EXTRAS aos nacionais: municipais,
    //                                           pontos facultativos; AAAA-MM-DD)
    //     "campos": {                          (nome interno → id do campo no ClickUp)
    //       "orgaoMunicipio", "dataPregao", "acionamento", "resumo", "parecer",
    //       "prazoAnaliseInicial", "prazoAnaliseTecnica", "prazoImpugnacao",
    //       "prazoChecklist", "prazoProposta", "orgao", "municipio", "uf",
    //       "modalidade", "numero", "valorEstimado", "abertura", "encerramento",
    //       "compatibilidade", "aderencia", "plataforma", "linkPortal", "linkSharepoint"
    //     }
    //   }
    //   Campo com id vazio é ignorado. As etiquetas "sem-data-pregao" e
    //   "impugnacao-fora-do-prazo" precisam existir no space da lista.
    //
    // A descrição chega SEM CNPJ e SEM o link do PNCP; mesmo assim o
    // plugin mascara CNPJ/CPF de novo antes de enviar.
    // ================================================================
    public sealed class CriarTarefaClickUpPlugin : IPlugin
    {
        private const string TabelaAcompanhamento = "dgt_licitacaoacompanhamento";
        private const string ColunaAcionamento = "dgt_clickupacionamento";
        private const string Api = "https://api.clickup.com/api/v2";

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
        private readonly ConfiguracaoPrazos _diasUteis;
        private readonly List<DateTime> _feriados;
        private readonly bool _temFeriados;
        private readonly List<string> _avisosConfig = new List<string>();

        public CriarTarefaClickUpPlugin(string unsecureConfig, string secureConfig)
        {
            _token = (secureConfig ?? string.Empty).Trim();
            _listId = string.Empty;
            _tags = new[] { "licitação" };
            _status = string.Empty;
            _campos = new JObject();
            _diasUteis = new ConfiguracaoPrazos();
            _feriados = new List<DateTime>();

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
                    _diasUteis = TarefaLicitacaoClickUp.LerConfiguracaoPrazos(config["diasUteis"] as JObject);
                    _temFeriados = config["feriados"] is JArray;
                    _feriados = TarefaLicitacaoClickUp.LerFeriados(config["feriados"] as JArray, _avisosConfig.Add);
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

            if (!_temFeriados)
            {
                tracing.Trace("Aviso: sem a chave \"feriados\" na Configuração não segura; valem só os feriados nacionais.");
            }
            foreach (var aviso in _avisosConfig)
            {
                tracing.Trace("Aviso: {0}", aviso);
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

            // Botão "Urgente": SÓ a prioridade (não altera datas).
            var urgente = (bool?)payload["urgente"] == true;
            var prioridade = urgente ? 1 : (int?)payload["prioridade"];

            // Valores dos campos personalizados (o que faltar é completado).
            var valores = payload["campos"] as JObject ?? new JObject();
            CompletarValores(valores, payload);
            var pregao = LerPregao(payload, valores);

            var existenteId = acompanhamento.GetAttributeValue<string>("dgt_clickuptarefaid");
            if (!string.IsNullOrEmpty(existenteId))
            {
                var resultadoExistente = new JObject
                {
                    ["id"] = existenteId,
                    ["url"] = acompanhamento.GetAttributeValue<string>("dgt_clickupurl") ?? string.Empty,
                    ["existente"] = true
                };
                if ((bool?)payload["atualizarCampos"] == true)
                {
                    AtualizarTarefa(sistema, acompanhamento.Id, existenteId, valores, pregao, prioridade, resultadoExistente, tracing);
                    GravarUrgente(sistema, acompanhamento.Id, urgente, tracing);
                }
                context.OutputParameters["ResultadoJson"] = resultadoExistente.ToString(Formatting.None);
                return;
            }

            CriarTarefa(context, sistema, acompanhamento.Id, payload, nome, valores, pregao, prioridade, urgente, tracing);
        }

        // ---------------------------------------------------------------
        // Criação: TODOS os campos no MESMO POST (a automação de criação
        // do ClickUp já encontra os campos preenchidos).
        // ---------------------------------------------------------------
        private void CriarTarefa(
            IPluginExecutionContext context, IOrganizationService sistema, Guid acompanhamentoId,
            JObject payload, string nome, JObject valores, DateTimeOffset? pregao, int? prioridade, bool urgente,
            ITracingService tracing)
        {
            var erros = new JArray();
            var acionamento = DateTimeOffset.UtcNow;
            valores["acionamento"] = acionamento.ToUnixTimeMilliseconds();

            var controle = TarefaLicitacaoClickUp.AplicarDatas(valores, pregao, acionamento, _feriados, _diasUteis);

            var etiquetas = _tags
                .Concat((payload["tags"] as JArray ?? new JArray()).Select(t => ((string)t ?? string.Empty).Trim().ToLowerInvariant()))
                .ToList();
            if (controle.Adicionar.Count > 0)
            {
                var spaceId = SpaceDaLista(tracing);
                etiquetas.AddRange(EtiquetasExistentes(spaceId, controle.Adicionar, erros, tracing));
            }

            var customFields = TarefaLicitacaoClickUp.MontarCustomFields(_campos, valores, Mascarar);
            var corpo = TarefaLicitacaoClickUp.MontarCorpoCriacao(
                nome, Mascarar((string)payload["descricao"] ?? string.Empty), etiquetas, _status, prioridade, acionamento, customFields);

            int codigo;
            string conteudo;
            if (!Chamar(HttpMethod.Post, $"{Api}/list/{_listId}/task", corpo, out codigo, out conteudo))
            {
                if (codigo == 0)
                {
                    throw new InvalidPluginExecutionException("Não foi possível falar com o ClickUp agora. Tente de novo em instantes.");
                }
                tracing.Trace("ClickUp respondeu {0}: {1}", codigo, Cortar(conteudo, 500));
                var motivo = MotivoErro(conteudo);
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

            // O ClickUp ignora EM SILÊNCIO campo recusado na criação: confere
            // a resposta e grava um a um só os que não vieram preenchidos.
            var preenchidos = 0;
            var devolvidos = (tarefa["custom_fields"] as JArray ?? new JArray()).OfType<JObject>()
                .Where(c => !TarefaLicitacaoClickUp.Vazio(c["value"]))
                .Select(c => (string)c["id"])
                .ToList();
            foreach (var item in customFields.OfType<JObject>())
            {
                var idCampo = (string)item["id"];
                if (devolvidos.Contains(idCampo))
                {
                    preenchidos++;
                    continue;
                }
                var nomeCampo = _campos.Properties().First(p => ((string)p.Value ?? string.Empty).Trim() == idCampo).Name;
                if (id.Length > 0 && GravarCampo(id, nomeCampo, idCampo, valores[nomeCampo], erros, tracing))
                {
                    preenchidos++;
                }
            }

            var atualizacao = new Entity(TabelaAcompanhamento, acompanhamentoId);
            atualizacao["dgt_clickuptarefaid"] = id;
            atualizacao["dgt_clickupurl"] = url;
            sistema.Update(atualizacao);
            GravarUrgente(sistema, acompanhamentoId, urgente, tracing);
            GravarAcionamentoColuna(sistema, acompanhamentoId, acionamento, tracing);

            tracing.Trace("Tarefa {0} criada no ClickUp para o acompanhamento {1}.", id, acompanhamentoId);

            context.OutputParameters["ResultadoJson"] = new JObject
            {
                ["id"] = id,
                ["url"] = url,
                ["existente"] = false,
                ["camposPreenchidos"] = preenchidos,
                ["camposComErro"] = erros
            }.ToString(Formatting.None);
        }

        // ---------------------------------------------------------------
        // "↻ Atualizar campos": recalcula a partir da data de acionamento
        // GRAVADA (nunca de hoje) e grava campo a campo.
        // ---------------------------------------------------------------
        private void AtualizarTarefa(
            IOrganizationService sistema, Guid acompanhamentoId, string idTarefa, JObject valores,
            DateTimeOffset? pregao, int? prioridade, JObject resultado, ITracingService tracing)
        {
            var erros = new JArray();

            int codigo;
            string conteudo;
            if (!Chamar(HttpMethod.Get, $"{Api}/task/{idTarefa}", null, out codigo, out conteudo))
            {
                tracing.Trace("Leitura da tarefa {0} falhou: {1} {2}", idTarefa, codigo, Cortar(conteudo, 300));
                throw new InvalidPluginExecutionException(codigo == 404
                    ? "A tarefa não foi encontrada no ClickUp (foi excluída?)."
                    : "Não foi possível ler a tarefa no ClickUp agora. Tente de novo em instantes.");
            }
            var tarefa = JObject.Parse(conteudo);
            var camposTarefa = (tarefa["custom_fields"] as JArray ?? new JArray()).OfType<JObject>().ToList();

            string ValorAtual(string nomeCampo)
            {
                var idCampo = IdCampo(nomeCampo);
                if (idCampo.Length == 0) { return null; }
                var c = camposTarefa.FirstOrDefault(x => (string)x["id"] == idCampo);
                return c == null || TarefaLicitacaoClickUp.Vazio(c["value"]) ? null : (string)c["value"];
            }

            // Data de acionamento: coluna → campo da tarefa → criação da tarefa.
            var campoAcionamento = LerMs(ValorAtual("acionamento"));
            string origem;
            var acionamento = TarefaLicitacaoClickUp.ResolverAcionamento(
                LerAcionamentoColuna(sistema, acompanhamentoId, tracing),
                campoAcionamento,
                LerMs((string)tarefa["date_created"]),
                out origem);

            // A data de acionamento é gravada UMA vez: só preenche o campo
            // vazio (tarefa antiga) e nunca o sobrescreve.
            valores.Remove("acionamento");
            if (acionamento.HasValue)
            {
                if (!campoAcionamento.HasValue && IdCampo("acionamento").Length > 0)
                {
                    valores["acionamento"] = acionamento.Value.ToUnixTimeMilliseconds();
                }
                if (origem != "coluna")
                {
                    GravarAcionamentoColuna(sistema, acompanhamentoId, acionamento.Value, tracing);
                }
            }

            TarefaLicitacaoClickUp.Etiquetas controle = null;
            if (acionamento.HasValue)
            {
                controle = TarefaLicitacaoClickUp.AplicarDatas(valores, pregao, acionamento.Value, _feriados, _diasUteis);
            }
            else
            {
                // Sem data de acionamento não há como calcular: não mexe nos prazos.
                tracing.Trace("Tarefa {0} sem data de acionamento: prazos não recalculados.", idTarefa);
                foreach (var campo in TarefaLicitacaoClickUp.CamposCalculados) { valores.Remove(campo); }
                erros.Add(new JObject { ["campo"] = "prazos", ["motivo"] = "sem data de acionamento; prazos não recalculados" });
            }

            // Campo a campo (os vazios são ignorados aqui e limpos abaixo).
            var preenchidos = 0;
            foreach (var mapa in _campos.Properties())
            {
                var idCampo = ((string)mapa.Value ?? string.Empty).Trim();
                if (idCampo.Length == 0 || TarefaLicitacaoClickUp.Vazio(valores[mapa.Name]))
                {
                    continue;
                }
                if (GravarCampo(idTarefa, mapa.Name, idCampo, valores[mapa.Name], erros, tracing))
                {
                    preenchidos++;
                }
            }

            // Prazos que ficaram vazios (sem pregão, impugnação fora do prazo).
            if (controle != null)
            {
                foreach (var campo in TarefaLicitacaoClickUp.CamposCalculados)
                {
                    var idCampo = IdCampo(campo);
                    if (idCampo.Length == 0 || !TarefaLicitacaoClickUp.Vazio(valores[campo]) || ValorAtual(campo) == null)
                    {
                        continue;
                    }
                    if (!Chamar(HttpMethod.Delete, $"{Api}/task/{idTarefa}/field/{idCampo}", null, out codigo, out conteudo))
                    {
                        tracing.Trace("Campo {0} ({1}) não foi limpo: {2} {3}", campo, idCampo, codigo, MotivoErro(conteudo));
                        erros.Add(new JObject { ["campo"] = campo, ["motivo"] = $"não foi limpo ({codigo})" });
                    }
                }

                // Etiquetas de controle.
                var atuais = (tarefa["tags"] as JArray ?? new JArray())
                    .Select(t => ((string)t["name"] ?? string.Empty).ToLowerInvariant()).ToList();
                var faltam = controle.Adicionar.Where(t => !atuais.Contains(t)).ToList();
                if (faltam.Count > 0)
                {
                    var spaceId = (string)tarefa["space"]?["id"] ?? string.Empty;
                    foreach (var etiqueta in EtiquetasExistentes(spaceId, faltam, erros, tracing))
                    {
                        if (!Chamar(HttpMethod.Post, $"{Api}/task/{idTarefa}/tag/{Uri.EscapeDataString(etiqueta)}", null, out codigo, out conteudo))
                        {
                            tracing.Trace("Etiqueta \"{0}\" não aplicada: {1} {2}", etiqueta, codigo, MotivoErro(conteudo));
                            erros.Add(new JObject { ["campo"] = "etiqueta " + etiqueta, ["motivo"] = $"não aplicada ({codigo})" });
                        }
                    }
                }
                foreach (var etiqueta in controle.Remover.Where(atuais.Contains))
                {
                    if (!Chamar(HttpMethod.Delete, $"{Api}/task/{idTarefa}/tag/{Uri.EscapeDataString(etiqueta)}", null, out codigo, out conteudo))
                    {
                        tracing.Trace("Etiqueta \"{0}\" não removida: {1} {2}", etiqueta, codigo, MotivoErro(conteudo));
                        erros.Add(new JObject { ["campo"] = "etiqueta " + etiqueta, ["motivo"] = $"não removida ({codigo})" });
                    }
                }
            }

            // Prioridade (Urgente = 1). Sem due_date: o vencimento é do ClickUp.
            if (prioridade.HasValue && prioridade.Value >= 1 && prioridade.Value <= 4)
            {
                if (!Chamar(HttpMethod.Put, $"{Api}/task/{idTarefa}", new JObject { ["priority"] = prioridade.Value }, out codigo, out conteudo))
                {
                    tracing.Trace("Prioridade da tarefa {0} não atualizada: {1} {2}", idTarefa, codigo, MotivoErro(conteudo));
                    erros.Add(new JObject { ["campo"] = "prioridade", ["motivo"] = $"não atualizada ({codigo})" });
                }
            }

            resultado["camposPreenchidos"] = preenchidos;
            resultado["camposComErro"] = erros;
        }

        // ---------------------------------------------------------------
        // Apoio
        // ---------------------------------------------------------------

        private string IdCampo(string nome) => ((string)_campos[nome] ?? string.Empty).Trim();

        // Grava um campo (POST /task/{id}/field/{campo}); registra o motivo se recusar.
        private bool GravarCampo(string idTarefa, string nome, string idCampo, JToken valor, JArray erros, ITracingService tracing)
        {
            var corpo = TarefaLicitacaoClickUp.MontarValorCampo(nome, valor, Mascarar);
            int codigo;
            string conteudo;
            if (Chamar(HttpMethod.Post, $"{Api}/task/{idTarefa}/field/{idCampo}", corpo, out codigo, out conteudo))
            {
                return true;
            }
            var motivo = codigo == 0 ? "falha de rede" : $"{codigo} {MotivoErro(conteudo)}".Trim();
            tracing.Trace("Campo {0} ({1}) recusado: {2}", nome, idCampo, motivo);
            erros.Add(new JObject { ["campo"] = nome, ["motivo"] = motivo });
            return false;
        }

        private string SpaceDaLista(ITracingService tracing)
        {
            int codigo;
            string conteudo;
            if (Chamar(HttpMethod.Get, $"{Api}/list/{_listId}", null, out codigo, out conteudo))
            {
                return (string)JObject.Parse(conteudo)["space"]?["id"] ?? string.Empty;
            }
            tracing.Trace("Leitura da lista {0} falhou: {1} {2}", _listId, codigo, MotivoErro(conteudo));
            return string.Empty;
        }

        // Só devolve as etiquetas que JÁ existem no space (não depende da
        // criação automática pela API). As que faltam viram erro claro.
        private List<string> EtiquetasExistentes(string spaceId, IEnumerable<string> desejadas, JArray erros, ITracingService tracing)
        {
            var lista = desejadas.ToList();
            var existentes = new List<string>();
            int codigo;
            string conteudo;
            if (spaceId.Length > 0 && Chamar(HttpMethod.Get, $"{Api}/space/{spaceId}/tag", null, out codigo, out conteudo))
            {
                existentes = (JObject.Parse(conteudo)["tags"] as JArray ?? new JArray())
                    .Select(t => ((string)t["name"] ?? string.Empty).ToLowerInvariant()).ToList();
            }
            else
            {
                tracing.Trace("ERRO: não foi possível ler as etiquetas do space \"{0}\"; etiquetas de controle não aplicadas: {1}.",
                    spaceId, string.Join(", ", lista));
                foreach (var etiqueta in lista)
                {
                    erros.Add(new JObject { ["campo"] = "etiqueta " + etiqueta, ["motivo"] = "não foi possível conferir as etiquetas do space" });
                }
                return new List<string>();
            }

            var ok = new List<string>();
            foreach (var etiqueta in lista)
            {
                if (existentes.Contains(etiqueta.ToLowerInvariant()))
                {
                    ok.Add(etiqueta);
                    continue;
                }
                tracing.Trace("ERRO: a etiqueta \"{0}\" não existe no space {1} do ClickUp. Cadastre-a no space Licitações; ela não foi aplicada.", etiqueta, spaceId);
                erros.Add(new JObject { ["campo"] = "etiqueta " + etiqueta, ["motivo"] = "não existe no space do ClickUp (cadastre-a)" });
            }
            return ok;
        }

        // Pregão = encerramento das propostas do PNCP (texto, horário de
        // Brasília). Portal antigo: aceita o valor em ms de "campos".
        private static DateTimeOffset? LerPregao(JObject payload, JObject valores)
        {
            var pregao = PrazosLicitacao.LerDataPncp((string)payload["encerramentoPncp"]);
            if (!pregao.HasValue)
            {
                var ms = LerMs(valores["dataPregao"]) ?? LerMs(valores["encerramento"]);
                if (ms.HasValue && ms.Value > 0)
                {
                    pregao = DateTimeOffset.FromUnixTimeMilliseconds(ms.Value);
                }
            }

            valores["encerramento"] = pregao.HasValue ? (JToken)pregao.Value.ToUnixTimeMilliseconds() : null;
            var abertura = PrazosLicitacao.LerDataPncp((string)payload["aberturaPncp"]);
            if (abertura.HasValue)
            {
                valores["abertura"] = abertura.Value.ToUnixTimeMilliseconds();
            }
            return pregao;
        }

        private static long? LerMs(JToken valor)
        {
            if (TarefaLicitacaoClickUp.Vazio(valor)) { return null; }
            if (valor.Type == JTokenType.Integer || valor.Type == JTokenType.Float) { return (long)valor; }
            return LerMs((string)valor);
        }

        private static long? LerMs(string texto)
        {
            long ms;
            return long.TryParse((texto ?? string.Empty).Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out ms) && ms > 0
                ? ms
                : (long?)null;
        }

        private static DateTimeOffset? LerAcionamentoColuna(IOrganizationService sistema, Guid acompanhamentoId, ITracingService tracing)
        {
            try
            {
                var registro = sistema.Retrieve(TabelaAcompanhamento, acompanhamentoId, new ColumnSet(ColunaAcionamento));
                var data = registro.GetAttributeValue<DateTime?>(ColunaAcionamento);
                return data.HasValue ? new DateTimeOffset(DateTime.SpecifyKind(data.Value, DateTimeKind.Utc)) : (DateTimeOffset?)null;
            }
            catch (Exception ex)
            {
                tracing.Trace("{0} não lida (a coluna existe?): {1}", ColunaAcionamento, ex.Message);
                return null;
            }
        }

        private static void GravarAcionamentoColuna(IOrganizationService sistema, Guid acompanhamentoId, DateTimeOffset acionamento, ITracingService tracing)
        {
            try
            {
                var registro = new Entity(TabelaAcompanhamento, acompanhamentoId);
                registro[ColunaAcionamento] = acionamento.UtcDateTime;
                sistema.Update(registro);
            }
            catch (Exception ex)
            {
                tracing.Trace("{0} não gravada (a coluna existe?): {1}", ColunaAcionamento, ex.Message);
            }
        }

        // Guarda no acompanhamento se a tarefa está como urgente (prioridade).
        private static void GravarUrgente(IOrganizationService sistema, Guid acompanhamentoId, bool urgente, ITracingService tracing)
        {
            try
            {
                var registro = new Entity(TabelaAcompanhamento, acompanhamentoId);
                registro["dgt_clickupurgente"] = urgente;
                sistema.Update(registro);
            }
            catch (Exception ex)
            {
                tracing.Trace("dgt_clickupurgente não gravado (a coluna existe?): {0}", ex.Message);
            }
        }

        // Completa campos de texto que o portal não mandou (versões antigas).
        private static void CompletarValores(JObject v, JObject payload)
        {
            string Texto(string chave) => ((string)v[chave] ?? string.Empty).Trim();

            if (Texto("orgaoMunicipio").Length == 0 && Texto("orgao").Length > 0)
            {
                var local = Texto("municipio") + (Texto("uf").Length > 0 ? "/" + Texto("uf") : string.Empty);
                v["orgaoMunicipio"] = Texto("orgao") + (local.Length > 0 ? " — " + local : string.Empty);
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

        // Chamada à API do ClickUp. Nunca lança por status HTTP; codigo = 0
        // em falha de rede. O token vai só no cabeçalho (nunca em log/URL).
        private bool Chamar(HttpMethod metodo, string url, JObject corpo, out int codigo, out string conteudo)
        {
            codigo = 0;
            conteudo = string.Empty;
            try
            {
                using (var requisicao = new HttpRequestMessage(metodo, url))
                {
                    requisicao.Headers.TryAddWithoutValidation("Authorization", _token);
                    if (corpo != null)
                    {
                        requisicao.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");
                    }
                    using (var resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult())
                    {
                        codigo = (int)resposta.StatusCode;
                        conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult() ?? string.Empty;
                        return resposta.IsSuccessStatusCode;
                    }
                }
            }
            catch (Exception ex)
            {
                conteudo = ex.Message;
                return false;
            }
        }

        private static string MotivoErro(string conteudo)
        {
            try { return (string)JObject.Parse(conteudo)["err"] ?? string.Empty; }
            catch (JsonException) { return Cortar(conteudo, 150); }
        }

        private static string Cortar(string texto, int tamanho) =>
            string.IsNullOrEmpty(texto) ? string.Empty : texto.Length > tamanho ? texto.Substring(0, tamanho) : texto;

        private static string Mascarar(string texto) =>
            Cpf.Replace(Cnpj.Replace(texto ?? string.Empty, "[dado removido]"), "[dado removido]");
    }
}
