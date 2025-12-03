/**
 * js/script.js
 * Full Firebase Integration: Auth, Firestore
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile,
    signOut 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    addDoc, 
    deleteDoc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================
// 1. CONFIGURATION
// ==========================================

// 🔴🔴🔴 ENSURE YOU HAVE REPLACED THIS WITH YOUR CONFIG 🔴🔴🔴
const firebaseConfig = {
    apiKey: "AIzaSyDpJHXfOam_Wc1P8cqj9nr1ik60VxpbSXo",
    authDomain: "thriftandthread-7ea2e.firebaseapp.com",
    projectId: "thriftandthread-7ea2e",
    storageBucket: "thriftandthread-7ea2e.firebasestorage.app",
    messagingSenderId: "711699781004",
    appId: "1:711699781004:web:0a5268b7fa4ba8364c32a9",
    measurementId: "G-WWWTD65ZE2"
  };
// Initialize Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase Init Error:", error);
}

const appId = 'thriftandthread';

// Global State
let currentUser = null;
let productsCache = [];
let checkoutState = {
    shippingAddress: {},
    billingAddress: {},
    shippingMethod: 'standard',
    paymentMethod: 'card',
    cartItems: [] // Cache cart items here to avoid re-fetching
};

// ==========================================
// 2. MAIN ENTRY POINT
// ==========================================
async function initApp() {
    const path = window.location.pathname;
    
    // 1. Render UI Immediately (Static parts)
    if (!path.includes('checkout.html')) {
        renderHeader(); 
    }

    // 2. Initialize Public Page Logic
    if (path.includes('index.html') || path.endsWith('/')) initHome();
    if (path.includes('shop.html')) initShop();
    if (path.includes('product.html')) initProduct();
    if (path.includes('cart.html')) initCart();
    if (path.includes('login.html')) initLogin();
    // Note: checkout, account, wishlist are initialized AFTER auth check

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 3. Auth Listener (The Brain)
    if(auth) {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            updateHeaderAuthUI();
            
            // --- PROTECTED ROUTES LOGIC ---
            if (user) {
                // User is logged in
                updateCartCount(); // Refresh cart badge
                
                if (path.includes('account.html')) initAccount();
                if (path.includes('checkout.html')) initCheckout();
                if (path.includes('wishlist.html')) initWishlist();
                if (path.includes('admin.html')) initAdmin();

                // Redirect from login if already auth'd
                if (path.includes('login.html')) {
                    window.location.href = 'account.html';
                }
            } else {
                // User is NOT logged in
                if (path.includes('account.html') || path.includes('checkout.html') || path.includes('wishlist.html')) {
                    window.location.href = 'login.html';
                }
            }
        });
    }

    // 4. Token Auth
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e) { console.error("Token Auth Error", e); }
    }

    // 5. Seed Data
    await seedDatabaseIfNeeded();
}

// ==========================================
// 3. PAGE LOGIC (CHECKOUT & CART)
// ==========================================

// CHECKOUT
async function initCheckout() {
    if (!currentUser) return;

    const list = document.getElementById('checkout-items');
    if(list) list.innerHTML = '<p class="text-gray-400 text-sm">Loading your order...</p>';

    // Fetch once and store in state
    checkoutState.cartItems = await api.cart.list();
    
    if(list) {
        if(checkoutState.cartItems.length === 0) {
            alert("Your cart is empty");
            window.location.href = 'shop.html';
            return;
        }
        
        // Render Items
        list.innerHTML = checkoutState.cartItems.map(i => `
            <div class="flex gap-4">
                <div class="relative">
                    <img src="${i.image}" class="w-16 h-20 object-cover rounded bg-[#E9E0D4]">
                    <span class="absolute -top-2 -right-2 bg-[#2B2B2B] text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">${i.quantity}</span>
                </div>
                <div class="flex-1">
                    <h4 class="font-medium text-sm text-[#2B2B2B] line-clamp-1">${i.name}</h4>
                    <p class="text-xs text-gray-500">${i.brand} | ${i.size}</p>
                </div>
                <span class="text-sm font-medium">$${(i.price * i.quantity).toFixed(2)}</span>
            </div>
        `).join('');
        
        // Calculate Totals using cached data
        updateCheckoutTotals();
    }
}

window.updateShipping = (method) => {
    checkoutState.shippingMethod = method;
    const stdLabel = document.getElementById('ship-std-label');
    const expLabel = document.getElementById('ship-exp-label');
    
    if (method === 'standard') {
        stdLabel.classList.add('border-[#C9A66B]', 'bg-[#C9A66B]/5');
        expLabel.classList.remove('border-[#C9A66B]', 'bg-[#C9A66B]/5');
    } else {
        expLabel.classList.add('border-[#C9A66B]', 'bg-[#C9A66B]/5');
        stdLabel.classList.remove('border-[#C9A66B]', 'bg-[#C9A66B]/5');
    }
    
    // Recalculate without network request
    updateCheckoutTotals();
};

function updateCheckoutTotals() {
    const items = checkoutState.cartItems; // Use cached items
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    let shippingCost = 0;
    if (checkoutState.shippingMethod === 'express') shippingCost = 25;
    else shippingCost = subtotal >= 250 ? 0 : 15;

    const tax = subtotal * 0.08;
    const total = subtotal + shippingCost + tax;

    const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    
    setEl('checkout-subtotal', `$${subtotal.toFixed(2)}`);
    setEl('checkout-tax', `$${tax.toFixed(2)}`);
    setEl('checkout-total', `$${total.toFixed(2)}`);
    
    const shipEl = document.getElementById('checkout-shipping');
    if(shipEl) shipEl.innerText = shippingCost === 0 ? "Free" : `$${shippingCost.toFixed(2)}`;
    
    const payBtn = document.getElementById('pay-button');
    if(payBtn) payBtn.innerText = `Pay $${total.toFixed(2)}`;
}

window.goToStep = (step) => {
    if (step === 2) {
        const form = document.getElementById('checkout-form');
        if (!form.reportValidity()) return;
        
        const fd = new FormData(form);
        checkoutState.email = fd.get('email');
        checkoutState.shippingAddress = {
            firstName: fd.get('firstName'), lastName: fd.get('lastName'),
            address: fd.get('address'), apartment: fd.get('apartment'),
            city: fd.get('city'), state: fd.get('state'), zip: fd.get('zip'), country: fd.get('country')
        };
        
        document.getElementById('review-email').innerText = checkoutState.email;
        document.getElementById('review-address').innerText = `${checkoutState.shippingAddress.address}, ${checkoutState.shippingAddress.city}`;
    }

    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // Update Indicators logic here (simplified for brevity, same as previous)
};

window.placeOrder = async () => {
    const btn = document.getElementById('pay-button');
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;
    
    try {
        // Recalculate final values from state (no new fetch)
        const items = checkoutState.cartItems;
        const subtotal = items.reduce((a,b) => a + (b.price * b.quantity), 0);
        let shippingCost = checkoutState.shippingMethod === 'express' ? 25 : (subtotal >= 250 ? 0 : 15);
        const total = subtotal + shippingCost + (subtotal * 0.08);
        
        const orderPayload = {
            order_number: `TT-${Date.now().toString().slice(-6)}`,
            items: items,
            total: total,
            shipping_cost: shippingCost,
            customer_email: checkoutState.email,
            shipping_address: checkoutState.shippingAddress,
            payment_method: 'card',
            user_id: currentUser.uid
        };
        
        // Execute Order Creation
        await api.orders.create(orderPayload);
        
        // Clear Cart
        await api.cart.clear(items); // Pass items to optimize clear
        
        alert("Order Placed Successfully!");
        window.location.href = 'account.html';
    } catch (e) {
        console.error(e);
        alert("Error placing order: " + e.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// CART
async function initCart() {
    const list = document.getElementById('cart-items-list');
    if(!list) return;

    const items = await api.cart.list();
    const emptyState = document.getElementById('empty-cart-state');
    const content = document.getElementById('cart-content');
    
    if(items.length === 0) {
        content.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        content.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        list.innerHTML = items.map(i => `
            <div class="flex gap-4 mb-4 bg-white p-4 rounded shadow-sm fade-in">
                <a href="product.html?id=${i.product_id}" class="flex-shrink-0">
                    <img src="${i.image}" class="w-20 h-24 object-cover rounded">
                </a>
                <div class="flex-1">
                    <div class="flex justify-between">
                        <a href="product.html?id=${i.product_id}" class="font-medium text-[#2B2B2B]">${i.name}</a>
                        <button onclick="window.removeCartItem('${i.id}')" class="text-gray-400 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    <p class="text-sm text-gray-500">${i.brand} | Size: ${i.size}</p>
                    <div class="flex justify-between items-center mt-2">
                        <div class="flex items-center border rounded">
                            <button onclick="window.updateCartQuantity('${i.id}', ${(i.quantity||1)-1})" class="px-2 hover:bg-gray-100">-</button>
                            <span class="px-2 text-sm">${i.quantity||1}</span>
                            <button onclick="window.updateCartQuantity('${i.id}', ${(i.quantity||1)+1})" class="px-2 hover:bg-gray-100">+</button>
                        </div>
                        <p class="font-medium">$${(i.price * (i.quantity||1)).toFixed(2)}</p>
                    </div>
                </div>
            </div>
        `).join('');
        
        const total = items.reduce((a,b)=>a+(b.price*(b.quantity||1)),0);
        document.getElementById('summary-total').innerText = `$${total.toFixed(2)}`;
        document.getElementById('summary-subtotal').innerText = `$${total.toFixed(2)}`;
        lucide.createIcons();
    }
}

window.updateCartQuantity = (id, qty) => { if(qty > 0) api.cart.update(id, qty); };
window.removeCartItem = (id) => { if(confirm('Remove item?')) api.cart.remove(id); };

// ==========================================
// 4. OTHER PAGES
// ==========================================

function initLogin() {
    const form = document.getElementById('auth-form');
    if(!form) return;
    
    const toggleBtn = document.getElementById('toggle-btn');
    const nameField = document.getElementById('name-field');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('submit-btn');
    const toggleText = document.getElementById('toggle-text');
    let isSignUp = false;

    if(toggleBtn) {
        window.toggleAuthMode = () => {
            isSignUp = !isSignUp;
            if(isSignUp) {
                nameField.classList.remove('hidden');
                title.innerText = 'Create Account';
                submitBtn.innerText = 'Sign Up';
                toggleText.innerText = 'Already have account?';
                toggleBtn.innerText = 'Sign In';
            } else {
                nameField.classList.add('hidden');
                title.innerText = 'Welcome Back';
                submitBtn.innerText = 'Sign In';
                toggleText.innerText = "Don't have an account?";
                toggleBtn.innerText = 'Create One';
            }
        };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('input-email').value;
        const pass = document.getElementById('input-password').value;
        const name = document.getElementById('input-name').value;
        
        submitBtn.innerText = "Processing...";
        submitBtn.disabled = true;

        try {
            if (isSignUp) {
                const cred = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(cred.user, { displayName: name });
                window.location.href = 'account.html';
            } else {
                await signInWithEmailAndPassword(auth, email, pass);
                // Redirect handled in onAuthStateChanged
            }
        } catch (err) {
            alert(err.message);
            submitBtn.innerText = isSignUp ? "Sign Up" : "Sign In";
            submitBtn.disabled = false;
        }
    });
}

async function initAccount() {
    const loader = document.getElementById('account-loader');
    const content = document.getElementById('account-content');
    if(loader) loader.classList.add('hidden');
    if(content) content.classList.remove('hidden');

    if (!currentUser) return;

    const nameEl = document.getElementById('user-name');
    if(nameEl) nameEl.innerText = currentUser.displayName || 'User';
    
    const emailEl = document.getElementById('user-email');
    if(emailEl) emailEl.innerText = currentUser.email;
    
    const orders = await api.orders.list();
    const ordersList = document.getElementById('orders-list');
    if(ordersList) {
        if(orders.length === 0) {
            ordersList.innerHTML = `<p class="text-gray-500 text-center py-4">No orders yet.</p>`;
        } else {
            ordersList.innerHTML = orders.map(o => `
                <div class="border border-[#E9E0D4] p-4 rounded bg-white">
                    <div class="flex justify-between">
                        <p class="font-medium">${o.order_number}</p>
                        <p class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">${o.status}</p>
                    </div>
                    <div class="flex justify-between mt-2 text-sm text-gray-500">
                        <p>${new Date(o.created_date).toLocaleDateString()}</p>
                        <p class="font-medium text-[#2B2B2B]">$${o.total.toFixed(2)}</p>
                    </div>
                </div>
            `).join('');
        }
    }
    
    const wishlistGrid = document.getElementById('wishlist-grid');
    if(wishlistGrid) {
        const list = await api.wishlist.list();
        if(list.length === 0) {
            wishlistGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center">Wishlist empty.</p>`;
        } else {
            wishlistGrid.innerHTML = list.map(item => `
                <div class="group relative">
                    <a href="product.html?id=${item.product_id}">
                        <div class="aspect-[3/4] bg-[#E9E0D4] overflow-hidden mb-2 rounded"><img src="${item.image}" class="w-full h-full object-cover"></div>
                        <p class="text-sm font-medium">${item.name}</p>
                    </a>
                    <button onclick="window.removeFromWishlist('${item.id}')" class="absolute top-2 right-2 bg-white p-1 rounded shadow text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `).join('');
            if(typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

async function initWishlist() {
    const list = await api.wishlist.list();
    const container = document.getElementById('wishlist-grid');
    const emptyState = document.getElementById('empty-wishlist');
    const contentState = document.getElementById('wishlist-content');
    const countEl = document.getElementById('wishlist-count');
    
    if (list.length === 0) {
        if(contentState) contentState.classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
    } else {
        if(contentState) contentState.classList.remove('hidden');
        if(emptyState) emptyState.classList.add('hidden');
        if(countEl) countEl.innerText = `${list.length} items`;
        
        container.innerHTML = list.map(item => `
            <div class="bg-white rounded-lg overflow-hidden group shadow-sm fade-in relative">
                <div class="aspect-[3/4] overflow-hidden">
                    <img src="${item.image}" class="w-full h-full object-cover">
                </div>
                <div class="p-4">
                    <p class="font-medium truncate">${item.name}</p>
                    <p class="text-sm text-gray-500">$${item.price}</p>
                    <button onclick="window.moveToCart('${item.id}')" class="w-full mt-3 bg-[#2B2B2B] text-white py-2 text-sm rounded hover:bg-[#C9A66B]">Add to Bag</button>
                </div>
                <button onclick="window.removeFromWishlist('${item.id}')" class="absolute top-2 right-2 p-2 bg-white rounded-full text-red-500 shadow"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    }
}

async function initHome() {
    const container = document.getElementById('featured-products');
    if (container) {
        const products = await api.products.featured();
        const display = products.slice(0, 3);
        
        container.innerHTML = display.map(p => `
            <div class="group fade-in relative">
                <a href="product.html?id=${p.id}" class="block no-underline text-[#2B2B2B]">
                    <div class="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-200 mb-4">
                        <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                        
                        ${p.condition === 'Pristine' ? '<span class="absolute top-3 left-3 bg-[#C9A66B] text-white text-xs px-2 py-1 uppercase">Pristine</span>' : ''}
                        
                        <div class="absolute top-3 right-3 flex flex-col gap-2 z-10">
                            <button onclick="event.preventDefault(); event.stopPropagation(); window.addToWishlistSimple('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}', '${p.brand}', '${p.size}');" 
                                    class="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-[#C9A66B] hover:text-white cursor-pointer shadow-sm">
                                <i data-lucide="heart" class="w-4 h-4"></i>
                            </button>
                            <button onclick="event.preventDefault(); event.stopPropagation(); window.addToCartSimple('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}', '${p.brand}', '${p.size}');" 
                                    class="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-[#C9A66B] hover:text-white cursor-pointer shadow-sm">
                                <i data-lucide="shopping-bag" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-[#C9A66B] uppercase tracking-wider mb-1">${p.brand}</p>
                    <h3 class="font-serif text-lg m-0">${p.name}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="font-medium">$${p.price}</span>
                    </div>
                </a>
            </div>
        `).join('');
        lucide.createIcons();
        
        const heroSection = document.getElementById('hero-section');
        const heroBg = document.getElementById('hero-bg');
        if (heroSection && heroBg) {
            heroSection.addEventListener('mousemove', (e) => {
                const rect = heroSection.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                heroBg.style.transform = `translate(${x * -20}px, ${y * -20}px)`;
            });
        }
    }
}

// Helpers
window.addToCartSimple = (id, name, price, image, brand, size) => api.cart.add({ product_id: id, name, price, image, brand, size });
window.addToWishlistSimple = (id, name, price, image, brand, size) => api.wishlist.add({ product_id: id, name, price, image, brand, size });

async function initShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    const products = await api.products.list();
    const productCount = document.getElementById('product-count');
    const noResults = document.getElementById('no-results');

    function render(filtered) {
        if(productCount) productCount.innerText = `${filtered.length} items`;
        if (filtered.length === 0) {
            grid.classList.add('hidden');
            if(noResults) noResults.classList.remove('hidden');
        } else {
            grid.classList.remove('hidden');
            if(noResults) noResults.classList.add('hidden');
            grid.innerHTML = filtered.map(p => `
                <div class="group fade-in relative">
                    <a href="product.html?id=${p.id}" class="block no-underline text-[#2B2B2B]">
                        <div class="relative aspect-[3/4] overflow-hidden rounded bg-gray-200 mb-4">
                            <img src="${p.image}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                            <button onclick="event.preventDefault(); event.stopPropagation(); window.addToWishlistSimple('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, '${p.image}', '${p.brand}', '${p.size}');" 
                                    class="absolute top-3 right-3 p-2 bg-white rounded-full hover:text-[#C9A66B] cursor-pointer z-10 shadow-sm">
                                <i data-lucide="heart" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">${p.brand}</p>
                        <h3 class="font-medium m-0 text-base">${p.name}</h3>
                        <p class="font-medium mt-1">$${p.price}</p>
                    </a>
                </div>
            `).join('');
            lucide.createIcons();
        }
    }

    function applyFilters() {
        const searchInput = document.getElementById('search-input');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const selectedCats = Array.from(document.querySelectorAll(`input[name="category"]:checked`)).map(cb => cb.value);
        
        const filtered = products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search);
            const matchesCat = selectedCats.length === 0 || selectedCats.includes(p.category);
            return matchesSearch && matchesCat;
        });
        render(filtered);
    }

    document.body.addEventListener('change', (e) => { if(e.target.name === 'category') applyFilters(); });
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.addEventListener('input', applyFilters);
    applyFilters();
}

function initAdmin() { if(!currentUser) { window.location.href='login.html'; } }

// --- Shared UI/DB Helpers ---
function renderHeader() {
    const container = document.getElementById('header-container');
    if (!container) return;

    const userLink = currentUser 
        ? `<a href="account.html" class="p-2 hover:text-[#C9A66B]" title="My Account"><i data-lucide="user" class="w-5 h-5 text-[#C9A66B]"></i></a>`
        : `<a href="login.html" class="p-2 hover:text-[#C9A66B]" title="Sign In"><i data-lucide="user" class="w-5 h-5"></i></a>`;

    const headerHtml = `
        <div class="block bg-[#2B2B2B] text-white text-xs py-2">
            <div class="max-w-7xl mx-auto px-6 flex justify-between items-center">
                <span class="tracking-wider">Complimentary shipping on orders over $250</span>
                <span class="tracking-wider hidden sm:inline">Authenticated luxury, consciously curated</span>
            </div>
        </div>
        <nav class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button class="md:hidden p-2 -ml-2" onclick="window.toggleMobileMenu()">
                <i data-lucide="menu" class="w-6 h-6"></i>
            </button>

            <a href="index.html" class="font-serif text-2xl tracking-wide text-[#2B2B2B] no-underline">
                Thrift & Thread
            </a>

            <div class="hidden md:flex items-center space-x-8">
                <a href="shop.html?filter=new" class="nav-link">New Arrivals</a>
                <a href="shop.html?cat=dresses" class="nav-link">Dresses</a>
                <a href="shop.html?cat=outerwear" class="nav-link">Outerwear</a>
                <a href="shop.html?cat=accessories" class="nav-link">Accessories</a>
            </div>

            <div class="flex items-center space-x-4">
                <a href="shop.html" class="p-2 hover:text-[#C9A66B]"><i data-lucide="search" class="w-5 h-5"></i></a>
                <span id="auth-icon-container">${userLink}</span>
                <div class="relative">
                    <a href="cart.html" class="p-2 hover:text-[#C9A66B]">
                        <i data-lucide="shopping-bag" class="w-5 h-5"></i>
                        <span id="cart-count" class="cart-badge hidden">0</span>
                    </a>
                </div>
            </div>
        </nav>
        
        <div id="mobile-menu" class="hidden absolute top-full left-0 right-0 bg-[#F4EFE8] border-t border-[#E9E0D4] p-4 shadow-lg md:hidden">
            <a href="shop.html" class="block py-2 text-sm uppercase">Shop All</a>
            <a href="shop.html?cat=dresses" class="block py-2 text-sm uppercase">Dresses</a>
            <a href="account.html" class="block py-2 text-sm uppercase">My Account</a>
        </div>
    `;
    
    container.innerHTML = headerHtml;
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (header) {
            if (window.scrollY > 20) header.classList.add('scrolled');
            else header.classList.remove('scrolled');
        }
    });
}

function updateHeaderAuthUI() {
    const container = document.getElementById('auth-icon-container');
    if(container) {
        container.innerHTML = currentUser 
        ? `<a href="account.html" class="p-2 hover:text-[#C9A66B]" title="My Account"><i data-lucide="user" class="w-5 h-5 text-[#C9A66B]"></i></a>`
        : `<a href="login.html" class="p-2 hover:text-[#C9A66B]" title="Sign In"><i data-lucide="user" class="w-5 h-5"></i></a>`;
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }
    updateCartCount();
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function seedDatabaseIfNeeded() {
    const products = await api.products.list();
    if (products.length === 0) {
        const seedProducts = [
            { name: 'Cashmere Oversized Coat', brand: 'Max Mara', price: 890, original_price: 2400, category: 'outerwear', size: 'M', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80', images: ['https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=1200&q=80'], featured: true },
            { name: 'Silk Midi Dress', brand: 'Reformation', price: 245, original_price: 420, category: 'dresses', size: 'S', condition: 'Excellent', in_stock: true, image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', images: ['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80'], featured: true },
            { name: 'Vintage Leather Bag', brand: 'Celine', price: 1200, original_price: 2800, category: 'accessories', size: 'OS', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&q=80'], featured: true },
            { name: 'Wool Blazer', brand: 'The Row', price: 680, original_price: 1650, category: 'outerwear', size: 'L', condition: 'Excellent', in_stock: true, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1200&q=80'], featured: true },
            { name: 'Suede Ankle Boots', brand: 'Gianvito Rossi', price: 420, original_price: 995, category: 'shoes', size: '38', condition: 'Very Good', in_stock: true, image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80', images: ['https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=1200&q=80'], featured: false },
            { name: 'Silk Scarf', brand: 'Hermès', price: 285, original_price: 450, category: 'accessories', size: 'OS', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&q=80', images: ['https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80'], featured: true },
            { name: 'Linen Trousers', brand: 'Totême', price: 185, original_price: 350, category: 'bottoms', size: 'M', condition: 'Excellent', in_stock: true, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80', images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200&q=80'], featured: false }
        ];
        const col = collection(db, 'artifacts', appId, 'public', 'data', 'products');
        for (const p of seedProducts) { await addDoc(col, p); }
        productsCache = []; // Clear cache to force refetch
        
        // Refresh UI if on a product listing page
        if(window.location.pathname.includes('shop.html') || window.location.pathname.includes('index.html')) {
            location.reload();
        }
    }
}

// Start
initApp();