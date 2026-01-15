import createCache from '@emotion/cache';

export const clientSideEmotionCache = createCache({ key: 'css', prepend: true });