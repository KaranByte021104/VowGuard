import { useState, useEffect } from "react";
import {
  Users,
  Key,
  Share2,
  Folder,
  Cloud,
  Download,
  Info,
} from "lucide-react";
import { useSessionStore } from "../store/session";
import { apiFetch } from "../lib/apiFetch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const COLORS = [
  "#0ea5e9",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
];

export function Dashboard() {
  const { user } = useSessionStore();
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"personal" | "team">("personal");
  const [actionRange, setActionRange] = useState("Last 7 Days");

  useEffect(() => {
    apiFetch("http://localhost:3000/reports", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const handleExport = (format: "csv" | "pdf") => {
    window.location.href = `http://localhost:3000/reports/export?format=${format}`;
  };

  if (!stats)
    return (
      <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>
    );

  const currentStats = activeTab === "personal" ? stats.personal : stats.team;
  const assessment = currentStats?.assessment || {
    score: 0,
    weak: 0,
    reused: 0,
    containsUsername: 0,
    old: 0,
    dictionary: 0,
    recycled: 0,
  };
  const categories = currentStats?.categories || {};

  const overviewData = [
    { name: "Owned", value: stats.overview.owned, fill: "var(--status-success)" },
    { name: "Shared by me", value: stats.overview.sharedByMe, fill: "var(--status-warning)" },
    {
      name: "Shared with me",
      value: stats.overview.sharedWithMe,
      fill: "var(--status-danger)",
    },
    { name: "Unshared", value: stats.overview.unshared, fill: "var(--color-primary)" },
    { name: "Personal", value: stats.overview.personal, fill: "#f97316" },
  ];

  const categoryData = Object.keys(categories).map((key, index) => ({
    name: key,
    value: categories[key],
    color: COLORS[index % COLORS.length],
  }));

  const pieData = [
    { name: "Score", value: assessment.score },
    { name: "Remaining", value: 100 - assessment.score },
  ];

  let scoreColor = "var(--status-success)";
  if (assessment.score < 50) {
    scoreColor = "var(--status-danger)";
  } else if (assessment.score < 80) {
    scoreColor = "var(--status-warning)";
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Overview
          </h2>
          <p className="text-muted-foreground mt-1">
            Welcome back. Here is the activity summary for your account and
            organization.
          </p>
        </div>

        {user?.role !== "USER" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport("csv")}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => handleExport("pdf")}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="personal">My Dashboard</TabsTrigger>
          <TabsTrigger value="team">Team Dashboard</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted-foreground text-sm font-medium tracking-tight">
              Passwords
            </h3>
            <Key className="w-4 h-4 text-primary" />
          </div>
          <div className="text-3xl font-bold">
            {currentStats?.total || 0}
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted-foreground text-sm font-medium tracking-tight">
              Folders
            </h3>
            <Folder className="w-4 h-4 text-status-success" />
          </div>
          <div className="text-3xl font-bold">
            {stats.folders?.total || 0}
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted-foreground text-sm font-medium tracking-tight">
              {activeTab === "team" ? "Users" : "File Attachments"}
            </h3>
            {activeTab === "team" ? (
              <Users className="w-4 h-4 text-status-warning" />
            ) : (
              <Share2 className="w-4 h-4 text-status-warning" />
            )}
          </div>
          <div className="text-3xl font-bold">
            {activeTab === "team" ? stats.userAccess?.total : 0}
          </div>
        </div>

        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted-foreground text-sm font-medium tracking-tight">
              SSO Apps
            </h3>
            <Cloud className="w-4 h-4 text-status-danger" />
          </div>
          <div className="text-3xl font-bold">
            {stats.ssoApps?.total || 0}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview Chart */}
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Overview of All Passwords
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 10, right: 0, left: -20, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--color-border)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: "var(--color-muted)", opacity: 0.2 }} contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {overviewData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assessment Score */}
        <div className="lg:col-span-2 bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-6">
            <h3 className="text-lg font-semibold tracking-tight">
              Password Assessment Score
            </h3>
            <div title="This score represents the overall strength and security of your passwords based on various criteria.">
              <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around h-[250px]">
            {/* Main Score Pie */}
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={65}
                    outerRadius={85}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={scoreColor} />
                    <Cell fill="var(--color-muted)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tracking-tighter">
                  {assessment.score}%
                </span>
              </div>
              <div className="absolute -bottom-2 w-full flex justify-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-status-danger"></div>Poor
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-status-warning"></div>Fair
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-status-success"></div>Good
                </span>
              </div>
            </div>

            {/* Assessment Circles */}
            <div className="grid grid-cols-3 gap-x-8 gap-y-4 text-center mt-6 md:mt-0">
              <AssessmentCircle
                label="Weak"
                count={assessment.weak}
                total={currentStats.total}
                color="text-status-danger"
                borderColor="border-status-danger"
              />
              <AssessmentCircle
                label="Reused"
                count={assessment.reused}
                total={currentStats.total}
                color="text-status-warning"
                borderColor="border-status-warning"
              />
              <AssessmentCircle
                label="Contains username"
                count={assessment.containsUsername}
                total={currentStats.total}
                color="text-primary"
                borderColor="border-primary"
              />
              <AssessmentCircle
                label="Old"
                count={assessment.old}
                total={currentStats.total}
                color="text-status-danger"
                borderColor="border-status-danger"
              />
              <AssessmentCircle
                label="Dictionary words"
                count={assessment.dictionary}
                total={currentStats.total}
                color="text-status-success"
                borderColor="border-status-success"
              />
              <AssessmentCircle
                label="Recycled"
                count={assessment.recycled}
                total={currentStats.total}
                color="text-status-success"
                borderColor="border-status-success"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <h3 className="text-lg font-semibold tracking-tight mb-4">
            Categories Distribution
          </h3>
          <div className="h-[200px] relative">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={45}
                    fill="#8884d8"
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)" }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Password Actions */}
        <div className="lg:col-span-2 bg-card text-card-foreground p-6 rounded-lg shadow-sm border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold tracking-tight">
              Password Actions
            </h3>
            <Select value={actionRange} onValueChange={(val: any) => setActionRange(val)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Today">Today</SelectItem>
                <SelectItem value="Yesterday">Yesterday</SelectItem>
                <SelectItem value="Last 7 Days">Last 7 Days</SelectItem>
                <SelectItem value="Last Month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.passwordActions?.[actionRange] || []}
                margin={{ top: 10, right: 0, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: "var(--color-muted)", opacity: 0.2 }} contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                <Bar dataKey="accessed" stackId="a" fill="var(--color-primary)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="added" stackId="a" fill="var(--status-success)" />
                <Bar dataKey="modified" stackId="a" fill="var(--status-warning)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssessmentCircle({
  label,
  count,
  color,
  borderColor,
}: {
  label: string;
  count: number;
  total?: number;
  color: string;
  borderColor: string;
}) {
  return (
    <div className="flex flex-col items-center cursor-pointer group">
      <div
        className={`w-14 h-14 rounded-full border-[3px] ${borderColor} flex flex-col items-center justify-center mb-2 bg-card group-hover:scale-105 transition-transform shadow-sm`}
      >
        <span className={`text-lg font-bold ${color}`}>{count}</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
    </div>
  );
}
