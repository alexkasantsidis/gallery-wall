import { memo } from 'react';
import type { PhotoPlacement } from '../model/types';
import { useAssetMeta, useAssetUrl } from '../photos/assets';
import { TONE_FILTER } from '../geometry/crop';

/**
 * Renders a photo inside its cell using the shared crop model (see geometry/crop.ts):
 * object-fit: cover + object-position anchor + scale about the same anchor. Pure CSS, so the
 * photo re-fits instantly while the frame is being resized.
 */
export const PhotoCell = memo(function PhotoCell({ photo, approxPx }: { photo: PhotoPlacement; approxPx: number }) {
  const meta = useAssetMeta(photo.assetId);
  const url = useAssetUrl(photo.assetId, approxPx * Math.max(1, photo.zoom), photo.rotate);
  const anchor = `${(photo.ax * 100).toFixed(3)}% ${(photo.ay * 100).toFixed(3)}%`;
  return (
    <div className="gw-photo" style={{ background: meta?.avgColor ?? '#ddd', transform: photo.flipX ? 'scaleX(-1)' : undefined }}>
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            objectPosition: anchor,
            transformOrigin: anchor,
            transform: photo.zoom !== 1 ? `scale(${photo.zoom})` : undefined,
            filter: TONE_FILTER[photo.tone],
          }}
        />
      )}
    </div>
  );
});
