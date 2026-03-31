"use client";

export const dynamic = "force-dynamic";

import type { FormEvent, InputHTMLAttributes } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  saveFormDraft,
  clearFormDraft,
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
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "నంగళ్ రోడ్, రూపనగర్, పంజాబ్-140001",
    दूरभाष: "దూరవాణి",
    फैक्स: "ఫ్యాక్స్",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "ఎయిర్ ఇండియా కాకుండా ఇతర ఎయిర్‌లైన్ ద్వారా ప్రయాణానికి అనుమతి కోసం దరఖాస్తు",
    नाम: "పేరు",
    पदनाम: "పదవి",
    विभाग: "విభాగం",
    "यात्रा की तिथियां": "ప్రయాణ తేదీలు",
    "प्रस्थान यात्रा": "ప్రస్థాన ప్రయాణం",
    "वापसी यात्रा": "తిరుగు ప్రయాణం",
    "कुल दिन": "మొత్తం రోజులు",
    "भ्रमण का स्थान": "సందర్శించాల్సిన స్థలం",
    उद्देश्य: "ఉద్దేశ్యం",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है": "అనుమతి కోరుతున్న సెక్షన్‌లు",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "ఎయిర్ ఇండియా కాకుండా ఇతర ఎయిర్‌లైన్ ద్వారా ప్రయాణించే కారణం",
    "एमएचआरडी से अनुमति प्राप्त की गई है।":
      "ఎంహెచ్ఆర్డీ నుండి అనుమతి పొందినదా.",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)":
      "అవును/కాదు (అవును అయితే మెయిల్ జత చేయబడింది)",
    "बजट मद: संस्थान/परियोजना": "బడ్జెట్ హెడ్: సంస్థ/ప్రాజెక్ట్",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "పై క్రమ సంఖ్య 8లో పేర్కొన్న కారణాల ఆధారంగా ఎయిర్ ఇండియా కాకుండా ఇతర ఎయిర్‌లైన్ ద్వారా ప్రయాణానికి అనుమతి ఇవ్వగలరని వినమ్రంగా అభ్యర్థిస్తున్నాము.",
    "आवेदक के हस्ताक्षर दिनांक सहित": "దరఖాస్తుదారుడి సంతకం తేదీతో",
    "विभागाध्यक्ष की अनुशंसा": "విభాగాధ్యక్షుడి సిఫారసు",
    "डीन (Faculty Affairs and Administration)":
      "డీన్ (Faculty Affairs and Administration)",
    निदेशक: "నిర్దేశకుడు",
  },
  PA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ਭਾਰਤੀ ਪ੍ਰੌਧੋਗਿਕੀ ਸੰਸਥਾਨ ਰੋਪੜ",
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "ਨੰਗਲ ਰੋਡ, ਰੂਪਨਗਰ, ਪੰਜਾਬ-140001",
    दूरभाष: "ਟੈਲੀਫੋਨ",
    फैक्स: "ਫੈਕਸ",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "ਏਅਰ ਇੰਡੀਆ ਤੋਂ ਇਲਾਵਾ ਹੋਰ ਏਅਰਲਾਈਨ ਨਾਲ ਯਾਤਰਾ ਦੀ ਇਜਾਜ਼ਤ ਲਈ ਅਰਜ਼ੀ",
    नाम: "ਨਾਮ",
    पदनाम: "ਪਦ",
    विभाग: "ਵਿਭਾਗ",
    "यात्रा की तिथियां": "ਯਾਤਰਾ ਦੀਆਂ ਤਰੀਖਾਂ",
    "प्रस्थान यात्रा": "ਜਾਣ ਵਾਲੀ ਯਾਤਰਾ",
    "वापसी यात्रा": "ਵਾਪਸੀ ਯਾਤਰਾ",
    "कुल दिन": "ਕੁੱਲ ਦਿਨ",
    "भ्रमण का स्थान": "ਦੌਰੇ ਦਾ ਸਥਾਨ",
    उद्देश्य: "ਉਦੇਸ਼",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है":
      "ਜਿਨ੍ਹਾਂ ਸੈਕਟਰਾਂ ਲਈ ਇਜਾਜ਼ਤ ਮੰਗੀ ਗਈ ਹੈ",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "ਏਅਰ ਇੰਡੀਆ ਤੋਂ ਇਲਾਵਾ ਹੋਰ ਏਅਰਲਾਈਨ ਨਾਲ ਯਾਤਰਾ ਦਾ ਕਾਰਨ",
    "एमएचआरडी से अनुमति प्राप्त की गई है।": "ਐਮਐਚਆਰਡੀ ਤੋਂ ਇਜਾਜ਼ਤ ਲਈ ਗਈ ਹੈ।",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)": "ਹਾਂ/ਨਹੀਂ (ਜੇ ਹਾਂ ਤਾਂ ਈਮੇਲ ਲਗਾਈ ਹੈ)",
    "बजट मद: संस्थान/परियोजना": "ਬਜਟ ਹੈਡ: ਸੰਸਥਾਨ/ਪ੍ਰੋਜੈਕਟ",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "ਕਿਰਪਾ ਕਰਕੇ ਉਪਰੋਕਤ ਕ੍ਰ. 8 ਵਿੱਚ ਦਿੱਤੇ ਕਾਰਨ ਅਨੁਸਾਰ ਏਅਰ ਇੰਡੀਆ ਤੋਂ ਇਲਾਵਾ ਹੋਰ ਏਅਰਲਾਈਨ ਨਾਲ ਯਾਤਰਾ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ।",
    "आवेदक के हस्ताक्षर दिनांक सहित": "ਅਰਜ਼ੀਕਰਤਾ ਦੇ ਦਸਤਖ਼ਤ ਤਾਰੀਖ਼ ਸਮੇਤ",
    "विभागाध्यक्ष की अनुशंसा": "ਵਿਭਾਗ ਮੁਖੀ ਦੀ ਸਿਫ਼ਾਰਸ਼",
    "डीन (Faculty Affairs and Administration)":
      "ਡੀਂ (Faculty Affairs and Administration)",
    निदेशक: "ਡਾਇਰੈਕਟਰ",
  },
  MR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "भारतीय तंत्रज्ञान संस्था रोपड",
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "नांगल रोड, रूपनगर, पंजाब-140001",
    दूरभाष: "दूरध्वनी",
    फैक्स: "फॅक्स",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "एअर इंडिया व्यतिरिक्त अन्य एअरलाइनने प्रवासासाठी परवानगीसाठी अर्ज",
    नाम: "नाव",
    पदनाम: "पदनाम",
    विभाग: "विभाग",
    "यात्रा की तिथियां": "प्रवासाच्या तारखा",
    "प्रस्थान यात्रा": "प्रस्थान प्रवास",
    "वापसी यात्रा": "वापसी प्रवास",
    "कुल दिन": "एकूण दिवस",
    "भ्रमण का स्थान": "भ्रमणाचे ठिकाण",
    उद्देश्य: "उद्देश",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है":
      "ज्या सेक्टरसाठी परवानगी मागितली आहे",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "एअर इंडिया व्यतिरिक्त अन्य एअरलाइनने प्रवासाचे कारण",
    "एमएचआरडी से अनुमति प्राप्त की गई है।": "एमएचआरडीकडून परवानगी घेतली आहे.",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)": "हो/नाही (हो असल्यास ईमेल संलग्न)",
    "बजट मद: संस्थान/परियोजना": "बजेट हेड: संस्था/प्रकल्प",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "कृपया वरील क्र. 8 मध्ये दिलेल्या कारणावरून एअर इंडिया व्यतिरिक्त अन्य एअरलाइनने प्रवासाची परवानगी द्यावी.",
    "आवेदक के हस्ताक्षर दिनांक सहित": "अर्जदाराची सही दिनांकासह",
    "विभागाध्यक्ष की अनुशंसा": "विभागाध्यक्षांची शिफारस",
    "डीन (Faculty Affairs and Administration)":
      "डीन (Faculty Affairs and Administration)",
    निदेशक: "संचालक",
  },
  TA: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "இந்திய தொழில்நுட்ப நிறுவனம் ரோபர்",
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "நங்கல் சாலை, ரூப்நகர், பஞ்சாப்-140001",
    दूरभाष: "தொலைபேசி",
    फैक्स: "பேக்ஸ்",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "ஏர் இந்தியாவைத் தவிர மற்ற விமான சேவையில் பயண அனுமதி கோரும் விண்ணப்பு",
    नाम: "பெயர்",
    पदनाम: "பதவி",
    विभाग: "துறை",
    "यात्रा की तिथियां": "பயண தேதிகள்",
    "प्रस्थान यात्रा": "புறப்பாட்டு பயணம்",
    "वापसी यात्रा": "திரும்பும் பயணம்",
    "कुल दिन": "மொத்த நாட்கள்",
    "भ्रमण का स्थान": "பார்வையிட வேண்டிய இடம்",
    उद्देश्य: "நோக்கம்",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है": "அனுமதி கோரும் செக்டர்கள்",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "ஏர் இந்தியாவைத் தவிர மற்ற விமான சேவையில் பயணிக்கக் காரணம்",
    "एमएचआरडी से अनुमति प्राप्त की गई है।":
      "எம்எச்ஆர்டி அனுமதி பெறப்பட்டுள்ளது.",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)":
      "ஆம்/இல்லை (ஆம் என்றால் மெயில் இணைக்கப்பட்டுள்ளது)",
    "बजट मद: संस्थान/परियोजना": "பட்ஜெட் தலைப்பு: நிறுவனம்/திட்டம்",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "மேலே கூறிய எண் 8 காரணத்தின் அடிப்படையில் ஏர் இந்தியாவைத் தவிர மற்ற விமான சேவையில் பயண அனுமதி வழங்கவும்.",
    "आवेदक के हस्ताक्षर दिनांक सहित": "விண்ணப்பதாரரின் கையொப்பம் தேதி உடன்",
    "विभागाध्यक्ष की अनुशंसा": "துறைத் தலைவர் பரிந்துரை",
    "डीन (Faculty Affairs and Administration)":
      "டீன் (Faculty Affairs and Administration)",
    निदेशक: "இயக்குநர்",
  },
  ML: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "ഇന്ത്യൻ സാങ്കേതിക സ്ഥാപനമായ റോപ്പർ",
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "നങ്ങൽ റോഡ്, രൂപ്‌നഗർ, പഞ്ചാബ്-140001",
    दूरभाष: "ടെലിഫോൺ",
    फैक्स: "ഫാക്സ്",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "എയർ ഇന്ത്യയ്ക്ക് പുറമെ മറ്റൊരു എയർലൈൻ വഴി യാത്രാനുമതിക്ക് അപേക്ഷ",
    नाम: "പേര്",
    पदनाम: "പദവി",
    विभाग: "വകുപ്പ്",
    "यात्रा की तिथियां": "യാത്ര തീയതികൾ",
    "प्रस्थान यात्रा": "പുറപ്പെടുന്ന യാത്ര",
    "वापसी यात्रा": "മടങ്ങുന്ന യാത്ര",
    "कुल दिन": "മൊത്തം ദിവസങ്ങൾ",
    "भ्रमण का स्थान": "സന്ദർശിക്കാനുള്ള സ്ഥലം",
    उद्देश्य: "ഉദ്ദേശ്യം",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है": "അനുമതി ആവശ്യപ്പെടുന്ന സെക്ടറുകൾ",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "എയർ ഇന്ത്യയ്ക്ക് പുറമെ മറ്റൊരു എയർലൈൻ വഴി യാത്രയുടെ കാരണം",
    "एमएचआरडी से अनुमति प्राप्त की गई है।":
      "എംഎച്ച്ആർഡിയിൽ നിന്ന് അനുമതി ലഭിച്ചിട്ടുണ്ട്.",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)":
      "അതെ/അല്ല (അതെ ആണെങ്കിൽ മെയിൽ ചേർത്തിരിക്കുന്നു)",
    "बजट मद: संस्थान/परियोजना": "ബജറ്റ് ഹെഡ്: സ്ഥാപന/പ്രോജക്റ്റ്",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "മുകളിൽ ക്ര. 8ൽ പറയുന്ന കാരണത്തിന്റെ അടിസ്ഥാനത്തിൽ എയർ ഇന്ത്യയ്ക്ക് പുറമെ മറ്റൊരു എയർലൈൻ വഴി യാത്രാനുമതി നൽകുക.",
    "आवेदक के हस्ताक्षर दिनांक सहित": "അപേക്ഷകന്റെ ഒപ്പ് തീയതിയോടെ",
    "विभागाध्यक्ष की अनुशंसा": "വകുപ്പ് തലവന്റെ ശുപാർശ",
    "डीन (Faculty Affairs and Administration)":
      "ഡീൻ (Faculty Affairs and Administration)",
    निदेशक: "ഡയറക്ടർ",
  },
  UR: {
    "भारतीय प्रौद्योगिकी संस्थान रोपड़": "انڈین انسٹی ٹیوٹ آف ٹیکنالوجی روپڑ",
    "नंगल मार्ग, रूपनगर,पंजाब-140001": "ننگل روڈ، روپ نگر، پنجاب-140001",
    दूरभाष: "ٹیلیفون",
    फैक्स: "فیکس",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन":
      "ایئر انڈیا کے علاوہ دیگر ایئر لائن سے سفر کی اجازت کے لیے درخواست",
    नाम: "نام",
    पदनाम: "عہدہ",
    विभाग: "شعبہ",
    "यात्रा की तिथियां": "سفر کی تاریخیں",
    "प्रस्थान यात्रा": "روانہ ہونے کا سفر",
    "वापसी यात्रा": "واپسی کا سفر",
    "कुल दिन": "کل دن",
    "भ्रमण का स्थान": "دورے کا مقام",
    उद्देश्य: "مقصد",
    "जिन सेक्टरों के लिए अनुमति मांगी गई है":
      "جن سیکٹروں کے لیے اجازت مانگی گئی ہے",
    "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण":
      "ایئر انڈیا کے علاوہ دیگر ایئر لائن سے سفر کی وجہ",
    "एमएचआरडी से अनुमति प्राप्त की गई है।":
      "ایم ایچ آر ڈی سے اجازت حاصل کی گئی ہے۔",
    "हाँ/नहीं (यदि हाँ तो मेल संलग्न)": "ہاں/نہیں (اگر ہاں تو ای میل منسلک ہے)",
    "बजट मद: संस्थान/परियोजना": "بجٹ ہیڈ: ادارہ/پروجیکٹ",
    "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।":
      "براہ کرم اوپر نمبر 8 میں بیان کردہ وجہ کی بنیاد پر ایئر انڈیا کے علاوہ دیگر ایئر لائن سے سفر کی اجازت دیں۔",
    "आवेदक के हस्ताक्षर दिनांक सहित": "درخواست گزار کے دستخط تاریخ کے ساتھ",
    "विभागाध्यक्ष की अनुशंसा": "سربراہ شعبہ کی سفارش",
    "डीन (Faculty Affairs and Administration)":
      "ڈین (Faculty Affairs and Administration)",
    निदेशक: "ڈائریکٹر",
  },
};

interface UnderlineInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  id: string;
  width?: string;
  type?: "text" | "number" | "date" | "email";
}

const UnderlineInput = ({
  id,
  width = "w-60",
  className,
  type = "text",
  required = true,
  ...props
}: UnderlineInputProps) => (
  <input
    id={id}
    name={id}
    type={type}
    required={required}
    className={cn(
      "border-0 border-b border-dashed border-slate-500 bg-transparent px-1 text-[13px] text-slate-900 focus:border-slate-800 focus:outline-none",
      width,
      className,
    )}
    {...props}
  />
);

export default function NonAirIndiaPage() {
  return (
    <Suspense fallback={null}>
      <NonAirIndiaPageContent />
    </Suspense>
  );
}

function NonAirIndiaPageContent() {
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
  const [formLanguage, setFormLanguage] = useState<FormLanguage>("HI");
  const [onwardJourney, setOnwardJourney] = useState("");
  const [returnJourney, setReturnJourney] = useState("");
  const [onwardSession, setOnwardSession] = useState<DaySession>("MORNING");
  const [returnSession, setReturnSession] = useState<DaySession>("EVENING");
  const [computedTravelDays, setComputedTravelDays] = useState("");
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
  } = useSignatureOtp({ enableTyped: false });

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
      if (!input.required) return;
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
    data.onwardSession = onwardSession;
    data.returnSession = returnSession;
    data.travelDays = computedTravelDays;
    data.applicantSignature =
      signatureMode === "typed"
        ? typedSignature.trim()
        : DIGITAL_SIGNATURE_VALUE;
    saveFormDraft("non-air-india", data);

    // Check missing for only required fields
    const required = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input[required], select[required]",
      ),
    )
      .map((input) => input.name || input.id)
      .filter(Boolean);

    const missing = required.filter((key) => !data[key]?.trim());
    const missingSet = new Set(missing);

    markMissingInputs(form, missingSet);

    if (missingSet.size > 0) {
      setMissingFields(Array.from(missingSet));
      return;
    }

    const invalidSet = new Set<string>();
    if (!computedTravelDays) {
      invalidSet.add("onwardJourney");
      invalidSet.add("returnJourney");
      invalidSet.add("onwardSession");
      invalidSet.add("returnSession");
    }

    const returnDateParsed = returnJourney
      ? new Date(`${returnJourney}T00:00:00`)
      : null;
    const returnMarker =
      (returnDateParsed?.getTime() ?? 0) / 86400000 +
      SESSION_OFFSET[returnSession];
    const today = new Date();
    const todayDate = new Date(`${today.toISOString().slice(0, 10)}T00:00:00`);
    const nowMarker =
      todayDate.getTime() / 86400000 + SESSION_OFFSET[resolveCurrentSession()];
    if (returnJourney && returnMarker <= nowMarker) {
      invalidSet.add("returnJourney");
      invalidSet.add("returnSession");
    }

    if (invalidSet.size > 0) {
      markMissingInputs(form, invalidSet);
      setMissingFields(Array.from(invalidSet));
      alert(
        "Return date/session must be after the current date session and after onward date/session.",
      );
      return;
    }

    const signatureError = ensureReadyForSubmit({
      digital:
        "Please complete Digital Signature and OTP verification on the form before submitting.",
    });
    if (signatureError) {
      alert(signatureError);
      return;
    }

    setMissingFields([]);
    pendingDataRef.current = data;
    setDialogState("confirm");
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    void applyAutofillToForm(form, "non-air-india").then((profile) => {
      setOtpEmail(profile.email ?? "");
      setOnwardJourney(
        form.querySelector<HTMLInputElement>("#onwardJourney")?.value ?? "",
      );
      setReturnJourney(
        form.querySelector<HTMLInputElement>("#returnJourney")?.value ?? "",
      );
      setOnwardSession(
        (form.querySelector<HTMLSelectElement>("#onwardSession")?.value as
          | DaySession
          | undefined) ?? "MORNING",
      );
      setReturnSession(
        (form.querySelector<HTMLSelectElement>("#returnSession")?.value as
          | DaySession
          | undefined) ?? "EVENING",
      );
    });
  }, [setOtpEmail]);

  useEffect(() => {
    const value = computeSessionLeaveDaysFromInput(
      onwardJourney,
      onwardSession,
      returnJourney,
      returnSession,
    );
    setComputedTravelDays(value ? formatSessionDays(value) : "");
  }, [onwardJourney, onwardSession, returnJourney, returnSession]);

  useEffect(() => {
    if (!onwardJourney || !returnJourney) return;

    if (returnJourney < onwardJourney) {
      setReturnJourney(onwardJourney);
      setReturnSession("EVENING");
      return;
    }

    if (
      returnJourney === onwardJourney &&
      SESSION_OFFSET[returnSession] <= SESSION_OFFSET[onwardSession]
    ) {
      setReturnSession(
        onwardSession === "MORNING"
          ? "AFTERNOON"
          : onwardSession === "AFTERNOON"
            ? "EVENING"
            : "EVENING",
      );
    }
  }, [onwardJourney, onwardSession, returnJourney, returnSession]);

  const handleConfirmSubmit = async () => {
    const signatureError = ensureReadyForSubmit({
      digital:
        "Complete digital signature and OTP verification before submitting.",
    });
    if (signatureError) {
      alert(signatureError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/non-air-india", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: pendingDataRef.current,
          signature: signatureMode !== "typed" ? signatureCapture : undefined,
          otpVerified: signatureMode !== "typed" ? isOtpVerified : false,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Submission failed");
      }

      setConfirmed(true);
      setDialogState("success");
      resetAfterSubmit();

      // CLEAR DRAFT AFTER SUCCESS
      clearFormDraft("non-air-india");
      if (formRef.current) {
        formRef.current.reset(); // Empty the form visually
        // Re-apply basic profile info (Name, Designation, Dept) so it's ready for next time
        void applyAutofillToForm(formRef.current, "non-air-india");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Submission failed");
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
      await downloadFormAsPdf(form, "Non-Air-India Travel");
    } catch (err) {
      console.error("PDF generation failed", err);
      window.alert("Unable to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DashboardShell>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-3 sm:space-y-4"
      >
        <Button
          variant="ghost"
          onClick={handleBack}
          className="px-0 text-sm font-semibold text-slate-700"
          type="button"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <SurfaceCard className="mx-auto max-w-3xl space-y-4 border border-slate-300 bg-white p-3 sm:space-y-5 sm:p-4 md:p-7">
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
            <div className="flex items-start justify-center gap-3 sm:gap-4">
              <Image
                src="/iit_ropar.png"
                alt="IIT Ropar"
                width={48}
                height={48}
                className="h-12 w-12 object-contain sm:h-16 sm:w-16"
              />
              <div className="space-y-1 text-left">
                <p className="text-sm font-semibold sm:text-base">
                  {translateHindi("भारतीय प्रौद्योगिकी संस्थान रोपड़")}
                </p>
                <p className="text-sm font-semibold uppercase sm:text-base">
                  INDIAN INSTITUTE OF TECHNOLOGY ROPAR
                </p>
                <p className="text-[11px] text-slate-700">
                  {translateHindi("नंगल मार्ग, रूपनगर,पंजाब-140001")} / Nangal
                  Road, Rupnagar, Punjab-140001
                </p>
                <p className="text-[11px] text-slate-700">
                  {translateHindi("दूरभाष")}/Tele: +91-1881-227078,
                  {translateHindi("फैक्स")} /Fax : +91-1881-223395
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold uppercase">
              APPLICATION FOR PERMISSION TO TRAVEL BY AIRLINE OTHER THAN AIR
              INDIA /{" "}
              {translateHindi(
                "एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति हेतु आवेदन",
              )}
            </p>
          </header>

          <div className="space-y-3 text-[12px] text-slate-900 sm:text-[13px]">
            <LabeledLine
              number="1"
              label={`Name / ${translateHindi("नाम")}`}
              inputId="name"
            />
            <LabeledLine
              number="2"
              label={`Designation / ${translateHindi("पदनाम")}`}
              inputId="designation"
            />
            <LabeledLine
              number="3"
              label={`Department / ${translateHindi("विभाग")}`}
              inputId="department"
            />
            <VisitDates
              onwardJourney={onwardJourney}
              returnJourney={returnJourney}
              onwardSession={onwardSession}
              returnSession={returnSession}
              computedTravelDays={computedTravelDays}
              onOnwardJourneyChange={setOnwardJourney}
              onReturnJourneyChange={setReturnJourney}
              onOnwardSessionChange={setOnwardSession}
              onReturnSessionChange={setReturnSession}
              translateHindi={translateHindi}
            />
            <LabeledLine
              number="5"
              label={`Place to be Visited / ${translateHindi("भ्रमण का स्थान")}`}
              inputId="placeToVisit"
            />
            <LabeledLine
              number="6"
              label={`Purpose / ${translateHindi("उद्देश्य")}`}
              inputId="purpose"
            />
            <LabeledLine
              number="7"
              label={`Sectors for which permission is sought / ${translateHindi(
                "जिन सेक्टरों के लिए अनुमति मांगी गई है",
              )}`}
              inputId="sectors"
            />
            <LabeledLine
              number="8"
              label={`Reason for travel by airline other than Air India / ${translateHindi(
                "एयर इंडिया के अलावा एयरलाइन से यात्रा का कारण",
              )}`}
              inputId="reason"
            />
            <PermissionMhrd translateHindi={translateHindi} />
            <LabeledLine
              number="10"
              label={`Budget Head: Institute/Project / ${translateHindi(
                "बजट मद: संस्थान/परियोजना",
              )}`}
              inputId="budgetHead"
            />
          </div>

          <p className="text-[12px] text-slate-900">
            May kindly consider and grant permission to travel by Airline other
            than AirIndia as a special case as justified at Sr. No. 8 above. /{" "}
            {translateHindi(
              "कृपया उपरोक्त क्र. 8 में बताए गए कारण के आधार पर एयर इंडिया के अलावा एयरलाइन से यात्रा की अनुमति प्रदान करने की कृपा करें।",
            )}
          </p>

          <div className="flex items-center justify-end text-[11px] text-slate-900 sm:text-[12px]">
            <span>
              (Signature of Applicant’s with date) /{" "}
              {translateHindi("आवेदक के हस्ताक्षर दिनांक सहित")}
            </span>
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
            />
            <span className="ml-2 inline-flex h-8 w-40 items-end border-b border-dashed border-slate-400 px-1 pb-0.5 align-middle text-left text-[12px] text-slate-900 sm:h-9 sm:w-64 sm:text-[13px]">
              {signatureMode === "typed" ? (
                typedSignature
              ) : signatureCapture ? (
                <Image
                  src={signatureCapture.image}
                  alt="Applicant signature"
                  width={256}
                  height={36}
                  unoptimized
                  className="h-8 w-full object-contain"
                />
              ) : (
                "DIGITALLY_SIGNED"
              )}
            </span>
          </div>

          <div className="space-y-2 text-[11px] text-slate-900 sm:text-[12px]">
            <p>
              Recommendation of the HoD /{" "}
              {translateHindi("विभागाध्यक्ष की अनुशंसा")}
            </p>
            <p>
              Dean (Faculty Affairs and Administration) /{" "}
              {translateHindi("डीन (Faculty Affairs and Administration)")}
            </p>
            <p>Director / {translateHindi("निदेशक")}</p>
          </div>
        </SurfaceCard>

        <ProposedActingHodField />

        <SignatureOtpVerificationCard
          storageScope="non-air-india"
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

        <ConfirmationModal
          state={dialogState}
          title="Non-Air-India Travel"
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
              ? `${title} request has been submitted successfully. You may close this window.`
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

const LabeledLine = ({
  number,
  label,
  inputId,
  type = "text",
}: {
  number: string;
  label: string;
  inputId: string;
  type?: "text" | "number" | "date";
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-4 text-right font-semibold">{number}</span>
    <span className="flex-1 font-semibold">{label}</span>
    <span>:</span>
    <UnderlineInput id={inputId} type={type} className="flex-1" />
  </div>
);

const VisitDates = ({
  onwardJourney,
  returnJourney,
  onwardSession,
  returnSession,
  computedTravelDays,
  onOnwardJourneyChange,
  onReturnJourneyChange,
  onOnwardSessionChange,
  onReturnSessionChange,
  translateHindi,
}: {
  onwardJourney: string;
  returnJourney: string;
  onwardSession: DaySession;
  returnSession: DaySession;
  computedTravelDays: string;
  onOnwardJourneyChange: (value: string) => void;
  onReturnJourneyChange: (value: string) => void;
  onOnwardSessionChange: (value: DaySession) => void;
  onReturnSessionChange: (value: DaySession) => void;
  translateHindi: (text: string) => string;
}) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-4 text-right font-semibold">4</span>
      <span className="flex-1 font-semibold">
        Visit Dates / {translateHindi("यात्रा की तिथियां")}
      </span>
      <span>:</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs">
          Onward Journey / {translateHindi("प्रस्थान यात्रा")}:
        </span>
        <UnderlineInput
          id="onwardJourney"
          type="date"
          width="w-36"
          min={getTodayIso()}
          value={onwardJourney}
          onChange={(event) => onOnwardJourneyChange(event.target.value)}
        />
        <select
          id="onwardSession"
          name="onwardSession"
          required
          value={onwardSession}
          onChange={(event) =>
            onOnwardSessionChange(event.target.value as DaySession)
          }
          className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="MORNING">
            Morning / {translateHindi("पूर्वाह्न")}
          </option>
          <option value="AFTERNOON">
            Afternoon / {translateHindi("अपराह्न")}
          </option>
          <option value="EVENING">Evening / {translateHindi("सायं")}</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs">
          Return Journey / {translateHindi("वापसी यात्रा")}:
        </span>
        <UnderlineInput
          id="returnJourney"
          type="date"
          width="w-36"
          min={onwardJourney || getTodayIso()}
          value={returnJourney}
          onChange={(event) => onReturnJourneyChange(event.target.value)}
        />
        <select
          id="returnSession"
          name="returnSession"
          required
          value={returnSession}
          onChange={(event) =>
            onReturnSessionChange(event.target.value as DaySession)
          }
          className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[12px] text-slate-900 focus:border-slate-800 focus:outline-none"
        >
          <option value="MORNING">
            Morning / {translateHindi("पूर्वाह्न")}
          </option>
          <option value="AFTERNOON">
            Afternoon / {translateHindi("अपराह्न")}
          </option>
          <option value="EVENING">Evening / {translateHindi("सायं")}</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-xs">
          Total Days / {translateHindi("कुल दिन")}:
        </span>
        <UnderlineInput
          id="travelDays"
          type="text"
          width="w-20"
          required={false}
          readOnly
          value={computedTravelDays}
        />
      </div>
    </div>
  </div>
);

const PermissionMhrd = ({
  translateHindi,
}: {
  translateHindi: (text: string) => string;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="w-4 text-right font-semibold">9</span>
    <span className="flex-1 font-semibold">
      Permission sought from MHRD. /{" "}
      {translateHindi("एमएचआरडी से अनुमति प्राप्त की गई है।")}
    </span>
    <span>:</span>
    <span>
      Yes/No (If yes mail attached): /{" "}
      {translateHindi("हाँ/नहीं (यदि हाँ तो मेल संलग्न)")}
    </span>
    <UnderlineInput id="permissionMhrd" width="w-28" />
  </div>
);
