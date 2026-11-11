import { LoaderCircle } from 'lucide-react';

// Ícono del botón: spinner mientras trabaja, el ícono normal el resto del tiempo.
export default function BusyIcon({ busy, icon: Icon, size = 16 }) {
  return busy ? <LoaderCircle size={size} className="animate-spin" /> : <Icon size={size} />;
}
