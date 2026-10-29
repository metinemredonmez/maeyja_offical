"use client";

import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api.client";

export function NewsletterForm({
  compact = false,
  source = "footer",
  buttonLabel,
  onDone,
}: {
  compact?: boolean;
  source?: string;
  buttonLabel?: string;
  onDone?: () => void;
}) {
  const t = useTranslations("newsletter");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      await api.post("/newsletter/subscribe", { email, locale, source });
      setState("done");
      onDone?.();
    } catch {
      // API messages are Turkish; show the visitor's own language instead.
      setState("error");
    }
  };

  // Thank the visitor, then bring the empty form back instead of leaving the message until a reload.
  useEffect(() => {
    if (state !== "done") return;
    const timer = setTimeout(() => {
      setEmail("");
      setState("idle");
    }, 5000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "done")
    return (
      <p className="text-sm text-muted" role="status">
        {t("done")}
      </p>
    );
  return (
    <div className={compact ? "max-w-xs" : ""}>
      <form onSubmit={submit} className="flex">
        <label htmlFor={`nl-${source}`} className="sr-only">
          {t("placeholder")}
        </label>
        <input
          id={`nl-${source}`}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder={t("placeholder")}
          className="field border-r-0"
          aria-invalid={state === "error"}
          aria-describedby={
            state === "error" ? `nl-${source}-error` : undefined
          }
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="btn-primary shrink-0 px-5"
        >
          {buttonLabel ?? t("button")}
        </button>
      </form>
      {state === "error" ? (
        <p
          id={`nl-${source}-error`}
          role="alert"
          className="mt-2 text-xs text-brand"
        >
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
