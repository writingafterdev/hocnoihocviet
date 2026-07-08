'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Home, BookOpen, Bookmark, LineChart, User, ShieldAlert } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';

const baseItems = [
  { id: 'feed',     href: '/',          label: 'Trang chủ', Icon: Home },
  { id: 'library',  href: '/library',   label: 'Học liệu',  Icon: BookOpen },
  { id: 'saved',    href: '/saved',     label: 'Đã lưu',    Icon: Bookmark },
  { id: 'stats',    href: '/stats',     label: 'Tiến độ',   Icon: LineChart },
  { id: 'profile',  href: '/profile',   label: 'Hồ sơ',     Icon: User },
];

export default function NavDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkAuth() {
      const u = await getCurrentUser();
      setUser(u);
      setLoadingAuth(false);
      if (u && u.email === 'writingafterx@gmail.com') {
        setIsAdmin(true);
      }
    }
    checkAuth();
  }, []);

  const items = isAdmin 
    ? [...baseItems, { id: 'admin', href: '/admin', label: 'Admin', Icon: ShieldAlert }]
    : baseItems;

  const activeId =
    pathname.startsWith('/library')  ? 'library' :
    pathname.startsWith('/saved')    ? 'saved' :
    pathname.startsWith('/stats')    ? 'stats' :
    pathname.startsWith('/profile')  ? 'profile' :
    pathname.startsWith('/admin')    ? 'admin' :
    'feed';

  if (pathname.startsWith('/auth/login')) return null;
  if (!loadingAuth && !user && pathname === '/') return null;
  if (loadingAuth && pathname === '/') return null;

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[9999] group">
      <div className="flex flex-col items-start gap-1 bg-[#FFFFFF] border border-[#DEDAD0] p-1.5 rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out">
        {items.map(({ id, href, label, Icon }) => {
          const isActive = activeId === id;
          const isProfile = id === 'profile';
          return (
            <div key={id} className="flex flex-col items-start w-full">
              {isProfile && <div className="w-[24px] group-hover:w-[120px] transition-all duration-300 h-[1px] bg-[#E6E3D8] my-1 ml-[10px]" />}
              <button
                onClick={() => router.push(href)}
                className={`relative flex items-center justify-start transition-all duration-300 ease-out rounded-[12px] overflow-hidden w-[44px] group-hover:w-[140px] h-[44px] ${
                  isActive 
                    ? 'bg-[#141413] text-[#FFFFFF]' 
                    : 'bg-transparent text-[#857F70] hover:text-[#141413] hover:bg-[#F2F0E9]'
                }`}
              >
                <div className="flex items-center min-w-[140px] pl-[14px] gap-3">
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                  <span className={`font-sans text-[13px] font-medium tracking-wide whitespace-nowrap transition-opacity duration-300 opacity-0 group-hover:opacity-100`}>
                    {label}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
