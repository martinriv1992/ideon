import {
  AppWindow,
  BarChart3,
  Bot,
  Briefcase,
  Cloud,
  DoorOpen,
  Globe,
  Layers,
  Package,
  Plug,
  ShoppingBag,
  Users,
  Workflow,
  Wrench,
  Sparkles,
  type LucideProps,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<LucideProps>> = {
  "app-window": AppWindow,
  globe: Globe,
  "shopping-bag": ShoppingBag,
  users: Users,
  layers: Layers,
  package: Package,
  briefcase: Briefcase,
  workflow: Workflow,
  "bar-chart-3": BarChart3,
  "door-open": DoorOpen,
  cloud: Cloud,
  plug: Plug,
  bot: Bot,
  wrench: Wrench,
};

export function CategoryIcon({
  name,
  ...props
}: Omit<LucideProps, "name"> & { name: string | null }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon {...props} />;
}
