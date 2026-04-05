import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  Clock,
  Shield
} from "lucide-react"

const tokens = [
  {
    id: "token-001",
    name: "Production API Key",
    prefix: "sr_live_",
    scopes: ["read:scans", "write:scans", "read:history"],
    lastUsed: "2024-05-21 14:02",
    createdAt: "2024-05-01 09:30",
    isActive: true,
  },
  {
    id: "token-002",
    name: "CI/CD Integration",
    prefix: "sr_live_",
    scopes: ["read:scans", "write:scans"],
    lastUsed: "2024-05-21 12:15",
    createdAt: "2024-05-10 16:45",
    isActive: true,
  },
  {
    id: "token-003",
    name: "Development Testing",
    prefix: "sr_test_",
    scopes: ["read:scans", "read:history"],
    lastUsed: "2024-05-20 18:30",
    createdAt: "2024-05-15 11:20",
    isActive: false,
  },
]

export default function TokensPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]">
          <Plus className="w-4 h-4 mr-2" />
          Create Token
        </Button>
      </div>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Active Tokens</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Manage API tokens for programmatic access to Stackray
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tokens.map((token) => (
              <div 
                key={token.id}
                className="flex items-start gap-4 p-4 bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded-lg"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-[var(--accent)]/10 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-[var(--accent)]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-[var(--foreground)]">
                      {token.name}
                    </h3>
                    {!token.isActive && (
                      <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-400">
                        Revoked
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-[10px] font-mono bg-[var(--surface-dark)] px-2 py-1 rounded text-[var(--text-dim)]">
                      {token.prefix}••••••••••••
                    </code>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--text-dim)] hover:text-[var(--accent)]">
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--text-dim)] hover:text-[var(--accent)]">
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {token.scopes.map((scope) => (
                      <Badge 
                        key={scope}
                        variant="outline" 
                        className="text-[9px] px-1.5 py-0 border-[var(--gray-border)] text-[var(--text-dim)]"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={token.isActive}
                      className="data-[state=checked]:bg-[var(--accent)]"
                    />
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-[var(--text-dim)] hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--text-dim)] text-right">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last used: {token.lastUsed}
                    </div>
                    <div>Created: {token.createdAt}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[var(--accent)]" />
            Token Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[var(--foreground)]">Auto-expire inactive tokens</Label>
              <p className="text-xs text-[var(--text-dim)]">
                Automatically revoke tokens unused for 90 days
              </p>
            </div>
            <Switch className="data-[state=checked]:bg-[var(--accent)]" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[var(--foreground)]">Require IP whitelist</Label>
              <p className="text-xs text-[var(--text-dim)]">
                Restrict token usage to specific IP addresses
              </p>
            </div>
            <Switch className="data-[state=checked]:bg-[var(--accent)]" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
