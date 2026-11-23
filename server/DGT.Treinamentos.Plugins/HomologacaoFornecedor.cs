using System;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ============================================================
    // Homologação de fornecedor no motor de fluxos (processo SUP-HOM)
    // — regras puras usadas pelo plugin ao abrir o ciclo pela ficha.
    //
    // O plugin não roda o motor (ele vive no navegador). Ele cria o ciclo
    // sem instância e já grava:
    //   dgt_etapaatual        = "ficha-recebida" (gatilho do aviso, D2)
    //   dgt_responsaveisetapa = a área Suprimentos, no MESMO formato que
    //                           o portal grava (IResponsavelResolvido)
    // Assim o aviso da primeira etapa sai mesmo antes de alguém abrir o
    // portal. A instância é iniciada na primeira abertura do ciclo; como
    // a etapa é a mesma, o portal não regrava dgt_etapaatual (sem e-mail
    // repetido).
    // ============================================================
    public static class HomologacaoFornecedor
    {
        public const string EtapaInicial = "ficha-recebida";

        public const string SiglaSuprimentosPadrao = "SUY";

        // [{ papelTeste, descricao, areaId, somenteGestores }] — igual ao
        // que o pacote do processo gera para { "tipo": "area", "area": SIGLA }.
        public static string ResponsaveisDaArea(Guid areaId, string sigla, string nomeArea)
        {
            var siglaLimpa = (sigla ?? string.Empty).Trim().ToUpperInvariant();
            var nome = string.IsNullOrWhiteSpace(nomeArea) ? siglaLimpa : nomeArea.Trim();
            return new JArray
            {
                new JObject
                {
                    ["papelTeste"] = "area:" + siglaLimpa,
                    ["descricao"] = "Área: " + nome,
                    ["areaId"] = areaId.ToString("D").ToLowerInvariant(),
                    ["somenteGestores"] = false
                }
            }.ToString(Newtonsoft.Json.Formatting.None);
        }
    }
}
