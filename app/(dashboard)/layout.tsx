import { Sidebar, Header } from '@/components/layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'My Organization';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isAdmin={true} organizationName={orgName} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-muted/10 p-6">{children}</main>
      </div>
    </div>
  );
}
