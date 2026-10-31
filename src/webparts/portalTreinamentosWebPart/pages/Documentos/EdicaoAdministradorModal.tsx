import * as React from 'react';

import {
  IDocumento
} from '../../models/Documento';

import {
  IFluxoDefinicao,
  IFluxoInstancia,
  IFluxoMetadado
} from '../../models/Fluxo';

import {
  DataverseService
} from '../../services/DataverseService';

import {
  AreaAdminService,
  IAreaAdmin
} from '../../services/AreaAdminService';

import {
  DocumentoHistoricoService
} from '../../services/DocumentoHistoricoService';

import {
  obterPersistenciaFluxo
} from '../../services/fluxo/persistenciaFluxo';

import {
  gravarValorUsuario,
  lerValorUsuario
} from '../../services/fluxo/valorUsuario';

import {
  sincronizarVinculosTreinamento
} from '../../services/referencias/ReferenciasDocumentoService';

import CampoUsuarioFluxo from
  '../../components/fluxo/CampoUsuarioFluxo';

import CampoDocumentoFluxo from
  '../../components/fluxo/CampoDocumentoFluxo';

import TabelaCampoFluxo from
  '../../components/fluxo/TabelaCampoFluxo';

// ============================================================
// EDIÇÃO COMO ADMINISTRADOR
//
// Deixa o documento editável por completo, independentemente da
// etapa do fluxo:
//
//   • Dados do documento: título, descrição, área, responsável e
//     situação (ativo). Código e tipo não mudam aqui — eles formam a
//     identidade do documento e a pasta no SharePoint.
//   • Metadados da revisão: TODOS os campos do fluxo, inclusive os de
//     etapas já concluídas (ex.: corrigir um documento referenciado).
//     A etapa atual não muda.
//
// Rastreabilidade: o motivo é obrigatório. O ajuste vai para o
// histórico do documento (dados anteriores → novos) e, nos metadados,
// também para a tramitação do fluxo.
// ============================================================

export interface IEdicaoAdministradorModalProps {
  dataverseService: DataverseService;
  documento: IDocumento;

  // Revisão cujos metadados são ajustados: a em andamento ou, sem ela,
  // a mais recente. O modal carrega o fluxo dela.
  revisaoId?: string;
  revisaoRotulo?: string;

  usuarioId: string;
  usuarioNome: string;

  onAbrirDocumento?: (documentoId: string) => void;

  // alterou = gravou algo (a tela recarrega).
  onFechar: (alterou: boolean) => void;
}

const COR = {
  azul: '#202A44',
  texto2: '#5E6670',
  borda: '#D9D9D6',
  fundo: '#F8FAFC',
  vermelho: '#B42318',
  ambar: '#B54708',
  ambarClaro: '#FFFAEB',
  indigo: '#485CC7'
};

const guid = (
  valor?: string
): string =>
  (valor || '').replace(/[{}]/g, '').trim().toLowerCase();

const rotulo: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.03em',
  color: COR.texto2,
  marginBottom: '4px'
};

const entrada: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: '36px',
  padding: '7px 10px',
  border: `1px solid ${COR.borda}`,
  borderRadius: '6px',
  fontFamily: 'inherit',
  fontSize: '13.5px',
  color: COR.azul,
  background: '#FFFFFF'
};

const secao: React.CSSProperties = {
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  padding: '14px 16px',
  marginBottom: '14px',
  background: '#FFFFFF'
};

const EdicaoAdministradorModal: React.FC<IEdicaoAdministradorModalProps> = (props) => {

  const { documento } = props;

  // ---------------- dados do documento ----------------
  const [titulo, setTitulo] = React.useState(documento.titulo || '');
  const [descricao, setDescricao] = React.useState(documento.descricao || '');
  const [areaId, setAreaId] = React.useState(guid(documento.areaId));
  const [ativo, setAtivo] = React.useState(documento.ativo !== false);
  const [responsavel, setResponsavel] = React.useState(
    documento.responsavelId
      ? gravarValorUsuario({ id: documento.responsavelId, nome: documento.responsavel || '' })
      : ''
  );

  const [areas, setAreas] = React.useState<IAreaAdmin[]>([]);

  // ---------------- gravação ----------------
  const [motivo, setMotivo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState('');
  const [avisos, setAvisos] = React.useState<string[]>([]);

  // ---------------- metadados ----------------
  const [instancia, setInstancia] =
    React.useState<IFluxoInstancia | undefined>(undefined);

  const [definicao, setDefinicao] =
    React.useState<IFluxoDefinicao | undefined>(undefined);

  const [carregandoFluxo, setCarregandoFluxo] =
    React.useState(!!props.revisaoId);

  const metadados: IFluxoMetadado[] =
    definicao && definicao.metadados ? definicao.metadados : [];

  const [valores, setValores] =
    React.useState<Record<string, string>>({});

  React.useEffect(
    () => {
      if (!props.revisaoId) {
        setCarregandoFluxo(false);
        return;
      }

      let ativo = true;
      const persistencia = obterPersistenciaFluxo(props.dataverseService);

      (async () => {
        const lida = await persistencia.repositorio.obter(props.revisaoId as string);
        const def = lida ? await persistencia.servico.definicaoDaInstancia(lida) : undefined;
        if (ativo) {
          setInstancia(lida);
          setDefinicao(def);
          setValores(lida ? { ...lida.valores } : {});
        }
      })()
        .catch(falha => {
          console.error(falha);
          if (ativo) { setErro('Não foi possível carregar os metadados da revisão.'); }
        })
        .then(() => { if (ativo) { setCarregandoFluxo(false); } }, () => undefined);

      return () => { ativo = false; };
    },
    [props.dataverseService, props.revisaoId]
  );


  React.useEffect(
    () => {
      new AreaAdminService(props.dataverseService).listarAreas()
        .then(lista => setAreas(lista.filter(area => area.ativa !== false || guid(area.id) === guid(documento.areaId))))
        .catch(falha => console.error(falha));
    },
    [props.dataverseService, documento.areaId]
  );

  const responsavelEscolhido =
    lerValorUsuario(responsavel);

  // O que mudou no cadastro.
  const mudancasDocumento: Record<string, { antes: string; depois: string }> = {};

  if (titulo.trim() !== (documento.titulo || '').trim()) {
    mudancasDocumento['Título'] = { antes: documento.titulo || '', depois: titulo.trim() };
  }
  if (descricao.trim() !== (documento.descricao || '').trim()) {
    mudancasDocumento['Descrição'] = { antes: documento.descricao || '', depois: descricao.trim() };
  }
  if (areaId && areaId !== guid(documento.areaId)) {
    const nova = areas.find(area => guid(area.id) === areaId);
    mudancasDocumento['Área'] = { antes: documento.area || '', depois: nova ? nova.nome : areaId };
  }
  if (responsavelEscolhido && responsavelEscolhido.id !== guid(documento.responsavelId)) {
    mudancasDocumento['Responsável'] = { antes: documento.responsavel || '', depois: responsavelEscolhido.nome };
  }
  if (ativo !== (documento.ativo !== false)) {
    mudancasDocumento['Situação'] = { antes: documento.ativo !== false ? 'Ativo' : 'Inativo', depois: ativo ? 'Ativo' : 'Inativo' };
  }

  const metadadosAlterados =
    instancia
      ? metadados.filter(item => (instancia as IFluxoInstancia).valores[item.chave] !== valores[item.chave] &&
        ((instancia as IFluxoInstancia).valores[item.chave] || '') !== (valores[item.chave] || ''))
      : [];

  const haMudancas =
    Object.keys(mudancasDocumento).length > 0 || metadadosAlterados.length > 0;

  const podeSalvar =
    haMudancas && !!titulo.trim() && motivo.trim().length >= 5 && !salvando;

  const salvar = async (): Promise<void> => {

    setSalvando(true);
    setErro('');
    setAvisos([]);

    const novosAvisos: string[] = [];

    try {
      // 1) Cadastro do documento
      if (Object.keys(mudancasDocumento).length > 0) {
        const dados: Record<string, unknown> = {
          dgt_titulo: titulo.trim(),
          dgt_descricao: descricao.trim(),
          dgt_ativo: ativo
        };

        if (mudancasDocumento['Área']) {
          const conjuntoArea = await props.dataverseService.obterNomeConjunto('dgt_area');
          dados['dgt_Area@odata.bind'] = `/${conjuntoArea}(${areaId})`;
        }

        if (mudancasDocumento['Responsável'] && responsavelEscolhido) {
          const conjuntoUsuario = await props.dataverseService.obterNomeConjunto('dgt_usuario');
          dados['dgt_Responsavel@odata.bind'] = `/${conjuntoUsuario}(${responsavelEscolhido.id})`;
        }

        await props.dataverseService.atualizarRegistro('dgt_documento', documento.id, dados);
      }

      // 2) Metadados da revisão (histórico do fluxo incluído)
      let alteradosFluxo: string[] = [];

      if (metadadosAlterados.length > 0 && instancia) {
        const persistencia = obterPersistenciaFluxo(props.dataverseService);
        const rotulos: Record<string, string> = {};
        metadados.forEach(item => { rotulos[item.chave] = item.rotulo; });

        const novos: Record<string, string> = {};
        metadadosAlterados.forEach(item => { novos[item.chave] = valores[item.chave] || ''; });

        const resultado =
          await persistencia.servico.ajustarValoresAdministrador(
            instancia.revisaoId,
            novos,
            {
              motivo: motivo.trim(),
              usuarioId: props.usuarioId,
              usuarioNome: props.usuarioNome,
              rotuloRevisao: props.revisaoRotulo,
              rotulos
            }
          );

        alteradosFluxo = resultado.alterados;
        novosAvisos.push(...resultado.avisos);

        // Referências a treinamentos viram vínculo (mesma regra do fluxo).
        try {
          await sincronizarVinculosTreinamento(
            props.dataverseService,
            { id: documento.id, codigo: documento.codigo, tipo: documento.tipo },
            resultado.instancia.valores,
            props.revisaoRotulo
          );
        } catch (falha) {
          console.error(falha);
          novosAvisos.push('Os vínculos entre documentos e treinamentos não puderam ser atualizados.');
        }
      }

      // 3) Histórico do documento (auditoria)
      const linhas: string[] = [];
      Object.keys(mudancasDocumento).forEach(campo => {
        linhas.push(`${campo}: "${mudancasDocumento[campo].antes}" → "${mudancasDocumento[campo].depois}"`);
      });
      if (alteradosFluxo.length > 0) {
        linhas.push(`Metadados: ${metadados.filter(item => alteradosFluxo.indexOf(item.chave) >= 0).map(item => item.rotulo).join(', ')}`);
      }

      const avisoHistorico =
        await new DocumentoHistoricoService(props.dataverseService).registrarSemInterromper({
          documentoId: documento.id,
          tipo: 'OUTRO',
          titulo: 'Edição administrativa',
          descricao: linhas.join('\n'),
          motivo: motivo.trim(),
          revisaoNumero: props.revisaoRotulo,
          dadosAnteriores: {
            documento: mudancasDocumento,
            metadados: instancia
              ? alteradosFluxo.reduce<Record<string, string>>((acc, chave) => {
                acc[chave] = (instancia as IFluxoInstancia).valores[chave] || '';
                return acc;
              }, {})
              : {}
          },
          usuarioId: props.usuarioId,
          usuarioNome: props.usuarioNome
        });

      if (avisoHistorico) {
        novosAvisos.push(avisoHistorico);
      }

      if (novosAvisos.length > 0) {
        setAvisos(novosAvisos);
        window.alert(`Alterações gravadas, com avisos:\n\n${novosAvisos.join('\n')}`);
      }

      props.onFechar(true);
    } catch (falha) {
      console.error(falha);
      setErro(`Não foi possível gravar: ${falha instanceof Error ? falha.message : String(falha)}`);
      setSalvando(false);
    }
  };

  const definirValor = (chave: string, valor: string): void =>
    setValores(atual => ({ ...atual, [chave]: valor }));

  // Editor de cada metadado, conforme o tipo.
  const editorMetadado = (item: IFluxoMetadado): React.ReactNode => {
    const id = `adm-campo-${item.chave}`;
    const valor = valores[item.chave] || '';

    switch (item.tipo) {
      case 'textoLongo':
        return <textarea id={id} rows={3} value={valor} onChange={e => definirValor(item.chave, e.target.value)} style={{ ...entrada, resize: 'vertical' }} />;
      case 'numero':
        return <input id={id} type="number" value={valor} onChange={e => definirValor(item.chave, e.target.value)} style={entrada} />;
      case 'data':
        return <input id={id} type="date" value={valor.substring(0, 10)} onChange={e => definirValor(item.chave, e.target.value)} style={entrada} />;
      case 'simNao':
        return (
          <select id={id} value={valor} onChange={e => definirValor(item.chave, e.target.value)} style={entrada}>
            <option value="">—</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        );
      case 'lista':
        return (
          <select id={id} value={valor} onChange={e => definirValor(item.chave, e.target.value)} style={entrada}>
            <option value="">—</option>
            {(item.opcoes || []).map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
            {valor && (item.opcoes || []).indexOf(valor) < 0 && <option value={valor}>{valor} (valor atual)</option>}
          </select>
        );
      case 'usuario':
        return <CampoUsuarioFluxo id={id} valor={valor} dataverseService={props.dataverseService} onAlterar={novo => definirValor(item.chave, novo)} />;
      case 'documento':
      case 'documentos':
        return (
          <CampoDocumentoFluxo
            id={id}
            valor={valor}
            multiplo={item.tipo === 'documentos'}
            tiposPermitidos={item.opcoes}
            dataverseService={props.dataverseService}
            documentoAtualId={documento.id}
            onAbrirDocumento={props.onAbrirDocumento}
            onAlterar={novo => definirValor(item.chave, novo)}
          />
        );
      case 'tabela':
        return (
          <TabelaCampoFluxo
            id={id}
            rotulo={item.rotulo}
            colunas={item.colunas || []}
            valor={valor}
            onAlterar={novo => definirValor(item.chave, novo)}
          />
        );
      default:
        return <input id={id} type="text" value={valor} onChange={e => definirValor(item.chave, e.target.value)} style={entrada} />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edicao-adm-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, .45)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 16px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '820px',
          background: COR.fundo,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(15, 23, 42, .25)',
          color: COR.azul,
          fontSize: '13.5px'
        }}
      >
        <div style={{ background: COR.azul, color: '#FFFFFF', padding: '14px 20px' }}>
          <strong id="edicao-adm-titulo" style={{ fontSize: '15px' }}>🛡 Edição como administrador</strong>
          <div style={{ fontSize: '12.5px', opacity: 0.85, marginTop: '2px' }}>
            {documento.codigo} — {documento.titulo}{props.revisaoRotulo ? ` · ${props.revisaoRotulo}` : ''}
          </div>
        </div>

        <div style={{ padding: '18px 20px' }}>
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: COR.ambarClaro, color: COR.ambar, marginBottom: '14px', lineHeight: 1.5, fontSize: '12.5px' }}>
            A edição ignora a etapa do fluxo e a regra de quem pode editar. Tudo o que for alterado fica no
            histórico do documento, com o motivo e os valores anteriores. A etapa atual do fluxo não muda.
          </div>

          {/* DADOS DO DOCUMENTO */}
          <section style={secao}>
            <strong style={{ display: 'block', marginBottom: '12px' }}>Dados do documento</strong>

            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <span style={rotulo}>Código</span>
                <div style={{ ...entrada, background: '#F2F4F7', display: 'flex', alignItems: 'center' }} title="O código e o tipo formam a identidade do documento e a pasta no SharePoint.">
                  {documento.codigo}
                </div>
              </div>
              <div>
                <label htmlFor="adm-titulo" style={rotulo}>Título *</label>
                <input id="adm-titulo" type="text" value={titulo} onChange={e => setTitulo(e.target.value)} style={entrada} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label htmlFor="adm-descricao" style={rotulo}>Descrição</label>
              <textarea id="adm-descricao" rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} style={{ ...entrada, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label htmlFor="adm-area" style={rotulo}>Área</label>
                <select id="adm-area" value={areaId} onChange={e => setAreaId(e.target.value)} style={entrada}>
                  {!areaId && <option value="">Selecione</option>}
                  {
                    areas.length === 0 && areaId && (
                      <option value={areaId}>{documento.area || areaId}</option>
                    )
                  }
                  {areas.map(area => <option key={area.id} value={guid(area.id)}>{area.sigla ? `${area.sigla} — ` : ''}{area.nome}</option>)}
                </select>
                {
                  mudancasDocumento['Área'] && (
                    <div style={{ fontSize: '11.5px', color: COR.ambar, marginTop: '4px' }}>
                      Os arquivos já enviados continuam na pasta da área anterior no SharePoint.
                    </div>
                  )
                }
              </div>
              <div>
                <span style={rotulo}>Responsável</span>
                <CampoUsuarioFluxo id="adm-responsavel" valor={responsavel} dataverseService={props.dataverseService} onAlterar={setResponsavel} />
              </div>
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
              Documento ativo
            </label>
          </section>

          {/* METADADOS */}
          <section style={secao}>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Metadados da revisão</strong>
            <div style={{ fontSize: '12px', color: COR.texto2, marginBottom: '12px' }}>
              Todos os campos do fluxo, inclusive os de etapas já concluídas.
            </div>

            {
              carregandoFluxo
                ? <div style={{ color: COR.texto2, fontSize: '12.5px' }}>Carregando os metadados...</div>
                : !instancia || !definicao
                ? <div style={{ color: COR.texto2, fontSize: '12.5px' }}>Esta revisão não tem fluxo iniciado: não há metadados para ajustar.</div>
                : metadados.length === 0
                  ? <div style={{ color: COR.texto2, fontSize: '12.5px' }}>O fluxo desta revisão não tem metadados.</div>
                  : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {
                        metadados.map(item => {
                          const alterado = metadadosAlterados.some(campo => campo.chave === item.chave);
                          return (
                            <div key={item.chave}>
                              <label htmlFor={`adm-campo-${item.chave}`} style={{ ...rotulo, color: alterado ? COR.indigo : COR.texto2 }}>
                                {item.rotulo}{alterado ? ' · alterado' : ''}
                              </label>
                              {editorMetadado(item)}
                            </div>
                          );
                        })
                      }
                    </div>
                  )
            }
          </section>

          {/* MOTIVO */}
          <section style={{ ...secao, marginBottom: 0 }}>
            <label htmlFor="adm-motivo" style={rotulo}>Motivo do ajuste * (fica no histórico)</label>
            <textarea
              id="adm-motivo"
              rows={2}
              value={motivo}
              placeholder="Ex.: correção da referência ao treinamento informada por engano."
              onChange={e => setMotivo(e.target.value)}
              style={{ ...entrada, resize: 'vertical' }}
            />
          </section>

          {erro && <div style={{ marginTop: '12px', color: COR.vermelho, fontSize: '12.5px' }}>{erro}</div>}
          {avisos.length > 0 && <div style={{ marginTop: '12px', color: COR.ambar, fontSize: '12.5px' }}>{avisos.join(' ')}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
          <span style={{ marginRight: 'auto', fontSize: '12px', color: COR.texto2 }}>
            {
              !haMudancas
                ? 'Nenhuma alteração.'
                : `${Object.keys(mudancasDocumento).length + metadadosAlterados.length} alteração(ões)` +
                  (motivo.trim().length < 5 ? ' · informe o motivo' : '')
            }
          </span>
          <button
            type="button"
            disabled={salvando}
            onClick={() => props.onFechar(false)}
            style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${COR.azul}`, background: '#FFFFFF', color: COR.azul, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!podeSalvar}
            onClick={() => { salvar().catch(() => undefined); }}
            style={{ padding: '9px 16px', borderRadius: '8px', border: 0, background: podeSalvar ? COR.azul : '#CBD5E1', color: '#FFFFFF', fontWeight: 700, cursor: podeSalvar ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
          >
            {salvando ? 'Gravando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EdicaoAdministradorModal;
