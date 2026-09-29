using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CÓDIGO DO TREINAMENTO (dgt_treinamento)
    //
    // Formato: <SIGLA DA ÁREA>-TRN-<SEQUENCIAL 3 dígitos>
    // Exemplo: PRO-TRN-001, PRO-TRN-002, MAN-TRN-001
    //
    // STEP 1 — Create, PreOperation (20), síncrono
    //   Gera dgt_sequencial (próximo número da área) e dgt_codigo.
    //
    // STEP 2 — Update, PreOperation (20), síncrono
    //   Filtering attributes: dgt_sequencial, dgt_codigo
    //   - Somente Administrador altera o sequencial depois da criação
    //     (função "DGT - Treinamentos - Administrador" ou
    //     "Administrador do Sistema", direta ou por equipe).
    //   - dgt_codigo nunca é editado diretamente: é sempre recalculado
    //     a partir da sigla da área + TRN + sequencial.
    //   - Não permite dois treinamentos da mesma área com o mesmo
    //     sequencial.
    //
    // O sequencial é POR ÁREA (independe do tipo do treinamento).
    // A alteração fica registrada no histórico pelo
    // AuditarTreinamentoPlugin.
    // ================================================================
    public sealed class GerarCodigoTreinamentoPlugin : IPlugin
    {
        private const int SequencialMaximo = 999;

        // Nomes aceitos (comparação sem acento e sem diferenciar
        // maiúsculas / tipo de traço).
        private static readonly string[] FuncoesAdministrador =
        {
            "dgt - treinamentos - administrador",
            "administrador do sistema",
            "system administrator"
        };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var tracing =
                (ITracingService)serviceProvider.GetService(
                    typeof(ITracingService));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            if (context.Stage != 20)
            {
                tracing.Trace("Stage ignorado: {0}", context.Stage);
                return;
            }

            if (!context.InputParameters.Contains("Target") ||
                !(context.InputParameters["Target"] is Entity target))
            {
                return;
            }

            if (!string.Equals(
                    target.LogicalName,
                    "dgt_treinamento",
                    StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            // Consultas de segurança/unicidade como SYSTEM, para não
            // depender dos privilégios de leitura de quem executa.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            if (string.Equals(
                    context.MessageName,
                    "Create",
                    StringComparison.OrdinalIgnoreCase))
            {
                ProcessarCriacao(
                    service,
                    tracing,
                    target);

                return;
            }

            if (string.Equals(
                    context.MessageName,
                    "Update",
                    StringComparison.OrdinalIgnoreCase))
            {
                ProcessarAlteracao(
                    sistema,
                    tracing,
                    target,
                    context.InitiatingUserId);
            }
        }

        // ============================================================
        // CRIAÇÃO
        // ============================================================

        private static void ProcessarCriacao(
            IOrganizationService service,
            ITracingService tracing,
            Entity target)
        {
            var codigoExistente =
                target.GetAttributeValue<string>(
                    "dgt_codigo");

            if (!string.IsNullOrWhiteSpace(
                    codigoExistente))
            {
                tracing.Trace(
                    "Registro já possui código. Nada será alterado.");

                return;
            }

            var areaRef =
                target.GetAttributeValue<EntityReference>(
                    "dgt_area");

            if (areaRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A área do treinamento é obrigatória.");
            }

            var siglaArea =
                ObterSiglaArea(
                    service,
                    areaRef.Id,
                    validarAtiva: true);

            var sequencial =
                ObterUltimoSequencial(
                    service,
                    areaRef.Id) + 1;

            if (sequencial > SequencialMaximo)
            {
                throw new InvalidPluginExecutionException(
                    "A área atingiu o limite de 999 treinamentos.");
            }

            var codigo =
                MontarCodigo(
                    siglaArea,
                    sequencial);

            tracing.Trace(
                "Código gerado: {0}",
                codigo);

            target["dgt_sequencial"] =
                sequencial;

            target["dgt_codigo"] =
                codigo;
        }

        // ============================================================
        // ALTERAÇÃO DO SEQUENCIAL (somente Administrador)
        // ============================================================

        private static void ProcessarAlteracao(
            IOrganizationService sistema,
            ITracingService tracing,
            Entity target,
            Guid usuarioId)
        {
            var alterouSequencial =
                target.Contains(
                    "dgt_sequencial");

            var alterouCodigo =
                target.Contains(
                    "dgt_codigo");

            if (!alterouSequencial &&
                !alterouCodigo)
            {
                return;
            }

            var atual =
                sistema.Retrieve(
                    "dgt_treinamento",
                    target.Id,
                    new ColumnSet(
                        "dgt_area",
                        "dgt_sequencial",
                        "dgt_codigo"));

            var sequencialAtual =
                atual.GetAttributeValue<int?>(
                    "dgt_sequencial");

            var codigoAtual =
                atual.GetAttributeValue<string>(
                    "dgt_codigo");

            // Código enviado sem sequencial: só é aceito se for igual
            // ao atual (algumas telas reenviam todos os campos).
            if (!alterouSequencial)
            {
                var codigoEnviado =
                    target.GetAttributeValue<string>(
                        "dgt_codigo");

                if (string.Equals(
                        (codigoEnviado ?? string.Empty).Trim(),
                        (codigoAtual ?? string.Empty).Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    target.Attributes.Remove(
                        "dgt_codigo");

                    return;
                }

                throw new InvalidPluginExecutionException(
                    "O código do treinamento não pode ser editado diretamente. " +
                    "Um administrador pode alterar o sequencial, e o código é recalculado automaticamente.");
            }

            var novoSequencial =
                target.GetAttributeValue<int?>(
                    "dgt_sequencial");

            // Nada mudou de fato: mantém o código atual.
            if (novoSequencial == sequencialAtual)
            {
                if (alterouCodigo)
                {
                    target.Attributes.Remove(
                        "dgt_codigo");
                }

                return;
            }

            if (!EhAdministrador(
                    sistema,
                    usuarioId))
            {
                throw new InvalidPluginExecutionException(
                    "Somente administradores do Portal de Treinamentos podem alterar o sequencial de um treinamento.");
            }

            if (novoSequencial == null ||
                novoSequencial < 1 ||
                novoSequencial > SequencialMaximo)
            {
                throw new InvalidPluginExecutionException(
                    "O sequencial deve ser um número inteiro entre 1 e 999.");
            }

            var areaRef =
                atual.GetAttributeValue<EntityReference>(
                    "dgt_area");

            if (areaRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento não possui área. Não é possível recalcular o código.");
            }

            if (ExisteSequencialNaArea(
                    sistema,
                    areaRef.Id,
                    novoSequencial.Value,
                    target.Id))
            {
                throw new InvalidPluginExecutionException(
                    $"Já existe outro treinamento desta área com o sequencial {novoSequencial.Value:000}.");
            }

            var siglaArea =
                ObterSiglaArea(
                    sistema,
                    areaRef.Id,
                    validarAtiva: false);

            var novoCodigo =
                MontarCodigo(
                    siglaArea,
                    novoSequencial.Value);

            tracing.Trace(
                "Sequencial alterado de {0} para {1}. Código: {2} -> {3}",
                sequencialAtual,
                novoSequencial,
                codigoAtual,
                novoCodigo);

            target["dgt_codigo"] =
                novoCodigo;
        }

        // ============================================================
        // AUXILIARES
        // ============================================================

        private static string MontarCodigo(
            string siglaArea,
            int sequencial) =>
            $"{siglaArea}-TRN-{sequencial:000}";

        private static string ObterSiglaArea(
            IOrganizationService service,
            Guid areaId,
            bool validarAtiva)
        {
            var area =
                service.Retrieve(
                    "dgt_area",
                    areaId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_sigla",
                        "dgt_ativo"));

            if (validarAtiva)
            {
                var areaAtiva =
                    area.GetAttributeValue<bool?>(
                        "dgt_ativo") ?? true;

                if (!areaAtiva)
                {
                    throw new InvalidPluginExecutionException(
                        "A área selecionada está inativa.");
                }
            }

            var sigla =
                area.GetAttributeValue<string>(
                    "dgt_sigla");

            if (string.IsNullOrWhiteSpace(
                    sigla))
            {
                throw new InvalidPluginExecutionException(
                    "A área selecionada não possui sigla cadastrada.");
            }

            return NormalizarSigla(
                sigla);
        }

        private static int ObterUltimoSequencial(
            IOrganizationService service,
            Guid areaId)
        {
            var query =
                new QueryExpression(
                    "dgt_treinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_sequencial"),

                    TopCount =
                        1
                };

            query.Criteria.AddCondition(
                "dgt_area",
                ConditionOperator.Equal,
                areaId);

            query.Criteria.AddCondition(
                "dgt_sequencial",
                ConditionOperator.NotNull);

            query.AddOrder(
                "dgt_sequencial",
                OrderType.Descending);

            var ultimo =
                service
                    .RetrieveMultiple(
                        query)
                    .Entities
                    .FirstOrDefault();

            return ultimo?.GetAttributeValue<int?>(
                "dgt_sequencial") ?? 0;
        }

        private static bool ExisteSequencialNaArea(
            IOrganizationService service,
            Guid areaId,
            int sequencial,
            Guid ignorarTreinamentoId)
        {
            var query =
                new QueryExpression(
                    "dgt_treinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_treinamentoid"),

                    TopCount =
                        1
                };

            query.Criteria.AddCondition(
                "dgt_area",
                ConditionOperator.Equal,
                areaId);

            query.Criteria.AddCondition(
                "dgt_sequencial",
                ConditionOperator.Equal,
                sequencial);

            query.Criteria.AddCondition(
                "dgt_treinamentoid",
                ConditionOperator.NotEqual,
                ignorarTreinamentoId);

            return service
                .RetrieveMultiple(
                    query)
                .Entities
                .Any();
        }

        // Verifica funções diretas do usuário e funções das equipes
        // (inclusive Group Teams do Entra ID) de que ele participa.
        private static bool EhAdministrador(
            IOrganizationService service,
            Guid usuarioId)
        {
            var fetchDiretas =
                $@"<fetch distinct='true'>
                  <entity name='role'>
                    <attribute name='name' />
                    <link-entity name='systemuserroles' from='roleid' to='roleid' intersect='true'>
                      <filter>
                        <condition attribute='systemuserid' operator='eq' value='{usuarioId}' />
                      </filter>
                    </link-entity>
                  </entity>
                </fetch>";

            var fetchEquipes =
                $@"<fetch distinct='true'>
                  <entity name='role'>
                    <attribute name='name' />
                    <link-entity name='teamroles' from='roleid' to='roleid' intersect='true'>
                      <link-entity name='teammembership' from='teamid' to='teamid' intersect='true'>
                        <filter>
                          <condition attribute='systemuserid' operator='eq' value='{usuarioId}' />
                        </filter>
                      </link-entity>
                    </link-entity>
                  </entity>
                </fetch>";

            foreach (var fetch in new[] { fetchDiretas, fetchEquipes })
            {
                var funcoes =
                    service
                        .RetrieveMultiple(
                            new FetchExpression(
                                fetch))
                        .Entities;

                if (funcoes.Any(
                        funcao =>
                            FuncoesAdministrador.Contains(
                                NormalizarNome(
                                    funcao.GetAttributeValue<string>(
                                        "name")))))
                {
                    return true;
                }
            }

            return false;
        }

        private static string NormalizarNome(
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return string.Empty;
            }

            var decomposto =
                valor
                    .Trim()
                    .ToLowerInvariant()
                    .Normalize(
                        System.Text.NormalizationForm.FormD);

            var semAcento =
                new string(
                    decomposto
                        .Where(
                            c =>
                                System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) !=
                                System.Globalization.UnicodeCategory.NonSpacingMark)
                        .ToArray());

            // Padroniza traços (– — ‒) e espaços.
            semAcento =
                semAcento
                    .Replace('\u2012', '-')
                    .Replace('\u2013', '-')
                    .Replace('\u2014', '-')
                    .Replace('\u2015', '-');

            return string.Join(
                " ",
                semAcento.Split(
                    new[] { ' ' },
                    StringSplitOptions.RemoveEmptyEntries));
        }

        private static string NormalizarSigla(
            string valor)
        {
            var texto =
                valor
                    .Trim()
                    .ToUpperInvariant();

            var resultado =
                new string(
                    texto
                        .Where(
                            c =>
                                char.IsLetterOrDigit(c))
                        .ToArray());

            if (string.IsNullOrWhiteSpace(
                    resultado))
            {
                throw new InvalidPluginExecutionException(
                    "A sigla da área é inválida.");
            }

            return resultado;
        }
    }
}
