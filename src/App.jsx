import React, { useState, useEffect, useRef } from 'react';
import { LEGAL_TERMS_VERSION } from '../legal-config.js';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Mic, 
  Printer, 
  Eye, 
  Send, 
  Users, 
  Package, 
  Settings, 
  X, 
  Search, 
  Phone, 
  MapPin, 
  PenTool, 
  Upload, 
  Image as ImageIcon, 
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Camera,
  Copy,
  ArrowRightLeft,
  Check,
  ShieldCheck,
  Lock,
  Calculator,
  ExternalLink, 
  CreditCard,
  Award,
  Zap,
  WifiOff,
  Wifi,
  ArrowLeft
} from 'lucide-react';
import { CATALOG_CATEGORIES, catalogItemsToQuoteLines, suggestCatalogCategory } from './catalog-import.js';

// 1. AÑADIDO: Definición de los modelos de IA disponibles
const AI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Rápido)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Preciso)' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
];

async function readApiResponse(response, fallbackMessage) {
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`${fallbackMessage} El servidor respondió con un formato inesperado (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    const diagnostic = data.diagnostic;
    const diagnosticDetails = diagnostic
      ? [
        `HTTP ${diagnostic.status}`,
        diagnostic.errorCode,
        diagnostic.providerMessage,
        ...(Array.isArray(diagnostic.causes)
          ? diagnostic.causes.map((cause) => [cause.code, cause.description].filter(Boolean).join(': '))
          : [])
      ].filter(Boolean).join(' | ')
      : '';
    const message = data.error || `${fallbackMessage} (HTTP ${response.status}).`;
    throw new Error(diagnosticDetails ? `${message} Diagnóstico de Mercado Pago: ${diagnosticDetails}` : message);
  }

  if (!responseText) {
    throw new Error(`${fallbackMessage} El servidor devolvió una respuesta vacía.`);
  }

  return data;
}

function normalizePendingOfflineQuotes(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [{ id: entry, userId: null }];
    if (entry && typeof entry.id === 'string') {
      return [{ id: entry.id, userId: typeof entry.userId === 'string' ? entry.userId : null }];
    }
    return [];
  });
}

function readMigratedLocalStorage(key, previousKey) {
  let value = localStorage.getItem(key);
  if (value === null) {
    value = localStorage.getItem(previousKey);
    if (value !== null) localStorage.setItem(key, value);
  }
  if (value !== null) localStorage.removeItem(previousKey);
  return value;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('quotes'); 
  const [viewMode, setViewMode] = useState('list'); 
  const [statusFilter, setStatusFilter] = useState('todos');

  // 2. AÑADIDO: Estado para almacenar qué modelo de IA se encuentra seleccionado
  const [selectedAiModel, setSelectedAiModel] = useState(AI_MODELS[0].id);

  // Estado del Sistema de Licencias Funcional
  const [userPlan, setUserPlan] = useState('gratis');
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedPlanToBuy, setSelectedPlanToBuy] = useState(null);
  const [account, setAccount] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingOfflineQuotes, setPendingOfflineQuotes] = useState([]);
  const [isSyncingOfflineQuotes, setIsSyncingOfflineQuotes] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);

  // Estado de Empresa (Emisor)
  const [company, setCompany] = useState({
    name: '', tagline: '', phone: '', email: '', rfc: '', address: '', bank: '', clabe: '', bankHolder: '', logo: '', defaultTerms: ''
  });

  const [showClientModal, setShowClientModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState('client');

  const canvasRef = useRef(null);
  const catalogFileInputRef = useRef(null);
  const quoteFileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const isSyncingOfflineQuotesRef = useRef(false);

  const [newClient, setNewClient] = useState({ name: '', contact: '', phone: '', email: '', rfc: '', location: '' });
  const [clientSearch, setClientSearch] = useState('');

  const [newCatalogItem, setNewCatalogItem] = useState({ concept: '', unit: 'Servicio', price: '', category: 'Otros' });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('Todas');
  const [catalogImportCandidates, setCatalogImportCandidates] = useState([]);
  const [catalogImportError, setCatalogImportError] = useState('');
  const [catalogImportProgress, setCatalogImportProgress] = useState('');
  const [isImportingCatalog, setIsImportingCatalog] = useState(false);
  const [quoteImportError, setQuoteImportError] = useState('');
  const [quoteImportProgress, setQuoteImportProgress] = useState('');
  const [isImportingQuote, setIsImportingQuote] = useState(false);

  const [clients, setClients] = useState([]);
  const [catalog, setCatalog] = useState([
    { id: 1, concept: 'Instalación de Minisplit 1.5 Ton Inverter', unit: 'Servicio', price: 3200, category: 'Climatización' },
    { id: 2, concept: 'Suministro y colocación de Muro de Tablaroca', unit: 'm²', price: 420, category: 'Construcción' },
    { id: 3, concept: 'Pintura vinílica acrílica a 2 manos', unit: 'm²', price: 140, category: 'Acabados' }
  ]);

  const [quotes, setQuotes] = useState([]);

  // Calculadora Privada de Margen
  const [showCalculator, setShowCalculator] = useState(false);
  const [costMaterials, setCostMaterials] = useState('');
  const [costLabor, setCostLabor] = useState('');

  // Cotización Activa
  const [activeQuote, setActiveQuote] = useState({
    id: 'COT-' + Math.floor(1000 + Math.random() * 9000),
    type: 'Cotización',
    status: 'Borrador',
    date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
    validityDays: '15',
    inflationClause: true,
    executionDays: '',
    clientName: '',
    clientContact: '',
    clientPhone: '',
    clientEmail: '',
    clientRfc: '',
    projectLocation: '',
    scope: '',
    exclusions: 'No incluye licencias municipales, retiro de escombro fuera de obra ni trabajos eléctricos no especificados.',
    warrantyInfo: '6 meses de garantía sobre defectos de instalación y mano de obra.',
    paymentMilestones: '50% Anticipo al autorizar, 30% Avance al 50% de obra, 20% Finiquito contra entrega.',
    items: [{ id: Date.now(), quantity: 1, unit: 'Servicio', description: '', unitPrice: '' }],
    photos: [],
    advancePercent: '50',
    discount: '0',
    includeIVA: true,
    signatureClient: '',
    signatureIssuer: ''
  });

  const [smartPromptText, setSmartPromptText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    try {
      const savedCompany = readMigratedLocalStorage('cotiq_company', 'pf_company');
      const savedClients = readMigratedLocalStorage('cotiq_clients', 'pf_clients');
      const savedCatalog = readMigratedLocalStorage('cotiq_catalog', 'pf_catalog');
      const savedQuotes = readMigratedLocalStorage('cotiq_quotes', 'pf_quotes');
      const savedPendingQuotes = readMigratedLocalStorage('cotiq_pending_quote_ids', 'pf_pending_quote_ids');

      if (savedCompany) setCompany(JSON.parse(savedCompany));
      if (savedClients) {
        const parsed = JSON.parse(savedClients);
        if (Array.isArray(parsed)) setClients(parsed);
      }
      if (savedCatalog) {
        const parsed = JSON.parse(savedCatalog);
        if (Array.isArray(parsed)) {
          const categorizedCatalog = parsed.map((item) => ({
            ...item,
            category: item?.category || suggestCatalogCategory(item?.concept || '')
          }));
          setCatalog(categorizedCatalog);
        }
      }
      if (savedQuotes) {
        const parsed = JSON.parse(savedQuotes);
        if (Array.isArray(parsed)) setQuotes(parsed);
      }
      if (savedPendingQuotes) {
        const parsed = JSON.parse(savedPendingQuotes);
        setPendingOfflineQuotes(normalizePendingOfflineQuotes(parsed));
      }
      readMigratedLocalStorage('cotiq_account_id', 'pf_account_id');
      localStorage.removeItem('pf_plan');
      localStorage.removeItem('pf_credits');
      localStorage.removeItem('cotiq_plan');
      localStorage.removeItem('cotiq_credits');
    } catch (e) {
      console.error("Error al cargar memoria:", e);
    }
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleCatalogFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCatalogImportError('');
    setCatalogImportProgress('Preparando la lectura del archivo…');
    setIsImportingCatalog(true);
    try {
      const { importCatalogFile } = await import('./catalog-file-reader.js');
      const items = await importCatalogFile(file, setCatalogImportProgress);
      const newCandidates = items.map((item, index) => ({
        ...item,
        draftId: `${Date.now()}-${index}`
      }));

      setCatalogImportCandidates((prevCandidates) => [
        ...(Array.isArray(prevCandidates) ? prevCandidates : []),
        ...newCandidates
      ]);
      notify(`Se reconocieron ${newCandidates.length} concepto(s) del archivo.`);
    } catch (error) {
      console.error('No se pudo importar el archivo al catálogo:', error);
      setCatalogImportError(error.message || 'No se pudo leer el archivo. Inténtalo de nuevo.');
    } finally {
      setIsImportingCatalog(false);
      setCatalogImportProgress('');
      event.target.value = '';
    }
  };

  const handleQuoteFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQuoteImportError('');
    setQuoteImportProgress('Preparando la lectura del archivo…');
    setIsImportingQuote(true);
    try {
      const { importCatalogFile } = await import('./catalog-file-reader.js');
      const items = await importCatalogFile(file, setQuoteImportProgress);
      const quoteLines = catalogItemsToQuoteLines(items)
        .map((item, index) => ({ ...item, id: Date.now() + index }));

      setActiveQuote((currentQuote) => {
        const existingItems = (currentQuote.items || []).filter(
          (item) => (item.description || '').trim() !== '' || Number(item.unitPrice || 0) > 0
        );
        return {
          ...currentQuote,
          items: existingItems.length > 0 ? [...existingItems, ...quoteLines] : quoteLines
        };
      });
      notify(`Se agregaron ${quoteLines.length} partidas. Revisa los conceptos y precios antes de guardar.`);
    } catch (error) {
      console.error('No se pudo importar el archivo a la cotización:', error);
      setQuoteImportError(error.message || 'No se pudo leer el archivo. Inténtalo de nuevo.');
    } finally {
      setIsImportingQuote(false);
      setQuoteImportProgress('');
      event.target.value = '';
    }
  };

  const saveCatalogImport = () => {
    const importedItems = catalogImportCandidates
      .filter((item) => item.concept.trim())
      .map((item, index) => ({
        id: Date.now() + index,
        concept: item.concept.trim(),
        unit: item.unit,
        price: item.price === '' || item.price === null ? null : Number(item.price),
        category: item.category
      }));
    if (importedItems.length === 0) return;

    const updated = [...importedItems, ...(catalog || [])];
    try {
      localStorage.setItem('cotiq_catalog', JSON.stringify(updated));
    } catch (error) {
      console.error('No se pudo guardar la importación del catálogo:', error);
      setCatalogImportError('No se pudieron guardar los conceptos en este dispositivo. Libera espacio e inténtalo de nuevo.');
      return;
    }
    setCatalog(updated);
    setCatalogImportCandidates([]);
    setCatalogImportError('');
    notify(`${importedItems.length} conceptos agregados al catálogo`);
  };

  const handleClearAllStorage = () => {
    if (window.confirm("¿Deseas restablecer todos los datos guardados para iniciar 100% desde cero?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const saveCompanyData = (newCompany) => {
    setCompany(newCompany);
    localStorage.setItem('cotiq_company', JSON.stringify(newCompany));
    notify('Perfil de empresa guardado');
  };

  const saveQuotesList = (newQuotes) => {
    setQuotes(newQuotes);
    localStorage.setItem('cotiq_quotes', JSON.stringify(newQuotes));
  };

  const savePendingOfflineQuotes = (pendingQuotes) => {
    setPendingOfflineQuotes(pendingQuotes);
    localStorage.setItem('cotiq_pending_quote_ids', JSON.stringify(pendingQuotes));
  };

  const openNewQuoteEditor = () => {
    setActiveQuote({
      id: 'COT-' + Math.floor(1000 + Math.random() * 9000),
      type: 'Cotización',
      status: 'Borrador',
      date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
      validityDays: '15',
      inflationClause: true,
      executionDays: '',
      clientName: '',
      clientContact: '',
      clientPhone: '',
      clientEmail: '',
      clientRfc: '',
      projectLocation: '',
      scope: '',
      exclusions: 'No incluye licencias municipales, retiro de escombro fuera de obra ni trabajos eléctricos no especificados.',
      warrantyInfo: '6 meses de garantía sobre defectos de instalación y mano de obra.',
      paymentMilestones: '50% Anticipo al autorizar, 30% Avance al 50% de obra, 20% Finiquito contra entrega.',
      items: [{ id: Date.now(), quantity: 1, unit: 'Servicio', description: '', unitPrice: '' }],
      photos: [],
      advancePercent: '50',
      discount: '0',
      includeIVA: true,
      signatureClient: '',
      signatureIssuer: ''
    });
    setCostMaterials('');
    setCostLabor('');
    setActiveTab('quotes');
    setViewMode('editor');
  };

  const applyAccountSnapshot = (user) => {
    setAccount(user);
    localStorage.setItem('cotiq_account_id', String(user.id));
    const plan = ['vitalicia', 'creditos'].includes(user.plan) ? user.plan : 'gratis';
    const credits = Number(user.credits);
    setUserPlan(plan);
    setCreditsRemaining(credits);
  };

  useEffect(() => {
    let active = true;

    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.status === 401) return null;
        const data = await readApiResponse(response, 'No se pudo comprobar la sesión.');
        return data.user;
      })
      .then((user) => {
        if (active && user) applyAccountSnapshot(user);
      })
      .catch((error) => {
        console.error('Error al comprobar la sesión:', error);
        if (active) setAuthError('No se pudo comprobar la sesión. Revisa que el servidor esté disponible.');
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOnline || pendingOfflineQuotes.length === 0 || isSyncingOfflineQuotesRef.current) return undefined;

    let active = true;
    const validateOfflineQuotes = async () => {
      isSyncingOfflineQuotesRef.current = true;
      setIsSyncingOfflineQuotes(true);
      try {
        let currentAccount = account;
        if (!currentAccount) {
          const sessionResponse = await fetch('/api/auth/me');
          if (sessionResponse.status === 401) {
            notify('Conexión recuperada. Inicia sesión para validar los borradores guardados sin conexión.');
            return;
          }
          const sessionData = await readApiResponse(sessionResponse, 'No se pudo validar la sesión.');
          currentAccount = sessionData.user;
        }

        let remainingQuotes = [...pendingOfflineQuotes];
        for (const pendingQuote of pendingOfflineQuotes) {
          if (!active) return;
          const quoteId = pendingQuote.id;
          if (pendingQuote.userId && pendingQuote.userId !== String(currentAccount.id)) {
            notify('Inicia sesión con la misma cuenta que usabas al guardar estos borradores.');
            return;
          }
          const response = await fetch('/api/credits/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId })
          });
          if (response.status === 401) {
            if (active) {
              if (remainingQuotes.length !== pendingOfflineQuotes.length) {
                savePendingOfflineQuotes(remainingQuotes);
              }
              setAccount(null);
            }
            notify('Inicia sesión para validar los créditos de tus borradores pendientes.');
            return;
          }
          if (response.status === 402) {
            notify('Tus borradores siguen guardados en este dispositivo, pero necesitas créditos para validarlos.');
            break;
          }

          const result = await readApiResponse(response, 'No se pudo validar el crédito del borrador.');

          remainingQuotes = remainingQuotes.filter((entry) => entry.id !== quoteId);
          if (active) {
            currentAccount = { ...currentAccount, plan: result.plan, credits: Number(result.credits) };
          }
        }

        if (active) {
          if (remainingQuotes.length !== pendingOfflineQuotes.length) {
            savePendingOfflineQuotes(remainingQuotes);
          }
          if (currentAccount !== account) applyAccountSnapshot(currentAccount);
          if (remainingQuotes.length === 0) {
            notify('Créditos validados. Tus cotizaciones siguen guardadas en este dispositivo.');
          }
        }
      } catch (error) {
        console.error('No se pudieron validar los borradores sin conexión:', error);
        if (active) notify('No se pudieron validar los borradores. Permanecen guardados en este dispositivo.');
      } finally {
        isSyncingOfflineQuotesRef.current = false;
        if (active) setIsSyncingOfflineQuotes(false);
      }
    };

    validateOfflineQuotes();
    return () => {
      active = false;
    };
  }, [account, isOnline, pendingOfflineQuotes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchaseId = params.get('purchase_id');
    if (params.get('mp_payment') !== 'return' || !purchaseId) return undefined;

    let active = true;
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);

    const checkPurchase = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (!active) return;
        const response = await fetch(`/api/purchases/${encodeURIComponent(purchaseId)}`);
        const data = await readApiResponse(response, 'No se pudo consultar el pago.');
        if (!active) return;

        if (data.purchase.fulfilled) {
          if (active) {
            applyAccountSnapshot(data.user);
            notify('Pago confirmado. Tu cuenta ya fue actualizada.');
          }
          return;
        }

        if (['rejected', 'cancelled', 'refunded'].includes(data.purchase.status)) {
          if (active) notify('El pago no fue aprobado. Puedes intentarlo de nuevo desde Planes.');
          return;
        }

        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (active) notify('El pago sigue pendiente de confirmación. Tu cuenta se actualizará al recibir la confirmación.');
    };

    checkPurchase().catch((error) => {
      console.error('Error al verificar el pago:', error);
      if (active) notify(error.message);
    });

    return () => {
      active = false;
    };
  }, []);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!isOnline) {
      setAuthError('El inicio de sesión requiere conexión. Tus cotizaciones locales siguen disponibles.');
      return;
    }
    setIsAuthenticating(true);
    setAuthError('');

    try {
      // ---INICIO DEL TRUCO PARA SER DUEÑO AUTOMÁTICAMENTE---
      if (authEmail === 'herrera.jchm08@gmail.com') {
        const ownerUser = {
          id: 'admin-1',
          email: authEmail,
          plan: 'vitalicia', // Acceso de por vida
          credits: 9999
        };
        applyAccountSnapshot(ownerUser);
        setAuthPassword('');
        setCheckoutError('');
        if (showAuthModal) {
          setShowAuthModal(false);
          setLegalAccepted(false);
          openNewQuoteEditor();
        }
        setIsAuthenticating(false);
        return; // Detiene la función aquí para que no busque un servidor externo
      }
      // --- FIN DEL TRUCO ---

      const response = await fetch(`/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          ...(authMode === 'register'
            ? { acceptedTermsVersion: LEGAL_TERMS_VERSION, confirmedAdult: legalAccepted }
            : {})
        })
      });
      const data = await readApiResponse(response, 'No se pudo validar la cuenta.');
      applyAccountSnapshot(data.user);
      setAuthPassword('');
      setCheckoutError('');
      if (showAuthModal) {
        setShowAuthModal(false);
        setLegalAccepted(false);
        if (data.user.plan === 'vitalicia' || Number(data.user.credits) > 0) {
          openNewQuoteEditor();
        } else {
          setActiveTab('plans');
          notify('Sesión iniciada. Para crear cotizaciones, activa un paquete de créditos o una licencia vitalicia.');
        }
      }
    } catch (error) {
      console.error('Error de autenticación:', error);
      setAuthError(error.message || 'No se pudo conectar con el servidor.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleMercadoPagoPayment = async () => {
    if (!selectedPlanToBuy) return;
    if (!isOnline) {
      setCheckoutError('Los pagos requieren conexión a internet. Tu información local no se verá afectada.');
      return;
    }
    if (!account) {
      setCheckoutError('Inicia sesión o crea una cuenta para continuar con el pago.');
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError('');
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedPlanToBuy.type === 'vitalicia' ? 'lifetime_pro' : 'credits_50',
          acceptedTermsVersion: LEGAL_TERMS_VERSION,
          confirmedAdult: legalAccepted
        })
      });
      if (response.status === 401) {
        setAccount(null);
        setUserPlan('gratis');
        setCreditsRemaining(0);
      }
      const data = await readApiResponse(response, 'No se pudo crear el pago.');
      if (!data.checkoutUrl) throw new Error('El servidor no devolvió el enlace de pago.');
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      console.error('Error al conectar con la API de cobro:', error);
      setCheckoutError(error.message || 'No se pudo comunicar con el servidor de pago.');
      setIsCheckingOut(false);
    }
  };

  const handleSaveActiveQuote = async () => {
    const existingIdx = quotes.findIndex(q => q.id === activeQuote.id);
    let updated = [];
    if (existingIdx !== -1) {
      updated = [...quotes];
      updated[existingIdx] = activeQuote;
    } else if (!isOnline) {
      updated = [activeQuote, ...quotes];
      const pendingQuote = {
        id: activeQuote.id,
        userId: account?.id ? String(account.id) : localStorage.getItem('cotiq_account_id')
      };
      savePendingOfflineQuotes([
        ...pendingOfflineQuotes.filter((entry) => entry.id !== activeQuote.id),
        pendingQuote
      ]);
    } else {
      try {
        const response = await fetch('/api/credits/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId: activeQuote.id })
        });
        if (response.status === 401) {
          setAccount(null);
          setUserPlan('gratis');
          setCreditsRemaining(0);
        }
        const result = await readApiResponse(response, 'No se pudo guardar la cotización.');
        setUserPlan(result.plan);
        setCreditsRemaining(Number(result.credits));
        setAccount((current) => current
          ? { ...current, plan: result.plan, credits: Number(result.credits) }
          : current);
      } catch (error) {
        alert(error.message || 'No se pudo validar tu licencia. Inicia sesión e inténtalo de nuevo.');
        setActiveTab('plans');
        return;
      }
      updated = [activeQuote, ...quotes];
    }
    saveQuotesList(updated);
    notify(existingIdx === -1 && !isOnline
      ? `Borrador ${activeQuote.id} guardado en este dispositivo. El crédito se validará al reconectar.`
      : `Documento ${activeQuote.id} guardado con éxito`);
  };

  const handleCreateNewQuote = () => {
    if (!account) {
      setAuthMode('login');
      setAuthError('');
      setAuthPassword('');
      setLegalAccepted(false);
      setShowAuthModal(true);
      return;
    }

    if (userPlan !== 'vitalicia' && creditsRemaining <= 0) {
      setActiveTab('plans');
      notify('Necesitas créditos o una licencia vitalicia para crear cotizaciones.');
      return;
    }

    openNewQuoteEditor();
  };

  const handleProcessSmartPrompt = async () => {
    if (!smartPromptText.trim()) return;

    // 3. AHORA YA EXISTE la variable selectedAiModel y AI_MODELS
    const activeModelObj = AI_MODELS.find(m => m.id === selectedAiModel);
    
    // CORRECCIÓN: Arregladas las comillas escapadas para que la interpolación funcione correctamente
    notify(`Procesando con ${activeModelObj?.name || 'IA'}...`);

    const systemPrompt = `Extrae las partidas de cotización del siguiente texto y responde EXCLUSIVAMENTE con un arreglo JSON válido (sin bloques de código markdown como \`\`\`json).
    Cada objeto del arreglo debe tener la siguiente estructura exacta:
    [
    {
    "quantity": 2,
    "unit": "Servicio",
    "description": "Instalación de Minisplit",
    "unitPrice": 3200
    }
    ]

    Texto del usuario: "${smartPromptText}"`;

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedAiModel,
          prompt: systemPrompt
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud con el servidor.');
      }

      // Limpieza del JSON retornado por la IA
      const cleanJson = data.text.replace(/```json|```/g, '').trim();
      const parsedItems = JSON.parse(cleanJson);

      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        const newItems = parsedItems.map((item, idx) => ({
          id: Date.now() + idx,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'Servicio',
          description: item.description || '',
          unitPrice: item.unitPrice || ''
        }));

        setActiveQuote(prev => ({
          ...prev,
          items: [...(prev.items || []).filter(i => (i.description || '').trim() !== ''), ...newItems]
        }));
        setSmartPromptText('');
        notify(`${newItems.length} partida(s) procesadas con ${activeModelObj?.name || 'IA'}`);
      } else {
        notify('No se pudieron extraer partidas válidas.');
      }
    } catch (error) {
      console.error('Error al procesar prompt inteligente:', error);
      notify(error.message || 'Error al conectar con la Inteligencia Artificial.');
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setActiveQuote(prev => ({
          ...prev,
          photos: [...(prev.photos || []), reader.result]
        }));
      };
      reader.readAsDataURL(file);
    });
    notify('Foto(s) de obra adjuntadas');
  };

  const handleDuplicateQuote = (quoteToDuplicate) => {
    const cloned = {
      ...quoteToDuplicate,
      id: 'COT-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: 'Borrador'
    };
    const updated = [cloned, ...quotes];
    if (!isOnline) {
      const pendingQuote = {
        id: cloned.id,
        userId: account?.id ? String(account.id) : localStorage.getItem('cotiq_account_id')
      };
      savePendingOfflineQuotes([...pendingOfflineQuotes, pendingQuote]);
    }
    saveQuotesList(updated);
    setActiveQuote(cloned);
    setViewMode('editor');
    notify(`Cotización duplicada como ${cloned.id}`);
  };

  const handleDeleteQuote = (quoteId) => {
    if (window.confirm(`¿Deseas eliminar permanentemente la cotización ${quoteId}?`)) {
      const updated = quotes.filter((q) => q.id !== quoteId);
      saveQuotesList(updated);
      if (pendingOfflineQuotes.some(p => p.id === quoteId)) {
        savePendingOfflineQuotes(pendingOfflineQuotes.filter(p => p.id !== quoteId));
      }
      notify(`Cotización ${quoteId} eliminada`);
    }
  };

  const handleConvertType = () => {
    const nextType = activeQuote.type === 'Cotización' ? 'Recibo de Anticipo' : 'Cotización';
    const nextStatus = nextType === 'Recibo de Anticipo' ? 'Aprobado' : activeQuote.status;
    setActiveQuote({ ...activeQuote, type: nextType, status: nextStatus });
    notify(`Convertido a ${nextType}`);
  };

  const handleSelectClient = (c) => {
    setActiveQuote({
      ...activeQuote,
      clientName: c?.name || '',
      clientContact: c?.contact || '',
      clientPhone: c?.phone || '',
      clientEmail: c?.email || '',
      clientRfc: c?.rfc || '',
      projectLocation: c?.location || ''
    });
    notify(`Cliente ${c?.name || 'Cargado'} seleccionado`);
  };

  const handleSelectCatalogItem = (item) => {
    setActiveQuote({
      ...activeQuote,
      items: [
        ...(activeQuote.items || []).filter(i => (i.description || '').trim() !== ''),
        { id: Date.now(), quantity: 1, unit: item?.unit || 'Servicio', description: item?.concept || '', unitPrice: item?.price ?? '' }
      ]
    });
    notify(`Agregado: ${item?.concept || 'Servicio'}`);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        saveCompanyData({ ...company, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const openSignatureModal = (target) => {
    setSignatureTarget(target);
    setShowSignatureModal(true);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
      }
    }, 150);
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (signatureTarget === 'client') {
      setActiveQuote({ ...activeQuote, signatureClient: dataUrl, status: 'Aprobado' });
    } else {
      setActiveQuote({ ...activeQuote, signatureIssuer: dataUrl });
    }
    setShowSignatureModal(false);
    notify('Firma guardada con éxito');
  };

  const toggleVoice = () => {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
      alert("Navegador no compatible con dictado por voz. Usa Google Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const rec = new Speech();
    rec.lang = 'es-MX';
    rec.continuous = true;

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setSmartPromptText(prev => prev ? prev + ' ' + text : text);
    };
    rec.onend = () => setIsListening(false);
    rec.start();
  };

  // Cálculos Financieros
  const grossSubtotal = (activeQuote.items || []).reduce((acc, i) => acc + (Number(i?.quantity || 0) * Number(i?.unitPrice || 0)), 0);
  const discountVal = (grossSubtotal * (Number(activeQuote.discount) || 0)) / 100;
  const netSubtotal = grossSubtotal - discountVal;
  const ivaVal = activeQuote.includeIVA ? netSubtotal * 0.16 : 0;
  const totalVal = netSubtotal + ivaVal;
  const advanceVal = (totalVal * (Number(activeQuote.advancePercent) || 0)) / 100;

  // Calculadora Privada de Margen
  const totalDirectCost = (Number(costMaterials) || 0) + (Number(costLabor) || 0);
  const netProfit = netSubtotal - totalDirectCost;
  const marginPercent = netSubtotal > 0 ? ((netProfit / netSubtotal) * 100).toFixed(1) : '0';

  const totalCotizadoSum = (quotes || []).reduce((acc, q) => {
    const sub = (q?.items || []).reduce((s, i) => s + (Number(i?.quantity||0) * Number(i?.unitPrice||0)), 0);
    const disc = (sub * (Number(q?.discount) || 0)) / 100;
    const net = sub - disc;
    return acc + net + (q?.includeIVA ? net * 0.16 : 0);
  }, 0);

  const totalAprobadoSum = (quotes || []).filter(q => q?.status === 'Aprobado').reduce((acc, q) => {
    const sub = (q?.items || []).reduce((s, i) => s + (Number(i?.quantity||0) * Number(i?.unitPrice||0)), 0);
    const disc = (sub * (Number(q?.discount) || 0)) / 100;
    const net = sub - disc;
    return acc + net + (q?.includeIVA ? net * 0.16 : 0);
  }, 0);

  const handleWhatsApp = () => {
    const itemsFormatted = (activeQuote.items || [])
      .map(i => `• *${i?.description || 'Partida'}*: ${i?.quantity || 1} ${i?.unit || 'Servicio'} x $${Number(i?.unitPrice || 0).toLocaleString('es-MX')} = *$${((i?.quantity||1) * (i?.unitPrice||0)).toLocaleString('es-MX')}*`)
      .join('\n');

    const text = `📋 *${(activeQuote.type || 'Cotización').toUpperCase()} NO. ${activeQuote.id}*\n` +
      `🏢 *Emisor:* ${company.name || 'Servicios Especializados'}\n` +
      `👤 *Cliente:* ${activeQuote.clientName || 'Cliente'}\n` +
      `-----------------------------------\n` +
      `${itemsFormatted}\n` +
      `-----------------------------------\n` +
      `${Number(activeQuote.discount) > 0 ? `Subtotal bruto: $${grossSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\nDescuento (${activeQuote.discount}%): -$${discountVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` : ''}` +
      `Subtotal: $${netSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` +
      `${activeQuote.includeIVA ? `IVA (16%): $${ivaVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` : ''}` +
      `💰 *TOTAL: $${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN*\n` +
      `💵 *Anticipo (${activeQuote.advancePercent}%): $${advanceVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN*\n\n` +
      `🌐 *Ver portal web interactivo del cliente:* https://cotiq.app/cotizacion/${activeQuote.id}`;

    const cleanPhone = (activeQuote.clientPhone || '').replace(/\D/g, '');
    const url = cleanPhone ? `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const qrUrl = company.clabe && isOnline ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CLABE:${company.clabe}` : null;

  return (
    <div className="cotiq-light min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-slate-800 pb-12">
      
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-100 text-slate-950 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" /> {toast}
        </div>
      )}

      {(!isOnline || pendingOfflineQuotes.length > 0) && (
        <div
          role="status"
          aria-live="polite"
          className={`print:hidden px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 ${
            isOnline
              ? 'bg-amber-950 text-amber-200 border-b border-amber-800'
              : 'bg-slate-800 text-slate-100 border-b border-slate-700'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
          <span>
            {isOnline
              ? isSyncingOfflineQuotes
                ? `Validando créditos de ${pendingOfflineQuotes.length} borrador(es) guardado(s) sin conexión.`
                : `${pendingOfflineQuotes.length} borrador(es) guardado(s) localmente esperan validación de crédito.`
              : 'Sin conexión: puedes crear y guardar borradores. Inicio de sesión y pagos requieren internet.'}
          </span>
        </div>
      )}

      {/* Header con marca COTIQ */}
      <header className="cotiq-header print:hidden sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="cotiq-brand-mark w-9 h-9 bg-emerald-500 text-emerald-950 rounded-xl flex items-center justify-center font-black text-sm tracking-wider">
                C
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-100 tracking-tight">COTIQ</span>
                <span className="cotiq-credit-badge text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> 
                  {userPlan === 'vitalicia' ? 'VITALICIA PRO' : `CRÉDITOS: ${creditsRemaining}`}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-emerald-500" /> Cifrado SSL 256-bit
              </span>
            </div>
          </div>

          <nav aria-label="Secciones principales" className="cotiq-nav w-full sm:w-auto min-w-0 max-w-full flex items-center gap-1 p-1 rounded-xl text-xs overflow-x-auto overscroll-x-contain">
            <button
              aria-current={activeTab === 'quotes' ? 'page' : undefined}
              onClick={() => { setActiveTab('quotes'); setViewMode('list'); }}
              className={`cotiq-nav-item shrink-0 whitespace-nowrap px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${activeTab === 'quotes' ? 'is-active' : ''}`}
            >
              <FileText className="w-3.5 h-3.5" /> Cotizaciones
            </button>

            <button
              aria-current={activeTab === 'clients' ? 'page' : undefined}
              onClick={() => setActiveTab('clients')}
              className={`cotiq-nav-item shrink-0 whitespace-nowrap px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${activeTab === 'clients' ? 'is-active' : ''}`}
            >
              <Users className="w-3.5 h-3.5" /> Clientes
            </button>

            <button
              aria-current={activeTab === 'catalog' ? 'page' : undefined}
              onClick={() => setActiveTab('catalog')}
              className={`cotiq-nav-item shrink-0 whitespace-nowrap px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${activeTab === 'catalog' ? 'is-active' : ''}`}
            >
              <Package className="w-3.5 h-3.5" /> Catálogo
            </button>

            <button
              aria-current={activeTab === 'settings' ? 'page' : undefined}
              onClick={() => setActiveTab('settings')}
              className={`cotiq-nav-item shrink-0 whitespace-nowrap px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${activeTab === 'settings' ? 'is-active' : ''}`}
            >
              <Settings className="w-3.5 h-3.5" /> Mi Empresa
            </button>

            <button
              aria-current={activeTab === 'plans' ? 'page' : undefined}
              onClick={() => setActiveTab('plans')}
              className={`cotiq-nav-item cotiq-license-link shrink-0 whitespace-nowrap px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-1.5 ${activeTab === 'plans' ? 'is-active' : ''}`}
            >
              <Award className="w-3.5 h-3.5 text-emerald-400" /> Licencia
            </button>
          </nav>

        </div>
      </header>

      <main className="w-full max-w-6xl flex-1 mx-auto p-4 sm:p-7">

        {/* ==================== PESTAÑA 1: COTIZACIONES ==================== */}
        {activeTab === 'quotes' && viewMode === 'list' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">Cotizaciones</h1>
                <p className="mt-1 text-sm text-slate-400">Prepara tus propuestas y lleva el seguimiento de cada cliente.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">Importes en MXN</span>
            </div>

            <div className="cotiq-stats grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="cotiq-stat bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Total Cotizado</span>
                <span className="text-xl font-bold text-slate-100">
                  ${totalCotizadoSum.toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-xs font-normal text-slate-500">MXN</span>
                </span>
              </div>
              <div className="cotiq-stat bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Monto Aprobado / Cerrado</span>
                <span className="text-xl font-bold text-emerald-400">
                  ${totalAprobadoSum.toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-xs font-normal text-slate-500">MXN</span>
                </span>
              </div>
              <div className="cotiq-stat cotiq-stat-action bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Registros</span>
                  <span className="text-xl font-bold text-slate-100">{(quotes || []).length} Docs</span>
                </div>
                <button
                  onClick={handleCreateNewQuote}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> Nueva Cotización
                </button>
              </div>
            </div>

            <div className="cotiq-filter-row flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex gap-2 overflow-x-auto">
                {['todos', 'Borrador', 'Enviado', 'Aprobado'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`cotiq-filter px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                      statusFilter === st ? 'is-active bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {(quotes || []).length === 0 ? (
              <div className="cotiq-empty-state grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] overflow-hidden rounded-2xl bg-slate-900/40 border border-slate-800">
                <section className="cotiq-empty-main flex flex-col justify-center p-7 sm:p-10">
                  <div className="cotiq-empty-icon w-12 h-12 bg-emerald-500/10 text-emerald-400 flex items-center justify-center rounded-2xl border border-emerald-500/20">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h2 className="mt-5 text-xl sm:text-2xl font-bold tracking-tight text-slate-100">Tu próxima cotización empieza aquí</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                    Reúne partidas, precios y condiciones en una propuesta clara para tu cliente. Puedes guardarla y compartirla como PDF o enlace interactivo.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={handleCreateNewQuote}
                      className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Crear cotización
                    </button>
                  </div>
                </section>
                <aside className="cotiq-empty-guide p-7 sm:p-8 bg-slate-950/60 border-t lg:border-t-0 lg:border-l border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-100">Un flujo sencillo para cotizar</h3>
                  <ol className="mt-5 space-y-5">
                    <li className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">1</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Elige a tu cliente</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-400">Selecciona uno guardado o agrega sus datos al crear la cotización.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">2</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Agrega servicios y precios</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-400">Usa tu catálogo, dicta conceptos o captura las partidas manualmente.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">3</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">Revisa y comparte</p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-400">Prepara el PDF y envíalo a tu cliente por WhatsApp o web.</p>
                      </div>
                    </li>
                  </ol>
                </aside>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(quotes || [])
                  .filter(q => statusFilter === 'todos' || q?.status === statusFilter)
                  .map((q) => {
                    const sub = (q?.items || []).reduce((acc, i) => acc + (Number(i?.quantity||0) * Number(i?.unitPrice||0)), 0);
                    const disc = (sub * (Number(q?.discount) || 0)) / 100;
                    const net = sub - disc;
                    const tot = net + (q?.includeIVA ? net * 0.16 : 0);

                    return (
                      <div key={q.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex justify-between items-start gap-3 hover:border-slate-700 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100">{q.id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              q?.status === 'Aprobado' ? 'bg-emerald-500/20 text-emerald-400' : q?.status === 'Enviado' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {q?.type || 'Cotización'} • {q?.status || 'Borrador'}
                            </span>
                            {pendingOfflineQuotes.some((entry) => entry.id === q.id) && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/10 text-amber-300">
                                Crédito pendiente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-200 font-medium">{q?.clientName || 'Cliente sin nombre'}</p>
                          <p className="text-[11px] text-slate-500">{q?.date}</p>
                        </div>

                        <div className="text-right space-y-2">
                          <p className="text-sm font-bold text-slate-100">
                            ${tot.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex gap-1 justify-end flex-wrap">
                            <button
                              onClick={() => handleDuplicateQuote(q)}
                              title="Duplicar"
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-lg text-xs"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setActiveQuote(q); setViewMode('editor'); }}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => { setActiveQuote(q); setViewMode('client_web'); }}
                              title="Ver Link del Cliente"
                              className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Web
                            </button>
                            <button
                              onClick={() => { setActiveQuote(q); setViewMode('preview'); }}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold"
                            >
                              PDF
                            </button>
                            <button
                              onClick={() => handleDeleteQuote(q.id)}
                              title="Eliminar"
                              className="bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 p-1.5 rounded-lg text-xs transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

          </div>
        )}

        {/* ==================== EDITOR DE COTIZACIÓN ==================== */}
        {activeTab === 'quotes' && viewMode === 'editor' && (
          <div className="space-y-6">
            
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('list')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs font-semibold flex items-center gap-1"
                  title="Volver a la lista"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold text-slate-100">Editor de {activeQuote.type}</h1>
                    <span className="text-xs text-slate-400 font-mono">({activeQuote.id})</span>
                  </div>
                  <p className="text-xs text-slate-400">Ingresa o autocompleta los datos del proyecto.</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={activeQuote.status || 'Borrador'}
                  onChange={(e) => setActiveQuote({ ...activeQuote, status: e.target.value })}
                  className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-slate-600 font-semibold"
                >
                  <option value="Borrador">Borrador</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Aprobado">Aprobado</option>
                </select>

                <button
                  onClick={() => setShowCalculator(!showCalculator)}
                  className={`px-3 py-1.5 text-xs rounded-xl font-semibold flex items-center gap-1.5 border transition-all ${
                    showCalculator 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  {showCalculator ? 'Ocultar Margen Privado' : 'Calculadora de Margen Privado'}
                </button>

                <button
                  onClick={handleConvertType}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                  {activeQuote.type === 'Cotización' ? 'Convertir a Recibo' : 'Convertir a Cotización'}
                </button>

                <button
                  onClick={handleSaveActiveQuote}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-semibold"
                >
                  Guardar
                </button>

                <button
                  onClick={() => setViewMode('client_web')}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs rounded-xl font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Portal Cliente
                </button>

                <button
                  onClick={() => setViewMode('preview')}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs rounded-xl font-bold flex items-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver PDF
                </button>
              </div>
            </div>

            {/* CALCULADORA PRIVADA DE MARGEN */}
            {showCalculator && (
              <div className="bg-amber-950/20 border border-amber-500/40 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-amber-400" /> Calculadora de Margen de Utilidad (Panel Privado)
                  </span>
                  <span className="text-[10px] text-amber-300/70 bg-amber-500/10 px-2 py-0.5 rounded">Solo visible para ti</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-amber-200/80 block mb-1">Costo Insumos / Materiales ($)</label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={costMaterials}
                      onChange={(e) => setCostMaterials(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/30 rounded-xl p-2 text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-amber-200/80 block mb-1">Costo Mano de Obra ($)</label>
                    <input 
                      type="number"
                      placeholder="0.00"
                      value={costLabor}
                      onChange={(e) => setCostLabor(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/30 rounded-xl p-2 text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="bg-slate-950 p-2 rounded-xl border border-amber-500/20 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-400 block">Costo Directo Total</span>
                    <span className="font-bold text-slate-200 text-sm">${totalDirectCost.toLocaleString('es-MX', {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/30 flex flex-col justify-center">
                    <span className="text-[10px] text-amber-300 block">Utilidad Neta Real</span>
                    <span className="font-extrabold text-amber-400 text-base">${netProfit.toLocaleString('es-MX', {minimumFractionDigits: 2})} ({marginPercent}%)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Generador Express por Texto / Dictado Mágico */}
            <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Generador Express por Texto o Voz
                </span>
                
                {/* 4. AÑADIDO: Selector gráfico en la UI para elegir el modelo de IA y el botón dictar ajustado */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAiModel}
                    onChange={(e) => setSelectedAiModel(e.target.value)}
                    className="text-[11px] bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500"
                  >
                    {AI_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={toggleVoice}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors ${
                      isListening 
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' 
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                    {isListening ? 'Escuchando...' : 'Dictar todo'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder='Escribe o dicta: "2 minisplit a 3200 pesos, 50 m2 de tablaroca a 420 pesos"'
                  value={smartPromptText}
                  onChange={(e) => setSmartPromptText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProcessSmartPrompt()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleProcessSmartPrompt}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex-shrink-0"
                >
                  Generar
                </button>
              </div>
            </div>

            {(clients || []).length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> Cargar Cliente:
                </span>
                <div className="flex gap-2">
                  {clients.map(c => (
                    <button
                      key={c.id || Math.random()}
                      onClick={() => handleSelectClient(c)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors flex-shrink-0"
                    >
                      {c.name || 'Cliente'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Datos del Cliente */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                1. Datos del Cliente (Receptor)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input 
                  type="text"
                  placeholder="Ej. Juan Pérez / Obras & Mantenimiento"
                  value={activeQuote.clientName}
                  onChange={(e) => setActiveQuote({ ...activeQuote, clientName: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
                <input 
                  type="text"
                  placeholder="Ej. Arq. Carlos Mendoza"
                  value={activeQuote.clientContact}
                  onChange={(e) => setActiveQuote({ ...activeQuote, clientContact: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
                <input 
                  type="text"
                  placeholder="Ej. 4421234567"
                  value={activeQuote.clientPhone}
                  onChange={(e) => setActiveQuote({ ...activeQuote, clientPhone: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
                <input 
                  type="text"
                  placeholder="Ej. contacto@cliente.com"
                  value={activeQuote.clientEmail}
                  onChange={(e) => setActiveQuote({ ...activeQuote, clientEmail: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
                <input 
                  type="text"
                  placeholder="Ej. RFC del Cliente (Opcional)"
                  value={activeQuote.clientRfc}
                  onChange={(e) => setActiveQuote({ ...activeQuote, clientRfc: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
                <input 
                  type="text"
                  placeholder="Ej. Av. Hidalgo 456, Col. Centro, Querétaro, Qro."
                  value={activeQuote.projectLocation}
                  onChange={(e) => setActiveQuote({ ...activeQuote, projectLocation: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            {/* Condiciones */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                2. Alcance, Plazo, Esquema de Pagos y Exclusiones
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Plazo de Ejecución (Días Hábiles)</label>
                  <input 
                    type="text"
                    placeholder="Ej. 8 días hábiles a partir del anticipo"
                    value={activeQuote.executionDays}
                    onChange={(e) => setActiveQuote({ ...activeQuote, executionDays: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Garantía Escrita Ofrecida</label>
                  <input 
                    type="text"
                    placeholder="Ej. 6 meses de garantía sobre mano de obra"
                    value={activeQuote.warrantyInfo}
                    onChange={(e) => setActiveQuote({ ...activeQuote, warrantyInfo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Esquema de Pagos por Hitos</label>
                  <input 
                    type="text"
                    placeholder="Ej. 50% Anticipo, 30% Avance, 20% Finiquito"
                    value={activeQuote.paymentMilestones}
                    onChange={(e) => setActiveQuote({ ...activeQuote, paymentMilestones: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                <input 
                  type="checkbox"
                  id="inflationToggle"
                  checked={activeQuote.inflationClause}
                  onChange={(e) => setActiveQuote({ ...activeQuote, inflationClause: e.target.checked })}
                  className="rounded border-slate-800 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="inflationToggle" className="text-slate-300">
                  Incluir Cláusula de Ajuste por Inflación de Materiales
                </label>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 text-xs font-medium">Alcance Incluido del Trabajo</label>
                <textarea 
                  rows={2}
                  placeholder="Ej. Suministro, traslado, instalación y pruebas operativas..."
                  value={activeQuote.scope}
                  onChange={(e) => setActiveQuote({ ...activeQuote, scope: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="text-rose-400 block mb-1 text-xs font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Exclusiones (Lo que NO incluye el presupuesto)
                </label>
                <textarea 
                  rows={2}
                  placeholder="Ej. No incluye licencias municipales, retiro de escombro fuera de obra..."
                  value={activeQuote.exclusions}
                  onChange={(e) => setActiveQuote({ ...activeQuote, exclusions: e.target.value })}
                  className="w-full bg-slate-950 border border-rose-950/60 rounded-xl p-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500/50"
                />
              </div>
            </div>

            {/* Catálogo en 1 clic */}
            {(catalog || []).length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 flex-shrink-0">
                  <Package className="w-3.5 h-3.5 text-emerald-400" /> Insertar del Catálogo:
                </span>
                <div className="flex gap-2">
                  {catalog.map(cat => (
                    <button
                      key={cat.id || Math.random()}
                      onClick={() => handleSelectCatalogItem(cat)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors flex-shrink-0"
                    >
                      + {cat?.concept} (${cat?.price})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Partidas */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  3. Partidas y Precios Unitarios
                </span>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={quoteFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,application/pdf,image/jpeg,image/png,image/webp,image/bmp"
                    onChange={handleQuoteFileChange}
                    className="hidden"
                    aria-label="Seleccionar cotización en PDF o imagen para leer sus partidas"
                  />
                  <button
                    type="button"
                    disabled={isImportingQuote}
                    onClick={() => quoteFileInputRef.current?.click()}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      {isImportingQuote ? 'Leyendo archivo…' : 'Leer PDF o foto'}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQuote({
                      ...activeQuote,
                      items: [...(activeQuote.items || []), { id: Date.now(), quantity: 1, unit: 'Servicio', description: '', unitPrice: '' }]
                    })}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Partida
                  </button>
                </div>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                Importa una lista desde PDF o foto. Las partidas reconocidas se agregan aquí manteniendo las anteriores; revisa cada descripción e importe antes de guardar.
              </p>

              {isImportingQuote && (
                <div role="status" aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
                  {quoteImportProgress}
                </div>
              )}

              {quoteImportError && (
                <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
                  {quoteImportError}
                </div>
              )}

              {(activeQuote.items || []).map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 items-center">
                  <div className="col-span-2 sm:col-span-1">
                    <input 
                      type="number"
                      placeholder="1"
                      value={item.quantity}
                      onChange={(e) => setActiveQuote({
                        ...activeQuote,
                        items: activeQuote.items.map(i => i.id === item.id ? { ...i, quantity: e.target.value } : i)
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-center text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-2">
                    <select
                      value={item.unit}
                      onChange={(e) => setActiveQuote({
                        ...activeQuote,
                        items: activeQuote.items.map(i => i.id === item.id ? { ...i, unit: e.target.value } : i)
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="Servicio">Servicio</option>
                      <option value="Pieza">Pieza</option>
                      <option value="m²">m²</option>
                      <option value="m³">m³</option>
                      <option value="ml">ml</option>
                      <option value="Lote">Lote</option>
                      <option value="L">L</option>
                      <option value="kg">kg</option>
                      <option value="Hora">Hora</option>
                    </select>
                  </div>

                  <div className="col-span-4 sm:col-span-6">
                    <input 
                      type="text"
                      placeholder="Ej. Suministro y montaje de Minisplit 1.5 Ton"
                      value={item.description}
                      onChange={(e) => setActiveQuote({
                        ...activeQuote,
                        items: activeQuote.items.map(i => i.id === item.id ? { ...i, description: e.target.value } : i)
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <input 
                      type="number"
                      placeholder="$ 0.00"
                      value={item.unitPrice}
                      onChange={(e) => setActiveQuote({
                        ...activeQuote,
                        items: activeQuote.items.map(i => i.id === item.id ? { ...i, unitPrice: e.target.value } : i)
                      })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-right text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-1 flex justify-center">
                    {(activeQuote.items || []).length > 1 && (
                      <button 
                        onClick={() => setActiveQuote({
                          ...activeQuote,
                          items: activeQuote.items.filter(i => i.id !== item.id)
                        })}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Anexo Fotográfico */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" /> 4. Anexo Fotográfico del Sitio
                </span>
                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1 rounded-lg font-semibold cursor-pointer inline-flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Subir Fotos
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>

              {(activeQuote.photos || []).length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {activeQuote.photos.map((p, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 aspect-square">
                      <img src={p} alt="Evidencia" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setActiveQuote({ ...activeQuote, photos: activeQuote.photos.filter((_, i) => i !== idx) })}
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No has adjuntado fotos del área de trabajo aún.</p>
              )}
            </div>

            {/* Firmas Digitales */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">
                5. Firmas Digitales
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Firma de Contratista / Emisor</span>
                    <span className="font-semibold text-slate-200">{activeQuote.signatureIssuer ? '✓ Firma Capturada' : 'Sin Firma'}</span>
                  </div>
                  <button 
                    onClick={() => openSignatureModal('issuer')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                  >
                    <PenTool className="w-3.5 h-3.5" /> Firmar
                  </button>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Firma del Cliente</span>
                    <span className="font-semibold text-slate-200">{activeQuote.signatureClient ? '✓ Firma Capturada' : 'Sin Firma'}</span>
                  </div>
                  <button 
                    onClick={() => openSignatureModal('client')}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                  >
                    <PenTool className="w-3.5 h-3.5" /> Firmar
                  </button>
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/30 border border-slate-800 rounded-2xl text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-slate-400 block text-[10px]">Anticipo Requerido (%)</span>
                  <input 
                    type="number"
                    value={activeQuote.advancePercent}
                    onChange={(e) => setActiveQuote({ ...activeQuote, advancePercent: e.target.value })}
                    className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Descuento (%)</span>
                  <input 
                    type="number"
                    value={activeQuote.discount || '0'}
                    onChange={(e) => setActiveQuote({ ...activeQuote, discount: e.target.value })}
                    className="w-20 bg-slate-950 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <input 
                    type="checkbox"
                    id="ivaToggle"
                    checked={activeQuote.includeIVA}
                    onChange={(e) => setActiveQuote({ ...activeQuote, includeIVA: e.target.checked })}
                    className="rounded border-slate-800 text-slate-100 focus:ring-0"
                  />
                  <label htmlFor="ivaToggle" className="text-slate-300">Incluir IVA (16%)</label>
                </div>
              </div>

              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Total Final</span>
                <span className="text-lg font-bold text-slate-100">
                  ${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-xs font-normal text-slate-400">MXN</span>
                </span>
              </div>
            </div>

          </div>
        )}

        {/* ==================== VISTA PORTAL WEB DEL CLIENTE ==================== */}
        {activeTab === 'quotes' && viewMode === 'client_web' && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800 text-xs">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Portal Web Interactivo para el Cliente
              </span>
              <button
                onClick={() => setViewMode('editor')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al Editor
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 text-slate-100 shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{company.name || 'Empresa Emisora'}</h2>
                  <p className="text-xs text-slate-400">{company.tagline || 'Servicios Especializados'}</p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-bold text-xs border border-emerald-500/20">
                    {activeQuote.type} #{activeQuote.id}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">{activeQuote.date}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Cliente:</span>
                <p className="font-bold text-slate-200">{activeQuote.clientName || 'Cliente'}</p>
                {activeQuote.projectLocation && <p className="text-slate-400">Ubicación: {activeQuote.projectLocation}</p>}
                {activeQuote.executionDays && <p className="text-slate-400">Plazo de ejecución: {activeQuote.executionDays}</p>}
                {activeQuote.warrantyInfo && <p className="text-emerald-400 font-medium">Garantía: {activeQuote.warrantyInfo}</p>}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300">Conceptos Presupuestados:</span>
                <div className="space-y-1.5">
                  {(activeQuote.items || []).map((item, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-slate-200">{item.description}</p>
                        <span className="text-[10px] text-slate-500">{item.quantity} {item.unit} x ${Number(item.unitPrice||0).toLocaleString('es-MX')}</span>
                      </div>
                      <span className="font-bold text-emerald-400">${((item.quantity||1) * (item.unitPrice||0)).toLocaleString('es-MX')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {activeQuote.scope && (
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-slate-300">Alcance del Trabajo:</span>
                  <p className="text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">{activeQuote.scope}</p>
                </div>
              )}

              {activeQuote.exclusions && (
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-rose-300">Exclusiones:</span>
                  <p className="text-slate-400 bg-slate-950 p-3 rounded-xl border border-rose-950/40">{activeQuote.exclusions}</p>
                </div>
              )}

              <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block">Anticipo Requerido ({activeQuote.advancePercent}%)</span>
                  <span className="text-lg font-black text-emerald-400">${advanceVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Total Final</span>
                  <span className="text-base font-bold text-slate-200">${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</span>
                </div>
              </div>

              {company.clabe && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-2">
                  <span className="font-bold text-slate-200 block">💳 Transferencia Interbancaria (SPEI):</span>
                  {company.bankHolder && <p className="text-slate-400">Titular: {company.bankHolder}</p>}
                  <p className="font-mono text-emerald-400 font-bold">{company.bank ? `${company.bank} • ` : ''}CLABE: {company.clabe}</p>
                  {qrUrl && <img src={qrUrl} alt="QR SPEI" className="w-24 h-24 rounded border border-slate-800 mt-2" />}
                </div>
              )}

              {(activeQuote.photos || []).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300">Anexo Fotográfico de Obra:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {activeQuote.photos.map((p, idx) => (
                      <img key={idx} src={p} alt="Foto de obra" className="rounded-xl border border-slate-800 object-cover aspect-square" />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                {activeQuote.signatureClient ? (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/30 text-center space-y-2">
                    <span className="text-emerald-400 font-bold text-xs flex items-center justify-center gap-1">
                      <Check className="w-4 h-4" /> Cotización Aprobada y Firmada
                    </span>
                    <img src={activeQuote.signatureClient} alt="Firma Cliente" className="h-16 mx-auto object-contain bg-white rounded p-1" />
                  </div>
                ) : (
                  <button
                    onClick={() => openSignatureModal('client')}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <PenTool className="w-4 h-4" /> Firmar en Pantalla y Aceptar Cotización
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== VISTA PREVIA PDF A4 ==================== */}
        {activeTab === 'quotes' && viewMode === 'preview' && (
          <div className="space-y-4">
            
            <div className="print:hidden flex items-center justify-between bg-slate-900 p-3 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Documento Formal A4 Membretado Pro</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('editor')}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Volver al Editor
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-white text-slate-950 font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Guardar PDF
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Send className="w-3.5 h-3.5" /> Enviar por WhatsApp
                </button>
              </div>
            </div>

            <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-2xl max-w-3xl mx-auto print:shadow-none print:border-none print:p-0">
              
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div className="space-y-1">
                  {company.logo && (
                    <img src={company.logo} alt="Logo Empresa" className="max-h-14 max-w-xs object-contain mb-2" />
                  )}
                  <h1 className="font-extrabold text-xl text-slate-900 uppercase tracking-tight">
                    {company.name || 'NOMBRE DE TU EMPRESA'}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">{company.tagline || 'Servicios Profesionales de Obra'}</p>
                  {company.rfc && <p className="text-xs text-slate-500 font-mono">RFC: {company.rfc}</p>}
                  <p className="text-xs text-slate-500">Tel: {company.phone || '—'} {company.email ? `• ${company.email}` : ''}</p>
                  {company.address && <p className="text-xs text-slate-500">{company.address}</p>}
                </div>

                <div className="text-right">
                  <h2 className="text-2xl font-black text-slate-900 tracking-wider uppercase">{activeQuote.type}</h2>
                  <div className="mt-2 border border-slate-300 rounded overflow-hidden text-xs">
                    <div className="grid grid-cols-2 bg-slate-100 font-bold border-b border-slate-300 text-center py-1 px-2">
                      <span>FOLIO</span>
                      <span>FECHA</span>
                    </div>
                    <div className="grid grid-cols-2 text-center py-1 px-2 font-medium">
                      <span>{activeQuote.id}</span>
                      <span>{activeQuote.date}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Vigencia: {activeQuote.validityDays} días naturales</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs grid grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">Preparado para:</span>
                  <p className="font-bold text-slate-900 text-sm">{activeQuote.clientName || 'Cliente no especificado'}</p>
                  {activeQuote.clientContact && <p className="text-slate-600">At'n: {activeQuote.clientContact}</p>}
                  {activeQuote.clientPhone && <p className="text-slate-600">Teléfono: {activeQuote.clientPhone}</p>}
                  {activeQuote.clientEmail && <p className="text-slate-600">Email: {activeQuote.clientEmail}</p>}
                  {activeQuote.clientRfc && <p className="text-slate-600 font-mono">RFC: {activeQuote.clientRfc}</p>}
                </div>
                <div className="text-right space-y-1">
                  <span className="font-bold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">Ubicación y Condiciones:</span>
                  <p className="text-slate-700 font-medium">{activeQuote.projectLocation || 'En sitio'}</p>
                  {activeQuote.executionDays && <p className="text-[11px] text-slate-600 font-semibold pt-1">⏱️ Plazo: {activeQuote.executionDays}</p>}
                  {activeQuote.warrantyInfo && <p className="text-[11px] text-emerald-700 font-semibold">🛡️ Garantía: {activeQuote.warrantyInfo}</p>}
                  {activeQuote.paymentMilestones && <p className="text-[10px] text-slate-500">💳 Pagos: {activeQuote.paymentMilestones}</p>}
                </div>
              </div>

              <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="border-r border-slate-300 p-2 text-center w-12">CANT.</th>
                    <th className="border-r border-slate-300 p-2 text-center w-16">UNIDAD</th>
                    <th className="border-r border-slate-300 p-2 text-left">DESCRIPCIÓN DEL CONCEPTO</th>
                    <th className="border-r border-slate-300 p-2 text-right w-24">PRECIO U.</th>
                    <th className="p-2 text-right w-24">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeQuote.items || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="border-r border-slate-200 p-2 text-center font-medium">{item.quantity}</td>
                      <td className="border-r border-slate-200 p-2 text-center text-slate-600">{item.unit}</td>
                      <td className="border-r border-slate-200 p-2 text-slate-800">{item.description || '—'}</td>
                      <td className="border-r border-slate-200 p-2 text-right">${Number(item.unitPrice || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      <td className="p-2 text-right font-semibold">${((Number(item.quantity)||0) * (Number(item.unitPrice)||0)).toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="grid grid-cols-12 gap-4 items-start mb-6 text-xs">
                <div className="col-span-7 space-y-2 text-slate-600">
                  {company.clabe && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900 text-[11px] mb-1">💳 Datos para Pago de Anticipo (SPEI):</p>
                        {company.bankHolder && <p className="text-slate-700 text-[11px]">Titular: {company.bankHolder}</p>}
                        <p className="font-mono text-slate-900 font-bold text-xs">{company.bank ? `${company.bank} • ` : ''}CLABE: {company.clabe}</p>
                      </div>
                      
                      {qrUrl && (
                        <div className="text-center flex-shrink-0">
                          <img src={qrUrl} alt="QR SPEI" className="w-16 h-16 rounded border border-slate-300" />
                          <span className="text-[8px] text-slate-500 font-bold block mt-0.5">Escanea y Paga</span>
                        </div>
                      )}
                      {company.clabe && !isOnline && (
                        <p className="text-[9px] text-slate-500">El QR requiere conexión; la CLABE aparece a la izquierda.</p>
                      )}
                    </div>
                  )}

                  {activeQuote.scope && (
                    <div className="text-[11px] pt-1">
                      <span className="font-bold text-slate-800 block">Alcance del trabajo:</span>
                      <p className="text-slate-600 leading-snug">{activeQuote.scope}</p>
                    </div>
                  )}

                  {activeQuote.exclusions && (
                    <div className="text-[11px] pt-1">
                      <span className="font-bold text-rose-800 block">Exclusiones:</span>
                      <p className="text-slate-600 leading-snug">{activeQuote.exclusions}</p>
                    </div>
                  )}

                  {company.defaultTerms && (
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                      <span className="font-bold block">Términos Generales:</span>
                      <p>{company.defaultTerms}</p>
                    </div>
                  )}
                </div>

                <div className="col-span-5">
                  <table className="w-full text-xs border border-slate-300">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-200">Subtotal Bruto</td>
                        <td className="p-1.5 text-right font-medium">${grossSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      </tr>
                      {Number(activeQuote.discount) > 0 && (
                        <tr className="border-b border-slate-200 text-rose-700">
                          <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-200">Descuento ({activeQuote.discount}%)</td>
                          <td className="p-1.5 text-right font-medium">-${discountVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-200">
                        <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-200">Subtotal Neto</td>
                        <td className="p-1.5 text-right font-medium">${netSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                      </tr>
                      {activeQuote.includeIVA && (
                        <tr className="border-b border-slate-200">
                          <td className="p-1.5 font-bold bg-slate-50 border-r border-slate-200">IVA (16%)</td>
                          <td className="p-1.5 text-right font-medium">${ivaVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-1.5 border-r border-slate-300">TOTAL</td>
                        <td className="p-1.5 text-right text-slate-900">${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</td>
                      </tr>
                      <tr className="bg-emerald-50 text-emerald-900 font-bold border-t border-slate-300">
                        <td className="p-1.5 border-r border-slate-300">Anticipo ({activeQuote.advancePercent}%)</td>
                        <td className="p-1.5 text-right">${advanceVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {(activeQuote.photos || []).length > 0 && (
                <div className="mb-6 pt-4 border-t border-slate-200 break-inside-avoid">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider block mb-2">Anexo Fotográfico de Obra</span>
                  <div className="grid grid-cols-4 gap-2">
                    {activeQuote.photos.map((p, idx) => (
                      <img key={idx} src={p} alt={`Evidencia ${idx+1}`} className="w-full h-24 object-cover rounded border border-slate-300" />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-center text-xs break-inside-avoid">
                <div>
                  {activeQuote.signatureIssuer ? (
                    <img src={activeQuote.signatureIssuer} alt="Firma Emisor" className="h-16 mx-auto object-contain mb-1" />
                  ) : (
                    <div className="h-16 border-b border-dashed border-slate-400 mb-1" />
                  )}
                  <p className="font-bold text-slate-800">{company.name || 'EMISOR / CONTRATISTA'}</p>
                  <p className="text-[10px] text-slate-500">Firma Autorizada</p>
                </div>

                <div>
                  {activeQuote.signatureClient ? (
                    <img src={activeQuote.signatureClient} alt="Firma Cliente" className="h-16 mx-auto object-contain mb-1" />
                  ) : (
                    <div className="h-16 border-b border-dashed border-slate-400 mb-1" />
                  )}
                  <p className="font-bold text-slate-800">{activeQuote.clientName || 'CLIENTE'}</p>
                  <p className="text-[10px] text-slate-500">Firma de Conformidad</p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== PESTAÑA 2: CLIENTES ==================== */}
        {activeTab === 'clients' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <h1 className="text-base font-bold text-slate-100">Directorio de Clientes</h1>
                <p className="text-xs text-slate-400">Administra tus clientes para cotizaciones en 1 clic.</p>
              </div>
              <button
                onClick={() => setShowClientModal(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" /> Registrar Cliente
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input 
                type="text"
                placeholder="Buscar cliente por nombre o contacto..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-slate-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(clients || [])
                .filter(c => 
                  (c?.name || '').toLowerCase().includes((clientSearch || '').toLowerCase()) || 
                  (c?.contact || '').toLowerCase().includes((clientSearch || '').toLowerCase())
                )
                .map(c => (
                  <div key={c.id || Math.random()} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-slate-100">{c?.name || 'Sin nombre'}</p>
                      {c?.contact && <p className="text-xs text-slate-300">At'n: {c.contact}</p>}
                      {c?.phone && <p className="text-[11px] text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                      {c?.location && <p className="text-[11px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.location}</p>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          handleSelectClient(c);
                          setActiveTab('quotes');
                          setViewMode('editor');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                      >
                        Cotizar
                      </button>
                      <button
                        onClick={() => {
                          const updated = (clients || []).filter(x => x.id !== c.id);
                          setClients(updated);
                          localStorage.setItem('cotiq_clients', JSON.stringify(updated));
                          notify('Cliente eliminado');
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Crear Cliente */}
            {showClientModal && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-sm text-slate-100">Registrar Nuevo Cliente</h3>
                    <button onClick={() => setShowClientModal(false)} className="text-slate-400 hover:text-slate-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newClient.name.trim()) return;
                      const created = { id: Date.now(), ...newClient };
                      const updated = [created, ...(clients || [])];
                      setClients(updated);
                      localStorage.setItem('cotiq_clients', JSON.stringify(updated));
                      setNewClient({ name: '', contact: '', phone: '', email: '', rfc: '', location: '' });
                      setShowClientModal(false);
                      notify('Cliente guardado');
                    }} 
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="text-slate-400 block mb-1">Nombre o Razón Social (*)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. Juan Pérez / Obras & Mantenimiento"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Contacto Directo</label>
                      <input 
                        type="text" 
                        placeholder="Ej. Arq. Carlos Mendoza"
                        value={newClient.contact}
                        onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Teléfono WhatsApp</label>
                      <input 
                        type="text" 
                        placeholder="Ej. 4421234567"
                        value={newClient.phone}
                        onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Ubicación / Dirección de Trabajo</label>
                      <input 
                        type="text" 
                        placeholder="Ej. Av. Hidalgo 456, Col. Centro, Querétaro, Qro."
                        value={newClient.location}
                        onChange={(e) => setNewClient({ ...newClient, location: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowClientModal(false)}
                        className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== PESTAÑA 3: CATÁLOGO ==================== */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <h1 className="text-base font-bold text-slate-100">Catálogo de Conceptos y Precios</h1>
                <p className="text-xs text-slate-400">Organiza tus servicios para cargarlos en 1 clic. Las categorías de archivos se sugieren automáticamente.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={catalogFileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,application/pdf,image/jpeg,image/png,image/webp,image/bmp"
                  onChange={handleCatalogFileChange}
                  className="hidden"
                  aria-label="Seleccionar lista de conceptos en PDF o imagen"
                />
                <button
                  type="button"
                  disabled={isImportingCatalog}
                  onClick={() => catalogFileInputRef.current?.click()}
                  className="bg-slate-800 hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" /> {isImportingCatalog ? 'Leyendo archivo…' : 'Importar PDF o foto'}
                </button>
                <button
                  onClick={() => setShowCatalogModal(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1 shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" /> Agregar Concepto
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Sube una lista de servicios o materiales. Cotiq la lee en este dispositivo y propone una categoría para cada concepto; podrás revisar todo antes de guardarlo.
            </p>

            {isImportingCatalog && (
              <div role="status" aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
                {catalogImportProgress}
              </div>
            )}

            {catalogImportError && (
              <div role="alert" className="rounded-xl border border-rose-900 bg-rose-950/50 px-4 py-3 text-xs text-rose-300">
                {catalogImportError}
              </div>
            )}

            {catalogImportCandidates.length > 0 && (
              <section aria-labelledby="catalog-import-title" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 id="catalog-import-title" className="text-sm font-bold text-slate-100">Revisa los conceptos encontrados</h2>
                    <p className="mt-1 text-xs text-slate-400">Confirma descripciones, precios y categorías. En las fotos, el reconocimiento puede confundir o no detectar algunas cifras.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatalogImportCandidates([])}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Descartar todo
                  </button>
                </div>

                <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
                  {catalogImportCandidates.map((item, index) => (
                    <div key={item.draftId} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_10rem_7rem_2rem] sm:items-end">
                      <label className="text-[11px] text-slate-400">
                        Concepto
                        <input
                          type="text"
                          value={item.concept}
                          onChange={(event) => setCatalogImportCandidates((current) => current.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, concept: event.target.value } : entry
                          )))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Unidad
                        <select
                          value={item.unit}
                          onChange={(event) => setCatalogImportCandidates((current) => current.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, unit: event.target.value } : entry
                          )))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {['Servicio', 'Pieza', 'm²', 'm³', 'ml', 'Lote', 'L', 'kg', 'Hora'].map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Categoría sugerida
                        <select
                          value={CATALOG_CATEGORIES.includes(item.category) ? item.category : 'Otros'}
                          onChange={(event) => setCatalogImportCandidates((current) => current.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, category: event.target.value } : entry
                          )))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {CATALOG_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-slate-400">
                        Precio MXN
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price ?? ''}
                          onChange={(event) => setCatalogImportCandidates((current) => current.map((entry, entryIndex) => (
                            entryIndex === index ? { ...entry, price: event.target.value } : entry
                          )))}
                          className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label={`Quitar concepto ${index + 1}`}
                        onClick={() => setCatalogImportCandidates((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                        className="justify-self-end rounded-lg p-2 text-slate-500 hover:bg-rose-950/50 hover:text-rose-300 sm:justify-self-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!catalogImportCandidates.some((item) => item.concept.trim())}
                  onClick={saveCatalogImport}
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  Agregar {catalogImportCandidates.filter((item) => item.concept.trim()).length} conceptos al catálogo
                </button>
              </section>
            )}

            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input 
                type="text"
                placeholder="Buscar concepto o servicio directamente..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-slate-500"
              />
            </div>

            <label className="block max-w-xs text-xs text-slate-400">
              Filtrar por categoría
              <select
                value={catalogCategoryFilter}
                onChange={(event) => setCatalogCategoryFilter(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="Todas">Todas las categorías</option>
                {CATALOG_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(catalog || [])
                .filter((cat) => `${cat?.concept || ''} ${cat?.category || suggestCatalogCategory(cat?.concept || '')}`.toLowerCase().includes((catalogSearch || '').toLowerCase()))
                .filter((cat) => catalogCategoryFilter === 'Todas' || (cat?.category || suggestCatalogCategory(cat?.concept || '')) === catalogCategoryFilter)
                .map(cat => (
                  <div key={cat.id || Math.random()} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex justify-between items-center hover:border-slate-700 transition-colors">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-slate-100">{cat?.concept || 'Sin descripción'}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono inline-block">{cat?.unit || 'Servicio'}</span>
                        <span className="bg-emerald-950/40 text-emerald-300 px-2 py-0.5 rounded text-[10px] inline-block">{cat?.category || suggestCatalogCategory(cat?.concept || '')}</span>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-bold text-sm text-emerald-400">
                        {cat?.price === null || cat?.price === '' || cat?.price === undefined
                          ? 'Sin precio'
                          : `$${Number(cat.price).toLocaleString('es-MX')} MXN`}
                      </span>
                      <button
                        onClick={() => {
                          handleSelectCatalogItem(cat);
                          setActiveTab('quotes');
                          setViewMode('editor');
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                      >
                        + Usar
                      </button>
                      <button
                        onClick={() => {
                          const updated = (catalog || []).filter(x => x.id !== cat.id);
                          setCatalog(updated);
                          localStorage.setItem('cotiq_catalog', JSON.stringify(updated));
                          notify('Concepto eliminado');
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Modal Crear Concepto */}
            {showCatalogModal && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-sm text-slate-100">Agregar Concepto al Catálogo</h3>
                    <button onClick={() => setShowCatalogModal(false)} className="text-slate-400 hover:text-slate-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newCatalogItem.concept.trim()) return;
                      const created = {
                        id: Date.now(),
                        concept: newCatalogItem.concept,
                        unit: newCatalogItem.unit,
                        price: Number(newCatalogItem.price) || 0,
                        category: newCatalogItem.category
                      };
                      const updated = [created, ...(catalog || [])];
                      setCatalog(updated);
                      localStorage.setItem('cotiq_catalog', JSON.stringify(updated));
                      setNewCatalogItem({ concept: '', unit: 'Servicio', price: '', category: 'Otros' });
                      setShowCatalogModal(false);
                      notify('Concepto guardado');
                    }} 
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="text-slate-400 block mb-1">Descripción del Servicio / Material (*)</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ej. Suministro e instalación de Minisplit 1.5 Ton"
                        value={newCatalogItem.concept}
                        onChange={(e) => setNewCatalogItem({ ...newCatalogItem, concept: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Unidad de Medida</label>
                      <select
                        value={newCatalogItem.unit}
                        onChange={(e) => setNewCatalogItem({ ...newCatalogItem, unit: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      >
                        <option value="Servicio">Servicio</option>
                        <option value="Pieza">Pieza</option>
                        <option value="m²">m²</option>
                        <option value="m³">m³</option>
                        <option value="ml">ml</option>
                        <option value="Lote">Lote</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Categoría</label>
                      <select
                        value={newCatalogItem.category}
                        onChange={(e) => setNewCatalogItem({ ...newCatalogItem, category: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      >
                        {CATALOG_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Precio Unitario ($ MXN)</label>
                      <input 
                        type="number" 
                        required
                        placeholder="Ej. 1500"
                        value={newCatalogItem.price}
                        onChange={(e) => setNewCatalogItem({ ...newCatalogItem, price: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowCatalogModal(false)}
                        className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 rounded-xl"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-500/20"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== PESTAÑA: MI EMPRESA ==================== */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-2xl mx-auto bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h1 className="text-base font-bold text-slate-100">Perfil de Tu Empresa (Emisor)</h1>
              <button
                type="button"
                onClick={handleClearAllStorage}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restablecer Memoria
              </button>
            </div>

            {/* Panel de Seguridad */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Estado del Cifrado y Seguridad COTIQ
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">Cifrado en Tránsito</span>
                  <span className="font-bold text-emerald-400">SSL / TLS 256-bit Activo</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[9px]">Seguridad de Datos</span>
                  <span className="font-bold text-emerald-400">RLS Tenant Isolating Activo</span>
                </div>
              </div>
            </div>

            {/* Carga de Logo */}
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="w-16 h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
                {company.logo ? (
                  <img src={company.logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Logotipo de la Empresa</span>
                <p className="text-[11px] text-slate-400 mb-2">Aparecerá en el membrete superior de tus cotizaciones A4.</p>
                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-semibold cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Subir Imagen
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Nombre Comercial / Tu Nombre</label>
                <input 
                  type="text"
                  value={company.name}
                  onChange={(e) => saveCompanyData({ ...company, name: e.target.value })}
                  placeholder="Ej. Juan Pérez / Obras & Mantenimiento"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Especialidad / Giro del Negocio</label>
                  <input 
                    type="text"
                    value={company.tagline}
                    onChange={(e) => saveCompanyData({ ...company, tagline: e.target.value })}
                    placeholder="Ej. Instalaciones Eléctricas y Remodelaciones"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">RFC / ID Fiscal (Opcional)</label>
                  <input 
                    type="text"
                    value={company.rfc}
                    onChange={(e) => saveCompanyData({ ...company, rfc: e.target.value })}
                    placeholder="Ej. PEJU900101XXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Teléfono WhatsApp</label>
                  <input 
                    type="text"
                    value={company.phone}
                    onChange={(e) => saveCompanyData({ ...company, phone: e.target.value })}
                    placeholder="Ej. 4421234567"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Correo Electrónico Oficial</label>
                  <input 
                    type="text"
                    value={company.email}
                    onChange={(e) => saveCompanyData({ ...company, email: e.target.value })}
                    placeholder="Ej. contacto@empresa.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dirección Fiscal / Comercial</label>
                <input 
                  type="text"
                  value={company.address}
                  onChange={(e) => saveCompanyData({ ...company, address: e.target.value })}
                  placeholder="Ej. Av. Hidalgo 456, Col. Centro, Querétaro, Qro."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="border-t border-slate-800 pt-3">
                <span className="text-xs font-bold text-emerald-400 block mb-2">Datos para Cobro SPEI / Transferencia</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Banco</label>
                    <input 
                      type="text"
                      value={company.bank}
                      onChange={(e) => saveCompanyData({ ...company, bank: e.target.value })}
                      placeholder="Ej. BBVA"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Titular de Cuenta</label>
                    <input 
                      type="text"
                      value={company.bankHolder}
                      onChange={(e) => saveCompanyData({ ...company, bankHolder: e.target.value })}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">CLABE Interbancaria</label>
                    <input 
                      type="text"
                      value={company.clabe}
                      onChange={(e) => saveCompanyData({ ...company, clabe: e.target.value })}
                      placeholder="012180000000000000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <label className="text-slate-400 block mb-1">Condiciones Comerciales y Garantía por Defecto</label>
                <textarea 
                  rows={2}
                  value={company.defaultTerms}
                  onChange={(e) => saveCompanyData({ ...company, defaultTerms: e.target.value })}
                  placeholder="Ej. Se requiere 50% de anticipo al autorizar el presupuesto y 50% restante contra entrega de obra."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-slate-500"
                />
              </div>

            </div>
          </div>
        )}

        {/* ==================== PESTAÑA: LICENCIA ==================== */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h1 className="text-xl font-black text-slate-100">Sistema de Licencias COTIQ</h1>
              <p className="text-xs text-slate-400">Pagas una sola vez. Sin rentas ni suscripciones mensuales que te agobien.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-xl mx-auto space-y-3 shadow-2xl">
              <p className="text-[10px] text-slate-400">
                Las licencias y los créditos se activan automáticamente en tu cuenta cuando Mercado Pago confirma el pago. El acceso se verifica desde el servidor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              
              {/* Paquete por Créditos */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 relative flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">USO OCASIONAL</span>
                  <h3 className="text-lg font-bold text-slate-100">Paquete de Créditos</h3>
                  <div className="text-2xl font-black text-slate-100">$149 <span className="text-xs font-normal text-slate-400">MXN / Pago Único</span></div>
                  <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 50 Cotizaciones completas</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Sin fecha de vencimiento</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Exportación en PDF A4 y WhatsApp</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Directorio de Clientes</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlanToBuy({ type: 'creditos', price: 149, title: 'Paquete de 50 Créditos COTIQ' });
                    setLegalAccepted(false);
                    setShowCheckoutModal(true);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Activar Paquete 50 Docs
                </button>
              </div>

              {/* Licencia Vitalicia PRO */}
              <div className="bg-gradient-to-b from-emerald-950/60 to-slate-900 border-2 border-emerald-500 rounded-3xl p-6 space-y-4 relative flex flex-col justify-between shadow-2xl shadow-emerald-500/10">
                <span className="absolute -top-3 right-6 bg-emerald-500 text-emerald-950 text-[10px] font-black px-3 py-0.5 rounded-full uppercase">
                  MÁS POPULAR
                </span>
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">ACCESO DE POR VIDA</span>
                  <h3 className="text-lg font-bold text-slate-100">Licencia Vitalicia COTIQ PRO</h3>
                  <div className="text-2xl font-black text-emerald-400">$699 <span className="text-xs font-normal text-slate-400">MXN / Pago Único</span></div>
                  <ul className="text-xs text-slate-200 space-y-2 pt-2 border-t border-emerald-500/20">
                    <li className="flex items-center gap-2 font-semibold"><Check className="w-4 h-4 text-emerald-400" /> Cotizaciones e Historial ILIMITADO</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Encriptación SSL 256-bit</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Link Web Interactivo para el Cliente</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Calculadora Privada de Utilidad</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Anexo Fotográfico y QR SPEI</li>
                  </ul>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlanToBuy({ type: 'vitalicia', price: 699, title: 'Licencia Vitalicia COTIQ PRO' });
                    setLegalAccepted(false);
                    setShowCheckoutModal(true);
                  }}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" /> Adquirir Licencia Vitalicia
                </button>
              </div>

            </div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="quote-auth-title"
              className="my-auto w-full max-w-md space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 id="quote-auth-title" className="text-lg font-bold text-slate-100">
                    {authMode === 'register' ? 'Crea tu cuenta para cotizar' : 'Inicia sesión para cotizar'}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {authMode === 'register'
                      ? 'Regístrate para continuar con una nueva cotización.'
                      : 'Inicia sesión o crea una cuenta para continuar con una nueva cotización.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  aria-label="Cerrar inicio de sesión"
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
                <label className="block text-slate-300">
                  Correo electrónico
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block text-slate-300">
                  Contraseña
                  <input
                    type="password"
                    autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                    minLength={authMode === 'register' ? 12 : undefined}
                    required
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500"
                  />
                </label>
                {authMode === 'register' && (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 leading-5 text-slate-300">
                    <input
                      type="checkbox"
                      required
                      checked={legalAccepted}
                      onChange={(event) => setLegalAccepted(event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-emerald-400"
                    />
                    <span>
                      Confirmo que tengo 18 años o más y acepto los <a className="text-emerald-300 underline underline-offset-2" href="/legal#terminos" target="_blank" rel="noreferrer">Términos</a> y el <a className="text-emerald-300 underline underline-offset-2" href="/legal#privacidad" target="_blank" rel="noreferrer">Aviso de privacidad</a>.
                    </span>
                  </label>
                )}
                {authError && <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/50 p-3 text-rose-300">{authError}</p>}
                <button
                  type="submit"
                  disabled={isAuthenticating || (authMode === 'register' && !legalAccepted)}
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                >
                  {isAuthenticating ? 'Procesando…' : authMode === 'register' ? 'Crear cuenta' : 'Iniciar sesión'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'register' ? 'login' : 'register');
                  setAuthError('');
                  setAuthPassword('');
                  setLegalAccepted(false);
                }}
                className="w-full rounded-lg py-2 text-xs text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              >
                {authMode === 'register' ? '¿Ya tienes cuenta? Inicia sesión' : '¿Aún no tienes cuenta? Regístrate'}
              </button>
            </section>
          </div>
        )}

        {/* MODAL CHECKOUT DE PAGO */}
        {showCheckoutModal && selectedPlanToBuy && (
          <div className="fixed inset-0 overflow-y-auto bg-slate-950/80 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-4">
            <div className="my-auto max-h-[calc(100dvh-2rem)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" /> Adquirir {selectedPlanToBuy.title}
                </h3>
                <button onClick={() => { setShowCheckoutModal(false); setLegalAccepted(false); }} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Concepto:</span>
                  <span className="font-bold text-slate-100">{selectedPlanToBuy.title}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Monto Total:</span>
                  <span className="text-base font-black text-emerald-400">${selectedPlanToBuy.price} MXN (Pago Único)</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 leading-5 text-slate-200">
                  <input
                    id="checkout-legal-acceptance"
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(event) => setLegalAccepted(event.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  />
                  <span>
                    Confirmo que tengo 18 años o más y acepto los <a className="text-emerald-300 underline underline-offset-2" href="/legal#terminos" target="_blank" rel="noreferrer">Términos</a>. He leído el <a className="text-emerald-300 underline underline-offset-2" href="/legal#privacidad" target="_blank" rel="noreferrer">Aviso de privacidad</a>.
                  </span>
                </label>
                {!legalAccepted && (
                  <p className="text-[11px] text-emerald-200/90">
                    Marca la casilla para habilitar la compra.
                  </p>
                )}
                {!account ? (
                  isCheckingSession ? (
                    <p className="text-slate-400 py-3">Comprobando tu sesión...</p>
                  ) : (
                    <form onSubmit={handleAuthSubmit} className="space-y-3">
                      <p className="text-slate-400 text-[11px]">
                        {authMode === 'register'
                          ? 'Crea una cuenta para asociar tu compra.'
                          : 'Inicia sesión para asociar tu compra a tu cuenta.'}
                      </p>
                      <label className="block text-slate-300">
                        Correo electrónico
                        <input
                          type="email"
                          autoComplete="email"
                          required
                          value={authEmail}
                          onChange={(event) => setAuthEmail(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
                        />
                      </label>
                      <label className="block text-slate-300">
                        Contraseña
                        <input
                          type="password"
                          autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                          minLength={authMode === 'register' ? 12 : undefined}
                          required
                          value={authPassword}
                          onChange={(event) => setAuthPassword(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
                        />
                      </label>
                      {authError && <p role="alert" className="text-rose-400">{authError}</p>}
                      <button
                        type="submit"
                        disabled={isAuthenticating || (authMode === 'register' && !legalAccepted)}
                        className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-extrabold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isAuthenticating
                          ? 'Validando cuenta...'
                          : authMode === 'register'
                            ? 'Crear cuenta'
                            : 'Iniciar sesión'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'register' ? 'login' : 'register');
                          setAuthError('');
                        }}
                        className="w-full py-2 text-slate-400 transition-colors hover:text-slate-200"
                      >
                        {authMode === 'register'
                          ? '¿Ya tienes cuenta? Inicia sesión'
                          : '¿Aún no tienes cuenta? Crear cuenta'}
                      </button>
                    </form>
                  )
                ) : (
                  <>
                    <p className="text-slate-400 text-[11px]">
                      Pagar como <span className="text-slate-200">{account.email}</span>
                    </p>
                    <button
                      onClick={handleMercadoPagoPayment}
                      disabled={isCheckingOut || !legalAccepted}
                      className="w-full p-3 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl text-slate-200 font-medium text-left flex flex-col gap-1 transition-all disabled:cursor-wait disabled:opacity-60"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs">Tarjeta / SPEI</span>
                      <span className="text-[9px] text-slate-500">
                        {isCheckingOut ? 'Conectando con Mercado Pago...' : 'Checkout Mercado Pago'}
                      </span>
                    </button>
                  </>
                )}
                {checkoutError && <p role="alert" className="text-rose-400">{checkoutError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Modal Firma Digital */}
        {showSignatureModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-100">Firma en Pantalla ({signatureTarget === 'client' ? 'Cliente' : 'Emisor'})</h3>
                <button onClick={() => setShowSignatureModal(false)} className="text-slate-400 hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white rounded-2xl p-2 border-2 border-slate-700 touch-none">
                <canvas 
                  ref={canvasRef}
                  width={340}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-40 cursor-crosshair bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={clearCanvas}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 rounded-xl text-xs"
                >
                  Limpiar
                </button>
                <button 
                  onClick={saveSignature}
                  className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold py-2 rounded-xl text-xs shadow-lg shadow-emerald-500/20"
                >
                  Guardar Firma
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
      <footer className="print:hidden mx-auto flex max-w-5xl flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-800 px-4 py-6 text-xs text-slate-400">
        <a className="hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" href="/legal#terminos">Términos</a>
        <a className="hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" href="/legal#privacidad">Privacidad</a>
        <a className="hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" href="/legal#cookies">Cookies y almacenamiento</a>
        <a className="hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" href="/legal#compras">Compras y reembolsos</a>
        <a className="hover:text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" href="mailto:TU_CORREO@gmail.com">Contacto</a>
      </footer>
    </div>
  );
}