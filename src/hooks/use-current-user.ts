import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, type MyProfile } from "@/lib/auth.functions";

export function useCurrentUser() {
  const fetchProfile = useServerFn(getMyProfile);
  return useQuery<MyProfile>({
    queryKey: ["me"],
    queryFn: () => fetchProfile(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useIsAdmin() {
  const { data } = useCurrentUser();
  return data?.role === "admin";
}