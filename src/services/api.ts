// src/services/api.ts
import axios from 'axios';
import type { Ticket, Department, Customer } from '../types';

// Faz o create() do Axios apontando para a Edge Function
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomticket-proxy`,
  headers: {
    'Content-Type': 'application/json',
    // Aqui é ESSENCIAL: o header "apikey" deve ser exatamente a ANON_KEY do Supabase
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
  }
});

// Cache simples para não bater muito na API
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Fila para respeitar rate limit
let requestQueue: Promise<any> = Promise.resolve();
const REQUEST_DELAY = 350; // 350 ms

// Função genérica que enfileira + faz cache
async function cachedRequest<T>(
  method: 'get' | 'post',
  url: string,
  data?: object,
  params?: object
): Promise<T> {
  // 1) Chave de cache baseada em URL + body + params
  const cacheKey = `${method}-${url}-${JSON.stringify(data||{})}-${JSON.stringify(params||{})}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  // 2) Se não tiver no cache, aguarda na fila (requestQueue)
  const queuedRequest: Promise<T> = new Promise((resolve, reject) => {
    requestQueue = requestQueue
      .then(() => new Promise(r => setTimeout(r, REQUEST_DELAY)))
      .then(async () => {
        try {
          const resp = await apiClient.request<T>({
            method,
            url,
            data,
            params
          });
          cache.set(cacheKey, { data: resp.data, timestamp: Date.now() });
          resolve(resp.data);
        } catch (err) {
          reject(err);
        }
      });
  });

  return queuedRequest;
}

// 3) Serviços específicos que usam cachedRequest
export const ticketService = {
  // POST → /ticket/list
  getTickets: async (
    startDate?: Date,
    endDate?: Date,
    status?: string,
    departmentId?: string,
    page = 1,
    pageSize = 50
  ): Promise<Ticket[]> => {
    const body: Record<string, any> = {
      start:  startDate ? startDate.toISOString() : undefined,
      end:    endDate   ? endDate.toISOString()   : undefined,
      status,
      department_id: departmentId,
      page,
      pageSize
    };
    // Remove chaves undefined
    Object.keys(body).forEach((k) => body[k] == null && delete body[k]);
    return cachedRequest<Ticket[]>('post', '/ticket/list', body);
  },

  // GET → /ticket/detail/:ticketId
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
