"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type DeleteFormTemplateButtonProps = {
  formId: string;
  formName: string;
};

export const DeleteFormTemplateButton = ({
  formId,
  formName,
}: DeleteFormTemplateButtonProps) => {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Delete form \"${formName}\"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/form-templates?id=${encodeURIComponent(formId)}`,
        {
          method: "DELETE",
        },
      );

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok) {
        setErrorMessage(data.message ?? "Unable to delete form.");
        return;
      }

      router.refresh();
    } catch (error) {
      console.error("Delete form failed", error);
      setErrorMessage("Unable to delete form.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        variant="secondary"
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-rose-700 ring-rose-200 hover:text-rose-800"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
      {errorMessage ? (
        <p className="text-xs text-rose-600">{errorMessage}</p>
      ) : null}
    </div>
  );
};
