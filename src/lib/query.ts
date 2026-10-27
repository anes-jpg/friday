import { QueryClient } from "@tanstack/react-query"

export const workspaceQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 } },
})
