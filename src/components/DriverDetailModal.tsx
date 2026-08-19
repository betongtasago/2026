import React, { useState, useEffect } from 'react';
import { DriverRecord } from '../types';
import { User, X, CheckCircle, Save } from 'lucide-react';

interface DriverDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DriverRecord | null;
  onSave: (savedRecord: DriverRecord) => void;
}

export const DriverDetailModal: React.FC<DriverDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<DriverRecord>>({
    driverName: '',
    vehicleNumber: '',
    stationVolume: 0,
    largeTrips: 0,
    smallTrips: 0,
    totalKm: 0,
    totalTrips: 0,
    waterVehicles: 0,
  });

  useEffect(() => {
    if (record) {
      setFormData(record);
    } else {
      setFormData({
        id: `custom-${Date.now()}`,
        driverName: '',
        vehicleNumber: '',
        stationVolume: 0,
        largeTrips: 0,
        smallTrips: 0,
        totalKm: 0,
        totalTrips: 0,
        waterVehicles: 0,
      });
    }
  }, [record, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driverName?.trim() || !formData.vehicleNumber?.trim()) return;

    const large = Number(formData.largeTrips) || 0;
    const small = Number(formData.smallTrips) || 0;
    const computedTotalTrips =
      formData.totalTrips && formData.totalTrips > 0
        ? Number(formData.totalTrips)
        : large + small;

    const finalRecord: DriverRecord = {
      id: formData.id || `custom-${Date.now()}`,
      stt: formData.stt || 1,
      driverName: formData.driverName.trim(),
      vehicleNumber: formData.vehicleNumber.trim().toUpperCase(),
      stationVolume: Number(Number(formData.stationVolume || 0).toFixed(1)),
      largeTrips: large,
      smallTrips: small,
      totalKm: Number(formData.totalKm) || 0,
      totalTrips: computedTotalTrips,
      waterVehicles: Number(formData.waterVehicles) || 0,
      hasWarning: formData.driverName.endsWith('.'),
    };

    onSave(finalRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#003B73] via-[#004B93] to-[#00529B] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold">
              {record ? 'Chỉnh Sửa Thông Tin Tài Xế' : 'Thêm Bản Ghi Mới'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Tên tài xế */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                TÊN TÀI XẾ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.driverName || ''}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                placeholder="VD: Đặng Kim Thương"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Số xe */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                SỐ XE <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.vehicleNumber || ''}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                placeholder="VD: 51B 33618"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* KL Trạm */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                KL TRẠM TN (m³)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.stationVolume ?? 0}
                onChange={(e) => setFormData({ ...formData, stationVolume: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-purple-700 font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Chuyến lớn */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                CHUYẾN LỚN
              </label>
              <input
                type="number"
                value={formData.largeTrips ?? 0}
                onChange={(e) => setFormData({ ...formData, largeTrips: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-amber-600 font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Chuyến nhỏ */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                CHUYẾN NHỎ
              </label>
              <input
                type="number"
                value={formData.smallTrips ?? 0}
                onChange={(e) => setFormData({ ...formData, smallTrips: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-amber-500 font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Tổng KM */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                TỔNG KM
              </label>
              <input
                type="number"
                value={formData.totalKm ?? 0}
                onChange={(e) => setFormData({ ...formData, totalKm: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-emerald-700 font-mono font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Tổng chuyến */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                TỔNG CHUYẾN
              </label>
              <input
                type="number"
                value={formData.totalTrips ?? ((formData.largeTrips || 0) + (formData.smallTrips || 0))}
                onChange={(e) => setFormData({ ...formData, totalTrips: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-red-600 font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Xe nước */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                XE NƯỚC (Số lượt tiếp nước)
              </label>
              <input
                type="number"
                value={formData.waterVehicles ?? 0}
                onChange={(e) => setFormData({ ...formData, waterVehicles: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-blue-700 font-bold focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu thông tin</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

