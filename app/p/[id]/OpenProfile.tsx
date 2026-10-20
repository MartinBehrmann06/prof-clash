'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function OpenProfile({ id }: { id: number }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/rankings?prof=${id}`); }, [id, router]);
  return <div className="loading"><span className="spin" />Lädt</div>;
}
