import React, { useEffect, useState } from 'react';
import { ticketService } from '../services/api';
import type { Ticket } from '../types';

export function TicketsTable() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);

        const data = await ticketService.getTickets(start, end, undefined, undefined, 1, 50);
        setTickets(data);
      } catch (e: any) {
        setError(e.message || 'Erro ao buscar chamados');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div>Carregando chamados…</div>;
  if (error) return <div style={{ color: 'red' }}>Erro: {error}</div>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>Protocolo</th>
          <th>Assunto</th>
          <th>Departamento</th>
          <th>Situação</th>
          <th>Data de Criação</th>
          <th>Prioridade</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr key={t.id}>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{t.protocol}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{t.subject}</td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {t.department?.name ?? '—'}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {t.situation?.description ?? '—'}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
              {new Date(t.creation_date).toLocaleString()}
            </td>
            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{t.priority}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}