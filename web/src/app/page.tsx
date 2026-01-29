import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-2xl">Snaek&apos;s Value List</CardTitle>
          <CardDescription>
            Search Counter Blox skins, browse values, and quickly total trades.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/skins">Browse skins</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/trade">Trade calculator</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skins</CardTitle>
          <CardDescription>
            Filter by gun + search by skin name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/skins">Open skins list</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trade calculator</CardTitle>
          <CardDescription>
            Calculate difference between Offer and Request items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/trade">Open calculator</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Community & feedback</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="https://discord.gg/R853zQh7Yq" target="_blank" rel="noopener noreferrer">
                Join the Discord
              </a>
            </Button>
            <span>DM <strong>mythiipanda</strong> for suggestions or bugs.</span>
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
