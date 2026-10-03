# Qinash Gebeya Marketplace

A deployable full-stack marketplace starter based on the supplied Qinash Gebeya storefront (`qinashgebeya (6).html`). The home page uses the reference UI itself: full-screen swipeable product cards, Amharic/English controls, a clear new/used switch, one grouped category picker, saved items, nearby seller cards, image gallery, and swipe-in checkout. Amharic headings and category labels use Noto Serif Ethiopic. Merchant and central admin dashboards open from the feed header and use the same visual language.

## Included

- `frontend/` — reference storefront, one-image merchant uploads, COD order placement, merchant sign-in, and merchant/central dashboards.
- `backend/server.js` — Node.js HTTP API, email/password registration, email verification, merchant approval, inventory, order management, and admin metrics.
- `Dockerfile` — container setup for the Docker Web Service shown in your Render dashboard.
- `data/db.json` — local JSON persistence. The first run seeds example products; replace these sample listings before launch.
- `start-windows.bat` — Windows double-click startup.

## Run locally

1. Install Node.js 18 or later.
2. Copy `.env.example` to `.env`. Set a private admin email and a long, unique `ADMIN_PASSWORD`. For hosted use, set `PUBLIC_URL` to your HTTPS domain so email links point to the live site.
3. Double-click `start-windows.bat` or run `node backend/server.js` from this folder.
4. Open `http://localhost:3000`.
5. Sign into the central dashboard using the configured admin email and password.

The server uses only Node.js built-ins for core functions, so it starts without installing packages. For actual confirmation email, configure the SMTP values in `.env` and run `npm install` once (Nodemailer is an optional dependency). With no SMTP configured, the app prints a local verification URL to the server terminal and displays it after local registration.

## Deploying on Netlify

The project root now has an `index.html` entry page so a manual Netlify deploy of the complete project folder does not show a root 404. This is only a static preview: Netlify does not run this project's long-running `backend/server.js`, so sign-in, email confirmation, uploads, and order APIs will not work from that static deploy. For the full marketplace, deploy the Node service to a host that runs Node and provides persistent storage (see the Render steps below in the setup instructions we shared). If you use Netlify for the front end and a separate API host, the front-end API URL must be configured to point at that backend.

## Deploying from the Docker service in Render

The repository needs a commit before Render can build it. Upload the contents of this folder to the connected GitHub repository, including the root `Dockerfile`. The Render service shown in the setup screenshots is already set to Docker, so the Dockerfile supplies the Node runtime and starts `npm start`. In Render, add `ADMIN_EMAIL`, a strong `ADMIN_PASSWORD`, `PUBLIC_URL`, and the optional SMTP environment variables. The health check path is `/api/health`. To keep `data/db.json` across restarts, attach a persistent disk at `/app/data`; Render documents persistent disks for paid services, while a free instance is suitable for a preview but not for durable business orders.

## Merchant lifecycle

1. Merchant submits their full name, shop name, email, phone, city, and password.
2. The merchant confirms their email via the link.
3. The admin signs in, reviews the merchant in the central dashboard, and approves or rejects the account.
4. Approved merchants add product details, condition, one uploaded image (JPG, PNG, or WebP), Birr price, and stock; these listings appear in the storefront.
5. Customers order with their name, phone, city/area, delivery address, and quantity. The app reserves stock and sets payment to `cash_on_delivery`.
6. The merchant confirms the order, marks it out for delivery, then delivered (or cancels). Cancellation returns reserved stock. The dashboard totals delivered order value as collected-on-delivery revenue.

## API quick reference

All request/response data is JSON. Authenticated routes accept `Authorization: Bearer <token>`.

| Method | Path | Use |
|---|---|---|
| GET | `/api/health` | Service check |
| GET | `/api/products` | Active storefront catalog |
| POST | `/api/register` | Merchant account registration |
| GET | `/api/verify?token=…` | Confirm merchant email |
| POST | `/api/login` | Merchant/admin sign-in |
| GET | `/api/me` | Current account |
| POST | `/api/orders` | Public COD order placement |
| POST | `/api/orders/lookup` | Order lookup by order number and phone |
| POST | `/api/merchant/products` | Publish a product (approved merchant) |
| GET | `/api/merchant/summary` | Merchant products, orders, and metrics |
| PATCH | `/api/merchant/orders/:id` | Set `confirmed`, `out_for_delivery`, `delivered`, or `cancelled` |
| GET | `/api/admin/summary` | Platform metrics, merchants, products, orders |
| PATCH | `/api/admin/merchants/:id` | Set `approval` to `approved` or `rejected` |

## Before taking real orders

This package is a runnable business starter, not a substitute for business onboarding and production hosting. It uses a local JSON file and in-memory bearer sessions to keep setup simple; run one app instance on persistent storage only, and move to a database and durable session store before scaling or handling significant traffic. Deploy behind HTTPS on a host with persistent storage and backups. Configure a real SMTP provider and a verified sender domain so verification email is delivered. Set secure unique secrets, replace sample catalog content, confirm delivery coverage and merchant terms, and test real devices and workflows before announcing the business. Product image URLs must be publicly reachable HTTPS images. No card, bank, mobile-money, or payment processor integration is included: customer payment is explicitly cash on delivery.

The admin password is read from `.env` at startup. Keep `.env` private and never upload it to a public source repository. The example admin login works only with the default configuration; change it before a public launch.
