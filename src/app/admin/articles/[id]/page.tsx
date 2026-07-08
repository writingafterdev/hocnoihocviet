import { serverDatabases } from '@/lib/appwrite-server';
import { COLLECTIONS, DB_ID } from '@/lib/appwrite';
import Link from 'next/link';
import AdminArticleClient from '@/components/AdminArticleClient';

export default async function AdminArticleDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let article;

  try {
    article = await serverDatabases.getDocument(DB_ID, COLLECTIONS.articles, id);
  } catch (e) {
    console.error('Failed to load article details on server:', e);
  }

  if (!article) {
    return (
      <div className="max-w-[800px] py-12">
        <h2 className="text-[24px] font-heading">Article Not Found</h2>
        <Link href="/admin" className="text-blue-600 hover:underline mt-4 inline-block">Back to Admin Dashboard</Link>
      </div>
    );
  }

  return <AdminArticleClient article={JSON.parse(JSON.stringify(article))} />;
}
