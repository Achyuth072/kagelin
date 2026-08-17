"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// identities can't answer this: both password sign-up and magic-link/OTP
// create an `email` identity, so the RPC reads auth.users server-side instead.
export function useHasPassword() {
  const { user, isGuestMode } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["has-password", user?.id],
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("has_password");
      if (error) throw error;
      return data ?? false;
    },
    enabled: !!user && !isGuestMode,
  });

  const refetchHasPassword = () =>
    queryClient.invalidateQueries({ queryKey: ["has-password", user?.id] });

  return {
    hasPassword: query.data ?? false,
    isLoading: query.isLoading,
    refetchHasPassword,
  };
}
