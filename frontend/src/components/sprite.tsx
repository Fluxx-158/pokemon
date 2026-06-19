import type { ImgHTMLAttributes } from 'react';
import { spriteUrl } from '@/modules/api/endpoints';
import { cn } from '@/lib/utils';

type SpriteVariant = 'default' | 'official';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError' | 'id'> {
    id: number;
    variant?: SpriteVariant;
}

export function Sprite({ id, variant = 'default', alt = '', className, ...rest }: Props) {
    return (
        <img
            {...rest}
            src={spriteUrl(id, variant)}
            alt={alt}
            className={cn('object-contain', className)}
            onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                // Many mega forms (Z-A / Regulation M-B) have no pixel "default" sprite
                // upstream but do have official artwork — fall back to it before hiding.
                const official = spriteUrl(id, 'official');
                if (variant !== 'official' && !img.dataset.fellBack) {
                    img.dataset.fellBack = '1';
                    img.src = official;
                    return;
                }
                img.style.visibility = 'hidden';
            }}
        />
    );
}
