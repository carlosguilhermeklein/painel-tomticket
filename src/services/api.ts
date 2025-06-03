// src/services/api.ts

import axios from 'axios';
import type { Ticket, Department, Customer } from '../types';

// Cria o client Axios apontando para a Edge Function "tomticket-proxy"
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomticket-proxy`,
  headers: {
    'Content-Type': 'application/json',
    // A única autenticação do front para a função é a chave anon do Supabase
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
  }
});

// Cache simples para evitar chamadas repetidas em curto intervalo
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Fila para espaçar (rate-limit ≈ 3 req/s)
let requestQueue: Promise<any> = Promise.resolve();
const REQUEST_DELAY = 350; // 350ms

// Intercepta resposta e faz log de erros comuns
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Não autorizado. Verifique se a Edge Function está enviando Authorization.');
      } else if (error.response.status === 429) {
        console.error('Rate limit atingido. Aguardando para reenviar.');
      } else {
        console.error('API Error:', error.response.data);
      }
    } else if (error.request) {
      console.error('Network Error:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Função genérica de requisição com cache + enfileiramento
const cachedRequest = async <T>(
  method: 'get' | 'post',
  url: string,
  data?: object,
  params?: object
): Promise<T> => {
  const cacheKey = `${method}-${url}-${JSON.stringify(data || {})}-${JSON.stringify(params || {})}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const queuedRequest: Promise<T> = new Promise((resolve, reject) => {
    requestQueue = requestQueue
      .then(() => new Promise((r) => setTimeout(r, REQUEST_DELAY)))
      .then(async () => {
        try {
          const resp = await apiClient.request<T>({ method, url, data, params });
          cache.set(cacheKey, { data: resp.data, timestamp: Date.now() });
          resolve(resp.data);
        } catch (err) {
          reject(err);
        }
      });
  });

  return queuedRequest;
};

// Serviços específicos usando o cachedRequest
export const ticketService = {
  // POST → /ticket/list
  getTickets: async (
    startDate?: Date,
    endDate?: Date,
    status?: string,
    departmentId?: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<Ticket[]> => {
    const body: Record<string, any> = {
      start: startDate?.toISOString(),
      end: endDate?.toISOString(),
      status,
      department_id: departmentId,
      page,
      pageSize
    };
    // Remove campos indefinidos
    Object.keys(body).forEach((k) => body[k] == null && delete body[k]);

    // Chamamos apenas "/ticket/list" pois o baseURL acima já aponta para o proxy
    return cachedRequest<Ticket[]>('post', '/ticket/list', body);
  },

  // GET → /ticket/detail/:id
  getTicketDetails: async (ticketId: string): Promise<Ticket> => {
    return cachedRequest<Ticket>('get', `/ticket/detail/${ticketId}`);
  }
};

export const departmentService = {
  getDepartments: async (): Promise<Department[]> => {
    return cachedRequest<Department[]>('get', '/departments/list');
  }
};

export const customerService = {
  getCustomers: async (): Promise<Customer[]> => {
    return cachedRequest<Customer[]>('get', '/customer/list');
  }
};

export default apiClient;
