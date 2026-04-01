"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";

import {
  LeaveRequestDetailsModal,
  type LeaveRequestDetails,
} from "@/components/leaves/leave-request-details-modal";
import {
  EarnedLeaveApprovalModal,
  type EarnedLeaveApprovalData,
} from "@/components/leaves/earned-leave-approval-modal";
import {
  LtcEstablishmentApprovalActions,
  LtcAccountsApprovalActions,
} from "@/components/leaves/ltc-approval-modal";
import {
  HodSignatureApprovalModal,
  type HodSignatureApprovalModalData,
} from "@/components/leaves/hod-signature-approval-modal";
import {
  ApprovalSignatureOtpModal,
  type ApprovalSignatureOtpModalData,
} from "@/components/leaves/approval-signature-otp-modal";
import {
  BulkApprovalSignatureOtpModal,
  type BulkApprovalSignatureOtpModalData,
} from "@/components/leaves/bulk-approval-signature-otp-modal";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type ApprovalRecord = LeaveRequestDetails & {
  approvalStepId?: string;
  applicationId: string;
  currentApprovalActor?: string | null;
  status: string;
  applicationStatus: string;
  appliedAt: string;
  applicant: {
    id: string;
    name: string;
    role: string;
    roleKey?: string | null;
    department: string;
    designation: string;
  };
  remarks?: string | null;
  actedAt?: string | null;
  delegatedFromHodName?: string | null;
  actingHodRequest?: {
    candidateId: string;
    candidateName?: string;
    requestedById: string;
    requestedByName?: string;
    status: "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";
    requestedAt: string;
    respondedAt?: string;
    responseById?: string;
  } | null;
};

type HodActingHodStatus = {
  hod: {
    id: string;
    name: string;
    department: string | null;
  };
  isOnLeave: boolean;
  leaveWindow: { startDate: string; endDate: string } | null;
  activeAssignment: {
    id: string;
    actingHodId: string;
    actingHodName: string;
    startDate: string;
    endDate: string;
    assignedByName: string;
  } | null;
};

type ActingHodCandidate = {
  id: string;
  name: string;
  role: string;
  department?: string;
};

type DeanActingHodStatus = {
  hods: Array<{
    hod: {
      id: string;
      name: string;
      department: string | null;
    };
    leaveWindow: { startDate: string; endDate: string } | null;
    activeAssignment: {
      id: string;
      actingHodId: string;
      actingHodName: string;
      startDate: string;
      endDate: string;
      assignedByName: string;
    } | null;
    candidates: ActingHodCandidate[];
  }>;
};

type MyActingHodContext = {
  pendingRequests: Array<{
    applicationId: string;
    referenceCode: string;
    hodName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
  }>;
  activeAssignments: Array<{
    id: string;
    hodName: string;
    startDate: string;
    endDate: string;
    assignedByName: string;
  }>;
};

const matchesDateFilters = (
  value: string,
  fromDate: string,
  toDate: string,
) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (parsed < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (parsed > to) return false;
  }

  return true;
};

const statusTone = (value: string) => {
  if (value === "PENDING" || value === "IN_REVIEW") {
    return "bg-amber-50 text-amber-700 ring-amber-200";
  }
  if (value === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (value === "REJECTED") {
    return "bg-rose-50 text-rose-700 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const isJoiningReportRecord = (item: ApprovalRecord) =>
  (item.leaveTypeCode ?? "").toUpperCase() === "JR" ||
  item.leaveType.toLowerCase().includes("joining");

const isEarnedLeaveRecord = (item: ApprovalRecord) =>
  (item.leaveTypeCode ?? "").toUpperCase() === "EL" ||
  item.leaveType.toLowerCase().includes("earned");

const isLtcRecord = (item: ApprovalRecord) =>
  (item.leaveTypeCode ?? "").toUpperCase() === "LTC" ||
  item.leaveType.toLowerCase().includes("ltc");

export const StationLeaveApprovals = ({ role }: { role: string }) => {
  const [items, setItems] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingError, setActingError] = useState<string | null>(null);
  const [deanInfo, setDeanInfo] = useState<DeanActingHodStatus | null>(null);
  const [hodStatus, setHodStatus] = useState<HodActingHodStatus | null>(null);
  const [actingChoiceByApplication, setActingChoiceByApplication] = useState<
    Record<string, string>
  >({});
  const [myActingContext, setMyActingContext] =
    useState<MyActingHodContext | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ApprovalRecord | null>(null);
  const [selectedHodApproval, setSelectedHodApproval] =
    useState<HodSignatureApprovalModalData | null>(null);
  const [selectedApproverOtpApproval, setSelectedApproverOtpApproval] =
    useState<ApprovalSignatureOtpModalData | null>(null);
  const [selectedBulkOtpApproval, setSelectedBulkOtpApproval] =
    useState<BulkApprovalSignatureOtpModalData | null>(null);
  const [selectedEarnedLeave, setSelectedEarnedLeave] =
    useState<EarnedLeaveApprovalData | null>(null);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showPending, setShowPending] = useState(true);
  const [showHandled, setShowHandled] = useState(true);
  const [approvalMode, setApprovalMode] = useState<"individual" | "bulk">(
    "individual",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const roleKey = role.toLowerCase().replace(/_/g, "-");
  const canBulkAct = ["hod", "accounts", "dean"].includes(roleKey);
  const isBulkAccounts = roleKey === "accounts";
  const signatureLabel = isBulkAccounts
    ? "Accounts signature"
    : roleKey === "dean"
      ? "Dean signature"
      : "HoD signature";
  const signatureDefault = isBulkAccounts
    ? "ACCOUNTS"
    : roleKey === "dean"
      ? "DEAN"
      : "HOD";
  const [bulkRemarks, setBulkRemarks] = useState("NA");
  const [bulkBalance, setBulkBalance] = useState("");
  const [bulkRecommended, setBulkRecommended] = useState<
    "AUTO" | "RECOMMENDED" | "NOT_RECOMMENDED"
  >("AUTO");
  const [bulkDecisionDate, setBulkDecisionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const loadItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/leaves/approvals", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: ApprovalRecord[];
      };

      if (!response.ok || !result.ok) {
        if (response.status === 403) {
          setItems([]);
          setError(null);
          return;
        }

        throw new Error(result.message ?? "Unable to load approvals.");
      }

      setItems(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load approvals.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDeanInfo = async () => {
    setActingError(null);
    try {
      const response = await fetch("/api/leaves/acting-hod/dean", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: DeanActingHodStatus;
      };

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message ?? "Unable to load acting HoD status.");
      }

      setDeanInfo(result.data);
    } catch (err) {
      setActingError(
        err instanceof Error
          ? err.message
          : "Unable to load acting HoD status.",
      );
    }
  };

  const loadMyActingContext = async () => {
    try {
      const response = await fetch("/api/leaves/acting-hod/me", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: MyActingHodContext;
      };

      if (!response.ok || !result.ok || !result.data) {
        return;
      }

      setMyActingContext(result.data);
    } catch {
      // optional panel; ignore failures
    }
  };

  const loadHodStatus = async () => {
    try {
      const response = await fetch("/api/leaves/acting-hod", {
        method: "GET",
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: HodActingHodStatus;
      };

      if (!response.ok || !result.ok || !result.data) {
        return;
      }

      setHodStatus(result.data);
    } catch {
      // optional panel; ignore failures
    }
  };

  const requestLeaveSpecificActingHod = async (applicationId: string) => {
    const actingHodId = actingChoiceByApplication[applicationId] ?? "";
    if (!actingHodId) {
      setError("Please select an acting HoD candidate first.");
      return;
    }

    setBusyId(`acting-request-${applicationId}`);
    setError(null);

    try {
      const response = await fetch("/api/leaves/acting-hod/leave-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, actingHodId }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to request acting HoD confirmation.",
        );
      }

      await Promise.all([loadItems(), loadDeanInfo()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to request acting HoD confirmation.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const respondToActingRequest = async (
    applicationId: string,
    decision: "ACCEPT" | "REJECT",
  ) => {
    setBusyId(`acting-respond-${applicationId}-${decision}`);
    setError(null);

    try {
      const response = await fetch("/api/leaves/acting-hod/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, decision }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ?? "Unable to respond to acting HoD request.",
        );
      }

      await Promise.all([loadItems(), loadMyActingContext()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to respond to acting HoD request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  useEffect(() => {
    if (roleKey === "dean") {
      void loadDeanInfo();
    }
    if (roleKey === "hod") {
      void loadHodStatus();
    }
    if (roleKey === "faculty" || roleKey === "associate-hod") {
      void loadMyActingContext();
    }

    setApprovalMode("individual");
    setSelectedIds([]);
  }, [roleKey]);

  const availableRoles = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.applicant.role))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  const availableLeaveTypes = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.leaveType))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (roleFilter !== "ALL" && item.applicant.role !== roleFilter) {
          return false;
        }

        if (typeFilter !== "ALL" && item.leaveType !== typeFilter) {
          return false;
        }

        return matchesDateFilters(item.appliedAt, fromDate, toDate);
      }),
    [fromDate, items, roleFilter, toDate, typeFilter],
  );

  const pendingItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status === "PENDING" || item.status === "IN_REVIEW",
      ),
    [filteredItems],
  );

  const bulkSelectableItems = useMemo(
    () => pendingItems.filter((item) => item.decisionRequired),
    [pendingItems],
  );

  const bulkEligibleItems = useMemo(
    () =>
      bulkSelectableItems.filter(
        (item) => !isLtcRecord(item) && !isEarnedLeaveRecord(item),
      ),
    [bulkSelectableItems],
  );

  const bulkEligibleIdSet = useMemo(
    () => new Set(bulkEligibleItems.map((item) => item.applicationId)),
    [bulkEligibleItems],
  );

  const handledItems = useMemo(
    () =>
      filteredItems.filter(
        (item) => item.status !== "PENDING" && item.status !== "IN_REVIEW",
      ),
    [filteredItems],
  );

  const deanFinalHodItems = useMemo(
    () =>
      pendingItems.filter((item) => {
        const applicantRoleKey = (item.applicant.roleKey ?? "").toUpperCase();
        const fallbackRoleName = item.applicant.role.toLowerCase();

        return (
          roleKey === "dean" &&
          item.currentApprovalActor === "DEAN" &&
          (applicantRoleKey === "HOD" || fallbackRoleName.includes("hod"))
        );
      }),
    [pendingItems, roleKey],
  );

  const deanItemsNeedingActing = useMemo(
    () =>
      deanFinalHodItems.filter(
        (item) => item.actingHodRequest?.status !== "CONFIRMED",
      ),
    [deanFinalHodItems],
  );

  useEffect(() => {
    if (!deanInfo || deanItemsNeedingActing.length === 0) return;

    setActingChoiceByApplication((prev) => {
      const next = { ...prev };

      deanItemsNeedingActing.forEach((item) => {
        if (next[item.applicationId]) return;

        const deanHod = deanInfo.hods.find(
          (entry) => entry.hod.id === item.applicant.id,
        );

        const proposed =
          typeof item.formData?.proposedActingHodId === "string"
            ? item.formData.proposedActingHodId.trim()
            : "";

        if (
          proposed &&
          deanHod?.candidates.some((candidate) => candidate.id === proposed)
        ) {
          next[item.applicationId] = proposed;
          return;
        }

        next[item.applicationId] = deanHod?.candidates[0]?.id ?? "";
      });

      return next;
    });
  }, [deanInfo, deanItemsNeedingActing]);

  const runDecision = async (
    applicationId: string,
    decision: "APPROVE" | "REJECT",
  ) => {
    setBusyId(applicationId);
    setError(null);

    try {
      const response = await fetch(`/api/leaves/approvals/${applicationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          remarks: remarksById[applicationId] || undefined,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to update request.");
      }

      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update request.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const selectedFooter: ReactNode = (() => {
    if (!selected) return null;
    if (!selected.decisionRequired) return null;
    if (!isLtcRecord(selected)) return null;

    const defaultRemarks = remarksById[selected.applicationId] || "NA";
    const disabled = busyId === selected.applicationId;

    if (
      roleKey === "establishment" &&
      selected.currentApprovalActor === "ESTABLISHMENT"
    ) {
      return (
        <LtcEstablishmentApprovalActions
          applicationId={selected.applicationId}
          formData={selected.formData ?? null}
          defaultRemarks={defaultRemarks}
          disabled={disabled}
          onApprove={async ({ remarks, formDataPatch }) => {
            setBusyId(selected.applicationId);
            setError(null);
            try {
              const response = await fetch(
                `/api/leaves/approvals/${selected.applicationId}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    decision: "APPROVE",
                    remarks,
                    formDataPatch,
                  }),
                },
              );

              const result = (await response.json()) as {
                ok?: boolean;
                message?: string;
              };
              if (!response.ok || !result.ok) {
                throw new Error(result.message ?? "Unable to approve request.");
              }

              setSelected(null);
              await loadItems();
            } finally {
              setBusyId(null);
            }
          }}
        />
      );
    }

    if (
      roleKey === "accounts" &&
      selected.currentApprovalActor === "ACCOUNTS"
    ) {
      return (
        <LtcAccountsApprovalActions
          applicationId={selected.applicationId}
          formData={selected.formData ?? null}
          defaultRemarks={defaultRemarks}
          disabled={disabled}
          onApprove={async ({ remarks, formDataPatch }) => {
            setBusyId(selected.applicationId);
            setError(null);
            try {
              const response = await fetch(
                `/api/leaves/approvals/${selected.applicationId}`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    decision: "APPROVE",
                    remarks,
                    formDataPatch,
                  }),
                },
              );

              const result = (await response.json()) as {
                ok?: boolean;
                message?: string;
              };
              if (!response.ok || !result.ok) {
                throw new Error(result.message ?? "Unable to submit request.");
              }

              setSelected(null);
              await loadItems();
            } finally {
              setBusyId(null);
            }
          }}
        />
      );
    }

    return null;
  })();

  const toggleSelectedId = (applicationId: string) => {
    setSelectedIds((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId],
    );
  };

  const selectAllVisible = () => {
    const allIds = bulkEligibleItems.map((item) => item.applicationId);
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const runBulkDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!selectedIds.length) return;
    if (isBulkAccounts && decision === "REJECT") {
      setError("Accounts section can only process bulk approvals.");
      return;
    }
    if (isBulkAccounts && !bulkBalance.trim()) {
      setError("Please enter balance as on date for bulk accounts approval.");
      return;
    }

    setBusyId("__bulk__");
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        applicationIds: selectedIds,
        decision,
        remarks: bulkRemarks.trim() || "NA",
      };

      if (isBulkAccounts) {
        payload.accountsSignature = "ACCOUNTS";
        payload.balance = bulkBalance.trim();
      } else {
        payload.recommended =
          bulkRecommended === "AUTO"
            ? decision === "APPROVE"
              ? "RECOMMENDED"
              : "NOT_RECOMMENDED"
            : bulkRecommended;
        payload.hodSignature = signatureDefault;
        payload.decisionDate = bulkDecisionDate || undefined;
      }

      const response = await fetch("/api/leaves/approvals/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "Unable to process bulk approval.");
      }

      setSelectedIds([]);
      await loadItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to process bulk approval.",
      );
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    setSelectedIds((prev) => {
      const allowed = new Set(
        bulkEligibleItems.map((item) => item.applicationId),
      );
      return prev.filter((id) => allowed.has(id));
    });
  }, [bulkEligibleItems]);

  useEffect(() => {
    if (approvalMode !== "bulk") setSelectedIds([]);
  }, [approvalMode]);

  const openBulkApproveSignature = () => {
    if (!selectedIds.length) return;
    if (isBulkAccounts && !bulkBalance.trim()) {
      setError("Please enter balance as on date for bulk accounts approval.");
      return;
    }

    const selectedItems = bulkEligibleItems
      .filter((item) => selectedIds.includes(item.applicationId))
      .map((item) => ({
        applicationId: item.applicationId,
        referenceCode: item.referenceCode,
        applicantName: item.applicant.name,
        applicantDepartment: item.applicant.department,
        leaveType: item.leaveType,
      }));

    if (selectedItems.length === 0) {
      setError("No eligible applications selected for bulk approval.");
      return;
    }

    setSelectedBulkOtpApproval({
      title: `Bulk approve (${role.toUpperCase()})`,
      items: selectedItems,
      onApproveAll: async ({ approverSignatureProof }) => {
        setBusyId("__bulk__");
        setError(null);
        try {
          const payload: Record<string, unknown> = {
            applicationIds: selectedItems.map((item) => item.applicationId),
            decision: "APPROVE",
            remarks: bulkRemarks.trim() || "NA",
            approverSignatureProof,
          };

          if (isBulkAccounts) {
            payload.accountsSignature = "ACCOUNTS";
            payload.balance = bulkBalance.trim();
          } else {
            payload.recommended =
              bulkRecommended === "AUTO" ? "RECOMMENDED" : bulkRecommended;
            payload.hodSignature = signatureDefault;
            payload.decisionDate = bulkDecisionDate || undefined;
          }

          const response = await fetch("/api/leaves/approvals/bulk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const result = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };

          if (!response.ok || !result.ok) {
            throw new Error(
              result.message ?? "Unable to process bulk approval.",
            );
          }

          setSelectedBulkOtpApproval(null);
          setSelectedIds([]);
          await loadItems();
        } finally {
          setBusyId(null);
        }
      },
      onClose: () => setSelectedBulkOtpApproval(null),
    });
  };

  const openEarnedLeaveApproval = (item: ApprovalRecord) => {
    const handled = item.status !== "PENDING" && item.status !== "IN_REVIEW";
    const approvalData: EarnedLeaveApprovalData = {
      applicationId: item.applicationId,
      referenceCode: item.referenceCode,
      leaveType: item.leaveType,
      applicantName: item.applicant.name,
      applicantRole: item.applicant.role,
      applicantDepartment: item.applicant.department,
      applicantDesignation: item.applicant.designation,
      currentApprovalActor: item.currentApprovalActor ?? null,
      formData: item.formData ?? null,
      purpose: item.purpose,
      startDate: item.startDate,
      endDate: item.endDate,
      totalDays: item.totalDays,
      decisionRequired: !handled,
      viewerOnly: handled,
      onApprove: async (data) => {
        setBusyId(item.applicationId);
        setError(null);
        try {
          const response = await fetch(
            `/api/leaves/approvals/${item.applicationId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                decision: "APPROVE",
                remarks: data.remarks,
                recommended: data.recommended,
                hodSignature: data.hodSignature,
                accountsSignature: data.accountsSignature,
                balance: data.balance,
                decisionDate: data.decisionDate,
                approverSignatureProof: data.approverSignatureProof,
              }),
            },
          );

          const result = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };
          if (!response.ok || !result.ok) {
            throw new Error(result.message ?? "Unable to approve request.");
          }

          setSelectedEarnedLeave(null);
          await loadItems();
        } finally {
          setBusyId(null);
        }
      },
      onReject: async ({ remarks, hodSignature, approverSignatureProof }) => {
        setBusyId(item.applicationId);
        setError(null);
        try {
          const response = await fetch(
            `/api/leaves/approvals/${item.applicationId}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                decision: "REJECT",
                remarks,
                hodSignature,
                approverSignatureProof,
              }),
            },
          );

          const result = (await response.json()) as {
            ok?: boolean;
            message?: string;
          };
          if (!response.ok || !result.ok) {
            throw new Error(result.message ?? "Unable to reject request.");
          }

          setSelectedEarnedLeave(null);
          await loadItems();
        } finally {
          setBusyId(null);
        }
      },
      onClose: () => {
        setSelectedEarnedLeave(null);
      },
    };
    setSelectedEarnedLeave(approvalData);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard className="space-y-2 border-slate-200/80 p-5">
        <p className="text-xl font-semibold text-slate-900">Leave Approvals</p>
        <p className="text-sm text-slate-600">
          Role: {role.toUpperCase()} | Review submitted leave records, view full
          details, and approve only where an action is required.
        </p>
      </SurfaceCard>

      {roleKey === "hod" &&
      hodStatus?.isOnLeave &&
      hodStatus.leaveWindow &&
      hodStatus.activeAssignment ? (
        <SurfaceCard className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You are on leave from {hodStatus.leaveWindow.startDate.slice(0, 10)}{" "}
          to {hodStatus.leaveWindow.endDate.slice(0, 10)}. Applications assigned
          to HoD are currently approved by{" "}
          {hodStatus.activeAssignment.actingHodName} during this period. You can
          view them, but approval actions are disabled until delegation ends.
        </SurfaceCard>
      ) : null}

      {null}

      {(roleKey === "faculty" || roleKey === "associate-hod") &&
      myActingContext ? (
        <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
          <p className="text-base font-semibold text-slate-900">
            Acting HoD requests and assignments
          </p>

          {myActingContext.pendingRequests.length > 0 ? (
            <div className="space-y-2">
              {myActingContext.pendingRequests.map((request) => (
                <div
                  key={request.applicationId}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {request.referenceCode} - {request.hodName}
                  </p>
                  <p className="text-xs text-slate-600">
                    {request.leaveType} | {request.startDate.slice(0, 10)} to{" "}
                    {request.endDate.slice(0, 10)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      onClick={() =>
                        respondToActingRequest(request.applicationId, "ACCEPT")
                      }
                      disabled={
                        busyId ===
                        `acting-respond-${request.applicationId}-ACCEPT`
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        respondToActingRequest(request.applicationId, "REJECT")
                      }
                      disabled={
                        busyId ===
                        `acting-respond-${request.applicationId}-REJECT`
                      }
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No pending acting HoD confirmation requests.
            </p>
          )}

          {myActingContext.activeAssignments.length > 0 ? (
            <div className="space-y-2">
              {myActingContext.activeAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                >
                  You are acting HoD in place of {assignment.hodName} for the
                  period {assignment.startDate.slice(0, 10)} to{" "}
                  {assignment.endDate.slice(0, 10)}.
                </div>
              ))}
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      {roleKey === "dean" ? (
        <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
          <p className="text-base font-semibold text-slate-900">
            Final approval acting HoD confirmation (HoD leave)
          </p>
          <p className="text-sm text-slate-600">
            Dean must request and receive acting HoD acceptance before final
            approving HoD leave.
          </p>

          {deanItemsNeedingActing.length === 0 ? (
            <p className="text-sm text-slate-600">
              No HoD leave is pending acting HoD confirmation at final stage.
            </p>
          ) : (
            <div className="space-y-3">
              {deanItemsNeedingActing.map((item) => {
                const candidates =
                  deanInfo?.hods.find(
                    (entry) => entry.hod.id === item.applicant.id,
                  )?.candidates ?? [];
                const selectedCandidate =
                  actingChoiceByApplication[item.applicationId] ?? "";

                return (
                  <div
                    key={item.applicationId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.referenceCode} - {item.applicant.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {item.startDate.slice(0, 10)} to{" "}
                      {item.endDate.slice(0, 10)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Request status:{" "}
                      {item.actingHodRequest?.status ?? "NOT_REQUESTED"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={selectedCandidate}
                        onChange={(event) =>
                          setActingChoiceByApplication((prev) => ({
                            ...prev,
                            [item.applicationId]: event.target.value,
                          }))
                        }
                        className="min-w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select acting HoD</option>
                        {candidates.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name} ({candidate.role})
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={() =>
                          requestLeaveSpecificActingHod(item.applicationId)
                        }
                        disabled={
                          busyId === `acting-request-${item.applicationId}` ||
                          !selectedCandidate
                        }
                      >
                        {busyId === `acting-request-${item.applicationId}`
                          ? "Sending..."
                          : "Request confirmation"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {deanFinalHodItems.some(
            (item) => item.actingHodRequest?.status === "CONFIRMED",
          ) ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">
                Recent leave-wise confirmed acting HoD
              </p>
              {deanFinalHodItems
                .filter((item) => item.actingHodRequest?.status === "CONFIRMED")
                .map((item) => (
                  <div
                    key={`confirmed-${item.applicationId}`}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                  >
                    {item.referenceCode}:{" "}
                    {item.actingHodRequest?.candidateName ?? "Acting HoD"}{" "}
                    confirmed for {item.applicant.name} (
                    {item.startDate.slice(0, 10)} to {item.endDate.slice(0, 10)}
                    ).
                  </div>
                ))}
            </div>
          ) : null}
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="space-y-4 border-slate-200/80 p-5">
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showPending}
              onChange={(event) => setShowPending(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Pending / awaiting view
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showHandled}
              onChange={(event) => setShowHandled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Recently handled
          </label>
          {canBulkAct ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Approval mode
              </span>
              <Button
                variant="secondary"
                onClick={() =>
                  setApprovalMode((prev) =>
                    prev === "bulk" ? "individual" : "bulk",
                  )
                }
                disabled={
                  busyId === "__bulk__" || bulkEligibleItems.length === 0
                }
                className="gap-2"
              >
                {approvalMode === "bulk" ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                {approvalMode === "bulk" ? "Bulk approve" : "Individual"}
              </Button>
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Filter by role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">All roles</option>
              {availableRoles.map((itemRole) => (
                <option key={itemRole} value={itemRole}>
                  {itemRole}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">
              Filter by leave type
            </span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="ALL">All leave types</option>
              {availableLeaveTypes.map((leaveType) => (
                <option key={leaveType} value={leaveType}>
                  {leaveType}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-slate-200/80 p-4 text-sm text-slate-600">
            Showing {filteredItems.length} request
            {filteredItems.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Applied from</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Applied to</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            />
          </label>
        </div>
      </SurfaceCard>

      {actingError ? (
        <SurfaceCard className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {actingError}
        </SurfaceCard>
      ) : null}

      {error ? (
        <SurfaceCard className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </SurfaceCard>
      ) : null}

      {showPending ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pending approvals
            </p>
            {canBulkAct ? (
              <Button
                variant="secondary"
                onClick={() =>
                  setApprovalMode((prev) =>
                    prev === "bulk" ? "individual" : "bulk",
                  )
                }
                disabled={
                  busyId === "__bulk__" || bulkEligibleItems.length === 0
                }
                className="gap-2"
              >
                {approvalMode === "bulk" ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                {approvalMode === "bulk" ? "Bulk approve" : "Individual"}
              </Button>
            ) : null}
          </div>
          {loading ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              Loading requests...
            </SurfaceCard>
          ) : pendingItems.length === 0 ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              No pending leave records mapped to you.
            </SurfaceCard>
          ) : (
            <>
              {canBulkAct &&
              approvalMode === "bulk" &&
              bulkEligibleItems.length > 0 ? (
                <SurfaceCard className="space-y-3 border-slate-200/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      Bulk action ({role.toUpperCase()})
                    </p>
                    <p className="text-xs text-slate-600">
                      Selected {selectedIds.length} of{" "}
                      {bulkEligibleItems.length}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">
                        Bulk remarks
                      </span>
                      <textarea
                        value={bulkRemarks}
                        onChange={(event) => setBulkRemarks(event.target.value)}
                        className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                        placeholder="NA"
                        disabled={busyId === "__bulk__"}
                      />
                    </label>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">
                          {signatureLabel}:
                        </span>{" "}
                        {signatureDefault} (auto-applied)
                      </div>
                      {isBulkAccounts ? (
                        <label className="space-y-1 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">
                            Balance as on date
                          </span>
                          <input
                            value={bulkBalance}
                            onChange={(event) =>
                              setBulkBalance(event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                            placeholder="Enter balance"
                            disabled={busyId === "__bulk__"}
                          />
                        </label>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="space-y-1 text-xs text-slate-600">
                            <span className="font-medium text-slate-800">
                              Recommended
                            </span>
                            <select
                              value={bulkRecommended}
                              onChange={(event) =>
                                setBulkRecommended(
                                  event.target.value as
                                    | "AUTO"
                                    | "RECOMMENDED"
                                    | "NOT_RECOMMENDED",
                                )
                              }
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                              disabled={busyId === "__bulk__"}
                            >
                              <option value="AUTO">Auto by decision</option>
                              <option value="RECOMMENDED">Recommended</option>
                              <option value="NOT_RECOMMENDED">
                                Not recommended
                              </option>
                            </select>
                          </label>
                          <label className="space-y-1 text-xs text-slate-600">
                            <span className="font-medium text-slate-800">
                              Decision date
                            </span>
                            <input
                              type="date"
                              value={bulkDecisionDate}
                              onChange={(event) =>
                                setBulkDecisionDate(event.target.value)
                              }
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                              disabled={busyId === "__bulk__"}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={selectAllVisible}
                      disabled={busyId === "__bulk__"}
                    >
                      Select all
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={clearSelection}
                      disabled={
                        busyId === "__bulk__" || selectedIds.length === 0
                      }
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={openBulkApproveSignature}
                      disabled={
                        busyId === "__bulk__" ||
                        selectedIds.length === 0 ||
                        (isBulkAccounts && !bulkBalance.trim())
                      }
                    >
                      {busyId === "__bulk__" ? "Processing..." : "Bulk approve"}
                    </Button>
                    {!isBulkAccounts ? (
                      <Button
                        variant="secondary"
                        onClick={() => runBulkDecision("REJECT")}
                        disabled={
                          busyId === "__bulk__" || selectedIds.length === 0
                        }
                      >
                        Bulk reject
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    {isBulkAccounts
                      ? "These values will be applied to all selected requests. Balance is mandatory for accounts approval."
                      : "These values will be applied to all selected requests."}
                  </p>
                </SurfaceCard>
              ) : null}

              {pendingItems.map((item) => (
                <SurfaceCard
                  key={
                    item.approvalStepId ??
                    `${item.applicationId}-${item.currentApprovalActor ?? "step"}`
                  }
                  className="space-y-3 border-slate-200/80 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {canBulkAct &&
                      approvalMode === "bulk" &&
                      bulkEligibleIdSet.has(item.applicationId) ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.applicationId)}
                          onChange={() => toggleSelectedId(item.applicationId)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                      ) : null}
                      <div>
                        <p className="text-base font-semibold text-slate-900">
                          {item.referenceCode}
                        </p>
                        <p className="text-xs text-slate-500">
                          Applied by {item.applicant.name} (
                          {item.applicant.role}) - {item.applicant.department}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">Leave window:</span>{" "}
                      {new Date(item.startDate).toLocaleDateString("en-GB")} to{" "}
                      {new Date(item.endDate).toLocaleDateString("en-GB")} (
                      {item.totalDays} days)
                    </p>
                    <p>
                      <span className="font-semibold">Leave type:</span>{" "}
                      {item.leaveType}
                    </p>
                    <p>
                      <span className="font-semibold">Processing mode:</span>{" "}
                      {item.decisionRequired
                        ? "Approval required"
                        : "View only"}
                    </p>
                    <p>
                      <span className="font-semibold">Purpose:</span>{" "}
                      {item.purpose}
                    </p>
                    <p>
                      <span className="font-semibold">Contact:</span>{" "}
                      {item.contactDuringLeave || "Not provided"}
                    </p>
                    {(roleKey === "faculty" || roleKey === "associate-hod") &&
                    item.currentApprovalActor === "HOD" &&
                    item.delegatedFromHodName ? (
                      <p>
                        <span className="font-semibold">
                          Originally assigned to:
                        </span>{" "}
                        {item.delegatedFromHodName}
                      </p>
                    ) : null}
                  </div>

                  {item.decisionRequired ? (
                    <textarea
                      value={remarksById[item.applicationId] ?? ""}
                      onChange={(event) =>
                        setRemarksById((prev) => ({
                          ...prev,
                          [item.applicationId]: event.target.value,
                        }))
                      }
                      placeholder="Remarks (optional)"
                      className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      This record has been routed to you for viewing only. No
                      approval action is required.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (
                          isEarnedLeaveRecord(item) &&
                          item.decisionRequired
                        ) {
                          openEarnedLeaveApproval(item);
                        } else {
                          setSelected(item);
                        }
                      }}
                      disabled={busyId === item.applicationId}
                    >
                      Open
                    </Button>
                    {item.decisionRequired ? (
                      <>
                        {isEarnedLeaveRecord(item) ? (
                          <Button
                            onClick={() => openEarnedLeaveApproval(item)}
                            disabled={busyId === item.applicationId}
                          >
                            {busyId === item.applicationId
                              ? "Opening..."
                              : "Approve"}
                          </Button>
                        ) : null}
                        {!isJoiningReportRecord(item) &&
                        !isEarnedLeaveRecord(item) &&
                        item.currentApprovalActor !== "ACCOUNTS" ? (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              runDecision(item.applicationId, "REJECT")
                            }
                            disabled={busyId === item.applicationId}
                          >
                            Reject
                          </Button>
                        ) : null}
                        {!isEarnedLeaveRecord(item) ? (
                          <Button
                            onClick={() => {
                              if (
                                item.decisionRequired &&
                                item.currentApprovalActor === "HOD"
                              ) {
                                setSelectedHodApproval({
                                  applicationId: item.applicationId,
                                  referenceCode: item.referenceCode,
                                  applicantName: item.applicant.name,
                                  applicantDepartment:
                                    item.applicant.department,
                                  leaveType: item.leaveType,
                                  defaultRemarks:
                                    remarksById[item.applicationId] || "NA",
                                  onApprove: async ({
                                    remarks,
                                    hodSignature,
                                    approverSignatureProof,
                                  }) => {
                                    setBusyId(item.applicationId);
                                    setError(null);
                                    try {
                                      const response = await fetch(
                                        `/api/leaves/approvals/${item.applicationId}`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            decision: "APPROVE",
                                            remarks,
                                            hodSignature,
                                            approverSignatureProof,
                                          }),
                                        },
                                      );

                                      const result =
                                        (await response.json()) as {
                                          ok?: boolean;
                                          message?: string;
                                        };
                                      if (!response.ok || !result.ok) {
                                        throw new Error(
                                          result.message ??
                                            "Unable to approve request.",
                                        );
                                      }

                                      setSelectedHodApproval(null);
                                      await loadItems();
                                    } finally {
                                      setBusyId(null);
                                    }
                                  },
                                  onClose: () => setSelectedHodApproval(null),
                                });
                                return;
                              }

                              if (
                                isLtcRecord(item) &&
                                roleKey === "establishment" &&
                                item.currentApprovalActor === "ESTABLISHMENT"
                              ) {
                                setSelected(item);
                                return;
                              }

                              if (
                                isLtcRecord(item) &&
                                roleKey === "accounts" &&
                                item.currentApprovalActor === "ACCOUNTS"
                              ) {
                                setSelected(item);
                                return;
                              }

                              if (item.decisionRequired) {
                                setSelectedApproverOtpApproval({
                                  applicationId: item.applicationId,
                                  referenceCode: item.referenceCode,
                                  applicantName: item.applicant.name,
                                  applicantDepartment:
                                    item.applicant.department,
                                  leaveType: item.leaveType,
                                  defaultRemarks:
                                    remarksById[item.applicationId] || "NA",
                                  onApprove: async ({
                                    remarks,
                                    approverSignatureProof,
                                  }) => {
                                    setBusyId(item.applicationId);
                                    setError(null);
                                    try {
                                      const response = await fetch(
                                        `/api/leaves/approvals/${item.applicationId}`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            decision: "APPROVE",
                                            remarks,
                                            approverSignatureProof,
                                          }),
                                        },
                                      );

                                      const result =
                                        (await response.json()) as {
                                          ok?: boolean;
                                          message?: string;
                                        };
                                      if (!response.ok || !result.ok) {
                                        throw new Error(
                                          result.message ??
                                            "Unable to approve request.",
                                        );
                                      }

                                      setSelectedApproverOtpApproval(null);
                                      await loadItems();
                                    } finally {
                                      setBusyId(null);
                                    }
                                  },
                                  onClose: () =>
                                    setSelectedApproverOtpApproval(null),
                                });
                                return;
                              }

                              void runDecision(item.applicationId, "APPROVE");
                            }}
                            disabled={busyId === item.applicationId}
                          >
                            {busyId === item.applicationId
                              ? "Saving..."
                              : isLtcRecord(item) &&
                                  item.decisionRequired &&
                                  ((roleKey === "establishment" &&
                                    item.currentApprovalActor ===
                                      "ESTABLISHMENT") ||
                                    (roleKey === "accounts" &&
                                      item.currentApprovalActor === "ACCOUNTS"))
                                ? "Enter"
                                : "Approve"}
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </SurfaceCard>
              ))}
            </>
          )}
        </section>
      ) : null}

      <ApprovalSignatureOtpModal
        isOpen={Boolean(selectedApproverOtpApproval)}
        data={selectedApproverOtpApproval}
        disabled={
          busyId === selectedApproverOtpApproval?.applicationId ||
          busyId === "__bulk__"
        }
      />

      <BulkApprovalSignatureOtpModal
        isOpen={Boolean(selectedBulkOtpApproval)}
        data={selectedBulkOtpApproval}
        disabled={busyId === "__bulk__"}
      />

      {showHandled ? (
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recently handled
          </p>
          {loading ? null : handledItems.length === 0 ? (
            <SurfaceCard className="p-4 text-sm text-slate-600">
              No handled requests yet.
            </SurfaceCard>
          ) : (
            handledItems.slice(0, 8).map((item) => (
              <SurfaceCard
                key={
                  item.approvalStepId ?? `${item.applicationId}-${item.status}`
                }
                className="border-slate-200/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.referenceCode}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelected(item);
                      }}
                    >
                      View
                    </Button>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusTone(item.status)}`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  {item.applicant.name} | {item.leaveType} | {item.purpose} |{" "}
                  {item.actedAt ? new Date(item.actedAt).toLocaleString() : "-"}
                </p>
              </SurfaceCard>
            ))
          )}
        </section>
      ) : null}

      <LeaveRequestDetailsModal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        request={selected}
        footer={selectedFooter}
      />

      <HodSignatureApprovalModal
        isOpen={selectedHodApproval !== null}
        data={selectedHodApproval}
        disabled={
          busyId === selectedHodApproval?.applicationId || busyId === "__bulk__"
        }
      />

      <EarnedLeaveApprovalModal
        isOpen={selectedEarnedLeave !== null}
        data={selectedEarnedLeave}
      />
    </div>
  );
};
