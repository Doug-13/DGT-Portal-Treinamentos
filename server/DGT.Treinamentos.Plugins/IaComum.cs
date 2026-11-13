using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata.Query;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // IA — PEÇAS COMPARTILHADAS PELOS PLUGINS
    //
    //   Chave ......... dgt_iaconfiguracao.dgt_chaveapi (coluna PROTEGIDA:
    //                   só o SYSTEM e administradores do sistema leem;
    //                   o portal nunca a lê). Sem chave salva, usa a
    //                   Configuração segura do passo (como antes).
    //   Consumo ....... uma linha em dgt_iaconsumo por chamada bem-sucedida:
    //                   usuário, área, funcionalidade, modelo, tokens e custo.
    //                   NÃO guarda pergunta, resposta nem dados.
    //   Área .......... (a) área de onde partiu o uso; (b) reserva: área
    //                   principal do usuário; senão a única área ativa dele;
    //                   senão "Sem área".
    //   Limite ........ limite mensal (US$) por área, opcional.
    //
    // Tudo aqui roda com o serviço do SYSTEM (CreateOrganizationService(null)),
    // para ler a chave protegida e gravar o consumo sem exigir permissão
    // de quem usa a IA.
    //
    // ATENÇÃO: em plugin síncrono, uma chamada ao Dataverse que FALHA
    // cancela a transação inteira, mesmo dentro de try/catch. Por isso,
    // antes de usar uma tabela/coluna, confere nos metadados se ela
    // existe (consulta que nunca falha) e usa RetrieveMultiple em vez de
    // Retrieve por id (registro inexistente = lista vazia, não erro).
    // ================================================================
    internal static class IaComum
    {
        internal const string NomeConfiguracao = "Claude";

        internal const string TabelaConfiguracao = "dgt_iaconfiguracao";
        internal const string TabelaConsumo = "dgt_iaconsumo";

        private const string UrlModelos = "https://api.anthropic.com/v1/models?limit=1";
        private const string VersaoApi = "2023-06-01";

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        // ------------------------------------------------------------
        // Configuração
        // ------------------------------------------------------------

        internal sealed class Configuracao
        {
            internal Guid Id;
            internal string Chave = string.Empty;
            internal JObject Precos = new JObject();
            internal JObject Limites = new JObject();
            internal JObject AreasFuncionalidade = new JObject();
        }

        // Lê o registro "Claude" de dgt_iaconfiguracao. Se a tabela ainda
        // não existir (script não rodado), devolve uma configuração vazia.
        internal static Configuracao LerConfiguracao(IOrganizationService sistema, ITracingService tracing)
        {
            var config = new Configuracao();
            if (!Existe(sistema, TabelaConfiguracao, "dgt_areasfuncionalidadejson"))
            {
                tracing.Trace("Tabela {0} ainda não criada: usando a Configuração segura.", TabelaConfiguracao);
                return config;
            }
            try
            {
                var consulta = new QueryExpression(TabelaConfiguracao)
                {
                    ColumnSet = new ColumnSet("dgt_chaveapi", "dgt_precosjson", "dgt_limitesjson", "dgt_areasfuncionalidadejson"),
                    TopCount = 1
                };
                consulta.Criteria.AddCondition("dgt_name", ConditionOperator.Equal, NomeConfiguracao);

                var registro = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();
                if (registro == null)
                {
                    return config;
                }

                config.Id = registro.Id;
                config.Chave = (registro.GetAttributeValue<string>("dgt_chaveapi") ?? string.Empty).Trim();
                config.Precos = LerJson(registro.GetAttributeValue<string>("dgt_precosjson"));
                config.Limites = LerJson(registro.GetAttributeValue<string>("dgt_limitesjson"));
                config.AreasFuncionalidade = LerJson(registro.GetAttributeValue<string>("dgt_areasfuncionalidadejson"));
            }
            catch (Exception ex)
            {
                tracing.Trace("Configuração de IA indisponível (usando a Configuração segura): {0}", ex.Message);
            }
            return config;
        }

        // Chave salva no portal; sem ela, a da Configuração segura do passo.
        internal static string ObterChave(Configuracao config, string chaveDoPasso)
        {
            if (!string.IsNullOrWhiteSpace(config.Chave))
            {
                return config.Chave;
            }
            return LerChaveDoPasso(chaveDoPasso);
        }

        // Aceita { "apiKey": "..." } ou apenas a chave.
        internal static string LerChaveDoPasso(string secureConfig)
        {
            var valor = (secureConfig ?? string.Empty).Trim();
            if (valor.StartsWith("{"))
            {
                try
                {
                    return ((string)JObject.Parse(valor)["apiKey"] ?? string.Empty).Trim();
                }
                catch (JsonException)
                {
                    return string.Empty;
                }
            }
            return valor;
        }

        // Testa a chave sem gastar tokens (lista de modelos da Anthropic).
        // Devolve string vazia se a chave funciona, ou o motivo.
        internal static string TestarChave(string chave, ITracingService tracing)
        {
            if (string.IsNullOrWhiteSpace(chave))
            {
                return "Nenhuma chave informada.";
            }

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            using (var requisicao = new HttpRequestMessage(HttpMethod.Get, UrlModelos))
            {
                requisicao.Headers.Add("x-api-key", chave.Trim());
                requisicao.Headers.Add("anthropic-version", VersaoApi);
                try
                {
                    var resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                    var codigo = (int)resposta.StatusCode;
                    if (resposta.IsSuccessStatusCode)
                    {
                        return string.Empty;
                    }
                    tracing.Trace("Teste da chave: Anthropic respondeu {0}.", codigo);
                    return codigo == 401 || codigo == 403
                        ? "A Anthropic recusou a chave (inválida, revogada ou sem permissão)."
                        : codigo == 429
                            ? "A Anthropic está limitando as chamadas agora (429). Tente de novo em instantes."
                            : $"A Anthropic respondeu com erro ({codigo}).";
                }
                catch (Exception ex)
                {
                    tracing.Trace("Teste da chave: falha de rede: {0}", ex.Message);
                    return "Não foi possível falar com a Anthropic agora.";
                }
            }
        }

        // ------------------------------------------------------------
        // Área do consumo — (a) uso, (b) principal, único vínculo, sem área
        // ------------------------------------------------------------

        internal sealed class AreaConsumo
        {
            internal string Id = string.Empty;
            internal string Nome = "Sem área";
            internal string Origem = "Sem área";
        }

        internal static AreaConsumo ResolverArea(
            IOrganizationService sistema,
            Guid usuarioSistemaId,
            string areaDoUsoId,
            ITracingService tracing)
        {
            // (a) Área de onde partiu o uso.
            Guid areaUso;
            if (Guid.TryParse(areaDoUsoId ?? string.Empty, out areaUso))
            {
                var area = LerArea(sistema, areaUso);
                if (area != null)
                {
                    return new AreaConsumo { Id = area.Id.ToString(), Nome = NomeArea(area), Origem = "Uso" };
                }
            }

            // (b) Reserva: área principal do usuário (ou a única).
            try
            {
                var vinculos = VinculosAtivos(sistema, usuarioSistemaId);
                var principal = vinculos.FirstOrDefault(v => v.Principal) ?? (vinculos.Count == 1 ? vinculos[0] : null);
                if (principal != null)
                {
                    return new AreaConsumo
                    {
                        Id = principal.AreaId.ToString(),
                        Nome = principal.AreaNome,
                        Origem = principal.Principal ? "Principal" : "Única área"
                    };
                }
            }
            catch (Exception ex)
            {
                tracing.Trace("Não foi possível ler as áreas do usuário: {0}", ex.Message);
            }

            return new AreaConsumo();
        }

        // Área configurada para uma funcionalidade (ex.: "licitacoes"); sem
        // configuração, procura a área pela sigla informada (ex.: "LIC").
        internal static string AreaDaFuncionalidade(
            IOrganizationService sistema,
            Configuracao config,
            string funcionalidade,
            string siglaPadrao,
            ITracingService tracing)
        {
            var configurada = (string)config.AreasFuncionalidade[funcionalidade];
            if (!string.IsNullOrWhiteSpace(configurada))
            {
                return configurada;
            }
            if (string.IsNullOrWhiteSpace(siglaPadrao))
            {
                return string.Empty;
            }
            try
            {
                var consulta = new QueryExpression("dgt_area") { ColumnSet = new ColumnSet(false), TopCount = 1 };
                consulta.Criteria.AddCondition("dgt_sigla", ConditionOperator.Equal, siglaPadrao);
                var area = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();
                return area != null ? area.Id.ToString() : string.Empty;
            }
            catch (Exception ex)
            {
                tracing.Trace("Área padrão da funcionalidade {0} não encontrada: {1}", funcionalidade, ex.Message);
                return string.Empty;
            }
        }

        private sealed class Vinculo
        {
            internal Guid AreaId;
            internal string AreaNome = string.Empty;
            internal bool Principal;
        }

        // systemuser → dgt_usuario (Entra ID, e-mail ou UPN) → dgt_usuarioarea ativos.
        private static List<Vinculo> VinculosAtivos(IOrganizationService sistema, Guid usuarioSistemaId)
        {
            var lista = new List<Vinculo>();

            var usuarioSistema = sistema.Retrieve(
                "systemuser", usuarioSistemaId,
                new ColumnSet("azureactivedirectoryobjectid", "internalemailaddress", "domainname"));

            var objectId = usuarioSistema.GetAttributeValue<Guid?>("azureactivedirectoryobjectid");
            var email = usuarioSistema.GetAttributeValue<string>("internalemailaddress") ?? string.Empty;
            var upn = usuarioSistema.GetAttributeValue<string>("domainname") ?? string.Empty;

            var consultaUsuario = new QueryExpression("dgt_usuario") { ColumnSet = new ColumnSet(false), TopCount = 1 };
            var filtro = new FilterExpression(LogicalOperator.Or);
            if (objectId.HasValue)
            {
                filtro.AddCondition("dgt_entraobjectid", ConditionOperator.Equal, objectId.Value.ToString());
            }
            if (email.Length > 0)
            {
                filtro.AddCondition("dgt_email", ConditionOperator.Equal, email);
            }
            if (upn.Length > 0)
            {
                filtro.AddCondition("dgt_upn", ConditionOperator.Equal, upn);
            }
            if (filtro.Conditions.Count == 0)
            {
                return lista;
            }
            consultaUsuario.Criteria.AddFilter(filtro);

            var usuario = sistema.RetrieveMultiple(consultaUsuario).Entities.FirstOrDefault();
            if (usuario == null)
            {
                return lista;
            }

            var temPrincipal = Existe(sistema, "dgt_usuarioarea", "dgt_principal");
            var consultaVinculos = new QueryExpression("dgt_usuarioarea")
            {
                ColumnSet = temPrincipal ? new ColumnSet("dgt_area", "dgt_principal") : new ColumnSet("dgt_area")
            };
            consultaVinculos.Criteria.AddCondition("dgt_usuario", ConditionOperator.Equal, usuario.Id);
            consultaVinculos.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            var areaLink = consultaVinculos.AddLink("dgt_area", "dgt_area", "dgt_areaid");
            areaLink.EntityAlias = "area";
            areaLink.Columns = new ColumnSet("dgt_name", "dgt_sigla");
            areaLink.LinkCriteria.AddCondition("dgt_ativo", ConditionOperator.NotEqual, false);

            foreach (var vinculo in sistema.RetrieveMultiple(consultaVinculos).Entities)
            {
                var area = vinculo.GetAttributeValue<EntityReference>("dgt_area");
                if (area == null)
                {
                    continue;
                }
                var nome = Aliased(vinculo, "area.dgt_name");
                var sigla = Aliased(vinculo, "area.dgt_sigla");
                lista.Add(new Vinculo
                {
                    AreaId = area.Id,
                    AreaNome = sigla.Length > 0 ? $"{sigla} · {nome}" : nome,
                    Principal = vinculo.GetAttributeValue<bool?>("dgt_principal") == true
                });
            }

            return lista;
        }

        private static Entity LerArea(IOrganizationService sistema, Guid id)
        {
            var consulta = new QueryExpression("dgt_area") { ColumnSet = new ColumnSet("dgt_name", "dgt_sigla"), TopCount = 1 };
            consulta.Criteria.AddCondition("dgt_areaid", ConditionOperator.Equal, id);
            return sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();
        }

        private static string NomeArea(Entity area)
        {
            var nome = area.GetAttributeValue<string>("dgt_name") ?? "Área";
            var sigla = area.GetAttributeValue<string>("dgt_sigla") ?? string.Empty;
            return sigla.Length > 0 ? $"{sigla} · {nome}" : nome;
        }

        private static string Aliased(Entity registro, string campo)
        {
            var valor = registro.GetAttributeValue<AliasedValue>(campo);
            return valor != null && valor.Value != null ? valor.Value.ToString() : string.Empty;
        }

        // ------------------------------------------------------------
        // Limite mensal por área (US$)
        // ------------------------------------------------------------

        // Lança exceção se a área já atingiu o limite do mês.
        internal static void VerificarLimite(IOrganizationService sistema, Configuracao config, AreaConsumo area, ITracingService tracing)
        {
            if (string.IsNullOrEmpty(area.Id))
            {
                return;
            }
            var limite = (decimal?)config.Limites[area.Id];
            if (!limite.HasValue || limite.Value <= 0)
            {
                return;
            }

            if (!Existe(sistema, TabelaConsumo, "dgt_custousd"))
            {
                return;
            }

            decimal gasto = 0;
            try
            {
                var fetch =
                    "<fetch aggregate='true'>" +
                    "<entity name='" + TabelaConsumo + "'>" +
                    "<attribute name='dgt_custousd' alias='total' aggregate='sum' />" +
                    "<filter>" +
                    "<condition attribute='dgt_areaid' operator='eq' value='" + SecurityElement(area.Id) + "' />" +
                    "<condition attribute='createdon' operator='this-month' />" +
                    "</filter></entity></fetch>";
                var resultado = sistema.RetrieveMultiple(new FetchExpression(fetch)).Entities.FirstOrDefault();
                var total = resultado != null ? resultado.GetAttributeValue<AliasedValue>("total") : null;
                if (total != null && total.Value != null)
                {
                    gasto = total.Value is Money ? ((Money)total.Value).Value : Convert.ToDecimal(total.Value, CultureInfo.InvariantCulture);
                }
            }
            catch (Exception ex)
            {
                // Sem conseguir somar, não bloqueia (registra para análise).
                tracing.Trace("Não foi possível somar o consumo do mês da área {0}: {1}", area.Nome, ex.Message);
                return;
            }

            if (gasto >= limite.Value)
            {
                throw new InvalidPluginExecutionException(
                    $"O limite mensal de IA da área {area.Nome} foi atingido (US$ {gasto.ToString("0.00", CultureInfo.InvariantCulture)} de US$ {limite.Value.ToString("0.00", CultureInfo.InvariantCulture)}). Fale com o administrador do portal.");
            }
        }

        // ------------------------------------------------------------
        // Registro de consumo
        // ------------------------------------------------------------

        internal static void RegistrarConsumo(
            IOrganizationService sistema,
            Configuracao config,
            Guid usuarioSistemaId,
            AreaConsumo area,
            string funcionalidade,
            string detalhe,
            string modelo,
            int tokensEntrada,
            int tokensSaida,
            ITracingService tracing)
        {
            if (!Existe(sistema, TabelaConsumo, "dgt_precoconfigurado"))
            {
                tracing.Trace("Tabela {0} ainda não criada: consumo não registrado.", TabelaConsumo);
                return;
            }
            try
            {
                var custoUsd = CalcularCustoUsd(config, modelo, tokensEntrada, tokensSaida);
                var cotacao = (decimal?)config.Precos["cotacaoBrl"] ?? 0m;

                var nomeUsuario = string.Empty;
                try
                {
                    nomeUsuario = sistema.Retrieve("systemuser", usuarioSistemaId, new ColumnSet("fullname"))
                        .GetAttributeValue<string>("fullname") ?? string.Empty;
                }
                catch (Exception)
                {
                    nomeUsuario = string.Empty;
                }

                var registro = new Entity(TabelaConsumo);
                registro["dgt_name"] = Cortar($"{funcionalidade} · {DateTime.UtcNow:yyyy-MM-dd HH:mm}", 200);
                registro["dgt_usuario"] = new EntityReference("systemuser", usuarioSistemaId);
                registro["dgt_usuarionome"] = Cortar(nomeUsuario, 200);
                registro["dgt_areaid"] = area.Id;
                registro["dgt_areanome"] = Cortar(area.Nome, 200);
                registro["dgt_origemarea"] = area.Origem;
                registro["dgt_funcionalidade"] = Cortar(funcionalidade, 100);
                registro["dgt_detalhe"] = Cortar(detalhe, 200);
                registro["dgt_modeloia"] = Cortar(modelo, 200);
                registro["dgt_tokensentrada"] = tokensEntrada;
                registro["dgt_tokenssaida"] = tokensSaida;
                registro["dgt_custousd"] = Math.Round(custoUsd, 6);
                registro["dgt_custobrl"] = Math.Round(custoUsd * cotacao, 2);
                registro["dgt_precoconfigurado"] = PrecoDoModelo(config, modelo) != null;
                sistema.Create(registro);
            }
            catch (Exception ex)
            {
                // O consumo nunca derruba a resposta ao usuário.
                tracing.Trace("Consumo de IA não registrado: {0}", ex.Message);
            }
        }

        // Preços em US$ por milhão de tokens:
        // { "cotacaoBrl": 5.4, "modelos": { "claude-sonnet-5-5": { "entrada": 2, "saida": 10 } } }
        internal static decimal CalcularCustoUsd(Configuracao config, string modelo, int entrada, int saida)
        {
            var preco = PrecoDoModelo(config, modelo);
            if (preco == null)
            {
                return 0m;
            }
            var precoEntrada = (decimal?)preco["entrada"] ?? 0m;
            var precoSaida = (decimal?)preco["saida"] ?? 0m;
            return (entrada * precoEntrada + saida * precoSaida) / 1000000m;
        }

        private static JObject PrecoDoModelo(Configuracao config, string modelo)
        {
            var modelos = config.Precos["modelos"] as JObject;
            return modelos != null ? modelos[modelo ?? string.Empty] as JObject : null;
        }

        // ------------------------------------------------------------
        // Utilitários
        // ------------------------------------------------------------

        // Tabela (e, se informada, coluna) existe? Consulta de metadados:
        // devolve lista vazia quando não existe, sem gerar erro.
        // O resultado positivo fica guardado enquanto o plugin estiver
        // carregado (o negativo não, para enxergar o script recém-rodado).
        private static readonly HashSet<string> Existentes = new HashSet<string>();
        private static readonly object Trava = new object();

        internal static bool Existe(IOrganizationService sistema, string tabela, string coluna = null)
        {
            var chave = tabela + "|" + (coluna ?? string.Empty);
            lock (Trava)
            {
                if (Existentes.Contains(chave))
                {
                    return true;
                }
            }

            var filtroTabela = new MetadataFilterExpression(LogicalOperator.And);
            filtroTabela.Conditions.Add(new MetadataConditionExpression("LogicalName", MetadataConditionOperator.Equals, tabela));

            var consulta = new EntityQueryExpression
            {
                Criteria = filtroTabela,
                Properties = new MetadataPropertiesExpression("LogicalName")
            };

            if (!string.IsNullOrEmpty(coluna))
            {
                var filtroColuna = new MetadataFilterExpression(LogicalOperator.And);
                filtroColuna.Conditions.Add(new MetadataConditionExpression("LogicalName", MetadataConditionOperator.Equals, coluna));
                consulta.Properties = new MetadataPropertiesExpression("LogicalName", "Attributes");
                consulta.AttributeQuery = new AttributeQueryExpression
                {
                    Criteria = filtroColuna,
                    Properties = new MetadataPropertiesExpression("LogicalName")
                };
            }

            var resposta = (RetrieveMetadataChangesResponse)sistema.Execute(
                new RetrieveMetadataChangesRequest { Query = consulta });

            var entidade = resposta.EntityMetadata.FirstOrDefault();
            var existe = entidade != null &&
                (string.IsNullOrEmpty(coluna) || (entidade.Attributes != null && entidade.Attributes.Length > 0));

            if (existe)
            {
                lock (Trava)
                {
                    Existentes.Add(chave);
                }
            }
            return existe;
        }

        private static JObject LerJson(string texto)
        {
            if (string.IsNullOrWhiteSpace(texto))
            {
                return new JObject();
            }
            try
            {
                return JObject.Parse(texto);
            }
            catch (JsonException)
            {
                return new JObject();
            }
        }

        internal static string Cortar(string texto, int limite) =>
            string.IsNullOrEmpty(texto) || texto.Length <= limite ? texto ?? string.Empty : texto.Substring(0, limite);

        private static string SecurityElement(string valor) =>
            System.Security.SecurityElement.Escape(valor ?? string.Empty);
    }
}
