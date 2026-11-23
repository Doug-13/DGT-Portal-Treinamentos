import * as React from 'react';

import {
  FornecedoresService
} from '../../services/fornecedores/FornecedoresService';

import {
  HomologacaoFluxoService,
  IDisponibilidadeHomologacao,
  IPendenciaHomologacao
} from '../../services/fornecedores/HomologacaoFluxoService';

import {
  IContextoAcesso
} from '../../services/AutorizacaoService';

import {
  IFornecedor
} from '../../services/fornecedores/modeloFornecedores';

import {
  quemResponde
} from './HomologacaoFornecedorView';

import {
  Aviso,
  COR,
  Selo,
  ajuda,
  botao,
  celula,
  celulaCabecalho
} from '../Kits/kitsComum';

// ============================================================
// FORNECEDORES — PENDÊNCIAS ("Aguardando você")
//
// Ciclos de homologação em que o usuário responde a etapa atual do
// fluxo (área Suprimentos ou Jurídico, vínculos em dgt_usuarioarea).
// "Abrir" leva ao fornecedor, aba Homologação: etapa, documentos,
// campos, comentário, botões e histórico do fluxo.
// Ciclo antigo, sem fluxo e sem responsáveis: aparece só para o
// administrador do módulo, para iniciar o fluxo.
// ============================================================

const dataBr = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const diasDesde = (iso: string): number => {
  const t = Date.parse(iso || '');
  return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

const PendenciasHomologacaoView: React.FC<{
  servico: FornecedoresService;
  fluxo: HomologacaoFluxoService;
  contexto: IContextoAcesso;
  fornecedores: IFornecedor[];
  administra: boolean;
  abrir: (fornecedorId: string) => void;
  aoContar?: (quantidade: number) => void;
}> = ({ servico, fluxo, contexto, fornecedores, administra, abrir, aoContar }) => {

  const [pendencias, setPendencias] = React.useState<IPendenciaHomologacao[] | undefined>(undefined);
  const [disponibilidade, setDisponibilidade] = React.useState<IDisponibilidadeHomologacao | undefined>(undefined);
  const [erro, setErro] = React.useState('');

  const carregar = React.useCallback(async (): Promise<void> => {
    setErro('');
    try {
      setDisponibilidade(await fluxo.verificar());
      const r = await servico.listarCiclos(undefined, 0);
      const lista = await fluxo.pendenciasDoUsuario(r.ciclos, contexto, administra);
      setPendencias(lista);
      if (aoContar) {
        aoContar(lista.length);
      }
    } catch (e) {
      setErro(String((e as Error)?.message || e));
    }
  }, [servico, fluxo, contexto, administra, aoContar]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const porId: Record<string, IFornecedor> = {};
  fornecedores.forEach(f => { porId[f.id] = f; });

  return (
    <div>
      {erro && <Aviso tipo="alerta" acao={<button type="button" style={botao('secundario')} onClick={() => { carregar().catch(() => undefined); }}>Tentar de novo</button>}>{erro}</Aviso>}

      {disponibilidade && !disponibilidade.ativo && (
        <Aviso tipo="alerta">Fluxo de homologação indisponível: {disponibilidade.motivo} Sem ele, nenhum ciclo muda de etapa.</Aviso>
      )}

      <div style={{ ...ajuda, marginBottom: '10px' }}>
        Ciclos de homologação em que você responde a etapa atual (pela sua área: Suprimentos ou Jurídico).
        Quem não está vinculado à área em RH e Pessoas não vê a pendência nem recebe o e-mail.
      </div>

      {!pendencias && !erro && <div style={{ padding: '20px', color: COR.texto2 }}>Carregando pendências…</div>}
      {pendencias && pendencias.length === 0 && <Aviso tipo="ok">Nada aguardando você.</Aviso>}

      {pendencias && pendencias.length > 0 && (
        <div style={{ overflowX: 'auto', border: `1px solid ${COR.cinzaClaro}`, borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: COR.branco }}>
            <thead>
              <tr>
                <th style={celulaCabecalho}>Fornecedor</th>
                <th style={celulaCabecalho}>Ciclo</th>
                <th style={celulaCabecalho}>Etapa</th>
                <th style={celulaCabecalho}>Há</th>
                <th style={celulaCabecalho}>Prazo</th>
                <th style={celulaCabecalho}>Responde</th>
                <th style={celulaCabecalho} />
              </tr>
            </thead>
            <tbody>
              {pendencias.map(p => {
                const f = porId[p.ciclo.fornecedorId];
                const atrasado = !!p.ciclo.prazoEtapa && Date.parse(p.ciclo.prazoEtapa) < Date.now();
                return (
                  <tr key={p.ciclo.id}>
                    <td style={{ ...celula, fontWeight: 600 }}>{f ? f.razaoSocial : 'Fornecedor sem acesso'}</td>
                    <td style={celula}>{`Ciclo ${p.ciclo.numero}`}{p.ciclo.protocolo ? ` · ${p.ciclo.protocolo}` : ''}</td>
                    <td style={celula}>
                      {p.ciclo.etapa}
                      {!p.iniciado && <div><Selo tom="azul">fluxo inicia ao abrir</Selo></div>}
                    </td>
                    <td style={celula}>{`${diasDesde(p.ciclo.etapaDesde)} dia(s)`}</td>
                    <td style={celula}>{p.ciclo.prazoEtapa ? <Selo tom={atrasado ? 'indigo' : 'azul'}>{`${atrasado ? '! ' : ''}${dataBr(p.ciclo.prazoEtapa)}`}</Selo> : '—'}</td>
                    <td style={celula}>{quemResponde(p.ciclo) || '—'}</td>
                    <td style={celula}>
                      {f && <button type="button" style={botao('principal')} onClick={() => abrir(f.id)}>Abrir</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendenciasHomologacaoView;
