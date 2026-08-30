import AdminPage from '@/app/admin/page';

export default function SuperadminPayoutOperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  return <AdminPage searchParams={searchParams} />;
}
