// src/services/api.ts
import axios from 'axios'
import { supabase } from './lib/supabase' // Fixed import path
import type { Ticket, Department, Customer } from '../types'

// 1. Configura o client Axios para apontar à sua Edge Function
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tomticket-proxy`,
  headers: {
    'Content-Type': 'application/json',
  }
})

// 2. Interceptor para adicionar headers de autenticação dinamicamente
apiClient.interceptors.request.use(async (config) => {
  try {
    // Sempre inclui a apikey do Supabase
    config.headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    // Tenta obter a sessão atual do usuário
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      // Se há um usuário logado, envia o token de autorização
      config.headers.Authorization = `Bearer ${session.access_token}`
      console.log('Token de autorização adicionado:', session.access_token.substring(0, 20) + '...')
    } else {
      console.warn('Nenhuma sessão ativa encontrada')
      // Dependendo da sua Edge Function, você pode querer rejeitar aqui
      // ou permitir que continue com apenas a apikey
    }
    
    return config
  } catch (error) {
    console.error('Erro ao configurar headers de autorização:', error)
    // Em caso de erro, pelo menos envia a apikey
    config.headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY
    return config
  }
})

// 3. Implementa cache + fila de requisições (p/ respeitar rate-limit de ~3 req/s)
const CACHE = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
let requestQueue: Promise<any> = Promise.resolve()
const REQUEST_DELAY = 350 // ms

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Não autorizado. Verificando autenticação...')
        
        // Verifica se o usuário está logado
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          console.error('Usuário não está logado. Redirecionando para login...')
          // Aqui você pode redirecionar para a página de login
          // window.location.href = '/login'
        } else {
          console.error('Token pode estar expirado. Tentando renovar...')
          // Força uma atualização da sessão
          await supabase.auth.refreshSession()
        }
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

// 4. Função helper para verificar se o usuário está autenticado
export async function checkAuth(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session?.access_token
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error)
    return false
  }
}

// 5. Função helper para fazer requisições com verificação de auth
async function authenticatedRequest<T>(
  method: 'get' | 'post',
  url: string,
  data?: object,
  params?: object
): Promise<T> {
  const isAuthenticated = await checkAuth()
  if (!isAuthenticated) {
    throw new Error('Usuário não está autenticado. Faça login primeiro.')
  }
  return cachedRequest<T>(method, url, data, params)
}

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
    }
    
    // Remove chaves undefined
    Object.keys(body).forEach(key => body[key] == null && delete body[key])
    
    // Usa authenticatedRequest para garantir que o usuário está logado
    return authenticatedRequest<Ticket[]>('post', '/ticket/list', body)
  },

  getTicketDetails: async (ticketId: string): Promise<Ticket> => {
    return authenticatedRequest<Ticket>('get', `/ticket/detail/${ticketId}`)
  }
}

export const departmentService = {
  getDepartments: async (): Promise<Department[]> => {
    return authenticatedRequest<Department[]>('get', '/departments/list')
  }
}

export const customerService = {
  getCustomers: async (): Promise<Customer[]> => {
    return authenticatedRequest<Customer[]>('get', '/customer/list')
  }
}

export default apiClient