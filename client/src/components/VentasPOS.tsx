import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Trash2, Printer, AlertTriangle, ChevronRight, X, CheckCircle, Pause, Play, Clock, Lock, Camera, Maximize, WifiOff, Wifi } from 'lucide-react';
import { getDatabase, type ProductDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useToast } from './ToastNotification';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';

interface VentasPOSProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

interface CartItem {
  product: ProductDocType;
  quantity: number;
}

interface SuspendedSale {
  id: string;
  cart: CartItem[];
  timestamp: string;
  label: string;
}

export default function VentasPOS({ user, searchTerm = '' }: VentasPOSProps) {
  const { dolarRate, convertToVES, formatVES, formatUSD } = useExchangeRate();
  const { addToast } = useToast();
  const { settings } = useBusinessSettings();
  const [products, setProducts] = useState<ProductDocType[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');
  const [ticketReceipt, setTicketReceipt] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Checkout & Cashier Calculator states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [usdPaid, setUsdPaid] = useState('0');
  const [vesPaid, setVesPaid] = useState('0');
  const [eurPaid, setEurPaid] = useState('0');
  const [igtfApplied, setIgtfApplied] = useState(false);
  const [changeCurrency, setChangeCurrency] = useState<'USD' | 'VES'>('VES');

  // Mobile drawer states
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Camera Barcode Scanner states
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerStream, setScannerStream] = useState<MediaStream | null>(null);
  const [manualScanCode, setManualScanCode] = useState('');

  // Suspend/Resume sale states
  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([]);
  const [showSuspendedPanel, setShowSuspendedPanel] = useState(false);

  // D2: Offline/Online connectivity status for POS banner
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.log('Audio beep fail', e);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    if (!code.trim()) return;
    const matched = products.find(p => p.code === code.trim());
    if (matched) {
      addToCart(matched);
      playBeep();
      addToast({
        type: 'success',
        title: 'Código Escaneado',
        message: `Se agregó ${matched.name} al carrito.`
      });
      setManualScanCode('');
    } else {
      addToast({
        type: 'warning',
        title: 'Producto No Encontrado',
        message: `El código "${code}" no está registrado en el inventario.`
      });
    }
  };

  useEffect(() => {
    if (showCameraScanner) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          setScannerStream(stream);
          const videoElement = document.getElementById('barcode-scanner-video') as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = stream;
            videoElement.play().catch(e => console.log('Video play error', e));
          }
        })
        .catch(err => {
          console.error('Error opening camera:', err);
          addToast({
            type: 'warning',
            title: 'Cámara No Disponible',
            message: 'No se pudo activar la cámara WebRTC. Utilice la simulación de escaneo.'
          });
        });
    } else {
      if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        setScannerStream(null);
      }
    }
    return () => {
      if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCameraScanner]);

  // Suspend current sale
  const handleSuspendSale = () => {
    if (cart.length === 0) return;
    const suspended: SuspendedSale = {
      id: `SUS-${Date.now().toString().slice(-6)}`,
      cart: [...cart],
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      label: `${cart.length} items — ${formatUSD(cart.reduce((s, i) => s + i.product.price * i.quantity, 0))}`
    };
    setSuspendedSales(prev => [...prev, suspended]);
    setCart([]);
    setShowMobileCart(false);
    addToast({ type: 'info', title: 'Venta suspendida', message: `Ticket ${suspended.id} guardado. ${cart.length} producto(s) en espera.` });
  };

  // Resume a suspended sale
  const handleResumeSale = (saleId: string) => {
    const sale = suspendedSales.find(s => s.id === saleId);
    if (!sale) return;
    // If current cart has items, suspend it first
    if (cart.length > 0) {
      handleSuspendSale();
    }
    setCart(sale.cart);
    setSuspendedSales(prev => prev.filter(s => s.id !== saleId));
    setShowSuspendedPanel(false);
    addToast({ type: 'success', title: 'Venta recuperada', message: `Ticket ${saleId} restaurado al carrito.` });
  };

  // Delete a suspended sale
  const handleDeleteSuspended = (saleId: string) => {
    setSuspendedSales(prev => prev.filter(s => s.id !== saleId));
    addToast({ type: 'warning', title: 'Venta descartada', message: `Ticket ${saleId} eliminado.` });
  };

  // Carga los productos desde IndexedDB
  const loadProducts = async () => {
    try {
      const db = await getDatabase();
      const allProds = await db.products.find().exec();
      setProducts(allProds.map(doc => doc.toJSON()));
    } catch (err) {
      console.error('Error al cargar productos:', err);
    }
  };

  useEffect(() => {
    loadProducts();

    // Responsive listener
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);

    // D2: Online/Offline event listeners
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Suscribirse a cambios reactivos
    let sub: any;
    getDatabase().then(db => {
      sub = db.products.find().$.subscribe(() => {
        loadProducts();
      });
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (sub) sub.unsubscribe();
    };
  }, []);

  const activeSearch = searchTerm || localSearchTerm;

  // Filtrar productos
  const filteredProducts = products.filter(prod => 
    prod.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    prod.code.includes(activeSearch) ||
    prod.category.toLowerCase().includes(activeSearch.toLowerCase())
  );

  const addToCart = (product: ProductDocType) => {
    setErrorMessage(null);
    if (product.stock <= 0) {
      setErrorMessage(`El producto "${product.name}" no tiene stock disponible.`);
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        setErrorMessage(`No puedes agregar más de ${product.stock} unidades de "${product.name}".`);
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      setCart(newCart);
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setErrorMessage(null);
    const newCart = cart.map(item => {
      if (item.product.id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.product.stock) {
          setErrorMessage(`No puedes exceder el stock disponible (${item.product.stock} unidades).`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[];

    setCart(newCart);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCheckoutModal) {
          setShowCheckoutModal(false);
          e.preventDefault();
        } else if (showSuspendedPanel) {
          setShowSuspendedPanel(false);
          e.preventDefault();
        } else if (ticketReceipt) {
          setTicketReceipt(null);
          e.preventDefault();
        }
        return;
      }

      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Enter' && isInputFocused && target.classList.contains('search-input')) {
        if (filteredProducts.length > 0) {
          addToCart(filteredProducts[0]);
          setLocalSearchTerm('');
          e.preventDefault();
        }
        return;
      }

      if (isInputFocused) return;

      if (cart.length > 0) {
        const lastItem = cart[cart.length - 1];
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          updateQuantity(lastItem.product.id, 1);
        } else if (e.key === '-') {
          e.preventDefault();
          updateQuantity(lastItem.product.id, -1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCheckoutModal, showSuspendedPanel, ticketReceipt, cart, filteredProducts]);

  // Totales en dólares
  const subtotalUSD = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const ivaUSD = subtotalUSD * (settings.ivaRate / 100);
  const totalUSD = subtotalUSD + ivaUSD;

  // Totales en Bolívares
  const totalVES = convertToVES(totalUSD);

  // Received amounts parsed as numbers
  const usdReceived = parseFloat(usdPaid) || 0;
  const vesReceived = parseFloat(vesPaid) || 0;
  const eurReceived = parseFloat(eurPaid) || 0;

  // EUR to USD conversion (approx 1.085)
  const eurReceivedInUSD = eurReceived * 1.085;

  // VES to USD conversion
  const vesReceivedInUSD = vesReceived / dolarRate;

  // Total received in USD (all payment sources converted)
  const totalReceivedUSD = usdReceived + vesReceivedInUSD + eurReceivedInUSD;

  // Calculate IGTF (3% on USD and EUR cash payments)
  const igtfUSD = igtfApplied ? (usdReceived + eurReceivedInUSD) * 0.03 : 0;

  // Adjust total due including IGTF
  const totalDueUSD = totalUSD + igtfUSD;

  // Remaining balance
  const remainingUSD = Math.max(0, totalDueUSD - totalReceivedUSD);

  // Change (Vuelto) if they overpay
  const changeUSD = Math.max(0, totalReceivedUSD - totalDueUSD);
  const changeVES = changeUSD * dolarRate;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMessage(null);

    try {
      const db = await getDatabase();
      
      // Validar stock antes de abrir el modal
      for (const item of cart) {
        const doc = await db.products.findOne({ selector: { id: item.product.id } }).exec();
        if (!doc || doc.get('stock') < item.quantity) {
          throw new Error(`Stock insuficiente para "${item.product.name}".`);
        }
      }

      // Reiniciar montos de cobro y abrir modal
      setUsdPaid('0');
      setVesPaid('0');
      setEurPaid('0');
      setIgtfApplied(false);
      setChangeCurrency('VES');
      setShowCheckoutModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de validación.');
    }
  };

  const confirmCheckout = async () => {
    setErrorMessage(null);
    try {
      const db = await getDatabase();
      const saleId = crypto.randomUUID();
      const ticketNumber = `TK-${Date.now().toString().slice(-6)}`;

      // Validar stock antes de escribir
      for (const item of cart) {
        const doc = await db.products.findOne({ selector: { id: item.product.id } }).exec();
        if (!doc || doc.get('stock') < item.quantity) {
          throw new Error(`Stock insuficiente para "${item.product.name}" durante el cobro.`);
        }
      }

      // Restar stock localmente en IndexedDB
      for (const item of cart) {
        const doc = await db.products.findOne({ selector: { id: item.product.id } }).exec();
        if (doc) {
          const currentStock = doc.get('stock');
          const currentVersion = doc.get('version') || 1;
          await doc.patch({
            stock: currentStock - item.quantity,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Determinar método de pago final
      let finalPaymentMethod: string = paymentMethod;
      const paymentSources = [];
      if (usdReceived > 0) paymentSources.push('EFECTIVO USD');
      if (vesReceived > 0) paymentSources.push('VES');
      if (eurReceived > 0) paymentSources.push('EFECTIVO EUR');
      
      if (paymentSources.length > 1) {
        finalPaymentMethod = 'MIXTO';
      } else if (paymentSources.length === 1) {
        finalPaymentMethod = paymentSources[0] === 'VES' ? paymentMethod : 'EFECTIVO';
      }

      // Registrar la Venta en IndexedDB
      const newSale = {
        id: saleId,
        ticketNumber,
        cashierId: user.id,
        clientId: 'Cliente General',
        total: Number(totalDueUSD.toFixed(2)),
        paymentMethod: finalPaymentMethod,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: item.product.price
        })),
        pendingSync: true,
        dolarRate: Number(dolarRate),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.sales.insert(newSale);

      // Generar el Ticket para vista de impresión con moneda dual
      setTicketReceipt({
        ticketNumber,
        cashierName: user.name,
        paymentMethod: finalPaymentMethod,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          subtotal: item.product.price * item.quantity
        })),
        subtotalUSD: Number(subtotalUSD.toFixed(2)),
        ivaUSD: Number(ivaUSD.toFixed(2)),
        igtfUSD: Number(igtfUSD.toFixed(2)),
        totalUSD: Number(totalDueUSD.toFixed(2)),
        dolarRate: dolarRate,
        date: new Date().toLocaleString('es-VE'),
        paymentBreakdown: {
          usd: usdReceived,
          ves: vesReceived,
          eur: eurReceived,
          change: changeCurrency === 'USD' ? changeUSD : changeVES,
          changeCurrency: changeCurrency
        }
      });

      // Limpia el carrito y cierra el drawer móvil
      setCart([]);
      setShowMobileCart(false);
      setShowCheckoutModal(false);
      
      // Lanza sincronización silenciosa
      syncWorker.sync();

      // Toast de éxito
      addToast({ type: 'success', title: '¡Venta registrada!', message: `Ticket ${ticketNumber} procesado por ${formatUSD(totalDueUSD)}.` });

    } catch (err: any) {
      setErrorMessage(err.message || 'Error durante el checkout.');
      setShowCheckoutModal(false);
      addToast({ type: 'error', title: 'Error en el cobro', message: err.message || 'No se pudo procesar la venta.' });
    }
  };

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Renders the standard shopping cart contents
  const renderCartContents = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', overflow: 'hidden' }}>
      
      {/* Lista de Items */}
      <div style={{ flex: 1, overflowY: 'auto', margin: '12px 0', paddingRight: '4px' }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <ShoppingCart size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
            <span>El carrito de compras está vacío.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cart.map((item, index) => {
              return (
                <div 
                  key={index} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)'
                  }}
                >
                  <div style={{ flexGrow: 1, minWidth: 0, marginRight: '8px' }}>
                    <h5 style={{ fontWeight: 800, fontSize: '12.5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: 0 }}>
                      {item.product.name}
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                        {formatUSD(item.product.price)} x {item.quantity}
                      </span>
                      <span style={{ fontSize: '9.5px', color: 'var(--brand-gold)', fontFamily: 'monospace' }}>
                        Bs. {convertToVES(item.product.price).toFixed(1)} c/u
                      </span>
                    </div>
                  </div>
                  
                  {/* Controles de Cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={() => updateQuantity(item.product.id, -1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: 800, fontSize: '13px' }}>{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product.id, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      +
                    </button>
                    
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', marginLeft: '4px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totales y Métodos de Pago */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Desglose de Precios en Moneda Dual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Subtotal:</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{formatUSD(subtotalUSD)}</span>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{formatVES(subtotalUSD)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span>IVA (16% RIF):</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{formatUSD(ivaUSD)}</span>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{formatVES(ivaUSD)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14.5px', color: 'var(--text-primary)', borderTop: '1.5px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
            <span>Total a Pagar:</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', color: 'var(--brand-primary)' }}>{formatUSD(totalUSD)}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--brand-gold)', fontFamily: 'monospace' }}>{formatVES(totalUSD)}</span>
            </div>
          </div>
        </div>

        {/* Selector de Métodos de Pago */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Método de Pago
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map(method => {
              const isActive = paymentMethod === method;
              return (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    padding: '8px 0',
                    borderRadius: '10px',
                    border: isActive ? '1.5px solid var(--brand-teal)' : '1.5px solid var(--border-color)',
                    backgroundColor: isActive ? 'rgba(14, 165, 164, 0.08)' : 'var(--bg-input)',
                    color: isActive ? 'var(--brand-teal)' : 'var(--text-secondary)',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        {/* Suspended Sales Badge */}
        {suspendedSales.length > 0 && (
          <button
            className="suspended-sales-badge"
            onClick={() => setShowSuspendedPanel(!showSuspendedPanel)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Clock size={14} />
            <span>{suspendedSales.length} venta(s) en espera</span>
            <span className="badge-count">{suspendedSales.length}</span>
          </button>
        )}

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Suspend Button */}
          <button
            onClick={handleSuspendSale}
            disabled={cart.length === 0}
            className="btn-pill-dark"
            style={{
              flex: '0 0 auto',
              padding: '12px 14px',
              borderRadius: '14px',
              justifyContent: 'center',
              fontSize: '12px',
              opacity: cart.length === 0 ? 0.4 : 1,
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              border: '1.5px solid var(--border-color)',
              gap: '6px'
            }}
            title="Suspender venta actual y atender otro cliente"
          >
            <Pause size={14} />
          </button>

          {/* Checkout Button */}
          <button 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="btn-yellow"
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '14px',
              justifyContent: 'center',
              fontSize: '13px',
              opacity: cart.length === 0 ? 0.5 : 1,
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <span>COMPLETAR COBRO</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  if (settings.isPOSLocked) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        width: '100%',
        height: '100%',
        minHeight: '400px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--card-radius)',
        border: '1.5px solid var(--border-color)',
        gap: '20px',
        textAlign: 'center'
      }} className="animate-entrance">
        <div style={{
          padding: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444'
        }}>
          <Lock size={40} />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Caja Registradora Inactiva / Turno Cerrado
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.6', margin: 0 }}>
          El arqueo de turno actual ha sido completado y la caja ha sido inhabilitada temporalmente.
        </p>
        <div style={{
          padding: '10px 16px',
          borderRadius: '12px',
          backgroundColor: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          fontWeight: 600
        }}>
          Por favor, ingrese al módulo de **Arqueo de Caja** para iniciar un nuevo turno o solicitar la aprobación del Administrador.
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: '0px',
      width: '100%',
      paddingBottom: '30px'
    }}>

      {/* D2: Offline/Online Banner */}
      {!isOnline ? (
        <div className="animate-entrance" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          marginBottom: '20px',
          borderRadius: '14px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1.5px solid rgba(245, 158, 11, 0.2)',
          color: '#f59e0b',
          fontSize: '12.5px',
          fontWeight: 700,
          backdropFilter: 'blur(8px)'
        }}>
          <WifiOff size={18} />
          <span>⚠️ MODO OFFLINE — Las ventas se guardan localmente y se sincronizarán automáticamente al reconectar.</span>
        </div>
      ) : (
        <div className="animate-entrance" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          marginBottom: '16px',
          borderRadius: '12px',
          backgroundColor: 'rgba(16, 185, 129, 0.06)',
          border: '1px solid rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          fontSize: '11.5px',
          fontWeight: 600
        }}>
          <Wifi size={14} />
          <span>🟢 Conectado al servidor central — sincronización activa</span>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', 
        gap: '28px', 
        width: '100%'
      }}>
      
      {/* PANEL IZQUIERDO: CATÁLOGO DE PRODUCTOS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
        
        {/* Buscador local */}
        {!searchTerm && (
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <div className="search-container" style={{ flex: 1, height: '40px' }}>
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por nombre, código de barras o categoría..." 
                className="search-input" 
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowCameraScanner(true)}
              className="btn-yellow"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                padding: 0,
                borderRadius: '12px',
                flexShrink: 0
              }}
              title="Escáner por Cámara WebRTC"
            >
              <Camera size={18} />
            </button>
          </div>
        )}

        {/* Mensaje de Alerta / Error */}
        {errorMessage && (
          <div className="animate-entrance" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            color: '#ef4444',
            padding: '12px 18px',
            borderRadius: '16px',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1.5px solid rgba(239, 68, 68, 0.15)'
          }}>
            <AlertTriangle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mosaico de Productos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '20px',
          paddingRight: '6px'
        }}>
          {filteredProducts.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              No se encontraron productos disponibles en el inventario local.
            </div>
          ) : (
            filteredProducts.map(prod => {
              const isLowStock = prod.stock <= prod.minStock;
              const prodPriceVES = convertToVES(prod.price);
              return (
                <div 
                  key={prod.id} 
                  onClick={() => addToCart(prod)}
                  className="widget animate-entrance"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: 'var(--card-radius)',
                    cursor: 'pointer',
                    minHeight: '155px',
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    opacity: prod.stock === 0 ? 0.6 : 1
                  }}
                >
                  <div>
                    <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {prod.category}
                    </span>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: '4px 0 2px 0', lineHeight: '1.2', color: 'var(--text-primary)' }}>
                      {prod.name}
                    </h4>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      SKU: {prod.code}
                    </span>
                  </div>

                  {/* Moneda dual en cada producto del catálogo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--text-primary)', margin: 0 }}>
                        {formatUSD(prod.price)}
                      </span>
                      <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--brand-gold)', fontFamily: 'monospace', marginTop: '1px' }}>
                        Bs. {prodPriceVES.toLocaleString('es-VE', { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                    <span className={`status-badge ${prod.stock === 0 ? 'shipped' : isLowStock ? 'shipped' : 'delivered'}`} style={{ fontSize: '10px' }}>
                      {prod.stock === 0 ? 'Agotado' : `${prod.stock} u.`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* PANEL DERECHO: CARRITO DE COMPRAS (SÓLO VISIBLE EN ESCRITORIO) */}
      {!isMobile && (
        <div className="widget" style={{
          borderRadius: 'var(--card-radius)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: 'fit-content',
          maxHeight: '600px',
          position: 'sticky',
          top: '24px'
        }}>
          <div className="widget-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 className="widget-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Carrito POS ({cartItemsCount})</span>
            </h3>
          </div>
          {renderCartContents()}
        </div>
      )}

      {/* BOTÓN FLOTANTE CARRITO POS MÓVIL (ÚNICAMENTE EN MÓVILES) */}
      {isMobile && cart.length > 0 && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="btn-yellow animate-entrance"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            borderRadius: '50px',
            padding: '16px 24px',
            boxShadow: '0 8px 30px rgba(251,191,36,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 800
          }}
        >
          <ShoppingCart size={16} />
          <span>Ver Carrito ({cartItemsCount})</span>
          <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '8px', color: '#fff', fontFamily: 'monospace' }}>
            Bs. {totalVES.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
          </span>
        </button>
      )}

      {/* CARRITO MÓVIL SHEET DRAWER (BOTTOM SHEETS DESLIZANTE MÓVIL) */}
      {isMobile && showMobileCart && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1400,
          display: 'flex',
          alignItems: 'flex-end',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div className="widget" style={{
            width: '100%',
            height: '80vh',
            borderTopLeftRadius: 'var(--card-radius)',
            borderTopRightRadius: 'var(--card-radius)',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            padding: '20px 24px',
            boxShadow: '0 -15px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '15px' }}>Detalles del Pedido</h4>
              </div>
              <button 
                onClick={() => setShowMobileCart(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {renderCartContents()}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANEL DE VENTAS SUSPENDIDAS */}
      {showSuspendedPanel && suspendedSales.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1450,
          padding: '20px'
        }} onClick={() => setShowSuspendedPanel(false)}>
          <div
            className="widget animate-entrance"
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--brand-gold)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Ventas en Espera
                </h3>
              </div>
              <button
                onClick={() => setShowSuspendedPanel(false)}
                className="theme-toggle-btn"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {suspendedSales.map((sale) => (
                <div key={sale.id} className="suspended-sale-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)' }}>{sale.id}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{sale.timestamp}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sale.label}</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleResumeSale(sale.id)}
                      className="btn-yellow"
                      style={{ flex: 1, padding: '6px 0', fontSize: '10px', borderRadius: '8px', justifyContent: 'center', gap: '4px' }}
                    >
                      <Play size={12} />
                      <span>Recuperar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSuspended(sale.id)}
                      className="btn-pill-dark"
                      style={{ padding: '6px 12px', fontSize: '10px', borderRadius: '8px', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRO DE PAGO Y CALCULADORA DE VUELTO (NUEVO MODAL DUAL) */}
      {showCheckoutModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500,
          padding: '20px'
        }} onClick={() => setShowCheckoutModal(false)}>
          <div 
            className="widget animate-entrance" 
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.01)'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Registro de Cobro y Vuelto
              </h3>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="theme-toggle-btn"
                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Resumen a Pagar */}
              <div style={{
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-primary)',
                border: '1.5px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL A COBRAR (BASE)</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
                    {formatUSD(totalUSD)}
                  </strong>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--brand-gold)', fontWeight: 700, fontFamily: 'monospace' }}>
                    {formatVES(totalUSD)}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Tasa: Bs. {dolarRate.toFixed(2)}</span>
                </div>
              </div>

              {/* Toggle IGTF 3% Divisas */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: igtfApplied ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
                border: `1.5px solid ${igtfApplied ? 'rgba(251, 191, 36, 0.25)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }} onClick={() => setIgtfApplied(!igtfApplied)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '85%' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: igtfApplied ? 'var(--brand-gold)' : 'var(--text-primary)' }}>
                    Aplicar Impuesto IGTF (3%)
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Obligatorio para pagos en divisas físicas o cuentas extranjeras.
                  </span>
                </div>
                <div className={`theme-switcher-pill`} style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: igtfApplied ? 'var(--brand-gold)' : 'var(--bg-input)',
                  position: 'relative',
                  transition: 'background-color 0.2s ease'
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: igtfApplied ? '19px' : '3px',
                    transition: 'left 0.2s ease'
                  }} />
                </div>
              </div>

              {/* Desglose Fiscal si IGTF está activo */}
              {igtfApplied && (
                <div className="animate-entrance" style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Impuesto Base (16% IVA):</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(ivaUSD)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Recargo IGTF (3%):</span>
                    <strong style={{ color: 'var(--brand-gold)' }}>{formatUSD(igtfUSD)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '2px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total con Impuestos:</span>
                    <strong style={{ color: 'var(--brand-primary)' }}>{formatUSD(totalDueUSD)} / {formatVES(totalDueUSD)}</strong>
                  </div>
                </div>
              )}

              {/* Declarar Pagos Recibidos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Montos Recibidos del Cliente
                </label>
                
                {/* Dólares Efectivo */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--brand-primary)', width: '32px' }}>USD</span>
                  <input
                    type="text"
                    value={usdPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setUsdPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                    placeholder="0.00"
                  />
                </div>

                {/* Bolívares Pago Móvil/Punto */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--brand-gold)', width: '32px' }}>VES</span>
                  <input
                    type="text"
                    value={vesPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setVesPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                    placeholder="0.00"
                  />
                </div>

                {/* Euros Efectivo */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#3b82f6', width: '32px' }}>EUR</span>
                  <input
                    type="text"
                    value={eurPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setEurPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right'
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Status de Balance y Vuelto */}
              <div style={{
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: remainingUSD > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(14, 165, 164, 0.05)',
                border: `1.5px solid ${remainingUSD > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(14, 165, 164, 0.2)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                {remainingUSD > 0 ? (
                  <>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#ef4444' }}>FALTA POR COBRAR</span>
                    <strong style={{ fontSize: '18px', color: '#ef4444' }}>
                      {formatUSD(remainingUSD)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      o {formatVES(remainingUSD)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-primary)' }}>PAGO COMPLETADO</span>
                    <strong style={{ fontSize: '18px', color: 'var(--brand-primary)' }}>
                      {changeUSD > 0 ? formatUSD(changeUSD) : '$ 0.00'}
                    </strong>
                    {changeUSD > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Vuelto sugerido en Bolívares: <strong>{formatVES(changeUSD)}</strong>
                        </span>
                        
                        {/* Selector moneda vuelto */}
                        <div style={{
                          display: 'flex',
                          backgroundColor: 'var(--bg-primary)',
                          padding: '3px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          alignSelf: 'center',
                          width: '180px'
                        }}>
                          <button
                            onClick={() => setChangeCurrency('VES')}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: changeCurrency === 'VES' ? 'var(--bg-card)' : 'transparent',
                              color: changeCurrency === 'VES' ? 'var(--brand-gold)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            Vuelto VES
                          </button>
                          <button
                            onClick={() => setChangeCurrency('USD')}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: changeCurrency === 'USD' ? 'var(--bg-card)' : 'transparent',
                              color: changeCurrency === 'USD' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '10px',
                              cursor: 'pointer'
                            }}
                          >
                            Vuelto USD
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>

            {/* Footer Buttons */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.01)'
            }}>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '10px 0', fontSize: '12px', justifyContent: 'center' }}
              >
                CANCELAR
              </button>
              <button
                onClick={confirmCheckout}
                disabled={remainingUSD > 0}
                className="btn-yellow"
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontSize: '12px',
                  justifyContent: 'center',
                  opacity: remainingUSD > 0 ? 0.5 : 1,
                  cursor: remainingUSD > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <span>PROCESAR FACTURA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TICKET IMPRESO FACTURA FISCAL EN MONEDA DUAL (NUEVO REEMPLAZO DE ALERT COBRO) */}
      {ticketReceipt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1600,
          padding: '20px'
        }}>
          
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '430px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', color: '#22c55e', backgroundColor: 'var(--bg-input)' }}>
              <CheckCircle size={20} />
              <strong style={{ fontSize: '14.5px' }}>¡Cobro Procesado Exitosamente!</strong>
            </div>

            {/* Recibo de Factura Física Venezuela */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{
                backgroundColor: 'white',
                color: '#1a1a1a',
                fontFamily: 'Courier New, Courier, monospace',
                padding: '20px 16px',
                borderRadius: '12px',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
                fontSize: '11.5px',
                lineHeight: '1.4'
              }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{settings.businessName.toUpperCase()}</div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>RIF: {settings.businessRIF}</div>
                <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '10px' }}>{settings.businessAddress.toUpperCase()}</div>
                <div style={{ textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>=== FACTURA DE VENTA FISCAL ===</div>
                
                <div>Ticket: {ticketReceipt.ticketNumber}</div>
                <div>Fecha: {ticketReceipt.date}</div>
                <div>Cajero: {ticketReceipt.cashierName}</div>
                <div>Pago: {ticketReceipt.paymentMethod}</div>
                {ticketReceipt.paymentBreakdown && (
                  <div style={{ fontSize: '9.5px', color: '#555', marginTop: '4px', borderLeft: '2px solid var(--border-color)', paddingLeft: '6px' }}>
                    {ticketReceipt.paymentBreakdown.usd > 0 && <div>Recibido USD: ${ticketReceipt.paymentBreakdown.usd.toFixed(2)}</div>}
                    {ticketReceipt.paymentBreakdown.ves > 0 && <div>Recibido VES: Bs. {ticketReceipt.paymentBreakdown.ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>}
                    {ticketReceipt.paymentBreakdown.eur > 0 && <div>Recibido EUR: €{ticketReceipt.paymentBreakdown.eur.toFixed(2)}</div>}
                    {ticketReceipt.paymentBreakdown.change > 0 && (
                      <div>
                        Vuelto ({ticketReceipt.paymentBreakdown.changeCurrency}): {ticketReceipt.paymentBreakdown.changeCurrency === 'USD' 
                          ? `$${ticketReceipt.paymentBreakdown.change.toFixed(2)}` 
                          : `Bs. ${ticketReceipt.paymentBreakdown.change.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                
                {ticketReceipt.items.map((item: any, i: number) => {
                  const itemCostVES = item.price * ticketReceipt.dolarRate;
                  const itemSubtotalVES = item.subtotal * ticketReceipt.dolarRate;
                  return (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.quantity}x {item.name.substring(0, 16)}</span>
                        <span>${item.subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#555' }}>
                        <span>A tasa Bs.{ticketReceipt.dolarRate.toFixed(2)} c/u: Bs.{itemCostVES.toFixed(1)}</span>
                        <span>Bs.{itemSubtotalVES.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
                
                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal USD:</span>
                  <span>${ticketReceipt.subtotalUSD.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>IVA RIF (16%):</span>
                  <span>${ticketReceipt.ivaUSD.toFixed(2)}</span>
                </div>
                {ticketReceipt.igtfUSD > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand-gold)' }}>
                    <span>Recargo IGTF (3%):</span>
                    <span>${ticketReceipt.igtfUSD.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginTop: '4px' }}>
                  <span>TOTAL USD:</span>
                  <span>${ticketReceipt.totalUSD.toFixed(2)}</span>
                </div>

                <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>
                
                {/* Visual VES equivalences */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>
                  <span>TOTAL BS. BCV:</span>
                  <span>Bs. {(ticketReceipt.totalUSD * ticketReceipt.dolarRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#555', textAlign: 'right', marginTop: '2px' }}>
                  (Ref. Tasa Oficial: Bs. {ticketReceipt.dolarRate.toFixed(2)})
                </div>

                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '8px', fontWeight: 'bold' }}>¡GRACIAS POR SU COMPRA!</div>
              </div>

            </div>

            {/* Actions */}
            <div style={{ padding: '16px 20px', borderTop: '1.5px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => window.print()}
                className="btn-pill-dark"
                style={{ flex: 1, gap: '6px', justifyContent: 'center', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
              >
                <Printer size={15} />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => setTicketReceipt(null)}
                className="btn-yellow"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 'var(--button-radius)' }}
              >
                <span>Nueva Venta</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* MODAL: ESCÁNER DE CÓDIGO DE BARRAS POR CÁMARA WEBRTC Y SIMULADOR */}
      {showCameraScanner && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1600,
          padding: '20px'
        }}>
          <style>{`
            @keyframes scannerLaserEffect {
              0% { top: 5%; }
              50% { top: 90%; }
              100% { top: 5%; }
            }
          `}</style>
          
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 240px',
            maxHeight: '90vh'
          }}>
            
            {/* PANEL DE CÁMARA / VISOR */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: isMobile ? 'none' : '1.5px solid var(--border-color)' }}>
              
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={18} style={{ color: 'var(--brand-primary)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Visor del Escáner WebRTC</span>
                </div>
                {isMobile && (
                  <button 
                    onClick={() => setShowCameraScanner(false)}
                    style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Visor Video Feed */}
              <div style={{ 
                flex: 1, 
                backgroundColor: '#000', 
                position: 'relative', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                minHeight: '260px',
                overflow: 'hidden'
              }}>
                <video 
                  id="barcode-scanner-video"
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '260px' }}
                />

                {/* Laser de escaneo */}
                <div 
                  className="scanner-laser"
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    height: '3px',
                    backgroundColor: '#22c55e',
                    boxShadow: '0 0 10px #22c55e, 0 0 18px #22c55e',
                    zIndex: 10,
                    animation: 'scannerLaserEffect 2.8s infinite ease-in-out'
                  }}
                />

                {/* Retícula del escáner */}
                <div style={{
                  position: 'absolute',
                  width: '200px',
                  height: '140px',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '16px',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                  zIndex: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{ color: '#fff', fontSize: '9px', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '50px', letterSpacing: '0.5px' }}>
                    CENTRAR CÓDIGO
                  </div>
                </div>
              </div>

              {/* Controles del Input Manual en Visor */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-input)' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Entrada Manual de Código
                </span>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleBarcodeScanned(manualScanCode); }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input 
                    type="text" 
                    placeholder="Escriba código (Ej: 1001) y Enter..." 
                    className="search-input"
                    value={manualScanCode}
                    onChange={(e) => setManualScanCode(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border-color)' }}
                  />
                  <button type="submit" className="btn-yellow" style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 800, borderRadius: '8px' }}>
                    Ingresar
                  </button>
                </form>
              </div>

            </div>

            {/* PANEL LATERAL DE SIMULACIÓN (HIGH FIDELITY DEVELOPER TOOL) */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-gold)' }}>Simulador de Escáner</span>
                {!isMobile && (
                  <button 
                    onClick={() => setShowCameraScanner(false)}
                    style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Lista de productos para escaneo simulado */}
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? '160px' : '360px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: '1.3' }}>
                  Haga clic en un producto para simular que la cámara ha enfocado y descodificado su código de barras:
                </span>

                {products.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => handleBarcodeScanned(prod.code)}
                    className="btn-pill-dark table-row-hover"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 800,
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                      {prod.name}
                    </span>
                    <span style={{ fontFamily: 'monospace', color: 'var(--brand-primary)', fontSize: '10px', flexShrink: 0 }}>
                      [{prod.code}]
                    </span>
                  </button>
                ))}
              </div>

              {/* Botón de cerrar para mobiles */}
              <div style={{ padding: '14px 16px', borderTop: '1.5px solid var(--border-color)', display: 'flex', backgroundColor: 'var(--bg-input)' }}>
                <button
                  onClick={() => setShowCameraScanner(false)}
                  className="btn-pill-dark"
                  style={{ width: '100%', padding: '10px 0', borderRadius: '8px', justifyContent: 'center', backgroundColor: 'var(--bg-card)' }}
                >
                  Cerrar Escáner
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
    </div>
  );
}
