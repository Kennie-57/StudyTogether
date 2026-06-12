import './Input.css';

export default function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
}) {
  return (
    <label className="input-group">
      {label && <span className="input-label">{label}</span>}
      <input
        className={`input-field ${error ? 'input-error' : ''}`}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
      {error && <span className="input-error-text">{error}</span>}
    </label>
  );
}
