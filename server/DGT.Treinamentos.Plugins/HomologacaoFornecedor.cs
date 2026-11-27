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

        // ------------------------------------------------------------
        // Aviso "Ficha recebida" para a área Supply, pela fila padrão de
        // e-mails do portal (dgt_implemail, status Pendente) — o mesmo
        // caminho das notificações do fluxo. Sem CNPJ, CPF ou dados
        // bancários: só razão social e protocolo.
        // ------------------------------------------------------------

        public const string TipoEmailFichaRecebida = "fornecedorFichaRecebida";

        public const string RemetenteFornecedores = "fornecedores";

        public static string AssuntoFichaRecebida(string razaoSocial, string protocolo)
        {
            var texto = $"Nova ficha de fornecedor: {Limpo(razaoSocial)} ({Limpo(protocolo)})";
            return texto.Length > 200 ? texto.Substring(0, 200) : texto;
        }

        public static string CorpoFichaRecebida(string razaoSocial, string protocolo, string motivo, string linkPortal)
        {
            var link = string.IsNullOrWhiteSpace(linkPortal)
                ? "Acesse o portal: Fornecedores → Pendências."
                : $"Acesse o portal: <a href=\"{Html(linkPortal.Trim())}\">Fornecedores → Pendências</a>.";
            return "<div style=\"font-family:Arial,sans-serif;font-size:14px;color:#1F2A44\">" +
                   $"<p>Chegou uma ficha de cadastro pelo formulário: <strong>{Html(razaoSocial)}</strong>, protocolo <strong>{Html(protocolo)}</strong> ({Html(motivo)}).</p>" +
                   "<p>O ciclo de homologação está na etapa <strong>Ficha recebida</strong>, aguardando a área Supply.</p>" +
                   $"<p>{link}</p>" +
                   "<p style=\"color:#5B6478;font-size:12px\">Não responda este e-mail.</p></div>";
        }

        // Chave do envio (dgt_motivo, 200): um aviso por ciclo e destinatário.
        public static string MotivoFichaRecebida(Guid cicloId, string email)
        {
            var texto = $"forn-ficha:{cicloId:N}:{(email ?? string.Empty).Trim().ToLowerInvariant()}";
            return texto.Length > 200 ? texto.Substring(0, 200) : texto;
        }

        private static string Limpo(string valor) => (valor ?? string.Empty).Replace("\r", " ").Replace("\n", " ").Trim();

        public static string Html(string valor) =>
            (valor ?? string.Empty).Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");
    }
}
