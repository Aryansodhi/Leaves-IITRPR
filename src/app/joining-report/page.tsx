"use client";

export const dynamic = "force-dynamic";

import type {
  FormEvent,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadFormAsPdf } from "@/lib/pdf-export";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "../../components/leaves/signature-otp-verification-card";
import {
  DIGITAL_SIGNATURE_VALUE,
  useSignatureOtp,
} from "@/components/leaves/use-signature-otp";
import {
  type DaySession,
  SESSION_OFFSET,
  computeSessionLeaveDaysFromInput,
  formatSessionDays,
  getTodayIso,
  resolveCurrentSession,
} from "@/lib/leave-session";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { applyAutofillToForm, saveFormDraft } from "@/lib/form-autofill";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

type JoiningReportHistoryItem = {
  id: string;
  referenceCode: string;
  from: string;
  to: string;
  totalDays: number;
  status: string;
  submittedAt: string;
  approver: string;
};

type FormLanguage = "HI" | "TE" | "PA" | "MR" | "TA" | "ML" | "UR";

const ROLE_KEYS = {
  FACULTY: "FACULTY",
  STAFF: "STAFF",
  HOD: "HOD",
  DEAN: "DEAN",
  REGISTRAR: "REGISTRAR",
} as const;

const FORM_LANGUAGE_OPTIONS = [
  { value: "HI", label: "Hindi" },
  { value: "TE", label: "Telugu" },
  { value: "PA", label: "Punjabi" },
  { value: "MR", label: "Marathi" },
  { value: "TA", label: "Tamil" },
  { value: "ML", label: "Malayalam" },
  { value: "UR", label: "Urdu" },
] as const;

const HINDI_TRANSLATIONS: Record<
  Exclude<FormLanguage, "HI">,
  Record<string, string>
> = {
  TE: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "భారత సాంకేతిక సంస్థ రోపర్",
    "नंगल रोड, रूपनगर, पंजाब-140001": "నంగళ్ రోడ్, రూపనగర్, పంజాబ్-140001",
    "सेवा में": "సేవలో",
    निदेशक: "నిర్దేశకుడు",
    कुलसचिव: "రిజిస్ట్రార్",
    "भा.प्रौ.सं.रोपड़": "భా.ప్రౌ.సం.రోపర్",
    विभागाध्यक्ष: "విభాగాధ్యక్షుడు",
    "रिपोर्टिंग अधिकारी द्वारा": "నివేదికాధికారి ద్వారా",
    विषय: "విషయం",
    "कार्यग्रहण प्रतिवेदन": "చేరిక నివేదిక",
    महोदय: "మహాశయా",
    मैं: "నేను",
    दिनांक: "తేదీ",
    से: "నుంచి",
    तक: "వరకు",
    "दिन की": "రోజుల",
    "आज दिनांक": "ఈరోజు తేదీ",
    को: "న",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "తేదీ న నేను నా చేరిక నివేదిక సమర్పిస్తున్నాను, ఇది కార్యాలయ ఉత్తర్వు నం.",
    "के द्वारा स्वीकृत किया था।": "ద్వారా ఆమోదించబడింది.",
    भवदीय: "వినయపూర్వకంగా",
    हस्ताक्षर: "హస్తాక్షరం",
    नाम: "పేరు",
    पदनाम: "పదవి",
    पूर्वाह्न: "పూర్వాహ్నం",
    अपराह्न: "అపరాహ్నం",
    "अर्जित छुट्टी": "ఆర్జిత సెలవు",
    "अर्ध वेतन छुट्टी": "అర్ధ వేతన సెలవు",
    "चिकित्सक छुट्टी": "వైద్య సెలవు",
    "असाधारण छुट्टी": "అసాధారణ సెలవు",
  },
  PA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ਭਾਰਤੀ ਪ੍ਰੌਧੋਗਿਕੀ ਸੰਸਥਾਨ ਰੋਪੜ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "ਨੰਗਲ ਰੋਡ, ਰੂਪਨਗਰ, ਪੰਜਾਬ-140001",
    "सेवा में": "ਸੇਵਾ ਵਿੱਚ",
    निदेशक: "ਡਾਇਰੈਕਟਰ",
    कुलसचिव: "ਰਜਿਸਟਰਾਰ",
    "भा.प्रौ.सं.रोपड़": "ਭਾ.ਪ੍ਰੌ.ਸੰ.ਰੋਪੜ",
    विभागाध्यक्ष: "ਵਿਭਾਗ ਮੁਖੀ",
    "रिपोर्टिंग अधिकारी द्वारा": "ਰਿਪੋਰਟਿੰਗ ਅਫਸਰ ਦੁਆਰਾ",
    विषय: "ਵਿਸ਼ਾ",
    "कार्यग्रहण प्रतिवेदन": "ਕਾਰਜਗ੍ਰਹਣ ਰਿਪੋਰਟ",
    महोदय: "ਮਹੋਦਯ",
    मैं: "ਮੈਂ",
    दिनांक: "ਤਾਰੀਖ",
    से: "ਤੋਂ",
    तक: "ਤੱਕ",
    "दिन की": "ਦਿਨਾਂ ਦੀ",
    "आज दिनांक": "ਅੱਜ ਤਾਰੀਖ",
    को: "ਨੂੰ",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "ਤਾਰੀਖ ਨੂੰ ਮੈਂ ਆਪਣੀ ਕਾਰਜਗ੍ਰਹਣ ਰਿਪੋਰਟ ਜਮ੍ਹਾ ਕਰ ਰਿਹਾ/ਰਹੀ ਹਾਂ, ਜੋ ਦਫ਼ਤਰ ਆਦੇਸ਼ ਨੰ.",
    "के द्वारा स्वीकृत किया था।": "ਦੇ ਦੁਆਰਾ ਮਨਜ਼ੂਰ ਕੀਤਾ ਗਿਆ ਸੀ।",
    भवदीय: "ਆਪਕਾ ਵਿਸ਼ਵਾਸੀ",
    हस्ताक्षर: "ਹਸਤਾਖਰ",
    नाम: "ਨਾਮ",
    पदनाम: "ਪਦ",
    पूर्वाह्न: "ਪੂਰਵਾਹ্ন",
    अपराह्न: "ਅਪਰਾਹ্ন",
    "अर्जित छुट्टी": "ਅਰਜਿਤ ਛੁੱਟੀ",
    "अर्ध वेतन छुट्टी": "ਅਰਧ ਵੇਤਨ ਛੁੱਟੀ",
    "चिकित्सक छुट्टी": "ਚਿਕਿਤਸਾ ਛੁੱਟੀ",
    "असाधारण छुट्टी": "ਅਸਾਧਾਰਣ ਛੁੱਟੀ",
  },
  MR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "भारतीय तंत्रज्ञान संस्था रोपड",
    "नंगल रोड, रूपनगर, पंजाब-140001": "नांगल रोड, रूपनगर, पंजाब-140001",
    "सेवा में": "सेवेत",
    निदेशक: "संचालक",
    कुलसचिव: "कुलसचिव",
    "भा.प्रौ.सं.रोपड़": "भा.प्रौ.सं.रोपड",
    विभागाध्यक्ष: "विभागाध्यक्ष",
    "रिपोर्टिंग अधिकारी द्वारा": "अहवाल अधिकारीमार्फत",
    विषय: "विषय",
    "कार्यग्रहण प्रतिवेदन": "कार्यग्रहण अहवाल",
    महोदय: "महोदय",
    मैं: "मी",
    दिनांक: "दिनांक",
    से: "पासून",
    तक: "पर्यंत",
    "दिन की": "दिवसांची",
    "आज दिनांक": "आज दिनांक",
    को: "रोजी",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "रोजी मी माझा कार्यग्रहण अहवाल सादर करत आहे, जो कार्यालय आदेश क्र.",
    "के द्वारा स्वीकृत किया था।": "याद्वारे मंजूर करण्यात आला होता.",
    भवदीय: "आपला विश्वासू",
    हस्ताक्षर: "स्वाक्षरी",
    नाम: "नाव",
    पदनाम: "पदनाम",
    पूर्वाह्न: "पूर्वाह्न",
    अपराह्न: "अपराह्न",
    "अर्जित छुट्टी": "अर्जित रजा",
    "अर्ध वेतन छुट्टी": "अर्ध वेतन रजा",
    "चिकित्सक छुट्टी": "वैद्यकीय रजा",
    "असाधारण छुट्टी": "असाधारण रजा",
  },
  TA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "இந்திய தொழில்நுட்ப நிறுவனம் ரோபர்",
    "नंगल रोड, रूपनगर, पंजाब-140001": "நங்கல் சாலை, ரூப்நகர், பஞ்சாப்-140001",
    "सेवा में": "சேவையில்",
    निदेशक: "இயக்குநர்",
    कुलसचिव: "பதிவாளர்",
    "भा.प्रौ.सं.रोपड़": "பா.தொ.நி.ரோபர்",
    विभागाध्यक्ष: "துறைத் தலைவர்",
    "रिपोर्टिंग अधिकारी द्वारा": "அறிக்கை அலுவலர் மூலம்",
    विषय: "பொருள்",
    "कार्यग्रहण प्रतिवेदन": "பதவி ஏற்கும் அறிக்கை",
    महोदय: "மதிப்பிற்குரியவருக்கு",
    मैं: "நான்",
    दिनांक: "தேதி",
    से: "இருந்து",
    तक: "வரை",
    "दिन की": "நாட்களின்",
    "आज दिनांक": "இன்றைய தேதி",
    को: "அன்று",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "அன்று நான் எனது பதவி ஏற்கும் அறிக்கையை சமர்ப்பிக்கிறேன், இது அலுவலக ஆணை எண்",
    "के द्वारा स्वीकृत किया था।": "மூலம் அங்கீகரிக்கப்பட்டது.",
    भवदीय: "உங்கள் நம்பிக்கையுடன்",
    हस्ताक्षर: "கையொப்பம்",
    नाम: "பெயர்",
    पदनाम: "பதவி",
    पूर्वाह्न: "முற்பகல்",
    अपराह्न: "பிற்பகல்",
    "अर्जित छुट्टी": "சம்பாதித்த விடுப்பு",
    "अर्ध वेतन छुट्टी": "அரை சம்பள விடுப்பு",
    "चिकित्सक छुट्टी": "மருத்துவ விடுப்பு",
    "असाधारण छुट्टी": "அசாதாரண விடுப்பு",
  },
  ML: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ഇന്ത്യൻ സാങ്കേതിക സ്ഥാപനമായ റോപ്പർ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "നങ്ങൽ റോഡ്, രൂപ്‌നഗർ, പഞ്ചാബ്-140001",
    "सेवा में": "സേവയിൽ",
    निदेशक: "ഡയറക്ടർ",
    कुलसचिव: "റജിസ്ട്രാർ",
    "भा.प्रौ.सं.रोपड़": "ഭാ.പ്രൗ.സം.റോപ്പർ",
    विभागाध्यक्ष: "വകുപ്പുതലവൻ",
    "रिपोर्टिंग अधिकारी द्वारा": "റിപ്പോർട്ടിംഗ് ഓഫീസർ മുഖേന",
    विषय: "വിഷയം",
    "कार्यग्रहण प्रतिवेदन": "ചുമതല ഏറ്റെടുക്കൽ റിപ്പോർട്ട്",
    महोदय: "മഹോദയാ",
    मैं: "ഞാൻ",
    दिनांक: "തീയതി",
    से: "മുതൽ",
    तक: "വരെ",
    "दिन की": "ദിവസങ്ങളുടെ",
    "आज दिनांक": "ഇന്നത്തെ തീയതി",
    को: "നു",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "നു ഞാൻ എന്റെ ചുമതല ഏറ്റെടുക്കൽ റിപ്പോർട്ട് സമർപ്പിക്കുന്നു, ഇത് ഓഫീസ് ഉത്തരവ് നമ്പർ",
    "के द्वारा स्वीकृत किया था।": "മൂലം അംഗീകരിച്ചതാണ്.",
    भवदीय: "വിശ്വസ്തതയോടെ",
    हस्ताक्षर: "ഒപ്പ്",
    नाम: "പേര്",
    पदनाम: "പദവി",
    पूर्वाह्न: "പൂർവ്വാഹ്നം",
    अपराह्न: "അപരാഹ്നം",
    "अर्जित छुट्टी": "അർജിത അവധി",
    "अर्ध वेतन छुट्टी": "അർദ്ധ വേതന അവധി",
    "चिकित्सक छुट्टी": "ചികിത്സാ അവധി",
    "असाधारण छुट्टी": "അസാധാരണ അവധി",
  },
  UR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "انڈین انسٹی ٹیوٹ آف ٹیکنالوجی روپڑ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "ننگل روڈ، روپ نگر، پنجاب-140001",
    "सेवा में": "بخدمت",
    निदेशक: "ڈائریکٹر",
    कुलसचिव: "رجسٹرار",
    "भा.प्रौ.सं.रोपड़": "بھارت ٹیکنالوجی انسٹی ٹیوٹ روپڑ",
    विभागाध्यक्ष: "سربراہِ شعبہ",
    "रिपोर्टिंग अधिकारी द्वारा": "رپورٹنگ افسر کے ذریعے",
    विषय: "موضوع",
    "कार्यग्रहण प्रतिवेदन": "رپورٹِ جوائننگ",
    महोदय: "محترم",
    मैं: "میں",
    दिनांक: "تاریخ",
    से: "سے",
    तक: "تک",
    "दिन की": "دنوں کی",
    "आज दिनांक": "آج کی تاریخ",
    को: "کو",
    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.":
      "کو میں اپنی رپورٹِ جوائننگ جمع کر رہا/رہی ہوں، جو دفتر کے حکم نمبر",
    "के द्वारा स्वीकृत किया था।": "کے ذریعے منظور کیا گیا تھا۔",
    भवदीय: "خاکسار",
    हस्ताक्षर: "دستخط",
    नाम: "نام",
    पदनाम: "عہدہ",
    पूर्वाह्न: "قبل از دوپہر",
    अपराह्न: "بعد از دوپہر",
    "अर्जित छुट्टी": "حاصل شدہ چھٹی",
    "अर्ध वेतन छुट्टी": "نصف تنخواہ چھٹی",
    "चिकित्सक छुट्टी": "طبی چھٹی",
    "असाधारण छुट्टी": "غیر معمولی چھٹی",
  },
};

const requiredInputIds = [
  "name",
  "fromDate",
  "fromSession",
  "toDate",
  "toSession",
  "totalDays",
  "dutySession",
  "leaveCategory",
  "rejoinDate",
  "orderNo",
  "orderDate",
  "englishRejoin",
  "englishDays",
  "englishFrom",
  "englishTo",
  "englishOrder",
  "englishOrderDate",
  "signature",
  "signName",
  "signDesignation",
  "signedDate",
];

const UnderlineInput = ({
  id,
  width = "w-44",
  className,
  type = "text",
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type={type}
    className={cn(
      "inline-block align-baseline border-0 border-b border-dashed border-slate-400 bg-transparent px-1 pt-0 pb-0.5 text-sm leading-[1.05rem] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  />
);

type LocalizedOption = {
  value: string;
  hindi: string;
  english: string;
};

const DUTY_SESSION_OPTIONS: ReadonlyArray<LocalizedOption> = [
  { value: "Forenoon", hindi: "पूर्वाह्न", english: "Forenoon" },
  { value: "Afternoon", hindi: "अपराह्न", english: "Afternoon" },
];

const LEAVE_CATEGORY_OPTIONS: ReadonlyArray<LocalizedOption> = [
  { value: "Earned Leave", hindi: "अर्जित छुट्टी", english: "Earned Leave" },
  {
    value: "Half Pay Leave",
    hindi: "अर्ध वेतन छुट्टी",
    english: "Half Pay Leave",
  },
  {
    value: "Medical Leave",
    hindi: "चिकित्सक छुट्टी",
    english: "Medical Leave",
  },
  {
    value: "Extra Ordinary Leave",
    hindi: "असाधारण छुट्टी",
    english: "Extra Ordinary Leave",
  },
  { value: "Vacation Leave", hindi: "", english: "Vacation Leave" },
];

const PERIOD_SESSION_OPTIONS = [
  { value: "MORNING", label: "Morning" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
] as const;

export default function JoiningReportPage() {
  return (
    <Suspense fallback={null}>
      <JoiningReportPageContent />
    </Suspense>
  );
}

function JoiningReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<JoiningReportHistoryItem[]>([]);
  const [formLanguage, setFormLanguage] = useState<FormLanguage>("HI");
  const {
    otpEmail,
    setOtpEmail,
    otpCode,
    setOtpCode,
    otpStatusMessage,
    isSendingOtp,
    isVerifyingOtp,
    isOtpVerified,
    signatureMode,
    typedSignature,
    signatureCapture,
    onSignatureModeChange,
    onTypedSignatureChange,
    onSignatureChange,
    ensureReadyForSubmit,
    handleSendOtp,
    handleVerifyOtp,
    resetAfterSubmit,
  } = useSignatureOtp();
  const [choiceValues, setChoiceValues] = useState({
    dutySession: "",
    leaveCategory: "",
  });
  const [fromSession, setFromSession] = useState<DaySession>("MORNING");
  const [toSession, setToSession] = useState<DaySession>("EVENING");
  const [fromDateValue, setFromDateValue] = useState("");
  const [toDateValue, setToDateValue] = useState("");
  const [computedDays, setComputedDays] = useState("");
  const [workflowMessage, setWorkflowMessage] = useState(
    "This joining report will be routed automatically after submission.",
  );

  const translateHindi = useCallback(
    (text: string) => {
      if (formLanguage === "HI") return text;
      return HINDI_TRANSLATIONS[formLanguage]?.[text] ?? text;
    },
    [formLanguage],
  );

  const dutySessionOptions = DUTY_SESSION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.hindi
      ? `${translateHindi(option.hindi)} / ${option.english}`
      : option.english,
  }));

  const leaveCategoryOptions = LEAVE_CATEGORY_OPTIONS.map((option) => ({
    value: option.value,
    label: option.hindi
      ? `${translateHindi(option.hindi)} / ${option.english}`
      : option.english,
  }));

  const markMissingInputs = (form: HTMLFormElement, missing: Set<string>) => {
    const inputs = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ),
    );
    inputs.forEach((input) => {
      const key = input.name || input.id;
      const hasError = key ? missing.has(key) : false;
      input.classList.toggle("border-red-500", hasError);
      input.classList.toggle("focus:border-red-600", hasError);
      input.classList.toggle("ring-1", hasError);
      input.classList.toggle("ring-red-300", hasError);
      input.classList.toggle("focus:ring-red-400", hasError);
      input.classList.toggle("bg-red-50", hasError);
      input.setAttribute("aria-invalid", hasError ? "true" : "false");
    });
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      const safeReturnTo =
        returnTo && returnTo.startsWith("/") ? returnTo : "/";
      router.push(safeReturnTo);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRoleLocked) {
      setSubmitError("Joining report form is locked for Dean and Registrar.");
      return;
    }
    setConfirmed(false);
    setSubmitError(null);
    const form = formRef.current;
    if (!form) return;
    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;

    data.fromSession = fromSession;
    data.toSession = toSession;
    data.totalDays = computedDays;
    data.englishDays = computedDays;
    data.englishFrom = data.fromDate;
    data.englishTo = data.toDate;
    data.englishRejoin = data.rejoinDate;
    data.englishOrderDate = data.orderDate;
    data.signature =
      signatureMode === "typed"
        ? typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    if (!data.signedDate?.trim()) {
      data.signedDate = new Date().toISOString().slice(0, 10);
    }

    saveFormDraft("joining-report", data);
    const missing = requiredInputIds.filter((key) => !data[key]?.trim());
    const invalid = new Set<string>();

    if (!computedDays) {
      invalid.add("fromDate");
      invalid.add("toDate");
      invalid.add("fromSession");
      invalid.add("toSession");
      invalid.add("totalDays");
      invalid.add("englishDays");
    }

    const toDateParsed = toDateValue
      ? new Date(`${toDateValue}T00:00:00`)
      : null;
    const toMarker =
      (toDateParsed?.getTime() ?? 0) / 86400000 + SESSION_OFFSET[toSession];
    const today = new Date();
    const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
    const nowMarker =
      todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
    if (toDateValue && toMarker <= nowMarker) {
      invalid.add("toDate");
      invalid.add("toSession");
    }

    const flagged = new Set([...missing, ...invalid]);
    markMissingInputs(form, flagged);
    if (flagged.size > 0) {
      setMissingFields(Array.from(flagged));
      if (invalid.has("toSession")) {
        setSubmitError(
          "End date/session must be after the current date session and after start date/session.",
        );
      } else if (invalid.size > 0) {
        setSubmitError(
          "Please select a valid leave period. The To date must be the same as or later than the From date.",
        );
      }
      return;
    }

    const signatureError = ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Please complete Digital Signature and OTP verification on the form before submitting.",
    });
    if (signatureError) {
      setSubmitError(signatureError);
      return;
    }

    setMissingFields([]);
    setSubmitError(null);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  const setFormFieldValue = useCallback((field: string, value: string) => {
    const form = formRef.current;
    if (!form) return;

    const input = form.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[name="${field}"]`,
    );

    if (input && input.value !== value) {
      input.value = value;
    }
  }, []);

  const syncDurationFields = useCallback(
    (
      fromValue: string,
      nextFromSession: DaySession,
      toValue: string,
      nextToSession: DaySession,
    ) => {
      const value = computeSessionLeaveDaysFromInput(
        fromValue,
        nextFromSession,
        toValue,
        nextToSession,
      );
      const days = value ? formatSessionDays(value) : "";
      setFormFieldValue("totalDays", days);
      setFormFieldValue("englishDays", days);
      setComputedDays(days);
    },
    [setFormFieldValue],
  );

  const handlePeriodDateChange = (
    sourceField: "fromDate" | "toDate" | "englishFrom" | "englishTo",
    targetField: "englishFrom" | "englishTo" | "fromDate" | "toDate",
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setFormFieldValue(targetField, nextValue);

      const fromValue =
        sourceField === "fromDate" || sourceField === "englishFrom"
          ? nextValue
          : (formRef.current?.querySelector<HTMLInputElement>(
              '[name="fromDate"]',
            )?.value ?? "");
      const toValue =
        sourceField === "toDate" || sourceField === "englishTo"
          ? nextValue
          : (formRef.current?.querySelector<HTMLInputElement>('[name="toDate"]')
              ?.value ?? "");

      if (sourceField === "fromDate" || sourceField === "englishFrom") {
        setFromDateValue(nextValue);
      }
      if (sourceField === "toDate" || sourceField === "englishTo") {
        setToDateValue(nextValue);
      }

      syncDurationFields(fromValue, fromSession, toValue, toSession);
    };
  };

  const handlePeriodSessionChange = (field: "fromSession" | "toSession") => {
    return (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextSession = event.target.value as DaySession;
      const fromValue =
        formRef.current?.querySelector<HTMLInputElement>('[name="fromDate"]')
          ?.value ?? "";
      const toValue =
        formRef.current?.querySelector<HTMLInputElement>('[name="toDate"]')
          ?.value ?? "";

      if (field === "fromSession") {
        setFromSession(nextSession);
        syncDurationFields(fromValue, nextSession, toValue, toSession);
        return;
      }

      setToSession(nextSession);
      syncDurationFields(fromValue, fromSession, toValue, nextSession);
    };
  };

  const handleMirroredDateChange = (
    targetField:
      | "englishRejoin"
      | "rejoinDate"
      | "englishOrderDate"
      | "orderDate",
  ) => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setFormFieldValue(targetField, event.target.value);
    };
  };

  const handleChoiceChange = (field: "dutySession" | "leaveCategory") => {
    return (event: React.ChangeEvent<HTMLSelectElement>) => {
      setChoiceValues((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };
  };

  const handleConfirmSubmit = async () => {
    const signatureError = ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      setSubmitError(signatureError);
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/joining-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature: signatureMode !== "typed" ? signatureCapture : undefined,
          otpVerified: signatureMode !== "typed" ? isOtpVerified : false,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          referenceCode?: string;
          approverName?: string;
          approverRole?: string;
          viewerOnly?: boolean;
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to submit joining report.");
      }

      setSubmitMessage(
        `${result.message ?? "Joining report submitted successfully."}${result.data?.referenceCode ? ` Reference: ${result.data.referenceCode}.` : ""}`,
      );
      setConfirmed(true);
      setDialogState("success");
      resetAfterSubmit();
      await loadBootstrap();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to submit joining report.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    setOtpCode("");
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(form, "Joining Report");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const loadBootstrap = useCallback(async () => {
    const form = formRef.current;

    try {
      const response = await fetch("/api/joining-report/bootstrap", {
        method: "GET",
        cache: "no-store",
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: {
          defaults?: Record<string, string>;
          history?: JoiningReportHistoryItem[];
        };
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to load joining report profile data.",
        );
      }

      const defaults = result.data?.defaults ?? {};
      if (form) {
        Object.entries(defaults).forEach(([key, value]) => {
          if (!value) return;
          const input = form.querySelector<
            HTMLInputElement | HTMLSelectElement
          >(`[name="${key}"]`);
          if (input && !input.value.trim()) {
            input.value = value;
          }
        });

        const fromValue =
          form.querySelector<HTMLInputElement>('[name="fromDate"]')?.value ??
          "";
        const toValue =
          form.querySelector<HTMLInputElement>('[name="toDate"]')?.value ?? "";
        const bootFromSession =
          (form.querySelector<HTMLSelectElement>('[name="fromSession"]')
            ?.value as DaySession | undefined) ?? "MORNING";
        const bootToSession =
          (form.querySelector<HTMLSelectElement>('[name="toSession"]')
            ?.value as DaySession | undefined) ?? "EVENING";

        setFromSession(bootFromSession);
        setToSession(bootToSession);
        setFromDateValue(fromValue);
        setToDateValue(toValue);
        syncDurationFields(fromValue, bootFromSession, toValue, bootToSession);
        setChoiceValues({
          dutySession:
            form.querySelector<HTMLSelectElement>('[name="dutySession"]')
              ?.value ?? "",
          leaveCategory:
            form.querySelector<HTMLSelectElement>('[name="leaveCategory"]')
              ?.value ?? "",
        });
      }

      setHistory(result.data?.history ?? []);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to load joining report profile data.",
      );
    }
  }, [syncDurationFields]);

  useEffect(() => {
    if (!fromDateValue || !toDateValue) return;

    if (toDateValue < fromDateValue) {
      setToDateValue(fromDateValue);
      setFormFieldValue("toDate", fromDateValue);
      setToSession("EVENING");
      setFormFieldValue("toSession", "EVENING");
      return;
    }

    if (
      toDateValue === fromDateValue &&
      SESSION_OFFSET[toSession] <= SESSION_OFFSET[fromSession]
    ) {
      const nextSession =
        fromSession === "MORNING"
          ? "AFTERNOON"
          : fromSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING";
      setToSession(nextSession);
      setFormFieldValue("toSession", nextSession);
    }
  }, [fromDateValue, fromSession, toDateValue, toSession, setFormFieldValue]);

  useEffect(() => {
    const form = formRef.current;
    if (form) {
      void applyAutofillToForm(form, "joining-report").then((profile) => {
        setOtpEmail(profile.email ?? "");
      });
    }

    void loadBootstrap();
  }, [loadBootstrap, setOtpEmail]);

  useEffect(() => {
    const roleKeyRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem("lf-user-role")
        : null;

    if (roleKeyRaw === ROLE_KEYS.FACULTY) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the HoD of your department for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.STAFF) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the Registrar for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.HOD) {
      setIsRoleLocked(false);
      setSubmitError(null);
      setWorkflowMessage(
        "On submit, your joining report will be forwarded to the Dean for approval.",
      );
      return;
    }

    if (roleKeyRaw === ROLE_KEYS.DEAN || roleKeyRaw === ROLE_KEYS.REGISTRAR) {
      setIsRoleLocked(true);
      setWorkflowMessage(
        "Joining report form is locked for Dean and Registrar.",
      );
      setSubmitError("Joining report form is locked for Dean and Registrar.");
      return;
    }
  }, [history.length]);

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

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <SurfaceCard className="mx-auto max-w-3xl space-y-5 border-slate-200/80 bg-white p-6 md:p-10">
            <div className="flex justify-end">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                Language
                <select
                  id="formLanguage"
                  name="formLanguage"
                  value={formLanguage}
                  onChange={(event) =>
                    setFormLanguage(event.target.value as FormLanguage)
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                >
                  {FORM_LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col items-center gap-3 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-4 md:flex-nowrap md:justify-start">
                <div
                  className="flex items-center justify-center bg-white rounded-full border border-slate-200 p-2"
                  style={{ minWidth: 120, minHeight: 120 }}
                >
                  <Image
                    src="/iit_ropar.png"
                    alt="IIT Ropar"
                    width={120}
                    height={120}
                    priority
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="space-y-1 text-slate-900">
                  <p className="text-lg font-semibold">
                    {translateHindi("भारतीय प्रौद्योगिकी संस्थान रोपड़")}
                  </p>
                  <p className="text-lg font-semibold uppercase">
                    INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                  </p>
                  <p className="text-xs text-slate-700">
                    {translateHindi("नंगल रोड, रूपनगर, पंजाब-140001")} / Nangal
                    Road, Rupnagar, Punjab-140001
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-sm text-slate-800">
              <p>{translateHindi("सेवा में")} / To,</p>
              <p>
                {translateHindi("निदेशक")} / {translateHindi("कुलसचिव")} /
                Director / Registrar
              </p>
              <p>{translateHindi("भा.प्रौ.सं.रोपड़")} / IIT Ropar</p>
            </div>

            <p className="text-center text-sm font-semibold text-slate-900">
              {translateHindi("विभागाध्यक्ष")} /{" "}
              {translateHindi("रिपोर्टिंग अधिकारी द्वारा")} / Through
              HOD/Reporting Officer
            </p>

            <div className="text-center text-sm font-semibold text-slate-900">
              {translateHindi("विषय")} / Sub :{" "}
              {translateHindi("कार्यग्रहण प्रतिवेदन")} / JOINING REPORT
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-900">
              <p>{translateHindi("महोदय")} / Sir,</p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>{translateHindi("मैं")},</span>
                <UnderlineInput id="name" width="w-56" />
                <span>{translateHindi("दिनांक")}</span>
                <DateUnderlineInput
                  id="fromDate"
                  width="w-36"
                  min={getTodayIso()}
                  onChange={handlePeriodDateChange("fromDate", "englishFrom")}
                />
                <InlineSelect
                  id="fromSession"
                  width="w-32"
                  options={PERIOD_SESSION_OPTIONS}
                  value={fromSession}
                  onChange={handlePeriodSessionChange("fromSession")}
                />
                <span>{translateHindi("से")}</span>
                <DateUnderlineInput
                  id="toDate"
                  width="w-36"
                  min={fromDateValue || getTodayIso()}
                  onChange={handlePeriodDateChange("toDate", "englishTo")}
                />
                <InlineSelect
                  id="toSession"
                  width="w-32"
                  options={PERIOD_SESSION_OPTIONS}
                  value={toSession}
                  onChange={handlePeriodSessionChange("toSession")}
                />
                <span>{translateHindi("तक")}</span>
                <UnderlineInput id="totalDays" width="w-16" readOnly />
                <span>{translateHindi("दिन की")}</span>
                <InlineSelect
                  id="leaveCategory"
                  width="w-72"
                  options={leaveCategoryOptions}
                  value={choiceValues.leaveCategory}
                  onChange={handleChoiceChange("leaveCategory")}
                />
              </p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>{translateHindi("आज दिनांक")}</span>
                <DateUnderlineInput
                  id="rejoinDate"
                  width="w-36"
                  onChange={handleMirroredDateChange("englishRejoin")}
                />
                <span>{translateHindi("को")}</span>
                <InlineSelect
                  id="dutySession"
                  width="w-52"
                  options={dutySessionOptions}
                  value={choiceValues.dutySession}
                  onChange={handleChoiceChange("dutySession")}
                />
                <span>
                  {translateHindi(
                    "को अपना कार्यग्रहण प्रतिवेदन जमा कर रहा / रही हूँ, जो की कार्यालय आदेश सं.",
                  )}
                </span>
                <UnderlineInput id="orderNo" width="w-48" />
                <span>{translateHindi("दिनांक")}</span>
                <DateUnderlineInput
                  id="orderDate"
                  width="w-36"
                  onChange={handleMirroredDateChange("englishOrderDate")}
                />
                <span>{translateHindi("के द्वारा स्वीकृत किया था।")}</span>
              </p>

              <p className="flex flex-wrap items-center gap-2 leading-relaxed">
                <span>I, hereby report myself for duty this day on</span>
                <DateUnderlineInput
                  id="englishRejoin"
                  width="w-40"
                  className="ml-2"
                  onChange={handleMirroredDateChange("rejoinDate")}
                />{" "}
                <span>
                  {choiceValues.dutySession || "forenoon / afternoon"} after
                  availing
                </span>
                <span>
                  {choiceValues.leaveCategory ||
                    "Earned Leave / Half Pay Leave / Medical Leave / Extra Ordinary Leave / Vacation Leave"}
                </span>
                <span>for</span>
                <UnderlineInput
                  id="englishDays"
                  width="w-16"
                  className="ml-2"
                  readOnly
                />{" "}
                <span>days from</span>
                <DateUnderlineInput
                  id="englishFrom"
                  width="w-40"
                  className="ml-2"
                  onChange={handlePeriodDateChange("englishFrom", "fromDate")}
                />{" "}
                <span>to</span>
                <DateUnderlineInput
                  id="englishTo"
                  width="w-40"
                  className="ml-2"
                  onChange={handlePeriodDateChange("englishTo", "toDate")}
                />{" "}
                <span>sanctioned vide Office Order No.</span>
                <UnderlineInput
                  id="englishOrder"
                  width="w-48"
                  className="ml-2"
                />{" "}
                <span>dated</span>
                <DateUnderlineInput
                  id="englishOrderDate"
                  width="w-36"
                  className="ml-2"
                  onChange={handleMirroredDateChange("orderDate")}
                />
                .
              </p>

              <div className="space-y-1 text-right">
                <p>{translateHindi("भवदीय")} / Yours faithfully</p>
                <p>
                  {translateHindi("हस्ताक्षर")} / Signature:{" "}
                  <input
                    type="hidden"
                    id="signature"
                    name="signature"
                    value={
                      signatureMode === "typed"
                        ? typedSignature
                        : DIGITAL_SIGNATURE_VALUE
                    }
                    readOnly
                  />
                  <span className="inline-flex h-9 w-56 items-end border-b border-dashed border-slate-400 px-1 pb-0.5 align-middle text-left text-sm text-slate-900">
                    {signatureMode === "typed" ? (
                      typedSignature
                    ) : signatureCapture ? (
                      <Image
                        src={signatureCapture.image}
                        alt="Applicant signature"
                        width={224}
                        height={36}
                        unoptimized
                        className="h-8 w-full object-contain"
                      />
                    ) : (
                      "DIGITALLY_SIGNED"
                    )}
                  </span>
                </p>
                <p>
                  {translateHindi("नाम")} / Name :{" "}
                  <UnderlineInput id="signName" width="w-48" />
                </p>
                <p>
                  {translateHindi("पदनाम")} / Designation:{" "}
                  <UnderlineInput id="signDesignation" width="w-44" />
                </p>
              </div>

              <p className="text-right">
                {translateHindi("दिनांक")} / Dated:{" "}
                <DateUnderlineInput id="signedDate" width="w-40" />
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-2 border-slate-200/80 p-4">
            <p className="text-sm font-semibold text-slate-900">Routing</p>
            <p className="text-sm text-slate-600">{workflowMessage}</p>
          </SurfaceCard>

          {history.length > 0 ? (
            <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Recent joining reports
              </p>
              <div className="space-y-2">
                {history.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 px-3 py-2 text-xs text-slate-700"
                  >
                    <p className="font-semibold text-slate-900">
                      {item.referenceCode}
                    </p>
                    <p>
                      {new Date(item.from).toLocaleDateString("en-GB")} to{" "}
                      {new Date(item.to).toLocaleDateString("en-GB")} (
                      {item.totalDays} days)
                    </p>
                    <p>
                      Status: {item.status} | Routed to: {item.approver}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          ) : null}

          <SignatureOtpVerificationCard
            storageScope="joining-report"
            signatureMode={signatureMode}
            onSignatureModeChange={onSignatureModeChange}
            typedSignature={typedSignature}
            onTypedSignatureChange={onTypedSignatureChange}
            otpEmail={otpEmail}
            otpCode={otpCode}
            onOtpCodeChange={setOtpCode}
            otpStatusMessage={otpStatusMessage}
            isSendingOtp={isSendingOtp}
            isVerifyingOtp={isVerifyingOtp}
            isSubmitting={isSubmitting}
            onSendOtp={handleSendOtp}
            onVerifyOtp={handleVerifyOtp}
            onSignatureChange={onSignatureChange}
            isOtpVerified={isOtpVerified}
          />

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-600">
              {submitError
                ? submitError
                : submitMessage
                  ? submitMessage
                  : confirmed
                    ? "Submission confirmed. You can still edit and resubmit if needed."
                    : missingFields.length > 0
                      ? "Please fill the highlighted fields."
                      : "Fill all fields, then submit."}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="px-4 text-sm"
                disabled={isRoleLocked}
              >
                {isRoleLocked ? "Locked" : "Submit"}
              </Button>
            </div>
          </div>
        </form>

        <ConfirmationModal
          state={dialogState}
          title="Joining Report"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
          isSubmitting={isSubmitting}
        />
      </div>
    </DashboardShell>
  );
}

const DateUnderlineInput = ({
  id,
  width = "w-36",
  className,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <UnderlineInput
    id={id}
    type="date"
    width={width}
    className={cn("scheme-light", className)}
    {...props}
  />
);

const InlineSelect = ({
  id,
  width = "w-56",
  value,
  options,
  className,
  ...props
}: {
  id: string;
  width?: string;
  value: string;
  className?: string;
  options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">) => (
  <select
    id={id}
    name={id}
    value={value}
    className={cn(
      "inline-block rounded-none border-0 border-b border-dashed border-slate-400 bg-transparent px-1 pt-0 pb-0.5 text-sm leading-[1.05rem] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  >
    <option value="">Select</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

const ConfirmationModal = ({
  state,
  title,
  onCancel,
  onConfirm,
  onDownload,
  isDownloading,
  isSubmitting,
}: {
  state: DialogState;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  isSubmitting: boolean;
}) => {
  if (!state) return null;
  const isSuccess = state === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">
            {isSuccess ? "Submission successful" : "Confirm submission"}
          </p>
          <p className="text-xs text-slate-600">
            {isSuccess
              ? `${title} has been submitted successfully. You may close this window.`
              : `You are about to submit the ${title} form. Please review and confirm the details before continuing.`}
          </p>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm text-slate-800">
          {isSuccess ? (
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
              <li>Submission received and recorded.</li>
              <li>You may keep a copy for your records.</li>
            </ul>
          ) : (
            <div className="space-y-4">
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-slate-700">
                <li>I confirm the information provided is accurate.</li>
                <li>I acknowledge the submission will be routed for review.</li>
                <li>I understand I may be contacted for clarifications.</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {isSuccess ? (
            <>
              <Button
                type="button"
                onClick={onDownload}
                className="px-4 text-sm"
                disabled={isDownloading}
              >
                {isDownloading ? "Preparing..." : "Download PDF"}
              </Button>
              <Button type="button" onClick={onCancel} className="px-4 text-sm">
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={onCancel}
                className="px-3 text-sm"
                type="button"
              >
                Go back
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                className="px-4 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Yes, submit"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
