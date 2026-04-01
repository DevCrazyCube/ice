import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-bold tracking-tight">ICE Platform</h1>
        <p className="mt-4 text-lg text-gray-600">
          Inbound Conversation Engine
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Multi-tenant agent platform for acquisition and inbound conversations.
        </p>
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
