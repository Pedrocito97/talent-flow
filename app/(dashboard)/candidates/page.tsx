'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function CandidatesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the search page which has full candidate listing functionality
    router.replace('/search');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Search...</p>
      </div>
    </div>
  );
}
