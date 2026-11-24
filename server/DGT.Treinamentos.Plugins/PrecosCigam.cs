using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // REGRAS PURAS da consulta de preços no CIGAM (sem Dataverse).
    //
    // Usadas por AtualizarValoresCigamPlugin e testadas em
    // DGT.Treinamentos.Plugins.Tests (PrecosCigamTests).
    //
    // Comportamento da API (docs/APIs_CIGAM_Consulta_Precos.md):
    //   - O código do material vai SEM máscara: 490.010.0018 → 4900100018.
    //   - PrecosTabela/Buscar devolve uma linha por tabela de preço.
    //   - O CIGAM mistura códigos de tabela com e sem zero à esquerda
    //     ("068" e "70"): a tabela é escolhida aqui, não no $filter.
    //   - Tabelas com preço zerado NÃO voltam na lista: "sem tabela" e
    //     "preço zerado" são indistinguíveis.
    //   - Campos CHAR vêm completados com espaços à direita.
    // ================================================================
    public sealed class EscolhaPreco
    {
        public decimal? Valor { get; set; }
        public string Tabela { get; set; } = string.Empty;
        public string DescricaoTabela { get; set; } = string.Empty;
        public DateTime? VigenteAte { get; set; }

        // Vazio quando achou preço; senão, o motivo (vai para dgt_valorsituacao).
        public string Motivo { get; set; } = string.Empty;

        // Texto curto para dgt_valororigem.
        public string Origem
        {
            get
            {
                if (!Valor.HasValue)
                {
                    return string.Empty;
                }
                var texto = "CIGAM — tabela " + Tabela + (DescricaoTabela.Length > 0 ? " " + DescricaoTabela : string.Empty);
                if (VigenteAte.HasValue)
                {
                    texto += " (vigente até " + VigenteAte.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) + ")";
                }
                return texto.Length > 200 ? texto.Substring(0, 200) : texto;
            }
        }
    }

    public static class PrecosCigam
    {
        // Só dígitos. "310.005.0082" → "3100050082"; "a levantar" → "".
        // Código vazio = item NÃO é consultado.
        public static string NormalizarCodigo(string codigo)
        {
            if (string.IsNullOrWhiteSpace(codigo))
            {
                return string.Empty;
            }
            var digitos = new string(codigo.Where(char.IsDigit).ToArray());
            // Código CIGAM de material tem 10 dígitos; menos que isso é
            // texto com número solto ("item 2"), não um código.
            return digitos.Length >= 6 ? digitos : string.Empty;
        }

        // "068" e "68" são a mesma tabela.
        public static string NormalizarTabela(string tabela)
        {
            var t = (tabela ?? string.Empty).Trim().TrimStart('0');
            return t.Length == 0 ? "0" : t;
        }

        // Valor seguro para dentro de aspas simples no $filter OData.
        public static string Escapar(string valor) => (valor ?? string.Empty).Replace("'", "''");

        public static EscolhaPreco Escolher(JArray linhas, IList<string> tabelasDesejadas, DateTime hoje)
        {
            var desejadas = (tabelasDesejadas ?? new List<string>())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(NormalizarTabela)
                .ToList();

            var precos = (linhas ?? new JArray())
                .OfType<JObject>()
                .Select(Ler)
                .ToList();

            if (precos.Count == 0)
            {
                return new EscolhaPreco { Motivo = "Sem tabela de preço no CIGAM (ou preço zerado na tabela)." };
            }

            var dia = hoje.Date;
            Func<LinhaPreco, bool> vigente = p =>
                (!p.Inicio.HasValue || p.Inicio.Value.Date <= dia) &&
                (!p.Fim.HasValue || p.Fim.Value.Date >= dia);

            foreach (var tabela in desejadas)
            {
                var daTabela = precos.Where(p => p.TabelaNormalizada == tabela).ToList();
                var validas = daTabela
                    .Where(p => p.Preco > 0 && vigente(p))
                    .OrderByDescending(p => p.Inicio ?? DateTime.MinValue)
                    .ToList();

                if (validas.Count > 0)
                {
                    var p = validas[0];
                    return new EscolhaPreco
                    {
                        Valor = p.Preco,
                        Tabela = p.Tabela,
                        DescricaoTabela = p.Descricao,
                        VigenteAte = p.Fim
                    };
                }
            }

            // Nenhuma tabela desejada com preço vigente: explica o motivo.
            var primeira = desejadas.FirstOrDefault() ?? "?";
            var vencidas = precos
                .Where(p => desejadas.Contains(p.TabelaNormalizada) && p.Fim.HasValue && p.Fim.Value.Date < dia)
                .OrderByDescending(p => p.Fim)
                .ToList();
            if (vencidas.Count > 0)
            {
                return new EscolhaPreco
                {
                    Motivo = "Tabela " + vencidas[0].Tabela + " vencida em " +
                             vencidas[0].Fim.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) + "."
                };
            }

            var futuras = precos
                .Where(p => desejadas.Contains(p.TabelaNormalizada) && p.Inicio.HasValue && p.Inicio.Value.Date > dia)
                .OrderBy(p => p.Inicio)
                .ToList();
            if (futuras.Count > 0)
            {
                return new EscolhaPreco
                {
                    Motivo = "Tabela " + futuras[0].Tabela + " só vale a partir de " +
                             futuras[0].Inicio.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) + "."
                };
            }

            var outras = precos.Select(p => p.Tabela).Distinct().OrderBy(t => t).ToList();
            return new EscolhaPreco
            {
                Motivo = "Não está na tabela " + primeira + ". Tabelas do item no CIGAM: " + string.Join(", ", outras) + "."
            };
        }

        private sealed class LinhaPreco
        {
            public string Tabela;
            public string TabelaNormalizada;
            public string Descricao;
            public decimal Preco;
            public DateTime? Inicio;
            public DateTime? Fim;
        }

        private static LinhaPreco Ler(JObject o)
        {
            var tabela = Texto(o, "CodigoTabela");
            return new LinhaPreco
            {
                Tabela = tabela,
                TabelaNormalizada = NormalizarTabela(tabela),
                Descricao = Texto(o, "DescricaoTabela"),
                Preco = Numero(o["PrecoUnitario"]),
                Inicio = Data(o["ValidadeInicial"]),
                Fim = Data(o["ValidadeFinal"])
            };
        }

        private static string Texto(JObject o, string campo)
        {
            var t = o[campo];
            return t == null || t.Type == JTokenType.Null ? string.Empty : t.ToString().Trim();
        }

        private static decimal Numero(JToken t)
        {
            if (t == null || t.Type == JTokenType.Null)
            {
                return 0m;
            }
            if (t.Type == JTokenType.Float || t.Type == JTokenType.Integer)
            {
                return t.Value<decimal>();
            }
            decimal valor;
            return decimal.TryParse(t.ToString().Trim(), NumberStyles.Any, CultureInfo.InvariantCulture, out valor) ? valor : 0m;
        }

        private static DateTime? Data(JToken t)
        {
            if (t == null || t.Type == JTokenType.Null)
            {
                return null;
            }
            if (t.Type == JTokenType.Date)
            {
                return t.Value<DateTime>();
            }
            DateTime data;
            return DateTime.TryParse(t.ToString().Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out data)
                ? data
                : (DateTime?)null;
        }
    }
}
