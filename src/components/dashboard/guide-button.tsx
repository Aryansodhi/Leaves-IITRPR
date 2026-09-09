"use client";

import { type ReactNode, useEffect, useState } from "react";
import { X, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { leaveGuides } from "@/data/leave-guides";

type GuideKey =
  | "leaves"
  | "forms"
  | "my-applications"
  | "approvals"
  | "profile";

const pages: { key: GuideKey; label: string }[] = [
  { key: "leaves", label: "Leaves" },
  { key: "forms", label: "Forms" },
  { key: "my-applications", label: "My Applications" },
  { key: "approvals", label: "Approve Leaves" },
  { key: "profile", label: "Profile" },
];

const guideContent: Record<GuideKey, { title: string; body: ReactNode }> = {
  leaves: {
    title: "Leaves",
    body: (
      <div className="space-y-4 text-sm text-slate-700">
        <div className="space-y-2">
          <p>
            The Leaves page is where you raise new leave requests. Choose the
            correct leave type and fill the form. Attach supporting documents
            where required.
          </p>
          <p>
            After submitting, your application will be routed through the
            reporting officer, HOD/Approver, and Establishment. Track status
            under &quot;My Applications&quot;.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Leave forms
          </p>
          <div className="space-y-3">
            {leaveGuides.map((form) => (
              <div
                key={form.key}
                className="rounded-xl border border-slate-200/80 bg-white px-3 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {form.title}
                </p>
                <p className="text-sm text-slate-600">{form.description}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                  {form.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Workflow: {form.workflow}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  forms: {
    title: "Forms",
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          The Forms area lists institute-wide forms used across workflows. You
          can preview each form to understand which fields are mandatory and
          which documents are optional.
        </p>
        <p>
          Admins can create or modify forms via the Create Form tool. Each form
          shows the expected approval chain and required attachments.
        </p>
      </div>
    ),
  },
  "my-applications": {
    title: "My Applications",
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          All requests you have submitted appear here with current status and
          history. Click any application to see details, reviewer comments and
          attachments.
        </p>
        <p>
          You can withdraw certain applications if they are still pending at the
          first approval stage. Use the track ID to follow up with Establishment
          or HOD.
        </p>
      </div>
    ),
  },
  approvals: {
    title: "Approve Leaves",
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          This view is for approvers. Incoming requests show the form, any
          attachments, and the proposed dates. Use the quick actions to approve,
          request changes, or reject with comments.
        </p>
        <p>
          Approvals may escalate depending on leave type and duration. Check the
          workflow panel to see the remaining approvers.
        </p>
      </div>
    ),
  },
  profile: {
    title: "Profile",
    body: (
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Your profile contains personal details used to populate forms
          (designation, department, email). Keep this information accurate to
          ensure workflows route correctly.
        </p>
        <p>
          You can set notification preferences and view your role and any act as
          settings from here.
        </p>
      </div>
    ),
  },
};

export const GuideButton = () => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GuideKey>("leaves");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button
        variant="secondary"
        className="px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open Guide"
      >
        <BookOpen className="h-4 w-4" />
        Guide
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-60 mx-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  User Guide
                </h3>
              </div>
              <div>
                <button
                  className="inline-flex items-center justify-center rounded-full p-2 text-slate-700 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                  aria-label="Close guide"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 p-6">
              <aside className="col-span-1 border-r border-slate-100 pr-4">
                <nav className="space-y-2">
                  {pages.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setSelected(p.key)}
                      className={`w-full text-left rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        selected === p.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </nav>
              </aside>

              <main className="col-span-2 space-y-4">
                <h4 className="text-lg font-semibold text-slate-900">
                  {guideContent[selected].title}
                </h4>
                <div className="max-h-[60vh] overflow-y-auto">
                  {guideContent[selected].body}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GuideButton;
