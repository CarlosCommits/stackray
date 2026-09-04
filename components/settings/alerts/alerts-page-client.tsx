"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  Ellipsis,
  FlaskConical,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Unplug,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import { WebhookEncryptionNotice } from "@/components/settings/alerts/webhook-encryption-notice";
import { ChangeTypeIcon } from "@/components/changes/change-presentation";
import { DemoDeploymentPrompt } from "@/components/demo/demo-deployment-cta";
import { ResendMark } from "@/components/shared/resend-mark";
import { SlackMark } from "@/components/shared/slack-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CHANGE_TYPE_CATEGORY_DEFINITIONS,
  CHANGE_TYPE_DEFINITIONS,
} from "@/lib/changes/change-types";
import { cn } from "@/lib/utils";
import type {
  AlertChannel,
  AlertPolicy,
  AlertSetupReadiness,
  EmailProviderSettings,
  ResendSetupSession,
} from "@/lib/contracts/alerts";
import type { TargetResultItem } from "@/lib/contracts/targets";
import {
  isValidSendingDomain,
  normalizeSendingDomain,
  SENDING_DOMAIN_ERROR,
} from "@/lib/validation/sending-domain";

interface AlertsPageClientProps {
  demoMode?: boolean;
  devPreviewEnabled: boolean;
  initialReadiness: AlertSetupReadiness;
  initialEmailProvider: EmailProviderSettings | null;
  adminEmail: string;
  initialResendSetupId: string | null;
  initialResendError: string | null;
  initialResendDisconnected: boolean;
  initialChannels: AlertChannel[];
  initialPolicies: AlertPolicy[];
  initialTargetOptions: TargetResultItem[];
}

const AlertPreviewTool = dynamic(() => (
  import("@/components/settings/alerts/alert-preview-tool").then((module) => module.AlertPreviewTool)
));

type SetupStatusValue = AlertSetupReadiness["email"]["status"];

const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const alertsTableHeadClassName = "h-auto px-6 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground";
const alertsTableCellClassName = "px-6 py-4";
const alertsTableRowClassName = "border-foreground/[0.06] hover:bg-foreground/[0.015]";
const STACKRAY_SLACK_RELAY_ORIGIN = "https://stackray.app";

function AnimatedChannelFields({ children, panelKey }: { children: ReactNode; panelKey: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = content.getBoundingClientRect().height;
      if (nextHeight > 0) {
        setContentHeight(nextHeight);
      }
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [panelKey]);

  return (
    <motion.div
      animate={contentHeight === null ? undefined : { height: contentHeight }}
      className="overflow-hidden"
      transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          ref={contentRef}
          key={panelKey}
          className="flex flex-col gap-5"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

const slackManifestUrl = `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify({
  display_information: {
    name: "Stackray",
    description: "Website change alerts from your Stackray instance",
    background_color: "#11161d",
  },
  features: { bot_user: { display_name: "Stackray", always_online: false } },
  oauth_config: { scopes: { bot: ["incoming-webhook"] } },
  settings: { org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false },
}))}`;

async function readApiError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return payload?.error?.message ?? "The request could not be completed.";
}

function setupStatusLabel(status: SetupStatusValue) {
  if (status === "ready") return "Ready";
  if (status === "unverified") return "Not verified";
  if (status === "invalid_configuration") return "Needs attention";
  return "Setup needed";
}

function ProviderStatus({
  readiness,
  emailProvider,
  slackConnected,
  emailSetupLoading,
  busy,
  onConnectEmail,
  onManageEmail,
  onSetupSlack,
}: {
  readiness: AlertSetupReadiness;
  emailProvider: EmailProviderSettings | null;
  slackConnected: boolean;
  emailSetupLoading: boolean;
  busy: boolean;
  onConnectEmail: () => void;
  onManageEmail: () => void;
  onSetupSlack: () => void;
}) {
  const emailReady = readiness.email.status === "ready" && emailProvider !== null;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-4">
      <div className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:flex-none lg:grid-cols-[auto_auto_auto]" title={readiness.email.detail}>
        <ResendMark className="size-6 shrink-0 text-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <p className="font-medium text-foreground">Email via Resend</p>
          <div className="flex items-center gap-2">
            <span className={emailReady ? "size-2 shrink-0 rounded-full bg-emerald-400" : "size-2 shrink-0 rounded-full bg-amber-300"} />
            <span className="text-sm text-muted-foreground">
              {emailReady ? "Connected" : setupStatusLabel(readiness.email.status)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={emailSetupLoading || busy}
          onClick={emailProvider ? onManageEmail : onConnectEmail}
        >
          {emailProvider ? <Pencil data-icon="inline-start" /> : <Mail data-icon="inline-start" />}
          {emailProvider ? "Manage" : "Connect Resend"}
        </Button>
      </div>

      <Separator orientation="vertical" className="hidden h-7 bg-foreground/[0.07] lg:block" />

      <div
        className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 lg:flex-none lg:grid-cols-[auto_auto_auto]"
        title={slackConnected
          ? "Slack is connected through at least one notification channel."
          : "Connect Slack or add an incoming webhook to create a Slack notification channel."}
      >
        <SlackMark variant="brand" className="size-5 shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <p className="font-medium text-foreground">Slack</p>
          <div className="flex items-center gap-2">
            <span className={slackConnected ? "size-2 shrink-0 rounded-full bg-emerald-400" : "size-2 shrink-0 rounded-full bg-amber-300"} />
            <span className="text-sm text-muted-foreground">{slackConnected ? "Connected" : "Setup needed"}</span>
          </div>
        </div>
        {!slackConnected ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={busy} onClick={onSetupSlack}>
            <Plus data-icon="inline-start" />
            Set up
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function channelAddress(channel: AlertChannel) {
  if (channel.channelType === "email") return channel.config.recipients.join(", ");
  if (channel.channelType === "slack") {
    return [`#${channel.config.channelName}`, channel.config.workspaceName].filter(Boolean).join(" · ");
  }
  return channel.config.hostname;
}

function channelTypeLabel(channel: AlertChannel) {
  if (channel.channelType === "email") return "Email";
  if (channel.channelType === "slack") return "Slack";
  return "Webhook";
}

function channelIcon(channel: AlertChannel) {
  if (channel.channelType === "email") return Mail;
  if (channel.channelType === "slack") return SlackMark;
  return Webhook;
}

function channelTestLabel(channel: AlertChannel) {
  if (!channel.lastTestedAt || channel.lastTestStatus === "untested") return "Not tested";
  const result = channel.lastTestStatus === "succeeded" ? "Test passed" : "Test failed";
  return `${result} · ${shortDateFormat.format(new Date(channel.lastTestedAt))}`;
}

function policyCoverageLabel(policy: AlertPolicy) {
  return policy.coverage === "all_targets"
    ? "All targets"
    : `${policy.targetIds.length} ${policy.targetIds.length === 1 ? "target" : "targets"}`;
}

function policySelectionLabel(policy: AlertPolicy) {
  if (policy.conditions.selectionMode === "all") return "All changes";
  return `${policy.conditions.changeTypes.length} selected types`;
}

function PolicySectionHeading({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <header className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-foreground/15 bg-muted/40 text-sm font-medium text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0">
        <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
    </header>
  );
}

function PolicyChoiceContent({
  title,
  description,
  selected,
  footer,
}: {
  title: string;
  description: string;
  selected: boolean;
  footer?: ReactNode;
}) {
  return (
    <>
      <span
        className={cn(
          "mt-0.5 mr-1.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/60",
        )}
        aria-hidden="true"
      >
        {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 text-left">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="mt-1 block whitespace-normal text-sm font-normal leading-5 text-muted-foreground">{description}</span>
        {footer ? <span className="mt-3 flex flex-wrap items-center gap-2">{footer}</span> : null}
      </span>
    </>
  );
}

function PolicyCompoundChoice({
  value,
  title,
  description,
  selected,
  summary,
  actionLabel,
  onAction,
}: {
  value: string;
  title: string;
  description: string;
  selected: boolean;
  summary?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const hasAction = selected && summary && actionLabel && onAction;

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-input bg-transparent transition-colors",
        selected && "border-primary/70 bg-primary/[0.08]",
      )}
    >
      <ToggleGroupItem
        value={value}
        className={cn(
          "h-auto min-h-24 w-full items-start justify-start whitespace-normal rounded-xl border-0 bg-transparent p-4 shadow-none data-[state=on]:bg-transparent data-[state=on]:text-foreground",
          selected ? "hover:bg-primary/[0.1]" : "hover:bg-muted",
          hasAction && "rounded-b-none",
        )}
      >
        <PolicyChoiceContent title={title} description={description} selected={selected} />
      </ToggleGroupItem>
      {hasAction ? (
        <>
          <Separator className="bg-foreground/[0.08]" />
          <div className="flex items-center gap-1 px-4 py-3">
            <span className="mr-1.5 size-5 shrink-0" aria-hidden="true" />
            <span className="text-sm text-muted-foreground" aria-live="polite">{summary}</span>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChangeTypePicker({
  changeTypes,
  onChangeTypesChange,
  onBack,
}: {
  changeTypes: string[];
  onChangeTypesChange: (changeTypes: string[]) => void;
  onBack: () => void;
}) {
  const categories = CHANGE_TYPE_CATEGORY_DEFINITIONS.flatMap((category) => {
    const definitions = CHANGE_TYPE_DEFINITIONS.filter((definition) => (
      category.definitionCategories.includes(definition.category)
    ));
    return definitions.length > 0 ? [{ ...category, definitions }] : [];
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to policy
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{changeTypes.length} selected</span>
          {changeTypes.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChangeTypesChange([])}>Clear</Button>
          ) : null}
        </div>
      </div>

      <h2 className="mt-6 font-heading text-2xl font-semibold tracking-tight text-foreground">
        Choose which website changes should send notifications.
      </h2>

      <div className="mt-9 grid items-start gap-7 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-foreground/[0.08]">
          {categories.map((category) => (
            <FieldSet key={category.key} className="min-w-0 lg:px-5 first:lg:pl-0 last:lg:pr-0">
              <FieldLegend>{category.label}</FieldLegend>
              <FieldDescription>{category.description}</FieldDescription>
              <FieldGroup className="gap-2">
                {category.definitions.map((definition) => {
                  const id = `picker-change-type-${definition.type.replaceAll(".", "-")}`;
                  const checked = changeTypes.includes(definition.type);
                  return (
                    <Label
                      key={definition.type}
                      htmlFor={id}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-foreground/10 px-3 py-2.5 font-normal transition-colors",
                        checked && "border-primary/55 bg-primary/[0.06]",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(value) => onChangeTypesChange(value
                          ? [...new Set([...changeTypes, definition.type])]
                          : changeTypes.filter((type) => type !== definition.type))}
                      />
                      <ChangeTypeIcon changeType={definition.type} className="size-5 shrink-0" />
                      <span className="min-w-0 text-sm font-medium leading-5 text-foreground">{definition.label}</span>
                    </Label>
                  );
                })}
              </FieldGroup>
            </FieldSet>
          ))}
      </div>
    </div>
  );
}

function TargetPicker({
  selectedTargetIds,
  selectedTargetOptions,
  searchResults,
  search,
  pending,
  error,
  onSearchChange,
  onSelectedTargetIdsChange,
  onBack,
}: {
  selectedTargetIds: string[];
  selectedTargetOptions: TargetResultItem[];
  searchResults: TargetResultItem[];
  search: string;
  pending: boolean;
  error: string | null;
  onSearchChange: (search: string) => void;
  onSelectedTargetIdsChange: (targetIds: string[]) => void;
  onBack: () => void;
}) {
  const unselectedSearchResults = searchResults.filter((target) => (
    !selectedTargetIds.includes(target.canonicalTargetId)
  ));
  const hasSearchQuery = search.trim().length > 0;
  const allMatchingTargetsSelected = searchResults.length > 0 && unselectedSearchResults.length === 0;
  const showSearchResults = hasSearchQuery && !allMatchingTargetsSelected;

  const toggleTarget = (targetId: string, checked: boolean) => {
    onSelectedTargetIdsChange(checked
      ? [...new Set([...selectedTargetIds, targetId])]
      : selectedTargetIds.filter((id) => id !== targetId));
  };

  const renderTarget = (target: TargetResultItem, prefix: string) => {
    const id = `${prefix}-${target.canonicalTargetId}`;
    const checked = selectedTargetIds.includes(target.canonicalTargetId);
    return (
      <Label
        key={target.canonicalTargetId}
        htmlFor={id}
        className={cn(
          "flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-foreground/10 px-4 py-3 font-normal transition-colors hover:bg-foreground/[0.025]",
          checked && "border-primary/55 bg-primary/[0.06]",
        )}
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => toggleTarget(target.canonicalTargetId, value === true)}
        />
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{target.normalizedTarget}</span>
          {target.title ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{target.title}</span> : null}
        </span>
      </Label>
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back to policy
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">{selectedTargetIds.length} selected</span>
          {selectedTargetIds.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onSelectedTargetIdsChange([])}>Clear</Button>
          ) : null}
        </div>
      </div>

      <h2 className="mt-6 font-heading text-2xl font-semibold tracking-tight text-foreground">
        Choose which websites can trigger this policy.
      </h2>

      <InputGroup className="mt-7 max-w-2xl">
        <InputGroupAddon><Search /></InputGroupAddon>
        <InputGroupInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by domain or page title"
          aria-label="Search alert targets"
        />
      </InputGroup>

      <div className="mt-6 grid items-start gap-7 lg:grid-cols-2">
        {selectedTargetOptions.length > 0 ? (
          <FieldSet className={!showSearchResults ? "lg:col-span-2 lg:max-w-2xl" : undefined}>
            <FieldLegend>Selected targets</FieldLegend>
            <FieldDescription>These websites can trigger this policy.</FieldDescription>
            <FieldGroup className="gap-2">
              {selectedTargetOptions.map((target) => renderTarget(target, "selected-alert-target"))}
            </FieldGroup>
          </FieldSet>
        ) : null}

        {showSearchResults ? (
          <FieldSet className={selectedTargetOptions.length === 0 ? "lg:col-span-2" : undefined}>
            <FieldLegend>Search results</FieldLegend>
            <FieldDescription>Only matching targets are shown.</FieldDescription>
            {pending ? <p className="py-8 text-center text-sm text-muted-foreground">Searching targets…</p> : null}
            {!pending && error ? <p role="alert" className="py-8 text-center text-sm text-destructive">{error}</p> : null}
            {!pending && !error && searchResults.length === 0 ? (
              <Empty className="rounded-lg border border-dashed border-foreground/10 py-10">
                <EmptyHeader>
                  <EmptyTitle>No targets found</EmptyTitle>
                  <EmptyDescription>Try a different domain or page title.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {!pending && !error && unselectedSearchResults.length > 0 ? (
              <FieldGroup className="gap-2">
                {unselectedSearchResults.map((target) => renderTarget(target, "result-alert-target"))}
              </FieldGroup>
            ) : null}
          </FieldSet>
        ) : null}
      </div>
    </div>
  );
}

export function AlertsPageClient({
  demoMode = false,
  devPreviewEnabled,
  initialReadiness,
  initialEmailProvider,
  adminEmail,
  initialResendSetupId,
  initialResendError,
  initialResendDisconnected,
  initialChannels,
  initialPolicies,
  initialTargetOptions,
}: AlertsPageClientProps) {
  const [readiness, setReadiness] = useState(initialReadiness);
  const [emailProvider, setEmailProvider] = useState(initialEmailProvider);
  const [channels, setChannels] = useState(initialChannels);
  const [policies, setPolicies] = useState(initialPolicies);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<AlertPolicy | null>(null);
  const [openChannelMenuId, setOpenChannelMenuId] = useState<string | null>(null);
  const [openPolicyMenuId, setOpenPolicyMenuId] = useState<string | null>(null);
  const [channelType, setChannelType] = useState<"email" | "slack" | "webhook">("email");
  const [channelName, setChannelName] = useState("");
  const [recipients, setRecipients] = useState("");
  const [slackChannelName, setSlackChannelName] = useState("");
  const [slackWorkspaceName, setSlackWorkspaceName] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackManualOpen, setSlackManualOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [clearAuthorization, setClearAuthorization] = useState(false);
  const [clearSigningSecret, setClearSigningSecret] = useState(false);
  const [coverage, setCoverage] = useState<"all_targets" | "selected_targets">("all_targets");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetOptions, setTargetOptions] = useState(initialTargetOptions);
  const [targetSearchPending, setTargetSearchPending] = useState(false);
  const [targetSearchError, setTargetSearchError] = useState<string | null>(null);
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [knownTargetOptions, setKnownTargetOptions] = useState(initialTargetOptions);
  const [selectionMode, setSelectionMode] = useState<"all" | "selected">("all");
  const [changeTypes, setChangeTypes] = useState<string[]>([]);
  const [changeTypePickerOpen, setChangeTypePickerOpen] = useState(false);
  const [cooldownMinutes, setCooldownMinutes] = useState("0");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [resendConsentModalOpen, setResendConsentModalOpen] = useState(false);
  const [emailSetupModalOpen, setEmailSetupModalOpen] = useState(false);
  const [demoDeploymentOpen, setDemoDeploymentOpen] = useState(false);
  const [demoDeploymentSource, setDemoDeploymentSource] = useState("alerts_page");
  const [emailSetupSession, setEmailSetupSession] = useState<ResendSetupSession | null>(null);
  const [emailSetupLoading, setEmailSetupLoading] = useState(Boolean(initialResendSetupId));
  const [emailDomainName, setEmailDomainName] = useState(initialEmailProvider?.domainName ?? "");
  const [emailDomainError, setEmailDomainError] = useState<string | null>(null);
  const [senderName, setSenderName] = useState(initialEmailProvider?.senderName ?? "Stackray");
  const [senderLocalPart, setSenderLocalPart] = useState(initialEmailProvider?.senderLocalPart ?? "alerts");
  const [testRecipient, setTestRecipient] = useState(initialEmailProvider?.testRecipient ?? adminEmail);
  const policyFormScrollRef = useRef<HTMLDivElement>(null);
  const policyFormScrollTopRef = useRef(0);
  const shouldRestorePolicyFormScrollRef = useRef(false);

  const openDemoDeploymentPrompt = (source: string) => {
    setOpenChannelMenuId(null);
    setOpenPolicyMenuId(null);
    setDemoDeploymentSource(source);
    setDemoDeploymentOpen(true);
  };

  useLayoutEffect(() => {
    if (targetPickerOpen || changeTypePickerOpen || !shouldRestorePolicyFormScrollRef.current) return;
    const scrollContainer = policyFormScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTop = policyFormScrollTopRef.current;
    shouldRestorePolicyFormScrollRef.current = false;
  }, [changeTypePickerOpen, targetPickerOpen]);

  useEffect(() => {
    if (initialResendError) toast.error("Resend could not be connected", { description: initialResendError });
    if (initialResendDisconnected) toast.success("Resend disconnected");
  }, [initialResendDisconnected, initialResendError]);

  useEffect(() => {
    const handleSlackOauthMessage = (event: MessageEvent) => {
      if (event.origin !== STACKRAY_SLACK_RELAY_ORIGIN || !event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: unknown; code?: unknown; state?: unknown; error?: unknown };
      if (message.type !== "stackray:slack-oauth") return;
      if (typeof message.error === "string" && message.error) {
        toast.error("Slack was not connected", { description: message.error === "access_denied" ? "Slack authorization was cancelled." : message.error });
        return;
      }
      if (typeof message.code !== "string" || typeof message.state !== "string") {
        toast.error("Slack was not connected", { description: "Slack returned an invalid authorization response." });
        return;
      }

      setBusyAction("finish-slack-connect");
      void fetch("/api/v1/settings/alerts/slack/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: message.code, state: message.state }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<AlertChannel>;
      }).then((channel) => {
        setChannels((items) => items.some((item) => item.id === channel.id)
          ? items.map((item) => item.id === channel.id ? channel : item)
          : [channel, ...items]);
        setChannelModalOpen(false);
        toast.success("Slack connected", { description: `Notifications will be sent to ${channelAddress(channel)}.` });
      }).catch((error: unknown) => {
        toast.error("Slack could not be connected", { description: error instanceof Error ? error.message : undefined });
      }).finally(() => setBusyAction(null));
    };

    window.addEventListener("message", handleSlackOauthMessage);
    return () => window.removeEventListener("message", handleSlackOauthMessage);
  }, []);

  useEffect(() => {
    if (!initialResendSetupId) return;
    const controller = new AbortController();
    void fetch(`/api/v1/settings/alerts/email-provider/setup/${initialResendSetupId}`, {
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json() as Promise<ResendSetupSession>;
    }).then((setup) => {
      setEmailSetupSession(setup);
      setEmailDomainName(initialEmailProvider?.domainName ?? "");
      setEmailDomainError(null);
      setSenderName(initialEmailProvider?.senderName ?? "Stackray");
      setSenderLocalPart(initialEmailProvider?.senderLocalPart ?? "alerts");
      setTestRecipient(initialEmailProvider?.testRecipient ?? adminEmail);
      setEmailSetupModalOpen(true);
    }).catch((setupError: unknown) => {
      if (setupError instanceof DOMException && setupError.name === "AbortError") return;
      toast.error(setupError instanceof Error ? setupError.message : "Resend setup could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setEmailSetupLoading(false);
    });
    return () => controller.abort();
  }, [adminEmail, initialEmailProvider, initialResendSetupId]);

  const openEditEmailProvider = () => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_resend_settings");
      return;
    }
    if (!emailProvider) return;
    setEmailSetupSession(null);
    setEmailDomainName(emailProvider.domainName);
    setEmailDomainError(null);
    setSenderName(emailProvider.senderName);
    setSenderLocalPart(emailProvider.senderLocalPart);
    setTestRecipient(emailProvider.testRecipient);
    setEmailSetupModalOpen(true);
  };

  const connectResend = () => {
    setResendConsentModalOpen(false);
    window.location.assign("/api/v1/settings/alerts/email-provider/connect");
  };

  const saveEmailProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidSendingDomain(emailDomainName)) {
      setEmailDomainError(SENDING_DOMAIN_ERROR);
      return;
    }
    const normalizedDomainName = normalizeSendingDomain(emailDomainName);
    setEmailDomainName(normalizedDomainName);
    setEmailDomainError(null);
    await runAction("save-email-provider", async () => {
      const configuring = emailSetupSession !== null;
      const response = await fetch("/api/v1/settings/alerts/email-provider", {
        method: configuring ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(configuring ? {
          setupSessionId: emailSetupSession.id,
          domainName: normalizedDomainName,
          senderName,
          senderLocalPart,
          testRecipient,
        } : { domainName: normalizedDomainName, senderName, senderLocalPart, testRecipient }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const settings = await response.json() as EmailProviderSettings;
      setEmailProvider(settings);
      setReadiness((current) => ({
        ...current,
        email: { status: "ready", detail: "Email notifications use the configured Resend account.", missingEnvironmentVariables: [] },
      }));
      setEmailSetupModalOpen(false);
      setEmailSetupSession(null);
      window.history.replaceState(null, "", "/settings/alerts");
      toast.success(configuring ? "Resend connected" : "Email settings updated", {
        description: `Test email sent from ${settings.fromAddress}.`,
      });
    });
  };

  const runEmailProviderTest = async () => runAction("test-email-provider", async () => {
    const response = await fetch("/api/v1/settings/alerts/email-provider/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: testRecipient }),
    });
    if (!response.ok) throw new Error(await readApiError(response));
    const result = await response.json() as { settings: EmailProviderSettings; delivered: boolean; message: string };
    setEmailProvider(result.settings);
    if (!result.delivered) throw new Error(result.message);
    toast.success("Test email sent", { description: `Delivered to ${testRecipient}.` });
  });

  const disconnectResend = async () => runAction("disconnect-email-provider", async () => {
    const response = await fetch("/api/v1/settings/alerts/email-provider", { method: "DELETE" });
    if (!response.ok) throw new Error(await readApiError(response));
    setEmailProvider(null);
    setChannels((items) => items.map((channel) => channel.channelType === "email"
      ? { ...channel, enabled: false }
      : channel));
    setEmailSetupModalOpen(false);
    setReadiness((current) => ({
      ...current,
      email: { status: "needs_configuration", detail: "Connect Resend to send email notifications.", missingEnvironmentVariables: [] },
    }));
    toast.success("Resend disconnected", {
      description: "Email notification channels were disabled.",
    });
  });

  useEffect(() => {
    const query = targetSearch.trim();
    if (!targetPickerOpen || !query) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setTargetSearchPending(true);
      setTargetSearchError(null);
      void fetch(`/api/v1/targets/results?limit=20&q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ items: TargetResultItem[] }>;
      }).then((payload) => {
        setTargetOptions(payload.items);
        setKnownTargetOptions((current) => {
          const optionsById = new Map(current.map((target) => [target.canonicalTargetId, target]));
          for (const target of payload.items) optionsById.set(target.canonicalTargetId, target);
          return [...optionsById.values()];
        });
      }).catch((searchError: unknown) => {
        if (searchError instanceof DOMException && searchError.name === "AbortError") return;
        setTargetSearchError(searchError instanceof Error ? searchError.message : "Targets could not be loaded.");
      }).finally(() => {
        if (!controller.signal.aborted) setTargetSearchPending(false);
      });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [targetPickerOpen, targetSearch]);

  const hasTargetSearch = targetSearch.trim().length > 0;
  const displayedTargetOptions = hasTargetSearch ? targetOptions : [];
  const displayedTargetSearchPending = targetPickerOpen && hasTargetSearch && targetSearchPending;
  const selectedTargetOptionIds = new Set(selectedTargets);
  const selectedTargetOptions = knownTargetOptions.filter((target) => selectedTargetOptionIds.has(target.canonicalTargetId));
  const enabledChannels = channels.filter((channel) => channel.enabled);
  const enabledChannelIds = new Set(enabledChannels.map((channel) => channel.id));
  const selectablePolicyChannels = editingPolicy ? channels : enabledChannels;
  const policySubmitDisabled = busyAction !== null
    || selectedChannels.length === 0
    || (coverage === "selected_targets" && selectedTargets.length === 0)
    || (selectionMode === "selected" && changeTypes.length === 0);
  const editingWebhook = editingChannel?.channelType === "webhook" ? editingChannel : null;
  const editingSlack = editingChannel?.channelType === "slack" ? editingChannel : null;
  const emailChannelSetupRequired = editingChannel === null
    && channelType === "email"
    && readiness.email.status !== "ready";
  const channelFormPanelKey = emailChannelSetupRequired
    ? "email-setup-required"
    : channelType === "slack"
      ? `slack-${editingSlack ? "edit" : slackManualOpen ? "manual" : "connect"}`
      : channelType;

  const resetChannelForm = () => {
    setEditingChannel(null);
    setChannelType("email");
    setChannelName("");
    setRecipients("");
    setSlackChannelName("");
    setSlackWorkspaceName("");
    setSlackWebhookUrl("");
    setSlackManualOpen(false);
    setEndpoint("");
    setAuthorization("");
    setSigningSecret("");
    setClearAuthorization(false);
    setClearSigningSecret(false);
  };

  const openCreateChannel = () => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_add_channel");
      return;
    }
    resetChannelForm();
    setChannelModalOpen(true);
  };

  const openCreateSlackChannel = () => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_slack_setup");
      return;
    }
    resetChannelForm();
    setChannelType("slack");
    setChannelModalOpen(true);
  };

  const openResendSetupFromChannel = () => {
    setChannelModalOpen(false);
    resetChannelForm();
    window.setTimeout(() => setResendConsentModalOpen(true), 0);
  };

  const openEditChannel = (channel: AlertChannel) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_channel_action");
      return;
    }
    setEditingChannel(channel);
    setChannelType(channel.channelType);
    setChannelName(channel.displayName);
    setRecipients(channel.channelType === "email" ? channel.config.recipients.join(", ") : "");
    setSlackChannelName(channel.channelType === "slack" ? channel.config.channelName : "");
    setSlackWorkspaceName(channel.channelType === "slack" ? channel.config.workspaceName ?? "" : "");
    setSlackWebhookUrl("");
    setSlackManualOpen(channel.channelType === "slack");
    setEndpoint("");
    setAuthorization("");
    setSigningSecret("");
    setClearAuthorization(false);
    setClearSigningSecret(false);
    setOpenChannelMenuId(null);
    setChannelModalOpen(true);
  };

  const resetPolicyForm = () => {
    policyFormScrollTopRef.current = 0;
    shouldRestorePolicyFormScrollRef.current = false;
    setEditingPolicy(null);
    setCoverage("all_targets");
    setSelectedTargets([]);
    setTargetSearch("");
    setTargetOptions([]);
    setTargetSearchError(null);
    setTargetPickerOpen(false);
    setSelectionMode("all");
    setChangeTypes([]);
    setChangeTypePickerOpen(false);
    setCooldownMinutes("0");
    setSelectedChannels([]);
  };

  const openCreatePolicy = () => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_create_policy");
      return;
    }
    resetPolicyForm();
    setPolicyModalOpen(true);
  };

  const openEditPolicy = (policy: AlertPolicy) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_policy_action");
      return;
    }
    policyFormScrollTopRef.current = 0;
    shouldRestorePolicyFormScrollRef.current = false;
    setEditingPolicy(policy);
    setCoverage(policy.coverage);
    setSelectedTargets(policy.targetIds);
    setTargetSearch("");
    setTargetOptions([]);
    setTargetSearchError(null);
    setTargetPickerOpen(false);
    setSelectionMode(policy.conditions.selectionMode);
    setChangeTypes(policy.conditions.changeTypes);
    setChangeTypePickerOpen(false);
    setCooldownMinutes(String(policy.cooldownSeconds / 60));
    setSelectedChannels(policy.channelIds);
    setOpenPolicyMenuId(null);
    setPolicyModalOpen(true);
  };

  const openChangeTypePicker = () => {
    policyFormScrollTopRef.current = policyFormScrollRef.current?.scrollTop ?? 0;
    setChangeTypePickerOpen(true);
  };

  const openTargetPicker = () => {
    policyFormScrollTopRef.current = policyFormScrollRef.current?.scrollTop ?? 0;
    setTargetPickerOpen(true);
  };

  const closeChangeTypePicker = () => {
    if (changeTypePickerOpen) shouldRestorePolicyFormScrollRef.current = true;
    setChangeTypePickerOpen(false);
  };

  const closeTargetPicker = () => {
    if (targetPickerOpen) shouldRestorePolicyFormScrollRef.current = true;
    setTargetPickerOpen(false);
    setTargetSearch("");
    setTargetOptions([]);
    setTargetSearchError(null);
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "The request could not be completed.");
    } finally {
      setBusyAction(null);
    }
  };

  const connectSlack = async () => {
    const popup = window.open("about:blank", "stackray-slack-oauth", "popup,width=720,height=760");
    if (!popup) {
      toast.error("Allow pop-ups to connect Slack.");
      return;
    }
    popup.document.title = "Connecting Slack";
    await runAction("connect-slack", async () => {
      const response = await fetch("/api/v1/settings/alerts/slack/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingSlack ? { existingChannelId: editingSlack.id } : {}),
      });
      if (!response.ok) {
        popup.close();
        throw new Error(await readApiError(response));
      }
      const payload = await response.json() as { authorizationUrl: string };
      popup.location.replace(payload.authorizationUrl);
      popup.focus();
    });
  };

  const saveChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(editingChannel ? `edit-channel-${editingChannel.id}` : "create-channel", async () => {
      const body = channelType === "email"
        ? {
            displayName: channelName,
            channelType,
            recipients: recipients.split(",").map((value) => value.trim()).filter(Boolean),
            ...(editingChannel ? { enabled: editingChannel.enabled } : {}),
          }
        : channelType === "slack"
          ? {
              displayName: channelName,
              channelType,
              webhookUrl: slackWebhookUrl.trim() || undefined,
              channelName: slackChannelName,
              workspaceName: slackWorkspaceName.trim() || undefined,
              ...(editingChannel ? { enabled: editingChannel.enabled } : {}),
            }
        : {
            displayName: channelName,
            channelType,
            endpoint: endpoint.trim() || undefined,
            authorizationHeader: authorization.trim() || undefined,
            signingSecret: signingSecret || undefined,
            ...(editingChannel ? {
              clearAuthorizationHeader: clearAuthorization,
              clearSigningSecret,
              enabled: editingChannel.enabled,
            } : {}),
          };
      const response = await fetch(editingChannel
        ? `/api/v1/settings/alerts/channels/${editingChannel.id}`
        : "/api/v1/settings/alerts/channels", {
        method: editingChannel ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const channel = await response.json() as AlertChannel;
      setChannels((items) => editingChannel
        ? items.map((item) => item.id === channel.id ? channel : item)
        : [channel, ...items]);
      setChannelModalOpen(false);
      resetChannelForm();
      toast.success(editingChannel ? "Notification channel updated" : "Notification channel created", {
        description: editingChannel ? undefined : "Test it before relying on it for alerts.",
      });
    });
  };

  const updateChannel = async (channel: AlertChannel, enabled: boolean) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_channel_action");
      return;
    }
    await runAction(`channel-${channel.id}`, async () => {
      const response = await fetch(`/api/v1/settings/alerts/channels/${channel.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const updated = await response.json() as AlertChannel;
      setChannels((items) => items.map((item) => item.id === updated.id ? updated : item));
      setOpenChannelMenuId(null);
      toast.success(`${channel.displayName} ${enabled ? "enabled" : "disabled"}`);
    });
  };

  const testChannel = async (channel: AlertChannel) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_channel_action");
      return;
    }
    await runAction(`test-${channel.id}`, async () => {
      const response = await fetch(`/api/v1/settings/alerts/channels/${channel.id}/test`, { method: "POST" });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { channel: AlertChannel; delivered: boolean; message: string };
      setChannels((items) => items.map((item) => item.id === result.channel.id ? result.channel : item));
      setOpenChannelMenuId(null);
      if (!result.delivered) throw new Error(result.message);
      toast.success("Test notification delivered", { description: result.message });
    });
  };

  const deleteChannel = async (channel: AlertChannel) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_channel_action");
      return;
    }
    await runAction(`delete-${channel.id}`, async () => {
      const response = await fetch(`/api/v1/settings/alerts/channels/${channel.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response));
      setChannels((items) => items.filter((item) => item.id !== channel.id));
      setSelectedChannels((items) => items.filter((id) => id !== channel.id));
      setPolicies((items) => items.map((policy) => ({
        ...policy,
        channelIds: policy.channelIds.filter((id) => id !== channel.id),
      })));
      setOpenChannelMenuId(null);
      toast.success("Notification channel deleted");
    });
  };

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(editingPolicy ? `edit-policy-${editingPolicy.id}` : "create-policy", async () => {
      const generatedPolicyName = coverage === "all_targets"
        ? selectionMode === "all" ? "All website changes" : "Selected website changes"
        : selectionMode === "all" ? "All changes for selected targets" : "Selected changes for selected targets";
      const response = await fetch(editingPolicy
        ? `/api/v1/settings/alerts/policies/${editingPolicy.id}`
        : "/api/v1/settings/alerts/policies", {
        method: editingPolicy ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editingPolicy?.name ?? generatedPolicyName,
          state: editingPolicy?.state ?? "enabled",
          coverage,
          targetIds: coverage === "selected_targets" ? selectedTargets : [],
          conditions: {
            selectionMode,
            changeTypes: selectionMode === "selected" ? changeTypes : [],
          },
          cooldownSeconds: Math.max(0, Number.parseInt(cooldownMinutes || "0", 10) * 60),
          channelIds: selectedChannels,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const policy = await response.json() as AlertPolicy;
      setPolicies((items) => editingPolicy
        ? items.map((item) => item.id === policy.id ? policy : item)
        : [policy, ...items]);
      setPolicyModalOpen(false);
      resetPolicyForm();
      toast.success(editingPolicy ? "Alert policy updated" : "Alert policy enabled", {
        description: editingPolicy ? undefined : coverage === "all_targets"
          ? "Matching changes from all targets can now trigger alerts."
          : `${selectedTargets.length} selected ${selectedTargets.length === 1 ? "target can" : "targets can"} now trigger alerts.`,
      });
    });
  };

  const updatePolicy = async (policy: AlertPolicy, state: "enabled" | "paused") => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_policy_action");
      return;
    }
    await runAction(`policy-${policy.id}`, async () => {
      const response = await fetch(`/api/v1/settings/alerts/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const updated = await response.json() as AlertPolicy;
      setPolicies((items) => items.map((item) => item.id === updated.id ? updated : item));
      setOpenPolicyMenuId(null);
      toast.success(`${policy.name} ${state}`);
    });
  };

  const deletePolicy = async (policy: AlertPolicy) => {
    if (demoMode) {
      openDemoDeploymentPrompt("alerts_policy_action");
      return;
    }
    await runAction(`delete-policy-${policy.id}`, async () => {
      const response = await fetch(`/api/v1/settings/alerts/policies/${policy.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readApiError(response));
      setPolicies((items) => items.filter((item) => item.id !== policy.id));
      setOpenPolicyMenuId(null);
      toast.success("Alert policy deleted");
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Change alerts</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Channels define where notifications go. Policies choose which website scan changes trigger alerts.
          </p>
        </div>
        {devPreviewEnabled ? <AlertPreviewTool /> : null}
      </header>

      {readiness.webhooks.missingEnvironmentVariables.includes("STACKRAY_ENCRYPTION_KEY") ? <WebhookEncryptionNotice /> : null}

      <Card className="gap-0 py-0 ring-foreground/[0.07]">
        <ProviderStatus
          readiness={readiness}
          emailProvider={emailProvider}
          slackConnected={channels.some((channel) => channel.channelType === "slack")}
          emailSetupLoading={emailSetupLoading}
          busy={busyAction !== null}
          onConnectEmail={() => demoMode
            ? openDemoDeploymentPrompt("alerts_resend_settings")
            : setResendConsentModalOpen(true)}
          onManageEmail={openEditEmailProvider}
          onSetupSlack={openCreateSlackChannel}
        />
      </Card>

      <Card className="gap-0 py-0 ring-foreground/[0.07]">
        <section aria-labelledby="notification-channels-heading">
          <div className="flex flex-col gap-4 bg-foreground/[0.025] px-5 pb-5 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <Mail className="mt-0.5 size-6 shrink-0 text-amber-300" />
              <div>
                <h2 id="notification-channels-heading" className="font-heading text-lg font-semibold text-foreground">Notification channels</h2>
                <p className="mt-1 text-sm text-muted-foreground">Email, Slack, and webhook destinations.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-400/50 text-amber-300 hover:border-amber-400 hover:text-amber-200 sm:w-auto"
              onClick={openCreateChannel}
            >
              <Plus data-icon="inline-start" />
              Add channel
            </Button>
          </div>

          {channels.length === 0 ? (
            <>
              <Separator className="bg-foreground/[0.07]" />
              <Empty className="rounded-none border-0 py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Webhook /></EmptyMedia>
                  <EmptyTitle>No notification channels</EmptyTitle>
                  <EmptyDescription>Add an email, Slack, or webhook destination for your policies to use.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={openCreateChannel}>
                    <Plus data-icon="inline-start" />
                    Add channel
                  </Button>
                </EmptyContent>
              </Empty>
            </>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table aria-label="Notification channels" className="table-fixed">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col className="w-[11%]" />
                    <col className="w-[29%]" />
                    <col className="w-[13%]" />
                    <col className="w-[19%]" />
                    <col className="w-12" />
                  </colgroup>
                  <TableHeader className="bg-background/20 [&_tr]:border-foreground/[0.07]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={alertsTableHeadClassName}>Name</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Type</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Endpoint / recipient</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Status</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Last test</TableHead>
                      <TableHead className={cn(alertsTableHeadClassName, "px-2")}>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channels.map((channel) => {
                      const ChannelIcon = channelIcon(channel);
                      return (
                        <TableRow key={channel.id} className={alertsTableRowClassName}>
                          <TableCell className={cn(alertsTableCellClassName, "truncate font-medium text-foreground")}>
                            {channel.displayName}
                          </TableCell>
                          <TableCell className={alertsTableCellClassName}>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ChannelIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70" />
                              <span>{channelTypeLabel(channel)}</span>
                            </div>
                          </TableCell>
                          <TableCell className={cn(alertsTableCellClassName, "truncate text-sm text-muted-foreground")} title={channelAddress(channel)}>
                            {channelAddress(channel)}
                          </TableCell>
                          <TableCell className={alertsTableCellClassName}>
                            <span className="flex items-center gap-2 text-sm">
                              <span className={channel.enabled ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-muted-foreground"} />
                              {channel.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </TableCell>
                          <TableCell className={alertsTableCellClassName}>
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {channel.lastTestStatus === "succeeded" ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : null}
                              <span className="truncate">{channelTestLabel(channel)}</span>
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-4 text-right">
                            <Popover
                              open={openChannelMenuId === `desktop:${channel.id}`}
                              onOpenChange={(open) => setOpenChannelMenuId(open ? `desktop:${channel.id}` : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${channel.displayName}`}>
                                  <Ellipsis />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-44 gap-1 p-1.5">
                                <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => openEditChannel(channel)}>
                                  <Pencil data-icon="inline-start" />Edit
                                </Button>
                                <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void testChannel(channel)}>
                                  <FlaskConical data-icon="inline-start" />Test channel
                                </Button>
                                <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void updateChannel(channel, !channel.enabled)}>
                                  {channel.enabled ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                                  {channel.enabled ? "Disable" : "Enable"}
                                </Button>
                                <Button type="button" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => void deleteChannel(channel)}>
                                  <Trash2 data-icon="inline-start" />Delete
                                </Button>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ul aria-label="Notification channels" className="divide-y divide-foreground/[0.06] border-t border-foreground/[0.07] lg:hidden">
                {channels.map((channel) => {
                  const ChannelIcon = channelIcon(channel);
                  return (
                    <li key={channel.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{channel.displayName}</p>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                          <ChannelIcon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/70" />
                          <span>{channelTypeLabel(channel)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{channelAddress(channel)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><span className={channel.enabled ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-muted-foreground"} />{channel.enabled ? "Enabled" : "Disabled"}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1.5">{channel.lastTestStatus === "succeeded" ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : null}{channelTestLabel(channel)}</span>
                        </div>
                      </div>
                      <div>
                        <Popover
                          open={openChannelMenuId === `mobile:${channel.id}`}
                          onOpenChange={(open) => setOpenChannelMenuId(open ? `mobile:${channel.id}` : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${channel.displayName}`}>
                              <Ellipsis />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-44 gap-1 p-1.5">
                            <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => openEditChannel(channel)}>
                              <Pencil data-icon="inline-start" />Edit
                            </Button>
                            <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void testChannel(channel)}>
                              <FlaskConical data-icon="inline-start" />Test channel
                            </Button>
                            <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void updateChannel(channel, !channel.enabled)}>
                              {channel.enabled ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                              {channel.enabled ? "Disable" : "Enable"}
                            </Button>
                            <Button type="button" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => void deleteChannel(channel)}>
                              <Trash2 data-icon="inline-start" />Delete
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </Card>

      <Card className="gap-0 py-0 ring-foreground/[0.07]">
        <section aria-labelledby="alert-policies-heading">
          <div className="flex flex-col gap-4 bg-foreground/[0.025] px-5 pb-5 pt-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <Crosshair className="mt-0.5 size-6 shrink-0 text-amber-300" />
              <div>
                <h2 id="alert-policies-heading" className="font-heading text-lg font-semibold text-foreground">Alert policies</h2>
                <p className="mt-1 text-sm text-muted-foreground">Define what changes trigger alerts and where they are sent.</p>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full border-amber-400/50 text-amber-300 hover:border-amber-400 hover:text-amber-200 sm:w-auto" onClick={openCreatePolicy}>
              <Plus data-icon="inline-start" />Create policy
            </Button>
          </div>

          {policies.length === 0 ? (
            <>
              <Separator className="bg-foreground/[0.07]" />
              <Empty className="rounded-none border-0 py-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Crosshair /></EmptyMedia>
                  <EmptyTitle>No alert policies</EmptyTitle>
                  <EmptyDescription>Create a policy to connect matching scan changes to one or more channels.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={openCreatePolicy}>
                    <Plus data-icon="inline-start" />Create policy
                  </Button>
                </EmptyContent>
              </Empty>
            </>
          ) : (
            <>
              <div className="hidden lg:block">
                <Table aria-label="Alert policies" className="table-fixed">
                  <colgroup>
                    <col className="w-[31%]" />
                    <col className="w-[13%]" />
                    <col className="w-[16%]" />
                    <col className="w-[23%]" />
                    <col className="w-[13%]" />
                    <col className="w-12" />
                  </colgroup>
                  <TableHeader className="bg-background/20 [&_tr]:border-foreground/[0.07]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={alertsTableHeadClassName}>Policy</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Status</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Targets</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Change type</TableHead>
                      <TableHead className={alertsTableHeadClassName}>Channels</TableHead>
                      <TableHead className={cn(alertsTableHeadClassName, "px-2")}>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => {
                      const activeChannelCount = policy.channelIds.filter((channelId) => enabledChannelIds.has(channelId)).length;
                      const stateLabel = policy.state === "enabled" ? "Enabled" : policy.state === "paused" ? "Paused" : "Draft";
                      const channelCountLabel = activeChannelCount === 0
                        ? "No active channels"
                        : `${activeChannelCount} active ${activeChannelCount === 1 ? "channel" : "channels"}`;
                      return (
                        <TableRow key={policy.id} className={alertsTableRowClassName}>
                          <TableCell className={cn(alertsTableCellClassName, "truncate font-medium text-foreground")}>
                            {policy.name}
                          </TableCell>
                          <TableCell className={alertsTableCellClassName}>
                            <span className="flex items-center gap-2 text-sm">
                              <span className={policy.state === "enabled" ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-muted-foreground"} />
                              {stateLabel}
                            </span>
                          </TableCell>
                          <TableCell className={cn(alertsTableCellClassName, "text-sm text-muted-foreground")}>
                            {policyCoverageLabel(policy)}
                          </TableCell>
                          <TableCell className={cn(alertsTableCellClassName, "text-sm text-muted-foreground")}>
                            {policySelectionLabel(policy)}
                          </TableCell>
                          <TableCell className={cn(alertsTableCellClassName, "text-sm text-muted-foreground")}>
                            {channelCountLabel}
                          </TableCell>
                          <TableCell className="px-2 py-4 text-right">
                            <Popover
                              open={openPolicyMenuId === `desktop:${policy.id}`}
                              onOpenChange={(open) => setOpenPolicyMenuId(open ? `desktop:${policy.id}` : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${policy.name}`}><Ellipsis /></Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-44 gap-1 p-1.5">
                                <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => openEditPolicy(policy)}>
                                  <Pencil data-icon="inline-start" />Edit
                                </Button>
                                <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void updatePolicy(policy, policy.state === "enabled" ? "paused" : "enabled")}>
                                  {policy.state === "enabled" ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                                  {policy.state === "enabled" ? "Pause" : "Enable"}
                                </Button>
                                <Button type="button" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => void deletePolicy(policy)}>
                                  <Trash2 data-icon="inline-start" />Delete
                                </Button>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ul aria-label="Alert policies" className="divide-y divide-foreground/[0.06] border-t border-foreground/[0.07] lg:hidden">
                {policies.map((policy) => {
                  const activeChannelCount = policy.channelIds.filter((channelId) => enabledChannelIds.has(channelId)).length;
                  const stateLabel = policy.state === "enabled" ? "Enabled" : policy.state === "paused" ? "Paused" : "Draft";
                  const channelCountLabel = activeChannelCount === 0
                    ? "No active channels"
                    : `${activeChannelCount} active ${activeChannelCount === 1 ? "channel" : "channels"}`;
                  return (
                    <li key={policy.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{policy.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><span className={policy.state === "enabled" ? "size-2 rounded-full bg-emerald-400" : "size-2 rounded-full bg-muted-foreground"} />{stateLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{policyCoverageLabel(policy)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{policySelectionLabel(policy)}</span>
                          <span aria-hidden="true">·</span>
                          <span>{channelCountLabel}</span>
                        </div>
                      </div>
                      <div>
                        <Popover
                          open={openPolicyMenuId === `mobile:${policy.id}`}
                          onOpenChange={(open) => setOpenPolicyMenuId(open ? `mobile:${policy.id}` : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Actions for ${policy.name}`}><Ellipsis /></Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-44 gap-1 p-1.5">
                            <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => openEditPolicy(policy)}>
                              <Pencil data-icon="inline-start" />Edit
                            </Button>
                            <Button type="button" variant="ghost" className="w-full justify-start" disabled={busyAction !== null} onClick={() => void updatePolicy(policy, policy.state === "enabled" ? "paused" : "enabled")}>
                              {policy.state === "enabled" ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                              {policy.state === "enabled" ? "Pause" : "Enable"}
                            </Button>
                            <Button type="button" variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => void deletePolicy(policy)}>
                              <Trash2 data-icon="inline-start" />Delete
                            </Button>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </Card>

      <ResponsiveModal open={resendConsentModalOpen} onOpenChange={setResendConsentModalOpen}>
        <ResponsiveModalContent desktopClassName="max-w-lg overflow-hidden p-0" mobileClassName="overflow-hidden">
          <div className="flex flex-col">
            <ResponsiveModalHeader className="px-5 pt-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-6 sm:pt-6">
              <ResponsiveModalTitle className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.04] text-foreground">
                  <ResendMark className="size-7" />
                </span>
                Connect Resend
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                Resend delivers Stackray email alerts. Connect with sending access so Stackray can send from a domain you authorize.
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="space-y-3 px-5 py-5 sm:px-6">
              <div className="rounded-lg border border-foreground/10 p-4">
                <p className="font-medium">Permission</p>
                <p className="mt-1 text-sm text-muted-foreground">Choose <span className="text-foreground">Sending access</span>. Stackray only sends email and never needs to manage your Resend account.</p>
              </div>
              <div className="rounded-lg border border-foreground/10 p-4">
                <p className="font-medium">Domain</p>
                <p className="mt-1 text-sm text-muted-foreground">Choose one verified domain when possible. All domains also works; Stackray will still ask which exact domain to send from.</p>
              </div>
            </div>
            <ResponsiveModalFooter className="mx-0 mb-0 flex-col-reverse rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
              <Button type="button" variant="outline" onClick={() => setResendConsentModalOpen(false)}>Cancel</Button>
              <Button type="button" onClick={connectResend}>Continue to Resend</Button>
            </ResponsiveModalFooter>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={emailSetupModalOpen}
        onOpenChange={setEmailSetupModalOpen}
      >
        <ResponsiveModalContent
          desktopClassName="overflow-hidden p-0 sm:max-w-xl"
          mobileClassName="overflow-hidden"
        >
          <form className="flex max-h-[85vh] flex-col" onSubmit={saveEmailProvider}>
            <ResponsiveModalHeader className="px-5 pt-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-6 sm:pt-6">
              <ResponsiveModalTitle>{emailSetupSession ? "Finish email setup" : "Email delivery settings"}</ResponsiveModalTitle>
              <ResponsiveModalDescription className="flex items-center gap-2 text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400" />
                Connected to Resend
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <FieldGroup className="gap-6">
                <FieldSet>
                  <FieldLegend className="flex items-center gap-3 text-lg">
                    <span className="flex size-8 items-center justify-center rounded-full border border-foreground/15 bg-muted/40 text-sm text-muted-foreground">1</span>
                    Sender
                  </FieldLegend>
                  <Field data-invalid={Boolean(emailDomainError)}>
                    <FieldLabel htmlFor="resend-domain">Sending domain</FieldLabel>
                    <Input
                      id="resend-domain"
                      value={emailDomainName}
                      onChange={(event) => {
                        setEmailDomainName(event.target.value);
                        if (emailDomainError) setEmailDomainError(null);
                      }}
                      onBlur={() => {
                        if (emailDomainName && !isValidSendingDomain(emailDomainName)) {
                          setEmailDomainError(SENDING_DOMAIN_ERROR);
                        }
                      }}
                      placeholder="example.com"
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={Boolean(emailDomainError)}
                      required
                    />
                    {emailDomainError ? (
                      <FieldError>{emailDomainError}</FieldError>
                    ) : (
                      <FieldDescription>Use the exact domain authorized in Resend, such as example.com.</FieldDescription>
                    )}
                  </Field>
                  <FieldGroup className="rounded-lg border border-foreground/10 bg-background/20 p-3 sm:grid sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-3">
                    <Field>
                      <FieldLabel htmlFor="resend-sender-name">Sender name</FieldLabel>
                      <Input id="resend-sender-name" value={senderName} onChange={(event) => setSenderName(event.target.value)} required maxLength={100} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="resend-sender-local-part">From address</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="resend-sender-local-part" value={senderLocalPart} onChange={(event) => setSenderLocalPart(event.target.value)} required maxLength={64} />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText className="shrink-0">@{emailDomainName || "domain.com"}</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                {emailSetupSession?.oauthScope === "full_access" ? (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                    Resend granted Full access. Stackray only uses email sending. You can finish setup, or reconnect and choose Sending access for the narrowest grant.
                  </div>
                ) : null}
                {!emailSetupSession && emailProvider?.oauthScope === "full_access" ? (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                    This connection has Full access, although Stackray only uses email sending. Reconnect and choose Sending access to narrow it.
                  </div>
                ) : null}
                <Separator className="bg-foreground/10" />
                <FieldSet>
                  <FieldLegend className="flex items-center gap-3 text-lg">
                    <span className="flex size-8 items-center justify-center rounded-full border border-foreground/15 bg-muted/40 text-sm text-muted-foreground">2</span>
                    Test delivery
                  </FieldLegend>
                  <Field>
                    <FieldLabel htmlFor="resend-test-recipient">Test recipient</FieldLabel>
                    <Input id="resend-test-recipient" type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} required />
                  </Field>
                  {!emailSetupSession && emailProvider ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button type="button" variant="outline" disabled={busyAction !== null} onClick={() => void runEmailProviderTest()}>
                        <FlaskConical data-icon="inline-start" />Send test
                      </Button>
                      <p className={emailProvider.lastTestStatus === "failed" ? "text-sm text-destructive" : "flex items-center gap-1.5 text-sm text-emerald-400"}>
                        {emailProvider.lastTestStatus === "succeeded" ? <CheckCircle2 className="size-4" /> : null}
                        {emailProvider.lastTestStatus === "untested" || !emailProvider.lastTestedAt
                          ? "Not tested"
                          : `${emailProvider.lastTestStatus === "succeeded" ? "Passed" : "Failed"} ${shortDateFormat.format(new Date(emailProvider.lastTestedAt))}`}
                      </p>
                    </div>
                  ) : null}
                </FieldSet>
                {readiness.webhooks.missingEnvironmentVariables.includes("STACKRAY_ENCRYPTION_KEY") ? (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-muted-foreground">
                    Setup is allowed, but the Resend OAuth grant will be stored in Postgres without application-layer encryption until STACKRAY_ENCRYPTION_KEY is added.
                  </div>
                ) : null}
                {!emailSetupSession && emailProvider ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="button" variant="link" className="h-auto justify-start px-0 text-muted-foreground" disabled={busyAction !== null} onClick={() => setResendConsentModalOpen(true)}>
                      Reconnect Resend
                    </Button>
                    <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={busyAction !== null} onClick={() => void disconnectResend()}>
                      <Unplug data-icon="inline-start" />Disconnect Resend
                    </Button>
                  </div>
                ) : null}
              </FieldGroup>
            </div>
            <ResponsiveModalFooter className="mx-0 mb-0 flex-col-reverse rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
              <Button type="button" variant="outline" onClick={() => setEmailSetupModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busyAction !== null || !emailDomainName.trim()}>
                {emailSetupSession ? <CheckCircle2 data-icon="inline-start" /> : <Save data-icon="inline-start" />}
                {emailSetupSession ? "Connect and test" : "Save changes"}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={channelModalOpen}
        onOpenChange={(open) => {
          setChannelModalOpen(open);
          if (!open) resetChannelForm();
        }}
        drawerProps={{ repositionInputs: false }}
      >
        <ResponsiveModalContent
          desktopClassName="overflow-hidden p-0"
          mobileClassName="overflow-hidden"
        >
          <form className="flex max-h-[88svh] flex-col sm:max-h-[85vh]" onSubmit={saveChannel}>
            <ResponsiveModalHeader className="px-5 pt-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-6 sm:pt-6">
              <ResponsiveModalTitle>{editingChannel ? "Edit notification channel" : "Add notification channel"}</ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {editingChannel
                  ? "Update this channel without changing the policies that use it."
                  : "Add an email, Slack, or webhook destination that policies can use."}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 [scrollbar-gutter:stable] sm:px-6">
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">Type</FieldLegend>
                  <ToggleGroup
                    type="single"
                    spacing={1}
                    value={channelType}
                    onValueChange={(value) => {
                      if (value) setChannelType(value as "email" | "slack" | "webhook");
                    }}
                    variant="segmented"
                    className="grid w-full grid-cols-3"
                    aria-label="Notification channel type"
                  >
                    <ToggleGroupItem
                      value="email"
                      disabled={editingChannel !== null}
                      className="h-10 w-full"
                    >
                      <Mail data-icon="inline-start" />
                      Email
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="slack"
                      disabled={editingChannel !== null}
                      className="h-10 w-full"
                    >
                      <SlackMark data-icon="inline-start" />
                      Slack
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="webhook"
                      disabled={editingChannel !== null}
                      className="h-10 w-full"
                    >
                      <Webhook data-icon="inline-start" />
                      Webhook
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {editingChannel ? <FieldDescription>Channel type cannot be changed after creation.</FieldDescription> : null}
                </FieldSet>
                <AnimatedChannelFields panelKey={channelFormPanelKey}>
                  {emailChannelSetupRequired ? (
                  <Alert>
                    <Mail />
                    <AlertTitle>Email delivery is not connected</AlertTitle>
                    <AlertDescription className="flex flex-col items-start gap-3">
                      <p>Email notifications are delivered through Resend. Connect an account before adding email recipients.</p>
                      <Button type="button" variant="outline" size="sm" onClick={openResendSetupFromChannel}>
                        <Mail data-icon="inline-start" />
                        Connect Resend
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {channelType !== "slack" || editingSlack || slackManualOpen ? (
                      <Field><FieldLabel htmlFor="channel-name">Name</FieldLabel><Input id="channel-name" value={channelName} onChange={(event) => setChannelName(event.target.value)} required maxLength={100} /></Field>
                    ) : null}
                    {channelType === "email" ? (
                      <Field>
                        <FieldLabel htmlFor="channel-recipients">Recipients</FieldLabel>
                        <Input id="channel-recipients" type="text" value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="ops@example.com, security@example.com" required />
                        {readiness.email.status !== "ready" ? <FieldDescription>Connect Resend before enabling or testing this channel.</FieldDescription> : null}
                      </Field>
                    ) : channelType === "slack" ? (
                      <>
                        {!editingSlack && !slackManualOpen ? (
                          <Alert className="gap-y-1.5 px-4 py-3.5 has-[>svg]:gap-x-3 *:[svg]:translate-y-0">
                            <SlackMark className="mt-px size-5" />
                            <AlertTitle className="leading-5">Connect a Slack channel</AlertTitle>
                            <AlertDescription className="text-pretty leading-5">
                              <p>Slack will ask you to choose one workspace channel. Stackray requests only permission to post to that destination.</p>
                            </AlertDescription>
                          </Alert>
                        ) : editingSlack ? (
                          <Alert>
                            <SlackMark />
                            <AlertTitle>{editingSlack.config.connectionSource === "oauth" ? "Connected through Slack" : "Slack webhook connected"}</AlertTitle>
                            <AlertDescription className="flex flex-col items-start gap-3">
                              <p>Reconnect to choose another workspace or channel. Existing policies will keep using this destination.</p>
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" size="sm" disabled={busyAction !== null} onClick={() => void connectSlack()}>
                                  <SlackMark data-icon="inline-start" />
                                  Reconnect Slack
                                </Button>
                                {editingSlack.config.configurationUrl ? (
                                  <Button asChild type="button" variant="ghost" size="sm">
                                    <a href={editingSlack.config.configurationUrl} target="_blank" rel="noreferrer">Manage in Slack</a>
                                  </Button>
                                ) : null}
                              </div>
                            </AlertDescription>
                          </Alert>
                        ) : null}
                        {!editingSlack && !slackManualOpen ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => setSlackManualOpen(true)}
                          >
                            Use an incoming webhook instead
                          </Button>
                        ) : (
                          <>
                            {!editingSlack ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs uppercase tracking-wide text-muted-foreground">Incoming webhook</span>
                                <Button type="button" variant="link" size="sm" className="h-auto px-0 text-muted-foreground" onClick={() => setSlackManualOpen(false)}>
                                  Connect through Slack instead
                                </Button>
                              </div>
                            ) : null}
                            <Field>
                              <FieldLabel htmlFor="slack-channel-name">Slack channel</FieldLabel>
                              <InputGroup>
                                <InputGroupAddon><InputGroupText>#</InputGroupText></InputGroupAddon>
                                <InputGroupInput
                                  id="slack-channel-name"
                                  value={slackChannelName}
                                  onChange={(event) => setSlackChannelName(event.target.value.replace(/^#/, ""))}
                                  placeholder="security-alerts"
                                  required
                                  readOnly={editingSlack?.config.connectionSource === "oauth"}
                                />
                              </InputGroup>
                              {editingSlack?.config.connectionSource === "oauth" ? <FieldDescription>Reconnect Slack to choose another channel.</FieldDescription> : null}
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="slack-workspace-name">Workspace name (optional)</FieldLabel>
                              <Input
                                id="slack-workspace-name"
                                value={slackWorkspaceName}
                                onChange={(event) => setSlackWorkspaceName(event.target.value)}
                                placeholder="Acme"
                                maxLength={100}
                                readOnly={editingSlack?.config.connectionSource === "oauth"}
                              />
                            </Field>
                            {editingSlack?.config.connectionSource !== "oauth" ? (
                              <Field>
                                <FieldLabel htmlFor="slack-webhook-url">Incoming webhook URL{editingSlack ? " (optional)" : ""}</FieldLabel>
                                <Input id="slack-webhook-url" type="password" autoComplete="off" value={slackWebhookUrl} onChange={(event) => setSlackWebhookUrl(event.target.value)} placeholder={editingSlack ? "Leave blank to keep the saved webhook" : "https://hooks.slack.com/services/…"} required={!editingSlack} />
                                <FieldDescription>
                                  {editingSlack
                                    ? "The saved webhook is write-only. Enter a URL only to replace it manually."
                                    : <>Need a webhook? <a className="text-foreground underline underline-offset-4" href={slackManifestUrl} target="_blank" rel="noreferrer">Create a Stackray app in Slack</a>, install it to a channel, and copy its incoming webhook URL.</>}
                                </FieldDescription>
                              </Field>
                            ) : null}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Field>
                          <FieldLabel htmlFor="webhook-endpoint">HTTPS endpoint</FieldLabel>
                          <Input id="webhook-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} required={!editingWebhook} placeholder={editingWebhook ? `Leave blank to keep ${editingWebhook.config.hostname}` : undefined} />
                          {editingWebhook ? <FieldDescription>The saved URL is write-only. Enter a new URL only to replace it.</FieldDescription> : null}
                        </Field>
                        <Field data-disabled={clearAuthorization || undefined}>
                          <FieldLabel htmlFor="webhook-authorization">Authorization header (optional)</FieldLabel>
                          <Input id="webhook-authorization" type="password" autoComplete="off" value={authorization} onChange={(event) => setAuthorization(event.target.value)} placeholder={editingWebhook?.config.hasAuthorizationHeader ? "Leave blank to keep the saved header" : "Bearer …"} disabled={clearAuthorization} />
                          {editingWebhook?.config.hasAuthorizationHeader ? (
                            <Label className="flex items-center gap-2 font-normal text-muted-foreground">
                              <Checkbox checked={clearAuthorization} onCheckedChange={(checked) => setClearAuthorization(checked === true)} />
                              Remove saved authorization header
                            </Label>
                          ) : null}
                        </Field>
                        <Field data-disabled={clearSigningSecret || undefined}>
                          <FieldLabel htmlFor="webhook-secret">Signing secret (optional)</FieldLabel>
                          <Input id="webhook-secret" type="password" autoComplete="new-password" minLength={16} value={signingSecret} onChange={(event) => setSigningSecret(event.target.value)} placeholder={editingWebhook?.config.hasSigningSecret ? "Leave blank to keep the saved secret" : undefined} disabled={clearSigningSecret} />
                          {editingWebhook?.config.hasSigningSecret ? (
                            <Label className="flex items-center gap-2 font-normal text-muted-foreground">
                              <Checkbox checked={clearSigningSecret} onCheckedChange={(checked) => setClearSigningSecret(checked === true)} />
                              Remove saved signing secret
                            </Label>
                          ) : null}
                        </Field>
                      </>
                    )}
                  </>
                  )}
                </AnimatedChannelFields>
              </FieldGroup>
            </div>
            <ResponsiveModalFooter
              className={cn(
                "mx-0 mb-0 rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5",
                editingChannel ? "flex-row" : "flex-col-reverse",
              )}
            >
              <Button
                type="button"
                variant="outline"
                className={editingChannel ? "flex-1 sm:flex-none" : undefined}
                onClick={() => setChannelModalOpen(false)}
              >
                Cancel
              </Button>
              {channelType === "slack" && !editingSlack && !slackManualOpen ? (
                <Button type="button" disabled={busyAction !== null} onClick={() => void connectSlack()}>
                  <SlackMark data-icon="inline-start" />
                  Connect Slack
                </Button>
              ) : !emailChannelSetupRequired ? (
                <Button
                  type="submit"
                  className={editingChannel ? "flex-1 sm:flex-none" : undefined}
                  disabled={busyAction !== null}
                >
                  {editingChannel ? <Save data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  {editingChannel ? "Save changes" : "Create channel"}
                </Button>
              ) : null}
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={policyModalOpen}
        onOpenChange={(open) => {
          setPolicyModalOpen(open);
          if (!open) resetPolicyForm();
        }}
        drawerProps={{ repositionInputs: false }}
      >
        <ResponsiveModalContent
          desktopClassName={cn(
            "sm:w-[calc(100vw-3rem)] overflow-hidden p-0 transition-[max-width] duration-200",
            targetPickerOpen ? "sm:max-w-4xl" : "sm:max-w-7xl",
          )}
          mobileClassName="overflow-hidden"
        >
          <form
            className={cn(
              "flex max-h-[88svh] min-h-0 flex-col",
              targetPickerOpen && "min-h-[56svh] md:min-h-0",
            )}
            onSubmit={savePolicy}
          >
            <ResponsiveModalHeader
              className={cn(
                changeTypePickerOpen || targetPickerOpen
                  ? "sr-only"
                  : "sr-only md:not-sr-only md:px-7 md:pt-7 md:text-left",
              )}
            >
              <ResponsiveModalTitle>
                {targetPickerOpen
                  ? "Choose which websites can trigger this policy."
                  : changeTypePickerOpen
                    ? "Choose which website changes should send notifications."
                  : editingPolicy ? "Edit alert policy" : "Create alert policy"}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription>
                {targetPickerOpen
                  ? "Search for one or more scanned targets for this alert policy."
                  : changeTypePickerOpen
                    ? "Select one or more recorded change types for this alert policy."
                  : editingPolicy
                    ? "Update what triggers this policy and where its notifications are sent."
                    : "Choose the targets, website changes, and notification channels for this policy."}
              </ResponsiveModalDescription>
            </ResponsiveModalHeader>
            {targetPickerOpen ? (
              <TargetPicker
                selectedTargetIds={selectedTargets}
                selectedTargetOptions={selectedTargetOptions}
                searchResults={displayedTargetOptions}
                search={targetSearch}
                pending={displayedTargetSearchPending}
                error={targetSearchError}
                onSearchChange={(value) => {
                  setTargetSearch(value);
                  setTargetOptions([]);
                  setTargetSearchError(null);
                }}
                onSelectedTargetIdsChange={setSelectedTargets}
                onBack={closeTargetPicker}
              />
            ) : changeTypePickerOpen ? (
              <ChangeTypePicker
                changeTypes={changeTypes}
                onChangeTypesChange={setChangeTypes}
                onBack={closeChangeTypePicker}
              />
            ) : (
              <div
                ref={policyFormScrollRef}
                data-slot="policy-form-scroll"
                className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6"
              >
              {enabledChannels.length === 0 ? (
                <div className="mb-5 flex flex-col items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
                  <p className="text-muted-foreground">Create and enable a notification channel before enabling a policy.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setPolicyModalOpen(false); openCreateChannel(); }}><Plus data-icon="inline-start" />Add channel</Button>
                </div>
              ) : null}
              <div className="grid items-start gap-8 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-foreground/[0.08]">
                <section className="flex min-w-0 flex-col gap-6 lg:pr-7">
                  <PolicySectionHeading number={1} title="Targets" description="Choose which websites can trigger this policy." />
                  <FieldGroup>
                    <FieldSet>
                      <FieldLegend className="sr-only">Target coverage</FieldLegend>
                      <ToggleGroup
                        type="single"
                        value={coverage}
                        onValueChange={(value) => {
                          if (!value) return;
                          setCoverage(value as typeof coverage);
                          if (value !== "selected_targets") closeTargetPicker();
                        }}
                        variant="outline"
                        orientation="vertical"
                        className="w-full items-stretch gap-3"
                        aria-label="Alert target coverage"
                      >
                        <PolicyCompoundChoice
                          value="all_targets"
                          title="All targets"
                          description="Any scanned target can trigger this policy."
                          selected={coverage === "all_targets"}
                        />
                        <PolicyCompoundChoice
                          value="selected_targets"
                          title="Selected targets"
                          description="Only websites you choose can trigger this policy."
                          selected={coverage === "selected_targets"}
                          summary={`${selectedTargets.length} ${selectedTargets.length === 1 ? "target" : "targets"} selected`}
                          actionLabel={selectedTargets.length > 0 ? "Edit targets" : "Select targets"}
                          onAction={openTargetPicker}
                        />
                      </ToggleGroup>
                    </FieldSet>
                  </FieldGroup>
                </section>

                <section className="flex min-w-0 flex-col gap-6 border-t border-foreground/[0.08] pt-8 lg:border-t-0 lg:px-7 lg:pt-0">
                  <PolicySectionHeading number={2} title="Changes" description="Choose which website changes should send alerts." />
                  <FieldSet>
                    <FieldLegend className="sr-only">Change selection</FieldLegend>
                    <ToggleGroup
                      type="single"
                      value={selectionMode}
                      onValueChange={(value) => {
                        if (!value) return;
                        setSelectionMode(value as typeof selectionMode);
                        if (value !== "selected") closeChangeTypePicker();
                      }}
                      variant="outline"
                      orientation="vertical"
                      className="w-full items-stretch gap-3"
                      aria-label="Alert change selection"
                    >
                      <PolicyCompoundChoice
                        value="all"
                        title="Every change"
                        description="Includes all recorded changes, even high-frequency fingerprints and metadata."
                        selected={selectionMode === "all"}
                      />
                      <PolicyCompoundChoice
                        value="selected"
                        title="Choose change types"
                        description="Select the exact types that should send notifications."
                        selected={selectionMode === "selected"}
                        summary={`${changeTypes.length} ${changeTypes.length === 1 ? "type" : "types"} selected`}
                        actionLabel={changeTypes.length > 0 ? "Edit types" : "Select types"}
                        onAction={openChangeTypePicker}
                      />
                    </ToggleGroup>
                  </FieldSet>
                </section>

                <section className="flex min-w-0 flex-col gap-6 border-t border-foreground/[0.08] pt-8 lg:border-t-0 lg:pl-7 lg:pt-0">
                  <PolicySectionHeading number={3} title="Delivery" description="Choose when and where Stackray sends the alert." />
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="cooldown">Cooldown</FieldLabel>
                      <InputGroup>
                        <InputGroupInput id="cooldown" type="number" min={0} max={43200} value={cooldownMinutes} onChange={(event) => setCooldownMinutes(event.target.value)} />
                        <InputGroupAddon align="inline-end"><InputGroupText>minutes</InputGroupText></InputGroupAddon>
                      </InputGroup>
                      <FieldDescription>Wait this long before this policy sends another alert.</FieldDescription>
                    </Field>
                    <FieldSet>
                      <FieldLegend variant="label">Notification channels</FieldLegend>
                      <FieldDescription>Select at least one destination.</FieldDescription>
                      <FieldGroup className="gap-3">
                        {selectablePolicyChannels.map((channel) => {
                          const checked = selectedChannels.includes(channel.id);
                          const ChannelIcon = channelIcon(channel);
                          return (
                            <Label key={channel.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/10 p-4 font-normal transition-colors", checked && "border-primary/50 bg-primary/[0.06]")}>
                              <Checkbox checked={checked} onCheckedChange={(value) => setSelectedChannels((ids) => value ? [...new Set([...ids, channel.id])] : ids.filter((id) => id !== channel.id))} />
                              <ChannelIcon className={cn("mt-0.5 size-5 shrink-0", checked ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-foreground">{channel.displayName}</span>
                                  {!channel.enabled ? <span className="text-xs text-muted-foreground">Disabled</span> : null}
                                </span>
                                <span className="mt-1 block truncate text-sm text-muted-foreground">{channelAddress(channel)}</span>
                              </span>
                            </Label>
                          );
                        })}
                        {selectablePolicyChannels.length === 0 ? <span className="text-sm text-muted-foreground">No enabled channels.</span> : null}
                      </FieldGroup>
                    </FieldSet>
                  </FieldGroup>
                </section>
              </div>
              </div>
            )}
            <ResponsiveModalFooter
              className={cn(
                "mx-0 mb-0 rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5",
                changeTypePickerOpen || targetPickerOpen ? "flex-row" : "flex-col-reverse sm:flex-row",
              )}
            >
              {targetPickerOpen ? (
                <Button
                  type="button"
                  className="flex-1 sm:flex-none"
                  disabled={selectedTargets.length === 0}
                  onClick={closeTargetPicker}
                >
                  Done selecting · {selectedTargets.length}
                </Button>
              ) : changeTypePickerOpen ? (
                <Button
                  type="button"
                  className="flex-1 sm:flex-none"
                  disabled={changeTypes.length === 0}
                  onClick={closeChangeTypePicker}
                >
                  Done selecting · {changeTypes.length}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setPolicyModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={policySubmitDisabled}>
                    {editingPolicy ? <Save data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                    {editingPolicy ? "Save changes" : "Enable policy"}
                  </Button>
                </>
              )}
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <DemoDeploymentPrompt
        open={demoDeploymentOpen}
        onOpenChange={setDemoDeploymentOpen}
        source={demoDeploymentSource}
        title="Alerting needs your own deployment"
        description="This shared demo is read-only. Launch your own Stackray instance to connect private destinations and enable change-alert policies."
        features={[
          { icon: Mail, label: "Email and Slack channels" },
          { icon: Webhook, label: "Signed webhooks" },
          { icon: Crosshair, label: "Custom alert policies" },
        ]}
      />
    </div>
  );
}
