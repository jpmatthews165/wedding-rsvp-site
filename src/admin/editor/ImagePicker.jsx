import { useRef, useState } from 'react';
import { uploadFile } from './upload.js';
import { Link2, Loader2, Upload, X } from 'lucide-react';
import { inputCls } from './FieldForm.jsx';

// Shrinks big phone photos before upload (max 2400px, JPEG) so the site stays fast.
const resizeImage = async (file) => {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
};

const BUILT_IN = ['/hero.jpg', '/details.jpg', '/registry.jpg'];

// Collects every image URL already used anywhere in the content.
const collectImages = (obj, out = new Set()) => {
  if (Array.isArray(obj)) obj.forEach((v) => collectImages(v, out));
  else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      if ((k === 'image') && typeof v === 'string' && v) out.add(v);
      else collectImages(v, out);
    });
  }
  return out;
};

export default function ImagePicker({ content, current, getToken, onSelect, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const fileRef = useRef(null);
  const library = [...new Set([...BUILT_IN, ...collectImages(content)])];

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const resized = await resizeImage(file);
      onSelect(await uploadFile(resized, getToken, 'site'));
    } catch (err) {
      setError(`Upload failed: ${err.message}. You can also paste an image link below.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#f4efe7] rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#333036]/10">
          <h3 className="font-semibold text-[#333036]">Choose a photo</h3>
          <button onClick={onClose} aria-label="Close" className="text-[#333036]/60 hover:text-[#333036]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            onClick={() => !busy && fileRef.current?.click()}
            className="rounded-lg border-2 border-dashed border-[#6c5d84]/40 bg-white p-6 text-center cursor-pointer hover:bg-[#6c5d84]/5"
          >
            {busy ? (
              <p className="flex items-center justify-center gap-2 text-sm text-[#6c5d84]"><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</p>
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto text-[#6c5d84] mb-2" />
                <p className="text-sm font-semibold text-[#333036]">Upload from your device</p>
                <p className="text-xs text-[#333036]/60 mt-1">Click or drag a photo here. Big photos are shrunk automatically.</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
          {error && <p className="text-xs text-[#7a4d55] bg-[#d4a5a5]/25 rounded-md p-2">{error}</p>}

          <div>
            <p className="text-xs font-semibold text-[#333036]/80 mb-2">Photos already on the site</p>
            <div className="grid grid-cols-3 gap-2">
              {library.map((src) => (
                <button key={src} onClick={() => onSelect(src)} className={`aspect-[4/3] rounded-md bg-cover bg-center border-2 ${src === current ? 'border-[#6c5d84]' : 'border-transparent hover:border-[#6c5d84]/50'}`} style={{ backgroundImage: `url('${src}')` }} aria-label="Use this photo" />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-[#333036]/80 mb-2">Or paste an image link</p>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button onClick={() => url.trim() && onSelect(url.trim())} className="shrink-0 flex items-center gap-1 rounded-md bg-[#6c5d84] text-white text-sm px-3 hover:bg-[#524569]"><Link2 className="w-4 h-4" /> Use</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
