import AdminArticleList from '@/components/AdminArticleList';
import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="max-w-[800px] flex flex-col gap-12 pb-24">
      <div>
        <h2 className="text-[48px] font-heading leading-none text-[#111]">Welcome, Admin.</h2>
        <p className="text-[14px] font-serif text-[#111]/70 mt-4 leading-relaxed">
          This is the secured administrative area. Use the dashboard below to manage your library.
        </p>
      </div>
      
      <div className="p-8 border border-[#111] bg-[#111]/5 flex justify-between items-center">
        <div>
          <h3 className="text-[18px] font-heading text-[#111] mb-2">Import Pipeline</h3>
          <p className="text-[13px] font-serif text-[#111]/80">
            Drag and drop saved HTML files to instantly bypass paywalls and format them for reading.
          </p>
        </div>
        <Link 
          href="/admin/import"
          className="px-6 py-3 bg-[#111] text-white text-[11px] font-sans uppercase tracking-widest font-bold hover:bg-black transition-colors"
        >
          Open Importer
        </Link>
      </div>

      <div>
        <h3 className="text-[14px] font-sans uppercase tracking-widest font-bold text-[#111] mb-6">Article Library</h3>
        <AdminArticleList />
      </div>
    </div>
  );
}
