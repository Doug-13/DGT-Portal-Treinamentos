using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // ATUALIZAR VALORES DO CIGAM (Kits → Valor R$)
    //
    // Passo: Create de dgt_cigamsincronizacao, PostOperation, ASSÍNCRONO.
    // O portal só cria o pedido (botão "Atualizar valores do CIGAM");
    // este plugin faz login no CIGAM, busca o preço de cada item de kit
    // que TEM código CIGAM e grava o resultado no próprio item.
    //
    //   - Item sem código (ou com texto no lugar do código): NÃO é
    //     consultado e não é alterado.
    //   - Item sem preço: o valor anterior é mantido; dgt_valorsituacao
    //     explica o motivo.
    //   - Nenhuma credencial passa pelo portal: usuário e senha ficam na
    //     CONFIGURAÇÃO SEGURA do passo (só administradores do sistema
    //     enxergam) e nunca são gravados em log, mensagem ou URL.
    //
    // Configuração segura (JSON):
    //   { "usuario": "<usuário de integração>", "senha": "<senha>", "portal": "" }
    //
    // Configuração não segura (JSON, opcional):
    //   { "url": "https://dgtportais.cigam.cloud/api/api/",
    //     "tabelas": ["010"],          // ordem de preferência
    //     "segundosMaximos": 100 }
    //
    // Limite do Dataverse: 2 minutos por execução. Os itens são
    // processados do mais antigo para o mais novo (dgt_valoratualizadoem);
    // se o tempo acabar, o pedido termina avisando quantos faltaram e um
    // novo pedido continua de onde parou.
    // ================================================================
    public sealed class AtualizarValoresCigamPlugin : IPlugin
    {
        private const string TabelaPedido = "dgt_cigamsincronizacao";
        private const string TabelaItem = "dgt_kititem";
        private const string TipoPrecosKits = "Preços dos kits";

        private static readonly HttpClient Http = new HttpClient { Timeout = TimeSpan.FromSeconds(20) };

        private readonly string _usuario = string.Empty;
        private readonly string _senha = string.Empty;
        private readonly string _portal = string.Empty;
        private readonly string _url = "https://dgtportais.cigam.cloud/api/api/";
        private readonly List<string> _tabelas = new List<string> { "010" };
        private readonly int _segundosMaximos = 100;

        public AtualizarValoresCigamPlugin(string unsecureConfig, string secureConfig)
        {
            if (!string.IsNullOrWhiteSpace(secureConfig))
            {
                try
                {
                    var segura = JObject.Parse(secureConfig);
                    _usuario = ((string)segura["usuario"] ?? string.Empty).Trim();
                    _senha = (string)segura["senha"] ?? string.Empty;
                    _portal = ((string)segura["portal"] ?? string.Empty).Trim();
                }
                catch (JsonException)
                {
                    // Configuração inválida: o pedido termina com "não configurada".
                }
            }

            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);
                    var url = ((string)config["url"] ?? string.Empty).Trim();
                    if (url.Length > 0)
                    {
                        _url = url.EndsWith("/", StringComparison.Ordinal) ? url : url + "/";
                    }
                    var tabelas = config["tabelas"] as JArray;
                    if (tabelas != null && tabelas.Count > 0)
                    {
                        _tabelas = tabelas.Select(t => ((string)t ?? string.Empty).Trim()).Where(t => t.Length > 0).ToList();
                    }
                    _segundosMaximos = Math.Min(110, Math.Max(20, (int?)config["segundosMaximos"] ?? _segundosMaximos));
                }
                catch (JsonException)
                {
                    // Mantém os padrões.
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var tracing = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var fabrica = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var sistema = fabrica.CreateOrganizationService(null);

            if (!string.Equals(context.MessageName, "Create", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(context.PrimaryEntityName, TabelaPedido, StringComparison.OrdinalIgnoreCase) ||
                context.Depth > 2)
            {
                return;
            }

            var alvo = context.InputParameters.Contains("Target") ? context.InputParameters["Target"] as Entity : null;
            if (alvo == null)
            {
                return;
            }

            var tipo = alvo.GetAttributeValue<string>("dgt_tipo") ?? string.Empty;
            if (tipo.Length > 0 && !string.Equals(tipo, TipoPrecosKits, StringComparison.OrdinalIgnoreCase))
            {
                return; // outros tipos de sincronização não são deste plugin
            }

            var pedidoId = context.PrimaryEntityId;
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            try
            {
                Processar(sistema, tracing, pedidoId);
            }
            catch (Exception ex)
            {
                // Nunca relança: um pedido com erro não deve ficar em
                // nova tentativa automática. A mensagem é curta e não
                // contém corpo de resposta do CIGAM.
                tracing.Trace("Falha na atualização de valores: " + ex.GetType().Name);
                Finalizar(sistema, pedidoId, "Erro", "Falha na atualização: " + Curto(ex.Message, 300), 0, 0);
            }
        }

        private void Processar(IOrganizationService sistema, ITracingService tracing, Guid pedidoId)
        {
            if (_usuario.Length == 0 || _senha.Length == 0)
            {
                Finalizar(sistema, pedidoId, "Erro",
                    "Integração com o CIGAM não configurada: preencha a configuração segura do passo do plugin (usuário e senha de integração).", 0, 0);
                return;
            }

            AtualizarPedido(sistema, pedidoId, new Dictionary<string, object> { ["dgt_situacao"] = "Em andamento" });

            var relogio = Stopwatch.StartNew();
            var token = Login();
            if (token.Erro.Length > 0)
            {
                Finalizar(sistema, pedidoId, "Erro", token.Erro, 0, 0);
                return;
            }

            var itens = ListarItens(sistema);
            var hoje = HojeBrasilia();
            int atualizados = 0, semPreco = 0, semCodigo = 0, erros = 0, faltaram = 0;

            try
            {
                for (var i = 0; i < itens.Count; i++)
                {
                    if (relogio.Elapsed.TotalSeconds > _segundosMaximos)
                    {
                        faltaram = itens.Skip(i).Count(x => PrecosCigam.NormalizarCodigo(x.GetAttributeValue<string>("dgt_codigo")).Length > 0);
                        break;
                    }

                    var item = itens[i];
                    var codigo = PrecosCigam.NormalizarCodigo(item.GetAttributeValue<string>("dgt_codigo"));
                    if (codigo.Length == 0)
                    {
                        semCodigo++;
                        continue; // sem código: não busca e não altera
                    }

                    var consulta = BuscarPrecos(codigo, ref token);
                    var atualizacao = new Entity(TabelaItem, item.Id);
                    atualizacao["dgt_valoratualizadoem"] = DateTime.UtcNow;

                    if (consulta.Erro.Length > 0)
                    {
                        erros++;
                        atualizacao["dgt_valorsituacao"] = Curto(consulta.Erro, 300);
                    }
                    else
                    {
                        var escolha = PrecosCigam.Escolher(consulta.Linhas, _tabelas, hoje);
                        if (escolha.Valor.HasValue)
                        {
                            atualizados++;
                            atualizacao["dgt_valor"] = Math.Round(escolha.Valor.Value, 4);
                            atualizacao["dgt_valororigem"] = escolha.Origem;
                            atualizacao["dgt_valorsituacao"] = string.Empty;
                        }
                        else
                        {
                            semPreco++;
                            atualizacao["dgt_valorsituacao"] = Curto(escolha.Motivo, 300);
                            // dgt_valor anterior é mantido de propósito.
                        }
                    }

                    sistema.Update(atualizacao);
                }
            }
            finally
            {
                Logout(token.Hash);
            }

            var partes = new List<string>
            {
                atualizados + " com valor",
                semPreco + " sem preço",
                semCodigo + " sem código (não consultados)"
            };
            if (erros > 0)
            {
                partes.Add(erros + " com erro na consulta");
            }
            var mensagem = string.Join(" · ", partes) + ".";
            if (faltaram > 0)
            {
                mensagem += " O tempo da execução acabou e faltaram " + faltaram + " itens: peça a atualização de novo para continuar.";
            }

            var consultados = atualizados + semPreco + erros;
            var situacao = consultados > 0 && erros == consultados ? "Erro" : "Concluída";
            Finalizar(sistema, pedidoId, situacao, mensagem, atualizados, semPreco);
            tracing.Trace("Valores CIGAM: " + mensagem);
        }

        // ------------------------------------------------------------
        // Dataverse
        // ------------------------------------------------------------

        private static List<Entity> ListarItens(IOrganizationService sistema)
        {
            var consulta = new QueryExpression(TabelaItem)
            {
                ColumnSet = new ColumnSet("dgt_codigo", "dgt_name", "dgt_valoratualizadoem"),
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 }
            };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            // Mais antigos primeiro (nunca atualizados vêm antes): se o tempo
            // acabar, o próximo pedido continua de onde este parou.
            consulta.AddOrder("dgt_valoratualizadoem", OrderType.Ascending);
            return sistema.RetrieveMultiple(consulta).Entities.ToList();
        }

        private static void AtualizarPedido(IOrganizationService sistema, Guid id, IDictionary<string, object> campos)
        {
            var pedido = new Entity(TabelaPedido, id);
            foreach (var campo in campos)
            {
                pedido[campo.Key] = campo.Value;
            }
            sistema.Update(pedido);
        }

        private static void Finalizar(IOrganizationService sistema, Guid id, string situacao, string mensagem, int atualizados, int semPreco)
        {
            try
            {
                AtualizarPedido(sistema, id, new Dictionary<string, object>
                {
                    ["dgt_situacao"] = situacao,
                    ["dgt_mensagem"] = Curto(mensagem, 4000),
                    ["dgt_itensatualizados"] = atualizados,
                    ["dgt_itenssempreco"] = semPreco,
                    ["dgt_concluidoem"] = DateTime.UtcNow
                });
            }
            catch (Exception)
            {
                // Sem como registrar: o portal mostra "sem resposta" após 15 min.
            }
        }

        // ------------------------------------------------------------
        // CIGAM (somente leitura)
        // ------------------------------------------------------------

        private sealed class Sessao
        {
            public string Hash = string.Empty;
            public string Erro = string.Empty;
        }

        private sealed class ResultadoConsulta
        {
            public JArray Linhas = new JArray();
            public string Erro = string.Empty;
        }

        private Sessao Login()
        {
            var corpo = new JObject { ["NomeUsuario"] = _usuario, ["Senha"] = _senha };
            if (_portal.Length > 0)
            {
                corpo["Portal"] = _portal;
            }

            try
            {
                using (var pedido = new HttpRequestMessage(HttpMethod.Post, _url + "genericos/ge/Login/Autenticar"))
                {
                    pedido.Content = new StringContent(corpo.ToString(Formatting.None), Encoding.UTF8, "application/json");
                    pedido.Headers.Accept.ParseAdd("application/json");
                    using (var resposta = Http.SendAsync(pedido).GetAwaiter().GetResult())
                    {
                        var texto = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                        if (!resposta.IsSuccessStatusCode)
                        {
                            return new Sessao { Erro = "Falha no login do CIGAM (HTTP " + (int)resposta.StatusCode + ")." };
                        }
                        var json = JObject.Parse(texto);
                        var hash = ((string)json["hash"] ?? string.Empty).Trim();
                        if (json.Value<bool?>("success") != true || hash.Length == 0)
                        {
                            var msgs = json["messages"] as JArray;
                            var detalhe = msgs != null && msgs.Count > 0 ? " " + Curto(msgs[0].ToString(), 200) : string.Empty;
                            return new Sessao { Erro = "Login no CIGAM recusado." + detalhe };
                        }
                        return new Sessao { Hash = hash };
                    }
                }
            }
            catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException || ex is JsonException)
            {
                return new Sessao { Erro = "CIGAM indisponível no login (" + ex.GetType().Name + ")." };
            }
        }

        // Tenta o filtro principal e o alternativo; renova a sessão uma vez se expirar.
        private ResultadoConsulta BuscarPrecos(string codigo, ref Sessao sessao)
        {
            var filtros = new[]
            {
                "Elemento eq '" + PrecosCigam.Escapar(codigo) + "'",
                "CodigoMaterial eq '" + PrecosCigam.Escapar(codigo) + "'"
            };
            var renovou = false;
            var ultimoErro = string.Empty;

            foreach (var filtro in filtros)
            {
                for (var tentativa = 0; tentativa < 2; tentativa++)
                {
                    var url = _url + "genericos/ge/PrecosTabela/Buscar?$filter=" + Uri.EscapeDataString(filtro) + "&$top=200";
                    int status;
                    string texto;
                    try
                    {
                        using (var pedido = new HttpRequestMessage(HttpMethod.Get, url))
                        {
                            pedido.Headers.TryAddWithoutValidation("Authorization", "Bearer " + sessao.Hash);
                            pedido.Headers.Accept.ParseAdd("application/json");
                            using (var resposta = Http.SendAsync(pedido).GetAwaiter().GetResult())
                            {
                                status = (int)resposta.StatusCode;
                                texto = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                            }
                        }
                    }
                    catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException)
                    {
                        ultimoErro = "Erro na consulta ao CIGAM (" + ex.GetType().Name + ").";
                        break;
                    }

                    if (status == 401 && !renovou)
                    {
                        renovou = true;
                        var nova = Login();
                        if (nova.Erro.Length > 0)
                        {
                            return new ResultadoConsulta { Erro = nova.Erro };
                        }
                        sessao = nova;
                        continue; // repete com a sessão nova
                    }
                    if (status == 403)
                    {
                        return new ResultadoConsulta { Erro = "Usuário de integração sem permissão em PrecosTabela/Buscar (HTTP 403)." };
                    }
                    if (status >= 200 && status < 300)
                    {
                        try
                        {
                            var token = JToken.Parse(string.IsNullOrWhiteSpace(texto) ? "[]" : texto);
                            var lista = token as JArray ?? (token["data"] as JArray) ?? new JArray();
                            return new ResultadoConsulta { Linhas = lista };
                        }
                        catch (JsonException)
                        {
                            ultimoErro = "Resposta do CIGAM em formato inesperado.";
                            break;
                        }
                    }

                    ultimoErro = "Erro na consulta ao CIGAM (HTTP " + status + ").";
                    break; // tenta o filtro alternativo
                }
            }

            return new ResultadoConsulta { Erro = ultimoErro.Length > 0 ? ultimoErro : "Erro na consulta ao CIGAM." };
        }

        private void Logout(string hash)
        {
            if (string.IsNullOrEmpty(hash))
            {
                return;
            }
            try
            {
                using (var pedido = new HttpRequestMessage(HttpMethod.Delete, _url + "genericos/ge/Sessao/Logout"))
                {
                    pedido.Headers.TryAddWithoutValidation("Authorization", "Bearer " + hash);
                    Http.SendAsync(pedido).GetAwaiter().GetResult().Dispose();
                }
            }
            catch (Exception)
            {
                // Falha no logout é ignorada (a sessão expira sozinha).
            }
        }

        // ------------------------------------------------------------
        // Utilidades
        // ------------------------------------------------------------

        private static DateTime HojeBrasilia()
        {
            try
            {
                var fuso = TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, fuso).Date;
            }
            catch (Exception)
            {
                return DateTime.UtcNow.AddHours(-3).Date;
            }
        }

        private static string Curto(string texto, int maximo)
        {
            var t = (texto ?? string.Empty).Trim();
            return t.Length > maximo ? t.Substring(0, maximo) : t;
        }
    }
}
