# Next.js 16 & React 19 Development Guidelines

PaperPilot is built on the bleeding edge of the React ecosystem: **Next.js 16** and **React 19**, with the **React Compiler** enabled. This document establishes the standard conventions and best practices for developing within this modern architecture.

---

## 1. Data Mutations & Forms (Server Actions)

We strictly prefer **Server Actions** (`"use server"`) over traditional API Routes (`/api/...`) for data mutations, database writes, and authentication flows. This eliminates the need for manual `fetch` calls, JSON serialization, and complex state management in the client.

### ❌ Outdated Pattern (Pre-React 19)
```tsx
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await fetch('/api/submit', { method: 'POST', body: JSON.stringify(data) });
    // Handle response...
  } finally {
    setLoading(false);
  }
}
```

### ✅ Modern Pattern (React 19 + Server Actions)
```tsx
import { useActionState } from 'react';
import { submitDataAction } from '@/app/actions/submit';

export default function MyForm() {
  // useActionState provides the current state, an action dispatcher, and a pending boolean
  const [state, action, isPending] = useActionState(submitDataAction, { error: null, success: false });

  return (
    <form action={action}>
      <input name="email" type="email" />
      {state.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## 2. Asynchronous Next.js APIs (Next.js 15+)

In Next.js 15 and 16, dynamic APIs like `params`, `searchParams`, `cookies()`, and `headers()` are **Promises**. They must be resolved before accessing their properties.

### Server Components
Use standard `await`:
```tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  // ...
}
```

### Client Components
Use `React.use()` to unwrap the promise:
```tsx
"use client";
import { use } from 'react';

export default function ClientComponent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // ...
}
```

---

## 3. React Compiler (Zero Manual Memoization)

Because `babel-plugin-react-compiler` is configured in our `package.json`, React automatically memoizes components, hooks, and calculations at build time.

- **DO NOT** use `useMemo` to cache expensive calculations.
- **DO NOT** use `useCallback` to stabilize function references.
- **DO NOT** wrap components in `React.memo()`.

Just write clean, idiomatic JavaScript and let the compiler handle the optimizations.

---

## 4. UI Interactions (`useTransition` & `useOptimistic`)

For non-form interactions (like clicking a "Like" button or a "Delete" icon) that trigger Server Actions, use `useTransition` to handle the loading state, or `useOptimistic` for instant UI feedback.

```tsx
import { useTransition } from 'react';
import { deleteItemAction } from '@/app/actions/items';

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await deleteItemAction(id);
    });
  };

  return (
    <button onClick={handleDelete} disabled={isPending}>
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
```

---

## 5. Supabase Integration with Server Actions

When writing Server Actions that interact with Supabase, always import the server client (`@/infrastructure/database/supabase/server`) and ensure your action file starts with `"use server"`.

```typescript
"use server";

import { createClient } from '@/infrastructure/database/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateProfile(prevState: any, formData: FormData) {
  const name = formData.get('name') as string;
  const supabase = await createClient();

  const { error } = await supabase.from('profiles').update({ name }).eq('id', user.id);

  if (error) return { error: error.message };
  
  revalidatePath('/profile');
  return { success: true };
}
```
