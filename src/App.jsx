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
  ArrowLeft,
  Cpu,
  Bot
} from 'lucide-react';
import { CATALOG_CATEGORIES, catalogItemsToQuoteLines, suggestCatalogCategory } from './catalog-import.js';

// Catálogo expandido de motores de Inteligencia Artificial
const AI_MODELS = [
  { id: 'antigravity-v1', name: 'Google Antigravity Engine', provider: 'Google', badge: 'Agentic AI' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', provider: 'Google', badge: 'Ultrarrápido' },
  { id: 'gpt-4o', name: 'ChatGPT (GPT-4o)', provider: 'OpenAI', badge: 'Multimodal' },
  { id: 'gpt-4o-mini', name: 'ChatGPT (GPT-4o Mini)', provider: 'OpenAI', badge: 'Económico' },
  { id: 'o3-mini', name: 'ChatGPT (o3-mini)', provider: 'OpenAI', badge: 'Razonamiento' },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', badge: 'Híbrido Avanzado' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', badge: 'Alta Precisión' },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', badge: 'Eficiencia' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', badge: 'Lógica Compleja' },
  { id: 'llama-3.3-70b', name: 'Meta Llama 3.3 70B', provider: 'Meta', badge: 'Open Source' },
  { id: 'grok-2', name: 'xAI Grok 2', provider: 'xAI', badge: 'Contexto Actual' }
];

async function readApiResponse(response, fallbackMessage) {
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`\${fallbackMessage} El servidor respondió con un formato inesperado (HTTP \${response.status}).`);
    }
  }

  if (!response.ok) {
    const diagnostic = data.diagnostic;
    const diagnosticDetails = diagnostic
      ? [
        `HTTP \${diagnostic.status}`,
        diagnostic.errorCode,
        diagnostic.providerMessage,
        ...(Array.isArray(diagnostic.causes)
          ? diagnostic.causes.map((cause) => [cause.code, cause.description].filter(Boolean).join(': '))
          : [])
      ].filter(Boolean).join(' | ')
      : '';
    const message = data.error || `${fallbackMessage} (HTTP${response.status}).`;
    throw new Error(diagnosticDetails ? `\${message} Diagnóstico de Mercado Pago: \${diagnosticDetails}` : message);
  }

  if (!responseText) {
    throw new Error(`\${fallbackMessage} El servidor devolvió una respuesta vacía.`);
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
  const [activeTab, setActiveTab] = useState('quotes'); // 'quotes' | 'clients' | 'catalog' | 'settings' | 'plans'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'editor' | 'preview' | 'client_web'
  const [statusFilter, setStatusFilter] = useState('todos');

  // Estado para la Selección de Motor IA
  const [selectedAiModel, setSelectedAiModel] = useState(() => localStorage.getItem('cotiq_ai_model') || 'gemini-3.1-flash-lite');

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
    name: '',
    tagline: '',
    phone: '',
    email: '',
    rfc: '',
    address: '',
    bank: '',
    clabe: '',
    bankHolder: '',
    logo: '',
    defaultTerms: ''
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
      const savedModel = localStorage.getItem('cotiq_ai_model');

      if (savedModel) setSelectedAiModel(savedModel);
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

  const handleSelectAiModel = (modelId) => {
    setSelectedAiModel(modelId);
    localStorage.setItem('cotiq_ai_model', modelId);
    const modelObj = AI_MODELS.find(m => m.id === modelId);
    notify(`IA activada: \${modelObj?.name || modelId}`);
  };

  const handleCatalogFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const activeModelObj = AI_MODELS.find(m => m.id === selectedAiModel) || AI_MODELS[1];
    setCatalogImportError('');
    setCatalogImportProgress(`Procesando lectura con \${activeModelObj.name}…`);
    setIsImportingCatalog(true);
    try {
      const { importCatalogFile } = await import('./catalog-file-reader.js');
      const items = await importCatalogFile(file, setCatalogImportProgress, selectedAiModel);
      const newCandidates = items.map((item, index) => ({
        ...item,
        draftId: `${Date.now()}-${index}`
      }));

      setCatalogImportCandidates((prevCandidates) => [
        ...(Array.isArray(prevCandidates) ? prevCandidates : []),
        ...newCandidates
      ]);
      notify(`Se reconocieron ${newCandidates.length} concepto(s) con${activeModelObj.name}.`);
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

    const activeModelObj = AI_MODELS.find(m => m.id === selectedAiModel) || AI_MODELS[1];
    setQuoteImportError('');
    setQuoteImportProgress(`Procesando partidas con \${activeModelObj.name}…`);
    setIsImportingQuote(true);
    try {
      const { importCatalogFile } = await import('./catalog-file-reader.js');
      const items = await importCatalogFile(file, setQuoteImportProgress, selectedAiModel);
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
      notify(`Se agregaron ${quoteLines.length} partidas procesadas por${activeModelObj.name}.`);
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
      setCatalogImportError('No se pudieron guardar los conceptos en este dispositivo.');
      return;
    }
    setCatalog(updated);
    setCatalogImportCandidates([]);
    setCatalogImportError('');
    notify(`\${importedItems.length} conceptos agregados al catálogo`);
  };

  const handleClearAllStorage = () => {
    if (confirm("¿Deseas restablecer todos los datos guardados para iniciar 100% desde cero?")) {
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
        if (active) setAuthError('No se pudo comprobar la sesión.');
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
            notify('Conexión recuperada. Inicia sesión para validar borradores.');
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
            notify('Inicia sesión con la cuenta correspondiente.');
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
            return;
          }
          if (response.status === 402) break;

          const result = await readApiResponse(response, 'No se pudo validar el crédito.');

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
        }
      } catch (error) {
        console.error('Error al sincronizar borradores offline:', error);
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

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (!isOnline) {
      setAuthError('El inicio de sesión requiere conexión a internet.');
      return;
    }
    setIsAuthenticating(true);
    setAuthError('');

    try {
      const response = await fetch(`/api/auth/\${authMode === 'register' ? 'register' : 'login'}`, {
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
          notify('Sesión iniciada. Activa un paquete de créditos para cotizar.');
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
    if (!selectedPlanToBuy || !isOnline || !account) return;
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
      const data = await readApiResponse(response, 'No se pudo crear el pago.');
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (error) {
      setCheckoutError(error.message || 'Error con el servidor de pagos.');
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
        alert(error.message || 'No se pudo validar tu licencia.');
        setActiveTab('plans');
        return;
      }
      updated = [activeQuote, ...quotes];
    }
    saveQuotesList(updated);
    notify(`Documento \${activeQuote.id} guardado con éxito`);
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

  // NUEVO: PROCESAMIENTO DE TEXTO ENVIADO A LA API REAL (GATEWAY UNIFICADO / VERCEL)
  const handleProcessSmartPrompt = async () => {
    if (!smartPromptText.trim()) return;

    const activeModelObj = AI_MODELS.find(m => m.id === selectedAiModel);
    notify(`Procesando con \${activeModelObj?.name || 'IA'}...`);

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

      // Limpieza del JSON retornado por la IA (para evitar problemas de formato)
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
    saveQuotesList(updated);
    setActiveQuote(cloned);
    setViewMode('editor');
    notify(`Cotización duplicada como ${cloned.id}`);
  };

  const handleDeleteQuote = (quoteId) => {
    if (window.confirm(`¿Deseas eliminar permanentemente la cotización ${quoteId}?`)) {
      const updated = quotes.filter((q) => q.id !== quoteId);
      saveQuotesList(updated);
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
      `${Number(activeQuote.discount) > 0 ? `Subtotal bruto: \$\${grossSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\nDescuento (${activeQuote.discount}\%): -$\${discountVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` : ''}` +
      `Subtotal: $${netSubtotal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` +
      `${activeQuote.includeIVA ? `IVA (16%): \$\${ivaVal.toLocaleString('es-MX', {minimumFractionDigits: 2})}\n` : ''}` +
      `💰 *TOTAL: $${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN*\n` +
      `💵 *Anticipo (${activeQuote.advancePercent}%): $${advanceVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN*`;

    const cleanPhone = (activeQuote.clientPhone || '').replace(/\D/g, '');
    const url = cleanPhone ? `https://wa.me/52${cleanPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const activeModelInfo = AI_MODELS.find(m => m.id === selectedAiModel) || AI_MODELS[1];

  return (
    <div className="cotiq-light min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-slate-800 pb-12">
      
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-100 text-slate-950 font-semibold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" /> {toast}
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
                  \${totalCotizadoSum.toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-xs font-normal text-slate-500">MXN</span>
                </span>
              </div>
              <div className="cotiq-stat bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Monto Aprobado / Cerrado</span>
                <span className="text-xl font-bold text-emerald-400">
                  \${totalAprobadoSum.toLocaleString('es-MX', {minimumFractionDigits: 2})} <span className="text-xs font-normal text-slate-500">MXN</span>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(quotes || []).map((q) => {
                const sub = (q?.items || []).reduce((acc, i) => acc + (Number(i?.quantity||0) * Number(i?.unitPrice||0)), 0);
                const disc = (sub * (Number(q?.discount) || 0)) / 100;
                const net = sub - disc;
                const tot = net + (q?.includeIVA ? net * 0.16 : 0);

                return (
                  <div key={q.id} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex justify-between items-start gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-100">{q.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400">
                          {q?.type || 'Cotización'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium">{q?.clientName || 'Cliente sin nombre'}</p>
                      <p className="text-[11px] text-slate-500">{q?.date}</p>
                    </div>

                    <div className="text-right space-y-2">
                      <p className="text-sm font-bold text-slate-100">\${tot.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setActiveQuote(q); setViewMode('editor'); }} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold">Editar</button>
                        <button onClick={() => { setActiveQuote(q); setViewMode('preview'); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">PDF</button>
                        <button onClick={() => handleDeleteQuote(q.id)} className="bg-slate-800 hover:bg-rose-900/50 text-slate-400 p-1.5 rounded-lg text-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ==================== EDITOR DE COTIZACIÓN ==================== */}
        {activeTab === 'quotes' && viewMode === 'editor' && (
          <div className="space-y-6">
            
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewMode('list')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl text-xs font-semibold">
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
                <button onClick={handleSaveActiveQuote} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl font-semibold">Guardar</button>
                <button onClick={() => setViewMode('preview')} className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs rounded-xl font-bold flex items-center gap-1 shadow-lg shadow-emerald-500/20">
                  <Eye className="w-3.5 h-3.5" /> Ver PDF
                </button>
              </div>
            </div>

            {/* GENERADOR EXPRESS CON SELECTOR DE MODELOS IA */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Generador Express por Texto o Voz
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Motor IA:
                  </span>
                  <select
                    value={selectedAiModel}
                    onChange={(e) => handleSelectAiModel(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    {AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.badge})
                      </option>
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
                    {isListening ? 'Escuchando...' : 'Dictar'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder='Ej: "2 minisplit a 3200 pesos, 50 m2 de tablaroca a 420 pesos"'
                  value={smartPromptText}
                  onChange={(e) => setSmartPromptText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProcessSmartPrompt()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleProcessSmartPrompt}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex-shrink-0 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generar con {activeModelInfo.name.split(' ')[0]}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Procesando con <span className="text-emerald-300 font-semibold">{activeModelInfo.name}</span> ({activeModelInfo.provider}).
              </p>
            </div>

            {/* Datos del Cliente */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block">Datos del Cliente</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <input type="text" placeholder="Nombre del Cliente" value={activeQuote.clientName} onChange={(e) => setActiveQuote({ ...activeQuote, clientName: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none" />
                <input type="text" placeholder="Teléfono" value={activeQuote.clientPhone} onChange={(e) => setActiveQuote({ ...activeQuote, clientPhone: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-100 focus:outline-none" />
              </div>
            </div>

            {/* Partidas con Carga de PDF por IA */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">2. Partidas y Precios Unitarios</span>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={quoteFileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,application/pdf,image/jpeg,image/png,image/webp,image/bmp"
                    onChange={handleQuoteFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isImportingQuote}
                    onClick={() => quoteFileInputRef.current?.click()}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-60"
                  >
                    <span className="flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      {isImportingQuote ? 'Leyendo…' : `Leer PDF con ${activeModelInfo.name.split(' ')[0]}`}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveQuote({
                      ...activeQuote,
                      items: [...(activeQuote.items || []), { id: Date.now(), quantity: 1, unit: 'Servicio', description: '', unitPrice: '' }]
                    })}
                    className="text-xs text-emerald-400 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Partida
                  </button>
                </div>
              </div>

              {(activeQuote.items || []).map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 items-center">
                  <div className="col-span-2 sm:col-span-1">
                    <input type="number" value={item.quantity} onChange={(e) => setActiveQuote({ ...activeQuote, items: activeQuote.items.map(i => i.id === item.id ? { ...i, quantity: e.target.value } : i) })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-center text-slate-100" />
                  </div>
                  <div className="col-span-7 sm:col-span-8">
                    <input type="text" placeholder="Descripción" value={item.description} onChange={(e) => setActiveQuote({ ...activeQuote, items: activeQuote.items.map(i => i.id === item.id ? { ...i, description: e.target.value } : i) })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-slate-100" />
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    <input type="number" placeholder="\$ 0.00" value={item.unitPrice} onChange={(e) => setActiveQuote({ ...activeQuote, items: activeQuote.items.map(i => i.id === item.id ? { ...i, unitPrice: e.target.value } : i) })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-right text-slate-100" />
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen Final */}
            <div className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-800 rounded-2xl text-xs">
              <span className="text-slate-400">Total Final</span>
              <span className="text-lg font-bold text-slate-100">\${totalVal.toLocaleString('es-MX', {minimumFractionDigits: 2})} MXN</span>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}