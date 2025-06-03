// src/services/api.ts

import axios from 'axios';
import type { Ticket, Department, Customer } from '../types';

// ✏️ Aqui: BASE URL apontando para a Edge Function no Supabase
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomticket-proxy`,
  headers: {
    'Content-Type': 'application/json',
    // MUST: enviar sempre a anon key do supabase
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
  }
});

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

let requestQueue: Promise<any> = Promise.resolve();
const REQUEST_DELAY = 350; // 350ms

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

const cachedRequest = async <T>(
  method: 'get' | 'post',
  url: string,
  data?: object,
  params?: object
): Promise<T> => {
  const cacheKey = `${method}-${url}-${JSON.stringify(data || {})}-${JSON.stringify(params || {})}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  const queuedRequest: Promise<T> = new Promise((resolve, reject) => {
    requestQueue = requestQueue
      .then(() => new Promise((r) => setTimeout(r, REQUEST_DELAY)))
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
};

export const ticketService = {
  getTickets: async (
    startDate?: Date,
    endDate?: Date,
    status?: string,
    departmentId?: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<Ticket[]> => {
    const body: Record<string, any> = {
      start: startDate ? startDate.toISOString() : undefined,
      end:   endDate   ? endDate.toISOString()   : undefined,
      status,
      department_id: departmentId,
      page,
      pageSize
    };
    Object.keys(body).forEach((k) => body[k] == null && delete body[k]);
    return cachedRequest<Ticket[]>('post', '/ticket/list', body);
  },

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
