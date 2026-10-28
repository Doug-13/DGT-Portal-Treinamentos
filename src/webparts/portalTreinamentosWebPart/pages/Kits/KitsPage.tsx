import * as React from 'react';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  ChaveKit
} from '../../services/bom/catalogoKits';

import {
  ICatalogoKitsCarregado,
  IItemKit,
  KitsService,
  aplicarNoMontador,
  invalidarCatalogoKits
} from '../../services/bom/KitsService';

import {
  administraModulo
} from '../../utils/modulosPortal';

import CatalogoItensView from './CatalogoItensView';
import ComposicaoKitView from './ComposicaoKitView';
import HistoricoKitsView from './HistoricoKitsView';
import LogicaKitsView from './LogicaKitsView';
import VisaoGeralKits from './VisaoGeralKits';

import {
  Aviso,
  COR,
  FONTE,
  Selo,
  botao
} from './kitsComum';

// ============================================================
// KITS — CATÁLOGO DO MONTADOR DE B.O.M.
//
// Abas internas:
//   Visão geral · Equipamentos e itens · Composição dos kits ·
//   Como o montador calcula (com simulador) · Histórico
//
// Quem vê: quem tem o módulo "kits" liberado (Usuários e acessos).
// Quem altera: Administrador do portal ou administrador do módulo
// Kits ("admin:kits"). A proteção dos dados fica nas Security Roles
// do Dataverse (scripts/dataverse/criar-tabelas-kits.ps1).
// ============================================================

export interface IKitsPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

type AbaKits = 'visao' | 'itens' | 'kits' | 'logica' | 'historico';

const ABAS: Array<{ id: AbaKits; rotulo: string }> = [
  { id: 'visao', rotulo: 'Visão geral' },
  { id: 'itens', rotulo: 'Equipamentos e itens' },
  { id: 'kits', rotulo: 'Composição dos kits' },
  { id: 'logica', rotulo: 'Como o montador calcula' },
  { id: 'historico', rotulo: 'Histórico' }
];

const KitsPage: React.FC<IKitsPageProps> = ({ dataverseService, contexto }) => {

  const servico = React.useMemo(
    () => (dataverseService ? new KitsService(dataverseService) : undefined),
    [dataverseService]);

  const [catalogo, setCatalogo] = React.useState<ICatalogoKitsCarregado | undefined>(undefined);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');
  const [aba, setAba] = React.useState<AbaKits>('visao');
  const [itemFoco, setItemFoco] = React.useState<string | undefined>(undefined);
  const [kitFoco, setKitFoco] = React.useState<ChaveKit | undefined>(undefined);
  const [importando, setImportando] = React.useState('');
  const [pendente, setPendente] = React.useState(false);

  const usuarioNome = contexto ? contexto.nome : 'Usuário';

  const administra = !!contexto && administraModulo(contexto.perfil, contexto.modulosAdministrados, 'kits');
  const podeEditar = administra && !!catalogo && catalogo.origem === 'dataverse' && !catalogo.vazio;

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setErro('Serviço do Dataverse indisponível.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const dados = await servico.carregar();
      aplicarNoMontador(dados);
      invalidarCatalogoKits();
      setCatalogo(dados);
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
    window.setTimeout(() => setMensagem(''), 5000);
  };

  const irPara = (nova: AbaKits): void => {
    if (aba === 'kits' && nova !== 'kits' && pendente && !window.confirm('Há alterações não salvas no kit. Sair e descartar?')) {
      return;
    }
    setPendente(false);
    setItemFoco(undefined);
    setKitFoco(undefined);
    setAba(nova);
  };

  // ---------------- gravações ----------------

  const salvarItem = async (item: IItemKit, anterior: IItemKit | undefined, motivo: string): Promise<void> => {
    if (!servico) {
      return;
    }
    await servico.salvarItem(item, anterior, motivo, usuarioNome);
    await carregar();
    avisar(`${item.descricao}: salvo. O montador já usa a versão nova.`);
  };

  const salvarKit = async (dados: Parameters<React.ComponentProps<typeof ComposicaoKitView>['aoSalvar']>[0]): Promise<void> => {
    if (!servico) {
      return;
    }
    if (dados.parametros) {
      await servico.salvarKit(dados.parametros.novo, dados.parametros.anterior, dados.motivo, usuarioNome);
    }
    if (dados.composicao) {
      await servico.salvarComposicao(dados.kit, dados.composicao.nova, dados.composicao.anterior, dados.motivo, dados.composicao.resumo, usuarioNome);
    }
    await carregar();
    setPendente(false);
    avisar('Kit salvo. Os próximos cálculos de B.O.M. já usam a composição nova.');
  };

  const importar = async (): Promise<void> => {
    if (!servico || !catalogo) {
      return;
    }
    if (!window.confirm('Levar o catálogo padrão do sistema para o Dataverse? Só o que ainda não existe é criado.')) {
      return;
    }
    setImportando('Preparando…');
    setErro('');
    try {
      const total = await servico.importarPadrao(catalogo, usuarioNome, (feito, de) => setImportando(`Importando ${feito} de ${de}…`));
      await carregar();
      avisar(total > 0 ? `Catálogo importado: ${total} registros criados.` : 'Nada a importar: o catálogo já estava completo.');
    } catch (e) {
      setErro(`A importação parou: ${String((e as Error)?.message || e)}. Rode de novo — o que já foi criado não é duplicado.`);
    } finally {
      setImportando('');
    }
  };

  // ---------------- tela ----------------

  const faltaImportar = !!catalogo && catalogo.origem === 'dataverse' &&
    (catalogo.vazio || catalogo.itens.some(i => !i.id) || catalogo.kits.some(k => !k.id));

  return (
    <div style={{ fontFamily: FONTE, color: COR.azul }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Kits</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: COR.texto2, maxWidth: '70ch', lineHeight: 1.5 }}>
            O catálogo que o montador de B.O.M. usa: equipamentos homologados, o que vai em cada kit e como as quantidades são calculadas.
          </p>
        </div>
        {catalogo && (
          catalogo.origem === 'dataverse' && !catalogo.vazio
            ? <Selo tom="ciano" titulo="Alterações feitas aqui valem para o montador">✓ Catálogo no Dataverse</Selo>
            : <Selo tom="cinza" titulo="Valores do código do sistema">Padrão do sistema, somente consulta</Selo>
        )}
        {administra && !podeEditar && catalogo && catalogo.origem === 'dataverse' && <Selo tom="indigo">importe para editar</Selo>}
        {!administra && <Selo tom="cinza">modo consulta</Selo>}
      </div>

      <div role="tablist" aria-label="Seções de Kits" style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${COR.cinzaClaro}`, marginBottom: '18px', overflowX: 'auto' }}>
        {ABAS.map(a => {
          const ativo = a.id === aba;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => irPara(a.id)}
              style={{ padding: '10px 16px', border: 0, borderBottom: `3px solid ${ativo ? COR.ciano : 'transparent'}`, marginBottom: '-1px', background: 'none', color: COR.azul, fontWeight: ativo ? 700 : 500, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {mensagem && <Aviso tipo="ok">{mensagem}</Aviso>}
      {erro && <Aviso tipo="alerta" acao={<button type="button" style={botao('secundario')} onClick={() => { carregar().catch(() => undefined); }}>Tentar de novo</button>}>{erro}</Aviso>}

      {catalogo && catalogo.origem === 'padrao' && (
        <Aviso tipo="info">
          {catalogo.motivoPadrao} Você está vendo o catálogo padrão do sistema — é o que o montador usa hoje.
          {administra && ' Depois de criar as tabelas, volte aqui e importe o catálogo para poder editar.'}
        </Aviso>
      )}

      {administra && faltaImportar && (
        <Aviso
          tipo="alerta"
          acao={<button type="button" style={botao('principal', !!importando)} disabled={!!importando} onClick={() => { importar().catch(() => undefined); }}>{importando || 'Importar catálogo padrão'}</button>}
        >
          {catalogo && catalogo.vazio
            ? 'As tabelas existem, mas o catálogo ainda não foi carregado. Importe o padrão do sistema para começar a editar.'
            : 'Há itens ou kits do padrão do sistema que ainda não estão no Dataverse (ex.: novidades de uma versão do portal). Importe para completar.'}
        </Aviso>
      )}

      {carregando && !catalogo && <div style={{ padding: '40px', textAlign: 'center', color: COR.texto2 }}>Carregando o catálogo de kits…</div>}

      {catalogo && (
        <div style={{ opacity: carregando ? 0.6 : 1, transition: 'opacity .2s' }}>
          {aba === 'visao' && (
            <VisaoGeralKits
              catalogo={catalogo}
              abrirItem={chave => { setItemFoco(chave); setAba('itens'); }}
              abrirKit={kit => { setKitFoco(kit); setAba('kits'); }}
              abrirItens={() => { setItemFoco(undefined); setAba('itens'); }}
              abrirHistorico={() => setAba('historico')}
            />
          )}
          {aba === 'itens' && (
            <CatalogoItensView
              catalogo={catalogo}
              podeEditar={podeEditar}
              chaveInicial={itemFoco}
              aoSalvarItem={salvarItem}
            />
          )}
          {aba === 'kits' && (
            <ComposicaoKitView
              catalogo={catalogo}
              podeEditar={podeEditar}
              kitInicial={kitFoco}
              aoSalvar={salvarKit}
              aoMudarPendencia={setPendente}
            />
          )}
          {aba === 'logica' && <LogicaKitsView />}
          {aba === 'historico' && <HistoricoKitsView alteracoes={catalogo.alteracoes} origemDataverse={catalogo.origem === 'dataverse'} />}
        </div>
      )}
    </div>
  );
};

export default KitsPage;
