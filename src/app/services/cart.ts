import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  producto: any;
  cantidad: number;
  talla_id?: number;
  color_id?: number;
  subtotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  public cart$ = this.cartSubject.asObservable();

  addToCart(producto: any, cantidad: number = 1, talla_id?: number, color_id?: number) {
    // Por ahora, asumiremos que si es el mismo producto, sumamos cantidad
    const existing = this.cartItems.find(item => item.producto.id === producto.id);
    if (existing) {
      existing.cantidad += cantidad;
      existing.subtotal = existing.cantidad * existing.producto.precio;
    } else {
      this.cartItems.push({
        producto,
        cantidad,
        talla_id,
        color_id,
        subtotal: producto.precio * cantidad
      });
    }
    this.cartSubject.next(this.cartItems);
  }

  removeFromCart(index: number) {
    this.cartItems.splice(index, 1);
    this.cartSubject.next(this.cartItems);
  }

  getTotal(): number {
    return this.cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  }

  clearCart() {
    this.cartItems = [];
    this.cartSubject.next(this.cartItems);
  }
}

