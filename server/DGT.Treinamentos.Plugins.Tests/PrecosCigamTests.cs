using System;
using System.Collections.Generic;
using DGT.Treinamentos.Plugins;
using Newtonsoft.Json.Linq;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    // Regras da escolha de preço do CIGAM (AtualizarValoresCigamPlugin).
    public class PrecosCigamTests
    {
        private static readonly DateTime Hoje = new DateTime(2026, 11, 24);
        private static readonly List<string> Tabela010 = new List<string> { "010" };

        private static JObject Linha(string tabela, decimal preco, string inicio = "2020-10-01T00:00:00", string fim = "2029-12-31T00:00:00", string descricao = "VENDA PADRÃO 2021") =>
            new JObject
            {
                ["CodigoTabela"] = tabela,
                ["DescricaoTabela"] = descricao,
                ["Elemento"] = "5100250019",
                ["PrecoUnitario"] = preco,
                ["ValidadeInicial"] = inicio,
                ["ValidadeFinal"] = fim
            };

        [Theory]
        [InlineData("310.005.0082", "3100050082")]
        [InlineData(" 3100050082 ", "3100050082")]
        [InlineData("715.001.0004", "7150010004")]
        [InlineData("", "")]
        [InlineData("a levantar", "")]
        [InlineData("item 2", "")]
        public void NormalizaCodigoSemMascara(string entrada, string esperado) =>
            Assert.Equal(esperado, PrecosCigam.NormalizarCodigo(entrada));

        [Fact]
        public void TabelaComZeroAEsquerdaEhAMesma()
        {
            Assert.Equal(PrecosCigam.NormalizarTabela("068"), PrecosCigam.NormalizarTabela("68"));
            Assert.Equal("10", PrecosCigam.NormalizarTabela("010    "));
        }

        [Fact]
        public void EscolheTabelaDesejadaVigente()
        {
            var r = PrecosCigam.Escolher(new JArray(Linha("012", 900m, descricao: "LOCACAO 12 MESES"), Linha("010    ", 712.056m)), Tabela010, Hoje);
            Assert.Equal(712.056m, r.Valor);
            Assert.Equal("010", r.Tabela);
            Assert.Equal(string.Empty, r.Motivo);
            Assert.StartsWith("CIGAM — tabela 010 VENDA PADRÃO 2021", r.Origem);
        }

        [Fact]
        public void ListaVaziaEhSemTabelaOuPrecoZerado()
        {
            var r = PrecosCigam.Escolher(new JArray(), Tabela010, Hoje);
            Assert.Null(r.Valor);
            Assert.Contains("preço zerado", r.Motivo);
        }

        [Fact]
        public void TabelaVencidaNaoDaValor()
        {
            var r = PrecosCigam.Escolher(new JArray(Linha("010", 500m, "2020-01-01T00:00:00", "2025-12-31T00:00:00")), Tabela010, Hoje);
            Assert.Null(r.Valor);
            Assert.Contains("vencida em 31/12/2025", r.Motivo);
        }

        [Fact]
        public void ItemForaDaTabelaDesejadaListaAsTabelasDoItem()
        {
            var r = PrecosCigam.Escolher(new JArray(Linha("012", 900m), Linha("024", 800m)), Tabela010, Hoje);
            Assert.Null(r.Valor);
            Assert.Contains("012, 024", r.Motivo);
        }

        [Fact]
        public void UsaASegundaTabelaQuandoAPrimeiraNaoTem()
        {
            var r = PrecosCigam.Escolher(new JArray(Linha("68", 300m)), new List<string> { "010", "068" }, Hoje);
            Assert.Equal(300m, r.Valor);
        }

        [Fact]
        public void ValidadeFinalEhInclusiva()
        {
            var r = PrecosCigam.Escolher(new JArray(Linha("010", 100m, "2026-01-01T00:00:00", "2026-11-24T00:00:00")), Tabela010, Hoje);
            Assert.Equal(100m, r.Valor);
        }

        [Fact]
        public void EscapaAspasDoFiltro() => Assert.Equal("O''Brien", PrecosCigam.Escapar("O'Brien"));
    }
}
