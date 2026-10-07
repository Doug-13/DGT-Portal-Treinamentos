using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // ATRIBUIÇÃO DE TRILHA POR ÁREA
    //
    // Regra de negócio:
    //   Trilha liberada para uma área (dgt_trilhaarea ativa) ou para
    //   todas as áreas (dgt_trilha.dgt_todasareas = Sim)
    //   => todos os membros ativos dessas áreas recebem TODOS os
    //      treinamentos ativos da trilha (dgt_trilhatreinamento),
    //      inclusive quem entrar na área / na empresa depois.
    //
    // Gatilhos (todos ASSÍNCRONOS, PostOperation (40), com Post Image
    // "PostImage" contendo todos os atributos):
    //
    //   dgt_trilhaarea          Create
    //   dgt_trilhaarea          Update  (Filtering: dgt_ativo, dgt_area, dgt_trilha)
    //       -> membros da área x treinamentos da trilha
    //
    //   dgt_usuarioarea         Create
    //   dgt_usuarioarea         Update  (Filtering: dgt_ativo, dgt_area)
    //       -> trilhas da área + trilhas "todas as áreas" x usuário
    //
    //   dgt_trilhatreinamento   Create
    //   dgt_trilhatreinamento   Update  (Filtering: dgt_ativo)
    //       -> público da trilha x novo treinamento
    //
    //   dgt_trilha              Update  (Filtering: dgt_todasareas, dgt_ativa)
    //       -> público da trilha x treinamentos da trilha
    //
    //   dgt_usuario             Create
    //   dgt_usuario             Update  (Filtering: dgt_ativo)
    //       -> trilhas "todas as áreas" (+ trilhas das áreas dele)
    //
    // Cada atribuição reutiliza a Custom API dgt_ProcessarAtribuicao,
    // que já trata: duplicidade (usuário + treinamento + trilha),
    // reaproveitamento de conclusões válidas, sequência/pré-requisitos
    // da trilha e liberação do primeiro treinamento.
    //
    // Os treinamentos são processados SEMPRE em ordem crescente de
    // dgt_ordem, para que a regra de liberação da trilha funcione.
    //
    // Nunca remove atribuições: retirar a área da trilha, desativar a
    // trilha ou retirar a pessoa da área apenas interrompe NOVAS
    // atribuições. Histórico preservado.
    // ================================================================
    public sealed class AtribuirTrilhaPorAreaPlugin : IPlugin
    {
        private const string TabelaTrilha = "dgt_trilha";
        private const string TabelaTrilhaArea = "dgt_trilhaarea";
        private const string TabelaTrilhaTreinamento = "dgt_trilhatreinamento";
        private const string TabelaUsuarioArea = "dgt_usuarioarea";
        private const string TabelaUsuario = "dgt_usuario";
        private const string TabelaErro = "dgt_erroautomacao";

        private const string ApiAtribuicao = "dgt_ProcessarAtribuicao";
        private const string Origem = "Grupo";

        // Plugins assíncronos têm limite de 2 minutos. Paramos antes
        // e registramos o que ficou pendente em dgt_erroautomacao.
        private static readonly TimeSpan LimiteTempo = TimeSpan.FromSeconds(100);

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

            // Executa como SYSTEM: a configuração é feita por um
            // administrador, mas a atribuição também acontece quando um
            // colaborador comum é cadastrado ou vinculado a uma área.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            var imagem =
                context.PostEntityImages.Contains("PostImage")
                    ? context.PostEntityImages["PostImage"]
                    : context.InputParameters.Contains("Target")
                        ? context.InputParameters["Target"] as Entity
                        : null;

            if (imagem == null)
            {
                tracing.Trace("Sem imagem/target. Nada a fazer.");
                return;
            }

            var entidade =
                (context.PrimaryEntityName ?? string.Empty).ToLowerInvariant();

            List<Par> pares;

            switch (entidade)
            {
                case TabelaTrilhaArea:
                    pares = ParesDaTrilhaArea(sistema, context.PrimaryEntityId, imagem);
                    break;

                case TabelaUsuarioArea:
                    pares = ParesDoVinculoArea(sistema, imagem);
                    break;

                case TabelaTrilhaTreinamento:
                    pares = ParesDoTreinamentoNaTrilha(sistema, imagem);
                    break;

                case TabelaTrilha:
                    pares = ParesDaTrilha(sistema, context, imagem);
                    break;

                case TabelaUsuario:
                    pares = ParesDoUsuario(sistema, context.PrimaryEntityId, imagem);
                    break;

                default:
                    return;
            }

            // Ordem obrigatória: por usuário, por trilha, por dgt_ordem.
            pares =
                pares
                    .GroupBy(p => p.UsuarioId + "|" + p.TrilhaId + "|" + p.TreinamentoId)
                    .Select(g => g.First())
                    .OrderBy(p => p.UsuarioId)
                    .ThenBy(p => p.TrilhaId)
                    .ThenBy(p => p.Ordem)
                    .ToList();

            tracing.Trace(
                "{0}: {1} atribuição(ões) a processar.",
                entidade,
                pares.Count);

            var relogio = Stopwatch.StartNew();
            var processadas = 0;
            var falhas = new List<string>();

            foreach (var par in pares)
            {
                if (relogio.Elapsed > LimiteTempo)
                {
                    break;
                }

                try
                {
                    Atribuir(sistema, par);
                }
                catch (Exception ex)
                {
                    // Uma pessoa com problema (ex.: usuário ou treinamento
                    // inativo) não impede as demais.
                    falhas.Add(
                        string.Format(
                            CultureInfo.InvariantCulture,
                            "Usuário {0} / Treinamento {1} / Trilha {2}: {3}",
                            par.UsuarioId,
                            par.TreinamentoId,
                            par.TrilhaId,
                            ex.Message));
                }

                processadas++;
            }

            var pendentes = pares.Count - processadas;

            tracing.Trace(
                "Processadas: {0}. Falhas: {1}. Pendentes por tempo: {2}.",
                processadas,
                falhas.Count,
                pendentes);

            foreach (var falha in falhas.Take(20))
            {
                tracing.Trace("{0}", falha);
            }

            if (pendentes > 0 || falhas.Count > 0)
            {
                RegistrarOcorrencia(
                    sistema,
                    tracing,
                    entidade,
                    context.PrimaryEntityId,
                    processadas,
                    falhas,
                    pares.Skip(processadas).ToList());
            }
        }

        // ============================================================
        // ÁREA VINCULADA À TRILHA -> membros da área
        // ============================================================

        private static List<Par> ParesDaTrilhaArea(
            IOrganizationService sistema,
            Guid trilhaAreaId,
            Entity trilhaArea)
        {
            var resultado = new List<Par>();

            if (trilhaArea.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                return resultado;
            }

            var trilha = trilhaArea.GetAttributeValue<EntityReference>("dgt_trilha");
            var area = trilhaArea.GetAttributeValue<EntityReference>("dgt_area");

            if (trilha == null || area == null || !TrilhaAtiva(sistema, trilha.Id))
            {
                return resultado;
            }

            var treinamentos = TreinamentosDaTrilha(sistema, trilha.Id);

            if (treinamentos.Count == 0)
            {
                return resultado;
            }

            // Se a pessoa pertence a mais de uma área vinculada a esta
            // trilha, apenas UM vínculo (o de menor id) a processa.
            // Assim, ao salvar várias áreas de uma vez, os processamentos
            // assíncronos paralelos não atribuem a mesma pessoa em dobro.
            var donoPorUsuario = DonoPorUsuario(sistema, trilha.Id);

            foreach (var usuarioId in MembrosAtivosDaArea(sistema, area.Id))
            {
                Guid dono;

                if (donoPorUsuario.TryGetValue(usuarioId, out dono) &&
                    dono != trilhaAreaId)
                {
                    continue;
                }

                resultado.AddRange(
                    MontarPares(
                        usuarioId,
                        trilha,
                        treinamentos,
                        trilhaAreaId,
                        "área " + (area.Name ?? string.Empty)));
            }

            return resultado;
        }

        private static Dictionary<Guid, Guid> DonoPorUsuario(
            IOrganizationService sistema,
            Guid trilhaId)
        {
            var dono = new Dictionary<Guid, Guid>();

            var consulta =
                new QueryExpression(TabelaTrilhaArea)
                {
                    ColumnSet = new ColumnSet("dgt_area")
                };

            consulta.Criteria.AddCondition("dgt_trilha", ConditionOperator.Equal, trilhaId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            foreach (var relacao in sistema.RetrieveMultiple(consulta).Entities)
            {
                var area = relacao.GetAttributeValue<EntityReference>("dgt_area");

                if (area == null)
                {
                    continue;
                }

                foreach (var usuarioId in MembrosAtivosDaArea(sistema, area.Id))
                {
                    Guid atual;

                    if (!dono.TryGetValue(usuarioId, out atual) ||
                        string.CompareOrdinal(
                            relacao.Id.ToString("N"),
                            atual.ToString("N")) < 0)
                    {
                        dono[usuarioId] = relacao.Id;
                    }
                }
            }

            return dono;
        }

        // ============================================================
        // PESSOA ENTROU NA ÁREA -> trilhas da área + "todas as áreas"
        // ============================================================

        private static List<Par> ParesDoVinculoArea(
            IOrganizationService sistema,
            Entity vinculo)
        {
            var resultado = new List<Par>();

            if (vinculo.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                return resultado;
            }

            var usuario = vinculo.GetAttributeValue<EntityReference>("dgt_usuario");
            var area = vinculo.GetAttributeValue<EntityReference>("dgt_area");

            if (usuario == null || area == null || !UsuarioAtivo(sistema, usuario.Id))
            {
                return resultado;
            }

            // Trilhas restritas à área
            foreach (var origem in TrilhasDaArea(sistema, area.Id))
            {
                resultado.AddRange(
                    MontarPares(
                        usuario.Id,
                        origem.Trilha,
                        TreinamentosDaTrilha(sistema, origem.Trilha.Id),
                        origem.OrigemId,
                        "área " + (area.Name ?? string.Empty)));
            }

            // Trilhas "todas as áreas" são atribuídas no cadastro /
            // reativação do usuário (evento de dgt_usuario), e não
            // aqui, para não processar a mesma pessoa duas vezes ao
            // mesmo tempo quando o usuário é cadastrado já com área.

            return resultado;
        }

        // ============================================================
        // NOVO TREINAMENTO NA TRILHA -> público da trilha
        // ============================================================

        private static List<Par> ParesDoTreinamentoNaTrilha(
            IOrganizationService sistema,
            Entity relacao)
        {
            var resultado = new List<Par>();

            if (relacao.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                return resultado;
            }

            var trilha = relacao.GetAttributeValue<EntityReference>("dgt_trilha");
            var treinamento = relacao.GetAttributeValue<EntityReference>("dgt_treinamento");

            if (trilha == null || treinamento == null || !TrilhaAtiva(sistema, trilha.Id))
            {
                return resultado;
            }

            var item = new ItemTrilha
            {
                TreinamentoId = treinamento.Id,
                Ordem = relacao.GetAttributeValue<int?>("dgt_ordem") ?? 0,
                PrazoDias = relacao.GetAttributeValue<int?>("dgt_diasparaconclusao")
            };

            foreach (var publico in PublicoDaTrilha(sistema, trilha.Id))
            {
                resultado.AddRange(
                    MontarPares(
                        publico.UsuarioId,
                        trilha,
                        new List<ItemTrilha> { item },
                        publico.OrigemId,
                        publico.Descricao));
            }

            return resultado;
        }

        // ============================================================
        // TRILHA ALTERADA (todas as áreas / reativada) -> público
        // ============================================================

        private static List<Par> ParesDaTrilha(
            IOrganizationService sistema,
            IPluginExecutionContext context,
            Entity trilha)
        {
            var resultado = new List<Par>();
            var trilhaId = context.PrimaryEntityId;

            if (trilha.GetAttributeValue<bool?>("dgt_ativa") == false)
            {
                return resultado;
            }

            var alvo =
                context.InputParameters.Contains("Target")
                    ? context.InputParameters["Target"] as Entity
                    : null;

            var reativada =
                alvo != null &&
                alvo.Contains("dgt_ativa") &&
                alvo.GetAttributeValue<bool?>("dgt_ativa") == true;

            var todasAreas =
                trilha.GetAttributeValue<bool?>("dgt_todasareas") == true;

            // Áreas específicas já são tratadas pelos eventos de
            // dgt_trilhaarea. Aqui só agimos quando a trilha passou a
            // valer para todas as áreas ou foi reativada. Isso evita
            // dois processamentos simultâneos das mesmas pessoas.
            if (!todasAreas && !reativada)
            {
                return resultado;
            }

            var referencia =
                new EntityReference(TabelaTrilha, trilhaId)
                {
                    Name = trilha.GetAttributeValue<string>("dgt_name")
                };

            var treinamentos = TreinamentosDaTrilha(sistema, trilhaId);

            if (treinamentos.Count == 0)
            {
                return resultado;
            }

            foreach (var publico in PublicoDaTrilha(sistema, trilhaId))
            {
                resultado.AddRange(
                    MontarPares(
                        publico.UsuarioId,
                        referencia,
                        treinamentos,
                        publico.OrigemId,
                        publico.Descricao));
            }

            return resultado;
        }

        // ============================================================
        // NOVO COLABORADOR / REATIVADO -> todas as trilhas dele
        // ============================================================

        private static List<Par> ParesDoUsuario(
            IOrganizationService sistema,
            Guid usuarioId,
            Entity usuario)
        {
            var resultado = new List<Par>();

            if (usuario.GetAttributeValue<bool?>("dgt_ativo") == false)
            {
                return resultado;
            }

            // Trilhas liberadas para todas as áreas
            foreach (var trilha in TrilhasTodasAreas(sistema))
            {
                resultado.AddRange(
                    MontarPares(
                        usuarioId,
                        trilha,
                        TreinamentosDaTrilha(sistema, trilha.Id),
                        trilha.Id,
                        "todas as áreas"));
            }

            // Trilhas das áreas em que ele já está (caso de reativação)
            var consulta =
                new QueryExpression(TabelaUsuarioArea)
                {
                    ColumnSet = new ColumnSet("dgt_area")
                };

            consulta.Criteria.AddCondition("dgt_usuario", ConditionOperator.Equal, usuarioId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            foreach (var vinculo in sistema.RetrieveMultiple(consulta).Entities)
            {
                var area = vinculo.GetAttributeValue<EntityReference>("dgt_area");

                if (area == null)
                {
                    continue;
                }

                foreach (var origem in TrilhasDaArea(sistema, area.Id))
                {
                    resultado.AddRange(
                        MontarPares(
                            usuarioId,
                            origem.Trilha,
                            TreinamentosDaTrilha(sistema, origem.Trilha.Id),
                            origem.OrigemId,
                            "área " + (area.Name ?? string.Empty)));
                }
            }

            return resultado;
        }

        // ============================================================
        // CONSULTAS
        // ============================================================

        private static bool TrilhaAtiva(
            IOrganizationService sistema,
            Guid trilhaId)
        {
            var trilha =
                sistema.Retrieve(
                    TabelaTrilha,
                    trilhaId,
                    new ColumnSet("dgt_ativa"));

            return trilha.GetAttributeValue<bool?>("dgt_ativa") != false;
        }

        private static bool UsuarioAtivo(
            IOrganizationService sistema,
            Guid usuarioId)
        {
            var usuario =
                sistema.Retrieve(
                    TabelaUsuario,
                    usuarioId,
                    new ColumnSet("dgt_ativo"));

            return usuario.GetAttributeValue<bool?>("dgt_ativo") != false;
        }

        private static List<ItemTrilha> TreinamentosDaTrilha(
            IOrganizationService sistema,
            Guid trilhaId)
        {
            var consulta =
                new QueryExpression(TabelaTrilhaTreinamento)
                {
                    ColumnSet = new ColumnSet(
                        "dgt_treinamento",
                        "dgt_ordem",
                        "dgt_diasparaconclusao")
                };

            consulta.Criteria.AddCondition("dgt_trilha", ConditionOperator.Equal, trilhaId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);
            consulta.AddOrder("dgt_ordem", OrderType.Ascending);

            return
                sistema.RetrieveMultiple(consulta)
                    .Entities
                    .Where(r => r.GetAttributeValue<EntityReference>("dgt_treinamento") != null)
                    .Select(r => new ItemTrilha
                    {
                        TreinamentoId = r.GetAttributeValue<EntityReference>("dgt_treinamento").Id,
                        Ordem = r.GetAttributeValue<int?>("dgt_ordem") ?? 0,
                        PrazoDias = r.GetAttributeValue<int?>("dgt_diasparaconclusao")
                    })
                    .ToList();
        }

        private static List<Guid> MembrosAtivosDaArea(
            IOrganizationService sistema,
            Guid areaId)
        {
            var consulta =
                new QueryExpression(TabelaUsuarioArea)
                {
                    ColumnSet = new ColumnSet("dgt_usuario")
                };

            consulta.Criteria.AddCondition("dgt_area", ConditionOperator.Equal, areaId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            // Somente usuários ativos no portal
            var usuario =
                consulta.AddLink(
                    TabelaUsuario,
                    "dgt_usuario",
                    "dgt_usuarioid");

            usuario.LinkCriteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);

            return
                sistema.RetrieveMultiple(consulta)
                    .Entities
                    .Select(v => v.GetAttributeValue<EntityReference>("dgt_usuario"))
                    .Where(u => u != null)
                    .Select(u => u.Id)
                    .Distinct()
                    .ToList();
        }

        private static List<Guid> UsuariosAtivos(
            IOrganizationService sistema)
        {
            var resultado = new List<Guid>();

            var consulta =
                new QueryExpression(TabelaUsuario)
                {
                    ColumnSet = new ColumnSet("dgt_usuarioid"),
                    PageInfo = new PagingInfo { PageNumber = 1, Count = 5000 }
                };

            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);

            while (true)
            {
                var pagina = sistema.RetrieveMultiple(consulta);

                resultado.AddRange(pagina.Entities.Select(e => e.Id));

                if (!pagina.MoreRecords)
                {
                    break;
                }

                consulta.PageInfo.PageNumber++;
                consulta.PageInfo.PagingCookie = pagina.PagingCookie;
            }

            return resultado;
        }

        private static List<OrigemTrilha> TrilhasDaArea(
            IOrganizationService sistema,
            Guid areaId)
        {
            var consulta =
                new QueryExpression(TabelaTrilhaArea)
                {
                    ColumnSet = new ColumnSet("dgt_trilha")
                };

            consulta.Criteria.AddCondition("dgt_area", ConditionOperator.Equal, areaId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            // Somente trilhas ativas
            var trilha =
                consulta.AddLink(
                    TabelaTrilha,
                    "dgt_trilha",
                    "dgt_trilhaid");

            trilha.LinkCriteria.AddCondition("dgt_ativa", ConditionOperator.NotEqual, false);

            return
                sistema.RetrieveMultiple(consulta)
                    .Entities
                    .Where(r => r.GetAttributeValue<EntityReference>("dgt_trilha") != null)
                    .Select(r => new OrigemTrilha
                    {
                        Trilha = r.GetAttributeValue<EntityReference>("dgt_trilha"),
                        OrigemId = r.Id
                    })
                    .ToList();
        }

        private static List<EntityReference> TrilhasTodasAreas(
            IOrganizationService sistema)
        {
            var consulta =
                new QueryExpression(TabelaTrilha)
                {
                    ColumnSet = new ColumnSet("dgt_name")
                };

            consulta.Criteria.AddCondition("dgt_todasareas", ConditionOperator.Equal, true);
            consulta.Criteria.AddCondition("dgt_ativa", ConditionOperator.NotEqual, false);

            return
                sistema.RetrieveMultiple(consulta)
                    .Entities
                    .Select(e => new EntityReference(TabelaTrilha, e.Id)
                    {
                        Name = e.GetAttributeValue<string>("dgt_name")
                    })
                    .ToList();
        }

        // Público da trilha: todos os usuários ativos (todas as áreas)
        // ou membros ativos das áreas vinculadas à trilha.
        private static List<Publico> PublicoDaTrilha(
            IOrganizationService sistema,
            Guid trilhaId)
        {
            var trilha =
                sistema.Retrieve(
                    TabelaTrilha,
                    trilhaId,
                    new ColumnSet("dgt_todasareas"));

            if (trilha.GetAttributeValue<bool?>("dgt_todasareas") == true)
            {
                return
                    UsuariosAtivos(sistema)
                        .Select(id => new Publico
                        {
                            UsuarioId = id,
                            OrigemId = trilhaId,
                            Descricao = "todas as áreas"
                        })
                        .ToList();
            }

            var consulta =
                new QueryExpression(TabelaTrilhaArea)
                {
                    ColumnSet = new ColumnSet("dgt_area")
                };

            consulta.Criteria.AddCondition("dgt_trilha", ConditionOperator.Equal, trilhaId);
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            var resultado = new List<Publico>();

            foreach (var relacao in sistema.RetrieveMultiple(consulta).Entities)
            {
                var area = relacao.GetAttributeValue<EntityReference>("dgt_area");

                if (area == null)
                {
                    continue;
                }

                foreach (var usuarioId in MembrosAtivosDaArea(sistema, area.Id))
                {
                    resultado.Add(new Publico
                    {
                        UsuarioId = usuarioId,
                        OrigemId = relacao.Id,
                        Descricao = "área " + (area.Name ?? string.Empty)
                    });
                }
            }

            return resultado;
        }

        private static IEnumerable<Par> MontarPares(
            Guid usuarioId,
            EntityReference trilha,
            List<ItemTrilha> treinamentos,
            Guid origemId,
            string descricaoOrigem)
        {
            foreach (var item in treinamentos)
            {
                yield return new Par
                {
                    UsuarioId = usuarioId,
                    TrilhaId = trilha.Id,
                    TrilhaNome = trilha.Name,
                    TreinamentoId = item.TreinamentoId,
                    Ordem = item.Ordem,
                    PrazoDias = item.PrazoDias,
                    OrigemId = origemId,
                    DescricaoOrigem = descricaoOrigem
                };
            }
        }

        // ============================================================
        // ATRIBUIÇÃO (reutiliza a Custom API existente)
        // ============================================================

        private static void Atribuir(
            IOrganizationService sistema,
            Par par)
        {
            var dataLimite =
                par.PrazoDias.HasValue && par.PrazoDias.Value > 0
                    ? DateTime.UtcNow.Date
                        .AddDays(par.PrazoDias.Value)
                        .ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                    : string.Empty;

            var observacao =
                "Atribuição automática da trilha" +
                (string.IsNullOrWhiteSpace(par.TrilhaNome) ? "" : " \"" + par.TrilhaNome + "\"") +
                (string.IsNullOrWhiteSpace(par.DescricaoOrigem) ? "" : " por " + par.DescricaoOrigem) +
                ".";

            var payload =
                "{" +
                "\"UsuarioId\":" + Texto(par.UsuarioId.ToString("D")) + "," +
                "\"TreinamentoId\":" + Texto(par.TreinamentoId.ToString("D")) + "," +
                "\"TrilhaId\":" + Texto(par.TrilhaId.ToString("D")) + "," +
                "\"Origem\":" + Texto(Origem) + "," +
                "\"OrigemId\":" + Texto(par.OrigemId.ToString("D")) + "," +
                "\"DataLimite\":" + Texto(dataLimite) + "," +
                "\"Observacao\":" + Texto(observacao) +
                "}";

            var requisicao =
                new OrganizationRequest(ApiAtribuicao);

            requisicao["PayloadJson"] = payload;

            sistema.Execute(requisicao);
        }

        // ============================================================
        // REGISTRO DE OCORRÊNCIAS (falhas / pendências por tempo)
        // ============================================================

        private static void RegistrarOcorrencia(
            IOrganizationService sistema,
            ITracingService tracing,
            string entidade,
            Guid registroId,
            int processadas,
            List<string> falhas,
            List<Par> pendentes)
        {
            try
            {
                var detalhes = new StringBuilder();

                detalhes.AppendLine("Processadas: " + processadas);
                detalhes.AppendLine("Falhas: " + falhas.Count);
                detalhes.AppendLine("Pendentes por limite de tempo: " + pendentes.Count);

                if (pendentes.Count > 0)
                {
                    detalhes.AppendLine();
                    detalhes.AppendLine(
                        "Para concluir, salve novamente o registro de origem " +
                        "(o processamento é idempotente e não duplica atribuições).");
                }

                foreach (var falha in falhas.Take(10))
                {
                    detalhes.AppendLine(falha);
                }

                var ocorrencia = new Entity(TabelaErro);

                ocorrencia["dgt_name"] = "Atribuição de trilha por área";
                ocorrencia["dgt_dataocorrencia"] = DateTime.UtcNow;
                ocorrencia["dgt_fluxo"] = "AtribuirTrilhaPorAreaPlugin";
                ocorrencia["dgt_etapa"] = "Atribuir";
                ocorrencia["dgt_entidade"] = entidade;
                ocorrencia["dgt_registroid"] = registroId.ToString("D");
                ocorrencia["dgt_mensagemerro"] =
                    pendentes.Count > 0
                        ? "Processamento interrompido pelo limite de tempo."
                        : "Algumas atribuições falharam.";
                ocorrencia["dgt_detalhes"] = Limitar(detalhes.ToString(), 2000);

                sistema.Create(ocorrencia);
            }
            catch (Exception ex)
            {
                // O registro de ocorrência nunca derruba o plugin.
                tracing.Trace("Não foi possível gravar dgt_erroautomacao: {0}", ex.Message);
            }
        }

        private static string Limitar(string valor, int maximo)
        {
            if (string.IsNullOrEmpty(valor) || valor.Length <= maximo)
            {
                return valor;
            }

            return valor.Substring(0, maximo);
        }

        // ============================================================
        // TIPOS AUXILIARES
        // ============================================================

        private sealed class Par
        {
            public Guid UsuarioId;
            public Guid TrilhaId;
            public string TrilhaNome;
            public Guid TreinamentoId;
            public int Ordem;
            public int? PrazoDias;
            public Guid OrigemId;
            public string DescricaoOrigem;
        }

        private sealed class ItemTrilha
        {
            public Guid TreinamentoId;
            public int Ordem;
            public int? PrazoDias;
        }

        private sealed class OrigemTrilha
        {
            public EntityReference Trilha;
            public Guid OrigemId;
        }

        private sealed class Publico
        {
            public Guid UsuarioId;
            public Guid OrigemId;
            public string Descricao;
        }

        private static string Texto(
            string valor)
        {
            var sb = new StringBuilder("\"");

            foreach (var c in valor ?? string.Empty)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < ' ')
                        {
                            sb.Append("\\u").Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }

            return sb.Append('"').ToString();
        }
    }
}
