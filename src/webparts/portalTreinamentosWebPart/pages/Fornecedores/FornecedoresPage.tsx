import * as React from 'react';

import {
  SPHttpClient
} from '@microsoft/sp-http';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  IDadosFornecedores
} from '../../services/fornecedores/modeloFornecedores';

import {
  calcularSituacao,
  IFornecedorComSituacao
} from '../../services/fornecedores/situacaoDocumental';

import {
  administraModulo
} from '../../utils/modulosPortal';

import {
  Aviso,
  COR,
  FONTE,
  Selo,
  botao,
  celula,
  celulaCabecalho,
  painel
} from '../Kits/kitsComum';

import ListaFornecedoresView from './ListaFornecedoresView';
import DetalheFornecedorView from './DetalheFornecedorView';
import TiposDocumentoView from './TiposDocumentoView';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO E GESTÃO (fase 1, uso interno)
//
// Abas: Visão geral · Fornecedores · Tipos de documento
//
// Quem vê: quem tem o módulo "fornecedores" liberado (Usuários e
// acessos). Cadastrar fornecedor e registrar documento: qualquer um
// com o módulo. Tipos de documento e status de homologação
// (Homologado, Suspenso, Bloqueado, Descredenciado): Administrador do
// portal ou administrador do módulo ("admin:fornecedores"), que faz
// o papel da Coordenação de Suprimentos até o fluxo de aprovação
// existir. A proteção real dos dados fica nas Security Roles.
// ============================================================

export interface IFornecedoresPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
  spHttpClient?: SPHttpClient;
  siteUrl?: string;
}

type AbaFornecedores = 'visao' | 'lista' | 'tipos';

const ABAS: Array<{ id: AbaFornecedores; rotulo: string }> = [
  { id: 'visao', rotulo: 'Visão geral' },
  { id: 'lista', rotulo: 'Fornecedores' },
  { id: 'tipos', rotulo: 'Tipos de documento' }
];

// ------------------------------------------------------------
// Visão geral
// ------------------------------------------------------------

const Indicador: React.FC<{ titulo: string; valor: number; detalhe: string; destaque?: boolean }> = ({ titulo, valor, detalhe, destaque }) => (
  <div style={{ ...painel, flex: '1 1 180px', borderTop: `4px solid ${destaque && valor > 0 ? COR.indigo : COR.ciano}` }}>
    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: COR.texto2 }}>{titulo}</div>
    <div style={{ fontSize: '30px', fontWeight: 700, margin: '4px 0' }}>{valor}</div>
    <div style={{ fontSize: '12.5px', color: COR.texto2 }}>{detalhe}</div>
  </div>
);

const VisaoGeral: React.FC<{
  itens: IFornecedorComSituacao[];
  semTipos: boolean;
  administra: boolean;
  abrir: (id: string) => void;
  irParaTipos: () => void;
}> = ({ itens, semTipos, administra, abrir, irParaTipos }) => {

  const ativos = itens.filter(i => i.fornecedor.ativo);
  const homologados = ativos.filter(i => i.fornecedor.status === 'Homologado').length;
  const emHomologacao = ativos.filter(i => i.fornecedor.status === 'Em homologação').length;
  const comSancao = ativos.filter(i => i.fornecedor.resultadoSancoes === 'Com registro');
  const comPendencia = ativos.filter(i => i.situacao.pendencias.length > 0);

  const linhas = ativos
    .filter(i => i.situacao.pendencias.length > 0 || i.fornecedor.resultadoSancoes === 'Com registro')
    .sort((a, b) =>
      (b.fornecedor.resultadoSancoes === 'Com registro' ? 1 : 0) - (a.fornecedor.resultadoSancoes === 'Com registro' ? 1 : 0) ||
      b.situacao.vencidos - a.situacao.vencidos ||
      b.situacao.faltando - a.situacao.faltando ||
      b.situacao.aVencer - a.situacao.aVencer);

  return (
    <div>
      {semTipos && (
        <Aviso
          tipo="alerta"
          acao={administra ? <button type="button" style={botao('principal')} onClick={irParaTipos}>Configurar tipos</button> : undefined}
        >
          Nenhum tipo de documento configurado: as pendências documentais ainda não são calculadas.
          {!administra && ' Peça ao administrador do módulo para configurar.'}
        </Aviso>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <Indicador titulo="Ativos" valor={ativos.length} detalhe={`${homologados} homologados · ${emHomologacao} em homologação`} />
        <Indicador titulo="Com pendência documental" valor={comPendencia.length} detalhe="faltando, vencido ou vencendo em até 30 dias" destaque />
        <Indicador titulo="Com sanção vigente" valor={comSancao.length} detalhe="CEIS, CNEP ou CEPIM na última consulta" destaque />
      </div>

      <div style={{ fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', margin: '6px 0 10px' }}>O que precisa de atenção</div>

      {linhas.length === 0
        ? <Aviso tipo="ok">Nenhuma pendência: todos os fornecedores ativos estão com documentos em dia e sem sanção vigente.</Aviso>
        : (
          <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
              <thead>
                <tr>
                  <th style={celulaCabecalho}>Fornecedor</th>
                  <th style={celulaCabecalho}>Status</th>
                  <th style={celulaCabecalho}>Sanções</th>
                  <th style={celulaCabecalho}>Vencidos</th>
                  <th style={celulaCabecalho}>Faltando</th>
                  <th style={celulaCabecalho}>A vencer</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(i => (
                  <tr key={i.fornecedor.id} onClick={() => abrir(i.fornecedor.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ ...celula, fontWeight: 600 }}>{i.fornecedor.razaoSocial}</td>
                    <td style={celula}>{i.fornecedor.status}</td>
                    <td style={celula}>
                      {i.fornecedor.resultadoSancoes === 'Com registro'
                        ? <Selo tom="indigo">! com registro</Selo>
                        : <span style={{ color: COR.texto2 }}>{i.fornecedor.resultadoSancoes}</span>}
                    </td>
                    <td style={celula}>{i.situacao.vencidos || '—'}</td>
                    <td style={celula}>{i.situacao.faltando || '—'}</td>
                    <td style={celula}>{i.situacao.aVencer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

const FornecedoresPage: React.FC<IFornecedoresPageProps> = ({ dataverseService, contexto, spHttpClient, siteUrl }) => {

  const servico = React.useMemo(
    () => (dataverseService ? new FornecedoresService(dataverseService, spHttpClient, siteUrl) : undefined),
    [dataverseService, spHttpClient, siteUrl]);

  const [dados, setDados] = React.useState<IDadosFornecedores | undefined>(undefined);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');
  const [aba, setAba] = React.useState<AbaFornecedores>('visao');
  const [aberto, setAberto] = React.useState<string | undefined>(undefined);

  const usuarioNome = contexto ? contexto.nome : 'Usuário';
  const administra = !!contexto && administraModulo(contexto.perfil, contexto.modulosAdministrados, 'fornecedores');

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setErro('Serviço do Dataverse indisponível.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      setDados(await servico.carregar());
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [servico]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const avisar = (texto: string): void => {
    setMensagem(texto);
    window.setTimeout(() => setMensagem(''), 6000);
  };

  const comSituacao: IFornecedorComSituacao[] = React.useMemo(() => {
    if (!dados) {
      return [];
    }
    return dados.fornecedores.map(f => ({
      fornecedor: f,
      situacao: calcularSituacao(f, dados.tipos, dados.documentos.filter(d => d.fornecedorId === f.id))
    }));
  }, [dados]);

  const abrirFornecedor = (id: string): void => {
    setAberto(id);
    setAba('lista');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fornecedorAberto = aberto && dados ? dados.fornecedores.filter(f => f.id === aberto)[0] : undefined;

  return (
    <div style={{ fontFamily: FONTE, color: COR.azul }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Fornecedores</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: COR.texto2, maxWidth: '72ch', lineHeight: 1.5 }}>
            Cadastro, documentos com validade e consultas automáticas (Receita, CEIS, CNEP, CEPIM e leniência) dos fornecedores da DGT.
          </p>
        </div>
        {administra ? <Selo tom="ciano">administrador do módulo</Selo> : <Selo tom="cinza">cadastro e documentos</Selo>}
      </div>

      <div role="tablist" aria-label="Seções de Fornecedores" style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${COR.cinzaClaro}`, marginBottom: '18px', overflowX: 'auto' }}>
        {ABAS.map(a => {
          const ativo = a.id === aba;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => { setAba(a.id); setAberto(undefined); }}
              style={{ padding: '10px 16px', border: 0, borderBottom: `3px solid ${ativo ? COR.ciano : 'transparent'}`, marginBottom: '-1px', background: 'none', color: COR.azul, fontWeight: ativo ? 700 : 500, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {mensagem && <Aviso tipo="ok">{mensagem}</Aviso>}
      {erro && <Aviso tipo="alerta" acao={<button type="button" style={botao('secundario')} onClick={() => { carregar().catch(() => undefined); }}>Tentar de novo</button>}>{erro}</Aviso>}

      {dados && !dados.disponivel && (
        <Aviso tipo="info">
          As tabelas do módulo ainda não existem no Dataverse. Rode scripts/dataverse/criar-tabelas-fornecedores.ps1 e recarregue a página.
        </Aviso>
      )}

      {carregando && !dados && <div style={{ padding: '40px', textAlign: 'center', color: COR.texto2 }}>Carregando fornecedores…</div>}

      {dados && dados.disponivel && servico && (
        <div style={{ opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }}>

          {aba === 'visao' && (
            <VisaoGeral itens={comSituacao} semTipos={dados.tipos.length === 0} administra={administra} abrir={abrirFornecedor} irParaTipos={() => setAba('tipos')} />
          )}

          {aba === 'lista' && !fornecedorAberto && (
            <ListaFornecedoresView
              servico={servico}
              itens={comSituacao}
              usuarioNome={usuarioNome}
              abrir={abrirFornecedor}
              aoCriar={async (id, aviso) => { await carregar(); avisar(aviso); setAberto(id); }}
            />
          )}

          {aba === 'lista' && fornecedorAberto && (
            <DetalheFornecedorView
              servico={servico}
              fornecedor={fornecedorAberto}
              tipos={dados.tipos}
              administra={administra}
              usuarioNome={usuarioNome}
              voltar={() => setAberto(undefined)}
              aoAlterar={async aviso => { await carregar(); if (aviso) { avisar(aviso); } }}
            />
          )}

          {aba === 'tipos' && (
            <TiposDocumentoView
              servico={servico}
              tipos={dados.tipos}
              podeEditar={administra}
              aoAlterar={async aviso => { await carregar(); avisar(aviso); }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default FornecedoresPage;
