"use client";

export const dynamic = "force-dynamic";

import type { ChangeEvent, FormEvent, InputHTMLAttributes } from "react";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SignatureOtpVerificationCard } from "../../components/leaves/signature-otp-verification-card";
import { ProposedActingHodField } from "@/components/leaves/proposed-acting-hod-field";
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
import {
  applyAutofillToForm,
  clearFormDraft,
  saveFormDraft,
} from "@/lib/form-autofill";
import { downloadFormAsPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

type DialogState = "confirm" | "success" | null;

type FormLanguage = "HI" | "TE" | "PA" | "MR" | "TA" | "ML" | "UR";

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
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "సెలవు కోసం లేదా సెలవు పొడిగింపుకు దరఖాస్తు",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(ఆర్జిత సెలవు/అర్ధ వేతన సెలవు/అసాధారణ సెలవు/కమ్యూటెడ్ సెలవు/వికేషన్ సెలవు/ప్రసూతి సెలవు/పితృత్వ సెలవు/బాల సంరక్షణ సెలవు)",
    "आवेदक का नाम": "దరఖాస్తుదారుడి పేరు",
    "पद नाम": "పదవి",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "విభాగం/కేంద్ర కార్యాలయం/విభాగం",
    "अवकाश का प्रकार": "సెలవు రకం",
    "छुट्टी की अवधि": "సెలవు వ్యవధి",
    से: "నుంచి",
    तक: "వరకు",
    "दिनों की संख्या": "రోజుల సంఖ్య",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "ఉంటే, ఆదివారం మరియు సెలవులు సెలవుకు ముందు లేదా తర్వాత తీసుకుంటున్నారు",
    "के पूर्व": "ముందు",
    "के पश्चात": "తర్వాత",
    उद्देश्य: "ఉద్దేశ్యం",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "కార్య, పరిపాలనా లేదా ఇతర బాధ్యతల కోసం ప్రత్యామ్నాయ ఏర్పాట్లు (ఉంటే)",
    "आवेदक के हस्ताक्षर दिनांक सहित": "దరఖాస్తుదారుడి సంతకం తేదీతో",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "నియంత్రణాధికారి వ్యాఖ్యలు మరియు సిఫార్సులు",
    "सिफारिश की गई": "సిఫారసు చేయబడింది",
    "या नहीं की गई": "లేదా సిఫారసు చేయలేదు",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "విభాగాధ్యక్షుడు మరియు విభాగ ప్ర‌ధానుడి సంతకం తేదీతో",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "పరిపాలనా విభాగం వినియోగానికి",
    "प्रमाणित किया जाता है कि (प्रकृति)": "ప్రకృతి (స్వభావం) ధృవీకరించబడింది",
    "आज की तिथि तक शेष": "ఈ తేదీ వరకు బ్యాలెన్స్",
    "कुल दिनों के लिए अवकाश": "మొత్తం రోజుల కోసం సెలవు",
    "संबंधित सहायक": "సంబంధిత సహాయకుడు",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/":
      "అధి./సహా. రిజిస్ట్రార్/విభాగాధ్యక్షుడు/",
    कुलसचिव: "రిజిస్ట్రార్",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "సెలవు ఆమోదానికి అర్హ అధికారి వ్యాఖ్య: ఆమోదం / తిరస్కరణ",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "రిజిస్ట్రార్/ డీన్ (Faculty Affairs & Administration) / డైరెక్టర్ సంతకం",
    "अवकाश के दौरान पता": "సెలవు సమయంలో చిరునామా",
    "संपर्क नं.": "సంప్రదించు నం.",
    पिन: "పిన్",
    "क्या स्टेशन अवकाश की आवश्यकता है": "స్టేషన్ సెలవు అవసరమా",
    हाँ: "అవును",
    नहीं: "కాదు",
    "यदि हाँ": "అయితే",
  },
  PA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ਭਾਰਤੀ ਪ੍ਰੌਧੋਗਿਕੀ ਸੰਸਥਾਨ ਰੋਪੜ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "ਨੰਗਲ ਰੋਡ, ਰੂਪਨਗਰ, ਪੰਜਾਬ-140001",
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "ਛੁੱਟੀ ਲਈ ਜਾਂ ਛੁੱਟੀ ਵਧਾਉਣ ਲਈ ਅਰਜ਼ੀ",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(ਅਰਜਿਤ ਛੁੱਟੀ/ਅਰਧ ਵੇਤਨ ਛੁੱਟੀ/ਅਸਾਧਾਰਣ ਛੁੱਟੀ/ਕਮਿਊਟਡ ਛੁੱਟੀ/ਵਿਕੇਸ਼ਨ ਛੁੱਟੀ/ਮਾਤ੍ਰਿਤਵ ਛੁੱਟੀ/ਪਿਤ੍ਰਿਤਵ ਛੁੱਟੀ/ਬੱਚਾ ਸੰਭਾਲ ਛੁੱਟੀ)",
    "आवेदक का नाम": "ਅਰਜ਼ੀਕਰਤਾ ਦਾ ਨਾਮ",
    "पद नाम": "ਪਦ",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "ਵਿਭਾਗ/ਕੇਂਦਰੀ ਦਫ਼ਤਰ/ਸੈਕਸ਼ਨ",
    "अवकाश का प्रकार": "ਛੁੱਟੀ ਦੀ ਕਿਸਮ",
    "छुट्टी की अवधि": "ਛੁੱਟੀ ਦੀ ਮਿਆਦ",
    से: "ਤੋਂ",
    तक: "ਤੱਕ",
    "दिनों की संख्या": "ਦਿਨਾਂ ਦੀ ਗਿਣਤੀ",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "ਜੇ ਕੋਈ ਹੋਵੇ, ਐਤਵਾਰ ਅਤੇ ਛੁੱਟੀਆਂ ਛੁੱਟੀ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂ ਬਾਅਦ ਲਈਆਂ ਜਾ ਰਹੀਆਂ ਹਨ",
    "के पूर्व": "ਪਹਿਲਾਂ",
    "के पश्चात": "ਬਾਅਦ",
    उद्देश्य: "ਉਦੇਸ਼",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "ਕੰਮ, ਪ੍ਰਸ਼ਾਸਨਿਕ ਜਾਂ ਹੋਰ ਜ਼ਿੰਮੇਵਾਰੀਆਂ ਲਈ ਬਦਲਵੀ ਬੰਦੋਬਸਤ (ਜੇ ਕੋਈ ਹੋਵੇ)",
    "आवेदक के हस्ताक्षर दिनांक सहित": "ਅਰਜ਼ੀਕਰਤਾ ਦੇ ਦਸਤਖ਼ਤ ਤਾਰੀਖ਼ ਸਮੇਤ",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "ਨਿਯੰਤਰਕ ਅਧਿਕਾਰੀ ਦੀਆਂ ਟਿੱਪਣੀਆਂ ਅਤੇ ਸਿਫ਼ਾਰਸ਼ਾਂ",
    "सिफारिश की गई": "ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀ ਗਈ",
    "या नहीं की गई": "ਜਾਂ ਸਿਫ਼ਾਰਸ਼ ਨਾ ਕੀਤੀ ਗਈ",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "ਵਿਭਾਗ ਮੁਖੀ ਅਤੇ ਵਿਭਾਗ ਪ੍ਰਮੁੱਖ ਦੇ ਦਸਤਖ਼ਤ ਤਾਰੀਖ਼ ਸਮੇਤ",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "ਪ੍ਰਸ਼ਾਸਨਿਕ ਸੈਕਸ਼ਨ ਵੱਲੋਂ ਵਰਤੋਂ ਲਈ",
    "प्रमाणित किया जाता है कि (प्रकृति)": "ਇਹ ਪ੍ਰਮਾਣਿਤ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਕਿ (ਕਿਸਮ)",
    "आज की तिथि तक शेष": "ਅੱਜ ਦੀ ਤਾਰੀਖ ਤੱਕ ਬਕਾਇਆ",
    "कुल दिनों के लिए अवकाश": "ਕੁੱਲ ਦਿਨਾਂ ਲਈ ਛੁੱਟੀ",
    "संबंधित सहायक": "ਸੰਬੰਧਤ ਸਹਾਇਕ",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/": "ਅਧਿ./ਸਹਾ. ਰਜਿਸਟਰਾਰ/ਸੈਕਸ਼ਨ ਮੁਖੀ/",
    कुलसचिव: "ਰਜਿਸਟਰਾਰ",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "ਛੁੱਟੀ ਮਨਜ਼ੂਰ ਕਰਨ ਲਈ ਯੋਗ ਅਧਿਕਾਰੀ ਦੀ ਟਿੱਪਣੀ: ਮਨਜ਼ੂਰ / ਅਸਵੀਕਾਰ",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "ਰਜਿਸਟਰਾਰ/ ਡੀਨ (Faculty Affairs & Administration) / ਡਾਇਰੈਕਟਰ ਦੇ ਦਸਤਖ਼ਤ",
    "अवकाश के दौरान पता": "ਛੁੱਟੀ ਦੌਰਾਨ ਪਤਾ",
    "संपर्क नं.": "ਸੰਪਰਕ ਨੰ.",
    पिन: "ਪਿਨ",
    "क्या स्टेशन अवकाश की आवश्यकता है": "ਕੀ ਸਟੇਸ਼ਨ ਛੁੱਟੀ ਦੀ ਲੋੜ ਹੈ",
    हाँ: "ਹਾਂ",
    नहीं: "ਨਹੀਂ",
    "यदि हाँ": "ਜੇ ਹਾਂ",
  },
  MR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "भारतीय तंत्रज्ञान संस्था रोपड",
    "नंगल रोड, रूपनगर, पंजाब-140001": "नांगल रोड, रूपनगर, पंजाब-140001",
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "रजा किंवा रजा वाढीसाठी अर्ज",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(अर्जित रजा/अर्ध वेतन रजा/असाधारण रजा/कम्युटेड रजा/विश्राम रजा/मातृत्व रजा/पितृत्व रजा/बाल संगोपन रजा)",
    "आवेदक का नाम": "अर्जदाराचे नाव",
    "पद नाम": "पदनाम",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "विभाग/केंद्रीय कार्यालय/अनुभाग",
    "अवकाश का प्रकार": "रजेचा प्रकार",
    "छुट्टी की अवधि": "रजेचा कालावधी",
    से: "पासून",
    तक: "पर्यंत",
    "दिनों की संख्या": "दिवसांची संख्या",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "असल्यास, रविवार आणि सुट्टी रजेच्या आधी किंवा नंतर घेतले जात आहेत",
    "के पूर्व": "आधी",
    "के पश्चात": "नंतर",
    उद्देश्य: "उद्देश",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "कार्य, प्रशासकीय किंवा अन्य जबाबदाऱ्यांसाठी पर्यायी व्यवस्था (असल्यास)",
    "आवेदक के हस्ताक्षर दिनांक सहित": "अर्जदाराची सही दिनांकासह",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "नियंत्रक अधिकाऱ्याच्या टिप्पणी व शिफारसी",
    "सिफारिश की गई": "शिफारस केली",
    "या नहीं की गई": "किंवा शिफारस नाही",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "विभागाध्यक्ष व विभाग प्रमुखांची सही दिनांकासह",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "प्रशासकीय विभागासाठी वापरासाठी",
    "प्रमाणित किया जाता है कि (प्रकृति)": "प्रमाणित केले जाते की (प्रकार)",
    "आज की तिथि तक शेष": "आजच्या तारखेपर्यंत शिल्लक",
    "कुल दिनों के लिए अवकाश": "एकूण दिवसांसाठी रजा",
    "संबंधित सहायक": "संबंधित सहाय्यक",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/": "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/",
    कुलसचिव: "कुलसचिव",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "रजा मंजूर करण्यासाठी सक्षम प्राधिकाऱ्याची टिप्पणी: मंजूर / अमंजूर",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director ची सही",
    "अवकाश के दौरान पता": "रजेच्या काळातील पत्ता",
    "संपर्क नं.": "संपर्क क्र.",
    पिन: "पिन",
    "क्या स्टेशन अवकाश की आवश्यकता है": "स्टेशन रजेची आवश्यकता आहे का",
    हाँ: "हो",
    नहीं: "नाही",
    "यदि हाँ": "जर होय",
  },
  TA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "இந்திய தொழில்நுட்ப நிறுவனம் ரோபர்",
    "नंगल रोड, रूपनगर, पंजाब-140001": "நங்கல் சாலை, ரூப்நகர், பஞ்சாப்-140001",
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "விடுப்பு அல்லது விடுப்பு நீட்டிப்பிற்கான விண்ணப்பம்",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(சம்பாதித்த விடுப்பு/அரை சம்பள விடுப்பு/அசாதாரண விடுப்பு/கம்யூட்டட் விடுப்பு/விகேஷன் விடுப்பு/மகப்பேறு விடுப்பு/தந்தைத்துவ விடுப்பு/குழந்தை பராமரிப்பு விடுப்பு)",
    "आवेदक का नाम": "விண்ணப்பதாரரின் பெயர்",
    "पद नाम": "பதவி",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "துறை/மைய அலுவலகம்/பிரிவு",
    "अवकाश का प्रकार": "விடுப்பு வகை",
    "छुट्टी की अवधि": "விடுப்பு காலம்",
    से: "இருந்து",
    तक: "வரை",
    "दिनों की संख्या": "நாட்களின் எண்ணிக்கை",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "இருந்தால், ஞாயிறு மற்றும் விடுமுறைகள் விடுப்புக்கு முன்பாக அல்லது பின்பாக சேர்க்கப்படுகின்றன",
    "के पूर्व": "முன்",
    "के पश्चात": "பின்",
    उद्देश्य: "நோக்கம்",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "பணி, நிர்வாக அல்லது பிற பொறுப்புகளுக்கான மாற்று ஏற்பாடு (இருந்தால்)",
    "आवेदक के हस्ताक्षर दिनांक सहित": "விண்ணப்பதாரரின் கையொப்பம் தேதி உடன்",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "கட்டுப்பாட்டு அதிகாரியின் குறிப்புகள் மற்றும் பரிந்துரைகள்",
    "सिफारिश की गई": "பரிந்துரைக்கப்பட்டது",
    "या नहीं की गई": "அல்லது பரிந்துரைக்கப்படவில்லை",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "துறைத் தலைவர் மற்றும் துறை முதல்வரின் கையொப்பம் தேதி உடன்",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "நிர்வாக பிரிவு பயன்பாட்டிற்காக",
    "प्रमाणित किया जाता है कि (प्रकृति)": "(வகை) என சான்றளிக்கப்படுகிறது",
    "आज की तिथि तक शेष": "இன்றைய தேதி வரை இருப்பு",
    "कुल दिनों के लिए अवकाश": "மொத்த நாட்களுக்கு விடுப்பு",
    "संबंधित सहायक": "சம்பந்தப்பட்ட உதவியாளர்",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/": "அதி./சஹா. பதிவாளர்/பிரிவு தலைவர்/",
    कुलसचिव: "பதிவாளர்",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "விடுப்பு அனுமதிக்கத் தகுதியான அதிகாரியின் கருத்து: அனுமதிக்கப்பட்டது / அனுமதிக்கப்படவில்லை",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "பதிவாளர்/ டீன் (Faculty Affairs & Administration) / இயக்குநர் கையொப்பம்",
    "अवकाश के दौरान पता": "விடுப்பு காலத்திலுள்ள முகவரி",
    "संपर्क नं.": "தொடர்பு எண்",
    पिन: "பின்",
    "क्या स्टेशन अवकाश की आवश्यकता है": "ஸ்டேஷன் விடுப்பு தேவையா",
    हाँ: "ஆம்",
    नहीं: "இல்லை",
    "यदि हाँ": "ஆம் என்றால்",
  },
  ML: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ഇന്ത്യൻ സാങ്കേതിക സ്ഥാപനമായ റോപ്പർ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "നങ്ങൽ റോഡ്, രൂപ്‌നഗർ, പഞ്ചാബ്-140001",
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "അവധി അല്ലെങ്കിൽ അവധി നീട്ടുന്നതിനുള്ള അപേക്ഷ",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(അർജിത അവധി/അർദ്ധ വേതന അവധി/അസാധാരണ അവധി/കമ്യൂട്ടഡ് അവധി/വിക്കേഷൻ അവധി/മാതൃത്വ അവധി/പിതൃത്വ അവധി/കുട്ടി പരിചരണ അവധി)",
    "आवेदक का नाम": "അപേക്ഷകന്റെ പേര്",
    "पद नाम": "പദവി",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "വകുപ്പ്/കേന്ദ്ര ഓഫീസ്സ്/വിഭാഗം",
    "अवकाश का प्रकार": "അവധി തരം",
    "छुट्टी की अवधि": "അവധി കാലയളവ്",
    से: "മുതൽ",
    तक: "വരെ",
    "दिनों की संख्या": "ദിവസങ്ങളുടെ എണ്ണം",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "ഉണ്ടെങ്കിൽ, ഞായറാഴ്ചയും അവധികളും അവധിക്ക് മുമ്പോ ശേഷമോ ഉൾപ്പെടുത്തുന്നു",
    "के पूर्व": "മുൻപ്",
    "के पश्चात": "ശേഷം",
    उद्देश्य: "ഉദ്ദേശ്യം",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "പ്രവർത്തന, ഭരണകൂടമോ മറ്റു ബാധ്യതകളോ (ഉണ്ടെങ്കിൽ) പകരം ക്രമീകരണം",
    "आवेदक के हस्ताक्षर दिनांक सहित": "അപേക്ഷകന്റെ ഒപ്പ് തീയതിയോടെ",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "നിയന്ത്രണ ഓഫീസറുടെ അഭിപ്രായങ്ങളും ശുപാർശകളും",
    "सिफारिश की गई": "ശുപാർശ ചെയ്തു",
    "या नहीं की गई": "അല്ലെങ്കിൽ ശുപാർശ ചെയ്തില്ല",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "വകുപ്പ് തലവന്റെയും വിഭാഗ മേധാവിയുടെയും ഒപ്പ് തീയതിയോടെ",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "ഭരണ വിഭാഗം ഉപയോഗത്തിനായി",
    "प्रमाणित किया जाता है कि (प्रकृति)": "(തരം) എന്ന് സാക്ഷ്യപ്പെടുത്തുന്നു",
    "आज की तिथि तक शेष": "ഇന്നത്തെ തീയതി വരെ ബാക്കി",
    "कुल दिनों के लिए अवकाश": "മൊത്തം ദിവസങ്ങൾക്ക് അവധി",
    "संबंधित सहायक": "ബന്ധപ്പെട്ട സഹായി",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/": "അധി./സഹാ. രജിസ്ട്രാർ/വിഭാഗ തലവൻ/",
    कुलसचिव: "റജിസ്ട്രാർ",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "അവധി അനുവദിക്കാൻ യോഗ്യനായ അധികാരിയുടെ അഭിപ്രായം: അംഗീകരിച്ചു / അംഗീകരിച്ചില്ല",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "റജിസ്ട്രാർ/ ഡീൻ (Faculty Affairs & Administration) / ഡയറക്ടറുടെ ഒപ്പ്",
    "अवकाश के दौरान पता": "അവധി സമയത്തെ വിലാസം",
    "संपर्क नं.": "ബന്ധപ്പെടാനുള്ള നമ്പർ",
    पिन: "പിൻ",
    "क्या स्टेशन अवकाश की आवश्यकता है": "സ്റ്റേഷൻ അവധി ആവശ്യമാണ്",
    हाँ: "അതെ",
    नहीं: "അല്ല",
    "यदि हाँ": "അതെ ആണെങ്കിൽ",
  },
  UR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "انڈین انسٹی ٹیوٹ آف ٹیکنالوجی روپڑ",
    "नंगल रोड, रूपनगर, पंजाब-140001": "ننگل روڈ، روپ نگر، پنجاب-140001",
    "छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन":
      "چھٹی کے لیے یا چھٹی بڑھانے کے لیے درخواست",
    "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)":
      "(حاصل شدہ چھٹی/نصف تنخواہ چھٹی/غیر معمولی چھٹی/کمیوٹڈ چھٹی/ویکیشن چھٹی/زچگی چھٹی/پدرانہ چھٹی/بچے کی نگہداشت چھٹی)",
    "आवेदक का नाम": "درخواست گزار کا نام",
    "पद नाम": "عہدہ",
    "विभाग/केन्द्रीय कार्यालय/अनुभाग": "شعبہ/مرکزی دفتر/سیکشن",
    "अवकाश का प्रकार": "چھٹی کی قسم",
    "छुट्टी की अवधि": "چھٹی کی مدت",
    से: "سے",
    तक: "تک",
    "दिनों की संख्या": "دنوں کی تعداد",
    "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं":
      "اگر کوئی ہو تو، اتوار اور تعطیلات چھٹی سے پہلے یا بعد میں شامل کی جا رہی ہیں",
    "के पूर्व": "سے پہلے",
    "के पश्चात": "کے بعد",
    उद्देश्य: "مقصد",
    "कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था":
      "کام، انتظامی یا دیگر ذمہ داریوں کے لیے متبادل انتظام (اگر کوئی ہو)",
    "आवेदक के हस्ताक्षर दिनांक सहित": "درخواست گزار کے دستخط تاریخ کے ساتھ",
    "नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें":
      "نگران افسر کے تبصرے اور سفارشات",
    "सिफारिश की गई": "سفارش کی گئی",
    "या नहीं की गई": "یا سفارش نہیں کی گئی",
    "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित":
      "سربراہِ شعبہ اور شعبہ سربراہ کے دستخط تاریخ کے ساتھ",
    "प्रशासनिक अनुभाग द्वारा प्रयोग हेतु": "انتظامی شعبہ کے استعمال کے لیے",
    "प्रमाणित किया जाता है कि (प्रकृति)": "تصدیق کی جاتی ہے کہ (قسم)",
    "आज की तिथि तक शेष": "آج کی تاریخ تک باقی",
    "कुल दिनों के लिए अवकाश": "کل دنوں کے لیے چھٹی",
    "संबंधित सहायक": "متعلقہ معاون",
    "अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/": "ایڈمن/اسسٹنٹ رجسٹرار/سیکشن اِنچارج/",
    कुलसचिव: "رجسٹرار",
    "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत":
      "چھٹی منظور کرنے کے لیے مجاز افسر کی رائے: منظور / نامنظور",
    "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर":
      "رجسٹرار/ ڈین (Faculty Affairs & Administration) / ڈائریکٹر کے دستخط",
    "अवकाश के दौरान पता": "چھٹی کے دوران پتہ",
    "संपर्क नं.": "رابطہ نمبر",
    पिन: "پن",
    "क्या स्टेशन अवकाश की आवश्यकता है": "کیا اسٹیشن لیو کی ضرورت ہے",
    हाँ: "ہاں",
    नहीं: "نہیں",
    "यदि हाँ": "اگر ہاں",
  },
};

const calculateInclusiveDays = (fromValue?: string, toValue?: string) => {
  if (!fromValue || !toValue) return "";

  const from = new Date(`${fromValue}T00:00:00`);
  const to = new Date(`${toValue}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return "";
  }

  const difference = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  return `${difference}`;
};

const UnderlineInput = ({
  id,
  width = "w-48",
  className,
  readOnly,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
  readOnly?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type="text"
    readOnly={readOnly}
    className={cn(
      "border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      readOnly && "cursor-not-allowed opacity-75 bg-slate-50",
      width,
      className,
    )}
    {...props}
  />
);

const DateUnderlineInput = ({
  id,
  width = "w-32",
  className,
  readOnly,
  ...props
}: {
  id: string;
  width?: string;
  className?: string;
  readOnly?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) => (
  <input
    id={id}
    name={id}
    type="date"
    readOnly={readOnly}
    className={cn(
      "border-0 border-b border-dashed border-slate-400 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none scheme-light",
      readOnly && "cursor-not-allowed opacity-75",
      width,
      className,
    )}
    {...props}
  />
);

export default function EarnedLeavePage() {
  return (
    <Suspense fallback={null}>
      <EarnedLeavePageContent />
    </Suspense>
  );
}

function EarnedLeavePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const formRef = useRef<HTMLFormElement>(null);
  const pendingDataRef = useRef<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [stationLeaveRequired, setStationLeaveRequired] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [formLanguage, setFormLanguage] = useState<FormLanguage>("HI");
  const [ltcChoice, setLtcChoice] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fromSession, setFromSession] = useState<DaySession>("MORNING");
  const [toSession, setToSession] = useState<DaySession>("EVENING");
  const [computedLeaveDays, setComputedLeaveDays] = useState("");
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
  } = useSignatureOtp({ enableTyped: true });

  const translateHindi = useCallback(
    (text: string) => {
      if (formLanguage === "HI") return text;
      return HINDI_TRANSLATIONS[formLanguage]?.[text] ?? text;
    },
    [formLanguage],
  );

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
    setConfirmed(false);
    const form = formRef.current;
    if (!form) return;

    const data = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;
    data.fromSession = fromSession;
    data.toSession = toSession;
    data.days = computedLeaveDays;
    data.applicantSignature =
      signatureMode === "typed"
        ? typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    saveFormDraft("earned-leave", data);

    // Exclude row 6 (prefix/suffix) fields from required validation
    const optionalFields = new Set([
      "prefixFromDate",
      "prefixToDate",
      "prefixDays",
      "suffixFromDate",
      "suffixToDate",
      "suffixDays",
      "applicantSignature",
      "proposedActingHodId",
    ]);

    // Exclude station leave dates if "No" is selected
    if (data.stationYesNo === "No") {
      optionalFields.add("stationFrom");
      optionalFields.add("stationTo");
    }

    // Exclude administrative fields (read-only, filled by admin staff)
    const adminFields = new Set([
      "recommended",
      "hodSignature",
      "adminFrom",
      "adminTo",
      "adminLeaveType",
      "balance",
      "adminDays",
      "assistant",
      "arDr",
      "registrar",
      "authoritySign",
    ]);

    const required = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input, select",
      ),
    )
      .map((input) => {
        const key = input.name || input.id;
        if (!key) return null;
        if (optionalFields.has(key)) return null;
        if (adminFields.has(key)) return null;
        if (input.type === "hidden" || input.type === "radio") return null;
        if ("readOnly" in input && input.readOnly) return null;
        return key;
      })
      .filter((key): key is string => key !== null);
    const missing = required.filter((key) => !data[key]?.trim());
    const missingSet = new Set(missing);
    markMissingInputs(form, missingSet);
    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    const invalidSet = new Set<string>();
    const contactNo = (data.contactNo ?? "").trim();
    const pin = (data.pin ?? "").trim();
    const ltc = (data.ltc ?? "").trim();

    if (!/^\d{10}$/.test(contactNo)) {
      invalidSet.add("contactNo");
    }
    if (!/^\d{6}$/.test(pin)) {
      invalidSet.add("pin");
    }
    if (!(ltc === "PROPOSE" || ltc === "NOT_PROPOSE")) {
      invalidSet.add("ltc");
    }

    if (!computedLeaveDays) {
      invalidSet.add("fromDate");
      invalidSet.add("toDate");
      invalidSet.add("fromSession");
      invalidSet.add("toSession");
      invalidSet.add("days");
    }

    const toDateParsed = toDate ? new Date(`${toDate}T00:00:00`) : null;
    const toMarker =
      (toDateParsed?.getTime() ?? 0) / 86400000 + SESSION_OFFSET[toSession];
    const today = new Date();
    const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
    const nowMarker =
      todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
    if (toDate && toMarker <= nowMarker) {
      invalidSet.add("toDate");
      invalidSet.add("toSession");
    }

    if (invalidSet.size > 0) {
      markMissingInputs(form, invalidSet);
      setMissingFields(Array.from(invalidSet));
      setSubmitError(
        "Please select LTC option, enter a valid 10-digit contact number, and a valid 6-digit PIN.",
      );
      if (invalidSet.has("toSession")) {
        setSubmitError(
          "End date/session must be after the current date session and after start date/session.",
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

  const handlePeriodDateChange = useCallback((field: "fromDate" | "toDate") => {
    return (event: ChangeEvent<HTMLInputElement>) => {
      if (field === "fromDate") {
        setFromDate(event.target.value);
        return;
      }
      setToDate(event.target.value);
    };
  }, []);

  const handlePrefixDateChange = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const fromInput = form.querySelector<HTMLInputElement>("#prefixFromDate");
    const toInput = form.querySelector<HTMLInputElement>("#prefixToDate");
    const daysInput = form.querySelector<HTMLInputElement>("#prefixDays");

    if (fromInput && toInput && daysInput) {
      const days = calculateInclusiveDays(fromInput.value, toInput.value);
      daysInput.value = days;
    }
  }, []);

  const handleSuffixDateChange = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const fromInput = form.querySelector<HTMLInputElement>("#suffixFromDate");
    const toInput = form.querySelector<HTMLInputElement>("#suffixToDate");
    const daysInput = form.querySelector<HTMLInputElement>("#suffixDays");

    if (fromInput && toInput && daysInput) {
      const days = calculateInclusiveDays(fromInput.value, toInput.value);
      daysInput.value = days;
    }
  }, []);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      fromDate,
      fromSession,
      toDate,
      toSession,
    );
    setComputedLeaveDays(value ? formatSessionDays(value) : "");

    const form = formRef.current;
    const daysInput = form?.querySelector<HTMLInputElement>("#days");
    if (daysInput) {
      daysInput.value = value ? formatSessionDays(value) : "";
    }
  }, [fromDate, fromSession, toDate, toSession]);

  useEffect(() => {
    if (!fromDate || !toDate) return;

    if (toDate < fromDate) {
      setToDate(fromDate);
      setToSession("EVENING");
      return;
    }

    if (
      toDate === fromDate &&
      SESSION_OFFSET[toSession] <= SESSION_OFFSET[fromSession]
    ) {
      setToSession(
        fromSession === "MORNING"
          ? "AFTERNOON"
          : fromSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING",
      );
    }
  }, [fromDate, fromSession, toDate, toSession]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    // Set today's date for signature date field
    const signatureDateInput = form.querySelector<HTMLInputElement>(
      "#applicantSignatureDate",
    );
    if (signatureDateInput && !signatureDateInput.value) {
      signatureDateInput.value = new Date().toISOString().split("T")[0];
    }

    void applyAutofillToForm(form, "earned-leave").then((profile) => {
      setOtpEmail(profile.email ?? "");
      const fromValue =
        form.querySelector<HTMLInputElement>("#fromDate")?.value ?? "";
      const toValue =
        form.querySelector<HTMLInputElement>("#toDate")?.value ?? "";
      const fromSessionValue =
        (form.querySelector<HTMLSelectElement>("#fromSession")?.value as
          | DaySession
          | undefined) ?? "MORNING";
      const toSessionValue =
        (form.querySelector<HTMLSelectElement>("#toSession")?.value as
          | DaySession
          | undefined) ?? "EVENING";

      setFromDate(fromValue);
      setToDate(toValue);
      setFromSession(fromSessionValue);
      setToSession(toSessionValue);

      const ltcInput = form.querySelector<HTMLInputElement>("#ltc");
      if (!ltcInput) return;
      const rawValue = (ltcInput.value ?? "").trim().toLowerCase();
      if (rawValue === "not_propose" || rawValue.includes("not")) {
        setLtcChoice("NOT_PROPOSE");
        ltcInput.value = "NOT_PROPOSE";
        return;
      }
      if (rawValue === "propose" || rawValue.includes("propose")) {
        setLtcChoice("PROPOSE");
        ltcInput.value = "PROPOSE";
      }
    });

    // Set up date change listeners
    const prefixFromInput =
      form.querySelector<HTMLInputElement>("#prefixFromDate");
    const prefixToInput = form.querySelector<HTMLInputElement>("#prefixToDate");
    const suffixFromInput =
      form.querySelector<HTMLInputElement>("#suffixFromDate");
    const suffixToInput = form.querySelector<HTMLInputElement>("#suffixToDate");

    prefixFromInput?.addEventListener("change", handlePrefixDateChange);
    prefixToInput?.addEventListener("change", handlePrefixDateChange);
    suffixFromInput?.addEventListener("change", handleSuffixDateChange);
    suffixToInput?.addEventListener("change", handleSuffixDateChange);

    return () => {
      prefixFromInput?.removeEventListener("change", handlePrefixDateChange);
      prefixToInput?.removeEventListener("change", handlePrefixDateChange);
      suffixFromInput?.removeEventListener("change", handleSuffixDateChange);
      suffixToInput?.removeEventListener("change", handleSuffixDateChange);
    };
  }, [handlePrefixDateChange, handleSuffixDateChange, setOtpEmail]);

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

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/earned-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature: signatureMode !== "typed" ? signatureCapture : undefined,
          otpVerified: signatureMode !== "typed" ? isOtpVerified : false,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(
          result.message || "Failed to submit earned leave application.",
        );
      }

      setConfirmed(true);
      setSubmitMessage(
        result.message || "Earned leave application submitted successfully.",
      );
      clearFormDraft("earned-leave");
      resetAfterSubmit();
      setDialogState("success");
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Unable to submit earned leave application.";
      setSubmitError(errorMessage);
      setDialogState(null);
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
      await downloadFormAsPdf(form, "Earned Leave");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-4 sm:space-y-6">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 text-sm font-semibold text-slate-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="space-y-3 sm:space-y-4"
        >
          <SurfaceCard className="mx-auto max-w-4xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-5 sm:p-4 md:p-6">
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

            <header className="space-y-1 text-center text-slate-900">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <Image
                  src="/iit_ropar.png"
                  alt="IIT Ropar"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain sm:h-14 sm:w-14"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold sm:text-base">
                    {translateHindi("भारतीय प्रौद्योगिकी संस्थान रोपड़")}
                  </p>
                  <p className="text-sm font-semibold uppercase sm:text-base">
                    INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                  </p>
                  <p className="text-[11px] text-slate-700">
                    {translateHindi("नंगल रोड, रूपनगर, पंजाब-140001")} / Nangal
                    Road, Rupnagar, Punjab-140001
                  </p>
                </div>
              </div>
              <p className="text-[12px] font-semibold">
                {translateHindi("छुट्टी के लिए अथवा छुट्टी बढ़ाने हेतु आवेदन")}{" "}
                / Application for Leave or Extension of Leave
              </p>
              <p className="text-[11px]">
                {translateHindi(
                  "(अर्जित छुट्टी/अर्ध वेतन छुट्टी/असाधारण छुट्टी/कम्यूटेड छुट्टी/विश्राम की छुट्टी/मातृत्व छुट्टी/पितृत्व छुट्टी/बाल देखभाल छुट्टी)",
                )}
              </p>
              <p className="text-[11px]">
                (Earned Leave/Half Pay Leave/Extra Ordinary Leave/Commuted
                Leave/Vacation/Maternity Leave/Paternity Leave/Child Care Leave)
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full border border-slate-400 text-[11px] text-slate-900 sm:text-[12px]">
                <colgroup>
                  <col className="w-[36%]" />
                  <col />
                </colgroup>
                <tbody>
                  <Row
                    label={`1. ${translateHindi("आवेदक का नाम")} / Name of the applicant`}
                    inputId="name"
                  />
                  <Row
                    label={`2. ${translateHindi("पद नाम")} / Post held`}
                    inputId="post"
                  />
                  <Row
                    label={`3. ${translateHindi("विभाग/केन्द्रीय कार्यालय/अनुभाग")} / Department/Office/Section`}
                    inputId="department"
                  />
                  <Row
                    label={`4. ${translateHindi("अवकाश का प्रकार")} / Nature of Leave applied for`}
                    inputId="leaveType"
                  />
                  <RowPeriod
                    fromDate={fromDate}
                    toDate={toDate}
                    fromSession={fromSession}
                    toSession={toSession}
                    computedLeaveDays={computedLeaveDays}
                    onFromDateChange={handlePeriodDateChange("fromDate")}
                    onToDateChange={handlePeriodDateChange("toDate")}
                    onFromSessionChange={setFromSession}
                    onToSessionChange={setToSession}
                    translateHindi={translateHindi}
                  />
                  <RowPrefixSuffix translateHindi={translateHindi} />
                  <Row
                    label={`7. ${translateHindi("उद्देश्य")} / Purpose`}
                    inputId="purpose"
                  />
                  <Row
                    label={`8. ${translateHindi("कार्य, प्रशासनिक या अन्य उत्तरदायित्व (यदि कोई हो) के लिए वैकल्पिक व्यवस्था")} / Alternative arrangements`}
                    inputId="arrangements"
                  />
                  <RowLtc ltcChoice={ltcChoice} setLtcChoice={setLtcChoice} />
                  <RowAddress translateHindi={translateHindi} />
                  <RowStation
                    stationLeaveRequired={stationLeaveRequired}
                    setStationLeaveRequired={setStationLeaveRequired}
                    translateHindi={translateHindi}
                  />
                </tbody>
              </table>
            </div>

            <p className="text-right text-[12px] text-slate-900">
              {translateHindi("आवेदक के हस्ताक्षर दिनांक सहित")} / Signature of
              the applicant with date:{" "}
              <input
                type="hidden"
                id="applicantSignature"
                name="applicantSignature"
                value={
                  signatureMode === "typed"
                    ? typedSignature
                    : DIGITAL_SIGNATURE_VALUE
                }
                readOnly
              />{" "}
              <span className="inline-flex h-8 w-32 items-end border-b border-dashed border-slate-400 px-1 pb-0.5 align-middle text-left text-[12px] text-slate-900 sm:h-9 sm:w-40 sm:text-[13px]">
                {signatureMode === "typed" ? (
                  typedSignature
                ) : signatureCapture ? (
                  <Image
                    src={signatureCapture.image}
                    alt="Applicant signature"
                    width={160}
                    height={36}
                    unoptimized
                    className="h-8 w-full object-contain"
                  />
                ) : (
                  "DIGITALLY_SIGNED"
                )}
              </span>{" "}
              <DateUnderlineInput
                id="applicantSignatureDate"
                width="w-32"
                readOnly
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </p>

            <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
              <p className="font-semibold text-center">
                {translateHindi("नियंत्रक अधिकारी की टिप्पणियाँ एवं सिफारिशें")}{" "}
                / Remarks and Recommendations of the controlling officer
              </p>
              <div className="space-y-2">
                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("सिफारिश की गई")} / Recommended{" "}
                    {translateHindi("या नहीं की गई")} / not recommended:
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="recommended" width="w-full" readOnly />
                  </div>
                </div>
                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi(
                      "विभागाध्यक्ष एवं विभाग प्रमुख के हस्ताक्षर तिथि सहित",
                    )}{" "}
                    / Signature with date Head of Department/Section In-charge:
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="hodSignature" width="w-full" readOnly />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-400 pt-2 text-[11px] text-slate-900 sm:text-[12px]">
              <p className="text-center font-semibold">
                {translateHindi("प्रशासनिक अनुभाग द्वारा प्रयोग हेतु")} / For
                use by the Administration Section
              </p>
              <div className="space-y-2">
                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <div className="space-y-1 leading-snug">
                    <p>
                      {translateHindi("प्रमाणित किया जाता है कि (प्रकृति)")} /
                      Certified that (nature of leave) for period:
                    </p>
                    <p>is available as per following details:</p>
                  </div>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <span>from</span>
                      <UnderlineInput id="adminFrom" width="w-full" readOnly />
                      <span>to</span>
                      <UnderlineInput id="adminTo" width="w-full" readOnly />
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("अवकाश का प्रकार")} / Nature of leave
                    applied for
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput
                      id="adminLeaveType"
                      width="w-full"
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("आज की तिथि तक शेष")} / Balance as on date
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="balance" width="w-full" readOnly />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("कुल दिनों के लिए अवकाश")} / Leave applied
                    for (No. of days)
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="adminDays" width="w-full" readOnly />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("संबंधित सहायक")} / Dealing Assistant
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="assistant" width="w-full" readOnly />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("अधि./सहा. कुलसचिव/अनुभागाध्यक्ष/")}{" "}
                    Supdt./AR/DR
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="arDr" width="w-full" readOnly />
                  </div>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi("कुलसचिव")} / Registrar
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput id="registrar" width="w-full" readOnly />
                  </div>
                </div>

                <div className="space-y-1 leading-snug">
                  <p>
                    {translateHindi(
                      "छुट्टी स्वीकृत करने के लिए सक्षम प्राधिकारी की टिप्पणी: स्वीकृत / अस्वीकृत",
                    )}
                    / Comments of the competent authority to grant leave:
                    Sanctioned / Not Sanctioned
                  </p>
                </div>

                <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-3">
                  <p className="leading-snug">
                    {translateHindi(
                      "कुलसचिव/ डीन (Faculty Affairs & Administration) / Director के हस्ताक्षर",
                    )}
                    / Signature of Registrar / Dean (Faculty Affairs &
                    Administration) / Director:
                  </p>
                  <div className="w-full lg:w-[22rem] lg:justify-self-end">
                    <UnderlineInput
                      id="authoritySign"
                      width="w-full"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>

          {submitError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:px-4 sm:py-3 sm:text-sm">
              {submitError}
            </div>
          )}
          {submitMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 sm:px-4 sm:py-3 sm:text-sm">
              {submitMessage}
            </div>
          )}

          <ProposedActingHodField />

          <SignatureOtpVerificationCard
            storageScope="earned-leave"
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

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="text-xs text-slate-600">
              {confirmed
                ? "Submission confirmed. You can still edit and resubmit if needed."
                : missingFields.length > 0
                  ? "Please fill the highlighted fields."
                  : "Fill all fields, then submit."}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                className="px-4 text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </form>

        <ConfirmationModal
          state={dialogState}
          title="Earned Leave"
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

const Row = ({ label, inputId }: { label: string; inputId: string }) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">{label}</td>
    <td className="px-3 py-2">
      <UnderlineInput id={inputId} className="w-full" />
    </td>
  </tr>
);

const RowPeriod = ({
  fromDate,
  toDate,
  fromSession,
  toSession,
  computedLeaveDays,
  onFromDateChange,
  onToDateChange,
  onFromSessionChange,
  onToSessionChange,
  translateHindi,
}: {
  fromDate: string;
  toDate: string;
  fromSession: DaySession;
  toSession: DaySession;
  computedLeaveDays: string;
  onFromDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFromSessionChange: (value: DaySession) => void;
  onToSessionChange: (value: DaySession) => void;
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      5. {translateHindi("छुट्टी की अवधि")}/ Period of Leave
    </td>
    <td className="px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>{translateHindi("से")} / From:</span>
        <DateUnderlineInput
          id="fromDate"
          width="w-32"
          min={getTodayIso()}
          value={fromDate}
          onChange={onFromDateChange}
        />
        <SessionSelect
          id="fromSession"
          value={fromSession}
          onChange={(value) => onFromSessionChange(value)}
        />
        <span>{translateHindi("तक")}/To:</span>
        <DateUnderlineInput
          id="toDate"
          width="w-32"
          min={fromDate || getTodayIso()}
          value={toDate}
          onChange={onToDateChange}
        />
        <SessionSelect
          id="toSession"
          value={toSession}
          onChange={(value) => onToSessionChange(value)}
        />
        <span>{translateHindi("दिनों की संख्या")}/No. of days:</span>
        <UnderlineInput
          id="days"
          width="w-20"
          readOnly
          value={computedLeaveDays}
        />
      </div>
    </td>
  </tr>
);

const SessionSelect = ({
  id,
  value,
  onChange,
}: {
  id: string;
  value: DaySession;
  onChange: (value: DaySession) => void;
}) => (
  <select
    id={id}
    name={id}
    value={value}
    onChange={(event) => onChange(event.target.value as DaySession)}
    className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
  >
    <option value="MORNING">Morning</option>
    <option value="AFTERNOON">Afternoon</option>
    <option value="EVENING">Evening</option>
  </select>
);

const RowPrefixSuffix = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      6.{" "}
      {translateHindi(
        "यदि कोई, रविवार और अवकाश, छुट्टी से पूर्व या पश्चात में लिए जा रहे हैं",
      )}
      <div className="text-[11px] font-normal">
        Sunday and holiday, if any, proposed to be prefixed/suffixed to leave
      </div>
    </td>
    <td className="px-3 py-2 text-[12px] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span>{translateHindi("के पूर्व")} Prefix</span>
        <span>{translateHindi("से")}/From:</span>
        <DateUnderlineInput id="prefixFromDate" width="w-28" />
        <span>{translateHindi("तक")}/To:</span>
        <DateUnderlineInput id="prefixToDate" width="w-28" />
        <span>{translateHindi("दिनों की संख्या")}/No. of days:</span>
        <UnderlineInput id="prefixDays" width="w-20" readOnly />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span>{translateHindi("के पश्चात")} Suffix</span>
        <span>{translateHindi("से")}/From:</span>
        <DateUnderlineInput id="suffixFromDate" width="w-28" />
        <span>{translateHindi("तक")}/To:</span>
        <DateUnderlineInput id="suffixToDate" width="w-28" />
        <span>{translateHindi("दिनों की संख्या")}/No. of days:</span>
        <UnderlineInput id="suffixDays" width="w-20" readOnly />
      </div>
    </td>
  </tr>
);

const RowLtc = ({
  ltcChoice,
  setLtcChoice,
}: {
  ltcChoice: string;
  setLtcChoice: (value: string) => void;
}) => {
  const handleLtcChange = (value: "PROPOSE" | "NOT_PROPOSE") => {
    setLtcChoice(value);
    const form = document.querySelector<HTMLFormElement>("form");
    const hiddenInput = form?.querySelector<HTMLInputElement>("#ltc");
    if (hiddenInput) {
      hiddenInput.value = value;
    }
  };

  return (
    <tr className="border-t border-slate-400">
      <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
        9. I propose/do not propose to avail Leave Travel Concession during the
        leave.
      </td>
      <td className="px-3 py-2 text-[12px]">
        <input type="hidden" id="ltc" name="ltc" value={ltcChoice} readOnly />
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ltcChoice"
              value="PROPOSE"
              checked={ltcChoice === "PROPOSE"}
              onChange={(e) =>
                handleLtcChange(e.target.value as "PROPOSE" | "NOT_PROPOSE")
              }
              className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <span>Propose</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="ltcChoice"
              value="NOT_PROPOSE"
              checked={ltcChoice === "NOT_PROPOSE"}
              onChange={(e) =>
                handleLtcChange(e.target.value as "PROPOSE" | "NOT_PROPOSE")
              }
              className="h-3.5 w-3.5 border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <span>Do not propose</span>
          </label>
        </div>
      </td>
    </tr>
  );
};

const RowAddress = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <tr className="border-t border-slate-400">
    <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
      10. {translateHindi("अवकाश के दौरान पता")} / Address during the leave
    </td>
    <td className="px-3 py-2 space-y-2 text-[12px]">
      <UnderlineInput id="address" className="w-full" />
      <div className="flex flex-wrap items-center gap-3">
        <span>{translateHindi("संपर्क नं.")} / Contact No.</span>
        <UnderlineInput
          id="contactNo"
          width="w-40"
          maxLength={10}
          pattern="\d{10}"
          inputMode="numeric"
        />
        <span>{translateHindi("पिन")} / PIN:</span>
        <UnderlineInput
          id="pin"
          width="w-24"
          maxLength={6}
          pattern="\d{6}"
          inputMode="numeric"
        />
      </div>
    </td>
  </tr>
);

const RowStation = ({
  stationLeaveRequired,
  setStationLeaveRequired,
  translateHindi,
}: {
  stationLeaveRequired: string;
  setStationLeaveRequired: (value: string) => void;
  translateHindi: (text: string) => string;
}) => {
  const handleYesNoChange = (value: string) => {
    setStationLeaveRequired(value);
    const form = document.querySelector<HTMLFormElement>("form");
    if (form) {
      const hiddenInput = form.querySelector<HTMLInputElement>("#stationYesNo");
      if (hiddenInput) {
        hiddenInput.value = value;
      }
    }
  };

  return (
    <tr className="border-t border-slate-400">
      <td className="bg-slate-50 px-3 py-2 align-top font-semibold">
        11. {translateHindi("क्या स्टेशन अवकाश की आवश्यकता है")} / Whether
        Station leave is required
      </td>
      <td className="px-3 py-2 space-y-2 text-[12px]">
        <div className="flex flex-wrap items-center gap-3">
          <span>{translateHindi("हाँ")} / Yes / No :</span>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationLeaveRadio"
                value="Yes"
                checked={stationLeaveRequired === "Yes"}
                onChange={(e) => handleYesNoChange(e.target.value)}
                className="w-3.5 h-3.5 text-slate-600 border-slate-300 focus:ring-slate-500"
              />
              <span>{translateHindi("हाँ")} / Yes</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="stationLeaveRadio"
                value="No"
                checked={stationLeaveRequired === "No"}
                onChange={(e) => handleYesNoChange(e.target.value)}
                className="w-3.5 h-3.5 text-slate-600 border-slate-300 focus:ring-slate-500"
              />
              <span>{translateHindi("नहीं")} / No</span>
            </label>
          </div>
          <input
            type="hidden"
            id="stationYesNo"
            name="stationYesNo"
            value={stationLeaveRequired}
          />
        </div>
        {stationLeaveRequired === "Yes" && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span>{translateHindi("यदि हाँ")} / If yes :</span>
            <span>{translateHindi("से")} / From :</span>
            <DateUnderlineInput id="stationFrom" width="w-28" />
            <span>{translateHindi("तक")} / To :</span>
            <DateUnderlineInput id="stationTo" width="w-28" />
          </div>
        )}
      </td>
    </tr>
  );
};
