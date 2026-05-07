"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Info, X } from "lucide-react";

import { SurfaceCard } from "@/components/ui/surface-card";
import { leaveGuides } from "@/data/leave-guides";
import type { RoleSlug } from "@/modules/roles";

export const LeavesCatalog = ({ role }: { role: RoleSlug }) => {
  const router = useRouter();
  const [infoKey, setInfoKey] = useState<string | null>(null);

  useEffect(() => {
    if (!infoKey) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInfoKey(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [infoKey]);

  const handleOpenForm = (href: string, disabled: boolean) => {
    if (disabled) return;
    router.push(`${href}?returnTo=/dashboard/${role}/leaves`);
  };

  const selectedInfo = leaveGuides.find((guide) => guide.key === infoKey);

  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="space-y-1">
        <p className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Leaves
        </p>
        <p className="text-sm text-slate-600">
          Choose one leave form to open a dedicated page.
        </p>
      </div>

      <div className="space-y-4">
        {leaveGuides.map((card) => {
          const disabled = Boolean(card.disabledFor?.includes(role));

          return (
            <SurfaceCard
              key={card.title}
              className="h-full border-slate-200/80 p-4 sm:p-5"
            >
              <div
                className={`flex h-full cursor-pointer flex-col gap-4 rounded-2xl transition hover:bg-white/70 sm:flex-row sm:items-start sm:justify-between ${
                  disabled ? "cursor-not-allowed" : ""
                }`}
                onClick={() => handleOpenForm(card.href, disabled)}
                role={disabled ? "presentation" : "button"}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(event) => {
                  if (disabled) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenForm(card.href, disabled);
                  }
                }}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900">
                      {card.title}
                    </p>
                    {disabled ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        Not available
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600">{card.description}</p>
                </div>

                <div className="flex items-center gap-2 sm:pt-1">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    onClick={(event) => {
                      event.stopPropagation();
                      setInfoKey(card.key);
                    }}
                  >
                    <Info className="h-3.5 w-3.5" /> Info
                  </button>

                  {disabled ? (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-300">
                      -
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      aria-label={`Open ${card.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenForm(card.href, disabled);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      {infoKey && selectedInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Close info"
            onClick={() => setInfoKey(null)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedInfo.title}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedInfo.description}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                onClick={() => setInfoKey(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {selectedInfo.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Workflow:</span>{" "}
              {selectedInfo.workflow}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
