import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_KEY, findBuiltin } from './presets';
import {
    deleteBackdrop,
    getBackdrops,
    uploadBackdrop,
    type BackdropEntry,
} from '@/modules/api/endpoints';

const STORAGE_KEY = 'pokemon.background';

interface BackdropContextValue {
    active: string;
    setActive: (key: string) => void;
    customs: BackdropEntry[];
    addCustom: (file: File) => Promise<BackdropEntry>;
    removeCustom: (name: string) => Promise<void>;
    isLoading: boolean;
    refresh: () => Promise<void>;
}

const BackdropContext = createContext<BackdropContextValue | null>(null);

// Read a File as a base64 string (no data: prefix).
function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.onload = () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                reject(new Error('FileReader did not return a string'));
                return;
            }
            // result is a data: URL; strip the "data:<mime>;base64," prefix.
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.readAsDataURL(file);
    });
}

export function BackdropProvider({ children }: { children: ReactNode }) {
    const [active, setActive] = useState<string>(() => {
        if (typeof window === 'undefined') return DEFAULT_KEY;
        return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_KEY;
    });
    const [customs, setCustoms] = useState<BackdropEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const rows = await getBackdrops();
            setCustoms(rows);
        } catch (err) {
            console.error('Failed to load custom backdrops:', err);
        }
    }, []);

    // Initial fetch.
    useEffect(() => {
        let cancelled = false;
        getBackdrops()
            .then((rows) => { if (!cancelled) setCustoms(rows); })
            .catch((err) => { console.error('Failed to load custom backdrops:', err); })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, active);

        // Built-ins and the parchment default can be classified immediately.
        // For a name that isn't a built-in we have to wait for the API call
        // to finish — otherwise we'd briefly mis-tag a custom as 'builtin',
        // applying the wrong CSS readability rules during the load round-trip.
        if (active === DEFAULT_KEY) {
            document.documentElement.setAttribute('data-backdrop', 'parchment');
            return;
        }
        if (findBuiltin(active)) {
            document.documentElement.setAttribute('data-backdrop', 'builtin');
            return;
        }
        if (isLoading) return;

        const isCustom = customs.some((c) => c.name === active);
        document.documentElement.setAttribute('data-backdrop', isCustom ? 'custom' : 'parchment');
    }, [active, customs, isLoading]);

    const addCustom = useCallback(async (file: File) => {
        const dataBase64 = await readAsBase64(file);
        const created = await uploadBackdrop({
            filename: file.name,
            mimeType: file.type,
            dataBase64,
        });
        setCustoms((prev) => [created, ...prev]);
        return created;
    }, []);

    const removeCustom = useCallback(async (name: string) => {
        await deleteBackdrop(name);
        setCustoms((prev) => prev.filter((c) => c.name !== name));
        // If the deleted backdrop is currently active, fall back to default.
        setActive((cur) => (cur === name ? DEFAULT_KEY : cur));
    }, []);

    const value = useMemo<BackdropContextValue>(
        () => ({ active, setActive, customs, addCustom, removeCustom, isLoading, refresh }),
        [active, customs, addCustom, removeCustom, isLoading, refresh],
    );
    return <BackdropContext.Provider value={value}>{children}</BackdropContext.Provider>;
}

export function useBackdrop(): BackdropContextValue {
    const ctx = useContext(BackdropContext);
    if (!ctx) throw new Error('useBackdrop must be used inside <BackdropProvider>');
    return ctx;
}
