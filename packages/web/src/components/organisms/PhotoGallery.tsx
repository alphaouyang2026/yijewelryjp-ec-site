import { useState } from 'react';
import type { ProductPhoto } from '../../api';
import { useMessages } from '../../i18n/useMessages';
import { Photo } from '../atoms/Photo';
import { PhotoPlaceholder } from '../atoms/PhotoPlaceholder';
import { PhotoThumbnail } from '../atoms/PhotoThumbnail';
import styles from './PhotoGallery.module.css';

/**
 * A product's photos on its page, in the owner's order: one shown large (the
 * first at first) and, when there are more, a thumbnail of each to show it
 * instead. Without photos, the photo's place. Render it with
 * `key={product.slug}` so another product starts from its first photo.
 */
export function PhotoGallery({ photos }: { photos: ProductPhoto[] }) {
  const text = useMessages().productPage;
  const [shownIndex, setShownIndex] = useState(0);
  const shown = photos[shownIndex];

  if (!shown) return <PhotoPlaceholder shape="product" />;
  return (
    <div className={styles.gallery}>
      <Photo src={shown.url} alt={shown.alt} shape="product" eager />
      {photos.length > 1 && (
        <ul aria-label={text.photos} className={styles.thumbnails}>
          {photos.map((photo, index) => (
            <li key={photo.url}>
              <PhotoThumbnail
                src={photo.url}
                alt={photo.alt}
                pressed={index === shownIndex}
                onPress={() => setShownIndex(index)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
