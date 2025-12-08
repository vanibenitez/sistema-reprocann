import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, FileText, CheckCircle, Clock, Search, Copy, 
  LogOut, Database, Stethoscope, ChevronLeft, ChevronRight, Save,
  AlertCircle, FileCheck, Brain, X, Plus, Loader,
  Settings, Link as LinkIcon, RefreshCw, Info, Eye, HeartPulse, Activity, ShieldAlert, Sparkles, BookOpen
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  updateDoc
} from 'firebase/firestore';

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAUD1Ve1O7IFfMpUMo6pbMNEiK-VvLWG-g",
  authDomain: "sistema-doctora.firebaseapp.com",
  projectId: "sistema-doctora",
  storageBucket: "sistema-doctora.firebasestorage.app",
  messagingSenderId: "691641796580",
  appId: "1:691641796580:web:82374ff9323d338930a9f1",
  measurementId: "G-MCWHDL1YGL"
};

// --- TEXTOS POR DEFECTO ---
const DEFAULT_RECIPE = "Cannabis Medicinal Quimiotipo III (RATIO 3:1) - 9 Plantas en Floración - 1 a 3 Gotas diarias durante 12 Meses. Se sugiere realizar Análisis Cromatográfico de Muestra. USO ADULTO Y RESPONSABLE";
const DEFAULT_JUSTIFICATION = "Tratamiento Coadyuvante";

const DIAGNOSIS_OPTIONS = [
  "Ansiedad", "Artrosis", "Artritis Reumatoide", "Asma Bronquial", 
  "Bruxismo", "Cefalea", "Cefalea Tensional", "Cervicalgia", 
  "Colon Irritable", "Depresión", "Dermatitis", "Dolor Crónico", 
  "Dolor Lumbar", "Dolor Neuropático", "Endometriosis", 
  "Epilepsia", "Esclerosis Múltiple", "Escoliosis", 
  "Espasticidad", "Estrés", "Fibromialgia", "Glaucoma", 
  "Hernia de Disco", "Hipertensión", "Insomnio", 
  "Lumbalgia", "Lumbociatalgia", "Migraña", 
  "Neuralgia del Trigémino", "Neuropatía Periférica", 
  "Parkinson", "Psoriasis", "Síndrome de Fatiga Crónica", 
  "Trastorno del Espectro Autista", "Trastorno de Ansiedad Generalizada",
  "Traumatismo", "Otro"
];

// --- URL FIJA DE APPS SCRIPT ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwy_Snpp8yZMHufiQxzv2eRPDd7QgIK8YxYItREfWqF0Mp14JT6dcsLJCqfpIyhZXyxhg/exec";

// --- DICCIONARIO PARA FICHA COMPLETA (LIMPIO) ---
const FIELD_LABELS = {
  dni: "DNI",
  name: "Nombre Completo",
  reprocannCode: "Código Reprocann",
  patologia: "Patología / Motivo",
  afflictionTime: "Tiempo Afección",
  priorTreatment: "Tratamiento Previo",
  medication: "Otras Medicaciones",
  cardiac: "Enf. Cardíacas",
  psych: "Trat. Psicológico",
  cannabisUse: "Uso Cannabis",
  age: "Edad",
  sex: "Sexo",
  location: "Localidad",
  province: "Provincia",
  occupation: "Ocupación",
  allergies: "Alergias",
  background: "Antecedentes Grales",
  sleepHours: "Horas de Sueño",
  drives: "Maneja",
  pregnancy: "Embarazo/Lactancia",
  hasSignature: "Firma Digital",
  paymentProofUrl: "Comprobante Pago",
  entryDate: "Fecha Ingreso",
  statusConsultation: "Estado Consulta",
  statusUpload: "Estado Carga"
};

// --- SERVICIO API ---
const apiService = {
  getPatients: async () => {
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getPatients`);
      const json = await response.json();
      if (json.status === 'success') return json.data;
      throw new Error(json.message || "Error al obtener pacientes");
    } catch (e) {
      console.error("API Error (Get):", e);
      throw e;
    }
  },
  saveConsultation: async (data) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveConsultation', ...data })
      });
      const json = await response.json();
      if (json.status !== 'success') throw new Error(json.message);
      return json;
    } catch (e) {
      console.error("API Error (Save):", e);
      throw e;
    }
  },
  updateStatus: async (dni, status) => {
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateStatus', dni, status })
      });
      const json = await response.json();
      if (json.status !== 'success') throw new Error(json.message);
      return json;
    } catch (e) {
      console.error("API Error (Status):", e);
      throw e;
    }
  }
};

// --- COMPONENTES UI ---

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    'Pendiente': 'bg-orange-100 text-orange-700 border-orange-200',
    'Completando': 'bg-blue-100 text-blue-700 border-blue-200',
    'Completado': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Cargado': 'bg-gray-100 text-gray-700 border-gray-200',
    'Incompleto': 'bg-red-50 text-red-700 border-red-100',
    'Pendiente de Carga': 'bg-purple-100 text-purple-700 border-purple-200'
  };
  
  let label = status;
  if(status === 'Incompleto') label = 'Pendiente Atención';
  if(status === 'Pendiente de Carga') label = 'Para Cargar';

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles['Pendiente']}`}>
      {label}
    </span>
  );
};

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, title = '' }) => {
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    secondary: "bg-white text-teal-700 border border-teal-200 hover:bg-teal-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    ghost: "text-gray-600 hover:bg-gray-100 shadow-none",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ai: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 border-none",
  };
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50 ${variants[variant]} ${className}`} disabled={disabled}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const CopyField = ({ label, value, multiline = false }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!value) return;
    const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    const textArea = document.createElement("textarea");
    textArea.value = valStr;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  let displayValue = value;
  if (typeof value === 'object' && value !== null) {
    displayValue = JSON.stringify(value);
  }

  return (
    <div className="mb-4 group">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <button onClick={handleCopy} className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 opacity-0 group-hover:opacity-100'}`}>
          {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className={`bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-800 ${multiline ? 'whitespace-pre-wrap' : 'truncate'}`}>
        {displayValue || <span className="text-gray-400 italic">Sin datos</span>}
      </div>
    </div>
  );
};

const Notification = ({ message, type, onClose }) => {
  if (!message) return null;
  const styles = { success: "bg-emerald-100 border-emerald-500 text-emerald-800", error: "bg-red-100 border-red-500 text-red-800" };
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border-l-4 flex items-center gap-3 animate-bounce-in ${styles[type]}`}>
      {type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2"><X size={16}/></button>
    </div>
  );
};

const Modal = ({ isOpen, title, children, onClose, onConfirm, confirmText = "Confirmar", confirmColor = "teal", size = "md" }) => {
  if (!isOpen) return null;
  const colors = { teal: "bg-teal-600 hover:bg-teal-700", red: "bg-red-600 hover:bg-red-700", blue: "bg-blue-600 hover:bg-blue-700" };
  const sizes = { md: "max-w-2xl", lg: "max-w-4xl" };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${sizes[size]} overflow-hidden max-h-[90vh] overflow-y-auto`}>
        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-6">{children}</div>
        {onConfirm && (
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">Cancelar</button>
            <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg shadow-md ${colors[confirmColor]}`}>{confirmText}</button>
          </div>
        )}
      </div>
    </div>
  );
};

const MultiSelectDiagnosis = ({ selected = [], onChange }) => {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const availableOptions = DIAGNOSIS_OPTIONS.filter(opt => !selected.includes(opt) && opt.toLowerCase().includes(input.toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-bold text-gray-700 mb-1">Diagnóstico (Selección Múltiple)</label>
      <div className="flex flex-wrap gap-2 p-2 bg-white border border-gray-300 rounded-lg min-h-[46px] focus-within:ring-2 focus-within:ring-teal-500">
        {selected.map(diag => (
          <span key={diag} className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
            {diag} <button onClick={() => onChange(selected.filter(d => d !== diag))} className="hover:text-teal-900"><X size={12}/></button>
          </span>
        ))}
        <input type="text" className="flex-1 outline-none text-sm min-w-[120px] bg-transparent" placeholder={selected.length === 0 ? "Escriba para buscar..." : ""} value={input} onChange={e => { setInput(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} />
      </div>
      {isOpen && input.length > 0 && availableOptions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {availableOptions.map(opt => (
            <li key={opt} onClick={() => { onChange([...selected, opt]); setInput(''); setIsOpen(false); }} className="px-4 py-2 hover:bg-teal-50 cursor-pointer text-sm text-gray-700 flex justify-between items-center group">
              {opt} <Plus size={14} className="opacity-0 group-hover:opacity-100 text-teal-500"/>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- UTILS & LOGICA DE RESUMEN ACTUALIZADA ---
const cleanText = (text) => {
  if (!text || text === '#N/A' || text === '-') return '';
  return String(text).trim();
};

const generateAutoSummary = (p) => {
  if (!p) return "";
  
  const s = p.sex || "Indeterminado";
  const e = p.age || "?";
  const o = cleanText(p.occupation) || "Ocupación no referida";
  const pat = getPathologyText(p);
  
  let alergias = "Alergias (-)";
  const rawAlergias = cleanText(p.allergies);
  if (rawAlergias && !['NO', 'NINGUNA', 'NINGUNO', 'NI GUNA', '0'].includes(rawAlergias.toUpperCase())) {
    alergias = `Alergias: ${rawAlergias}`;
  }

  const embarazo = cleanText(p.pregnancy);
  const antecedentes = cleanText(p.background);
  const cardiac = cleanText(p.cardiac);
  const psych = cleanText(p.psych);
  const cannabis = cleanText(p.cannabisUse);
  const tiempo = cleanText(p.afflictionTime);

  let resumen = `Paciente ${s} de ${e} años de edad. ${o}. ${alergias}. `;
  
  if (embarazo && !['NO', '0'].includes(embarazo.toUpperCase())) resumen += `Embarazo/Lactancia: ${embarazo}. `;
  
  let antStr = "";
  if (antecedentes && !['NO', 'NINGUNO'].includes(antecedentes.toUpperCase())) antStr += `${antecedentes}. `;
  if (cardiac && !['NO', 'NINGUNO'].includes(cardiac.toUpperCase())) antStr += `Antecedentes Cardíacos: ${cardiac}. `;
  if (psych && !['NO', 'NINGUNO'].includes(psych.toUpperCase())) antStr += `Tratamiento Psicológico/Psiquiátrico: ${psych}. `;
  
  if (antStr) resumen += `Antecedentes: ${antStr} `;
  else resumen += "Sin antecedentes médicos de relevancia. ";

  resumen += `Refiere: ${pat}. `;
  
  if (tiempo) resumen += `Evolución: ${tiempo}. `;
  if (cannabis && !['NO', 'NINGUNO'].includes(cannabis.toUpperCase())) resumen += `Uso previo de cannabis: ${cannabis}.`;

  return resumen.replace(/\s+/g, ' ').trim();
};

const getPathologyText = (p) => {
  return cleanText(p.patologia || p.pathology || p.Patologia || p.Patología || "");
};

const aiSuggest = (pathology) => {
  const text = (pathology || '').toLowerCase();
  if (text.includes('ansiedad') || text.includes('pánico') || text.includes('nervios')) return { diag: ['Trastorno de Ansiedad Generalizada'], symp: 'Taquicardia, sudoración, insomnio, nerviosismo.' };
  if (text.includes('espalda') || text.includes('lumbar') || text.includes('cintura')) return { diag: ['Lumbalgia', 'Dolor Crónico'], symp: 'Dolor punzante lumbar, rigidez matutina.' };
  if (text.includes('migraña') || text.includes('cabeza')) return { diag: ['Migraña'], symp: 'Fotofobia, dolor pulsátil, náuseas.' };
  if (text.includes('insomnio') || text.includes('sueño')) return { diag: ['Insomnio'], symp: 'Dificultad para conciliar el sueño.' };
  if (text.includes('rodilla') || text.includes('articulación') || text.includes('artrosis')) return { diag: ['Artrosis', 'Dolor Crónico'], symp: 'Dolor articular, rigidez, limitación funcional.' };
  return { diag: ['Dolor Crónico'], symp: 'Dolor persistente refractario a tratamiento convencional.' };
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("es-AR", { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return String(dateStr); }
};

// --- DOCTOR DASHBOARD ---
const DoctorDashboard = ({ patients, onUpdatePatient, loading, completedHistory }) => {
  const [activeTab, setActiveTab] = useState('pendientes');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', children: null, size: 'md' });
  const [showFullInfo, setShowFullInfo] = useState(false);

  const [formData, setFormData] = useState({ clinicalSummary: '', diagnoses: [], symptoms: '', treatment: '', justification: '', recipe: '' });

  useEffect(() => {
    if (selectedPatient) {
      let draft = cleanText(selectedPatient.treatment);
      let ad = cleanText(selectedPatient.priorTreatment);
      let n = cleanText(selectedPatient.medication);
      
      let finalTreatment = draft;
      if (!finalTreatment && ad && ad !== '#N/A') finalTreatment = ad;
      if (!finalTreatment && n && n !== '#N/A') finalTreatment = n;

      let diags = [];
      if (selectedPatient.diagnosis) diags = selectedPatient.diagnosis.split(',').map(d => d.trim()).filter(Boolean);

      setFormData({
        clinicalSummary: selectedPatient.clinicalSummary || generateAutoSummary(selectedPatient),
        diagnoses: diags,
        symptoms: selectedPatient.symptoms || '',
        treatment: finalTreatment,
        justification: selectedPatient.justification || DEFAULT_JUSTIFICATION,
        recipe: selectedPatient.recipe || DEFAULT_RECIPE
      });
    }
  }, [selectedPatient]);

  const showNotification = (msg, type = 'success') => {
    setNotification({ message: msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- FUNCIÓN DE COPIAR RESUMEN ---
  const copyToClipboard = (text) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification("Resumen copiado al portapapeles", "success");
  };

  const handleAISuggest = () => {
    const pathologyText = getPathologyText(selectedPatient);
    const sug = aiSuggest(pathologyText);
    
    // Buscar pacientes similares
    const similarPatients = completedHistory.filter(p => {
       const pText = getPathologyText(p).toLowerCase();
       const currentText = pathologyText.toLowerCase();
       // Si hay al menos 1 palabra clave de 5+ letras que coincida
       const keywords = currentText.split(' ').filter(w => w.length > 4);
       return keywords.some(k => pText.includes(k)) && p.clinicalSummary;
    }).slice(0, 4); 

    setModalConfig({
      isOpen: true, 
      title: "🧠 Asistente & Casos Similares",
      size: "lg", // Hacemos el modal más grande
      children: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Columna Izquierda: Sugerencia Automática */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-700 border-b pb-2">Diagnóstico Sugerido</h4>
            <div className="bg-violet-50 p-4 rounded-xl border border-violet-100">
              <div className="text-sm space-y-2">
                 <p><span className="font-bold text-violet-700">Diagnósticos:</span> {sug.diag.join(', ')}</p>
                 <p><span className="font-bold text-violet-700">Síntomas:</span> {sug.symp}</p>
              </div>
              <button 
                onClick={() => { 
                  setFormData(prev => ({...prev, diagnoses: [...new Set([...prev.diagnoses, ...sug.diag])], symptoms: sug.symp})); 
                  setModalConfig({isOpen:false}); 
                  showNotification("Sugerencia aplicada"); 
                }}
                className="mt-3 w-full bg-violet-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-violet-700 flex items-center justify-center gap-2"
              >
                <Plus size={16}/> Aplicar Estos Valores
              </button>
            </div>
            
            <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 italic">
               Basado en la patología del paciente: "{pathologyText}"
            </div>
          </div>

          {/* Columna Derecha: Historial de Casos Reales */}
          <div className="space-y-4 border-l pl-6 border-gray-100">
             <h4 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
               <BookOpen size={16}/> Casos Similares (Historial)
             </h4>
             
             {similarPatients.length > 0 ? (
               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                 {similarPatients.map((p, idx) => (
                   <div key={idx} className="border border-gray-200 p-3 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{p.name}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{getPathologyText(p)}</p>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(p.clinicalSummary)}
                          className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded border border-teal-100 hover:bg-teal-100 flex items-center gap-1"
                          title="Copiar Resumen HC"
                        >
                          <Copy size={12}/> Copiar HC
                        </button>
                     </div>
                     <div className="bg-gray-100 p-2 rounded text-xs text-gray-700 mb-1 max-h-20 overflow-hidden text-ellipsis">
                       {p.clinicalSummary}
                     </div>
                     <div className="text-xs text-teal-700 mt-1">
                       <strong>Tx:</strong> {p.treatment}
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-sm text-gray-400 italic">No se encontraron casos similares previos.</p>
             )}
          </div>
        </div>
      )
    });
  };

  const initiateSave = (type) => {
    const statusToSend = type === 'Borrador' ? 'Incompleto' : 'Completado';
    setModalConfig({
      isOpen: true, title: type === 'Borrador' ? "Guardar Borrador" : "Finalizar Consulta",
      children: (<p className="text-gray-600">{type === 'Borrador' ? "Se guardarán los cambios y el paciente seguirá en tu lista de pendientes." : "Se marcará como COMPLETADO y pasará al área administrativa. Se actualizará la hoja de consentimiento."}</p>),
      onConfirm: () => executeSave(statusToSend)
    });
  };

  const executeSave = async (status) => {
    setModalConfig({ isOpen: false });
    setIsSaving(true);
    try {
      await onUpdatePatient({ ...formData, diagnosis: formData.diagnoses.join(', '), statusConsultation: status, dni: selectedPatient.dni, name: selectedPatient.name });
      showNotification(status === 'Completado' ? "Consulta Finalizada Exitosamente" : "Borrador guardado");
      if (status === 'Completado') setSelectedPatient(null);
    } catch (error) {
      showNotification("Error al guardar", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingPatients = useMemo(() => patients.filter(p => {
    const name = cleanText(p.name);
    if (!name || name.length < 3 || ['Nombre', '#N/A'].includes(name)) return false;
    
    const status = p.statusConsultation ? String(p.statusConsultation).trim() : 'Incompleto';
    const upload = p.statusUpload ? String(p.statusUpload).trim() : 'Pendiente de Carga';
    return (status === 'Incompleto' || status === 'Completando') && upload === 'Pendiente de Carga';
  }), [patients]);

  const completedPatients = useMemo(() => patients.filter(p => p.statusConsultation === 'Completado'), [patients]);
  
  const filteredHistory = useMemo(() => completedPatients.filter(p => {
     const name = cleanText(p.name).toLowerCase();
     const dni = cleanText(p.dni);
     const search = searchTerm.toLowerCase();
     return name.includes(search) || dni.includes(search);
  }), [completedPatients, searchTerm]);

  if (selectedPatient) {
    const pathologyText = getPathologyText(selectedPatient);

    return (
      <div className="flex flex-col h-full animate-fadeIn relative">
        {notification && <Notification {...notification} onClose={() => setNotification(null)} />}
        <Modal isOpen={modalConfig.isOpen} title={modalConfig.title} size={modalConfig.size} onClose={() => setModalConfig({...modalConfig, isOpen: false})} onConfirm={modalConfig.onConfirm} confirmText="Confirmar" confirmColor="teal">{modalConfig.children}</Modal>
        
        <Modal isOpen={showFullInfo} title={`Ficha: ${selectedPatient.name}`} onClose={() => setShowFullInfo(false)}>
          <div className="grid grid-cols-1 gap-2 text-sm max-h-[60vh] overflow-y-auto">
            {Object.keys(FIELD_LABELS).map(key => (
              <div key={key} className="flex justify-between border-b pb-1">
                <span className="font-bold text-gray-500">{FIELD_LABELS[key]}</span>
                <span className="text-right max-w-[60%] break-words">{key === 'entryDate' ? formatDate(selectedPatient[key]) : String(selectedPatient[key] || '-')}</span>
              </div>
            ))}
          </div>
        </Modal>

        {isSaving && <div className="absolute inset-0 bg-white/80 z-40 flex flex-col items-center justify-center"><Loader className="animate-spin text-teal-600 mb-2"/><p className="text-teal-800 font-bold">Procesando...</p></div>}

        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" onClick={() => setSelectedPatient(null)} icon={ChevronLeft} className="rotate-0">Volver</Button>
          <h2 className="text-xl font-bold text-gray-800">Consulta: {selectedPatient.name}</h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-4 space-y-4">
            <Card className="bg-slate-50 border-slate-200 h-full max-h-[85vh] overflow-y-auto">
              <div className="p-4 border-b bg-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><User size={18}/> Datos Paciente</h3>
                <button onClick={() => setShowFullInfo(true)} className="text-teal-600 hover:text-teal-800 flex items-center gap-1 text-xs font-bold bg-white px-2 py-1 rounded border border-teal-200 shadow-sm"><Eye size={14}/> FICHA COMPLETA</button>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div><span className="text-gray-500 block text-xs">DNI</span> {selectedPatient.dni}</div>
                <div><span className="text-gray-500 block text-xs">Edad / Sexo</span> {selectedPatient.age} años / {selectedPatient.sex}</div>
                
                <div className="bg-red-50 p-2 rounded border border-red-100">
                  <span className="text-red-500 font-bold block text-xs">Patología / Motivo</span>
                  <p className="italic text-gray-700">{pathologyText}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-orange-50 p-2 rounded border border-orange-100">
                      <span className="text-orange-700 font-bold block text-xs flex items-center gap-1"><HeartPulse size={10}/> Cardíaco</span>
                      <p className="text-gray-800 text-xs">{cleanText(selectedPatient.cardiac) || '-'}</p>
                   </div>
                   <div className="bg-purple-50 p-2 rounded border border-purple-100">
                      <span className="text-purple-700 font-bold block text-xs flex items-center gap-1"><Brain size={10}/> Psicológico</span>
                      <p className="text-gray-800 text-xs">{cleanText(selectedPatient.psych) || '-'}</p>
                   </div>
                </div>

                <div className="bg-green-50 p-2 rounded border border-green-100">
                   <span className="text-green-700 font-bold block text-xs">Uso Cannabis</span>
                   <p className="text-gray-800 text-xs">{cleanText(selectedPatient.cannabisUse) || '-'}</p>
                </div>

                <div className="bg-indigo-50 p-2 rounded border border-indigo-100">
                   <span className="text-indigo-700 font-bold block text-xs flex items-center gap-1"><ShieldAlert size={10}/> Alergias</span>
                   <p className="text-gray-800 text-xs">{cleanText(selectedPatient.allergies) || '-'}</p>
                </div>

                <div className="bg-yellow-50 p-2 rounded border border-yellow-200">
                  <span className="text-yellow-800 font-bold block text-xs flex items-center gap-1"><Info size={12}/> Tratamiento Previo</span>
                  <p className="text-gray-900 font-medium">{cleanText(selectedPatient.priorTreatment) || "Sin datos"}</p>
                </div>
                 
                 {cleanText(selectedPatient.medication) && (
                    <div className="bg-blue-50 p-2 rounded border border-blue-100">
                       <span className="text-blue-700 font-bold block text-xs">Otras Medicaciones</span>
                       <p className="text-gray-800 text-xs">{cleanText(selectedPatient.medication)}</p>
                    </div>
                 )}
              </div>
            </Card>
          </div>

          <div className="xl:col-span-8 space-y-4">
            <Card className="h-full flex flex-col">
              <div className="p-4 border-b bg-teal-50 flex justify-between items-center">
                <h3 className="font-bold text-teal-800 flex items-center gap-2"><Stethoscope size={18}/> Historia Clínica</h3>
                <Button variant="ai" size="sm" onClick={handleAISuggest} icon={Brain}>Sugerir / Similares</Button>
              </div>
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                <MultiSelectDiagnosis selected={formData.diagnoses} onChange={d => setFormData({...formData, diagnoses: d})} />
                
                <div>
                  <div className="flex justify-between mb-1"><label className="font-bold text-sm">Resumen HC</label> <span className="text-xs text-teal-600 cursor-pointer" onClick={() => setFormData({...formData, clinicalSummary: generateAutoSummary(selectedPatient)})}>Restaurar</span></div>
                  <textarea className="w-full p-3 border rounded h-24 text-sm" value={formData.clinicalSummary} onChange={e => setFormData({...formData, clinicalSummary: e.target.value})}/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Síntomas</label><input className="w-full p-2 border rounded" value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})}/></div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Tratamiento Convencional</label>
                    <input className="w-full p-2 border rounded bg-yellow-50" value={formData.treatment} onChange={e => setFormData({...formData, treatment: e.target.value})} placeholder="Precarga Automática"/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div><label className="block text-sm font-bold mb-1">Receta</label><textarea className="w-full p-2 border rounded h-24 text-xs" value={formData.recipe} onChange={e => setFormData({...formData, recipe: e.target.value})}/></div>
                   <div><label className="block text-sm font-bold mb-1">Justificación</label><textarea className="w-full p-2 border rounded h-24 text-sm" value={formData.justification} onChange={e => setFormData({...formData, justification: e.target.value})}/></div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="secondary" onClick={() => initiateSave('Borrador')}>Guardar Borrador</Button>
                  <Button variant="primary" onClick={() => initiateSave('Completado')} icon={Save}>Finalizar</Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div><h2 className="text-2xl font-bold text-gray-800">Panel Médico</h2></div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('pendientes')} className={`px-6 py-2 rounded-md text-sm font-medium ${activeTab === 'pendientes' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Pendientes ({pendingPatients.length})</button>
          <button onClick={() => setActiveTab('historial')} className={`px-6 py-2 rounded-md text-sm font-medium ${activeTab === 'historial' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'}`}>Historial</button>
        </div>
      </div>

      {activeTab === 'pendientes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {pendingPatients.map((patient, idx) => (
            <Card key={`${patient.id}-${idx}`} className="hover:shadow-xl transition-all cursor-pointer border-l-4 border-l-red-400">
              <div className="p-5" onClick={() => setSelectedPatient(patient)}>
                <div className="flex justify-between items-start mb-3">
                  <div><h3 className="font-bold text-gray-800 text-lg">{patient.name}</h3><span className="text-xs text-gray-400">DNI {patient.dni}</span></div>
                  <Badge status={patient.statusConsultation || 'Incompleto'} />
                </div>
                <div className="bg-red-50 p-2 rounded mb-2 text-sm text-gray-700 italic line-clamp-2">{getPathologyText(patient)}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> {formatDate(patient.entryDate)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {activeTab === 'historial' && (
        <div className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-3 text-gray-400" size={20}/><input className="w-full pl-10 p-3 border rounded-xl" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs uppercase"><tr><th className="p-4">Paciente</th><th className="p-4">Diagnóstico</th><th className="p-4">Acción</th></tr></thead>
              <tbody>
                {filteredHistory.map((p, idx) => (
                  <tr key={`${p.id}-${idx}`} className="border-t hover:bg-gray-50">
                    <td className="p-4"><div>{p.name}</div><div className="text-xs text-gray-500">{p.dni}</div></td>
                    <td className="p-4 text-sm">{p.diagnosis}</td>
                    <td className="p-4"><Button variant="ghost" size="sm" onClick={() => setSelectedPatient(p)}>Ver</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = ({ patients, onUpdateStatus }) => {
  const readyForUpload = useMemo(() => patients.filter(p => {
    const status = String(p.statusConsultation).trim();
    const upload = String(p.statusUpload).trim();
    return status === 'Completado' && upload === 'Pendiente de Carga';
  }), [patients]);

  const [selectedPatient, setSelectedPatient] = useState(null);

  const handleUpload = async () => {
    if(confirm(`¿Confirmar carga de ${selectedPatient.name}?`)) {
      await onUpdateStatus(selectedPatient.dni, 'Cargado');
      setSelectedPatient(null);
    }
  };

  if (selectedPatient) {
    return (
      <div className="flex flex-col h-full animate-fadeIn">
        <div className="flex items-center gap-2 mb-6"><Button variant="ghost" onClick={() => setSelectedPatient(null)} icon={ChevronLeft}>Volver</Button><h2 className="text-xl font-bold">Carga Administrativa</h2></div>
        <Card className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white"><div className="p-6">
          <h3 className="text-2xl font-bold">{selectedPatient.name}</h3><p>DNI: {selectedPatient.dni}</p>
          <div className="mt-2 text-sm bg-white/20 inline-block px-2 py-1 rounded">COD: {selectedPatient.reprocannCode}</div>
        </div></Card>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h4 className="font-bold text-teal-800 border-b pb-2">Datos Médicos</h4>
            <CopyField label="Diagnóstico" value={selectedPatient.diagnosis} />
            <CopyField label="Resumen" value={selectedPatient.clinicalSummary} multiline />
            <CopyField label="Síntomas" value={selectedPatient.symptoms} />
            <CopyField label="Tratamiento" value={selectedPatient.treatment} />
            <CopyField label="Justificación" value={selectedPatient.justification} multiline />
            <CopyField label="Receta" value={selectedPatient.recipe} multiline />
          </Card>
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <h4 className="font-bold text-purple-800 border-b pb-2">Documentación</h4>
              <CopyField label="Código Vinculación" value={selectedPatient.reprocannCode} />
              <div className="py-2 border-t mt-2">
                 <span className={`flex items-center gap-2 ${selectedPatient.hasSignature ? 'text-green-600' : 'text-red-600'}`}>
                   {selectedPatient.hasSignature ? <FileCheck/> : <AlertCircle/>} {selectedPatient.hasSignature ? 'Firma OK' : 'Falta Firma'}
                 </span>
                 {selectedPatient.paymentProofUrl && <a href={selectedPatient.paymentProofUrl} target="_blank" className="block mt-2 text-blue-600 underline text-sm">Ver Comprobante</a>}
              </div>
            </Card>
            <Button onClick={handleUpload} variant="success" className="w-full py-4 text-lg">MARCAR COMO CARGADO</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Panel Administrativo ({readyForUpload.length})</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {readyForUpload.map((p, idx) => (
          <Card key={`${p.id}-${idx}`} className="cursor-pointer hover:shadow-lg border-l-4 border-l-purple-500">
            <div className="p-6" onClick={() => setSelectedPatient(p)}>
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-sm text-gray-500 mb-2">DNI: {p.dni}</p>
              <div className="text-purple-600 font-bold text-sm flex items-center gap-1">ABRIR <ChevronRight size={14}/></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// --- APP MAIN ---
export default function App() {
  const [role, setRole] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState(GOOGLE_SCRIPT_URL);
  const [configOpen, setConfigOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
       if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
       else await signInAnonymously(auth);
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (sheetsUrl) {
        try {
          const data = await apiService.getPatients(sheetsUrl);
          setPatients(data);
        } catch (error) {
          console.error("Error conectando con Sheets: " + error.message);
        }
        setLoading(false);
      } else if (user) {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'patients'), orderBy('entryDate', 'desc'));
        onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setPatients(data);
          setLoading(false);
        });
      }
    };
    loadData();
  }, [user, sheetsUrl]);

  const handleUpdatePatient = async (data) => {
    if (sheetsUrl) {
      await apiService.saveConsultation(data);
      const newData = await apiService.getPatients(sheetsUrl);
      setPatients(newData);
    } else {
      // Demo fallback
    }
  };

  const handleUpdateStatus = async (dni, status) => {
    if (sheetsUrl) {
      await apiService.updateStatus(dni, status);
      const newData = await apiService.getPatients(sheetsUrl);
      setPatients(newData);
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center p-4">
        <button onClick={() => setConfigOpen(!configOpen)} className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white hover:bg-white/30 transition-all">
          <Settings size={24} />
        </button>
        {configOpen && (
          <div className="absolute top-16 right-4 w-96 bg-white p-4 rounded-xl shadow-2xl z-50 animate-fadeIn">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><LinkIcon size={16}/> Conexión Sheets</h3>
            <input type="text" className="w-full p-2 border rounded mb-2 text-xs font-mono text-gray-600" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)}/>
            <div className="flex justify-end gap-2"><Button variant="primary" size="sm" onClick={() => setConfigOpen(false)}>Guardar</Button></div>
          </div>
        )}
        <Card className="w-full max-w-lg p-8 text-center space-y-8 shadow-2xl">
          <h1 className="text-4xl font-extrabold text-gray-800">Sistema Reprocann</h1>
          <div className="space-y-4">
            <button onClick={() => setRole('doctor')} className="w-full p-5 bg-white border border-gray-100 shadow rounded-2xl flex items-center gap-4 hover:shadow-lg transition-all">
              <div className="bg-teal-100 p-3 rounded-full text-teal-600"><Stethoscope size={24}/></div>
              <div className="text-left"><div className="font-bold text-gray-800">Soy la Doctora</div><div className="text-sm text-gray-500">Juliana Mijalchuk</div></div>
            </button>
            <button onClick={() => setRole('admin')} className="w-full p-5 bg-white border border-gray-100 shadow rounded-2xl flex items-center gap-4 hover:shadow-lg transition-all">
              <div className="bg-purple-100 p-3 rounded-full text-purple-600"><FileText size={24}/></div>
              <div className="text-left"><div className="font-bold text-gray-800">Soy Administrativo</div><div className="text-sm text-gray-500">Carga y Vinculación</div></div>
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${role === 'doctor' ? 'bg-teal-100 text-teal-600' : 'bg-purple-100 text-purple-600'}`}>
            {role === 'doctor' ? <Stethoscope/> : <FileText/>}
          </div>
          <div>
            <h1 className="font-bold text-gray-800">{role === 'doctor' ? 'Consultorio Digital' : 'Centro de Carga'}</h1>
            <p className="text-xs text-gray-500">Conectado a Sheets</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => setRole(null)} icon={LogOut}>Salir</Button>
      </header>
      <main className="max-w-[1600px] mx-auto p-6">
        {loading ? <div className="flex justify-center py-20"><Loader className="animate-spin text-teal-600"/></div> : (
          role === 'doctor' 
            ? <DoctorDashboard patients={patients} onUpdatePatient={handleUpdatePatient} loading={loading} completedHistory={patients.filter(p => p.statusConsultation === 'Completado')} />
            : <AdminDashboard patients={patients} onUpdateStatus={handleUpdateStatus} />
        )}
      </main>
    </div>
  );
}
