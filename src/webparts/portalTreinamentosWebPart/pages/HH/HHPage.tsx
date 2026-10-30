import * as React from 'react';

import { DataverseService } from '../../services/DataverseService';
import { IContextoAcesso } from '../../services/AutorizacaoService';
import { administraModulo } from '../../utils/modulosPortal';

import { calcularHH } from '../../services/hh/calculoHH';
import { AREAS_HH, IDadosHH, dadosVazios } from '../../services/hh/modeloHH';
import { HHService, IAreaHHCarregada, invalidarHHVigente } from '../../services/hh/HHService';

import { Aviso, CampoMotivo, Modal, Selo, botao } from '../Kits/kitsComum';

import { COR, FONTE, moeda, pct } from './hhComum';
import ResumoHH from './ResumoHH';
import PremissasHH from './PremissasHH';
import { CustoMensalHH, HHMensal } from './CustosHH';
import { EquipeCampoHH, QuadroPOHH } from './EquipeQuadroHH';
import { EquipeApoioHH, LancamentosHH, ProjetosHH } from './ApoioHH';
import VersoesHH from './VersoesHH';

// ============================================================
// CÁLCULO DE HH
//
// Uma área por vez (Implantação, Suporte; a terceira entra quando a
// planilha ficar pronta). Cada área tem:
//   • a versão VIGENTE — a que o B.O.M. usa;
//   • um RASCUNHO — onde se edita. "Publicar" transforma o rascunho
//     na nova vigente; a anterior fica no histórico (Substituído).
// Tudo recalcula na hora, com as mesmas fórmulas das planilhas.
//
// Quem vê: módulo "hh" liberado. Quem altera: Administrador ou
// administrador do módulo HH.
// ============================================================

export interface IHHPageProps {
  dataverseService?: DataverseService;
  contexto?: IContextoAcesso;
}

type Aba = 'resumo' | 'premissas' | 'custos' | 'hhMensal' | 'equipe' | 'quadro' | 'apoio' | 'lancamentos' | 'projetos' | 'versoes';

const ABAS: Array<{ id: Aba; rotulo: string; soApoio?: boolean }> = [
  { id: 'resumo', rotulo: 'Resumo HH' },
  { id: 'premissas', rotulo: 'Premissas' },
  { id: 'custos', rotulo: 'Custo mensal' },
  { id: 'hhMensal', rotulo: 'HH mensal' },
  { id: 'equipe', rotulo: 'Equipe de campo' },
  { id: 'quadro', rotulo: 'Quadro P.O.' },
  { id: 'apoio', rotulo: 'Equipe e horas', soApoio: true },
  { id: 'lancamentos', rotulo: 'Lançamentos', soApoio: true },
  { id: 'projetos', rotulo: 'Projetos', soApoio: true },
  { id: 'versoes', rotulo: 'Versões e histórico' }
];

const HHPage: React.FC<IHHPageProps> = ({ dataverseService, contexto }) => {

  const servico = React.useMemo(() => (dataverseService ? new HHService(dataverseService) : undefined), [dataverseService]);
  const usuarioNome = contexto ? contexto.nome : 'Usuário';
  const administra = !!contexto && administraModulo(contexto.perfil, contexto.modulosAdministrados, 'hh');

  const [area, setArea] = React.useState(AREAS_HH[0].chave);
  const [aba, setAba] = React.useState<Aba>('resumo');
  const [carga, setCarga] = React.useState<IAreaHHCarregada | undefined>(undefined);
  const [dados, setDados] = React.useState<IDadosHH | undefined>(undefined);
  const [alterado, setAlterado] = React.useState(false);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState('');
  const [mensagem, setMensagem] = React.useState('');
  const [acao, setAcao] = React.useState<'' | 'salvar' | 'publicar'>('');
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  // eslint-disable-next-line @rushstack/no-new-null
  const arquivo = React.useRef<HTMLInputElement>(null);

  const infoArea = AREAS_HH.filter(a => a.chave === area)[0];

  const carregar = React.useCallback(async (): Promise<void> => {
    if (!servico) {
      setErro('Serviço do Dataverse indisponível.');
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const c = await servico.carregarArea(area);
      setCarga(c);
      const base = c.rascunho || c.vigente;
      setDados(base ? base.dados : undefined);
      setAlterado(false);
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setCarregando(false);
    }
  }, [servico, area]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const resultado = React.useMemo(() => (dados ? calcularHH(dados) : undefined), [dados]);

  const editavel = administra && !!carga && carga.disponivel && !!dados;

  const mudar = (fn: (d: IDadosHH) => IDadosHH): void => {
    setDados(atual => (atual ? fn(atual) : atual));
    setAlterado(true);
  };

  const avisar = (t: string): void => {
    setMensagem(t);
    window.setTimeout(() => setMensagem(''), 6000);
  };

  const trocarArea = (nova: string): void => {
    if (nova === area) {
      return;
    }
    if (alterado && !window.confirm('Há alterações não salvas. Trocar de área e descartá-las?')) {
      return;
    }
    setArea(nova);
    setAba('resumo');
  };

  // ---------------- importação / exportação ----------------

  const importarArquivo = (ev: React.ChangeEvent<HTMLInputElement>): void => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) {
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const d = JSON.parse(String(leitor.result)) as IDadosHH;
        if (!d || d.versaoModelo !== 1 || !d.premissas) {
          throw new Error('O arquivo não é um cálculo de HH do portal (versaoModelo 1).');
        }
        if (d.area !== area && !window.confirm(`O arquivo é da área "${d.area}" e você está em "${infoArea.nome}". Importar mesmo assim?`)) {
          return;
        }
        setDados({ ...d, area });
        setAlterado(true);
        avisar(`Dados importados de "${f.name}". Confira e salve o rascunho.`);
      } catch (e) {
        setErro(`Não foi possível importar: ${String((e as Error)?.message || e)}`);
      }
    };
    leitor.readAsText(f, 'utf-8');
  };

  const exportar = (): void => {
    if (!dados) {
      return;
    }
    const blob = new Blob([JSON.stringify(dados, undefined, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hh-${area}-${dados.premissas.mesReferencia.replace('/', '-')}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ---------------- gravação ----------------

  const confirmar = async (): Promise<void> => {
    if (!servico || !carga || !dados) {
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe o motivo: ele vai para o histórico.');
      return;
    }
    setGravando(true);
    setErro('');
    try {
      if (acao === 'publicar') {
        await servico.publicar(area, dados, carga, motivo.trim(), usuarioNome);
        invalidarHHVigente();
        avisar('Versão publicada. O B.O.M. passa a usar estes valores.');
      } else {
        await servico.salvarRascunho(area, dados, carga, motivo.trim(), usuarioNome);
        avisar('Rascunho salvo. Publique quando estiver pronto para o B.O.M. usar.');
      }
      setAcao('');
      setMotivo('');
      await carregar();
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setGravando(false);
    }
  };

  const descartar = async (): Promise<void> => {
    if (!servico || !carga) {
      return;
    }
    if (carga.rascunho) {
      if (!window.confirm('Descartar o rascunho salvo? Ele fica no histórico, e a tela volta para a versão vigente.')) {
        return;
      }
      await servico.descartarRascunho(area, carga, usuarioNome);
      await carregar();
    } else {
      setDados(carga.vigente ? carga.vigente.dados : undefined);
      setAlterado(false);
    }
  };

  // ---------------- tela ----------------

  const vig = carga && carga.vigente;
  const ras = carga && carga.rascunho;
  const abas = ABAS.filter(a => !a.soApoio || (dados && dados.apoio));
  const propsSecao = dados && resultado ? { dados, resultado, editavel, mudar } : undefined;

  return (
    <div style={{ fontFamily: FONTE, color: COR.azul }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em' }}>Cálculo de HH</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: COR.texto2, maxWidth: '75ch', lineHeight: 1.5 }}>
            Homem-hora por área, com as fórmulas das planilhas de HH. A versão vigente de cada área alimenta o B.O.M. da Arquitetura de Soluções.
          </p>
        </div>
        {!administra && <Selo tom="cinza">modo consulta</Selo>}
      </div>

      {/* áreas */}
      <div role="tablist" aria-label="Áreas" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {AREAS_HH.map(a => {
          const ativo = a.chave === area;
          return (
            <button
              key={a.chave}
              type="button"
              role="tab"
              aria-selected={ativo}
              disabled={!a.disponivel}
              onClick={() => trocarArea(a.chave)}
              title={a.descricao}
              style={{ textAlign: 'left', minWidth: '200px', padding: '12px 16px', borderRadius: '10px', border: `1px ${a.disponivel ? 'solid' : 'dashed'} ${ativo ? COR.azul : COR.cinzaClaro}`, background: ativo ? COR.azul : COR.branco, color: ativo ? COR.branco : COR.azul, cursor: a.disponivel ? 'pointer' : 'not-allowed', opacity: a.disponivel ? 1 : 0.6, fontFamily: 'inherit', fontSize: '14px', fontWeight: 400, boxShadow: ativo ? `inset 0 -3px 0 ${COR.ciano}` : 'none' }}
            >
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{a.nome}</div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{a.disponivel ? a.descricao : 'Em desenvolvimento'}</div>
            </button>
          );
        })}
      </div>

      {mensagem && <Aviso tipo="ok">{mensagem}</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {carga && !carga.disponivel && <Aviso tipo="info">{carga.motivoIndisponivel} Até lá, dá para importar um arquivo e ver o cálculo, mas não gravar.</Aviso>}

      {/* barra de versão e ações */}
      {!carregando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 14px', marginBottom: '14px', borderRadius: '8px', background: alterado ? COR.azul : COR.branco, color: alterado ? COR.branco : COR.azul, border: `1px solid ${alterado ? COR.azul : COR.cinzaClaro}`, boxShadow: alterado ? `inset 4px 0 0 ${COR.ciano}` : 'none' }}>
          <div style={{ flex: 1, minWidth: '240px', fontSize: '13.5px', lineHeight: 1.5 }}>
            {vig
              ? <>Vigente: <strong>versão {vig.versao.versao}</strong> ({vig.versao.mesReferencia}) · HH por ponto <strong>{moeda(vig.versao.hhPorPonto)}</strong> · {pct(vig.versao.pctFixo)} · publicada por {vig.versao.publicadoPor || '—'}</>
              : <>Nenhuma versão publicada ainda: o B.O.M. ainda não tem HH desta área.</>}
            <br />
            {alterado
              ? <strong>Alterações não salvas.</strong>
              : ras ? <>Editando o <strong>rascunho</strong> (versão {ras.versao.versao}), ainda não publicado.</> : dados ? <>Mostrando a versão vigente.</> : null}
          </div>
          {administra && (
            <>
              <input ref={arquivo} type="file" accept=".json,application/json" onChange={importarArquivo} style={{ display: 'none' }} />
              <button type="button" style={{ ...botao('secundario'), ...(alterado ? { background: 'transparent', color: COR.branco, borderColor: 'rgba(255,255,255,.4)' } : {}) }} onClick={() => arquivo.current && arquivo.current.click()}>Importar dados (.json)</button>
            </>
          )}
          {dados && <button type="button" style={{ ...botao('secundario'), ...(alterado ? { background: 'transparent', color: COR.branco, borderColor: 'rgba(255,255,255,.4)' } : {}) }} onClick={exportar}>Exportar</button>}
          {editavel && (alterado || ras) && <button type="button" style={{ ...botao('secundario'), ...(alterado ? { background: 'transparent', color: COR.branco, borderColor: 'rgba(255,255,255,.4)' } : {}) }} onClick={() => { descartar().catch(() => undefined); }}>Descartar</button>}
          {editavel && alterado && <button type="button" style={{ ...botao('principal'), background: COR.ciano, color: COR.azul }} onClick={() => setAcao('salvar')}>Salvar rascunho</button>}
          {editavel && (alterado || ras) && <button type="button" style={{ ...botao('principal'), ...(alterado ? { background: COR.branco, color: COR.azul } : {}) }} onClick={() => setAcao('publicar')}>Publicar versão</button>}
        </div>
      )}

      {carregando && <div style={{ padding: '40px', textAlign: 'center', color: COR.texto2 }}>Carregando o cálculo de HH…</div>}

      {!carregando && !dados && (
        <div style={{ background: COR.branco, border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>{infoArea.nome}: nenhum cálculo ainda</div>
          <div style={{ fontSize: '14px', color: COR.texto2, marginBottom: '16px' }}>Importe o arquivo de dados da planilha (hh-{area}.json) ou comece um cálculo em branco.</div>
          {administra && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" style={botao('principal')} onClick={() => arquivo.current && arquivo.current.click()}>Importar dados (.json)</button>
              <button type="button" style={botao('secundario')} onClick={() => { setDados(dadosVazios(area, `Área de ${infoArea.nome}`)); setAlterado(true); setAba('premissas'); }}>Começar em branco</button>
            </div>
          )}
        </div>
      )}

      {propsSecao && (
        <>
          <div role="tablist" aria-label="Partes do cálculo" style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${COR.cinzaClaro}`, marginBottom: '16px', overflowX: 'auto' }}>
            {abas.map(a => {
              const ativo = a.id === aba;
              return (
                <button key={a.id} type="button" role="tab" aria-selected={ativo} onClick={() => setAba(a.id)} style={{ padding: '10px 14px', border: 0, borderBottom: `3px solid ${ativo ? COR.ciano : 'transparent'}`, marginBottom: '-1px', background: 'none', color: COR.azul, fontWeight: ativo ? 700 : 500, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', borderRadius: 0 }}>
                  {a.rotulo}
                </button>
              );
            })}
          </div>

          {aba === 'resumo' && <ResumoHH {...propsSecao} />}
          {aba === 'premissas' && <PremissasHH {...propsSecao} />}
          {aba === 'custos' && <CustoMensalHH {...propsSecao} />}
          {aba === 'hhMensal' && <HHMensal {...propsSecao} />}
          {aba === 'equipe' && <EquipeCampoHH {...propsSecao} />}
          {aba === 'quadro' && <QuadroPOHH {...propsSecao} />}
          {aba === 'apoio' && <EquipeApoioHH {...propsSecao} />}
          {aba === 'lancamentos' && <LancamentosHH {...propsSecao} />}
          {aba === 'projetos' && <ProjetosHH {...propsSecao} />}
          {aba === 'versoes' && carga && (
            <VersoesHH
              carga={carga}
              podeEditar={administra}
              aoAbrir={async id => {
                if (!servico) {
                  return;
                }
                const d = await servico.lerVersao(id);
                if (d && (!alterado || window.confirm('Há alterações não salvas. Abrir a versão e descartá-las?'))) {
                  setDados(d);
                  setAlterado(true);
                  setAba('resumo');
                  avisar('Versão antiga aberta como base. Salve como rascunho para editar a partir dela.');
                }
              }}
            />
          )}
        </>
      )}

      {acao && (
        <Modal
          titulo={acao === 'publicar' ? 'Publicar versão' : 'Salvar rascunho'}
          subtitulo={acao === 'publicar'
            ? 'A versão publicada passa a ser usada no B.O.M. A vigente atual fica no histórico.'
            : 'O rascunho fica guardado, mas o B.O.M. continua usando a versão vigente.'}
          aoFechar={() => setAcao('')}
          rodape={(
            <>
              <button type="button" style={botao('secundario')} onClick={() => setAcao('')}>Voltar</button>
              <button type="button" style={botao('principal', gravando)} disabled={gravando} onClick={() => { confirmar().catch(() => undefined); }}>{gravando ? 'Gravando…' : acao === 'publicar' ? 'Publicar' : 'Salvar'}</button>
            </>
          )}
        >
          {resultado && (
            <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
              HH por ponto: <strong>{moeda(resultado.resumo.hhPorPonto)}</strong>
              {vig && <> (vigente: {moeda(vig.versao.hhPorPonto)})</>} · % fixo {pct(resultado.resumo.pctFixo)} · mês {dados && dados.premissas.mesReferencia}
            </div>
          )}
          <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
        </Modal>
      )}
    </div>
  );
};

export default HHPage;
