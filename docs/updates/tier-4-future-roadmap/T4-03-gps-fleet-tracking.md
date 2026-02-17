# T4-03: GPS Fleet Tracking

## Priority: Future Roadmap
## Effort: Very High
## Status: Not Started
## Files Affected: New: `components/FleetTracker.tsx`, `services/locationService.ts`

---

## Problem

Spray foam rigs are expensive ($100K+) assets that travel to job sites daily. Admin has no visibility into:
- Where rigs are currently located
- ETA to next job site
- Idle time / unauthorized use
- Mileage and fuel consumption
- Historical route data

## Solution

### Approach: Browser Geolocation API + Service Worker

Use the device's built-in GPS via the crew app. When a crew member clocks in and starts a job, their location is periodically reported.

```typescript
// services/locationService.ts
export const startLocationTracking = async (crewId: string, jobId: string) => {
  if (!('geolocation' in navigator)) return;
  
  const watchId = navigator.geolocation.watchPosition(
    async (position) => {
      await supabase.from('location_pings').insert({
        crew_id: crewId,
        job_id: jobId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: new Date().toISOString(),
      });
    },
    (error) => console.warn('Location error:', error),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
  );
  
  return watchId;
};
```

### Admin Map View

```tsx
// components/FleetTracker.tsx
// Using Leaflet (free) or Google Maps API
<MapContainer center={[39.8283, -98.5795]} zoom={5}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  {activeCrews.map(crew => (
    <Marker key={crew.id} position={[crew.lat, crew.lng]}>
      <Popup>
        <strong>{crew.name}</strong><br/>
        Job: {crew.currentJob}<br/>
        Status: {crew.isMoving ? '🚛 In Transit' : '🔧 On Site'}
      </Popup>
    </Marker>
  ))}
</MapContainer>
```

### Data Model

```sql
CREATE TABLE location_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL,
  job_id UUID,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- PostGIS extension for spatial queries
CREATE INDEX idx_location_pings_crew ON location_pings(crew_id, timestamp DESC);
```

### Features
1. **Live map** — Real-time crew/rig positions
2. **Route history** — Replay a day's routes
3. **Geofence alerts** — Notify admin if rig leaves operational area
4. **ETA tracking** — Estimated arrival time using distance to job site
5. **Mileage reports** — Daily/weekly/monthly distance traveled per rig

## Impact
- Asset security and accountability
- Improved dispatch and scheduling
- Customer ETA notifications (combine with T2-03)
- Mileage tracking for tax deductions
- Insurance compliance

## Complexity Notes
- Requires location permission (user consent flow)
- Battery drain consideration on mobile devices
- Privacy concerns — only track during work hours
- Consider GPS hardware integration for rigs (Phase 2)
- Enterprise-tier feature only
