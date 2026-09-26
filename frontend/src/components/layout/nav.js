import {
  LayoutDashboard,
  ClipboardList,
  FolderOpen,
  Activity,
  LifeBuoy,
  Bell,
  User,
  PhoneCall,
  ListOrdered,
  Layers,
  AlertOctagon,
  UserCheck,
  Eye,
  ArrowUpCircle,
  CheckCircle2,
  BarChart3,
  HeartHandshake,
  TrendingUp,
  ScrollText,
} from "lucide-react";

// Sidebar navigation configs. Labels use production UI terminology
// (Complainant / Officer) — never Patient / Doctor.
export const NAV_COMPLAINANT = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/intake", label: "Start New Assessment", icon: ClipboardList },
  { to: "/cases", label: "My Cases", icon: FolderOpen },
  { to: "/cases/latest", label: "Case Status", icon: Activity },
  { to: "/support", label: "Support & Referrals", icon: LifeBuoy },
  { to: "/updates", label: "Messages / Updates", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/help", label: "Help & Emergency", icon: PhoneCall },
];

export const NAV_OFFICER = [
  {
    section: "Workspace",
    items: [
      { to: "/command", label: "Dashboard", icon: LayoutDashboard },
      { to: "/command/queue", label: "Priority Queue", icon: ListOrdered },
      { to: "/command/cases", label: "All Cases", icon: Layers },
      { to: "/command/critical", label: "Critical Cases", icon: AlertOctagon },
      { to: "/command/assigned", label: "Assigned to Me", icon: UserCheck },
      { to: "/command/review", label: "Needs Review", icon: Eye },
      { to: "/command/escalated", label: "Escalated", icon: ArrowUpCircle },
      { to: "/command/resolved", label: "Resolved Cases", icon: CheckCircle2 },
    ],
  },
  {
    section: "Insights",
    items: [
      { to: "/command/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/command/pathways", label: "Support Pathways", icon: HeartHandshake },
      { to: "/command/trends", label: "Assessment Trends", icon: TrendingUp },
    ],
  },
  {
    section: "System",
    items: [
      { to: "/command/notifications", label: "Notifications", icon: Bell },
      { to: "/command/audit", label: "Audit Trail", icon: ScrollText },
      { to: "/command/profile", label: "Profile", icon: User },
    ],
  },
];
