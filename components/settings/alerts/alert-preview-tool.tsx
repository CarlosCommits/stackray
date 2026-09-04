"use client";

import {
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import {
  Eye,
  FlaskConical,
  ListChecks,
  Mail,
  X,
} from "lucide-react";

import { ChangeTypeIcon } from "@/components/changes/change-presentation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CHANGE_TYPE_CATEGORY_DEFINITIONS,
  CHANGE_TYPE_DEFINITIONS,
  type KnownChangeType,
} from "@/lib/changes/change-types";
import type { AlertPreviewResponse } from "@/lib/contracts/alert-preview";
import { cn } from "@/lib/utils";

const DEFAULT_CHANGE_TYPES = [
  "status.changed",
  "technology.changed",
  "tls.certificate_changed",
] satisfies KnownChangeType[];

async function readPreviewError(response: Response) {
  const payload = await response.json().catch(() => null) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? "The preview could not be generated.";
}

export function AlertPreviewTool() {
  const [open, setOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"changes" | "email">("changes");
  const [target, setTarget] = useState("example.com");
  const [selectedChangeTypes, setSelectedChangeTypes] = useState<KnownChangeType[]>(DEFAULT_CHANGE_TYPES);
  const [preview, setPreview] = useState<AlertPreviewResponse | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const deferredTarget = useDeferredValue(target);
  const selectedChangeTypeKey = selectedChangeTypes.join(",");
  const canGeneratePreview = selectedChangeTypes.length > 0 && target.trim().length > 0;

  useEffect(() => {
    if (!open || selectedChangeTypes.length === 0 || deferredTarget.trim().length === 0) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setPreviewPending(true);
      setPreviewError(null);
      void fetch("/api/v1/settings/alerts/dev-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target: deferredTarget,
          changeTypes: selectedChangeTypes,
        }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readPreviewError(response));
        return response.json() as Promise<AlertPreviewResponse>;
      }).then((result) => {
        setPreview(result);
      }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "The preview could not be generated.");
      }).finally(() => {
        if (!controller.signal.aborted) setPreviewPending(false);
      });
    }, 150);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deferredTarget, open, selectedChangeTypeKey, selectedChangeTypes]);

  const toggleChangeType = (changeType: KnownChangeType, checked: boolean) => {
    setSelectedChangeTypes((current) => checked
      ? CHANGE_TYPE_DEFINITIONS.flatMap((definition) => (
          definition.type === changeType || current.includes(definition.type)
            ? [definition.type]
            : []
        ))
      : current.filter((type) => type !== changeType));
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FlaskConical data-icon="inline-start" />
        Preview alert
      </Button>

      <ResponsiveModal open={open} onOpenChange={setOpen} drawerProps={{ repositionInputs: false }}>
        <ResponsiveModalContent
          desktopClassName="h-[min(880px,92vh)] overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-[1440px]"
          mobileClassName="h-[92svh] overflow-hidden"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3 md:hidden"
            aria-label="Close alert preview"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
          <div className="flex h-full min-h-0 flex-col">
            <ResponsiveModalHeader className="border-b border-foreground/[0.07] px-5 py-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-6">
              <ResponsiveModalTitle className="flex items-center gap-2.5">
                <FlaskConical className="text-amber-300" />
                Alert preview
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Choose sample scan changes and inspect the production email template.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>

            <div className="border-b border-foreground/[0.07] px-4 py-3 md:hidden">
              <ToggleGroup
                type="single"
                value={mobilePane}
                onValueChange={(value) => {
                  if (value) setMobilePane(value as typeof mobilePane);
                }}
                variant="segmented"
                className="grid w-full grid-cols-2"
                aria-label="Alert preview view"
              >
                <ToggleGroupItem value="changes" className="w-full">
                  <ListChecks data-icon="inline-start" />
                  Changes
                </ToggleGroupItem>
                <ToggleGroupItem value="email" className="w-full">
                  <Eye data-icon="inline-start" />
                  Email
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid min-h-0 min-w-0 flex-1 md:grid-cols-[minmax(21rem,0.78fr)_minmax(32rem,1.22fr)]">
              <ScrollArea className={cn(
                "min-h-0 border-r border-foreground/[0.07]",
                mobilePane !== "changes" && "hidden md:block",
              )}>
                <div className="flex flex-col gap-6 p-5 sm:p-6">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="alert-preview-target">Example target</FieldLabel>
                      <Input
                        id="alert-preview-target"
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        placeholder="example.com"
                        autoCapitalize="none"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <FieldDescription>This changes the target shown in the subject and email body.</FieldDescription>
                    </Field>
                  </FieldGroup>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">Sample changes</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedChangeTypes.length} of {CHANGE_TYPE_DEFINITIONS.length} selected
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedChangeTypes(CHANGE_TYPE_DEFINITIONS.map((definition) => definition.type))}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={selectedChangeTypes.length === 0}
                        onClick={() => setSelectedChangeTypes([])}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    {CHANGE_TYPE_CATEGORY_DEFINITIONS.map((category) => {
                      const definitions = CHANGE_TYPE_DEFINITIONS.filter((definition) => (
                        category.definitionCategories.includes(definition.category)
                      ));

                      return (
                        <FieldSet key={category.key}>
                          <FieldLegend>{category.label}</FieldLegend>
                          <FieldDescription>{category.description}</FieldDescription>
                          <FieldGroup className="gap-2">
                            {definitions.map((definition) => {
                              const checked = selectedChangeTypes.includes(definition.type);
                              const id = `alert-preview-${definition.type.replaceAll(".", "-")}`;

                              return (
                                <Label
                                  key={definition.type}
                                  htmlFor={id}
                                  className={cn(
                                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-foreground/10 px-3 py-2.5 font-normal transition-colors",
                                    checked && "border-primary/55 bg-primary/[0.06]",
                                  )}
                                >
                                  <Checkbox
                                    id={id}
                                    checked={checked}
                                    onCheckedChange={(value) => toggleChangeType(definition.type, value === true)}
                                  />
                                  <ChangeTypeIcon changeType={definition.type} className="size-5 shrink-0" />
                                  <span className="min-w-0 text-sm font-medium leading-5 text-foreground">
                                    {definition.label}
                                  </span>
                                </Label>
                              );
                            })}
                          </FieldGroup>
                        </FieldSet>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>

              <div className={cn(
                "min-h-0 min-w-0 bg-muted/20 p-3 sm:p-5",
                mobilePane !== "email" && "hidden md:block",
              )}>
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-sm">
                  <div className="flex items-start gap-3 border-b border-foreground/[0.07] px-4 py-3 sm:px-5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
                      <p className="mt-1 truncate text-sm font-medium text-foreground" title={preview?.email.subject}>
                        {!canGeneratePreview
                          ? selectedChangeTypes.length === 0 ? "Select at least one change" : "Enter an example target"
                          : preview?.email.subject ?? "Generating preview…"}
                      </p>
                    </div>
                  </div>

                  <div className="relative min-h-0 flex-1 bg-muted/20">
                    {!canGeneratePreview ? (
                      <div className="flex h-full min-h-96 items-center justify-center px-8 text-center text-sm text-muted-foreground">
                        {selectedChangeTypes.length === 0
                          ? "Select one or more changes to build the email."
                          : "Enter an example target to build the email."}
                      </div>
                    ) : previewError ? (
                      <div className="p-5">
                        <Alert variant="destructive">
                          <AlertTitle>Preview unavailable</AlertTitle>
                          <AlertDescription>{previewError}</AlertDescription>
                        </Alert>
                      </div>
                    ) : previewPending && !preview ? (
                      <div className="flex flex-col gap-4 p-6">
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-72 w-full rounded-xl" />
                      </div>
                    ) : preview ? (
                      <iframe
                        key={preview.email.subject}
                        title="Rendered Stackray alert email"
                        srcDoc={preview.email.html}
                        sandbox=""
                        className={cn(
                          "h-full min-h-[34rem] min-w-0 w-full max-w-full border-0 bg-white",
                          previewPending && "opacity-70",
                        )}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
