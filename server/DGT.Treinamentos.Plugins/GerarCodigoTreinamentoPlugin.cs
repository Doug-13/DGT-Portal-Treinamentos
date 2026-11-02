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
    // Exemplo: PRO-TRN-001, ARQ-TRN-002
    //
    // REGRA DO CÓDIGO
    //   • O sequencial é escolhido NA CRIAÇÃO. Sem número informado,
    //     o plugin usa a sugestão (maior número já usado no prefixo + 1).
    //   • Não é possível usar um código que JÁ EXISTE — em treinamentos
    //     ou em documentos, ATIVOS OU INATIVOS. O treinamento e o seu
    //     documento de controle têm o mesmo código.
    //   • Depois de criado, o código NUNCA muda (nem por administrador).
    //   • Só a EXCLUSÃO do registro libera o código.
    //
    // STEP 1 — Create, PreOperation (20), síncrono
    //   Valida/gera dgt_sequencial e dgt_codigo.
    //
    // STEP 2 — Update, PreOperation (20), síncrono
    //   Filtering attributes: dgt_sequencial, dgt_codigo
    //   Recusa qualquer alteração. Telas que reenviam o mesmo valor
    //   continuam funcionando (o valor igual é simplesmente ignorado).
    //
    // As consultas de unicidade rodam como SYSTEM, para enxergar todos
    // os registros independentemente dos privilégios de quem cria.
    // ================================================================
    public sealed class GerarCodigoTreinamentoPlugin : IPlugin
    {
        private const int SequencialMaximo = 999;

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

            // SYSTEM: enxerga todos os treinamentos e documentos.
            var sistema =
                factory.CreateOrganizationService(
                    null);

            if (string.Equals(
                    context.MessageName,
                    "Create",
                    StringComparison.OrdinalIgnoreCase))
            {
                ProcessarCriacao(
                    sistema,
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
                    target);
            }
        }

        // ============================================================
        // CRIAÇÃO
        // ============================================================

        private static void ProcessarCriacao(
            IOrganizationService sistema,
            ITracingService tracing,
            Entity target)
        {
            var areaRef =
                target.GetAttributeValue<EntityReference>(
                    "dgt_area");

            if (areaRef == null)
            {
                throw new InvalidPluginExecutionException(
                    "A área do treinamento é obrigatória.");
            }

            var sigla =
                ObterSiglaArea(
                    sistema,
                    areaRef.Id,
                    validarAtiva: true);

            var prefixo =
                MontarPrefixo(
                    sigla);

            var sequencial =
                target.GetAttributeValue<int?>(
                    "dgt_sequencial");

            var codigoEnviado =
                (target.GetAttributeValue<string>(
                    "dgt_codigo") ?? string.Empty)
                    .Trim()
                    .ToUpperInvariant();

            // Código enviado sem sequencial (ex.: carga de dados): precisa
            // seguir o padrão da área; o número sai do próprio código.
            if (sequencial == null &&
                codigoEnviado.Length > 0)
            {
                int numero;

                if (!codigoEnviado.StartsWith(prefixo, StringComparison.Ordinal) ||
                    !int.TryParse(
                        codigoEnviado.Substring(prefixo.Length),
                        out numero))
                {
                    throw new InvalidPluginExecutionException(
                        $"O código {codigoEnviado} não segue o padrão {prefixo}000 da área.");
                }

                sequencial = numero;
            }

            // Sem número informado: sugestão.
            if (sequencial == null)
            {
                sequencial =
                    SugerirSequencial(
                        sistema,
                        prefixo,
                        areaRef.Id);
            }

            if (sequencial < 1 ||
                sequencial > SequencialMaximo)
            {
                throw new InvalidPluginExecutionException(
                    $"O sequencial deve ser um número inteiro entre 1 e {SequencialMaximo}.");
            }

            var codigo =
                MontarCodigo(
                    prefixo,
                    sequencial.Value);

            var existente =
                DescreverCodigoExistente(
                    sistema,
                    codigo);

            if (existente != null)
            {
                throw new InvalidPluginExecutionException(
                    $"O código {codigo} já existe ({existente}). Escolha outro sequencial.");
            }

            tracing.Trace(
                "Código definido na criação: {0}",
                codigo);

            target["dgt_sequencial"] =
                sequencial.Value;

            target["dgt_codigo"] =
                codigo;
        }

        // ============================================================
        // ALTERAÇÃO: o código é imutável
        // ============================================================

        private static void ProcessarAlteracao(
            IOrganizationService sistema,
            ITracingService tracing,
            Entity target)
        {
            var enviouSequencial =
                target.Contains(
                    "dgt_sequencial");

            var enviouCodigo =
                target.Contains(
                    "dgt_codigo");

            if (!enviouSequencial &&
                !enviouCodigo)
            {
                return;
            }

            var atual =
                sistema.Retrieve(
                    "dgt_treinamento",
                    target.Id,
                    new ColumnSet(
                        "dgt_sequencial",
                        "dgt_codigo"));

            var sequencialAtual =
                atual.GetAttributeValue<int?>(
                    "dgt_sequencial");

            var codigoAtual =
                (atual.GetAttributeValue<string>(
                    "dgt_codigo") ?? string.Empty)
                    .Trim();

            if (enviouSequencial)
            {
                var novoSequencial =
                    target.GetAttributeValue<int?>(
                        "dgt_sequencial");

                if (novoSequencial != sequencialAtual)
                {
                    throw new InvalidPluginExecutionException(
                        MensagemImutavel(
                            codigoAtual));
                }

                // Mesmo valor reenviado pela tela: ignora.
                target.Attributes.Remove(
                    "dgt_sequencial");
            }

            if (enviouCodigo)
            {
                var novoCodigo =
                    (target.GetAttributeValue<string>(
                        "dgt_codigo") ?? string.Empty)
                        .Trim();

                if (!string.Equals(
                        novoCodigo,
                        codigoAtual,
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidPluginExecutionException(
                        MensagemImutavel(
                            codigoAtual));
                }

                target.Attributes.Remove(
                    "dgt_codigo");
            }

            tracing.Trace(
                "Código {0} mantido (valor reenviado sem alteração).",
                codigoAtual);
        }

        private static string MensagemImutavel(
            string codigoAtual) =>
            $"O código {codigoAtual} é definido na criação e não pode ser alterado. " +
            "Para usar outro código, crie um novo treinamento.";

        // ============================================================
        // AUXILIARES
        // ============================================================

        private static string MontarPrefixo(
            string siglaArea) =>
            $"{siglaArea}-TRN-";

        private static string MontarCodigo(
            string prefixo,
            int sequencial) =>
            $"{prefixo}{sequencial:000}";

        // Maior número já usado no prefixo (treinamentos E documentos,
        // ativos ou inativos) + 1. Considera também o maior dgt_sequencial
        // da área (treinamentos antigos). Pula números ocupados.
        private static int SugerirSequencial(
            IOrganizationService sistema,
            string prefixo,
            Guid areaId)
        {
            var maior =
                Math.Max(
                    MaiorNumeroNoPrefixo(sistema, "dgt_treinamento", prefixo),
                    MaiorNumeroNoPrefixo(sistema, "dgt_documento", prefixo));

            maior =
                Math.Max(
                    maior,
                    MaiorSequencialDaArea(sistema, areaId));

            var proximo =
                maior + 1;

            while (proximo <= SequencialMaximo &&
                   DescreverCodigoExistente(
                       sistema,
                       MontarCodigo(prefixo, proximo)) != null)
            {
                proximo++;
            }

            if (proximo > SequencialMaximo)
            {
                throw new InvalidPluginExecutionException(
                    $"Não há sequencial livre acima de {maior:000} para {prefixo}. Informe um número livre.");
            }

            return proximo;
        }

        private static int MaiorNumeroNoPrefixo(
            IOrganizationService sistema,
            string tabela,
            string prefixo)
        {
            var query =
                new QueryExpression(
                    tabela)
                {
                    ColumnSet =
                        new ColumnSet(
                            "dgt_codigo"),

                    NoLock =
                        true
                };

            query.Criteria.AddCondition(
                "dgt_codigo",
                ConditionOperator.BeginsWith,
                prefixo);

            var maior = 0;

            foreach (var registro in sistema.RetrieveMultiple(query).Entities)
            {
                var codigo =
                    (registro.GetAttributeValue<string>(
                        "dgt_codigo") ?? string.Empty)
                        .Trim()
                        .ToUpperInvariant();

                int numero;

                if (codigo.StartsWith(prefixo, StringComparison.Ordinal) &&
                    int.TryParse(
                        codigo.Substring(prefixo.Length),
                        out numero) &&
                    numero > maior)
                {
                    maior = numero;
                }
            }

            return maior;
        }

        private static int MaiorSequencialDaArea(
            IOrganizationService sistema,
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
                        1,

                    NoLock =
                        true
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
                sistema
                    .RetrieveMultiple(
                        query)
                    .Entities
                    .FirstOrDefault();

            return ultimo?.GetAttributeValue<int?>(
                "dgt_sequencial") ?? 0;
        }

        // Devolve a descrição de quem usa o código (null = livre).
        // Considera registros ATIVOS E INATIVOS: só a exclusão libera.
        private static string DescreverCodigoExistente(
            IOrganizationService sistema,
            string codigo)
        {
            var treinamento =
                PrimeiroComCodigo(
                    sistema,
                    "dgt_treinamento",
                    codigo,
                    "dgt_name");

            if (treinamento != null)
            {
                return $"treinamento \"{treinamento.GetAttributeValue<string>("dgt_name")}\"" +
                       (treinamento.GetAttributeValue<bool?>("dgt_ativo") == false ? ", inativo" : string.Empty);
            }

            var documento =
                PrimeiroComCodigo(
                    sistema,
                    "dgt_documento",
                    codigo,
                    "dgt_titulo");

            if (documento != null)
            {
                var titulo =
                    documento.GetAttributeValue<string>("dgt_titulo");

                return $"documento \"{titulo}\"" +
                       (documento.GetAttributeValue<bool?>("dgt_ativo") == false ? ", inativo" : string.Empty);
            }

            return null;
        }

        private static Entity PrimeiroComCodigo(
            IOrganizationService sistema,
            string tabela,
            string codigo,
            string colunaNome)
        {
            var query =
                new QueryExpression(
                    tabela)
                {
                    ColumnSet =
                        new ColumnSet(
                            colunaNome,
                            "dgt_ativo"),

                    TopCount =
                        1,

                    NoLock =
                        true
                };

            query.Criteria.AddCondition(
                "dgt_codigo",
                ConditionOperator.Equal,
                codigo);

            return sistema
                .RetrieveMultiple(
                    query)
                .Entities
                .FirstOrDefault();
        }

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
