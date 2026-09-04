"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";

const railwayCliCommand = `STACKRAY_KEY="$(openssl rand -hex 32)"
railway variable set --service Stackray-website "STACKRAY_ENCRYPTION_KEY=$STACKRAY_KEY"
railway variable set --service worker-intel 'STACKRAY_ENCRYPTION_KEY=\${{Stackray-website.STACKRAY_ENCRYPTION_KEY}}'`;

export function WebhookEncryptionNotice() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyRailwayCommand = async () => {
    await navigator.clipboard.writeText(railwayCliCommand);
    setCopied(true);
    toast.success("Railway commands copied");
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <>
      <Alert className="border-amber-500/30 bg-amber-500/6 px-4 py-3 text-amber-100">
        <ShieldAlert className="size-5 text-amber-300" />
        <AlertDescription className="flex flex-col items-start gap-2 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Notification credentials are stored without application-layer encryption.</span>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 text-amber-300 hover:text-amber-200" onClick={() => setOpen(true)}>
            Enable encryption
            <ArrowRight data-icon="inline-end" />
          </Button>
        </AlertDescription>
      </Alert>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent
          desktopClassName="max-h-[85vh] max-w-2xl overflow-y-auto p-0"
          mobileClassName="overflow-y-auto"
        >
          <ResponsiveModalHeader className="px-5 pb-4 pt-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-6 sm:pt-6">
            <ResponsiveModalTitle className="text-lg font-semibold">Encrypt notification credentials</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Add one stable 64-character hexadecimal key to every service that saves, tests, or delivers notifications.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="flex flex-col gap-6 border-t border-[var(--gray-border)]/50 px-5 py-5 sm:px-6">
            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-[var(--foreground)]">General setup</h3>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-[var(--text-dim)]">
                <li>Generate a key with <code className="rounded bg-black/25 px-1.5 py-0.5 text-[var(--foreground)]">openssl rand -hex 32</code>.</li>
                <li>Add it as <code className="text-amber-300">STACKRAY_ENCRYPTION_KEY</code> to the Next.js app and to the worker that delivers alerts: the <code>intel</code> worker or a single <code>all</code>-role worker.</li>
                <li>Use the exact same value in both services, then restart or redeploy them.</li>
              </ol>
              <p className="text-xs text-[var(--text-dim)]">After the key is added, new credentials are encrypted immediately. Existing plaintext webhook and Resend credentials are encrypted the next time they are used.</p>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-[var(--foreground)]">Railway</h3>
              <p className="text-sm text-[var(--text-dim)]">
                In your Railway project, create <code className="text-amber-300">STACKRAY_ENCRYPTION_KEY</code> and share it with <code>Stackray-website</code> and <code>worker-intel</code>. If your deployment uses one general worker, share it with that worker instead. Deploy the staged changes for every affected service.
              </p>
              <p className="text-xs text-[var(--text-dim)]">Run <code>railway link</code> first. Replace the service names below if your project uses different names.</p>
              <div className="relative rounded-lg border border-[var(--gray-border)] bg-black/25 p-3 pr-11">
                <pre className="overflow-x-auto whitespace-pre text-xs leading-5 text-[var(--foreground)]"><code>{railwayCliCommand}</code></pre>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-2 top-2"
                  aria-label="Copy Railway commands"
                  onClick={() => void copyRailwayCommand()}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-[var(--foreground)]">Railway template values</h3>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg border border-[var(--gray-border)] bg-black/20 p-3">
                  <p className="mb-1 text-[var(--text-dim)]">Website value</p>
                  <code className="break-all text-amber-300">{'${{secret(64, "abcdef0123456789")}}'}</code>
                </div>
                <div className="rounded-lg border border-[var(--gray-border)] bg-black/20 p-3">
                  <p className="mb-1 text-[var(--text-dim)]">Worker reference</p>
                  <code className="break-all text-amber-300">{"${{Stackray-website.STACKRAY_ENCRYPTION_KEY}}"}</code>
                </div>
              </div>
            </section>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
