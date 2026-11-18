"use client";

import { InfoIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OptionField, ToolValues } from "@/lib/pdf/tool-options";
import { cn } from "@/lib/utils";

export type FieldError = {
  field?: string;
  message: string;
};

export function ToolOptionsPanel({
  fields,
  values,
  onChange,
  fieldError,
  disabled,
}: {
  fields: readonly OptionField[];
  values: ToolValues;
  onChange: (name: string, value: string | number | boolean) => void;
  fieldError: FieldError | null;
  disabled?: boolean;
}) {
  const visibleFields = fields.filter((field) => isFieldVisible(field, values));

  if (visibleFields.length === 0) {
    return <p className="text-muted-foreground text-sm">This tool has no extra settings.</p>;
  }

  return (
    <div className="space-y-5">
      {visibleFields.map((field) => (
        <OptionControl
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(value) => onChange(field.name, value)}
          error={fieldError?.field === field.name ? fieldError.message : null}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function isFieldVisible(field: OptionField, values: ToolValues): boolean {
  if (!field.showWhen) return true;

  const expected = field.showWhen.equals.map(String);
  return expected.includes(String(values[field.showWhen.field] ?? ""));
}

function OptionControl({
  field,
  value,
  onChange,
  error,
  disabled,
}: {
  field: OptionField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
  error: string | null;
  disabled?: boolean;
}) {
  const id = `option-${field.name}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // ---------------------------------------------------------------- Switch
  if (field.kind === "switch") {
    return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor={id}>{field.label}</Label>
            {field.hint ? (
              <p id={hintId} className="text-muted-foreground text-[11px] leading-relaxed">
                {field.hint}
              </p>
            ) : null}
          </div>
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
            aria-describedby={field.hint ? hintId : undefined}
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------- Slider
  if (field.kind === "slider") {
    const numericValue = typeof value === "number" ? value : Number(value ?? field.min);

    return (
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id}>{field.label}</Label>
          <output
            htmlFor={id}
            className="text-muted-foreground font-mono text-xs tabular-nums"
            aria-live="polite"
          >
            {numericValue}
            {field.unit ?? ""}
          </output>
        </div>
        <Slider
          id={id}
          min={field.min}
          max={field.max}
          step={field.step}
          value={[numericValue]}
          onValueChange={(next) => onChange(next[0] ?? field.min)}
          disabled={disabled}
          aria-describedby={field.hint ? hintId : undefined}
        />
        {field.hint ? (
          <p id={hintId} className="text-muted-foreground text-[11px] leading-relaxed">
            {field.hint}
          </p>
        ) : null}
      </div>
    );
  }

  // -------------------------------------------------------------- Segmented
  if (field.kind === "segmented") {
    return (
      <div className="space-y-2">
        <span id={`${id}-label`} className="text-sm leading-none font-medium">
          {field.label}
        </span>
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          aria-describedby={field.hint ? hintId : undefined}
          className="bg-muted/50 grid auto-cols-fr grid-flow-col gap-1 rounded-lg border p-1"
        >
          {field.options.map((option) => {
            const active = String(value) === option.value;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cn(
                  "focus-visible:ring-ring rounded-md px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {field.hint ? (
          <p id={hintId} className="text-muted-foreground text-[11px] leading-relaxed">
            {field.hint}
          </p>
        ) : null}
      </div>
    );
  }

  // ----------------------------------------------------------------- Select
  if (field.kind === "select") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <NativeSelect
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-describedby={field.hint ? hintId : undefined}
          aria-invalid={Boolean(error)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        {field.hint ? (
          <p id={hintId} className="text-muted-foreground text-[11px] leading-relaxed">
            {field.hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-destructive text-[11px]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // --------------------------------------------------------------- Password
  if (field.kind === "password") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Input
          id={id}
          type="password"
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          aria-describedby={
            [field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
            undefined
          }
          aria-invalid={Boolean(error)}
          autoComplete="new-password"
        />
        {field.hint ? (
          <p id={hintId} className="text-muted-foreground text-[11px] leading-relaxed">
            {field.hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-destructive text-[11px]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // --------------------------------------------------------------- Textarea
  if (field.kind === "textarea") {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 4}
          disabled={disabled}
          aria-describedby={
            [field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
            undefined
          }
          aria-invalid={Boolean(error)}
          spellCheck={false}
          className="text-[13px]"
        />
        {field.hint ? (
          <p
            id={hintId}
            className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-relaxed"
          >
            <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {field.hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-destructive text-[11px]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------------- Text
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
        aria-describedby={
          [field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
          undefined
        }
        aria-invalid={Boolean(error)}
        spellCheck={false}
        autoComplete="off"
        className="font-mono text-[13px]"
      />
      {field.hint ? (
        <p
          id={hintId}
          className="text-muted-foreground flex items-start gap-1.5 text-[11px] leading-relaxed"
        >
          <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {field.hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-[11px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
