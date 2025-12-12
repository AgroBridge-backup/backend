'use client'
import useSWR from 'swr'
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
type FetcherOptions = { token?: string }
const fetcher = async (url: string, opts?: FetcherOptions): Promise<any> => {
  const headers: HeadersInit = {}
  if (opts?.token) headers['Authorization'] = `Bearer ${opts.token}`
  const response = await fetch(url, { headers })
  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`)
  return response.json()
}
export function useApi(endpoint: string, token?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    `${apiUrl}${endpoint}`,
    (url) => fetcher(url, { token }),
    { revalidateOnFocus: false, revalidateOnReconnect: true, shouldRetryOnError: true, errorRetryCount: 3, dedupingInterval: 2000 }
  )
  return { data, error, isLoading, mutate }
}