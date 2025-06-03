import { useState, useEffect } from 'react';
import { ticketService } from '../services/api';
import type { Ticket } from '../types';

export function useTicketHeatmap() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 7);

        const data = await ticketService.getTickets(start, end, undefined, undefined, 1, 200);
        setTickets(data);
      } catch (e: any) {
        setError(e.message || 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { tickets, loading, error };
}