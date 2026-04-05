/**
 * Farmality Web - Main Application
 */

// API Base URL
const API_BASE = '/api';

// State
const state = {
  currentView: 'dashboard',
  categories: [],
  products: [],
  editingProductCode: null,
};

// ============ WEBSOCKET / SOCKET.IO ============
let socket = null;

function initWebSocket() {
  if (socket) return;
  
  socket = io();
  
  socket.on('connect', () => {
    console.log('🔌 WebSocket conectado');
    // Unirse a sala de notificaciones
    socket.emit('subscribe', 'notifications');
  });
  
  socket.on('notification', (notification) => {
    console.log('📨 Notificación recibida:', notification);
    handleNotification(notification);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket desconectado');
  });
}

function handleNotification(notification) {
  // Mostrar toast según el tipo
  const type = notification.type;
  const message = notification.message;
  
  // Tipos de notificaciones para mostrar
  if (type === 'stock_low') {
    showToast('⚠️ ' + message, 'warning');
  } else if (type === 'new_reservation') {
    showToast('📦 ' + message, 'success');
  } else if (type === 'reservation_expiring') {
    showToast('⏰ ' + message, 'warning');
  } else if (type === 'reservation_completed') {
    showToast('✅ ' + message, 'success');
  } else if (type === 'product_expiring') {
    showToast('⏰ ' + message, 'warning');
  } else {
    showToast(message, 'info');
  }
  
  // Recargar datos relevantes según el tipo
  if (type === 'stock_low' || type === 'product_expiring') {
    loadDashboard();
    loadAlerts();
  } else if (type === 'new_reservation' || type === 'reservation_expiring' || type === 'reservation_completed') {
    loadReservations();
  }
}

// ============ API CLIENT ============

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  console.log('Fetching:', url);
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  const response = await fetch(url, config);
  console.log('Response:', response.status, response.ok);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

const api = {
  getStats: () => apiRequest('/stats'),
  getCategories: () => apiRequest('/categories'),
  getAllAlerts: () => apiRequest('/alerts/all'),
  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/products${query ? '?' + query : ''}`);
  },
};

// ============ ROUTER ============

function navigateTo(route) {
  window.location.hash = route;
}

function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  if (!window.location.hash) {
    window.location.hash = 'dashboard';
  }
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const [view, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString || '');
  
  // Show active view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');
  
  // Load data
  if (view === 'dashboard') {
    stopReservationPolling();
    loadDashboard();
  } else if (view === 'products') {
    stopReservationPolling();
    // Apply category filter from URL if present
    const category = params.get('category');
    if (category) {
      const filterSelect = document.getElementById('filter-category');
      if (filterSelect) filterSelect.value = category;
    }
    loadProducts();
  } else if (view === 'sales') {
    stopReservationPolling();
    loadSalesView();
  } else if (view === 'reservations') {
    startReservationPolling();
    loadReservations();
  } else if (view === 'movements') {
    stopReservationPolling();
    loadMovements();
  } else if (view === 'reports') {
    stopReservationPolling();
    loadReport('stock-low');
  } else if (view === 'alerts') {
    stopReservationPolling();
    loadAlerts();
  }
}

// ============ DASHBOARD ============

async function loadDashboard() {
  try {
    const [stats, categories, alerts] = await Promise.all([
      api.getStats(),
      api.getCategories(),
      api.getAllAlerts(),
    ]);
    
    document.getElementById('stat-total-products').textContent = stats.totalProducts;
    document.getElementById('stat-total-stock').textContent = formatNumber(stats.totalStock);
    document.getElementById('stat-low-stock').textContent = stats.lowStockCount;
    document.getElementById('stat-total-reservations').textContent = stats.totalReservations || 0;
    
    renderCategories(categories.categories || []);
    renderRecentAlerts((alerts.alerts || []).slice(0, 5));
    
    state.categories = categories.categories || [];
    updateCategoryFilters();
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

function renderCategories(categories) {
  const container = document.getElementById('categories-container');
  if (!categories.length) {
    container.innerHTML = '<p class="empty-state">No hay categorías</p>';
    return;
  }
  container.innerHTML = categories.map(cat => 
    '<div class="category-card" onclick="navigateToProducts(\'' + cat.name + '\')">' +
      '<div class="category-icon">' + getCategoryIcon(cat.name) + '</div>' +
      '<div class="category-name">' + formatCategoryName(cat.name) + '</div>' +
      '<div class="category-count">' + cat.productCount + ' productos</div>' +
    '</div>'
  ).join('');
}

function renderRecentAlerts(alerts) {
  const container = document.getElementById('recent-alerts');
  if (!alerts.length) {
    container.innerHTML = '<p class="empty-state">Sin alertas</p>';
    return;
  }
  container.innerHTML = alerts.map(alert => 
    '<div class="alert-item ' + alert.severity + '" onclick="navigateToProducts(\'' + alert.code + '\')">' +
      '<span class="alert-icon">' + (alert.type === 'low_stock' ? '⚠️' : '⏰') + '</span>' +
      '<div class="alert-content">' +
        '<div class="alert-title">' + escapeHtml(alert.name) + '</div>' +
        '<div class="alert-message">' + escapeHtml(alert.message) + '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

// ============ CHARTS ============

let stockByCategoryChart = null;
let expiringProductsChart = null;

function getChartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#f1f5f9' : '#1e293b',
    grid: isDark ? '#334155' : '#e2e8f0',
  };
}

function renderStockByCategoryChart(data) {
  const canvas = document.getElementById('chart-stock-by-category');
  if (!canvas) return;
  
  const colors = getChartColors();
  const categories = Object.keys(data.byCategory || {});
  const stocks = categories.map(cat => data.byCategory[cat].stock);
  
  if (stockByCategoryChart) {
    stockByCategoryChart.destroy();
  }
  
  stockByCategoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: stocks,
        backgroundColor: [
          '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
          '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text }
        }
      }
    }
  });
}

function renderExpiringProductsChart(data) {
  const canvas = document.getElementById('chart-expiring-products');
  if (!canvas) return;
  
  const colors = getChartColors();
  const products = (data.products || []).slice(0, 5);
  
  if (expiringProductsChart) {
    expiringProductsChart.destroy();
  }
  
  expiringProductsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: products.map(p => p.name.substring(0, 15) + '...'),
      datasets: [{
        label: 'Días hasta vencer',
        data: products.map(p => p.daysUntilExpiry),
        backgroundColor: products.map(p => 
          p.urgency === 'critical' ? '#ef4444' : 
          p.urgency === 'warning' ? '#f59e0b' : '#22c55e'
        ),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.text }
        },
        y: {
          grid: { display: false },
          ticks: { color: colors.text }
        }
      }
    }
  });
}

// ============ PRODUCTS ============

async function loadProducts() {
  const container = document.getElementById('products-container');
  container.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    // Ensure categories are loaded
    if (state.categories.length === 0) {
      const categoriesData = await api.getCategories();
      state.categories = categoriesData.categories || [];
      updateCategoryFilters();
    }
    
    const search = document.getElementById('search-input')?.value || '';
    const category = document.getElementById('filter-category')?.value || '';
    const lowStock = document.getElementById('filter-low-stock')?.checked;
    const offersOnly = document.getElementById('filter-offers')?.checked;
    const sortBy = document.getElementById('sort-select')?.value || 'name';
    
    // Build query params - only include params when they have values
    const apiParams = { search, category };
    if (lowStock === true) {
      apiParams.lowStock = 'true';
    }
    if (offersOnly === true) {
      apiParams.hasOffer = 'true';
    }
    
    const result = await api.getProducts(apiParams);
    let products = result.products || [];
    
    // Sort
    products.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock') return b.stock - a.stock;
      if (sortBy === 'price') return b.price - a.price;
      if (sortBy === 'expiry') return new Date(a.expiryDate) - new Date(b.expiryDate);
      return 0;
    });
    
    state.products = products;
    renderProducts(products);
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

function renderProducts(products) {
  const container = document.getElementById('products-container');
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No hay productos</p>';
    return;
  }
  container.innerHTML = products.map(p => {
    const isLow = p.stock <= p.minStock;
    
    // Parse offer - handle both object and string formats (including JavaScript object literal)
    let hasOffer = false;
    let discount = 0;
    
    if (p.offer) {
      if (typeof p.offer === 'object') {
        hasOffer = p.offer.active === true && p.offer.discount > 0;
        discount = p.offer.discount || 0;
      } else if (typeof p.offer === 'string') {
        try {
          // Try valid JSON first
          const parsed = JSON.parse(p.offer);
          hasOffer = parsed.active === true && parsed.discount > 0;
          discount = parsed.discount || 0;
        } catch (e) {
          // Try JavaScript object literal format: {discount:25,active:true}
          const match = p.offer.match(/\{[^}]*\}/);
          if (match) {
            const objStr = match[0];
            const discountMatch = objStr.match(/discount\s*:\s*(\d+)/);
            const activeMatch = objStr.match(/active\s*:\s*(true|false)/);
            if (discountMatch && activeMatch) {
              discount = parseInt(discountMatch[1], 10);
              hasOffer = activeMatch[1] === 'true' && discount > 0;
            }
          }
        }
      }
    }
    
    const offerBadge = hasOffer 
      ? '<span class="product-offer-badge">🔥 ' + discount + '% OFF</span>' 
      : '';
    const originalPrice = hasOffer 
      ? '<span class="product-original-price">' + formatCurrency(p.price) + '</span>' 
      : '';
    const offerPrice = hasOffer 
      ? formatCurrency(p.price * (1 - discount / 100)) 
      : formatCurrency(p.price);
    
    // Parse drugs for display
    let drugsHtml = '';
    if (p.drugs && Array.isArray(p.drugs)) {
      drugsHtml = p.drugs.map(d => '<span>' + escapeHtml(d.name) + ' ' + escapeHtml(d.quantity) + '</span>').join('');
      if (drugsHtml) {
        drugsHtml = '<div class="product-drugs">' + drugsHtml + '</div>';
      }
    }
    
    // Presentation badge
    const presentation = p.presentation ? '<span class="product-presentation">' + escapeHtml(p.presentation) + '</span>' : '';
    
    // Sale condition badge - color coded
    let saleConditionHtml = '';
    if (p.saleCondition) {
      let badgeClass = 'product-sale-condition';
      if (p.saleCondition === 'venta-libre') {
        badgeClass += ' sale-libre';
      } else if (p.saleCondition === 'bajo-receta' || p.saleCondition === 'receta-simple') {
        badgeClass += ' receta';
      } else {
        badgeClass += ' controlado';
      }
      const saleConditionLabels = {
        'venta-libre': 'Venta Libre',
        'bajo-receta': 'Bajo Receta',
        'receta-simple': 'Receta Simple',
        'receta-archivo': 'Receta Archivo',
        'psicotropo': 'Psicotrópico',
        'estupefaciente': 'Estupefaciente'
      };
      saleConditionHtml = '<span class="' + badgeClass + '">' + (saleConditionLabels[p.saleCondition] || p.saleCondition) + '</span>';
    }
    
    return '<div class="product-card' + (hasOffer ? ' has-offer' : '') + '">' +
      '<div class="product-header"><div>' +
        '<div class="product-name">' + escapeHtml(p.name) + presentation + saleConditionHtml + '</div>' +
        '<div class="product-code"><span class="barcode-text">' + escapeHtml(p.code) + '</span></div>' +
      '</div>' + offerBadge + '</div>' +
      '<div class="product-category">' + formatCategoryName(p.category) + ' | ' + escapeHtml(p.laboratory || 'Sin laboratorio') + '</div>' +
      drugsHtml +
      '<div class="product-stats">' +
        '<div class="product-stat"><div class="product-stat-label">Stock</div><div class="product-stat-value ' + (isLow ? 'low' : '') + '">' + p.stock + '</div></div>' +
        '<div class="product-stat"><div class="product-stat-label">Mín</div><div class="product-stat-value">' + p.minStock + '</div></div>' +
        '<div class="product-stat"><div class="product-stat-label">Precio</div><div class="product-stat-value' + (hasOffer ? ' offer-price' : '') + '">' + offerPrice + '</div></div>' +
      '</div>' +
      '<div class="product-actions">' +
        '<button class="btn btn-sm btn-secondary" onclick=\'openProductModal(' + JSON.stringify(p).replace(/'/g, "&#39;") + ')\'>Editar</button>' +
        '<button class="btn btn-sm btn-secondary" onclick=\'openStockModal(' + JSON.stringify(p).replace(/'/g, "&#39;") + ')\'>Stock</button>' +
        '<button class="btn btn-sm btn-icon" onclick="deleteProduct(\'' + p.code + '\')" title="Eliminar">🗑️</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function deleteProduct(code) {
  if (!confirm('¿Estás seguro de que quieres eliminar el producto "' + code + '"?')) {
    return;
  }
  
  try {
    await apiRequest('/products/' + code, {
      method: 'DELETE',
    });
    
    showToast('Producto eliminado correctamente', 'success');
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function migrateProducts() {
  if (!confirm('¿Ejecutar migración de productos? Esto agregará valores por defecto a los productos que les falten campos (presentation, saleCondition, laboratory).')) {
    return;
  }
  
  try {
    showToast('Ejecutando migración...', 'info');
    
    const result = await apiRequest('/products/migrate', {
      method: 'PUT',
    });
    
    showToast(`Migración completada: ${result.migrated} productos actualizados de ${result.total}`, 'success');
    loadProducts();
  } catch (err) {
    showToast('Error en migración: ' + err.message, 'error');
  }
}

// ============ ALERTS ============

async function loadAlerts() {
  const container = document.getElementById('alerts-container');
  container.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    const result = await api.getAllAlerts();
    window.allAlerts = result.alerts || [];
    
    if (!window.allAlerts.length) {
      container.innerHTML = '<p class="empty-state">Sin alertas</p>';
      return;
    }
    
    // Show all by default
    filterAlertsByTab('all');
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

// ============ HELPERS ============

function updateCategoryFilters() {
  const select = document.getElementById('filter-category');
  if (!select) return;
  select.innerHTML = '<option value="">Todas las categorías</option>' +
    state.categories.map(c => '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>').join('');
}

function navigateToProducts(category) {
  window.location.hash = category ? 'products?category=' + encodeURIComponent(category) : 'products';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES').format(num);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'ARS' }).format(amount);
}

function formatCategoryName(cat) {
  if (!cat) return '';
  return cat.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const categoryIcons = {
  'pediatrico': '👶',
  'vitaminas': '💊',
  'suplementos': '💪',
  'antibioticos': '🔬',
  'dieteticos': '🥗',
  'otorrinolaringologia': '👂',
  'gastrointestinal': '🫃',
  'cuidado-personal': '🧴',
  'dermocosmetica': '🧬',
  'analgesicos': '💉',
  'femenino': '👩',
  'antiflamatorios': '🔥',
  'oftalmico': '👁️',
  'cardiovascular': '❤️',
  'respiratorio': '🫁'
};

function getCategoryIcon(cat) {
  return categoryIcons[cat] || '📦';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-ES');
}

// ============ EVENT LISTENERS ============

function initEventListeners() {
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(loadProducts, 300));
  }
  
  // Filter category
  const filterCategory = document.getElementById('filter-category');
  if (filterCategory) {
    filterCategory.addEventListener('change', loadProducts);
  }
  
  // Filter low stock checkbox
  const filterLowStock = document.getElementById('filter-low-stock');
  if (filterLowStock) {
    filterLowStock.addEventListener('change', loadProducts);
  }
  
  // Filter offers checkbox
  const filterOffers = document.getElementById('filter-offers');
  if (filterOffers) {
    filterOffers.addEventListener('change', loadProducts);
  }
  
  // Movement search with debounce
  const movementSearch = document.getElementById('search-movement-product');
  if (movementSearch) {
    movementSearch.addEventListener('input', debounce(loadMovements, 300));
  }
  
  // Movement date filters
  const dateFrom = document.getElementById('filter-movement-date-from');
  const dateTo = document.getElementById('filter-movement-date-to');
  if (dateFrom) dateFrom.addEventListener('change', loadMovements);
  if (dateTo) dateTo.addEventListener('change', loadMovements);
  
  // Sort select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', loadProducts);
  }
  
  // Alert tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      filterAlertsByTab(this.dataset.filter);
    });
  });
  
  // Back to top button
  window.addEventListener('scroll', function() {
    const btn = document.getElementById('back-to-top');
    if (btn) {
      btn.style.display = window.scrollY > 200 ? 'flex' : 'none';
    }
  });
  
  // Product form submit
  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', handleProductSubmit);
  }
  
  // Reservation form submit
  const reservationForm = document.getElementById('reservation-form');
  if (reservationForm) {
    reservationForm.addEventListener('submit', handleReservationSubmit);
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function filterAlertsByTab(filter) {
  const container = document.getElementById('alerts-container');
  let alerts = window.allAlerts || [];
  
  if (filter === 'low-stock') {
    alerts = alerts.filter(a => a.type === 'low_stock');
  } else if (filter === 'expiring') {
    alerts = alerts.filter(a => a.type === 'expiring_soon' || a.type === 'expired');
  }
  
  if (!alerts.length) {
    container.innerHTML = '<p class="empty-state">Sin alertas</p>';
    return;
  }
  
  container.innerHTML = alerts.map(alert => 
    '<div class="alert-item ' + alert.severity + '">' +
      '<span class="alert-icon">' + (alert.type === 'low_stock' ? '⚠️' : '⏰') + '</span>' +
      '<div class="alert-content">' +
        '<div class="alert-title">' + escapeHtml(alert.name) + '</div>' +
        '<div class="alert-message">' + escapeHtml(alert.message) + '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  
  const isEditing = state.editingProductCode !== null;
  const offerDiscount = parseInt(document.getElementById('product-offer-discount').value) || 0;
  const offerActive = document.getElementById('product-offer-active').checked;
  
  // Collect drugs from the drug rows
  const drugRows = document.querySelectorAll('.drug-row');
  const drugs = [];
  drugRows.forEach(row => {
    const drugSelect = row.querySelector('.drug-select');
    const drugQuantity = row.querySelector('.drug-quantity');
    if (drugSelect.value && drugQuantity.value) {
      drugs.push({
        name: drugSelect.value,
        quantity: drugQuantity.value
      });
    }
  });
  
  // Build product object only with non-empty values
  const product = {};
  
  product.code = document.getElementById('product-code').value;
  product.name = document.getElementById('product-name').value;
  
  const description = document.getElementById('product-description').value;
  if (description) product.description = description;
  
  const category = document.getElementById('product-category').value;
  if (category) product.category = category;
  
  product.price = parseFloat(document.getElementById('product-price').value);
  product.stock = parseInt(document.getElementById('product-stock').value);
  product.minStock = parseInt(document.getElementById('product-min-stock').value);
  
  const laboratory = document.getElementById('product-laboratory').value;
  if (laboratory) product.laboratory = laboratory;
  
  const presentation = document.getElementById('product-presentation').value;
  if (presentation) product.presentation = presentation;
  
  const saleCondition = document.getElementById('product-sale-condition').value;
  if (saleCondition) product.saleCondition = saleCondition;
  
  // Only add drugs if there are valid entries
  if (drugs.length > 0) {
    product.drugs = drugs;
  }
  
  // Only add offer if there's a discount
  if (offerDiscount > 0) {
    product.offer = { "discount": offerDiscount, "active": offerActive };
  }
  
  try {
    if (isEditing) {
      // Update existing product
      await apiRequest('/products/' + state.editingProductCode, {
        method: 'PUT',
        body: JSON.stringify(product),
      });
      showToast('Producto actualizado correctamente', 'success');
    } else {
      // Create new product
      await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      showToast('Producto creado correctamente', 'success');
    }
    
    closeProductModal();
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function openProductModal(product = null) {
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-title');
  const categorySelect = document.getElementById('product-category');
  const deleteBtn = document.getElementById('delete-product-btn');
  
  // Update category dropdown
  categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
    state.categories.map(c => '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>').join('');
  
  if (product) {
    // Edit mode
    title.textContent = 'Editar Producto';
    state.editingProductCode = product.code;
    deleteBtn.style.display = 'block';
    
    document.getElementById('product-code').value = product.code;
    document.getElementById('product-code').readOnly = true;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-min-stock').value = product.minStock;
    document.getElementById('product-laboratory').value = product.laboratory || '';
    document.getElementById('product-presentation').value = product.presentation || '';
    document.getElementById('product-sale-condition').value = product.saleCondition || '';
    document.getElementById('product-offer-discount').value = product.offer?.discount || 0;
    document.getElementById('product-offer-active').checked = product.offer?.active || false;
    
    // Populate drugs
    const drugsContainer = document.getElementById('drugs-container');
    drugsContainer.innerHTML = '';
    const drugs = product.drugs || [];
    if (drugs.length === 0) {
      addDrugRow(); // Add empty row if no drugs
    } else {
      drugs.forEach((drug, index) => {
        addDrugRow(drug.name, drug.quantity, index > 0);
      });
    }
  } else {
    // Create mode
    title.textContent = 'Nuevo Producto';
    state.editingProductCode = null;
    deleteBtn.style.display = 'none';
    
    document.getElementById('product-form').reset();
    document.getElementById('product-code').readOnly = false;
    document.getElementById('product-offer-discount').value = 0;
    document.getElementById('product-offer-active').checked = false;
  }
  
  modal.classList.add('active');
}

function addDrugRow(drugName = '', drugQuantity = '', showRemove = false) {
  const container = document.getElementById('drugs-container');
  const row = document.createElement('div');
  row.className = 'drug-row';
  
  row.innerHTML = `
    <select class="drug-select">
      <option value="">Seleccionar droga...</option>
      <option value="paracetamol">Paracetamol</option>
      <option value="ibuprofeno">Ibuprofeno</option>
      <option value="amoxicilina">Amoxicilina</option>
      <option value="azitromicina">Azitromicina</option>
      <option value="dipirona">Dipirona</option>
      <option value="diclofenaco">Diclofenaco</option>
      <option value="omeprazol">Omeprazol</option>
      <option value="losartan">Losartán</option>
      <option value="metformina">Metformina</option>
      <option value="atorvastatina">Atorvastatina</option>
      <option value="amlodipino">Amlodipino</option>
      <option value="enalapril">Enalapril</option>
      <option value="levotiroxina">Levotiroxina</option>
      <option value="hidrocortisona">Hidrocortisona</option>
      <option value="dexametasona">Dexametasona</option>
      <option value="prednisona">Prednisona</option>
      <option value="salbutamol">Salbutamol</option>
      <option value="montelukast">Montelukast</option>
      <option value="loratadina">Loratadina</option>
      <option value="cetirizina">Cetirizina</option>
      <option value="otro">Otra</option>
    </select>
    <input type="text" class="drug-quantity" placeholder="Cantidad (ej: 500mg)" value="${escapeHtml(drugQuantity)}">
    <button type="button" class="btn btn-sm btn-secondary" onclick="addDrugRow()">+</button>
    <button type="button" class="btn btn-sm btn-danger" onclick="removeDrugRow(this)" ${showRemove ? '' : 'style="display:none"'}>-</button>
  `;
  
  // Set drug name if provided
  if (drugName) {
    row.querySelector('.drug-select').value = drugName;
  }
  
  container.appendChild(row);
}

function removeDrugRow(button) {
  const container = document.getElementById('drugs-container');
  if (container.children.length > 1) {
    button.parentElement.remove();
  }
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  modal.classList.remove('active');
  state.editingProductCode = null;
}

async function deleteCurrentProduct() {
  if (!state.editingProductCode) return;
  
  if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
    return;
  }
  
  try {
    await apiRequest('/products/' + state.editingProductCode, {
      method: 'DELETE',
    });
    
    closeProductModal();
    showToast('Producto eliminado correctamente', 'success');
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

let currentStockProductCode = null;
let currentStockValue = 0;
let currentStockMode = 'set';

function openStockModal(product) {
  const modal = document.getElementById('stock-modal');
  currentStockProductCode = product.code;
  currentStockValue = product.stock;
  currentStockMode = 'set';
  
  document.getElementById('stock-product-name').textContent = product.name;
  document.getElementById('stock-product-code').textContent = product.code;
  document.getElementById('stock-current-value').textContent = product.stock;
  document.getElementById('stock-adjustment').value = product.stock;
  
  // Reset buttons
  setStockMode('set');
  
  modal.classList.add('active');
}

function setStockMode(mode) {
  currentStockMode = mode;
  const input = document.getElementById('stock-adjustment');
  const label = document.getElementById('stock-adjustment-label');
  const hint = document.getElementById('stock-adjustment-hint');
  
  // Update button styles
  document.querySelectorAll('.stock-mode-btn').forEach(btn => {
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
      btn.style.background = 'var(--primary)';
      btn.style.color = 'white';
    } else {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
    }
  });
  
  // Update label and hint based on mode
  if (mode === 'set') {
    label.textContent = 'Nuevo valor de stock';
    hint.textContent = '';
    input.value = currentStockValue;
  } else if (mode === 'add') {
    label.textContent = 'Cantidad a sumar';
    hint.textContent = `Stock actual: ${currentStockValue}. Nuevo stock: ${currentStockValue + parseInt(input.value)}`;
    input.value = 0;
  } else if (mode === 'subtract') {
    label.textContent = 'Cantidad a restar';
    hint.textContent = `Stock actual: ${currentStockValue}. Nuevo stock: ${currentStockValue - parseInt(input.value)}`;
    input.value = 0;
  }
  
  // Update hint on input change
  input.oninput = function() {
    if (mode === 'add') {
      hint.textContent = `Stock actual: ${currentStockValue}. Nuevo stock: ${currentStockValue + parseInt(input.value || 0)}`;
    } else if (mode === 'subtract') {
      const newStock = currentStockValue - parseInt(input.value || 0);
      hint.textContent = `Stock actual: ${currentStockValue}. Nuevo stock: ${newStock}`;
    }
  };
}

function closeStockModal() {
  const modal = document.getElementById('stock-modal');
  modal.classList.remove('active');
  currentStockProductCode = null;
}

async function applyStockAdjustment() {
  const value = parseInt(document.getElementById('stock-adjustment').value);
  
  if (!currentStockProductCode || isNaN(value)) return;
  
  try {
    let body;
    
    if (currentStockMode === 'set') {
      body = { adjustment: value };
    } else if (currentStockMode === 'add') {
      body = { quantity: value, operation: 'add' };
    } else if (currentStockMode === 'subtract') {
      if (value > currentStockValue) {
        showToast('No puedes restar más de lo que hay en stock', 'error');
        return;
      }
      body = { quantity: value, operation: 'subtract' };
    }
    
    await apiRequest('/products/' + currentStockProductCode + '/stock', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    closeStockModal();
    showToast('Stock actualizado correctamente', 'success');
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ============ RESERVATIONS ============

let reservationItems = [];
let reservationInterval = null;

// Polling para actualizar reservas cada 10 segundos
function startReservationPolling() {
  if (reservationInterval) clearInterval(reservationInterval);
  
  // Actualizar inmediatamente
  loadReservations();
  
  // Luego cada 10 segundos
  reservationInterval = setInterval(() => {
    loadReservations();
  }, 10000);
}

function stopReservationPolling() {
  if (reservationInterval) {
    clearInterval(reservationInterval);
    reservationInterval = null;
  }
}

async function loadReservations() {
  const container = document.getElementById('reservations-container');
  
  // Si no está visible, no mostrar loading
  const viewReservations = document.getElementById('view-reservations');
  if (!viewReservations.classList.contains('active')) {
    return;
  }
  
  if (!container.innerHTML || container.innerHTML.includes('Cargando')) {
    container.innerHTML = '<div class="loading">Cargando...</div>';
  }
  
  try {
    const status = document.getElementById('filter-reservation-status')?.value || '';
    const params = status ? '?status=' + status : '';
    const result = await apiRequest('/reservations' + params);
    const reservations = result.reservations || [];
    
    if (!reservations.length) {
      container.innerHTML = '<p class="empty-state">No hay reservas</p>';
      return;
    }
    
    // Guardar referencias para actualizar tiempo
    window.currentReservations = reservations;
    
    container.innerHTML = reservations.map(r => {
      const statusClass = r.status === 'active' ? 'active' : 
                         r.status === 'completed' ? 'completed' : 
                         r.status === 'expired' ? 'expired' : 'cancelled';
      const timeLeft = r.timeRemaining && r.status === 'active' ? formatTime(r.timeRemaining) : (r.status === 'expired' ? 'Expirada' : '');
      
      return '<div class="reservation-card ' + statusClass + '">' +
        '<div class="reservation-header">' +
          '<div class="reservation-id">#' + r.id.slice(0, 15) + '</div>' +
          '<div class="reservation-status">' + r.status.toUpperCase() + '</div>' +
        '</div>' +
        '<div class="reservation-customer">' + escapeHtml(r.customerName) + '</div>' +
        '<div class="reservation-items">' +
          r.items.map(item => '<div class="reservation-item">' + item.name + ' x' + item.quantity + '</div>').join('') +
        '</div>' +
        '<div class="reservation-footer">' +
          '<div class="reservation-total">' + formatCurrency(r.total) + '</div>' +
          '<div class="reservation-time" data-reservation-id="' + r.id + '">' + (r.status === 'active' ? '⏱️ ' + timeLeft : '') + '</div>' +
        '</div>' +
        (r.status === 'active' ? '<div class="reservation-actions"><button class="btn btn-sm btn-primary" onclick="completeReservation(\'' + r.id + '\')">Completar</button><button class="btn btn-sm btn-danger" onclick="cancelReservation(\'' + r.id + '\')">Cancelar</button></div>' : '') +
      '</div>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

// Actualizar el tiempo restante cada segundo
function updateReservationTimes() {
  const timeElements = document.querySelectorAll('.reservation-time[data-reservation-id]');
  
  timeElements.forEach(el => {
    const currentText = el.textContent;
    if (!currentText.includes('⏱️')) return;
    
    // Extraer el ID
    const reservationId = el.dataset.reservationId;
    const reservation = window.currentReservations?.find(r => r.id === reservationId);
    
    if (reservation && reservation.timeRemaining > 0) {
      reservation.timeRemaining--;
      el.textContent = '⏱️ ' + formatTime(reservation.timeRemaining);
      
      // Si expired, recargar
      if (reservation.timeRemaining <= 0) {
        loadReservations();
      }
    }
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins + 'm ' + secs + 's';
}

function openReservationModal() {
  reservationItems = [];
  document.getElementById('customer-name').value = '';
  document.getElementById('reservation-total').textContent = '$0';
  renderReservationItems();
  document.getElementById('reservation-modal').classList.add('active');
}

function closeReservationModal() {
  document.getElementById('reservation-modal').classList.remove('active');
}

// Variable temporal para almacenar productos disponibles
let availableProductsForReservation = [];

function addReservationProduct() {
  // Load products for selection
  api.getProducts().then(result => {
    availableProductsForReservation = result.products || [];
    renderProductsForReservation(availableProductsForReservation);
    document.getElementById('add-reservation-search').value = '';
    document.getElementById('add-reservation-product-modal').classList.add('active');
  });
}

function renderProductsForReservation(products) {
  const select = document.getElementById('add-reservation-product-select');
  
  if (!products.length) {
    select.innerHTML = '<option>No se encontraron productos</option>';
    return;
  }
  
  select.innerHTML = products.map(p => 
    '<option value="' + p.code + '" data-price="' + p.price + '" data-stock="' + p.stock + '">' + 
    p.name + ' | ' + (p.laboratory || 'Sin lab') + ' | Stock: ' + p.stock + ' | ' + formatCurrency(p.price) +
    '</option>'
  ).join('');
}

function filterProductsForReservation() {
  const searchTerm = document.getElementById('add-reservation-search').value.toLowerCase();
  
  if (!searchTerm) {
    renderProductsForReservation(availableProductsForReservation);
    return;
  }
  
  const filtered = availableProductsForReservation.filter(p => 
    p.name.toLowerCase().includes(searchTerm) || 
    p.code.toLowerCase().includes(searchTerm) ||
    p.category.toLowerCase().includes(searchTerm) ||
    (p.laboratory && p.laboratory.toLowerCase().includes(searchTerm))
  );
  
  renderProductsForReservation(filtered);
}

function closeAddReservationProductModal() {
  document.getElementById('add-reservation-product-modal').classList.remove('active');
}

function confirmAddReservationProduct() {
  const select = document.getElementById('add-reservation-product-select');
  const quantity = parseInt(document.getElementById('add-reservation-quantity').value) || 1;
  const option = select.options[select.selectedIndex];
  const code = option.value;
  const price = parseFloat(option.dataset.price);
  const stock = parseInt(option.dataset.stock);
  
  // Verificar stock
  const existingItem = reservationItems.find(item => item.code === code);
  const currentQty = existingItem ? existingItem.quantity : 0;
  
  if (currentQty + quantity > stock) {
    showToast('Stock insuficiente', 'error');
    return;
  }
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    reservationItems.push({
      code: code,
      name: option.text.split(' - ')[0],
      quantity: quantity,
      price: price
    });
  }
  
  renderReservationItems();
  closeAddReservationProductModal();
}

function renderReservationItems() {
  const container = document.getElementById('reservation-products-list');
  const totalEl = document.getElementById('reservation-total');
  
  if (reservationItems.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding:20px;">Agrega productos a la reserva</p>';
    totalEl.textContent = '$0';
    return;
  }
  
  let total = 0;
  container.innerHTML = reservationItems.map((item, index) => {
    total += item.price * item.quantity;
    return '<div class="reservation-product-item">' +
      '<div>' + escapeHtml(item.name) + ' x' + item.quantity + '</div>' +
      '<div>' + formatCurrency(item.price * item.quantity) + ' <button onclick="removeReservationItem(' + index + ')" style="background:none;border:none;color:red;cursor:pointer;">✕</button></div>' +
    '</div>';
  }).join('');
  
  totalEl.textContent = formatCurrency(total);
}

function removeReservationItem(index) {
  reservationItems.splice(index, 1);
  renderReservationItems();
}

async function handleReservationSubmit(e) {
  e.preventDefault();
  
  const customerName = document.getElementById('customer-name').value;
  
  if (!customerName || reservationItems.length === 0) {
    showToast('Agrega un nombre y al menos un producto', 'error');
    return;
  }
  
  const items = reservationItems.map(item => ({
    code: item.code,
    quantity: item.quantity
  }));
  
  try {
    await apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify({ customerName, items }),
    });
    
    closeReservationModal();
    showToast('Reserva creada correctamente', 'success');
    loadReservations();
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function completeReservation(id) {
  try {
    await apiRequest('/reservations/' + id + '/complete', { method: 'POST' });
    showToast('Reserva completada', 'success');
    loadReservations();
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function cancelReservation(id) {
  if (!confirm('¿Cancelar esta reserva? El stock será restaurado.')) return;
  
  try {
    await apiRequest('/reservations/' + id + '/cancel', { method: 'POST' });
    showToast('Reserva cancelada', 'success');
    loadReservations();
    loadProducts();
    loadDashboard();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ============ MOVEMENTS / HISTORY ============

async function loadMovements() {
  const container = document.getElementById('movements-container');
  container.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    const productCode = document.getElementById('search-movement-product')?.value || '';
    const type = document.getElementById('filter-movement-type')?.value || '';
    const dateFrom = document.getElementById('filter-movement-date-from')?.value || '';
    const dateTo = document.getElementById('filter-movement-date-to')?.value || '';
    
    let url = '/movements?limit=100';
    if (productCode) url += '&productCode=' + productCode;
    if (type) url += '&type=' + type;
    if (dateFrom) url += '&dateFrom=' + dateFrom;
    if (dateTo) url += '&dateTo=' + dateTo;
    
    const result = await apiRequest(url);
    const movements = result.movements || [];
    
    if (!movements.length) {
      container.innerHTML = '<p class="empty-state">No hay movimientos</p>';
      return;
    }
    
    const typeLabels = {
      entry: 'Entrada',
      sale: 'Venta',
      exit: 'Salida',
      adjustment: 'Ajuste',
      reservation: 'Reserva',
      reservation_release: 'Liberación',
      reservation_complete: 'Completada'
    };
    
    container.innerHTML = '<table class="movements-table" id="movements-table" data-sort-column="" data-sort-dir="">' +
      '<thead><tr>' +
        '<th onclick="sortTable(\'movements-table\', 0)">Fecha</th>' +
        '<th onclick="sortTable(\'movements-table\', 1)">Producto</th>' +
        '<th onclick="sortTable(\'movements-table\', 2)">Tipo</th>' +
        '<th onclick="sortTable(\'movements-table\', 3, true)">Antes</th>' +
        '<th onclick="sortTable(\'movements-table\', 4, true)">Cambio</th>' +
        '<th onclick="sortTable(\'movements-table\', 5, true)">Después</th>' +
        '<th onclick="sortTable(\'movements-table\', 6)">Usuario</th>' +
      '</tr></thead>' +
      '<tbody>' +
      movements.map(m => {
        const changeClass = m.quantityChange > 0 ? 'positive' : m.quantityChange < 0 ? 'negative' : '';
        return '<tr>' +
          '<td>' + new Date(m.timestamp).toLocaleString('es-ES') + '</td>' +
          '<td>' + escapeHtml(m.productName || m.productCode) + '</td>' +
          '<td><span class="movement-type movement-type-' + m.type + '">' + (typeLabels[m.type] || m.type) + '</span></td>' +
          '<td>' + m.quantityBefore + '</td>' +
          '<td class="' + changeClass + '">' + (m.quantityChange > 0 ? '+' : '') + m.quantityChange + '</td>' +
          '<td>' + m.quantityAfter + '</td>' +
          '<td>' + (m.user || '-') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

function exportMovements() {
  window.open('/api/movements/export?format=csv', '_blank');
}

// ============ REPORTS ============

let currentReportData = {};
let currentReportType = '';

async function loadReport(reportType, btn = null) {
  const container = document.getElementById('reports-container');
  container.innerHTML = '<div class="loading">Cargando...</div>';
  
  // Update active tab
  if (btn) {
    document.querySelectorAll('.reports-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  
  currentReportType = reportType;
  
  try {
    let url;
    switch (reportType) {
      case 'stock-low':
        url = '/reports/stock-low';
        break;
      case 'inventory-value':
        url = '/reports/inventory-value';
        break;
      case 'expiring':
        url = '/reports/expiring-products?days=30';
        break;
      case 'top-products':
        url = '/reports/top-products?limit=10';
        break;
      case 'reservations':
        url = '/reports/reservations-summary?days=30';
        break;
      default:
        url = '/reports/stock-low';
    }
    
    const data = await apiRequest(url);
    currentReportData[reportType] = data;
    
    switch (reportType) {
      case 'stock-low':
        renderStockLowReport(data, container);
        break;
      case 'inventory-value':
        renderInventoryValueReport(data, container);
        break;
      case 'expiring':
        renderExpiringReport(data, container);
        break;
      case 'top-products':
        renderTopProductsReport(data, container);
        break;
      case 'reservations':
        renderReservationsReport(data, container);
        break;
    }
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

// Función para ordenar tabla
function sortTable(tableId, column, isNumeric = false) {
  const table = document.getElementById(tableId);
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  
  // Toggle sort direction - use String comparison
  const currentSort = table.dataset.sortColumn || '';
  const currentDir = table.dataset.sortDir || '';
  const columnStr = String(column);
  
  // Toggle: if same column, flip direction; if different column, start with descending
  const newDir = currentSort === columnStr && currentDir === 'asc' ? 'desc' : 'asc';
  
  rows.sort((a, b) => {
    const aVal = a.children[column].textContent.trim();
    const bVal = b.children[column].textContent.trim();
    
    if (isNumeric) {
      const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, '')) || 0;
      const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, '')) || 0;
      return newDir === 'asc' ? aNum - bNum : bNum - aNum;
    } else {
      return newDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
  });
  
  // Save state as strings
  table.dataset.sortColumn = columnStr;
  table.dataset.sortDir = newDir;
  
  // Clear and re-add rows
  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
  
  // Update header indicators
  updateSortIndicators(table, column, newDir);
}

function updateSortIndicators(table, activeColumn, direction) {
  const headers = table.querySelectorAll('th');
  headers.forEach((th, i) => {
    th.style.color = i === activeColumn ? 'var(--primary)' : '';
  });
}

function renderStockLowReport(data, container) {
  const products = data.products || [];
  
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No hay productos con stock bajo</p>';
    return;
  }
  
  let html = '<div class="report-summary">' +
    '<div class="stat-card warning">' +
      '<div class="stat-value">' + data.totalProductsLow + '</div>' +
      '<div class="stat-label">Productos con stock bajo</div>' +
    '</div>' +
  '</div>';
  
  // Tabla de productos con ordenamiento
  html += '<table class="movements-table" id="report-stock-low" data-sort-column="" data-sort-dir="">' +
    '<thead><tr>' +
      '<th onclick="sortTable(\'report-stock-low\', 0)">Producto</th>' +
      '<th onclick="sortTable(\'report-stock-low\', 1)">Categoría</th>' +
      '<th onclick="sortTable(\'report-stock-low\', 2, true)">Stock</th>' +
      '<th onclick="sortTable(\'report-stock-low\', 3, true)">Mín</th>' +
      '<th onclick="sortTable(\'report-stock-low\', 4, true)">Deficit</th>' +
    '</tr></thead>' +
    '<tbody>';
  
  products.forEach(p => {
    html += '<tr>' +
      '<td>' + escapeHtml(p.name) + '</td>' +
      '<td>' + formatCategoryName(p.category) + '</td>' +
      '<td class="negative">' + p.stock + '</td>' +
      '<td>' + p.minStock + '</td>' +
      '<td class="negative">-' + p.deficit + '</td>' +
    '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderInventoryValueReport(data, container) {
  let html = '<div class="report-summary">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + data.totalProducts + '</div>' +
      '<div class="stat-label">Productos</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + formatNumber(data.totalStock) + '</div>' +
      '<div class="stat-label">Stock Total</div>' +
    '</div>' +
    '<div class="stat-card warning">' +
      '<div class="stat-value">' + formatCurrency(data.totalValue) + '</div>' +
      '<div class="stat-label">Valor Total</div>' +
    '</div>' +
  '</div>';
  
  // Por categoría
  html += '<h3>Por Categoría</h3>';
  html += '<table class="movements-table" id="report-inventory" data-sort-column="" data-sort-dir="">' +
    '<thead><tr>' +
      '<th onclick="sortTable(\'report-inventory\', 0)">Categoría</th>' +
      '<th onclick="sortTable(\'report-inventory\', 1, true)">Productos</th>' +
      '<th onclick="sortTable(\'report-inventory\', 2, true)">Stock</th>' +
      '<th onclick="sortTable(\'report-inventory\', 3, true)">Valor</th>' +
    '</tr></thead>' +
    '<tbody>';
  
  for (const [category, info] of Object.entries(data.byCategory)) {
    html += '<tr>' +
      '<td>' + escapeHtml(category) + '</td>' +
      '<td>' + info.products + '</td>' +
      '<td>' + formatNumber(info.stock) + '</td>' +
      '<td>' + formatCurrency(info.value) + '</td>' +
    '</tr>';
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderExpiringReport(data, container) {
  const products = data.products || [];
  
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No hay productos por vencer</p>';
    return;
  }
  
  let html = '<div class="report-summary">' +
    '<div class="stat-card warning">' +
      '<div class="stat-value">' + data.totalExpiring + '</div>' +
      '<div class="stat-label">Productos por vencer</div>' +
    '</div>' +
  '</div>';
  
  html += '<table class="movements-table" id="report-expiring" data-sort-column="" data-sort-dir="">' +
    '<thead><tr>' +
      '<th onclick="sortTable(\'report-expiring\', 0)">Producto</th>' +
      '<th onclick="sortTable(\'report-expiring\', 1, true)">Stock</th>' +
      '<th onclick="sortTable(\'report-expiring\', 2)">Vencimiento</th>' +
      '<th onclick="sortTable(\'report-expiring\', 3, true)">Días</th>' +
      '<th onclick="sortTable(\'report-expiring\', 4)">Urgencia</th>' +
    '</tr></thead>' +
    '<tbody>';
  
  products.forEach(p => {
    const urgencyClass = p.urgency === 'critical' ? 'negative' : p.urgency === 'warning' ? '' : 'positive';
    html += '<tr>' +
      '<td>' + escapeHtml(p.name) + '</td>' +
      '<td>' + p.stock + '</td>' +
      '<td>' + p.expiryDate + '</td>' +
      '<td class="' + urgencyClass + '">' + p.daysUntilExpiry + ' días</td>' +
      '<td><span class="movement-type movement-type-' + (p.urgency === 'critical' ? 'exit' : 'adjustment') + '">' + p.urgency + '</span></td>' +
    '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderTopProductsReport(data, container) {
  const products = data.products || [];
  
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No hay datos de ventas</p>';
    return;
  }
  
  let html = '<div class="report-summary">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + products.length + '</div>' +
      '<div class="stat-label">Productos con actividad</div>' +
    '</div>' +
  '</div>';
  
  html += '<table class="movements-table" id="report-top-products" data-sort-column="" data-sort-dir="">' +
    '<thead><tr>' +
      '<th onclick="sortTable(\'report-top-products\', 0, true)">#</th>' +
      '<th onclick="sortTable(\'report-top-products\', 1)">Producto</th>' +
      '<th onclick="sortTable(\'report-top-products\', 2, true)">Cantidad</th>' +
      '<th onclick="sortTable(\'report-top-products\', 3, true)">Valor Total</th>' +
    '</tr></thead>' +
    '<tbody>';
  
  products.forEach((p, i) => {
    html += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td>' + escapeHtml(p.name) + '</td>' +
      '<td>' + p.totalReserved + '</td>' +
      '<td>' + formatCurrency(p.totalValue) + '</td>' +
    '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderReservationsReport(data, container) {
  let html = '<div class="report-summary">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + data.total + '</div>' +
      '<div class="stat-label">Total Reservas</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + data.completed + '</div>' +
      '<div class="stat-label">Completadas</div>' +
    '</div>' +
    '<div class="stat-card warning">' +
      '<div class="stat-value">' + data.cancelled + '</div>' +
      '<div class="stat-label">Canceladas</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + data.conversionRate + '</div>' +
      '<div class="stat-label">Tasa Conversión</div>' +
    '</div>' +
  '</div>';
  
  html += '<div class="section" style="margin-top:20px;">' +
    '<h3>Valor Total: ' + formatCurrency(data.totalValue) + '</h3>' +
    '<p>Valor promedio por reserva: ' + formatCurrency(data.averageValue) + '</p>' +
  '</div>';
  
  container.innerHTML = html;
}

// Close modals on outside click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// Actualizar tiempos cada segundo
setInterval(updateReservationTimes, 1000);

// ============ THEME TOGGLE (DARK MODE) ============

function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme');
  
  // Apply saved theme or default to light
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggleBtn.textContent = '☀️';
  } else {
    toggleBtn.textContent = '🌙';
  }
  
  toggleBtn.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      toggleBtn.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      toggleBtn.textContent = '🌙';
    }
  });
}

// ============ SALES / VENTAS ============

let saleCart = [];
let allProductsForSale = [];

async function loadSalesView() {
  const container = document.getElementById('sale-products-list');
  container.innerHTML = '<div class="loading">Cargando...</div>';
  
  try {
    const result = await api.getProducts({ lowStock: undefined });
    allProductsForSale = (result.products || []).filter(p => p.stock > 0).map(p => {
      // Parse offer if it's a string
      if (p.offer && typeof p.offer === 'string') {
        try {
          p.offer = JSON.parse(p.offer);
        } catch (e) {
          p.offer = null;
        }
      }
      return p;
    });
    renderSaleProducts(allProductsForSale);
    
    // Initialize cart
    saleCart = [];
    updateSaleCart();
    
    // Setup search filter - without debounce for immediate filtering
    const saleSearch = document.getElementById('search-sale-product');
    if (saleSearch) {
      saleSearch.value = ''; // Clear search on view load
      saleSearch.addEventListener('input', function() {
        const term = (this.value || '').toLowerCase();
        const filtered = allProductsForSale.filter(p => 
          (p.name && p.name.toLowerCase().includes(term)) || 
          (p.code && p.code.toLowerCase().includes(term))
        );
        renderSaleProducts(filtered);
      });
    }
  } catch (err) {
    container.innerHTML = '<p class="error">Error: ' + err.message + '</p>';
  }
}

function renderSaleProducts(products) {
  const container = document.getElementById('sale-products-list');
  
  if (!products.length) {
    container.innerHTML = '<p class="empty-state">No hay productos disponibles</p>';
    return;
  }
  
  container.innerHTML = products.map(p => {
    // Parse offer if it's a string
    let offer = null;
    if (p.offer) {
      if (typeof p.offer === 'string') {
        try {
          offer = JSON.parse(p.offer);
        } catch (e) {
          offer = null;
        }
      } else if (typeof p.offer === 'object') {
        offer = p.offer;
      }
    }
    
    const hasOffer = offer && offer.active && offer.discount > 0;
    const offerBadge = hasOffer ? '<div class="product-offer-badge">OFERTA -' + offer.discount + '%</div>' : '';
    
    // Mostrar precio con descuento si tiene oferta
    let priceDisplay = formatCurrency(p.price);
    if (hasOffer) {
      const discountedPrice = p.price * (1 - offer.discount / 100);
      priceDisplay = '<span style="text-decoration: line-through; color: #999; font-size: 12px;">' + formatCurrency(p.price) + '</span> ' +
                     '<span style="color: var(--success); font-weight: bold;">' + formatCurrency(discountedPrice) + '</span>';
    }
    
    return '<div class="product-card">' +
      offerBadge +
      '<div class="product-name">' + escapeHtml(p.name) + '</div>' +
      '<div class="product-code">' + escapeHtml(p.code) + '</div>' +
      '<div class="product-stats">' +
        '<div class="product-stat"><div class="product-stat-label">Stock</div><div class="product-stat-value">' + p.stock + '</div></div>' +
        '<div class="product-stat"><div class="product-stat-label">Precio</div><div class="product-stat-value">' + priceDisplay + '</div></div>' +
      '</div>' +
      '<button class="btn btn-sm btn-primary" style="width: 100%; margin-top: 8px;" onclick="addToSaleCart(\'' + p.code + '\')">Agregar</button>' +
    '</div>';
  }).join('');
}

function addToSaleCart(productCode) {
  const product = allProductsForSale.find(p => p.code === productCode);
  if (!product) return;
  
  // Parse offer if it's a string
  let offer = null;
  if (product.offer) {
    if (typeof product.offer === 'string') {
      try {
        offer = JSON.parse(product.offer);
      } catch (e) {
        offer = null;
      }
    } else if (typeof product.offer === 'object') {
      offer = product.offer;
    }
  }
  
  const existing = saleCart.find(item => item.code === productCode);
  if (existing) {
    if (existing.quantity < product.stock) {
      existing.quantity++;
    } else {
      showToast('Stock máximo alcanzado', 'warning');
    }
  } else {
    saleCart.push({
      code: product.code,
      name: product.name,
      price: product.price,
      quantity: 1,
      maxStock: product.stock,
      offer: offer
    });
  }
  
  updateSaleCart();
}

function removeFromSaleCart(productCode) {
  const index = saleCart.findIndex(item => item.code === productCode);
  if (index > -1) {
    saleCart.splice(index, 1);
    updateSaleCart();
  }
}

function updateSaleCartItemQuantity(productCode, newQuantity) {
  const item = saleCart.find(i => i.code === productCode);
  if (item) {
    newQuantity = parseInt(newQuantity) || 0;
    if (newQuantity <= 0) {
      removeFromSaleCart(productCode);
    } else if (newQuantity <= item.maxStock) {
      item.quantity = newQuantity;
      updateSaleCart();
    } else {
      showToast('Stock insuficiente', 'warning');
    }
  }
}

function updateSaleCart() {
  const container = document.getElementById('sale-cart-items');
  
  if (!saleCart.length) {
    container.innerHTML = '<p class="empty-state">Agrega productos</p>';
    document.getElementById('sale-subtotal').textContent = '$0';
    document.getElementById('sale-total').textContent = '$0';
    document.getElementById('sale-discount-details').innerHTML = '';
    return;
  }
  
  let subtotal = 0;
  let totalDiscount = 0;
  let discountDetails = [];
  
  container.innerHTML = saleCart.map(item => {
    // Calcular precio con descuento si tiene oferta
    let finalPrice = item.price;
    let originalPrice = item.price;
    let hasOffer = item.offer && item.offer.active && item.offer.discount > 0;
    
    if (hasOffer) {
      finalPrice = item.price * (1 - item.offer.discount / 100);
      originalPrice = item.price;
      const itemDiscount = (originalPrice - finalPrice) * item.quantity;
      totalDiscount += itemDiscount;
      discountDetails.push({
        name: item.name,
        discount: itemDiscount,
        percent: item.offer.discount
      });
    }
    
    const itemTotal = finalPrice * item.quantity;
    subtotal += itemTotal;
    
    // Mostrar precio con descuento y sin descuento
    let priceDisplay = formatCurrency(finalPrice);
    if (hasOffer) {
      priceDisplay = '<span style="text-decoration: line-through; color: #999; font-size: 12px;">' + formatCurrency(originalPrice) + '</span> ' +
                     '<span style="color: var(--success); font-weight: bold;">' + formatCurrency(finalPrice) + '</span>';
    }
    
    return '<div class="alert-item">' +
      '<div class="alert-content">' +
        '<div class="alert-title">' + escapeHtml(item.name) + '</div>' +
        '<div class="alert-message">' + priceDisplay + ' x ' + item.quantity + ' = ' + formatCurrency(itemTotal) + '</div>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 8px;">' +
        '<input type="number" min="1" max="' + item.maxStock + '" value="' + item.quantity + '" ' +
        'onchange="updateSaleCartItemQuantity(\'' + item.code + '\', this.value)" ' +
        'style="width: 50px; padding: 4px; border: 1px solid var(--border); border-radius: 4px;">' +
        '<button class="btn btn-sm btn-danger" onclick="removeFromSaleCart(\'' + item.code + '\')">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
  
  // Calcular total
  const total = subtotal;
  
  // Mostrar subtotal (aquí es el total con descuentos aplicados para mantener compatibilidad)
  document.getElementById('sale-subtotal').textContent = formatCurrency(subtotal);
  
  // Mostrar descuento si hay
  let discountHtml = '';
  if (totalDiscount > 0) {
    discountHtml = '<div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: var(--success); font-weight: bold;">' +
      '<span>Descuento:</span>' +
      '<span>-' + formatCurrency(totalDiscount) + '</span>' +
    '</div>';
    // Mostrar detalle de descuentos
    discountDetails.forEach(d => {
      discountHtml += '<div style="display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-left: 8px;">' +
        '<span>' + d.name + ' (-' + d.percent + '%)</span>' +
        '<span>-' + formatCurrency(d.discount) + '</span>' +
      '</div>';
    });
  }
  
  document.getElementById('sale-discount-details').innerHTML = discountHtml;
  
  document.getElementById('sale-total').textContent = formatCurrency(total);
}

async function finalizeSale() {
  if (!saleCart.length) {
    showToast('Agrega productos al carrito', 'warning');
    return;
  }
  
  // Calcular descuento total basado en ofertas de productos
  let totalDiscount = 0;
  let originalTotal = 0;
  saleCart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    originalTotal += itemTotal;
    if (item.offer && item.offer.active && item.offer.discount > 0) {
      totalDiscount += itemTotal * (item.offer.discount / 100);
    }
  });
  
  const discountPercent = originalTotal > 0 ? (totalDiscount / originalTotal) * 100 : 0;
  const paymentMethod = document.getElementById('sale-payment-method')?.value || 'efectivo';
  
  const items = saleCart.map(item => ({
    code: item.code,
    quantity: item.quantity
  }));
  
  try {
    const response = await apiRequest('/sales', {
      method: 'POST',
      body: JSON.stringify({
        items,
        discountPercent,
        paymentMethod
      })
    });
    
    if (response.success) {
      showToast('Venta realizada correctamente', 'success');
      
      // Show ticket
      showTicket(response);
      
      // Clear cart
      saleCart = [];
      updateSaleCart();
      
      // Refresh other views
      loadDashboard();
      loadProducts();
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function showTicket(sale) {
  const items = JSON.parse(sale.sale.items);
  let ticketHtml = '<div style="font-family: monospace; font-size: 14px; padding: 20px;">' +
    '<h2 style="text-align: center; margin-bottom: 20px;">🧾 TICKET #' + sale.ticketNumber + '</h2>' +
    '<p>Fecha: ' + new Date(sale.sale.createdAt).toLocaleString('es-ES') + '</p>' +
    '<hr style="margin: 10px 0;">' +
    '<div style="margin-bottom: 10px;">';
  
  items.forEach(item => {
    ticketHtml += '<div style="display: flex; justify-content: space-between;">' +
      '<span>' + item.name + ' x' + item.quantity + '</span>' +
      '<span>' + formatCurrency(item.subtotal) + '</span>' +
    '</div>';
  });
  
  ticketHtml += '</div>' +
    '<hr style="margin: 10px 0;">' +
    '<div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>' + formatCurrency(sale.sale.subtotal) + '</span></div>';
  
  if (sale.sale.discountPercent > 0) {
    ticketHtml += '<div style="display: flex; justify-content: space-between;"><span>Descuento (' + sale.sale.discountPercent + '%):</span><span>-' + formatCurrency(sale.sale.discountAmount) + '</span></div>';
  }
  
  ticketHtml += '<div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px;"><span>TOTAL:</span><span>' + formatCurrency(sale.sale.total) + '</span></div>' +
    '<div style="margin-top: 10px;"><span>Método de pago: </span><span>' + sale.sale.paymentMethod + '</span></div>' +
    '<p style="text-align: center; margin-top: 20px;">¡Gracias por su compra!</p>' +
    '</div>';
  
  // Open ticket in new window for printing
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(ticketHtml);
  printWindow.document.write('<script>window.onload = function() { window.print(); };</script>');
  printWindow.document.close();
}

// Search handler for sales
document.addEventListener('DOMContentLoaded', function() {
  // Discount change handler
  const discountInput = document.getElementById('sale-discount');
  if (discountInput) {
    discountInput.addEventListener('input', updateSaleCart);
    discountInput.addEventListener('change', updateSaleCart);
  }
});

// ============ INIT ============

console.log('Farmality app starting...');

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, starting app...');
  initRouter();
  initEventListeners();
  initWebSocket();
  initTheme();
});
