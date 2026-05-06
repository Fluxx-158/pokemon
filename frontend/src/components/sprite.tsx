import type { ImgHTMLAttributes } from 'react';
import { spriteUrl } from '@/modules/api/endpoints';
import { cn } from '@/lib/utils';

type SpriteVariant = 'default' | 'official';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
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
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
        />
    );
}
