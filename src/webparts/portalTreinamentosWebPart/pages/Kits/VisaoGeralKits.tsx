import * as React from 'react';

import {
  ChaveKit,
  ITENS,
  KITS
} from '../../services/bom/catalogoKits';

import {
  ICatalogoKitsCarregado,
  usosDoItem
} from '../../services/bom/KitsService';

import {
  IconeKit,
  NomeIconeKit
} from '../Arquitetura/IconesKit';

import {
  COR,
  botao,
  formatarDataHora,
  painel
} from './kitsComum';

// ============================================================
// KITS — VISÃO GERAL
//
// Responde três perguntas: o catálogo está saudável? o que precisa
// de atenção? onde eu mexo para mudar um kit?
// ============================================================

export interface IVisaoGeralKitsProps {
  catalogo: ICatalogoKitsCarregado;
  abrirItem: (chave: string) => void;
  abrirKit: (kit: ChaveKit) => void;
  abrirItens: () => void;
  abrirHistorico: () => void;
}

interface IPendencia {
  chave: string;
  texto: string;
  detalhe: string;
  acao: () => void;
  rotuloAcao: string;
}

const VisaoGeralKits: React.FC<IVisaoGeralKitsProps> = ({ catalogo, abrirItem, abrirKit, abrirItens, abrirHistorico }) => {

  const ativos = catalogo.itens.filter(i => i.ativo);
  const equipamentos = ativos.filter(i => i.tipo !== 'item');
  const itensKit = ativos.filter(i => i.tipo === 'item');
  const semCodigo = ativos.filter(i => !i.codigo.trim());
  const emHomologacao = ativos.filter(i => i.situacao === 'Em homologação');

  // Itens usados em algum kit.
  const usados: Record<string, string[]> = {};
  Object.keys(catalogo.composicoes).forEach(kit => {
    catalogo.composicoes[kit].forEach(l => {
      (usados[l.chaveItem] = usados[l.chaveItem] || []).push(kit);
    });
  });

  const pendencias: IPendencia[] = [];

  Object.keys(usados).forEach(chave => {
    const item = ITENS[chave];
    const registro = catalogo.itens.find(i => i.chave === chave);
    if (!item || (registro && !registro.ativo)) {
      const kit = usados[chave][0] as ChaveKit;
      pendencias.push({
        chave: `uso-${chave}`,
        texto: `${registro ? registro.descricao : chave} está ${item ? 'desativado' : 'sem cadastro'}, mas ainda faz parte de um kit`,
        detalhe: usados[chave].map(k => (KITS.find(x => x.chave === k) || { nome: k }).nome).join(', '),
        acao: () => abrirKit(kit),
        rotuloAcao: 'Abrir kit'
      });
    }
  });

  semCodigo
    .sort((a, b) => (usados[b.chave] ? 1 : 0) - (usados[a.chave] ? 1 : 0))
    .forEach(i => pendencias.push({
      chave: `cod-${i.chave}`,
      texto: `${i.descricao} — sem código CIGAM`,
      detalhe: i.tipo !== 'item'
        ? 'Pode ser escolhido no ponto, mas não é orçável.'
        : usosDoItem(i.chave, catalogo.composicoes).length > 0
          ? `Usado em ${usosDoItem(i.chave, catalogo.composicoes).join(', ')}: entra no B.O.M. como pendente.`
          : 'Não está em nenhum kit.',
      acao: () => abrirItem(i.chave),
      rotuloAcao: 'Preencher código'
    }));

  const numeros: Array<{ valor: number; rotulo: string; acao?: () => void }> = [
    { valor: equipamentos.length, rotulo: 'equipamentos homologados ou em homologação', acao: abrirItens },
    { valor: itensKit.length, rotulo: 'itens disponíveis para compor kits', acao: abrirItens },
    { valor: semCodigo.length, rotulo: 'sem código CIGAM (não orçáveis)', acao: abrirItens },
    { valor: emHomologacao.length, rotulo: 'em homologação', acao: abrirItens }
  ];

  const ultima = catalogo.alteracoes[0];

  return (
    <div>
      <div style={{ ...painel, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 0, padding: 0, marginBottom: '16px', overflow: 'hidden' }}>
        {numeros.map((n, i) => (
          <button
            key={n.rotulo}
            type="button"
            onClick={n.acao}
            style={{ textAlign: 'left', fontSize: '14px', fontWeight: 400, padding: '16px 18px', border: 0, borderRadius: 0, borderLeft: i ? `1px solid ${COR.cinzaClaro}` : 0, background: COR.branco, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: i === 2 && n.valor > 0 ? COR.indigo : COR.azul, lineHeight: 1.1 }}>{n.valor}</div>
            <div style={{ fontSize: '13px', color: COR.texto2, marginTop: '4px' }}>{n.rotulo}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', alignItems: 'start' }}>

        <div style={painel}>
          <h3 style={{ margin: '0 0 4px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Kits</h3>
          <div style={{ fontSize: '13px', color: COR.texto2, marginBottom: '10px' }}>Escolha um kit para ver ou alterar o que vai nele.</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {KITS.map((k, i) => {
              const linhas = catalogo.composicoes[k.chave] || catalogo.composicoes[k.modelo] || [];
              const parametros = catalogo.kits.find(x => x.chave === k.chave);
              return (
                <li key={k.chave} style={{ borderTop: i ? `1px solid ${COR.azulClaro}` : 0 }}>
                  <button type="button" onClick={() => abrirKit(k.chave)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', fontSize: '14px', fontWeight: 400, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: COR.azul }}>
                    <IconeKit nome={k.modelo as NomeIconeKit} tamanho={24} cor={COR.azul} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '14px' }}>{parametros ? parametros.nome : k.nome}</span>
                      <span style={{ display: 'block', fontSize: '12.5px', color: COR.texto2 }}>
                        {k.modelo !== 'catraca' ? `${linhas.length} itens no kit-base` : 'calculado por fórmula'}{!k.sistema ? (k.ativo ? ' · configurado' : ' · desativado') : ''}
                        {parametros && parametros.maxCameras ? `, até ${parametros.maxCameras} câmeras` : ''}
                        {parametros && parametros.codigoCigam ? `, kit ${parametros.codigoCigam}` : ''}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: COR.cinza, fontSize: '18px' }}>›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div style={painel}>
          <h3 style={{ margin: '0 0 4px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '.03em', color: COR.azul }}>Precisa de atenção</h3>
          {pendencias.length === 0
            ? <div style={{ fontSize: '13.5px', color: COR.texto2, padding: '10px 0' }}>Nada pendente: todos os itens têm código CIGAM e os kits só usam itens ativos.</div>
            : (
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, maxHeight: '380px', overflowY: 'auto' }}>
                {pendencias.slice(0, 30).map((p, i) => (
                  <li key={p.chave} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderTop: i ? `1px solid ${COR.azulClaro}` : 0 }}>
                    <span aria-hidden="true" style={{ width: '20px', height: '20px', borderRadius: '50%', background: COR.indigoClaro, color: COR.indigo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>!</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '13.5px', color: COR.azul, fontWeight: 600 }}>{p.texto}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: COR.texto2 }}>{p.detalhe}</span>
                    </span>
                    <button type="button" style={{ ...botao('secundario'), minHeight: '30px', fontSize: '12.5px' }} onClick={p.acao}>{p.rotuloAcao}</button>
                  </li>
                ))}
              </ul>
            )}
          {ultima && (
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: `1px solid ${COR.cinzaClaro}`, fontSize: '12.5px', color: COR.texto2 }}>
              Última alteração: {ultima.resumo} — {ultima.usuarioNome}, {formatarDataHora(ultima.data)}.{' '}
              <button type="button" onClick={abrirHistorico} style={{ border: 0, background: 'none', padding: 0, color: '#036E7D', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '12.5px' }}>Ver histórico</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisaoGeralKits;
