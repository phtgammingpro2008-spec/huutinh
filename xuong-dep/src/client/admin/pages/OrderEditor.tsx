import { useState } from 'react';
import type { Box } from '../../../shared/types';
import { FULL_BOX, nextTagNo } from '../../lib/tagger-geometry';
import { ImageTagger, type TaggerTag } from '../components/ImageTagger';
import { PhotoPicker, type EditorImage } from '../components/PhotoPicker';

type Tag = TaggerTag & { imageId: string };

// Task 9: photos + tagging. Task 10 grows this into the full order editor.
export function OrderEditor() {
  const [images, setImages] = useState<EditorImage[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const add = (imageId: string, tap: { x: number; y: number } | null, crop: Box) => {
    const tagNo = nextTagNo(tags);
    setTags((ts) => [...ts, { tagNo, imageId, tapX: tap?.x ?? null, tapY: tap?.y ?? null, crop }]);
    setSelected(tagNo);
  };

  return (
    <main className="page">
      <h1>Đơn mới</h1>
      <PhotoPicker
        onAdded={(img) => setImages((xs) => [...xs, img])}
        onUploaded={(id, key) => setImages((xs) => xs.map((x) => (x.id === id ? { ...x, key } : x)))}
        onUploadError={(id, msg) => setImages((xs) => xs.map((x) => (x.id === id ? { ...x, uploadError: msg } : x)))}
      />
      {images.map((img) => (
        <section key={img.id} style={{ marginTop: 16 }}>
          <ImageTagger
            image={img}
            tags={tags.filter((t) => t.imageId === img.id)}
            selected={selected}
            onAdd={(tap, box) => add(img.id, tap, box)}
            onSelect={setSelected}
            onBoxChange={(tagNo, crop) => setTags((ts) => ts.map((t) => (t.tagNo === tagNo ? { ...t, crop } : t)))}
            onWholeImage={() => add(img.id, null, FULL_BOX)}
          />
          {img.uploadError && <p className="error">{img.uploadError}</p>}
        </section>
      ))}
    </main>
  );
}
