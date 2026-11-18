using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // Regras PURAS da tarefa de licitação no ClickUp (sem HTTP/Dataverse),
    // usadas pelo CriarTarefaClickUpPlugin e testadas em
    // server/DGT.Treinamentos.Plugins.Tests.
    //
    // O plugin NÃO grava due_date/due_date_time: o vencimento é das
    // automações do ClickUp (copiam o prazo do status atual).
    // ================================================================
    public static class TarefaLicitacaoClickUp
    {
        public const string EtiquetaSemDataPregao = "sem-data-pregao";
        public const string EtiquetaImpugnacaoForaDoPrazo = "impugnacao-fora-do-prazo";

        // Campos de data: sempre com horário (value_options.time = true).
        public static readonly string[] CamposData =
        {
            "abertura", "encerramento", "dataPregao", "acionamento",
            "prazoAnaliseInicial", "prazoAnaliseTecnica", "prazoImpugnacao", "prazoChecklist", "prazoProposta"
        };

        // Campos que o cálculo controla (vazio = o campo deve ficar vazio).
        public static readonly string[] CamposCalculados =
        {
            "dataPregao", "prazoAnaliseInicial", "prazoAnaliseTecnica", "prazoImpugnacao", "prazoChecklist", "prazoProposta"
        };

        public sealed class Etiquetas
        {
            public List<string> Adicionar { get; } = new List<string>();
            public List<string> Remover { get; } = new List<string>();
        }

        // Preenche dataPregao e os prazos em "valores" (ms UTC; null = vazio)
        // e diz quais etiquetas de controle a tarefa deve ter ou não ter.
        public static Etiquetas AplicarDatas(
            JObject valores,
            DateTimeOffset? pregao,
            DateTimeOffset acionamento,
            IEnumerable<DateTime> feriadosExtras,
            ConfiguracaoPrazos config)
        {
            var etiquetas = new Etiquetas();

            if (!pregao.HasValue)
            {
                foreach (var campo in CamposCalculados)
                {
                    valores[campo] = null;
                }
                etiquetas.Adicionar.Add(EtiquetaSemDataPregao);
                etiquetas.Remover.Add(EtiquetaImpugnacaoForaDoPrazo);
                return etiquetas;
            }

            var r = PrazosLicitacao.Calcular(pregao.Value, acionamento, feriadosExtras, config);
            valores["dataPregao"] = pregao.Value.ToUnixTimeMilliseconds();
            valores["prazoAnaliseInicial"] = r.AnaliseInicial.ToUnixTimeMilliseconds();
            valores["prazoAnaliseTecnica"] = r.AnaliseTecnica.ToUnixTimeMilliseconds();
            valores["prazoImpugnacao"] = r.Impugnacao.HasValue ? (JToken)r.Impugnacao.Value.ToUnixTimeMilliseconds() : null;
            valores["prazoChecklist"] = r.Checklist.ToUnixTimeMilliseconds();
            valores["prazoProposta"] = r.Proposta.ToUnixTimeMilliseconds();

            etiquetas.Remover.Add(EtiquetaSemDataPregao);
            (r.ImpugnacaoForaDoPrazo ? etiquetas.Adicionar : etiquetas.Remover).Add(EtiquetaImpugnacaoForaDoPrazo);
            return etiquetas;
        }

        public static bool Vazio(JToken valor) =>
            valor == null || valor.Type == JTokenType.Null ||
            (valor.Type == JTokenType.String && ((string)valor).Trim().Length == 0);

        // custom_fields do POST de criação: um item por campo mapeado
        // (id configurado) com valor.
        public static JArray MontarCustomFields(JObject mapaCampos, JObject valores, Func<string, string> mascarar)
        {
            var lista = new JArray();
            foreach (var mapa in mapaCampos.Properties())
            {
                var idCampo = ((string)mapa.Value ?? string.Empty).Trim();
                var valor = valores[mapa.Name];
                if (idCampo.Length == 0 || Vazio(valor))
                {
                    continue;
                }
                lista.Add(MontarValorCampo(mapa.Name, valor, mascarar, idCampo));
            }
            return lista;
        }

        // { ["id"], "value", ["value_options"] } de um campo.
        public static JObject MontarValorCampo(string nome, JToken valor, Func<string, string> mascarar, string idCampo = null)
        {
            var item = new JObject();
            if (idCampo != null)
            {
                item["id"] = idCampo;
            }
            item["value"] = valor.Type == JTokenType.String && mascarar != null ? (JToken)mascarar((string)valor) : valor;
            if (CamposData.Contains(nome))
            {
                item["value_options"] = new JObject { ["time"] = true };
            }
            return item;
        }

        // Corpo do POST /list/{id}/task. Sem due_date (regra do ClickUp).
        public static JObject MontarCorpoCriacao(
            string nome,
            string descricao,
            IEnumerable<string> etiquetas,
            string status,
            int? prioridade,
            DateTimeOffset acionamento,
            JArray customFields)
        {
            var corpo = new JObject
            {
                ["name"] = nome.Length > 250 ? nome.Substring(0, 250) : nome,
                ["markdown_description"] = descricao ?? string.Empty,
                ["tags"] = new JArray(etiquetas.Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().Take(10)),
                // Início = acionamento, com horário (nunca data sem hora).
                ["start_date"] = acionamento.ToUnixTimeMilliseconds(),
                ["start_date_time"] = true,
                ["custom_fields"] = customFields ?? new JArray()
            };
            if (!string.IsNullOrEmpty(status))
            {
                corpo["status"] = status;
            }
            if (prioridade.HasValue && prioridade.Value >= 1 && prioridade.Value <= 4)
            {
                corpo["priority"] = prioridade.Value;
            }
            return corpo;
        }

        // Data de acionamento de uma tarefa que JÁ existe, nesta ordem:
        // coluna do acompanhamento → campo da tarefa → criação da tarefa.
        // NUNCA a data de hoje (esconderia o atraso real).
        public static DateTimeOffset? ResolverAcionamento(DateTimeOffset? coluna, long? campoTarefaMs, long? criacaoTarefaMs, out string origem)
        {
            if (coluna.HasValue)
            {
                origem = "coluna";
                return coluna.Value;
            }
            if (campoTarefaMs.HasValue && campoTarefaMs.Value > 0)
            {
                origem = "campo";
                return DateTimeOffset.FromUnixTimeMilliseconds(campoTarefaMs.Value);
            }
            if (criacaoTarefaMs.HasValue && criacaoTarefaMs.Value > 0)
            {
                origem = "criacao";
                return DateTimeOffset.FromUnixTimeMilliseconds(criacaoTarefaMs.Value);
            }
            origem = string.Empty;
            return null;
        }

        // Lê "feriados": ["AAAA-MM-DD", ...]; ignora o que não for data.
        public static List<DateTime> LerFeriados(JArray lista, Action<string> aviso)
        {
            var datas = new List<DateTime>();
            if (lista == null)
            {
                return datas;
            }
            foreach (var item in lista)
            {
                var texto = ((string)item ?? string.Empty).Trim();
                if (DateTime.TryParseExact(texto, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.None, out var data))
                {
                    datas.Add(data.Date);
                }
                else
                {
                    aviso?.Invoke($"Feriado ignorado (use AAAA-MM-DD): \"{texto}\"");
                }
            }
            return datas;
        }

        // Lê "diasUteis": { analiseInicial, analiseTecnica, impugnacao,
        // checklist, proposta, limiteImpugnacao } (padrões 7/6/4/3/2/3).
        public static ConfiguracaoPrazos LerConfiguracaoPrazos(JObject dias)
        {
            var cfg = new ConfiguracaoPrazos();
            if (dias == null)
            {
                return cfg;
            }
            int Ler(string chave, int padrao)
            {
                var v = (int?)dias[chave];
                return v.HasValue && v.Value >= 0 ? v.Value : padrao;
            }
            cfg.AnaliseInicial = Ler("analiseInicial", cfg.AnaliseInicial);
            cfg.AnaliseTecnica = Ler("analiseTecnica", cfg.AnaliseTecnica);
            cfg.Impugnacao = Ler("impugnacao", cfg.Impugnacao);
            cfg.Checklist = Ler("checklist", cfg.Checklist);
            cfg.Proposta = Ler("proposta", cfg.Proposta);
            cfg.LimiteImpugnacao = Ler("limiteImpugnacao", cfg.LimiteImpugnacao);
            return cfg;
        }
    }
}
