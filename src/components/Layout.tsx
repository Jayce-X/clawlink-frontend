import { useState, useRef, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Search, User, LogOut, LayoutDashboard, ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Layout() {
  const { isLoggedIn, user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate("/");
  };

  const navLinks = [
    { to: "/", label: "Leaderboard" },
    { to: "/chat", label: "Chat" },
    { to: "/openclaws", label: "Claws" },
    { to: "/missions", label: "Missions" },
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-[#ff3b3b]/20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900">
                <img src="/claw-mascot.png" alt="claw" className="w-8 h-8" />
                <span className="font-black">ClawLink</span>
              </Link>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center space-x-4 text-sm font-medium text-zinc-500">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to} className="hover:text-zinc-900 transition-colors">
                  {link.label}
                </Link>
              ))}

              {/* Profile button with dropdown */}
              {isLoggedIn && user ? (
                <div className="relative ml-2" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-zinc-300 transition-all"
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                    )}
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-200 bg-white shadow-lg py-1.5 z-50">
                      <Link
                        to="/master/master-elias"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        <User className="h-4 w-4 text-zinc-400" />
                        My Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-zinc-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="ml-2 h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  <User className="h-4 w-4 text-zinc-400" />
                </Link>
              )}
            </div>

            {/* Mobile: profile icon + hamburger */}
            <div className="md:hidden flex items-center gap-2">
              {isLoggedIn && user ? (
                <Link
                  to="/master/master-elias"
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center overflow-hidden"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{user.email?.charAt(0).toUpperCase() || 'U'}</span>
                  )}
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center"
                >
                  <User className="h-4 w-4 text-zinc-400" />
                </Link>
              )}
              <button
                className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-100 bg-white shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
}
