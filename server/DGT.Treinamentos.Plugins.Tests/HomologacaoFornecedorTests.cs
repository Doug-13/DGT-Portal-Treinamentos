using System;
using DGT.Treinamentos.Plugins;
using Newtonsoft.Json.Linq;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    public class HomologacaoFornecedorTests
    {
        [Fact]
        public void ResponsaveisDaArea_NoFormatoDoPortal()
        {
            var id = Guid.Parse("11111111-2222-3333-4444-555555555555");
            var lista = JArray.Parse(HomologacaoFornecedor.ResponsaveisDaArea(id, "sup", "Suprimentos"));

            Assert.Single(lista);
            Assert.Equal("area:SUP", (string)lista[0]["papelTeste"]);
            Assert.Equal("Área: Suprimentos", (string)lista[0]["descricao"]);
            Assert.Equal("11111111-2222-3333-4444-555555555555", (string)lista[0]["areaId"]);
            Assert.False((bool)lista[0]["somenteGestores"]);
        }

        [Fact]
        public void AvisoFichaRecebida_SemDadosSensiveisEComHtmlEscapado()
        {
            var corpo = HomologacaoFornecedor.CorpoFichaRecebida("Empresa <Teste> & Cia", "FORN-2026-0001", "Cadastro inicial", "");
            Assert.Contains("Empresa &lt;Teste&gt; &amp; Cia", corpo);
            Assert.Contains("FORN-2026-0001", corpo);
            Assert.Contains("Fornecedores → Pendências", corpo);
            Assert.Equal("Nova ficha de fornecedor: Empresa X (FORN-2026-0001)", HomologacaoFornecedor.AssuntoFichaRecebida("Empresa X", "FORN-2026-0001"));
        }

        [Fact]
        public void MotivoFichaRecebida_UmPorCicloEDestinatario()
        {
            var ciclo = Guid.Parse("11111111-2222-3333-4444-555555555555");
            Assert.Equal("forn-ficha:11111111222233334444555555555555:ana@exemplo.com",
                HomologacaoFornecedor.MotivoFichaRecebida(ciclo, " Ana@Exemplo.com "));
        }

        [Fact]
        public void EtapaInicial_IgualAoPacoteDoProcesso()
        {
            // docs/exemplos/pacote-homologacao-fornecedor.json e homologacao.ts
            Assert.Equal("ficha-recebida", HomologacaoFornecedor.EtapaInicial);
        }
    }
}
