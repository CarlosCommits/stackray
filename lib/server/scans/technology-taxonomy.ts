export type TechnologyBucketId =
  | "platform"
  | "framework"
  | "infrastructure"
  | "business"
  | "security"
  | "ecosystem"
  | "other"

const technologyCategoryBucketEntries: ReadonlyArray<readonly [string, TechnologyBucketId]> = [
  ["CMS", "platform"],
  ["Message boards", "platform"],
  ["Documentation", "platform"],
  ["Wikis", "platform"],
  ["Blogs", "platform"],
  ["Issue trackers", "platform"],
  ["LMS", "platform"],
  ["Search engines", "platform"],
  ["Webmail", "platform"],
  ["DMS", "platform"],
  ["Page builders", "platform"],
  ["Static site generator", "platform"],
  ["Domain parking", "platform"],
  ["Ecommerce", "platform"],
  ["JavaScript frameworks", "framework"],
  ["Web frameworks", "framework"],
  ["Mobile frameworks", "framework"],
  ["UI frameworks", "framework"],
  ["Ecommerce frontends", "framework"],
  ["Database managers", "infrastructure"],
  ["Hosting panels", "infrastructure"],
  ["Web servers", "infrastructure"],
  ["Caching", "infrastructure"],
  ["Programming languages", "infrastructure"],
  ["Operating systems", "infrastructure"],
  ["CDN", "infrastructure"],
  ["Web server extensions", "infrastructure"],
  ["Databases", "infrastructure"],
  ["Network devices", "infrastructure"],
  ["Media servers", "infrastructure"],
  ["CI", "infrastructure"],
  ["Control systems", "infrastructure"],
  ["Remote access", "infrastructure"],
  ["Network storage", "infrastructure"],
  ["Containers", "infrastructure"],
  ["PaaS", "infrastructure"],
  ["IaaS", "infrastructure"],
  ["Reverse proxies", "infrastructure"],
  ["Load balancers", "infrastructure"],
  ["Hosting", "infrastructure"],
  ["Performance", "infrastructure"],
  ["Analytics", "business"],
  ["Marketing automation", "business"],
  ["Advertising", "business"],
  ["Payment processors", "business"],
  ["Tag managers", "business"],
  ["Live chat", "business"],
  ["CRM", "business"],
  ["SEO", "business"],
  ["Accounting", "business"],
  ["User onboarding", "business"],
  ["Affiliate programs", "business"],
  ["Appointment scheduling", "business"],
  ["Surveys", "business"],
  ["A/B Testing", "business"],
  ["Email", "business"],
  ["Personalisation", "business"],
  ["Retargeting", "business"],
  ["RUM", "business"],
  ["Loyalty & rewards", "business"],
  ["Feature management", "business"],
  ["Segmentation", "business"],
  ["Translation", "business"],
  ["Reviews", "business"],
  ["Buy now pay later", "business"],
  ["Reservations & delivery", "business"],
  ["Referral marketing", "business"],
  ["Digital asset management", "business"],
  ["Content curation", "business"],
  ["Customer data platform", "business"],
  ["Cart abandonment", "business"],
  ["Shipping carriers", "business"],
  ["Recruitment & staffing", "business"],
  ["Returns", "business"],
  ["Ticket booking", "business"],
  ["Cross border ecommerce", "business"],
  ["Fulfilment", "business"],
  ["Form builders", "business"],
  ["Fundraising & donations", "business"],
  ["Geolocation", "business"],
  ["Comment systems", "business"],
  ["Security", "security"],
  ["Cryptominers", "security"],
  ["Cookie compliance", "security"],
  ["Authentication", "security"],
  ["SSL/TLS certificate authorities", "security"],
  ["Browser fingerprinting", "security"],
  ["WordPress themes", "ecosystem"],
  ["Shopify themes", "ecosystem"],
  ["Drupal themes", "ecosystem"],
  ["WordPress plugins", "ecosystem"],
  ["Shopify apps", "ecosystem"],
  ["Widgets", "other"],
  ["Photo galleries", "other"],
  ["Video players", "other"],
  ["Font scripts", "other"],
  ["Miscellaneous", "other"],
  ["Editors", "other"],
  ["Rich text editors", "other"],
  ["JavaScript graphics", "other"],
  ["Maps", "other"],
  ["Webcams", "other"],
  ["Development", "other"],
  ["Feed readers", "other"],
  ["JavaScript libraries", "other"],
  ["Accessibility", "other"],
  ["Livestreaming", "other"],
  ["Augmented reality", "other"],
] as const

const categoryBucketMap = new Map<string, TechnologyBucketId>(technologyCategoryBucketEntries)

export function getMappedTechnologyCategories() {
  return new Set(technologyCategoryBucketEntries.map(([category]) => category))
}

export function resolveTechnologyBucket(name: string, categories: readonly string[]): TechnologyBucketId {
  for (const category of categories) {
    const bucket = categoryBucketMap.get(category)

    if (bucket) {
      return bucket
    }
  }

  if (/wordpress (plugin|theme)/i.test(name)) {
    return "ecosystem"
  }

  return "other"
}
