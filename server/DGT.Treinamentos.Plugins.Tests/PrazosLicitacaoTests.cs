using System;
using System.IO;
using System.Linq;
using DGT.Treinamentos.Plugins;
using Newtonsoft.Json.Linq;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    // A = acionamento, P = pregão (horário de Brasília).
    public class PrazosLicitacaoTests
    {
        private static readonly DateTime[] SemExtras = new DateTime[0];

        private static DateTimeOffset Br(int ano, int mes, int dia, int hora = 10, int minuto = 0) =>
            PrazosLicitacao.EmBrasilia(new DateTime(ano, mes, dia, hora, minuto, 0));

        private static string Dia(DateTimeOffset? d) =>
            d.HasValue ? TimeZoneInfo.ConvertTime(d.Value, PrazosLicitacao.Fuso).ToString("dd/MM HH:mm") : "vazio";

        [Fact]
        public void Caso1_PisoNasAnalises_ImpugnacaoNoLimiteLegal()
        {
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 10, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Equal("08/12 18:00", Dia(r.AnaliseInicial));
            Assert.Equal("08/12 18:00", Dia(r.AnaliseTecnica));
            Assert.Equal("07/12 18:00", Dia(r.Impugnacao));
            Assert.Equal("08/12 18:00", Dia(r.Checklist));
            Assert.Equal("08/12 18:00", Dia(r.Proposta));
            Assert.Equal("07/12 18:00", Dia(r.LimiteLegalImpugnacao));
            Assert.False(r.ImpugnacaoForaDoPrazo);
        }

        [Fact]
        public void Caso2_ImpugnacaoForaDoPrazo()
        {
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 9, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Null(r.Impugnacao);
            Assert.True(r.ImpugnacaoForaDoPrazo);
            Assert.Equal("04/12 18:00", Dia(r.LimiteLegalImpugnacao));
            Assert.Equal("08/12 18:00", Dia(r.AnaliseInicial));
            Assert.Equal("08/12 18:00", Dia(r.AnaliseTecnica));
            Assert.Equal("08/12 18:00", Dia(r.Checklist));
            Assert.Equal("08/12 18:00", Dia(r.Proposta));

            var valores = new JObject();
            var etiquetas = TarefaLicitacaoClickUp.AplicarDatas(valores, Br(2026, 12, 9, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Equal(JTokenType.Null, valores["prazoImpugnacao"].Type);
            Assert.Contains(TarefaLicitacaoClickUp.EtiquetaImpugnacaoForaDoPrazo, etiquetas.Adicionar);
        }

        [Fact]
        public void Caso3_SemPiso()
        {
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 18, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Equal("09/12 18:00", Dia(r.AnaliseInicial));
            Assert.Equal("10/12 18:00", Dia(r.AnaliseTecnica));
            Assert.Equal("14/12 18:00", Dia(r.Impugnacao));
            Assert.Equal("15/12 18:00", Dia(r.Checklist));
            Assert.Equal("16/12 18:00", Dia(r.Proposta));
            Assert.Equal("15/12 18:00", Dia(r.LimiteLegalImpugnacao));
        }

        [Fact]
        public void Caso4_PisoMaiorQueTeto_ValeOTeto()
        {
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 8, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Equal("07/12 18:00", Dia(r.AnaliseInicial));
            Assert.Equal("07/12 18:00", Dia(r.AnaliseTecnica));
            Assert.Equal("07/12 18:00", Dia(r.Checklist));
            Assert.Equal("07/12 18:00", Dia(r.Proposta));
            Assert.Null(r.Impugnacao);
            Assert.True(r.ImpugnacaoForaDoPrazo);
            Assert.Equal("03/12 18:00", Dia(r.LimiteLegalImpugnacao));
        }

        [Fact]
        public void Caso5_ComFeriado2512()
        {
            // 25/12 é feriado nacional (sempre); passar também como extra não muda nada.
            foreach (var extras in new[] { SemExtras, new[] { new DateTime(2026, 12, 25) } })
            {
                var r = PrazosLicitacao.Calcular(Br(2026, 12, 30, 9), Br(2026, 12, 21), extras, new ConfiguracaoPrazos());
                Assert.Equal("22/12 18:00", Dia(r.AnaliseInicial));
                Assert.Equal("22/12 18:00", Dia(r.AnaliseTecnica));
                Assert.Equal("23/12 18:00", Dia(r.Impugnacao));
                Assert.Equal("24/12 18:00", Dia(r.Checklist));
                Assert.Equal("28/12 18:00", Dia(r.Proposta));
                Assert.Equal("24/12 18:00", Dia(r.LimiteLegalImpugnacao));
            }
        }

        [Fact]
        public void FeriadoExtraDaConfiguracao_SomaAosNacionais()
        {
            // Caso 3 com ponto facultativo extra em 16/12: os prazos recuam um dia útil.
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 18, 9), Br(2026, 12, 7), new[] { new DateTime(2026, 12, 16) }, new ConfiguracaoPrazos());
            Assert.Equal("15/12 18:00", Dia(r.Proposta));
            Assert.Equal("14/12 18:00", Dia(r.Checklist));
        }

        [Fact]
        public void FeriadosNacionaisMoveis()
        {
            // 2026: Páscoa 05/04 → Carnaval 16 e 17/02, Sexta-feira Santa 03/04, Corpus Christi 04/06.
            Assert.True(PrazosLicitacao.EhFeriadoNacional(new DateTime(2026, 2, 16)));
            Assert.True(PrazosLicitacao.EhFeriadoNacional(new DateTime(2026, 2, 17)));
            Assert.True(PrazosLicitacao.EhFeriadoNacional(new DateTime(2026, 4, 3)));
            Assert.True(PrazosLicitacao.EhFeriadoNacional(new DateTime(2026, 6, 4)));
            Assert.False(PrazosLicitacao.EhFeriadoNacional(new DateTime(2026, 12, 8)));
        }

        [Fact]
        public void Caso6_AtualizarUsaAcionamentoGravado_NuncaHoje()
        {
            var gravado = Br(2026, 12, 7);
            string origem;

            // A coluna vence o campo e a criação da tarefa.
            var a = TarefaLicitacaoClickUp.ResolverAcionamento(gravado, Br(2026, 12, 1).ToUnixTimeMilliseconds(), Br(2026, 11, 30).ToUnixTimeMilliseconds(), out origem);
            Assert.Equal(gravado, a);
            Assert.Equal("coluna", origem);

            // Tarefa antiga: sem coluna nem campo → data de criação da tarefa.
            var criacao = Br(2026, 12, 3);
            a = TarefaLicitacaoClickUp.ResolverAcionamento(null, null, criacao.ToUnixTimeMilliseconds(), out origem);
            Assert.Equal(criacao.ToUnixTimeMilliseconds(), a.Value.ToUnixTimeMilliseconds());
            Assert.Equal("criacao", origem);

            // Sem nada: não inventa "hoje".
            Assert.Null(TarefaLicitacaoClickUp.ResolverAcionamento(null, null, null, out origem));

            // Data Pregão alterada (10/12 → 18/12): recalcula a partir de 07/12.
            var valores = new JObject();
            TarefaLicitacaoClickUp.AplicarDatas(valores, Br(2026, 12, 18, 9), gravado, SemExtras, new ConfiguracaoPrazos());
            var esperado = PrazosLicitacao.Calcular(Br(2026, 12, 18, 9), gravado, SemExtras, new ConfiguracaoPrazos());
            Assert.Equal(esperado.AnaliseInicial.ToUnixTimeMilliseconds(), (long)valores["prazoAnaliseInicial"]);
            Assert.Equal("09/12 18:00", Dia(DateTimeOffset.FromUnixTimeMilliseconds((long)valores["prazoAnaliseInicial"])));
        }

        [Fact]
        public void Caso7_NenhumCorpoTemDueDate()
        {
            var valores = new JObject { ["orgao"] = "Prefeitura" };
            TarefaLicitacaoClickUp.AplicarDatas(valores, Br(2026, 12, 18, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            var mapa = new JObject { ["orgao"] = "id-orgao", ["prazoProposta"] = "id-proposta", ["dataPregao"] = "id-pregao" };
            var corpo = TarefaLicitacaoClickUp.MontarCorpoCriacao("Edital", "desc", new[] { "licitação" }, "análise", 2,
                Br(2026, 12, 7), TarefaLicitacaoClickUp.MontarCustomFields(mapa, valores, s => s));

            Assert.Null(corpo["due_date"]);
            Assert.Null(corpo["due_date_time"]);
            Assert.DoesNotContain("due_date", corpo.ToString());
            Assert.Equal(3, ((JArray)corpo["custom_fields"]).Count);

            // Guarda: o código do plugin não monta due_date em nenhuma chamada.
            var fonte = File.ReadAllText(Path.Combine(RaizServer(), "DGT.Treinamentos.Plugins", "CriarTarefaClickUpPlugin.cs"));
            Assert.DoesNotContain("\"due_date", fonte);
        }

        [Fact]
        public void Caso8_SemEncerramento_EtiquetaESemPrazos()
        {
            var valores = new JObject { ["orgao"] = "Prefeitura" };
            var etiquetas = TarefaLicitacaoClickUp.AplicarDatas(valores, null, Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Contains(TarefaLicitacaoClickUp.EtiquetaSemDataPregao, etiquetas.Adicionar);
            foreach (var campo in TarefaLicitacaoClickUp.CamposCalculados)
            {
                Assert.True(TarefaLicitacaoClickUp.Vazio(valores[campo]));
            }

            var mapa = new JObject { ["orgao"] = "id-orgao", ["prazoProposta"] = "id-proposta", ["dataPregao"] = "id-pregao" };
            var campos = TarefaLicitacaoClickUp.MontarCustomFields(mapa, valores, s => s);
            Assert.Single(campos);
            Assert.Equal("id-orgao", (string)campos[0]["id"]);

            var corpo = TarefaLicitacaoClickUp.MontarCorpoCriacao("Edital", "desc",
                new[] { "licitação" }.Concat(etiquetas.Adicionar), null, 3, Br(2026, 12, 7), campos);
            Assert.Contains(TarefaLicitacaoClickUp.EtiquetaSemDataPregao, corpo["tags"].Select(t => (string)t));

            // Data passa a existir no "Atualizar": calcula e remove a etiqueta.
            etiquetas = TarefaLicitacaoClickUp.AplicarDatas(valores, Br(2026, 12, 18, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Contains(TarefaLicitacaoClickUp.EtiquetaSemDataPregao, etiquetas.Remover);
            Assert.False(TarefaLicitacaoClickUp.Vazio(valores["prazoProposta"]));
        }

        [Fact]
        public void DatasComHorarioExplicito()
        {
            // Prazo às 18:00 de Brasília = 21:00 UTC.
            var r = PrazosLicitacao.Calcular(Br(2026, 12, 18, 9), Br(2026, 12, 7), SemExtras, new ConfiguracaoPrazos());
            Assert.Equal(21, r.Proposta.UtcDateTime.Hour);

            // Encerramento do PNCP sem fuso = horário de Brasília (09:00 → 12:00 UTC).
            var p = PrazosLicitacao.LerDataPncp("2026-12-18T09:00:00");
            Assert.Equal(12, p.Value.UtcDateTime.Hour);
            Assert.Null(PrazosLicitacao.LerDataPncp(""));
            Assert.Null(PrazosLicitacao.LerDataPncp("data inválida"));

            // Campos de data sempre com value_options.time = true.
            var item = TarefaLicitacaoClickUp.MontarValorCampo("prazoProposta", r.Proposta.ToUnixTimeMilliseconds(), null);
            Assert.True((bool)item["value_options"]["time"]);
            Assert.Null(TarefaLicitacaoClickUp.MontarValorCampo("orgao", "Prefeitura", null)["value_options"]);

            var corpo = TarefaLicitacaoClickUp.MontarCorpoCriacao("E", "", new string[0], null, null, Br(2026, 12, 7), new JArray());
            Assert.True((bool)corpo["start_date_time"]);
        }

        private static string RaizServer()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null && !Directory.Exists(Path.Combine(dir.FullName, "DGT.Treinamentos.Plugins")))
            {
                dir = dir.Parent;
            }
            return dir != null ? dir.FullName : throw new DirectoryNotFoundException("Pasta server não encontrada.");
        }
    }
}
