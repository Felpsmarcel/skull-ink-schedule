import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyDay } from "@/lib/my-day.functions";
import { MyDayView, type MyDayFilter } from "@/components/my-day-view";

export function MyDay() {
  const read = useServerFn(getMyDay);
  const [filter, setFilter] = useState<MyDayFilter>("all");
  const query = useQuery({
    queryKey: ["my-day-admin"],
    queryFn: () => read(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });
  return (
    <MyDayView
      data={query.data}
      filter={filter}
      onFilterChange={setFilter}
      isError={query.isError}
      isPending={query.isPending}
      isFetching={query.isFetching}
      onRefresh={() => void query.refetch()}
    />
  );
}
