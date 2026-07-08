import Link from 'next/link';

export default function TopHeader({ user }: { user: any }) {
  const initials = user?.name 
    ? user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="max-w-[1440px] w-full mx-auto px-4 md:px-8 py-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-4 group">
        <div className="w-[42px] h-[42px] rounded-[14px] bg-[#62DAB1] flex items-center justify-center shrink-0">
          <img src="/images/illustrations/il-structure.svg" className="w-[28px] h-[28px] object-contain" alt="tienganhkhong" />
        </div>
        <span className="font-sans text-[20px] font-medium tracking-tight">tienganhkhong.</span>
      </Link>
      <div className="w-10 h-10 rounded-full bg-[#FFB760] flex items-center justify-center font-sans text-[12px] font-semibold text-[#141413]">
        {initials}
      </div>
    </header>
  );
}
