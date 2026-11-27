import React from 'react';
import {
  Car,
  Cpu,
  Droplets,
  Hammer,
  HardHat,
  Paintbrush,
  Snowflake,
  Sparkles,
  Trees,
  Wifi,
  Wrench,
  Zap
} from 'lucide-react';

export const CATEGORY_SLUGS = [
  'electrician',
  'plumber',
  'ac_repair',
  'home_cleaning',
  'carpenter',
  'painter',
  'appliance_repair',
  'internet_technician',
  'construction_worker',
  'driver',
  'gardening',
  'other_services'
] as const;

export const CategoryIcon: React.FC<{ slug: string; className?: string }> = ({ slug, className = 'w-6 h-6' }) => {
  switch (slug) {
    case 'electrician':
      return <Zap className={className} />;
    case 'plumber':
      return <Droplets className={className} />;
    case 'ac_repair':
      return <Snowflake className={className} />;
    case 'home_cleaning':
      return <Sparkles className={className} />;
    case 'carpenter':
      return <Hammer className={className} />;
    case 'painter':
      return <Paintbrush className={className} />;
    case 'appliance_repair':
      return <Cpu className={className} />;
    case 'internet_technician':
      return <Wifi className={className} />;
    case 'construction_worker':
      return <HardHat className={className} />;
    case 'driver':
      return <Car className={className} />;
    case 'gardening':
      return <Trees className={className} />;
    default:
      return <Wrench className={className} />;
  }
};
