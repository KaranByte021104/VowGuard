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

const COLORS = [
  "#0ea5e9",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
];

const dummyActionsData: Record<string, any[]> = {
  Today: [
    { name: "00:00", added: 0, modified: 0, accessed: 1 },
    { name: "06:00", added: 0, modified: 0, accessed: 2 },
    { name: "12:00", added: 1, modified: 0, accessed: 5 },
    { name: "18:00", added: 2, modified: 1, accessed: 3 },
  ],
  Yesterday: [
    { name: "00:00", added: 0, modified: 0, accessed: 0 },
    { name: "06:00", added: 0, modified: 1, accessed: 4 },
    { name: "12:00", added: 0, modified: 0, accessed: 8 },
    { name: "18:00", added: 0, modified: 0, accessed: 2 },
  ],
  "Last 7 Days": [
    { name: "Mon", added: 4, modified: 2, accessed: 10 },
    { name: "Tue", added: 1, modified: 0, accessed: 15 },
    { name: "Wed", added: 0, modified: 1, accessed: 12 },
    { name: "Thu", added: 3, modified: 3, accessed: 8 },
    { name: "Fri", added: 2, modified: 0, accessed: 20 },
    { name: "Sat", added: 0, modified: 0, accessed: 5 },
    { name: "Sun", added: 0, modified: 0, accessed: 2 },
  ],
  "Last Month": [
    { name: "Week 1", added: 12, modified: 4, accessed: 45 },
    { name: "Week 2", added: 5, modified: 8, accessed: 50 },
    { name: "Week 3", added: 8, modified: 2, accessed: 65 },
    { name: "Week 4", added: 3, modified: 1, accessed: 40 },
  ],
};

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
      <div className="p-8 text-center text-gray-500">Loading dashboard...</div>
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
    { name: "Owned", value: stats.overview.owned, fill: "#22c55e" },
    { name: "Shared by me", value: stats.overview.sharedByMe, fill: "#eab308" },
    {
      name: "Shared with me",
      value: stats.overview.sharedWithMe,
      fill: "#ef4444",
    },
    { name: "Unshared", value: stats.overview.unshared, fill: "#0ea5e9" },
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

  let scoreColor = "#22c55e"; // default green
  if (assessment.score < 50) {
    scoreColor = "#ef4444"; // red
  } else if (assessment.score < 80) {
    scoreColor = "#f59e0b"; // amber
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Overview
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Welcome back. Here is the activity summary for your account and
            organization.
          </p>
        </div>

        {user?.role !== "USER" && (
          <div className="flex gap-3">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("personal")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "personal"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            My Dashboard
          </button>
          <button
            onClick={() => setActiveTab("team")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Team Dashboard
          </button>
        </nav>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Passwords
            </h3>
            <Key className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {currentStats?.total || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              Folders
            </h3>
            <Folder className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {stats.folders?.total || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              {activeTab === "team" ? "Users" : "File Attachments"}
            </h3>
            {activeTab === "team" ? (
              <Users className="w-5 h-5 text-amber-500" />
            ) : (
              <Share2 className="w-5 h-5 text-amber-500" />
            )}
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {activeTab === "team" ? stats.userAccess?.total : 0}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              SSO Apps
            </h3>
            <Cloud className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            0
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">
            Overview of All Passwords
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overviewData}
                margin={{ top: 20, right: 0, left: -20, bottom: 25 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis />
                <RechartsTooltip cursor={{ fill: "transparent" }} />
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
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Password Assessment Score
            </h3>
            <Info className="w-4 h-4 text-blue-500" />
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around h-64">
            {/* Main Score Pie */}
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={scoreColor} />
                    <Cell fill="#f3f4f6" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  {assessment.score}%
                </span>
              </div>
              <div className="absolute bottom-0 w-full text-center text-xs text-gray-500 flex justify-center gap-2">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-500"></div>Poor
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-500"></div>Fair
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500"></div>Good
                </span>
              </div>
            </div>

            {/* Assessment Circles */}
            <div className="grid grid-cols-3 gap-8 text-center mt-6 md:mt-0">
              <AssessmentCircle
                label="Weak"
                count={assessment.weak}
                total={currentStats.total}
                color="text-red-500"
                borderColor="border-red-500"
              />
              <AssessmentCircle
                label="Reused"
                count={assessment.reused}
                total={currentStats.total}
                color="text-amber-500"
                borderColor="border-amber-500"
              />
              <AssessmentCircle
                label="Contains username"
                count={assessment.containsUsername}
                total={currentStats.total}
                color="text-blue-500"
                borderColor="border-blue-500"
              />
              <AssessmentCircle
                label="Old"
                count={assessment.old}
                total={currentStats.total}
                color="text-red-500"
                borderColor="border-red-500"
              />
              <AssessmentCircle
                label="Dictionary words"
                count={assessment.dictionary}
                total={currentStats.total}
                color="text-green-500"
                borderColor="border-green-500"
              />
              <AssessmentCircle
                label="Recycled"
                count={assessment.recycled}
                total={currentStats.total}
                color="text-green-500"
                borderColor="border-green-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-4 text-gray-900 dark:text-white">
            Categories Distribution
          </h3>
          <div className="h-48 relative">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    fill="#8884d8"
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Password Actions */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Password Actions
            </h3>
            <select
              className="text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
              value={actionRange}
              onChange={(e) => setActionRange(e.target.value)}
            >
              <option>Today</option>
              <option>Yesterday</option>
              <option>Last 7 Days</option>
              <option>Last Month</option>
            </select>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              {/* Note: I need to import LineChart, Line from recharts too */}
              <BarChart
                data={dummyActionsData[actionRange] || []}
                margin={{ top: 5, right: 0, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="accessed" stackId="a" fill="#3b82f6" />
                <Bar dataKey="added" stackId="a" fill="#22c55e" />
                <Bar dataKey="modified" stackId="a" fill="#eab308" />
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
  total,
  color,
  borderColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  borderColor: string;
}) {
  return (
    <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
      <div
        className={`w-16 h-16 rounded-full border-4 ${borderColor} flex flex-col items-center justify-center mb-2 bg-white dark:bg-gray-800`}
      >
        <span className={`text-xl font-bold ${color}`}>{count}</span>
        <span className="text-[10px] text-gray-500">of {total}</span>
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}
