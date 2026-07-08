import { getPublishedArticles } from '@/lib/articles';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TopHeader from '@/components/TopHeader';

type SourceArticle = any;

const sourceConfig: Record<string, any> = {
  'economist': {
    color: 'bg-[#FFB760]',
    illustration: 'il-review.svg',
    description: 'Phân tích thời sự, kinh tế và xu hướng toàn cầu',
    name: 'The Economist'
  },
  'new-yorker': {
    color: 'bg-[#62DAB1]',
    illustration: 'il-announce.svg',
    description: 'Phóng sự dài, văn hóa và bình luận chuyên sâu',
    name: 'The New Yorker'
  },
  'atlantic': {
    color: 'bg-[#FFE17B]',
    illustration: 'il-knowledge.svg',
    description: 'Ý tưởng lớn, tâm lý và đời sống hiện đại',
    name: 'The Atlantic'
  },
  'national-geographic': {
    color: 'bg-[#82D8F2]',
    illustration: 'il-submit.svg',
    description: 'Khoa học, thiên nhiên và thế giới quanh ta',
    name: 'National Geographic'
  }
};

function getSectionColor(section: string) {
  const s = section?.toLowerCase() || '';
  if (s.includes('môi trường') || s.includes('science')) return 'bg-[#62DAB1] text-[#141413]';
  if (s.includes('đô thị') || s.includes('technology')) return 'bg-[#7CD1E8] text-[#141413]';
  if (s.includes('kinh tế') || s.includes('business')) return 'bg-[#FFE17B] text-[#141413]';
  if (s.includes('văn hóa') || s.includes('culture')) return 'bg-[#FFB760] text-[#141413]';
  return 'bg-[#62DAB1] text-[#141413]'; // Default color fallback
}

function getValidCoverUrl(coverId: string | undefined | null) {
  if (!coverId) return null;
  if (coverId.startsWith('http')) return coverId;
  return `https://sgp.cloud.appwrite.io/v1/storage/buckets/${process.env.NEXT_PUBLIC_APPWRITE_COVERS_BUCKET_ID}/files/${coverId}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
}

export default async function SourcePage({ params }: { params: Promise<{ source: string }> }) {
  const resolvedParams = await params;
  const sourceSlug = resolvedParams.source;
  const config = sourceConfig[sourceSlug];
  
  if (!config) return notFound();

  // Fetch articles for this source
  let rawArticles = await getPublishedArticles({ source: config.name, limit: 100 });
  const articles: SourceArticle[] = JSON.parse(JSON.stringify(rawArticles));
  
  return (
    <main className="min-h-screen bg-[#FFFFFF] pb-32">
      <TopHeader user={null} />
      
      <div className="w-full max-w-[1060px] mx-auto pt-10 px-4 md:px-0">
        <Link href="/reading" className="inline-flex items-center text-[13px] font-sans font-semibold text-black/60 hover:text-black mb-10 transition-colors">
          <span className="mr-2">←</span> Tất cả tạp chí
        </Link>
        
        <div className="flex items-start gap-6 mb-12">
          <div className={`w-24 h-24 rounded-[20px] ${config.color} flex items-center justify-center shrink-0 shadow-sm`}>
            <img src={`/images/illustrations/${config.illustration}`} className="w-12 h-12 object-contain" alt="" />
          </div>
          <div className="pt-2">
            <div className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase text-[#857F70] mb-3">
              READING ARTICLES
            </div>
            <h1 className="font-sans font-semibold text-[32px] mb-2 tracking-tight">{config.name}</h1>
            <p className="font-sans text-black/60 text-[15px] font-normal">
              {config.description} - {articles.length} bài
            </p>
          </div>
        </div>

        <hr className="border-black/10 mb-12" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article: SourceArticle) => (
            <Link key={article.$id} href={`/articles/${article.slug ?? article.$id}`} className="bg-white rounded-[16px] border border-black/10 p-6 flex flex-col group hover:shadow-md transition-shadow min-h-[260px]">
              <div className="mb-4">
                <span className={`inline-block ${getSectionColor(article.section)} text-[10px] font-sans font-bold uppercase tracking-widest px-2.5 py-1 rounded-[4px]`}>
                  {article.section || 'ESSAY'}
                </span>
              </div>
              <h3 className="font-sans font-semibold text-[20px] mb-4 leading-snug group-hover:text-black/70 transition-colors">
                {article.title}
              </h3>
              
              <div className="w-full h-[120px] flex-grow rounded-[8px] overflow-hidden bg-neutral-100 relative mb-1 mt-auto">
                {getValidCoverUrl(article.cover_image_id || article.coverImageId) ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img src={getValidCoverUrl(article.cover_image_id || article.coverImageId)!} className="object-cover w-full h-full absolute inset-0 group-hover:scale-105 transition-transform duration-500" alt="" />
                ) : (
                   <div className="w-full h-full bg-neutral-200 absolute inset-0" />
                )}
              </div>
              
              <hr className="border-black/10 my-4" />
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1.5 text-black/50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className="font-sans text-[12px] font-medium">{article.readMinutes || 9} phút</span>
                </div>
                <span className="text-black/40 group-hover:translate-x-1 group-hover:text-black/60 transition-all">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
