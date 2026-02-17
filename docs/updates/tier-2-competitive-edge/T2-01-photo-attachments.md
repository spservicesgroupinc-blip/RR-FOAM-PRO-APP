# T2-01: Photo Attachments on Jobs

## Priority: Medium Impact — Competitive Edge
## Effort: Medium
## Status: Not Started
## Files Affected: `components/CrewDashboard.tsx`, `components/EstimateDetail.tsx`, `services/supabaseService.ts`, `types.ts`

---

## Problem

Spray foam crews regularly need to document job sites with photos (before/during/after installation). Currently there's no way to attach photos to jobs. The `sitePhotos` field already exists on `EstimateRecord` but is unused.

## Solution

### Key Components

1. **Photo Upload in CrewDashboard** — Camera capture or gallery select during job execution
2. **Photo Gallery in EstimateDetail** — Admin can view all photos for a job
3. **Supabase Storage** — Store in `site-photos/{orgId}/{estimateId}/` bucket
4. **Thumbnail Generation** — Compress images client-side before upload

### Implementation

```tsx
// Crew-side upload component
const PhotoUpload: React.FC<{ estimateId: string; orgId: string }> = ({ estimateId, orgId }) => {
  const [photos, setPhotos] = useState<string[]>([]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const compressed = await compressImage(file, 1200, 0.8); // max 1200px, 80% quality
      const path = `site-photos/${orgId}/${estimateId}/${Date.now()}-${file.name}`;
      const { data } = await supabase.storage.from('documents').upload(path, compressed);
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
        setPhotos(prev => [...prev, publicUrl]);
      }
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" capture="environment" multiple onChange={handleCapture} />
      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, i) => <img key={i} src={url} className="rounded-xl object-cover aspect-square" />)}
      </div>
    </div>
  );
};
```

### Photo Categories
- **Before** — Site condition pre-installation
- **During** — Active spray foam application
- **After** — Completed installation
- **Issue** — Problems found (moisture, gaps, etc.)

## Database

```sql
CREATE TABLE site_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id),
  organization_id UUID REFERENCES organizations(id),
  storage_path TEXT NOT NULL,
  public_url TEXT,
  category TEXT DEFAULT 'general', -- before, during, after, issue
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Impact
- Visual documentation for disputes and quality assurance
- Proof of work for customers
- Insurance/warranty documentation
- The `sitePhotos` field already exists — just needs wiring up

## Testing
1. Crew: Take photos during job → verify upload and preview
2. Admin: Open estimate detail → verify photo gallery loads
3. Test with poor connectivity → verify graceful handling
4. Test camera capture on mobile (iOS + Android)
5. Verify photos are organized by estimate in Supabase storage
