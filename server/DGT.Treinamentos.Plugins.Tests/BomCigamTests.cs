using System;
using DGT.Treinamentos.Plugins;
using Newtonsoft.Json.Linq;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    public class BomCigamTests
    {
        private static readonly DateTime Hoje = new DateTime(2026, 11, 26);

        // Códigos fictícios (nunca usar dados reais nos testes).
        private static BomCigam.Parametros Validos() => new BomCigam.Parametros
        {
            Bom = "BOM 9999", Revisao = "RV00", ClienteCigam = "000001", Representante = "000002",
            UnidadeNegocio = "001", Controle = "na", PrevisaoVenda = "2026-12-15"
        };

        private static string Selecao(string itens, string precos) =>
            "{\"pontos\":[],\"bomEnviado\":{\"itens\":" + itens + ",\"precos\":" + precos + "}}";

        [Fact]
        public void MontaCorpo_ConsolidaPorCodigo()
        {
            var json = Selecao(
                "[{\"codigo\":\"6300000001\",\"descricao\":\"A\",\"quantidade\":2,\"pendente\":false}," +
                " {\"codigo\":\"4400000002\",\"descricao\":\"B\",\"quantidade\":3,\"pendente\":false}," +
                " {\"codigo\":\"6300000001\",\"descricao\":\"A\",\"quantidade\":1,\"pendente\":false}]",
                "{\"6300000001\":1000,\"4400000002\":1000.5}");

            var r = BomCigam.MontarCorpo(json, Validos(), Hoje);

            Assert.Empty(r.Erros);
            Assert.Equal(2, r.Itens);
            var itens = (JArray)r.Corpo["itens"];
            Assert.Equal("6300000001", (string)itens[0]["codigo"]);
            Assert.Equal(3, (long)itens[0]["quantidade"]);
            Assert.Equal(JTokenType.Integer, itens[0]["quantidade"].Type);
            Assert.Equal(1000.5m, (decimal)itens[1]["valor_unitario_bom"]);
            Assert.Equal(6001.5m, r.ValorTotal);
            Assert.Equal("NA", (string)r.Corpo["controle"]);
            Assert.Equal("000001", (string)r.Corpo["cliente_cigam"]);
        }

        [Fact]
        public void Bloqueia_SemCodigoOuSemPreco()
        {
            var json = Selecao(
                "[{\"codigo\":\"\",\"descricao\":\"Poste\",\"quantidade\":1,\"pendente\":true}," +
                " {\"codigo\":\"4400000002\",\"descricao\":\"B\",\"quantidade\":3,\"pendente\":false}]",
                "{}");
            var r = BomCigam.MontarCorpo(json, Validos(), Hoje);
            Assert.Null(r.Corpo);
            Assert.Equal(2, r.Erros.Count);
        }

        [Fact]
        public void Bloqueia_SemListaCongelada()
        {
            var r = BomCigam.MontarCorpo("{\"pontos\":[]}", Validos(), Hoje);
            Assert.Contains(r.Erros, e => e.Contains("aprovação"));
        }

        [Fact]
        public void Bloqueia_ParametrosInvalidos()
        {
            var p = Validos();
            p.ClienteCigam = "";
            p.Representante = "";
            p.PrevisaoVenda = "2026-01-01";
            var r = BomCigam.MontarCorpo(Selecao("[]", "{}"), p, Hoje);
            Assert.Equal(3, r.Erros.Count);
        }

        [Fact]
        public void EnvioRecebidoOuIndeterminado_Bloqueia()
        {
            Assert.Null(BomCigam.EnvioQueBloqueia(JArray.Parse("[{\"situacao\":\"recusado\"}]")));
            Assert.NotNull(BomCigam.EnvioQueBloqueia(JArray.Parse("[{\"situacao\":\"recusado\"},{\"situacao\":\"indeterminado\"}]")));
            Assert.Equal("recebido", BomCigam.Situacao(200));
            Assert.Equal("indeterminado", BomCigam.Situacao(0));
            Assert.Equal("recusado", BomCigam.Situacao(401));
        }
    }
}
