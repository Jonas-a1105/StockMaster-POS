import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ShoppingCart, Clock, User, UserCheck, ChevronDown, Search, X, Lock } from 'lucide-react';
import { getDatabase, type ProductDocType, type ClientDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { logAuditEvent } from '../utils/audit';
import { useToast } from './ToastNotification';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';

import { ProductGrid } from './ProductGrid';
import { CartPanel } from './CartPanel';
import { CheckoutModal } from './CheckoutModal';
import { TicketPreviewModal } from './TicketPreviewModal';
import { ScannerModal } from './ScannerModal';

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
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CRÉDITO'>('EFECTIVO');
  const [ticketReceipt, setTicketReceipt] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Discount and Surcharge states
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FIXED'>('NONE');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [surchargeType, setSurchargeType] = useState<'NONE' | 'PERCENT' | 'FIXED'>('NONE');
  const [surchargeValue, setSurchargeValue] = useState<number>(0);

  // Product Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [stockFilter, setStockFilter] = useState<'todos' | 'disponible' | 'agotado'>('todos');

  // Customer Selection states
  const [clients, setClients] = useState<ClientDocType[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientDocType | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const clientSearchRef = useRef<HTMLInputElement>(null);

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

  // Focus client search input when selector opens
  const getProductPrice = useCallback((product: ProductDocType) => {
    if (selectedClient && selectedClient.clientType === 'Mayorista') {
      return product.wholesalePrice || product.price;
    }
    return product.price;
  }, [selectedClient]);

  useEffect(() => {
    if (showClientSelector) {
      setTimeout(() => clientSearchRef.current?.focus(), 80);
    } else {
      setClientSearchTerm('');
    }
  }, [showClientSelector]);

  // Restore payment method to EFECTIVO if selectedClient is removed and method is CRÉDITO
  useEffect(() => {
    if (!selectedClient && paymentMethod === 'CRÉDITO') {
      setPaymentMethod('EFECTIVO');
    }
  }, [selectedClient, paymentMethod]);

  // Derive unique product categories
  const categories = useMemo(() => {
    return ['TODOS', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()];
  }, [products]);

  // Filtered clients for the selector dropdown
  const filteredClientsList = useMemo(() => {
    return clients.filter(c =>
      c.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      (c.phone || '').includes(clientSearchTerm)
    );
  }, [clients, clientSearchTerm]);

  const activeSearch = searchTerm || localSearchTerm;

  // Filtrar productos (búsqueda + categoría + stock)
  const filteredProducts = useMemo(() => {
    return products.filter(prod => {
      const matchSearch =
        prod.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
        prod.code.includes(activeSearch) ||
        prod.category.toLowerCase().includes(activeSearch.toLowerCase());
      const matchCategory = categoryFilter === 'TODOS' || prod.category === categoryFilter;
      const matchStock =
        stockFilter === 'todos' ||
        (stockFilter === 'disponible' && prod.stock > 0) ||
        (stockFilter === 'agotado' && prod.stock === 0);
      return matchSearch && matchCategory && matchStock;
    });
  }, [products, activeSearch, categoryFilter, stockFilter]);

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

  const handleBarcodeScanned = useCallback((code: string) => {
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
  }, [products, addToast]);

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
  const handleSuspendSale = useCallback(() => {
    if (cart.length === 0) return;
    const suspended: SuspendedSale = {
      id: `SUS-${Date.now().toString().slice(-6)}`,
      cart: [...cart],
      timestamp: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
      label: `${cart.length} items — ${formatUSD(cart.reduce((s, i) => s + getProductPrice(i.product) * i.quantity, 0))}`
    };
    setSuspendedSales(prev => [...prev, suspended]);
    setCart([]);
    setShowMobileCart(false);
    addToast({ type: 'info', title: 'Venta suspendida', message: `Ticket ${suspended.id} guardado. ${cart.length} producto(s) en espera.` });
  }, [cart, formatUSD, addToast, getProductPrice]);

  // Resume a suspended sale
  const handleResumeSale = useCallback((saleId: string) => {
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
  }, [suspendedSales, cart, handleSuspendSale, addToast]);

  // Delete a suspended sale
  const handleDeleteSuspended = useCallback((saleId: string) => {
    setSuspendedSales(prev => prev.filter(s => s.id !== saleId));
    addToast({ type: 'warning', title: 'Venta descartada', message: `Ticket ${saleId} eliminado.` });
  }, [addToast]);

  // Carga los productos desde IndexedDB
  const loadProducts = async () => {
    try {
      const db = await getDatabase();
      const allProds = await db.products.find().exec();
      setProducts(allProds.map(doc => doc.toJSON()));
    } catch (err) {
      console.error('Error al cargar productos:', err);
      addToast({ type: 'error', title: 'Error de base de datos', message: 'No se pudieron cargar los productos.' });
    }
  };

  // Carga los clientes desde IndexedDB
  const loadClients = async () => {
    try {
      const db = await getDatabase();
      const allClients = await db.clients.find().exec();
      setClients(allClients.map(doc => doc.toJSON()));
    } catch (err) {
      console.error('Error al cargar clientes:', err);
      addToast({ type: 'error', title: 'Error de base de datos', message: 'No se pudieron cargar los clientes.' });
    }
  };

  // Efecto inicial y de red reactivo
  useEffect(() => {
    loadProducts();
    loadClients();

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const addToCart = useCallback((product: ProductDocType) => {
    setErrorMessage(null);
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(item => item.product.id === product.id);
      if (existingIndex > -1) {
        if (prevCart[existingIndex].quantity >= product.stock) {
          setErrorMessage(`No puedes exceder el stock disponible (${product.stock} unidades).`);
          return prevCart;
        }
        const newCart = [...prevCart];
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          quantity: newCart[existingIndex].quantity + 1
        };
        return newCart;
      } else {
        return [...prevCart, { product, quantity: 1 }];
      }
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setErrorMessage(null);
    setCart((prevCart) => {
      return prevCart.map(item => {
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
    });
  }, []);

  const setQuantity = useCallback((productId: string, qty: number) => {
    setErrorMessage(null);
    setCart((prevCart) => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          if (qty <= 0) return null;
          if (qty > item.product.stock) {
            setErrorMessage(`No puedes exceder el stock disponible (${item.product.stock} unidades).`);
            return item;
          }
          return { ...item, quantity: qty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter(item => item.product.id !== productId));
  }, []);

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

      // Scanner and keys integration
      if (e.key === 'F8') {
        e.preventDefault();
        setShowCameraScanner(v => !v);
        return;
      }

      // Keyboard modifications: decrease quantity with minus
      if (cart.length > 0) {
        const lastItem = cart[cart.length - 1];
        if (e.key === '+') {
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
  }, [showCheckoutModal, showSuspendedPanel, ticketReceipt, cart, filteredProducts, updateQuantity]);

  // Totales en dólares
  const subtotalUSD = useMemo(() => cart.reduce((acc, item) => acc + (getProductPrice(item.product) * item.quantity), 0), [cart, getProductPrice]);

  // Descuento
  const discountUSD = useMemo(() => {
    if (discountType === 'PERCENT') {
      return subtotalUSD * (discountValue / 100);
    } else if (discountType === 'FIXED') {
      return Math.min(subtotalUSD, discountValue);
    }
    return 0;
  }, [subtotalUSD, discountType, discountValue]);

  // Recargo
  const surchargeUSD = useMemo(() => {
    if (surchargeType === 'PERCENT') {
      return subtotalUSD * (surchargeValue / 100);
    } else if (surchargeType === 'FIXED') {
      return surchargeValue;
    }
    return 0;
  }, [subtotalUSD, surchargeType, surchargeValue]);

  // Subtotal Neto
  const netSubtotalUSD = useMemo(() => {
    return Math.max(0, subtotalUSD - discountUSD + surchargeUSD);
  }, [subtotalUSD, discountUSD, surchargeUSD]);

  const ivaUSD = useMemo(() => netSubtotalUSD * (settings.ivaRate / 100), [netSubtotalUSD, settings.ivaRate]);
  const totalUSD = useMemo(() => netSubtotalUSD + ivaUSD, [netSubtotalUSD, ivaUSD]);

  // Totales en Bolívares
  const totalVES = useMemo(() => convertToVES(totalUSD), [convertToVES, totalUSD]);

  // Received amounts parsed as numbers
  const usdReceived = useMemo(() => parseFloat(usdPaid) || 0, [usdPaid]);
  const vesReceived = useMemo(() => parseFloat(vesPaid) || 0, [vesPaid]);
  const eurReceived = useMemo(() => parseFloat(eurPaid) || 0, [eurPaid]);

  // EUR to USD conversion (approx 1.085)
  const eurReceivedInUSD = useMemo(() => eurReceived * 1.085, [eurReceived]);

  // VES to USD conversion
  const vesReceivedInUSD = useMemo(() => vesReceived / dolarRate, [vesReceived, dolarRate]);

  // Total received in USD (all payment sources converted)
  const totalReceivedUSD = useMemo(() => usdReceived + vesReceivedInUSD + eurReceivedInUSD, [usdReceived, vesReceivedInUSD, eurReceivedInUSD]);

  // Calculate IGTF (3% on USD and EUR cash payments) - ignored for credit sales
  const igtfUSD = useMemo(() => {
    if (paymentMethod === 'CRÉDITO') return 0;
    return igtfApplied ? (usdReceived + eurReceivedInUSD) * 0.03 : 0;
  }, [paymentMethod, igtfApplied, usdReceived, eurReceivedInUSD]);

  // Adjust total due including IGTF
  const totalDueUSD = useMemo(() => totalUSD + igtfUSD, [totalUSD, igtfUSD]);

  // Remaining balance
  const remainingUSD = useMemo(() => Math.max(0, totalDueUSD - totalReceivedUSD), [totalDueUSD, totalReceivedUSD]);

  // Change (Vuelto) if they overpay
  const changeUSD = useMemo(() => Math.max(0, totalReceivedUSD - totalDueUSD), [totalReceivedUSD, totalDueUSD]);
  const changeVES = useMemo(() => changeUSD * dolarRate, [changeUSD, dolarRate]);

  const confirmCheckout = async () => {
    setErrorMessage(null);
    try {
      const db = await getDatabase();
      const saleId = crypto.randomUUID();
      const ticketNumber = `TK-${Date.now().toString().slice(-6)}`;

      // Validar límite de crédito antes de proceder si es una venta a crédito
      if (paymentMethod === 'CRÉDITO') {
        if (!selectedClient) {
          throw new Error('Debe seleccionar un cliente para realizar una venta a crédito.');
        }
        const clientDoc = await db.clients.findOne({ selector: { id: selectedClient.id } }).exec();
        if (!clientDoc) {
          throw new Error('El cliente seleccionado no existe en el sistema.');
        }
        const currentBalance = clientDoc.get('creditBalance') || 0;
        const limit = clientDoc.get('creditLimit') || 0;
        const projectedBalance = Number((currentBalance + totalDueUSD).toFixed(2));
        if (limit <= 0 || projectedBalance > limit) {
          throw new Error(`Crédito denegado: no tiene línea de crédito autorizada o el monto supera el límite permitido ($${limit.toFixed(2)}).`);
        }
      }

      // Validar stock antes de escribir
      for (const item of cart) {
        const doc = await db.products.findOne({ selector: { id: item.product.id } }).exec();
        if (!doc || doc.get('stock') < item.quantity) {
          throw new Error(`Stock insuficiente para "${item.product.name}" durante el cobro.`);
        }
      }

      // Restar stock localmente en IndexedDB usando una estrategia FIFO para los lotes
      for (const item of cart) {
        const doc = await db.products.findOne({ selector: { id: item.product.id } }).exec();
        if (doc) {
          const currentVersion = doc.get('version') || 1;
          
          let batches: any[] = [];
          try {
            if (doc.get('batches')) {
              batches = JSON.parse(doc.get('batches'));
            }
          } catch (e) {
            console.error('Error al deserializar lotes:', e);
          }

          if (!Array.isArray(batches) || batches.length === 0) {
            batches = [
              {
                loteCode: 'LOTE-INICIAL',
                expiryDate: doc.get('expiryDate') || 'N/A',
                stock: doc.get('stock')
              }
            ];
          }

          // Ordenar por fecha de vencimiento: las más antiguas/próximas primero; 'N/A' al final
          batches.sort((a, b) => {
            const dateA = a.expiryDate && a.expiryDate !== 'N/A' ? a.expiryDate : '9999-12-31';
            const dateB = b.expiryDate && b.expiryDate !== 'N/A' ? b.expiryDate : '9999-12-31';
            return dateA.localeCompare(dateB);
          });

          // Restar existencias en lotes
          let qtyToDeduct = item.quantity;
          for (const batch of batches) {
            if (qtyToDeduct <= 0) break;
            if (batch.stock > 0) {
              if (batch.stock >= qtyToDeduct) {
                batch.stock = Number((batch.stock - qtyToDeduct).toFixed(3));
                qtyToDeduct = 0;
              } else {
                qtyToDeduct = Number((qtyToDeduct - batch.stock).toFixed(3));
                batch.stock = 0;
              }
            }
          }

          // Fallback de seguridad por si queda remanente
          if (qtyToDeduct > 0 && batches.length > 0) {
            batches[batches.length - 1].stock = Number((batches[batches.length - 1].stock - qtyToDeduct).toFixed(3));
          }

          // Filtrar lotes sin existencias a menos que sea el único
          const finalBatches = batches.filter((b, idx) => b.stock > 0 || idx === batches.length - 1);
          const newStockVal = finalBatches.reduce((acc, b) => acc + (b.stock || 0), 0);

          await doc.patch({
            stock: Number(newStockVal.toFixed(3)),
            batches: JSON.stringify(finalBatches),
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Determinar método de pago final
      let finalPaymentMethod: string = paymentMethod;
      if (paymentMethod !== 'CRÉDITO') {
        const paymentSources = [];
        if (usdReceived > 0) paymentSources.push('EFECTIVO USD');
        if (vesReceived > 0) paymentSources.push('VES');
        if (eurReceived > 0) paymentSources.push('EFECTIVO EUR');
        
        if (paymentSources.length > 1) {
          finalPaymentMethod = 'MIXTO';
        } else if (paymentSources.length === 1) {
          finalPaymentMethod = paymentSources[0] === 'VES' ? paymentMethod : 'EFECTIVO';
        }
      }

      // Registrar la Venta en IndexedDB
      const newSale = {
        id: saleId,
        ticketNumber,
        cashierId: user.id,
        clientId: selectedClient ? selectedClient.id : 'Cliente General',
        total: Number(totalDueUSD.toFixed(2)),
        paymentMethod: finalPaymentMethod,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          price: getProductPrice(item.product)
        })),
        pendingSync: true,
        dolarRate: Number(dolarRate),
        usdReceived: usdReceived,
        vesReceived: vesReceived,
        eurReceived: eurReceived,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.sales.insert(newSale);

      // Si el método de pago original es crédito, acumular en el balance del cliente
      if (paymentMethod === 'CRÉDITO' && selectedClient) {
        const clientDoc = await db.clients.findOne({ selector: { id: selectedClient.id } }).exec();
        if (clientDoc) {
          const currentBalance = clientDoc.get('creditBalance') || 0;
          await clientDoc.patch({
            creditBalance: Number((currentBalance + totalDueUSD).toFixed(2)),
            updatedAt: new Date().toISOString()
          });
        }
      }

      logAuditEvent(user, 'VENTA_POS_COBRO', {
        total: Number(totalDueUSD.toFixed(2)),
        paymentMethod: finalPaymentMethod
      });

      // Generar el Ticket para vista de impresión con moneda dual
      setTicketReceipt({
        ticketNumber,
        cashierName: user.name,
        clientName: selectedClient ? selectedClient.name : 'Cliente General',
        clientId: selectedClient ? selectedClient.id : null,
        paymentMethod: finalPaymentMethod,
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: getProductPrice(item.product),
          subtotal: getProductPrice(item.product) * item.quantity
        })),
        subtotalUSD: Number(subtotalUSD.toFixed(2)),
        discountUSD: Number(discountUSD.toFixed(2)),
        surchargeUSD: Number(surchargeUSD.toFixed(2)),
        netSubtotalUSD: Number(netSubtotalUSD.toFixed(2)),
        ivaUSD: Number(ivaUSD.toFixed(2)),
        ivaRate: settings.ivaRate,
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

      // Limpia el carrito, resetea cliente y cierra el drawer móvil
      setCart([]);
      setSelectedClient(null);
      setDiscountType('NONE');
      setDiscountValue(0);
      setSurchargeType('NONE');
      setSurchargeValue(0);
      setShowMobileCart(false);
      setShowCheckoutModal(false);
      
      // Lanza sincronización silenciosa
      syncWorker.sync();

      // Toast de éxito
      addToast({ type: 'success', title: '¡Venta registrada!', message: `Ticket ${ticketNumber} procesado por ${formatUSD(totalDueUSD)}.` });

    } catch (err) {
      const error = err as Error;
      setErrorMessage(error.message || 'Error durante el checkout.');
      setShowCheckoutModal(false);
      addToast({ type: 'error', title: 'Error en el cobro', message: error.message || 'No se pudo procesar la venta.' });
    }
  };

  const cartItemsCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', width: '100%', paddingBottom: '30px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: '28px', width: '100%' }}>
        {/* PANEL IZQUIERDO: CATÁLOGO DE PRODUCTOS */}
        <ProductGrid
          products={products}
          filteredProducts={filteredProducts}
          categories={categories}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          stockFilter={stockFilter}
          setStockFilter={setStockFilter}
          localSearchTerm={localSearchTerm}
          setLocalSearchTerm={setLocalSearchTerm}
          searchTerm={searchTerm}
          errorMessage={errorMessage}
          onAddToCart={addToCart}
          onOpenScanner={() => setShowCameraScanner(true)}
        />

        {/* PANEL DERECHO: CARRITO DE COMPRAS (SÓLO VISIBLE EN ESCRITORIO) */}
        {!isMobile && (
          <div className="widget" style={{
            borderRadius: 'var(--card-radius)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: 'fit-content',
            maxHeight: '750px',
            position: 'sticky',
            top: '24px'
          }}>
            <div className="widget-header" style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 className="widget-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} style={{ color: 'var(--brand-primary)' }} />
                <span>Carrito POS ({cartItemsCount})</span>
              </h3>
            </div>

            {/* SELECTOR DE CLIENTE */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                Cliente
              </label>
              <button
                onClick={() => setShowClientSelector(v => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: selectedClient ? '1.5px solid var(--brand-teal)' : '1.5px solid var(--border-color)',
                  backgroundColor: selectedClient ? 'rgba(14,165,164,0.06)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left'
                }}
              >
                {selectedClient ? (
                  <UserCheck size={15} style={{ color: 'var(--brand-teal)', flexShrink: 0 }} />
                ) : (
                  <User size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: selectedClient ? 'var(--brand-teal)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedClient ? selectedClient.name : 'Cliente General'}
                  </div>
                  {selectedClient && (
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '1px' }}>
                      {selectedClient.id}
                    </div>
                  )}
                </div>
                <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: showClientSelector ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown panel */}
              {showClientSelector && (
                <div
                  className="animate-entrance premium-popup"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 500,
                    marginTop: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '6px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
                    <div className="search-container" style={{ height: '32px' }}>
                      <Search className="search-icon" size={13} />
                      <input
                        ref={clientSearchRef}
                        type="text"
                        placeholder="Buscar cliente..."
                        className="search-input"
                        value={clientSearchTerm}
                        onChange={e => setClientSearchTerm(e.target.value)}
                        style={{ fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => { setSelectedClient(null); setShowClientSelector(false); }}
                      className={`custom-select-option ${!selectedClient ? 'selected' : ''}`}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <User size={13} style={{ color: !selectedClient ? 'inherit' : 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>Cliente General</span>
                    </button>

                    {filteredClientsList.length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>No se encontraron clientes</div>
                    ) : (
                      filteredClientsList.map(client => {
                        const isSelected = selectedClient?.id === client.id;
                        return (
                          <button
                            key={client.id}
                            onClick={() => { setSelectedClient(client); setShowClientSelector(false); }}
                            className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <UserCheck size={13} style={{ color: isSelected ? 'inherit' : 'var(--brand-teal)', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {client.name}
                              </div>
                              <div style={{ fontSize: '9.5px', color: isSelected ? 'rgba(18, 18, 20, 0.7)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {client.id}{client.phone ? ` · ${client.phone}` : ''}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <CartPanel
              cart={cart}
              cartItemsCount={cartItemsCount}
              subtotalUSD={subtotalUSD}
              ivaUSD={ivaUSD}
              totalUSD={totalUSD}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              selectedClient={selectedClient}
              onUpdateQuantity={updateQuantity}
              onSetQuantity={setQuantity}
              onRemoveFromCart={removeFromCart}
              onClearCart={() => setCart([])}
              onOpenCheckout={() => {
                if (cart.length > 0) {
                  setUsdPaid(String(totalUSD));
                  setVesPaid('0');
                  setEurPaid('0');
                  setShowCheckoutModal(true);
                }
              }}
              onSuspendSale={handleSuspendSale}
              onShowClientSelector={() => setShowClientSelector(true)}
              suspendedSalesCount={suspendedSales.length}
              onToggleSuspendedPanel={() => setShowSuspendedPanel(v => !v)}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountValue={discountValue}
              setDiscountValue={setDiscountValue}
              surchargeType={surchargeType}
              setSurchargeType={setSurchargeType}
              surchargeValue={surchargeValue}
              setSurchargeValue={setSurchargeValue}
              discountUSD={discountUSD}
              surchargeUSD={surchargeUSD}
              netSubtotalUSD={netSubtotalUSD}
            />
          </div>
        )}
      </div>

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
              <CartPanel
                cart={cart}
                cartItemsCount={cartItemsCount}
                subtotalUSD={subtotalUSD}
                ivaUSD={ivaUSD}
                totalUSD={totalUSD}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                selectedClient={selectedClient}
                onUpdateQuantity={updateQuantity}
                onSetQuantity={setQuantity}
                onRemoveFromCart={removeFromCart}
                onClearCart={() => setCart([])}
                onOpenCheckout={() => {
                  if (cart.length > 0) {
                    setUsdPaid(String(totalUSD));
                    setVesPaid('0');
                    setEurPaid('0');
                    setShowCheckoutModal(true);
                  }
                }}
                onSuspendSale={handleSuspendSale}
                onShowClientSelector={() => setShowClientSelector(true)}
                suspendedSalesCount={suspendedSales.length}
                onToggleSuspendedPanel={() => setShowSuspendedPanel(v => !v)}
                discountType={discountType}
                setDiscountType={setDiscountType}
                discountValue={discountValue}
                setDiscountValue={setDiscountValue}
                surchargeType={surchargeType}
                setSurchargeType={setSurchargeType}
                surchargeValue={surchargeValue}
                setSurchargeValue={setSurchargeValue}
                discountUSD={discountUSD}
                surchargeUSD={surchargeUSD}
                netSubtotalUSD={netSubtotalUSD}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANEL DE VENTAS SUSPENDIDAS */}
      {showSuspendedPanel && suspendedSales.length > 0 && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          zIndex: 1450,
          padding: isMobile ? 0 : '20px'
        }} onClick={() => setShowSuspendedPanel(false)}>
          <div
            className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`}
            style={{
              width: '100%',
              maxWidth: isMobile ? '100%' : '400px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: isMobile ? 0 : 'var(--card-radius)',
              border: isMobile ? 'none' : '1.5px solid var(--border-color)',
              boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '100dvh' : 'auto',
              maxHeight: isMobile ? '100dvh' : '80vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              padding: '20px 24px',
              borderBottom: '1.5px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--brand-gold)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Ventas en Espera
                </h4>
              </div>
              <button
                onClick={() => setShowSuspendedPanel(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', paddingBottom: isMobile ? '80px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
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
                      <span>Recuperar</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSuspended(sale.id)}
                      className="btn-pill-dark"
                      style={{ padding: '6px 12px', fontSize: '10px', borderRadius: '8px', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COBRO MODAL */}
      <CheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        totalUSD={totalUSD}
        subtotalUSD={netSubtotalUSD}
        ivaUSD={ivaUSD}
        igtfApplied={igtfApplied}
        setIgtfApplied={setIgtfApplied}
        igtfUSD={igtfUSD}
        totalDueUSD={totalDueUSD}
        remainingUSD={remainingUSD}
        changeUSD={changeUSD}
        changeVES={changeVES}
        usdPaid={usdPaid}
        setUsdPaid={setUsdPaid}
        vesPaid={vesPaid}
        setVesPaid={setVesPaid}
        eurPaid={eurPaid}
        setEurPaid={setEurPaid}
        changeCurrency={changeCurrency}
        setChangeCurrency={setChangeCurrency}
        onConfirmCheckout={confirmCheckout}
        dolarRate={dolarRate}
        isMobile={isMobile}
        selectedClient={selectedClient}
        paymentMethod={paymentMethod}
      />

      {/* TICKET IMPRESO PREVIEW MODAL */}
      <TicketPreviewModal
        ticketReceipt={ticketReceipt}
        onClose={() => setTicketReceipt(null)}
        isMobile={isMobile}
      />

      {/* BARCODE CAMERA SCANNER MODAL */}
      <ScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        isMobile={isMobile}
        manualScanCode={manualScanCode}
        setManualScanCode={setManualScanCode}
        onBarcodeScanned={handleBarcodeScanned}
        products={products}
      />
    </div>
  );
}
