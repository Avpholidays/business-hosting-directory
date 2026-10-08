# Business Hosting — USA Business Directory

A GitHub Pages frontend with Supabase Auth, Postgres, Row Level Security, business-owner accounts, an admin panel, CSV import, and duplicate screening.

## Included

- Responsive directory homepage and business search (name/category + city/state/ZIP)
- Business-owner signup/login and listing submissions
- Admin panel for reviewing/publishing/deleting listings
- Admin CSV importer (up to 10 MB per file; split large files into smaller batches)
- Duplicate screening based on normalized business name + city + state + last 10 phone digits
- Supabase SQL schema with row-level security
- No service-role key in browser code

## 1. Create a Supabase project

1. Create a project at https://supabase.com/.
2. Open **SQL Editor**, create a query, paste all of `supabase/schema.sql`, and run it.
3. In **Authentication → URL Configuration**, set your Site URL to your GitHub Pages URL, e.g. `https://YOUR-USERNAME.github.io/business-hosting/`.
4. Add that URL to the allowed redirect URLs. For a project site, also allow `https://YOUR-USERNAME.github.io/**` if supported by the dashboard.
5. For testing, configure email confirmation as you prefer. In production, keep email confirmation enabled and configure SMTP/deliverability.

## 2. Configure the frontend

1. Open `config.js`.
2. Replace `https://YOUR_PROJECT_REF.supabase.co` with your Supabase project URL.
3. Replace `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with the project's publishable/anon key from **Project Settings → API**.
4. Never use a `service_role` or secret key in `config.js`, GitHub Pages, or any browser code.

The publishable/anon key is designed to be public. Database security must come from the RLS policies in `supabase/schema.sql`.

## 3. Create your admin account

1. Open the site after deploying it and create an account.
2. Confirm your email if confirmation is enabled.
3. In Supabase **SQL Editor**, run the following, replacing the email with your own:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'YOUR-EMAIL@example.com'
);
```

4. Sign out and sign back in. The admin dashboard should now be available.

New accounts are always assigned `business_owner`; users cannot promote themselves to admin through the website.

## 4. Deploy to GitHub Pages

1. Create a GitHub repository, e.g. `business-hosting`.
2. Upload `index.html`, `styles.css`, `app.js`, `config.js`, and the `supabase` folder to the repository root.
3. Commit the files.
4. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish the site. Set the exact published URL in Supabase Auth URL Configuration.
6. Open the site and test signup, login, listing submission, approval, search, and CSV import.

## 5. CSV import format

Use UTF-8 CSV with a header row. Required columns: `name`, `city`, `state`. Recommended columns:

```csv
name,category,phone,website,email,address,city,state,zip_code,description
"Oak Street Plumbing","Home Services","+1 512-555-0134","https://example.com","hello@example.com","123 Oak Street","Austin","TX","78701","Residential plumbing service"
```

CSV fields containing commas should be wrapped in double quotes. The importer handles quoted commas and escaped double quotes. It skips invalid state abbreviations and likely duplicates. Imported rows belong to the admin account that imported them. For third-party data, only import information you have permission to collect and republish, and respect each source's license and terms. Verify phone numbers, websites, and business status.

## 6. Security and behavior notes

- Public visitors can read only `published` listings.
- Business owners can submit pending listings and update their own listings; their edits are returned to pending review.
- Admin permissions are enforced in Postgres RLS, not only hidden in the UI.
- Owners cannot change their role through the browser.
- The initial version limits public search results to 100 and dashboard lists to 200 per view. Add pagination before growing substantially beyond that.
- Duplicate detection is a best-effort screen, not a guarantee. Similar businesses can share a name/address, and phone numbers can be missing or shared. Review imports before publishing.
- Business listings, images, ratings, and reviews should not be fabricated. This starter does not include customer reviews, paid subscriptions, or automatic external data sourcing.
- The UI loads Supabase JS and fonts from CDNs, so visitors need internet access.

## Troubleshooting

- **“Setup needed”**: check `config.js` values and reload the page.
- **Signup succeeds but no profile**: rerun `supabase/schema.sql`, check the trigger in Supabase, and inspect Auth logs.
- **Permission denied**: verify the schema was run and the account has the intended role.
- **Admin panel missing**: promote the correct account using the SQL in step 3, then sign out and back in.
- **GitHub Pages shows 404**: confirm files are in the repository root and Pages is enabled for the selected branch.
