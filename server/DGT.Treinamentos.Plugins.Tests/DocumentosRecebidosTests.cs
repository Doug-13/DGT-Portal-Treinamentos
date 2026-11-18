using System;
using System.Linq;
using DGT.Treinamentos.Plugins;
using Xunit;

namespace DGT.Treinamentos.Plugins.Tests
{
    // Fornecedores — documentos recebidos por e-mail (Fluxo 2).
    public class DocumentosRecebidosTests
    {
        [Theory]
        [InlineData("Re: [FORN-2026-0042] Documentos para cadastro na DGT", "FORN-2026-0042")]
        [InlineData("RES: RES: forn-2026-0042 seguem anexos", "FORN-2026-0042")]
        [InlineData("[FORN-2027-12345] sequencial com 5 dígitos", "FORN-2027-12345")]
        [InlineData("Documentos da empresa (sem protocolo)", "")]
        [InlineData(null, "")]
        public void ExtraiProtocoloDoAssunto(string assunto, string esperado)
        {
            Assert.Equal(esperado, DocumentosRecebidosFornecedor.ExtrairProtocolo(assunto));
        }

        [Fact]
        public void NomeDaPasta_IgualAoPortal()
        {
            var id = Guid.Parse("1a2b3c4d-0000-0000-0000-000000000000");
            Assert.Equal("Empresa Exemplo LTDA (1a2b3c4d)", DocumentosRecebidosFornecedor.NomePasta("  Empresa Exemplo LTDA ", id));
            // Caracteres que o SharePoint não aceita viram "-"; "/" também; espaços repetidos viram um.
            Assert.Equal("A-B Comércio - Serviços (1a2b3c4d)", DocumentosRecebidosFornecedor.NomePasta("A/B Comércio  &  Serviços", id));
            // Razão social limitada a 80 caracteres.
            var longa = new string('X', 100);
            Assert.Equal(new string('X', 80) + " (1a2b3c4d)", DocumentosRecebidosFornecedor.NomePasta(longa, id));
        }

        [Fact]
        public void FiltraArquivosValidosENaoRepetidos()
        {
            var recebidos = new[]
            {
                new DocumentosRecebidosFornecedor.Arquivo { Nome = "contrato.pdf", Url = "https://x.sharepoint.com/a/contrato.pdf" },
                new DocumentosRecebidosFornecedor.Arquivo { Nome = "contrato.pdf", Url = "https://x.sharepoint.com/a/contrato.pdf" },
                new DocumentosRecebidosFornecedor.Arquivo { Nome = "antigo.pdf", Url = "https://x.sharepoint.com/a/antigo.pdf" },
                new DocumentosRecebidosFornecedor.Arquivo { Nome = "", Url = "https://x.sharepoint.com/a/sem-nome.pdf" },
                new DocumentosRecebidosFornecedor.Arquivo { Nome = "inseguro.pdf", Url = "http://x/inseguro.pdf" }
            };
            var novos = DocumentosRecebidosFornecedor.FiltrarNovos(recebidos, new[] { "https://x.sharepoint.com/a/antigo.pdf" });
            Assert.Single(novos);
            Assert.Equal("contrato.pdf", novos.Single().Nome);
        }
    }
}
