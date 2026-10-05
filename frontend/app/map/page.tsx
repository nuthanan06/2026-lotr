import { Suspense } from "react";

import { MapPage } from "@/components/map/MapPage";

export const metadata = { title: "Middle-earth Map" };

export default function Page() {
  // MapPage reads the sidebar state from the URL (useSearchParams).
  return (
    <Suspense>
      <MapPage />
    </Suspense>
  );
}
