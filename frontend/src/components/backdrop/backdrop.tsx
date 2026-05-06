// Backdrop renderer — mounted once at the top of <App />.
// Sits at z-index: -2, fixed full-screen, pointer-events: none.
// The dot grid is painted by body::after (in backgrounds.css) so it
// always renders ON TOP of whatever this component shows.

import { useBackdrop } from './backdrop-context';
import { findBuiltin } from './presets';

const BASE_STYLE: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: -2,
    pointerEvents: 'none',
};

export function Backdrop() {
    const { active, customs, isLoading } = useBackdrop();
    const builtin = findBuiltin(active);
    const custom = customs.find((c) => c.name === active);

    // While the API call for customs is in flight and the active name is
    // not a built-in, render a parchment-coloured placeholder so the page
    // doesn't briefly look like the user has parchment selected. The
    // backdrop appears as soon as customs resolve.
    if (!builtin && !custom && isLoading && active !== 'parchment') {
        return (
            <div
                aria-hidden
                style={{ ...BASE_STYLE, background: 'hsl(var(--card))' }}
            />
        );
    }

    // Built-in: parchment → no backdrop layer.
    if (builtin?.kind === 'parchment') return null;

    // Built-in: css preset → render a styled div.
    if (builtin?.kind === 'css') {
        return (
            <div
                aria-hidden
                className={builtin.cssClass}
                style={{ ...BASE_STYLE, opacity: builtin.opacity ?? 0.5 }}
            />
        );
    }

    // Custom upload: image. Vite serves the file at the /backdrops/<name>
    // URL the backend returned — no Object URL juggling.
    if (custom?.kind === 'image') {
        return (
            <div
                aria-hidden
                style={{
                    ...BASE_STYLE,
                    opacity: 0.4,
                    backgroundImage: `url(${custom.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />
        );
    }

    // Custom upload: video.
    if (custom?.kind === 'video') {
        return (
            <video
                aria-hidden
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                preload="auto"
                key={custom.url}
                style={{
                    ...BASE_STYLE,
                    opacity: 0.45,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                }}
                onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = 'none'; }}
            >
                <source src={custom.url} type={custom.mimeType} />
            </video>
        );
    }

    // Active key matches nothing we know about (likely a stale ID from the
    // old IndexedDB-based picker). Render nothing; user can re-pick.
    return null;
}
