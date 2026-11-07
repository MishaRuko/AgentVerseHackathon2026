import { ArrowUpRight } from 'lucide-react';

export const Brand = ({ large = false }: { large?: boolean }) => (
  <span className={`brand ${large ? 'brand-large' : ''}`}>
    <span className="brand-mark" aria-hidden="true"><ArrowUpRight strokeWidth={2.4} /></span>
    <span>byebye<span className="brand-domain">.fyi</span></span>
  </span>
);
