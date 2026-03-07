export type AutofillProfile = {
  userId: string;
  name: string;
  designation: string;
  department: string;
  employeeCode: string;
  email: string;
  phone: string;
  roleKey: string;
  roleSlug: string;
  todayDisplay: string;
};

const PROFILE_CACHE_KEY = "lf-autofill-profile-v1";
const FORM_DRAFT_PREFIX = "lf-form-draft-v1:";

const isNonEmpty = (value?: string | null) => Boolean(value && value.trim());

const applyValue = (
  form: HTMLFormElement,
  field: string,
  value: string,
  overwrite = false,
) => {
  if (!isNonEmpty(value)) return;

  const element = form.querySelector<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(`[name="${field}"]`);
  if (!element) return;

  if (!overwrite && isNonEmpty(element.value)) return;
  element.value = value;
};

const applyMany = (
  form: HTMLFormElement,
  values: Record<string, string>,
  overwrite = false,
) => {
  Object.entries(values).forEach(([field, value]) => {
    applyValue(form, field, value, overwrite);
  });
};

const buildCommonProfileMap = (profile: AutofillProfile) => ({
  name: profile.name,
  employeeName: profile.name,
  signName: profile.name,
  letterName: profile.name,
  post: profile.designation,
  designation: profile.designation,
  letterDesignation: profile.designation,
  department: profile.department,
  letterDepartment: profile.department,
  employeeCode: profile.employeeCode,
  contact: profile.phone,
  contactNo: profile.phone,
  phone: profile.phone,
  date: profile.todayDisplay,
  signedDate: profile.todayDisplay,
  letterDated: profile.todayDisplay,
  rejoinDate: profile.todayDisplay,
});

export const getFormDraft = (formKey: string) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${FORM_DRAFT_PREFIX}${formKey}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed;
  } catch {
    return null;
  }
};

export const saveFormDraft = (
  formKey: string,
  data: Record<string, string>,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${FORM_DRAFT_PREFIX}${formKey}`,
    JSON.stringify(data),
  );
};

// NEW FUNCTION: Clears the saved draft from local storage
export const clearFormDraft = (formKey: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${FORM_DRAFT_PREFIX}${formKey}`);
};

const getCachedProfile = () => {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AutofillProfile;
  } catch {
    return null;
  }
};

const setCachedProfile = (profile: AutofillProfile) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
};

export const getAutofillProfile = async () => {
  const cached = getCachedProfile();
  if (cached) return cached;

  const response = await fetch("/api/forms/autofill", {
    method: "GET",
    cache: "no-store",
  });
  const result = (await response.json()) as {
    ok?: boolean;
    message?: string;
    data?: AutofillProfile;
  };

  if (!response.ok || !result.ok || !result.data) {
    throw new Error(result.message ?? "Unable to load autofill profile.");
  }

  setCachedProfile(result.data);
  return result.data;
};

export const applyAutofillToForm = async (
  form: HTMLFormElement,
  formKey: string,
) => {
  const draft = getFormDraft(formKey);
  if (draft) {
    applyMany(form, draft, false);
  }

  const profile = await getAutofillProfile();
  applyMany(form, buildCommonProfileMap(profile), false);

  return profile;
};
