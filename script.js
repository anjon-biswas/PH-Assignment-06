/* script.js – robust category + plant loader, cart, modal, spinner */

/* --- Config --- */
const API = {
  allPlants: 'https://openapi.programming-hero.com/api/plants',
  categories: 'https://openapi.programming-hero.com/api/categories',
  categoryById: (id) => `https://openapi.programming-hero.com/api/category/${id}`,
  plantById: (id) => `https://openapi.programming-hero.com/api/plant/${id}`,
};

/* --- DOM --- */
const categoryList = document.getElementById('categoryList');
const plantList = document.getElementById('plantList');
const cartList = document.getElementById('cartList');
const cartTotal = document.getElementById('cartTotal');
const modal = document.getElementById('plantModal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.querySelector('.close');

/* --- App state --- */
let categories = [];
let plants = [];
let cart = [];

/* --- Helpers --- */
function money(n) { return '৳' + Number(n || 0).toLocaleString(); }
function setLoading(targetEl, small = false) {
  targetEl.innerHTML = `<div style="text-align:center; padding:18px;">
    <div class="spinner" style="${small ? 'width:28px;height:28px;border-width:4px;' : ''}"></div>
  </div>`;
}
async function safeFetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error('Fetch error', url, e);
    return null;
  }
}

/* --- Category loading & rendering --- */
async function loadCategories() {
  setLoading(categoryList, true);
  const raw = await safeFetchJSON(API.categories);
  // try multiple common paths for the categories array
  let items = raw?.data?.categories ?? raw?.categories ?? raw?.data ?? raw;
  if (!Array.isArray(items)) {
    // sometimes API returns object with keys we want — convert to array if possible
    if (items && typeof items === 'object') {
      items = Object.values(items).flat().filter(Boolean);
    } else {
      items = [];
    }
  }
  // store and render
  categories = items;
  renderCategories();
}

function renderCategories() {
  categoryList.innerHTML = ''; // clear
  // Add "All Trees"
  const liAll = document.createElement('li');
  liAll.textContent = 'All Trees';
  liAll.classList.add('active'); // default active
  liAll.dataset.id = 'all';
  liAll.addEventListener('click', () => {
    document.querySelectorAll('#categoryList li').forEach(n => n.classList.remove('active'));
    liAll.classList.add('active');
    loadPlants(null);
  });
  categoryList.appendChild(liAll);

  // Render each category with robust property selection
  categories.forEach(cat => {
    const id = cat?.id ?? cat?.category_id ?? cat?._id ?? cat?.categoryId ?? cat?.cat_id ?? cat?.slug ?? cat?.name ?? String(Math.random()).slice(2);
    const name = cat?.name ?? cat?.category ?? cat?.title ?? cat?.category_name ?? cat?.display_name ?? 'Unnamed';
    const li = document.createElement('li');
    li.textContent = name;
    li.dataset.id = id;
    li.addEventListener('click', () => {
      document.querySelectorAll('#categoryList li').forEach(n => n.classList.remove('active'));
      li.classList.add('active');
      // if id is missing or 'all' fallback to allPlants
      if (!id || id === 'all') loadPlants(null);
      else loadPlants(id);
    });
    categoryList.appendChild(li);
  });
}

/* --- Plants loading & rendering --- */
async function loadPlants(categoryId = null) {
  setLoading(plantList, false);
  let url = categoryId ? API.categoryById(categoryId) : API.allPlants;
  const raw = await safeFetchJSON(url);
  // try multiple common shapes for plant list
  let items = raw?.data?.plants ?? raw?.plants ?? raw?.data ?? raw?.data?.data ?? raw;
  if (!Array.isArray(items)) {
    // maybe the API returned an object; try to find an array value
    const candidate = raw && typeof raw === 'object' && Object.values(raw).find(v => Array.isArray(v));
    items = Array.isArray(candidate) ? candidate : [];
  }
  // normalize plants into a simple shape for our UI
  plants = (items || []).map(normalizePlant);
  renderPlants();
}

function normalizePlant(p) {
  if (!p) return null;
  const id = p?.id ?? p?._id ?? p?.plant_id ?? p?.plantId ?? Math.random().toString(36).slice(2);
  const name = p?.name ?? p?.plant_name ?? p?.common_name ?? p?.title ?? 'Unknown Plant';
  // some endpoints have an 'image' string, some have 'images' array, check common fields
  let image = p?.image ?? p?.img ?? p?.images?.[0] ?? p?.picture ?? p?.photo ?? '';
  if (!image) image = 'https://via.placeholder.com/600x400?text=Plant';
  const description = p?.description ?? p?.short_description ?? p?.about ?? p?.details ?? '';
  const category = p?.category ?? p?.category_name ?? p?.cat ?? 'General';
  // Price may not be provided by API — generate if missing (deterministic-ish)
  const price = p?.price ?? p?.cost ?? Math.max(150, Math.floor((parseInt(id.toString().replace(/\D/g,'')) || Math.random()*900) % 900 + 200));
  return { id, name, image, description, category, price, raw: p };
}

function renderPlants() {
  plantList.innerHTML = '';
  if (!plants.length) {
    plantList.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#2e5b4b;padding:18px;">No plants found.</div>';
    return;
  }

  plants.forEach(pl => {
    const card = document.createElement('div');
    card.className = 'plant-card';
    card.innerHTML = `
      <img src="${escapeHtml(pl.image)}" alt="${escapeHtml(pl.name)}">
      <h3 class="plant-name" data-id="${escapeHtml(pl.id)}">${escapeHtml(pl.name)}</h3>
      <p>${escapeHtml((pl.description || '').slice(0, 100))}${(pl.description||'').length > 100 ? '...' : ''}</p>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <small style="color:#2e7d32">${escapeHtml(pl.category)}</small>
        <strong>${money(pl.price)}</strong>
      </div>
      <div style="margin-top:10px;">
        <button class="add-to-cart" data-id="${escapeHtml(pl.id)}">Add to Cart</button>
      </div>
    `;
    // events
    card.querySelector('.plant-name').addEventListener('click', () => openModalWithPlant(pl));
    card.querySelector('.add-to-cart').addEventListener('click', () => addToCart(pl));
    plantList.appendChild(card);
  });
}

/* --- Modal --- */
function openModalWithPlant(plant) {
  // show details in modal — optionally we could fetch full detail by id
  modalBody.innerHTML = `
    <h2>${escapeHtml(plant.name)}</h2>
    <img src="${escapeHtml(plant.image)}" style="max-width:100%;border-radius:8px;margin:10px 0;">
    <p>${escapeHtml(plant.description || 'No description available.')}</p>
    <p><strong>Category:</strong> ${escapeHtml(plant.category)}</p>
    <p><strong>Price:</strong> ${money(plant.price)}</p>
    <div style="margin-top:10px;"><button id="modal-add" class="add-to-cart">Add to Cart</button></div>
  `;
  // add handler
  modal.style.display = 'flex';
  const modalAdd = document.getElementById('modal-add');
  if (modalAdd) modalAdd.addEventListener('click', () => {
    addToCart(plant);
    modal.style.display = 'none';
  });
}

/* --- Cart operations --- */
function addToCart(plant) {
  const entry = { cartId: Math.random().toString(36).slice(2), id: plant.id, name: plant.name, price: Number(plant.price || 0), image: plant.image };
  cart.push(entry);
  renderCart();
}

function removeFromCart(cartId) {
  cart = cart.filter(i => i.cartId !== cartId);
  renderCart();
}

function renderCart() {
  cartList.innerHTML = '';
  if (!cart.length) {
    cartList.innerHTML = '<div style="color:#4b6b5c; font-size:13px;">Cart is empty</div>';
  } else {
    cart.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div style="display:flex;gap:10px;align-items:center">
          <div style="width:44px;height:44px;border-radius:6px;overflow:hidden;background:#f4f7f4;"><img src="${escapeHtml(item.image)}" alt="" style="width:100%;height:100%;object-fit:cover;"></div>
          <div style="flex:1"><div style="font-weight:600">${escapeHtml(item.name)}</div><div style="font-size:12px;color:#4b6b5c">${money(item.price)}</div></div>
          <div><button class="remove-item" data-id="${item.cartId}">✕</button></div>
        </div>
      `;
      li.querySelector('.remove-item').addEventListener('click', () => removeFromCart(item.cartId));
      cartList.appendChild(li);
    });
  }
  const total = cart.reduce((s, it) => s + (Number(it.price) || 0), 0);
  cartTotal.textContent = money(total);
}

/* --- Utility --- */
function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]);
}

/* --- Init --- */
closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
window.addEventListener('keydown', e => { if (e.key === 'Escape') modal.style.display = 'none'; });

(async function init() {
  await loadCategories();    // populate sidebar
  await loadPlants(null);    // load all plants initially
})();
