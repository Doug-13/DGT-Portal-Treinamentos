using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // REGRAS DO ENVIO BOM → CIGAM (webhook MAAX, Homologação)
    //
    // Sem dependência do Dataverse: monta e valida o corpo do webhook a
    // partir da lista CONGELADA no envio para aprovação
    // (dgt_bom_selecaokit.bomEnviado) e decide se um envio anterior
    // bloqueia um novo. Coberto por BomCigamTests.
    //
    // Corpo (guia "Integração BOM → CIGAM (Homologação)"):
    //   { bom, revisao, unidade_negocio, cliente_cigam, representante,
    //     controle, previsao_venda: "AAAA-MM-DD",
    //     itens: [ { codigo, quantidade, valor_unitario_bom } ] }
    // ================================================================
    public static class BomCigam
    {
        private static readonly Regex Codigo = new Regex(@"^[0-9A-Za-z.\-]{1,30}$", RegexOptions.Compiled);
        private static readonly Regex Controle = new Regex(@"^[0-9A-Za-z]{1,10}$", RegexOptions.Compiled);

        public sealed class Parametros
        {
            public string Bom = string.Empty;
            public string Revisao = string.Empty;
            public string Titulo = string.Empty;
            public string ClienteCigam = string.Empty;
            public string Representante = string.Empty;
            public string UnidadeNegocio = string.Empty;
            public string Controle = string.Empty;
            public string PrevisaoVenda = string.Empty;
        }

        public sealed class Resultado
        {
            public JObject Corpo;
            public readonly List<string> Erros = new List<string>();
            public int Itens;
            public decimal ValorTotal;
        }

        public static Resultado MontarCorpo(string selecaoKitJson, Parametros p, DateTime hoje)
        {
            var r = new Resultado();

            if (!Codigo.IsMatch(p.ClienteCigam ?? string.Empty))
            {
                r.Erros.Add("A demanda não tem o código do cliente no CIGAM (cadastro da demanda › Código CIGAM).");
            }
            if (!Codigo.IsMatch(p.Representante ?? string.Empty))
            {
                r.Erros.Add("Informe o código do representante no CIGAM.");
            }
            if (!Codigo.IsMatch(p.UnidadeNegocio ?? string.Empty))
            {
                r.Erros.Add("Informe a unidade de negócio (ex.: 001).");
            }
            if (!Controle.IsMatch(p.Controle ?? string.Empty))
            {
                r.Erros.Add("Informe o controle da oportunidade (ex.: NA).");
            }
            DateTime previsao;
            if (!DateTime.TryParseExact(p.PrevisaoVenda ?? string.Empty, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out previsao))
            {
                r.Erros.Add("Informe a previsão de venda no formato AAAA-MM-DD.");
            }
            else if (previsao.Date < hoje.Date)
            {
                r.Erros.Add("A previsão de venda não pode estar no passado.");
            }

            JObject enviado = null;
            try
            {
                var selecao = string.IsNullOrWhiteSpace(selecaoKitJson) ? null : JObject.Parse(selecaoKitJson);
                enviado = selecao == null ? null : selecao["bomEnviado"] as JObject;
            }
            catch (Newtonsoft.Json.JsonException)
            {
                enviado = null;
            }
            if (enviado == null)
            {
                r.Erros.Add("O B.O.M. ainda não foi enviado para aprovação: só a lista congelada pode ser lançada no CIGAM.");
                return r;
            }

            var precos = enviado["precos"] as JObject ?? new JObject();
            var itens = enviado["itens"] as JArray ?? new JArray();

            // Consolida por código (o mesmo material pode vir de pontos diferentes).
            var ordem = new List<string>();
            var quantidades = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            var semCodigo = new List<string>();
            var semPreco = new List<string>();

            foreach (var item in itens.OfType<JObject>())
            {
                var codigo = ((string)item["codigo"] ?? string.Empty).Trim();
                var descricao = ((string)item["descricao"] ?? string.Empty).Trim();
                var quantidade = item["quantidade"] != null && item["quantidade"].Type != JTokenType.Null ? (decimal)item["quantidade"] : 0m;
                var pendente = item["pendente"] != null && item["pendente"].Type == JTokenType.Boolean && (bool)item["pendente"];

                if (quantidade <= 0)
                {
                    continue;
                }
                if (pendente || !Codigo.IsMatch(codigo))
                {
                    semCodigo.Add(descricao.Length > 0 ? descricao : "(item sem descrição)");
                    continue;
                }
                var preco = precos[codigo];
                if (preco == null || preco.Type == JTokenType.Null || (preco.Type != JTokenType.Integer && preco.Type != JTokenType.Float))
                {
                    if (!semPreco.Contains(codigo)) { semPreco.Add(codigo); }
                    continue;
                }
                if (!quantidades.ContainsKey(codigo))
                {
                    ordem.Add(codigo);
                    quantidades[codigo] = 0m;
                }
                quantidades[codigo] += quantidade;
            }

            if (semCodigo.Count > 0)
            {
                r.Erros.Add($"{semCodigo.Count} item(ns) sem código no CIGAM: {string.Join("; ", semCodigo.Take(5))}{(semCodigo.Count > 5 ? "…" : "")}");
            }
            if (semPreco.Count > 0)
            {
                r.Erros.Add($"{semPreco.Count} item(ns) sem valor do CIGAM: {string.Join(", ", semPreco.Take(10))}{(semPreco.Count > 10 ? "…" : "")}");
            }
            if (ordem.Count == 0 && semCodigo.Count == 0 && semPreco.Count == 0)
            {
                r.Erros.Add("A lista congelada não tem itens.");
            }
            if (r.Erros.Count > 0)
            {
                return r;
            }

            var lista = new JArray();
            foreach (var codigo in ordem)
            {
                var valor = Math.Round((decimal)precos[codigo], 2);
                lista.Add(new JObject
                {
                    ["codigo"] = codigo,
                    ["quantidade"] = quantidades[codigo] == Math.Floor(quantidades[codigo]) ? (JToken)(long)quantidades[codigo] : quantidades[codigo],
                    ["valor_unitario_bom"] = valor
                });
                r.ValorTotal += valor * quantidades[codigo];
            }

            r.Itens = lista.Count;
            r.Corpo = new JObject
            {
                ["bom"] = p.Bom,
                ["revisao"] = p.Revisao,
                ["titulo"] = string.IsNullOrWhiteSpace(p.Titulo) ? null : p.Titulo,
                ["unidade_negocio"] = p.UnidadeNegocio,
                ["cliente_cigam"] = p.ClienteCigam,
                ["representante"] = p.Representante,
                ["controle"] = p.Controle.ToUpperInvariant(),
                ["previsao_venda"] = p.PrevisaoVenda,
                ["itens"] = lista
            };
            return r;
        }

        // O webhook não tem proteção contra repetição: um envio aceito (2xx)
        // ou de resultado desconhecido (sem resposta) bloqueia um novo, que
        // só segue com "reenviar" e justificativa.
        public static JObject EnvioQueBloqueia(JArray envios)
        {
            if (envios == null) { return null; }
            return envios.OfType<JObject>()
                .LastOrDefault(e => (string)e["situacao"] == "recebido" || (string)e["situacao"] == "indeterminado");
        }

        public static string Situacao(int codigoHttp) =>
            codigoHttp >= 200 && codigoHttp < 300 ? "recebido"
            : codigoHttp == 0 ? "indeterminado"
            : "recusado";
    }
}
