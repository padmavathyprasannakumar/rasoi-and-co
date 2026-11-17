import { useState } from 'react';
import api from '../../api/axios';
import Icon from '../ui/Icon';

export default function PincodeChecker() {
  const [pin, setPin] = useState(() => localStorage.getItem('rasoi_pincode') || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async (e) => {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setResult({ serviceable: false, message: 'Please enter a valid 6-digit PIN code.' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/pincode-check/${pin}/`);
      setResult(data);
      localStorage.setItem('rasoi_pincode', pin);
    } catch {
      setResult({ serviceable: false, message: 'Could not check right now. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pincode-box">
      <span className="label"><Icon name="truck" size={16} /> Delivery across India</span>
      <form onSubmit={check} className="pincode-form">
        <label htmlFor="pin" className="sr-only">PIN code</label>
        <input
          id="pin"
          className="input"
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter 6-digit PIN code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn btn-outline" disabled={loading}>{loading ? 'Checking…' : 'Check'}</button>
      </form>
      {result && (
        <p className={`pincode-result ${result.serviceable ? 'ok' : 'bad'}`}>
          <Icon name={result.serviceable ? 'check' : 'close'} size={15} />
          <span>
            {result.message}
            {result.serviceable && result.estimated_delivery_display && (
              <small> (estimated {result.estimated_delivery_display})</small>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
