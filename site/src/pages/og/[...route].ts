import { OGImageRoute } from 'astro-og-canvas';

/** Image Open Graph générée au build, avec les polices du site. Servie sur /og/index.png. */
export const { getStaticPaths, GET } = await OGImageRoute({
  pages: {
    index: {
      title: 'Le planning de vos enfants pour demain, chaque soir dans votre boîte.',
      description:
        'Une GitHub Action qui lit les flux iCal Pronote et envoie le planning et les devoirs du lendemain. Rien à héberger.\n\npronote-digest · open source · yoandev.co',
    },
  },
  getImageOptions: (_path, page: { title: string; description: string }) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[247, 243, 236]],
    border: { color: [31, 60, 207], width: 18, side: 'inline-start' },
    padding: 80,
    fonts: ['./src/fonts/Fraunces.ttf', './src/fonts/InstrumentSans.ttf'],
    font: {
      title: {
        color: [22, 23, 28],
        size: 66,
        lineHeight: 1.12,
        weight: 'Medium',
        families: ['Fraunces'],
      },
      description: {
        color: [75, 77, 87],
        size: 30,
        lineHeight: 1.4,
        weight: 'Normal',
        families: ['Instrument Sans'],
      },
    },
  }),
});
