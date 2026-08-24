import React, { useMemo } from 'react';
import { DriverRecord, SummaryStats } from '../types';
import { Users, Droplets, RotateCw, MapPin, Truck } from 'lucide-react';

interface SummaryCardsProps {
  records: DriverRecord[];
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ records }) => {
  const stats: SummaryStats = useMemo(() => {
    if (!records.length) {
      return {
        totalDrivers: 0,
        uniqueDrivers: 0,
        uniqueVehicles: 0,
        totalStationVolume: 0,
        totalLargeTrips: 0,
        totalSmallTrips: 0,
        totalTrips: 0,
        totalKm: 0,
        totalWaterVehicles: 0,
        avgKmPerDriver: 0,
        avgStationVolume: 0,
      };
    }

    const uniqueDriversSet = new Set<string>();
    const uniqueVehiclesSet = new Set<string>();
    let totalStationVolume = 0;
    let totalLargeTrips = 0;
    let totalSmallTrips = 0;
    let totalTrips = 0;
    let totalKm = 0;
    let totalWaterVehicles = 0;

    records.forEach((r) => {
      if (r.driverName) uniqueDriversSet.add(r.driverName.trim().toLowerCase());
      if (r.vehicleNumber) uniqueVehiclesSet.add(r.vehicleNumber.trim().toLowerCase());
      totalStationVolume += Number(r.stationVolume) || 0;
      totalLargeTrips += Number(r.largeTrips) || 0;
      totalSmallTrips += Number(r.smallTrips) || 0;
      totalTrips += Number(r.totalTrips) || 0;
      totalKm += Number(r.totalKm) || 0;
      totalWaterVehicles += Number(r.waterVehicles) || 0;
    });

    return {
      totalDrivers: records.length,
      uniqueDrivers: uniqueDriversSet.size,
      uniqueVehicles: uniqueVehiclesSet.size,
      totalStationVolume: Number(totalStationVolume.toFixed(1)),
      totalLargeTrips,
      totalSmallTrips,
      totalTrips,
      totalKm,
      totalWaterVehicles,
      avgKmPerDriver: records.length > 0 ? Math.round(totalKm / records.length) : 0,
      avgStationVolume: records.length > 0 ? Number((totalStationVolume / records.length).toFixed(1)) : 0,
    };
  }, [records]);

  const cards = [
    {
      id: 'stat-drivers',
      label: 'TỔNG TÀI XẾ',
      sublabel: `${stats.uniqueVehicles} xe hoạt động`,
      value: stats.totalDrivers.toLocaleString('vi-VN'),
      unit: 'tài xế',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/50',
      valueColor: 'text-blue-900',
      badge: `${stats.uniqueDrivers} cá nhân`,
    },
    {
      id: 'stat-volume',
      label: 'TỔNG KL TRẠM',
      sublabel: `TB ${stats.avgStationVolume} m³/tài xế`,
      value: stats.totalStationVolume.toLocaleString('vi-VN', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      unit: 'm³',
      icon: Droplets,
      iconBg: 'bg-purple-50 text-purple-600 border border-purple-200/50',
      valueColor: 'text-purple-900',
      badge: 'Khối lượng',
    },
    {
      id: 'stat-trips',
      label: 'TỔNG CHUYẾN',
      sublabel: `Lớn: ${stats.totalLargeTrips} • Nhỏ: ${stats.totalSmallTrips}`,
      value: stats.totalTrips.toLocaleString('vi-VN'),
      unit: 'lượt',
      icon: RotateCw,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/50',
      valueColor: 'text-amber-900',
      badge: `${stats.totalLargeTrips} lớn / ${stats.totalSmallTrips} nhỏ`,
    },
    {
      id: 'stat-km',
      label: 'TỔNG KM',
      sublabel: `TB ${stats.avgKmPerDriver.toLocaleString('vi-VN')} km/xe`,
      value: stats.totalKm.toLocaleString('vi-VN'),
      unit: 'km',
      icon: MapPin,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/50',
      valueColor: 'text-emerald-900',
      badge: 'Quãng đường',
    },
    {
      id: 'stat-water',
      label: 'TỔNG XE NƯỚC',
      sublabel: 'Chuyến xe bồn hỗ trợ',
      value: stats.totalWaterVehicles.toLocaleString('vi-VN'),
      unit: 'chuyến',
      icon: Truck,
      iconBg: 'bg-sky-50 text-sky-600 border border-sky-200/50',
      valueColor: 'text-sky-900',
      badge: 'Tiếp nước',
    },
  ];

  return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">

      {cards.map((card) => {
        const IconComponent = card.icon;
        return (
          <div
            key={card.id}
            id={card.id}
                        className="group flex flex-col justify-between rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-[0_18px_35px_rgba(8,145,178,0.12)] sm:p-5"

          >
            <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">

                {card.label}
              </span>
                            <div className={`rounded-2xl p-2 transition-transform duration-200 group-hover:scale-105 ${card.iconBg}`}>

                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-1">
              <div className="flex items-baseline gap-1.5">
                                <span className={`text-2xl font-black tracking-tight ${card.valueColor} sm:text-[28px]`}>

                  {card.value}
                </span>
                <span className="text-xs font-medium text-slate-400">
                  {card.unit}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 mt-1 truncate">
                {card.sublabel}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
