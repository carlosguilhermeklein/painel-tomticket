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

  if (loading) return <div className="text-gray-600">Carregando chamados...</div>;
  if (error) return <div className="text-red-600">Erro: {error}</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Protocolo</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assunto</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Situação</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data de Criação</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.protocol}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.subject}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {t.department?.name ?? '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {t.situation?.description ?? '—'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {new Date(t.creation_date).toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}