import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { Instrument, AccuracyClass } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Scale,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Edit2,
  Play,
  FileSpreadsheet,
  X,
  Info,
} from 'lucide-react';

interface InstrumentsProps {
  onSelectInstrumentForTesting?: (instrument: Instrument) => void;
  onStartTest?: (instrument: Instrument) => void;
}

export const Instruments: React.FC<InstrumentsProps> = ({
  onSelectInstrumentForTesting,
  onStartTest,
}) => {
  const { currentUser, canRegisterInstrument } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSelectForTesting = (instrument: Instrument) => {
    if (onSelectInstrumentForTesting) {
      onSelectInstrumentForTesting(instrument);
    } else if (onStartTest) {
      onStartTest(instrument);
    }
  };

  // Form State
  const [formData, setFormData] = useState<{
    instrumentId: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    instrumentType: string;
    accuracyClass: AccuracyClass;
    maxCapacity: string;
    minCapacity: string;
    capacityUnit: 'kg' | 'g';
    e: string;
    d: string;
    intervalUnit: 'kg' | 'g' | 'mg';
    location: string;
    registrationDate: string;
    notes: string;
  }>({
    instrumentId: `NAWI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    manufacturer: '',
    model: '',
    serialNumber: '',
    instrumentType: 'Electronic Platform Scale',
    accuracyClass: 'III',
    maxCapacity: '15',
    minCapacity: '0.1',
    capacityUnit: 'kg',
    e: '5',
    d: '5',
    intervalUnit: 'g',
    location: 'Central Inspection Laboratory',
    registrationDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadInstruments();
  }, []);

  const loadInstruments = () => {
    setInstruments(storage.getInstruments());
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.instrumentId.trim()) errors.instrumentId = 'Instrument ID is required';
    if (!formData.manufacturer.trim()) errors.manufacturer = 'Manufacturer is required';
    if (!formData.model.trim()) errors.model = 'Model is required';
    if (!formData.serialNumber.trim()) errors.serialNumber = 'Serial number is required';
    if (!formData.location.trim()) errors.location = 'Location is required';

    const max = parseFloat(formData.maxCapacity);
    const min = parseFloat(formData.minCapacity);
    const e = parseFloat(formData.e);
    const d = parseFloat(formData.d);

    if (isNaN(max) || max <= 0) errors.maxCapacity = 'Max capacity must be a positive number';
    if (isNaN(min) || min <= 0) errors.minCapacity = 'Min capacity must be a positive number';
    if (!isNaN(max) && !isNaN(min) && min >= max) {
      errors.minCapacity = 'Minimum capacity (Min) must be strictly less than Maximum capacity (Max)';
    }

    if (isNaN(e) || e <= 0) errors.e = 'Verification scale interval (e) must be > 0';
    if (isNaN(d) || d <= 0) errors.d = 'Display scale interval (d) must be > 0';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      instrumentId: `NAWI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      manufacturer: '',
      model: '',
      serialNumber: '',
      instrumentType: 'Electronic Platform Scale',
      accuracyClass: 'III',
      maxCapacity: '30',
      minCapacity: '0.2',
      capacityUnit: 'kg',
      e: '10',
      d: '10',
      intervalUnit: 'g',
      location: 'Verification Bay 1',
      registrationDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (inst: Instrument) => {
    setEditingId(inst.id);
    setFormData({
      instrumentId: inst.instrumentId,
      manufacturer: inst.manufacturer,
      model: inst.model,
      serialNumber: inst.serialNumber,
      instrumentType: inst.instrumentType,
      accuracyClass: inst.accuracyClass,
      maxCapacity: inst.maxCapacity.toString(),
      minCapacity: inst.minCapacity.toString(),
      capacityUnit: inst.capacityUnit,
      e: inst.e.toString(),
      d: inst.d.toString(),
      intervalUnit: inst.intervalUnit,
      location: inst.location,
      registrationDate: inst.registrationDate,
      notes: inst.notes || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const instrumentData: Instrument = {
      id: editingId || `inst-${Date.now()}`,
      instrumentId: formData.instrumentId,
      manufacturer: formData.manufacturer,
      model: formData.model,
      serialNumber: formData.serialNumber,
      instrumentType: formData.instrumentType,
      accuracyClass: formData.accuracyClass,
      maxCapacity: parseFloat(formData.maxCapacity),
      minCapacity: parseFloat(formData.minCapacity),
      capacityUnit: formData.capacityUnit,
      e: parseFloat(formData.e),
      d: parseFloat(formData.d),
      intervalUnit: formData.intervalUnit,
      location: formData.location,
      registrationDate: formData.registrationDate,
      registeredBy: currentUser.name,
      notes: formData.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveInstrument(instrumentData, currentUser);
    loadInstruments();
    setShowModal(false);
    setSuccessMessage(
      editingId
        ? `Instrument ${instrumentData.instrumentId} successfully updated.`
        : `Instrument ${instrumentData.instrumentId} registered and saved to registry.`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Filter instruments
  const filteredInstruments = instruments.filter((inst) => {
    const matchesSearch =
      inst.instrumentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass = classFilter === 'all' || inst.accuracyClass === classFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <span>NAWI Instrument Registry</span>
          </h2>
          <p className="text-xs text-slate-500">
            Registered Non-Automatic Weighing Instruments conforming to OIML R-76 metrological specifications
          </p>
        </div>

        {canRegisterInstrument && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register New NAWI</span>
          </button>
        )}
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, manufacturer, model, or serial number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Accuracy Class:</span>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Classes (I - IV)</option>
            <option value="I">Class I (Special)</option>
            <option value="II">Class II (High)</option>
            <option value="III">Class III (Medium)</option>
            <option value="IV">Class IV (Ordinary)</option>
          </select>
        </div>
      </div>

      {/* Instruments List Grid / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Registered Instruments ({filteredInstruments.length})
          </span>
          <span className="text-[11px] text-slate-500">Persistent Metrology Store</span>
        </div>

        {filteredInstruments.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No instruments found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Instrument ID & SN</th>
                  <th className="py-3 px-4">Manufacturer & Model</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Capacity (Max / Min)</th>
                  <th className="py-3 px-4">Scale Intervals (e / d)</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-slate-900">{inst.instrumentId}</div>
                      <div className="text-[11px] text-slate-500">SN: {inst.serialNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{inst.manufacturer}</div>
                      <div className="text-[11px] text-slate-500">{inst.model}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">
                        Class {inst.accuracyClass}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>Max: {inst.maxCapacity} {inst.capacityUnit}</div>
                      <div className="text-[11px] text-slate-500">Min: {inst.minCapacity} {inst.capacityUnit}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>e = {inst.e} {inst.intervalUnit}</div>
                      <div className="text-[11px] text-slate-500">d = {inst.d} {inst.intervalUnit}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {inst.location}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {canRegisterInstrument && (
                          <button
                            onClick={() => handleOpenEdit(inst)}
                            title="Edit Instrument Specifications"
                            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleSelectForTesting(inst)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-colors inline-flex items-center space-x-1.5"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start Test</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration & Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-2">
                <Scale className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {editingId ? 'Edit NAWI Specifications' : 'Register New NAWI Instrument'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instrument ID */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instrument ID *
                  </label>
                  <input
                    type="text"
                    value={formData.instrumentId}
                    onChange={(e) => setFormData({ ...formData, instrumentId: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                      formErrors.instrumentId ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.instrumentId && (
                    <span className="text-[11px] text-rose-600">{formErrors.instrumentId}</span>
                  )}
                </div>

                {/* Serial Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SN-984210"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                      formErrors.serialNumber ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.serialNumber && (
                    <span className="text-[11px] text-rose-600">{formErrors.serialNumber}</span>
                  )}
                </div>

                {/* Manufacturer */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Manufacturer *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mettler Toledo, Sartorius, Essae"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.manufacturer ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.manufacturer && (
                    <span className="text-[11px] text-rose-600">{formErrors.manufacturer}</span>
                  )}
                </div>

                {/* Model */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ME204T, DS-215, Viper"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.model ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.model && (
                    <span className="text-[11px] text-rose-600">{formErrors.model}</span>
                  )}
                </div>

                {/* Instrument Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instrument Type
                  </label>
                  <select
                    value={formData.instrumentType}
                    onChange={(e) => setFormData({ ...formData, instrumentType: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Electronic Non-Automatic Platform Scale">Electronic Platform Scale</option>
                    <option value="Electromagnetic Force Compensation Balance">Analytical Precision Balance</option>
                    <option value="Counter / Benchtop Scale">Counter / Benchtop Scale</option>
                    <option value="Motor Vehicle Weighbridge">Motor Vehicle Weighbridge</option>
                    <option value="Crane Scale / Dynamometer">Crane Scale / Suspended</option>
                  </select>
                </div>

                {/* Accuracy Class */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Accuracy Class (OIML R-76) *
                  </label>
                  <select
                    value={formData.accuracyClass}
                    onChange={(e) =>
                      setFormData({ ...formData, accuracyClass: e.target.value as AccuracyClass })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  >
                    <option value="I">Class I - Special Accuracy (e.g. Microbalances)</option>
                    <option value="II">Class II - High Accuracy (e.g. Lab Balances)</option>
                    <option value="III">Class III - Medium Accuracy (e.g. Commercial Platform)</option>
                    <option value="IV">Class IV - Ordinary Accuracy (e.g. Bulk/Industrial)</option>
                  </select>
                </div>
              </div>

              {/* Metrological Limits & Scale Intervals */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-blue-600" />
                  <span>Metrological Parameters (Capacity & Intervals)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Max Capacity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Max Capacity *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 30"
                      value={formData.maxCapacity}
                      onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
                      className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                        formErrors.maxCapacity ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.maxCapacity && (
                      <span className="text-[11px] text-rose-600">{formErrors.maxCapacity}</span>
                    )}
                  </div>

                  {/* Min Capacity */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Min Capacity *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 0.1"
                      value={formData.minCapacity}
                      onChange={(e) => setFormData({ ...formData, minCapacity: e.target.value })}
                      className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                        formErrors.minCapacity ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.minCapacity && (
                      <span className="text-[11px] text-rose-600">{formErrors.minCapacity}</span>
                    )}
                  </div>

                  {/* Capacity Unit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Capacity Unit
                    </label>
                    <select
                      value={formData.capacityUnit}
                      onChange={(e) =>
                        setFormData({ ...formData, capacityUnit: e.target.value as 'kg' | 'g' })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    >
                      <option value="kg">Kilogram (kg)</option>
                      <option value="g">Gram (g)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {/* Verification Scale Interval (e) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verification Interval (e) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 10"
                      value={formData.e}
                      onChange={(e) => setFormData({ ...formData, e: e.target.value })}
                      className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                        formErrors.e ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.e && <span className="text-[11px] text-rose-600">{formErrors.e}</span>}
                  </div>

                  {/* Display Scale Interval (d) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Display Interval (d) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 10"
                      value={formData.d}
                      onChange={(e) => setFormData({ ...formData, d: e.target.value })}
                      className={`w-full px-3 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono ${
                        formErrors.d ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.d && <span className="text-[11px] text-rose-600">{formErrors.d}</span>}
                  </div>

                  {/* Interval Unit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Interval Unit
                    </label>
                    <select
                      value={formData.intervalUnit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          intervalUnit: e.target.value as 'kg' | 'g' | 'mg',
                        })
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    >
                      <option value="g">Grams (g)</option>
                      <option value="mg">Milligrams (mg)</option>
                      <option value="kg">Kilograms (kg)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Location & Registration Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Installation / Testing Location *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verification Bay 4, Lab 2"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.location ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                    }`}
                  />
                  {formErrors.location && (
                    <span className="text-[11px] text-rose-600">{formErrors.location}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registration Date
                  </label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metrological Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Special conditions, standard weights set used, ambient temperature sensitivity..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs"
                >
                  {editingId ? 'Save Changes' : 'Register Instrument'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
