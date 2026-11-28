import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Loader2, MapPin, Search } from 'lucide-react';
import { locationsApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type {
  AreaType,
  SelectedWbLocation,
  WbDistrict,
  WbGpWard,
  WbLocalBody,
  WbSubdivision,
  WbVillage
} from '../types';

interface Props {
  value: SelectedWbLocation;
  onChange: (next: SelectedWbLocation, humanLabel?: { en: string; bn: string }) => void;
  compact?: boolean;
  showGpsDetect?: boolean;
  requiredLocation?: boolean;
}

export const EMPTY_WB_LOCATION: SelectedWbLocation = {
  stateName: 'West Bengal',
  districtId: '',
  subdivisionId: '',
  areaType: '',
  localBodyId: '',
  gpWardId: '',
  villageId: '',
  villageLocality: '',
  pincode: '',
  latitude: null,
  longitude: null,
  gpsConsent: false
};

export const LocationCascadingSelect: React.FC<Props> = ({
  value,
  onChange,
  compact = false,
  showGpsDetect = true,
  requiredLocation = false
}) => {
  const { t } = useTranslation();
  const { language } = useAuth();

  const [districts, setDistricts] = useState<WbDistrict[]>([]);
  const [subdivisions, setSubdivisions] = useState<WbSubdivision[]>([]);
  const [localBodies, setLocalBodies] = useState<WbLocalBody[]>([]);
  const [gpWards, setGpWards] = useState<WbGpWard[]>([]);
  const [villages, setVillages] = useState<WbVillage[]>([]);

  const [pinLookupBusy, setPinLookupBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    locationsApi
      .getDistricts()
      .then((res) => setDistricts(res.districts))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!value.districtId) {
      setSubdivisions([]);
      return;
    }
    locationsApi
      .getSubdivisions(value.districtId)
      .then((res) => setSubdivisions(res.subdivisions))
      .catch(() => setSubdivisions([]));
  }, [value.districtId]);

  useEffect(() => {
    if (!value.districtId) {
      setLocalBodies([]);
      return;
    }
    locationsApi
      .getLocalBodies({
        districtId: value.districtId,
        subdivisionId: value.subdivisionId || undefined,
        areaType: value.areaType || undefined
      })
      .then((res) => setLocalBodies(res.localBodies))
      .catch(() => setLocalBodies([]));
  }, [value.districtId, value.subdivisionId, value.areaType]);

  useEffect(() => {
    if (!value.localBodyId) {
      setGpWards([]);
      return;
    }
    locationsApi
      .getGpWards(value.localBodyId, value.areaType === 'urban' ? 'ward' : value.areaType === 'rural' ? 'gp' : undefined)
      .then((res) => setGpWards(res.gpWards))
      .catch(() => setGpWards([]));
  }, [value.localBodyId, value.areaType]);

  useEffect(() => {
    if (value.areaType === 'rural' && value.gpWardId) {
      locationsApi
        .getVillages({ gpWardId: value.gpWardId })
        .then((res) => setVillages(res.villages))
        .catch(() => setVillages([]));
    } else if (value.areaType === 'urban' && value.localBodyId) {
      locationsApi
        .getVillages({ localBodyId: value.localBodyId })
        .then((res) => setVillages(res.villages))
        .catch(() => setVillages([]));
    } else {
      setVillages([]);
    }
  }, [value.areaType, value.gpWardId, value.localBodyId]);

  const buildLabels = (next: SelectedWbLocation) => {
    const dist = districts.find((d) => d.id === next.districtId);
    const sub = subdivisions.find((s) => s.id === next.subdivisionId);
    const lb = localBodies.find((b) => b.id === next.localBodyId);
    const gw = gpWards.find((g) => g.id === next.gpWardId);
    const vil = villages.find((v) => v.id === next.villageId);
    const en = [vil?.name_en || next.villageLocality, gw?.name_en, lb?.name_en, sub?.name_en, dist?.name_en]
      .filter(Boolean)
      .join(', ');
    const bn = [vil?.name_bn || next.villageLocality, gw?.name_bn, lb?.name_bn, sub?.name_bn, dist?.name_bn]
      .filter(Boolean)
      .join(', ');
    return { en, bn };
  };

  const emit = (patch: Partial<SelectedWbLocation>) => {
    const next = { ...value, ...patch };
    onChange(next, buildLabels(next));
  };

  const handlePinLookup = async () => {
    const cleaned = value.pincode.replace(/\D/g, '').slice(0, 6);
    if (cleaned.length !== 6) {
      setErrorMsg(t('locations.pin_invalid'));
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setPinLookupBusy(true);
    try {
      const res = await locationsApi.lookupByPincode(cleaned);
      const next: SelectedWbLocation = {
        ...value,
        pincode: res.pincode,
        districtId: res.districtId || '',
        subdivisionId: res.subdivisionId || '',
        areaType: (res.areaType as AreaType) || value.areaType,
        localBodyId: res.localBodyId || '',
        gpWardId: res.gpWardId || '',
        villageId: res.villageId || '',
        latitude: value.gpsConsent && value.latitude !== null ? value.latitude : res.latitude,
        longitude: value.gpsConsent && value.longitude !== null ? value.longitude : res.longitude
      };
      onChange(next, buildLabels(next));
      setStatusMsg(t('locations.pin_autofilled'));
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setPinLookupBusy(false);
    }
  };

  const handleDetectGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMsg(t('locations.gps_unavailable'));
      return;
    }
    setErrorMsg('');
    setStatusMsg('');
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsBusy(false);
        const next: SelectedWbLocation = {
          ...value,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          gpsConsent: true
        };
        onChange(next, buildLabels(next));
        setStatusMsg(
          `${t('locations.gps_detected')}: ${next.latitude?.toFixed(4)}, ${next.longitude?.toFixed(4)}`
        );
      },
      () => {
        setGpsBusy(false);
        setErrorMsg(t('locations.gps_denied_fallback'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const labelText = (item?: { name_en: string; name_bn: string } | null) =>
    !item ? '' : language === 'bn' ? `${item.name_bn} (${item.name_en})` : item.name_en;

  const isUrban = value.areaType === 'urban';
  const isRural = value.areaType === 'rural';

  return (
    <div className={`space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 ${compact ? 'p-3.5' : 'p-4 sm:p-5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MapPin className="w-4 h-4 text-brand-blue shrink-0" />
          <span>{t('locations.section_title')}</span>
        </div>

        {showGpsDetect && (
          <button
            type="button"
            onClick={handleDetectGps}
            disabled={gpsBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-brand-blue text-xs font-bold border border-blue-200 transition disabled:opacity-60"
          >
            {gpsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
            <span>{gpsBusy ? t('locations.detecting_gps') : t('locations.detect_gps')}</span>
          </button>
        )}
      </div>

      {/* Quick PIN Code Auto-Fill */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          maxLength={6}
          value={value.pincode}
          onChange={(e) => emit({ pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
          placeholder={t('locations.pincode_placeholder')}
          className="flex-1 border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm"
        />
        <button
          type="button"
          onClick={handlePinLookup}
          disabled={pinLookupBusy || value.pincode.length < 6}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-green hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
        >
          {pinLookupBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          <span>{t('locations.pin_lookup_btn')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* State (Fixed West Bengal) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('locations.state')}</label>
          <input
            type="text"
            value={language === 'bn' ? 'পশ্চিমবঙ্গ (West Bengal)' : 'West Bengal'}
            disabled
            className="w-full border border-slate-200 bg-slate-100 text-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold"
          />
        </div>

        {/* District */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('locations.district')}</label>
          <select
            value={value.districtId}
            required={requiredLocation}
            onChange={(e) => {
              const dist = districts.find((d) => d.id === e.target.value);
              emit({
                districtId: e.target.value,
                subdivisionId: '',
                localBodyId: '',
                gpWardId: '',
                villageId: '',
                latitude: value.gpsConsent && value.latitude !== null ? value.latitude : (dist?.latitude ?? null),
                longitude: value.gpsConsent && value.longitude !== null ? value.longitude : (dist?.longitude ?? null)
              });
            }}
            className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm"
          >
            <option value="">{t('locations.select_district')}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {labelText(d)}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-Division */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('locations.subdivision')}</label>
          <select
            value={value.subdivisionId}
            disabled={!value.districtId}
            onChange={(e) =>
              emit({
                subdivisionId: e.target.value,
                localBodyId: '',
                gpWardId: '',
                villageId: ''
              })
            }
            className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm disabled:bg-slate-100"
          >
            <option value="">{t('locations.select_subdivision')}</option>
            {subdivisions.map((s) => (
              <option key={s.id} value={s.id}>
                {labelText(s)}
              </option>
            ))}
          </select>
        </div>

        {/* Area Type Toggle (Urban vs Rural — never forces both Block and Municipality) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">{t('locations.area_type')}</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                emit({
                  areaType: 'rural',
                  localBodyId: '',
                  gpWardId: '',
                  villageId: ''
                })
              }
              className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition ${
                isRural
                  ? 'border-brand-green bg-emerald-50 text-brand-green'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('locations.rural')}
            </button>
            <button
              type="button"
              onClick={() =>
                emit({
                  areaType: 'urban',
                  localBodyId: '',
                  gpWardId: '',
                  villageId: ''
                })
              }
              className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition ${
                isUrban
                  ? 'border-brand-blue bg-blue-50 text-brand-blue'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t('locations.urban')}
            </button>
          </div>
        </div>

        {/* Block OR Municipality / Municipal Corporation */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {isUrban ? t('locations.municipality_corp') : isRural ? t('locations.cd_block') : t('locations.block_or_ulb')}
          </label>
          <select
            value={value.localBodyId}
            disabled={!value.districtId}
            onChange={(e) => {
              const lb = localBodies.find((b) => b.id === e.target.value);
              const inferredPin = lb?.pincodes && lb.pincodes.length ? lb.pincodes[0] : value.pincode;
              emit({
                localBodyId: e.target.value,
                areaType: lb?.area_type || value.areaType,
                gpWardId: '',
                villageId: '',
                pincode: value.pincode || inferredPin || '',
                latitude: value.gpsConsent && value.latitude !== null ? value.latitude : (lb?.latitude ?? value.latitude),
                longitude: value.gpsConsent && value.longitude !== null ? value.longitude : (lb?.longitude ?? value.longitude)
              });
            }}
            className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm disabled:bg-slate-100"
          >
            <option value="">
              {isUrban ? t('locations.select_municipality') : isRural ? t('locations.select_block') : t('locations.select_block_or_ulb')}
            </option>
            {localBodies.map((lb) => (
              <option key={lb.id} value={lb.id}>
                {labelText(lb)}
              </option>
            ))}
          </select>
        </div>

        {/* Gram Panchayat (Rural) OR Ward (Urban) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {isUrban ? t('locations.ward') : isRural ? t('locations.gram_panchayat') : t('locations.gp_or_ward')}
          </label>
          <select
            value={value.gpWardId}
            disabled={!value.localBodyId}
            onChange={(e) => {
              const gw = gpWards.find((g) => g.id === e.target.value);
              emit({
                gpWardId: e.target.value,
                villageId: '',
                pincode: gw?.pincode || value.pincode
              });
            }}
            className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm disabled:bg-slate-100"
          >
            <option value="">
              {isUrban ? t('locations.select_ward') : isRural ? t('locations.select_gp') : t('locations.select_gp_or_ward')}
            </option>
            {gpWards.map((gw) => (
              <option key={gw.id} value={gw.id}>
                {labelText(gw)}
              </option>
            ))}
          </select>
        </div>

        {/* Village (Rural) OR Urban Locality */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {isUrban ? t('locations.locality') : t('locations.village')}
          </label>
          {villages.length > 0 ? (
            <select
              value={value.villageId}
              onChange={(e) => {
                const vil = villages.find((v) => v.id === e.target.value);
                emit({
                  villageId: e.target.value,
                  villageLocality: vil ? vil.name_en : value.villageLocality,
                  pincode: vil?.pincode || value.pincode,
                  latitude: value.gpsConsent && value.latitude !== null ? value.latitude : (vil?.latitude ?? value.latitude),
                  longitude: value.gpsConsent && value.longitude !== null ? value.longitude : (vil?.longitude ?? value.longitude)
                });
              }}
              className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm"
            >
              <option value="">{isUrban ? t('locations.select_locality') : t('locations.select_village')}</option>
              {villages.map((v) => (
                <option key={v.id} value={v.id}>
                  {labelText(v)}{v.pincode ? ` (${v.pincode})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.villageLocality}
              onChange={(e) => emit({ villageLocality: e.target.value })}
              placeholder={isUrban ? t('locations.locality_placeholder') : t('locations.village_placeholder')}
              className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs sm:text-sm"
            />
          )}
        </div>

        {/* Optional GPS Consent Indicator */}
        {showGpsDetect && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2 w-full cursor-pointer">
              <input
                type="checkbox"
                checked={value.gpsConsent}
                onChange={(e) =>
                  emit({
                    gpsConsent: e.target.checked,
                    ...(e.target.checked ? {} : { latitude: null, longitude: null })
                  })
                }
                className="w-4 h-4 accent-brand-blue shrink-0"
              />
              <span>{t('locations.gps_consent_label')}</span>
            </label>
          </div>
        )}
      </div>

      {statusMsg && <div className="text-xs font-semibold text-brand-green">{statusMsg}</div>}
      {errorMsg && <div className="text-xs font-semibold text-red-600">{errorMsg}</div>}
    </div>
  );
};
