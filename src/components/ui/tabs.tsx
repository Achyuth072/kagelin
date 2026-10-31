import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const tabsListVariants = cva(
  "inline-flex items-center justify-center rounded-lg p-1 transition-colors",
  {
    variants: {
      variant: {
        brand: "bg-secondary/10 border border-border/40 text-muted-foreground",
        card: "bg-secondary/20 border border-border/40 text-muted-foreground",
      },
      size: {
        default: "h-10",
        sm: "h-9",
        lg: "h-11",
      },
    },
    defaultVariants: {
      variant: "card",
      size: "default",
    },
  },
);

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium tracking-tight border border-transparent ring-offset-background transition-seijaku-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-1.5 [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        brand:
          "text-muted-foreground hover:text-foreground hover:bg-secondary/40 data-[state=active]:bg-brand data-[state=active]:text-brand-foreground data-[state=active]:border-brand/20 data-[state=active]:shadow-none",
        card: "text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:border-border/80 data-[state=active]:[&:not(:has(svg))]:text-brand data-[state=active]:[&:has(svg)]:text-foreground data-[state=active]:shadow-xs [&_svg]:transition-colors data-[state=active]:[&_svg]:text-brand",
      },
      size: {
        default: "h-8 px-3 text-[13px]",
        sm: "h-7 px-2 text-xs [&_svg]:size-3",
        lg: "h-9 px-2.5 sm:px-3 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "card",
      size: "default",
    },
  },
);

type TabsVariant = NonNullable<
  VariantProps<typeof tabsListVariants>["variant"]
>;
type TabsSize = NonNullable<VariantProps<typeof tabsListVariants>["size"]>;

interface TabsListContextValue {
  variant: TabsVariant;
  size: TabsSize;
}

const TabsListContext = React.createContext<TabsListContextValue>({
  variant: "card",
  size: "default",
});

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>
>(({ className, variant, size, children, ...props }, ref) => {
  const resolvedVariant = variant ?? "card";
  const resolvedSize = size ?? "default";

  return (
    <TabsListContext.Provider
      value={{ variant: resolvedVariant, size: resolvedSize }}
    >
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          tabsListVariants({ variant: resolvedVariant, size: resolvedSize }),
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
    </TabsListContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, size, ...props }, ref) => {
  const context = React.useContext(TabsListContext);
  const resolvedVariant = variant ?? context.variant;
  const resolvedSize = size ?? context.size;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        tabsTriggerVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
