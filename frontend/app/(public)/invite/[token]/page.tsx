import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assertDefined } from "@/utils/assert";
import { accept_invite_links_url } from "@/utils/routes";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const headersList = await headers();
  let { token } = await searchParams;
  if (Array.isArray(token)) token = token[0];
  if (!token) throw notFound();
  const host = assertDefined(headersList.get("Host"));
  const response = await fetch(accept_invite_links_url({ host }), {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 401) return redirect(`/signup?redirect_url=${encodeURIComponent(`/invite/${token}`)}`);
  if (response.ok) return redirect("/dashboard");

  return (
    <div className="flex flex-col items-center">
      <div className="text-lg font-semibold">Invalid Invite Link.</div>
      <div className="text-md mb-4 text-center">Please check your invitation link or contact your administrator.</div>
      <Link href="/" className="rounded bg-black px-4 py-2 text-white transition hover:bg-gray-900">
        Go to Home
      </Link>
    </div>
  );
}
