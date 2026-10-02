// Next.js app-router route folder. content.ts / content-b.ts both export a
// `content` const (A/B variants) consumed directly by page.tsx with aliases, so
// they cannot be star-re-exported here. Route files are imported by Next.js
// convention; this index exists to mark the folder's public API.
export type { AgentPageContent } from "./content-a.js"
