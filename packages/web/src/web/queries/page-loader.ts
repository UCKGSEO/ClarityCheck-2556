import { useMutation } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function usePageLoader() {
  return useMutation(orpc.pageLoader.load.mutationOptions({ retry: false, gcTime: 0 }));
}