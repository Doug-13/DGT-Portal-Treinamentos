using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // PRAZOS (SLA) DA TAREFA DE LICITAÇÃO NO CLICKUP — regra única
    //
    // Código PURO (sem Dataverse/HTTP): testado em
    // server/DGT.Treinamentos.Plugins.Tests.
    //
    // du = dia útil: segunda a sexta, fora
    //   - feriados nacionais (SEMPRE): 01/01, 21/04, 01/05, 07/09, 12/10,
    //     02/11, 15/11, 20/11, 25/12 + Carnaval (seg e ter), Sexta-feira
    //     Santa e Corpus Christi (calculados pela Páscoa);
    //   - datas EXTRAS da configuração ("feriados": municipais, pontos
    //     facultativos...).
    //
    // Datas comparadas por DIA de calendário em America/Sao_Paulo.
    //
    // Marcos (exceto Impugnação), N = dias da configuração:
    //   base = pregão − N du;  piso = acionamento + 1 du;  teto = pregão − 1 du
    //   prazo = min(max(base, piso), teto)   (piso > teto → teto)
    //
    // Impugnação:
    //   limiteLegal = pregão − LimiteImpugnacao du
    //   acionamento > limiteLegal → SEM prazo (fora do prazo legal)
    //   senão prazo = min(max(pregão − N du, acionamento + 1 du), limiteLegal)
    //
    // Todos os prazos às 18:00 (horário de Brasília).
    // ================================================================

    public sealed class ConfiguracaoPrazos
    {
        public int AnaliseInicial { get; set; } = 7;
        public int AnaliseTecnica { get; set; } = 6;
        public int Impugnacao { get; set; } = 4;
        public int Checklist { get; set; } = 3;
        public int Proposta { get; set; } = 2;
        // Dias úteis do limite legal de impugnação.
        public int LimiteImpugnacao { get; set; } = 3;
    }

    public sealed class ResultadoPrazos
    {
        public DateTimeOffset AnaliseInicial { get; set; }
        public DateTimeOffset AnaliseTecnica { get; set; }
        // null = fora do prazo legal (não grava o campo).
        public DateTimeOffset? Impugnacao { get; set; }
        public DateTimeOffset Checklist { get; set; }
        public DateTimeOffset Proposta { get; set; }
        public DateTimeOffset LimiteLegalImpugnacao { get; set; }
        public bool ImpugnacaoForaDoPrazo { get; set; }
    }

    public static class PrazosLicitacao
    {
        public const int HoraPrazo = 18;

        // America/Sao_Paulo (Windows: "E. South America Standard Time").
        // Sem o fuso no servidor: −03:00 fixo (sem horário de verão desde 2019).
        public static readonly TimeZoneInfo Fuso = ObterFuso();

        private static TimeZoneInfo ObterFuso()
        {
            foreach (var id in new[] { "E. South America Standard Time", "America/Sao_Paulo" })
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
                catch (Exception) { /* tenta o próximo */ }
            }
            return TimeZoneInfo.CreateCustomTimeZone("BRT", TimeSpan.FromHours(-3), "Brasília", "Brasília");
        }

        // Data/hora "de parede" em Brasília → instante com o deslocamento certo.
        public static DateTimeOffset EmBrasilia(DateTime local)
        {
            var semTipo = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            return new DateTimeOffset(semTipo, Fuso.GetUtcOffset(semTipo));
        }

        // Dia de calendário (em Brasília) de um instante.
        public static DateTime DiaEmBrasilia(DateTimeOffset instante) =>
            TimeZoneInfo.ConvertTime(instante, Fuso).Date;

        // Texto de data do PNCP ("2026-12-10T09:00:00", sem fuso) → instante,
        // interpretado como horário de Brasília. Com fuso explícito, respeita.
        public static DateTimeOffset? LerDataPncp(string texto)
        {
            var t = (texto ?? string.Empty).Trim();
            if (t.Length == 0)
            {
                return null;
            }
            var temFuso = t.EndsWith("Z", StringComparison.OrdinalIgnoreCase) ||
                          (t.Length > 19 && (t.LastIndexOf('+') > 10 || t.LastIndexOf('-') > 10));
            if (temFuso && DateTimeOffset.TryParse(t, CultureInfo.InvariantCulture, DateTimeStyles.None, out var comFuso))
            {
                return comFuso;
            }
            if (DateTime.TryParse(t, CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
            {
                return EmBrasilia(local);
            }
            return null;
        }

        // ---------------- Dias úteis ----------------

        public static bool EhFeriadoNacional(DateTime dia)
        {
            var d = dia.Date;
            var fixos = new[] { "1-1", "4-21", "5-1", "9-7", "10-12", "11-2", "11-15", "11-20", "12-25" };
            if (fixos.Contains($"{d.Month}-{d.Day}"))
            {
                return true;
            }
            var pascoa = Pascoa(d.Year);
            // Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi.
            return new[] { -48, -47, -2, 60 }.Any(desloc => pascoa.AddDays(desloc) == d);
        }

        public static bool EhDiaUtil(DateTime dia, ICollection<DateTime> extras)
        {
            var d = dia.Date;
            if (d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
            {
                return false;
            }
            return !EhFeriadoNacional(d) && !(extras != null && extras.Contains(d));
        }

        public static DateTime SubtrairDiasUteis(DateTime dia, int dias, ICollection<DateTime> extras)
        {
            var d = dia.Date;
            while (dias > 0)
            {
                d = d.AddDays(-1);
                if (EhDiaUtil(d, extras)) { dias--; }
            }
            return d;
        }

        public static DateTime SomarDiasUteis(DateTime dia, int dias, ICollection<DateTime> extras)
        {
            var d = dia.Date;
            while (dias > 0)
            {
                d = d.AddDays(1);
                if (EhDiaUtil(d, extras)) { dias--; }
            }
            return d;
        }

        // Domingo de Páscoa (Meeus/Jones/Butcher).
        public static DateTime Pascoa(int ano)
        {
            int a = ano % 19, b = ano / 100, c = ano % 100, d = b / 4, e = b % 4;
            int f = (b + 8) / 25, g = (b - f + 1) / 3, h = (19 * a + b - d - g + 15) % 30;
            int i = c / 4, k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = (a + 11 * h + 22 * l) / 451;
            int mes = (h + l - 7 * m + 114) / 31, diaMes = ((h + l - 7 * m + 114) % 31) + 1;
            return new DateTime(ano, mes, diaMes);
        }

        // ---------------- Cálculo ----------------

        public static ResultadoPrazos Calcular(
            DateTimeOffset pregao,
            DateTimeOffset acionamento,
            IEnumerable<DateTime> feriadosExtras,
            ConfiguracaoPrazos config)
        {
            var cfg = config ?? new ConfiguracaoPrazos();
            var extras = new HashSet<DateTime>((feriadosExtras ?? Enumerable.Empty<DateTime>()).Select(x => x.Date));

            var p = DiaEmBrasilia(pregao);
            var a = DiaEmBrasilia(acionamento);
            var piso = SomarDiasUteis(a, 1, extras);
            var teto = SubtrairDiasUteis(p, 1, extras);

            DateTime Marco(int n)
            {
                var b = SubtrairDiasUteis(p, n, extras);
                var comPiso = b > piso ? b : piso;
                return comPiso < teto ? comPiso : teto;
            }

            var limite = SubtrairDiasUteis(p, cfg.LimiteImpugnacao, extras);
            var fora = a > limite;
            DateTime? impugnacao = null;
            if (!fora)
            {
                var b = SubtrairDiasUteis(p, cfg.Impugnacao, extras);
                var comPiso = b > piso ? b : piso;
                impugnacao = comPiso < limite ? comPiso : limite;
            }

            DateTimeOffset As18(DateTime dia) => EmBrasilia(dia.Date.AddHours(HoraPrazo));

            return new ResultadoPrazos
            {
                AnaliseInicial = As18(Marco(cfg.AnaliseInicial)),
                AnaliseTecnica = As18(Marco(cfg.AnaliseTecnica)),
                Impugnacao = impugnacao.HasValue ? As18(impugnacao.Value) : (DateTimeOffset?)null,
                Checklist = As18(Marco(cfg.Checklist)),
                Proposta = As18(Marco(cfg.Proposta)),
                LimiteLegalImpugnacao = As18(limite),
                ImpugnacaoForaDoPrazo = fora
            };
        }
    }
}
