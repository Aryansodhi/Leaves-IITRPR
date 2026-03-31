"use client";

export const dynamic = "force-dynamic";

import type { FormEvent, InputHTMLAttributes } from "react";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  SignatureOtpVerificationCard,
  type SignatureCapture,
  type SignatureMode,
} from "@/components/leaves/signature-otp-verification-card";
import { ProposedActingHodField } from "@/components/leaves/proposed-acting-hod-field";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
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
} from "@/lib/leave-session";
import {
  applyAutofillToForm,
  clearFormDraft,
  saveFormDraft,
} from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;
type FormLanguage = "HI" | "TE" | "PA" | "MR" | "TA" | "ML" | "UR";

type WorkflowPreview = {
  label: string;
  steps: Array<{ actor: string; label: string }>;
  note?: string;
};

const LTC_WORKFLOW_PREVIEWS: Array<WorkflowPreview & { key: string }> = [
  {
    key: "FACULTY",
    label: "Faculty",
    steps: [
      { actor: "HOD", label: "HoD / Associate HoD" },
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "DEAN", label: "Dean" },
    ],
    note: "The HoD step is chosen from your department mapping (fallback: reporting officer if configured).",
  },
  {
    key: "STAFF",
    label: "Staff",
    steps: [
      { actor: "HOD", label: "HoD / Associate HoD" },
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "DEAN", label: "Dean" },
    ],
  },
  {
    key: "HOD",
    label: "HoD",
    steps: [
      { actor: "ESTABLISHMENT", label: "Establishment" },
      { actor: "ACCOUNTS", label: "Accounts" },
      { actor: "DEAN", label: "Dean" },
    ],
  },
];

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
    "रूपनगर, पंजाब-140001": "రూపనగర్, పంజాబ్-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "లీవ్ ట్రావెల్ కన్సెషన్ కోసం దరఖాస్తు",
    "कर्मचारी का नाम एवं कर्मचारी कोड": "ఉద్యోగి పేరు మరియు ఉద్యోగి కోడ్",
    "पदनाम और विभाग": "పదవి మరియు విభాగం",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "కేంద్ర ప్రభుత్వ సేవలో చేరిన తేదీ/ఐఐటీ రోపర్‌లో చేరిన తేదీ",
    "वेतन स्तर": "వేతన స్థాయి",
    "छुट्टी की आवश्यकता": "సెలవు అవసరం",
    प्रकृति: "ప్రకృతి",
    से: "నుంచి",
    तक: "వరకు",
    पूर्वाह्न: "పూర్వాహ్నం",
    अपराह्न: "అపరాహ్నం",
    सायं: "సాయంత్రం",
    "दिनों की संख्या": "రోజుల సంఖ్య",
    "पूर्व (Prefix): से": "ప్రీఫిక్స్: నుండి",
    "पश्च (Suffix): से": "సఫిక్స్: నుండి",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "జీవిత భాగస్వామి ఉద్యోగంలో ఉన్నారా, అయితే LTCకు అర్హులా",
    "यात्रा की प्रस्तावित तिथियां": "ప్రయాణానికి ప్రతిపాదిత తేదీలు",
    "बाह्य यात्रा की तिथि": "బయలుదేరే ప్రయాణ తేదీ",
    "आंतरिक यात्रा की तिथि": "తిరుగు ప్రయాణ తేదీ",
    स्वयं: "స్వయం",
    परिवार: "కుటుంబం",
    "गृह नगर सेवा पुस्तिका में दर्ज": "సేవా పుస్తకంలో నమోదైన స్వగ్రామం",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "ఎల్టీసీ రకం: స్వగ్రామం/భారతదేశంలో ఎక్కడైనా",
    "भ्रमण का स्थान": "సందర్శించాల్సిన స్థలం",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "అర్హత గల తరగతిలో రాకపోకల మొత్తం అంచనా చార్జీలు (సాక్ష్యం జత చేయాలి)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है":
      "ఎల్టీసీ కోసం ప్రతిపాదించిన వ్యక్తులు",
    क्रम: "క్రమం",
    नाम: "పేరు",
    आयु: "వయస్సు",
    संबंध: "సంబంధం",
    "यात्रा (स्थान) से": "ప్రయాణం (స్థలం) నుండి",
    "वापसी (हाँ/नहीं)": "వాపసి (అవును/కాదు)",
    "यात्रा का माध्यम": "ప్రయాణ విధానం",
    "अग्रिम आवश्यक": "అగ్రిమం అవసరం",
    चुनें: "ఎంచుకోండి",
    हाँ: "అవును",
    नहीं: "కాదు",
    "अर्जित अवकाश नकदीकरण आवश्यक": "అర్జిత సెలవు నగదీకరణ అవసరం",
    दिन: "రోజులు",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "విమాన ప్రయాణానికి ముఖ్య గమనిక",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "ప్రభుత్వ ఉద్యోగులు తమ అర్హత గల తరగతిలో అందుబాటులో ఉన్న అత్యల్ప చార్జీని ఎంపిక చేయాలి.",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।":
      "బుకింగ్ సమయంలో సంబంధిత ఎటీఏ వెబ్‌పేజీ ప్రింట్‌ఔట్‌ను భద్రపరచాలి.",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "విమాన టిక్కెట్లు కేవలం మూడు అధీకృత ట్రావెల్ ఏజెంట్ల (ఎటీఏ) నుంచే కొనాలి.",
    "मैं यह प्रतिज्ञा करता/करती हूं": "నేను ఈ విధంగా ప్రకటిస్తున్నాను",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(క) అడ్వాన్స్ అందుకున్న 10 రోజుల్లో ప్రయాణ టికెట్లు సమర్పిస్తాను.",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(ఖ) ప్రయాణం రద్దయితే రెండు నెలల్లో అడ్వాన్స్ మొత్తాన్ని తిరిగి చెల్లిస్తాను.",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(గ) నా హక్కు ప్రకారం విమాన/రైలు/రోడ్డు ద్వారా ప్రయాణిస్తాను.",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(ఘ) ప్రకటించిన స్థలం లేదా తేదీల మార్పు ఉంటే సంబంధిత అధికారికి తెలియజేస్తాను.",
    "प्रमाणित किया जाता है कि": "ఇది ధృవీకరించబడింది",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) పై ఇచ్చిన సమాచారం నిజమైంది.",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) ఈ బ్లాక్ సంవత్సరానికి నా జీవిత భాగస్వామి ఎల్టీసీ పొందలేదు.",
    "ब्लॉक वर्ष": "బ్లాక్ సంవత్సరం",
    "कृपया अग्रेषित करें": "దయచేసి ముందుకు పంపండి",
    "आवेदक के हस्ताक्षर दिनांक सहित": "దరఖాస్తుదారుడి సంతకం తేదీతో",
    "प्रमुख/अनुभाग प्रभारी": "ప్రధానుడు/విభాగ అధికారి",
  },
  PA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ਭਾਰਤੀ ਪ੍ਰੌਧੋਗਿਕੀ ਸੰਸਥਾਨ ਰੋਪੜ",
    "रूपनगर, पंजाब-140001": "ਰੂਪਨਗਰ, ਪੰਜਾਬ-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "ਛੁੱਟੀ ਯਾਤਰਾ ਰਿਆਇਤ ਲਈ ਅਰਜ਼ੀ",
    "कर्मचारी का नाम एवं कर्मचारी कोड": "ਕਰਮਚਾਰੀ ਦਾ ਨਾਮ ਅਤੇ ਕਰਮਚਾਰੀ ਕੋਡ",
    "पदनाम और विभाग": "ਪਦ ਅਤੇ ਵਿਭਾਗ",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "ਕੇਂਦਰੀ ਸਰਕਾਰ ਸੇਵਾ ਵਿੱਚ ਸ਼ਾਮਿਲ ਹੋਣ ਦੀ ਤਾਰੀਖ/ਆਈਆਈਟੀ ਰੋਪੜ ਵਿੱਚ ਸ਼ਾਮਿਲ ਹੋਣ ਦੀ ਤਾਰੀਖ",
    "वेतन स्तर": "ਵੇਤਨ ਪੱਧਰ",
    "छुट्टी की आवश्यकता": "ਛੁੱਟੀ ਦੀ ਲੋੜ",
    प्रकृति: "ਕਿਸਮ",
    से: "ਤੋਂ",
    तक: "ਤੱਕ",
    पूर्वाह्न: "ਪੂਰਵਾਹਨ",
    अपराह्न: "ਅਪਰਾਹਨ",
    सायं: "ਸ਼ਾਮ",
    "दिनों की संख्या": "ਦਿਨਾਂ ਦੀ ਗਿਣਤੀ",
    "पूर्व (Prefix): से": "ਪ੍ਰੀਫਿਕਸ: ਤੋਂ",
    "पश्च (Suffix): से": "ਸਫਿਕਸ: ਤੋਂ",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "ਕੀ ਜੀਵਨਸਾਥੀ ਨੌਕਰੀ ਕਰਦਾ/ਕਰਦੀ ਹੈ, ਜੇ ਹਾਂ ਤਾਂ ਕੀ LTC ਲਈ ਯੋਗ ਹੈ",
    "यात्रा की प्रस्तावित तिथियां": "ਯਾਤਰਾ ਦੀਆਂ ਪ੍ਰਸਤਾਵਿਤ ਤਰੀਖਾਂ",
    "बाह्य यात्रा की तिथि": "ਬਾਹਰਲੀ ਯਾਤਰਾ ਦੀ ਤਾਰੀਖ",
    "आंतरिक यात्रा की तिथि": "ਵਾਪਸੀ ਯਾਤਰਾ ਦੀ ਤਾਰੀਖ",
    स्वयं: "ਆਪ",
    परिवार: "ਪਰਿਵਾਰ",
    "गृह नगर सेवा पुस्तिका में दर्ज": "ਸੇਵਾ ਪੁਸਤਕ ਵਿੱਚ ਦਰਜ ਘਰ ਸ਼ਹਿਰ",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "ਐਲਟੀਸੀ ਦੀ ਕਿਸਮ: ਘਰ ਸ਼ਹਿਰ/ਭਾਰਤ ਵਿੱਚ ਕਿਤੇ ਵੀ",
    "भ्रमण का स्थान": "ਦੌਰੇ ਦਾ ਸਥਾਨ",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "ਆਉਣ-ਜਾਣ ਯਾਤਰਾ ਲਈ ਹੱਕਦਾਰ ਵਰਗ ਦਾ ਅਨੁਮਾਨਿਤ ਕਿਰਾਇਆ (ਸਬੂਤ ਨਾਲ ਜੋੜੋ)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है":
      "ਜਿਨ੍ਹਾਂ ਲਈ ਐਲਟੀਸੀ ਪ੍ਰਸਤਾਵਿਤ ਹੈ",
    क्रम: "ਕ੍ਰਮ",
    नाम: "ਨਾਮ",
    आयु: "ਉਮਰ",
    संबंध: "ਸੰਬੰਧ",
    "यात्रा (स्थान) से": "ਯਾਤਰਾ (ਸਥਾਨ) ਤੋਂ",
    "वापसी (हाँ/नहीं)": "ਵਾਪਸੀ (ਹਾਂ/ਨਹੀਂ)",
    "यात्रा का माध्यम": "ਯਾਤਰਾ ਦਾ ਢੰਗ",
    "अग्रिम आवश्यक": "ਅਗਾਊਂ ਦੀ ਲੋੜ",
    चुनें: "ਚੁਣੋ",
    हाँ: "ਹਾਂ",
    नहीं: "ਨਹੀਂ",
    "अर्जित अवकाश नकदीकरण आवश्यक": "ਅਰਜਿਤ ਛੁੱਟੀ ਨਕਦੀਕਰਨ ਲੋੜੀਂਦਾ",
    दिन: "ਦਿਨ",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "ਹਵਾਈ ਯਾਤਰਾ ਲਈ ਮਹੱਤਵਪੂਰਨ ਨੋਟ",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "ਸਰਕਾਰੀ ਕਰਮਚਾਰੀ ਆਪਣੀ ਹੱਕਦਾਰ ਸ਼੍ਰੇਣੀ ਵਿੱਚ ਸਭ ਤੋਂ ਸਸਤਾ ਉਪਲਬਧ ਕਿਰਾਇਆ ਚੁਣਣ।",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंਟआउट सुरक्षित रखें।":
      "ਬੁਕਿੰਗ ਵੇਲੇ ਸੰਬੰਧਤ ਏਟੀਆ ਦੀ ਵੈਬਸਾਈਟ ਦਾ ਪ੍ਰਿੰਟਆਉਟ ਸੰਭਾਲ ਕੇ ਰੱਖੋ।",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "ਹਵਾਈ ਟਿਕਟ ਸਿਰਫ਼ ਤਿੰਨ ਅਧਿਕ੍ਰਿਤ ਟ੍ਰੈਵਲ ਏਜੈਂਟਾਂ (ਏਟੀਆ) ਤੋਂ ਹੀ ਖਰੀਦੋ।",
    "मैं यह प्रतिज्ञा करता/करती हूं": "ਮੈਂ ਇਹ ਘੋਸ਼ਣਾ ਕਰਦਾ/ਕਰਦੀ ਹਾਂ",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(ਕ) ਅਗਾਊਂ ਪ੍ਰਾਪਤੀ ਦੇ 10 ਦਿਨਾਂ ਵਿੱਚ ਯਾਤਰਾ ਦੇ ਟਿਕਟ ਪੇਸ਼ ਕਰਾਂਗਾ।",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(ਖ) ਯਾਤਰਾ ਰੱਦ ਹੋਣ ਤੇ ਦੋ ਮਹੀਨੇ ਵਿੱਚ ਅਗਾਊਂ ਰਕਮ ਵਾਪਸ ਕਰਾਂਗਾ।",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(ਗ) ਮੈਂ ਆਪਣੇ ਹੱਕ ਅਨੁਸਾਰ ਹਵਾਈ/ਰੇਲ/ਸੜਕ ਰਾਹੀਂ ਯਾਤਰਾ ਕਰਾਂਗਾ।",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(ਘ) ਜੇ ਘੋਸ਼ਿਤ ਸਥਾਨ ਜਾਂ ਤਰੀਖਾਂ ਵਿੱਚ ਬਦਲਾਅ ਹੋਵੇ ਤਾਂ ਅਧਿਕਾਰਤ ਅਧਿਕਾਰੀ ਨੂੰ ਸੂਚਿਤ ਕਰਾਂਗਾ।",
    "प्रमाणित किया जाता है कि": "ਇਹ ਪ੍ਰਮਾਣਿਤ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਕਿ",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) ਉਪਰੋਕਤ ਜਾਣਕਾਰੀ ਸਹੀ ਹੈ।",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) ਮੇਰੇ ਜੀਵਨਸਾਥੀ ਵੱਲੋਂ ਇਸ ਬਲਾਕ ਸਾਲ ਲਈ ਐਲਟੀਸੀ ਨਹੀਂ ਲਿਆ ਗਿਆ ਹੈ।",
    "ब्लॉक वर्ष": "ਬਲਾਕ ਸਾਲ",
    "कृपया अग्रेषित करें": "ਕਿਰਪਾ ਕਰਕੇ ਅਗੇ ਭੇਜੋ",
    "आवेदक के हस्ताक्षर दिनांक सहित": "ਅਰਜ਼ੀਕਰਤਾ ਦੇ ਦਸਤਖ਼ਤ ਤਾਰੀਖ਼ ਸਮੇਤ",
    "प्रमुख/अनुभाग प्रभारी": "ਮੁੱਖ/ਸੈਕਸ਼ਨ ਇੰਚਾਰਜ",
  },
  MR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "भारतीय तंत्रज्ञान संस्था रोपड",
    "रूपनगर, पंजाब-140001": "रूपनगर, पंजाब-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "रजा प्रवास सवलतीसाठी अर्ज",
    "कर्मचारी का नाम एवं कर्मचारी कोड": "कर्मचारीचे नाव आणि कर्मचारी कोड",
    "पदनाम और विभाग": "पदनाम आणि विभाग",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "केंद्रीय सरकार सेवेत प्रवेशाची तारीख/आयआयटी रोपडमध्ये रुजू होण्याची तारीख",
    "वेतन स्तर": "वेतन स्तर",
    "छुट्टी की आवश्यकता": "रजेची गरज",
    प्रकृति: "प्रकार",
    से: "पासून",
    तक: "पर्यंत",
    पूर्वाह्न: "पूर्वाह्न",
    अपराह्न: "अपराह्न",
    सायं: "सायंकाळ",
    "दिनों की संख्या": "दिवसांची संख्या",
    "पूर्व (Prefix): से": "प्रीफिक्स: पासून",
    "पश्च (Suffix): से": "सफिक्स: पासून",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "जिवनसाथी नोकरीत आहे का, असल्यास LTC साठी पात्र आहे का",
    "यात्रा की प्रस्तावित तिथियां": "प्रवासाच्या प्रस्तावित तारखा",
    "बाह्य यात्रा की तिथि": "बाह्य प्रवासाची तारीख",
    "आंतरिक यात्रा की तिथि": "परतीच्या प्रवासाची तारीख",
    स्वयं: "स्वतः",
    परिवार: "कुटुंब",
    "गृह नगर सेवा पुस्तिका में दर्ज": "सेवा पुस्तिकेत नोंदवलेले गृह नगर",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "एलटीसी प्रकार: गृह नगर/भारतामध्ये कुठेही",
    "भ्रमण का स्थान": "भ्रमणाचे ठिकाण",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "ये-जा प्रवासासाठी पात्र वर्गाचे अंदाजित भाडे (पुरावा संलग्न करा)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है":
      "ज्यांच्यासाठी एलटीसी प्रस्तावित आहे",
    क्रम: "क्रमांक",
    नाम: "नाव",
    आयु: "वय",
    संबंध: "नाते",
    "यात्रा (स्थान) से": "प्रवास (स्थळ) पासून",
    "वापसी (हाँ/नहीं)": "परती (हो/नाही)",
    "यात्रा का माध्यम": "प्रवासाचे माध्यम",
    "अग्रिम आवश्यक": "अग्रिम आवश्यक",
    चुनें: "निवडा",
    हाँ: "हो",
    नहीं: "नाही",
    "अर्जित अवकाश नकदीकरण आवश्यक": "अर्जित रजा नकदीकरण आवश्यक",
    दिन: "दिवस",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "हवाई प्रवासासाठी महत्त्वाची नोंद",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "सरकारी कर्मचाऱ्यांनी पात्र श्रेणीत उपलब्ध सर्वात कमी भाडे निवडावे.",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।":
      "बुकिंगवेळी संबंधित एटीएच्या वेबसाइटचा प्रिंटआउट जतन ठेवा.",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "हवाई तिकीट फक्त तीन अधिकृत ट्रॅव्हल एजंट (एटीए) कडूनच खरेदी करा.",
    "मैं यह प्रतिज्ञा करता/करती हूं": "मी ही प्रतिज्ञा करतो/करते",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(क) अग्रिम मिळाल्यानंतर 10 दिवसांत प्रवासाची तिकिटे सादर करेन.",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(ख) प्रवास रद्द झाल्यास दोन महिन्यांत अग्रिम रक्कम परत करेन.",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(ग) मी माझ्या हक्कानुसार हवाई/रेल/रस्त्याने प्रवास करेन.",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(घ) घोषित स्थळ किंवा तारखेत बदल झाल्यास सक्षम प्राधिकाऱ्यांना कळवेन.",
    "प्रमाणित किया जाता है कि": "प्रमाणित केले जाते की",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) वर दिलेली माहिती खरी आहे.",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) माझ्या जीवनसाथीने या ब्लॉक वर्षासाठी एलटीसी घेतलेले नाही.",
    "ब्लॉक वर्ष": "ब्लॉक वर्ष",
    "कृपया अग्रेषित करें": "कृपया पुढे पाठवा",
    "आवेदक के हस्ताक्षर दिनांक सहित": "अर्जदाराची सही दिनांकासह",
    "प्रमुख/अनुभाग प्रभारी": "प्रमुख/अनुभाग प्रभारी",
  },
  TA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "இந்திய தொழில்நுட்ப நிறுவனம் ரோபர்",
    "रूपनगर, पंजाब-140001": "ரூப்நகர், பஞ்சாப்-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "விடுப்பு பயண சலுகைக்கான விண்ணப்பம்",
    "कर्मचारी का नाम एवं कर्मचारी कोड":
      "பணியாளர் பெயர் மற்றும் பணியாளர் குறியீடு",
    "पदनाम और विभाग": "பதவி மற்றும் துறை",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "மத்திய அரசு சேவையில் சேர்ந்த தேதி/ஐஐடி ரோபரில் சேர்ந்த தேதி",
    "वेतन स्तर": "சம்பள நிலை",
    "छुट्टी की आवश्यकता": "விடுப்பு தேவை",
    प्रकृति: "வகை",
    से: "இருந்து",
    तक: "வரை",
    पूर्वाह्न: "முற்பகல்",
    अपराह्न: "பிற்பகல்",
    सायं: "மாலை",
    "दिनों की संख्या": "நாட்களின் எண்ணிக்கை",
    "पूर्व (Prefix): से": "முன் (Prefix): இருந்து",
    "पश्च (Suffix): से": "பின் (Suffix): இருந்து",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "துணை வேலை செய்கிறாரா, அப்படியானால் LTCக்கு தகுதியா",
    "यात्रा की प्रस्तावित तिथियां": "பயணத்திற்கான முன்மொழியப்பட்ட தேதிகள்",
    "बाह्य यात्रा की तिथि": "புறப்பாட்டு பயண தேதி",
    "आंतरिक यात्रा की तिथि": "திரும்பும் பயண தேதி",
    स्वयं: "தான்",
    परिवार: "குடும்பம்",
    "गृह नगर सेवा पुस्तिका में दर्ज": "சேவை புத்தகத்தில் பதிவான சொந்த ஊர்",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "எல்டிசி வகை: சொந்த ஊர்/இந்தியாவில் எங்கும்",
    "भ्रमण का स्थान": "பார்வையிட வேண்டிய இடம்",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "செல்லவும் வரவும் உரிய வகைக்கான மதிப்பிடப்பட்ட கட்டணம் (சான்று இணைக்கவும்)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है": "எல்டிசி பெறுவோர்",
    क्रम: "வரிசை",
    नाम: "பெயர்",
    आयु: "வயது",
    संबंध: "உறவு",
    "यात्रा (स्थान) से": "பயணம் (இடம்) இருந்து",
    "वापसी (हाँ/नहीं)": "திரும்புதல் (ஆம்/இல்லை)",
    "यात्रा का माध्यम": "பயண முறை",
    "अग्रिम आवश्यक": "முன்பணம் தேவை",
    चुनें: "தேர்ந்தெடுக்கவும்",
    हाँ: "ஆம்",
    नहीं: "இல்லை",
    "अर्जित अवकाश नकदीकरण आवश्यक": "சம்பாதித்த விடுப்பு பணமாக்கல் தேவை",
    दिन: "நாட்கள்",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "விமானப் பயணத்திற்கான முக்கிய குறிப்பு",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "அரசு ஊழியர்கள் தகுதி வகையில் கிடைக்கப்பெறும் குறைந்த கட்டணத்தை தேர்வு செய்ய வேண்டும்.",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।":
      "பதிவில் தொடர்புடைய ஏடிஏ வலைப்பக்கத்தின் பிரிண்ட் அவுட்டை வைத்திருக்க வேண்டும்.",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "விமான டிக்கெட்டுகள் மூன்று அங்கீகாரம் பெற்ற பயண முகவர்களிடமிருந்து (ஏடிஏ) மட்டுமே வாங்கப்பட வேண்டும்.",
    "मैं यह प्रतिज्ञा करता/करती हूं": "நான் இவ்வாறு உறுதி அளிக்கிறேன்",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(க) முன்பணம் பெற்ற 10 நாட்களில் பயண டிக்கெட்களை சமர்ப்பிப்பேன்.",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(க) பயணம் ரத்து ஆனால் இரண்டு மாதங்களுக்குள் முன்பணத்தை திருப்பி செலுத்துவேன்.",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(க) என் உரிமைப்படி விமானம்/ரயில்/சாலை வழியாக பயணம் செய்வேன்.",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(க) அறிவித்த இடம் அல்லது தேதிகளில் மாற்றம் হলে உரிய அதிகாரியை அறிவிப்பேன்.",
    "प्रमाणित किया जाता है कि": "இதனைச் சான்றளிக்கிறேன்",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) மேலே உள்ள தகவல் உண்மையானது.",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) இந்த பிளாக் ஆண்டுக்கு என் துணை எல்டிசி பெறவில்லை.",
    "ब्लॉक वर्ष": "பிளாக் ஆண்டு",
    "कृपया अग्रेषित करें": "தயவு செய்து முன்னேற்றவும்",
    "आवेदक के हस्ताक्षर दिनांक सहित": "விண்ணப்பதாரரின் கையொப்பம் தேதி உடன்",
    "प्रमुख/अनुभाग प्रभारी": "தலைவர்/பிரிவு பொறுப்பாளர்",
  },
  ML: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ഇന്ത്യൻ സാങ്കേതിക സ്ഥാപനമായ റോപ്പർ",
    "रूपनगर, पंजाब-140001": "രൂപ്‌നഗർ, പഞ്ചാബ്-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "അവധിയാത്രാ ആനുകൂല്യത്തിനുള്ള അപേക്ഷ",
    "कर्मचारी का नाम एवं कर्मचारी कोड": "ജീവനക്കാരന്റെ പേര് & കോഡ്",
    "पदनाम और विभाग": "പദവി 및 വകുപ്പ്",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "കേന്ദ്ര സർക്കാർ സേവനത്തിൽ പ്രവേശിച്ച തീയതി/ഐഐടി റോപ്പറിൽ ചേർന്ന തീയതി",
    "वेतन स्तर": "വേതന നില",
    "छुट्टी की आवश्यकता": "അവധി ആവശ്യം",
    प्रकृति: "തരം",
    से: "മുതൽ",
    तक: "വരെ",
    पूर्वाह्न: "പൂർവ്വാഹ്നം",
    अपराह्न: "അപരാഹ്നം",
    सायं: "വൈകുന്നേരം",
    "दिनों की संख्या": "ദിവസങ്ങളുടെ എണ്ണം",
    "पूर्व (Prefix): से": "പ്രീഫിക്‌സ്: മുതൽ",
    "पश्च (Suffix): से": "സഫിക്‌സ്: മുതൽ",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "ജീവിതസഖാവ് ജോലി ചെയ്യുന്നുണ്ടോ, എങ്കിൽ LTCയ്ക്ക് അർഹനാണോ",
    "यात्रा की प्रस्तावित तिथियां": "യാത്രയുടെ നിർദേശിത തീയതികൾ",
    "बाह्य यात्रा की तिथि": "പുറപ്പെടുന്ന യാത്രയുടെ തീയതി",
    "आंतरिक यात्रा की तिथि": "മടങ്ങുന്ന യാത്രയുടെ തീയതി",
    स्वयं: "സ്വയം",
    परिवार: "കുടുംബം",
    "गृह नगर सेवा पुस्तिका में दर्ज": "സേവന പുസ്തകത്തിൽ രേഖപ്പെടുത്തിയ ഹോം ടൗൺ",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "എൽടിസി തരം: ഹോം ടൗൺ/ഇന്ത്യയിലെ എവിടെയും",
    "भ्रमण का स्थान": "സന്ദർശിക്കാനുള്ള സ്ഥലം",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "വരവ്-പോക് യാത്രയ്ക്ക് അർഹതയുള്ള ശ്രേണിയിലെ കണക്കുകൂട്ടിയ കൂലി (പ്രമാണം ചേർക്കുക)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है": "എൽടിസി നേടേണ്ട വ്യക്തികൾ",
    क्रम: "ക്രമം",
    नाम: "പേര്",
    आयु: "വയസ്",
    संबंध: "ബന്ധം",
    "यात्रा (स्थान) से": "യാത്ര (സ്ഥലം) മുതൽ",
    "वापसी (हाँ/नहीं)": "വാപസി (അതെ/അല്ല)",
    "यात्रा का माध्यम": "യാത്രാ മാർഗം",
    "अग्रिम आवश्यक": "അഡ്വാൻസ് ആവശ്യം",
    चुनें: "തിരഞ്ഞെടുക്കുക",
    हाँ: "അതെ",
    नहीं: "അല്ല",
    "अर्जित अवकाश नकदीकरण आवश्यक": "അർജിത അവധി നകദീകരണം ആവശ്യമാണ്",
    दिन: "ദിവസം",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "വിമാന യാത്രയ്ക്കുള്ള പ്രധാന കുറിപ്പ്",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "സർക്കാർ ജീവനക്കാർ അവരുടെ അർഹതാ ശ്രേണിയിൽ ലഭ്യമായ ഏറ്റവും കുറഞ്ഞ കൂലി തിരഞ്ഞെടുക്കണം.",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।":
      "ബുക്കിംഗ് സമയത്ത് ബന്ധപ്പെട്ട എടിഎ വെബ്‌പേജിന്റെ പ്രിന്റ്‌ഔട്ട് സൂക്ഷിക്കുക.",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "വിമാന ടിക്കറ്റുകൾ മൂന്ന് അംഗീകൃത ട്രാവൽ ഏജന്റുകളിൽ (എടിഎ) നിന്നുമാത്രം വാങ്ങണം.",
    "मैं यह प्रतिज्ञा करता/करती हूं": "ഞാൻ ഇതു പ്രതിജ്ഞ ചെയ്യുന്നു",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(ക) അഡ്വാൻസ് ലഭിച്ച 10 ദിവസത്തിനുള്ളിൽ യാത്രാ ടിക്കറ്റുകൾ സമർപ്പിക്കും.",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(ഖ) യാത്ര റദ്ദായാൽ രണ്ട് മാസത്തിനുള്ളിൽ അഡ്വാൻസ് തുക തിരിച്ചു നൽകും.",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(ഗ) അവകാശപ്രകാരം വിമാന/റെയിൽ/റോഡ് വഴി യാത്ര ചെയ്യും.",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(ഘ) പ്രഖ്യാപിച്ച സ്ഥലം അല്ലെങ്കിൽ തീയതികളിൽ മാറ്റമുണ്ടെങ്കിൽ അറിയിക്കും.",
    "प्रमाणित किया जाता है कि": "ഇതു സ്ഥിരീകരിക്കുന്നു",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) മുകളിൽ നൽകിയ വിവരം സത്യമാണ്.",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) ഈ ബ്ലോക്ക് വർഷത്തിന് എന്റെ ജീവിതസഖാവ് എൽടിസി എടുത്തിട്ടില്ല.",
    "ब्लॉक वर्ष": "ബ്ലോക്ക് വർഷം",
    "कृपया अग्रेषित करें": "ദയവായി മുന്നോട്ട് അയയ്ക്കുക",
    "आवेदक के हस्ताक्षर दिनांक सहित": "അപേക്ഷകന്റെ ഒപ്പ് തീയതിയോടെ",
    "प्रमुख/अनुभाग प्रभारी": "മേധാവി/വിഭാഗ ചുമതലക്കാരൻ",
  },
  UR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "انڈین انسٹی ٹیوٹ آف ٹیکنالوجی روپڑ",
    "रूपनगर, पंजाब-140001": "روپ نگر، پنجاب-140001",
    "छुट्टी यात्रा रियायत हेतु आवेदन": "لیو ٹریول کنسیشن کے لیے درخواست",
    "कर्मचारी का नाम एवं कर्मचारी कोड": "ملازم کا نام اور ملازم کوڈ",
    "पदनाम और विभाग": "عہدہ اور شعبہ",
    "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि":
      "مرکزی حکومت کی خدمت میں شامل ہونے کی تاریخ/آئی آئی ٹی روپڑ میں شمولیت کی تاریخ",
    "वेतन स्तर": "تنخواہ کی سطح",
    "छुट्टी की आवश्यकता": "چھٹی کی ضرورت",
    प्रकृति: "قسم",
    से: "سے",
    तक: "تک",
    पूर्वाह्न: "قبل از دوپہر",
    अपराह्न: "بعد از دوپہر",
    सायं: "شام",
    "दिनों की संख्या": "دنوں کی تعداد",
    "पूर्व (Prefix): से": "پریفکس: سے",
    "पश्च (Suffix): से": "سفکس: سے",
    "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है":
      "کیا شریکِ حیات ملازم ہے، اگر ہاں تو کیا LTC کا حقدار ہے",
    "यात्रा की प्रस्तावित तिथियां": "سفر کی مجوزہ تاریخیں",
    "बाह्य यात्रा की तिथि": "روانہ ہونے کے سفر کی تاریخ",
    "आंतरिक यात्रा की तिथि": "واپسی سفر کی تاریخ",
    स्वयं: "خود",
    परिवार: "خاندان",
    "गृह नगर सेवा पुस्तिका में दर्ज": "سروس بک میں درج ہوم ٹاؤن",
    "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी":
      "ایل ٹی سی کی قسم: ہوم ٹاؤن/بھارت میں کہیں بھی",
    "भ्रमण का स्थान": "دورے کا مقام",
    "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)":
      "آمدورفت سفر کے لیے اہل درجے کا تخمینی کرایہ (ثبوت منسلک کریں)",
    "जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है":
      "جن افراد کے لیے ایل ٹی سی تجویز ہے",
    क्रम: "نمبر",
    नाम: "نام",
    आयु: "عمر",
    संबंध: "رشتہ",
    "यात्रा (स्थान) से": "سفر (مقام) سے",
    "वापसी (हाँ/नहीं)": "واپسی (ہاں/نہیں)",
    "यात्रा का माध्यम": "سفر کا ذریعہ",
    "अग्रिम आवश्यक": "ایڈوانس درکار",
    चुनें: "منتخب کریں",
    हाँ: "ہاں",
    नहीं: "نہیں",
    "अर्जित अवकाश नकदीकरण आवश्यक": "حاصل شدہ چھٹی کی نقدی درکار",
    दिन: "دن",
    "हवाई यात्रा हेतु महत्वपूर्ण नोट": "ہوائی سفر کے لیے اہم نوٹ",
    "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।":
      "سرکاری ملازمین اپنی اہل درجے میں دستیاب کم ترین کرایہ منتخب کریں۔",
    "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।":
      "بکنگ کے وقت متعلقہ اے ٹی اے ویب سائٹ کا پرنٹ آؤٹ محفوظ رکھیں۔",
    "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।":
      "ہوائی ٹکٹ صرف تین مجاز ٹریول ایجنٹوں (اے ٹی اے) سے ہی خریدے جائیں۔",
    "मैं यह प्रतिज्ञा करता/करती हूं": "میں اس بات کا اقرار کرتا/کرتی ہوں",
    "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।":
      "(ک) ایڈوانس وصولی کے 10 دنوں کے اندر سفر کے ٹکٹ پیش کروں گا۔",
    "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।":
      "(خ) اگر سفر منسوخ ہو جائے تو دو ماہ کے اندر ایڈوانس واپس کروں گا۔",
    "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।":
      "(گ) میں اپنے حق کے مطابق ہوائی/ریل/سڑک سے سفر کروں گا۔",
    "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।":
      "(घ) اعلان کردہ مقام یا تاریخوں میں تبدیلی پر متعلقہ افسر کو مطلع کروں گا۔",
    "प्रमाणित किया जाता है कि": "تصدیق کی جاتی ہے کہ",
    "(1) ऊपर दी गई जानकारी सत्य है।": "(1) اوپر دی گئی معلومات درست ہیں۔",
    "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।":
      "(2) میرے شریکِ حیات نے اس بلاک سال کے لیے ایل ٹی سی نہیں لیا۔",
    "ब्लॉक वर्ष": "بلاک سال",
    "कृपया अग्रेषित करें": "براہ کرم آگے بھیجیں",
    "आवेदक के हस्ताक्षर दिनांक सहित": "درخواست گزار کے دستخط تاریخ کے ساتھ",
    "प्रमुख/अनुभाग प्रभारी": "سربراہ/سیکشن انچارج",
  },
};

const resolveApplicableWorkflowKey = (roleKey: string | null) => {
  if (!roleKey) return null;
  if (roleKey === "ASSOCIATE_HOD") return "HOD";
  if (roleKey === "FACULTY" || roleKey === "STAFF" || roleKey === "HOD") {
    return roleKey;
  }
  return null;
};

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) =>
  // Treat readOnly/disabled fields as locked for role-gated sections.
  ((locked: boolean) => (
    <input
      id={id}
      name={id}
      type={props.type ?? "text"}
      className={cn(
        "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none",
        locked && "cursor-not-allowed bg-slate-50 opacity-80",
        width,
        className,
      )}
      {...props}
    />
  ))(Boolean(props.readOnly || (props.disabled as boolean | undefined)));

const pages = ["LTC form", "Office sections"] as const;

export default function LtcPage() {
  return (
    <Suspense fallback={null}>
      <LtcPageContent />
    </Suspense>
  );
}

function LtcPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const [viewerRoleKey, setViewerRoleKey] = useState<string | null>(null);
  const canSeeOfficeSections =
    viewerRoleKey === "ESTABLISHMENT" ||
    viewerRoleKey === "ACCOUNTS" ||
    viewerRoleKey === "REGISTRAR" ||
    viewerRoleKey === "DEAN" ||
    viewerRoleKey === "ADMIN";
  const activePages = useMemo(
    () => (canSeeOfficeSections ? pages : ([pages[0]] as const)),
    [canSeeOfficeSections],
  );
  const [page, setPage] = useState(0);
  const isLastPage = page === activePages.length - 1;
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [formLanguage, setFormLanguage] = useState<FormLanguage>("HI");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveFromSession, setLeaveFromSession] =
    useState<DaySession>("MORNING");
  const [leaveToSession, setLeaveToSession] = useState<DaySession>("EVENING");
  const [computedLeaveDays, setComputedLeaveDays] = useState("");
  const signature = useSignatureOtp({ enableTyped: true });
  const setOtpEmail = signature.setOtpEmail;

  const translateHindi = useCallback(
    (text: string) => {
      if (formLanguage === "HI") return text;
      return HINDI_TRANSLATIONS[formLanguage]?.[text] ?? text;
    },
    [formLanguage],
  );

  const prev = () => {
    setPage((current) => Math.max(0, current - 1));
  };

  const next = () => {
    setPage((current) => Math.min(current + 1, activePages.length - 1));
  };

  const markMissingInputs = (form: HTMLFormElement, missing: Set<string>) => {
    const inputs = Array.from(form.querySelectorAll<HTMLInputElement>("input"));
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
    if (page > 0) {
      setPage((p) => p - 1);
      return;
    }
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
    setConfirmed(false);
    const form = formRef.current;
    if (!form) return;

    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    data.leaveFromSession = leaveFromSession;
    data.leaveToSession = leaveToSession;
    data.leaveDays = computedLeaveDays;
    data.applicantSignature =
      signature.signatureMode === "typed"
        ? signature.typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    saveFormDraft("ltc", data);
    const allInputKeys = Array.from(
      form.querySelectorAll<HTMLInputElement>("input"),
    )
      .map((input) => input.name || input.id)
      .filter(Boolean);

    const missing = allInputKeys.filter((key) => {
      // Make the "persons" table optional: only require non-person fields.
      if (key.startsWith("person")) return false;
      return !data[key]?.trim();
    });
    const missingSet = new Set(missing);
    markMissingInputs(form, missingSet);
    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    if (!computedLeaveDays) {
      window.alert(
        "No. of leave days is auto-calculated from date/session and must be greater than 0.",
      );
      return;
    }

    const signatureError = signature.ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Please complete Digital Signature and OTP verification on the form before submitting.",
    });
    if (signatureError) {
      window.alert(signatureError);
      return;
    }

    setMissingFields([]);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "ltc").then((profile) => {
      setViewerRoleKey(profile.roleKey ?? null);
      setOtpEmail(profile.email ?? "");
      setLeaveFrom(
        form.querySelector<HTMLInputElement>("#leaveFrom")?.value ?? "",
      );
      setLeaveTo(form.querySelector<HTMLInputElement>("#leaveTo")?.value ?? "");
      setLeaveFromSession(
        (form.querySelector<HTMLSelectElement>("#leaveFromSession")?.value as
          | DaySession
          | undefined) ?? "MORNING",
      );
      setLeaveToSession(
        (form.querySelector<HTMLSelectElement>("#leaveToSession")?.value as
          | DaySession
          | undefined) ?? "EVENING",
      );
    });
  }, [setOtpEmail]);

  useEffect(() => {
    setPage((current) => Math.min(current, activePages.length - 1));
  }, [activePages.length]);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      leaveFrom,
      leaveFromSession,
      leaveTo,
      leaveToSession,
    );
    setComputedLeaveDays(value ? formatSessionDays(value) : "");
  }, [leaveFrom, leaveFromSession, leaveTo, leaveToSession]);

  useEffect(() => {
    if (!leaveFrom || !leaveTo) return;
    if (leaveTo < leaveFrom) {
      setLeaveTo(leaveFrom);
      setLeaveToSession("EVENING");
      return;
    }

    if (
      leaveTo === leaveFrom &&
      SESSION_OFFSET[leaveToSession] <= SESSION_OFFSET[leaveFromSession]
    ) {
      setLeaveToSession(
        leaveFromSession === "MORNING"
          ? "AFTERNOON"
          : leaveFromSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING",
      );
    }
  }, [leaveFrom, leaveFromSession, leaveTo, leaveToSession]);

  const handleConfirmSubmit = async () => {
    const signatureError = signature.ensureReadyForSubmit({
      typed: "Please type your signature before submitting.",
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      setSubmitError(signatureError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/ltc", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature:
            signature.signatureMode !== "typed"
              ? signature.signatureCapture
              : undefined,
          otpVerified:
            signature.signatureMode !== "typed"
              ? signature.isOtpVerified
              : false,
        }),
      });

      const rawText = await response.text();
      const result = (() => {
        try {
          return JSON.parse(rawText) as { ok?: boolean; message?: string };
        } catch {
          return { ok: false, message: rawText } as {
            ok?: boolean;
            message?: string;
          };
        }
      })();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Failed to submit LTC application.");
      }

      setConfirmed(true);
      setSubmitMessage(
        result.message || "LTC application submitted successfully.",
      );
      clearFormDraft("ltc");
      signature.resetAfterSubmit();
      setDialogState("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to submit LTC application.";
      setSubmitError(errorMessage);
      setDialogState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    signature.setOtpCode("");
  };

  const handleDownloadPdf = async () => {
    const form = formRef.current;
    if (!form) return;
    setIsDownloading(true);
    try {
      await downloadFormAsPdf(form, "LTC");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const pageLabel = useMemo(
    () => `${activePages[page]} (${page + 1}/${activePages.length})`,
    [activePages, page],
  );
  return (
    <DashboardShell>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="px-0 text-sm font-semibold text-slate-700"
            type="button"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {pageLabel}
          </span>
        </div>

        {page === 0 && (
          <LtcFormPage
            leaveFrom={leaveFrom}
            leaveTo={leaveTo}
            leaveFromSession={leaveFromSession}
            leaveToSession={leaveToSession}
            computedLeaveDays={computedLeaveDays}
            onLeaveFromChange={setLeaveFrom}
            onLeaveToChange={setLeaveTo}
            onLeaveFromSessionChange={setLeaveFromSession}
            onLeaveToSessionChange={setLeaveToSession}
            signatureMode={signature.signatureMode}
            typedSignature={signature.typedSignature}
            signatureCapture={signature.signatureCapture}
            formLanguage={formLanguage}
            onFormLanguageChange={setFormLanguage}
            translateHindi={translateHindi}
          />
        )}
        {page === 1 && canSeeOfficeSections && (
          <OfficeSectionsPage viewerRoleKey={viewerRoleKey} />
        )}

        <LtcWorkflowPreviewCard viewerRoleKey={viewerRoleKey} />

        <ProposedActingHodField />

        <SignatureOtpVerificationCard
          storageScope="ltc"
          signatureMode={signature.signatureMode}
          onSignatureModeChange={signature.onSignatureModeChange}
          typedSignature={signature.typedSignature}
          onTypedSignatureChange={signature.onTypedSignatureChange}
          otpEmail={signature.otpEmail}
          otpCode={signature.otpCode}
          onOtpCodeChange={signature.setOtpCode}
          otpStatusMessage={signature.otpStatusMessage}
          isSendingOtp={signature.isSendingOtp}
          isVerifyingOtp={signature.isVerifyingOtp}
          isSubmitting={isSubmitting}
          onSendOtp={signature.handleSendOtp}
          onVerifyOtp={signature.handleVerifyOtp}
          onSignatureChange={signature.onSignatureChange}
          isOtpVerified={signature.isOtpVerified}
        />

        <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
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

        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="ghost"
            onClick={prev}
            disabled={page === 0}
            className="px-3 text-sm"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type={isLastPage ? "submit" : "button"}
              onClick={isLastPage ? undefined : next}
              className="px-4 text-sm"
              disabled={isSubmitting}
            >
              {isLastPage
                ? isSubmitting
                  ? "Submitting..."
                  : "Submit"
                : "Next"}
              {!isLastPage && <ArrowRight className="ml-1 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ConfirmationModal
          state={dialogState}
          title="LTC"
          onCancel={handleCloseDialog}
          onConfirm={handleConfirmSubmit}
          onDownload={handleDownloadPdf}
          isDownloading={isDownloading}
          isSubmitting={isSubmitting}
        />
      </form>
    </DashboardShell>
  );
}

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
  onConfirm: () => Promise<void>;
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
              ? `${title} form has been submitted successfully. You may close this window.`
              : `You are about to submit the ${title} form. Please review and confirm before continuing.`}
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
                disabled={isSubmitting}
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

const LtcFormPage = ({
  leaveFrom,
  leaveTo,
  leaveFromSession,
  leaveToSession,
  computedLeaveDays,
  onLeaveFromChange,
  onLeaveToChange,
  onLeaveFromSessionChange,
  onLeaveToSessionChange,
  signatureMode,
  typedSignature,
  signatureCapture,
  formLanguage,
  onFormLanguageChange,
  translateHindi,
}: {
  leaveFrom: string;
  leaveTo: string;
  leaveFromSession: DaySession;
  leaveToSession: DaySession;
  computedLeaveDays: string;
  onLeaveFromChange: (value: string) => void;
  onLeaveToChange: (value: string) => void;
  onLeaveFromSessionChange: (value: DaySession) => void;
  onLeaveToSessionChange: (value: DaySession) => void;
  signatureMode: SignatureMode;
  typedSignature: string;
  signatureCapture: SignatureCapture | null;
  formLanguage: FormLanguage;
  onFormLanguageChange: (value: FormLanguage) => void;
  translateHindi: (text: string) => string;
}) => (
  <SurfaceCard className="mx-auto max-w-5xl space-y-4 border border-slate-300 bg-white p-4 md:p-6">
    <div className="flex justify-end">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        Language
        <select
          id="formLanguage"
          name="formLanguage"
          value={formLanguage}
          onChange={(event) =>
            onFormLanguageChange(event.target.value as FormLanguage)
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
            {translateHindi("भारतीय प्रौद्योगिकी संस्थान रोपड़")}
          </p>
          <p className="text-base font-semibold uppercase">
            INDIAN INSTITUTE OF TECHNOLOGY ROPAR
          </p>
          <p className="text-[11px] text-slate-700">
            {translateHindi("रूपनगर, पंजाब-140001")} / Rupnagar, Punjab-140001
          </p>
        </div>
      </div>
      <p className="text-[12px] font-semibold">
        APPLICATION FOR LEAVE TRAVEL CONCESSION /{" "}
        {translateHindi("छुट्टी यात्रा रियायत हेतु आवेदन")}
      </p>
    </header>

    <div className="overflow-x-auto">
      <table className="w-full border border-slate-400 text-[12px] text-slate-900">
        <tbody>
          <RowSimple
            number="1."
            label={`Name of the Employee with Employee Code / ${translateHindi(
              "कर्मचारी का नाम एवं कर्मचारी कोड",
            )}`}
            inputId="employeeName"
          />
          <RowSimple
            number="2."
            label={`Designation and Department / ${translateHindi(
              "पदनाम और विभाग",
            )}`}
            inputId="designation"
          />
          <RowSimple
            number="3."
            label={`Date of entering the Central Government Service/Date of joining with IIT Ropar / ${translateHindi(
              "केन्द्रीय सरकार सेवा में प्रवेश की तिथि/आईआईटी रोपड़ में जॉइनिंग की तिथि",
            )}`}
            inputId="dateOfJoining"
          />
          <RowSimple
            number="4."
            label={`Pay Level / ${translateHindi("वेतन स्तर")}`}
            inputId="payLevel"
          />
          <RowLeaveRequired
            leaveFrom={leaveFrom}
            leaveTo={leaveTo}
            leaveFromSession={leaveFromSession}
            leaveToSession={leaveToSession}
            computedLeaveDays={computedLeaveDays}
            onLeaveFromChange={onLeaveFromChange}
            onLeaveToChange={onLeaveToChange}
            onLeaveFromSessionChange={onLeaveFromSessionChange}
            onLeaveToSessionChange={onLeaveToSessionChange}
            translateHindi={translateHindi}
          />
          <RowSimple
            number="6."
            label={`Whether spouse is employed, if yes whether entitled to LTC / ${translateHindi(
              "क्या जीवनसाथी नियोजित है, यदि हां तो क्या LTC के लिए पात्र है",
            )}`}
            inputId="spouseLtc"
          />
          <RowProposedDates translateHindi={translateHindi} />
          <RowSimple
            number="8."
            label={`Home Town as recorded in the Service Book / ${translateHindi(
              "गृह नगर सेवा पुस्तिका में दर्ज",
            )}`}
            inputId="homeTown"
          />
          <RowSimple
            number="9."
            label={`Nature of LTC to be availed:- Home Town/ Anywhere in India / ${translateHindi(
              "एलटीसी का प्रकार: गृह नगर/भारत में कहीं भी",
            )}`}
            inputId="ltcNature"
          />
          <RowSimple
            number="10."
            label={`Place to be visited / ${translateHindi("भ्रमण का स्थान")}`}
            inputId="placeToVisit"
          />
          <RowSimple
            number="11."
            label={`Total Estimated fare of entitled class for to and fro journey (proof need to be attached). / ${translateHindi(
              "आवक-जावक यात्रा के लिए पात्र श्रेणी का अनुमानित किराया (प्रमाण संलग्न करें)",
            )}`}
            inputId="estimatedFare"
          />
          <RowPersons translateHindi={translateHindi} />
          <RowAdvance translateHindi={translateHindi} />
          <RowEncashment translateHindi={translateHindi} />
        </tbody>
      </table>
    </div>

    <ImportantNote translateHindi={translateHindi} />
    <Undertaking
      signatureMode={signatureMode}
      typedSignature={typedSignature}
      signatureCapture={signatureCapture}
      translateHindi={translateHindi}
    />
  </SurfaceCard>
);

const OfficeSectionsPage = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => (
  <SurfaceCard className="mx-auto max-w-5xl space-y-6 border border-slate-300 bg-white p-4 md:p-6">
    <EstablishmentSection viewerRoleKey={viewerRoleKey} />
    <AccountsSection viewerRoleKey={viewerRoleKey} />
    <AuditSection viewerRoleKey={viewerRoleKey} />
  </SurfaceCard>
);

const LtcWorkflowPreviewCard = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const applicableKey = resolveApplicableWorkflowKey(viewerRoleKey);
  const applicable = applicableKey
    ? (LTC_WORKFLOW_PREVIEWS.find((entry) => entry.key === applicableKey) ??
      null)
    : null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approval workflow
          </p>
          <p className="mt-1 text-xs text-slate-600">
            This is the complete routing for LTC applications.
          </p>
        </div>
        {applicable?.steps?.[0] ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            Your route: {applicable.label} | Next: {applicable.steps[0].label}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {applicable ? (
          <div
            className={cn(
              "rounded-xl border border-slate-200 bg-white p-4 ring-2 ring-slate-300",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {applicable.label}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                Your route
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {applicable.steps.map((step, index) => (
                <div key={`${applicable.key}-${step.actor}-${index}`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {step.label}
                    </span>
                  </div>
                  {index < applicable.steps.length - 1 ? (
                    <div className="ml-3.5 mt-1 h-3 border-l border-dashed border-slate-300" />
                  ) : null}
                </div>
              ))}
            </div>

            {applicable.note ? (
              <p className="mt-3 text-xs text-slate-500">{applicable.note}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Your role does not submit LTC applications, but office roles may
            still view and process them.
          </p>
        )}
      </div>
    </div>
  );
};

const RowSimple = ({
  number,
  label,
  inputId,
}: {
  number: string;
  label: string;
  inputId: string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">
      {number}
    </td>
    <td className="px-3 py-2 align-top">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{label}</span>
        <UnderlineInput id={inputId} className="flex-1" />
      </div>
    </td>
  </tr>
);

const RowLeaveRequired = ({
  leaveFrom,
  leaveTo,
  leaveFromSession,
  leaveToSession,
  computedLeaveDays,
  onLeaveFromChange,
  onLeaveToChange,
  onLeaveFromSessionChange,
  onLeaveToSessionChange,
  translateHindi,
}: {
  leaveFrom: string;
  leaveTo: string;
  leaveFromSession: DaySession;
  leaveToSession: DaySession;
  computedLeaveDays: string;
  onLeaveFromChange: (value: string) => void;
  onLeaveToChange: (value: string) => void;
  onLeaveFromSessionChange: (value: DaySession) => void;
  onLeaveToSessionChange: (value: DaySession) => void;
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">5.</td>
    <td className="px-3 py-2">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            Leave required / {translateHindi("छुट्टी की आवश्यकता")}
          </span>
          <span>Nature / {translateHindi("प्रकृति")}:</span>
          <UnderlineInput id="leaveNature" width="w-32" />
          <span>From / {translateHindi("से")}</span>
          <UnderlineInput
            id="leaveFrom"
            type="date"
            width="w-32"
            min={getTodayIso()}
            value={leaveFrom}
            onChange={(event) => onLeaveFromChange(event.target.value)}
          />
          <SessionSelect
            id="leaveFromSession"
            value={leaveFromSession}
            onChange={onLeaveFromSessionChange}
            translateHindi={translateHindi}
          />
          <span>To / {translateHindi("तक")}</span>
          <UnderlineInput
            id="leaveTo"
            type="date"
            width="w-32"
            min={leaveFrom || getTodayIso()}
            value={leaveTo}
            onChange={(event) => onLeaveToChange(event.target.value)}
          />
          <SessionSelect
            id="leaveToSession"
            value={leaveToSession}
            onChange={onLeaveToSessionChange}
            translateHindi={translateHindi}
          />
          <span>No. of days / {translateHindi("दिनों की संख्या")}</span>
          <UnderlineInput
            id="leaveDays"
            width="w-20"
            readOnly
            value={computedLeaveDays}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span>{translateHindi("पूर्व (Prefix): से")}</span>
          <UnderlineInput id="prefixFrom" type="date" width="w-32" />
          <span>To / {translateHindi("तक")}</span>
          <UnderlineInput id="prefixTo" type="date" width="w-32" />
          <span>&amp; {translateHindi("पश्च (Suffix): से")}</span>
          <UnderlineInput id="suffixFrom" type="date" width="w-32" />
          <span>To / {translateHindi("तक")}</span>
          <UnderlineInput id="suffixTo" type="date" width="w-32" />
        </div>
      </div>
    </td>
  </tr>
);

const SessionSelect = ({
  id,
  value,
  onChange,
  translateHindi,
}: {
  id: string;
  value: DaySession;
  onChange: (value: DaySession) => void;
  translateHindi: (text: string) => string;
}) => (
  <select
    id={id}
    name={id}
    value={value}
    onChange={(event) => onChange(event.target.value as DaySession)}
    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
  >
    <option value="MORNING">Morning / {translateHindi("पूर्वाह्न")}</option>
    <option value="AFTERNOON">Afternoon / {translateHindi("अपराह्न")}</option>
    <option value="EVENING">Evening / {translateHindi("सायं")}</option>
  </select>
);

const RowProposedDates = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">7.</td>
    <td className="px-3 py-2">
      <div className="font-semibold">
        Proposed dates of Journey /{" "}
        {translateHindi("यात्रा की प्रस्तावित तिथियां")}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border border-slate-400 text-[12px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-400 px-2 py-1 text-left">
                &nbsp;
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Date of Outward journey /{" "}
                {translateHindi("बाह्य यात्रा की तिथि")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Date of Inward journey /{" "}
                {translateHindi("आंतरिक यात्रा की तिथि")}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                Self / {translateHindi("स्वयं")}
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="selfOutward"
                  type="date"
                  className="w-full"
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="selfInward"
                  type="date"
                  className="w-full"
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                Family / {translateHindi("परिवार")}
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="familyOutward"
                  type="date"
                  className="w-full"
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="familyInward"
                  type="date"
                  className="w-full"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </td>
  </tr>
);

const RowPersons = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">12.</td>
    <td className="px-3 py-2">
      <div className="font-semibold">
        Person(s) in respect of whom LTC is proposed to be availed. /{" "}
        {translateHindi("जिन व्यक्तियों के लिए एलटीसी प्रस्तावित है")}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border border-slate-400 text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 border border-slate-400 px-2 py-1 text-left">
                Sr. / {translateHindi("क्रम")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Name / {translateHindi("नाम")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Age / {translateHindi("आयु")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Relationship / {translateHindi("संबंध")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Travelling (Place) From / {translateHindi("यात्रा (स्थान) से")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                To / {translateHindi("तक")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Back (Yes/No) / {translateHindi("वापसी (हाँ/नहीं)")}
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Mode of Travel / {translateHindi("यात्रा का माध्यम")}
              </th>
            </tr>
          </thead>
          <tbody>
            {["i", "ii", "iii", "iv", "v"].map((rowKey, idx) => (
              <tr key={rowKey}>
                <td className="border border-slate-400 px-2 py-1 font-semibold">
                  ({rowKey})
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Name`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Age`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Relation`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}From`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}To`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Back`}
                    className="w-full"
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`person${idx + 1}Mode`}
                    className="w-full"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </td>
  </tr>
);

const RowAdvance = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">13.</td>
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold">
          Advance Required / {translateHindi("अग्रिम आवश्यक")}
        </span>
        <select
          id="advanceRequired"
          name="advanceRequired"
          className="w-32 rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="">Select / {translateHindi("चुनें")}</option>
          <option value="Yes">Yes / {translateHindi("हाँ")}</option>
          <option value="No">No / {translateHindi("नहीं")}</option>
        </select>
      </div>
    </td>
  </tr>
);

const RowEncashment = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="w-12 bg-slate-50 px-2 py-2 font-semibold align-top">14.</td>
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold">
          Encashment of earned leave required. /{" "}
          {translateHindi("अर्जित अवकाश नकदीकरण आवश्यक")}
        </span>
        <select
          id="encashmentRequired"
          name="encashmentRequired"
          className="w-32 rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="">Select / {translateHindi("चुनें")}</option>
          <option value="Yes">Yes / {translateHindi("हाँ")}</option>
          <option value="No">No / {translateHindi("नहीं")}</option>
        </select>
        <UnderlineInput id="encashmentDays" width="w-20" />
        <span>days / {translateHindi("दिन")}</span>
      </div>
    </td>
  </tr>
);

const ImportantNote = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <div className="space-y-2 text-[11px] leading-relaxed text-slate-900">
    <p className="font-semibold">
      Important Note for Air Travel :- /{" "}
      {translateHindi("हवाई यात्रा हेतु महत्वपूर्ण नोट")}
    </p>
    <ol className="space-y-2 pl-4">
      <li>
        (i) Government employees are to choose flight having the Best Available
        Fare on their entitled travel class which is the Cheapest Fare
        available, preferably for Non-stop flight in a 3 hours slot. /{" "}
        {translateHindi(
          "सरकारी कर्मचारी अपने पात्र श्रेणी में सर्वोत्तम उपलब्ध किराया चुनें, जो सबसे सस्ता उपलब्ध किराया हो।",
        )}
      </li>
      <li>
        (ii) At the time of booking, they are to retain the print-out of the
        concerned webpage of the ATAs having flight and fare details for the
        purpose of the settlement of the LTC claims. /{" "}
        {translateHindi(
          "बुकिंग के समय संबंधित एटीए की वेबसाइट का प्रिंटआउट सुरक्षित रखें।",
        )}
      </li>
      <li>
        (iii) Air tickets shall be purchased only from the three Authorized
        Travel Agents (ATAs) only. /{" "}
        {translateHindi(
          "हवाई टिकट केवल तीन अधिकृत ट्रैवल एजेंटों (एटीए) से ही खरीदे जाएं।",
        )}
      </li>
    </ol>
  </div>
);

const Undertaking = ({
  signatureMode,
  typedSignature,
  signatureCapture,
  translateHindi,
}: {
  signatureMode: SignatureMode;
  typedSignature: string;
  signatureCapture: SignatureCapture | null;
  translateHindi: (text: string) => string;
}) => (
  <div className="space-y-3 text-[12px] text-slate-900">
    <p className="font-semibold">
      I undertake:- / {translateHindi("मैं यह प्रतिज्ञा करता/करती हूं")}
    </p>
    <ol className="space-y-1 pl-5">
      <li>
        (a) To produce the tickets for the journey within 10 days of receipt of
        the advance. /{" "}
        {translateHindi(
          "(क) अग्रिम प्राप्ति के 10 दिनों के भीतर यात्रा के टिकट प्रस्तुत करूंगा।",
        )}
      </li>
      <li>
        (b) To refund the entire advance in lump sum, in the event of
        cancellation of the journey within two months from the date of drawal of
        the advance or failure to produce the tickets within 10 days of drawl of
        the advance. /{" "}
        {translateHindi(
          "(ख) यदि यात्रा रद्द हो जाती है तो अग्रिम राशि दो माह के भीतर वापस करूंगा।",
        )}
      </li>
      <li>
        (c) To travel by Air/Rail/Road as per my entitlement and as per GOI LTC
        rules or specific rules as adopted by the Institute /{" "}
        {translateHindi(
          "(ग) मैं अपने अधिकार के अनुसार हवाई/रेल/सड़क से यात्रा करूंगा।",
        )}
      </li>
      <li>
        (d) I will communicate to the competent authority about any change of
        declared place of visit or change of dates before the commencement of
        the journey. /{" "}
        {translateHindi(
          "(घ) घोषित स्थान या तिथियों में परिवर्तन होने पर सक्षम प्राधिकारी को सूचित करूंगा।",
        )}
      </li>
    </ol>
    <p className="font-semibold">
      Certified that:- / {translateHindi("प्रमाणित किया जाता है कि")}
    </p>
    <ol className="space-y-1 pl-5">
      <li>
        (1) The information, as given above is true to the best of my knowledge
        and belief; and / {translateHindi("(1) ऊपर दी गई जानकारी सत्य है।")}
      </li>
      <li>
        (2) My spouse is not employed in Government service / my spouse is
        employed in government service and the concession has not been availed
        of by him/her separately of himself/herself or for any of the family
        members for the <UnderlineInput id="blockYear" width="w-32" /> block
        year. /{" "}
        {translateHindi(
          "(2) मेरे जीवनसाथी द्वारा इस ब्लॉक वर्ष के लिए एलटीसी नहीं लिया गया है।",
        )}
      </li>
    </ol>
    <div className="flex flex-wrap items-center justify-between pt-2 text-[12px]">
      <div className="font-semibold">
        Forwarded please. / {translateHindi("कृपया अग्रेषित करें")}
      </div>
      <div className="flex items-center gap-2">
        <span>
          Signature of the Applicant with date /{" "}
          {translateHindi("आवेदक के हस्ताक्षर दिनांक सहित")}
        </span>
        <input
          type="hidden"
          id="applicantSignature"
          name="applicantSignature"
          value={
            signatureMode === "typed" ? typedSignature : DIGITAL_SIGNATURE_VALUE
          }
          readOnly
        />
        <span className="inline-flex h-9 w-56 items-end border-b border-dashed border-slate-500 px-1 pb-0.5 align-middle text-left text-[13px] text-slate-900">
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
            DIGITAL_SIGNATURE_VALUE
          )}
        </span>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between text-[12px]">
      <span>
        Head/Section Incharge / {translateHindi("प्रमुख/अनुभाग प्रभारी")}
      </span>
      <span className="mr-20">&nbsp;</span>
    </div>
  </div>
);

const EstablishmentSection = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const locked = !(
    viewerRoleKey === "ESTABLISHMENT" || viewerRoleKey === "ADMIN"
  );

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="text-center font-semibold">
        (A) FOR USE OF ESTABLISHMENT SECTION
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Fresh Recruit i.e. joining Govt. Service after 01.09.2008 /otherwise,
          Date of joining:
        </span>
        <UnderlineInput id="freshRecruitDate" width="w-40" readOnly={locked} />
        <span>Block year:</span>
        <UnderlineInput id="estBlockYear" width="w-28" readOnly={locked} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-400 text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-14 border border-slate-400 px-2 py-1 text-left">
                Sl. No.
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Particulars
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Last availed
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Current LTC
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                01
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Nature of LTC (Home Town/Anywhere in India-place visited/to be
                visited)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estNatureLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estNatureCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                02
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Period (from _______ to _______)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                03
              </td>
              <td className="border border-slate-400 px-2 py-1">
                LTC for Self/Family
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estSelfFamilyLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estSelfFamilyCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                04
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Earned leave encashment (No. of Days)
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estEncashLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estEncashCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                05
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <div className="space-y-1">
                  <div>Earned Leave standing to his credit on ________ =</div>
                  <div>Balance Earned leave after this encashment =</div>
                  <div>Earned Leave encashment admissible =</div>
                </div>
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estLeaveLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estLeaveCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1 font-semibold">
                06
              </td>
              <td className="border border-slate-400 px-2 py-1">
                Period and nature of leave applied for and need to be sanctioned
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodNatureLast"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
              <td className="border border-slate-400 px-2 py-1">
                <UnderlineInput
                  id="estPeriodNatureCurrent"
                  className="w-full"
                  readOnly={locked}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px]">
        May consider and approve the above LTC (Home Town/Anywhere in India),
        Leave and Encashment of Leave.
      </p>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>Junior Assistant</span>
        <span>Junior Superintendent/Superintendent</span>
        <span>AR/DR</span>
      </div>
    </div>
  );
};

const AccountsSection = ({
  viewerRoleKey,
}: {
  viewerRoleKey: string | null;
}) => {
  const locked = !(viewerRoleKey === "ACCOUNTS" || viewerRoleKey === "ADMIN");

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="text-center font-semibold">
        (B) For use by the Accounts Section
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-slate-400 text-[11px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="border border-slate-400 px-2 py-1 text-left">
                From
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                To
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Mode of Travel
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                No. of fares
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Single fare
              </th>
              <th className="border border-slate-400 px-2 py-1 text-left">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row}>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsFrom${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsTo${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsMode${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsFares${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsSingleFare${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
                <td className="border border-slate-400 px-2 py-1">
                  <UnderlineInput
                    id={`accountsAmount${row}`}
                    className="w-full"
                    readOnly={locked}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 text-[11px]">
        <p>
          Total Rs.{" "}
          <UnderlineInput id="accountsTotal" width="w-40" readOnly={locked} />
        </p>
        <p>
          Advance admissible (90% of above) = Rs.{" "}
          <UnderlineInput
            id="accountsAdmissible"
            width="w-32"
            readOnly={locked}
          />{" "}
          Passed for Rs.{" "}
          <UnderlineInput id="accountsPassed" width="w-32" readOnly={locked} />
        </p>
        <p>
          (in words); Rupees{" "}
          <UnderlineInput id="accountsInWords" width="w-64" readOnly={locked} />
        </p>
        <p>
          Debitable to LTC advance Dr./Mr./Mrs./Ms{" "}
          <UnderlineInput
            id="accountsDebitable"
            width="w-64"
            readOnly={locked}
          />
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>JAA/SAA</span>
        <span>JAO/AO</span>
        <span>AR/DR</span>
      </div>
    </div>
  );
};

const AuditSection = ({ viewerRoleKey }: { viewerRoleKey: string | null }) => {
  const registrarLocked = !(
    viewerRoleKey === "REGISTRAR" || viewerRoleKey === "ADMIN"
  );
  const deanLocked = !(viewerRoleKey === "DEAN" || viewerRoleKey === "ADMIN");

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="text-center font-semibold">
        (C) For use by the Audit Section
      </div>
      <div className="border border-slate-400 p-3 text-[11px]">
        <p>Comments/Observations:</p>
        <UnderlineInput
          id="auditComments"
          className="mt-2 w-full"
          readOnly={registrarLocked}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <span>Dealing Assistant</span>
        <span>JAO/AO</span>
        <span>Sr. Audit Officer</span>
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] font-semibold">
        <div className="flex items-center gap-2">
          <span>Recommended & Forwarded</span>
          <UnderlineInput
            id="auditRecommended"
            width="w-40"
            readOnly={registrarLocked}
          />
          <span>Registrar</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Approved/Not Approved</span>
          <UnderlineInput
            id="auditApproved"
            width="w-40"
            readOnly={deanLocked}
          />
          <span>Dean (F&A)</span>
        </div>
      </div>
    </div>
  );
};
