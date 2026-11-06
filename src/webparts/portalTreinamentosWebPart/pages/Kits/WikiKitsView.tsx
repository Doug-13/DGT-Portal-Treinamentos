import * as React from 'react';

import {
  TipoItemKit
} from '../../services/bom/esquemaKits';

import {
  COR,
  painel
} from './kitsComum';

// ============================================================
// KITS — WIKI
//
// Como as soluções são usadas e o que as compõe, em linguagem de
// quem vende e projeta. NÃO cita modelos, códigos nem quantidades de
// kit: isso muda e mora nas outras abas (os links levam até lá).
// Fonte: "Catálogo Técnico Bridgefy (rascunho)" do ClickUp (pré-
// vendas), reescrito sem dados de kit, e a especificação de
// servidores (nov/2026).
// ============================================================

export type DestinoWiki =
  | { aba: 'itens'; tipo?: TipoItemKit }
  | { aba: 'kits'; kit?: string }
  | { aba: 'logica' }
  | { aba: 'servidores' };

export interface IWikiKitsViewProps {
  abrir: (destino: DestinoWiki) => void;
}

type PaginaWiki = 'inicio' | 'solucoes' | 'estruturas' | 'acesso' | 'gravacao' | 'criterios';

const PAGINAS: Array<{ id: PaginaWiki; titulo: string; resumo: string }> = [
  { id: 'inicio', titulo: 'Como usar esta wiki', resumo: 'O que está aqui e as regras que mais geram erro' },
  { id: 'solucoes', titulo: 'Soluções Bridgefy', resumo: 'O que cada solução faz e o que exige' },
  { id: 'estruturas', titulo: 'Estruturas', resumo: 'Torre, Wallfix e Box' },
  { id: 'acesso', titulo: 'Controle de acesso', resumo: 'Portas, catracas e W-Access' },
  { id: 'gravacao', titulo: 'Gravação, terceiros e servidores', resumo: 'Nuvem ou local, VMS de terceiros, analíticos' },
  { id: 'criterios', titulo: 'Homologação e escopo', resumo: 'O que é homologado e o que entra no catálogo' }
];

// ------------------------------------------------------------
// Elementos de texto
// ------------------------------------------------------------

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ margin: '0 0 6px', fontSize: '20px', color: COR.azul, fontWeight: 700 }}>{children}</h3>
);

const H3: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <h4 id={id} style={{ margin: '26px 0 6px', fontSize: '15.5px', color: COR.azul, fontWeight: 700, paddingTop: '14px', borderTop: `1px solid ${COR.cinzaClaro}` }}>{children}</h4>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: '0 0 10px', fontSize: '14px', color: COR.azul, lineHeight: 1.6, maxWidth: '78ch' }}>{children}</p>
);

const Lista: React.FC<{ itens: React.ReactNode[] }> = ({ itens }) => (
  <ul style={{ margin: '0 0 12px', paddingLeft: '20px', fontSize: '14px', color: COR.azul, lineHeight: 1.6, maxWidth: '78ch' }}>
    {itens.map((i, n) => <li key={n} style={{ marginBottom: '4px' }}>{i}</li>)}
  </ul>
);

const Destaque: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ borderLeft: `4px solid ${COR.ciano}`, background: COR.cianoClaro, padding: '10px 14px', borderRadius: '0 8px 8px 0', margin: '6px 0 14px', fontSize: '14px', color: COR.azul, lineHeight: 1.55, maxWidth: '78ch' }}>
    {children}
  </div>
);

const Tabela: React.FC<{ cabecalho: string[]; linhas: React.ReactNode[][] }> = ({ cabecalho, linhas }) => (
  <div style={{ overflowX: 'auto', margin: '4px 0 14px' }}>
    <table style={{ borderCollapse: 'collapse', fontSize: '13.5px', color: COR.azul, minWidth: '480px', boxShadow: 'none' }}>
      <thead>
        <tr>
          {cabecalho.map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '7px 12px', fontSize: '12.5px', fontWeight: 700, color: COR.azul, background: COR.azulClaro, borderBottom: `2px solid ${COR.ciano}` }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, i) => (
          <tr key={i}>
            {l.map((c, j) => <td key={j} style={{ padding: '7px 12px', borderBottom: `1px solid ${COR.cinzaClaro}`, verticalAlign: 'top', fontSize: '13.5px', fontWeight: j === 0 ? 600 : 400 }}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ------------------------------------------------------------
// Tela
// ------------------------------------------------------------

const WikiKitsView: React.FC<IWikiKitsViewProps> = ({ abrir }) => {

  const [pagina, setPagina] = React.useState<PaginaWiki>('inicio');
  const conteudo = React.useRef<HTMLDivElement>(null);

  const irPara = (p: PaginaWiki): void => {
    setPagina(p);
    if (conteudo.current) {
      conteudo.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  // Link para outra página da wiki.
  const W: React.FC<{ p: PaginaWiki; children: React.ReactNode }> = ({ p, children }) => (
    <button type="button" onClick={() => irPara(p)} style={{ border: 0, background: 'none', padding: 0, color: '#036E7D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
      {children}
    </button>
  );

  // Link para as abas que definem os kits.
  const K: React.FC<{ d: DestinoWiki; children: React.ReactNode }> = ({ d, children }) => (
    <button type="button" onClick={() => abrir(d)} style={{ border: 0, background: 'none', padding: 0, color: COR.indigo, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
      {children} ↗
    </button>
  );

  const paginas: Record<PaginaWiki, React.ReactNode> = {

    inicio: (
      <>
        <H2>Como usar esta wiki</H2>
        <P>
          Esta wiki explica <strong>para que serve cada solução, como ela é usada em projeto e de que tipo de equipamento ela depende</strong>.
          Ela não lista modelos, códigos CIGAM nem quantidades: isso muda com frequência e fica nas abas que o montador de B.O.M. usa.
        </P>
        <Tabela
          cabecalho={['Se você quer saber…', 'Vá para']}
          linhas={[
            ['O que uma solução faz e o que ela exige', <W key="a" p="solucoes">Soluções Bridgefy</W>],
            ['Qual estrutura atende qual solução', <W key="b" p="estruturas">Estruturas</W>],
            ['Como funciona um ponto de porta ou de catraca', <W key="c" p="acesso">Controle de acesso</W>],
            ['Quando usar VMS de terceiro e como o servidor é dimensionado', <W key="d" p="gravacao">Gravação, terceiros e servidores</W>],
            ['O que “homologado” significa aqui', <W key="e" p="criterios">Homologação e escopo</W>],
            ['Quais câmeras, switches e controladores estão homologados', <K key="f" d={{ aba: 'itens' }}>Equipamentos e itens</K>],
            ['O que vai em cada kit', <K key="g" d={{ aba: 'kits' }}>Composição dos kits</K>],
            ['Como as quantidades e licenças são calculadas', <K key="h" d={{ aba: 'logica' }}>Como o montador calcula</K>],
            ['Quais servidores existem por faixa de câmeras', <K key="i" d={{ aba: 'servidores' }}>Servidores</K>]
          ]}
        />

        <H3>As regras que mais geram erro</H3>
        <Lista itens={[
          <><strong>Safe City e Safe Way nunca usam a mesma câmera.</strong> Um é gerenciamento de vídeo, o outro é leitura de placas. Ponto com as duas soluções precisa de duas câmeras, uma de cada tipo.</>,
          <><strong>Licença de Safe Way é por faixa monitorada, não por câmera.</strong> Uma câmera de leitura de placas pode cobrir mais de uma faixa, e cada faixa consome uma licença.</>,
          <><strong>Zoom óptico é regra de instalação.</strong> Em torre, poste e via pública o Face Detect precisa de câmera com zoom; em ponto baixo e próximo do rosto, não. As câmeras sem zoom são mais baratas — e é aí que mora o erro.</>,
          <><strong>Face Detect é licenciado à parte</strong>, uma licença por câmera, além da licença de Safe City.</>,
          <><strong>O Box não atende Safe Way</strong>: a câmera de leitura de placas não cabe nele.</>,
          <><strong>O limite do switch PoE é o orçamento total em watts, não o número de portas.</strong> O montador confere isso no ponto.</>,
          <><strong>Usar VMS de terceiro não tira as soluções próprias do projeto.</strong> Digifort no vídeo convive com Safe Way nas placas e Face Detect no facial.</>,
          <><strong>Servidor local é dimensionado pelo memorial de cálculo</strong>, não pela intuição: a seleção na Arquitetura escolhe a faixa a partir das câmeras do projeto.</>
        ]} />
      </>
    ),

    solucoes: (
      <>
        <H2>Soluções Bridgefy</H2>
        <P>Sete soluções. Quatro consomem vídeo e por isso dependem de câmera; três trabalham sobre dados e não têm requisito de câmera.</P>
        <Tabela
          cabecalho={['Solução', 'Exige da câmera', 'Licença']}
          linhas={[
            ['Safe City', 'Protocolo RTMP', 'Por câmera'],
            ['Smart Detect', 'O mesmo do Safe City (é módulo dele)', 'Inclusa no Safe City'],
            ['Face Detect', 'Analítico de detecção facial embarcado e envio por SFTP', 'Por câmera'],
            ['Safe Way', 'Câmera própria de leitura de placas (LPR/OCR) e envio por SFTP', 'Por faixa monitorada'],
            ['Data · Go · Crime Report', 'Não usam câmera', 'Conforme escopo']
          ]}
        />
        <Destaque>
          <strong>Obrigatório é só o protocolo e o analítico.</strong> Resolução de 4 MP e zoom óptico são recomendações que afetam a assertividade, não a compatibilidade.
          Por isso, em projeto, uma câmera fora da lista de homologados pode ser usada se atender os requisitos obrigatórios — situação comum no comercial público.
        </Destaque>

        <H3>Safe City</H3>
        <P>
          Videomonitoramento urbano em nuvem (VMS como serviço). Integra câmeras privadas à malha pública mediante autorização formal do proprietário e termo de cooperação.
          Aceita também RTSP, ONVIF e as compressões H.264 e H.265. A configuração inicial e a integração das câmeras são feitas pela DGT, não pelo cliente.
        </P>
        <P>Os limites que levam a um VMS de terceiro estão em <W p="gravacao">Gravação, terceiros e servidores</W>: câmera PTZ, volume alto de câmeras, exigência de solução local ou de licença perpétua.</P>

        <H3>Smart Detect</H3>
        <P>
          Não é uma solução independente: é um módulo do Safe City. <strong>O que atende Safe City atende Smart Detect</strong>, e a licença já está contida na do Safe City.
          Classifica objetos (pessoas, veículos, animais, objetos), detecta comportamentos (permanência em área restrita, movimentação suspeita, contagem) e permite cercas virtuais desenhadas sobre a imagem.
        </P>
        <P>Atenção: em algumas câmeras sem zoom, o fabricante não permite detecção de face e analítico perimetral ao mesmo tempo. Confira a observação do modelo em <K d={{ aba: 'itens', tipo: 'cameraVideo' }}>Câmeras de vídeo</K>.</P>

        <H3>Face Detect</H3>
        <P>Reconhecimento facial e análise de atributos (idade, gênero, máscara, óculos e outros), entregue como serviço.</P>
        <Tabela
          cabecalho={['Instalação', 'Zoom óptico', 'Por quê']}
          linhas={[
            ['Torre, poste, via pública', 'Necessário', 'A face chega pequena e distante; sem zoom a assertividade cai. É a maioria dos casos.'],
            ['Ponto baixo, porta, passagem, ambiente interno', 'Dispensável', 'A face já chega grande o suficiente.']
          ]}
        />
        <P>
          É dado biométrico: exige criptografia em trânsito e em repouso, auditoria, retenção e anonimização (LGPD). Por isso o envio é por SFTP — FTP não serve.
          No ponto, marque “ponto alto” quando for o caso: o montador avisa se a câmera escolhida não tem zoom.
        </P>

        <H3>Safe Way</H3>
        <P>
          Monitoramento de fluxo veicular e cercamento eletrônico por leitura de placas. Câmera de videomonitoramento comum não serve, por melhor que seja: é preciso câmera específica de leitura de placas.
          Cada câmera cobre um número de faixas diferente — veja em <K d={{ aba: 'itens', tipo: 'cameraOcr' }}>Câmeras OCR/LPR</K>.
        </P>
        <Destaque>
          <strong>Instalação lateral cobre no máximo 2 faixas.</strong> Para 3 ou 4 faixas o fabricante pede a câmera centralizada sobre a via, o que muda a infraestrutura do ponto e precisa entrar no orçamento.
        </Destaque>

        <H3>Data</H3>
        <P>
          Consolida dados de ERP, CRM, sistemas legados e do próprio ecossistema em dashboards e análises georreferenciadas.
          <strong> Não é licença que se entrega pronta:</strong> indicadores novos podem exigir modelagem e desenvolvimento específicos por cliente.
        </P>

        <H3>Go</H3>
        <P>
          Gestão de ocorrências: central de despacho, aplicativo do agente em campo e o módulo de proteção à mulher com acionamento emergencial.
          A integração com o CAD SINESP depende de formalização entre o Governo Federal e o órgão contratante; a DGT apoia, mas <strong>não controla o prazo</strong> — isso precisa constar na proposta.
        </P>

        <H3>Crime Report</H3>
        <P>
          Análise criminal sobre os dados oficiais do Observatório Estadual de Segurança Pública do RS, em camadas operacional, tática e estratégica.
          Como a fonte é estadual do RS, a aplicação geográfica do produto é limitada a esse estado.
        </P>
      </>
    ),

    estruturas: (
      <>
        <H2>Estruturas</H2>
        <P>
          São três produtos de prateleira que carregam os sensores. Não há estrutura personalizada por cliente.
          O número máximo de câmeras e se a estrutura aceita leitura de placas são parâmetros de cada kit, em <K d={{ aba: 'kits' }}>Composição dos kits</K>.
        </P>
        <Tabela
          cabecalho={['', 'Safe City · Smart Detect', 'Face Detect', 'Safe Way']}
          linhas={[
            ['Torre', 'Sim', 'Sim (câmera com zoom)', 'Sim'],
            ['Wallfix (Mini)', 'Sim', 'Sim (câmera com zoom)', 'Sim'],
            ['Box', 'Sim', 'Sim', 'Não']
          ]}
        />

        <H3>Torre</H3>
        <P>
          Torre em fibra de vidro (PRFV) com proteção UV, engastada no solo, com sinalizador luminoso azul no topo. É a estrutura mais flexível: aceita câmeras de vídeo e de leitura de placas na mesma torre.
          Como fica na lateral da via, a leitura de placas nela se limita a 2 faixas.
        </P>
        <P>Ponto com vídeo e placas: um kit-base e a câmera adicional do outro tipo. A composição de cada combinação está em <K d={{ aba: 'kits', kit: 'torre' }}>Torre</K>.</P>

        <H3>Wallfix (Mini)</H3>
        <P>
          Braço metálico de parede ou poste, com tratamento anticorrosivo e LED de sinalização e iluminação auxiliar. Por ser rígido, limita a oscilação com vento — importante quando a câmera tem zoom.
          No CIGAM é vendido <strong>por solução e por canal</strong> (City ou SafeWay; público ou privado), não pelos layouts do datasheet.
          Composição em <K d={{ aba: 'kits', kit: 'mini' }}>Wallfix (Mini)</K>.
        </P>

        <H3>Box</H3>
        <P>
          Caixa compacta em ACM com câmeras dome fixas lado a lado e fita LED de sinalização. É a estrutura mais restrita:
          <strong> só videomonitoramento</strong>, não comporta câmera de leitura de placas e só aceita o sensor do próprio kit. Composição em <K d={{ aba: 'kits', kit: 'box' }}>Box</K>.
        </P>

        <H3>Trocar o sensor padrão muda o que o ponto entrega</H3>
        <P>
          Os kits saem com um sensor padrão. Escolher uma alternativa no ponto é possível, mas carrega a ressalva do modelo: uma câmera de vídeo sem zoom tira o Face Detect de um ponto alto;
          uma câmera de placas que cobre menos faixas pode exigir dois conjuntos. As ressalvas de cada modelo estão nas observações em <K d={{ aba: 'itens' }}>Equipamentos e itens</K>.
        </P>
      </>
    ),

    acesso: (
      <>
        <H2>Controle de acesso</H2>
        <P>
          Pontos que liberam passagem de pessoas: portas e catracas, com leitura facial. O software de gestão é o Invenzi W-Access (a Invenzi só faz software; o hardware é de outros fabricantes).
        </P>
        <Destaque>
          <strong>W-Access não é complemento do Face Detect.</strong> O W-Access controla acesso e libera porta, catraca ou cancela, usando leitora facial.
          O Face Detect identifica pessoas por câmera, para segurança — e nunca libera passagem.
        </Destaque>

        <H3>Tipos de ponto</H3>
        <Tabela
          cabecalho={['Ponto', 'Barreira', 'Infraestrutura']}
          linhas={[
            ['Porta — eletroduto', 'Eletroímã', 'Eletroduto aparente'],
            ['Porta — dutotec', 'Fechadura', 'Canaleta Dutotec (porta de vidro leva suporte próprio)'],
            ['Catraca — pedestal', 'Catraca', 'Eletroduto, com rack e switch no ponto']
          ]}
        />
        <P>
          Na porta, o controlador facial faz o papel de leitora e de controladora: não há controladora separada. Na catraca, a catraca comum já vem com as leitoras de entrada e saída;
          a catraca acessível (PNE) leva leitoras compradas à parte. Os itens de cada tipo estão em <K d={{ aba: 'kits', kit: 'portaEletroduto' }}>Composição dos kits</K>; a catraca é calculada por fórmula.
        </P>

        <H3>A regra é por leitora</H3>
        <P>
          Licença de leitora, cabo de rede, conectores e serviço de configuração escalam com o número de leitoras, não com o número de pontos.
          Ponto de entrada e saída tem duas leitoras.
        </P>

        <H3>Licenciamento do W-Access</H3>
        <Lista itens={[
          'Uma licença por leitora facial.',
          'Licença por pacote de usuários ativos (cadastros de face).',
          'Licença por pacote de conexões simultâneas — os pontos onde o sistema é visualizado.',
          'O licenciamento varia conforme a cotação da Invenzi: confirme a cada projeto.'
        ]} />
        <P>Existe ponto de controle de acesso sem W-Access; nesse caso as licenças e parte do cabeamento não entram. Desmarque “Usa W-Access” no ponto.</P>
      </>
    ),

    gravacao: (
      <>
        <H2>Gravação, terceiros e servidores</H2>
        <P>
          O padrão é gravar em nuvem com o Safe City. Quando ele não atende, entra um VMS de terceiro instalado localmente (on-premise), e aí o projeto passa a ter servidor.
        </P>

        <H3>Quando usar terceiro em vez da solução própria</H3>
        <Tabela
          cabecalho={['Fator', 'Efeito']}
          linhas={[
            ['Câmera PTZ no projeto', 'O Safe City não suporta PTZ: obriga terceiro'],
            ['Volume alto de câmeras', 'O Safe City perde desempenho com muitas câmeras'],
            ['Exigência de solução local', 'O Safe City é nuvem: on-premise obriga terceiro'],
            ['Exigência de licença perpétua', 'O Safe City é só mensal'],
            ['Funcionalidade específica do edital', 'Ex.: gravação em disco frio'],
            ['Relacionamento comercial', 'Entre um terceiro e outro, a diferença técnica é pequena']
          ]}
        />
        <P>
          <strong>As câmeras são as mesmas.</strong> Para VMS o requisito é ONVIF, bem mais leve que o do Face Detect; não existe segunda lista de homologados.
          Só se especifica outra câmera quando o edital exige algo que as homologadas não têm.
        </P>

        <H3>Terceiro não exclui solução própria</H3>
        <P>
          No mesmo projeto pode haver Digifort no vídeo, Safe Way nas placas e Face Detect no facial — os produtos da DGT operam ao lado do VMS, sem integração.
          Os módulos próprios de facial e de leitura de placas do Digifort não são usados.
        </P>

        <H3>Digifort e Milestone</H3>
        <P>
          VMS locais. No Digifort a licença fica amarrada ao servidor: <strong>cada servidor precisa da própria licença base</strong>, e os packs de câmeras completam o que falta.
          Por isso o número de servidores muda a lista de licenças — e é o seletor de servidor que define esse número.
          O Digifort tem modelo mensal e vitalício; hoje se pratica mais o mensal.
        </P>

        <H3>IPX Analytics</H3>
        <P>
          Analíticos por IA (fabricante IP Extreme) que rodam sobre o Digifort — não funcionam sozinhos. Não é produto da Digifort, embora ela o revenda: a DGT compra o VMS com a Digifort e o IPX direto com a IP Extreme.
          Integrar os dois exige três licenças: a do Digifort por câmera, a do IPX por câmera e por pacote de analítico, e a de integração de analítico do lado do Digifort.
        </P>
        <Destaque>
          Alguns analíticos declarados pelo fabricante (queda, arma de fogo, EPI) <strong>nunca foram validados em bancada</strong> pela DGT. Oferecer sem teste é decisão de empresa, não técnica.
        </Destaque>

        <H3>Como o servidor é dimensionado</H3>
        <P>
          Para Digifort, Milestone e IPX existe memorial de cálculo do fornecedor, com faixas de capacidade (número de câmeras) e, em algumas faixas, opções de distribuição em mais de um servidor.
          Na etapa Seleção de kit da Arquitetura, o bloco <strong>Servidores da central</strong> faz a escolha:
        </P>
        <Lista itens={[
          'Finalidade, software e local saem do próprio projeto: o VMS escolhido define o servidor de gravação; o IPX, o de analítico; Safe City significa nuvem, sem servidor.',
          'As câmeras saem dos pontos. Sobre elas entra uma reserva (10% por padrão), e a faixa recomendada é a menor que comporta a necessidade.',
          'O arquiteto confirma as premissas do memorial (taxa, FPS, dias de gravação), a compressão e, quando há alternativas, a distribuição, o processador, a GPU e o sistema operacional.',
          'Projeto fora das premissas — por exemplo, câmeras acima da resolução do memorial — fica pendente: o dimensionamento precisa ser pedido ao fornecedor.',
          'O analítico considera só as câmeras de vídeo; câmeras de leitura de placas não entram.'
        ]} />
        <P>As faixas, opções, premissas e alertas de cada memorial estão em <K d={{ aba: 'servidores' }}>Servidores</K>.</P>
        <P>Axxon, Briefcam, Invenzi W-Access e o novo VMS ainda não têm memorial: o servidor deles continua sendo cotado projeto a projeto.</P>

        <H3>Horizonte</H3>
        <P>
          O plano é reduzir o uso de software de terceiro: o novo VMS da DGT deve cobrir PTZ, nuvem e on-premise, e o Labs desenvolve analíticos próprios para substituir o IPX.
          Por isso esta seção registra critério de escolha e de licenciamento, sem detalhar modelo a modelo.
        </P>
      </>
    ),

    criterios: (
      <>
        <H2>Homologação e escopo</H2>

        <H3>O que significa “homologado”</H3>
        <P>Não é comparar datasheet com requisito. Para a DGT considerar um equipamento homologado, o processo completo é:</P>
        <Lista itens={[
          'trazer o equipamento e colocá-lo em bancada;',
          'testar na prática;',
          'integrar de fato com o software;',
          'produzir o documento de configuração.'
        ]} />
        <P>Sem o documento de configuração, o time não reconhece a homologação. Especificação copiada de datasheet é hipótese até passar por bancada: já houve fabricante declarando função que o firmware não entregava.</P>

        <H3>Homologado não é o mesmo que requisito</H3>
        <Tabela
          cabecalho={['', 'O que é']}
          linhas={[
            ['Requisito', 'O que a solução exige para funcionar. Obrigatório sempre.'],
            ['Homologação', 'Processo de bancada da DGT. Dá segurança, mas não é obrigatório em projeto.']
          ]}
        />
        <P>No comercial público é comum usar câmera fora da lista (projeto novo ou parque existente do cliente); no privado é raro. A grande maioria das câmeras de projeto está na lista de homologados.</P>
        <P>A situação de cada equipamento (Homologado, Em homologação, Descontinuado) aparece em <K d={{ aba: 'itens' }}>Equipamentos e itens</K>.</P>

        <H3>O que entra no catálogo</H3>
        <P>
          Critério: <strong>a escolha do modelo faz diferença técnica?</strong> Entram câmera, switch, controlador e fonte — hardware onde trocar o modelo muda o resultado.
          Ficam fora braçadeira, conector, tomada e similares, que variam de fabricante sem diferença prática e já estão no CIGAM.
        </P>
        <Lista itens={[
          'Fornecedor não é campo de catálogo: a compra passa por vários distribuidores e é assunto de suprimentos.',
          'Preço e custo ficam no CIGAM, para não existir uma segunda verdade.',
          'Servidores entram pelo memorial de cálculo de cada software, e só para os softwares que têm memorial.'
        ]} />
      </>
    )
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 250px) minmax(0, 1fr)', gap: '18px', alignItems: 'start' }}>
      <nav aria-label="Páginas da wiki" style={{ ...painel, padding: '8px', position: 'sticky', top: '12px' }}>
        {PAGINAS.map(p => {
          const ativa = p.id === pagina;
          return (
            <button
              key={p.id}
              type="button"
              aria-current={ativa ? 'page' : undefined}
              onClick={() => irPara(p.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderLeft: `3px solid ${ativa ? COR.ciano : 'transparent'}`, background: ativa ? COR.cianoClaro : 'none', padding: '9px 12px', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontFamily: 'inherit', color: COR.azul }}
            >
              <span style={{ display: 'block', fontSize: '14px', fontWeight: ativa ? 700 : 600 }}>{p.titulo}</span>
              <span style={{ display: 'block', fontSize: '12px', color: COR.texto2, marginTop: '2px' }}>{p.resumo}</span>
            </button>
          );
        })}
      </nav>
      <article ref={conteudo} style={{ ...painel, padding: '22px 26px', minWidth: 0 }}>
        {paginas[pagina]}
        <div style={{ marginTop: '28px', paddingTop: '12px', borderTop: `1px solid ${COR.cinzaClaro}`, fontSize: '12px', color: COR.texto2 }}>
          Fontes: datasheets Bridgefy e dos fabricantes, reuniões com o pré-vendas e o especialista de produto (set–out/2026) e a especificação de servidores (nov/2026).
          Modelos, códigos e quantidades ficam nas outras abas desta página.
        </div>
      </article>
    </div>
  );
};

export default WikiKitsView;
