import { DelegateScreen } from "@/components/map/DelegateScreen";

export const metadata = { title: "Delegate Map", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DelegateScreen token={token} />;
}
