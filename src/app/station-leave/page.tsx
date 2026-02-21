"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

const UnderlineInput = ({
  id,
  width = "w-72",
  className,
}: {
  id: string;
  width?: string;
  className?: string;
}) => (
  <input
    id={id}
    name={id}
    type="text"
    className={cn(
      "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
  />
);

export default function StationLeavePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") ? returnTo : "/";
      router.push(safeReturnTo);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 text-sm font-semibold text-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <SurfaceCard className="mx-auto max-w-3xl space-y-5 border border-slate-300 bg-white p-6 md:p-7">
          <header className="space-y-1 text-center text-slate-900">
            <div className="flex items-start justify-center gap-4">
              <Image
                src="/iit_ropar.png"
                alt="IIT Ropar"
                width={64}
                height={64}
                className="object-contain"
              />
              <div className="space-y-1 text-left">
                <p className="text-base font-semibold">
                  भारतीय प्रौद्योगिकी संस्थान रोपड़
                </p>
                <p className="text-base font-semibold uppercase">
                  INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                </p>
                <p className="text-[11px] text-slate-700">
                  नंगल रोड,रूपनगर,पंजाब-140001/ Nangal Road, Rupnagar,
                  Punjab-140001
                </p>
                <p className="text-[11px] text-slate-700">
                  दूरभाष/Tele: +91-1881-227078,फैक्स /Fax : +91-1881-223395
                </p>
              </div>
            </div>
            <div className="border-b border-slate-500" />
            <p className="text-base font-semibold underline">
              STATION LEAVE PERMISSION (SLP)
            </p>
          </header>

          <div className="space-y-3 text-[13px] text-slate-900">
            <LineItem number="1." label="Name" inputId="name" />
            <LineItem number="2." label="Designation" inputId="designation" />
            <LineItem number="3." label="Department" inputId="department" />
            <LineItem
              number="4."
              label="Date(s) and Timing(s) for which Station Leave Permission is required"
              inputId="dates"
              suffix="No. of days"
              suffixId="days"
              secondLine="From"
              secondId="from"
              thirdLabel="to"
              thirdId="to"
            />
            <LineItem
              number="5."
              label="Nature of Leave sanctioned (if applicable)"
              inputId="nature"
            />
            <LineItem
              number="6."
              label="Purpose of the Station Leave Permission"
              inputId="purpose"
            />
            <LineItem
              number="7."
              label="Contact Number(s) and Address during station leave"
              inputId="contact"
            />
          </div>

          <div className="space-y-2 text-[13px] text-slate-900">
            <div className="flex flex-wrap items-center gap-2">
              <span>Place:</span>
              <UnderlineInput id="place" width="w-44" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>Date:</span>
              <UnderlineInput id="date" width="w-44" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[12px] text-slate-800">AR/DR (Estt.)</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-800">
                  (Signature of the applicant)
                </span>
                <UnderlineInput id="applicantSign" width="w-64" />
              </div>
            </div>
          </div>

          <div className="space-y-3 text-center text-[13px] text-slate-900">
            <p className="font-semibold">Permitted / Not permitted</p>
            <div className="flex items-center justify-end gap-2 text-right">
              <span className="text-[12px] text-slate-800">
                (Signature of the HoD / Reporting Officer)
              </span>
              <UnderlineInput id="hodSign" width="w-64" />
            </div>
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}

const LineItem = ({
  number,
  label,
  inputId,
  suffix,
  suffixId,
  secondLine,
  secondId,
  thirdLabel,
  thirdId,
}: {
  number: string;
  label: string;
  inputId: string;
  suffix?: string;
  suffixId?: string;
  secondLine?: string;
  secondId?: string;
  thirdLabel?: string;
  thirdId?: string;
}) => (
  <div className="space-y-1">
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-6">{number}</span>
      <span className="flex-1">{label}</span>
      <span>:</span>
      <UnderlineInput id={inputId} className="flex-1" />
      {suffix ? (
        <>
          <span>{suffix}</span>
          <UnderlineInput id={suffixId ?? `${inputId}Suffix`} width="w-28" />
        </>
      ) : null}
    </div>
    {secondLine ? (
      <div className="flex flex-wrap items-center gap-2 pl-8">
        <span>{secondLine}</span>
        <UnderlineInput id={secondId ?? `${inputId}Second`} width="w-36" />
        {thirdLabel ? (
          <>
            <span>{thirdLabel}</span>
            <UnderlineInput id={thirdId ?? `${inputId}Third`} width="w-36" />
          </>
        ) : null}
      </div>
    ) : null}
  </div>
);
