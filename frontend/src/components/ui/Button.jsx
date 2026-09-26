export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  onClick, 
  type = 'button',
  disabled = false,
  ...props 
}) {
  
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-200",
    secondary: "bg-brand-100 text-brand-700 hover:bg-brand-200 disabled:opacity-50",
    outline: "border-2 border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-50",
    ghost: "text-brand-600 hover:bg-brand-100 hover:text-brand-700"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-4 text-lg" // Large touch target for kiosk accessibility
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}