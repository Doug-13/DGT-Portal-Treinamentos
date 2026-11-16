import * as React from 'react';

import {
  FornecedoresService,
  IDadosHomologacao
} from '../../services/fornecedores/FornecedoresService';

import {
  CLASSIFICACOES_RISCO,
  ClassificacaoRisco,
  IdVerificacao,
  IFornecedor,
  IVerificacao,
  RESULTADOS_HOMOLOGACAO,
  ResultadoHomologacao,
  VERIFICACOES_HOMOLOGACAO
} from '../../services/fornecedores/modeloFornecedores';

import {
  ISituacaoDocumental
} from '../../services/fornecedores/situacaoDocumental';

import {
  SituacaoVerificacao,
  statusPeloResultado,
  sugerirVerificacoes
} from '../../services/fornecedores/homologacao';

import {
  Aviso,
  COR,
  CampoMotivo,
  Selo,
  TomSelo,
  ajuda,
  botao,
  campo,
  celula,
  celulaCabecalho,
  painel,
  rotulo
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — HOMOLOGAÇÃO (item 9 da Ficha SUP-CPL-01)
//
// Fluxo (Suprimentos + Jurídico):
//   1. Fornecedor responde o formulário → "Em homologação" + protocolo
//   2. Envia por e-mail os documentos que a API não traz
//   3. Analista revisa; o sistema roda as consultas
//   4. Ficha consolidada assinada pelo fornecedor (Clicksign)
//   5. Jurídico aprova
//   6. Resultado aqui → Homologado (ou Reprovado)
// O contrato só sai quando uma demanda fechar (fora deste módulo).
//
// Só o administrador do módulo grava. As sugestões automáticas são
// apoio: quem marca "OK" é a pessoa responsável.
// ============================================================

const TOM: Record<SituacaoVerificacao, TomSelo> = {
  ok: 'ciano',
  atencao: 'indigo',
  pendente: 'azul',
  manual: 'cinza'
};

const ROTULO: Record<SituacaoVerificacao, string> = {
  ok: '✓ sistema: ok',
  atencao: '! atenção',
  pendente: 'pendente',
  manual: 'manual'
};

const hojeIso = (): string => {
  const d = new Date();
  const m = String(d.getMonth() + 1);
  const dia = String(d.getDate());
  return `${d.getFullYear()}-${m.length < 2 ? '0' + m : m}-${dia.length < 2 ? '0' + dia : dia}`;
};

const HomologacaoFornecedorView: React.FC<{
  servico: FornecedoresService;
  fornecedor: IFornecedor;
  situacao: ISituacaoDocumental;
  administra: boolean;
  usuarioNome: string;
  aoAlterar: (aviso?: string) => Promise<void>;
}> = ({ servico, fornecedor, situacao, administra, usuarioNome, aoAlterar }) => {

  const inicial = (): IDadosHomologacao => ({
    classificacaoRisco: fornecedor.classificacaoRisco,
    resultadoHomologacao: fornecedor.resultadoHomologacao || 'Pendente',
    ressalvas: fornecedor.ressalvas,
    validadeCadastro: fornecedor.validadeCadastro,
    verificacoes: { ...fornecedor.verificacoes },
    responsavelSuprimentos: fornecedor.responsavelSuprimentos,
    responsavelCompliance: fornecedor.responsavelCompliance,
    bancarioConferido: fornecedor.bancarioConferido
  });

  const [d, setD] = React.useState<IDadosHomologacao>(inicial);
  const [motivo, setMotivo] = React.useState('');
  const [gravando, setGravando] = React.useState(false);
  const [erro, setErro] = React.useState('');

  // Recarregou o fornecedor (outra aba gravou): reinicia o formulário.
  React.useEffect(() => {
    setD(inicial());
    setMotivo('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fornecedor]);

  const sugestoes = sugerirVerificacoes(fornecedor, situacao);
  const mudar = (parcial: Partial<IDadosHomologacao>): void => setD(a => ({ ...a, ...parcial }));

  const mudarVerificacao = (id: IdVerificacao, ok: boolean): void =>
    setD(a => {
      const atual: IVerificacao = a.verificacoes[id] || { ok: false, data: '', responsavel: '' };
      return {
        ...a,
        verificacoes: {
          ...a.verificacoes,
          [id]: ok ? { ok: true, data: atual.data || hojeIso(), responsavel: atual.responsavel || usuarioNome } : { ok: false, data: '', responsavel: '' }
        }
      };
    });

  const statusDepois = statusPeloResultado(d.resultadoHomologacao, fornecedor.status);
  const pendentesFluxo = situacao.pendencias.length;

  const salvar = async (): Promise<void> => {
    setGravando(true);
    setErro('');
    try {
      const status = await servico.salvarHomologacao(fornecedor, d, motivo, usuarioNome);
      setMotivo('');
      await aoAlterar(status !== fornecedor.status ? `Homologação salva. Status: ${status}.` : 'Homologação salva.');
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    } finally {
      setGravando(false);
    }
  };

  const etapas: Array<{ texto: string; feito: boolean; detalhe: string }> = [
    { texto: 'Ficha recebida (formulário)', feito: !!fornecedor.fichaRecebidaEm, detalhe: fornecedor.protocolo || 'sem protocolo' },
    { texto: 'Documentos enviados', feito: pendentesFluxo === 0, detalhe: pendentesFluxo ? `${pendentesFluxo} pendência(s) na aba Documentos` : 'sem pendências' },
    { texto: 'Consultas (Receita, sanções, certidões)', feito: !!fornecedor.situacaoCadastral && fornecedor.resultadoSancoes !== 'Não consultado' && fornecedor.resultadoCertidoes !== 'Não consultado', detalhe: `sanções: ${fornecedor.resultadoSancoes} · certidões: ${fornecedor.resultadoCertidoes}` },
    { texto: 'Ficha assinada pelo fornecedor (Clicksign)', feito: /assinad/i.test(fornecedor.assinaturaStatus), detalhe: fornecedor.assinaturaStatus || 'integração aguardando o token' },
    { texto: 'Aprovação do Jurídico', feito: !!fornecedor.responsavelCompliance, detalhe: fornecedor.responsavelCompliance || 'registre abaixo quem aprovou e quando' },
    { texto: 'Resultado da homologação', feito: fornecedor.resultadoHomologacao === 'Aprovado' || fornecedor.resultadoHomologacao === 'Aprovado com ressalvas', detalhe: fornecedor.resultadoHomologacao || 'Pendente' }
  ];

  const somenteLeitura = !administra;

  return (
    <div>
      <div style={{ ...painel, marginBottom: '12px' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Fluxo</div>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.8 }}>
          {etapas.map(e => (
            <li key={e.texto}>
              <span style={{ fontWeight: 600 }}>{e.feito ? '✓ ' : ''}{e.texto}</span>
              <span style={{ color: COR.texto2 }}> — {e.detalhe}</span>
            </li>
          ))}
        </ol>
        <div style={ajuda}>O contrato é emitido só quando uma demanda fechar, assinado por Jurídico, Suprimentos, comprador e prestador.</div>
      </div>

      {somenteLeitura && <Aviso tipo="info">Somente o administrador do módulo grava a homologação. Você vê o andamento e as sugestões do sistema.</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}

      <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px', marginBottom: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
          <thead>
            <tr>
              <th style={celulaCabecalho}>Verificação</th>
              <th style={celulaCabecalho}>O que o sistema encontrou</th>
              <th style={celulaCabecalho}>OK</th>
              <th style={celulaCabecalho}>Data</th>
              <th style={celulaCabecalho}>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {VERIFICACOES_HOMOLOGACAO.map(v => {
              const s = sugestoes[v.id];
              const marcada = d.verificacoes[v.id];
              return (
                <tr key={v.id}>
                  <td style={celula}>
                    <div style={{ fontWeight: 600 }}>{v.rotulo}</div>
                    <div style={{ fontSize: '12px', color: COR.texto2 }}>{v.fonte}</div>
                  </td>
                  <td style={celula}>
                    <Selo tom={TOM[s.situacao]}>{ROTULO[s.situacao]}</Selo>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>{s.texto}</div>
                  </td>
                  <td style={celula}>
                    <input type="checkbox" aria-label={`OK: ${v.rotulo}`} disabled={somenteLeitura} checked={!!marcada && marcada.ok} onChange={e => mudarVerificacao(v.id, e.target.checked)} />
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? <input type="date" aria-label={`Data: ${v.rotulo}`} disabled={somenteLeitura} style={{ ...campo, width: '150px' }} value={marcada.data}
                        onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, data: e.target.value } } })} />
                      : '—'}
                  </td>
                  <td style={celula}>
                    {marcada && marcada.ok
                      ? <input aria-label={`Responsável: ${v.rotulo}`} disabled={somenteLeitura} style={{ ...campo, minWidth: '160px' }} value={marcada.responsavel}
                        onChange={e => mudar({ verificacoes: { ...d.verificacoes, [v.id]: { ...marcada, responsavel: e.target.value } } })} />
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={painel}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 14px' }}>
          <div>
            <label style={rotulo} htmlFor="hm-risco">Classificação de risco</label>
            <select id="hm-risco" style={campo} disabled={somenteLeitura} value={d.classificacaoRisco} onChange={e => mudar({ classificacaoRisco: e.target.value as ClassificacaoRisco })}>
              {CLASSIFICACOES_RISCO.map(r => <option key={r} value={r}>{r || 'Não definida'}</option>)}
            </select>
            <div style={ajuda}>Natureza, porte e complexidade do fornecimento; porte, governança e tradição do fornecedor.</div>
          </div>
          <div>
            <label style={rotulo} htmlFor="hm-resultado">Resultado da homologação</label>
            <select id="hm-resultado" style={campo} disabled={somenteLeitura} value={d.resultadoHomologacao} onChange={e => mudar({ resultadoHomologacao: e.target.value as ResultadoHomologacao })}>
              {RESULTADOS_HOMOLOGACAO.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {statusDepois !== fornecedor.status && <div style={ajuda}>Ao salvar, o status muda para “{statusDepois}”.</div>}
          </div>
          <div>
            <label style={rotulo} htmlFor="hm-validade">Validade do cadastro / próxima revisão</label>
            <input id="hm-validade" type="date" style={campo} disabled={somenteLeitura} value={d.validadeCadastro} onChange={e => mudar({ validadeCadastro: e.target.value })} />
          </div>
        </div>

        <label style={rotulo} htmlFor="hm-ressalvas">Ressalvas, medidas de mitigação ou referência ao parecer</label>
        <textarea id="hm-ressalvas" style={{ ...campo, resize: 'vertical' }} rows={3} disabled={somenteLeitura} value={d.ressalvas} onChange={e => mudar({ ressalvas: e.target.value })} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px 14px' }}>
          <div>
            <label style={rotulo} htmlFor="hm-sup">Responsável Suprimentos / data</label>
            <input id="hm-sup" style={campo} disabled={somenteLeitura} value={d.responsavelSuprimentos} onChange={e => mudar({ responsavelSuprimentos: e.target.value })} placeholder="Nome — dd/mm/aaaa" />
          </div>
          <div>
            <label style={rotulo} htmlFor="hm-jur">Compliance / Jurídico (se acionado)</label>
            <input id="hm-jur" style={campo} disabled={somenteLeitura} value={d.responsavelCompliance} onChange={e => mudar({ responsavelCompliance: e.target.value })} placeholder="Nome — dd/mm/aaaa" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '13.5px' }}>
          <input type="checkbox" disabled={somenteLeitura} checked={d.bancarioConferido} onChange={e => mudar({ bancarioConferido: e.target.checked })} />
          Dados bancários confirmados por contato telefônico independente (número obtido fora da ficha)
        </label>

        {!somenteLeitura && (
          <>
            <CampoMotivo valor={motivo} aoMudar={setMotivo} desabilitado={gravando} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" style={botao('secundario', gravando)} disabled={gravando} onClick={() => { setD(inicial()); setMotivo(''); }}>Desfazer</button>
              <button type="button" style={botao('principal', gravando || !motivo.trim())} disabled={gravando || !motivo.trim()} onClick={() => { salvar().catch(() => undefined); }}>
                {gravando ? 'Salvando…' : 'Salvar homologação'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HomologacaoFornecedorView;
