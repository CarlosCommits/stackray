import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { 
  Building2,
  Save,
  Shield,
  Database,
  Eye,
} from "lucide-react"

const scanPolicies = [
  { id: "allow-public", label: "Allow public targets only", description: "Block scans of private/internal IPs" },
  { id: "rate-limit", label: "Enable rate limiting", description: "Max 100 scans per hour per workspace" },
  { id: "notify-failures", label: "Notify on scan failures", description: "Send alerts when scans fail" },
]

const retentionOptions = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "forever", label: "Forever" },
]

export default function WorkspaceSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Workspace Settings
          </h1>
        </div>
        <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent)]" />
              General
            </CardTitle>
            <CardDescription className="text-[var(--text-dim)]">
              Basic workspace configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name" className="text-[var(--foreground)]">
                Workspace Name
              </Label>
              <Input 
                id="workspace-name"
                defaultValue="Stackray"
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-profile" className="text-[var(--foreground)]">
                Default Scan Profile
              </Label>
              <Input 
                id="default-profile"
                defaultValue="standard"
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
              />
              <p className="text-xs text-[var(--text-dim)]">
                Profile used when no specific profile is requested
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--accent)]" />
              Scan Policy
            </CardTitle>
            <CardDescription className="text-[var(--text-dim)]">
              Control what can be scanned and how
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scanPolicies.map((policy) => (
                <div key={policy.id} className="flex items-start justify-between">
                  <div>
                    <Label className="text-[var(--foreground)]">{policy.label}</Label>
                    <p className="text-xs text-[var(--text-dim)]">{policy.description}</p>
                  </div>
                  <Switch 
                    defaultChecked={policy.id !== "notify-failures"}
                    className="data-[state=checked]:bg-[var(--accent)]"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent)]" />
              Data Retention
            </CardTitle>
            <CardDescription className="text-[var(--text-dim)]">
              How long to keep scan results and history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--foreground)]">Scan Results Retention</Label>
              <div className="flex gap-2">
                {retentionOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={option.value === "90" ? "default" : "outline"}
                    size="sm"
                    className={option.value === "90" 
                      ? "bg-[var(--accent)] text-[var(--primary-foreground)]" 
                      : "border-[var(--gray-border)] text-[var(--text-dim)]"
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <Separator className="bg-[var(--gray-border)]" />
            <div className="space-y-2">
              <Label className="text-[var(--foreground)]">Event History Retention</Label>
              <div className="flex gap-2">
                {retentionOptions.slice(0, 4).map((option) => (
                  <Button
                    key={option.value}
                    variant={option.value === "365" ? "default" : "outline"}
                    size="sm"
                    className={option.value === "365" 
                      ? "bg-[var(--accent)] text-[var(--primary-foreground)]" 
                      : "border-[var(--gray-border)] text-[var(--text-dim)]"
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--accent)]" />
              Audit & Visibility
            </CardTitle>
            <CardDescription className="text-[var(--text-dim)]">
              Control who can see what in your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <Label className="text-[var(--foreground)]">Public scan history</Label>
                <p className="text-xs text-[var(--text-dim)]">
                  Allow team members to view each other&apos;s scan history
                </p>
              </div>
              <Switch className="data-[state=checked]:bg-[var(--accent)]" />
            </div>
            <div className="flex items-start justify-between">
              <div>
                <Label className="text-[var(--foreground)]">Detailed audit logs</Label>
                <p className="text-xs text-[var(--text-dim)]">
                  Log all API and UI actions for compliance
                </p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[var(--accent)]" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
