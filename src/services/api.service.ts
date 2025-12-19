// src/services/api.service.ts

const API_URL = "/api";

interface RequestOptions extends RequestInit {
    skipAuth?: boolean;
}

class ApiService {
    private token: string | null = null;

    constructor() {
        if (typeof window !== "undefined") {
            this.token = localStorage.getItem("auth_token");
        }
    }

    private buildHeaders(includeAuth: boolean, body?: BodyInit | null): HeadersInit {
        const headers: Record<string, string> = {};

        if (!(body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }

        if (includeAuth && this.token) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }

        return headers;
    }

    public async request(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<any> {
        const url = `${API_URL}${endpoint}`;
        const includeAuth = options.skipAuth ? false : true;
        const headers = this.buildHeaders(includeAuth, options.body ?? null);

        const res = await fetch(url, {
            ...options,
            headers: {
                ...headers,
                ...(options.headers || {}),
            },
        });

        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
            let errBody: any = {};
            if (contentType.includes("application/json")) {
                errBody = await res.json().catch(() => ({}));
            } else {
                const text = await res.text().catch(() => "");
                errBody = { message: text };
            }

            const msg =
                errBody?.error?.message ||
                errBody?.error ||
                errBody?.message ||
                `HTTP ${res.status}`;
            throw new Error(msg);
        }

        if (contentType.includes("application/json")) {
            return res.json();
        }

        return res.text().catch(() => "");
    }

    // ========== Token Management ==========
    setToken(token: string) {
        this.token = token;
        localStorage.setItem("auth_token", token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem("auth_token");
    }

    getToken() {
        return this.token;
    }

    isAuthenticated() {
        return !!this.token;
    }

    // ========== Auth Routes ==========

    // Core signup method matching Backend expectation
    async signup(email: string, password: string, fullName: string) {
        const data = await this.request("/auth/signup", {
            method: "POST",
            body: JSON.stringify({ email, password, fullName }),
            skipAuth: true,
        });

        if (data.token) {
            this.setToken(data.token);
        }

        return data;
    }

    // ✅ FIXED: Alias 'register' to match Auth.tsx usage
    // Auth.tsx passes (fullName, email, password), so we map it correctly here.
    async register(fullName: string, email: string, password: string) {
        return this.signup(email, password, fullName);
    }

    async login(email: string, password: string) {
        const data = await this.request("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
            skipAuth: true,
        });

        if (data.token) {
            this.setToken(data.token);
        }

        return data;
    }

    // ✅ ADDED: Google Login Support
    async loginWithGoogle(token: string) {
        const data = await this.request("/auth/google", {
            method: "POST",
            body: JSON.stringify({ token }),
            skipAuth: true,
        });

        if (data.token) {
            this.setToken(data.token);
        }

        return data;
    }

    async logout() {
        this.clearToken();
    }

    async getCurrentUser() {
        return this.request("/auth/me");
    }

    // ========== Products Routes ==========

    async getProducts(category?: string | null, subCategory?: string | null, search?: string | null) {
        const params = new URLSearchParams();

        if (category && category !== 'all') params.append("category", category);
        if (subCategory && subCategory !== 'all') params.append("sub_category", subCategory);
        if (search) params.append("search", search);

        const query = params.toString() ? `?${params.toString()}` : "";
        return this.request(`/products${query}`, { method: "GET" });
    }

    async getProduct(id: string) {
        return this.request(`/products/${id}`, { method: "GET" });
    }

    async createProduct(productData: any | FormData) {
        const isForm = productData instanceof FormData;
        return this.request("/products", {
            method: "POST",
            body: isForm ? productData : JSON.stringify(productData),
        });
    }

    async updateProduct(id: string, productData: any | FormData) {
        const isForm = productData instanceof FormData;
        return this.request(`/products/${id}`, {
            method: "PUT",
            body: isForm ? productData : JSON.stringify(productData),
        });
    }

    async deleteProduct(id: string) {
        return this.request(`/products/${id}`, { method: "DELETE" });
    }

    // ========== Cart Routes ==========
    async getCart() {
        return this.request("/cart");
    }

    async addToCart(productId: string, quantity: number = 1) {
        return this.request("/cart/items", {
            method: "POST",
            body: JSON.stringify({ product_id: productId, quantity }),
        });
    }

    async updateCartItem(productId: string, quantity: number) {
        return this.request(`/cart/items/${productId}`, {
            method: "PUT",
            body: JSON.stringify({ quantity }),
        });
    }

    async removeFromCart(productId: string) {
        return this.request(`/cart/items/${productId}`, {
            method: "DELETE",
        });
    }

    async clearCart() {
        return this.request("/cart", {
            method: "DELETE",
        });
    }

    // ========== Orders Routes ==========
    async getOrders() {
        return this.request("/orders", { method: "GET" });
    }

    async getOrder(id: string) {
        return this.request(`/orders/${id}`, { method: "GET" });
    }

    async createOrder(items: any[], totalAmount: number, shippingAddress: any, paymentGateway: string, shippingAmount: number) {
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify({
                items,
                totalAmount,
                shippingAddress,
                paymentGateway,
                shippingAmount
            }),
        });
    }

    async cancelOrder(orderId: string) {
        return this.request(`/orders/${orderId}/cancel`, { method: "POST" });
    }

    async updateOrderAddress(orderId: string, address: any) {
        return this.request(`/orders/${orderId}/address`, {
            method: "PUT",
            body: JSON.stringify({ address })
        });
    }

    async updateOrderStatus(id: string, status: string) {
        return this.request(`/orders/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status }),
        });
    }

    async getAdminOrders() {
        return this.request("/orders/admin/all", { method: "GET" });
    }

    // ===== REVIEWS & LIKES =====
    async getProductReviews(productId: string) {
        return this.request(`/products/${productId}/reviews`, { method: "GET" });
    }

    async addProductReview(productId: string, rating: number, comment: string) {
        return this.request(`/products/${productId}/reviews`, {
            method: "POST",
            body: JSON.stringify({ rating, comment }),
        });
    }

    async isProductLiked(productId: string) {
        return this.request(`/products/${productId}/likes`);
    }

    async likeProduct(productId: string) {
        return this.request(`/products/${productId}/like`, { method: 'POST' });
    }

    async unlikeProduct(productId: string) {
        return this.request(`/products/${productId}/like`, { method: 'DELETE' });
    }

    async forgotPassword(email: string) {
        return this.request("/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email }),
            skipAuth: true,
        });
    }

    async resetPassword(token: string, newPassword: string) {
        return this.request("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, newPassword }),
            skipAuth: true,
        });
    }

    async sendQuoteRequest(formData: FormData) {
        return this.request("/quotes/request", {
            method: "POST",
            body: formData,
        });
    }

    async getAllQuotes() {
        return this.request('/quotes/admin/all');
    }

    async updateQuoteStatus(id: string, status: string) {
        return this.request(`/quotes/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }
}

export const apiService = new ApiService();