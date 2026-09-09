import { GuestProvider } from "@/components/auth/guest-context";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AdminFormBuilder } from "@/components/admin/admin-form-builder";
import { getOptionalActor } from "@/server/auth/page-access";

export default async function FormsCreatePage() {
  const actor = await getOptionalActor();
  const isGuest = !actor;

  return (
    <GuestProvider isGuest={isGuest}>
      <DashboardShell>
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Create a Form
            </h1>
            <p className="text-base text-slate-600">
              Drag, drop, and customize fields to build a new IIT Ropar form.
            </p>
          </header>
          <AdminFormBuilder />
        </div>
      </DashboardShell>
    </GuestProvider>
  );
}
