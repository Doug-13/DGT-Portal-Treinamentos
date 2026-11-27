namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // FORNECEDORES — certidões pela Infosimples (regras PURAS, testadas
    // em server/DGT.Treinamentos.Plugins.Tests).
    // ================================================================
    public static class CertidoesInfosimples
    {
        // Códigos de instabilidade da FONTE (não do cadastro): o plugin
        // tenta a rota alternativa da certidão, quando houver, e avisa
        // "tente de novo mais tarde".
        //   600 erro inesperado · 605 tempo esgotado · 609 tentativas
        //   excedidas · 610 falha no captcha · 611 dados incompletos na
        //   origem · 613 bloqueio temporário · 614 erro no site de origem ·
        //   615 site de origem indisponível
        public static bool Transitorio(int codigo)
        {
            return codigo == 600 || codigo == 605 || codigo == 609 || codigo == 610
                || codigo == 611 || codigo == 613 || codigo == 614 || codigo == 615;
        }
    }
}
