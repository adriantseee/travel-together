This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, set up your environment variables by creating a `.env.local` file in the root directory with the following:

```
# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Mapbox API Token - Get from https://account.mapbox.com/
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# Google API Key with Places API enabled - Get from https://console.cloud.google.com/
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Maps Integration

The application uses a hybrid approach for maps to optimize costs and functionality:

1. **Mapbox GL JS**: Used for base maps and route visualization
   - Provides high-performance rendering and customizable styles
   - Handles all map display, interactions, and routes

2. **Google Places API**: Used for rich point-of-interest metadata
   - Provides detailed information about restaurants, attractions, etc.
   - Only used when adding places or getting detailed place information

3. **OpenStreetMap/Overpass API**: Used as a free backup data source
   - Provides alternative data when Google Places API is unavailable
   - Good for hiking trails and other specialized map data

4. **Caching System**: Reduces API calls and costs
   - Caches place data, directions, and search results
   - 24-hour expiration to maintain data freshness

To use these features, you'll need to provide API keys in your `.env.local` file as described above.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
