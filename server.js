// Qinash Gebeya API: zero-dependency Node.js server with JSON-file persistence.
// For production, replace JSON storage with a managed database and use HTTPS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

// Load the included .env file without adding a runtime dependency.
try { for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && !m[2].startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2'); } } catch {}

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data', 'db.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@qinashgebeya.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const db = loadDb();
function loadDb() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { return { users: [], products: seedProducts(), orders: [], sessions: {} }; }
}
function save() { fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function id() { return crypto.randomUUID(); }
function hashPassword(p, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(String(p), salt, 64, (e, k) => e ? reject(e) : resolve(`${salt}:${k.toString('hex')}`)));
}
async function validPassword(p, stored) { const [salt, key] = (stored || ':').split(':'); const test = await hashPassword(p, salt); return crypto.timingSafeEqual(Buffer.from(test.split(':')[1], 'hex'), Buffer.from(key || '', 'hex')); }
function seedProducts() {
  const now = new Date().toISOString();
  return [
    { id: id(), name: 'Handwoven Ethiopian Cotton Scarf', description: 'Soft, breathable cotton woven by local artisans.', price: 1450, stock: 12, category: 'Fashion', image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Liya Craft House', status: 'active', createdAt: now },
    { id: id(), name: 'Traditional Clay Coffee Pot', description: 'Hand-finished jebena for a beautiful coffee ceremony.', price: 2200, stock: 8, category: 'Home', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Addis Living', status: 'active', createdAt: now },
    { id: id(), name: 'Leather Everyday Sandals', description: 'Locally made genuine leather sandals. Sizes 36–44.', price: 1850, stock: 16, category: 'Fashion', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Selam Studio', status: 'active', createdAt: now },
    { id: id(), name: 'Single-origin Ethiopian Coffee', description: 'Freshly roasted beans with notes of citrus and cocoa.', price: 980, stock: 30, category: 'Food', image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Buna Buna', status: 'active', createdAt: now },
    { id: id(), name: 'Woven Storage Basket', description: 'A colorful, sturdy basket woven from natural fibers.', price: 1250, stock: 9, category: 'Home', image: 'https://images.unsplash.com/photo-1593085260707-5377ba37f868?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Liya Craft House', status: 'active', createdAt: now },
    { id: id(), name: 'Artisan Gold-tone Earrings', description: 'Lightweight statement earrings inspired by Ethiopian forms.', price: 750, stock: 20, category: 'Accessories', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=85', merchantId: 'seed', merchantName: 'Selam Studio', status: 'active', createdAt: now }
  ];
}
function send(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', ...headers }); res.end(JSON.stringify(data)); }
function body(req) { return new Promise((resolve, reject) => { let s = ''; req.on('data', d => { s += d; if (s.length > 5e6) reject(new Error('Request too large. Use one product image under 3.5 MB.')); }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('Invalid JSON')); } }); }); }
function bearer(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
function userFor(req) { const session = db.sessions[bearer(req)]; return session && db.users.find(u => u.id === session); }
function publicUser(u) { const { passwordHash, verifyToken, ...safe } = u; return safe; }
function requireUser(req, res, role) { const u = userFor(req); if (!u) { send(res, 401, { error: 'Please sign in.' }); return null; } if (role && u.role !== role) { send(res, 403, { error: 'You do not have permission for this action.' }); return null; } return u; }
function mailConfirmation(user, link) {
  if (process.env.SMTP_HOST) {
    // SMTP is optional. Use SMTP_HOST/PORT/USER/PASS/FROM; require nodemailer only in live email setup.
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
      transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: user.email, subject: 'Confirm your Qinash Gebeya account', text: `Hello ${user.fullName},\n\nConfirm your email: ${link}\n\nMerchant accounts are reviewed before they can sell.` }).catch(e => console.error('Email delivery failed:', e.message));
    } catch { console.error('SMTP_HOST is set but nodemailer is not installed. Use the development verification link below or install nodemailer.'); console.log(`Verification link for ${user.email}: ${link}`); }
  } else console.log(`\n[DEV EMAIL] To: ${user.email}\nConfirm your account: ${link}\n`);
}
function staticFile(res, pathname) {
  let file = pathname === '/' ? path.join(ROOT, 'frontend', 'index.html') : path.join(ROOT, pathname.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file); const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.png':'image/png' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' }); res.end(buf);
  });
}
function stats() {
  const merchants = db.users.filter(u => u.role === 'merchant');
  const activeProducts = db.products.filter(p => p.status === 'active');
  const delivered = db.orders.filter(o => o.status === 'delivered');
  return { merchants: merchants.length, pendingMerchants: merchants.filter(u => u.approval === 'pending').length, approvedMerchants: merchants.filter(u => u.approval === 'approved').length, products: activeProducts.length, inventoryUnits: activeProducts.reduce((n,p) => n + Number(p.stock || 0), 0), orders: db.orders.length, pendingOrders: db.orders.filter(o => o.status === 'new' || o.status === 'confirmed').length, revenue: delivered.reduce((n,o) => n + o.total, 0), delivered: delivered.length };
}
async function route(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`), p = url.pathname;
  if (p.startsWith('/api/')) {
    try {
      const input = ['POST','PATCH'].includes(req.method) ? await body(req) : {};
      if (p === '/api/health') return send(res, 200, { ok: true, name: 'Qinash Gebeya API' });
      if (p === '/api/products' && req.method === 'GET') return send(res, 200, db.products.filter(x => x.status === 'active'));
      if (p === '/api/register' && req.method === 'POST') {
        const { fullName, email, phone, password, businessName, city } = input;
        if (!fullName || !email || !phone || !password || !businessName) return send(res, 400, { error: 'Complete your name, email, phone, business name, and password.' });
        if (String(password).length < 8) return send(res, 400, { error: 'Password must be at least 8 characters.' });
        if (String(email).trim().toLowerCase() === ADMIN_EMAIL) return send(res, 409, { error: 'This email is reserved for the platform administrator.' });
        if (db.users.some(u => u.email === String(email).toLowerCase())) return send(res, 409, { error: 'An account with this email already exists.' });
        const u = { id: id(), fullName: String(fullName).trim(), email: String(email).trim().toLowerCase(), phone: String(phone).trim(), businessName: String(businessName).trim(), city: String(city || '').trim(), role: 'merchant', emailVerified: false, approval: 'pending', createdAt: new Date().toISOString(), passwordHash: await hashPassword(password), verifyToken: crypto.randomBytes(24).toString('hex') };
        db.users.push(u); save();
        const publicBase = (process.env.PUBLIC_URL || `http://${req.headers.host}`).replace(/\/$/, '');
        const link = `${publicBase}/api/verify?token=${u.verifyToken}`; mailConfirmation(u, link);
        return send(res, 201, { message: 'Registration received. Confirm your email, then wait for merchant approval.', account: publicUser(u), devVerificationUrl: process.env.SMTP_HOST ? undefined : link });
      }
      if (p === '/api/verify' && req.method === 'GET') {
        const u = db.users.find(x => x.verifyToken && x.verifyToken === url.searchParams.get('token'));
        if (!u) return send(res, 400, { error: 'This confirmation link is invalid or has already been used.' });
        u.emailVerified = true; delete u.verifyToken; save(); res.writeHead(302, { Location: '/?verified=1' }); return res.end();
      }
      if (p === '/api/login' && req.method === 'POST') {
        const email = String(input.email || '').toLowerCase();
        if (email === ADMIN_EMAIL && input.password === ADMIN_PASSWORD) {
          let admin = db.users.find(u => u.email === ADMIN_EMAIL);
          if (!admin) { admin = { id: 'admin', fullName: 'Platform Admin', email: ADMIN_EMAIL, phone: '', businessName: 'Qinash Gebeya', role: 'admin', emailVerified: true, approval: 'approved', createdAt: new Date().toISOString(), passwordHash: await hashPassword(ADMIN_PASSWORD) }; db.users.push(admin); save(); }
          const token = crypto.randomBytes(32).toString('hex'); db.sessions[token] = admin.id; save(); return send(res, 200, { token, user: publicUser(admin) });
        }
        const u = db.users.find(x => x.email === email);
        if (!u || !await validPassword(input.password || '', u.passwordHash)) return send(res, 401, { error: 'Email or password is incorrect.' });
        if (!u.emailVerified) return send(res, 403, { error: 'Please confirm your email using the link we sent.' });
        const token = crypto.randomBytes(32).toString('hex'); db.sessions[token] = u.id; save(); return send(res, 200, { token, user: publicUser(u) });
      }
      if (p === '/api/me' && req.method === 'GET') { const u = requireUser(req,res); if (u) return send(res, 200, publicUser(u)); }
      if (p === '/api/orders' && req.method === 'POST') {
        const { productId, quantity, customerName, phone, address, city } = input;
        const product = db.products.find(x => x.id === productId && x.status === 'active');
        const q = Math.floor(Number(quantity));
        if (!product || !q || q < 1 || q > product.stock || !customerName || !phone || !address) return send(res, 400, { error: 'Check the product, available quantity, name, phone, and delivery address.' });
        product.stock -= q;
        const deliveryMethod = input.deliveryMethod === 'pickup' ? 'pickup' : 'home';
        const deliveryFee = deliveryMethod === 'home' ? 150 : 0;
        const order = { id: id(), orderNo: `QG-${Date.now().toString().slice(-8)}`, productId, productName: product.name, merchantId: product.merchantId, merchantName: product.merchantName, customerName: String(customerName).trim(), phone: String(phone).trim(), address: String(address).trim(), city: String(city || '').trim(), quantity: q, unitPrice: product.price, deliveryMethod, deliveryFee, total: product.price*q+deliveryFee, paymentMethod: 'cash_on_delivery', status: 'new', createdAt: new Date().toISOString() };
        db.orders.unshift(order); save(); return send(res, 201, { order });
      }
      if (p === '/api/orders/lookup' && req.method === 'POST') { const o = db.orders.find(x => x.orderNo === String(input.orderNo || '').trim() && x.phone === String(input.phone || '').trim()); return o ? send(res,200,{order:o}) : send(res,404,{error:'No order found with that order number and phone.'}); }
      if (p === '/api/merchant/products' && req.method === 'POST') {
        const u = requireUser(req,res,'merchant'); if (!u) return;
        if (!u.emailVerified || u.approval !== 'approved') return send(res,403,{error:'Confirm your email and wait for admin approval before posting products.'});
        const { name, description, category, image } = input, price = Number(input.price), stock = Math.floor(Number(input.stock));
        if (!name || !description || !category || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) return send(res,400,{error:'Add a product name, description, category, valid Birr price, and stock quantity.'});
        const condition = input.condition === 'used' ? 'used' : 'new';
        const imageValue = String(image || '');
        if (imageValue.length > 4_500_000) return send(res,413,{error:'Image is too large. Upload one image under 3.5 MB.'});
        if (imageValue && !/^https:\/\//i.test(imageValue) && !/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(imageValue)) return send(res,400,{error:'Use a public HTTPS image URL or upload one JPG, PNG, or WebP image.'});
        const product = { id:id(), name:String(name).trim(), description:String(description).trim(), category:String(category), condition, price, stock, image:imageValue, merchantId:u.id, merchantName:u.businessName, status:'active', createdAt:new Date().toISOString() };
        db.products.unshift(product); save(); return send(res,201,{product});
      }
      if (p === '/api/merchant/summary' && req.method === 'GET') {
        const u = requireUser(req,res,'merchant'); if (!u) return;
        const products = db.products.filter(x=>x.merchantId===u.id), orders=db.orders.filter(x=>x.merchantId===u.id);
        return send(res,200,{ user:publicUser(u), products, orders, stats:{ products:products.length, inventoryUnits:products.reduce((n,x)=>n+x.stock,0), orders:orders.length, pendingOrders:orders.filter(x=>x.status==='new'||x.status==='confirmed').length, fulfilled:orders.filter(x=>x.status==='delivered').length, revenue:orders.filter(x=>x.status==='delivered').reduce((n,x)=>n+x.total,0) } });
      }
      if (p.startsWith('/api/merchant/orders/') && req.method === 'PATCH') {
        const u=requireUser(req,res,'merchant'); if(!u)return;
        const order=db.orders.find(x=>x.id===p.split('/').pop()&&x.merchantId===u.id); if(!order)return send(res,404,{error:'Order not found.'});
        const allowed=['confirmed','out_for_delivery','delivered','cancelled']; if(!allowed.includes(input.status))return send(res,400,{error:'Invalid order status.'});
        if(order.status==='delivered'||order.status==='cancelled')return send(res,409,{error:'This order is already closed.'});
        order.status=input.status; order.updatedAt=new Date().toISOString(); if(input.status==='cancelled'){const product=db.products.find(x=>x.id===order.productId);if(product)product.stock+=order.quantity;} save();return send(res,200,{order});
      }
      if (p === '/api/admin/summary' && req.method === 'GET') { const u=requireUser(req,res,'admin'); if(!u)return; return send(res,200,{stats:stats(), merchants:db.users.filter(x=>x.role==='merchant').map(publicUser), products:db.products, orders:db.orders}); }
      if (p.startsWith('/api/admin/merchants/') && req.method === 'PATCH') {
        const u=requireUser(req,res,'admin'); if(!u)return;
        const merchant=db.users.find(x=>x.id===p.split('/').pop()&&x.role==='merchant'); if(!merchant)return send(res,404,{error:'Merchant not found.'});
        if(!merchant.emailVerified)return send(res,409,{error:'Merchant must confirm email before approval.'});
        if(!['approved','rejected'].includes(input.approval))return send(res,400,{error:'Approval must be approved or rejected.'});
        merchant.approval=input.approval;merchant.reviewedAt=new Date().toISOString();save();return send(res,200,{merchant:publicUser(merchant)});
      }
      if (p === '/api/admin/orders' && req.method === 'GET') { const u=requireUser(req,res,'admin'); if(!u)return; return send(res,200,db.orders); }
      return send(res,404,{error:'API route not found.'});
    } catch (e) { console.error(e); return send(res,400,{error:e.message || 'Request failed.'}); }
  }
  if (req.method === 'GET') return staticFile(res,p);
  send(res,404,{error:'Not found.'});
}
if (!fs.existsSync(DATA)) save();
http.createServer(route).listen(PORT, '0.0.0.0', () => console.log(`Qinash Gebeya listening on port ${PORT}\nAdmin: ${ADMIN_EMAIL} (set ADMIN_PASSWORD before public deployment)`));
