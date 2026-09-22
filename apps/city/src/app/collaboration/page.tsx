import { redirect } from "next/navigation";

type CollaborationPageProps = {
  searchParams: Promise<{ zone?: string }>;
};

const facilities: Record<string, string> = {
  hackathon: "hackathon",
  dev: "table-dev",
  social: "table-social",
  agent: "agentroundtable",
};

export default async function CollaborationPage({ searchParams }: CollaborationPageProps) {
  const { zone = "hackathon" } = await searchParams;
  redirect(`/city/neon?facility=${facilities[zone] || "hackathon"}`);
}
