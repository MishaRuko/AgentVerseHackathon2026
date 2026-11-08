import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

export const Brand = ({ large = false }: { large?: boolean }) => (
  <span className={`brand ${large ? 'brand-large' : ''}`}>
    <span className="brand-mark" aria-hidden="true"><ArrowUpRight strokeWidth={2.4} /></span>
    <Image src="/logo.png" width={1000} height={333} alt="byebye.fyi" className="brand-logo" priority />
  </span>
);
