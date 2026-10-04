import { Suspense } from "react";

import { DelegateScreen } from "@/components/map/DelegateScreen";

export const metadata = { title: "Delegate Map" };

export default function Page() {
  return (
    <Suspense>
      <DelegateScreen />
    </Suspense>
  );
}
