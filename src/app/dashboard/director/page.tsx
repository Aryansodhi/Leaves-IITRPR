import { redirect } from "next/navigation";

export default async function DirectorDashboardPage() {
  redirect("./leaves");
}
