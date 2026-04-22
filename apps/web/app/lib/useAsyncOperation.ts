import { useCallback, useState } from 'react'

interface UseAsyncOperationOptions<T, E = Error> {
  onSuccess?: (data: T) => void
  onError?: (error: E) => void
  onFinally?: () => void
}

interface UseAsyncOperationState<T, E = Error> {
  isLoading: boolean
  error: E | null
  data: T | null
  retryCount: number
}

export function useAsyncOperation<T, E = Error>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOperationOptions<T, E> = {}
) {
  const { onSuccess, onError, onFinally } = options

  const [state, setState] = useState<UseAsyncOperationState<T, E>>({
    isLoading: false,
    error: null,
    data: null,
    retryCount: 0,
  })

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const result = await asyncFn()
      setState((prev) => ({ ...prev, data: result, error: null, isLoading: false }))
      onSuccess?.(result)
      onFinally?.()
      return result
    } catch (err) {
      const error = err as E
      setState((prev) => ({ ...prev, error, isLoading: false }))
      onError?.(error)
      onFinally?.()
      throw error
    }
  }, [asyncFn, onSuccess, onError, onFinally])

  const retry = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      error: null,
    }))
    return execute()
  }, [execute])

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      data: null,
      retryCount: 0,
    })
  }, [])

  return {
    isLoading: state.isLoading,
    error: state.error,
    data: state.data,
    retryCount: state.retryCount,
    execute,
    retry,
    reset,
  }
}
