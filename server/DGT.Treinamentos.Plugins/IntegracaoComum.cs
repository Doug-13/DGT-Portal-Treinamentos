using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CONFIGURAÇÃO DE INTEGRAÇÕES — mesmo padrão da chave da IA (IaComum)
    //
    //   Tabela ...... dgt_integracaoconfiguracao (uma linha por integração,
    //                 pelo nome: "CIGAM-BOM", ...)
    //   Segredo ..... dgt_segredo (coluna PROTEGIDA: o portal nunca a lê;
    //                 só o SYSTEM, ou seja, os plugins)
    //   Fallback .... sem segredo/endereço salvos no portal, cada plugin
    //                 continua usando a Configuração do passo — nada quebra.
    //
    // Sempre ler com o serviço de SISTEMA: CreateOrganizationService(null).
    // Nunca gravar o segredo em log, trace, mensagem de erro ou URL.
    // ================================================================
    internal static class IntegracaoComum
    {
        internal const string Tabela = "dgt_integracaoconfiguracao";
        internal const string CigamBom = "CIGAM-BOM";

        internal sealed class Configuracao
        {
            internal Guid Id = Guid.Empty;
            internal string Nome = string.Empty;
            internal string Url = string.Empty;
            internal string Ambiente = string.Empty;
            internal string Segredo = string.Empty;
        }

        // Lê a integração pelo nome. Se a tabela ainda não existe ou o
        // registro não foi criado, devolve uma configuração vazia (sem erro).
        internal static Configuracao Ler(IOrganizationService sistema, string nome, ITracingService tracing)
        {
            var config = new Configuracao { Nome = nome };
            if (!IaComum.Existe(sistema, Tabela, "dgt_segredo"))
            {
                tracing.Trace("Integrações: tabela {0} ainda não existe; usando a Configuração do passo.", Tabela);
                return config;
            }

            var consulta = new QueryExpression(Tabela)
            {
                ColumnSet = new ColumnSet("dgt_url", "dgt_ambiente", "dgt_segredo"),
                TopCount = 1
            };
            consulta.Criteria.AddCondition("dgt_name", ConditionOperator.Equal, nome);
            consulta.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);

            var registro = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();
            if (registro == null)
            {
                tracing.Trace("Integrações: registro {0} não encontrado; usando a Configuração do passo.", nome);
                return config;
            }

            config.Id = registro.Id;
            config.Url = (registro.GetAttributeValue<string>("dgt_url") ?? string.Empty).Trim();
            config.Ambiente = (registro.GetAttributeValue<string>("dgt_ambiente") ?? string.Empty).Trim();
            config.Segredo = (registro.GetAttributeValue<string>("dgt_segredo") ?? string.Empty).Trim();
            // Só registra SE existe segredo, nunca o valor.
            tracing.Trace("Integrações: {0} lida (endereço {1}, segredo {2}).",
                nome, config.Url.Length > 0 ? "salvo" : "vazio", config.Segredo.Length > 0 ? "salvo" : "vazio");
            return config;
        }

        // Valor salvo no portal; sem ele, o da Configuração do passo.
        internal static string Escolher(string doPortal, string doPasso)
        {
            return !string.IsNullOrWhiteSpace(doPortal) ? doPortal.Trim() : (doPasso ?? string.Empty).Trim();
        }

        // https completo, sem parâmetros (tokens nunca vão na URL).
        internal static string ValidarUrl(string url)
        {
            var valor = (url ?? string.Empty).Trim();
            if (valor.Length == 0)
            {
                return "Endereço não informado.";
            }
            Uri uri;
            if (!Uri.TryCreate(valor, UriKind.Absolute, out uri) || uri.Scheme != Uri.UriSchemeHttps)
            {
                return "Use um endereço https:// completo.";
            }
            if (valor.IndexOf('?') >= 0 || valor.IndexOf('#') >= 0)
            {
                return "O endereço não pode ter parâmetros (? ou #). Tokens vão só no cabeçalho.";
            }
            return string.Empty;
        }

        internal static string Final(string segredo)
        {
            var s = (segredo ?? string.Empty).Trim();
            return s.Length <= 4 ? "…" : "…" + s.Substring(s.Length - 4);
        }
    }
}
