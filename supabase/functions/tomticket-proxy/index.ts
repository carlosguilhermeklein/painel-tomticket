import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const COMPANY_ID = Deno.env.get('TOMTICKET_COMPANY_ID');
const API_TOKEN = Deno.env.get('TOMTICKET_API_TOKEN');

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  // Validate environment variables
  if (!COMPANY_ID || !API_TOKEN) {
    const missing = [];
    if (!COMPANY_ID) missing.push('TOMTICKET_COMPANY_ID');
    if (!API_TOKEN) missing.push('TOMTICKET_API_TOKEN');
    return createErrorResponse(`Variáveis ausentes: ${missing.join(', ')}`, 500);
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/tomticket-proxy', '');
    const searchParams = new URLSearchParams(url.search);
    if (!searchParams.has('company_id')) {
      searchParams.set('company_id', COMPANY_ID);
    }
    const targetUrl = `https://${COMPANY_ID}.tomticket.com/api/v2.0${path}?${searchParams.toString()}`;

    // Include the Authorization header in the request to TomTicket API
    const headers = {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text()
    });

    if (!response.ok) {
      // Log the error details for debugging
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