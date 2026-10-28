import * as React from 'react';

import {
  CAMERAS_BASE_DIGIFORT,
  MARGEM_POE,
  PACKS_DIGIFORT
} from '../../services/bom/catalogoKits';

import {
  ISelecaoKit,
  novoPonto,
  selecaoVazia
} from '../../services/bom/montadorBom';

import SelecaoKitEtapa from '../Arquitetura/SelecaoKitEtapa';

import {
  COR,
  ajuda,
  botao,
  painel
} from './kitsComum';

// ============================================================
// KITS — COMO O MONTADOR CALCULA
//
// Explica, em linguagem de quem monta proposta, o caminho do ponto
// até a lista do CIGAM, e oferece o SIMULADOR: o mesmo montador da
// etapa "Seleção de kit", sem B.O.M. por trás e sem gravar nada.
// ============================================================

const PASSOS: Array<{ titulo: string; texto: string }> = [
  {
    titulo: 'Você descreve o ponto',
    texto: 'Tipo (Torre, Box, Mini, porta ou catraca), quantas câmeras ou catracas, quantos pontos iguais e as soluções (Safe City, Face Detect, Safe Way, W-Access).'
  },
  {
    titulo: 'Entra o kit-base',
    texto: 'Os itens da composição do kit, cada um com sua regra: fixo por ponto, por câmera, por câmera de vídeo, por câmera OCR/LPR ou por câmera além da primeira. Opcionais só entram com a condição marcada.'
  },
  {
    titulo: 'Entram os equipamentos escolhidos',
    texto: 'Câmeras no modelo escolhido, switch, fontes (quando o switch não é PoE) e o controlador da porta. Tudo vem da lista de equipamentos homologados.'
  },
  {
    titulo: 'Entram as licenças',
    texto: 'Por câmera (Safe City, Face Detect), por faixa monitorada (Safe Way) e as de projeto (Digifort por servidor, IPX, W-Access por cadastros e canais).'
  },
  {
    titulo: 'O montador confere e consolida',
    texto: 'Soma itens iguais de todos os pontos, ordena por categoria, marca o que não tem código CIGAM e mostra os erros e avisos antes de concluir.'
  }
];

const VALIDACOES: string[] = [
  'Ponto sem câmera, ou com mais câmeras do que a estrutura comporta (máximo definido em cada kit).',
  'Câmera OCR/LPR em estrutura que não aceita (Box).',
  'Safe Way sem câmera OCR/LPR, ou câmera OCR sem Safe Way marcado.',
  `Orçamento PoE: consumo das câmeras × ${String(MARGEM_POE).replace('.', ',')} (margem de ${Math.round((MARGEM_POE - 1) * 100)}%) precisa caber no orçamento do switch; e uma porta PoE por câmera.`,
  'Face Detect em ponto alto com câmera sem zoom óptico.',
  'Equipamento ou item sem código CIGAM: entra como pendente, não orçável.',
  'Item usado no kit que foi desativado no catálogo.',
  'IPX Analytics sem o Digifort como VMS.'
];

const LogicaKitsView: React.FC = () => {

  const [selecao, setSelecao] = React.useState<ISelecaoKit>(() => {
    const inicial = selecaoVazia();
    inicial.pontos = [{ ...novoPonto('torre', 1), nome: 'Ponto 1' }];
    return inicial;
  });
  const [versao, setVersao] = React.useState(0);

  const recomecar = (): void => {
    const inicial = selecaoVazia();
    inicial.pontos = [{ ...novoPonto('torre', 1), nome: 'Ponto 1' }];
    setSelecao(inicial);
    setVersao(v => v + 1);
  };

  const packs = PACKS_DIGIFORT.map(p => p.cameras).slice().reverse().join(', ');

  return (
    <div>
      <div style={{ ...painel, marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Do ponto à lista do CIGAM</h3>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
          {PASSOS.map((p, i) => (
            <li key={p.titulo} style={{ borderTop: `3px solid ${i === 1 ? COR.ciano : COR.azul}`, paddingTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: COR.texto2 }}>Passo {i + 1}</div>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: COR.azul, margin: '2px 0 6px' }}>{p.titulo}</div>
              <div style={{ fontSize: '13px', color: COR.texto2, lineHeight: 1.5 }}>{p.texto}</div>
            </li>
          ))}
        </ol>
        <div style={{ ...ajuda, marginTop: '14px' }}>
          O passo 2 é o que você altera na aba Composição dos kits; os equipamentos do passo 3 ficam em Equipamentos e itens.
          As regras dos passos 3 a 5 estão no código do montador.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div style={painel}>
          <h3 style={{ margin: '0 0 10px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>O que o montador confere</h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', color: COR.azul, lineHeight: 1.6 }}>
            {VALIDACOES.map(v => <li key={v}>{v}</li>)}
          </ul>
        </div>
        <div style={painel}>
          <h3 style={{ margin: '0 0 10px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Licenças de software</h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', color: COR.azul, lineHeight: 1.6 }}>
            <li>Safe City: 1 licença por câmera de vídeo com a solução marcada.</li>
            <li>Face Detect: 1 por câmera de vídeo do ponto com Face Detect.</li>
            <li>Safe Way: 1 por faixa monitorada em cada câmera OCR/LPR.</li>
            <li>Digifort: base de {CAMERAS_BASE_DIGIFORT} câmeras por servidor; o excedente é coberto pelo menor pack que resolve ({packs} câmeras).</li>
            <li>IPX Analytics: câmeras de vídeo × pacotes; só com Digifort.</li>
            <li>W-Access: 1 licença por leitora, 1 a cada 1000 cadastros de face e 1 a cada 2 canais de visualização.</li>
          </ul>
        </div>
      </div>

      <div style={{ ...painel, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Simulador</h3>
            <div style={{ ...ajuda, marginTop: '3px' }}>
              É o mesmo montador da etapa Seleção de kit, com o catálogo gravado. Nada aqui é salvo: use para testar uma combinação ou conferir um kit depois de alterá-lo.
            </div>
          </div>
          <button type="button" style={botao('secundario')} onClick={recomecar}>Recomeçar simulação</button>
        </div>
        <SelecaoKitEtapa
          key={versao}
          selecaoInicial={selecao}
          semColuna={false}
          canal="Privado"
          salvando={false}
          somenteLeitura={false}
          modoSimulacao
          onSalvar={async () => undefined}
        />
      </div>
    </div>
  );
};

export default LogicaKitsView;
