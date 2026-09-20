import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CartService, CartItem } from '../../services/cart';

import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './shop.html',
  styleUrls: ['./shop.css']
})
export class Shop implements OnInit {
  isCartOpen = false;
  isCheckoutOpen = false;
  cartItems: CartItem[] = [];
  
  sucursales: any[] = [];
  sucursalSeleccionada: number | null = null;
  correoCliente: string = '';
  isProcessing = false;

  constructor(public cartService: CartService, private http: HttpClient, private cdr: ChangeDetectorRef) {
    this.cartService.cart$.subscribe(items => {
      this.cartItems = items;
      this.cdr.detectChanges();
    });
  }

  ngOnInit() {
    this.http.get<any[]>('http://34.230.18.9/api/v1/sucursales/sucursales').subscribe(res => {
      this.sucursales = res;
    });
  }

  toggleCart() {
    this.isCartOpen = !this.isCartOpen;
  }

  openCheckout() {
    this.isCartOpen = false;
    this.isCheckoutOpen = true;
  }

  tipoEntrega: string = 'Recojo en Tienda';
  direccionEnvio: string = '';
  metodoPagoGlobal: string = 'Caja';
  numeroTarjeta: string = '';

  onTarjetaNativeInput(event: any) {
    let input = event.target.value.replace(/\D/g, '').substring(0, 16);
    let formatted = input !== '' ? input.match(/.{1,4}/g)!.join(' ') : '';
    event.target.value = formatted;
    this.numeroTarjeta = formatted;
  }

  onTipoEntregaChange() {
    this.metodoPagoGlobal = this.tipoEntrega === 'Recojo en Tienda' ? 'Caja' : 'Efectivo';
  }

  onMetodoPagoChange() {}

  confirmarPedido() {
    if (!this.correoCliente) {
      alert("Por favor completa los datos requeridos.");
      return;
    }
    
    if (this.tipoEntrega === 'Recojo en Tienda' && !this.sucursalSeleccionada) {
      alert("Debes seleccionar una sucursal para el recojo.");
      return;
    }
    if (this.tipoEntrega === 'Delivery' && (!this.direccionEnvio || this.direccionEnvio.trim() === '')) {
      alert("Debes ingresar una dirección para el envío.");
      return;
    }

    this.isProcessing = true;
    this.cdr.detectChanges();

    const procesarPedido = () => {
      // Si pagan presencial y es recojo, es una Reserva
      if (this.tipoEntrega === 'Recojo en Tienda' && this.metodoPagoGlobal === 'Caja') {
        const payload = {
          usuario_id: 2, // Hardcodeado al usuario Cliente
          sucursal_id: this.sucursalSeleccionada,
          estado: "Pendiente",
          detalles: this.cartItems.map(item => ({
            producto_id: item.producto.id,
            talla_id: item.talla_id || 1,
            color_id: item.color_id || 1,
            cantidad: item.cantidad,
            precio_unitario: item.producto.precio,
            subtotal: item.subtotal
          }))
        };

        this.http.post('http://34.230.18.9/api/v1/reservas/', payload).subscribe({
          next: () => {
            this.finalizarProceso("¡Reserva completada con éxito! Te esperamos en caja para realizar el pago.");
          },
          error: (err) => {
            this.manejarError(err);
          }
        });

      } else {
        // Si pagan digitalmente (QR/Tarjeta) o es Delivery (Efectivo/Digital), es una Venta directa
        const payload = {
          sucursal_id: this.sucursalSeleccionada || 1, 
          usuario_id: 2,
          metodo_pago: this.metodoPagoGlobal,
          transaccion_id: this.metodoPagoGlobal !== 'Efectivo' && this.metodoPagoGlobal !== 'Caja' ? "TXN-" + Math.floor(Math.random() * 1000000) : null,
          tipo_entrega: this.tipoEntrega,
          direccion_envio: this.tipoEntrega === 'Delivery' ? this.direccionEnvio : 'Retiro en Tienda Pagado',
          detalles: this.cartItems.map(item => ({
            producto_id: item.producto.id,
            talla_id: item.talla_id || 1,
            color_id: item.color_id || 1,
            cantidad: item.cantidad,
            precio_unitario: item.producto.precio,
            subtotal: item.subtotal
          }))
        };

        this.http.post('http://34.230.18.9/api/v1/ventas/', payload).subscribe({
          next: () => {
            if (this.tipoEntrega === 'Delivery') {
              this.finalizarProceso("¡Pago exitoso! Tu pedido está en camino.");
            } else {
              this.finalizarProceso("¡Pago online exitoso! Tus prendas te esperan listas en la sucursal.");
            }
          },
          error: (err) => {
            this.manejarError(err);
          }
        });
      }
    };

    // Simulamos un delay de procesamiento de pagos (2 segundos) si es Tarjeta o QR
    if (this.metodoPagoGlobal === 'Tarjeta' || this.metodoPagoGlobal === 'QR') {
      setTimeout(() => procesarPedido(), 2000);
    } else {
      procesarPedido();
    }
  }

  isSuccess: boolean = false;
  successMessage: string = '';
  fechaExpiracion: string = '';

  onFechaNativeInput(event: any) {
    let input = event.target.value.replace(/\D/g, '').substring(0, 4);
    if (input.length > 2) {
      input = input.substring(0, 2) + '/' + input.substring(2, 4);
    }
    event.target.value = input;
    this.fechaExpiracion = input;
  }

  finalizarProceso(mensaje: string) {
    this.isProcessing = false;
    this.cartService.clearCart();
    this.successMessage = mensaje;
    this.isSuccess = true;
    this.cdr.detectChanges();
  }

  closeCheckout() {
    this.isCheckoutOpen = false;
    setTimeout(() => {
      this.isSuccess = false;
      this.cdr.detectChanges();
    }, 500); // reset after closing
  }

  manejarError(err: any) {
    this.isProcessing = false;
    this.cdr.detectChanges();
    console.error(err);
    alert("Hubo un error al procesar tu solicitud: " + (err.error?.detail || err.message));
  }

  removeFromCart(index: number) {
    this.cartService.removeFromCart(index);
  }
}

