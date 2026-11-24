using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Metadata.Query;
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
    //   Certidões (Infosimples) — em "consultas" de "consultar"/"lote":
    //     "cnd_federal" (Receita/PGFN), "fgts" (Caixa/CRF), "cndt" (TST),
    //     "cnd_estadual", "cnd_municipal", "ceat" (CEAT do TRT da sede)
    //     ou "certidoes" (todas).
    //     Cada certidão leva de segundos a ~1 min na fonte; a chamada tem
    //     ~105 s no total (limite do Dataverse). O portal pede UMA por vez;
    //     o que não couber no tempo volta como "pulada".
    //     Certidão regular → registra o documento (tipo cujo
    //     dgt_codigoconsulta é o código) e substitui a versão anterior.
    //   { "acao": "lote", "consultas": ["certidoes"], "limite": 20 }
    //       Renova as certidões que vencem em até "diasRenovacaoCertidoes"
    //       (ou que faltam). Para quando o tempo acaba: "haMais" = true.
    //   { "acao": "receberFicha", "ficha": { ... } }
    //       Resposta do Microsoft Forms (Ficha SUP-CPL-01) enviada pelo
    //       Power Automate. Cria (ou atualiza, se o CNPJ já existe) o
    //       fornecedor em "Em homologação", completa com a Receita e
    //       devolve { id, protocolo, novo, documentosPendentes[] }.
    //       Sem ciclo de homologação aberto, abre um (kanban: "Ficha recebida").
    //   { "acao": "localizarProtocolo", "assunto": "Re: [FORN-2026-0042] ..." }
    //       (ou "protocolo"). Fluxo 2, ANTES de salvar os anexos: devolve
    //       { encontrado, protocolo, fornecedorId, razaoSocial, pasta } —
    //       "pasta" é o nome exato da subpasta do fornecedor no SharePoint.
    //   { "acao": "receberDocumentos", "assunto": "...",
    //     "arquivos": [ { "nome": "contrato.pdf", "url": "https://..." } ] }
    //       Fluxo 2, DEPOIS de salvar: cada arquivo vira um documento
    //       "A conferir" (sem tipo/datas; a analista confere no portal).
    //       Não repete um link já registrado. Devolve
    //       { encontrado, protocolo, fornecedorId, razaoSocial, pasta, registrados, ignorados }.
    //
    // ResultadoJson: ver cada ação (Responder*).
    //
    // REGISTRO (Plugin Registration Tool) — passo, como o do ClickUp:
    //   Message ........ dgt_ConsultarFornecedor
    //   Primary Entity . none
    //   Stage .......... PostOperation   ·   Mode: Synchronous
    //   Secure Configuration (SOMENTE AQUI ficam as chaves):
    //       { "cnpja": "<chave do CNPJá>", "transparencia": "<chave da API de dados>",
    //         "infosimples": "<token da Infosimples>" }
    //   Unsecure Configuration (opcional; valores padrão abaixo):
    //       { "cnpjaUrl": "https://api.cnpja.com",
    //         "cnpjaParametros": "",              (ex.: "maxAge=30" para usar cache)
    //         "transparenciaUrl": "https://api.portaldatransparencia.gov.br/api-de-dados",
    //         "diasEntreConsultas": 14,
    //         "limiteLote": 20,
    //         "infosimplesUrl": "https://api.infosimples.com/api/v2/consultas",
    //         "infosimplesTimeout": 90,           (segundos por certidão)
    //         "diasRenovacaoCertidoes": 15,
    //         "rotasEstaduais":  { "SC": "<rota>?inscricao_estadual={ie}" },
    //         "rotasMunicipais": { "SC/FLORIANOPOLIS": "<rota>" },
    //         "rotasTrt":        { "RS": "tribunal/trt4/ceat" },
    //         "areaSuprimentos": "SUY",           (sigla da área da 1ª etapa da homologação)
    //         "linkPortal": "https://..." }       (link no e-mail "Ficha recebida"; opcional)
    //   rotasTrt (CEAT): TRT da sede do fornecedor, por UF ("RS") ou por
    //   cidade ("SP/CAMPINAS", para UF com mais de um TRT). Padrão: só RS
    //   (TRT4, rota confirmada). UF sem rota: "Sem cobertura".
    //   Rotas estaduais/municipais: o caminho da consulta na Infosimples
    //   (depois de /consultas/), conforme o catálogo contratado. Depois do
    //   "?" vão parâmetros extras; {cnpj}, {ie} e {im} são trocados pelos
    //   dados do fornecedor. Sem rota: "Sem cobertura" (emissão manual).
    //   Sem a chave de uma fonte, a consulta dela responde "não
    //   configurada" e o resto funciona normalmente.
    //
    // LGPD:
    //   - o CNPJ é lido de dgt_fornecedor.dgt_cnpj (coluna protegida) com
    //     o usuário do sistema e NUNCA vai para o rastreamento;
    //   - do CNPJá só são gravados dados da EMPRESA: o quadro de sócios,
    //     telefones e e-mails não são lidos nem gravados;
    //   - CPFs eventualmente presentes em textos devolvidos são mascarados;
    //   - na ficha, sócios (com CPF) e dados bancários vão SÓ para colunas
    //     com segurança de campo (dgt_quadrosocietario, dgt_dadosbancarios)
    //     e nunca para o histórico ou o rastreamento.
    // ================================================================
    public sealed class ConsultarFornecedorPlugin : IPlugin
    {
        private const string TabelaFornecedor = "dgt_fornecedor";
        private const string TabelaConsulta = "dgt_fornecedorconsulta";
        private const string TabelaTipo = "dgt_tipodocumentofornecedor";
        private const string TabelaDocumento = "dgt_fornecedordocumento";
        private const string TabelaHistorico = "dgt_fornecedorhistorico";
        private const string TabelaCiclo = "dgt_fornecedorhomologacao";

        // Tempo total da chamada (o Dataverse encerra plugins síncronos em 2 min).
        private const int SegundosPorChamada = 105;

        private static readonly HttpClient Http =
            new HttpClient { Timeout = TimeSpan.FromSeconds(25) };

        // Certidões podem demorar na fonte: o prazo real vem do token de cancelamento.
        private static readonly HttpClient HttpLongo =
            new HttpClient { Timeout = TimeSpan.FromSeconds(SegundosPorChamada) };

        private sealed class Certidao
        {
            public Certidao(string codigo, string tipo, string nome, string rota)
            {
                Codigo = codigo; Tipo = tipo; Nome = nome; Rota = rota;
            }
            public string Codigo { get; }
            public string Tipo { get; }   // dgt_fornecedorconsulta.dgt_tipo
            public string Nome { get; }
            public string Rota { get; }   // null = estadual/municipal (configurável)
        }

        private static readonly Certidao[] Certidoes =
        {
            new Certidao("cnd_federal", "CND_FEDERAL", "CND Federal (Receita/PGFN)", "receita-federal/pgfn?preferencia_emissao=2via"),
            new Certidao("fgts", "FGTS", "Certificado de Regularidade do FGTS (CRF)", "caixa/regularidade"),
            new Certidao("cndt", "CNDT", "Certidão Negativa de Débitos Trabalhistas (CNDT)", "tst/cndt"),
            new Certidao("cnd_estadual", "CND_ESTADUAL", "CND Estadual", null),
            new Certidao("cnd_municipal", "CND_MUNICIPAL", "CND Municipal", null),
            new Certidao("ceat", "CEAT", "CEAT — ações trabalhistas (TRT da sede)", null)
        };

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
        private readonly string _chaveInfosimples;
        private readonly string _urlInfosimples = "https://api.infosimples.com/api/v2/consultas";
        private readonly int _timeoutInfosimples = 90;
        private readonly int _diasRenovacaoCertidoes = 15;
        // Sigla (dgt_area.dgt_sigla) da área que responde a 1ª etapa da
        // homologação (SUP-HOM) — gravada no ciclo aberto pela ficha.
        private readonly string _areaSuprimentos = HomologacaoFornecedor.SiglaSuprimentosPadrao;
        // Link do portal no aviso "Ficha recebida" (opcional).
        private readonly string _linkPortal = string.Empty;
        private readonly Dictionary<string, string> _rotasEstaduais = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _rotasMunicipais = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string> _rotasTrt = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["RS"] = "tribunal/trt4/ceat"
        };

        public ConsultarFornecedorPlugin(string unsecureConfig, string secureConfig)
        {
            _chaveCnpja = string.Empty;
            _chaveTransparencia = string.Empty;
            _chaveInfosimples = string.Empty;

            if (!string.IsNullOrWhiteSpace(secureConfig))
            {
                try
                {
                    var segura = JObject.Parse(secureConfig);
                    _chaveCnpja = ((string)segura["cnpja"] ?? string.Empty).Trim();
                    _chaveTransparencia = ((string)segura["transparencia"] ?? string.Empty).Trim();
                    _chaveInfosimples = ((string)segura["infosimples"] ?? string.Empty).Trim();
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
                    _urlInfosimples = Texto(config["infosimplesUrl"], _urlInfosimples).TrimEnd('/');
                    _timeoutInfosimples = Math.Min(100, Math.Max(15, (int?)config["infosimplesTimeout"] ?? _timeoutInfosimples));
                    _diasRenovacaoCertidoes = Math.Max(1, (int?)config["diasRenovacaoCertidoes"] ?? _diasRenovacaoCertidoes);
                    _areaSuprimentos = Texto(config["areaSuprimentos"], _areaSuprimentos).Trim();
                    _linkPortal = Texto(config["linkPortal"], string.Empty).Trim();
                    LerRotas(config["rotasEstaduais"] as JObject, _rotasEstaduais);
                    LerRotas(config["rotasMunicipais"] as JObject, _rotasMunicipais);
                    LerRotas(config["rotasTrt"] as JObject, _rotasTrt);
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
            var prazo = DateTime.UtcNow.AddSeconds(SegundosPorChamada);
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
                    resultado = Consultar(sistema, tracing, id, LerConsultas(payload), usuario, prazo);
                    break;

                case "lote":
                    var consultasLote = LerConsultas(payload);
                    if (consultasLote.Any(EhCertidao) && consultasLote.Any(c => !EhCertidao(c)))
                    {
                        throw new InvalidPluginExecutionException("No lote, peça certidões separadamente de \"cnpj\"/\"sancoes\".");
                    }
                    resultado = consultasLote.Any(EhCertidao)
                        ? LoteCertidoes(sistema, tracing, consultasLote, (int?)payload["limite"], usuario, prazo)
                        : Lote(sistema, tracing, consultasLote, (int?)payload["limite"], usuario, prazo);
                    break;

                case "receberficha":
                    resultado = ReceberFicha(sistema, tracing, payload["ficha"] as JObject, usuario);
                    break;

                case "localizarprotocolo":
                    resultado = LocalizarProtocolo(sistema, Texto(payload["protocolo"], Texto(payload["assunto"], string.Empty)));
                    break;

                case "receberdocumentos":
                    resultado = ReceberDocumentos(sistema, payload, usuario);
                    break;

                default:
                    throw new InvalidPluginExecutionException(
                        "acao deve ser \"previa\", \"consultar\", \"lote\", \"receberFicha\", \"localizarProtocolo\" ou \"receberDocumentos\".");
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

        private JObject Consultar(IOrganizationService sistema, ITracingService tracing, Guid id, string[] consultas, string usuario, DateTime prazo)
        {
            var fornecedor = sistema.Retrieve(TabelaFornecedor, id,
                new ColumnSet("dgt_cnpj", "dgt_name", "dgt_nomefantasia", "dgt_uf", "dgt_cidade", "dgt_endereco", "dgt_inscricaoestadual", "dgt_inscricaomunicipal"));

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

            var pedidas = Certidoes.Where(c => consultas.Contains(c.Codigo)).ToList();
            if (pedidas.Count > 0)
            {
                var certidoes = new JObject();
                foreach (var certidao in pedidas)
                {
                    // Cada certidão precisa de tempo para a fonte responder.
                    if ((prazo - DateTime.UtcNow).TotalSeconds < 25)
                    {
                        certidoes[certidao.Codigo] = new JObject
                        {
                            ["ok"] = false,
                            ["pulada"] = true,
                            ["mensagem"] = "Não executada: o tempo desta chamada acabou. Consulte de novo."
                        };
                        continue;
                    }
                    certidoes[certidao.Codigo] = ExecutarCertidao(sistema, tracing, fornecedor, cnpj, certidao, usuario, prazo);
                }
                resultado["certidoes"] = certidoes;
                atualizacao["dgt_ultimaconsultacertidoes"] = DateTime.UtcNow;
                ResumirCertidoes(sistema, id, atualizacao);
                resultado["resultadoCertidoes"] = (string)atualizacao["dgt_resultadocertidoes"];
            }

            if (atualizacao.Attributes.Count > 0)
            {
                sistema.Update(atualizacao);
            }

            return resultado;
        }

        private JObject Lote(IOrganizationService sistema, ITracingService tracing, string[] consultas, int? limiteInformado, string usuario, DateTime prazo)
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
                    var r = Consultar(sistema, tracing, id, consultas, usuario, prazo);
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

            // Cadastro vindo da ficha sem razão social: assume a da Receita.
            var nomeAtual = fornecedor.GetAttributeValue<string>("dgt_name") ?? string.Empty;
            if (string.IsNullOrWhiteSpace(nomeAtual) || nomeAtual == "(razão social pendente)")
            {
                atualizacao["dgt_name"] = Limitar((string)dados["razaoSocial"], 200);
                fornecedor["dgt_name"] = atualizacao["dgt_name"];
            }
            if (string.IsNullOrWhiteSpace(fornecedor.GetAttributeValue<string>("dgt_nomefantasia")))
            {
                atualizacao["dgt_nomefantasia"] = Limitar((string)dados["nomeFantasia"], 200);
            }

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
        // Certidões (Infosimples)
        // ------------------------------------------------------------

        private JObject LoteCertidoes(IOrganizationService sistema, ITracingService tracing, string[] consultas, int? limiteInformado, string usuario, DateTime prazo)
        {
            var limite = Math.Min(_limiteLote, Math.Max(1, limiteInformado ?? _limiteLote));
            var corte = HojeBrasilia().AddDays(_diasRenovacaoCertidoes);
            var pedidas = Certidoes.Where(c => consultas.Contains(c.Codigo)).ToList();

            var consulta = new QueryExpression(TabelaFornecedor)
            {
                ColumnSet = new ColumnSet(false),
                TopCount = limite
            };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            consulta.Criteria.AddCondition("dgt_status", ConditionOperator.NotIn, "Descredenciado", "Reprovado");
            var filtroVencimento = new FilterExpression(LogicalOperator.Or);
            filtroVencimento.AddCondition("dgt_vencimentocertidoes", ConditionOperator.Null);
            filtroVencimento.AddCondition("dgt_vencimentocertidoes", ConditionOperator.LessEqual, corte);
            consulta.Criteria.AddFilter(filtroVencimento);
            // Quem já foi tentado nas últimas 20 h fica para o dia seguinte.
            var filtroUltima = new FilterExpression(LogicalOperator.Or);
            filtroUltima.AddCondition("dgt_ultimaconsultacertidoes", ConditionOperator.Null);
            filtroUltima.AddCondition("dgt_ultimaconsultacertidoes", ConditionOperator.LessThan, DateTime.UtcNow.AddHours(-20));
            consulta.Criteria.AddFilter(filtroUltima);
            consulta.AddOrder("dgt_vencimentocertidoes", OrderType.Ascending);

            var ids = sistema.RetrieveMultiple(consulta).Entities.Select(e => e.Id).ToList();
            var tipos = TiposAutomaticos(sistema);

            int processados = 0, regulares = 0, irregulares = 0, erros = 0;
            var haMais = ids.Count >= limite;

            foreach (var id in ids)
            {
                if ((prazo - DateTime.UtcNow).TotalSeconds < 30)
                {
                    haMais = true;
                    break;
                }

                // Só as certidões ligadas a um tipo de documento e que faltam ou vencem logo.
                var vencimentos = VencimentosVigentes(sistema, id, tipos.Values);
                var renovar = pedidas
                    .Where(c => tipos.ContainsKey(c.Codigo))
                    .Where(c =>
                    {
                        DateTime? venc;
                        return !vencimentos.TryGetValue(tipos[c.Codigo], out venc) || !venc.HasValue || venc.Value <= corte;
                    })
                    .Select(c => c.Codigo)
                    .ToArray();

                try
                {
                    if (renovar.Length == 0)
                    {
                        var marcar = new Entity(TabelaFornecedor, id) { ["dgt_ultimaconsultacertidoes"] = DateTime.UtcNow };
                        ResumirCertidoes(sistema, id, marcar);
                        sistema.Update(marcar);
                        continue;
                    }

                    processados++;
                    var r = Consultar(sistema, tracing, id, renovar, usuario, prazo);
                    foreach (var item in ((JObject)r["certidoes"]).Properties().Select(p => (JObject)p.Value))
                    {
                        if ((bool?)item["pulada"] == true) { haMais = true; }
                        else if ((bool?)item["regular"] == true) { regulares++; }
                        else if ((bool?)item["regular"] == false) { irregulares++; }
                        else if ((bool?)item["ok"] != true && (bool?)item["semCobertura"] != true) { erros++; }
                    }
                }
                catch (Exception ex)
                {
                    erros++;
                    tracing.Trace("Lote de certidões: fornecedor {0} não consultado: {1}", id, ex.Message);
                }
            }

            return new JObject
            {
                ["processados"] = processados,
                ["regulares"] = regulares,
                ["irregulares"] = irregulares,
                ["erros"] = erros,
                ["haMais"] = haMais
            };
        }

        private JObject ExecutarCertidao(IOrganizationService sistema, ITracingService tracing, Entity fornecedor, string cnpj, Certidao certidao, string usuario, DateTime prazo)
        {
            const string Fonte = "Infosimples";

            if (_chaveInfosimples.Length == 0)
            {
                RegistrarConsulta(sistema, fornecedor.Id, certidao.Tipo, "Não configurada", "Token da Infosimples ausente na Configuração segura do passo.", Fonte, usuario);
                return new JObject { ["ok"] = false, ["mensagem"] = "Consulta à Infosimples não configurada." };
            }

            var uf = (fornecedor.GetAttributeValue<string>("dgt_uf") ?? string.Empty).Trim().ToUpperInvariant();
            var cidade = (fornecedor.GetAttributeValue<string>("dgt_cidade") ?? string.Empty).Trim();
            var rota = RotaDaCertidao(certidao, uf, cidade);

            if (string.IsNullOrWhiteSpace(rota))
            {
                var onde = certidao.Codigo == "cnd_estadual" || certidao.Codigo == "ceat"
                    ? (uf.Length > 0 ? (certidao.Codigo == "ceat" ? $"o TRT da UF {uf}" : $"a UF {uf}") : "fornecedor sem UF no cadastro")
                    : (cidade.Length > 0 ? $"{cidade}/{uf}" : "fornecedor sem cidade no cadastro");
                var texto = $"Não há rota da Infosimples configurada para {onde}. Emita a certidão no site do órgão e registre em Documentos.";
                RegistrarConsulta(sistema, fornecedor.Id, certidao.Tipo, "Sem cobertura", texto, Fonte, usuario);
                return new JObject { ["ok"] = false, ["semCobertura"] = true, ["mensagem"] = $"Sem cobertura automática para {onde}." };
            }

            var partes = rota.Split(new[] { '?' }, 2);
            var caminho = partes[0].Trim().Trim('/');
            var segundos = (int)Math.Max(10, Math.Min(_timeoutInfosimples, (prazo - DateTime.UtcNow).TotalSeconds - 10));

            var parametros = new List<KeyValuePair<string, string>>
            {
                new KeyValuePair<string, string>("token", _chaveInfosimples),
                new KeyValuePair<string, string>("timeout", segundos.ToString(CultureInfo.InvariantCulture)),
                new KeyValuePair<string, string>("cnpj", cnpj)
            };

            if (partes.Length > 1)
            {
                foreach (var par in partes[1].Split(new[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    var kv = par.Split(new[] { '=' }, 2);
                    var chave = Uri.UnescapeDataString(kv[0].Trim());
                    if (chave.Length == 0 || chave == "cnpj" || chave == "token" || chave == "timeout") { continue; }
                    var valor = kv.Length > 1 ? Uri.UnescapeDataString(kv[1].Trim()) : string.Empty;
                    valor = valor
                        .Replace("{cnpj}", cnpj)
                        .Replace("{ie}", Regex.Replace(fornecedor.GetAttributeValue<string>("dgt_inscricaoestadual") ?? string.Empty, "[^0-9A-Za-z]", string.Empty))
                        .Replace("{im}", Regex.Replace(fornecedor.GetAttributeValue<string>("dgt_inscricaomunicipal") ?? string.Empty, "[^0-9A-Za-z]", string.Empty));
                    parametros.Add(new KeyValuePair<string, string>(chave, valor));
                }
            }

            JObject resposta;
            string erro;
            if (!ChamarInfosimples(tracing, caminho, parametros, prazo, out resposta, out erro))
            {
                RegistrarConsulta(sistema, fornecedor.Id, certidao.Tipo, "Erro", erro, Fonte, usuario);
                return new JObject { ["ok"] = false, ["mensagem"] = erro };
            }

            var codigo = (int?)resposta["code"] ?? 0;
            if (codigo != 200)
            {
                var mensagem = Mascarar(Texto(resposta["code_message"], "a fonte não devolveu a certidão"));
                if (Regex.IsMatch(mensagem, "token|autentic", RegexOptions.IgnoreCase))
                {
                    mensagem += " (verifique o token na Configuração segura do passo)";
                }
                else if (codigo == 605 || codigo == 615)
                {
                    // Site do órgão fora do ar ou lento: não é erro do cadastro.
                    mensagem += " O site do órgão está indisponível agora: tente de novo mais tarde (o lote diário tenta de novo sozinho).";
                }
                erro = Limitar($"Infosimples ({codigo}): {mensagem}", 1000);
                tracing.Trace("{0}: Infosimples respondeu código {1}.", certidao.Tipo, codigo);
                RegistrarConsulta(sistema, fornecedor.Id, certidao.Tipo, "Erro", erro, Fonte, usuario);
                return new JObject { ["ok"] = false, ["mensagem"] = erro };
            }

            var dado = (resposta["data"] as JArray)?.OfType<JObject>().FirstOrDefault() ?? new JObject();
            var comprovante = (resposta["site_receipts"] as JArray)?
                .Select(t => t.Type == JTokenType.String ? (string)t : string.Empty)
                .FirstOrDefault(u => u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) ?? string.Empty;
            if (comprovante.Length == 0)
            {
                // Algumas rotas (ex.: CEAT) trazem o comprovante dentro de data[0].
                var noDado = Texto(dado["site_receipt"], string.Empty);
                if (noDado.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) { comprovante = noDado; }
            }

            var analise = AnalisarCertidao(dado);
            var resultado = analise.Regular == true
                ? (analise.EfeitoNegativa ? "Regular (positiva com efeito de negativa)" : "Regular")
                : analise.Regular == false ? "Irregular" : "Verificar";

            var resumo = new StringBuilder();
            resumo.AppendLine($"{certidao.Nome}: {(analise.Situacao.Length > 0 ? analise.Situacao : resultado)}");
            if (analise.Emissao.HasValue) { resumo.AppendLine($"Emissão: {analise.Emissao.Value:dd/MM/yyyy}"); }
            resumo.AppendLine(analise.Validade.HasValue ? $"Validade: {analise.Validade.Value:dd/MM/yyyy}" : "Validade: não informada pela fonte");
            if (analise.Codigo.Length > 0) { resumo.AppendLine($"Código de controle: {analise.Codigo}"); }
            if (analise.Mensagem.Length > 0) { resumo.AppendLine(analise.Mensagem); }
            if (analise.Processos.Length > 0) { resumo.AppendLine(analise.Processos); }
            if (analise.Regular == null) { resumo.AppendLine("Não foi possível identificar se a certidão é negativa: abra o comprovante e confira."); }
            if (comprovante.Length > 0) { resumo.AppendLine($"Comprovante: {comprovante}"); }

            if (analise.Regular == true)
            {
                resumo.AppendLine(RegistrarDocumentoAutomatico(sistema, fornecedor.Id, certidao, analise.Emissao ?? HojeBrasilia(), analise.Validade, comprovante, analise.Codigo, usuario));
            }
            else if (analise.Regular == false)
            {
                RegistrarHistorico(sistema, fornecedor.Id, "Certidão irregular", $"{certidao.Nome}: a fonte indicou pendência. Veja a aba Consultas.", usuario);
            }

            RegistrarConsulta(sistema, fornecedor.Id, certidao.Tipo, resultado, resumo.ToString(), Fonte, usuario);

            return new JObject
            {
                ["ok"] = true,
                ["regular"] = analise.Regular.HasValue ? (JToken)analise.Regular.Value : JValue.CreateNull(),
                ["validade"] = analise.Validade.HasValue ? analise.Validade.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : string.Empty,
                ["mensagem"] = resultado
            };
        }

        private sealed class AnaliseCertidao
        {
            public bool? Regular;
            public bool EfeitoNegativa;
            public string Situacao = string.Empty;
            public DateTime? Emissao;
            public DateTime? Validade;
            public string Codigo = string.Empty;
            public string Mensagem = string.Empty;
            public string Processos = string.Empty;
        }

        // Os campos variam por fonte (PGFN, Caixa, TST, SEFAZ, prefeituras):
        // lê o que existir, na ordem do mais específico para o mais genérico.
        private static AnaliseCertidao AnalisarCertidao(JObject d)
        {
            var a = new AnaliseCertidao();

            var certidaoCurta = Texto(d["certidao"], string.Empty);
            if (certidaoCurta.Length > 80) { certidaoCurta = string.Empty; }   // texto integral da certidão
            a.Situacao = Mascarar(Juntar(" · ", Texto(d["tipo"], string.Empty), Texto(d["situacao"], string.Empty), certidaoCurta));
            var chave = SemAcento(a.Situacao).ToUpperInvariant();

            var conseguiu = d["conseguiu_emitir_certidao_negativa"];
            var consta = d["consta"];
            var nadaConsta = d["nada_consta"];   // CEAT (TRT): true = nenhuma ação trabalhista

            if (nadaConsta != null && nadaConsta.Type == JTokenType.Boolean)
            {
                a.Regular = (bool)nadaConsta;
                if (a.Situacao.Length == 0) { a.Situacao = a.Regular == true ? "Nada consta" : "Constam ações trabalhistas"; }
                a.Processos = ResumirProcessos(d["grupos_processos"] as JArray);
            }
            else if (chave.Contains("EFEITO"))
            {
                a.Regular = true;
                a.EfeitoNegativa = true;
            }
            else if (conseguiu != null && conseguiu.Type == JTokenType.Boolean)
            {
                a.Regular = (bool)conseguiu;
            }
            else if (chave.Contains("IRREGULAR")) { a.Regular = false; }
            else if (chave.Contains("REGULAR")) { a.Regular = true; }
            else if (chave.Contains("POSITIVA")) { a.Regular = false; }
            else if (chave.Contains("NEGATIVA")) { a.Regular = true; }
            else if (consta != null && consta.Type == JTokenType.Boolean) { a.Regular = !(bool)consta; }

            a.Validade = PrimeiraData(d, "validade_data", "validade_fim_data", "normalizado_validade", "validade", "data_validade");
            a.Emissao = PrimeiraData(d, "emissao_data", "validade_inicio_data", "normalizado_expedicao", "expedicao", "data_emissao", "datahora", "consulta_datahora");
            a.Codigo = Limitar(Mascarar(Juntar(" ", Texto(d["certidao_codigo"], string.Empty), Texto(d["crf"], string.Empty), Texto(d["codigo_controle"], string.Empty))), 120);
            a.Mensagem = Limitar(Mascarar(Juntar(" ", Texto(d["mensagem"], string.Empty), Texto(d["observacoes"], string.Empty))), 600);
            return a;
        }

        // CEAT: grupos_processos = [{ vara, processos: [...] }]. Só varas e
        // números de processo (dados públicos), limitado para caber no resumo.
        private static string ResumirProcessos(JArray grupos)
        {
            if (grupos == null || grupos.Count == 0) { return string.Empty; }
            var linhas = new List<string>();
            var total = 0;
            foreach (var g in grupos.OfType<JObject>())
            {
                var processos = (g["processos"] as JArray)?
                    .Select(p => p.Type == JTokenType.Object ? Texto(p["numero"], Texto(p["processo"], string.Empty)) : Texto(p, string.Empty))
                    .Where(p => p.Length > 0)
                    .ToList() ?? new List<string>();
                total += processos.Count;
                if (linhas.Count < 10)
                {
                    var lista = processos.Count > 0 ? string.Join(", ", processos.Take(5)) : "sem número";
                    var mais = processos.Count > 5 ? $" (+{processos.Count - 5})" : string.Empty;
                    linhas.Add($"- {Texto(g["vara"], "vara não informada")}: {lista}{mais}");
                }
            }
            return Limitar(Mascarar($"Processos: {total}\n{string.Join("\n", linhas)}"), 1500);
        }

        private static DateTime? PrimeiraData(JObject d, params string[] campos)
        {
            foreach (var campo in campos)
            {
                var data = LerData(Texto(d[campo], string.Empty));
                if (data.HasValue) { return data; }
            }
            return null;
        }

        private static DateTime? LerData(string valor)
        {
            var v = (valor ?? string.Empty).Trim();
            DateTime data;
            var br = Regex.Match(v, @"^(\d{2}/\d{2}/\d{4})");
            if (br.Success && DateTime.TryParseExact(br.Groups[1].Value, "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out data))
            {
                return DateTime.SpecifyKind(data.Date, DateTimeKind.Unspecified);
            }
            var iso = Regex.Match(v, @"^(\d{4}-\d{2}-\d{2})");
            if (iso.Success && DateTime.TryParseExact(iso.Groups[1].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out data))
            {
                return DateTime.SpecifyKind(data.Date, DateTimeKind.Unspecified);
            }
            return null;
        }

        private bool ChamarInfosimples(ITracingService tracing, string caminho, List<KeyValuePair<string, string>> parametros, DateTime prazo, out JObject resposta, out string erro)
        {
            resposta = null;
            erro = string.Empty;

            var restante = prazo - DateTime.UtcNow;
            if (restante.TotalSeconds < 5)
            {
                erro = "Não executada: o tempo desta chamada acabou. Consulte de novo.";
                return false;
            }

            // O token vai no CORPO (nunca na URL, que pode aparecer em logs).
            using (var cancelamento = new CancellationTokenSource(restante))
            using (var requisicao = new HttpRequestMessage(HttpMethod.Post, $"{_urlInfosimples}/{caminho}"))
            {
                requisicao.Content = new FormUrlEncodedContent(parametros);
                requisicao.Headers.TryAddWithoutValidation("Accept", "application/json");

                HttpResponseMessage http;
                string conteudo;
                try
                {
                    http = HttpLongo.SendAsync(requisicao, cancelamento.Token).GetAwaiter().GetResult();
                    conteudo = http.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                }
                catch (OperationCanceledException)
                {
                    erro = "A fonte demorou demais para responder. Tente de novo em instantes.";
                    return false;
                }
                catch (Exception ex)
                {
                    tracing.Trace("Infosimples: falha de rede: {0}", ex.GetType().Name);
                    erro = "Não foi possível falar com a Infosimples agora. Tente de novo em instantes.";
                    return false;
                }

                if (!http.IsSuccessStatusCode)
                {
                    var status = (int)http.StatusCode;
                    tracing.Trace("Infosimples respondeu HTTP {0}.", status);
                    erro = status == 401 || status == 403
                        ? "A Infosimples recusou o token configurado no plugin (verifique a Configuração segura)."
                        : status == 404
                            ? $"Rota \"{caminho}\" não encontrada na Infosimples (confira o catálogo contratado)."
                            : status == 429
                                ? "Limite de requisições da Infosimples atingido. Tente mais tarde."
                                : $"A Infosimples respondeu com erro ({status}).";
                    return false;
                }

                try
                {
                    resposta = JObject.Parse(conteudo);
                    return true;
                }
                catch (JsonException)
                {
                    erro = "Resposta da Infosimples em formato inesperado.";
                    return false;
                }
            }
        }

        private string RotaDaCertidao(Certidao certidao, string uf, string cidade)
        {
            if (certidao.Rota != null) { return certidao.Rota; }
            string rota;
            if (certidao.Codigo == "ceat")
            {
                // Cidade primeiro (UF com mais de um TRT), depois a UF.
                if (uf.Length > 0 && cidade.Length > 0 && _rotasTrt.TryGetValue(ChaveMunicipio(uf, cidade), out rota)) { return rota; }
                return uf.Length > 0 && _rotasTrt.TryGetValue(uf, out rota) ? rota : string.Empty;
            }
            if (certidao.Codigo == "cnd_estadual")
            {
                return uf.Length > 0 && _rotasEstaduais.TryGetValue(uf, out rota) ? rota : string.Empty;
            }
            return uf.Length > 0 && cidade.Length > 0 && _rotasMunicipais.TryGetValue(ChaveMunicipio(uf, cidade), out rota) ? rota : string.Empty;
        }

        private static string ChaveMunicipio(string uf, string cidade) =>
            Regex.Replace(SemAcento($"{uf}/{cidade}").ToUpperInvariant(), @"\s+", " ").Trim();

        private static void LerRotas(JObject origem, Dictionary<string, string> destino)
        {
            if (origem == null) { return; }
            foreach (var p in origem.Properties())
            {
                var rota = Texto(p.Value, string.Empty);
                if (rota.Length == 0) { continue; }
                var chave = p.Name.Contains("/")
                    ? ChaveMunicipio(p.Name.Split('/')[0].Trim(), p.Name.Substring(p.Name.IndexOf('/') + 1).Trim())
                    : p.Name.Trim().ToUpperInvariant();
                destino[chave] = rota;
            }
        }

        // Código da certidão → id do tipo de documento ligado a ela (dgt_codigoconsulta).
        private static Dictionary<string, Guid> TiposAutomaticos(IOrganizationService sistema)
        {
            var consulta = new QueryExpression(TabelaTipo) { ColumnSet = new ColumnSet("dgt_codigoconsulta") };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            consulta.Criteria.AddCondition("dgt_codigoconsulta", ConditionOperator.NotNull);
            var mapa = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
            foreach (var t in sistema.RetrieveMultiple(consulta).Entities)
            {
                var codigo = (t.GetAttributeValue<string>("dgt_codigoconsulta") ?? string.Empty).Trim();
                if (codigo.Length > 0 && !mapa.ContainsKey(codigo)) { mapa[codigo] = t.Id; }
            }
            return mapa;
        }

        // Tipo → maior validade entre as versões vigentes do fornecedor (null = sem validade).
        private static Dictionary<Guid, DateTime?> VencimentosVigentes(IOrganizationService sistema, Guid fornecedorId, IEnumerable<Guid> tipos)
        {
            var mapa = new Dictionary<Guid, DateTime?>();
            var lista = tipos.Distinct().Cast<object>().ToArray();
            if (lista.Length == 0) { return mapa; }

            var consulta = new QueryExpression(TabelaDocumento) { ColumnSet = new ColumnSet("dgt_tipodocumento", "dgt_datavencimento") };
            consulta.Criteria.AddCondition("dgt_fornecedor", ConditionOperator.Equal, fornecedorId);
            consulta.Criteria.AddCondition("dgt_situacao", ConditionOperator.Equal, "Vigente");
            consulta.Criteria.AddCondition("dgt_tipodocumento", ConditionOperator.In, lista);

            foreach (var d in sistema.RetrieveMultiple(consulta).Entities)
            {
                var tipo = d.GetAttributeValue<EntityReference>("dgt_tipodocumento");
                if (tipo == null) { continue; }
                var venc = d.GetAttributeValue<DateTime?>("dgt_datavencimento");
                DateTime? atual;
                if (!mapa.TryGetValue(tipo.Id, out atual) || (venc.HasValue && (!atual.HasValue || venc.Value > atual.Value)))
                {
                    mapa[tipo.Id] = venc;
                }
            }
            return mapa;
        }

        private static string RegistrarDocumentoAutomatico(IOrganizationService sistema, Guid fornecedorId, Certidao certidao, DateTime emissao, DateTime? validade, string comprovante, string codigo, string usuario)
        {
            var consultaTipo = new QueryExpression(TabelaTipo) { ColumnSet = new ColumnSet("dgt_name", "dgt_validadedias"), TopCount = 1 };
            consultaTipo.Criteria.AddCondition("dgt_codigoconsulta", ConditionOperator.Equal, certidao.Codigo);
            consultaTipo.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            var tipo = sistema.RetrieveMultiple(consultaTipo).Entities.FirstOrDefault();

            if (tipo == null)
            {
                return "Nenhum tipo de documento está ligado a esta certidão (Tipos de documento › Consulta automática): o documento não foi registrado.";
            }

            var nomeTipo = tipo.GetAttributeValue<string>("dgt_name") ?? certidao.Nome;
            if (!validade.HasValue)
            {
                var dias = tipo.GetAttributeValue<int?>("dgt_validadedias");
                if (dias.HasValue && dias.Value > 0) { validade = emissao.AddDays(dias.Value); }
            }

            var consultaDoc = new QueryExpression(TabelaDocumento) { ColumnSet = new ColumnSet("dgt_dataemissao", "dgt_datavencimento") };
            consultaDoc.Criteria.AddCondition("dgt_fornecedor", ConditionOperator.Equal, fornecedorId);
            consultaDoc.Criteria.AddCondition("dgt_tipodocumento", ConditionOperator.Equal, tipo.Id);
            consultaDoc.Criteria.AddCondition("dgt_situacao", ConditionOperator.Equal, "Vigente");
            var vigentes = sistema.RetrieveMultiple(consultaDoc).Entities;

            // A 2ª via devolve a mesma certidão: não duplica.
            if (vigentes.Any(v =>
                v.GetAttributeValue<DateTime?>("dgt_dataemissao")?.Date == emissao.Date &&
                v.GetAttributeValue<DateTime?>("dgt_datavencimento")?.Date == validade?.Date))
            {
                return $"Documento \"{nomeTipo}\" já estava registrado com estas datas.";
            }

            var documento = new Entity(TabelaDocumento);
            documento["dgt_name"] = Limitar(nomeTipo, 200);
            documento["dgt_fornecedor"] = new EntityReference(TabelaFornecedor, fornecedorId);
            documento["dgt_tipodocumento"] = new EntityReference(TabelaTipo, tipo.Id);
            documento["dgt_dataemissao"] = DateTime.SpecifyKind(emissao.Date, DateTimeKind.Unspecified);
            if (validade.HasValue) { documento["dgt_datavencimento"] = DateTime.SpecifyKind(validade.Value.Date, DateTimeKind.Unspecified); }
            documento["dgt_arquivourl"] = Limitar(comprovante, 2000);
            documento["dgt_observacoes"] = Limitar(
                "Emitida automaticamente pela Infosimples" + (codigo.Length > 0 ? $" (código {codigo})" : string.Empty) +
                ". O link é o comprovante guardado pela Infosimples.", 4000);
            documento["dgt_situacao"] = "Vigente";
            documento["dgt_responsavelnome"] = Limitar(usuario + " (automático)", 200);
            sistema.Create(documento);

            foreach (var anterior in vigentes)
            {
                sistema.Update(new Entity(TabelaDocumento, anterior.Id) { ["dgt_situacao"] = "Substituído" });
            }

            var datas = $"emissão {emissao:dd/MM/yyyy}" + (validade.HasValue ? $", validade {validade.Value:dd/MM/yyyy}" : ", sem validade informada");
            RegistrarHistorico(sistema, fornecedorId, vigentes.Count > 0 ? "Documento renovado" : "Documento registrado",
                $"{nomeTipo}: {datas} (emitida automaticamente pela Infosimples).", usuario);

            return $"Documento \"{nomeTipo}\" registrado ({datas}).";
        }

        // Resultado geral (última consulta de cada certidão) e a menor
        // validade entre as certidões automáticas vigentes.
        private static void ResumirCertidoes(IOrganizationService sistema, Guid fornecedorId, Entity atualizacao)
        {
            var consulta = new QueryExpression(TabelaConsulta) { ColumnSet = new ColumnSet("dgt_tipo", "dgt_resultado"), TopCount = 60 };
            consulta.Criteria.AddCondition("dgt_fornecedor", ConditionOperator.Equal, fornecedorId);
            consulta.Criteria.AddCondition("dgt_tipo", ConditionOperator.In, Certidoes.Select(c => (object)c.Tipo).ToArray());
            consulta.AddOrder("createdon", OrderType.Descending);

            var ultimas = new Dictionary<string, string>();
            foreach (var linha in sistema.RetrieveMultiple(consulta).Entities)
            {
                var tipo = linha.GetAttributeValue<string>("dgt_tipo") ?? string.Empty;
                var resultado = linha.GetAttributeValue<string>("dgt_resultado") ?? string.Empty;
                if (resultado == "Sem cobertura" || resultado == "Não configurada" || ultimas.ContainsKey(tipo)) { continue; }
                ultimas[tipo] = resultado;
            }

            atualizacao["dgt_resultadocertidoes"] =
                ultimas.Values.Any(r => r.StartsWith("Irregular", StringComparison.Ordinal)) ? "Com pendência"
                : ultimas.Values.Any(r => r.StartsWith("Erro", StringComparison.Ordinal) || r.StartsWith("Verificar", StringComparison.Ordinal)) ? "Verificar"
                : ultimas.Count > 0 ? "Regular"
                : "Não consultado";

            var tipos = TiposAutomaticos(sistema).Values;
            var vencimentos = VencimentosVigentes(sistema, fornecedorId, tipos).Values.Where(v => v.HasValue).Select(v => v.Value).ToList();
            atualizacao["dgt_vencimentocertidoes"] = vencimentos.Count > 0 ? (object)DateTime.SpecifyKind(vencimentos.Min().Date, DateTimeKind.Unspecified) : null;
        }

        // ------------------------------------------------------------
        // Ficha de Cadastro (Microsoft Forms → Power Automate)
        // ------------------------------------------------------------

        private JObject ReceberFicha(IOrganizationService sistema, ITracingService tracing, JObject ficha, string usuario)
        {
            if (ficha == null)
            {
                throw new InvalidPluginExecutionException("Informe \"ficha\" com as respostas do formulário.");
            }

            var cnpj = NormalizarCnpj(Campo(ficha, "cnpj", 30));
            if (!CnpjValido(cnpj))
            {
                throw new InvalidPluginExecutionException("CNPJ inválido na ficha.");
            }

            var busca = new QueryExpression(TabelaFornecedor)
            {
                ColumnSet = new ColumnSet("dgt_name", "dgt_dadosbancarios", "dgt_status"),
                TopCount = 1
            };
            busca.Criteria.AddCondition("dgt_cnpj", ConditionOperator.Equal, cnpj);
            var existente = sistema.RetrieveMultiple(busca).Entities.FirstOrDefault();
            var novo = existente == null;

            var registro = novo ? new Entity(TabelaFornecedor) : new Entity(TabelaFornecedor, existente.Id);
            var tipoSolicitacao = Campo(ficha, "tipoSolicitacao", 60);
            if (tipoSolicitacao.Length == 0) { tipoSolicitacao = novo ? "Cadastro inicial" : "Atualização periódica"; }

            registro["dgt_tiposolicitacao"] = tipoSolicitacao;
            registro["dgt_ficharecebidaem"] = DateTime.UtcNow;

            // Item 1 — só sobrescreve com o que veio preenchido.
            Preencher(registro, "dgt_nomefantasia", Campo(ficha, "nomeFantasia", 200));
            Preencher(registro, "dgt_inscricaoestadual", Campo(ficha, "inscricaoEstadual", 30));
            Preencher(registro, "dgt_inscricaomunicipal", Campo(ficha, "inscricaoMunicipal", 30));
            Preencher(registro, "dgt_endereco", Campo(ficha, "endereco", 400));
            Preencher(registro, "dgt_cidade", Campo(ficha, "cidade", 120));
            Preencher(registro, "dgt_uf", Campo(ficha, "uf", 2).ToUpperInvariant());
            Preencher(registro, "dgt_cep", Campo(ficha, "cep", 9));
            Preencher(registro, "dgt_telefone", Campo(ficha, "telefone", 40));
            Preencher(registro, "dgt_site", Campo(ficha, "site", 200));
            Preencher(registro, "dgt_emailpedidos", Campo(ficha, "emailPedidos", 200));
            Preencher(registro, "dgt_portedeclarado", Campo(ficha, "porte", 30));

            var categorias = Lista(ficha["categoriaFornecimento"]);
            var outros = Campo(ficha, "categoriaOutros", 200);
            if (outros.Length > 0) { categorias.Add("Outros: " + outros); }
            Preencher(registro, "dgt_categoriafornecimento", Limitar(string.Join("; ", categorias), 300));
            Preencher(registro, "dgt_descricaofornecimento", Campo(ficha, "descricaoFornecimento", 4000));

            // Item 2 — contatos ("Nome — cargo | e-mail | telefone").
            var contatos = ficha["contatos"] as JObject ?? new JObject();
            Preencher(registro, "dgt_contatocomercial", ContatoFicha(contatos["comercial"] as JObject));
            Preencher(registro, "dgt_contatofiscal", ContatoFicha(contatos["fiscal"] as JObject));
            Preencher(registro, "dgt_contatofinanceiro", ContatoFicha(contatos["financeiro"] as JObject));
            Preencher(registro, "dgt_contatointegridade", ContatoFicha(contatos["integridade"] as JObject));

            // Item 3 — quadro societário (coluna protegida).
            var socios = new JArray();
            foreach (var s in (ficha["socios"] as JArray ?? new JArray()).OfType<JObject>().Take(30))
            {
                var nome = Campo(s, "nome", 200);
                if (nome.Length == 0) { continue; }
                socios.Add(new JObject
                {
                    ["nome"] = nome,
                    ["cargo"] = Campo(s, "cargo", 120),
                    ["cpf"] = Regex.Replace(Campo(s, "cpf", 20), "[^0-9]", string.Empty),
                    ["participacao"] = Campo(s, "participacao", 20)
                });
            }
            var quadro = new JObject
            {
                ["socios"] = socios,
                ["participaOutras"] = SimNao(Campo(ficha, "participaOutrasSociedades", 20)),
                ["outrasSociedades"] = Campo(ficha, "outrasSociedades", 1500),
                ["grupoEconomico"] = SimNao(Campo(ficha, "grupoEconomico", 20)),
                ["grupoEconomicoDetalhe"] = Campo(ficha, "grupoEconomicoDetalhe", 1500)
            };
            registro["dgt_quadrosocietario"] = Limitar(quadro.ToString(Formatting.None), 8000);

            // Item 4 — enquadramento tributário.
            Preencher(registro, "dgt_regimetributario", Campo(ficha, "regimeTributario", 60));
            Preencher(registro, "dgt_faixafaturamento", Campo(ficha, "faixaFaturamento", 100));
            Preencher(registro, "dgt_anexosimples", Campo(ficha, "anexoSimples", 200));
            Preencher(registro, "dgt_previsaomudancaregime", Campo(ficha, "previsaoMudancaRegime", 50));

            // Item 5 — dados bancários (coluna protegida). Alteração exige
            // confirmação por telefone: volta para "não conferido".
            var banco = ficha["banco"] as JObject ?? new JObject();
            var bancario = new JObject
            {
                ["banco"] = Campo(banco, "banco", 120),
                ["agencia"] = Campo(banco, "agencia", 20),
                ["conta"] = Campo(banco, "conta", 30),
                ["tipoChavePix"] = Campo(banco, "tipoChavePix", 30),
                ["chavePix"] = Campo(banco, "chavePix", 120),
                ["titular"] = Campo(banco, "titular", 200),
                ["cnpjTitular"] = NormalizarCnpj(Campo(banco, "cnpjTitular", 30))
            };
            var bancarioJson = bancario.Properties().Any(p => ((string)p.Value).Length > 0) ? bancario.ToString(Formatting.None) : string.Empty;
            var bancoAnterior = novo ? string.Empty : (existente.GetAttributeValue<string>("dgt_dadosbancarios") ?? string.Empty);
            var bancoAlterado = bancarioJson.Length > 0 && !string.Equals(bancarioJson, bancoAnterior, StringComparison.Ordinal);
            if (bancoAlterado)
            {
                registro["dgt_dadosbancarios"] = bancarioJson;
                registro["dgt_bancarioconferido"] = false;
            }

            // Item 6 — questionário de integridade.
            var respostas = new JObject();
            var questionario = ficha["questionario"] as JObject ?? new JObject();
            foreach (var p in questionario.Properties())
            {
                respostas[Limitar(p.Name, 10)] = RespostaQuestionario(Texto(p.Value, string.Empty));
            }
            registro["dgt_questionario"] = Limitar(respostas.ToString(Formatting.None), 2000);
            Preencher(registro, "dgt_certificacoes", Campo(ficha, "certificacoes", 2000));
            Preencher(registro, "dgt_detalhamentopositivas", Campo(ficha, "detalhamentoPositivas", 4000));

            // Item 8 — declarações (a assinatura formal vem pelo Clicksign).
            var declaracoes = new JObject
            {
                ["aceitas"] = Aceite(ficha["declaracoesAceitas"]),
                ["representante"] = Campo(ficha, "representanteNome", 200),
                ["cargo"] = Campo(ficha, "representanteCargo", 120),
                ["local"] = Campo(ficha, "local", 120),
                ["data"] = DateTime.UtcNow.AddHours(-3).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            };
            registro["dgt_declaracoes"] = declaracoes.ToString(Formatting.None);

            Guid id;
            if (novo)
            {
                var razao = Campo(ficha, "razaoSocial", 200);
                var categoriaFicha = string.Join(" ", categorias);
                registro["dgt_name"] = razao.Length > 0 ? razao : "(razão social pendente)";
                registro["dgt_cnpj"] = cnpj;
                registro["dgt_status"] = "Em homologação";
                registro["dgt_resultadohomologacao"] = "Pendente";
                registro["dgt_origem"] = "Formulário";
                registro["dgt_categoria"] = CategoriaInterna(categoriaFicha);
                registro["dgt_resultadosancoes"] = "Não consultado";
                registro["dgt_resultadocertidoes"] = "Não consultado";
                registro["dgt_responsavelnome"] = "Formulário do fornecedor";
                registro["dgt_ativo"] = true;
                if (!registro.Contains("dgt_bancarioconferido")) { registro["dgt_bancarioconferido"] = false; }
                id = sistema.Create(registro);

                RegistrarHistorico(sistema, id, "Ficha recebida",
                    $"Cadastro criado pela Ficha de Cadastro (formulário) — {tipoSolicitacao}.", usuario);
            }
            else
            {
                id = existente.Id;
                sistema.Update(registro);
                RegistrarHistorico(sistema, id, "Ficha recebida",
                    $"{tipoSolicitacao}: dados da ficha atualizados pelo formulário." +
                    (bancoAlterado ? "\nDados bancários alterados: confirmar por contato telefônico independente antes de pagar (SUP-CPL-01, item 5)." : string.Empty),
                    usuario);
            }

            // Receita: completa razão social, CNAE, natureza, porte e endereço vazios.
            if (_chaveCnpja.Length > 0)
            {
                try
                {
                    var fornecedor = sistema.Retrieve(TabelaFornecedor, id,
                        new ColumnSet("dgt_cnpj", "dgt_name", "dgt_nomefantasia", "dgt_uf", "dgt_cidade", "dgt_endereco"));
                    var atualizacao = new Entity(TabelaFornecedor, id);
                    ExecutarCnpj(sistema, tracing, fornecedor, cnpj, atualizacao, usuario);
                    if (atualizacao.Attributes.Count > 0) { sistema.Update(atualizacao); }
                }
                catch (Exception ex)
                {
                    tracing.Trace("Ficha: consulta à Receita não concluída: {0}", ex.Message);
                }
            }

            var gravado = sistema.Retrieve(TabelaFornecedor, id, new ColumnSet("dgt_protocolo", "dgt_name", "dgt_categoria"));
            var categoria = gravado.GetAttributeValue<string>("dgt_categoria") ?? string.Empty;

            AbrirCicloSeNecessario(sistema, tracing, id, tipoSolicitacao, gravado.GetAttributeValue<string>("dgt_protocolo") ?? string.Empty, usuario, _areaSuprimentos,
                gravado.GetAttributeValue<string>("dgt_name") ?? string.Empty, _linkPortal);

            return new JObject
            {
                ["id"] = id.ToString(),
                ["protocolo"] = gravado.GetAttributeValue<string>("dgt_protocolo") ?? string.Empty,
                ["novo"] = novo,
                ["razaoSocial"] = gravado.GetAttributeValue<string>("dgt_name") ?? string.Empty,
                ["pasta"] = DocumentosRecebidosFornecedor.NomePasta(gravado.GetAttributeValue<string>("dgt_name"), id),
                ["dadosBancariosAlterados"] = !novo && bancoAlterado,
                ["documentosPendentes"] = new JArray(DocumentosParaEnviar(sistema, categoria).Cast<object>().ToArray())
            };
        }

        // ------------------------------------------------------------
        // Documentos recebidos por e-mail (Fluxo 2)
        // ------------------------------------------------------------

        // Fornecedor do protocolo (o atual do cadastro ou o de um ciclo antigo).
        private static JObject LocalizarProtocolo(IOrganizationService sistema, string texto)
        {
            var protocolo = DocumentosRecebidosFornecedor.ExtrairProtocolo(texto);
            var resposta = new JObject { ["encontrado"] = false, ["protocolo"] = protocolo };
            if (protocolo.Length == 0)
            {
                resposta["motivo"] = "Nenhum protocolo FORN-AAAA-NNNN no texto.";
                return resposta;
            }

            Entity fornecedor = null;
            var consulta = new QueryExpression(TabelaFornecedor) { ColumnSet = new ColumnSet("dgt_name"), TopCount = 1 };
            consulta.Criteria.AddCondition("dgt_protocolo", ConditionOperator.Equal, protocolo);
            fornecedor = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();

            if (fornecedor == null)
            {
                try
                {
                    var porCiclo = new QueryExpression(TabelaCiclo) { ColumnSet = new ColumnSet("dgt_fornecedor"), TopCount = 1 };
                    porCiclo.Criteria.AddCondition("dgt_protocolo", ConditionOperator.Equal, protocolo);
                    var ciclo = sistema.RetrieveMultiple(porCiclo).Entities.FirstOrDefault();
                    var referencia = ciclo?.GetAttributeValue<EntityReference>("dgt_fornecedor");
                    if (referencia != null)
                    {
                        fornecedor = sistema.Retrieve(TabelaFornecedor, referencia.Id, new ColumnSet("dgt_name"));
                    }
                }
                catch (Exception)
                {
                    // Tabela de ciclos ainda não criada: fica só o cadastro.
                }
            }

            if (fornecedor == null)
            {
                resposta["motivo"] = "Protocolo não encontrado.";
                return resposta;
            }

            var razao = fornecedor.GetAttributeValue<string>("dgt_name") ?? string.Empty;
            resposta["encontrado"] = true;
            resposta["fornecedorId"] = fornecedor.Id.ToString();
            resposta["razaoSocial"] = razao;
            resposta["pasta"] = DocumentosRecebidosFornecedor.NomePasta(razao, fornecedor.Id);
            return resposta;
        }

        // Cada arquivo salvo pelo fluxo vira um documento "A conferir".
        private static JObject ReceberDocumentos(IOrganizationService sistema, JObject payload, string usuario)
        {
            var resposta = LocalizarProtocolo(sistema, Texto(payload["protocolo"], Texto(payload["assunto"], string.Empty)));
            if ((bool?)resposta["encontrado"] != true)
            {
                resposta["registrados"] = 0;
                return resposta;
            }

            var fornecedorId = Guid.Parse((string)resposta["fornecedorId"]);
            var protocolo = (string)resposta["protocolo"];

            var recebidos = (payload["arquivos"] as JArray ?? new JArray()).OfType<JObject>()
                .Select(a => new DocumentosRecebidosFornecedor.Arquivo { Nome = Texto(a["nome"], string.Empty), Url = Texto(a["url"], string.Empty) })
                .ToList();

            var consulta = new QueryExpression(TabelaDocumento) { ColumnSet = new ColumnSet("dgt_arquivourl") };
            consulta.Criteria.AddCondition("dgt_fornecedor", ConditionOperator.Equal, fornecedorId);
            var jaRegistradas = sistema.RetrieveMultiple(consulta).Entities
                .Select(d => d.GetAttributeValue<string>("dgt_arquivourl") ?? string.Empty)
                .Where(u => u.Length > 0)
                .ToList();

            var novos = DocumentosRecebidosFornecedor.FiltrarNovos(recebidos, jaRegistradas);
            var agora = DateTime.UtcNow.AddHours(-3);

            foreach (var arquivo in novos)
            {
                var nome = Mascarar(arquivo.Nome);
                var documento = new Entity(TabelaDocumento);
                documento["dgt_name"] = Limitar(nome, 200);
                documento["dgt_fornecedor"] = new EntityReference(TabelaFornecedor, fornecedorId);
                documento["dgt_arquivourl"] = Limitar(arquivo.Url, 2000);
                documento["dgt_arquivonome"] = Limitar(nome, 255);
                documento["dgt_observacoes"] = Limitar($"Recebido por e-mail (protocolo {protocolo}) em {agora:dd/MM/yyyy HH:mm}.", 4000);
                documento["dgt_situacao"] = DocumentosRecebidosFornecedor.SituacaoAConferir;
                documento["dgt_responsavelnome"] = Limitar($"E-mail ({protocolo})", 200);
                sistema.Create(documento);
            }

            if (novos.Count > 0)
            {
                RegistrarHistorico(sistema, fornecedorId, "Documentos recebidos por e-mail",
                    $"{novos.Count} arquivo(s) a conferir (protocolo {protocolo}): " +
                    string.Join("; ", novos.Select(n => Mascarar(n.Nome))), usuario);
            }

            resposta["registrados"] = novos.Count;
            resposta["ignorados"] = recebidos.Count - novos.Count;
            return resposta;
        }

        // Homologação: a ficha que chega abre um ciclo novo na coluna
        // "Ficha recebida" se o fornecedor não tem ciclo em aberto. A etapa
        // segue o motor de fluxos (SUP-HOM) no portal; aqui o ciclo nasce
        // SEM instância, mas já com a etapa e a área Suprimentos
        // (PrepararCicloParaFluxo) para o aviso da 1ª etapa sair. Sem a
        // tabela (script ainda não rodado), só registra no rastreamento.
        private static void AbrirCicloSeNecessario(IOrganizationService sistema, ITracingService tracing, Guid fornecedorId, string motivo, string protocolo, string usuario, string siglaSuprimentos,
            string razaoSocial, string linkPortal)
        {
            try
            {
                var consulta = new QueryExpression(TabelaCiclo) { ColumnSet = new ColumnSet("dgt_concluidoem", "dgt_numero") };
                consulta.Criteria.AddCondition("dgt_fornecedor", ConditionOperator.Equal, fornecedorId);
                var ciclos = sistema.RetrieveMultiple(consulta).Entities;
                if (ciclos.Any(c => !c.GetAttributeValue<DateTime?>("dgt_concluidoem").HasValue)) { return; }

                var numero = ciclos.Count == 0 ? 1 : ciclos.Max(c => c.GetAttributeValue<int?>("dgt_numero") ?? 0) + 1;
                var ciclo = new Entity(TabelaCiclo);
                ciclo["dgt_name"] = Limitar($"Ciclo {numero} — {motivo}", 200);
                ciclo["dgt_fornecedor"] = new EntityReference(TabelaFornecedor, fornecedorId);
                ciclo["dgt_numero"] = numero;
                ciclo["dgt_motivo"] = Limitar(motivo, 60);
                ciclo["dgt_etapa"] = "Ficha recebida";
                ciclo["dgt_etapadesde"] = DateTime.UtcNow;
                ciclo["dgt_protocolo"] = Limitar(protocolo, 30);
                ciclo["dgt_resultadohomologacao"] = "Pendente";
                ciclo["dgt_responsavelnome"] = Limitar(usuario, 200);
                var cicloId = sistema.Create(ciclo);
                var areaId = PrepararCicloParaFluxo(sistema, tracing, cicloId, siglaSuprimentos);
                if (areaId.HasValue)
                {
                    AvisarFichaRecebida(sistema, tracing, cicloId, areaId.Value, razaoSocial, protocolo, motivo, linkPortal);
                }

                RegistrarHistorico(sistema, fornecedorId, "Homologação: ciclo aberto",
                    $"Ciclo {numero} ({motivo}) aberto na coluna \"Ficha recebida\" pela ficha {protocolo}.", usuario);
            }
            catch (Exception ex)
            {
                tracing.Trace("Ficha: ciclo de homologação não aberto: {0}", ex.Message);
            }
        }

        // Colunas do motor (dgt_etapaatual, dgt_responsaveisetapa). Em
        // separado: sem elas (script não rodado) ou sem a área cadastrada,
        // o ciclo continua aberto e o portal resolve ao abrir.
        // Devolve a área Supply encontrada (para o aviso por e-mail).
        private static Guid? PrepararCicloParaFluxo(IOrganizationService sistema, ITracingService tracing, Guid cicloId, string siglaSuprimentos)
        {
            Guid? areaId = null;
            try
            {
                var sigla = string.IsNullOrWhiteSpace(siglaSuprimentos) ? HomologacaoFornecedor.SiglaSuprimentosPadrao : siglaSuprimentos.Trim();
                var consulta = new QueryExpression("dgt_area") { ColumnSet = new ColumnSet("dgt_name", "dgt_sigla"), TopCount = 1 };
                consulta.Criteria.AddCondition("dgt_sigla", ConditionOperator.Equal, sigla);
                var area = sistema.RetrieveMultiple(consulta).Entities.FirstOrDefault();

                // Sem as colunas do fluxo (script não rodado): não tenta gravar.
                // Chamada que falha dentro do plugin desfaz a transação inteira.
                if (!ColunaExiste(sistema, TabelaCiclo, "dgt_etapaatual") || !ColunaExiste(sistema, TabelaCiclo, "dgt_responsaveisetapa"))
                {
                    tracing.Trace("Ficha: colunas do fluxo ainda não existem no ciclo.");
                    return null;
                }

                var atualizacao = new Entity(TabelaCiclo, cicloId);
                atualizacao["dgt_etapaatual"] = HomologacaoFornecedor.EtapaInicial;
                if (area != null)
                {
                    areaId = area.Id;
                    atualizacao["dgt_responsaveisetapa"] = HomologacaoFornecedor.ResponsaveisDaArea(area.Id, sigla, area.GetAttributeValue<string>("dgt_name"));
                }
                else
                {
                    tracing.Trace("Ficha: área de sigla {0} não encontrada; o ciclo fica sem responsáveis até ser aberto no portal.", sigla);
                }
                sistema.Update(atualizacao);
            }
            catch (Exception ex)
            {
                tracing.Trace("Ficha: ciclo aberto sem as colunas do fluxo: {0}", ex.Message);
            }
            return areaId;
        }

        // A coluna existe? Consulta de metadados que NÃO falha quando a
        // tabela ou a coluna não existem (devolve vazio).
        private static bool ColunaExiste(IOrganizationService sistema, string tabela, string coluna)
        {
            var consulta = new EntityQueryExpression
            {
                Criteria = new MetadataFilterExpression(LogicalOperator.And),
                Properties = new MetadataPropertiesExpression("LogicalName", "Attributes"),
                AttributeQuery = new AttributeQueryExpression
                {
                    Criteria = new MetadataFilterExpression(LogicalOperator.And),
                    Properties = new MetadataPropertiesExpression("LogicalName")
                }
            };
            consulta.Criteria.Conditions.Add(new MetadataConditionExpression("LogicalName", MetadataConditionOperator.Equals, tabela));
            consulta.AttributeQuery.Criteria.Conditions.Add(new MetadataConditionExpression("LogicalName", MetadataConditionOperator.Equals, coluna));
            var resposta = (RetrieveMetadataChangesResponse)sistema.Execute(new RetrieveMetadataChangesRequest { Query = consulta });
            return resposta.EntityMetadata.Any(e => e.Attributes != null && e.Attributes.Any(a => a.LogicalName == coluna));
        }

        // Aviso "Ficha recebida" a cada membro ativo da área Supply, pela
        // fila padrão de e-mails do portal (dgt_implemail). Quem envia é o
        // fluxo central do Power Automate. Falha aqui não impede a ficha.
        private static void AvisarFichaRecebida(IOrganizationService sistema, ITracingService tracing, Guid cicloId, Guid areaId,
            string razaoSocial, string protocolo, string motivo, string linkPortal)
        {
            try
            {
                if (!ColunaExiste(sistema, "dgt_implemail", "dgt_status"))
                {
                    tracing.Trace("Ficha: fila de e-mails (dgt_implemail) não existe; aviso não enviado.");
                    return;
                }
                var comRemetente = ColunaExiste(sistema, "dgt_implemail", "dgt_remetente");

                var vinculos = new QueryExpression("dgt_usuarioarea") { ColumnSet = new ColumnSet("dgt_usuario", "dgt_ativo") };
                vinculos.Criteria.AddCondition("dgt_area", ConditionOperator.Equal, areaId);
                var usuarios = sistema.RetrieveMultiple(vinculos).Entities
                    .Where(v => v.GetAttributeValue<bool?>("dgt_ativo") != false)
                    .Select(v => v.GetAttributeValue<EntityReference>("dgt_usuario"))
                    .Where(u => u != null)
                    .Select(u => u.Id)
                    .Distinct()
                    .ToList();

                var emails = new List<string>();
                foreach (var usuarioId in usuarios)
                {
                    var u = sistema.Retrieve("dgt_usuario", usuarioId, new ColumnSet("dgt_email", "dgt_ativo"));
                    var email = (u.GetAttributeValue<string>("dgt_email") ?? string.Empty).Trim();
                    if (u.GetAttributeValue<bool?>("dgt_ativo") != false && email.Contains("@") && !emails.Contains(email, StringComparer.OrdinalIgnoreCase))
                    {
                        emails.Add(email);
                    }
                }

                var assunto = HomologacaoFornecedor.AssuntoFichaRecebida(razaoSocial, protocolo);
                var corpo = HomologacaoFornecedor.CorpoFichaRecebida(razaoSocial, protocolo, motivo, linkPortal);

                foreach (var email in emails)
                {
                    var linha = new Entity("dgt_implemail");
                    linha["dgt_name"] = assunto;
                    linha["dgt_para"] = Limitar(email, 320);
                    linha["dgt_corpo"] = corpo;
                    linha["dgt_tipo"] = HomologacaoFornecedor.TipoEmailFichaRecebida;
                    linha["dgt_motivo"] = HomologacaoFornecedor.MotivoFichaRecebida(cicloId, email);
                    linha["dgt_status"] = "Pendente";
                    if (comRemetente)
                    {
                        linha["dgt_remetente"] = HomologacaoFornecedor.RemetenteFornecedores;
                    }
                    sistema.Create(linha);
                }

                if (emails.Count == 0)
                {
                    tracing.Trace("Ficha: nenhum membro ativo com e-mail na área Supply; aviso não enviado.");
                }
            }
            catch (Exception ex)
            {
                tracing.Trace("Ficha: aviso por e-mail não gravado na fila: {0}", ex.Message);
            }
        }

        // Obrigatórios da categoria que o fornecedor precisa ENVIAR
        // (os ligados a uma consulta automática a DGT emite sozinha).
        private static List<string> DocumentosParaEnviar(IOrganizationService sistema, string categoria)
        {
            var consulta = new QueryExpression(TabelaTipo) { ColumnSet = new ColumnSet("dgt_name", "dgt_categorias", "dgt_codigoconsulta", "dgt_ordem") };
            consulta.Criteria.AddCondition("dgt_ativo", ConditionOperator.Equal, true);
            consulta.Criteria.AddCondition("dgt_obrigatorio", ConditionOperator.Equal, true);
            // Tipos de COLABORADOR (dgt_aplicaa) não são documentos da empresa:
            // ficam fora da lista do e-mail ao fornecedor.
            if (ColunaExiste(sistema, TabelaTipo, "dgt_aplicaa"))
            {
                var empresa = new FilterExpression(LogicalOperator.Or);
                empresa.AddCondition("dgt_aplicaa", ConditionOperator.Null);
                empresa.AddCondition("dgt_aplicaa", ConditionOperator.NotEqual, "Colaborador");
                consulta.Criteria.AddFilter(empresa);
            }
            consulta.AddOrder("dgt_ordem", OrderType.Ascending);

            return sistema.RetrieveMultiple(consulta).Entities
                .Where(t => string.IsNullOrWhiteSpace(t.GetAttributeValue<string>("dgt_codigoconsulta")))
                .Where(t =>
                {
                    var cats = (t.GetAttributeValue<string>("dgt_categorias") ?? string.Empty)
                        .Split(';').Select(c => c.Trim()).Where(c => c.Length > 0).ToList();
                    return cats.Count == 0 || cats.Contains(categoria);
                })
                .Select(t => t.GetAttributeValue<string>("dgt_name") ?? string.Empty)
                .Where(n => n.Length > 0)
                .ToList();
        }

        private static string CategoriaInterna(string declarada)
        {
            var c = SemAcento(declarada ?? string.Empty).ToUpperInvariant();
            if (c.Contains("TERCEIRIZAD") || c.Contains("CESSAO DE MAO")) { return "Terceirizado em campo"; }
            if (c.Contains("TRANSPORTE")) { return "Transporte"; }
            if (c.Contains("MATERIA") || c.Contains("PRODUTO")) { return "Material"; }
            return "Serviço";
        }

        private static string Campo(JObject origem, string nome, int tamanho) =>
            origem == null ? string.Empty : Limitar(Texto(origem[nome], string.Empty), tamanho);

        private static void Preencher(Entity registro, string coluna, string valor)
        {
            if (!string.IsNullOrWhiteSpace(valor)) { registro[coluna] = valor; }
        }

        // Aceita lista JSON ou texto do Forms (["a","b"] ou "a;b").
        private static List<string> Lista(JToken token)
        {
            if (token is JArray arr)
            {
                return arr.Select(t => Texto(t, string.Empty)).Where(t => t.Length > 0).ToList();
            }
            var texto = Texto(token, string.Empty);
            if (texto.StartsWith("[", StringComparison.Ordinal))
            {
                try { return Lista(JArray.Parse(texto)); }
                catch (JsonException) { /* segue como texto */ }
            }
            return texto.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries).Select(t => t.Trim()).Where(t => t.Length > 0).ToList();
        }

        private static string ContatoFicha(JObject c)
        {
            if (c == null) { return string.Empty; }
            var nome = Juntar(" — ", Campo(c, "nome", 150), Campo(c, "cargo", 100));
            var partes = new[] { nome, Campo(c, "email", 150), Campo(c, "telefone", 40) }.Select(v => v.Replace("|", "/")).ToArray();
            return partes.Any(p => p.Length > 0) ? Limitar(string.Join(" | ", partes), 500) : string.Empty;
        }

        private static string SimNao(string valor)
        {
            var v = SemAcento(valor).Trim().ToUpperInvariant();
            return v.StartsWith("S", StringComparison.Ordinal) ? "Sim" : v.StartsWith("N", StringComparison.Ordinal) ? "Não" : string.Empty;
        }

        private static string RespostaQuestionario(string valor)
        {
            var v = SemAcento(valor).Trim().ToUpperInvariant();
            if (v == "SIM" || v == "S") { return "Sim"; }
            if (v == "NAO" || v == "N") { return "Não"; }
            return v.Length == 0 ? string.Empty : "Não se aplica / Não sei";
        }

        private static bool Aceite(JToken token)
        {
            if (token == null) { return false; }
            if (token.Type == JTokenType.Boolean) { return (bool)token; }
            var v = SemAcento(Texto(token, string.Empty)).ToUpperInvariant();
            return v.StartsWith("SIM", StringComparison.Ordinal) || v.StartsWith("DECLARO", StringComparison.Ordinal) || v.StartsWith("ACEIT", StringComparison.Ordinal) || v == "TRUE";
        }

        private static void RegistrarHistorico(IOrganizationService sistema, Guid fornecedorId, string acao, string descricao, string usuario)
        {
            var linha = new Entity(TabelaHistorico);
            linha["dgt_name"] = Limitar(acao, 200);
            linha["dgt_fornecedor"] = new EntityReference(TabelaFornecedor, fornecedorId);
            linha["dgt_descricao"] = Limitar(descricao, 4000);
            linha["dgt_usuarionome"] = Limitar(usuario, 200);
            sistema.Create(linha);
        }

        private static bool EhCertidao(string codigo) => Certidoes.Any(c => c.Codigo == codigo);

        private static DateTime HojeBrasilia() =>
            DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-3).Date, DateTimeKind.Unspecified);

        private static string SemAcento(string texto)
        {
            var decomposto = (texto ?? string.Empty).Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposto.Length);
            foreach (var ch in decomposto)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) { sb.Append(ch); }
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
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
            if (lista == null)
            {
                return new[] { "cnpj", "sancoes" };
            }

            var pedidas = new List<string>();
            foreach (var item in lista.Select(c => ((string)c ?? string.Empty).Trim().ToLowerInvariant()))
            {
                if (item == "certidoes") { pedidas.AddRange(Certidoes.Select(c => c.Codigo)); }
                else if (item == "cnpj" || item == "sancoes" || EhCertidao(item)) { pedidas.Add(item); }
            }

            var consultas = pedidas.Distinct().ToArray();
            if (consultas.Length == 0)
            {
                throw new InvalidPluginExecutionException(
                    "Informe consultas: \"cnpj\", \"sancoes\", \"certidoes\" ou " +
                    string.Join(", ", Certidoes.Select(c => $"\"{c.Codigo}\"")) + ".");
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
