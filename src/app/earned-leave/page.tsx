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
  width = "w-48",
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
      "border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
  />
);

export default function EarnedLeavePage() {
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

        <SurfaceCard className="mx-auto max-w-4xl space-y-5 border border-slate-300 bg-white p-4 md:p-6">
          <header className="space-y-1 text-center text-slate-900">
            <div className="flex items-center justify-center gap-4">
              <Image
                src="/iit_ropar.png"
                alt="IIT Ropar"
                width={56}
                height={56}
                className="object-contain"
              />
              <div className="space-y-1">
                <p className="text-base font-semibold">
                  भारतीय प्रौद्योगिकी संस्थान रोपड़
                </p>
                <p className="text-base font-semibold uppercase">
                  INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                </p>
                <p className="text-[11px] text-slate-700">
                  नंगल रोड, रूपनगर, पंजाब-140001 / Nangal Road, Rupnagar,
                  Punjab-140001
                </p>
              </div>
            </div>
            <p className="text-[12px] font-semibold">
              छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन / Application for
              Leave or Extension of Leave
            </p>
            <p className="text-[11px]">
              (अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड
              छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल
              छुट्टी)
            </p>
            <p className="text-[11px]">
              (Earned Leave/Half Pay Leave/Extra Ordinary Leave/Commuted
              Leave/Vacation/Maternity Leave/Paternity Leave/Child Care Leave)
            </p>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full border border-slate-400 text-[12px] text-slate-900">
              <colgroup>
                <col className="w-[36%]" />
                <col />
              </colgroup>
              <tbody>
                <Row
                  label="1. आवेदक का नाम / Name of the applicant"
                  inputId="name"
                />
                <Row label="2. पद नाम / Post held" inputId="post" />
                <Row
                  label="3. विभाग/केन्द्रीय कार्यालय/अनुभाग / Department/Office/Section"
                  inputId="department"
                />
                <Row
                  label="4. अवकाश का प्रकार / Nature of Leave applied for"
                  inputId="leaveType"
                />
                <RowPeriod />
                <RowPrefixSuffix />
                <Row label="7. उद्देश्य / Purpose" inputId="purpose" />
                <Row
                  label="8. कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था / Alternative arrangements"
                  inputId="arrangements"
                />
                <Row
                  label="9. मैं एल.टी.सी. लेने हेतु प्रस्तावित करता हूँ / I propose/do not propose to avail myself of Leave Travel Concession during the leave."
                  inputId="ltc"
                />
                <RowAddress />
                <RowStation />
              </tbody>
            </table>
          </div>

          <p className="text-right text-[12px] text-slate-900">
            आवेदक के हस्ताक्षर दिनांक सहित / Signature of the applicant with
            date: <UnderlineInput id="applicantSignature" width="w-60" />
          </p>

          <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
            <p className="font-semibold text-center">
              नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें / Remarks and
              Recommendations of the controlling officer
            </p>
            <p>
              सिफारिश की गई / Recommended या नहीं की गई / not recommended:{" "}
              <UnderlineInput id="recommended" width="w-44" />
            </p>
            <p>
              विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित / Signature
              with date Head of Department/Section In-charge:
              <UnderlineInput id="hodSignature" width="w-60" className="ml-2" />
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-400 pt-2 text-[12px] text-slate-900">
            <p className="text-center font-semibold">
              प्रशासनिक अनुभाग द्वारा प्रयोग हेतु / For use by the
              Administration Section
            </p>
            <p>
              प्रमाणित किया जाता है कि (प्रकृति) / Certified that (nature of
              leave) for period, from
              <UnderlineInput id="adminFrom" width="w-32" /> to{" "}
              <UnderlineInput id="adminTo" width="w-32" /> is available as per
              following details:
            </p>
            <p>
              अवकाश का प्रकार / Nature of leave applied for{" "}
              <UnderlineInput id="adminLeaveType" width="w-44" /> आज की तिथि तक
              शेष / Balance as on date
              <UnderlineInput id="balance" width="w-28" /> कुल दिनों के लिए
              अवकाश / Leave applied for (No. of days)
              <UnderlineInput id="adminDays" width="w-24" />
            </p>
            <p>
              संबंधित सहायक / Dealing Assistant{" "}
              <UnderlineInput id="assistant" width="w-44" className="ml-2" />{" "}
              अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/ सुपdt./AR/DR
              <UnderlineInput id="arDr" width="w-44" className="ml-2" /> कुलसचिव
              / Registrar
              <UnderlineInput id="registrar" width="w-44" className="ml-2" />
            </p>
            <p>
              छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत /
              अस्वीकृत / Comments of the competent authority to grant leave:
              Sanctioned / Not Sanctioned
            </p>
            <p>
              कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के
              हस्ताक्षर / Signature of Registrar / Dean (Faculty Affairs &
              Administration) / Director:
              <UnderlineInput
                id="authoritySign"
                width="w-60"
                className="ml-2"
              />
            </p>
          </div>
        </SurfaceCard>
      </div>
    </DashboardShell>
  );
}

const Row = ({ label, inputId }: { label: string; inputId: string }) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">{label}</td>
    <td className="px-3 py-2">
      <UnderlineInput id={inputId} className="w-full" />
    </td>
  </tr>
);

const RowPeriod = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      5. छुट्टी की अवधि / Period of Leave
    </td>
    <td className="px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>से / From:</span>
        <UnderlineInput id="fromDate" width="w-32" />
        <span>तक / To:</span>
        <UnderlineInput id="toDate" width="w-32" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="days" width="w-20" />
      </div>
    </td>
  </tr>
);

const RowPrefixSuffix = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      6. रविवार, छुट्टी या अवकाश, छुट्टी से पहले या बाद में प्रस्तावित है
      <div className="text-[11px] font-normal">
        Sunday and holiday, if any, proposed to be prefixed/suffixed to leave
      </div>
    </td>
    <td className="px-3 py-2 text-[12px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>के पूर्व Prefix</span>
        <UnderlineInput id="prefixFrom" width="w-28" />
        <span>से / From:</span>
        <UnderlineInput id="prefixFromDate" width="w-28" />
        <span>तक / To:</span>
        <UnderlineInput id="prefixToDate" width="w-28" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="prefixDays" width="w-20" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>के पश्चात Suffix</span>
        <UnderlineInput id="suffixFrom" width="w-28" />
        <span>से / From:</span>
        <UnderlineInput id="suffixFromDate" width="w-28" />
        <span>तक / To:</span>
        <UnderlineInput id="suffixToDate" width="w-28" />
        <span>दिनों की संख्या / No. of days:</span>
        <UnderlineInput id="suffixDays" width="w-20" />
      </div>
    </td>
  </tr>
);

const RowAddress = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      10. अवकाश के दौरान पता / Address during the leave
    </td>
    <td className="px-3 py-2 space-y-2 text-[12px]">
      <UnderlineInput id="address" className="w-full" />
      <div className="flex flex-wrap items-center gap-3">
        <span>संपर्क नं. / Contact No.</span>
        <UnderlineInput id="contactNo" width="w-40" />
        <span>पिन / PIN:</span>
        <UnderlineInput id="pin" width="w-24" />
      </div>
    </td>
  </tr>
);

const RowStation = () => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      11. क्या स्टेशन अवकाश की आवश्यकता है / Whether Station leave is required
    </td>
    <td className="px-3 py-2 space-y-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>हाँ / Yes / No :</span>
        <UnderlineInput id="stationYesNo" width="w-20" />
        <span>यदि हाँ / If yes :</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>से / From :</span>
        <UnderlineInput id="stationFrom" width="w-28" />
        <span>तक / To :</span>
        <UnderlineInput id="stationTo" width="w-28" />
      </div>
    </td>
  </tr>
);
