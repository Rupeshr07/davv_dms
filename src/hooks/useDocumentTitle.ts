import { useEffect } from 'react'

export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} | DAVV DMS`
  }, [title])
}
