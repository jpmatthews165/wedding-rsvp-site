import Site from './Site.jsx';
import { usePublishedContent } from '../content/useSiteContent.js';

export default function PublicSite() {
  const content = usePublishedContent();
  if (!content) {
    return (
      <div className="min-h-screen bg-[#e6dbcc] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#6c5d84]/30 border-t-[#6c5d84] rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }
  return <Site content={content} />;
}
