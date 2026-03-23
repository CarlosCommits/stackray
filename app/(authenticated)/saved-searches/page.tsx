import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Bookmark,
  Plus,
  Pin,
  Trash2,
  Search,
  Edit3
} from "lucide-react"

const savedSearches = [
  {
    id: "search-001",
    name: "fintech-stack-24",
    query: "technology:React AND technology:Node.js AND (stripe OR plaid OR dwolla)",
    resultCount: 42,
    isPinned: true,
    lastRun: "2024-05-21 10:30",
  },
  {
    id: "search-002",
    name: "crypto-vuln-map",
    query: "technology:WordPress AND (crypto OR blockchain OR wallet)",
    resultCount: 105,
    isPinned: true,
    lastRun: "2024-05-20 16:45",
  },
  {
    id: "search-003",
    name: "high-traffic-us-east",
    query: "cdn:Cloudflare AND server:nginx AND region:us-east",
    resultCount: 12,
    isPinned: false,
    lastRun: "2024-05-19 09:15",
  },
  {
    id: "search-004",
    name: "ecommerce-platforms",
    query: "technology:Shopify OR technology:Magento OR technology:WooCommerce",
    resultCount: 238,
    isPinned: false,
    lastRun: "2024-05-18 14:20",
  },
]

export default function SavedSearchesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
            Saved Searches
          </h1>
        </div>
        <Button className="bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--primary-foreground)]">
          <Plus className="w-4 h-4 mr-2" />
          New Search
        </Button>
      </div>

      <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
            <Input 
              placeholder="Filter saved searches..."
              className="pl-10 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)] placeholder:text-[var(--text-dim)]/50"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {savedSearches.map((search) => (
              <div 
                key={search.id}
                className="flex items-center gap-4 p-4 bg-[var(--surface-mid)] border border-[var(--gray-border)] rounded-lg hover:border-[var(--accent)]/40 transition-colors group"
              >
                <div className="flex-shrink-0">
                  <Bookmark className={`w-5 h-5 ${search.isPinned ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-mono text-sm text-[var(--foreground)] font-medium">
                      {search.name}
                    </h3>
                    {search.isPinned && (
                      <Pin className="w-3 h-3 text-[var(--accent)]" />
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-[var(--text-dim)] truncate">
                    {search.query}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-lg font-bold text-[var(--accent)] data-value">
                      {search.resultCount}
                    </span>
                    <span className="text-[10px] text-[var(--text-dim)] ml-1">results</span>
                  </div>
                  <div className="h-8 w-px bg-[var(--gray-border)]" />
                  <div className="text-[10px] font-mono text-[var(--text-dim)]">
                    Last run:<br />{search.lastRun}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[var(--text-dim)] hover:text-[var(--accent)]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[var(--text-dim)] hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
