/**
 * Farmality Web - API Client
 */

const API_BASE = '/api';

class FarmalityAPI {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      // Manejar respuestas de error
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(error.error || error.details?.join(', ') || `HTTP ${response.status}`);
      }

      // Manejar respuestas vacías (DELETE)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }

      return response.json();
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('No se pudo conectar al servidor');
      }
      throw err;
    }
  }

  // Health check
  async health() {
    return this.request('/health');
  }

  // ============ PRODUCTOS ============
  
  // Listar productos
  async getProducts(params = {}) {
    const query = new URLSearchParams();
    
    if (params.category) query.set('category', params.category);
    if (params.search) query.set('search', params.search);
    if (params.lowStock) query.set('lowStock', 'true');
    
    const queryString = query.toString();
    return this.request(`/products${queryString ? '?' + queryString : ''}`);
  }

  // Obtener un producto
  async getProduct(code) {
    return this.request(`/products/${encodeURIComponent(code)}`);
  }

  // Crear producto
  async createProduct(product) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }

  // Actualizar producto
  async updateProduct(code, updates) {
    return this.request(`/products/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // Eliminar producto
  async deleteProduct(code) {
    return this.request(`/products/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
  }

  // Ajustar stock
  async adjustStock(code, quantity, operation) {
    return this.request(`/products/${encodeURIComponent(code)}/stock`, {
      method: 'POST',
      body: JSON.stringify({ code, quantity, operation }),
    });
  }

  // ============ ALERTAS ============

  // Todas las alertas
  async getAllAlerts() {
    return this.request('/alerts/all');
  }

  // Alertas de stock bajo
  async getLowStockAlerts(severity = null) {
    const query = severity ? `?severity=${severity}` : '';
    return this.request(`/alerts/low-stock${query}`);
  }

  // Alertas de vencimiento
  async getExpiringAlerts(days = 30) {
    return this.request(`/alerts/expiring?days=${days}`);
  }

  // ============ ESTADÍSTICAS ============

  // Dashboard stats
  async getStats() {
    return this.request('/stats');
  }

  // Categorías
  async getCategories() {
    return this.request('/categories');
  }
}

// Instancia global
const api = new FarmalityAPI();
