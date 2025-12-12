
'use client'

import useSWR from 'swr'
import apiClient from '../services/api'

const fetcher = (url: string) => apiClient.get(url).then(res => res.data);

export function useBatches() {
  const { data, error, isLoading, mutate } = useSWR('/batches', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: true,
  });

  return {
    batches: data,
    isLoading,
    isError: error,
    mutate,
  }
}
