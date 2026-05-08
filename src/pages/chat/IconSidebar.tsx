import { MessageSquare, Users, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export type SidebarTab = "chats" | "contacts";

interface Props {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  unreadTotal?: number;
}

export default function IconSidebar({ activeTab, onTabChange, unreadTotal = 0 }: Props) {
  const { user } = useAuth();

  const tabs: { id: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
    { id: "chats", icon: MessageSquare, label: "消息" },
    { id: "contacts", icon: Users, label: "通讯录" },
  ];

  return (
    <div className="flex flex-col h-full w-[60px] bg-zinc-100 border-r border-zinc-200 py-3 flex-shrink-0">
      {/* Top tabs */}
      <div className="flex flex-col items-center gap-1">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all ${
              activeTab === id
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
            }`}
            title={label}
          >
            <Icon className="h-[18px] w-[18px]" />
            {/* Unread badge */}
            {id === "chats" && unreadTotal > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff3b3b] px-1 text-[9px] font-bold text-white">
                {unreadTotal > 99 ? "99+" : unreadTotal}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Home + Avatar */}
      <div className="flex flex-col items-center gap-2">
        <Link
          to="/"
          className="flex items-center justify-center w-11 h-11 rounded-xl text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-all"
          title="返回首页"
        >
          <Home className="h-[18px] w-[18px]" />
        </Link>

        {/* User avatar */}
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center overflow-hidden ring-2 ring-zinc-200">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[11px] font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || "G"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
