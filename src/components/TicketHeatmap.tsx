import React from 'react';
import { useTicketHeatmap } from '../hooks/useTicketHeatmap';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export function TicketHeatmap() {
  const { tickets, loading, error } = useTicketHeatmap();

  const agrupados: Record<string, number> = {};
  tickets.forEach((t) => {
    const dia = new Date(t.creation_date).toLocaleDateString();
    agrupados[dia] = (agrupados[dia] || 0) + 1;
  });

  const dataChart = Object.entries(agrupados).map(([dia, qtd]) => ({ dia, qtd }));

  if (loading) return <div>Carregando dados do heatmap…</div>;
  if (error) return <div style={{ color: 'red' }}>Erro: {error}</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dataChart} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dia" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="qtd" name="Chamados" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}