import * as React from 'react';

import { IAreaHHCarregada } from '../../services/hh/HHService';
import { Selo, TomSelo, formatarDataHora } from '../Kits/kitsComum';

import { COR, Secao, Tabela, moeda, pct, td } from './hhComum';

// ============================================================
// HH — VERSÕES E HISTÓRICO
// Nada é apagado: cada publicação é uma versão; o rascunho descartado
// fica como "Substituído".
// ============================================================

const TOM: Record<string, TomSelo> = { Vigente: 'ciano', Rascunho: 'indigo', 'Substituído': 'cinza' };

const VersoesHH: React.FC<{ carga: IAreaHHCarregada; podeEditar: boolean; aoAbrir: (id: string) => Promise<void> }> = ({ carga, podeEditar, aoAbrir }) => (
  <div>
    <Secao titulo="Versões" subtitulo="O B.O.M. usa a versão Vigente. Abra uma versão antiga para conferir ou para usá-la como base de um novo rascunho.">
      {carga.versoes.length === 0
        ? <div style={{ color: COR.texto2, fontSize: '14px' }}>Nenhuma versão gravada.</div>
        : (
          <Tabela colunas={[{ titulo: 'Versão', direita: true }, { titulo: 'Situação' }, { titulo: 'Mês ref.' }, { titulo: 'HH por ponto', direita: true }, { titulo: '% fixo', direita: true }, { titulo: 'Publicada por' }, { titulo: 'Publicação' }, { titulo: 'Motivo' }, { titulo: '' }]}>
            {carga.versoes.map(v => (
              <tr key={v.id}>
                <td style={td(true, { fontWeight: 700 })}>{v.versao}</td>
                <td style={td()}><Selo tom={TOM[v.status] || 'cinza'}>{v.status}</Selo></td>
                <td style={td()}>{v.mesReferencia}</td>
                <td style={td(true)}>{moeda(v.hhPorPonto)}</td>
                <td style={td(true)}>{pct(v.pctFixo)}</td>
                <td style={td()}>{v.publicadoPor || (v.status === 'Rascunho' ? `(${v.alteradoPor})` : '—')}</td>
                <td style={td()}>{v.dataPublicacao ? formatarDataHora(v.dataPublicacao) : '—'}</td>
                <td style={td(false, { fontSize: '13px', color: COR.texto2 })}>{v.motivo}</td>
                <td style={td(true)}>
                  {podeEditar && v.status !== 'Rascunho' && (
                    <button type="button" onClick={() => { aoAbrir(v.id).catch(() => undefined); }} style={{ border: `1px solid ${COR.cinzaClaro}`, background: COR.branco, color: COR.azul, borderRadius: '6px', padding: '4px 10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Abrir</button>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        )}
    </Secao>

    <Secao titulo="Histórico de alterações">
      {carga.alteracoes.length === 0
        ? <div style={{ color: COR.texto2, fontSize: '14px' }}>Sem registros.</div>
        : (
          <Tabela colunas={[{ titulo: 'Quando' }, { titulo: 'Ação' }, { titulo: 'Versão', direita: true }, { titulo: 'O que' }, { titulo: 'Motivo' }, { titulo: 'Quem' }]}>
            {carga.alteracoes.map(a => (
              <tr key={a.id}>
                <td style={td(false, { whiteSpace: 'nowrap' })}>{formatarDataHora(a.data)}</td>
                <td style={td()}>{a.acao}</td>
                <td style={td(true)}>{a.versao}</td>
                <td style={td()}>{a.resumo}</td>
                <td style={td(false, { fontSize: '13px', color: COR.texto2 })}>{a.motivo}</td>
                <td style={td()}>{a.usuarioNome}</td>
              </tr>
            ))}
          </Tabela>
        )}
    </Secao>
  </div>
);

export default VersoesHH;
