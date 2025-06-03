import React from 'react';
import { TicketsTable } from './TicketsTable';
import { TicketHeatmap } from './TicketHeatmap';

export function Dashboard() {
  return (
    <div style={{ padding: '1rem' }}>
      <h1>Dashboard de Chamados TomTicket</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Visão Geral (Últimos 30 dias)</h2>
        <TicketsTable />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Heatmap de Chamados (Últimos 7 dias)</h2>
        <TicketHeatmap />
      </section>
    </div>
  );
}