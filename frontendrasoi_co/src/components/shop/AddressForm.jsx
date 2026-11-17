import { useEffect, useState } from 'react';
import api from '../../api/axios';
import useApi from '../../hooks/useApi';

export const EMPTY_ADDRESS = {
  full_name: '',
  mobile: '',
  house: '',
  street: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  address_type: 'home',
  is_default: false,
};

export function validateAddress(a) {
  const e = {};
  if (!a.full_name.trim()) e.full_name = 'Enter the full name';
  if (!/^[6-9]\d{9}$/.test(a.mobile)) e.mobile = 'Enter a valid 10-digit mobile number';
  if (!a.house.trim()) e.house = 'Enter house / flat / building';
  if (!a.street.trim()) e.street = 'Enter street / area';
  if (!a.city.trim()) e.city = 'Enter the city';
  if (!a.state) e.state = 'Choose a state';
  if (!/^[1-9]\d{5}$/.test(a.pincode)) e.pincode = 'Enter a valid 6-digit PIN code';
  return e;
}

/** Indian address form: +91 mobile, state dropdown (all states & UTs), 6-digit PIN with auto city fill. */
export default function AddressForm({ value, onChange, errors = {}, showType = true }) {
  const { data: states } = useApi('/states/');
  const [pinInfo, setPinInfo] = useState(null);
  const set = (k, v) => onChange({ ...value, [k]: v });

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(value.pincode)) {
      setPinInfo(null);
      return;
    }
    let alive = true;
    api.get(`/pincode-check/${value.pincode}/`).then(({ data }) => {
      if (!alive) return;
      setPinInfo(data);
      if (data.city && !value.city) onChange({ ...value, city: data.city, state: data.state || value.state });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.pincode]);

  const field = (key, label, props = {}) => (
    <div className={`field ${props.wide ? 'field-wide' : ''}`}>
      <label className="label" htmlFor={`addr-${key}`}>{label}</label>
      <input
        id={`addr-${key}`}
        className={`input ${errors[key] ? 'has-error' : ''}`}
        value={value[key]}
        onChange={(e) => set(key, props.digits ? e.target.value.replace(/\D/g, '').slice(0, props.max) : e.target.value)}
        inputMode={props.digits ? 'numeric' : undefined}
        maxLength={props.max}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
      />
      {errors[key] && <p className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="address-form">
      {field('full_name', 'Full name', { autoComplete: 'name', wide: true })}
      <div className="field">
        <label className="label" htmlFor="addr-mobile">Mobile number</label>
        <div className={`input-prefix ${errors.mobile ? 'has-error' : ''}`}>
          <span>+91</span>
          <input
            id="addr-mobile"
            className="input"
            inputMode="numeric"
            maxLength={10}
            placeholder="98765 43210"
            autoComplete="tel-national"
            value={value.mobile}
            onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
          />
        </div>
        {errors.mobile && <p className="field-error">{errors.mobile}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="addr-pincode">PIN code</label>
        <input
          id="addr-pincode"
          className={`input ${errors.pincode ? 'has-error' : ''}`}
          inputMode="numeric"
          maxLength={6}
          placeholder="6-digit PIN"
          autoComplete="postal-code"
          value={value.pincode}
          onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {errors.pincode ? (
          <p className="field-error">{errors.pincode}</p>
        ) : (
          pinInfo && <p className={`field-hint ${pinInfo.serviceable ? 'ok' : 'bad'}`}>{pinInfo.message}</p>
        )}
      </div>
      {field('house', 'House / Flat / Building', { wide: true, placeholder: 'Flat 302, Lotus Residency', autoComplete: 'address-line1' })}
      {field('street', 'Street / Area / Locality', { wide: true, placeholder: 'MG Road, Andheri East', autoComplete: 'address-line2' })}
      {field('landmark', 'Landmark (optional)', { placeholder: 'Near City Mall' })}
      {field('city', 'City / Town', { autoComplete: 'address-level2' })}
      <div className="field">
        <label className="label" htmlFor="addr-state">State / UT</label>
        <select id="addr-state" className={`select ${errors.state ? 'has-error' : ''}`} value={value.state} onChange={(e) => set('state', e.target.value)}>
          <option value="">Select state</option>
          {(states || []).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {errors.state && <p className="field-error">{errors.state}</p>}
      </div>
      {showType && (
        <div className="field">
          <span className="label">Address type</span>
          <div className="chip-row">
            {['home', 'work', 'other'].map((t) => (
              <button type="button" key={t} className={`chip ${value.address_type === t ? 'chip-active' : ''}`} onClick={() => set('address_type', t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
