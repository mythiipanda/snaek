import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-col gap-16 pb-8">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center shadow-lg sm:px-12 md:py-20"
        style={{
          backgroundImage: "url(/hero-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-card/80 backdrop-blur-[1px] dark:bg-card/70" aria-hidden />
        <div className="relative">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Snaek&apos;s{" "}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent dark:from-emerald-400 dark:to-teal-400">
              Value List
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Search Counter Blox skins, browse values, and total trades in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-lg px-6 text-base shadow-md">
              <Link href="/skins">Browse skins</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="rounded-lg px-6 text-base">
              <Link href="/trade">Trade calculator</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-6 sm:grid-cols-2">
        <Card
          className="group relative overflow-hidden border-2 transition-all duration-200 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:border-emerald-400/20"
          style={{
            backgroundImage: "url(/skins-card-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-card/80 dark:bg-card/75" aria-hidden />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-xl">Skins</CardTitle>
            <CardDescription className="text-base">
            Browse items with thumbnail images and narrow your search with filtering and sorting.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/skins">Open skins list</Link>
            </Button>
          </CardContent>
        </Card>

        <Card
          className="group relative overflow-hidden border-2 transition-all duration-200 hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-500/5 dark:hover:border-teal-400/20"
          style={{
            backgroundImage: "url(/trade-card-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-card/80 dark:bg-card/75" aria-hidden />
          <CardHeader className="relative pb-2">
            <CardTitle className="text-xl">Trade calculator</CardTitle>
            <CardDescription className="text-base">
            Easily calculate the value of any CB trade.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/trade">Open calculator</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Community */}
      <section className="rounded-xl border bg-muted/30 px-6 py-4 dark:bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Community & feedback</span>
            {" — "}
            DM <strong>mythiipanda</strong> for suggestions or bugs.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0 gap-2">
            <a href="https://discord.gg/R853zQh7Yq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <Image src="/discord-logo.svg" alt="" width={20} height={20} className="h-5 w-5" />
              Join the Discord
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
