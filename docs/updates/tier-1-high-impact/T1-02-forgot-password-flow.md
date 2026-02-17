# T1-02: Forgot Password Flow

## Priority: High Impact
## Effort: Low
## Status: Not Started
## Files Affected: `components/LoginPage.tsx`, `services/auth.ts`

---

## Problem

There is no "Forgot Password" functionality. If an admin user forgets their password, they have no way to recover their account within the app. They'd need to contact support or use Supabase dashboard directly.

## Solution

Supabase provides a built-in `resetPasswordForEmail()` method. We just need a UI flow.

### Step 1: Add Reset Function to Auth Service

```typescript
// services/auth.ts
export const sendPasswordReset = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
};
```

### Step 2: Add Password Reset UI to LoginPage

Add a "Forgot Password?" link below the password field that toggles a reset form:

```tsx
// State
const [showForgotPassword, setShowForgotPassword] = useState(false);
const [resetEmail, setResetEmail] = useState('');
const [resetSent, setResetSent] = useState(false);

// Reset handler
const handlePasswordReset = async () => {
  if (!resetEmail) return setError('Please enter your email address');
  try {
    setIsLoading(true);
    await sendPasswordReset(resetEmail);
    setResetSent(true);
  } catch (err: any) {
    setError(err.message || 'Failed to send reset email');
  } finally {
    setIsLoading(false);
  }
};
```

### Step 3: UI Layout

```tsx
{showForgotPassword ? (
  <div className="space-y-4">
    <h3 className="text-lg font-black text-slate-900">Reset Password</h3>
    {resetSent ? (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-sm">
        Check your email for a password reset link. It may take a few minutes.
      </div>
    ) : (
      <>
        <p className="text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>
        <input
          type="email"
          value={resetEmail}
          onChange={(e) => setResetEmail(e.target.value)}
          placeholder="admin@company.com"
          className="w-full px-4 py-3 border rounded-xl"
        />
        <button onClick={handlePasswordReset} className="w-full py-3 bg-brand text-white rounded-xl font-bold">
          Send Reset Link
        </button>
      </>
    )}
    <button onClick={() => setShowForgotPassword(false)} className="text-sm text-brand font-bold">
      ← Back to Login
    </button>
  </div>
) : (
  // ... existing login form
  <button onClick={() => setShowForgotPassword(true)} className="text-sm text-brand font-bold">
    Forgot Password?
  </button>
)}
```

### Step 4: Handle Reset Redirect (Optional)

If implementing client-side routing (T1-01), add a `/reset-password` route that captures the token from the URL and lets the user set a new password:

```typescript
export const updatePassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
};
```

## Impact
- Users can self-service password recovery
- Reduces support burden
- Standard expected functionality for any SaaS app

## Testing
1. Go to login page → click "Forgot Password?"
2. Enter a valid email → verify "Check your email" message appears
3. Check email inbox for Supabase reset link
4. Click link → verify redirect to app with new password form
5. Set new password → verify login works with new credentials
6. Test with invalid email → verify error handling
