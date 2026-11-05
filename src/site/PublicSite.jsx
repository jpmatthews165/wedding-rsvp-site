import Site from './Site.jsx';
import { usePublishedContent } from '../content/useSiteContent.js';

export default function PublicSite() {
  const content = usePublishedContent();
  if (!content) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }
  return <Site content={content} />;
}
