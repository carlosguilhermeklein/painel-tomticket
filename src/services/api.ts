// src/services/api.ts
import axios from 'axios'
import type { Ticket, Department, Customer } from '../types'

// 1. Configura o client Axios para apontar à sua Edge Function
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomticket-proxy`,
  headers: {
    'Content-Type': 'application/json',
    // Só precisa enviar a anon key do Supabase (para que o Supabase permita executar a function)
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
  }
})

// 2. Implementa cache + fila de requisições (p/ respeitar rate-limit de ~3 req/s)
const CACHE = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
let requestQueue: Promise<any> = Promise.resolve()
const REQUEST_DELAY = 350 // ms

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Não autorizado. Verifique se a Edge Function está enviando Authorization.')
      } else if (error.response.status === 429) {
        console.error('Rate limit atingido. Aguarde antes de tentar de novo.')
      } else {
        console.error('API Error:', error.response.data)
      }
    } else if (error.request) {
      console.error('Network Error:', error.request)
    } else {
      console.error('Error:', error.message)
    }
    return Promise.reject(error)
  }
)

async function cachedRequest<T>(
  method: 'get' | 'post',
  url: string,
  data?: object,
  params?: object
): Promise<T> {
  // Cria uma chave única para armazenar no cache
  const cacheKey = `${method}-${url}-${JSON.stringify(data||{})}-${JSON.stringify(params||{})}`
  const entry = CACHE.get(cacheKey)
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
    return entry.data
  }

  // Enfileira a requisição para respeitar o REQUEST_DELAY
  const queued: Promise<T> = new Promise((resolve, reject) => {
    requestQueue = requestQueue
      .then(() => new Promise(r => setTimeout(r, REQUEST_DELAY)))
      .then(async () => {
        try {
          const resp = await apiClient.request<T>({ method, url, data, params })
          CACHE.set(cacheKey, { data: resp.data, timestamp: Date.now() })
          resolve(resp.data)
        } catch (err) {
          reject(err)
        }
      })
  })

  return queued
}

export const ticketService = {
  // ◀◀— Atenção aqui: o método É POST e a rota É “/ticket/list” (com barra)
  getTickets: async (
    startDate?: Date,
    endDate?: Date,
    status?: string,
    departmentId?: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<Ticket[]> => {
    // Monta o body em JSON (TomTicket espera JSON no corpo)
    const body: Record<string, any> = {
      start: startDate ? startDate.toISOString() : undefined,
      end:   endDate   ? endDate.toISOString()   : undefined,
      status,
      department_id: departmentId,
      page,
      pageSize
    }
    // Remove chaves undefined
    Object.keys(body).forEach(key => body[key] == null && delete body[key])

    // Chama *EXATAMENTE* POST em “/ticket/list”
    return cachedRequest<Ticket[]>('post', '/ticket/list', body)
  },

  // Champ a rota GET /ticket/detail/:id
  getTicketDetails: async (ticketId: string): Promise<Ticket> => {
    return cachedRequest<Ticket>('get', `/ticket/detail/${ticketId}`)
  }
}

export const departmentService = {
  getDepartments: async (): Promise<Department[]> => {
    return cachedRequest<Department[]>('get', '/departments/list')
  }
}

export const customerService = {
  getCustomers: async (): Promise<Customer[]> => {
    return cachedRequest<Customer[]>('get', '/customer/list')
  }
}

export default apiClient
