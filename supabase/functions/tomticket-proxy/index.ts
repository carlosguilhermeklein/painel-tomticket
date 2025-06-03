// supabase/functions/tomticket-proxy/index.ts polenta

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Estas duas variáveis devem estar definidas nos "Settings → Secrets" da sua Function
const COMPANY_ID = Deno.env.get('TOMTICKET_COMPANY_ID');
const API_TOKEN = Deno.env.get('TOMTICKET_API_TOKEN');

// Headers para permitir CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

const createErrorResponse = (msg: string, status = 500) =>
  new Response(JSON.stringify({ error: msg, status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status
  });

// Base correta da TomTicket API (v2.0)
const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

serve(async (req) => {
  // 1) Responde OPTIONS imediatamente (CORS Preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  // 2) Verifica se as vars de ambiente estão definidas
  if (!COMPANY_ID || !API_TOKEN) {
    const missing = [];
    if (!COMPANY_ID) missing.push('TOMTICKET_COMPANY_ID');
    if (!API_TOKEN) missing.push('TOMTICKET_API_TOKEN');
    return createErrorResponse(`Variáveis ausentes: ${missing.join(', ')}`, 500);
  }

  try {
    const url = new URL(req.url);
    // remove o prefixo “/functions/v1/tomticket-proxy” para obter apenas a rota da TomTicket
    // ex: se o front chamar "/functions/v1/tomticket-proxy/ticket/list", o "path" ficará "/ticket/list"
    const path = url.pathname.replace('/functions/v1/tomticket-proxy', '');

    // Reconstrói os query params que chegaram do cliente
    const searchParams = new URLSearchParams(url.search);
    // garante que "company_id" esteja presente nos query params
    if (!searchParams.has('company_id')) {
      searchParams.set('company_id', COMPANY_ID);
    }

    // Monta a URL final da TomTicket, por exemplo:
    // https://api.tomticket.com/v2.0/ticket/list?company_id=EP26529&start=...&end=...
    const targetUrl = `${TOMTICKET_API_URL}${path}?${searchParams.toString()}`;

    // Prepara os headers para repassar à TomTicket
    const headers = {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // Faz o fetch para a TomTicket
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      // se não for GET/HEAD, encaminha o body original (JSON)
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text()
    });

    if (!response.ok) {
      // Em caso de erro 4xx ou 5xx da TomTicket, já devolve JSON de erro
      console.error('TomTicket API Error:', {
        status: response.status,
        statusText: response.statusText,
        url: targetUrl
      });
      return createErrorResponse(
        `TomTicket API Error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    // Lê o texto bruto da TomTicket e devolve para o front com CORS e mesmo content-type
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    });
  } catch (err) {
    console.error('Erro na proxy:', err);
    return createErrorResponse('Erro inesperado na proxy', 500);
  }
});
