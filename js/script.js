/**
 * js/script.js
 * Handles data persistence, UI rendering, and page logic.
 */

// ==========================================
// 1. DATA & STORAGE (Mock Backend)
// ==========================================

const seedData = {
    products: [
        { id: '1', name: 'Cashmere Oversized Coat', brand: 'Max Mara', price: 890, original_price: 2400, category: 'outerwear', size: 'M', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600&q=80', featured: true },
        { id: '2', name: 'Silk Midi Dress', brand: 'Reformation', price: 245, original_price: 420, category: 'dresses', size: 'S', condition: 'Excellent', in_stock: true, image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', featured: true },
        { id: '3', name: 'Vintage Leather Bag', brand: 'Celine', price: 1200, original_price: 2800, category: 'accessories', size: 'OS', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80', featured: true },
        { id: '4', name: 'Wool Blazer', brand: 'The Row', price: 680, original_price: 1650, category: 'outerwear', size: 'L', condition: 'Excellent', in_stock: true, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80', featured: true },
        { id: '5', name: 'Suede Ankle Boots', brand: 'Gianvito Rossi', price: 420, original_price: 995, category: 'shoes', size: '38', condition: 'Very Good', in_stock: true, image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80', featured: false },
        { id: '6', name: 'Silk Scarf', brand: 'Hermès', price: 285, original_price: 450, category: 'accessories', size: 'OS', condition: 'Pristine', in_stock: true, image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&q=80', featured: true },
    ],
    cart: []
};

// Initialize DB
if (!localStorage.getItem('tt_db')) {
    localStorage.setItem('tt_db', JSON.stringify(seedData));
}

const db = {
    get: () => JSON.parse(localStorage.getItem('tt_db')),
    set: (data) => localStorage.setItem('tt_db', JSON.stringify(data)),
    products: {
        list: () => db.get().products,
        find: (id) => db.get().products.find(p => p.id === id),
        featured: () => db.get().products.filter(p => p.featured)
    },
    cart: {
        list: () => db.get().cart,
        add: (item) => {
            const data = db.get();
            const existing = data.cart.find(c => c.id === item.id);
            if (existing) {
                existing.quantity += 1;
            } else {
                data.cart.push({ ...item, quantity: 1 });
            }
            db.set(data);
            updateCartCount();
            alert("Added to cart!");
        },
        remove: (id) => {
            const data = db.get();
            data.cart = data.cart.filter(c => c.id !== id);
            db.set(data);
            location.reload(); // Simple refresh to update UI
        }
    }
};

// ==========================================
// 2. SHARED UI LOGIC (Header/Footer)
// ==========================================

function renderHeader() {
    const headerHtml = `
        <div class="hidden md:block bg-[#2B2B2B] text-white text-xs py-2">
            <div class="max-w-7xl mx-auto px-6 flex justify-between items-center">
                <span class="tracking-wider">Complimentary shipping on orders over $250</span>
                <span class="tracking-wider">Authenticated luxury, consciously curated</span>
            </div>
        </div>
        <nav class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <!-- Mobile Menu Toggle -->
            <button class="md:hidden p-2 -ml-2" onclick="toggleMobileMenu()">
                <i data-lucide="menu" class="w-6 h-6"></i>
            </button>

            <!-- Logo -->
            <a href="index.html" class="font-serif text-2xl tracking-wide text-[#2B2B2B] no-underline">
                Thrift & Thread
            </a>

            <!-- Desktop Nav -->
            <div class="hidden md:flex items-center space-x-8">
                <a href="shop.html" class="nav-link">New Arrivals</a>
                <a href="shop.html?cat=dresses" class="nav-link">Dresses</a>
                <a href="shop.html?cat=outerwear" class="nav-link">Outerwear</a>
                <a href="shop.html?cat=accessories" class="nav-link">Accessories</a>
            </div>

            <!-- Icons -->
            <div class="flex items-center space-x-4">
                <a href="shop.html" class="p-2 hover:text-[#C9A66B]"><i data-lucide="search" class="w-5 h-5"></i></a>
                <div class="relative">
                    <a href="cart.html" class="p-2 hover:text-[#C9A66B]">
                        <i data-lucide="shopping-bag" class="w-5 h-5"></i>
                        <span id="cart-count" class="cart-badge hidden">0</span>
                    </a>
                </div>
            </div>
        </nav>
        
        <!-- Mobile Menu (Hidden by default) -->
        <div id="mobile-menu" class="hidden absolute top-full left-0 right-0 bg-[#F4EFE8] border-t border-[#E9E0D4] p-4 shadow-lg md:hidden">
            <a href="shop.html" class="block py-2 text-sm uppercase">Shop All</a>
            <a href="shop.html?cat=dresses" class="block py-2 text-sm uppercase">Dresses</a>
            <a href="shop.html?cat=outerwear" class="block py-2 text-sm uppercase">Outerwear</a>
        </div>
    `;
    
    document.getElementById('header-container').innerHTML = headerHtml;
    
    // Header Scroll Effect
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (window.scrollY > 20) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}

function updateCartCount() {
    const count = db.cart.list().reduce((sum, item) => sum + item.quantity, 0);
    const badge = document.getElementById('cart-count');
    if (count > 0) {
        badge.innerText = count;
        badge.classList.remove('hidden');
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

// ==========================================
// 3. PAGE SPECIFIC LOGIC
// ==========================================

function initHome() {
    const container = document.getElementById('featured-products');
    if (!container) return;

    const products = db.products.featured().slice(0, 3);
    
    container.innerHTML = products.map(p => `
        <div class="group fade-in">
            <a href="product.html?id=${p.id}" class="block no-underline text-[#2B2B2B]">
                <div class="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-200 mb-4">
                    <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                    ${p.condition === 'Pristine' ? '<span class="absolute top-3 left-3 bg-[#C9A66B] text-white text-xs px-2 py-1 uppercase">Pristine</span>' : ''}
                </div>
                <p class="text-xs text-[#C9A66B] uppercase tracking-wider mb-1">${p.brand}</p>
                <h3 class="font-serif text-lg m-0">${p.name}</h3>
                <div class="flex items-center gap-2 mt-1">
                    <span class="font-medium">$${p.price}</span>
                    <span class="text-sm text-gray-400 line-through">$${p.original_price}</span>
                </div>
            </a>
        </div>
    `).join('');
}

function initShop() {
    const container = document.getElementById('shop-grid');
    const title = document.getElementById('shop-title');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('cat');
    
    let products = db.products.list();
    
    if (category) {
        products = products.filter(p => p.category === category);
        title.innerText = category.charAt(0).toUpperCase() + category.slice(1);
    }

    if (products.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center py-10 text-gray-500">No products found in this category.</p>';
        return;
    }

    container.innerHTML = products.map(p => `
        <div class="group">
            <a href="product.html?id=${p.id}" class="block no-underline text-[#2B2B2B]">
                <div class="relative aspect-[3/4] overflow-hidden rounded bg-gray-200 mb-4">
                    <img src="${p.image}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
                </div>
                <h3 class="font-medium m-0 text-sm">${p.name}</h3>
                <p class="text-xs text-gray-500 my-1">${p.brand}</p>
                <p class="font-medium">$${p.price}</p>
            </a>
        </div>
    `).join('');
}

function initProduct() {
    const container = document.getElementById('product-detail');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const product = db.products.find(id);

    if (!product) {
        container.innerHTML = '<div class="text-center py-20">Product not found.</div>';
        return;
    }

    // Populate Data
    document.getElementById('p-image').src = product.image;
    document.getElementById('p-brand').innerText = product.brand;
    document.getElementById('p-title').innerText = product.name;
    document.getElementById('p-price').innerText = `$${product.price}`;
    document.getElementById('p-original').innerText = `$${product.original_price}`;
    document.getElementById('p-condition').innerText = product.condition;
    document.getElementById('p-desc').innerText = `Authentic ${product.brand} ${product.name.toLowerCase()} in ${product.condition.toLowerCase()} condition. Verified by our experts.`;

    // Add to Cart Logic
    document.getElementById('add-to-cart').onclick = () => {
        db.cart.add(product);
    };
}

function initCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    const items = db.cart.list();
    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    if (items.length === 0) {
        container.innerHTML = '<div class="text-center py-10">Your bag is empty.</div>';
        document.getElementById('cart-total').innerText = '$0.00';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="flex gap-4 border-b border-[#E9E0D4] pb-4 mb-4">
            <img src="${item.image}" class="w-20 h-24 object-cover rounded">
            <div class="flex-1">
                <div class="flex justify-between">
                    <h3 class="font-serif text-lg m-0">${item.name}</h3>
                    <button onclick="db.cart.remove('${item.id}')" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
                <p class="text-sm text-gray-500">${item.brand}</p>
                <div class="flex justify-between mt-2">
                    <p class="font-medium">$${item.price}</p>
                    <p class="text-sm text-gray-500">Qty: ${item.quantity}</p>
                </div>
            </div>
        </div>
    `).join('');

    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
}

function initCheckout() {
    const container = document.getElementById('checkout-items');
    if (!container) return;

    const items = db.cart.list();
    const total = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    if (items.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">Your cart is empty.</p>';
    } else {
        container.innerHTML = items.map(item => `
            <div class="flex gap-4">
                <div class="relative">
                    <img src="${item.image}" class="w-16 h-20 object-cover rounded bg-[#E9E0D4]">
                    <span class="absolute -top-2 -right-2 bg-[#2B2B2B] text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">${item.quantity}</span>
                </div>
                <div class="flex-1">
                    <h4 class="font-medium text-sm text-[#2B2B2B]">${item.name}</h4>
                    <p class="text-xs text-gray-500">${item.brand}</p>
                </div>
                <span class="text-sm font-medium">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('');
    }

    document.getElementById('checkout-subtotal').innerText = `$${total.toFixed(2)}`;
    document.getElementById('checkout-total').innerText = `$${total.toFixed(2)}`;
}

// ==========================================
// 4. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Only render full header if not on checkout
    if (!window.location.pathname.includes('checkout.html')) {
        renderHeader();
        updateCartCount();
    }
    
    // Page Router
    const path = window.location.pathname;
    if (path.includes('index.html') || path.endsWith('/')) initHome();
    if (path.includes('shop.html')) initShop();
    if (path.includes('product.html')) initProduct();
    if (path.includes('cart.html')) initCart();
    if (path.includes('checkout.html')) initCheckout();

    // Initialize Icons
    lucide.createIcons();
});