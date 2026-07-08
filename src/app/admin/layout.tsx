'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Database, Upload, Users, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user || user.email !== 'writingafterx@gmail.com') {
        router.push('/');
      } else {
        setAuthorized(true);
      }
    }
    checkAuth();
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF]">
        <div className="flex flex-col items-center gap-4 text-[#111]/30">
          <ShieldAlert className="w-8 h-8" />
          <span className="text-[11px] font-sans uppercase tracking-widest font-bold animate-pulse">
            Verifying Admin Credentials...
          </span>
        </div>
      </div>
    );
  }

  const links = [
    { href: '/admin', label: 'Dashboard', icon: Database },
    { href: '/admin/import', label: 'Import Pipeline', icon: Upload },
    { href: '/admin/users', label: 'Manage Users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex selection:bg-[#111] selection:text-[#FFFFFF]">
      {/* ── Admin Sidebar ── */}
      <aside className="w-[280px] shrink-0 border-r border-black/10 flex flex-col justify-between p-8 pt-[160px]">
        <div className="flex flex-col gap-12">
          <div className="flex flex-col">
            <h1 className="text-[24px] font-heading leading-none text-[#111]">Admin Panel</h1>
            <span className="text-[9px] font-sans uppercase tracking-widest font-bold text-[#111] mt-2">
              Superuser Access
            </span>
          </div>

          <nav className="flex flex-col gap-2">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-4 px-4 py-3 border transition-colors ${
                    active
                      ? 'border-[#111] bg-[#111] text-[#FFFFFF]'
                      : 'border-transparent text-[#111]/70 hover:bg-[#111]/5 hover:opacity-60'
                  }`}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="text-[11px] font-sans uppercase tracking-widest font-bold">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <Link
          href="/"
          className="flex items-center gap-3 text-[11px] font-sans uppercase tracking-widest font-bold text-[#111]/50 hover:opacity-60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Admin
        </Link>
      </aside>

      {/* ── Main Admin Content ── */}
      <main className="flex-1 min-w-0 p-12 pt-[160px]">
        {children}
      </main>
    </div>
  );
}
