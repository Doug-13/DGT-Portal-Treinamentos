using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DGT.Treinamentos.Plugins
{
    // ================================================================
    // CUSTOM API dgt_ConsultarFornecedor  →  CNPJá  +  Portal da
    // Transparência (CEIS, CNEP, CEPIM e acordos de leniência)
    //
    // Chamada pelo portal (módulo Fornecedores) e, para a reconsulta
    // periódica, por um fluxo agendado do Power Automate (ação "lote").
    //
    // PayloadJson:
    //   { "acao": "previa", "cnpj": "00000000000000" }
    //       Antes do cadastro: diz se o CNPJ já existe e devolve os dados
    //       da Receita (CNPJá) para preencher o formulário. Não grava.
    //   { "acao": "consultar", "fornecedorId": "<guid>",
    //     "consultas": ["cnpj", "sancoes"] }
    //       Consulta e grava: dgt_fornecedorconsulta (uma linha por
    //       fonte) e os campos "da Receita"/última consulta do fornecedor.
    //   { "acao": "lote", "consultas": ["sancoes"], "limite": 20 }
    //       Fornecedores ativos cuja última consulta é mais antiga que
    //       "diasEntreConsultas" (ou nunca consultados), até o limite.
    //
    // ResultadoJson: ver cada ação (Responder*).
    //
    // REGISTRO (Plugin Registration Tool) — passo, como o do ClickUp:
    //   Message ........ dgt_ConsultarFornecedor
    //   Primary Entity . none
    //   Stage .......... PostOperation   ·   Mode: Synchronous
    //   Secure Configuration (SOMENTE AQUI ficam as chaves):
    //       { "cnpja": "<chave do CNPJá>", "transparencia": "<chave da API de dados>" }
    //   Unsecure Configuration (opcional; valores padrão abaixo):
    //       { "cnpjaUrl": "https://api.cnpja.com",
    //         "cnpjaParametros": "",              (ex.: "maxAge=30" para usar cache)
    //         "transparenciaUrl": "https://api.portaldatransparencia.gov.br/api-de-dados",
    //         "diasEntreConsultas": 14,
    //         "limiteLote": 20 }
    //   Sem a chave da Transparência, a consulta de sanções responde
    //   "não configurada" e o resto funciona normalmente.
    //
    // LGPD:
    //   - o CNPJ é lido de dgt_fornecedor.dgt_cnpj (coluna protegida) com
    //     o usuário do sistema e NUNCA vai para o rastreamento;
    //   - do CNPJá só são gravados dados da EMPRESA: o quadro de sócios,
    //     telefones e e-mails não são lidos nem gravados;
    //   - CPFs eventualmente presentes em textos devolvidos são mascarados.
    // ================================================================
    public sealed class ConsultarFornecedorPlugin : IPlugin
    {
        private const string TabelaFornecedor = "dgt_fornecedor";
        private const string TabelaConsulta = "dgt_fornecedorconsulta";

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(25) };

        private static readonly Regex Cpf =
            new Regex(@"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", RegexOptions.Compiled);

        private static readonly int[] PesosDv1 = { 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };
        private static readonly int[] PesosDv2 = { 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2 };

        private readonly string _chaveCnpja;
        private readonly string _chaveTransparencia;
        private readonly string _urlCnpja = "https://api.cnpja.com";
        private readonly string _parametrosCnpja = string.Empty;
        private readonly string _urlTransparencia = "https://api.portaldatransparencia.gov.br/api-de-dados";
        private readonly int _diasEntreConsultas = 14;
        private readonly int _limiteLote = 20;

        public ConsultarFornecedorPlugin(string unsecureConfig, string secureConfig)
        {
            _chaveCnpja = string.Empty;
            _chaveTransparencia = string.Empty;

            if (!string.IsNullOrWhiteSpace(secureConfig))
            {
                try
                {
                    var segura = JObject.Parse(secureConfig);
                    _chaveCnpja = ((string)segura["cnpja"] ?? string.Empty).Trim();
                    _chaveTransparencia = ((string)segura["transparencia"] ?? string.Empty).Trim();
                }
                catch (JsonException)
                {
                    // Configuração segura inválida: as consultas avisam "não configurada".
                }
            }

            if (!string.IsNullOrWhiteSpace(unsecureConfig))
            {
                try
                {
                    var config = JObject.Parse(unsecureConfig);
                    _urlCnpja = Texto(config["cnpjaUrl"], _urlCnpja).TrimEnd('/');
                    _parametrosCnpja = Texto(config["cnpjaParametros"], string.Empty).TrimStart('?');
                    _urlTransparencia = Texto(config["transparenciaUrl"], _urlTransparencia).TrimEnd('/');
                    _diasEntreConsultas = Math.Max(1, (int?)config["diasEntreConsultas"] ?? _diasEntreConsultas);
                    _limiteLote = Math.Min(40, Math.Max(1, (int?)config["limiteLote"] ?? _limiteLote));
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

            var json = context.InputParameters.Contains("PayloadJson")
                ? context.InputParameters["PayloadJson"] as string
                : null;

            JObject payload;
            try
            {
                payload = JObject.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            }
            catch (JsonException)
            {
                throw new InvalidPluginExecutionException("PayloadJson inválido.");
            }

            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            var acao = Texto(payload["acao"], string.Empty).ToLowerInvariant();
            var usuario = NomeUsuario(sistema, context.InitiatingUserId);
            JObject resultado;

            switch (acao)
            {
                case "previa":
                    resultado = Previa(sistema, tracing, Texto(payload["cnpj"], string.Empty));
                    break;

                case "consultar":
                    Guid id;
                    if (!Guid.TryParse(Texto(payload["fornecedorId"], string.Empty), out id))
                    {
                        throw new InvalidPluginExecutionException("fornecedorId inválido.");
                    }
                    resultado = Consultar(sistema, tracing, id, LerConsultas(payload), usuario);
                    break;

                case "lote":
                    resultado = Lote(sistema, tracing, LerConsultas(payload), (int?)payload["limite"], usuario);
                    break;

                default:
                    throw new InvalidPluginExecutionException("acao deve ser \"previa\", \"consultar\" ou \"lote\".");
            }

            context.OutputParameters["ResultadoJson"] = resultado.ToString(Formatting.None);
        }

        // ------------------------------------------------------------
        // Ações
        // ------------------------------------------------------------

        private JObject Previa(IOrganizationService sistema, ITracingService tracing, string cnpjInformado)
        {
            var cnpj = NormalizarCnpj(cnpjInformado);
            if (!CnpjValido(cnpj))
            {
                throw new InvalidPluginExecutionException("CNPJ inválido.");
            }

            var resultado = new JObject();

            var consulta = new QueryExpression(TabelaFornecedor)
            {
                ColumnSet = new ColumnSet("dgt_name", "dgt_ativo"),
                TopCount = 1
            };
            consulta.Criteria.AddCondition("dgt_cnpj", ConditionOperator.Equal, cnpj);
            var existente = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();

            if (existente != null)
            {
                resultado["existente"] = new JObject
                {
                    ["id"] = existente.Id.ToString(),
                    ["razaoSocial"] = existente.GetAttributeValue<string>("dgt_name") ?? string.Empty,
                    ["ativo"] = existente.GetAttributeValue<bool?>("dgt_ativo") != false
                };
                return resultado;
            }

            if (_chaveCnpja.Length == 0)
            {
                resultado["aviso"] = "Consulta ao CNPJá não configurada: preencha os dados manualmente.";
                return resultado;
            }

            JObject office;
            string erro;
            if (!ConsultarCnpja(tracing, cnpj, out office, out erro))
            {
                resultado["aviso"] = erro;
                return resultado;
            }

            resultado["dados"] = DadosReceita(office);
            return resultado;
        }

        private JObject Consultar(IOrganizationService sistema, ITracingService tracing, Guid id, string[] consultas, string usuario)
        {
            var fornecedor = sistema.Retrieve(TabelaFornecedor, id,
                new ColumnSet("dgt_cnpj", "dgt_name", "dgt_uf", "dgt_cidade", "dgt_endereco"));

            var cnpj = NormalizarCnpj(fornecedor.GetAttributeValue<string>("dgt_cnpj"));
            if (!CnpjValido(cnpj))
            {
                throw new InvalidPluginExecutionException("O fornecedor não tem CNPJ válido no cadastro.");
            }

            var resultado = new JObject();
            var atualizacao = new Entity(TabelaFornecedor, id);

            if (consultas.Contains("cnpj"))
            {
                resultado["cnpj"] = ExecutarCnpj(sistema, tracing, fornecedor, cnpj, atualizacao, usuario);
            }

            if (consultas.Contains("sancoes"))
            {
                var ceis = ExecutarSancao(sistema, tracing, id, cnpj, "CEIS", "ceis", "codigoSancionado", usuario);
                var cnep = ExecutarSancao(sistema, tracing, id, cnpj, "CNEP", "cnep", "codigoSancionado", usuario);
                var cepim = ExecutarSancao(sistema, tracing, id, cnpj, "CEPIM", "cepim", "cnpjSancionado", usuario);
                var leniencia = ExecutarSancao(sistema, tracing, id, cnpj, "LENIENCIA", "acordos-leniencia", "cnpjSancionado", usuario);
                resultado["ceis"] = ceis;
                resultado["cnep"] = cnep;
                resultado["cepim"] = cepim;
                resultado["leniencia"] = leniencia;

                // Leniência é ACORDO (informação para análise), não sanção:
                // aparece na aba Consultas, mas não muda o resultado.
                string situacao;
                if ((int)ceis["vigentes"] > 0 || (int)cnep["vigentes"] > 0 || (int)cepim["vigentes"] > 0)
                {
                    situacao = "Com registro";
                }
                else if (!(bool)ceis["ok"] || !(bool)cnep["ok"] || !(bool)cepim["ok"] || !(bool)leniencia["ok"])
                {
                    situacao = "Erro na consulta";
                }
                else
                {
                    situacao = "Nada consta";
                }

                resultado["resultadoSancoes"] = situacao;
                atualizacao["dgt_resultadosancoes"] = situacao;
                atualizacao["dgt_ultimaconsultasancoes"] = DateTime.UtcNow;
            }

            if (atualizacao.Attributes.Count > 0)
            {
                sistema.Update(atualizacao);
            }

            return resultado;
        }

        private JObject Lote(IOrganizationService sistema, ITracingService tracing, string[] consultas, int? limiteInformado, string usuario)
        {
            var limite = Math.Min(_limiteLote, Math.Max(1, limiteInformado ?? _limiteLote));
            var campoData = consultas.Contains("sancoes") ? "dgt_ultimaconsultasancoes" : "dgt_ultimaconsultacnpj";
            var corte = DateTime.UtcNow.AddDays(-_diasEntreConsultas);

            var consulta = new QueryExpression(TabelaFornecedor)
            {
                ColumnSet = new ColumnSet(false),
                TopCount = limite
            };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            var filtroData = new FilterExpression(LogicalOperator.Or);
            filtroData.AddCondition(campoData, ConditionOperator.Null);
            filtroData.AddCondition(campoData, ConditionOperator.LessThan, corte);
            consulta.Criteria.AddFilter(filtroData);
            consulta.AddOrder(campoData, OrderType.Ascending);

            var ids = sistema.RetrieveMultiple(consulta).Entities.Select(e => e.Id).ToList();

            int comRegistro = 0, erros = 0;
            foreach (var id in ids)
            {
                try
                {
                    var r = Consultar(sistema, tracing, id, consultas, usuario);
                    var situacao = (string)r["resultadoSancoes"] ?? string.Empty;
                    if (situacao == "Com registro") { comRegistro++; }
                    if (situacao == "Erro na consulta") { erros++; }
                }
                catch (Exception ex)
                {
                    erros++;
                    tracing.Trace("Lote: fornecedor {0} não consultado: {1}", id, ex.Message);
                }
            }

            return new JObject
            {
                ["processados"] = ids.Count,
                ["comRegistro"] = comRegistro,
                ["erros"] = erros,
                ["haMais"] = ids.Count >= limite
            };
        }

        // ------------------------------------------------------------
        // CNPJá
        // ------------------------------------------------------------

        private JObject ExecutarCnpj(IOrganizationService sistema, ITracingService tracing, Entity fornecedor, string cnpj, Entity atualizacao, string usuario)
        {
            if (_chaveCnpja.Length == 0)
            {
                RegistrarConsulta(sistema, fornecedor.Id, "CNPJ", "Não configurada", "Chave do CNPJá ausente na Configuração segura do passo.", "CNPJá", usuario);
                return new JObject { ["ok"] = false, ["mensagem"] = "Consulta ao CNPJá não configurada." };
            }

            JObject office;
            string erro;
            if (!ConsultarCnpja(tracing, cnpj, out office, out erro))
            {
                RegistrarConsulta(sistema, fornecedor.Id, "CNPJ", "Erro", erro, "CNPJá", usuario);
                return new JObject { ["ok"] = false, ["mensagem"] = erro };
            }

            var dados = DadosReceita(office);
            var situacao = (string)dados["situacaoCadastral"] ?? string.Empty;

            atualizacao["dgt_situacaocadastral"] = Limitar(situacao, 60);
            atualizacao["dgt_naturezajuridica"] = Limitar((string)dados["naturezaJuridica"], 200);
            atualizacao["dgt_porte"] = Limitar((string)dados["porte"], 100);
            atualizacao["dgt_cnaeprincipal"] = Limitar((string)dados["cnaePrincipal"], 300);
            atualizacao["dgt_ultimaconsultacnpj"] = DateTime.UtcNow;

            var dataSituacao = DataIso((string)dados["dataSituacao"]);
            if (dataSituacao.HasValue) { atualizacao["dgt_datasituacao"] = dataSituacao.Value; }
            var abertura = DataIso((string)dados["dataAbertura"]);
            if (abertura.HasValue) { atualizacao["dgt_dataabertura"] = abertura.Value; }

            // Endereço: só preenche o que está vazio (a equipe pode ter
            // ajustado à mão; a diferença vai para o resumo).
            if (string.IsNullOrWhiteSpace(fornecedor.GetAttributeValue<string>("dgt_uf"))) { atualizacao["dgt_uf"] = Limitar((string)dados["uf"], 2); }
            if (string.IsNullOrWhiteSpace(fornecedor.GetAttributeValue<string>("dgt_cidade"))) { atualizacao["dgt_cidade"] = Limitar((string)dados["cidade"], 120); }
            if (string.IsNullOrWhiteSpace(fornecedor.GetAttributeValue<string>("dgt_endereco"))) { atualizacao["dgt_endereco"] = Limitar((string)dados["endereco"], 400); }

            var resumo = new StringBuilder();
            resumo.AppendLine($"Situação cadastral: {situacao}" + (string.IsNullOrEmpty((string)dados["dataSituacao"]) ? string.Empty : $" desde {(string)dados["dataSituacao"]}"));
            resumo.AppendLine($"Razão social na Receita: {(string)dados["razaoSocial"]}");
            if (!string.Equals(Normalizar((string)dados["razaoSocial"]), Normalizar(fornecedor.GetAttributeValue<string>("dgt_name")), StringComparison.Ordinal))
            {
                resumo.AppendLine("ATENÇÃO: a razão social cadastrada é diferente da Receita. Confira e atualize o cadastro.");
            }
            resumo.AppendLine($"Atividade principal: {(string)dados["cnaePrincipal"]}");
            resumo.AppendLine($"Natureza jurídica: {(string)dados["naturezaJuridica"]} · Porte: {(string)dados["porte"]}");

            var ativa = situacao.Equals("Ativa", StringComparison.OrdinalIgnoreCase);
            RegistrarConsulta(sistema, fornecedor.Id, "CNPJ", ativa ? "Ativa" : $"Situação: {situacao}", resumo.ToString(), "CNPJá (Receita Federal)", usuario);

            return new JObject
            {
                ["ok"] = true,
                ["mensagem"] = ativa ? "CNPJ ativo na Receita." : $"Atenção: situação cadastral \"{situacao}\"."
            };
        }

        private bool ConsultarCnpja(ITracingService tracing, string cnpj, out JObject office, out string erro)
        {
            office = null;
            erro = string.Empty;

            var url = $"{_urlCnpja}/office/{cnpj}" + (_parametrosCnpja.Length > 0 ? "?" + _parametrosCnpja : string.Empty);

            using (var requisicao = new HttpRequestMessage(HttpMethod.Get, url))
            {
                requisicao.Headers.TryAddWithoutValidation("Authorization", _chaveCnpja);
                requisicao.Headers.TryAddWithoutValidation("Accept", "application/json");

                HttpResponseMessage resposta;
                string conteudo;
                try
                {
                    resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                    conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                }
                catch (Exception ex)
                {
                    tracing.Trace("CNPJá: falha de rede: {0}", ex.Message);
                    erro = "Não foi possível falar com o CNPJá agora. Tente de novo em instantes.";
                    return false;
                }

                var codigo = (int)resposta.StatusCode;
                if (!resposta.IsSuccessStatusCode)
                {
                    tracing.Trace("CNPJá respondeu {0}.", codigo);
                    erro = codigo == 401 || codigo == 403
                        ? "O CNPJá recusou a chave configurada no plugin (verifique a Configuração segura)."
                        : codigo == 404
                            ? "CNPJ não encontrado na base da Receita."
                            : codigo == 429
                                ? "Limite ou créditos do CNPJá esgotados. Tente mais tarde."
                                : $"O CNPJá respondeu com erro ({codigo}).";
                    return false;
                }

                try
                {
                    office = JObject.Parse(conteudo);
                    return true;
                }
                catch (JsonException)
                {
                    erro = "Resposta do CNPJá em formato inesperado.";
                    return false;
                }
            }
        }

        // Só dados da empresa (sem sócios, telefones e e-mails).
        private static JObject DadosReceita(JObject office)
        {
            var empresa = office["company"] as JObject ?? new JObject();
            var endereco = office["address"] as JObject ?? new JObject();
            var atividade = office["mainActivity"] as JObject;

            var partes = new List<string>();
            var rua = Juntar(" ", Texto(endereco["street"], string.Empty), Texto(endereco["number"], string.Empty));
            if (rua.Length > 0) { partes.Add(rua); }
            var complemento = Texto(endereco["details"], string.Empty);
            if (complemento.Length > 0) { partes.Add(complemento); }
            var bairro = Texto(endereco["district"], string.Empty);
            if (bairro.Length > 0) { partes.Add(bairro); }
            var cep = Texto(endereco["zip"], string.Empty);
            if (cep.Length > 0) { partes.Add("CEP " + cep); }

            return new JObject
            {
                ["razaoSocial"] = Mascarar(Texto(empresa["name"], string.Empty)),
                ["nomeFantasia"] = Mascarar(Texto(office["alias"], string.Empty)),
                ["situacaoCadastral"] = Texto(office["status"]?["text"], string.Empty),
                ["dataSituacao"] = Texto(office["statusDate"], string.Empty),
                ["dataAbertura"] = Texto(office["founded"], string.Empty),
                ["naturezaJuridica"] = Texto(empresa["nature"]?["text"], string.Empty),
                ["porte"] = Texto(empresa["size"]?["text"], string.Empty),
                ["cnaePrincipal"] = atividade == null ? string.Empty : Juntar(" - ", Texto(atividade["id"], string.Empty), Texto(atividade["text"], string.Empty)),
                ["uf"] = Texto(endereco["state"], string.Empty),
                ["cidade"] = Texto(endereco["city"], string.Empty),
                ["endereco"] = Mascarar(string.Join(" · ", partes))
            };
        }

        // ------------------------------------------------------------
        // Portal da Transparência (CEIS / CNEP / CEPIM / leniência)
        // CEIS e CNEP filtram por codigoSancionado; CEPIM e leniência,
        // por cnpjSancionado. Leniência é acordo, não sanção: só informa.
        // ------------------------------------------------------------

        private JObject ExecutarSancao(IOrganizationService sistema, ITracingService tracing, Guid fornecedorId, string cnpj, string cadastro, string rota, string parametro, string usuario)
        {
            if (_chaveTransparencia.Length == 0)
            {
                RegistrarConsulta(sistema, fornecedorId, cadastro, "Não configurada", "Chave da API do Portal da Transparência ausente na Configuração segura do passo.", "Portal da Transparência", usuario);
                return new JObject { ["ok"] = false, ["registros"] = 0, ["vigentes"] = 0, ["mensagem"] = "Consulta não configurada." };
            }

            var registros = new JArray();
            var erro = string.Empty;

            for (var pagina = 1; pagina <= 5; pagina++)
            {
                var url = $"{_urlTransparencia}/{rota}?{parametro}={Uri.EscapeDataString(cnpj)}&pagina={pagina}";

                using (var requisicao = new HttpRequestMessage(HttpMethod.Get, url))
                {
                    requisicao.Headers.TryAddWithoutValidation("chave-api-dados", _chaveTransparencia);
                    requisicao.Headers.TryAddWithoutValidation("Accept", "application/json");

                    HttpResponseMessage resposta;
                    string conteudo;
                    try
                    {
                        resposta = Http.SendAsync(requisicao).GetAwaiter().GetResult();
                        conteudo = resposta.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                    }
                    catch (Exception ex)
                    {
                        tracing.Trace("{0}: falha de rede: {1}", cadastro, ex.Message);
                        erro = "Não foi possível falar com o Portal da Transparência agora.";
                        break;
                    }

                    var codigo = (int)resposta.StatusCode;
                    if (!resposta.IsSuccessStatusCode)
                    {
                        tracing.Trace("{0} respondeu {1}.", cadastro, codigo);
                        erro = codigo == 401 || codigo == 403
                            ? "O Portal da Transparência recusou a chave configurada no plugin."
                            : codigo == 405 || conteudo.TrimStart().StartsWith("<", StringComparison.Ordinal)
                                ? "O Portal da Transparência bloqueou a chamada (verificação de segurança do site). Tente mais tarde."
                                : codigo == 429
                                    ? "Limite de requisições do Portal da Transparência atingido. Tente mais tarde."
                                    : $"O Portal da Transparência respondeu com erro ({codigo}).";
                        break;
                    }

                    JArray lista;
                    try
                    {
                        lista = JArray.Parse(conteudo);
                    }
                    catch (JsonException)
                    {
                        erro = "Resposta do Portal da Transparência em formato inesperado.";
                        break;
                    }

                    foreach (var item in lista)
                    {
                        registros.Add(item);
                    }

                    if (lista.Count == 0 || lista.Count < 15)
                    {
                        break;
                    }
                }
            }

            if (erro.Length > 0 && registros.Count == 0)
            {
                RegistrarConsulta(sistema, fornecedorId, cadastro, "Erro", erro, "Portal da Transparência", usuario);
                return new JObject { ["ok"] = false, ["registros"] = 0, ["vigentes"] = 0, ["mensagem"] = erro };
            }

            var hoje = DateTime.UtcNow.AddHours(-3).Date;
            var vigentes = 0;
            var resumo = new StringBuilder();

            foreach (var item in registros.OfType<JObject>())
            {
                if (cadastro == "CEPIM")
                {
                    // Cadastro de entidades IMPEDIDAS: estar na lista é o impedimento.
                    vigentes++;
                    resumo.AppendLine(Mascarar(
                        $"[IMPEDIDA] {Texto(item["motivo"], "motivo não informado")} — {Texto(item["orgaoSuperior"]?["nome"], "órgão não informado")}" +
                        $" — convênio {Texto(item["convenio"]?["numero"], Texto(item["convenio"]?["codigo"], "não informado"))}" +
                        $" — referência {Texto(item["dataReferencia"], "?")}"));
                    continue;
                }

                if (cadastro == "LENIENCIA")
                {
                    var fimAcordo = DataBr(Texto(item["dataFimAcordo"], string.Empty));
                    var emVigor = !fimAcordo.HasValue || fimAcordo.Value >= hoje;
                    if (emVigor) { vigentes++; }
                    resumo.AppendLine(Mascarar(
                        $"[ACORDO {(emVigor ? "EM VIGOR" : "encerrado")}] {Texto(item["situacaoAcordo"], "situação não informada")}" +
                        $" — {Texto(item["orgaoResponsavel"], "órgão não informado")}" +
                        $" — {Texto(item["dataInicioAcordo"], "?")} a {Texto(item["dataFimAcordo"], "sem data de fim")}"));
                    continue;
                }

                var fim = DataBr(Texto(item["dataFimSancao"], string.Empty));
                var vigente = !fim.HasValue || fim.Value >= hoje;
                if (vigente) { vigentes++; }

                var tipo = Texto(item["tipoSancao"]?["descricaoResumida"], Texto(item["tipoSancao"]?["descricaoPortal"], "Sanção"));
                var orgao = Texto(item["orgaoSancionador"]?["nome"], "órgão não informado");
                var uf = Texto(item["orgaoSancionador"]?["siglaUf"], string.Empty);
                var inicio = Texto(item["dataInicioSancao"], "?");
                var termino = Texto(item["dataFimSancao"], string.Empty);

                resumo.AppendLine(Mascarar(
                    $"{(vigente ? "[VIGENTE]" : "[encerrada]")} {tipo} — {orgao}{(uf.Length > 0 ? "/" + uf : string.Empty)} — {inicio} a {(termino.Length > 0 ? termino : "sem data de fim")}"));
            }

            string resultado;
            if (registros.Count == 0)
            {
                resultado = "Nada consta";
                resumo.AppendLine($"Nenhum registro {(cadastro == "LENIENCIA" ? "de acordo de leniência" : "no " + cadastro)} para o CNPJ consultado.");
            }
            else
            {
                resultado = cadastro == "LENIENCIA"
                    ? (vigentes > 0 ? $"Acordo de leniência ({vigentes} em vigor)" : "Somente acordos encerrados")
                    : cadastro == "CEPIM"
                        ? $"Com registro ({vigentes} impedimento{(vigentes > 1 ? "s" : string.Empty)})"
                        : vigentes > 0 ? $"Com registro ({vigentes} vigente{(vigentes > 1 ? "s" : string.Empty)})" : "Somente sanções encerradas";
            }

            if (erro.Length > 0)
            {
                resumo.AppendLine($"Consulta incompleta: {erro}");
            }

            RegistrarConsulta(sistema, fornecedorId, cadastro, resultado, resumo.ToString(), "Portal da Transparência (CGU)", usuario);

            return new JObject
            {
                ["ok"] = erro.Length == 0,
                ["registros"] = registros.Count,
                ["vigentes"] = vigentes,
                ["mensagem"] = resultado
            };
        }

        // ------------------------------------------------------------
        // Gravação e auxiliares
        // ------------------------------------------------------------

        private static void RegistrarConsulta(IOrganizationService sistema, Guid fornecedorId, string tipo, string resultado, string resumo, string fonte, string usuario)
        {
            var linha = new Entity(TabelaConsulta);
            linha["dgt_name"] = Limitar($"{tipo} — {resultado}", 200);
            linha["dgt_fornecedor"] = new EntityReference(TabelaFornecedor, fornecedorId);
            linha["dgt_tipo"] = tipo;
            linha["dgt_resultado"] = Limitar(resultado, 100);
            linha["dgt_resumo"] = Limitar(resumo, 4000);
            linha["dgt_fonte"] = Limitar(fonte, 100);
            linha["dgt_executadopor"] = Limitar(usuario, 200);
            sistema.Create(linha);
        }

        private static string[] LerConsultas(JObject payload)
        {
            var lista = payload["consultas"] as JArray;
            var consultas = lista == null
                ? new[] { "cnpj", "sancoes" }
                : lista.Select(c => ((string)c ?? string.Empty).Trim().ToLowerInvariant()).Where(c => c == "cnpj" || c == "sancoes").Distinct().ToArray();
            if (consultas.Length == 0)
            {
                throw new InvalidPluginExecutionException("Informe consultas: \"cnpj\" e/ou \"sancoes\".");
            }
            return consultas;
        }

        private static string NomeUsuario(IOrganizationService sistema, Guid usuarioId)
        {
            try
            {
                var usuario = sistema.Retrieve("systemuser", usuarioId, new ColumnSet("fullname"));
                return usuario.GetAttributeValue<string>("fullname") ?? "Automação";
            }
            catch (Exception)
            {
                return "Automação";
            }
        }

        public static string NormalizarCnpj(string valor) =>
            Regex.Replace((valor ?? string.Empty).ToUpperInvariant(), "[^0-9A-Z]", string.Empty);

        // Numérico e alfanumérico (valor do caractere = ASCII − 48).
        public static bool CnpjValido(string cnpj)
        {
            if (cnpj == null || !Regex.IsMatch(cnpj, "^[0-9A-Z]{12}[0-9]{2}$"))
            {
                return false;
            }
            if (cnpj.Distinct().Count() == 1)
            {
                return false;
            }
            var dv1 = Digito(cnpj.Substring(0, 12), PesosDv1);
            var dv2 = Digito(cnpj.Substring(0, 12) + dv1.ToString(CultureInfo.InvariantCulture), PesosDv2);
            return cnpj.Substring(12) == $"{dv1}{dv2}";
        }

        private static int Digito(string baseCnpj, int[] pesos)
        {
            var soma = 0;
            for (var i = 0; i < pesos.Length; i++)
            {
                soma += (baseCnpj[i] - 48) * pesos[i];
            }
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        private static string Texto(JToken token, string padrao)
        {
            if (token == null || token.Type == JTokenType.Null)
            {
                return padrao;
            }
            var valor = token.Type == JTokenType.String ? (string)token : token.ToString(Formatting.None);
            return string.IsNullOrWhiteSpace(valor) ? padrao : valor.Trim();
        }

        private static string Juntar(string separador, params string[] partes) =>
            string.Join(separador, partes.Where(p => !string.IsNullOrWhiteSpace(p)));

        private static string Limitar(string valor, int tamanho)
        {
            var v = (valor ?? string.Empty).Trim();
            return v.Length > tamanho ? v.Substring(0, tamanho) : v;
        }

        private static string Mascarar(string texto) =>
            Cpf.Replace(texto ?? string.Empty, "[dado removido]");

        private static string Normalizar(string texto) =>
            Regex.Replace((texto ?? string.Empty).ToUpperInvariant(), @"\s+", " ").Trim();

        private static DateTime? DataIso(string valor)
        {
            DateTime data;
            return DateTime.TryParseExact((valor ?? string.Empty).Length >= 10 ? valor.Substring(0, 10) : valor,
                "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out data)
                ? (DateTime?)DateTime.SpecifyKind(data, DateTimeKind.Unspecified)
                : null;
        }

        private static DateTime? DataBr(string valor)
        {
            DateTime data;
            return DateTime.TryParseExact(valor ?? string.Empty, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out data)
                ? (DateTime?)data.Date
                : null;
        }
    }
}
