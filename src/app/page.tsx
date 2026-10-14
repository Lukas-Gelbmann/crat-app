export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">CRAT</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Cybersecurity Risk Assessment Tool. Answer compliance questions in a
        conversation, get follow-up questions where answers are incomplete,
        and receive a scored report with recommendations.
      </p>
    </main>
  );
}
