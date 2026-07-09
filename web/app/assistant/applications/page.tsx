import { listApplications } from "@/lib/applications";
import ApplicationsTable from "../components/ApplicationsTable";
import AddApplication from "../components/AddApplication";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const applications = await listApplications();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Applications</h1>
        <AddApplication />
      </div>
      <ApplicationsTable applications={applications} />
    </div>
  );
}
