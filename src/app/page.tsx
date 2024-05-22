import { getSession } from "@/actions";
import { Dashboard } from "@/components/home/dashboard";
import { SideNav } from "@/components/nav/side-nav";
import { fetchNodes } from "@/lib/queryHelper";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

// prevent caching
// export const dynamic = "force-dynamic";
// export const revalidate = 0;

export default async function Index() {
  let session = await getSession();
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["nodes"],
    queryFn: () => fetchNodes(session.accessToken),
  });

  return (
    <div className="flex justify-center  text-primary">
      <SideNav role={session.role}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Dashboard session={session!} />
        </HydrationBoundary>
      </SideNav>
    </div>
  );
}
