'use client';

import React, { useState, type FC, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export type IconComponent = React.FC<{
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
}>;

export const HugeiconsIcon: React.FC<{
  icon: ReactNode | IconComponent;
  size?: number;
  className?: string;
  strokeWidth?: number;
  color?: string;
}> = ({ icon: Icon, size = 20, className, strokeWidth = 1.5, color }) => {
  if (typeof Icon === 'function') {
    const Component = Icon as IconComponent;
    return <Component size={size} className={className} strokeWidth={strokeWidth} color={color} />;
  }
  return <>{Icon}</>;
};

export const Add01Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const Cancel01Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 2,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const Folder01Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6c.7 0 1.3.3 1.8.8l1.3 1.4c.5.5 1.1.8 1.8.8h4.5A2.5 2.5 0 0 1 21 10.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18.5v-11z" />
  </svg>
);

export const TaskEdit01Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m9 11 2 2 4-4" />
    <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" />
  </svg>
);

export const NoteIcon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const Award01Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8" r="6" />
    <path d="m15.5 13.5 2 7.5-5.5-3-5.5 3 2-7.5" />
  </svg>
);

export const Flag02Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
  </svg>
);

export const Calendar04Icon: IconComponent = ({
  size = 20,
  className,
  strokeWidth = 1.5,
  color = 'currentColor',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18M16 2v4M8 2v4" />
    <circle cx="12" cy="15" r="1" />
  </svg>
);

export interface DisclosureItem {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
}

export interface CreateNewDisclosureProps {
  items?: DisclosureItem[];
  initialOpen?: boolean;
  onSelectItem?: (label: string) => void;
  className?: string;
}

interface GridItemProps {
  icon: ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
}

const transitionSpring = {
  duration: 0.16,
  ease: [0.22, 1, 0.36, 1] as const,
};

const GridItem: FC<GridItemProps> = ({ icon, label, description, onClick }) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-center transition-all hover:border-white/15 hover:bg-white/[0.06] cursor-pointer"
    >
      <div className="text-white/60 transition-colors group-hover:text-white">
        {icon}
      </div>
      <span className="text-xs font-medium tracking-tight text-white/80 group-hover:text-white">
        {label}
      </span>
      {description && (
        <span className="text-[10px] text-white/40 line-clamp-1">
          {description}
        </span>
      )}
    </motion.button>
  );
};

export const CreateNewDisclosure: FC<CreateNewDisclosureProps> = ({
  items,
  initialOpen = false,
  onSelectItem,
  className = '',
}) => {
  const [open, setOpen] = useState<boolean>(initialOpen);

  const defaultItems: DisclosureItem[] = [
    {
      icon: <HugeiconsIcon icon={Folder01Icon} size={20} />,
      label: 'Project',
      description: 'Zero-token scaffold',
    },
    {
      icon: <HugeiconsIcon icon={TaskEdit01Icon} size={20} />,
      label: 'Task',
      description: 'Actionable work',
    },
    {
      icon: <HugeiconsIcon icon={NoteIcon} size={20} />,
      label: 'Note',
      description: 'Context scratchpad',
    },
    {
      icon: <HugeiconsIcon icon={Award01Icon} size={20} />,
      label: 'Goal',
      description: 'Target metric',
    },
    {
      icon: <HugeiconsIcon icon={Flag02Icon} size={20} />,
      label: 'Milestone',
      description: 'Delivery marker',
    },
    {
      icon: <HugeiconsIcon icon={Calendar04Icon} size={20} />,
      label: 'Reminder',
      description: 'Timed alert',
    },
  ];

  const disclosureItems = items || defaultItems;

  const handleItemClick = (item: DisclosureItem) => {
    if (item.onClick) {
      item.onClick();
    }
    if (onSelectItem) {
      onSelectItem(item.label);
    }
    setOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Static trigger button that maintains exact dimensions and never pushes the layout */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-[#161719] px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/90 shadow-sm transition-all hover:border-white/25 hover:bg-[#1c1d21] focus:outline-none"
      >
        <HugeiconsIcon
          icon={open ? Cancel01Icon : Add01Icon}
          size={15}
          className="text-white/70"
          strokeWidth={2}
        />
        <span>Create New</span>
      </button>

      {/* Floating Overlay Popover — Does NOT push or expand the screen */}
      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setOpen(false)}
            />

            {/* Floating Popover Card */}
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.1 } }}
              transition={transitionSpring}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-white/15 bg-[#161719]/95 p-3 shadow-2xl shadow-black/80 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/70 font-mono">
                  Create Workspace Item
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={13}
                    strokeWidth={2}
                  />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/10 bg-black/40 p-1.5">
                {disclosureItems.map((item, index) => (
                  <GridItem
                    key={index}
                    icon={item.icon}
                    label={item.label}
                    description={item.description}
                    onClick={() => handleItemClick(item)}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateNewDisclosure;
