# Google Sign-In (HandCo API)

How the web client signs customers in with Google. Base URL: `/api/v1`. Google is the only provider for now.

## How it works

The API does the Google work. The client never needs a Google SDK, client secret, or Google client ID.

```
Web client                      HandCo API                       Google
    |  GET /auth/oauth/google/url  |                               |
    |----------------------------->|                               |
    |   { url, state }             |                               |
    |<-----------------------------|                               |
    |  save state, redirect browser to url ----------------------->|
    |                              |      user picks account       |
    |<---- /oauth/google/callback?code=...&state=... --------------|
    |  POST /auth/oauth/google { code, state }                     |
    |----------------------------->|  exchange code, read profile  |
    |                              |------------------------------>|
    |   { user, accessToken, refreshToken }                        |
    |<-----------------------------|                               |
```

Google sends the user back to **`{WEB_CLIENT_URL}/oauth/google/callback`** (for example `https://handco.onrender.com/oauth/google/callback`). The web client needs a page at that route. Let us know if you need it changed, since the URL must match the one registered with Google exactly.

## Step 1: get the Google URL

```
GET /api/v1/auth/oauth/google/url
```

No auth needed.

**200**
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&state=...",
  "state": "eyJpdiI6IkRx..."
}
```

- Save `state` (for example in `sessionStorage`). It is valid for **10 minutes**.
- Send the browser to `url` with a full page redirect (`window.location.assign(url)`), not a fetch or an iframe.
- Get a fresh URL every time the user clicks the button. Don't cache it.

## Step 2: handle the callback page

Google redirects to `/oauth/google/callback` with query params:

| Param | Meaning |
|-------|---------|
| `code` | One-time code to send to the API |
| `state` | Must equal the `state` saved in step 1 |
| `error` | Present instead of `code` if the user cancelled (`access_denied`) or Google failed |

On that page:

1. If `error` is present, show "Sign-in was cancelled" and send the user back to the sign-in page. Don't call the API.
2. Compare the `state` query param with the saved one. If they differ, stop and show a generic error. This protects against cross-site request forgery.
3. Remove the saved `state`, then call step 3 **once**. Codes are single use, so guard against React StrictMode double effects or re-renders (use a ref flag).
4. Replace the URL (`history.replaceState`) so the code isn't left in history.

## Step 3: exchange the code for tokens

```
POST /api/v1/auth/oauth/google
Content-Type: application/json
X-Cart-Id: <guest cart rid, if any>
```

```json
{
  "code": "4/0AeanS0Z...",
  "state": "eyJpdiI6IkRx..."
}
```

**200** (same shape as `/auth/login`):
```json
{
  "user": {
    "rid": "a1b2c3d4e5f6",
    "displayName": "Ada",
    "fullName": "Ada Lovelace",
    "email": "ada@example.com"
  },
  "accessToken": "12|Xyz...",
  "refreshToken": "q8L..."
}
```

Store tokens exactly as you do for email login. Use `accessToken` as `Authorization: Bearer ...` and renew with `POST /auth/refresh`.

As with login, sending the guest `X-Cart-Id` header merges the guest cart into the user's cart. Calling `POST /cart/merge` afterwards is still safe.

## What happens to accounts

| Situation | Result |
|-----------|--------|
| First time with this Google account, email not known | New customer account created. No password is set. |
| Google account used before | Signs in to the same account. |
| Email already has a password account | Google is linked to that account. The user can use either method from then on. |
| Email belongs to a different Google account or a staff account | `409 oauth_account_conflict`. Ask the user to sign in with email and password. |
| Google email not verified | `422 oauth_email_unverified`. |

Matching on email ignores case.

## Errors

All errors use the standard shape:

```json
{ "error": { "code": "oauth_invalid_state", "message": "The sign-in session expired or is invalid. Please try again." } }
```

| Status | `error.code` | When | Suggested UI |
|--------|--------------|------|--------------|
| 422 | `validation_error` | `code` or `state` missing | Restart sign-in |
| 422 | `oauth_invalid_state` | `state` tampered with or older than 10 minutes | "Your sign-in timed out. Please try again." |
| 401 | `oauth_failed` | Google rejected the code (already used, expired, or wrong redirect URL) | "Google sign-in failed. Please try again." |
| 422 | `oauth_email_unverified` | Google says the email isn't verified | Suggest email sign-up |
| 409 | `oauth_account_conflict` | Email is tied to another sign-in method | "Sign in with your email and password instead." |
| 422 | `unsupported_provider` | Provider other than `google` | n/a |

## Email-first sign-in

`POST /auth/check-email` now has a third `nextStep` for Google-only accounts:

```json
{ "exists": true, "nextStep": "oauth", "oauthProvider": "google" }
```

When you get `oauth`, show "Continue with Google" instead of a password field. These users have no password. They can set one later with **Forgot password**.

| `nextStep` | Show |
|------------|------|
| `register` | Registration form |
| `password` | Password field (a Google button can still be offered) |
| `oauth` | Google button |

## Example (React)

```tsx
// Sign-in button
async function startGoogleSignIn() {
  const res = await api.get('/auth/oauth/google/url');
  sessionStorage.setItem('google_oauth_state', res.data.state);
  window.location.assign(res.data.url);
}

// Route: /oauth/google/callback
export function GoogleCallbackPage() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const saved = sessionStorage.getItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_state');
    window.history.replaceState({}, '', window.location.pathname);

    if (params.get('error')) return goToSignIn('Sign-in was cancelled.');
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state || state !== saved) return goToSignIn('Something went wrong. Please try again.');

    api.post('/auth/oauth/google', { code, state })
      .then((res) => saveSessionAndRedirect(res.data))
      .catch((err) => goToSignIn(err.response?.data?.error?.message ?? 'Google sign-in failed.'));
  }, []);

  return <p>Signing you in...</p>;
}
```

If you need to send the user back to where they started (for example checkout), save that path in `sessionStorage` before the redirect and read it after step 3.

## Testing in Postman

1. Run **Auth > OAuth Google URL**. It saves `oauthState` and logs the `url`.
2. Open the `url` in a browser and sign in. You'll land on the web client callback URL. Copy the `code` query param (URL decoded).
3. Put it in the `googleAuthCode` variable and run **Auth > OAuth Google** within a few minutes.
