import React from 'react';
import { TicketsTable } from './TicketsTable';
import { TicketHeatmap } from './TicketHeatmap';

export function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard de Chamados TomTicket</h1>

      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Visão Geral (Últimos 30 dias)</h2>
        <TicketsTable />
      </section>

      <section className="mb-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Heatmap de Chamados (Últimos 7 dias)</h2>
        <TicketHeatmap />
      </section>
    </div>
  );
}