using DGT.Treinamentos.Plugins;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    // Fornecedores — certidões pela Infosimples: o que é instabilidade da
    // fonte (tenta a rota alternativa / avisa "tente mais tarde").
    public class CertidoesInfosimplesTests
    {
        [Theory]
        [InlineData(600, true)]
        [InlineData(605, true)]
        [InlineData(609, true)]
        [InlineData(610, true)]
        [InlineData(611, true)]
        [InlineData(613, true)]
        [InlineData(614, true)]
        [InlineData(615, true)]
        [InlineData(200, false)]
        [InlineData(601, false)]
        [InlineData(606, false)]
        [InlineData(607, false)]
        [InlineData(608, false)]
        [InlineData(612, false)]
        public void CodigosDeInstabilidade(int codigo, bool esperado)
        {
            Assert.Equal(esperado, CertidoesInfosimples.Transitorio(codigo));
        }
    }
}
