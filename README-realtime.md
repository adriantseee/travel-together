# Real-Time Collaboration for Travel Together

This guide explains how to set up and use the real-time collaboration feature in the Travel Together app, which allows multiple users to simultaneously edit a trip itinerary and see each other's changes in real-time, similar to Google Docs.

## Features

- **Live User Presence**: See who is currently viewing and editing the trip in real-time
- **Collaborative Editing**: Multiple users can add and modify events at the same time
- **Real-Time Updates**: Changes made by any user are instantly visible to all participants
- **Edit Mode**: Double-click a day to enter collaborative edit mode with separate columns per user
- **Conflict Prevention**: Edit mode organizes events by creator to prevent conflicts

## Technical Implementation

The real-time functionality is built using:

1. **Supabase Realtime**: For database change subscriptions and presence tracking
2. **PostgreSQL**: For storing trip events and participant information
3. **React**: For state management and UI updates

## Setup Instructions

### 1. Database Setup

First, you need to create the required database table and functions:

1. Connect to your Supabase project as an admin user
2. Run the `exec_sql.sql` function to allow safely executing SQL:
   ```sql
   -- Run this in the Supabase SQL Editor
   CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
   RETURNS VOID
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     EXECUTE sql_query;
   END;
   $$;
   ```

3. Enable real-time for your Supabase project in the dashboard:
   - Go to Database → Replication
   - Make sure "Source" is enabled
   - Click "Save"

4. Run the migration to create the `trip_events` table:
   - POST to `/api/db-migrations` (admin only)

### 2. Enable Supabase Realtime Client

Make sure your Supabase client is configured with realtime enabled:

```javascript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
```

## Using Real-Time Collaboration

1. **Sharing a Trip**:
   - Click the "+" button next to the participants list
   - Enter email addresses of users to collaborate with
   - Click "Share"

2. **Viewing Active Users**:
   - Active users are shown with a green dot indicator
   - Their avatar appears in the participants list

3. **Collaborative Editing**:
   - Click a day twice to enter "Edit Mode"
   - In edit mode, each user gets their own column
   - Add events to your column
   - Other users' events will appear in their respective columns
   - Click "Exit Edit Mode" to return to the normal view

4. **Real-Time Status**:
   - A "Live" indicator shows when real-time is connected
   - "Connecting..." when establishing connection
   - "Offline" if real-time is disconnected

## Troubleshooting

- **Not seeing others' changes?** Check the "Live" indicator status
- **Changes not saving?** Ensure you have the correct permissions on the trip
- **Edit mode not working?** Try refreshing the page or check for console errors

## Technical Details

The implementation uses:
- Supabase Presence for tracking active users
- Supabase Postgres Changes for syncing database updates
- React state management for UI updates
- Row Level Security (RLS) to control access to events

## Architecture

```
Client A                        Supabase                       Client B
┌────────────┐                ┌─────────────┐                ┌────────────┐
│            │◄──Subscribe────┤             │────Subscribe──►│            │
│  Calendar  │                │  Realtime   │                │  Calendar  │
│  Component │─────Insert────►│  Service    │◄────Insert─────│  Component │
│            │◄────Update─────┤             │─────Update────►│            │
└────────────┘                └─────────────┘                └────────────┘
                                     ▲
                                     │
                                     ▼
                              ┌─────────────┐
                              │             │
                              │  PostgreSQL │
                              │  Database   │
                              │             │
                              └─────────────┘
``` 