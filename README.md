# Vehicle Spare Parts Inventory System

Web admin panel + Android field app, both synced through **Supabase**.

## Features

### Web App (Admin)
- Login: **Username** `Admin` / **Password** `0000`
- Add/update stock: Item Code, Item Description, Qty, City, HUB Name
- View all inventory with search and HUB filter
- **Usage History** page — shows Android deductions with date, time, vehicle number, and qty

### Android App (Field)
- Select **HUB Name**
- Browse inventory list with search (item code + description)
- Tap item → enter **Qty to use** + **Vehicle Number** → **Save**
- Stock is reduced in Supabase; history appears on the web app

---

## 1. Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run the full script:
   ```
   supabase/schema.sql
   ```
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

4. Enable **Realtime** for `usage_history` (optional, for live web updates):
   - Database → Replication → add `usage_history` to publication

---

## 2. Web App Setup

```bash
cd web
npm install
```

Create `web/.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run:

```bash
npm run dev
```

Open http://localhost:5173 — login with **Admin** / **0000**.

---

## 3. Android App Setup (Android Studio)

1. Open **Android Studio**
2. **File → Open** → select folder:
   ```
   android/SparePartsInventory
   ```
3. Wait for Gradle sync to finish
4. Add Supabase credentials to `android/SparePartsInventory/gradle.properties`:

```properties
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

5. Connect a phone (USB debugging) or start an emulator
6. Click **Run** (green play button)

### App flow
1. **Select HUB** → View Inventory
2. **Search** by item code or name
3. **Tap item** → enter qty + vehicle number → **Save**
4. Check **Usage History** on the web app

---

## Project Structure

```
EV inv App/
├── supabase/schema.sql      # Database tables + deduct_stock function
├── web/                     # React + Vite admin panel
└── android/SparePartsInventory/  # Kotlin Android app
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `inventory` | Stock per item per HUB |
| `usage_history` | Deduction log from Android (date/time, vehicle, qty) |

The `deduct_stock` RPC safely reduces qty and writes history in one transaction.

---

## Security Note

The default RLS policies allow public read/write for quick setup. For production, enable Supabase Auth and restrict policies to authenticated users only.
