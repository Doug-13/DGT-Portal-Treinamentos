using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace DGT.Treinamentos.Plugins
{
    public sealed class ProcessarAtribuicaoPlugin : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context =
                (IPluginExecutionContext)serviceProvider.GetService(
                    typeof(IPluginExecutionContext));

            var factory =
                (IOrganizationServiceFactory)serviceProvider.GetService(
                    typeof(IOrganizationServiceFactory));

            var service =
                factory.CreateOrganizationService(
                    context.UserId);

            try
            {
                var payloadJson =
                    context.InputParameters.Contains("PayloadJson")
                        ? context.InputParameters["PayloadJson"] as string
                        : null;

                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    throw new InvalidPluginExecutionException(
                        "PayloadJson não foi informado.");
                }

                var payload =
                    JsonConvert.DeserializeObject<PayloadAtribuicao>(
                        payloadJson);

                if (payload == null)
                {
                    throw new InvalidPluginExecutionException(
                        "Payload da atribuição inválido.");
                }

                var resultado =
                    Processar(
                        service,
                        payload);

                context.OutputParameters["ResultadoJson"] =
                    JsonConvert.SerializeObject(
                        resultado);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException(
                    "Não foi possível processar a atribuição: " +
                    ex.Message,
                    ex);
            }
        }

        private static ResultadoAtribuicao Processar(
            IOrganizationService service,
            PayloadAtribuicao payload)
        {
            Guid usuarioId;
            Guid treinamentoId;
            Guid trilhaId = Guid.Empty;

            if (!Guid.TryParse(
                    payload.UsuarioId,
                    out usuarioId))
            {
                throw new InvalidPluginExecutionException(
                    "UsuarioId inválido.");
            }

            if (!Guid.TryParse(
                    payload.TreinamentoId,
                    out treinamentoId))
            {
                throw new InvalidPluginExecutionException(
                    "TreinamentoId inválido.");
            }

            if (!string.IsNullOrWhiteSpace(
                    payload.TrilhaId) &&
                !Guid.TryParse(
                    payload.TrilhaId,
                    out trilhaId))
            {
                throw new InvalidPluginExecutionException(
                    "TrilhaId inválido.");
            }

            // =====================================================
            // USUÁRIO
            // =====================================================

            var usuario =
                service.Retrieve(
                    "dgt_usuario",
                    usuarioId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_email",
                        "dgt_ativo"));

            if (usuario.GetAttributeValue<bool?>(
                    "dgt_ativo") == false)
            {
                throw new InvalidPluginExecutionException(
                    "O usuário informado está inativo.");
            }

            // =====================================================
            // TREINAMENTO
            // =====================================================

            var treinamento =
                service.Retrieve(
                    "dgt_treinamento",
                    treinamentoId,
                    new ColumnSet(
                        "dgt_name",
                        "dgt_codigo",
                        "dgt_ativo",
                        "dgt_validademeses"));

            if (treinamento.GetAttributeValue<bool?>(
                    "dgt_ativo") == false)
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento informado está inativo.");
            }

            // =====================================================
            // TRILHA
            // Não presumimos mais que exista dgt_ativo.
            // O ambiente atual mostrou que esse atributo não existe.
            // =====================================================

            if (trilhaId != Guid.Empty)
            {
                service.Retrieve(
                    "dgt_trilha",
                    trilhaId,
                    new ColumnSet(
                        "dgt_name"));

                ValidarTreinamentoNaTrilha(
                    service,
                    trilhaId,
                    treinamentoId);
            }

            // =====================================================
            // 1. EVITAR DUPLICIDADE
            // =====================================================
            // Revisão documental e Reciclagem representam uma NOVA
            // obrigação de treinamento. Nesses casos, conclusões antigas
            // não devem bloquear a criação de uma nova atribuição.
            // A duplicidade passa a ser controlada por Origem + OrigemId.
            // =====================================================

            var novaObrigacao =
                EhNovaObrigacao(
                    payload.Origem);

            var existente =
                BuscarAtribuicaoExistente(
                    service,
                    usuarioId,
                    treinamentoId,
                    trilhaId,
                    novaObrigacao
                        ? payload.Origem
                        : null,
                    novaObrigacao
                        ? payload.OrigemId
                        : null);

            if (existente != null)
            {
                return new ResultadoAtribuicao
                {
                    sucesso = true,
                    mensagem =
                        "O usuário já possui esta atribuição.",
                    usuarioTreinamentoId =
                        existente.Id.ToString(),
                    reutilizado = true,
                    criado = false,
                    liberado =
                        existente.GetAttributeValue<bool?>(
                            "dgt_liberado") == true
                };
            }

            // =====================================================
            // 2. REAPROVEITAR CONCLUSÃO VÁLIDA
            // =====================================================

            var conclusaoValida =
                novaObrigacao
                    ? null
                    : BuscarConclusaoValida(
                        service,
                        usuarioId,
                        treinamentoId);

            if (conclusaoValida != null)
            {
                return new ResultadoAtribuicao
                {
                    sucesso = true,
                    mensagem =
                        "Treinamento já concluído e ainda válido. " +
                        "A conclusão existente foi reaproveitada.",
                    usuarioTreinamentoId =
                        conclusaoValida.Id.ToString(),
                    reutilizado = true,
                    criado = false,
                    liberado = true
                };
            }

            // =====================================================
            // 3. VERIFICAR LIBERAÇÃO
            // =====================================================

            var liberado =
                trilhaId == Guid.Empty ||
                PodeLiberarNaTrilha(
                    service,
                    usuarioId,
                    trilhaId,
                    treinamentoId);

            // =====================================================
            // 4. CRIAR ATRIBUIÇÃO
            // =====================================================

            var nova =
                new Entity(
                    "dgt_usuariotreinamento");

            nova["dgt_name"] =
                MontarNome(
                    usuario,
                    treinamento);

            nova["dgt_usuario"] =
                new EntityReference(
                    "dgt_usuario",
                    usuarioId);

            nova["dgt_treinamento"] =
                new EntityReference(
                    "dgt_treinamento",
                    treinamentoId);

            if (trilhaId != Guid.Empty)
            {
                nova["dgt_trilha"] =
                    new EntityReference(
                        "dgt_trilha",
                        trilhaId);
            }

            nova["dgt_liberado"] =
                liberado;

            TrySetBooleano(
                service,
                nova,
                "dgt_ativo",
                true);

            if (liberado)
            {
                TrySetData(
                    service,
                    nova,
                    "dgt_dataliberacao",
                    DateTime.UtcNow);
            }

            var status =
                ObterOpcaoPorRotulo(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_status",
                    liberado
                        ? "Disponível"
                        : "Bloqueado");

            if (status.HasValue)
            {
                nova["dgt_status"] =
                    new OptionSetValue(
                        status.Value);
            }

            TrySetTextoOuOpcao(
                service,
                nova,
                "dgt_origem",
                payload.Origem);

            TrySetTexto(
                service,
                nova,
                "dgt_origemid",
                payload.OrigemId);

            TrySetTexto(
                service,
                nova,
                "dgt_observacao",
                payload.Observacao);

            DateTime dataLimite;

            if (DateTime.TryParse(
                    payload.DataLimite,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal |
                    DateTimeStyles.AdjustToUniversal,
                    out dataLimite))
            {
                TrySetData(
                    service,
                    nova,
                    "dgt_datalimite",
                    dataLimite);
            }

            var id =
                service.Create(
                    nova);

            return new ResultadoAtribuicao
            {
                sucesso = true,
                mensagem =
                    liberado
                        ? "Treinamento atribuído e liberado para o usuário."
                        : "Treinamento atribuído, porém bloqueado pelos pré-requisitos da trilha.",
                usuarioTreinamentoId =
                    id.ToString(),
                reutilizado = false,
                criado = true,
                liberado = liberado
            };
        }

        // =========================================================
        // BUSCAS
        // =========================================================

        private static Entity BuscarAtribuicaoExistente(
            IOrganizationService service,
            Guid usuarioId,
            Guid treinamentoId,
            Guid trilhaId,
            string origem,
            string origemId)
        {
            var q =
                new QueryExpression(
                    "dgt_usuariotreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_usuariotreinamentoid",
                            "dgt_liberado",
                            "dgt_status",
                            "dgt_dataconclusao",
                            "dgt_datavalidade")
                };

            q.Criteria.AddCondition(
                "dgt_usuario",
                ConditionOperator.Equal,
                usuarioId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            if (AtributoExiste(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_ativo"))
            {
                q.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            if (trilhaId != Guid.Empty)
            {
                q.Criteria.AddCondition(
                    "dgt_trilha",
                    ConditionOperator.Equal,
                    trilhaId);
            }
            else
            {
                q.Criteria.AddCondition(
                    "dgt_trilha",
                    ConditionOperator.Null);
            }

            if (!string.IsNullOrWhiteSpace(
                    origem) &&
                AtributoExiste(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_origem"))
            {
                var metadataOrigem =
                    ObterAtributo(
                        service,
                        "dgt_usuariotreinamento",
                        "dgt_origem");

                if (metadataOrigem is StringAttributeMetadata ||
                    metadataOrigem is MemoAttributeMetadata)
                {
                    q.Criteria.AddCondition(
                        "dgt_origem",
                        ConditionOperator.Equal,
                        origem);
                }
                else if (metadataOrigem is PicklistAttributeMetadata)
                {
                    var opcaoOrigem =
                        ObterOpcaoPorRotulo(
                            service,
                            "dgt_usuariotreinamento",
                            "dgt_origem",
                            origem);

                    if (opcaoOrigem.HasValue)
                    {
                        q.Criteria.AddCondition(
                            "dgt_origem",
                            ConditionOperator.Equal,
                            opcaoOrigem.Value);
                    }
                }
            }

            if (!string.IsNullOrWhiteSpace(
                    origemId) &&
                AtributoExiste(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_origemid"))
            {
                q.Criteria.AddCondition(
                    "dgt_origemid",
                    ConditionOperator.Equal,
                    origemId);
            }

            q.AddOrder(
                "createdon",
                OrderType.Descending);

            q.TopCount = 1;

            return service
                .RetrieveMultiple(q)
                .Entities
                .FirstOrDefault();
        }

        private static Entity BuscarConclusaoValida(
            IOrganizationService service,
            Guid usuarioId,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_usuariotreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_usuariotreinamentoid",
                            "dgt_dataconclusao",
                            "dgt_datavalidade",
                            "dgt_status",
                            "dgt_liberado")
                };

            q.Criteria.AddCondition(
                "dgt_usuario",
                ConditionOperator.Equal,
                usuarioId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            q.Criteria.AddCondition(
                "dgt_dataconclusao",
                ConditionOperator.NotNull);

            if (AtributoExiste(
                    service,
                    "dgt_usuariotreinamento",
                    "dgt_ativo"))
            {
                q.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            q.AddOrder(
                "dgt_dataconclusao",
                OrderType.Descending);

            var itens =
                service
                    .RetrieveMultiple(q)
                    .Entities;

            foreach (var item in itens)
            {
                var validade =
                    item.GetAttributeValue<DateTime?>(
                        "dgt_datavalidade");

                if (!validade.HasValue ||
                    validade.Value.ToUniversalTime() >
                    DateTime.UtcNow)
                {
                    return item;
                }
            }

            return null;
        }

        private static void ValidarTreinamentoNaTrilha(
            IOrganizationService service,
            Guid trilhaId,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_trilhatreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_trilhatreinamentoid")
                };

            q.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            if (AtributoExiste(
                    service,
                    "dgt_trilhatreinamento",
                    "dgt_ativo"))
            {
                q.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            q.TopCount = 1;

            if (!service
                    .RetrieveMultiple(q)
                    .Entities
                    .Any())
            {
                throw new InvalidPluginExecutionException(
                    "O treinamento não pertence à trilha informada.");
            }
        }

        private static bool PodeLiberarNaTrilha(
            IOrganizationService service,
            Guid usuarioId,
            Guid trilhaId,
            Guid treinamentoId)
        {
            var atual =
                BuscarRelacaoTrilha(
                    service,
                    trilhaId,
                    treinamentoId);

            if (atual == null)
            {
                return true;
            }

            var ordemAtual =
                atual.GetAttributeValue<int?>(
                    "dgt_ordem") ?? 0;

            if (ordemAtual <= 1)
            {
                return true;
            }

            var anteriores =
                new QueryExpression(
                    "dgt_trilhatreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_treinamento",
                            "dgt_ordem",
                            "dgt_obrigatorio")
                };

            anteriores.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            anteriores.Criteria.AddCondition(
                "dgt_ordem",
                ConditionOperator.LessThan,
                ordemAtual);

            if (AtributoExiste(
                    service,
                    "dgt_trilhatreinamento",
                    "dgt_ativo"))
            {
                anteriores.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            anteriores.AddOrder(
                "dgt_ordem",
                OrderType.Ascending);

            var relacoes =
                service
                    .RetrieveMultiple(
                        anteriores)
                    .Entities;

            foreach (var relacao in relacoes)
            {
                var obrigatorio =
                    relacao.GetAttributeValue<bool?>(
                        "dgt_obrigatorio") ?? true;

                if (!obrigatorio)
                {
                    continue;
                }

                var treinamento =
                    relacao.GetAttributeValue<EntityReference>(
                        "dgt_treinamento");

                if (treinamento == null)
                {
                    continue;
                }

                if (!UsuarioPossuiConclusaoValida(
                        service,
                        usuarioId,
                        treinamento.Id))
                {
                    return false;
                }
            }

            return true;
        }

        private static Entity BuscarRelacaoTrilha(
            IOrganizationService service,
            Guid trilhaId,
            Guid treinamentoId)
        {
            var q =
                new QueryExpression(
                    "dgt_trilhatreinamento")
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_trilhatreinamentoid",
                            "dgt_ordem",
                            "dgt_obrigatorio")
                };

            q.Criteria.AddCondition(
                "dgt_trilha",
                ConditionOperator.Equal,
                trilhaId);

            q.Criteria.AddCondition(
                "dgt_treinamento",
                ConditionOperator.Equal,
                treinamentoId);

            if (AtributoExiste(
                    service,
                    "dgt_trilhatreinamento",
                    "dgt_ativo"))
            {
                q.Criteria.AddCondition(
                    "dgt_ativo",
                    ConditionOperator.Equal,
                    true);
            }

            q.TopCount = 1;

            return service
                .RetrieveMultiple(q)
                .Entities
                .FirstOrDefault();
        }

        private static bool UsuarioPossuiConclusaoValida(
            IOrganizationService service,
            Guid usuarioId,
            Guid treinamentoId)
        {
            return BuscarConclusaoValida(
                       service,
                       usuarioId,
                       treinamentoId) !=
                   null;
        }

        private static bool EhNovaObrigacao(
            string origem)
        {
            if (string.IsNullOrWhiteSpace(
                    origem))
            {
                return false;
            }

            var valor =
                origem
                    .Trim()
                    .ToLowerInvariant();

            return
                valor == "revisão documental" ||
                valor == "revisao documental" ||
                valor == "reciclagem";
        }

        // =========================================================
        // METADADOS / CAMPOS OPCIONAIS
        // =========================================================

        private static bool AtributoExiste(
            IOrganizationService service,
            string entidade,
            string atributo)
        {
            return ObterAtributo(
                       service,
                       entidade,
                       atributo) !=
                   null;
        }

        private static AttributeMetadata ObterAtributo(
            IOrganizationService service,
            string entidade,
            string atributo)
        {
            try
            {
                var response =
                    (RetrieveAttributeResponse)
                    service.Execute(
                        new RetrieveAttributeRequest
                        {
                            EntityLogicalName =
                                entidade,
                            LogicalName =
                                atributo,
                            RetrieveAsIfPublished =
                                true
                        });

                return response.AttributeMetadata;
            }
            catch
            {
                return null;
            }
        }

        private static int? ObterOpcaoPorRotulo(
            IOrganizationService service,
            string entidade,
            string atributo,
            string rotulo)
        {
            try
            {
                var metadata =
                    ObterAtributo(
                        service,
                        entidade,
                        atributo)
                    as PicklistAttributeMetadata;

                if (metadata == null ||
                    metadata.OptionSet == null)
                {
                    return null;
                }

                foreach (var option in
                    metadata.OptionSet.Options)
                {
                    var label =
                        option.Label
                              ?.UserLocalizedLabel
                              ?.Label;

                    if (string.Equals(
                            label,
                            rotulo,
                            StringComparison
                                .OrdinalIgnoreCase))
                    {
                        return option.Value;
                    }
                }

                return null;
            }
            catch
            {
                return null;
            }
        }

        private static void TrySetTexto(
            IOrganizationService service,
            Entity entity,
            string atributo,
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return;
            }

            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo);

            if (metadata is StringAttributeMetadata ||
                metadata is MemoAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetData(
            IOrganizationService service,
            Entity entity,
            string atributo,
            DateTime valor)
        {
            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo);

            if (metadata is DateTimeAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetBooleano(
            IOrganizationService service,
            Entity entity,
            string atributo,
            bool valor)
        {
            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo);

            if (metadata is BooleanAttributeMetadata)
            {
                entity[atributo] =
                    valor;
            }
        }

        private static void TrySetTextoOuOpcao(
            IOrganizationService service,
            Entity entity,
            string atributo,
            string valor)
        {
            if (string.IsNullOrWhiteSpace(valor))
            {
                return;
            }

            var metadata =
                ObterAtributo(
                    service,
                    entity.LogicalName,
                    atributo);

            if (metadata is StringAttributeMetadata ||
                metadata is MemoAttributeMetadata)
            {
                entity[atributo] =
                    valor;

                return;
            }

            if (metadata is PicklistAttributeMetadata)
            {
                var opcao =
                    ObterOpcaoPorRotulo(
                        service,
                        entity.LogicalName,
                        atributo,
                        valor);

                if (opcao.HasValue)
                {
                    entity[atributo] =
                        new OptionSetValue(
                            opcao.Value);
                }
            }
        }

        // =========================================================
        // UTILIDADES
        // =========================================================

        private static string MontarNome(
            Entity usuario,
            Entity treinamento)
        {
            var usuarioNome =
                usuario.GetAttributeValue<string>(
                    "dgt_name") ??
                "Usuário";

            var treinamentoNome =
                treinamento.GetAttributeValue<string>(
                    "dgt_name") ??
                "Treinamento";

            return usuarioNome +
                   " - " +
                   treinamentoNome +
                   " - " +
                   DateTime.UtcNow.ToString(
                       "yyyyMMddHHmmss",
                       CultureInfo.InvariantCulture);
        }

        // =========================================================
        // DTOs
        // =========================================================

        private sealed class PayloadAtribuicao
        {
            public string UsuarioId { get; set; }
            public string TreinamentoId { get; set; }
            public string TrilhaId { get; set; }
            public string Origem { get; set; }
            public string OrigemId { get; set; }
            public string DataLimite { get; set; }
            public string Observacao { get; set; }
        }

        private sealed class ResultadoAtribuicao
        {
            public bool sucesso { get; set; }
            public string mensagem { get; set; }
            public string usuarioTreinamentoId { get; set; }
            public bool reutilizado { get; set; }
            public bool criado { get; set; }
            public bool liberado { get; set; }
        }
    }
}
