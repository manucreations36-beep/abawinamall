import {
  Bed,
  ChefHat,
  Footprints,
  Headphones,
  Laptop,
  Package,
  Refrigerator,
  Scissors,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Speaker,
  Tv,
  Watch,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Refrigerator,
  Tv,
  Speaker,
  ChefHat,
  Smartphone,
  Headphones,
  Laptop,
  Footprints,
  Sparkles,
  Watch,
  Bed,
  ShoppingBag,
  Scissors,
};

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Package;
  return <Icon className={className} aria-hidden />;
}
