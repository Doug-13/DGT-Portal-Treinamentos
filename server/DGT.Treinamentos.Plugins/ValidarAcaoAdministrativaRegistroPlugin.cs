using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // AÇÕES ADMINISTRATIVAS NO REGISTRO DE AMBIENTE (validação no servidor)
    //
    // O portal (navegador) já confere o perfil, mas grava direto no
    // Dataverse. Este plugin garante, no servidor, que só o
    // ADMINISTRADOR DO SISTEMA faça as duas ações do menu ⋮:
    //
    //   1. Cancelar registro      → dgt_situacao passa a 'cancelado'
    //   2. Editar como administrador → entra no histórico do fluxo
    //      (dgt_fluxoestado) um evento NOVO com acaoChave
    //      'edicaoAdministrativa'
    //   3. Executar ação como administrador → evento NOVO no histórico
    //      com "comoAdministrador": true
    //
    // "Administrador do Sistema" = a MESMA regra do portal
    // (AutorizacaoService): cadastro em dgt_usuario com o e-mail do
    // usuário, ativo, e dgt_perfilacesso = "Administrador".
    //
    // REGISTRO (Plugin Registration Tool):
    //   Mensagem: Update · Entidade: dgt_ambienteregistro
    //   Estágio: PreOperation (20) · SÍNCRONO
    //   Atributos de filtragem: dgt_situacao, dgt_fluxoestado
    //   Pre Image "PreImage" com: dgt_situacao, dgt_fluxoestado
    //
    // Qualquer outra atualização (ações normais das etapas, sincronia,
    // Power Automate) passa sem alteração.
    // ================================================================
    public sealed class ValidarAcaoAdministrativaRegistroPlugin : IPlugin
    {
        private const string Entidade = "dgt_ambienteregistro";
        private const string ColunaSituacao = "dgt_situacao";
        private const string ColunaEstado = "dgt_fluxoestado";
        private const string AcaoEdicaoAdministrativa = "edicaoAdministrativa";

        public void Execute(IServiceProvider serviceProvider)
        {
            var contexto = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var rastro = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));

            if (!string.Equals(contexto.MessageName, "Update", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(contexto.PrimaryEntityName, Entidade, StringComparison.OrdinalIgnoreCase) ||
                !contexto.InputParameters.Contains("Target"))
            {
                return;
            }

            var alvo = contexto.InputParameters["Target"] as Entity;
            if (alvo == null)
            {
                return;
            }

            var antes = contexto.PreEntityImages.Contains("PreImage") ? contexto.PreEntityImages["PreImage"] : null;

            var cancelando =
                alvo.Contains(ColunaSituacao) &&
                string.Equals(alvo.GetAttributeValue<string>(ColunaSituacao), "cancelado", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(antes?.GetAttributeValue<string>(ColunaSituacao), "cancelado", StringComparison.OrdinalIgnoreCase);

            var editando =
                alvo.Contains(ColunaEstado) &&
                NovosEventos(alvo.GetAttributeValue<string>(ColunaEstado), antes?.GetAttributeValue<string>(ColunaEstado))
                    .Any(acao => string.Equals(acao, AcaoEdicaoAdministrativa, StringComparison.Ordinal));

            var executandoComoAdmin =
                alvo.Contains(ColunaEstado) &&
                NovosEventosComoAdministrador(alvo.GetAttributeValue<string>(ColunaEstado), antes?.GetAttributeValue<string>(ColunaEstado));

            if (!cancelando && !editando && !executandoComoAdmin)
            {
                return;
            }

            // Consulta como sistema: o usuário comum pode não ler dgt_usuario.
            var servico = fabrica.CreateOrganizationService(null);

            if (EhAdministradorDoSistema(servico, contexto.InitiatingUserId, rastro))
            {
                return;
            }

            throw new InvalidPluginExecutionException(
                cancelando
                    ? "Somente o Administrador do Sistema pode cancelar registros."
                    : editando
                        ? "Somente o Administrador do Sistema pode editar como administrador."
                        : "Somente o Administrador do Sistema pode executar ações como administrador.");
        }

        // acaoChave dos eventos do histórico que não existiam antes.
        private static IEnumerable<string> NovosEventos(string estadoNovo, string estadoAntigo)
        {
            var anteriores = new HashSet<string>(IdsDoHistorico(estadoAntigo).Select(item => item.Key));
            return IdsDoHistorico(estadoNovo)
                .Where(item => !anteriores.Contains(item.Key))
                .Select(item => item.Value);
        }

        // Há evento novo marcado com "comoAdministrador": true?
        private static bool NovosEventosComoAdministrador(string estadoNovo, string estadoAntigo)
        {
            var anteriores = new HashSet<string>(IdsDoHistorico(estadoAntigo).Select(item => item.Key));
            try
            {
                var historico = string.IsNullOrWhiteSpace(estadoNovo) ? null : JObject.Parse(estadoNovo)["historico"] as JArray;
                return historico != null && historico
                    .OfType<JObject>()
                    .Any(evento =>
                        !anteriores.Contains((string)evento["id"] ?? string.Empty) &&
                        evento["comoAdministrador"] != null &&
                        evento["comoAdministrador"].Type == JTokenType.Boolean &&
                        (bool)evento["comoAdministrador"]);
            }
            catch (Exception)
            {
                return false;
            }
        }

        // (id, acaoChave) de cada evento do histórico do estado do fluxo.
        private static IEnumerable<KeyValuePair<string, string>> IdsDoHistorico(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return Enumerable.Empty<KeyValuePair<string, string>>();
            }
            try
            {
                var historico = JObject.Parse(json)["historico"] as JArray;
                if (historico == null)
                {
                    return Enumerable.Empty<KeyValuePair<string, string>>();
                }
                return historico
                    .OfType<JObject>()
                    .Select(evento => new KeyValuePair<string, string>(
                        (string)evento["id"] ?? string.Empty,
                        (string)evento["acaoChave"] ?? string.Empty))
                    .Where(item => item.Key.Length > 0)
                    .ToList();
            }
            catch (Exception)
            {
                // Estado ilegível: não identifica evento novo.
                return Enumerable.Empty<KeyValuePair<string, string>>();
            }
        }

        private static bool EhAdministradorDoSistema(IOrganizationService servico, Guid usuarioId, ITracingService rastro)
        {
            var usuario = servico.Retrieve("systemuser", usuarioId, new ColumnSet("internalemailaddress", "domainname"));
            var emails = new[]
            {
                usuario.GetAttributeValue<string>("internalemailaddress"),
                usuario.GetAttributeValue<string>("domainname")
            }
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Select(item => item.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

            if (emails.Count == 0)
            {
                rastro.Trace("Usuário sem e-mail: não é possível conferir o perfil.");
                return false;
            }

            var consulta = new QueryExpression("dgt_usuario")
            {
                ColumnSet = new ColumnSet("dgt_perfilacesso", "dgt_ativo"),
                TopCount = 5
            };
            consulta.Criteria.AddCondition("dgt_email", ConditionOperator.In, emails.Cast<object>().ToArray());

            foreach (var cadastro in servico.RetrieveMultiple(consulta).Entities)
            {
                var ativo = !cadastro.Contains("dgt_ativo") || cadastro.GetAttributeValue<bool>("dgt_ativo");
                var perfil = cadastro.FormattedValues.Contains("dgt_perfilacesso")
                    ? cadastro.FormattedValues["dgt_perfilacesso"]
                    : string.Empty;
                if (ativo && string.Equals(Normalizar(perfil), "administrador", StringComparison.Ordinal))
                {
                    return true;
                }
            }

            rastro.Trace("Usuário {0} não tem o perfil Administrador em dgt_usuario.", usuarioId);
            return false;
        }

        // Mesma normalização do portal: minúsculas e sem acentos.
        private static string Normalizar(string texto)
        {
            var semAcento = new StringBuilder();
            foreach (var letra in (texto ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            {
                if (CharUnicodeInfo.GetUnicodeCategory(letra) != UnicodeCategory.NonSpacingMark)
                {
                    semAcento.Append(letra);
                }
            }
            return semAcento.ToString();
        }
    }
}
