import * as React from 'react';

import {
  CAMERAS_OCR,
  CAMERAS_VIDEO,
  CONTROLADORES_PORTA,
  ESTRUTURAS,
  SWITCHES,
  idCamera,
  idSwitch
} from '../../services/bom/catalogoKits';

import {
  IPontoKit,
  ISelecaoKit,
  ISoftwaresKit,
  TIPOS_PONTO,
  TipoPonto,
  csvDoBom,
  ehBridgefy,
  montarBom,
  novoPonto,
  selecaoVazia
} from '../../services/bom/montadorBom';

import {
  COR,
  FONTE,
  botao,
  campo,
  cartao,
  chip,
  rotulo
} from './arquiteturaComum';

// ============================================================
// ETAPA 3 — SELEÇÃO DE KIT (montador de B.O.M.)
//
// O usuário informa os PONTOS (tipo, nº de câmeras/leitoras e
// quantos pontos iguais) e as SOLUÇÕES de software. A lista de
// itens (código CIGAM + quantidade) é montada pelas regras — modelo
// de câmera, switch e controlador entram com o padrão e podem ser
// trocados no ponto (a troca de switch recalcula as fontes).
// ============================================================

export interface ISelecaoKitEtapaProps {
  selecaoInicial?: ISelecaoKit;
  semColuna: boolean;
  canal: string;
  salvando: boolean;
  somenteLeitura: boolean;
  onSalvar: (selecao: ISelecaoKit, concluir: boolean) => Promise<void>;
}

const numeroCampo = (
  valor: number,
  aoMudar: (n: number) => void,
  minimo = 0,
  maximo = 999,
  desabilitado = false
): React.ReactElement => (
  <input
    type="number"
    min={minimo}
    max={maximo}
    value={valor}
    disabled={desabilitado}
    onChange={e => aoMudar(Math.max(minimo, Math.min(maximo, Math.floor(Number(e.target.value) || 0))))}
    style={{ ...campo, width: '90px' }}
  />
);

const Marcar: React.FC<{ marcado: boolean; texto: string; desabilitado?: boolean; onMudar: (v: boolean) => void; dica?: string }> =
  ({ marcado, texto, desabilitado, onMudar, dica }) => (
    <label title={dica} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: COR.azul, cursor: desabilitado ? 'default' : 'pointer', marginRight: '16px' }}>
      <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={e => onMudar(e.target.checked)} />
      {texto}
    </label>
  );

const SelecaoKitEtapa: React.FC<ISelecaoKitEtapaProps> = ({
  selecaoInicial,
  semColuna,
  canal,
  salvando,
  somenteLeitura,
  onSalvar
}) => {

  const [selecao, setSelecao] =
    React.useState<ISelecaoKit>(selecaoInicial || selecaoVazia());

  const [alterado, setAlterado] =
    React.useState(false);

  const [visao, setVisao] =
    React.useState<'consolidada' | 'porPonto'>('consolidada');

  React.useEffect(() => {
    setSelecao(selecaoInicial || selecaoVazia());
    setAlterado(false);
  }, [selecaoInicial]);

  const resultado = React.useMemo(() => montarBom(selecao), [selecao]);
  const erros = resultado.alertas.filter(a => a.nivel === 'erro');
  const avisos = resultado.alertas.filter(a => a.nivel === 'aviso');
  const temAcesso = selecao.pontos.some(p => !ehBridgefy(p.tipo));
  const bloqueado = somenteLeitura || salvando;

  const mudarSoftwares = (parcial: Partial<ISoftwaresKit>): void => {
    setSelecao(atual => ({ ...atual, softwares: { ...atual.softwares, ...parcial } }));
    setAlterado(true);
  };

  const mudarPonto = (id: string, parcial: Partial<IPontoKit>): void => {
    setSelecao(atual => ({ ...atual, pontos: atual.pontos.map(p => (p.id === id ? { ...p, ...parcial } : p)) }));
    setAlterado(true);
  };

  const adicionarPonto = (tipo: TipoPonto): void => {
    setSelecao(atual => ({
      ...atual,
      pontos: [...atual.pontos, novoPonto(tipo, atual.pontos.filter(p => p.tipo === tipo).length + 1)]
    }));
    setAlterado(true);
  };

  const duplicarPonto = (ponto: IPontoKit): void => {
    setSelecao(atual => ({
      ...atual,
      pontos: [...atual.pontos, { ...ponto, id: novoPonto(ponto.tipo, 0).id, nome: `${ponto.nome} (cópia)` }]
    }));
    setAlterado(true);
  };

  const removerPonto = (id: string): void => {
    setSelecao(atual => ({ ...atual, pontos: atual.pontos.filter(p => p.id !== id) }));
    setAlterado(true);
  };

  const baixarCsv = (): void => {
    const blob = new Blob(['\ufeff' + csvDoBom(resultado)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bom-selecao-kit.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const salvar = (concluir: boolean): void => {
    onSalvar(selecao, concluir)
      .then(() => setAlterado(false))
      .catch(() => undefined);
  };

  const sw = selecao.softwares;

  return (
    <div style={{ fontFamily: FONTE }}>

      {semColuna && (
        <div role="alert" style={{ ...cartao, background: '#FFF4E5', borderColor: '#B45309', color: COR.azul, fontSize: '13px' }}>
          <strong>Configuração pendente:</strong> execute <code>scripts/dataverse/criar-coluna-selecao-kit.ps1</code> para
          poder salvar a seleção de kit. Você pode montar a lista e baixar o CSV mesmo assim.
        </div>
      )}

      {/* ---------------- Softwares ---------------- */}
      <div style={cartao}>
        <h3 style={{ margin: '0 0 4px', color: COR.azul, fontSize: '15px' }}>Soluções de software</h3>
        <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: COR.texto2 }}>
          Canal da demanda: <strong>{canal || '—'}</strong>. Nesta versão a licença Safe City é sempre a de 30 dias
          (3300990057); o código por canal (público/privado) entra numa versão futura.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <span style={{ ...rotulo, display: 'inline', marginRight: '6px', alignSelf: 'center' }}>Videomonitoramento (VMS):</span>
          <button type="button" disabled={bloqueado} style={chip(sw.vms === 'safeCity')} onClick={() => mudarSoftwares({ vms: 'safeCity' })}>
            Safe City (Bridgefy — nuvem)
          </button>
          <button type="button" disabled={bloqueado} style={chip(sw.vms === 'digifort')} onClick={() => mudarSoftwares({ vms: 'digifort' })}>
            Digifort Enterprise (terceiro)
          </button>
        </div>

        {sw.vms === 'digifort' && (
          <div style={{ background: COR.fundo, borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Servidores: {numeroCampo(sw.digifortServidores, n => mudarSoftwares({ digifortServidores: n }), 1, 99, bloqueado)}</span>
              <span style={{ color: COR.texto2 }}>Cada servidor exige a própria base de 8 câmeras; os packs se dividem entre eles.</span>
            </div>
            <div style={{ marginTop: '8px' }}>
              <Marcar marcado={sw.ipx} desabilitado={bloqueado} texto="IPX Analytics (IP Extreme)" onMudar={v => mudarSoftwares({ ipx: v })} dica="Analíticos por IA — roda sobre o Digifort. Licença por câmera e por pacote." />
              {sw.ipx && (
                <>
                  <span style={{ marginRight: '14px' }}>Pacotes de analítico: {numeroCampo(sw.ipxPacotes, n => mudarSoftwares({ ipxPacotes: n }), 1, 9, bloqueado)}</span>
                  <Marcar marcado={sw.ipxIntegracao} desabilitado={bloqueado} texto="Licença de integração (servidor de terceiros)" onMudar={v => mudarSoftwares({ ipxIntegracao: v })} dica="Decisão pendente sobre ser obrigatória — código a levantar." />
                </>
              )}
            </div>
          </div>
        )}

        <div>
          <Marcar marcado={sw.smartDetect} desabilitado={bloqueado || sw.vms !== 'safeCity'} texto="Smart Detect (módulo do Safe City — sem licença própria)" onMudar={v => mudarSoftwares({ smartDetect: v })} />
          <Marcar marcado={sw.faceDetect} desabilitado={bloqueado} texto="Face Detect (1 licença por câmera de vídeo)" onMudar={v => mudarSoftwares({ faceDetect: v })} />
        </div>
        <div style={{ fontSize: '12px', color: COR.texto2, marginTop: '6px' }}>
          Safe Way entra automaticamente com as câmeras OCR/LPR: <strong>1 licença por faixa monitorada</strong>.
          Safe City e Safe Way nunca usam a mesma câmera — ponto com vídeo e placas leva duas.
        </div>

        {temAcesso && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${COR.borda}`, display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '13px', alignItems: 'center' }}>
            <strong style={{ color: COR.azul }}>Invenzi W-Access</strong>
            <span>Cadastros de face: {numeroCampo(sw.waccessCadastros, n => mudarSoftwares({ waccessCadastros: n }), 0, 999999, bloqueado)}</span>
            <span>Canais de visualização: {numeroCampo(sw.waccessCanais, n => mudarSoftwares({ waccessCanais: n }), 0, 999, bloqueado)}</span>
          </div>
        )}
      </div>

      {/* ---------------- Pontos ---------------- */}
      <div style={cartao}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: COR.azul, fontSize: '15px' }}>
            Pontos ({resultado.totais.pontos} · {resultado.totais.camerasVideo} câm. vídeo · {resultado.totais.camerasOcr} OCR · {resultado.totais.leitoras} leitoras)
          </h3>
        </div>

        {!somenteLeitura && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {TIPOS_PONTO.map(t => (
              <button key={t.tipo} type="button" style={chip(false)} disabled={bloqueado} onClick={() => adicionarPonto(t.tipo)}>
                + {t.nome}
              </button>
            ))}
          </div>
        )}

        {selecao.pontos.length === 0 && (
          <div style={{ fontSize: '13px', color: COR.texto2 }}>
            Adicione os pontos do projeto. O modelo dos equipamentos não é escolhido agora: entra o padrão e pode ser trocado no ponto.
          </div>
        )}

        {selecao.pontos.map(ponto => {
          const bridgefy = ehBridgefy(ponto.tipo);
          const estrutura = bridgefy ? ESTRUTURAS[ponto.tipo as 'torre' | 'box' | 'mini'] : undefined;
          const erroPonto = erros.filter(e => e.origem === ponto.nome);

          return (
            <div key={ponto.id} style={{ border: `1px solid ${erroPonto.length ? '#F3B8B3' : COR.borda}`, borderRadius: '10px', padding: '12px 14px', marginBottom: '10px', background: erroPonto.length ? '#FFFBFA' : '#FFFFFF' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label style={rotulo}>{(TIPOS_PONTO.find(t => t.tipo === ponto.tipo) || { nome: '' }).nome}</label>
                  <input value={ponto.nome} disabled={bloqueado} onChange={e => mudarPonto(ponto.id, { nome: e.target.value })} style={campo} />
                </div>
                <div>
                  <label style={rotulo}>Pontos iguais</label>
                  {numeroCampo(ponto.quantidade, n => mudarPonto(ponto.id, { quantidade: n }), 1, 999, bloqueado)}
                </div>

                {bridgefy && estrutura && (
                  <>
                    <div>
                      <label style={rotulo}>Câm. vídeo</label>
                      {numeroCampo(ponto.camerasVideo, n => mudarPonto(ponto.id, { camerasVideo: n }), 0, estrutura.maxCameras, bloqueado)}
                    </div>
                    {estrutura.aceitaOcr && (
                      <>
                        <div>
                          <label style={rotulo}>Câm. OCR/LPR</label>
                          {numeroCampo(ponto.camerasOcr, n => mudarPonto(ponto.id, { camerasOcr: n }), 0, estrutura.maxCameras, bloqueado)}
                        </div>
                        <div>
                          <label style={rotulo} title="Licença Safe Way é por faixa monitorada">Faixas por OCR</label>
                          {numeroCampo(ponto.faixasPorOcr, n => mudarPonto(ponto.id, { faixasPorOcr: n }), 1, 4, bloqueado || ponto.camerasOcr === 0)}
                        </div>
                      </>
                    )}
                  </>
                )}

                {ponto.tipo === 'catraca' && (
                  <>
                    <div>
                      <label style={rotulo}>Catracas CAP3100</label>
                      {numeroCampo(ponto.catracas, n => mudarPonto(ponto.id, { catracas: n }), 0, 20, bloqueado)}
                    </div>
                    <div>
                      <label style={rotulo}>Catracas PNE</label>
                      {numeroCampo(ponto.catracasPne, n => mudarPonto(ponto.id, { catracasPne: n }), 0, 10, bloqueado)}
                    </div>
                  </>
                )}

                {!somenteLeitura && (
                  <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                    <button type="button" style={botao('secundario', bloqueado)} disabled={bloqueado} onClick={() => duplicarPonto(ponto)}>Duplicar</button>
                    <button type="button" style={botao('secundario', bloqueado)} disabled={bloqueado} onClick={() => removerPonto(ponto.id)}>Remover</button>
                  </div>
                )}
              </div>

              {/* opções e campos editáveis (padrão já preenchido) */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center', fontSize: '13px' }}>
                {bridgefy && (
                  <>
                    {ponto.camerasVideo > 0 && (
                      <select value={ponto.modeloVideo} disabled={bloqueado} onChange={e => mudarPonto(ponto.id, { modeloVideo: e.target.value })} style={{ ...campo, width: 'auto' }} title="Modelo da câmera de vídeo">
                        {CAMERAS_VIDEO.map(c => (
                          <option key={idCamera(c)} value={idCamera(c)}>
                            {c.modelo} · {c.formato}{c.zoomOptico ? ' · zoom' : ''}{c.codigo ? '' : ' · sem código'}
                          </option>
                        ))}
                      </select>
                    )}
                    {ponto.camerasOcr > 0 && estrutura && estrutura.aceitaOcr && (
                      <select value={ponto.modeloOcr} disabled={bloqueado} onChange={e => mudarPonto(ponto.id, { modeloOcr: e.target.value })} style={{ ...campo, width: 'auto' }} title="Modelo da câmera OCR/LPR">
                        {CAMERAS_OCR.map(c => <option key={idCamera(c)} value={idCamera(c)}>{c.modelo}</option>)}
                      </select>
                    )}
                    <select value={ponto.switchId} disabled={bloqueado} onChange={e => mudarPonto(ponto.id, { switchId: e.target.value })} style={{ ...campo, width: 'auto' }} title="A troca de switch recalcula as fontes">
                      {SWITCHES.map(s => <option key={idSwitch(s)} value={idSwitch(s)}>{s.modelo}{s.codigo ? '' : ' · sem código'}</option>)}
                    </select>
                    {ponto.tipo !== 'box' && (
                      <Marcar marcado={ponto.pontoAlto} desabilitado={bloqueado} texto="Instalação alta (Face Detect exige zoom)" onMudar={v => mudarPonto(ponto.id, { pontoAlto: v })} />
                    )}
                    {ponto.tipo === 'torre' && (
                      <Marcar marcado={ponto.comunicacaoBidirecional} desabilitado={bloqueado} texto="Comunicação bidirecional (torre de emergência)" onMudar={v => mudarPonto(ponto.id, { comunicacaoBidirecional: v })} />
                    )}
                  </>
                )}

                {(ponto.tipo === 'portaEletroduto' || ponto.tipo === 'portaDutotec') && (
                  <>
                    <select value={ponto.controladorPorta} disabled={bloqueado} onChange={e => mudarPonto(ponto.id, { controladorPorta: e.target.value })} style={{ ...campo, width: 'auto' }} title="Controlador de acesso facial">
                      {CONTROLADORES_PORTA.map(c => <option key={c.codigo} value={c.codigo}>{c.modelo}</option>)}
                    </select>
                    <Marcar marcado={ponto.usaWAccess} desabilitado={bloqueado} texto="Usa W-Access" onMudar={v => mudarPonto(ponto.id, { usaWAccess: v })} />
                    {ponto.tipo === 'portaDutotec' && (
                      <Marcar marcado={ponto.portaVidro} desabilitado={bloqueado} texto="Porta de vidro (suporte SV 21/22)" onMudar={v => mudarPonto(ponto.id, { portaVidro: v })} />
                    )}
                  </>
                )}

                {ponto.tipo === 'catraca' && (
                  <Marcar marcado={ponto.usaWAccess} desabilitado={bloqueado} texto="Usa W-Access" onMudar={v => mudarPonto(ponto.id, { usaWAccess: v })} />
                )}
              </div>

              {erroPonto.map((e, i) => (
                <div key={i} style={{ marginTop: '8px', fontSize: '12.5px', color: '#B42318', fontWeight: 700 }}>✕ {e.mensagem}</div>
              ))}
            </div>
          );
        })}
      </div>

      {/* ---------------- Validações ---------------- */}
      {(erros.length > 0 || avisos.length > 0) && (
        <div style={{ ...cartao, background: erros.length ? '#FDE7E9' : '#FFF4E5', borderColor: erros.length ? '#F3B8B3' : '#F5D7A8' }}>
          <h3 style={{ margin: '0 0 8px', color: COR.azul, fontSize: '14px' }}>
            Validações — {erros.length} erro(s), {avisos.length} aviso(s)
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: COR.azul, lineHeight: 1.6 }}>
            {erros.map((a, i) => <li key={`e${i}`} style={{ color: '#B42318' }}><strong>{a.origem}:</strong> {a.mensagem}</li>)}
            {avisos.map((a, i) => <li key={`a${i}`}><strong>{a.origem}:</strong> {a.mensagem}</li>)}
          </ul>
        </div>
      )}

      {/* ---------------- Lista montada ---------------- */}
      <div style={cartao}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: COR.azul, fontSize: '15px' }}>
            Lista montada ({resultado.itens.length} itens)
          </h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" style={chip(visao === 'consolidada')} onClick={() => setVisao('consolidada')}>Consolidada</button>
            <button type="button" style={chip(visao === 'porPonto')} onClick={() => setVisao('porPonto')}>Por ponto</button>
            <button type="button" style={botao('secundario', resultado.itens.length === 0)} disabled={resultado.itens.length === 0} onClick={baixarCsv}>Baixar CSV</button>
          </div>
        </div>

        {resultado.itens.length === 0 && (
          <div style={{ fontSize: '13px', color: COR.texto2 }}>A lista aparece aqui conforme os pontos forem adicionados.</div>
        )}

        {resultado.itens.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ background: COR.fundo, color: COR.azul, textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Código CIGAM</th>
                  <th style={{ padding: '8px' }}>Descrição</th>
                  <th style={{ padding: '8px' }}>Categoria</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Qtd</th>
                  {visao === 'consolidada' && <th style={{ padding: '8px' }}>Origem</th>}
                </tr>
              </thead>
              <tbody>
                {(visao === 'consolidada'
                  ? [{ titulo: '', itens: resultado.itens }]
                  : resultado.porPonto.map(g => ({ titulo: g.ponto.id === 'softwares' ? g.ponto.nome : `${g.ponto.nome} × ${g.ponto.quantidade}`, itens: g.itens }))
                ).map((grupo, gi) => (
                  <React.Fragment key={gi}>
                    {grupo.titulo && (
                      <tr><td colSpan={4} style={{ padding: '10px 8px 4px', fontWeight: 800, color: COR.indigo }}>{grupo.titulo}</td></tr>
                    )}
                    {grupo.itens.map((i, ii) => (
                      <tr key={`${gi}-${ii}`} style={{ borderTop: `1px solid ${COR.borda}`, background: i.pendente ? '#FFF4E5' : undefined }}>
                        <td style={{ padding: '6px 8px', fontFamily: 'Consolas, monospace', whiteSpace: 'nowrap' }}>
                          {i.codigo || <span style={{ color: '#B45309', fontWeight: 700 }}>sem código</span>}
                        </td>
                        <td style={{ padding: '6px 8px' }}>{i.descricao}</td>
                        <td style={{ padding: '6px 8px', color: COR.texto2 }}>{i.categoria}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{i.quantidade.toLocaleString('pt-BR')}</td>
                        {visao === 'consolidada' && <td style={{ padding: '6px 8px', color: COR.texto2, fontSize: '11.5px' }}>{i.origem}</td>}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Ações ---------------- */}
      {!somenteLeitura && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {alterado && <span style={{ alignSelf: 'center', fontSize: '12.5px', color: '#B45309' }}>Alterações não salvas</span>}
          <button type="button" style={botao('secundario', salvando || semColuna)} disabled={salvando || semColuna} onClick={() => salvar(false)}>
            Salvar rascunho
          </button>
          <button
            type="button"
            style={botao('principal', salvando || semColuna || erros.length > 0 || selecao.pontos.length === 0)}
            disabled={salvando || semColuna || erros.length > 0 || selecao.pontos.length === 0}
            title={erros.length > 0 ? 'Corrija os erros das validações para concluir' : undefined}
            onClick={() => salvar(true)}
          >
            Concluir seleção de kit →
          </button>
        </div>
      )}
    </div>
  );
};

export default SelecaoKitEtapa;
