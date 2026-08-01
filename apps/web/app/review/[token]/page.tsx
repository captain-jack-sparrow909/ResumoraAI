import { SharedReviewWorkspace } from "@/components/shared-review-workspace";

export default async function SharedReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedReviewWorkspace token={token} />;
}
