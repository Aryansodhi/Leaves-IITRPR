import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { RoleDashboardConfig } from "@/modules/roles";

export const RoleDashboard = ({ config }: { config: RoleDashboardConfig }) => (
  <div className="space-y-8">
    <header className="space-y-4">
      <StatusPill
        label={config.badge}
        tone={config.badge === "Applicant" ? "review" : "submitted"}
      />
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold text-slate-900">
          {config.label}
        </h1>
        <p className="text-base text-slate-600">{config.blurb}</p>
      </div>
      <p className="text-sm text-slate-500">{config.helper}</p>
    </header>

    <section className="space-y-4">
      <div>
        <p className="text-xl font-semibold text-slate-900">Quick actions</p>
        <p className="text-sm text-slate-500">
          Finish the most common tasks in a couple of clicks.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {config.quickActions.map((action) => (
          <SurfaceCard
            key={action.label}
            className="h-full border-slate-200/80 p-5"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <action.icon className="mt-1 h-6 w-6 text-slate-400" />
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-slate-900">
                    {action.label}
                  </p>
                  <p className="text-sm text-slate-500">{action.description}</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full justify-center">
                {action.cta}
              </Button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </section>

    <section className="space-y-6">
      {config.sections.map((section) => (
        <SurfaceCard
          key={section.title}
          className="space-y-5 border-slate-200/80 p-5"
        >
          <div className="space-y-1">
            <p className="text-lg font-semibold text-slate-900">
              {section.title}
            </p>
            <p className="text-sm text-slate-500">{section.description}</p>
          </div>
          <div className="space-y-4">
            {section.items.map((item) => (
              <div
                key={`${section.title}-${item.label}`}
                className="rounded-2xl border border-slate-200/70 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-900">
                    {item.label}
                  </p>
                  {item.badge && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                <Button
                  variant="ghost"
                  className="mt-3 px-0 text-sm font-semibold text-slate-900"
                >
                  {item.action}
                </Button>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ))}
    </section>

    {config.reminders && config.reminders.length > 0 && (
      <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
        <p className="text-lg font-semibold text-slate-900">Reminders</p>
        <ul className="space-y-2 text-sm text-slate-600">
          {config.reminders.map((reminder) => (
            <li key={reminder} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{reminder}</span>
            </li>
          ))}
        </ul>
      </SurfaceCard>
    )}
  </div>
);
