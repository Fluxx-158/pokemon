import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            'inline-flex items-end gap-1 border-b border-border text-muted-foreground',
            className,
        )}
        {...props}
    />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            'relative inline-flex items-center justify-center whitespace-nowrap px-3 pb-2 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            'hover:text-foreground focus-visible:outline-none focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50',
            'data-[state=active]:text-foreground',
            // Typewriter-cursor indicator: 2px bar grows left → right, with a
            // tiny overshoot (cubic-bezier easing) when becoming active.
            'after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-foreground',
            'after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-[cubic-bezier(0.2,0.7,0.2,1)]',
            'data-[state=active]:after:scale-x-100',
            className,
        )}
        {...props}
    />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className,
        )}
        {...props}
    />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
