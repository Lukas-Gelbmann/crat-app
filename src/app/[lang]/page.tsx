import { getCurrentDictionary } from "@/i18n/server";

export default async function Home() {
  const dict = await getCurrentDictionary();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">
        {dict.home.title}
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        {dict.home.description}
      </p>
    </main>
  );
}
